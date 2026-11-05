// Cola de aprobación de horas: la tarea principal del equipo. Rápida con teclado (j/k, x, a, r, Enter).
import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ClipboardCheck, Download, RotateCcw, X } from 'lucide-react';
import {
  Badge, Button, Card, EmptyState, Kbd, SearchInput, Skeleton, Table, TD, TH, THead, TR,
} from '@/admin/ui';
import { downloadCsv, formatDateTime, formatRelative, normalize } from '@/admin/lib';
import { cn } from '@/lib/utils';
import useLogActions from './useLogActions';
import { ProofThumb, ProofViewer, SourceBadge, StatusCell } from './LogBits';
import { emailKey, logCredits, logStatus, round2 } from './utils';

const STATUS_FILTERS = [
  { value: 'pending', label: 'Pendientes' },
  { value: 'approved', label: 'Aprobadas' },
  { value: 'rejected', label: 'Rechazadas' },
  { value: 'all', label: 'Todas' },
];

const typingTarget = (el) => el && (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable);

export default function ApprovalsTab({ logs, byEmail, loading }) {
  const [status, setStatus] = useState('pending');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search); // filtra sin bloquear el tecleo
  const [selected, setSelected] = useState(() => new Set());
  const [active, setActive] = useState(0);
  const [viewing, setViewing] = useState(null);
  const { approve, reject, revert, busyIds, modal } = useLogActions(byEmail);

  const counts = useMemo(() => logs.reduce((acc, l) => { acc[logStatus(l)] += 1; return acc; }, { pending: 0, approved: 0, rejected: 0 }), [logs]);

  const rows = useMemo(() => {
    const q = normalize(deferredSearch.trim());
    const list = logs.filter((l) => (status === 'all' || logStatus(l) === status)
      && (!q || normalize([l.fullName, l.email, l.activityName, l.sourceEventName, l.attendanceDate].join(' ')).includes(q)));
    // Pendientes: los más antiguos primero (orden de llegada); el resto, lo más reciente primero.
    return status === 'pending' ? [...list].reverse() : list;
  }, [logs, status, deferredSearch]);

  // Limpia selección de filas que ya no están visibles (p. ej. aprobadas por otro admin).
  useEffect(() => {
    setSelected((s) => {
      const visible = new Set(rows.map((r) => r.id));
      const next = new Set([...s].filter((id) => visible.has(id)));
      return next.size === s.size ? s : next;
    });
    setActive((i) => Math.min(i, Math.max(0, rows.length - 1)));
  }, [rows]);

  const selectedLogs = rows.filter((r) => selected.has(r.id));
  const selectedPending = selectedLogs.filter((l) => logStatus(l) === 'pending');
  const toggle = (id) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));

  // Mantiene el visor en el registro siguiente tras decidir (flujo "foto → aprobar → siguiente").
  const decideAndAdvance = async (log, action) => {
    const idx = rows.findIndex((r) => r.id === log.id);
    const next = rows.slice(idx + 1).find((r) => logStatus(r) === 'pending' && r.proofImageUrl);
    if (action === 'approve') {
      const ok = await approve([log]);
      if (ok) setViewing(next || null);
    } else {
      reject([log], () => setViewing(next || null));
    }
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey || typingTarget(e.target) || document.querySelector('[role="dialog"]')) return;
      const row = rows[active];
      const key = e.key.toLowerCase();
      if (key === 'j' || key === 'k') {
        e.preventDefault();
        const next = Math.max(0, Math.min(rows.length - 1, active + (key === 'j' ? 1 : -1)));
        setActive(next);
        document.querySelector(`[data-row="${next}"]`)?.scrollIntoView({ block: 'nearest' });
        return;
      }
      if (!row) return;
      if (key === 'x') { e.preventDefault(); toggle(row.id); }
      if (key === 'a' && logStatus(row) !== 'approved') { e.preventDefault(); approve([row]); }
      if (key === 'r' && logStatus(row) === 'pending') { e.preventDefault(); reject([row]); }
      if (e.key === 'Enter' && row.proofImageUrl && e.target === document.body) { e.preventDefault(); setViewing(row); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const exportCsv = () => downloadCsv(`horas-voluntariado-${status}`, [
    { key: 'fullName', label: 'Nombre' },
    { key: 'email', label: 'Correo' },
    { key: 'activityName', label: 'Actividad' },
    { key: 'attendanceDate', label: 'Fecha' },
    { key: 'startTime', label: 'Inicio' },
    { key: 'endTime', label: 'Fin' },
    { key: 'registeredHours', label: 'Horas' },
    { label: 'Créditos', value: (l) => logCredits(l) },
    { label: 'Estado', value: (l) => ({ pending: 'Pendiente', approved: 'Aprobado', rejected: 'Rechazado' })[logStatus(l)] },
    { key: 'creditsAssignedBy', label: 'Aprobado por' },
    { label: 'Aprobado el', value: (l) => formatDateTime(l.creditsAssignedAt) },
    { key: 'rejectionReason', label: 'Motivo de rechazo' },
    { key: 'proofImageUrl', label: 'Evidencia' },
  ], rows);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div role="radiogroup" aria-label="Estado" className="flex w-fit flex-wrap rounded-lg border border-adm-border bg-adm-surface p-0.5">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              role="radio"
              aria-checked={status === f.value}
              onClick={() => { setStatus(f.value); setActive(0); }}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-adm-accent',
                status === f.value ? 'bg-adm-surface-2 font-medium text-adm-text' : 'text-adm-muted hover:text-adm-text',
              )}
            >
              {f.label}
              {f.value !== 'all' && <span className="ml-1.5 tabular-nums text-xs text-adm-muted">{counts[f.value]}</span>}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar por nombre, correo o actividad…" className="w-full lg:w-80" />
          <Button variant="outline" size="icon" onClick={exportCsv} disabled={!rows.length} aria-label="Exportar CSV" title="Exportar CSV">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="sticky top-16 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-adm-accent/40 bg-adm-surface px-4 py-2.5 shadow-sm" role="region" aria-label="Acciones en lote">
          <span className="text-sm text-adm-text">
            <strong>{selected.size}</strong> seleccionado(s)
            {selectedPending.length > 0 && <> · {round2(selectedPending.reduce((a, l) => a + logCredits(l), 0))} crédito(s) pendientes</>}
          </span>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Limpiar</Button>
            <Button size="sm" variant="danger-ghost" disabled={!selectedPending.length} onClick={() => reject(selectedPending, () => setSelected(new Set()))}>
              <X className="h-3.5 w-3.5" aria-hidden="true" /> Rechazar
            </Button>
            <Button
              size="sm"
              variant="primary"
              disabled={!selectedLogs.some((l) => logStatus(l) !== 'approved')}
              onClick={async () => { if (await approve(selectedLogs.filter((l) => logStatus(l) !== 'approved'))) setSelected(new Set()); }}
            >
              <Check className="h-3.5 w-3.5" aria-hidden="true" /> Aprobar seleccionados
            </Button>
          </div>
        </div>
      )}

      <Card className="overflow-hidden">
        {loading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={ClipboardCheck}
            title={status === 'pending' && !search ? 'Todo al día' : 'Sin registros'}
            description={status === 'pending' && !search ? 'No hay horas pendientes de aprobar.' : 'Ningún registro coincide con el filtro.'}
          />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH className="hidden w-10 sm:table-cell">
                  <input
                    type="checkbox"
                    aria-label="Seleccionar todos"
                    checked={allChecked}
                    onChange={() => setSelected(allChecked ? new Set() : new Set(rows.map((r) => r.id)))}
                    className="h-4 w-4 accent-[rgb(var(--adm-accent))]"
                  />
                </TH>
                <TH className="w-14 px-2 sm:px-4">Foto</TH>
                <TH className="px-2 sm:px-4">Voluntario</TH>
                <TH className="hidden md:table-cell">Actividad</TH>
                <TH className="hidden sm:table-cell">Fecha</TH>
                <TH className="hidden text-right sm:table-cell">Horas</TH>
                <TH className="px-2 text-right sm:px-4">Créditos</TH>
                {status !== 'pending' && <TH className="hidden lg:table-cell">Estado</TH>}
                <TH className="px-2 text-right sm:px-4"><span className="sr-only">Acciones</span></TH>
              </tr>
            </THead>
            <tbody>
              {rows.map((log, i) => {
                const st = logStatus(log);
                const busy = busyIds.has(log.id);
                const missing = !byEmail.get(emailKey(log.email));
                const volunteer = byEmail.get(emailKey(log.email));
                return (
                  <TR
                    key={log.id}
                    data-row={i}
                    selected={selected.has(log.id)}
                    onClick={() => setActive(i)}
                    className={cn(i === active && 'outline outline-2 -outline-offset-2 outline-adm-accent/50')}
                  >
                    <TD className="hidden sm:table-cell">
                      <input
                        type="checkbox"
                        aria-label={`Seleccionar ${log.fullName || log.email}`}
                        checked={selected.has(log.id)}
                        onChange={() => toggle(log.id)}
                        className="h-4 w-4 accent-[rgb(var(--adm-accent))]"
                      />
                    </TD>
                    <TD className="px-2 sm:px-4"><ProofThumb log={log} onOpen={setViewing} /></TD>
                    <TD className="px-2 sm:px-4">
                      {volunteer ? (
                        <Link to={encodeURIComponent(volunteer.id)} className="block max-w-[100px] truncate font-medium hover:underline sm:max-w-[220px]">{log.fullName || '—'}</Link>
                      ) : <span className="block max-w-[100px] truncate font-medium sm:max-w-[220px]">{log.fullName || '—'}</span>}
                      <p className="max-w-[100px] truncate text-xs text-adm-muted sm:max-w-[220px]">{log.email || '—'}</p>
                      {missing && <Badge tone="danger" className="mt-1">Sin inscripción</Badge>}
                      <p className="mt-0.5 max-w-[100px] truncate text-xs text-adm-muted sm:max-w-[220px] md:hidden">{log.activityName}</p>
                    </TD>
                    <TD className="hidden md:table-cell">
                      <p className="max-w-[220px] truncate" title={log.activityName}>{log.activityName || '—'}</p>
                      <div className="mt-1"><SourceBadge log={log} /></div>
                    </TD>
                    <TD className="hidden whitespace-nowrap sm:table-cell">
                      <p className="whitespace-nowrap">{log.attendanceDate || '—'} <span className="text-xs text-adm-muted">{log.startTime || '--:--'}–{log.endTime || '--:--'}</span></p>
                      <p className="whitespace-nowrap text-xs text-adm-muted">enviado {formatRelative(log.createdAt)}</p>
                    </TD>
                    <TD className="hidden text-right tabular-nums sm:table-cell">{Number(log.registeredHours || 0)}</TD>
                    <TD className="px-2 text-right font-semibold tabular-nums sm:px-4">
                      {logCredits(log)}
                      <p className="text-xs font-normal text-adm-muted sm:hidden">{Number(log.registeredHours || 0)} h</p>
                    </TD>
                    {status !== 'pending' && <TD className="hidden lg:table-cell"><StatusCell log={log} /></TD>}
                    <TD className="px-2 text-right sm:px-4">
                      <div className="flex justify-end gap-1">
                        {st === 'approved' ? (
                          <Button size="sm" variant="ghost" onClick={() => revert(log)} disabled={busy} title="Revertir aprobación">
                            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> <span className="hidden xl:inline">Revertir</span>
                          </Button>
                        ) : (
                          <>
                            {st === 'pending' && (
                              <Button size="icon" variant="danger-ghost" onClick={() => reject([log])} disabled={busy} aria-label={`Rechazar horas de ${log.fullName || log.email}`} title="Rechazar (r)">
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant={st === 'pending' ? 'primary' : 'outline'}
                              onClick={() => approve([log])}
                              loading={busy}
                              disabled={missing}
                              title={missing ? 'No hay inscripción con este correo' : 'Aprobar (a)'}
                              aria-label={`Aprobar horas de ${log.fullName || log.email}`}
                            >
                              {!busy && <Check className="h-3.5 w-3.5" aria-hidden="true" />}<span className="hidden sm:inline">Aprobar</span>
                            </Button>
                          </>
                        )}
                      </div>
                    </TD>
                  </TR>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      <p className="hidden flex-wrap items-center gap-x-3 gap-y-1 text-xs text-adm-muted md:flex">
        Atajos: <span><Kbd>j</Kbd>/<Kbd>k</Kbd> moverse</span><span><Kbd>x</Kbd> seleccionar</span>
        <span><Kbd>a</Kbd> aprobar</span><span><Kbd>r</Kbd> rechazar</span><span><Kbd>Enter</Kbd> ver foto</span>
        <span className="ml-auto">1 crédito = 2 horas</span>
      </p>

      <ProofViewer
        log={viewing}
        busy={viewing && busyIds.has(viewing.id)}
        onClose={() => setViewing(null)}
        onApprove={(log) => decideAndAdvance(log, 'approve')}
        onReject={(log) => decideAndAdvance(log, 'reject')}
      />
      {modal}
    </div>
  );
}
