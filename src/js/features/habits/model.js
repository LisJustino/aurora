import { HABIT_COLORS, SUGGESTED_HABITS } from './catalog.js';
export { HABIT_COLORS, SUGGESTED_HABITS } from './catalog.js';
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
  ['acne', 'Pele'], ['flower', 'Skincare'], ['hair', 'Cabelo'], ['shield', 'Proteção'],
  ['wind', 'Respiração'], ['egg', 'Nutrição'], ['utensils', 'Cozinhar'], ['blood', 'Ciclo'],
  ['spine', 'Postura'], ['stomach', 'Digestão'], ['calendarCheck', 'Rotina'], ['clock', 'Horário'],
  ['folder', 'Organização'], ['pie', 'Equilíbrio'], ['check', 'Concluir'], ['water', 'Hidratação'],
  ['candy', 'Lazer'], ['scale', 'Acompanhamento'], ['flag', 'Meta'], ['grid', 'Organizar'],
]);
export const HABIT_ICON_KEYS = Object.freeze(HABIT_ICONS.map(([key]) => key));
export const DEFAULT_HABIT_ICON = 'sparkles';
export const DEFAULT_HABIT_COLOR = HABIT_COLORS[0];

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const normalizeHabitText = (value) => String(value ?? '')
  .trim()
  .toLocaleLowerCase('pt-BR')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '');
export const isWaterHabit = (habit) => (
  habit?.tracking === 'water' || /^beber agua(?:\s|$)/.test(normalizeHabitText(habit?.name))
);
export const habitIconKey = (habit) => (
  HABIT_ICON_KEYS.includes(habit?.icon) ? habit.icon : DEFAULT_HABIT_ICON
);
export const habitColor = (habit) => (
  HEX_COLOR.test(habit?.color || '') ? habit.color : DEFAULT_HABIT_COLOR
);

export const SUGGESTED_HABIT_CATEGORIES = Object.freeze([
  { id: 'personal-care', title: 'Cuidados pessoais' },
  { id: 'movement', title: 'Corpo e movimento' },
  { id: 'mind', title: 'Cuidados com a mente' },
  { id: 'food', title: 'Alimentação' },
  { id: 'routine', title: 'Rotina e casa' },
]);

export const SUGGESTED_HABIT_TAGS = Object.freeze([
  { id: 'quick', title: 'Poucos minutos' },
  { id: 'home', title: 'Em casa' },
  { id: 'no-equipment', title: 'Sem equipamento' },
  { id: 'outdoor', title: 'Ao ar livre' },
  { id: 'equipment', title: 'Com equipamento' },
]);

const SUGGESTED_HABIT_TAGGED_IDS = Object.freeze({
  quick: Object.freeze([
    'stretch', 'reading', 'meditate', 'journal', 'gratitude', 'pause', 'fruit',
    'active-break', 'mobility', 'check-in-with-yourself', 'prepare-snack',
    'make-bed', 'five-minute-tidy', 'make-grocery-list', 'clear-desk',
    'set-out-clothes', 'keys-in-place',
    'wash-face', 'use-floss', 'care-for-hands', 'apply-lip-balm',
    'pause-for-eye-rest', 'walk-10-minutes', 'stretch-neck-shoulders',
    'mindful-minute', 'brain-dump', 'name-your-feelings', 'try-new-food',
    'review-weekly-priorities', 'check-daily-budget', 'open-curtains',
    'plan-snacks', 'pack-a-lunch', 'sunscreen', 'connect', 'walk-with-dog',
    'learn-language', 'practice-instrument',
  ]),
  home: Object.freeze([
    'water', 'skincare', 'hair-care', 'personal-hygiene', 'sleep', 'medication',
    'reading', 'meditate', 'journal', 'gratitude', 'screens', 'pause', 'fruit',
    'cook', 'meal-plan', 'tidy', 'morning-plan', 'evening-routine', 'dental-care',
    'creative-time', 'mindful-meal', 'prepare-snack', 'make-bed', 'review-calendar',
    'organize-bag', 'care-for-plant', 'five-minute-tidy', 'prepare-for-bed',
    'check-in-with-yourself', 'plan-rest', 'study', 'weekly-reflection',
    'screen-free-break', 'try-new-recipe', 'prepare-breakfast', 'add-vegetable',
    'make-grocery-list', 'clear-desk', 'wash-dishes', 'set-out-clothes',
    'keys-in-place', 'organize-digital-files', 'weekly-reset',
    'wash-face', 'use-floss', 'moisturize-skin', 'care-for-hands',
    'apply-lip-balm', 'pause-for-eye-rest', 'check-posture', 'yoga-at-home',
    'bodyweight-strength', 'stretch-neck-shoulders', 'practice-balance',
    'brain-dump', 'focus-single-task', 'mindful-minute', 'screen-free-morning',
    'learn-something-new', 'creative-writing', 'listen-to-music',
    'name-your-feelings', 'quiet-time', 'prepare-lunch', 'include-vegetable',
    'try-new-food', 'sit-down-to-eat', 'prep-ingredients', 'make-a-simple-meal',
    'sort-laundry', 'reset-kitchen', 'review-weekly-priorities',
    'check-daily-budget', 'charge-phone-away', 'clear-inbox',
    'evening-room-reset', 'take-out-trash', 'prepare-workspace',
    'open-curtains', 'plan-snacks', 'pack-a-lunch', 'connect', 'learn-language',
    'practice-instrument',
  ]),
  'no-equipment': Object.freeze([
    'training', 'stretch', 'walk', 'dance', 'active-break', 'mobility',
    'take-stairs', 'play-outside',
    'walk-10-minutes', 'yoga-at-home', 'bodyweight-strength',
    'stretch-neck-shoulders', 'move-after-meal', 'practice-balance',
  ]),
  outdoor: Object.freeze([
    'cycle', 'walk-with-dog', 'play-a-sport', 'outdoor-movement',
  ]),
  equipment: Object.freeze([
    'gym', 'cycle', 'play-a-sport', 'practice-instrument',
  ]),
});

