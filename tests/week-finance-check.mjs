import assert from 'node:assert/strict';
import { weekSpending } from '../src/js/features/planning/week-finance.js';

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
console.log('week finance ok');
