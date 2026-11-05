// Lógica pura de voluntariado (sin imports para poder probarla con node).

const norm = (value) => String(value ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export const DAYS = [
  { key: 'lunes', label: 'Lunes', short: 'Lun' },
  { key: 'martes', label: 'Martes', short: 'Mar' },
  { key: 'miercoles', label: 'Miércoles', short: 'Mié' },
  { key: 'jueves', label: 'Jueves', short: 'Jue' },
  { key: 'viernes', label: 'Viernes', short: 'Vie' },
  { key: 'sabado', label: 'Sábado', short: 'Sáb' },
  { key: 'domingo', label: 'Domingo', short: 'Dom' },
];

export const PERIODS = [
  { key: 'manana', label: 'Mañana', hint: '8am–12pm' },
  { key: 'tarde', label: 'Tarde', hint: '1pm–5pm' },
  { key: 'personalizado', label: 'Personalizado', hint: 'Horario propio' },
];

const dayOf = (text) => DAYS.find((d) => norm(text).includes(d.key))?.key || null;
const periodOf = (text) => PERIODS.find((p) => norm(text).includes(p.key))?.key || null;

/**
 * Disponibilidad como matriz { lunes: { manana: bool, tarde: bool, personalizado: bool }, ... }.
 * Acepta `turnos` ('Lunes-Mañana') y `horariosPersonalizados` (objeto por día o lista legada).
 */
export function availabilityOf(volunteer) {
  const map = Object.fromEntries(DAYS.map((d) => [d.key, { manana: false, tarde: false, personalizado: false }]));
  (Array.isArray(volunteer?.turnos) ? volunteer.turnos : []).forEach((slot) => {
    const day = dayOf(slot);
    const period = periodOf(slot);
    if (day && period) map[day][period] = true;
  });
  const custom = volunteer?.horariosPersonalizados;
  const customDays = Array.isArray(custom) ? custom : custom && typeof custom === 'object' ? Object.keys(custom) : [];
  customDays.forEach((label) => { const day = dayOf(label); if (day) map[day].personalizado = true; });
  return map;
}

/** Textos de horarios personalizados, p. ej. "Lunes: 14:00 - 18:00". */
export function customSlotsOf(volunteer) {
  const custom = volunteer?.horariosPersonalizados;
  if (Array.isArray(custom)) return custom.filter(Boolean).map(String);
  if (!custom || typeof custom !== 'object') return [];
  return Object.entries(custom).map(([day, r]) => `${day}: ${r?.start || '--'} - ${r?.end || '--'}`);
}

/** Turno canónico que guarda el formulario público. */
export const shiftKey = (dayLabel, periodLabel) => `${dayLabel}-${periodLabel}`;

/**
 * Créditos de un registro de horas (1 crédito = 2 horas). Compatibilidad con registros viejos que
 * guardaban pendingCredits en horas (fórmula "1h = 1 credito"): mismo criterio que el panel anterior.
 */
export function logCredits(log) {
  const explicit = Number(log?.pendingCredits);
  const hours = Number(log?.registeredHours);
  const formula = norm(log?.creditsFormula);
  const hasExplicit = log?.pendingCredits != null && log?.pendingCredits !== '' && Number.isFinite(explicit);
  if (hasExplicit) {
    const legacy = formula.includes('1h = 1 credito') || formula.includes('1h=1credito');
    const looksLikeHours = Number.isFinite(hours) && Math.abs(explicit - hours) < 0.02;
    return round2(Math.max(0, legacy || looksLikeHours ? explicit / 2 : explicit));
  }
  return Number.isFinite(hours) && log?.registeredHours != null ? round2(Math.max(0, hours / 2)) : 0;
}

export const round2 = (n) => Number((Number(n) || 0).toFixed(2));

/** 'pending' | 'approved' | 'rejected' */
export function logStatus(log) {
  if (log?.creditsProcessed) return 'approved';
  if (log?.creditStatus === 'rejected') return 'rejected';
  return 'pending';
}

export const isEventLog = (log) => norm(log?.creditSourceType) === 'evento' || !!log?.creditsGeneratedFromEvent;
export const isAdjustmentLog = (log) => norm(log?.creditSourceType) === 'ajuste';

/** "3 h 30 min" a partir de créditos (1 crédito = 2 h). */
export function creditsAsDuration(credits) {
  const minutes = Math.round(Math.max(0, Number(credits) || 0) * 120);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** Horas entre "HH:MM" y "HH:MM" (0 si inválido o negativo). */
export function hoursBetween(start, end) {
  const toMin = (t) => {
    const [h, m] = String(t || '').split(':').map(Number);
    return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : NaN;
  };
  const diff = toMin(end) - toMin(start);
  return Number.isFinite(diff) && diff > 0 ? round2(diff / 60) : 0;
}

export const emailKey = (value) => String(value || '').trim().toLowerCase();

/**
 * Índice email → voluntario. Los docs nuevos usan el correo como id; los viejos tienen id aleatorio,
 * así que se indexa por el campo `email` y, como respaldo, por el id si parece correo.
 */
export function indexByEmail(volunteers) {
  const map = new Map();
  volunteers.forEach((v) => {
    if (v.id?.includes('@')) map.set(emailKey(v.id), v);
  });
  volunteers.forEach((v) => {
    if (v.email) map.set(emailKey(v.email), v);
  });
  return map;
}
