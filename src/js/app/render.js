import { $, $$, h, raw } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { pk, today } from '../utils/dates.js';
import { routeFromLocation, routePathFor, settingsRootPath } from '../core/router.js';
import { feedbackPromptNextAt, isFeedbackPromptDue } from '../features/feedback/prompt.js';
import { canAccessCycle } from '../features/cycle/access.js';
import { initializeFaqDisclosure } from '../features/footer/view.js';
import { hasCurrentCycleDataConsent } from '../services/cycle-consent.js';
import { animateProgressRings, captureProgressRings, prefersReducedMotion } from '../utils/motion.js';
import { MAX_CYCLE_PERIOD_DAYS } from '../features/cycle/period.js';
import { HOME_AREA_COLORS, homeAreaColorValue, normalizeHomeAreaColors } from '../features/home/personalization.js';
import { isNativeApp } from '../utils/platform.js';
import { habitIsSkipped } from '../features/habits/model.js';
import { paletteColors } from '../features/appearance/palettes.js';
import { renderTaskRow } from '../features/planning/task-row.js';
import { homeBadgeCount } from '../features/home/day-summary.js';
import { syncNativeAppearance, updateAppIconBadge } from '../services/native-experience.js';
import { CYCLE_CONTRACEPTION_METHODS, CYCLE_TEST_RESULTS } from '../features/cycle/log.js';
import { CAT_ICONS, CATEGORY_ICON_LABELS, LIST_COLORS, PRIO } from './core.js';
import { CYC, CYC_ICON, CYC_OPTION_ICON, CYC_SHORT_LABEL, cycLabel } from './cycle.js';
import { closeBtn, confirmInDialog, dlgField, dlgWrap, profileSetupComplete, renderDialog } from './dialogs.js';
import { anticipationCandidates } from './finance-dialogs.js';
import { recById } from './finance-extras.js';
import { accById, accName, accountOptionLabel, isCredit } from './finance-view.js';
import { tick } from './global-events.js';
import { requestHabitsTemplate } from './habits.js';
import { habitCompletedFor } from './home.js';
import { Persist, saveSlices } from './persistence.js';
import { toast } from './samples-backup.js';
import { ROUTES, SETTINGS_SECTIONS, settingsTabId } from './settings.js';
import {
  acquireActiveScrollLocks,
  areaOn,
  expenseTitle,
  money,
  pageTitle,
  shell,
  updateDocumentTitle,
} from './shell.js';
import {
  accountSession,
  categoryMatch,
  catInfo,
  catNames,
  cycleDialogViews,
  cycleModulesPromise,
  financeDialogViews,
  financeModulesPromise,
  profileAutosaveTimer,
  pwaApplying,
  pwaRegistration,
  pwaReloading,
  pwaSupportPromise,
  pwaUpdateAutoBlocked,
  renderedRoute,
  routeScrollPositions,
  S,
  saveProfileDraft,
  setCycleDialogViews,
  setCycleModulesPromise,
  setEstimatedCyclePhase,
  setFinanceDialogViews,
  setFinanceModulesPromise,
  setFinancePrivacyNotice,
  setProfileAutosaveTimer,
  setPwaApplying,
  setPwaRegistration,
  setPwaReloading,
  setPwaSupportPromise,
  setPwaUpdateAutoBlocked,
  setRenderCycleView,
  setRenderedRoute,
  setRenderFinanceView,
  settingsDraftDirty,
  settingsView,
  syncState,
  toastController,
  topCategoryNames,
  ui,
} from './state.js';

// Tarefas (reuso)
export function taskRow(t, reviewNextWeek = false, homeNextStep = false) {
  return renderTaskRow(t, reviewNextWeek, homeNextStep, { route: ui.route, sort: ui.filters.sort });
}
export const prioOptions = (cur) =>
  Object.entries(PRIO).map(([k, v]) => h`<option value="${k}" ${k === cur ? raw('selected') : ''}>${v}</option>`);

