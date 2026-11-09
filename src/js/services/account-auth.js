import {
  getSupabaseClient,
  hasSupabaseConfig,
  setRememberSession,
} from '../data/supabase-client.js';
import {
  createVault,
  decryptAccountSlice,
  encryptAccountSlice,
  unlockVaultWithPassword,
  unlockVaultWithRecovery,
} from './crypto-vault.js';
import { renderPublicHeader } from '../features/appearance/public-controls.js';
import { renderFooterContent } from '../features/footer/view.js';
import { calculateAge, createBirthdayReference, isValidBirthdayReference } from '../features/profile/birthday.js';
import {
  accountModeFromLocation,
  accountPathForMode,
  isPublicLandingLocation,
} from '../core/router.js';
import { iconSvg } from '../utils/icons.js';
import { isNativeApp } from '../utils/platform.js';
import { NATIVE_AUTH_REDIRECT_URL } from '../utils/native-auth-callback.js';

export { calculateAge };

export const LEGAL_DOCUMENT_VERSION = '1.9';
export const CYCLE_DATA_CONSENT_VERSION = '1.9';
export const MINIMUM_ACCOUNT_AGE = 16;

export function createLegalConsentMetadata(acceptedAt = new Date()) {
  if (!(acceptedAt instanceof Date) || Number.isNaN(acceptedAt.getTime())) {
    throw new TypeError('A data de aceite dos documentos legais é inválida.');
  }
  return {
    terms_accepted_at: acceptedAt.toISOString(),
    terms_version: LEGAL_DOCUMENT_VERSION,
    privacy_policy_version: LEGAL_DOCUMENT_VERSION,
  };
}

export function hasCurrentLegalConsent(user) {
  const metadata = user?.user_metadata;
  return Boolean(metadata
    && metadata.terms_version === LEGAL_DOCUMENT_VERSION
    && metadata.privacy_policy_version === LEGAL_DOCUMENT_VERSION
    && typeof metadata.terms_accepted_at === 'string'
    && Number.isFinite(Date.parse(metadata.terms_accepted_at)));
}

export function createCycleDataConsentMetadata(acceptedAt = new Date()) {
  if (!(acceptedAt instanceof Date) || Number.isNaN(acceptedAt.getTime())) {
    throw new TypeError('A data de consentimento para dados de Ciclo é inválida.');
  }
  return {
    cycle_data_consent_at: acceptedAt.toISOString(),
    cycle_data_consent_version: CYCLE_DATA_CONSENT_VERSION,
    cycle_data_consent_revoked_at: null,
  };
}

export function createCycleDataConsentRevocationMetadata(revokedAt = new Date()) {
  if (!(revokedAt instanceof Date) || Number.isNaN(revokedAt.getTime())) {
    throw new TypeError('A data de revogação do consentimento para dados de Ciclo é inválida.');
  }
  return { cycle_data_consent_revoked_at: revokedAt.toISOString() };
}

export function hasCurrentCycleDataConsent(user) {
  const metadata = user?.user_metadata;
  return Boolean(metadata
    && metadata.cycle_data_consent_version === CYCLE_DATA_CONSENT_VERSION
    && typeof metadata.cycle_data_consent_at === 'string'
    && Number.isFinite(Date.parse(metadata.cycle_data_consent_at))
    && !metadata.cycle_data_consent_revoked_at);
}

export function hasCompleteProfile(user) {
  const metadata = user?.user_metadata;
  return Boolean(metadata
    && typeof metadata.name === 'string'
    && metadata.name.trim()
    && typeof metadata.preferred_name === 'string'
    && metadata.preferred_name.trim()
    && isValidBirthdayReference({
      month: metadata.birthday_month,
      day: metadata.birthday_day,
      ageAtReference: metadata.age,
      referenceDate: metadata.birthday_reference_date,
    }));
}

export function hasSocialIdentity(user) {
  const providers = [
    user?.app_metadata?.provider,
    ...(Array.isArray(user?.app_metadata?.providers) ? user.app_metadata.providers : []),
    ...(Array.isArray(user?.identities) ? user.identities.map((identity) => identity?.provider) : []),
  ];
  return providers.some((provider) => provider === 'google' || provider === 'apple');
}

export function getOAuthRedirectUrl(origin) {
  return new URL('/', origin).href;
}

const SLICES = new Set([
  'tasks', 'pomodoro', 'settings',
  'water', 'gym', 'finance', 'cycle', 'cycleLog', 'weight', 'habits',
]);

let clientPromise;
const PASSWORD_REQUIREMENTS = [
  ['length', '6 ou mais caracteres', (value) => value.length >= 6],
  ['lowercase', 'uma letra minúscula', (value) => /\p{Ll}/u.test(value)],
  ['uppercase', 'uma letra maiúscula', (value) => /\p{Lu}/u.test(value)],
  ['number', 'um dígito', (value) => /\p{N}/u.test(value)],
  ['symbol', 'um símbolo', (value) => /[\p{P}\p{S}]/u.test(value)],
];
const EMAIL_DOMAINS = [
  'gmail.com',
  'outlook.com',
  'hotmail.com',
  'yahoo.com',
  'icloud.com',
  'live.com',
  'proton.me',
  'protonmail.com',
  'outlook.com.br',
  'hotmail.com.br',
  'yahoo.com.br',
  'uol.com.br',
  'bol.com.br',
];

export function getEmailDomainSuggestions(value) {
  if (typeof value !== 'string') return [];
  const separator = value.lastIndexOf('@');
  if (separator <= 0 || value.indexOf('@') !== separator) return [];
  const localPart = value.slice(0, separator);
  const domainPrefix = value.slice(separator + 1).toLowerCase();
  return EMAIL_DOMAINS
    .filter((domain) => domain.startsWith(domainPrefix) && domain !== domainPrefix)
    .map((domain) => `${localPart}@${domain}`);
}

export function meetsPasswordRequirements(value) {
  return typeof value === 'string'
    && value.length >= 6
    && value.length <= 72
    && PASSWORD_REQUIREMENTS.slice(1).every(([, , test]) => test(value));
}

export function passwordRecoveryErrorMessage(error) {
  const code = typeof error?.code === 'string' ? error.code.toLowerCase() : '';
  if (code === 'over_email_send_rate_limit' || error?.status === 429) {
    return 'Muitas solicitações foram feitas recentemente. Aguarde alguns minutos antes de tentar novamente.';
  }
  return genericAuthError();
}

function localDateValue(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function navigateToAccountMode(mode, { replace = false } = {}) {
  const path = accountPathForMode(mode);
  if (!path) return;
  const url = new URL(location.href);
  const target = new URL(path, url.origin);
  url.pathname = target.pathname;
  url.searchParams.delete('etapa');
  target.searchParams.forEach((value, key) => url.searchParams.set(key, value));
  url.hash = '';
  const destination = `${url.pathname}${url.search}`;
  if (`${location.pathname}${location.search}` === destination) return;
  history[replace ? 'replaceState' : 'pushState'](null, '', destination);
}

function loginErrorMessage(error) {
  const code = typeof error?.code === 'string' ? error.code.toLowerCase() : '';
  const name = typeof error?.name === 'string' ? error.name : '';
  const providerMessage = [error?.message, error?.msg]
    .filter((value) => typeof value === 'string')
    .join(' ')
    .toLowerCase();
  if ((typeof navigator !== 'undefined' && navigator.onLine === false)
    || name === 'AuthRetryableFetchError'
    || error instanceof TypeError) {
    return 'Sem conexão com a internet. Confira sua conexão e tente entrar novamente.';
  }
  if (['user_not_found', 'email_not_found'].includes(code)
    || /(?:user|email) not found/.test(providerMessage)) {
    return 'Não encontramos uma conta com esse e-mail. Confira o endereço ou crie uma conta.';
  }
  if (['invalid_password', 'password_incorrect'].includes(code)
    || /(?:invalid|incorrect) password/.test(providerMessage)) {
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

export async function getAccountClient() {
  if (!hasSupabaseConfig()) {
    throw new Error('O projeto de contas não está configurado com uma URL HTTPS e uma chave pública.');
  }
  if (!clientPromise) {
    clientPromise = Promise.resolve().then(() => getSupabaseClient())
      .catch((error) => {
        clientPromise = null;
        throw error;
      });
  }
  return clientPromise;
}

const create = (tag, className, text) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};

function setAccountFieldError(input, message) {
  const field = input.closest('.account-field');
  if (!field) return;
  let error = field.querySelector('.account-field-error');
  if (!message) {
    if (error) {
      input.setAttribute('aria-describedby', (input.getAttribute('aria-describedby') || '')
        .split(/\s+/)
        .filter((id) => id && id !== error.id)
        .join(' '));
      error.remove();
    }
    input.removeAttribute('aria-invalid');
    return;
  }
  if (!error) {
    error = create('small', 'field-err account-field-error');
    error.id = `${input.id}-error`;
    field.append(error);
  }
  error.textContent = message;
  input.setAttribute('aria-invalid', 'true');
  const describedBy = new Set((input.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
  describedBy.add(error.id);
  input.setAttribute('aria-describedby', [...describedBy].join(' '));
}

function attachEmailSuggestions(input) {
  const field = input.closest('.account-field');
  if (!field) return;

  const listId = `${input.id}-suggestions`;
  const popup = create('div', 'account-email-suggestions');
  const list = create('div', 'account-email-suggestion-list');
  list.id = listId;
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-label', 'Sugestões de provedores de e-mail');
  const hint = create('small', 'account-email-suggestion-hint', 'Digite mais para filtrar ou continue seu e-mail.');
  popup.append(list, hint);
  popup.hidden = true;
  field.append(popup);
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-controls', listId);
  input.setAttribute('aria-expanded', 'false');

  let activeIndex = -1;
  let suggestions = [];

  const close = () => {
    popup.hidden = true;
    field.classList.remove('has-email-suggestions');
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    activeIndex = -1;
  };

  const setActive = (index) => {
    activeIndex = (index + suggestions.length) % suggestions.length;
    [...list.children].forEach((option, optionIndex) => {
      const active = optionIndex === activeIndex;
      option.setAttribute('aria-selected', String(active));
      if (active) input.setAttribute('aria-activedescendant', option.id);
    });
  };

  const select = (suggestion) => {
    input.value = suggestion;
    close();
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.focus();
  };

  const refresh = () => {
    suggestions = getEmailDomainSuggestions(input.value).slice(0, 4);
    list.replaceChildren();
    if (!suggestions.length) {
      close();
      return;
    }

    suggestions.forEach((suggestion, index) => {
      const option = create('div', 'account-email-suggestion', suggestion);
      option.id = `${listId}-${index}`;
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', 'false');
      option.addEventListener('pointermove', () => setActive(index));
      option.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        select(suggestion);
      });
      list.append(option);
    });
    popup.hidden = false;
    field.classList.add('has-email-suggestions');
    input.setAttribute('aria-expanded', 'true');
    input.removeAttribute('aria-activedescendant');
    activeIndex = -1;
  };

  input.addEventListener('input', refresh);
  input.addEventListener('focus', refresh);
  input.addEventListener('blur', close);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (popup.hidden) refresh();
      if (suggestions.length) {
        event.preventDefault();
        const nextIndex = activeIndex < 0
          ? (event.key === 'ArrowDown' ? 0 : suggestions.length - 1)
          : activeIndex + (event.key === 'ArrowDown' ? 1 : -1);
        setActive(nextIndex);
      }
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();
      select(suggestions[activeIndex]);
    } else if (event.key === 'Escape' && !popup.hidden) {
      event.preventDefault();
      close();
    }
  });
}

