import { isDay } from "../../utils/dates.js";

const MAX_TASK_REMINDERS = 100;
const VALID_TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export function buildTaskPushReminders(tasks, now = Date.now()) {
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
    .slice(0, MAX_TASK_REMINDERS);
}