export function habitSuggestionTags(suggestion) {
  return SUGGESTED_HABIT_TAGS.filter(({ id }) => (
    SUGGESTED_HABIT_TAGGED_IDS[id].includes(suggestion?.id)
  ));
}

export function featuredHabitSuggestions(suggestions, limit = 4) {
  const available = Array.isArray(suggestions) ? suggestions : [];
  const count = Number.isInteger(limit) ? Math.max(0, limit) : 4;
  const selected = [];
  const add = (suggestion) => {
    if (suggestion && selected.length < count && !selected.some(({ id }) => id === suggestion.id)) selected.push(suggestion);
  };
  for (const id of ['water', 'stretch', 'reading', 'fruit']) {
    add(available.find((suggestion) => suggestion.id === id));
  }
  for (const category of SUGGESTED_HABIT_CATEGORIES) {
    if (selected.length >= count) break;
    if (selected.some((suggestion) => suggestion.category === category.id)) continue;
    add(available.find((suggestion) => suggestion.category === category.id));
  }
  for (const suggestion of available) add(suggestion);
  return selected;
}


export function remainingHabitSuggestions(habits, suggestions = SUGGESTED_HABITS) {
  const existingHabits = Array.isArray(habits) ? habits : [];
  const availableSuggestions = Array.isArray(suggestions) ? suggestions : [];
  const existingNames = new Set(existingHabits.map((habit) => normalizeHabitText(habit?.name)));
  const hasWaterHabit = existingHabits.some(isWaterHabit);
  return availableSuggestions.filter((suggestion) => (
    !existingNames.has(normalizeHabitText(suggestion.name))
    && !(suggestion.id === 'water' && hasWaterHabit)
  ));
}

export function filterSuggestedHabits(suggestions, category = 'all', tag = 'all', query = '') {
  const search = normalizeHabitText(query);
  return (Array.isArray(suggestions) ? suggestions : []).filter((suggestion) => {
    if (category !== 'all' && suggestion.category !== category) return false;
    const tags = habitSuggestionTags(suggestion);
    if (tag !== 'all' && !tags.some((item) => item.id === tag)) return false;
    if (search && !normalizeHabitText(`${suggestion.name} ${suggestion.description}`).includes(search)) return false;
    return true;
  });
}

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

export function habitDayOverview(
  habits,
  day,
  completedFor = (habit, targetDay) => habitIsComplete(habit, targetDay),
  skippedFor = (habit, targetDay) => habitIsSkipped(habit, targetDay, day),
) {
  if (!isDay(day)) return { scheduled: [], completed: 0, planned: 0, skipped: 0 };
  const scheduled = (Array.isArray(habits) ? habits : []).filter((habit) => (
    (habit.status || 'active') === 'active'
    && habit.days.includes(pk(day).getDay())
  ));
  const skipped = scheduled.filter((habit) => skippedFor(habit, day));
  const skippedHabits = new Set(skipped);
  const eligible = scheduled.filter((habit) => !skippedHabits.has(habit));
  return {
    scheduled,
    completed: eligible.filter((habit) => completedFor(habit, day)).length,
    planned: eligible.length,
    skipped: skipped.length,
  };
}

export function createSuggestedHabits(selectedIds, existingHabits, createId) {
  const selected = new Set(Array.isArray(selectedIds) ? selectedIds : []);
  const existingNames = new Set(existingHabits.map((habit) => normalizeHabitText(habit.name)));
  const existingWaterHabit = existingHabits.some(isWaterHabit);
  return SUGGESTED_HABITS
    .filter((suggestion) => selected.has(suggestion.id))
    .filter((suggestion) => (
      !existingNames.has(normalizeHabitText(suggestion.name))
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

export function habitWeekDailyProgress(habits, day, weekStart, completedFor, skippedFor) {
  return weekDays(day, weekStart).map((entry) => {
    const overview = habitDayOverview(
      habits,
      entry,
      completedFor,
      (habit, targetDay) => skippedFor
        ? skippedFor(habit, targetDay)
        : habitIsSkipped(habit, targetDay, entry),
    );
    const completed = entry <= day ? overview.completed : 0;
    const progress = entry <= day && overview.planned
      ? completed / overview.planned
      : 0;
    return {
      day: entry,
      completed,
      planned: overview.planned,
      skipped: overview.skipped,
      progress,
      complete: overview.planned > 0 && progress === 1,
    };
  });
}

export function habitWeekReview(habits, day, weekStart, completedFor, skippedFor) {
  const days = weekDays(day, weekStart).filter((entry) => entry <= day);
  return habits
    .filter((habit) => (habit.status || 'active') === 'active')
    .map((habit) => {
      const scheduled = days.filter((entry) => (
        habit.days.includes(pk(entry).getDay()) && !skippedFor(habit, entry)
      ));
      const weeklyTarget = habitWeeklyTarget(habit);
      const completed = scheduled.filter((entry) => completedFor(habit, entry)).length;
      return {
        habit,
        completed,
        planned: scheduled.length,
        weeklyTarget,
        goalMet: weeklyTarget !== null && completed >= weeklyTarget,
      };
    });
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
