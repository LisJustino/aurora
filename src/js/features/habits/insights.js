// Análise dos hábitos: números calculados só a partir das marcações já
// existentes. Não grava nada e não depende da tela.
import { addDays, pk } from '../../utils/dates.js';
import { habitIsSkipped } from './model.js';
import { habitStartedOnOrBefore } from './dates.js';

export const INSIGHT_WINDOW_DAYS = 28;
export const MIN_SCHEDULED_FOR_RATE = 8;
export const MIN_STREAK_AT_RISK = 3;
const STRUGGLING_BELOW = 0.5;
const SOLID_FROM = 0.8;

const isActive = (habit) => (habit.status || 'active') === 'active';

// Dias em que o hábito era esperado: programado, já iniciado e não pulado.
export function habitExpectedDays(habit, from, to) {
  const days = [];
  for (let day = from, guard = 0; day <= to && guard < 400; day = addDays(day, 1), guard++) {
    if (!habitStartedOnOrBefore(habit, day)) continue;
    if (!habit.days.includes(pk(day).getDay())) continue;
    if (habitIsSkipped(habit, day, to)) continue;
    days.push(day);
  }
  return days;
}

// Maior sequência de dias programados cumpridos já registrada.
export function habitBestStreak(habit, today) {
  const done = new Set(habit.completions);
  const first = [...done].sort()[0];
  if (!first) return 0;
  let best = 0;
  let run = 0;
  for (const day of habitExpectedDays(habit, first, today)) {
    if (done.has(day)) {
      run++;
      best = Math.max(best, run);
    } else {
      run = 0;
    }
  }
  return best;
}

// Sequência atual (dias programados seguidos), sem contar hoje se ainda aberto.
function currentStreak(habit, today) {
  const done = new Set(habit.completions);
  const first = [...done].sort()[0];
  if (!first) return 0;
  const days = habitExpectedDays(habit, first, today);
  let streak = 0;
  for (let index = days.length - 1; index >= 0; index--) {
    if (done.has(days[index])) streak++;
    else if (days[index] === today) continue;
    else break;
  }
  return streak;
}

export function habitInsights(habits, today, windowDays = INSIGHT_WINDOW_DAYS) {
  const from = addDays(today, -(windowDays - 1));
  const live = (Array.isArray(habits) ? habits : []).filter(isActive);
  const weekday = Array.from({ length: 7 }, () => ({ scheduled: 0, completed: 0 }));
  const perHabit = [];
  let scheduledTotal = 0;
  let completedTotal = 0;

  for (const habit of live) {
    const done = new Set(habit.completions);
    const days = habitExpectedDays(habit, from, today);
    // Hoje ainda em aberto não conta como falha.
    const settled = days.filter((day) => day !== today || done.has(day));
    for (const day of settled) {
      const slot = weekday[pk(day).getDay()];
      slot.scheduled++;
      if (done.has(day)) slot.completed++;
    }
    const scheduled = settled.length;
    const completed = settled.filter((day) => done.has(day)).length;
    scheduledTotal += scheduled;
    completedTotal += completed;
    const streak = currentStreak(habit, today);
    const dueToday = habit.days.includes(pk(today).getDay())
      && habitStartedOnOrBefore(habit, today) && !habitIsSkipped(habit, today, today);
    perHabit.push({
      habit,
      scheduled,
      completed,
      rate: scheduled ? completed / scheduled : null,
      streak,
      bestStreak: habitBestStreak(habit, today),
      atRisk: dueToday && !done.has(today) && streak >= MIN_STREAK_AT_RISK,
    });
  }

  const rated = perHabit.filter((item) => item.scheduled >= MIN_SCHEDULED_FOR_RATE);
  const struggling = rated
    .filter((item) => item.rate < STRUGGLING_BELOW)
    .sort((a, b) => a.rate - b.rate);
  const solid = rated
    .filter((item) => item.rate >= SOLID_FROM)
    .sort((a, b) => b.rate - a.rate);
  const weekdays = weekday.map((slot, index) => ({
    weekday: index,
    scheduled: slot.scheduled,
    rate: slot.scheduled ? slot.completed / slot.scheduled : null,
  }));
  const rankable = weekdays.filter((slot) => slot.scheduled >= 4);
  const hardestWeekday = rankable.length >= 3
    ? rankable.reduce((low, slot) => (slot.rate < low.rate ? slot : low))
    : null;
  const easiestWeekday = rankable.length >= 3
    ? rankable.reduce((high, slot) => (slot.rate > high.rate ? slot : high))
    : null;
  const spread = hardestWeekday && easiestWeekday ? easiestWeekday.rate - hardestWeekday.rate : 0;

  return {
    windowDays,
    scheduled: scheduledTotal,
    completed: completedTotal,
    rate: scheduledTotal ? completedTotal / scheduledTotal : null,
    habits: perHabit,
    atRisk: perHabit.filter((item) => item.atRisk).sort((a, b) => b.streak - a.streak),
    struggling,
    solid,
    weekdays,
    // Só destaca o dia mais difícil quando a diferença para o melhor é relevante.
    hardestWeekday: spread >= 0.25 ? hardestWeekday : null,
    easiestWeekday: spread >= 0.25 ? easiestWeekday : null,
    bestStreak: perHabit.reduce((best, item) => (item.bestStreak > (best?.bestStreak ?? 0) ? item : best), null),
  };
}