function createField(form, labelText, name, type, autocomplete, value = '', helpText = '', container = form) {
  const wrapper = create('div', 'account-field');
  const label = create('label', '', labelText);
  const input = create('input', 'field', '');
  input.name = name;
  input.type = type;
  input.autocomplete = autocomplete;
  input.required = true;
  input.value = value;
  if (type === 'email') input.maxLength = 254;
  if (name === 'password') {
    input.minLength = 6;
    input.maxLength = 72;
  }
  if (name === 'confirmPassword') {
    input.minLength = 6;
    input.maxLength = 72;
  }
  if (name === 'email') input.placeholder = 'voce@email.com';
  if (name === 'password') input.placeholder = 'sua senha';
  if (name === 'confirmPassword') input.placeholder = 'confirme sua senha';
  if (name === 'recoveryKey') {
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.maxLength = 43;
    input.pattern = '[A-Za-z0-9_-]{43}';
  }
  if (name === 'confirmKey') {
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.maxLength = 6;
    input.pattern = '[A-Za-z0-9_-]{6}';
  }
  label.htmlFor = `account-${name}`;
  input.id = label.htmlFor;
  const control = create('div', type === 'password' ? 'account-password-control' : 'account-input-control');
  control.append(input);
  if (type === 'password') {
    const reveal = create('button', 'account-password-toggle');
    reveal.type = 'button';
    reveal.setAttribute('aria-label', `Mostrar ${labelText.toLowerCase()}`);
    reveal.setAttribute('aria-controls', input.id);
    reveal.setAttribute('aria-pressed', 'false');
    reveal.title = 'Mostrar senha';
    reveal.innerHTML = iconSvg('eye');
    reveal.addEventListener('click', () => {
      const visible = input.type === 'password';
      input.type = visible ? 'text' : 'password';
      reveal.setAttribute('aria-pressed', String(visible));
      reveal.setAttribute('aria-label', `${visible ? 'Ocultar' : 'Mostrar'} ${labelText.toLowerCase()}`);
      reveal.title = `${visible ? 'Ocultar' : 'Mostrar'} senha`;
      reveal.innerHTML = iconSvg(visible ? 'eyeOff' : 'eye');
      input.focus();
    });
    control.append(reveal);
  }
  wrapper.append(label, control);
  if (helpText) {
    const help = create('small', 'account-field-help', helpText);
    help.id = `${input.id}-help`;
    input.setAttribute('aria-describedby', help.id);
    wrapper.append(help);
  }
  input.addEventListener('invalid', () => setAccountFieldError(input, input.validationMessage));
  input.addEventListener('input', () => {
    if (input.validity.valid) setAccountFieldError(input, '');
  });
  container.append(wrapper);
  if (type === 'email' && name === 'email') attachEmailSuggestions(input);
  return input;
}

function createFormGroup(className, legendText) {
  const group = create('fieldset', className);
  group.append(create('legend', '', legendText));
  return group;
}

function setSubmitPending(button, pending) {
  if (pending) {
    if (!button.dataset.defaultLabel) button.dataset.defaultLabel = button.textContent;
    const spinner = create('span', 'account-spinner');
    spinner.setAttribute('aria-hidden', 'true');
    const label = create('span', '', 'aguarde…');
    button.replaceChildren(spinner, label);
    button.classList.add('is-loading');
    button.setAttribute('aria-busy', 'true');
    button.disabled = true;
    return;
  }
  button.textContent = button.dataset.defaultLabel || button.textContent;
  button.classList.remove('is-loading');
  button.removeAttribute('aria-busy');
  button.disabled = false;
}

const SPARKLE_PATH = 'M12 1.5c.7 5.6 3.4 8.3 9 9-5.6.7-8.3 3.4-9 9-.7-5.6-3.4-8.3-9-9 5.6-.7 8.3-3.4 9-9z';

const SUCCESS_ART = `<svg class="account-success-svg" viewBox="0 0 120 96" role="presentation" focusable="false">
    <circle class="ok-halo" cx="60" cy="50" r="38"/>
    <circle class="ok-disc" cx="60" cy="50" r="28"/>
    <path class="ok-check" d="M46 51l10 10 19-21"/>
    <path class="art-sparkle s1" d="${SPARKLE_PATH}" transform="translate(94 8) scale(.9)"/>
    <path class="art-sparkle s2" d="${SPARKLE_PATH}" transform="translate(10 22) scale(.6)"/>
    <path class="art-sparkle s3" d="${SPARKLE_PATH}" transform="translate(98 62) scale(.5)"/>
  </svg>`;

const ACCOUNT_ART = {
  envelope: `<svg class="account-art-svg" viewBox="0 0 260 200" role="presentation" focusable="false">
    <ellipse class="art-shadow" cx="130" cy="180" rx="84" ry="10"/>
    <g class="art-float">
      <path class="art-env-back" d="M36 78 130 18l94 60v84a12 12 0 0 1-12 12H48a12 12 0 0 1-12-12z"/>
      <rect class="art-paper" x="62" y="48" width="136" height="92" rx="10"/>
      <path class="art-paper-line" d="M82 74h96M82 92h70M82 110h84"/>
      <path class="art-env-front" d="M36 84 130 148l94-64v78a12 12 0 0 1-12 12H48a12 12 0 0 1-12-12z"/>
      <path class="art-env-fold" d="M36 162l76-56M224 162l-76-56" />
      <path class="art-heart" d="M130 158c-12-9-18-15-18-22a9 9 0 0 1 18-3 9 9 0 0 1 18 3c0 7-6 13-18 22z"/>
    </g>
    <path class="art-sparkle s1" d="${SPARKLE_PATH}" transform="translate(206 20) scale(1.1)"/>
    <path class="art-sparkle s2" d="${SPARKLE_PATH}" transform="translate(24 40) scale(.8)"/>
    <path class="art-sparkle s3" d="${SPARKLE_PATH}" transform="translate(228 112) scale(.6)"/>
  </svg>`,
  lock: `<svg class="account-art-svg" viewBox="0 0 260 200" role="presentation" focusable="false">
    <ellipse class="art-shadow" cx="130" cy="182" rx="76" ry="10"/>
    <g class="art-float">
      <path class="art-shackle" d="M92 86V68a38 38 0 0 1 76 0v18"/>
      <rect class="art-lock-body" x="64" y="84" width="132" height="92" rx="22"/>
      <rect class="art-lock-shine" x="76" y="94" width="108" height="22" rx="11"/>
      <circle class="art-keyhole" cx="130" cy="126" r="11"/>
      <path class="art-keyhole" d="M125 130h10l3 24h-16z"/>
    </g>
    <path class="art-sparkle s1" d="${SPARKLE_PATH}" transform="translate(200 24) scale(1.1)"/>
    <path class="art-sparkle s2" d="${SPARKLE_PATH}" transform="translate(30 70) scale(.8)"/>
    <path class="art-sparkle s3" d="${SPARKLE_PATH}" transform="translate(214 120) scale(.6)"/>
  </svg>`,
  preview: `<div class="account-preview">
    <div class="account-preview-card is-tasks">
      <p class="account-preview-title">Hoje</p>
      <ul>
        <li class="is-done"><span></span>Revisar a semana</li>
        <li class="is-done"><span></span>Caminhada de 20 min</li>
        <li><span></span>Planejar o mês</li>
      </ul>
    </div>
    <div class="account-preview-card is-habits">
      <svg viewBox="0 0 44 44" role="presentation" focusable="false"><circle class="ring-bg" cx="22" cy="22" r="17"/><circle class="ring-fg" cx="22" cy="22" r="17"/></svg>
      <p><b>5 de 7</b>hábitos na semana</p>
    </div>
    <div class="account-preview-card is-money">
      <p class="account-preview-title">Saldo do mês</p>
      <p class="account-preview-value">R$ 1.240,00</p>
      <div class="account-preview-bars"><span></span><span></span><span></span><span></span><span></span></div>
    </div>
    <svg class="account-preview-sparkle s1" viewBox="0 0 24 24" role="presentation" focusable="false"><path d="${SPARKLE_PATH}"/></svg>
    <svg class="account-preview-sparkle s2" viewBox="0 0 24 24" role="presentation" focusable="false"><path d="${SPARKLE_PATH}"/></svg>
  </div>`,
};

function createAccountArt(mode) {
  const kind = mode === 'recovery' ? 'envelope' : mode === 'update-password' ? 'lock' : 'preview';
  const art = create('div', `account-intro-art is-${kind}`);
  art.setAttribute('aria-hidden', 'true');
  art.innerHTML = ACCOUNT_ART[kind];
  return art;
}

