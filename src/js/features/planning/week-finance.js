// Gastos da semana para a revisão semanal: soma as saídas dos dias já passados
// da semana atual e compara com a semana anterior no mesmo trecho.
import { addDays, dayDiff } from '../../utils/dates.js';

// tx: lançamentos; weekStartKey: primeiro dia da semana atual; today: hoje.
// countable(tx) decide se a saída entra (ex.: ignora cartão de crédito e transferências).
export function weekSpending(tx, weekStartKey, today, countable = () => true) {
  const elapsed = Math.max(0, dayDiff(today, weekStartKey)) + 1; // dias decorridos, contando hoje
  const prevStart = addDays(weekStartKey, -7);
  const prevEnd = addDays(prevStart, elapsed - 1);
  let current = 0;
  let previous = 0;
  for (const item of Array.isArray(tx) ? tx : []) {
    if (item?.type !== 'out' || !Number.isFinite(item.cents) || !countable(item)) continue;
    if (item.date >= weekStartKey && item.date <= today) current += item.cents;
    else if (item.date >= prevStart && item.date <= prevEnd) previous += item.cents;
  }
  return { current, previous, diff: current - previous, hasPrevious: previous > 0 };
}

// Limites do mês para a revisão semanal: soma o gasto só nas categorias que têm limite
// e lista as que já passaram dele. month: 'AAAA-MM'. budgets: { categoria: { cents } }.
export function monthBudgetProgress(tx, budgets, month, countable = () => true) {
  const entries = Object.entries(budgets && typeof budgets === 'object' ? budgets : {})
    .filter(([, budget]) => Number.isFinite(budget?.cents) && budget.cents > 0);
  if (!entries.length) return null;
  const spentBy = new Map();
  for (const item of Array.isArray(tx) ? tx : []) {
    if (item?.type !== 'out' || !Number.isFinite(item.cents) || !countable(item)) continue;
    if (typeof item.date !== 'string' || !item.date.startsWith(month)) continue;
    spentBy.set(item.category, (spentBy.get(item.category) || 0) + item.cents);
  }
  let limit = 0;
  let spent = 0;
  const over = [];
  for (const [category, budget] of entries) {
    const used = spentBy.get(category) || 0;
    limit += budget.cents;
    spent += used;
    if (used > budget.cents) over.push(category);
  }
  return { limit, spent, over, categories: entries.length };
}
