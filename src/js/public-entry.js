import {
  accountModeFromLocation,
  accountPathForMode,
  canonicalPublicPath,
  isDemoLocation,
  isPublicAccountLocation,
  isPublicLandingLocation,
} from './core/router.js';
import { initializePublicAppearance, handlePublicControl, handlePublicKeydown } from './features/appearance/public-controls.js';
import { renderLanding, renderLandingDemo } from './features/landing/view.js';
import { stopLandingDemo } from './features/landing/demo.js';
import { initializeLegalDialogEvents } from './features/footer/legal-dialog.js';
import { normalizeSuggestionMessage } from './features/footer/suggestions.js';
import { isAppInstalled, showPwaInstallPrompt, startPwaInstallPrompt } from './services/pwa-install.js';
import { isNativeApp } from './utils/platform.js';

const root = document.getElementById('app');
if (isNativeApp()) {
  void import('./services/native-auth.js')
    .then(({ initializeNativeAuthBridge }) => initializeNativeAuthBridge())
    .catch((error) => console.error('O Aurora não conseguiu carregar a autenticação nativa.', error));
  void import('./services/push-notifications.js')
    .catch((error) => console.error('O Aurora não conseguiu preparar as notificações nativas.', error));
}
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
    if (!(active instanceof HTMLElement) || active.closest('#dlg')) return;
    if (!active.matches('input, textarea, select, [contenteditable="true"]')) return;
    if (keyboardInset > 100) {
      active.scrollIntoView({ block: 'center', inline: 'nearest' });
    }
  };

  window.visualViewport.addEventListener('resize', updateKeyboardInset);
  window.visualViewport.addEventListener('scroll', updateKeyboardInset);
  document.addEventListener('focusin', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || target.closest('#dlg')) return;
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

let accountEntryWarmed = false;
function warmAccountEntry() {
  if (accountEntryWarmed || isDemoLocation(location)) return;
  const href = import.meta.env.DEV
    ? '/src/js/account-entry.js'
    : document.querySelector('meta[name="aurora-account-chunk"]')?.content;
  if (!href) return;
  accountEntryWarmed = true;
  const link = document.createElement('link');
  link.rel = 'modulepreload';
  link.href = href;
  document.head.append(link);
}

let mobileCtaCleanup = () => {};
function observeLandingScroll() {
  mobileCtaCleanup();
  const update = () => {
    const cta = root.querySelector('.public-mobile-cta');
    if (!cta) return;
    cta.hidden = !window.matchMedia('(max-width: 700px)').matches || window.scrollY < 420;
  };
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  mobileCtaCleanup = () => {
    window.removeEventListener('scroll', update);
    window.removeEventListener('resize', update);
  };
  update();
}

let applicationLoaded = false;
let publicAccountNavigationPending = false;
let returnToPublicLanding = () => {};
async function loadApplication(mode = 'login') {
  root.removeAttribute('aria-busy');
  publicPwaCleanup();
  publicConnectionCleanup();
  mobileCtaCleanup();
  stopLandingDemo(root);
  const url = new URL(location.href);
  url.searchParams.delete('aurora-account-mode');
  const path = accountPathForMode(mode === 'signup' ? 'signup-profile' : mode);
  if (!path) throw new Error('A rota pública da conta é inválida.');
  const target = new URL(path, url.origin);
  url.pathname = target.pathname;
  url.hash = '';
  url.searchParams.delete('etapa');
  target.searchParams.forEach((value, key) => url.searchParams.set(key, value));
  history.pushState(null, '', `${url.pathname}${url.search}`);
  if (applicationLoaded) {
    const { startAuthenticatedAurora } = await import('./main.js');
    await startAuthenticatedAurora(root, mode, true);
  } else {
    const { startAccountEntry } = await import('./account-entry.js');
    applicationLoaded = await startAccountEntry(root, mode, {
      allowPublicReturn: true,
      onPublicReturn: returnToPublicLanding,
    });
  }
}

function startPublicPwaSupport() {
  if (!import.meta.env.PROD
    || import.meta.env.VITE_PWA_ENABLED === 'false'
    || isNativeApp()
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
    const prepareOfflineStyles = () => {
      const stylesheet = document.querySelector('meta[name="aurora-app-css"]')?.content;
      if (!stylesheet || !active) return;
      void navigator.serviceWorker.ready.then((readyRegistration) => {
        if (active) readyRegistration.active?.postMessage({ type: 'CACHE_PUBLIC_STYLES', url: stylesheet });
      }).catch((error) => {
        console.warn('O Aurora não conseguiu preparar os estilos offline.', error);
      });
    };

    const activateWaitingWorker = () => {
      const waiting = registration.waiting;
      if (!waiting || !navigator.serviceWorker.controller || waiting === announcedWorker) return;
      announcedWorker = waiting;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
      }, { once: true });
      waiting.postMessage({ type: 'SKIP_WAITING' });
    };

    const onUpdateFound = () => {
      const installing = registration.installing;
      if (!installing) return;
      const onStateChange = () => {
        if (active && installing.state === 'installed') activateWaitingWorker();
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
    window.addEventListener('online', prepareOfflineStyles);
    document.addEventListener('visibilitychange', checkForUpdate);
    cleanupRegistration = () => {
      registration.removeEventListener('updatefound', onUpdateFound);
      window.removeEventListener('focus', checkForUpdate);
      window.removeEventListener('online', prepareOfflineStyles);
      document.removeEventListener('visibilitychange', checkForUpdate);
      installingWorkers.forEach(([worker, listener]) => worker.removeEventListener('statechange', listener));
      document.getElementById('pwa-update-notice')?.remove();
    };
    prepareOfflineStyles();
    activateWaitingWorker();
  }).catch((error) => {
    if (active) console.error('O Aurora não conseguiu iniciar o suporte offline.', error);
  });
}

