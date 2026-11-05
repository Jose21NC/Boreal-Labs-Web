// Solicitudes de perfil enviadas por enlace (teamSubmissions/{token}): revisar, aprobar o rechazar.
import React, { useEffect, useMemo, useState } from 'react';
import { Check, Inbox, X } from 'lucide-react';
import { collection, doc, getDoc, onSnapshot, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore';
import { auth, db } from '@/firebase';
import { useToast } from '@/components/ui/use-toast';
import TeamMemberCard from '@/components/TeamMemberCard';
import { PROFILE_FIELDS, TEAM_APPROVER, resolveMemberImage } from '@/lib/team';
import { Badge, Button, Card, CardBody, EmptyState, Field, Skeleton, Tabs, Textarea, useConfirm } from '@/admin/ui';
import { formatDateTime, logActivity, toDate } from '@/admin/lib';
import { sectionLabel } from './Invites';

const FILTERS = [['pending', 'Pendientes'], ['approved', 'Aprobadas'], ['rejected', 'Rechazadas']];
const TONE = { pending: 'warning', approved: 'success', rejected: 'danger' };
const LABEL = Object.fromEntries(FILTERS);

const show = (key, v) => (key === 'imageUrl' ? (v ? 'Foto nueva' : 'Sin foto') : v || '—');

/** Campos del perfil que difieren del integrante actual (solo modo edición). */
const changedFields = (sub, member) => PROFILE_FIELDS.filter(([key]) => (sub[key] ?? null) !== (member?.[key] ?? null));

function RejectReason({ onChange }) {
  return (
    <Field label="Motivo (opcional)" className="mt-1">
      <Textarea rows={2} onChange={(e) => onChange(e.target.value)} placeholder="Se verá solo en el panel." />
    </Field>
  );
}

export default function RequestsTab() {
  const { toast } = useToast();
  const confirm = useConfirm();
  const [subs, setSubs] = useState(null);
  const [members, setMembers] = useState({});
  const [filter, setFilter] = useState('pending');
  const [busy, setBusy] = useState('');
  const me = auth?.currentUser?.email || null;
  const canReview = me === TEAM_APPROVER;

  useEffect(() => {
    if (!db) { setSubs([]); return undefined; }
    return onSnapshot(collection(db, 'teamSubmissions'), (snap) => {
      setSubs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, (error) => {
      console.error('Error cargando solicitudes:', error);
      setSubs([]);
    });
  }, []);

  // Perfil actual de cada integrante con solicitud de edición (para el antes/después).
  useEffect(() => {
    (subs || []).filter((s) => s.mode === 'edit' && s.memberId && !(s.memberId in members)).forEach(async (s) => {
      try {
        const snap = await getDoc(doc(db, 'teamMembers', s.memberId));
        const m = snap.exists() ? { id: snap.id, ...snap.data() } : null;
        if (m) m.resolvedImageUrl = await resolveMemberImage(m);
        setMembers((prev) => ({ ...prev, [s.memberId]: m }));
      } catch (error) {
        console.error('Error cargando integrante:', error);
      }
    });
  }, [subs, members]);

  const counts = useMemo(() => Object.fromEntries(FILTERS.map(([k]) => [k, (subs || []).filter((s) => (s.status || 'pending') === k).length])), [subs]);
  const rows = useMemo(() => (subs || [])
    .filter((s) => (s.status || 'pending') === filter)
    .sort((a, b) => (toDate(b.submittedAt)?.getTime() || 0) - (toDate(a.submittedAt)?.getTime() || 0)), [subs, filter]);

  const approve = async (s) => {
    const member = members[s.memberId];
    if (s.mode === 'edit' && !member) {
      toast({ title: 'El integrante ya no existe', description: 'Rechaza la solicitud o crea el perfil manualmente.', variant: 'destructive' });
      return;
    }
    const diff = s.mode === 'edit' ? changedFields(s, member) : [];
    if (s.mode === 'edit' && diff.length === 0) {
      toast({ title: 'Sin cambios', description: 'La solicitud es idéntica al perfil actual; puedes rechazarla.' });
      return;
    }
    const ok = await confirm({
      title: s.mode === 'edit' ? `¿Aplicar cambios al perfil de ${member.name}?` : `¿Publicar a ${s.name} en /equipo?`,
      description: s.mode === 'edit' ? `Se actualizará: ${diff.map(([, l]) => l).join(', ')}.` : `${sectionLabel(s.teamSection)} · ${s.teamTag}`,
      confirmLabel: 'Aprobar',
    });
    if (!ok) return;
    setBusy(s.id);
    try {
      const batch = writeBatch(db);
      const now = serverTimestamp();
      let memberId = s.memberId;
      if (s.mode === 'edit') {
        batch.update(doc(db, 'teamMembers', memberId), {
          ...Object.fromEntries(diff.map(([k]) => [k, s[k] ?? null])), updatedAt: now, updatedBy: me, approvedBy: me,
        });
      } else {
        const ref = doc(collection(db, 'teamMembers'));
        memberId = ref.id;
        batch.set(ref, {
          ...Object.fromEntries(PROFILE_FIELDS.map(([k]) => [k, s[k] ?? null])),
          teamSection: s.teamSection, teamTag: s.teamTag, createdAt: now, createdBy: me, approvedBy: me, approvedAt: now,
        });
      }
      batch.update(doc(db, 'teamSubmissions', s.id), { status: 'approved', reviewedBy: me, reviewedAt: now });
      batch.update(doc(db, 'teamInvites', s.id), { active: false, usedAt: now });
      await batch.commit();
      logActivity('equipo.aprobado', s.mode === 'edit' ? `Aprobó cambios al perfil de ${s.name}` : `Aprobó y publicó el perfil de ${s.name}`, { id: memberId, submission: s.id });
      toast({ title: 'Solicitud aprobada', description: `${s.name} ya aparece en /equipo.` });
    } catch (error) {
      console.error('Error aprobando solicitud:', error);
      toast({ title: 'No se pudo aprobar', description: error.message, variant: 'destructive' });
    } finally {
      setBusy('');
    }
  };

  const reject = async (s) => {
    let reason = '';
    const ok = await confirm({
      title: `¿Rechazar la solicitud de ${s.name}?`,
      description: 'La persona no recibe aviso automático.',
      body: <RejectReason onChange={(v) => { reason = v; }} />,
      confirmLabel: 'Rechazar',
      tone: 'danger',
    });
    if (!ok) return;
    setBusy(s.id);
    try {
      await updateDoc(doc(db, 'teamSubmissions', s.id), { status: 'rejected', reason: reason.trim() || null, reviewedBy: me, reviewedAt: serverTimestamp() });
      logActivity('equipo.rechazado', `Rechazó la solicitud de perfil de ${s.name}`, { submission: s.id });
      toast({ title: 'Solicitud rechazada' });
    } catch (error) {
      toast({ title: 'No se pudo rechazar', description: error.message, variant: 'destructive' });
    } finally {
      setBusy('');
    }
  };

  if (!db) return <Card><EmptyState icon={Inbox} title="Firebase no configurado" description="Configura Firebase para recibir solicitudes." /></Card>;

  return (
    <>
      <Tabs className="mb-4" value={filter} onChange={setFilter} items={FILTERS.map(([value, label]) => ({ value, label, count: counts[value] }))} />
      {!canReview && filter === 'pending' && counts.pending > 0 && (
        <p className="mb-4 rounded-lg border border-adm-warning/30 bg-adm-warning/10 px-4 py-2 text-sm text-adm-warning">Solo {TEAM_APPROVER} puede aprobar o rechazar solicitudes.</p>
      )}
      {subs === null ? (
        <div className="grid gap-4 md:grid-cols-2" aria-busy="true"><Skeleton className="h-80" /><Skeleton className="h-80" /></div>
      ) : rows.length === 0 ? (
        <Card><EmptyState icon={Inbox} title={`Sin solicitudes ${LABEL[filter].toLowerCase()}`} description="Las solicitudes llegan desde los enlaces de perfil." /></Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {rows.map((s) => {
            const member = s.mode === 'edit' ? members[s.memberId] : null;
            const diff = s.mode === 'edit' && member ? changedFields(s, member) : null;
            return (
              <Card key={s.id}>
                <CardBody className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={s.mode === 'edit' ? 'info' : 'accent'}>{s.mode === 'edit' ? 'Edición' : 'Nuevo perfil'}</Badge>
                    <Badge tone={TONE[s.status] || 'warning'}>{LABEL[s.status] || 'Pendiente'}</Badge>
                    <span className="text-xs text-adm-muted">{sectionLabel(s.teamSection)} · {s.teamTag} · {formatDateTime(s.submittedAt)}</span>
                  </div>
                  <div className="grid items-start gap-4 sm:grid-cols-[240px_minmax(0,1fr)]">
                    {/* La página pública siempre es oscura: el fondo replica ese contexto. */}
                    <div className="rounded-2xl bg-boreal-dark p-3 text-white">
                      <TeamMemberCard member={{ ...s, memberTag: s.teamTag, resolvedImageUrl: s.imageUrl }} />
                    </div>
                    <div className="min-w-0 text-sm">
                      {s.mode === 'edit' ? (
                        member === undefined ? <Skeleton className="h-24" />
                          : member === null ? <p className="text-adm-danger">El integrante ya no existe.</p>
                            : diff.length === 0 ? <p className="text-adm-muted">Sin cambios respecto al perfil actual.</p>
                              : (
                                <dl className="space-y-2">
                                  {diff.map(([k, label]) => (
                                    <div key={k}>
                                      <dt className="text-xs font-semibold uppercase tracking-wide text-adm-muted">{label}</dt>
                                      <dd className="break-words text-adm-danger line-through">{show(k, member[k])}</dd>
                                      <dd className="break-words text-adm-success">{show(k, s[k])}</dd>
                                    </div>
                                  ))}
                                </dl>
                              )
                      ) : (
                        <dl className="space-y-1 break-words text-adm-muted">
                          {PROFILE_FIELDS.filter(([k]) => k !== 'imageUrl' && k !== 'description' && s[k]).map(([k, label]) => (
                            <div key={k}><dt className="inline font-medium text-adm-text">{label}: </dt><dd className="inline">{s[k]}</dd></div>
                          ))}
                        </dl>
                      )}
                      {s.status === 'rejected' && s.reason && <p className="mt-3 text-adm-muted">Motivo: {s.reason}</p>}
                      {s.reviewedBy && <p className="mt-3 text-xs text-adm-muted">Revisada por {s.reviewedBy} · {formatDateTime(s.reviewedAt)}</p>}
                    </div>
                  </div>
                  {(s.status || 'pending') === 'pending' && (
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {!canReview && <span className="mr-auto text-xs text-adm-muted">Solo {TEAM_APPROVER} puede aprobar</span>}
                      <Button variant="danger-ghost" disabled={!canReview || !!busy} onClick={() => reject(s)}><X className="h-4 w-4" />Rechazar</Button>
                      <Button variant="primary" disabled={!canReview || !!busy} loading={busy === s.id} onClick={() => approve(s)}><Check className="h-4 w-4" />Aprobar</Button>
                    </div>
                  )}
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
