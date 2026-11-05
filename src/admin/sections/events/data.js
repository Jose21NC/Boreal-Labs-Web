// Modelo de datos de Eventos: normalización de registros heredados y agrupación por evento.
import { isPresent, normalize, toDate } from '@/admin/lib';

export const ROLES = [
  { value: 'participante', label: 'Participante' },
  { value: 'ponente', label: 'Ponente' },
  { value: 'staff', label: 'Staff' },
];
export const MODALIDADES = [
  { value: 'presencial', label: 'Presencial' },
  { value: 'virtual', label: 'Virtual' },
];
// Categorías integradas (compartidas con /eventos); las personalizadas vienen de siteConfig/eventCategories.
export { BUILTIN_CATEGORIES as CATEGORIES } from '@/lib/eventForms';
export const ATTENDANCE_OPTIONS = ['Presencial', 'Virtual'];

export const labelOf = (list, value) => list.find((x) => x.value === value)?.label || value;

// Datos viejos: el rol vivía en `tipoAsistencia` y los registros públicos guardan ahí la modalidad.
export const roleOf = (r) => {
  const v = String(r.tipo || r.tipoAsistencia || '').toLowerCase();
  return v === 'ponente' || v === 'staff' ? v : 'participante';
};
export const modalidadOf = (r) => {
  const v = String(r.modalidad || r.tipoAsistencia || '').toLowerCase();
  return v.includes('virtual') ? 'virtual' : 'presencial';
};

/** Conserva el tipo original (string "Presente"/"Ausente" o booleano) como hacía el panel anterior. */
export const attendanceValue = (current, present) => (typeof current === 'string' ? (present ? 'Presente' : 'Ausente') : present);

export const categoryOf = (ev) => {
  const c = Array.isArray(ev.category) ? ev.category[0] : ev.category;
  return c || ev.categoryName || '';
};

/** URL de imagen sin pedir a Storage: `image`/`imageUrl` pueden ser string, objeto o arreglo. */
export const imageOf = (ev) => {
  const pick = (v) => (typeof v === 'string' ? v : Array.isArray(v) ? pick(v[0]) : v?.downloadURL || null);
  return pick(ev.image) || pick(ev.imageUrl);
};

/** id de ruta: los públicos usan su id de `events`, los internos `manual:<id>` y los huérfanos `nombre:<eventName>`. */
export const routeKey = (kind, idOrName) => (kind === 'public' ? idOrName : `${kind === 'manual' ? 'manual' : 'nombre'}:${idOrName}`);

/**
 * Agrupa registros por evento. Un registro pertenece a un evento público por `eventId` o, si es antiguo,
 * por `eventName` == título. Los nombres sin evento (legado) se listan aparte para no perder datos.
 */
export function groupEvents(events, manual, regs) {
  const groups = new Map();
  const byName = new Map();
  events.forEach((ev) => {
    const g = { key: routeKey('public', ev.id), kind: 'public', id: ev.id, name: ev.title || '(sin título)', date: toDate(ev.date), doc: ev, regs: [] };
    groups.set(g.key, g);
    if (ev.title && !byName.has(ev.title)) byName.set(ev.title, g);
  });
  manual.forEach((m) => {
    const name = (m.name || '').trim();
    if (!name) return;
    if (byName.has(name)) return; // ya existe como evento público con ese nombre
    const g = { key: routeKey('manual', m.id), kind: 'manual', id: m.id, name, date: toDate(m.date), doc: m, regs: [] };
    groups.set(g.key, g);
    byName.set(name, g);
  });
  regs.forEach((r) => {
    let g = (r.eventId && groups.get(r.eventId)) || byName.get(r.eventName || 'Sin evento');
    if (!g) {
      const name = r.eventName || 'Sin evento';
      g = { key: routeKey('legacy', name), kind: 'legacy', id: null, name, date: null, doc: null, regs: [] };
      groups.set(g.key, g);
      byName.set(name, g);
    }
    g.regs.push(r);
  });
  return [...groups.values()].map((g) => {
    const present = g.regs.filter((r) => isPresent(r.statusAsistencia)).length;
    const cap = g.doc?.capacity;
    const capacity = cap == null || cap === '' || !Number.isFinite(Number(cap)) ? null : Number(cap);
    const counted = g.kind === 'public' ? Number(g.doc.registeredCount) || 0 : g.regs.length;
    // Registros que el contador debería reflejar: los que llevan este eventId.
    const withId = g.kind === 'public' ? g.regs.filter((r) => r.eventId === g.id).length : g.regs.length;
    return { ...g, total: g.regs.length, present, capacity, counted, outOfSync: g.kind === 'public' && counted !== withId, status: statusOf(g, capacity, counted) };
  });
}

export const STATUS = {
  upcoming: { label: 'Próximo', tone: 'success' },
  past: { label: 'Pasado', tone: 'neutral' },
  hidden: { label: 'Oculto', tone: 'warning' },
  soldout: { label: 'Agotado', tone: 'danger' },
  nodate: { label: 'Sin fecha', tone: 'neutral' },
};

function statusOf(g, capacity, counted) {
  const d = g.date;
  const past = d ? new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59) < new Date() : false;
  if (g.doc?.visible === false) return 'hidden';
  if (past) return 'past';
  if (g.doc?.soldOut === true || g.doc?.isFull === true || g.doc?.cupoLleno === true || (capacity != null && counted >= capacity)) return 'soldout';
  return d ? 'upcoming' : 'nodate';
}

export const matchesSearch = (r, q) => {
  if (!q) return true;
  return [r.userName, r.userEmail, r.userCountry, r.country, r.userUniversity, r.university, r.cargo, r.userCargo,
    r.userWhatsapp, r.whatsapp, r.userDepartment, r.department, r.motivo, r.whyAttend, r.edad, r.userAge]
    .some((v) => normalize(v).includes(q));
};

export const toDateInput = (value) => {
  const d = toDate(value);
  if (!d) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
