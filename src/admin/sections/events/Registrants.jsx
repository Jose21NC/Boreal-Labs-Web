// Tabla de inscritos de un evento: asistencia rápida (optimista), filtros, selección masiva y exportación.
import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Columns, Copy, Download, Mail, MailCheck, Trash2, UserCheck, UserPlus, UserX, Users, X } from 'lucide-react';
import {
  Badge, Button, Card, Checkbox, EmptyState, Kbd, SearchInput, Select, Switch, Table, TD, TH, THead, TR, useConfirm,
} from '@/admin/ui';
import { downloadCsv, formatDate, isPresent, logActivity, normalize, toDate } from '@/admin/lib';
import { useToast } from '@/components/ui/use-toast';
import { useEventsStore } from './store';
import { MODALIDADES, ROLES, attendanceValue, labelOf, matchesSearch, modalidadOf, roleOf } from './data';
import { deleteRegistrations, setAttendance, updateRegistration } from './actions';
import { AddRegistrationModal, AnswerValue, RegistrationDetailModal } from './RegistrationModals';
import { answerText } from '@/lib/eventForms';
import SeatConfirmModal from './SeatConfirmModal';

const OPTIONAL = [
  { key: 'whatsapp', label: 'WhatsApp', value: (r) => r.userWhatsapp || r.whatsapp },
  { key: 'university', label: 'Universidad / cargo', value: (r) => r.userUniversity || r.university || r.cargo || r.userCargo },
  { key: 'country', label: 'País', value: (r) => r.userCountry || r.country },
  { key: 'department', label: 'Departamento', value: (r) => r.userDepartment || r.department },
  { key: 'comunidad', label: 'Miembro', value: (r) => (r.isCommunityMember == null ? '' : r.isCommunityMember ? 'Sí' : 'No') },
];
const COLS_KEY = 'admin:visibleColumns'; // misma clave que el panel anterior
const PAGE = 200;

const readCols = () => {
  try { return JSON.parse(localStorage.getItem(COLS_KEY)) || {}; } catch { return {}; }
};

const SORTS = {
  name: (a, b) => (a.userName || '').localeCompare(b.userName || '', 'es'),
  date: (a, b) => (toDate(a.registrationDate)?.getTime() || 0) - (toDate(b.registrationDate)?.getTime() || 0),
  status: (a, b) => Number(isPresent(a.statusAsistencia)) - Number(isPresent(b.statusAsistencia)),
};

async function copyText(text, toast, what) {
  try {
    await navigator.clipboard.writeText(text);
    toast({ title: `${what} copiados` });
  } catch {
    toast({ title: 'No se pudo copiar', description: 'El navegador bloqueó el portapapeles.', variant: 'destructive' });
  }
}

