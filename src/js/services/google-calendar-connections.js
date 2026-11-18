// Conexões do Google Agenda guardadas no servidor (função "google-calendar" do Supabase).
// O navegador recebe apenas tokens de acesso de curta duração; o token de renovação nunca sai do servidor.
export class GoogleConnectionError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const MESSAGES = {
  'reauthorization-required': 'O Google revogou ou expirou o acesso desta conta. Conecte novamente.',
  'no-refresh-token': 'O Google não liberou o acesso contínuo. Conecte novamente e aceite todas as permissões.',
  'authorization-rejected': 'O Google recusou a autorização. Tente conectar novamente.',
};

async function errorCode(error) {
  try {
    const body = await error?.context?.json?.();
    if (typeof body?.error === 'string') return body.error;
  } catch { /* corpo ilegível */ }
  return 'service-unavailable';
}

export function createGoogleConnections(client) {
  const call = async (body) => {
    const { data, error } = await client.functions.invoke('google-calendar', { body });
    if (error) {
      const code = await errorCode(error);
      throw new GoogleConnectionError(code, MESSAGES[code] || 'Não foi possível falar com o servidor do Google Agenda. Tente novamente.');
    }
    return data;
  };
  return {
    async list() {
      const data = await call({ action: 'list' });
      return Array.isArray(data?.accounts) ? data.accounts : [];
    },
    connect: (code) => call({ action: 'connect', code }),
    token: (id) => call({ action: 'token', id }),
    select: (id, calendarIds) => call({ action: 'select', id, calendarIds }),
    disconnect: (id) => call({ action: 'disconnect', id }),
  };
}
