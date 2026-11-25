// Andamento das conquistas do plano anual: responde, a qualquer momento, "estou
// cumprindo o que prometi?" e, no fim do ano, "cumpri?".
//
// Uma conquista pode ser acompanhada de três formas:
//  - manual (sem `track`): você marca como concluída;
//  - hábito (`track.kind === 'habit'`): a porcentagem de dias cumpridos no ano;
//  - contagem (`track.kind === 'count'`): quantas vezes já fez, até uma meta.
import { dayDiff } from '../../utils/dates.js';
import { habitExpectedDays } from '../habits/insights.js';

export const HABIT_TARGETS = Object.freeze([100, 80, 60]);
export const DEFAULT_HABIT_TARGET = 80;
export const MAX_COUNT_TARGET = 100000;
const PACE_TOLERANCE = 0.9;

export const isValidGoalTrack = (track) => {
  if (track === undefined) return true;
  if (!track || typeof track !== 'object' || Array.isArray(track)) return false;
  if (track.kind === 'habit') {
    return (
      typeof track.habitId === 'string' &&
      track.habitId.length > 0 &&
      track.habitId.length <= 200 &&
      HABIT_TARGETS.includes(track.targetPct)
    );
  }
  if (track.kind === 'count') {
    return (
      Number.isInteger(track.target) &&
      track.target >= 1 &&
      track.target <= MAX_COUNT_TARGET &&
      Number.isInteger(track.current) &&
      track.current >= 0 &&
      track.current <= MAX_COUNT_TARGET * 10
    );
  }
  return false;
};

const pct = (value) => Math.round(value * 100);

// Retorna { kind, status, pct, detail }.
// status: 'done' | 'on-track' | 'behind' | 'missed' | 'open'
export function goalProgress(goal, { today, year, habits = [] }) {
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const ended = today > yearEnd;
  const notStarted = today < yearStart;
  const track = goal.track;
  const kind = track?.kind || 'manual';

  if (kind === 'habit') {
    const habit = habits.find((item) => item.id === track.habitId);
    if (!habit) {
      return {
        kind,
        status: goal.done ? 'done' : ended ? 'missed' : 'open',
        pct: null,
        detail: 'O hábito acompanhado não existe mais.',
      };
    }
    const to = today < yearEnd ? today : yearEnd;
    const done = new Set(habit.completions);
    const days = notStarted
      ? []
      : habitExpectedDays(habit, yearStart, to).filter((day) => day !== today || done.has(day));
    const completed = days.filter((day) => done.has(day)).length;
    const rate = days.length ? completed / days.length : null;
    const detail =
      rate === null
        ? `Ainda sem dias para contar · meta ${track.targetPct}%`
        : `${completed} de ${days.length} dias (${pct(rate)}%) · meta ${track.targetPct}%`;
    const met = rate !== null && pct(rate) >= track.targetPct;
    let status;
    if (goal.done) status = 'done';
    else if (rate === null) status = ended ? 'missed' : 'open';
    else if (ended) status = met ? 'done' : 'missed';
    else status = met ? 'on-track' : 'behind';
    return { kind, status, pct: rate === null ? null : pct(rate), detail };
  }

  if (kind === 'count') {
    const { current, target } = track;
    const share = Math.min(1, current / target);
    const detail = `${current} de ${target}`;
    let status;
    if (goal.done || current >= target) status = 'done';
    else if (ended) status = 'missed';
    else if (notStarted) status = 'open';
    else {
      const elapsed = Math.min(1, (dayDiff(today, yearStart) + 1) / 365);
      status = share >= elapsed * PACE_TOLERANCE ? 'on-track' : 'behind';
    }
    return { kind, status, pct: pct(share), detail };
  }

  return {
    kind,
    status: goal.done ? 'done' : ended ? 'missed' : 'open',
    pct: null,
    detail: goal.done ? 'Concluída' : ended ? 'Não foi concluída neste ano.' : 'Marque quando cumprir.',
  };
}

export function yearBalance(goals, context) {
  const counts = { done: 0, 'on-track': 0, behind: 0, missed: 0, open: 0 };
  const items = (Array.isArray(goals) ? goals : []).map((goal) => {
    const progress = goalProgress(goal, context);
    counts[progress.status]++;
    return { goal, progress };
  });
  const total = items.length;
  const ended = context.today > `${context.year}-12-31`;
  return { total, counts, items, ended, kept: counts.done };
}