// render principal
export function applyTheme(theme) {
  const settings = settingsView();
  const r = document.documentElement,
    L = settings.look,
    th = theme || settings.theme,
    [p, pd] = paletteColors(th, L);
  r.setAttribute('data-palette', th);
  r.style.setProperty('--p', p);
  r.style.setProperty('--pd', pd);
  const effectiveMode = L.mode === 'auto' ? (systemThemeQuery?.matches ? 'dark' : 'light') : L.mode;
  r.setAttribute('data-theme', effectiveMode);
  window.auroraManifestTheme?.setMode(L.mode);
  const areaColors = normalizeHomeAreaColors(settings.prefs.areaColors);
  HOME_AREA_COLORS.forEach(({ id, css }) => {
    const color = areaColors[id] ? homeAreaColorValue(areaColors[id], effectiveMode) : '';
    if (color) r.style.setProperty(`--area-${css}`, color);
    else r.style.removeProperty(`--area-${css}`);
  });
  r.setAttribute('data-density', L.density);
  r.setAttribute('data-fs', L.font);
  r.setAttribute('data-contrast', L.contrast ? 'high' : 'normal');
  r.setAttribute('data-readable', L.readable ? 'true' : 'false');
  r.setAttribute('data-links', L.highlightLinks ? 'highlight' : 'normal');
  r.setAttribute('data-motion', L.reduceMotion ? 'reduce' : 'normal');
  const themeColor = getComputedStyle(r).getPropertyValue('--bg').trim();
  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
    meta.content = themeColor;
  });
  syncNativeAppearance(effectiveMode);
}
const systemThemeQuery =
  typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null;
let headerScrollFrame = 0;
// Altura real do cabeçalho fixo (muda ao rolar); os títulos de dia das listas grudam logo abaixo dele.
function syncTopbarOffset() {
  const topbar = document.querySelector('.app > .topbar');
  if (topbar) document.documentElement.style.setProperty('--topbar-stick', `${topbar.offsetHeight}px`);
}
// O atributo no documento persiste quando o shell é renderizado novamente.
function syncHeaderScrollState() {
  if (headerScrollFrame) return;
  headerScrollFrame = requestAnimationFrame(() => {
    if (window.scrollY > 28) document.documentElement.setAttribute('data-scrolled', 'true');
    else document.documentElement.removeAttribute('data-scrolled');
    syncTopbarOffset();
    headerScrollFrame = 0;
  });
}
const MODE_NEXT = { auto: 'light', light: 'dark', dark: 'auto' },
  MODE_NAME = { auto: 'automático', light: 'claro', dark: 'escuro' },
  MODE_IC = { auto: 'monitor', light: 'sun', dark: 'moon' };
