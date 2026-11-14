const PROGRESS_RING_SELECTOR = '.home-head .ring-fg, .annual-plan-progress-ring';

export function prefersReducedMotion(userPreference = false) {
  const root = typeof document !== 'undefined' ? document.documentElement : null;
  const dataPreference = root?.dataset.motion === 'reduce'
    || (typeof root?.hasAttribute === 'function' && root.hasAttribute('data-reduce-motion')
      && !['false', '0'].includes(root.getAttribute('data-reduce-motion')));
  const systemPreference = typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return Boolean(userPreference || dataPreference || systemPreference);
}

function runMotion(element, className, onFinish = () => {}) {
  if (!element?.classList || prefersReducedMotion()) {
    onFinish();
    return false;
  }
  element.classList.remove(className);
  void element.offsetWidth;
  const finish = (event) => {
    if (event.target !== element) return;
    element.removeEventListener('animationend', finish);
    element.removeEventListener('animationcancel', finish);
    element.classList.remove(className);
    onFinish();
  };
  element.addEventListener('animationend', finish);
  element.addEventListener('animationcancel', finish);
  element.classList.add(className);
  return true;
}

function progressRingEntries(root) {
  if (!root?.querySelectorAll) return [];
  const indexes = { annual: 0, stroke: 0 };
  return [...root.querySelectorAll(PROGRESS_RING_SELECTOR)].map((element) => {
    const type = element.matches('.annual-plan-progress-ring') ? 'annual' : 'stroke';
    const key = `${type}:${indexes[type]++}`;
    const value = type === 'annual'
      ? Number.parseFloat(element.style.getPropertyValue('--annual-progress'))
      : Number(element.getAttribute('stroke-dashoffset'));
    return { element, key, type, value };
  }).filter(({ value }) => Number.isFinite(value));
}

export function captureProgressRings(root) {
  return progressRingEntries(root).map(({ key, value }) => ({ key, value }));
}

export function animateProgressRing(element, fromValue, toValue) {
  if (!element?.classList) return false;
  const annual = element.matches('.annual-plan-progress-ring');
  const from = Number(fromValue);
  const to = toValue === undefined
    ? (annual
      ? Number.parseFloat(element.style.getPropertyValue('--annual-progress'))
      : Number(element.getAttribute('stroke-dashoffset')))
    : Number(toValue);
  if (!Number.isFinite(from) || !Number.isFinite(to) || from === to) return false;
  const unit = annual ? '%' : '';
  element.style.setProperty('--motion-progress-from', `${from}${unit}`);
  element.style.setProperty('--motion-progress-to', `${to}${unit}`);
  return runMotion(element, 'is-progress-animating', () => {
    element.style.removeProperty('--motion-progress-from');
    element.style.removeProperty('--motion-progress-to');
  });
}

export function animateProgressRings(root, previousRings = []) {
  const previous = new Map(previousRings.map(({ key, value }) => [key, value]));
  progressRingEntries(root).forEach(({ element, key, value }) => {
    const from = previous.get(key);
    if (Number.isFinite(from) && from !== value) animateProgressRing(element, from, value);
  });
}

export function playMotion(element, className) {
  return runMotion(element, className);
}
