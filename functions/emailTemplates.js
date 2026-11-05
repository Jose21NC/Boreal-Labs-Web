// Plantillas de correo PURAS (sin nodemailer): las usa functions/email.js para enviar y el panel admin
// (src/admin) para la vista previa, así lo que ve el admin es exactamente lo que se envía.
export const SENDER = 'contacto@borealabs.org';
const SITE = 'https://borealabs.org';

export const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export const safeHttpsUrl = (value) => (/^https:\/\//i.test(String(value || '').trim()) ? String(value).trim() : null);

/** Texto plano → HTML: escapa, respeta saltos de línea y convierte https:// en enlaces. */
export const textToHtml = (text) => escapeHtml(text)
  .replace(/https:\/\/[^\s<]+/g, (url) => `<a href="${url}" style="color:#3162ed">${url}</a>`)
  .replace(/\n/g, '<br>');

export const button = (href, label) => `<p style="margin:24px 0"><a href="${escapeHtml(href)}" style="background:#3162ed;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">${escapeHtml(label)}</a></p>`;

export const layout = (title, bodyHtml) => `<!doctype html><html lang="es"><body style="margin:0;background:#f4f6fb;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden">
<tr><td style="background:#010b1d;padding:20px 24px;color:#69e6af;font-weight:bold;font-size:18px">Boreal Labs</td></tr>
<tr><td style="padding:24px;font-size:15px;line-height:1.6">
<h1 style="font-size:20px;margin:0 0 16px">${escapeHtml(title)}</h1>
${bodyHtml}
</td></tr>
<tr><td style="padding:16px 24px;background:#f8fafc;font-size:12px;color:#64748b">Recibiste este correo por tu participación en actividades de Boreal Labs · <a href="${SITE}" style="color:#64748b">borealabs.org</a></td></tr>
</table></td></tr></table></body></html>`;

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
    ['Hora', event?.time],
    ['Lugar', virtual ? 'Virtual' : event?.location],
    ['Modalidad', reg.tipoAsistencia],
  ].filter(([, v]) => v);
  const message = String(event?.mensajeConfirmacion || '').trim();

  const html = layout('¡Tu cupo está confirmado!', `
<p>Hola ${escapeHtml(reg.userName || '')},</p>
<p>Te registraste en <strong>${escapeHtml(title)}</strong>.</p>
${details.length ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0">${details.map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#64748b">${escapeHtml(k)}</td><td style="padding:4px 0"><strong>${escapeHtml(v)}</strong></td></tr>`).join('')}</table>` : ''}
${message ? `<p>${textToHtml(message)}</p>` : ''}
${meet && !message.includes(meet) ? button(meet, 'Unirme por Google Meet') : ''}
<p>¡Nos vemos pronto!</p>`);

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
<p>Hola ${escapeHtml(cert.nombreUsuario || '')},</p>
<p>Gracias por participar en <strong>${escapeHtml(cert.nombreEvento || '')}</strong>. Tu certificado ya fue emitido.</p>
${pdf ? button(pdf, 'Descargar certificado (PDF)') : ''}
<p>Cualquier persona puede verificar su autenticidad aquí:<br><a href="${escapeHtml(validation)}" style="color:#3162ed">${escapeHtml(validation)}</a></p>
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
  hora: event?.time || '',
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
  const html = layout(finalSubject, `<p>${textToHtml(text)}</p>${meet ? button(meet, 'Unirme por Google Meet') : ''}`);
  return { to: reg?.userEmail, subject: finalSubject, html, text: meet ? `${text}\n\nGoogle Meet: ${meet}` : text };
}
