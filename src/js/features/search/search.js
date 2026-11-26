import { ACCOUNT_TYPES } from '../finance/accounts.js';

const normalize = (value) =>
  String(value || '')
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

function matchBoundaryScore(text, token) {
  const index = text.indexOf(token);
  if (index < 0) return 0;
  if (text === token) return 100;
  if (index === 0) return 80;
  if (index > 0 && /[\s·/,-]/.test(text[index - 1])) return 70;
  return 55;
}

function rankFields(fields, term, terms) {
  let best = null;
  for (const field of fields) {
    const text = String(field || '');
    const normalized = normalize(text);
    const score = matchBoundaryScore(normalized, term);
    if (!score) continue;
    if (!best || score > best.score) best = { score, matchText: text };
  }
  if (best || terms.length <= 1) return best;

  const normalizedFields = fields.map((field) => ({
    text: String(field || ''),
    normalized: normalize(field),
  }));
  const combined = normalizedFields.map((entry) => entry.normalized).join(' ');
  if (!terms.every((token) => combined.includes(token))) return null;

  let allWordStart = true;
  let bestField = '';
  let bestFieldHits = 0;
  for (const token of terms) {
    const tokenBest = Math.max(...normalizedFields.map((entry) => matchBoundaryScore(entry.normalized, token)));
    if (tokenBest < 70) allWordStart = false;
  }
  for (const entry of normalizedFields) {
    const hits = terms.filter((token) => entry.normalized.includes(token)).length;
    if (hits > bestFieldHits) {
      bestFieldHits = hits;
      bestField = entry.text;
    }
  }
  return {
    score: allWordStart ? 65 : 45,
    matchText: bestField,
  };
}

export function searchRecords(
  {
    tasks = [],
    transactions = [],
    accounts = [],
    financeGoals = [],
    annualPlans = {},
    habits = [],
    water = [],
    cycleLogs = {},
    actions = [],
  },
  query,
  limit = 30,
) {
  const term = normalize(query);
  if (term.length < 2 || !Number.isInteger(limit) || limit < 1) return [];
  const terms = [...new Set(term.split(/\s+/).filter(Boolean))];
  const accountNames = new Map(accounts.map((account) => [account.id, account.name]));
  const results = [];

  for (const task of tasks) {
    const fields = [task.title, task.notes, task.groupTitle, task.dueDate, ...(task.tags || [])];
    const match = rankFields(fields, term, terms);
    if (match) {
      results.push({
        kind: 'task',
        id: task.id,
        area: 'Planejar',
        title: task.title,
        detail: [task.dueDate, task.done ? 'Concluída' : 'Pendente'].filter(Boolean).join(' · '),
        ...match,
      });
    }
  }

  for (const [year, plan] of Object.entries(annualPlans || {})) {
    if (!plan || !Array.isArray(plan.goals)) continue;
    for (const goal of plan.goals) {
      const fields = [goal.title, goal.action, year, plan.intention];
      const match = rankFields(fields, term, terms);
      if (match) {
        results.push({
          kind: 'annual-goal',
          id: `${year}:${goal.id}`,
          year,
          area: 'Plano anual',
          title: goal.title,
          detail: [year, goal.done ? 'Cumprida' : 'Em andamento'].join(' · '),
          ...match,
        });
      }
    }
  }

  for (const transaction of transactions) {
    const account = accountNames.get(transaction.accountId) || '';
    const fields = [transaction.desc, transaction.category, account, transaction.date];
    const match = rankFields(fields, term, terms);
    if (match) {
      results.push({
        kind: 'transaction',
        id: transaction.id,
        area: 'Finanças',
        title: transaction.desc || transaction.category || 'Lançamento financeiro',
        detail: [transaction.category, account, transaction.date].filter(Boolean).join(' · '),
        ...match,
      });
    }
  }

  for (const account of accounts) {
    const typeLabel = ACCOUNT_TYPES[account.type] || 'Conta';
    const fields = [account.name, typeLabel, account.bank];
    const match = rankFields(fields, term, terms);
    if (match) {
      results.push({
        kind: 'account',
        id: account.id,
        area: 'Finanças · Contas',
        title: account.name,
        detail: typeLabel,
        ...match,
      });
    }
  }

  for (const goal of financeGoals) {
    const linked = goal.linkedAccountId ? accountNames.get(goal.linkedAccountId) || '' : '';
    const fields = [goal.name, goal.deadline, linked, 'objetivo'];
    const match = rankFields(fields, term, terms);
    if (match) {
      results.push({
        kind: 'finance-goal',
        id: goal.id,
        area: 'Finanças · Objetivos',
        title: goal.name,
        detail: [goal.deadline ? `Até ${goal.deadline}` : 'Objetivo financeiro', linked].filter(Boolean).join(' · '),
        ...match,
      });
    }
  }

  for (const habit of habits) {
    const match = rankFields([habit.name], term, terms);
    if (match) {
      results.push({
        kind: 'habit',
        id: habit.id,
        area: 'Hábitos',
        title: habit.name,
        detail: habit.status === 'archived' ? 'Arquivado' : habit.status === 'paused' ? 'Pausado' : 'Hábito',
        ...match,
      });
    }
  }

  for (const entry of water) {
    const date = typeof entry.at === 'string' ? entry.at.slice(0, 10) : '';
    const fields = [date, entry.ml, 'água', 'hidratação'];
    const match = rankFields(fields, term, terms);
    if (match) {
      results.push({
        kind: 'water',
        id: entry.id,
        area: 'Hábitos · Água',
        title: 'Registro de hidratação',
        detail: [entry.ml ? `${entry.ml} ml` : '', date].filter(Boolean).join(' · '),
        ...match,
      });
    }
  }

  for (const [date, log] of Object.entries(cycleLogs)) {
    if (!log || typeof log !== 'object') continue;
    const fields = [
      date,
      log.note,
      log.searchText,
      log.flow,
      log.energy,
      log.sleep,
      log.discharge,
      ...(Array.isArray(log.pain) ? log.pain : []),
      ...(Array.isArray(log.mood) ? log.mood : []),
      ...(Array.isArray(log.digestion) ? log.digestion : []),
      ...(Array.isArray(log.skin) ? log.skin : []),
    ];
    const match = rankFields(fields, term, terms);
    if (match) {
      results.push({
        kind: 'cycle',
        id: date,
        area: 'Ciclo',
        title: 'Registro do ciclo',
        detail: date,
        ...match,
      });
    }
  }

  for (const action of actions) {
    const match = rankFields([action.title, ...(action.aliases || [])], term, terms);
    if (match) results.push({ ...action, kind: 'action', ...match });
  }

  return results
    .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title, 'pt-BR'))
    .slice(0, limit);
}
