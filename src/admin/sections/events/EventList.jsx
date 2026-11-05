// Lista de eventos (públicos + internos + nombres heredados) con cupo, asistencia y filtros.
import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarDays, CalendarPlus, ChevronRight, ImageOff, RefreshCw, UserCheck, Users } from 'lucide-react';
import {
  Badge, Button, Card, EmptyState, PageHeader, SearchInput, Select, Skeleton, StatCard, Table, TD, TH, THead, TR,
} from '@/admin/ui';
import { formatDate, logActivity, normalize } from '@/admin/lib';
import { useToast } from '@/components/ui/use-toast';
import { useEventsStore } from './store';
import { STATUS, imageOf } from './data';
import { recalcCounts } from './actions';
import CreateEventModal from './CreateEventModal';
import CapacityBar from './CapacityBar';

const FILTERS = [
  { value: 'all', label: 'Todos los estados' },
  { value: 'upcoming', label: 'Próximos' },
  { value: 'past', label: 'Pasados' },
  { value: 'soldout', label: 'Agotados' },
  { value: 'hidden', label: 'Ocultos' },
  { value: 'manual', label: 'Internos (manuales)' },
  { value: 'legacy', label: 'Sin evento asociado' },
  { value: 'outOfSync', label: 'Cupo desfasado' },
];

const SORTS = {
  name: (a, b) => a.name.localeCompare(b.name, 'es'),
  date: (a, b) => (a.date?.getTime() ?? -Infinity) - (b.date?.getTime() ?? -Infinity),
  total: (a, b) => a.total - b.total,
  present: (a, b) => a.present - b.present,
};

export const KindBadge = ({ group }) => (group.kind === 'manual'
  ? <Badge tone="info">Interno</Badge>
  : group.kind === 'legacy' ? <Badge tone="warning">Sin evento</Badge> : null);

