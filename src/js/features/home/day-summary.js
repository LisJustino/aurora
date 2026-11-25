import { habitStartedOnOrBefore } from '../habits/dates.js';

export function createHomeDaySummary({
  todayTasks = [],
  overdueTasks = [],
  dueTodayTasks = [],
  calendarEvents = [],
  habits = null,
  water = null,
  balance = null,
  cycle = null,
} = {}) {
  const taskList = Array.isArray(todayTasks) ? todayTasks : [];
  const overdueList = Array.isArray(overdueTasks) ? overdueTasks : [];
  const dueTodayList = Array.isArray(dueTodayTasks) ? dueTodayTasks : [];
  const eventList = Array.isArray(calendarEvents) ? calendarEvents : [];

  return {
    tasks: {
      done: taskList.filter((task) => task.done).length,
      total: taskList.length,
      next: overdueList[0] || dueTodayList[0] || null,
    },
    calendarEvents: {
      done: eventList.filter((event) => event.done).length,
      total: eventList.length,
      pending: eventList.filter((event) => !event.done).length,
    },
    habits: habits
      ? {
          done: habits.completed,
          total: habits.planned,
          remaining: Math.max(0, habits.planned - habits.completed),
        }
      : null,
    water: water
      ? {
          ...water,
          percent: Math.min(100, Math.round((water.total / water.goal) * 100)),
        }
      : null,
    balance,
    cycle,
  };
}

export function homeBadgeCount({
  tasks = [],
  habits = [],
  day,
  weekday,
  habitsEnabled = true,
  isComplete = () => false,
  isSkipped = () => false,
} = {}) {
  const taskList = Array.isArray(tasks) ? tasks : [];
  const habitList = Array.isArray(habits) ? habits : [];
  const overdueTasks = taskList.filter(
    (task) => !task.done && typeof task.dueDate === 'string' && task.dueDate < day,
  ).length;
  const todayHabits = habitsEnabled
    ? habitList.filter(
        (habit) =>
          (habit.status || 'active') === 'active' &&
          Array.isArray(habit.days) &&
          habit.days.includes(weekday) &&
          habitStartedOnOrBefore(habit, day) &&
          !isComplete(habit, day) &&
          !isSkipped(habit, day),
      ).length
    : 0;
  return overdueTasks + todayHabits;
}