export function modeBtn(cls) {
  const m = settingsView().look.mode;
  return h`<button type="button" class="${cls}" data-action="look-cycle"
    aria-label="${'Tema ' + MODE_NAME[m] + '. Tocar para alternar'}"
    title="${'Tema: ' + MODE_NAME[m]}">${icon(MODE_IC[m], cls === 'iconbtn theme-trigger' ? 20 : 18)}${cls === 'nl nlb' ? h`<span>Tema: ${MODE_NAME[m]}</span>` : ''}</button>`;
}
export function cycleThemeMode() {
  setThemeMode(MODE_NEXT[settingsView().look.mode] || 'auto');
}
export function setThemeMode(mode) {
  if (!MODE_NAME[mode] || mode === settingsView().look.mode) return;
  const previousSettings = S.settings;
  S.settings = { ...S.settings, look: { ...S.settings.look, mode } };
  if (!saveSlices('settings')) {
    S.settings = previousSettings;
    render();
    return;
  }
  if (ui.settingsDraft) {
    ui.settingsDraftBase.look.mode = mode;
    ui.settingsDraft.look.mode = mode;
  }
  render();
}
export function accessibilityOption(id, action, label, description, pressed) {
  return h`<button type="button" id="${id}" class="accessibility-option" data-action="${action}"
    aria-pressed="${String(pressed)}"><span
    class="accessibility-option-copy"><b>${label}</b><small>${description}</small></span><span
    class="accessibility-state" aria-hidden="true">${pressed ? 'Ativado' : 'Desativado'}</span></button>`;
}
export function describeDialogOpener(target) {
  if (!(target instanceof HTMLElement) || target === document.body || target === document.documentElement) return null;
  return {
    element: target,
    tag: target.tagName,
    id: target.id,
    data: { ...target.dataset },
    label: target.getAttribute('aria-label'),
    href: target.getAttribute('href'),
    text: target.textContent.trim().replace(/\s+/g, ' '),
  };
}
export function restoreDialogOpener(opener) {
  if (!opener) return;
  let target = opener.element?.isConnected ? opener.element : null;
  if (!target && opener.id) target = document.getElementById(opener.id);
  if (!target) {
    const candidates = $$('#app button, #app a[href], #app input, #app select, #app textarea, #app [tabindex]');
    target = candidates.find((candidate) => {
      if (candidate.tagName !== opener.tag) return false;
      if (opener.label && candidate.getAttribute('aria-label') !== opener.label) return false;
      if (opener.href && candidate.getAttribute('href') !== opener.href) return false;
      if (opener.text && candidate.textContent.trim().replace(/\s+/g, ' ') !== opener.text) return false;
      return Object.entries(opener.data).every(([key, value]) => candidate.dataset[key] === value);
    });
  }
  target?.focus({ preventScroll: true });
}
function cycleDataConsentGate() {
  return h`${pageTitle('Ciclo')}
    <section class="card cycle-consent-card" aria-labelledby="cycle-consent-title">
      <h2 id="cycle-consent-title">Usar dados no Ciclo<i>?</i></h2>
      <p>O Ciclo pode guardar apenas os dados que você decidir registrar, como fluxo, sintomas, atividades, peso e medicações.</p>
      <p>Você pode retirar o consentimento depois. Nesse caso, o Ciclo fica bloqueado, mas seus registros não são apagados. Veja como excluir dados na <a
        href="/privacy.html" data-legal-document="privacy" target="_blank"
        rel="noopener noreferrer">Política de Privacidade</a>.</p>
      <form class="cycle-consent-form" data-form="cycle-data-consent">
        <label class="cycle-consent-check"><input type="checkbox" name="cycleConsent"
          required ${ui.cycleConsentBusy ? raw('disabled') : ''}><span>Permito que o Aurora use esses dados no Ciclo.</span></label>
        <p class="notice warn" role="alert" ${ui.cycleConsentError ? '' : raw('hidden')}>${ui.cycleConsentError}</p>
        <div class="row cycle-consent-actions"><button class="btn primary"
          type="submit" ${ui.cycleConsentBusy ? raw('disabled aria-busy="true"') : ''}>${ui.cycleConsentBusy ? 'Registrando…' : 'Concordar e abrir Ciclo'}</button><a
          class="btn back" href="/inicio">Agora não</a></div>
      </form>
    </section>`;
}
// A transição entre telas segue a ordem das abas: avançar entra pela direita, voltar pela esquerda.
function setRouteDirection(from, to) {
  const order = [...document.querySelectorAll('.topbar .nav [data-route]')].map((link) => link.dataset.route);
  const position = (route) => {
    const index = order.indexOf(route);
    return index < 0 ? order.length : index;
  };
  document.documentElement.dataset.routeDir = position(to) >= position(from) ? 'forward' : 'back';
}
const clearRouteDirection = () => {
  delete document.documentElement.dataset.routeDir;
};
export function render() {
  if (!ui.preview && !S.settings.prefs.sample) {
    const day = today();
    void updateAppIconBadge(
      homeBadgeCount({
        tasks: S.tasks,
        habits: S.habits,
        day,
        weekday: pk(day).getDay(),
        habitsEnabled: areaOn('habits'),
        isComplete: habitCompletedFor,
        isSkipped: (habit, targetDay) => habitIsSkipped(habit, targetDay, targetDay),
      }),
    );
  }
  maybeShowFeedbackPrompt();
  const routeChanged = renderedRoute !== null && renderedRoute !== ui.route;
  const reducedMotion = prefersReducedMotion(settingsView().look.reduceMotion);
  if (routeChanged && !reducedMotion) setRouteDirection(renderedRoute, ui.route);
  if (routeChanged && !reducedMotion && typeof document.startViewTransition === 'function') {
    const transition = document.startViewTransition(() => renderApp(true, true));
    transition.finished.catch(() => {}).finally(clearRouteDirection);
    return;
  }
  if (routeChanged && !reducedMotion) setTimeout(clearRouteDirection, 400);
  renderApp(routeChanged, false);
}