function createAccountIntro(mode = '', brandLink = null) {
  const intro = create('aside', 'account-intro');
  const eyebrow = create('p', 'account-intro-eyebrow', 'SUA ROTINA, NO SEU RITMO');
  const introCopies = {
    login: {
      heading: 'Bem-vinda de volta!',
      description: 'Que bom ter você por aqui. Acesse sua conta e continue cuidando do que importa.',
    },
    'signup-profile': {
      heading: 'Vamos começar?',
      description: 'Crie sua conta no Aurora e tenha uma vida mais organizada, leve e consciente.',
    },
    'signup-access': {
      heading: 'Vamos começar?',
      description: 'Defina seu e-mail e senha para acessar o Aurora.',
    },
    recovery: {
      heading: 'Esqueceu sua senha?',
      description: 'Sem problemas! Informe seu e-mail e enviaremos um link para redefinir sua senha.',
    },
    'update-password': {
      heading: 'Tudo certo!',
      description: 'Agora é só criar uma nova senha para acessar sua conta.',
    },
  };
  const introCopy = introCopies[mode];
  const copy = introCopy || {
    heading: 'Mais clareza para o que importa.',
    description: 'Planeje seus dias, acompanhe hábitos e cuide das suas finanças em um só lugar.',
  };
  const heading = create('h2', '', copy.heading);
  const description = create(
    'p',
    'account-intro-description',
    copy.description,
  );
  if (brandLink) intro.append(brandLink);
  if (!introCopy) {
    const topics = create('ul', 'account-intro-topics');
    ['Tarefas', 'Hábitos', 'Foco', 'Finanças'].forEach((label) => {
      topics.append(create('li', '', label));
    });
    intro.append(eyebrow, heading, description, topics);
  } else {
    intro.append(heading, description, createAccountArt(mode));
  }
  return intro;
}

function createAccountPageLayout() {
  const layout = create('div', 'account-page');
  const page = create('main', 'account-gate');
  page.id = 'account-main';
  page.tabIndex = -1;
  const skip = create('a', 'skip', 'Pular para o conteúdo principal');
  skip.href = '#account-main';
  skip.addEventListener('click', (event) => {
    event.preventDefault();
    page.focus({ preventScroll: true });
    page.scrollIntoView({ block: 'start' });
  });
  const footer = document.createElement('footer');
  footer.className = 'app-footer site-footer account-gate-footer';
  footer.innerHTML = renderFooterContent({ accountError: true, includeFaq: false });
  layout.append(skip, page, footer);
  return { layout, page };
}

export function appendLegalConsent(form, { updatedDocuments = false } = {}) {
  const accepted = create('input');
  accepted.type = 'checkbox';
  accepted.name = 'termsAccepted';
  accepted.required = true;
  const consent = create('label', 'account-terms-consent');
  consent.append(accepted, create(
    'span',
    'account-terms-label',
    'Li e aceito os Termos de Uso e a Política de Privacidade.',
  ));

  const termsLink = create('a', '', 'Termos de Uso');
  termsLink.href = '/terms.html';
  termsLink.target = '_blank';
  termsLink.rel = 'noopener noreferrer';
  termsLink.dataset.legalDocument = 'terms';
  const privacyLink = create('a', '', 'Política de Privacidade');
  privacyLink.href = '/privacy.html';
  privacyLink.target = '_blank';
  privacyLink.rel = 'noopener noreferrer';
  privacyLink.dataset.legalDocument = 'privacy';
  const group = create('div', 'account-terms-group');
  if (updatedDocuments) {
    group.classList.add('account-terms-group-updated');
    const documents = create('div', 'account-legal-documents');
    termsLink.className = 'account-legal-document';
    termsLink.replaceChildren(
      create('span', 'account-legal-document-title', 'Termos de Uso'),
      create('span', 'account-legal-document-description', 'Regras para usar o Aurora'),
    );
    privacyLink.className = 'account-legal-document';
    privacyLink.replaceChildren(
      create('span', 'account-legal-document-title', 'Política de Privacidade'),
      create('span', 'account-legal-document-description', 'Como seus dados são tratados'),
    );
    documents.append(termsLink, privacyLink);
    group.append(documents, consent);
  } else {
    const links = create('p', 'account-terms-copy');
    links.append(
      document.createTextNode('Leia os documentos (eles abrem em novas abas): '),
      termsLink,
      document.createTextNode(' e '),
      privacyLink,
      document.createTextNode('.'),
    );
    group.append(consent, links);
  }
  form.append(group);
  return accepted;
}

