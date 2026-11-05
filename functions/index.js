import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret, defineString } from 'firebase-functions/params';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { getAuth } from 'firebase-admin/auth';
import { PDFDocument } from 'pdf-lib';
import { certificateEmail, customEmail, registrationEmail, sendOnce } from './email.js';
import {
  mergeLayout, renderCertificate, resolveRole, resolveModality, templateCandidates, formatCiudadFecha, normalizeTemplateSet,
} from './certificate.js';

initializeApp();
const db = getFirestore();
const bucket = getStorage().bucket();

const isPresent = (value) => {
  if (typeof value === 'string') return value.toLowerCase() === 'presente' || value.toLowerCase() === 'present';
  return !!value;
};

// Lista blanca de admins; sincronizar con firestore.rules y VITE_ADMIN_EMAILS. Se puede sobreescribir con ADMIN_EMAILS en functions/.env.
const ADMIN_EMAILS = defineString('ADMIN_EMAILS', { default: 'contacto@borealabs.org,admin@borealabs.org,jose@borealabs.org' });
const MAX_POINTS = 1000;

const assertAdmin = (request) => {
  const token = request.auth?.token;
  if (!token) throw new HttpsError('unauthenticated', 'Debes estar autenticado');
  if (token.firebase?.sign_in_provider === 'anonymous') throw new HttpsError('permission-denied', 'Solo administradores');
  if (token.admin === true) return;
  const allowed = ADMIN_EMAILS.value().split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (!token.email || !allowed.includes(token.email.toLowerCase())) throw new HttpsError('permission-denied', 'Solo administradores');
};

