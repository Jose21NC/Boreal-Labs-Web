// "Confirmar cupo" (mode='seat'): marca a los seleccionados y les envía el correo redactado.
// "Enviar correo" (mode='custom'): solo envía un correo personalizado. Ambos usan la Function sendSeatConfirmations.
import React, { useState } from 'react';
import { Button, Checkbox, Field, Modal, Select, useConfirm } from '@/admin/ui';
import { logActivity } from '@/admin/lib';
import { useToast } from '@/components/ui/use-toast';
import { callFunction, getCallableErrorMessage } from '../certificates/api';
import EmailComposer, { EMAIL_PRESETS } from './EmailComposer';

export default function SeatConfirmModal({ group, regs, onClose, onDone, mode = 'seat' }) {
  const isSeat = mode === 'seat';
  const { toast } = useToast();
  const confirm = useConfirm();
  const [value, setValue] = useState(() => {
    const p = EMAIL_PRESETS.find((x) => x.id === (isSeat ? 'cupo' : 'mensaje')) || EMAIL_PRESETS[0];
    return { subject: p.subject, body: p.body };
  });
  const [skipConfirmed, setSkipConfirmed] = useState(true);
  const [previewId, setPreviewId] = useState(regs[0]?.id);
  const [busy, setBusy] = useState(false);
  const already = isSeat ? regs.filter((r) => r.seatConfirmed) : [];
  const targets = isSeat && skipConfirmed ? regs.filter((r) => !r.seatConfirmed) : regs;
  const previewReg = regs.find((r) => r.id === previewId) || regs[0];

  const send = async () => {
    const n = targets.length;
    if (!(await confirm({ title: isSeat ? `¿Confirmar cupo y enviar ${n} correo${n === 1 ? '' : 's'}?` : `¿Enviar el correo a ${n} persona${n === 1 ? '' : 's'}?`, description: `Desde contacto@borealabs.org, para "${group.name}".`, confirmLabel: 'Enviar' }))) return;
    setBusy(true);
    try {
      const res = await callFunction('sendSeatConfirmations', { eventId: group.id, regIds: targets.map((r) => r.id), subject: value.subject, body: value.body, resend: !skipConfirmed, markSeat: isSeat });
      await logActivity(
        isSeat ? 'eventos.cupo_confirmado' : 'eventos.correo_enviado',
        isSeat ? `Confirmó ${res.confirmed} cupos en "${group.name}" (${res.sent} correos)` : `Envió "${value.subject}" a ${res.sent} inscritos de "${group.name}"`,
        { event: group.name, ...res, errors: res.errors?.length || 0 },
      );
      toast({
        title: isSeat ? `${res.confirmed} cupo(s) confirmados · ${res.sent} correo(s) enviados` : `${res.sent} correo(s) enviados`,
        description: [res.skipped && `${res.skipped} sin enviar (ya enviados o sin correo válido)`, res.errors?.length && `${res.errors.length} con error: ${res.errors[0].message}`].filter(Boolean).join(' · ') || undefined,
        variant: res.errors?.length ? 'destructive' : undefined,
      });
      onDone();
    } catch (e) {
      console.error(e);
      toast({ title: isSeat ? 'No se pudo confirmar el cupo' : 'No se pudo enviar el correo', description: getCallableErrorMessage(e), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={isSeat ? 'Confirmar cupo' : 'Enviar correo personalizado'}
      description={`${targets.length} destinatario${targets.length === 1 ? '' : 's'} · ${group.name}`}
      size="xl"
      footer={(
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={send} loading={busy} disabled={!targets.length || !value.subject.trim() || !value.body.trim()}>{isSeat ? 'Confirmar y enviar' : 'Enviar'} ({targets.length})</Button>
        </>
      )}
    >
      <div className="space-y-4">
        {already.length > 0 && (
          <div className="rounded-lg border border-adm-warning/40 bg-adm-warning/10 p-3 text-sm text-adm-text">
            <p>{already.length} ya tenía{already.length === 1 ? '' : 'n'} el cupo confirmado.</p>
            <Checkbox className="mt-2 flex" label="Omitirlos (no reenviar)" checked={skipConfirmed} onChange={(e) => setSkipConfirmed(e.target.checked)} />
          </div>
        )}
        {regs.length > 1 && (
          <Field label="Vista previa para">
            <Select value={previewReg?.id} onChange={(e) => setPreviewId(e.target.value)} className="h-9">
              {regs.map((r) => <option key={r.id} value={r.id}>{r.userName || r.userEmail}</option>)}
            </Select>
          </Field>
        )}
        <EmailComposer value={value} onChange={setValue} reg={previewReg} event={group.doc} />
      </div>
    </Modal>
  );
}
