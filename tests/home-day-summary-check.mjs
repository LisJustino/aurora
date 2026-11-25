import assert from 'node:assert/strict';
import { createHomeDaySummary, homeBadgeCount } from '../src/js/features/home/day-summary.js';

const overdue = { id: 'late', title: 'Pagar conta', done: false };
const todayTask = { id: 'today', title: 'Enviar e-mail', done: false };
const summary = createHomeDaySummary({
  todayTasks: [{ done: true }, todayTask],
  overdueTasks: [overdue],
  dueTodayTasks: [todayTask],
  calendarEvents: [{ done: false }, { done: true }],
  habits: { completed: 1, planned: 3 },
  water: { total: 2500, goal: 2000 },
  balance: { cents: 12345, hidden: true },
});

assert.deepEqual(summary.tasks, { done: 1, total: 2, next: overdue });
assert.deepEqual(summary.calendarEvents, { done: 1, total: 2, pending: 1 });
assert.deepEqual(summary.habits, { done: 1, total: 3, remaining: 2 });
assert.deepEqual(summary.water, { total: 2500, goal: 2000, percent: 100 });
assert.deepEqual(summary.balance, { cents: 12345, hidden: true });

const fallback = createHomeDaySummary({
  overdueTasks: [],
  dueTodayTasks: [todayTask],
  calendarEvents: [{ done: false }],
  habits: { completed: 2, planned: 1 },
});
assert.equal(fallback.tasks.next, todayTask);
assert.deepEqual(fallback.calendarEvents, { done: 0, total: 1, pending: 1 });
assert.deepEqual(fallback.habits, { done: 2, total: 1, remaining: 0 });
assert.equal(fallback.water, null);
assert.equal(fallback.balance, null);

assert.equal(homeBadgeCount({
  day: '2026-11-17',
  weekday: 2,
  tasks: [
    { done: false, dueDate: '2026-11-16' },
    { done: true, dueDate: '2026-11-15' },
    { done: false, dueDate: '2026-11-17' },
  ],
  habits: [
    { id: 'pending', status: 'active', days: [2] },
    { id: 'done', status: 'active', days: [2] },
    { id: 'skipped', status: 'active', days: [2] },
    { id: 'future', status: 'active', days: [2], createdAt: new Date(2026, 10, 18).getTime() },
    { status: 'paused', days: [2] },
  ],
  isComplete: (habit) => habit.id === 'done',
  isSkipped: (habit) => habit.id === 'skipped',
}), 2);
assert.equal(homeBadgeCount({
  day: '2026-11-17',
  weekday: 2,
  habitsEnabled: false,
  tasks: [{ done: false, dueDate: '2026-11-16' }],
}), 1);

console.log('Home day summary: resumo dos cartões de hoje verificado.');