export function createAccountForm(root, {
  title,
  description,
  mode,
  recoveryKey,
  email,
  signupProfile,
  links = [],
  includePublicHeader = false,
  noticeTone = '',
}) {
  root.replaceChildren();
  document.title = `${title} | aurora.`;
  const { layout, page } = createAccountPageLayout();
  page.dataset.accountMode = mode;
  const activeStage = { 'signup-profile': 1, 'signup-access': 2 }[mode];
  const profileMode = mode === 'signup-profile' || mode === 'oauth-profile';
  if (activeStage) page.dataset.accountStage = String(activeStage);
  let publicBrand = null;
  let publicActions = null;
  if (includePublicHeader) {
    const header = document.createElement('template');
    header.innerHTML = renderPublicHeader({ authMode: mode.startsWith('signup-') ? 'signup' : mode });
    const publicHeader = header.content.firstElementChild;
    publicBrand = publicHeader.querySelector('.public-brand-link');
    publicActions = publicHeader.querySelector('.public-header-actions');
    page.classList.add('is-public-account');
  }
  page.append(createAccountIntro(mode, null));
  const card = create('section', 'account-card');
  card.setAttribute('aria-labelledby', 'account-title');
  if (publicBrand && publicActions) {
    publicActions.classList.add('account-auth-header-actions');
    const home = create('a', 'btn account-home-link');
    home.href = '/';
    home.dataset.publicAction = 'landing';
    home.innerHTML = '<span aria-hidden="true">←</span> Voltar ao início';
    const siteHeader = create('header', 'account-site-header');
    siteHeader.append(publicBrand, home, publicActions);
    layout.insertBefore(siteHeader, page);
  }
  const brand = create('p', 'account-brand', 'aurora');
  const heading = create('h1', '', title);
  heading.id = 'account-title';
  heading.tabIndex = -1;
  const detail = create('p', 'account-description', description);
  const legalEyebrow = mode === 'legal-consent'
    ? create('p', 'account-legal-eyebrow', 'DOCUMENTOS ATUALIZADOS')
    : null;
  if (mode === 'login') {
    detail.classList.add('account-security-note');
    const icon = document.createElement('span');
    icon.className = 'account-security-icon';
    icon.innerHTML = iconSvg('shield', 18);
    detail.prepend(icon);
  }
  const form = create('form', 'account-form');
  form.dataset.accountMode = mode;
  form.noValidate = false;
  if (activeStage) {
    const steps = create('ol', 'account-steps');
    steps.setAttribute('aria-label', 'Etapas para criar uma conta');
    const signupSteps = [['seus dados', 1], ['acesso', 2]];
    signupSteps.forEach(([label, index]) => {
      const item = create('li', `account-step${index === activeStage ? ' is-current' : index < activeStage ? ' is-complete' : ''}`);
      item.dataset.step = String(index);
      if (index === activeStage) item.setAttribute('aria-current', 'step');
      const number = create('span', 'account-step-number', index < activeStage ? '' : String(index));
      if (index < activeStage) number.innerHTML = iconSvg('check', 16);
      const text = create('span', 'account-step-label', label);
      item.append(number, text);
      if (index < signupSteps[signupSteps.length - 1][1]) {
        const separator = create('span', 'account-step-separator');
        separator.setAttribute('aria-hidden', 'true');
        separator.innerHTML = iconSvg('chevRight', 16);
        item.append(separator);
      }
      steps.append(item);
    });
    card.append(steps);
  }
  if (legalEyebrow) card.append(brand, legalEyebrow, heading, detail);
  else card.append(brand, heading, detail);

  if (recoveryKey) {
    const instructions = create('p', 'account-security-note', 'Guarde esta chave fora do Aurora. Ela só aparece agora e será necessária para recuperar os dados se você redefinir a senha ou usar outro dispositivo.');
    const key = create('code', 'account-secret', recoveryKey);
    card.append(instructions, key);
  }

  let ageStatus = null;
  if (profileMode) {
    const nameInput = createField(form, 'Nome', 'name', 'text', 'name', signupProfile?.name || '');
    const preferredNameInput = createField(
      form,
      'Como você prefere ser chamado(a)?',
      'preferredName',
      'text',
      'nickname',
      signupProfile?.preferredName || signupProfile?.name?.trim().split(/\s+/)[0] || '',
    );
    nameInput.maxLength = 50;
    preferredNameInput.maxLength = 50;
    let preferredNameEdited = Boolean(signupProfile?.preferredName);
    preferredNameInput.addEventListener('input', () => { preferredNameEdited = true; });
    nameInput.addEventListener('input', () => {
      if (!preferredNameEdited) {
        preferredNameInput.value = nameInput.value.trim().split(/\s+/)[0].slice(0, 50);
      }
    });
    const birthDate = createField(
      form,
      'Data de nascimento',
      'birthDate',
      'date',
      'bday',
      signupProfile?.birthDate || '',
      'Usamos a data para calcular sua idade; guardamos somente a idade calculada.',
    );
    birthDate.closest('.account-field')?.classList.add('account-birth-field');
    birthDate.max = localDateValue(new Date());
    ageStatus = create('p', 'account-age-status');
    ageStatus.id = 'account-age-status';
    ageStatus.setAttribute('role', 'status');
    ageStatus.setAttribute('aria-live', 'polite');
    ageStatus.hidden = true;
    birthDate.setAttribute('aria-describedby', `${birthDate.getAttribute('aria-describedby')} ${ageStatus.id}`.trim());
    form.append(ageStatus);
  }
  if (mode === 'login' || mode === 'signup-access' || mode === 'recovery') {
    createField(
      form,
      'E-mail',
      'email',
      'email',
      'email',
      email,
      mode === 'signup-access'
        ? 'Você não precisa confirmar o e-mail para entrar. Confira o endereço: um erro pode impedir a recuperação da senha.'
        : '',
    );
  }
  if (mode === 'signup-access') {
    createField(
      form,
      'Confirmar e-mail',
      'confirmEmail',
      'email',
      'email',
      '',
      'Digite novamente o endereço para evitar erros de recuperação.',
    );
    const securityGroup = createFormGroup('account-form-group account-password-group', 'acesso seguro');
    form.append(securityGroup);
    createField(
      form,
      'Senha',
      'password',
      'password',
      'new-password',
      '',
      'mínimo 6 caracteres, com minúsculas, maiúsculas, dígitos e símbolos.',
      securityGroup,
    );
    form.elements.password.minLength = 6;
    form.elements.password.maxLength = 72;
    createField(form, 'Confirmar senha', 'confirmPassword', 'password', 'new-password', '', '', securityGroup);
    form.elements.confirmPassword.minLength = 6;
    form.elements.confirmPassword.maxLength = 72;
    appendLegalConsent(form);
  }
  if (mode === 'legal-consent' || mode === 'oauth-profile') {
    appendLegalConsent(form, { updatedDocuments: mode === 'legal-consent' });
  }
  if (mode === 'delete-account') {
    form.append(create('p', 'account-delete-warning', 'A exclusão é permanente: sua conta e os dados associados serão apagados e não poderão ser recuperados. Os arquivos de backup que você baixou não são apagados pelo Aurora.'));
    const confirmation = createField(
      form,
      'Digite EXCLUIR para confirmar',
      'deleteConfirmation',
      'text',
      'off',
      '',
      'Esta confirmação final é necessária para apagar a conta e os dados.',
    );
    confirmation.maxLength = 7;
    confirmation.setAttribute('pattern', 'EXCLUIR');
  }
  if (mode === 'login') {
    createField(
      form,
      'Senha',
      'password',
      'password',
      'current-password',
      '',
      '',
    );
    const rememberSession = create('input');
    rememberSession.type = 'checkbox';
    rememberSession.name = 'rememberSession';
    rememberSession.checked = true;
    const rememberSessionLabel = create('label', 'account-remember-session');
    const rememberSessionCopy = create('span', '', 'Manter conectado neste dispositivo');
    rememberSessionLabel.append(rememberSession, rememberSessionCopy);
    form.append(rememberSessionLabel);
  }
  if (mode === 'setup-vault') createField(form, 'Senha da conta', 'password', 'password', 'current-password');
  if (mode === 'unlock-password') createField(form, 'Senha da conta', 'password', 'password', 'current-password');
  if (mode === 'setup-vault' || mode === 'unlock-password') form.elements.password.minLength = 12;
  if (mode === 'unlock-recovery') createField(form, 'Chave de recuperação', 'recoveryKey', 'text', 'off');
  if (mode === 'confirm-recovery') createField(form, 'Digite os últimos 6 caracteres da chave', 'confirmKey', 'text', 'off');
  if (mode === 'update-password') {
    createField(
      form,
      'Nova senha',
      'password',
      'password',
      'new-password',
      '',
      'mínimo 6 caracteres, com minúsculas, maiúsculas, dígitos e símbolos.',
    );
    createField(form, 'Confirmar nova senha', 'confirmPassword', 'password', 'new-password');
  }

  const message = create('p', 'account-message');
  message.setAttribute('role', 'alert');
  message.setAttribute('aria-live', 'assertive');
  if (noticeTone) {
    message.dataset.tone = noticeTone;
    message.setAttribute('role', 'status');
    message.setAttribute('aria-live', 'polite');
  }
  const actions = create('div', 'account-actions');
  const submit = create('button', `btn primary${mode === 'delete-account' ? ' danger' : ''}`, mode === 'login' ? 'Entrar' : mode === 'signup-profile' ? 'Continuar' : mode === 'signup-access' ? 'Criar conta' : mode === 'legal-consent' || mode === 'oauth-profile' ? 'Aceitar e continuar' : mode === 'delete-account' ? 'Excluir minha conta e meus dados' : mode === 'recovery' ? 'Enviar instruções' : mode === 'update-password' ? 'Atualizar senha' : mode === 'setup-vault' ? 'Criar cofre criptografado' : mode === 'confirm-recovery' ? 'Confirmei que guardei' : 'Confirmar');
  submit.type = 'submit';
  actions.append(submit);
  if (mode === 'legal-consent') {
    const refuse = create('button', 'btn ghost account-refuse-terms', 'Recusar e encerrar conta');
    refuse.type = 'button';
    refuse.dataset.accountRefuseTerms = '';
    actions.append(refuse);
  }
  form.append(message, actions);
  if (includePublicHeader && (mode === 'recovery' || mode === 'login')) {
    const hero = create('div', 'account-success-hero');
    hero.hidden = true;
    hero.setAttribute('aria-hidden', 'true');
    const syncHero = () => {
      const isSuccess = message.dataset.tone === 'success' && message.textContent.trim() !== '';
      hero.hidden = !isSuccess;
      if (!isSuccess) return;
      hero.innerHTML = `${SUCCESS_ART}<strong>${mode === 'recovery' ? 'Link enviado' : 'Senha atualizada'}</strong>`;
    };
    new MutationObserver(syncHero).observe(message, { attributes: true, attributeFilter: ['data-tone'], childList: true, characterData: true, subtree: true });
    form.prepend(hero);
    syncHero();
  }
  if (mode === 'login' || mode === 'signup-profile') {
    const providers = create('fieldset', 'account-oauth');
    providers.append(create('legend', '', mode === 'login' ? 'Ou entre com' : 'Ou crie sua conta com'));
    const googleButton = create('button', 'btn account-oauth-button account-google-button');
    googleButton.type = 'button';
    googleButton.dataset.oauthProvider = 'google';
    const googleIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    googleIcon.classList.add('account-google-icon');
    googleIcon.setAttribute('viewBox', '0 0 24 24');
    googleIcon.setAttribute('aria-hidden', 'true');
    googleIcon.innerHTML = '<path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.75 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.43.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.78.43 3.46 1.18 4.94l3.66-2.84z"/><path fill="#EA4335" d="M12 5.37c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.03 14.97 1 12 1a11 11 0 0 0-9.82 6.06L5.84 9.9C6.71 7.3 9.14 5.37 12 5.37z"/>';
    const googleLabel = create(
      'span',
      '',
      mode === 'login' ? 'Entrar com Google' : 'Criar conta com Google',
    );
    googleButton.append(googleIcon, googleLabel);
    googleButton.setAttribute('aria-label', googleLabel.textContent);
    providers.append(googleButton);
    if (mode === 'signup-profile') {
      providers.append(create(
        'p',
        'account-oauth-note',
        'Sua conta Google pode criar uma conta Aurora ou acessar uma já vinculada.',
      ));
      form.prepend(providers);
    } else {
      form.append(providers);
    }
  }
  card.append(form);

  if (mode === 'signup-access') {
    const emailInput = form.elements.email;
    const password = form.elements.password;
    const confirmPassword = form.elements.confirmPassword;
    const passwordField = password.closest('.account-field');
    const strength = create('div', 'account-password-strength');
    strength.innerHTML = '<div class="account-strength-track" aria-hidden="true"><span></span></div><p class="account-strength-label" aria-live="polite">Força da senha: <b>fraca</b></p>';
    const checklist = create('ul', 'account-password-checklist');
    checklist.id = 'account-password-checklist';
    checklist.setAttribute('aria-live', 'polite');
    password.setAttribute('aria-describedby', `${password.getAttribute('aria-describedby')} ${checklist.id}`.trim());
    PASSWORD_REQUIREMENTS.forEach(([key, text]) => {
      const item = create('li', 'account-password-criterion', text);
      const indicator = create('span', 'account-password-criterion-icon');
      indicator.setAttribute('aria-hidden', 'true');
      indicator.innerHTML = iconSvg('circle', 12);
      item.prepend(indicator);
      item.dataset.criterion = key;
      checklist.append(item);
    });
    passwordField.append(strength, checklist);
    let emailWasBlurred = false;
    emailInput.addEventListener('focus', () => {
      emailWasBlurred = false;
      setAccountFieldError(emailInput, '');
    });
    const updateSignupValidity = () => {
      const value = password.value;
      let passed = 0;
      PASSWORD_REQUIREMENTS.forEach(([key, , test]) => {
        const valid = test(value);
        const item = checklist.querySelector(`[data-criterion="${key}"]`);
        item.classList.toggle('is-met', valid);
        item.setAttribute('aria-label', `${valid ? 'atendido' : 'pendente'}: ${item.textContent}`);
        item.querySelector('.account-password-criterion-icon').innerHTML = iconSvg(valid ? 'check' : 'circle', 12);
        if (valid) passed += 1;
      });
      const level = passed >= 5 ? 'forte' : passed >= 3 ? 'média' : 'fraca';
      strength.dataset.strength = passed >= 5 ? 'strong' : passed >= 3 ? 'medium' : 'weak';
      strength.querySelector('.account-strength-label b').textContent = level;
      const confirmationMatches = confirmPassword.value.length > 0 && confirmPassword.value === value;
      confirmPassword.setCustomValidity(confirmPassword.value && !confirmationMatches ? 'As senhas não coincidem.' : '');
      const confirmEmail = form.elements.confirmEmail;
      const emailsMatch = confirmEmail.value.trim().toLowerCase() === emailInput.value.trim().toLowerCase();
      confirmEmail.setCustomValidity(confirmEmail.value && !emailsMatch ? 'Os e-mails não coincidem.' : '');
      const emailIsValid = emailInput.validity.valid;
      setAccountFieldError(emailInput, emailInput.value && !emailIsValid && emailWasBlurred
        ? 'Digite um e-mail válido.'
        : '');
      setAccountFieldError(confirmEmail, confirmEmail.value && !emailsMatch
        ? 'Os e-mails não coincidem.'
        : '');
      setAccountFieldError(confirmPassword, confirmPassword.value && !confirmationMatches
        ? 'As senhas não coincidem.'
        : '');
      submit.disabled = !(
        emailIsValid
        && emailsMatch
        && meetsPasswordRequirements(value)
        && confirmationMatches
        && form.elements.termsAccepted.checked
      );
    };
    emailInput.addEventListener('blur', () => {
      emailWasBlurred = true;
      updateSignupValidity();
    });
    form.addEventListener('input', updateSignupValidity);
    form.addEventListener('change', updateSignupValidity);
    updateSignupValidity();
  } else if (mode === 'update-password') {
    const password = form.elements.password;
    const confirmPassword = form.elements.confirmPassword;
    const updatePasswordValidity = () => {
      const passwordsMatch = confirmPassword.value.length > 0 && confirmPassword.value === password.value;
      confirmPassword.setCustomValidity(confirmPassword.value && !passwordsMatch
        ? 'As senhas não coincidem.'
        : '');
      setAccountFieldError(confirmPassword, confirmPassword.value && !passwordsMatch
        ? 'As senhas não coincidem.'
        : '');
      submit.disabled = !meetsPasswordRequirements(password.value) || !passwordsMatch;
    };
    form.addEventListener('input', updatePasswordValidity);
    form.addEventListener('change', updatePasswordValidity);
    updatePasswordValidity();
  } else if (profileMode) {
    const birthDate = form.elements.birthDate;
    let birthDateTouched = Boolean(birthDate.value);
    const updateProfileValidity = () => {
      const age = calculateAge(birthDate.value);
      if (!birthDate.value) {
        ageStatus.hidden = !birthDateTouched;
        if (birthDateTouched) {
          ageStatus.textContent = 'Informe uma data de nascimento válida.';
          ageStatus.dataset.state = 'invalid';
        }
        birthDate.setCustomValidity('');
      } else if (age === null) {
        ageStatus.hidden = false;
        ageStatus.textContent = 'Informe uma data válida, com até 120 anos.';
        ageStatus.dataset.state = 'invalid';
        birthDate.setCustomValidity('Informe uma data de nascimento válida.');
      } else if (age < MINIMUM_ACCOUNT_AGE) {
        ageStatus.hidden = false;
        ageStatus.textContent = `Para criar uma conta, é necessário ter pelo menos ${MINIMUM_ACCOUNT_AGE} anos.`;
        ageStatus.dataset.state = 'invalid';
        birthDate.setCustomValidity(`É necessário ter pelo menos ${MINIMUM_ACCOUNT_AGE} anos para criar uma conta.`);
      } else {
        ageStatus.hidden = false;
        ageStatus.textContent = `Você tem ${age} anos.`;
        ageStatus.dataset.state = 'eligible';
        birthDate.setCustomValidity('');
      }
      submit.disabled = !(
        form.elements.name.value.trim()
        && form.elements.preferredName.value.trim()
        && age !== null
        && age >= MINIMUM_ACCOUNT_AGE
        && (mode !== 'oauth-profile' || form.elements.termsAccepted.checked)
      );
    };
    form.addEventListener('input', (event) => {
      if (event.target === birthDate) birthDateTouched = true;
      updateProfileValidity();
    });
    form.addEventListener('change', (event) => {
      if (event.target === birthDate) birthDateTouched = true;
      updateProfileValidity();
    });
    birthDate.addEventListener('blur', () => {
      birthDateTouched = true;
      updateProfileValidity();
    });
    updateProfileValidity();
  } else if (mode === 'legal-consent') {
    const updateConsentValidity = () => {
      submit.disabled = !form.elements.termsAccepted.checked;
    };
    form.addEventListener('change', updateConsentValidity);
    updateConsentValidity();
  } else if (mode === 'delete-account') {
    const confirmation = form.elements.deleteConfirmation;
    const updateDeleteValidity = () => {
      submit.disabled = confirmation.value !== 'EXCLUIR';
    };
    form.addEventListener('input', updateDeleteValidity);
    form.addEventListener('change', updateDeleteValidity);
    updateDeleteValidity();
  } else if (form.querySelector('input[required]')) {
    const updateFormValidity = () => {
      submit.disabled = Array.from(form.elements)
        .some((field) => field.willValidate && !field.validity.valid);
    };
    form.addEventListener('input', updateFormValidity);
    form.addEventListener('change', updateFormValidity);
    updateFormValidity();
  }

  if (links.length) {
    const accountLinks = create('div', 'account-links');
    links.forEach(({ label, target, prompt }) => {
      const isAccountSwitch = target === 'login' || target === 'signup';
      const isDemoReturn = target === 'landing';
      const link = create(
        'button',
        `btn ${isAccountSwitch ? 'back account-link-switch' : isDemoReturn ? 'account-link-return' : 'ghost'} account-link`,
        label,
      );
      link.type = 'button';
      link.dataset.accountMode = target;
      if (prompt && isAccountSwitch) {
        const switchAction = create('div', 'account-switch');
        switchAction.append(create('p', 'account-switch-prompt', prompt), link);
        accountLinks.append(switchAction);
      } else {
        accountLinks.append(link);
      }
    });
    card.append(accountLinks);
    const forgot = accountLinks.querySelector('[data-account-mode="recovery"]');
    const remember = form.querySelector('.account-remember-session');
    if (mode === 'login' && includePublicHeader && forgot && remember) {
      const row = create('div', 'account-login-row');
      forgot.classList.add('account-forgot-link');
      remember.before(row);
      row.append(remember, forgot);
    }
  }
  page.append(card);
  root.append(layout);
  heading.focus({ preventScroll: true });
  return { form, message, submit };
}

