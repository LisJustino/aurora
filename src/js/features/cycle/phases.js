import { addDays, dayDiff, isDay } from '../../utils/dates.js';

export function estimatedCyclePhase(day, starts, averageLength, periodDays = new Set()) {
  if (!isDay(day)) return '';
  if (periodDays.has(day)) return 'menstruation';
  if (!Number.isInteger(averageLength) || averageLength < 15 || averageLength > 60) return '';

  const validStarts = (Array.isArray(starts) ? starts : []).filter(isDay).sort();
  const lastStart = validStarts[validStarts.length - 1];
  if (!lastStart || day < validStarts[0]) return '';

  let cycleStart;
  if (day <= lastStart) {
    cycleStart = validStarts.filter((start) => start <= day).pop();
  } else {
    const offset = Math.floor(dayDiff(day, lastStart) / averageLength);
    if (offset > 1) return '';
    cycleStart = offset === 1 ? addDays(lastStart, averageLength) : lastStart;
  }
  if (!cycleStart) return '';
  const cycleDay = dayDiff(day, cycleStart) + 1;
  const ovulationDay = averageLength - 14;
  if (cycleDay < 1 || cycleDay >= averageLength || ovulationDay < 1) return '';
  if (cycleDay === ovulationDay) return 'ovulation';
  if (cycleDay >= Math.max(1, ovulationDay - 5) && cycleDay < ovulationDay) return 'fertile';
  return '';
}
