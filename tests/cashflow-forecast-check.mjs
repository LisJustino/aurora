import assert from 'node:assert/strict';
import { buildCashflowForecast, FORECAST_HORIZONS } from '../src/js/features/finance/cashflow-forecast.js';

assert.deepEqual([...FORECAST_HORIZONS], [30, 60, 90]);

const accounts = [
  { id: 'checking', name: 'Conta Principal', type: 'checking', initialCents: 100000 },
  { id: 'card', name: 'Cartão Azul', type: 'credit', initialCents: 0, closingDay: 20, dueDay: 28 },
];

const transactions = [
  // Já pago na conta: saldo inicial fica 900,00
  { id: 't1', type: 'out', accountId: 'checking', cents: 10000, category: 'Alimentação', desc: 'Mercado', date: '2026-11-05', paid: true },
  // Conta atrasada pendente: entra hoje (-200,00 -> 700,00)
  { id: 't2', type: 'out', accountId: 'checking', cents: 20000, category: 'Moradia', desc: 'Luz', date: '2026-11-08', paid: false },
  // Despesa futura grande no dia 15 (-900,00 -> -200,00, negativo!)
  { id: 't3', type: 'out', accountId: 'checking', cents: 90000, category: 'Moradia', desc: 'Aluguel', date: '2026-11-15', paid: false, recId: 'r-rent' },
  // Salário no dia 20 (+3000,00 -> +2800,00)
  { id: 't4', type: 'in', accountId: 'checking', cents: 300000, category: 'Salário', desc: 'Salário', date: '2026-11-20', paid: false, recId: 'r-sal' },
  // Compra no cartão na fatura atual (vence 28/11: -300,00 -> +2500,00)
  { id: 't5', type: 'out', accountId: 'card', cents: 30000, category: 'Compras', desc: 'Tênis (1/2)', date: '2026-11-06', paid: true, groupId: 'g1' },
  // Parcela 2 no cartão na fatura de dezembro (vence 28/12: -300,00)
  { id: 't6', type: 'out', accountId: 'card', cents: 30000, category: 'Compras', desc: 'Tênis (2/2)', date: '2026-12-06', paid: true, groupId: 'g1' },
];

const recurring = [
  { id: 'r-rent', type: 'out', accountId: 'checking', cents: 90000, category: 'Moradia', desc: 'Aluguel', day: 15, startYM: '2026-11', paused: false },
  { id: 'r-sal', type: 'in', accountId: 'checking', cents: 300000, category: 'Salário', desc: 'Salário', day: 20, startYM: '2026-11', paused: false },
  { id: 'r-paused', type: 'out', accountId: 'checking', cents: 50000, category: 'Lazer', desc: 'Pausada', day: 18, startYM: '2026-11', paused: true },
];

// Horizonte de 30 dias (2026-11-10 até 2026-12-10)
const f30 = buildCashflowForecast({
  accounts,
  transactions,
  recurring,
  asOfDate: '2026-11-10',
  horizonDays: 30,
});

assert.equal(f30.startBalanceCents, 90000);
assert.equal(f30.points.length, 31);
assert.equal(f30.firstNegativeDate, '2026-11-15');
assert.deepEqual(f30.lowestPoint, { date: '2026-11-15', balanceCents: -20000 });
// 900 - 200 (luz) - 900 (aluguel nov) + 3000 (salário nov) - 300 (fatura nov) = 2500,00
assert.equal(f30.endBalanceCents, 250000);
assert.equal(f30.totalInCents, 300000);
assert.equal(f30.totalOutCents, 140000);
assert.equal(f30.eventDays[0].date, '2026-11-10');
assert.equal(f30.eventDays[0].items[0].overdue, true);
// Garante que a fixa pausada não entrou
assert.ok(!f30.eventDays.some((day) => day.items.some((item) => item.label === 'Pausada')));
// Garante que a fixa já materializada em novembro não foi duplicada
assert.equal(
  f30.eventDays.find((day) => day.date === '2026-11-15').items.length,
  1,
);

// Horizonte de 60 dias (2026-11-10 até 2027-01-09): inclui aluguel dez (-900), salário dez (+3000) e fatura dez (-300)
const f60 = buildCashflowForecast({
  accounts,
  transactions,
  recurring,
  asOfDate: '2026-11-10',
  horizonDays: 60,
});
assert.equal(f60.points.length, 61);
// 2500 - 900 + 3000 - 300 = 4300,00
assert.equal(f60.endBalanceCents, 430000);
assert.ok(f60.eventDays.some((day) => day.date === '2026-12-28' && day.items.some((item) => item.kind === 'invoice')));

// Transferência entre contas não-crédito tem impacto líquido zero
const trOnly = buildCashflowForecast({
  accounts: [
    { id: 'a1', name: 'A', type: 'checking', initialCents: 50000 },
    { id: 'a2', name: 'B', type: 'savings', initialCents: 10000 },
  ],
  transactions: [
    { id: 'tr1', type: 'tr', accountId: 'a1', toAccountId: 'a2', cents: 20000, date: '2026-11-12', paid: false },
  ],
  asOfDate: '2026-11-10',
  horizonDays: 30,
});
assert.equal(trOnly.startBalanceCents, 60000);
assert.equal(trOnly.endBalanceCents, 60000);
assert.equal(trOnly.eventDays.length, 0);
assert.equal(trOnly.firstNegativeDate, null);

console.log('cashflow forecast ok');
