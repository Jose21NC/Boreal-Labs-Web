// Detalle de un evento: inscritos/asistencia y edición de los datos del evento.
import React, { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Award, CalendarDays, Eye, EyeOff, MapPin, RefreshCw, Trash2, UserCheck, UserX, Users } from 'lucide-react';
import { Badge, Button, Card, CardBody, EmptyState, PageHeader, Skeleton, StatCard, Tabs } from '@/admin/ui';
import { formatDate, formatDateTime, logActivity } from '@/admin/lib';
import { useToast } from '@/components/ui/use-toast';
import { useConfirm, useDangerConfirm } from '@/admin/ui';
import { useEventsStore } from './store';
import { STATUS } from './data';
import { deleteEvent, recalcCounts, saveManualEvent, savePublicEvent, setEventFlags } from './actions';
import { ManualEventForm, PublicEventForm } from './EventForm';
import { KindBadge } from './EventList';
import CapacityBar from './CapacityBar';
import Registrants from './Registrants';

export default function EventDetail() {
  const { eventKey } = useParams();
  const { groups, loading, reload } = useEventsStore();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'detalles' ? 'detalles' : 'inscritos';
  const navigate = useNavigate();
  const confirm = useConfirm();
  const confirmDanger = useDangerConfirm();
  const { toast } = useToast();
  const [busy, setBusy] = useState(null);

  const g = groups.find((x) => x.key === eventKey);

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }
  if (!g) {
    return (
      <Card>
        <EmptyState icon={CalendarDays} title="Evento no encontrado" description="Puede que se haya eliminado o renombrado." action={<Button onClick={() => navigate('/admin/eventos')}>Volver a eventos</Button>} />
      </Card>
    );
  }

  const run = async (key, fn, { success, action, summary, meta }) => {
    setBusy(key);
    try {
      const result = await fn();
      await reload();
      await logActivity(action, summary, { event: g.name, ...meta });
      toast({ title: success });
      return result;
    } catch (e) {
      console.error(e);
      toast({ title: 'No se pudo completar la acción', description: e?.message, variant: 'destructive' });
      return undefined;
    } finally {
      setBusy(null);
    }
  };

  const recalc = () => run('recalc', () => recalcCounts([g.id]), {
    success: 'Cupo recalculado', action: 'eventos.cupo_recalculado', summary: `Recalculó el cupo de "${g.name}"`,
  });

  const toggleVisible = () => run('visible', () => setEventFlags(g.id, { visible: g.doc.visible === false }), {
    success: g.doc.visible === false ? 'Evento visible en /eventos' : 'Evento oculto de /eventos',
    action: 'eventos.visibilidad',
    summary: `${g.doc.visible === false ? 'Mostró' : 'Ocultó'} el evento "${g.name}"`,
  });

  const remove = async () => {
    const ok = await confirmDanger({
      title: `¿Eliminar "${g.name}"?`,
      description: `Se eliminarán el evento${g.total ? ` y sus ${g.total} registros` : ''}. Los certificados ya emitidos no se tocan.`,
      phrase: g.name,
      confirmLabel: 'Eliminar evento',
    });
    if (!ok) return;
    const deleted = await run('delete', () => deleteEvent(g), {
      success: 'Evento eliminado', action: 'eventos.eliminado', summary: `Eliminó el evento "${g.name}" y ${g.total} registros`, meta: { registros: g.total },
    });
    if (deleted !== undefined) navigate('/admin/eventos');
  };

  const saveDetails = (form, file) => {
    const renamed = g.kind === 'public' ? form.title.trim() !== g.name : form.name.trim() !== g.name;
    const newName = g.kind === 'public' ? form.title.trim() : form.name.trim();
    return run('save', () => (g.kind === 'public' ? savePublicEvent(g.doc, form, file) : saveManualEvent(g.doc, form)), {
      success: renamed ? 'Evento renombrado: registros y plantilla actualizados' : 'Evento actualizado',
      action: 'eventos.editado',
      summary: renamed ? `Renombró "${g.name}" a "${newName}"` : `Editó el evento "${g.name}"`,
    });
  };

  const absent = g.total - g.present;
  const meta = g.doc || {};

  return (
    <>
      <Link to="/admin/eventos" className="mb-3 inline-flex items-center gap-1.5 rounded text-sm text-adm-muted hover:text-adm-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-adm-accent">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Eventos
      </Link>
      <PageHeader
        title={g.name}
        description={(
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {g.date && <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />{formatDate(g.date)}{meta.time ? ` · ${meta.time}` : ''}</span>}
            {meta.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" aria-hidden="true" />{meta.location}</span>}
            {meta.createdAt && <span>Creado {formatDateTime(meta.createdAt)}{meta.createdBy ? ` por ${meta.createdBy}` : ''}</span>}
            {meta.updatedAt && <span>Editado {formatDateTime(meta.updatedAt)}{meta.updatedBy ? ` por ${meta.updatedBy}` : ''}</span>}
          </span>
        )}
        actions={(
          <>
            <Button variant="outline" onClick={() => navigate(`/admin/certificados?evento=${encodeURIComponent(g.name)}`)}>
              <Award className="h-4 w-4" aria-hidden="true" /> Certificados
            </Button>
            {g.kind === 'public' && (
              <>
                <Button variant="outline" onClick={recalc} loading={busy === 'recalc'} title="Cuenta los registros de este evento y corrige el contador de cupo">
                  {busy !== 'recalc' && <RefreshCw className="h-4 w-4" aria-hidden="true" />} Recalcular cupo
                </Button>
                <Button variant="outline" onClick={toggleVisible} loading={busy === 'visible'}>
                  {busy !== 'visible' && (meta.visible === false ? <Eye className="h-4 w-4" aria-hidden="true" /> : <EyeOff className="h-4 w-4" aria-hidden="true" />)}
                  {meta.visible === false ? 'Mostrar' : 'Ocultar'}
                </Button>
              </>
            )}
            <Button variant="danger-ghost" onClick={remove} loading={busy === 'delete'} aria-label="Eliminar evento">
              {busy !== 'delete' && <Trash2 className="h-4 w-4" aria-hidden="true" />} Eliminar
            </Button>
          </>
        )}
      >
        <div className="flex flex-wrap gap-1.5">
          {g.kind !== 'legacy' && <Badge tone={STATUS[g.status].tone}>{STATUS[g.status].label}</Badge>}
          <KindBadge group={g} />
          {g.outOfSync && (
            <Badge tone="warning">Contador desfasado: {g.counted} vs {g.regs.filter((r) => r.eventId === g.id).length} registros</Badge>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Card className="p-4">
            <div className="mb-2 flex items-center justify-between text-xs font-medium text-adm-muted">
              Cupo {g.kind === 'public' ? '(contador público)' : ''}
              <Users className="h-4 w-4 text-adm-info" aria-hidden="true" />
            </div>
            <CapacityBar total={g.kind === 'public' ? g.counted : g.total} capacity={g.capacity} />
          </Card>
          <StatCard label="Inscritos" value={g.total} icon={Users} tone="info" />
          <StatCard label="Presentes" value={g.present} icon={UserCheck} tone="success" hint={g.total ? `${Math.round((g.present / g.total) * 100)}% de asistencia` : undefined} />
          <StatCard label="Ausentes" value={absent} icon={UserX} tone="neutral" />
        </div>
      </PageHeader>

      <Tabs
        className="mb-4"
        value={tab}
        onChange={(v) => setParams(v === 'inscritos' ? {} : { tab: v }, { replace: true })}
        items={[{ value: 'inscritos', label: 'Inscritos y asistencia', count: g.total }, { value: 'detalles', label: 'Detalles del evento' }]}
      />

      {tab === 'inscritos' ? (
        <Registrants group={g} />
      ) : (
        <Card>
          <CardBody>
            {g.kind === 'public' && (
              <PublicEventForm key={`${g.id}-${String(meta.updatedAt?.seconds ?? meta.updatedAt ?? '')}`} initial={meta} submitting={busy === 'save'} submitLabel="Guardar cambios" onSubmit={saveDetails} />
            )}
            {g.kind === 'manual' && (
              <ManualEventForm key={`${g.id}-${g.name}`} initial={meta} submitting={busy === 'save'} submitLabel="Guardar cambios" onSubmit={saveDetails} />
            )}
            {g.kind === 'legacy' && (
              <p className="text-sm text-adm-muted">
                Estos registros tienen <code className="rounded bg-adm-surface-2 px-1">eventName = "{g.name}"</code> pero no hay un evento público ni interno con ese nombre.
                Crea un evento interno con el mismo nombre para poder editarlo.
              </p>
            )}
            {g.kind !== 'legacy' && (
              <p className="mt-4 border-t border-adm-border pt-4 text-xs text-adm-muted">
                Cambiar el nombre actualiza el <code>eventName</code> de todos sus registros y mueve su plantilla de certificado.
              </p>
            )}
          </CardBody>
        </Card>
      )}
    </>
  );
}