export const generateCertificates = onCall({ cors: true, region: 'us-central1', timeoutSeconds: 540, memory: '512MiB' }, async (request) => {
  const { eventName, templateSet, addPoints, points, notify } = request.data || {};

  if (!eventName) throw new HttpsError('invalid-argument', 'Falta eventName');
  // Requerir admin (no basta con estar autenticado)
  assertAdmin(request);

  // Traer registros del evento
  const regsSnap = await db.collection('registrations').where('eventName', '==', eventName).get();
  const regs = regsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  // Traer certificados existentes de este evento para evitar duplicados por rol
  // Los ponentes con título propio guardan nombreEvento = customEventName: también hay que buscar esos,
  // o cada corrida les emitiría otro certificado.
  const titles = [...new Set([eventName, ...regs.map((r) => r.customEventName).filter(Boolean)])];
  const certDocs = [];
  for (let i = 0; i < titles.length; i += 30) {
    const snap = await db.collection('certificados').where('nombreEvento', 'in', titles.slice(i, i + 30)).get();
    certDocs.push(...snap.docs);
  }
  const existingByEmailRole = new Set(
    certDocs.map((d) => {
      const email = (d.get('correoUsuario') || '').toLowerCase();
      // Algunos certificados antiguos no tenían 'tipo'; inferir: si modalidad es 'ponente' o 'staff' tomarlos como tal; de lo contrario, 'participante'
      const tipo = (d.get('tipo') || '').toLowerCase() || ((d.get('modalidad') || '').toLowerCase().match(/^(ponente|staff)$/)?.[0] || 'participante');
      const nombreEvt = d.get('nombreEvento') || eventName;
      return `${email}|${tipo}|${nombreEvt}`;
    })
  );

  let created = 0;
  let skipped = 0;
  const errors = [];
  const addPointsEnabled = Boolean(addPoints);
  const pointsRaw = Number(points);
  const pointsPerCertificate = addPointsEnabled ? Math.floor(pointsRaw) : 0;
  if (addPointsEnabled && (!Number.isFinite(pointsPerCertificate) || pointsPerCertificate <= 0 || pointsPerCertificate > MAX_POINTS)) {
    throw new HttpsError('invalid-argument', 'Puntos inválidos');
  }
  const pointsByEmail = new Map();

  // Intentar obtener metadata del evento desde 'events' o 'adminEvents'
  let eventDate = null;
  let inferredTemplateSet = null;
  try {
    let eventDocSnap = null;
    let eventDocData = null;
    const withId = regs.find((r) => r.eventId);
    if (withId?.eventId) {
      // Buscar por ID de evento del primer registro con eventId
      eventDocSnap = await db.collection('events').doc(withId.eventId).get();
    }
    if (!eventDocSnap || !eventDocSnap.exists) {
      // Fallback: buscar por título == eventName
      const evQuery = await db.collection('events').where('title', '==', eventName).limit(1).get();
      if (!evQuery.empty) eventDocSnap = evQuery.docs[0];
    }
    if (eventDocSnap && eventDocSnap.exists) {
      eventDocData = eventDocSnap.data() || {};
      const ed = eventDocSnap.get('date');
      // Puede ser Timestamp, Date o string
      if (ed?.toDate) eventDate = ed.toDate();
      else if (typeof ed === 'string') eventDate = new Date(ed);
      else if (ed instanceof Date) eventDate = ed;

      const categoryRaw = eventDocData?.category;
      const categories = Array.isArray(categoryRaw)
        ? categoryRaw.map((v) => String(v || '').toLowerCase())
        : [String(categoryRaw || '').toLowerCase()];
      const categoryName = String(eventDocData?.categoryName || '').toLowerCase();
      const title = String(eventDocData?.title || eventName || '').toLowerCase();
      const isVolunteerEvent = categories.includes('voluntariado')
        || categoryName.includes('voluntariado')
        || title.includes('voluntariado');
      if (isVolunteerEvent) inferredTemplateSet = 'VOLUNTARIADO';
    }
    if (!eventDate) {
      const adminQuery = await db.collection('adminEvents').where('name', '==', eventName).limit(1).get();
      if (!adminQuery.empty) {
        const ad = adminQuery.docs[0].get('date');
        if (ad?.toDate) eventDate = ad.toDate();
        else if (typeof ad === 'string') eventDate = new Date(ad);
        else if (ad instanceof Date) eventDate = ad;

        const adminName = String(adminQuery.docs[0].get('name') || eventName || '').toLowerCase();
        if (adminName.includes('voluntariado')) inferredTemplateSet = 'VOLUNTARIADO';
      }
    }
  } catch (e) {
    console.warn('No se pudo leer fecha del evento', e?.message || e);
  }

  const templateSetSafe = normalizeTemplateSet(templateSet) || normalizeTemplateSet(inferredTemplateSet);
  const templateRoot = templateSetSafe ? `cert-templates/${templateSetSafe}` : 'cert-templates';

  for (const r of regs) {
    if (!isPresent(r.statusAsistencia)) continue; // solo presentes
    const email = (r.userEmail || '').toLowerCase();
  if (!email) { skipped++; continue; }
  // Determinar rol del registro para comparar duplicados por rol
  const roleLower = (r.tipo || '').toLowerCase() || ((r.tipoAsistencia || '').toLowerCase().match(/^(ponente|staff|participante)$/)?.[0] || 'participante');
  const tempEventTitle = (roleLower === 'ponente' && r.customEventName) ? r.customEventName : (r.eventName || eventName || '');
  if (existingByEmailRole.has(`${email}|${roleLower}|${tempEventTitle}`)) { skipped++; continue; }

    try {
      const idValidacion = (globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2,8)}`);

      // Helpers para cargar archivos opcionales de Storage
      const loadOptional = async (path) => {
        try {
          const file = bucket.file(path);
          const [exists] = await file.exists();
          if (!exists) return null;
          const [buf] = await file.download();
          return buf;
        } catch {
          return null;
        }
      };

      const loadFirst = async (paths) => {
        for (const p of paths) {
          const buf = await loadOptional(p);
          if (buf) return { buf, path: p };
        }
        return null;
      };

      const layoutPick = await loadFirst([
        `${templateRoot}/layout.json`,
        'cert-templates/layout.json',
      ]);
      const loadedLayout = layoutPick?.buf ? JSON.parse(layoutPick.buf.toString('utf8')) : null;
      const layout = mergeLayout(loadedLayout);

      // 1) Generar PDF: usar plantilla si existe, sino lienzo vacío (ver functions/certificate.js)
      const roleLower = resolveRole(r);
      const modalidadText = resolveModality(r);
      const isPonente = roleLower === 'ponente';
      const candidates = templateCandidates(roleLower, modalidadText.toLowerCase());
      const templatePick = await loadFirst([
        ...candidates.map((p) => `${templateRoot}/${p}`),
        ...candidates.map((p) => `cert-templates/${p}`),
      ]);
      if (!templatePick?.buf) {
        console.warn('[generateCertificates] No se encontró plantilla. Usando fallback A4 en blanco.', {
          templateRoot,
          templateCandidates: candidates,
          role: roleLower,
          event: eventName,
        });
      } else {
        console.info('[generateCertificates] Template usado:', templatePick.path, 'role=', roleLower, 'event=', eventName);
      }

      const fonts = {
        bold: await loadOptional('cert-templates/fonts/LibreFranklin-Bold.ttf'),
        regular: await loadOptional('cert-templates/fonts/LibreFranklin-Regular.ttf'),
        italic: await loadOptional('cert-templates/fonts/LibreFranklin-Italic.ttf'),
        boldItalic: await loadOptional('cert-templates/fonts/LibreFranklin-BoldItalic.ttf'),
      };

      const base = process.env.VALIDATION_URL_BASE || 'https://borealabs.org/validacion?id=';
      const eventTitleForThis = isPonente && r.customEventName ? r.customEventName : (r.eventName || eventName || '');
      const pdfBytes = await renderCertificate({
        templateBytes: templatePick?.buf || null,
        layout,
        fonts,
        data: {
          nombreUsuario: r.userName || '',
          nombreEvento: eventTitleForThis,
          modalidad: modalidadText,
          rol: roleLower,
          idValidacion,
          validationUrl: `${base}${encodeURIComponent(idValidacion)}`,
          ciudadFecha: formatCiudadFecha(eventDate),
        },
      });

      // 2) Subir a Storage y obtener URL pública de descarga
      const safeEvent = eventName.replace(/[^a-zA-Z0-9_-]+/g, '_');
      const path = `certificates/${safeEvent}/${idValidacion}.pdf`;
      const file = bucket.file(path);
      const token = (globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2,8)}`);
      await file.save(Buffer.from(pdfBytes), {
        contentType: 'application/pdf',
        metadata: { metadata: { firebaseStorageDownloadTokens: token } },
        public: false,
        resumable: false,
      });
      const encodedPath = encodeURIComponent(path);
      const urlPdf = `https://firebasestorage.googleapis.com/v0/b/${file.bucket.name}/o/${encodedPath}?alt=media&token=${token}`;

      // 3) Crear documento en 'certificados'
      const fechaEmisionValue = eventDate && !Number.isNaN(eventDate.getTime())
        ? eventDate
        : FieldValue.serverTimestamp();
      await db.collection('certificados').add({
        correoUsuario: email, // Usar email en minúscula para asegurar fácil búsqueda / wallet
        fechaEmision: fechaEmisionValue,
        idValidacion,
        modalidad: modalidadText || '',
        tipo: roleLower,
        nombreEvento: eventTitleForThis || eventName,
        nombreUsuario: r.userName || '',
        urlPdf,
        // El trigger onCertificateCreated solo envía correo si el admin lo pidió en el asistente.
        notify: notify === true,
      });
      
    existingByEmailRole.add(`${email}|${roleLower}|${eventTitleForThis || eventName}`);
      created++;
      if (addPointsEnabled && email) {
        pointsByEmail.set(email, (pointsByEmail.get(email) || 0) + 1);
      }
    } catch (err) {
      console.error('Error en certificado para', email, err?.message || err);
      errors.push({ email, message: err?.message || String(err) });
    }
  }

  let pointsApplied = 0;
  const pointsErrors = [];
  const pointsPending = [];
  if (addPointsEnabled && pointsByEmail.size > 0) {
    const grantedBy = request.auth?.token?.email || request.auth?.uid || 'system';
    for (const [email, count] of pointsByEmail.entries()) {
      const amount = pointsPerCertificate * count;
      try {
        // La Wallet solo lee userPoints/{uid}: resolver la cuenta por correo antes de escribir.
        let uid = null;
        try {
          uid = (await getAuth().getUserByEmail(email)).uid;
        } catch (e) {
          if (e?.code !== 'auth/user-not-found') throw e;
        }
        let userRef;
        if (uid) {
          userRef = db.collection('userPoints').doc(uid);
          await userRef.set({
            email,
            balance: FieldValue.increment(amount),
            updatedAt: FieldValue.serverTimestamp(),
            lastEvent: eventName,
          }, { merge: true });
        } else {
          // Sin cuenta Wallet todavía: se guarda como antes y se avisa al admin (pointsPending).
          const snap = await db.collection('userPoints').where('email', '==', email).limit(1).get();
          if (!snap.empty) {
            userRef = snap.docs[0].ref;
            await userRef.update({
              balance: FieldValue.increment(amount),
              updatedAt: FieldValue.serverTimestamp(),
              lastEvent: eventName,
            });
          } else {
            userRef = db.collection('userPoints').doc();
            await userRef.set({
              email,
              balance: amount,
              updatedAt: FieldValue.serverTimestamp(),
              lastEvent: eventName,
            });
          }
          pointsPending.push(email);
        }

        await userRef.collection('adminGrants').add({
          amount,
          email,
          grantedAt: FieldValue.serverTimestamp(),
          grantedBy,
          note: eventName || 'Certificado',
          type: 'certificate-award',
        });
        pointsApplied += 1;
      } catch (e) {
        console.error('Error asignando puntos', email, e?.message || e);
        pointsErrors.push({ email, message: e?.message || String(e) });
      }
    }
  }

  return { created, skipped, errors, pointsApplied, pointsErrors, pointsPending };
});