function showConfigurationError(root, message, title = 'A conta ainda não está configurada', includePublicHeader = false, configGuide = false) {
  root.replaceChildren();
  const { layout, page } = createAccountPageLayout();
  if (includePublicHeader) {
    const header = document.createElement('template');
    header.innerHTML = renderPublicHeader();
    page.append(header.content.firstElementChild);
  }
  page.append(createAccountIntro());
  const card = create('section', 'account-card');
  card.setAttribute('aria-labelledby', 'account-title');
  const brand = create('p', 'account-brand', 'aurora');
  const heading = create('h1', '', title);
  heading.id = 'account-title';
  heading.tabIndex = -1;
  const detail = create('p', 'account-description', message);
  detail.setAttribute('role', 'alert');
  const security = create('p', 'account-security-note', 'Por segurança, seus dados aparecem somente depois que você entra na conta.');
  const showConfigGuide = configGuide && import.meta.env?.DEV === true;
  const retry = create('button', 'btn primary', showConfigGuide ? 'Recarregar após configurar' : 'Tentar novamente');
  retry.type = 'button';
  retry.addEventListener('click', () => location.reload());
  const actions = create('div', 'account-actions');
  actions.append(retry);
  if (showConfigGuide) {
    const guide = create('div', 'account-config-guide');
    const intro = create('p', '', 'No VS Code, na pasta raiz do Aurora, crie o arquivo .env.local. Você pode copiar o .env.example e preencher os dois valores do projeto de teste local:');
    const example = create(
      'pre',
      'account-config-code',
      'VITE_SUPABASE_LOCAL_URL=https://SEU-PROJETO-DE-TESTE.supabase.co\nVITE_SUPABASE_LOCAL_ANON_KEY=SUA_CHAVE_PUBLICA_ANON_OU_PUBLISHABLE',
    );
    const source = create('p', '', 'Busque a Project URL e a chave publicável (anon) em Supabase → Project Settings → API / API Keys.');
    const restart = create('p', '', 'Depois salve, pare o servidor Vite com Ctrl+C, execute npm run dev novamente e recarregue esta página.');
    const warning = create('p', 'account-config-warning', 'Use somente a chave pública anon/publishable. Nunca use service_role/secret e não envie esses valores pelo chat.');
    const separation = create(
      'p',
      'account-config-warning',
      'Desenvolvimento e produção devem usar projetos Supabase diferentes. Contas e e-mails são independentes entre projetos.',
    );
    guide.append(intro, example, source, restart, warning, separation);
    card.append(brand, heading, detail, guide, security, actions);
  } else {
    card.append(brand, heading, detail, security, actions);
  }
  page.append(card);
  root.append(layout);
  heading.focus({ preventScroll: true });
}

export function showAccountError(root, message, includePublicHeader = false) {
  showConfigurationError(root, message, 'Não foi possível acessar a conta', includePublicHeader);
}

function genericAuthError() {
  return 'Não foi possível concluir a solicitação. Confira os dados e tente novamente.';
}

function isRejectedAccountSession(error) {
  const code = typeof error?.code === 'string' ? error.code.toLowerCase() : '';
  return error?.status === 401
    || ['session_not_found', 'refresh_token_not_found', 'user_not_found'].includes(code);
}

export function isExistingAccountSignup(error, data = {}) {
  const code = typeof error?.code === 'string' ? error.code.toLowerCase() : '';
  const message = typeof error?.message === 'string' ? error.message : '';
  const identities = data.user?.identities;
  return Boolean(['email_exists', 'user_already_exists'].includes(code)
    || /\b(?:user|email)(?: address)?\s+(?:already\s+)?(?:registered|exists)\b/i.test(message)
    || (!data.session && data.user && Array.isArray(identities) && identities.length === 0));
}

export function isAccountDeletionConfirmed(error, data) {
  return !error && data?.deleted === true;
}

export async function requestAccountDeletion(client) {
  const { data, error } = await client.functions.invoke('delete-account');
  if (!isAccountDeletionConfirmed(error, data)) {
    console.error('Aurora: a exclusão segura da conta não foi confirmada.', error);
    return false;
  }
  return true;
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
    return 'Essa senha não atende aos requisitos de segurança do serviço. Escolha outra senha e tente novamente.';
  }
  if (code === 'invalid_email') {
    return 'Confira se o e-mail foi digitado corretamente e tente novamente.';
  }
  if (code === 'over_email_send_rate_limit' || error?.status === 429) {
    return 'Muitas tentativas de cadastro em pouco tempo. Aguarde alguns minutos e tente novamente.';
  }
  return genericAuthError();
}

async function loadVaultRecord(client, userId) {
  const { data, error } = await client
    .from('user_keys')
    .select('key_version,salt,password_wrap,recovery_wrap')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error('O cofre criptografado não pôde ser carregado. Nenhum dado foi exibido.');
  return data;
}

function sameJsonValue(a, b) {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const keysA = Object.keys(a).sort();
  const keysB = Object.keys(b).sort();
  return keysA.length === keysB.length
    && keysA.every((key, index) => keysA[index] === keysB[index] && sameJsonValue(a[key], b[key]));
}

