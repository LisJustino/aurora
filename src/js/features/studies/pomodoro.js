export const POMODOROS_PER_LONG_BREAK = 4;
export const DEFAULT_LONG_BREAK_MIN = 15;
export const LONG_BREAK_SECONDS = DEFAULT_LONG_BREAK_MIN * 60;
export const MIN_LONG_BREAK_MIN = 5;
export const MAX_LONG_BREAK_MIN = 60;
export const HISTORY_DAYS = 30;
export const POMODORO_PRESETS = Object.freeze({
  classic: Object.freeze({ focusMin: 25, breakMin: 5, longBreakMin: DEFAULT_LONG_BREAK_MIN }),
});

export function longBreakMinutes(pomodoro) {
  const value = Number(pomodoro?.longBreakMin);
  return Number.isInteger(value) && value >= MIN_LONG_BREAK_MIN && value <= MAX_LONG_BREAK_MIN
    ? value
    : DEFAULT_LONG_BREAK_MIN;
}

const localDay = (timestamp) => {
  const date = new Date(timestamp);
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const shiftDay = (day, offset) => {
  const [year, month, date] = day.split('-').map(Number);
  return localDay(new Date(year, month - 1, date + offset).getTime());
};

export function normalizePomodoroHistory(history) {
  if (!history || typeof history !== 'object' || Array.isArray(history)) return {};
  return Object.fromEntries(Object.entries(history)
    .filter(([day, count]) => /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isSafeInteger(count) && count > 0 && count < 1000)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-HISTORY_DAYS));
}

export function recentFocusDays(history, endDay, days = 7) {
  const source = normalizePomodoroHistory(history);
  return Array.from({ length: days }, (_, index) => {
    const day = shiftDay(endDay, index - (days - 1));
    return { day, count: source[day] || 0 };
  });
}

export function effectivePomodoroSettings(settings) {
  return settings.preset === 'classic'
    ? { ...settings, ...POMODORO_PRESETS.classic }
    : settings;
}

export function phaseDurationSeconds(pomodoro, phase) {
  if (phase === 'short-break') return Math.max(60, (Number(pomodoro.breakMin) || 1) * 60);
  if (phase === 'long-break') return longBreakMinutes(pomodoro) * 60;
  return Math.max(60, (Number(pomodoro.focusMin) || 1) * 60);
}

export function phaseElapsedSeconds(timer, now = Date.now()) {
  const runningSeconds = timer.startedAt === null
    ? 0
    : Math.max(0, Math.floor((now - timer.startedAt) / 1000));
  return timer.phaseElapsedSeconds + runningSeconds;
}

export function studyElapsedSeconds(timer, now = Date.now()) {
  const currentFocus = timer.phase === 'focus' ? phaseElapsedSeconds(timer, now) : 0;
  return timer.elapsedSeconds + currentFocus;
}

export function advancePomodoro(timer, pomodoro, now = Date.now()) {
  if (timer.startedAt === null) return { timer, transitions: [] };

  let phase = timer.phase;
  let elapsed = timer.elapsedSeconds;
  let completedPomodoros = timer.completedPomodoros;
  let inPhase = phaseElapsedSeconds(timer, now);
  let phaseEndsAt = timer.startedAt
    + Math.max(0, phaseDurationSeconds(pomodoro, phase) - timer.phaseElapsedSeconds) * 1000;
  let dailyCompletedPomodoros = Number.isSafeInteger(timer.dailyCompletedPomodoros)
    ? timer.dailyCompletedPomodoros
    : 0;
  let dailyCompletedOn = typeof timer.dailyCompletedOn === 'string' ? timer.dailyCompletedOn : '';
  const history = { ...normalizePomodoroHistory(timer.history) };
  const transitions = [];

  while (inPhase >= phaseDurationSeconds(pomodoro, phase)) {
    const completedPhase = phase;
    const phaseDuration = phaseDurationSeconds(pomodoro, phase);
    inPhase -= phaseDuration;
    if (phase === 'focus') {
      elapsed += phaseDurationSeconds(pomodoro, phase);
      completedPomodoros += 1;
      const completionDay = localDay(phaseEndsAt);
      dailyCompletedPomodoros = dailyCompletedOn === completionDay
        ? dailyCompletedPomodoros + 1
        : 1;
      dailyCompletedOn = completionDay;
      history[completionDay] = (history[completionDay] || 0) + 1;
      phase = completedPomodoros % POMODOROS_PER_LONG_BREAK === 0
        ? 'long-break'
        : 'short-break';
    } else {
      phase = 'focus';
    }
    transitions.push(phase);
    phaseEndsAt += phaseDurationSeconds(pomodoro, phase) * 1000;
  }

  if (!transitions.length) return { timer, transitions };
  return {
    timer: {
      ...timer,
      elapsedSeconds: elapsed,
      phase,
      phaseElapsedSeconds: 0,
      completedPomodoros,
      dailyCompletedPomodoros,
      dailyCompletedOn,
      history: normalizePomodoroHistory(history),
      startedAt: now - inPhase * 1000,
    },
    transitions,
  };
}
