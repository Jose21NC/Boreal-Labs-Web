// Modales del detalle de voluntario: editar perfil, ajustar créditos y registrar horas a mano.
import React, { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Button, Field, Input, Modal, Textarea } from '@/admin/ui';
import { ShiftMatrix } from './shifts';
import { adjustCredits, recordHours, updateVolunteer } from './actions';
import { DAYS, PERIODS, availabilityOf, creditsAsDuration, hoursBetween, round2, shiftKey } from './utils';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function useSubmit(fn, { success, onClose }) {
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const submit = async (e) => {
    e?.preventDefault();
    setSaving(true);
    try {
      const done = await fn();
      if (done === false) return;
      toast(success);
      onClose();
    } catch (error) {
      console.error(error);
      toast({ title: 'No se pudo guardar', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };
  return [saving, submit];
}

const footer = (formId, saving, onClose, label = 'Guardar', disabled = false) => (
  <>
    <Button variant="ghost" onClick={onClose}>Cancelar</Button>
    <Button variant="primary" type="submit" form={formId} loading={saving} disabled={disabled}>{label}</Button>
  </>
);

export function EditVolunteerModal({ volunteer, onClose }) {
  const fields = ['fullName', 'email', 'whatsapp', 'edad', 'ciudad', 'procedencia', 'talla', 'comentariosAdicionales'];
  const [form, setForm] = useState(() => Object.fromEntries(fields.map((k) => [k, String(volunteer[k] ?? '')])));
  const [shifts, setShifts] = useState(() => availabilityOf(volunteer));
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const toggle = (day, period) => setShifts((m) => ({ ...m, [day.key]: { ...m[day.key], [period.key]: !m[day.key][period.key] } }));

  const [saving, submit] = useSubmit(async () => {
    const clean = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim()]));
    if (!clean.fullName) { setError('El nombre es obligatorio.'); return false; }
    if (!EMAIL_RE.test(clean.email)) { setError('Correo no válido.'); return false; }
    clean.email = clean.email.toLowerCase();
    // Conserva turnos que no son Mañana/Tarde (p. ej. "Lunes-Personalizado") y regenera el resto.
    const kept = (Array.isArray(volunteer.turnos) ? volunteer.turnos : []).filter((s) => {
      const one = availabilityOf({ turnos: [s] });
      return !DAYS.some((d) => one[d.key].manana || one[d.key].tarde);
    });
    const regular = DAYS.flatMap((d) => PERIODS.filter((p) => p.key !== 'personalizado' && shifts[d.key][p.key]).map((p) => shiftKey(d.label, p.label)));
    await updateVolunteer(volunteer, { ...clean, turnos: [...regular, ...kept] });
    return true;
  }, { success: { title: 'Perfil actualizado' }, onClose });

  const emailChanged = form.email.trim().toLowerCase() !== String(volunteer.email || '').toLowerCase();
  return (
    <Modal open onClose={onClose} title="Editar voluntario" size="lg" footer={footer('edit-volunteer', saving, onClose)}>
      <form id="edit-volunteer" onSubmit={submit} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nombre completo" className="sm:col-span-2"><Input value={form.fullName} onChange={set('fullName')} required maxLength={200} /></Field>
          <Field label="Correo" hint={emailChanged ? 'Sus registros de horas se vinculan por correo: cámbialo solo si estaba mal escrito.' : undefined}>
            <Input type="email" value={form.email} onChange={set('email')} required />
          </Field>
          <Field label="WhatsApp"><Input value={form.whatsapp} onChange={set('whatsapp')} maxLength={50} /></Field>
          <Field label="Edad"><Input value={form.edad} onChange={set('edad')} maxLength={10} /></Field>
          <Field label="Talla"><Input value={form.talla} onChange={set('talla')} maxLength={20} /></Field>
          <Field label="Ciudad"><Input value={form.ciudad} onChange={set('ciudad')} maxLength={100} /></Field>
          <Field label="Procedencia"><Input value={form.procedencia} onChange={set('procedencia')} maxLength={300} /></Field>
          <Field label="Comentarios" className="sm:col-span-2"><Textarea value={form.comentariosAdicionales} onChange={set('comentariosAdicionales')} maxLength={2000} /></Field>
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-adm-muted">Disponibilidad</p>
          <ShiftMatrix map={shifts} onToggle={toggle} />
        </div>
        {error && <p className="text-sm text-adm-danger" role="alert">{error}</p>}
      </form>
    </Modal>
  );
}

