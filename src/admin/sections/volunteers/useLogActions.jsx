// Aprobar / rechazar / revertir registros de horas con confirmación y toasts. Lo usan Aprobaciones y el detalle.
import React, { useState } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { Button, Field, Modal, Textarea, useConfirm } from '@/admin/ui';
import { approveLogs, rejectLogs, revertLog } from './actions';
import { emailKey, logCredits, round2 } from './utils';

const QUICK_REASONS = ['La foto no sirve como evidencia', 'Las horas no coinciden', 'Registro duplicado', 'Actividad no reconocida'];

function RejectModal({ logs, onClose, onDone }) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const submit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) return;
    setSaving(true);
    try {
      const count = await rejectLogs(logs, reason.trim());
      toast({ title: 'Registro rechazado', description: count === 1 ? 'No se otorgaron créditos.' : `${count} registros rechazados sin créditos.` });
      onDone?.();
      onClose();
    } catch (error) {
      console.error(error);
      toast({ title: 'No se pudo rechazar', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };
  const subject = logs.length === 1 ? `${logs[0].fullName || logs[0].email} · ${logs[0].activityName || 'actividad'}` : `${logs.length} registros seleccionados`;
  return (
    <Modal
      open
      onClose={onClose}
      title="Rechazar horas"
      description={subject}
      size="sm"
      footer={(
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="danger" type="submit" form="reject-form" loading={saving} disabled={!reason.trim()}>Rechazar</Button>
        </>
      )}
    >
      <form id="reject-form" onSubmit={submit} className="space-y-3">
        <Field label="Motivo" hint="El equipo lo verá en el historial. No se otorgan créditos.">
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} required maxLength={500} />
        </Field>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_REASONS.map((r) => (
            <button key={r} type="button" onClick={() => setReason(r)} className="rounded-full border border-adm-border px-2.5 py-1 text-xs text-adm-muted hover:border-adm-accent hover:text-adm-text">
              {r}
            </button>
          ))}
        </div>
      </form>
    </Modal>
  );
}

export default function useLogActions(byEmail) {
  const { toast } = useToast();
  const confirm = useConfirm();
  const [rejecting, setRejecting] = useState(null); // { logs, onDone }
  const [busyIds, setBusyIds] = useState(() => new Set());

  const withBusy = async (logs, fn) => {
    const ids = logs.map((l) => l.id);
    setBusyIds((s) => new Set([...s, ...ids]));
    try { return await fn(); } finally {
      setBusyIds((s) => { const n = new Set(s); ids.forEach((id) => n.delete(id)); return n; });
    }
  };

  /** Aprueba sin preguntar si es uno; con varios, confirma mostrando el total de créditos. */
  const approve = async (logs) => {
    if (!logs.length) return false;
    if (logs.length > 1) {
      const total = round2(logs.reduce((acc, l) => acc + logCredits(l), 0));
      const ok = await confirm({
        title: `¿Aprobar ${logs.length} registros?`,
        description: `Se otorgarán ${total} crédito(s) en total. Puedes revertir cada uno después.`,
        confirmLabel: 'Aprobar',
      });
      if (!ok) return false;
    }
    try {
      const { approved, credits, skipped } = await withBusy(logs, () => approveLogs(logs, byEmail));
      // Un solo toast (el sistema muestra uno a la vez).
      const reasons = [...new Set(skipped.map((s) => s.reason))].join(', ');
      if (approved) {
        toast({
          title: approved === 1 ? 'Horas aprobadas' : `${approved} registros aprobados`,
          description: `${credits} crédito(s) otorgados.${skipped.length ? ` Omitidos ${skipped.length}: ${reasons}.` : ''}`,
        });
      } else {
        toast({ title: 'No se aprobó', description: reasons, variant: 'destructive' });
      }
      return approved > 0;
    } catch (error) {
      console.error(error);
      toast({ title: 'No se pudieron aprobar las horas', description: error.message, variant: 'destructive' });
      return false;
    }
  };

  const reject = (logs, onDone) => { if (logs.length) setRejecting({ logs, onDone }); };

  const revert = async (log) => {
    const volunteer = byEmail.get(emailKey(log.email));
    if (!volunteer) {
      toast({ title: 'Voluntario no encontrado', description: 'No hay inscripción con ese correo para descontar créditos.', variant: 'destructive' });
      return;
    }
    const ok = await confirm({
      title: 'Revertir aprobación',
      description: `Se descontarán ${round2(log.creditsAssigned ?? logCredits(log))} crédito(s) a ${log.fullName || log.email} y el registro vuelve a pendiente.`,
      confirmLabel: 'Revertir',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      const removed = await withBusy([log], () => revertLog(log, volunteer));
      toast({ title: removed ? 'Aprobación revertida' : 'Nada que revertir', description: removed ? `Se descontaron ${removed} crédito(s).` : 'El registro ya no estaba aprobado.' });
    } catch (error) {
      console.error(error);
      toast({ title: 'No se pudo revertir', description: error.message, variant: 'destructive' });
    }
  };

  const modal = rejecting ? <RejectModal logs={rejecting.logs} onDone={rejecting.onDone} onClose={() => setRejecting(null)} /> : null;
  return { approve, reject, revert, busyIds, modal };
}
