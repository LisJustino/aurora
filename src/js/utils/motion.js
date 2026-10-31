export function prefersReducedMotion(userPreference = false) {
  const systemPreference = typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return Boolean(userPreference || systemPreference);
}
