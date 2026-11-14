import { addDays, isDay, isoDay } from '../../utils/dates.js';

export function weekDays(day, weekStart = 1) {
  const current = new Date(`${day}T12:00:00`);
  const offset = (current.getDay() - (weekStart === 0 ? 0 : 1) + 7) % 7;
  const first = addDays(day, -offset);
  return Array.from({ length: 7 }, (_, index) => addDays(first, index));
}

export function tasksForWeek(tasks, days) {
  return days.map((day) => ({
    day,
    tasks: tasks
      .filter((task) => task.dueDate === day)
      .sort((a, b) => Number(a.done) - Number(b.done)
        || (a.time || '99:99').localeCompare(b.time || '99:99')
        || (a.createdAt || 0) - (b.createdAt || 0)),
  }));
}

export function weeklyReview(
  tasks,
  habits,
  today,
  weekStart = 1,
  isHabitComplete = (habit, day) => habit.completions.includes(day),
  isHabitSkipped = () => false,
  isWaterGoalReached = () => false,
) {
  const days = weekDays(today, weekStart);
  const weekStartDay = days[0];
  const weekEndDay = days[6];
  const elapsedDays = days.filter((day) => day <= today);
  const currentTasks = tasks.filter((task) => task.dueDate >= weekStartDay && task.dueDate <= weekEndDay);
  const completedTasks = tasks.filter((task) => {
    if (!task.done) return false;
    const completedOn = typeof task.doneAt === 'string' && Number.isFinite(Date.parse(task.doneAt))
      ? isoDay(task.doneAt)
      : task.dueDate;
    return isDay(completedOn) && completedOn >= weekStartDay && completedOn <= today;
  });
  const nextDays = weekDays(addDays(weekStartDay, 7), weekStart);
  const nextTasks = tasks
    .filter((task) => !task.done && task.dueDate >= nextDays[0] && task.dueDate <= nextDays[6])
    .sort((a, b) => (a.priority === 'high' ? -1 : 0) - (b.priority === 'high' ? -1 : 0)
      || a.dueDate.localeCompare(b.dueDate)
      || (a.time || '99:99').localeCompare(b.time || '99:99'));
  const activeHabits = habits.filter((habit) => (habit.status || 'active') === 'active');
  let habitScheduled = 0;
  let habitCompleted = 0;
  let habitsOnTrack = 0;
  for (const habit of activeHabits) {
    const scheduledDays = elapsedDays.filter((day) => (
      habit.days.includes(new Date(`${day}T12:00:00`).getDay())
      && !isHabitSkipped(habit, day)
    ));
    let completed = 0;
    for (const day of scheduledDays) {
      habitScheduled++;
      if (isHabitComplete(habit, day)) {
        habitCompleted++;
        completed++;
      }
    }
    const weeklyTarget = Number.isInteger(habit.weeklyGoal) && habit.weeklyGoal >= 1
      ? Math.min(habit.weeklyGoal, habit.days.length)
      : null;
    const expected = weeklyTarget === null
      ? scheduledDays.length
      : Math.min(weeklyTarget, scheduledDays.length);
    if (completed >= expected) habitsOnTrack++;
  }
  return {
    tasks: {
      completed: completedTasks.length,
      pending: currentTasks.filter((task) => !task.done).length,
      overdue: currentTasks.filter((task) => !task.done && task.dueDate < today).length,
    },
    waterDays: elapsedDays.filter(isWaterGoalReached).length,
    habits: {
      count: activeHabits.length,
      completed: habitCompleted,
      scheduled: habitScheduled,
      onTrack: habitsOnTrack,
    },
    nextWeek: { start: nextDays[0], end: nextDays[6], tasks: nextTasks },
  };
}
