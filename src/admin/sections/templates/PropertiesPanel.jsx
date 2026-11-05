// Panel de propiedades del campo seleccionado: posición, tamaño y tipografía (mapean a layout.json).
import React from 'react';
import { AlignCenter, AlignLeft, AlignRight, MousePointerClick } from 'lucide-react';
import { Button, Card, CardBody, CardHeader, EmptyState, Field, Input, Select, Switch, Label } from '@/admin/ui';
import { cn } from '@/lib/utils';
import { FIELDS, isBold } from './Stage';

const pct = (v) => Math.round(v * 1000) / 10;
// El motor solo distingue normal (< 700) y negrita (>= 700).
const WEIGHTS = [
  { value: 400, label: 'Normal' },
  { value: 700, label: 'Negrita' },
];
const ALIGNS = [
  { value: 'left', label: 'Izquierda', icon: AlignLeft },
  { value: 'center', label: 'Centro', icon: AlignCenter },
  { value: 'right', label: 'Derecha', icon: AlignRight },
];

function NumberField({ label, value, onChange, min, max, step = 0.1, suffix }) {
  return (
    <Field label={suffix ? `${label} (${suffix})` : label}>
      <Input
        type="number"
        inputMode="decimal"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (e.target.value !== '' && Number.isFinite(n)) onChange(n);
        }}
      />
    </Field>
  );
}

/** @param {{element: object, fieldKey: string, onRel: (rel) => void, onStyle: (style) => void}} props */
export default function PropertiesPanel({ element, fieldKey, onRel, onStyle }) {
  const field = FIELDS.find((f) => f.key === fieldKey);
  if (!field || !element) {
    return (
      <Card>
        <EmptyState icon={MousePointerClick} title="Selecciona un campo" description="Haz clic en una caja del lienzo o usa Tab para recorrerlas." className="py-10" />
      </Card>
    );
  }
  const { rel } = element;
  const style = element.style || {};
  const setRel = (patch) => onRel({ ...rel, ...patch });
  const setStyle = (patch) => onStyle({ ...style, ...patch });
  const italic = (style.fontStyle || '').includes('italic');
  const upper = (style.transform || '').toLowerCase() === 'uppercase';

  return (
    <Card>
      <CardHeader title={field.label} description={field.hint || 'Arrastra la caja o ajusta los valores.'} />
      <CardBody className="space-y-5">
        <section className="space-y-3" aria-label="Posición y tamaño">
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="X" suffix="%" value={pct(rel.x)} min={0} max={100} onChange={(v) => setRel({ x: Math.min(v / 100, 1 - rel.width) })} />
            <NumberField label="Y" suffix="%" value={pct(rel.y)} min={0} max={100} onChange={(v) => setRel({ y: Math.min(v / 100, 1 - rel.height) })} />
            <NumberField label="Ancho" suffix="%" value={pct(rel.width)} min={1} max={100} onChange={(v) => setRel({ width: Math.min(Math.max(v, 1) / 100, 1 - rel.x) })} />
            <NumberField label="Alto" suffix="%" value={pct(rel.height)} min={1} max={100} onChange={(v) => setRel({ height: Math.min(Math.max(v, 1) / 100, 1 - rel.y) })} />
          </div>
          <Button size="sm" variant="outline" className="w-full" onClick={() => setRel({ x: Math.round(((1 - rel.width) / 2) * 10000) / 10000 })}>
            Centrar horizontalmente
          </Button>
        </section>

        {!field.qr && (
          <section className="space-y-3 border-t border-adm-border pt-4" aria-label="Tipografía">
            <Field label="Fuente" hint="Libre Franklin se usa si sus TTF están en cert-templates/fonts/; si no, Helvetica.">
              <Select value={style.fontFamily || 'Libre Franklin'} onChange={(e) => setStyle({ fontFamily: e.target.value })}>
                <option value="Libre Franklin">Libre Franklin</option>
                <option value="Helvetica">Helvetica</option>
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <NumberField label="Tamaño" suffix="px" step={1} min={4} max={300} value={style.fontSizePx || 20} onChange={(v) => setStyle({ fontSizePx: Math.max(1, v) })} />
              <Field label="Peso">
                <Select value={isBold(style.fontWeight) ? 700 : 400} onChange={(e) => setStyle({ fontWeight: Number(e.target.value) })}>
                  {WEIGHTS.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
                </Select>
              </Field>
            </div>
            <div className="space-y-1.5">
              <Label>Alineación</Label>
              <div role="radiogroup" aria-label="Alineación" className="grid grid-cols-3 gap-1 rounded-lg border border-adm-border bg-adm-surface-2 p-0.5">
                {ALIGNS.map(({ value, label, icon: Icon }) => {
                  const active = (style.textAlign || 'left') === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      aria-label={label}
                      title={label}
                      onClick={() => setStyle({ textAlign: value })}
                      className={cn('flex h-8 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-adm-accent', active ? 'bg-adm-surface text-adm-text shadow-sm' : 'text-adm-muted hover:text-adm-text')}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
            </div>
            <Field label="Color">
              <div className="flex gap-2">
                <input
                  type="color"
                  aria-label="Selector de color"
                  value={/^#[0-9a-f]{6}$/i.test(style.color || '') ? style.color : '#000000'}
                  onChange={(e) => setStyle({ color: e.target.value })}
                  className="h-10 w-12 cursor-pointer rounded-lg border border-adm-border bg-adm-surface p-1"
                />
                <Input value={style.color || '#000000'} onChange={(e) => setStyle({ color: e.target.value })} aria-label="Color hexadecimal" className="font-mono" />
              </div>
            </Field>
            <NumberField label="Espaciado entre letras" suffix="px" step={0.5} value={parseFloat(String(style.tracking || 0)) || 0} onChange={(v) => setStyle({ tracking: `${v}px` })} />
            <div className="space-y-3 pt-1">
              <ToggleRow label="Cursiva" checked={italic} onChange={(v) => setStyle({ fontStyle: v ? 'italic' : 'normal' })} />
              <ToggleRow label="Mayúsculas" checked={upper} onChange={(v) => setStyle({ transform: v ? 'uppercase' : 'none' })} />
              <ToggleRow label="Reducir si no cabe" hint="Achica la letra para textos largos en vez de salirse de la caja." checked={style.autoFit !== false} onChange={(v) => setStyle({ autoFit: v })} />
            </div>
          </section>
        )}
      </CardBody>
    </Card>
  );
}

function ToggleRow({ label, hint, checked, onChange }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-sm text-adm-text">{label}</p>
        {hint && <p className="text-xs text-adm-muted">{hint}</p>}
      </div>
      <Switch label={label} checked={checked} onChange={onChange} />
    </div>
  );
}
