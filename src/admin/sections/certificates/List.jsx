// Certificados emitidos: búsqueda, filtros, enlaces de validación, descarga y PDF combinado por evento.
import React, { useDeferredValue, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Award, Copy, Download, ExternalLink, FileStack, FileDown, Sparkles, CalendarDays, Trash2 } from 'lucide-react';
import {
  Badge, Button, Card, Checkbox, EmptyState, PageHeader, SearchInput, Select, Skeleton, StatCard, Table, TD, TH, THead, TR, useDangerConfirm,
} from '@/admin/ui';
import { useToast } from '@/components/ui/use-toast';
import { downloadCsv, formatDate, logActivity, normalize, toDate, validationUrlFor } from '@/admin/lib';
import { callFunction, deleteCertificates, getCallableErrorMessage, loadCertificates, loadPointsByEmail } from './api';
import PointsCell from './PointsCell';

const PAGE = 100;
const TYPE_TONE = { participante: 'info', ponente: 'accent', staff: 'warning' };
const CSV_COLUMNS = [
  { key: 'nombreUsuario', label: 'Nombre' },
  { key: 'correoUsuario', label: 'Correo' },
  { key: 'nombreEvento', label: 'Evento' },
  { key: 'tipo', label: 'Tipo' },
  { key: 'modalidad', label: 'Modalidad' },
  { key: 'fechaEmision', label: 'Emitido', value: (r) => toDate(r.fechaEmision) },
  { key: 'idValidacion', label: 'Código' },
  { key: 'url', label: 'Validación', value: (r) => validationUrlFor(r.idValidacion) },
  { key: 'urlPdf', label: 'PDF' },
];

export async function mergeAndOpen(eventName, toast) {
  try {
    const { merged, urlPdf, pages, reason } = await callFunction('mergeCertificatesPdf', { eventName });
    if (!merged) { toast({ title: 'No se pudo generar el PDF', description: reason || 'Sin certificados', variant: 'destructive' }); return; }
    await logActivity('certificados.pdf_combinado', `Descargó el PDF combinado de "${eventName}" (${pages} páginas)`, { eventName, pages });
    toast({ title: 'PDF combinado listo', description: `${pages || 0} páginas` });
    if (urlPdf) window.open(urlPdf, '_blank', 'noopener');
  } catch (error) {
    toast({ title: 'Error al combinar PDFs', description: getCallableErrorMessage(error), variant: 'destructive' });
  }
}

