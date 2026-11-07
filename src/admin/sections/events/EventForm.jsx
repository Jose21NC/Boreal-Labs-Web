// Formularios de evento: público (`events`, se muestra en /eventos) e interno (`adminEvents`).
import React, { Suspense, lazy, useEffect, useState } from 'react';
import { ImagePlus } from 'lucide-react';
import { Button, Checkbox, Field, Input, Switch, Textarea } from '@/admin/ui';
import { ATTENDANCE_OPTIONS, categoryOf, imageOf, labelOf, toDateInput } from './data';
import { normalize } from '@/admin/lib';
import { normalizeCode, validateFields } from '@/lib/eventForms';
import { useEventsStore } from './store';
import { getEventCode } from './actions';
import CategoryPicker from './CategoryPicker';
import FormBuilder from './FormBuilder';
import AccessCode from './AccessCode';
import TextTemplatePicker from './TextTemplatePicker';
import AiAssist from './AiAssist';
import EmailComposer from './EmailComposer';

// react-easy-crop solo se descarga al elegir una imagen.
const ImageCropper = lazy(() => import('./ImageCropper'));

export const publicFormFrom = (ev = {}, categories = []) => {
  const opts = Array.isArray(ev.tipoAsistenciaOptions) ? ev.tipoAsistenciaOptions : Array.isArray(ev.tipoAsistencia) ? ev.tipoAsistencia : ATTENDANCE_OPTIONS;
  const cat = categoryOf(ev);
  return {
    title: ev.title || '',
    date: toDateInput(ev.date),
    time: ev.time || '',
    location: ev.location || '',
    // Acepta clave o etiqueta ("Taller" → workshop), igual que el filtro de EventsPage.
    category: categories.find((c) => c.value === cat || normalize(c.label) === normalize(cat))?.value || cat || 'workshop',
    description: ev.description || '',
    certificateDescription: ev.certificateDescription || '',
    capacity: ev.capacity ?? '',
    attendanceOptions: opts.filter(Boolean),
    confirmationMessage: String(ev.mensajeConfirmacion || ev.confirmMessage || ''),
    visible: ev.visible !== false,
    soldOut: ev.soldOut === true || ev.isFull === true || ev.cupoLleno === true,
    confirmationEmail: ev.confirmationEmail !== false,
    emailSubject: String(ev.emailSubject || ''),
    emailBody: String(ev.emailBody || ''),
    formFields: (Array.isArray(ev.formFields) ? ev.formFields : []).map((f) => ({ ...f, options: f.options ? [...f.options] : undefined })),
    meetLink: String(ev.meetLink || ''),
    requiresCode: ev.requiresCode === true,
    accessCode: '', // se carga de eventSecrets/{id} al editar
  };
};

export function validatePublic(form) {
  if (!form.title.trim()) return 'El título es obligatorio.';
  if (!form.date) return 'La fecha es obligatoria.';
  if (!form.attendanceOptions.length) return 'Selecciona al menos un tipo de asistencia.';
  if (form.capacity !== '' && (!Number.isInteger(Number(form.capacity)) || Number(form.capacity) < 0)) return 'El cupo debe ser un número entero positivo.';
  if (form.meetLink.trim() && !/^https:\/\/\S+$/i.test(form.meetLink.trim())) return 'El enlace de Google Meet debe empezar con https://.';
  if (form.requiresCode && normalizeCode(form.accessCode).length < 4) return 'El código de inscripción debe tener al menos 4 caracteres.';
  return validateFields(form.formFields);
}

