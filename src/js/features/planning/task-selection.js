import { addDays, isoDay } from '../../utils/dates.js';

export function todayTasks(tasks, day) {
  return tasks.filter((task) => task.dueDate && task.dueDate <= day
    && (!task.done || (task.doneAt && isoDay(task.doneAt) === day)))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate)
      || (a.time || '99:99').localeCompare(b.time || '99:99'));
}

export function filteredTasks(tasks, { f, q, sort }, day, { normalize, orderOf }) {
  const query = normalize(q.trim());
  const nextWeek = addDays(day, 7);
  const result = tasks.filter((task) => {
    if (f === 'pendentes' && task.done) return false;
    if (f === 'concluidas' && !task.done) return false;
    if (f === 'atrasadas' && (task.done || !task.dueDate || task.dueDate >= day)) return false;
    if (f === 'proximas' && (task.done || !task.dueDate || task.dueDate <= day || task.dueDate > nextWeek)) return false;
    if (f === 'caixa' && (task.done || task.dueDate)) return false;
    if (f.startsWith('etq:') && !(task.tags || []).includes(f.slice(4))) return false;
    return !query || normalize(task.title).includes(query)
      || (task.tags || []).some((tag) => normalize(tag).includes(query))
      || normalize(task.notes || '').includes(query)
      || normalize(task.groupTitle || '').includes(query);
  });
  const priority = { high: 0, normal: 1, low: 2 };
  result.sort((a, b) => a.done - b.done
    || (sort === 'manual' ? orderOf(a) - orderOf(b)
      : sort === 'prioridade' ? priority[a.priority] - priority[b.priority]
        : sort === 'recentes' ? (b.createdAt || 0) - (a.createdAt || 0)
          : (a.dueDate || '9999').localeCompare(b.dueDate || '9999')
            || (a.time || '99:99').localeCompare(b.time || '99:99')));
  return result;
}
