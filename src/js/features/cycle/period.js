import { addDays, dayDiff, isDay } from '../../utils/dates.js';

export const MAX_CYCLE_PERIOD_DAYS = 15;
export const MAX_CYCLE_LOG_RANGE_DAYS = 31;
const BATCH_SYMPTOM_CATEGORIES = Object.freeze(['pain', 'mood', 'digestion', 'skin']);

export function createCyclePeriod(start, end, today) {
  if (!isDay(start) || !isDay(end) || !isDay(today)
    || start > end || end > today
    || dayDiff(end, start) + 1 > MAX_CYCLE_PERIOD_DAYS) return null;

  return { start, end };
}

export function cyclePeriodDays(start, end, today) {
  if (!isDay(start) || !isDay(today) || start > today) return [];
  if (end !== null && end !== undefined && end !== '') {
    if (!isDay(end) || start > end || end > today) return [];
  }

  const lastDay = end && end <= today ? end : today;
  const count = Math.min(dayDiff(lastDay, start) + 1, MAX_CYCLE_PERIOD_DAYS);
  if (count < 1) return [];
  return Array.from({ length: count }, (_, index) => addDays(start, index));
}

export function cycleLogDays(start, end, today) {
  if (!isDay(start) || !isDay(end) || !isDay(today)
    || start > end || end > today
    || dayDiff(end, start) + 1 > MAX_CYCLE_LOG_RANGE_DAYS) return null;

  return Array.from({ length: dayDiff(end, start) + 1 }, (_, index) => addDays(start, index));
}

export function mergeCycleLogSymptoms(existing, selected) {
  const result = Object.fromEntries(Object.entries(existing || {}).map(([key, value]) => [
    key,
    Array.isArray(value) ? [...value] : value,
  ]));
  BATCH_SYMPTOM_CATEGORIES.forEach((category) => {
    const additions = Array.isArray(selected?.[category]) ? selected[category] : [];
    if (!additions.length) return;
    const current = Array.isArray(result[category]) ? result[category] : [];
    result[category] = [...new Set([...current, ...additions])];
  });
  return result;
}
