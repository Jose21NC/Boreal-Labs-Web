// Sección Accesos (solo superadmins): gestiona la colección isAdmin/{correo}.
import React, { useEffect, useMemo, useState } from 'react';
import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { KeyRound, Pencil, Plus, Trash2 } from 'lucide-react';
import { db } from '@/firebase';
import { BASE_ADMINS, SECTIONS, SUPER_ADMINS, useAccess } from '@/admin/access';
import { formatDate, logActivity } from '@/admin/lib';
import {
  Badge, Button, Card, CardBody, CardHeader, Checkbox, EmptyState, Field, Input, Modal, PageHeader,
  Skeleton, Switch, Table, TD, TH, THead, TR, useDangerConfirm,
} from '@/admin/ui';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const labelOf = (key) => SECTIONS.find((s) => s.key === key)?.label || key;

function PermBadges({ permissions }) {
  if (permissions === 'all' || permissions === undefined) return <Badge tone="accent">Todo el panel</Badge>;
  if (!permissions.length) return <span className="text-xs text-adm-muted">Solo el Resumen</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {permissions.map((k) => <Badge key={k}>{labelOf(k)}</Badge>)}
    </div>
  );
}

function AccessModal({ item, existing, onClose, onSave }) {
  const [email, setEmail] = useState(item?.email || '');
  const [all, setAll] = useState(item ? item.permissions === 'all' : true);
  const [keys, setKeys] = useState(Array.isArray(item?.permissions) ? item.permissions : []);
  const [saving, setSaving] = useState(false);
  const clean = email.trim().toLowerCase();
  let error = '';
  if (!item && clean) {
    if (!EMAIL_RE.test(clean)) error = 'Correo no válido.';
    else if (BASE_ADMINS.includes(clean)) error = 'Ya es administrador base.';
    else if (existing.includes(clean)) error = 'Ese correo ya tiene acceso.';
  }
  const toggle = (k) => setKeys((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]));
  const canSave = !error && (item || clean) && (all || keys.length > 0);

  const submit = async () => {
    setSaving(true);
    try {
      await onSave({ email: clean, permissions: all ? 'all' : SECTIONS.map((s) => s.key).filter((k) => keys.includes(k)) }, !!item);
      onClose();
    } finally { setSaving(false); }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={item ? 'Editar permisos' : 'Agregar correo'}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" loading={saving} disabled={!canSave} onClick={submit}>{item ? 'Guardar' : 'Agregar'}</Button>
      </>}
    >
      <div className="space-y-4">
        <Field label="Correo" error={error}>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={!!item} placeholder="persona@ejemplo.com" />
        </Field>
        <div className="space-y-2">
          <Checkbox checked={all} onChange={(e) => setAll(e.target.checked)} label="Todo el panel" />
          {!all && (
            <div className="grid gap-2 rounded-lg border border-adm-border bg-adm-surface-2/40 p-3 sm:grid-cols-2">
              {SECTIONS.map((s) => (
                <Checkbox key={s.key} checked={keys.includes(s.key)} onChange={() => toggle(s.key)} label={s.label} />
              ))}
            </div>
          )}
          {!all && !keys.length && <p className="text-xs text-adm-muted">Elige al menos una sección.</p>}
        </div>
      </div>
    </Modal>
  );
}

