// Resumen de cobertura: cuántos voluntarios hay por día y turno. Cada celda filtra la lista.
import React, { useMemo } from 'react';
import { CalendarClock } from 'lucide-react';
import { Card, CardBody, CardHeader, EmptyState, Skeleton } from '@/admin/ui';
import { cn } from '@/lib/utils';
import { DAYS, PERIODS, availabilityOf } from './utils';

// Clases literales para que Tailwind las genere.
const HEAT = ['bg-adm-surface-2/60', 'bg-adm-accent/10', 'bg-adm-accent/20', 'bg-adm-accent/35', 'bg-adm-accent/50'];

export default function AvailabilityTab({ volunteers, loading, onPick }) {
  const { counts, max, none } = useMemo(() => {
    const c = Object.fromEntries(DAYS.map((d) => [d.key, { manana: 0, tarde: 0, personalizado: 0, any: 0 }]));
    let empty = 0;
    volunteers.forEach((v) => {
      const map = availabilityOf(v);
      let hasAny = false;
      DAYS.forEach((d) => {
        const slot = map[d.key];
        PERIODS.forEach((p) => { if (slot[p.key]) c[d.key][p.key] += 1; });
        if (slot.manana || slot.tarde || slot.personalizado) { c[d.key].any += 1; hasAny = true; }
      });
      if (!hasAny) empty += 1;
    });
    const m = Math.max(1, ...DAYS.flatMap((d) => PERIODS.map((p) => c[d.key][p.key])));
    return { counts: c, max: m, none: empty };
  }, [volunteers]);

  if (loading) return <Skeleton className="h-80 w-full" />;
  if (!volunteers.length) return <Card><EmptyState icon={CalendarClock} title="Sin datos de disponibilidad" description="Aparecerá cuando haya voluntarios inscritos." /></Card>;

  const heat = (n) => HEAT[n === 0 ? 0 : Math.min(HEAT.length - 1, 1 + Math.floor(((n - 1) / max) * (HEAT.length - 1)))];

  return (
    <Card>
      <CardHeader
        title="Cobertura por turno"
        description={`Voluntarios disponibles por día y turno. Haz clic en una celda para ver quiénes son.${none ? ` ${none} sin horario registrado.` : ''}`}
      />
      <CardBody className="overflow-x-auto p-0 sm:p-5">
        <table className="w-full min-w-[420px] text-sm">
          <thead>
            <tr className="text-left text-xs text-adm-muted">
              <th className="px-3 py-2 font-medium">Día</th>
              {PERIODS.map((p) => (
                <th key={p.key} className="px-2 py-2 text-center font-medium">
                  {p.label}<span className="block text-[10px] font-normal">{p.hint}</span>
                </th>
              ))}
              <th className="px-2 py-2 text-center font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {DAYS.map((d) => (
              <tr key={d.key}>
                <th scope="row" className="px-3 py-1 text-left font-medium text-adm-text">{d.label}</th>
                {PERIODS.map((p) => {
                  const n = counts[d.key][p.key];
                  return (
                    <td key={p.key} className="p-1">
                      <button
                        type="button"
                        onClick={() => onPick(`${d.key}:${p.key}`)}
                        disabled={!n}
                        aria-label={`${d.label} ${p.label}: ${n} voluntario(s)`}
                        className={cn(
                          'h-11 w-full rounded-lg text-center text-base font-semibold tabular-nums text-adm-text transition',
                          'hover:ring-2 hover:ring-adm-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-adm-accent disabled:cursor-default disabled:text-adm-muted/60 disabled:hover:ring-0',
                          heat(n),
                        )}
                      >
                        {n}
                      </button>
                    </td>
                  );
                })}
                <td className="p-1">
                  <button
                    type="button"
                    onClick={() => onPick(d.key)}
                    disabled={!counts[d.key].any}
                    className="h-11 w-full rounded-lg text-center tabular-nums text-adm-muted hover:text-adm-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-adm-accent"
                    aria-label={`${d.label}: ${counts[d.key].any} voluntario(s) en cualquier turno`}
                  >
                    {counts[d.key].any}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardBody>
    </Card>
  );
}
