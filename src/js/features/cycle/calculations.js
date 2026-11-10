import { addDays, dayDiff } from '../../utils/dates.js';
import { cyclePeriodDays } from './period.js';

const RECENT_INTERVAL_LIMIT = 6;

export function periodDaySet(cycleLog, periods, asOfDate) {
  const days = new Set();
  Object.entries(cycleLog || {}).forEach(([day, log]) => {
    if (['light', 'medium', 'heavy'].includes(log?.flow)) days.add(day);
  });
  (Array.isArray(periods) ? periods : []).forEach((period) => {
    cyclePeriodDays(period.start, period.end, asOfDate).forEach((day) => days.add(day));
  });
  return days;
}

export function cycleStats(cycleLog, periods, asOfDate) {
  const set = periodDaySet(cycleLog, periods, asOfDate);
  const days = [...set].sort();
  const starts = days.filter((day) => !set.has(addDays(day, -1)));
  const intervals = [];
  for (let index = 1; index < starts.length; index += 1) {
    intervals.push(dayDiff(starts[index], starts[index - 1]));
  }

  const recentWindow = intervals.slice(-RECENT_INTERVAL_LIMIT);
  const recentIntervals = recentWindow.filter((length) => length >= 15 && length <= 60);
  const avg = recentIntervals.length
    ? Math.round(recentIntervals.reduce((sum, length) => sum + length, 0) / recentIntervals.length)
    : null;
  const min = recentIntervals.length ? Math.min(...recentIntervals) : null;
  const max = recentIntervals.length ? Math.max(...recentIntervals) : null;
  const variation = min === null ? null : max - min;
  const hasOutOfRangeRecentInterval = recentWindow.some((length) => length < 15 || length > 60);

  return {
    set,
    starts,
    avg,
    min,
    max,
    variation,
    hasOutOfRangeRecentInterval,
    canEstimateFertility: !hasOutOfRangeRecentInterval && variation !== null && variation < 8,
    observedIntervals: recentIntervals.length,
    next: avg && starts.length ? addDays(starts[starts.length - 1], avg) : null,
  };
}

export function cycleDayNumber(day, starts) {
  const previousStart = (Array.isArray(starts) ? starts : []).filter((start) => start <= day).pop();
  return previousStart ? dayDiff(day, previousStart) + 1 : null;
}

export function topSymptoms(cycleLog, asOfDate, getLabel) {
  const from = addDays(asOfDate, -90);
  const counts = {};
  Object.entries(cycleLog || {}).forEach(([day, log]) => {
    if (day < from) return;
    const entry = log || {};
    ['pain', 'mood', 'digestion', 'skin'].forEach((category) => {
      (entry[category] || []).forEach((value) => {
        const key = `${category}:${value}`;
        counts[key] = (counts[key] || 0) + 1;
      });
    });
    ['energy', 'sleep'].forEach((category) => {
      if (!entry[category]) return;
      const key = `${category}:${entry[category]}`;
      counts[key] = (counts[key] || 0) + 1;
    });
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([key, count]) => {
    const [category, value] = key.split(':');
    return { category, value, label: getLabel(category, value), count };
  });
}
