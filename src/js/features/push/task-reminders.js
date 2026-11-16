import { isDay } from "../../utils/dates.js";

export const MAX_TASK_REMINDERS = 100;
const VALID_TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export function buildTaskPushReminders(tasks, now = Date.now(), limit = MAX_TASK_REMINDERS) {
  return (Array.isArray(tasks) ? tasks : [])
    .flatMap((task, index) => {
      if (
        !task ||
        task.done ||
        !isDay(task.dueDate) ||
        !VALID_TIME.test(task.time || "") ||
        !Number.isSafeInteger(task.remind) ||
        task.remind < 0 ||
        task.remind > 1440
      )
        return [];
      const at =
        new Date(`${task.dueDate}T${task.time}:00`).getTime() -
        task.remind * 60_000;
      return Number.isSafeInteger(at) && at > now
        ? [{ id: `task-${index}`, at }]
        : [];
    })
    .sort((left, right) => left.at - right.at)
    .slice(0, Math.min(MAX_TASK_REMINDERS, Math.max(0, limit)));
}

export function buildWeeklyReviewPushReminder(
  enabled,
  now = Date.now(),
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
) {
  if (!enabled) return [];
  if (!Number.isSafeInteger(now) || typeof timeZone !== 'string' || !timeZone) {
    throw new TypeError('Invalid weekly review reminder schedule.');
  }
  new Intl.DateTimeFormat('en', { timeZone }).format(new Date(now));
  const at = new Date(now);
  at.setHours(18, 0, 0, 0);
  at.setDate(at.getDate() + ((7 - at.getDay()) % 7));
  if (at.getTime() <= now) at.setDate(at.getDate() + 7);
  return [{
    id: 'weekly-review',
    at: at.getTime(),
    repeat: 'weekly',
    time: '18:00',
    timeZone,
  }];
}
