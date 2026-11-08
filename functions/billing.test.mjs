// Pruebas de functions/billing.js. Ejecutar: cd functions && node --test billing.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { clientCycle, cycleBounds, metrics, paymentPeriod, periodOf, reminderFor } from './billing.js';

// Hora de Managua (UTC-6): '2026-11-07' → mediodía local.
const at = (iso, h = 12) => Date.parse(`${iso}T00:00:00Z`) + (h + 6) * 3600000;
const day = (iso) => Date.parse(`${iso}T06:00:00Z`);

// Los 4 clientes reales: cada uno paga el día de su primer pago, con su propio precio.
const clients = [
  { id: 'a', price: 300, joinedAt: at('2026-10-29'), status: 'activo' },
  { id: 'b', price: 300, joinedAt: at('2026-10-29'), status: 'activo' },
  { id: 'c', price: 220, joinedAt: at('2026-11-04'), status: 'activo' },
  { id: 'd', price: 250, joinedAt: at('2026-11-07'), status: 'activo' },
];
const pays = clients.map((c) => ({ clientId: c.id, amount: c.price, paidAt: c.joinedAt, cycleKey: paymentPeriod(c, c.joinedAt).key }));

test('periodo mensual por día de pago; el 31 cae al último día de meses cortos', () => {
  assert.deepEqual([periodOf(at('2026-11-10'), 29).start, periodOf(at('2026-11-10'), 29).end], [day('2026-10-29'), day('2026-11-29')]);
  const p = periodOf(at('2026-11-15'), 31);
  assert.deepEqual([p.start, p.end], [day('2026-10-31'), day('2026-11-30')]);
  assert.equal(cycleBounds(at('2026-11-07')).key, '2026-10'); // proveedor: 24-oct a 24-nov
});

test('cada cliente: al día hoy y próxima fecha propia con su precio', () => {
  const now = at('2026-11-07');
  const r = clients.map((c) => clientCycle(c, pays, {}, now));
  assert.deepEqual(r.map((x) => x.status), ['al_dia', 'al_dia', 'al_dia', 'al_dia']);
  assert.deepEqual(r.map((x) => x.nextDate), [day('2026-11-29'), day('2026-11-29'), day('2026-12-04'), day('2026-12-07')]);
  assert.deepEqual(r.map((x) => x.nextAmount), [300, 300, 220, 250]);
});

test('pago adelantado (hasta 7 días antes) cuenta para el mes siguiente', () => {
  assert.equal(paymentPeriod(clients[0], at('2026-11-26')).key, '2026-11');
  assert.equal(paymentPeriod(clients[0], at('2026-11-15')).key, '2026-10');
});

test('recordatorio 3 días antes; pendiente cerca de la fecha; vencido si no paga', () => {
  const a = clients[0];
  assert.deepEqual(reminderFor(a, pays, {}, at('2026-11-26', 9)), { phase: 'reminder', key: '2026-11', due: 300, dueDate: day('2026-11-29') });
  assert.equal(reminderFor(a, pays, {}, at('2026-11-25', 9)), null);
  assert.equal(clientCycle(a, pays, {}, at('2026-11-27')).status, 'pendiente');
  assert.equal(clientCycle(a, pays, {}, at('2026-11-29')).status, 'pendiente'); // el mismo día aún no vence
  assert.equal(clientCycle(a, pays, {}, at('2026-11-30')).status, 'vencido');
  assert.equal(reminderFor(a, pays, {}, at('2026-11-30', 9)).phase, 'overdue');
  const paid = [...pays, { clientId: 'a', amount: 300, paidAt: at('2026-11-27'), cycleKey: paymentPeriod(a, at('2026-11-27')).key }];
  assert.equal(clientCycle(a, paid, {}, at('2026-11-30')).status, 'al_dia');
  assert.equal(reminderFor(a, paid, {}, at('2026-11-30', 9)), null);
});

test('métricas: ingresos, costo y ganancia', () => {
  const m = metrics(clients, pays, {}, at('2026-11-10'));
  assert.equal(m.revenue, 1070);
  assert.equal(m.costUsd, 12);
  assert.equal(Math.round(m.profit * 10) / 10, 630.8);
  assert.equal(m.collected, 1070); // todos pagaron dentro del ciclo del proveedor 24-oct → 24-nov
  assert.equal(m.nextDue, day('2026-11-29'));
  assert.equal(m.unpaid.length, 0);
});

test('cancelar al final del mes: sin recordatorio ni cobro siguiente; luego sale de las métricas', () => {
  const a = { ...clients[0], cancelAt: day('2026-11-29') };
  const all = [a, ...clients.slice(1)];
  assert.equal(reminderFor(a, pays, {}, at('2026-11-26', 9)), null);
  assert.equal(clientCycle(a, pays, {}, at('2026-11-27')).status, 'al_dia');
  assert.equal(clientCycle(a, pays, {}, at('2026-11-27')).nextAmount, 0);
  assert.equal(clientCycle(a, pays, {}, at('2026-11-30')).status, 'cancelado');
  assert.equal(metrics(all, pays, {}, at('2026-11-30')).activeCount, 3);
  assert.equal(metrics(all, pays, {}, at('2026-11-10')).projectedNext, 770);
});

test('dinero disponible registrado a mano + cobros posteriores', () => {
  const extra = [...pays, { clientId: 'a', amount: 300, paidAt: at('2026-11-20'), cycleKey: '2026-11' }];
  const m = metrics(clients, extra, { cashOnHand: 200, cashAt: at('2026-11-15') }, at('2026-11-21'));
  assert.equal(m.available, 500);
  assert.equal(m.covered, true); // factura 439.2
  assert.equal(metrics(clients, extra, { cashOnHand: 100, cashAt: at('2026-11-21', 13) }, at('2026-11-21', 14)).covered, false);
});
