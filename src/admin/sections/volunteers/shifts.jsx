// Visualizaciones de disponibilidad: chips compactos por día y matriz días × turnos.
import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DAYS, PERIODS, availabilityOf } from './utils';

const chipTone = (slot) => {
  if (slot.manana && slot.tarde) return 'bg-adm-success/15 text-adm-success border-adm-success/40';
  if (slot.manana) return 'bg-adm-warning/15 text-adm-warning border-adm-warning/40';
  if (slot.tarde) return 'bg-adm-info/15 text-adm-info border-adm-info/40';
  if (slot.personalizado) return 'bg-adm-accent/15 text-adm-accent border-adm-accent/40';
  return 'border-adm-border text-adm-muted/50';
};

const slotLabel = (slot) => [
  slot.manana && 'Mañana', slot.tarde && 'Tarde', slot.personalizado && 'Personalizado',
].filter(Boolean).join(' y ') || 'No disponible';

/** Siete chips (L M M J V S D) coloreados según el turno. */
export function DayChips({ volunteer }) {
  const map = availabilityOf(volunteer);
  const text = DAYS.map((d) => `${d.label}: ${slotLabel(map[d.key])}`).join('. ');
  return (
    <div className="flex gap-0.5" role="img" aria-label={text} title={text}>
      {DAYS.map((d) => (
        <span key={d.key} className={cn('flex h-5 w-5 items-center justify-center rounded border text-[10px] font-semibold', chipTone(map[d.key]))}>
          {d.label[0]}
        </span>
      ))}
    </div>
  );
}

export function ChipLegend() {
  const items = [
    ['Mañana', 'bg-adm-warning/15 border-adm-warning/40'],
    ['Tarde', 'bg-adm-info/15 border-adm-info/40'],
    ['Ambos', 'bg-adm-success/15 border-adm-success/40'],
    ['Personalizado', 'bg-adm-accent/15 border-adm-accent/40'],
  ];
  return (
    <div className="flex flex-wrap gap-3 text-xs text-adm-muted">
      {items.map(([label, cls]) => (
        <span key={label} className="inline-flex items-center gap-1.5"><span className={cn('h-3 w-3 rounded border', cls)} />{label}</span>
      ))}
    </div>
  );
}

/**
 * Matriz días × Mañana/Tarde/Personalizado. Con `onToggle` es editable (solo Mañana y Tarde:
 * los horarios personalizados los define el voluntario en el formulario).
 */
export function ShiftMatrix({ map, onToggle }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-adm-muted">
            <th className="py-1.5 pr-3 font-medium">Día</th>
            {PERIODS.map((p) => <th key={p.key} className="px-2 py-1.5 text-center font-medium">{p.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {DAYS.map((d) => (
            <tr key={d.key} className="border-t border-adm-border/60">
              <td className="py-1.5 pr-3 text-adm-text">{d.label}</td>
              {PERIODS.map((p) => {
                const on = map[d.key][p.key];
                const editable = onToggle && p.key !== 'personalizado';
                return (
                  <td key={p.key} className="px-2 py-1 text-center">
                    {editable ? (
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => onToggle(d, p)}
                        aria-label={`${d.label} ${p.label}`}
                        className="h-4 w-4 cursor-pointer accent-[rgb(var(--adm-accent))]"
                      />
                    ) : on ? (
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-adm-accent/15 text-adm-accent">
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                        <span className="sr-only">Disponible</span>
                      </span>
                    ) : (
                      <span className="text-adm-muted/50" aria-label="No disponible">·</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