/** Campos del evento público. `onSubmit(form, imageFile)`; el padre decide cómo guardar. */
export function PublicEventForm({ initial, onSubmit, submitting, submitLabel = 'Guardar', onCancel }) {
  const { categories } = useEventsStore();
  const [form, setForm] = useState(() => publicFormFrom(initial, categories));
  const [codeLoading, setCodeLoading] = useState(() => !!(initial?.id && initial.requiresCode));
  const patch = (p) => setForm((f) => ({ ...f, ...p }));

  // El código solo lo puede leer un admin (eventSecrets); no viaja en el evento público.
  useEffect(() => {
    if (!initial?.id || !initial.requiresCode) return;
    getEventCode(initial.id)
      .then((code) => setForm((f) => ({ ...f, accessCode: f.accessCode || code })))
      .catch((e) => console.error('[admin/eventos] código', e))
      .finally(() => setCodeLoading(false));
  }, [initial?.id, initial?.requiresCode]);
  const [error, setError] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [preview, setPreview] = useState(() => imageOf(initial || {}));
  const [cropSource, setCropSource] = useState(null);

  useEffect(() => () => { if (cropSource?.url) URL.revokeObjectURL(cropSource.url); }, [cropSource]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e }));
  const toggleOption = (opt) => setForm((f) => ({
    ...f,
    attendanceOptions: f.attendanceOptions.includes(opt) ? f.attendanceOptions.filter((o) => o !== opt) : [...f.attendanceOptions, opt],
  }));

  const submit = (e) => {
    e.preventDefault();
    const msg = validatePublic(form);
    setError(msg);
    if (!msg) onSubmit({ ...form, categoryName: labelOf(categories, form.category) }, imageFile);
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      {cropSource && (
        <Suspense fallback={null}>
        <ImageCropper
          source={cropSource}
          onCancel={() => setCropSource(null)}
          onDone={(file) => {
            setImageFile(file);
            setPreview((prev) => { if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev); return URL.createObjectURL(file); });
            setCropSource(null);
          }}
        />
        </Suspense>
      )}
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_220px]">
        <div className="space-y-4">
          <Field label="Título">
            <Input value={form.title} onChange={set('title')} required maxLength={300} placeholder="Taller de IA Generativa" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Fecha"><Input type="date" value={form.date} onChange={set('date')} required /></Field>
            <Field label="Hora"><Input value={form.time} onChange={set('time')} placeholder="2:00 PM" /></Field>
          </div>
        </div>
        <div className="space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-adm-muted">Imagen</span>
          <label className="group relative flex aspect-video cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-adm-border bg-adm-surface-2 focus-within:ring-2 focus-within:ring-adm-accent">
            {preview ? (
              <img src={preview} alt="Vista previa del evento" className="h-full w-full object-cover" />
            ) : (
              <span className="flex flex-col items-center gap-1 text-xs text-adm-muted"><ImagePlus className="h-5 w-5" aria-hidden="true" />Subir imagen</span>
            )}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              aria-label="Seleccionar imagen del evento"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) setCropSource({ file, url: URL.createObjectURL(file) });
              }}
            />
          </label>
          <p className="text-xs text-adm-muted">Se recorta a 16:9.</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Lugar" className="sm:col-span-1"><Input value={form.location} onChange={set('location')} placeholder="UNI, Managua" /></Field>
        <CategoryPicker id="event-category" value={form.category} onChange={(category) => patch({ category })} />
        <Field label="Cupo" hint="Vacío = sin límite">
          <Input type="number" min={0} step={1} inputMode="numeric" value={form.capacity} onChange={set('capacity')} />
        </Field>
      </div>

      <div className="relative">
        <div className="absolute -top-1 right-0 flex gap-1">
          <AiAssist kind="description" form={form} value={form.description} onInsert={(description) => patch({ description })} />
          <TextTemplatePicker kind="description" form={form} value={form.description} onInsert={(description) => patch({ description })} />
        </div>
        <Field label="Descripción"><Textarea rows={3} value={form.description} onChange={set('description')} /></Field>
      </div>

      <div className="relative">
        <div className="absolute -top-1 right-0"><AiAssist kind="certificate" form={form} value={form.certificateDescription} onInsert={(certificateDescription) => patch({ certificateDescription })} /></div>
        <Field label="Descripción para el certificado" hint="Opcional. Se imprime en el certificado si la plantilla incluye el campo «Descripción». Máx. 300 caracteres.">
          <Textarea rows={2} value={form.certificateDescription} onChange={set('certificateDescription')} maxLength={300} placeholder="Por su participación en el taller de…" />
        </Field>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-xs font-semibold uppercase tracking-wide text-adm-muted">Tipos de asistencia permitidos</legend>
        <div className="flex flex-wrap gap-4">
          {ATTENDANCE_OPTIONS.map((opt) => (
            <Checkbox key={opt} label={opt} checked={form.attendanceOptions.includes(opt)} onChange={() => toggleOption(opt)} />
          ))}
        </div>
      </fieldset>

      {form.attendanceOptions.some((o) => /virtual/i.test(o)) && (
        <Field
          label="Enlace de Google Meet"
          hint={form.meetLink.trim() && !/^https:\/\/meet\.google\.com\//i.test(form.meetLink.trim())
            ? '⚠️ No parece un enlace de Google Meet; se usará igual si empieza con https://.'
            : 'Se muestra a quienes elijan asistencia virtual (público: cualquiera puede leerlo).'}
        >
          <Input type="url" inputMode="url" value={form.meetLink} onChange={set('meetLink')} placeholder="https://meet.google.com/abc-defg-hij" maxLength={500} />
        </Field>
      )}

      <div className="relative">
        <div className="absolute -top-1 right-0 flex gap-1">
          <AiAssist kind="confirmation" form={form} value={form.confirmationMessage} onInsert={(confirmationMessage) => patch({ confirmationMessage })} />
          <TextTemplatePicker kind="confirmation" form={form} value={form.confirmationMessage} onInsert={(confirmationMessage) => patch({ confirmationMessage })} />
        </div>
        <Field label="Mensaje de confirmación" hint="Se muestra al inscrito después de registrarse.">
          <Textarea rows={2} value={form.confirmationMessage} onChange={set('confirmationMessage')} />
        </Field>
      </div>

      <FormBuilder fields={form.formFields} onChange={(formFields) => patch({ formFields })} />

      <AccessCode enabled={form.requiresCode} code={form.accessCode} loading={codeLoading} onChange={patch} />

      <div className="flex flex-wrap gap-6">
        <div className="flex items-center gap-3">
          <Switch checked={form.visible} onChange={set('visible')} label="Visible en la página de eventos" />
          <span className="text-sm text-adm-text">Visible en la página de eventos</span>
        </div>
        <div className="flex items-center gap-3">
          <Switch checked={form.soldOut} onChange={set('soldOut')} label="Marcar como agotado" />
          <span className="text-sm text-adm-text">Marcar como agotado</span>
        </div>
        <div className="flex items-center gap-3">
          <Switch checked={form.confirmationEmail} onChange={set('confirmationEmail')} label="Enviar correo de confirmación al inscribirse" />
          <span className="text-sm text-adm-text">Enviar correo de confirmación al inscribirse</span>
        </div>
      </div>

      {form.confirmationEmail && (
        <fieldset className="space-y-2 rounded-lg border border-adm-border p-4">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-adm-muted">Correo de confirmación</legend>
          <p className="text-xs text-adm-muted">Vacío = se envía el correo por defecto.</p>
          <EmailComposer
            value={{ subject: form.emailSubject, body: form.emailBody }}
            onChange={({ subject, body }) => patch({ emailSubject: subject, emailBody: body })}
            event={{ title: form.title, date: form.date ? new Date(`${form.date}T12:00:00`) : null, time: form.time, location: form.location, meetLink: form.meetLink }}
            reg={{ userName: 'Ana Pérez', userEmail: 'ana@example.com', tipoAsistencia: form.attendanceOptions[0] || 'Presencial' }}
          />
        </fieldset>
      )}

      {error && <p role="alert" className="text-sm text-adm-danger">{error}</p>}

      <div className="flex justify-end gap-2">
        {onCancel && <Button variant="ghost" onClick={onCancel}>Cancelar</Button>}
        <Button type="submit" variant="primary" loading={submitting}>{submitLabel}</Button>
      </div>

    </form>
  );
}

export function ManualEventForm({ initial, onSubmit, submitting, submitLabel = 'Guardar', onCancel }) {
  const [name, setName] = useState(initial?.name || '');
  const [date, setDate] = useState(toDateInput(initial?.date));
  const [error, setError] = useState(null);
  const submit = (e) => {
    e.preventDefault();
    if (!name.trim()) { setError('El nombre es obligatorio.'); return; }
    onSubmit({ name, date });
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Nombre" error={error}><Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={300} /></Field>
      <Field label="Fecha" hint="Opcional"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      <div className="flex justify-end gap-2">
        {onCancel && <Button variant="ghost" onClick={onCancel}>Cancelar</Button>}
        <Button type="submit" variant="primary" loading={submitting}>{submitLabel}</Button>
      </div>
    </form>
  );
}
