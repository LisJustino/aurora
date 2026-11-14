import { isNativeApp } from '../utils/platform.js';

export function isAppInstalled() {
  return navigator.standalone === true
    || (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches);
}

function isIosSafari() {
  const userAgent = navigator.userAgent || '';
  const isAppleMobile = /iPhone|iPad|iPod/.test(userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return isAppleMobile
    && /Safari/.test(userAgent)
    && !/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo/.test(userAgent);
}

function createNotice(messageText, actionText, onAction, onDismiss) {
  const notice = document.createElement('section');
  notice.id = 'pwa-install-notice';
  notice.className = 'pwa-update-notice';
  notice.setAttribute('role', 'status');
  notice.setAttribute('aria-label', 'Instalar Aurora');

  const message = document.createElement('p');
  message.textContent = messageText;

  const actions = document.createElement('div');
  actions.className = 'pwa-update-actions';
  const dismiss = document.createElement('button');
  dismiss.type = 'button';
  dismiss.className = 'btn back';
  dismiss.textContent = 'Agora não';
  dismiss.addEventListener('click', () => {
    notice.remove();
    onDismiss();
  }, { once: true });

  actions.append(dismiss);
  if (actionText && onAction) {
    const action = document.createElement('button');
    action.type = 'button';
    action.className = 'btn primary';
    action.textContent = actionText;
    action.addEventListener('click', onAction);
    actions.append(action);
  }
  notice.append(message, actions);
  document.body.append(notice);
  return notice;
}

let installPromptStarted = false;
let deferredPrompt = null;
let installNotice = null;
let automaticPromptEligible = false;
let automaticPromptSuppressed = false;
let stopWaitingForEngagement = () => {};

function showInstallNotice(messageText, canInstall) {
  if (installNotice?.isConnected || document.getElementById('pwa-update-notice')) return;
  let notice;
  const onAction = canInstall ? async () => {
    if (!deferredPrompt) return;
    const prompt = deferredPrompt;
    deferredPrompt = null;
    const button = notice.querySelector('button.btn.primary');
    if (button) {
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
    }
    try {
      await prompt.prompt();
      await prompt.userChoice;
    } catch (error) {
      console.warn('O Aurora não conseguiu iniciar a instalação.', error);
    } finally {
      notice.remove();
      if (installNotice === notice) installNotice = null;
    }
  } : null;
  notice = createNotice(messageText, canInstall ? 'Instalar' : null, onAction, () => {
    if (installNotice === notice) installNotice = null;
    automaticPromptSuppressed = true;
  });
  installNotice = notice;
}

export function startPwaInstallPrompt() {
  if (installPromptStarted) return;
  installPromptStarted = true;
  if (isNativeApp() || isAppInstalled()) return;

  const allowAutomaticPrompt = () => {
    automaticPromptEligible = true;
    stopWaitingForEngagement();
    if (deferredPrompt && !automaticPromptSuppressed) {
      showInstallNotice('Instale o Aurora para abrir como um aplicativo.', true);
    }
  };
  const onScroll = () => {
    const hero = document.querySelector('.public-hero');
    if (hero && hero.getBoundingClientRect().bottom <= 0) allowAutomaticPrompt();
  };
  const timer = window.setTimeout(allowAutomaticPrompt, 15000);
  window.addEventListener('scroll', onScroll, { passive: true });
  stopWaitingForEngagement = () => {
    window.clearTimeout(timer);
    window.removeEventListener('scroll', onScroll);
  };
  onScroll();

  const onBeforeInstallPrompt = (event) => {
    event.preventDefault();
    deferredPrompt = event;
    const requestedNotice = installNotice?.isConnected && !installNotice.querySelector('button.btn.primary');
    if (requestedNotice) {
      installNotice.remove();
      installNotice = null;
    }
    if (requestedNotice || (automaticPromptEligible && !automaticPromptSuppressed)) {
      showInstallNotice('Instale o Aurora para abrir como um aplicativo.', true);
    }
  };
  const onAppInstalled = () => {
    deferredPrompt = null;
    automaticPromptSuppressed = true;
    stopWaitingForEngagement();
    installNotice?.remove();
    installNotice = null;
  };

  window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
  window.addEventListener('appinstalled', onAppInstalled);
}

export function showPwaInstallPrompt() {
  if (isNativeApp() || isAppInstalled()) return;
  startPwaInstallPrompt();
  automaticPromptSuppressed = true;
  stopWaitingForEngagement();
  if (isIosSafari()) {
    showInstallNotice('No Safari, toque em Compartilhar > Adicionar à Tela de Início para instalar o Aurora.', false);
    return;
  }
  showInstallNotice(
    deferredPrompt
      ? 'Instale o Aurora para abrir como um aplicativo.'
      : 'Abra o menu do navegador e escolha Adicionar à Tela de Início para instalar o Aurora.',
    Boolean(deferredPrompt),
  );
}
