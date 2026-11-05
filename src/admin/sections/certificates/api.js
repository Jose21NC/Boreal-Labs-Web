// Datos y llamadas de la sección Certificados.
import { collection, doc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { auth, db } from '@/firebase';
import { isPresent, toDate } from '@/admin/lib';
import { resolveRole } from '../../../../functions/roles.js';
import { peopleByEmail } from '../points/wallet';

/** Mensaje legible para errores de httpsCallable (portado de AdminPanel). */
export function getCallableErrorMessage(error) {
  const code = String(error?.code || '');
  const detailsMessage = typeof error?.details === 'string' ? error.details : error?.details?.message;
  if (code.includes('unauthenticated')) return 'Tu sesión de admin expiró. Cierra sesión y vuelve a ingresar.';
  if (code.includes('failed-precondition')) return detailsMessage || error?.message || 'Falta configurar la plantilla PDF en Storage.';
  if (code.includes('not-found')) return 'La Cloud Function no está desplegada o no existe en us-central1.';
  return detailsMessage || error?.message || 'Inténtalo nuevamente.';
}

/** Llama a una Cloud Function de us-central1 con la sesión fresca. */
export async function callFunction(name, data) {
  if (!auth?.currentUser) throw Object.assign(new Error('Inicia sesión de nuevo para continuar.'), { code: 'unauthenticated' });
  await auth.currentUser.getIdToken();
  // Mismo límite que la Function (540 s): eventos grandes tardan más que el timeout por defecto (70 s).
  const res = await httpsCallable(getFunctions(undefined, 'us-central1'), name, { timeout: 540_000 })(data);
  return res.data || {};
}

/** Recuerda la carpeta de plantillas de un evento (doc id = encodeURIComponent(eventName)). */
export const saveTemplateForEvent = (eventName, templateSet) => setDoc(
  doc(db, 'eventTemplates', encodeURIComponent(eventName)),
  { eventName, templateSet, updatedAt: serverTimestamp() },
  { merge: true },
);

const docs = async (name) => {
  try {
    return (await getDocs(collection(db, name))).docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.warn(`[certificados] No se pudo leer ${name}`, error);
    return [];
  }
};

export const loadCertificates = () => docs('certificados');

/** Saldos de la Wallet por correo (una lectura de userPoints, unida en memoria). */
export const loadPointsByEmail = async () => peopleByEmail(await docs('userPoints'));

/** Todo lo que necesita el asistente de generación. */
export async function loadWizardData() {
  const [registrations, events, adminEvents, templates, certificados, userPoints] = await Promise.all(
    ['registrations', 'events', 'adminEvents', 'eventTemplates', 'certificados', 'userPoints'].map(docs),
  );
  const byEvent = {};
  templates.forEach((t) => { if (t.eventName && t.templateSet) byEvent[t.eventName] = t.templateSet; });

  // Eventos: los de la web, los internos (adminEvents) y cualquier eventName que aparezca en inscripciones.
  const map = new Map();
  const add = (name, date) => {
    if (!name) return;
    const prev = map.get(name) || { name, date: null, regs: [] };
    map.set(name, { ...prev, date: prev.date || toDate(date) });
  };
  events.forEach((e) => add(e.title, e.date));
  adminEvents.forEach((e) => add(e.name, e.date || e.createdAt));
  registrations.forEach((r) => { add(r.eventName); map.get(r.eventName)?.regs.push(r); });
  const eventList = [...map.values()].map((e) => ({ ...e, present: e.regs.filter((r) => isPresent(r.statusAsistencia)).length }))
    .sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0) || a.name.localeCompare(b.name));
  return { events: eventList, byEvent, certificados, points: peopleByEmail(userPoints) };
}

/**
 * Quiénes recibirían certificado, con el MISMO criterio de functions/index.js:
 * solo presentes, con correo, sin certificado previo por correo|rol|título.
 */
export function eligibility(event, certificados) {
  const titles = new Set([event.name, ...event.regs.map((r) => r.customEventName).filter(Boolean)]);
  const existing = new Set(certificados.filter((c) => titles.has(c.nombreEvento)).map((c) => {
    const tipo = (c.tipo || '').toLowerCase() || ((c.modalidad || '').toLowerCase().match(/^(ponente|staff)$/)?.[0] || 'participante');
    return `${(c.correoUsuario || '').toLowerCase()}|${tipo}|${c.nombreEvento || event.name}`;
  }));
  const out = { total: event.regs.length, present: 0, issued: 0, noEmail: 0, eligible: [], byRole: {} };
  event.regs.forEach((r) => {
    if (!isPresent(r.statusAsistencia)) return;
    out.present += 1;
    const email = (r.userEmail || '').toLowerCase();
    if (!email) { out.noEmail += 1; return; }
    const rol = resolveRole(r);
    const title = rol === 'ponente' && r.customEventName ? r.customEventName : (r.eventName || event.name);
    if (existing.has(`${email}|${rol}|${title}`)) { out.issued += 1; return; }
    out.eligible.push({ ...r, rol, title });
    out.byRole[rol] = (out.byRole[rol] || 0) + 1;
  });
  return out;
}
