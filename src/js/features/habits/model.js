import { addDays, isDay, pk } from '../../utils/dates.js';
import { weekDays } from '../planning/week.js';
import { isPlainObject } from '../../core/data-integrity.js';
import { isValidWaterGoalMl, normalizeWaterHabit } from './water-goal.js';

export const HABIT_ICONS = Object.freeze([
  ['droplet', 'Água'], ['book', 'Leitura'], ['dumbbell', 'Treino'], ['activity', 'Movimento'],
  ['bike', 'Pedalar'], ['leaf', 'Natureza'], ['apple', 'Alimentação'], ['meditate', 'Meditar'],
  ['moon', 'Dormir'], ['sun', 'Acordar'], ['bed', 'Descanso'], ['pencil', 'Escrever'],
  ['note', 'Diário'], ['pill', 'Remédio'], ['coffee', 'Pausa'], ['music', 'Música'],
  ['palette', 'Criar'], ['smile', 'Gratidão'], ['phoneOff', 'Menos tela'], ['heart', 'Autocuidado'],
  ['target', 'Foco'], ['home', 'Casa'], ['sparkles', 'Outro'],
]);
export const HABIT_ICON_KEYS = Object.freeze(HABIT_ICONS.map(([key]) => key));
export const HABIT_COLORS = Object.freeze([
  '#c97994', '#e07a5f', '#d9a05b', '#a3b55a', '#5fa68a', '#5aa5b8',
  '#7c8fd4', '#8a7ac4', '#a24f9e', '#d6455d', '#8b8b95', '#ad8c76',
]);
export const DEFAULT_HABIT_ICON = 'sparkles';
export const DEFAULT_HABIT_COLOR = HABIT_COLORS[0];

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const normalizeHabitName = (name) => String(name || '').trim().toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
export const isWaterHabit = (habit) => (
  habit?.tracking === 'water' || /^beber agua(?:\s|$)/.test(normalizeHabitName(habit?.name))
);
export const habitIconKey = (habit) => (
  HABIT_ICON_KEYS.includes(habit?.icon) ? habit.icon : DEFAULT_HABIT_ICON
);
export const habitColor = (habit) => (
  HEX_COLOR.test(habit?.color || '') ? habit.color : DEFAULT_HABIT_COLOR
);

export const SUGGESTED_HABITS = [
  { id: 'water', name: 'Beber água', description: 'Registre os mL consumidos e acompanhe a meta diária.', icon: 'droplet', color: HABIT_COLORS[5] },
  { id: 'reading', name: 'Ler por 10 minutos', description: 'Reserve alguns minutos para a leitura.', icon: 'book', color: HABIT_COLORS[6] },
  { id: 'movement', name: 'Movimentar o corpo', description: 'Inclua um momento de movimento na rotina.', icon: 'activity', color: HABIT_COLORS[4] },
  { id: 'pause', name: 'Fazer uma pausa', description: 'Faça uma pausa consciente durante o dia.', icon: 'coffee', color: HABIT_COLORS[2] },
  { id: 'sleep', name: 'Dormir no horário', description: 'Vá para a cama sem estender a noite.', icon: 'moon', color: HABIT_COLORS[7] },
  { id: 'stretch', name: 'Alongar', description: 'Poucos minutos de alongamento.', icon: 'dumbbell', color: HABIT_COLORS[1] },
  { id: 'meditate', name: 'Respirar e meditar', description: 'Cinco minutos de calma.', icon: 'meditate', color: HABIT_COLORS[8] },
  { id: 'journal', name: 'Escrever no diário', description: 'Anote como foi o seu dia.', icon: 'note', color: HABIT_COLORS[0] },
  { id: 'outdoors', name: 'Caminhar ao ar livre', description: 'Um pouco de sol e ar fresco.', icon: 'leaf', color: HABIT_COLORS[3] },
  { id: 'fruit', name: 'Comer uma fruta', description: 'Inclua uma fruta na rotina.', icon: 'apple', color: HABIT_COLORS[9] },
  { id: 'vitamins', name: 'Tomar vitaminas', description: 'Lembre-se do suplemento ou remédio do dia.', icon: 'pill', color: HABIT_COLORS[5] },
  { id: 'gratitude', name: 'Gratidão do dia', description: 'Pense em uma coisa boa que aconteceu.', icon: 'smile', color: HABIT_COLORS[2] },
  { id: 'screens', name: 'Menos tela à noite', description: 'Desligue o celular antes de dormir.', icon: 'phoneOff', color: HABIT_COLORS[10] },
  { id: 'tidy', name: 'Arrumar um cantinho', description: 'Organize um pedacinho da casa.', icon: 'home', color: HABIT_COLORS[11] },
];

