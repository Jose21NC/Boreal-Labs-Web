// Correos automáticos desde contacto@borealabs.org vía SMTP de Google Workspace.
// La contraseña de aplicación vive en Secret Manager: `firebase functions:secrets:set SMTP_PASSWORD`.
import nodemailer from 'nodemailer';

import { SENDER } from './emailTemplates.js';

export * from './emailTemplates.js';
const FROM = `Boreal Labs <${SENDER}>`;

let transporter = null;
const getTransport = (password) => {
  transporter ||= nodemailer.createTransport({
    host: 'smtp.gmail.com', port: 465, secure: true,
    auth: { user: SENDER, pass: password },
    pool: true, maxConnections: 1, maxMessages: 50,
  });
  return transporter;
};

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Envía un correo como máximo una vez por documento: reclama `email.status = 'sending'` en una
 * transacción (los triggers pueden repetirse) y luego deja 'sent' o 'error' con el motivo.
 * @param {(data) => Promise<{to, subject, html, text} | null>} build  null = no enviar
 * `field` = campo de estado (p. ej. 'seatEmail' para el correo de cupo, independiente de 'email');
 * `resend` permite reenviar si ya terminó (nunca mientras otro envío está en curso).
 * @returns {Promise<'sent'|'skipped'|'error'>}
 */
export async function sendOnce(db, ref, build, { password, transport, field = 'email', resend = false } = {}) {
  const f = (k) => `${field}.${k}`;
  const claimed = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const status = snap.exists ? snap.get(f('status')) : null;
    if (!snap.exists || (status && !(resend && status !== 'sending'))) return null;
    const msg = await build(snap.data());
    if (!msg) return null;
    if (!EMAIL_RE.test(String(msg.to || ''))) {
      tx.update(ref, { [f('status')]: 'skipped', [f('at')]: new Date() });
      return null;
    }
    tx.update(ref, { [f('status')]: 'sending', [f('at')]: new Date() });
    return msg;
  });
  if (!claimed) return 'skipped';
  try {
    await (transport || getTransport(password)).sendMail({ from: FROM, replyTo: SENDER, ...claimed });
    await ref.update({ [f('status')]: 'sent', [f('at')]: new Date(), [f('to')]: claimed.to });
    return 'sent';
  } catch (error) {
    // Sin reintento automático: el error queda visible en el doc y no se arriesga un doble envío.
    await ref.update({ [f('status')]: 'error', [f('at')]: new Date(), [f('error')]: String(error?.message || error).slice(0, 500) });
    console.error('[email] Falló el envío', ref.path, error);
    return 'error';
  }
}
