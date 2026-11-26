import { renderPublicHeader } from '../features/appearance/public-controls.js';
import { renderFooterContent } from '../features/footer/view.js';
import { iconSvg } from '../utils/icons.js';
import {
  PASSWORD_REQUIREMENTS_MESSAGE,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  LEGACY_PASSWORD_MIN_LENGTH,
  validatePassword,
} from './password-policy.js';
import {
  bindPasswordLengthHint,
  create,
  createField,
  createFormGroup,
  setAccountFieldError,
} from './account-form-fields.js';
import { MINIMUM_ACCOUNT_AGE } from './account-consent.js';

const SUCCESS_ART = `<svg class="account-success-svg" viewBox="0 0 120 96" role="presentation" focusable="false">
    <circle class="ok-halo" cx="60" cy="50" r="38"/>
    <circle class="ok-disc" cx="60" cy="50" r="28"/>
    <path class="ok-check" d="M46 51l10 10 19-21"/>
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
  </svg>`,
  preview: `<div class="account-preview">
    <div class="account-preview-shell">
      <div class="account-preview-topbar">
        <span class="account-preview-kicker">Hoje no Aurora</span>
        <span class="account-preview-pill">2 de 3 concluídas</span>
      </div>
      <div class="account-preview-card is-tasks">
        <p class="account-preview-title">Foco do dia</p>
        <ul>
          <li class="is-done"><span></span>Revisar a semana</li>
          <li class="is-done"><span></span>Caminhada de 20 min</li>
          <li class="is-next"><span></span>Planejar o mês</li>
        </ul>
      </div>
      <div class="account-preview-metrics">
        <div class="account-preview-card is-habits">
          <p class="account-preview-title">Hábitos</p>
          <p class="account-preview-stat"><b>5 de 7</b><span>dias nesta semana</span></p>
          <div class="account-preview-progress"><span style="width: 72%"></span></div>
        </div>
        <div class="account-preview-card is-money">
          <p class="account-preview-title">Saldo do mês</p>
          <p class="account-preview-value">R$ 1.240,00</p>
          <span class="account-preview-delta">Sob controle</span>
        </div>
      </div>
    </div>
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
  const eyebrow = create('p', 'account-intro-eyebrow', 'TAREFAS, HÁBITOS, FINANÇAS E CICLO');
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
  const heading = create('h2', 'type-editorial-display', copy.heading);
  const description = create('p', 'account-intro-description', copy.description);
  if (brandLink) intro.append(brandLink);
  if (!introCopy) {
    const topics = create('ul', 'account-intro-topics');
    ['Tarefas', 'Hábitos', 'Finanças', 'Ciclo'].forEach((label) => {
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
  consent.append(
    accepted,
    create('span', 'account-terms-label', 'Li e aceito os Termos de Uso e a Política de Privacidade.'),
  );

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

export function createAccountForm(
  root,
  {
    title,
    description,
    mode,
    recoveryKey,
    email,
    signupProfile,
    links = [],
    includePublicHeader = false,
    noticeTone = '',
  },
) {
  root.replaceChildren();
  document.title = `${title} | aurora.`;
  const { layout, page } = createAccountPageLayout();
  page.dataset.accountMode = mode;
  const activeStage = { 'signup-profile': 1, 'signup-access': 2 }[mode];
  const profileMode = mode === 'signup-profile' || mode === 'oauth-profile';
  if (activeStage) page.dataset.accountStage = String(activeStage);
  if (includePublicHeader) {
    const header = document.createElement('template');
    header.innerHTML = renderPublicHeader({ authMode: mode.startsWith('signup-') ? 'signup' : mode });
    const publicHeader = header.content.firstElementChild;
    const publicActions = publicHeader.querySelector('.public-header-actions');
    page.classList.add('is-public-account');
    if (publicHeader && publicActions) {
      publicHeader.classList.add('account-site-header');
      publicActions.classList.add('account-auth-header-actions');
      layout.insertBefore(publicHeader, page);
    }
  }
  page.append(createAccountIntro(mode, null));
  const card = create('section', 'account-card');
  card.setAttribute('aria-labelledby', 'account-title');
  const brand = create('p', 'account-brand', 'aurora');
  const heading = create('h1', 'type-editorial-title', title);
  heading.id = 'account-title';
  heading.tabIndex = -1;
  const detail = create('p', 'account-description', description);
  const legalEyebrow = mode === 'legal-consent' ? create('p', 'account-legal-eyebrow', 'DOCUMENTOS ATUALIZADOS') : null;
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
    const signupSteps = [
      ['seus dados', 1],
      ['acesso', 2],
    ];
    signupSteps.forEach(([label, index]) => {
      const item = create(
        'li',
        `account-step${index === activeStage ? ' is-current' : index < activeStage ? ' is-complete' : ''}`,
      );
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
    const instructions = create(
      'p',
      'account-security-note',
      'Guarde esta chave fora do Aurora. Ela só é exibida nesta etapa; você pode copiá-la ou baixar um arquivo para consultar depois. Ela será necessária para recuperar os dados se você redefinir a senha ou usar outro dispositivo.',
    );
    const key = create('code', 'account-secret', recoveryKey);
    const keyActions = create('div', 'account-recovery-key-actions');
    const copyKey = create('button', 'btn sm', 'Copiar chave');
    copyKey.type = 'button';
    const downloadKey = create('button', 'btn sm back', 'Baixar chave');
    downloadKey.type = 'button';
    const keyStatus = create('p', 'account-recovery-key-status');
    keyStatus.setAttribute('role', 'status');
    keyStatus.setAttribute('aria-live', 'polite');
    copyKey.addEventListener('click', async () => {
      try {
        if (!navigator.clipboard?.writeText) throw new Error('A cópia automática não está disponível.');
        await navigator.clipboard.writeText(recoveryKey);
        keyStatus.textContent = 'Chave copiada.';
      } catch (error) {
        console.warn('Aurora: não foi possível copiar a chave de recuperação.', error);
        keyStatus.textContent = 'Não foi possível copiar automaticamente. Selecione e copie a chave exibida.';
      }
    });
    downloadKey.addEventListener('click', () => {
      const contents = `Chave de recuperação do Aurora\n\n${recoveryKey}\n\nGuarde este arquivo em local seguro.`;
      const url = URL.createObjectURL(new Blob([contents], { type: 'text/plain;charset=utf-8' }));
      const link = create('a');
      link.href = url;
      link.download = 'aurora-chave-de-recuperacao.txt';
      link.click();
      URL.revokeObjectURL(url);
      keyStatus.textContent = 'Arquivo da chave baixado. Guarde-o em local seguro.';
    });
    keyActions.append(copyKey, downloadKey);
    card.append(instructions, key, keyActions, keyStatus);
  }

  let ageStatus = null;
  if (profileMode) {
    const nameInput = createField(form, 'Nome', 'name', 'text', 'name', signupProfile?.name || '');
    const preferredNameInput = createField(
      form,
      'Nome de preferência (opcional)',
      'preferredName',
      'text',
      'nickname',
      signupProfile?.preferredName || signupProfile?.name?.trim().split(/\s+/)[0] || '',
    );
    nameInput.maxLength = 50;
    preferredNameInput.maxLength = 50;
    preferredNameInput.required = false;
    let preferredNameEdited = Boolean(signupProfile?.preferredName);
    preferredNameInput.addEventListener('input', () => {
      preferredNameEdited = true;
    });
    nameInput.addEventListener('input', () => {
      if (!preferredNameEdited) {
        preferredNameInput.value = nameInput.value.trim().split(/\s+/)[0].slice(0, 50);
      }
    });
    const ageConfirmation = create('label', 'account-age-confirmation');
    const ageConfirmed = create('input');
    ageConfirmed.type = 'checkbox';
    ageConfirmed.name = 'ageConfirmed';
    ageConfirmed.required = true;
    ageConfirmed.checked = signupProfile?.ageConfirmed === true;
    ageConfirmation.append(
      ageConfirmed,
      create('span', '', `Confirmo que tenho pelo menos ${MINIMUM_ACCOUNT_AGE} anos.`),
    );
    form.append(ageConfirmation);
    ageStatus = create('p', 'account-age-status');
    ageStatus.id = 'account-age-status';
    ageStatus.setAttribute('role', 'status');
    ageStatus.setAttribute('aria-live', 'polite');
    ageStatus.hidden = true;
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
    const securityGroup = createFormGroup('account-form-group account-password-group', 'acesso seguro');
    form.append(securityGroup);
    createField(
      form,
      'Senha',
      'password',
      'password',
      'new-password',
      '',
      PASSWORD_REQUIREMENTS_MESSAGE,
      securityGroup,
    );
    form.elements.password.minLength = PASSWORD_MIN_LENGTH;
    form.elements.password.maxLength = PASSWORD_MAX_LENGTH;
    bindPasswordLengthHint(form.elements.password);
    createField(form, 'Confirmar senha', 'confirmPassword', 'password', 'new-password', '', '', securityGroup);
    form.elements.confirmPassword.minLength = PASSWORD_MIN_LENGTH;
    form.elements.confirmPassword.maxLength = PASSWORD_MAX_LENGTH;
    appendLegalConsent(form);
  }
  if (mode === 'legal-consent' || mode === 'oauth-profile') {
    appendLegalConsent(form, { updatedDocuments: mode === 'legal-consent' });
  }
  if (mode === 'delete-account') {
    form.append(
      create(
        'p',
        'account-delete-warning',
        'A exclusão é permanente: sua conta e os dados associados serão apagados e não poderão ser recuperados. Os arquivos de backup que você baixou não são apagados pelo Aurora.',
      ),
    );
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
    createField(form, 'Senha', 'password', 'password', 'current-password', '', '');
    form.elements.password.minLength = LEGACY_PASSWORD_MIN_LENGTH;
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
  if (mode === 'setup-vault' || mode === 'unlock-password')
    form.elements.password.minLength = LEGACY_PASSWORD_MIN_LENGTH;
  if (mode === 'unlock-recovery') createField(form, 'Chave de recuperação', 'recoveryKey', 'text', 'off');
  if (mode === 'confirm-recovery') {
    const acknowledgement = create('label', 'account-recovery-acknowledgement');
    const saved = create('input');
    saved.type = 'checkbox';
    saved.name = 'recoverySaved';
    saved.required = true;
    acknowledgement.append(saved, create('span', '', 'Já guardei a chave de recuperação em um local seguro.'));
    form.append(acknowledgement);
  }
  if (mode === 'update-password') {
    createField(form, 'Nova senha', 'password', 'password', 'new-password', '', PASSWORD_REQUIREMENTS_MESSAGE);
    form.elements.password.minLength = PASSWORD_MIN_LENGTH;
    form.elements.password.maxLength = PASSWORD_MAX_LENGTH;
    bindPasswordLengthHint(form.elements.password);
    createField(form, 'Confirmar nova senha', 'confirmPassword', 'password', 'new-password');
    form.elements.confirmPassword.minLength = PASSWORD_MIN_LENGTH;
    form.elements.confirmPassword.maxLength = PASSWORD_MAX_LENGTH;
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
  const submit = create(
    'button',
    `btn primary${mode === 'delete-account' ? ' danger' : ''}`,
    mode === 'login'
      ? 'Entrar'
      : mode === 'signup-profile'
        ? 'Continuar'
        : mode === 'signup-access'
          ? 'Criar conta'
          : mode === 'legal-consent' || mode === 'oauth-profile'
            ? 'Aceitar e continuar'
            : mode === 'delete-account'
              ? 'Excluir minha conta e meus dados'
              : mode === 'recovery'
                ? 'Enviar instruções'
                : mode === 'update-password'
                  ? 'Atualizar senha'
                  : mode === 'setup-vault'
                    ? 'Criar cofre criptografado'
                    : mode === 'confirm-recovery'
                      ? 'Confirmei que guardei'
                      : 'Confirmar',
  );
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
    new MutationObserver(syncHero).observe(message, {
      attributes: true,
      attributeFilter: ['data-tone'],
      childList: true,
      characterData: true,
      subtree: true,
    });
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
    googleIcon.innerHTML =
      '<path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.75 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.43.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.78.43 3.46 1.18 4.94l3.66-2.84z"/><path fill="#EA4335" d="M12 5.37c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.03 14.97 1 12 1a11 11 0 0 0-9.82 6.06L5.84 9.9C6.71 7.3 9.14 5.37 12 5.37z"/>';
    const googleLabel = create('span', '', mode === 'login' ? 'Entrar com Google' : 'Criar conta com Google');
    googleButton.append(googleIcon, googleLabel);
    googleButton.setAttribute('aria-label', googleLabel.textContent);
    providers.append(googleButton);
    if (mode === 'signup-profile') {
      providers.append(
        create('p', 'account-oauth-note', 'Sua conta Google pode criar uma conta Aurora ou acessar uma já vinculada.'),
      );
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
    let emailWasBlurred = false;
    emailInput.addEventListener('focus', () => {
      emailWasBlurred = false;
      setAccountFieldError(emailInput, '');
    });
    const updateSignupValidity = () => {
      const passwordValidation = validatePassword(password.value);
      const confirmationMatches = confirmPassword.value.length > 0 && confirmPassword.value === password.value;
      confirmPassword.setCustomValidity(
        confirmPassword.value && !confirmationMatches ? 'As senhas não coincidem.' : '',
      );
      const emailIsValid = emailInput.validity.valid;
      setAccountFieldError(
        emailInput,
        emailInput.value && !emailIsValid && emailWasBlurred ? 'Digite um e-mail válido.' : '',
      );
      setAccountFieldError(
        confirmPassword,
        confirmPassword.value && !confirmationMatches ? 'As senhas não coincidem.' : '',
      );
      submit.disabled = !(
        emailIsValid &&
        passwordValidation.valid &&
        confirmationMatches &&
        form.elements.termsAccepted.checked
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
      confirmPassword.setCustomValidity(confirmPassword.value && !passwordsMatch ? 'As senhas não coincidem.' : '');
      setAccountFieldError(confirmPassword, confirmPassword.value && !passwordsMatch ? 'As senhas não coincidem.' : '');
      submit.disabled = !validatePassword(password.value).valid || !passwordsMatch;
    };
    form.addEventListener('input', updatePasswordValidity);
    form.addEventListener('change', updatePasswordValidity);
    updatePasswordValidity();
  } else if (profileMode) {
    let ageConfirmationTouched = Boolean(form.elements.ageConfirmed.checked);
    const updateProfileValidity = () => {
      const ageConfirmed = form.elements.ageConfirmed.checked;
      ageStatus.hidden = ageConfirmed || !ageConfirmationTouched;
      ageStatus.textContent =
        ageConfirmed || !ageConfirmationTouched
          ? ''
          : `É necessário confirmar que você tem pelo menos ${MINIMUM_ACCOUNT_AGE} anos.`;
      ageStatus.dataset.state = ageConfirmed ? 'eligible' : ageConfirmationTouched ? 'invalid' : 'pristine';
      submit.disabled = !(
        form.elements.name.value.trim() &&
        ageConfirmed &&
        (mode !== 'oauth-profile' || form.elements.termsAccepted.checked)
      );
    };
    form.addEventListener('input', updateProfileValidity);
    form.addEventListener('change', (event) => {
      if (event.target === form.elements.ageConfirmed) ageConfirmationTouched = true;
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
      submit.disabled = Array.from(form.elements).some((field) => field.willValidate && !field.validity.valid);
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

export function showConfigurationError(
  root,
  message,
  title = 'A conta ainda não está configurada',
  includePublicHeader = false,
  configGuide = false,
) {
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
  const heading = create('h1', 'type-editorial-title', title);
  heading.id = 'account-title';
  heading.tabIndex = -1;
  const detail = create('p', 'account-description', message);
  detail.setAttribute('role', 'alert');
  const security = create(
    'p',
    'account-security-note',
    'Por segurança, seus dados aparecem somente depois que você entra na conta.',
  );
  const showConfigGuide = configGuide && import.meta.env?.DEV === true;
  const retry = create('button', 'btn primary', showConfigGuide ? 'Recarregar após configurar' : 'Tentar novamente');
  retry.type = 'button';
  retry.addEventListener('click', () => location.reload());
  const actions = create('div', 'account-actions');
  actions.append(retry);
  if (showConfigGuide) {
    const guide = create('div', 'account-config-guide');
    const intro = create(
      'p',
      '',
      'No VS Code, na pasta raiz do Aurora, crie o arquivo .env.local. Você pode copiar o .env.example e preencher os dois valores do projeto de teste local:',
    );
    const example = create(
      'pre',
      'account-config-code',
      'VITE_SUPABASE_LOCAL_URL=https://SEU-PROJETO-DE-TESTE.supabase.co\nVITE_SUPABASE_LOCAL_ANON_KEY=SUA_CHAVE_PUBLICA_ANON_OU_PUBLISHABLE',
    );
    const source = create(
      'p',
      '',
      'Busque a Project URL e a chave publicável (anon) em Supabase → Project Settings → API / API Keys.',
    );
    const restart = create(
      'p',
      '',
      'Depois salve, pare o servidor Vite com Ctrl+C, execute npm run dev novamente e recarregue esta página.',
    );
    const warning = create(
      'p',
      'account-config-warning',
      'Use somente a chave pública anon/publishable. Nunca use service_role/secret e não envie esses valores pelo chat.',
    );
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
