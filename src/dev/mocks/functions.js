// Modo de prueba: Cloud Functions simuladas sobre la base y el Storage en memoria. Generan PDFs REALES
// con el mismo motor que producción (functions/certificate.js) para probar el flujo de punta a punta.
import {
  collection, getDocs, query, where, limit, addDoc, updateDoc, setDoc, doc, increment, serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { PDFDocument } from 'pdf-lib';
import { isPresent } from '@/admin/lib';
import { isWalletUid } from '@/admin/sections/points/wallet';
import { loadFonts, loadLayout, loadTemplate, validationUrlFor } from '@/admin/sections/templates/engine';
import {
  renderCertificate, resolveRole, resolveModality, formatCiudadFecha, normalizeTemplateSet,
} from '../../../functions/certificate.js';

export const getFunctions = () => ({ type: 'functions' });

const toJsDate = (v) => (v?.toDate ? v.toDate() : v ? new Date(v) : null);

async function eventMeta(eventName) {
  const ev = await getDocs(query(collection({}, 'events'), where('title', '==', eventName), limit(1)));
  if (!ev.empty) {
    const d = ev.docs[0].data();
    const cats = [].concat(d.category || []).map((c) => String(c).toLowerCase());
    const volunteer = cats.includes('voluntariado') || String(d.categoryName || '').toLowerCase().includes('voluntariado')
      || eventName.toLowerCase().includes('voluntariado');
    return { date: toJsDate(d.date), inferred: volunteer ? 'VOLUNTARIADO' : null };
  }
  const adm = await getDocs(query(collection({}, 'adminEvents'), where('name', '==', eventName), limit(1)));
  const a = adm.docs[0]?.data();
  return { date: toJsDate(a?.date), inferred: eventName.toLowerCase().includes('voluntariado') ? 'VOLUNTARIADO' : null };
}

const handlers = {
  // Misma lógica que functions/index.js#generateCertificates (duplicados por correo|rol|evento, solo presentes).
  async generateCertificates({ eventName, templateSet, addPoints, points }) {
    if (!eventName) throw Object.assign(new Error('Falta eventName'), { code: 'functions/invalid-argument' });
    const perCert = addPoints ? Math.floor(Number(points)) : 0;
    if (addPoints && (!Number.isFinite(perCert) || perCert <= 0 || perCert > 1000)) {
      throw Object.assign(new Error('Puntos inválidos'), { code: 'functions/invalid-argument' });
    }
    const regs = await getDocs(query(collection({}, 'registrations'), where('eventName', '==', eventName)));
    const titles = [...new Set([eventName, ...regs.docs.map((d) => d.get('customEventName')).filter(Boolean)])];
    const existing = await getDocs(query(collection({}, 'certificados'), where('nombreEvento', 'in', titles)));
    const done = new Set(existing.docs.map((d) => {
      const tipo = (d.get('tipo') || '').toLowerCase() || ((d.get('modalidad') || '').toLowerCase().match(/^(ponente|staff)$/)?.[0] || 'participante');
      return `${(d.get('correoUsuario') || '').toLowerCase()}|${tipo}|${d.get('nombreEvento') || eventName}`;
    }));
    const meta = await eventMeta(eventName);
    const set = normalizeTemplateSet(templateSet) || normalizeTemplateSet(meta.inferred) || '';
    const [{ layout }, fonts] = await Promise.all([loadLayout(set), loadFonts()]);

    let created = 0;
    let skipped = 0;
    const errors = [];
    const pointsByEmail = new Map();
    for (const snap of regs.docs) {
      const r = snap.data();
      if (!isPresent(r.statusAsistencia)) continue;
      const email = (r.userEmail || '').toLowerCase();
      if (!email) { skipped += 1; continue; }
      const rol = resolveRole(r);
      const title = rol === 'ponente' && r.customEventName ? r.customEventName : (r.eventName || eventName);
      if (done.has(`${email}|${rol}|${title}`)) { skipped += 1; continue; }
      try {
        const idValidacion = crypto.randomUUID();
        const modalidad = resolveModality(r);
        const template = await loadTemplate(set, rol, modalidad);
        const bytes = await renderCertificate({
          templateBytes: template?.buf || null,
          layout,
          fonts,
          data: { nombreUsuario: r.userName || '', nombreEvento: title, modalidad, rol, idValidacion, validationUrl: validationUrlFor(idValidacion), ciudadFecha: formatCiudadFecha(meta.date) },
        });
        const fileRef = ref(null, `certificates/${eventName.replace(/[^a-zA-Z0-9_-]+/g, '_')}/${idValidacion}.pdf`);
        await uploadBytes(fileRef, bytes, { contentType: 'application/pdf' });
        await addDoc(collection({}, 'certificados'), {
          correoUsuario: email,
          fechaEmision: meta.date || serverTimestamp(),
          idValidacion,
          modalidad: modalidad || '',
          tipo: rol,
          nombreEvento: title || eventName,
          nombreUsuario: r.userName || '',
          urlPdf: await getDownloadURL(fileRef),
        });
        done.add(`${email}|${rol}|${title}`);
        created += 1;
        if (addPoints) pointsByEmail.set(email, (pointsByEmail.get(email) || 0) + 1);
      } catch (error) {
        errors.push({ email, message: error?.message || String(error) });
      }
    }

    let pointsApplied = 0;
    const pointsErrors = [];
    const pointsPending = [];
    for (const [email, count] of pointsByEmail) {
      try {
        const amount = perCert * count;
        // Igual que producción: con cuenta Wallet se escribe en userPoints/{uid}. Aquí "tiene cuenta" =
        // existe un doc de la semilla con id de forma uid (no hay Auth real que consultar).
        const all = await getDocs(query(collection({}, 'userPoints'), where('email', '==', email)));
        const account = all.docs.find((d) => isWalletUid(d.id));
        let userRef;
        if (account) {
          userRef = account.ref;
          await setDoc(userRef, { email, balance: increment(amount), updatedAt: serverTimestamp(), lastEvent: eventName }, { merge: true });
        } else {
          userRef = all.empty ? doc(collection({}, 'userPoints')) : all.docs[0].ref;
          if (all.empty) await setDoc(userRef, { email, balance: amount, updatedAt: serverTimestamp(), lastEvent: eventName });
          else await updateDoc(userRef, { balance: increment(amount), updatedAt: serverTimestamp(), lastEvent: eventName });
          pointsPending.push(email);
        }
        await addDoc(collection(userRef, 'adminGrants'), {
          amount, email, grantedAt: serverTimestamp(), grantedBy: 'demo@borealabs.org', note: eventName, type: 'certificate-award',
        });
        pointsApplied += 1;
      } catch (error) {
        pointsErrors.push({ email, message: error?.message || String(error) });
      }
    }
    return { created, skipped, errors, pointsApplied, pointsErrors, pointsPending };
  },

  // Igual que functions/index.js#sendSeatConfirmations pero SIN enviar correo: solo marca el registro.
  async sendSeatConfirmations({ eventId, regIds, subject, body, resend, markSeat = true }) {
    if (!eventId || !Array.isArray(regIds) || !regIds.length || regIds.length > 500 || !subject?.trim() || !body?.trim() || subject.length > 200 || body.length > 5000) {
      throw Object.assign(new Error('Datos inválidos'), { code: 'functions/invalid-argument' });
    }
    const regs = await getDocs(query(collection({}, 'registrations'), where('eventId', '==', eventId)));
    const byId = new Map(regs.docs.map((d) => [d.id, d]));
    let confirmed = 0; let sent = 0; let skipped = 0;
    const errors = [];
    for (const id of new Set(regIds)) {
      const snap = byId.get(id);
      if (!snap) { errors.push({ id, message: 'No pertenece a este evento' }); continue; }
      const field = markSeat !== false ? 'seatEmail' : 'customEmail';
      const already = markSeat !== false && snap.get('seatEmail')?.status && !resend;
      const valid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(snap.get('userEmail') || '');
      await updateDoc(snap.ref, {
        ...(markSeat !== false ? { seatConfirmed: true, seatConfirmedAt: serverTimestamp(), seatConfirmedBy: 'demo@borealabs.org' } : {}),
        ...(already ? {} : { [field]: { status: valid ? 'sent' : 'skipped', at: new Date() } }),
      });
      if (markSeat !== false) confirmed += 1;
      if (already || !valid) skipped += 1; else sent += 1;
    }
    return { confirmed, sent, skipped, errors };
  },

  async mergeCertificatesPdf({ eventName }) {
    const certs = await getDocs(query(collection({}, 'certificados'), where('nombreEvento', '==', eventName)));
    if (certs.empty) return { merged: false, reason: 'Sin certificados' };
    const merged = await PDFDocument.create();
    let pages = 0;
    for (const d of certs.docs) {
      const url = d.get('urlPdf');
      if (!url) continue;
      try {
        const pdf = await PDFDocument.load(await (await fetch(url)).arrayBuffer());
        (await merged.copyPages(pdf, pdf.getPageIndices())).forEach((p) => { merged.addPage(p); pages += 1; });
      } catch {
        // blob: URL de una sesión anterior (el Storage de prueba no sobrevive a recargas)
      }
    }
    if (!pages) return { merged: false, reason: 'Sin páginas válidas (en modo prueba los PDF se pierden al recargar).' };
    const outRef = ref(null, `certificates-merged/${eventName.replace(/[^a-zA-Z0-9_-]+/g, '_')}/${Date.now()}.pdf`);
    await uploadBytes(outRef, await merged.save(), { contentType: 'application/pdf' });
    return { merged: true, urlPdf: await getDownloadURL(outRef), pages };
  },
};

export const httpsCallable = (_functions, name) => async (data) => {
  const handler = handlers[name];
  if (!handler) {
    const err = new Error(`[demo] Function no simulada: ${name}`);
    err.code = 'functions/not-found';
    throw err;
  }
  await new Promise((r) => setTimeout(r, 400));
  return { data: await handler(data || {}) };
};
