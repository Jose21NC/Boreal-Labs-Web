// Códigos QR de puntos compatibles con la Boreal Wallet: pointCodes/{código} con amount, active, used,
// multiUse, expiresAt. El QR contiene el código tal cual y se genera EN EL NAVEGADOR (nunca con una API
// externa: filtraría códigos canjeables).
import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Copy, Download, Eye, Plus, Power, Printer, QrCode } from 'lucide-react';
import { collection, doc, getDoc, getDocs, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore';
import { auth, db } from '@/firebase';
import { useToast } from '@/components/ui/use-toast';
import {
  Badge, Button, Card, Checkbox, EmptyState, Field, Input, Modal, SearchInput, Select, Skeleton, Switch, TD, TH, THead, TR, Table, Textarea, useConfirm,
} from '@/admin/ui';
import { downloadCsv, formatDate, formatDateTime, logActivity, normalize, toDate } from '@/admin/lib';
import { STATUS_TONE, codeStatus, codeUses, randomCode } from './wallet';

const MAX_BATCH = 200;
const MAX_AMOUNT = 1000;
// qrcode vive en el chunk vendor-pdf (~1 MB): se carga solo cuando se dibuja un QR.
const qrUrl = async (code, width = 320) => (await import('qrcode')).default.toDataURL(code, { width, margin: 2, errorCorrectionLevel: 'M' });
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Hoja imprimible. La ventana se abre antes de cualquier await para que el navegador no la bloquee. */
async function printCodes(list, toast) {
  const win = window.open('', '_blank');
  if (!win) { toast({ title: 'Permite las ventanas emergentes para imprimir', variant: 'destructive' }); return; }
  win.document.write('<p style="font-family:sans-serif">Generando códigos…</p>');
  const imgs = await Promise.all(list.map((c) => qrUrl(c.id, 360)));
  const logo = `${window.location.origin}/logoBoreal.svg`;
  const cards = list.map((c, i) => `
    <div class="card">
      <img class="logo" src="${logo}" alt="Boreal Labs">
      <img class="qr" src="${imgs[i]}" alt="QR ${esc(c.id)}">
      <div class="amount">+${esc(c.amount)} puntos</div>
      <div class="code">${esc(c.id)}</div>
      ${c.event ? `<div class="meta">${esc(c.event)}</div>` : ''}
      <div class="meta">${toDate(c.expiresAt) ? `Vence ${esc(formatDate(c.expiresAt))}` : 'Sin vencimiento'}${c.multiUse ? ' · multiuso' : ''}</div>
      <div class="hint">Escanéalo en la Boreal Wallet</div>
    </div>`).join('');
  win.document.open();
  win.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Códigos de puntos</title><style>
    @page { size: letter; margin: 10mm; }
    body { font-family: system-ui, sans-serif; margin: 0; color: #111; background: #fff; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6mm; }
    .card { border: 1px dashed #999; border-radius: 4mm; padding: 4mm; text-align: center; break-inside: avoid; }
    /* El logo es blanco: va sobre una franja oscura que se imprime aunque el navegador omita fondos. */
    .logo { height: 9mm; padding: 1.5mm 4mm; border-radius: 2mm; background: #0f2a33; -webkit-print-color-adjust: exact; print-color-adjust: exact; } .qr { width: 100%; max-width: 48mm; display: block; margin: 2mm auto; }
    .amount { font-size: 15pt; font-weight: 700; } .code { font-family: ui-monospace, monospace; font-size: 11pt; letter-spacing: .5px; margin-top: 1mm; }
    .meta { font-size: 8pt; color: #444; margin-top: 1mm; } .hint { font-size: 7pt; color: #777; margin-top: 2mm; }
  </style></head><body><div class="grid">${cards}</div>
  <script>window.onload = () => setTimeout(() => window.print(), 300);<\/script></body></html>`);
  win.document.close();
}

async function downloadPng(code) {
  const a = document.createElement('a');
  a.href = await qrUrl(code, 1024);
  a.download = `${code}.png`;
  a.click();
}

function StatusBadge({ c }) {
  const status = codeStatus(c);
  return (
    <span className="flex flex-wrap gap-1">
      <Badge tone={STATUS_TONE[status]}>{status}</Badge>
      {c.multiUse && <Badge tone="info">{codeUses(c)} canjes</Badge>}
    </span>
  );
}

export default function Codes({ codes }) {
  const { toast } = useToast();
  const confirm = useConfirm();
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search); // filtra sin bloquear el tecleo
  const [status, setStatus] = useState('');
  const [kind, setKind] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [creating, setCreating] = useState(false);
  const [detailId, setDetailId] = useState(null);

  const rows = useMemo(() => {
    const q = normalize(deferredSearch);
    return (codes || [])
      .filter((c) => (!status || codeStatus(c) === status)
        && (!kind || (kind === 'multi') === !!c.multiUse)
        && (!q || normalize(`${c.id} ${c.code || ''} ${c.event || ''} ${c.note || ''} ${c.userEmail || ''}`).includes(q)))
      .sort((a, b) => (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0));
  }, [codes, deferredSearch, status, kind]);
  const selectedRows = rows.filter((c) => selected.has(c.id));
  const allSelected = rows.length > 0 && rows.every((c) => selected.has(c.id));
  const toggle = (id) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const detail = (codes || []).find((c) => c.id === detailId) || null;

  const copy = async (code) => {
    try { await navigator.clipboard.writeText(code); toast({ title: 'Código copiado', description: code }); } catch { toast({ title: 'No se pudo copiar', variant: 'destructive' }); }
  };

  const setActive = async (c, active) => {
    if (!active && !(await confirm({ title: `¿Desactivar ${c.id}?`, description: 'Nadie podrá canjearlo hasta que lo reactives.', confirmLabel: 'Desactivar', tone: 'danger' }))) return;
    try {
      await updateDoc(doc(db, 'pointCodes', c.id), { active });
      logActivity(`puntos.codigo_${active ? 'reactivado' : 'desactivado'}`, `${active ? 'Reactivó' : 'Desactivó'} el código ${c.id} (${c.amount} pts)`, { code: c.id });
      toast({ title: active ? 'Código reactivado' : 'Código desactivado', description: c.id });
    } catch (error) {
      toast({ title: 'No se pudo actualizar el código', description: error.message, variant: 'destructive' });
    }
  };

  const exportCsv = () => downloadCsv(`codigos-puntos-${new Date().toISOString().slice(0, 10)}`, [
    { key: 'id', label: 'Código' },
    { key: 'amount', label: 'Puntos' },
    { key: 'multiUse', label: 'Tipo', value: (c) => (c.multiUse ? 'multiuso' : 'un uso') },
    { key: 'status', label: 'Estado', value: codeStatus },
    { key: 'uses', label: 'Canjes', value: codeUses },
    { key: 'event', label: 'Evento' },
    { key: 'note', label: 'Nota' },
    { key: 'expiresAt', label: 'Vence', value: (c) => toDate(c.expiresAt) },
    { key: 'userEmail', label: 'Canjeado por' },
    { key: 'createdBy', label: 'Creado por' },
    { key: 'createdAt', label: 'Creado', value: (c) => toDate(c.createdAt) },
  ], selectedRows.length ? selectedRows : rows);

  const printable = selectedRows.length ? selectedRows : rows.filter((c) => codeStatus(c) === 'activo');

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2 border-b border-adm-border p-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar código, evento, nota o correo…" className="min-w-[200px] flex-1" />
        <Select aria-label="Filtrar por estado" value={status} onChange={(e) => setStatus(e.target.value)} className="w-full sm:w-40">
          <option value="">Todos los estados</option>
          {Object.keys(STATUS_TONE).map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
        <Select aria-label="Filtrar por tipo" value={kind} onChange={(e) => setKind(e.target.value)} className="w-full sm:w-40">
          <option value="">Todos los tipos</option>
          <option value="single">Un uso</option>
          <option value="multi">Multiuso</option>
        </Select>
        <Button onClick={exportCsv} disabled={!rows.length}><Download className="h-4 w-4" />CSV</Button>
        <Button onClick={() => printCodes(printable, toast)} disabled={!printable.length} title={selectedRows.length ? 'Imprimir seleccionados' : 'Imprimir los activos de la lista'}>
          <Printer className="h-4 w-4" />Imprimir{selectedRows.length ? ` ${selectedRows.length}` : ''}
        </Button>
        <Button variant="primary" onClick={() => setCreating(true)} disabled={!db}><Plus className="h-4 w-4" />Crear códigos</Button>
      </div>

      {codes === null ? (
        <div className="space-y-2 p-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
      ) : !rows.length ? (
        <EmptyState
          icon={QrCode}
          title={codes.length ? 'Sin resultados' : 'Aún no hay códigos'}
          description={codes.length ? 'Prueba con otro filtro.' : 'Crea códigos QR para que la comunidad sume puntos escaneándolos en la Boreal Wallet.'}
          action={!codes.length && <Button variant="primary" onClick={() => setCreating(true)}><Plus className="h-4 w-4" />Crear códigos</Button>}
        />
      ) : (
        <Table sticky>
          <THead>
            <tr>
              <TH className="hidden w-10 sm:table-cell"><Checkbox aria-label="Seleccionar todos" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((c) => c.id)))} /></TH>
              <TH>Código</TH>
              <TH className="text-right">Puntos</TH>
              <TH className="hidden md:table-cell">Evento / nota</TH>
              <TH className="hidden sm:table-cell">Estado</TH>
              <TH className="hidden lg:table-cell">Vence</TH>
              <TH className="text-right"><span className="sr-only">Acciones</span></TH>
            </tr>
          </THead>
          <tbody>
            {rows.map((c) => {
              const st = codeStatus(c);
              return (
                <TR key={c.id} selected={selected.has(c.id)}>
                  <TD className="hidden sm:table-cell"><Checkbox aria-label={`Seleccionar ${c.id}`} checked={selected.has(c.id)} onChange={() => toggle(c.id)} /></TD>
                  <TD>
                    <button type="button" onClick={() => setDetailId(c.id)} className="whitespace-nowrap font-mono text-sm font-medium text-adm-text hover:text-adm-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-adm-accent">{c.id}</button>
                    <span className="mt-1 block sm:hidden"><StatusBadge c={c} /></span>
                  </TD>
                  <TD className="text-right font-semibold tabular-nums">{Number(c.amount) || 0}</TD>
                  <TD className="hidden max-w-[16rem] md:table-cell">
                    <span className="block truncate">{c.event || '—'}</span>
                    {c.note && <span className="block truncate text-xs text-adm-muted">{c.note}</span>}
                  </TD>
                  <TD className="hidden sm:table-cell"><StatusBadge c={c} /></TD>
                  <TD className="hidden whitespace-nowrap text-xs text-adm-muted lg:table-cell">{toDate(c.expiresAt) ? formatDate(c.expiresAt) : '—'}</TD>
                  <TD className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setDetailId(c.id)} aria-label={`Ver QR y canjes de ${c.id}`} title="Ver QR y canjes"><Eye className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => copy(c.id)} aria-label={`Copiar ${c.id}`} title="Copiar código"><Copy className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="hidden sm:inline-flex" disabled={st === 'usado'} onClick={() => setActive(c, c.active === false)} aria-label={c.active === false ? `Reactivar ${c.id}` : `Desactivar ${c.id}`} title={c.active === false ? 'Reactivar' : 'Desactivar'}>
                        <Power className={`h-4 w-4 ${c.active === false ? 'text-adm-success' : ''}`} />
                      </Button>
                    </div>
                  </TD>
                </TR>
              );
            })}
          </tbody>
        </Table>
      )}

      <CreateDialog open={creating} onClose={() => setCreating(false)} onPrint={(list) => printCodes(list, toast)} />
      <DetailDialog code={detail} onClose={() => setDetailId(null)} onCopy={copy} onToggle={setActive} onPrint={(c) => printCodes([c], toast)} />
    </Card>
  );
}

function CreateDialog({ open, onClose, onPrint }) {
  const { toast } = useToast();
  const [form, setForm] = useState({});
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState(null);
  const [events, setEvents] = useState([]);

  useEffect(() => {
    if (!open) return;
    setForm({ count: '1', amount: '10', multiUse: false, expires: '', event: '', note: '' });
    setTouched(false);
    setCreated(null);
    if (db) getDocs(collection(db, 'events')).then((s) => setEvents([...new Set(s.docs.map((d) => d.get('title')).filter(Boolean))])).catch(() => {});
  }, [open]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e?.target ? e.target.value : e }));
  const count = Number.parseInt(form.count, 10);
  const amount = Number.parseInt(form.amount, 10);
  const expiresAt = form.expires ? new Date(`${form.expires}T23:59:59`) : null;
  const errors = {
    count: !(count >= 1 && count <= MAX_BATCH) ? `Entre 1 y ${MAX_BATCH}.` : '',
    amount: !(amount >= 1 && amount <= MAX_AMOUNT) ? `Entre 1 y ${MAX_AMOUNT}.` : '',
    expires: expiresAt && expiresAt.getTime() < Date.now() ? 'La fecha ya pasó.' : '',
  };
  const invalid = Object.values(errors).some(Boolean);
  const shown = touched ? errors : {};

  const submit = async (e) => {
    e.preventDefault();
    setTouched(true);
    if (invalid || !db) return;
    setSaving(true);
    try {
      // Códigos nuevos que no existan ya en pointCodes (la colisión es casi imposible, pero se verifica).
      const ids = new Set();
      while (ids.size < count) {
        const candidates = Array.from({ length: count - ids.size }, randomCode).filter((c) => !ids.has(c));
        const snaps = await Promise.all(candidates.map((c) => getDoc(doc(db, 'pointCodes', c))));
        snaps.forEach((s, i) => { if (!s.exists()) ids.add(candidates[i]); });
      }
      const createdBy = auth?.currentUser?.email || auth?.currentUser?.uid || 'admin';
      const base = {
        amount, active: true, used: false, multiUse: !!form.multiUse, redeemedCount: 0,
        event: form.event.trim(), note: form.note.trim(), createdBy, createdAt: serverTimestamp(),
        ...(expiresAt ? { expiresAt } : {}),
      };
      const batch = writeBatch(db);
      [...ids].forEach((id) => batch.set(doc(db, 'pointCodes', id), { ...base, code: id }));
      await batch.commit();
      const list = [...ids].map((id) => ({ ...base, id, expiresAt }));
      logActivity('puntos.codigos_creados', `Creó ${count} código${count > 1 ? 's' : ''} de ${amount} pts${base.event ? ` para "${base.event}"` : ''}`, { count, amount, multiUse: base.multiUse, event: base.event });
      toast({ title: count > 1 ? `${count} códigos creados` : 'Código creado', description: count > 1 ? `${amount} pts cada uno` : list[0].id });
      setCreated(list);
    } catch (error) {
      console.error('Error creando códigos:', error);
      toast({ title: 'No se pudieron crear los códigos', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={created ? 'Códigos listos' : 'Crear códigos QR'}
      description={created ? `${created.length} código${created.length > 1 ? 's' : ''} de ${created[0].amount} pts` : 'Cada código se canjea en la Boreal Wallet escaneando su QR o escribiéndolo.'}
      footer={created ? (
        <>
          <Button variant="ghost" onClick={onClose}>Cerrar</Button>
          <Button variant="primary" onClick={() => onPrint(created)}><Printer className="h-4 w-4" />Imprimir hoja</Button>
        </>
      ) : (
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" form="create-codes" variant="primary" loading={saving} disabled={touched && invalid}>
            {count > 1 ? `Crear ${count} códigos` : 'Crear código'}
          </Button>
        </>
      )}
    >
      {created ? (
        <ul className="max-h-72 space-y-1 overflow-y-auto font-mono text-sm text-adm-text">{created.map((c) => <li key={c.id}>{c.id}</li>)}</ul>
      ) : (
        <form id="create-codes" onSubmit={submit} className="space-y-4" noValidate>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Puntos por código" error={shown.amount}>
              <Input type="number" min={1} max={MAX_AMOUNT} inputMode="numeric" value={form.amount || ''} onChange={set('amount')} />
            </Field>
            <Field label="Cantidad de códigos" error={shown.count} hint={form.multiUse ? 'Cada uno multiuso.' : 'Un uso cada uno (lote).'}>
              <Input type="number" min={1} max={MAX_BATCH} inputMode="numeric" value={form.count || ''} onChange={set('count')} />
            </Field>
          </div>
          <div className="flex items-start gap-3">
            <Switch label="Multiuso" checked={!!form.multiUse} onChange={set('multiUse')} />
            <div className="text-sm">
              <p className="text-adm-text">Multiuso</p>
              <p className="text-xs text-adm-muted">Cada persona lo canjea una sola vez (p. ej. un QR proyectado en el evento). Sin activar, el primer canje lo agota.</p>
            </div>
          </div>
          <Field label="Vence (opcional)" error={shown.expires} hint="Vale hasta el final de ese día.">
            <Input type="date" value={form.expires || ''} onChange={set('expires')} />
          </Field>
          <Field label="Evento (opcional)">
            <Input list="code-events" value={form.event || ''} onChange={set('event')} maxLength={200} placeholder="Taller de IA Generativa" />
          </Field>
          <datalist id="code-events">{events.map((t) => <option key={t} value={t} />)}</datalist>
          <Field label="Nota (opcional)">
            <Textarea rows={2} value={form.note || ''} onChange={set('note')} maxLength={300} placeholder="Ej.: Stand de Boreal en la feria" />
          </Field>
        </form>
      )}
    </Modal>
  );
}

function DetailDialog({ code, onClose, onCopy, onToggle, onPrint }) {
  const [img, setImg] = useState('');
  const [uses, setUses] = useState(null);

  useEffect(() => {
    if (!code) return undefined;
    let alive = true;
    setImg('');
    setUses(null);
    qrUrl(code.id, 480).then((u) => alive && setImg(u));
    if (code.multiUse) {
      getDocs(collection(db, 'pointCodes', code.id, 'uses'))
        .then((s) => alive && setUses(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (toDate(b.usedAt)?.getTime() || 0) - (toDate(a.usedAt)?.getTime() || 0))))
        .catch(() => alive && setUses([]));
    } else {
      setUses(code.used ? [{ id: code.usedBy || 'uso', uid: code.usedBy, userEmail: code.userEmail, usedAt: code.usedAt }] : []);
    }
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recargar solo al cambiar de código o de canjes
  }, [code?.id, code?.redeemedCount, code?.used]);

  const st = code ? codeStatus(code) : '';
  return (
    <Modal
      open={!!code}
      onClose={onClose}
      title={code?.id || ''}
      description={code ? `${code.amount} pts · ${code.multiUse ? 'multiuso' : 'un uso'}${code.event ? ` · ${code.event}` : ''}` : ''}
      footer={code && (
        <>
          <Button variant="ghost" disabled={st === 'usado'} onClick={() => onToggle(code, code.active === false)}><Power className="h-4 w-4" />{code.active === false ? 'Reactivar' : 'Desactivar'}</Button>
          <Button onClick={() => onCopy(code.id)}><Copy className="h-4 w-4" />Copiar</Button>
          <Button onClick={() => downloadPng(code.id)}><Download className="h-4 w-4" />PNG</Button>
          <Button variant="primary" onClick={() => onPrint(code)}><Printer className="h-4 w-4" />Imprimir</Button>
        </>
      )}
    >
      {code && (
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-2">
            {img ? <img src={img} alt={`QR del código ${code.id}`} className="h-56 w-56 rounded-lg border border-adm-border" /> : <Skeleton className="h-56 w-56" />}
            <StatusBadge c={code} />
            <p className="text-xs text-adm-muted">
              {toDate(code.expiresAt) ? `Vence ${formatDate(code.expiresAt)}` : 'Sin vencimiento'} · creado {formatDateTime(code.createdAt)}{code.createdBy ? ` por ${code.createdBy}` : ''}
            </p>
            {code.note && <p className="text-sm text-adm-text">{code.note}</p>}
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-adm-text">Canjes</h3>
            {uses === null ? <Skeleton className="h-10 w-full" /> : !uses.length ? (
              <p className="text-sm text-adm-muted">Nadie lo ha canjeado todavía.</p>
            ) : (
              <ul className="divide-y divide-adm-border rounded-lg border border-adm-border text-sm">
                {uses.map((u) => (
                  <li key={u.id} className="flex flex-wrap justify-between gap-2 px-3 py-2">
                    <span className="min-w-0 truncate text-adm-text">{u.userEmail || u.uid || u.id}</span>
                    <span className="text-xs text-adm-muted">{formatDateTime(u.usedAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
