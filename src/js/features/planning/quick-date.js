import { addDays, pk } from '../../utils/dates.js';

const DAYS = {
  domingo: 0, segunda: 1, 'segunda-feira': 1, terca: 2, 'terca-feira': 2,
  quarta: 3, 'quarta-feira': 3, quinta: 4, 'quinta-feira': 4,
  sexta: 5, 'sexta-feira': 5, sabado: 6,
};

export function parseQuickDate(input, today) {
  const text = String(input);
  const expression = /(?<![\p{L}\p{N}#_-])(hoje|amanhã|amanha|domingo|segunda(?:-feira)?|terça(?:-feira)?|terca(?:-feira)?|quarta(?:-feira)?|quinta(?:-feira)?|sexta(?:-feira)?|sábado|sabado)(?![\p{L}\p{N}_-])(?:\s+(?:às?\s+)?(\d{1,2})(?:h(\d{1,2})?|:(\d{2}))(?![\p{L}\p{N}]))?/giu;
  const matches = [...text.matchAll(expression)];
  if (!matches.length) return { title: text.trim(), date: today, time: '', recognized: false };
  if (matches.length > 1) return { title: text.trim(), date: today, time: '', recognized: false, error: 'Use apenas uma data na captura rápida.' };
  const match = matches[0];
  const hour = match[2] == null ? null : Number(match[2]);
  const minute = Number(match[3] || match[4] || 0);
  if (hour !== null && (hour > 23 || minute > 59)) {
    return { title: text.trim(), date: today, time: '', recognized: false, error: 'Informe um horário válido, como 14h ou 14h30.' };
  }
  const day = match[1].toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const offset = day === 'hoje' ? 0 : day === 'amanha' ? 1 : (DAYS[day] - pk(today).getDay() + 7) % 7;
  const time = hour === null ? '' : `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  return {
    title: `${text.slice(0, match.index)} ${text.slice(match.index + match[0].length)}`.replace(/\s+/g, ' ').trim(),
    date: addDays(today, offset),
    time,
    recognized: true,
  };
}
