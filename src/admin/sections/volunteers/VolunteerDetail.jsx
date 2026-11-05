// Ficha del voluntario: perfil, disponibilidad, créditos e historial de horas con acciones.
import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, BadgeDollarSign, Check, Clock, History, Mail, MessageCircle, Pencil, Plus, RotateCcw, Trash2, UserX, X,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import {
  Button, Card, CardBody, CardHeader, EmptyState, PageHeader, Skeleton, StatCard, Table, TD, TH, THead, TR, useConfirm,
} from '@/admin/ui';
import { formatDate, formatRelative } from '@/admin/lib';
import useLogActions from './useLogActions';
import { ProofThumb, ProofViewer, SourceBadge, StatusCell } from './LogBits';
import { ShiftMatrix } from './shifts';
import { AdjustCreditsModal, EditVolunteerModal, RecordHoursModal } from './modals';
import { deleteVolunteers } from './actions';
import { availabilityOf, creditsAsDuration, customSlotsOf, emailKey, logCredits, logStatus, round2 } from './utils';

export default function VolunteerDetail({ volunteers, logs, byEmail, loading }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { toast } = useToast();
  const [open, setOpen] = useState(null); // 'edit' | 'credits' | 'hours'
  const [viewing, setViewing] = useState(null);
  const { approve, reject, revert, busyIds, modal } = useLogActions(byEmail);

  const volunteer = volunteers.find((v) => v.id === id);
  const history = useMemo(() => {
    if (!volunteer) return [];
    const keys = new Set([emailKey(volunteer.email), emailKey(volunteer.id)]);
    return logs.filter((l) => keys.has(emailKey(l.email)));
  }, [logs, volunteer]);

  const totals = useMemo(() => history.reduce((acc, l) => {
    const st = logStatus(l);
    if (st === 'approved') acc.hours += Number(l.registeredHours) || 0;
    if (st === 'pending') acc.pending += logCredits(l);
    return acc;
  }, { hours: 0, pending: 0 }), [history]);

  if (loading) {
    return <div className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-28 w-full" /><Skeleton className="h-64 w-full" /></div>;
  }
  if (!volunteer) {
    return (
      <Card>
        <EmptyState icon={UserX} title="Voluntario no encontrado" description="Puede que lo hayan eliminado." action={<Button onClick={() => navigate('..')}>Volver a la lista</Button>} />
      </Card>
    );
  }

  const remove = async () => {
    const ok = await confirm({
      title: `¿Eliminar a ${volunteer.fullName || volunteer.email}?`,
      description: 'Se borra la inscripción de forma permanente. Sus registros de horas se conservan.',
      confirmLabel: 'Eliminar',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await deleteVolunteers([volunteer]);
      toast({ title: 'Voluntario eliminado' });
      navigate('..');
    } catch (error) {
      console.error(error);
      toast({ title: 'No se pudo eliminar', description: error.message, variant: 'destructive' });
    }
  };

  const credits = Number(volunteer.creditos) || 0;
  const profile = [
    ['Correo', volunteer.email || volunteer.id],
    ['WhatsApp', volunteer.whatsapp],
    ['Edad', volunteer.edad],
    ['Ciudad', volunteer.ciudad],
    ['Procedencia', volunteer.procedencia],
    ['Talla', volunteer.talla],
    ['Inscripción', formatDate(volunteer.fechaRegistro)],
  ];
  const customSlots = customSlotsOf(volunteer);
  const comments = volunteer.comentariosAdicionales || volunteer.comentarioAdicional || volunteer.comentarios || volunteer.observaciones;

  return (
    <div>
      <Link to=".." className="mb-3 inline-flex items-center gap-1.5 text-sm text-adm-muted hover:text-adm-text">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Voluntariado
      </Link>
      <PageHeader
        title={volunteer.fullName || 'Sin nombre'}
        description={`Inscrito ${formatRelative(volunteer.fechaRegistro)}`}
        actions={(
          <>
            <Button variant="ghost" size="icon" onClick={remove} aria-label="Eliminar voluntario" title="Eliminar"><Trash2 className="h-4 w-4 text-adm-danger" /></Button>
            <Button variant="outline" onClick={() => setOpen('edit')}><Pencil className="h-4 w-4" aria-hidden="true" /> Editar</Button>
            <Button variant="outline" onClick={() => setOpen('credits')}><BadgeDollarSign className="h-4 w-4" aria-hidden="true" /> Ajustar créditos</Button>
            <Button variant="primary" onClick={() => setOpen('hours')}><Plus className="h-4 w-4" aria-hidden="true" /> Registrar horas</Button>
          </>
        )}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Créditos" value={credits} hint={creditsAsDuration(credits)} icon={BadgeDollarSign} />
        <StatCard label="Horas aprobadas" value={round2(totals.hours)} icon={Clock} tone="success" />
        <StatCard label="Créditos por aprobar" value={round2(totals.pending)} icon={History} tone="warning" />
        <StatCard label="Registros" value={history.length} icon={Check} tone="neutral" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Perfil"
              actions={(
                <>
                  {volunteer.email && <a href={`mailto:${volunteer.email}`} className="rounded-md p-1.5 text-adm-muted hover:bg-adm-surface-2 hover:text-adm-text" aria-label="Enviar correo"><Mail className="h-4 w-4" /></a>}
                  {volunteer.whatsapp && (
                    <a href={`https://wa.me/${String(volunteer.whatsapp).replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="rounded-md p-1.5 text-adm-muted hover:bg-adm-surface-2 hover:text-adm-text" aria-label="Abrir WhatsApp">
                      <MessageCircle className="h-4 w-4" />
                    </a>
                  )}
                </>
              )}
            />
            <CardBody>
              <dl className="space-y-2.5 text-sm">
                {profile.map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4">
                    <dt className="text-adm-muted">{k}</dt>
                    <dd className="min-w-0 break-words text-right text-adm-text">{v || '—'}</dd>
                  </div>
                ))}
              </dl>
              {comments && (
                <div className="mt-4 rounded-lg bg-adm-surface-2 p-3 text-sm text-adm-text">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-adm-muted">Comentarios</p>
                  {comments}
                </div>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Disponibilidad" />
            <CardBody>
              <ShiftMatrix map={availabilityOf(volunteer)} />
              {customSlots.length > 0 && (
                <ul className="mt-3 space-y-1 text-xs text-adm-muted">
                  {customSlots.map((s) => <li key={s}>{s}</li>)}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>

        <Card className="overflow-hidden lg:col-span-2">
          <CardHeader title="Historial de horas y créditos" description="Registros enviados por el voluntario o cargados por el equipo." />
          {history.length === 0 ? (
            <EmptyState icon={History} title="Sin registros de horas" description="Usa “Registrar horas” para cargar una actividad." />
          ) : (
            <Table>
              <THead>
                <tr>
                  <TH className="w-14">Foto</TH>
                  <TH>Actividad</TH>
                  <TH className="hidden text-right sm:table-cell">Horas</TH>
                  <TH className="text-right">Créd.</TH>
                  <TH>Estado</TH>
                  <TH><span className="sr-only">Acciones</span></TH>
                </tr>
              </THead>
              <tbody>
                {history.map((log) => {
                  const st = logStatus(log);
                  const busy = busyIds.has(log.id);
                  return (
                    <TR key={log.id}>
                      <TD><ProofThumb log={log} onOpen={setViewing} /></TD>
                      <TD className="min-w-[120px]">
                        <p className="font-medium">{log.activityName || '—'}</p>
                        <p className="text-xs text-adm-muted">{log.attendanceDate || formatDate(log.createdAt)} {log.startTime ? `· ${log.startTime}–${log.endTime}` : ''}</p>
                        <div className="mt-1"><SourceBadge log={log} /></div>
                      </TD>
                      <TD className="hidden text-right tabular-nums sm:table-cell">{Number(log.registeredHours || 0)}</TD>
                      <TD className="text-right font-semibold tabular-nums">{logCredits(log)}</TD>
                      <TD><StatusCell log={log} /></TD>
                      <TD className="text-right">
                        {st === 'approved' ? (
                          <Button size="icon" variant="ghost" onClick={() => revert(log)} disabled={busy} aria-label="Revertir aprobación" title="Revertir"><RotateCcw className="h-4 w-4" /></Button>
                        ) : (
                          <div className="flex justify-end gap-1">
                            {st === 'pending' && <Button size="icon" variant="danger-ghost" onClick={() => reject([log])} disabled={busy} aria-label="Rechazar" title="Rechazar"><X className="h-4 w-4" /></Button>}
                            <Button size="icon" variant="primary" onClick={() => approve([log])} loading={busy} aria-label="Aprobar" title="Aprobar">{!busy && <Check className="h-4 w-4" />}</Button>
                          </div>
                        )}
                      </TD>
                    </TR>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card>
      </div>

      {open === 'edit' && <EditVolunteerModal volunteer={volunteer} onClose={() => setOpen(null)} />}
      {open === 'credits' && <AdjustCreditsModal volunteer={volunteer} onClose={() => setOpen(null)} />}
      {open === 'hours' && <RecordHoursModal volunteer={volunteer} onClose={() => setOpen(null)} />}
      <ProofViewer
        log={viewing}
        busy={viewing && busyIds.has(viewing.id)}
        onClose={() => setViewing(null)}
        onApprove={async (log) => { if (await approve([log])) setViewing(null); }}
        onReject={(log) => reject([log], () => setViewing(null))}
      />
      {modal}
    </div>
  );
}