export default function Access() {
  const { email: me } = useAccess();
  const confirmDanger = useDangerConfirm();
  const [rows, setRows] = useState(null);
  const [modal, setModal] = useState(null); // null | 'new' | doc
  const [error, setError] = useState('');

  useEffect(() => {
    if (!db) { setRows([]); return undefined; }
    return onSnapshot(
      collection(db, 'isAdmin'),
      (snap) => setRows(snap.docs.map((d) => ({ ...d.data(), email: (d.data().email || d.id).toLowerCase(), id: d.id }))),
      (e) => { console.warn(e); setError('No se pudo leer la lista de accesos.'); setRows([]); },
    );
  }, []);

  const sorted = useMemo(() => (rows || []).slice().sort((a, b) => a.email.localeCompare(b.email)), [rows]);

  const run = async (fn) => {
    setError('');
    try { await fn(); } catch (e) { console.warn(e); setError('No se pudo guardar el cambio. Revisa tu conexión o permisos.'); }
  };

  const save = ({ email, permissions }, isEdit) => run(async () => {
    if (isEdit) {
      await updateDoc(doc(db, 'isAdmin', email), { permissions, updatedAt: serverTimestamp() });
      logActivity('accesos.editar', `Cambió los permisos de ${email}`, { email, permissions });
    } else {
      await setDoc(doc(db, 'isAdmin', email), { email, active: true, permissions, addedBy: me, addedAt: serverTimestamp() });
      logActivity('accesos.agregar', `Dio acceso al panel a ${email}`, { email, permissions });
    }
  });

  const setActive = (r, active) => run(async () => {
    await updateDoc(doc(db, 'isAdmin', r.id), { active, updatedAt: serverTimestamp() });
    logActivity(active ? 'accesos.activar' : 'accesos.desactivar', `${active ? 'Activó' : 'Desactivó'} el acceso de ${r.email}`, { email: r.email });
  });

  const remove = async (r) => {
    const ok = await confirmDanger({
      title: `Quitar acceso a ${r.email}`,
      description: 'Esta persona dejará de poder entrar al panel (y a la Wallet si usa este mismo registro).',
      phrase: r.email,
    });
    if (!ok) return;
    run(async () => {
      await deleteDoc(doc(db, 'isAdmin', r.id));
      logActivity('accesos.eliminar', `Quitó el acceso de ${r.email}`, { email: r.email });
    });
  };

  return (
    <>
      <PageHeader
        title="Accesos"
        description="Quién puede entrar al panel y qué secciones ve."
        actions={<Button variant="primary" onClick={() => setModal('new')} disabled={!db}><Plus className="h-4 w-4" />Agregar correo</Button>}
      />
      <div className="space-y-6">
        <p className="rounded-lg border border-adm-border bg-adm-surface-2/50 px-4 py-3 text-sm text-adm-muted">
          Las personas agregadas inician sesión con Google (o con correo y contraseña si su cuenta ya existe en Firebase Auth).
          Los permisos por sección solo filtran lo que ven en el panel: el acceso a los datos en Firestore es el mismo para todos los administradores.
        </p>
        {error && <p role="alert" className="text-sm text-adm-danger">{error}</p>}

        <Card>
          <CardHeader title="Administradores base" description="Definidos en el código; no se pueden editar aquí." />
          <ul className="divide-y divide-adm-border/70">
            {BASE_ADMINS.map((e) => (
              <li key={e} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                <span className="min-w-0 break-all text-sm text-adm-text">{e}</span>
                <span className="flex flex-wrap gap-1.5">
                  {SUPER_ADMINS.includes(e) && <Badge tone="accent">Superadmin</Badge>}
                  <Badge>Base · acceso total</Badge>
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Accesos agregados" description="Colección isAdmin (compartida con la Wallet)." />
          {rows === null ? (
            <CardBody className="space-y-2"><Skeleton className="h-10" /><Skeleton className="h-10" /></CardBody>
          ) : !db ? (
            <EmptyState icon={KeyRound} title="Firebase no configurado" />
          ) : !sorted.length ? (
            <EmptyState icon={KeyRound} title="Sin accesos agregados" description="Agrega un correo para dar acceso al panel." />
          ) : (
            <Table>
              <THead><tr><TH>Correo</TH><TH>Permisos</TH><TH>Agregado</TH><TH>Activo</TH><TH className="text-right">Acciones</TH></tr></THead>
              <tbody>
                {sorted.map((r) => {
                  const active = r.active !== false;
                  return (
                    <TR key={r.id}>
                      <TD className="min-w-[12rem] break-all font-medium">{r.email}</TD>
                      <TD><PermBadges permissions={r.permissions} /></TD>
                      <TD className="whitespace-nowrap text-xs text-adm-muted">
                        {r.addedAt ? formatDate(r.addedAt) : '—'}{r.addedBy ? ` · ${r.addedBy}` : ''}
                        {r.updatedAt && <div>Editado {formatDate(r.updatedAt)}</div>}
                      </TD>
                      <TD><Switch checked={active} onChange={(v) => setActive(r, v)} label={`Acceso de ${r.email}`} /></TD>
                      <TD>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" aria-label={`Editar ${r.email}`} onClick={() => setModal(r)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" aria-label={`Quitar ${r.email}`} onClick={() => remove(r)}><Trash2 className="h-4 w-4 text-adm-danger" /></Button>
                        </div>
                      </TD>
                    </TR>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card>
      </div>
      {modal && (
        <AccessModal
          key={modal === 'new' ? 'new' : modal.id}
          item={modal === 'new' ? null : modal}
          existing={sorted.map((r) => r.email)}
          onClose={() => setModal(null)}
          onSave={save}
        />
      )}
    </>
  );
}