export default function EventList() {
  const { groups, loading, error, reload } = useEventsStore();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState({ key: 'date', dir: 'desc' });
  const [creating, setCreating] = useState(false);
  const [recalculating, setRecalculating] = useState(false);

  const stats = useMemo(() => {
    const past = groups.filter((g) => g.status === 'past' && g.total);
    const pastTotal = past.reduce((n, g) => n + g.total, 0);
    return {
      total: groups.length,
      upcoming: groups.filter((g) => g.status === 'upcoming' || g.status === 'soldout').length,
      regs: groups.reduce((n, g) => n + g.total, 0),
      rate: pastTotal ? Math.round((past.reduce((n, g) => n + g.present, 0) / pastTotal) * 100) : null,
      outOfSync: groups.filter((g) => g.outOfSync).length,
    };
  }, [groups]);

  const rows = useMemo(() => {
    const q = normalize(search.trim());
    const list = groups.filter((g) => {
      if (q && !normalize(`${g.name} ${g.doc?.location || ''}`).includes(q)) return false;
      if (filter === 'all') return true;
      if (filter === 'manual' || filter === 'legacy') return g.kind === filter;
      if (filter === 'outOfSync') return g.outOfSync;
      return g.status === filter;
    });
    const cmp = SORTS[sort.key];
    return list.sort((a, b) => cmp(a, b) * (sort.dir === 'asc' ? 1 : -1));
  }, [groups, search, filter, sort]);

  const sortProps = (key) => ({
    sort: sort.key === key ? sort.dir : undefined,
    onSort: () => setSort((s) => ({ key, dir: s.key === key && s.dir === 'desc' ? 'asc' : 'desc' })),
  });

  const recalcAll = async () => {
    const ids = groups.filter((g) => g.kind === 'public').map((g) => g.id);
    setRecalculating(true);
    try {
      await recalcCounts(ids);
      await reload();
      await logActivity('eventos.cupos_recalculados', `Recalculó el cupo de ${ids.length} eventos`, { count: ids.length });
      toast({ title: 'Cupos recalculados', description: `${ids.length} eventos actualizados.` });
    } catch (e) {
      console.error(e);
      toast({ title: 'No se pudieron recalcular los cupos', description: e?.message, variant: 'destructive' });
    } finally {
      setRecalculating(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Eventos y asistencia"
        description="Eventos publicados en /eventos, eventos internos y sus inscritos. Abre un evento para tomar asistencia."
        actions={(
          <>
            <Button variant="secondary" onClick={recalcAll} loading={recalculating} disabled={loading} title="Cuenta los registros de cada evento público y corrige su contador de cupo">
              {!recalculating && <RefreshCw className="h-4 w-4" aria-hidden="true" />}
              Recalcular cupos
            </Button>
            <Button variant="primary" onClick={() => setCreating(true)}>
              <CalendarPlus className="h-4 w-4" aria-hidden="true" />
              Nuevo evento
            </Button>
          </>
        )}
      >
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Eventos" value={loading ? '—' : stats.total} icon={CalendarDays} onClick={() => setFilter('all')} />
          <StatCard label="Próximos" value={loading ? '—' : stats.upcoming} icon={CalendarPlus} tone="success" onClick={() => setFilter('upcoming')} />
          <StatCard label="Inscritos" value={loading ? '—' : stats.regs.toLocaleString('es')} icon={Users} tone="info" />
          <StatCard
            label="Asistencia en eventos pasados"
            value={loading || stats.rate == null ? '—' : `${stats.rate}%`}
            icon={UserCheck}
            tone="success"
            hint={stats.outOfSync ? `${stats.outOfSync} con cupo desfasado` : undefined}
            onClick={stats.outOfSync ? () => setFilter('outOfSync') : undefined}
          />
        </div>
      </PageHeader>

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-adm-border p-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar evento o lugar…" className="min-w-[200px] flex-1" />
          <Select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filtrar por estado" className="w-auto">
            {FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </Select>
        </div>

        {error ? (
          <EmptyState icon={CalendarDays} title="Error al cargar" description={error} action={<Button onClick={reload}>Reintentar</Button>} />
        ) : loading ? (
          <div className="space-y-2 p-4">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title={groups.length ? 'Ningún evento coincide' : 'Aún no hay eventos'}
            description={groups.length ? 'Prueba con otra búsqueda o filtro.' : 'Crea el primero para abrir inscripciones.'}
            action={groups.length ? <Button variant="ghost" onClick={() => { setSearch(''); setFilter('all'); }}>Limpiar filtros</Button> : <Button variant="primary" onClick={() => setCreating(true)}>Nuevo evento</Button>}
          />
        ) : (
          <Table className="sm:min-w-[760px]">
            <THead>
              <tr>
                <TH {...sortProps('name')}>Evento</TH>
                <TH {...sortProps('date')} className="hidden sm:table-cell">Fecha</TH>
                <TH className="hidden sm:table-cell">Estado</TH>
                <TH {...sortProps('total')}>Inscritos / cupo</TH>
                <TH {...sortProps('present')} className="hidden sm:table-cell">Presentes</TH>
                <TH><span className="sr-only">Abrir</span></TH>
              </tr>
            </THead>
            <tbody>
              {rows.map((g) => {
                const img = g.kind === 'public' && imageOf(g.doc);
                const href = `/admin/eventos/${encodeURIComponent(g.key)}`;
                return (
                  <TR key={g.key} className="cursor-pointer" onClick={() => navigate(href)}>
                    <TD>
                      <div className="flex items-center gap-3">
                        <div className="hidden h-10 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-adm-surface-2 sm:flex">
                          {img ? <img src={img} alt="" className="h-full w-full object-cover" loading="lazy" /> : <ImageOff className="h-4 w-4 text-adm-muted" aria-hidden="true" />}
                        </div>
                        <div className="min-w-0">
                          <Link to={href} onClick={(e) => e.stopPropagation()} className="font-medium text-adm-text hover:text-adm-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-adm-accent rounded">
                            {g.name}
                          </Link>
                          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-adm-muted">
                            <KindBadge group={g} />
                            {/* En móvil la fecha y el estado van aquí; sus columnas se ocultan. */}
                            {g.date && <span className="sm:hidden">{formatDate(g.date)}</span>}
                            {g.kind !== 'legacy' && <Badge tone={STATUS[g.status].tone} className="sm:hidden">{STATUS[g.status].label}</Badge>}
                            {g.doc?.location && <span className="hidden truncate sm:inline">{g.doc.location}</span>}
                          </div>
                        </div>
                      </div>
                    </TD>
                    <TD className="hidden whitespace-nowrap text-adm-muted sm:table-cell">{g.date ? formatDate(g.date) : '—'}</TD>
                    <TD className="hidden sm:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {g.kind !== 'legacy' && <Badge tone={STATUS[g.status].tone}>{STATUS[g.status].label}</Badge>}
                        {g.outOfSync && <Badge tone="warning" title="El contador no coincide con los registros">Desfasado</Badge>}
                      </div>
                    </TD>
                    <TD className="min-w-[120px]"><CapacityBar total={g.kind === 'public' ? g.counted : g.total} capacity={g.capacity} /></TD>
                    <TD className="hidden tabular-nums sm:table-cell">
                      {g.present}
                      {g.total > 0 && <span className="ml-1 text-xs text-adm-muted">({Math.round((g.present / g.total) * 100)}%)</span>}
                    </TD>
                    <TD className="w-8 text-adm-muted"><ChevronRight className="h-4 w-4" aria-hidden="true" /></TD>
                  </TR>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      <CreateEventModal open={creating} onClose={() => setCreating(false)} onCreated={(key) => navigate(`/admin/eventos/${encodeURIComponent(key)}`)} />
    </>
  );
}
