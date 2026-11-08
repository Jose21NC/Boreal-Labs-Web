// Facturación de Suscripciones: PURO (sin Node ni Firestore) para usarlo en el panel web y en las Functions.
// Ciclo único del 24 al 24 en hora de Nicaragua (UTC-6 fijo, sin horario de verano). Las fechas son ms.
export const DEFAULT_CONFIG = {
  currency: 'NIO', defaultPrice: 300, costPerSeatUsd: 3, exchangeRate: 36.6, cycleDay: 24, dueDay: 20,
  reminderDaysBefore: 3, autoEmails: true, businessName: 'Boreal Labs',
  paymentInstructions: 'Realiza tu pago por transferencia o en efectivo y envíanos el comprobante respondiendo este correo.',
};

const DAY = 86400000;
const OFFSET = 6 * 3600000;
const pad = (n) => String(n).padStart(2, '0');

export const toMs = (v) => {
  if (v == null || v === '') return NaN;
  if (typeof v === 'number') return v;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v.toDate === 'function') return v.toDate().getTime();
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'object' && 'seconds' in v) return v.seconds * 1000;
  return Date.parse(v);
};

const parts = (ms) => { const d = new Date(ms - OFFSET); return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate() }; };
/** Medianoche de Managua de ese día (Date.UTC normaliza meses/días fuera de rango). */
const dayStart = (y, m, d) => Date.UTC(y, m, d) + OFFSET;
export const startOfDay = (ms) => { const p = parts(ms); return dayStart(p.y, p.m, p.d); };
const keyOf = (startMs) => { const p = parts(startMs); return `${p.y}-${pad(p.m + 1)}`; };
const cfgOf = (c) => ({ ...DEFAULT_CONFIG, ...(c || {}) });

/** Ciclo que contiene `ms`: {start, end, key ('YYYY-MM' del inicio), days}. */
export function cycleBounds(ms, cycleDay = 24) {
  const p = parts(ms);
  const m = p.d >= cycleDay ? p.m : p.m - 1;
  const start = dayStart(p.y, m, cycleDay);
  const end = dayStart(p.y, m + 1, cycleDay);
  return { start, end, key: keyOf(start), days: Math.round((end - start) / DAY) };
}
export const nextCycle = (cycle, cycleDay = 24) => cycleBounds(cycle.end, cycleDay);

/** Fin (ms) del ciclo con esa clave. */
const endOfKey = (key, cycleDay) => { const [y, m] = key.split('-').map(Number); return dayStart(y, m, cycleDay); };

const ceil10 = (n) => Math.ceil(n / 10 - 1e-9) * 10;

/** Primer cobro de quien entra a mitad de ciclo: precio × días restantes ÷ días del ciclo, hacia arriba a 10 C$. */
export function prorate(price, joinedMs, cycleDay = 24) {
  const c = cycleBounds(joinedMs, cycleDay);
  const left = Math.round((c.end - startOfDay(joinedMs)) / DAY);
  return ceil10((Number(price) * left) / c.days);
}

/** Hasta cuándo (ms) está cubierto un cliente por pagos de ciclos ANTERIORES a `cycle` (coversUntil o fin de su ciclo). */
export function coveredUntil(payments, cycle, cycleDay = 24) {
  return payments
    .filter((p) => p.cycleKey && p.cycleKey < cycle.key)
    .reduce((max, p) => Math.max(max, toMs(p.coversUntil) || endOfKey(p.cycleKey, cycleDay)), 0);
}

/** Crédito por días ya pagados más allá del inicio del ciclo: precio × días ÷ días del ciclo. */
export function creditFor(price, coveredMs, cycle) {
  if (!(coveredMs > cycle.start)) return 0;
  const days = Math.round((startOfDay(coveredMs) - cycle.start) / DAY);
  return Math.min(price, price - Math.round((price * (cycle.days - days)) / cycle.days / 10) * 10); // cobro final redondeado a 10 C$
}

