import { dk } from '../../utils/dates.js';

export function habitCreatedOn(habit) {
  if (!Number.isFinite(habit?.createdAt)) return '';
  const date = new Date(habit.createdAt);
  return Number.isFinite(date.getTime()) ? dk(date) : '';
}

export function habitStartedOnOrBefore(habit, day) {
  const createdOn = habitCreatedOn(habit);
  return !createdOn || day >= createdOn;
}

export function isValidHabitCreatedAt(value) {
  return Number.isFinite(value) && Number.isFinite(new Date(value).getTime());
}
