export function estimateWaterGoal(profile) {
  if (!profile.weightKg) return null;

  const age = profile.age;
  const per = !age ? 35 : age <= 17 ? 40 : age <= 55 ? 35 : age <= 65 ? 30 : 25;
  const exact = Math.round(profile.weightKg * per);
  const ml = Math.min(4500, Math.max(1000, Math.round(exact / 50) * 50));
  return { per, exact, ml, kg: profile.weightKg, assumed: !age };
}
