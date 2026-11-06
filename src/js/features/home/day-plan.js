import { isDay } from '../../utils/dates.js';

export const ENERGY_OPTIONS = Object.freeze([
  Object.freeze({ id: 'low', label: 'Baixa' }),
  Object.freeze({ id: 'medium', label: 'Média' }),
  Object.freeze({ id: 'high', label: 'Alta' }),
]);

export const TIME_OPTIONS = Object.freeze([
  Object.freeze({ id: '30m', label: '30 min' }),
  Object.freeze({ id: '2h', label: '2 h' }),
  Object.freeze({ id: 'day', label: 'Dia todo' }),
  Object.freeze({ id: 'unknown', label: 'Não sei' }),
]);

export const ENERGY_LIMITS = Object.freeze({ low: 3, medium: 5, high: 7 });
export const MAX_DEFERRED_TASKS = 200;

const ENERGY_IDS = ENERGY_OPTIONS.map(({ id }) => id);
const TIME_IDS = TIME_OPTIONS.map(({ id }) => id);
const PRIORITY_RANK = { high: 0, normal: 1, low: 2 };

export function normalizeCheckin(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !isDay(value.date)) return null;
  const deferred = Array.isArray(value.deferred)
    ? [...new Set(value.deferred.filter((id) => typeof id === 'string' && id && id.length <= 80))].slice(0, MAX_DEFERRED_TASKS)
    : [];
  return {
    date: value.date,
    energy: ENERGY_IDS.includes(value.energy) ? value.energy : null,
    time: TIME_IDS.includes(value.time) ? value.time : null,
    dismissed: value.dismissed === true,
    deferred,
    ...(value.sample ? { sample: true } : {}),
  };
}

export function isValidCheckin(value) {
  const normalized = normalizeCheckin(value);
  return Boolean(normalized)
    && (value.energy == null || ENERGY_IDS.includes(value.energy))
    && (value.time == null || TIME_IDS.includes(value.time))
    && (value.deferred == null || Array.isArray(value.deferred));
}

export function checkinFor(checkins, day) {
  return (checkins || []).find((entry) => entry.date === day) || null;
}

export function upsertCheckin(checkins, day, changes) {
  const current = checkinFor(checkins, day)
    || { date: day, energy: null, time: null, dismissed: false, deferred: [] };
  const next = normalizeCheckin({ ...current, ...changes, date: day });
  return [...(checkins || []).filter((entry) => entry.date !== day), next]
    .sort((a, b) => a.date.localeCompare(b.date));
}

const timeKey = (task) => task.time || '99:99';
const priorityKey = (task) => PRIORITY_RANK[task.priority] ?? PRIORITY_RANK.normal;

function groupOf(task, day) {
  if (!task.dueDate) return 2;
  if (task.dueDate === day) return 0;
  return task.dueDate < day ? 1 : null;
}

function compareTasks(day) {
  return (left, right) => {
    const groupDiff = groupOf(left.task, day) - groupOf(right.task, day);
    if (groupDiff) return groupDiff;
    if (groupOf(left.task, day) === 0) {
      const timeDiff = timeKey(left.task).localeCompare(timeKey(right.task));
      if (timeDiff) return timeDiff;
    }
    if (groupOf(left.task, day) === 1) {
      const dateDiff = right.task.dueDate.localeCompare(left.task.dueDate);
      if (dateDiff) return dateDiff;
    }
    return priorityKey(left.task) - priorityKey(right.task) || left.index - right.index;
  };
}

export function dayLimit(checkin) {
  return ENERGY_LIMITS[checkin?.energy] ?? ENERGY_LIMITS.medium;
}

/*
 * Dia possível: ordem prazo hoje > prazo anterior > sem data, limitada pela energia.
 * `adiadas` reúne o excedente e o que a pessoa já mandou para "Fica para depois".
 */
export function buildDayPlan(tasks, checkin, day) {
  const deferredIds = new Set(checkin?.deferred || []);
  const ranked = (tasks || [])
    .map((task, index) => ({ task, index }))
    .filter(({ task }) => task && !task.done && groupOf(task, day) !== null)
    .sort(compareTasks(day))
    .map(({ task }) => task);
  const open = ranked.filter((task) => !deferredIds.has(task.id));
  const limit = dayLimit(checkin);
  return {
    limit,
    sugeridas: open.slice(0, limit),
    adiadas: [...open.slice(limit), ...ranked.filter((task) => deferredIds.has(task.id))],
  };
}

export function reduceDay(checkin, plan) {
  return [...new Set([...(checkin?.deferred || []), ...plan.adiadas.map((task) => task.id)])]
    .slice(0, MAX_DEFERRED_TASKS);
}
