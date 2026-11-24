export function weightChange(entries, day, currentKg) {
  if (!Array.isArray(entries) || !/^\d{4}-\d{2}-\d{2}$/.test(day)
    || !Number.isFinite(currentKg) || currentKg < 20 || currentKg > 400) {
    return null;
  }
  const previous = entries
    .filter((entry) => entry?.date < day
      && Number.isFinite(entry?.kg)
      && entry.kg >= 20
      && entry.kg <= 400)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  if (!previous) return null;
  const difference = Math.round((currentKg - previous.kg) * 10) / 10;
  if (difference > 0) return { direction: 'gain', difference };
  if (difference < 0) return { direction: 'loss', difference: Math.abs(difference) };
  return { direction: 'same', difference: 0 };
}
