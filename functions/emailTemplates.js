// Plantillas de correo PURAS (sin nodemailer): las usa functions/email.js para enviar y el panel admin
// (src/admin) para la vista previa, así lo que ve el admin es exactamente lo que se envía.
import { dualTime, eventStart } from './eventTime.js';

export const SENDER = 'contacto@borealabs.org';
const SITE = 'https://borealabs.org';

export const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export const safeHttpsUrl = (value) => (/^https:\/\//i.test(String(value || '').trim()) ? String(value).trim() : null);

// PNG (no SVG: Gmail y Outlook no muestran SVG) con su propio fondo oscuro incluido: en modo oscuro Gmail
// cambia el color de fondo de la cabecera, pero no altera imágenes, así el logo blanco siempre se ve.
const LOGO = `${SITE}/email/logo-boreal.png`;
const BRAND = { dark: '#010b1d', aqua: '#69e6af', blue: '#3162ed', purple: '#be58f0', text: '#0f172a', muted: '#64748b', bg: '#eef1f7' };

/**
 * Texto del admin → HTML: escapa todo, **negrita**, enlaces https clicables y saltos de línea.
 * Los párrafos (línea en blanco) se separan con margen.
 */
export const textToHtml = (text) => escapeHtml(text)
  .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
  .replace(/https:\/\/[^\s<]+/g, (url) => `<a href="${url}" style="color:${BRAND.blue};text-decoration:underline">${url}</a>`)
  .split(/\n{2,}/)
  .map((p) => `<p style="margin:0 0 16px">${p.replace(/\n/g, '<br>')}</p>`)
  .join('');

/** Versión texto plano: quita los ** de negrita. */
export const stripMarkup = (text) => String(text ?? '').replace(/\*\*([^*\n]+)\*\*/g, '$1');

export const button = (href, label) => `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px"><tr><td style="border-radius:10px;background:${BRAND.blue};background-image:linear-gradient(90deg,${BRAND.blue},${BRAND.purple})"><a href="${escapeHtml(href)}" style="display:inline-block;padding:14px 26px;color:#ffffff;font-weight:bold;font-size:15px;text-decoration:none;border-radius:10px">${escapeHtml(label)}</a></td></tr></table>`;

export const layout = (title, bodyHtml) => `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:${BRAND.bg};font-family:'Helvetica Neue',Arial,Helvetica,sans-serif;color:${BRAND.text};-webkit-font-smoothing:antialiased">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg}"><tr><td align="center" style="padding:32px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">
<!-- background-image: Gmail en modo oscuro recolorea background-color pero no las imágenes de fondo -->
<tr><td bgcolor="${BRAND.dark}" style="background:${BRAND.dark};background-image:linear-gradient(${BRAND.dark},${BRAND.dark});border-radius:16px 16px 0 0;padding:20px 24px">
<a href="${SITE}" style="text-decoration:none"><img src="${LOGO}" width="110" height="55" alt="Boreal Labs" style="display:block;border:0;height:55px;width:110px"></a>
</td></tr>
<tr><td style="height:4px;line-height:4px;font-size:0;background:${BRAND.aqua};background-image:linear-gradient(90deg,${BRAND.aqua},${BRAND.blue},${BRAND.purple})">&nbsp;</td></tr>
<tr><td style="background:#ffffff;padding:36px 32px 12px;font-size:16px;line-height:1.65">
<h1 style="margin:0 0 20px;font-size:24px;line-height:1.3;color:${BRAND.text};font-weight:800">${escapeHtml(title)}</h1>
${bodyHtml}
</td></tr>
<tr><td style="background:#ffffff;border-radius:0 0 16px 16px;padding:0 32px 32px">
<p style="margin:16px 0 0;padding-top:20px;border-top:1px solid #e2e8f0;font-size:14px;color:${BRAND.muted}">Con cariño,<br><strong style="color:${BRAND.text}">Equipo Boreal Labs</strong></p>
</td></tr>
<tr><td align="center" style="padding:24px 16px;font-size:12px;line-height:1.6;color:${BRAND.muted}">
Juventud que innova, crea y transforma Nicaragua<br>
<a href="${SITE}" style="color:${BRAND.muted}">borealabs.org</a> · <a href="https://instagram.com/boreal.labs" style="color:${BRAND.muted}">Instagram</a> · <a href="mailto:${SENDER}" style="color:${BRAND.muted}">${SENDER}</a><br>
Recibiste este correo por tu participación en actividades de Boreal Labs.
</td></tr>
</table></td></tr></table></body></html>`;

/** Hora del evento; si quien se inscribió está en otra zona horaria, ambas (Nicaragua y la suya). */
export const eventTimeFor = (event, reg) => dualTime(eventStart(event?.date, event?.time), reg?.userTimeZone)?.text || event?.time || '';

export const formatDate = (value) => {
  const d = value?.toDate ? value.toDate() : value ? new Date(value) : null;
  return d && !Number.isNaN(d.getTime())
    ? new Intl.DateTimeFormat('es-NI', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Managua' }).format(d)
    : null;
};

/** Correo de confirmación de cupo. `event` puede ser null (registro sin evento público). */
export function registrationEmail(reg, event) {
  if (String(event?.emailBody || '').trim()) return customEmail({ subject: event.emailSubject, body: event.emailBody }, reg, event);
  const title = event?.title || reg.eventName || 'tu evento';
  const virtual = String(reg.tipoAsistencia || '').toLowerCase().includes('virtual');
  const meet = virtual ? safeHttpsUrl(event?.meetLink) : null;
  const details = [
    ['Fecha', formatDate(event?.date)],
    ['Hora', eventTimeFor(event, reg)],
    ['Lugar', virtual ? 'Virtual' : event?.location],
    ['Modalidad', reg.tipoAsistencia],
  ].filter(([, v]) => v);
  const message = String(event?.mensajeConfirmacion || '').trim();

  const html = layout('¡Tu cupo está confirmado!', `
<p style="margin:0 0 16px">Hola ${escapeHtml(reg.userName || '')},</p>
<p style="margin:0 0 16px">Te registraste en <strong>${escapeHtml(title)}</strong>.</p>
${details.length ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px">${details.map(([k, v]) => `<tr><td style="padding:10px 16px;color:${BRAND.muted};font-size:14px;width:110px">${escapeHtml(k)}</td><td style="padding:10px 16px;font-weight:bold;font-size:15px">${escapeHtml(v)}</td></tr>`).join('')}</table>` : ''}
${message ? textToHtml(message) : ''}
${meet && !message.includes(meet) ? button(meet, 'Unirme por Google Meet') : ''}
<p style="margin:0 0 16px">¡Nos vemos pronto!</p>`);

  const text = [
    `Hola ${reg.userName || ''},`,
    `Te registraste en ${title}.`,
    ...details.map(([k, v]) => `${k}: ${v}`),
    message,
    meet && !message.includes(meet) ? `Google Meet: ${meet}` : '',
  ].filter(Boolean).join('\n\n');

  return { to: reg.userEmail, subject: `Cupo confirmado: ${title}`, html, text };
}

/** Correo con el certificado emitido. */
export function certificateEmail(cert, validationBase) {
  const validation = `${validationBase}${encodeURIComponent(cert.idValidacion)}`;
  const pdf = safeHttpsUrl(cert.urlPdf);
  const html = layout('Tu certificado está listo', `
<p style="margin:0 0 16px">Hola ${escapeHtml(cert.nombreUsuario || '')},</p>
<p style="margin:0 0 16px">Gracias por participar en <strong>${escapeHtml(cert.nombreEvento || '')}</strong>. Tu certificado ya fue emitido.</p>
${pdf ? button(pdf, 'Descargar certificado (PDF)') : ''}
<p style="margin:0 0 16px">Cualquier persona puede verificar su autenticidad aquí:<br><a href="${escapeHtml(validation)}" style="color:#3162ed">${escapeHtml(validation)}</a></p>
<p style="color:#64748b;font-size:13px">Código de validación: ${escapeHtml(cert.idValidacion)}</p>`);
  const text = [
    `Hola ${cert.nombreUsuario || ''},`,
    `Tu certificado de ${cert.nombreEvento || ''} ya fue emitido.`,
    pdf ? `Descárgalo: ${pdf}` : '',
    `Verificación: ${validation}`,
  ].filter(Boolean).join('\n\n');
  return { to: cert.correoUsuario, subject: `Tu certificado: ${cert.nombreEvento || 'Boreal Labs'}`, html, text };
}

export const EMAIL_PLACEHOLDERS = ['{nombre}', '{evento}', '{fecha}', '{hora}', '{lugar}', '{modalidad}', '{meet}'];

/** Reemplaza {nombre} {evento}… con `vars`; los marcadores sin valor quedan vacíos (no se envía "{meet}"). */
export const fillPlaceholders = (text, vars) => String(text ?? '')
  .replace(/\{(nombre|evento|fecha|hora|lugar|modalidad|meet)\}/g, (_, k) => String(vars?.[k] ?? ''));

const isVirtual = (reg) => String(reg?.tipoAsistencia || '').toLowerCase().includes('virtual');

export const placeholderVars = (reg, event) => ({
  nombre: reg?.userName || '',
  evento: event?.title || reg?.eventName || '',
  fecha: formatDate(event?.date) || '',
  hora: eventTimeFor(event, reg),
  lugar: isVirtual(reg) ? 'Virtual' : event?.location || '',
  modalidad: reg?.tipoAsistencia || '',
  meet: safeHttpsUrl(event?.meetLink) || '',
});

/** Correo redactado por el admin (asunto y cuerpo en texto plano, con marcadores). */
export function customEmail({ subject, body }, reg, event) {
  const vars = placeholderVars(reg, event);
  const title = vars.evento || 'tu evento';
  const finalSubject = fillPlaceholders(subject, vars).replace(/\s+/g, ' ').trim() || `Cupo confirmado: ${title}`;
  const text = fillPlaceholders(body, vars).trim();
  const meet = isVirtual(reg) && vars.meet && !text.includes(vars.meet) ? vars.meet : null;
  const html = layout(finalSubject, `${textToHtml(text)}${meet ? button(meet, 'Unirme por Google Meet') : ''}`);
  const plain = stripMarkup(text);
  return { to: reg?.userEmail, subject: stripMarkup(finalSubject), html, text: meet ? `${plain}\n\nGoogle Meet: ${meet}` : plain };
}