async function unlockAccountData(client, user, knownPassword, root) {
  const record = await loadVaultRecord(client, user.id);
  const existingRows = await loadAccountSlices(client, user.id);
  if (!record) {
    if (existingRows.size) {
      throw new Error('Há dados remotos sem a chave criptográfica necessária. Eles foram preservados e não serão exibidos nem substituídos.');
    }

    let password = knownPassword;
    while (!password) {
      const { form, message } = createAccountForm(root, {
        title: 'Criar seu cofre privado',
        description: 'Informe a senha da conta para criar as chaves criptográficas. A senha não é armazenada pelo Aurora.',
        mode: 'setup-vault',
      });
      const result = await new Promise((resolve) => {
        form.addEventListener('submit', (event) => {
          event.preventDefault();
          resolve({ password: form.elements.password.value, message });
        }, { once: true });
      });
      if (result.password.length < 12 || result.password.length > 72) {
        result.message.textContent = 'Use uma senha entre 12 e 72 caracteres.';
        continue;
      }
      password = result.password;
    }

    const vault = await createVault(password, user.id);
    password = '';
    const confirmation = vault.recoveryKey.slice(-6);
    for (;;) {
      const { form, message, submit } = createAccountForm(root, {
        title: 'Guarde sua chave de recuperação',
        description: 'Este cofre antigo guarda dados cifrados. Novos dados ficam na sua conta; use a importação para trazer o conteúdo antigo.',
        mode: 'confirm-recovery',
        recoveryKey: vault.recoveryKey,
      });
      const result = await new Promise((resolve) => {
        form.addEventListener('submit', (event) => {
          event.preventDefault();
          resolve({ confirmation: form.elements.confirmKey.value, message, submit });
        }, { once: true });
      });
      if (result.confirmation !== confirmation) {
        result.message.textContent = 'Os caracteres não correspondem. Guarde a chave e tente novamente.';
        continue;
      }
      setSubmitPending(result.submit, true);
      const { error } = await client.from('user_keys').insert({
        user_id: user.id,
        ...vault.record,
      });
      if (error) {
        const saved = await loadVaultRecord(client, user.id);
        if (saved && sameJsonValue(saved, vault.record)) return vault.dataKey;
        if (saved) {
          throw new Error('Um cofre foi criado em outra sessão. Recarregue a página e desbloqueie seus dados com a senha ou a chave de recuperação.');
        }
        setSubmitPending(result.submit, false);
        result.message.textContent = 'Não foi possível confirmar o salvamento das chaves. A conta não será aberta; tente novamente.';
        continue;
      }
      return vault.dataKey;
    }
  }

  if (knownPassword) {
    try {
      return await unlockVaultWithPassword(knownPassword, record, user.id);
    } catch {
      knownPassword = '';
    }
  }

  let mode = 'unlock-password';
  let message = '';
  for (;;) {
    const config = mode === 'unlock-password'
      ? {
        title: 'Desbloquear seus dados',
        description: 'Informe a senha que foi usada para criar o cofre criptografado.',
        mode,
        links: [{ label: 'Usar chave de recuperação', target: 'unlock-recovery' }],
      }
      : {
        title: 'Recuperar acesso aos dados',
        description: 'Informe a chave de recuperação que foi exibida quando o cofre foi criado.',
        mode,
        links: [{ label: 'Tentar a senha do cofre', target: 'unlock-password' }],
      };
    const { form, message: status } = createAccountForm(root, config);
    status.textContent = message;
    const result = await new Promise((resolve) => {
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        resolve({
          password: form.elements.password?.value || '',
          recoveryKey: form.elements.recoveryKey?.value || '',
        });
      }, { once: true });
      root.querySelectorAll('button[data-account-mode], a[data-account-mode]').forEach((control) => {
        control.addEventListener('click', () => resolve({ nextMode: control.dataset.accountMode }), { once: true });
      });
    });
    if (result.nextMode) {
      mode = result.nextMode;
      message = '';
      continue;
    }
    try {
      return mode === 'unlock-password'
        ? await unlockVaultWithPassword(result.password, record, user.id)
        : await unlockVaultWithRecovery(result.recoveryKey.trim(), record, user.id);
    } catch {
      message = 'Não foi possível desbloquear os dados. Confira a senha ou a chave e tente novamente.';
    }
  }
}

