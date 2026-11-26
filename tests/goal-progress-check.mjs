import assert from 'node:assert/strict';
import { goalProgress, isValidGoalTrack, yearBalance } from '../src/js/features/planning/goal-progress.js';

const all = [0, 1, 2, 3, 4, 5, 6];
const days = (from, n) => Array.from({ length: n }, (_, i) => new Date(Date.UTC(2026, 0, 1 + from + i)).toISOString().slice(0, 10));
const habit = (completions) => ({ id: 'h1', name: 'Ler', days: all, completions, status: 'active' });
const ctx = (today, habits = []) => ({ today, year: '2026', habits });

// manual
assert.equal(goalProgress({ done: false }, ctx('2026-06-01')).status, 'open');
assert.equal(goalProgress({ done: true }, ctx('2026-06-01')).status, 'done');
assert.equal(goalProgress({ done: false }, ctx('2027-01-02')).status, 'missed');
assert.equal(goalProgress({ done: true }, ctx('2027-01-02')).status, 'done');

// hábito: 10 de janeiro, 9 dias fechados feitos (hoje em aberto não conta)
const g = (targetPct) => ({ done: false, track: { kind: 'habit', habitId: 'h1', targetPct } });
let r = goalProgress(g(80), ctx('2026-01-10', [habit(days(0, 9))]));
assert.equal(r.status, 'on-track');
assert.equal(r.pct, 100);
assert.match(r.detail, /9 de 9 dias \(100%\) · meta 80%/);
// metade dos dias: atrasada para 80%, no ritmo para 60%? 50% < 60% também atrasada
r = goalProgress(g(80), ctx('2026-01-10', [habit(days(0, 9).filter((_, i) => i % 2 === 0))]));
assert.equal(r.status, 'behind');
assert.equal(goalProgress(g(60), ctx('2026-01-10', [habit(days(0, 9).filter((_, i) => i % 3 !== 0))])).status, 'on-track'); // 6/9 = 67%
// fim do ano: decide
const full = habit(days(0, 365));
assert.equal(goalProgress(g(100), ctx('2027-01-01', [full])).status, 'done');
assert.equal(goalProgress(g(100), ctx('2027-01-01', [habit(days(0, 300))])).status, 'missed');
assert.equal(goalProgress(g(60), ctx('2027-01-01', [habit(days(0, 300))])).status, 'done'); // 82%
// hábito apagado
assert.equal(goalProgress(g(80), ctx('2026-03-01', [])).status, 'open');
assert.equal(goalProgress(g(80), ctx('2027-03-01', [])).status, 'missed');
// ano futuro
assert.equal(goalProgress(g(80), { today: '2026-11-22', year: '2027', habits: [habit([])] }).status, 'open');

// contagem
const c = (current, target = 12) => ({ done: false, track: { kind: 'count', current, target } });
assert.equal(goalProgress(c(12), ctx('2026-03-01')).status, 'done');
assert.equal(goalProgress(c(0), ctx('2026-03-01')).status, 'behind');
assert.equal(goalProgress(c(3), ctx('2026-03-01')).status, 'on-track'); // 25% > ~16% decorrido
assert.equal(goalProgress(c(5), ctx('2027-01-01')).status, 'missed');
assert.equal(goalProgress(c(6), ctx('2026-06-01')).pct, 50);
assert.equal(goalProgress(c(6), ctx('2026-06-01')).detail, '6 de 12');

// validação
assert.ok(isValidGoalTrack(undefined));
assert.ok(isValidGoalTrack({ kind: 'habit', habitId: 'x', targetPct: 80 }));
assert.ok(!isValidGoalTrack({ kind: 'habit', habitId: 'x', targetPct: 75 }));
assert.ok(isValidGoalTrack({ kind: 'count', target: 12, current: 0 }));
assert.ok(!isValidGoalTrack({ kind: 'count', target: 0, current: 0 }));
assert.ok(!isValidGoalTrack({ kind: 'count', target: 1.5, current: 0 }));
assert.ok(isValidGoalTrack({ kind: 'finance-goal', goalId: 'fg-1' }));
assert.ok(!isValidGoalTrack({ kind: 'finance-goal', goalId: '' }));
assert.ok(!isValidGoalTrack({ kind: 'outro' }));
assert.ok(!isValidGoalTrack(null));

// objetivo financeiro
const fg = { done: false, track: { kind: 'finance-goal', goalId: 'fg-1' } };
const finCtx = (today, savedCents, extra = {}) => ({
  today,
  year: '2026',
  financeGoals: [{ id: 'fg-1', name: 'Reserva', targetCents: 100000, savedCents }],
  ...extra,
});
let fr = goalProgress(fg, finCtx('2026-06-01', 60000));
assert.equal(fr.status, 'on-track');
assert.equal(fr.pct, 60);
assert.match(fr.detail, /Reserva/);
assert.equal(goalProgress(fg, finCtx('2026-06-01', 10000)).status, 'behind');
assert.equal(goalProgress(fg, finCtx('2026-06-01', 100000)).status, 'done');
assert.equal(goalProgress(fg, finCtx('2027-01-02', 50000)).status, 'missed');
assert.equal(goalProgress(fg, finCtx('2026-06-01', 60000, { hideFinanceValues: true })).detail, '60% · Reserva');
assert.equal(goalProgress(fg, ctx('2026-06-01')).status, 'open');

// balanço
const b = yearBalance([{ done: true }, { done: false }, c(12)], ctx('2027-01-01'));
assert.equal(b.total, 3);
assert.equal(b.kept, 2);
assert.equal(b.counts.missed, 1);
assert.ok(b.ended);
assert.ok(!yearBalance([], ctx('2026-05-01')).ended);
console.log('goal progress ok');
