// Asunto + cuerpo de correo con marcadores, plantillas y vista previa del HTML REAL que se envía.
import React, { useRef } from 'react';
import { Field, Input, Select, Textarea } from '@/admin/ui';
import { EMAIL_PLACEHOLDERS, customEmail, registrationEmail } from '../../../../functions/emailTemplates.js';

const MEET = '\n\nSi asistes en línea, entra por Google Meet: {meet}';
export const EMAIL_PRESETS = [
  { id: 'cupo', name: 'Cupo confirmado', subject: 'Tu cupo está confirmado: {evento}', body: 'Hola {nombre},\n\n¡Buenas noticias! Tu cupo en {evento} está confirmado.\n\nFecha: {fecha}\nHora: {hora}\nLugar: {lugar}\nModalidad: {modalidad}\n\nSi no puedes asistir, respóndenos este correo para liberar tu lugar.\n\n¡Nos vemos pronto!' },
  { id: 'presencial', name: 'Presencial', subject: 'Te esperamos en {evento}', body: 'Hola {nombre},\n\nTu inscripción a {evento} quedó registrada. Te esperamos el {fecha} a las {hora} en {lugar}.\n\nLlega 15 minutos antes para el registro.\n\n¡Nos vemos!' },
  { id: 'virtual', name: 'Virtual', subject: 'Tu acceso a {evento}', body: `Hola {nombre},\n\nGracias por inscribirte a {evento}. La sesión es el {fecha} a las {hora}.${MEET}\n\nTe recomendamos conectarte unos minutos antes.` },
  { id: 'hackathon', name: 'Hackathon', subject: '¡Ya eres parte de {evento}! 🚀', body: 'Hola {nombre},\n\n¡Ya eres parte de {evento}! Te esperamos el {fecha} a las {hora} en {lugar}.\n\nPronto te escribiremos con los retos, la agenda y cómo formar tu equipo.' },
  { id: 'voluntariado', name: 'Voluntariado', subject: 'Gracias por sumarte a {evento} 💚', body: 'Hola {nombre},\n\nGracias por sumarte a {evento}. Nos vemos el {fecha} a las {hora} en {lugar}.\n\nUsa ropa cómoda y trae tu botella de agua. Tus horas cuentan para tus créditos de voluntariado.' },
  { id: 'generico', name: 'Genérico', subject: 'Inscripción confirmada: {evento}', body: 'Hola {nombre},\n\nTe registraste en {evento} ({fecha}, {hora}).\n\n¡Gracias por participar con Boreal Labs!' },
];

/** `value` = { subject, body }; `reg`/`event` alimentan la vista previa. Cuerpo vacío = correo por defecto. */
export default function EmailComposer({ value, onChange, reg, event }) {
  const bodyRef = useRef(null);
  const insert = (token) => {
    const el = bodyRef.current;
    const start = el?.selectionStart ?? value.body.length;
    const end = el?.selectionEnd ?? start;
    onChange({ ...value, body: value.body.slice(0, start) + token + value.body.slice(end) });
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(start + token.length, start + token.length); });
  };
  const preview = value.body.trim() ? customEmail(value, reg, event) : registrationEmail(reg, event);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-3">
        <Select aria-label="Plantilla de correo" value="" onChange={(e) => { const p = EMAIL_PRESETS.find((x) => x.id === e.target.value); if (p) onChange({ subject: p.subject, body: p.body }); }} className="h-9">
          <option value="">Usar plantilla…</option>
          {EMAIL_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
        <Field label="Asunto"><Input value={value.subject} onChange={(e) => onChange({ ...value, subject: e.target.value })} maxLength={200} placeholder="Cupo confirmado: {evento}" /></Field>
        <Field label="Cuerpo del correo" hint="Texto plano: los enlaces https se vuelven clicables.">
          <Textarea ref={bodyRef} rows={9} value={value.body} onChange={(e) => onChange({ ...value, body: e.target.value })} maxLength={5000} />
        </Field>
        <div className="flex flex-wrap gap-1" aria-label="Insertar marcador">
          {EMAIL_PLACEHOLDERS.map((p) => (
            <button key={p} type="button" onClick={() => insert(p)} className="rounded-md border border-adm-border px-2 py-0.5 font-mono text-xs text-adm-text hover:bg-adm-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-adm-accent">{p}</button>
          ))}
        </div>
      </div>
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-adm-muted">Vista previa</p>
        <p className="truncate text-sm text-adm-text"><span className="text-adm-muted">Asunto:</span> {preview.subject}</p>
        {/* sandbox vacío: sin scripts ni navegación; el HTML ya viene escapado */}
        <iframe title="Vista previa del correo" sandbox="" srcDoc={preview.html} className="h-96 w-full rounded-lg border border-adm-border bg-white" />
      </div>
    </div>
  );
}
