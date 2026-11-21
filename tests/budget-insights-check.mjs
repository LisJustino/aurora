import assert from 'node:assert/strict';
import {
  BUDGET_ALERT_DEFAULT,
  budgetHistory,
  budgetReport,
  budgetSettingsFor,
  normalizeBudgetSettings,
  suggestBudgetCents,
} from '../src/js/features/finance/budget-insights.js';

const shiftMonth = (month, delta) => {
  const [year, monthNumber] = month.split('-').map(Number);
  const date = new Date(year, monthNumber - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};
const money = (cents) => `R$ ${(cents / 100).toFixed(2)}`;
const expense = (id, date, cents, category) => ({ id, type: 'out', date, cents, category, accountId: 'a1' });
const income = (id, date, cents) => ({ id, type: 'in', date, cents, category: 'Salário', accountId: 'a1' });

// normalização das preferências de orçamento
assert.deepEqual(normalizeBudgetSettings(null), {});
assert.deepEqual(normalizeBudgetSettings([]), {});
const normalized = normalizeBudgetSettings({
  Mercado: { alertPct: 90, pinned: true },
  Lazer: { alertPct: 80, pinned: false },
  Casa: { alertPct: 33, pinned: true },
  Vazio: 'texto',
  '': { alertPct: 90 },
});
assert.deepEqual(Object.keys(normalized).sort(), ['Casa', 'Mercado']);
assert.deepEqual(normalized.Mercado, { alertPct: 90, pinned: true });
assert.deepEqual(normalized.Casa, { alertPct: BUDGET_ALERT_DEFAULT, pinned: true });
assert.deepEqual(budgetSettingsFor(normalized, 'Lazer'), { alertPct: BUDGET_ALERT_DEFAULT, pinned: false });
assert.deepEqual(budgetSettingsFor(undefined, 'Qualquer'), { alertPct: BUDGET_ALERT_DEFAULT, pinned: false });

// histórico e sugestão
const transactions = [
  expense('1', '2026-08-10', 30000, 'Mercado'),
  expense('2', '2026-09-10', 50000, 'Mercado'),
  expense('3', '2026-10-10', 40500, 'Mercado'),
  expense('4', '2026-10-12', 9000, 'Lazer'),
];
const history = budgetHistory(transactions, 'Mercado', '2026-11', 3, shiftMonth);
assert.deepEqual(history.map((entry) => entry.month), ['2026-08', '2026-09', '2026-10']);
assert.deepEqual(history.map((entry) => entry.cents), [30000, 50000, 40500]);
assert.deepEqual(suggestBudgetCents(history), { cents: 40200 + 800, months: 3 });
assert.equal(suggestBudgetCents(budgetHistory(transactions, 'Lazer', '2026-11', 3, shiftMonth)), null);

// relatório do mês
const reportTransactions = [
  income('i1', '2026-11-05', 400000),
  expense('e1', '2026-11-06', 90000, 'Mercado'),
  expense('e2', '2026-11-08', 30000, 'Lazer'),
  expense('e3', '2026-11-09', 80000, 'Moradia'),
  expense('e4', '2026-10-06', 40000, 'Mercado'),
  expense('e5', '2026-10-08', 20000, 'Lazer'),
  expense('e6', '2026-09-08', 70000, 'Moradia'),
  expense('e7', '2026-08-08', 70000, 'Moradia'),
  expense('e8', '2026-10-09', 70000, 'Moradia'),
  { ...expense('e9', '2026-11-20', 10000, 'Mercado'), paid: false },
];
const report = budgetReport({
  transactions: reportTransactions,
  budgets: { Mercado: { cents: 80000 }, Lazer: { cents: 35000 } },
  settings: { Lazer: { alertPct: 80, pinned: false } },
  month: '2026-11',
  previousMonth: '2026-10',
  throughDay: 20,
  accountForId: () => ({ type: 'checking' }),
  formatMoney: money,
  shiftMonth,
});
const texts = report.map((item) => item.text);
assert.ok(texts[0].includes('resultado positivo'), texts[0]);
assert.ok(texts.some((text) => text.includes('maiores no mesmo período do mês anterior')), texts.join('\n'));
assert.ok(texts.some((text) => text.includes('A categoria que mais subiu foi Mercado')), texts.join('\n'));
assert.ok(texts.some((text) => text === 'Acima do limite: Mercado.'), texts.join('\n'));
assert.ok(texts.some((text) => text === 'Perto do limite: Lazer.'), texts.join('\n'));
assert.ok(texts.some((text) => text.includes('Moradia pesa') && text.includes('Sugestão: R$ 700.00')), texts.join('\n'));
assert.ok(texts.some((text) => text.includes('Ainda faltam pagar R$ 100.00')), texts.join('\n'));

// sem lançamentos no mês não há relatório
assert.deepEqual(budgetReport({
  transactions: [],
  month: '2026-11',
  previousMonth: '2026-10',
  shiftMonth,
}), []);

// limites dentro do combinado
const calm = budgetReport({
  transactions: [income('i', '2026-11-02', 100000), expense('x', '2026-11-03', 10000, 'Mercado')],
  budgets: { Mercado: { cents: 80000 } },
  month: '2026-11',
  previousMonth: '2026-10',
  formatMoney: money,
  shiftMonth,
}).map((item) => item.text);
assert.ok(calm.includes('Todos os limites estão dentro do combinado.'), calm.join('\n'));

console.log('budget-insights-check: ok');
