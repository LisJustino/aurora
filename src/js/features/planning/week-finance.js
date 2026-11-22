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
