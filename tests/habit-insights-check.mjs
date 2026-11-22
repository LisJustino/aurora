import assert from 'node:assert/strict';
import { habitBestStreak, habitInsights } from '../src/js/features/habits/insights.js';
import { parseBulkHabits, parseHabitSchedule, MAX_BULK_HABITS } from '../src/js/features/habits/bulk-habits.js';

const today = '2026-11-22'; // domingo
const dayN = (n) => { const d = new Date(2026, 10, 22 - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const all = [0, 1, 2, 3, 4, 5, 6];
const mk = (name, completions, extra = {}) => ({ id: name, name, days: all, completions, status: 'active', ...extra });

// Sequência ativa de 5 dias (ontem para trás), hoje ainda em aberto: não quebra e vira "em risco".
const streak = mk('Ler', [1, 2, 3, 4, 5].map(dayN));
let r = habitInsights([streak], today);
assert.equal(r.habits[0].streak, 5);
assert.equal(r.atRisk.length, 1);
assert.equal(r.atRisk[0].habit.name, 'Ler');
// Marcando hoje, deixa de estar em risco e a sequência sobe.
r = habitInsights([mk('Ler', [0, 1, 2, 3, 4, 5].map(dayN))], today);
assert.equal(r.atRisk.length, 0);
assert.equal(r.habits[0].streak, 6);

// Melhor sequência histórica
const gap = mk('Treino', [0, 1, 2, 3, 6, 7, 8, 9, 10, 11].map(dayN));
assert.equal(habitBestStreak(gap, today), 6);

// Taxa em 28 dias; hoje em aberto não conta como falha.
const half = mk('Alongar', Array.from({ length: 14 }, (_, i) => dayN(i * 2 + 1)));
r = habitInsights([half], today);
assert.equal(r.habits[0].scheduled, 27);
assert.equal(r.habits[0].completed, 14);
assert.ok(Math.abs(r.habits[0].rate - 14 / 27) < 1e-9);
assert.equal(r.struggling.length, 0); // 52% não é "dificuldade"
const weak = mk('Meditar', [dayN(3), dayN(10), dayN(20)]);
r = habitInsights([weak, streak], today);
assert.equal(r.struggling[0].habit.name, 'Meditar');
assert.equal(r.solid.length, 0);

// Poucos dados: sem taxa destacada
const fresh = mk('Novo', [], { createdAt: new Date(2026, 10, 20).getTime() });
r = habitInsights([fresh], today);
assert.equal(r.habits[0].scheduled, 2);
assert.equal(r.struggling.length, 0);

// Pausados e arquivados ficam fora; dias pulados não contam
r = habitInsights([mk('A', [], { status: 'paused' }), mk('B', [], { status: 'archived' })], today);
assert.equal(r.habits.length, 0);
assert.equal(r.rate, null);
const skipped = mk('Pulo', [dayN(1)], { skipped: [dayN(2), dayN(3)], createdAt: new Date(2026, 10, 18).getTime() });
r = habitInsights([skipped], today);
assert.equal(r.habits[0].scheduled, 2); // dias 18 a 21 (hoje em aberto fica de fora), menos os pulados 19 e 20
assert.equal(r.habits[0].completed, 1);

// Dia da semana mais difícil: só aparece com diferença relevante entre os dias
const weekdayHabit = mk('Rotina', Array.from({ length: 28 }, (_, i) => dayN(i + 1)).filter((day) => new Date(`${day}T12:00:00`).getDay() !== 3));
r = habitInsights([weekdayHabit], today);
assert.equal(r.hardestWeekday.weekday, 3);
assert.equal(r.hardestWeekday.rate, 0);
assert.equal(habitInsights([mk('Parelho', Array.from({ length: 28 }, (_, i) => dayN(i + 1)))], today).hardestWeekday, null);

// ---- hábitos em lote ----
assert.deepEqual(parseHabitSchedule(''), { days: all, weeklyGoal: null });
assert.deepEqual(parseHabitSchedule('seg a sex').days, [1, 2, 3, 4, 5]);
assert.deepEqual(parseHabitSchedule('segunda-feira, quarta e sexta').days, [1, 3, 5]);
assert.deepEqual(parseHabitSchedule('seg-sex').days, [1, 2, 3, 4, 5]);
assert.deepEqual(parseHabitSchedule('sex a seg').days, [0, 1, 5, 6]);
assert.deepEqual(parseHabitSchedule('fim de semana').days, [0, 6]);
assert.deepEqual(parseHabitSchedule('dias úteis').days, [1, 2, 3, 4, 5]);
assert.deepEqual(parseHabitSchedule('todos os dias'), { days: all, weeklyGoal: null });
assert.deepEqual(parseHabitSchedule('3x por semana'), { days: all, weeklyGoal: 3 });
assert.deepEqual(parseHabitSchedule('seg, qua, sex 2x'), { days: [1, 3, 5], weeklyGoal: 2 });
assert.ok(parseHabitSchedule('seg, qua 3x').error);
assert.match(parseHabitSchedule('quando der').error, /quando/);

const rows = parseBulkHabits(`
- Ler 10 páginas - seg a sex
2. Treinar: seg, qua, sex
Pré-treino
Correr - 3x por semana
Beber água
 - seg
Meditar - fim de semana
ler 10 PÁGINAS
Yoga - quando der
`, [{ name: 'Meditar' }]);
assert.equal(rows.length, 9);
assert.deepEqual(rows[0], { line: 2, source: '- Ler 10 páginas - seg a sex', name: 'Ler 10 páginas', days: [1, 2, 3, 4, 5], weeklyGoal: null, duplicate: false, on: true });
assert.deepEqual(rows[1].days, [1, 3, 5]);
assert.equal(rows[2].name, 'Pré-treino');
assert.deepEqual(rows[2].days, all);
assert.equal(rows[3].weeklyGoal, 3);
assert.match(rows[4].error, /água/);
assert.equal(rows[5].name, 'seg'); // sem separador, a linha toda é o nome
assert.equal(rows[6].duplicate, true); // já existe
assert.equal(rows[6].on, false);
assert.equal(rows[7].duplicate, true); // repetida na própria lista
assert.ok(rows[8].error);
assert.equal(parseBulkHabits('- seg')[0].name, 'seg');
assert.equal(parseBulkHabits(' - ')[0]?.error, 'Escreva o nome do hábito.');
assert.ok(parseBulkHabits('x'.repeat(61))[0].error);
const many = parseBulkHabits(Array.from({ length: MAX_BULK_HABITS + 2 }, (_, i) => `Hábito ${i}`).join('\n'));
assert.equal(many.filter((row) => row.error).length, 2);

console.log('habit insights + bulk ok');
