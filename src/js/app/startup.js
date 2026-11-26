import {
  accountModeFromLocation,
  accountPathForMode,
  isDemoLocation,
  isPublicLandingLocation,
  postSignOutPath,
  redirectToPublicLanding,
  routeFromLocation,
  routePathFor,
} from '../core/router.js';
import { markReleaseNotesSeen, shouldShowReleaseNotes } from '../features/release-notes.js';
import { renderFooterContent } from '../features/footer/view.js';
import { initializeLegalDialogEvents } from '../features/footer/legal-dialog.js';
import { submitSuggestion } from '../features/footer/suggestions.js';
import { handlePublicControl, initializePublicAppearance } from '../features/appearance/public-controls.js';
import { initializeCustomSelects } from '../features/selects/custom-select.js';
import { startPwaInstallPrompt } from '../services/pwa-install.js';
import { isNativeApp } from '../utils/platform.js';
import { confirmInDialog, dlgOpen, openProfileSetup, profileSetupComplete } from './dialogs.js';
import { genRecurring, reconcileRecurringTransactions } from './finance-extras.js';
import { tick } from './global-events.js';
import { resetGoogleCalendarState, restoreGoogleCalendarAccounts } from './google-agenda.js';
import {
  initializeBirthdayFromMetadata,
  loadAccountData,
  Persist,
  purgeExpiredTrash,
  saveSlices,
  saveSlicesWithRollback,
  snapshotSlices,
} from './persistence.js';
import {
  onRoute,
  preloadEnabledRouteModules,
  preloadInitialRouteModule,
  registerPwaSupport,
  render,
} from './render.js';
import { loadSample, toast } from './samples-backup.js';
import { ROUTES } from './settings.js';
import {
  accountSession,
  releaseNoticePending,
  S,
  setAccountSession,
  setReleaseNoticePending,
  syncState,
  ui,
} from './state.js';

// Arranque
function renderAccountLoading(root) {
  if (root.querySelector(':scope > .account-loading, :scope > .app-skeleton')) return;
  const page = document.createElement('main');
  page.className = 'account-loading';
  page.setAttribute('role', 'status');
  page.setAttribute('aria-busy', 'true');

  page.innerHTML = `<div class="account-loading-content">
      <span class="account-loading-brand" aria-hidden="true"><img alt="" width="40" height="40"><span
        class="wordmark">aurora.</span></span>
      <div class="account-loading-status">
        <span class="account-loading-indicator" aria-hidden="true"></span>
        <span class="account-loading-message">Preparando seu espa&#231;o&#8230;</span>
      </div>
    </div>`;
  page.querySelector('.account-loading-brand img').src = new URL('../../../icons/favicon.svg', import.meta.url).href;
  root.replaceChildren(page);
}

function showAccountDataLoadError(root, error, user) {
  root.replaceChildren();
  const layout = document.createElement('div');
  layout.className = 'account-page';
  const page = document.createElement('main');
  page.className = 'account-gate';
  const card = document.createElement('section');
  card.className = 'account-card';
  const heading = document.createElement('h1');
  heading.textContent = 'Não foi possível carregar seus dados';
  const detail = document.createElement('p');
  detail.className = 'account-description';
  detail.setAttribute('role', 'alert');
  detail.textContent = `${
    error instanceof Error && error.message ? error.message : 'Os dados da conta não puderam ser carregados.'
  } Nenhum dado local foi usado como substituto.`;
  const actions = document.createElement('div');
  actions.className = 'row';
  const retry = document.createElement('button');
  retry.className = 'btn primary';
  retry.type = 'button';
  retry.textContent = 'Tentar novamente';
  retry.addEventListener('click', () => {
    retry.disabled = true;
    retry.textContent = 'Carregando…';
    void continueAuthenticatedAurora(root, user);
  });
  const exit = document.createElement('button');
  exit.className = 'btn ghost';
  exit.type = 'button';
  exit.textContent = 'Sair';
  exit.addEventListener('click', async () => {
    exit.disabled = true;
    intentionalSignOut = true;
    try {
      const { error: signOutError } = await accountSession.client.auth.signOut({ scope: 'local' });
      if (signOutError) throw signOutError;
      Persist.wipe();
      resetGoogleCalendarState();
      setAccountSession(null);
      history.replaceState(null, '', postSignOutPath(location));
      location.reload();
    } catch (signOutError) {
      console.error('Aurora: não foi possível encerrar a sessão após falha ao carregar os dados.', signOutError);
      detail.textContent =
        'Não foi possível encerrar a sessão. Tente novamente antes de compartilhar este dispositivo.';
      exit.disabled = false;
    }
  });
  actions.append(retry, exit);
  card.append(heading, detail, actions);
  page.append(card);
  layout.append(page);
  root.append(layout);
  heading.focus({ preventScroll: true });
}

