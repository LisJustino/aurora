export const ACCOUNT_TYPES = Object.freeze({
  checking: 'Conta corrente',
  savings: 'Poupança',
  investment: 'Investimento',
  credit: 'Cartão de crédito',
});

export function normalizeAccountType(type) {
  return type === 'cash' ? 'checking' : type;
}

export function isValidAccountType(type) {
  return Object.hasOwn(ACCOUNT_TYPES, type) || type === 'cash';
}
