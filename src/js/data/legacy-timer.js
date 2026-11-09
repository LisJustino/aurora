const HISTORY_DAYS = 30;

export function normalizeLegacyTimerHistory(history) {
  if (!history || typeof history !== 'object' || Array.isArray(history)) return {};
  return Object.fromEntries(Object.entries(history)
    .filter(([day, count]) => /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isSafeInteger(count) && count > 0 && count < 1000)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-HISTORY_DAYS));
}
