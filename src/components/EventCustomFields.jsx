// Campos del formulario de inscripción (estilo oscuro de /eventos).
// Lo usan EventsPage (también para los campos estándar) y la vista previa del editor de eventos del admin.
import React, { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, ImagePlus, X } from 'lucide-react';

export const inputCls = 'min-h-[44px] w-full rounded-xl border bg-white/[0.04] px-3.5 py-2.5 text-white placeholder:text-gray-500 transition-colors focus:outline-none focus:ring-2 focus:ring-boreal-aqua/60 focus:border-boreal-aqua/60 disabled:opacity-60 aria-[invalid=true]:border-red-400/70 border-white/10';
const optionCls = (on) => `flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2.5 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-boreal-aqua/60 ${on ? 'border-boreal-aqua/70 bg-boreal-aqua/10 text-white' : 'border-white/10 bg-white/[0.03] text-gray-300 hover:border-white/25'}`;
const INPUT_TYPES = { text: 'text', number: 'number', date: 'date', email: 'email', phone: 'tel', url: 'url' };

const Req = () => <span className="text-boreal-aqua" aria-hidden="true"> *</span>;

/** Etiqueta + control + ayuda + error en línea. `children(ariaProps)` recibe aria-invalid/aria-describedby. */
export function FieldShell({ id, label, required, help, error, group, extra, children }) {
  const helpId = help ? `${id}-help` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const describedBy = [helpId, errId].filter(Boolean).join(' ') || undefined;
  const aria = { 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy, 'aria-required': required || undefined };
  const Wrap = group ? 'fieldset' : 'div';
  const Label = group ? 'legend' : 'label';
  return (
    <Wrap className="space-y-2" {...(group ? aria : {})}>
      {label && (
        <Label {...(group ? {} : { htmlFor: id })} className="flex w-full items-baseline justify-between gap-2 text-sm font-medium text-gray-200">
          <span>{label}{required && <Req />}</span>{extra}
        </Label>
      )}
      {children(group ? {} : aria)}
      {help && <p id={helpId} className="text-xs text-gray-400">{help}</p>}
      {error && <p id={errId} className="text-xs text-red-300">{error}</p>}
    </Wrap>
  );
}

/** Opciones como tarjetas (radio = una, multi = varias). */
export function OptionCards({ name, options, value, multi, onChange, disabled, columns = true }) {
  const list = multi ? (Array.isArray(value) ? value : []) : value;
  return (
    <div className={`grid gap-2 ${columns ? 'sm:grid-cols-2' : ''}`}>
      {options.map((o) => {
        const opt = typeof o === 'string' ? { value: o, label: o } : o;
        const on = multi ? list.includes(opt.value) : list === opt.value;
        return (
          <label key={opt.value} className={optionCls(on)}>
            <input
              type={multi ? 'checkbox' : 'radio'}
              name={name}
              className="sr-only"
              disabled={disabled}
              checked={on}
              onChange={() => onChange(multi ? (on ? list.filter((x) => x !== opt.value) : [...list, opt.value]) : opt.value)}
            />
            <span aria-hidden="true" className={`flex h-5 w-5 shrink-0 items-center justify-center border ${multi ? 'rounded-md' : 'rounded-full'} ${on ? 'border-boreal-aqua bg-boreal-aqua text-boreal-dark' : 'border-white/30'}`}>
              {on && (multi ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <span className="h-2 w-2 rounded-full bg-boreal-dark" />)}
            </span>
            <span className="min-w-0">{opt.label}</span>
          </label>
        );
      })}
    </div>
  );
}

export function SelectInput({ options, value, onChange, ...rest }) {
  return (
    <div className="relative">
      <select {...rest} value={value || ''} onChange={(e) => onChange(e.target.value)} className={`${inputCls} appearance-none pr-10`}>
        <option value="">Selecciona una opción</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
    </div>
  );
}

