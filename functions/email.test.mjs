// Pruebas locales de los correos: no envían nada (transporte JSON de nodemailer) ni tocan Firestore.
// Ejecutar: cd functions && node --test email.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import nodemailer from 'nodemailer';
import { certificateEmail, registrationEmail, sendOnce } from './email.js';

const jsonTransport = () => {
  const sent = [];
  const t = nodemailer.createTransport({ jsonTransport: true });
  return { sent, sendMail: async (m) => { sent.push(m); return t.sendMail(m); } };
};

// Firestore mínimo: un doc en memoria con runTransaction/get/update.
const fakeDb = (data) => {
  const state = { data: structuredClone(data) };
  const setPath = (obj, path, value) => {
    const keys = path.split('.');
    let node = obj;
    keys.slice(0, -1).forEach((k) => { node[k] ||= {}; node = node[k]; });
    node[keys.at(-1)] = value;
  };
  const snap = () => ({ exists: !!state.data, data: () => state.data, get: (p) => p.split('.').reduce((a, k) => a?.[k], state.data) });
  const ref = { path: 'x/1', update: async (fields) => Object.entries(fields).forEach(([k, v]) => setPath(state.data, k, v)) };
  const db = { runTransaction: async (fn) => fn({ get: async () => snap(), update: (_r, fields) => ref.update(fields) }) };
  return { db, ref, state };
};

test('confirmación de cupo: datos, Meet solo en virtual y escape de HTML', () => {
  const event = { title: 'Taller <IA>', date: new Date('2026-12-01T15:00:00Z'), time: '9:00 AM', location: 'UNI', meetLink: 'https://meet.google.com/abc-defg-hij', mensajeConfirmacion: 'Trae laptop' };
  const virtual = registrationEmail({ userName: '<script>x</script>', userEmail: 'a@example.com', tipoAsistencia: 'Virtual' }, event);
  assert.equal(virtual.to, 'a@example.com');
  assert.match(virtual.subject, /Taller <IA>/);
  assert.match(virtual.html, /meet\.google\.com\/abc-defg-hij/);
  assert.doesNotMatch(virtual.html, /<script>/);
  assert.match(virtual.html, /Taller &lt;IA&gt;/);
  const presencial = registrationEmail({ userName: 'Ana', userEmail: 'a@example.com', tipoAsistencia: 'Presencial' }, event);
  assert.doesNotMatch(presencial.html, /meet\.google\.com/);
  assert.match(presencial.text, /Lugar: UNI/);
});

test('Meet no se duplica si el mensaje ya lo incluye; enlaces no https se ignoran', () => {
  const link = 'https://meet.google.com/abc-defg-hij';
  const msg = registrationEmail({ userEmail: 'a@example.com', tipoAsistencia: 'Virtual' }, { title: 'T', meetLink: link, mensajeConfirmacion: `Entra: ${link}` });
  assert.equal(msg.html.split(link).length - 1, 2); // href + texto del mensaje, sin botón extra
  const bad = registrationEmail({ userEmail: 'a@example.com', tipoAsistencia: 'Virtual' }, { title: 'T', meetLink: 'javascript:alert(1)' });
  assert.doesNotMatch(bad.html, /javascript:/);
});

test('certificado: PDF y enlace de validación codificado', () => {
  const msg = certificateEmail({ correoUsuario: 'b@example.com', nombreUsuario: 'Luis', nombreEvento: 'Hackathon', idValidacion: 'id con espacio', urlPdf: 'https://firebasestorage.googleapis.com/x.pdf' }, 'https://borealabs.org/validacion?id=');
  assert.equal(msg.to, 'b@example.com');
  assert.match(msg.html, /validacion\?id=id%20con%20espacio/);
  assert.match(msg.html, /firebasestorage\.googleapis\.com\/x\.pdf/);
});

test('sendOnce envía una sola vez y marca el estado', async () => {
  const { db, ref, state } = fakeDb({ userEmail: 'c@example.com' });
  const transport = jsonTransport();
  const build = async (d) => ({ to: d.userEmail, subject: 's', text: 't', html: 'h' });
  assert.equal(await sendOnce(db, ref, build, { transport }), 'sent');
  assert.equal(await sendOnce(db, ref, build, { transport }), 'skipped'); // trigger repetido
  assert.equal(transport.sent.length, 1);
  assert.equal(state.data.email.status, 'sent');
  assert.equal(transport.sent[0].from, 'Boreal Labs <contacto@borealabs.org>');
});

test('sendOnce: correo inválido se omite, build null no marca nada, error queda registrado', async () => {
  const invalid = fakeDb({});
  assert.equal(await sendOnce(invalid.db, invalid.ref, async () => ({ to: 'no-es-correo' }), { transport: jsonTransport() }), 'skipped');
  assert.equal(invalid.state.data.email.status, 'skipped');

  const off = fakeDb({});
  assert.equal(await sendOnce(off.db, off.ref, async () => null, { transport: jsonTransport() }), 'skipped');
  assert.equal(off.state.data.email, undefined);

  const failing = fakeDb({});
  const transport = { sendMail: async () => { throw new Error('SMTP caído'); } };
  assert.equal(await sendOnce(failing.db, failing.ref, async () => ({ to: 'd@example.com', subject: 's', text: 't' }), { transport }), 'error');
  assert.equal(failing.state.data.email.status, 'error');
  assert.match(failing.state.data.email.error, /SMTP caído/);
});
