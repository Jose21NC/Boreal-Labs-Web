// "Agregar al calendario": enlace de Google Calendar y archivo .ics (Apple/Outlook) para un evento.
// Hora de Nicaragua (UTC-6, sin horario de verano): los eventos guardan fecha + hora en texto ("2:00 PM").
const NI_OFFSET_MIN = -6 * 60;
const DEFAULT_HOURS = 2; // shortcut: duración fija; agregar un campo de hora de fin al evento si hace falta precisión

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

const toDate = (v) => (v?.toDate ? v.toDate() : v ? new Date(v) : null);

/** Primer enlace de Google Meet dentro de un texto (p. ej. el mensaje de confirmación). */
export const findMeetLink = (text) => String(text || '').match(/https:\/\/meet\.google\.com\/[a-z0-9-]+/i)?.[0] || null;

/**
 * @returns {{ title, start: Date, end: Date, allDay: boolean, location, details } | null}
 * `date` es la fecha del evento (Timestamp/Date), `time` su hora en texto. Sin fecha → null.
 */
export function calendarEvent({ title, date, time, location, details, meetLink, virtual }) {
  const day = toDate(date);
  if (!day || Number.isNaN(day.getTime())) return null;
  // Día calendario del evento en Nicaragua (la fecha suele guardarse como medianoche local).
  const local = new Date(day.getTime() + NI_OFFSET_MIN * 60000);
  const [y, mo, d] = [local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()];
  const t = parseTime(time);
  const start = t ? new Date(Date.UTC(y, mo, d, t.h, t.m) - NI_OFFSET_MIN * 60000) : new Date(Date.UTC(y, mo, d));
  const end = t ? new Date(start.getTime() + DEFAULT_HOURS * 3600000) : new Date(Date.UTC(y, mo, d + 1));
  const meet = meetLink || null;
  return {
    title: title || 'Evento Boreal Labs',
    start,
    end,
    allDay: !t,
    location: virtual && meet ? meet : location || meet || '',
    details: [details, meet ? `Google Meet: ${meet}` : '', 'Organiza: Boreal Labs · borealabs.org'].filter(Boolean).join('\n\n'),
  };
}

const stamp = (date, allDay) => (allDay
  ? date.toISOString().slice(0, 10).replace(/-/g, '')
  : date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''));

export function googleCalendarUrl(ev) {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: ev.title,
    dates: `${stamp(ev.start, ev.allDay)}/${stamp(ev.end, ev.allDay)}`,
    details: ev.details,
    location: ev.location,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

const icsText = (v) => String(v || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (c) => `\\${c}`);

/** Contenido .ics (RFC 5545) con un recordatorio 1 hora antes. */
export function icsContent(ev, uid = `${stamp(ev.start, false)}-${Math.random().toString(36).slice(2)}@borealabs.org`) {
  const dt = (k, d) => (ev.allDay ? `${k};VALUE=DATE:${stamp(d, true)}` : `${k}:${stamp(d, false)}`);
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Boreal Labs//Eventos//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT', `UID:${uid}`, `DTSTAMP:${stamp(new Date(), false)}`, dt('DTSTART', ev.start), dt('DTEND', ev.end),
    `SUMMARY:${icsText(ev.title)}`, `DESCRIPTION:${icsText(ev.details)}`, `LOCATION:${icsText(ev.location)}`,
    'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Recordatorio', 'TRIGGER:-PT1H', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
}

export function downloadIcs(ev) {
  const url = URL.createObjectURL(new Blob([icsContent(ev)], { type: 'text/calendar;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${ev.title.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'evento'}.ics`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