export const mergeCertificatesPdf = onCall({ cors: true, region: 'us-central1', timeoutSeconds: 540, memory: '1GiB' }, async (request) => {
  const { eventName } = request.data || {};
  if (!eventName) throw new HttpsError('invalid-argument', 'Falta eventName');
  assertAdmin(request);

  // Incluye a los ponentes con título propio (su certificado se guarda con nombreEvento = customEventName).
  const regsSnap = await db.collection('registrations').where('eventName', '==', eventName).get();
  const titles = [...new Set([eventName, ...regsSnap.docs.map((d) => d.get('customEventName')).filter(Boolean)])];
  const certDocs = [];
  for (let i = 0; i < titles.length; i += 30) {
    const snap = await db.collection('certificados').where('nombreEvento', 'in', titles.slice(i, i + 30)).get();
    certDocs.push(...snap.docs);
  }
  const certsSnap = { empty: certDocs.length === 0, docs: certDocs };
  if (certsSnap.empty) return { merged: false, reason: 'Sin certificados' };

  const safeEvent = eventName.replace(/[^a-zA-Z0-9_-]+/g, '_');
  const mergedDoc = await PDFDocument.create();

  const parseStoragePath = (url) => {
    if (!url) return null;
    const match = url.match(/\/o\/([^?]+)/i);
    if (!match?.[1]) return null;
    try { return decodeURIComponent(match[1]); } catch { return match[1]; }
  };

  let addedPages = 0;
  for (const docSnap of certsSnap.docs) {
    const urlPdf = docSnap.get('urlPdf');
    const path = parseStoragePath(urlPdf);
    if (!path) continue;
    try {
      const file = bucket.file(path);
      const [exists] = await file.exists();
      if (!exists) continue;
      const [buf] = await file.download();
      const pdf = await PDFDocument.load(buf);
      const pages = await mergedDoc.copyPages(pdf, pdf.getPageIndices());
      pages.forEach((p) => mergedDoc.addPage(p));
      addedPages += pages.length;
    } catch (e) {
      console.warn('No se pudo agregar PDF', path, e?.message || e);
    }
  }

  if (addedPages === 0) return { merged: false, reason: 'Sin páginas válidas' };

  const mergedBytes = await mergedDoc.save();
  const outPath = `certificates-merged/${safeEvent}/${Date.now()}.pdf`;
  const outFile = bucket.file(outPath);
  const token = (globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2,8)}`);
  await outFile.save(Buffer.from(mergedBytes), {
    contentType: 'application/pdf',
    metadata: { metadata: { firebaseStorageDownloadTokens: token } },
    public: false,
    resumable: false,
  });
  const encodedPath = encodeURIComponent(outPath);
  const urlPdf = `https://firebasestorage.googleapis.com/v0/b/${outFile.bucket.name}/o/${encodedPath}?alt=media&token=${token}`;

  return { merged: true, urlPdf, pages: addedPages };
});

