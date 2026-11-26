// Cadastro de hábitos em lote: transforma uma lista (um hábito por linha) em
// linhas conferíveis antes de criar.
//
// Formato de cada linha: "Nome - dias". Os dias são opcionais (sem eles, todos
// os dias). Exemplos: "Ler 10 páginas - seg a sex", "Treinar - seg, qua, sex",
// "Alongar - todos os dias", "Correr - 3x por semana", "Arrumar a casa - sáb".
import { isWaterHabit } from './model.js';

export const MAX_BULK_HABITS = 30;
export const MAX_HABIT_NAME = 60;

const LINE_PREFIX = /^\s*(?:[-–—•*]\s+(?:\[[ xX]?\]\s*)?|\d+[.)]\s+|\[[ xX]?\]\s*)/;
const SEPARATOR = /\s[-–—]\s|\s*[:|]\s*/;
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

const normalize = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/\s+/g, ' ')
    .trim();

const DAY_WORDS = {
  dom: 0,
  domingo: 0,
  domingos: 0,
  seg: 1,
  segunda: 1,
  segundas: 1,
  ter: 2,
  terca: 2,
  tercas: 2,
  qua: 3,
  quarta: 3,
  quartas: 3,
  qui: 4,
  quinta: 4,
  quintas: 4,
  sex: 5,
  sexta: 5,
  sextas: 5,
  sab: 6,
  sabado: 6,
  sabados: 6,
};
const FILLER = new Set([
  'e',
  'a',
  'ate',
  'de',
  'da',
  'do',
  'das',
  'dos',
  'as',
  'os',
  'nas',
  'nos',
  'na',
  'no',
  'por',
  'semana',
  'vez',
  'vezes',
  'x',
  'todas',
  'todos',
  'dias',
  'dia',
]);

function range(from, to) {
  const days = [from];
  for (let day = from; day !== to && days.length < 8;) {
    day = (day + 1) % 7;
    days.push(day);
  }
  return days;
}

// Interpreta o trecho depois do nome. Retorna { days, weeklyGoal } ou { error }.
export function parseHabitSchedule(text) {
  let rest = normalize(text);
  if (!rest) return { days: [...ALL_DAYS], weeklyGoal: null };
  let weeklyGoal = null;
  const goal = rest.match(/(\d)\s*x\b/);
  if (goal) {
    weeklyGoal = Number(goal[1]);
    rest = rest.replace(goal[0], ' ');
  }
  const days = new Set();
  const phrase = (pattern, list) => {
    if (pattern.test(rest)) {
      list.forEach((day) => days.add(day));
      rest = rest.replace(pattern, ' ');
    }
  };
  phrase(/\b(?:todos os dias|todo dia|diari[oa]s?|diariamente)\b/, ALL_DAYS);
  phrase(/\bdias uteis\b/, [1, 2, 3, 4, 5]);
  phrase(/\b(?:fim|fins) de semana\b/, [0, 6]);
  rest = rest.replace(/-?feiras?\b/g, ' ').replace(/-/g, ' a ');
  const words = rest.split(/[^a-z0-9]+/).filter(Boolean);
  let previous = null;
  let pendingRange = false;
  for (const word of words) {
    if (word in DAY_WORDS) {
      const day = DAY_WORDS[word];
      if (pendingRange && previous !== null) range(previous, day).forEach((item) => days.add(item));
      else days.add(day);
      previous = day;
      pendingRange = false;
    } else if (word === 'a' || word === 'ate') {
      pendingRange = previous !== null;
    } else if (!FILLER.has(word) && !/^\d+$/.test(word)) {
      return { error: `Não entendi “${word}”. Use dias como seg, ter, qua ou “seg a sex”.` };
    } else {
      pendingRange = false;
    }
  }
  const chosen = days.size ? [...days].sort((a, b) => a - b) : [...ALL_DAYS];
  if (weeklyGoal !== null && (weeklyGoal < 1 || weeklyGoal > chosen.length)) {
    return { error: `A meta de ${weeklyGoal}x não cabe em ${chosen.length} ${chosen.length === 1 ? 'dia' : 'dias'}.` };
  }
  return { days: chosen, weeklyGoal };
}

export function parseBulkHabits(text, existingHabits = []) {
  const taken = new Set((Array.isArray(existingHabits) ? existingHabits : []).map((habit) => normalize(habit.name)));
  const seen = new Set();
  const rows = [];
  String(text ?? '')
    .split(/\r?\n/)
    .forEach((rawLine, index) => {
      const source = rawLine.trim();
      if (!source) return;
      const line = index + 1;
      const fail = (error) => rows.push({ line, source, error });
      if (rows.length >= MAX_BULK_HABITS) return fail(`Limite de ${MAX_BULK_HABITS} hábitos por vez.`);
      const stripped = source.replace(LINE_PREFIX, '').trim();
      const match = stripped.match(SEPARATOR);
      const name = (match ? stripped.slice(0, match.index) : stripped).trim();
      const scheduleText = match ? stripped.slice(match.index + match[0].length) : '';
      if (!/[\p{L}\d]/u.test(name)) return fail('Escreva o nome do hábito.');
      if (name.length > MAX_HABIT_NAME) return fail(`O nome passa de ${MAX_HABIT_NAME} caracteres.`);
      if (isWaterHabit({ name })) return fail('O hábito de água tem meta própria. Crie-o por “Novo hábito”.');
      const schedule = parseHabitSchedule(scheduleText);
      if (schedule.error) return fail(schedule.error);
      const key = normalize(name);
      const duplicate = taken.has(key) || seen.has(key);
      seen.add(key);
      rows.push({
        line,
        source,
        name,
        days: schedule.days,
        weeklyGoal: schedule.weeklyGoal,
        duplicate,
        on: !duplicate,
      });
    });
  return rows;
}
