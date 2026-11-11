import { isPlainObject } from '../../core/data-integrity.js';

const MAX_GOALS_PER_PLAN = 100;
const MAX_INTENTION_LENGTH = 300;
const MAX_GOAL_TITLE_LENGTH = 120;
const MAX_GOAL_ACTION_LENGTH = 280;
const QUARTERS = new Set(['', 'q1', 'q2', 'q3', 'q4']);

const isAnnualYear = (year) => /^\d{4}$/.test(year) && Number(year) >= 1900;
const isAnnualGoal = (goal) => isPlainObject(goal)
  && typeof goal.id === 'string'
  && Boolean(goal.id.trim())
  && goal.id.length <= 200
  && typeof goal.title === 'string'
  && Boolean(goal.title.trim())
  && goal.title.length <= MAX_GOAL_TITLE_LENGTH
  && typeof goal.action === 'string'
  && goal.action.length <= MAX_GOAL_ACTION_LENGTH
  && QUARTERS.has(goal.quarter)
  && typeof goal.done === 'boolean';

export function isValidAnnualPlans(value) {
  if (!isPlainObject(value)) return false;
  const entries = Object.entries(value);
  const idsByYear = new Set();
  return entries.every(([year, plan]) => {
    if (!isAnnualYear(year)
      || !isPlainObject(plan)
      || typeof plan.intention !== 'string'
      || plan.intention.length > MAX_INTENTION_LENGTH
      || !Array.isArray(plan.goals)
      || plan.goals.length > MAX_GOALS_PER_PLAN
      || !plan.goals.every(isAnnualGoal)) return false;
    const ids = plan.goals.map((goal) => goal.id);
    if (new Set(ids).size !== ids.length || ids.some((id) => idsByYear.has(`${year}:${id}`))) return false;
    ids.forEach((id) => idsByYear.add(`${year}:${id}`));
    return true;
  });
}

export function normalizeAnnualPlans(value) {
  if (!isPlainObject(value)) return {};
  return Object.fromEntries(Object.entries(value)
    .filter(([year, plan]) => isAnnualYear(year)
      && isPlainObject(plan)
      && typeof plan.intention === 'string'
      && plan.intention.length <= MAX_INTENTION_LENGTH
      && Array.isArray(plan.goals)
      && plan.goals.length <= MAX_GOALS_PER_PLAN)
    .map(([year, plan]) => [year, {
      ...plan,
      goals: plan.goals.filter(isAnnualGoal).map((goal) => ({ ...goal })),
    }]));
}

export const ANNUAL_PLAN_LIMITS = Object.freeze({
  intention: MAX_INTENTION_LENGTH,
  goalTitle: MAX_GOAL_TITLE_LENGTH,
  goalAction: MAX_GOAL_ACTION_LENGTH,
  goals: MAX_GOALS_PER_PLAN,
});