export async function requireAccount(root, initialMode = 'login', {
  allowPublicReturn = false,
  onPublicReturn,
  onAccountDeleted,
  initialNotice = '',
  initialNoticeTone = '',
} = {}) {
  const callbackErrorMessage = authCallbackErrorMessage(location);
  if (callbackErrorMessage) {
    const callbackUrl = new URL(location.href);
    callbackUrl.searchParams.delete('error');
    callbackUrl.searchParams.delete('error_code');
    callbackUrl.searchParams.delete('error_description');
    history.replaceState(null, '', `${callbackUrl.pathname}${callbackUrl.search}${callbackUrl.hash}`);
  }
  const passwordRecoveryRequested = isPasswordRecoveryCallback(location)
    || initialMode === 'update-password';
  if (!hasSupabaseConfig()) {
    const isDevelopment = import.meta.env?.DEV === true;
    showConfigurationError(
      root,
      isDevelopment
        ? 'O ambiente de desenvolvimento não encontrou as configurações necessárias para acessar a conta.'
        : 'O acesso à conta está temporariamente indisponível. Tente novamente mais tarde.',
      isDevelopment ? 'Configuração necessária' : 'Acesso indisponível',
      false,
      isDevelopment,
    );
    return null;
  }

  let client;
  try {
    client = await getAccountClient();
  } catch (error) {
    console.error('Aurora: o cliente de contas não pôde ser inicializado.', error);
    showConfigurationError(root, 'Não foi possível carregar o serviço seguro de contas. Verifique a conexão e tente novamente.', 'A conta ainda não está configurada', allowPublicReturn);
    return null;
  }

  const authPage = async (mode, email = '', notice = '', signupProfile = null, noticeTone = '') => {
    const copy = {
      login: ['Entrar na sua conta', 'Entre para continuar com seus registros.', [{ prompt: 'Ainda não tem uma conta?', label: 'Criar conta', target: 'signup' }, { label: 'Esqueci minha senha', target: 'recovery' }]],
      'signup-profile': ['Seu perfil', 'Comece com seus dados básicos.', [{ prompt: 'Já tem uma conta?', label: 'Entrar', target: 'login' }]],
      'signup-access': ['Crie seu acesso', 'Informe um e-mail que você acessa, escolha uma senha e aceite os documentos. Você poderá entrar assim que criar a conta.', [{ label: 'Voltar aos seus dados', target: 'signup-profile' }, { prompt: 'Já tem uma conta?', label: 'Entrar', target: 'login' }]],
      'oauth-profile': ['Complete seu perfil', 'Para criar sua conta, informe seus dados e aceite os documentos.', [{ label: 'Cancelar e sair', target: 'oauth-profile-cancel' }]],
      recovery: ['Recuperar acesso', 'Enviaremos instruções para redefinir sua senha ao e-mail informado.', [{ label: 'Voltar para entrar', target: 'login' }]],
      'update-password': ['Atualizar senha', 'Escolha uma senha forte e exclusiva para sua conta. A redefinição não altera a senha do cofre antigo; para importar dados cifrados, use a senha original do cofre.', [{ label: 'Solicitar outro link', target: 'recovery' }]],
      'legal-consent': ['Termos atualizados', 'Para continuar usando o Aurora, leia e aceite a versão atualizada dos documentos. Se preferir recusar, você poderá revisar as etapas para confirmar a exclusão permanente da conta.', []],
      'delete-account': ['Confirmar exclusão da conta', 'Você recusou os documentos. A conta e todos os dados associados serão excluídos permanentemente. Digite EXCLUIR abaixo para confirmar; essa ação não pode ser desfeita.', [{ label: 'Voltar e aceitar os termos', target: 'legal-consent' }]],
    }[mode];
    if (accountPathForMode(mode)) {
      navigateToAccountMode(mode, {
        replace: mode === 'update-password' && isPasswordRecoveryCallback(location),
      });
    }
    const publicAuthMode = ['login', 'signup-profile', 'signup-access', 'recovery', 'update-password'].includes(mode);
    const links = [...copy[2]];
    if (allowPublicReturn && publicAuthMode) {
      links.push({ label: 'Voltar à demonstração', target: 'landing' });
    }
    const { form, message, submit } = createAccountForm(root, {
      title: copy[0],
      description: copy[1],
      mode,
      email,
      signupProfile,
      links,
      includePublicHeader: allowPublicReturn && publicAuthMode,
      noticeTone,
    });
    message.textContent = notice;
    const readSignupProfile = () => {
      if (mode !== 'signup-profile' && mode !== 'oauth-profile') return null;
      const birthDate = form.elements.birthDate.value;
      const birthdayReference = birthDate ? createBirthdayReference(birthDate) : null;
      return {
        name: form.elements.name.value.trim(),
        preferredName: form.elements.preferredName.value.trim(),
        birthDate,
        age: birthdayReference?.ageAtReference ?? null,
        birthdayReference,
      };
    };
    const result = await new Promise((resolve) => {
      const finish = (value) => {
        window.removeEventListener('popstate', onPopState);
        resolve(value);
      };
      const onPopState = () => {
        const nextMode = accountModeFromLocation(location);
        if (nextMode) {
          finish({
            nextMode,
            email: form.elements.email?.value.trim() || email,
            signupProfile: readSignupProfile(),
          });
        } else if (allowPublicReturn && isPublicLandingLocation(location)) {
          finish({ nextMode: 'landing' });
        }
      };
      window.addEventListener('popstate', onPopState);
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const profile = readSignupProfile();
        finish({
          email: form.elements.email?.value.trim() || email,
          password: form.elements.password?.value || '',
          confirmEmail: form.elements.confirmEmail?.value.trim() || '',
          confirmPassword: form.elements.confirmPassword?.value || '',
          rememberSession: form.elements.rememberSession?.checked === true,
          signupProfile: profile,
          termsAccepted: mode === 'signup-access' || mode === 'legal-consent' || mode === 'oauth-profile'
            ? form.elements.termsAccepted.checked
            : false,
          deleteConfirmation: mode === 'delete-account' ? form.elements.deleteConfirmation.value : '',
          submit,
          message,
        });
      }, { once: true });
      root.querySelector('[data-account-refuse-terms]')?.addEventListener('click', () => {
        finish({ nextMode: 'delete-account' });
      }, { once: true });
      root.querySelectorAll('button[data-account-mode], a[data-account-mode]').forEach((control) => {
        control.addEventListener('click', () => {
          const nextMode = control.dataset.accountMode;
          if (accountPathForMode(nextMode)) navigateToAccountMode(nextMode);
          finish({
            nextMode,
            email: form.elements.email?.value.trim() || email,
            signupProfile: readSignupProfile(),
          });
        }, { once: true });
      });
      form.querySelectorAll('button[data-oauth-provider]').forEach((control) => {
        control.addEventListener('click', () => finish({
          oauthProvider: control.dataset.oauthProvider,
          rememberSession: form.elements.rememberSession?.checked === true,
          submit,
          message,
          providerButtons: Array.from(form.querySelectorAll('button[data-oauth-provider]')),
        }), { once: true });
      });
    });
    return result;
  };

  const deleteAccountAfterRefusal = async (user) => {
    let message = '';
    for (;;) {
      const result = await authPage('delete-account', user.email, message);
      if (result.nextMode === 'legal-consent') return false;
      if (result.deleteConfirmation !== 'EXCLUIR') {
        message = 'Digite EXCLUIR exatamente como aparece para confirmar a exclusão permanente.';
        continue;
      }
      setSubmitPending(result.submit, true);
      if (!await requestAccountDeletion(client)) {
        setSubmitPending(result.submit, false);
        message = 'A exclusão da conta não foi confirmada. Você poderá criar uma conta nova com este e-mail assim que a exclusão for concluída. Tente novamente ou volte para aceitar os termos.';
        continue;
      }

      try {
        const registration = await navigator.serviceWorker?.getRegistration();
        const subscription = await registration?.pushManager?.getSubscription();
        if (subscription && !(await subscription.unsubscribe())) {
          throw new Error('O navegador não confirmou a remoção da inscrição Push local.');
        }
      } catch (pushError) {
        console.error('Aurora: a conta foi excluída, mas a inscrição Push local não foi removida.', pushError);
      }
      const { error: signOutError } = await client.auth.signOut({ scope: 'local' });
      if (signOutError) console.error('Aurora: a conta foi excluída, mas a sessão local não foi encerrada.', signOutError);
      onAccountDeleted?.();
      return true;
    }
  };

  const requireCurrentProfile = async (user) => {
    if (!hasSocialIdentity(user) || hasCompleteProfile(user)) return user;
    const metadata = user.user_metadata || {};
    const providerName = metadata.full_name || metadata.name || '';
    const profileDraft = {
      name: metadata.name || providerName,
      preferredName: metadata.preferred_name || providerName,
    };
    let message = '';
    for (;;) {
      const result = await authPage('oauth-profile', user.email, message, profileDraft);
      if (result.nextMode === 'oauth-profile-cancel') {
        const { error } = await client.auth.signOut({ scope: 'local' });
        if (error) throw new Error('Não foi possível encerrar a sessão. Tente novamente antes de compartilhar este dispositivo.');
        if (allowPublicReturn) onPublicReturn?.();
        else location.reload();
        return null;
      }
      const profile = result.signupProfile;
      if (!profile || !profile.name || !profile.preferredName
        || !profile.birthdayReference) {
        message = 'Preencha seus dados e informe uma data de nascimento válida para continuar.';
        continue;
      }
      if (profile.age < MINIMUM_ACCOUNT_AGE) {
        message = `É necessário ter pelo menos ${MINIMUM_ACCOUNT_AGE} anos para criar uma conta.`;
        continue;
      }
      if (!result.termsAccepted) {
        message = 'Marque a caixa para aceitar os Termos de Uso e a Política de Privacidade.';
        continue;
      }

      setSubmitPending(result.submit, true);
      const { data, error } = await client.auth.updateUser({
        data: {
          name: profile.name.slice(0, 50),
          preferred_name: profile.preferredName.slice(0, 50),
          age: profile.age,
          birthday_month: profile.birthdayReference.month,
          birthday_day: profile.birthdayReference.day,
          birthday_reference_date: profile.birthdayReference.referenceDate,
          ...createLegalConsentMetadata(),
        },
      });
      if (error || !data.user) {
        console.error('Aurora: não foi possível salvar o perfil e o aceite da conta social.', error);
        setSubmitPending(result.submit, false);
        message = 'Não foi possível salvar seus dados e seu aceite. A conta não será aberta; tente novamente.';
        continue;
      }
      return data.user;
    }
  };

  const requireCurrentLegalConsent = async (user) => {
    user = await requireCurrentProfile(user);
    if (!user || hasCurrentLegalConsent(user)) return user;
    let message = '';
    for (;;) {
      const result = await authPage('legal-consent', user.email, message);
      if (result.nextMode === 'delete-account') {
        if (await deleteAccountAfterRefusal(user)) return null;
        continue;
      }
      if (!result.termsAccepted) {
        message = 'Marque a caixa para aceitar os documentos ou escolha recusar para revisar a exclusão da conta.';
        continue;
      }

      setSubmitPending(result.submit, true);
      const consent = createLegalConsentMetadata();
      const { data, error } = await client.auth.updateUser({ data: consent });
      if (error || !data.user) {
        console.error('Aurora: o aceite atualizado não pôde ser salvo na conta.', error);
        setSubmitPending(result.submit, false);
        message = 'Não foi possível registrar seu aceite. A conta não será aberta; tente novamente.';
        continue;
      }
      return data.user;
    }
  };

  try {
    const { data: { session }, error } = await client.auth.getSession();
    if (error) throw error;
    if (session?.user) {
      const { data: { user }, error: userError } = await client.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error(genericAuthError());
      if (passwordRecoveryRequested) {
        for (;;) {
          const result = await authPage('update-password');
          if (result.nextMode) continue;
          if (!meetsPasswordRequirements(result.password)) {
            result.message.textContent = 'A senha deve ter entre 6 e 72 caracteres, com letras minúsculas e maiúsculas, um dígito e um símbolo.';
            continue;
          }
          if (result.password !== result.confirmPassword) {
            result.message.textContent = 'As senhas não coincidem.';
            continue;
          }
          setSubmitPending(result.submit, true);
          const { error: updateError } = await client.auth.updateUser({ password: result.password });
          if (updateError) {
            setSubmitPending(result.submit, false);
            result.message.textContent = genericAuthError();
            continue;
          }
          const callbackUrl = new URL(location.href);
          ['type', 'code', 'error', 'error_code', 'error_description'].forEach((key) => {
            callbackUrl.searchParams.delete(key);
          });
          history.replaceState(null, '', `${callbackUrl.pathname}${callbackUrl.search}`);
          const { error: signOutError } = await client.auth.signOut({ scope: 'local' });
          if (signOutError) {
            throw new Error('Sua senha foi atualizada, mas não foi possível encerrar a sessão. Atualize a página e entre com a nova senha.');
          }
          return requireAccount(root, 'login', {
            allowPublicReturn,
            onPublicReturn,
            onAccountDeleted,
            initialNotice: 'Senha atualizada. Entre usando sua nova senha.',
            initialNoticeTone: 'success',
          });
        }
      }
      const currentUser = await requireCurrentLegalConsent(user);
      if (!currentUser) return null;
      return {
        client,
        user: currentUser,
      };
    }

    let mode = initialMode === 'signup'
      ? 'signup-profile'
      : ['signup-profile', 'signup-access', 'recovery', 'update-password'].includes(initialMode)
        ? initialMode
        : 'login';
    let email = '';
    let message = callbackErrorMessage || initialNotice;
    if (!callbackErrorMessage && mode === 'update-password' && !passwordRecoveryRequested) {
      message = 'Para definir uma nova senha, solicite um link de recuperação pelo seu e-mail.';
    }
    let messageTone = callbackErrorMessage ? '' : initialNoticeTone;
    let profileDraft = null;
    for (;;) {
      let authenticatedUser = null;
      const result = await authPage(mode, email, message, profileDraft, messageTone);
      if (result.nextMode) {
        if (result.nextMode === 'landing' && allowPublicReturn) {
          onPublicReturn?.();
          return null;
        }
        email = result.email || email;
        profileDraft = result.signupProfile || profileDraft;
        mode = result.nextMode === 'signup' ? 'signup-profile' : result.nextMode;
        message = '';
        messageTone = '';
        continue;
      }
      email = result.email || email;
      if (result.oauthProvider) {
        if (result.oauthProvider !== 'google') {
          throw new Error('Provedor de acesso não permitido.');
        }
        setRememberSession(result.rememberSession);
        setSubmitPending(result.submit, true);
        result.providerButtons.forEach((button) => { button.disabled = true; });
        let oauthError;
        try {
          if (isNativeApp()) {
            const { startNativeOAuth } = await import('./native-auth.js');
            await startNativeOAuth(client, result.oauthProvider);
          } else {
            const oauthResult = await client.auth.signInWithOAuth({
              provider: result.oauthProvider,
              options: { redirectTo: getOAuthRedirectUrl(location.origin) },
            });
            oauthError = oauthResult.error;
          }
        } catch (error) {
          oauthError = error;
        }
        if (oauthError) {
          console.error(`Aurora: não foi possível iniciar o acesso por ${result.oauthProvider}.`, oauthError);
          setSubmitPending(result.submit, false);
          result.providerButtons.forEach((button) => { button.disabled = false; });
          message = 'Não foi possível iniciar o acesso. Verifique se o provedor está habilitado em Authentication → Sign In / Providers no Supabase.';
          continue;
        }
        return null;
      }
      if (mode === 'recovery') {
        setSubmitPending(result.submit, true);
        const { error: recoveryError } = await client.auth.resetPasswordForEmail(email, {
          redirectTo: isNativeApp()
            ? NATIVE_AUTH_REDIRECT_URL
            : `${location.origin}${location.pathname}`,
        });
        message = recoveryError
          ? passwordRecoveryErrorMessage(recoveryError)
          : 'Se houver uma conta vinculada a esse e-mail, você receberá instruções para redefinir a senha. Confira também o spam e aguarde alguns minutos.';
        messageTone = recoveryError ? '' : 'success';
        result.message.textContent = message;
        result.message.dataset.tone = messageTone;
        result.message.setAttribute('role', recoveryError ? 'alert' : 'status');
        result.message.setAttribute('aria-live', recoveryError ? 'assertive' : 'polite');
        setSubmitPending(result.submit, false);
        continue;
      }
      if (mode === 'update-password') {
        message = 'Este link não está mais ativo. Solicite novas instruções para redefinir sua senha.';
        mode = 'recovery';
        continue;
      }
      if (mode === 'signup-profile') {
        const birthdayReference = result.signupProfile?.birthdayReference;
        if (!result.signupProfile || !result.signupProfile.name || !result.signupProfile.preferredName
          || !birthdayReference) {
          message = 'Preencha seus dados e informe uma data de nascimento válida para criar uma conta.';
          continue;
        }
        if (result.signupProfile.age < MINIMUM_ACCOUNT_AGE) {
          message = `É necessário ter pelo menos ${MINIMUM_ACCOUNT_AGE} anos para criar uma conta.`;
          continue;
        }
        profileDraft = result.signupProfile;
        mode = 'signup-access';
        message = '';
        continue;
      }
      if (mode === 'signup-access') {
        if (!profileDraft || !profileDraft.birthdayReference) {
          mode = 'signup-profile';
          message = 'Confirme seus dados e a data de nascimento para continuar o cadastro.';
          continue;
        }
        if (!result.termsAccepted) {
          message = 'Leia e aceite os Termos de Uso e a Política de Privacidade para criar uma conta.';
          continue;
        }
        if (result.confirmEmail.toLowerCase() !== email.toLowerCase()) {
          message = 'Os endereços de e-mail não coincidem. Confira e digite ambos novamente.';
          continue;
        }
        if (!meetsPasswordRequirements(result.password)) {
          message = 'A senha precisa ter de 6 a 72 caracteres, com letras minúsculas e maiúsculas, um dígito e um símbolo.';
          continue;
        }
        setSubmitPending(result.submit, true);
        const { data, error: signupError } = await client.auth.signUp({
          email,
          password: result.password,
          options: {
            emailRedirectTo: `${location.origin}${location.pathname}`,
            data: {
              name: profileDraft.name.slice(0, 50),
              preferred_name: profileDraft.preferredName.slice(0, 50),
              age: profileDraft.age,
              birthday_month: profileDraft.birthdayReference.month,
              birthday_day: profileDraft.birthdayReference.day,
              birthday_reference_date: profileDraft.birthdayReference.referenceDate,
              ...createLegalConsentMetadata(),
            },
          },
        });
        if (signupError) {
          setSubmitPending(result.submit, false);
          message = signupErrorMessage(signupError, data);
          continue;
        }
        if (!data.session || !data.user) {
          if (isExistingAccountSignup(null, data)) {
            setSubmitPending(result.submit, false);
            message = signupErrorMessage(null, data);
            continue;
          }
          const { error: signOutError } = await client.auth.signOut({ scope: 'local' });
          if (signOutError) throw new Error(genericAuthError());
          setSubmitPending(result.submit, false);
          message = 'Este projeto Supabase está exigindo confirmação de e-mail. No projeto de desenvolvimento, desative Authentication → Providers → Email → Confirm email e tente novamente. Esta tentativa pode ter criado uma conta pendente; confira-a no painel antes de repetir o cadastro.';
          continue;
        }
        authenticatedUser = data.user;
      } else {
        setSubmitPending(result.submit, true);
        if (mode === 'login') setRememberSession(result.rememberSession);
        const { data, error: loginError } = await client.auth.signInWithPassword({
          email,
          password: result.password,
        });
        if (loginError || !data.user) {
          setSubmitPending(result.submit, false);
          if (loginError?.code === 'email_not_confirmed') {
            message = 'Esta conta foi criada quando a confirmação de e-mail estava ativa. Para entrar sem receber link, confirme-a manualmente em Authentication → Users no projeto Supabase; depois, entre novamente. Novos cadastros não exigem confirmação.';
            messageTone = '';
            continue;
          }
          message = loginErrorMessage(loginError);
          messageTone = '';
          continue;
        }
        authenticatedUser = data.user;
      }

      const { data: { user }, error: userError } = authenticatedUser
        ? { data: { user: authenticatedUser }, error: null }
        : await client.auth.getUser();
      if (userError || !user) {
        message = genericAuthError();
        continue;
      }
      const currentUser = await requireCurrentLegalConsent(user);
      if (!currentUser) return null;
      return {
        client,
        user: currentUser,
      };
    }
  } catch (error) {
    let sessionCleared = false;
    if (isRejectedAccountSession(error)) {
      try {
        const { error: signOutError } = await client.auth.signOut({ scope: 'local' });
        if (signOutError) throw signOutError;
        sessionCleared = true;
      } catch (signOutError) {
        console.error('Aurora: não foi possível limpar uma sessão recusada pelo serviço de contas.', signOutError);
      }
    }
    const message = isRejectedAccountSession(error)
      ? sessionCleared
        ? 'Sua sessão expirou. Entre novamente para continuar.'
        : 'Não foi possível validar ou encerrar sua sessão. Confira a conexão e tente novamente; a sessão salva foi mantida.'
      : 'Não foi possível verificar sua sessão. Confira a conexão e tente novamente; a sessão salva foi mantida.';
    showConfigurationError(root, message, 'Não foi possível acessar a conta');
    return null;
  }
}

