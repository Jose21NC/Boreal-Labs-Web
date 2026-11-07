// Hora de los eventos (guardados como fecha + hora en texto, en hora de Nicaragua) y su conversión
// a la zona horaria de quien se inscribe. Puro: lo usan la web (src/lib/calendar.js) y los correos.
export const NI_TZ = 'America/Managua';
const NI_OFFSET_MIN = -6 * 60; // Nicaragua no usa horario de verano

/** "2:00 PM", "9:00AM", "14:30", "9 am" → { h, m } en 24 h, o null. */
export function parseTime(text) {
  const m = String(text || '').trim().match(/^(\d{1,2})(?::(\d{2}))?\s*([ap])?\.?\s*m?\.?$/i);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] || 0);
  const ap = m[3]?.toLowerCase();
  if (ap === 'p' && h < 12) h += 12;
  if (ap === 'a' && h === 12) h = 0;
  return h < 24 && min < 60 ? { h, m: min } : null;
}

/** Texto de hora → "HH:mm" para <input type="time">; '' si no se reconoce. */
export const toTimeInput = (text) => {
  const t = parseTime(text);
  return t ? `${String(t.h).padStart(2, '0')}:${String(t.m).padStart(2, '0')}` : '';
};

/** "14:00" o "2:00 PM" → "2:00 p. m." para mostrar; si no se reconoce, el texto tal cual. */
export const formatEventTime = (text) => {
  const t = parseTime(text);
  if (!t) return String(text || '');
  const h12 = t.h % 12 || 12;
  return `${h12}:${String(t.m).padStart(2, '0')} ${t.h < 12 ? 'a. m.' : 'p. m.'}`;
};

const toDate = (v) => (v?.toDate ? v.toDate() : v ? new Date(v) : null);

/** Día del evento en Nicaragua → { y, mo, d } (la fecha suele guardarse como medianoche local). */
export function eventDay(date) {
  const day = toDate(date);
  if (!day || Number.isNaN(day.getTime())) return null;
  const local = new Date(day.getTime() + NI_OFFSET_MIN * 60000);
  return { y: local.getUTCFullYear(), mo: local.getUTCMonth(), d: local.getUTCDate() };
}

/** Instante de inicio (Date en UTC) o null si falta fecha u hora. */
export function eventStart(date, time) {
  const day = eventDay(date);
  const t = parseTime(time);
  if (!day || !t) return null;
  return new Date(Date.UTC(day.y, day.mo, day.d, t.h, t.m) - NI_OFFSET_MIN * 60000);
}

const validTz = (tz) => {
  try { new Intl.DateTimeFormat('es', { timeZone: tz }); return true; } catch { return false; }
};

const fmt = (date, tz, withDay) => new Intl.DateTimeFormat('es-NI', {
  timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true, ...(withDay ? { weekday: 'short', day: 'numeric', month: 'short' } : {}),
}).format(date);

/** "America/Mexico_City" → "Mexico City". */
export const tzCity = (tz) => String(tz || '').split('/').pop().replace(/_/g, ' ');

/**
 * Hora del evento para alguien en `tz`. Si su hora difiere de la de Nicaragua devuelve ambas:
 * "2:00 p. m. (hora de Nicaragua) · 3:00 p. m. (tu hora, Mexico City)". Si el día cambia, lo incluye.
 */
export function dualTime(start, tz) {
  if (!start) return null;
  const ni = fmt(start, NI_TZ);
  if (!tz || tz === NI_TZ || !validTz(tz)) return { text: ni, differs: false, ni };
  const local = fmt(start, tz);
  const sameDay = fmt(start, NI_TZ, true).split(',')[0] === fmt(start, tz, true).split(',')[0];
  if (local === ni && sameDay) return { text: ni, differs: false, ni };
  const localShown = sameDay ? local : fmt(start, tz, true);
  return { text: `${ni} (hora de Nicaragua) · ${localShown} (tu hora, ${tzCity(tz)})`, differs: true, ni, local: localShown };
}
