// Suscripciones (ruta oculta /claude): clientes, pagos y métricas de un negocio de suscripción mensual.
// Toda la lógica de montos/estados vive en functions/billing.js (pura, compartida con las Functions).
import React, { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { MotionConfig } from 'framer-motion';
import { addDoc, collection, doc, onSnapshot, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Banknote, Download, Mail, Pencil, Plus, Receipt, Users } from 'lucide-react';
import { auth, db } from '@/firebase';
import { useToast } from '@/components/ui/use-toast';
import { canSee, useAccess } from '@/admin/access';
import { ThemeToggle, useAdminTheme } from '@/admin/AdminLayout';
import { downloadCsv, formatDate, logActivity, normalize, toDate } from '@/admin/lib';
import {
  Badge, Button, Card, CardBody, CardHeader, ConfirmProvider, EmptyState, Field, Input, Modal, PageHeader, SearchInput, Select, StatCard,
  Switch, TD, TH, THead, TR, Table, Tabs, Textarea, useConfirm,
} from '@/admin/ui';
import { DEFAULT_CONFIG, clientCycle, cycleBounds, metrics, payDayOf, paymentPeriod, toMs } from '../../../../functions/billing.js';
import { Requests } from './Requests';

const nio = (n) => `C$ ${Number(n || 0).toLocaleString('es-NI', { maximumFractionDigits: 2 })}`;
const usd = (n) => `US$ ${Number(n || 0).toLocaleString('es-NI', { maximumFractionDigits: 2 })}`;
const pct = (n) => `${(n * 100).toFixed(0)} %`;
const isoDay = (v) => { const d = toDate(v); return d ? new Date(d.getTime() - 6 * 3600000).toISOString().slice(0, 10) : ''; }; // día en Managua
const fromIso = (s) => new Date(`${s}T12:00:00-06:00`); // mediodía local: seguro frente a husos horarios
const STATUS = {
  al_dia: ['success', 'Al día'], pendiente: ['warning', 'Pendiente'], vencido: ['danger', 'Vencido'], pausado: ['neutral', 'Pausado'], cancelado: ['neutral', 'Cancelado'],
};
const StatusBadge = ({ status }) => <Badge tone={STATUS[status][0]}>{STATUS[status][1]}</Badge>;

function useSubs() {
  const [state, setState] = useState({ config: DEFAULT_CONFIG, clients: [], payments: [], ready: false });
  useEffect(() => {
    if (!db) return undefined;
    const rows = (s) => s.docs.map((d) => ({ id: d.id, ...d.data() }));
    const set = (patch) => setState((p) => ({ ...p, ...patch }));
    const off = [
      onSnapshot(doc(db, 'subsConfig', 'main'), (s) => set({ config: { ...DEFAULT_CONFIG, ...(s.data() || {}) } })),
      onSnapshot(collection(db, 'subsClients'), (s) => set({ clients: rows(s) })),
      onSnapshot(collection(db, 'subsPayments'), (s) => set({ payments: rows(s), ready: true })),
    ];
    return () => off.forEach((f) => f());
  }, []);
  return state;
}

const who = () => auth?.currentUser?.email || 'desconocido';

export default function SubscriptionsPage() {
  const access = useAccess();
  const { pref, resolved, setPref } = useAdminTheme();
  if (!canSee(access, 'suscripciones')) return <Navigate to="/" replace />;
  return (
    <MotionConfig reducedMotion="user">
      <div data-theme={resolved} className="admin-root min-h-screen bg-adm-bg font-sans text-adm-text antialiased">
        <Helmet>
          <title>Suscripciones</title>
          <meta name="robots" content="noindex, nofollow" />
        </Helmet>
        <ConfirmProvider>
          <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-adm-border/80 bg-adm-bg/80 px-4 backdrop-blur-md sm:px-6">
            <img src="/logoBoreal.svg" alt="" className="h-7 w-auto [[data-theme=light]_&]:hue-rotate-180 [[data-theme=light]_&]:invert" />
            <span className="text-sm font-semibold">Suscripciones</span>
            <div className="ml-auto"><ThemeToggle pref={pref} setPref={setPref} /></div>
          </header>
          <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8"><Manager /></div>
        </ConfirmProvider>
      </div>
    </MotionConfig>
  );
}

function Manager() {
  const { config, clients, payments, ready } = useSubs();
  const [tab, setTab] = useState('resumen');
  const [clientModal, setClientModal] = useState(null); // {} = nuevo, cliente = editar
  const [payModal, setPayModal] = useState(null);
  const now = Date.now();
  const m = useMemo(() => metrics(clients, payments, config, now), [clients, payments, config]); // eslint-disable-line react-hooks/exhaustive-deps
  const byId = useMemo(() => Object.fromEntries(clients.map((c) => [c.id, c])), [clients]);

  return (
    <>
      <PageHeader title="Suscripciones" description={`Factura del proveedor: ${formatDate(m.cycle.end)} · próximo cobro: ${m.nextDue ? formatDate(m.nextDue) : '—'}`} />
      <Tabs className="mb-6" value={tab} onChange={setTab} items={[
        { value: 'resumen', label: 'Resumen' }, { value: 'solicitudes', label: 'Solicitudes' }, { value: 'clientes', label: 'Clientes', count: clients.length },
        { value: 'pagos', label: 'Pagos', count: payments.length }, { value: 'config', label: 'Configuración' },
      ]} />
      {!ready ? <p className="text-sm text-adm-muted">Cargando…</p> : (
        <>
          {tab === 'resumen' && <Summary m={m} config={config} onPay={setPayModal} now={now} payments={payments} />}
          {tab === 'solicitudes' && <Requests config={config} />}
          {tab === 'clientes' && <Clients clients={clients} payments={payments} config={config} now={now} onEdit={setClientModal} onPay={setPayModal} />}
          {tab === 'pagos' && <Payments payments={payments} byId={byId} onNew={() => setPayModal({})} />}
          {tab === 'config' && <ConfigForm config={config} />}
        </>
      )}
      <ClientModal item={clientModal} onClose={() => setClientModal(null)} config={config} />
      <PaymentModal item={payModal} onClose={() => setPayModal(null)} clients={clients} payments={payments} config={config} now={now} />
    </>
  );
}

// ---------- Resumen ----------
/** Cobrado por ciclo del proveedor (últimos 6) frente al costo actual: barras CSS, sin librerías. */
function CollectedChart({ payments, config, costNio, now }) {
  const months = useMemo(() => {
    const out = [];
    let c = cycleBounds(now, config.cycleDay);
    for (let i = 0; i < 6; i += 1) { out.unshift({ ...c, total: 0 }); c = cycleBounds(c.start - 1, config.cycleDay); }
    payments.forEach((p) => { const t = toMs(p.paidAt); const m = out.find((x) => t >= x.start && t < x.end); if (m) m.total += Number(p.amount) || 0; });
    return out;
  }, [payments, config.cycleDay, now]);
  const max = Math.max(costNio, ...months.map((m) => m.total), 1);
  const label = (ms) => new Intl.DateTimeFormat('es-NI', { month: 'short', timeZone: 'America/Managua' }).format(ms);
  return (
    <Card>
      <CardHeader title="Cobrado por mes" description={`Ciclos del ${config.cycleDay} al ${config.cycleDay} · la línea es la factura del proveedor (${nio(costNio)})`} />
      <CardBody>
        <div className="relative flex h-48 items-end gap-3" role="img" aria-label="Cobrado por mes">
          <div className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-adm-danger/60" style={{ bottom: `${(costNio / max) * 100}%` }} />
          {months.map((m) => (
            <div key={m.key} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
              <span className="text-[11px] tabular-nums text-adm-muted">{m.total ? nio(m.total) : ''}</span>
              <div className={`w-full max-w-[56px] rounded-t-md transition-[height] duration-500 ${m.total >= costNio ? 'bg-adm-success/80' : 'bg-adm-warning/80'}`} style={{ height: `${(m.total / max) * 100}%`, minHeight: m.total ? 4 : 0 }} title={nio(m.total)} />
              <span className="text-xs capitalize text-adm-muted">{label(m.start)}</span>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

/** Próximos cobros (30 días): calendario unificado por fecha. */
function UpcomingChart({ rows, now }) {
  const items = rows.filter((r) => r.nextAmount > 0 && r.nextDate - now < 30 * 86400000).sort((a, b) => a.nextDate - b.nextDate);
  const max = Math.max(...items.map((r) => r.nextAmount), 1);
  return (
    <Card>
      <CardHeader title="Próximos cobros" description="Los próximos 30 días, por fecha de pago de cada cliente" />
      <CardBody className="space-y-3">
        {items.length === 0 ? <p className="text-sm text-adm-muted">Sin cobros en los próximos 30 días.</p> : items.map((r) => (
          <div key={r.client.id} className="grid grid-cols-[88px_1fr_auto] items-center gap-3 text-sm">
            <span className="tabular-nums text-adm-muted">{formatDate(r.nextDate)}</span>
            <div className="h-6 overflow-hidden rounded-md bg-adm-surface-2"><div className="flex h-full items-center rounded-md bg-adm-accent/25 px-2 text-xs font-medium" style={{ width: `${(r.nextAmount / max) * 100}%` }}>{r.client.name}</div></div>
            <span className="tabular-nums font-medium">{nio(r.nextAmount)}</span>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}

function CashModal({ open, onClose, config, m }) {
  const { toast } = useToast();
  const [v, setV] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setV(String(m.available)); setNote(''); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = async () => {
    setBusy(true);
    try {
      await setDoc(doc(db, 'subsConfig', 'main'), { cashOnHand: Number(v), cashAt: new Date(), cashNote: note.trim() }, { merge: true });
      logActivity('suscripciones.caja', `Registró dinero disponible: ${nio(v)}${note.trim() ? ` (${note.trim()})` : ''}`, { amount: Number(v), before: m.available });
      onClose();
    } catch (e) { toast({ title: 'No se pudo guardar', description: e?.message, variant: 'destructive' }); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="¿Con cuánto cuentas ahora?" footer={<Button variant="primary" loading={busy} disabled={!(Number(v) >= 0) || v === ''} onClick={save}>Guardar</Button>}>
      <p className="mb-4 text-sm text-adm-muted">Si gastaste parte de lo cobrado, registra el monto real. Los pagos que entren después se suman solos.</p>
      <div className="grid gap-4">
        <Field label="Dinero disponible (C$)"><Input type="number" min="0" step="any" value={v} onChange={(e) => setV(e.target.value)} /></Field>
        <Field label="Motivo (opcional)"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej.: imprevisto, gasté 200" /></Field>
      </div>
    </Modal>
  );
}

function Summary({ m, config, onPay, now, payments }) {
  const [cashOpen, setCashOpen] = useState(false);
  const liquidity = m.covered
    ? { value: 'Cubierto', hint: `Disponible ${nio(m.available)} ≥ factura ${nio(m.costNio)}`, tone: 'success' }
    : { value: `Te faltan ${nio(m.liquidityGapNio)}`, hint: `Disponible ${nio(m.available)} de ${nio(m.costNio)} (${usd(m.invoiceUsd)})`, tone: 'warning' };
  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl border border-adm-border bg-adm-surface p-6">
        <div className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-adm-accent/15 blur-3xl" />
        <div className="relative grid gap-6 sm:grid-cols-3">
          <div><p className="text-xs font-medium uppercase tracking-wide text-adm-muted">Ganancia neta del mes</p><p className={`mt-1 text-4xl font-bold tabular-nums ${m.profit >= 0 ? 'text-adm-success' : 'text-adm-danger'}`}>{nio(m.profit)}</p><p className="mt-1 text-sm text-adm-muted">Margen {pct(m.margin)} · {m.activeCount} clientes</p></div>
          <div><p className="text-xs font-medium uppercase tracking-wide text-adm-muted">Ingresos del mes</p><p className="mt-1 text-2xl font-semibold tabular-nums">{nio(m.revenue)}</p><p className="mt-1 text-sm text-adm-muted">Costo {usd(m.costUsd)} = {nio(m.costNio)}</p></div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-adm-muted">Dinero disponible</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{nio(m.available)}</p>
            <p className="mt-1 text-sm text-adm-muted">{m.manualCash && config.cashNote ? `Ajuste: ${config.cashNote}` : m.manualCash ? 'Ajustado a mano' : 'Cobrado este ciclo'}</p>
            <Button size="sm" className="mt-2" onClick={() => setCashOpen(true)}><Pencil className="h-4 w-4" />Editar</Button>
          </div>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={`Liquidez para la factura del ${config.cycleDay}`} value={liquidity.value} hint={liquidity.hint} tone={liquidity.tone} icon={Receipt} />
        <StatCard label="Cobrado vs esperado" value={`${nio(m.collected)} / ${nio(m.expected)}`} hint={m.pending > 0 ? `Faltan ${nio(m.pending)}` : 'Todo cobrado'} icon={Users} tone="accent" />
        <StatCard label="Próximo cobro" value={m.nextDue ? formatDate(m.nextDue) : '—'} hint="Cada cliente paga el día de su primer pago" icon={Receipt} tone="warning" />
        <StatCard label="Proyección próximo mes" value={nio(m.projectedNext)} hint="Sin los que cancelan" icon={Banknote} tone="accent" />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <CollectedChart payments={payments} config={config} costNio={m.costNio} now={now} />
        <UpcomingChart rows={m.rows} now={now} />
      </div>
      <CashModal open={cashOpen} onClose={() => setCashOpen(false)} config={config} m={m} />
      <Card>
        <CardHeader title="Pendientes y vencidos" description="Deben su mes o les toca pagar pronto" />
        {m.unpaid.length === 0 ? <EmptyState icon={Users} title="Nadie debe nada" description="Todos los clientes activos están al día." /> : (
          <Table>
            <THead><tr><TH>Cliente</TH><TH>Estado</TH><TH>Vence</TH><TH className="text-right">Debe</TH><TH /></tr></THead>
            <tbody>
              {m.unpaid.map((r) => (
                <TR key={r.client.id}>
                  <TD className="font-medium">{r.client.name}</TD>
                  <TD><StatusBadge status={r.status} /></TD>
                  <TD>{formatDate(r.dueDate)}</TD>
                  <TD className="text-right tabular-nums">{nio(r.owed)}</TD>
                  <TD className="text-right"><Button size="sm" onClick={() => onPay({ clientId: r.client.id })}>Registrar pago</Button></TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}

// ---------- Clientes ----------
function Clients({ clients, payments, config, now, onEdit, onPay }) {
  const { toast } = useToast();
  const [q, setQ] = useState('');
  const [sending, setSending] = useState(null);
  const rows = useMemo(() => clients
    .filter((c) => normalize(`${c.name} ${c.email} ${c.phone}`).includes(normalize(q)))
    .map((c) => {
      const mine = payments.filter((p) => p.clientId === c.id);
      const last = mine.reduce((a, p) => (toMs(p.paidAt) > toMs(a?.paidAt || 0) ? p : a), null);
      return { c, cy: clientCycle(c, payments, config, now), last };
    }).sort((a, b) => String(a.c.name).localeCompare(String(b.c.name))), [clients, payments, config, q, now]);

  // Una sola vez: los 4 clientes que ya pagaron (fecha de primer pago = su día de cobro). Sin correo de bienvenida.
  const loadInitial = async () => {
    try {
      const batch = writeBatch(db);
      [['Cliente 1', 300, '2026-10-29'], ['Cliente 2', 300, '2026-10-29'], ['Cliente 3', 220, '2026-11-04'], ['Cliente 4', 250, '2026-11-07']].forEach(([name, price, iso]) => {
        const ref = doc(collection(db, 'subsClients'));
        const client = { name, email: '', phone: '', price, joinedAt: fromIso(iso), notes: 'Cliente inicial: completa nombre, correo y WhatsApp', status: 'activo', skipWelcome: true, createdAt: serverTimestamp(), createdBy: who() };
        batch.set(ref, client);
        batch.set(doc(collection(db, 'subsPayments')), { clientId: ref.id, amount: price, paidAt: client.joinedAt, cycleKey: paymentPeriod(client, client.joinedAt.getTime()).key, method: 'Transferencia', note: 'Primer pago', recordedBy: who(), createdAt: serverTimestamp() });
      });
      await batch.commit();
      logActivity('suscripciones.cliente_nuevo', 'Cargó los 4 clientes iniciales', { count: 4 });
    } catch (e) { toast({ title: 'No se pudo cargar', description: e?.message, variant: 'destructive' }); }
  };

  const remind = async (c, cy) => {
    setSending(c.id);
    try {
      const kind = cy.status === 'vencido' ? 'overdue' : 'reminder';
      await httpsCallable(getFunctions(undefined, 'us-central1'), 'sendSubscriptionEmail')({ clientId: c.id, kind });
      logActivity('suscripciones.correo', `Envió ${kind === 'overdue' ? 'aviso de vencido' : 'recordatorio'} a ${c.name}`, { id: c.id, kind });
      toast({ title: 'Correo enviado', description: c.email });
    } catch (e) {
      toast({ title: 'No se pudo enviar', description: e?.message, variant: 'destructive' });
    } finally { setSending(null); }
  };
  const exportCsv = () => downloadCsv('suscripciones-clientes', [
    { key: 'name', label: 'Nombre' }, { key: 'email', label: 'Correo' }, { key: 'phone', label: 'Teléfono' }, { key: 'price', label: 'Precio C$' },
    { key: 'joinedAt', label: 'Alta', value: (c) => isoDay(c.joinedAt) }, { key: 'status', label: 'Estado' }, { key: 'notes', label: 'Notas' },
  ], clients);

  return (
    <Card>
      <CardHeader title="Clientes" actions={(
        <>
          <SearchInput value={q} onChange={setQ} placeholder="Buscar cliente…" />
          <Button size="sm" onClick={exportCsv}><Download className="h-4 w-4" />CSV</Button>
          <Button size="sm" variant="primary" onClick={() => onEdit({})}><Plus className="h-4 w-4" />Nuevo cliente</Button>
        </>
      )} />
      {rows.length === 0 ? <EmptyState icon={Users} title="Sin clientes" description="Agrega el primero con «Nuevo cliente» o carga los 4 actuales." action={clients.length === 0 && <Button onClick={loadInitial}>Cargar mis 4 clientes</Button>} /> : (
        <Table>
          <THead><tr><TH>Nombre</TH><TH>Contacto</TH><TH className="text-right">Precio</TH><TH>Alta</TH><TH>Estado</TH><TH>Próximo cobro</TH><TH>Último pago</TH><TH /></tr></THead>
          <tbody>
            {rows.map(({ c, cy, last }) => (
              <TR key={c.id}>
                <TD className="whitespace-nowrap font-medium">{c.name}</TD>
                <TD className="text-adm-muted">{c.email}<br />{c.phone}</TD>
                <TD className="whitespace-nowrap text-right tabular-nums">{nio(c.price)}</TD>
                <TD className="whitespace-nowrap">{formatDate(c.joinedAt)}</TD>
                <TD><StatusBadge status={cy.status} />{cy.endsAt && cy.status !== 'cancelado' ? <span className="mt-1 block text-xs text-adm-danger">Termina {formatDate(cy.endsAt)}</span> : null}</TD>
                <TD className="whitespace-nowrap tabular-nums">
                  {c.status === 'activo' ? <>{nio(cy.nextAmount)}<span className="block text-xs text-adm-muted">día {payDayOf(c)} · {formatDate(cy.nextDate)}</span></> : '—'}
                </TD>
                <TD className="whitespace-nowrap tabular-nums">{last ? <>{nio(last.amount)}<span className="block text-xs text-adm-muted">{formatDate(last.paidAt)}</span></> : '—'}</TD>
                <TD className="whitespace-nowrap text-right">
                  <Button size="icon" variant="ghost" aria-label="Registrar pago" title="Registrar pago" onClick={() => onPay({ clientId: c.id })}><Banknote className="h-4 w-4" /></Button>
                  {c.status === 'activo' && cy.status !== 'al_dia' && (
                    <Button size="icon" variant="ghost" aria-label="Enviar recordatorio" title="Enviar recordatorio" loading={sending === c.id} onClick={() => remind(c, cy)}><Mail className="h-4 w-4" /></Button>
                  )}
                  <Button size="icon" variant="ghost" aria-label="Editar" title="Editar" onClick={() => onEdit(c)}><Pencil className="h-4 w-4" /></Button>
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  );
}

function ClientModal({ item, onClose, config }) {
  const confirm = useConfirm();
  const { toast } = useToast();
  const [f, setF] = useState({});
  const [busy, setBusy] = useState(false);
  const isNew = !item?.id;
  useEffect(() => {
    if (!item) return;
    setF(item.id
      ? { name: item.name || '', email: item.email || '', phone: item.phone || '', price: item.price ?? '', joinedAt: isoDay(item.joinedAt), notes: item.notes || '' }
      : { name: '', email: '', phone: '', price: config.defaultPrice, joinedAt: isoDay(Date.now()), notes: '' });
  }, [item]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const joined = f.joinedAt ? fromIso(f.joinedAt) : null;
  const valid = f.name?.trim() && Number(f.price) > 0 && joined;

  const save = async () => {
    setBusy(true);
    try {
      const data = { name: f.name.trim(), email: f.email.trim(), phone: f.phone.trim(), price: Number(f.price), joinedAt: joined, notes: f.notes.trim() };
      if (isNew) {
        await addDoc(collection(db, 'subsClients'), { ...data, status: 'activo', createdAt: serverTimestamp(), createdBy: who() });
        logActivity('suscripciones.cliente_nuevo', `Agregó al cliente ${data.name} (${nio(data.price)})`, { price: data.price });
      } else {
        await updateDoc(doc(db, 'subsClients', item.id), data);
        logActivity('suscripciones.cliente_editado', `Editó al cliente ${data.name}`, { id: item.id });
      }
      onClose();
    } catch (e) { toast({ title: 'No se pudo guardar', description: e?.message, variant: 'destructive' }); } finally { setBusy(false); }
  };
  const cancelAtEnd = async () => {
    const end = clientCycle(item, [], config, Date.now()).cycle.end;
    if (!(await confirm({ title: '¿Cancelar al final del mes?', description: `${item.name} conserva el acceso hasta el ${formatDate(end)}; no se le cobra ni recuerda el próximo mes.`, confirmLabel: 'Cancelar al final del mes' }))) return;
    await updateDoc(doc(db, 'subsClients', item.id), { cancelAt: new Date(end) });
    logActivity('suscripciones.cliente_cancelacion', `Programó la cancelación de ${item.name} para el ${formatDate(end)}`, { id: item.id });
    onClose();
  };
  const undoCancel = async () => {
    await updateDoc(doc(db, 'subsClients', item.id), { cancelAt: null });
    logActivity('suscripciones.cliente_cancelacion', `Quitó la cancelación de ${item.name}`, { id: item.id });
    onClose();
  };
  const setStatus = async (status, title) => {
    if (!(await confirm({ title, description: `${item.name} · el cambio queda en la bitácora.`, tone: status === 'cancelado' ? 'danger' : 'primary', confirmLabel: 'Confirmar' }))) return;
    await updateDoc(doc(db, 'subsClients', item.id), { status });
    logActivity(`suscripciones.cliente_${status}`, `Cambió a ${status} al cliente ${item.name}`, { id: item.id });
    onClose();
  };
  const sendWelcome = async () => {
    try {
      await httpsCallable(getFunctions(undefined, 'us-central1'), 'sendSubscriptionEmail')({ clientId: item.id, kind: 'welcome' });
      toast({ title: 'Bienvenida enviada', description: item.email });
    } catch (e) { toast({ title: 'No se pudo enviar', description: e?.message, variant: 'destructive' }); }
  };

  return (
    <Modal open={!!item} onClose={onClose} title={isNew ? 'Nuevo cliente' : 'Editar cliente'} footer={(
      <>
        {!isNew && item.status === 'activo' && <Button variant="outline" onClick={() => setStatus('pausado', '¿Pausar cliente?')}>Pausar</Button>}
        {!isNew && item.status !== 'activo' && <Button variant="outline" onClick={() => setStatus('activo', '¿Reactivar cliente?')}>Reactivar</Button>}
        {!isNew && item.status === 'activo' && !item.cancelAt && <Button variant="outline" onClick={cancelAtEnd}>Cancelar al final del mes</Button>}
        {!isNew && item.cancelAt && <Button variant="outline" onClick={undoCancel}>Seguir el próximo mes</Button>}
        {!isNew && item.status !== 'cancelado' && <Button variant="danger-ghost" onClick={() => setStatus('cancelado', '¿Cancelar ya?')}>Cancelar ya</Button>}
        <Button variant="primary" loading={busy} disabled={!valid} onClick={save}>Guardar</Button>
      </>
    )}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre" className="sm:col-span-2"><Input value={f.name || ''} onChange={set('name')} /></Field>
        <Field label="Correo"><Input type="email" value={f.email || ''} onChange={set('email')} /></Field>
        <Field label="Teléfono"><Input value={f.phone || ''} onChange={set('phone')} /></Field>
        <Field label="Precio mensual (C$)"><Input type="number" min="0" value={f.price ?? ''} onChange={set('price')} /></Field>
        <Field label="Fecha del primer pago" hint="Define su día de pago mensual"><Input type="date" value={f.joinedAt || ''} onChange={set('joinedAt')} /></Field>
        <Field label="Notas" className="sm:col-span-2"><Textarea value={f.notes || ''} onChange={set('notes')} /></Field>
      </div>
      {!isNew && item.email && <Button className="mt-4" size="sm" onClick={sendWelcome}><Mail className="h-4 w-4" />Reenviar bienvenida</Button>}
    </Modal>
  );
}

// ---------- Pagos ----------
function Payments({ payments, byId, onNew }) {
  const sorted = useMemo(() => [...payments].sort((a, b) => toMs(b.paidAt) - toMs(a.paidAt)), [payments]);
  const exportCsv = () => downloadCsv('suscripciones-pagos', [
    { key: 'c', label: 'Cliente', value: (p) => byId[p.clientId]?.name || p.clientId }, { key: 'amount', label: 'Monto C$' },
    { key: 'paidAt', label: 'Fecha', value: (p) => isoDay(p.paidAt) }, { key: 'cycleKey', label: 'Ciclo' }, { key: 'method', label: 'Método' }, { key: 'note', label: 'Nota' },
  ], sorted);
  return (
    <Card>
      <CardHeader title="Historial de pagos" actions={(
        <>
          <Button size="sm" onClick={exportCsv}><Download className="h-4 w-4" />CSV</Button>
          <Button size="sm" variant="primary" onClick={onNew}><Plus className="h-4 w-4" />Registrar pago</Button>
        </>
      )} />
      {sorted.length === 0 ? <EmptyState icon={Receipt} title="Sin pagos" /> : (
        <Table>
          <THead><tr><TH>Fecha</TH><TH>Cliente</TH><TH>Ciclo</TH><TH>Método</TH><TH className="text-right">Monto</TH><TH>Nota</TH></tr></THead>
          <tbody>
            {sorted.map((p) => (
              <TR key={p.id}>
                <TD>{formatDate(p.paidAt)}</TD><TD className="font-medium">{byId[p.clientId]?.name || '—'}</TD><TD>{p.cycleKey}</TD>
                <TD>{p.method}</TD><TD className="text-right tabular-nums">{nio(p.amount)}</TD><TD className="text-adm-muted">{p.note}</TD>
              </TR>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  );
}

function PaymentModal({ item, onClose, clients, payments, config, now }) {
  const { toast } = useToast();
  const [f, setF] = useState({});
  const [busy, setBusy] = useState(false);
  const active = clients.filter((c) => c.status !== 'cancelado');
  const cycleOf = (clientId, iso) => { const c = clients.find((x) => x.id === clientId); return c ? paymentPeriod(c, iso ? fromIso(iso).getTime() : now) : null; };
  // Monto sugerido: lo que falta por cubrir el mes al que corresponde la fecha de pago.
  const suggest = (clientId, iso) => {
    const c = clients.find((x) => x.id === clientId);
    if (!c) return '';
    const key = cycleOf(clientId, iso).key;
    const paid = payments.filter((p) => p.clientId === clientId && p.cycleKey === key).reduce((s, p) => s + (Number(p.amount) || 0), 0);
    return Math.max(0, (Number(c.price) || 0) - paid);
  };
  useEffect(() => {
    if (!item) return;
    const paidAt = isoDay(now);
    setF({ clientId: item.clientId || '', amount: item.clientId ? suggest(item.clientId, paidAt) : '', paidAt, method: 'Transferencia', note: '' });
  }, [item]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const pick = (k) => (e) => {
    const next = { ...f, [k]: e.target.value };
    setF({ ...next, amount: suggest(next.clientId, next.paidAt) });
  };
  const client = clients.find((c) => c.id === f.clientId);
  const valid = client && Number(f.amount) > 0 && f.paidAt;

  const save = async () => {
    setBusy(true);
    try {
      const cy = cycleOf(f.clientId, f.paidAt);
      await addDoc(collection(db, 'subsPayments'), {
        clientId: f.clientId, amount: Number(f.amount), paidAt: fromIso(f.paidAt), cycleKey: cy.key, method: f.method, note: f.note.trim(),
        recordedBy: who(), createdAt: serverTimestamp(),
      });
      logActivity('suscripciones.pago', `Registró pago de ${nio(f.amount)} de ${client.name} (ciclo ${cy.key})`, { clientId: f.clientId, amount: Number(f.amount) });
      onClose();
    } catch (e) { toast({ title: 'No se pudo guardar', description: e?.message, variant: 'destructive' }); } finally { setBusy(false); }
  };

  return (
    <Modal open={!!item} onClose={onClose} title="Registrar pago" footer={<Button variant="primary" loading={busy} disabled={!valid} onClick={save}>Guardar pago</Button>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Cliente" className="sm:col-span-2">
          <Select value={f.clientId || ''} onChange={pick('clientId')}>
            <option value="">Elige un cliente…</option>
            {active.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Fecha de pago"><Input type="date" value={f.paidAt || ''} onChange={pick('paidAt')} /></Field>
        <Field label="Monto (C$)" hint={client ? `Mes ${cycleOf(f.clientId, f.paidAt).key}` : undefined}><Input type="number" min="0" value={f.amount ?? ''} onChange={set('amount')} /></Field>
        <Field label="Método"><Select value={f.method || ''} onChange={set('method')}><option>Transferencia</option><option>Efectivo</option><option>Depósito</option><option>Otro</option></Select></Field>
        <Field label="Nota" className="sm:col-span-2"><Input value={f.note || ''} onChange={set('note')} /></Field>
      </div>
    </Modal>
  );
}

// ---------- Configuración ----------
function ConfigForm({ config }) {
  const { toast } = useToast();
  const [f, setF] = useState(config);
  const [busy, setBusy] = useState(false);
  useEffect(() => setF(config), [config]);
  const num = (k) => ({ type: 'number', step: 'any', value: f[k] ?? '', onChange: (e) => setF((p) => ({ ...p, [k]: e.target.value })) });
  const save = async () => {
    setBusy(true);
    try {
      const data = {
        currency: 'NIO', businessName: String(f.businessName || '').trim() || DEFAULT_CONFIG.businessName, autoEmails: !!f.autoEmails,
        paymentInstructions: String(f.paymentInstructions || '').trim(),
        ...Object.fromEntries(['defaultPrice', 'costPerSeatUsd', 'exchangeRate', 'cycleDay', 'reminderDaysBefore'].map((k) => [k, Number(f[k])])),
      };
      if (Object.values(data).some((v) => typeof v === 'number' && !(v >= 0)) || data.exchangeRate <= 0 || data.cycleDay < 1 || data.cycleDay > 28 ) throw new Error('Revisa los números (días entre 1 y 28, tipo de cambio mayor que 0).');
      await setDoc(doc(db, 'subsConfig', 'main'), data, { merge: true });
      // Copia pública (sin costos) para el formulario de /claude.
      await setDoc(doc(db, 'subsConfig', 'public'), { price: data.defaultPrice, paymentInstructions: data.paymentInstructions, businessName: data.businessName });
      logActivity('suscripciones.config', 'Actualizó la configuración de suscripciones', { exchangeRate: data.exchangeRate, defaultPrice: data.defaultPrice });
      toast({ title: 'Configuración guardada' });
    } catch (e) { toast({ title: 'No se pudo guardar', description: e?.message, variant: 'destructive' }); } finally { setBusy(false); }
  };
  return (
    <Card>
      <CardHeader title="Configuración" description="Moneda: córdobas (NIO). El tipo de cambio se edita a mano." />
      <CardBody className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Nombre del negocio"><Input value={f.businessName || ''} onChange={(e) => setF((p) => ({ ...p, businessName: e.target.value }))} /></Field>
        <Field label="Precio por defecto (C$)"><Input {...num('defaultPrice')} /></Field>
        <Field label="Costo por cupo (US$)"><Input {...num('costPerSeatUsd')} /></Field>
        <Field label="Tipo de cambio (C$ por US$)"><Input {...num('exchangeRate')} /></Field>
        <Field label="Día de corte del ciclo" hint="Factura del proveedor"><Input {...num('cycleDay')} /></Field>
        <Field label="Recordar N días antes"><Input {...num('reminderDaysBefore')} /></Field>
        <div className="flex items-center gap-3 self-end pb-2"><Switch checked={!!f.autoEmails} onChange={(v) => setF((p) => ({ ...p, autoEmails: v }))} label="Correos automáticos" /><span className="text-sm">Correos automáticos</span></div>
        <Field label="Instrucciones de pago (correos y formulario público)" className="sm:col-span-2 lg:col-span-3"><Textarea rows={3} value={f.paymentInstructions || ''} onChange={(e) => setF((p) => ({ ...p, paymentInstructions: e.target.value }))} /></Field>
        <div className="sm:col-span-2 lg:col-span-3"><Button variant="primary" loading={busy} onClick={save}>Guardar configuración</Button></div>
      </CardBody>
    </Card>
  );
}