async function continueAuthenticatedAurora(root, user) {
  preloadInitialRouteModule();
  try {
    const [{ purgeRemovedStudyDataFromBrowserStorage }] = await Promise.all([
      import('../features/backup/removed-study-data.js'),
      loadAccountData(),
    ]);
    purgeRemovedStudyDataFromBrowserStorage(window.localStorage, user.id);
    initializeBirthdayFromMetadata(user);
  } catch (error) {
    console.error('Aurora: a conta foi autenticada, mas os dados protegidos não puderam ser carregados.', error);
    showAccountDataLoadError(root, error, user);
    return;
  }

  purgeExpiredTrash();
  if (ui.persistFailed.size)
    toast(
      'Alguns dados protegidos não puderam ser carregados ou salvos. As cópias originais foram preservadas; revise os dados em Ajustes antes de continuar.',
      'error',
    );
  const recurringReconciled = reconcileRecurringTransactions();
  const recurringGenerated = genRecurring();
  if (recurringReconciled || recurringGenerated) saveSlices('finance');
  window.addEventListener('popstate', onRoute);
  window.addEventListener('hashchange', () => {
    const route = routeFromLocation(location, new Set(Object.keys(ROUTES)));
    if (location.hash && route.replacePath) onRoute();
  });
  setReleaseNoticePending(true);
  onRoute();
  preloadEnabledRouteModules();
  if (!profileSetupComplete()) openProfileSetup();
  else void maybeOpenReleaseNotes();
  setInterval(tick, 1000);
  await registerPwaSupport();
  Persist.retryPending();
}

export async function maybeOpenReleaseNotes() {
  if (!releaseNoticePending || !accountSession?.user?.id || ui.dlg || !profileSetupComplete()) return;
  setReleaseNoticePending(false);
  if (!shouldShowReleaseNotes(S.settings)) return;
  const snapshot = snapshotSlices(['settings']);
  if (!markReleaseNotesSeen(S.settings)) return;
  if (!saveSlicesWithRollback(['settings'], snapshot, false, 'a confirmação das novidades')) return;
  if (!(await Persist.flush())) return;
  dlgOpen('release-notes');
}

const RETURN_TO_KEY = 'aurora:return-to';
const SESSION_EXPIRED_KEY = 'aurora:session-expired';
const RETURN_TO_PATTERN = /^\/(?:inicio|planejar|financas|habitos|ciclo|config)(?:\?[\w=&%.-]*)?$/;
let intentionalSignOut = false;

function readStorage(key) {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeStorage(key, value) {
  try {
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, value);
  } catch {
    /* storage indisponível */
  }
}

function rememberRequestedRoute() {
  if (accountModeFromLocation(location) || isPublicLandingLocation(location)) return;
  const path = routePathFor(`${routeFromLocation(location, new Set(Object.keys(ROUTES))).route}${location.search}`);
  if (RETURN_TO_PATTERN.test(path)) writeStorage(RETURN_TO_KEY, path);
}

function watchSessionExpiry(client) {
  client.auth.onAuthStateChange((event) => {
    if (event !== 'SIGNED_OUT' || intentionalSignOut || !accountSession) return;
    const returnTo = `${location.pathname}${location.search}`;
    setAccountSession(null);
    if (RETURN_TO_PATTERN.test(returnTo)) writeStorage(RETURN_TO_KEY, returnTo);
    writeStorage(SESSION_EXPIRED_KEY, '1');
    Persist.wipe();
    resetGoogleCalendarState();
    history.replaceState(null, '', accountPathForMode('login'));
    location.reload();
  });
}

