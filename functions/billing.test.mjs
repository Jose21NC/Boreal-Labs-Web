// Pruebas de functions/billing.js. Ejecutar: cd functions && node --test billing.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { amountDue, clientCycle, creditFor, cycleBounds, dueDateOf, metrics, nextDueDate, prorate, reminderPhase } from './billing.js';

// Hora de Managua (UTC-6): '2026-11-07' → mediodía local.
const at = (iso, h = 12) => Date.parse(`${iso}T00:00:00Z`) + (h + 6) * 3600000;
const day = (iso) => Date.parse(`${iso}T06:00:00Z`);

test('ciclo: del 24 al 24, el 24 ya es ciclo nuevo', () => {
  const c = cycleBounds(at('2026-11-07'));
  assert.deepEqual([c.start, c.end, c.key, c.days], [day('2026-10-24'), day('2026-11-24'), '2026-10', 31]);
  assert.equal(cycleBounds(at('2026-11-24', 0)).key, '2026-11');
  assert.equal(cycleBounds(at('2026-11-23', 23)).key, '2026-10');
  assert.equal(cycleBounds(at('2027-01-05')).key, '2026-12'); // cruce de año
});

test('prorrateo: redondea hacia arriba a 10 C$', () => {
  assert.equal(prorate(300, at('2026-11-07')), 170); // 17/31 de 300 = 164.5
  assert.equal(prorate(300, at('2026-10-24')), 300); // entra el 24: ciclo completo
  assert.equal(prorate(300, at('2026-11-23')), 10); // 1/31 = 9.7
  assert.equal(prorate(250, at('2026-11-24', 8)), 250);
});

test('crédito de clientes existentes: pagó el 29-oct → próximo cobro 250', () => {
  const next = cycleBounds(day('2026-11-24'));
  assert.equal(creditFor(300, day('2026-11-29'), next), 50);
  const client = { id: 'a', price: 300, joinedAt: day('2026-10-29') };
  const pays = [{ clientId: 'a', cycleKey: '2026-10', amount: 300, coversUntil: day('2026-11-29') }];
  assert.equal(amountDue(client, next, pays), 250);
  // Sin pago adelantado (cubre hasta fin de ciclo) no hay crédito.
  assert.equal(amountDue(client, next, [{ clientId: 'a', cycleKey: '2026-10', amount: 260 }]), 300);
});

test('estados alrededor del día 20 y del 24', () => {
  const client = { id: 'a', price: 300, status: 'activo', joinedAt: day('2026-09-01') };
  const st = (iso, pays = []) => clientCycle(client, pays, {}, at(iso)).status;
  assert.equal(st('2026-11-19'), 'pendiente');
  assert.equal(st('2026-11-20'), 'pendiente'); // el día límite aún es a tiempo
  assert.equal(st('2026-11-21'), 'vencido');
  assert.equal(st('2026-11-23'), 'vencido');
  assert.equal(st('2026-11-24'), 'pendiente'); // ciclo nuevo
  assert.equal(st('2026-11-21', [{ clientId: 'a', cycleKey: '2026-10', amount: 300 }]), 'al_dia');
  assert.equal(clientCycle({ ...client, status: 'pausado' }, [], {}, at('2026-11-21')).status, 'pausado');
  assert.equal(clientCycle({ ...client, status: 'cancelado' }, [], {}, at('2026-11-21')).status, 'cancelado');
});

test('vencimiento: día 20 y no vence el mismo día de ingreso tardío', () => {
  assert.equal(dueDateOf(cycleBounds(at('2026-11-07'))), day('2026-11-20'));
  assert.equal(nextDueDate(at('2026-11-20')), day('2026-11-20'));
  assert.equal(nextDueDate(at('2026-11-21')), day('2026-12-20'));
  const late = { id: 'b', price: 300, status: 'activo', joinedAt: at('2026-11-22') };
  assert.equal(clientCycle(late, [], {}, at('2026-11-22')).status, 'pendiente');
  assert.equal(clientCycle(late, [], {}, at('2026-11-23')).status, 'vencido');
});

test('avisos: recordatorio 3 días antes y vencido al día siguiente', () => {
  const due = day('2026-11-20');
  assert.equal(reminderPhase(due, at('2026-11-17', 9), 3), 'reminder');
  assert.equal(reminderPhase(due, at('2026-11-21', 9), 3), 'overdue');
  assert.equal(reminderPhase(due, at('2026-11-18', 9), 3), null);
});

test('métricas con los clientes de ejemplo', () => {
  const clients = [
    { id: 'a', price: 300, status: 'activo', joinedAt: day('2026-10-29') },
    { id: 'b', price: 300, status: 'activo', joinedAt: day('2026-10-29') },
    { id: 'c', price: 220, status: 'activo', joinedAt: day('2026-11-04') },
    { id: 'd', price: 250, status: 'activo', joinedAt: day('2026-11-07') },
    { id: 'e', price: 300, status: 'pausado', joinedAt: day('2026-08-01') },
  ];
  const pays = [
    { clientId: 'a', cycleKey: '2026-10', amount: 300, coversUntil: day('2026-11-29') },
    { clientId: 'b', cycleKey: '2026-10', amount: 300, coversUntil: day('2026-11-29') },
  ];
  const m = metrics(clients, pays, {}, at('2026-11-07'));
  assert.equal(m.activeCount, 4);
  assert.equal(m.revenue, 1070);
  assert.equal(m.costUsd, 12);
  assert.ok(Math.abs(m.costNio - 439.2) < 1e-9);
  assert.ok(Math.abs(m.profit - 630.8) < 1e-9);
  assert.ok(Math.abs(m.margin - 630.8 / 1070) < 1e-9);
  assert.equal(m.collected, 600);
  assert.equal(m.covered, true); // 600 ≥ 439.2
  assert.equal(m.liquidityGapNio, 0);
  // Esperado: a,b prorrateo desde 29-oct (26/31 → 260 c/u), c 220×20/31=141.9→150, d 250×17/31=137.1→140.
  assert.equal(m.expected, 260 + 260 + 150 + 140);
  assert.equal(m.unpaid.length, 2); // c y d
  // Próximo ciclo: a,b 250 (crédito), c 220, d 250.
  assert.equal(m.projectedNext, 250 + 250 + 220 + 250);
  const poor = metrics(clients, [], {}, at('2026-11-07'));
  assert.ok(Math.abs(poor.liquidityGapNio - 439.2) < 1e-9);
  assert.equal(poor.covered, false);
});
