// Correos de Suscripciones (puros, con el layout de marca). Nunca mencionan el costo del proveedor.
import { SENDER, button, escapeHtml, layout, textToHtml, stripMarkup } from './emailTemplates.js';

const money = (n) => `C$ ${Number(n).toLocaleString('es-NI', { maximumFractionDigits: 2 })}`;
const dateFmt = new Intl.DateTimeFormat('es-NI', { timeZone: 'America/Managua', weekday: 'long', day: 'numeric', month: 'long' });

/** kind: 'welcome' | 'reminder' | 'overdue'. `due` = monto C$ del ciclo, `dueDate` = ms del vencimiento. */
export function subscriptionEmail(kind, { client, due, dueDate, cfg }) {
  const name = escapeHtml(String(client.name || '').split(' ')[0]);
  const when = dateFmt.format(dueDate);
  const instructions = String(cfg.paymentInstructions || '').trim();
  const box = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px"><tr><td style="padding:10px 16px;color:#64748b;font-size:14px;width:130px">Monto a pagar</td><td style="padding:10px 16px;font-weight:bold;font-size:15px">${money(due)}</td></tr><tr><td style="padding:10px 16px;color:#64748b;font-size:14px">Fecha límite</td><td style="padding:10px 16px;font-weight:bold;font-size:15px">${escapeHtml(when)}</td></tr></table>`;
  const how = instructions ? `<p style="margin:0 0 6px"><strong>¿Cómo pagar?</strong></p>${textToHtml(instructions)}` : '';
  const copy = {
    welcome: { subject: `Bienvenido/a a ${cfg.businessName}`, title: '¡Bienvenido/a!', intro: `Tu suscripción con <strong>${escapeHtml(cfg.businessName)}</strong> ya está activa. Tu próximo pago mensual:`, plain: 'Tu suscripción ya está activa. Tu próximo pago mensual:' },
    reminder: { subject: `Recordatorio de pago: ${money(due)} antes del ${when}`, title: 'Recordatorio de pago', intro: 'Se acerca la fecha de pago de tu suscripción:', plain: 'Se acerca la fecha de pago de tu suscripción:' },
    overdue: { subject: `Pago pendiente de tu suscripción (${money(due)})`, title: 'Tu pago está pendiente', intro: 'Aún no hemos registrado tu pago y la fecha límite ya pasó. Para mantener tu suscripción activa:', plain: 'Aún no hemos registrado tu pago y la fecha límite ya pasó:' },
  }[kind];
  if (!copy) throw new Error(`Tipo de correo desconocido: ${kind}`);
  const digits = String(cfg.whatsapp || '').replace(/\D/g, '');
  const wa = digits ? `https://wa.me/${digits.length === 8 ? `505${digits}` : digits}` : '';
  const html = layout(copy.title, `<p style="margin:0 0 16px">Hola ${name},</p><p style="margin:0 0 16px">${copy.intro}</p>${box}${how}<p style="margin:0 0 16px">Si ya pagaste, ignora este mensaje y gracias.</p>${wa ? `<p style="margin:0 0 4px">¿Dudas o algún inconveniente? Escríbenos:</p>${button(wa, 'Escribir por WhatsApp')}` : ''}`);
  const text = [`Hola ${String(client.name || '').split(' ')[0]},`, copy.plain, `Monto a pagar: ${money(due)}\nFecha límite: ${when}`, instructions && `¿Cómo pagar?\n${stripMarkup(instructions)}`, 'Si ya pagaste, ignora este mensaje y gracias.', wa && `¿Dudas? WhatsApp: ${wa}`].filter(Boolean).join('\n\n');
  // Recordatorio y vencido: copia oculta al admin para que también se entere.
  const bcc = kind === 'welcome' ? undefined : (cfg.notifyEmail || SENDER);
  return { to: client.email, ...(bcc ? { bcc } : {}), subject: copy.subject, html, text };
}
