import { addDays, isDay, pk } from '../../utils/dates.js';

const WEEKDAYS = {
  domingo: 0,
  segunda: 1,
  'segunda-feira': 1,
  'terça': 2,
  'terça-feira': 2,
  'quarta': 3,
  'quarta-feira': 3,
  'quinta': 4,
  'quinta-feira': 4,
  sexta: 5,
  'sexta-feira': 5,
  sábado: 6,
};

const DEADLINE_AT_END = /^(.*?)\s+(hoje|amanhã|domingo|segunda(?:-feira)?|terça(?:-feira)?|quarta(?:-feira)?|quinta(?:-feira)?|sexta(?:-feira)?|sábado)(?:\s+(?:às?\s*)?(\d{1,2})(?::(\d{2})|h))?(?:[,;.!?])?\s*$/iu;
const DEADLINE_ONLY = /^(?:hoje|amanhã|domingo|segunda(?:-feira)?|terça(?:-feira)?|quarta(?:-feira)?|quinta(?:-feira)?|sexta(?:-feira)?|sábado)(?:\s+(?:às?\s*)?\d{1,2}(?::\d{2}|h))?(?:[,;.!?])?$/iu;
const pad = (value) => String(value).padStart(2, '0');

export function parseQuickTaskText(value, referenceDay) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!isDay(referenceDay)) {
    return { title: text, dueDate: null, time: '', hasDeadline: false, error: 'Não foi possível interpretar a data de hoje.' };
  }
  const match = DEADLINE_AT_END.exec(text);
  if (!match) {
    const error = DEADLINE_ONLY.test(text) ? 'Escreva a tarefa antes do prazo.' : '';
    return { title: text, dueDate: null, time: '', hasDeadline: false, error };
  }

  const title = match[1].replace(/[\s,;:–—-]+$/u, '').trim();
  if (!title) {
    return { title: '', dueDate: null, time: '', hasDeadline: false, error: 'Escreva a tarefa antes do prazo.' };
  }
  const hour = match[3] === undefined ? null : Number(match[3]);
  const minute = match[4] === undefined ? 0 : Number(match[4]);
  if ((hour !== null && (hour > 23 || minute > 59)) || (hour === null && match[4] !== undefined)) {
    return { title, dueDate: null, time: '', hasDeadline: false, error: 'Informe um horário válido entre 00:00 e 23:59.' };
  }

  const dayToken = match[2].toLocaleLowerCase('pt-BR');
  let dueDate = referenceDay;
  if (dayToken === 'amanhã') {
    dueDate = addDays(referenceDay, 1);
  } else if (dayToken !== 'hoje') {
    const targetDay = WEEKDAYS[dayToken];
    dueDate = addDays(referenceDay, (targetDay - pk(referenceDay).getDay() + 7) % 7);
  }
  return {
    title,
    dueDate,
    time: hour === null ? '' : `${pad(hour)}:${pad(minute)}`,
    hasDeadline: true,
    error: '',
  };
}
