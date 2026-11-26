import { PASSWORD_REJECTED_MESSAGE } from './password-policy.js';
import { MINIMUM_ACCOUNT_AGE } from './account-consent.js';

export function passwordRecoveryErrorMessage(error) {
  const code = typeof error?.code === 'string' ? error.code.toLowerCase() : '';
  if (code === 'over_email_send_rate_limit' || error?.status === 429) {
    return 'Muitas solicitações foram feitas recentemente. Aguarde alguns minutos antes de tentar novamente.';
  }
  return genericAuthError();
}

export function loginErrorMessage(error) {
  const code = typeof error?.code === 'string' ? error.code.toLowerCase() : '';
  const name = typeof error?.name === 'string' ? error.name : '';
  const providerMessage = [error?.message, error?.msg]
    .filter((value) => typeof value === 'string')
    .join(' ')
    .toLowerCase();
  if (
    (typeof navigator !== 'undefined' && navigator.onLine === false) ||
    name === 'AuthRetryableFetchError' ||
    error instanceof TypeError
  ) {
    return 'Sem conexão com a internet. Confira sua conexão e tente entrar novamente.';
  }
  if (['user_not_found', 'email_not_found'].includes(code) || /(?:user|email) not found/.test(providerMessage)) {
    return 'Não encontramos uma conta com esse e-mail. Confira o endereço ou crie uma conta.';
  }
  if (
    ['invalid_password', 'password_incorrect'].includes(code) ||
    /(?:invalid|incorrect) password/.test(providerMessage)
  ) {
    return 'A senha está incorreta. Confira e tente novamente.';
  }
  if (code === 'invalid_credentials' || /invalid login credentials|invalid credentials/.test(providerMessage)) {
    return 'E-mail ou senha incorretos. Confira os dados e tente novamente.';
  }
  return genericAuthError();
}

export function isPasswordRecoveryCallback(locationLike) {
  const queryType = new URLSearchParams(locationLike?.search || '').get('type');
  const hashType = new URLSearchParams((locationLike?.hash || '').replace(/^#/, '')).get('type');
  return queryType === 'recovery' || hashType === 'recovery';
}

export function authCallbackErrorMessage(locationLike) {
  const params = new URLSearchParams(locationLike?.search || '');
  const error = params.get('error');
  const code = params.get('error_code');
  if (!error && !code) return '';
  if (code === 'otp_expired') {
    return 'Esse link expirou ou já foi usado. No projeto atual, o acesso deve ser liberado sem confirmação de e-mail; volte para entrar. Se a conta foi criada enquanto a confirmação estava ativa, ela ainda precisa ser liberada no Supabase.';
  }
  return 'Não foi possível concluir o link de acesso. Ele pode ter expirado ou já ter sido usado. Volte para entrar ou solicite novas instruções.';
}

export class AccountConflictError extends Error {
  constructor(slice) {
    super(`A fatia ${slice} foi atualizada em outro dispositivo.`);
    this.name = 'AccountConflictError';
    this.slice = slice;
  }
}

export function genericAuthError() {
  return 'Não foi possível concluir a solicitação. Confira os dados e tente novamente.';
}

export function isRejectedAccountSession(error) {
  const code = typeof error?.code === 'string' ? error.code.toLowerCase() : '';
  return error?.status === 401 || ['session_not_found', 'refresh_token_not_found', 'user_not_found'].includes(code);
}

export function isExistingAccountSignup(error, data = {}) {
  const code = typeof error?.code === 'string' ? error.code.toLowerCase() : '';
  const message = typeof error?.message === 'string' ? error.message : '';
  const identities = data.user?.identities;
  return Boolean(
    ['email_exists', 'user_already_exists'].includes(code) ||
    /\b(?:user|email)(?: address)?\s+(?:already\s+)?(?:registered|exists)\b/i.test(message) ||
    (!data.session && data.user && Array.isArray(identities) && identities.length === 0),
  );
}

export function isAccountDeletionConfirmed(error, data) {
  return !error && data?.deleted === true;
}

export function signupErrorMessage(error, data = {}) {
  if (isExistingAccountSignup(error, data)) {
    return 'Este e-mail já está vinculado a uma conta, então não criamos outra. Para manter a conta, entre ou recupere o acesso. Se quiser começar de novo, entre na conta e use Ajustes → Seu perfil → Excluir conta. Depois que a exclusão permanente for confirmada, você poderá se cadastrar novamente com esse e-mail; os dados apagados não podem ser recuperados.';
  }
  const code = typeof error?.code === 'string' ? error.code.toLowerCase() : '';
  if (code === 'p0001' && /signup_minimum_age/i.test(error?.message || '')) {
    return `É necessário ter pelo menos ${MINIMUM_ACCOUNT_AGE} anos para criar uma conta.`;
  }
  if (code === 'weak_password') {
    return PASSWORD_REJECTED_MESSAGE;
  }
  if (code === 'invalid_email') {
    return 'Confira se o e-mail foi digitado corretamente e tente novamente.';
  }
  if (code === 'over_email_send_rate_limit' || error?.status === 429) {
    return 'Muitas tentativas de cadastro em pouco tempo. Aguarde alguns minutos e tente novamente.';
  }
  return genericAuthError();
}
