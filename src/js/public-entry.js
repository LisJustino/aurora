import {
  accountHashForMode,
  isPublicAccountHash,
  isPublicLandingHash,
} from './core/router.js';
import { initializePublicAppearance, handlePublicControl, handlePublicKeydown } from './features/appearance/public-controls.js';
import { renderLanding, renderLandingDemo } from './features/landing/view.js';
import { stopLandingDemo } from './features/landing/demo.js';
import { initializeLegalDialogEvents } from './features/footer/legal-dialog.js';
import { createSuggestionMailto } from './features/footer/suggestions.js';
import { isAppInstalled, startPwaInstallPrompt } from './services/pwa-install.js';

const root = document.getElementById('app');
const routeMeta = document.querySelector('meta[name="aurora-route"]')?.content === 'landing';
const localPreview = Boolean(import.meta.env.DEV && new URLSearchParams(location.search).has('preview'));
let publicPwaCleanup = () => {};
let publicConnectionCleanup = () => {};

function setupKeyboardViewportSafety() {
  if (typeof window === 'undefined' || !('visualViewport' in window)) return;
  if (window.__auroraKeyboardViewportSafety) return;

  const updateKeyboardInset = () => {
    const viewport = window.visualViewport;
    const keyboardInset = Math.max(0, window.innerHeight - viewport.height - (viewport.offsetTop || 0));
    document.documentElement.style.setProperty('--keyboard-offset', `${keyboardInset}px`);

    const active = document.activeElement;
    if (!(active instanceof HTMLElement)) return;
    if (!active.matches('input, textarea, select, [contenteditable="true"]')) return;
    if (keyboardInset > 100) {
      active.scrollIntoView({ block: 'center', inline: 'nearest' });
    }
  };

  window.visualViewport.addEventListener('resize', updateKeyboardInset);
  window.visualViewport.addEventListener('scroll', updateKeyboardInset);
  document.addEventListener('focusin', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (!target.matches('input, textarea, select, [contenteditable="true"]')) return;
    if (!window.visualViewport || window.visualViewport.height >= window.innerHeight) return;
    target.scrollIntoView({ block: 'center', inline: 'nearest' });
  }, true);

  window.__auroraKeyboardViewportSafety = true;
}

setupKeyboardViewportSafety();

function updatePublicConnectionNotice() {
  const existing = document.getElementById('public-offline-notice');
  if (navigator.onLine !== false) {
    existing?.remove();
    return;
  }
  const container = root.querySelector('.public-site, .demo-app');
  if (!container || existing) return;
  const notice = document.createElement('div');
  notice.id = 'public-offline-notice';
  notice.className = 'notice warn offline-banner';
  notice.setAttribute('role', 'status');
  notice.textContent = 'Sem conexão com a internet. A demonstração continua disponível, mas entrar e sincronizar dados exigem conexão.';
  const content = container.querySelector('.public-main, .demo-main');
  if (content) content.before(notice);
  else container.prepend(notice);
}

function showEntryError(rootElement) {
  rootElement.replaceChildren();
  const page = document.createElement('main');
  page.className = 'account-page';
  page.setAttribute('role', 'alert');
  const card = document.createElement('section');
  card.className = 'account-card';
  const heading = document.createElement('h1');
  heading.textContent = 'Não foi possível carregar o Aurora';
  const detail = document.createElement('p');
  detail.className = 'account-description';
  detail.textContent = 'Confira sua conexão e tente atualizar a página.';
  const retry = document.createElement('button');
  retry.className = 'btn primary';
  retry.type = 'button';
  retry.textContent = 'Tentar novamente';
  retry.addEventListener('click', () => window.location.reload());
  card.append(heading, detail, retry);
  page.append(card);
  rootElement.append(page);
}

async function loadApplication(mode = 'login') {
  publicPwaCleanup();
  publicConnectionCleanup();
  stopLandingDemo(root);
  const url = new URL(location.href);
  url.searchParams.delete('aurora-account-mode');
  const hash = accountHashForMode(mode === 'signup' ? 'signup-profile' : mode);
  if (!hash) throw new Error('A rota pública da conta é inválida.');
  url.hash = hash;
  history.pushState(null, '', `${url.pathname}${url.search}${url.hash}`);
  await import('./main.js');
}

