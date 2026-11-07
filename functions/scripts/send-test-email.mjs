// Envía correos de ejemplo (confirmación y recordatorios) a una dirección para revisar el diseño.
// Uso (la contraseña se lee de Secret Manager en tu terminal, nunca se escribe en un archivo):
//   SMTP_PASSWORD="$(npx firebase-tools functions:secrets:access SMTP_PASSWORD --project borealabsweb)" \
//     node functions/scripts/send-test-email.mjs destino@ejemplo.com
import nodemailer from 'nodemailer';
import { SENDER, registrationEmail, reminderEmail } from '../emailTemplates.js';

const to = process.argv[2];
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to || '')) throw new Error('Indica el correo de destino: node functions/scripts/send-test-email.mjs correo@ejemplo.com');
if (!process.env.SMTP_PASSWORD) throw new Error('Falta SMTP_PASSWORD (ver el comando de uso arriba).');

const start = new Date(Date.now() + 2 * 24 * 3600 * 1000);
start.setUTCHours(20, 0, 0, 0); // 2:00 p. m. en Nicaragua
const event = {
  title: 'Taller de Liderazgo Juvenil (PRUEBA)', date: new Date(start.getTime() - 14 * 3600 * 1000), time: '14:00',
  location: 'UAM, Managua', meetLink: 'https://meet.google.com/abc-defg-hij', mensajeConfirmacion: 'Llega **15 minutos antes** para el registro.',
};
const presencial = { userName: 'José (prueba)', userEmail: to, tipoAsistencia: 'Presencial', userTimeZone: 'America/Managua' };
const virtual = { ...presencial, tipoAsistencia: 'Virtual', userTimeZone: 'America/Bogota' };

const transport = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user: SENDER, pass: process.env.SMTP_PASSWORD } });
for (const msg of [registrationEmail(presencial, event), reminderEmail(presencial, event, 'presencial'), reminderEmail(virtual, event, 'virtual')]) {
  await transport.sendMail({ from: `Boreal Labs <${SENDER}>`, replyTo: SENDER, ...msg, subject: `[PRUEBA] ${msg.subject}` });
  console.log('Enviado:', msg.subject);
}
