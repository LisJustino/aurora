// @ts-check

/**
 * Local calendar day in `YYYY-MM-DD` format. Always interpreted in the
 * device's local time zone, never as UTC.
 * @typedef {string} DayKey
 */

/**
 * @param {number | string} value
 * @returns {string}
 */
export const pad = (value) => String(value).padStart(2, '0');

/**
 * Formats a `Date` as a local day key (uses local getters, never `toISOString`).
 * @param {Date} [date]
 * @returns {DayKey}
 */
export const dk = (date = new Date()) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/**
 * Parses a day key as local midnight (or the first valid instant of that local day).
 * @param {DayKey} key
 * @returns {Date}
 */
export const pk = (key) => {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
};

/** @returns {DayKey} */
export const today = () => dk();

/**
 * @param {DayKey} key
 * @param {number} amount
 * @returns {DayKey}
 */
export const addDays = (key, amount) => {
  const date = pk(key);
  date.setDate(date.getDate() + amount);
  return dk(date);
};

/**
 * Adds calendar months, clamping the day to the last day of the target month.
 * @param {DayKey} key
 * @param {number} amount
 * @returns {DayKey}
 */
export const addMonths = (key, amount) => {
  const date = pk(key);
  const day = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + amount);
  date.setDate(Math.min(day, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()));
  return dk(date);
};

/**
 * Whole calendar days between two keys (`a - b`). Rounded so DST shifts don't matter.
 * @param {DayKey} a
 * @param {DayKey} b
 * @returns {number}
 */
export const dayDiff = (a, b) => Math.round((pk(a).getTime() - pk(b).getTime()) / 864e5);

/**
 * @param {DayKey} key
 * @param {number} [startDay] 0 = Sunday, 1 = Monday…
 * @returns {DayKey}
 */
export const weekStart = (key, startDay = 1) => {
  const date = pk(key);
  date.setDate(date.getDate() - ((date.getDay() + 7 - startDay) % 7));
  return dk(date);
};

const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Local day of a timestamp/`Date`. A bare `YYYY-MM-DD` string is already a local
 * day and is returned as-is (`new Date('YYYY-MM-DD')` would parse it as UTC and
 * shift it to the previous day west of Greenwich). Invalid input returns `''`.
 * @param {string | number | Date} iso
 * @returns {DayKey}
 */
export const isoDay = (iso) => {
  if (typeof iso === 'string' && DAY_KEY_PATTERN.test(iso.trim())) return normalizeDay(iso);
  const date = iso instanceof Date ? iso : new Date(iso);
  return Number.isFinite(date.getTime()) ? dk(date) : '';
};
export const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const MESES_L = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];
export const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

/**
 * @param {DayKey} key
 * @returns {string}
 */
export const shortDate = (key) => {
  const date = pk(key);
  return `${date.getDate()} ${MESES[date.getMonth()]}`;
};

/**
 * @param {DayKey} key
 * @returns {string}
 */
export const longDate = (key) => {
  const date = pk(key);
  return `${DIAS[date.getDay()]}, ${date.getDate()} de ${MESES_L[date.getMonth()]}`;
};

/**
 * @param {number} seconds
 * @returns {string} `HH:MM:SS`
 */
export const clock = (seconds) => {
  const value = Math.max(0, Math.floor(seconds));
  return `${pad(Math.floor(value / 3600))}:${pad(Math.floor(value / 60) % 60)}:${pad(value % 60)}`;
};

/**
 * @param {number} seconds
 * @returns {string}
 */
export const dur = (seconds) => {
  const minutes = Math.round(seconds / 60);
  if (minutes < 1) return seconds > 0 ? '<1 min' : '0 min';
  const hours = Math.floor(minutes / 60),
    remainder = minutes % 60;
  return hours ? (remainder ? `${hours} h ${remainder} min` : `${hours} h`) : `${minutes} min`;
};

/**
 * Accepts `YYYY-MM-DD` or loosely separated `YYYY/M/D` and returns a valid day key or `''`.
 * @param {unknown} value
 * @returns {DayKey | ''}
 */
export const normalizeDay = (value) => {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';

  if (DAY_KEY_PATTERN.test(trimmed)) {
    const [year, month, day] = trimmed.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? trimmed : '';
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

/**
 * @param {unknown} value
 * @returns {value is DayKey}
 */
export const isDay = (value) => {
  const match = typeof value === 'string' && /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return date.getFullYear() === Number(year) && date.getMonth() === Number(month) - 1 && date.getDate() === Number(day);
};
