import { dk, pk } from '../../utils/dates.js';

export function nextDue(date, repeat) {
  const nextDate = pk(date);
  if (repeat === 'day') nextDate.setDate(nextDate.getDate() + 1);
  else if (repeat === 'weekday') {
    do {
      nextDate.setDate(nextDate.getDate() + 1);
    } while (nextDate.getDay() === 0 || nextDate.getDay() === 6);
  } else if (repeat === 'week') {
    nextDate.setDate(nextDate.getDate() + 7);
  } else if (repeat === 'month' || repeat === 'year') {
    const day = nextDate.getDate();
    nextDate.setDate(1);
    nextDate.setMonth(nextDate.getMonth() + (repeat === 'month' ? 1 : 12));
    nextDate.setDate(Math.min(
      day,
      new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate(),
    ));
  }
  return dk(nextDate);
}