export default function Registrants({ group }) {
  const { patchRegs, reload } = useEventsStore();

  // Cambio rápido tocando el badge: rol en ciclo y modalidad (solo si el evento ofrece ambas). UI optimista.
  const eventModes = (group.doc?.tipoAsistenciaOptions || group.doc?.tipoAsistencia || ['Presencial', 'Virtual']);
  const bothModes = group.kind !== 'public' || (Array.isArray(eventModes) && ['presencial', 'virtual'].every((m) => eventModes.some((o) => String(o).toLowerCase().includes(m))));
  const quickUpdate = async (r, updates, summary) => {
    const ids = new Set([r.id]);
    const before = Object.fromEntries(Object.keys(updates).map((k) => [k, r[k]]));
    patchRegs(ids, () => updates);
    try {
      await updateRegistration(r.id, updates);
      logActivity('eventos.registro_editado', summary, { id: r.id, ...updates });
    } catch (e) {
      patchRegs(ids, () => before);
      toast({ title: 'No se pudo actualizar', description: e?.message, variant: 'destructive' });
    }
  };
  const cycleRole = (r) => {
    const order = ROLES.map((x) => x.value);
    const next = order[(order.indexOf(roleOf(r)) + 1) % order.length];
    quickUpdate(r, { tipo: next }, `Cambió el rol de ${r.userName || r.userEmail} a ${labelOf(ROLES, next)} en "${group.name}"`);
  };
  const toggleModalidad = (r) => {
    const next = modalidadOf(r) === 'virtual' ? 'presencial' : 'virtual';
    const label = labelOf(MODALIDADES, next);
    // Los registros públicos guardan la modalidad en tipoAsistencia (lo usan los correos y el Meet): mantenerlo igual.
    const legacyRole = ['ponente', 'staff', 'participante'].includes(String(r.tipoAsistencia || '').toLowerCase());
    quickUpdate(r, { modalidad: next, ...(r.tipoAsistencia && !legacyRole ? { tipoAsistencia: label } : {}) }, `Cambió la modalidad de ${r.userName || r.userEmail} a ${label} en "${group.name}"`);
  };
  const { toast } = useToast();
  const confirm = useConfirm();
  const searchRef = useRef(null);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search); // filtra sin bloquear el tecleo
  const [role, setRole] = useState('');
  const [modalidad, setModalidad] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState({ key: 'name', dir: 'asc' });
  const [selected, setSelected] = useState(() => new Set());
  const [cols, setCols] = useState(readCols);
  const [limit, setLimit] = useState(PAGE);
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [bulkBusy, setBulkBusy] = useState(null);
  const [seat, setSeat] = useState('');
  const [mailMode, setMailMode] = useState(null); // null | 'seat' | 'custom'

  useEffect(() => { try { localStorage.setItem(COLS_KEY, JSON.stringify(cols)); } catch { /* modo privado */ } }, [cols]);
  useEffect(() => { setSelected(new Set()); }, [group.key]);

  // "/" enfoca la búsqueda (como en GitHub/Linear) si no se está escribiendo en otro campo.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || /input|textarea|select/i.test(e.target.tagName) || e.target.isContentEditable) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const rows = useMemo(() => {
    const q = normalize(deferredSearch.trim());
    const list = group.regs.filter((r) => matchesSearch(r, q)
      && (!role || roleOf(r) === role)
      && (!modalidad || modalidadOf(r) === modalidad)
      && (!status || isPresent(r.statusAsistencia) === (status === 'present'))
      && (!seat || !!r.seatConfirmed === (seat === 'yes')));
    return list.sort((a, b) => SORTS[sort.key](a, b) * (sort.dir === 'asc' ? 1 : -1));
  }, [group.regs, deferredSearch, role, modalidad, status, seat, sort]);

  // Una columna opcional por cada campo adicional del evento (clave f:<id> en las preferencias).
  const optional = useMemo(() => [...OPTIONAL, ...(group.doc?.formFields || []).map((f) => ({
    key: `f:${f.id}`, label: f.label, value: (r) => answerText(r.answers?.[f.id]), raw: (r) => r.answers?.[f.id],
  }))], [group.doc]);
  const shownCols = optional.filter((c) => cols[c.key]);
  const selectedRows = group.regs.filter((r) => selected.has(r.id));
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const filtersOn = search || role || modalidad || status || seat;

  const sortProps = (key) => ({
    sort: sort.key === key ? sort.dir : undefined,
    onSort: () => setSort((s) => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' })),
  });

  const toggleOne = (id) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  /** UI optimista: pinta el cambio al instante y lo revierte si Firestore falla. */
  const applyAttendance = async (targets, present) => {
    const changing = targets.filter((r) => isPresent(r.statusAsistencia) !== present);
    if (!changing.length) return;
    const ids = new Set(changing.map((r) => r.id));
    const before = new Map(changing.map((r) => [r.id, r.statusAsistencia]));
    patchRegs(ids, (r) => ({ statusAsistencia: attendanceValue(r.statusAsistencia, present) }));
    try {
      await setAttendance(changing, present);
      const label = present ? 'presente' : 'ausente';
      await logActivity(
        'eventos.asistencia',
        changing.length === 1 ? `Marcó ${label} a ${changing[0].userName || changing[0].userEmail} en "${group.name}"` : `Marcó ${changing.length} ${label}s en "${group.name}"`,
        { event: group.name, count: changing.length, present },
      );
      if (changing.length > 1) toast({ title: `${changing.length} marcados como ${label}s` });
    } catch (e) {
      console.error(e);
      patchRegs(ids, (r) => ({ statusAsistencia: before.get(r.id) }));
      toast({ title: 'No se pudo actualizar la asistencia', description: e?.message, variant: 'destructive' });
    }
  };

  const bulkAttendance = async (present) => {
    setBulkBusy(present ? 'present' : 'absent');
    await applyAttendance(selectedRows, present);
    setBulkBusy(null);
    setSelected(new Set());
  };

  const bulkDelete = async () => {
    const n = selectedRows.length;
    const ok = await confirm({
      title: `¿Eliminar ${n} registro${n === 1 ? '' : 's'}?`,
      description: `Se borran de "${group.name}"${group.kind === 'public' ? ' y se libera su cupo' : ''}. No se puede deshacer.`,
      confirmLabel: 'Eliminar',
      tone: 'danger',
    });
    if (!ok) return;
    setBulkBusy('delete');
    try {
      await deleteRegistrations(selectedRows, new Set(group.kind === 'public' ? [group.id] : []));
      await reload();
      await logActivity('eventos.registros_eliminados', `Eliminó ${n} registros de "${group.name}"`, { event: group.name, ids: selectedRows.map((r) => r.id) });
      toast({ title: `${n} registro(s) eliminados` });
      setSelected(new Set());
    } catch (e) {
      console.error(e);
      toast({ title: 'No se pudieron eliminar', description: e?.message, variant: 'destructive' });
    } finally {
      setBulkBusy(null);
    }
  };

  const exportCsv = () => {
    const source = selectedRows.length ? selectedRows : rows;
    downloadCsv(`inscritos-${normalize(group.name).replace(/[^a-z0-9]+/g, '-')}`, [
      { label: 'Nombre', value: (r) => r.userName },
      { label: 'Correo', value: (r) => r.userEmail },
      ...OPTIONAL.map((c) => ({ label: c.label, value: c.value })),
      { label: 'Rol', value: (r) => labelOf(ROLES, roleOf(r)) },
      { label: 'Ponencia', value: (r) => (roleOf(r) === 'ponente' ? r.customEventName || '' : '') },
      { label: 'Modalidad', value: (r) => labelOf(MODALIDADES, modalidadOf(r)) },
      { label: 'Cupo confirmado', value: (r) => (r.seatConfirmed ? 'Sí' : 'No') },
      { label: 'Asistencia', value: (r) => (isPresent(r.statusAsistencia) ? 'Presente' : 'Ausente') },
      { label: 'Fecha de registro', value: (r) => toDate(r.registrationDate) },
      ...optional.slice(OPTIONAL.length).map((c) => ({ label: c.label, value: c.value })),
    ], source);
  };

  const emailsOf = (list) => [...new Set(list.map((r) => r.userEmail).filter(Boolean))].join(', ');
  const openReg = group.regs.find((r) => r.id === openId) || null;

  return (
    <Card>
      <div className="space-y-3 border-b border-adm-border p-4">
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput
            inputRef={searchRef}
            value={search}
            onChange={(v) => { setSearch(v); setLimit(PAGE); }}
            placeholder="Buscar nombre, correo, universidad, país, WhatsApp…"
            className="min-w-[220px] flex-1"
          />
          <span className="hidden text-xs text-adm-muted lg:inline">Atajo <Kbd>/</Kbd></span>
          <Button variant="primary" onClick={() => setAdding(true)}><UserPlus className="h-4 w-4" aria-hidden="true" /> Agregar</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select aria-label="Filtrar por rol" value={role} onChange={(e) => setRole(e.target.value)} className="h-9 w-auto">
            <option value="">Todos los roles</option>
            {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </Select>
          <Select aria-label="Filtrar por modalidad" value={modalidad} onChange={(e) => setModalidad(e.target.value)} className="h-9 w-auto">
            <option value="">Toda modalidad</option>
            {MODALIDADES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </Select>
          <Select aria-label="Filtrar por asistencia" value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 w-auto">
            <option value="">Toda asistencia</option>
            <option value="present">Presentes</option>
            <option value="absent">Ausentes</option>
          </Select>
          <Select aria-label="Filtrar por cupo confirmado" value={seat} onChange={(e) => setSeat(e.target.value)} className="h-9 w-auto">
            <option value="">Todo cupo</option>
            <option value="yes">Cupo confirmado</option>
            <option value="no">Sin confirmar</option>
          </Select>
          {filtersOn && (
            <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setRole(''); setModalidad(''); setStatus(''); setSeat(''); }}>
              <X className="h-3.5 w-3.5" aria-hidden="true" /> Limpiar
            </Button>
          )}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <details className="relative">
              <summary className="flex h-8 cursor-pointer list-none items-center gap-1.5 rounded-lg border border-adm-border px-3 text-xs font-medium text-adm-text hover:bg-adm-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-adm-accent">
                <Columns className="h-3.5 w-3.5" aria-hidden="true" /> Columnas
              </summary>
              <div className="absolute right-0 z-20 mt-1 max-h-80 w-60 space-y-2 overflow-y-auto rounded-lg border border-adm-border bg-adm-surface p-3 shadow-lg">
                {optional.map((c) => (
                  <Checkbox key={c.key} label={c.label} checked={!!cols[c.key]} onChange={(e) => setCols((p) => ({ ...p, [c.key]: e.target.checked }))} className="flex" />
                ))}
              </div>
            </details>
            <Button variant="outline" size="sm" onClick={() => copyText(emailsOf(rows), toast, 'Correos')} disabled={!rows.length} title="Copia los correos de la lista filtrada">
              <Copy className="h-3.5 w-3.5" aria-hidden="true" /> Copiar correos
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!rows.length}>
              <Download className="h-3.5 w-3.5" aria-hidden="true" /> CSV
            </Button>
          </div>
        </div>
      </div>

      {selected.size > 0 && (
        /* Barra flotante: no desplaza la tabla al seleccionar (evita clics fallidos) y queda a mano en móvil. */
        <div className="sticky bottom-0 z-30 flex flex-wrap items-center gap-2 border-t border-adm-border bg-adm-surface px-4 py-2 shadow-[0_-4px_12px_rgba(0,0,0,0.08)]" role="region" aria-label="Acciones masivas">
          <span className="text-sm font-medium text-adm-text">{selected.size} seleccionado{selected.size === 1 ? '' : 's'}</span>
          <Button size="sm" variant="secondary" onClick={() => bulkAttendance(true)} loading={bulkBusy === 'present'}><UserCheck className="h-3.5 w-3.5" aria-hidden="true" /> Marcar presentes</Button>
          <Button size="sm" variant="secondary" onClick={() => bulkAttendance(false)} loading={bulkBusy === 'absent'}><UserX className="h-3.5 w-3.5" aria-hidden="true" /> Marcar ausentes</Button>
          {group.kind === 'public' && <Button size="sm" variant="primary" onClick={() => setMailMode('seat')}><MailCheck className="h-3.5 w-3.5" aria-hidden="true" /> Confirmar cupo</Button>}
          {group.kind === 'public' && <Button size="sm" variant="secondary" onClick={() => setMailMode('custom')}><Mail className="h-3.5 w-3.5" aria-hidden="true" /> Enviar correo</Button>}
          <Button size="sm" variant="ghost" onClick={() => copyText(emailsOf(selectedRows), toast, 'Correos')}><Copy className="h-3.5 w-3.5" aria-hidden="true" /> Copiar correos</Button>
          <Button size="sm" variant="danger-ghost" onClick={bulkDelete} loading={bulkBusy === 'delete'}><Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Eliminar</Button>
          <Button size="icon" variant="ghost" onClick={() => setSelected(new Set())} className="ml-auto h-8 w-8" aria-label="Deseleccionar" title="Deseleccionar"><X className="h-4 w-4" /></Button>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title={group.regs.length ? 'Nadie coincide con los filtros' : 'Aún no hay inscritos'}
          description={group.regs.length ? 'Ajusta la búsqueda o los filtros.' : 'Agrega inscritos a mano o pégalos desde Excel.'}
          action={group.regs.length ? undefined : <Button variant="primary" onClick={() => setAdding(true)}>Agregar inscritos</Button>}
        />
      ) : (
        <>
          <Table sticky className="sm:min-w-[640px]">
            <THead>
              <tr>
                <TH className="w-10">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[rgb(var(--adm-accent))]"
                    aria-label="Seleccionar todos los visibles"
                    checked={allSelected}
                    onChange={(e) => setSelected(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())}
                  />
                </TH>
                <TH {...sortProps('name')}>Inscrito</TH>
                <TH className="hidden sm:table-cell">Rol</TH>
                <TH className="hidden sm:table-cell">Modalidad</TH>
                {shownCols.map((c) => <TH key={c.key} className="hidden md:table-cell">{c.label}</TH>)}
                <TH {...sortProps('date')} className="hidden sm:table-cell">Registro</TH>
                <TH {...sortProps('status')} className="text-right">Asistencia</TH>
              </tr>
            </THead>
            <tbody>
              {rows.slice(0, limit).map((r) => {
                const present = isPresent(r.statusAsistencia);
                const tipo = roleOf(r);
                return (
                  <TR key={r.id} selected={selected.has(r.id)}>
                    <TD>
                      <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--adm-accent))]" checked={selected.has(r.id)} onChange={() => toggleOne(r.id)} aria-label={`Seleccionar ${r.userName || r.userEmail}`} />
                    </TD>
                    <TD className="max-w-[200px] sm:max-w-[280px]">
                      <button type="button" onClick={() => setOpenId(r.id)} className="block max-w-full rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-adm-accent">
                        <span className="block truncate font-medium hover:text-adm-accent">{r.userName || '—'}</span>
                        <span className="block truncate text-xs text-adm-muted">{r.userEmail}</span>
                        {r.seatConfirmed && <Badge tone="success" className="mt-1">Cupo confirmado</Badge>}
                        {/* En móvil rol y modalidad van aquí para que el interruptor de asistencia quede a la vista. */}
                        <span className="mt-1 block text-xs text-adm-muted sm:hidden">{labelOf(ROLES, tipo)} · {labelOf(MODALIDADES, modalidadOf(r))}</span>
                      </button>
                    </TD>
                    <TD className="hidden sm:table-cell">
                      <button type="button" onClick={() => cycleRole(r)} title="Cambiar rol" aria-label={`Rol: ${labelOf(ROLES, tipo)}. Cambiar`} className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-adm-accent">
                        <Badge tone={tipo === 'ponente' ? 'accent' : tipo === 'staff' ? 'info' : 'neutral'} className="cursor-pointer hover:opacity-80">{labelOf(ROLES, tipo)}</Badge>
                      </button>
                    </TD>
                    <TD className="hidden text-adm-muted sm:table-cell">
                      {bothModes ? (
                        <button type="button" onClick={() => toggleModalidad(r)} title="Cambiar modalidad" aria-label={`Modalidad: ${labelOf(MODALIDADES, modalidadOf(r))}. Cambiar`} className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-adm-accent">
                          <Badge tone={modalidadOf(r) === 'virtual' ? 'info' : 'neutral'} className="cursor-pointer hover:opacity-80">{labelOf(MODALIDADES, modalidadOf(r))}</Badge>
                        </button>
                      ) : labelOf(MODALIDADES, modalidadOf(r))}
                    </TD>
                    {shownCols.map((c) => <TD key={c.key} className="hidden max-w-[180px] truncate text-adm-muted md:table-cell" title={c.value(r) || ''}>{(c.raw ? <AnswerValue value={c.raw(r)} small /> : c.value(r)) || '—'}</TD>)}
                    <TD className="hidden whitespace-nowrap text-adm-muted sm:table-cell">{r.registrationDate ? formatDate(r.registrationDate) : '—'}</TD>
                    <TD className="text-right">
                      <span className="inline-flex items-center gap-2">
                        <span className={present ? 'hidden text-xs font-medium text-adm-success sm:inline' : 'hidden text-xs text-adm-muted sm:inline'}>{present ? 'Presente' : 'Ausente'}</span>
                        <Switch checked={present} onChange={(v) => applyAttendance([r], v)} label={`Asistencia de ${r.userName || r.userEmail}`} />
                      </span>
                    </TD>
                  </TR>
                );
              })}
            </tbody>
          </Table>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-adm-border px-4 py-3 text-xs text-adm-muted">
            <span>{Math.min(limit, rows.length)} de {rows.length}{rows.length !== group.regs.length ? ` (filtrados de ${group.regs.length})` : ''}</span>
            {rows.length > limit && <Button size="sm" variant="ghost" onClick={() => setLimit((l) => l + PAGE)}>Mostrar más</Button>}
          </div>
        </>
      )}

      {mailMode && (
        <SeatConfirmModal
          mode={mailMode}
          group={group}
          regs={selectedRows}
          onClose={() => setMailMode(null)}
          onDone={async () => { setMailMode(null); setSelected(new Set()); await reload(); }}
        />
      )}
      <AddRegistrationModal group={group} open={adding} onClose={() => setAdding(false)} />
      {openReg && (
        <RegistrationDetailModal
          key={openReg.id}
          group={group}
          reg={openReg}
          onClose={() => setOpenId(null)}
          onToggleAttendance={(r) => applyAttendance([r], !isPresent(r.statusAsistencia))}
        />
      )}
    </Card>
  );
}
