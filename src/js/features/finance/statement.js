import { parseMoney } from '../../utils/currency.js';

const MAX_STATEMENT_ROWS = 500;

const normDate = (year, month, day) => {
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return date.getFullYear() === Number(year)
    && date.getMonth() === Number(month) - 1
    && date.getDate() === Number(day)
    ? `${year}-${String(Number(month)).padStart(2, '0')}-${String(Number(day)).padStart(2, '0')}`
    : null;
};

function parseDateAny(value) {
  const text = String(value || '').trim();
  let match;
  if ((match = /^(\d{4})-(\d{2})-(\d{2})/.exec(text))
    || (match = /^(\d{4})(\d{2})(\d{2})/.exec(text))) {
    return normDate(match[1], match[2], match[3]);
  }
  if ((match = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4}|\d{2})\b/.exec(text))) {
    return normDate(match[3].length === 2 ? `20${match[3]}` : match[3], match[2], match[1]);
  }
  return null;
}

function csvRows(text) {
  const first = text.split(/\r?\n/).find((line) => line.trim()) || '';
  const count = (character) => (first.match(new RegExp(`\\${character}`, 'g')) || []).length;
  const delimiter = [';', '\t', ','].sort((a, b) => count(b) - count(a))[0];
  const rows = [];
  let row = [];
  let value = '';
  let quoted = false;

  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          value += '"';
          index++;
        } else {
          quoted = false;
        }
      } else {
        value += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === delimiter) {
      row.push(value);
      value = '';
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && text[index + 1] === '\n') index++;
      row.push(value);
      value = '';
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
    } else {
      value += character;
    }
  }

  row.push(value);
  if (row.some((cell) => cell.trim())) rows.push(row);
  return rows;
}

const moneyAny = (value) => {
  let text = String(value || '').trim();
  if (!text) return NaN;
  const negative = /^\(.*\)$/.test(text) || /-\s*$/.test(text) || /^-/.test(text) || /\bD\b$/i.test(text);
  text = text.replace(/[^\d,.]/g, '');
  if (!text) return NaN;
  const cents = parseMoney(text);
  return Number.isNaN(cents) ? NaN : negative ? -Math.abs(cents) : cents;
};

export function parseStatement(text, name = '') {
  const source = String(text).replace(/^\uFEFF/, '');
  const transactions = [];
  const isOfx = /<STMTTRN>/i.test(source) || /\.ofx$/i.test(name);

  if (isOfx) {
    for (const block of source.split(/<STMTTRN>/i).slice(1)) {
      const field = (key) => {
        const match = new RegExp(`<${key}>([^<\\r\\n]*)`, 'i').exec(block);
        return match ? match[1].trim() : '';
      };
      const date = parseDateAny(field('DTPOSTED'));
      const amount = Number(field('TRNAMT').replace(',', '.'));
      const cents = Math.round(amount * 100);
      if (date && Number.isSafeInteger(cents) && cents !== 0) {
        transactions.push({
          date,
          desc: (field('MEMO') || field('NAME') || 'Lançamento').slice(0, 80),
          cents,
        });
        if (transactions.length > MAX_STATEMENT_ROWS) break;
      }
    }
    return {
      transactions: transactions.slice(0, MAX_STATEMENT_ROWS),
      truncated: transactions.length > MAX_STATEMENT_ROWS,
    };
  }

  const rows = csvRows(source);
  if (rows.length < 2) return { transactions, truncated: false };
  const headerIndex = rows.findIndex((row) => row.some((cell) => /^(data|date)/i.test(cell.trim()))
    && row.some((cell) => /valor|value|amount|d[ée]bito|cr[ée]dito|quantia/i.test(cell)));
  let dateIndex;
  let descriptionIndex;
  let valueIndex;
  let debitIndex;
  let creditIndex;
  let startIndex;

  if (headerIndex >= 0) {
    const header = rows[headerIndex].map((cell) => cell.trim().toLowerCase());
    const find = (pattern) => header.findIndex((cell) => pattern.test(cell));
    dateIndex = find(/^(data|date)/);
    descriptionIndex = find(/descri|hist|memo|estabel|lan[çc]amento|title|t[íi]tulo|nome/);
    valueIndex = find(/valor|value|amount|quantia/);
    debitIndex = find(/d[ée]bito/);
    creditIndex = find(/cr[ée]dito/);
    startIndex = headerIndex + 1;
  } else {
    const first = rows[0];
    dateIndex = first.findIndex((cell) => parseDateAny(cell));
    valueIndex = first.findIndex((cell, index) => index !== dateIndex
      && !Number.isNaN(moneyAny(cell)) && /\d/.test(cell));
    descriptionIndex = first.findIndex((cell, index) => index !== dateIndex
      && index !== valueIndex && cell.trim().length > 2);
    startIndex = 0;
  }

  if (dateIndex < 0 || (valueIndex < 0 && debitIndex < 0 && creditIndex < 0)) {
    return { transactions, truncated: false };
  }
  if (descriptionIndex < 0) {
    descriptionIndex = rows[startIndex]
      ? rows[startIndex].findIndex((cell, index) => (
        index !== dateIndex && index !== valueIndex && index !== debitIndex && index !== creditIndex
      ))
      : -1;
  }

  for (let index = startIndex; index < rows.length; index++) {
    const row = rows[index];
    const date = parseDateAny(row[dateIndex]);
    if (!date) continue;

    let amount = NaN;
    if (valueIndex >= 0) {
      amount = moneyAny(row[valueIndex]);
    } else {
      const debit = moneyAny(row[debitIndex]);
      const credit = moneyAny(row[creditIndex]);
      amount = (Number.isNaN(credit) ? 0 : Math.abs(credit))
        - (Number.isNaN(debit) ? 0 : Math.abs(debit));
    }
    const cents = amount;
    if (!Number.isSafeInteger(cents) || cents === 0) continue;

    transactions.push({
      date,
      desc: String(descriptionIndex >= 0 ? row[descriptionIndex] : '').trim().slice(0, 80)
        || 'Lançamento',
      cents,
    });
    if (transactions.length > MAX_STATEMENT_ROWS) break;
  }

  return {
    transactions: transactions.slice(0, MAX_STATEMENT_ROWS),
    truncated: transactions.length > MAX_STATEMENT_ROWS,
  };
}
