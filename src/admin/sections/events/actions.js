// Escrituras de la sección Eventos. Todas mantienen `events/{id}.registeredCount` coherente
// (el registro público lo incrementa en un batch; ver EventsPage.jsx y firestore.rules).
import {
  collection, deleteDoc, doc, getCountFromServer, getDoc, getDocs, increment, limit, query, serverTimestamp, setDoc, where, writeBatch,
} from 'firebase/firestore';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { auth, db, storage } from '@/firebase';
import { cleanFields, normalizeCode } from '@/lib/eventForms';
import { attendanceValue } from './data';
import { eventStart } from '../../../../functions/eventTime.js';

const CHUNK = 450; // límite de 500 operaciones por batch, con margen

/** Ejecuta operaciones `(batch) => void` en lotes de 450. */
export async function commitInChunks(ops) {
  for (let i = 0; i < ops.length; i += CHUNK) {
    const batch = writeBatch(db);
    ops.slice(i, i + CHUNK).forEach((op) => op(batch));
    await batch.commit(); // eslint-disable-line no-await-in-loop
  }
}

const me = () => auth?.currentUser?.email || null;
const countIncrements = (regs, sign) => {
  const byEvent = {};
  regs.forEach((r) => { if (r.eventId) byEvent[r.eventId] = (byEvent[r.eventId] || 0) + sign; });
  return byEvent;
};

/** Cuenta en el servidor los registros con ese eventId y fija `registeredCount`. */
export async function recalcCounts(eventIds) {
  const counts = await Promise.all(eventIds.map(async (id) => {
    const snap = await getCountFromServer(query(collection(db, 'registrations'), where('eventId', '==', id)));
    return [id, snap.data().count];
  }));
  await commitInChunks(counts.map(([id, count]) => (b) => b.update(doc(db, 'events', id), { registeredCount: count })));
  return Object.fromEntries(counts);
}

export async function setAttendance(regs, present) {
  await commitInChunks(regs.map((r) => (b) => b.update(doc(db, 'registrations', r.id), { statusAsistencia: attendanceValue(r.statusAsistencia, present) })));
}

export const updateRegistration = (id, updates) =>
  writeBatch(db).update(doc(db, 'registrations', id), { ...updates, updatedAt: serverTimestamp(), updatedBy: me() }).commit();

/** Borra registros y descuenta el cupo de sus eventos públicos en el mismo batch (si caben en uno). */
export async function deleteRegistrations(regs, publicIds) {
  const dec = Object.entries(countIncrements(regs.filter((r) => publicIds.has(r.eventId)), -1));
  await commitInChunks([
    ...dec.map(([id, n]) => (b) => b.update(doc(db, 'events', id), { registeredCount: increment(n) })),
    ...regs.map((r) => (b) => b.delete(doc(db, 'registrations', r.id))),
  ]);
}

/**
 * Agrega registros manuales. Para eventos públicos usa el id determinista `${eventId}_${email}`
 * (igual que el registro público) y suma el cupo en el mismo batch. Devuelve { added, skipped }.
 */
export async function addRegistrations(group, items) {
  const isPublic = group.kind === 'public';
  // Correos ya inscritos según el servidor (no el estado local, que puede estar desactualizado).
  const existing = new Set();
  const snaps = await Promise.all([
    getDocs(query(collection(db, 'registrations'), where('eventName', '==', group.name))),
    ...(isPublic ? [getDocs(query(collection(db, 'registrations'), where('eventId', '==', group.id)))] : []),
  ]);
  snaps.forEach((s) => s.docs.forEach((d) => existing.add(String(d.data().userEmail || '').toLowerCase())));

  const fresh = [];
  items.forEach((it) => {
    const email = it.email.trim().toLowerCase();
    if (!email || existing.has(email)) return;
    existing.add(email);
    fresh.push({ ...it, email });
  });
  if (!fresh.length) return { added: 0, skipped: items.length };

  const ops = fresh.map((it) => (b) => {
    const ref = isPublic ? doc(db, 'registrations', `${group.id}_${it.email}`) : doc(collection(db, 'registrations'));
    b.set(ref, {
      eventName: group.name,
      ...(isPublic ? { eventId: group.id } : {}),
      userName: it.name.trim(),
      userEmail: it.email,
      tipo: it.tipo,
      modalidad: it.modalidad,
      statusAsistencia: it.present ? 'Presente' : 'Ausente',
      ...(it.tipo === 'ponente' && it.customEventName ? { customEventName: it.customEventName.trim() } : {}),
      registrationDate: serverTimestamp(),
      source: 'admin',
      createdBy: me(),
    });
  });
  if (isPublic) ops.unshift((b) => b.update(doc(db, 'events', group.id), { registeredCount: increment(fresh.length) }));
  // shortcut: con >450 filas el contador se suma en el primer lote; si un lote posterior falla, "Recalcular cupo" lo corrige.
  await commitInChunks(ops);
  return { added: fresh.length, skipped: items.length - fresh.length };
}