function maybeShowFeedbackPrompt() {
  if (ui.feedbackPromptVisible) return;
  if (ui.feedbackPromptScheduleAttempted) {
    if (syncState.pending.size || syncState.failed.size || ui.persistFailed.size) return;
    ui.feedbackPromptScheduleAttempted = false;
  }
  if (
    ui.preview ||
    !accountSession ||
    ui.route !== 'inicio' ||
    !profileSetupComplete() ||
    S.settings.prefs.sample ||
    ui.dlg ||
    ui.profileDraft ||
    ui.profileSaving ||
    ui.settingsDraft ||
    ui.settingsSaving ||
    ui.persistBlocked.has('settings') ||
    ui.persistFailed.size ||
    syncState.pending.size ||
    syncState.failed.size ||
    navigator.onLine === false
  )
    return;

  const now = Date.now();
  const previousNextAt = S.settings.prefs.feedbackPromptNextAt;
  const nextAtMs = typeof previousNextAt === 'string' ? Date.parse(previousNextAt) : NaN;
  const hasNextAt = Number.isFinite(nextAtMs);
  if (hasNextAt && !isFeedbackPromptDue(previousNextAt, now)) return;

  ui.feedbackPromptScheduleAttempted = true;
  S.settings.prefs.feedbackPromptNextAt = feedbackPromptNextAt(now);
  if (!saveSlices('settings')) {
    S.settings.prefs.feedbackPromptNextAt = previousNextAt;
    return;
  }
  if (hasNextAt) ui.feedbackPromptVisible = true;
}