/** Monto a cobrar a un cliente en un ciclo: prorrateo si entró en él, si no precio − crédito. */
export function amountDue(client, cycle, payments = [], cfg = {}) {
  const { cycleDay } = cfgOf(cfg);
  const price = Number(client.price) || 0;
  const joined = toMs(client.joinedAt);
  if (joined >= cycle.end) return 0;
  if (joined >= cycle.start) return prorate(price, joined, cycleDay);
  return price - creditFor(price, coveredUntil(payments, cycle, cycleDay), cycle);
}

/** Fecha límite de pago del ciclo (día dueDay). Quien entra después de esa fecha paga ese mismo día. */
export function dueDateOf(cycle, cfg = {}, joinedMs = NaN) {
  const { dueDay, cycleDay } = cfgOf(cfg);
  const p = parts(dueDay >= cycleDay ? cycle.start : cycle.end);
  const due = dayStart(p.y, p.m, dueDay);
  return joinedMs > due ? startOfDay(joinedMs) : due;
}

/** Próximo vencimiento a partir de `now` (el mismo día de vencimiento aún cuenta). */
export function nextDueDate(now, cfg = {}) {
  const { cycleDay } = cfgOf(cfg);
  const c = cycleBounds(now, cycleDay);
  const d = dueDateOf(c, cfg);
  return now < d + DAY ? d : dueDateOf(nextCycle(c, cycleDay), cfg);
}

/** Estado de un cliente en el ciclo actual: al_dia | pendiente | vencido | pausado | cancelado. */
export function clientCycle(client, payments, cfg, now) {
  const c = cfgOf(cfg);
  const cycle = cycleBounds(now, c.cycleDay);
  const mine = payments.filter((p) => p.clientId === client.id);
  const due = amountDue(client, cycle, mine, c);
  const paid = mine.filter((p) => p.cycleKey === cycle.key).reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const dueDate = dueDateOf(cycle, c, toMs(client.joinedAt));
  let status;
  if (client.status === 'pausado' || client.status === 'cancelado') status = client.status;
  else if (paid >= due) status = 'al_dia';
  else status = now >= dueDate + DAY ? 'vencido' : 'pendiente';
  // balance > 0 = saldo a favor; < 0 = debe.
  const next = nextCycle(cycle, c.cycleDay);
  const nextAmount = amountDue(client, next, mine, c);
  return { cycle, status, due, paid, balance: paid - due, dueDate, nextAmount, nextCredit: (Number(client.price) || 0) - nextAmount };
}

/** Qué aviso toca HOY (corrida diaria): 'reminder' N días antes del vencimiento, 'overdue' al día siguiente. */
export function reminderPhase(dueDate, now, daysBefore = 3) {
  const today = startOfDay(now);
  if (today === dueDate - daysBefore * DAY) return 'reminder';
  if (today === dueDate + DAY) return 'overdue';
  return null;
}

/** Métricas del negocio para el ciclo actual (montos en C$ salvo los *Usd). */
export function metrics(clients, payments, cfg, now) {
  const c = cfgOf(cfg);
  const cycle = cycleBounds(now, c.cycleDay);
  const active = clients.filter((x) => x.status === 'activo');
  const rows = active.map((x) => ({ client: x, ...clientCycle(x, payments, c, now) }));
  const revenue = active.reduce((s, x) => s + (Number(x.price) || 0), 0);
  const costUsd = active.length * c.costPerSeatUsd;
  const costNio = costUsd * c.exchangeRate;
  const profit = revenue - costNio;
  const expected = rows.reduce((s, r) => s + r.due, 0);
  const collected = payments.filter((p) => p.cycleKey === cycle.key).reduce((s, p) => s + (Number(p.amount) || 0), 0);
  return {
    cycle, nextDue: nextDueDate(now, c), activeCount: active.length, revenue, costUsd, costNio, profit,
    margin: revenue > 0 ? profit / revenue : 0,
    expected, collected, pending: Math.max(0, expected - collected),
    // Liquidez: lo cobrado este ciclo (en USD) frente a la factura del proveedor del día de cierre.
    collectedUsd: collected / c.exchangeRate, invoiceUsd: costUsd,
    liquidityGapNio: Math.max(0, costNio - collected), covered: collected >= costNio,
    projectedNext: rows.reduce((s, r) => s + r.nextAmount, 0),
    unpaid: rows.filter((r) => r.status === 'pendiente' || r.status === 'vencido'),
  };
}
