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
  const content = document.createElement('div');
  content.className = 'account-loading-content';
  const header = document.createElement('header');
  header.className = 'account-loading-header';
  const brand = document.createElement('span');
  brand.className = 'account-loading-brand';
  brand.textContent = 'aurora.';
  const progress = document.createElement('span');
  progress.className = 'account-loading-status';
  const indicator = document.createElement('span');
  indicator.className = 'account-loading-indicator';
  indicator.setAttribute('aria-hidden', 'true');
  const message = document.createElement('span');
  message.className = 'account-loading-message';
  message.textContent = 'Preparando a tela de acesso…';
  progress.append(indicator, message);
  header.append(brand, progress);
  content.append(header);
  status.append(content);
  root.replaceChildren(status);
}

export async function startAccountEntry(root, initialMode = 'login', {
  allowPublicReturn = false,
  onPublicReturn,
} = {}) {
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
