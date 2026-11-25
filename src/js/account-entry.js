import { requireAccount } from './services/account-auth.js';
import { redirectToPublicLanding } from './core/router.js';

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

function renderAccountEntryLoading(root) {
  const status = document.createElement('main');
  status.className = 'account-loading';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-busy', 'true');
  status.innerHTML = `<div class="account-loading-content">
    <header class="account-loading-header">
      <span class="account-loading-brand" aria-hidden="true"><img alt="" width="36" height="36"><span
        class="wordmark">aurora.</span></span>
    </header>
    <div class="account-loading-preview" aria-hidden="true">
      <div class="loading-welcome-card">
        <span class="loading-welcome-mark"></span>
        <span class="loading-welcome-kicker">UM DIA DE CADA VEZ</span>
        <span class="loading-welcome-title">Vamos por partes.</span>
        <span class="loading-welcome-copy">Planejar, cuidar e acompanhar.</span>
        <span class="loading-welcome-areas"><span class="loading-welcome-area plan">Planejar</span><span
          class="loading-welcome-area habits">Hábitos</span><span
          class="loading-welcome-area finance">Finanças</span><span
          class="loading-welcome-area cycle">Ciclo</span></span>
      </div>
    </div>
    <span class="account-loading-status"><span class="account-loading-indicator" aria-hidden="true"></span><span
      class="account-loading-message">Preparando a tela de acesso…</span></span>
  </div>`;
  status.querySelector('.account-loading-brand img').src = new URL('../../icons/favicon.svg', import.meta.url).href;
  root.replaceChildren(status);
}

export async function startAccountEntry(
  root,
  initialMode = 'login',
  { allowPublicReturn = false, onPublicReturn } = {},
) {
  const authStylesReady = import('../css/main.css');
  renderAccountEntryLoading(root);
  const initialNotice = consumeSessionExpiredNotice();

  const [accountSession] = await Promise.all([
    requireAccount(root, initialMode, {
      allowPublicReturn,
      initialNotice,
      onPublicReturn,
      onAccountDeleted: () => redirectToPublicLanding(location),
      authStylesReady,
    }),
    authStylesReady,
  ]);
  if (!accountSession) return false;

  window.__auroraPreauthenticatedAccount = accountSession;
  try {
    await import('./main.js');
    return true;
  } catch (error) {
    delete window.__auroraPreauthenticatedAccount;
    throw error;
  }
}