/**
 * Los registros y certificados se agrupan por nombre de evento (también en la Cloud Function),
 * así que dos eventos con el mismo nombre se mezclarían sin vuelta atrás. Lanza si el nombre ya está en uso.
 */
async function assertNameFree(name, { ownId = null, renamingFrom = null } = {}) {
  const taken = async (coll, field, checkOwn = true) => {
    const snap = await getDocs(query(collection(db, coll), where(field, '==', name), limit(2)));
    return snap.docs.some((d) => !checkOwn || d.id !== ownId);
  };
  if (await taken('events', 'title') || await taken('adminEvents', 'name')
    || (renamingFrom !== null && await taken('registrations', 'eventName', false))) {
    throw new Error(`Ya existe un evento llamado "${name}". Usa otro nombre para no mezclar sus inscritos y certificados.`);
  }
}

/** Renombra un evento en todos sus registros y mueve su plantilla (`eventTemplates/{encodeURIComponent(nombre)}`). */
async function cascadeRename(oldName, newName) {
  const regs = await getDocs(query(collection(db, 'registrations'), where('eventName', '==', oldName)));
  await commitInChunks(regs.docs.map((d) => (b) => b.update(d.ref, { eventName: newName })));
  const oldTpl = await getDoc(doc(db, 'eventTemplates', encodeURIComponent(oldName)));
  if (oldTpl.exists()) {
    await writeBatch(db)
      .set(doc(db, 'eventTemplates', encodeURIComponent(newName)), { ...oldTpl.data(), eventName: newName, updatedAt: serverTimestamp() }, { merge: true })
      .delete(oldTpl.ref)
      .commit();
  }
  return regs.size;
}

async function uploadEventImage(file) {
  const path = `events/${Date.now()}-${file.name.replace(/\s+/g, '-')}`;
  const ref = storageRef(storage, path);
  await uploadBytes(ref, file);
  return { ref: path, downloadURL: await getDownloadURL(ref) };
}

const dateFromInput = (value) => (value ? new Date(`${value}T00:00:00`) : null);

/** Crea o edita un evento público (`events`). Devuelve el id. */
export async function savePublicEvent(existing, form, imageFile) {
  const title = form.title.trim();
  const payload = {
    title,
    date: dateFromInput(form.date),
    time: (form.time || form.timeLegacy || '').trim(),
    location: form.location.trim(),
    category: form.category,
    categoryName: form.categoryName,
    description: form.description.trim(),
    certificateDescription: (form.certificateDescription || '').trim().slice(0, 300),
    capacity: form.capacity === '' ? null : Number(form.capacity),
    tipoAsistencia: form.attendanceOptions,
    tipoAsistenciaOptions: form.attendanceOptions,
    mensajeConfirmacion: form.confirmationMessage.trim(),
    visible: form.visible,
    soldOut: form.soldOut,
    confirmationEmail: form.confirmationEmail !== false,
    // Recordatorios automáticos (Function sendEventReminders): necesitan el instante exacto de inicio.
    remindersEnabled: form.remindersEnabled === true,
    startAt: eventStart(dateFromInput(form.date), form.time || form.timeLegacy) || null,
    // Vacío = correo por defecto (functions/emailTemplates.js#registrationEmail).
    emailSubject: (form.emailSubject || '').trim().slice(0, 200),
    emailBody: (form.emailBody || '').trim().slice(0, 5000),
    formFields: cleanFields(form.formFields || []),
    requiresCode: !!form.requiresCode,
    meetLink: (form.meetLink || '').trim(),
  };
  // El código nunca va en el evento (lectura pública): solo en eventSecrets/{id}, que es solo admin.
  const code = normalizeCode(form.accessCode);
  if (payload.requiresCode && code.length < 4) throw new Error('El código de inscripción debe tener al menos 4 caracteres.');
  const withSecret = (batch, id) => (payload.requiresCode
    ? batch.set(doc(db, 'eventSecrets', id), { code, updatedAt: serverTimestamp(), updatedBy: me() })
    : batch);
  if (!existing || existing.title !== title) {
    await assertNameFree(title, { ownId: existing?.id, renamingFrom: existing?.title ?? null });
  }
  if (imageFile) {
    const image = await uploadEventImage(imageFile);
    payload.image = image;
    payload.imageUrl = image;
  }
  if (!existing) {
    const ref = doc(collection(db, 'events'));
    await withSecret(writeBatch(db).set(ref, { ...payload, registeredCount: 0, createdAt: serverTimestamp() }), ref.id).commit();
    return ref.id;
  }
  // Si cambió el inicio, los recordatorios de esta fecha vuelven a quedar pendientes.
  // shortcut: quien ya recibió el recordatorio de la fecha anterior no lo vuelve a recibir (marca por inscrito); crear un evento nuevo si hace falta reenviarlo.
  const prevStart = existing.startAt?.toMillis?.() ?? null;
  if (prevStart !== (payload.startAt?.getTime() ?? null)) Object.assign(payload, { reminderPresencialSentAt: null, reminderVirtualSentAt: null });
  const batch = writeBatch(db).update(doc(db, 'events', existing.id), { ...payload, updatedAt: serverTimestamp(), updatedBy: me() });
  if (!payload.requiresCode) batch.delete(doc(db, 'eventSecrets', existing.id));
  await withSecret(batch, existing.id).commit();
  if (existing.title && existing.title !== title) await cascadeRename(existing.title, title);
  return existing.id;
}