export function AdjustCreditsModal({ volunteer, onClose }) {
  const current = Number(volunteer.creditos) || 0;
  const [value, setValue] = useState(String(current));
  const [reason, setReason] = useState('');
  const next = Math.max(0, round2(Number(value)));
  const delta = round2(next - current);
  const step = (n) => setValue(String(Math.max(0, round2((Number(value) || 0) + n))));

  const [saving, submit] = useSubmit(() => adjustCredits(volunteer, delta, reason.trim()), {
    success: { title: 'Créditos actualizados', description: `${volunteer.fullName || volunteer.email}: ${current} → ${next}` },
    onClose,
  });

  return (
    <Modal open onClose={onClose} title="Ajustar créditos" description={volunteer.fullName || volunteer.email} size="sm" footer={footer('adjust-credits', saving, onClose, 'Guardar ajuste', !delta || !Number.isFinite(Number(value)))}>
      <form id="adjust-credits" onSubmit={submit} className="space-y-4">
        <div className="flex items-center justify-center gap-3">
          <Button size="icon" variant="outline" onClick={() => step(-1)} aria-label="Restar 1 crédito"><Minus className="h-4 w-4" /></Button>
          <Input
            type="number"
            min="0"
            step="0.5"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-label="Créditos"
            className="h-14 w-32 text-center text-3xl font-semibold tabular-nums"
          />
          <Button size="icon" variant="outline" onClick={() => step(1)} aria-label="Sumar 1 crédito"><Plus className="h-4 w-4" /></Button>
        </div>
        <p className="text-center text-xs text-adm-muted">
          Equivale a {creditsAsDuration(next)}.{' '}
          {delta !== 0 && <span className={delta > 0 ? 'text-adm-success' : 'text-adm-danger'}>{delta > 0 ? '+' : ''}{delta} respecto a {current}</span>}
        </p>
        <Field label="Motivo (opcional)" hint="Queda en la actividad del equipo.">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="p. ej. Corrección de registro duplicado" />
        </Field>
      </form>
    </Modal>
  );
}

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function RecordHoursModal({ volunteer, onClose }) {
  const [form, setForm] = useState({ activityName: '', attendanceDate: today(), startTime: '08:00', endTime: '12:00', hours: '4' });
  const set = (k) => (e) => setForm((f) => {
    const nextForm = { ...f, [k]: e.target.value };
    if (k === 'startTime' || k === 'endTime') nextForm.hours = String(hoursBetween(nextForm.startTime, nextForm.endTime));
    return nextForm;
  });
  const hours = round2(Number(form.hours));
  const credits = round2(hours / 2);
  const valid = form.activityName.trim() && form.attendanceDate && hours > 0;

  const [saving, submit] = useSubmit(
    () => recordHours(volunteer, { ...form, activityName: form.activityName.trim(), hours, credits }),
    { success: { title: 'Horas registradas', description: `${hours} h → ${credits} crédito(s) para ${volunteer.fullName || volunteer.email}` }, onClose },
  );

  return (
    <Modal
      open
      onClose={onClose}
      title="Registrar horas"
      description={`${volunteer.fullName || volunteer.email} · quedan aprobadas al guardar`}
      footer={footer('record-hours', saving, onClose, `Registrar ${credits} crédito(s)`, !valid)}
    >
      <form id="record-hours" onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <Field label="Actividad" className="sm:col-span-2"><Input value={form.activityName} onChange={set('activityName')} required maxLength={300} placeholder="p. ej. Logística de evento" /></Field>
        <Field label="Fecha"><Input type="date" value={form.attendanceDate} onChange={set('attendanceDate')} required /></Field>
        <Field label="Horas" hint="Se calcula con la hora de inicio y fin; puedes corregirla.">
          <Input type="number" min="0" step="0.25" value={form.hours} onChange={set('hours')} required />
        </Field>
        <Field label="Inicio"><Input type="time" value={form.startTime} onChange={set('startTime')} /></Field>
        <Field label="Fin"><Input type="time" value={form.endTime} onChange={set('endTime')} /></Field>
        <p className="rounded-lg bg-adm-surface-2 px-3 py-2 text-sm text-adm-muted sm:col-span-2">
          {hours} h = <strong className="text-adm-text">{credits} crédito(s)</strong> (1 crédito = 2 horas)
        </p>
      </form>
    </Modal>
  );
}