function startPublicPwaSupport() {
  if (!import.meta.env.PROD
    || import.meta.env.VITE_PWA_ENABLED === 'false'
    || !('serviceWorker' in navigator)) return;
  let active = true;
  let cleanupRegistration = () => {};
  publicPwaCleanup = () => {
    active = false;
    cleanupRegistration();
  };

  void navigator.serviceWorker.register('/service-worker.js').then((registration) => {
    if (!active) return;
    let announcedWorker = null;
    const installingWorkers = [];

    const renderUpdateNotice = () => {
      const waiting = registration.waiting;
      if (!waiting || !navigator.serviceWorker.controller || waiting === announcedWorker) return;
      announcedWorker = waiting;
      document.getElementById('pwa-update-notice')?.remove();

      const notice = document.createElement('section');
      notice.id = 'pwa-update-notice';
      notice.className = 'pwa-update-notice';
      notice.setAttribute('role', 'status');
      notice.setAttribute('aria-label', 'Atualização do Aurora disponível');
      const message = document.createElement('p');
      message.textContent = 'Nova versão disponível — atualizar quando terminar o que estiver fazendo.';
      const actions = document.createElement('div');
      actions.className = 'pwa-update-actions';
      const dismiss = document.createElement('button');
      dismiss.type = 'button';
      dismiss.className = 'btn back';
      dismiss.textContent = 'Agora não';
      dismiss.addEventListener('click', () => notice.remove());
      const apply = document.createElement('button');
      apply.type = 'button';
      apply.className = 'btn primary';
      apply.textContent = 'Atualizar';
      apply.addEventListener('click', () => {
        const currentWorker = registration.waiting;
        if (!currentWorker) {
          notice.remove();
          return;
        }
        apply.disabled = true;
        apply.setAttribute('aria-busy', 'true');
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          window.location.reload();
        }, { once: true });
        currentWorker.postMessage({ type: 'SKIP_WAITING' });
      });
      actions.append(dismiss, apply);
      notice.append(message, actions);
      document.body.append(notice);
    };

    const onUpdateFound = () => {
      const installing = registration.installing;
      if (!installing) return;
      const onStateChange = () => {
        if (active && installing.state === 'installed') renderUpdateNotice();
      };
      installing.addEventListener('statechange', onStateChange);
      installingWorkers.push([installing, onStateChange]);
    };
    const checkForUpdate = () => {
      if (document.visibilityState !== 'hidden') {
        void registration.update().catch((error) => {
          console.warn('O Aurora não conseguiu verificar se há uma atualização disponível.', error);
        });
      }
    };

    registration.addEventListener('updatefound', onUpdateFound);
    window.addEventListener('focus', checkForUpdate);
    document.addEventListener('visibilitychange', checkForUpdate);
    cleanupRegistration = () => {
      registration.removeEventListener('updatefound', onUpdateFound);
      window.removeEventListener('focus', checkForUpdate);
      document.removeEventListener('visibilitychange', checkForUpdate);
      installingWorkers.forEach(([worker, listener]) => worker.removeEventListener('statechange', listener));
      document.getElementById('pwa-update-notice')?.remove();
    };
    renderUpdateNotice();
  }).catch((error) => {
    if (active) console.error('O Aurora não conseguiu iniciar o suporte offline.', error);
  });
}

if (!(root instanceof HTMLElement)) {
  throw new Error('O elemento principal do Aurora não está disponível.');
}

const installedLanding = routeMeta
  && location.hash !== '#demonstracao'
  && isAppInstalled()
  && isPublicLandingHash(location.hash);
if (installedLanding) {
  history.replaceState(null, '', `${location.pathname}${location.search}#inicio`);
}

const publicEntryRoute = routeMeta && (
  isPublicLandingHash(location.hash)
  || isPublicAccountHash(location.hash)
);