export async function startAuthenticatedAurora(
  root,
  initialMode = 'login',
  allowPublicReturn = false,
  authCallback = false,
  preauthenticatedAccount = null,
) {
  renderAccountLoading(root);
  preloadInitialRouteModule();
  const storeWarmup = import('../data/relational-account-store.js').catch(() => {});
  let returnedToPublic = false;
  rememberRequestedRoute();
  const sessionExpired = readStorage(SESSION_EXPIRED_KEY) === '1';
  writeStorage(SESSION_EXPIRED_KEY, null);
  let resolvedAccount = preauthenticatedAccount;
  if (!resolvedAccount) {
    const { requireAccount } = await import('../services/account-auth.js');
    resolvedAccount = await requireAccount(root, initialMode, {
      allowPublicReturn,
      initialNotice: sessionExpired ? 'Sua sessão expirou. Entre novamente para continuar.' : '',
      onPublicReturn: () => {
        returnedToPublic = true;
      },
      onAccountDeleted: () => {
        redirectToPublicLanding(location);
      },
    });
  }
  setAccountSession(resolvedAccount);
  if (!accountSession) {
    if (returnedToPublic) {
      initializePublicAppearance();
      if (isDemoLocation(location)) await showPublicDemo(root);
      else await showPublicLanding(root);
      window.dispatchEvent(new Event('aurora:public-return'));
    }
    return;
  }
  const returnTo = readStorage(RETURN_TO_KEY);
  writeStorage(RETURN_TO_KEY, null);
  if (accountModeFromLocation(location) || authCallback) {
    const url = new URL(location.href);
    if (returnTo && RETURN_TO_PATTERN.test(returnTo)) {
      history.replaceState(null, '', returnTo);
    } else {
      url.pathname = '/inicio';
      url.searchParams.delete('etapa');
      url.hash = '';
      history.replaceState(null, '', `${url.pathname}${url.search}`);
    }
  }
  await storeWarmup;
  await Persist.attach(accountSession);
  watchSessionExpiry(accountSession.client);
  await continueAuthenticatedAurora(root, accountSession.user);
  void restoreGoogleCalendarAccounts();
}

let stopStartupDemo = null;
async function showPublicLanding(root) {
  stopStartupDemo?.(root);
  const { renderLanding } = await import('../features/landing/view.js');
  renderLanding(root);
}
async function showPublicDemo(root) {
  const { renderLandingDemo, stopLandingDemo } = await import('../features/landing/demo.js');
  stopStartupDemo = stopLandingDemo;
  renderLandingDemo(root);
}

export function showAccountStartupError(root, message) {
  root.replaceChildren();
  const layout = document.createElement('div');
  layout.className = 'account-page';
  const page = document.createElement('main');
  page.className = 'account-gate';
  const card = document.createElement('section');
  card.className = 'account-card';
  const heading = document.createElement('h1');
  heading.textContent = 'Não foi possível iniciar a conta';
  const detail = document.createElement('p');
  detail.className = 'account-description';
  detail.setAttribute('role', 'alert');
  detail.textContent = message;
  const home = document.createElement('a');
  home.className = 'btn ghost';
  home.href = '/';
  home.textContent = 'Voltar à página inicial';
  card.append(heading, detail, home);
  page.append(card);
  const footer = document.createElement('footer');
  footer.className = 'app-footer site-footer account-gate-footer';
  footer.innerHTML = renderFooterContent({ accountError: true });
  layout.append(page, footer);
  root.append(layout);
}