function ImageDrop({ id, value, onChange, disabled, aria }) {
  const [over, setOver] = useState(false);
  const file = value instanceof Blob ? value : null;
  const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  const pick = (f) => { if (f) onChange(f); };
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); if (!disabled) pick(e.dataTransfer.files?.[0]); }}
      className={`relative flex items-center gap-3 rounded-xl border border-dashed p-3 transition-colors focus-within:ring-2 focus-within:ring-boreal-aqua/60 ${over ? 'border-boreal-aqua bg-boreal-aqua/10' : 'border-white/20 bg-white/[0.03]'}`}
    >
      {url ? <img src={url} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" /> : (
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-white/5 text-gray-400"><ImagePlus className="h-6 w-6" aria-hidden="true" /></span>
      )}
      <div className="min-w-0 flex-1 text-sm">
        <p className="truncate text-gray-200">{file ? file.name : 'Arrastra una imagen o elige un archivo'}</p>
        <label htmlFor={id} className="mt-1 inline-flex min-h-[44px] cursor-pointer items-center font-medium text-boreal-aqua hover:underline">
          {file ? 'Reemplazar' : 'Elegir imagen'}
        </label>
        <input {...aria} id={id} type="file" accept="image/*" disabled={disabled} className="sr-only" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
      </div>
      {file && (
        <button type="button" onClick={() => onChange(null)} disabled={disabled} aria-label="Quitar imagen" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-boreal-aqua/60">
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

function FieldControl({ field, value, onChange, disabled, id, aria }) {
  const common = { id, disabled, ...aria };
  switch (field.type) {
    case 'textarea':
      return <textarea {...common} rows={3} value={value || ''} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} className={inputCls} maxLength={2000} />;
    case 'select':
      return <SelectInput {...common} options={field.options || []} value={value} onChange={onChange} />;
    case 'image':
      return <ImageDrop id={id} value={value} onChange={onChange} disabled={disabled} aria={aria} />;
    default:
      return (
        <input
          {...common}
          type={INPUT_TYPES[field.type] || 'text'}
          inputMode={field.type === 'phone' ? 'tel' : undefined}
          value={value ?? ''}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={inputCls}
          maxLength={field.type === 'number' || field.type === 'date' ? undefined : 500}
        />
      );
  }
}

/** `values` = { [fieldId]: valor }; `onChange(id, valor)`; `errors` = { [fieldId]: mensaje } (opcional). */
export default function EventCustomFields({ fields, values, onChange, disabled, errors = {}, idPrefix = 'reg-extra' }) {
  return (fields || []).map((field) => {
    const id = `${idPrefix}-${field.id}`;
    const value = values[field.id];
    const set = (v) => onChange(field.id, v);
    const error = errors[field.id];
    const help = field.type === 'image' ? [field.help, 'Máx. 5 MB.'].filter(Boolean).join(' · ') : field.help;
    const options = field.options || [];

    if (field.type === 'checkbox') {
      return (
        <FieldShell key={field.id} id={id} help={help} error={error}>
          {(aria) => (
            <label className={optionCls(value === true)}>
              <input {...aria} id={id} type="checkbox" role="switch" className="peer sr-only" disabled={disabled} checked={value === true} onChange={(e) => set(e.target.checked)} />
              <span aria-hidden="true" className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${value === true ? 'bg-boreal-aqua' : 'bg-white/20'}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform motion-reduce:transition-none ${value === true ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
              </span>
              <span>{field.label}{field.required && <Req />}</span>
            </label>
          )}
        </FieldShell>
      );
    }

    // Opción única con pocas opciones (o "botones") y selección múltiple: tarjetas.
    const cards = field.type === 'radio' || field.type === 'multiselect' || (field.type === 'select' && options.length <= 5);
    if (cards) {
      const multi = field.type === 'multiselect';
      const count = multi ? (Array.isArray(value) ? value.length : 0) : 0;
      const extra = multi && field.maxSelections
        ? <span className={`text-xs tabular-nums ${count > field.maxSelections ? 'text-red-300' : 'text-gray-400'}`}>{count}/{field.maxSelections}</span>
        : null;
      return (
        <FieldShell key={field.id} id={id} group label={field.label} required={field.required} help={help} error={error} extra={extra}>
          {() => <OptionCards name={id} options={options} value={value} multi={multi} onChange={set} disabled={disabled} />}
        </FieldShell>
      );
    }

    return (
      <FieldShell key={field.id} id={id} label={field.label} required={field.required} help={help} error={error}>
        {(aria) => <FieldControl field={field} value={value} onChange={set} disabled={disabled} id={id} aria={aria} />}
      </FieldShell>
    );
  });
}