export async function loadAccountSlices(client, userId) {
  const { data, error } = await client
    .from('user_data')
    .select('slice,data,revision')
    .eq('user_id', userId);
  if (error) throw new Error('Não foi possível carregar os dados sincronizados. Os dados locais não serão usados como substituto.');
  return new Map((data || []).map((row) => [row.slice, row]));
}

export async function saveAccountSlice(client, userId, slice, data, expectedRevision) {
  if (!SLICES.has(slice)) throw new Error('Tipo de dado não permitido para sincronização.');
  if (!isEncryptedEnvelope(data)) {
    throw new Error('O formato criptografado dos dados não é válido para sincronização.');
  }
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
    throw new Error('A revisão dos dados não é válida para sincronização.');
  }
  if (new TextEncoder().encode(JSON.stringify(data)).byteLength > 2_000_000) {
    throw new Error('Esta área excede o limite seguro de sincronização.');
  }
  if (expectedRevision === 0) {
    const { data: inserted, error } = await client
      .from('user_data')
      .insert({ user_id: userId, slice, data, revision: 1 })
      .select('revision')
      .maybeSingle();
    if (error) {
      if (error.code === '23505') throw new AccountConflictError(slice);
      throw new Error('Não foi possível sincronizar esta área.');
    }
    if (!inserted) throw new AccountConflictError(slice);
    return inserted.revision;
  }
  const { data: updated, error } = await client
    .from('user_data')
    .update({ data, revision: expectedRevision + 1, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('slice', slice)
    .eq('revision', expectedRevision)
    .select('revision')
    .maybeSingle();
  if (error) throw new Error('Não foi possível sincronizar esta área.');
  if (!updated) throw new AccountConflictError(slice);
  return updated.revision;
}

export async function importAccountSlices(client, slices) {
  if (!Object.keys(slices).length) throw new Error('A importação não contém áreas válidas.');
  Object.entries(slices).forEach(([slice, data]) => {
    if (!SLICES.has(slice) || !isEncryptedEnvelope(data)) {
      throw new Error('A importação contém uma área ou um envelope criptografado inválido.');
    }
  });
  const { error } = await client.rpc('import_user_slices', { p_slices: slices });
  if (error) throw new Error('A importação não foi concluída. Os dados locais foram preservados.');
  const { data: { user }, error: userError } = await client.auth.getUser();
  if (userError || !user) throw new Error('A sessão expirou; entre novamente para carregar os dados.');
  const rows = await loadAccountSlices(client, user.id);
  if (Object.keys(slices).some((slice) => !rows.has(slice))) {
    throw new Error('A nuvem não confirmou todas as áreas importadas.');
  }
  return rows;
}

function isEncryptedEnvelope(data) {
  return Boolean(data && typeof data === 'object' && data.v === 1
    && Object.keys(data).length === 3
    && typeof data.iv === 'string' && /^[A-Za-z0-9_-]{16}$/.test(data.iv)
    && typeof data.ciphertext === 'string' && /^[A-Za-z0-9_-]{22,}$/.test(data.ciphertext)
    && new TextEncoder().encode(JSON.stringify(data)).byteLength <= 2_000_000);
}

export async function replaceAccountSlices(client, slices, expectedRevisions) {
  const sliceNames = Object.keys(slices);
  if (sliceNames.length !== SLICES.size
    || sliceNames.some((slice) => !SLICES.has(slice) || !isEncryptedEnvelope(slices[slice]))
    || Object.keys(expectedRevisions).length !== sliceNames.length
    || Object.keys(expectedRevisions).some((slice) => !Object.hasOwn(slices, slice))
    || sliceNames.some((slice) => !Number.isSafeInteger(expectedRevisions[slice]) || expectedRevisions[slice] < 0)) {
    throw new Error('O backup contém áreas ou revisões criptografadas inválidas.');
  }
  const { data, error } = await client.rpc('replace_user_slices', {
    p_slices: slices,
    p_revisions: expectedRevisions,
  });
  if (error) {
    if (error.code === '40001' || error.code === '23505') throw new AccountConflictError('backup');
    let remote;
    try {
      const { data: authData, error: authError } = await client.auth.getUser();
      if (authError || !authData.user) throw new Error('A sessão expirou.');
      remote = await loadAccountSlices(client, authData.user.id);
    } catch (verificationError) {
      throw new Error('Não foi possível confirmar se a restauração foi concluída; os dados remotos foram preservados.', { cause: verificationError });
    }
    if (sliceNames.every((slice) => sameJsonValue(remote.get(slice)?.data, slices[slice]))) return remote;
    throw new Error('A restauração não foi concluída. Os dados atuais foram preservados.');
  }
  const rows = new Map((data || []).map((row) => [row.slice, row]));
  if (sliceNames.some((slice) => !rows.has(slice))) {
    throw new Error('A nuvem não confirmou todas as áreas restauradas.');
  }
  return rows;
}

export async function deleteAccountData(client, userId) {
  const { error } = await client.from('user_data').delete().eq('user_id', userId);
  if (error) throw new Error('Não foi possível apagar os dados da conta na nuvem.');
}