export async function startAurora() {
  const root = document.getElementById('app');
  startPwaInstallPrompt();
  const routeMeta = document.querySelector('meta[name="aurora-route"]')?.content === 'landing';
  const authCallback = document.documentElement.dataset.auroraAuthCallback === 'true';
  const isPublicLanding = routeMeta && isPublicLandingLocation(location) && !authCallback;
  const localPreview = Boolean(import.meta.env.DEV && new URLSearchParams(location.search).has('preview'));
  if (localPreview) {
    ui.preview = true;
    S.settings.profile.name = 'Pessoa';
    S.settings.profile.preferredName = 'Pessoa';
    S.settings.onboardingComplete = true;
    S.settings.introSeen = true;
    loadSample();
    if (typeof window.__auroraPreviewSeed === 'function') window.__auroraPreviewSeed(S);
    if (location.pathname === '/' && (!location.hash || location.hash === '#landing')) {
      history.replaceState(null, '', `/inicio${location.search}`);
    }
    window.addEventListener('popstate', onRoute);
    onRoute();
    setInterval(tick, 1000);
    return;
  }
  if (isPublicLanding) void registerPwaSupport();
  if (routeMeta && location.hash === '#landing') {
    history.replaceState(null, '', `${location.pathname}${location.search}`);
  }
  if (!isPublicLanding) {
    const url = new URL(location.href);
    const requestedMode = url.searchParams.get('aurora-account-mode');
    if (requestedMode) {
      url.searchParams.delete('aurora-account-mode');
      history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
    }
    const routeMode = accountModeFromLocation(location);
    const preauthenticatedAccount = window.__auroraPreauthenticatedAccount || null;
    delete window.__auroraPreauthenticatedAccount;
    await startAuthenticatedAurora(
      root,
      routeMode || (requestedMode === 'signup' ? 'signup' : 'login'),
      routeMeta,
      authCallback,
      preauthenticatedAccount,
    );
    return;
  }
  initializePublicAppearance();
  if (isDemoLocation(location)) await showPublicDemo(root);
  else await showPublicLanding(root);
  const sessionRestore = (async () => {
    try {
      const [{ getAccountClient }, { hasSupabaseConfig }] = await Promise.all([
        import('../services/account-auth.js'),
        import('../data/supabase-client.js'),
      ]);
      if (!hasSupabaseConfig()) return false;
      const client = await getAccountClient();
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      if (!data.session?.user) return false;
      try {
        await startAuthenticatedAurora(root);
        return true;
      } catch (error) {
        console.error('Aurora: a sessão existente não pôde ser restaurada.', error);
        showAccountStartupError(
          root,
          'Não foi possível restaurar sua sessão. Atualize a página e tente entrar novamente.',
        );
        return true;
      }
    } catch (error) {
      console.error('Aurora: não foi possível verificar a sessão salva.', error);
      return false;
    }
  })();
  root.addEventListener('click', async (event) => {
    if (handlePublicControl(event, root)) return;
    const trigger = event.target instanceof Element ? event.target.closest('[data-public-action]') : null;
    const action = trigger?.dataset.publicAction;
    if (trigger instanceof HTMLAnchorElement) {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      if (trigger.getAttribute('aria-disabled') === 'true') return;
    }
    if (action === 'landing') {
      await showPublicLanding(root);
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
      await showPublicDemo(root);
      window.scrollTo(0, 0);
      return;
    }
    if (action !== 'login' && action !== 'signup') return;
    stopStartupDemo?.(root);
    root.querySelectorAll('[data-public-action]').forEach((button) => {
      if (button instanceof HTMLButtonElement) button.disabled = true;
      else if (button.dataset.publicAction !== 'skip' && button.dataset.publicAction !== 'landing')
        button.setAttribute('aria-disabled', 'true');
    });
    if (await sessionRestore) return;
    startAuthenticatedAurora(root, action, true).catch((error) => {
      console.error('Aurora: a inicialização segura falhou.', error);
      const detail =
        error instanceof Error && error.message ? error.message : 'Falha desconhecida ao carregar os módulos de conta.';
      showAccountStartupError(
        root,
        `${detail} Inicie o projeto com \`npm run dev\`, atualize a página e tente novamente.`,
      );
    });
  });
}
function updateSuggestionCount(form) {
  const textarea = form?.elements?.message;
  const counter = form?.querySelector('[data-suggestion-count]');
  if (textarea instanceof HTMLTextAreaElement && counter) {
    counter.textContent = `${textarea.value.length} / 2000`;
  }
}
export function setIntentionalSignOut(value) {
  intentionalSignOut = value;
  return value;
}

