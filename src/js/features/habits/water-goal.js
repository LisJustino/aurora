import { isDay, isoDay } from '../../utils/dates.js';

export function parseWaterWeightKg(value) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  const kg = Number(text.replace(',', '.'));
  if (!Number.isFinite(kg) || kg < 20 || kg > 400) return null;
  return Math.round(kg * 10) / 10;
}

export function estimateWaterGoal(profile) {
  if (!Number.isFinite(profile.weightKg) || profile.weightKg < 20 || profile.weightKg > 400) return null;

  const age = profile.age;
  const per = !age ? 35 : age <= 17 ? 40 : age <= 55 ? 35 : age <= 65 ? 30 : 25;
  const exact = Math.round(profile.weightKg * per);
  const ml = Math.min(4500, Math.max(1000, Math.round(exact / 50) * 50));
  return { per, exact, ml, kg: profile.weightKg, assumed: !age };
}

export function parseWaterMl(value) {
  const text = String(value ?? '').trim();
  if (!/^\d+$/.test(text)) return null;
  const ml = Number(text);
  return Number.isSafeInteger(ml) && ml >= 1 && ml <= 10000 ? ml : null;
}

export function waterGoalFromName(name, fallback = 2000) {
  const match = String(name ?? '').match(/(\d[\d. ]*)\s*mL\/dia/i);
  const goal = match ? Number(match[1].replace(/\D/g, '')) : fallback;
  if (Number.isInteger(goal) && goal >= 500 && goal <= 10000) return goal;
  return Number.isInteger(fallback) && fallback >= 500 && fallback <= 10000 ? fallback : 2000;
}

export function isValidWaterGoalMl(value) {
  return Number.isInteger(value) && value >= 500 && value <= 10000;
}

export function waterGoalForHabit(habit, fallback = 2000) {
  return isValidWaterGoalMl(habit?.waterGoalMl)
    ? habit.waterGoalMl
    : waterGoalFromName(habit?.name, fallback);
}

export function normalizeWaterHabit(habit) {
  const legacyGoal = String(habit.name).match(/(?:\s*[·-]\s*)?(\d[\d. ]*)\s*mL\/dia\s*$/i);
  const parsedGoal = legacyGoal
    ? Number(legacyGoal[1].replace(/\D/g, ''))
    : null;
  const normalized = {
    ...habit,
    name: legacyGoal ? habit.name.replace(legacyGoal[0], '').trim() : habit.name,
  };
  if (isValidWaterGoalMl(habit.waterGoalMl)) normalized.waterGoalMl = habit.waterGoalMl;
  else if (isValidWaterGoalMl(parsedGoal)) normalized.waterGoalMl = parsedGoal;
  else delete normalized.waterGoalMl;
  return normalized;
}

export function waterMlForDay(entries, day) {
  if (!Array.isArray(entries) || !isDay(day)) return 0;
  return entries.reduce((total, entry) => {
    if (!Number.isFinite(entry?.ml) || entry.ml <= 0
      || typeof entry.at !== 'string' || !Number.isFinite(Date.parse(entry.at))) return total;
    return isoDay(entry.at) === day ? total + Math.round(entry.ml) : total;
  }, 0);
}

export function waterGoalReached(total, target) {
  return Number.isFinite(total) && total >= 0
    && Number.isInteger(target) && target >= 500 && target <= 10000
    && total >= target;
}