export function isValidHabit(habit) {
  return isPlainObject(habit)
    && typeof habit.id === 'string'
    && habit.id.trim().length > 0
    && typeof habit.name === 'string'
    && habit.name.trim().length > 0
    && habit.name.length <= 60
    && Array.isArray(habit.days)
    && habit.days.length > 0
    && habit.days.length <= 7
    && habit.days.every((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    && new Set(habit.days).size === habit.days.length
    && Array.isArray(habit.completions)
    && habit.completions.length <= 10000
    && habit.completions.every(isDay)
    && new Set(habit.completions).size === habit.completions.length
    && (habit.status === undefined || ['active', 'paused', 'archived'].includes(habit.status))
    && optionalDates(habit, 'skipped')
    && (habit.pausedFrom === undefined || isDay(habit.pausedFrom))
    && optionalWeekdays(habit, 'pausedDays')
    && (habit.tracking === undefined || habit.tracking === 'water')
    && (habit.icon === undefined || (typeof habit.icon === 'string' && /^[A-Za-z]{2,20}$/.test(habit.icon)))
    && (habit.color === undefined || (typeof habit.color === 'string' && HEX_COLOR.test(habit.color)))
    && (habit.weeklyGoal === undefined || (Number.isInteger(habit.weeklyGoal) && habit.weeklyGoal >= 1 && habit.weeklyGoal <= 7))
    && (habit.waterGoalMl === undefined || isValidWaterGoalMl(habit.waterGoalMl))
    && (habit.remind === undefined || (typeof habit.remind === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(habit.remind)));
}

function optionalDates(habit, key) {
  return habit[key] === undefined
    || (Array.isArray(habit[key])
      && habit[key].length <= 10000
      && habit[key].every(isDay)
      && new Set(habit[key]).size === habit[key].length);
}

function optionalWeekdays(habit, key) {
  return habit[key] === undefined
    || (Array.isArray(habit[key])
      && habit[key].length > 0
      && habit[key].length <= 7
      && habit[key].every((day) => Number.isInteger(day) && day >= 0 && day <= 6)
      && new Set(habit[key]).size === habit[key].length);
}

export function habitIsSkipped(habit, day, today = day) {
  if (!isDay(day) || !isDay(today)) return false;
  return (Array.isArray(habit.skipped) && habit.skipped.includes(day))
    || (habit.status === 'paused'
      && isDay(habit.pausedFrom)
      && day >= habit.pausedFrom
      && day <= today
      && (!Array.isArray(habit.pausedDays) || habit.pausedDays.includes(pk(day).getDay())));
}

export function createSuggestedHabits(selectedIds, existingHabits, createId) {
  const selected = new Set(Array.isArray(selectedIds) ? selectedIds : []);
  const existingNames = new Set(existingHabits.map((habit) => normalizeHabitName(habit.name)));
  const existingWaterHabit = existingHabits.some(isWaterHabit);
  return SUGGESTED_HABITS
    .filter((suggestion) => selected.has(suggestion.id))
    .filter((suggestion) => (
      !existingNames.has(normalizeHabitName(suggestion.name))
      && (suggestion.id !== 'water' || !existingWaterHabit)
    ))
    .map((suggestion) => ({
      id: createId(),
      name: suggestion.name,
      days: [0, 1, 2, 3, 4, 5, 6],
      completions: [],
      status: 'active',
      ...(suggestion.id === 'water' ? { tracking: 'water' } : {}),
      icon: suggestion.icon,
      color: suggestion.color,
    }));
}

export function habitIsComplete(habit, day) {
  return habit.completions.includes(day);
}

export function normalizeHabits(value) {
  if (!Array.isArray(value)) return { records: [], rejectedCount: 1 };
  const records = [];
  const ids = new Set();
  let rejectedCount = 0;
  for (const habit of value) {
    if (!isValidHabit(habit) || ids.has(habit.id)) {
      rejectedCount++;
      continue;
    }
    ids.add(habit.id);
    const normalized = isWaterHabit(habit) ? normalizeWaterHabit(habit) : habit;
    records.push({ ...normalized, status: habit.status || 'active' });
  }
  return { records, rejectedCount };
}

export function habitWeekOverview(habits, day, weekStart, completedFor, skippedFor) {
  const days = weekDays(day, weekStart).filter((entry) => entry <= day);
  let planned = 0;
  let completed = 0;
  for (const habit of habits) {
    if ((habit.status || 'active') !== 'active') continue;
    for (const entry of days) {
      if (!habit.days.includes(pk(entry).getDay()) || skippedFor(habit, entry)) continue;
      planned += 1;
      if (completedFor(habit, entry)) completed += 1;
    }
  }
  return {
    completed,
    planned,
    paused: habits.filter((habit) => habit.status === 'paused'),
  };
}

export function habitMonthDays(month, weekStart = 1) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return [];
  const [year, monthNumber] = month.split('-').map(Number);
  const first = new Date(year, monthNumber - 1, 1);
  const offset = (first.getDay() - (weekStart === 0 ? 0 : 1) + 7) % 7;
  const length = new Date(year, monthNumber, 0).getDate();
  return [
    ...Array(offset).fill(null),
    ...Array.from({ length }, (_, index) => `${month}-${String(index + 1).padStart(2, '0')}`),
  ];
}

export function habitMonthStats(
  habit,
  month,
  today,
  isComplete = (day) => habit.completions.includes(day),
  isSkipped = (day) => habitIsSkipped(habit, day, today),
) {
  const scheduled = habitMonthDays(month).filter((day) => (
    day && day <= today && habit.days.includes(pk(day).getDay()) && !isSkipped(day)
  ));
  return {
    completed: scheduled.filter(isComplete).length,
    scheduled: scheduled.length,
  };
}

export function habitWeeklyTarget(habit) {
  return Number.isInteger(habit.weeklyGoal) && habit.weeklyGoal >= 1
    ? Math.min(habit.weeklyGoal, habit.days.length)
    : null;
}

function weeklyGoalStreak(habit, target, today, weekStart, isComplete, isSkipped) {
  let streak = 0;
  let reference = today;
  for (let index = 0; index < 520; index++) {
    const week = weekDays(reference, weekStart);
    const scheduled = week.filter((day) => day <= today
      && habit.days.includes(pk(day).getDay())
      && !isSkipped(day));
    if (!scheduled.length) {
      reference = addDays(week[0], -1);
      continue;
    }
    const done = scheduled.filter(isComplete).length;
    if (done >= target) streak++;
    else if (index > 0) break;
    reference = addDays(week[0], -1);
  }
  return streak;
}

export function habitStats(
  habit,
  today,
  weekStart = 1,
  isComplete = (day) => habit.completions.includes(day),
  isSkipped = (day) => habitIsSkipped(habit, day, today),
) {
  const week = weekDays(today, weekStart);
  const scheduled = week.filter((day) => habit.days.includes(pk(day).getDay()) && !isSkipped(day));
  const completedThisWeek = scheduled.filter(isComplete).length;
  const weeklyTarget = habitWeeklyTarget(habit);
  let cursor = isComplete(today) ? today : addDays(today, -1);
  if (isSkipped(today)) cursor = today;
  let streak = 0;
  for (let checked = 0; checked < 3660; checked++) {
    if (isSkipped(cursor)) {
      cursor = addDays(cursor, -1);
      continue;
    }
    if (habit.days.includes(pk(cursor).getDay())) {
      if (!isComplete(cursor)) break;
      streak++;
    }
    cursor = addDays(cursor, -1);
  }
  return {
    completedThisWeek,
    scheduledThisWeek: scheduled.length,
    weeklyTarget,
    goalMet: weeklyTarget !== null && completedThisWeek >= weeklyTarget,
    weeklyStreak: weeklyTarget === null ? null : weeklyGoalStreak(habit, weeklyTarget, today, weekStart, isComplete, isSkipped),
    streak,
    week: week.map((day) => ({
      day,
      completed: isComplete(day),
      scheduled: habit.days.includes(pk(day).getDay()),
      skipped: isSkipped(day),
    })),
  };
}
