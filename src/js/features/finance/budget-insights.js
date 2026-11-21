import { byCategory, monthStats } from './calculations.js';

export const BUDGET_ALERT_DEFAULT = 80;
export const BUDGET_ALERT_OPTIONS = Object.freeze([50, 60, 70, 80, 90, 100]);
const MAX_BUDGET_SETTINGS = 200;
const MAX_CATEGORY_LENGTH = 60;
const pad = (value) => String(value).padStart(2, '0');
const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

function setOwn(target, key, value) {
  Object.defineProperty(target, key, { value, enumerable: true, writable: true, configurable: true });
}

export function normalizeBudgetSettings(value) {
  if (!isPlainObject(value)) return {};
  const settings = {};
  Object.entries(value).slice(0, MAX_BUDGET_SETTINGS).forEach(([category, raw]) => {
    if (!category || category.length > MAX_CATEGORY_LENGTH || !isPlainObject(raw)) return;
    const alertPct = Number.isInteger(raw.alertPct) && BUDGET_ALERT_OPTIONS.includes(raw.alertPct)
      ? raw.alertPct
      : BUDGET_ALERT_DEFAULT;
    const pinned = raw.pinned === true;
    if (alertPct === BUDGET_ALERT_DEFAULT && !pinned) return;
    setOwn(settings, category, { alertPct, pinned });
  });
  return settings;
}

export function budgetSettingsFor(settings, category) {
  const entry = isPlainObject(settings) && Object.hasOwn(settings, category) ? settings[category] : null;
  return {
    alertPct: entry && BUDGET_ALERT_OPTIONS.includes(entry.alertPct) ? entry.alertPct : BUDGET_ALERT_DEFAULT,
    pinned: entry?.pinned === true,
  };
}

export function budgetHistory(transactions, category, month, count, shiftMonth) {
  return Array.from({ length: count }, (_, index) => {
    const target = shiftMonth(month, index - count);
    const cents = transactions
      .filter((transaction) => transaction.type === 'out'
        && transaction.category === category
        && transaction.date.startsWith(target))
      .reduce((sum, transaction) => sum + transaction.cents, 0);
    return { month: target, cents };
  });
}

export function suggestBudgetCents(history) {
  const spent = history.filter((entry) => entry.cents > 0);
  if (spent.length < 2) return null;
  const average = spent.reduce((sum, entry) => sum + entry.cents, 0) / spent.length;
  return { cents: Math.ceil(average / 1000) * 1000, months: spent.length };
}

function daysInMonth(month) {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(year, monthNumber, 0).getDate();
}

function joinNames(names) {
  const shown = names.slice(0, 3).join(', ');
  return names.length > 3 ? `${shown} e mais ${names.length - 3}` : shown;
}

export function budgetReport({
  transactions,
  budgets = {},
  settings = {},
  month,
  previousMonth,
  throughDay = null,
  accountForId = () => null,
  formatMoney = (cents) => String(cents / 100),
  shiftMonth,
}) {
  const current = monthStats(transactions, month, accountForId);
  if (!current.tx.length) return [];
  const previous = monthStats(transactions, previousMonth, accountForId);
  const items = [];

  const result = current.inAll - current.outAll;
  if (current.inAll || current.outAll) {
    items.push({
      tone: result < 0 ? 'warn' : 'ok',
      text: `Receitas de ${formatMoney(current.inAll)} e despesas de ${formatMoney(current.outAll)}: resultado ${result < 0 ? 'negativo' : 'positivo'} de ${formatMoney(Math.abs(result))}.`,
    });
  }

  const currentCutoff = throughDay ? `${month}-${pad(throughDay)}` : `${month}-31`;
  const previousCutoff = throughDay
    ? `${previousMonth}-${pad(Math.min(throughDay, daysInMonth(previousMonth)))}`
    : `${previousMonth}-31`;
  const currentOut = current.tx.filter((transaction) => transaction.type === 'out' && transaction.date <= currentCutoff);
  const previousOut = previous.tx.filter((transaction) => transaction.type === 'out' && transaction.date <= previousCutoff);
  const currentTotal = currentOut.reduce((sum, transaction) => sum + transaction.cents, 0);
  const previousTotal = previousOut.reduce((sum, transaction) => sum + transaction.cents, 0);
  const period = throughDay ? 'no mesmo período do mês anterior' : 'em relação ao mês anterior';
  if (previousTotal > 0 && currentTotal > 0) {
    const percent = Math.round((currentTotal - previousTotal) / previousTotal * 100);
    if (percent >= 10) items.push({ tone: 'warn', text: `Despesas ${percent}% maiores ${period}.` });
    else if (percent <= -10) items.push({ tone: 'ok', text: `Despesas ${Math.abs(percent)}% menores ${period}.` });
    else items.push({ tone: 'info', text: `Despesas parecidas ${period}.` });

    const previousByCategory = new Map(byCategory(previousOut, 'out'));
    const risers = byCategory(currentOut, 'out')
      .map(([category, cents]) => ({ category, diff: cents - (previousByCategory.get(category) || 0) }))
      .filter((entry) => entry.diff > 0 && entry.diff >= currentTotal * 0.1)
      .sort((a, b) => b.diff - a.diff);
    if (risers[0]) {
      items.push({ tone: 'info', text: `A categoria que mais subiu foi ${risers[0].category}, com ${formatMoney(risers[0].diff)} a mais.` });
    }
  }

  const spentByCategory = new Map(byCategory(current.tx, 'out'));
  const entries = Object.entries(budgets).filter(([, budget]) => budget?.cents > 0);
  const over = [];
  const near = [];
  entries.forEach(([category, budget]) => {
    const spent = spentByCategory.get(category) || 0;
    if (spent > budget.cents) over.push(category);
    else if (spent / budget.cents * 100 >= budgetSettingsFor(settings, category).alertPct) near.push(category);
  });
  if (over.length) items.push({ tone: 'warn', text: `Acima do limite: ${joinNames(over)}.` });
  if (near.length) items.push({ tone: 'warn', text: `Perto do limite: ${joinNames(near)}.` });
  if (entries.length && !over.length && !near.length) {
    items.push({ tone: 'ok', text: 'Todos os limites estão dentro do combinado.' });
  }

  if (current.outAll > 0 && shiftMonth) {
    const suggestions = [];
    for (const [category, cents] of byCategory(current.tx, 'out')) {
      if (suggestions.length >= 2) break;
      if (Object.hasOwn(budgets, category) || cents < current.outAll * 0.15) continue;
      const suggestion = suggestBudgetCents(budgetHistory(transactions, category, month, 3, shiftMonth));
      if (!suggestion) continue;
      const share = Math.round(cents / current.outAll * 100);
      suggestions.push({
        tone: 'info',
        text: `${category} pesa ${share}% das despesas e não tem limite. Sugestão: ${formatMoney(suggestion.cents)} por mês.`,
      });
    }
    items.push(...suggestions);
  }

  if (current.outPending > 0) {
    items.push({ tone: 'info', text: `Ainda faltam pagar ${formatMoney(current.outPending)} em despesas do mês.` });
  }
  return items;
}
