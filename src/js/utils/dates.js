export const pad = (value) => String(value).padStart(2, '0');

export const dk = (date = new Date()) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
export const pk = (key) => {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
};
export const today = () => dk();
export const addDays = (key, amount) => {
  const date = pk(key);
  date.setDate(date.getDate() + amount);
  return dk(date);
};
export const addMonths = (key, amount) => {
  const date = pk(key);
  const day = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + amount);
  date.setDate(Math.min(day, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()));
  return dk(date);
};
export const dayDiff = (a, b) => Math.round((pk(a) - pk(b)) / 864e5);
export const weekStart = (key, startDay = 1) => {
  const date = pk(key);
  date.setDate(date.getDate() - ((date.getDay() + 7 - startDay) % 7));
  return dk(date);
};
export const isoDay = (iso) => dk(new Date(iso));
export const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const MESES_L = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
export const shortDate = (key) => {
  const date = pk(key);
  return `${date.getDate()} ${MESES[date.getMonth()]}`;
};
export const longDate = (key) => {
  const date = pk(key);
  return `${DIAS[date.getDay()]}, ${date.getDate()} de ${MESES_L[date.getMonth()]}`;
};
export const clock = (seconds) => {
  const value = Math.max(0, Math.floor(seconds));
  return `${pad(Math.floor(value / 3600))}:${pad(Math.floor(value / 60) % 60)}:${pad(value % 60)}`;
};
export const dur = (seconds) => {
  const minutes = Math.round(seconds / 60);
  if (minutes < 1) return seconds > 0 ? '<1 min' : '0 min';
  const hours = Math.floor(minutes / 60), remainder = minutes % 60;
  return hours ? (remainder ? `${hours} h ${remainder} min` : `${hours} h`) : `${minutes} min`;
};
export const normalizeDay = (value) => {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [year, month, day] = trimmed.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year
      && date.getMonth() === month - 1
      && date.getDate() === day
      ? trimmed
      : '';
  }

  const cleaned = trimmed.replace(/[^\d]/g, '-').replace(/-+/g, '-');
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(cleaned);
  if (!match) return '';

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return '';
  return `${year}-${pad(month)}-${pad(day)}`;
};

export const isDay = (value) => {
  const match = typeof value === 'string' && /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return date.getFullYear() === Number(year)
    && date.getMonth() === Number(month) - 1
    && date.getDate() === Number(day);
};
