// Enlaces de perfil (teamInvites/{token}): generar, compartir (copiar, WhatsApp, QR), listar y revocar.
import React, { useEffect, useMemo, useState } from 'react';
import { Copy, Link2, MessageCircle, Plus } from 'lucide-react';
import { Timestamp, collection, doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/firebase';
import { useToast } from '@/components/ui/use-toast';
import { TEAM_TAG_OPTIONS, inviteUrl, normalizeSection, normalizeTag } from '@/lib/team';
import {
  Badge, Button, Card, EmptyState, Field, Modal, Select, Skeleton, TD, TH, THead, TR, Table, useConfirm,
} from '@/admin/ui';
import { formatDateTime, logActivity, toDate } from '@/admin/lib';
import { newInviteToken } from './utils';

const DAY = 24 * 60 * 60 * 1000;
export const sectionLabel = (s) => (normalizeSection({ teamSection: s }) === 'DIRECTIVA' ? 'Directiva' : 'Staff');

export const inviteStatus = (inv) => {
  if (inv.active === false) return inv.usedAt ? 'used' : 'revoked';
  if ((toDate(inv.expiresAt)?.getTime() || 0) < Date.now()) return 'expired';
  return 'active';
};
const STATUS = { active: ['Activo', 'success'], used: ['Usado', 'info'], revoked: ['Revocado', 'neutral'], expired: ['Vencido', 'warning'] };

async function copy(text, toast) {
  try {
    await navigator.clipboard.writeText(text);
    toast({ title: 'Enlace copiado' });
  } catch {
    toast({ title: 'No se pudo copiar', description: text, variant: 'destructive' });
  }
}

/** Muestra el enlace con copiar, WhatsApp y QR. */
export function LinkModal({ invite, onClose }) {
  const { toast } = useToast();
  const [qr, setQr] = useState('');
  const url = invite ? inviteUrl(invite.id) : '';
  useEffect(() => {
    setQr('');
    if (!url) return;
    // qrcode es pesado: se carga solo al abrir el modal.
    import('qrcode').then((m) => m.default.toDataURL(url, { width: 280, margin: 2 })).then(setQr).catch(() => {});
  }, [url]);
  const text = invite?.mode === 'edit' ? 'Actualiza tu perfil del equipo de Boreal Labs' : 'Completa tu perfil del equipo de Boreal Labs';
  return (
    <Modal
      open={!!invite}
      onClose={onClose}
      title="Enlace de perfil"
      description={invite ? `${invite.mode === 'edit' ? 'Edición' : 'Nuevo perfil'} · ${sectionLabel(invite.teamSection)} · ${invite.teamTag} · vence ${formatDateTime(invite.expiresAt)}` : ''}
      footer={<Button variant="primary" onClick={onClose}>Listo</Button>}
    >
      <div className="space-y-4">
        <div className="flex gap-2">
          <input readOnly value={url} onFocus={(e) => e.target.select()} aria-label="Enlace" className="min-w-0 flex-1 rounded-lg border border-adm-border bg-adm-surface-2 px-3 py-2 text-sm text-adm-text" />
          <Button onClick={() => copy(url, toast)}><Copy className="h-4 w-4" />Copiar</Button>
        </div>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(`${text}: ${url}`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm font-semibold text-adm-accent hover:underline"
        >
          <MessageCircle className="h-4 w-4" />Compartir por WhatsApp
        </a>
        {/* Fondo blanco fijo a propósito: un QR necesita contraste en ambos temas. */}
        <div className="flex justify-center rounded-xl bg-white p-3">
          {qr ? <img src={qr} alt="Código QR del enlace" className="h-56 w-56" /> : <Skeleton className="h-56 w-56" />}
        </div>
        <p className="text-xs text-adm-muted">Quien tenga el enlace puede enviar un perfil; queda pendiente hasta que se apruebe.</p>
      </div>
    </Modal>
  );
}

/** Crea una invitación. Con `member` es de edición y hereda grupo/etiqueta del integrante. */
export function GenerateLinkModal({ open, member, onClose, onCreated }) {
  const { toast } = useToast();
  const [section, setSection] = useState('STAFF');
  const [tag, setTag] = useState(TEAM_TAG_OPTIONS[0]);
  const [days, setDays] = useState(14);
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!db) return;
    setBusy(true);
    const id = newInviteToken();
    const data = {
      mode: member ? 'edit' : 'create',
      memberId: member?.id || null,
      teamSection: member ? normalizeSection(member) : section,
      teamTag: member ? normalizeTag(member) : tag,
      active: true,
      expiresAt: Timestamp.fromMillis(Date.now() + days * DAY),
      createdBy: auth?.currentUser?.email || null,
      createdAt: serverTimestamp(),
      ...(member ? { memberName: member.name || '' } : {}),
    };
    try {
      await setDoc(doc(db, 'teamInvites', id), data);
      logActivity('equipo.enlace', member ? `Generó un enlace de edición para ${member.name}` : `Generó un enlace de nuevo perfil (${data.teamTag})`, { id });
      onCreated({ id, ...data });
    } catch (error) {
      console.error('Error creando enlace:', error);
      toast({ title: 'No se pudo generar el enlace', description: error.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={member ? `Enlace de edición para ${member.name}` : 'Generar enlace de nuevo perfil'}
      description={member ? 'La persona podrá proponer cambios a su perfil; los revisas en Solicitudes.' : 'El grupo y el departamento los fijas tú; la persona completa el resto.'}
      footer={(
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" loading={busy} onClick={create}><Link2 className="h-4 w-4" />Generar enlace</Button>
        </>
      )}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {!member && (
          <>
            <Field label="Grupo">
              <Select value={section} onChange={(e) => setSection(e.target.value)}>
                <option value="STAFF">Staff</option>
                <option value="DIRECTIVA">Directiva</option>
              </Select>
            </Field>
            <Field label="Departamento">
              <Select value={tag} onChange={(e) => setTag(e.target.value)}>
                {TEAM_TAG_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            </Field>
          </>
        )}
        <Field label="Vence en" className="sm:col-span-2">
          <Select value={days} onChange={(e) => setDays(Number(e.target.value))}>
            {[1, 7, 14, 30].map((d) => <option key={d} value={d}>{d} día{d === 1 ? '' : 's'}</option>)}
          </Select>
        </Field>
      </div>
    </Modal>
  );
}

export default function InvitesTab() {
  const { toast } = useToast();
  const confirm = useConfirm();
  const [invites, setInvites] = useState(null);
  const [creating, setCreating] = useState(false);
  const [shown, setShown] = useState(null);

  useEffect(() => {
    if (!db) { setInvites([]); return undefined; }
    return onSnapshot(collection(db, 'teamInvites'), (snap) => {
      setInvites(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, (error) => {
      console.error('Error cargando enlaces:', error);
      setInvites([]);
    });
  }, []);

  const rows = useMemo(() => (invites || []).slice().sort((a, b) => (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0)), [invites]);

  const revoke = async (inv) => {
    if (!(await confirm({ title: '¿Revocar el enlace?', description: 'Dejará de funcionar de inmediato.', confirmLabel: 'Revocar', tone: 'danger' }))) return;
    try {
      await updateDoc(doc(db, 'teamInvites', inv.id), { active: false });
      logActivity('equipo.enlace', `Revocó un enlace de perfil (${inv.memberName || inv.teamTag})`, { id: inv.id });
      toast({ title: 'Enlace revocado' });
    } catch (error) {
      toast({ title: 'No se pudo revocar', description: error.message, variant: 'destructive' });
    }
  };

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button variant="primary" onClick={() => setCreating(true)} disabled={!db}><Plus className="h-4 w-4" />Generar enlace</Button>
      </div>
      <Card>
        {!db ? (
          <EmptyState icon={Link2} title="Firebase no configurado" description="Configura Firebase para generar enlaces." />
        ) : invites === null ? (
          <div className="space-y-3 p-5" aria-busy="true">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : rows.length === 0 ? (
          <EmptyState icon={Link2} title="Sin enlaces" description="Genera un enlace para que un integrante complete su perfil." />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Enlace</TH>
                <TH className="hidden sm:table-cell">Estado</TH>
                <TH className="hidden md:table-cell">Vence</TH>
                <TH className="text-right"><span className="sr-only">Acciones</span></TH>
              </tr>
            </THead>
            <tbody>
              {rows.map((inv) => {
                const st = inviteStatus(inv);
                return (
                  <TR key={inv.id}>
                    <TD>
                      <span className="block font-medium">{inv.mode === 'edit' ? `Edición · ${inv.memberName || inv.memberId}` : 'Nuevo perfil'}</span>
                      <span className="block text-xs text-adm-muted">{sectionLabel(inv.teamSection)} · {inv.teamTag} · {inv.createdBy || '—'}</span>
                      <span className="mt-1 block sm:hidden"><Badge tone={STATUS[st][1]}>{STATUS[st][0]}</Badge></span>
                    </TD>
                    <TD className="hidden sm:table-cell"><Badge tone={STATUS[st][1]}>{STATUS[st][0]}</Badge></TD>
                    <TD className="hidden whitespace-nowrap text-xs text-adm-muted md:table-cell">{formatDateTime(inv.expiresAt)}</TD>
                    <TD className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => (st === 'active' ? setShown(inv) : copy(inviteUrl(inv.id), toast))}>
                          {st === 'active' ? 'Compartir' : 'Copiar'}
                        </Button>
                        {st === 'active' && <Button variant="danger-ghost" size="sm" onClick={() => revoke(inv)}>Revocar</Button>}
                      </div>
                    </TD>
                  </TR>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
      <GenerateLinkModal open={creating} onClose={() => setCreating(false)} onCreated={(inv) => { setCreating(false); setShown(inv); }} />
      <LinkModal invite={shown} onClose={() => setShown(null)} />
    </>
  );
}
