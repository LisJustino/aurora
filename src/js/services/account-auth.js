import { getSupabaseClient, hasSupabaseConfig } from '../data/supabase-client.js';
import {
  createVault,
  decryptAccountSlice,
  encryptAccountSlice,
  unlockVaultWithPassword,
  unlockVaultWithRecovery,
} from './crypto-vault.js';
import { renderPublicHeader } from '../features/appearance/public-controls.js';
import { renderFooterContent } from '../features/footer/view.js';
import { calculateAge, createBirthdayReference } from '../features/profile/birthday.js';
import { IC } from '../utils/icons.js';

export { calculateAge };

export const LEGAL_DOCUMENT_VERSION = '1.2';

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

export function meetsPasswordRequirements(value) {
  return typeof value === 'string'
    && value.length >= 6
    && value.length <= 72
    && PASSWORD_REQUIREMENTS.slice(1).every(([, , test]) => test(value));
}

function localDateValue(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function isPasswordRecoveryCallback(locationLike) {
  const queryType = new URLSearchParams(locationLike?.search || '').get('type');
  const hashType = new URLSearchParams((locationLike?.hash || '').replace(/^#/, '')).get('type');
  return queryType === 'recovery' || hashType === 'recovery';
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

const accountIcon = (name, size = 18) => `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${IC[name] || ''}</svg>`;

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
    reveal.innerHTML = accountIcon('eye');
    reveal.addEventListener('click', () => {
      const visible = input.type === 'password';
      input.type = visible ? 'text' : 'password';
      reveal.setAttribute('aria-pressed', String(visible));
      reveal.setAttribute('aria-label', `${visible ? 'Ocultar' : 'Mostrar'} ${labelText.toLowerCase()}`);
      reveal.title = `${visible ? 'Ocultar' : 'Mostrar'} senha`;
      reveal.innerHTML = accountIcon(visible ? 'eyeOff' : 'eye');
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
  container.append(wrapper);
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

function createAccountIntro() {
  const intro = create('aside', 'account-intro');
  const brand = create('p', 'account-intro-brand', 'aurora');
  const heading = create('h2', '', 'Planeje tarefas, acompanhe hábitos e organize suas finanças.');
  intro.append(brand, heading);
  return intro;
}

function createAccountPageLayout() {
  const layout = create('div', 'account-page');
  const page = create('main', 'account-gate');
  const footer = document.createElement('footer');
  footer.className = 'app-footer site-footer account-gate-footer';
  footer.innerHTML = renderFooterContent({ accountError: true });
  layout.append(page, footer);
  return { layout, page };
}

function appendLegalConsent(form, mode) {
  form.dataset.legalConsent = '';
  const accepted = create('input');
  accepted.type = 'checkbox';
  accepted.name = 'termsAccepted';
  accepted.hidden = true;
  form.append(accepted);

  const openDocuments = create(
    'button',
    'btn ghost account-legal-open',
    mode === 'signup' || mode.startsWith('signup-')
      ? 'Ler Termos de Uso e Política de Privacidade'
      : 'Ler documentos atualizados e aceitar',
  );
  openDocuments.type = 'button';
  openDocuments.dataset.legalConsentOpen = '';
  form.append(openDocuments);
  const readingStatus = create(
    'p',
    'account-legal-reading-status',
    'Os dois documentos serão exibidos juntos; a confirmação fica no final da leitura.',
  );
  readingStatus.dataset.legalReadingStatus = '';
  readingStatus.setAttribute('role', 'status');
  readingStatus.setAttribute('aria-live', 'polite');
  form.append(readingStatus);
  return accepted;
}

function createAccountForm(root, {
  title,
  description,
  mode,
  recoveryKey,
  email,
  signupProfile,
  links = [],
  includePublicHeader = false,
}) {
  root.replaceChildren();
  const { layout, page } = createAccountPageLayout();
  const activeStage = { 'signup-profile': 1, 'signup-access': 2, 'verify-email': 3 }[mode];
  if (activeStage) page.dataset.accountStage = String(activeStage);
  if (includePublicHeader) {
    const header = document.createElement('template');
    header.innerHTML = renderPublicHeader({ authMode: mode.startsWith('signup-') ? 'signup' : mode });
    page.append(header.content.firstElementChild);
  }
  page.append(createAccountIntro());
  const card = create('section', 'account-card');
  card.setAttribute('aria-labelledby', 'account-title');
  const brand = create('p', 'account-brand', 'aurora');
  const heading = create('h1', '', title);
  heading.id = 'account-title';
  heading.tabIndex = -1;
  const detail = create('p', 'account-description', description);
  if (mode === 'login') {
    detail.classList.add('account-security-note');
    const icon = document.createElement('span');
    icon.className = 'account-security-icon';
    icon.innerHTML = accountIcon('shield', 18);
    detail.prepend(icon);
  }
  const form = create('form', 'account-form');
  form.dataset.accountMode = mode;
  form.noValidate = false;
  if (activeStage) {
    const steps = create('ol', 'account-steps');
    steps.setAttribute('aria-label', 'Etapas para criar uma conta');
    const signupSteps = mode === 'verify-email'
      ? [['seus dados', 1], ['acesso', 2], ['e-mail', 3]]
      : [['seus dados', 1], ['acesso', 2]];
    signupSteps.forEach(([label, index]) => {
      const item = create('li', `account-step${index === activeStage ? ' is-current' : index < activeStage ? ' is-complete' : ''}`);
      item.dataset.step = String(index);
      if (index === activeStage) item.setAttribute('aria-current', 'step');
      const number = create('span', 'account-step-number', index === activeStage ? String(index) : index < activeStage ? '✓' : String(index));
      const text = create('span', 'account-step-label', label);
      item.append(number, text);
      steps.append(item);
    });
    card.append(steps);
  }
  card.append(brand, heading, detail);

  if (recoveryKey) {
    const instructions = create('p', 'account-security-note', 'Guarde esta chave fora do Aurora. Ela é exibida somente agora e será necessária para recuperar os dados se a senha for redefinida ou você usar outro dispositivo.');
    const key = create('code', 'account-secret', recoveryKey);
    card.append(instructions, key);
  }

  let ageStatus = null;
  if (mode === 'signup-profile') {
    createField(form, 'Nome', 'name', 'text', 'name', signupProfile?.name || '').maxLength = 50;
    createField(form, 'Como prefere ser chamado(a)?', 'preferredName', 'text', 'nickname', signupProfile?.preferredName || '').maxLength = 50;
    const birthDate = createField(
      form,
      'Data de nascimento',
      'birthDate',
      'date',
      'bday',
      signupProfile?.birthDate || '',
      'Usamos a data para verificar a idade; guardamos somente a idade calculada.',
    );
    birthDate.closest('.account-field')?.classList.add('account-birth-field');
    birthDate.max = localDateValue(new Date());
    ageStatus = create('p', 'account-age-status', 'Informe sua data de nascimento para verificar a maioridade.');
    ageStatus.id = 'account-age-status';
    ageStatus.setAttribute('role', 'status');
    ageStatus.setAttribute('aria-live', 'polite');
    birthDate.setAttribute('aria-describedby', `${birthDate.getAttribute('aria-describedby')} ${ageStatus.id}`.trim());
    form.append(ageStatus);
  }
  if (mode === 'login' || mode === 'signup-access' || mode === 'recovery' || mode === 'verify-email') {
    createField(
      form,
      'E-mail',
      'email',
      'email',
      'email',
      email,
      mode === 'signup-access' ? 'Use um e-mail ao qual você tenha acesso para recuperar sua senha.' : '',
    );
  }
  if (mode === 'signup-access') {
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
    appendLegalConsent(form, 'signup');
  }
  if (mode === 'legal-consent') appendLegalConsent(form, mode);
  if (mode === 'delete-account') {
    form.append(create('p', 'account-delete-warning', 'A exclusão é permanente: sua conta e os dados associados serão apagados e não poderão ser recuperados. Os backups JSON baixados não são apagados pelo Aurora.'));
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
      'mínimo 6 caracteres.',
    );
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
  }

  const message = create('p', 'account-message');
  message.setAttribute('role', 'alert');
  message.setAttribute('aria-live', 'assertive');
  const actions = create('div', 'account-actions');
  const submit = create('button', `btn primary${mode === 'delete-account' ? ' danger' : ''}`, mode === 'login' ? 'Entrar' : mode === 'signup-profile' ? 'Continuar' : mode === 'signup-access' ? 'Criar conta' : mode === 'legal-consent' ? 'Aceitar e continuar' : mode === 'delete-account' ? 'Excluir minha conta e meus dados' : mode === 'recovery' ? 'Enviar instruções' : mode === 'verify-email' ? 'Reenviar e-mail' : mode === 'update-password' ? 'Atualizar senha' : mode === 'setup-vault' ? 'Criar cofre criptografado' : mode === 'confirm-recovery' ? 'Confirmei que guardei' : 'Confirmar');
  submit.type = 'submit';
  actions.append(submit);
  if (mode === 'legal-consent') {
    const refuse = create('button', 'btn ghost account-refuse-terms', 'Recusar e encerrar conta');
    refuse.type = 'button';
    refuse.dataset.accountRefuseTerms = '';
    actions.append(refuse);
  }
  form.append(message, actions);
  card.append(form);

  if (mode === 'signup-access') {
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
      item.dataset.criterion = key;
      checklist.append(item);
    });
    passwordField.append(strength, checklist);
    const updateSignupValidity = () => {
      const value = password.value;
      let passed = 0;
      PASSWORD_REQUIREMENTS.forEach(([key, , test]) => {
        const valid = test(value);
        const item = checklist.querySelector(`[data-criterion="${key}"]`);
        item.classList.toggle('is-met', valid);
        item.setAttribute('aria-label', `${valid ? 'atendido' : 'pendente'}: ${item.textContent}`);
        if (valid) passed += 1;
      });
      const level = passed >= 5 ? 'forte' : passed >= 3 ? 'média' : 'fraca';
      strength.dataset.strength = passed >= 5 ? 'strong' : passed >= 3 ? 'medium' : 'weak';
      strength.querySelector('.account-strength-label b').textContent = level;
      const confirmationMatches = confirmPassword.value.length > 0 && confirmPassword.value === value;
      confirmPassword.setCustomValidity(confirmPassword.value && !confirmationMatches ? 'As senhas não coincidem.' : '');
      submit.disabled = !(
        form.elements.email.checkValidity()
        && meetsPasswordRequirements(value)
        && confirmationMatches
        && form.elements.termsAccepted.checked
      );
    };
    form.addEventListener('input', updateSignupValidity);
    form.addEventListener('change', updateSignupValidity);
    updateSignupValidity();
  } else if (mode === 'signup-profile') {
    const birthDate = form.elements.birthDate;
    const updateProfileValidity = () => {
      const age = calculateAge(birthDate.value);
      if (!birthDate.value) {
        ageStatus.textContent = 'Informe sua data de nascimento para verificar a maioridade.';
        ageStatus.dataset.state = 'pending';
        birthDate.setCustomValidity('');
      } else if (age === null) {
        ageStatus.textContent = 'Informe uma data válida, com até 120 anos.';
        ageStatus.dataset.state = 'invalid';
        birthDate.setCustomValidity('Informe uma data de nascimento válida.');
      } else if (age < 18) {
        ageStatus.textContent = `Você tem ${age} anos. O cadastro está disponível a partir dos 18 anos.`;
        ageStatus.dataset.state = 'invalid';
        birthDate.setCustomValidity('A criação de conta está disponível apenas para pessoas com 18 anos ou mais.');
      } else {
        ageStatus.textContent = `Você tem ${age} anos e é maior de idade.`;
        ageStatus.dataset.state = 'eligible';
        birthDate.setCustomValidity('');
      }
      submit.disabled = !(
        form.elements.name.value.trim()
        && form.elements.preferredName.value.trim()
        && age !== null
        && age >= 18
      );
    };
    form.addEventListener('input', updateProfileValidity);
    form.addEventListener('change', updateProfileValidity);
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
      submit.disabled = !form.checkValidity();
    };
    form.addEventListener('input', updateFormValidity);
    form.addEventListener('change', updateFormValidity);
    updateFormValidity();
  }

  if (links.length) {
    const accountLinks = create('div', 'account-links');
    links.forEach(({ label, target }) => {
      const link = create('button', 'btn ghost account-link', label);
      link.type = 'button';
      link.dataset.accountMode = target;
      accountLinks.append(link);
    });
    card.append(accountLinks);
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
  const brand = create('p', 'account-brand', 'aurora');
  const heading = create('h1', '', title);
  heading.tabIndex = -1;
  const detail = create('p', 'account-description', message);
  detail.setAttribute('role', 'alert');
  const security = create('p', 'account-security-note', 'Por segurança, os dados da conta só aparecem depois de conectar ao Supabase e autenticar.');
  const retry = create('button', 'btn primary', configGuide ? 'Recarregar após configurar' : 'Tentar novamente');
  retry.type = 'button';
  retry.addEventListener('click', () => location.reload());
  if (configGuide) {
    const guide = create('div', 'account-config-guide');
    const isLocalEnvironment = import.meta.env?.DEV === true;
    const intro = create(
      'p',
      '',
      isLocalEnvironment
        ? 'No VS Code, na pasta raiz do Aurora, crie o arquivo .env.local. Você pode copiar o .env.example e preencher os dois valores do projeto de teste local:'
        : 'Configure estas variáveis no ambiente de produção do Cloudflare Pages com os valores do projeto Supabase de produção:',
    );
    const example = create(
      'pre',
      'account-config-code',
      isLocalEnvironment
        ? 'VITE_SUPABASE_LOCAL_URL=https://SEU-PROJETO-DE-TESTE.supabase.co\nVITE_SUPABASE_LOCAL_ANON_KEY=SUA_CHAVE_PUBLICA_ANON_OU_PUBLISHABLE'
        : 'VITE_SUPABASE_PRODUCTION_URL=https://SEU-PROJETO-DE-PRODUCAO.supabase.co\nVITE_SUPABASE_PRODUCTION_ANON_KEY=SUA_CHAVE_PUBLICA_ANON_OU_PUBLISHABLE',
    );
    const source = create('p', '', 'Busque a Project URL e a chave publicável (anon) em Supabase → Project Settings → API / API Keys.');
    const restart = create(
      'p',
      '',
      isLocalEnvironment
        ? 'Depois salve, pare o servidor Vite com Ctrl+C, execute npm run dev novamente e recarregue esta página.'
        : 'Depois de salvar as variáveis, faça um novo deploy para incluí-las no build.',
    );
    const warning = create('p', 'account-config-warning', 'Use somente a chave pública anon/publishable. Nunca use service_role/secret e não envie esses valores pelo chat.');
    const separation = create(
      'p',
      'account-config-warning',
      'Desenvolvimento e produção devem usar projetos Supabase diferentes. Contas e e-mails são independentes entre projetos.',
    );
    guide.append(intro, example, source, restart, warning, separation);
    card.append(brand, heading, detail, guide, security);
  } else {
    card.append(brand, heading, detail, security, retry);
  }
  if (configGuide) card.append(retry);
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
        description: 'Este cofre legado guarda dados cifrados. Novos dados são salvos em tabelas do Supabase; use a importação para migrar o conteúdo antigo.',
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
} = {}) {
  const passwordRecoveryRequested = isPasswordRecoveryCallback(location);
  if (!hasSupabaseConfig()) {
    showConfigurationError(
      root,
      'O Vite iniciou, mas não encontrou as configurações públicas necessárias para conectar ao Supabase.',
      'Conecte o Aurora ao Supabase',
      false,
      true,
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

  const authPage = async (mode, email = '', notice = '', signupProfile = null) => {
    const copy = {
      login: ['Entrar na sua conta', 'Seus dados pessoais são carregados após a autenticação.', [{ label: 'Criar conta', target: 'signup' }, { label: 'Esqueci minha senha', target: 'recovery' }]],
      'signup-profile': ['Seu perfil', 'Comece com seus dados básicos. A data completa será usada apenas para verificar a idade e não será salva.', [{ label: 'Já tenho uma conta', target: 'login' }]],
      'signup-access': ['Crie seu acesso', 'Informe um e-mail que você acessa, escolha uma senha e aceite os documentos. Você poderá entrar assim que criar a conta.', [{ label: 'Voltar aos seus dados', target: 'signup-profile' }, { label: 'Já tenho uma conta', target: 'login' }]],
      recovery: ['Recuperar acesso', 'Enviaremos instruções para redefinir sua senha ao e-mail informado.', [{ label: 'Voltar para entrar', target: 'login' }]],
      'verify-email': ['Confirme seu e-mail pendente', 'Esta conta foi criada enquanto o projeto ainda exigia confirmação. Verifique sua caixa de entrada para liberar o acesso; você pode solicitar outro link abaixo.', [{ label: 'Voltar para entrar', target: 'login' }]],
      'update-password': ['Atualizar senha', 'Escolha uma senha longa e exclusiva para sua conta. A redefinição não altera a senha do cofre legado; para importar dados cifrados, use a senha original dele.', []],
      'legal-consent': ['Termos atualizados', 'Para continuar usando o Aurora, leia e aceite a versão atualizada dos Termos de Uso e da Política de Privacidade. Se recusar, você poderá confirmar a exclusão permanente da conta e dos dados associados.', []],
      'delete-account': ['Confirmar exclusão da conta', 'Você recusou os documentos. A conta e todos os dados associados serão excluídos permanentemente. Digite EXCLUIR abaixo para confirmar; esta ação não pode ser desfeita.', [{ label: 'Voltar e aceitar os termos', target: 'legal-consent' }]],
    }[mode];
    const publicAuthMode = ['login', 'signup-profile', 'signup-access', 'recovery'].includes(mode);
    const links = allowPublicReturn
      ? copy[2].filter(({ target }) => target !== 'login' && target !== 'signup')
      : [...copy[2]];
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
    });
    message.textContent = notice;
    const readSignupProfile = () => {
      if (mode !== 'signup-profile') return null;
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
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const profile = readSignupProfile();
        resolve({
          email: form.elements.email?.value.trim() || email,
          password: form.elements.password?.value || '',
          signupProfile: profile,
          termsAccepted: mode === 'signup-access' || mode === 'legal-consent'
            ? form.elements.termsAccepted.checked
            : false,
          deleteConfirmation: mode === 'delete-account' ? form.elements.deleteConfirmation.value : '',
          submit,
          message,
        });
      }, { once: true });
      root.querySelector('[data-account-refuse-terms]')?.addEventListener('click', () => {
        resolve({ nextMode: 'delete-account' });
      }, { once: true });
      root.querySelectorAll('button[data-account-mode], a[data-account-mode]').forEach((control) => {
        control.addEventListener('click', () => resolve({
          nextMode: control.dataset.accountMode,
          email: form.elements.email?.value.trim() || email,
          signupProfile: readSignupProfile(),
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
      const { error } = await client.functions.invoke('delete-account');
      if (error) {
        console.error('Aurora: a exclusão segura da conta não foi confirmada.', error);
        setSubmitPending(result.submit, false);
        message = 'A conta e os dados não foram declarados como excluídos. O serviço seguro não confirmou a operação. Tente novamente ou volte para aceitar os termos.';
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

  const requireCurrentLegalConsent = async (user) => {
    if (hasCurrentLegalConsent(user)) return user;
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
    if (error) throw new Error(genericAuthError());
    if (session?.user) {
      const { data: { user }, error: userError } = await client.auth.getUser();
      if (userError || !user) throw new Error(genericAuthError());
      if (passwordRecoveryRequested) {
        for (;;) {
          const result = await authPage('update-password');
          if (result.nextMode) continue;
          if (!meetsPasswordRequirements(result.password)) {
            result.message.textContent = 'A senha precisa ter de 6 a 72 caracteres, com letras minúsculas e maiúsculas, um dígito e um símbolo.';
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
          callbackUrl.searchParams.delete('type');
          history.replaceState(null, '', `${callbackUrl.pathname}${callbackUrl.search}`);
          break;
        }
      }
      const currentUser = await requireCurrentLegalConsent(user);
      if (!currentUser) return null;
      return {
        client,
        user: currentUser,
      };
    }

    let mode = initialMode === 'signup' ? 'signup-profile' : 'login';
    let email = '';
    let message = '';
    let profileDraft = null;
    for (;;) {
      const result = await authPage(mode, email, message, profileDraft);
      if (result.nextMode) {
        if (result.nextMode === 'landing' && allowPublicReturn) {
          onPublicReturn?.();
          return null;
        }
        email = result.email || email;
        profileDraft = result.signupProfile || profileDraft;
        mode = result.nextMode === 'signup' ? 'signup-profile' : result.nextMode;
        message = '';
        continue;
      }
      email = result.email || email;
      if (mode === 'verify-email') {
        setSubmitPending(result.submit, true);
        const { error: resendError } = await client.auth.resend({
          type: 'signup',
          email,
          options: { emailRedirectTo: `${location.origin}${location.pathname}` },
        });
        setSubmitPending(result.submit, false);
        message = resendError
          ? genericAuthError()
          : 'Se este endereço puder criar uma conta, enviaremos outro link de confirmação.';
        continue;
      }
      if (mode === 'recovery') {
        setSubmitPending(result.submit, true);
        const { error: recoveryError } = await client.auth.resetPasswordForEmail(email, {
          redirectTo: `${location.origin}${location.pathname}`,
        });
        result.message.textContent = recoveryError ? genericAuthError() : 'Se o endereço estiver cadastrado, as instruções foram enviadas.';
        setSubmitPending(result.submit, false);
        continue;
      }
      if (mode === 'signup-profile') {
        const birthdayReference = result.signupProfile?.birthdayReference;
        if (!result.signupProfile || !result.signupProfile.name || !result.signupProfile.preferredName
          || !birthdayReference || result.signupProfile.age < 18) {
          message = 'Preencha seus dados e confirme que tem 18 anos ou mais para criar uma conta.';
          continue;
        }
        profileDraft = result.signupProfile;
        mode = 'signup-access';
        message = '';
        continue;
      }
      if (mode === 'signup-access') {
        if (!profileDraft || !profileDraft.birthdayReference || profileDraft.age < 18) {
          mode = 'signup-profile';
          message = 'Confirme seus dados e sua idade para continuar o cadastro.';
          continue;
        }
        if (!result.termsAccepted) {
          message = 'Leia e aceite os Termos de Uso e a Política de Privacidade para criar uma conta.';
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
          message = genericAuthError();
          continue;
        }
        if (!data.session || !data.user) {
          message = 'Este projeto Supabase ainda exige confirmação de e-mail. A conta pode já ter sido criada; desative “Confirm email” em Authentication → Providers → Email para liberar o acesso imediato. Enquanto isso, você pode confirmar o link enviado ou pedir outro abaixo.';
          const { error: signOutError } = await client.auth.signOut({ scope: 'local' });
          if (signOutError) throw new Error(genericAuthError());
          mode = 'verify-email';
          continue;
        }
      } else {
        setSubmitPending(result.submit, true);
        const { data, error: loginError } = await client.auth.signInWithPassword({
          email,
          password: result.password,
        });
        if (loginError || !data.user) {
          setSubmitPending(result.submit, false);
          if (loginError?.code === 'email_not_confirmed') {
            message = 'Esta conta ainda aguarda confirmação de e-mail. Confirme o link enviado ou peça outro para liberar o acesso.';
            mode = 'verify-email';
            continue;
          }
          message = genericAuthError();
          continue;
        }
      }

      const { data: { user }, error: userError } = await client.auth.getUser();
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
    try {
      await client.auth.signOut({ scope: 'local' });
    } catch (signOutError) {
      console.error('Aurora: não foi possível limpar a sessão local após falha de autenticação.', signOutError);
    }
    showConfigurationError(root, error instanceof Error ? error.message : genericAuthError());
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
