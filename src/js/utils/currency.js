export const brl = (cents) => (cents / 100).toLocaleString('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

export function formatMoneyInput(value) {
  const text = String(value);
  const negative = text.includes('-');
  const digits = text.replace(/\D/g, '').replace(/^0+(?=\d)/, '') || '0';
  if (digits === '0') return `${negative ? '-' : ''}00,00`;

  const whole = digits.slice(0, -2) || '0';
  const fraction = digits.slice(-2).padStart(2, '0');
  const groupedWhole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${negative ? '-' : ''}${groupedWhole},${fraction}`;
}

export function parseMoney(value) {
  const normalized = String(value).trim().replace(/^R\$\s*/i, '').replace(/\s/g, '');
  const match = /^([+-]?)(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?$/.exec(normalized)
    || /^([+-]?)(\d+)\.(\d{1,2})$/.exec(normalized);
  if (!match) return NaN;

  const whole = Number(match[2].replace(/\./g, ''));
  const fraction = Number((match[3] || '').padEnd(2, '0'));
  const cents = whole * 100 + fraction;
  if (!Number.isSafeInteger(cents)) return NaN;
  return match[1] === '-' ? -cents : cents;
}
