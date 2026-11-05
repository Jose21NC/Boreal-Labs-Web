import React from 'react';
import { cn } from '@/lib/utils';

/** Inscritos vs cupo. Sin cupo solo muestra el número. */
export default function CapacityBar({ total, capacity }) {
  if (capacity == null) return <span className="tabular-nums">{total} <span className="text-xs text-adm-muted">· sin límite</span></span>;
  const pct = capacity > 0 ? Math.min(100, Math.round((total / capacity) * 100)) : 100;
  const tone = pct >= 100 ? 'bg-adm-danger' : pct >= 80 ? 'bg-adm-warning' : 'bg-adm-accent';
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-sm tabular-nums">
        <span>{total} <span className="text-adm-muted">/ {capacity}</span></span>
        <span className="text-xs text-adm-muted">{pct}%</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-adm-surface-2" role="progressbar" aria-valuemin={0} aria-valuemax={capacity} aria-valuenow={total} aria-label="Cupo ocupado">
        <div className={cn('h-full rounded-full', tone)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
