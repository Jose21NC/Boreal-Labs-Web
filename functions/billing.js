// Facturación de Suscripciones: PURO (sin Node ni Firestore) para usarlo en el panel web y en las Functions.
// Cada cliente paga cada mes el mismo día en que pagó por primera vez (joinedAt). El proveedor factura el día `cycleDay`.
// Hora de Nicaragua (UTC-6 fijo, sin horario de verano). Las fechas son ms.
export const DEFAULT_CONFIG = {
  currency: 'NIO', defaultPrice: 300, costPerSeatUsd: 3, exchangeRate: 36.6, cycleDay: 24,
  reminderDaysBefore: 3, autoEmails: true, businessName: 'Boreal Labs',
  paymentInstructions: 'Realiza tu pago por transferencia o en efectivo y envíanos el comprobante respondiendo este correo.',
};

const DAY = 86400000;
const OFFSET = 6 * 3600000;
const EARLY_DAYS = 7; // shortcut: un pago hecho hasta 7 días antes de la fecha cuenta para el mes siguiente
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
const dayStart = (y, m, d) => Date.UTC(y, m, d) + OFFSET;
export const startOfDay = (ms) => { const p = parts(ms); return dayStart(p.y, p.m, p.d); };
const keyOf = (startMs) => { const p = parts(startMs); return `${p.y}-${pad(p.m + 1)}`; };
const cfgOf = (c) => ({ ...DEFAULT_CONFIG, ...(c || {}) });
/** Día `d` del mes (y, m); si el mes es más corto (p. ej. 31 en noviembre), su último día. */
const clampDay = (y, m, d) => dayStart(y, m, Math.min(d, new Date(Date.UTC(y, m + 1, 0)).getUTCDate()));

/** Periodo mensual que contiene `ms` cuando la fecha de pago es el día `payDay`: {start, end, key, days}. */
export function periodOf(ms, payDay) {
  const p = parts(ms);
  let start = clampDay(p.y, p.m, payDay);
  if (start > ms) start = clampDay(p.y, p.m - 1, payDay);
  const s = parts(start);
  const end = clampDay(s.y, s.m + 1, payDay);
  return { start, end, key: keyOf(start), days: Math.round((end - start) / DAY) };
}
/** Ciclo del proveedor (del día `cycleDay` al mismo día del mes siguiente). */
export const cycleBounds = (ms, cycleDay = 24) => periodOf(ms, cycleDay);

/** Día de pago del cliente: el de su primer pago (o `payDay` si se fijó a mano). */
export const payDayOf = (client) => Number(client.payDay) || parts(toMs(client.joinedAt)).d;

/** Periodo al que corresponde un pago: si se adelanta hasta 7 días, al siguiente. */
export const paymentPeriod = (client, paidMs) => periodOf(paidMs + EARLY_DAYS * DAY, payDayOf(client));

const paidIn = (mine, key) => mine.filter((p) => p.cycleKey === key).reduce((s, p) => s + (Number(p.amount) || 0), 0);

/** Estado de un cliente hoy: al_dia | pendiente | vencido | pausado | cancelado, y su próxima fecha de pago. */
export function clientCycle(client, payments, cfg, now) {
  const c = cfgOf(cfg);
  const cycle = periodOf(now, payDayOf(client));
  const mine = payments.filter((p) => p.clientId === client.id);
  const due = Number(client.price) || 0;
  const paid = paidIn(mine, cycle.key);
  const nextPaid = paidIn(mine, keyOf(cycle.end));
  const soon = now >= cycle.end - c.reminderDaysBefore * DAY;
  let status;
  if (client.status === 'pausado' || client.status === 'cancelado') status = client.status;
  else if (paid < due) status = startOfDay(now) > cycle.start ? 'vencido' : 'pendiente';
  else status = soon && nextPaid < due ? 'pendiente' : 'al_dia';
  // Lo que se muestra como "debe": el mes actual si falta, si no el próximo cuando ya se acerca.
  const owing = paid < due ? { amount: due - paid, date: cycle.start } : { amount: Math.max(0, due - nextPaid), date: cycle.end };
  return { cycle, status, due, paid, balance: paid - due, dueDate: owing.date, owed: owing.amount, nextDate: cycle.end, nextAmount: due };
}

/** Qué aviso toca HOY (corrida diaria): 'reminder' N días antes de la fecha de pago, 'overdue' al día siguiente. */
export function reminderFor(client, payments, cfg, now) {
  const c = cfgOf(cfg);
  const cy = clientCycle(client, payments, c, now);
  const today = startOfDay(now);
  const mine = payments.filter((p) => p.clientId === client.id);
  if (today === cy.cycle.end - c.reminderDaysBefore * DAY && paidIn(mine, keyOf(cy.cycle.end)) < cy.due) {
    return { phase: 'reminder', key: keyOf(cy.cycle.end), due: cy.due - paidIn(mine, keyOf(cy.cycle.end)), dueDate: cy.cycle.end };
  }
  if (today === cy.cycle.start + DAY && cy.paid < cy.due) return { phase: 'overdue', key: cy.cycle.key, due: cy.due - cy.paid, dueDate: cy.cycle.start };
  return null;
}

/** Métricas del negocio (C$ salvo *Usd). Cobros y liquidez se miden en el ciclo del proveedor. */
export function metrics(clients, payments, cfg, now) {
  const c = cfgOf(cfg);
  const cycle = cycleBounds(now, c.cycleDay);
  const active = clients.filter((x) => x.status === 'activo');
  const rows = active.map((x) => ({ client: x, ...clientCycle(x, payments, c, now) }));
  const revenue = active.reduce((s, x) => s + (Number(x.price) || 0), 0);
  const costUsd = active.length * c.costPerSeatUsd;
  const costNio = costUsd * c.exchangeRate;
  const profit = revenue - costNio;
  const inCycle = (p) => { const t = toMs(p.paidAt); return t >= cycle.start && t < cycle.end; };
  const collected = payments.filter(inCycle).reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const upcoming = rows.map((r) => r.nextDate).filter((t) => t > now);
  return {
    cycle, nextDue: upcoming.length ? Math.min(...upcoming) : null, activeCount: active.length, revenue, costUsd, costNio, profit,
    margin: revenue > 0 ? profit / revenue : 0,
    expected: revenue, collected, pending: Math.max(0, revenue - collected),
    collectedUsd: collected / c.exchangeRate, invoiceUsd: costUsd,
    liquidityGapNio: Math.max(0, costNio - collected), covered: collected >= costNio,
    projectedNext: revenue,
    unpaid: rows.filter((r) => r.status === 'pendiente' || r.status === 'vencido').sort((a, b) => a.dueDate - b.dueDate),
  };
}
