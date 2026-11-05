// Ajuste manual de puntos: suma/resta con nota obligatoria. Escribe el saldo y el registro
// en userPoints/{id}/adminGrants en un solo batch para que nunca queden desalineados.
import React, { useEffect, useState } from 'react';
import { collection, doc, increment, serverTimestamp, writeBatch } from 'firebase/firestore';
import { auth, db } from '@/firebase';
import { useToast } from '@/components/ui/use-toast';
import { Button, Field, Input, Modal, Textarea } from '@/admin/ui';
import { logActivity } from '@/admin/lib';
import { cn } from '@/lib/utils';
import { isWalletUid } from './wallet';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AdjustDialog({ open, user, users, onClose }) {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [sign, setSign] = useState(1);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEmail(user?.email || '');
    setSign(1);
    setAmount('');
    setNote('');
    setTouched(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reiniciar solo al abrir o cambiar de usuario, no en cada snapshot
  }, [open, user?.id]);

  const cleanEmail = email.trim().toLowerCase();
  const target = user || users.find((u) => String(u.email || '').toLowerCase() === cleanEmail) || null;
  const value = Number.parseInt(amount, 10);
  const delta = Number.isFinite(value) ? sign * value : 0;
  const current = Number(target?.balance) || 0;
  const next = current + delta;

  const errors = {
    email: !EMAIL_RE.test(cleanEmail) ? 'Correo inválido.' : '',
    amount: !Number.isFinite(value) || value <= 0 || String(value) !== amount.trim() ? 'Ingresa un número entero mayor a 0.' : next < 0 ? `El saldo quedaría negativo (${next}).` : '',
    note: note.trim().length < 3 ? 'La nota es obligatoria: explica el motivo del ajuste.' : '',
  };
  const invalid = Object.values(errors).some(Boolean);
  const shown = touched ? errors : {};

  const submit = async (e) => {
    e.preventDefault();
    setTouched(true);
    if (invalid || !db) return;
    setSaving(true);
    try {
      const grantedBy = auth?.currentUser?.email || auth?.currentUser?.uid || 'admin';
      const batch = writeBatch(db);
      const userRef = target ? doc(db, 'userPoints', target.id) : doc(collection(db, 'userPoints'));
      if (target) {
        batch.update(userRef, { balance: increment(delta), updatedAt: serverTimestamp() });
      } else {
        batch.set(userRef, { email: cleanEmail, balance: delta, updatedAt: serverTimestamp() });
      }
      batch.set(doc(collection(userRef, 'adminGrants')), {
        amount: delta,
        email: cleanEmail,
        grantedAt: serverTimestamp(),
        grantedBy,
        note: note.trim(),
        type: 'manual-adjustment',
      });
      await batch.commit();
      const verb = delta > 0 ? `Sumó ${delta}` : `Restó ${-delta}`;
      logActivity('puntos.ajuste', `${verb} puntos a ${cleanEmail}: ${note.trim()}`, { userId: userRef.id, amount: delta });
      toast({ title: 'Puntos actualizados', description: `${cleanEmail}: ${current} → ${next}` });
      onClose();
    } catch (error) {
      console.error('Error ajustando puntos:', error);
      toast({ title: 'No se pudo ajustar', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Ajustar puntos"
      description={user ? user.email : 'Si el correo no tiene saldo, se crea con el ajuste.'}
      footer={(
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" form="adjust-points" variant="primary" loading={saving} disabled={touched && invalid}>
            {delta < 0 ? 'Restar puntos' : 'Sumar puntos'}
          </Button>
        </>
      )}
    >
      <form id="adjust-points" onSubmit={submit} className="space-y-4" noValidate>
        {!user && (
          <Field label="Correo" error={shown.email}>
            <Input type="email" list="points-emails" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="persona@correo.com" autoComplete="off" />
          </Field>
        )}
        <datalist id="points-emails">{users.slice(0, 500).map((u) => <option key={u.id} value={u.email} />)}</datalist>

        <div className="grid grid-cols-[auto_1fr] items-end gap-3">
          <div role="radiogroup" aria-label="Tipo de ajuste" className="flex h-10 rounded-lg border border-adm-border p-0.5">
            {[[1, 'Sumar'], [-1, 'Restar']].map(([s, label]) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={sign === s}
                onClick={() => setSign(s)}
                className={cn(
                  'rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-adm-accent',
                  sign === s ? (s > 0 ? 'bg-adm-success/15 text-adm-success' : 'bg-adm-danger/15 text-adm-danger') : 'text-adm-muted hover:text-adm-text',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <Field label="Cantidad" error={shown.amount}>
            <Input type="number" min={1} step={1} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="10" />
          </Field>
        </div>

        <Field label="Nota (obligatoria)" error={shown.note} hint="Queda en el historial del usuario y en la bitácora.">
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej.: Corrección por asistencia al taller de IA" maxLength={300} />
        </Field>

        <div className="rounded-lg border border-adm-border bg-adm-surface-2/60 px-3 py-2 text-sm" aria-live="polite">
          Saldo: <span className="tabular-nums">{current}</span> → <strong className={cn('tabular-nums', next < 0 && 'text-adm-danger')}>{next}</strong>
          {!target && cleanEmail && EMAIL_RE.test(cleanEmail) && <span className="ml-2 text-xs text-adm-muted">(usuario nuevo)</span>}
          {(!target || !isWalletUid(target.id)) && EMAIL_RE.test(cleanEmail) && (
            <p className="mt-1 text-xs text-adm-warning">Sin cuenta Wallet: la app no mostrará estos puntos hasta que la persona inicie sesión.</p>
          )}
        </div>
      </form>
    </Modal>
  );
}
