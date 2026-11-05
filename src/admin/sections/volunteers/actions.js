// Mutaciones de voluntariado. Los créditos solo los otorga un admin (ya no hay Cloud Function).
// Aprobar/revertir usan transacción: si otro admin aprobó el mismo registro, no se duplican créditos.
import {
  collection, doc, increment, runTransaction, serverTimestamp, updateDoc, writeBatch,
} from 'firebase/firestore';
import { auth, db } from '@/firebase';
import { logActivity } from '@/admin/lib';
import { emailKey, logCredits, round2 } from './utils';

const VOL = 'voluntarios2026';
const LOGS = 'volunteerAttendanceLogs';
const actor = () => auth?.currentUser?.email || 'admin';

/**
 * Aprueba registros de horas: marca el log y suma créditos al voluntario.
 * @returns {{ approved: number, credits: number, skipped: Array<{ log, reason }> }}
 */
export async function approveLogs(logs, byEmail) {
  const skipped = [];
  const ready = [];
  logs.forEach((log) => {
    const volunteer = byEmail.get(emailKey(log.email));
    const points = logCredits(log);
    if (!volunteer) skipped.push({ log, reason: 'Sin inscripción con ese correo' });
    else if (points <= 0) skipped.push({ log, reason: 'Sin créditos válidos' });
    else ready.push({ log, volunteer, points });
  });

  const doneItems = [];
  for (let i = 0; i < ready.length; i += 100) {
    const chunk = ready.slice(i, i + 100);
    // eslint-disable-next-line no-await-in-loop
    const result = await runTransaction(db, async (tx) => {
      const snaps = await Promise.all(chunk.map(({ log }) => tx.get(doc(db, LOGS, log.id))));
      const perVolunteer = new Map();
      const done = [];
      const already = [];
      chunk.forEach((item, idx) => {
        if (!snaps[idx].exists() || snaps[idx].data().creditsProcessed) { already.push(item.log); return; }
        tx.update(doc(db, LOGS, item.log.id), {
          creditsProcessed: true,
          creditsAssigned: item.points,
          creditsAssignedAt: serverTimestamp(),
          creditsAssignedBy: actor(),
          creditStatus: 'approved',
          updatedAt: serverTimestamp(),
        });
        perVolunteer.set(item.volunteer.id, (perVolunteer.get(item.volunteer.id) || 0) + item.points);
        done.push(item);
      });
      perVolunteer.forEach((pts, id) => tx.update(doc(db, VOL, id), { creditos: increment(round2(pts)) }));
      return { done, already };
    });
    result.already.forEach((log) => skipped.push({ log, reason: 'Ya estaba aprobado' }));
    doneItems.push(...result.done);
  }

  const approved = doneItems.length;
  const credits = doneItems.reduce((acc, item) => acc + item.points, 0);
  if (approved) {
    const who = approved === 1 ? `a ${doneItems[0].log.fullName || doneItems[0].log.email}` : `en ${approved} registros de horas`;
    await logActivity('voluntariado.horas_aprobadas', `Aprobó ${round2(credits)} crédito(s) ${who}`, {
      logIds: doneItems.map((r) => r.log.id), approved, credits: round2(credits),
    });
  }
  return { approved, credits: round2(credits), skipped };
}

/** Rechaza sin otorgar créditos; queda el motivo para el equipo. */
export async function rejectLogs(logs, reason) {
  const pending = logs.filter((l) => !l.creditsProcessed);
  for (let i = 0; i < pending.length; i += 400) {
    const batch = writeBatch(db);
    pending.slice(i, i + 400).forEach((log) => batch.update(doc(db, LOGS, log.id), {
      creditStatus: 'rejected',
      rejectionReason: reason,
      rejectedAt: serverTimestamp(),
      rejectedBy: actor(),
      updatedAt: serverTimestamp(),
    }));
    // eslint-disable-next-line no-await-in-loop
    await batch.commit();
  }
  if (pending.length) {
    const who = pending.length === 1 ? `el registro de ${pending[0].fullName || pending[0].email}` : `${pending.length} registros de horas`;
    await logActivity('voluntariado.horas_rechazadas', `Rechazó ${who}: ${reason}`, { logIds: pending.map((l) => l.id), reason });
  }
  return pending.length;
}

