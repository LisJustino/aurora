const normalize = (value) => String(value || '')
  .toLocaleLowerCase('pt-BR')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim();

export function searchRecords({
  tasks = [],
  transactions = [],
  accounts = [],
  habits = [],
  water = [],
  cycleLogs = {},
}, query, limit = 30) {
  const term = normalize(query);
  if (term.length < 2 || !Number.isInteger(limit) || limit < 1) return [];
  const accountNames = new Map(accounts.map((account) => [account.id, account.name]));
  const results = [];

  for (const task of tasks) {
    const fields = [task.title, task.notes, task.groupTitle, ...(task.tags || [])];
    if (fields.some((field) => normalize(field).includes(term))) {
      results.push({
        kind: 'task',
        id: task.id,
        area: 'Planejar',
        title: task.title,
        detail: [task.dueDate, task.done ? 'Concluída' : 'Pendente'].filter(Boolean).join(' · '),
      });
    }
  }

  for (const transaction of transactions) {
    const account = accountNames.get(transaction.accountId) || '';
    const fields = [transaction.desc, transaction.category, account, transaction.date];
    if (fields.some((field) => normalize(field).includes(term))) {
      results.push({
        kind: 'transaction',
        id: transaction.id,
        area: 'Finanças',
        title: transaction.desc || transaction.category || 'Lançamento financeiro',
        detail: [transaction.category, account, transaction.date].filter(Boolean).join(' · '),
      });
    }
  }

  for (const habit of habits) {
    if (normalize(habit.name).includes(term)) {
      results.push({
        kind: 'habit',
        id: habit.id,
        area: 'Hábitos',
        title: habit.name,
        detail: habit.status === 'archived' ? 'Arquivado' : habit.status === 'paused' ? 'Pausado' : 'Hábito',
      });
    }
  }

  for (const entry of water) {
    const date = typeof entry.at === 'string' ? entry.at.slice(0, 10) : '';
    const fields = [date, entry.ml, 'água', 'hidratação'];
    if (fields.some((field) => normalize(field).includes(term))) {
      results.push({
        kind: 'water',
        id: entry.id,
        area: 'Hábitos · Água',
        title: 'Registro de hidratação',
        detail: [entry.ml ? `${entry.ml} ml` : '', date].filter(Boolean).join(' · '),
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
    if (fields.some((field) => normalize(field).includes(term))) {
      results.push({
        kind: 'cycle',
        id: date,
        area: 'Ciclo',
        title: 'Registro do ciclo',
        detail: date,
      });
    }
  }

  return results.slice(0, limit);
}
