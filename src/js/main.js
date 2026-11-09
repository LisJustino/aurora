import { $, $$, esc, h, raw } from './utils/dom.js';
import { icon } from './utils/icons.js';
import { brl, formatMoneyInput, parseMoney } from './utils/currency.js';
import {
  addDays, addMonths, clock, dayDiff, DIAS, dk, dur, isoDay, isDay, longDate,
  MESES, MESES_L, normalizeDay, pad, pk, shortDate, today,
} from './utils/dates.js';
import { newId } from './utils/ids.js';
import { getPageScrollPosition, lockPageScroll } from './utils/scroll-lock.js';
import { filterValidRecords, isPlainObject } from './core/data-integrity.js';
import {
  accountModeFromLocation,
  accountPathForMode,
  isDemoLocation,
  isPublicLandingLocation,
  postSignOutPath,
  redirectToPublicLanding,
  routeFromLocation,
  routePathFor,
  settingsRootPath,
} from './core/router.js';
import {
  accountBalance as balanceForAccount,
  netAccountBalanceOn,
  byCategory as summarizeByCategory,
  cardInfo as calculateCardInfo,
  invoiceMonth,
  isCreditAccount,
  isPaid as transactionIsPaid,
  monthStats as summarizeMonth,
  monthlyCloseSummary as summarizeMonthlyClose,
  netAccountBalance,
  reportMonthStats,
  recurringBillsDueOn,
  signedAmount,
} from './features/finance/calculations.js';
import {
  ACCOUNT_TYPES,
  isValidAccountType,
  normalizeAccountType,
} from './features/finance/accounts.js';
import {
  AREA_GUIDES,
  FINANCE_PRIVACY_NOTICE,
  isValidAreaTutorialsSeen,
  normalizeAreaTutorialsSeen,
} from './features/area-guides.js';
import { loadHabitsTemplate, renderHabitsTemplate } from './features/habits/template.js';
import { renderHabitsView } from './features/habits/view.js';
import { isTaskIconKey, TASK_ICONS, taskIconKey } from './features/planning/task-icons.js';
import { createCycleDialogViews } from './features/cycle/dialogs.js';
import { canAccessCycle } from './features/cycle/access.js';
import { createFinanceDialogViews } from './features/finance/dialogs.js';
import { backupReminderStatus } from './features/backup/reminder.js';
import { containsRemovedStudyData } from './features/backup/validation.js';
import {
  getReleaseNotes,
  markReleaseNotesSeen,
  shouldShowReleaseNotes,
} from './features/release-notes.js';
import { normalizeLegacyTimerHistory } from './data/legacy-timer.js';
import {
  cancelHabitPushReminders,
  clearPushNotificationState,
  configurePushNotificationStore,
  disablePushNotifications,
  enablePushNotifications,
  getPushNotificationStatus,
  initializePushNotifications,
  pushNotificationErrorMessage,
  scheduleHabitPushReminders,
} from './services/push-notifications.js';
import { renderLanding, renderLandingDemo } from './features/landing/view.js';
import { stopLandingDemo } from './features/landing/demo.js';
import {
  initializeFaqDisclosure,
  renderFooterContent,
  renderLegalDialog,
} from './features/footer/view.js';

let googleCalendarServiceFactory = null;
let googleCalendarServicePromise = null;
function loadGoogleCalendarServiceFactory() {
  if (!googleCalendarServicePromise) {
    googleCalendarServicePromise = import('./services/google-calendar.js')
      .then(({ createGoogleCalendarService }) => {
        googleCalendarServiceFactory = createGoogleCalendarService;
        return googleCalendarServiceFactory;
      })
      .catch((error) => {
        googleCalendarServicePromise = null;
        throw error;
      });
      window.addEventListener('aurora:push-notification', (event) => {
        const kind = event.detail?.kind;
        if (kind === 'habit-reminder') toast('Um horário de hábito chegou. Abra Hábitos para conferir sua rotina.');
      });
  }
  return googleCalendarServicePromise;
}
let googleCalendarPendingService = null;
let googleCalendarConnectionSequence = 0;
const googleCalendar = {
  isConfigured: () => Boolean(import.meta.env?.VITE_GOOGLE_CALENDAR_CLIENT_ID?.trim()),
  isConnected: () => ui.googleCalendar.accounts.some((account) => account.service.isConnected()),
  isPrepared: () => googleCalendarPendingService?.isPrepared() || false,
  clear: () => {
    googleCalendarPendingService?.clear();
    googleCalendarPendingService = null;
    ui.googleCalendar.accounts.forEach((account) => account.service.clear());
  },
  prepare: async () => {
    const createService = await loadGoogleCalendarServiceFactory();
    googleCalendarPendingService = createService();
    await googleCalendarPendingService.prepare();
  },
  authorize: () => {
    if (!googleCalendarPendingService) throw new Error('Prepare a conexão com o Google antes de autorizar.');
    return googleCalendarPendingService.authorize({ prompt: 'select_account' });
  },
  getEvents: async (account, ...args) => account.service.getEvents(...args),
};
import { initializeLegalDialogEvents } from './features/footer/legal-dialog.js';
import { createSuggestionMailto } from './features/footer/suggestions.js';
import { handlePublicControl, handlePublicKeydown, initializePublicAppearance } from './features/appearance/public-controls.js';
import {
  createCycleDataConsentMetadata,
  createCycleDataConsentRevocationMetadata,
  hasCurrentCycleDataConsent,
} from './services/account-auth.js';
import { prefersReducedMotion } from './utils/motion.js';
import {
  createCyclePeriod,
  cycleLogDays,
  cyclePeriodDays,
  mergeCycleLogSymptoms,
  MAX_CYCLE_LOG_RANGE_DAYS,
  MAX_CYCLE_PERIOD_DAYS,
} from './features/cycle/period.js';
import {
  createBirthdayReferenceFromParts,
  isValidBirthdayReference,
} from './features/profile/birthday.js';
import { filterWeightInput } from './features/profile/weight.js';
import {
  normalizeProfileAppearance,
  PROFILE_APPEARANCE_DEFAULT,
  PROFILE_AVATARS,
  PROFILE_AVATAR_COLORS,
  PROFILE_GREETING_STYLES,
  PROFILE_SEX,
  timeBasedGreeting,
} from './features/profile/model.js';
import {
  defaultHomeLayout as defaultHomeLayoutModel,
  defaultHomeModes,
  defaultHomeShortcuts,
  HOME_AREA_COLORS,
  HOME_BLOCKS,
  HOME_BLOCK_IDS,
  HOME_MESSAGE_MAX_LENGTH,
  HOME_MODES,
  HOME_SHORTCUTS,
  HOME_SHORTCUT_IDS,
  normalizeHomeAreaColors,
  normalizeHomeLayout,
  normalizeHomeMessage,
  normalizeHomeMode,
  normalizeHomeModes,
  normalizeHomeShortcuts,
  homeAreaColorValue,
} from './features/home/personalization.js';
import { initializeCustomSelects } from './features/selects/custom-select.js';
import { showPwaInstallPrompt, startPwaInstallPrompt } from './services/pwa-install.js';
import { isNativeApp } from './utils/platform.js';
import {
  habitWeeklyTarget,
  habitWeekReview,
  habitIsComplete,
  filterSuggestedHabits,
  featuredHabitSuggestions,
  habitSuggestionTags,
  habitMonthDays,
  habitMonthStats,
  habitStats,
  habitWeekOverview,
  isWaterHabit,
  isValidHabit,
  normalizeHabits,
  remainingHabitSuggestions,
  SUGGESTED_HABITS,
  SUGGESTED_HABIT_CATEGORIES,
  SUGGESTED_HABIT_TAGS,
  HABIT_ICONS,
  HABIT_ICON_KEYS,
  HABIT_COLORS,
  DEFAULT_HABIT_ICON,
  DEFAULT_HABIT_COLOR,
  habitIconKey,
  habitColor,
  habitIsSkipped,
} from './features/habits/model.js';
import {
  estimateWaterGoal,
  isValidWaterGoalMl,
  parseWaterMl,
  parseWaterWeightKg,
  waterGoalForHabit,
  waterGoalReached,
  waterMlForDay,
} from './features/habits/water-goal.js';
import { APPEARANCE_PRESETS, hexOk, LOOK_DEFAULT, PALETTES, paletteColors } from './features/appearance/palettes.js';
import {
  DEFAULT_VISIBLE_MENU_ITEMS,
  DEFAULT_MENU_ORDER,
  canMoveMenuItem,
  defaultMenuPreferences,
  HIDDEN_MENU_IDS,
  isDefaultMenuPreferences,
  isValidMenuOrder,
  isValidVisibleMenuItems,
  MENU_ITEMS,
  moveMenuItem,
  normalizeMenuOrder,
  normalizeVisibleMenuItems,
  orderMenuItems,
} from './features/navigation/menu.js';
import { tasksForWeek, weekDays, weeklyReview } from './features/planning/week.js';
import { nextDue } from './features/planning/recurrence.js';
import { searchRecords } from './features/search/search.js';
import {
  isTrashExpired,
  isValidTrashEntry as isValidTrashEntryModel,
  normalizeTrash,
  sortTrashEntriesByExpiry,
  trashDaysRemaining,
} from './features/trash/model.js';
import { estimatedCyclePhase } from './features/cycle/phases.js';
import { CYCLE_CONTRACEPTION_METHODS, isValidCycleSexualLog } from './features/cycle/log.js';
'use strict';

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

/* ========== Núcleo: templates, datas, estado e persistência ========== */
const weekStartDay = () => { try { return settingsView().look.weekStart === 0 ? 0 : 1; } catch (e) { return 1; } };
const REPEATS = { none: 'Nunca', day: 'Todo dia', weekday: 'Dias úteis', week: 'Toda semana', month: 'Todo mês', year: 'Todo ano' };
const REMINDS = [['', 'Sem lembrete'], ['0', 'Na hora'], ['10', '10 min antes'], ['30', '30 min antes'], ['60', '1 hora antes'], ['1440', '1 dia antes']];
const isTime = (v) => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
const orderOf = (t) => (t.order != null ? t.order : t.createdAt || 0);
function parseTags(raw_) {
  const tags = []; const title = String(raw_).replace(/(^|\s)#([\p{L}\d_-]{1,24})/gu, (m, sp, tg) => { const k = tg.toLowerCase(); if (!tags.includes(k)) tags.push(k); return sp; }).replace(/\s{2,}/g, ' ').trim();
  return { title: title || String(raw_).trim(), tags };
}
const allTags = () => [...new Set(S.tasks.flatMap((t) => t.tags || []))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const norm = (s) => String(s).toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[̀-ͯ]/g, '');
const plural = (n, a, b) => n === 1 ? a : b;

const LIST_COLORS = ['#c97994', '#e07a5f', '#d9a05b', '#a3b55a', '#5fa68a', '#5aa5b8', '#7c8fd4', '#8a7ac4', '#a24f9e', '#d6455d', '#8b8b95', '#ad8c76'];
const CAT_ICONS = ['utensils', 'home', 'car', 'heart', 'book', 'sparkles', 'bag', 'repeat', 'user', 'tag', 'wallet', 'plus', 'trendUp', 'calendar', 'card', 'bank'];
const CATEGORY_ICON_LABELS = {
  utensils: 'Alimentação', home: 'Casa', car: 'Transporte', heart: 'Saúde',
  book: 'Educação', sparkles: 'Brilho', bag: 'Compras', repeat: 'Recorrência',
  user: 'Pessoa', tag: 'Etiqueta', wallet: 'Carteira', plus: 'Mais',
  trendUp: 'Rendimentos', calendar: 'Calendário', card: 'Cartão', bank: 'Banco',
};
const DEF_LISTS = [{ name: 'Pessoal', color: '#c97994' }];
const DEF_CATS = {
  out: [['Alimentação', '#c97994', 'utensils'], ['Moradia', '#7c8fd4', 'home'], ['Transporte', '#5fa68a', 'car'], ['Saúde', '#d9a05b', 'heart'], ['Educação', '#8a7ac4', 'book'], ['Lazer', '#d27a6a', 'sparkles'], ['Compras', '#5aa5b8', 'bag'], ['Assinaturas', '#a3b55a', 'repeat'], ['Cuidados pessoais', '#b78a6e', 'user'], ['Outros', '#8b8b95', 'tag']],
  in: [['Salário', '#3d9a6b', 'wallet'], ['Renda extra', '#5fb08a', 'plus'], ['Rendimentos', '#7bb89c', 'trendUp'], ['Presente', '#8fc7a8', 'sparkles'], ['Reembolso', '#4f9a74', 'repeat'], ['Outros', '#8b8b95', 'tag']]
};
const defCats = () => ({ out: DEF_CATS.out.map(([name, color, icon]) => ({ name, color, icon, subcategories: [] })), in: DEF_CATS.in.map(([name, color, icon]) => ({ name, color, icon, subcategories: [] })) });
const categoryLeafName = (category) => {
  if (typeof category === 'string') return category.trim();
  if (isPlainObject(category) && typeof category.name === 'string') return category.name.trim();
  return '';
};
const categoryPathParts = (value) => {
  const text = String(value ?? '').trim();
  const parts = text.split(/\s*>\s*/).map((part) => part.trim()).filter(Boolean);
  if (!parts.length) return { parent: '', child: '' };
  if (parts.length === 1) return { parent: '', child: parts[0] };
  return { parent: parts[0], child: parts.slice(1).join(' > ') };
};
const normalizeCategoryEntry = (category) => {
  if (typeof category === 'string') {
    const name = category.trim();
    return name ? { name: name.slice(0, 30), color: '#8b8b95', icon: 'tag', subcategories: [] } : null;
  }
  if (!isPlainObject(category) || typeof category.name !== 'string') return null;
  const name = category.name.trim();
  if (!name) return null;
  const subcategories = Array.isArray(category.subcategories)
    ? category.subcategories.map((item) => normalizeCategoryEntry(item)).filter(Boolean)
    : [];
  return {
    name: name.slice(0, 30),
    color: hexOk(category.color) ? category.color : '#8b8b95',
    icon: CAT_ICONS.includes(category.icon) ? category.icon : 'tag',
    subcategories: subcategories.slice(0, 20),
  };
};
const categoryEntries = (kind) => (Array.isArray(S.settings.cats?.[kind]) ? S.settings.cats[kind] : []).map((category) => normalizeCategoryEntry(category)).filter(Boolean);
const topCategoryNames = (kind) => categoryEntries(kind).map((category) => category.name);
const categoryMatch = (kind, value) => {
  const target = String(value ?? '').trim();
  if (!target) return null;
  const { parent, child } = categoryPathParts(target);
  const categories = categoryEntries(kind);
  if (parent) {
    const parentEntry = categories.find((category) => norm(category.name) === norm(parent));
    if (!parentEntry) return null;
    const subcategory = (parentEntry.subcategories || []).find((category) => norm(categoryLeafName(category)) === norm(child));
    return subcategory ? { category: parentEntry, subcategory, fullName: `${parentEntry.name} > ${categoryLeafName(subcategory)}` } : null;
  }
  const direct = categories.find((category) => norm(category.name) === norm(target));
  if (direct) return { category: direct, subcategory: null, fullName: direct.name };
  for (const category of categories) {
    const subcategory = (category.subcategories || []).find((item) => norm(categoryLeafName(item)) === norm(target));
    if (subcategory) return { category, subcategory, fullName: `${category.name} > ${categoryLeafName(subcategory)}` };
  }
  return null;
};
const catNames = (k) => categoryEntries(k).flatMap((category) => {
  const subcategories = Array.isArray(category.subcategories) ? category.subcategories.map((subcategory) => `${category.name} > ${categoryLeafName(subcategory)}`) : [];
  return [category.name, ...subcategories];
});
const catInfo = (k, n) => {
  const match = categoryMatch(k, n);
  if (!match) return { c: '#8b8b95', i: 'tag' };
  const source = match.subcategory || match.category;
  return { c: source.color || '#8b8b95', i: source.icon || 'tag' };
};
const OTHER_BANK = 'other';
const BANKS = {
  nubank: { name: 'Nubank', logo: new URL('../assets/bank-logos/18236120.svg', import.meta.url).href },
  itau: { name: 'Itaú', logo: new URL('../assets/bank-logos/60701190.svg', import.meta.url).href },
  bradesco: { name: 'Bradesco', logo: new URL('../assets/bank-logos/60746948.svg', import.meta.url).href },
  banco_do_brasil: { name: 'Banco do Brasil', logo: new URL('../assets/bank-logos/00000000.svg', import.meta.url).href },
  santander: { name: 'Santander', logo: new URL('../assets/bank-logos/90400888.svg', import.meta.url).href },
  caixa: { name: 'Caixa', logo: new URL('../assets/bank-logos/00360305.svg', import.meta.url).href },
  inter: { name: 'Inter', logo: new URL('../assets/bank-logos/00416968.svg', import.meta.url).href },
  c6: { name: 'C6 Bank', logo: new URL('../assets/bank-logos/31872495.svg', import.meta.url).href },
  picpay: { name: 'PicPay', logo: new URL('../assets/bank-logos/22896431.svg', import.meta.url).href },
  mercado_pago: { name: 'Mercado Pago', logo: new URL('../assets/bank-logos/10573521.svg', import.meta.url).href },
  sicredi: { name: 'Sicredi', logo: new URL('../assets/bank-logos/01181521.svg', import.meta.url).href },
  sicoob: { name: 'Sicoob', logo: new URL('../assets/bank-logos/02038232.svg', import.meta.url).href },
};
const findBankByName = (value, allowPrefix = false) => {
  const query = norm(String(value || '').trim());
  if (!query) return null;
  const entries = Object.entries(BANKS);
  return entries.find(([key, bank]) => norm(key) === query || norm(bank.name) === query)
    || (allowPrefix ? entries.find(([, bank]) => norm(bank.name).startsWith(query)) : null)
    || null;
};
const bankFieldValue = (value) => value === OTHER_BANK
  ? 'Outro / não listado'
  : Object.hasOwn(BANKS, value) ? BANKS[value].name : value || '';
const AREAS = { finances: ['Finanças', 'Contas, entradas e saídas'], cycle: ['Ciclo', 'Registro e estimativas'], habits: ['Hábitos', 'Rotinas e histórico semanal'] };
const SEX = PROFILE_SEX;
const hasRequiredProfile = (profile) => typeof profile?.name === 'string'
  && Boolean(profile.name.trim());
const CASE_TERMS = new Set(['Android', 'CSV', 'Google', 'HTTPS', 'iPhone', 'JSON', 'MB', 'mL', 'OFX', 'Push', 'URL', 'VAPID']);
const preserveCopyTerms = (text) => h`${String(text).split(/\b(Android|CSV|Google|HTTPS|iPhone|JSON|MB|mL|OFX|Push|URL|VAPID)\b/g).map((part) => {
  return CASE_TERMS.has(part) ? h`<span class="case-preserve">${part}</span>` : part;
})}`;
const PRIO = { low: 'Baixa', normal: 'Normal', high: 'Alta' };
const defaultHomeLayout = defaultHomeLayoutModel;
function saveActiveHomeMode(settings) {
  const { homeMode, homeLayout, homeShortcuts } = settings.prefs;
  settings.prefs.homeModes[homeMode] = {
    layout: { order: [...homeLayout.order], visible: [...homeLayout.visible] },
    shortcuts: [...homeShortcuts],
  };
}

/* ---------- Estado ---------- */
const defaults = () => ({
  tasks: [],
  habits: [],
  pomodoro: { elapsedSeconds: 0, startedAt: null, phase: 'focus', phaseElapsedSeconds: 0, completedPomodoros: 0, dailyCompletedPomodoros: 0, dailyCompletedOn: '', focusTaskId: '' },
  settings: { profile: { name: '', preferredName: '', sex: '', age: null, weightKg: null, heightCm: null }, areas: { finances: false, gym: false, water: false, cycle: false, habits: false }, theme: 'rose', look: { ...LOOK_DEFAULT }, lists: DEF_LISTS.map((x) => ({ ...x })), cats: defCats(), weightTracking: false, onboardingComplete: false, introSeen: false, prefs: { waterGoalMl: 2000, birthday: null, birthdayCorrectionUsed: false, areaTutorialsSeen: [], firstStepsDismissed: false, menuOrder: [...DEFAULT_MENU_ORDER], visibleMenuItems: [...DEFAULT_VISIBLE_MENU_ITEMS], homeLayout: defaultHomeLayout(), homeMode: 'overview', homeModes: defaultHomeModes(), homeShortcuts: defaultHomeShortcuts(), homeMessage: '', areaColors: {}, profileAppearance: { ...PROFILE_APPEARANCE_DEFAULT }, lastBackup: null, sample: false, weeklyReflection: null, trash: [] } },
  water: [], gym: { templates: [], logs: [] }, finance: { accounts: [], tx: [], budgets: {}, goals: [], recurring: [] }, cycle: [], cycleLog: {}, weight: [],
});
const SLICES = Object.keys(defaults());
let S = defaults();
let accountSession = null;
let releaseNoticePending = false;
let pwaRegistration = null;
let pwaReloading = false;
let pwaSupportPromise = null;
const syncState = {
  pending: new Set(),
  failed: new Set(),
  conflicts: new Set(),
};
const SIDEBAR_COLLAPSED_KEY = 'aurora.ui.sidebar-collapsed';
const readSidebarCollapsed = () => {
  try { return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1'; } catch { return false; }
};
const writeSidebarCollapsed = (collapsed) => {
  try {
    if (collapsed) localStorage.setItem(SIDEBAR_COLLAPSED_KEY, '1');
    else localStorage.removeItem(SIDEBAR_COLLAPSED_KEY);
  } catch { /* storage indisponível */ }
};
const ui = { preview: false, dragId: null, alerts: {}, fired: {}, snooze: {}, remindersPausedUntil: 0, notificationsOpen: false, navigationOpen: false, quickActionsOpen: false, sidebarCollapsed: readSidebarCollapsed(), planView: 'lista', taskCal: dk().slice(0, 7), taskWeek: today(), taskDay: dk(), googleCalendar: { status: 'disconnected', accounts: [], error: '', requestId: 0 }, habitMonth: today().slice(0, 7), habitSuggestions: null, habitIdeaCategory: 'all', habitIdeaTag: 'all', habitIdeasExpanded: false, profileDraft: null, profileSaving: false, settingsDraft: null, settingsDraftBase: null, settingsSaving: false, route: 'inicio', status: 'local', toast: null, dlg: null, dlgPending: null, confirmPrevious: null, confirmResolver: null, confirmedAction: null, returnDialog: null, focusActive: false, settingsTab: 'profile', pushBusy: false, habitPushNotice: '', pwaUpdateAvailable: false, pwaUpdateDismissed: false, exploreNoticeDismissed: false, filters: { f: 'todas', q: '', sort: 'prazo' }, finMonth: dk().slice(0, 7), finTab: 'resumo', finFilter: 'todos', finAcc: '', finQ: '', finView: 'lista', finDay: '', finCat: '', repKind: 'out', repBasis: 'competence', calMonth: dk().slice(0, 7), openDetails: {}, persistFailed: new Set(), persistError: '', persistBlocked: new Set(), integrityIssues: {}, legacyImport: { step: 'start', browserData: null, discovery: null, preview: null, error: '', busy: false, completed: false, cleanup: null, cleanupConfirmed: false } };
ui.cycleConsentBusy = false;
ui.cycleConsentError = '';
const notificationAnnouncer = document.getElementById('notification-announcer') || (() => {
  const announcer = document.createElement('div');
  announcer.id = 'notification-announcer';
  announcer.className = 'sr';
  announcer.setAttribute('role', 'status');
  announcer.setAttribute('aria-live', 'polite');
  announcer.setAttribute('aria-atomic', 'true');
  document.body.append(announcer);
  return announcer;
})();
const stamps = {};
const cloneSettings = (settings) => JSON.parse(JSON.stringify(settings));
function sameJsonValue(a, b) {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b)
      && a.length === b.length
      && a.every((value, index) => sameJsonValue(value, b[index]));
  }
  const keysA = Object.keys(a).sort();
  const keysB = Object.keys(b).sort();
  return keysA.length === keysB.length
    && keysA.every((key, index) => key === keysB[index] && sameJsonValue(a[key], b[key]));
}
function mergeSettingsDraft(base, draft, current) {
  if (isPlainObject(base) && isPlainObject(draft) && isPlainObject(current)) {
    const merged = { ...current };
    Object.keys(draft).forEach((key) => {
      if (Object.hasOwn(base, key)) merged[key] = mergeSettingsDraft(base[key], draft[key], current[key]);
      else merged[key] = cloneSettings(draft[key]);
    });
    return merged;
  }
  return JSON.stringify(base) === JSON.stringify(draft) ? current : cloneSettings(draft);
}
function settingsView() {
  return ui.settingsDraft
    ? mergeSettingsDraft(ui.settingsDraftBase, ui.settingsDraft, S.settings)
    : S.settings;
}
function withoutRemovedStudyTrash(entries) {
  if (!Array.isArray(entries)) return entries;
  const removedCollections = new Set(['subjects', 'sessions', 'timer.subject']);
  return entries.flatMap((entry) => {
    if (!Array.isArray(entry?.records)) return [entry];
    const records = entry.records.filter((record) => !removedCollections.has(record?.collection));
    return records.length ? [{ ...entry, records }] : [];
  });
}
function refreshSettingsSaveControls() {
  const dirty = settingsDraftDirty();
  const saving = ui.settingsSaving || ui.profileSaving;
  document.querySelectorAll('[data-settings-save-button]').forEach((button) => {
    button.disabled = !dirty || saving;
    button.textContent = saving ? 'Salvando...' : button.dataset.settingsSaveLabel || 'Salvar alterações';
    button.setAttribute('aria-busy', String(saving));
  });
  document.querySelectorAll('[data-settings-discard-button]').forEach((button) => {
    button.disabled = !dirty || saving;
    button.hidden = !dirty;
  });
  refreshUnsavedSettingsBanner();
}
function refreshUnsavedSettingsBanner() {
  const banner = document.querySelector('.settings-unsaved-bar');
  if (!banner) return;
  const dirty = Boolean(ui.profileDraft || settingsDraftDirty());
  const saving = ui.profileSaving || ui.settingsSaving;
  banner.hidden = !dirty;
  const discardButton = banner.querySelector('[data-action="profile-discard"]');
  if (discardButton) discardButton.disabled = !dirty || saving;
  const saveButton = banner.querySelector('[data-action="profile-save"]');
  if (saveButton) {
    saveButton.disabled = !dirty || saving;
    saveButton.textContent = saving ? 'Salvando...' : 'Salvar alterações';
    saveButton.setAttribute('aria-busy', String(saving));
  }
}
function updateSettingsDraft(update, shouldRender = true) {
  if (!ui.settingsDraft) {
    ui.settingsDraftBase = cloneSettings(S.settings);
    ui.settingsDraft = cloneSettings(S.settings);
  }
  update(ui.settingsDraft);
  if (shouldRender) render();
  else refreshSettingsSaveControls();
}
function settingsDraftDirty() {
  return Boolean(ui.settingsDraft && JSON.stringify(settingsView()) !== JSON.stringify(S.settings));
}
async function saveSettingsDraft() {
  if (!settingsDraftDirty() || ui.settingsSaving || ui.profileSaving) return;
  const previousSettings = cloneSettings(S.settings);
  const draft = settingsView();
  ui.settingsSaving = true;
  render();
  try {
    S.settings = normalizeSettings(draft);
    if (!saveSlices('settings')) {
      S.settings = previousSettings;
      return;
    }
    if (!ui.preview && !(await Persist.flush())) {
      S.settings = previousSettings;
      return;
    }
    ui.settingsDraft = null;
    ui.settingsDraftBase = null;
    toast(ui.preview
      ? 'Alterações aplicadas nesta demonstração; elas não serão salvas após sair.'
      : 'Configurações salvas.');
  } catch (error) {
    console.error('Aurora: não foi possível preparar os ajustes para salvar.', error);
    S.settings = previousSettings;
    toast('Não foi possível salvar os ajustes. Suas alterações continuam na tela; tente novamente.');
  } finally {
    ui.settingsSaving = false;
    render();
  }
}
async function saveProfileDraft() {
  if (ui.profileSaving || ui.settingsSaving) return;
  const draft = ui.profileDraft || profileDraftFromSettings(S.settings);
  const ageInput = String(draft.age ?? '').trim();
  const age = ageInput ? Number(ageInput) : null;
  if (!draft.name.trim()) { toast('Informe seu nome.'); $('#pname')?.focus(); return; }
  if (!draft.preferredName.trim()) { toast('Informe como prefere ser chamado(a).'); $('#ppreferred')?.focus(); return; }
  if (!Object.hasOwn(SEX, draft.sex)) { toast('Selecione uma identidade de gênero.'); $('#psex')?.focus(); return; }
  if (ageInput && (!Number.isInteger(age) || age < 0 || age > 120)) {
    toast('A idade deve ser um número inteiro entre 0 e 120 anos.');
    $('#page')?.focus();
    return;
  }
  const previousSettings = cloneSettings(S.settings);
  ui.profileSaving = true;
  render();
  try {
    Object.assign(S.settings.profile, {
      name: draft.name.trim().slice(0, 50),
      preferredName: draft.preferredName.trim().slice(0, 50),
      sex: draft.sex,
      age,
    });
    S.settings.prefs.profileAppearance = normalizeProfileAppearance(draft.appearance);
    if (!saveSlices('settings')) {
      S.settings = previousSettings;
      toast('Não foi possível salvar as alterações. Tente novamente.');
      return;
    }
    if (!ui.preview && !(await Persist.flush())) {
      S.settings = previousSettings;
      return;
    }
    ui.profileDraft = null;
    toast(ui.preview
      ? 'Alterações aplicadas nesta demonstração; elas não serão salvas após sair.'
      : 'Perfil salvo.');
  } catch (error) {
    S.settings = previousSettings;
    console.error('Aurora: não foi possível salvar o perfil.', error);
    toast('Não foi possível salvar o perfil. Suas alterações continuam na tela; tente novamente.');
  } finally {
    ui.profileSaving = false;
    render();
  }
}
function settingsSaveButton(label = 'Salvar alterações') {
  const dirty = settingsDraftDirty();
  const saving = ui.settingsSaving || ui.profileSaving;
  return h`<div class="row settings-save-actions${dirty ? ' is-dirty' : ''}"><button class="btn back" type="button" data-settings-discard-button data-action="discard-settings" ${dirty && !saving ? '' : raw('disabled hidden')}>Descartar alterações</button><button class="btn primary" type="submit" data-settings-save-button data-settings-save-label="${label}" aria-busy="${String(saving)}" ${dirty && !saving ? '' : raw('disabled')}>${saving ? 'Salvando...' : label}</button></div>`;
}
let habitsTemplate = null;
let habitsTemplatePromise = null;
let habitsTemplateError = false;
let renderedRoute = null;
const routeScrollPositions = new Map();

function normalizeSettings(s) {
  const d = defaults().settings;
  const source = isPlainObject(s) ? s : {};
  const profile = isPlainObject(source.profile) ? source.profile : {};
  const areas = isPlainObject(source.areas) ? source.areas : {};
  const prefs = isPlainObject(source.prefs) ? source.prefs : {};
  const o = { ...d, ...source };
  o.profile = { ...d.profile, ...profile };
  o.profile.name = typeof profile.name === 'string' ? profile.name.slice(0, 50) : d.profile.name;
  o.profile.preferredName = typeof profile.preferredName === 'string' && profile.preferredName.trim()
    ? profile.preferredName.slice(0, 50)
    : o.profile.name;
  o.profile.sex = Object.hasOwn(SEX, profile.sex) ? profile.sex : '';
  o.profile.age = Number.isInteger(profile.age) && profile.age >= 0 && profile.age <= 120 ? profile.age : null;
  o.profile.weightKg = Number.isFinite(profile.weightKg) && profile.weightKg >= 20 && profile.weightKg <= 400 ? profile.weightKg : null;
  o.profile.heightCm = Number.isInteger(profile.heightCm) && profile.heightCm >= 80 && profile.heightCm <= 250 ? profile.heightCm : null;
  o.areas = Object.fromEntries(Object.keys(d.areas).map((key) => [key, typeof areas[key] === 'boolean' ? areas[key] : d.areas[key]]));
  o.prefs = { ...d.prefs, ...prefs };
  delete o.prefs.studyGoalMin;
  o.prefs.trash = withoutRemovedStudyTrash(o.prefs.trash);
  o.prefs.menuOrder = normalizeMenuOrder(prefs.menuOrder);
  o.prefs.visibleMenuItems = normalizeVisibleMenuItems(prefs.visibleMenuItems);
  o.prefs.areaTutorialsSeen = normalizeAreaTutorialsSeen(prefs.areaTutorialsSeen);
  o.prefs.homeLayout = normalizeHomeLayout(prefs.homeLayout);
  o.prefs.homeMode = normalizeHomeMode(prefs.homeMode);
  o.prefs.homeShortcuts = normalizeHomeShortcuts(prefs.homeShortcuts);
  o.prefs.homeModes = normalizeHomeModes(prefs.homeModes);
  if (!isPlainObject(prefs.homeModes)) {
    o.prefs.homeModes[o.prefs.homeMode] = {
      layout: { order: [...o.prefs.homeLayout.order], visible: [...o.prefs.homeLayout.visible] },
      shortcuts: [...o.prefs.homeShortcuts],
    };
  }
  o.prefs.homeMessage = normalizeHomeMessage(prefs.homeMessage);
  o.prefs.areaColors = normalizeHomeAreaColors(prefs.areaColors);
  o.prefs.profileAppearance = normalizeProfileAppearance(prefs.profileAppearance);
  o.prefs.waterGoalMl = Number.isInteger(prefs.waterGoalMl) && prefs.waterGoalMl >= 500 && prefs.waterGoalMl <= 10000 ? prefs.waterGoalMl : d.prefs.waterGoalMl;
  o.prefs.habitWaterGoals = Object.fromEntries(
    Object.entries(isPlainObject(prefs.habitWaterGoals) ? prefs.habitWaterGoals : {})
      .filter(([id, goal]) => id.length <= 200 && isValidWaterGoalMl(goal)),
  );
  o.prefs.birthday = isValidBirthdayReference(prefs.birthday) ? { ...prefs.birthday } : null;
  o.prefs.birthdayCorrectionUsed = prefs.birthdayCorrectionUsed === true;
  o.prefs.firstStepsDismissed = prefs.firstStepsDismissed === true;
  o.prefs.sample = typeof prefs.sample === 'boolean' ? prefs.sample : d.prefs.sample;
  o.prefs.lastBackup = typeof prefs.lastBackup === 'string' && Number.isFinite(Date.parse(prefs.lastBackup)) ? prefs.lastBackup : null;
  o.prefs.weeklyReflection = isPlainObject(prefs.weeklyReflection)
    && isDay(prefs.weeklyReflection.weekOf)
    && typeof prefs.weeklyReflection.text === 'string'
    && prefs.weeklyReflection.text.length <= 500
    ? { weekOf: prefs.weeklyReflection.weekOf, text: prefs.weeklyReflection.text }
    : null;
  o.prefs.trash = normalizeTrash(
    prefs.trash === undefined ? [] : prefs.trash,
    isValidTrashEntry,
  ).entries;
  o.weightTracking = typeof source.weightTracking === 'boolean' ? source.weightTracking : d.weightTracking;
  o.onboardingComplete = typeof source.onboardingComplete === 'boolean' ? source.onboardingComplete : d.onboardingComplete;
  o.introSeen = typeof source.introSeen === 'boolean' ? source.introSeen : o.onboardingComplete;
  const L = { ...LOOK_DEFAULT, ...(isPlainObject(source.look) ? source.look : {}) };
  if (!['auto', 'light', 'dark'].includes(L.mode)) L.mode = LOOK_DEFAULT.mode;
  if (!['comfy', 'compact'].includes(L.density)) L.density = 'comfy';
  if (!['s', 'm', 'l'].includes(L.font)) L.font = 'm';
  if (typeof L.contrast !== 'boolean') L.contrast = LOOK_DEFAULT.contrast;
  if (typeof L.readable !== 'boolean') L.readable = LOOK_DEFAULT.readable;
  if (typeof L.highlightLinks !== 'boolean') L.highlightLinks = LOOK_DEFAULT.highlightLinks;
  if (typeof L.reduceMotion !== 'boolean') L.reduceMotion = LOOK_DEFAULT.reduceMotion;
  L.weekStart = Number(L.weekStart) === 0 ? 0 : 1;
  L.start = 'inicio';
  if (!hexOk(L.custom)) L.custom = LOOK_DEFAULT.custom;
  o.look = L;
  const cleanL = (a, withIcon) => (Array.isArray(a) ? a : []).filter((x) => x && typeof x.name === 'string' && x.name.trim()).slice(0, 60).map((x) => ({ name: x.name.trim().slice(0, 30), color: hexOk(x.color) ? x.color : '#8b8b95', ...(withIcon ? { icon: CAT_ICONS.includes(x.icon) ? x.icon : 'tag' } : (typeof x.folder === 'string' && x.folder.trim() ? { folder: x.folder.trim().slice(0, 30) } : {})) }));
  const cleanCategoryGroup = (a) => (Array.isArray(a) ? a : []).map((category) => normalizeCategoryEntry(category)).filter(Boolean).slice(0, 60);
  o.lists = cleanL(s?.lists); if (!o.lists.length) o.lists = DEF_LISTS.map((x) => ({ ...x }));
  const dc = defCats(); o.cats = { out: cleanCategoryGroup(s?.cats?.out), in: cleanCategoryGroup(s?.cats?.in) };
  if (!o.cats.out.length) o.cats.out = dc.out; if (!o.cats.in.length) o.cats.in = dc.in;
  if (!PALETTES[o.theme] && o.theme !== 'custom') o.theme = 'rose';
  delete o.accountTypes;
  return o;
}
function currentProfileAge(settings) {
  return settings?.profile?.age ?? null;
}
const optional = (record, key, predicate) => !Object.hasOwn(record, key) || predicate(record[key]);
const isText = (value) => typeof value === 'string';
const isNonEmptyText = (value) => isText(value) && value.trim().length > 0;
const isFiniteValue = (value) => typeof value === 'number' && Number.isFinite(value);
const isSafeInteger = (value) => Number.isSafeInteger(value);
const isIsoTimestamp = (value) => isText(value) && Number.isFinite(Date.parse(value));
const isValidTask = (record) => isPlainObject(record)
  && isNonEmptyText(record.id) && isText(record.title)
  && optional(record, 'done', (value) => typeof value === 'boolean')
  && optional(record, 'tag', isText)
  && optional(record, 'dueDate', (value) => value === null || isDay(value))
  && optional(record, 'priority', (value) => ['low', 'normal', 'high'].includes(value))
  && optional(record, 'icon', isTaskIconKey)
  && optional(record, 'createdAt', isFiniteValue)
  && optional(record, 'focusSeconds', (value) => Number.isSafeInteger(value) && value >= 0)
  && optional(record, 'doneAt', (value) => value === undefined || isIsoTimestamp(value))
  && optional(record, 'time', isTime)
  && optional(record, 'repeat', (value) => Object.hasOwn(REPEATS, value))
  && optional(record, 'remind', (value) => Number.isFinite(value) && value >= 0 && value <= 1440)
  && optional(record, 'tags', (value) => Array.isArray(value) && value.every(isText))
  && optional(record, 'notes', isText)
  && optional(record, 'order', isFiniteValue)
  && optional(record, 'groupId', isText)
  && optional(record, 'groupTitle', isText)
  && optional(record, 'sample', (value) => typeof value === 'boolean')
  && optional(record, 'subtasks', (value) => Array.isArray(value) && value.every((item) => (
    isPlainObject(item) && isText(item.title)
      && optional(item, 'id', isNonEmptyText)
      && optional(item, 'done', (done) => typeof done === 'boolean')
  )));
const isValidWaterEntry = (record) => isPlainObject(record)
  && isNonEmptyText(record.id) && isFiniteValue(record.ml) && record.ml > 0
  && isIsoTimestamp(record.at);
const isValidGymTemplate = (record) => isPlainObject(record)
  && isNonEmptyText(record.id) && isText(record.name)
  && Array.isArray(record.exercises) && record.exercises.every(isText);
const isValidGymLog = (record) => isPlainObject(record)
  && isNonEmptyText(record.id) && isDay(record.date)
  && optional(record, 'name', isText)
  && optional(record, 'minutes', isFiniteValue)
  && optional(record, 'notes', isText);
const isValidAccount = (record) => isPlainObject(record)
  && isNonEmptyText(record.id) && isText(record.name)
  && isValidAccountType(record.type)
  && isSafeInteger(record.initialCents)
  && optional(record, 'bank', isText)
  && optional(record, 'linkedAccountId', isNonEmptyText)
  && optional(record, 'limitCents', (value) => isSafeInteger(value) && value >= 0)
  && optional(record, 'closingDay', (value) => Number.isInteger(value) && value >= 0 && value <= 31)
  && optional(record, 'dueDay', (value) => Number.isInteger(value) && value >= 0 && value <= 31);
const isValidTransaction = (record) => isPlainObject(record)
  && isNonEmptyText(record.id) && ['in', 'out', 'tr'].includes(record.type)
  && isNonEmptyText(record.accountId) && isSafeInteger(record.cents) && record.cents > 0
  && isDay(record.date)
  && optional(record, 'settledDate', isDay)
  && optional(record, 'interestCents', (value) => isSafeInteger(value) && value >= 0 && value <= record.cents)
  && optional(record, 'anticipatedDate', isDay)
  && optional(record, 'groupId', isText)
  && optional(record, 'invoiceInstallment', (value) => typeof value === 'boolean')
  && optional(record, 'category', isText)
  && optional(record, 'desc', isText)
  && optional(record, 'paid', (value) => typeof value === 'boolean')
  && optional(record, 'createdAt', isFiniteValue)
  && optional(record, 'toAccountId', isNonEmptyText)
  && (record.type !== 'tr' || isNonEmptyText(record.toAccountId))
  && (record.invoiceInstallment !== true || (record.type === 'tr' && isNonEmptyText(record.groupId)));
const isValidGoal = (record) => isPlainObject(record)
  && isNonEmptyText(record.id) && isNonEmptyText(record.name) && record.name.length <= 50
  && isSafeInteger(record.targetCents) && record.targetCents > 0
  && isSafeInteger(record.savedCents) && record.savedCents >= 0
  && optional(record, 'deadline', (value) => value === '' || value === null || isDay(value));
const isValidRecurring = (record) => isPlainObject(record)
  && isNonEmptyText(record.id) && ['in', 'out'].includes(record.type)
  && isNonEmptyText(record.accountId) && isText(record.category)
  && isSafeInteger(record.cents) && record.cents > 0
  && Number.isInteger(record.day) && record.day >= 1 && record.day <= 31
  && /^\d{4}-(0[1-9]|1[0-2])$/.test(record.startYM)
  && optional(record, 'lastYM', (value) => value === null || /^\d{4}-(0[1-9]|1[0-2])$/.test(value))
  && optional(record, 'desc', isText)
  && optional(record, 'firstPaid', (value) => typeof value === 'boolean')
  && optional(record, 'paused', (value) => typeof value === 'boolean');
const isValidCycleLog = (record) => isPlainObject(record)
  && ['flow', 'energy', 'sleep', 'discharge', 'note'].every((key) => optional(record, key, isText))
  && ['pain', 'mood', 'digestion', 'skin'].every((key) => optional(record, key, (value) => Array.isArray(value) && value.every(isText)))
  && optional(record, 'orgasmCount', (value) => Number.isInteger(value) && value >= 0 && value <= 99)
  && isValidCycleSexualLog(record);
const isValidCycleEntry = (record) => isPlainObject(record)
  && isDay(record.start)
  && optional(record, 'end', (value) => value === null || (isDay(value) && value >= record.start));
const isValidWeight = (record) => isPlainObject(record)
  && isNonEmptyText(record.id) && isFiniteValue(record.kg)
  && record.kg >= 20 && record.kg <= 400 && isDay(record.date);
const TRASH_RECORD_VALIDATORS = {
  tasks: isValidTask,
  habits: isValidHabit,
  water: isValidWaterEntry,
  'finance.accounts': isValidAccount,
  'finance.tx': isValidTransaction,
  'finance.goals': isValidGoal,
  'finance.recurring': isValidRecurring,
};
const isValidTrashRecord = (record) => {
  if (!isPlainObject(record) || !isNonEmptyText(record.key)
    || !Number.isSafeInteger(record.index) || record.index < 0
    || !isPlainObject(record.value)) return false;
  if (record.collection === 'cycleLog') return isDay(record.key) && isValidCycleLog(record.value);
  if (record.collection === 'cycle') {
    return isValidCycleEntry(record.value)
      && record.key === `${record.value.start}|${record.value.end || ''}`;
  }
  if (record.collection === 'finance.budgets') {
    return isPlainObject(record.value) && isSafeInteger(record.value.cents) && record.value.cents > 0;
  }
  const validator = TRASH_RECORD_VALIDATORS[record.collection];
  return Boolean(validator && validator(record.value) && record.key === record.value.id);
};
const isValidTrashEntry = (entry) => isValidTrashEntryModel(entry, isValidTrashRecord);
const recordsOrEmpty = (value, validator) => value == null
  ? { records: [], rejectedCount: 0 }
  : filterValidRecords(value, validator);

function settingsIssueCount(value) {
  if (!isPlainObject(value)) return 1;
  let issues = 0;
  const checkObject = (key) => {
    if (Object.hasOwn(value, key) && value[key] !== undefined && !isPlainObject(value[key])) issues++;
  };
  ['profile', 'areas', 'prefs', 'look'].forEach(checkObject);
  if (isPlainObject(value.profile)) {
    const profile = value.profile;
    if (Object.hasOwn(profile, 'name') && profile.name !== undefined && !isText(profile.name)) issues++;
    if (Object.hasOwn(profile, 'preferredName') && profile.preferredName !== undefined && !isText(profile.preferredName)) issues++;
    if (Object.hasOwn(profile, 'sex') && profile.sex !== undefined && profile.sex !== '' && !Object.hasOwn(SEX, profile.sex)) issues++;
    if (Object.hasOwn(profile, 'age') && profile.age !== undefined && profile.age !== null && !(Number.isInteger(profile.age) && profile.age >= 0 && profile.age <= 120)) issues++;
    if (Object.hasOwn(profile, 'weightKg') && profile.weightKg !== undefined && profile.weightKg !== null && !(isFiniteValue(profile.weightKg) && profile.weightKg >= 20 && profile.weightKg <= 400)) issues++;
    if (Object.hasOwn(profile, 'heightCm') && profile.heightCm !== undefined && profile.heightCm !== null && !(Number.isInteger(profile.heightCm) && profile.heightCm >= 80 && profile.heightCm <= 250)) issues++;
  }
  if (isPlainObject(value.areas)) {
    issues += Object.keys(defaults().settings.areas)
      .filter((key) => Object.hasOwn(value.areas, key) && typeof value.areas[key] !== 'boolean').length;
  }
  if (isPlainObject(value.prefs)) {
    const prefs = value.prefs;
    if (Object.hasOwn(prefs, 'birthday') && prefs.birthday !== null
      && !isValidBirthdayReference(prefs.birthday)) issues++;
    if (Object.hasOwn(prefs, 'birthdayCorrectionUsed') && typeof prefs.birthdayCorrectionUsed !== 'boolean') issues++;
    if (Object.hasOwn(prefs, 'firstStepsDismissed') && typeof prefs.firstStepsDismissed !== 'boolean') issues++;
    if (Object.hasOwn(prefs, 'menuOrder') && prefs.menuOrder !== undefined
      && !isValidMenuOrder(prefs.menuOrder)) issues++;
    if (Object.hasOwn(prefs, 'visibleMenuItems') && prefs.visibleMenuItems !== undefined
      && !isValidVisibleMenuItems(prefs.visibleMenuItems)) issues++;
    if (Object.hasOwn(prefs, 'areaTutorialsSeen') && prefs.areaTutorialsSeen !== undefined
      && !isValidAreaTutorialsSeen(prefs.areaTutorialsSeen)) issues++;
    ['waterGoalMl'].forEach((key) => {
      if (Object.hasOwn(prefs, key) && prefs[key] !== undefined
        && !(Number.isInteger(prefs[key])
          && prefs[key] >= 500 && prefs[key] <= 10000)) issues++;
    });
    if (Object.hasOwn(prefs, 'sample') && prefs.sample !== undefined && typeof prefs.sample !== 'boolean') issues++;
    if (Object.hasOwn(prefs, 'lastBackup') && prefs.lastBackup !== undefined && prefs.lastBackup !== null
      && (!isText(prefs.lastBackup) || !Number.isFinite(Date.parse(prefs.lastBackup)))) issues++;
    if (Object.hasOwn(prefs, 'weeklyReflection') && prefs.weeklyReflection !== null
      && (!isPlainObject(prefs.weeklyReflection)
        || !isDay(prefs.weeklyReflection.weekOf)
        || !isText(prefs.weeklyReflection.text)
        || prefs.weeklyReflection.text.length > 500)) issues++;
    if (Object.hasOwn(prefs, 'trash') && prefs.trash !== undefined) {
      issues += normalizeTrash(withoutRemovedStudyTrash(prefs.trash), isValidTrashEntry).rejectedCount;
    }
  }
  if (Object.hasOwn(value, 'look') && isPlainObject(value.look)) {
    const look = value.look;
    if (Object.hasOwn(look, 'mode') && look.mode !== undefined && !['auto', 'light', 'dark'].includes(look.mode)) issues++;
    if (Object.hasOwn(look, 'density') && look.density !== undefined && !['comfy', 'compact'].includes(look.density)) issues++;
    if (Object.hasOwn(look, 'font') && look.font !== undefined && !['s', 'm', 'l'].includes(look.font)) issues++;
    if (Object.hasOwn(look, 'contrast') && look.contrast !== undefined && typeof look.contrast !== 'boolean') issues++;
    if (Object.hasOwn(look, 'readable') && look.readable !== undefined && typeof look.readable !== 'boolean') issues++;
    if (Object.hasOwn(look, 'highlightLinks') && look.highlightLinks !== undefined && typeof look.highlightLinks !== 'boolean') issues++;
    if (Object.hasOwn(look, 'reduceMotion') && look.reduceMotion !== undefined && typeof look.reduceMotion !== 'boolean') issues++;
    if (Object.hasOwn(look, 'weekStart') && look.weekStart !== undefined
      && ![0, 1, '0', '1'].includes(look.weekStart)) issues++;
    if (Object.hasOwn(look, 'start') && look.start !== undefined && typeof look.start !== 'string') issues++;
    if (Object.hasOwn(look, 'custom') && look.custom !== undefined && !hexOk(look.custom)) issues++;
  }
  if (Object.hasOwn(value, 'theme') && value.theme !== undefined && !PALETTES[value.theme] && value.theme !== 'custom') issues++;
  if (Object.hasOwn(value, 'weightTracking') && value.weightTracking !== undefined && typeof value.weightTracking !== 'boolean') issues++;
  if (Object.hasOwn(value, 'onboardingComplete') && value.onboardingComplete !== undefined && typeof value.onboardingComplete !== 'boolean') issues++;
  if (Object.hasOwn(value, 'introSeen') && value.introSeen !== undefined && typeof value.introSeen !== 'boolean') issues++;
  if (Object.hasOwn(value, 'lists') && value.lists !== undefined) {
    if (!Array.isArray(value.lists)) issues++;
    else issues += value.lists.filter((item) => !isPlainObject(item) || !isNonEmptyText(item.name)
      || optional(item, 'color', hexOk)
      === false || optional(item, 'folder', isText) === false).length;
  }
  if (Object.hasOwn(value, 'accountTypes') && value.accountTypes !== undefined) {
    if (!Array.isArray(value.accountTypes)) issues++;
    else issues += value.accountTypes.filter((key) => !isValidAccountType(key)).length;
  }
  if (Object.hasOwn(value, 'cats') && value.cats !== undefined) {
    if (!isPlainObject(value.cats)) issues++;
    else ['out', 'in'].forEach((key) => {
      if (!Object.hasOwn(value.cats, key)) return;
      if (!Array.isArray(value.cats[key])) { issues++; return; }
      issues += value.cats[key].filter((item) => !isPlainObject(item) || !isNonEmptyText(item.name)
        || optional(item, 'color', hexOk) === false
        || optional(item, 'icon', (iconName) => CAT_ICONS.includes(iconName)) === false).length;
    });
  }
  return issues;
}

function normalizeSlice(k, v) {
  const d = defaults()[k];
  if (v == null) return { value: d, invalidCount: 0 };
  if (k === 'settings') {
    return { value: normalizeSettings(v), invalidCount: settingsIssueCount(v) };
  }
  if (k === 'pomodoro') {
    let invalidCount = 0;
    if (!isPlainObject(v)) return { value: d, invalidCount: 1 };
    const timer = { ...d, ...v };
    if (!isFiniteValue(timer.elapsedSeconds) || timer.elapsedSeconds < 0) { timer.elapsedSeconds = d.elapsedSeconds; invalidCount++; }
    if (timer.startedAt !== null && !isFiniteValue(timer.startedAt)) { timer.startedAt = d.startedAt; invalidCount++; }
    if (!Object.hasOwn(v, 'phase')) {
      timer.phase = 'focus';
      timer.phaseElapsedSeconds = 0;
      timer.completedPomodoros = 0;
      if (timer.startedAt !== null) timer.startedAt = Date.now();
    } else if (!['focus', 'short-break', 'long-break'].includes(timer.phase)) {
      timer.phase = 'focus';
      invalidCount++;
    }
    if (!Number.isInteger(timer.phaseElapsedSeconds) || timer.phaseElapsedSeconds < 0 || timer.phaseElapsedSeconds > 7200) {
      timer.phaseElapsedSeconds = 0;
      invalidCount++;
    }
    if (!Number.isSafeInteger(timer.completedPomodoros) || timer.completedPomodoros < 0) {
      timer.completedPomodoros = 0;
      invalidCount++;
    }
    if (!Number.isSafeInteger(timer.dailyCompletedPomodoros) || timer.dailyCompletedPomodoros < 0) {
      timer.dailyCompletedPomodoros = 0;
      invalidCount++;
    }
    if (!Object.hasOwn(v, 'dailyCompletedOn')) {
      timer.dailyCompletedOn = '';
      timer.dailyCompletedPomodoros = 0;
    } else if (timer.dailyCompletedOn !== '' && !isDay(timer.dailyCompletedOn)) {
      timer.dailyCompletedOn = '';
      timer.dailyCompletedPomodoros = 0;
      invalidCount++;
    }
    if (!timer.dailyCompletedOn) timer.dailyCompletedPomodoros = 0;
    timer.history = normalizeLegacyTimerHistory(v.history);
    if (typeof timer.focusTaskId !== 'string') { timer.focusTaskId = ''; invalidCount++; }
    if (typeof timer.focusLabel === 'string' && timer.focusLabel.trim()) timer.focusLabel = timer.focusLabel.trim().slice(0, 40); else delete timer.focusLabel;
    return { value: timer, invalidCount };
  }
  if (k === 'gym') {
    if (!isPlainObject(v)) return { value: d, invalidCount: 1 };
    const templates = recordsOrEmpty(v.templates, isValidGymTemplate);
    const logs = recordsOrEmpty(v.logs, isValidGymLog);
    return {
      value: { templates: templates.records, logs: logs.records },
      invalidCount: templates.rejectedCount + logs.rejectedCount,
    };
  }
  if (k === 'finance') {
    if (!isPlainObject(v)) return { value: d, invalidCount: 1 };
    const accounts = recordsOrEmpty(v.accounts, isValidAccount);
    const tx = recordsOrEmpty(v.tx, isValidTransaction);
    const goals = recordsOrEmpty(v.goals, isValidGoal);
    const recurring = recordsOrEmpty(v.recurring, isValidRecurring);
    let invalidCount = accounts.rejectedCount + tx.rejectedCount + goals.rejectedCount + recurring.rejectedCount;
    const budgets = {};
    if (v.budgets != null && !isPlainObject(v.budgets)) invalidCount++;
    else Object.entries(v.budgets || {}).forEach(([name, budget]) => {
      if (isNonEmptyText(name) && isPlainObject(budget) && isSafeInteger(budget.cents) && budget.cents > 0) {
        Object.defineProperty(budgets, name, { value: budget, enumerable: true, writable: true, configurable: true });
      }
      else invalidCount++;
    });
    const financeTx = tx.records.map((transaction) => {
      const date = normalizeDay(transaction.date) || transaction.date;
      const settledDate = transaction.settledDate ? normalizeDay(transaction.settledDate) || transaction.settledDate : undefined;
      return {
        ...transaction,
        date,
        ...(settledDate ? { settledDate } : {}),
      };
    });
    return {
      value: {
        accounts: accounts.records.map((account) => ({ ...account, type: normalizeAccountType(account.type) })),
        tx: financeTx,
        budgets,
        goals: goals.records,
        recurring: recurring.records,
      },
      invalidCount,
    };
  }
  if (k === 'habits') {
    const result = normalizeHabits(v);
    return { value: result.records, invalidCount: result.rejectedCount };
  }
  if (k === 'cycleLog') {
    if (!isPlainObject(v)) return { value: d, invalidCount: 1 };
    const entries = Object.entries(v).filter(([day, log]) => isDay(day) && isValidCycleLog(log));
    return {
      value: Object.fromEntries(entries),
      invalidCount: Object.keys(v).length - entries.length,
    };
  }
  if (Array.isArray(d)) {
    const validators = {
      tasks: isValidTask,
      habits: isValidHabit,
      water: isValidWaterEntry,
      cycle: isValidCycleEntry,
      weight: isValidWeight,
    };
    const result = recordsOrEmpty(v, validators[k]);
    return { value: result.records, invalidCount: result.rejectedCount };
  }
  return { value: v, invalidCount: 0 };
}

/* ---------- Persistência local ---------- */
/* ---------- Persistencia relacional ---------- */
function cacheLoadingAppearance(settings) {
  const [primary, accent] = paletteColors(settings.theme, settings.look);
  window.auroraLoadingAppearance?.save({
    palette: settings.theme === 'rose' ? 'rose' : 'customized',
    mode: settings.look.mode,
    reduceMotion: settings.look.reduceMotion,
    primary,
    accent,
  });
}
const Persist = {
  userId: '',
  store: null,
  inFlight: null,
  pendingSnapshot: null,
  confirmedState: null,
  rawTables: null,
  replacing: false,
  async attach({ client, user }) {
    const { RelationalAccountStore } = await import('./data/relational-account-store.js');
    this.userId = user.id;
    this.store = new RelationalAccountStore(client, user.id);
    this.confirmedState = null;
    ui.persistError = '';
    configurePushNotificationStore(this.store);
  },
  save(slice) {
    return this.saveMany([slice]);
  },
  saveMany(slices) {
    if (this.replacing || !this.store || slices.some((slice) => !SLICES.includes(slice))) return false;
    if (ui.persistBlocked.size || Object.keys(ui.integrityIssues).length) {
      slices.forEach((slice) => ui.persistFailed.add(slice));
      toast('Há dados que precisam de revisão antes de salvar. Nenhuma área foi enviada para a nuvem.');
      return false;
    }
    if (navigator.onLine === false) {
      if (this.confirmedState) S = JSON.parse(JSON.stringify(this.confirmedState));
      ui.persistError = '';
      slices.forEach((slice) => {
        ui.persistFailed.add(slice);
        syncState.failed.add(slice);
      });
      toast('Sem conexão: a alteração foi desfeita e não foi salva. Conecte-se e tente novamente.');
      return false;
    }
    ui.persistError = '';
    const timestamp = Date.now();
    slices.forEach((slice) => {
      stamps[slice] = timestamp;
      ui.persistFailed.delete(slice);
      syncState.pending.add(slice);
      syncState.failed.delete(slice);
      syncState.conflicts.delete(slice);
    });
    this.pendingSnapshot = JSON.parse(JSON.stringify(S));
    void this.flush();
    return true;
  },
  async flush() {
    if (this.inFlight) return this.inFlight;
    if (!this.store) return false;
    if (!this.pendingSnapshot) {
      return syncState.pending.size === 0
        && syncState.failed.size === 0
        && ui.persistFailed.size === 0
        && ui.persistBlocked.size === 0;
    }
    if (navigator.onLine === false) {
      syncState.pending.forEach((slice) => syncState.failed.add(slice));
      return false;
    }
    const task = (async () => {
      while (this.pendingSnapshot) {
        const snapshot = this.pendingSnapshot;
        this.pendingSnapshot = null;
        try {
          let saveTimer = 0;
          const saveTimeout = new Promise((_, reject) => {
            saveTimer = setTimeout(() => reject(new Error('A nuvem não respondeu a tempo. Verifique sua conexão e tente novamente.')), 30000);
          });
          try {
            await Promise.race([this.store.save(snapshot, this.confirmedState), saveTimeout]);
          } finally {
            clearTimeout(saveTimer);
          }
          this.confirmedState = JSON.parse(JSON.stringify(snapshot));
          cacheLoadingAppearance(snapshot.settings);
          syncState.pending.clear();
          syncState.failed.clear();
          syncState.conflicts.clear();
          ui.persistFailed.clear();
          ui.persistError = '';
        } catch (error) {
          if (!this.pendingSnapshot) {
            this.pendingSnapshot = snapshot;
            if (this.confirmedState && sameJsonValue(S, snapshot)) {
              S = JSON.parse(JSON.stringify(this.confirmedState));
            }
          }
          const isVersionConflict = error instanceof Error && error.code === 'version_conflict';
          syncState.pending.forEach((slice) => syncState.failed.add(slice));
          syncState.failed.add('account');
          syncState.pending.clear();
          ui.persistFailed.add('account');
          ui.persistError = error instanceof Error
            ? error.message.replace(/^Não foi possível salvar as alterações na conta\.\s*/, '').slice(0, 200)
            : '';
          if (isVersionConflict) {
            syncState.conflicts.add('account');
            toast('Os dados da conta foram alterados em outro dispositivo. Recarregue os dados da conta para continuar.');
          } else {
            console.error('Aurora: a gravação relacional não foi confirmada.', error);
            toast(error instanceof Error ? error.message : 'Não foi possível salvar. Tente novamente quando a conexão estiver estável.');
          }
          return false;
        }
      }
      return syncState.failed.size === 0 && ui.persistBlocked.size === 0;
    })();
    this.inFlight = task;
    try {
      return await task;
    } finally {
      this.inFlight = null;
      render();
    }
  },
  retryPending() {
    if (navigator.onLine === false) {
      toast('Ainda sem conexão. As alterações não foram enviadas.');
      return;
    }
    if (this.pendingSnapshot) {
      ui.persistError = '';
      S = JSON.parse(JSON.stringify(this.pendingSnapshot));
      syncState.pending.add('account');
      syncState.failed.delete('account');
      ui.persistFailed.delete('account');
      void this.flush();
      render();
    }
  },
  async replaceAll() {
    if (!this.store) throw new Error('A conta não está pronta para restaurar dados.');
    if (!hasCurrentCycleDataConsent(accountSession?.user)) {
      throw new Error('Para restaurar um backup e substituir os dados da conta, registre primeiro o consentimento específico de Ciclo. Assim, os registros de saúde existentes não serão alterados sem autorização.');
    }
    if (navigator.onLine === false) throw new Error('Sem conexão: o backup não foi restaurado.');
    if (this.inFlight) await this.inFlight;
    await this.store.save(JSON.parse(JSON.stringify(S)));
    this.confirmedState = JSON.parse(JSON.stringify(S));
    cacheLoadingAppearance(S.settings);
    this.pendingSnapshot = null;
    syncState.pending.clear();
    syncState.failed.clear();
    syncState.conflicts.clear();
    ui.persistFailed.clear();
    ui.persistBlocked.clear();
    ui.integrityIssues = {};
  },
  async clear() {
    if (!this.store) throw new Error('A conta não está pronta para apagar os dados.');
    await this.store.clear();
    this.pendingSnapshot = null;
    this.rawTables = null;
    this.confirmedState = JSON.parse(JSON.stringify(defaults()));
    cacheLoadingAppearance(this.confirmedState.settings);
    syncState.pending.clear();
    syncState.failed.clear();
    syncState.conflicts.clear();
  },
  wipe() {
    window.auroraLoadingAppearance?.clear();
    this.pendingSnapshot = null;
    this.rawTables = null;
    this.store = null;
    this.userId = '';
    this.confirmedState = null;
    clearPushNotificationState();
  },
};
async function loadAccountData() {
  const loaded = await Persist.store.load({
    includeCycle: hasCurrentCycleDataConsent(accountSession?.user),
  });
  const next = defaults();
  const integrityIssues = {};
  const persistBlocked = new Set();
  const persistFailed = new Set();
  for (const slice of SLICES) {
    const normalized = normalizeSlice(slice, loaded[slice] ?? next[slice]);
    next[slice] = normalized.value;
    if (normalized.invalidCount) {
      integrityIssues[slice] = normalized.invalidCount;
      persistBlocked.add(slice);
      persistFailed.add(slice);
    }
  }
  Object.assign(S, next);
  Persist.rawTables = Persist.store.rawTables;
  for (const slice of SLICES) stamps[slice] = Date.now();
  ui.integrityIssues = integrityIssues;
  ui.persistBlocked = persistBlocked;
  ui.persistFailed = persistFailed;
  syncState.failed.clear();
  persistFailed.forEach((slice) => syncState.failed.add(slice));
  Persist.confirmedState = JSON.parse(JSON.stringify(S));
  if (!persistBlocked.has('settings')) cacheLoadingAppearance(S.settings);
}
function initializeBirthdayFromMetadata(user) {
  const prefs = S.settings.prefs;
  const metadata = user?.user_metadata || {};
  if (prefs.birthday || prefs.birthdayCorrectionUsed) return;
  const birthday = createBirthdayReferenceFromParts({
    month: metadata.birthday_month,
    day: metadata.birthday_day,
    ageAtReference: S.settings.profile.age,
    referenceDate: metadata.birthday_reference_date,
  });
  if (!birthday) return;
  prefs.birthday = birthday;
  saveSlices('settings');
}
const saveSlices = (...ks) => {
  if (ui.preview) return true;
  const saved = Persist.saveMany([...new Set(ks)]);
  if (!saved && navigator.onLine !== false) {
    toast('Não foi possível preparar a gravação. Os dados originais continuam na tela; tente novamente.');
  }
  if (saved && ks.includes('habits')) syncHabitReminderSchedule();
  return saved;
};
const commit = (...ks) => { if (saveSlices(...ks)) render(); };
const cloneSlice = (slice) => JSON.parse(JSON.stringify(S[slice]));
function snapshotSlices(slices) {
  return Object.fromEntries(slices.map((slice) => [slice, cloneSlice(slice)]));
}
function restoreSliceSnapshot(snapshot) {
  Object.entries(snapshot).forEach(([slice, value]) => { S[slice] = value; });
}
function saveSlicesWithRollback(slices, snapshot, shouldRender = true, context = 'a lixeira') {
  const blocked = slices.filter((slice) => ui.persistBlocked.has(slice));
  if (blocked.length) {
    restoreSliceSnapshot(snapshot);
    toast(`Não foi possível salvar ${context} porque os dados de ${blocked.join(', ')} estão bloqueados para gravação.`);
    if (shouldRender) render();
    return false;
  }
  if (!ui.preview && !Persist.saveMany(slices)) {
    restoreSliceSnapshot(snapshot);
    toast(`Não foi possível preparar ${context} para salvar; os dados originais foram mantidos.`);
    if (shouldRender) render();
    return false;
  }
  if (!ui.preview && slices.includes('habits')) syncHabitReminderSchedule();
  if (shouldRender) render();
  return true;
}
function trashSlice(collection) {
  if (collection === 'cycleLog') return 'cycleLog';
  return collection.startsWith('finance.') ? 'finance' : collection;
}
function createTrashRecord(collection, key, index, value) {
  return { collection, key, index, value: JSON.parse(JSON.stringify(value)) };
}
function moveRecordsToTrash(label, records, sourceSlices, removeRecords) {
  if (!records.length) return null;
  const slices = [...new Set([...sourceSlices, 'settings'])];
  if (slices.some((slice) => ui.persistBlocked.has(slice))) {
    toast('Não foi possível usar a lixeira porque os dados desta área estão bloqueados para gravação.');
    return null;
  }
  const snapshot = snapshotSlices(slices);
  const entry = {
    id: newId(),
    deletedAt: Date.now(),
    label: label.slice(0, 120),
    records: JSON.parse(JSON.stringify(records)),
  };
  S.settings.prefs.trash = [...S.settings.prefs.trash.filter((item) => !isTrashExpired(item)), entry];
  removeRecords();
  return saveSlicesWithRollback(slices, snapshot) ? entry : null;
}
function trashCollection(draft, collection) {
  if (collection === 'cycleLog') return draft.cycleLog;
  if (collection === 'finance.budgets') return draft.finance.budgets;
  if (collection.startsWith('finance.')) return draft.finance[collection.slice('finance.'.length)];
  return draft[collection];
}
function restoreTrashEntry(id) {
  const entry = S.settings.prefs.trash.find((item) => item.id === id);
  if (!entry) return false;
  if (isTrashExpired(entry)) {
    const snapshot = snapshotSlices(['settings']);
    S.settings.prefs.trash = S.settings.prefs.trash.filter((item) => item.id !== id);
    saveSlicesWithRollback(['settings'], snapshot);
    toast('O prazo de 30 dias terminou; o item foi removido da lixeira.');
    return false;
  }
  if (!isValidTrashEntry(entry)) {
    console.error('Aurora: o item da lixeira não passou pela validação antes da restauração.', id);
    toast('Este item não pode ser restaurado com segurança. Ele continua na lixeira.');
    return false;
  }
  const dataSlices = [...new Set(entry.records.map((record) => trashSlice(record.collection)))];
  const slices = [...new Set([...dataSlices, 'settings'])];
  if (slices.some((slice) => ui.persistBlocked.has(slice))) {
    toast('Não é possível restaurar enquanto os dados de destino estiverem bloqueados para gravação.');
    return false;
  }
  const snapshot = snapshotSlices(slices);
  const drafts = Object.fromEntries(dataSlices.map((slice) => [slice, cloneSlice(slice)]));
  const records = [...entry.records].sort((a, b) => {
    const rank = (record) => record.collection === 'finance.accounts' ? 0
      : record.collection === 'finance.tx' ? 1
        : record.collection === 'finance.recurring' ? 2 : 3;
    return rank(a) - rank(b) || a.index - b.index;
  });
  for (const record of records) {
    const target = trashCollection(drafts, record.collection);
    if (Array.isArray(target)) {
      const alreadyExists = record.collection === 'cycle'
        ? target.some((item) => cyclePeriodKey(item) === record.key)
        : target.some((item) => item.id === record.key);
      if (alreadyExists) {
        toast('Um registro com o mesmo identificador já existe. O item continua na lixeira.');
        return false;
      }
      target.splice(Math.min(record.index, target.length), 0, record.value);
    } else if (isPlainObject(target)) {
      if (Object.hasOwn(target, record.key)) {
        toast('Já existe um registro com a mesma chave. O item continua na lixeira.');
        return false;
      }
      Object.defineProperty(target, record.key, {
        value: record.value,
        enumerable: true,
        writable: true,
        configurable: true,
      });
    } else {
      console.error('Aurora: destino inválido para restauração da lixeira.', record.collection);
      toast('Este item não pode ser restaurado com segurança. Ele continua na lixeira.');
      return false;
    }
  }
  const accounts = new Set(drafts.finance?.accounts.map((account) => account.id) || []);
  for (const record of entry.records) {
    if (record.collection === 'finance.tx') {
      const transaction = record.value;
      if (!accounts.has(transaction.accountId)
        || (transaction.type === 'tr' && !accounts.has(transaction.toAccountId))) {
        toast('Restaure primeiro a conta vinculada. O item continua na lixeira.');
        return false;
      }
    }
    if (record.collection === 'finance.recurring' && !accounts.has(record.value.accountId)) {
      toast('Restaure primeiro a conta vinculada. O item continua na lixeira.');
      return false;
    }
  }
  dataSlices.forEach((slice) => { S[slice] = drafts[slice]; });
  S.settings.prefs.trash = S.settings.prefs.trash.filter((item) => item.id !== id);
  if (!saveSlicesWithRollback(slices, snapshot)) return false;
  toast(`${entry.label} restaurado.`);
  requestAnimationFrame(() => {
    const heading = $('#trash-title');
    if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
  });
  return true;
}
function purgeExpiredTrash() {
  const current = S.settings.prefs.trash;
  const remaining = current.filter((entry) => !isTrashExpired(entry));
  if (remaining.length === current.length || ui.persistBlocked.has('settings')) return;
  const snapshot = snapshotSlices(['settings']);
  S.settings.prefs.trash = remaining;
  saveSlicesWithRollback(['settings'], snapshot, false);
}

/* Ícones: src/js/utils/icons.js */
const GRAD = raw('<svg class="app-definitions" width="0" height="0" aria-hidden="true"><defs><linearGradient id="auroraGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#D991AA"/><stop offset="1" stop-color="#8D4665"/></linearGradient></defs></svg>');
const brandIcon = (size = 40) => raw(`<svg width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="18" fill="url(#auroraGrad)"/><path d="M32 14 46 48h-7.5l-2.600-6.800H28.100L25.5 48H18zm0 12.5-3.200 8.5h6.400z" fill="#fff"/><circle cx="46.5" cy="17.5" r="4" fill="#FBE7D3"/></svg>`);
const configLink = () => h`<a class="inline-link" href="/config?weight" aria-label="Abrir Ajustes e editar o peso">Ajustes</a>`;

/* ========== Casca, roteamento e componentes comuns ========== */
const ROUTE_TITLES = { inicio: 'Início', planejar: 'Planejar', financas: 'Finanças', ciclo: 'Ciclo', habitos: 'Hábitos', config: 'Ajustes' };
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const money = (cents) => h`<span class="money">${brl(cents)}</span>`;
const expenseTitle = (name) => String(name ?? '').replace(/^(\s*\p{L})/u, (first) => first.toLocaleUpperCase('pt-BR'));
const tabLabel = (label) => h`<span class="tab-label-group"><span class="tab-label">${label}</span><i class="tab-period" aria-hidden="true">.</i></span>`;
const brandLink = h`<a class="brand" href="/inicio" aria-label="aurora., início">${brandIcon(36)}<span class="wordmark">aurora<i>.</i></span></a>`;

const notificationCount = () => Object.keys(ui.alerts).length;
function updateDocumentTitle() {
  const title = ROUTE_TITLES[ui.route] || 'aurora.';
  document.title = `${notificationCount() ? `(${notificationCount()}) ` : ''}${title} | aurora.`;
}
function notificationButton(cls, id) {
  const count = notificationCount();
  return h`<button type="button" id="${id}" class="${cls} notification-trigger" data-action="toggle-notifications" aria-label="${count ? `Notificações, ${count} ${plural(count, 'pendente', 'pendentes')}` : 'Notificações'}" aria-expanded="${ui.notificationsOpen}" aria-controls="notification-panel" aria-haspopup="dialog" title="Notificações">${icon('bell', 20)}${count ? h`<span class="notification-count" aria-hidden="true">${count > 99 ? '99+' : count}</span>` : ''}${cls.includes('nl') ? h`<span>Notificações</span>` : ''}</button>`;
}
const agoLabel = (at) => {
  if (!at) return '';
  const min = Math.max(0, Math.round((Date.now() - at) / 60000));
  return min < 1 ? 'agora' : min < 60 ? `há ${min} min` : `há ${Math.floor(min / 60)} h`;
};
/* Lembretes de hoje que ainda vão tocar (tarefas com horário e hábitos com lembrete), só leitura dos dados existentes. */
function upcomingReminders() {
  const now = Date.now(), day = today(), out = [];
  S.tasks.forEach((t) => {
    if (t.done || t.dueDate !== day || !t.time || t.remind == null) return;
    const fire = new Date(`${t.dueDate}T${t.time}:00`).getTime() - Number(t.remind) * 60000;
    if (fire > now) out.push({ kind: 'task', title: t.title, at: fire, time: new Date(fire).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) });
  });
  S.habits.forEach((habit) => {
    if ((habit.status || 'active') !== 'active' || !habit.remind || !habit.days.includes(pk(day).getDay()) || habitCompletedFor(habit, day) || habitIsSkipped(habit, day, day)) return;
    const at = new Date(`${day}T${habit.remind}:00`).getTime();
    if (at > now) out.push({ kind: 'habit', title: habit.name, at, time: habit.remind, habit });
  });
  recurringBillsDueOn(S.finance.tx, day).forEach((transaction) => {
    out.push({
      kind: 'finance',
      title: transaction.desc || transaction.category || 'Conta fixa',
      detail: `${brl(transaction.cents)} · ${accName(transaction.accountId)}`,
      at: new Date(`${day}T00:00:00`).getTime(),
      time: 'Hoje',
    });
  });
  return out.sort((a, b) => a.at - b.at).slice(0, 6);
}
function notificationsHtml() {
  const items = Object.entries(ui.alerts).sort(([, a], [, b]) => (b.at || b.due || 0) - (a.at || a.due || 0));
  const upcoming = ui.notificationsOpen ? upcomingReminders() : [];
  const remindersPaused = ui.remindersPausedUntil > Date.now();
  const canPauseReminders = remindersPaused
    || S.tasks.some((task) => !task.done && task.dueDate && task.time && task.remind != null)
    || S.habits.some((habit) => (habit.status || 'active') === 'active' && habit.remind)
    || items.length > 0
    || upcoming.some((reminder) => reminder.kind === 'task' || reminder.kind === 'habit');
  const kindLabel = (a) => a.kind === 'habit' ? 'Hábito' : 'Tarefa';
  return h`<section class="notification-panel" id="notification-panel" role="dialog" aria-modal="false" aria-labelledby="notification-title" ${ui.notificationsOpen ? raw('') : raw('hidden')}>
    <header class="notification-head"><div><h2 id="notification-title">Notificações</h2><span class="small muted">${items.length ? `${items.length} ${plural(items.length, 'pendente', 'pendentes')}` : 'Tudo em dia'}</span></div>${items.length > 1 ? h`<button type="button" class="btn ghost sm notification-clear" data-action="rem-dismiss-all">Dispensar todas</button>` : ''}<button type="button" class="ibtn dlg-close" id="notification-close" data-action="close-notifications" aria-label="Fechar notificações">${icon('close', 18)}</button></header>
    ${canPauseReminders ? h`<div class="notification-controls"><div><b>${remindersPaused ? 'Lembretes pausados' : 'Controle de lembretes'}</b><small>${remindersPaused ? `Pausa nesta sessão até ${new Date(ui.remindersPausedUntil).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}. Avisos do sistema não são afetados.` : 'Pause por uma hora nesta sessão do app; avisos do sistema não são alterados.'}</small></div><button type="button" class="btn sm" data-action="reminders-pause" aria-pressed="${String(remindersPaused)}">${remindersPaused ? 'Retomar lembretes' : 'Pausar por 1 hora'}</button></div>` : ''}
    ${items.length ? h`<h3 class="notification-section-title">Agora</h3><div class="notification-list" aria-live="polite">${items.map(([k, a]) => {
      const habit = a.kind === 'habit' ? S.habits.find((item) => item.id === a.id) : null;
      return h`<article class="notification-item is-${a.kind || 'task'}" ${habit ? raw(`style="--nc:${habitColor(habit)}"`) : ''}>
      <span class="notification-icon">${icon(habit ? habitIconKey(habit) : 'bell', 18)}</span>
      <div class="notification-copy"><div class="notification-meta"><span class="notification-kind">${kindLabel(a)}</span><span class="notification-ago">${agoLabel(a.at)}</span><button class="ibtn notification-x" data-action="rem-dismiss" data-k="${k}" aria-label="Dispensar: ${a.title}">${icon('close', 16)}</button></div><b class="user-value">${a.title}</b><small>${a.kind === 'habit' ? `lembrete das ${a.time}` : `tarefa das ${a.time}`}</small>${a.detail ? h`<p>${a.detail}</p>` : ''}</div>
      <div class="notification-actions">${a.kind === 'habit'
          ? h`<button class="btn sm primary" data-action="habit-reminder-done" data-k="${k}" data-id="${a.id}">Marcar hábito</button>`
          : h`<button class="btn sm primary" data-action="rem-done" data-k="${k}" data-id="${a.id}">Concluir</button><button class="btn sm" data-action="rem-snooze" data-k="${k}">+10 min</button><button class="btn sm" data-action="rem-snooze" data-k="${k}" data-min="60">+1 h</button>`}</div>
    </article>`; })}</div>` : h`<div class="notification-empty">${icon('check', 20)}<b>Nenhuma notificação por enquanto</b><span>Lembretes de tarefas e hábitos aparecem aqui.</span></div>`}
    ${upcoming.length ? h`<section class="notification-upcoming" aria-labelledby="notification-upcoming-title"><h3 id="notification-upcoming-title">Ainda hoje</h3><ul>${upcoming.map((u) => h`<li><time class="nu-time">${u.time}</time><span class="grow user-value">${u.kind === 'finance' ? `${u.title} · ${u.detail}` : u.title}</span><small>${u.kind === 'habit' ? 'hábito' : u.kind === 'finance' ? 'conta fixa' : 'tarefa'}</small></li>`)}</ul></section>` : ''}
    ${canPauseReminders && areaOn('habits') ? h`<a class="notification-settings-link" href="/habitos">${icon('sliders', 16)}Gerenciar horários e avisos do sistema</a>` : ''}
  </section>`;
}
function closeNotifications(restoreFocus = true) {
  ui.notificationsOpen = false;
  render();
  if (restoreFocus) {
    const trigger = $$('.notification-trigger').find((el) => el.getClientRects().length);
    if (trigger) trigger.focus({ preventScroll: true });
  }
}
function acquireActiveScrollLocks() {
  if (ui.dlg && !releaseDialogScroll) releaseDialogScroll = lockPageScroll();
}
/* Erro junto ao campo: marca o campo, escreve a mensagem logo abaixo e leva o foco até ele.
   Só mexe no DOM do diálogo aberto; some quando a pessoa volta a digitar. Cai para o aviso se não achar o campo. */
function fieldError(message, selector) {
  const field = selector ? document.querySelector(`#dlg ${selector}`) : null;
  if (!field) return toast(message);
  const label = field.type === 'checkbox' ? field.closest('fieldset') : field.closest('label') || field.parentElement;
  label.querySelector('.field-err')?.remove();
  const note = document.createElement('span');
  note.className = 'err field-err'; note.id = `err-${Math.random().toString(36).slice(2, 8)}`; note.setAttribute('role', 'alert'); note.textContent = message;
  label.append(note);
  field.setAttribute('aria-invalid', 'true'); field.setAttribute('aria-describedby', note.id);
  const inputTarget = field.type === 'checkbox' ? label : field;
  const clear = () => { note.remove(); field.removeAttribute('aria-invalid'); field.removeAttribute('aria-describedby'); inputTarget.removeEventListener('input', clear); inputTarget.removeEventListener('change', clear); };
  inputTarget.addEventListener('input', clear);
  inputTarget.addEventListener('change', clear);
  field.focus();
}
function completionFeedback(selector) {
  requestAnimationFrame(() => {
    const target = document.querySelector(selector);
    if (!target) return;
    target.classList.remove('completion-feedback');
    void target.offsetWidth;
    target.classList.add('completion-feedback');
    setTimeout(() => target.classList.remove('completion-feedback'), 760);
  });
}
function vibrateFeedback() {
  if (!S.settings.prefs.vibrationEnabled || typeof navigator.vibrate !== 'function') return;
  try { navigator.vibrate(15); } catch { /* A vibração é opcional. */ }
}
function updateAccessibilityLook(updates, focusId) {
  updateSettingsDraft((settings) => {
    settings.look = { ...settings.look, ...updates };
  });
  if (focusId) document.getElementById(focusId)?.focus();
}
function shell(body) {
  const overdue = S.tasks.filter((t) => !t.done && t.dueDate && t.dueDate < today()).length;
  const saveStatus = ui.persistBlocked.size || ui.persistFailed.size || navigator.onLine === false ? 'warning' : 'saved';
  const saveLabel = ui.preview
    ? ''
    : ui.persistBlocked.size
      ? 'Dados bloqueados; revise antes de salvar'
      : ui.persistFailed.size
        ? 'Falha ao salvar; tente novamente'
        : syncState.pending.size
          ? 'Salvando…'
          : navigator.onLine === false
            ? 'Sem conexão; alterações não serão salvas'
            : '';
  const menuAreas = { ...S.settings.areas, cycle: areaOn('cycle') };
  const menuItems = orderMenuItems(S.settings.prefs.menuOrder, menuAreas, false, S.settings.prefs.visibleMenuItems, HIDDEN_MENU_IDS);
  const compactItems = ['inicio', 'planejar', 'habitos'].map((id) => menuItems.find((item) => item.id === id)).filter(Boolean);
  const secondaryItems = menuItems.filter((item) => !compactItems.includes(item));
  const hasActiveArea = Object.values(menuAreas).some(Boolean);
  const isCurrent = (id) => id === ui.route;
  const navLink = ({ id, label, icon: iconName, area }, className = '') => h`<a class="${area ? 'nav-area ' : ''}${className}" href="/${id}" data-tip="${label}" title="${ui.sidebarCollapsed ? '' : label}" ${isCurrent(id) ? raw('aria-current="page"') : ''}><span class="ni">${icon(iconName, area ? 20 : 22)}${id === 'planejar' && overdue ? h`<span class="dot" aria-label="${overdue} tarefas atrasadas"></span>` : ''}</span>${tabLabel(label)}</a>`;
  const currentInMore = ui.route === 'config' || secondaryItems.some(({ id }) => isCurrent(id));
  const currentSecondaryItem = secondaryItems.find(({ id }) => isCurrent(id));
  const financeQuickActions = !areaOn('finances') ? '' : !S.finance.accounts.length
    ? h`<button type="button" data-action="quick-action-account"><span class="ni">${icon('wallet', 18)}</span><span>Criar conta financeira</span></button>`
    : ui.route === 'financas'
      ? h`
        ${S.finance.accounts.length > 1 ? h`<button type="button" data-action="quick-action-finance" data-kind="tr"><span class="ni">${icon('repeat', 18)}</span><span>Transferência</span></button>` : ''}
        <button type="button" data-action="quick-action-finance" data-kind="in"><span class="ni">${icon('plus', 18)}</span><span>Receita</span></button>
        <button type="button" data-action="quick-action-finance" data-kind="out"><span class="ni">${icon('arrowDown', 18)}</span><span>Despesa</span></button>
        ${S.finance.accounts.some(isCredit) ? h`<button type="button" data-action="quick-action-finance" data-kind="card"><span class="ni">${icon('card', 18)}</span><span>Despesa cartão</span></button>` : ''}`
      : h`<button type="button" data-action="quick-action-transaction"><span class="ni">${icon('wallet', 18)}</span><span>Lançamento</span></button>`;
  const isFinanceRoute = ui.route === 'financas';
  const quickActionItems = isFinanceRoute
    ? financeQuickActions
    : h`
      <button type="button" data-action="quick-action-task"><span class="ni">${icon('calendarCheck', 18)}</span><span>Nova tarefa</span></button>
      ${areaOn('habits') ? h`<button type="button" data-action="quick-action-habit"><span class="ni">${icon('check', 18)}</span><span>Novo hábito</span></button>` : ''}
      ${financeQuickActions}`;
  const quickActionsHeading = isFinanceRoute ? 'Ações de Finanças' : 'Criar rapidamente';
  const quickActions = h`<div class="nav-quick-control">
    <button type="button" class="nav-quick-trigger" data-action="quick-actions-toggle" data-tip="Criar" aria-label="Ações rápidas" aria-expanded="${String(ui.quickActionsOpen)}" aria-controls="quick-actions-menu"><span class="ni">${icon('plus', 20)}</span><span class="tab-label-group"><span class="tab-label">Criar</span></span></button>
    <div class="quick-actions-menu" id="quick-actions-menu" role="group" aria-label="${quickActionsHeading}" ${ui.quickActionsOpen ? '' : raw('hidden')}><p class="quick-actions-heading">${quickActionsHeading}</p>${quickActionItems}</div>
  </div>`;
  const navItems = h`${menuItems.map((item) => navLink(item, compactItems.includes(item) ? 'nav-primary' : 'nav-secondary'))}<button type="button" class="nav-more-trigger" data-action="nav-more-toggle" title="${currentSecondaryItem ? `Mais áreas · atual: ${currentSecondaryItem.label}` : 'Mais áreas'}" aria-label="${currentSecondaryItem ? `Mais áreas; rota atual: ${currentSecondaryItem.label}` : 'Mais áreas'}" aria-expanded="${String(ui.navigationOpen)}" aria-controls="nav-more-menu" ${currentInMore ? raw('aria-current="page"') : ''}><span class="ni">${icon('more', 22)}</span><span>Mais</span></button><div class="nav-more-menu" id="nav-more-menu" ${ui.navigationOpen ? '' : raw('hidden')}>${secondaryItems.map((item) => navLink(item, 'nav-more-link'))}${navLink({ id: 'config', label: 'Ajustes', icon: 'user' }, 'nav-more-link')}<button type="button" class="nav-more-create" data-action="quick-actions-toggle" aria-label="Criar" aria-expanded="${String(ui.quickActionsOpen)}" aria-controls="quick-actions-menu"><span class="ni">${icon('plus', 20)}</span><span>Criar</span></button></div>${quickActions}${!hasActiveArea ? h`<a class="nav-enable-areas" href="/config?section=areas-navigation" data-action="areas-nav-open"><span class="ni">${icon('plus', 22)}</span><span>Ativar áreas</span></a>` : ''}`;
  return h`${GRAD}<a class="skip" href="#main" data-action="skip">Pular para o conteúdo principal</a><div class="app${ui.preview ? ' preview-shell' : ''}${ui.sidebarCollapsed ? ' sidebar-collapsed' : ''}">
    <!-- aria-expanded and aria-controls announce the popover state and its relationship to assistive technology. -->
    ${ui.navigationOpen || ui.quickActionsOpen ? h`<div class="nav-scrim" data-action="${ui.quickActionsOpen ? 'quick-actions-toggle' : 'nav-more-toggle'}" aria-hidden="true"></div>` : ''}<header class="topbar"><div class="sidebar-brand-row">${brandLink}<button type="button" class="sidebar-toggle" data-action="sidebar-toggle" aria-label="${ui.sidebarCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}" aria-expanded="${String(!ui.sidebarCollapsed)}" aria-controls="primary-navigation" title="${ui.sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}">${icon(ui.sidebarCollapsed ? 'chevRight' : 'chevLeft', 18)}</button></div><nav class="nav" id="primary-navigation" aria-label="Principal">${navItems}</nav><span class="header-actions">${modeBtn('iconbtn theme-trigger')}${notificationButton('iconbtn', 'notification-top')}<button type="button" class="iconbtn" data-action="reload-app" aria-label="Atualizar app" title="Atualizar app">${icon('refresh', 20)}</button><a class="profile-link iconbtn" href="/config" ${ui.route === 'config' ? raw('aria-current="page"') : ''} aria-label="Perfil e configurações" title="Perfil e configurações">${icon('user', 20)}</a></span></header>
    <main class="main" id="main" data-route="${ui.route}" tabindex="-1">
      ${persistenceNotice()}
      ${notificationsHtml()}
      ${navigator.onLine === false ? h`<div class="notice warn offline-banner" role="status">${icon('alert', 18)}<span>Sem conexão com a internet. Alterações feitas offline não serão salvas; conecte-se e tente novamente.</span></div>` : ''}
      ${body}
      ${saveLabel ? h`<div class="app-status save-indicator" data-status="${ui.persistFailed.size || saveStatus === 'warning' ? 'warning' : saveStatus}" role="status" aria-live="polite">${saveLabel}</div>` : ''}
      ${raw(renderLegalDialog())}
    </main>
    ${ui.preview ? h`<footer class="app-footer site-footer">${raw(renderFooterContent({ authenticated: false, preview: true, includeLegalDialog: false }))}</footer>` : ''}
  </div>`;
}
function persistenceNotice() {
  if (ui.preview || ui.route === 'config' || (!ui.persistBlocked.size && !ui.persistFailed.size)) return '';
  let message;
  let action;
  if (ui.persistBlocked.size || Object.keys(ui.integrityIssues).length) {
    message = 'Alguns dados precisam de revisão; alterações estão bloqueadas para evitar perda.';
    action = h`<a class="btn sm" href="/config?section=data">Revisar dados</a>`;
  } else if (syncState.conflicts.size) {
    message = 'Sua conta foi alterada em outro dispositivo. Recarregue os dados para continuar.';
    action = h`<button type="button" class="btn sm" data-action="reload-app">Recarregar app</button>`;
  } else if (Persist.pendingSnapshot) {
    message = 'Suas alterações ainda não foram salvas. Confira sua conexão e tente novamente.';
    action = h`<button type="button" class="btn sm" data-action="persist-retry" ${navigator.onLine ? '' : raw('disabled')}>Tentar novamente</button>`;
  } else {
    message = 'Alguns dados não puderam ser carregados ou salvos. Confira Dados e backup.';
    action = h`<a class="btn sm" href="/config?section=data">Ver dados e backup</a>`;
  }
  return h`<div class="notice warn save-problem-banner" role="alert">${icon('alert', 18)}<span class="save-problem-copy">${message}</span>${action}</div>`;
}
function weeklyReviewView() {
  const review = weeklyReview(
    S.tasks,
    S.habits,
    today(),
    weekStartDay(),
    (habit, day) => habitCompletedFor(habit, day),
    (habit, day) => habitIsSkipped(habit, day, today()),
  );
  const week = weekDays(today(), weekStartDay());
  const first = pk(week[0]), last = pk(week[6]);
  const nextFirst = pk(review.nextWeek.start), nextLast = pk(review.nextWeek.end);
  const completion = review.habits.scheduled
    ? Math.round(review.habits.completed / review.habits.scheduled * 100)
    : 0;
  const weekTx = S.finance.tx.filter((transaction) => transaction.date >= week[0] && transaction.date <= week[6] && transaction.type !== 'tr');
  const weekIncome = weekTx.filter((transaction) => transaction.type === 'in').reduce((total, transaction) => total + transaction.cents, 0);
  const weekOut = weekTx.filter((transaction) => transaction.type === 'out').reduce((total, transaction) => total + transaction.cents, 0);
  const reflection = S.settings.prefs.weeklyReflection?.weekOf === week[0]
    ? S.settings.prefs.weeklyReflection.text
    : '';
  const overdue = S.tasks.filter((task) => !task.done && task.dueDate && task.dueDate < today()).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  return h`<div class="weekly-review">
    <section class="weekly-review-hero"><div><span>Fechamento semanal</span><h2>Veja o que avançou<i>.</i></h2><p>${first.getDate()} ${MESES_L[first.getMonth()]}–${last.getDate()} ${MESES_L[last.getMonth()]} · Use este retrato para ajustar a próxima semana.</p></div><div class="weekly-review-actions"><button class="btn primary" data-action="task-new">${icon('plus', 16)}Nova tarefa</button><button class="btn" data-action="weekly-open-finances">${icon('wallet', 16)}Ver finanças</button></div></section>
    <section class="card weekly-review-main"><div class="head"><div><p class="section-kicker">Seu ritmo</p><h2>Revisão da semana<i>.</i></h2></div><span class="small muted">Atualizada hoje</span></div>
      <div class="review-stats">
        <div class="stat"><b>${review.tasks.completed}</b><span>Tarefas concluídas</span></div>
        <div class="stat"><b>${completion}%</b><span>Hábitos concluídos</span></div>
        <div class="stat"><b>${money(weekOut)}</b><span>Gastos nesta semana</span><small>Entradas ${brl(weekIncome)} · resultado ${brl(weekIncome - weekOut)}</small></div>
      </div>
      <section class="review-habits" aria-labelledby="review-habits-title"><h3 id="review-habits-title">Hábitos</h3>
        ${review.habits.count
          ? h`<p>${review.habits.completed} de ${review.habits.scheduled} check-ins previstos concluídos (${completion}%). Em ${review.habits.count} ${plural(review.habits.count, 'hábito ativo', 'hábitos ativos')}.</p>`
          : h`<p class="small muted">Nenhum hábito ativo para esta revisão.</p>`}
      </section>
    </section>
    <section class="card weekly-reflection" aria-labelledby="weekly-reflection-title">
      <div class="head"><div><p class="section-kicker">Um minuto para você</p><h2 id="weekly-reflection-title">O que vale repetir ou ajustar?</h2></div><span class="small muted">Opcional</span></div>
      <label class="f"><span class="sr">Reflexão da semana</span><textarea id="weekly-reflection" data-keep maxlength="500" rows="3" placeholder="Uma pequena vitória, algo que aprendeu ou uma mudança para a próxima semana…">${reflection}</textarea></label>
      <div class="row"><button type="button" class="btn primary sm" data-action="weekly-save-reflection">Salvar reflexão</button></div>
    </section>
    <div class="weekly-review-grid">${overdue.length ? h`<section class="card weekly-review-alert"><div class="head"><div><p class="section-kicker">Precisa de atenção</p><h2>${overdue.length} ${plural(overdue.length, 'tarefa atrasada', 'tarefas atrasadas')}<i>.</i></h2></div><button class="btn ghost sm" data-action="weekly-open-overdue">Organizar</button></div><ul class="list">${overdue.slice(0, 3).map(taskRow)}</ul></section>` : h`<section class="card weekly-review-clear"><span>${icon('check', 20)}</span><div><h2>Sem tarefas atrasadas<i>.</i></h2><p>Você pode entrar na próxima semana com mais clareza.</p></div></section>`}
    <section class="card"><div class="head"><div><p class="section-kicker">Olhando à frente</p><h2>Prioridades da próxima semana<i>.</i></h2></div><span class="small muted">${nextFirst.getDate()}–${nextLast.getDate()} ${MESES_L[nextLast.getMonth()]}</span></div>
      ${review.nextWeek.tasks.length
        ? h`<p class="small muted weekly-plan-guidance">Para cada tarefa, mantenha a data, ajuste os detalhes ou adie por uma semana. O adiamento pode ser desfeito.</p><ul class="list">${review.nextWeek.tasks.map((task) => taskRow(task, true))}</ul>`
        : empty('Semana livre por enquanto', 'Adicione uma tarefa para organizar a próxima semana.', h`<button class="btn" data-action="task-new">${icon('plus', 16)}Nova tarefa</button>`, 'calendar')}
    </section></div>
    <section class="review-discovery" aria-label="Atalhos úteis"><span>Próximos passos</span><button type="button" data-action="weekly-open-habits">${icon('check', 16)}Revisar hábitos</button><button type="button" data-action="weekly-open-finances">${icon('wallet', 16)}Conferir gastos</button></section>
  </div>`;
}

function profileGreeting(style) {
  if (style === 'hello') return 'Olá';
  if (style === 'oi') return 'Oi';
  return timeBasedGreeting();
}
function profileAvatarMarkup(appearance, className = 'profile-greeting-avatar') {
  const profileAppearance = normalizeProfileAppearance(appearance);
  const color = PALETTES[profileAppearance.avatarColor]?.[1] || PALETTES.rose[1];
  return h`<span class="${className}" style="--profile-avatar-color:${color}" aria-hidden="true">${icon(profileAppearance.avatar, 22)}</span>`;
}
const PAGE_CONTEXT = {
  Planejar: ['Tarefas e prazos', 'Crie tarefas, organize a semana e acompanhe itens atrasados.'],
  Finanças: ['Contas e lançamentos', 'Acompanhe saldos, receitas, despesas e objetivos.'],
  Ciclo: ['Ciclo menstrual', 'Registre menstruação e sintomas para consultar o histórico e as estimativas.'],
  Hábitos: ['Registro de hábitos', 'Marque os dias realizados e consulte a frequência semanal.'],
  Ajustes: ['Perfil e preferências', 'Edite o perfil, organize as áreas e ajuste as preferências do aplicativo.'],
};
const pageTitle = (title, action = '') => {
  const [eyebrow, description] = PAGE_CONTEXT[title] || [];
  return h`<header class="page-title"><div class="page-title-copy">${eyebrow ? h`<span class="page-title-eyebrow">${eyebrow}</span>` : ''}<h1>${title}<i>.</i></h1>${description ? h`<p>${description}</p>` : ''}</div>${action}</header>`;
};
const empty = (title, text, action = '', iconName = 'sparkles') => h`<section class="empty" role="status" aria-live="polite" aria-label="${title}"><span class="eic" aria-hidden="true">${icon(iconName, 28)}</span><div class="empty-copy"><b>${title}</b><span>${text}</span></div>${action ? h`<div class="empty-action">${action}</div>` : ''}</section>`;
const ring = (done, total) => { const c = 2 * Math.PI * 32, pc = total ? done / total : 0; return h`<div class="ringw" role="img" aria-label="${done} de ${total} tarefas de hoje concluídas"><svg width="76" height="76" viewBox="0 0 76 76" aria-hidden="true"><circle class="ring-bg" cx="38" cy="38" r="32" fill="none" stroke-width="7"/><circle class="ring-fg" cx="38" cy="38" r="32" fill="none" stroke-width="7" stroke-linecap="round" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - pc)).toFixed(1)}" transform="rotate(-90 38 38)"/></svg><div class="rt">${done}/${total}</div></div>`; };
const areaOn = (a) => Boolean(S.settings.areas[a])
  && (a !== 'cycle' || canAccessCycle(S.settings.profile, ui.preview));
function setAreaEnabled(settings, area, enabled) {
  if (!Object.hasOwn(settings.areas, area)) return false;
  if (area === 'cycle' && enabled && !canAccessCycle(settings.profile, ui.preview)) return false;
  settings.areas[area] = enabled;
  if (enabled) {
    const menuItem = MENU_ITEMS.find((item) => item.area === area);
    if (menuItem) {
      settings.prefs.visibleMenuItems = normalizeVisibleMenuItems([
        ...settings.prefs.visibleMenuItems,
        menuItem.id,
      ]);
    }
  }
  return true;
}
function gate(area, name) {
  if (areaOn(area)) return null;
  return h`<div class="card">${empty(name + ' está desligado', 'Esta área é opcional. Ative quando quiser; você pode desligar depois sem perder o que registrou.', h`<button class="btn primary" data-action="enable-area" data-area="${area}">Ativar ${name}</button>`)}</div>`;
}
function areaNav(cur) {
  const areas = { ...S.settings.areas, cycle: areaOn('cycle') };
  const items = orderMenuItems(S.settings.prefs.menuOrder, areas, false, S.settings.prefs.visibleMenuItems, HIDDEN_MENU_IDS).filter(({ area }) => area);
  if (items.length < 2) return '';
  return h`<nav class="areanav scroll-x" aria-label="Áreas">${items.map(({ id, label, icon: iconName }) => h`<a href="/${id}" ${id === cur ? raw('aria-current="page"') : ''}>${icon(iconName, 16)}${tabLabel(label)}</a>`)}</nav>`;
}
function areaGuideButton(route) {
  if (!AREA_GUIDES[route]) return '';
  return h`<button type="button" class="btn ghost area-guide-button" data-action="area-guide-open" data-area-guide="${route}">${icon('play', 16)}Como usar?</button>`;
}
function areaPageTitle(route, title, action = '') {
  return pageTitle(title, h`<div class="area-page-actions">${action}${areaGuideButton(route)}</div>`);
}
function financePrivacyNotice() {
  return h`<aside class="notice finance-privacy-note" role="note"><span><strong>Sem conexão bancária</strong><span>${FINANCE_PRIVACY_NOTICE}</span></span></aside>`;
}

/* ---------- Tarefas (reuso) ---------- */
const taskVisible = (t) => !t.done || (t.doneAt && isoDay(t.doneAt) === today());
function dueBadge(t) {
  if (!t.dueDate) return '';
  const d = dayDiff(t.dueDate, today());
  if (!t.done && d < 0) return h`<span class="badge bad">${icon('alert', 12)}Atrasada · ${shortDate(t.dueDate)}</span>`;
  if (d === 0) return h`<span class="badge warn">Hoje</span>`;
  if (d === 1) return h`<span class="badge">Amanhã</span>`;
  return h`<span class="badge">${shortDate(t.dueDate)}</span>`;
}
function taskRow(t, reviewNextWeek = false, homeNextStep = false) {
  const isReviewNextWeek = reviewNextWeek === true;
  const isHomeNextStep = homeNextStep === true;
  const d = t.dueDate ? dayDiff(t.dueDate, today()) : null;
  const tm = t.time ? ' ' + t.time : '', subs = t.subtasks || [], sd = subs.filter((x) => x.done).length;
  const due = !t.dueDate ? '' : (!t.done && d < 0) ? h`<span class="m-bad">Atrasada · ${shortDate(t.dueDate)}${tm}</span>` : d === 0 ? (isHomeNextStep ? (t.time ? h`<span>${t.time}</span>` : '') : h`<span class="m-warn">Hoje${tm}</span>`) : d === 1 ? h`<span>Amanhã${tm}</span>` : h`<span>${shortDate(t.dueDate)}${tm}</span>`;
  const man = ui.route === 'planejar' && ui.filters.sort === 'manual' && !t.done;
  const taskIcon = taskIconKey(t.icon);
  return h`<li class="task ${t.done ? 'done' : ''}${isReviewNextWeek ? ' weekly-plan-task' : ''}${isHomeNextStep ? ' home-next-task' : ''}" data-k="${t.id}" ${man ? raw('draggable="true"') : ''}>${man ? h`<span class="mvc"><button type="button" class="ibtn mv" data-action="mv-up" data-id="${t.id}" aria-label="Mover para cima: ${t.title}">${icon('arrowUp', 16)}</button><button type="button" class="ibtn mv" data-action="mv-down" data-id="${t.id}" aria-label="Mover para baixo: ${t.title}">${icon('arrowDown', 16)}</button></span>` : ''}
    <button class="chk p-${t.priority}" role="checkbox" aria-checked="${String(t.done)}" aria-label="${t.done ? 'Reabrir' : 'Concluir'}: ${t.title}" data-action="toggle" data-id="${t.id}"><span>${icon('check', 15)}</span></button>
    <button class="tt" data-action="edit-task" data-id="${t.id}" aria-label="${isHomeNextStep ? 'Próximo passo. ' : ''}Editar: ${t.title}"><span class="task-title-line">${taskIcon ? icon(taskIcon, 17, 'task-title-icon') : ''}<span class="ttl">${t.title}</span>${isHomeNextStep ? h`<span class="home-next-step-label">Próximo passo</span>` : ''}</span>
      <span class="meta">${due}${t.priority === 'high' ? h`<span class="m-hi">${icon('flag', 12)}Alta</span>` : t.priority === 'low' ? h`<span>Prioridade baixa</span>` : ''}${t.repeat && t.repeat !== 'none' ? h`<span class="mi" title="${REPEATS[t.repeat]}">${icon('repeat', 12)}${REPEATS[t.repeat]}</span>` : ''}${t.remind != null && t.time ? h`<span class="mi" title="Lembrete">${icon('bell', 12)}</span>` : ''}${subs.length ? h`<span class="mi">${icon('list', 12)}${sd}/${subs.length}</span>` : ''}${t.notes ? h`<span class="mi" title="Tem notas">${icon('note', 12)}</span>` : ''}${(t.tags || []).map((g) => h`<span class="tgx">#${g}</span>`)}${t.groupTitle ? h`<span>${icon('list', 12)} <span class="user-value">${t.groupTitle}</span></span>` : ''}${t.sample ? h`<span>Exemplo</span>` : ''}</span></button>
    <button class="ibtn" data-action="del-task" data-id="${t.id}" aria-label="Excluir ${t.title}">${icon('trash', 18)}</button>
    ${isReviewNextWeek ? h`<div class="weekly-plan-actions" role="group" aria-label="Decisão para ${t.title}"><button type="button" class="btn ghost sm" data-action="weekly-keep-task" data-id="${t.id}">Manter</button><button type="button" class="btn ghost sm" data-action="edit-task" data-id="${t.id}">Ajustar</button><button type="button" class="btn ghost sm" data-action="weekly-defer-task" data-id="${t.id}">Adiar uma semana</button></div>` : ''}
  </li>`;
}
const prioOptions = (cur) => Object.entries(PRIO).map(([k, v]) => h`<option value="${k}" ${k === cur ? raw('selected') : ''}>${v}</option>`);

/* ---------- gráfico de barras semanal (SVG) ---------- */
function barChart(points, goal, unit) {
  const W = 320, H = 150, top = goal ? 30 : 14, bot = 24, bw = 28, gap = (W - bw * points.length) / (points.length + 1);
  const max = Math.max(goal || 0, ...points.map((p) => p.v), 1) * 1.1;
  const y = (v) => top + (H - top - bot) * (1 - v / max);
  const displayUnit = unit === 'mL' ? '<tspan class="case-preserve">mL</tspan>' : esc(unit);
  const bars = points.map((p, i) => { const x = gap + i * (bw + gap), yy = y(p.v); return `<rect class="b ${p.today ? 'today' : ''}" x="${x}" y="${yy}" width="${bw}" height="${Math.max(0, H - bot - yy)}" rx="6"><title>${esc(p.label)}: ${p.v} ${esc(unit)}</title></rect><text x="${x + bw / 2}" y="${H - 7}" text-anchor="middle">${esc(p.label)}</text>`; }).join('');
  const g = goal ? `<text class="goal-label" x="4" y="16" text-anchor="start">meta ${goal} ${displayUnit}</text><line class="g" x1="0" x2="${W}" y1="${y(goal)}" y2="${y(goal)}"/>` : '';
  const sum = points.map((p) => `${p.label}: ${p.v} ${unit}`).join(', ');
  return raw(`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Últimos 7 dias. ${esc(sum)}">${bars}${g}</svg>`);
}
const last7 = (valueOf) => Array.from({ length: 7 }, (_, i) => { const k = addDays(today(), i - 6); return { label: DIAS[pk(k).getDay()], v: valueOf(k), today: i === 6 }; });

/* ---------- render principal ---------- */
function applyTheme(theme) {
  const settings = settingsView();
  const r = document.documentElement, L = settings.look, th = theme || settings.theme, [p, pd] = paletteColors(th, L);
  r.setAttribute('data-palette', th); r.style.setProperty('--p', p); r.style.setProperty('--pd', pd);
  const effectiveMode = L.mode === 'auto' ? (systemThemeQuery?.matches ? 'dark' : 'light') : L.mode;
  r.setAttribute('data-theme', effectiveMode);
  const areaColors = normalizeHomeAreaColors(settings.prefs.areaColors);
  HOME_AREA_COLORS.forEach(({ id, css }) => {
    const color = areaColors[id] ? homeAreaColorValue(areaColors[id], effectiveMode) : '';
    if (color) r.style.setProperty(`--area-${css}`, color);
    else r.style.removeProperty(`--area-${css}`);
  });
  r.setAttribute('data-density', L.density); r.setAttribute('data-fs', L.font);
  r.setAttribute('data-contrast', L.contrast ? 'high' : 'normal');
  r.setAttribute('data-readable', L.readable ? 'true' : 'false');
  r.setAttribute('data-links', L.highlightLinks ? 'highlight' : 'normal');
  r.setAttribute('data-motion', L.reduceMotion ? 'reduce' : 'normal');
  const themeColor = getComputedStyle(r).getPropertyValue('--bg').trim();
  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => { meta.content = themeColor; });
}
const systemThemeQuery = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null;
let headerScrollFrame = 0;
// O atributo no documento persiste quando o shell é renderizado novamente.
function syncHeaderScrollState() {
  if (headerScrollFrame) return;
  headerScrollFrame = requestAnimationFrame(() => {
    if (window.scrollY > 28) document.documentElement.setAttribute('data-scrolled', 'true');
    else document.documentElement.removeAttribute('data-scrolled');
    headerScrollFrame = 0;
  });
}
window.addEventListener('scroll', syncHeaderScrollState, { passive: true });
syncHeaderScrollState();
if (systemThemeQuery) {
  const updateSystemTheme = () => { if (settingsView().look.mode === 'auto') applyTheme(); };
  if (typeof systemThemeQuery.addEventListener === 'function') systemThemeQuery.addEventListener('change', updateSystemTheme);
  else systemThemeQuery.addListener(updateSystemTheme);
}
const MODE_NEXT = { auto: 'light', light: 'dark', dark: 'auto' }, MODE_NAME = { auto: 'automático', light: 'claro', dark: 'escuro' }, MODE_IC = { auto: 'monitor', light: 'sun', dark: 'moon' };
function modeBtn(cls) { const m = settingsView().look.mode; return h`<button type="button" class="${cls}" data-action="look-cycle" aria-label="${'Tema ' + MODE_NAME[m] + '. Tocar para alternar'}" title="${'Tema: ' + MODE_NAME[m]}">${icon(MODE_IC[m], cls === 'iconbtn theme-trigger' ? 20 : 18)}${cls === 'nl nlb' ? h`<span>Tema: ${MODE_NAME[m]}</span>` : ''}</button>`; }
function cycleThemeMode() { setThemeMode(MODE_NEXT[settingsView().look.mode] || 'auto'); }
function setThemeMode(mode) {
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
function accessibilityOption(id, action, label, description, pressed) {
  return h`<button type="button" id="${id}" class="accessibility-option" data-action="${action}" aria-pressed="${String(pressed)}"><span class="accessibility-option-copy"><b>${label}</b><small>${description}</small></span><span class="accessibility-state" aria-hidden="true">${pressed ? 'Ativado' : 'Desativado'}</span></button>`;
}
function describeDialogOpener(target) {
  if (!(target instanceof HTMLElement) || target === document.body || target === document.documentElement) return null;
  return {
    element: target,
    tag: target.tagName,
    id: target.id,
    data: { ...target.dataset },
    label: target.getAttribute('aria-label'),
    href: target.getAttribute('href'),
    text: target.textContent.trim().replace(/\s+/g, ' ')
  };
}
function restoreDialogOpener(opener) {
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
  return h`${areaNav('ciclo')}${pageTitle('Ciclo')}
    <section class="card cycle-consent-card" aria-labelledby="cycle-consent-title">
      <span class="section-kicker">Consentimento específico</span>
      <h2 id="cycle-consent-title">Antes de abrir Ciclo<i>.</i></h2>
      <p>Os registros de ciclo menstrual e sintomas são dados pessoais sensíveis de saúde. Usamos o que você escolher registrar para mostrar períodos, histórico e estimativas nesta área. Os registros ficam associados à sua conta e não são criptografados de ponta a ponta.</p>
      <p>Você pode recusar e continuar usando as outras áreas. Se retirar o consentimento depois, Ciclo será bloqueado; os registros já salvos permanecerão na conta até que você solicite a exclusão ou apague a conta.</p>
      <form class="cycle-consent-form" data-form="cycle-data-consent">
        <label class="cycle-consent-check"><input type="checkbox" name="cycleConsent" required ${ui.cycleConsentBusy ? raw('disabled') : ''}><span>Consinto especificamente com o tratamento dos dados de saúde que eu registrar na área Ciclo para oferecer esses recursos.</span></label>
        <p>Leia a <a href="/privacy.html" data-legal-document="privacy" target="_blank" rel="noopener noreferrer">Política de Privacidade</a> para detalhes e formas de retirar o consentimento.</p>
        <p class="notice warn" role="alert" ${ui.cycleConsentError ? '' : raw('hidden')}>${ui.cycleConsentError}</p>
        <div class="row cycle-consent-actions"><button class="btn primary" type="submit" ${ui.cycleConsentBusy ? raw('disabled aria-busy="true"') : ''}>${ui.cycleConsentBusy ? 'Registrando…' : 'Concordar e abrir Ciclo'}</button><a class="btn back" href="/inicio">Agora não</a></div>
      </form>
    </section>`;
}
function render() {
  acquireActiveScrollLocks();
  ui.dirty = false;
  applyTheme();
  const routeChanged = renderedRoute !== null && renderedRoute !== ui.route;
  const keep = {};
  $$('[data-keep]').forEach((el) => { if (el.id) keep[el.id] = el.type === 'checkbox' ? el.checked : el.value; });
  const active = document.activeElement;
  const af = active && active.id;
  if (ui.dlg && !$('#dlg') && !ui.lastFocus) ui.lastFocus = describeDialogOpener(active);
  const needsCycleConsent = ui.route === 'ciclo'
    && !ui.preview
    && areaOn('cycle')
    && !hasCurrentCycleDataConsent(accountSession?.user);
  const page = needsCycleConsent ? cycleDataConsentGate() : (ROUTES[ui.route] || ROUTES.inicio)();
  const app = $('#app');
  app.innerHTML = shell(page).s;
  initializeFaqDisclosure(app);
  if (routeChanged) {
    const main = app.querySelector('.main');
    if (main) main.classList.add('route-enter');
  }
  renderedRoute = ui.route;
  updateDocumentTitle();
  for (const [id, v] of Object.entries(keep)) { const el = document.getElementById(id); if (el) { if (el.type === 'checkbox') el.checked = v; else el.value = v; } }
  if (af && keep[af] !== undefined) { const el = document.getElementById(af); if (el) { el.focus(); try { el.setSelectionRange(el.value.length, el.value.length); } catch (e) { /* tipo sem seleção */ } } }
  const dc = $('.dchip.on'); if (dc && dc.parentElement) { const sx = dc.parentElement; sx.scrollLeft = dc.offsetLeft - sx.clientWidth / 2 + dc.offsetWidth / 2; }
  $$('.habit-year-grid').forEach((grid) => { grid.scrollLeft = grid.scrollWidth; });
  renderDialog();
  $('#app').inert = Boolean(ui.dlg);
  renderToast();
  renderPwaUpdateNotice();
  tick();
}
function renderPwaUpdateNotice() {
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
  message.textContent = 'Nova versão disponível — atualizar quando terminar o que estiver fazendo.';
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
  pwaRegistration = registration;
  let announcedWorker = null;
  const announceWaitingWorker = () => {
    const waiting = registration.waiting;
    if (!waiting || !navigator.serviceWorker.controller || waiting === announcedWorker) return;
    announcedWorker = waiting;
    ui.pwaUpdateAvailable = true;
    ui.pwaUpdateDismissed = false;
    renderPwaUpdateNotice();
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
function registerPwaSupport() {
  if (!import.meta.env.PROD
    || import.meta.env.VITE_PWA_ENABLED === 'false'
    || isNativeApp()
    || !('serviceWorker' in navigator)) return Promise.resolve(null);
  if (!pwaSupportPromise) {
    pwaSupportPromise = (async () => {
      try {
        const registration = await navigator.serviceWorker.register('/service-worker.js');
        watchPwaRegistration(registration);
        await navigator.serviceWorker.ready;
        return registration;
      } catch (error) {
        pwaSupportPromise = null;
        console.error('O Aurora não conseguiu iniciar o suporte offline.', error);
        ui.habitPushNotice = pushNotificationErrorMessage(new Error('service-worker'));
        if (ui.route === 'habitos') render();
        return null;
      }
    })();
  }
  return pwaSupportPromise;
}
async function applyPwaUpdate() {
  const waiting = pwaRegistration?.waiting;
  if (!waiting) {
    ui.pwaUpdateAvailable = false;
    renderPwaUpdateNotice();
    toast('Não há uma atualização aguardando. Tente recarregar o app mais tarde.');
    return;
  }
  const hasUnsavedChanges = settingsDraftDirty()
    || Boolean(ui.profileDraft)
    || Boolean(ui.dlg)
    || ui.persistFailed.size > 0;
  if (hasUnsavedChanges
    && !await confirmInDialog('Há alterações que ainda não foram salvas. Aplicar a atualização pode descartá-las. Deseja continuar?')) return;
  if (Persist.store && !await Persist.flush()) {
    toast('A atualização foi adiada porque não foi possível confirmar os dados salvos. Tente novamente.');
    return;
  }
  if (pwaReloading) return;
  pwaReloading = true;
  const button = $('[data-action="pwa-update-apply"]');
  if (button) { button.disabled = true; button.setAttribute('aria-busy', 'true'); }
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload();
  }, { once: true });
  waiting.postMessage({ type: 'SKIP_WAITING' });
}
function setToast(msg, undo) {
  clearTimeout(ui.toastT);
  if (Object.keys(ui.integrityIssues).length) {
    const slices = Object.keys(ui.integrityIssues).join(', ');
    msg = `Dados inválidos em ${slices}. A gravação está bloqueada; abra Ajustes para baixar uma cópia ou importar um backup.`;
    undo = null;
  } else if (ui.persistFailed.size) {
    msg = `Não foi possível salvar as alterações. Confira sua conexão e tente novamente.${ui.persistError ? ` Detalhe técnico: ${ui.persistError}` : ''}`;
    undo = null;
  }
  const text = String(msg?.s || msg).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().toLocaleLowerCase('pt-BR');
  const tone = undo ? 'action'
    : /não foi|falha|inválid|não puderam|indisponível|erro|não consegui/.test(text) ? 'error'
      : /selecione|informe|escolha|revise|dê um nome|pause|conclua ou descarte|máx\.|deve/.test(text) ? 'warning'
        : /salv|adicion|concluíd|baixad|atualiz|registrad|sincroniz|enviad|importad|copiad|conectad|restaurad/.test(text) ? 'success'
          : 'info';
  ui.toast = { msg, undo, tone };
  ui.toastT = setTimeout(() => { ui.toast = null; renderToast(); }, undo ? 9000 : 5000);
  renderToast();
}
function renderToast() {
  let el = $('#toast');
  if (!ui.toast) { if (el) el.remove(); return; }
  if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; document.body.appendChild(el); }
  const icons = { success: 'check', warning: 'alert', error: 'alert', action: 'repeat', info: 'info' };
  const labels = { success: 'Concluído', warning: 'Atenção', error: 'Não foi possível concluir', action: 'Alteração feita', info: 'Informação' };
  el.className = `toast toast-${ui.toast.tone}${ui.dlg || ui.navigationOpen || ui.quickActionsOpen ? ' toast-top' : ''}`;
  el.setAttribute('role', ui.toast.tone === 'error' ? 'alert' : 'status');
  const toastMessage = typeof ui.toast.msg === 'string' ? preserveCopyTerms(ui.toast.msg) : ui.toast.msg;
  el.innerHTML = h`<span class="toast-icon" aria-hidden="true">${icon(icons[ui.toast.tone], 18)}</span><span class="toast-content"><span class="toast-label">${labels[ui.toast.tone]}</span><span class="toast-message">${toastMessage}</span></span>${ui.toast.undo ? h`<button data-action="undo">Desfazer</button>` : ''}<i class="toast-timer" aria-hidden="true"></i>`.s;
}
function resetSettingsTabBeforeLeaving() {
  const path = settingsRootPath(location);
  if (!path) return;
  history.replaceState(null, '', path);
  const url = new URL(path, location.href);
  activeRouteLocationKey = `config?${url.search.slice(1)}`;
}
document.addEventListener('click', (event) => {
  if (ui.route !== 'config' || event.defaultPrevented || event.button !== 0
    || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey
    || !(event.target instanceof Element)) return;
  const link = event.target.closest('a[href^="/"]');
  if (!link || (link.target && link.target !== '_self')) return;
  const targetRoute = routeFromLocation(new URL(link.href), new Set(Object.keys(ROUTES))).route;
  if (targetRoute !== 'config') {
    resetSettingsTabBeforeLeaving();
  }
}, true);
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
  return Boolean(ui.profileDraft || settingsDraftDirty());
}
async function confirmLeavingSettingsRoute(route) {
  if (!hasUnsavedSettingsChanges()) return true;
  const next = routeFromLocation(new URL(route.startsWith('/') ? route : routePathFor(route), location.href), new Set(Object.keys(ROUTES))).route;
  if (ui.route === 'config' && next === 'config') return true;
  return await confirmInDialog('Sair sem salvar?');
}
function nav(route) {
  const requestedPath = route.startsWith('/') ? route : routePathFor(route);
  const requestedUrl = new URL(requestedPath, location.href);
  const nextRoute = routeFromLocation(requestedUrl, new Set(Object.keys(ROUTES))).route;
  if (ui.route === 'config' && nextRoute !== 'config') resetSettingsTabBeforeLeaving();
  const destinationUrl = new URL(requestedPath, location.href);
  const preservedParams = new URLSearchParams(location.search);
  ['section', 'weight', 'etapa'].forEach((key) => preservedParams.delete(key));
  new URLSearchParams(destinationUrl.search).forEach((value, key) => preservedParams.set(key, value));
  destinationUrl.search = preservedParams.toString();
  const destination = `${destinationUrl.pathname}${destinationUrl.search}${destinationUrl.hash}`;
  const currentPath = `${location.pathname}${location.search}`;
  const nextPath = `${destinationUrl.pathname}${destinationUrl.search}`;
  if (hasUnsavedSettingsChanges() && nextRoute !== ui.route) {
    void confirmLeavingSettingsRoute(route).then((confirmed) => {
      if (!confirmed) return;
      if (ui.profileDraft) ui.profileDraft = null;
      if (settingsDraftDirty()) {
        ui.settingsDraft = null;
        ui.settingsDraftBase = null;
      }
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
document.addEventListener('click', (event) => {
  if (event.defaultPrevented || event.button !== 0
    || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey
    || !(event.target instanceof Element)) return;
  const link = event.target.closest('a[href^="/"]');
  if (!link || link.dataset.action || link.download || (link.target && link.target !== '_self')) return;
  const destinationUrl = new URL(link.href);
  if (destinationUrl.origin !== location.origin) return;
  event.preventDefault();
  nav(`${destinationUrl.pathname}${destinationUrl.search}${destinationUrl.hash}`);
}, true);
function focusRouteTarget(id) {
  const target = document.getElementById(id);
  if (!target) return;
  target.focus({ preventScroll: true });
  target.scrollIntoView({ block: 'start' });
}
function onRoute() {
  const wasBooted = ui.booted;
  const previousRoute = ui.route;
  const previousScroll = window.scrollY;
  ui.navigationOpen = false;
  ui.quickActionsOpen = false;
  const fallbackRoute = document.querySelector('meta[name="aurora-route"]')?.content || 'inicio';
  const resolved = routeFromLocation(location, new Set(Object.keys(ROUTES)), fallbackRoute);
  if (resolved.route === 'ciclo' && !canAccessCycle(S.settings.profile, ui.preview)) {
    const hasProfileSex = Boolean(S.settings.profile.sex);
    const destination = hasProfileSex ? '/inicio' : '/config?section=profile';
    history.replaceState(null, '', destination);
    resolved.route = hasProfileSex ? 'inicio' : 'config';
    resolved.query = hasProfileSex ? '' : 'section=profile';
    resolved.replacePath = null;
    toast(hasProfileSex
      ? 'Ciclo está disponível apenas para mulheres.'
      : 'Preencha sua identidade de gênero em Ajustes → Seu perfil. Ciclo está disponível apenas para mulheres.');
  }
  if (resolved.replacePath) history.replaceState(null, '', resolved.replacePath);
  const routeLocationKey = `${resolved.route}?${resolved.query}`;
  if (wasBooted && routeLocationKey === activeRouteLocationKey) return;
  activeRouteLocationKey = routeLocationKey;
  ui.booted = true;
  const { query } = resolved;
  ui.route = resolved.route;
  const routeChanged = wasBooted && previousRoute !== ui.route;
  if (routeChanged) routeScrollPositions.set(previousRoute, previousScroll);
  const targetFocus = query === 'weight' ? 'pk' : null;
  const requestedSettingsTab = settingsTabId(new URLSearchParams(query).get('section'));
  if (ui.route === 'config') {
    ui.settingsTab = SETTINGS_SECTIONS.some(([id]) => id === requestedSettingsTab)
      ? requestedSettingsTab
      : 'profile';
  }
  render();
  if (resolved.scrollTarget) requestAnimationFrame(() => focusRouteTarget(resolved.scrollTarget));
  if (targetFocus) {
    requestAnimationFrame(() => {
      const el = document.getElementById(targetFocus);
      if (el) {
        el.focus();
        try { el.setSelectionRange(el.value.length, el.value.length); } catch (e) { /* tipo sem seleção */ }
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

/* ========== Páginas: Início, Planejar, Foco ========== */
const todayTasks = () => S.tasks.filter((t) => t.dueDate && t.dueDate <= today() && taskVisible(t)).sort((a, b) => a.dueDate.localeCompare(b.dueDate) || (a.time || '99:99').localeCompare(b.time || '99:99'));
async function syncHabitReminderSchedule() {
  const status = getPushNotificationStatus();
  if (!status.enabled) return false;
  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const reminders = S.habits
      .filter((habit) => habit.status === 'active' && habit.remind && isTime(habit.remind))
      .map((habit, index) => ({
        id: `habit-${index}`,
        days: [...habit.days],
        time: habit.remind,
        timeZone,
        skipDate: habitCompletedFor(habit, today()) || habitIsSkipped(habit, today(), today()) ? today() : null,
      }));
    if (reminders.length) await scheduleHabitPushReminders(reminders);
    else await cancelHabitPushReminders();
    ui.habitPushNotice = reminders.length
      ? `Lembretes atualizados. A entrega depende da rede, do serviço e das permissões ${getPushNotificationStatus().native ? 'do dispositivo' : 'do navegador'}.`
      : 'Não há horários de lembrete ativos para enviar ao serviço.';
    return true;
  } catch (error) {
    ui.habitPushNotice = `Não foi possível atualizar os lembretes fora do app: ${pushNotificationErrorMessage(error)}`;
    return false;
  }
}
function toggleHabitPush() {
  if (ui.pushBusy) return;
  const wasEnabled = getPushNotificationStatus().enabled;
  let operation;
  try {
    operation = wasEnabled ? disablePushNotifications() : enablePushNotifications();
  } catch (error) {
    ui.habitPushNotice = pushNotificationErrorMessage(error);
    render();
    return;
  }
  ui.pushBusy = true;
  ui.habitPushNotice = wasEnabled ? 'Desativando avisos…' : 'Solicitando permissão e configurando avisos…';
  render();
  Promise.resolve(operation).then(async () => {
    if (wasEnabled) {
      ui.habitPushNotice = 'Avisos desativados neste dispositivo.';
      return;
    }
    await syncHabitReminderSchedule();
  }).catch((error) => {
    ui.habitPushNotice = `Não foi possível ${wasEnabled ? 'desativar' : 'ativar'} os avisos: ${pushNotificationErrorMessage(error)}`;
  }).finally(() => {
    ui.pushBusy = false;
    render();
  });
}
const habitCompletedFor = (habit, day) => habitIsComplete(habit, day);
const sampleBanner = () => S.settings.prefs.sample ? h`<div class="notice warn sample-banner" role="note">${icon('info', 18)}<div class="grow">Você está vendo dados de exemplo. Eles ajudam a conhecer o app, mas não são seus.</div><button class="btn sm" data-action="clear-sample">Limpar exemplos</button></div>` : '';
function backupReminderStatusForApp(now = Date.now()) {
  if (S.settings.prefs.sample || ui.backupReminderHidden) return null;
  const activityAt = [
    ...S.tasks.map((task) => Number(task.createdAt)),
    ...S.finance.tx.map((transaction) => Number(transaction.createdAt)),
    ...S.water.map((entry) => Date.parse(entry.at)),
  ];
  S.habits.forEach((habit) => {
    [...(habit.completions || []), ...(habit.skipped || [])].forEach((day) => {
      if (isDay(day)) activityAt.push(new Date(`${day}T12:00:00`).getTime());
    });
  });
  const lastBackupAt = S.settings.prefs.lastBackup ? Date.parse(S.settings.prefs.lastBackup) : null;
  return backupReminderStatus({ lastBackupAt, activityAt, now });
}
const backupReminder = () => {
  const status = backupReminderStatusForApp();
  if (!status) return '';
  const text = status.byActivity
    ? S.settings.prefs.lastBackup
      ? `${status.activities} registros foram feitos desde o último backup.`
      : `${status.activities} registros foram feitos e você ainda não exportou um backup.`
    : S.settings.prefs.lastBackup
      ? `Seu último backup foi há ${status.days} dias.`
      : `Você usa o Aurora há ${status.days} dias e ainda não exportou um backup.`;
  return h`<div class="notice backup-reminder" role="note">${icon('archive', 18)}<div class="grow"><b>Hora de guardar uma cópia</b><br><span class="small">${text} Os dados são sincronizados com sua conta; o backup é uma cópia independente.</span></div><a class="btn sm primary" href="/config?section=data">Fazer backup</a><button type="button" class="btn sm ghost" data-action="backup-reminder-dismiss">Agora não</button></div>`;
};

function homeUpcomingBill() {
  if (!areaOn('finances')) return '';
  const todayKey = today();
  const next = S.finance.accounts
    .filter((account) => account.type === 'credit')
    .map((account) => ({ account, info: cardInfo(account) }))
    .filter(({ info }) => info.due && info.total > 0 && info.used > 0 && info.due <= addDays(todayKey, 7))
    .sort((left, right) => left.info.due.localeCompare(right.info.due))[0];
  if (!next) return '';
  const { account } = next;
  const due = next.info.due;
  const days = dayDiff(due, todayKey);
  const dueLabel = days < 0 ? `Vencida há ${Math.abs(days)} ${plural(Math.abs(days), 'dia', 'dias')}`
    : days === 0 ? 'Vence hoje' : `Vence em ${days} ${plural(days, 'dia', 'dias')}`;
  return h`<section class="card home-next-action home-bill-reminder" aria-labelledby="home-bill-title"><div class="home-next-mark">${icon('card', 19)}</div><div class="grow"><span class="section-kicker">Lembrete financeiro</span><h2 id="home-bill-title">Fatura de ${accountDisplayName(account)}</h2><p>${dueLabel} · ${shortDate(due)}</p></div><a class="btn ghost sm" href="/financas">Ver Finanças</a></section>`;
}

function homeInboxReminder(tasks) {
  if (!tasks.length) return '';
  return h`<section class="notice home-inbox-reminder" aria-labelledby="home-inbox-title">
    ${icon('inbox', 18)}
    <div class="grow"><b id="home-inbox-title">${tasks.length} ${plural(tasks.length, 'tarefa sem data', 'tarefas sem data')}</b><span>Escolha o que você quer planejar agora; o restante pode esperar.</span></div>
    <a class="btn ghost sm" href="/planejar" data-action="filter-inbox">Organizar tarefas</a>
  </section>`;
}

function homeUpcomingTasks() {
  const endDate = addDays(today(), 7);
  const upcoming = S.tasks
    .filter((task) => !task.done && task.dueDate > today() && task.dueDate <= endDate)
    .sort((left, right) => left.dueDate.localeCompare(right.dueDate)
      || (left.time || '99:99').localeCompare(right.time || '99:99'));
  if (!upcoming.length) return '';
  const preview = upcoming.slice(0, 3);
  const remaining = upcoming.length - preview.length;
  return h`<section class="card home-upcoming-card" aria-labelledby="home-upcoming-title">
    <div class="head"><div><p class="section-kicker">Depois de hoje</p><h2 id="home-upcoming-title">Próximos 7 dias<i>.</i></h2></div><a class="btn ghost sm" href="/planejar">Ver planejamento</a></div>
    <ul class="list">${preview.map((task) => taskRow(task))}</ul>
    ${remaining ? h`<p class="home-upcoming-more">+ ${remaining} ${plural(remaining, 'tarefa', 'tarefas')} na lista completa.</p>` : ''}
  </section>`;
}

function homeHabitCheckins(highlightNext = false) {
  if (!areaOn('habits')) return '';
  const scheduled = S.habits.filter((habit) => (
    (habit.status || 'active') === 'active'
    && habit.days.includes(pk(today()).getDay())
  ));
  if (!scheduled.length) return '';
  const nextHabit = highlightNext ? scheduled.find((habit) => (
    !habitCompletedFor(habit, today()) && !habitIsSkipped(habit, today(), today())
  )) : null;
  return h`<section class="card home-habit-checkins" aria-labelledby="home-habits-title">
    <div class="head"><h2 id="home-habits-title">Hábitos de hoje<i>.</i></h2><a class="btn ghost sm" href="/habitos">Ver hábitos</a></div>
    <ul class="list">${scheduled.map((habit) => {
      const completed = habitCompletedFor(habit, today());
      const skipped = habitIsSkipped(habit, today(), today());
      return h`<li class="home-habit-row${habit.id === nextHabit?.id ? ' is-next' : ''}">
        <span class="home-habit-icon" style="--hc:${habitColor(habit)}">${icon(habitIconKey(habit), 18)}</span>
        <span class="grow"><b>${habit.name}</b><span class="small muted">${completed ? 'Concluído hoje' : skipped ? 'Dia pulado hoje' : 'Ainda não marcado'}</span>${habit.id === nextHabit?.id ? h`<span class="home-next-step-label">Próximo passo</span>` : ''}</span>
        <button type="button" class="btn sm ${completed || skipped ? 'back' : 'primary'}" data-action="${skipped ? 'habit-skip' : 'habit-check'}" data-id="${habit.id}" aria-pressed="${String(completed || skipped)}">${icon(completed ? 'check' : skipped ? 'close' : 'plus', 16)}${completed ? 'Concluído' : skipped ? 'Desfazer pulo' : 'Marcar'}</button>
      </li>`;
    })}</ul>
  </section>`;
}

function homeFirstSteps() {
  if (S.settings.prefs.firstStepsDismissed) return '';
  const hasActiveHabit = S.habits.some((habit) => (habit.status || 'active') === 'active');
  const steps = [
    ['Criar uma tarefa', '/planejar', 'calendarCheck', S.tasks.length > 0],
    ...(areaOn('habits') ? [[
      hasActiveHabit ? 'Marcar um hábito' : 'Criar seu primeiro hábito',
      '/habitos',
      'leaf',
      hasActiveHabit
        ? S.habits.some((habit) => habitCompletedFor(habit, today()))
        : false,
    ]] : []),
    ...(areaOn('finances') ? [['Cadastrar uma conta financeira', '/financas', 'wallet', S.finance.accounts.length > 0]] : []),
  ];
  if (steps.every(([, , , complete]) => complete)) return '';
  const completedSteps = steps.filter(([, , , complete]) => complete).length;
  const nextStepIndex = steps.findIndex(([, , , complete]) => !complete);
  return h`<details class="card home-first-steps" aria-labelledby="home-first-steps-title">
    <summary class="home-first-steps-summary"><span><span class="section-kicker">Comece com uma ação pequena</span><h2 id="home-first-steps-title">Primeiros passos<i>.</i></h2><small class="home-first-steps-progress">${completedSteps} de ${steps.length} ações concluídas</small></span><span class="home-first-steps-toggle" aria-hidden="true">${icon('chevDown', 18)}</span></summary>
    <div class="home-first-steps-content">
      <ol class="home-first-steps-list">${steps.map(([label, href, iconName, complete], index) => h`<li class="${complete ? 'is-complete' : ''}${index === nextStepIndex ? ' is-next' : ''}">
      <a href="${href}"><span class="home-first-steps-mark" aria-hidden="true">${icon(complete ? 'check' : iconName, 18)}</span><span class="home-first-steps-copy"><b>${label}</b><small>${complete ? 'Concluído' : index === nextStepIndex ? 'Sugestão para você' : 'Começar'}</small></span>${icon('chevRight', 16, 'home-first-steps-arrow')}</a>
      </li>`)}</ol>
      <button type="button" class="btn ghost sm home-first-steps-dismiss" data-action="first-steps-dismiss">Dispensar</button>
    </div>
  </details>`;
}

function viewInicio() {
  const name = (S.settings.profile.preferredName || S.settings.profile.name).trim();
  const profileAppearance = normalizeProfileAppearance(settingsView().prefs.profileAppearance);
  const greeting = profileGreeting(profileAppearance.greeting);
  const tt = todayTasks(), pend = tt.filter((t) => !t.done), doneN = tt.length - pend.length;
  const overdue = pend.filter((t) => t.dueDate < today());
  const dueToday = pend.filter((t) => t.dueDate === today());
  const todayCount = S.tasks.filter((task) => task.dueDate === today()).length;
  const completed = tt.filter((t) => t.done);
  const inbox = S.tasks.filter((t) => !t.dueDate && !t.done);
  const optionalAreas = areaTiles();
  const homePrefs = settingsView().prefs;
  const homeLayout = homePrefs.homeLayout;
  const homeMessage = homePrefs.homeMessage;
  const sundayReview = pk(today()).getDay() === 0;
  const showHomeBlock = (id) => homeLayout.visible.includes(id);
  const homeBlockStyle = (id) => `style="order:${homeLayout.order.indexOf(id)}"`;
  const taskShortcutVisible = homePrefs.homeShortcuts.includes('task');
  const homeShortcuts = HOME_SHORTCUTS.filter(({ id, area }) => (
    homePrefs.homeShortcuts.includes(id)
    && (!area || areaOn(area))
    && !(id === 'task' && showHomeBlock('quick'))
  ));
  const nextTask = showHomeBlock('today') ? overdue[0] || dueToday[0] : null;
  const habitsToday = areaOn('habits') ? S.habits.filter((hb) => (hb.status || 'active') === 'active' && hb.days.includes(pk(today()).getDay())) : [];
  const habitsLeft = habitsToday.filter((hb) => !habitCompletedFor(hb, today())
    && !habitIsSkipped(hb, today(), today())).length;
  const habitNote = habitsToday.length ? (habitsLeft ? ` Faltam ${habitsLeft} ${plural(habitsLeft, 'hábito', 'hábitos')}.` : ' Hábitos de hoje em dia.') : '';
  const lead = (!tt.length ? 'Seu dia está livre por enquanto. Que tal planejar algo?' : pend.length ? `Você tem ${pend.length} ${plural(pend.length, 'tarefa pendente', 'tarefas pendentes')} para hoje.` : 'Tudo concluído por hoje. Aproveite o resto do dia.') + habitNote;
  return h`
    <header class="home-head" aria-labelledby="hi"><div><p class="date">${cap(longDate(today()))}</p><h1 id="hi">${profileAvatarMarkup(profileAppearance, 'home-profile-avatar')}${greeting}${name ? h`, <span class="proper-name">${name}</span>` : ''}<i>.</i></h1>${homeMessage ? h`<p class="home-personal-message">${homeMessage}</p>` : ''}<p class="lead">${lead}</p><div class="home-head-actions">${!showHomeBlock('quick') && !taskShortcutVisible ? h`<button type="button" class="home-action" data-action="home-quick-focus">${icon('plus', 18)}Nova tarefa${icon('chevRight', 16)}</button>` : ''}${areaGuideButton('inicio')}</div></div>${tt.length ? ring(doneN, tt.length) : ''}</header>
    ${sampleBanner()}
    ${sundayReview ? h`<section class="card home-next-action home-weekly-review" aria-labelledby="home-weekly-review-title"><div class="home-next-mark">${icon('chart', 19)}</div><div class="grow"><span class="section-kicker">Domingo · revisão da semana</span><h2 id="home-weekly-review-title">Um minuto para reconhecer seu progresso</h2><p>Veja hábitos, tarefas concluídas e gastos antes de começar uma nova semana.</p></div><button type="button" class="btn primary" data-action="home-weekly-review">Fazer revisão</button></section>` : ''}
    <div class="home-dashboard${optionalAreas ? '' : ' no-optional-areas'}">
      <div class="home-primary">
        ${showHomeBlock('summary') ? h`<section class="strip" aria-label="Resumo do dia" ${raw(homeBlockStyle('summary'))}>
          <a href="/planejar"><b>${todayCount}</b><span>Tarefas hoje</span></a>
          <a href="/planejar" data-action="filter-overdue"><b>${overdue.length}</b><span>Atrasadas</span></a>
        </section>` : ''}
        ${showHomeBlock('quick') ? h`<section class="card home-quick-card" aria-labelledby="home-quick-title" ${raw(homeBlockStyle('quick'))}>
          <div class="home-quick-copy"><span class="home-quick-mark" aria-hidden="true">${icon('plus', 18)}</span><div><h2 id="home-quick-title">Qual é o próximo passo<i>?</i></h2><p>Registre uma tarefa para hoje sem sair da sua rotina.</p></div></div>
          <form class="home-quick-form" data-form="home-quick-task"><label class="sr" for="home-quick-title-input">Nova tarefa para hoje</label><input id="home-quick-title-input" name="title" type="text" maxlength="120" autocomplete="off" placeholder="Ex.: revisar a apresentação" required><button class="btn primary" type="submit">${icon('plus', 16)}Adicionar</button></form>
        </section>` : ''}
        ${showHomeBlock('habits') ? h`<div ${raw(homeBlockStyle('habits'))}>${homeHabitCheckins(!nextTask)}</div>` : ''}
        ${showHomeBlock('today') ? h`        <section class="home-today-card" aria-labelledby="th" ${raw(homeBlockStyle('today'))}><div class="head"><div><p class="section-kicker">Seu plano</p><h2 id="th">Hoje</h2></div><div class="row"><a class="btn ghost sm" href="/planejar">Ver planejamento</a></div></div>
          ${tt.length ? h`<div class="home-task-groups">
            ${overdue.length ? h`<section class="home-task-group is-overdue" aria-label="Tarefas atrasadas"><h3>${icon('alert', 15)}Atrasadas <span>${overdue.length}</span></h3><ul class="list">${overdue.map((task) => taskRow(task, false, task.id === nextTask?.id))}</ul></section>` : ''}
            ${dueToday.length ? h`<section class="home-task-group" aria-label="Tarefas para hoje"><h3>${icon('calendarCheck', 15)}Para hoje <span>${dueToday.length}</span></h3><ul class="list">${dueToday.map((task) => taskRow(task, false, task.id === nextTask?.id))}</ul></section>` : ''}
            ${completed.length ? h`<details class="home-completed"><summary>${icon('check', 15)}Concluídas hoje <span class="home-completed-count">${completed.length}</span><span class="home-disclosure-indicator" aria-hidden="true">${icon('chevDown', 16)}</span></summary><ul class="list">${completed.map(taskRow)}</ul></details>` : ''}
          </div>` : empty('Seu dia está aberto', 'Inclua a primeira prioridade acima ou crie uma tarefa completa.', h`<a class="btn" href="/planejar">Ver tarefas no Planejar</a>`, 'calendarCheck')}
        </section>` : ''}
        ${homeUpcomingTasks()}
        ${homeInboxReminder(inbox)}
        ${homeUpcomingBill()}
      </div>
      ${optionalAreas ? h`<section class="home-areas" aria-labelledby="ar">${optionalAreas}</section>` : ''}
    </div>
    ${homeFirstSteps()}
    ${backupReminder()}
    ${homeShortcuts.length ? h`<section class="home-tools" aria-labelledby="home-tools-title">
      <div class="head"><h2 id="home-tools-title">Ações favoritas<i>.</i></h2></div>
      <div class="home-tool-grid compact-card-grid">
        ${homeShortcuts.map((shortcut) => {
          const action = shortcut.id === 'finance' && !S.finance.accounts.length ? 'quick-action-account' : shortcut.action;
          const label = shortcut.id === 'finance'
            ? S.finance.accounts.length ? 'Novo lançamento' : 'Criar conta financeira'
            : shortcut.label;
          return h`<button class="home-tool" type="button" data-action="${action}"><span class="home-tool-icon">${icon(shortcut.icon, 20)}</span><span><b>${label}</b><small>${shortcut.description}</small></span>${icon('chevRight', 18, 'home-tool-go')}</button>`;
        })}
      </div>
    </section>` : ''}`;
}

const FILTERS = [['todas', 'Todas'], ['pendentes', 'Pendentes'], ['atrasadas', 'Atrasadas'], ['proximas', 'Próximos 7 dias'], ['caixa', 'Sem data'], ['concluidas', 'Concluídas']];
function filteredTasks() {
  const { f, q, sort } = ui.filters, tdy = today(), nq = norm(q.trim());
  const nextWeek = addDays(tdy, 7);
  let r = S.tasks.filter((t) => {
    if (f === 'pendentes' && t.done) return false;
    if (f === 'concluidas' && !t.done) return false;
    if (f === 'atrasadas' && (t.done || !t.dueDate || t.dueDate >= tdy)) return false;
    if (f === 'proximas' && (t.done || !t.dueDate || t.dueDate <= tdy || t.dueDate > nextWeek)) return false;
    if (f === 'caixa' && (t.done || t.dueDate)) return false;
    if (f.startsWith('etq:') && !(t.tags || []).includes(f.slice(4))) return false;
    return !nq || norm(t.title).includes(nq) || (t.tags || []).some((g) => norm(g).includes(nq)) || norm(t.notes || '').includes(nq) || norm(t.groupTitle || '').includes(nq);
  });
  const pr = { high: 0, normal: 1, low: 2 };
  r.sort((a, b) => a.done - b.done || (sort === 'manual' ? orderOf(a) - orderOf(b) : sort === 'prioridade' ? pr[a.priority] - pr[b.priority] : sort === 'recentes' ? (b.createdAt || 0) - (a.createdAt || 0) : (a.dueDate || '9999').localeCompare(b.dueDate || '9999') || (a.time || '99:99').localeCompare(b.time || '99:99')));
  return r;
}
function taskListHtml() {
  const r = filteredTasks(), { f, sort } = ui.filters, tdy = today();
  if (!r.length) {
    const hasTasks = S.tasks.length > 0;
      const hasFilters = f !== 'todas' || ui.filters.q.trim() !== '';
    const actions = hasTasks
      ? hasFilters ? h`<button type="button" class="btn" data-action="task-filters-clear">Limpar filtros</button>` : ''
      : hasFilters
        ? h`<button type="button" class="btn" data-action="task-new">${icon('plus', 16)}Criar tarefa</button><button type="button" class="btn ghost" data-action="task-filters-clear">Limpar filtros</button>`
        : h`<button type="button" class="btn" data-action="task-new">${icon('plus', 16)}Criar tarefa</button>`;
    return empty(
      hasTasks ? 'Nenhuma tarefa nesse filtro' : 'Ainda não há tarefas',
      hasTasks ? 'Troque o filtro ou limpe a busca.' : 'Crie sua primeira tarefa com prazo, horário e prioridade.',
      actions,
      hasTasks ? 'search' : 'calendarCheck',
    );
  }
  if (!(sort === 'prazo' && (f === 'todas' || f === 'pendentes' || f.startsWith('etq:')))) return h`<ul class="list">${r.map(taskRow)}</ul>`;
  const G = [['Atrasadas', 'bad', (t) => !t.done && t.dueDate && t.dueDate < tdy], ['Hoje', '', (t) => !t.done && t.dueDate === tdy], ['Próximas', '', (t) => !t.done && t.dueDate && t.dueDate > tdy], ['Sem data', '', (t) => !t.done && !t.dueDate], ['Concluídas', '', (t) => t.done]];
  return raw('<div class="task-results-groups">' + G.map(([l, c, fn]) => { const it = r.filter(fn); return it.length ? h`<section class="grp"><h3 class="gh ${c}">${l}<span class="n">${it.length}</span></h3><ul class="list">${it.map(taskRow)}</ul></section>`.s : ''; }).join('') + '</div>');
}
function plansHtml() {
  const g = {};
  S.tasks.forEach((t) => { if (t.groupId) (g[t.groupId] ||= { title: t.groupTitle, items: [] }).items.push(t); });
  const plans = Object.entries(g); if (!plans.length) return '';
  return h`<section class="card"><h2>Planos<i>.</i></h2><ul class="list">${plans.map(([id, p]) => { const d = p.items.filter((t) => t.done).length, pc = Math.round(d / p.items.length * 100); return h`<li><div class="grow"><div class="ttl">${p.title}</div><div class="bar plan-progress" role="progressbar" aria-valuenow="${pc}" aria-valuemin="0" aria-valuemax="100" aria-label="Progresso de ${p.title}"><span style="width:${pc}%"></span></div><span class="small muted">${d} de ${p.items.length} concluídas</span></div><button class="ibtn" data-action="del-plan" data-id="${id}" aria-label="Excluir plano ${p.title}">${icon('trash', 18)}</button></li>`; })}</ul></section>`;
}
function taskCalendar() {
  const ym = ui.taskCal, [y, m] = ym.split('-').map(Number), ws = weekStartDay(), first = new Date(y, m - 1, 1), n = new Date(y, m, 0).getDate(), tdy = today();
  const eventsByDay = new Map();
  connectedGoogleCalendarAccounts().forEach((account) => account.events.forEach((event) => {
    const dayEvents = eventsByDay.get(event.day) || [];
    dayEvents.push(event);
    eventsByDay.set(event.day, dayEvents);
  }));
  const wd = Array.from({ length: 7 }, (_, i) => DIAS[(ws + i) % 7]);
  const by = {}; S.tasks.forEach((t) => { if (t.dueDate && t.dueDate.startsWith(ym) && !(t.done && ui.filters.f === 'pendentes')) (by[t.dueDate] = by[t.dueDate] || []).push(t); });
  const cells = []; for (let i = 0; i < (first.getDay() + 7 - ws) % 7; i++) cells.push('<span></span>');
  for (let d = 1; d <= n; d++) {
    const k = `${ym}-${pad(d)}`, ts = by[k] || [], pend = ts.filter((t) => !t.done), dayEvents = eventsByDay.get(k) || [];
    const labels = [
      `${pend.length} ${pend.length === 1 ? 'tarefa pendente' : 'tarefas pendentes'}`,
      ...(dayEvents.length ? [`${dayEvents.length} ${dayEvents.length === 1 ? 'evento' : 'eventos'} das agendas conectadas`] : []),
    ];
    const markers = [
      pend.length ? '<u class="has-tasks"></u>'.repeat(Math.min(pend.length, 3)) : ts.length ? '<u class="dn"></u>' : '',
      dayEvents.length ? '<u class="google-event-dot"></u>' : '',
    ].join('');
    cells.push(`<button type="button" class="tc ${k === tdy ? 't' : ''} ${k === ui.taskDay ? 's' : ''} ${pend.some((t) => k < tdy) ? 'od' : ''}" data-action="tcal-day" data-d="${k}" aria-label="${d} de ${MESES_L[m - 1]}, ${labels.join(', ')}"><b>${d}</b><i>${markers}</i></button>`);
  }
  const day = S.tasks.filter((t) => t.dueDate === ui.taskDay).sort((a, b) => a.done - b.done || (a.time || '99:99').localeCompare(b.time || '99:99'));
  const selectedEvents = eventsByDay.get(ui.taskDay) || [];
  return h`<div class="tcal-wrap"><div class="mnav"><button class="ibtn" data-action="tcal-month" data-n="-1" aria-label="Mês anterior">${icon('chevLeft', 20)}</button><b>${cap(ymLabel(ym))}</b><button class="ibtn" data-action="tcal-month" data-n="1" aria-label="Próximo mês">${icon('chevRight', 20)}</button></div>
    ${googleCalendarPlanPanel()}
    <div class="tcal" role="group" aria-label="Calendário de tarefas e eventos das agendas conectadas">${wd.map((w) => h`<em>${w}</em>`)}${raw(cells.join(''))}</div></div>
    ${connectedGoogleCalendarAccounts().length ? h`<section class="card google-calendar-day" aria-labelledby="google-calendar-day-title">
      <div class="head"><h3 id="google-calendar-day-title">Eventos · ${cap(longDate(ui.taskDay))}</h3><span class="badge">Somente leitura</span></div>
      ${selectedEvents.length
        ? h`<ul class="google-calendar-events">${selectedEvents.map((event) => h`<li><time>${event.time}</time><span class="grow"><b>${event.title}</b><small>${event.calendarName} · ${event.accountLabel}</small></span></li>`)}</ul>`
        : h`<p class="small muted">Nenhum evento das agendas conectadas neste dia.</p>`}
    </section>` : ''}
    <section class="card"><div class="head"><h3>${ui.taskDay === tdy ? 'Hoje' : cap(longDate(ui.taskDay))}</h3><span class="small muted">${day.filter((t) => !t.done).length} pendente(s)</span></div>
      ${day.length ? h`<ul class="list">${day.map(taskRow)}</ul><button type="button" class="btn sm" data-action="task-new" data-due="${ui.taskDay}">${icon('plus', 16)}Adicionar tarefa neste dia</button>` : empty('Dia livre', 'Nada marcado para este dia.', h`<button type="button" class="btn primary" data-action="task-new" data-due="${ui.taskDay}">${icon('plus', 16)}Adicionar tarefa neste dia</button>`, 'calendarCheck')}</section>`;
}
function taskWeek() {
  const days = weekDays(ui.taskWeek, weekStartDay());
  const entries = tasksForWeek(S.tasks, days);
  const first = pk(days[0]), last = pk(days[6]);
  const label = first.getMonth() === last.getMonth()
    ? `${first.getDate()}–${last.getDate()} ${MESES_L[last.getMonth()]} ${last.getFullYear()}`
    : `${shortDate(days[0])}–${shortDate(days[6])}`;
  return h`<div class="week-planner">
    <div class="mnav"><button class="ibtn" data-action="tweek-nav" data-n="-1" aria-label="Semana anterior">${icon('chevLeft', 20)}</button><b>${label}</b><button class="ibtn" data-action="tweek-nav" data-n="1" aria-label="Próxima semana">${icon('chevRight', 20)}</button><button class="btn sm" data-action="tweek-today">Esta semana</button></div>
    <div class="week-days">${entries.map(({ day, tasks }) => h`<section class="week-day${day === today() ? ' is-today' : ''}" aria-labelledby="week-${day}">
      <div class="head"><h3 id="week-${day}">${cap(DIAS[pk(day).getDay()])} <span>${shortDate(day)}</span>${day === today() ? h` <span class="badge">Hoje</span>` : ''}</h3><span class="small muted">${tasks.filter((task) => !task.done).length} pendente(s)</span></div>
      ${tasks.length ? h`<ul class="list">${tasks.map(taskRow)}</ul><button type="button" class="btn ghost sm" data-action="week-add" data-d="${day}">${icon('plus', 15)}Adicionar tarefa</button>` : empty('Dia livre', 'Nada marcado.', h`<button type="button" class="btn primary" data-action="week-add" data-d="${day}">Adicionar tarefa</button>`, 'calendarCheck')}
    </section>`)}</div>
  </div>`;
}
function googleCalendarPlanPanel() {
  const accounts = connectedGoogleCalendarAccounts();
  return h`<section class="card google-calendar-panel" aria-labelledby="google-calendar-title">
    <div class="head"><div><h3 id="google-calendar-title">Agendas conectadas</h3><span class="badge">Somente leitura</span></div><a class="btn sm" href="/config?section=calendars">Gerenciar agendas</a></div>
    <p class="small muted">${accounts.length
      ? `${accounts.length} ${accounts.length === 1 ? 'conta Google conectada' : 'contas Google conectadas'}. Os eventos ficam disponíveis junto às tarefas enquanto esta aba estiver aberta.`
      : 'Conecte uma ou mais contas Google em Ajustes para ver os eventos junto às suas tarefas.'}</p>
  </section>`;
}
function googleCalendarSettingsPanel() {
  const state = ui.googleCalendar;
  const configured = googleCalendar.isConfigured();
  const prepared = googleCalendar.isPrepared();
  const busy = ['loading-sdk', 'authorizing', 'loading-calendars'].includes(state.status);
  const statusText = {
    'loading-sdk': 'Preparando a autorização segura do Google…',
    authorizing: 'Aguardando sua autorização do Google…',
    'loading-calendars': 'Carregando seus calendários…',
  }[state.status];
  return h`<section class="card google-calendar-panel" aria-labelledby="google-calendar-settings-title">
    <div class="head">
      <div><h2 id="google-calendar-settings-title">Google Calendar<i>.</i></h2><span class="badge">Somente leitura</span></div>
    </div>
    <p class="small muted">Conecte várias contas Google e escolha quais calendários aparecem em Planejar. O Aurora não cria nem altera eventos. Autorizações e eventos ficam somente nesta aba e precisam ser conectados novamente depois de recarregar ou fechar a página.</p>
    ${!configured ? h`<p class="small" role="alert">Integração indisponível: configure <code>VITE_GOOGLE_CALENDAR_CLIENT_ID</code> neste ambiente.</p>` : ''}
    ${configured && !prepared && !busy ? h`<button type="button" class="btn" data-action="google-calendar-prepare">${state.status === 'error' ? 'Tentar novamente' : 'Adicionar conta Google'}</button>` : ''}
    ${configured && prepared && !busy ? h`<button type="button" class="btn primary" data-action="google-calendar-authorize">Autorizar acesso do Google Calendar</button>` : ''}
    ${statusText ? h`<p class="small muted" role="status" aria-live="polite">${statusText}</p>` : ''}
    ${state.error ? h`<p class="small google-calendar-error" role="alert">${state.error}</p>` : ''}
    ${state.accounts.length ? h`<div class="google-calendar-accounts" aria-label="Contas Google conectadas">${state.accounts.map((account) => {
      const selected = new Set(account.selectedIds);
      const connected = account.service.isConnected();
      return h`<section class="google-calendar-account" aria-labelledby="google-calendar-account-${account.id}">
        <div class="head"><div><h3 id="google-calendar-account-${account.id}">${account.label}</h3><span class="badge">${connected ? 'Conectada' : 'Acesso expirado · remova e adicione novamente'}</span></div>
          <div class="row"><button type="button" class="btn sm" data-action="google-calendar-refresh" data-account-id="${account.id}" ${!connected || account.status === 'loading-events' ? raw('disabled') : ''}>Atualizar</button><button type="button" class="btn sm ghost" data-action="google-calendar-disconnect" data-account-id="${account.id}">Desconectar</button></div>
        </div>
        ${account.error ? h`<p class="small google-calendar-error" role="alert">${account.error}</p>` : ''}
        ${account.status === 'loading-events' ? h`<p class="small muted" role="status">Buscando eventos deste mês…</p>` : ''}
        ${account.calendars.length ? h`<div class="google-calendar-sources" aria-label="Calendários de ${account.label}">
          <span class="small muted">Calendários exibidos</span>
          ${account.calendars.map((calendar) => h`<button type="button" class="google-calendar-source" data-action="google-calendar-toggle" data-account-id="${account.id}" data-calendar-id="${calendar.id}" aria-pressed="${selected.has(calendar.id)}" ${!connected || busy || account.status === 'loading-events' ? raw('disabled') : ''}>${selected.has(calendar.id) ? icon('check', 15) : icon('plus', 15)}<span>${calendar.name}${calendar.primary ? ' · principal' : ''}</span></button>`)}
        </div>` : ''}
      </section>`;
    })}</div>` : ''}
    <p class="fine">Para remover uma permissão concedida ao Aurora, gerencie o acesso nas <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer">permissões da sua Conta Google</a>.</p>
  </section>`;
}
function googleCalendarRange(month) {
  const [year, monthNumber] = month.split('-').map(Number);
  return {
    start: new Date(year, monthNumber - 1, 1),
    end: new Date(year, monthNumber, 1),
  };
}
function resetGoogleCalendarState() {
  googleCalendar.clear();
  ui.googleCalendar.requestId += 1;
  ui.googleCalendar = { status: 'disconnected', accounts: [], error: '', requestId: ui.googleCalendar.requestId };
}
function connectedGoogleCalendarAccounts() {
  const accounts = [];
  ui.googleCalendar.accounts.forEach((account) => {
    if (account.service.isConnected()) accounts.push(account);
    else if (account.events.length) {
      account.events = [];
      account.loadedMonth = '';
      account.status = 'disconnected';
    }
  });
  return accounts;
}
async function loadGoogleCalendarEvents(accountIds = connectedGoogleCalendarAccounts().map((account) => account.id)) {
  const state = ui.googleCalendar;
  const month = ui.taskCal;
  const requestId = ++state.requestId;
  const accounts = connectedGoogleCalendarAccounts().filter((account) => accountIds.includes(account.id));
  accounts.forEach((account) => {
    account.events = [];
    account.loadedMonth = '';
    account.error = '';
    account.status = 'loading-events';
  });
  render();
  const range = googleCalendarRange(month);
  const results = await Promise.all(accounts.map(async (account) => {
    if (!account.selectedIds.length) return { account, events: [] };
    try {
      const events = await googleCalendar.getEvents(account, account.selectedIds, range);
      return { account, events };
    } catch (error) {
      return {
        account,
        error: error instanceof Error ? error.message : 'Não foi possível carregar os eventos deste calendário.',
      };
    }
  }));
  if (state !== ui.googleCalendar || state.requestId !== requestId || ui.taskCal !== month) return;
  results.forEach(({ account, events, error }) => {
    if (error) {
      account.status = account.service.isConnected() ? 'error' : 'disconnected';
      account.error = error;
      account.events = [];
      return;
    }
    const names = new Map(account.calendars.map((calendar) => [calendar.id, calendar.name]));
    account.events = events.map((event) => ({
      ...event,
      accountLabel: account.label,
      calendarName: names.get(event.calendarId) || 'Google Calendar',
    }));
    account.loadedMonth = month;
    account.status = 'connected';
  });
  render();
}
async function loadGoogleCalendarList() {
  const state = ui.googleCalendar;
  const service = googleCalendarPendingService;
  if (!service) throw new Error('A autorização do Google foi perdida. Inicie a conexão novamente.');
  const requestId = ++state.requestId;
  state.status = 'loading-calendars';
  state.error = '';
  render();
  try {
    const calendars = await service.getCalendars();
    if (ui.googleCalendar !== state || state.requestId !== requestId || googleCalendarPendingService !== service) return;
    if (!calendars.length) throw new Error('Nenhum calendário com permissão de leitura foi encontrado.');
    const primary = calendars.find((calendar) => calendar.primary);
    const accountIdentity = primary?.id || '';
    if (accountIdentity && state.accounts.some((account) => account.identity === accountIdentity)) {
      throw new Error('Esta conta Google já está conectada nesta aba.');
    }
    const primaryIds = calendars.filter((calendar) => calendar.primary).map((calendar) => calendar.id);
    const selectedIds = primaryIds.length
      ? primaryIds
      : calendars.filter((calendar) => calendar.selected).map((calendar) => calendar.id);
    if (!selectedIds.length) selectedIds.push(calendars[0].id);
    const account = {
      id: String(++googleCalendarConnectionSequence),
      identity: accountIdentity,
      label: accountIdentity.includes('@') ? accountIdentity : `Conta Google ${state.accounts.length + 1}`,
      service,
      calendars,
      selectedIds,
      events: [],
      error: '',
      status: 'connected',
      loadedMonth: '',
    };
    state.accounts.push(account);
    googleCalendarPendingService = null;
    state.status = 'connected';
    state.error = '';
    render();
    await loadGoogleCalendarEvents([account.id]);
  } catch (error) {
    if (ui.googleCalendar !== state || state.requestId !== requestId) return;
    state.status = 'error';
    state.error = error instanceof Error ? error.message : 'Não foi possível carregar seus calendários do Google.';
    service.clear();
    if (googleCalendarPendingService === service) googleCalendarPendingService = null;
    render();
  }
}
function prepareGoogleCalendar() {
  if (!googleCalendar.isConfigured()) return toast('A conexão com o Google Calendar ainda não foi configurada neste ambiente.');
  const state = ui.googleCalendar;
  state.status = 'loading-sdk';
  state.error = '';
  render();
  void googleCalendar.prepare().then(() => {
    if (ui.googleCalendar !== state) return;
    state.status = 'ready';
    render();
  }).catch((error) => {
    if (ui.googleCalendar !== state) return;
    state.status = 'error';
    state.error = error instanceof Error ? error.message : 'Não foi possível preparar a conexão com o Google Calendar.';
    render();
  });
}
function authorizeGoogleCalendar() {
  const state = ui.googleCalendar;
  const requestId = ++state.requestId;
  let authorization;
  try {
    authorization = googleCalendar.authorize();
  } catch (error) {
    ui.googleCalendar.status = 'error';
    ui.googleCalendar.error = error instanceof Error ? error.message : 'Não foi possível iniciar a autorização do Google Calendar.';
    render();
    return;
  }
  state.status = 'authorizing';
  state.error = '';
  render();
  void authorization.then(() => {
    if (ui.googleCalendar !== state || state.requestId !== requestId) return;
    return loadGoogleCalendarList();
  }).catch((error) => {
    if (ui.googleCalendar !== state || state.requestId !== requestId) return;
    state.status = googleCalendar.isPrepared() ? 'ready' : 'error';
    state.error = error instanceof Error ? error.message : 'Não foi possível autorizar a leitura do Google Calendar.';
    render();
  });
}
function toggleGoogleCalendar(accountId, calendarId) {
  const account = ui.googleCalendar.accounts.find((item) => item.id === accountId);
  if (!account?.service.isConnected() || !account.calendars.some((calendar) => calendar.id === calendarId)) return;
  account.selectedIds = account.selectedIds.includes(calendarId)
    ? account.selectedIds.filter((id) => id !== calendarId)
    : [...account.selectedIds, calendarId];
  void loadGoogleCalendarEvents([account.id]);
}
function disconnectGoogleCalendar(accountId) {
  const index = ui.googleCalendar.accounts.findIndex((account) => account.id === accountId);
  if (index < 0) return;
  const [account] = ui.googleCalendar.accounts.splice(index, 1);
  account.service.clear();
  ui.googleCalendar.requestId += 1;
  render();
  void loadGoogleCalendarEvents();
  toast('A conta foi desconectada desta aba.');
}
function viewPlanejar() {
  const f = ui.filters;
  const todayKey = today();
  const nextWeek = addDays(todayKey, 7);
  const pendingTasks = S.tasks.filter((task) => !task.done);
  const todayPending = pendingTasks.filter((task) => task.dueDate === todayKey).length;
  const overdueCount = pendingTasks.filter((task) => task.dueDate && task.dueDate < todayKey).length;
  const upcomingCount = pendingTasks.filter((task) => task.dueDate > todayKey && task.dueDate <= nextWeek).length;
  const inboxCount = pendingTasks.filter((task) => !task.dueDate).length;
  const todaySummary = todayPending
    ? `${todayPending} ${plural(todayPending, 'tarefa marcada', 'tarefas marcadas')} para hoje`
    : 'Nenhuma tarefa com prazo para hoje';
  const overdueSummary = overdueCount
    ? `${overdueCount} ${plural(overdueCount, 'tarefa atrasada', 'tarefas atrasadas')}`
    : 'Nenhuma tarefa atrasada';
  const planningSummary = overdueCount
    ? `${overdueSummary}. Comece pelo que já passou do prazo.`
    : todayPending
      ? `${todaySummary}. Veja o que vem depois e ajuste sua semana.`
      : upcomingCount
        ? `${upcomingCount} ${plural(upcomingCount, 'tarefa nos próximos dias', 'tarefas nos próximos dias')}. Seu dia está livre para organizar.`
        : 'Seu plano está em dia. Adicione uma tarefa ou organize os próximos dias.';
  return h`${areaPageTitle('planejar', 'Planejar')}
    <section class="card qa-card planning-overview" aria-labelledby="planning-overview-title">
      <div class="planning-overview-copy">
        <span class="section-kicker">Seu próximo passo</span>
        <h2 id="planning-overview-title">${overdueCount ? 'Vamos reorganizar o que passou.' : 'Seu plano, com clareza.'}<i>.</i></h2>
        <p>${planningSummary}</p>
        <div class="planning-overview-actions"><button type="button" class="btn primary" data-action="task-new">${icon('plus', 16)}Nova tarefa</button></div>
      </div>
      <div class="planning-overview-stats" role="group" aria-label="Filtrar tarefas por prazo">
        <button type="button" class="planning-overview-stat" data-action="planning-filter" data-f="pendentes" aria-pressed="${ui.planView === 'lista' && f.f === 'pendentes' && !f.q}"><span>Pendentes</span><b>${pendingTasks.length}</b></button>
        <button type="button" class="planning-overview-stat" data-action="planning-filter" data-f="atrasadas" aria-pressed="${ui.planView === 'lista' && f.f === 'atrasadas' && !f.q}"><span>Atrasadas</span><b>${overdueCount}</b></button>
        <button type="button" class="planning-overview-stat" data-action="planning-filter" data-f="proximas" aria-pressed="${ui.planView === 'lista' && f.f === 'proximas' && !f.q}"><span>Próximos 7 dias</span><b>${upcomingCount}</b></button>
        <button type="button" class="planning-overview-stat" data-action="planning-filter" data-f="caixa" aria-pressed="${ui.planView === 'lista' && f.f === 'caixa' && !f.q}"><span>Sem data</span><b>${inboxCount}</b></button>
      </div>
    </section>
    <section class="planning-shortcuts" aria-label="Atalhos de planejamento"><span>Atenção ao seu plano</span><button type="button" data-action="plan-view" data-v="semana">${icon('calendarCheck', 16)}Organizar a semana</button><button type="button" data-action="plan-view" data-v="revisao">${icon('chart', 16)}Fazer revisão semanal</button></section>
    <section class="card plain" aria-labelledby="mt"><h2 id="mt" class="sr">Minhas tarefas</h2>
      <label class="plan-view-select"><span>Ver como</span><select data-change="plan-view" aria-label="Modo de visualização">${[['lista', 'Lista'], ['calendario', 'Calendário'], ['semana', 'Semana'], ['revisao', 'Revisão']].map(([value, label]) => h`<option value="${value}" ${ui.planView === value ? raw('selected') : ''}>${label}</option>`)}</select></label>
      ${ui.planView === 'calendario' ? taskCalendar() : ui.planView === 'semana' ? taskWeek() : ui.planView === 'revisao' ? weeklyReviewView() : h`<div class="scroll-x" role="group" aria-label="Filtrar tarefas">${FILTERS.map(([k, l]) => h`<button class="chip" aria-pressed="${f.f === k}" data-action="set-filter" data-f="${k}">${l}</button>`)}${allTags().map((g) => h`<button class="chip" aria-pressed="${f.f === 'etq:' + g}" data-action="set-filter" data-f="${'etq:' + g}">#${g}</button>`)}</div>
      <div class="row"><label class="search"><span class="sr">Buscar tarefas</span>${icon('search', 18)}<input type="search" id="q" data-keep value="${f.q}" placeholder="Buscar tarefas" data-input="search"></label>
        <label class="task-sort-field"><span class="sr">Ordenar</span><select id="sortsel" data-change="sort">${[['prazo', 'Por prazo'], ['prioridade', 'Prioridade'], ['recentes', 'Recentes'], ['manual', 'Manual']].map(([k, l]) => h`<option value="${k}" ${f.sort === k ? raw('selected') : ''}>${l}</option>`)}</select></label></div>
      <div id="task-results" aria-live="polite">${taskListHtml()}</div>`}</section>
    ${plansHtml()}`;
}

function habitDaysLabel(habit) {
  const target = habitWeeklyTarget(habit);
  const base = habit.days.length === 7 ? 'Todos os dias' : [...habit.days].sort((a, b) => a - b).map((day) => DIAS[day]).join(', ');
  return target ? `${base} · meta de ${target}x por semana` : base;
}
function habitMonthlyHistory(habit) {
  const days = habitMonthDays(ui.habitMonth, weekStartDay());
  const stats = habitMonthStats(habit, ui.habitMonth, today(), (day) => habitCompletedFor(habit, day));
  return h`<details class="habit-month">
    <summary>Histórico mensal · ${cap(ymLabel(ui.habitMonth))}${icon('chevDown', 16, 'habit-disclosure-indicator')}</summary>
    <div class="mnav"><button class="ibtn" type="button" data-action="habit-month" data-n="-1" aria-label="Mês anterior">${icon('chevLeft', 18)}</button><b>${cap(ymLabel(ui.habitMonth))}</b><button class="ibtn" type="button" data-action="habit-month" data-n="1" aria-label="Próximo mês" ${ui.habitMonth >= today().slice(0, 7) ? raw('disabled') : ''}>${icon('chevRight', 18)}</button></div>
    <p class="small muted">${stats.completed} de ${stats.scheduled} dias programados concluídos até hoje neste mês.</p>
    <div class="habit-month-grid" role="group" aria-label="Calendário de ${habit.name} em ${ymLabel(ui.habitMonth)}">
      ${Array.from({ length: 7 }, (_, index) => DIAS[(weekStartDay() + index) % 7]).map((day) => h`<span class="habit-month-weekday">${day}</span>`)}
      ${days.map((day) => {
        if (!day) return h`<span class="habit-month-empty" aria-hidden="true"></span>`;
        const scheduled = habit.days.includes(pk(day).getDay());
        const completed = habitCompletedFor(habit, day);
        const skipped = habitIsSkipped(habit, day, today());
        const future = day > today();
        const label = `${longDate(day)}: ${skipped ? 'dia pulado' : completed ? 'concluído' : scheduled ? future ? 'programado' : 'não concluído' : 'não programado'}`;
        const cls = `habit-month-day${completed ? ' is-done' : ''}${skipped ? ' is-skipped' : ''}${!scheduled ? ' is-off' : ''}${future ? ' is-future' : ''}`;
        const editable = S.habits.includes(habit) && habit.status === 'active' && scheduled && !future;
        return editable
          ? h`<button type="button" class="${cls}" data-action="habit-day" data-id="${habit.id}" data-d="${day}" aria-pressed="${completed}" aria-label="${label}"><b>${pk(day).getDate()}</b>${completed ? icon('check', 12) : ''}</button>`
          : h`<span class="${cls}" aria-label="${label}"><b>${pk(day).getDate()}</b>${completed ? icon('check', 12) : ''}</span>`;
      })}
    </div>
  </details>`;
}
function habitYearHeat(habit) {
  const start = weekStartDay();
  const end = today();
  const firstWeek = weekDays(addDays(end, -52 * 7), start)[0];
  const days = [];
  for (let day = firstWeek; day <= end; day = addDays(day, 1)) days.push(day);
  let done = 0, planned = 0;
  const cells = days.map((day) => {
    const scheduled = habit.days.includes(pk(day).getDay());
    const completed = habitCompletedFor(habit, day);
    const skipped = habitIsSkipped(habit, day, end);
    if (scheduled && !skipped) planned += 1;
    if (completed) done += 1;
    return { day, scheduled, completed, skipped };
  });
  return h`<details class="habit-year" id="d-year-${habit.id}" ${ui.openDetails[`year-${habit.id}`] ? raw('open') : ''}>
    <summary>Ano em calendário${icon('chevDown', 16, 'habit-disclosure-indicator')}</summary>
    <p class="small muted">${done} de ${planned} ${plural(planned, 'dia programado concluído', 'dias programados concluídos')} nos últimos 12 meses.</p>
    <div class="habit-year-grid" role="img" aria-label="Calendário de 12 meses de ${habit.name}: ${done} de ${planned} dias programados concluídos">${cells.map((cell) => h`<span class="habit-year-cell${cell.completed ? ' is-done' : cell.skipped ? ' is-skipped' : cell.scheduled ? ' is-missed' : ''}" title="${longDate(cell.day)}${cell.skipped ? ' · pulado' : ''}"></span>`)}</div>
    <p class="habit-year-legend small muted"><span class="habit-year-cell"></span>não programado <span class="habit-year-cell is-missed"></span>não feito <span class="habit-year-cell is-skipped"></span>pulado <span class="habit-year-cell is-done"></span>feito</p>
  </details>`;
}
function updateHabitIdeaFilters() {
  const remaining = remainingHabitSuggestions(S.habits);
  const suggestions = filterSuggestedHabits(
    remaining,
    ui.habitIdeaCategory,
    ui.habitIdeaTag,
    ui.habitIdeaQuery,
  );
  const visibleIds = new Set(suggestions.map((suggestion) => suggestion.id));
  const defaultView = ui.habitIdeaCategory === 'all'
    && ui.habitIdeaTag === 'all'
    && !String(ui.habitIdeaQuery || '').trim();
  const previewOnly = defaultView && !ui.habitIdeasExpanded;
  const firstUsePreview = S.habits.length === 0 && previewOnly;
  document.querySelectorAll('[data-habit-idea]').forEach((button) => {
    button.hidden = !visibleIds.has(button.dataset.id) || (previewOnly && button.dataset.preview === 'true');
  });
  const ideaTools = document.querySelector('.habit-idea-tools');
  if (ideaTools) ideaTools.hidden = firstUsePreview;
  const ideaCategories = document.querySelector('.habit-idea-categories');
  if (ideaCategories) ideaCategories.classList.toggle('is-preview', firstUsePreview);
  document.querySelectorAll('.habit-idea-section').forEach((section) => {
    section.hidden = !section.querySelector('[data-habit-idea]:not([hidden])');
  });
  const count = document.querySelector('[data-habit-idea-count]');
  if (count) count.textContent = `${suggestions.length} ${plural(suggestions.length, 'ideia encontrada', 'ideias encontradas')}`;
  const emptyState = document.querySelector('[data-habit-idea-empty]');
  if (emptyState) emptyState.hidden = suggestions.length > 0;
  const clearButton = document.querySelector('[data-action="habit-ideas-clear"]');
  if (clearButton) clearButton.hidden = defaultView;
  const expandButton = document.querySelector('[data-action="habit-ideas-expand"]');
  if (expandButton) {
    expandButton.hidden = !defaultView || suggestions.length <= 4;
    expandButton.setAttribute('aria-expanded', String(ui.habitIdeasExpanded));
    expandButton.textContent = ui.habitIdeasExpanded ? 'Mostrar menos ideias' : `Ver todas as ${suggestions.length} ideias`;
  }
}
const HABIT_COLOR_NAMES = ['Rosa', 'Coral', 'Âmbar', 'Verde-claro', 'Verde', 'Azul-claro', 'Azul', 'Lilás', 'Roxo', 'Vermelho', 'Cinza', 'Marrom'];
function habitWaterTracker(habit) {
  if (!isWaterHabit(habit)) return '';
  const total = waterMlForDay(S.water, today());
  const target = waterGoalForHabit(habit, S.settings.prefs.waterGoalMl);
  const remaining = Math.max(0, target - total);
  return h`<section class="water-tracker" aria-label="Acompanhamento de água">
    <div class="water-tracker-summary"><b>${total.toLocaleString('pt-BR')} mL</b><span>de ${target.toLocaleString('pt-BR')} mL hoje</span></div>
    <progress value="${Math.min(total, target)}" max="${target}" aria-label="Progresso da meta diária de água"></progress>
    ${habit.status === 'active' ? h`<form class="water-add-form" data-form="water-add" data-id="${habit.id}">
      <label for="water-amount-${habit.id}">Quantidade consumida (mL)</label>
      <div class="water-add-controls"><input id="water-amount-${habit.id}" name="amount" type="number" min="1" max="10000" step="1" inputmode="numeric" placeholder="Ex.: 250" required><button type="submit" class="btn sm">Adicionar</button></div>
    </form>` : ''}
    <p class="small muted" aria-live="polite">${remaining ? `Faltam ${remaining.toLocaleString('pt-BR')} mL para a meta.` : 'Meta diária atingida. Você pode continuar registrando.'}</p>
  </section>`;
}
function habitRow(habit) {
  const status = habit.status || 'active';
  const saved = S.habits.includes(habit);
  const dayOn = habit.days.includes(pk(today()).getDay());
  const skipped = habitIsSkipped(habit, today(), today());
  const canCheck = status === 'active' && dayOn && !skipped;
  const done = habitCompletedFor(habit, today());
  const pending = canCheck && !done;
  const stats = habitStats(habit, today(), weekStartDay(), (day) => habitCompletedFor(habit, day));
  const color = habitColor(habit);
  const open = ui.openDetails[`hab-${habit.id}`] ? raw('open') : '';
  const target = stats.weeklyTarget ?? stats.scheduledThisWeek;
  const waterTotal = isWaterHabit(habit) ? waterMlForDay(S.water, today()) : 0;
  const waterTarget = isWaterHabit(habit) ? waterGoalForHabit(habit, S.settings.prefs.waterGoalMl) : 0;
  const sub = status === 'paused' ? 'Pausado' : skipped ? 'Dia pulado' : isWaterHabit(habit)
    ? `${waterTotal.toLocaleString('pt-BR')} de ${waterTarget.toLocaleString('pt-BR')} mL hoje`
    : habitDaysLabel(habit);
  const orderList = S.habits.filter((item) => item.status !== 'archived');
  const orderIndex = orderList.indexOf(habit);
  const circleLabel = `${skipped ? 'Dia pulado' : done ? 'Desmarcar' : 'Marcar como feito'}: ${habit.name}`;
  return h`<li class="habit-row${done ? ' is-done' : ''}${pending ? ' is-pending' : ''}${canCheck ? '' : ' is-off'}" data-habit-id="${habit.id}" style="--hc:${color}">
    <button type="button" class="habit-circle" data-action="habit-check" data-id="${habit.id}" aria-pressed="${String(done)}" aria-label="${circleLabel}" ${canCheck ? '' : raw('disabled')}>
      <span class="habit-circle-icon">${icon(habitIconKey(habit), 22)}</span><span class="habit-circle-check">${icon('check', 22)}</span>
    </button>
    <details class="habit-more" id="d-hab-${habit.id}" ${open}>
      <summary><span class="habit-main"><span class="habit-title">${habit.name}${status === 'paused' ? h` <span class="badge">Pausado</span>` : ''}</span><span class="habit-sub">${canCheck && stats.goalMet ? h`${icon('sparkles', 13)}Meta da semana cumprida · ` : ''}${sub}</span></span>${icon('chevDown', 18, 'chev')}</summary>
      <div class="habit-more-body">
        ${habitWaterTracker(habit)}
        <p class="small muted">${habitDaysLabel(habit)}${habit.remind ? ` · lembrete ${habit.remind}` : ''}<br>${stats.completedThisWeek} de ${target} nesta semana</p>
        ${habitMonthlyHistory(habit)}${saved ? habitYearHeat(habit) : ''}
        ${saved ? h`<details class="habit-management"><summary>Gerenciar hábito${icon('chevDown', 16, 'habit-management-indicator')}</summary><div class="row habit-actions">${status !== 'archived' ? h`<button type="button" class="ibtn" data-action="habit-move" data-dir="-1" data-id="${habit.id}" aria-label="Mover ${habit.name} para cima" ${orderIndex <= 0 ? raw('disabled') : ''}>${icon('arrowUp', 18)}</button><button type="button" class="ibtn" data-action="habit-move" data-dir="1" data-id="${habit.id}" aria-label="Mover ${habit.name} para baixo" ${orderIndex < 0 || orderIndex >= orderList.length - 1 ? raw('disabled') : ''}>${icon('arrowDown', 18)}</button>` : ''}${status === 'active' && dayOn && !done ? h`<button type="button" class="btn sm ghost" data-action="habit-skip" data-id="${habit.id}" aria-pressed="${skipped}">${skipped ? 'Desfazer pulo' : 'Pular hoje'}</button>` : ''}<button type="button" class="btn sm" data-action="habit-edit-open" data-id="${habit.id}">${icon('pencil', 15)}Editar</button><button type="button" class="btn sm" data-action="habit-toggle-pause" data-id="${habit.id}">${icon(status === 'active' ? 'pause' : 'play', 15)}${status === 'active' ? 'Pausar' : 'Retomar'}</button><button type="button" class="btn sm ghost" data-action="habit-archive" data-id="${habit.id}">${icon('archive', 15)}Arquivar</button><button type="button" class="btn sm danger" data-action="habit-delete" data-id="${habit.id}">${icon('trash', 15)}Excluir</button></div></details>` : ''}
      </div>
    </details>
    <div class="habit-week" role="group" aria-label="Esta semana: ${stats.completedThisWeek} de ${target} dias. Toque num dia que passou para marcar ou desmarcar.">${stats.week.map((w) => {
      const stateLabel = `${longDate(w.day)}: ${w.skipped ? 'dia pulado' : w.completed ? 'concluído' : w.scheduled ? (w.day > today() ? 'programado' : 'não concluído') : 'não programado'}`;
      const editable = saved && status === 'active' && w.scheduled && w.day <= today();
      return h`<button type="button" class="habit-dot${w.completed ? ' is-done' : ''}${w.skipped ? ' is-skipped' : ''}${!w.scheduled ? ' is-off' : ''}${w.day === today() ? ' is-today' : ''}" data-action="habit-day" data-id="${habit.id}" data-d="${w.day}" aria-pressed="${w.completed}" aria-label="${stateLabel}" ${editable ? '' : raw('disabled')}><i aria-hidden="true">${DIAS[pk(w.day).getDay()].slice(0, 1)}</i></button>`;
    })}</div>
  </li>`;
}
function viewHabits() {
  return renderHabitsView({
    S, ui, areaOn, areaPageTitle, gate, habitsTemplate,
    habitsTemplatePromise, habitsTemplateError, requestHabitsTemplate,
    weekStartDay, habitCompletedFor, getPushNotificationStatus, plural, habitRow,
    preserveCopyTerms, habitColor, habitIconKey, habitDaysLabel, renderHabitsTemplate, empty,
  });
}

function requestHabitsTemplate() {
  if (habitsTemplate || habitsTemplatePromise) return;
  habitsTemplateError = false;
  habitsTemplatePromise = loadHabitsTemplate().then(
    (template) => {
      habitsTemplate = template;
      habitsTemplatePromise = null;
      if (ui.route === 'habitos') render();
    },
    (error) => {
      habitsTemplatePromise = null;
      habitsTemplateError = true;
      console.error('Aurora: não foi possível carregar o template da área de Hábitos.', error);
      if (ui.route === 'habitos') render();
    },
  );
}
function areaTiles() {
  const defs = [['finances', 'wallet'], ['cycle', 'heart']]
    .filter(([a]) => !areaOn(a));
  if (!defs.length) return '';
  return h`<div class="head"><h2 id="ar">Áreas opcionais<i>.</i></h2><a class="btn ghost sm" href="/config">Gerenciar</a></div><div class="tiles">${defs.map(([a, ic]) => h`<button class="tile off" data-action="enable-area" data-area="${a}"><span class="mk" data-area="${a}">${icon(ic, 22)}</span><h3>${AREAS[a][0]}</h3><span class="v">Ativar</span><span class="s">${AREAS[a][1]}</span></button>`)}</div>`;
}

/* ---------- Ciclo ---------- */
const CYC = [
  { id: 'flow', title: 'Fluxo', single: true, opts: [['spot', 'Escape'], ['light', 'Leve'], ['medium', 'Médio'], ['heavy', 'Intenso']] },
  { id: 'pain', title: 'Dor', opts: [['cramp', 'Cólica'], ['head', 'Dor de cabeça'], ['back', 'Dor nas costas'], ['breast', 'Seios sensíveis'], ['joint', 'Dor nas articulações'], ['ovary', 'Dor no ovário']] },
  { id: 'mood', title: 'Humor', opts: [['happy', 'Feliz'], ['calm', 'Em paz'], ['energized', 'Com energia'], ['sensitive', 'Sensível'], ['irritated', 'Irritação'], ['anxious', 'Ansiedade'], ['sad', 'Triste'], ['stressed', 'Estresse']] },
  { id: 'energy', title: 'Energia', single: true, opts: [['exhausted', 'Exausta'], ['low', 'Baixa'], ['normal', 'Normal'], ['high', 'Alta']] },
  { id: 'digestion', title: 'Digestão e apetite', opts: [['bloat', 'Inchaço'], ['nausea', 'Enjoo'], ['constip', 'Prisão de ventre'], ['diarrhea', 'Diarreia'], ['sweet', 'Vontade de doce'], ['salt', 'Vontade de salgado'], ['hungry', 'Muito apetite']] },
  { id: 'sleep', title: 'Sono', single: true, opts: [['great', 'Dormiu bem'], ['restless', 'Sono agitado'], ['insomnia', 'Insônia'], ['sleepy', 'Muito sono']] },
  { id: 'skin', title: 'Pele e cabelo', opts: [['acne', 'Acne'], ['oilyskin', 'Pele oleosa'], ['dryskin', 'Pele seca'], ['oilyhair', 'Cabelo oleoso']] },
  { id: 'discharge', title: 'Corrimento', single: true, opts: [['none', 'Nenhum'], ['sticky', 'Pegajoso'], ['creamy', 'Cremoso'], ['watery', 'Aquoso'], ['eggwhite', 'Clara de ovo']] },
];
const CYC_ICON = { flow: 'droplet', pain: 'alert', mood: 'heart', energy: 'sparkles', digestion: 'stomach', sleep: 'moon', skin: 'user', discharge: 'flower' };
const CYC_OPTION_ICON = {
  flow: { spot: 'spot', light: 'droplet', medium: 'water', heavy: 'blood' },
  pain: { cramp: 'activity', head: 'sun', back: 'spine', breast: 'heart', joint: 'bone', ovary: 'ovaries' },
  mood: { happy: 'smile', calm: 'meditate', energized: 'sparkles', sensitive: 'heart', irritated: 'alert', anxious: 'activity', sad: 'moon', stressed: 'target' },
  energy: { exhausted: 'moon', low: 'coffee', normal: 'activity', high: 'arrowUp' },
  digestion: { bloat: 'wind', nausea: 'activity', constip: 'inbox', diarrhea: 'droplet', sweet: 'candy', salt: 'utensils', hungry: 'apple' },
  sleep: { great: 'bed', restless: 'activity', insomnia: 'clock', sleepy: 'coffee' },
  skin: { acne: 'acne', oilyskin: 'sun', dryskin: 'leaf', oilyhair: 'hair' },
  discharge: { none: 'close', sticky: 'droplet', creamy: 'cloud', watery: 'water', eggwhite: 'egg' },
};
const CYC_SHORT_LABEL = {
  pain: { head: 'Cabeça', back: 'Costas', breast: 'Seios', joint: 'Juntas', ovary: 'Ovário' },
  digestion: { constip: 'Intestino', sweet: 'Doce', salt: 'Salgado', hungry: 'Apetite' },
  sleep: { great: 'Bem', restless: 'Agitado', sleepy: 'Sonolência' },
  skin: { oilyskin: 'Oleosa', dryskin: 'Ressecada', oilyhair: 'Cabelo oleoso' },
};
const cycLabel = (cat, v) => (CYC.find((c) => c.id === cat)?.opts.find((o) => o[0] === v) || [, v])[1];
const dayLog = (k) => S.cycleLog[k] || {};
const isBleeding = (l) => ['light', 'medium', 'heavy'].includes(l.flow);
const hasAnyLog = (l) => !!l && (l.flow || l.energy || l.sleep || l.discharge || l.note || l.sexualActivity || l.masturbationActivity || Number.isInteger(l.orgasmCount) || ['pain', 'mood', 'digestion', 'skin'].some((c) => (l[c] || []).length));
function cycleLogDraft(log = {}) {
  return Object.fromEntries(Object.entries(log).map(([key, value]) => [key, Array.isArray(value) ? [...value] : value]));
}
function cycleLogSummary(log) {
  if (!hasAnyLog(log)) return 'Nenhum registro para este dia.';
  const symptomCount = CYC.filter(({ id }) => id !== 'flow').reduce((count, { id, single }) => {
    const value = log[id];
    return count + (single ? Number(Boolean(value)) : Array.isArray(value) ? value.length : 0);
  }, 0);
  return [
    log.flow ? `Fluxo: ${cycLabel('flow', log.flow)}` : '',
    log.sexualActivity ? 'Relação sexual registrada' : '',
    log.masturbationActivity ? 'Masturbação registrada' : '',
    log.contraceptionMethods?.length ? 'método contraceptivo registrado' : '',
    Number.isInteger(log.orgasmCount) ? `${log.orgasmCount} ${plural(log.orgasmCount, 'orgasmo', 'orgasmos')}` : '',
    symptomCount ? `${symptomCount} ${plural(symptomCount, 'sintoma', 'sintomas')}` : '',
    log.note ? 'com anotação' : '',
  ].filter(Boolean).join(' · ');
}
const cyclePeriodKey = (period) => `${period.start}|${period.end || ''}`;
const cyclePeriodEnd = (period) => period.end || period.start;
function periodDaySet() {
  const set = new Set();
  Object.entries(S.cycleLog).forEach(([k, l]) => { if (isBleeding(l)) set.add(k); });
  S.cycle.forEach((period) => {
    cyclePeriodDays(period.start, period.end, today()).forEach((day) => set.add(day));
  });
  return set;
}
function cycleStats() {
  const set = periodDaySet(), days = [...set].sort(), starts = [];
  days.forEach((k) => { if (!set.has(addDays(k, -1))) starts.push(k); });
  const lens = [];
  for (let i = 1; i < starts.length; i++) { const d = dayDiff(starts[i], starts[i - 1]); if (d >= 15 && d <= 60) lens.push(d); }
  const avg = lens.length ? Math.round(lens.reduce((a, b) => a + b, 0) / lens.length) : null;
  return { set, starts, avg, observedIntervals: lens.length, next: avg && starts.length ? addDays(starts[starts.length - 1], avg) : null };
}
function cycleDayNumber(k, st) { const prev = [...st.starts].filter((s) => s <= k).pop(); return prev ? dayDiff(k, prev) + 1 : null; }
function cycleCalendarPhase(day, stats) {
  return estimatedCyclePhase(day, stats.starts, stats.avg, stats.set);
}
function topSymptoms() {
  const from = addDays(today(), -90), cnt = {};
  Object.entries(S.cycleLog).forEach(([k, l]) => { if (k < from) return; ['pain', 'mood', 'digestion', 'skin'].forEach((c) => (l[c] || []).forEach((v) => { const key = c + ':' + v; cnt[key] = (cnt[key] || 0) + 1; })); ['energy', 'sleep'].forEach((c) => { if (l[c]) { const key = c + ':' + l[c]; cnt[key] = (cnt[key] || 0) + 1; } }); });
  return Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([key, count]) => {
    const [category, value] = key.split(':');
    return { category, value, label: cycLabel(category, value), count };
  });
}
function viewCiclo() {
  const g = gate('cycle', 'Ciclo');   if (g) return h`${areaNav('ciclo')}${areaPageTitle('ciclo', 'Ciclo')}${g}`;
  const st = cycleStats(), tdy = today(), sel = ui.cycDay && ui.cycDay <= tdy ? ui.cycDay : tdy, log = dayLog(sel);
  const ym = ui.calMonth, [y, m] = ym.split('-').map(Number), first = new Date(y, m - 1, 1), nDays = new Date(y, m, 0).getDate();
  const strip = Array.from({ length: 14 }, (_, i) => addDays(tdy, i - 13));
  const dn = cycleDayNumber(sel, st);
  const hasCycleHistory = st.starts.length > 0;
  const hasCycleRecords = Object.values(S.cycleLog).some(hasAnyLog);
  const selectedPeriodIndex = S.cycle.findIndex((period) => period.start <= sel && cyclePeriodEnd(period) >= sel);
  const selectedPeriod = selectedPeriodIndex >= 0 ? S.cycle[selectedPeriodIndex] : null;
  const cycleMoment = st.set.has(sel)
    ? ['Período registrado', 'Este dia faz parte de um período que você registrou.']
    : st.next === sel
      ? ['Início estimado', 'Esta é uma estimativa baseada nos seus registros anteriores.']
      : dn
        ? [`Dia ${dn} do ciclo`, sel === tdy ? 'Acompanhe como você se sente hoje.' : `Registro de ${shortDate(sel)}.`]
        : hasCycleHistory
          ? ['Sem ciclo iniciado nesta data', 'Selecione uma data a partir do início registrado para ver o dia do ciclo.']
          : ['Comece pelo primeiro registro', 'Marque o primeiro dia do fluxo menstrual. Com dois inícios registrados, você poderá ver médias e estimativas.'];
  const cells = []; for (let i = 0; i < (first.getDay() + 7 - weekStartDay()) % 7; i++) cells.push('<span></span>');
  for (let d = 1; d <= nDays; d++) {
    const k = `${ym}-${pad(d)}`, fut = k > tdy, phase = cycleCalendarPhase(k, st);
    const phaseLabel = phase === 'menstruation' ? 'menstruação registrada'
      : phase === 'fertile' ? 'janela fértil estimada'
        : phase === 'ovulation' ? 'ovulação estimada' : '';
    const phaseClass = phase ? `phase-${phase}` : '';
    cells.push(`<button type="button" class="${phaseClass} ${st.set.has(k) ? 'm' : st.next === k ? 'p' : ''} ${k === tdy ? 't' : ''} ${k === sel ? 's' : ''} ${hasAnyLog(S.cycleLog[k]) ? 'l' : ''}" ${fut ? 'disabled' : ''} data-action="cyc-day" data-d="${k}" aria-label="${d} de ${MESES_L[m - 1]}${phaseLabel ? ', ' + phaseLabel : st.next === k ? ', próximo início estimado' : ''}${hasAnyLog(S.cycleLog[k]) ? ', com registro' : ''}">${d}</button>`);
  }
  const top = topSymptoms();
  const cycleProgress = st.avg && dn ? clamp(Math.round(dn / st.avg * 100), 0, 100) : 0;
  return h`${areaNav('ciclo')}${areaPageTitle('ciclo', 'Ciclo')}
    <div class="notice cycle-consent-management" role="note"><span>Você pode retirar o consentimento quando quiser. Ciclo será bloqueado, mas os registros existentes continuarão na conta até serem apagados.</span><button type="button" class="btn back sm" data-action="cycle-consent-revoke" ${ui.cycleConsentBusy ? raw('disabled aria-busy="true"') : ''}>Retirar consentimento</button></div>
    ${!hasCycleHistory && !hasCycleRecords
      ? h`<section class="card cycle-start-empty">${empty('Comece pelo primeiro registro', 'Registre o início de um período ou anote como você está para começar a acompanhar seu ciclo.', h`<button type="button" class="btn primary" data-action="cyc-period-open">${icon('calendar', 16)}Registrar primeiro período</button>`, 'calendar')}<div class="cycle-empty-actions"><button type="button" class="btn" data-action="cyc-start-today">${icon('plus', 16)}Começou hoje</button><button type="button" class="btn ghost" data-action="cyc-period-past">Período anterior</button></div></section>`
      : h`<section class="cycle-overview" aria-labelledby="cycle-overview-title"><header class="cycle-overview-head"><div><span>${hasCycleHistory ? 'Seu ciclo' : 'Primeiros passos'}</span><h2 id="cycle-overview-title">${cycleMoment[0]}<i>.</i></h2><p>${cycleMoment[1]}</p></div><div class="cycle-overview-actions"><button type="button" class="btn primary" data-action="cyc-start-today">${icon('plus', 16)}Começou hoje</button><button type="button" class="btn" data-action="cyc-period-open">${icon('calendar', 16)}Registrar período</button><button type="button" class="btn" data-action="cyc-period-past">Período anterior</button></div></header>${hasCycleHistory ? h`<div class="stats cycle-overview-stats">${dn ? h`<div class="cycle-day-ring ${st.avg ? '' : 'is-unestimated'}" ${st.avg ? `style="--cycle-progress:${cycleProgress}%"` : ''}><span><b>${dn}</b><small>Dia do ciclo</small></span></div>` : ''}${st.avg ? h`<div class="stat"><b>${st.avg} dias</b><span>Duração média · ${st.observedIntervals} ${plural(st.observedIntervals, 'intervalo observado', 'intervalos observados')}</span></div><div class="stat"><b>${shortDate(st.next)}</b><span>Próximo início estimado</span></div>` : h`<p class="cycle-next-step">Registre o próximo início da menstruação para calcular a duração média e mostrar estimativas.</p>`}</div>` : ''}</section>`}
    <section class="card cycle-day-entry" aria-labelledby="cd"><div class="head"><div><h2 id="cd">${sel === tdy ? 'Hoje' : cap(longDate(sel))}<i>.</i></h2><p class="cycle-day-summary">${hasAnyLog(log) ? cycleLogSummary(log) : st.set.has(sel) ? 'Este dia faz parte de um período registrado. Se quiser, anote sintomas ou fluxo.' : hasCycleHistory ? 'Sem registro neste dia. Se quiser, anote sintomas ou fluxo.' : 'Ainda não há registro neste dia. Escolha uma data e registre o fluxo para começar.'}</p></div>${hasAnyLog(log) ? h`<button type="button" class="btn ghost sm" data-action="cyc-clear">Limpar o dia</button>` : ''}</div>
      ${selectedPeriod ? h`<div class="cycle-period-tools" aria-label="Período menstrual selecionado"><p><b>Período registrado:</b> ${longDate(selectedPeriod.start)}${cyclePeriodEnd(selectedPeriod) === selectedPeriod.start ? '' : ` a ${longDate(cyclePeriodEnd(selectedPeriod))}`}</p><div><button type="button" class="btn sm" data-action="cyc-period-edit" data-index="${selectedPeriodIndex}">Editar período</button><button type="button" class="btn danger sm" data-action="cyc-period-delete" data-index="${selectedPeriodIndex}">Excluir período</button></div></div>` : ''}
      <div class="cycle-day-tools"><button type="button" class="btn ghost sm" data-action="cyc-flow-open">${icon(CYC_ICON.flow, 16)}Registrar fluxo</button><button type="button" class="btn sm" data-action="cyc-open">${icon('pencil', 16)}Registrar este dia</button></div>
      <div class="scroll-x" role="group" aria-label="Escolher o dia">${strip.map((k) => h`<button type="button" class="dchip ${k === sel ? 'on' : ''} ${st.set.has(k) ? 'per' : ''}" data-action="cyc-day" data-d="${k}" aria-pressed="${k === sel}" aria-label="${longDate(k)}${st.set.has(k) ? ', período' : ''}${hasAnyLog(S.cycleLog[k]) ? ', com registro' : ''}"><span>${DIAS[pk(k).getDay()]}</span><b>${pk(k).getDate()}</b><i class="${hasAnyLog(S.cycleLog[k]) ? 'on' : ''}"></i></button>`)}</div></section>
    <section class="card cycle-calendar-card"><div class="head"><button class="ibtn" data-action="cal-month" data-n="-1" aria-label="Mês anterior">${icon('chevLeft', 20)}</button><div><p class="section-kicker">Calendário do ciclo</p><h2>${cap(ymLabel(ym))}</h2><p class="cycle-calendar-help">Selecione um dia. As cores indicam registros ou fases estimadas.</p></div><button class="ibtn" data-action="cal-month" data-n="1" aria-label="Próximo mês">${icon('chevRight', 20)}</button></div>
      <div class="cal">${raw(DIAS.map((d) => `<b>${d}</b>`).join('') + cells.join(''))}</div>
      <div class="cycle-calendar-legend" role="group" aria-label="Legenda das fases do calendário">
        <span><i class="lg m"></i>Menstruação registrada</span>
        <span><i class="lg fertile"></i>Janela fértil estimada</span>
        <span><i class="lg ovulation"></i>Ovulação estimada</span>
        <span><i class="lg p"></i>Próximo início estimado</span>
        <span><i class="lg l"></i>Dia com registro</span>
      </div></section>
    ${top.length ? h`<section class="card"><h2>Mais frequentes nos últimos 90 dias<i>.</i></h2><ul class="list">${top.map(({ label, count }) => h`<li><span class="grow ttl">${label}</span><span class="badge">${count} ${plural(count, 'dia', 'dias')}</span></li>`)}</ul></section>` : ''}
    <details class="card cycle-health-card" open>
      <summary class="cycle-health-summary"><span><span class="cycle-health-eyebrow">Informação e cuidado</span><strong>Saúde menstrual e sexual</strong><small>Entenda mudanças do ciclo, cuidados nas relações e quando buscar ajuda.</small></span>${icon('chevDown', 18)}</summary>
      <div class="cycle-health-content">
        <article class="cycle-health-topic">
          <h3>${icon('activity', 17)}O que pode explicar as mudanças?</h3>
          <p>Os níveis hormonais mudam ao longo do ciclo e podem acompanhar cólicas, sensibilidade nas mamas e variações de humor. A cólica costuma ocorrer porque o útero se contrai para eliminar seu revestimento. Estresse, mudanças de peso ou de exercício, gravidez e alguns métodos contraceptivos também podem alterar o padrão. Uma mudança isolada não confirma uma causa: registre quando acontece e converse com uma profissional de saúde se persistir ou preocupar.</p>
        </article>
        <article class="cycle-health-topic">
          <h3>${icon('heart', 17)}Sexo, menstruação e proteção</h3>
          <p>Ter relações durante a menstruação é uma escolha; conforto e consentimento importam. Menstruar não impede gravidez: a ovulação pode variar e espermatozoides podem permanecer viáveis por alguns dias. Se não deseja uma gravidez, use um método contraceptivo. ISTs podem ser transmitidas em qualquer fase do ciclo, e algumas não dão sinais; preservativos reduzem o risco. Procure uma UBS para orientação e testagem após exposição ou se houver sintomas.</p>
          <p>Sangramento entre menstruações ou depois da relação pode ter diferentes causas, inclusive contraceptivos, ressecamento ou infecções. Se for novo, recorrente ou vier com dor, procure avaliação — não dá para descobrir a causa apenas pelo aplicativo.</p>
        </article>
        <article class="cycle-health-topic">
          <h3>${icon('alert', 17)}Dor e sinais para buscar atendimento</h3>
          <p>Procure uma UBS ou ginecologista se a dor piorar, atrapalhar suas atividades, houver dor durante a relação, ao urinar ou evacuar, ou mudança persistente no fluxo ou intervalo. Dor pélvica muito forte, nova ou pior que o habitual merece avaliação urgente. Se houver possibilidade de gravidez ou atraso menstrual junto com sangramento fora do usual e dor abdominal, procure atendimento com urgência. Em emergência, ligue 192 (SAMU).</p>
        </article>
        <div class="cycle-health-sources" aria-label="Fontes de saúde">
          <span>Fontes:</span>
          <a href="https://www.gov.br/saude/pt-br/assuntos/saude-de-a-a-z/i/ist" target="_blank" rel="noopener noreferrer">Ministério da Saúde · ISTs</a>
          <a href="https://www.nhs.uk/contraception/methods-of-contraception/natural-family-planning/" target="_blank" rel="noopener noreferrer">NHS · contracepção e fertilidade</a>
          <a href="https://www.nhs.uk/conditions/periods/period-problems/" target="_blank" rel="noopener noreferrer">NHS · alterações menstruais</a>
          <a href="https://www.nhs.uk/symptoms/period-pain/" target="_blank" rel="noopener noreferrer">NHS · dor menstrual</a>
          <a href="https://www.nhs.uk/symptoms/vaginal-bleeding-between-periods-or-after-sex/" target="_blank" rel="noopener noreferrer">NHS · sangramento fora do período ou após sexo</a>
          <a href="https://www.gov.br/saude/pt-br/composicao/saes/samu-192" target="_blank" rel="noopener noreferrer">Ministério da Saúde · SAMU 192</a>
        </div>
      </div>
    </details>
    <div class="notice cycle-estimate-notice">${icon('info', 18)}<span>${st.avg ? `As médias e previsões são estimativas baseadas nos inícios registrados; ovulação e janela fértil podem variar e não são confirmadas pelo app. ` : 'Ainda não há registros suficientes para estimar fases do ciclo. '}${'As previsões não substituem avaliação profissional nem servem como método contraceptivo.'}</span></div>`;
}

/* ---------- Ajustes ---------- */
function settingsSegment(look, key, label, options, action = 'look') {
  return h`<div class="seg" role="group" aria-label="${label}">${options.map(([value, text, ic, sample]) => h`<button type="button" aria-pressed="${String(look[key]) === String(value)}" data-action="${action}" data-k="${key}" data-v="${value}">${ic ? icon(ic, 16) : ''}${sample ? h`<span class="appearance-font-sample appearance-font-sample-${value}" aria-hidden="true">Aa</span>` : ''}<span class="appearance-segment-label">${text}</span></button>`)}</div>`;
}
function activeAppearancePreset(settings) {
  return Object.entries(APPEARANCE_PRESETS).find(([, preset]) => settings.theme === preset.theme
    && settings.look.density === preset.density
    && settings.look.font === preset.font)?.[0] || '';
}
function aparencia(s) {
  s = settingsView();
  const L = s.look;
  const currentPalette = s.theme === 'custom' ? 'Personalizada' : PALETTES[s.theme]?.[0] || PALETTES.rose[0];
  const group = (id, title, description, content) => h`<section class="appearance-settings-group" aria-labelledby="${id}"><div class="appearance-settings-copy"><h3 id="${id}">${title}</h3><p>${description}</p></div>${content}</section>`;
  const defaultAppearance = s.theme === 'rose' && L.custom === LOOK_DEFAULT.custom
    && L.density === LOOK_DEFAULT.density && L.font === LOOK_DEFAULT.font
    && !L.contrast && !L.readable && !L.highlightLinks && !L.reduceMotion;
  return h`<form class="card appearance-settings" data-form="settings-save" aria-labelledby="appearance-settings-title">
    <div class="appearance-settings-heading"><div><h2 id="appearance-settings-title">Personalização<i>.</i></h2><p>Ajuste o tema, as cores, o tamanho do texto, o espaçamento e o calendário. Use Salvar para manter as alterações.</p></div><button type="button" class="btn sm" data-action="appearance-reset" ${defaultAppearance ? raw('disabled') : ''}>Restaurar padrão visual</button></div>
    ${group('appearance-presets-title', 'Estilos prontos', 'Escolha uma combinação inicial; você pode ajustar cada opção depois.', h`<div class="appearance-preset-grid" role="group" aria-label="Estilos prontos">${Object.entries(APPEARANCE_PRESETS).map(([id, preset]) => h`<button type="button" class="appearance-preset" data-action="appearance-preset" data-v="${id}" aria-pressed="${String(activeAppearancePreset(s) === id)}"><span class="appearance-preset-swatch" style="--preset-color:${PALETTES[preset.theme][1]}" aria-hidden="true">${icon('check', 14)}</span><span><b>${preset.label}</b><small>${preset.description}</small></span></button>`)}</div>`) }
    ${group('appearance-mode-title', 'Tema', 'Claro, escuro ou o mesmo do seu aparelho. O tema é salvo ao tocar.', h`<div class="seg" role="group" aria-label="Tema">${[['auto', 'Automático', 'monitor'], ['light', 'Claro', 'sun'], ['dark', 'Escuro', 'moon']].map(([value, text, ic]) => h`<button type="button" id="personalization-mode-${value}" aria-pressed="${String(L.mode === value)}" data-action="accessibility-mode" data-v="${value}">${icon(ic, 16)}<span>${text}</span></button>`)}</div>`)}
    ${group('appearance-color-title', 'Cor de destaque', `Paleta atual: ${currentPalette}.`, h`<div class="swatches appearance-swatches" role="group" aria-label="Paletas de cor">${Object.entries(PALETTES).map(([k, [n, c]]) => h`<button type="button" class="swatch" aria-label="Cor ${n}" aria-pressed="${String(s.theme === k)}" data-action="set-theme" data-v="${k}"><i style="background:${c}" aria-hidden="true"></i><span>${n}</span></button>`)}
      <label class="swatch appearance-custom-color${s.theme === 'custom' ? ' is-selected' : ''}" title="Escolher cor personalizada">
        <i class="appearance-custom-preview" style="background:${s.theme === 'custom' ? paletteColors('custom', L)[0] : '#ffffff'}" aria-hidden="true"></i>
        <span>Personalizada</span>
        <input class="sr" type="color" data-change="look-custom" value="${L.custom}" aria-label="Escolher cor personalizada">
      </label></div>`)}
    ${group('appearance-reading-title', 'Leitura e espaçamento', 'Ajuste o tamanho do texto e a distância entre os elementos da tela.', h`<div class="appearance-settings-controls">
      <div class="appearance-settings-option"><span class="appearance-settings-label">Tamanho do texto</span>${settingsSegment(L, 'font', 'Tamanho do texto', [['s', 'Pequeno', '', 'sample'], ['m', 'Médio', '', 'sample'], ['l', 'Grande', '', 'sample']])}</div>
      <div class="appearance-settings-option"><span class="appearance-settings-label">Espaçamento</span>${settingsSegment(L, 'density', 'Espaçamento', [['comfy', 'Confortável'], ['compact', 'Compacto']])}</div>
    </div>`)}
    ${group('appearance-accessibility-title', 'Acessibilidade', 'Personalize contraste, leitura, links e movimento para todas as telas.', h`<div class="accessibility-options accessibility-settings-options">
      ${accessibilityOption('settings-accessibility-contrast', 'accessibility-contrast', 'Alto contraste', 'Reforça textos, bordas e foco.', L.contrast)}
      ${accessibilityOption('settings-accessibility-readable', 'accessibility-readable', 'Legibilidade aprimorada', 'Usa uma fonte simples e aumenta o espaçamento entre linhas.', L.readable)}
      ${accessibilityOption('settings-accessibility-links', 'accessibility-links', 'Destacar links', 'Sublinha os links para identificá-los com mais facilidade.', L.highlightLinks)}
      ${accessibilityOption('settings-accessibility-motion', 'accessibility-motion', 'Reduzir movimento', 'Reduz animações e rolagens suaves.', L.reduceMotion)}
    </div>`)}
    ${group('appearance-calendar-title', 'Calendário', 'Escolha o dia em que a semana começa nas visualizações do Aurora.', h`<div class="appearance-settings-controls"><div class="appearance-settings-option"><span class="appearance-settings-label">A semana começa na</span>${settingsSegment(s.look, 'weekStart', 'Primeiro dia da semana', [[1, 'Segunda'], [0, 'Domingo']], 'preferences-week-start')}</div></div>`) }
    ${group('appearance-area-colors-title', 'Cores por área', 'Escolha uma cor para cada área. O Aurora ajusta o tom para manter a leitura nos temas claro e escuro.', h`<div class="appearance-area-colors">${HOME_AREA_COLORS.filter(({ id }) => id !== 'cycle' || canAccessCycle(s.profile, ui.preview)).map(({ id, label }) => h`<label class="appearance-area-color"><span>${label}</span><select data-change="home-area-color" data-home-area-color="${id}" aria-label="Cor da área ${label}"><option value="">Padrão da área</option>${Object.entries(PALETTES).map(([paletteId, [name]]) => h`<option value="${paletteId}" ${s.prefs.areaColors[id] === paletteId ? raw('selected') : ''}>${name}</option>`)}</select></label>`)}</div>`) }
    ${group('appearance-routine-title', 'Rotina', 'Encontre rapidamente os ajustes de lembretes e hábitos do Aurora.', h`<div class="routine-settings-links">
      <a class="btn" href="${areaOn('habits') ? '/habitos' : '/config?section=areas-navigation'}">${icon('check', 17)}${areaOn('habits') ? 'Hábitos e lembretes' : 'Ativar Hábitos'}</a>
    </div>`) }
    ${settingsSaveButton()}
  </form>`;
}
function firstName(value) {
  const normalized = String(value || '').trim();
  if (!normalized) return '';
  return normalized.split(/\s+/)[0];
}
function profileDraftFromSettings(settings) {
  const baseName = String(settings.profile.name || '');
  const preferred = settings.profile.preferredName && settings.profile.preferredName.trim()
    ? settings.profile.preferredName
    : firstName(baseName);
  return {
    name: baseName,
    preferredName: preferred,
    sex: settings.profile.sex || '',
    age: settings.profile.age == null ? '' : String(settings.profile.age),
    appearance: normalizeProfileAppearance(settings.prefs.profileAppearance),
  };
}
function profileSettings(s) {
  s = settingsView();
  const p = ui.profileDraft || profileDraftFromSettings(s);
  const appearance = normalizeProfileAppearance(p.appearance);
  const profileDirty = profileDraftHasChanges(p, s.profile, s.prefs.profileAppearance);
  const defaultProfileAppearance = sameJsonValue(appearance, PROFILE_APPEARANCE_DEFAULT);
  return h`<div class="profile-settings-container">
    <form id="profile-settings-form" class="card profile-settings" aria-labelledby="settings-profile-title" data-form="settings-profile" novalidate>
    <div class="profile-settings-heading"><h2 id="settings-profile-title">Seu perfil<i>.</i></h2><p>É assim que o Aurora se apresenta para você. Mude quando quiser.</p></div>
    <div class="profile-greeting-preview" aria-live="polite">${profileAvatarMarkup(appearance)}<span class="profile-greeting-copy"><span>Prévia na tela Início</span><b><span id="profile-preview-greeting">${profileGreeting(appearance.greeting)}</span>, <span id="profile-preview-name" class="proper-name">${p.preferredName.trim() || p.name.trim() || 'Seu nome'}</span>.</b></span></div>
    <section class="profile-settings-group" aria-labelledby="profile-name-title">
      <div><h3 id="profile-name-title">Informações do perfil</h3></div>
      <div class="form profile-settings-fields">
        <label class="f" for="pname">Nome<input type="text" id="pname" data-profile-field="name" value="${p.name}" maxlength="50" autocomplete="name" required></label>
        <label class="f" for="ppreferred">Como prefere ser chamada?<input type="text" id="ppreferred" data-profile-field="preferredName" value="${p.preferredName}" maxlength="50" autocomplete="nickname" aria-describedby="profile-preferred-help" placeholder="${firstName(p.name) || 'Elisa'}"><span class="profile-field-help" id="profile-preferred-help">É o nome que aparece na saudação.</span></label>
        <label class="f" for="psex">Identidade de gênero · obrigatória<select id="psex" data-profile-field="sex" aria-describedby="profile-sex-help" required><option value="">Selecione uma opção</option>${Object.entries(SEX).map(([key, label]) => h`<option value="${key}" ${p.sex === key ? raw('selected') : ''}>${label}</option>`)}</select><span class="profile-field-help" id="profile-sex-help">Selecione uma opção. Ciclo fica disponível apenas para mulheres.</span></label>
        <label class="f" for="page">Idade · opcional<input type="number" id="page" data-profile-field="age" min="0" max="120" step="1" inputmode="numeric" aria-describedby="profile-age-help" value="${p.age}" placeholder="Opcional"><span class="profile-field-help" id="profile-age-help">Usamos só para sugerir a meta de água nos Hábitos.</span></label>
      </div>
    </section>
    <section class="profile-settings-group" aria-labelledby="profile-appearance-title">
      <div class="profile-appearance-heading"><div><h3 id="profile-appearance-title">Identidade visual.</h3><p>Escolha um símbolo, uma cor e a forma de saudação que aparece no Início.</p></div><button type="button" class="btn sm" data-action="profile-appearance-reset" ${defaultProfileAppearance ? raw('disabled') : ''}>Restaurar padrão</button></div>
      <div class="profile-appearance-controls">
        <div class="profile-appearance-option"><span class="appearance-settings-label">Símbolo</span><div class="profile-avatar-options" role="group" aria-label="Símbolo do perfil">${PROFILE_AVATARS.map(([id, label]) => h`<button type="button" class="profile-avatar-option" data-action="profile-appearance" data-k="avatar" data-v="${id}" aria-label="${label}" title="${label}" aria-pressed="${String(appearance.avatar === id)}">${icon(id, 20)}</button>`)}</div></div>
        <div class="profile-appearance-option"><span class="appearance-settings-label">Cor</span><div class="profile-avatar-colors" role="group" aria-label="Cor do símbolo">${PROFILE_AVATAR_COLORS.map(([id, label]) => h`<button type="button" class="profile-avatar-color" data-action="profile-appearance" data-k="avatarColor" data-v="${id}" aria-label="${label}" title="${label}" aria-pressed="${String(appearance.avatarColor === id)}"><span style="--profile-avatar-color:${PALETTES[id][1]}" aria-hidden="true">${appearance.avatarColor === id ? icon('check', 12) : ''}</span></button>`)}</div></div>
        <div class="profile-appearance-option"><span class="appearance-settings-label">Saudação</span>${settingsSegment(appearance, 'greeting', 'Saudação no Início', PROFILE_GREETING_STYLES.map(([id, label]) => [id, label]), 'profile-appearance')}</div>
      </div>
    </section>
  </form>
  </div>`;
}
function accountSettings(s) {
  return h`<div class="settings-account-list">
    <section class="card settings-section-card account-session-card" aria-labelledby="account-session-title">
      <div class="settings-section-heading account-session-heading"><h2 id="account-session-title">Conta e ajuda<i>.</i></h2><button type="button" class="btn sm back" data-account-signout>Sair da conta</button></div>
    </section>
    <section class="card settings-section-card account-delete-card danger-zone" aria-labelledby="account-delete-title">
      <div class="settings-section-heading account-delete-heading"><div><h2 id="account-delete-title">Excluir conta<i>.</i></h2><p>A exclusão apaga a conta e todos os dados e não pode ser desfeita.</p></div><button type="button" class="btn danger" data-action="account-delete-open">Excluir conta</button></div>
    </section>
    <section class="card settings-section-card account-resources-card" aria-labelledby="account-resources-title">
      <div class="settings-section-heading"><div><h2 id="account-resources-title">Ajuda e documentos<i>.</i></h2><p>Termos de Uso, Política de Privacidade e contato com o Aurora.</p></div></div>
      <div class="row account-resource-actions"><button type="button" class="btn sm" data-legal-document="terms">Termos de Uso</button><button type="button" class="btn sm" data-legal-document="privacy">Política de Privacidade</button><a class="btn ghost sm" href="mailto:lisjustino@gmail.com">Falar com o Aurora</a></div>
    </section>
  </div>`;
}
function profileDraftHasChanges(draft, profile, savedAppearance = PROFILE_APPEARANCE_DEFAULT) {
  return draft.name !== (profile.name || '')
    || draft.preferredName !== (profile.preferredName || profile.name || '')
    || draft.sex !== (profile.sex || '')
    || draft.age !== (profile.age == null ? '' : String(profile.age))
    || !sameJsonValue(normalizeProfileAppearance(draft.appearance), normalizeProfileAppearance(savedAppearance));
}

const LEGACY_SETTINGS_TABS = { appearance: 'personalization', preferences: 'personalization', calendar: 'personalization', areas: 'areas-navigation', navigation: 'areas-navigation' };
const settingsTabId = (id) => LEGACY_SETTINGS_TABS[id] || id;
const SETTINGS_SECTIONS = [
  ['profile', 'Seu perfil', 'user', 'Nome, saudação e idade'],
  ['personalization', 'Aparência e leitura', 'sun', 'Tema, cores e acessibilidade'],
  ['home', 'Tela inicial', 'home', 'Modo, blocos e ações rápidas'],
  ['areas-navigation', 'Áreas e menu', 'grid', 'Ativar áreas e organizar o menu'],
  ['data', 'Dados e backup', 'archive', 'Importar e exportar'],
  ['calendars', 'Agendas', 'calendar', 'Conectar contas e escolher calendários'],
  ['account', 'Conta e ajuda', 'info', 'Sair, excluir e documentos'],
];
const SETTINGS_SECTION_GROUPS = [
  { label: 'Perfil', items: ['profile'] },
  { label: 'Aplicativo', items: ['personalization', 'home', 'areas-navigation'] },
  { label: 'Dados', items: ['data'] },
  { label: 'Conexões', items: ['calendars'] },
  { label: 'Conta', items: ['account'] },
];
function homeLayoutSettings(s) {
  const activeMode = s.prefs.homeMode;
  const modeDefaults = defaultHomeModes()[activeMode];
  const layout = s.prefs.homeLayout;
  const shortcuts = s.prefs.homeShortcuts;
  const ordered = layout.order.map((id) => HOME_BLOCKS.find(([blockId]) => blockId === id)).filter(Boolean);
  const isDefault = sameJsonValue(layout, modeDefaults.layout) && sameJsonValue(shortcuts, modeDefaults.shortcuts);
  return h`<section class="home-layout-settings" aria-labelledby="home-layout-title">
    <div class="settings-section-heading"><div><h3 id="home-layout-title">Tela inicial<i>.</i></h3><p>Escolha um modo e personalize os blocos e ações que aparecem no Início. O plano de hoje fica fixo no topo.</p></div><button type="button" class="btn sm" data-action="home-layout-reset" ${isDefault ? raw('disabled') : ''}>Restaurar modo</button></div>
    <div class="home-mode-grid" role="group" aria-label="Modos da tela inicial">${Object.entries(HOME_MODES).map(([id, mode]) => h`<button type="button" class="home-mode-option" data-action="home-mode" data-home-mode="${id}" aria-pressed="${String(activeMode === id)}"><b>${mode.label}</b><small>${mode.description}</small></button>`)}</div>
    <fieldset class="home-shortcut-settings"><legend>Ações favoritas</legend><p class="small muted">Escolha quais ações rápidas aparecem na Home. O atalho Nova tarefa fica oculto quando o formulário rápido está visível; áreas desativadas ficam guardadas e aparecem quando você as ativar.</p><div class="home-shortcut-options">${HOME_SHORTCUTS.map(({ id, label, description, area }) => h`<label class="home-layout-toggle"><input type="checkbox" data-change="home-shortcut-visible" data-home-shortcut="${id}" aria-label="${shortcuts.includes(id) ? 'Ocultar' : 'Mostrar'} ${label} na Home" ${shortcuts.includes(id) ? raw('checked') : ''}><span><b>${label}</b><small>${area && !s.areas[area] ? 'Ative esta área para exibir. ' : ''}${description}</small></span></label>`)}</div></fieldset>
    <label class="home-message-field"><span>Mensagem pessoal <small>Opcional · até ${HOME_MESSAGE_MAX_LENGTH} caracteres</small></span><textarea data-keep data-change="home-message" maxlength="${HOME_MESSAGE_MAX_LENGTH}" rows="2" placeholder="Ex.: Um passo de cada vez." aria-describedby="home-message-count">${s.prefs.homeMessage}</textarea><small id="home-message-count" class="home-message-count" aria-live="polite">${s.prefs.homeMessage.length}/${HOME_MESSAGE_MAX_LENGTH}</small></label>
    <ol class="home-layout-list" aria-label="Blocos da tela inicial">${ordered.map(([id, label, description], index) => h`<li class="home-layout-item">
      <label class="home-layout-toggle"><input type="checkbox" data-change="home-block-visible" data-home-block="${id}" aria-label="${layout.visible.includes(id) ? 'Ocultar' : 'Mostrar'} ${label} na tela inicial" ${layout.visible.includes(id) ? raw('checked') : ''}><span><b>${label}</b><small>${description}</small></span></label>
      <span class="home-layout-controls"><span>${id === 'today' ? '1º · fixo' : `${index + 1}º`}</span>${id === 'today' ? '' : h`<button type="button" class="ibtn" data-action="home-block-move" data-home-block="${id}" data-direction="-1" aria-label="Mover ${label} para cima" ${index === 1 ? raw('disabled') : ''}>${icon('arrowUp', 16)}</button><button type="button" class="ibtn" data-action="home-block-move" data-home-block="${id}" data-direction="1" aria-label="Mover ${label} para baixo" ${index === ordered.length - 1 ? raw('disabled') : ''}>${icon('arrowDown', 16)}</button>`}</span>
    </li>`)}</ol>
  </section>`;
}
function areasNavigationSettings(s) {
  s = settingsView();
  const items = normalizeMenuOrder(s.prefs.menuOrder)
    .map((id) => MENU_ITEMS.find((item) => item.id === id))
    .filter((item) => item && !HIDDEN_MENU_IDS.includes(item.id)
      && (item.id !== 'ciclo' || canAccessCycle(s.profile, ui.preview)));
  const orderedItems = items;
  const defaultPreferences = defaultMenuPreferences();
  const isDefaultMenuSettings = isDefaultMenuPreferences(s.prefs);
  return h`<form class="card areas-navigation-settings" data-form="settings-save">
    <div class="head areas-navigation-head"><h2>Áreas e menu<i>.</i></h2><button type="button" class="btn sm" data-action="menu-reset" ${isDefaultMenuSettings ? raw('disabled') : ''}>Restaurar padrão</button></div>
    <p class="settings-section-intro">Escolha quais áreas aparecem e organize o acesso pelo menu. Desativar ou ocultar uma área não apaga seus dados.</p>
    <p class="small muted">Início fica sempre primeiro. Beber água é uma sugestão de hábito em Hábitos. Restaurar o padrão não ativa áreas nem altera registros.</p>
    <ol class="areas-navigation-list compact-card-grid" aria-label="Áreas e menus principais">${items.map((item) => {
      const areaName = item.area ? AREAS[item.area]?.[0] || item.label : item.label;
      const areaDescription = item.area ? AREAS[item.area]?.[1] || '' : item.id === 'inicio' ? 'Página inicial do Aurora' : 'Tarefas, prazos e planejamento';
      const orderIndex = orderedItems.findIndex(({ id }) => id === item.id);
      const orderLabel = item.id === 'inicio' ? 'Sempre primeiro' : item.id === 'planejar' ? 'Sempre visível' : '';
      const areaEnabled = item.area ? s.areas[item.area] === true : false;
      return h`<li class="areas-navigation-item">
        <span class="areas-navigation-icon">${icon(item.icon, 20)}</span>
        ${item.area ? h`<label class="areas-navigation-toggle"><input type="checkbox" data-change="area" data-area="${item.area}" aria-label="${areaEnabled ? 'Desativar' : 'Ativar'} área ${areaName}" ${areaEnabled ? raw('checked') : ''}><span class="setting-toggle-copy"><span class="areas-navigation-name"><b>${areaName}</b><small class="area-status${areaEnabled ? ' is-active' : ''}">${areaEnabled ? 'Ativa' : 'Desativada'}</small></span><span>${areaDescription}</span></span></label>`
          : h`<span class="areas-navigation-copy"><b>${areaName}</b><span>${areaDescription}</span></span>`}
        <span class="areas-navigation-controls">
          ${item.area && !HIDDEN_MENU_IDS.includes(item.id)
            ? h`<label class="menu-visibility"><input type="checkbox" id="menu-visible-${item.id}" data-keep data-change="menu-visible" data-menu-id="${item.id}" aria-label="${s.prefs.visibleMenuItems.includes(item.id) ? 'Ocultar' : 'Mostrar'} ${item.label} no menu" ${s.prefs.visibleMenuItems.includes(item.id) ? raw('checked') : ''}><span>Mostrar no menu</span></label>`
            : h`<span class="menu-always-visible">${orderLabel}</span>`}
          ${HIDDEN_MENU_IDS.includes(item.id)
            ? ''
            : h`<span class="areas-navigation-order"><span class="areas-navigation-position">${item.id === 'inicio' ? '1º' : item.id === 'planejar' ? 'Fixo' : `${orderIndex + 1}º`}</span>
              ${canMoveMenuItem(s.prefs.menuOrder, item.id, -1, HIDDEN_MENU_IDS) ? h`<button type="button" class="ibtn" id="menu-move-up-${item.id}" data-action="menu-move" data-menu-id="${item.id}" data-direction="-1" aria-label="Mover ${item.label} para cima">${icon('arrowUp', 18)}</button>` : ''}
              ${canMoveMenuItem(s.prefs.menuOrder, item.id, 1, HIDDEN_MENU_IDS) ? h`<button type="button" class="ibtn" id="menu-move-down-${item.id}" data-action="menu-move" data-menu-id="${item.id}" data-direction="1" aria-label="Mover ${item.label} para baixo">${icon('arrowDown', 18)}</button>` : ''}
            </span>`}
        </span>
      </li>`;
    })}</ol>
    ${settingsSaveButton()}
  </form>`;
}
function homeSettings(s) {
  s = settingsView();
  return h`<form class="card home-settings" data-form="settings-save">
    ${homeLayoutSettings(s)}
    ${settingsSaveButton()}
  </form>`;
}
const LEGACY_IMPORT_LABELS = [
  ['tasks', 'Tarefas'],
  ['habits', 'Hábitos'],
  ['habitLogs', 'Registros de hábitos'],
  ['water', 'Registros antigos de hidratação'],
  ['gym', 'Modelos e registros de treino'],
  ['finance', 'Registros financeiros'],
  ['cycle', 'Ciclo e diário'],
  ['weight', 'Pesagens'],
];
function setLegacyImportError(message) {
  ui.legacyImport.error = message;
  ui.legacyImport.busy = false;
  render();
}
let legacyImportModulesPromise;
function loadLegacyImportModules() {
  if (!legacyImportModulesPromise) {
    legacyImportModulesPromise = Promise.all([
      import('./data/legacy-import.js'),
      import('./data/legacy-import-model.js'),
    ]).then(([importer, model]) => ({ ...importer, ...model }))
      .catch((error) => {
        legacyImportModulesPromise = null;
        throw error;
      });
  }
  return legacyImportModulesPromise;
}
async function prepareLegacyImportPreview(migration, sources, vaultCount) {
  const { prepareLegacyImport } = await loadLegacyImportModules();
  const browserData = migration.browserData;
  const sourceCounts = {
    browser: Object.keys(browserData.plain).length,
    encryptedBrowser: Object.keys(browserData.encrypted).length,
    vault: vaultCount,
  };
  const currentState = JSON.parse(JSON.stringify(S));
  const plan = prepareLegacyImport({
    currentState,
    sources,
    defaults: defaults(),
    normalizeSlice,
  });
  migration.preview = {
    browserData,
    currentState,
    plan,
    sourceCounts,
  };
  browserData.plain = {};
  browserData.encrypted = {};
  migration.browserData = null;
  migration.discovery = null;
  migration.step = plan.slices.length ? 'review' : 'empty';
}
async function discoverLegacyImport() {
  if (!accountSession || !Persist.store || ui.legacyImport.busy) return;
  ui.legacyImport = {
    step: 'start',
    browserData: null,
    discovery: null,
    preview: null,
    error: '',
    busy: true,
    completed: false,
    cleanup: null,
    cleanupConfirmed: false,
  };
  render();
  try {
    const {
      inspectLegacySources,
      scanLegacyBrowserStorage,
    } = await loadLegacyImportModules();
    const browserData = scanLegacyBrowserStorage(window.localStorage, accountSession.user.id);
    const discovery = await inspectLegacySources({
      client: accountSession.client,
      userId: accountSession.user.id,
      browserData,
    });
    const migration = ui.legacyImport;
    migration.browserData = browserData;
    migration.discovery = discovery;
    if (discovery.requiresUnlock) {
      migration.step = 'unlock';
    } else {
      await prepareLegacyImportPreview(migration, discovery.sources, discovery.vaultCount);
    }
  } catch (error) {
    console.error('Aurora: a busca por dados antigos não foi concluída.', error);
    ui.legacyImport.error = error instanceof Error
      ? error.message
      : 'Não foi possível localizar os dados antigos. Eles foram preservados.';
  } finally {
    ui.legacyImport.busy = false;
    render();
  }
}
async function unlockLegacyImport() {
  const migration = ui.legacyImport;
  if (!accountSession || !migration.discovery?.requiresUnlock || migration.busy) return;
  const passwordInput = $('#legacy-vault-password');
  const password = passwordInput?.value || '';
  if (passwordInput) passwordInput.value = '';
  migration.busy = true;
  migration.error = '';
  render();
  try {
    const { unlockLegacySources } = await loadLegacyImportModules();
    const { sources, vaultCount } = await unlockLegacySources({
      discovery: migration.discovery,
      userId: accountSession.user.id,
      password,
    });
    await prepareLegacyImportPreview(migration, sources, vaultCount);
  } catch (error) {
    console.error('Aurora: o cofre antigo não pôde ser desbloqueado para importação.', error);
    migration.error = error instanceof Error
      ? error.message
      : 'Não foi possível ler o cofre antigo. Os dados continuam preservados.';
  } finally {
    migration.busy = false;
    render();
  }
}
async function applyLegacyImport() {
  const migration = ui.legacyImport;
  const preview = migration.preview;
  if (!accountSession || !Persist.store || !preview || migration.busy || migration.completed) return;
  if (!sameJsonValue(S, preview.currentState)) {
    migration.preview = null;
    migration.browserData = null;
    migration.discovery = null;
    migration.step = 'start';
    migration.error = 'Os dados da conta mudaram desde a análise. Analise novamente; nenhuma cópia antiga foi alterada.';
    render();
    return;
  }
  if (settingsDraftDirty() || ui.profileDraft || ui.dlg) {
    setLegacyImportError('Salve ou feche as alterações abertas antes de importar. Nenhuma origem antiga foi alterada.');
    return;
  }
  let hasAllExpectedRecords;
  try {
    ({ hasAllExpectedRecords } = await loadLegacyImportModules());
  } catch (error) {
    console.error('Aurora: não foi possível carregar o verificador da importação antiga.', error);
    setLegacyImportError('Não foi possível carregar a verificação de dados antigos. As cópias foram preservadas; tente novamente.');
    return;
  }
  const addedTotal = Object.values(preview.plan.added).reduce((sum, count) => sum + count, 0);
  if (!hasCurrentCycleDataConsent(accountSession?.user)) {
    setLegacyImportError('Antes de importar dados antigos, registre o consentimento específico de Ciclo. A importação substitui tabelas da conta e precisa preservar os dados de saúde que possam existir.');
    return;
  }
  if (!await confirmInDialog(`Importar os dados antigos para esta conta? A prévia encontrou ${addedTotal} novo(s) registro(s), além de configurações que possam ser recuperadas. Dados atuais desta conta serão mantidos e não haverá duplicação por ID. Os dados antigos só serão apagados depois de nova confirmação.`)) return;
  if (ui.persistBlocked.size || Object.keys(ui.integrityIssues).length) {
    setLegacyImportError('A conta atual tem dados bloqueados para gravação. Resolva a integridade dos dados antes de importar; nenhuma origem antiga foi alterada.');
    return;
  }
  if (!await Persist.flush()) {
    setLegacyImportError('Há alterações da conta ainda não confirmadas. Salve ou resolva os erros antes de importar.');
    return;
  }
  if (!sameJsonValue(S, preview.currentState) || settingsDraftDirty() || ui.profileDraft || ui.dlg) {
    migration.preview = null;
    migration.browserData = null;
    migration.discovery = null;
    migration.step = 'start';
    migration.error = 'Os dados da conta mudaram desde a análise. Analise novamente; nenhuma cópia antiga foi alterada.';
    render();
    return;
  }
  if (navigator.onLine === false) {
    setLegacyImportError('Sem conexão: a importação não foi gravada. Os dados antigos continuam preservados.');
    return;
  }

  migration.busy = true;
  migration.error = '';
  Persist.replacing = true;
  render();
  try {
    if (!sameJsonValue(S, preview.plan.state)) {
      await Persist.store.save(preview.plan.state);
    }
    const loaded = await Persist.store.load();
    const confirmed = {};
    for (const slice of SLICES) {
      const normalized = normalizeSlice(slice, loaded[slice] ?? defaults()[slice]);
      if (normalized.invalidCount) {
        throw new Error(`A conferência encontrou dados incompatíveis em ${slice}. A importação não foi confirmada; mantenha as cópias antigas.`);
      }
      confirmed[slice] = normalized.value;
    }
    const missing = hasAllExpectedRecords(preview.plan.state, confirmed);
    if (missing) {
      throw new Error(`A conferência não encontrou todos os registros esperados em ${missing}. A importação não foi confirmada; mantenha as cópias antigas.`);
    }
    S = confirmed;
    Persist.rawTables = Persist.store.rawTables;
    Persist.confirmedState = JSON.parse(JSON.stringify(confirmed));
    Persist.pendingSnapshot = null;
    ui.persistFailed.clear();
    ui.persistBlocked.clear();
    syncState.pending.clear();
    syncState.failed.clear();
    syncState.conflicts.clear();
    ui.settingsDraft = null;
    ui.settingsDraftBase = null;
    preview.plan.state = null;
    preview.currentState = null;
    preview.browserData.plain = {};
    preview.browserData.encrypted = {};
    migration.browserData = null;
    migration.discovery = null;
    migration.completed = true;
    migration.step = 'verified';
    migration.cleanupConfirmed = false;
    toast('Importação gravada e conferida na conta.');
  } catch (error) {
    console.error('Aurora: a importação relacional dos dados antigos não foi confirmada.', error);
    migration.error = error instanceof Error
      ? error.message
      : 'Não foi possível confirmar a importação. Os dados antigos foram preservados; você pode analisar e tentar novamente.';
  } finally {
    Persist.replacing = false;
    migration.busy = false;
    render();
  }
}
async function clearLegacyBrowserData() {
  const migration = ui.legacyImport;
  const preview = migration.preview;
  const snapshot = preview?.browserData?.snapshot;
  if (!migration.completed || !snapshot || !Object.keys(snapshot).length || migration.busy) return;
  if (!migration.cleanupConfirmed) {
    migration.error = 'Confirme que revisou os dados importados antes de remover as cópias deste navegador.';
    render();
    return;
  }
  migration.cleanupConfirmed = false;
  let result;
  try {
    const { clearImportedBrowserStorage } = await loadLegacyImportModules();
    result = clearImportedBrowserStorage(window.localStorage, snapshot);
  } catch (error) {
    console.error('Aurora: não foi possível preparar a limpeza das cópias antigas.', error);
    setLegacyImportError(error instanceof Error
      ? error.message
      : 'Não foi possível limpar as cópias antigas; elas continuam preservadas.');
    return;
  }
  result.removed.forEach((key) => { delete snapshot[key]; });
  if (result.changed.length) {
    migration.preview = null;
    migration.completed = false;
    migration.step = 'start';
    migration.error = `${result.removed.length} chave(s) foram apagadas, mas ${result.changed.length} mudaram depois da análise. Analise novamente antes de continuar; essas cópias não foram removidas.`;
  } else if (result.failed.length) {
    preview.cleanup = {
      failed: result.failed.length,
      changed: 0,
      message: `${result.removed.length} chave(s) apagadas. Não foi possível apagar ${result.failed.length}; você pode tentar novamente.`,
    };
  } else {
    preview.cleanup = {
      failed: 0,
      changed: 0,
      message: `${result.removed.length} chave(s) antiga(s) apagadas deste navegador. O cofre antigo e os dados da sua conta continuam preservados.`,
    };
  }
  render();
}
function legacyImportPanel() {
  const migration = ui.legacyImport;
  const preview = migration.preview;
  const snapshotCount = Object.keys(preview?.browserData?.snapshot || {}).length;
  const foundBrowserPlain = Object.keys(migration.browserData?.plain || {}).length;
  const foundBrowserEncrypted = Object.keys(migration.browserData?.encrypted || {}).length;
  const foundVault = migration.discovery?.vaultRows?.length || 0;
  const activeStep = ['start', 'unlock'].includes(migration.step)
    ? 1
    : ['review', 'empty'].includes(migration.step) ? 2 : 3;
  const steps = [
    ['Encontrar cópias', 'Só leitura; nada será alterado'],
    ['Revisar e importar', 'Confira o resumo antes de gravar'],
    ['Conferir e limpar', 'Apagar cópias locais é opcional'],
  ];
  const expanded = migration.step !== 'start' || migration.busy || Boolean(migration.error) || migration.completed;
  return h`<details class="card settings-section-card settings-data-migration" ${expanded ? raw('open') : ''}>
    <summary class="settings-data-migration-summary">
      <span class="settings-data-action-icon" aria-hidden="true">${icon('archive', 19)}</span>
      <span class="settings-data-migration-copy"><b>Importar dados de uma versão anterior</b><small>Para quem precisa recuperar cópias antigas do Aurora</small></span>
      <span class="settings-data-migration-indicator" aria-hidden="true">${icon('chevDown', 18)}</span>
    </summary>
    <div class="settings-data-migration-content">
    <div class="settings-section-heading"><p>Procure cópias deste navegador ou do cofre antigo. A busca não altera nada; você revisa antes de importar.</p></div>
    <ol class="legacy-import-steps" aria-label="Etapas para trazer dados antigos">${steps.map(([title, detail], index) => {
      const step = index + 1;
      const state = step < activeStep ? 'is-complete' : step === activeStep ? 'is-current' : '';
      return h`<li class="legacy-import-step ${state}" ${step === activeStep ? raw('aria-current="step"') : ''}><span class="legacy-import-step-number">${step < activeStep ? icon('check', 16) : step}</span><span><b>${title}</b><small>${detail}</small></span></li>`;
    })}</ol>
    <div class="notice warn" role="note"><span>Antes de continuar, confirme que entrou na conta correta. Os dados já existentes serão mantidos; itens com o mesmo ID não serão duplicados.</span></div>
    ${migration.error ? h`<p class="err" role="alert">${migration.error}</p>` : ''}
    ${migration.step === 'start' ? h`<div class="legacy-import-stage">
      <p>Vamos procurar dados antigos neste navegador e no cofre associado à sua conta. A busca não grava nem apaga nada.</p>
      <button type="button" class="btn primary" data-action="legacy-import-discover" ${migration.busy ? raw('disabled aria-busy="true"') : ''}>${migration.busy ? 'Procurando cópias…' : 'Começar busca'}</button>
    </div>` : ''}
    ${migration.step === 'unlock' ? h`<div class="legacy-import-stage">
      <div class="notice data-location" role="status"><span>Encontramos ${foundBrowserPlain} ${plural(foundBrowserPlain, 'área antiga', 'áreas antigas')} neste navegador e ${foundBrowserEncrypted} ${plural(foundBrowserEncrypted, 'cópia protegida', 'cópias protegidas')} nele. O cofre antigo da sua conta contém ${foundVault} ${plural(foundVault, 'área protegida', 'áreas protegidas')}.</span></div>
      <p>Para montar o resumo completo, precisamos ler as cópias protegidas. Use a senha que criou o cofre antigo — não a senha de login, a menos que sejam iguais. A busca não importou nem apagou nada.</p>
      <label class="f" for="legacy-vault-password"><span class="f-label">Senha original do cofre</span><input id="legacy-vault-password" class="field" type="password" maxlength="72" autocomplete="off" spellcheck="false" aria-describedby="legacy-vault-help"></label>
      <p class="small muted" id="legacy-vault-help">A senha é usada somente para ler essas cópias e não é salva. Redefinir a senha da conta não altera a senha antiga do cofre.</p>
      <div class="row"><button type="button" class="btn primary" data-action="legacy-import-unlock" ${migration.busy ? raw('disabled aria-busy="true"') : ''}>${migration.busy ? 'Desbloqueando…' : 'Desbloquear e ver resumo'}</button><button type="button" class="btn" data-action="legacy-import-discover" ${migration.busy ? raw('disabled') : ''}>Recomeçar busca</button></div>
    </div>` : ''}
    ${migration.step === 'review' && preview ? h`<div class="legacy-import-stage legacy-import-summary">
      <h3>Confira o resumo</h3>
      <p class="small muted">Cópias consideradas: ${preview.sourceCounts.browser} área(s) antigas neste navegador, ${preview.sourceCounts.encryptedBrowser} protegida(s) nele e ${preview.sourceCounts.vault} no cofre antigo da conta.</p>
      <ul class="backup-preview legacy-import-preview">${LEGACY_IMPORT_LABELS.map(([key, label]) => h`<li><b>${label}</b><span>Encontrados na cópia: ${preview.plan.found[key]} · Novos na conta: ${preview.plan.added[key]}</span></li>`)}</ul>
      ${preview.plan.hasSettings ? h`<p class="small">Também serão mescladas configurações, aparência, listas e preferências. Valores personalizados que já existem na conta serão mantidos.</p>` : ''}
      ${preview.plan.slices.some((slice) => slice === 'timer' || slice === 'pomodoro') ? h`<p class="small">Também encontramos dados de cronômetros.</p>` : ''}
      ${preview.browserData.markerKeys.length || preview.browserData.unknownUserKeys.length ? h`<p class="small muted">${preview.browserData.markerKeys.length} marcador(es) antigo(s) e ${preview.browserData.unknownUserKeys.length} chave(s) não reconhecida(s) não serão alterados.</p>` : ''}
      <div class="notice warn" role="note"><span>Importar não apaga as cópias antigas. A gravação será conferida lendo novamente os dados da conta. Se algo não puder ser conferido, manteremos as cópias para uma nova tentativa.</span></div>
      <div class="row"><button type="button" class="btn primary" data-action="legacy-import-apply" ${migration.busy ? raw('disabled') : ''}>${migration.busy ? 'Importando e conferindo…' : 'Importar e conferir'}</button><button type="button" class="btn" data-action="legacy-import-discover" ${migration.busy ? raw('disabled') : ''}>Cancelar e recomeçar</button></div>
    </div>` : ''}
    ${migration.step === 'empty' ? h`<div class="legacy-import-stage">
      <p role="status">Não encontramos cópias antigas importáveis nesta conta ou neste navegador. Nenhum dado foi alterado.</p>
      <button type="button" class="btn" data-action="legacy-import-discover" ${migration.busy ? raw('disabled') : ''}>Buscar novamente</button>
    </div>` : ''}
    ${migration.step === 'verified' && migration.completed ? h`<div class="legacy-import-stage">
      <div class="notice data-location" role="status"><span>Importação concluída: os dados foram gravados e lidos novamente da conta. Confira as áreas no Aurora antes de decidir sobre as cópias antigas.</span></div>
      ${snapshotCount ? h`<div class="legacy-import-cleanup">
        <h3>Opcional: apagar cópias deste navegador</h3>
        <p>Isso remove somente as ${snapshotCount} cópia(s) antiga(s) reconhecida(s) e lida(s) neste navegador. Não apaga os dados da sua conta nem o cofre antigo. Você também pode deixar essas cópias intactas.</p>
        <label class="legacy-import-confirm"><input id="legacy-import-reviewed" type="checkbox" data-change="legacy-import-cleanup-confirm" ${migration.cleanupConfirmed ? raw('checked') : ''}><span>Conferi os dados na conta e quero apagar exatamente estas cópias locais.</span></label>
        <button id="legacy-import-clear" type="button" class="btn danger" data-action="legacy-import-clear" ${migration.busy || !migration.cleanupConfirmed ? raw('disabled') : ''}>${migration.busy ? 'Apagando cópias…' : `Apagar ${snapshotCount} cópia(s) deste navegador`}</button>
      </div>` : h`<p class="small muted">Não há cópias reconhecidas neste navegador para apagar. O cofre antigo da sua conta continua preservado.</p>`}
    </div>` : ''}
    ${migration.completed && preview?.cleanup ? h`<p class="small ${preview.cleanup.failed || preview.cleanup.changed ? 'err' : 'muted'}" role="${preview.cleanup.failed || preview.cleanup.changed ? 'alert' : 'status'}">${preview.cleanup.message}</p>` : ''}
    </div>
  </details>`;
}
function dataSettings(p) {
  const integritySlices = Object.keys(ui.integrityIssues);
  const failedSlices = [...ui.persistFailed];
  const trashEntries = sortTrashEntriesByExpiry(p.trash.filter((entry) => !isTrashExpired(entry)));
  return h`<section class="card settings-section-card settings-backup-card">
    <div class="settings-section-heading"><h2>Backup e restauração<i>.</i></h2><p>Leve seus dados para outro navegador ou recupere uma cópia salva. A restauração mostra o conteúdo para você revisar antes de substituir os dados atuais.</p></div>
    <div class="notice warn data-location settings-data-safety" role="note">${icon('cloud', 18)}<span>O arquivo de backup não tem proteção própria por senha. Quem tiver acesso a ele poderá ver dados financeiros e de saúde. Guarde-o em um local privado.</span></div>
    ${integritySlices.length ? h`<div class="notice warn" role="alert"><span>Há dados bloqueados em ${integritySlices.join(', ')}. As cópias originais continuam preservadas e não serão sobrescritas. Importe um backup confiável para recuperar os dados; também baixe uma cópia bruta antes de substituir.</span></div><button class="btn" data-action="recovery-export">${icon('download', 18)}Baixar cópia de recuperação</button>` : ''}
    ${failedSlices.length && !integritySlices.length ? h`<div class="notice warn" role="alert"><span>Não foi possível salvar. Suas alterações ainda não foram salvas; tente novamente antes de sair.</span><button type="button" class="btn sm" data-action="persist-retry" ${navigator.onLine ? '' : raw('disabled')}>Tentar novamente</button></div>` : ''}
    <div class="settings-data-actions">
      <section class="settings-data-action settings-data-export" aria-labelledby="settings-export-title">
        <span class="settings-data-action-icon" aria-hidden="true">${icon('download', 19)}</span>
        <h3 id="settings-export-title">Guardar uma cópia</h3>
        <p>Baixe uma cópia dos seus dados para guardar em segurança. No celular, salve o arquivo fora dos dados do navegador.</p>
        <p class="small muted">${p.lastBackup ? 'Último backup exportado nesta conta: ' + shortDate(isoDay(p.lastBackup)) + '.' : 'Você ainda não exportou um backup nesta conta.'}</p>
        <div class="row"><button type="button" class="btn primary" data-action="export">${icon('download', 18)}Exportar backup</button></div>
      </section>
      <section class="settings-data-action settings-data-restore" aria-labelledby="settings-restore-title">
        <span class="settings-data-action-icon" aria-hidden="true">${icon('upload', 19)}</span>
        <h3 id="settings-restore-title">Usar uma cópia salva</h3>
        <p>A restauração substitui os dados atuais da conta. Você poderá conferir o conteúdo antes de confirmar.</p>
        <p class="small muted">Escolha um arquivo de backup exportado pelo Aurora.</p>
        <label class="btn backup-file-label">${icon('upload', 18)}Escolher arquivo<input type="file" accept="application/json,.json" data-change="import" class="sr"></label>
        <p class="err" id="imperr" role="alert"></p>
      </section>
    </div>
  </section>
    ${legacyImportPanel()}
    <section class="card settings-section-card settings-data-trash" aria-labelledby="trash-title"><div class="settings-section-heading"><h2 id="trash-title" tabindex="-1">Lixeira <span class="settings-data-count">${trashEntries.length}</span><i>.</i></h2><p>Os itens excluídos podem ser restaurados por até 30 dias. Os que vencem primeiro aparecem no topo; a lixeira também acompanha os backups.</p></div>
      ${trashEntries.length
        ? h`<ul class="list trash-list">${trashEntries.map((entry) => {
          const days = trashDaysRemaining(entry);
          return h`<li class="settings-trash-entry"><div class="grow"><div class="ttl">${entry.label}</div><span class="small muted">Excluído em ${shortDate(isoDay(entry.deletedAt))}</span><span class="settings-trash-expiry${days <= 7 ? ' is-urgent' : ''}">${days} ${plural(days, 'dia restante', 'dias restantes')}</span></div><button type="button" class="btn sm" data-action="trash-restore" data-id="${entry.id}" aria-label="Restaurar ${entry.label}">Restaurar</button></li>`;
        })}</ul>`
        : h`<div class="settings-trash-empty"><span aria-hidden="true">${icon('trash', 20)}</span><p><b>A lixeira está vazia</b><small>Quando você excluir itens, eles aparecerão aqui por até 30 dias.</small></p></div>`}
    </section>
    <section class="card settings-section-card settings-data-care" aria-labelledby="settings-care-title">
      <div class="settings-section-heading"><h2 id="settings-care-title">Ações avançadas<i>.</i></h2><p>Gerencie dados de demonstração ou remova os dados relacionais desta conta.</p></div>
      <div class="settings-data-care-actions">
        <section class="settings-data-action" aria-labelledby="settings-sample-title">
          <h3 id="settings-sample-title">Explorar com exemplos</h3>
          <p>Adicione registros fictícios para conhecer as áreas do Aurora. Eles são identificados como exemplos e não substituem seus dados pessoais.</p>
          <button type="button" class="btn" data-action="load-sample">Carregar exemplos</button>
        </section>
        <section class="settings-data-action settings-data-danger" aria-labelledby="settings-delete-title">
          <h3 id="settings-delete-title">${icon('trash', 18)}Apagar dados relacionais</h3>
          <p>Esta ação remove permanentemente os dados relacionais da conta. Só continue se tiver certeza e uma cópia do que deseja guardar.</p>
          <button type="button" class="btn danger" data-action="wipe-ask">Apagar dados relacionais</button>
        </section>
      </div>
    </section>`;
}
function settingsStorageNotice(selectedTab) {
  if (selectedTab === 'data') return '';
  const integritySlices = Object.keys(ui.integrityIssues);
  if (integritySlices.length) {
    return h`<div class="notice warn settings-storage-notice" role="alert"><span>Há dados inválidos em ${integritySlices.join(', ')}. A gravação está bloqueada para evitar perda; revise Dados e backup antes de continuar.</span><button type="button" class="btn sm" data-action="settings-section" data-settings-tab="data">Revisar dados</button></div>`;
  }
  const failedSlices = [...ui.persistFailed];
  if (failedSlices.length) {
    return h`<div class="notice warn settings-storage-notice" role="alert"><span>Não foi possível salvar. Algumas alterações ainda não foram salvas.</span><button type="button" class="btn sm" data-action="persist-retry" ${navigator.onLine ? '' : raw('disabled')}>Tentar novamente</button></div>`;
  }
  return '';
}
function settingsSectionContent(s, p, selectedTab) {
  switch (selectedTab) {
    case 'personalization': return aparencia(s);
    case 'home': return homeSettings(s);
    case 'areas-navigation': return areasNavigationSettings(s);
    case 'data': return dataSettings(p);
    case 'calendars': return googleCalendarSettingsPanel();
    case 'account': return accountSettings(s);
    default: return profileSettings(s);
  }
}
function unsavedSettingsBanner() {
  const hasProfile = Boolean(ui.profileDraft);
  const hasOtherChanges = settingsDraftDirty();
  const dirty = hasProfile || hasOtherChanges;
  const saving = ui.profileSaving || ui.settingsSaving;
  return h`<div class="settings-unsaved-bar" role="region" aria-label="Alterações não salvas" ${dirty ? '' : raw('hidden')}>
    <span>Alterações não salvas</span>
    <div class="settings-unsaved-actions">
      <button type="button" class="btn back" data-action="profile-discard" ${dirty && !saving ? '' : raw('disabled')}>Descartar alterações</button>
      <button type="button" class="btn primary" data-action="profile-save" aria-busy="${String(saving)}" ${dirty && !saving ? '' : raw('disabled')}>${saving ? 'Salvando...' : 'Salvar alterações'}</button>
    </div>
  </div>`;
}
function viewConfig() {
  const s = S.settings, p = s.prefs;
  const requestedTab = settingsTabId(ui.settingsTab);
  const selected = SETTINGS_SECTIONS.some(([id]) => id === requestedTab) ? requestedTab : 'profile';
  const content = settingsSectionContent(s, p, selected);
  const menuGroups = SETTINGS_SECTION_GROUPS.map((group) => h`<div class="settings-menu-group"><span class="settings-menu-heading">${group.label}</span>${group.items.map((id) => {
    const section = SETTINGS_SECTIONS.find(([item]) => item === id);
    if (!section) return '';
    const [key, label, ic, description] = section;
    return h`<a class="settings-link" href="/config?section=${encodeURIComponent(key)}" data-action="settings-section" data-settings-tab="${key}" aria-controls="settings-content" ${selected === key ? raw('aria-current="page"') : ''}><span class="settings-link-icon">${icon(ic, 19)}</span><span class="settings-link-copy"><b>${tabLabel(label)}</b><small>${description}</small></span>${icon('chevRight', 16, 'settings-link-arrow')}</a>`;
  })}</div>`);
  return h`${pageTitle('Ajustes')}${settingsStorageNotice(selected)}${unsavedSettingsBanner()}
    <div class="settings-layout">
      <nav class="settings-menu" aria-label="Opções de Ajustes">${menuGroups}</nav>
      <div class="settings-content" id="settings-content">${content}</div>
    </div>`;
}

const ROUTES = { inicio: viewInicio, planejar: viewPlanejar, financas: viewFinancas, ciclo: viewCiclo, habitos: viewHabits, config: viewConfig };

/* ========== Diálogos ========== */
function profileSetupDraft() {
  return {
    step: 0,
    needs: [],
    theme: S.settings.theme,
    originalAreas: { ...S.settings.areas },
    areas: { ...S.settings.areas },
    areaOverrides: {},
  };
}
function profileSetupComplete() {
  return S.settings.onboardingComplete;
}
function openProfileSetup() {
  if (profileSetupComplete() || ui.dlg?.type === 'onboard') return;
  ui.returnDialog = null;
  ui.dlg = createDialog('onboard', profileSetupDraft());
  render();
}
function createDialog(type, d) {
  return { type, d, dirty: false, initial: JSON.stringify(d) };
}
function dialogDraftSnapshot(draft) {
  const value = { ...draft };
  ['confirm', 'confirmClear', 'confirmDel', 'error', 'step'].forEach((key) => { delete value[key]; });
  return JSON.stringify(value);
}
function askDiscardDialog(next = null, onDiscard = null) {
  const previous = ui.dlg;
  ui.dlgPending = { previous, next, onDiscard };
  ui.dlg = createDialog('discard', {});
  render();
}
const dlgOpen = (type, d = {}) => {
  const next = createDialog(type, d);
  if (ui.dlg?.dirty) { askDiscardDialog(next); return; }
  ui.dlg = next;
  // Avisos de confirmação (sem "Desfazer") escondem o título e os campos do diálogo; saem quando um diálogo abre.
  if (ui.toast && !ui.toast.undo && ['success', 'info'].includes(ui.toast.tone)) { clearTimeout(ui.toastT); ui.toast = null; }
  render();
};
function confirmInDialog(message) {
  if (ui.confirmResolver) {
    console.error('Aurora: já existe uma confirmação pendente.');
    return Promise.resolve(false);
  }
  if (ui.dlg?.dirty) {
    console.error('Aurora: não é possível abrir uma confirmação durante uma edição pendente.');
    toast('Salve ou feche a edição antes de confirmar esta ação.');
    return Promise.resolve(false);
  }
  return new Promise((resolve) => {
    ui.confirmPrevious = ui.dlg;
    ui.confirmResolver = resolve;
    ui.dlg = createDialog('confirmation', { message });
    render();
  });
}
function settleDialogConfirmation(confirmed) {
  const resolve = ui.confirmResolver;
  if (!resolve) return;
  ui.confirmResolver = null;
  ui.dlg = ui.confirmPrevious;
  ui.confirmPrevious = null;
  ui.dlgPending = null;
  render();
  resolve(confirmed);
}
const CONFIRMABLE_ACTIONS = new Set([
  'appearance-reset',
  'clear-sample',
  'del-plan',
  'del-task',
  'cyc-clear',
  'cyc-period-delete',
  'goal-del',
  'habit-delete',
  'menu-reset',
]);
function requestActionConfirmation(action, data, title, message, confirmLabel = 'Confirmar') {
  if (!CONFIRMABLE_ACTIONS.has(action)) {
    console.error('Aurora: ação sem confirmação configurada.', action);
    toast('Não foi possível confirmar esta ação.');
    return;
  }
  ui.confirmPrevious = ui.dlg && !ui.dlg.dirty ? ui.dlg : null;
  dlgOpen('action-confirm', { action, data, title, message, confirmLabel });
}
const dlgKeepEditing = () => {
  if (ui.dlg?.type !== 'discard' || !ui.dlgPending) return;
  ui.dlg = ui.dlgPending.previous;
  ui.dlgPending = null;
  render();
};
const dlgDiscardChanges = () => {
  if (ui.dlg?.type !== 'discard') return;
  const pending = ui.dlgPending;
  ui.dlg = pending?.next || null;
  if (pending?.previous?.type === 'onboard') ui.returnDialog = null;
  ui.dlgPending = null;
  render();
  if (pending?.onDiscard) pending.onDiscard();
}
const dlgClose = () => {
  if (ui.dlg?.type === 'account-delete' && ui.dlg.d.pending) return;
  if (ui.dlg?.dirty) { askDiscardDialog(); return; }
  if (ui.dlg?.type === 'onboard') {
    finishOnboard(true);
    return;
  }
  if (ui.dlg?.type === 'area-tutorial') {
    ui.dlg = null;
    ui.dlgPending = null;
    render();
    return;
  }
  if (ui.dlg?.type === 'confirmation') {
    settleDialogConfirmation(false);
    return;
  }
  if (ui.dlg?.type === 'action-confirm') {
    ui.dlg = ui.confirmPrevious;
    ui.confirmPrevious = null;
    render();
    return;
  }
  if (ui.dlg?.type === 'discard') { dlgKeepEditing(); return; }
  ui.dlg = null;
  ui.dlgPending = null;
  render();
};
const setPath = (o, p, v) => { const ks = p.split('.'); const last = ks.pop(); const t = ks.reduce((a, k) => a[k], o); t[last] = v; };
const dlgField = (label, inner, cls = '') => h`<label class="f ${cls}"><span class="f-label">${label}</span>${inner}</label>`;
const dlgWrap = (body, foot, bodyClass = '') => h`<div class="dlg-body ${bodyClass}">${body}</div><div class="dlg-foot">${foot}</div>`;
const closeBtn = h`<button type="button" class="ibtn dlg-close" data-action="dlg-close" aria-label="Fechar">${icon('close', 20)}</button>`;

function dlgActionConfirm() {
  const d = ui.dlg.d;
  return dlgWrap(h`<div class="head confirmation-heading"><span class="confirmation-mark" aria-hidden="true">${icon('alert', 22)}</span><div><p class="confirmation-eyebrow">Confirmação necessária</p><h2 id="dt">${d.title}<i>.</i></h2></div>${closeBtn}</div>
    <p class="confirmation-copy">${d.message}</p>
    <aside class="confirmation-note" role="alert">${icon('alert', 18)}<span><b>A ação só será executada depois que você confirmar.</b></span></aside>`,
    h`<button type="button" class="btn back" data-action="action-confirm-cancel">Cancelar</button><button type="button" class="btn danger" data-action="action-confirm-accept">${d.confirmLabel}</button>`);
}
function dlgConfirmation() {
  const d = ui.dlg.d;
  return dlgWrap(h`<div class="head confirmation-heading"><span class="confirmation-mark" aria-hidden="true">${icon('alert', 22)}</span><div><p class="confirmation-eyebrow">Confirmação necessária</p><h2 id="dt">Continuar?</h2></div>${closeBtn}</div>
    <p class="confirmation-copy">${d.message}</p>`,
    h`<button type="button" class="btn back" data-action="confirmation-cancel">Cancelar</button><button type="button" class="btn primary" data-action="confirmation-accept">Continuar</button>`);
}
function dlgReleaseNotes() {
  const notes = getReleaseNotes();
  return dlgWrap(h`<div class="release-notes-heading"><p class="release-notes-version">Atualização do Aurora</p><h2 id="dt">${notes.title}<i>.</i></h2></div>
    <p class="release-notes-intro">Veja o que há de novo nesta versão do Aurora.</p>
    <ul class="release-notes-list">${notes.items.map((item) => h`<li><strong>${item.title}</strong>${item.description ? h`<p>${item.description}</p>` : ''}</li>`)}</ul>`,
  h`<button type="button" class="btn primary" data-action="dlg-close">Entendi</button>`, 'release-notes-dialog');
}
function dlgTask() {
  const d = ui.dlg.d, subs = d.subs || [], creating = d.create === true;
  return dlgWrap(h`<div class="head task-dialog-head"><span class="task-dialog-mark" aria-hidden="true">${icon(creating ? 'plus' : 'check', 20)}</span><div><p class="task-dialog-eyebrow">${creating ? 'planejamento completo' : 'organize os detalhes'}</p><h2 id="dt">${creating ? 'Nova tarefa' : 'Editar tarefa'}<i>.</i></h2></div>${closeBtn}</div>
    <form id="dlgform" class="form task-form" data-form="dlg-task" novalidate>${dlgField('Título', h`<input id="f0" type="text" data-dlg="title" value="${d.title}" maxlength="120" required placeholder="O que você precisa fazer?">`, 'full task-title-field')}
      <fieldset class="task-icon-field full"><legend>Ícone <span>(opcional)</span></legend><div class="task-icon-picker">
        <label title="Sem ícone"><input type="radio" name="task-icon" value="" data-dlg="icon" ${!taskIconKey(d.icon) ? raw('checked') : ''}><span>${icon('close', 18)}<i class="sr">Sem ícone</i></span></label>
        ${TASK_ICONS.map(([key, label]) => h`<label title="${label}"><input type="radio" name="task-icon" value="${key}" data-dlg="icon" aria-label="${label}" ${taskIconKey(d.icon) === key ? raw('checked') : ''}><span>${icon(key, 20)}<i class="sr">${label}</i></span></label>`)}
      </div></fieldset>
      ${dlgField('Prazo', h`<input type="date" data-dlg="due" value="${d.due}">`)}${dlgField('Hora', h`<input class="task-time-input" type="time" data-dlg="time" value="${d.time || ''}">`)}
      ${dlgField('Repetir', h`<select data-dlg="repeat">${Object.entries(REPEATS).map(([k, v]) => h`<option value="${k}" ${k === (d.repeat || 'none') ? raw('selected') : ''}>${v}</option>`)}</select>`)}
      ${dlgField('Lembrete', h`<select data-dlg="remind" ${d.time ? '' : raw('disabled')}>${REMINDS.map(([k, v]) => h`<option value="${k}" ${String(d.remind == null ? '' : d.remind) === k ? raw('selected') : ''}>${v}</option>`)}</select>${d.time ? '' : h`<span class="task-field-help">Escolha uma hora para ativar.</span>`}`)}
      ${dlgField('Prioridade', h`<select data-dlg="priority">${prioOptions(d.priority)}</select>`)}
      <details class="task-notes full" ${d.notes ? raw('open') : ''}><summary><span>Adicionar notas</span><span>opcional</span><span class="task-notes-disclosure" aria-hidden="true">${icon('chevDown', 16)}</span></summary><textarea data-dlg="notes" rows="3" maxlength="2000" placeholder="Detalhes, links, o que lembrar…">${d.notes || ''}</textarea></details></form>
    <div class="f"><span class="lbl">Etiquetas</span>
      ${(d.tags || []).length ? h`<div class="chips">${d.tags.map((g, i) => h`<span class="chip on tgchip">#${g}<button type="button" class="ibtn" data-action="tg-del" data-i="${i}" aria-label="Remover etiqueta ${g}">${icon('close', 14)}</button></span>`)}</div>` : ''}
      <form class="aibar" data-form="tg-add"><label class="sr" for="tgn">Nova etiqueta</label><input type="text" id="tgn" name="tg" maxlength="24" placeholder="Adicionar etiqueta" autocomplete="off"><button class="btn sm" type="submit">${icon('plus', 16)}Adicionar</button></form>
      ${allTags().filter((g) => !(d.tags || []).includes(g)).length ? h`<div class="chips">${allTags().filter((g) => !(d.tags || []).includes(g)).slice(0, 8).map((g) => h`<button type="button" class="chip" data-action="tg-pick" data-v="${g}">#${g}</button>`)}</div>` : ''}</div>
    <div class="f"><span class="lbl">Subtarefas${subs.length ? ` (${subs.filter((x) => x.done).length}/${subs.length})` : ''}</span>
      ${subs.length ? h`<ul class="list tight subl">${subs.map((x, i) => h`<li><button type="button" class="chk" role="checkbox" aria-checked="${!!x.done}" aria-label="${x.done ? 'Reabrir' : 'Concluir'}: ${x.title}" data-action="st-toggle" data-i="${i}"><span>${icon('check', 15)}</span></button><span class="grow ${x.done ? 'st-done' : ''}">${x.title}</span><button type="button" class="ibtn" data-action="st-del" data-i="${i}" aria-label="Remover ${x.title}">${icon('close', 18)}</button></li>`)}</ul>` : ''}
      <form class="aibar" data-form="st-add"><label class="sr" for="stn">Nova subtarefa</label><input type="text" id="stn" name="st" maxlength="100" placeholder="Adicionar subtarefa" autocomplete="off"><button class="btn sm" type="submit">${icon('plus', 16)}Adicionar</button></form></div>`,
    creating
      ? h`<button type="button" class="btn back" data-action="dlg-close">Cancelar</button><button class="btn primary" type="submit" form="dlgform">Adicionar tarefa</button>`
      : h`<button type="button" class="btn danger back" data-action="del-task-dlg" aria-label="Excluir tarefa">${icon('trash', 18)}</button><button type="button" class="btn back" data-action="dlg-close">Cancelar</button><button class="btn primary" type="submit" form="dlgform">Salvar</button>`,
    'task-dialog');
}
const cycleDialogViews = createCycleDialogViews({
  ui, CYC, CYC_ICON, CYC_OPTION_ICON, CYC_SHORT_LABEL, CYCLE_CONTRACEPTION_METHODS, topSymptoms, plural,
  cycLabel, dlgWrap, closeBtn, dlgField, today, MAX_CYCLE_PERIOD_DAYS,
});
function dlgCycleLog() { return cycleDialogViews.log(); }
function dlgCyclePeriod() { return cycleDialogViews.period(); }
function dlgHabitEdit() {
  const d = ui.dlg.d, edit = Boolean(d.id), habit = edit ? S.habits.find((item) => item.id === d.id) : null;
  const waterHabit = Boolean(d.waterSuggestion || isWaterHabit(habit));
  const waterGoal = d.waterGoalMl ?? (habit ? waterGoalForHabit(habit, S.settings.prefs.waterGoalMl) : S.settings.prefs.waterGoalMl);
  return dlgWrap(h`<div class="head head-nowrap"><div><h2 id="dt">${edit ? 'Editar hábito' : 'Novo hábito'}<i>.</i></h2><p class="small muted">${edit ? 'Ajuste os dias e o lembrete deste hábito.' : 'Escolha um nome e os dias em que quer acompanhar.'}</p></div>${closeBtn}</div>
    ${d.suggestionDescription ? h`<p class="habit-idea-detail fine">${d.suggestionDescription}</p>` : ''}
    <form id="dlgform" class="form" data-form="habit-edit" novalidate>
      <label class="f full">Nome<input id="f0" name="name" type="text" data-dlg="name" value="${d.name}" maxlength="60" required autocomplete="off" placeholder="Ex.: Ler por 10 minutos"></label>
      ${waterHabit ? h`${d.waterSuggestion ? h`<label class="f full">Peso para estimativa
        <span class="water-weight-input"><input id="water-weight-kg" name="waterWeightKg" type="text" data-dlg="waterWeightKg" inputmode="decimal" autocomplete="off" maxlength="6" value="${d.waterWeightKg || ''}" aria-describedby="water-weight-help" placeholder="Ex.: 65,5"><span aria-hidden="true">kg</span></span>
        <span class="profile-field-help" id="water-weight-help">De 20 a 400 kg. Esse peso será usado somente para calcular uma sugestão e não será salvo no perfil.</span></label>
        <p class="fine full" id="water-goal-preview" aria-live="polite">${waterSuggestionPreview(d.waterWeightKg || '')}</p>` : ''}
        <label class="f full" for="water-goal-ml">Meta diária de água (mL)<input id="water-goal-ml" name="waterGoalMl" type="number" data-dlg="waterGoalMl" min="500" max="10000" step="50" value="${waterGoal}" required aria-describedby="water-goal-help"><span class="profile-field-help" id="water-goal-help">É uma referência ajustável, não uma recomendação médica. Registre os volumes para acompanhar o dia.</span></label>
        ${d.waterSuggestion ? h`<p class="fine full">A estimativa considera a idade informada em Ajustes (ou uma referência adulta) e o peso informado acima. Você pode ajustar a meta. Ao atingir o volume, o check-in do dia é concluído.</p>` : ''}` : ''}
      <fieldset class="habit-look full"><legend>Ícone</legend><div class="habit-icon-picker">${HABIT_ICONS.map(([key, label]) => h`<label title="${label}"><input type="radio" name="icon" value="${key}" data-dlg="icon" ${(d.icon || DEFAULT_HABIT_ICON) === key ? raw('checked') : ''}><span>${icon(key, 20)}<i class="sr">${label}</i></span></label>`)}</div></fieldset>
      <fieldset class="habit-look full"><legend>Cor</legend><div class="habit-color-picker">${HABIT_COLORS.map((color, index) => h`<label title="${HABIT_COLOR_NAMES[index]}"><input type="radio" name="color" value="${color}" data-dlg="color" ${(d.color || DEFAULT_HABIT_COLOR).toLowerCase() === color ? raw('checked') : ''}><span style="--c:${color}"><i class="sr">${HABIT_COLOR_NAMES[index]}</i>${icon('check', 16)}</span></label>`)}</div></fieldset>
      <fieldset class="habit-schedule full"><legend>Em quais dias?</legend><div class="habit-weekday-picker">${DIAS.map((day, index) => h`<label class="${index === pk(today()).getDay() ? 'is-today' : ''}"><input type="checkbox" name="days" value="${index}" ${d.days.includes(index) ? raw('checked') : ''}><span>${day}</span></label>`)}</div></fieldset>
      <label class="f full">Meta na semana (opcional)<select name="weeklyGoal"><option value="" ${d.weeklyGoal ? '' : raw('selected')}>Todos os dias marcados</option>${[1, 2, 3, 4, 5, 6, 7].map((n) => h`<option value="${n}" ${Number(d.weeklyGoal) === n ? raw('selected') : ''}>${n} ${plural(n, 'vez', 'vezes')} por semana</option>`)}</select><span class="small muted">Com meta, a semana conta como cumprida ao atingir esse número de dias, mesmo sem marcar todos.</span></label>
      <label class="f full">Horário do lembrete (opcional)<input type="time" name="remind" data-dlg="remind" value="${d.remind || ''}"><span class="small muted">É uma preferência; avisos fora do app são opcionais e exigem autorização nas permissões do navegador.</span></label>
    </form>
    ${habit ? h`<div class="habit-edit-history">${habitMonthlyHistory(habit)}</div>` : ''}`,
    h`${edit ? h`<button type="button" class="btn danger back" data-action="habit-delete-dialog">${icon('trash', 18)}Excluir</button><button type="button" class="btn back" data-action="${habit?.status === 'archived' ? 'habit-restore' : 'habit-archive'}" data-id="${d.id}">${habit?.status === 'archived' ? 'Restaurar' : 'Arquivar'}</button>` : h`<button class="btn back" data-action="dlg-close">Cancelar</button>`}<button class="btn primary" type="submit" form="dlgform">${edit ? 'Salvar alterações' : 'Adicionar hábito'}</button>`);
}
function waterSuggestionPreview(weightInput) {
  const text = String(weightInput ?? '').trim();
  if (!text) return 'Informe seu peso para calcular uma meta de referência.';
  const weightKg = parseWaterWeightKg(text);
  if (weightKg === null) return 'Informe um peso entre 20 e 400 kg para calcular a meta.';
  const age = currentProfileAge(S.settings);
  const goal = estimateWaterGoal({ weightKg, age });
  const ageText = age == null ? 'a referência adulta (idade não informada)' : `a idade de ${age} anos`;
  return `Estimativa: ${goal.ml.toLocaleString('pt-BR')} mL, considerando ${ageText} e ${weightKg.toLocaleString('pt-BR')} kg. Você pode ajustar a meta abaixo.`;
}
function updateWaterSuggestionWeight(weightInput) {
  const draft = ui.dlg?.d;
  if (!draft?.waterSuggestion) return;
  const weightKg = parseWaterWeightKg(weightInput);
  const goal = weightKg === null
    ? null
    : estimateWaterGoal({ weightKg, age: currentProfileAge(S.settings) });
  if (!draft.waterGoalEdited && goal) draft.waterGoalMl = goal.ml;
  const preview = $('#water-goal-preview');
  if (preview) preview.textContent = waterSuggestionPreview(weightInput);
  const goalInput = $('#water-goal-ml');
  if (goalInput && !draft.waterGoalEdited && goal) goalInput.value = String(goal.ml);
}
function globalSearchResults(query) {
  const searchAreas = canAccessCycle(S.settings.profile, ui.preview)
    ? 'Planejar, Hábitos, Finanças e Ciclo'
    : 'Planejar, Hábitos e Finanças';
  const searchableCycleLogs = areaOn('cycle')
    ? Object.fromEntries(Object.entries(S.cycleLog).map(([date, value]) => {
      const log = value && typeof value === 'object' ? value : {};
      const searchText = CYC.flatMap(({ id, title }) => {
        const rawValue = log[id];
        const values = Array.isArray(rawValue) ? rawValue : rawValue ? [rawValue] : [];
        return [title, ...values.map((entry) => cycLabel(id, entry))];
      }).join(' ');
      return [date, { ...log, searchText: `${searchText}${isBleeding(log) ? ' menstruação fluxo menstrual' : ''}` }];
    }))
    : {};
  const results = searchRecords({
    tasks: S.tasks,
    transactions: S.finance.tx,
    accounts: S.finance.accounts,
    habits: areaOn('habits') ? S.habits : [],
    water: [],
    cycleLogs: searchableCycleLogs,
  }, query);
  if (String(query).trim().length < 2) return h`<p class="small muted">Digite pelo menos duas letras para buscar em ${searchAreas}.</p>`;
  if (!results.length) return empty('Nenhum resultado', 'Tente outro nome, categoria ou descrição.', '', 'search');
  const resultIcons = { task: 'check', transaction: 'wallet', habit: 'sparkles', cycle: 'heart' };
  const groups = [...results.reduce((map, item) => {
    if (!map.has(item.area)) map.set(item.area, []);
    map.get(item.area).push(item);
    return map;
  }, new Map())];
  return h`<div class="global-search-results">${groups.map(([area, items]) => h`<section class="global-search-group" aria-label="Resultados em ${area}"><h3>${area}<span>${items.length}</span></h3><ul class="list">${items.map((item) => h`<li><button type="button" class="global-search-result" data-action="search-result" data-kind="${item.kind}" data-id="${item.id}"><span class="global-search-kind">${icon(resultIcons[item.kind] || 'search', 16)}</span><span class="grow"><b class="ttl">${item.title}</b><small class="small muted">${item.detail || item.kind}</small></span>${icon('chevRight', 16)}</button></li>`)}</ul></section>`)}</div>`;
}
function dlgSearch() {
  const query = ui.dlg.d.query || '';
  const searchAreas = canAccessCycle(S.settings.profile, ui.preview)
    ? 'Planejar, Hábitos, Finanças e Ciclo'
    : 'Planejar, Hábitos e Finanças';
  return dlgWrap(h`<div class="head global-search-head"><div><h2 id="dt">Buscar no Aurora<i>.</i></h2><p class="small muted">${searchAreas}</p></div>${closeBtn}</div>
    <label class="search global-search-input"><span class="sr">Buscar em todas as áreas</span>${icon('search', 18)}<input id="f0" type="search" data-dlg="query" value="${query}" placeholder="Tarefa, hábito, conta ou descrição" autocomplete="off"></label>
    <div id="global-search-results" aria-live="polite">${globalSearchResults(query)}</div>`,
    h`    <span class="small muted">Atalho: Ctrl+K ou ⌘K · Esc para fechar</span><button class="btn back" data-action="dlg-close">Fechar</button>`);
}
function dlgWipe() {
  return dlgWrap(h`<div class="head destructive-heading"><span class="destructive-mark" aria-hidden="true">${icon('alert', 22)}</span><div><p class="destructive-eyebrow">Ação permanente</p><h2 id="dt">Apagar dados relacionais?</h2></div>${closeBtn}</div>
    <div class="destructive-summary"><p class="destructive-copy">Isso apaga permanentemente os dados relacionais desta conta. Dados antigos de outras áreas ainda não importados serão preservados para a migração.</p>
    <aside class="destructive-note" role="alert">${icon('alert', 18)}<span><b>Faça um backup antes</b><small>Exporte uma cópia agora se quiser guardar seus dados.</small></span></aside></div>`,
    h`<button type="button" class="btn back" data-action="dlg-close">Cancelar e manter dados</button><button type="button" class="btn danger" data-action="wipe">Apagar permanentemente</button>`,
    'destructive-dialog');
}
function dlgWipeComplete() {
  const warning = ui.dlg.d.warning;
  return dlgWrap(h`<div class="wipe-complete"><span class="wipe-complete-mark" aria-hidden="true">${icon(warning ? 'alert' : 'check', 24)}</span><div class="wiz-h"><span class="eyebrow">${warning ? 'Ação parcial' : 'Tudo pronto'}</span><h2 id="dt">Seus dados relacionais foram apagados<i>.</i></h2><p>${warning || 'Os registros legados ainda não importados foram preservados. Você permanece conectado à sua conta e pode começar novamente.'}</p></div></div>`,
    h`<button type="button" class="btn primary" data-action="wipe-home">Ir para o Início</button>`,
    'wipe-complete-dialog');
}

/* ---- Personalização inicial ---- */
const ONBOARDING_NEEDS = [
  { id: 'organization', icon: 'calendarCheck', title: 'Organizar meu dia', description: 'Tarefas, prazos e prioridades.', areas: [] },
  { id: 'habits', icon: 'check', title: 'Criar bons hábitos', description: 'Água, leitura, movimento e outros hábitos.', areas: ['habits'] },
  { id: 'finances', icon: 'wallet', title: 'Organizar meu dinheiro', description: 'Receitas, gastos e objetivos.', areas: ['finances'] },
  { id: 'cycle', icon: 'heart', title: 'Acompanhar meu ciclo', description: 'Registrar sinais e consultar estimativas.', areas: ['cycle'] },
];
const ONBOARDING_AREAS = [
  { id: 'habits', icon: 'check', title: 'Hábitos', description: 'Crie uma rotina e acompanhe sua constância.' },
  { id: 'finances', icon: 'wallet', title: 'Finanças', description: 'Organize contas, gastos, receitas e objetivos.' },
  { id: 'cycle', icon: 'heart', title: 'Ciclo', description: 'Registre sinais e acompanhe estimativas do ciclo.' },
];
function refreshOnboardingRecommendations(draft) {
  const recommended = new Set(ONBOARDING_NEEDS
    .filter((need) => draft.needs.includes(need.id))
    .flatMap((need) => need.areas));
  draft.recommendedAreas = [...recommended];
  draft.areas = { ...draft.originalAreas };
  recommended.forEach((area) => { draft.areas[area] = true; });
  Object.entries(draft.areaOverrides).forEach(([area, enabled]) => {
    draft.areas[area] = enabled;
  });
}
function dlgOnboard() {
  const d = ui.dlg.d, st = d.step;
  const onboardingNeeds = ONBOARDING_NEEDS.filter((need) => need.id !== 'cycle' || canAccessCycle(S.settings.profile, ui.preview));
  const onboardingAreas = ONBOARDING_AREAS.filter((area) => area.id !== 'cycle' || canAccessCycle(S.settings.profile, ui.preview));
  const dots = h`<div class="steps" aria-label="Passo ${st + 1} de 3">${[0, 1, 2].map((i) => h`<i class="${i <= st ? 'on' : ''}"></i>`)}</div>`;
  let body, foot;
  if (st === 0) {
    body = h`${dots}<div class="onboard-intro"><span class="onboard-brand">${brandIcon(52)}</span><div class="wiz-h"><span class="eyebrow">Personalização inicial</span><h2 id="dt">O que você quer melhorar no seu dia a dia?</h2><p>Escolha uma ou mais opções; você pode mudar depois.</p></div></div>
      <fieldset class="onboard-fieldset"><legend>Escolha o que faz sentido para você agora.</legend><div class="onboard-options">${onboardingNeeds.map((need) => h`<button type="button" class="opt" aria-pressed="${d.needs.includes(need.id)}" data-action="ob-need" data-v="${need.id}"><span class="mk">${icon(need.icon, 22)}</span><span class="tx"><b>${need.title}</b><span>${need.description}</span></span><span class="tick">${icon('check', 15)}</span></button>`)}</div></fieldset>
      <p class="fine">${icon('info', 15)} Suas tarefas e seu planejamento já ficam disponíveis; não é preciso ativar uma área para começar a se organizar.</p>`;
    foot = h`<button class="btn back" data-action="ob-skip">Pular personalização</button><button class="btn primary" data-action="ob-next">Ver sugestões</button>`;
  } else if (st === 1) {
    const solutionIds = onboardingAreas.filter((area) => d.areas[area.id] || d.recommendedAreas.includes(area.id));
    const hasOrganizationNeed = d.needs.includes('organization');
    body = h`${dots}<div class="wiz-h"><h2 id="dt">Estas ferramentas podem ajudar<i>.</i></h2><p>Ativamos as sugestões a partir das suas respostas. Desmarque o que não quiser usar agora.</p></div>
      ${hasOrganizationNeed ? h`<article class="onboard-solution-note"><span class="mk">${icon('calendarCheck', 22)}</span><span class="tx"><b>Planejar</b><span>Tarefas, prazos e prioridades já estão disponíveis para organizar seu dia.</span></span><span class="onboard-always-on">Sempre disponível</span></article>` : ''}
      ${solutionIds.length ? h`<fieldset class="onboard-fieldset"><legend>Áreas do Aurora</legend><div class="onboard-solution-list">${solutionIds.map((area) => h`<button type="button" class="opt onboard-solution" aria-pressed="${!!d.areas[area.id]}" data-action="ob-area" data-v="${area.id}"><span class="mk">${icon(area.icon, 22)}</span><span class="tx"><b>${area.title}</b><span>${area.description}</span><small>${d.recommendedAreas.includes(area.id) ? 'Sugestão baseada nas suas respostas' : 'Já estava ativa na sua conta'}</small></span><span class="tick">${icon('check', 15)}</span></button>`)}</div></fieldset>` : h`<p class="notice">${icon('sparkles', 18)}<span>Nenhuma área adicional selecionada. Você pode ativá-las quando quiser em Ajustes.</span></p>`}
      <p class="fine">${icon('info', 15)} Você pode mudar essas escolhas depois em Ajustes → Áreas e navegação.</p>`;
    foot = h`<button class="btn back" data-action="ob-skip">Pular personalização</button><button class="btn back" data-action="ob-back">Voltar</button><button class="btn primary" data-action="ob-next">Continuar</button>`;
  } else {
    body = h`${dots}<div class="wiz-h"><h2 id="dt">Deixe o Aurora com a sua cara<i>.</i></h2><p>Essas opções são opcionais e você pode alterá-las depois em Ajustes.</p></div>
      <div class="onboard-theme"><span class="f-label">Cor do app</span><div class="swatches">${Object.entries(PALETTES).map(([key, [name, color]]) => h`<button type="button" class="swatch" aria-pressed="${d.theme === key}" data-action="ob-theme" data-v="${key}"><i style="background:${color}"></i>${name}</button>`)}</div></div>`;
    foot = h`<button class="btn back" data-action="ob-skip">Pular personalização</button><button class="btn back" data-action="ob-back">Voltar</button><button class="btn primary" data-action="ob-finish">Concluir</button>`;
  }
  return dlgWrap(body, foot, st === 0 ? 'onboard-needs-dialog' : '');
}
function dlgExport() {
  if (Object.keys(ui.integrityIssues).length) {
    return dlgWrap(h`<div class="head head-nowrap"><h2 id="dt">Backup indisponível<i>.</i></h2>${closeBtn}</div><p class="notice warn" role="alert">Há fatias locais inválidas. Baixe uma cópia bruta ou importe um backup confiável antes de criar um backup normalizado.</p>`,
      h`<button class="btn" data-action="recovery-export">Baixar cópia de recuperação</button><button class="btn back" data-action="dlg-close">Fechar</button>`);
  }
  return dlgWrap(h`<div class="head head-nowrap"><h2 id="dt">${ui.dlg.d.kind === 'csv' ? 'Seus lançamentos' : 'Seu backup'}<i>.</i></h2>${closeBtn}</div>
    <p class="small muted">${ui.dlg.d.kind === 'csv' ? 'O download direto não está disponível aqui. Copie o texto e salve em um arquivo .csv.' : 'O download direto não está disponível aqui. Copie o conteúdo e salve em um arquivo de backup para importar depois.'}</p>
    <textarea id="exp" readonly rows="8" style="font-family:ui-monospace,monospace;font-size:.75rem">${ui.dlg.d.json}</textarea>`,
    h`<button class="btn back" data-action="dlg-close">Fechar</button><button class="btn primary" data-action="copy-export">Copiar</button>`);
}
function dlgImport() {
  const p = ui.dlg.d.parsed;
  return dlgWrap(h`<div class="head"><div><h2 id="dt">Importar este backup?</h2><p class="small muted">Prévia do conteúdo validado deste arquivo:</p></div>${closeBtn}</div>
    <ul class="backup-preview">
      <li><span>Tarefas</span><b>${p.tasks.length}</b></li>
      <li><span>Hábitos e contas financeiras</span><b>${p.habits.length} · ${p.finance.accounts.length}</b></li>
      <li><span>Lançamentos financeiros</span><b>${p.finance.tx.length}</b></li>
      <li><span>Registros de hidratação e dias de ciclo</span><b>${p.water.length} · ${Object.keys(p.cycleLog).length}</b></li>
    </ul>
    <div class="notice warn" role="alert">${icon('alert', 18)}<span>Ao confirmar, todos os dados relacionais atuais desta conta serão substituídos pelo conteúdo do backup. Para manter os dados atuais, exporte um backup antes.</span></div>`,
    h`<button class="btn back" data-action="dlg-close">Cancelar</button><button class="btn primary" data-action="import-apply">Substituir meus dados</button>`);
}
function dlgAreaTutorial() {
  const guide = AREA_GUIDES[ui.dlg.d.route];
  if (!guide) return dlgWrap(h`<div class="head"><h2 id="dt">Tutorial indisponível<i>.</i></h2>${closeBtn}</div><p role="alert">Não foi possível localizar o tutorial desta área.</p>`,
    h`<button class="btn back" data-action="dlg-close">Fechar</button>`);
  return dlgWrap(h`<div class="head area-tutorial-head"><div><p class="section-kicker">Tutorial em vídeo</p><h2 id="dt">Como usar ${guide.title}<i>.</i></h2></div>${closeBtn}</div>
    <p class="area-tutorial-intro">${guide.summary}</p>
    <video class="area-tutorial-video" controls playsinline preload="metadata" aria-label="Tutorial em vídeo: ${guide.title}">
      <source src="${guide.video}" type="video/webm">
      <source src="${guide.fallbackVideo}" type="video/mp4">
      Seu navegador não consegue reproduzir este vídeo.
    </video>
    <p class="area-tutorial-caption">Vídeo sem narração, com orientações na tela. Se preferir, abra o roteiro abaixo.</p>
    <details class="area-tutorial-script"><summary>Ver roteiro do vídeo${icon('chevDown', 16, 'tutorial-disclosure-indicator')}</summary><ol>${guide.steps.map((step) => h`<li><strong>${step.title}</strong> — ${step.text}</li>`)}</ol>${guide.note ? h`<p>${guide.note}</p>` : ''}</details>`,
    h`<button class="btn back" data-action="dlg-close">Fechar</button>`,
    'area-tutorial-body');
}
function listArr(g) { return S.settings.cats[g]; }
function findCategory(g, name, parentName = '') {
  const categories = listArr(g);
  if (parentName) {
    const parent = categories.find((category) => norm(category.name) === norm(parentName));
    return parent?.subcategories?.find((category) => norm(categoryLeafName(category)) === norm(name)) || null;
  }
  return categories.find((category) => norm(category.name) === norm(name)) || null;
}
function addItem(g, name, parentName = '', color = '', iconName = '') {
  const arr = listArr(g), value = String(name || '').trim().slice(0, 30);
  if (!value) return '';
  const parent = String(parentName || '').trim();
  if (parent) {
    const parentEntry = arr.find((category) => norm(category.name) === norm(parent));
    if (parentEntry) {
      const subcategories = Array.isArray(parentEntry.subcategories) ? parentEntry.subcategories : [];
      const existing = subcategories.find((category) => norm(categoryLeafName(category)) === norm(value));
      if (existing) return `${parentEntry.name} > ${categoryLeafName(existing)}`;
      parentEntry.subcategories = [...subcategories, {
        name: value,
        color: hexOk(color) ? color : parentEntry.color,
        icon: CAT_ICONS.includes(iconName) ? iconName : parentEntry.icon,
        subcategories: [],
      }];
      return `${parentEntry.name} > ${value}`;
    }
  }
  const ex = arr.find((category) => norm(category.name) === norm(value));
  if (ex) return ex.name;
  arr.push({
    name: value,
    color: hexOk(color) ? color : LIST_COLORS[arr.length % LIST_COLORS.length],
    icon: CAT_ICONS.includes(iconName) ? iconName : 'tag',
    subcategories: [],
  });
  return value;
}
function replaceCategoryReferences(oldPath, newPath) {
  if (oldPath === newPath) return false;
  if (Object.hasOwn(S.finance.budgets, oldPath) && Object.hasOwn(S.finance.budgets, newPath)) return null;
  let changed = false;
  [S.finance.tx, recList()].forEach((records) => records.forEach((record) => {
    if (record.category === oldPath) {
      record.category = newPath;
      changed = true;
    }
  }));
  if (Object.hasOwn(S.finance.budgets, oldPath)) {
    Object.defineProperty(S.finance.budgets, newPath, {
      value: S.finance.budgets[oldPath],
      enumerable: true,
      writable: true,
      configurable: true,
    });
    delete S.finance.budgets[oldPath];
    changed = true;
  }
  return changed;
}
function resolveNew(g, d, key) {
  if (d[key] !== '__new') return true;
  const n = String(d.newName || '').trim().slice(0, 30);
  if (!n) { toast('Dê um nome para a nova opção.'); return false; }
  const parentName = String(d.newParent || '').trim();
  d[key] = addItem(g, n, parentName, d.newColor, d.newIcon);
  d.newName = ''; d.newParent = ''; d.newColor = ''; d.newIcon = ''; commit('settings'); return true;
}
const DLG = { task: dlgTask, tx: dlgTx, 'cycle-log': dlgCycleLog, 'cycle-period': dlgCyclePeriod, 'habit-edit': dlgHabitEdit, search: dlgSearch, 'action-confirm': dlgActionConfirm, confirmation: dlgConfirmation, 'release-notes': dlgReleaseNotes, wipe: dlgWipe, 'wipe-complete': dlgWipeComplete, onboard: dlgOnboard, 'area-tutorial': dlgAreaTutorial, export: dlgExport, import: dlgImport };
DLG.discard = () => dlgWrap(h`<div class="head"><div><h2 id="dt">Descartar alterações?<i>.</i></h2><p class="small muted">Há alterações que ainda não foram salvas. Se sair agora, elas serão perdidas.</p></div></div>`,
  h`<button type="button" class="btn" data-action="dlg-keep">Continuar editando</button><button type="button" class="btn danger" data-action="dlg-discard">Descartar alterações</button>`);

/* Ajusta a camada do diálogo à área visível quando o teclado está aberto.
   Sem teclado ela ocupa a tela toda (inset: 0), sem depender de visualViewport. Com teclado, só a altura e o topo
   seguem a área visível; a largura nunca muda (o deslocamento horizontal do iOS fazia o painel andar para os lados),
   e as mudanças são agrupadas para o painel não acompanhar a animação do teclado quadro a quadro. */
let fitTimer = 0;
let releaseDialogScroll = null;
let dialogHistoryEntry = false;
let dialogHistoryScrollPosition = null;
function restoreDialogHistoryScroll(position) {
  if (!position) return;
  requestAnimationFrame(() => {
    window.scrollTo({ left: position.left, top: position.top, behavior: 'instant' });
  });
}
function applyFitDlg() {
  const el = $('#dlg'), v = window.visualViewport; if (!el) return;
  const keyboard = v && window.innerHeight - v.height > 120;
  if (!keyboard) {
    Object.assign(el.style, { inset: '0', left: '', right: '', top: '', width: '', height: '' });
    el.style.removeProperty('--dialog-available-height');
    return;
  }
  const height = Math.round(v.height);
  Object.assign(el.style, { inset: 'auto', left: '0', right: '0', width: 'auto', top: `${Math.max(0, Math.round(v.offsetTop))}px`, height: `${height}px` });
  el.style.setProperty('--dialog-available-height', `${height}px`);
}
function fitDlg() { applyFitDlg(); }
function fitDlgSoon() { clearTimeout(fitTimer); fitTimer = setTimeout(applyFitDlg, 90); }
if (window.visualViewport) visualViewport.addEventListener('resize', fitDlgSoon);
window.addEventListener('resize', fitDlgSoon);
let keyboardFocusTarget = null;
function keepKeyboardControlVisible() {
  const viewport = window.visualViewport;
  const target = keyboardFocusTarget;
  if (!viewport || !target?.isConnected || window.innerHeight - viewport.height <= 120) return;
  requestAnimationFrame(() => {
    if (!target.isConnected) return;
    const bounds = target.getBoundingClientRect();
    const top = viewport.offsetTop + 12;
    const bottom = viewport.offsetTop + viewport.height - 16;
    if (bounds.top < top || bounds.bottom > bottom) {
      target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
    }
  });
}
document.addEventListener('focusin', (event) => {
  const target = event.target;
  keyboardFocusTarget = target instanceof HTMLElement
    && target.matches('#app input:not([type="checkbox"], [type="radio"], [type="button"], [type="submit"], [type="range"], [type="color"]), #app textarea, #app select, #dlg input:not([type="checkbox"], [type="radio"], [type="button"], [type="submit"], [type="range"], [type="color"]), #dlg textarea, #dlg select')
    ? target
    : null;
  keepKeyboardControlVisible();
});
document.addEventListener('focusout', (event) => {
  if (event.target === keyboardFocusTarget) keyboardFocusTarget = null;
});
if (window.visualViewport) visualViewport.addEventListener('resize', keepKeyboardControlVisible);
window.addEventListener('popstate', (event) => {
  if (!dialogHistoryEntry || event.state?.auroraDialog === true) return;
  dialogHistoryEntry = false;
  const scrollPosition = dialogHistoryScrollPosition;
  dialogHistoryScrollPosition = null;
  if (ui.dlg) {
    ui.dlg = null;
    render();
  }
  restoreDialogHistoryScroll(scrollPosition);
});
function renderDialog() {
  let el = $('#dlg');
  if (ui.dlg && ui.dlg.type === 'onboard' && profileSetupComplete()) ui.dlg = null;
  if (!ui.dlg) {
    if (dialogHistoryEntry) {
      dialogHistoryEntry = false;
      const scrollPosition = dialogHistoryScrollPosition;
      dialogHistoryScrollPosition = null;
      if (scrollPosition) {
        window.addEventListener('popstate', () => restoreDialogHistoryScroll(scrollPosition), { once: true });
      }
      history.back();
    }
    if (el) {
      el.remove();
      $('#app').inert = false;
      const lf = ui.lastFocus;
      ui.lastFocus = null;
      restoreDialogOpener(lf);
    }
    releaseDialogScroll?.();
    releaseDialogScroll = null;
    return;
  }
  if (!dialogHistoryEntry) {
    const state = history.state && typeof history.state === 'object' ? history.state : {};
    dialogHistoryScrollPosition = getPageScrollPosition();
    history.pushState({ ...state, auroraDialog: true }, '', location.href);
    dialogHistoryEntry = true;
  }
  const isIntro = ui.dlg.type === 'intro', isCycleLog = ui.dlg.type === 'cycle-log';
  const isCyclePeriod = ui.dlg.type === 'cycle-period';
  const opening = !el, typeChanged = Boolean(el && el.dataset.dialogType !== ui.dlg.type);
  const af = !opening && !typeChanged && document.activeElement && document.activeElement.closest('#dlg') ? document.activeElement : null;
  const afSel = af ? { id: af.id, data: af.dataset.dlg, action: af.dataset.action, v: af.dataset.v, c: af.dataset.c } : null;
  const prevScroll = !opening ? (el.querySelector('.dlg-body') || {}).scrollTop : 0;
  if (opening) { if (!ui.lastFocus) ui.lastFocus = describeDialogOpener(document.activeElement); el = document.createElement('div'); el.id = 'dlg'; el.className = 'dlg-back is-opening'; setTimeout(() => el.classList.remove('is-opening'), 500); document.body.appendChild(el); if (!releaseDialogScroll) releaseDialogScroll = lockPageScroll(); }
  el.classList.toggle('is-intro', isIntro);
  fitDlg();
  el.innerHTML = `<div class="dlg${isIntro ? ' intro-dialog' : ''}${isCycleLog ? ' cycle-log-dialog' : ''}${isCyclePeriod ? ' cycle-period-dialog' : ''}" role="dialog" aria-modal="true" aria-labelledby="dt" tabindex="-1">${DLG[ui.dlg.type]().s}</div>`;
  el.dataset.dialogType = ui.dlg.type;
  $('#app').inert = true;
  const body = el.querySelector('.dlg-body'); if (body && prevScroll) body.scrollTop = prevScroll;
  applyTheme(ui.dlg.type === 'onboard' ? ui.dlg.d.theme : undefined);
  let target = null;
  if (afSel) target = (afSel.id && document.getElementById(afSel.id)) || (afSel.data && el.querySelector(`[data-dlg="${afSel.data}"]`)) || (afSel.action && el.querySelector(`[data-action="${afSel.action}"]${afSel.v ? `[data-v="${afSel.v}"]` : ''}${afSel.c ? `[data-c="${afSel.c}"]` : ''}`));
  if (!target) target = (afSel && afSel.action && el.querySelector(`[data-action="${afSel.action}"]${afSel.v ? `[data-v="${afSel.v}"]` : ''}${afSel.c ? `[data-c="${afSel.c}"]` : ''}`)) || el.querySelector('.dlg');
  if ((opening || typeChanged) && !afSel) target = el.querySelector('.dlg');
  if (target) target.focus({ preventScroll: true });
}

/* ========== Ações, formulários, importação/exportação e arranque ========== */
const findTask = (id) => S.tasks.find((t) => t.id === id);
const mkTask = (o) => ({ id: newId(), title: '', done: false, tag: 'Pessoal', dueDate: null, priority: 'normal', createdAt: Date.now(), ...o });
const taskDraft = (due = '') => ({ create: true, title: '', due, time: '', repeat: 'none', remind: '', priority: 'normal', icon: '', tags: [], notes: '', subs: [] });
const openTaskDialog = (due = '') => dlgOpen('task', taskDraft(due));
const toast = setToast;

/* ---- Exemplos ---- */
function loadSample() {
  // Exemplos são uma demonstração única: recarregá-los atualiza o conjunto, nunca duplica dados.
  if (S.settings.prefs.sample) removeSampleData();
  const t = today(), sm = { sample: true };
  S.tasks.push(
    mkTask({ title: 'Revisar orçamento mensal', dueDate: t, priority: 'high', ...sm }),
    mkTask({ title: 'Organizar documentos', dueDate: addDays(t, 2), ...sm }),
    mkTask({ title: 'Marcar consulta de rotina', dueDate: addDays(t, -1), ...sm }),
    mkTask({ title: 'Comprar um caderno novo', ...sm }),
    mkTask({ title: 'Arrumar a mesa de trabalho', done: true, doneAt: new Date().toISOString(), dueDate: t, priority: 'low', ...sm }));
  for (let i = 0; i < 4; i++) S.water.push({ id: newId(), ml: [300, 500, 200, 300][i], at: new Date(Date.now() - i * 36e5).toISOString(), ...sm });
  const acc = { id: newId(), name: 'Conta principal', type: 'checking', initialCents: 150000, ...sm }, investment = { id: newId(), name: 'Investimentos', type: 'investment', initialCents: 12000, ...sm }, card = { id: newId(), name: 'Cartão', type: 'credit', initialCents: 0, limitCents: 300000, closingDay: 20, dueDay: 28, ...sm };
  S.finance.accounts.push(acc, investment, card);
  const mo = (n, day) => { const ym = shiftMonth(t.slice(0, 7), n); return `${ym}-${pad(day)}`; }, tt = (type, accountId, cents, category, desc, date, paid = true) => ({ id: newId(), type, accountId, cents, category, desc, date, paid, createdAt: Date.now(), ...sm });
  S.finance.tx.push(
    tt('in', acc.id, 320000, 'Salário', 'Salário', mo(0, 5)), tt('out', acc.id, 95000, 'Moradia', 'Aluguel', mo(0, 8)), tt('out', acc.id, 28990, 'Assinaturas', 'Internet', mo(0, 12)),
    tt('out', card.id, 32050, 'Alimentação', 'Mercado', addDays(t, -1)), tt('out', card.id, 8900, 'Lazer', 'Cinema', addDays(t, -3)), tt('out', investment.id, 2500, 'Transporte', 'Ônibus', addDays(t, -2)),
    tt('out', acc.id, 18000, 'Saúde', 'Farmácia', addDays(t, 3), false), tt('in', acc.id, 45000, 'Renda extra', 'Freelance', addDays(t, 6), false),
    tt('in', acc.id, 320000, 'Salário', 'Salário', mo(-1, 5)), tt('out', acc.id, 95000, 'Moradia', 'Aluguel', mo(-1, 8)), tt('out', card.id, 61000, 'Compras', 'Roupas', mo(-1, 14)), tt('out', acc.id, 54000, 'Alimentação', 'Mercado do mês', mo(-1, 20)),
    tt('in', acc.id, 320000, 'Salário', 'Salário', mo(-2, 5)), tt('out', acc.id, 95000, 'Moradia', 'Aluguel', mo(-2, 8)), tt('out', acc.id, 47000, 'Alimentação', 'Mercado do mês', mo(-2, 21)));
  S.finance.budgets = { ...S.finance.budgets, 'Alimentação': { cents: 80000, sample: true }, 'Lazer': { cents: 30000, sample: true } };
  S.finance.goals.push({ id: newId(), name: 'Viagem de férias', targetCents: 400000, savedCents: 120000, deadline: addDays(t, 150), ...sm });
  [-57, -29, -1].forEach((off, i) => { const st0 = addDays(t, off); for (let d = 0; d < (i < 2 ? 5 : 1); d++) { const k = addDays(st0, d); if (k > t) break; S.cycleLog[k] = { flow: d === 0 ? 'medium' : d < 3 ? 'heavy' : 'light', pain: d < 2 ? ['cramp'] : [], mood: d === 0 ? ['sensitive'] : [], energy: d < 2 ? 'low' : '', sample: true }; } });
  Object.assign(S.settings.areas, { water: true, finances: true, cycle: true, habits: true });
  S.settings.prefs.sample = true;
  S.settings.areas.cycle = true;
  commit(...SLICES);
}
const keepNonSample = (a) => a.filter((x) => !x.sample);
function removeSampleData() {
  S.tasks = keepNonSample(S.tasks); S.water = keepNonSample(S.water);
  S.gym = { templates: keepNonSample(S.gym.templates), logs: keepNonSample(S.gym.logs) };
  const accs = keepNonSample(S.finance.accounts);
  S.finance = { accounts: accs, tx: S.finance.tx.filter((x) => !x.sample && accs.some((a) => a.id === x.accountId)), budgets: Object.fromEntries(Object.entries(S.finance.budgets || {}).filter(([, b]) => !b.sample)), goals: keepNonSample(S.finance.goals || []), recurring: (S.finance.recurring || []).filter((r) => accs.some((a) => a.id === r.accountId)) };
  S.cycle = keepNonSample(S.cycle); S.cycleLog = Object.fromEntries(Object.entries(S.cycleLog).filter(([, l]) => !l.sample)); S.weight = keepNonSample(S.weight);
  S.settings.prefs.sample = false;
}
function clearSample() {
  removeSampleData();
  commit(...SLICES); toast('Exemplos removidos.');
}

/* ---- Backup ---- */
function buildBackup() {
  const s = S.settings;
  const backupPreferences = { ...s.prefs };
  delete backupPreferences.releaseNotesSeen;
  return JSON.stringify({ app: 'aurora', version: 2, exportedAt: new Date().toISOString(), data: {
    profile: {
      name: s.profile.name.slice(0, 50),
      preferredName: (s.profile.preferredName || s.profile.name).slice(0, 50),
    },
    tasks: S.tasks.map((t) => ({ id: t.id, title: t.title, done: t.done, tag: t.tag, dueDate: t.dueDate, priority: t.priority, icon: t.icon, groupId: t.groupId, groupTitle: t.groupTitle, doneAt: t.doneAt, createdAt: t.createdAt, repeat: t.repeat, time: t.time, remind: t.remind, subtasks: t.subtasks, tags: t.tags, notes: t.notes, order: t.order, focusSeconds: t.focusSeconds })),
    areas: s.areas, theme: s.theme, weightTracking: s.weightTracking, onboardingComplete: s.onboardingComplete, introSeen: s.introSeen },
    extras: { themeFull: s.theme, look: s.look, lists: s.lists, cats: s.cats, water: S.water, gym: S.gym, finance: S.finance, cycle: S.cycle, cycleLog: S.cycleLog, weight: S.weight, habits: S.habits, pomodoroTimer: S.pomodoro, prefs: backupPreferences, about: { sex: s.profile.sex, age: s.profile.age, weightKg: s.profile.weightKg, heightCm: s.profile.heightCm } } }, null, 2);
}
async function doExport() {
  if (Object.keys(ui.integrityIssues).length) {
    toast('O backup normal não foi criado para evitar omitir dados locais inválidos. Baixe a cópia de recuperação ou importe um backup confiável.');
    return;
  }
  if (!await confirmInDialog('O arquivo de backup não tem proteção própria por senha. Quem tiver acesso a ele poderá ver dados financeiros, de saúde e do ciclo. Guarde-o em um local privado. Deseja continuar?')) return;
  const json = buildBackup(), name = `aurora-backup-${today()}.json`;
  downloadFile(name, json, 'application/json;charset=utf-8');
  S.settings.prefs.lastBackup = new Date().toISOString(); commit('settings'); toast('Backup baixado.');
}
function downloadFile(name, contents, type) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const link = document.createElement('a');
  link.href = url; link.download = name; link.hidden = true;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function exportRecoveryData() {
  if (!Persist.rawTables || !Object.keys(Persist.rawTables).length) {
    toast('Não há dados bloqueados disponíveis para exportar.');
    return;
  }
  if (!await confirmInDialog('A cópia de recuperação contém dados da conta, inclusive informações de saúde e finanças, e não tem proteção própria por senha. Guarde-a em um local privado e não a compartilhe. Deseja continuar?')) return;
  const recovery = JSON.stringify({
    app: 'aurora-recovery',
    version: 1,
    exportedAt: new Date().toISOString(),
    integrityIssues: ui.integrityIssues,
    tables: Persist.rawTables,
  }, null, 2);
  downloadFile(`aurora-recovery-${today()}.json`, recovery, 'application/json;charset=utf-8');
  toast('Cópia bruta de recuperação baixada. Ela não altera nem substitui os dados atuais.');
}
const arr = (v) => Array.isArray(v) ? v : [];
function backupRecords(value, validator, label) {
  if (value == null) return [];
  const result = filterValidRecords(value, validator);
  if (result.rejectedCount) {
    throw new Error(`O backup contém ${result.rejectedCount} registro(s) inválido(s) em ${label}; nada foi importado.`);
  }
  return result.records;
}
function validatedBackupSlice(key, value) {
  const result = normalizeSlice(key, value);
  if (result.invalidCount) {
    throw new Error(`O backup contém dados inválidos em ${key}; nada foi importado.`);
  }
  return result.value;
}
function parseBackup(text) {
  if (text.length > 5 * 1024 * 1024) throw new Error('O arquivo excede o limite de 5 MB.');
  let j; try { j = JSON.parse(text); } catch { throw new Error('Não foi possível reconhecer este arquivo como um backup do Aurora.'); }
  if (!isPlainObject(j) || j.app !== 'aurora' || ![1, 2].includes(j.version) || !isPlainObject(j.data)
    || (j.extras !== undefined && !isPlainObject(j.extras))) throw new Error('Este arquivo não é um backup compatível do Aurora.');
  const d = j.data, ex = j.extras || {};
  if (containsRemovedStudyData(d, ex)) {
    throw new Error('Este backup contém dados de uma função removida e não pode ser importado.');
  }
  if (d.introSeen !== undefined && typeof d.introSeen !== 'boolean') throw new Error('O indicador da introdução no backup está inválido.');
  if (d.profile !== undefined && (!isPlainObject(d.profile)
    || (d.profile.name !== undefined && !isText(d.profile.name))
    || (d.profile.preferredName !== undefined && !isText(d.profile.preferredName)))) throw new Error('O perfil do backup está inválido.');
  const sourceTasks = backupRecords(d.tasks, (task) => isPlainObject(task) && isText(task.title)
    && isValidTask({ ...task, id: isNonEmptyText(task.id) ? task.id : 'backup-task' }), 'tarefas');
  const ids = new Set(), uniq = (x) => { if (typeof x.id !== 'string' || !x.id || ids.has(x.id)) x.id = newId(); ids.add(x.id); return x; };
  const tasks = sourceTasks.map((t) => uniq({ id: t.id, title: t.title.slice(0, 120), done: !!t.done, tag: typeof t.tag === 'string' ? t.tag : 'Pessoal', dueDate: isDay(t.dueDate) ? t.dueDate : null, priority: ['low', 'normal', 'high'].includes(t.priority) ? t.priority : 'normal', ...(taskIconKey(t.icon) ? { icon: taskIconKey(t.icon) } : {}), ...(t.groupId !== undefined ? { groupId: t.groupId } : {}), ...(t.groupTitle !== undefined ? { groupTitle: t.groupTitle } : {}), ...(t.doneAt !== undefined ? { doneAt: t.doneAt } : {}), createdAt: t.createdAt || Date.now(), ...(REPEATS[t.repeat] && t.repeat !== 'none' ? { repeat: t.repeat } : {}), ...(isTime(t.time) ? { time: t.time } : {}), ...(Number.isFinite(Number(t.remind)) && t.remind !== null && isTime(t.time) ? { remind: Number(t.remind) } : {}), ...(Number.isSafeInteger(t.focusSeconds) && t.focusSeconds >= 0 ? { focusSeconds: t.focusSeconds } : {}), ...(Array.isArray(t.tags) && t.tags.length ? { tags: t.tags.slice(0, 12).map((g) => g.slice(0, 24)) } : {}), ...(typeof t.notes === 'string' && t.notes ? { notes: t.notes.slice(0, 2000) } : {}), ...(Number.isFinite(t.order) ? { order: t.order } : {}), ...(Array.isArray(t.subtasks) && t.subtasks.length ? { subtasks: t.subtasks.slice(0, 40).map((x) => ({ id: x.id || newId(), title: x.title.slice(0, 100), done: !!x.done })) } : {}) }));
  const onboardingComplete = typeof d.onboardingComplete === 'boolean' ? d.onboardingComplete : true;
  const settingsResult = normalizeSlice('settings', {
    profile: {
      name: String(d.profile?.name || '').slice(0, 50),
      preferredName: String(d.profile?.preferredName || d.profile?.name || '').slice(0, 50),
    },
    areas: d.areas,
    theme: ex.themeFull !== undefined ? ex.themeFull : d.theme,
    look: ex.look,
    lists: ex.lists,
    cats: ex.cats,
    weightTracking: d.weightTracking,
    onboardingComplete,
    introSeen: typeof d.introSeen === 'boolean' ? d.introSeen : onboardingComplete,
    prefs: ex.prefs,
  });
  if (settingsResult.invalidCount) throw new Error('As configurações do backup contêm dados inválidos; nada foi importado.');
  const settings = settingsResult.value;
  delete settings.prefs.releaseNotesSeen;
  if (ex.about !== undefined && !isPlainObject(ex.about)) throw new Error('Os dados do perfil no backup estão inválidos.');
  if (ex.about && typeof ex.about === 'object') {
    const a = ex.about;
    if ((a.sex !== undefined && a.sex !== '' && !Object.hasOwn(SEX, a.sex))
      || (a.age !== undefined && a.age !== null && !(Number.isInteger(a.age) && a.age >= 0 && a.age <= 120))
      || (a.weightKg !== undefined && a.weightKg !== null && !(isFiniteValue(a.weightKg) && a.weightKg >= 20 && a.weightKg <= 400))
      || (a.heightCm !== undefined && a.heightCm !== null && !(Number.isInteger(a.heightCm) && a.heightCm >= 80 && a.heightCm <= 250))) throw new Error('Os dados do perfil no backup estão inválidos.');
    Object.assign(settings.profile, { sex: SEX[a.sex] ? a.sex : '', age: Number.isFinite(a.age) ? a.age : null, weightKg: Number.isFinite(a.weightKg) ? a.weightKg : null, heightCm: Number.isFinite(a.heightCm) ? a.heightCm : null });
  }
  settings.prefs.sample = false;
  const pomodoro = validatedBackupSlice('pomodoro', Object.hasOwn(ex, 'pomodoroTimer') ? ex.pomodoroTimer : defaults().pomodoro);
  const habits = backupRecords(ex.habits, isValidHabit, 'hábitos');
  return {
    tasks: validatedBackupSlice('tasks', tasks),
    pomodoro,
    habits: validatedBackupSlice('habits', habits),
    settings,
    water: validatedBackupSlice('water', ex.water),
    gym: validatedBackupSlice('gym', ex.gym),
    finance: validatedBackupSlice('finance', ex.finance),
    cycle: validatedBackupSlice('cycle', ex.cycle),
    cycleLog: validatedBackupSlice('cycleLog', ex.cycleLog),
    weight: validatedBackupSlice('weight', ex.weight),
  };
}
async function importFile(file) {
  const err = (m) => { const e = $('#imperr'); if (e) e.textContent = m; else toast(m); };
  if (!file) return;
  if (file.size > 7 * 1024 * 1024) return err('O arquivo excede o limite permitido para backup.');
  let text;
  try {
    text = await file.text();
  } catch (error) {
    console.error('Aurora: não foi possível ler o arquivo de backup.', error);
    return err('Não consegui ler o arquivo.');
  }
  try {
    let document;
    try {
      document = JSON.parse(text);
    } catch {
      const parsed = parseBackup(text);
      ui.dlg = null;
      dlgOpen('import', { parsed });
      return;
    }
    const parsed = parseBackup(text);
    ui.dlg = null;
    dlgOpen('import', { parsed });
  } catch (error) {
    err(error instanceof Error ? error.message : 'Este arquivo não pôde ser validado.');
  }
}

/* ---- Ações por clique ---- */
const ACTIONS = {
  'cycle-consent-revoke': async () => {
    if (ui.cycleConsentBusy || !accountSession?.client?.auth?.updateUser) return;
    const confirmed = await confirmInDialog(
      'Retirar o consentimento vai bloquear a área Ciclo, mas não apaga os registros já salvos. Para pedir a exclusão, use o contato da Política de Privacidade ou exclua sua conta em Ajustes → Seu perfil.',
    );
    if (!confirmed) return;
    ui.cycleConsentBusy = true;
    render();
    try {
      const { data, error } = await accountSession.client.auth.updateUser({
        data: createCycleDataConsentRevocationMetadata(),
      });
      if (error) throw error;
      if (!data?.user || data.user.id !== accountSession.user?.id
        || hasCurrentCycleDataConsent(data.user)) {
        throw new Error('O provedor não confirmou a revogação do consentimento.');
      }
      accountSession.user = data.user;
      toast('Consentimento retirado. Ciclo foi bloqueado; os registros existentes foram mantidos.');
    } catch (error) {
      console.error('Aurora: não foi possível retirar o consentimento para dados de Ciclo.', error);
      toast('Não foi possível retirar o consentimento. Confira sua conexão e tente novamente.');
    } finally {
      ui.cycleConsentBusy = false;
      render();
    }
  },
  'footer-scroll-top': () => {
    if (prefersReducedMotion(settingsView().look.reduceMotion)) {
      window.scrollTo(0, 0);
      return;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },
  'pwa-install': () => {
    showPwaInstallPrompt();
  },
  'pwa-update-dismiss': () => {
    ui.pwaUpdateDismissed = true;
    renderPwaUpdateNotice();
  },
  'pwa-update-apply': () => { void applyPwaUpdate(); },
  'reload-app': () => {
    const hasUnsavedChanges = settingsDraftDirty()
      || Boolean(ui.profileDraft)
      || Boolean(ui.dlg?.dirty)
      || ui.persistFailed.size > 0;
    if (!hasUnsavedChanges) return window.location.reload();
    void confirmInDialog('Há alterações que ainda não foram salvas. Recarregar pode descartá-las. Deseja continuar?')
      .then((confirmed) => { if (confirmed) window.location.reload(); });
  },
  'nav-more-toggle': () => { ui.navigationOpen = !ui.navigationOpen; render(); if (ui.toast) renderToast(); },
  'sidebar-toggle': () => {
    ui.sidebarCollapsed = !ui.sidebarCollapsed;
    writeSidebarCollapsed(ui.sidebarCollapsed);
    render();
    requestAnimationFrame(() => document.querySelector('.sidebar-toggle')?.focus());
  },
  'quick-actions-toggle': (el) => {
    const opening = !ui.quickActionsOpen;
    const returnTarget = el.matches('.finance-fab')
      ? '.finance-fab'
      : window.matchMedia('(max-width: 899px)').matches
        ? '.nav-more-trigger'
        : '.nav-quick-trigger';
    ui.navigationOpen = false;
    ui.quickActionsOpen = opening;
    render();
    requestAnimationFrame(() => {
      const target = opening
        ? document.querySelector('#quick-actions-menu button')
        : document.querySelector(returnTarget);
      target?.focus();
    });
  },
  'quick-action-task': () => { ui.quickActionsOpen = false; openTaskDialog(today()); },
  'quick-action-habit': () => { ui.quickActionsOpen = false; ACTIONS['habit-new'](); },
  'quick-action-transaction': () => { ui.quickActionsOpen = false; newTxDlg('out'); },
  'quick-action-finance': (el) => {
    ui.quickActionsOpen = false;
    const kind = el.dataset.kind;
    newTxDlg(kind === 'card' ? 'out' : kind, kind === 'card');
  },
  'quick-action-account': () => { ui.quickActionsOpen = false; ACTIONS['acct-new'](); },
  'areas-nav-open': (_, event) => {
    event.preventDefault();
    nav('config?section=areas-navigation');
  },
  'area-guide-open': (el) => {
    const route = el.dataset.areaGuide;
    if (!AREA_GUIDES[route]) {
      console.error('Aurora: tutorial solicitado para uma área desconhecida.', route);
      toast('Não foi possível abrir o tutorial desta área.');
      return;
    }
    dlgOpen('area-tutorial', { route });
  },
  'discard-settings': () => {
    ui.settingsDraft = null;
    ui.settingsDraftBase = null;
    render();
    toast('Alterações descartadas.');
  },
  'profile-discard': () => {
    ui.profileDraft = null;
    if (settingsDraftDirty()) {
      ui.settingsDraft = null;
      ui.settingsDraftBase = null;
    }
    render();
    toast('Alterações descartadas.');
  },
  'profile-save': async () => {
    if (ui.profileDraft) await saveProfileDraft();
    if (!ui.profileDraft && settingsDraftDirty()) await saveSettingsDraft();
  },
  'focus-quick-task': () => openTaskDialog(today()),
  'focus-task-title': () => openTaskDialog(),
  'home-quick-focus': () => {
    const input = $('#home-quick-title-input');
    if (!input) return openTaskDialog(today());
    const reduceMotion = prefersReducedMotion(settingsView().look.reduceMotion);
    input.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
    if (reduceMotion) input.focus();
    else setTimeout(() => input.focus(), 250);
  },
  'first-steps-dismiss': () => {
    const snapshot = snapshotSlices(['settings']);
    S.settings.prefs.firstStepsDismissed = true;
    if (!saveSlicesWithRollback(['settings'], snapshot, false, 'a dispensa dos primeiros passos')) return;
    render();
  },
  'task-new': (el) => openTaskDialog(isDay(el.dataset.due) ? el.dataset.due : ''),
  'toggle': (el) => {
    const task = findTask(el.dataset.id);
    if (!task) return;
    const wasDone = task.done, previousDoneAt = task.doneAt, completing = !task.done;
    const snapshot = snapshotSlices(['tasks']);
    task.done = completing;
    task.doneAt = task.done ? new Date().toISOString() : undefined;
    let nextTask = null;
    if (task.done && task.repeat && task.repeat !== 'none' && task.dueDate) {
      let nextDate = nextDue(task.dueDate, task.repeat), attempts = 0;
      while (nextDate < today() && attempts++ < 800) nextDate = nextDue(nextDate, task.repeat);
      nextTask = {
        ...task,
        id: newId(),
        done: false,
        doneAt: undefined,
        dueDate: nextDate,
        createdAt: Date.now(),
        subtasks: (task.subtasks || []).map((subtask) => ({ ...subtask, done: false })),
      };
      delete nextTask.sample;
      S.tasks.push(nextTask);
    }
    if (!saveSlicesWithRollback(['tasks'], snapshot, true, 'a conclusão da tarefa')) return;
    if (completing) {
      vibrateFeedback();
      completionFeedback(`.task[data-k="${task.id}"]`);
      const message = nextTask ? `Concluída. Próxima: ${shortDate(nextTask.dueDate)}.` : 'Tarefa concluída.';
      toast(message, () => {
        const currentTask = findTask(task.id);
        if (!currentTask) return;
        const undoSnapshot = snapshotSlices(['tasks']);
        currentTask.done = wasDone;
        if (previousDoneAt === undefined) delete currentTask.doneAt;
        else currentTask.doneAt = previousDoneAt;
        if (nextTask) S.tasks = S.tasks.filter((item) => item.id !== nextTask.id);
        saveSlicesWithRollback(['tasks'], undoSnapshot, true, 'a ação de concluir a tarefa');
      });
    }
  },
  'tg-del': (el) => { ui.dlg.d.tags.splice(Number(el.dataset.i), 1); render(); },
  'tg-pick': (el) => { const a = ui.dlg.d.tags = ui.dlg.d.tags || []; if (!a.includes(el.dataset.v)) a.push(el.dataset.v); render(); },
  'mv-up': (el) => moveTask(el.dataset.id, -1),
  'mv-down': (el) => moveTask(el.dataset.id, 1),
  'st-toggle': (el) => { const x = (ui.dlg.d.subs || [])[Number(el.dataset.i)]; if (x) { x.done = !x.done; render(); } },
  'st-del': (el) => { const a = ui.dlg.d.subs || []; a.splice(Number(el.dataset.i), 1); render(); },
  'rem-done': (el) => { delete ui.alerts[el.dataset.k]; ACTIONS['toggle']({ dataset: { id: el.dataset.id } }); },
  'habit-reminder-done': (el) => {
    const habit = S.habits.find((item) => item.id === el.dataset.id);
    delete ui.alerts[el.dataset.k];
    if (!habit || (habit.status || 'active') !== 'active' || !habit.days.includes(pk(today()).getDay())) return render();
    const day = today();
    if (!habit.completions.includes(day)) habit.completions = [...habit.completions, day];
    ui.notificationsOpen = false;
    nav('habitos');
    commit('habits');
  },
  'rem-snooze': (el) => { const a = ui.alerts[el.dataset.k]; if (a) { ui.snooze[el.dataset.k] = Date.now() + (Number(el.dataset.min) || 10) * 60000; delete ui.alerts[el.dataset.k]; delete ui.fired[el.dataset.k]; render(); } },
  'rem-dismiss': (el) => { delete ui.alerts[el.dataset.k]; render(); },
  'rem-dismiss-all': () => { const had = Object.keys(ui.alerts).length; Object.keys(ui.alerts).forEach((k) => { delete ui.alerts[k]; }); ui.notificationsOpen = false; render(); if (had) toast('Notificações dispensadas.'); },
  'reminders-pause': () => {
    if (ui.remindersPausedUntil > Date.now()) {
      ui.remindersPausedUntil = 0;
      render();
      toast('Lembretes do app retomados.');
      return;
    }
    ui.remindersPausedUntil = Date.now() + 60 * 60 * 1000;
    Object.keys(ui.alerts).forEach((key) => { delete ui.alerts[key]; });
    render();
    toast('Lembretes de tarefas e hábitos pausados por uma hora nesta sessão do app. Avisos do sistema não foram alterados.');
  },
  'toggle-notifications': (el) => { ui.notificationsOpen = !ui.notificationsOpen; render(); const trigger = document.getElementById(el.id); if (trigger) trigger.focus({ preventScroll: true }); },
  'close-notifications': () => closeNotifications(),
  'backup-reminder-dismiss': () => { ui.backupReminderHidden = true; render(); },
  'accessibility-mode': (el) => { setThemeMode(el.dataset.v); document.getElementById(el.id)?.focus(); },
  'accessibility-contrast': (el) => updateAccessibilityLook({ contrast: !settingsView().look.contrast }, el.id),
  'accessibility-readable': (el) => updateAccessibilityLook({ readable: !settingsView().look.readable }, el.id),
  'accessibility-links': (el) => updateAccessibilityLook({ highlightLinks: !settingsView().look.highlightLinks }, el.id),
  'accessibility-spacing': (el) => updateAccessibilityLook({ density: settingsView().look.density === 'comfy' ? 'compact' : 'comfy' }, el.id),
  'accessibility-motion': (el) => updateAccessibilityLook({ reduceMotion: !settingsView().look.reduceMotion }, el.id),
  'search-open': () => dlgOpen('search', { query: '' }),
  'search-result': (el) => {
    const query = ui.dlg?.d.query || '';
    ui.dlg = null;
    if (el.dataset.kind === 'task') {
      const task = findTask(el.dataset.id);
      if (!task) return toast('Esta tarefa não está mais disponível.');
      ui.planView = 'lista';
      ui.filters.f = 'todas';
      ui.filters.q = task.title || query;
      nav('planejar');
      return;
    }
    if (el.dataset.kind === 'habit') {
      if (!S.habits.some((habit) => habit.id === el.dataset.id)) return toast('Este hábito não está mais disponível.');
      nav('habitos');
      return;
    }
    if (el.dataset.kind === 'cycle') {
      if (!S.cycleLog[el.dataset.id]) return toast('Este registro do ciclo não está mais disponível.');
      ui.cycDay = el.dataset.id;
      ui.calMonth = el.dataset.id.slice(0, 7);
      nav('ciclo');
      return;
    }
    const transaction = S.finance.tx.find((item) => item.id === el.dataset.id);
    if (!transaction) return toast('Este lançamento não está mais disponível.');
    ui.finMonth = transaction.date.slice(0, 7);
    ui.finTab = 'lancamentos';
    ui.finFilter = 'todos';
    ui.finQ = transaction.desc || transaction.category || query;
    nav('financas');
  },
  'plan-view': (el) => {
    if (!['lista', 'calendario', 'semana', 'revisao'].includes(el.dataset.v)) return;
    ui.planView = el.dataset.v;
    render();
    if (ui.planView === 'calendario') {
      const staleAccounts = connectedGoogleCalendarAccounts()
        .filter((account) => account.loadedMonth !== ui.taskCal)
        .map((account) => account.id);
      if (staleAccounts.length) void loadGoogleCalendarEvents(staleAccounts);
    }
  },
  'google-calendar-prepare': () => prepareGoogleCalendar(),
  'google-calendar-authorize': () => authorizeGoogleCalendar(),
  'google-calendar-refresh': (el) => {
    if (el.dataset.accountId) void loadGoogleCalendarEvents([el.dataset.accountId]);
  },
  'google-calendar-toggle': (el) => toggleGoogleCalendar(el.dataset.accountId, el.dataset.calendarId),
  'google-calendar-disconnect': (el) => disconnectGoogleCalendar(el.dataset.accountId),
  'weekly-open-overdue': () => { ui.planView = 'lista'; ui.filters.f = 'atrasadas'; nav('planejar'); },
  'home-weekly-review': () => { ui.planView = 'revisao'; nav('planejar'); },
  'weekly-keep-task': (el) => {
    if (findTask(el.dataset.id)) toast('Esta prioridade permanece na data planejada.');
  },
  'weekly-defer-task': (el) => {
    const task = findTask(el.dataset.id);
    if (!task || task.done || !isDay(task.dueDate)) return;
    const previousDate = task.dueDate;
    const snapshot = snapshotSlices(['tasks']);
    task.dueDate = addDays(task.dueDate, 7);
    const deferredDate = task.dueDate;
    if (!saveSlicesWithRollback(['tasks'], snapshot, true, 'o adiamento da tarefa')) return;
    toast('Tarefa adiada por uma semana.', () => {
      const currentTask = findTask(el.dataset.id);
      if (!currentTask || currentTask.dueDate !== deferredDate) {
        toast('A tarefa mudou depois do adiamento; as alterações atuais foram preservadas.');
        return;
      }
      const current = snapshotSlices(['tasks']);
      currentTask.dueDate = previousDate;
      saveSlicesWithRollback(['tasks'], current, true, 'a restauração da tarefa');
    });
  },
  'weekly-save-reflection': () => {
    const text = String($('#weekly-reflection')?.value || '').trim().slice(0, 500);
    const weekOf = weekDays(today(), weekStartDay())[0];
    S.settings.prefs.weeklyReflection = text ? { weekOf, text } : null;
    const saved = saveSlices('settings');
    render();
    if (saved) toast(text ? 'Reflexão salva na sua conta.' : 'Reflexão removida.');
  },
  'weekly-open-finances': () => { ui.finTab = 'resumo'; nav('financas'); },
  'weekly-open-habits': () => nav('habitos'),
  'habit-idea': (el) => {
    const idea = SUGGESTED_HABITS.find((item) => item.id === el.dataset.id);
    if (!idea) return;
    dlgOpen('habit-edit', {
      name: idea.name,
      suggestionDescription: idea.description,
      days: [0, 1, 2, 3, 4, 5, 6],
      remind: '',
      weeklyGoal: '',
      icon: idea.icon,
      color: idea.color,
      ...(idea.id === 'water' ? { waterSuggestion: true, waterWeightKg: '', waterGoalMl: S.settings.prefs.waterGoalMl, waterGoalEdited: false } : {}),
    });
  },
  'habit-ideas-clear': () => {
    ui.habitIdeaCategory = 'all';
    ui.habitIdeaTag = 'all';
    ui.habitIdeaQuery = '';
    const search = document.querySelector('[data-input="habit-ideas-search"]');
    if (search) search.value = '';
    document.querySelectorAll('select[data-change^="habit-idea-"]').forEach((select) => {
      select.value = 'all';
    });
    updateHabitIdeaFilters();
  },
  'habit-ideas-expand': () => {
    ui.habitIdeasExpanded = !ui.habitIdeasExpanded;
    updateHabitIdeaFilters();
  },
  'tcal-month': (el) => {
    ui.taskCal = shiftMonth(ui.taskCal, Number(el.dataset.n));
    ui.googleCalendar.accounts.forEach((account) => {
      account.events = [];
      account.loadedMonth = '';
    });
    ui.googleCalendar.requestId += 1;
    render();
    if (googleCalendar.isConnected()) void loadGoogleCalendarEvents();
  },
  'tcal-day': (el) => { ui.taskDay = el.dataset.d; render(); },
  'tweek-nav': (el) => { ui.taskWeek = addDays(ui.taskWeek, Number(el.dataset.n) * 7); render(); },
  'tweek-today': () => { ui.taskWeek = today(); render(); },
  'week-add': (el) => {
    if (!isDay(el.dataset.d)) return;
    openTaskDialog(el.dataset.d);
  },
  'habit-check': (el) => {
    const habit = S.habits.find((item) => item.id === el.dataset.id);
    if (!habit || (habit.status || 'active') !== 'active' || !habit.days.includes(pk(today()).getDay())) return;
    const day = today();
    if (habitIsSkipped(habit, day, day)) return;
    const completing = !habit.completions.includes(day);
    const snapshot = snapshotSlices(['habits']);
    habit.completions = habit.completions.includes(day)
      ? habit.completions.filter((completed) => completed !== day)
      : [...habit.completions, day];
    if (!saveSlicesWithRollback(['habits'], snapshot, true, 'a marcação do hábito')) return;
    if (completing) {
      completionFeedback(`[data-habit-id="${habit.id}"] .habit-circle`);
      toast('Hábito marcado como concluído.', () => {
        const currentHabit = S.habits.find((item) => item.id === habit.id);
        if (!currentHabit || !currentHabit.completions.includes(day)) return;
        const undoSnapshot = snapshotSlices(['habits']);
        currentHabit.completions = currentHabit.completions.filter((completed) => completed !== day);
        saveSlicesWithRollback(['habits'], undoSnapshot, true, 'a marcação do hábito');
      });
    }
  },
  'habit-skip': (el) => {
    const habit = S.habits.find((item) => item.id === el.dataset.id);
    const day = today();
    if (!habit || (habit.status || 'active') !== 'active'
      || !habit.days.includes(pk(day).getDay()) || habit.completions.includes(day)) return;
    const skipped = new Set(habit.skipped || []);
    const undoSkip = skipped.has(day);
    if (undoSkip) skipped.delete(day);
    else {
      if (skipped.size >= 10000) return toast('O histórico de dias pulados chegou ao limite. Exporte um backup antes de continuar.');
      skipped.add(day);
    }
    const snapshot = snapshotSlices(['habits']);
    habit.skipped = [...skipped].sort();
    if (!saveSlicesWithRollback(['habits'], snapshot, true, 'a alteração do dia pulado')) return;
    toast(undoSkip ? 'Pulo removido.' : 'Hoje foi marcado como dia pulado.', undoSkip ? null : () => {
      const currentHabit = S.habits.find((item) => item.id === habit.id);
      if (!currentHabit || !(currentHabit.skipped || []).includes(day)) return;
      const undoSnapshot = snapshotSlices(['habits']);
      currentHabit.skipped = currentHabit.skipped.filter((skippedDay) => skippedDay !== day);
      saveSlicesWithRollback(['habits'], undoSnapshot, true, 'a marcação do dia pulado');
    });
  },
  'habit-day': (el) => {
    const habit = S.habits.find((item) => item.id === el.dataset.id);
    const day = el.dataset.d;
    if (!habit || habit.status === 'paused'
      || !isDay(day) || day > today() || !habit.days.includes(pk(day).getDay())) return;
    const had = habit.completions.includes(day);
    const hadSkip = (habit.skipped || []).includes(day);
    habit.completions = had ? habit.completions.filter((item) => item !== day) : [...habit.completions, day].sort();
    if (hadSkip && !had) habit.skipped = habit.skipped.filter((item) => item !== day);
    commit('habits');
    if (!had) completionFeedback(`.habit-dot[data-id="${habit.id}"][data-d="${day}"]`);
    toast(had ? `Marcação de ${shortDate(day)} removida.` : `${habit.name} marcado · ${shortDate(day)}`, () => {
      habit.completions = had ? [...habit.completions, day].sort() : habit.completions.filter((item) => item !== day);
      if (hadSkip) habit.skipped = [...new Set([...(habit.skipped || []), day])].sort();
      commit('habits');
    });
  },
  'habit-move': (el) => {
    const dir = Number(el.dataset.dir) === -1 ? -1 : 1;
    const order = S.habits.filter((item) => item.status !== 'archived');
    const habit = S.habits.find((item) => item.id === el.dataset.id);
    const at = order.indexOf(habit);
    const other = order[at + dir];
    if (!habit || !other) return;
    const i = S.habits.indexOf(habit), j = S.habits.indexOf(other);
    [S.habits[i], S.habits[j]] = [S.habits[j], S.habits[i]];
    commit('habits');
    requestAnimationFrame(() => document.querySelector(`[data-action="habit-move"][data-id="${habit.id}"][data-dir="${dir}"]`)?.focus());
  },
  'habit-new': () => dlgOpen('habit-edit', { name: '', days: [0, 1, 2, 3, 4, 5, 6], remind: '', weeklyGoal: '', icon: DEFAULT_HABIT_ICON, color: HABIT_COLORS[S.habits.length % HABIT_COLORS.length] }),
  'habit-delete': (el) => {
    const habit = S.habits.find((item) => item.id === el.dataset.id);
    if (!habit) return;
    if (ui.confirmedAction !== 'habit-delete') return requestActionConfirmation('habit-delete', { id: habit.id }, 'Excluir hábito?', `O hábito "${habit.name}" e o histórico associado irão para a lixeira por 30 dias.`, 'Excluir hábito');
    const index = S.habits.findIndex((item) => item.id === habit.id);
    if (index < 0) return;
    const entry = moveRecordsToTrash(`Hábito: ${habit.name}`, [
      createTrashRecord('habits', habit.id, index, habit),
    ], ['habits'], () => { S.habits.splice(index, 1); });
    if (entry) toast('Hábito movido para a lixeira.', () => restoreTrashEntry(entry.id));
  },
  'habit-delete-dialog': () => {
    const id = ui.dlg?.d?.id;
    if (!id) return;
    if (ui.dlg.dirty) { askDiscardDialog(null, () => requestActionConfirmation('habit-delete', { id }, 'Excluir hábito?', `O hábito "${S.habits.find((item) => item.id === id)?.name || 'selecionado'}" e o histórico associado irão para a lixeira por 30 dias.`, 'Excluir hábito')); return; }
    requestActionConfirmation('habit-delete', { id }, 'Excluir hábito?', `O hábito "${S.habits.find((item) => item.id === id)?.name || 'selecionado'}" e o histórico associado irão para a lixeira por 30 dias.`, 'Excluir hábito');
  },
  'habit-edit-open': (el) => {
    const habit = S.habits.find((item) => item.id === el.dataset.id);
    if (habit) dlgOpen('habit-edit', { id: habit.id, name: habit.name, days: [...habit.days], remind: habit.remind || '', weeklyGoal: habit.weeklyGoal || '', ...(isWaterHabit(habit) ? { waterGoalMl: waterGoalForHabit(habit, S.settings.prefs.waterGoalMl) } : {}), icon: habit.icon || DEFAULT_HABIT_ICON, color: habit.color || DEFAULT_HABIT_COLOR });
  },
  'habit-toggle-pause': (el) => {
    const habit = S.habits.find((item) => item.id === el.dataset.id);
    if (!habit || habit.status === 'archived') return;
    if (ui.dlg?.d?.id === habit.id && ui.dlg.dirty) { const id = habit.id; askDiscardDialog(null, () => ACTIONS['habit-toggle-pause']({ dataset: { id } })); return; }
    if ((habit.status || 'active') === 'active') {
      habit.status = 'paused';
      habit.pausedFrom = today();
      habit.pausedDays = [...habit.days];
    } else {
      if (isDay(habit.pausedFrom)) {
        const pausedDays = new Set(habit.skipped || []);
        const scheduledDays = Array.isArray(habit.pausedDays) ? habit.pausedDays : habit.days;
        const pauseLength = Math.min(Math.max(dayDiff(today(), habit.pausedFrom) + 1, 0), 10000);
        for (let offset = 0; offset < pauseLength; offset++) {
          const day = addDays(habit.pausedFrom, offset);
          if (scheduledDays.includes(pk(day).getDay())
            && !habit.completions.includes(day)
            && (pausedDays.size < 10000 || pausedDays.has(day))) pausedDays.add(day);
        }
        habit.skipped = [...pausedDays].sort();
        delete habit.pausedFrom;
      }
      delete habit.pausedDays;
      habit.status = 'active';
    }
    if (ui.dlg?.d?.id === habit.id) ui.dlg = null;
    commit('habits');
    toast(habit.status === 'paused' ? 'Hábito pausado.' : 'Hábito retomado.');
  },
  'habit-archive': (el) => {
    const habit = S.habits.find((item) => item.id === el.dataset.id);
    if (!habit || habit.status === 'archived') return;
    if (ui.dlg?.d?.id === habit.id && ui.dlg.dirty) { const id = habit.id; askDiscardDialog(null, () => ACTIONS['habit-archive']({ dataset: { id } })); return; }
    const previousStatus = habit.status || 'active';
    habit.status = 'archived';
    if (ui.dlg?.d?.id === habit.id) ui.dlg = null;
    commit('habits');
    toast('Hábito arquivado. O histórico foi preservado.', () => {
      habit.status = previousStatus;
      commit('habits');
    });
  },
  'habit-restore': (el) => {
    const habit = S.habits.find((item) => item.id === el.dataset.id);
    if (!habit || habit.status !== 'archived') return;
    if (ui.dlg?.d?.id === habit.id && ui.dlg.dirty) { const id = habit.id; askDiscardDialog(null, () => ACTIONS['habit-restore']({ dataset: { id } })); return; }
    habit.status = 'active';
    if (ui.dlg?.d?.id === habit.id) ui.dlg = null;
    commit('habits');
    toast('Hábito restaurado.');
  },
  'habit-month': (el) => {
    const next = shiftMonth(ui.habitMonth, Number(el.dataset.n));
    if (next > today().slice(0, 7)) return;
    ui.habitMonth = next;
    render();
  },
  'del-task': (el) => {
    const task = findTask(el.dataset.id);
    if (!task) return;
    if (ui.confirmedAction !== 'del-task') return requestActionConfirmation('del-task', { id: task.id }, 'Excluir tarefa?', `A tarefa "${task.title}" irá para a lixeira por 30 dias.`, 'Excluir tarefa');
    const i = S.tasks.findIndex((item) => item.id === task.id);
    if (i < 0) return;
    const entry = moveRecordsToTrash(`Tarefa: ${task.title}`, [
      createTrashRecord('tasks', task.id, i, task),
    ], ['tasks'], () => { S.tasks.splice(i, 1); });
    if (entry) toast('Tarefa movida para a lixeira.', () => restoreTrashEntry(entry.id));
  },
  'edit-task': (el) => { const t = findTask(el.dataset.id); if (t) dlgOpen('task', { tags: [...(t.tags || [])], notes: t.notes || '', id: t.id, title: t.title, due: t.dueDate || '', time: t.time || '', repeat: t.repeat || 'none', remind: t.remind == null ? '' : String(t.remind), subs: (t.subtasks || []).map((x) => ({ ...x })), priority: t.priority, icon: taskIconKey(t.icon) }); },
  'del-plan': (el) => {
    const planTasks = S.tasks.filter((task) => task.groupId === el.dataset.id);
    if (!planTasks.length) return;
    const title = planTasks[0].groupTitle || planTasks[0].title;
    if (ui.confirmedAction !== 'del-plan') return requestActionConfirmation('del-plan', { id: el.dataset.id }, 'Excluir plano?', `O plano "${title}" e suas tarefas irão para a lixeira por 30 dias.`, 'Excluir plano');
    const records = planTasks.map((task) => createTrashRecord('tasks', task.id, S.tasks.indexOf(task), task));
    const entry = moveRecordsToTrash(`Plano: ${title}`, records, ['tasks'], () => {
      S.tasks = S.tasks.filter((task) => task.groupId !== el.dataset.id);
    });
    if (entry) toast('Plano movido para a lixeira.', () => restoreTrashEntry(entry.id));
  },
  'del-task-dlg': () => {
    const id = ui.dlg?.d?.id;
    const task = findTask(id);
    if (!task) return dlgClose();
    if (ui.dlg.dirty) { askDiscardDialog(null, () => requestActionConfirmation('del-task', { id }, 'Excluir tarefa?', `A tarefa "${task.title}" irá para a lixeira por 30 dias.`, 'Excluir tarefa')); return; }
    requestActionConfirmation('del-task', { id }, 'Excluir tarefa?', `A tarefa "${task.title}" irá para a lixeira por 30 dias.`, 'Excluir tarefa');
  },
  'set-filter': (el) => { ui.filters.f = el.dataset.f; render(); },
  'planning-filter': (el) => {
    ui.planView = 'lista';
    ui.filters.f = el.dataset.f;
    ui.filters.q = '';
    render();
  },
  'task-filters-clear': () => {
    ui.filters.f = 'todas';
    ui.filters.q = '';
    const search = $('#q');
    if (search) search.value = '';
    render();
  },
  'settings-section': (el, event) => {
    const tab = el.dataset.settingsTab;
    if (!SETTINGS_SECTIONS.some(([id]) => id === tab)) return;
    event.preventDefault();
    ui.settingsTab = tab;
    const url = new URL(location.href);
    url.pathname = '/config';
    url.hash = '';
    url.searchParams.set('section', tab);
    history.replaceState(null, '', `${url.pathname}${url.search}`);
    activeRouteLocationKey = `config?${url.search.slice(1)}`;
    render();
    const selectedTab = $(`.settings-menu [data-settings-tab="${tab}"]`);
    selectedTab?.focus({ preventScroll: true });
    if (window.matchMedia('(max-width: 760px)').matches) {
      selectedTab?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  },
  'trash-restore': (el) => restoreTrashEntry(el.dataset.id),
  'menu-move': (el) => {
    const direction = Number(el.dataset.direction);
    const id = el.dataset.menuId;
    if (![-1, 1].includes(direction) || !MENU_ITEMS.some((item) => item.id === id)) return;
    const current = settingsView().prefs.menuOrder;
    const order = moveMenuItem(current, id, direction, HIDDEN_MENU_IDS);
    if (order.every((item, index) => item === current[index])) return;
    updateSettingsDraft((settings) => { settings.prefs.menuOrder = order; });
    const focusDirection = direction < 0 ? 'down' : 'up';
    document.getElementById(`menu-move-${focusDirection}-${id}`)?.focus();
  },
  'menu-reset': () => {
    const defaults = defaultMenuPreferences();
    const currentSettings = settingsView();
    const current = {
      menuOrder: [...currentSettings.prefs.menuOrder],
      visibleMenuItems: [...currentSettings.prefs.visibleMenuItems],
    };
    if (isDefaultMenuPreferences(current)) return;
    if (ui.confirmedAction !== 'menu-reset') return requestActionConfirmation(
      'menu-reset',
      {},
      'Restaurar menus padrão?',
      'A ordem personalizada será substituída pela ordem inicial e todos os menus opcionais voltarão a ficar visíveis. A ativação das áreas e seus dados não serão alterados.',
      'Restaurar menus',
    );
    updateSettingsDraft((settings) => Object.assign(settings.prefs, defaults));
    document.querySelector('[data-settings-tab="areas-navigation"]')?.focus();
    toast('Padrão dos menus selecionado. Salve para aplicar permanentemente.');
  },
  'home-block-move': (el) => {
    const id = el.dataset.homeBlock, direction = Number(el.dataset.direction);
    if (!HOME_BLOCK_IDS.includes(id) || id === 'today' || ![-1, 1].includes(direction)) return;
    const current = settingsView().prefs.homeLayout.order;
    const index = current.indexOf(id), target = index + direction;
    if (index < 1 || target < 1 || target >= current.length) return;
    const order = [...current]; [order[index], order[target]] = [order[target], order[index]];
    updateSettingsDraft((settings) => {
      settings.prefs.homeLayout.order = order;
      saveActiveHomeMode(settings);
    });
  },
  'home-mode': (el) => {
    const mode = el.dataset.homeMode;
    if (!Object.hasOwn(HOME_MODES, mode) || mode === settingsView().prefs.homeMode) return;
    updateSettingsDraft((settings) => {
      settings.prefs.homeMode = mode;
      const saved = settings.prefs.homeModes[mode];
      settings.prefs.homeLayout = { order: [...saved.layout.order], visible: [...saved.layout.visible] };
      settings.prefs.homeShortcuts = [...saved.shortcuts];
    });
  },
  'home-layout-reset': () => {
    const mode = settingsView().prefs.homeMode;
    const defaults = defaultHomeModes()[mode];
    const prefs = settingsView().prefs;
    if (sameJsonValue(prefs.homeLayout, defaults.layout) && sameJsonValue(prefs.homeShortcuts, defaults.shortcuts)) return;
    updateSettingsDraft((settings) => {
      settings.prefs.homeLayout = { order: [...defaults.layout.order], visible: [...defaults.layout.visible] };
      settings.prefs.homeShortcuts = [...defaults.shortcuts];
      saveActiveHomeMode(settings);
    });
    toast('Modo inicial restaurado. Salve para aplicar permanentemente.');
  },
  'retry-habits-template': () => { requestHabitsTemplate(); render(); },
  'habit-push-toggle': () => toggleHabitPush(),
  'filter-inbox': (_, event) => {
    event.preventDefault();
    ui.filters.f = 'caixa';
    nav('planejar');
  },
  'filter-overdue': (_, event) => {
    event.preventDefault();
    ui.filters.f = 'atrasadas';
    nav('planejar');
  },
  'enable-area': (el) => { if (setAreaEnabled(S.settings, el.dataset.area, true)) commit('settings'); },
  'clear-sample': () => {
    if (ui.confirmedAction !== 'clear-sample') return requestActionConfirmation('clear-sample', {}, 'Remover dados de exemplo?', 'Somente os registros identificados como exemplos serão removidos. Seus dados pessoais serão mantidos.', 'Remover exemplos');
    clearSample();
  },
  'load-sample': () => { loadSample(); toast('Dados de exemplo adicionados.'); },
  'undo': () => { const u = ui.toast && ui.toast.undo; ui.toast = null; if (u) u(); renderToast(); },
  'action-confirm-cancel': () => dlgClose(),
  'confirmation-cancel': () => settleDialogConfirmation(false),
  'confirmation-accept': () => settleDialogConfirmation(true),
  'action-confirm-accept': () => {
    const d = ui.dlg?.type === 'action-confirm' ? ui.dlg.d : null;
    if (!d || !CONFIRMABLE_ACTIONS.has(d.action) || !ACTIONS[d.action]) {
      console.error('Aurora: confirmação de ação inválida.');
      ui.confirmPrevious = null;
      ui.dlg = null;
      render();
      toast('Não foi possível concluir esta ação.');
      return;
    }
    const { action, data } = d;
    ui.confirmPrevious = null;
    ui.dlg = null;
    render();
    ui.confirmedAction = action;
    try {
      ACTIONS[action]({ dataset: data });
    } finally {
      ui.confirmedAction = null;
    }
  },
  'dlg-close': () => dlgClose(),
  'dlg-keep': () => dlgKeepEditing(),
  'dlg-discard': () => dlgDiscardChanges(),
  'skip': (el, e) => { e.preventDefault(); const m = $('#main'); if (m) { m.focus(); m.scrollIntoView(); } },
  'cal-month': (el) => { ui.calMonth = shiftMonth(ui.calMonth, Number(el.dataset.n)); render(); },
  'cyc-day': (el) => { ui.cycDay = el.dataset.d; ui.calMonth = el.dataset.d.slice(0, 7); render(); },
  'cyc-open': () => {
    const day = ui.cycDay && ui.cycDay <= today() ? ui.cycDay : today();
    dlgOpen('cycle-log', { day, log: cycleLogDraft(dayLog(day)) });
  },
  'cyc-flow-open': () => {
    const day = ui.cycDay && ui.cycDay <= today() ? ui.cycDay : today();
    dlgOpen('cycle-log', { day, log: cycleLogDraft(dayLog(day)), quickFlow: true });
  },
  'cyc-period-open': () => {
    const day = ui.cycDay && ui.cycDay <= today() ? ui.cycDay : today();
    dlgOpen('cycle-period', { start: day, end: day });
  },
  'cyc-period-past': () => dlgOpen('cycle-period', { start: '', end: today() }),
  'cyc-start-today': () => {
    const day = today();
    if (S.cycle.some((period) => period.start <= day && cyclePeriodEnd(period) >= day)) {
      ui.cycDay = day;
      render();
      return toast('Hoje já faz parte de um período registrado.');
    }
    S.cycle.push({ start: day, end: null });
    ui.cycDay = day;
    ui.calMonth = day.slice(0, 7);
    const saved = saveSlices('cycle');
    render();
    if (saved) toast('Início registrado para hoje. Você pode ajustar o último dia depois.');
  },
  'cyc-period-edit': (el) => {
    const index = Number(el.dataset.index);
    const period = Number.isInteger(index) ? S.cycle[index] : null;
    if (!period) return toast('Este período não está mais disponível.');
    dlgOpen('cycle-period', {
      index,
      originalStart: period.start,
      originalEnd: period.end || '',
      start: period.start,
      end: period.end || today(),
    });
  },
  'cyc-period-delete': (el) => {
    const index = Number(el.dataset.index);
    const period = Number.isInteger(index) ? S.cycle[index] : null;
    if (!period) return toast('Este período não está mais disponível.');
    const label = `o período de ${shortDate(period.start)}${cyclePeriodEnd(period) === period.start ? '' : ` a ${shortDate(cyclePeriodEnd(period))}`}`;
    if (ui.confirmedAction !== 'cyc-period-delete') {
      return requestActionConfirmation('cyc-period-delete', { index }, 'Excluir período?', `${label} irá para a lixeira por 30 dias. Os registros diários de sintomas e anotações serão mantidos.`, 'Excluir período');
    }
    const entry = moveRecordsToTrash(`Ciclo: ${label}`, [
      createTrashRecord('cycle', cyclePeriodKey(period), index, period),
    ], ['cycle'], () => { S.cycle.splice(index, 1); });
    if (entry) toast('Período movido para a lixeira.', () => restoreTrashEntry(entry.id));
  },
  'cyc-opt': (el) => {
    if (ui.dlg?.type !== 'cycle-log') return;
    const c = CYC.find((x) => x.id === el.dataset.c), v = el.dataset.v, l = ui.dlg.d.log;
    if (!c || !c.opts.some(([value]) => value === v)) return;
    if (c.single) l[c.id] = l[c.id] === v ? '' : v; else { const a = l[c.id] || []; l[c.id] = a.includes(v) ? a.filter((x) => x !== v) : [...a, v]; }
    ui.dlg.dirty = true;
    if (c.id !== 'flow') {
      ui.dlg.d.openGroups = [...new Set([...(ui.dlg.d.openGroups || []), c.id])];
      ui.dlg.d.closedGroups = (ui.dlg.d.closedGroups || []).filter((group) => group !== c.id);
    }
    render();
  },
  'cyc-method': (el) => {
    if (ui.dlg?.type !== 'cycle-log' || !ui.dlg.d.log.sexualActivity) return;
    const method = el.dataset.v;
    if (!CYCLE_CONTRACEPTION_METHODS.some(({ id }) => id === method)) return;
    const selected = ui.dlg.d.log.contraceptionMethods || [];
    if (method === 'none' || method === 'undisclosed') {
      ui.dlg.d.log.contraceptionMethods = selected.includes(method) ? [] : [method];
    } else {
      const methods = selected.filter((item) => item !== 'none' && item !== 'undisclosed');
      ui.dlg.d.log.contraceptionMethods = methods.includes(method)
        ? methods.filter((item) => item !== method)
        : [...methods, method];
    }
    ui.dlg.dirty = true;
    render();
  },
  'cyc-clear': (el) => {
    const k = ui.confirmedAction === 'cyc-clear'
      ? el.dataset.day
      : ui.cycDay && ui.cycDay <= today() ? ui.cycDay : today();
    if (!isDay(k)) return;
    const previous = S.cycleLog[k];
    if (!previous) return;
    if (ui.confirmedAction !== 'cyc-clear') return requestActionConfirmation('cyc-clear', { day: k }, 'Remover registro do ciclo?', `O registro de ${longDate(k)} irá para a lixeira por 30 dias.`, 'Remover registro');
    const entry = moveRecordsToTrash(`Ciclo: ${longDate(k)}`, [
      createTrashRecord('cycleLog', k, 0, previous),
    ], ['cycleLog'], () => { delete S.cycleLog[k]; });
    if (entry) toast('Registro movido para a lixeira.', () => restoreTrashEntry(entry.id));
  },
  'set-theme': (el) => updateSettingsDraft((settings) => { settings.theme = el.dataset.v; }),
  'appearance-preset': (el) => {
    const preset = APPEARANCE_PRESETS[el.dataset.v];
    if (!preset) return;
    updateSettingsDraft((settings) => {
      settings.theme = preset.theme;
      settings.look.density = preset.density;
      settings.look.font = preset.font;
    });
  },
  'profile-appearance': (el) => {
    const key = el.dataset.k, value = el.dataset.v;
    const validOptions = key === 'avatar' ? PROFILE_AVATARS
      : key === 'avatarColor' ? PROFILE_AVATAR_COLORS
        : key === 'greeting' ? PROFILE_GREETING_STYLES : [];
    if (!validOptions.some(([id]) => id === value)) return;
    const draft = ui.profileDraft || profileDraftFromSettings(S.settings);
    draft.appearance = normalizeProfileAppearance({ ...draft.appearance, [key]: value });
    ui.profileDraft = profileDraftHasChanges(draft, S.settings.profile, S.settings.prefs.profileAppearance) ? draft : null;
    render();
  },
  'profile-appearance-reset': () => {
    const draft = ui.profileDraft || profileDraftFromSettings(S.settings);
    if (sameJsonValue(draft.appearance, PROFILE_APPEARANCE_DEFAULT)) return;
    draft.appearance = { ...PROFILE_APPEARANCE_DEFAULT };
    ui.profileDraft = profileDraftHasChanges(draft, S.settings.profile, S.settings.prefs.profileAppearance) ? draft : null;
    render();
    toast('Identidade visual padrão selecionada. Salve para aplicar.');
  },
  'preferences-week-start': (el) => {
    const weekStart = Number(el.dataset.v);
    if (![0, 1].includes(weekStart)) return;
    updateSettingsDraft((settings) => { settings.look.weekStart = weekStart; });
  },
  'appearance-reset': () => {
    if (ui.confirmedAction !== 'appearance-reset') return requestActionConfirmation(
      'appearance-reset',
      {},
      'Restaurar aparência padrão?',
      'Cores, tipografia, espaçamento e opções de acessibilidade voltarão aos valores padrão. O modo do tema escolhido no cabeçalho será mantido.',
      'Restaurar padrão',
    );
    updateSettingsDraft((settings) => {
      settings.theme = 'rose';
      settings.look = {
        ...settings.look,
        custom: LOOK_DEFAULT.custom,
        density: LOOK_DEFAULT.density,
        font: LOOK_DEFAULT.font,
        contrast: LOOK_DEFAULT.contrast,
        readable: LOOK_DEFAULT.readable,
        highlightLinks: LOOK_DEFAULT.highlightLinks,
        reduceMotion: LOOK_DEFAULT.reduceMotion,
      };
    });
    toast('Padrão visual selecionado. Salve para aplicar permanentemente.');
  },
  'look': (el) => {
    const k = el.dataset.k, v = k === 'weekStart' ? Number(el.dataset.v) : el.dataset.v;
    updateSettingsDraft((settings) => {
      settings.look = normalizeSettings({ look: { ...settings.look, [k]: v } }).look;
    });
  },
  'look-cycle': cycleThemeMode,
  'export': () => { void doExport(); },
  'recovery-export': () => { void exportRecoveryData(); },
  'persist-retry': () => Persist.retryPending(),
  'legacy-import-discover': () => { void discoverLegacyImport(); },
  'legacy-import-unlock': () => { void unlockLegacyImport(); },
  'legacy-import-apply': () => { void applyLegacyImport(); },
  'legacy-import-clear': () => clearLegacyBrowserData(),
  'copy-export': async () => {
    if (Object.keys(ui.integrityIssues).length) return toast('O backup normal não foi copiado para evitar omitir dados locais inválidos.');
    if (!await confirmInDialog('O backup copiado não tem proteção própria por senha e pode incluir dados financeiros, de saúde e do ciclo. Guarde-o em um local privado. Deseja continuar?')) return;
    const ta = $('#exp');
    try {
      await navigator.clipboard.writeText(ta.value);
      toast('Backup copiado.');
    } catch (error) {
      ta.focus();
      ta.select();
      toast('O backup foi selecionado. Copie manualmente e guarde-o em um local privado.');
    }
    S.settings.prefs.lastBackup = new Date().toISOString();
    saveSlices('settings');
  },
  'import-apply': async (button) => {
    const p = ui.dlg && ui.dlg.d && ui.dlg.d.parsed;
    if (!p) {
      toast('Não foi possível localizar os dados do backup.');
      return;
    }

    const previousState = Object.fromEntries(SLICES.map((k) => [k, S[k]]));
    const previousStamps = Object.fromEntries(SLICES.map((k) => [k, stamps[k]]));
    const blockedBefore = new Set(ui.persistBlocked);
    const failedBefore = new Set(ui.persistFailed);
    const issuesBefore = { ...ui.integrityIssues };

    const restoreSet = (target, snapshot) => {
      target.clear();
      for (const value of snapshot) target.add(value);
    };

    const restoreMetadata = () => {
      for (const k of SLICES) {
        S[k] = previousState[k];

        if (previousStamps[k] === undefined) {
          delete stamps[k];
        } else {
          stamps[k] = previousStamps[k];
        }
      }

      restoreSet(ui.persistBlocked, blockedBefore);
      restoreSet(ui.persistFailed, failedBefore);
      ui.integrityIssues = { ...issuesBefore };
    };

    if (S.settings.prefs.birthdayCorrectionUsed) {
      p.settings.prefs.birthday = S.settings.prefs.birthday;
      p.settings.prefs.birthdayCorrectionUsed = true;
      p.settings.profile.age = S.settings.profile.age;
    }
    if (typeof S.settings.prefs.releaseNotesSeen === 'string') {
      p.settings.prefs.releaseNotesSeen = S.settings.prefs.releaseNotesSeen;
    } else {
      delete p.settings.prefs.releaseNotesSeen;
    }
    for (const k of SLICES) S[k] = p[k];
    if (Persist.replacing) return;
    Persist.replacing = true;
    button.disabled = true;
    try {
      await Persist.replaceAll();
    } catch (error) {
      restoreMetadata();
      render();
      console.error('Aurora: a restauração relacional do backup não foi concluída.', error);
      toast('A restauração não foi confirmada. Os dados anteriores foram mantidos.');
      return;
    } finally {
      Persist.replacing = false;
    }

    ui.settingsDraft = null;
    ui.settingsDraftBase = null;
    ui.dlg = null;
    render();
    toast('Backup restaurado na sua conta.');
  },
  'wipe-ask': () => dlgOpen('wipe'),
  'wipe': async (button) => {
    button.disabled = true;
    const synchronized = await Persist.flush();
    if (!synchronized) {
      button.disabled = false;
      toast('Há alterações ainda não confirmadas. Tente salvar ou sair sem apagá-las antes de continuar.');
      return;
    }
    if (getPushNotificationStatus().enabled) {
      try {
        await disablePushNotifications();
      } catch (error) {
        button.disabled = false;
        console.error('Aurora: não foi possível desativar os avisos Push antes de apagar os dados.', error);
        toast(`Não foi possível desativar os avisos Push. Nada foi apagado. ${pushNotificationErrorMessage(error)}`);
        return;
      }
    }
    try {
      await Persist.clear();
    } catch (error) {
      button.disabled = false;
      console.error('Aurora: a exclusão dos dados relacionais falhou.', error);
      toast(error instanceof Error ? error.message : 'Não foi possível apagar os dados da conta. Tente novamente quando a conexão estiver estável.');
      return;
    }

    S = defaults();
    ui.settingsDraft = null;
    ui.settingsDraftBase = null;
    ui.persistBlocked.clear();
    ui.persistFailed.clear();
    ui.integrityIssues = {};
    syncState.pending.clear();
    syncState.failed.clear();
    syncState.conflicts.clear();
    ui.dlg = createDialog('wipe-complete', {});
    ui.dlgPending = null;
    resetSettingsTabBeforeLeaving();
    nav('inicio');
  },
  'wipe-home': () => { ui.dlg = null; render(); },
  'ob-theme': (el) => { ui.dlg.d.theme = el.dataset.v; render(); },
  'ob-next': () => {
    if (ui.dlg.d.step === 0) refreshOnboardingRecommendations(ui.dlg.d);
    ui.dlg.d.step++;
    render();
  },
  'ob-back': () => { ui.dlg.d.step--; render(); },
  'ob-need': (el) => {
    const need = el.dataset.v;
    if (!ONBOARDING_NEEDS.some((item) => item.id === need)) return;
    const selected = new Set(ui.dlg.d.needs);
    if (selected.has(need)) selected.delete(need);
    else selected.add(need);
    ui.dlg.d.needs = [...selected];
    refreshOnboardingRecommendations(ui.dlg.d);
    render();
  },
  'ob-area': (el) => {
    const area = el.dataset.v;
    if (!ONBOARDING_AREAS.some((item) => item.id === area)) return;
    ui.dlg.d.areas[area] = !ui.dlg.d.areas[area];
    ui.dlg.d.areaOverrides[area] = ui.dlg.d.areas[area];
    render();
  },
  'ob-skip': () => finishOnboard(true),
  'ob-finish': () => finishOnboard(),
};
function finishOnboard(skip = false) {
  const d = ui.dlg.d;
  const snapshot = snapshotSlices(['settings']);
  Object.assign(S.settings, { onboardingComplete: true, introSeen: true });
  if (!skip) {
    S.settings.theme = d.theme;
    Object.keys(S.settings.areas).forEach((area) => {
      if (d.areas[area] && !S.settings.areas[area]) setAreaEnabled(S.settings, area, true);
      else if (!d.areas[area]) S.settings.areas[area] = false;
    });
  }
  if (!saveSlicesWithRollback(['settings'], snapshot, false, 'a personalização inicial')) {
    render();
    return false;
  }
  ui.dlg = ui.returnDialog;
  ui.returnDialog = null;
  render();
  toast(skip ? 'Personalização inicial pulada. Você pode ativar áreas em Ajustes.' : 'Aurora personalizado para você.');
  void maybeOpenReleaseNotes();
  return true;
}

/* ---- Formulários ---- */
const num = (v) => Number(String(v).replace(',', '.'));
async function deleteAccountFromSettings(form) {
  const submit = document.querySelector('[data-account-delete-submit]');
  const message = form.querySelector('[data-account-delete-message]');
  const showError = (text) => {
    message.textContent = text;
    message.hidden = false;
    if (submit) submit.disabled = false;
    if (ui.dlg?.type === 'account-delete') ui.dlg.d.pending = false;
  };
  if (!accountSession) return showError('Entre na conta que deseja excluir.');
  if (ui.legacyImport.busy) return showError('Aguarde a importação terminar antes de excluir a conta.');
  if (String(new FormData(form).get('deleteConfirmation') || '') !== 'EXCLUIR') {
    return showError('Digite EXCLUIR exatamente como aparece para confirmar.');
  }

  if (submit) submit.disabled = true;
  if (ui.dlg?.type === 'account-delete') ui.dlg.d.pending = true;
  try {
    if (!await Persist.flush()) {
      showError('Não foi possível confirmar a sincronização dos dados. Nenhuma exclusão foi solicitada; tente novamente quando a sincronização estiver concluída.');
      return;
    }

    const { requestAccountDeletion } = await import('./services/account-auth.js');
    if (!await requestAccountDeletion(accountSession.client)) {
      showError('O Aurora não recebeu confirmação da exclusão. Verifique a conexão e o estado da conta antes de tentar novamente.');
      return;
    }

    try {
      const registration = await navigator.serviceWorker?.getRegistration();
      const subscription = await registration?.pushManager?.getSubscription();
      if (subscription && !(await subscription.unsubscribe())) {
        throw new Error('O navegador não confirmou a remoção da inscrição Push local.');
      }
    } catch (error) {
      console.error('Aurora: a conta foi excluída, mas a inscrição Push local não foi removida.', error);
    }
    intentionalSignOut = true;
    try {
      const { error } = await accountSession.client.auth.signOut({ scope: 'local' });
      if (error) console.error('Aurora: a conta foi excluída, mas a sessão local não foi encerrada.', error);
    } catch (error) {
      console.error('Aurora: a conta foi excluída, mas a sessão local não foi encerrada.', error);
    }
    Persist.wipe();
    resetGoogleCalendarState();
    history.replaceState(null, '', postSignOutPath(location));
    location.reload();
  } catch (error) {
    console.error('Aurora: não foi possível confirmar a exclusão permanente da conta.', error);
    showError('Não foi possível confirmar a exclusão. Verifique o estado da conta antes de tentar novamente.');
  }
}
const FORMS = {
  'cycle-data-consent': async (form) => {
    const checkbox = form.elements.namedItem('cycleConsent');
    if (!(checkbox instanceof HTMLInputElement) || !checkbox.checked) return;
    if (ui.cycleConsentBusy || !accountSession?.client?.auth?.updateUser) {
      ui.cycleConsentError = 'Não foi possível acessar a conta para registrar o consentimento. Atualize a página e tente novamente.';
      render();
      return;
    }
    ui.cycleConsentBusy = true;
    ui.cycleConsentError = '';
    render();
    let consentRecorded = false;
    try {
      if (!await Persist.flush()) {
        throw new Error('Sincronize as alterações da conta antes de abrir Ciclo.');
      }
      const { data, error } = await accountSession.client.auth.updateUser({
        data: createCycleDataConsentMetadata(),
      });
      if (error) throw error;
      if (!data?.user || data.user.id !== accountSession.user?.id
        || !hasCurrentCycleDataConsent(data.user)) {
        throw new Error('O provedor não confirmou o consentimento para dados de Ciclo.');
      }
      accountSession.user = data.user;
      consentRecorded = true;
      await loadAccountData();
    } catch (error) {
      console.error('Aurora: não foi possível registrar o consentimento para dados de Ciclo.', error);
      ui.cycleConsentError = consentRecorded
        ? 'Seu consentimento foi registrado, mas os dados de Ciclo não puderam ser carregados. Atualize a página para tentar novamente.'
        : 'Não foi possível registrar seu consentimento. Seus dados não foram alterados; confira a conexão e tente novamente.';
    } finally {
      ui.cycleConsentBusy = false;
      render();
    }
  },
  'account-delete': deleteAccountFromSettings,
  'water-add': (f, d) => {
    const habit = S.habits.find((item) => item.id === f.dataset.id);
    if (!habit || !isWaterHabit(habit) || habit.status !== 'active') {
      return toast('Este hábito de água não está disponível para registro.');
    }
    const amount = parseWaterMl(d.get('amount'));
    if (amount === null) return fieldError('Informe um volume inteiro entre 1 e 10.000 mL.', '[name="amount"]');
    const day = today();
    S.water.push({ id: newId(), ml: amount, at: new Date().toISOString() });
    const target = waterGoalForHabit(habit, S.settings.prefs.waterGoalMl);
    const reached = waterGoalReached(waterMlForDay(S.water, day), target);
    const completing = reached && habit.days.includes(pk(day).getDay())
      && !habitIsSkipped(habit, day, day) && !habit.completions.includes(day);
    if (completing) habit.completions.push(day);
    const saved = saveSlices('water', ...(completing ? ['habits'] : []));
    render();
    if (saved) toast(completing ? `Meta diária atingida! ${amount.toLocaleString('pt-BR')} mL registrados.` : `${amount.toLocaleString('pt-BR')} mL registrados.`);
  },
  'home-quick-task': (f, d) => {
    const title = String(d.get('title') || '').trim();
    if (!title) return toast('Escreva uma tarefa para hoje.');
    const parsed = parseTags(title);
    S.tasks.push(mkTask({ title: parsed.title, dueDate: today(), ...(parsed.tags.length ? { tags: parsed.tags } : {}) }));
    const saved = saveSlices('tasks');
    render();
    if (saved) toast('Tarefa adicionada para hoje.');
  },
  'settings-save': saveSettingsDraft,
  'settings-profile': saveProfileDraft,
  'habit': (f, d) => {
    const name = String(d.get('name') || '').trim();
    const days = [...new Set(d.getAll('days').map(Number))].sort((a, b) => a - b);
    const remind = String(d.get('remind') || '');
    const weeklyGoal = Number(d.get('weeklyGoal') || 0);
    if (!name) return toast('Dê um nome ao hábito.');
    if (!days.length || days.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) return toast('Selecione pelo menos um dia válido.');
    if (remind && !isTime(remind)) return toast('Informe um horário válido para o lembrete.');
    if (S.habits.some((habit) => norm(habit.name) === norm(name))) return toast('Você já acompanha um hábito com esse nome.');
    S.habits.push({ id: newId(), name: name.slice(0, 60), days, completions: [], status: 'active', ...(remind ? { remind } : {}), ...(weeklyGoal ? { weeklyGoal } : {}) });
    f.reset();
    f.querySelectorAll('input[name="days"]').forEach((input) => { input.checked = true; });
    const saved = saveSlices('habits');
    render();
    if (saved) toast('Hábito adicionado.');
  },
  'habit-edit': (f, d) => {
    const draft = ui.dlg?.d;
    const habit = S.habits.find((item) => item.id === draft?.id);
    const name = String(d.get('name') || '').trim();
    const days = [...new Set(d.getAll('days').map(Number))].sort((a, b) => a - b);
    const remind = String(d.get('remind') || '');
    const weeklyGoal = Number(d.get('weeklyGoal') || 0);
    const pickedIcon = String(d.get('icon') || '');
    const pickedColor = String(d.get('color') || '').toLowerCase();
    const look = {
      ...(HABIT_ICON_KEYS.includes(pickedIcon) ? { icon: pickedIcon } : {}),
      ...(HABIT_COLORS.includes(pickedColor) ? { color: pickedColor } : {}),
    };
    if (!name) return fieldError('Dê um nome ao hábito.', '[data-dlg="name"]');
    const waterWeightInput = String(d.get('waterWeightKg') || '').trim();
    if (draft?.waterSuggestion && waterWeightInput && parseWaterWeightKg(waterWeightInput) === null) {
      return fieldError('O peso deve estar entre 20 e 400 kg.', '[data-dlg="waterWeightKg"]');
    }
    if (!days.length || days.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) return fieldError('Selecione pelo menos um dia válido.', '[name="days"]');
    if (remind && !isTime(remind)) return fieldError('Informe um horário válido para o lembrete.', '[data-dlg="remind"]');
    if (weeklyGoal && (!Number.isInteger(weeklyGoal) || weeklyGoal < 1 || weeklyGoal > days.length)) return toast('A meta semanal não pode passar do número de dias escolhidos.');
    if (S.habits.some((item) => item.id !== draft?.id && norm(item.name) === norm(name))) return fieldError('Você já acompanha um hábito com esse nome.', '[data-dlg="name"]');
    if (draft?.id && !habit) return dlgClose();
    const tracksWater = Boolean(draft?.waterSuggestion || isWaterHabit(habit) || isWaterHabit({ name }));
    const waterGoalMl = tracksWater
      ? Number(d.has('waterGoalMl') ? d.get('waterGoalMl') : (habit ? waterGoalForHabit(habit, S.settings.prefs.waterGoalMl) : S.settings.prefs.waterGoalMl))
      : null;
    if (tracksWater && !isValidWaterGoalMl(waterGoalMl)) {
      return fieldError('A meta deve ser um valor inteiro entre 500 e 10.000 mL.', '[data-dlg="waterGoalMl"]');
    }
    if (habit) {
      Object.assign(habit, { name: name.slice(0, 60), days, ...look, ...(tracksWater ? { tracking: 'water', waterGoalMl } : {}) });
      if (remind) habit.remind = remind;
      else delete habit.remind;
      if (weeklyGoal) habit.weeklyGoal = weeklyGoal;
      else delete habit.weeklyGoal;
    } else {
      S.habits.push({ id: newId(), name: name.slice(0, 60), days, completions: [], status: 'active', ...look, ...(tracksWater ? { tracking: 'water', waterGoalMl } : {}), ...(remind ? { remind } : {}), ...(weeklyGoal ? { weeklyGoal } : {}) });
    }
    ui.dlg = null;
    const saved = saveSlices('habits');
    render();
    if (saved) toast(habit ? 'Hábito atualizado.' : 'Hábito adicionado.');
  },
  'tg-add': (f, d) => { const v = String(d.get('tg') || '').trim().replace(/^#/, '').toLowerCase().replace(/[^\p{L}\d_-]/gu, '').slice(0, 24); if (!v) return; const a = ui.dlg.d.tags = ui.dlg.d.tags || []; if (!a.includes(v)) a.push(v); render(); const i = $('#tgn'); if (i) i.focus(); },
  'st-add': (f, d) => { const v = String(d.get('st') || '').trim().slice(0, 100); if (!v) return; (ui.dlg.d.subs = ui.dlg.d.subs || []).push({ id: newId(), title: v, done: false }); render(); const i = $('#stn'); if (i) i.focus(); },
  'dlg-task': () => {
    const d = ui.dlg.d, title = String(d.title || '').trim();
    if (!title) return fieldError('Escreva um título.', '[data-dlg="title"]');
    const parsed = parseTags(title), repeat = REPEATS[d.repeat] && d.repeat !== 'none' ? d.repeat : null;
    if (document.querySelector('#dlg [data-dlg="time"]')?.validity.badInput || (d.time && !isTime(d.time))) return fieldError('Informe uma hora válida.', '[data-dlg="time"]');
    const time = isTime(d.time) ? d.time : null;
    const remind = time && REMINDS.some(([value]) => value === String(d.remind)) && d.remind !== '' ? Number(d.remind) : null;
    if ((repeat || time) && !isDay(d.due)) return fieldError('Defina um prazo para repetir ou ter horário.', '[data-dlg="due"]');
    if (d.due && !isDay(d.due)) return fieldError('Informe um prazo válido.', '[data-dlg="due"]');
    const dueDate = isDay(d.due) ? d.due : null;
    const priority = ['high', 'normal', 'low'].includes(d.priority) ? d.priority : 'normal';
    if (d.create) {
      const tags = [...new Set([...(Array.isArray(d.tags) ? d.tags : []), ...parsed.tags])];
      S.tasks.push(mkTask({
        title: parsed.title,
        dueDate,
        priority,
        ...(repeat ? { repeat } : {}),
        ...(time ? { time } : {}),
        ...(remind == null ? {} : { remind }),
        ...(tags.length ? { tags } : {}),
        ...(taskIconKey(d.icon) ? { icon: taskIconKey(d.icon) } : {}),
        ...(Array.isArray(d.subs) && d.subs.length ? { subtasks: d.subs.map((item) => ({ ...item })) } : {}),
        ...(String(d.notes || '').trim() ? { notes: String(d.notes).trim().slice(0, 2000) } : {}),
      }));
      ui.dlg = null;
      const saved = saveSlices('tasks');
      render();
      if (saved) toast('Tarefa adicionada.');
      return;
    }
    const t = findTask(d.id);
    if (!t) return dlgClose();
    Object.assign(t, { title, dueDate, priority, repeat: repeat || undefined, time: time || undefined, remind: remind == null ? undefined : remind, subtasks: (d.subs || []).length ? d.subs : undefined, tags: (d.tags || []).length ? d.tags : undefined, notes: (d.notes || '').trim().slice(0, 2000) || undefined });
    if (taskIconKey(d.icon)) t.icon = taskIconKey(d.icon);
    else delete t.icon;
    ui.dlg = null;
    commit('tasks');
  },
  'cycle-log': () => {
    const { day, log: draft } = ui.dlg.d;
    const log = cycleLogDraft(draft);
    if (typeof log.orgasmCount === 'string') {
      if (!log.orgasmCount.trim()) delete log.orgasmCount;
      else if (/^\d{1,2}$/.test(log.orgasmCount)) log.orgasmCount = Number(log.orgasmCount);
    }
    if (!isDay(day) || day > today() || !isValidCycleLog(log)) return toast('Revise o registro do ciclo.');
    if (typeof log.note === 'string') {
      log.note = log.note.trim().slice(0, 500);
      if (!log.note) delete log.note;
    }
    if (!log.sexualActivity) {
      delete log.sexualActivity;
      delete log.contraceptionMethods;
    } else if (!log.contraceptionMethods?.length) {
      delete log.contraceptionMethods;
    }
    if (!log.masturbationActivity) delete log.masturbationActivity;
    if (hasAnyLog(log)) S.cycleLog[day] = log;
    else delete S.cycleLog[day];
    ui.cycDay = day;
    ui.dlg = null;
    const saved = saveSlices('cycleLog');
    render();
    if (saved) toast('Registro do dia atualizado.');
  },
  'cycle-period': (f, d) => {
    const period = createCyclePeriod(String(d.get('start') || ''), String(d.get('end') || ''), today());
    if (!period) return toast(`Informe um intervalo válido, de até ${MAX_CYCLE_PERIOD_DAYS} dias, que termine até hoje.`);
    const draft = ui.dlg.d;
    const index = Number.isInteger(draft.index) ? draft.index : -1;
    const current = index >= 0 ? S.cycle[index] : null;
    if (index >= 0 && (!current || current.start !== draft.originalStart || (current.end || '') !== draft.originalEnd)) {
      return toast('Este período mudou desde que você abriu a edição. Feche e tente novamente.');
    }
    if (S.cycle.some((item, itemIndex) => itemIndex !== index && cyclePeriodKey(item) === cyclePeriodKey(period))) {
      return toast('Esse período já está registrado.');
    }
    if (current) S.cycle[index] = { ...current, ...period };
    else S.cycle.push(period);
    ui.cycDay = period.start;
    ui.calMonth = period.start.slice(0, 7);
    ui.dlg = null;
    const saved = saveSlices('cycle');
    render();
    if (saved) toast(current ? 'Período atualizado.' : 'Período registrado.');
  },
  'cycle-batch': (f, d) => {
    const days = cycleLogDays(String(d.get('start') || ''), String(d.get('end') || ''), today());
    if (!days) return toast(`Informe um intervalo válido de até ${MAX_CYCLE_LOG_RANGE_DAYS} dias, que termine até hoje.`);
    const symptoms = ui.dlg.d.symptoms;
    const selections = Object.fromEntries(
      Object.entries(symptoms).map(([category, values]) => [category, [...new Set(values)]]),
    );
    if (!Object.values(selections).some((values) => values.length)) return toast('Selecione pelo menos um sintoma.');
    for (const day of days) {
      S.cycleLog[day] = mergeCycleLogSymptoms(dayLog(day), selections);
    }
    ui.cycDay = days[days.length - 1];
    ui.calMonth = ui.cycDay.slice(0, 7);
    ui.dlg = null;
    const saved = saveSlices('cycleLog');
    render();
    if (saved) toast(`Sintomas adicionados a ${days.length} ${plural(days.length, 'dia', 'dias')}.`);
  },
};
const CHANGES = {
  'plan-view': (el) => ACTIONS['plan-view']({ dataset: { v: el.value } }),
  'habit-idea-category': (el) => {
    ui.habitIdeaCategory = el.value || 'all';
    updateHabitIdeaFilters();
  },
  'habit-idea-context': (el) => {
    ui.habitIdeaTag = el.value || 'all';
    updateHabitIdeaFilters();
  },
  'legacy-import-cleanup-confirm': (el) => {
    ui.legacyImport.cleanupConfirmed = el.checked;
    const button = $('#legacy-import-clear');
    if (button) button.disabled = !el.checked || ui.legacyImport.busy;
  },
  'sort': (el) => { ui.filters.sort = el.value; render(); },
  'area': (el) => updateSettingsDraft((settings) => { setAreaEnabled(settings, el.dataset.area, el.checked); }),
  'menu-visible': (el) => {
    const id = el.dataset.menuId;
    if (!MENU_ITEMS.some((item) => item.id === id && item.area)) return;
    const visible = new Set(settingsView().prefs.visibleMenuItems);
    if (el.checked) visible.add(id);
    else visible.delete(id);
    updateSettingsDraft((settings) => {
      settings.prefs.visibleMenuItems = normalizeVisibleMenuItems([...visible]);
    });
  },
  'home-block-visible': (el) => {
    const id = el.dataset.homeBlock;
    if (!HOME_BLOCK_IDS.includes(id)) return;
    updateSettingsDraft((settings) => {
      const visible = new Set(settings.prefs.homeLayout.visible);
      if (el.checked) visible.add(id); else visible.delete(id);
      settings.prefs.homeLayout.visible = HOME_BLOCK_IDS.filter((blockId) => visible.has(blockId));
      saveActiveHomeMode(settings);
    });
  },
  'home-shortcut-visible': (el) => {
    const id = el.dataset.homeShortcut;
    if (!HOME_SHORTCUT_IDS.includes(id)) return;
    updateSettingsDraft((settings) => {
      const selected = new Set(settings.prefs.homeShortcuts);
      if (el.checked) selected.add(id); else selected.delete(id);
      settings.prefs.homeShortcuts = HOME_SHORTCUT_IDS.filter((shortcutId) => selected.has(shortcutId));
      saveActiveHomeMode(settings);
    });
  },
  'home-area-color': (el) => {
    const id = el.dataset.homeAreaColor;
    if (!HOME_AREA_COLORS.some((area) => area.id === id)) return;
    updateSettingsDraft((settings) => {
      if (el.value) settings.prefs.areaColors[id] = el.value;
      else delete settings.prefs.areaColors[id];
    });
  },
  'home-message': (el) => {
    updateSettingsDraft((settings) => { settings.prefs.homeMessage = el.value.slice(0, HOME_MESSAGE_MAX_LENGTH); }, false);
  },
  'look-custom': (el) => { if (hexOk(el.value)) updateSettingsDraft((settings) => { settings.look.custom = el.value; settings.theme = 'custom'; }); },
  'look-contrast': (el) => updateSettingsDraft((settings) => { settings.look.contrast = el.checked; }),
  'look-readable': (el) => updateSettingsDraft((settings) => { settings.look.readable = el.checked; }),
  'look-highlight-links': (el) => updateSettingsDraft((settings) => { settings.look.highlightLinks = el.checked; }),
  'look-motion': (el) => updateSettingsDraft((settings) => { settings.look.reduceMotion = el.checked; }),
  'import': (el) => { const f = el.files && el.files[0]; void importFile(f); el.value = ''; },
};
const SETTINGS_INPUT_CHANGES = new Set(['home-message']);

/* ---- Salvar sem trocar a tela debaixo do dedo (campos de texto salvam ao sair do campo) ---- */
const flushDirty = () => { if (ui.dirty) { ui.dirty = false; clearTimeout(ui.dirtyT); render(); } };
function commitSoft(...ks) { saveSlices(...ks); ui.dirty = true; clearTimeout(ui.dirtyT); ui.dirtyT = setTimeout(flushDirty, 700); }
document.addEventListener('click', () => setTimeout(flushDirty, 0));

/* ---- Relógio ---- */
let lastDay = today();
function renumberTasks() { [...S.tasks].sort((a, b) => orderOf(a) - orderOf(b)).forEach((t, i) => { t.order = (i + 1) * 1000; }); }
function moveTask(id, dir) {
  const list = filteredTasks().filter((t) => !t.done), i = list.findIndex((t) => t.id === id), j = i + dir; if (i < 0 || j < 0 || j >= list.length) return;
  renumberTasks(); const a = list[i], b = list[j], o = a.order; a.order = b.order; b.order = o; commit('tasks');
  requestAnimationFrame(() => { const el = $(`[data-action="${dir < 0 ? 'mv-up' : 'mv-down'}"][data-id="${id}"]`); if (el) el.focus(); });
}
document.addEventListener('dragstart', (e) => { const li = e.target.closest && e.target.closest('.task[draggable]'); if (li) { ui.dragId = li.dataset.k; try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', li.dataset.k); } catch (x) { /* ok */ } } });
document.addEventListener('dragover', (e) => { if (ui.dragId && e.target.closest && e.target.closest('.task[draggable]')) e.preventDefault(); });
document.addEventListener('drop', (e) => { const li = e.target.closest && e.target.closest('.task[draggable]'); if (!li || !ui.dragId) return; e.preventDefault(); const d = findTask(ui.dragId), t = findTask(li.dataset.k); ui.dragId = null; if (!d || !t || d === t) return; renumberTasks(); d.order = t.order - 500; commit('tasks'); });
document.addEventListener('dragend', () => { ui.dragId = null; });
let tickN = 0;
function checkReminders() {
  const now = Date.now(), day = today(); let changed = false, added = 0;
  if (now >= ui.remindersPausedUntil) {
    S.tasks.forEach((t) => {
      if (t.done || !t.dueDate || !t.time || t.remind == null) return;
      const due = new Date(`${t.dueDate}T${t.time}:00`).getTime(), fire = due - Number(t.remind) * 60000, key = `${t.id}|${t.dueDate}|${t.time}|${t.remind}`;
      if (now >= fire && now <= due + 2 * 3600000 && !ui.fired[key] && now >= (ui.snooze[key] || 0)) { ui.fired[key] = true; ui.alerts[key] = { id: t.id, title: t.title, time: t.time, due, at: now }; changed = true; added += 1; }
    });
    S.habits.forEach((habit) => {
      if ((habit.status || 'active') !== 'active' || !habit.remind
        || !habit.days.includes(pk(day).getDay()) || habitCompletedFor(habit, day)) return;
      const key = `habit:${habit.id}:${day}`;
      // Janela de 15 minutos: se a aba ficou em segundo plano no minuto exato, o lembrete ainda aparece.
      const habitAt = new Date(`${day}T${habit.remind}:00`).getTime();
      if (now < habitAt || now > habitAt + 15 * 60000 || ui.fired[key]) return;
      ui.fired[key] = true;
      ui.alerts[key] = { id: habit.id, kind: 'habit', title: habit.name, time: habit.remind, at: now, detail: 'Sua rotina programada para hoje está esperando.' };
      changed = true;
      added += 1;
    });
  }
  Object.keys(ui.alerts).forEach((k) => {
    const alert = ui.alerts[k];
    if (alert.kind === 'habit') {
      const habit = S.habits.find((item) => item.id === alert.id);
      if (!habit || (habit.status || 'active') !== 'active' || habitCompletedFor(habit, day)) {
        delete ui.alerts[k];
        changed = true;
      }
      return;
    }
    const t = findTask(alert.id);
    if (!t || t.done) { delete ui.alerts[k]; changed = true; }
  });
  if (changed) {
    render();
    if (added) {
      if (notificationAnnouncer) notificationAnnouncer.textContent = added === 1
        ? 'Novo lembrete disponível. Abra Notificações para conferir.'
        : `${added} novos lembretes disponíveis. Abra Notificações para conferir.`;
    }
  }
}
function tick() {
  if (Persist.replacing) return;
  if (tickN++ % 10 === 0) checkReminders();
  if (dk() !== lastDay) { lastDay = dk(); render(); }
}

/* ---- Eventos globais ---- */
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState !== 'visible') return;
  if (!Persist.store || Persist.pendingSnapshot || syncState.pending.size || ui.persistFailed.size || Object.keys(ui.integrityIssues).length) {
    return;
  }
  try {
    await loadAccountData();
  } catch (error) {
    console.error('Aurora: a conta foi recarregada em segundo plano e falhou.', error);
  }
});
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]'); if (!el || el.disabled) return;
  if (ui.legacyImport.busy) return;
  const focusBeforeAction = !ui.dlg ? describeDialogOpener(el) : null;
  if (focusBeforeAction) ui.lastFocus = focusBeforeAction;
  const taskToPop = el.dataset.action === 'toggle' && el.getAttribute('aria-checked') !== 'true' ? el.dataset.id : null;
  const activeDialog = ui.dlg;
  const previousDraft = activeDialog?.d ? dialogDraftSnapshot(activeDialog.d) : null;
  const fn = ACTIONS[el.dataset.action]; if (fn) fn(el, e);
  if (!ui.dlg) ui.lastFocus = null;
  if (activeDialog && ui.dlg === activeDialog && previousDraft !== null && previousDraft !== dialogDraftSnapshot(activeDialog.d)) activeDialog.dirty = true;
  if (taskToPop) document.querySelectorAll('.chk[data-action="toggle"]').forEach((button) => {
    if (button.dataset.id === taskToPop) button.classList.add('pop');
  });
});
document.addEventListener('click', (e) => {
  const target = e.target;
  if (!ui.navigationOpen || !(target instanceof Element)
    || target.closest('#nav-more-menu, .nav-more-trigger, .nav-more-create')) return;
  ui.navigationOpen = false;
  render();
});
document.addEventListener('click', (e) => {
  const target = e.target;
  if (!ui.quickActionsOpen || !(target instanceof Element)
    || target.closest('#quick-actions-menu, .nav-quick-trigger, .nav-more-create, .finance-fab')) return;
  ui.quickActionsOpen = false;
  render();
});
document.addEventListener('click', (e) => {
  const target = e.target;
  if (!ui.notificationsOpen || !(target instanceof Element) || target.closest('#notification-panel, .notification-trigger')) return;
  setTimeout(() => {
    if (ui.notificationsOpen) closeNotifications(false);
  }, 0);
});
document.addEventListener('submit', (e) => {
  if (e.target instanceof HTMLFormElement && e.target.matches('[data-footer-suggestion]')) {
    e.preventDefault();
    const formData = new FormData(e.target);
    window.location.href = createSuggestionMailto({
      name: formData.get('name'),
      email: formData.get('email'),
      message: formData.get('message'),
    });
    return;
  }
  const f = e.target.closest('[data-form]'); if (!f) return;
  e.preventDefault();
  const fn = FORMS[f.dataset.form]; if (fn) fn(f, new FormData(f));
});
document.addEventListener('input', (e) => {
  const el = e.target;
  if (el.matches('[data-change="home-message"]')) {
    const counter = $('#home-message-count');
    if (counter) counter.textContent = `${el.value.length}/${HOME_MESSAGE_MAX_LENGTH}`;
  }
  if (el instanceof HTMLInputElement && el.matches('.money-input')) {
    const formattedValue = formatMoneyInput(el.value);
    if (formattedValue !== el.value) {
      el.value = formattedValue;
      el.setSelectionRange(formattedValue.length, formattedValue.length);
    }
  }
  if (el.matches('[data-dlg="waterWeightKg"]')) {
    const value = el.value;
    const cursor = el.selectionStart;
    const filteredValue = filterWeightInput(value);
    if (filteredValue !== value) {
      el.value = filteredValue;
      if (cursor !== null) {
        const filteredCursor = filterWeightInput(value.slice(0, cursor)).length;
        el.setSelectionRange(filteredCursor, filteredCursor);
      }
    }
  }
  const changeKey = el.dataset && el.dataset.change;
  if (SETTINGS_INPUT_CHANGES.has(changeKey) && CHANGES[changeKey]) CHANGES[changeKey](el);
  if (ui.dlg && ui.dlg.type !== 'search' && el instanceof Element && el.closest('#dlg') && el.matches('input:not([type="file"]),textarea,select')) ui.dlg.dirty = true;
  if (el.dataset.profileField && ['name', 'preferredName', 'sex', 'age'].includes(el.dataset.profileField)) {
    const preferredInput = $('#ppreferred');
    if (el.dataset.profileField === 'name' && preferredInput && !preferredInput.value.trim()) {
      preferredInput.value = firstName(el.value || '');
    }
    const draft = {
      name: $('#pname')?.value || '',
      preferredName: preferredInput?.value || '',
      sex: $('#psex')?.value || '',
      age: $('#page')?.value || '',
      appearance: ui.profileDraft?.appearance || profileDraftFromSettings(S.settings).appearance,
    };
    ui.profileDraft = profileDraftHasChanges(draft, S.settings.profile, S.settings.prefs.profileAppearance) ? draft : null;
    refreshUnsavedSettingsBanner();
    const previewName = $('#profile-preview-name');
    if (previewName) previewName.textContent = draft.preferredName.trim() || draft.name.trim() || 'seu nome';
    const previewGreeting = $('#profile-preview-greeting');
    if (previewGreeting) previewGreeting.textContent = profileGreeting(draft.appearance.greeting);
  }
  if (el.dataset.dlg && ui.dlg) {
    if (ui.dlg.type === 'habit-edit' && ui.dlg.d.waterSuggestion && el.dataset.dlg === 'waterGoalMl') {
      ui.dlg.d.waterGoalEdited = true;
    }
    setPath(ui.dlg.d, el.dataset.dlg, el.type === 'checkbox' ? el.checked : el.value);
    if (ui.dlg.type === 'account' && el.dataset.dlg === 'bank') {
      const bank = findBankByName(el.value, true);
      const logo = $('#dlg [data-bank-preview-logo]');
      const fallback = $('#dlg [data-bank-preview-fallback]');
      if (logo && fallback) {
        if (bank) logo.querySelector('img').src = bank[1].logo;
        logo.hidden = !bank;
        fallback.hidden = Boolean(bank);
      }
    }
    if (ui.dlg.type === 'payinv' && ['amount', 'times', 'interest'].includes(el.dataset.dlg)) {
      const preview = $('#dlg [data-pay-invoice-preview]');
      if (preview) preview.textContent = invoicePlanPreviewText(ui.dlg.d);
    }
    if (ui.dlg.type === 'habit-edit' && ui.dlg.d.waterSuggestion && el.dataset.dlg === 'waterWeightKg') {
      updateWaterSuggestionWeight(el.value);
    } else if (ui.dlg.type === 'search' && el.dataset.dlg === 'query') {
      const results = $('#global-search-results');
      if (results) results.innerHTML = globalSearchResults(el.value).s;
    } else if (ui.dlg.type === 'cycle-log' && el.dataset.dlg === 'log.sexualActivity') {
      if (!el.checked) ui.dlg.d.log.contraceptionMethods = [];
      render();
    } else if (['sex', 'accountId', 'repeat', 'installmentAmountMode', 'mode', 'type', 'tag', 'category', 'time', 'invert', 'paid'].includes(el.dataset.dlg) || el.dataset.dlg.startsWith('rows.')) {
      if (ui.dlg.type === 'impfin' && (el.dataset.dlg === 'accountId' || el.dataset.dlg === 'invert')) impRecalc(ui.dlg.d, el.dataset.dlg === 'invert');
      render();
    }
  }
  if (el.dataset.input === 'fin-search') { ui.finQ = el.value; const r = $('#tx-results'); if (r) r.innerHTML = txListHtml().s; }
  if (el.dataset.input === 'search') { ui.filters.q = el.value; const r = $('#task-results'); if (r) r.innerHTML = taskListHtml().s; }
  if (el.dataset.input === 'habit-ideas-search') {
    ui.habitIdeaQuery = el.value;
    updateHabitIdeaFilters();
  }
});
document.addEventListener('focusin', (e) => {
  const el = e.target;
  if (el instanceof HTMLInputElement && el.matches('.money-input') && el.value === '00,00') {
    el.select();
  }
});
document.addEventListener('change', (e) => {
  const el = e.target, key = el.dataset && el.dataset.change;
  if (ui.dlg && ui.dlg.type !== 'search' && el instanceof Element && el.closest('#dlg') && el.matches('input:not([type="file"]),textarea,select')) ui.dlg.dirty = true;
  if (el.dataset && el.dataset.dlg === 'bank' && ui.dlg) setPath(ui.dlg.d, 'bank', el.value);
  if (ui.dlg?.type === 'tx' && el.dataset?.dlg === 'date' && el.value !== today()) {
    ui.dlg.d.paid = false;
    ui.dlg.d.settledDate = '';
    render();
    return;
  }
  const fn = key && !SETTINGS_INPUT_CHANGES.has(key) && CHANGES[key]; if (fn) fn(el);
});
document.addEventListener('toggle', (e) => {
  const el = e.target;
  if (el.matches?.('.cycle-symptom-group') && ui.dlg?.type === 'cycle-log') {
    const openGroups = new Set(ui.dlg.d.openGroups || []);
    const closedGroups = new Set(ui.dlg.d.closedGroups || []);
    if (el.open) { openGroups.add(el.dataset.category); closedGroups.delete(el.dataset.category); }
    else { openGroups.delete(el.dataset.category); closedGroups.add(el.dataset.category); }
    ui.dlg.d.openGroups = [...openGroups];
    ui.dlg.d.closedGroups = [...closedGroups];
  }
  if (el.tagName === 'DETAILS' && el.id) { ui.openDetails[el.id.replace('d-', '')] = el.open; if (el.open) el.querySelectorAll('.habit-year-grid').forEach((grid) => { grid.scrollLeft = grid.scrollWidth; }); }
}, true);
document.addEventListener('keydown', (e) => {
  if (handlePublicKeydown(e)) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    if (ui.dlg?.type === 'onboard') return;
    e.preventDefault();
    dlgOpen('search', { query: '' });
    return;
  }
  if (e.key === 'Escape' && ui.notificationsOpen) { e.preventDefault(); closeNotifications(); return; }
  if (e.key === 'Escape' && ui.quickActionsOpen) {
    e.preventDefault();
    ui.quickActionsOpen = false;
    render();
    requestAnimationFrame(() => {
      const returnTarget = window.matchMedia('(max-width: 899px)').matches
        ? '.nav-more-trigger'
        : '.nav-quick-trigger';
      document.querySelector(returnTarget)?.focus();
    });
    return;
  }
  if (e.key === 'Escape' && ui.navigationOpen) {
    e.preventDefault();
    ui.navigationOpen = false;
    render();
    requestAnimationFrame(() => document.querySelector('[data-action="nav-more-toggle"]')?.focus());
    return;
  }
  if (!ui.dlg) return;
  if (ui.dlg.type === 'tx') {
    if (e.key === 'Escape') { e.preventDefault(); dlgClose(); }
    return;
  }
  if (e.key === 'Escape') { e.preventDefault(); dlgClose(); return; }
  if (e.key === 'Tab') {
    const f = $$('#dlg button,#dlg input:not(.sr),#dlg select,#dlg textarea,#dlg a[href]').filter((x) => !x.disabled);
    if (!f.length) return; const a = f[0], z = f[f.length - 1];
    if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
  }
});
document.addEventListener('mousedown', (e) => {
  if (e.target.id === 'dlg' && ui.dlg) dlgClose();
});


/* ========== Finanças (contas, cartões, lançamentos, orçamento, relatórios) ========== */
const catMeta = (t) => {
  if (t.type === 'tr') return { c: 'color-mix(in srgb, var(--accent) 38%, var(--muted))', i: 'transfer' };
  return catInfo(t.type === 'in' ? 'in' : 'out', t.category);
};
const outMeta = (n) => catInfo('out', n);
const ACC_ICON = { checking: 'bank', savings: 'trendUp', investment: 'trendUp', credit: 'card' };
const isPaid = transactionIsPaid;
const isCredit = isCreditAccount;
const accById = (id) => S.finance.accounts.find((a) => a.id === id);
const accountDisplayName = (account) => {
  const name = account?.name || '';
  const bank = Object.values(BANKS).find((item) => {
    const prefix = name.slice(0, item.name.length);
    return prefix.toLocaleLowerCase('pt-BR') === item.name.toLocaleLowerCase('pt-BR')
      && (!name[item.name.length] || /[\s\d]/.test(name[item.name.length]));
  });
  return bank
    ? bank.name + name.slice(bank.name.length)
    : name ? name[0].toLocaleUpperCase('pt-BR') + name.slice(1) : name;
};
const accountTypeLabel = (account) => ACCOUNT_TYPES[account.type] || account.type;
const accountOptionLabel = (account) => `${accountDisplayName(account)} · ${accountTypeLabel(account)}`;
const accName = (id) => { const account = accById(id); return account ? accountDisplayName(account) : 'Conta removida'; };
const shiftMonth = (ym, n) => { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
const ymLabel = (ym) => { const [y, m] = ym.split('-').map(Number); return `${MESES_L[m - 1]} de ${y}`; };
const signed = signedAmount;
const accBalance = (account) => balanceForAccount(account, S.finance.tx);
const netBalance = () => netAccountBalance(S.finance.accounts, S.finance.tx);
const monthStats = (month) => summarizeMonth(S.finance.tx, month, accById);
const byCategory = summarizeByCategory;

/* ---- fatura do cartão ---- */
const invoiceYM = (card, date) => invoiceMonth(card, date, shiftMonth, pk);
const cardInfo = (card) => calculateCardInfo(S.finance, card, today(), {
  shiftMonth,
  parseDate: pk,
  accountBalance: accBalance,
});
function nextCardDueDate(card) {
  const due = cardInfo(card).due;
  if (!due) return addMonths(today(), 1);
  if (due > today()) return due;
  const nextMonth = shiftMonth(due.slice(0, 7), 1);
  const lastDay = new Date(Number(nextMonth.slice(0, 4)), Number(nextMonth.slice(5, 7)), 0).getDate();
  return `${nextMonth}-${pad(Math.min(Number(due.slice(8, 10)), lastDay))}`;
}
function scheduledInvoicePrincipal(cardId) {
  return S.finance.tx
    .filter((transaction) => transaction.invoiceInstallment
      && transaction.toAccountId === cardId
      && !isPaid(transaction))
    .reduce((sum, transaction) => sum + transaction.cents - (transaction.interestCents || 0), 0);
}
const cardDueLabel = (date) => {
  if (!date) return '';
  const days = dayDiff(date, today());
  if (days < 0) return h`<span class="badge bad">Vencimento passou</span>`;
  if (days === 0) return h`<span class="badge warn">Vence hoje</span>`;
  if (days <= 7) return h`<span class="badge warn">Vence em ${days} ${plural(days, 'dia', 'dias')}</span>`;
  return '';
};

/* ---- gráficos ---- */
function donut(items, total, label) {
  let off = 0;
  const segs = items.map((it) => { const p = it.v / total * 100, visible = Math.max(0, p - 1.25); const s = `<circle cx="21" cy="21" r="15.9155" fill="none" stroke="${it.c}" stroke-width="6" stroke-dasharray="${visible.toFixed(2)} ${(100 - visible).toFixed(2)}" stroke-dashoffset="${(25 - off).toFixed(2)}"/>`; off += p; return s; }).join('');
  return raw(`<svg class="donut" viewBox="0 0 42 42" role="img" aria-label="${esc(label)}"><circle cx="21" cy="21" r="15.9155" fill="none" stroke="var(--soft2)" stroke-width="6"/>${segs}</svg>`);
}
function flowChart(months) {
  const W = 320, H = 160, top = 10, bot = 24, bw = 14, n = months.length, step = W / n, max = Math.max(1, ...months.flatMap((m) => [m.i, m.o])) * 1.1, y = (v) => top + (H - top - bot) * (1 - v / max);
  const bars = months.map((m, k) => { const x = step * k + step / 2; return `<rect class="bi" x="${x - bw - 1}" y="${y(m.i)}" width="${bw}" height="${Math.max(0, H - bot - y(m.i))}" rx="4"><title>${esc(m.l)}: receitas ${esc(brl(m.i))}</title></rect><rect class="bo" x="${x + 1}" y="${y(m.o)}" width="${bw}" height="${Math.max(0, H - bot - y(m.o))}" rx="4"><title>${esc(m.l)}: despesas ${esc(brl(m.o))}</title></rect><text x="${x}" y="${H - 7}" text-anchor="middle">${esc(m.l)}</text>`; }).join('');
  return raw(`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Receitas e despesas dos últimos ${n} meses. ${esc(months.map((m) => `${m.l}: receitas ${brl(m.i)}, despesas ${brl(m.o)}`).join('; '))}">${bars}</svg>`);
}

/* ---- componentes ---- */
const catChip = (meta) => h`<span class="ci" style="--c:${meta.c}">${icon(meta.i, 18)}</span>`;
function accountChip(account) {
  const bank = account.bank !== OTHER_BANK && Object.hasOwn(BANKS, account.bank) ? BANKS[account.bank] : null;
  return bank
    ? h`<span class="bank-logo" aria-hidden="true"><img src="${bank.logo}" alt=""></span>`
    : catChip({ c: '#5fa68a', i: ACC_ICON[account.type] || 'bank' });
}
function finRow(t, { showDate = false } = {}) {
  const meta = catMeta(t), acc = accById(t.accountId), paid = isPaid(t), tr = t.type === 'tr';
  const sub = tr
    ? h`<span class="user-value">${accName(t.accountId)} → ${accName(t.toAccountId)}</span>`
    : h`<span class="expense-name">${expenseTitle(t.category)}</span> · <span class="user-value">${accName(t.accountId)}</span>`;
  const title = t.type === 'out' ? expenseTitle(t.desc || t.category) : t.desc || (tr ? 'Transferência' : t.category);
  const canToggle = t.invoiceInstallment || (!tr && !isCredit(acc));
  const paymentAction = t.invoiceInstallment
    ? (paid ? 'Voltar parcela da fatura para pendente' : 'Marcar parcela da fatura como paga')
    : (t.type === 'in' ? 'Marcar como recebido' : 'Marcar como pago');
  return h`<li class="fr ${paid ? '' : 'pend'}" data-k="${t.id}">
    <button class="fr-main" data-action="edit-tx" data-id="${t.id}" aria-label="Editar ${t.type === 'out' ? 'despesa' : t.type === 'in' ? 'receita' : 'transferência'} de ${brl(t.cents)}: ${title}">${catChip(meta)}
      <span class="grow"><span class="ttl ${t.type === 'out' ? 'expense-name' : ''}">${title}</span><span class="meta2">${showDate ? h`<span class="tx-date">${t.date === today() ? 'Hoje' : shortDate(t.date)}</span> · ` : ''}${sub}${paid && t.settledDate && t.settledDate !== t.date ? h` · ${t.type === 'in' ? 'recebido' : 'pago'} em ${shortDate(t.settledDate)}` : ''}${t.type === 'out' || t.invoiceInstallment ? t.interestCents != null ? h` · ${t.interestCents === 0 ? 'Sem juros' : h`Juros ${money(t.interestCents)}`}` : '' : ''}${t.type === 'out' && t.anticipatedDate ? h` · Antecipada em ${shortDate(t.anticipatedDate)}` : ''}${!paid ? h` · <span class="m-warn">${t.type === 'in' ? 'A receber' : 'A pagar'}${t.date < today() ? ' · atrasado' : ''}</span>` : ''}</span></span>
      <span class="amt ${t.type}">${t.type === 'in' ? '+' : t.type === 'out' ? '−' : ''}${money(t.cents)}</span></button>
    ${canToggle ? h`<button class="pk ${paid ? 'on' : ''}" role="switch" aria-checked="${paid ? 'true' : 'false'}" data-action="tx-paid" data-id="${t.id}" aria-label="${paymentAction}: ${title}" title="${paymentAction}">${icon('check', 16)}</button>` : h`<span class="pk-sp"></span>`}
  </li>`;
}
const monthNav = () => h`<div class="mnav"><button class="ibtn" data-action="fin-month" data-n="-1" aria-label="Mês anterior">${icon('chevLeft', 20)}</button><button class="mlabel" data-action="fin-month" data-n="0" aria-label="Voltar para o mês atual">${cap(ymLabel(ui.finMonth))}</button><button class="ibtn" data-action="fin-month" data-n="1" aria-label="Próximo mês">${icon('chevRight', 20)}</button></div>`;
const FIN_TABS = [['resumo', 'Resumo', 'home'], ['lancamentos', 'Lançamentos', 'list'], ['contas', 'Contas', 'bank'], ['cartoes', 'Cartões', 'card'], ['orcamento', 'Orçamento', 'target'], ['relatorios', 'Relatórios', 'pie']];
const finSectionPicker = () => {
  const [key] = FIN_TABS.find(([id]) => id === ui.finTab) || FIN_TABS[0];
  return h`<div class="fin-section-menu" role="group" aria-label="Seções de Finanças">${FIN_TABS.map(([id, name, sectionIcon]) => h`<button type="button" class="fin-section-option ${id === key ? 'is-active' : ''}" data-action="fin-tab" data-t="${id}" aria-pressed="${id === key}">${icon(sectionIcon, 18)}${tabLabel(name)}</button>`)}</div>`;
};
const fab = () => S.finance.accounts.length ? h`<button class="fab finance-fab" data-action="quick-actions-toggle" aria-label="Abrir ações rápidas de Finanças" aria-expanded="${String(ui.quickActionsOpen)}" aria-controls="quick-actions-menu">${icon('plus', 20)}<span>Lançamento</span></button>` : '';

/* ---- Resumo ---- */
function expenseTrendChart(ym, cur) {
  if (ym > today().slice(0, 7)) {
    return h`<p class="fine finance-trend-empty">Este mês ainda é futuro; não há evolução diária real para mostrar.</p>`;
  }
  const [year, month] = ym.split('-').map(Number);
  const lastDay = cur ? today() : `${ym}-${pad(new Date(year, month, 0).getDate())}`;
  const days = Array.from({ length: 7 }, (_, index) => addDays(lastDay, index - 6));
  const totals = days.map((day) => S.finance.tx
    .filter((transaction) => transaction.type === 'out' && transaction.date === day)
    .reduce((sum, transaction) => sum + transaction.cents, 0));
  const max = Math.max(1, ...totals);
  const x = (index) => 16 + index * 48;
  const y = (value) => 88 - value / max * 64;
  const points = totals.map((value, index) => `${x(index)},${y(value)}`).join(' ');
  const area = `M${x(0)},88 ${totals.map((value, index) => `L${x(index)},${y(value)}`).join(' ')} L${x(6)},88 Z`;
  const labels = days.map((day, index) => `<text x="${x(index)}" y="116" text-anchor="middle">${esc(shortDate(day))}</text>`).join('');
  const markers = totals.map((value, index) => `<circle class="finance-trend-point" cx="${x(index)}" cy="${y(value)}" r="4"><title>${esc(shortDate(days[index]))}: ${esc(money(value))}</title></circle>`).join('');
  const summary = days.map((day, index) => `${shortDate(day)}: ${money(totals[index])}`).join('; ');
  return raw(`<svg class="finance-trend-chart" viewBox="0 0 320 128" role="img" aria-label="Despesas nos últimos 7 dias: ${esc(summary)}"><line class="finance-trend-grid" x1="8" y1="24" x2="312" y2="24"/><line class="finance-trend-grid" x1="8" y1="56" x2="312" y2="56"/><line class="finance-trend-grid" x1="8" y1="88" x2="312" y2="88"/><path class="finance-trend-area" d="${area}"/><polyline class="finance-trend-line" points="${points}"/>${markers}${labels}</svg>`);
}

function finRitmo(ym, st, cur) {
  if (!st.outAll && !st.inAll) return '';
  const [y, m] = ym.split('-').map(Number), dim = new Date(y, m, 0).getDate(), day = cur ? Number(today().slice(8)) : dim;
  const elapsed = cur ? today() : `${ym}-${pad(dim)}`;
  const seen = st.tx.filter((t) => t.date <= elapsed), out = seen.filter((t) => t.type === 'out').reduce((s, t) => s + t.cents, 0), income = seen.filter((t) => t.type === 'in').reduce((s, t) => s + t.cents, 0);
  const prevYM = shiftMonth(ym, -1), prev = monthStats(prevYM), prevDim = new Date(Number(prevYM.slice(0, 4)), Number(prevYM.slice(5)), 0).getDate();
  const prevDay = cur ? Math.min(day, prevDim) : prevDim, prevEnd = `${prevYM}-${pad(prevDay)}`;
  const prevOut = prev.tx.filter((t) => t.type === 'out' && t.date <= prevEnd).reduce((s, t) => s + t.cents, 0);
  const avg = Math.round(out / day), proj = cur ? Math.round(out / day * dim) : null;
  const delta = prevOut ? Math.round((out - prevOut) / prevOut * 100) : null, rate = income > 0 ? Math.round((income - out) / income * 100) : null;
  const top = byCategory(seen, 'out')[0];
  return h`<section class="card finance-rhythm"><div class="head"><div><h2>Evolução das despesas<i>.</i></h2><p class="small muted">Últimos 7 dias${cur ? '' : ' do período selecionado'}</p></div></div>
    ${expenseTrendChart(ym, cur)}
    <div class="stats3"><div><b>${money(avg)}</b><span>Gasto médio por dia até ${day}</span></div>${proj !== null ? h`<div><b>${money(proj)}</b><span>Projeção com base nos dias decorridos</span></div>` : h`<div><b>${money(out)}</b><span>Despesas até o fim do mês</span></div>`}<div><b class="${delta !== null && delta > 0 ? 'err' : ''}">${delta === null ? '—' : (delta > 0 ? '+' : '') + delta + '%'}</b><span>vs. mesmo período anterior</span></div></div>
    <p class="small muted">${rate !== null ? (rate >= 0 ? `Você está guardando ${rate}% da receita deste mês.` : `As despesas superaram a receita em ${Math.abs(rate)}%.`) : 'Sem receitas registradas neste mês.'}${top ? h` Maior gasto: <span class="expense-name">${expenseTitle(top[0])}</span> (${money(top[1])}).` : ''}</p></section>`;
}
function balanceSparkline() {
  const days = Array.from({ length: 7 }, (_, index) => addDays(today(), index - 6));
  const values = days.map((day) => netAccountBalanceOn(S.finance.accounts, S.finance.tx, day));
  const min = Math.min(...values), max = Math.max(...values), range = Math.max(1, max - min);
  const points = values.map((value, index) => `${index * (100 / (values.length - 1))},${42 - ((value - min) / range * 34)}`).join(' ');
  return raw(`<svg class="balance-sparkline" viewBox="0 0 100 48" preserveAspectRatio="none" role="img" aria-label="Variação do saldo nos últimos sete dias"><polyline points="${points}"/></svg>`);
}
function categoryBars(items, total) {
  return h`<ul class="category-bars">${items.slice(0, 5).map(([name, value]) => {
    const meta = catMeta({ type: 'out', category: name });
    const percent = total ? Math.round(value / total * 100) : 0;
    return h`<li><span class="category-bar-icon" style="--category-tone:${meta.c}">${icon(meta.i, 15)}</span><span class="category-bar-copy"><span class="expense-name">${expenseTitle(name)}</span><span class="category-bar-track"><i style="width:${percent}%;--category-tone:${meta.c}"></i></span></span><b>${money(value)}</b><small>${percent}%</small></li>`;
  })}</ul>`;
}
function finResumo() {
  const F = S.finance, ym = ui.finMonth, st = monthStats(ym), cur = ym === today().slice(0, 7), bal = netBalance();
  const close = summarizeMonthlyClose(F.tx, ym, accById);
  const forecast = bal + st.inPending - st.outPending;
  const result = st.inAll - st.outAll;
  const pend = st.tx.filter((t) => !isPaid(t)).sort((a, b) => a.date.localeCompare(b.date));
  const pendingOut = pend.filter((t) => t.type === 'out');
  const pendingIn = pend.filter((t) => t.type === 'in');
  const pendingOutCents = pendingOut.reduce((sum, transaction) => sum + transaction.cents, 0);
  const pendingInCents = pendingIn.reduce((sum, transaction) => sum + transaction.cents, 0);
  const cats = byCategory(st.tx, 'out'), totOut = st.outAll;
  const cards = F.accounts.filter(isCredit);
  const recentDescription = cur ? 'Mês atual · sem lançamentos futuros.' : `Mês selecionado · ${ymLabel(ym)}.`;
  const flowMax = Math.max(st.inAll, st.outAll, 1);
  const recents = st.tx
    .filter((transaction) => !cur || transaction.date <= today())
    .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, 5);
  const bud = Object.entries(F.budgets).filter(([, b]) => b && b.cents > 0), budSpent = bud.reduce((s, [c]) => s + (cats.find(([n]) => n === c)?.[1] || 0), 0), budTot = bud.reduce((s, [, b]) => s + b.cents, 0);
  return h`${monthNav()}
    <section class="fin-hero" aria-label="Saldo atual das contas">
      <div class="fin-hero-main"><div><p class="fh-l">Saldo atual das contas</p><p class="fh-v ${bal < 0 ? 'neg' : ''}">${money(bal)}</p><p class="fh-context">Saldo real, sem incluir compras feitas no cartão.</p></div><div class="fin-hero-actions"><button class="btn sm" data-action="tx-new-in">${icon('plus', 16)}Receita</button><button class="btn sm primary" data-action="tx-new">${icon('plus', 16)}Despesa</button></div></div>
      <div class="fin-hero-trend">${balanceSparkline()}<p class="fh-s">${cur ? h`Estimativa até o fim do mês, considerando os lançamentos pendentes: <b>${money(forecast)}</b>` : h`Resumo de ${cap(ymLabel(ym))}`}</p></div>
    </section>
    <section class="finance-month-snapshot" aria-labelledby="finance-month-title">
      <div class="finance-month-heading"><div><p class="section-kicker">Seu panorama</p><h2 id="finance-month-title">Resumo do mês<i>.</i></h2></div><p class="small muted">${cap(ymLabel(ym))}</p></div>
      <div class="fh-row">
        <button type="button" class="finance-summary-stat is-income" data-action="fin-go" data-t="lancamentos" data-f="in" data-clear-fin-filters aria-label="Ver receitas lançadas no mês"><span class="finance-summary-icon" aria-hidden="true">${icon('plus', 16)}</span><span>Receitas lançadas</span><b>${money(st.inAll)}</b><span class="finance-flow-track" aria-hidden="true"><i style="width:${Math.round(st.inAll / flowMax * 100)}%"></i></span><small>${money(st.inPaid)} recebidas</small></button>
        <button type="button" class="finance-summary-stat is-expense" data-action="fin-go" data-t="lancamentos" data-f="out" data-clear-fin-filters aria-label="Ver despesas lançadas no mês"><span class="finance-summary-icon" aria-hidden="true">${icon('arrowDown', 16)}</span><span>Despesas lançadas</span><b>${money(st.outAll)}</b><span class="finance-flow-track" aria-hidden="true"><i style="width:${Math.round(st.outAll / flowMax * 100)}%"></i></span><small>${money(st.outPaid)} pagas · ${money(st.outPending)} pendentes · ${money(st.cardOut)} no cartão</small></button>
        <button type="button" class="finance-summary-stat is-result${result < 0 ? ' is-negative' : ''}" data-action="fin-go" data-t="lancamentos" data-f="todos" data-clear-fin-filters aria-label="Ver lançamentos do mês para conferir o resultado"><span class="finance-summary-icon" aria-hidden="true">${icon('pie', 16)}</span><span>Resultado</span><b>${money(result)}</b><small>no mês</small></button>
        <button type="button" class="finance-summary-stat is-open" data-action="fin-go" data-t="lancamentos" data-f="pendentes" data-clear-fin-filters aria-label="Ver lançamentos pendentes do mês"><span class="finance-summary-icon" aria-hidden="true">${icon('repeat', 16)}</span><span>Em aberto</span><b>${money(st.inPending + st.outPending)}</b><small>${money(st.inPending)} a receber · ${money(st.outPending)} a pagar</small></button>
      </div>
    </section>
    <section class="card finance-month-close" aria-labelledby="finance-month-close-title">
      <div class="head"><div><p class="section-kicker">Revisão por competência</p><h2 id="finance-month-close-title">Fechamento do mês<i>.</i></h2><p class="small muted">${cap(ymLabel(ym))} · compras no cartão entram no mês da compra; pagamento da fatura é uma transferência.</p></div></div>
      <dl class="finance-close-stats">
        <div><dt>Resultado do mês</dt><dd class="${close.resultCents < 0 ? 'is-negative' : ''}">${money(close.resultCents)}</dd></div>
        <div><dt>Já recebido</dt><dd>${money(close.inPaid)}</dd></div>
        <div><dt>Já pago em contas</dt><dd>${money(close.outPaid)}</dd></div>
        <div><dt>Pendente em contas</dt><dd>${money(close.pendingInCents + close.pendingOutCents)}</dd><small>${money(close.pendingInCents)} a receber · ${money(close.pendingOutCents)} a pagar</small></div>
        <div><dt>Lançamentos fixos</dt><dd>${money(close.recurringCents)}</dd><small>${close.recurringCount} ${plural(close.recurringCount, 'lançamento', 'lançamentos')}</small></div>
        <div><dt>Compras no cartão</dt><dd>${money(close.cardOut)}</dd><small>Não reduz o saldo das contas neste resumo.</small></div>
      </dl>
      <div class="finance-close-next">${close.topExpense
        ? h`<p><b>Maior categoria de despesa:</b> ${expenseTitle(close.topExpense[0])} · ${money(close.topExpense[1])}.</p>`
        : h`<p>Sem despesas registradas neste mês.</p>`}
        <div class="row"><button type="button" class="btn ghost sm" data-action="fin-go" data-t="lancamentos" data-f="pendentes" data-clear-fin-filters>Conferir pendências</button><button type="button" class="btn ghost sm" data-action="fin-go" data-t="relatorios">Comparar meses</button></div>
      </div>
    </section>
    ${pend.length ? h`<section class="card finance-attention"><div class="head"><div><p class="section-kicker">Próximos compromissos</p><h2>A pagar e a receber<i>.</i></h2></div><button class="btn ghost sm" data-action="fin-go" data-t="lancamentos" data-f="pendentes">Ver todos</button></div>
      <div class="finance-pending-summary">${pendingOut.length ? h`<div class="is-expense"><span>Despesas pendentes</span><b>${money(pendingOutCents)}</b><small>${pendingOut.length} ${plural(pendingOut.length, 'lançamento', 'lançamentos')}</small></div>` : ''}${pendingIn.length ? h`<div class="is-income"><span>Receitas pendentes</span><b>${money(pendingInCents)}</b><small>${pendingIn.length} ${plural(pendingIn.length, 'lançamento', 'lançamentos')}</small></div>` : ''}</div>
      <ul class="list">${pend.slice(0, 5).map(finRow)}</ul></section>` : ''}
    ${finRitmo(ym, st, cur)}
    <div class="fin-overview-grid">
      <section class="card finance-category-breakdown"><div class="head"><div><p class="section-kicker">Composição do mês</p><h2>Despesas por categoria<i>.</i></h2></div><button class="btn ghost sm" data-action="fin-go" data-t="relatorios">Relatórios</button></div>
        ${cats.length ? categoryBars(cats, totOut) : empty('Sem despesas neste mês', 'Registre uma despesa para ver a divisão por categoria.', h`<button class="btn" data-action="tx-new">${icon('plus', 16)}Registrar despesa</button>`, 'pie')}</section>
      <section class="card finance-recent"><div class="head"><div><h2>Últimos lançamentos<i>.</i></h2><p class="small muted">${recentDescription}</p></div><button class="btn ghost sm" data-action="fin-go" data-t="lancamentos">Ver todos</button></div>${recents.length ? h`<ul class="list">${recents.map((t) => finRow(t, { showDate: true }))}</ul>` : empty('Nada por aqui ainda', 'Toque em Lançamento para registrar o primeiro.', h`<button class="btn" data-action="tx-new">${icon('plus', 16)}Registrar lançamento</button>`, 'list')}</section>
      ${(bud.length || cards.length) ? h`<aside class="fin-overview-side">${bud.length ? h`<section class="card"><div class="head"><h2>Orçamento<i>.</i></h2><button class="btn ghost sm" data-action="fin-go" data-t="orcamento">Detalhes</button></div>${budBar(budSpent, budTot)}<p class="small muted">${money(budSpent)} de ${money(budTot)} nas categorias com limite</p></section>` : ''}
        ${cards.length ? h`<section class="card"><div class="head"><h2>Cartões<i>.</i></h2><button class="btn ghost sm" data-action="fin-go" data-t="cartoes">Ver cartões</button></div><ul class="list">${cards.map((c) => { const i = cardInfo(c); return h`<li>${catChip({ c: '#7c8fd4', i: 'card' })}<div class="grow"><div class="ttl">${accountDisplayName(c)}</div><span class="small muted">Compras no ciclo ${MESES_L[Number(i.ym.slice(5)) - 1]}${i.due ? ' · vence ' + shortDate(i.due) : ''}</span>${cardDueLabel(i.due)}</div><b>${money(i.total)}</b></li>`; })}</ul><p class="fine">Confira o valor e a data diretamente na fatura do banco.</p></section>` : ''}</aside>` : ''}
    </div>
    ${finFixas()}`;
}
function finFixas() {
  const rs = recList().filter((r) => !r.paused);
  if (!rs.length) return '';
  const out = rs.filter((r) => r.type === 'out').reduce((t, r) => t + r.cents, 0), inc = rs.filter((r) => r.type === 'in').reduce((t, r) => t + r.cents, 0);
  return h`<section class="card finance-fixas" aria-labelledby="fin-fixas-title"><div class="head"><div><p class="section-kicker">Todo mês</p><h2 id="fin-fixas-title">Lançamentos fixos<i>.</i></h2><p class="small muted">${rs.length} ${plural(rs.length, 'fixa ativa', 'fixas ativas')}: ${money(out)} em despesas${inc ? h` e ${money(inc)} em receitas` : ''} por mês.</p></div><button class="btn ghost sm" data-action="rec-list">${icon('repeat', 16)}Gerenciar</button></div></section>`;
}
const budBar = (spent, lim) => { const pc = lim ? Math.min(100, Math.round(spent / lim * 100)) : 0, cls = spent > lim ? 'over' : pc >= 80 ? 'near' : ''; return h`<div class="bar ${cls}" role="progressbar" aria-valuenow="${pc}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pc}%"></span></div>`; };

/* ---- Lançamentos ---- */
const FIN_FILTERS = [['todos', 'Todos'], ['out', 'Despesas'], ['in', 'Receitas'], ['tr', 'Transferências'], ['pendentes', 'Pendentes']];
function filteredTx() {
  const ym = ui.finMonth, f = ui.finFilter, q = norm(ui.finQ.trim());
  return S.finance.tx.filter((t) => {
    if (!t.date.startsWith(ym)) return false;
    if (f === 'pendentes' ? isPaid(t) : (f !== 'todos' && t.type !== f)) return false;
    if (ui.finCat && t.category !== ui.finCat) return false;
    if (ui.finAcc && t.accountId !== ui.finAcc && t.toAccountId !== ui.finAcc) return false;
    if (!q) return true;
    const accounts = [accById(t.accountId), accById(t.toAccountId)].filter(Boolean);
    const searchTerms = [
      t.desc,
      t.category,
      t.type === 'in' ? 'receita' : t.type === 'out' ? 'despesa' : 'transferência',
      ...accounts.flatMap((account) => [
        accountDisplayName(account),
        accountTypeLabel(account),
        bankFieldValue(account.bank),
      ]),
    ];
    return searchTerms.some((term) => norm(term || '').includes(q));
  }).sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0));
}
function txListHtml() {
  const r = filteredTx();
  if (!r.length) {
    const filtered = !!(ui.finQ || ui.finAcc || ui.finCat || ui.finFilter !== 'todos');
    return empty(
      'Nenhum lançamento aqui',
      filtered ? 'Troque os filtros para ver mais.' : 'Toque em Lançamento para registrar o primeiro deste mês.',
      filtered
        ? h`<button class="btn" data-action="fin-filters-clear">Limpar filtros</button>`
        : h`<button class="btn" data-action="tx-new">${icon('plus', 16)}Registrar lançamento</button>`,
      filtered ? 'search' : 'list',
    );
  }
  const days = []; r.forEach((t) => { const l = days[days.length - 1]; if (l && l.d === t.date) l.items.push(t); else days.push({ d: t.date, items: [t] }); });
  return raw('<div class="finance-results-groups">' + days.map((g) => { const net = g.items.reduce((s, t) => s + (t.type === 'in' ? t.cents : t.type === 'out' ? -t.cents : 0), 0); return h`<section class="grp"><h3 class="gh">${g.d === today() ? 'Hoje' : cap(longDate(g.d))}<span class="grow"></span><span class="gsum">${net ? h`${net > 0 ? '+' : '−'}${money(Math.abs(net))}` : ''}</span></h3><ul class="list">${g.items.map(finRow)}</ul></section>`.s; }).join('') + '</div>');
}
function finLanc() { return ui.finView === 'cal' ? h`${monthNav()}${finTools()}${finCal()}` : finLancList(); }
function finLancList() {
  const st = monthStats(ui.finMonth);
  return h`${monthNav()}${finTools()}
    <section class="card"><div class="scroll-x" role="group" aria-label="Filtrar lançamentos">${FIN_FILTERS.map(([k, l]) => h`<button class="chip" aria-pressed="${ui.finFilter === k}" data-action="fin-filter" data-f="${k}">${l}</button>`)}</div>
      <div class="row fin-filter-row"><label class="search"><span class="sr">Buscar lançamentos</span>${icon('search', 18)}<input type="search" id="fq" data-keep value="${ui.finQ}" placeholder="Descrição, categoria, conta ou banco" data-input="fin-search"></label>
        <label><span class="sr">Filtrar por categoria</span><select data-change="fin-cat"><option value="">Categorias</option>${[...new Set([...catNames('out'), ...catNames('in')])].map((c) => h`<option class="expense-name" value="${c}" ${ui.finCat === c ? raw('selected') : ''}>${expenseTitle(c)}</option>`)}</select></label>
        <label><span class="sr">Filtrar por conta</span><select data-change="fin-acc"><option value="">Todas as contas</option>${S.finance.accounts.map((a) => h`<option class="user-value" value="${a.id}" ${ui.finAcc === a.id ? raw('selected') : ''}>${accountOptionLabel(a)}</option>`)}</select></label></div>
      <p class="small muted">Receitas <b class="fin-income">${money(st.inAll)}</b> · Despesas <b>${money(st.outAll)}</b></p>
      <div class="row fin-export-actions"><button class="btn ghost sm" data-action="fin-csv">${icon('download', 16)}Exportar <span class="case-preserve">CSV</span></button></div>
      <div id="tx-results">${txListHtml()}</div></section>`;
}

/* ---- Contas e cartões ---- */
function creditCardCard(card, paymentAccounts) {
  const info = cardInfo(card), percent = card.limitCents ? Math.min(100, Math.round(info.used / card.limitCents * 100)) : 0;
  const scheduledInstallments = S.finance.tx.filter((transaction) => transaction.invoiceInstallment
    && transaction.toAccountId === card.id && !isPaid(transaction));
  const scheduledTotal = scheduledInstallments.reduce((sum, transaction) => sum + transaction.cents, 0);
  const bankName = card.bank === OTHER_BANK ? 'outro banco / não listado' : Object.hasOwn(BANKS, card.bank) ? BANKS[card.bank].name : card.bank;
  const paymentAccount = paymentAccounts.find((account) => account.id === card.linkedAccountId);
  const name = accountDisplayName(card);
  return h`<li class="cc"><div class="cc-top">${card.bank ? accountChip(card) : catChip({ c: '#7c8fd4', i: 'card' })}<span class="grow"><span class="ttl">${name}</span><span class="small muted">${bankName ? h`<span class="user-value">${bankName}</span> · ` : ''}${card.closingDay ? 'Fecha dia ' + card.closingDay : ''}${card.dueDay ? ' · vence dia ' + card.dueDay : ''}</span>${cardDueLabel(info.due)}</span><button class="ibtn" data-action="acct-edit" data-id="${card.id}" aria-label="Editar cartão ${name}${bankName ? ', ' + bankName : ''}">${icon('pencil', 18)}</button></div>
    <div class="cc-inv"><span class="small muted">Compras no ciclo ${MESES_L[Number(info.ym.slice(5)) - 1]}${info.due ? ' · vence ' + shortDate(info.due) : ''}</span><b class="cc-v">${money(info.total)}</b></div>
    ${card.limitCents ? h`<div class="bar ${percent >= 100 ? 'over' : percent >= 80 ? 'near' : ''}" role="progressbar" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100" aria-label="Limite usado do cartão ${name}"><span style="width:${percent}%"></span></div><p class="small muted">Usado ${money(info.used)} de ${money(card.limitCents)} · disponível ${money(info.avail)}</p>` : ''}
    ${paymentAccount ? h`<p class="small muted">Conta preferencial para pagamento: <span class="user-value">${accountOptionLabel(paymentAccount)}</span></p>` : ''}
    ${scheduledInstallments.length ? h`<p class="small muted">${scheduledInstallments.length} ${plural(scheduledInstallments.length, 'parcela de fatura programada', 'parcelas de fatura programadas')} · ${money(scheduledTotal)} pendentes. Não descontadas do saldo da conta.</p>` : ''}
    <button class="btn sm" data-action="pay-inv" data-id="${card.id}" ${info.used > 0 && paymentAccounts.length ? '' : raw('disabled')}>Pagar fatura</button></li>`;
}
function finContas() {
  const F = S.finance, accs = F.accounts.filter((a) => !isCredit(a));
  return h`<section class="card flat"><div><p class="small muted">Saldo das contas (sem cartões)</p><p class="fh-v ${netBalance() < 0 ? 'neg' : ''}">${money(netBalance())}</p></div></section>
    <div class="head"><h2>Contas<i>.</i></h2><button class="btn sm" data-action="acct-new">${icon('plus', 16)}Nova conta</button></div>
    ${accs.length ? h`<ul class="cards">${accs.map((a) => { const balance = accBalance(a), bankName = a.bank === OTHER_BANK ? 'outro banco / não listado' : Object.hasOwn(BANKS, a.bank) ? BANKS[a.bank].name : a.bank, name = accountDisplayName(a); return h`<li><button class="acc" data-action="acct-edit" data-id="${a.id}" aria-label="Editar conta ${name}${bankName ? ', ' + bankName : ''}, ${balance < 0 ? 'saldo negativo de ' + brl(Math.abs(balance)) : 'saldo ' + brl(balance)}">${accountChip(a)}<span class="grow"><span class="ttl">${name}</span><span class="small muted">${ACCOUNT_TYPES[a.type] || a.type}${bankName ? h` · <span class="user-value">${bankName}</span>` : ''}</span></span><b class="${balance < 0 ? 'neg' : ''}">${money(balance)}</b></button></li>`; })}</ul>` : h`<div class="card">${empty('Nenhuma conta ainda', 'Cadastre uma conta corrente, poupança ou investimento. O Aurora não se conecta a bancos: tudo é digitado por você.', h`<button class="btn primary" data-action="acct-new">Criar conta</button>`, 'wallet')}</div>`}
    <p class="small muted">Cartões de crédito ficam na seção Cartões para separar faturas e limites do saldo das contas.</p>`;
}
function finCartoes() {
  const cards = S.finance.accounts.filter(isCredit);
  const paymentAccounts = S.finance.accounts.filter((account) => !isCredit(account));
  const outstanding = cards.reduce((sum, card) => sum + cardInfo(card).used, 0);
  return h`<section class="card flat"><p class="small muted">Total em aberto nos cartões</p><p class="fh-v">${money(outstanding)}</p><p class="fh-context">Esse valor não faz parte do saldo disponível das contas.</p></section>
    <div class="head"><div><h2>Cartões de crédito<i>.</i></h2><p class="small muted">Faturas, limites e pagamentos registrados manualmente.</p></div>${cards.length ? h`<button class="btn sm" data-action="acct-new-card">${icon('plus', 16)}Novo cartão</button>` : ''}</div>
    ${cards.length ? h`<ul class="cards">${cards.map((card) => creditCardCard(card, paymentAccounts))}</ul>` : h`<section class="card">${empty('Nenhum cartão de crédito', 'Cadastre um cartão para acompanhar o valor em aberto, o limite e o vencimento da fatura.', h`<button class="btn primary" data-action="acct-new-card">${icon('plus', 16)}Cadastrar cartão</button>`, 'card')}</section>`}`;
}

/* ---- Orçamento e objetivos ---- */
function finOrc() {
  const F = S.finance, ym = ui.finMonth, st = monthStats(ym), spent = Object.fromEntries(byCategory(st.tx, 'out'));
  const names = [...new Set([...catNames('out'), ...Object.keys(spent), ...Object.keys(F.budgets)])].filter((n) => n !== 'Estudos' || spent[n] || F.budgets[n]);
  const rows = names.map((n) => ({ n, sp: spent[n] || 0, lim: (F.budgets[n] || {}).cents || 0 })).sort((a, b) => (b.lim > 0) - (a.lim > 0) || b.sp - a.sp);
  const limited = rows.filter((r) => r.lim > 0), tl = limited.reduce((s, r) => s + r.lim, 0), ts = limited.reduce((s, r) => s + r.sp, 0);
  return h`${monthNav()}
    <section class="card"><div class="head"><h2>Limites do mês<i>.</i></h2><button class="btn ghost sm" data-action="category-manager">Gerenciar categorias</button></div>
      ${limited.length ? h`<div><div class="row budget-total-row"><b>${money(ts)}</b><span class="small muted">de ${money(tl)}</span></div>${budBar(ts, tl)}<p class="small budget-summary-note ${ts > tl ? 'err' : 'muted'}">${ts > tl ? h`Passou ${money(ts - tl)} do limite total.` : h`Restam ${money(tl - ts)} nas categorias com limite.`}</p></div>` : h`<p class="small muted">Defina um limite mensal para as categorias em que quer controlar os gastos. Toque em uma categoria abaixo.</p>`}
      <ul class="list budget-list">${rows.map((r) => { const m = outMeta(r.n), over = r.lim && r.sp > r.lim; return h`<li><button class="fr-main" data-action="budget-edit" data-c="${r.n}" aria-label="Definir limite de ${r.n}">${catChip(m)}<span class="grow"><span class="ttl expense-name">${expenseTitle(r.n)}</span>${r.lim ? h`<span class="meta2">${money(r.sp)} de ${money(r.lim)}${over ? h` · <span class="m-bad">acima em ${money(r.sp - r.lim)}</span>` : h` · restam ${money(r.lim - r.sp)}`}</span>${budBar(r.sp, r.lim)}` : h`<span class="meta2">${r.sp ? h`${money(r.sp)} gastos · ` : ''}sem limite</span>`}</span>${icon('chevRight', 16)}</button></li>`; })}</ul></section>
    <section class="card"><div class="head"><h2>Objetivos</h2>${F.goals.length ? h`<button class="btn sm" data-action="goal-new">${icon('plus', 16)}Novo objetivo</button>` : ''}</div>
      ${F.goals.length ? h`<ul class="goal-list">${F.goals.map((g) => { const pc = g.targetCents ? Math.min(100, Math.round(g.savedCents / g.targetCents * 100)) : 0; const complete = g.savedCents >= g.targetCents; return h`<li class="goal-item${complete ? ' is-complete' : ''}"><div class="goal-heading"><span class="ttl">${g.name}${g.sample ? h` <span class="badge">Exemplo</span>` : ''}${complete ? h` <span class="badge ok">Concluído</span>` : ''}</span><b class="goal-percent">${pc}%</b></div><div class="bar goal-progress" role="progressbar" aria-valuenow="${pc}" aria-valuemin="0" aria-valuemax="100" aria-label="Progresso de ${g.name}"><span style="width:${pc}%"></span></div><span class="small muted">${money(g.savedCents)} de ${money(g.targetCents)} · ${g.deadline ? 'até ' + shortDate(g.deadline) : 'Sem prazo'}</span><div class="goal-actions"><button class="btn sm" data-action="goal-edit" data-id="${g.id}" aria-label="Editar objetivo ${g.name}">Editar</button><button class="btn sm" data-action="goal-dep" data-id="${g.id}">Guardar</button><button class="ibtn" data-action="goal-del" data-id="${g.id}" aria-label="Excluir objetivo ${g.name}">${icon('trash', 18)}</button></div></li>`; })}</ul>` : empty('Nenhum objetivo ainda', 'Crie um objetivo, como uma viagem ou reserva de emergência, e acompanhe quanto já guardou.', h`<button class="btn primary" data-action="goal-new">${icon('plus', 16)}Criar primeiro objetivo</button>`, 'target')}</section>`;
}

/* ---- Relatórios ---- */
function finRel() {
  const ym = ui.finMonth, kind = ui.repKind;
  const st = reportMonthStats(S.finance.tx, ym, accById, ui.repBasis);
  const list = byCategory(st.tx, kind), total = list.reduce((s, [, v]) => s + v, 0);
  const col = (n) => kind === 'out' ? outMeta(n).c : catMeta({ type: 'in', category: n }).c;
  const months = Array.from({ length: 6 }, (_, i) => { const m = shiftMonth(ym, i - 5), s = reportMonthStats(S.finance.tx, m, accById, ui.repBasis); return { l: MESES[Number(m.slice(5)) - 1], i: s.inAll, o: s.outAll }; });
  const avgOut = Math.round(months.reduce((s, m) => s + m.o, 0) / 6);
  return h`${monthNav()}
    <section class="card"><div class="seg" role="group" aria-label="Período do relatório"><button type="button" aria-pressed="${ui.repBasis === 'competence'}" data-action="rep-basis" data-b="competence">Competência</button><button type="button" aria-pressed="${ui.repBasis === 'cash'}" data-action="rep-basis" data-b="cash">Caixa</button></div>
      <p class="fine">${ui.repBasis === 'cash'
        ? 'Por data de pagamento ou recebimento. Pagamentos de fatura entram como saída no dia em que foram registrados; lançamentos antigos sem data de liquidação usam a data do lançamento.'
        : 'Por data em que a receita ou despesa aconteceu. Compras no cartão aparecem neste mês, independentemente do pagamento da fatura.'}</p>
      <div class="seg" role="group" aria-label="Tipo"><button type="button" aria-pressed="${kind === 'out'}" data-action="rep-kind" data-k="out">Despesas</button><button type="button" aria-pressed="${kind === 'in'}" data-action="rep-kind" data-k="in">Receitas</button></div>
      ${list.length ? h`<div class="donut-row"><div class="donut-w">${donut(list.map(([n, v]) => ({ v, c: col(n) })), total, (kind === 'out' ? 'Despesas' : 'Receitas') + ' do mês por categoria')}<div class="dc"><b>${money(total)}</b><span>${kind === 'out' ? 'gastos' : 'recebidos'}</span></div></div></div>
        <ul class="list">${list.map(([n, v]) => h`<li><span class="sw" style="background:${col(n)}"></span><span class="grow ttl ${kind === 'out' ? 'expense-name' : ''}">${kind === 'out' ? expenseTitle(n) : n}</span><span class="small muted">${Math.round(v / total * 100)}%</span><b>${money(v)}</b></li>`)}</ul>` : empty(kind === 'out' ? 'Sem despesas neste mês' : 'Sem receitas neste mês', 'Registre lançamentos para ver o relatório.', h`<button class="btn" data-action="tx-new">${icon('plus', 16)}Registrar lançamento</button>`, kind === 'out' ? 'pie' : 'wallet')}</section>
    ${finCompare()}
    <section class="card"><h2>Últimos 6 meses<i>.</i></h2>${flowChart(months)}<p class="fine"><span class="lg finance-income"></span>receitas <span class="lg finance-expense"></span>despesas</p><p class="small muted">Média de despesas: <b>${money(avgOut)}</b> por mês.</p></section>`;
}

function viewFinancas() {
  const g = gate('finances', 'Finanças'); if (g) return h`${areaNav('financas')}${areaPageTitle('financas', 'Finanças')}${financePrivacyNotice()}${g}`;
  const panel = { resumo: finResumo, lancamentos: finLanc, contas: finContas, cartoes: finCartoes, orcamento: finOrc, relatorios: finRel }[ui.finTab] || finResumo;
  const noAcc = !S.finance.accounts.length;
  const createAction = noAcc ? '' : h`<button class="btn primary finance-page-action" data-action="tx-new">${icon('plus', 18)}Novo lançamento</button>`;
  const emptyAccounts = h`<section class="card">${empty('Comece por uma conta', 'Cadastre uma conta corrente, poupança ou investimento. Depois, receitas e despesas aparecem no resumo.', h`<button class="btn primary" data-action="acct-new">${icon('plus', 18)}Criar primeira conta</button>`, 'wallet')}</section>`;
  return h`${areaNav('financas')}${areaPageTitle('financas', 'Finanças', createAction)}${financePrivacyNotice()}
    <div class="fin-section-content">${noAcc ? h`${finSectionPicker()}${ui.finTab === 'cartoes' ? finCartoes() : emptyAccounts}` : h`${finSectionPicker()}${panel()}`}</div>${noAcc ? '' : h`${fab()}<div class="fab-clearance" aria-hidden="true"></div>`}`;
}

/* ========== Diálogos de Finanças ========== */
const moneyIn = (c) => (c ? (c / 100).toFixed(2).replace('.', ',') : '');
function anticipationCandidates(groupId, fromDate = today()) {
  const group = S.finance.tx.filter((transaction) => (
    transaction.groupId === groupId && transaction.type === 'out'
  ));
  const accountId = group[0]?.accountId;
  const credit = isCredit(accById(accountId));
  return group
    .filter((transaction) => transaction.accountId === accountId
      && transaction.date >= today()
      && transaction.date >= fromDate
      && !transaction.anticipatedDate
      && (credit || !isPaid(transaction)))
    .sort((a, b) => a.date.localeCompare(b.date));
}
function newTxDlg(kind = 'out', preferCredit = false) {
  const accs = S.finance.accounts;
  const defaults = recentTransactionDefaults(kind, preferCredit);
  const first = accs.find((account) => account.id === defaults.accountId)
    || (preferCredit ? accs.find(isCredit) : null)
    || accs.find((account) => !isCredit(account))
    || accs[0];
  const second = accs.find((account) => account.id === defaults.toAccountId && account.id !== first?.id)
    || accs.find((account) => account.id !== first?.id);
  dlgOpen('tx', {
    kind,
    amount: '',
    desc: '',
    category: defaults.category,
    accountId: first ? first.id : '',
    toAccountId: second?.id || '',
    date: today(),
    settledDate: today(),
    paid: true,
    interest: '0,00',
    repeat: 'none',
    currentInstallment: '1',
    installmentAmountMode: 'total',
    times: '2',
  });
}
function recentTransactionDefaults(kind, preferCredit = false) {
  const categoryType = kind === 'in' ? 'in' : 'out';
  const categories = catNames(categoryType);
  const accountAllowed = (account) => account && (kind === 'tr' || kind === 'in' ? !isCredit(account) : true);
  const latest = S.finance.tx
    .map((transaction, index) => ({ transaction, index }))
    .filter(({ transaction }) => transaction.type === kind)
    .sort((a, b) => Number(b.transaction.createdAt || 0) - Number(a.transaction.createdAt || 0) || b.index - a.index)
    .map(({ transaction }) => transaction);
  const recent = latest.find((transaction) => {
    const account = S.finance.accounts.find((item) => item.id === transaction.accountId);
    return accountAllowed(account)
      && (kind === 'tr'
        ? S.finance.accounts.some((item) => item.id === transaction.toAccountId && item.id !== account.id)
        : categories.includes(transaction.category));
  });
  const preferredCredit = preferCredit
    ? latest.find((transaction) => {
      const account = S.finance.accounts.find((item) => item.id === transaction.accountId);
      return isCredit(account) && categories.includes(transaction.category);
    })
    : null;
  return {
    accountId: (preferredCredit || recent)?.accountId || '',
    category: (preferredCredit || recent)?.category || categories[0],
    toAccountId: kind === 'tr' ? recent?.toAccountId || '' : '',
  };
}
const financeDialogViews = createFinanceDialogViews({
  ui, S, catNames, CAT_ICONS, CATEGORY_ICON_LABELS, LIST_COLORS,
  accountOptionLabel, accById, isCredit, expenseTitle, topCategoryNames,
  categoryMatch, recById: (...args) => recById(...args), today, dlgWrap, dlgField, closeBtn,
  anticipationCandidates,
});
function dlgTx() { return financeDialogViews.transaction(); }
function dlgCategoryManager() {
  const renderCategoryNode = (kind, category) => {
    const subcategories = Array.isArray(category.subcategories) ? category.subcategories : [];
    const editButton = (name, parent = '') => h`<button type="button" class="ibtn category-manager-edit" data-action="category-edit" data-kind="${kind}" data-name="${name}" data-parent="${parent}" aria-label="Personalizar categoria ${name}">${icon('pencil', 16)}</button>`;
    return h`<li class="category-manager-item">
      ${catChip(catInfo(kind, category.name))}
      <span class="grow ttl">${kind === 'out' ? expenseTitle(category.name) : category.name}</span>
      ${subcategories.length ? h`<span class="muted small">${subcategories.length} subcategoria${subcategories.length > 1 ? 's' : ''}</span>` : ''}
      ${editButton(category.name)}
    </li>${subcategories.length ? h`<li class="category-manager-sublist"><ul class="list category-manager-list category-manager-subcategories">${subcategories.map((subcategory) => h`<li>${catChip(catInfo(kind, `${category.name} > ${categoryLeafName(subcategory)}`))}<span class="grow ttl">${kind === 'out' ? expenseTitle(`${category.name} > ${categoryLeafName(subcategory)}`) : `${category.name} > ${categoryLeafName(subcategory)}`}</span>${editButton(categoryLeafName(subcategory), category.name)}</li>`)}</ul></li>` : ''}`;
  };
  const categoryGroup = (kind, label) => h`<section class="category-manager-group">
    <div class="head"><h3>${label}</h3><button type="button" class="btn sm" data-action="category-new" data-kind="${kind}">${icon('plus', 16)}Adicionar</button></div>
    <ul class="list category-manager-list">${categoryEntries(kind).map((category) => renderCategoryNode(kind, category))}</ul>
  </section>`;
  return dlgWrap(h`<div class="head"><div><h2 id="dt">Gerenciar categorias<i>.</i></h2><p class="small muted">Organize as categorias usadas em lançamentos e limites. Você pode criar categorias principais e subcategorias.</p></div>${closeBtn}</div>
    ${categoryGroup('out', 'Despesas')}
    ${categoryGroup('in', 'Receitas')}`,
    h`<button type="button" class="btn back" data-action="dlg-close">Fechar</button>`);
}
function dlgCategoryNew() {
  const d = ui.dlg.d, kind = d.kind, editing = !!d.editName;
  const label = kind === 'in' ? 'receita' : 'despesa';
  const parents = topCategoryNames(kind);
  return dlgWrap(h`<div class="head"><div><h2 id="dt">${editing ? 'Personalizar categoria' : `Nova categoria de ${label}`}<i>.</i></h2><p class="small muted">${editing ? 'A cor e o ícone também aparecem nos lançamentos.' : 'Ela ficará disponível nos próximos lançamentos.'}</p></div>${closeBtn}</div>
    <form id="dlgform" class="form" data-form="dlg-category">
      ${!editing && parents.length ? dlgField('Categoria pai (opcional)', h`<select data-dlg="parent"><option value="">Nenhuma</option>${parents.map((name) => h`<option value="${name}" ${d.parent === name ? raw('selected') : ''}>${kind === 'out' ? expenseTitle(name) : name}</option>`)}</select>`, 'full') : ''}
      ${dlgField('Nome da categoria', h`<input id="f0" type="text" data-dlg="name" value="${d.name || ''}" maxlength="30" placeholder="${kind === 'in' ? 'Ex.: Venda de itens' : 'Ex.: Pets'}" required autocomplete="off">`, 'full')}
      ${dlgField('Ícone', h`<select data-dlg="icon">${CAT_ICONS.map((name) => h`<option value="${name}" ${name === (d.icon || 'tag') ? raw('selected') : ''}>${CATEGORY_ICON_LABELS[name]}</option>`)}</select>`)}
      ${dlgField('Cor', h`<input type="color" data-dlg="color" value="${d.color || LIST_COLORS[0]}" aria-label="Cor da categoria">`)}
    </form>`,
    h`<button type="button" class="btn back" data-action="category-manager">Voltar</button><button type="submit" class="btn primary" form="dlgform">${editing ? 'Salvar' : 'Adicionar'}</button>`);
}
function dlgAccount() {
  const d = ui.dlg.d, edit = !!d.id, card = d.type === 'credit';
  const types = Object.entries(ACCOUNT_TYPES).filter(([key]) => key !== 'credit');
  const paymentAccounts = S.finance.accounts.filter((account) => !isCredit(account));
  const typeDetails = {
    checking: 'Uso diário: pagar e receber.',
    savings: 'Dinheiro guardado e separado.',
    investment: 'Investimentos acompanhados junto ao saldo total.',
  };
  const bankValue = bankFieldValue(d.bank);
  const initialBank = findBankByName(bankValue, true);
  return dlgWrap(h`<div class="head head-nowrap"><h2 id="dt">${edit ? card ? 'Editar cartão' : 'Editar conta' : card ? 'Novo cartão' : 'Nova conta'}<i>.</i></h2>${closeBtn}</div>
    <form id="dlgform" class="form" data-form="dlg-account">
      ${dlgField(card ? 'Nome do cartão' : 'Nome da conta', h`<input id="f0" type="text" data-dlg="name" value="${d.name}" maxlength="40" required placeholder="${card ? 'Ex.: Nubank Platinum' : 'Ex.: Nubank 1'}" autocomplete="off">`, 'full')}
      ${!card ? h`<fieldset class="f full account-type-field"><legend class="f-label">Tipo da conta</legend><p class="account-type-help">Contas correntes, poupanças e investimentos fazem parte do saldo total. Cartões são cadastrados separadamente.</p><div class="account-type-picker" role="radiogroup" aria-label="Tipo da conta">${types.map(([key, label]) => h`<label class="account-type-choice"><input type="radio" name="account-type" data-dlg="type" value="${key}" ${key === d.type ? raw('checked') : ''}><span class="account-type-choice-icon">${catChip({ c: '#5fa68a', i: ACC_ICON[key] || 'bank' })}</span><span class="account-type-choice-copy"><b>${label}</b><small>${typeDetails[key]}</small></span><span class="account-type-choice-check" aria-hidden="true">${icon('check', 14)}</span></label>`)}</div></fieldset>` : ''}
      ${dlgField('Banco ou instituição', h`<span class="bank-name-control"><input type="text" data-dlg="bank" value="${bankValue}" maxlength="40" list="finance-bank-options" placeholder="Ex.: Nubank" autocomplete="off"><span class="bank-name-preview" data-bank-preview aria-hidden="true"><span class="bank-logo bank-preview-logo" data-bank-preview-logo ${initialBank ? '' : raw('hidden')}><img src="${initialBank ? initialBank[1].logo : ''}" alt=""></span><span data-bank-preview-fallback ${initialBank ? raw('hidden') : ''}>${catChip({ c: '#5fa68a', i: 'bank' })}</span></span></span><datalist id="finance-bank-options">${Object.values(BANKS).map((bank) => h`<option value="${bank.name}"></option>`)}</datalist><span class="small muted">O ícone aparece ao reconhecer o nome. Você também pode informar outra instituição.</span>`, 'full bank-name-field')}
      <p class="small muted full">O Aurora não se conecta a bancos; as informações são registradas manualmente.</p>
      ${card ? h`${dlgField('Conta para pagar a fatura (opcional)', h`<select data-dlg="linkedAccountId"><option value="" ${d.linkedAccountId ? '' : raw('selected')}>Escolher ao pagar</option>${paymentAccounts.map((account) => h`<option class="user-value" value="${account.id}" ${account.id === d.linkedAccountId ? raw('selected') : ''}>${accountOptionLabel(account)}</option>`)}</select>`, 'full')}<p class="small muted full">Essa conta será pré-selecionada no pagamento. Você ainda poderá escolher outra antes de confirmar.</p>` : ''}
      ${dlgField(edit ? h`Saldo atual (<span class="money">R$</span>)` : d.type === 'credit' ? 'Saldo inicial (dívida em aberto: negativo)' : h`Saldo inicial (<span class="money">R$</span>)`, h`<input type="text" class="money-input" inputmode="decimal" data-dlg="balance" value="${formatMoneyInput(d.balance)}" placeholder="00,00">`)}
      ${d.type === 'credit' ? h`${dlgField(h`Limite (<span class="money">R$</span>)`, h`<input type="text" class="money-input" inputmode="decimal" data-dlg="limit" value="${formatMoneyInput(d.limit)}" placeholder="00,00">`, 'full')}${dlgField('Dia de fechamento', h`<input type="number" min="1" max="31" data-dlg="closing" value="${d.closing}" inputmode="numeric">`)}${dlgField('Dia de vencimento', h`<input type="number" min="1" max="31" data-dlg="due" value="${d.due}" inputmode="numeric">`)}` : ''}
    </form>`,
    h`${edit ? h`<button class="btn danger back" data-action="acct-del" aria-label="Excluir conta">${icon('trash', 18)}</button>` : h`<button class="btn back" data-action="dlg-close">Cancelar</button>`}<button class="btn primary" type="submit" form="dlgform">Salvar</button>`);
}
function dlgAccountDelete() {
  const d = ui.dlg.d, a = accById(d.id);
  if (!a) return dlgWrap(h`<div class="head"><h2 id="dt">Conta não encontrada<i>.</i></h2>${closeBtn}</div><p class="small muted">A conta já não está disponível.</p>`, h`<button class="btn back" data-action="dlg-close">Fechar</button>`);
  const txCount = S.finance.tx.filter((t) => t.accountId === a.id || t.toAccountId === a.id).length;
  const recurringCount = recList().filter((r) => r.accountId === a.id).length;
  return dlgWrap(h`<div class="head head-nowrap"><h2 id="dt">Excluir conta?<i>.</i></h2>${closeBtn}</div>
    <p class="small"><span class="user-value">${accountDisplayName(a)}</span>: a conta, ${txCount} ${plural(txCount, 'lançamento', 'lançamentos')} e ${recurringCount} ${plural(recurringCount, 'lançamento fixo', 'lançamentos fixos')} associados irão juntos para a lixeira.</p>
    <p class="notice warn" role="alert">Você poderá restaurar esses dados por 30 dias. Depois, serão removidos automaticamente.</p>`,
    h`<button class="btn back" data-action="dlg-close">Cancelar</button><button class="btn danger" data-action="acct-del-confirm">Mover para a lixeira</button>`);
}
function dlgPermanentlyDeleteAccount() {
  return dlgWrap(h`<div class="head head-nowrap"><h2 id="dt">Excluir conta e dados permanentemente?</h2>${closeBtn}</div>
    <p class="small">Esta ação apagará sua conta e os dados associados. Não será possível recuperá-los. Um novo cadastro com este e-mail só poderá ser feito depois que a exclusão for confirmada.</p>
    <p class="notice warn" role="alert">Os arquivos de backup que você baixou não serão removidos automaticamente.</p>
    <form id="dlgform" class="form" data-form="account-delete">
      ${dlgField('Digite EXCLUIR para confirmar', h`<input id="f0" type="text" name="deleteConfirmation" data-dlg="deleteConfirmation" maxlength="7" pattern="EXCLUIR" autocomplete="off" required>`, 'full')}
      <p class="notice warn full" data-account-delete-message role="alert" hidden></p>
    </form>`,
  h`<button type="button" class="btn back" data-action="dlg-close">Cancelar</button><button type="submit" class="btn danger" form="dlgform" data-account-delete-submit>Excluir conta e dados</button>`);
}
function dlgBudget() {
  const d = ui.dlg.d;
  return dlgWrap(h`<div class="head head-nowrap"><h2 id="dt">Limite de <span class="expense-name">${expenseTitle(d.cat)}</span><i>.</i></h2>${closeBtn}</div>
    <p class="small muted">Quanto você quer gastar por mês nesta categoria? O Aurora avisa quando chegar perto.</p>
    ${d.confirmClear ? h`<p class="notice warn" role="alert">O orçamento irá para a lixeira por 30 dias. Confirme para continuar.</p>` : ''}
    <form id="dlgform" class="form" data-form="dlg-budget">${dlgField(h`Limite mensal (<span class="money">R$</span>)`, h`<input id="f0" class="amt-in money-input" type="text" inputmode="decimal" data-dlg="limit" value="${formatMoneyInput(d.limit)}" placeholder="00,00">`, 'full')}</form>`,
    h`${d.confirmClear ? h`<button type="button" class="btn back" data-action="budget-clear-cancel">Cancelar remoção</button><button type="button" class="btn danger" data-action="budget-clear">Confirmar remoção</button>` : h`${d.limit ? h`<button type="button" class="btn back" data-action="budget-clear">Remover limite</button>` : h`<button type="button" class="btn back" data-action="dlg-close">Cancelar</button>`}<button class="btn primary" type="submit" form="dlgform">Salvar</button>`}`);
}
function dlgGoal() {
  const d = ui.dlg.d;
  return dlgWrap(h`<div class="head head-nowrap"><h2 id="dt">${d.id ? 'Editar objetivo' : 'Novo objetivo'}<i>.</i></h2>${closeBtn}</div>
    <form id="dlgform" class="form" data-form="dlg-goal" novalidate>${dlgField('Nome', h`<input id="f0" type="text" data-dlg="name" value="${d.name}" maxlength="50" required placeholder="Ex.: Viagem, reserva de emergência">`, 'full')}${dlgField(h`Valor do objetivo (<span class="money">R$</span>)`, h`<input type="text" class="money-input" inputmode="decimal" data-dlg="target" value="${formatMoneyInput(d.target)}" placeholder="00,00" required>`)}${dlgField(h`Já guardado (<span class="money">R$</span>)`, h`<input type="text" class="money-input" inputmode="decimal" data-dlg="saved" value="${formatMoneyInput(d.saved)}" placeholder="00,00">`)}${dlgField('Prazo (opcional)', h`<input type="date" data-dlg="deadline" value="${d.deadline}">`, 'full')}</form>`,
    h`<button class="btn back" data-action="dlg-close">Cancelar</button><button class="btn primary" type="submit" form="dlgform">${d.id ? 'Salvar' : 'Criar objetivo'}</button>`);
}
function dlgDeposit() {
  const d = ui.dlg.d, g = S.finance.goals.find((x) => x.id === d.id);
  return dlgWrap(h`<div class="head head-nowrap"><h2 id="dt">Guardar em <span class="user-value">${g ? g.name : 'objetivo'}</span><i>.</i></h2>${closeBtn}</div>
    <p class="small muted">Este valor atualiza apenas o acompanhamento do objetivo; não altera o saldo de uma conta nem cria um lançamento. Para retirar, informe um valor negativo.</p>
    <form id="dlgform" class="form" data-form="dlg-deposit" novalidate>${dlgField(h`Valor (<span class="money">R$</span>)`, h`<input id="f0" class="amt-in money-input" type="text" inputmode="decimal" data-dlg="amount" value="${formatMoneyInput(d.amount)}" placeholder="00,00" required>`, 'full')}</form>`,
    h`<button class="btn back" data-action="dlg-close">Cancelar</button><button class="btn primary" type="submit" form="dlgform">Confirmar</button>`);
}
function invoicePlanPreviewText(d) {
  const principalCents = parseMoney(d.amount), interestCents = parseMoney(d.interest || ''), times = Number(d.times);
  const totalCents = principalCents + interestCents * times;
  if (Number.isSafeInteger(principalCents) && principalCents > 0
    && Number.isSafeInteger(interestCents) && interestCents >= 0
    && Number.isInteger(times) && times >= 2 && times <= 60
    && Number.isSafeInteger(totalCents)) {
    return `Principal em parcelas: ${brl(principalCents)}. Total programado com juros: ${brl(totalCents)}. A programação fica pendente e não reduz o saldo da conta até cada parcela ser marcada como paga.`;
  }
  return 'O principal será dividido em centavos pelas parcelas; os juros informados serão adicionados a cada uma. A programação fica pendente e não reduz o saldo da conta até cada parcela ser marcada como paga.';
}
function dlgPayInv() {
  const d = ui.dlg.d, card = accById(d.cardId), srcs = S.finance.accounts.filter((a) => !isCredit(a));
  const installments = d.mode === 'installments';
  return dlgWrap(h`<div class="head head-nowrap"><h2 id="dt">Pagar fatura<i>.</i></h2>${closeBtn}</div>
    <p class="small muted">${card ? h`<span class="user-value">${accountDisplayName(card)}</span>` : ''}: o pagamento sai da conta escolhida e reduz o valor em aberto do cartão.</p>
    <form id="dlgform" class="form" data-form="dlg-payinv">
      ${dlgField('Forma de pagamento', h`<select data-dlg="mode"><option value="single" ${!installments ? raw('selected') : ''}>Pagamento único</option><option value="installments" ${installments ? raw('selected') : ''}>Parcelar fatura</option></select>`, 'full')}
      ${dlgField(h`${installments ? 'Valor da fatura a parcelar' : 'Valor'} (<span class="money">R$</span>)`, h`<input id="f0" class="amt-in money-input" type="text" inputmode="decimal" data-dlg="amount" value="${formatMoneyInput(d.amount)}" required>`, 'full')}
      ${dlgField('Pagar com', h`<select data-dlg="from">${srcs.map((a) => h`<option class="user-value" value="${a.id}" ${a.id === d.from ? raw('selected') : ''}>${accountOptionLabel(a)} · ${money(accBalance(a))}</option>`)}</select>`, 'full')}
      ${installments ? h`
        ${dlgField('Número de parcelas', h`<input type="number" data-dlg="times" min="2" max="60" step="1" value="${d.times || '2'}" inputmode="numeric" required>`)}
        ${dlgField(h`Juros em cada parcela (<span class="money">R$</span>)`, h`<input class="money-input" type="text" inputmode="decimal" data-dlg="interest" value="${formatMoneyInput(d.interest || '0,00')}" required>`)}
        ${dlgField('Vencimento da primeira parcela', h`<input type="date" data-dlg="firstDueDate" value="${d.firstDueDate || ''}" min="${today()}" required>`, 'full')}
        <p class="fine full" data-pay-invoice-preview>${invoicePlanPreviewText(d)}</p>
      ` : ''}
    </form>`,
    h`<button class="btn back" data-action="dlg-close">Cancelar</button><button class="btn primary" type="submit" form="dlgform">${installments ? 'Programar parcelas' : 'Pagar'}</button>`);
}
function dlgTxDel() {
  const d = ui.dlg.d, t = S.finance.tx.find((x) => x.id === d.id) || {}, g = S.finance.tx.filter((x) => x.groupId === d.gid), after = g.filter((x) => x.date >= (t.date || ''));
  if (!d.gid) return dlgWrap(h`<div class="head head-nowrap"><h2 id="dt">Excluir lançamento?<i>.</i></h2>${closeBtn}</div>
    <p class="small"><span class="${t.type === 'out' ? 'expense-name' : 'user-value'}">${t.type === 'out' ? expenseTitle(t.desc || t.category || 'Este lançamento') : t.desc || t.category || 'Este lançamento'}</span> · ${t.date || ''} · ${t.cents ? money(t.cents) : ''}</p>
    <p class="small muted">O lançamento poderá ser restaurado pela lixeira por 30 dias.</p>`,
    h`<button class="btn back" data-action="dlg-close">Cancelar</button><button class="btn danger" data-action="txdel-do" data-k="one">Excluir</button>`);
  const opt = (k, title, sub) => h`<button type="button" class="mrow" data-action="txdel-do" data-k="${k}"><span class="mk">${icon('trash', 18)}</span><span class="grow"><b>${title}</b><small>${sub} · restaurável por 30 dias</small></span></button>`;
  return dlgWrap(h`<div class="head head-nowrap"><h2 id="dt">Excluir qual parte?<i>.</i></h2>${closeBtn}</div><p class="small muted">Este lançamento faz parte de uma série de ${g.length} (parcelas ou fixa mensal).</p>
    <div class="more">${opt('one', 'Só este', '1 lançamento')}${opt('next', 'Este e os próximos', after.length + ' lançamentos')}${opt('all', 'Toda a série', g.length + ' lançamentos')}</div>`, h`<button class="btn back" data-action="dlg-close">Cancelar</button>`);
}
function dlgTxAnticipate() {
  const d = ui.dlg.d, transaction = S.finance.tx.find((item) => item.id === d.id);
  const installments = anticipationCandidates(d.groupId, d.fromDate), card = isCredit(accById(transaction?.accountId));
  return dlgWrap(h`<div class="head head-nowrap"><h2 id="dt">Antecipar parcelas<i>.</i></h2>${closeBtn}</div>
    ${card
      ? h`<p class="small muted">Selecione as parcelas e a data do registro. No cartão, a antecipação fica anotada sem criar pagamento nem alterar saldos; o pagamento da fatura continua sendo uma transferência separada.</p>`
      : h`<p class="small muted">Selecione as parcelas e a data em que foram pagas. Os meses originais permanecem; o pagamento será considerado no fluxo de caixa nessa data.</p>`}
    ${installments.length ? h`<form id="dlgform" class="form" data-form="dlg-txanticipate">
      ${dlgField('Data da antecipação', h`<input id="f0" type="date" data-dlg="date" value="${d.date}" max="${today()}" required>`, 'full')}
      <fieldset class="finance-anticipation-list full"><legend class="small">Parcelas disponíveis</legend>${installments.map((item) => h`<label class="row"><input type="checkbox" data-advance-id="${item.id}"><span class="grow">${item.desc || 'Parcela'} · ${shortDate(item.date)}</span><b>${money(item.cents)}</b></label>`)}</fieldset>
    </form>` : h`<p class="fine">Não há parcelas futuras disponíveis para antecipar.</p>`}`,
    h`<button class="btn back" data-action="dlg-close">Cancelar</button>${installments.length ? h`<button class="btn primary" type="submit" form="dlgform">Confirmar antecipação</button>` : ''}`);
}
Object.assign(DLG, { txdel: dlgTxDel, txanticipate: dlgTxAnticipate, tx: dlgTx, 'category-manager': dlgCategoryManager, 'category-new': dlgCategoryNew, account: dlgAccount, acctdelete: dlgAccountDelete, 'account-delete': dlgPermanentlyDeleteAccount, budget: dlgBudget, goal: dlgGoal, deposit: dlgDeposit, payinv: dlgPayInv });

/* ========== Ações e formulários de Finanças ========== */
const F_ = () => S.finance;
Object.assign(ACTIONS, {
  'fin-tab': (el) => {
    if (!FIN_TABS.some(([key]) => key === el.dataset.t)) { console.error('Aurora: seção de Finanças inválida.', el.dataset.t); return; }
    ui.finTab = el.dataset.t;
    render();
    requestAnimationFrame(() => {
      const selected = $(`.fin-section-option[data-t="${ui.finTab}"]`);
      selected?.focus({ preventScroll: true });
      selected?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
  },
  'fin-go': (el) => {
    ui.finTab = el.dataset.t;
    if (el.hasAttribute('data-clear-fin-filters')) {
      ui.finQ = '';
      ui.finAcc = '';
      ui.finCat = '';
    }
    if (el.dataset.f) ui.finFilter = el.dataset.f;
    render();
    window.scrollTo(0, 0);
    requestAnimationFrame(() => {
      const selected = $(`.fin-section-option[data-t="${ui.finTab}"]`);
      selected?.focus({ preventScroll: true });
      selected?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
  },
  'fin-filter': (el) => { ui.finFilter = el.dataset.f; render(); },
  'fin-filters-clear': () => {
    ui.finFilter = 'todos';
    ui.finQ = '';
    ui.finAcc = '';
    ui.finCat = '';
    const search = $('#fq');
    if (search) search.value = '';
    render();
  },
  'fin-month': (el) => { const n = Number(el.dataset.n); ui.finMonth = n === 0 ? today().slice(0, 7) : shiftMonth(ui.finMonth, n); render(); },
  'rep-kind': (el) => { ui.repKind = el.dataset.k; render(); },
  'rep-basis': (el) => { ui.repBasis = el.dataset.b === 'cash' ? 'cash' : 'competence'; render(); },
  'tx-new': () => newTxDlg('out'),
  'tx-new-in': () => newTxDlg('in'),
  'tx-kind': (el) => {
    const d = ui.dlg.d, kind = el.dataset.k;
    if (d.kind === kind) return;
    const defaults = recentTransactionDefaults(kind);
    d.kind = kind;
    d.category = defaults.category;
    if (defaults.accountId) d.accountId = defaults.accountId;
    else if ((kind === 'in' || kind === 'tr') && isCredit(accById(d.accountId))) {
      d.accountId = (S.finance.accounts.find((account) => !isCredit(account)) || {}).id || '';
    }
    if (kind === 'tr') {
      d.toAccountId = defaults.toAccountId && defaults.toAccountId !== d.accountId
        ? defaults.toAccountId
        : (S.finance.accounts.find((account) => account.id !== d.accountId) || {}).id || '';
    }
    render();
  },
  'edit-tx': (el) => { const t = S.finance.tx.find((x) => x.id === el.dataset.id); if (t) dlgOpen('tx', { id: t.id, kind: t.type, amount: moneyIn(t.cents), interest: t.interestCents == null ? '' : moneyIn(t.interestCents) || '0,00', desc: t.desc || '', category: t.category || catNames('out')[0], accountId: t.accountId, toAccountId: t.toAccountId || '', date: t.date, settledDate: t.settledDate || t.date, paid: isPaid(t), repeat: 'none', times: '2', groupId: t.groupId || '', recId: t.recId || '' }); },
  'tx-anticipate-open': () => {
    const transaction = S.finance.tx.find((item) => item.id === ui.dlg.d.id);
    if (!transaction?.groupId) return toast('Esta parcela não pertence a uma série válida.');
    if (!anticipationCandidates(transaction.groupId, transaction.date).length) return toast('Não há parcelas futuras disponíveis para antecipar.');
    dlgOpen('txanticipate', { id: transaction.id, groupId: transaction.groupId, fromDate: transaction.date, date: today() });
  },
  'tx-paid': (el) => {
    const transaction = S.finance.tx.find((item) => item.id === el.dataset.id);
    if (!transaction) return;
    const wasPaid = isPaid(transaction), previousSettledDate = transaction.settledDate, previousAnticipatedDate = transaction.anticipatedDate;
    transaction.paid = !wasPaid;
    if (transaction.paid && !isCredit(accById(transaction.accountId))) transaction.settledDate = today();
    else {
      delete transaction.settledDate;
      if (!transaction.paid) delete transaction.anticipatedDate;
    }
    commit('finance');
    if (transaction.paid) completionFeedback(`.fr[data-k="${transaction.id}"]`);
    toast(transaction.paid
      ? (transaction.invoiceInstallment ? 'Parcela da fatura marcada como paga.' : transaction.type === 'in' ? 'Marcado como recebido.' : 'Marcado como pago.')
      : 'Voltou para pendente.', () => {
      transaction.paid = wasPaid;
      if (previousSettledDate) transaction.settledDate = previousSettledDate;
      else delete transaction.settledDate;
      if (previousAnticipatedDate) transaction.anticipatedDate = previousAnticipatedDate;
      else delete transaction.anticipatedDate;
      commit('finance');
    });
  },
  'tx-del-dlg': () => { const cur = S.finance.tx.find((x) => x.id === ui.dlg.d.id); if (!cur) return dlgClose(); dlgOpen('txdel', { id: cur.id, ...(cur.groupId && S.finance.tx.filter((x) => x.groupId === cur.groupId).length > 1 ? { gid: cur.groupId } : {}) }); },
  'account-delete-open': () => {
    if (!accountSession) return toast('Entre na conta que deseja excluir.');
    dlgOpen('account-delete');
  },
  'txdel-do': (el) => {
    const d = ui.dlg.d, t = S.finance.tx.find((x) => x.id === d.id);
    if (!t) return dlgClose();
    const k = el.dataset.k;
    const removed = S.finance.tx.filter((x) => (k === 'one' ? x.id === d.id : k === 'next' ? x.groupId === d.gid && x.date >= t.date : x.groupId === d.gid));
    const records = removed.map((transaction) => createTrashRecord(
      'finance.tx',
      transaction.id,
      S.finance.tx.indexOf(transaction),
      transaction,
    ));
    const label = removed.length > 1 ? `Lançamentos financeiros (${removed.length})` : `Lançamento: ${t.desc || t.category || 'Finanças'}`;
    const entry = moveRecordsToTrash(label, records, ['finance'], () => {
      const ids = new Set(removed.map((transaction) => transaction.id));
      S.finance.tx = S.finance.tx.filter((transaction) => !ids.has(transaction.id));
      ui.dlg = null;
    });
    if (entry) toast('Lançamento movido para a lixeira.', () => restoreTrashEntry(entry.id));
  },
  'category-manager': () => dlgOpen('category-manager', {}),
  'category-new': (el) => {
    const kind = el.dataset.kind;
    if (kind !== 'out' && kind !== 'in') return toast('Escolha um tipo de categoria válido.');
    dlgOpen('category-new', { kind, name: '', icon: 'tag', color: LIST_COLORS[listArr(kind).length % LIST_COLORS.length] });
  },
  'category-edit': (el) => {
    const { kind, name, parent = '' } = el.dataset;
    if ((kind !== 'out' && kind !== 'in') || !findCategory(kind, name, parent)) return toast('Não foi possível localizar essa categoria.');
    const category = findCategory(kind, name, parent);
    dlgOpen('category-new', {
      kind,
      editName: name,
      parent,
      name: category.name,
      icon: category.icon,
      color: category.color,
    });
  },
  'fin-csv': () => finCsv(),
  'acct-new': () => dlgOpen('account', { name: '', bank: '', type: 'checking', balance: '', limit: '', closing: '', due: '' }),
  'acct-new-card': () => dlgOpen('account', { name: '', bank: '', type: 'credit', linkedAccountId: '', balance: '', limit: '', closing: '', due: '' }),
  'acct-edit': (el) => { const a = accById(el.dataset.id); if (a) dlgOpen('account', { id: a.id, name: accountDisplayName(a), bank: a.bank || '', type: a.type, linkedAccountId: a.linkedAccountId || '', balance: moneyIn(accBalance(a)), cur0: accBalance(a), limit: moneyIn(a.limitCents), closing: a.closingDay ? String(a.closingDay) : '', due: a.dueDay ? String(a.dueDay) : '' }); },
  'acct-del': () => { const a = accById(ui.dlg.d.id); if (a) dlgOpen('acctdelete', { id: a.id }); },
  'acct-del-confirm': () => {
    const account = accById(ui.dlg.d.id);
    if (!account) return dlgClose();
    const transactions = S.finance.tx.filter((transaction) => (
      transaction.accountId === account.id || transaction.toAccountId === account.id
    ));
    const recurring = (S.finance.recurring || []).filter((item) => item.accountId === account.id);
    const records = [
      createTrashRecord('finance.accounts', account.id, S.finance.accounts.indexOf(account), account),
      ...transactions.map((transaction) => createTrashRecord(
        'finance.tx',
        transaction.id,
        S.finance.tx.indexOf(transaction),
        transaction,
      )),
      ...recurring.map((item) => createTrashRecord(
        'finance.recurring',
        item.id,
        S.finance.recurring.indexOf(item),
        item,
      )),
    ];
    const entry = moveRecordsToTrash(`Conta e lançamentos: ${accountDisplayName(account)}`, records, ['finance'], () => {
      S.finance.accounts = S.finance.accounts.filter((item) => item.id !== account.id);
      S.finance.tx = S.finance.tx.filter((item) => (
        item.accountId !== account.id && item.toAccountId !== account.id
      ));
      S.finance.recurring = S.finance.recurring.filter((item) => item.accountId !== account.id);
      ui.dlg = null;
    });
    if (entry) toast('Conta e dados associados movidos para a lixeira.', () => restoreTrashEntry(entry.id));
  },
  'budget-edit': (el) => { const c = el.dataset.c, b = S.finance.budgets[c]; dlgOpen('budget', { cat: c, limit: b ? moneyIn(b.cents) : '' }); },
  'budget-clear': () => {
    const d = ui.dlg.d;
    if (!d.confirmClear) { d.confirmClear = true; render(); return; }
    const budget = S.finance.budgets[d.cat];
    if (!budget) { ui.dlg = null; return render(); }
    const entry = moveRecordsToTrash(`Orçamento: ${d.cat}`, [
      createTrashRecord('finance.budgets', d.cat, 0, budget),
    ], ['finance'], () => {
      delete S.finance.budgets[d.cat];
      ui.dlg = null;
    });
    if (entry) toast('Orçamento movido para a lixeira.', () => restoreTrashEntry(entry.id));
  },
  'budget-clear-cancel': () => { ui.dlg.d.confirmClear = false; render(); },
  'goal-new': () => dlgOpen('goal', { name: '', target: '', saved: '', deadline: '' }),
  'goal-edit': (el) => { const g = S.finance.goals.find((item) => item.id === el.dataset.id); if (!g) return toast('Objetivo não encontrado.'); dlgOpen('goal', { id: g.id, name: g.name, target: moneyIn(g.targetCents), saved: moneyIn(g.savedCents), deadline: g.deadline || '' }); },
  'goal-dep': (el) => dlgOpen('deposit', { id: el.dataset.id, amount: '' }),
  'goal-del': (el) => {
    const goal = S.finance.goals.find((item) => item.id === el.dataset.id);
    if (!goal) return;
    if (ui.confirmedAction !== 'goal-del') return requestActionConfirmation('goal-del', { id: goal.id }, 'Excluir objetivo?', `O objetivo "${goal.name}" irá para a lixeira por 30 dias.`, 'Excluir objetivo');
    const i = S.finance.goals.findIndex((item) => item.id === goal.id);
    if (i < 0) return;
    const entry = moveRecordsToTrash(`Objetivo: ${goal.name}`, [
      createTrashRecord('finance.goals', goal.id, i, goal),
    ], ['finance'], () => { S.finance.goals.splice(i, 1); });
    if (entry) toast('Objetivo movido para a lixeira.', () => restoreTrashEntry(entry.id));
  },
  'pay-inv': (el) => {
    const card = accById(el.dataset.id);
    if (!card || !isCredit(card)) return;
    const info = cardInfo(card), sources = S.finance.accounts.filter((account) => !isCredit(account));
    const source = sources.find((account) => account.id === card.linkedAccountId) || sources[0];
    if (source) dlgOpen('payinv', {
      cardId: card.id,
      amount: moneyIn(Math.min(info.total || info.used, info.used) || info.used),
      from: source.id,
      mode: 'single',
      times: '2',
      interest: '0,00',
      firstDueDate: nextCardDueDate(card),
    });
  },
});
Object.assign(FORMS, {
  'dlg-txanticipate': () => {
    const d = ui.dlg.d, eligible = anticipationCandidates(d.groupId, d.fromDate);
    const selectedIds = new Set(Array.from(document.querySelectorAll('#dlg [data-advance-id]:checked'))
      .map((input) => input.dataset.advanceId));
    const selected = eligible.filter((transaction) => selectedIds.has(transaction.id));
    if (!isDay(d.date) || d.date > today()) return fieldError('Informe uma data válida de antecipação, até hoje.', '[data-dlg="date"]');
    if (!selected.length || selected.length !== selectedIds.size) return toast('Selecione uma ou mais parcelas disponíveis.');
    const card = isCredit(accById(selected[0].accountId));
    const previous = selected.map((transaction) => ({
      transaction,
      paid: Object.hasOwn(transaction, 'paid') ? transaction.paid : undefined,
      settledDate: Object.hasOwn(transaction, 'settledDate') ? transaction.settledDate : undefined,
      anticipatedDate: Object.hasOwn(transaction, 'anticipatedDate') ? transaction.anticipatedDate : undefined,
    }));
    selected.forEach((transaction) => {
      transaction.anticipatedDate = d.date;
      if (!card) {
        transaction.paid = true;
        transaction.settledDate = d.date;
      }
    });
    ui.dlg = null;
    commit('finance');
    toast(`${selected.length} ${plural(selected.length, 'parcela antecipada', 'parcelas antecipadas')}.`, () => {
      previous.forEach(({ transaction, paid, settledDate, anticipatedDate }) => {
        if (paid === undefined) delete transaction.paid;
        else transaction.paid = paid;
        if (settledDate === undefined) delete transaction.settledDate;
        else transaction.settledDate = settledDate;
        if (anticipatedDate === undefined) delete transaction.anticipatedDate;
        else transaction.anticipatedDate = anticipatedDate;
      });
      commit('finance');
    });
  },
  'dlg-tx': () => {
    const d = ui.dlg.d, cents = parseMoney(d.amount), tr = d.kind === 'tr', acc = accById(d.accountId);
    if (!(cents > 0)) return fieldError('Informe um valor maior que zero.', '[data-dlg="amount"]');
    if (!['out', 'in', 'tr'].includes(d.kind)) return toast('Escolha um tipo de lançamento válido.');
    if (!tr && !resolveNew(d.kind === 'in' ? 'in' : 'out', d, 'category')) return;
    if (!acc) return toast('Escolha uma conta.');
    if (tr && (!d.toAccountId || d.toAccountId === d.accountId)) return toast('Escolha duas contas diferentes.');
    if (!isDay(d.date)) return toast('Informe a data.');
    if (tr && d.date > today()) return toast('Uma transferência futura não pode ser registrada como realizada.');
    if (!tr && !isCredit(acc) && d.date > today() && d.paid) return toast('Para um lançamento futuro, desmarque a opção de pagamento realizado.');
    if (!tr && !isCredit(acc) && d.paid
      && (!isDay(d.settledDate) || d.settledDate > today())) {
      return toast('Informe uma data válida de pagamento ou recebimento, até hoje.');
    }
    if (!d.id && d.repeat === 'parcel') {
      const currentInstallment = Number(d.currentInstallment), totalInstallments = Number(d.times);
      if (!Number.isInteger(totalInstallments) || totalInstallments < 2 || totalInstallments > 60) return toast('Informe um total entre 2 e 60 parcelas.');
      if (!Number.isInteger(currentInstallment) || currentInstallment < 1 || currentInstallment > totalInstallments) return toast('A parcela atual deve estar entre 1 e o total de parcelas.');
      if (!['total', 'installment'].includes(d.installmentAmountMode || 'total')) return toast('Escolha como informar o valor do parcelamento.');
    }
    const totalInstallments = d.repeat === 'parcel' ? Number(d.times) : 1;
    const firstInstallment = d.repeat === 'parcel' ? Number(d.currentInstallment) : 1;
    const interestInput = d.kind === 'out' && (d.id ? d.groupId : d.repeat === 'parcel')
      ? String(d.interest || '').trim()
      : '';
    const interestCents = interestInput ? parseMoney(interestInput) : undefined;
    const installmentCents = d.repeat === 'parcel' && d.installmentAmountMode !== 'installment'
      ? Math.floor(cents / totalInstallments) + (firstInstallment === 1 ? cents % totalInstallments : 0)
      : cents;
    if (interestInput && (!Number.isSafeInteger(interestCents) || interestCents < 0 || interestCents > installmentCents)) {
      return fieldError('Informe juros válidos, entre zero e o valor da parcela.', '[data-dlg="interest"]');
    }
    const base = { type: d.kind, accountId: d.accountId, category: tr ? 'Transferência' : d.category, desc: d.desc.trim().slice(0, 80) };
    if (tr) base.toAccountId = d.toAccountId;
    const paid = tr || isCredit(acc) ? true : !!d.paid;
    const settledDate = !tr && !isCredit(acc) && paid ? d.settledDate : '';
    if (d.id) {
      const t = S.finance.tx.find((x) => x.id === d.id);
      if (!t) return dlgClose();
      Object.assign(t, base, { cents, date: d.date, paid });
      if (!tr) delete t.toAccountId;
      if (base.type === 'out' && d.groupId && interestCents !== undefined) t.interestCents = interestCents;
      else delete t.interestCents;
      if (base.type !== 'out' || (!isCredit(acc) && !paid)) delete t.anticipatedDate;
      if (settledDate) t.settledDate = settledDate;
      else delete t.settledDate;
      ui.finMonth = d.date.slice(0, 7);
      ui.dlg = null;
      commit('finance');
      return toast('Lançamento atualizado.');
    }
    if (d.repeat === 'fixed' && !tr) {
      const r = { id: newId(), type: d.kind, accountId: d.accountId, category: base.category, desc: base.desc, cents, day: pk(d.date).getDate(), startYM: d.date.slice(0, 7), lastYM: null, firstPaid: paid };
      recList().push(r); genRecurring(); ui.finMonth = d.date.slice(0, 7); ui.dlg = null; commit('finance'); toast('Fixa criada. Os próximos meses aparecem sozinhos.'); return;
    }
    const installmentsToCreate = totalInstallments - firstInstallment + 1;
    const gid = totalInstallments > 1 ? newId() : undefined;
    for (let offset = 0; offset < installmentsToCreate; offset++) {
      const installmentNumber = firstInstallment + offset;
      const part = d.repeat === 'parcel'
        ? d.installmentAmountMode === 'installment'
          ? cents
          : Math.floor(cents / totalInstallments) + (installmentNumber === 1 ? cents - Math.floor(cents / totalInstallments) * totalInstallments : 0)
        : cents;
      const installmentDate = addMonths(d.date, offset);
      const installmentPaid = isCredit(acc) ? true : offset === 0 ? paid : false;
      S.finance.tx.push({
        id: newId(),
        ...base,
        cents: part,
        date: installmentDate,
        paid: installmentPaid,
        ...(!isCredit(acc) && installmentPaid ? { settledDate: offset === 0 ? settledDate : installmentDate } : {}),
        ...(interestCents !== undefined ? { interestCents: offset === 0 ? interestCents : 0 } : {}),
        createdAt: Date.now() + offset,
        ...(totalInstallments > 1 ? { groupId: gid, desc: `${base.desc || base.category} (${installmentNumber}/${totalInstallments})` } : {}),
      });
    }
    ui.finMonth = d.date.slice(0, 7); ui.dlg = null; commit('finance'); toast(installmentsToCreate > 1 ? `${installmentsToCreate} lançamentos criados.` : 'Lançamento adicionado.');
  },
  'dlg-account': () => {
    const d = ui.dlg.d, name = d.name.trim(), current = d.id ? accById(d.id) : null; if (!name) return toast('Dê um nome à conta.');
    if (!Object.hasOwn(ACCOUNT_TYPES, d.type) || (d.id && !current)) return toast('Confira o tipo e a conta selecionados.');
    const linkedAccount = d.type === 'credit' && d.linkedAccountId ? accById(d.linkedAccountId) : null;
    if (d.type === 'credit' && d.linkedAccountId && (!linkedAccount || isCredit(linkedAccount))) return toast('Escolha uma conta válida para pagar a fatura.');
    const bankName = String(d.bank || '').trim().slice(0, 40);
    const knownBank = findBankByName(bankName);
    const bank = norm(bankName) === norm('Outro / não listado') ? OTHER_BANK : knownBank ? knownBank[0] : bankName;
    const bal = d.balance.trim() ? parseMoney(d.balance) : 0, lim = d.limit && d.limit.trim() ? parseMoney(d.limit) : 0;
    if (!Number.isSafeInteger(bal) || !Number.isSafeInteger(lim) || lim < 0) return toast('Confira os valores digitados. Use valores em reais, como 1.234,56.');
    const cl = d.closing.trim() ? Number(d.closing) : 0, du = d.due.trim() ? Number(d.due) : 0;
    if (d.type === 'credit' && ((d.closing.trim() && (!Number.isInteger(cl) || cl < 1 || cl > 31)) || (d.due.trim() && (!Number.isInteger(du) || du < 1 || du > 31)))) return toast('Os dias de fechamento e vencimento devem ser números inteiros de 1 a 31.');
    const patch = { name: accountDisplayName({ name: name.slice(0, 40), bank }), type: d.type, bank, initialCents: d.id ? current.initialCents + (bal - (d.cur0 || 0)) : bal, limitCents: d.type === 'credit' && lim > 0 ? lim : 0, closingDay: d.type === 'credit' && cl >= 1 && cl <= 31 ? cl : 0, dueDay: d.type === 'credit' && du >= 1 && du <= 31 ? du : 0 };
    if (linkedAccount) patch.linkedAccountId = linkedAccount.id;
    if (d.id) {
      Object.assign(current, patch);
      if (d.type === 'credit' && !linkedAccount) delete current.linkedAccountId;
    } else S.finance.accounts.push({ id: newId(), ...patch });
    ui.dlg = null; commit('finance');
  },
  'dlg-budget': () => { const d = ui.dlg.d, c = parseMoney(d.limit); if (!(c > 0)) return toast('Informe um limite maior que zero.'); Object.defineProperty(S.finance.budgets, d.cat, { value: { cents: c }, enumerable: true, writable: true, configurable: true }); ui.dlg = null; commit('finance'); },
  'dlg-category': () => {
    const d = ui.dlg.d, name = String(d.name || '').trim().slice(0, 30), parentName = String(d.parent || '').trim();
    if (d.kind !== 'out' && d.kind !== 'in') return toast('Escolha um tipo de categoria válido.');
    if (!name) return toast('Informe o nome da categoria.');
    if (!CAT_ICONS.includes(d.icon) || !hexOk(d.color)) return toast('Escolha um ícone e uma cor válidos.');
    const parentEntry = parentName ? listArr(d.kind).find((category) => norm(category.name) === norm(parentName)) : null;
    if (parentName && !parentEntry) return toast('Escolha uma categoria pai válida.');
    const existing = d.editName ? findCategory(d.kind, d.editName, parentName) : null;
    if (d.editName && !existing) return toast('Não foi possível localizar essa categoria.');
    const siblings = parentEntry ? (parentEntry.subcategories || []) : listArr(d.kind);
    const duplicate = siblings.some((category) => category !== existing
      && norm(parentEntry ? categoryLeafName(category) : category.name) === norm(name));
    if (duplicate) return toast('Já existe uma categoria com esse nome.');
    const financeChanges = [];
    if (existing) {
      const oldName = categoryLeafName(existing);
      const oldPath = parentName ? `${parentName} > ${oldName}` : oldName;
      const newPath = parentName ? `${parentName} > ${name}` : name;
      const paths = [[oldPath, newPath]];
      if (!parentName) {
        (existing.subcategories || []).forEach((subcategory) => {
          const child = categoryLeafName(subcategory);
          paths.push([`${oldName} > ${child}`, `${name} > ${child}`]);
        });
      }
      if (paths.some(([oldValue, newValue]) => oldValue !== newValue
        && Object.hasOwn(S.finance.budgets, newValue))) {
        return toast('Já existe um limite com o novo nome. Ajuste esse limite antes de renomear a categoria.');
      }
      existing.name = name;
      existing.color = d.color;
      existing.icon = d.icon;
      paths.forEach(([oldValue, newValue]) => {
        const changed = replaceCategoryReferences(oldValue, newValue);
        if (changed === null) financeChanges.push(false);
        else if (changed) financeChanges.push(true);
      });
    } else {
      addItem(d.kind, name, parentName, d.color, d.icon);
    }
    ui.dlg = createDialog('category-manager', {});
    commit(...(financeChanges.includes(true) ? ['settings', 'finance'] : ['settings']));
    toast(existing ? 'Categoria atualizada.' : 'Categoria adicionada.');
  },
  'dlg-goal': () => {
    const d = ui.dlg.d, name = d.name.trim(), target = parseMoney(d.target), saved = d.saved.trim() ? parseMoney(d.saved) : 0;
    if (!name || name.length > 50) return fieldError('Informe um nome com até 50 caracteres.', '[data-dlg="name"]');
    if (!Number.isSafeInteger(target) || target <= 0) return fieldError('Informe um valor maior que zero.', '[data-dlg="target"]');
    if (!Number.isSafeInteger(saved) || saved < 0) return fieldError('Informe um valor válido, igual ou maior que zero.', '[data-dlg="saved"]');
    if (d.deadline && !isDay(d.deadline)) return fieldError('Informe um prazo válido.', '[data-dlg="deadline"]');
    const values = { name, targetCents: target, savedCents: saved, deadline: d.deadline || '' };
    if (d.id) {
      const goal = S.finance.goals.find((item) => item.id === d.id);
      if (!goal) return toast('Objetivo não encontrado.');
      Object.assign(goal, values);
    } else S.finance.goals.push({ id: newId(), ...values });
    ui.dlg = null;
    commit('finance');
  },
  'dlg-deposit': () => {
    const d = ui.dlg.d, goal = S.finance.goals.find((item) => item.id === d.id), amount = parseMoney(d.amount);
    if (!goal) return toast('Objetivo não encontrado.');
    if (!Number.isSafeInteger(amount) || amount === 0) return fieldError('Informe um valor diferente de zero.', '[data-dlg="amount"]');
    const total = goal.savedCents + amount;
    if (!Number.isSafeInteger(total)) return fieldError('Informe um valor menor.', '[data-dlg="amount"]');
    goal.savedCents = Math.max(0, total);
    ui.dlg = null;
    const saved = saveSlices('finance');
    render();
    if (saved) toast(amount > 0 ? 'Valor guardado.' : 'Valor retirado.');
  },
  'dlg-payinv': () => {
    const d = ui.dlg.d, cents = parseMoney(d.amount), card = accById(d.cardId), source = accById(d.from);
    if (!Number.isSafeInteger(cents) || cents <= 0) return toast('Informe um valor maior que zero.');
    if (!card || !isCredit(card) || !source || isCredit(source) || source.id === card.id) return toast('Escolha um cartão e uma conta de origem válidos.');
    const outstanding = cardInfo(card).used;
    if (outstanding <= 0) return toast('Este cartão não tem valores em aberto.');
    if (d.mode === 'installments') {
      const times = Number(d.times), interestCents = parseMoney(d.interest);
      const available = Math.max(0, outstanding - scheduledInvoicePrincipal(card.id));
      if (!Number.isInteger(times) || times < 2 || times > 60) return toast('Informe de 2 a 60 parcelas.');
      if (!isSafeInteger(interestCents) || interestCents < 0) return toast('Informe um valor válido de juros por parcela.');
      if (!isDay(d.firstDueDate) || d.firstDueDate < today()) return toast('Informe o vencimento de hoje ou de uma data futura.');
      if (cents > available) return toast(h`O valor a parcelar não pode ultrapassar ${money(available)} (saldo em aberto descontadas outras parcelas programadas).`);
      const groupId = newId(), baseCents = Math.floor(cents / times), remainder = cents % times;
      const plan = Array.from({ length: times }, (_, index) => {
        const principalPart = baseCents + (index === 0 ? remainder : 0);
        const installmentCents = principalPart + interestCents;
        if (!isSafeInteger(installmentCents) || installmentCents <= 0) return null;
        return {
          id: newId(),
          type: 'tr',
          accountId: source.id,
          toAccountId: card.id,
          cents: installmentCents,
          interestCents,
          category: 'Transferência',
          desc: `Fatura parcelada (${index + 1}/${times})`,
          date: addMonths(d.firstDueDate, index),
          paid: false,
          invoiceInstallment: true,
          groupId,
          createdAt: Date.now() + index,
        };
      });
      if (plan.some((transaction) => !transaction || !isDay(transaction.date))) {
        return toast('Não foi possível gerar as datas ou os valores das parcelas. Revise os dados.');
      }
      S.finance.tx.push(...plan);
      ui.finMonth = plan[0].date.slice(0, 7);
      ui.dlg = null;
      commit('finance');
      const total = plan.reduce((sum, transaction) => sum + transaction.cents, 0);
      return toast(`${times} parcelas programadas, totalizando ${money(total)}. O saldo da conta não foi alterado.`);
    }
    if (d.mode !== 'single') return toast('Escolha uma forma de pagamento válida.');
    if (cents > outstanding) return toast(h`O pagamento não pode ultrapassar o valor em aberto de ${money(outstanding)}.`);
    S.finance.tx.push({ id: newId(), type: 'tr', accountId: source.id, toAccountId: card.id, cents, category: 'Transferência', desc: 'Pagamento da fatura', date: today(), paid: true, createdAt: Date.now() });
    ui.dlg = null; commit('finance'); toast('Pagamento registrado.');
  },
});
Object.assign(CHANGES, { 'fin-cat': (el) => { ui.finCat = el.value; render(); }, 'fin-acc': (el) => { ui.finAcc = el.value; render(); } });

/* ---- exportar CSV ---- */
const csvCell = (v) => { const s = String(v == null ? '' : v); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
async function finCsv() {
  const rows = filteredTx(), head = ['Data', 'Data de pagamento/recebimento', 'Data da antecipação', 'Tipo', 'Descrição', 'Categoria', 'Conta', 'Valor', 'Juros já incluídos no valor', 'Situação'];
  const lines = rows.map((t) => [t.date, t.settledDate || '', t.anticipatedDate || '', { in: 'Receita', out: 'Despesa', tr: 'Transferência' }[t.type], t.desc || '', t.category || '', accName(t.accountId), (t.type === 'out' ? -t.cents : t.cents) / 100, t.interestCents == null ? '' : t.interestCents / 100, isPaid(t) ? 'Pago' : 'Pendente'].map(csvCell).join(';'));
  const csv = '\uFEFF' + [head.join(';'), ...lines].join('\r\n'), name = `aurora-lancamentos-${ui.finMonth}.csv`;
  if (!rows.length) return toast('Não há lançamentos para exportar neste filtro.');
  downloadFile(name, csv, 'text/csv;charset=utf-8');
  toast('Arquivo baixado.');
}
/* ========== Finanças 2: fixas automáticas, importar extrato, calendário ========== */
const recList = () => S.finance.recurring || (S.finance.recurring = []);
function reconcileRecurringTransactions() {
  const winners = new Map();
  S.finance.tx.forEach((transaction) => {
    if (!transaction.recId) return;
    const key = `${transaction.recId}:${transaction.date}`;
    const previous = winners.get(key);
    // A mesma fixa só pode gerar um lançamento por mês. Em duplicatas antigas,
    // preservamos o registro já quitado, quando houver um.
    if (!previous || (isPaid(transaction) && !isPaid(previous))) winners.set(key, transaction);
  });
  const next = S.finance.tx.filter((transaction) => !transaction.recId || winners.get(`${transaction.recId}:${transaction.date}`) === transaction);
  const changed = next.length !== S.finance.tx.length;
  if (changed) S.finance.tx = next;
  return changed;
}
function genRecurring() {
  const F = S.finance, rs = F.recurring; if (!rs || !rs.length) return false;
  const hz = shiftMonth(today().slice(0, 7), 3); let ch = false;
  rs.forEach((r) => {
    const acc = accById(r.accountId); if (!acc || r.paused) return;
    let ym = r.lastYM ? shiftMonth(r.lastYM, 1) : r.startYM, g = 0;
    while (ym <= hz && (!r.endYM || ym <= r.endYM) && g++ < 60) {
      const dim = new Date(Number(ym.slice(0, 4)), Number(ym.slice(5)), 0).getDate(), date = `${ym}-${pad(Math.min(r.day, dim))}`;
      if (!F.tx.some((transaction) => transaction.recId === r.id && transaction.date === date)) {
        const paid = isCredit(acc) ? true : (ym === r.startYM && r.firstPaid !== undefined ? r.firstPaid : false);
        F.tx.push({ id: newId(), type: r.type, accountId: r.accountId, category: r.category, desc: r.desc, cents: r.cents, date, ...(paid && !isCredit(acc) ? { settledDate: date } : {}), paid, createdAt: Date.now() + g, recId: r.id });
      }
      r.lastYM = ym; ch = true; ym = shiftMonth(ym, 1);
    }
    delete r.firstPaid;
  });
  return ch;
}
const recById = (id) => recList().find((r) => r.id === id);
const recWhen = (r) => `dia ${r.day} · ${accName(r.accountId)} · ${r.category}`;

/* ---- ferramentas da aba Lançamentos ---- */
function finTools() {
  const n = recList().length;
  return h`<div class="fin-tools"><div class="seg" role="group" aria-label="Modo"><button type="button" aria-pressed="${ui.finView !== 'cal'}" data-action="fin-view" data-v="lista">${icon('list', 16)}Lista</button><button type="button" aria-pressed="${ui.finView === 'cal'}" data-action="fin-view" data-v="cal">${icon('calendar', 16)}Calendário</button></div>
    <div class="row fin-tools-actions"><button class="btn sm" data-action="rec-list">${icon('repeat', 16)}Fixas${n ? ' (' + n + ')' : ''}</button><label class="btn sm fin-import-action">${icon('download', 16)}Importar extrato<input type="file" class="sr" accept=".csv,.ofx,.txt,text/csv,text/plain" data-change="fin-import" aria-label="Importar extrato CSV ou OFX"></label></div></div>`;
}
function finCal() {
  const ym = ui.finMonth, [y, m] = ym.split('-').map(Number), ws = weekStartDay(), first = new Date(y, m - 1, 1), n = new Date(y, m, 0).getDate(), tdy = today();
  const wd = Array.from({ length: 7 }, (_, i) => DIAS[(ws + i) % 7]);
  const by = {}; S.finance.tx.forEach((t) => { if (t.date.startsWith(ym) && t.type !== 'tr') (by[t.date] = by[t.date] || []).push(t); });
  if (!ui.finDay || !ui.finDay.startsWith(ym)) ui.finDay = ym === tdy.slice(0, 7) ? tdy : `${ym}-01`;
  const cells = []; for (let i = 0; i < (first.getDay() + 7 - ws) % 7; i++) cells.push('<span></span>');
  for (let d = 1; d <= n; d++) {
    const k = `${ym}-${pad(d)}`, ts = by[k] || [], dots = [];
    if (ts.some((t) => t.type === 'out' && !isPaid(t))) dots.push('var(--bad)'); if (ts.some((t) => t.type === 'in' && !isPaid(t))) dots.push('var(--ok)'); if (ts.some(isPaid)) dots.push('var(--line2)');
    cells.push(`<button type="button" class="tc ${k === tdy ? 't' : ''} ${k === ui.finDay ? 's' : ''}" data-action="fin-day" data-d="${k}" aria-label="${d} de ${MESES_L[m - 1]}, ${ts.length} lançamentos"><b>${d}</b><i>${dots.map((c) => `<u style="background:${c}"></u>`).join('')}</i></button>`);
  }
  const day = (by[ui.finDay] || []).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)), tot = day.reduce((s, t) => s + (t.type === 'in' ? t.cents : -t.cents), 0);
  return h`<div class="tcal-wrap"><div class="tcal" role="group" aria-label="Calendário financeiro">${wd.map((w) => h`<em>${w}</em>`)}${raw(cells.join(''))}</div>
    <p class="fine"><span class="lg finance-overdue"></span>a pagar <span class="lg finance-upcoming"></span>a receber <span class="lg finance-settled"></span>pago/recebido</p></div>
    <section class="card"><div class="head"><h3>${ui.finDay === tdy ? 'Hoje' : cap(longDate(ui.finDay))}</h3><span class="small ${tot < 0 ? '' : 'muted'}">${day.length ? money(tot) : ''}</span></div>
      ${day.length ? h`<ul class="list">${day.map(finRow)}</ul>` : h`<p class="small muted">Nada neste dia.</p>`}
      <button class="btn sm" data-action="tx-new-day">${icon('plus', 16)}Lançamento neste dia</button></section>`;
}

/* ---- fixas: lista e edição ---- */
function dlgRecurList() {
  const rs = recList();
  return dlgWrap(h`<div class="head head-nowrap"><h2 id="dt">Lançamentos fixos<i>.</i></h2>${closeBtn}</div>
    <p class="small muted">Contas e receitas que se repetem todo mês. O Aurora cria os próximos meses sozinho. Para criar uma, use Lançamento e escolha "Fixa mensal".</p>
    ${rs.length ? h`<ul class="list more">${rs.map((r) => h`<li><button type="button" class="mrow" data-action="rec-edit" data-id="${r.id}"><span class="mk">${icon(catMeta({ type: r.type, category: r.category }).i, 20)}</span><span class="grow"><b><span class="${r.type === 'out' ? 'expense-name' : 'user-value'}">${r.type === 'out' ? expenseTitle(r.desc || r.category) : r.desc || r.category}</span>${r.paused ? ' · pausada' : ''}</b><small>${r.type === 'in' ? '+' : '−'}${money(r.cents)} · <span class="user-value">${recWhen(r)}</span></small></span>${icon('chevRight', 16)}</button></li>`)}</ul>` : empty('Nenhuma fixa ainda', 'Aluguel, salário, assinaturas: crie uma vez e acompanhe todos os meses.', h`<button type="button" class="btn primary" data-action="tx-new">${icon('plus', 16)}Novo lançamento</button>`, 'repeat')}`,
    h`<button class="btn back" data-action="dlg-close">Fechar</button>`);
}
function dlgRecur() {
  const d = ui.dlg.d, kind = d.kind, cats = catNames(kind), cl = cats.includes(d.category) ? cats : [d.category, ...cats], accs = S.finance.accounts;
  return dlgWrap(h`<div class="head head-nowrap"><h2 id="dt">Editar fixa<i>.</i></h2>${closeBtn}</div>
    <form id="dlgform" class="form" data-form="dlg-recur">
      ${dlgField('Descrição', h`<input id="f0" type="text" data-dlg="desc" value="${d.desc}" maxlength="80" autocomplete="off">`, 'full')}
      ${dlgField(h`Valor (<span class="money">R$</span>)`, h`<input type="text" class="amt-in money-input" inputmode="decimal" data-dlg="amount" value="${formatMoneyInput(d.amount)}" required>`)}${dlgField('Dia do mês', h`<input type="number" min="1" max="31" data-dlg="day" value="${d.day}" inputmode="numeric">`)}
      ${dlgField('Categoria', h`<select data-dlg="category">${cl.map((c) => h`<option class="${kind === 'out' ? 'expense-name' : 'user-value'}" value="${c}" ${c === d.category ? raw('selected') : ''}>${kind === 'out' ? expenseTitle(c) : c}</option>`)}</select>`)}${dlgField('Conta', h`<select data-dlg="accountId">${accs.map((a) => h`<option class="user-value" value="${a.id}" ${a.id === d.accountId ? raw('selected') : ''}>${accountOptionLabel(a)}</option>`)}</select>`)}
      <label class="row full form-choice-row"><input type="checkbox" data-dlg="future" ${d.future ? raw('checked') : ''}><span class="small"><b>Aplicar aos próximos já criados</b><br><span class="muted">Atualiza os meses futuros que ainda não foram pagos.</span></span></label>
      <label class="row full form-choice-row"><input type="checkbox" data-dlg="paused" ${d.paused ? raw('checked') : ''}><span class="small"><b>Pausar</b><br><span class="muted">Para de criar novos meses.</span></span></label>
      ${d.confirmDel ? h`<p class="notice warn full" role="alert">A fixa e os próximos meses ainda não pagos irão para a lixeira por 30 dias. Os meses já pagos ficam. Toque em "Confirmar exclusão".</p>` : ''}
    </form>`,
    h`<button type="button" class="btn danger back" data-action="rec-del">${d.confirmDel ? 'Confirmar exclusão' : icon('trash', 18)}</button><button class="btn primary" type="submit" form="dlgform">Salvar</button>`);
}

/* ---- importar extrato (CSV / OFX) ---- */
const KW = [[/mercado|supermerc|padaria|restaur|lanche|ifood|pizza|cafe|burger|acougue|hortifruti/, 'Alimentação'], [/uber|99 ?pop|combust|posto|estacion|onibus|metro|pedagio/, 'Transporte'], [/farmac|drog|medic|consulta|clinica|hospital|dentist/, 'Saúde'], [/aluguel|condominio|energia|enel|sabesp|internet|vivo|claro|tim /, 'Moradia'], [/netflix|spotify|cinema|ingresso|steam|disney|prime video/, 'Lazer'], [/curso|escola|faculdade|livro|udemy/, 'Educação'], [/salario|folha|pagamento de/, 'Salário']];
function guessCategory(desc, kind) {
  const names = catNames(kind), n = norm(desc);
  const hit = S.finance.tx.find((t) => t.type === kind && t.desc && norm(t.desc) === n) || S.finance.tx.find((t) => t.type === kind && t.desc && norm(t.desc).length >= 4 && n.includes(norm(t.desc)));
  if (hit && names.includes(hit.category)) return hit.category;
  for (const [re, c] of KW) { const f = names.find((x) => norm(x) === norm(c)); if (f && re.test(n)) return f; }
  return names.find((c) => /outro/i.test(c)) || names[0];
}
function impRecalc(d, resetCats) {
  d.rows.forEach((r) => {
    const amt = d.invert ? -r.cents : r.cents; r.kind = amt > 0 ? 'in' : 'out'; r.abs = Math.abs(amt);
    if (resetCats || !catNames(r.kind).includes(r.cat)) r.cat = guessCategory(r.desc, r.kind);
    r.dup = S.finance.tx.some((t) => t.accountId === d.accountId && t.date === r.date && t.cents === r.abs && t.type === r.kind);
    r.on = !r.dup;
  });
}
function dlgImport2() {
  const d = ui.dlg.d, n = d.rows.filter((r) => r.on).length, dups = d.rows.filter((r) => r.dup).length;
  return dlgWrap(h`<div class="head head-nowrap"><h2 id="dt">Importar extrato<i>.</i></h2>${closeBtn}</div>
    <p class="small muted"><b>${d.file}</b>: ${d.rows.length} lançamentos encontrados${dups ? `, ${dups} parecem já existir (desmarcados)` : ''}. Confira as categorias antes de importar.</p>
    ${d.truncated ? h`<p class="notice warn full" role="status">O arquivo tem mais de 500 lançamentos. A prévia inclui os primeiros 500; importe o restante em outro arquivo para não deixar registros de fora.</p>` : ''}
    <div class="form">${dlgField('Importar para a conta', h`<select data-dlg="accountId">${S.finance.accounts.map((a) => h`<option class="user-value" value="${a.id}" ${a.id === d.accountId ? raw('selected') : ''}>${accountOptionLabel(a)}</option>`)}</select>`, 'full')}
      <label class="row full form-choice-row"><input type="checkbox" data-dlg="invert" ${d.invert ? raw('checked') : ''}><span class="small"><b>Inverter entradas e saídas</b><br><span class="muted">Use se o arquivo mostra as compras como valores positivos (comum em fatura de cartão).</span></span></label></div>
    <ul class="list imp">${d.rows.map((r, i) => h`<li><label class="row import-row-label"><input type="checkbox" data-dlg="rows.${i}.on" ${r.on ? raw('checked') : ''} aria-label="Importar ${r.desc}"><span class="grow"><b class="ellip ${r.kind === 'out' ? 'expense-name' : 'user-value'}">${r.kind === 'out' ? expenseTitle(r.desc) : r.desc}</b><span class="small muted">${shortDate(r.date)}${r.dup ? ' · possível duplicado' : ''}</span></span><span class="amt ${r.kind}">${r.kind === 'in' ? '+' : '−'}${money(r.abs)}</span></label>
      <select class="impcat" data-dlg="rows.${i}.cat" aria-label="Categoria de ${r.desc}">${catNames(r.kind).map((c) => h`<option class="user-value" ${c === r.cat ? raw('selected') : ''}>${c}</option>`)}</select></li>`)}</ul>`,
    h`<button class="btn back" data-action="dlg-close">Cancelar</button><button class="btn primary" data-action="imp-apply" ${n ? '' : raw('disabled')}>Importar ${n ? '(' + n + ')' : ''}</button>`);
}
Object.assign(DLG, { recurlist: dlgRecurList, recur: dlgRecur, impfin: dlgImport2 });

Object.assign(ACTIONS, {
  'fin-view': (el) => { ui.finView = el.dataset.v; render(); },
  'fin-day': (el) => { ui.finDay = el.dataset.d; render(); },
  'tx-new-day': () => { newTxDlg('out'); ui.dlg.d.date = ui.finDay || today(); render(); },
  'rec-list': () => dlgOpen('recurlist', {}),
  'rec-edit': (el) => { const r = recById(el.dataset.id); if (r) dlgOpen('recur', { id: r.id, kind: r.type, desc: r.desc || '', amount: moneyIn(r.cents), day: r.day, category: r.category, accountId: r.accountId, future: true, paused: !!r.paused }); },
  'rec-del': () => {
    const d = ui.dlg.d;
    if (!d.confirmDel && ui.dlg.dirty) {
      const original = JSON.parse(ui.dlg.initial);
      original.confirmDel = true;
      askDiscardDialog(createDialog('recur', original));
      return;
    }
    if (!d.confirmDel) { d.confirmDel = true; ui.dlg.dirty = false; render(); return; }
    const recurring = recById(d.id);
    if (!recurring) return dlgClose();
    const pendingTransactions = S.finance.tx.filter((transaction) => (
      transaction.recId === d.id && !isPaid(transaction) && transaction.date >= today()
    ));
    const records = [
      createTrashRecord('finance.recurring', recurring.id, S.finance.recurring.indexOf(recurring), recurring),
      ...pendingTransactions.map((transaction) => createTrashRecord(
        'finance.tx',
        transaction.id,
        S.finance.tx.indexOf(transaction),
        transaction,
      )),
    ];
    const entry = moveRecordsToTrash(`Fixa financeira: ${recurring.desc || recurring.category}`, records, ['finance'], () => {
      S.finance.recurring = recList().filter((item) => item.id !== recurring.id);
      const ids = new Set(pendingTransactions.map((transaction) => transaction.id));
      S.finance.tx = S.finance.tx.filter((transaction) => !ids.has(transaction.id));
      ui.dlg = null;
    });
    if (entry) toast('Fixa movida para a lixeira.', () => restoreTrashEntry(entry.id));
  },
  'imp-apply': () => { const d = ui.dlg.d, ids = []; d.rows.filter((r) => r.on).forEach((r, i) => { const id = newId(); ids.push(id); const account = accById(d.accountId), paid = isCredit(account) || r.date <= today(); S.finance.tx.push({ id, type: r.kind, accountId: d.accountId, category: r.cat, desc: r.desc, cents: r.abs, date: r.date, ...(paid && account && !isCredit(account) ? { settledDate: r.date } : {}), paid, createdAt: Date.now() + i }); });
    const mo = d.rows.filter((r) => r.on).map((r) => r.date).sort().pop(); if (mo) ui.finMonth = mo.slice(0, 7); ui.dlg = null; commit('finance'); toast(`${ids.length} ${plural(ids.length, 'lançamento importado', 'lançamentos importados')}${d.truncated ? '. O restante do arquivo não foi incluído; importe-o em partes.' : '.'}`, () => { S.finance.tx = S.finance.tx.filter((t) => !ids.includes(t.id)); commit('finance'); }); },
});
Object.assign(FORMS, { 'dlg-recur': () => {
  const d = ui.dlg.d, r = recById(d.id), cents = parseMoney(d.amount), day = Math.round(num(d.day)); if (!r) return dlgClose();
  if (!(cents > 0)) return toast('Informe um valor maior que zero.'); if (!(day >= 1 && day <= 31)) return toast('O dia deve ser de 1 a 31.');
  Object.assign(r, { desc: d.desc.trim().slice(0, 80), cents, day, category: d.category, accountId: d.accountId, paused: !!d.paused });
  if (d.future) S.finance.tx.forEach((t) => { if (t.recId === r.id && !isPaid(t) && t.date >= today()) { const dim = new Date(Number(t.date.slice(0, 4)), Number(t.date.slice(5, 7)), 0).getDate(); Object.assign(t, { desc: r.desc, cents, category: r.category, accountId: r.accountId, date: `${t.date.slice(0, 7)}-${pad(Math.min(day, dim))}` }); } });
  ui.dlg = null; genRecurring(); commit('finance'); toast('Fixa atualizada.'); } });
Object.assign(CHANGES, { 'fin-import': async (el) => {
  const f = el.files && el.files[0]; el.value = ''; if (!f) return;
  if (f.size > 2 * 1024 * 1024) return toast('Arquivo grande demais (máx. 2 MB).');
  if (!S.finance.accounts.length) return toast('Crie uma conta antes de importar.');
  let text = ''; try { text = await f.text(); } catch (e) { return toast('Não consegui ler o arquivo.'); }
  let parseStatement;
  try {
    ({ parseStatement } = await import('./features/finance/statement.js'));
  } catch (error) {
    console.error('Aurora: não foi possível carregar a leitura de extratos.', error);
    toast('Não foi possível preparar a leitura do extrato. Tente novamente.');
    return;
  }
  const parsed = parseStatement(text, f.name);
  if (!parsed.transactions.length) return toast('Não encontrei lançamentos. Use CSV (data, descrição, valor) ou OFX.');
  const acc = S.finance.accounts.find((a) => !isCredit(a)) || S.finance.accounts[0], d = { file: f.name.slice(0, 40), accountId: acc.id, invert: false, truncated: parsed.truncated, rows: parsed.transactions.map((r) => ({ ...r, on: true })) };
  impRecalc(d, true); dlgOpen('impfin', d); } });

/* ---- comparar meses ---- */
const monthOpts = () => Array.from({ length: 12 }, (_, i) => shiftMonth(today().slice(0, 7), -i));
function finCompare() {
  const A = ui.cmpA || ui.finMonth, B = ui.cmpB || shiftMonth(A, -1);
  const sa = reportMonthStats(S.finance.tx, A, accById, ui.repBasis);
  const sb = reportMonthStats(S.finance.tx, B, accById, ui.repBasis);
  const ca = Object.fromEntries(byCategory(sa.tx, 'out')), cb = Object.fromEntries(byCategory(sb.tx, 'out'));
  const names = [...new Set([...Object.keys(ca), ...Object.keys(cb)])].sort((x, y) => Math.max(cb[y] || 0, ca[y] || 0) - Math.max(cb[x] || 0, ca[x] || 0)).slice(0, 8), mx = Math.max(1, ...names.map((n) => Math.max(ca[n] || 0, cb[n] || 0)));
  const dl = (a, b, good) => { if (!b && !a) return '—'; const d = a - b, p = b ? Math.round(d / b * 100) : null; return h`<span class="${d === 0 ? 'muted' : (d > 0) === good ? 'okc' : 'err'}">${d > 0 ? '+' : d < 0 ? '−' : ''}${money(Math.abs(d))}${p !== null ? ' (' + (d > 0 ? '+' : d < 0 ? '−' : '') + Math.abs(p) + '%)' : ''}</span>`; };
  const sel = (k, v) => h`<select data-change="cmp-${k}" aria-label="Mês ${k === 'a' ? 'principal' : 'de comparação'}">${monthOpts().map((m) => h`<option value="${m}" ${m === v ? raw('selected') : ''}>${cap(ymLabel(m))}</option>`)}</select>`;
  return h`<section class="card"><h2>Comparar meses<i>.</i></h2>
    <div class="form">${dlgField('Mês', sel('a', A))}${dlgField('Comparar com', sel('b', B))}</div>
    <table class="cmp"><thead><tr><th></th><th>${MESES[Number(A.slice(5)) - 1]}</th><th>${MESES[Number(B.slice(5)) - 1]}</th><th>Diferença</th></tr></thead><tbody>
      <tr><td>Receitas</td><td>${money(sa.inAll)}</td><td>${money(sb.inAll)}</td><td>${dl(sa.inAll, sb.inAll, true)}</td></tr>
      <tr><td>Despesas</td><td>${money(sa.outAll)}</td><td>${money(sb.outAll)}</td><td>${dl(sa.outAll, sb.outAll, false)}</td></tr>
      <tr><td>Resultado</td><td>${money(sa.inAll - sa.outAll)}</td><td>${money(sb.inAll - sb.outAll)}</td><td>${dl(sa.inAll - sa.outAll, sb.inAll - sb.outAll, true)}</td></tr></tbody></table>
    ${names.length ? h`<div class="f"><span class="lbl">Despesas por categoria</span><ul class="list cmpl">${names.map((n) => h`<li><div class="grow"><div class="row finance-compare-row"><b class="expense-name">${expenseTitle(n)}</b><span class="small">${dl(ca[n] || 0, cb[n] || 0, false)}</span></div>
      <div class="pair" aria-hidden="true"><span style="width:${(ca[n] || 0) / mx * 100}%;background:${outMeta(n).c}"></span></div><div class="pair b" aria-hidden="true"><span style="width:${(cb[n] || 0) / mx * 100}%;background:${outMeta(n).c}"></span></div>
      <div class="small muted">${money(ca[n] || 0)} · ${money(cb[n] || 0)}</div></div></li>`)}</ul><p class="fine">Barra cheia: ${cap(ymLabel(A))}. Barra clara: ${cap(ymLabel(B))}.</p></div>` : h`<p class="small muted">Sem despesas nesses meses.</p>`}
    </section>`;
}
Object.assign(CHANGES, {
  'cmp-a': (el) => { ui.cmpA = el.value; ui.cmpB = ui.cmpB && ui.cmpB !== el.value ? ui.cmpB : shiftMonth(el.value, -1); render(); },
  'cmp-b': (el) => { ui.cmpB = el.value; render(); },
});
/* ---- Arranque ---- */
function renderAccountLoading(root) {
  const page = document.createElement('main');
  page.className = 'account-loading';
  page.setAttribute('role', 'status');
  page.setAttribute('aria-busy', 'true');

  const content = document.createElement('div');
  content.className = 'account-loading-content';

  const brand = document.createElement('span');
  brand.className = 'account-loading-brand-text';
  brand.setAttribute('aria-hidden', 'true');
  brand.textContent = 'aurora';

  const brandDot = document.createElement('span');
  brandDot.className = 'account-loading-brand-dot';
  brandDot.setAttribute('aria-hidden', 'true');
  brandDot.textContent = '.';
  brand.append(brandDot);

  const indicator = document.createElement('span');
  indicator.className = 'account-loading-indicator';
  indicator.setAttribute('aria-hidden', 'true');

  const message = document.createElement('p');
  message.className = 'account-loading-message';
  message.textContent = 'Preparando seu espaço…';

  content.append(brand, indicator, message);
  page.append(content);
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
  detail.textContent = `${error instanceof Error && error.message
    ? error.message
    : 'Os dados da conta não puderam ser carregados.'} Nenhum dado local foi usado como substituto.`;
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
      accountSession = null;
      history.replaceState(null, '', postSignOutPath(location));
      location.reload();
    } catch (signOutError) {
      console.error('Aurora: não foi possível encerrar a sessão após falha ao carregar os dados.', signOutError);
      detail.textContent = 'Não foi possível encerrar a sessão. Tente novamente antes de compartilhar este dispositivo.';
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
  try {
    const { purgeRemovedStudyDataFromBrowserStorage } = await import('./features/backup/removed-study-data.js');
    purgeRemovedStudyDataFromBrowserStorage(window.localStorage, user.id);
    await loadAccountData();
    initializeBirthdayFromMetadata(user);
  } catch (error) {
    console.error('Aurora: a conta foi autenticada, mas os dados protegidos não puderam ser carregados.', error);
    showAccountDataLoadError(root, error, user);
    return;
  }

  purgeExpiredTrash();
  if (ui.persistFailed.size) toast('Alguns dados protegidos não puderam ser carregados ou salvos. As cópias originais foram preservadas; faça um backup antes de continuar.');
  const recurringReconciled = reconcileRecurringTransactions();
  const recurringGenerated = genRecurring();
  if (recurringReconciled || recurringGenerated) saveSlices('finance');
  window.addEventListener('popstate', onRoute);
  window.addEventListener('hashchange', () => {
    const route = routeFromLocation(location, new Set(Object.keys(ROUTES)));
    if (location.hash && route.replacePath) onRoute();
  });
  releaseNoticePending = true;
  onRoute();
  if (!profileSetupComplete()) openProfileSetup();
  else void maybeOpenReleaseNotes();
  setInterval(tick, 1000);
  const registration = await registerPwaSupport();
  if (registration || isNativeApp()) {
    try {
      await initializePushNotifications();
      await syncHabitReminderSchedule();
    } catch (error) {
      console.error('O Aurora não conseguiu iniciar as notificações Push.', error);
      ui.habitPushNotice = pushNotificationErrorMessage(error);
      if (ui.route === 'habitos') render();
    }
  }
  Persist.retryPending();
}

async function maybeOpenReleaseNotes() {
  if (!releaseNoticePending || !accountSession?.user?.id || ui.dlg || !profileSetupComplete()) return;
  releaseNoticePending = false;
  if (!shouldShowReleaseNotes(S.settings)) return;
  const snapshot = snapshotSlices(['settings']);
  if (!markReleaseNotesSeen(S.settings)) return;
  if (!saveSlicesWithRollback(['settings'], snapshot, false, 'a confirmação das novidades')) return;
  if (!await Persist.flush()) return;
  dlgOpen('release-notes');
}

const RETURN_TO_KEY = 'aurora:return-to';
const SESSION_EXPIRED_KEY = 'aurora:session-expired';
const RETURN_TO_PATTERN = /^\/(?:inicio|planejar|financas|habitos|ciclo|config)(?:\?[\w=&%.-]*)?$/;
let intentionalSignOut = false;

function readStorage(key) {
  try { return sessionStorage.getItem(key); } catch { return null; }
}
function writeStorage(key, value) {
  try {
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, value);
  } catch { /* storage indisponível */ }
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
    accountSession = null;
    if (RETURN_TO_PATTERN.test(returnTo)) writeStorage(RETURN_TO_KEY, returnTo);
    writeStorage(SESSION_EXPIRED_KEY, '1');
    Persist.wipe();
    resetGoogleCalendarState();
    history.replaceState(null, '', accountPathForMode('login'));
    location.reload();
  });
}

export async function startAuthenticatedAurora(root, initialMode = 'login', allowPublicReturn = false, authCallback = false) {
  const { requireAccount } = await import('./services/account-auth.js');
  renderAccountLoading(root);
  let returnedToPublic = false;
  rememberRequestedRoute();
  const sessionExpired = readStorage(SESSION_EXPIRED_KEY) === '1';
  writeStorage(SESSION_EXPIRED_KEY, null);
  accountSession = await requireAccount(root, initialMode, {
    allowPublicReturn,
    initialNotice: sessionExpired ? 'Sua sessão expirou. Entre novamente para continuar.' : '',
    onPublicReturn: () => { returnedToPublic = true; },
    onAccountDeleted: () => {
      window.auroraLoadingAppearance?.clear();
      redirectToPublicLanding(location);
    },
  });
  if (!accountSession) {
    if (returnedToPublic) {
      initializePublicAppearance();
      if (isDemoLocation(location)) renderLandingDemo(root);
      else renderLanding(root);
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
  await Persist.attach(accountSession);
  watchSessionExpiry(accountSession.client);
  await continueAuthenticatedAurora(root, accountSession.user);
}

function showAccountStartupError(root, message) {
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

async function startAurora() {
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
    await startAuthenticatedAurora(
      root,
      routeMode || (requestedMode === 'signup' ? 'signup' : 'login'),
      routeMeta,
      authCallback,
    );
    return;
  }
  initializePublicAppearance();
  if (isDemoLocation(location)) renderLandingDemo(root);
  else renderLanding(root);
  const sessionRestore = (async () => {
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
        await startAuthenticatedAurora(root);
        return true;
      } catch (error) {
        console.error('Aurora: a sessão existente não pôde ser restaurada.', error);
        showAccountStartupError(root, 'Não foi possível restaurar sua sessão. Atualize a página e tente entrar novamente.');
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
      renderLanding(root);
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
      renderLandingDemo(root);
      window.scrollTo(0, 0);
      return;
    }
    if (action !== 'login' && action !== 'signup') return;
    stopLandingDemo(root);
    root.querySelectorAll('[data-public-action]').forEach((button) => {
      if (button instanceof HTMLButtonElement) button.disabled = true;
      else if (button.dataset.publicAction !== 'skip' && button.dataset.publicAction !== 'landing') button.setAttribute('aria-disabled', 'true');
    });
    if (await sessionRestore) return;
    startAuthenticatedAurora(root, action, true).catch((error) => {
      console.error('Aurora: a inicialização segura falhou.', error);
      const detail = error instanceof Error && error.message
        ? error.message
        : 'Falha desconhecida ao carregar os módulos de conta.';
      showAccountStartupError(root, `${detail} Inicie o projeto com \`npm run dev\`, atualize a página e tente novamente.`);
    });
  });
}

document.addEventListener('click', async (event) => {
  const button = event.target instanceof Element ? event.target.closest('[data-account-signout]') : null;
  if (!button || !accountSession) return;
  event.preventDefault();
  if (ui.legacyImport.busy) {
    toast('A importação está em andamento. Aguarde a confirmação antes de sair.');
    return;
  }
  button.disabled = true;
  const synchronized = await Persist.flush();
  if (!synchronized && !await confirmInDialog('Ainda há alterações que não foram confirmadas pela nuvem. Elas podem ser descartadas ao sair. Deseja sair mesmo assim?')) {
    button.disabled = false;
    return;
  }
  try {
    await cancelHabitPushReminders();
  } catch {
    if (!await confirmInDialog('Não foi possível cancelar os lembretes de Hábitos deste dispositivo. Eles podem continuar ativos até o próximo ajuste. Deseja sair mesmo assim?')) {
      button.disabled = false;
      return;
    }
  }
  intentionalSignOut = true;
  const { error } = await accountSession.client.auth.signOut({ scope: 'local' });
  if (error) {
    intentionalSignOut = false;
    toast('Não foi possível encerrar a sessão. Tente novamente antes de compartilhar este dispositivo.');
    return;
  }
  Persist.wipe();
  resetGoogleCalendarState();
  history.replaceState(null, '', postSignOutPath(location));
  location.reload();
});

window.addEventListener('offline', () => render());
window.addEventListener('online', () => {
  render();
  if (Persist.pendingSnapshot) toast('A conexão voltou. As alterações pendentes continuam apenas nesta página; toque em “Tentar novamente” para gravá-las.');
});
window.addEventListener('beforeunload', (event) => {
  if (!ui.legacyImport.busy && !syncState.pending.size && !syncState.failed.size) return;
  event.preventDefault();
  event.returnValue = '';
});
document.addEventListener('submit', (event) => {
  if (!ui.legacyImport.busy) return;
  event.preventDefault();
  event.stopImmediatePropagation();
}, true);

initializeCustomSelects(document);
initializeLegalDialogEvents();
if (isNativeApp()) {
  void import('./services/native-auth.js')
    .then(({ initializeNativeAuthBridge }) => initializeNativeAuthBridge())
    .catch((error) => console.error('O Aurora não conseguiu carregar a autenticação nativa.', error));
}

startAurora().catch((error) => {
  console.error('Aurora: a inicialização segura falhou.', error);
  showAccountStartupError(document.getElementById('app'), 'Não foi possível carregar os módulos de conta. Inicie o projeto com `npm run dev`; a demonstração pública não exige login.');
});