/** Vuelve a pendiente un registro aprobado y descuenta los créditos (sin bajar de 0). */
export async function revertLog(log, volunteer) {
  const removed = await runTransaction(db, async (tx) => {
    const logRef = doc(db, LOGS, log.id);
    const volRef = doc(db, VOL, volunteer.id);
    const [logSnap, volSnap] = await Promise.all([tx.get(logRef), tx.get(volRef)]);
    if (!logSnap.exists() || !logSnap.data().creditsProcessed) return 0;
    const data = logSnap.data();
    const points = round2(data.creditsAssigned ?? logCredits(data));
    const current = Number(volSnap.data()?.creditos) || 0;
    tx.update(volRef, { creditos: Math.max(0, round2(current - points)) });
    tx.update(logRef, {
      creditsProcessed: false,
      creditStatus: 'pending',
      creditsRemovedAt: serverTimestamp(),
      creditsRemovedBy: actor(),
      updatedAt: serverTimestamp(),
    });
    return points;
  });
  if (removed) {
    await logActivity('voluntariado.horas_revertidas', `Revirtió ${removed} crédito(s) de ${log.fullName || log.email} (${log.activityName || 'actividad'})`, { logId: log.id });
  }
  return removed;
}

/**
 * Horas registradas por un admin: crea el log ya aprobado y suma créditos en un solo batch.
 * `extra` permite marcar el origen (p. ej. evento).
 */
export function buildApprovedLog(volunteer, { activityName, attendanceDate, startTime = '', endTime = '', hours, credits }, extra = {}) {
  return {
    fullName: volunteer.fullName || '',
    email: emailKey(volunteer.email || volunteer.id),
    activityName,
    attendanceDate,
    startTime,
    endTime,
    startAtIso: '',
    endAtIso: '',
    proofImageUrl: '',
    proofImagePath: '',
    registeredHours: round2(hours),
    pendingCredits: round2(credits),
    creditsFormula: '1 credito = 2 horas',
    creditsProcessed: true,
    creditStatus: 'approved',
    creditsAssigned: round2(credits),
    creditsAssignedAt: serverTimestamp(),
    creditsAssignedBy: actor(),
    creditSourceType: 'admin',
    createdAt: serverTimestamp(),
    ...extra,
  };
}

export async function recordHours(volunteer, entry) {
  const batch = writeBatch(db);
  batch.set(doc(collection(db, LOGS)), buildApprovedLog(volunteer, entry));
  batch.update(doc(db, VOL, volunteer.id), { creditos: increment(round2(entry.credits)) });
  await batch.commit();
  await logActivity('voluntariado.horas_registradas', `Registró ${entry.hours} h (${entry.credits} crédito(s)) a ${volunteer.fullName || volunteer.email} en "${entry.activityName}"`, { volunteerId: volunteer.id });
}

/** Acredita a varios voluntarios por un evento (un log aprobado por persona). */
export async function creditEventParticipants(event, volunteers, credits) {
  const date = event.date?.toDate ? event.date.toDate() : event.date ? new Date(event.date) : null;
  const attendanceDate = date && !Number.isNaN(date.getTime()) ? date.toISOString().slice(0, 10) : '';
  for (let i = 0; i < volunteers.length; i += 200) {
    const batch = writeBatch(db);
    volunteers.slice(i, i + 200).forEach((v) => {
      batch.set(doc(collection(db, LOGS)), buildApprovedLog(v, { activityName: event.title, attendanceDate, hours: credits * 2, credits }, {
        creditSourceType: 'evento', sourceEventName: event.title, sourceEventId: event.id, creditsGeneratedFromEvent: true,
      }));
      batch.update(doc(db, VOL, v.id), { creditos: increment(round2(credits)) });
    });
    // eslint-disable-next-line no-await-in-loop
    await batch.commit();
  }
  await logActivity('voluntariado.evento_acreditado', `Acreditó ${credits} crédito(s) a ${volunteers.length} voluntario(s) por "${event.title}"`, { eventId: event.id, count: volunteers.length });
}

/** Ajuste manual con incremento atómico (no pisa aprobaciones hechas mientras el modal estaba abierto). */
export async function adjustCredits(volunteer, delta, reason) {
  await updateDoc(doc(db, VOL, volunteer.id), { creditos: increment(round2(delta)) });
  const before = Number(volunteer.creditos) || 0;
  await logActivity('voluntariado.creditos_ajustados', `Ajustó créditos de ${volunteer.fullName || volunteer.email}: ${before} → ${round2(before + delta)}${reason ? ` (${reason})` : ''}`, { volunteerId: volunteer.id, delta });
}

export async function updateVolunteer(volunteer, changes) {
  await updateDoc(doc(db, VOL, volunteer.id), changes);
  await logActivity('voluntariado.voluntario_editado', `Editó el perfil de ${changes.fullName || volunteer.fullName || volunteer.email}`, { volunteerId: volunteer.id });
}

export async function deleteVolunteers(list) {
  for (let i = 0; i < list.length; i += 400) {
    const batch = writeBatch(db);
    list.slice(i, i + 400).forEach((v) => batch.delete(doc(db, VOL, v.id)));
    // eslint-disable-next-line no-await-in-loop
    await batch.commit();
  }
  const who = list.length === 1 ? (list[0].fullName || list[0].email) : `${list.length} voluntarios`;
  await logActivity('voluntariado.voluntarios_eliminados', `Eliminó ${who}`, { ids: list.map((v) => v.id) });
}
