// Suscripciones (ruta oculta /claude): clientes, pagos y métricas de un negocio de suscripción mensual.
// Toda la lógica de montos/estados vive en functions/billing.js (pura, compartida con las Functions).
import React, { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { MotionConfig } from 'framer-motion';
import { addDoc, collection, doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
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
import { DEFAULT_CONFIG, amountDue, clientCycle, cycleBounds, metrics, prorate, toMs } from '../../../../functions/billing.js';

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
      <PageHeader title="Suscripciones" description={`Ciclo del ${formatDate(m.cycle.start)} al ${formatDate(m.cycle.end)} · vence el ${formatDate(m.nextDue)}`} />
      <Tabs className="mb-6" value={tab} onChange={setTab} items={[
        { value: 'resumen', label: 'Resumen' }, { value: 'clientes', label: 'Clientes', count: clients.length },
        { value: 'pagos', label: 'Pagos', count: payments.length }, { value: 'config', label: 'Configuración' },
      ]} />
      {!ready ? <p className="text-sm text-adm-muted">Cargando…</p> : (
        <>
          {tab === 'resumen' && <Summary m={m} config={config} onPay={setPayModal} now={now} />}
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
function Summary({ m, config, onPay, now }) {
  const liquidity = m.covered
    ? { value: 'Cubierto', hint: `Cobrado ${nio(m.collected)} ≥ factura ${nio(m.costNio)}`, tone: 'success' }
    : { value: `Te faltan ${nio(m.liquidityGapNio)}`, hint: `Cobrado ${usd(m.collectedUsd)} de ${usd(m.invoiceUsd)} (${nio(m.costNio)})`, tone: 'warning' };
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Ingresos del mes" value={nio(m.revenue)} hint={`${m.activeCount} clientes activos`} icon={Banknote} tone="success" />
        <StatCard label="Costo del proveedor" value={usd(m.costUsd)} hint={`${nio(m.costNio)} a ${config.exchangeRate} C$/US$`} icon={Receipt} tone="info" />
        <StatCard label="Ganancia neta" value={nio(m.profit)} hint={`Margen ${pct(m.margin)}`} icon={Banknote} tone={m.profit >= 0 ? 'success' : 'danger'} />
        <StatCard label="Cobrado vs esperado" value={`${nio(m.collected)} / ${nio(m.expected)}`} hint={m.pending > 0 ? `Faltan ${nio(m.pending)}` : 'Todo cobrado'} icon={Users} tone="accent" />
        <StatCard label={`Liquidez para la factura del ${config.cycleDay}`} value={liquidity.value} hint={liquidity.hint} tone={liquidity.tone} icon={Receipt} />
        <StatCard label="Próximo vencimiento" value={formatDate(m.nextDue)} hint={`Día ${config.dueDay} de cada mes`} icon={Receipt} tone="warning" />
        <StatCard label="Proyección próximo ciclo" value={nio(m.projectedNext)} hint="Con créditos aplicados" icon={Banknote} tone="accent" />
      </div>
      <Card>
        <CardHeader title="Pendientes y vencidos" description="Clientes activos que aún no cubren este ciclo" />
        {m.unpaid.length === 0 ? <EmptyState icon={Users} title="Nadie debe nada" description="Todos los clientes activos están al día." /> : (
          <Table>
            <THead><tr><TH>Cliente</TH><TH>Estado</TH><TH>Vence</TH><TH className="text-right">Debe</TH><TH /></tr></THead>
            <tbody>
              {m.unpaid.map((r) => (
                <TR key={r.client.id}>
                  <TD className="font-medium">{r.client.name}</TD>
                  <TD><StatusBadge status={r.status} /></TD>
                  <TD>{formatDate(r.dueDate)}</TD>
                  <TD className="text-right tabular-nums">{nio(r.due - r.paid)}</TD>
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
      {rows.length === 0 ? <EmptyState icon={Users} title="Sin clientes" description="Agrega el primero con «Nuevo cliente»." /> : (
        <Table>
          <THead><tr><TH>Nombre</TH><TH>Contacto</TH><TH className="text-right">Precio</TH><TH>Alta</TH><TH>Estado</TH><TH>Próximo cobro</TH><TH>Último pago</TH><TH /></tr></THead>
          <tbody>
            {rows.map(({ c, cy, last }) => (
              <TR key={c.id}>
                <TD className="whitespace-nowrap font-medium">{c.name}</TD>
                <TD className="text-adm-muted">{c.email}<br />{c.phone}</TD>
                <TD className="whitespace-nowrap text-right tabular-nums">{nio(c.price)}</TD>
                <TD className="whitespace-nowrap">{formatDate(c.joinedAt)}</TD>
                <TD><StatusBadge status={cy.status} /></TD>
                <TD className="whitespace-nowrap tabular-nums">
                  {c.status === 'activo' ? <>{nio(cy.nextAmount)}<span className="block text-xs text-adm-muted">{cy.nextCredit > 0 ? `crédito −${nio(cy.nextCredit)} · ` : ''}{formatDate(cy.cycle.end)}</span></> : '—'}
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
  const preview = joined && Number(f.price) > 0 ? prorate(Number(f.price), joined.getTime(), config.cycleDay) : null;
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
        {!isNew && item.status !== 'cancelado' && <Button variant="danger-ghost" onClick={() => setStatus('cancelado', '¿Cancelar suscripción?')}>Cancelar</Button>}
        <Button variant="primary" loading={busy} disabled={!valid} onClick={save}>Guardar</Button>
      </>
    )}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre" className="sm:col-span-2"><Input value={f.name || ''} onChange={set('name')} /></Field>
        <Field label="Correo"><Input type="email" value={f.email || ''} onChange={set('email')} /></Field>
        <Field label="Teléfono"><Input value={f.phone || ''} onChange={set('phone')} /></Field>
        <Field label="Precio mensual (C$)"><Input type="number" min="0" value={f.price ?? ''} onChange={set('price')} /></Field>
        <Field label="Fecha de alta"><Input type="date" value={f.joinedAt || ''} onChange={set('joinedAt')} /></Field>
        <Field label="Notas" className="sm:col-span-2"><Textarea value={f.notes || ''} onChange={set('notes')} /></Field>
      </div>
      {isNew && preview != null && (
        <p className="mt-4 rounded-lg border border-adm-accent/30 bg-adm-accent/10 p-3 text-sm">
          Primer cobro prorrateado: <strong>{nio(preview)}</strong>; después {nio(f.price)} por ciclo.
        </p>
      )}
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
  const cycleOf = (iso) => cycleBounds(iso ? fromIso(iso).getTime() : now, config.cycleDay);
  // Monto sugerido: lo que falta por cubrir el ciclo de la fecha de pago.
  const suggest = (clientId, iso) => {
    const c = clients.find((x) => x.id === clientId);
    if (!c) return '';
    const cy = cycleOf(iso);
    const mine = payments.filter((p) => p.clientId === clientId);
    const paid = mine.filter((p) => p.cycleKey === cy.key).reduce((s, p) => s + (Number(p.amount) || 0), 0);
    return Math.max(0, amountDue(c, cy, mine, config) - paid);
  };
  useEffect(() => {
    if (!item) return;
    const paidAt = isoDay(now);
    setF({ clientId: item.clientId || '', amount: item.clientId ? suggest(item.clientId, paidAt) : '', paidAt, method: 'Transferencia', note: '', coversUntil: '' });
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
      const cy = cycleOf(f.paidAt);
      await addDoc(collection(db, 'subsPayments'), {
        clientId: f.clientId, amount: Number(f.amount), paidAt: fromIso(f.paidAt), cycleKey: cy.key, method: f.method, note: f.note.trim(),
        ...(f.coversUntil ? { coversUntil: fromIso(f.coversUntil) } : {}), recordedBy: who(), createdAt: serverTimestamp(),
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
        <Field label="Monto (C$)" hint={client ? `Ciclo ${cycleOf(f.paidAt).key}` : undefined}><Input type="number" min="0" value={f.amount ?? ''} onChange={set('amount')} /></Field>
        <Field label="Método"><Select value={f.method || ''} onChange={set('method')}><option>Transferencia</option><option>Efectivo</option><option>Depósito</option><option>Otro</option></Select></Field>
        <Field label="Cubre hasta" hint="Solo si pagó por adelantado: se descuenta del próximo cobro."><Input type="date" value={f.coversUntil || ''} onChange={set('coversUntil')} /></Field>
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
        ...Object.fromEntries(['defaultPrice', 'costPerSeatUsd', 'exchangeRate', 'cycleDay', 'dueDay', 'reminderDaysBefore'].map((k) => [k, Number(f[k])])),
      };
      if (Object.values(data).some((v) => typeof v === 'number' && !(v >= 0)) || data.exchangeRate <= 0 || data.cycleDay < 1 || data.cycleDay > 28 || data.dueDay < 1 || data.dueDay > 28) throw new Error('Revisa los números (días entre 1 y 28, tipo de cambio mayor que 0).');
      await setDoc(doc(db, 'subsConfig', 'main'), data, { merge: true });
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
        <Field label="Día límite de pago"><Input {...num('dueDay')} /></Field>
        <Field label="Recordar N días antes"><Input {...num('reminderDaysBefore')} /></Field>
        <div className="flex items-center gap-3 self-end pb-2"><Switch checked={!!f.autoEmails} onChange={(v) => setF((p) => ({ ...p, autoEmails: v }))} label="Correos automáticos" /><span className="text-sm">Correos automáticos</span></div>
        <Field label="Instrucciones de pago (van en los correos)" className="sm:col-span-2 lg:col-span-3"><Textarea rows={3} value={f.paymentInstructions || ''} onChange={(e) => setF((p) => ({ ...p, paymentInstructions: e.target.value }))} /></Field>
        <div className="sm:col-span-2 lg:col-span-3"><Button variant="primary" loading={busy} onClick={save}>Guardar configuración</Button></div>
      </CardBody>
    </Card>
  );
}
