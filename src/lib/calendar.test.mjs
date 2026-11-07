// node --test src/lib/calendar.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { calendarEvent, findMeetLink, googleCalendarUrl, icsContent, parseTime } from './calendar.js';

test('parseTime acepta los formatos que usan los eventos', () => {
  assert.deepEqual(parseTime('2:00 PM'), { h: 14, m: 0 });
  assert.deepEqual(parseTime('9:00AM'), { h: 9, m: 0 });
  assert.deepEqual(parseTime('12:30 a.m.'), { h: 0, m: 30 });
  assert.deepEqual(parseTime('14:30'), { h: 14, m: 30 });
  assert.equal(parseTime('mañana'), null);
});

test('evento con hora: inicio en hora de Nicaragua (UTC-6) y 2 h de duración; Meet como lugar si es virtual', () => {
  const ev = calendarEvent({ title: 'Taller', date: new Date('2026-11-18T06:00:00Z'), time: '2:00 PM', location: 'UAM', meetLink: 'https://meet.google.com/abc-defg-hij', virtual: true });
  assert.equal(ev.start.toISOString(), '2026-11-18T20:00:00.000Z');
  assert.equal(ev.end.toISOString(), '2026-11-18T22:00:00.000Z');
  assert.equal(ev.location, 'https://meet.google.com/abc-defg-hij');
  assert.match(ev.details, /Google Meet: https:\/\/meet\.google\.com\/abc-defg-hij/);
  const url = googleCalendarUrl(ev);
  assert.match(url, /dates=20261118T200000Z%2F20261118T220000Z/);
  assert.match(icsContent(ev, 'x'), /DTSTART:20261118T200000Z/);
});

test('sin hora: evento de día completo; sin fecha: null; detecta Meet en texto', () => {
  const ev = calendarEvent({ title: 'Jornada', date: new Date('2026-11-29T06:00:00Z'), location: 'Granada' });
  assert.equal(ev.allDay, true);
  assert.match(icsContent(ev, 'x'), /DTSTART;VALUE=DATE:20261129/);
  assert.equal(calendarEvent({ title: 'x' }), null);
  assert.equal(findMeetLink('Entra: https://meet.google.com/nyx-nkmg-kwc el día'), 'https://meet.google.com/nyx-nkmg-kwc');
});
