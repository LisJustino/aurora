// Cadastro de tarefas em lote: transforma uma lista de texto (uma tarefa por
// linha) em linhas conferíveis antes de criar as tarefas.
//
// Cada linha aceita a mesma captura rápida do app: uma data ("amanhã", "sexta",
// "20/11"), um horário ("14h30") e #etiquetas, em qualquer ordem.
import { parseQuickDate } from './quick-date.js';

export const MAX_BULK_TASKS = 50;
export const MAX_TASK_TITLE = 120;

const LINE_PREFIX = /^\s*(?:[-–—•*]\s+(?:\[[ xX]?\]\s*)?|\d+[.)]\s+|\[[ xX]?\]\s*)/;
const TAG = /(^|\s)#([\p{L}\d_-]{1,24})/gu;

const normalize = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/\s+/g, ' ')
    .trim();

function splitTags(text) {
  const tags = [];
  const title = text
    .replace(TAG, (match, space, tag) => {
      const key = tag.toLocaleLowerCase('pt-BR');
      if (!tags.includes(key)) tags.push(key);
      return space;
    })
    .replace(/\s{2,}/g, ' ')
    .trim();
  return { title, tags };
}

export function parseBulkTasks(text, today, existingTasks = []) {
  const openKeys = new Set(
    existingTasks.filter((task) => !task.done).map((task) => `${normalize(task.title)}|${task.dueDate || ''}`),
  );
  const seen = new Set();
  const rows = [];
  String(text ?? '')
    .split(/\r?\n/)
    .forEach((rawLine, index) => {
      const source = rawLine.trim();
      if (!source) return;
      const line = index + 1;
      const fail = (error) => rows.push({ line, source, error });
      if (rows.length >= MAX_BULK_TASKS) return fail(`Limite de ${MAX_BULK_TASKS} tarefas por vez.`);
      const stripped = source.replace(LINE_PREFIX, '').trim();
      const { title: withoutTags, tags } = splitTags(stripped);
      const parsed = parseQuickDate(withoutTags, today);
      if (parsed.error) return fail(parsed.error);
      const title = parsed.title.trim();
      if (!title) return fail('Escreva o título da tarefa.');
      if (title.length > MAX_TASK_TITLE) return fail(`O título passa de ${MAX_TASK_TITLE} caracteres.`);
      const dueDate = parsed.recognized ? parsed.date : null;
      const time = dueDate && parsed.time ? parsed.time : '';
      const key = `${normalize(title)}|${dueDate || ''}`;
      const duplicate = openKeys.has(key) || seen.has(key);
      seen.add(key);
      rows.push({ line, source, title, dueDate, time, tags, duplicate, on: !duplicate });
    });
  return rows;
}