if (!(root instanceof HTMLElement)) {
  throw new Error('O elemento principal do Aurora não está disponível.');
}

function normalizeLegacyRoute() {
  const path = canonicalPublicPath(location);
  if (path) history.replaceState(null, '', path);
}

normalizeLegacyRoute();

const installedLanding = routeMeta
  && !isDemoLocation(location)
  && document.documentElement.dataset.auroraAuthCallback !== 'true'
  && isAppInstalled()
  && isPublicLandingLocation(location);
if (installedLanding) {
  history.replaceState(null, '', `/inicio${location.search}`);
}

const publicEntryRoute = routeMeta && (
  isPublicLandingLocation(location)
  || isPublicAccountLocation(location)
);

if (localPreview || !publicEntryRoute || installedLanding || document.documentElement.dataset.auroraAuthCallback === 'true') {
  import('./main.js').catch((error) => {
    console.error('Aurora: não foi possível carregar a aplicação.', error);
    showEntryError(root);
  });
} else {
  initializePublicAppearance();
  initializeLegalDialogEvents();
  let renderedPublicPath = null;
  const renderPublicRoute = () => {
    renderedPublicPath = `${location.pathname}${location.search}`;
    if (isDemoLocation(location)) {
      mobileCtaCleanup();
      root.setAttribute('aria-busy', 'true');
      const requestedPath = renderedPublicPath;
      void import('../css/main.css').then(() => {
        if (`${location.pathname}${location.search}` !== requestedPath || !isDemoLocation(location)) return;
        renderLandingDemo(root);
        root.removeAttribute('aria-busy');
        document.title = 'Demonstração | aurora.';
        updatePublicConnectionNotice();
      }).catch((error) => {
        if (`${location.pathname}${location.search}` !== requestedPath) return;
        console.error('Aurora: não foi possível carregar os estilos da demonstração.', error);
        root.removeAttribute('aria-busy');
        showEntryError(root);
      });
      return;
    } else {
      root.removeAttribute('aria-busy');
      renderLanding(root);
      document.title = 'aurora. - rotinas';
      observeLandingScroll();
    }
    updatePublicConnectionNotice();
  };
  returnToPublicLanding = () => {
    renderPublicRoute();
    window.dispatchEvent(new Event('aurora:public-return'));
  };
  if (isPublicLandingLocation(location)) renderPublicRoute();
  else {
    import('./account-entry.js').then(({ startAccountEntry }) => startAccountEntry(
      root,
      accountModeFromLocation(location) || 'login',
      {
        allowPublicReturn: true,
        onPublicReturn: returnToPublicLanding,
      },
    )).catch((error) => {
      console.error('Aurora: não foi possível carregar a tela da conta.', error);
      showEntryError(root);
    });
  }

  if (isPublicLandingLocation(location) && !isDemoLocation(location)) {
    startPwaInstallPrompt();
    startPublicPwaSupport();
    ['focusin', 'touchstart'].forEach((type) => {
      root.addEventListener(type, (event) => {
        if (event.target instanceof Element && event.target.closest('[data-public-action="login"], [data-public-action="signup"]')) warmAccountEntry();
      }, { passive: true });
    });
    window.addEventListener('online', updatePublicConnectionNotice);
    window.addEventListener('offline', updatePublicConnectionNotice);
    publicConnectionCleanup = () => {
      window.removeEventListener('online', updatePublicConnectionNotice);
      window.removeEventListener('offline', updatePublicConnectionNotice);
      document.getElementById('public-offline-notice')?.remove();
    };
    updatePublicConnectionNotice();
  }

  const sessionRestore = isPublicLandingLocation(location) && !isDemoLocation(location) ? (async () => {
    try {
      const { hasSupabaseConfig, hasStoredAuthSession } = await import('./data/supabase-client.js');
      const query = new URLSearchParams(location.search);
      const hash = new URLSearchParams(location.hash.slice(1));
      const hasAuthCallback = [query, hash].some((params) => params.has('access_token') || params.has('error_description'));
      if (!hasSupabaseConfig() || (!hasAuthCallback && !hasStoredAuthSession(window))) return false;
      const { getAccountClient } = await import('./services/account-auth.js');
      const client = await getAccountClient();
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      if (!data.session?.user) return false;
      if (!isPublicLandingLocation(location) || isDemoLocation(location)) return false;
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
    normalizeLegacyRoute();
    if (isPublicLandingLocation(location)) {
      if (renderedPublicPath === `${location.pathname}${location.search}`) return;
      renderPublicRoute();
    } else if (isPublicAccountLocation(location) && !root.querySelector('form[data-account-mode]')) {
      window.location.reload();
    }
  };
  window.addEventListener('aurora:public-return', () => {
    if (!isDemoLocation(location) && root.querySelector('.public-site')) {
      observeLandingScroll();
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
  });
  window.addEventListener('popstate', onPublicNavigation);
  window.addEventListener('hashchange', onPublicNavigation);

  root.addEventListener('click', async (event) => {
    if (handlePublicControl(event, root)) return;
    const installAction = event.target instanceof Element
      ? event.target.closest('[data-action="pwa-install"]')
      : null;
    if (installAction) {
      showPwaInstallPrompt();
      return;
    }
    const trigger = event.target instanceof Element ? event.target.closest('[data-public-action]') : null;
    const action = trigger?.dataset.publicAction;
    if (trigger instanceof HTMLAnchorElement) {
      // Cliques com modificador seguem a navegação nativa (nova aba, nova janela).
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      if (trigger.getAttribute('aria-disabled') === 'true') return;
    }
    if (action === 'landing') {
      const url = new URL(location.href);
      url.pathname = '/';
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
      mobileCtaCleanup();
      const url = new URL(location.href);
      url.pathname = '/demonstracao';
      url.hash = '';
      history.pushState(null, '', `${url.pathname}${url.search}`);
      renderPublicRoute();
      window.scrollTo(0, 0);
      return;
    }
    if (action !== 'login' && action !== 'signup') return;
    if (publicAccountNavigationPending) return;
    publicAccountNavigationPending = true;

    const setBusy = (control, busy) => {
      if (control instanceof HTMLButtonElement) control.disabled = busy;
      else if (busy) control.setAttribute('aria-disabled', 'true');
      else control.removeAttribute('aria-disabled');
    };
    setBusy(trigger, true);
    trigger.setAttribute('aria-busy', 'true');
    const label = trigger.textContent?.trim();
    if (label && !trigger.dataset.defaultLabel) trigger.dataset.defaultLabel = label;
    if (trigger.dataset.defaultLabel) trigger.textContent = trigger.dataset.defaultLabel === 'Entrar' ? 'Entrando…' : 'Criando conta…';

    try {
      const sessionReady = await sessionRestore;
      if (sessionReady) return;
      await loadApplication(action);
    } catch (error) {
      console.error('Aurora: a inicialização segura falhou.', error);
      showEntryError(root);
    } finally {
      publicAccountNavigationPending = false;
      setBusy(trigger, false);
      trigger.removeAttribute('aria-busy');
      const defaultLabel = trigger.dataset.defaultLabel;
      if (defaultLabel) trigger.textContent = defaultLabel;
    }
  });

  root.addEventListener('submit', async (event) => {
    if (!(event.target instanceof HTMLFormElement) || !event.target.matches('[data-footer-suggestion]')) return;
    event.preventDefault();
    const form = event.target;
    const submit = form.querySelector('button[type="submit"]');
    const errorMessage = form.querySelector('[data-suggestion-error]');
    const status = form.querySelector('[data-suggestion-status]');
    try {
      const message = normalizeSuggestionMessage(form.elements.message.value);
      if (!(submit instanceof HTMLButtonElement)) throw new Error('O botão de envio da sugestão não está disponível.');
      submit.disabled = true;
      submit.setAttribute('aria-busy', 'true');
      if (errorMessage) errorMessage.hidden = true;
      if (status) status.textContent = 'Enviando…';
      const { getSupabaseClient } = await import('./data/supabase-client.js');
      const client = await getSupabaseClient();
      const { error } = await client.functions.invoke('submit-suggestion', { body: { message } });
      if (error) throw error;
      form.reset();
      if (status) status.textContent = 'Sugestão enviada. Obrigada por ajudar o Aurora a melhorar.';
    } catch (error) {
      console.error('Aurora: não foi possível enviar a sugestão.', error);
      if (errorMessage) {
        errorMessage.textContent = error instanceof TypeError
          ? error.message
          : 'Não foi possível enviar agora. Confira sua conexão e tente novamente.';
        errorMessage.hidden = false;
      }
      if (status) status.textContent = '';
    } finally {
      if (submit instanceof HTMLButtonElement) {
        submit.disabled = false;
        submit.removeAttribute('aria-busy');
      }
    }
  });

  document.addEventListener('keydown', handlePublicKeydown);
}
