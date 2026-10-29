const SUGGESTION_RECIPIENT = 'lisjustino@gmail.com';

export function createSuggestionMailto({ name = '', email = '', message } = {}) {
  if (typeof name !== 'string' || typeof email !== 'string'
    || typeof message !== 'string' || !message.trim()) {
    throw new TypeError('Preencha uma sugestão válida antes de preparar o e-mail.');
  }
  const details = [];
  if (name.trim()) details.push(`Nome: ${name.trim()}`);
  if (email.trim()) details.push(`E-mail para resposta: ${email.trim()}`);
  details.push(`Sugestão:\n${message.trim()}`);
  const subject = encodeURIComponent('Sugestão para o Aurora');
  const body = encodeURIComponent(details.join('\n\n'));
  return `mailto:${SUGGESTION_RECIPIENT}?subject=${subject}&body=${body}`;
}
