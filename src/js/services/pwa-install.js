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

function createNotice(messageText, actionText, onAction) {
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
  dismiss.addEventListener('click', () => notice.remove(), { once: true });

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

export function startPwaInstallPrompt() {
  if (installPromptStarted) return;
  installPromptStarted = true;
  if (isAppInstalled()) return;

  let deferredPrompt = null;
  let notice = null;
  const showInstallNotice = () => {
    if (notice || document.getElementById('pwa-update-notice')) return;
    notice = createNotice('Instale o Aurora para abrir como um aplicativo.', 'Instalar', async () => {
      if (!deferredPrompt) return;
      const prompt = deferredPrompt;
      deferredPrompt = null;
      const button = notice?.querySelector('button.btn.primary');
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
        notice?.remove();
        notice = null;
      }
    });
  };
  const onBeforeInstallPrompt = (event) => {
    event.preventDefault();
    deferredPrompt = event;
    showInstallNotice();
  };
  const onAppInstalled = () => {
    deferredPrompt = null;
    notice?.remove();
    notice = null;
  };

  window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
  window.addEventListener('appinstalled', onAppInstalled);
  if (isIosSafari()) {
    notice = createNotice('No Safari, toque em Compartilhar > Adicionar à Tela de Início para instalar o Aurora.', null, null);
  }
}