// processVolunteerAttendanceCredits eliminado: acreditaba cualquier envío público sin aprobación.
// Los créditos los asigna un admin desde VolunteerAdminPanel (assignPendingCredits).

// ---------------- Correos automáticos (SMTP de Google Workspace, ver functions/email.js) ----------------
const SMTP_PASSWORD = defineSecret('SMTP_PASSWORD');
// maxInstances 1: respeta el límite de conexiones SMTP de Gmail al emitir muchos certificados a la vez.
const emailTrigger = (document) => ({ document, region: 'us-central1', secrets: [SMTP_PASSWORD], maxInstances: 1, retry: false });

export const onRegistrationCreated = onDocumentCreated(emailTrigger('registrations/{id}'), async (event) => {
  if (!event.data) return;
  await sendOnce(db, event.data.ref, async (reg) => {
    const eventSnap = reg.eventId ? await db.collection('events').doc(String(reg.eventId)).get() : null;
    const ev = eventSnap?.exists ? eventSnap.data() : null;
    // Solo inscripciones públicas a eventos con el correo activado (por defecto sí).
    if (!ev || ev.confirmationEmail === false) return null;
    return registrationEmail(reg, ev);
  }, { password: SMTP_PASSWORD.value() });
});

export const onCertificateCreated = onDocumentCreated(emailTrigger('certificados/{id}'), async (event) => {
  if (!event.data) return;
  const base = process.env.VALIDATION_URL_BASE || 'https://borealabs.org/validacion?id=';
  await sendOnce(db, event.data.ref, async (cert) => (cert.notify === true ? certificateEmail(cert, base) : null), { password: SMTP_PASSWORD.value() });
});

