// "Agregar al calendario": enlace de Google Calendar y archivo .ics (Apple/Outlook) para un evento.
import { dualTime, eventDay, eventStart, parseTime } from '../../functions/eventTime.js';

export { parseTime };
const DEFAULT_HOURS = 2; // shortcut: duración fija; agregar un campo de hora de fin al evento si hace falta precisión

/** Primer enlace de Google Meet dentro de un texto (p. ej. el mensaje de confirmación). */
export const findMeetLink = (text) => String(text || '').match(/https:\/\/meet\.google\.com\/[a-z0-9-]+/i)?.[0] || null;

/**
 * @returns {{ title, start: Date, end: Date, allDay: boolean, location, details } | null}
 * `date` es la fecha del evento (Timestamp/Date), `time` su hora en texto. Sin fecha → null.
 */
export function calendarEvent({ title, date, time, location, details, meetLink, virtual, timeZone }) {
  const day = eventDay(date);
  if (!day) return null;
  // Con hora: instante exacto en UTC, así cada calendario lo muestra en la hora local de quien lo guarda.
  const timed = eventStart(date, time);
  const start = timed || new Date(Date.UTC(day.y, day.mo, day.d));
  const end = timed ? new Date(timed.getTime() + DEFAULT_HOURS * 3600000) : new Date(Date.UTC(day.y, day.mo, day.d + 1));
  const meet = meetLink || null;
  const both = dualTime(timed, timeZone);
  return {
    title: title || 'Evento Boreal Labs',
    start,
    end,
    allDay: !timed,
    location: virtual && meet ? meet : location || meet || '',
    details: [both?.differs ? `Hora: ${both.text}` : '', details, meet ? `Google Meet: ${meet}` : '', 'Organiza: Boreal Labs · borealabs.org'].filter(Boolean).join('\n\n'),
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
