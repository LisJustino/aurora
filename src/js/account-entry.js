import { requireAccount } from './services/account-auth.js';
import { redirectToPublicLanding } from './core/router.js';
import { preconnectSupabase } from './data/supabase-client.js';

const SESSION_EXPIRED_KEY = 'aurora:session-expired';

function consumeSessionExpiredNotice() {
  try {
    if (sessionStorage.getItem(SESSION_EXPIRED_KEY) !== '1') return '';
    sessionStorage.removeItem(SESSION_EXPIRED_KEY);
    return 'Sua sessão expirou. Entre novamente para continuar.';
  } catch (error) {
    console.warn('Aurora: não foi possível recuperar o aviso de sessão expirada.', error);
    return '';
  }
}

function renderAccountEntryLoading(root, message = 'Preparando seu espaço…') {
  if (root.querySelector(':scope > .account-loading, :scope > .app-skeleton')) return;
  const status = document.createElement('main');
  status.className = 'account-loading';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-busy', 'true');
  status.innerHTML = `<div class="account-loading-content">
    <span class="account-loading-brand" aria-hidden="true"><img alt="" width="40" height="40"><span
      class="wordmark">aurora.</span></span>
    <div class="account-loading-status">
      <span class="account-loading-indicator" aria-hidden="true"></span>
      <span class="account-loading-message"></span>
    </div>
  </div>`;
  status.querySelector('.account-loading-brand img').src = new URL('../../icons/favicon.svg', import.meta.url).href;
  status.querySelector('.account-loading-message').textContent = message;
  root.replaceChildren(status);
}

function scheduleAppPreload() {
  let cancelled = false;
  let timerId = 0;
  let idleId = 0;
  const warm = () => {
    if (cancelled || navigator.onLine === false) return;
    void import('./main.js').catch(() => {});
    void import('./data/relational-account-store.js').catch(() => {});
  };
  if (typeof window.requestIdleCallback === 'function') {
    idleId = window.requestIdleCallback(warm, { timeout: 900 });
  } else {
    timerId = window.setTimeout(warm, 350);
  }
  return () => {
    cancelled = true;
    if (timerId) window.clearTimeout(timerId);
    if (idleId && typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(idleId);
  };
}

export async function startAccountEntry(
  root,
  initialMode = 'login',
  { allowPublicReturn = false, onPublicReturn } = {},
) {
  preconnectSupabase();
  const authStylesReady = import('../css/main.css');
  let formReady = false;
  let cancelPreload = () => {};
  const loadingTimer = window.setTimeout(() => {
    if (!formReady) renderAccountEntryLoading(root, 'Preparando a tela de acesso…');
  }, 160);
  const initialNotice = consumeSessionExpiredNotice();

  let accountSession = null;
  try {
    [accountSession] = await Promise.all([
      requireAccount(root, initialMode, {
        allowPublicReturn,
        initialNotice,
        onPublicReturn: () => {
          cancelPreload();
          onPublicReturn?.();
        },
        onAccountDeleted: () => {
          cancelPreload();
          redirectToPublicLanding(location);
        },
        onFormReady: () => {
          formReady = true;
          window.clearTimeout(loadingTimer);
          cancelPreload();
          cancelPreload = scheduleAppPreload();
        },
        authStylesReady,
      }),
      authStylesReady,
    ]);
  } finally {
    window.clearTimeout(loadingTimer);
  }
  if (!accountSession) {
    cancelPreload();
    return false;
  }

  renderAccountEntryLoading(root, 'Preparando seu espaço…');
  window.__auroraPreauthenticatedAccount = accountSession;
  try {
    await import('./main.js');
    return true;
  } catch (error) {
    delete window.__auroraPreauthenticatedAccount;
    throw error;
  }
}