/* Esqueleto de página: aparece se uma área carregada sob demanda demorar, no lugar de uma tela parada. */
const ROUTE_SKELETON_HTML = `<div class="skeleton-page" role="status" aria-live="polite"><span
  class="sr">Carregando…</span><div aria-hidden="true">
  <div class="skeleton-card"><span class="skeleton skeleton-title"></span><span
    class="skeleton skeleton-line-lg"></span><span class="skeleton skeleton-line-md"></span></div>
  <div class="skeleton-card"><span class="skeleton skeleton-line-sm"></span><span
    class="skeleton skeleton-block"></span><span class="skeleton skeleton-block"></span></div>
  <div class="skeleton-card"><span class="skeleton skeleton-line-md"></span><span
    class="skeleton skeleton-block"></span></div>
</div></div>`;
function scheduleRouteSkeleton(delay = 120) {
  const timer = setTimeout(() => {
    const main = document.querySelector('.app > .main');
    if (!main || main.dataset.skeleton) return;
    main.dataset.skeleton = 'true';
    main.setAttribute('aria-busy', 'true');
    main.innerHTML = ROUTE_SKELETON_HTML;
  }, delay);
  return () => {
    clearTimeout(timer);
    return Boolean(document.querySelector('.app > .main[data-skeleton]'));
  };
}
function renderApp(routeChanged, viewTransition) {
  acquireActiveScrollLocks();
  ui.dirty = false;
  applyTheme();
  document.querySelectorAll('#app details[id^="d-"]').forEach((details) => {
    ui.openDetails[details.id.slice(2)] = details.open;
  });
  const keep = {};
  $$('[data-keep]').forEach((el) => {
    if (el.id) keep[el.id] = el.type === 'checkbox' ? el.checked : el.value;
  });
  const active = document.activeElement;
  const af = active && active.id;
  if (ui.dlg && !$('#dlg') && !ui.lastFocus) ui.lastFocus = describeDialogOpener(active);
  const needsCycleConsent =
    ui.route === 'ciclo' && !ui.preview && areaOn('cycle') && !hasCurrentCycleDataConsent(accountSession?.user);
  const page = needsCycleConsent ? cycleDataConsentGate() : (ROUTES[ui.route] || ROUTES.inicio)();
  const app = $('#app');
  const previousProgressRings = routeChanged ? [] : captureProgressRings(app);
  app.innerHTML = shell(page).s;
  if (!routeChanged) animateProgressRings(app, previousProgressRings);
  initializeFaqDisclosure(app);
  if (routeChanged && !viewTransition) {
    const main = app.querySelector('.main');
    if (main) main.classList.add('route-enter');
  }
  setRenderedRoute(ui.route);
  updateDocumentTitle();
  for (const [id, v] of Object.entries(keep)) {
    const el = document.getElementById(id);
    if (el) {
      if (el.type === 'checkbox') el.checked = v;
      else el.value = v;
    }
  }
  if (af && keep[af] !== undefined) {
    const el = document.getElementById(af);
    if (el) {
      el.focus();
      try {
        el.setSelectionRange(el.value.length, el.value.length);
      } catch (e) {
        /* tipo sem seleção */
      }
    }
  }
  const dc = $('.dchip.on');
  if (dc && dc.parentElement) {
    const sx = dc.parentElement;
    sx.scrollLeft = dc.offsetLeft - sx.clientWidth / 2 + dc.offsetWidth / 2;
  }
  $$('.habit-year-grid').forEach((grid) => {
    grid.scrollLeft = grid.scrollWidth;
  });
  renderDialog();
  $('#app').inert = Boolean(ui.dlg);
  renderToast();
  renderPwaUpdateNotice();
  if (ui.pwaUpdateAvailable && !pwaUpdateAutoBlocked && !hasUnsavedPwaChanges()) {
    void applyPwaUpdate({ automatic: true });
  }
  tick();
}
function hasUnsavedPwaChanges() {
  return settingsDraftDirty() || Boolean(ui.profileDraft) || Boolean(ui.dlg) || ui.persistFailed.size > 0;
}
export function renderPwaUpdateNotice() {
  let notice = $('#pwa-update-notice');
  if (!ui.pwaUpdateAvailable || ui.pwaUpdateDismissed || ui.dlg) {
    notice?.remove();
    return;
  }
  if (notice) return;
  notice = document.createElement('section');
  notice.id = 'pwa-update-notice';
  notice.className = 'pwa-update-notice';
  notice.setAttribute('role', 'status');
  notice.setAttribute('aria-label', 'Atualização do Aurora disponível');
  const message = document.createElement('p');
  message.textContent = 'Nova versão disponível. Atualize quando terminar o que estiver fazendo.';
  const actions = document.createElement('div');
  actions.className = 'pwa-update-actions';
  const dismiss = document.createElement('button');
  dismiss.type = 'button';
  dismiss.className = 'btn back';
  dismiss.dataset.action = 'pwa-update-dismiss';
  dismiss.textContent = 'Agora não';
  const apply = document.createElement('button');
  apply.type = 'button';
  apply.className = 'btn primary';
  apply.dataset.action = 'pwa-update-apply';
  apply.textContent = 'Atualizar';
  actions.append(dismiss, apply);
  notice.append(message, actions);
  document.body.append(notice);
}
function watchPwaRegistration(registration) {
  setPwaRegistration(registration);
  let announcedWorker = null;
  const announceWaitingWorker = () => {
    const waiting = registration.waiting;
    if (!waiting || !navigator.serviceWorker.controller || waiting === announcedWorker) return;
    announcedWorker = waiting;
    ui.pwaUpdateAvailable = true;
    ui.pwaUpdateDismissed = false;
    setPwaUpdateAutoBlocked(false);
    renderPwaUpdateNotice();
    void applyPwaUpdate({ automatic: true });
  };
  registration.addEventListener('updatefound', () => {
    const installing = registration.installing;
    installing?.addEventListener('statechange', () => {
      if (installing.state === 'installed') announceWaitingWorker();
    });
  });
  announceWaitingWorker();
  const checkForUpdate = () => {
    if (document.visibilityState !== 'hidden') {
      void registration.update().catch((error) => {
        console.warn('O Aurora não conseguiu verificar se há uma atualização disponível.', error);
      });
    }
  };
  window.addEventListener('focus', checkForUpdate);
  document.addEventListener('visibilitychange', checkForUpdate);
}
export function registerPwaSupport() {
  if (
    !import.meta.env.PROD ||
    import.meta.env.VITE_PWA_ENABLED === 'false' ||
    isNativeApp() ||
    !('serviceWorker' in navigator)
  )
    return Promise.resolve(null);
  if (!pwaSupportPromise) {
    setPwaSupportPromise(
      (async () => {
        try {
          const registration = await navigator.serviceWorker.register('/service-worker.js');
          watchPwaRegistration(registration);
          await navigator.serviceWorker.ready;
          return registration;
        } catch (error) {
          setPwaSupportPromise(null);
          console.error('O Aurora não conseguiu iniciar o suporte offline.', error);
          return null;
        }
      })(),
    );
  }
  return pwaSupportPromise;
}
export async function applyPwaUpdate({ automatic = false } = {}) {
  if (pwaReloading || pwaApplying) return;
  if (!automatic) setPwaUpdateAutoBlocked(false);
  const waiting = pwaRegistration?.waiting;
  if (!waiting) {
    ui.pwaUpdateAvailable = false;
    renderPwaUpdateNotice();
    if (!automatic) toast('Não há uma atualização aguardando. Tente recarregar o app mais tarde.', 'info');
    return;
  }
  if (hasUnsavedPwaChanges()) {
    if (automatic) return;
    if (
      !(await confirmInDialog(
        'Há alterações que ainda não foram salvas. Aplicar a atualização pode descartá-las. Deseja continuar?',
      ))
    )
      return;
  }
  setPwaApplying(true);
  try {
    if (Persist.store && !(await Persist.flush())) {
      setPwaUpdateAutoBlocked(true);
      toast('A atualização foi adiada porque não foi possível confirmar os dados salvos. Tente novamente.', 'error');
      return;
    }
    setPwaReloading(true);
    const button = $('[data-action="pwa-update-apply"]');
    if (button) {
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
    }
    navigator.serviceWorker.addEventListener(
      'controllerchange',
      () => {
        window.location.reload();
      },
      { once: true },
    );
    waiting.postMessage({ type: 'SKIP_WAITING' });
  } finally {
    setPwaApplying(false);
  }
}
export function setToast(msg, tone, undo) {
  toastController.show(msg, tone, undo);
}
export function renderToast() {
  toastController.render();
}
export function resetSettingsTabBeforeLeaving() {
  const path = settingsRootPath(location);
  if (!path) return;
  history.replaceState(null, '', path);
  const url = new URL(path, location.href);
  activeRouteLocationKey = `config?${url.search.slice(1)}`;
}
let routeRenderFrame = null;
let activeRouteLocationKey = null;
function scheduleRouteRender() {
  if (routeRenderFrame !== null) return;
  routeRenderFrame = requestAnimationFrame(() => {
    routeRenderFrame = null;
    onRoute();
  });
}
function hasUnsavedSettingsChanges() {
  return Boolean(ui.profileDraft);
}
async function savePendingProfileDraft() {
  if (!hasUnsavedSettingsChanges()) return true;
  clearTimeout(profileAutosaveTimer);
  setProfileAutosaveTimer(null);
  return await saveProfileDraft();
}
export function nav(route) {
  const requestedPath = route.startsWith('/') ? route : routePathFor(route);
  const requestedUrl = new URL(requestedPath, location.href);
  const nextRoute = routeFromLocation(requestedUrl, new Set(Object.keys(ROUTES))).route;
  if (ui.route === 'config' && nextRoute !== 'config') resetSettingsTabBeforeLeaving();
  const destinationUrl = new URL(requestedPath, location.href);
  const preservedParams = new URLSearchParams(location.search);
  ['section', 'weight', 'etapa', 'revisao'].forEach((key) => preservedParams.delete(key));
  new URLSearchParams(destinationUrl.search).forEach((value, key) => preservedParams.set(key, value));
  destinationUrl.search = preservedParams.toString();
  const destination = `${destinationUrl.pathname}${destinationUrl.search}${destinationUrl.hash}`;
  const currentPath = `${location.pathname}${location.search}`;
  const nextPath = `${destinationUrl.pathname}${destinationUrl.search}`;
  if (hasUnsavedSettingsChanges() && nextRoute !== ui.route) {
    void savePendingProfileDraft().then((saved) => {
      if (!saved) return;
      history.pushState(null, '', destination);
      onRoute();
    });
    return;
  }
  if (currentPath !== nextPath) {
    history.pushState(null, '', destination);
    onRoute();
    return;
  }
  scheduleRouteRender();
}
function focusRouteTarget(id) {
  const target = document.getElementById(id);
  if (!target) return;
  target.focus({ preventScroll: true });
  target.scrollIntoView({ block: 'start' });
}
function loadFinanceModules() {
  if (financeDialogViews) return Promise.resolve();
  setFinanceModulesPromise(
    financeModulesPromise ||
      Promise.all([import('../features/finance/dialogs.js'), import('../features/finance/view.js')])
        .then(([dialogs, view]) => {
          setFinanceDialogViews(
            dialogs.createFinanceDialogViews({
              ui,
              S,
              catNames,
              topCategoryNames,
              categoryMatch,
              CAT_ICONS,
              CATEGORY_ICON_LABELS,
              LIST_COLORS,
              accountOptionLabel,
              accById,
              isCredit,
              expenseTitle,
              categoryInfo: catInfo,
              recById: (...args) => recById(...args),
              today,
              dlgWrap,
              dlgField,
              closeBtn,
              anticipationCandidates,
              money,
              accName,
            }),
          );
          setFinancePrivacyNotice(view.financePrivacyNotice);
          setRenderFinanceView(view.renderFinanceView);
        })
        .catch((error) => {
          setFinanceModulesPromise(null);
          throw error;
        }),
  );
  return financeModulesPromise;
}
function loadCycleModules() {
  if (cycleDialogViews) return Promise.resolve();
  setCycleModulesPromise(
    cycleModulesPromise ||
      Promise.all([
        import('../features/cycle/phases.js'),
        import('../features/cycle/dialogs.js'),
        import('../features/cycle/view.js'),
      ])
        .then(([phases, dialogs, view]) => {
          setEstimatedCyclePhase(phases.estimatedCyclePhase);
          setRenderCycleView(view.renderCycleView);
          setCycleDialogViews(
            dialogs.createCycleDialogViews({
              ui,
              CYC,
              CYC_ICON,
              CYC_OPTION_ICON,
              CYC_SHORT_LABEL,
              CYCLE_CONTRACEPTION_METHODS,
              CYCLE_TEST_RESULTS,
              cycLabel,
              dlgWrap,
              closeBtn,
              dlgField,
              today,
              MAX_CYCLE_PERIOD_DAYS,
            }),
          );
        })
        .catch((error) => {
          setCycleModulesPromise(null);
          throw error;
        }),
  );
  return cycleModulesPromise;
}
export function preloadInitialRouteModule() {
  const route = routeFromLocation(location, new Set(Object.keys(ROUTES))).route;
  if (route === 'financas') {
    void loadFinanceModules().catch((error) => {
      console.warn('Aurora: não foi possível antecipar o carregamento de Finanças.', error);
    });
  } else if (route === 'ciclo') {
    void loadCycleModules().catch((error) => {
      console.warn('Aurora: não foi possível antecipar o carregamento de Ciclo.', error);
    });
  } else if (route === 'habitos') {
    requestHabitsTemplate();
  }
}
export function preloadEnabledRouteModules() {
  const preload = () => {
    if (!accountSession || navigator.onLine === false) return;
    if (areaOn('finances')) {
      void loadFinanceModules().catch((error) => {
        console.warn('Aurora: não foi possível preparar Finanças para a próxima navegação.', error);
      });
    }
    if (areaOn('cycle')) {
      void loadCycleModules().catch((error) => {
        console.warn('Aurora: não foi possível preparar Ciclo para a próxima navegação.', error);
      });
    }
    if (areaOn('habits')) requestHabitsTemplate();
  };
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(preload, { timeout: 1500 });
  } else {
    window.setTimeout(preload, 300);
  }
}
export function openFinanceQuickAction(action) {
  ui.quickActionsOpen = false;
  if (financeDialogViews) {
    action();
    return;
  }
  const opener = ui.lastFocus;
  render();
  void loadFinanceModules().then(
    () => {
      ui.lastFocus = opener;
      action();
    },
    (error) => {
      console.error('Aurora: não foi possível carregar as ações de Finanças.', error);
      toast('Não foi possível carregar Finanças. Atualize a página e tente novamente.', 'error');
    },
  );
}
export function onRoute() {
  const wasBooted = ui.booted;
  const previousRoute = ui.route;
  const previousScroll = window.scrollY;
  ui.quickActionsOpen = false;
  const fallbackRoute = document.querySelector('meta[name="aurora-route"]')?.content || 'inicio';
  const resolved = routeFromLocation(location, new Set(Object.keys(ROUTES)), fallbackRoute);
  if (resolved.route === 'ciclo' && !canAccessCycle(S.settings.profile, ui.preview)) {
    const hasProfileSex = Boolean(S.settings.profile.sex);
    const destination = hasProfileSex ? '/inicio' : routePathFor('config?section=profile');
    history.replaceState(null, '', destination);
    resolved.route = hasProfileSex ? 'inicio' : 'config';
    resolved.query = hasProfileSex ? '' : 'section=profile';
    resolved.replacePath = null;
    toast(
      hasProfileSex
        ? 'Ciclo está disponível apenas para mulheres.'
        : 'Preencha sua identidade de gênero em Ajustes → Seu perfil. Ciclo está disponível apenas para mulheres.',
      'info',
    );
  }
  if (resolved.route === 'ciclo' && !cycleDialogViews) {
    const stopSkeleton = scheduleRouteSkeleton();
    void loadCycleModules()
      .then(() => {
        stopSkeleton();
        if (routeFromLocation(location, new Set(Object.keys(ROUTES))).route === 'ciclo') onRoute();
      })
      .catch((error) => {
        if (stopSkeleton()) render();
        console.error('Aurora: não foi possível carregar a área de Ciclo.', error);
        history.replaceState(null, '', '/inicio');
        toast('Não foi possível carregar Ciclo. Atualize a página e tente novamente.', 'error');
      });
    return;
  }
  if (resolved.route === 'financas' && !financeDialogViews) {
    const stopSkeleton = scheduleRouteSkeleton();
    void loadFinanceModules()
      .then(() => {
        stopSkeleton();
        if (routeFromLocation(location, new Set(Object.keys(ROUTES))).route === 'financas') onRoute();
      })
      .catch((error) => {
        if (stopSkeleton()) render();
        console.error('Aurora: não foi possível carregar a área de Finanças.', error);
        history.replaceState(null, '', '/inicio');
        toast('Não foi possível carregar Finanças. Atualize a página e tente novamente.', 'error');
      });
    return;
  }
  if (resolved.replacePath) history.replaceState(null, '', resolved.replacePath);
  if (wasBooted && previousRoute === 'config' && resolved.route !== 'config' && hasUnsavedSettingsChanges()) {
    const destination = `${location.pathname}${location.search}${location.hash}`;
    history.replaceState(history.state, '', routePathFor(`config?section=${encodeURIComponent(ui.settingsTab)}`));
    void savePendingProfileDraft().then((saved) => {
      if (!saved) return;
      history.replaceState(history.state, '', destination);
      onRoute();
    });
    return;
  }
  const routeLocationKey = `${resolved.route}?${resolved.query}`;
  if (wasBooted && routeLocationKey === activeRouteLocationKey) return;
  activeRouteLocationKey = routeLocationKey;
  ui.booted = true;
  const { query } = resolved;
  ui.route = resolved.route;
  if (ui.route === 'planejar' && new URLSearchParams(query).get('revisao') === 'semana') {
    ui.planView = 'revisao';
  }
  const routeChanged = wasBooted && previousRoute !== ui.route;
  if (routeChanged) routeScrollPositions.set(previousRoute, previousScroll);
  const targetFocus = new URLSearchParams(query).has('weight') ? 'pk' : null;
  const requestedSettingsTab = settingsTabId(new URLSearchParams(query).get('section'));
  if (ui.route === 'config') {
    ui.settingsTab = SETTINGS_SECTIONS.some(([id]) => id === requestedSettingsTab) ? requestedSettingsTab : 'profile';
  }
  render();
  if (resolved.scrollTarget) requestAnimationFrame(() => focusRouteTarget(resolved.scrollTarget));
  if (targetFocus) {
    requestAnimationFrame(() => {
      const el = document.getElementById(targetFocus);
      if (el) {
        el.focus();
        try {
          el.setSelectionRange(el.value.length, el.value.length);
        } catch (e) {
          /* tipo sem seleção */
        }
      }
    });
  }
  if (routeChanged) {
    requestAnimationFrame(() => {
      const heading = $('#app .main h1:not(.sr)');
      if (heading) {
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
      }
      window.scrollTo(0, routeScrollPositions.get(ui.route) || 0);
      syncHeaderScrollState();
    });
  }
}
export function setActiveRouteLocationKey(value) {
  activeRouteLocationKey = value;
  return value;
}