export default function CertificateList() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();
  const event = params.get('evento') || '';
  const [rows, setRows] = useState(null);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search); // filtra sin bloquear el tecleo
  const [type, setType] = useState('');
  const [sort, setSort] = useState({ key: 'fechaEmision', dir: 'desc' });
  const [selected, setSelected] = useState(new Set());
  const [limit, setLimit] = useState(PAGE);
  const [merging, setMerging] = useState(false);
  const [points, setPoints] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const confirmDanger = useDangerConfirm();

  const load = useCallback(async () => setRows(await loadCertificates()), []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadPointsByEmail().then(setPoints); }, []);

  const removeSelected = async () => {
    const list = selectedRows;
    const n = list.length;
    const ok = await confirmDanger({
      title: `¿Eliminar ${n} certificado${n === 1 ? '' : 's'}?`,
      description: 'Se borran el registro y el PDF. Sus códigos de validación dejarán de funcionar y los puntos otorgados no se revierten.',
      phrase: n === 1 ? list[0].correoUsuario : `ELIMINAR ${n}`,
      confirmLabel: 'Eliminar certificados',
    });
    if (!ok) return;
    setDeleting(true);
    try {
      await deleteCertificates(list);
      await logActivity('certificados.eliminados', n === 1 ? `Eliminó el certificado de ${list[0].nombreUsuario || list[0].correoUsuario} ("${list[0].nombreEvento}")` : `Eliminó ${n} certificados`, { ids: list.map((r) => r.id).slice(0, 50) });
      const ids = new Set(list.map((r) => r.id));
      setRows((prev) => prev.filter((r) => !ids.has(r.id)));
      setSelected(new Set());
      toast({ title: 'Certificados eliminados', description: `${n} eliminado${n === 1 ? '' : 's'}` });
    } catch (error) {
      toast({ title: 'No se pudieron eliminar', description: error?.message, variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  const setEvent = (value) => {
    const next = new URLSearchParams(params);
    if (value) next.set('evento', value); else next.delete('evento');
    setParams(next, { replace: true });
    setSelected(new Set());
  };

  const events = useMemo(() => [...new Set((rows || []).map((r) => r.nombreEvento).filter(Boolean))].sort(), [rows]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const q = normalize(deferredSearch);
    const list = rows.filter((r) => (!event || r.nombreEvento === event)
      && (!type || (r.tipo || 'participante') === type)
      && (!q || [r.nombreUsuario, r.correoUsuario, r.nombreEvento, r.idValidacion].some((v) => normalize(v).includes(q))));
    const val = (r) => (sort.key === 'fechaEmision' ? toDate(r.fechaEmision)?.getTime() || 0 : normalize(r[sort.key]));
    return list.sort((a, b) => {
      const [x, y] = [val(a), val(b)];
      return (x < y ? -1 : x > y ? 1 : 0) * (sort.dir === 'asc' ? 1 : -1);
    });
  }, [rows, deferredSearch, event, type, sort]);

  const sortBy = (key) => setSort((s) => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }));
  const sortOf = (key) => (sort.key === key ? sort.dir : undefined);
  const visible = filtered.slice(0, limit);
  const allSelected = visible.length > 0 && visible.every((r) => selected.has(r.id));
  const toggle = (id) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const selectedRows = filtered.filter((r) => selected.has(r.id));

  const copy = async (text, what = 'Enlace copiado') => {
    try { await navigator.clipboard.writeText(text); toast({ title: what }); } catch { toast({ title: 'No se pudo copiar', variant: 'destructive' }); }
  };

  const merge = async () => { setMerging(true); await mergeAndOpen(event, toast); setMerging(false); };
  const thisMonth = (rows || []).filter((r) => { const d = toDate(r.fechaEmision); return d && Date.now() - d.getTime() < 30 * 864e5; }).length;

  return (
    <div>
      <PageHeader
        title="Certificados"
        description="Certificados emitidos, sus enlaces públicos de validación y generación por evento."
        actions={(
          <>
            <Button variant="outline" disabled={!filtered.length} onClick={() => downloadCsv(`certificados${event ? `-${event}` : ''}`, CSV_COLUMNS, selectedRows.length ? selectedRows : filtered)}>
              <FileDown className="h-4 w-4" aria-hidden="true" />{selectedRows.length ? `Exportar ${selectedRows.length}` : 'Exportar CSV'}
            </Button>
            <Button variant="primary" onClick={() => navigate(`generar${event ? `?evento=${encodeURIComponent(event)}` : ''}`)}>
              <Sparkles className="h-4 w-4" aria-hidden="true" />Generar certificados
            </Button>
          </>
        )}
      >
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <StatCard label="Emitidos" value={rows ? rows.length : '—'} icon={Award} />
          <StatCard label="Eventos con certificados" value={rows ? events.length : '—'} icon={CalendarDays} tone="info" />
          <StatCard label="Últimos 30 días" value={rows ? thisMonth : '—'} icon={Sparkles} tone="success" />
        </div>
      </PageHeader>

      {event && (
        <Card className="mb-4 flex flex-wrap items-center justify-between gap-3 border-adm-accent/40 bg-adm-accent/5 px-4 py-3">
          <p className="text-sm text-adm-text">Mostrando el evento <strong>{event}</strong>.</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" loading={merging} onClick={merge}><FileStack className="h-3.5 w-3.5" aria-hidden="true" />PDF combinado</Button>
            <Button size="sm" variant="primary" onClick={() => navigate(`generar?evento=${encodeURIComponent(event)}`)}><Sparkles className="h-3.5 w-3.5" aria-hidden="true" />Generar para este evento</Button>
            <Button size="sm" variant="ghost" onClick={() => setEvent('')}>Ver todos</Button>
          </div>
        </Card>
      )}

      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-adm-border p-3">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setLimit(PAGE); }} placeholder="Buscar nombre, correo, evento o código…" className="min-w-[200px] flex-1" />
          <Select aria-label="Filtrar por evento" value={event} onChange={(e) => setEvent(e.target.value)} className="w-full sm:w-56">
            <option value="">Todos los eventos</option>
            {event && !events.includes(event) && <option value={event}>{event}</option>}
            {events.map((e) => <option key={e} value={e}>{e}</option>)}
          </Select>
          <Select aria-label="Filtrar por tipo" value={type} onChange={(e) => setType(e.target.value)} className="w-full sm:w-40">
            <option value="">Todos los tipos</option>
            <option value="participante">Participante</option>
            <option value="ponente">Ponente</option>
            <option value="staff">Staff</option>
          </Select>
        </div>
        {selectedRows.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-adm-border bg-adm-accent/5 px-4 py-2 text-sm" role="status">
            <span className="text-adm-text">{selectedRows.length} seleccionados</span>
            <Button size="sm" variant="ghost" onClick={() => copy(selectedRows.map((r) => validationUrlFor(r.idValidacion)).join('\n'), 'Enlaces copiados')}><Copy className="h-3.5 w-3.5" aria-hidden="true" />Copiar enlaces</Button>
            <Button size="sm" variant="ghost" onClick={() => downloadCsv('certificados-seleccion', CSV_COLUMNS, selectedRows)}><FileDown className="h-3.5 w-3.5" aria-hidden="true" />Exportar CSV</Button>
            <Button size="sm" variant="danger-ghost" loading={deleting} onClick={removeSelected}><Trash2 className="h-3.5 w-3.5" aria-hidden="true" />Eliminar</Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Quitar selección</Button>
          </div>
        )}

        {!rows ? (
          <div className="space-y-2 p-4">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : !filtered.length ? (
          <EmptyState
            icon={Award}
            title={rows.length ? 'Sin resultados' : 'Aún no hay certificados'}
            description={rows.length ? 'Prueba con otra búsqueda o filtro.' : 'Genera los certificados de un evento cuando hayas marcado la asistencia.'}
            action={!rows.length && <Button variant="primary" onClick={() => navigate('generar')}>Generar certificados</Button>}
          />
        ) : (
          <>
            <Table sticky>
              <THead>
                <tr>
                  <TH className="w-10">
                    <Checkbox aria-label="Seleccionar visibles" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(visible.map((r) => r.id)))} />
                  </TH>
                  <TH sort={sortOf('nombreUsuario')} onSort={() => sortBy('nombreUsuario')}>Persona</TH>
                  <TH className="hidden md:table-cell" sort={sortOf('nombreEvento')} onSort={() => sortBy('nombreEvento')}>Evento</TH>
                  <TH className="hidden sm:table-cell">Tipo</TH>
                  <TH className="hidden lg:table-cell" sort={sortOf('fechaEmision')} onSort={() => sortBy('fechaEmision')}>Emitido</TH>
                  <TH className="text-right">Puntos</TH>
                  <TH className="text-right">Acciones</TH>
                </tr>
              </THead>
              <tbody>
                {visible.map((r) => {
                  const url = validationUrlFor(r.idValidacion);
                  return (
                    <TR key={r.id} selected={selected.has(r.id)}>
                      <TD><Checkbox aria-label={`Seleccionar ${r.nombreUsuario}`} checked={selected.has(r.id)} onChange={() => toggle(r.id)} /></TD>
                      <TD className="min-w-[180px]">
                        <p className="font-medium">{r.nombreUsuario || '—'}</p>
                        <p className="text-xs text-adm-muted">{r.correoUsuario}</p>
                        <p className="text-xs text-adm-muted md:hidden">{r.nombreEvento}</p>
                      </TD>
                      <TD className="hidden max-w-[260px] truncate md:table-cell" title={r.nombreEvento}>{r.nombreEvento}</TD>
                      <TD className="hidden sm:table-cell">
                        <Badge tone={TYPE_TONE[r.tipo] || 'neutral'}>{r.tipo || 'participante'}</Badge>
                        {r.modalidad && <span className="ml-1.5 text-xs capitalize text-adm-muted">{r.modalidad}</span>}
                      </TD>
                      <TD className="hidden whitespace-nowrap text-adm-muted lg:table-cell">{formatDate(r.fechaEmision)}</TD>
                      <TD className="text-right"><PointsCell person={points?.get(String(r.correoUsuario || '').toLowerCase())} loading={!points} /></TD>
                      <TD>
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" aria-label="Copiar enlace de validación" title="Copiar enlace" onClick={() => copy(url)}><Copy className="h-4 w-4" /></Button>
                          <a href={url} target="_blank" rel="noopener noreferrer" aria-label="Abrir página de validación" title="Abrir validación" className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-adm-muted hover:bg-adm-surface-2 hover:text-adm-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-adm-accent">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                          {r.urlPdf ? (
                            <a href={r.urlPdf} target="_blank" rel="noopener noreferrer" aria-label="Descargar PDF" title="Descargar PDF" className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-adm-muted hover:bg-adm-surface-2 hover:text-adm-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-adm-accent">
                              <Download className="h-4 w-4" />
                            </a>
                          ) : <span className="inline-flex h-9 w-9 items-center justify-center text-adm-muted/50" title="Sin PDF"><Download className="h-4 w-4" aria-label="Sin PDF" /></span>}
                        </div>
                      </TD>
                    </TR>
                  );
                })}
              </tbody>
            </Table>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-adm-border px-4 py-3 text-xs text-adm-muted">
              <span>Mostrando {visible.length} de {filtered.length}</span>
              {filtered.length > limit && <Button size="sm" variant="outline" onClick={() => setLimit((l) => l + PAGE)}>Mostrar más</Button>}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