// "Confirmar cupo" desde el panel: marca seatConfirmed y envía el correo redactado por el admin.
// Estado de envío en `seatEmail` (independiente del correo de inscripción en `email`).
export const sendSeatConfirmations = onCall({ cors: true, region: 'us-central1', secrets: [SMTP_PASSWORD], timeoutSeconds: 300 }, async (request) => {
  assertAdmin(request);
  // markSeat=false: correo personalizado a los seleccionados, sin marcar el cupo y sin límite de "una vez".
  const { eventId, regIds, subject, body, resend = false, markSeat = true } = request.data || {};
  if (typeof eventId !== 'string' || !eventId) throw new HttpsError('invalid-argument', 'Falta eventId');
  if (!Array.isArray(regIds) || !regIds.length || regIds.length > 500 || !regIds.every((id) => typeof id === 'string' && id)) {
    throw new HttpsError('invalid-argument', 'regIds debe tener entre 1 y 500 ids');
  }
  if (typeof subject !== 'string' || !subject.trim() || subject.length > 200) throw new HttpsError('invalid-argument', 'Asunto inválido (máx. 200)');
  if (typeof body !== 'string' || !body.trim() || body.length > 5000) throw new HttpsError('invalid-argument', 'Cuerpo inválido (máx. 5000)');
  const eventSnap = await db.collection('events').doc(eventId).get();
  if (!eventSnap.exists) throw new HttpsError('not-found', 'Evento no encontrado');
  const ev = eventSnap.data();
  const by = request.auth.token.email || request.auth.uid;

  let confirmed = 0, sent = 0, skipped = 0;
  const errors = [];
  for (const id of [...new Set(regIds)]) { // secuencial: respeta el límite SMTP de Gmail
    try {
      const ref = db.collection('registrations').doc(id);
      const snap = await ref.get();
      if (!snap.exists || String(snap.get('eventId') || '') !== eventId) { errors.push({ id, message: 'No pertenece a este evento' }); continue; }
      if (markSeat !== false) {
        await ref.update({ seatConfirmed: true, seatConfirmedAt: FieldValue.serverTimestamp(), seatConfirmedBy: by });
        confirmed++;
      }
      const field = markSeat !== false ? 'seatEmail' : 'customEmail';
      const result = await sendOnce(db, ref, async (reg) => customEmail({ subject, body }, reg, ev), { password: SMTP_PASSWORD.value(), field, resend: markSeat === false || resend === true });
      if (result === 'sent') sent++;
      else if (result === 'skipped') skipped++;
      else errors.push({ id, message: (await ref.get()).get(`${field}.error`) || 'Falló el envío' });
    } catch (err) {
      errors.push({ id, message: err?.message || String(err) });
    }
  }
  return { confirmed, sent, skipped, errors };
});