export function registerRender() {
  window.addEventListener('scroll', syncHeaderScrollState, { passive: true });
  document.addEventListener('transitionend', (event) => {
    if (event.target instanceof Element && event.target.matches('.app > .topbar')) syncTopbarOffset();
  });
  syncHeaderScrollState();
  if (systemThemeQuery) {
    const updateSystemTheme = () => {
      if (settingsView().look.mode === 'auto') applyTheme();
    };
    if (typeof systemThemeQuery.addEventListener === 'function')
      systemThemeQuery.addEventListener('change', updateSystemTheme);
    else systemThemeQuery.addListener(updateSystemTheme);
  }
  document.addEventListener(
    'click',
    (event) => {
      if (
        ui.route !== 'config' ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey ||
        !(event.target instanceof Element)
      )
        return;
      const link = event.target.closest('a[href^="/"]');
      if (!link || (link.target && link.target !== '_self')) return;
      const targetRoute = routeFromLocation(new URL(link.href), new Set(Object.keys(ROUTES))).route;
      if (targetRoute !== 'config') {
        resetSettingsTabBeforeLeaving();
      }
    },
    true,
  );
  document.addEventListener(
    'click',
    (event) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey ||
        !(event.target instanceof Element)
      )
        return;
      const link = event.target.closest('a[href^="/"]');
      if (!link || link.dataset.action || link.download || (link.target && link.target !== '_self')) return;
      const destinationUrl = new URL(link.href);
      if (destinationUrl.origin !== location.origin) return;
      event.preventDefault();
      nav(`${destinationUrl.pathname}${destinationUrl.search}${destinationUrl.hash}`);
    },
    true,
  );
}
