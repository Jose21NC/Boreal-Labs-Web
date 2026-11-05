// Editor de campos adicionales del formulario de inscripción + vista previa con el estilo de /eventos.
import React, { useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Button, Checkbox, Field, Input, Select, Textarea } from '@/admin/ui';
import EventCustomFields from '@/components/EventCustomFields';
import { CHOICE_TYPES, FIELD_TYPES, MAX_FIELDS, cleanFields, newFieldId } from '@/lib/eventForms';

const HAS_PLACEHOLDER = ['text', 'textarea', 'number', 'email', 'phone', 'url'];

function FieldEditor({ field, index, count, onPatch, onMove, onRemove }) {
  const choice = CHOICE_TYPES.includes(field.type);
  return (
    <li className="space-y-3 rounded-lg border border-adm-border bg-adm-surface-2/40 p-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-adm-muted">#{index + 1}</span>
        <Select aria-label="Tipo de campo" value={field.type} onChange={(e) => onPatch({ type: e.target.value, options: field.options?.length ? field.options : ['', ''] })} className="h-8 flex-1 text-xs">
          {FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </Select>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onMove(-1)} disabled={index === 0} aria-label={`Subir campo ${index + 1}`}><ArrowUp className="h-3.5 w-3.5" aria-hidden="true" /></Button>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onMove(1)} disabled={index === count - 1} aria-label={`Bajar campo ${index + 1}`}><ArrowDown className="h-3.5 w-3.5" aria-hidden="true" /></Button>
        <Button size="icon" variant="danger-ghost" className="h-8 w-8" onClick={onRemove} aria-label={`Eliminar campo ${index + 1}`}><Trash2 className="h-3.5 w-3.5" aria-hidden="true" /></Button>
      </div>
      <Field label="Etiqueta">
        <Input value={field.label} onChange={(e) => onPatch({ label: e.target.value })} maxLength={200} placeholder={field.type === 'checkbox' ? 'Acepto los términos y condiciones' : '¿Qué esperas aprender?'} />
      </Field>
      {choice && (
        <Field label="Opciones" hint="Una por línea (mínimo 2).">
          <Textarea rows={3} value={(field.options || []).join('\n')} onChange={(e) => onPatch({ options: e.target.value.split('\n') })} />
        </Field>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Ayuda" hint="Opcional"><Input value={field.help || ''} onChange={(e) => onPatch({ help: e.target.value })} maxLength={200} /></Field>
        {HAS_PLACEHOLDER.includes(field.type) && (
          <Field label="Texto de ejemplo" hint="Opcional"><Input value={field.placeholder || ''} onChange={(e) => onPatch({ placeholder: e.target.value })} maxLength={100} /></Field>
        )}
        {field.type === 'multiselect' && (
          <Field label="Máximo de opciones" hint="Vacío = sin límite">
            <Input type="number" min={1} step={1} value={field.maxSelections || ''} onChange={(e) => onPatch({ maxSelections: e.target.value })} />
          </Field>
        )}
      </div>
      <Checkbox label="Obligatorio" checked={!!field.required} onChange={(e) => onPatch({ required: e.target.checked })} />
    </li>
  );
}

export default function FormBuilder({ fields, onChange }) {
  const [newType, setNewType] = useState('text');
  const [previewValues, setPreviewValues] = useState({});

  const patch = (i, p) => onChange(fields.map((f, j) => (j === i ? { ...f, ...p } : f)));
  const move = (i, dir) => {
    const next = [...fields];
    [next[i], next[i + dir]] = [next[i + dir], next[i]];
    onChange(next);
  };
  const add = () => onChange([...fields, {
    id: newFieldId(), type: newType, label: '', required: false,
    ...(CHOICE_TYPES.includes(newType) ? { options: ['', ''] } : {}),
  }]);

  // La vista previa usa la misma limpieza que al guardar; etiqueta provisional si falta.
  const preview = cleanFields(fields.map((f) => ({ ...f, label: f.label.trim() || 'Sin etiqueta', options: f.options || [] })));

  return (
    <fieldset className="space-y-3">
      <legend className="text-xs font-semibold uppercase tracking-wide text-adm-muted">Campos adicionales del formulario</legend>
      <p className="text-xs text-adm-muted">Se piden después de los datos estándar (nombre, correo, WhatsApp, universidad…). {fields.length}/{MAX_FIELDS}</p>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          {fields.length > 0 && (
            <ol className="space-y-3">
              {fields.map((f, i) => (
                <FieldEditor
                  key={f.id}
                  field={f}
                  index={i}
                  count={fields.length}
                  onPatch={(p) => patch(i, p)}
                  onMove={(dir) => move(i, dir)}
                  onRemove={() => onChange(fields.filter((_, j) => j !== i))}
                />
              ))}
            </ol>
          )}
          <div className="flex gap-2">
            <Select aria-label="Tipo de campo nuevo" value={newType} onChange={(e) => setNewType(e.target.value)} className="h-9 flex-1">
              {FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </Select>
            <Button onClick={add} disabled={fields.length >= MAX_FIELDS}><Plus className="h-4 w-4" aria-hidden="true" /> Agregar campo</Button>
          </div>
        </div>
        <div className="self-start lg:sticky lg:top-20">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-adm-muted">Vista previa en /eventos</p>
          {/* Colores de la página pública a propósito: así se verá en ambos temas del panel. */}
          {/* Enter en la vista previa no debe enviar el formulario del evento. */}
          <div className="space-y-4 rounded-lg border border-adm-border bg-boreal-dark p-4 text-white" onKeyDown={(e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') e.preventDefault(); }}>
            {preview.length ? (
              <EventCustomFields idPrefix="preview" fields={preview} values={previewValues} onChange={(id, v) => setPreviewValues((p) => ({ ...p, [id]: v }))} />
            ) : (
              <p className="text-sm text-gray-400">Sin campos adicionales: el formulario solo pide los datos estándar.</p>
            )}
          </div>
        </div>
      </div>
    </fieldset>
  );
}
