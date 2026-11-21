import assert from 'node:assert/strict';
import {
  balanceSplit,
  cardInfo,
  cardInvoice,
  dailyBudgetRoom,
  goalMonthlyPlan,
  invoiceDueDate,
  savingsRatePercent,
} from '../src/js/features/finance/calculations.js';

const shiftMonth = (month, delta) => {
  const [year, monthNumber] = month.split('-').map(Number);
  const date = new Date(year, monthNumber - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};
const parseDate = (value) => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
};
const out = (id, date, cents, category, accountId = 'main', extra = {}) => ({
  id, type: 'out', date, cents, category, accountId, ...extra,
});

// gasto diário dentro dos limites
const tx = [
  out('1', '2026-11-03', 30000, 'Mercado'),
  out('2', '2026-11-10', 10000, 'Lazer'),
  out('3', '2026-11-25', 5000, 'Mercado'),
  out('4', '2026-11-12', 99999, 'Sem limite'),
];
const budgets = { Mercado: { cents: 80000 }, Lazer: { cents: 20000 }, Zero: { cents: 0 } };
const room = dailyBudgetRoom(budgets, tx, '2026-11', '2026-11-21');
assert.equal(room.hasLimits, true);
assert.equal(room.limitCents, 100000);
assert.equal(room.spentCents, 45000);
assert.equal(room.remainingCents, 55000);
assert.equal(room.daysLeft, 10);
assert.equal(room.perDayCents, 5500);
assert.equal(dailyBudgetRoom({}, tx, '2026-11', '2026-11-21').hasLimits, false);
const over = dailyBudgetRoom({ Mercado: { cents: 20000 } }, tx, '2026-11', '2026-11-21');
assert.equal(over.perDayCents, 0);
assert.equal(over.overCents, 15000);
assert.equal(dailyBudgetRoom(budgets, tx, '2026-10', '2026-11-21').daysLeft, 0);

// meta com valor mensal
assert.deepEqual(goalMonthlyPlan({ targetCents: 1000 }, 1000, '2026-11-21'),
  { remainingCents: 0, complete: true, months: 0, perMonthCents: 0, overdue: false });
assert.equal(goalMonthlyPlan({ targetCents: 120000, deadline: '2027-05-21' }, 0, '2026-11-21').months, 6);
assert.equal(goalMonthlyPlan({ targetCents: 120000, deadline: '2027-05-21' }, 0, '2026-11-21').perMonthCents, 20000);
assert.equal(goalMonthlyPlan({ targetCents: 100000, deadline: '2026-12-01' }, 0, '2026-11-21').months, 1);
assert.equal(goalMonthlyPlan({ targetCents: 100000, deadline: '2026-11-01' }, 40000, '2026-11-21').overdue, true);
assert.equal(goalMonthlyPlan({ targetCents: 100000 }, 40000, '2026-11-21').perMonthCents, null);
assert.equal(goalMonthlyPlan({ targetCents: 100000, deadline: '2027-01-10' }, 1, '2026-11-21').perMonthCents, 50000);

// saldo disponível x guardado e taxa de poupança
const accounts = [
  { id: 'main', type: 'checking', initialCents: 100000 },
  { id: 'reserve', type: 'savings', initialCents: 50000 },
  { id: 'fund', type: 'investment', initialCents: 25000 },
  { id: 'card', type: 'credit', initialCents: 0 },
];
assert.deepEqual(balanceSplit(accounts, []), { hasSaved: true, savedCents: 75000, availableCents: 100000 });
assert.equal(balanceSplit(accounts.slice(0, 1), []).hasSaved, false);
assert.equal(savingsRatePercent(100000, 80000), 20);
assert.equal(savingsRatePercent(100000, 120000), -20);
assert.equal(savingsRatePercent(0, 500), null);

// faturas por mês: fecha dia 20, vence dia 28
const card = { id: 'card', type: 'credit', closingDay: 20, dueDay: 28 };
const cardTx = [
  out('a', '2026-10-21', 1000, 'Compras', 'card'),
  out('b', '2026-11-20', 2000, 'Compras', 'card', { groupId: 'g' }),
  out('c', '2026-11-21', 4000, 'Compras', 'card'),
  out('d', '2026-11-05', 8000, 'Compras', 'main'),
];
const helpers = { shiftMonth, parseDate };
const november = cardInvoice({ tx: cardTx }, card, '2026-11', helpers);
assert.equal(november.total, 3000);
assert.deepEqual(november.purchases.map((item) => item.id), ['b', 'a']);
assert.equal(november.closingDate, '2026-11-20');
assert.equal(november.dueDate, '2026-11-28');
assert.equal(november.installmentCount, 1);
assert.equal(cardInvoice({ tx: cardTx }, card, '2026-12', helpers).total, 4000);
assert.equal(invoiceDueDate({ closingDay: 25, dueDay: 5 }, '2026-11', shiftMonth), '2026-12-05');
assert.equal(invoiceDueDate({ dueDay: 31 }, '2026-02', shiftMonth), '2026-02-28');
assert.equal(invoiceDueDate({ closingDay: 10 }, '2026-02', shiftMonth), null);
assert.equal(cardInvoice({ tx: [] }, { id: 'x', closingDay: 31 }, '2026-02', helpers).closingDate, '2026-02-28');

// cardInfo continua apontando para o ciclo atual
const info = cardInfo({ tx: cardTx }, card, '2026-11-25', { shiftMonth, parseDate, accountBalance: () => -7000 });
assert.equal(info.ym, '2026-12');
assert.equal(info.total, 4000);
assert.equal(info.due, '2026-12-28');
assert.equal(info.used, 7000);

console.log('finance-planning-check: ok');