export function registerStartup() {
  document.addEventListener('click', async (event) => {
    const button = event.target instanceof Element ? event.target.closest('[data-account-signout]') : null;
    if (!button || !accountSession) return;
    event.preventDefault();
    if (button.closest('.profile-menu-control')) button.closest('.profile-menu-control').open = false;
    if (ui.legacyImport.busy) {
      toast('A importação está em andamento. Aguarde a confirmação antes de sair.', 'warning');
      return;
    }
    button.disabled = true;
    const synchronized = await Persist.flush();
    if (
      !synchronized &&
      !(await confirmInDialog(
        'Ainda há alterações que não foram confirmadas pela nuvem. Elas podem ser descartadas ao sair. Deseja sair mesmo assim?',
      ))
    ) {
      button.disabled = false;
      return;
    }
    intentionalSignOut = true;
    try {
      const { error } = await accountSession.client.auth.signOut({ scope: 'local' });
      if (error) throw error;
    } catch (error) {
      intentionalSignOut = false;
      button.disabled = false;
      console.error('Aurora: não foi possível encerrar a sessão.', error);
      toast('Não foi possível encerrar a sessão. Tente novamente antes de compartilhar este dispositivo.', 'info');
      return;
    }
    Persist.wipe();
    resetGoogleCalendarState();
    history.replaceState(null, '', postSignOutPath(location));
    location.reload();
  });
  window.addEventListener('offline', () => render());
  window.addEventListener('online', () => {
    if (Persist.pendingSnapshot && Persist.store) void Persist.flush();
    render();
  });
  window.addEventListener('beforeunload', (event) => {
    if (!ui.legacyImport.busy && !syncState.pending.size && !syncState.failed.size) return;
    event.preventDefault();
    event.returnValue = '';
  });
  document.addEventListener(
    'submit',
    (event) => {
      if (!ui.legacyImport.busy) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    },
    true,
  );
  document.addEventListener('input', (event) => {
    if (!(event.target instanceof HTMLTextAreaElement) || event.target.name !== 'message') return;
    if (event.target.closest('[data-footer-suggestion]')) {
      updateSuggestionCount(event.target.closest('[data-footer-suggestion]'));
    }
  });
  document.addEventListener('reset', (event) => {
    if (!(event.target instanceof HTMLFormElement) || !event.target.matches('[data-footer-suggestion]')) return;
    queueMicrotask(() => updateSuggestionCount(event.target));
  });
  document.addEventListener('submit', async (event) => {
    if (!(event.target instanceof HTMLFormElement) || !event.target.matches('[data-footer-suggestion]')) return;
    event.preventDefault();
    const form = event.target;
    const submit = form.querySelector('button[type="submit"]');
    const errorMessage = form.querySelector('[data-suggestion-error]');
    const status = form.querySelector('[data-suggestion-status]');
    try {
      if (!(submit instanceof HTMLButtonElement)) throw new Error('O botão de envio da sugestão não está disponível.');
      if (!accountSession?.client) throw new Error('Entre na sua conta para enviar uma sugestão.');
      submit.disabled = true;
      submit.setAttribute('aria-busy', 'true');
      if (errorMessage) errorMessage.hidden = true;
      if (status) status.textContent = 'Enviando…';
      await submitSuggestion(accountSession.client, form.elements.message.value);
      form.reset();
      if (status) status.textContent = 'Sugestão enviada. Obrigada por ajudar o Aurora a melhorar.';
    } catch (error) {
      console.error('Aurora: não foi possível enviar a sugestão.', error);
      if (errorMessage) {
        errorMessage.textContent =
          error instanceof TypeError
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
  initializeCustomSelects(document);
  initializeLegalDialogEvents();
  if (isNativeApp()) {
    void import('../services/native-auth.js')
      .then(({ initializeNativeAuthBridge }) => initializeNativeAuthBridge())
      .catch((error) => console.error('O Aurora não conseguiu carregar a autenticação nativa.', error));
  }
}
