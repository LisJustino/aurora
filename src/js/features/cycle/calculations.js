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

export function cycleHistory(starts, periodSet, limit = 12) {
  const sorted = [...(Array.isArray(starts) ? starts : [])].sort();
  const set = periodSet instanceof Set ? periodSet : new Set();
  return sorted.map((start, index) => {
    let periodLength = 0;
    while (set.has(addDays(start, periodLength))) periodLength += 1;
    const nextStart = sorted[index + 1] || null;
    return {
      start,
      periodLength,
      length: nextStart ? dayDiff(nextStart, start) : null,
      ongoing: !nextStart,
    };
  }).reverse().slice(0, limit);
}

export function nextPeriodRange(stats) {
  const last = stats?.starts?.[stats.starts.length - 1];
  if (!last || !stats.next || !stats.min || !stats.max) return null;
  return {
    from: addDays(last, stats.min),
    to: addDays(last, stats.max),
    single: stats.min === stats.max,
  };
}

const DELAY_LOOKBACK_DAYS = 90;

export function periodDelay(stats, asOfDate) {
  const last = stats?.starts?.[stats.starts.length - 1];
  if (!last || !stats.next || asOfDate <= stats.next) return null;
  if (stats.set.has(asOfDate) || dayDiff(asOfDate, last) > DELAY_LOOKBACK_DAYS) return null;
  const range = nextPeriodRange(stats);
  return {
    days: dayDiff(asOfDate, stats.next),
    insideRange: Boolean(range && asOfDate <= range.to),
  };
}

const PATTERN_ARRAYS = ['pain', 'mood', 'digestion', 'skin'];
const PATTERN_SINGLES = { energy: ['exhausted', 'low'], sleep: ['restless', 'insomnia'] };
const BEFORE_PERIOD_DAYS = 5;
const PATTERN_MIN_COUNT = 3;
const PATTERN_MIN_SHARE = 0.6;

export function symptomPhasePatterns(cycleLog, stats, asOfDate, getLabel) {
  const from = addDays(asOfDate, -365);
  const starts = stats?.starts || [];
  const bucketOf = (day) => {
    if (stats.set.has(day)) return 'period';
    const next = starts.find((start) => start > day);
    if (!next) return null;
    return dayDiff(next, day) <= BEFORE_PERIOD_DAYS ? 'before' : 'other';
  };
  const counts = new Map();
  const add = (day, category, value, bucket) => {
    const key = `${category}:${value}`;
    const entry = counts.get(key) || { category, value, total: 0, period: 0, before: 0, other: 0 };
    entry.total += 1;
    entry[bucket] += 1;
    counts.set(key, entry);
  };
  Object.entries(cycleLog || {}).forEach(([day, log]) => {
    if (day < from || day > asOfDate || !log) return;
    const bucket = bucketOf(day);
    if (!bucket) return;
    PATTERN_ARRAYS.forEach((category) => (log[category] || []).forEach((value) => add(day, category, value, bucket)));
    Object.entries(PATTERN_SINGLES).forEach(([category, values]) => {
      if (values.includes(log[category])) add(day, category, log[category], bucket);
    });
  });
  return [...counts.values()]
    .filter((entry) => entry.total >= PATTERN_MIN_COUNT)
    .map((entry) => {
      const bucket = entry.period >= entry.before ? 'period' : 'before';
      return { ...entry, bucket, inBucket: entry[bucket], share: entry[bucket] / entry.total };
    })
    .filter((entry) => entry.share >= PATTERN_MIN_SHARE)
    .sort((a, b) => b.total - a.total || a.value.localeCompare(b.value))
    .slice(0, 4)
    .map((entry) => ({
      category: entry.category,
      value: entry.value,
      label: getLabel(entry.category, entry.value),
      bucket: entry.bucket,
      count: entry.total,
      inBucket: entry.inBucket,
      percent: Math.round(entry.share * 100),
    }));
}
