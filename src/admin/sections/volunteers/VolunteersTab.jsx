// Lista de voluntarios: búsqueda, filtros por procedencia/turno, orden, selección, CSV y borrado en lote.
import React, { useDeferredValue, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronRight, Download, Trash2, UserX, Users } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import {
  Button, Card, EmptyState, SearchInput, Select, Skeleton, Table, TD, TH, THead, TR, useConfirm,
} from '@/admin/ui';
import { downloadCsv, formatDate, formatRelative, normalize, toDate } from '@/admin/lib';
import { ChipLegend, DayChips } from './shifts';
import { deleteVolunteers } from './actions';
import { DAYS, PERIODS, availabilityOf, customSlotsOf } from './utils';

const SORTERS = {
  fullName: (v) => normalize(v.fullName),
  procedencia: (v) => normalize(v.procedencia),
  creditos: (v) => Number(v.creditos) || 0,
  fechaRegistro: (v) => toDate(v.fechaRegistro)?.getTime() || 0,
};

/** `turno` = 'lunes' (cualquier turno) o 'lunes:manana'. */
export const matchesShift = (volunteer, turno) => {
  if (!turno) return true;
  const [day, period] = turno.split(':');
  const slot = availabilityOf(volunteer)[day];
  if (!slot) return true;
  return period ? slot[period] : slot.manana || slot.tarde || slot.personalizado;
};

const CSV_COLUMNS = [
  { key: 'fullName', label: 'Nombre' },
  { key: 'email', label: 'Correo' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'edad', label: 'Edad' },
  { key: 'ciudad', label: 'Ciudad' },
  { key: 'procedencia', label: 'Procedencia' },
  { key: 'talla', label: 'Talla' },
  { label: 'Créditos', value: (v) => Number(v.creditos) || 0 },
  { label: 'Turnos', value: (v) => (Array.isArray(v.turnos) ? v.turnos.join(' | ') : '') },
  { label: 'Horarios personalizados', value: (v) => customSlotsOf(v).join(' | ') },
  { key: 'comentariosAdicionales', label: 'Comentarios' },
  { label: 'Fecha de registro', value: (v) => formatDate(v.fechaRegistro) },
];

