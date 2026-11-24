import assert from 'node:assert/strict';
import { monthBudgetProgress, weekSpending } from '../src/js/features/planning/week-finance.js';

// semana de 2026-11-16 (seg) a 22 (dom); hoje = quarta 18 → 3 dias decorridos
const tx = [
  { type: 'out', cents: 1000, date: '2026-11-16' },
  { type: 'out', cents: 500, date: '2026-11-18' },
  { type: 'out', cents: 900, date: '2026-11-19' }, // futuro: fora
  { type: 'in', cents: 99999, date: '2026-11-17' },
  { type: 'out', cents: 700, date: '2026-11-09' }, // semana anterior, dentro do trecho
  { type: 'out', cents: 800, date: '2026-11-12' }, // semana anterior, depois do trecho (quinta)
  { type: 'out', cents: 300, date: '2026-11-17', card: true },
];
let r = weekSpending(tx, '2026-11-16', '2026-11-18', (t) => !t.card);
assert.deepEqual(r, { current: 1500, previous: 700, diff: 800, hasPrevious: true });
r = weekSpending(tx, '2026-11-16', '2026-11-18');
assert.equal(r.current, 1800);
r = weekSpending([], '2026-11-16', '2026-11-18');
assert.deepEqual(r, { current: 0, previous: 0, diff: 0, hasPrevious: false });

const month = [
  { type: 'out', cents: 6000, date: '2026-11-03', category: 'Mercado' },
  { type: 'out', cents: 5000, date: '2026-11-10', category: 'Mercado' },
  { type: 'out', cents: 2000, date: '2026-11-11', category: 'Lazer' },
  { type: 'out', cents: 9999, date: '2026-11-12', category: 'Sem limite' },
  { type: 'out', cents: 4000, date: '2026-10-30', category: 'Lazer' },
  { type: 'out', cents: 700, date: '2026-11-13', category: 'Lazer', card: true },
  { type: 'in', cents: 50000, date: '2026-11-05', category: 'Mercado' },
];
const budgets = { Mercado: { cents: 10000 }, Lazer: { cents: 5000 }, Vazio: { cents: 0 } };
assert.deepEqual(monthBudgetProgress(month, budgets, '2026-11', (t) => !t.card), { limit: 15000, spent: 13000, over: ['Mercado'], categories: 2 });
assert.equal(monthBudgetProgress(month, {}, '2026-11'), null);
assert.equal(monthBudgetProgress(month, null, '2026-11'), null);
console.log('week finance ok');