/** Código de inscripción del evento (solo admin). '' si no hay. */
export const getEventCode = async (id) => (await getDoc(doc(db, 'eventSecrets', id))).data()?.code || '';

/** Reemplaza las categorías personalizadas (`siteConfig/eventCategories`, lectura pública). */
export const saveCategories = (items) =>
  setDoc(doc(db, 'siteConfig', 'eventCategories'), { items, updatedAt: serverTimestamp(), updatedBy: me() });

/** Plantillas de texto del equipo: `siteConfig/eventTextTemplates` { description: [], confirmation: [] }. */
export async function loadTextTemplates() {
  const data = (await getDoc(doc(db, 'siteConfig', 'eventTextTemplates'))).data() || {};
  return { description: data.description || [], confirmation: data.confirmation || [] };
}
/** Lee-modifica-escribe la lista `kind` (los objetos no se pueden quitar con arrayRemove de forma fiable). */
export async function updateTextTemplates(kind, fn) {
  const list = fn((await loadTextTemplates())[kind]);
  await setDoc(doc(db, 'siteConfig', 'eventTextTemplates'), { [kind]: list, updatedAt: serverTimestamp(), updatedBy: me() }, { merge: true });
  return list;
}

/** Crea o edita un evento interno (`adminEvents`: solo nombre y fecha). */
export async function saveManualEvent(existing, { name, date }) {
  const clean = name.trim();
  if (!existing || existing.name !== clean) {
    await assertNameFree(clean, { ownId: existing?.id, renamingFrom: existing?.name ?? null });
  }
  if (!existing) {
    const ref = doc(collection(db, 'adminEvents'));
    await writeBatch(db).set(ref, { name: clean, date: dateFromInput(date), createdAt: serverTimestamp(), createdBy: me() }).commit();
    return ref.id;
  }
  await writeBatch(db).update(doc(db, 'adminEvents', existing.id), { name: clean, date: dateFromInput(date), updatedAt: serverTimestamp(), updatedBy: me() }).commit();
  if (existing.name !== clean) await cascadeRename(existing.name, clean);
  return existing.id;
}

export const setEventFlags = (id, flags) =>
  writeBatch(db).update(doc(db, 'events', id), { ...flags, updatedAt: serverTimestamp(), updatedBy: me() }).commit();

/** Elimina el evento, su plantilla asociada y todos sus registros (como el panel anterior). */
export async function deleteEvent(group) {
  const snaps = await Promise.all([
    getDocs(query(collection(db, 'registrations'), where('eventName', '==', group.name))),
    ...(group.kind === 'public' ? [getDocs(query(collection(db, 'registrations'), where('eventId', '==', group.id)))] : []),
  ]);
  const refs = new Map();
  snaps.forEach((s) => s.docs.forEach((d) => refs.set(d.id, d.ref)));
  await commitInChunks([...refs.values()].map((ref) => (b) => b.delete(ref)));
  await deleteDoc(doc(db, 'eventTemplates', encodeURIComponent(group.name)));
  if (group.kind !== 'legacy') await deleteDoc(doc(db, group.kind === 'public' ? 'events' : 'adminEvents', group.id));
  if (group.kind === 'public') await deleteDoc(doc(db, 'eventSecrets', group.id));
  return refs.size;
}
