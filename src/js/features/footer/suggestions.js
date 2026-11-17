export const CONTACT_EMAIL = 'lisjustino@gmail.com';

export function normalizeSuggestionMessage(value) {
  if (typeof value !== 'string') {
    throw new TypeError('Escreva uma sugestão antes de enviar.');
  }
  const message = value.trim();
  if (message.length < 10 || message.length > 2000) {
    throw new TypeError('A sugestão deve ter entre 10 e 2.000 caracteres.');
  }
  return message;
}