if (localPreview || !publicEntryRoute || installedLanding) {
  import('./main.js').catch((error) => {
    console.error('Aurora: não foi possível carregar a aplicação.', error);
    showEntryError(root);
  });
} else {
  if (location.hash === '#landing') {
    history.replaceState(null, '', `${location.pathname}${location.search}`);
  }
  initializePublicAppearance();
  initializeLegalDialogEvents();
  let renderedPublicHash = null;
  const renderPublicRoute = () => {
    renderedPublicHash = location.hash;
    if (location.hash === '#demonstracao') {
      renderLandingDemo(root);
      document.title = 'Demonstração | aurora.';
    } else {
      renderLanding(root);
      document.title = 'aurora. — mais clareza para a sua rotina';
    }
    updatePublicConnectionNotice();
  };
  if (isPublicLandingHash(location.hash)) renderPublicRoute();
  else {
    import('./main.js').catch((error) => {
      console.error('Aurora: não foi possível carregar a tela da conta.', error);
      showEntryError(root);
    });
  }

  if (isPublicLandingHash(location.hash)) {
    startPwaInstallPrompt();
    startPublicPwaSupport();
    window.addEventListener('online', updatePublicConnectionNotice);
    window.addEventListener('offline', updatePublicConnectionNotice);
    publicConnectionCleanup = () => {
      window.removeEventListener('online', updatePublicConnectionNotice);
      window.removeEventListener('offline', updatePublicConnectionNotice);
      document.getElementById('public-offline-notice')?.remove();
    };
    updatePublicConnectionNotice();
  }

  const sessionRestore = isPublicLandingHash(location.hash) ? (async () => {
    try {
      const [{ getAccountClient }, { hasSupabaseConfig }] = await Promise.all([
        import('./services/account-auth.js'),
        import('./data/supabase-client.js'),
      ]);
      if (!hasSupabaseConfig()) return false;
      const client = await getAccountClient();
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      if (!data.session?.user) return false;
      try {
        await loadApplication();
      } catch (error) {
        console.error('Aurora: a sessão existente não pôde ser restaurada.', error);
        showEntryError(root);
      }
      return true;
    } catch (error) {
      console.error('Aurora: não foi possível verificar a sessão salva.', error);
      return false;
    }
  })() : Promise.resolve(false);

  const onPublicNavigation = () => {
    if (isPublicLandingHash(location.hash)) {
      if (renderedPublicHash === location.hash) return;
      renderPublicRoute();
    } else if (isPublicAccountHash(location.hash) && !root.querySelector('form[data-account-mode]')) {
      window.location.reload();
    }
  };
  window.addEventListener('popstate', onPublicNavigation);
  window.addEventListener('hashchange', onPublicNavigation);

  root.addEventListener('click', async (event) => {
    if (handlePublicControl(event, root)) return;
    const action = event.target instanceof Element
      ? event.target.closest('[data-public-action]')?.dataset.publicAction
      : null;
    if (action === 'landing') {
      event.preventDefault();
      const url = new URL(location.href);
      url.hash = '';
      history.pushState(null, '', `${url.pathname}${url.search}`);
      renderPublicRoute();
      return;
    }
    if (action === 'skip') {
      event.preventDefault();
      const main = root.querySelector('main[tabindex="-1"]');
      main?.focus({ preventScroll: true });
      main?.scrollIntoView({ block: 'start' });
      return;
    }
    if (action === 'demo') {
      const url = new URL(location.href);
      url.hash = 'demonstracao';
      history.pushState(null, '', `${url.pathname}${url.search}${url.hash}`);
      renderLandingDemo(root);
      renderedPublicHash = location.hash;
      document.title = 'Demonstração | aurora.';
      window.scrollTo(0, 0);
      updatePublicConnectionNotice();
      return;
    }
    if (action !== 'login' && action !== 'signup') return;

    const buttons = [...root.querySelectorAll('[data-public-action]')].filter((button) => button instanceof HTMLButtonElement);
    buttons.forEach((button) => {
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      const label = button.textContent?.trim();
      if (label && !button.dataset.defaultLabel) button.dataset.defaultLabel = label;
      if (button.dataset.defaultLabel) button.textContent = button.dataset.defaultLabel === 'Entrar' ? 'Entrando…' : 'Criando conta…';
    });

    try {
      const sessionReady = await sessionRestore;
      if (sessionReady) return;
      await loadApplication(action);
    } catch (error) {
      console.error('Aurora: a inicialização segura falhou.', error);
      showEntryError(root);
    } finally {
      buttons.forEach((button) => {
        button.disabled = false;
        button.removeAttribute('aria-busy');
        const defaultLabel = button.dataset.defaultLabel;
        if (defaultLabel) button.textContent = defaultLabel;
      });
    }
  });

  root.addEventListener('submit', (event) => {
    if (!(event.target instanceof HTMLFormElement) || !event.target.matches('[data-footer-suggestion]')) return;
    event.preventDefault();
    const form = event.target;
    try {
      window.location.href = createSuggestionMailto({
        name: form.elements.name.value,
        email: form.elements.email.value,
        message: form.elements.message.value,
      });
    } catch (error) {
      console.error('Aurora: não foi possível preparar a sugestão de e-mail.', error);
      const message = form.querySelector('[data-suggestion-error]');
      if (message) {
        message.textContent = 'Não foi possível preparar o e-mail. Confira os campos e tente novamente.';
        message.hidden = false;
      }
    }
  });

  document.addEventListener('keydown', handlePublicKeydown);
}
