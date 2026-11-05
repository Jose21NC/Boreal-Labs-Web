// Piezas compartidas para mostrar un registro de horas: miniatura de evidencia, estado y visor.
import React from 'react';
import { safeUrl } from '@/lib/team';
import { Check, ExternalLink, ImageOff, X } from 'lucide-react';
import { Badge, Button, Modal } from '@/admin/ui';
import { formatDateTime } from '@/admin/lib';
import { creditsAsDuration, isAdjustmentLog, isEventLog, logCredits, logStatus } from './utils';

export function ProofThumb({ log, onOpen }) {
  if (!log.proofImageUrl) {
    return (
      <span className="flex h-11 w-11 items-center justify-center rounded-md border border-dashed border-adm-border text-adm-muted" title="Sin evidencia">
        <ImageOff className="h-4 w-4" aria-hidden="true" />
        <span className="sr-only">Sin evidencia</span>
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onOpen(log); }}
      className="block h-11 w-11 overflow-hidden rounded-md border border-adm-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-adm-accent"
      aria-label={`Ver evidencia de ${log.fullName || log.email}`}
    >
      <img src={log.proofImageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
    </button>
  );
}

export function SourceBadge({ log }) {
  if (isEventLog(log)) return <Badge tone="info" title={log.sourceEventName}>Evento</Badge>;
  if (isAdjustmentLog(log) || log.creditSourceType === 'admin') return <Badge tone="accent">Admin</Badge>;
  return <Badge>Formulario</Badge>;
}

/** Estado + quién/cuándo. */
export function StatusCell({ log }) {
  const status = logStatus(log);
  if (status === 'approved') {
    return (
      <div className="space-y-0.5">
        <Badge tone="success">Aprobado</Badge>
        <p className="text-[11px] text-adm-muted">{log.creditsAssignedBy || '—'} · {formatDateTime(log.creditsAssignedAt)}</p>
      </div>
    );
  }
  if (status === 'rejected') {
    return (
      <div className="max-w-[220px] space-y-0.5">
        <Badge tone="danger">Rechazado</Badge>
        <p className="truncate text-[11px] text-adm-muted" title={log.rejectionReason}>{log.rejectionReason || 'Sin motivo'}</p>
        <p className="text-[11px] text-adm-muted">{log.rejectedBy || '—'} · {formatDateTime(log.rejectedAt)}</p>
      </div>
    );
  }
  return <Badge tone="warning">Pendiente</Badge>;
}

/** Visor de evidencia con acciones para decidir sin salir de la foto. */
export function ProofViewer({ log, onClose, onApprove, onReject, busy }) {
  if (!log) return null;
  const pending = logStatus(log) === 'pending';
  const credits = logCredits(log);
  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title={`Evidencia · ${log.fullName || log.email}`}
      description={`${log.activityName || 'Actividad'} · ${log.attendanceDate || '—'} ${log.startTime || ''}–${log.endTime || ''} · ${log.registeredHours ?? 0} h → ${credits} crédito(s) (${creditsAsDuration(credits)})`}
      footer={(
        <>
          {safeUrl(log.proofImageUrl) && (
            <a href={safeUrl(log.proofImageUrl)} target="_blank" rel="noopener noreferrer" className="mr-auto inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm text-adm-muted hover:bg-adm-surface-2 hover:text-adm-text">
              <ExternalLink className="h-4 w-4" aria-hidden="true" /> Abrir original
            </a>
          )}
          {pending ? (
            <>
              <Button variant="danger-ghost" onClick={() => onReject(log)} disabled={busy}><X className="h-4 w-4" aria-hidden="true" /> Rechazar</Button>
              <Button variant="primary" onClick={() => onApprove(log)} loading={busy}><Check className="h-4 w-4" aria-hidden="true" /> Aprobar {credits} crédito(s)</Button>
            </>
          ) : (
            <Button onClick={onClose}>Cerrar</Button>
          )}
        </>
      )}
    >
      {log.proofImageUrl ? (
        <div className="flex max-h-[65vh] items-center justify-center overflow-auto rounded-lg bg-adm-surface-2 p-2">
          <img src={log.proofImageUrl} alt={`Evidencia de ${log.fullName || log.email}`} className="max-h-[62vh] w-auto rounded object-contain" />
        </div>
      ) : (
        <p className="py-10 text-center text-sm text-adm-muted">Este registro no tiene foto de evidencia.</p>
      )}
    </Modal>
  );
}