export default function VolunteersTab({ volunteers, loading }) {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search); // filtra sin bloquear el tecleo
  const [sort, setSort] = useState({ key: 'fechaRegistro', dir: 'desc' });
  const [selected, setSelected] = useState(() => new Set());
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { toast } = useToast();

  const procedencia = params.get('procedencia') || '';
  const turno = params.get('turno') || '';
  const setFilter = (key, value) => setParams((p) => { const n = new URLSearchParams(p); if (value) n.set(key, value); else n.delete(key); return n; }, { replace: true });

  const procedencias = useMemo(
    () => [...new Set(volunteers.map((v) => String(v.procedencia || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [volunteers],
  );

  const rows = useMemo(() => {
    const q = normalize(deferredSearch.trim());
    const getter = SORTERS[sort.key];
    const dir = sort.dir === 'asc' ? 1 : -1;
    return volunteers
      .filter((v) => (!q || normalize([v.fullName, v.email, v.whatsapp, v.ciudad, v.procedencia].join(' ')).includes(q))
        && (!procedencia || normalize(v.procedencia) === normalize(procedencia))
        && matchesShift(v, turno))
      .sort((a, b) => { const x = getter(a); const y = getter(b); return x < y ? -dir : x > y ? dir : 0; });
  }, [volunteers, deferredSearch, sort, procedencia, turno]);

  const sortProps = (key) => ({
    sort: sort.key === key ? sort.dir : undefined,
    onSort: () => setSort((s) => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' })),
  });

  const selectedRows = rows.filter((v) => selected.has(v.id));
  const allChecked = rows.length > 0 && rows.every((v) => selected.has(v.id));
  const toggle = (id) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const filtersActive = search || procedencia || turno;

  const exportCsv = () => {
    const list = selectedRows.length ? selectedRows : rows;
    downloadCsv(`voluntarios-${new Date().toISOString().slice(0, 10)}`, CSV_COLUMNS, list);
  };

  const removeSelected = async () => {
    const ok = await confirm({
      title: `¿Eliminar ${selectedRows.length} voluntario(s)?`,
      description: 'Se borra la inscripción de forma permanente. Sus registros de horas se conservan.',
      confirmLabel: 'Eliminar',
      tone: 'danger',
    });
    if (!ok) return;
    setDeleting(true);
    try {
      await deleteVolunteers(selectedRows);
      toast({ title: 'Voluntarios eliminados', description: `${selectedRows.length} inscripción(es) borradas.` });
      setSelected(new Set());
    } catch (error) {
      console.error(error);
      toast({ title: 'No se pudo eliminar', description: error.message, variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar nombre, correo, teléfono, ciudad…" className="md:w-80" />
        <div className="grid grid-cols-2 gap-2 md:flex">
          <Select value={procedencia} onChange={(e) => setFilter('procedencia', e.target.value)} aria-label="Filtrar por procedencia" className="md:w-48">
            <option value="">Toda procedencia</option>
            {procedencias.map((p) => <option key={p} value={p}>{p}</option>)}
          </Select>
          <Select value={turno} onChange={(e) => setFilter('turno', e.target.value)} aria-label="Filtrar por disponibilidad" className="md:w-48">
            <option value="">Cualquier turno</option>
            {DAYS.map((d) => (
              <optgroup key={d.key} label={d.label}>
                <option value={d.key}>{d.label} (cualquiera)</option>
                {PERIODS.map((p) => <option key={p.key} value={`${d.key}:${p.key}`}>{d.label} · {p.label}</option>)}
              </optgroup>
            ))}
          </Select>
        </div>
        {filtersActive && (
          <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setParams((p) => { const n = new URLSearchParams(p); n.delete('procedencia'); n.delete('turno'); return n; }, { replace: true }); }}>
            Limpiar filtros
          </Button>
        )}
        <div className="flex items-center gap-2 md:ml-auto">
          {selectedRows.length > 0 && (
            <Button variant="danger-ghost" size="sm" onClick={removeSelected} loading={deleting}>
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Eliminar ({selectedRows.length})
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!rows.length}>
            <Download className="h-3.5 w-3.5" aria-hidden="true" /> {selectedRows.length ? `Exportar (${selectedRows.length})` : 'Exportar CSV'}
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-11 w-full" />)}</div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={volunteers.length ? UserX : Users}
            title={volunteers.length ? 'Sin resultados' : 'Aún no hay voluntarios'}
            description={volunteers.length ? 'Prueba con otra búsqueda o quita filtros.' : 'Las inscripciones del formulario público aparecerán aquí.'}
          />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH className="w-10">
                  <input
                    type="checkbox"
                    aria-label="Seleccionar todos"
                    checked={allChecked}
                    onChange={() => setSelected(allChecked ? new Set() : new Set(rows.map((v) => v.id)))}
                    className="h-4 w-4 accent-[rgb(var(--adm-accent))]"
                  />
                </TH>
                <TH {...sortProps('fullName')}>Nombre</TH>
                <TH className="hidden lg:table-cell">WhatsApp</TH>
                <TH className="hidden md:table-cell" {...sortProps('procedencia')}>Procedencia</TH>
                <TH className="hidden sm:table-cell">Disponibilidad</TH>
                <TH className="text-right" {...sortProps('creditos')}>Créditos</TH>
                <TH className="hidden xl:table-cell" {...sortProps('fechaRegistro')}>Registro</TH>
                <TH className="hidden w-8 sm:table-cell"><span className="sr-only">Abrir</span></TH>
              </tr>
            </THead>
            <tbody>
              {rows.map((v) => {
                const href = encodeURIComponent(v.id);
                return (
                  <TR key={v.id} selected={selected.has(v.id)} className="cursor-pointer" onClick={() => navigate(href)}>
                    <TD onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`Seleccionar ${v.fullName || v.email}`}
                        checked={selected.has(v.id)}
                        onChange={() => toggle(v.id)}
                        className="h-4 w-4 accent-[rgb(var(--adm-accent))]"
                      />
                    </TD>
                    <TD className="min-w-[140px]">
                      <Link to={href} onClick={(e) => e.stopPropagation()} className="font-medium hover:underline">
                        {v.fullName || 'Sin nombre'}
                      </Link>
                      <p className="max-w-[170px] truncate text-xs text-adm-muted sm:max-w-[260px]">{v.email || v.id}</p>
                    </TD>
                    <TD className="hidden whitespace-nowrap lg:table-cell">
                      {v.whatsapp ? (
                        <a
                          href={`https://wa.me/${String(v.whatsapp).replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-adm-muted hover:text-adm-accent hover:underline"
                        >
                          {v.whatsapp}
                        </a>
                      ) : '—'}
                    </TD>
                    <TD className="hidden md:table-cell">
                      <p className="max-w-[200px] truncate">{v.procedencia || '—'}</p>
                      <p className="text-xs text-adm-muted">{v.ciudad || ''}</p>
                    </TD>
                    <TD className="hidden sm:table-cell"><DayChips volunteer={v} /></TD>
                    <TD className="text-right font-semibold tabular-nums">{Number(v.creditos) || 0}</TD>
                    <TD className="hidden whitespace-nowrap text-xs text-adm-muted xl:table-cell" title={formatDate(v.fechaRegistro)}>{formatRelative(v.fechaRegistro)}</TD>
                    <TD className="hidden sm:table-cell"><ChevronRight className="h-4 w-4 text-adm-muted" aria-hidden="true" /></TD>
                  </TR>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-adm-muted">{rows.length} de {volunteers.length} voluntario(s)</p>
        <ChipLegend />
      </div>
    </div>
  );
}
