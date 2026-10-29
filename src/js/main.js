import { RelationalAccountStore } from './data/relational-account-store.js';
import {
  clearImportedBrowserStorage,
  containsRemovedStudyData,
  inspectLegacySources,
  purgeRemovedStudyDataFromBrowserStorage,
  scanLegacyBrowserStorage,
  unlockLegacySources,
} from './data/legacy-import.js';
import {
  hasAllExpectedRecords,
  prepareLegacyImport,
} from './data/legacy-import-model.js';
import { $, $$, esc, h, raw } from './utils/dom.js';
import { icon } from './utils/icons.js';
import { brl, parseMoney } from './utils/currency.js';
import {
  addDays, clock, dayDiff, DIAS, dk, dur, isoDay, isDay, longDate,
  MESES, MESES_L, pad, pk, shortDate, today,
} from './utils/dates.js';
import { newId } from './utils/ids.js';
import { filterValidRecords, isPlainObject } from './core/data-integrity.js';
import { isPublicLandingHash, postSignOutPath, resolveRoute } from './core/router.js';
import {
  accountBalance as balanceForAccount,
  netAccountBalanceOn,
  byCategory as summarizeByCategory,
  cardInfo as calculateCardInfo,
  invoiceMonth,
  isCreditAccount,
  isPaid as transactionIsPaid,
  monthStats as summarizeMonth,
  netAccountBalance,
  reportMonthStats,
  recurringBillsDueOn,
  signedAmount,
} from './features/finance/calculations.js';
import { parseStatement } from './features/finance/statement.js';
import {
  AREA_GUIDES,
  AREA_GUIDE_IDS,
  FINANCE_PRIVACY_NOTICE,
  isValidAreaTutorialsSeen,
  normalizeAreaTutorialsSeen,
} from './features/area-guides.js';
import { loadHabitsTemplate, renderHabitsTemplate } from './features/habits/template.js';
import { backupReminderStatus } from './features/backup/reminder.js';
import {
  advancePomodoro,
  effectivePomodoroSettings,
  longBreakMinutes,
  normalizePomodoroHistory,
  recentFocusDays,
  POMODORO_PRESETS,
  phaseDurationSeconds,
  phaseElapsedSeconds,
} from './features/pomodoro/pomodoro.js';
import {
  DEFAULT_POMODORO_SOUND_VOLUME,
  POMODORO_SOUND_TONES,
  playPomodoroChime,
  resumePomodoroAudioContext,
} from './features/pomodoro/pomodoro-audio.js';
import {
  cancelPomodoroPushSchedule,
  clearPomodoroPushState,
  configurePomodoroPushStore,
  disablePomodoroPush,
  enablePomodoroPush,
  getPomodoroPushStatus,
  initializePomodoroPush,
  pomodoroPushErrorMessage,
  schedulePomodoroPush,
} from './services/pomodoro-push.js';
import { renderLanding, renderLandingDemo } from './features/landing/view.js';
import { renderFooterContent } from './features/footer/view.js';
import { isLegalDocumentAtEnd, showLegalDocument } from './features/footer/legal-dialog.js';
import { createSuggestionMailto } from './features/footer/suggestions.js';
import { handlePublicControl, initializePublicAppearance } from './features/appearance/public-controls.js';
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
import { PROFILE_SEX } from './features/profile/model.js';
import {
  habitWeeklyTarget,
  habitIsComplete,
  habitMonthDays,
  habitMonthStats,
  habitStats,
  isWaterHabit,
  isValidHabit,
  normalizeHabits,
  SUGGESTED_HABITS,
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
  parseWaterMl,
  parseWaterWeightKg,
  waterGoalFromName,
  waterGoalReached,
  waterMlForDay,
} from './features/habits/water-goal.js';
import { hexOk, LOOK_DEFAULT, PALETTES, paletteColors } from './features/appearance/palettes.js';
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
  trashDaysRemaining,
} from './features/trash/model.js';
import { estimatedCyclePhase } from './features/cycle/phases.js';
import { CYCLE_CONTRACEPTION_METHODS, isValidCycleSexualLog } from './features/cycle/log.js';
'use strict';
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
const DEF_LISTS = [{ name: 'Pessoal', color: '#c97994' }];
const DEF_CATS = {
  out: [['Alimentação', '#c97994', 'utensils'], ['Moradia', '#7c8fd4', 'home'], ['Transporte', '#5fa68a', 'car'], ['Saúde', '#d9a05b', 'heart'], ['Educação', '#8a7ac4', 'book'], ['Lazer', '#d27a6a', 'sparkles'], ['Compras', '#5aa5b8', 'bag'], ['Assinaturas', '#a3b55a', 'repeat'], ['Cuidados pessoais', '#b78a6e', 'user'], ['Outros', '#8b8b95', 'tag']],
  in: [['Salário', '#3d9a6b', 'wallet'], ['Renda extra', '#5fb08a', 'plus'], ['Rendimentos', '#7bb89c', 'trendUp'], ['Presente', '#8fc7a8', 'sparkles'], ['Reembolso', '#4f9a74', 'repeat'], ['Outros', '#8b8b95', 'tag']]
};
const defCats = () => ({ out: DEF_CATS.out.map(([name, color, icon]) => ({ name, color, icon })), in: DEF_CATS.in.map(([name, color, icon]) => ({ name, color, icon })) });
const catNames = (k) => S.settings.cats[k].map((c) => c.name);
const catInfo = (k, n) => { const c = S.settings.cats[k].find((x) => x.name === n); return c ? { c: c.color, i: c.icon } : { c: '#8b8b95', i: 'tag' }; };
const ACCOUNT_TYPES = { checking: 'Conta corrente', savings: 'Poupança', cash: 'Dinheiro', credit: 'Cartão de crédito' };
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
const AREAS = { pomodoro: ['Pomodoro', 'Timer para alternar blocos de foco e pausa'], finances: ['Finanças', 'Contas, entradas e saídas'], cycle: ['Ciclo', 'Registro e estimativas'], habits: ['Hábitos', 'Rotinas e histórico semanal'] };
const SEX = PROFILE_SEX;
const hasRequiredProfile = (profile) => typeof profile?.name === 'string'
  && Boolean(profile.name.trim());
const CASE_TERMS = new Set(['Android', 'CSV', 'Google', 'HTTPS', 'iPhone', 'JSON', 'MB', 'mL', 'OFX', 'Push', 'URL', 'VAPID']);
const preserveCopyTerms = (text) => h`${String(text).split(/\b(Android|CSV|Google|HTTPS|iPhone|JSON|MB|mL|OFX|Push|URL|VAPID)\b/g).map((part) => {
  return CASE_TERMS.has(part) ? h`<span class="case-preserve">${part}</span>` : part;
})}`;
const PRIO = { low: 'Baixa', normal: 'Normal', high: 'Alta' };
const HOME_BLOCKS = [
  ['summary', 'Resumo do dia', 'Tarefas de hoje, atrasadas, sem data e dados das áreas ativas.'],
  ['quick', 'Adicionar tarefa', 'Campo rápido para registrar o próximo passo.'],
  ['habits', 'Hábitos de hoje', 'Check-ins e acompanhamento da rotina.'],
  ['today', 'Plano de hoje', 'Tarefas pendentes, atrasadas e concluídas.'],
];
const HOME_BLOCK_IDS = HOME_BLOCKS.map(([id]) => id);
const defaultHomeLayout = () => ({ order: [...HOME_BLOCK_IDS], visible: [...HOME_BLOCK_IDS] });
function normalizeHomeLayout(value) {
  const layout = isPlainObject(value) ? value : {};
  const order = Array.isArray(layout.order) ? layout.order.filter((id) => HOME_BLOCK_IDS.includes(id)) : [];
  const visible = Array.isArray(layout.visible) ? layout.visible.filter((id) => HOME_BLOCK_IDS.includes(id)) : HOME_BLOCK_IDS;
  return {
    order: [...new Set(order), ...HOME_BLOCK_IDS.filter((id) => !order.includes(id))],
    visible: [...new Set(visible)],
  };
}

/* ---------- Estado ---------- */
const defaults = () => ({
  tasks: [],
  habits: [],
  pomodoro: { elapsedSeconds: 0, startedAt: null, phase: 'focus', phaseElapsedSeconds: 0, completedPomodoros: 0, dailyCompletedPomodoros: 0, dailyCompletedOn: '', focusTaskId: '' },
  settings: { profile: { name: '', preferredName: '', sex: '', age: null, weightKg: null, heightCm: null }, areas: { pomodoro: false, finances: false, gym: false, water: false, cycle: false, habits: false }, theme: 'rose', look: { ...LOOK_DEFAULT }, lists: DEF_LISTS.map((x) => ({ ...x })), cats: defCats(), weightTracking: false, accountTypes: ['checking', 'cash'], onboardingComplete: false, introSeen: false, prefs: { waterGoalMl: 2000, birthday: null, birthdayCorrectionUsed: false, areaTutorialsSeen: [], menuOrder: [...DEFAULT_MENU_ORDER], visibleMenuItems: [...DEFAULT_VISIBLE_MENU_ITEMS], homeLayout: defaultHomeLayout(), pomodoro: { on: false, preset: 'classic', focusMin: 25, breakMin: 5, longBreakMin: 15, cyclesPerLongBreak: 4, autoAdvance: true, soundTone: 'classic', soundVolume: DEFAULT_POMODORO_SOUND_VOLUME }, lastBackup: null, sample: false, weeklyReflection: null, trash: [] } },
  water: [], gym: { templates: [], logs: [] }, finance: { accounts: [], tx: [], budgets: {}, goals: [], recurring: [] }, cycle: [], cycleLog: {}, weight: [],
});
const SLICES = Object.keys(defaults());
let S = defaults();
let accountSession = null;
const syncState = {
  pending: new Set(),
  failed: new Set(),
  conflicts: new Set(),
};
const ui = { preview: false, dragId: null, alerts: {}, fired: {}, snooze: {}, notificationsOpen: false, accessibilityOpen: false, navigationOpen: false, planView: 'lista', taskCal: dk().slice(0, 7), taskWeek: today(), taskDay: dk(), habitMonth: today().slice(0, 7), habitSuggestions: null, profileDraft: null, settingsDraft: null, settingsDraftBase: null, route: 'inicio', status: 'local', toast: null, dlg: null, dlgPending: null, confirmPrevious: null, confirmedAction: null, returnDialog: null, focusActive: false, settingsTab: 'profile', pushBusy: false, pushNotice: '', exploreNoticeDismissed: false, areaTutorialsPresented: new Set(), filters: { f: 'todas', q: '', sort: 'prazo' }, finMonth: dk().slice(0, 7), finTab: 'resumo', finFilter: 'todos', finAcc: '', finQ: '', finView: 'lista', finDay: '', finCat: '', repKind: 'out', repBasis: 'competence', calMonth: dk().slice(0, 7), openDetails: {}, persistFailed: new Set(), persistError: '', persistBlocked: new Set(), integrityIssues: {}, legacyImport: { step: 'start', browserData: null, discovery: null, preview: null, error: '', busy: false, completed: false, cleanup: null, cleanupConfirmed: false } };
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
  document.querySelectorAll('[data-settings-save-button]').forEach((button) => { button.disabled = !dirty; });
  document.querySelectorAll('[data-settings-discard-button]').forEach((button) => {
    button.disabled = !dirty;
    button.hidden = !dirty;
  });
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
function saveSettingsDraft() {
  if (!settingsDraftDirty()) return;
  const previousSettings = S.settings;
  S.settings = normalizeSettings(settingsView());
  if (!saveSlices('settings')) {
    S.settings = previousSettings;
    render();
    return;
  }
  ui.settingsDraft = null;
  ui.settingsDraftBase = null;
  render();
  toast('Configurações salvas.');
}
function settingsSaveButton(label = 'Salvar') {
  const dirty = settingsDraftDirty();
  return h`<div class="row settings-save-actions"><button class="btn back" type="button" data-settings-discard-button data-action="discard-settings" ${dirty ? '' : raw('disabled hidden')}>Descartar alterações</button><button class="btn primary" type="submit" data-settings-save-button ${dirty ? '' : raw('disabled')}>${label}</button></div>`;
}
let habitsTemplate = null;
let habitsTemplatePromise = null;
let habitsTemplateError = false;
let renderedRoute = null;

function normalizeSettings(s) {
  const d = defaults().settings;
  const source = isPlainObject(s) ? s : {};
  const profile = isPlainObject(source.profile) ? source.profile : {};
  const areas = isPlainObject(source.areas) ? source.areas : {};
  const prefs = isPlainObject(source.prefs) ? source.prefs : {};
  const pomodoro = isPlainObject(prefs.pomodoro) ? prefs.pomodoro : {};
  const o = { ...d, ...source };
  o.profile = { ...d.profile, ...profile };
  o.profile.name = typeof profile.name === 'string' ? profile.name.slice(0, 50) : d.profile.name;
  o.profile.preferredName = typeof profile.preferredName === 'string' && profile.preferredName.trim()
    ? profile.preferredName.slice(0, 50)
    : o.profile.name;
  o.profile.sex = Object.hasOwn(SEX, profile.sex) ? profile.sex : '';
  o.profile.age = Number.isInteger(profile.age) && profile.age >= 5 && profile.age <= 120 ? profile.age : null;
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
  o.prefs.pomodoro = { ...d.prefs.pomodoro, ...pomodoro };
  o.prefs.pomodoro.on = typeof pomodoro.on === 'boolean' ? pomodoro.on : d.prefs.pomodoro.on;
  o.prefs.pomodoro.preset = ['classic', 'custom'].includes(pomodoro.preset)
    ? pomodoro.preset
    : Object.hasOwn(pomodoro, 'focusMin') || Object.hasOwn(pomodoro, 'breakMin')
      ? 'custom'
      : d.prefs.pomodoro.preset;
  o.prefs.pomodoro.focusMin = Number.isInteger(pomodoro.focusMin) && pomodoro.focusMin >= 5 && pomodoro.focusMin <= 120 ? pomodoro.focusMin : d.prefs.pomodoro.focusMin;
  o.prefs.pomodoro.breakMin = Number.isInteger(pomodoro.breakMin) && pomodoro.breakMin >= 1 && pomodoro.breakMin <= 60 ? pomodoro.breakMin : d.prefs.pomodoro.breakMin;
  o.prefs.pomodoro.longBreakMin = Number.isInteger(pomodoro.longBreakMin) && pomodoro.longBreakMin >= 5 && pomodoro.longBreakMin <= 60 ? pomodoro.longBreakMin : d.prefs.pomodoro.longBreakMin;
  o.prefs.pomodoro.soundTone = Object.hasOwn(POMODORO_SOUND_TONES, pomodoro.soundTone)
    ? pomodoro.soundTone
    : d.prefs.pomodoro.soundTone;
  o.prefs.pomodoro.soundVolume = Number.isInteger(pomodoro.soundVolume)
    && pomodoro.soundVolume >= 0
    && pomodoro.soundVolume <= 100
    ? pomodoro.soundVolume
    : d.prefs.pomodoro.soundVolume;
  o.prefs.waterGoalMl = Number.isInteger(prefs.waterGoalMl) && prefs.waterGoalMl >= 500 && prefs.waterGoalMl <= 10000 ? prefs.waterGoalMl : d.prefs.waterGoalMl;
  o.prefs.birthday = isValidBirthdayReference(prefs.birthday) ? { ...prefs.birthday } : null;
  o.prefs.birthdayCorrectionUsed = prefs.birthdayCorrectionUsed === true;
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
  o.lists = cleanL(s?.lists); if (!o.lists.length) o.lists = DEF_LISTS.map((x) => ({ ...x }));
  const dc = defCats(); o.cats = { out: cleanL(s?.cats?.out, true), in: cleanL(s?.cats?.in, true) };
  if (!o.cats.out.length) o.cats.out = dc.out; if (!o.cats.in.length) o.cats.in = dc.in;
  if (!PALETTES[o.theme] && o.theme !== 'custom') o.theme = 'rose';
  o.accountTypes = Array.isArray(source.accountTypes)
    ? [...new Set(source.accountTypes.filter((key) => Object.hasOwn(ACCOUNT_TYPES, key)))]
    : d.accountTypes;
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
  && Object.hasOwn(ACCOUNT_TYPES, record.type)
  && isSafeInteger(record.initialCents)
  && optional(record, 'bank', isText)
  && optional(record, 'limitCents', (value) => isSafeInteger(value) && value >= 0)
  && optional(record, 'closingDay', (value) => Number.isInteger(value) && value >= 0 && value <= 31)
  && optional(record, 'dueDay', (value) => Number.isInteger(value) && value >= 0 && value <= 31);
const isValidTransaction = (record) => isPlainObject(record)
  && isNonEmptyText(record.id) && ['in', 'out', 'tr'].includes(record.type)
  && isNonEmptyText(record.accountId) && isSafeInteger(record.cents) && record.cents > 0
  && isDay(record.date)
  && optional(record, 'settledDate', isDay)
  && optional(record, 'category', isText)
  && optional(record, 'desc', isText)
  && optional(record, 'paid', (value) => typeof value === 'boolean')
  && optional(record, 'createdAt', isFiniteValue)
  && optional(record, 'toAccountId', isNonEmptyText)
  && (record.type !== 'tr' || isNonEmptyText(record.toAccountId));
const isValidGoal = (record) => isPlainObject(record)
  && isNonEmptyText(record.id) && isText(record.name)
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
    if (Object.hasOwn(profile, 'age') && profile.age !== undefined && profile.age !== null && !(Number.isInteger(profile.age) && profile.age >= 5 && profile.age <= 120)) issues++;
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
    if (Object.hasOwn(prefs, 'menuOrder') && prefs.menuOrder !== undefined
      && !isValidMenuOrder(prefs.menuOrder)) issues++;
    if (Object.hasOwn(prefs, 'visibleMenuItems') && prefs.visibleMenuItems !== undefined
      && !isValidVisibleMenuItems(prefs.visibleMenuItems)) issues++;
    if (Object.hasOwn(prefs, 'areaTutorialsSeen') && prefs.areaTutorialsSeen !== undefined
      && !isValidAreaTutorialsSeen(prefs.areaTutorialsSeen)) issues++;
    if (Object.hasOwn(prefs, 'pomodoro') && prefs.pomodoro !== undefined && !isPlainObject(prefs.pomodoro)) issues++;
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
    if (isPlainObject(prefs.pomodoro)) {
      const pomodoro = prefs.pomodoro;
      if (Object.hasOwn(pomodoro, 'on') && pomodoro.on !== undefined && typeof pomodoro.on !== 'boolean') issues++;
      if (Object.hasOwn(pomodoro, 'preset') && pomodoro.preset !== undefined && !['classic', 'custom'].includes(pomodoro.preset)) issues++;
      if (Object.hasOwn(pomodoro, 'focusMin') && pomodoro.focusMin !== undefined
        && !(Number.isInteger(pomodoro.focusMin) && pomodoro.focusMin >= 5 && pomodoro.focusMin <= 120)) issues++;
      if (Object.hasOwn(pomodoro, 'breakMin') && pomodoro.breakMin !== undefined
        && !(Number.isInteger(pomodoro.breakMin) && pomodoro.breakMin >= 1 && pomodoro.breakMin <= 60)) issues++;
      if (Object.hasOwn(pomodoro, 'longBreakMin') && pomodoro.longBreakMin !== undefined
        && !(Number.isInteger(pomodoro.longBreakMin) && pomodoro.longBreakMin >= 5 && pomodoro.longBreakMin <= 60)) issues++;
      if (Object.hasOwn(pomodoro, 'soundTone') && pomodoro.soundTone !== undefined
        && !Object.hasOwn(POMODORO_SOUND_TONES, pomodoro.soundTone)) issues++;
      if (Object.hasOwn(pomodoro, 'soundVolume') && pomodoro.soundVolume !== undefined
        && !(Number.isInteger(pomodoro.soundVolume) && pomodoro.soundVolume >= 0 && pomodoro.soundVolume <= 100)) issues++;
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
    else issues += value.accountTypes.filter((key) => !Object.hasOwn(ACCOUNT_TYPES, key)).length;
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
    timer.history = normalizePomodoroHistory(v.history);
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
    return { value: { accounts: accounts.records, tx: tx.records, budgets, goals: goals.records, recurring: recurring.records }, invalidCount };
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
const Persist = {
  userId: '',
  store: null,
  inFlight: null,
  pendingSnapshot: null,
  confirmedState: null,
  rawTables: null,
  replacing: false,
  attach({ client, user }) {
    this.userId = user.id;
    this.store = new RelationalAccountStore(client, user.id);
    this.confirmedState = null;
    ui.persistError = '';
    configurePomodoroPushStore(this.store);
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
          await this.store.save(snapshot);
          this.confirmedState = JSON.parse(JSON.stringify(snapshot));
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
          syncState.pending.forEach((slice) => syncState.failed.add(slice));
          syncState.failed.add('account');
          syncState.pending.clear();
          ui.persistFailed.add('account');
          ui.persistError = error instanceof Error
            ? error.message.replace(/^Não foi possível salvar as alterações na conta\.\s*/, '').slice(0, 200)
            : '';
          console.error('Aurora: a gravação relacional não foi confirmada.', error);
          toast(error instanceof Error ? error.message : 'Não foi possível salvar. Tente novamente quando a conexão estiver estável.');
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
    if (navigator.onLine === false) throw new Error('Sem conexão: o backup não foi restaurado.');
    if (this.inFlight) await this.inFlight;
    await this.store.save(JSON.parse(JSON.stringify(S)));
    this.confirmedState = JSON.parse(JSON.stringify(S));
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
    syncState.pending.clear();
    syncState.failed.clear();
    syncState.conflicts.clear();
  },
  wipe() {
    this.pendingSnapshot = null;
    this.rawTables = null;
    this.store = null;
    this.userId = '';
    this.confirmedState = null;
    clearPomodoroPushState();
  },
};
async function loadAccountData() {
  const loaded = await Persist.store.load();
  Persist.rawTables = Persist.store.rawTables;
  const initial = defaults();
  for (const slice of SLICES) {
    const normalized = normalizeSlice(slice, loaded[slice] ?? initial[slice]);
    S[slice] = normalized.value;
    stamps[slice] = Date.now();
    if (normalized.invalidCount) {
      ui.integrityIssues[slice] = normalized.invalidCount;
      ui.persistBlocked.add(slice);
      ui.persistFailed.add(slice);
      syncState.failed.add(slice);
    }
  }
  Persist.confirmedState = JSON.parse(JSON.stringify(S));
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
  if (!Persist.saveMany(slices)) {
    restoreSliceSnapshot(snapshot);
    toast(`Não foi possível preparar ${context} para salvar; os dados originais foram mantidos.`);
    if (shouldRender) render();
    return false;
  }
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
const GRAD = raw('<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><linearGradient id="auroraGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#D991AA"/><stop offset="1" stop-color="#8D4665"/></linearGradient></defs></svg>');
const brandIcon = (size = 40) => raw(`<svg width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="18" fill="url(#auroraGrad)"/><path d="M32 14 46 48h-7.5l-2.600-6.800H28.100L25.5 48H18zm0 12.5-3.200 8.5h6.400z" fill="#fff"/><circle cx="46.5" cy="17.5" r="4" fill="#FBE7D3"/></svg>`);
const configLink = () => h`<a class="inline-link" href="#config?weight" aria-label="Abrir Ajustes e editar o peso">Ajustes</a>`;

/* ========== Casca, roteamento e componentes comuns ========== */
const ROUTE_TITLES = { inicio: 'Início', planejar: 'Planejar', pomodoro: 'Pomodoro', financas: 'Finanças', ciclo: 'Ciclo', habitos: 'Hábitos', config: 'Ajustes' };
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const money = (cents) => h`<span class="money">${brl(cents)}</span>`;
const expenseTitle = (name) => String(name ?? '').replace(/^(\s*\p{L})/u, (first) => first.toLocaleUpperCase('pt-BR'));
const tabLabel = (label) => h`<span class="tab-label-group"><span class="tab-label">${label}</span><i class="tab-period" aria-hidden="true">.</i></span>`;
const brandLink = h`<a class="brand" href="#inicio" aria-label="Aurora, início">${brandIcon(36)}<span class="wordmark">aurora<i>.</i></span></a>`;

const notificationCount = () => Object.keys(ui.alerts).length;
function updateDocumentTitle() {
  const title = ROUTE_TITLES[ui.route] || 'Aurora';
  document.title = `${notificationCount() ? `(${notificationCount()}) ` : ''}${title} | Aurora`;
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
  const kindLabel = (a) => a.kind === 'pomodoro' ? 'Pomodoro' : a.kind === 'habit' ? 'Hábito' : 'Tarefa';
  return h`<section class="notification-panel" id="notification-panel" role="dialog" aria-modal="false" aria-labelledby="notification-title" ${ui.notificationsOpen ? raw('') : raw('hidden')}>
    <header class="notification-head"><div><h2 id="notification-title">Notificações</h2><span class="small muted">${items.length ? `${items.length} ${plural(items.length, 'pendente', 'pendentes')}` : 'Tudo em dia'}</span></div>${items.length > 1 ? h`<button type="button" class="btn ghost sm notification-clear" data-action="rem-dismiss-all">Dispensar todas</button>` : ''}<button type="button" class="ibtn dlg-close" id="notification-close" data-action="close-notifications" aria-label="Fechar notificações">${icon('close', 18)}</button></header>
    ${items.length ? h`<h3 class="notification-section-title">Agora</h3><div class="notification-list" aria-live="polite">${items.map(([k, a]) => {
      const habit = a.kind === 'habit' ? S.habits.find((item) => item.id === a.id) : null;
      return h`<article class="notification-item is-${a.kind || 'task'}" ${habit ? raw(`style="--nc:${habitColor(habit)}"`) : ''}>
      <span class="notification-icon">${icon(a.kind === 'pomodoro' ? 'clock' : habit ? habitIconKey(habit) : 'bell', 18)}</span>
      <div class="notification-copy"><div class="notification-meta"><span class="notification-kind">${kindLabel(a)}</span><span class="notification-ago">${agoLabel(a.at)}</span><button class="ibtn notification-x" data-action="rem-dismiss" data-k="${k}" aria-label="Dispensar: ${a.title}">${icon('close', 16)}</button></div><b class="user-value">${a.title}</b>${a.kind === 'pomodoro' ? '' : h`<small>${a.kind === 'habit' ? `lembrete das ${a.time}` : `tarefa das ${a.time}`}</small>`}${a.detail ? h`<p>${a.detail}</p>` : ''}</div>
      <div class="notification-actions">${a.kind === 'pomodoro'
        ? h`<button class="btn sm primary" data-action="pomo-pause" data-k="${k}">Pausar ${a.phase === 'focus' ? 'foco' : 'intervalo'}</button>`
        : a.kind === 'habit'
          ? h`<button class="btn sm primary" data-action="habit-reminder-done" data-k="${k}" data-id="${a.id}">Marcar hábito</button>`
          : h`<button class="btn sm primary" data-action="rem-done" data-k="${k}" data-id="${a.id}">Concluir</button><button class="btn sm" data-action="rem-snooze" data-k="${k}">+10 min</button><button class="btn sm" data-action="rem-snooze" data-k="${k}" data-min="60">+1 h</button>`}</div>
    </article>`; })}</div>` : h`<div class="notification-empty">${icon('check', 20)}<b>Nenhuma notificação por enquanto</b><span>Lembretes de tarefas e hábitos e avisos do Pomodoro aparecem aqui.</span></div>`}
    ${upcoming.length ? h`<section class="notification-upcoming" aria-labelledby="notification-upcoming-title"><h3 id="notification-upcoming-title">Ainda hoje</h3><ul>${upcoming.map((u) => h`<li><time class="nu-time">${u.time}</time><span class="grow user-value">${u.kind === 'finance' ? `${u.title} · ${u.detail}` : u.title}</span><small>${u.kind === 'habit' ? 'hábito' : u.kind === 'finance' ? 'conta fixa' : 'tarefa'}</small></li>`)}</ul></section>` : ''}
  </section>`;
}
function closeNotifications(restoreFocus = true) {
  ui.notificationsOpen = false;
  render();
  if (restoreFocus) {
    const trigger = $$('.notification-trigger').find((el) => el.getClientRects().length);
    if (trigger) trigger.focus();
  }
}
function closeAccessibility(restoreFocus = true) {
  ui.accessibilityOpen = false;
  render();
  if (restoreFocus) $('#accessibility-trigger')?.focus();
}
/* Erro junto ao campo: marca o campo, escreve a mensagem logo abaixo e leva o foco até ele.
   Só mexe no DOM do diálogo aberto; some quando a pessoa volta a digitar. Cai para o aviso se não achar o campo. */
function fieldError(message, selector) {
  const field = selector ? document.querySelector(`#dlg ${selector}`) : null;
  if (!field) return toast(message);
  const label = field.closest('label') || field.parentElement;
  label.querySelector('.field-err')?.remove();
  const note = document.createElement('span');
  note.className = 'err field-err'; note.id = `err-${Math.random().toString(36).slice(2, 8)}`; note.setAttribute('role', 'alert'); note.textContent = message;
  label.append(note);
  field.setAttribute('aria-invalid', 'true'); field.setAttribute('aria-describedby', note.id);
  const clear = () => { note.remove(); field.removeAttribute('aria-invalid'); field.removeAttribute('aria-describedby'); field.removeEventListener('input', clear); field.removeEventListener('change', clear); };
  field.addEventListener('input', clear);
  field.addEventListener('change', clear);
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
function updateAccessibilityLook(updates, focusId) {
  updateSettingsDraft((settings) => {
    settings.look = { ...settings.look, ...updates };
  });
  if (focusId) document.getElementById(focusId)?.focus();
}
function clearPomodoroNotifications() {
  Object.keys(ui.alerts).forEach((key) => {
    const alert = ui.alerts[key];
    if (alert.kind === 'pomodoro') delete ui.alerts[key];
  });
}
function shell(body) {
  const overdue = S.tasks.filter((t) => !t.done && t.dueDate && t.dueDate < today()).length;
  const saveStatus = ui.persistBlocked.size || ui.persistFailed.size ? 'warning' : 'saved';
  const saveLabel = ui.preview
    ? ''
    : ui.persistBlocked.size
      ? 'Dados bloqueados; revise antes de salvar'
      : ui.persistFailed.size
        ? 'Falha ao salvar; tente novamente'
        : '';
  const menuItems = orderMenuItems(S.settings.prefs.menuOrder, S.settings.areas, false, S.settings.prefs.visibleMenuItems, HIDDEN_MENU_IDS);
  const compactItems = menuItems.slice(0, 4);
  const secondaryItems = menuItems.slice(4);
  const hasActiveArea = Object.values(S.settings.areas).some(Boolean);
  const isCurrent = (id) => id === ui.route;
  const navLink = ({ id, label, icon: iconName, area }, className = '') => h`<a class="${area ? 'nav-area ' : ''}${className}" href="#${id}" ${isCurrent(id) ? raw('aria-current="page"') : ''}><span class="ni">${icon(iconName, area ? 20 : 22)}${id === 'planejar' && overdue ? h`<span class="dot" aria-label="${overdue} tarefas atrasadas"></span>` : ''}</span>${tabLabel(label)}</a>`;
  const currentInMore = secondaryItems.some(({ id }) => isCurrent(id));
  const navItems = h`${compactItems.map((item) => navLink(item, 'nav-primary'))}${secondaryItems.map((item) => navLink(item, 'nav-secondary'))}${secondaryItems.length ? h`<button type="button" class="nav-more-trigger" data-action="nav-more-toggle" aria-expanded="${String(ui.navigationOpen)}" aria-controls="nav-more-menu" ${currentInMore ? raw('aria-current="page"') : ''}><span class="ni">${icon('more', 22)}</span><span>Mais</span></button><div class="nav-more-menu" id="nav-more-menu" ${ui.navigationOpen ? '' : raw('hidden')}>${secondaryItems.map((item) => navLink(item, 'nav-more-link'))}</div>` : ''}${!hasActiveArea ? h`<a class="nav-enable-areas" href="#config?section=areas-navigation" data-action="areas-nav-open"><span class="ni">${icon('plus', 22)}</span><span>Ativar áreas</span></a>` : ''}`;
  return h`${GRAD}<a class="skip" href="#main" data-action="skip">Pular para o conteúdo principal</a><div class="app${ui.preview ? ' preview-shell' : ''}">
    <!-- aria-expanded and aria-controls announce the popover state and its relationship to assistive technology. -->
    ${ui.navigationOpen ? h`<div class="nav-scrim" data-action="nav-more-toggle" aria-hidden="true"></div>` : ''}<header class="topbar">${brandLink}<nav class="nav" aria-label="Principal">${navItems}</nav><span class="header-actions">${modeBtn('iconbtn theme-trigger')}<button type="button" class="iconbtn global-search-trigger" data-action="search-open" aria-label="Busca global" title="Buscar (Ctrl+K)">${icon('search', 20)}</button>${notificationButton('iconbtn', 'notification-top')}<button type="button" class="iconbtn" data-action="reload-app" aria-label="Atualizar app" title="Atualizar app">${icon('refresh', 20)}</button><span class="accessibility-control"><button type="button" id="accessibility-trigger" class="iconbtn" data-action="accessibility-toggle" aria-label="Tema e acessibilidade" aria-expanded="${String(ui.accessibilityOpen)}" aria-haspopup="true" aria-controls="accessibility-panel" title="Tema e acessibilidade">${icon('accessibility', 20)}</button>${accessibilityPanel()}</span><a class="profile-link iconbtn" href="#config" ${ui.route === 'config' ? raw('aria-current="page"') : ''} aria-label="Perfil e configurações" title="Perfil e configurações">${icon('user', 20)}</a></span></header>
    <div class="sr" id="notification-announcer" role="status" aria-live="polite" aria-atomic="true"></div>
    <main class="main" id="main" data-route="${ui.route}" tabindex="-1">
      ${notificationsHtml()}
      ${navigator.onLine === false ? h`<div class="notice warn" role="status">Sem conexão com a internet. O Aurora não grava alterações offline; conecte-se e toque em “Tentar novamente” para reenviar o que ainda estiver nesta tela.</div>` : ''}
      ${body}
    </main>
    <footer class="app-footer site-footer">${raw(renderFooterContent({ authenticated: !ui.preview, preview: ui.preview }))}${saveLabel ? h`<span class="save-indicator" data-status="${ui.persistFailed.size || saveStatus === 'warning' ? 'warning' : saveStatus}" role="status" aria-live="polite">${saveLabel}</span>` : ''}</footer>
  </div>`;
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
    <section class="weekly-review-hero"><div><span>Fechamento semanal</span><h2>Veja o que avançou<i>.</i></h2><p>${first.getDate()} ${MESES_L[first.getMonth()]}–${last.getDate()} ${MESES_L[last.getMonth()]} · Use este retrato para ajustar a próxima semana.</p></div><div class="weekly-review-actions"><button class="btn primary" data-action="plan-open">${icon('plus', 16)}Planejar próxima semana</button><button class="btn" data-action="weekly-open-finances">${icon('wallet', 16)}Ver finanças</button></div></section>
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
        ? h`<ul class="list">${review.nextWeek.tasks.map(taskRow)}</ul>`
        : empty('Semana livre por enquanto', 'Crie um plano por etapas ou adicione a próxima prioridade.', h`<button class="btn" data-action="plan-open">${icon('plus', 16)}Planejar semana</button>`, 'calendar')}
    </section></div>
    <section class="review-discovery" aria-label="Atalhos úteis"><span>Próximos passos</span><a class="btn sm" href="#pomodoro">${icon('clock', 16)}Usar Pomodoro</a><button type="button" data-action="weekly-open-habits">${icon('check', 16)}Revisar hábitos</button><button type="button" data-action="weekly-open-finances">${icon('wallet', 16)}Conferir gastos</button></section>
  </div>`;
}

const greet = () => { const hr = new Date().getHours(); return hr < 5 ? 'Boa madrugada' : hr < 12 ? 'Bom dia' : hr < 18 ? 'Boa tarde' : 'Boa noite'; };
const PAGE_CONTEXT = {
  Planejar: ['Tarefas e prazos', 'Crie tarefas, organize a semana e acompanhe itens atrasados.'],
  Pomodoro: ['Foco e pausas', 'Configure blocos Pomodoro e associe tarefas ao timer.'],
  Finanças: ['Contas e lançamentos', 'Acompanhe saldos, receitas, despesas e objetivos.'],
  Ciclo: ['Ciclo menstrual', 'Registre menstruação e sintomas para consultar o histórico e as estimativas.'],
  Hábitos: ['Registro de hábitos', 'Marque os dias realizados e consulte a frequência semanal.'],
  Ajustes: ['Perfil e preferências', 'Edite o perfil, organize as áreas e ajuste as preferências do aplicativo.'],
};
const pageTitle = (title, action = '') => {
  const [eyebrow, description] = PAGE_CONTEXT[title] || [];
  return h`<header class="page-title"><div class="page-title-copy">${eyebrow ? h`<span class="page-title-eyebrow">${eyebrow}</span>` : ''}<h1>${title}<i>.</i></h1>${description ? h`<p>${description}</p>` : ''}</div>${action}</header>`;
};
const empty = (title, text, action = '', iconName = 'sparkles') => h`<section class="empty" aria-label="${title}"><span class="eic" aria-hidden="true">${icon(iconName, 28)}</span><div class="empty-copy"><b>${title}</b><span>${text}</span></div>${action ? h`<div class="empty-action">${action}</div>` : ''}</section>`;
const ring = (done, total) => { const c = 2 * Math.PI * 32, pc = total ? done / total : 0; return h`<div class="ringw" role="img" aria-label="${done} de ${total} tarefas de hoje concluídas"><svg width="76" height="76" viewBox="0 0 76 76" aria-hidden="true"><circle class="ring-bg" cx="38" cy="38" r="32" fill="none" stroke-width="7"/><circle class="ring-fg" cx="38" cy="38" r="32" fill="none" stroke-width="7" stroke-linecap="round" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - pc)).toFixed(1)}" transform="rotate(-90 38 38)"/></svg><div class="rt">${done}/${total}</div></div>`; };
const areaOn = (a) => S.settings.areas[a];
function setAreaEnabled(settings, area, enabled) {
  if (!Object.hasOwn(settings.areas, area)) return false;
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
  const items = orderMenuItems(S.settings.prefs.menuOrder, S.settings.areas, false, S.settings.prefs.visibleMenuItems, HIDDEN_MENU_IDS).filter(({ area }) => area);
  if (items.length < 2) return '';
  return h`<nav class="areanav scroll-x" aria-label="Áreas">${items.map(({ id, label, icon: iconName }) => h`<a href="#${id}" ${id === cur ? raw('aria-current="page"') : ''}>${icon(iconName, 16)}${tabLabel(label)}</a>`)}</nav>`;
}
function areaGuideButton(route) {
  if (!AREA_GUIDES[route]) return '';
  return h`<div class="area-guide-control"><button type="button" class="btn ghost" data-action="area-guide-open" data-area-guide="${route}">${icon('play', 16)}Como usar?</button></div>`;
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
function taskRow(t) {
  const d = t.dueDate ? dayDiff(t.dueDate, today()) : null;
  const tm = t.time ? ' ' + t.time : '', subs = t.subtasks || [], sd = subs.filter((x) => x.done).length;
  const due = !t.dueDate ? '' : (!t.done && d < 0) ? h`<span class="m-bad">Atrasada · ${shortDate(t.dueDate)}${tm}</span>` : d === 0 ? h`<span class="m-warn">Hoje${tm}</span>` : d === 1 ? h`<span>Amanhã${tm}</span>` : h`<span>${shortDate(t.dueDate)}${tm}</span>`;
  const man = ui.route === 'planejar' && ui.filters.sort === 'manual' && !t.done;
  return h`<li class="task ${t.done ? 'done' : ''}" data-k="${t.id}" ${man ? raw('draggable="true"') : ''}>${man ? h`<span class="mvc"><button type="button" class="ibtn mv" data-action="mv-up" data-id="${t.id}" aria-label="Mover para cima: ${t.title}">${icon('arrowUp', 16)}</button><button type="button" class="ibtn mv" data-action="mv-down" data-id="${t.id}" aria-label="Mover para baixo: ${t.title}">${icon('arrowDown', 16)}</button></span>` : ''}
    <button class="chk p-${t.priority}" role="checkbox" aria-checked="${t.done}" aria-label="${t.done ? 'Reabrir' : 'Concluir'}: ${t.title}" data-action="toggle" data-id="${t.id}"><span>${icon('check', 15)}</span></button>
    <button class="tt" data-action="edit-task" data-id="${t.id}" aria-label="Editar: ${t.title}"><span class="ttl">${t.title}</span>
      <span class="meta">${due}${t.focusSeconds ? h`<span class="mi">${icon('clock', 12)}Foco ${dur(t.focusSeconds)}</span>` : ''}${t.priority === 'high' ? h`<span class="m-hi">${icon('flag', 12)}Alta</span>` : t.priority === 'low' ? h`<span>Prioridade baixa</span>` : ''}${t.repeat && t.repeat !== 'none' ? h`<span class="mi" title="${REPEATS[t.repeat]}">${icon('repeat', 12)}${REPEATS[t.repeat]}</span>` : ''}${t.remind != null && t.time ? h`<span class="mi" title="Lembrete">${icon('bell', 12)}</span>` : ''}${subs.length ? h`<span class="mi">${icon('list', 12)}${sd}/${subs.length}</span>` : ''}${t.notes ? h`<span class="mi" title="Tem notas">${icon('note', 12)}</span>` : ''}${(t.tags || []).map((g) => h`<span class="tgx">#${g}</span>`)}${t.groupTitle ? h`<span>${icon('list', 12)} <span class="user-value">${t.groupTitle}</span></span>` : ''}${t.sample ? h`<span>Exemplo</span>` : ''}</span></button>
    ${!t.done && areaOn('pomodoro') ? h`<button type="button" class="ibtn task-focus-button" data-action="task-focus" data-id="${t.id}" aria-label="Iniciar Pomodoro para: ${t.title}" title="Focar nesta tarefa">${icon('play', 16)}</button>` : ''}
    <button class="ibtn" data-action="del-task" data-id="${t.id}" aria-label="Excluir ${t.title}">${icon('trash', 18)}</button>
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
  r.setAttribute('data-density', L.density); r.setAttribute('data-fs', L.font);
  r.setAttribute('data-contrast', L.contrast ? 'high' : 'normal');
  r.setAttribute('data-readable', L.readable ? 'true' : 'false');
  r.setAttribute('data-links', L.highlightLinks ? 'highlight' : 'normal');
  r.setAttribute('data-motion', L.reduceMotion ? 'reduce' : 'normal');
  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) themeColor.content = getComputedStyle(r).getPropertyValue('--bg').trim();
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
  toast(`Tema ${MODE_NAME[mode]} aplicado e salvo.`);
}
function accessibilityPanel() {
  const look = settingsView().look;
  const effectiveDark = look.mode === 'dark' || (look.mode === 'auto' && systemThemeQuery?.matches);
  const fonts = ['s', 'm', 'l'];
  const fontIndex = fonts.indexOf(look.font);
  const toggle = (id, action, label, description, pressed) => h`<button type="button" id="${id}" class="accessibility-option" data-action="${action}" aria-pressed="${String(pressed)}"><span class="accessibility-option-copy"><b>${label}</b><small>${description}</small></span><span class="accessibility-state" aria-hidden="true">${pressed ? 'Ativado' : 'Desativado'}</span></button>`;
  return h`<form class="accessibility-panel" id="accessibility-panel" data-form="settings-save" aria-labelledby="accessibility-title" ${ui.accessibilityOpen ? raw('') : raw('hidden')}>
    <header class="accessibility-head"><div><h2 id="accessibility-title">Tema e acessibilidade</h2><p>As preferências são sincronizadas com sua conta.</p></div><button type="button" class="ibtn dlg-close" id="accessibility-close" data-action="accessibility-close" aria-label="Fechar tema e acessibilidade">${icon('close', 18)}</button></header>
    <div class="accessibility-font" role="group" aria-label="Tamanho do texto">
      <span class="accessibility-group-label">Tamanho do texto</span>
      <div class="accessibility-font-controls"><button type="button" class="btn sm" id="accessibility-font-down" data-action="accessibility-font" data-step="-1" aria-label="A− Diminuir tamanho do texto" ${fontIndex <= 0 ? raw('disabled') : ''}>A−</button><button type="button" class="btn sm" id="accessibility-font-reset" data-action="accessibility-font-reset" aria-label="Restaurar tamanho padrão do texto" ${look.font === 'm' ? raw('disabled') : ''}>Padrão</button><button type="button" class="btn sm" id="accessibility-font-up" data-action="accessibility-font" data-step="1" aria-label="A+ Aumentar tamanho do texto" ${fontIndex >= fonts.length - 1 ? raw('disabled') : ''}>A+</button></div>
    </div>
    <div class="accessibility-font" role="group" aria-label="Tema">
      <span class="accessibility-group-label">Tema (salvo ao tocar)</span>
      <div class="seg">${[['auto', 'Automático', 'monitor'], ['light', 'Claro', 'sun'], ['dark', 'Escuro', 'moon']].map(([value, text, ic]) => h`<button type="button" id="accessibility-mode-${value}" aria-pressed="${String(look.mode === value)}" data-action="accessibility-mode" data-v="${value}">${icon(ic, 16)}<span>${text}</span></button>`)}</div>
    </div>
    <div class="accessibility-options">
      ${toggle('accessibility-contrast', 'accessibility-contrast', 'Alto contraste', 'Reforça textos, bordas e foco.', look.contrast)}
      ${toggle('accessibility-readable', 'accessibility-readable', 'Legibilidade aprimorada', 'Usa fonte simples e aumenta o espaçamento entre linhas.', look.readable)}
      ${toggle('accessibility-links', 'accessibility-links', 'Destacar links', 'Sublinha os links para identificá-los com mais facilidade.', look.highlightLinks)}
      ${toggle('accessibility-spacing', 'accessibility-spacing', 'Espaçamento confortável', 'Aumenta o respiro e as áreas para toque.', look.density === 'comfy')}
    </div>
    <a class="btn accessibility-more" id="accessibility-more" href="#config?section=personalization" data-action="accessibility-more">Mais opções de aparência</a>
    <button type="button" class="btn accessibility-reset" id="accessibility-reset" data-action="accessibility-reset">Restaurar configurações visuais</button>
    ${settingsSaveButton('Salvar configurações')}
  </form>`;
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
function render() {
  ui.dirty = false;
  applyTheme();
  const routeChanged = renderedRoute !== null && renderedRoute !== ui.route;
  const keep = {};
  $$('[data-keep]').forEach((el) => { if (el.id) keep[el.id] = el.type === 'checkbox' ? el.checked : el.value; });
  const active = document.activeElement;
  const af = active && active.id;
  if (ui.dlg && !$('#dlg') && !ui.lastFocus) ui.lastFocus = describeDialogOpener(active);
  const page = (ROUTES[ui.route] || ROUTES.inicio)();
  const app = $('#app');
  app.innerHTML = shell(page).s;
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
  if (!ui.preview && !ui.dlg && AREA_GUIDE_IDS.includes(ui.route)
    && !S.settings.prefs.areaTutorialsSeen.includes(ui.route)
    && !ui.areaTutorialsPresented.has(ui.route)) {
    ui.areaTutorialsPresented.add(ui.route);
    ui.dlg = createDialog('area-tutorial', { route: ui.route, automatic: true });
  }
  renderDialog();
  $('#app').inert = Boolean(ui.dlg);
  renderToast();
  tick();
}
function setToast(msg, undo) {
  clearTimeout(ui.toastT);
  if (Object.keys(ui.integrityIssues).length) {
    const slices = Object.keys(ui.integrityIssues).join(', ');
    msg = `Dados inválidos em ${slices}. A gravação está bloqueada; abra Ajustes para baixar uma cópia ou importar um backup.`;
    undo = null;
  } else if (ui.persistFailed.size) {
    msg = `Não foi possível salvar as alterações no Supabase. Confira a conexão e tente novamente.${ui.persistError ? ` Detalhe técnico: ${ui.persistError}` : ''}`;
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
  el.className = `toast toast-${ui.toast.tone}${ui.dlg || ui.navigationOpen ? ' toast-top' : ''}`;
  el.setAttribute('role', ui.toast.tone === 'error' ? 'alert' : 'status');
  const toastMessage = typeof ui.toast.msg === 'string' ? preserveCopyTerms(ui.toast.msg) : ui.toast.msg;
  el.innerHTML = h`<span class="toast-icon" aria-hidden="true">${icon(icons[ui.toast.tone], 18)}</span><span class="toast-content"><span class="toast-label">${labels[ui.toast.tone]}</span><span class="toast-message">${toastMessage}</span></span>${ui.toast.undo ? h`<button data-action="undo">Desfazer</button>` : ''}<i class="toast-timer" aria-hidden="true"></i>`.s;
}
function nav(route) { if (location.hash.slice(1) !== route) location.hash = route; else render(); }
function focusRouteTarget(id) {
  const target = document.getElementById(id);
  if (!target) return;
  target.focus({ preventScroll: true });
  target.scrollIntoView({ block: 'start' });
}
function onRoute() {
  ui.navigationOpen = false;
  let r = location.hash.slice(1);
  const queryIndex = r.indexOf('?');
  const query = queryIndex >= 0 ? r.slice(queryIndex + 1) : '';
  if (queryIndex >= 0) r = r.slice(0, queryIndex);
  if (!r && !ui.booted) {
    r = document.querySelector('meta[name="aurora-route"]')?.content || 'inicio';
    if (r !== 'inicio') history.replaceState(null, '', '#' + r);
  }
  ui.booted = true;
  const resolved = resolveRoute(r, new Set(Object.keys(ROUTES)));
  ui.route = resolved.route;
  const targetFocus = query === 'weight' ? 'pk' : null;
  const requestedSettingsTab = settingsTabId(new URLSearchParams(query).get('section'));
  if (ui.route === 'config' && SETTINGS_SECTIONS.some(([id]) => id === requestedSettingsTab)) {
    ui.settingsTab = requestedSettingsTab;
  } else if (ui.route === 'config' && targetFocus) ui.settingsTab = 'profile';
  if (resolved.replaceHash) history.replaceState(null, '', '#' + resolved.replaceHash);
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
  window.scrollTo(0, 0);
}

/* ========== Páginas: Início, Planejar, Foco ========== */
const todayTasks = () => S.tasks.filter((t) => t.dueDate && t.dueDate <= today() && taskVisible(t)).sort((a, b) => a.dueDate.localeCompare(b.dueDate) || (a.time || '99:99').localeCompare(b.time || '99:99'));
const standalonePomodoroPhaseName = (phase) => phase === 'focus' ? 'Foco' : 'Pausa';
const standalonePomodoroPhaseLabel = (phase, running, started) => {
  if (!started) return 'Pronto para começar';
  return `${standalonePomodoroPhaseName(phase)} ${running ? 'em andamento' : 'pausado'}`;
};
const timerPhaseMessage = (phase, pom) => phase === 'focus'
  ? `${pom.focusMin} min de foco, depois pausa de ${pom.breakMin} min.`
  : `Pausa de ${phase === 'long-break' ? longBreakMinutes(pom) : pom.breakMin} min.`;
const standaloneTimerReset = (progress = S.pomodoro) => ({
  elapsedSeconds: 0,
  startedAt: null,
  phase: 'focus',
  phaseElapsedSeconds: 0,
  completedPomodoros: 0,
  dailyCompletedPomodoros: progress.dailyCompletedPomodoros || 0,
  dailyCompletedOn: progress.dailyCompletedOn || '',
  history: normalizePomodoroHistory(progress.history),
  focusTaskId: '',
});
const pomodoroSettingsForTimer = () => ({
  ...effectivePomodoroSettings(S.settings.prefs.pomodoro),
  longBreakEnabled: false,
});

let pomodoroAudioContext = null;
let pomodoroAudioUnavailable = false;
function activatePomodoroAudio() {
  if (pomodoroAudioUnavailable) return;
  const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextConstructor) {
    pomodoroAudioUnavailable = true;
    console.warn('A reprodução de áudio não está disponível neste navegador.');
    return;
  }
  try {
    if (!pomodoroAudioContext) pomodoroAudioContext = new AudioContextConstructor();
    resumePomodoroAudioContext(pomodoroAudioContext)
      .catch((error) => console.warn('Não foi possível ativar o áudio do Pomodoro.', error));
  } catch (error) {
    pomodoroAudioUnavailable = true;
    console.warn('Não foi possível ativar o áudio do Pomodoro.', error);
  }
}
function playPomodoroSound(preferences = S.settings.prefs.pomodoro) {
  const context = pomodoroAudioContext;
  if (!context) return;
  const play = () => {
    if (context.state !== 'running') return;
    try {
      playPomodoroChime(context, {
        tone: preferences.soundTone,
        volume: preferences.soundVolume,
      });
    } catch (error) {
      console.warn('Não foi possível reproduzir o aviso sonoro do Pomodoro.', error);
    }
  };
  if (context.state === 'running') {
    play();
  } else {
    resumePomodoroAudioContext(context)
      .then(play)
      .catch((error) => console.warn('Não foi possível ativar o áudio do Pomodoro.', error));
  }
}
function reportPomodoroPushStatus(message) {
  ui.pushNotice = message;
  if (ui.route === 'pomodoro') render();
}
function syncPomodoroPushSchedule(timer = S.pomodoro) {
  if (!getPomodoroPushStatus().enabled) return;
  const stopping = timer.startedAt === null;
  const request = stopping
    ? cancelPomodoroPushSchedule()
    : schedulePomodoroPush(timer, pomodoroSettingsForTimer());
  request.then(() => {
    reportPomodoroPushStatus(stopping
      ? 'O agendamento da próxima fase foi cancelado no serviço.'
      : 'A próxima mudança de fase foi agendada; a entrega depende da rede e do serviço de notificações.');
  }).catch((error) => {
    const timerState = stopping ? 'O timer está parado' : 'O timer continua rodando';
    const staleNotice = stopping
      ? ' Um aviso que já estava agendado ainda pode ser entregue.'
      : ' A próxima fase não foi confirmada; um agendamento anterior, se houver, ainda pode ser entregue.';
    reportPomodoroPushStatus(`${timerState}, mas ${pomodoroPushErrorMessage(error)}${staleNotice}`);
  });
}
function togglePomodoroPush() {
  if (ui.pushBusy) return;
  const wasEnabled = getPomodoroPushStatus().enabled;
  let operation;
  try {
    operation = wasEnabled ? disablePomodoroPush() : enablePomodoroPush();
  } catch (error) {
    ui.pushNotice = pomodoroPushErrorMessage(error);
    render();
    return;
  }
  ui.pushBusy = true;
  ui.pushNotice = wasEnabled ? 'Desativando avisos…' : 'Solicitando permissão e configurando avisos…';
  render();
  Promise.resolve(operation).then(async () => {
    if (wasEnabled) {
      ui.pushNotice = 'Avisos desativados e inscrição removida deste dispositivo.';
      return;
    }
    if (S.pomodoro.startedAt !== null) {
      try {
        await schedulePomodoroPush(S.pomodoro, pomodoroSettingsForTimer());
      } catch (error) {
        ui.pushNotice = `Avisos ativados, mas a próxima fase não foi agendada: ${pomodoroPushErrorMessage(error)}`;
        return;
      }
      ui.pushNotice = 'Avisos ativados e a próxima mudança de fase foi agendada.';
    } else {
      ui.pushNotice = 'Avisos ativados. As mudanças serão agendadas quando você iniciar o Pomodoro.';
    }
  }).catch((error) => {
    ui.pushNotice = wasEnabled
      ? `Não foi possível concluir a desativação dos avisos: ${pomodoroPushErrorMessage(error)}`
      : `Não foi possível ativar os avisos: ${pomodoroPushErrorMessage(error)}`;
  }).finally(() => {
    ui.pushBusy = false;
    render();
  });
}
function togglePomodoroTimer() {
  const now = Date.now(), pom = pomodoroSettingsForTimer();
  let timer = S.pomodoro;
  if (timer.startedAt !== null) {
    const advanced = advancePomodoro(timer, pom, now);
    timer = { ...advanced.timer, phaseElapsedSeconds: phaseElapsedSeconds(advanced.timer, now), startedAt: null };
    if (advanced.transitions.length) notifyPomodoroPhase(advanced.transitions[advanced.transitions.length - 1], timer);
  } else {
    activatePomodoroAudio();
    timer = { ...timer, startedAt: now };
  }
  S.pomodoro = timer;
  commit('pomodoro');
  syncPomodoroPushSchedule(timer);
}
function skipPomodoroBreak() {
  const now = Date.now(), advanced = advancePomodoro(S.pomodoro, pomodoroSettingsForTimer(), now);
  let timer = advanced.timer;
  if (timer.phase === 'focus') {
    if (advanced.transitions.length) {
      S.pomodoro = timer;
      notifyPomodoroPhase(advanced.transitions[advanced.transitions.length - 1], timer);
      commit('pomodoro');
      syncPomodoroPushSchedule(timer);
    }
    return;
  }
  S.pomodoro = { ...timer, phase: 'focus', phaseElapsedSeconds: 0, startedAt: timer.startedAt === null ? null : now };
  commit('pomodoro');
  syncPomodoroPushSchedule(S.pomodoro);
}
function finishPomodoro() {
  const advanced = advancePomodoro(S.pomodoro, pomodoroSettingsForTimer());
  if (advanced.transitions.length) notifyPomodoroPhase(advanced.transitions[advanced.transitions.length - 1], advanced.timer);
  const timer = advanced.timer;
  clearPomodoroNotifications();
  const focusTask = S.tasks.find((task) => task.id === timer.focusTaskId);
  const focusedSeconds = timer.elapsedSeconds + (timer.phase === 'focus' ? phaseElapsedSeconds(timer) : 0);
  if (focusTask && focusedSeconds > 0) focusTask.focusSeconds = (focusTask.focusSeconds || 0) + focusedSeconds;
  S.pomodoro = standaloneTimerReset(timer);
  commit(...(timer.focusTaskId ? ['pomodoro', 'tasks'] : ['pomodoro']));
  syncPomodoroPushSchedule(S.pomodoro);
  toast('Sessão encerrada.');
}
function discardPomodoro() {
  const previous = S.pomodoro;
  clearPomodoroNotifications();
  S.pomodoro = standaloneTimerReset(previous);
  commit('pomodoro');
  syncPomodoroPushSchedule(S.pomodoro);
  toast('Pomodoro descartado.', () => {
    S.pomodoro = previous;
    commit('pomodoro');
    syncPomodoroPushSchedule(previous);
  });
}
const habitCompletedFor = (habit, day) => habitIsComplete(habit, day);
const sampleBanner = () => S.settings.prefs.sample ? h`<div class="notice warn" role="note">${icon('info', 18)}<div class="grow">Você está vendo dados de exemplo. Eles ajudam a conhecer o app, mas não são seus.</div><button class="btn sm" data-action="clear-sample">Limpar exemplos</button></div>` : '';
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
  return h`<div class="notice backup-reminder" role="note">${icon('archive', 18)}<div class="grow"><b>Hora de guardar uma cópia</b><br><span class="small">${text} Os dados são sincronizados com sua conta; o backup é uma cópia independente.</span></div><a class="btn sm primary" href="#config?section=data">Fazer backup</a><button type="button" class="btn sm ghost" data-action="backup-reminder-dismiss">Agora não</button></div>`;
};

function homeNextAction() {
  const now = Date.now(), todayKey = today(), candidates = [];
  S.tasks.filter((task) => !task.done && (task.dueDate || task.time)).forEach((task) => {
    const day = task.dueDate || todayKey;
    const time = isTime(task.time) ? task.time : '12:00';
    const dueAt = new Date(`${day}T${time}:00`).getTime();
    if (Number.isFinite(dueAt)) candidates.push({ type: 'task', task, at: dueAt, rank: 0 });
  });
  if (areaOn('habits')) {
    S.habits.filter((habit) => (
      (habit.status || 'active') === 'active'
      && habit.days.includes(pk(todayKey).getDay())
      && !habitCompletedFor(habit, todayKey)
      && !habitIsSkipped(habit, todayKey, todayKey)
    )).forEach((habit) => {
      const reminderAt = isTime(habit.remind) ? new Date(`${todayKey}T${habit.remind}:00`).getTime() : now;
      candidates.push({ type: 'habit', habit, at: Number.isFinite(reminderAt) ? reminderAt : now, rank: 1 });
    });
  }
  if (areaOn('finances')) {
    S.finance.accounts.filter((account) => account.type === 'credit').forEach((account) => {
      const info = cardInfo(account);
      if (!info.due || info.total <= 0 || info.used <= 0 || info.due > addDays(todayKey, 7)) return;
      const dueAt = new Date(`${info.due}T12:00:00`).getTime();
      candidates.push({ type: 'account', account, due: info.due, at: dueAt, rank: 2 });
    });
  }
  candidates.sort((a, b) => {
    const aOverdue = a.at < now, bOverdue = b.at < now;
    if (aOverdue && bOverdue) return b.at - a.at || a.rank - b.rank;
    if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
    return a.at - b.at || a.rank - b.rank;
  });
  const next = candidates[0];
  if (!next) return '';
  if (next.type === 'task') {
    const task = next.task;
    const label = task.dueDate && task.dueDate < todayKey ? `Atrasada · ${shortDate(task.dueDate)}`
      : task.dueDate === todayKey ? task.time ? `Hoje às ${task.time}` : 'Para hoje'
        : task.dueDate ? `${shortDate(task.dueDate)}${task.time ? ` às ${task.time}` : ''}` : `Hoje às ${task.time}`;
    return h`<section class="card home-next-action" aria-labelledby="home-next-title"><div class="home-next-mark">${icon('calendarCheck', 19)}</div><div class="grow"><span class="section-kicker">Próxima ação</span><h2 id="home-next-title">${task.title}</h2><p>${label}${task.priority === 'high' ? ' · prioridade alta' : ''}</p></div>${areaOn('pomodoro') ? h`<button type="button" class="btn primary" data-action="task-focus" data-id="${task.id}">${icon('play', 16)}Começar foco</button>` : h`<button type="button" class="btn primary" data-action="edit-task" data-id="${task.id}">Abrir tarefa</button>`}</section>`;
  }
  if (next.type === 'habit') {
    const habit = next.habit;
    return h`<section class="card home-next-action" aria-labelledby="home-next-title"><div class="home-next-mark" style="--hc:${habitColor(habit)}">${icon(habitIconKey(habit), 19)}</div><div class="grow"><span class="section-kicker">Próxima ação</span><h2 id="home-next-title">${habit.name}</h2><p>Este hábito ainda falta hoje.</p></div><button type="button" class="btn primary" data-action="habit-check" data-id="${habit.id}">Marcar como feito</button></section>`;
  }
  const days = dayDiff(next.due, todayKey);
  const dueLabel = days < 0 ? `Vencida há ${Math.abs(days)} ${plural(Math.abs(days), 'dia', 'dias')}`
    : days === 0 ? 'Vence hoje' : `Vence em ${days} ${plural(days, 'dia', 'dias')}`;
  return h`<section class="card home-next-action" aria-labelledby="home-next-title"><div class="home-next-mark">${icon('card', 19)}</div><div class="grow"><span class="section-kicker">Próxima ação</span><h2 id="home-next-title">Fatura de ${accountDisplayName(next.account)}</h2><p>${dueLabel} · ${shortDate(next.due)}</p></div><a class="btn primary" href="#financas">Ver Finanças</a></section>`;
}

function homeHabitCheckins() {
  if (!areaOn('habits')) return '';
  const scheduled = S.habits.filter((habit) => (
    (habit.status || 'active') === 'active'
    && habit.days.includes(pk(today()).getDay())
  ));
  if (!scheduled.length) return '';
  return h`<section class="card home-habit-checkins" aria-labelledby="home-habits-title">
    <div class="head"><h2 id="home-habits-title">Hábitos de hoje<i>.</i></h2><a class="btn ghost sm" href="#habitos">Ver hábitos</a></div>
    <ul class="list">${scheduled.map((habit) => {
      const completed = habitCompletedFor(habit, today());
      const skipped = habitIsSkipped(habit, today(), today());
      return h`<li class="home-habit-row">
        <span class="home-habit-icon" style="--hc:${habitColor(habit)}">${icon(habitIconKey(habit), 18)}</span>
        <span class="grow"><b>${habit.name}</b><span class="small muted">${completed ? 'Concluído hoje' : skipped ? 'Dia pulado hoje' : 'Ainda não marcado'}</span></span>
        <button type="button" class="btn sm ${completed || skipped ? 'back' : 'primary'}" data-action="${skipped ? 'habit-skip' : 'habit-check'}" data-id="${habit.id}" aria-pressed="${completed || skipped}">${icon(completed ? 'check' : skipped ? 'close' : 'plus', 16)}${completed ? 'Concluído' : skipped ? 'Desfazer pulo' : 'Marcar'}</button>
      </li>`;
    })}</ul>
  </section>`;
}

function viewInicio() {
  const name = (S.settings.profile.preferredName || S.settings.profile.name).trim();
  const tt = todayTasks(), pend = tt.filter((t) => !t.done), doneN = tt.length - pend.length;
  const overdue = pend.filter((t) => t.dueDate < today());
  const dueToday = pend.filter((t) => t.dueDate === today());
  const todayCount = S.tasks.filter((task) => task.dueDate === today()).length;
  const completed = tt.filter((t) => t.done);
  const inbox = S.tasks.filter((t) => !t.dueDate && !t.done);
  const optionalAreas = areaTiles();
  const activeAreaItems = MENU_ITEMS.filter(({ id, area }) => area && areaOn(area) && !HIDDEN_MENU_IDS.includes(id));
  const homeLayout = settingsView().prefs.homeLayout;
  const sundayReview = pk(today()).getDay() === 0;
  const showHomeBlock = (id) => homeLayout.visible.includes(id);
  const homeBlockStyle = (id) => `style="order:${homeLayout.order.indexOf(id)}"`;
  const habitsToday = areaOn('habits') ? S.habits.filter((hb) => (hb.status || 'active') === 'active' && hb.days.includes(pk(today()).getDay())) : [];
  const habitsLeft = habitsToday.filter((hb) => !habitCompletedFor(hb, today())
    && !habitIsSkipped(hb, today(), today())).length;
  const habitNote = habitsToday.length ? (habitsLeft ? ` Faltam ${habitsLeft} ${plural(habitsLeft, 'hábito', 'hábitos')}.` : ' Hábitos de hoje em dia.') : '';
  const lead = (!tt.length ? 'Seu dia está livre por enquanto. Que tal planejar algo?' : pend.length ? `Você tem ${pend.length} ${plural(pend.length, 'tarefa pendente', 'tarefas pendentes')} para hoje.` : 'Tudo concluído por hoje. Aproveite o resto do dia.') + habitNote;
  return h`
    <header class="home-head" aria-labelledby="hi"><div><p class="date">${cap(longDate(today()))}</p><h1 id="hi">${greet()}${name ? h`, <span class="proper-name">${name}</span>` : ''}<i>.</i></h1><p class="lead">${lead}</p><button type="button" class="home-action" data-action="home-quick-focus">${icon('plus', 18)}Adicionar tarefa para hoje${icon('chevRight', 16)}</button></div>${tt.length ? ring(doneN, tt.length) : ''}</header>
    ${areaGuideButton('inicio')}
    ${sampleBanner()}
    ${backupReminder()}
    ${sundayReview ? h`<section class="card home-next-action home-weekly-review" aria-labelledby="home-weekly-review-title"><div class="home-next-mark">${icon('chart', 19)}</div><div class="grow"><span class="section-kicker">Domingo · revisão da semana</span><h2 id="home-weekly-review-title">Um minuto para reconhecer seu progresso</h2><p>Veja hábitos, tarefas concluídas e gastos antes de começar uma nova semana.</p></div><button type="button" class="btn primary" data-action="home-weekly-review">Fazer revisão</button></section>` : ''}
    <div class="home-dashboard${optionalAreas ? '' : ' no-optional-areas'}">
      <div class="home-primary">
        ${homeNextAction()}
        ${showHomeBlock('summary') ? h`<section class="strip" aria-label="Resumo do dia" ${raw(homeBlockStyle('summary'))}>
          <a href="#planejar"><b>${todayCount}</b><span>Tarefas hoje</span></a>
          <a href="#planejar" data-action="filter-overdue"><b>${overdue.length}</b><span>Atrasadas</span></a>
          <a href="#planejar" data-action="filter-inbox"><b>${inbox.length}</b><span>Tarefas sem data</span></a>
        </section>` : ''}
        ${showHomeBlock('quick') ? h`<section class="card home-quick-card" aria-labelledby="home-quick-title" ${raw(homeBlockStyle('quick'))}>
          <div class="home-quick-copy"><span class="home-quick-mark" aria-hidden="true">${icon('plus', 18)}</span><div><h2 id="home-quick-title">Qual é o próximo passo<i>?</i></h2><p>Registre uma tarefa para hoje sem sair da sua rotina.</p></div></div>
          <form class="home-quick-form" data-form="home-quick-task"><label class="sr" for="home-quick-title-input">Nova tarefa para hoje</label><input id="home-quick-title-input" name="title" type="text" maxlength="120" autocomplete="off" placeholder="Ex.: revisar a apresentação" required><button class="btn primary" type="submit">${icon('plus', 16)}Adicionar</button></form>
        </section>` : ''}
        ${showHomeBlock('habits') ? h`<div ${raw(homeBlockStyle('habits'))}>${homeHabitCheckins()}</div>` : ''}
        ${showHomeBlock('today') ? h`<section class="card home-today-card" aria-labelledby="th" ${raw(homeBlockStyle('today'))}><div class="head"><div><p class="section-kicker">Seu plano</p><h2 id="th">Hoje<i>.</i></h2></div><div class="row"><a class="btn ghost sm" href="#planejar">Ver planejamento</a></div></div>
          ${tt.length ? h`<div class="home-task-groups">
            ${overdue.length ? h`<section class="home-task-group is-overdue" aria-label="Tarefas atrasadas"><h3>${icon('alert', 15)}Atrasadas <span>${overdue.length}</span></h3><ul class="list">${overdue.map(taskRow)}</ul></section>` : ''}
            ${dueToday.length ? h`<section class="home-task-group" aria-label="Tarefas para hoje"><h3>${icon('calendarCheck', 15)}Para hoje <span>${dueToday.length}</span></h3><ul class="list">${dueToday.map(taskRow)}</ul></section>` : ''}
            ${completed.length ? h`<details class="home-completed"><summary>${icon('check', 15)}Concluídas hoje <span>${completed.length}</span></summary><ul class="list">${completed.map(taskRow)}</ul></details>` : ''}
          </div>` : empty('Seu dia está aberto', 'Inclua a primeira prioridade acima ou monte um plano por etapas.', h`<a class="btn" href="#planejar">Montar plano por etapas</a>`, 'calendarCheck')}
        </section>` : ''}
      </div>
      ${optionalAreas ? h`<section class="home-areas" aria-labelledby="ar">${optionalAreas}</section>` : ''}
    </div>
    ${activeAreaItems.length >= 2 ? h`<section class="home-tools" aria-labelledby="home-tools-title">
      <div class="head"><h2 id="home-tools-title">O que você pode fazer<i>.</i></h2></div>
      <div class="home-tool-grid">
        <a class="home-tool" href="#planejar"><span class="home-tool-icon">${icon('calendarCheck', 20)}</span><span><b>Planejar</b><small>Tarefas, prazos, calendário e planos por etapas.</small></span>${icon('chevRight', 18, 'home-tool-go')}</a>
        ${activeAreaItems.map(({ id, area, label, icon: iconName }) => h`<a class="home-tool" href="#${id}"><span class="home-tool-icon">${icon(iconName, 20)}</span><span><b>${AREAS[area]?.[0] || label}</b><small>${AREAS[area]?.[1] || label}</small></span>${icon('chevRight', 18, 'home-tool-go')}</a>`)}
      </div>
    </section>` : ''}`;
}

const FILTERS = [['todas', 'Todas'], ['pendentes', 'Pendentes'], ['atrasadas', 'Atrasadas'], ['caixa', 'Sem data'], ['concluidas', 'Concluídas']];
function filteredTasks() {
  const { f, q, sort } = ui.filters, tdy = today(), nq = norm(q.trim());
  let r = S.tasks.filter((t) => {
    if (f === 'pendentes' && t.done) return false;
    if (f === 'concluidas' && !t.done) return false;
    if (f === 'atrasadas' && (t.done || !t.dueDate || t.dueDate >= tdy)) return false;
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
    return empty(
      hasTasks ? 'Nenhuma tarefa nesse filtro' : 'Ainda não há tarefas',
      hasTasks ? 'Troque o filtro ou limpe a busca.' : 'Crie sua primeira tarefa ou monte um plano por etapas.',
      hasTasks ? '' : h`<button type="button" class="btn" data-action="task-new">${icon('plus', 16)}Criar tarefa</button>`,
      hasTasks ? 'search' : 'calendarCheck',
    );
  }
  if (!(sort === 'prazo' && (f === 'todas' || f === 'pendentes' || f.startsWith('etq:')))) return h`<ul class="list">${r.map(taskRow)}</ul>`;
  const G = [['Atrasadas', 'bad', (t) => !t.done && t.dueDate && t.dueDate < tdy], ['Hoje', '', (t) => !t.done && t.dueDate === tdy], ['Próximas', '', (t) => !t.done && t.dueDate && t.dueDate > tdy], ['Sem data', '', (t) => !t.done && !t.dueDate], ['Concluídas', '', (t) => t.done]];
  return raw('<div style="display:flex;flex-direction:column;gap:16px">' + G.map(([l, c, fn]) => { const it = r.filter(fn); return it.length ? h`<section class="grp"><h3 class="gh ${c}">${l}<span class="n">${it.length}</span></h3><ul class="list">${it.map(taskRow)}</ul></section>`.s : ''; }).join('') + '</div>');
}
function plansHtml() {
  const g = {};
  S.tasks.forEach((t) => { if (t.groupId) (g[t.groupId] ||= { title: t.groupTitle, items: [] }).items.push(t); });
  const plans = Object.entries(g); if (!plans.length) return '';
  return h`<section class="card"><h2>Planos<i>.</i></h2><ul class="list">${plans.map(([id, p]) => { const d = p.items.filter((t) => t.done).length, pc = Math.round(d / p.items.length * 100); return h`<li><div class="grow"><div class="ttl">${p.title}</div><div class="bar" role="progressbar" aria-valuenow="${pc}" aria-valuemin="0" aria-valuemax="100" aria-label="Progresso de ${p.title}" style="margin:6px 0 2px"><span style="width:${pc}%"></span></div><span class="small muted">${d} de ${p.items.length} concluídas</span></div><button class="ibtn" data-action="del-plan" data-id="${id}" aria-label="Excluir plano ${p.title}">${icon('trash', 18)}</button></li>`; })}</ul></section>`;
}
function taskCalendar() {
  const ym = ui.taskCal, [y, m] = ym.split('-').map(Number), ws = weekStartDay(), first = new Date(y, m - 1, 1), n = new Date(y, m, 0).getDate(), tdy = today();
  const wd = Array.from({ length: 7 }, (_, i) => DIAS[(ws + i) % 7]);
  const by = {}; S.tasks.forEach((t) => { if (t.dueDate && t.dueDate.startsWith(ym) && !(t.done && ui.filters.f === 'pendentes')) (by[t.dueDate] = by[t.dueDate] || []).push(t); });
  const cells = []; for (let i = 0; i < (first.getDay() + 7 - ws) % 7; i++) cells.push('<span></span>');
  for (let d = 1; d <= n; d++) {
    const k = `${ym}-${pad(d)}`, ts = by[k] || [], pend = ts.filter((t) => !t.done);
    cells.push(`<button type="button" class="tc ${k === tdy ? 't' : ''} ${k === ui.taskDay ? 's' : ''} ${pend.some((t) => k < tdy) ? 'od' : ''}" data-action="tcal-day" data-d="${k}" aria-label="${d} de ${MESES_L[m - 1]}, ${pend.length} ${pend.length === 1 ? 'tarefa pendente' : 'tarefas pendentes'}"><b>${d}</b><i>${pend.length ? '<u class="has-tasks"></u>'.repeat(Math.min(pend.length, 3)) : ts.length ? '<u class="dn"></u>' : ''}</i></button>`);
  }
  const day = S.tasks.filter((t) => t.dueDate === ui.taskDay).sort((a, b) => a.done - b.done || (a.time || '99:99').localeCompare(b.time || '99:99'));
  return h`<div class="tcal-wrap"><div class="mnav"><button class="ibtn" data-action="tcal-month" data-n="-1" aria-label="Mês anterior">${icon('chevLeft', 20)}</button><b>${cap(ymLabel(ym))}</b><button class="ibtn" data-action="tcal-month" data-n="1" aria-label="Próximo mês">${icon('chevRight', 20)}</button></div>
    <div class="tcal" role="group" aria-label="Calendário de tarefas">${wd.map((w) => h`<em>${w}</em>`)}${raw(cells.join(''))}</div></div>
    <section class="card"><div class="head"><h3>${ui.taskDay === tdy ? 'Hoje' : cap(longDate(ui.taskDay))}</h3><span class="small muted">${day.filter((t) => !t.done).length} pendente(s)</span></div>
      ${day.length ? h`<ul class="list">${day.map(taskRow)}</ul>` : h`<p class="small muted">Nada marcado para este dia.</p>`}
      <button type="button" class="btn sm" data-action="task-new" data-due="${ui.taskDay}">${icon('plus', 16)}Adicionar tarefa neste dia</button></section>`;
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
      ${tasks.length ? h`<ul class="list">${tasks.map(taskRow)}</ul>` : h`<p class="small muted">Nada marcado.</p>`}
      <button type="button" class="btn ghost sm" data-action="week-add" data-d="${day}">${icon('plus', 15)}Adicionar tarefa</button>
    </section>`)}</div>
  </div>`;
}
function viewPlanejar() {
  const f = ui.filters;
  const todayKey = today();
  const nextWeek = addDays(todayKey, 7);
  const pendingTasks = S.tasks.filter((task) => !task.done);
  const todayPending = pendingTasks.filter((task) => task.dueDate === todayKey).length;
  const overdueCount = pendingTasks.filter((task) => task.dueDate && task.dueDate < todayKey).length;
  const upcomingCount = pendingTasks.filter((task) => task.dueDate > todayKey && task.dueDate <= nextWeek).length;
  const todaySummary = todayPending
    ? `${todayPending} ${plural(todayPending, 'tarefa marcada', 'tarefas marcadas')} para hoje`
    : 'Nenhuma tarefa com prazo para hoje';
  const overdueSummary = overdueCount
    ? `${overdueCount} ${plural(overdueCount, 'tarefa atrasada', 'tarefas atrasadas')}`
    : 'Nenhuma tarefa atrasada';
  return h`${pageTitle('Planejar')}${areaGuideButton('planejar')}
    <section class="card qa-card planning-overview" aria-labelledby="planning-overview-title">
      <div class="planning-overview-copy">
        <span class="section-kicker">Resumo de tarefas</span>
        <h2 id="planning-overview-title">Tarefas por prazo<i>.</i></h2>
        <p>${todaySummary}. ${overdueSummary}.</p>
        <div class="planning-overview-actions"><button type="button" class="btn primary" data-action="task-new">${icon('plus', 16)}Nova tarefa</button><button type="button" class="btn" data-action="plan-open">${icon('calendar', 16)}Plano por etapas</button></div>
      </div>
      <dl class="planning-overview-stats" aria-label="Resumo das tarefas pendentes">
        <div><dt>Para hoje</dt><dd>${todayPending}</dd></div>
        <div><dt>Atrasadas</dt><dd>${overdueCount}</dd></div>
        <div><dt>Próximos 7 dias</dt><dd>${upcomingCount}</dd></div>
      </dl>
    </section>
    <section class="planning-shortcuts" aria-label="Atalhos de planejamento"><span>Atenção ao seu plano</span><button type="button" data-action="plan-view" data-v="semana">${icon('calendarCheck', 16)}Organizar a semana</button><button type="button" data-action="plan-view" data-v="revisao">${icon('chart', 16)}Fazer revisão semanal</button><a href="#pomodoro">${icon('clock', 16)}Usar Pomodoro</a></section>
    <section class="card plain" aria-labelledby="mt"><h2 id="mt" class="sr">Minhas tarefas</h2>
      <div class="seg" role="group" aria-label="Modo de visualização"><button type="button" aria-pressed="${ui.planView === 'lista'}" data-action="plan-view" data-v="lista">${icon('list', 16)}Lista</button><button type="button" aria-pressed="${ui.planView === 'calendario'}" data-action="plan-view" data-v="calendario">${icon('calendar', 16)}Calendário</button><button type="button" aria-pressed="${ui.planView === 'semana'}" data-action="plan-view" data-v="semana">${icon('calendarCheck', 16)}Semana</button><button type="button" aria-pressed="${ui.planView === 'revisao'}" data-action="plan-view" data-v="revisao">${icon('chart', 16)}Revisão</button></div>
      ${ui.planView === 'calendario' ? taskCalendar() : ui.planView === 'semana' ? taskWeek() : ui.planView === 'revisao' ? weeklyReviewView() : h`<div class="scroll-x" role="group" aria-label="Filtrar tarefas">${FILTERS.map(([k, l]) => h`<button class="chip" aria-pressed="${f.f === k}" data-action="set-filter" data-f="${k}">${l}</button>`)}${allTags().map((g) => h`<button class="chip" aria-pressed="${f.f === 'etq:' + g}" data-action="set-filter" data-f="${'etq:' + g}">#${g}</button>`)}</div>
      <div class="row"><label class="search"><span class="sr">Buscar tarefas</span>${icon('search', 18)}<input type="search" id="q" data-keep value="${f.q}" placeholder="Buscar tarefas" data-input="search"></label>
        <label style="flex:0 0 132px"><span class="sr">Ordenar</span><select id="sortsel" data-change="sort">${[['prazo', 'Por prazo'], ['prioridade', 'Prioridade'], ['recentes', 'Recentes'], ['manual', 'Manual']].map(([k, l]) => h`<option value="${k}" ${f.sort === k ? raw('selected') : ''}>${l}</option>`)}</select></label></div>
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
    <summary>Histórico mensal · ${cap(ymLabel(ui.habitMonth))}</summary>
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
    <summary>Ano em calendário</summary>
    <p class="small muted">${done} de ${planned} ${plural(planned, 'dia programado concluído', 'dias programados concluídos')} nos últimos 12 meses.</p>
    <div class="habit-year-grid" role="img" aria-label="Calendário de 12 meses de ${habit.name}: ${done} de ${planned} dias programados concluídos">${cells.map((cell) => h`<span class="habit-year-cell${cell.completed ? ' is-done' : cell.skipped ? ' is-skipped' : cell.scheduled ? ' is-missed' : ''}" title="${longDate(cell.day)}${cell.skipped ? ' · pulado' : ''}"></span>`)}</div>
    <p class="habit-year-legend small muted"><span class="habit-year-cell"></span>não programado <span class="habit-year-cell is-missed"></span>não feito <span class="habit-year-cell is-skipped"></span>pulado <span class="habit-year-cell is-done"></span>feito</p>
  </details>`;
}
function remainingHabitSuggestions() {
  const names = new Set(S.habits.map((habit) => norm(habit.name)));
  const hasWaterHabit = S.habits.some(isWaterHabit);
  return SUGGESTED_HABITS.filter((suggestion) => (
    !names.has(norm(suggestion.name))
    && !(suggestion.id === 'water' && hasWaterHabit)
  ));
}
const HABIT_COLOR_NAMES = ['Rosa', 'Coral', 'Âmbar', 'Verde-claro', 'Verde', 'Azul-claro', 'Azul', 'Lilás', 'Roxo', 'Vermelho', 'Cinza', 'Marrom'];
function habitStreakLabel(stats) {
  const weekly = stats.weeklyStreak !== null && stats.weeklyStreak !== undefined;
  const n = weekly ? stats.weeklyStreak : stats.streak;
  if (!n) return 'Comece hoje';
  return `${n} ${weekly ? plural(n, 'semana seguida', 'semanas seguidas') : plural(n, 'dia seguido', 'dias seguidos')}`;
}
function habitWaterTracker(habit) {
  if (!isWaterHabit(habit)) return '';
  const total = waterMlForDay(S.water, today());
  const target = waterGoalFromName(habit.name, S.settings.prefs.waterGoalMl);
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
  const stats = habitStats(habit, today(), weekStartDay(), (day) => habitCompletedFor(habit, day));
  const color = habitColor(habit);
  const open = ui.openDetails[`hab-${habit.id}`] ? raw('open') : '';
  const target = stats.weeklyTarget ?? stats.scheduledThisWeek;
  const waterTotal = isWaterHabit(habit) ? waterMlForDay(S.water, today()) : 0;
  const waterTarget = isWaterHabit(habit) ? waterGoalFromName(habit.name, S.settings.prefs.waterGoalMl) : 0;
  const sub = status === 'paused' ? 'Pausado' : skipped ? 'Dia pulado' : isWaterHabit(habit)
    ? `${waterTotal.toLocaleString('pt-BR')} de ${waterTarget.toLocaleString('pt-BR')} mL hoje`
    : !dayOn ? habitDaysLabel(habit) : habitStreakLabel(stats);
  const orderList = S.habits.filter((item) => item.status !== 'archived');
  const orderIndex = orderList.indexOf(habit);
  const circleLabel = `${skipped ? 'Dia pulado' : done ? 'Desmarcar' : 'Marcar como feito'}: ${habit.name}`;
  return h`<li class="habit-row${done ? ' is-done' : ''}${canCheck ? '' : ' is-off'}" data-habit-id="${habit.id}" style="--hc:${color}">
    <button type="button" class="habit-circle" data-action="habit-check" data-id="${habit.id}" aria-pressed="${done}" aria-label="${circleLabel}" ${canCheck ? '' : raw('disabled')}>
      <span class="habit-circle-icon">${icon(habitIconKey(habit), 22)}</span><span class="habit-circle-check">${icon('check', 22)}</span>
    </button>
    <details class="habit-more" id="d-hab-${habit.id}" ${open}>
      <summary><span class="habit-main"><span class="habit-title">${habit.name}${status === 'paused' ? h` <span class="badge">Pausado</span>` : ''}</span><span class="habit-sub">${canCheck && stats.goalMet ? h`${icon('sparkles', 13)}Meta da semana cumprida · ` : ''}${sub}</span></span>${icon('chevDown', 18, 'chev')}</summary>
      <div class="habit-more-body">
        ${habitWaterTracker(habit)}
        <div class="habit-week" role="group" aria-label="Esta semana: ${stats.completedThisWeek} de ${target} dias. Toque num dia que passou para marcar ou desmarcar.">${stats.week.map((w) => {
          const stateLabel = `${longDate(w.day)}: ${w.skipped ? 'dia pulado' : w.completed ? 'concluído' : w.scheduled ? (w.day > today() ? 'programado' : 'não concluído') : 'não programado'}`;
          const editable = saved && status === 'active' && w.scheduled && w.day <= today();
          return h`<button type="button" class="habit-dot${w.completed ? ' is-done' : ''}${w.skipped ? ' is-skipped' : ''}${!w.scheduled ? ' is-off' : ''}${w.day === today() ? ' is-today' : ''}" data-action="habit-day" data-id="${habit.id}" data-d="${w.day}" aria-pressed="${w.completed}" aria-label="${stateLabel}" ${editable ? '' : raw('disabled')}><i aria-hidden="true">${DIAS[pk(w.day).getDay()].slice(0, 1)}</i></button>`;
        })}</div>
        <p class="small muted">${habitDaysLabel(habit)}${habit.remind ? ` · lembrete ${habit.remind}` : ''}<br>${stats.completedThisWeek} de ${target} nesta semana</p>
        ${habitMonthlyHistory(habit)}${saved ? habitYearHeat(habit) : ''}
        ${saved ? h`<div class="row habit-actions">${status !== 'archived' ? h`<button type="button" class="ibtn" data-action="habit-move" data-dir="-1" data-id="${habit.id}" aria-label="Mover ${habit.name} para cima" ${orderIndex <= 0 ? raw('disabled') : ''}>${icon('arrowUp', 18)}</button><button type="button" class="ibtn" data-action="habit-move" data-dir="1" data-id="${habit.id}" aria-label="Mover ${habit.name} para baixo" ${orderIndex < 0 || orderIndex >= orderList.length - 1 ? raw('disabled') : ''}>${icon('arrowDown', 18)}</button>` : ''}${status === 'active' && dayOn && !done ? h`<button type="button" class="btn sm ghost" data-action="habit-skip" data-id="${habit.id}" aria-pressed="${skipped}">${skipped ? 'Desfazer pulo' : 'Pular hoje'}</button>` : ''}<button type="button" class="btn sm" data-action="habit-edit-open" data-id="${habit.id}">${icon('pencil', 15)}Editar</button><button type="button" class="btn sm" data-action="habit-toggle-pause" data-id="${habit.id}">${icon(status === 'active' ? 'pause' : 'play', 15)}${status === 'active' ? 'Pausar' : 'Retomar'}</button><button type="button" class="btn sm ghost" data-action="habit-archive" data-id="${habit.id}">${icon('archive', 15)}Arquivar</button></div>` : ''}
      </div>
    </details>
  </li>`;
}
function viewHabits() {
  if (!areaOn('habits')) return h`${pageTitle('Hábitos')}${areaGuideButton('habitos')}${gate('habits', 'Hábitos')}`;
  if (!habitsTemplate) {
    if (!habitsTemplatePromise && !habitsTemplateError) requestHabitsTemplate();
    return habitsTemplateError
      ? h`${pageTitle('Hábitos')}${areaGuideButton('habitos')}<section class="card" role="alert"><p>Não foi possível carregar a área de Hábitos.</p><button class="btn" data-action="retry-habits-template">Tentar novamente</button></section>`
      : h`${pageTitle('Hábitos')}${areaGuideButton('habitos')}<section class="card" role="status">Carregando Hábitos…</section>`;
  }
  const suggestions = remainingHabitSuggestions();
  const live = S.habits.filter((habit) => (habit.status || 'active') !== 'archived');
  const archived = S.habits.filter((habit) => habit.status === 'archived');
  const dow = pk(today()).getDay();
  const todays = live.filter((habit) => (habit.status || 'active') === 'active' && habit.days.includes(dow));
  const others = live.filter((habit) => !todays.includes(habit));
  const skippedN = todays.filter((habit) => habitIsSkipped(habit, today(), today())).length;
  const eligibleToday = todays.length - skippedN;
  const doneN = todays.filter((habit) => !habitIsSkipped(habit, today(), today()) && habitCompletedFor(habit, today())).length;
  const pct = eligibleToday ? Math.round(doneN / eligibleToday * 100) : 0;
  const todaySummary = eligibleToday
    ? `${doneN} de ${eligibleToday} ${plural(eligibleToday, 'hábito', 'hábitos')} ${doneN === eligibleToday ? '— tudo feito!' : 'feitos'}${skippedN ? ` · ${skippedN} ${plural(skippedN, 'dia pulado', 'dias pulados')}` : ''}`
    : skippedN ? `${skippedN} ${plural(skippedN, 'dia pulado hoje', 'dias pulados hoje')}` : 'Nenhum hábito programado para hoje.';
  const ideasOpen = ui.openDetails.ideas ?? S.habits.length === 0 ? raw('open') : '';
  const slots = {
    'page-title': h`${pageTitle('Hábitos')}`.s,
    'area-guide-button': areaGuideButton('habitos').s,
    'today-summary': h`${todaySummary}`.s,
    'add-icon': icon('plus', 16).s,
    'today-progress': eligibleToday
      ? h`<div class="habit-today-bar" role="progressbar" aria-label="Hábitos concluídos hoje, sem contar dias pulados" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pct}%"></span></div>`.s
      : '',
    'todays-habits': todays.length
      ? h`<ul class="habit-list" aria-label="Hábitos de hoje">${todays.map((habit) => habitRow(habit))}</ul>`.s
      : empty('Dia livre', 'Crie um hábito ou escolha uma ideia abaixo.', h`<button type="button" class="btn" data-action="habit-new">${icon('plus', 16)}Novo hábito</button>`, 'check').s,
    'reminder-note': live.some((habit) => habit.remind)
      ? h`<p class="fine habit-reminder-note">Lembretes aparecem enquanto o Aurora está aberto.</p>`.s
      : '',
    'other-habits': others.length
      ? h`<details class="card habit-others" id="d-others" ${ui.openDetails.others ? raw('open') : ''}><summary><b>Fora de hoje</b><span class="habit-count">${others.length}</span>${icon('chevDown', 18, 'chev')}</summary><ul class="habit-list">${others.map((habit) => habitRow(habit))}</ul></details>`.s
      : '',
    'habit-ideas': suggestions.length
      ? h`<details class="card habit-ideas" id="d-ideas" ${ideasOpen}>
        <summary><span><b>Ideias de hábitos</b><small>Toque para criar com ícone e cor já escolhidos.</small></span><span class="habit-count">${suggestions.length}</span>${icon('chevDown', 18, 'chev')}</summary>
        <div class="habit-idea-grid">${suggestions.map((idea) => h`<button type="button" class="habit-idea" data-action="habit-idea" data-id="${idea.id}" style="--hc:${habitColor(idea)}"><span class="habit-idea-icon">${icon(habitIconKey(idea), 22)}</span><b>${idea.name}</b></button>`)}</div>
      </details>`.s
      : '',
    'archived-habits': archived.length
      ? h`<details class="card habit-archived" id="d-archived" ${ui.openDetails.archived ? raw('open') : ''}><summary><b>Arquivados</b><span class="habit-count">${archived.length}</span>${icon('chevDown', 18, 'chev')}</summary><ul class="habit-list">${archived.map((habit) => h`<li class="habit-row is-off" style="--hc:${habitColor(habit)}"><span class="habit-circle is-static">${icon(habitIconKey(habit), 22)}</span><div class="habit-main"><span class="habit-title">${habit.name}</span><span class="habit-sub">${habitDaysLabel(habit)}</span></div><button type="button" class="btn sm" data-action="habit-restore" data-id="${habit.id}">Restaurar</button><button type="button" class="ibtn" data-action="habit-edit-open" data-id="${habit.id}" aria-label="Editar hábito arquivado ${habit.name}">${icon('pencil', 18)}</button></li>`)}</ul></details>`.s
      : '',
  };
  return raw(renderHabitsTemplate(habitsTemplate, slots));
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
function viewPomodoro() {
  const g = gate('pomodoro', 'Pomodoro');
  if (g) return h`${areaNav('pomodoro')}${pageTitle('Pomodoro')}${areaGuideButton('pomodoro')}${g}`;
  const timer = S.pomodoro, preferences = settingsView().prefs.pomodoro;
  const pom = effectivePomodoroSettings(preferences);
  const running = timer.startedAt !== null;
  const elapsed = phaseElapsedSeconds(timer);
  const focusTask = S.tasks.find((task) => task.id === timer.focusTaskId);
  const focusedSeconds = timer.elapsedSeconds + (timer.phase === 'focus' ? elapsed : 0);
  const duration = phaseDurationSeconds(pom, timer.phase);
  const remaining = Math.max(0, duration - elapsed);
  const hasProgress = timer.elapsedSeconds > 0 || timer.completedPomodoros > 0 || elapsed > 0;
  const circumference = 2 * Math.PI * 50;
  const presetDisabled = running || hasProgress;
  const pushStatus = getPomodoroPushStatus();
  const pushButtonDisabled = ui.pushBusy || (!pushStatus.enabled && (!pushStatus.configured || !pushStatus.supported || pushStatus.permission === 'denied'));
  return h`${areaNav('pomodoro')}${pageTitle('Pomodoro')}${areaGuideButton('pomodoro')}
    <section class="card focus-timer free-pomodoro" data-phase="${timer.phase}" aria-labelledby="standalone-pomodoro-title">
      <header class="focus-timer-head"><div><span class="focus-eyebrow">${standalonePomodoroPhaseName(timer.phase)}</span><h2 id="standalone-pomodoro-title">Foque em uma coisa por vez<i>.</i></h2><p class="free-pomodoro-subtitle">${focusTask ? h`Tarefa vinculada: <b class="user-value">${focusTask.title}</b> · ${dur(focusedSeconds)} focados` : timer.focusLabel ? h`Foco em: <b class="user-value">${timer.focusLabel}</b>` : 'Defina um foco opcional e comece seu primeiro bloco.'}</p></div></header>
      <div class="focus-timer-body">
        <div class="focus-dial" aria-hidden="true"><svg viewBox="0 0 112 112"><circle class="focus-dial-track" cx="56" cy="56" r="50"/><circle class="focus-dial-progress" id="standalone-pomo-progress" cx="56" cy="56" r="50" style="stroke-dasharray:314.2;stroke-dashoffset:${(circumference * (1 - Math.min(1, elapsed / duration))).toFixed(1)}"/></svg><div class="focus-clock"><div class="timer" id="standalone-pomo-clock" role="timer" aria-live="off">${clock(remaining)}</div><span class="small muted" id="standalone-pomo-state">${standalonePomodoroPhaseLabel(timer.phase, running, hasProgress)}</span></div></div>
        <div class="focus-timer-actions">
          <label class="f free-pomodoro-label">Em que você vai focar? <span class="muted small">${timer.focusTaskId ? '(tarefa vinculada)' : '(opcional)'}</span><input type="text" id="pomo-focus-label" data-change="pomo-label" maxlength="40" autocomplete="off" placeholder="Ex.: estudar inglês" value="${timer.focusLabel || ''}" ${timer.focusTaskId ? raw('disabled') : ''}></label>
          <div class="focus-controls">
            <button type="button" class="btn primary" data-action="toggle-free-timer" aria-keyshortcuts="Space" title="Atalho: barra de espaço">${icon(running ? 'pause' : 'play', 18)}${running ? 'Pausar' : hasProgress ? 'Retomar' : 'Começar foco'}</button>
            ${timer.phase !== 'focus' ? h`<button type="button" class="btn" data-action="skip-free-break">Pular pausa</button>` : ''}
          </div>
          ${hasProgress || running ? h`<details class="pomodoro-end-actions" id="d-pomodoro-end-actions" ${ui.openDetails['pomodoro-end-actions'] ? raw('open') : ''}><summary>Encerrar antes do tempo</summary><div><button type="button" class="btn" data-action="finish-free-timer">${icon('check', 18)}Encerrar sessão</button><button type="button" class="btn ghost" data-action="discard-free-timer">Descartar sessão</button></div></details>` : ''}
          <p class="focus-prompt" id="standalone-pomo-copy">${timerPhaseMessage(timer.phase, pom)}</p>
          <details class="free-pomodoro-settings" id="d-pomodoro-settings" ${ui.openDetails['pomodoro-settings'] ? raw('open') : ''}>
            <summary class="free-pomodoro-settings-summary"><span><b>Tempos e som</b><small>Ajuste o ritmo do seu Pomodoro</small></span><b>${pom.focusMin} min de foco · ${pom.breakMin} min de pausa</b></summary>
            <form class="free-pomodoro-settings-form" data-form="settings-save" novalidate>
            <div class="free-pomodoro-settings-head"><div><span>Configuração</span><h3>Bloco de tempo</h3></div><b>${pom.focusMin} / ${pom.breakMin} min</b></div>
            <div class="free-pomodoro-presets" role="group" aria-label="Bloco de tempo">
              <button type="button" class="chip" data-action="set-free-pomodoro-preset" data-preset="classic" aria-pressed="${preferences.preset === 'classic' ? 'true' : 'false'}" ${presetDisabled ? raw('disabled') : ''}>Clássico · ${POMODORO_PRESETS.classic.focusMin}/${POMODORO_PRESETS.classic.breakMin} min</button>
              <button type="button" class="chip" data-action="set-free-pomodoro-preset" data-preset="custom" aria-pressed="${preferences.preset === 'custom' ? 'true' : 'false'}" ${presetDisabled ? raw('disabled') : ''}>Personalizado · ${preferences.focusMin}/${preferences.breakMin} min</button>
            </div>
            <p class="small muted free-pomodoro-hint">${presetDisabled ? 'Conclua ou descarte o Pomodoro atual para trocar o bloco ou editar os tempos.' : preferences.preset === 'custom' ? 'Edite os tempos de foco e pausa.' : 'Selecione Personalizado para definir outros tempos.'}</p>
            ${preferences.preset === 'custom' ? h`<div class="form free-pomodoro-durations">
              <label class="f">Foco (min)<input type="number" inputmode="numeric" data-change="free-pomo-focus" min="5" max="120" step="1" value="${preferences.focusMin}" ${presetDisabled ? raw('disabled') : ''}></label>
              <label class="f">Pausa (min)<input type="number" inputmode="numeric" data-change="free-pomo-break" min="1" max="60" step="1" value="${preferences.breakMin}" ${presetDisabled ? raw('disabled') : ''}></label>
            </div>` : ''}
            <label class="check free-pomodoro-auto"><input type="checkbox" data-change="free-pomo-auto" ${preferences.autoAdvance !== false ? raw('checked') : ''} ${presetDisabled ? raw('disabled') : ''}><span><b>Avançar fases automaticamente</b><small class="muted">Quando uma fase termina, a próxima começa sozinha.</small></span></label>
            <div class="form free-pomodoro-durations">
              <label class="f">Toque do alerta
                <select data-change="free-pomo-sound-tone">
                  ${Object.entries(POMODORO_SOUND_TONES).map(([id, sound]) => h`<option value="${id}" ${preferences.soundTone === id ? raw('selected') : ''}>${sound.label}</option>`)}
                </select>
              </label>
              <label class="f pomodoro-sound-volume">
                <span>Volume do alerta <output data-pomodoro-volume-value>${preferences.soundVolume}%</output></span>
                <input type="range" min="0" max="100" step="5" value="${preferences.soundVolume}" data-change="free-pomo-sound-volume" aria-label="Volume do alerta do Pomodoro">
              </label>
              <button type="button" class="btn" data-action="preview-pomodoro-sound">Ouvir toque</button>
            </div>
            ${settingsSaveButton()}
          </form>
          </details>
        </div>
      </div>
      <details class="pomodoro-push-settings" id="d-pomodoro-push" ${ui.openDetails['pomodoro-push'] ? raw('open') : ''}>
        <summary><span>Avisos quando o app estiver fechado</span><small>${pushStatus.enabled ? 'Ativos' : 'Opcionais'}</small></summary>
        <div class="pomodoro-push-content">
          <div><h3 id="pomodoro-push-title">Avisos fora do app</h3><p>Receba uma notificação do sistema a cada mudança de fase enquanto este Pomodoro estiver rodando.</p></div>
          <button type="button" class="btn" data-action="pomodoro-push-toggle" aria-pressed="${pushStatus.enabled ? 'true' : 'false'}" ${pushButtonDisabled ? raw('disabled') : ''}>${ui.pushBusy ? 'Atualizando…' : pushStatus.enabled ? 'Desativar avisos' : 'Ativar avisos'}</button>
          <p class="pomodoro-push-status" role="status" aria-live="polite">${preserveCopyTerms(ui.pushNotice || pushStatus.message)}</p>
          <details class="pomodoro-push-details"><summary>Quando usar e como funciona</summary><p class="pomodoro-push-privacy">A autorização é opcional. Seus dados e o nome da tarefa ficam neste dispositivo; o serviço recebe somente a inscrição <span class="case-preserve">Push</span> e os horários/fases necessários ao timer.</p>${!pushStatus.enabled ? h`<p class="notice pomo-background-notice" role="note">Sem alertas <span class="case-preserve">Push</span>, o navegador pode suspender o cronômetro quando o Aurora fica em segundo plano ou com a tela bloqueada.</p>` : ''}</details>
        </div>
      </details>
      <p class="err" id="standalone-pomo-error" role="alert"></p>
    </section>
    ${pomodoroHistoryCard(timer)}`;
}
function pomodoroHistoryCard(timer) {
  const days = recentFocusDays(timer.history, today(), 7);
  const total = days.reduce((sum, item) => sum + item.count, 0);
  const max = Math.max(1, ...days.map((item) => item.count));
  return h`<section class="card pomodoro-history" aria-labelledby="pomodoro-history-title">
    <div class="head"><div><h2 id="pomodoro-history-title">Últimos 7 dias<i>.</i></h2><p class="small muted">${total ? `${total} ${plural(total, 'bloco de foco concluído', 'blocos de foco concluídos')} na semana.` : 'Os blocos de foco concluídos aparecem aqui.'}</p></div></div>
    <ol class="pomodoro-history-bars" aria-label="Blocos de foco por dia">${days.map(({ day, count }) => h`<li><span class="pomodoro-history-count">${count || ''}</span><span class="pomodoro-history-bar" role="img" aria-label="${count} ${plural(count, 'bloco', 'blocos')} em ${shortDate(day)}"><i style="height:${count ? Math.max(8, Math.round(count / max * 100)) : 4}%"></i></span><span class="pomodoro-history-day">${DIAS[pk(day).getDay()]}</span></li>`)}</ol>
  </section>`;
}

/* ========== Páginas: Início, Planejar, Hábitos, Finanças, Ciclo, Ajustes ========== */
function areaTiles() {
  const defs = [['pomodoro', 'clock'], ['finances', 'wallet'], ['cycle', 'heart']]
    .filter(([a]) => !areaOn(a));
  if (!defs.length) return '';
  return h`<div class="head"><h2 id="ar">Áreas opcionais<i>.</i></h2><a class="btn ghost sm" href="#config">Gerenciar</a></div><div class="tiles">${defs.map(([a, ic]) => h`<button class="tile off" data-action="enable-area" data-area="${a}"><span class="mk" data-area="${a}">${icon(ic, 22)}</span><h3>${AREAS[a][0]}</h3><span class="v">Ativar</span><span class="s">${AREAS[a][1]}</span></button>`)}</div>`;
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
const hasAnyLog = (l) => !!l && (l.flow || l.energy || l.sleep || l.discharge || l.note || l.sexualActivity || ['pain', 'mood', 'digestion', 'skin'].some((c) => (l[c] || []).length));
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
    log.contraceptionMethods?.length ? 'método contraceptivo registrado' : '',
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
  return Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([key, n]) => { const [c, v] = key.split(':'); return [cycLabel(c, v), n]; });
}
function viewCiclo() {
  const g = gate('cycle', 'Ciclo');   if (g) return h`${areaNav('ciclo')}${pageTitle('Ciclo')}${areaGuideButton('ciclo')}${g}`;
  const st = cycleStats(), tdy = today(), sel = ui.cycDay && ui.cycDay <= tdy ? ui.cycDay : tdy, log = dayLog(sel);
  const ym = ui.calMonth, [y, m] = ym.split('-').map(Number), first = new Date(y, m - 1, 1), nDays = new Date(y, m, 0).getDate();
  const strip = Array.from({ length: 14 }, (_, i) => addDays(tdy, i - 13));
  const dn = cycleDayNumber(sel, st);
  const hasCycleHistory = st.starts.length > 0;
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
  return h`${areaNav('ciclo')}${pageTitle('Ciclo')}${areaGuideButton('ciclo')}
    <section class="cycle-overview" aria-labelledby="cycle-overview-title"><header class="cycle-overview-head"><div><span>${hasCycleHistory ? 'Seu ciclo' : 'Primeiros passos'}</span><h2 id="cycle-overview-title">${cycleMoment[0]}<i>.</i></h2><p>${cycleMoment[1]}</p></div><div class="cycle-overview-actions"><button type="button" class="btn primary" data-action="cyc-start-today">${icon('plus', 16)}Começou hoje</button><button type="button" class="btn" data-action="cyc-period-open">${icon('calendar', 16)}Registrar período</button><button type="button" class="btn" data-action="cyc-period-past">${icon('calendar', 16)}Período anterior</button></div></header>${hasCycleHistory ? h`<div class="stats cycle-overview-stats">${dn ? h`<div class="cycle-day-ring ${st.avg ? '' : 'is-unestimated'}" ${st.avg ? `style="--cycle-progress:${cycleProgress}%"` : ''}><span><b>${dn}</b><small>Dia do ciclo</small></span></div>` : ''}${st.avg ? h`<div class="stat"><b>${st.avg} dias</b><span>Duração média · ${st.observedIntervals} ${plural(st.observedIntervals, 'intervalo observado', 'intervalos observados')}</span></div><div class="stat"><b>${shortDate(st.next)}</b><span>Próximo início estimado</span></div>` : h`<p class="cycle-next-step">Registre o próximo início da menstruação para calcular a duração média e mostrar estimativas.</p>`}</div>` : ''}</section>
    <section class="card cycle-day-entry" aria-labelledby="cd"><div class="head"><div><h2 id="cd">${sel === tdy ? 'Hoje' : cap(longDate(sel))}<i>.</i></h2><p class="cycle-day-summary">${hasAnyLog(log) ? cycleLogSummary(log) : st.set.has(sel) ? 'Este dia faz parte de um período registrado. Se quiser, anote sintomas ou fluxo.' : hasCycleHistory ? 'Sem registro neste dia. Se quiser, anote sintomas ou fluxo.' : 'Ainda não há registro neste dia. Escolha uma data e registre o fluxo para começar.'}</p></div>${hasAnyLog(log) ? h`<button type="button" class="btn ghost sm" data-action="cyc-clear">Limpar o dia</button>` : ''}</div>
      ${selectedPeriod ? h`<div class="cycle-period-tools" aria-label="Período menstrual selecionado"><p><b>Período registrado:</b> ${longDate(selectedPeriod.start)}${cyclePeriodEnd(selectedPeriod) === selectedPeriod.start ? '' : ` a ${longDate(cyclePeriodEnd(selectedPeriod))}`}</p><div><button type="button" class="btn sm" data-action="cyc-period-edit" data-index="${selectedPeriodIndex}">Editar período</button><button type="button" class="btn danger sm" data-action="cyc-period-delete" data-index="${selectedPeriodIndex}">Excluir período</button></div></div>` : ''}
      <div class="cycle-day-tools"><button type="button" class="btn sm" data-action="cyc-batch-open">${icon('calendar', 16)}Adicionar sintomas a vários dias</button></div>
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
    ${top.length ? h`<section class="card"><h2>Mais frequentes nos últimos 90 dias<i>.</i></h2><ul class="list">${top.map(([l, n]) => h`<li><span class="grow ttl">${l}</span><span class="badge">${n} ${plural(n, 'dia', 'dias')}</span></li>`)}</ul></section>` : ''}
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
    ${group('appearance-calendar-title', 'Calendário', 'Escolha o dia em que a semana começa nas visualizações do Aurora.', h`<div class="appearance-settings-controls"><div class="appearance-settings-option"><span class="appearance-settings-label">A semana começa na</span>${settingsSegment(s.look, 'weekStart', 'Primeiro dia da semana', [[1, 'Segunda'], [0, 'Domingo']], 'preferences-week-start')}</div></div>`)}
    ${settingsSaveButton()}
  </form>`;
}
function profileSettings(s) {
  s = settingsView();
  const p = ui.profileDraft || {
    name: s.profile.name,
    preferredName: s.profile.preferredName || s.profile.name,
    sex: s.profile.sex || '',
    age: s.profile.age == null ? '' : String(s.profile.age),
  };
  const profileDirty = profileDraftHasChanges(p, s.profile);
  return h`<div class="profile-settings-container">
    <form id="profile-settings-form" class="card profile-settings" aria-labelledby="settings-profile-title" data-form="settings-profile" novalidate>
    <div class="profile-settings-heading"><h2 id="settings-profile-title">Seu perfil<i>.</i></h2><p>Você pode alterar seu nome, como prefere ser chamado(a), sua identidade de gênero e sua idade. A idade é usada somente para estimar a meta ao adicionar o hábito de água.</p></div>
    <div class="profile-greeting-preview" aria-live="polite"><span class="profile-greeting-avatar" aria-hidden="true">${icon('user', 22)}</span><span class="profile-greeting-copy"><span>Prévia na tela inicial</span><b>${greet()}, <span id="profile-preview-name" class="proper-name">${p.preferredName.trim() || p.name.trim() || 'Seu nome'}</span>.</b></span></div>
    <section class="profile-settings-group" aria-labelledby="profile-name-title">
      <div><h3 id="profile-name-title">Informações do perfil</h3><p>Você pode alterar estas informações quando quiser. Não perguntamos sua orientação sexual.</p></div>
      <div class="form profile-settings-fields">
        <label class="f" for="pname">Nome<input type="text" id="pname" data-profile-field="name" value="${p.name}" maxlength="50" autocomplete="name" required></label>
        <label class="f" for="ppreferred">Como prefere ser chamado(a)?<input type="text" id="ppreferred" data-profile-field="preferredName" value="${p.preferredName}" maxlength="50" autocomplete="nickname" required></label>
        <label class="f" for="psex">Identidade de gênero<select id="psex" data-profile-field="sex" required aria-describedby="profile-sex-help"><option value="">Selecione uma opção</option>${Object.entries(SEX).map(([key, label]) => h`<option value="${key}" ${p.sex === key ? raw('selected') : ''}>${label}</option>`)}</select><span class="profile-field-help" id="profile-sex-help">Inclui opções para pessoas cis, trans e não binárias. Você também pode preferir não informar.</span></label>
      </div>
    </section>
    <section class="profile-settings-group" aria-labelledby="profile-estimate-title">
      <div><h3 id="profile-estimate-title">Idade</h3><p>Informe sua idade para usá-la na estimativa ao adicionar o hábito de água. Você pode deixar em branco.</p></div>
      <div class="form profile-settings-fields">
        <label class="f" for="page">Idade (anos)<input type="number" id="page" data-profile-field="age" min="5" max="120" step="1" inputmode="numeric" aria-describedby="profile-age-help" value="${p.age}" placeholder="Opcional"><span class="profile-field-help" id="profile-age-help">Informe um número inteiro entre 5 e 120 anos.</span></label>
      </div>
    </section>
      <div class="row profile-settings-actions"><button class="btn primary" type="submit" ${profileDirty ? '' : raw('disabled')}>Salvar</button></div>
      </form>
    <section class="card settings-section-card account-session-card" aria-labelledby="account-session-title">
      <div class="settings-section-heading"><h2 id="account-session-title">Sessão da conta<i>.</i></h2><p>Sair encerra sua sessão neste dispositivo. Seus dados continuam salvos na sua conta.</p></div>
      <button type="button" class="btn ghost sm" data-account-signout>Sair da conta</button>
    </section>
  </div>`;
}
function profileDraftHasChanges(draft, profile) {
  return draft.name !== (profile.name || '')
    || draft.preferredName !== (profile.preferredName || profile.name || '')
    || draft.sex !== (profile.sex || '')
    || draft.age !== (profile.age == null ? '' : String(profile.age));
}

const LEGACY_SETTINGS_TABS = { appearance: 'personalization', preferences: 'personalization', calendar: 'personalization', areas: 'areas-navigation', navigation: 'areas-navigation' };
const settingsTabId = (id) => LEGACY_SETTINGS_TABS[id] || id;
const SETTINGS_SECTIONS = [
  ['profile', 'Seu perfil', 'user', 'Nome, identidade de gênero e idade'],
  ['personalization', 'Personalização', 'sun', 'Tema, cores, leitura e calendário'],
  ['areas-navigation', 'Áreas e navegação', 'grid', 'Ativar áreas e organizar os menus'],
  ['data', 'Dados e backup', 'archive', 'Importação e cópias de segurança'],
];
function homeLayoutSettings(s) {
  const layout = s.prefs.homeLayout;
  const ordered = layout.order.map((id) => HOME_BLOCKS.find(([blockId]) => blockId === id)).filter(Boolean);
  return h`<section class="home-layout-settings" aria-labelledby="home-layout-title">
    <div class="settings-section-heading"><h3 id="home-layout-title">Tela inicial<i>.</i></h3><p>Escolha os blocos que aparecem na Home e deixe os mais importantes no topo.</p></div>
    <ol class="home-layout-list" aria-label="Blocos da tela inicial">${ordered.map(([id, label, description], index) => h`<li class="home-layout-item">
      <label class="home-layout-toggle"><input type="checkbox" data-change="home-block-visible" data-home-block="${id}" aria-label="${layout.visible.includes(id) ? 'Ocultar' : 'Mostrar'} ${label} na tela inicial" ${layout.visible.includes(id) ? raw('checked') : ''}><span><b>${label}</b><small>${description}</small></span></label>
      <span class="home-layout-controls"><span>${index + 1}º</span><button type="button" class="ibtn" data-action="home-block-move" data-home-block="${id}" data-direction="-1" aria-label="Mover ${label} para cima" ${index === 0 ? raw('disabled') : ''}>${icon('arrowUp', 16)}</button><button type="button" class="ibtn" data-action="home-block-move" data-home-block="${id}" data-direction="1" aria-label="Mover ${label} para baixo" ${index === ordered.length - 1 ? raw('disabled') : ''}>${icon('arrowDown', 16)}</button></span>
    </li>`)}</ol>
  </section>`;
}
function areasNavigationSettings(s) {
  s = settingsView();
  const items = normalizeMenuOrder(s.prefs.menuOrder)
    .map((id) => MENU_ITEMS.find((item) => item.id === id))
    .filter((item) => item && !HIDDEN_MENU_IDS.includes(item.id));
  const orderedItems = items;
  const defaultPreferences = defaultMenuPreferences();
  const isDefaultMenuSettings = isDefaultMenuPreferences(s.prefs);
  return h`<form class="card areas-navigation-settings" data-form="settings-save">
    <div class="head areas-navigation-head"><h2>Áreas e navegação<i>.</i></h2><button type="button" class="btn sm" data-action="menu-reset" ${isDefaultMenuSettings ? raw('disabled') : ''}>Restaurar padrão</button></div>
    <p class="settings-section-intro">Escolha quais áreas aparecem e organize o acesso pelo menu. Desativar ou ocultar uma área não apaga seus dados.</p>
    <p class="small muted">Início fica sempre primeiro. Beber água é uma sugestão de hábito em Hábitos. Restaurar o padrão não ativa áreas nem altera registros.</p>
    <ol class="areas-navigation-list" aria-label="Áreas e menus principais">${items.map((item) => {
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
function prepareLegacyImportPreview(migration, sources, vaultCount) {
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
      prepareLegacyImportPreview(migration, discovery.sources, discovery.vaultCount);
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
    const { sources, vaultCount } = await unlockLegacySources({
      discovery: migration.discovery,
      userId: accountSession.user.id,
      password,
    });
    prepareLegacyImportPreview(migration, sources, vaultCount);
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
  const addedTotal = Object.values(preview.plan.added).reduce((sum, count) => sum + count, 0);
  if (!window.confirm(`Importar os dados antigos para esta conta? A prévia encontrou ${addedTotal} novo(s) registro(s), além de configurações que possam ser recuperadas. Dados atuais desta conta serão mantidos e não haverá duplicação por ID. Os dados antigos só serão apagados depois de nova confirmação.`)) return;
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
function clearLegacyBrowserData() {
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
  const result = clearImportedBrowserStorage(window.localStorage, snapshot);
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
      message: `${result.removed.length} chave(s) antiga(s) apagadas deste navegador. O cofre antigo e suas tabelas no Supabase continuam preservados.`,
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
  return h`<section class="card settings-section-card" aria-labelledby="legacy-import-title">
    <div class="settings-section-heading"><h2 id="legacy-import-title">Trazer dados antigos para esta conta<i>.</i></h2><p>Este roteiro encontra cópias neste navegador e no cofre antigo. Primeiro apenas localiza; você revisa antes de importar. Nada é apagado automaticamente.</p></div>
    <ol class="legacy-import-steps" aria-label="Etapas para trazer dados antigos">${steps.map(([title, detail], index) => {
      const step = index + 1;
      const state = step < activeStep ? 'is-complete' : step === activeStep ? 'is-current' : '';
      return h`<li class="legacy-import-step ${state}" ${step === activeStep ? raw('aria-current="step"') : ''}><span class="legacy-import-step-number">${step < activeStep ? '✓' : step}</span><span><b>${title}</b><small>${detail}</small></span></li>`;
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
        <p>Isso remove somente as ${snapshotCount} cópia(s) legada(s) reconhecida(s) e lida(s) neste navegador. Não apaga dados do banco nem o cofre antigo no Supabase. Você também pode deixar essas cópias intactas.</p>
        <label class="legacy-import-confirm"><input id="legacy-import-reviewed" type="checkbox" data-change="legacy-import-cleanup-confirm" ${migration.cleanupConfirmed ? raw('checked') : ''}><span>Conferi os dados na conta e quero apagar exatamente estas cópias locais.</span></label>
        <button id="legacy-import-clear" type="button" class="btn danger" data-action="legacy-import-clear" ${migration.busy || !migration.cleanupConfirmed ? raw('disabled') : ''}>${migration.busy ? 'Apagando cópias…' : `Apagar ${snapshotCount} cópia(s) deste navegador`}</button>
      </div>` : h`<p class="small muted">Não há cópias reconhecidas neste navegador para apagar. O cofre antigo no Supabase continua preservado.</p>`}
    </div>` : ''}
    ${migration.completed && preview?.cleanup ? h`<p class="small ${preview.cleanup.failed || preview.cleanup.changed ? 'err' : 'muted'}" role="${preview.cleanup.failed || preview.cleanup.changed ? 'alert' : 'status'}">${preview.cleanup.message}</p>` : ''}
  </section>`;
}
function dataSettings(p) {
  const integritySlices = Object.keys(ui.integrityIssues);
  const failedSlices = [...ui.persistFailed];
  const trashEntries = p.trash.filter((entry) => !isTrashExpired(entry)).sort((a, b) => b.deletedAt - a.deletedAt);
  return h`<section class="card settings-section-card"><div class="settings-section-heading"><h2>Backup<i>.</i></h2><p>Baixe uma cópia dos seus dados para guardar ou levar para outro navegador. No celular, escolha Arquivos ou Downloads e guarde o <span class="case-preserve">JSON</span> fora dos dados do navegador.</p></div>
    <div class="notice data-location" role="status">${icon('cloud', 18)}<span>Seus dados ficam no Supabase, protegidos pela sessão da conta, verificação em dois fatores e regras de acesso por usuário. O banco pode processar os dados em formato legível; mantenha a autenticação e os backups protegidos.</span></div>
    <div class="notice warn" role="note"><span>O backup exportado continua sendo um arquivo JSON em texto puro e pode conter dados financeiros e de saúde. A exportação pedirá confirmação; proteja o arquivo fora do Aurora.</span></div>
    <p class="small muted">${p.lastBackup ? 'Último backup exportado nesta conta: ' + shortDate(isoDay(p.lastBackup)) + '.' : 'Você ainda não exportou um backup nesta conta.'}</p>
    ${integritySlices.length ? h`<div class="notice warn" role="alert"><span>Há dados bloqueados em ${integritySlices.join(', ')}. As cópias originais continuam preservadas e não serão sobrescritas. Importe um backup confiável para recuperar os dados; também baixe uma cópia bruta antes de substituir.</span></div><button class="btn" data-action="recovery-export">${icon('download', 18)}Baixar cópia de recuperação</button>` : ''}
    ${failedSlices.length && !integritySlices.length ? h`<div class="notice warn" role="alert"><span>Não foi possível confirmar a gravação no Supabase. As alterações pendentes continuam apenas nesta memória enquanto esta página estiver aberta.</span><button type="button" class="btn sm" data-action="persist-retry" ${navigator.onLine ? '' : raw('disabled')}>Tentar novamente</button></div>` : ''}
    <div class="row"><button class="btn" data-action="export">${icon('download', 18)}Exportar backup</button></div></section>
    ${legacyImportPanel()}
    <section class="card settings-section-card"><div class="settings-section-heading"><h2>Restaurar<i>.</i></h2><p>Escolha um backup para conferir o conteúdo antes da confirmação. A restauração substitui os dados relacionais atuais na sua conta.</p></div>
    <div class="row"><label class="btn backup-file-label">${icon('upload', 18)}Escolher backup<input type="file" accept="application/json,.json" data-change="import" class="sr"></label></div>
    <p class="err" id="imperr" role="alert"></p>
    <p class="small muted">São aceitos backups do Aurora nas versões 1 e 2.</p></section>
    <section class="card settings-section-card" aria-labelledby="trash-title"><div class="settings-section-heading"><h2 id="trash-title" tabindex="-1">Lixeira<i>.</i></h2><p>Itens excluídos ficam disponíveis para restauração por 30 dias. Depois, são removidos automaticamente. A lixeira também acompanha os backups exportados.</p></div>
      ${trashEntries.length
        ? h`<ul class="list trash-list">${trashEntries.map((entry) => {
          const days = trashDaysRemaining(entry);
          return h`<li><div class="grow"><div class="ttl">${entry.label}</div><span class="small muted">Excluído em ${shortDate(isoDay(entry.deletedAt))} · ${days} ${plural(days, 'dia restante', 'dias restantes')}</span></div><button type="button" class="btn sm" data-action="trash-restore" data-id="${entry.id}" aria-label="Restaurar ${entry.label}">Restaurar</button></li>`;
        })}</ul>`
        : h`<p class="small muted">A lixeira está vazia.</p>`}
    </section>
    <section class="card settings-section-card"><div class="settings-section-heading"><h2>Zona de cuidado<i>.</i></h2><p>Experimente a plataforma com exemplos ou apague permanentemente os dados relacionais desta conta.</p></div>
    <div class="row"><button class="btn" data-action="load-sample">Explorar com exemplos</button>
    <button class="btn danger" data-action="wipe-ask">${icon('trash', 18)}Apagar dados relacionais</button></div></section>`;
}
function settingsStorageNotice(selectedTab) {
  if (selectedTab === 'data') return '';
  const integritySlices = Object.keys(ui.integrityIssues);
  if (integritySlices.length) {
    return h`<div class="notice warn settings-storage-notice" role="alert"><span>Há dados inválidos em ${integritySlices.join(', ')}. A gravação está bloqueada para evitar perda; revise Dados e backup antes de continuar.</span><button type="button" class="btn sm" data-action="settings-section" data-settings-tab="data">Revisar dados</button></div>`;
  }
  const failedSlices = [...ui.persistFailed];
  if (failedSlices.length) {
    return h`<div class="notice warn settings-storage-notice" role="alert"><span>Não foi possível confirmar a gravação no Supabase. Algumas alterações continuam apenas na memória.</span><button type="button" class="btn sm" data-action="persist-retry" ${navigator.onLine ? '' : raw('disabled')}>Tentar novamente</button></div>`;
  }
  return '';
}
function settingsSectionContent(s, p, selectedTab) {
  switch (selectedTab) {
    case 'personalization': return aparencia(s);
    case 'areas-navigation': return areasNavigationSettings(s);
    case 'data': return dataSettings(p);
    default: return profileSettings(s);
  }
}
function viewConfig() {
  const s = S.settings, p = s.prefs;
  const requestedTab = settingsTabId(ui.settingsTab);
  const selected = SETTINGS_SECTIONS.some(([id]) => id === requestedTab) ? requestedTab : 'profile';
  const content = settingsSectionContent(s, p, selected);
  return h`${pageTitle('Ajustes')}${settingsStorageNotice(selected)}
    <div class="settings-layout">
      <nav class="settings-menu" aria-label="Opções de Ajustes"><span class="settings-menu-heading">Preferências</span>${SETTINGS_SECTIONS.map(([id, label, ic, description]) => h`<a class="settings-link" href="#config?section=${encodeURIComponent(id)}" data-action="settings-section" data-settings-tab="${id}" aria-controls="settings-content" ${selected === id ? raw('aria-current="page"') : ''}><span class="settings-link-icon">${icon(ic, 19)}</span><span class="settings-link-copy"><b>${tabLabel(label)}</b><small>${description}</small></span>${icon('chevRight', 16, 'settings-link-arrow')}</a>`)}</nav>
      <div class="settings-content" id="settings-content">${content}</div>
    </div>`;
}

const ROUTES = { inicio: viewInicio, planejar: viewPlanejar, pomodoro: viewPomodoro, financas: viewFinancas, ciclo: viewCiclo, habitos: viewHabits, config: viewConfig };

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
  if (ui.dlg?.type === 'onboard') {
    finishOnboard(true);
    return;
  }
  if (ui.dlg?.type === 'area-tutorial') {
    const { route, automatic } = ui.dlg.d;
    ui.dlg = null;
    ui.dlgPending = null;
    if (automatic && AREA_GUIDES[route] && !S.settings.prefs.areaTutorialsSeen.includes(route)) {
      const snapshot = snapshotSlices(['settings']);
      S.settings.prefs.areaTutorialsSeen = normalizeAreaTutorialsSeen([
        ...S.settings.prefs.areaTutorialsSeen,
        route,
      ]);
      saveSlicesWithRollback(['settings'], snapshot, false, 'a visualização do tutorial');
    }
    render();
    return;
  }
  if (ui.dlg?.type === 'action-confirm') {
    ui.dlg = ui.confirmPrevious;
    ui.confirmPrevious = null;
    render();
    return;
  }
  if (ui.dlg?.type === 'discard') { dlgKeepEditing(); return; }
  if (ui.dlg?.type === 'taskplan' && ui.dlg.d.confirm) { ui.dlg = null; render(); return; }
  if (ui.dlg?.type === 'taskplan' && taskPlanDirty()) { ui.dlg.d.confirm = true; render(); return; }
  if (ui.dlg?.dirty) { askDiscardDialog(); return; }
  ui.dlg = null;
  ui.dlgPending = null;
  render();
};
const setPath = (o, p, v) => { const ks = p.split('.'); const last = ks.pop(); const t = ks.reduce((a, k) => a[k], o); t[last] = v; };
const dlgField = (label, inner, cls = '') => h`<label class="f ${cls}"><span class="f-label">${label}</span>${inner}</label>`;
const dlgWrap = (body, foot, bodyClass = '') => h`<div class="dlg-body ${bodyClass}">${body}</div><div class="dlg-foot">${foot}</div>`;
const closeBtn = h`<button type="button" class="ibtn dlg-close" data-action="dlg-close" aria-label="Fechar">${icon('close', 20)}</button>`;

function planTitles(d) {
  const lines = d.steps.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 12).map((x) => x.slice(0, 120));
  return lines.length ? lines : [d.goal.trim().slice(0, 120)];
}
function dlgActionConfirm() {
  const d = ui.dlg.d;
  return dlgWrap(h`<div class="confirmation-heading"><span class="confirmation-mark" aria-hidden="true">${icon('alert', 22)}</span><div><p class="confirmation-eyebrow">Confirmação necessária</p><h2 id="dt">${d.title}<i>.</i></h2></div>${closeBtn}</div>
    <p class="confirmation-copy">${d.message}</p>
    <aside class="confirmation-note" role="alert">${icon('alert', 18)}<span><b>A ação só será executada depois que você confirmar.</b></span></aside>`,
    h`<button type="button" class="btn back" data-action="action-confirm-cancel">Cancelar</button><button type="button" class="btn danger" data-action="action-confirm-accept">${d.confirmLabel}</button>`);
}
function dlgTaskPlan() {
  const d = ui.dlg.d, titles = planTitles(d);
  if (d.confirm) return dlgWrap(h`<div class="wiz-h"><h2 id="dt">Descartar o que você escreveu?</h2><p>Seu objetivo e suas etapas ainda não foram salvos. Se fechar agora, o texto será descartado.</p></div>`,
    h`<button class="btn" data-action="plan-discard">Descartar</button><button class="btn primary" data-action="plan-keep">Continuar planejando</button>`);
  const prompts = ['O que você precisa realizar? Conte do seu jeito.', 'Quais passos pequenos levam até lá? Escreva um por linha.', 'Quando você quer começar?', 'Confira o plano. Ao confirmar, as tarefas entram na sua lista.'];
  const body = d.step === 0 ? dlgField('Seu objetivo', h`<textarea id="f0" data-dlg="goal" maxlength="240" rows="3" placeholder="Ex.: me preparar para a prova de biologia">${d.goal}</textarea>`)
    : d.step === 1 ? h`${dlgField('Etapas (uma por linha)', h`<textarea id="f0" data-dlg="steps" maxlength="1000" rows="5" placeholder="Revisar os capítulos 1 e 2&#10;Fazer exercícios de genética">${d.steps}</textarea>`)}<p class="fine">Sem etapas? Deixe vazio para criar uma tarefa só com o objetivo.</p>`
    : d.step === 2 ? h`<div class="form">${dlgField('Começar em', h`<input id="f0" type="date" data-dlg="start" value="${d.start}">`, 'full')}${dlgField('Prioridade', h`<select data-dlg="priority">${prioOptions(d.priority)}</select>`)}</div><label class="row" style="gap:12px"><input type="checkbox" data-dlg="spread" ${d.spread ? raw('checked') : ''}><span class="small">Distribuir uma etapa por dia, a partir da data escolhida</span></label>`
    : h`<div class="card flat"><b>${d.goal.trim()}</b><ul class="list">${titles.map((t, i) => h`<li>${icon('check', 16)}<span class="grow">${t}</span>${d.start ? h`<span class="badge">${shortDate(d.spread ? addDays(d.start, i) : d.start)}</span>` : ''}</li>`)}</ul><p class="fine">Prioridade: ${cap(PRIO[d.priority])}${d.start ? '' : ' · sem data (vai para a caixa de entrada)'}</p></div>`;
  return dlgWrap(h`<div class="head" style="flex-wrap:nowrap;align-items:flex-start"><div class="wiz-h"><h2 id="dt">Plano por etapas<i>.</i></h2><p>${prompts[d.step]}</p></div>${closeBtn}</div>
    <div class="steps" aria-label="Etapa ${d.step + 1} de 4">${[0, 1, 2, 3].map((i) => h`<i class="${i <= d.step ? 'on' : ''}"></i>`)}</div>${body}${d.error ? h`<p class="err" role="alert">${d.error}</p>` : ''}
    <p class="fine">Você pode revisar tudo antes de adicionar as tarefas.</p>`,
    h`${d.step > 0 ? h`<button class="btn back" data-action="plan-back">Voltar</button>` : ''}${d.step < 3 ? h`<button class="btn primary" data-action="plan-next">Continuar</button>` : h`<button class="btn primary" data-action="plan-create">Adicionar ${titles.length} ${plural(titles.length, 'tarefa', 'tarefas')}</button>`}`);
}
function dlgTask() {
  const d = ui.dlg.d, subs = d.subs || [], creating = d.create === true;
  return dlgWrap(h`<div class="head task-dialog-head"><span class="task-dialog-mark" aria-hidden="true">${icon(creating ? 'plus' : 'check', 20)}</span><div><p class="task-dialog-eyebrow">${creating ? 'planejamento rápido' : 'organize os detalhes'}</p><h2 id="dt">${creating ? 'Nova tarefa' : 'Editar tarefa'}<i>.</i></h2></div>${closeBtn}</div>
    <form id="dlgform" class="form task-form" data-form="dlg-task">${dlgField('Título', h`<input id="f0" type="text" data-dlg="title" value="${d.title}" maxlength="120" required placeholder="O que você precisa fazer?">`, 'full task-title-field')}
      ${dlgField('Prazo', h`<input type="date" data-dlg="due" value="${d.due}">`)}${dlgField('Hora', h`<input type="time" data-dlg="time" value="${d.time || ''}">`)}
      ${dlgField('Repetir', h`<select data-dlg="repeat">${Object.entries(REPEATS).map(([k, v]) => h`<option value="${k}" ${k === (d.repeat || 'none') ? raw('selected') : ''}>${v}</option>`)}</select>`)}
      ${dlgField('Lembrete', h`<select data-dlg="remind" ${d.time ? '' : raw('disabled')}>${REMINDS.map(([k, v]) => h`<option value="${k}" ${String(d.remind == null ? '' : d.remind) === k ? raw('selected') : ''}>${v}</option>`)}</select>${d.time ? '' : h`<span class="task-field-help">Escolha uma hora para ativar.</span>`}`)}
      ${dlgField('Prioridade', h`<select data-dlg="priority">${prioOptions(d.priority)}</select>`)}
      <details class="task-notes full" ${d.notes ? raw('open') : ''}><summary>Adicionar notas <span>opcional</span></summary><textarea data-dlg="notes" rows="3" maxlength="2000" placeholder="Detalhes, links, o que lembrar…">${d.notes || ''}</textarea></details></form>
    <div class="f"><span class="lbl">Etiquetas</span>
      ${(d.tags || []).length ? h`<div class="chips">${d.tags.map((g, i) => h`<span class="chip on tgchip">#${g}<button type="button" class="ibtn" data-action="tg-del" data-i="${i}" aria-label="Remover etiqueta ${g}">${icon('close', 14)}</button></span>`)}</div>` : ''}
      <form class="aibar" data-form="tg-add" style="border-radius:14px"><label class="sr" for="tgn">Nova etiqueta</label><input type="text" id="tgn" name="tg" maxlength="24" placeholder="Adicionar etiqueta" autocomplete="off"><button class="btn sm" type="submit">${icon('plus', 16)}Adicionar</button></form>
      ${allTags().filter((g) => !(d.tags || []).includes(g)).length ? h`<div class="chips">${allTags().filter((g) => !(d.tags || []).includes(g)).slice(0, 8).map((g) => h`<button type="button" class="chip" data-action="tg-pick" data-v="${g}">#${g}</button>`)}</div>` : ''}</div>
    <div class="f"><span class="lbl">Subtarefas${subs.length ? ` (${subs.filter((x) => x.done).length}/${subs.length})` : ''}</span>
      ${subs.length ? h`<ul class="list tight subl">${subs.map((x, i) => h`<li><button type="button" class="chk" role="checkbox" aria-checked="${!!x.done}" aria-label="${x.done ? 'Reabrir' : 'Concluir'}: ${x.title}" data-action="st-toggle" data-i="${i}"><span>${icon('check', 15)}</span></button><span class="grow ${x.done ? 'st-done' : ''}">${x.title}</span><button type="button" class="ibtn" data-action="st-del" data-i="${i}" aria-label="Remover ${x.title}">${icon('close', 18)}</button></li>`)}</ul>` : ''}
      <form class="aibar" data-form="st-add" style="border-radius:14px"><label class="sr" for="stn">Nova subtarefa</label><input type="text" id="stn" name="st" maxlength="100" placeholder="Adicionar subtarefa" autocomplete="off"><button class="btn sm" type="submit">${icon('plus', 16)}Adicionar</button></form></div>`,
    creating
      ? h`<button type="button" class="btn back" data-action="dlg-close">Cancelar</button><button class="btn primary" type="submit" form="dlgform">Adicionar tarefa</button>`
      : h`<button type="button" class="btn danger back" data-action="del-task-dlg" aria-label="Excluir tarefa">${icon('trash', 18)}</button><button type="button" class="btn back" data-action="dlg-close">Cancelar</button><button class="btn primary" type="submit" form="dlgform">Salvar</button>`,
    'task-dialog');
}
function dlgCycleLog() {
  const { day, log } = ui.dlg.d;
  const flow = CYC.find(({ id }) => id === 'flow');
  const groups = CYC.filter(({ id }) => id !== 'flow');
  const choiceStatus = (count, single) => count
    ? `${count} selecionado${count === 1 ? '' : 's'}`
    : `Opcional · ${single ? 'Escolha 1' : 'várias opções'}`;
  const choiceButton = (category, value, label, selected, id = '') => h`<button type="button" ${id ? raw(`id="${id}"`) : ''} class="chip cycle-choice${category === 'flow' ? ' cycle-flow-choice' : ''}" aria-label="${label}" title="${label}" aria-pressed="${selected ? 'true' : 'false'}" data-action="cyc-opt" data-c="${category}" data-category="${category}" data-v="${value}"><span class="cycle-choice-symbol" aria-hidden="true">${icon(CYC_OPTION_ICON[category]?.[value] || CYC_ICON[category], category === 'flow' ? ({ spot: 14, light: 18, medium: 21, heavy: 24 }[value] || 18) : 18)}</span><span class="cycle-choice-label">${CYC_SHORT_LABEL[category]?.[value] || label}</span><span class="cycle-choice-mark" aria-hidden="true">${icon('check', 14)}</span></button>`;
  return dlgWrap(h`<form id="dlgform" class="cycle-log-form" data-form="cycle-log">
    <div class="cycle-log-heading"><div><span class="cycle-log-eyebrow">Registro do ciclo</span><h2 id="dt">${longDate(day)}</h2><p>Marque o que se aplica a este dia. O preenchimento é opcional.</p></div>${closeBtn}</div>
    <section class="cycle-flow-group" data-category="flow" role="group" aria-labelledby="cycle-flow-title">
      <div class="cycle-group-heading"><div><h3 id="cycle-flow-title">${icon(CYC_ICON.flow, 16)}Fluxo menstrual</h3><p>Leve, médio ou intenso entram nas estimativas; escape, não.</p></div><span class="cycle-group-mode">${log.flow ? `Selecionado: ${cycLabel('flow', log.flow)}` : 'Opcional · escolha 1'}</span></div>
      <div class="chips" role="group" aria-label="Intensidade do fluxo">${flow.opts.map(([value, label], index) => choiceButton('flow', value, label, log.flow === value, index === 0 ? 'f0' : ''))}</div>
    </section>
    <div class="cycle-symptoms-heading"><h3 id="cycle-symptoms-title">Sintomas e sinais</h3><p>Múltipla escolha, exceto em energia, sono e corrimento.</p></div>
    <div class="cycle-symptom-grid" role="group" aria-labelledby="cycle-symptoms-title">${groups.map((group) => {
      const current = group.single ? (log[group.id] ? [log[group.id]] : []) : (log[group.id] || []);
      return h`<section class="sym cycle-symptom-group" data-category="${group.id}" role="group" aria-labelledby="cycle-group-${group.id}">
        <div class="cycle-group-heading"><h3 id="cycle-group-${group.id}">${icon(CYC_ICON[group.id], 16)}${group.title}</h3><span class="cycle-group-mode">${choiceStatus(current.length, group.single)}</span></div>
        <div class="chips">${group.opts.map(([value, label]) => choiceButton(group.id, value, label, current.includes(value)))}</div>
      </section>`;
    })}</div>
    ${dlgField('Anotações do dia', h`<textarea data-dlg="log.note" maxlength="500" rows="3" placeholder="Algo que você queira lembrar…">${log.note || ''}</textarea>`, 'full')}
    <section class="cycle-sexual-group" role="group" aria-labelledby="cycle-sexual-title">
      <h3 id="cycle-sexual-title">${icon('heart', 16)}Relação sexual</h3>
      <label class="row cycle-sexual-toggle"><input type="checkbox" data-dlg="log.sexualActivity" aria-describedby="cycle-sexual-note" ${log.sexualActivity ? raw('checked') : ''}><span>Houve atividade sexual neste dia</span></label>
      ${log.sexualActivity ? h`<p class="fine" id="cycle-sexual-note">Opcional. Você pode selecionar mais de um método. “Nenhum método” e “Prefiro não informar” são opções exclusivas.</p>
        <div class="chips cycle-contraception-options" role="group" aria-label="Métodos contraceptivos usados">${CYCLE_CONTRACEPTION_METHODS.map(({ id, label }) => h`<button type="button" class="chip" aria-pressed="${(log.contraceptionMethods || []).includes(id) ? 'true' : 'false'}" data-action="cyc-method" data-v="${id}">${label}</button>`)}</div>
        <p class="fine">Os registros ficam na conta Aurora. Backups podem incluir esses dados em JSON sem criptografia; guarde o arquivo com cuidado.</p>` : h`<p class="fine" id="cycle-sexual-note">Opcional. Não registramos essa informação se você não marcar a opção. Os registros ficam na conta Aurora; backups podem incluí-los em JSON sem criptografia.</p>`}
    </section>
  </form>`,
  h`<button type="button" class="btn back" data-action="dlg-close">Cancelar</button><button type="submit" class="btn primary" form="dlgform">Salvar registro</button>`);
}
function dlgCyclePeriod() {
  const { start, end, index } = ui.dlg.d;
  const maxDate = today();
  const editing = Number.isInteger(index);
  return dlgWrap(h`<form id="dlgform" class="cycle-period-form" data-form="cycle-period">
    <div class="cycle-log-heading"><div><span class="cycle-log-eyebrow">Registro do ciclo</span><h2 id="dt">${editing ? 'Editar período' : 'Registrar período'}<i>.</i></h2><p>Informe o primeiro e o último dia para registrar o período inteiro de uma vez.</p></div>${closeBtn}</div>
    <div class="cycle-period-fields">
      ${dlgField('Primeiro dia', h`<input id="f0" type="date" name="start" value="${start}" max="${maxDate}" aria-describedby="cycle-period-help" required>`)}
      ${dlgField('Último dia', h`<input type="date" name="end" value="${end}" max="${maxDate}" aria-describedby="cycle-period-help" required>`)}
    </div>
    <p class="fine" id="cycle-period-help">O intervalo pode ter até ${MAX_CYCLE_PERIOD_DAYS} dias e não altera sintomas ou anotações já salvos. As estimativas podem mudar quando as datas forem atualizadas.</p>
  </form>`,
  h`<button type="button" class="btn back" data-action="dlg-close">Cancelar</button><button type="submit" class="btn primary" form="dlgform">${editing ? 'Atualizar período' : 'Salvar período'}</button>`);
}
function dlgCycleBatch() {
  const { start, end, symptoms } = ui.dlg.d;
  const categories = CYC.filter(({ id }) => ['pain', 'mood', 'digestion', 'skin'].includes(id));
  return dlgWrap(h`<form id="dlgform" class="cycle-batch-form" data-form="cycle-batch">
    <div class="cycle-log-heading"><div><span class="cycle-log-eyebrow">Registro do ciclo</span><h2 id="dt">Adicionar sintomas a vários dias<i>.</i></h2><p>Escolha um intervalo e os sintomas que deseja incluir em todos esses dias.</p></div>${closeBtn}</div>
    <div class="cycle-period-fields">
      ${dlgField('Primeiro dia', h`<input id="f0" type="date" name="start" value="${start}" max="${today()}" aria-describedby="cycle-batch-help" required>`)}
      ${dlgField('Último dia', h`<input type="date" name="end" value="${end}" max="${today()}" aria-describedby="cycle-batch-help" required>`)}
    </div>
    <p class="fine" id="cycle-batch-help">Até ${MAX_CYCLE_LOG_RANGE_DAYS} dias por vez. Os sintomas selecionados serão acrescentados aos registros existentes; fluxo, energia, sono, corrimento, notas e informações sexuais não serão alterados.</p>
    <div class="cycle-batch-groups">${categories.map((category) => h`<section class="cycle-batch-group" role="group" aria-label="${category.title}"><h3>${icon(CYC_ICON[category.id], 16)}${category.title}</h3><div class="chips">${category.opts.map(([value, label]) => h`<button type="button" class="chip" aria-pressed="${(symptoms[category.id] || []).includes(value)}" data-action="cyc-batch-opt" data-category="${category.id}" data-v="${value}">${label}</button>`)}</div></section>`)}</div>
  </form>`,
  h`<button type="button" class="btn back" data-action="dlg-close">Cancelar</button><button type="submit" class="btn primary" form="dlgform">Adicionar sintomas</button>`,
  'cycle-batch-dialog');
}
function dlgHabitEdit() {
  const d = ui.dlg.d, edit = Boolean(d.id), habit = edit ? S.habits.find((item) => item.id === d.id) : null;
  return dlgWrap(h`<div class="head" style="flex-wrap:nowrap"><div><h2 id="dt">${edit ? 'Editar hábito' : 'Novo hábito'}<i>.</i></h2><p class="small muted">${edit ? 'Ajuste os dias e o lembrete deste hábito.' : 'Escolha um nome e os dias em que quer acompanhar.'}</p></div>${closeBtn}</div>
    <form id="dlgform" class="form" data-form="habit-edit">
      <label class="f full">Nome<input id="f0" name="name" type="text" data-dlg="name" value="${d.name}" maxlength="60" required autocomplete="off" placeholder="Ex.: Ler por 10 minutos"></label>
      ${d.waterSuggestion ? h`<label class="f full" for="water-weight-kg">Peso para estimativa (kg)<input id="water-weight-kg" name="waterWeightKg" type="text" data-dlg="waterWeightKg" inputmode="decimal" value="${d.waterWeightKg || ''}" aria-describedby="water-weight-help" placeholder="Opcional"><span class="profile-field-help" id="water-weight-help">De 20 a 400 kg. Esse peso será usado somente para calcular a sugestão e não será salvo no perfil.</span></label>
        <p class="fine full" id="water-goal-preview" aria-live="polite">${waterSuggestionPreview(d.waterWeightKg || '')}</p>
        <p class="fine full">A idade informada em Ajustes será considerada; sem idade, usamos uma referência adulta. Registre cada volume no hábito; ao atingir a meta, o check-in do dia é concluído.</p>` : ''}
      <fieldset class="habit-look full"><legend>Ícone</legend><div class="habit-icon-picker">${HABIT_ICONS.map(([key, label]) => h`<label title="${label}"><input type="radio" name="icon" value="${key}" data-dlg="icon" ${(d.icon || DEFAULT_HABIT_ICON) === key ? raw('checked') : ''}><span>${icon(key, 20)}<i class="sr">${label}</i></span></label>`)}</div></fieldset>
      <fieldset class="habit-look full"><legend>Cor</legend><div class="habit-color-picker">${HABIT_COLORS.map((color, index) => h`<label title="${HABIT_COLOR_NAMES[index]}"><input type="radio" name="color" value="${color}" data-dlg="color" ${(d.color || DEFAULT_HABIT_COLOR).toLowerCase() === color ? raw('checked') : ''}><span style="--c:${color}"><i class="sr">${HABIT_COLOR_NAMES[index]}</i>${icon('check', 16)}</span></label>`)}</div></fieldset>
      <fieldset class="habit-schedule full"><legend>Em quais dias?</legend><div class="habit-weekday-picker">${DIAS.map((day, index) => h`<label class="${index === pk(today()).getDay() ? 'is-today' : ''}"><input type="checkbox" name="days" value="${index}" ${d.days.includes(index) ? raw('checked') : ''}><span>${day}</span></label>`)}</div></fieldset>
      <label class="f full">Meta na semana (opcional)<select name="weeklyGoal"><option value="" ${d.weeklyGoal ? '' : raw('selected')}>Todos os dias marcados</option>${[1, 2, 3, 4, 5, 6, 7].map((n) => h`<option value="${n}" ${Number(d.weeklyGoal) === n ? raw('selected') : ''}>${n} ${plural(n, 'vez', 'vezes')} por semana</option>`)}</select><span class="small muted">Com meta, a semana conta como cumprida ao atingir esse número de dias, mesmo sem marcar todos.</span></label>
      <label class="f full">Lembrete no app (opcional)<input type="time" name="remind" data-dlg="remind" value="${d.remind || ''}"><span class="small muted">Só aparece enquanto o Aurora estiver aberto.</span></label>
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
  return `Meta diária estimada: ${goal.ml.toLocaleString('pt-BR')} mL, considerando ${ageText} e ${weightKg.toLocaleString('pt-BR')} kg.`;
}
function updateWaterSuggestionWeight(weightInput) {
  const draft = ui.dlg?.d;
  if (!draft?.waterSuggestion) return;
  const weightKg = parseWaterWeightKg(weightInput);
  const goal = weightKg === null
    ? null
    : estimateWaterGoal({ weightKg, age: currentProfileAge(S.settings) });
  draft.waterGoalMl = goal?.ml ?? null;
  const preview = $('#water-goal-preview');
  if (preview) preview.textContent = waterSuggestionPreview(weightInput);
  if (!draft.waterNameEdited) {
    draft.name = goal ? `Beber água · ${goal.ml.toLocaleString('pt-BR')} mL/dia` : 'Beber água';
    const nameInput = $('#f0');
    if (nameInput) nameInput.value = draft.name;
  }
}
function globalSearchResults(query) {
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
  if (String(query).trim().length < 2) return h`<p class="small muted">Digite pelo menos duas letras para buscar em Planejar, Hábitos, Finanças e Ciclo.</p>`;
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
  return dlgWrap(h`<div class="head global-search-head"><div><h2 id="dt">Buscar no Aurora<i>.</i></h2><p class="small muted">Planejar, Hábitos, Finanças e Ciclo</p></div>${closeBtn}</div>
    <label class="search global-search-input"><span class="sr">Buscar em todas as áreas</span>${icon('search', 18)}<input id="f0" type="search" data-dlg="query" value="${query}" placeholder="Tarefa, hábito, conta ou descrição" autocomplete="off"></label>
    <div id="global-search-results" aria-live="polite">${globalSearchResults(query)}</div>`,
    h`    <span class="small muted">Atalho: Ctrl+K ou ⌘K · Esc para fechar</span><button class="btn back" data-action="dlg-close">Fechar</button>`);
}
function dlgWipe() {
  return dlgWrap(h`
    <div class="destructive-summary"><p class="destructive-copy">Isso apaga permanentemente os dados relacionais desta conta no Supabase. Dados antigos de outras áreas ainda não importados serão preservados para a migração.</p>
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
  { id: 'organization', icon: 'calendarCheck', title: 'Organizar meu dia', description: 'Lembrar tarefas, prazos e prioridades.', areas: [] },
  { id: 'focus', icon: 'clock', title: 'Manter o foco', description: 'Usar ciclos de foco e pausa em qualquer atividade.', areas: ['pomodoro'] },
  { id: 'routine', icon: 'check', title: 'Manter uma rotina', description: 'Criar hábitos e acompanhar minha constância.', areas: ['habits'] },
  { id: 'hydration', icon: 'droplet', title: 'Beber mais água', description: 'Registrar os mL consumidos e acompanhar a meta diária.', areas: ['habits'] },
  { id: 'movement', icon: 'dumbbell', title: 'Me movimentar mais', description: 'Registrar treinos e acompanhar minha evolução.', areas: ['gym'] },
  { id: 'finances', icon: 'wallet', title: 'Organizar meu dinheiro', description: 'Acompanhar gastos, receitas e objetivos.', areas: ['finances'] },
  { id: 'cycle', icon: 'heart', title: 'Acompanhar meu ciclo menstrual', description: 'Registrar sinais e consultar estimativas.', areas: ['cycle'] },
];
const ONBOARDING_AREAS = [
  { id: 'pomodoro', icon: 'clock', title: 'Pomodoro', description: 'Alterne períodos de foco e pausas.' },
  { id: 'habits', icon: 'check', title: 'Hábitos', description: 'Crie uma rotina e acompanhe sua constância.' },
  { id: 'gym', icon: 'dumbbell', title: 'Academia', description: 'Registre treinos e acompanhe sua evolução.' },
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
  const dots = h`<div class="steps" aria-label="Passo ${st + 1} de 3">${[0, 1, 2].map((i) => h`<i class="${i <= st ? 'on' : ''}"></i>`)}</div>`;
  let body, foot;
  if (st === 0) {
    body = h`${dots}<div class="onboard-intro"><span class="onboard-brand">${brandIcon(52)}</span><div class="wiz-h"><span class="eyebrow">Personalização inicial</span><h2 id="dt">O que você quer melhorar no seu dia a dia?</h2><p>Escolha uma ou mais opções. Vamos sugerir ferramentas do Aurora para ajudar — você pode mudar tudo depois.</p></div></div>
      <fieldset class="onboard-fieldset"><legend>O que faz mais sentido para você agora?</legend><div class="onboard-options">${ONBOARDING_NEEDS.map((need) => h`<button type="button" class="opt" aria-pressed="${d.needs.includes(need.id)}" data-action="ob-need" data-v="${need.id}"><span class="mk">${icon(need.icon, 22)}</span><span class="tx"><b>${need.title}</b><span>${need.description}</span></span><span class="tick">${icon('check', 15)}</span></button>`)}</div></fieldset>
      <p class="fine">${icon('info', 15)} Suas tarefas e seu planejamento já ficam disponíveis; não é preciso ativar uma área para começar a se organizar.</p>`;
    foot = h`<button class="btn back" data-action="ob-skip">Pular personalização</button><button class="btn primary" data-action="ob-next">Ver sugestões</button>`;
  } else if (st === 1) {
    const solutionIds = ONBOARDING_AREAS.filter((area) => d.areas[area.id] || d.recommendedAreas.includes(area.id));
    const hasOrganizationNeed = d.needs.includes('organization');
    body = h`${dots}<div class="wiz-h"><h2 id="dt">Estas ferramentas podem ajudar<i>.</i></h2><p>Ativamos as sugestões a partir das suas respostas. Desmarque o que não quiser usar agora.</p></div>
      ${hasOrganizationNeed ? h`<article class="onboard-solution-note"><span class="mk">${icon('calendarCheck', 22)}</span><span class="tx"><b>Planejar</b><span>Tarefas, prazos e prioridades já estão disponíveis para organizar seu dia.</span></span><span class="onboard-always-on">Sempre disponível</span></article>` : ''}
      ${solutionIds.length ? h`<fieldset class="onboard-fieldset"><legend>Áreas do Aurora</legend><div class="onboard-solution-list">${solutionIds.map((area) => h`<button type="button" class="opt onboard-solution" aria-pressed="${!!d.areas[area.id]}" data-action="ob-area" data-v="${area.id}"><span class="mk">${icon(area.icon, 22)}</span><span class="tx"><b>${area.title}</b><span>${area.description}</span><small>${d.recommendedAreas.includes(area.id) ? 'Sugestão baseada nas suas respostas' : 'Já estava ativa na sua conta'}</small></span><span class="tick">${icon('check', 15)}</span></button>`)}</div></fieldset>` : h`<p class="notice">${icon('sparkles', 18)}<span>Nenhuma área adicional selecionada. Você pode ativá-las quando quiser em Ajustes.</span></p>`}`;
    foot = h`<button class="btn back" data-action="ob-skip">Pular personalização</button><button class="btn back" data-action="ob-back">Voltar</button><button class="btn primary" data-action="ob-next">Continuar</button>`;
  } else {
    body = h`${dots}<div class="wiz-h"><h2 id="dt">Deixe o Aurora com a sua cara<i>.</i></h2><p>Essas opções são opcionais e você pode alterá-las depois em Ajustes.</p></div>
      <div class="onboard-theme"><span class="f-label">Cor do app</span><div class="swatches">${Object.entries(PALETTES).map(([key, [name, color]]) => h`<button type="button" class="swatch" aria-pressed="${d.theme === key}" data-action="ob-theme" data-v="${key}"><i style="background:${color}"></i>${name}</button>`)}</div></div>`;
    foot = h`<button class="btn back" data-action="ob-skip">Pular personalização</button><button class="btn back" data-action="ob-back">Voltar</button><button class="btn primary" data-action="ob-finish">Concluir</button>`;
  }
  return dlgWrap(body, foot);
}
function dlgExport() {
  if (Object.keys(ui.integrityIssues).length) {
    return dlgWrap(h`<div class="head" style="flex-wrap:nowrap"><h2 id="dt">Backup indisponível<i>.</i></h2>${closeBtn}</div><p class="notice warn" role="alert">Há fatias locais inválidas. Baixe uma cópia bruta ou importe um backup confiável antes de criar um backup normalizado.</p>`,
      h`<button class="btn" data-action="recovery-export">Baixar cópia de recuperação</button><button class="btn back" data-action="dlg-close">Fechar</button>`);
  }
  return dlgWrap(h`<div class="head" style="flex-wrap:nowrap"><h2 id="dt">${ui.dlg.d.kind === 'csv' ? 'Seus lançamentos' : 'Seu backup'}<i>.</i></h2>${closeBtn}</div>
    <p class="small muted">O download direto não está disponível aqui. Copie o texto e salve em um arquivo <b>${ui.dlg.d.kind === 'csv' ? '.csv' : '.json'}</b>${ui.dlg.d.kind === 'csv' ? '.' : '; depois dá para importá-lo.'}</p>
    <textarea id="exp" readonly rows="8" style="font-family:ui-monospace,monospace;font-size:.75rem">${ui.dlg.d.json}</textarea>`,
    h`<button class="btn back" data-action="dlg-close">Fechar</button><button class="btn primary" data-action="copy-export">Copiar</button>`);
}
function dlgImport() {
  const p = ui.dlg.d.parsed;
  return dlgWrap(h`<h2 id="dt">Importar este backup?</h2>
    <p>Prévia do conteúdo validado deste arquivo:</p>
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
    <video class="area-tutorial-video" controls autoplay muted playsinline preload="metadata" aria-label="Tutorial em vídeo: ${guide.title}">
      <source src="${guide.video}" type="video/webm">
      Seu navegador não consegue reproduzir este vídeo.
    </video>
    <p class="area-tutorial-caption">Vídeo sem narração, com orientações na tela. Se preferir, abra o roteiro abaixo.</p>
    <details class="area-tutorial-script"><summary>Ver roteiro do vídeo</summary><ol>${guide.steps.map((step) => h`<li><strong>${step.title}</strong> — ${step.text}</li>`)}</ol>${guide.note ? h`<p>${guide.note}</p>` : ''}</details>`,
    h`<button class="btn back" data-action="dlg-close">Fechar</button>`,
    'area-tutorial-body');
}
function listArr(g) { return S.settings.cats[g]; }
function addItem(g, name) {
  const arr = listArr(g), ex = arr.find((x) => norm(x.name) === norm(name)); if (ex) return ex.name;
  arr.push({ name, color: LIST_COLORS[arr.length % LIST_COLORS.length], icon: 'tag' }); return name;
}
function resolveNew(g, d, key) {
  if (d[key] !== '__new') return true;
  const n = String(d.newName || '').trim().slice(0, 30);
  if (!n) { toast('Dê um nome para a nova opção.'); return false; }
  d[key] = addItem(g, n); d.newName = ''; commit('settings'); return true;
}
const DLG = { taskplan: dlgTaskPlan, task: dlgTask, 'cycle-log': dlgCycleLog, 'cycle-period': dlgCyclePeriod, 'cycle-batch': dlgCycleBatch, 'habit-edit': dlgHabitEdit, search: dlgSearch, 'action-confirm': dlgActionConfirm, wipe: dlgWipe, 'wipe-complete': dlgWipeComplete, onboard: dlgOnboard, 'area-tutorial': dlgAreaTutorial, export: dlgExport, import: dlgImport };
DLG.discard = () => dlgWrap(h`<div class="head"><div><h2 id="dt">Descartar alterações?<i>.</i></h2><p class="small muted">Há alterações que ainda não foram salvas. Se sair agora, elas serão perdidas.</p></div></div>`,
  h`<button type="button" class="btn" data-action="dlg-keep">Continuar editando</button><button type="button" class="btn danger" data-action="dlg-discard">Descartar alterações</button>`);

/* Ajusta a camada do diálogo à área visível quando o teclado está aberto.
   Sem teclado ela ocupa a tela toda (inset: 0), sem depender de visualViewport. Com teclado, só a altura e o topo
   seguem a área visível; a largura nunca muda (o deslocamento horizontal do iOS fazia o painel andar para os lados),
   e as mudanças são agrupadas para o painel não acompanhar a animação do teclado quadro a quadro. */
let fitTimer = 0;
function applyFitDlg() {
  const el = $('#dlg'), v = window.visualViewport; if (!el) return;
  const keyboard = v && window.innerHeight - v.height > 120;
  if (!keyboard) { Object.assign(el.style, { inset: '0', left: '', right: '', top: '', width: '', height: '' }); return; }
  Object.assign(el.style, { inset: 'auto', left: '0', right: '0', width: 'auto', top: Math.max(0, Math.round(v.offsetTop)) + 'px', height: Math.round(v.height) + 'px' });
}
function fitDlg() { applyFitDlg(); }
function fitDlgSoon() { clearTimeout(fitTimer); fitTimer = setTimeout(applyFitDlg, 90); }
if (window.visualViewport) visualViewport.addEventListener('resize', fitDlgSoon);
window.addEventListener('resize', fitDlgSoon);
function renderDialog() {
  let el = $('#dlg');
  if (ui.dlg && ui.dlg.type === 'onboard' && profileSetupComplete()) ui.dlg = null;
  if (!ui.dlg) { if (el) { el.remove(); document.documentElement.style.overflow = ''; $('#app').inert = false; const lf = ui.lastFocus; ui.lastFocus = null; restoreDialogOpener(lf); } return; }
  const isIntro = ui.dlg.type === 'intro', isCycleLog = ['cycle-log', 'cycle-batch'].includes(ui.dlg.type);
  const isCyclePeriod = ui.dlg.type === 'cycle-period';
  const opening = !el, typeChanged = Boolean(el && el.dataset.dialogType !== ui.dlg.type);
  const af = !opening && !typeChanged && document.activeElement && document.activeElement.closest('#dlg') ? document.activeElement : null;
  const afSel = af ? { id: af.id, data: af.dataset.dlg, action: af.dataset.action, v: af.dataset.v, c: af.dataset.c } : null;
  const prevScroll = !opening ? (el.querySelector('.dlg-body') || {}).scrollTop : 0;
  if (opening) { if (!ui.lastFocus) ui.lastFocus = describeDialogOpener(document.activeElement); el = document.createElement('div'); el.id = 'dlg'; el.className = 'dlg-back is-opening'; setTimeout(() => el.classList.remove('is-opening'), 500); document.body.appendChild(el); document.documentElement.style.overflow = 'hidden'; }
  el.classList.toggle('is-intro', isIntro);
  fitDlg();
  el.innerHTML = `<div class="dlg${isIntro ? ' intro-dialog' : ''}${isCycleLog ? ' cycle-log-dialog' : ''}${isCyclePeriod ? ' cycle-period-dialog' : ''}" role="dialog" aria-modal="true" aria-labelledby="dt">${DLG[ui.dlg.type]().s}</div>`;
  el.dataset.dialogType = ui.dlg.type;
  $('#app').inert = true;
  const body = el.querySelector('.dlg-body'); if (body && prevScroll) body.scrollTop = prevScroll;
  applyTheme(ui.dlg.type === 'onboard' ? ui.dlg.d.theme : undefined);
  let target = null;
  if (afSel) target = (afSel.id && document.getElementById(afSel.id)) || (afSel.data && el.querySelector(`[data-dlg="${afSel.data}"]`)) || (afSel.action && el.querySelector(`[data-action="${afSel.action}"]${afSel.v ? `[data-v="${afSel.v}"]` : ''}${afSel.c ? `[data-c="${afSel.c}"]` : ''}`));
  if (!target) target = (afSel && afSel.action && el.querySelector(`[data-action="${afSel.action}"]${afSel.v ? `[data-v="${afSel.v}"]` : ''}${afSel.c ? `[data-c="${afSel.c}"]` : ''}`)) || el.querySelector('#f0') || el.querySelector('input,textarea,select,button');
  // Mantém o foco no diálogo ao abrir a configuração; focar o campo de nome pode abrir o teclado antes de um toque.
  if ((opening || typeChanged) && !afSel && ['intro', 'onboard'].includes(ui.dlg.type)) {
    target = el.querySelector('.dlg');
    target.tabIndex = -1;
  }
  if (target) target.focus({ preventScroll: true });
}

/* ========== Ações, formulários, importação/exportação e arranque ========== */
const findTask = (id) => S.tasks.find((t) => t.id === id);
const mkTask = (o) => ({ id: newId(), title: '', done: false, tag: 'Pessoal', dueDate: null, priority: 'normal', createdAt: Date.now(), ...o });
const taskDraft = (due = '') => ({ create: true, title: '', due, time: '', repeat: 'none', remind: '', priority: 'normal', tags: [], notes: '', subs: [] });
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
  const acc = { id: newId(), name: 'Conta principal', type: 'checking', initialCents: 150000, ...sm }, cash = { id: newId(), name: 'Carteira', type: 'cash', initialCents: 12000, ...sm }, card = { id: newId(), name: 'Cartão', type: 'credit', initialCents: 0, limitCents: 300000, closingDay: 20, dueDay: 28, ...sm };
  S.finance.accounts.push(acc, cash, card);
  const mo = (n, day) => { const ym = shiftMonth(t.slice(0, 7), n); return `${ym}-${pad(day)}`; }, tt = (type, accountId, cents, category, desc, date, paid = true) => ({ id: newId(), type, accountId, cents, category, desc, date, paid, createdAt: Date.now(), ...sm });
  S.finance.tx.push(
    tt('in', acc.id, 320000, 'Salário', 'Salário', mo(0, 5)), tt('out', acc.id, 95000, 'Moradia', 'Aluguel', mo(0, 8)), tt('out', acc.id, 28990, 'Assinaturas', 'Internet', mo(0, 12)),
    tt('out', card.id, 32050, 'Alimentação', 'Mercado', addDays(t, -1)), tt('out', card.id, 8900, 'Lazer', 'Cinema', addDays(t, -3)), tt('out', cash.id, 2500, 'Transporte', 'Ônibus', addDays(t, -2)),
    tt('out', acc.id, 18000, 'Saúde', 'Farmácia', addDays(t, 3), false), tt('in', acc.id, 45000, 'Renda extra', 'Freelance', addDays(t, 6), false),
    tt('in', acc.id, 320000, 'Salário', 'Salário', mo(-1, 5)), tt('out', acc.id, 95000, 'Moradia', 'Aluguel', mo(-1, 8)), tt('out', card.id, 61000, 'Compras', 'Roupas', mo(-1, 14)), tt('out', acc.id, 54000, 'Alimentação', 'Mercado do mês', mo(-1, 20)),
    tt('in', acc.id, 320000, 'Salário', 'Salário', mo(-2, 5)), tt('out', acc.id, 95000, 'Moradia', 'Aluguel', mo(-2, 8)), tt('out', acc.id, 47000, 'Alimentação', 'Mercado do mês', mo(-2, 21)));
  S.finance.budgets = { ...S.finance.budgets, 'Alimentação': { cents: 80000, sample: true }, 'Lazer': { cents: 30000, sample: true } };
  S.finance.goals.push({ id: newId(), name: 'Viagem de férias', targetCents: 400000, savedCents: 120000, deadline: addDays(t, 150), ...sm });
  [-57, -29, -1].forEach((off, i) => { const st0 = addDays(t, off); for (let d = 0; d < (i < 2 ? 5 : 1); d++) { const k = addDays(st0, d); if (k > t) break; S.cycleLog[k] = { flow: d === 0 ? 'medium' : d < 3 ? 'heavy' : 'light', pain: d < 2 ? ['cramp'] : [], mood: d === 0 ? ['sensitive'] : [], energy: d < 2 ? 'low' : '', sample: true }; } });
  Object.assign(S.settings.areas, { water: true, finances: true, cycle: true, habits: true, pomodoro: true });
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
  return JSON.stringify({ app: 'aurora', version: 2, exportedAt: new Date().toISOString(), data: {
    profile: {
      name: s.profile.name.slice(0, 50),
      preferredName: (s.profile.preferredName || s.profile.name).slice(0, 50),
    },
    tasks: S.tasks.map((t) => ({ id: t.id, title: t.title, done: t.done, tag: t.tag, dueDate: t.dueDate, priority: t.priority, groupId: t.groupId, groupTitle: t.groupTitle, doneAt: t.doneAt, createdAt: t.createdAt, repeat: t.repeat, time: t.time, remind: t.remind, subtasks: t.subtasks, tags: t.tags, notes: t.notes, order: t.order, focusSeconds: t.focusSeconds })),
    areas: s.areas, theme: s.theme === 'custom' ? 'rose' : s.theme, weightTracking: s.weightTracking, accountTypes: s.accountTypes, onboardingComplete: s.onboardingComplete, introSeen: s.introSeen },
    extras: { themeFull: s.theme, look: s.look, lists: s.lists, cats: s.cats, water: S.water, gym: S.gym, finance: S.finance, cycle: S.cycle, cycleLog: S.cycleLog, weight: S.weight, habits: S.habits, pomodoroTimer: S.pomodoro, prefs: s.prefs, about: { sex: s.profile.sex, age: s.profile.age, weightKg: s.profile.weightKg, heightCm: s.profile.heightCm } } }, null, 2);
}
async function doExport() {
  if (Object.keys(ui.integrityIssues).length) {
    toast('O backup normal não foi criado para evitar omitir dados locais inválidos. Baixe a cópia de recuperação ou importe um backup confiável.');
    return;
  }
  if (!window.confirm('O arquivo de backup é JSON em texto puro, sem criptografia. Ele pode conter dados financeiros, de saúde e do ciclo. Guarde-o em um local privado. Deseja continuar?')) return;
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
function exportRecoveryData() {
  if (!Persist.rawTables || !Object.keys(Persist.rawTables).length) {
    toast('Não há dados bloqueados disponíveis para exportar.');
    return;
  }
  if (!window.confirm('A cópia de recuperação contém registros relacionais da conta em JSON sem criptografia, inclusive dados de saúde e finanças. Proteja o arquivo e não o compartilhe. Deseja continuar?')) return;
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
  let j; try { j = JSON.parse(text); } catch (e) { throw new Error('O arquivo não é um JSON válido.'); }
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
  const tasks = sourceTasks.map((t) => uniq({ id: t.id, title: t.title.slice(0, 120), done: !!t.done, tag: typeof t.tag === 'string' ? t.tag : 'Pessoal', dueDate: isDay(t.dueDate) ? t.dueDate : null, priority: ['low', 'normal', 'high'].includes(t.priority) ? t.priority : 'normal', ...(t.groupId !== undefined ? { groupId: t.groupId } : {}), ...(t.groupTitle !== undefined ? { groupTitle: t.groupTitle } : {}), ...(t.doneAt !== undefined ? { doneAt: t.doneAt } : {}), createdAt: t.createdAt || Date.now(), ...(REPEATS[t.repeat] && t.repeat !== 'none' ? { repeat: t.repeat } : {}), ...(isTime(t.time) ? { time: t.time } : {}), ...(Number.isFinite(Number(t.remind)) && t.remind !== null && isTime(t.time) ? { remind: Number(t.remind) } : {}), ...(Number.isSafeInteger(t.focusSeconds) && t.focusSeconds >= 0 ? { focusSeconds: t.focusSeconds } : {}), ...(Array.isArray(t.tags) && t.tags.length ? { tags: t.tags.slice(0, 12).map((g) => g.slice(0, 24)) } : {}), ...(typeof t.notes === 'string' && t.notes ? { notes: t.notes.slice(0, 2000) } : {}), ...(Number.isFinite(t.order) ? { order: t.order } : {}), ...(Array.isArray(t.subtasks) && t.subtasks.length ? { subtasks: t.subtasks.slice(0, 40).map((x) => ({ id: x.id || newId(), title: x.title.slice(0, 100), done: !!x.done })) } : {}) }));
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
    accountTypes: d.accountTypes,
    onboardingComplete,
    introSeen: typeof d.introSeen === 'boolean' ? d.introSeen : onboardingComplete,
    prefs: ex.prefs,
  });
  if (settingsResult.invalidCount) throw new Error('As configurações do backup contêm dados inválidos; nada foi importado.');
  const settings = settingsResult.value;
  if (ex.about !== undefined && !isPlainObject(ex.about)) throw new Error('Os dados do perfil no backup estão inválidos.');
  if (ex.about && typeof ex.about === 'object') {
    const a = ex.about;
    if ((a.sex !== undefined && a.sex !== '' && !Object.hasOwn(SEX, a.sex))
      || (a.age !== undefined && a.age !== null && !(Number.isInteger(a.age) && a.age >= 5 && a.age <= 120))
      || (a.weightKg !== undefined && a.weightKg !== null && !(isFiniteValue(a.weightKg) && a.weightKg >= 20 && a.weightKg <= 400))
      || (a.heightCm !== undefined && a.heightCm !== null && !(Number.isInteger(a.heightCm) && a.heightCm >= 80 && a.heightCm <= 250))) throw new Error('Os dados do perfil no backup estão inválidos.');
    Object.assign(settings.profile, { sex: SEX[a.sex] ? a.sex : '', age: Number.isFinite(a.age) ? a.age : null, weightKg: Number.isFinite(a.weightKg) ? a.weightKg : null, heightCm: Number.isFinite(a.heightCm) ? a.heightCm : null });
  }
  settings.prefs.sample = false;
  const pomodoro = validatedBackupSlice('pomodoro', Object.hasOwn(ex, 'pomodoroTimer') ? ex.pomodoroTimer : standaloneTimerReset());
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
function importFile(file) {
  const err = (m) => { const e = $('#imperr'); if (e) e.textContent = m; else toast(m); };
  if (!file) return;
  const fr = new FileReader();
  fr.onerror = () => err('Não consegui ler o arquivo.');
  fr.onload = () => { try { const parsed = parseBackup(String(fr.result)); ui.dlg = null; dlgOpen('import', { parsed }); } catch (e) { err(e.message); } };
  fr.readAsText(file);
}

/* ---- Ações por clique ---- */
const ACTIONS = {
  'footer-scroll-top': () => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      window.scrollTo(0, 0);
      return;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },
  'reload-app': () => {
    const hasUnsavedChanges = settingsDraftDirty()
      || Boolean(ui.profileDraft)
      || Boolean(ui.dlg?.dirty)
      || ui.persistFailed.size > 0;
    if (hasUnsavedChanges && !window.confirm('Há alterações que ainda não foram salvas. Recarregar pode descartá-las. Deseja continuar?')) return;
    window.location.reload();
  },
  'nav-more-toggle': () => { ui.navigationOpen = !ui.navigationOpen; render(); if (ui.toast) renderToast(); },
  'areas-nav-open': () => nav('config?section=areas-navigation'),
  'area-guide-open': (el) => {
    const route = el.dataset.areaGuide;
    if (!AREA_GUIDES[route]) {
      console.error('Aurora: tutorial solicitado para uma área desconhecida.', route);
      toast('Não foi possível abrir o tutorial desta área.');
      return;
    }
    dlgOpen('area-tutorial', { route, automatic: false });
  },
  'discard-settings': () => {
    ui.settingsDraft = null;
    ui.settingsDraftBase = null;
    render();
    toast('Alterações descartadas.');
  },
  'focus-quick-task': () => openTaskDialog(today()),
  'focus-task-title': () => openTaskDialog(),
  'home-quick-focus': () => {
    const input = $('#home-quick-title-input');
    if (!input) return openTaskDialog(today());
    input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => input.focus(), 250);
  },
  'task-new': (el) => openTaskDialog(isDay(el.dataset.due) ? el.dataset.due : ''),
  'toggle': (el) => { const t = findTask(el.dataset.id); if (!t) return; t.done = !t.done; t.doneAt = t.done ? new Date().toISOString() : undefined;
    if (t.done && t.repeat && t.repeat !== 'none' && t.dueDate) {
      let nd = nextDue(t.dueDate, t.repeat), n = 0; while (nd < today() && n++ < 800) nd = nextDue(nd, t.repeat);
      const nx = { ...t, id: newId(), done: false, doneAt: undefined, dueDate: nd, createdAt: Date.now(), subtasks: (t.subtasks || []).map((x) => ({ ...x, done: false })) }; delete nx.sample; S.tasks.push(nx); commit('tasks');
      toast(`Concluída. Próxima: ${shortDate(nd)}.`, () => { t.done = false; t.doneAt = undefined; S.tasks = S.tasks.filter((x) => x.id !== nx.id); commit('tasks'); }); return;
    }
    commit('tasks'); if (t.done) completionFeedback(`.task[data-k="${t.id}"]`); },
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
  'toggle-notifications': (el) => { ui.notificationsOpen = !ui.notificationsOpen; render(); const trigger = document.getElementById(el.id); if (trigger) trigger.focus(); },
  'close-notifications': () => closeNotifications(),
  'accessibility-toggle': () => { ui.accessibilityOpen = !ui.accessibilityOpen; render(); if (ui.toast) renderToast(); $('#accessibility-trigger')?.focus(); },
  'accessibility-close': () => closeAccessibility(),
  'accessibility-font': (el) => {
    const fonts = ['s', 'm', 'l'];
    const current = fonts.indexOf(settingsView().look.font);
    const next = Math.max(0, Math.min(fonts.length - 1, current + Number(el.dataset.step)));
    const focusId = fonts[next] === 's' ? 'accessibility-font-up'
      : fonts[next] === 'l' ? 'accessibility-font-down' : el.id;
    updateAccessibilityLook({ font: fonts[next] }, focusId);
  },
  'accessibility-font-reset': () => updateAccessibilityLook({ font: 'm' }, 'accessibility-font-up'),
  'backup-reminder-dismiss': () => { ui.backupReminderHidden = true; render(); },
  'task-focus': (el) => {
    const task = findTask(el.dataset.id);
    if (!task || task.done || !areaOn('pomodoro')) return;
    const timer = S.pomodoro;
    const hasProgress = timer.startedAt !== null || timer.elapsedSeconds > 0 || timer.completedPomodoros > 0 || phaseElapsedSeconds(timer) > 0;
    if (hasProgress && timer.focusTaskId !== task.id) return toast('Conclua ou descarte o Pomodoro atual antes de trocar de tarefa.');
    if (!hasProgress) {
      activatePomodoroAudio();
      S.pomodoro = { ...standaloneTimerReset(timer), focusTaskId: task.id, focusLabel: task.title, startedAt: Date.now() };
      commit('pomodoro');
      syncPomodoroPushSchedule(S.pomodoro);
    } else if (timer.startedAt === null && timer.phase === 'focus') {
      togglePomodoroTimer();
    }
    nav('pomodoro');
  },
  'accessibility-mode': (el) => { setThemeMode(el.dataset.v); $(`#accessibility-mode-${el.dataset.v}`)?.focus(); },
  'accessibility-more': () => { ui.accessibilityOpen = false; },
  'accessibility-dark': (el) => {
    const look = settingsView().look;
    const isDark = look.mode === 'dark' || (look.mode === 'auto' && systemThemeQuery?.matches);
    updateAccessibilityLook({ mode: isDark ? 'light' : 'dark' }, el.id);
  },
  'accessibility-contrast': (el) => updateAccessibilityLook({ contrast: !settingsView().look.contrast }, el.id),
  'accessibility-readable': (el) => updateAccessibilityLook({ readable: !settingsView().look.readable }, el.id),
  'accessibility-links': (el) => updateAccessibilityLook({ highlightLinks: !settingsView().look.highlightLinks }, el.id),
  'accessibility-spacing': (el) => updateAccessibilityLook({ density: settingsView().look.density === 'comfy' ? 'compact' : 'comfy' }, el.id),
  'accessibility-reset': () => { ui.accessibilityOpen = false; ACTIONS['appearance-reset'](); },
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
  'pomo-pause': (el) => {
    const alert = ui.alerts[el.dataset.k];
    if (!alert || alert.kind !== 'pomodoro') return;
    delete ui.alerts[el.dataset.k];
    togglePomodoroTimer();
  },
  'plan-view': (el) => { if (['lista', 'calendario', 'semana', 'revisao'].includes(el.dataset.v)) ui.planView = el.dataset.v; render(); },
  'weekly-open-overdue': () => { ui.planView = 'lista'; ui.filters.f = 'atrasadas'; nav('planejar'); },
  'home-weekly-review': () => { ui.planView = 'revisao'; nav('planejar'); },
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
      days: [0, 1, 2, 3, 4, 5, 6],
      remind: '',
      weeklyGoal: '',
      icon: idea.icon,
      color: idea.color,
      ...(idea.id === 'water' ? { waterSuggestion: true, waterWeightKg: '', waterGoalMl: null, waterNameEdited: false } : {}),
    });
  },
  'tcal-month': (el) => { ui.taskCal = shiftMonth(ui.taskCal, Number(el.dataset.n)); render(); },
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
    habit.completions = habit.completions.includes(day)
      ? habit.completions.filter((completed) => completed !== day)
      : [...habit.completions, day];
    commit('habits');
    if (completing) completionFeedback(`[data-habit-id="${habit.id}"] .habit-circle`);
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
    habit.skipped = [...skipped].sort();
    commit('habits');
    toast(undoSkip ? 'Pulo removido.' : 'Hoje foi marcado como dia pulado.');
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
    if (habit) dlgOpen('habit-edit', { id: habit.id, name: habit.name, days: [...habit.days], remind: habit.remind || '', weeklyGoal: habit.weeklyGoal || '', icon: habit.icon || DEFAULT_HABIT_ICON, color: habit.color || DEFAULT_HABIT_COLOR });
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
  'edit-task': (el) => { const t = findTask(el.dataset.id); if (t) dlgOpen('task', { tags: [...(t.tags || [])], notes: t.notes || '', id: t.id, title: t.title, due: t.dueDate || '', time: t.time || '', repeat: t.repeat || 'none', remind: t.remind == null ? '' : String(t.remind), subs: (t.subtasks || []).map((x) => ({ ...x })), priority: t.priority }); },
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
  'settings-section': (el, event) => {
    const tab = el.dataset.settingsTab;
    if (!SETTINGS_SECTIONS.some(([id]) => id === tab)) return;
    event.preventDefault();
    ui.settingsTab = tab;
    history.replaceState(null, '', `${location.pathname}${location.search}#config?section=${encodeURIComponent(tab)}`);
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
    if (!HOME_BLOCK_IDS.includes(id) || ![-1, 1].includes(direction)) return;
    const current = settingsView().prefs.homeLayout.order;
    const index = current.indexOf(id), target = index + direction;
    if (index < 0 || target < 0 || target >= current.length) return;
    const order = [...current]; [order[index], order[target]] = [order[target], order[index]];
    updateSettingsDraft((settings) => { settings.prefs.homeLayout.order = order; });
  },
  'retry-habits-template': () => { requestHabitsTemplate(); render(); },
  'set-free-pomodoro-preset': (el) => {
    const preset = el.dataset.preset, timer = S.pomodoro;
    if (!['classic', 'custom'].includes(preset)) return;
    if (timer.startedAt !== null || timer.elapsedSeconds > 0 || timer.completedPomodoros > 0 || phaseElapsedSeconds(timer) > 0) {
      return toast('Conclua ou descarte o Pomodoro atual para trocar o bloco.');
    }
    updateSettingsDraft((settings) => { settings.prefs.pomodoro.preset = preset; });
  },
  'toggle-free-timer': () => togglePomodoroTimer(),
  'skip-free-break': () => skipPomodoroBreak(),
  'finish-free-timer': () => finishPomodoro(),
  'discard-free-timer': () => discardPomodoro(),
  'pomodoro-push-toggle': () => togglePomodoroPush(),
  'preview-pomodoro-sound': () => {
    activatePomodoroAudio();
    playPomodoroSound(settingsView().prefs.pomodoro);
  },
  'filter-inbox': () => { ui.filters.f = 'caixa'; },
  'filter-overdue': () => { ui.filters.f = 'atrasadas'; },
  'plan-open': () => dlgOpen('taskplan', { step: 0, goal: '', steps: '', start: '', spread: false, priority: 'normal', error: '', confirm: false }),
  'enable-area': (el) => { if (setAreaEnabled(S.settings, el.dataset.area, true)) commit('settings'); },
  'clear-sample': () => {
    if (ui.confirmedAction !== 'clear-sample') return requestActionConfirmation('clear-sample', {}, 'Remover dados de exemplo?', 'Somente os registros identificados como exemplos serão removidos. Seus dados pessoais serão mantidos.', 'Remover exemplos');
    clearSample();
  },
  'load-sample': () => { loadSample(); toast('Dados de exemplo adicionados.'); },
  'undo': () => { const u = ui.toast && ui.toast.undo; ui.toast = null; if (u) u(); renderToast(); },
  'action-confirm-cancel': () => dlgClose(),
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
  'plan-keep': () => { ui.dlg.d.confirm = false; render(); },
  'plan-discard': () => { ui.dlg = null; render(); },
  'plan-back': () => { ui.dlg.d.step--; ui.dlg.d.error = ''; render(); },
  'plan-next': () => { const d = ui.dlg.d; if (d.step === 0 && !d.goal.trim()) { d.error = 'Escreva o objetivo para continuar.'; render(); return; } d.error = ''; d.step++; render(); },
  'plan-create': () => {
    const d = ui.dlg.d, titles = planTitles(d), gid = newId(), now = Date.now();
    titles.forEach((title, i) => S.tasks.push(mkTask({ title, priority: d.priority, dueDate: d.start ? (d.spread ? addDays(d.start, i) : d.start) : null, groupId: gid, groupTitle: d.goal.trim().slice(0, 60), createdAt: now + i })));
    ui.dlg = null; commit('tasks'); toast(`${titles.length} ${plural(titles.length, 'tarefa adicionada', 'tarefas adicionadas')}.`);
  },
  'cal-month': (el) => { ui.calMonth = shiftMonth(ui.calMonth, Number(el.dataset.n)); render(); },
  'cyc-day': (el) => { ui.cycDay = el.dataset.d; ui.calMonth = el.dataset.d.slice(0, 7); render(); },
  'cyc-open': () => {
    const day = ui.cycDay && ui.cycDay <= today() ? ui.cycDay : today();
    dlgOpen('cycle-log', { day, log: cycleLogDraft(dayLog(day)) });
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
  'cyc-batch-open': () => {
    const day = ui.cycDay && ui.cycDay <= today() ? ui.cycDay : today();
    dlgOpen('cycle-batch', {
      start: day,
      end: day,
      symptoms: { pain: [], mood: [], digestion: [], skin: [] },
    });
  },
  'cyc-batch-opt': (el) => {
    if (ui.dlg?.type !== 'cycle-batch') return;
    const category = CYC.find(({ id }) => id === el.dataset.category);
    const value = el.dataset.v;
    if (!category || !['pain', 'mood', 'digestion', 'skin'].includes(category.id)
      || !category.opts.some(([option]) => option === value)) return;
    const selected = ui.dlg.d.symptoms[category.id];
    ui.dlg.d.symptoms[category.id] = selected.includes(value)
      ? selected.filter((item) => item !== value)
      : [...selected, value];
    render();
  },
  'cyc-opt': (el) => {
    if (ui.dlg?.type !== 'cycle-log') return;
    const c = CYC.find((x) => x.id === el.dataset.c), v = el.dataset.v, l = ui.dlg.d.log;
    if (!c || !c.opts.some(([value]) => value === v)) return;
    if (c.single) l[c.id] = l[c.id] === v ? '' : v; else { const a = l[c.id] || []; l[c.id] = a.includes(v) ? a.filter((x) => x !== v) : [...a, v]; }
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
  'toggle-acc': (el) => updateSettingsDraft((settings) => {
    const k = el.dataset.v, types = settings.accountTypes;
    settings.accountTypes = types.includes(k) ? types.filter((x) => x !== k) : [...types, k];
  }),
  'export': () => doExport(),
  'recovery-export': () => exportRecoveryData(),
  'persist-retry': () => Persist.retryPending(),
  'legacy-import-discover': () => { void discoverLegacyImport(); },
  'legacy-import-unlock': () => { void unlockLegacyImport(); },
  'legacy-import-apply': () => { void applyLegacyImport(); },
  'legacy-import-clear': () => clearLegacyBrowserData(),
  'copy-export': async () => {
    if (Object.keys(ui.integrityIssues).length) return toast('O backup normal não foi copiado para evitar omitir dados locais inválidos.');
    if (!window.confirm('O backup copiado é JSON em texto puro e pode conter dados financeiros, de saúde e do ciclo. Guarde-o em um local privado. Deseja continuar?')) return;
    const ta = $('#exp');
    try {
      await navigator.clipboard.writeText(ta.value);
      toast('Backup copiado.');
    } catch (error) {
      ta.focus();
      ta.select();
      toast('O backup foi selecionado em texto puro. Copie manualmente e guarde-o em um local privado.');
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
    if (getPomodoroPushStatus().enabled) {
      try {
        await cancelPomodoroPushSchedule();
        await disablePomodoroPush();
      } catch (error) {
        button.disabled = false;
        console.error('Aurora: não foi possível desativar os avisos Push antes de apagar os dados.', error);
        toast(`Não foi possível desativar os avisos Push. Nada foi apagado. ${pomodoroPushErrorMessage(error)}`);
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
    location.hash = 'inicio';
    render();
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
  return true;
}

/* ---- Formulários ---- */
const num = (v) => Number(String(v).replace(',', '.'));
const FORMS = {
  'water-add': (f, d) => {
    const habit = S.habits.find((item) => item.id === f.dataset.id);
    if (!habit || !isWaterHabit(habit) || habit.status !== 'active') {
      return toast('Este hábito de água não está disponível para registro.');
    }
    const amount = parseWaterMl(d.get('amount'));
    if (amount === null) return fieldError('Informe um volume inteiro entre 1 e 10.000 mL.', '[name="amount"]');
    const day = today();
    S.water.push({ id: newId(), ml: amount, at: new Date().toISOString() });
    const target = waterGoalFromName(habit.name, S.settings.prefs.waterGoalMl);
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
  'settings-profile': () => {
    const draft = ui.profileDraft || {
      name: S.settings.profile.name || '',
      preferredName: S.settings.profile.preferredName || S.settings.profile.name || '',
      sex: S.settings.profile.sex || '',
      age: S.settings.profile.age == null ? '' : String(S.settings.profile.age),
    };
    const ageInput = String(draft.age ?? '').trim();
    const age = ageInput ? Number(ageInput) : null;
    if (!draft.name.trim()) { toast('Informe seu nome.'); $('#pname')?.focus(); return; }
    if (!draft.preferredName.trim()) { toast('Informe como prefere ser chamado(a).'); $('#ppreferred')?.focus(); return; }
    if (ageInput && (!Number.isInteger(age) || age < 5 || age > 120)) {
      toast('A idade deve ser um número inteiro entre 5 e 120 anos.');
      $('#page')?.focus();
      return;
    }
    const previousSettings = cloneSettings(S.settings);
    Object.assign(S.settings.profile, {
      name: draft.name.trim().slice(0, 50),
      preferredName: draft.preferredName.trim().slice(0, 50),
      sex: draft.sex,
      age,
    });
    if (!saveSlices('settings')) {
      S.settings = previousSettings;
      render();
      return;
    }
    ui.profileDraft = null;
    render();
    toast('Perfil salvo.');
  },
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
    if (!days.length || days.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) return toast('Selecione pelo menos um dia válido.');
    if (remind && !isTime(remind)) return fieldError('Informe um horário válido para o lembrete.', '[data-dlg="remind"]');
    if (weeklyGoal && (!Number.isInteger(weeklyGoal) || weeklyGoal < 1 || weeklyGoal > days.length)) return toast('A meta semanal não pode passar do número de dias escolhidos.');
    if (S.habits.some((item) => item.id !== draft?.id && norm(item.name) === norm(name))) return fieldError('Você já acompanha um hábito com esse nome.', '[data-dlg="name"]');
    if (draft?.id && !habit) return dlgClose();
    if (habit) {
      Object.assign(habit, { name: name.slice(0, 60), days, ...look, ...(isWaterHabit(habit) || draft?.waterSuggestion ? { tracking: 'water' } : {}) });
      if (remind) habit.remind = remind;
      else delete habit.remind;
      if (weeklyGoal) habit.weeklyGoal = weeklyGoal;
      else delete habit.weeklyGoal;
    } else {
      S.habits.push({ id: newId(), name: name.slice(0, 60), days, completions: [], status: 'active', ...look, ...(draft?.waterSuggestion ? { tracking: 'water' } : {}), ...(remind ? { remind } : {}), ...(weeklyGoal ? { weeklyGoal } : {}) });
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
    if (!title) return toast('Escreva um título.');
    const parsed = parseTags(title), repeat = REPEATS[d.repeat] && d.repeat !== 'none' ? d.repeat : null;
    const time = isTime(d.time) ? d.time : null;
    const remind = time && REMINDS.some(([value]) => value === String(d.remind)) && d.remind !== '' ? Number(d.remind) : null;
    const dueDate = isDay(d.due) ? d.due : (repeat || time) ? today() : null;
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
    ui.dlg = null;
    commit('tasks');
  },
  'cycle-log': () => {
    const { day, log: draft } = ui.dlg.d;
    if (!isDay(day) || day > today() || !isValidCycleLog(draft)) return toast('Revise o registro do ciclo.');
    const log = cycleLogDraft(draft);
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
  'legacy-import-cleanup-confirm': (el) => {
    ui.legacyImport.cleanupConfirmed = el.checked;
    const button = $('#legacy-import-clear');
    if (button) button.disabled = !el.checked || ui.legacyImport.busy;
  },
  'sort': (el) => { ui.filters.sort = el.value; render(); },
  'pomo-label': (el) => { const v = el.value.trim().slice(0, 40); if (v) S.pomodoro.focusLabel = v; else delete S.pomodoro.focusLabel; commit('pomodoro'); },
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
    });
  },
  'look-custom': (el) => { if (hexOk(el.value)) updateSettingsDraft((settings) => { settings.look.custom = el.value; settings.theme = 'custom'; }); },
  'look-contrast': (el) => updateSettingsDraft((settings) => { settings.look.contrast = el.checked; }),
  'look-readable': (el) => updateSettingsDraft((settings) => { settings.look.readable = el.checked; }),
  'look-highlight-links': (el) => updateSettingsDraft((settings) => { settings.look.highlightLinks = el.checked; }),
  'look-motion': (el) => updateSettingsDraft((settings) => { settings.look.reduceMotion = el.checked; }),
  'free-pomo-focus': (el) => {
    const timer = S.pomodoro;
    if (timer.startedAt !== null || timer.elapsedSeconds > 0 || timer.completedPomodoros > 0 || phaseElapsedSeconds(timer) > 0) {
      return toast('Conclua ou descarte o Pomodoro atual para editar os tempos.');
    }
    updateSettingsDraft((settings) => {
      settings.prefs.pomodoro.focusMin = clamp(Math.round(num(el.value)) || 25, 5, 120);
      settings.prefs.pomodoro.preset = 'custom';
    }, false);
  },
  'free-pomo-auto': (el) => {
    const timer = S.pomodoro;
    if (timer.startedAt !== null || timer.elapsedSeconds > 0 || timer.completedPomodoros > 0 || phaseElapsedSeconds(timer) > 0) {
      el.checked = !el.checked;
      return toast('Conclua ou descarte o Pomodoro atual para alterar o avanço.');
    }
    updateSettingsDraft((settings) => {
      settings.prefs.pomodoro.autoAdvance = el.checked;
      settings.prefs.pomodoro.preset = 'custom';
    }, false);
  },
  'free-pomo-break': (el) => {
    const timer = S.pomodoro;
    if (timer.startedAt !== null || timer.elapsedSeconds > 0 || timer.completedPomodoros > 0 || phaseElapsedSeconds(timer) > 0) {
      return toast('Conclua ou descarte o Pomodoro atual para editar os tempos.');
    }
    updateSettingsDraft((settings) => {
      settings.prefs.pomodoro.breakMin = clamp(Math.round(num(el.value)) || 5, 1, 60);
      settings.prefs.pomodoro.preset = 'custom';
    }, false);
  },
  'free-pomo-sound-tone': (el) => {
    if (!Object.hasOwn(POMODORO_SOUND_TONES, el.value)) return;
    updateSettingsDraft((settings) => { settings.prefs.pomodoro.soundTone = el.value; }, false);
  },
  'free-pomo-sound-volume': (el) => {
    const soundVolume = clamp(Math.round(num(el.value)), 0, 100);
    updateSettingsDraft((settings) => { settings.prefs.pomodoro.soundVolume = soundVolume; }, false);
    const output = el.closest('label')?.querySelector('output');
    if (output) output.textContent = `${soundVolume}%`;
  },
  'import': (el) => { const f = el.files && el.files[0]; importFile(f); el.value = ''; },
};
const SETTINGS_INPUT_CHANGES = new Set(['free-pomo-focus', 'free-pomo-break', 'free-pomo-sound-volume']);

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
  const now = Date.now(); let changed = false, added = 0;
  S.tasks.forEach((t) => {
    if (t.done || !t.dueDate || !t.time || t.remind == null) return;
    const due = new Date(`${t.dueDate}T${t.time}:00`).getTime(), fire = due - Number(t.remind) * 60000, key = `${t.id}|${t.dueDate}|${t.time}|${t.remind}`;
    if (now >= fire && now <= due + 2 * 3600000 && !ui.fired[key] && now >= (ui.snooze[key] || 0)) { ui.fired[key] = true; ui.alerts[key] = { id: t.id, title: t.title, time: t.time, due, at: now }; changed = true; added += 1; }
  });
  const day = today();
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
  Object.keys(ui.alerts).forEach((k) => {
    const alert = ui.alerts[k];
    if (alert.kind === 'pomodoro') return;
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
      const announcer = $('#notification-announcer');
      if (announcer) announcer.textContent = added === 1
        ? 'Novo lembrete disponível. Abra Notificações para conferir.'
        : `${added} novos lembretes disponíveis. Abra Notificações para conferir.`;
    }
  }
}
function notifyPomodoroPhase(phase, timer = S.pomodoro) {
  playPomodoroSound();
  clearPomodoroNotifications();
  const pom = pomodoroSettingsForTimer();
  const key = `pomodoro:${timer.completedPomodoros}:${phase}`;
  const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const alert = phase === 'focus'
    ? { title: 'Hora de voltar ao foco', detail: `A pausa acabou. O próximo bloco de foco dura ${pom.focusMin} min.` }
    : { title: 'Hora da pausa', detail: `Bloco de foco concluído. Descanse por ${pom.breakMin} min.` };
  ui.alerts[key] = { kind: 'pomodoro', phase, ...alert, time, at: Date.now() };
}
function syncPomodoroTimer(now = Date.now()) {
  const advanced = advancePomodoro(S.pomodoro, pomodoroSettingsForTimer(), now);
  if (!advanced.transitions.length) return false;
  S.pomodoro = advanced.timer;
  if (pomodoroSettingsForTimer().autoAdvance === false) {
    S.pomodoro = { ...advanced.timer, startedAt: null, phaseElapsedSeconds: 0 };
  }
  notifyPomodoroPhase(advanced.transitions[advanced.transitions.length - 1], advanced.timer);
  commit('pomodoro');
  const pomodoroAlert = Object.values(ui.alerts).find((alert) => alert.kind === 'pomodoro');
  const announcer = $('#notification-announcer');
  if (pomodoroAlert && announcer) announcer.textContent = `${pomodoroAlert.title}. ${pomodoroAlert.detail} Abra Notificações para conferir.`;
  syncPomodoroPushSchedule(S.pomodoro);
  return true;
}
function tick() {
  if (Persist.replacing) return;
  if (tickN++ % 10 === 0) checkReminders();
  if (syncPomodoroTimer()) return;
  if (dk() !== lastDay) { lastDay = dk(); render(); return; }
  const now = Date.now();
  const timer = S.pomodoro, pom = pomodoroSettingsForTimer();
  const elapsed = phaseElapsedSeconds(timer, now), duration = phaseDurationSeconds(pom, timer.phase);
  const clockElement = $('#standalone-pomo-clock');
  if (!clockElement) return;
  clockElement.textContent = clock(Math.max(0, duration - elapsed));
  const copy = $('#standalone-pomo-copy'), dial = $('#standalone-pomo-progress');
  const hasProgress = timer.elapsedSeconds > 0 || timer.completedPomodoros > 0 || elapsed > 0;
  if (copy) copy.textContent = timerPhaseMessage(timer.phase, pom);
  const state = $('#standalone-pomo-state');
  if (state) state.textContent = standalonePomodoroPhaseLabel(timer.phase, timer.startedAt !== null, hasProgress);
  if (dial) {
    dial.style.strokeDashoffset = `${(2 * Math.PI * 50 * (1 - Math.min(1, elapsed / duration))).toFixed(1)}`;
    dial.closest('.focus-timer')?.setAttribute('data-phase', timer.phase);
  }
}

/* ---- Eventos globais ---- */
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  syncPomodoroTimer();
  if (ui.route === 'pomodoro') render();
});
window.addEventListener('pageshow', () => {
  syncPomodoroTimer();
});
document.addEventListener('keydown', (event) => {
  if (ui.route !== 'pomodoro' || event.ctrlKey || event.metaKey || event.altKey) return;
  const target = event.target;
  if (target instanceof Element && target.closest('input, textarea, select, button, a, summary, [contenteditable="true"], [role="button"]')) return;
  if (event.code === 'Space') {
    event.preventDefault();
    togglePomodoroTimer();
  } else if (event.key.toLowerCase() === 's') {
    event.preventDefault();
    skipPomodoroBreak();
  }
});
const taskPlanDirty = () => ui.dlg.type === 'taskplan' && !ui.dlg.d.confirm && (ui.dlg.d.goal.trim() || ui.dlg.d.steps.trim());
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
  if (!ui.navigationOpen || !(target instanceof Element) || target.closest('#nav-more-menu, .nav-more-trigger')) return;
  ui.navigationOpen = false;
  render();
});
document.addEventListener('click', (e) => {
  const target = e.target;
  if (!ui.notificationsOpen || !(target instanceof Element) || target.closest('#notification-panel, .notification-trigger')) return;
  setTimeout(() => {
    if (ui.notificationsOpen) closeNotifications(false);
  }, 0);
});
document.addEventListener('click', (e) => {
  const target = e.target;
  if (!ui.accessibilityOpen || !(target instanceof Element) || target.closest('.accessibility-control')) return;
  ui.accessibilityOpen = false;
  const panel = $('#accessibility-panel');
  const trigger = $('#accessibility-trigger');
  if (panel) panel.hidden = true;
  if (trigger) trigger.setAttribute('aria-expanded', 'false');
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
    const draft = {
      name: $('#pname')?.value || '',
      preferredName: $('#ppreferred')?.value || '',
      sex: $('#psex')?.value || '',
      age: $('#page')?.value || '',
    };
    ui.profileDraft = profileDraftHasChanges(draft, S.settings.profile) ? draft : null;
    const saveButton = $('#profile-settings-form [type="submit"]');
    if (saveButton) saveButton.disabled = !ui.profileDraft;
    const previewName = $('#profile-preview-name');
    if (previewName) previewName.textContent = draft.preferredName.trim() || draft.name.trim() || 'seu nome';
  }
  if (el.dataset.dlg && ui.dlg) {
    if (ui.dlg.type === 'habit-edit' && ui.dlg.d.waterSuggestion && el.dataset.dlg === 'name') {
      ui.dlg.d.waterNameEdited = true;
    }
    setPath(ui.dlg.d, el.dataset.dlg, el.type === 'checkbox' ? el.checked : el.value);
    if (ui.dlg.type === 'habit-edit' && ui.dlg.d.waterSuggestion && el.dataset.dlg === 'waterWeightKg') {
      updateWaterSuggestionWeight(el.value);
    } else if (ui.dlg.type === 'search' && el.dataset.dlg === 'query') {
      const results = $('#global-search-results');
      if (results) results.innerHTML = globalSearchResults(el.value).s;
    } else if (ui.dlg.type === 'cycle-log' && el.dataset.dlg === 'log.sexualActivity') {
      if (!el.checked) ui.dlg.d.log.contraceptionMethods = [];
      render();
    } else if (['sex', 'accountId', 'repeat', 'type', 'tag', 'category', 'time', 'invert', 'paid'].includes(el.dataset.dlg) || el.dataset.dlg.startsWith('rows.')) {
      if (ui.dlg.type === 'impfin' && (el.dataset.dlg === 'accountId' || el.dataset.dlg === 'invert')) impRecalc(ui.dlg.d, el.dataset.dlg === 'invert');
      render();
    }
  }
  if (el.dataset.input === 'fin-search') { ui.finQ = el.value; const r = $('#tx-results'); if (r) r.innerHTML = txListHtml().s; }
  if (el.dataset.input === 'search') { ui.filters.q = el.value; const r = $('#task-results'); if (r) r.innerHTML = taskListHtml().s; }
});
document.addEventListener('change', (e) => {
  const el = e.target, key = el.dataset && el.dataset.change;
  if (ui.dlg && ui.dlg.type !== 'search' && el instanceof Element && el.closest('#dlg') && el.matches('input:not([type="file"]),textarea,select')) ui.dlg.dirty = true;
  if (el.dataset && el.dataset.dlg === 'bank' && ui.dlg) setPath(ui.dlg.d, 'bank', el.value);
  const fn = key && !SETTINGS_INPUT_CHANGES.has(key) && CHANGES[key]; if (fn) fn(el);
});
document.addEventListener('toggle', (e) => { const el = e.target; if (el.tagName === 'DETAILS' && el.id) { ui.openDetails[el.id.replace('d-', '')] = el.open; if (el.open) el.querySelectorAll('.habit-year-grid').forEach((grid) => { grid.scrollLeft = grid.scrollWidth; }); } }, true);
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    if (ui.dlg?.type === 'onboard') return;
    e.preventDefault();
    dlgOpen('search', { query: '' });
    return;
  }
  if (e.key === 'Escape' && ui.accessibilityOpen) { e.preventDefault(); closeAccessibility(); return; }
  if (e.key === 'Escape' && ui.notificationsOpen) { e.preventDefault(); closeNotifications(); return; }
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
  if (e.target.id === 'dlg' && ui.dlg && ui.dlg.type !== 'onboard') dlgClose();
});


/* ========== Finanças (contas, cartões, lançamentos, orçamento, relatórios) ========== */
const FINANCE_TONES = [
  'var(--accent)',
  'color-mix(in srgb, var(--accent) 78%, var(--p))',
  'color-mix(in srgb, var(--accent) 62%, var(--pd))',
  'color-mix(in srgb, var(--accent) 46%, var(--ink))',
  'color-mix(in srgb, var(--accent) 66%, var(--surface))',
];
const financeTone = (name = '') => [...String(name)].reduce((total, char) => total + char.charCodeAt(0), 0) % FINANCE_TONES.length;
const catMeta = (t) => {
  if (t.type === 'tr') return { c: 'color-mix(in srgb, var(--accent) 38%, var(--muted))', i: 'transfer' };
  const meta = catInfo(t.type === 'in' ? 'in' : 'out', t.category);
  return { ...meta, c: FINANCE_TONES[financeTone(t.category)] };
};
const outMeta = (n) => catInfo('out', n);
const ACC_ICON = { checking: 'bank', savings: 'trendUp', cash: 'wallet', credit: 'card' };
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
const accName = (id) => { const account = accById(id); return account ? accountDisplayName(account) : 'Conta removida'; };
const shiftMonth = (ym, n) => { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
const ymLabel = (ym) => { const [y, m] = ym.split('-').map(Number); return `${MESES_L[m - 1]} de ${y}`; };
const addMonths = (k, n) => { const d = pk(k), day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + n); d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate())); return dk(d); };
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
  const canToggle = !tr && !isCredit(acc);
  return h`<li class="fr ${paid ? '' : 'pend'}" data-k="${t.id}">
    <button class="fr-main" data-action="edit-tx" data-id="${t.id}" aria-label="Editar ${t.type === 'out' ? 'despesa' : t.type === 'in' ? 'receita' : 'transferência'} de ${brl(t.cents)}: ${title}">${catChip(meta)}
      <span class="grow"><span class="ttl ${t.type === 'out' ? 'expense-name' : ''}">${title}</span><span class="meta2">${showDate ? h`<span class="tx-date">${t.date === today() ? 'Hoje' : shortDate(t.date)}</span> · ` : ''}${sub}${paid && t.settledDate && t.settledDate !== t.date ? h` · ${t.type === 'in' ? 'recebido' : 'pago'} em ${shortDate(t.settledDate)}` : ''}${!paid ? h` · <span class="m-warn">${t.type === 'in' ? 'A receber' : 'A pagar'}${t.date < today() ? ' · atrasado' : ''}</span>` : ''}</span></span>
      <span class="amt ${t.type}">${t.type === 'in' ? '+' : t.type === 'out' ? '−' : ''}${money(t.cents)}</span></button>
    ${canToggle ? h`<button class="pk ${paid ? 'on' : ''}" role="switch" aria-checked="${paid ? 'true' : 'false'}" data-action="tx-paid" data-id="${t.id}" aria-label="${t.type === 'in' ? 'Marcar como recebido' : 'Marcar como pago'}: ${title}" title="${paid ? (t.type === 'in' ? 'Recebido' : 'Pago') : (t.type === 'in' ? 'Marcar como recebido' : 'Marcar como pago')}">${icon('check', 16)}</button>` : h`<span class="pk-sp"></span>`}
  </li>`;
}
const monthNav = () => h`<div class="mnav"><button class="ibtn" data-action="fin-month" data-n="-1" aria-label="Mês anterior">${icon('chevLeft', 20)}</button><button class="mlabel" data-action="fin-month" data-n="0" aria-label="Voltar para o mês atual">${cap(ymLabel(ui.finMonth))}</button><button class="ibtn" data-action="fin-month" data-n="1" aria-label="Próximo mês">${icon('chevRight', 20)}</button></div>`;
const FIN_TABS = [['resumo', 'Resumo', 'home'], ['lancamentos', 'Lançamentos', 'list'], ['contas', 'Contas', 'bank'], ['orcamento', 'Orçamento', 'target'], ['relatorios', 'Relatórios', 'pie']];
const finSectionPicker = () => {
  const [key] = FIN_TABS.find(([id]) => id === ui.finTab) || FIN_TABS[0];
  return h`<div class="fin-section-menu" role="group" aria-label="Seções de Finanças">${FIN_TABS.map(([id, name, sectionIcon]) => h`<button type="button" class="fin-section-option ${id === key ? 'is-active' : ''}" data-action="fin-tab" data-t="${id}" aria-pressed="${id === key}">${icon(sectionIcon, 18)}${tabLabel(name)}</button>`)}</div>`;
};
const fab = () => S.finance.accounts.length ? h`<button class="fab finance-fab" data-action="tx-new">${icon('plus', 20)}<span>Lançamento</span></button>` : '';

/* ---- Resumo ---- */
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
  return h`<section class="card"><div class="head"><h2>Ritmo do mês<i>.</i></h2></div>
    <div class="stats3"><div><b>${money(avg)}</b><span>Gasto médio por dia até ${day}</span></div>${proj !== null ? h`<div><b>${money(proj)}</b><span>Projeção com base nos dias decorridos</span></div>` : h`<div><b>${money(out)}</b><span>Despesas até o fim do mês</span></div>`}<div><b class="${delta !== null && delta > 0 ? 'err' : ''}">${delta === null ? '—' : (delta > 0 ? '+' : '') + delta + '%'}</b><span>vs. mesmo período anterior</span></div></div>
    <p class="small muted">${rate !== null ? (rate >= 0 ? `Você está guardando ${rate}% da receita deste mês.` : `As despesas passaram a receita em ${Math.abs(rate)}%.`) : 'Sem receitas registradas neste mês.'}${top ? h` Maior gasto: <span class="expense-name">${expenseTitle(top[0])}</span> (${money(top[1])}).` : ''}</p></section>`;
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
  const forecast = bal + st.inPending - st.outPending;
  const result = st.inAll - st.outAll;
  const pend = st.tx.filter((t) => !isPaid(t)).sort((a, b) => a.date.localeCompare(b.date));
  const cats = byCategory(st.tx, 'out'), totOut = st.outAll;
  const cards = F.accounts.filter(isCredit);
  const recents = [...F.tx].sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 5);
  const bud = Object.entries(F.budgets).filter(([, b]) => b && b.cents > 0), budSpent = bud.reduce((s, [c]) => s + (cats.find(([n]) => n === c)?.[1] || 0), 0), budTot = bud.reduce((s, [, b]) => s + b.cents, 0);
  return h`${monthNav()}
    <section class="fin-hero" aria-label="Resumo financeiro"><div class="fin-hero-top"><div><p class="fh-l">Saldo atual das contas</p><p class="fh-v ${bal < 0 ? 'neg' : ''}">${money(bal)}</p><p class="fh-context">Saldo real, sem incluir compras no cartão.</p></div><div class="fin-hero-actions"><button class="btn sm" data-action="tx-new-in">${icon('plus', 16)}Receita</button><button class="btn sm primary" data-action="tx-new">${icon('plus', 16)}Despesa</button></div></div>${balanceSparkline()}
      <p class="fh-s">${cur ? h`Estimativa até o fim do mês, considerando lançamentos pendentes: <b>${money(forecast)}</b>` : h`${cap(ymLabel(ym))}`}</p>
      <div class="fh-row"><div class="finance-summary-stat is-income"><span>Receitas lançadas</span><b>${money(st.inAll)}</b><small>${money(st.inPaid)} recebidas</small></div><div class="finance-summary-stat is-expense"><span>Despesas lançadas</span><b>${money(st.outAll)}</b><small>${money(st.outPaid)} pagas · ${money(st.outPending)} pendentes · ${money(st.cardOut)} no cartão</small></div><div class="finance-summary-stat is-result${result < 0 ? ' is-negative' : ''}"><span>Resultado</span><b>${money(result)}</b><small>no mês</small></div></div></section>
    ${finRitmo(ym, st, cur)}
    <div class="fin-overview-grid"><div class="fin-overview-primary">${pend.length ? h`<section class="card finance-attention"><div class="head"><div><p class="section-kicker">Próximos compromissos</p><h2>A pagar e a receber<i>.</i></h2></div><button class="btn ghost sm" data-action="fin-go" data-t="lancamentos" data-f="pendentes">Ver todos</button></div><ul class="list">${pend.slice(0, 5).map(finRow)}</ul></section>` : ''}
      <section class="card"><div class="head"><div><p class="section-kicker">Composição do mês</p><h2>Despesas por categoria<i>.</i></h2></div><button class="btn ghost sm" data-action="fin-go" data-t="relatorios">Relatórios</button></div>
        ${cats.length ? categoryBars(cats, totOut) : empty('Sem despesas neste mês', 'Registre uma despesa para ver a divisão por categoria.', h`<button class="btn" data-action="tx-new">${icon('plus', 16)}Registrar despesa</button>`, 'pie')}</section></div>
      ${(bud.length || cards.length) ? h`<aside class="fin-overview-side">${bud.length ? h`<section class="card"><div class="head"><h2>Orçamento<i>.</i></h2><button class="btn ghost sm" data-action="fin-go" data-t="orcamento">Detalhes</button></div>${budBar(budSpent, budTot)}<p class="small muted">${money(budSpent)} de ${money(budTot)} nas categorias com limite</p></section>` : ''}
        ${cards.length ? h`<section class="card"><div class="head"><h2>Cartões<i>.</i></h2><button class="btn ghost sm" data-action="fin-go" data-t="contas">Ver cartões</button></div><ul class="list">${cards.map((c) => { const i = cardInfo(c); return h`<li>${catChip({ c: '#7c8fd4', i: 'card' })}<div class="grow"><div class="ttl">${accountDisplayName(c)}</div><span class="small muted">Compras no ciclo ${MESES_L[Number(i.ym.slice(5)) - 1]}${i.due ? ' · vence ' + shortDate(i.due) : ''}</span>${cardDueLabel(i.due)}</div><b>${money(i.total)}</b></li>`; })}</ul><p class="fine">Confira o valor e a data diretamente na fatura do banco.</p></section>` : ''}</aside>` : ''}</div>
    ${finFixas()}
    <section class="card finance-recent"><div class="head"><div><h2>Últimos lançamentos<i>.</i></h2><p class="small muted">Os mais recentes, com data e situação.</p></div><button class="btn ghost sm" data-action="fin-go" data-t="lancamentos">Ver todos</button></div>${recents.length ? h`<ul class="list">${recents.map((t) => finRow(t, { showDate: true }))}</ul>` : empty('Nada por aqui ainda', 'Toque em Lançamento para registrar o primeiro.', h`<button class="btn" data-action="tx-new">${icon('plus', 16)}Registrar lançamento</button>`, 'list')}</section>`;
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
    return !q || norm(t.desc || '').includes(q) || norm(t.category || '').includes(q);
  }).sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0));
}
function txListHtml() {
  const r = filteredTx();
  if (!r.length) {
    const filtered = !!(ui.finQ || ui.finAcc || ui.finFilter !== 'todos');
    return empty(
      'Nenhum lançamento aqui',
      filtered ? 'Troque os filtros para ver mais.' : 'Toque em Lançamento para registrar o primeiro deste mês.',
      filtered ? '' : h`<button class="btn" data-action="tx-new">${icon('plus', 16)}Registrar lançamento</button>`,
      filtered ? 'search' : 'list',
    );
  }
  const days = []; r.forEach((t) => { const l = days[days.length - 1]; if (l && l.d === t.date) l.items.push(t); else days.push({ d: t.date, items: [t] }); });
  return raw('<div style="display:flex;flex-direction:column;gap:14px">' + days.map((g) => { const net = g.items.reduce((s, t) => s + (t.type === 'in' ? t.cents : t.type === 'out' ? -t.cents : 0), 0); return h`<section class="grp"><h3 class="gh">${g.d === today() ? 'Hoje' : cap(longDate(g.d))}<span class="grow"></span><span class="gsum">${net ? h`${net > 0 ? '+' : '−'}${money(Math.abs(net))}` : ''}</span></h3><ul class="list">${g.items.map(finRow)}</ul></section>`.s; }).join('') + '</div>');
}
function finLanc() { return ui.finView === 'cal' ? h`${monthNav()}${finTools()}${finCal()}` : finLancList(); }
function finLancList() {
  const st = monthStats(ui.finMonth);
  return h`${monthNav()}${finTools()}
    <section class="card"><div class="scroll-x" role="group" aria-label="Filtrar lançamentos">${FIN_FILTERS.map(([k, l]) => h`<button class="chip" aria-pressed="${ui.finFilter === k}" data-action="fin-filter" data-f="${k}">${l}</button>`)}</div>
      <div class="row fin-filter-row"><label class="search"><span class="sr">Buscar lançamentos</span>${icon('search', 18)}<input type="search" id="fq" data-keep value="${ui.finQ}" placeholder="Buscar" data-input="fin-search"></label>
        <label style="flex:0 0 130px"><span class="sr">Filtrar por categoria</span><select data-change="fin-cat"><option value="">Categorias</option>${[...new Set([...catNames('out'), ...catNames('in')])].map((c) => h`<option class="expense-name" value="${c}" ${ui.finCat === c ? raw('selected') : ''}>${expenseTitle(c)}</option>`)}</select></label>
        <label style="flex:0 0 130px"><span class="sr">Filtrar por conta</span><select data-change="fin-acc"><option value="">Todas as contas</option>${S.finance.accounts.map((a) => h`<option class="user-value" value="${a.id}" ${ui.finAcc === a.id ? raw('selected') : ''}>${accountDisplayName(a)}</option>`)}</select></label></div>
      <p class="small muted">Receitas <b style="color:var(--ok)">${money(st.inAll)}</b> · Despesas <b>${money(st.outAll)}</b></p>
      <div class="row" style="justify-content:space-between"><button class="btn ghost sm" data-action="fin-csv">${icon('download', 16)}Exportar <span class="case-preserve">CSV</span></button></div>
      <div id="tx-results">${txListHtml()}</div></section>`;
}

/* ---- Contas e cartões ---- */
function financeAccountTypeSettings() {
  const settings = settingsView();
  return h`<form class="card finance-account-type-settings" data-form="settings-save" aria-labelledby="finance-account-types-title">
    <div class="settings-section-heading"><h2 id="finance-account-types-title">Tipos de conta<i>.</i></h2><p>Escolha os tipos disponíveis ao cadastrar contas e cartões. Os registros existentes não serão alterados.</p></div>
    <div class="chips" role="group" aria-label="Tipos de conta disponíveis">${Object.entries(ACCOUNT_TYPES).map(([key, label]) => h`<button type="button" class="chip" aria-pressed="${settings.accountTypes.includes(key)}" data-action="toggle-acc" data-v="${key}">${label}</button>`)}</div>
    ${settingsSaveButton()}
  </form>`;
}
function finContas() {
  const F = S.finance, accs = F.accounts.filter((a) => !isCredit(a)), cards = F.accounts.filter(isCredit);
  const debt = cards.reduce((s, c) => s + cardInfo(c).used, 0);
  return h`<section class="card flat"><div class="row" style="justify-content:space-between"><div><p class="small muted">Saldo das contas (sem cartões)</p><p class="fh-v ${netBalance() < 0 ? 'neg' : ''}">${money(netBalance())}</p></div>${cards.length ? h`<div style="text-align:right"><p class="small muted">Dívida nos cartões</p><b>${money(debt)}</b></div>` : ''}</div></section>
    <div class="head"><h2>Contas<i>.</i></h2><button class="btn sm" data-action="acct-new">${icon('plus', 16)}Nova conta</button></div>
    ${financeAccountTypeSettings()}
    ${accs.length ? h`<ul class="cards">${accs.map((a) => { const balance = accBalance(a), bankName = a.bank === OTHER_BANK ? 'outro banco / não listado' : Object.hasOwn(BANKS, a.bank) ? BANKS[a.bank].name : a.bank, name = accountDisplayName(a); return h`<li><button class="acc" data-action="acct-edit" data-id="${a.id}" aria-label="Editar conta ${name}${bankName ? ', ' + bankName : ''}, ${balance < 0 ? 'saldo negativo de ' + brl(Math.abs(balance)) : 'saldo ' + brl(balance)}">${accountChip(a)}<span class="grow"><span class="ttl">${name}</span><span class="small muted">${ACCOUNT_TYPES[a.type] || a.type}${bankName ? h` · <span class="user-value">${bankName}</span>` : ''}</span></span><b class="${balance < 0 ? 'neg' : ''}">${money(balance)}</b></button></li>`; })}</ul>` : h`<div class="card">${empty('Nenhuma conta ainda', 'Cadastre uma conta, a carteira ou a poupança. O Aurora não se conecta a bancos: tudo é digitado por você.', h`<button class="btn primary" data-action="acct-new">Criar conta</button>`, 'wallet')}</div>`}
    ${cards.length ? h`<div class="head"><h2>Cartões de crédito<i>.</i></h2></div><ul class="cards">${cards.map((c) => { const i = cardInfo(c), pc = c.limitCents ? Math.min(100, Math.round(i.used / c.limitCents * 100)) : 0, bankName = c.bank === OTHER_BANK ? 'outro banco / não listado' : Object.hasOwn(BANKS, c.bank) ? BANKS[c.bank].name : c.bank, name = accountDisplayName(c); return h`<li class="cc"><div class="cc-top">${c.bank ? accountChip(c) : catChip({ c: '#7c8fd4', i: 'card' })}<span class="grow"><span class="ttl">${name}</span><span class="small muted">${bankName ? h`<span class="user-value">${bankName}</span> · ` : ''}${c.closingDay ? 'Fecha dia ' + c.closingDay : ''}${c.dueDay ? ' · vence dia ' + c.dueDay : ''}</span>${cardDueLabel(i.due)}</span><button class="ibtn" data-action="acct-edit" data-id="${c.id}" aria-label="Editar cartão ${name}${bankName ? ', ' + bankName : ''}">${icon('pencil', 18)}</button></div>
        <div class="cc-inv"><span class="small muted">Compras no ciclo ${MESES_L[Number(i.ym.slice(5)) - 1]}${i.due ? ' · vence ' + shortDate(i.due) : ''}</span><b class="cc-v">${money(i.total)}</b></div>
        ${c.limitCents ? h`<div class="bar ${pc >= 100 ? 'over' : pc >= 80 ? 'near' : ''}" role="progressbar" aria-valuenow="${pc}" aria-valuemin="0" aria-valuemax="100" aria-label="Limite usado"><span style="width:${pc}%"></span></div><p class="small muted">Usado ${money(i.used)} de ${money(c.limitCents)} · disponível ${money(i.avail)}</p>` : ''}
        <button class="btn sm" data-action="pay-inv" data-id="${c.id}" ${i.used > 0 && accs.length ? '' : raw('disabled')}>Pagar fatura</button></li>`; })}</ul>` : ''}`;
}

/* ---- Orçamento e objetivos ---- */
function finOrc() {
  const F = S.finance, ym = ui.finMonth, st = monthStats(ym), spent = Object.fromEntries(byCategory(st.tx, 'out'));
  const names = [...new Set([...catNames('out'), ...Object.keys(spent), ...Object.keys(F.budgets)])].filter((n) => n !== 'Estudos' || spent[n] || F.budgets[n]);
  const rows = names.map((n) => ({ n, sp: spent[n] || 0, lim: (F.budgets[n] || {}).cents || 0 })).sort((a, b) => (b.lim > 0) - (a.lim > 0) || b.sp - a.sp);
  const limited = rows.filter((r) => r.lim > 0), tl = limited.reduce((s, r) => s + r.lim, 0), ts = limited.reduce((s, r) => s + r.sp, 0);
  return h`${monthNav()}
    <section class="card"><div class="head"><h2>Limites do mês<i>.</i></h2><button class="btn ghost sm" data-action="category-manager">Gerenciar categorias</button></div>
      ${limited.length ? h`<div><div class="row" style="justify-content:space-between"><b>${money(ts)}</b><span class="small muted">de ${money(tl)}</span></div>${budBar(ts, tl)}<p class="small ${ts > tl ? 'err' : 'muted'}" style="margin-top:6px">${ts > tl ? h`Passou ${money(ts - tl)} do limite total.` : h`Restam ${money(tl - ts)} nas categorias com limite.`}</p></div>` : h`<p class="small muted">Defina um limite mensal para as categorias em que quer controlar os gastos. Toque em uma categoria abaixo.</p>`}
      <ul class="list budget-list">${rows.map((r) => { const m = outMeta(r.n), over = r.lim && r.sp > r.lim; return h`<li><button class="fr-main" data-action="budget-edit" data-c="${r.n}" aria-label="Definir limite de ${r.n}">${catChip(m)}<span class="grow"><span class="ttl expense-name">${expenseTitle(r.n)}</span>${r.lim ? h`<span class="meta2">${money(r.sp)} de ${money(r.lim)}${over ? h` · <span class="m-bad">acima em ${money(r.sp - r.lim)}</span>` : h` · restam ${money(r.lim - r.sp)}`}</span>${budBar(r.sp, r.lim)}` : h`<span class="meta2">${r.sp ? h`${money(r.sp)} gastos · ` : ''}sem limite</span>`}</span>${icon('chevRight', 16)}</button></li>`; })}</ul></section>
    <section class="card"><div class="head"><h2>Objetivos<i>.</i></h2><button class="btn sm" data-action="goal-new">${icon('plus', 16)}Novo objetivo</button></div>
      ${F.goals.length ? h`<ul class="list">${F.goals.map((g) => { const pc = g.targetCents ? Math.min(100, Math.round(g.savedCents / g.targetCents * 100)) : 0; return h`<li style="align-items:flex-start"><div class="grow"><div class="ttl">${g.name}${g.sample ? h` <span class="badge">Exemplo</span>` : ''}</div><div class="bar" role="progressbar" aria-valuenow="${pc}" aria-valuemin="0" aria-valuemax="100" aria-label="Progresso de ${g.name}" style="margin:8px 0 4px"><span style="width:${pc}%"></span></div><span class="small muted">${money(g.savedCents)} de ${money(g.targetCents)} · ${pc}%${g.deadline ? ' · até ' + shortDate(g.deadline) : ''}</span></div><button class="btn sm" data-action="goal-dep" data-id="${g.id}">Guardar</button><button class="ibtn" data-action="goal-del" data-id="${g.id}" aria-label="Excluir objetivo ${g.name}">${icon('trash', 18)}</button></li>`; })}</ul>` : empty('Nenhum objetivo ainda', 'Crie um objetivo, como uma viagem ou reserva de emergência, e acompanhe quanto já guardou.', h`<button class="btn" data-action="goal-new">${icon('plus', 16)}Criar primeiro objetivo</button>`, 'target')}</section>`;
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
    <section class="card"><h2>Últimos 6 meses<i>.</i></h2>${flowChart(months)}<p class="fine"><span class="lg" style="background:var(--ok)"></span>receitas <span class="lg" style="background:var(--bad)"></span>despesas</p><p class="small muted">Média de despesas: <b>${money(avgOut)}</b> por mês.</p></section>`;
}

function viewFinancas() {
  const g = gate('finances', 'Finanças'); if (g) return h`${areaNav('financas')}${pageTitle('Finanças')}${financePrivacyNotice()}${areaGuideButton('financas')}${g}`;
  const panel = { resumo: finResumo, lancamentos: finLanc, contas: finContas, orcamento: finOrc, relatorios: finRel }[ui.finTab] || finResumo;
  const noAcc = !S.finance.accounts.length;
  const createAction = noAcc ? '' : h`<button class="btn primary finance-page-action" data-action="tx-new">${icon('plus', 18)}Novo lançamento</button>`;
  return h`${areaNav('financas')}${pageTitle('Finanças', createAction)}${financePrivacyNotice()}${areaGuideButton('financas')}
    ${noAcc ? h`<div class="fin-section-content"><section class="card guided-empty finance-guided-empty"><span class="guided-empty-mark">${icon('wallet', 24)}</span><div class="guided-empty-copy"><span>Primeiro passo</span><h2>Comece por uma conta<i>.</i></h2><p>Cadastre a conta, carteira ou poupança onde seu dinheiro fica. Depois, receitas e despesas passam a aparecer no seu resumo.</p></div><ol class="guided-empty-steps"><li class="is-current"><b>1</b><span>Cadastre uma conta</span></li><li><b>2</b><span>Registre um lançamento</span></li><li><b>3</b><span>Acompanhe seu mês</span></li></ol><button class="btn primary" data-action="acct-new">${icon('plus', 18)}Criar primeira conta</button></section>${financeAccountTypeSettings()}</div>` : h`<div class="fin-section-content">${finSectionPicker()}${panel()}</div>${fab()}<div class="fab-clearance" aria-hidden="true"></div>`}`;
}

/* ========== Diálogos de Finanças ========== */
const moneyIn = (c) => (c ? (c / 100).toFixed(2).replace('.', ',') : '');
function newTxDlg(kind = 'out') {
  const accs = S.finance.accounts, first = accs.find((a) => !isCredit(a)) || accs[0];
  dlgOpen('tx', { kind, amount: '', desc: '', category: kind === 'in' ? catNames('in')[0] : catNames('out')[0], accountId: first ? first.id : '', toAccountId: (accs.find((a) => a.id !== (first || {}).id) || {}).id || '', date: today(), settledDate: today(), paid: true, repeat: 'none', times: '2' });
}
function dlgTx() {
  const d = ui.dlg.d, accs = S.finance.accounts, edit = !!d.id, tr = d.kind === 'tr', acc = accById(d.accountId);
  const kinds = [['out', 'Despesa'], ['in', 'Receita'], ['tr', 'Transferência']];
  const cats = catNames(d.kind === 'in' ? 'in' : 'out'), catList = cats.includes(d.category) || d.category === '__new' ? cats : [d.category, ...cats];
  return dlgWrap(h`<div class="head" style="flex-wrap:nowrap"><h2 id="dt">${edit ? 'Editar lançamento' : 'Novo lançamento'}<i>.</i></h2>${closeBtn}</div>
    ${d.recId && recById(d.recId) ? h`<div class="notice">${icon('repeat', 18)}<span class="small grow">Faz parte de uma fixa mensal. Mudar aqui afeta só este mês.</span><button type="button" class="btn sm" data-action="rec-edit" data-id="${d.recId}">Editar fixa</button></div>` : ''}
    <div class="seg" role="group" aria-label="Tipo de lançamento">${kinds.map(([k, l]) => h`<button type="button" aria-pressed="${d.kind === k}" data-action="tx-kind" data-k="${k}">${l}</button>`)}</div>
    <form id="dlgform" class="form" data-form="dlg-tx">
      ${dlgField(h`Valor (<span class="money">R$</span>)`, h`<input id="f0" class="amt-in" type="text" inputmode="decimal" data-dlg="amount" value="${d.amount}" placeholder="0,00" required autocomplete="off">`, 'full')}
      ${dlgField('Descrição', h`<input type="text" data-dlg="desc" value="${d.desc}" maxlength="80" placeholder="${tr ? 'Ex.: Reserva do mês' : 'Ex.: Mercado'}" autocomplete="off">`, 'full')}
      ${tr ? '' : dlgField('Categoria', h`<select data-dlg="category">${catList.map((c) => h`<option class="expense-name" value="${c}" ${c === d.category ? raw('selected') : ''}>${expenseTitle(c)}</option>`)}<option value="__new" ${d.category === '__new' ? raw('selected') : ''}>＋ Nova categoria…</option></select>`, 'full')}${!tr && d.category === '__new' ? dlgField('Nome da nova categoria', h`<input type="text" data-dlg="newName" value="${d.newName || ''}" maxlength="30" placeholder="Ex.: Pets" autocomplete="off">`, 'full') : ''}
      ${dlgField(tr ? 'Sai de' : 'Conta', h`<select data-dlg="accountId">${accs.map((a) => h`<option class="user-value" value="${a.id}" ${a.id === d.accountId ? raw('selected') : ''}>${accountDisplayName(a)}</option>`)}</select>`)}
      ${tr ? dlgField('Vai para', h`<select data-dlg="toAccountId">${accs.filter((a) => a.id !== d.accountId).map((a) => h`<option class="user-value" value="${a.id}" ${a.id === d.toAccountId ? raw('selected') : ''}>${accountDisplayName(a)}</option>`)}</select>`) : dlgField('Data', h`<input type="date" data-dlg="date" value="${d.date}">`)}
      ${tr ? dlgField('Data', h`<input type="date" data-dlg="date" value="${d.date}">`, 'full') : ''}
      ${!tr && !isCredit(acc) ? h`<label class="row full" style="gap:12px;min-height:44px"><input type="checkbox" data-dlg="paid" ${d.paid ? raw('checked') : ''}><span class="small"><b>${d.kind === 'in' ? 'Já recebi' : 'Já paguei'}</b><br><span class="muted">${d.kind === 'in' ? 'Desmarque para deixar como "a receber".' : 'Desmarque para deixar como "a pagar".'}</span></span></label>` : ''}
      ${!tr && !isCredit(acc) && d.paid ? h`${dlgField(d.kind === 'in' ? 'Data do recebimento' : 'Data do pagamento', h`<input type="date" data-dlg="settledDate" value="${d.settledDate || d.date}" max="${today()}" required>`)}<p class="fine">${d.kind === 'in' ? 'Usada nos relatórios por caixa.' : 'Usada nos relatórios por caixa. Compras no cartão continuam vinculadas ao ciclo da fatura.'}</p>` : ''}
      ${!edit && !tr ? h`${dlgField('Repetir', h`<select data-dlg="repeat"><option value="none" ${d.repeat === 'none' ? raw('selected') : ''}>Não repetir</option><option value="parcel" ${d.repeat === 'parcel' ? raw('selected') : ''}>Parcelado</option><option value="fixed" ${d.repeat === 'fixed' ? raw('selected') : ''}>Fixa mensal</option></select>`)}${d.repeat === 'parcel' ? dlgField('Parcelas', h`<input type="number" data-dlg="times" min="2" max="60" value="${d.times}" inputmode="numeric">`) : ''}${d.repeat !== 'none' ? h`<p class="fine full">${d.repeat === 'parcel' ? 'O valor total é dividido igualmente entre as parcelas, uma por mês.' : 'Criada todo mês automaticamente, no mesmo dia. Edite ou pause em Fixas, na aba Lançamentos.'}</p>` : ''}` : ''}
    </form>`,
    h`${edit ? h`<button class="btn danger back" data-action="tx-del-dlg">${icon('trash', 18)}</button>` : h`<button class="btn back" data-action="dlg-close">Cancelar</button>`}<button class="btn primary" type="submit" form="dlgform">${edit ? 'Salvar' : 'Adicionar'}</button>`);
}
function dlgCategoryManager() {
  const categoryGroup = (kind, label) => h`<section class="category-manager-group">
    <div class="head"><h3>${label}</h3><button type="button" class="btn sm" data-action="category-new" data-kind="${kind}">${icon('plus', 16)}Adicionar</button></div>
    <ul class="list category-manager-list">${listArr(kind).map((category) => h`<li>${catChip(catInfo(kind, category.name))}<span class="grow ttl">${kind === 'out' ? expenseTitle(category.name) : category.name}</span></li>`)}</ul>
  </section>`;
  return dlgWrap(h`<div class="head"><div><h2 id="dt">Gerenciar categorias<i>.</i></h2><p class="small muted">Organize as categorias usadas em lançamentos e limites. Os registros existentes não serão alterados.</p></div>${closeBtn}</div>
    ${categoryGroup('out', 'Despesas')}
    ${categoryGroup('in', 'Receitas')}`,
    h`<button type="button" class="btn back" data-action="dlg-close">Fechar</button>`);
}
function dlgCategoryNew() {
  const kind = ui.dlg.d.kind;
  const label = kind === 'in' ? 'receita' : 'despesa';
  return dlgWrap(h`<div class="head"><div><h2 id="dt">Nova categoria de ${label}<i>.</i></h2><p class="small muted">Ela ficará disponível nos próximos lançamentos.</p></div>${closeBtn}</div>
    <form id="dlgform" class="form" data-form="dlg-category">
      ${dlgField('Nome da categoria', h`<input id="f0" type="text" data-dlg="name" value="${ui.dlg.d.name || ''}" maxlength="30" placeholder="${kind === 'in' ? 'Ex.: Venda de itens' : 'Ex.: Pets'}" required autocomplete="off">`, 'full')}
    </form>`,
    h`<button type="button" class="btn back" data-action="category-manager">Voltar</button><button type="submit" class="btn primary" form="dlgform">Adicionar</button>`);
}
function dlgAccount() {
  const d = ui.dlg.d, edit = !!d.id, types = Object.entries(ACCOUNT_TYPES);
  const bankOption = (key, name) => {
    const logo = key && Object.hasOwn(BANKS, key)
      ? accountChip({ bank: key, type: 'checking' })
      : catChip({ c: '#5fa68a', i: 'bank' });
    return h`<label class="bank-choice"><input type="radio" name="account-bank" data-dlg="bank" value="${key}" ${d.bank === key ? raw('checked') : ''}><span class="bank-choice-icon">${logo}</span><span class="bank-choice-name">${name}</span></label>`;
  };
  const bankOptions = [
    ...Object.entries(BANKS).map(([key, bank]) => [key, bank.name]),
    ['', 'Não informar'],
    [OTHER_BANK, 'Outro / não listado'],
    ...(d.bank && d.bank !== OTHER_BANK && !Object.hasOwn(BANKS, d.bank) ? [[d.bank, d.bank]] : []),
  ];
  return dlgWrap(h`<div class="head" style="flex-wrap:nowrap"><h2 id="dt">${edit ? 'Editar conta' : 'Nova conta'}<i>.</i></h2>${closeBtn}</div>
    <form id="dlgform" class="form" data-form="dlg-account">
      ${dlgField('Nome da conta', h`<input id="f0" type="text" data-dlg="name" value="${d.name}" maxlength="40" required placeholder="Ex.: Nubank 1" autocomplete="off">`, 'full')}
      <fieldset class="f full bank-field"><legend class="f-label">Banco ou instituição</legend><div class="bank-picker" role="radiogroup" aria-label="Banco ou instituição">${bankOptions.map(([key, name]) => bankOption(key, name))}</div></fieldset>
      <p class="small muted full">O nome da conta pode ser personalizado. Os logotipos identificam as instituições; o Aurora não se conecta a bancos.</p>
      ${dlgField('Tipo', h`<select data-dlg="type">${types.map(([k, v]) => h`<option value="${k}" ${k === d.type ? raw('selected') : ''}>${v}</option>`)}</select>`)}
      ${dlgField(edit ? h`Saldo atual (<span class="money">R$</span>)` : d.type === 'credit' ? 'Saldo inicial (dívida em aberto: negativo)' : h`Saldo inicial (<span class="money">R$</span>)`, h`<input type="text" inputmode="decimal" data-dlg="balance" value="${d.balance}" placeholder="0,00">`)}
      ${d.type === 'credit' ? h`${dlgField(h`Limite (<span class="money">R$</span>)`, h`<input type="text" inputmode="decimal" data-dlg="limit" value="${d.limit}" placeholder="0,00">`, 'full')}${dlgField('Dia de fechamento', h`<input type="number" min="1" max="31" data-dlg="closing" value="${d.closing}" inputmode="numeric">`)}${dlgField('Dia de vencimento', h`<input type="number" min="1" max="31" data-dlg="due" value="${d.due}" inputmode="numeric">`)}` : ''}
    </form>`,
    h`${edit ? h`<button class="btn danger back" data-action="acct-del" aria-label="Excluir conta">${icon('trash', 18)}</button>` : h`<button class="btn back" data-action="dlg-close">Cancelar</button>`}<button class="btn primary" type="submit" form="dlgform">Salvar</button>`);
}
function dlgAccountDelete() {
  const d = ui.dlg.d, a = accById(d.id);
  if (!a) return dlgWrap(h`<div class="head"><h2 id="dt">Conta não encontrada<i>.</i></h2>${closeBtn}</div><p class="small muted">A conta já não está disponível.</p>`, h`<button class="btn back" data-action="dlg-close">Fechar</button>`);
  const txCount = S.finance.tx.filter((t) => t.accountId === a.id || t.toAccountId === a.id).length;
  const recurringCount = recList().filter((r) => r.accountId === a.id).length;
  return dlgWrap(h`<div class="head" style="flex-wrap:nowrap"><h2 id="dt">Excluir conta?<i>.</i></h2>${closeBtn}</div>
    <p class="small"><span class="user-value">${accountDisplayName(a)}</span>: a conta, ${txCount} ${plural(txCount, 'lançamento', 'lançamentos')} e ${recurringCount} ${plural(recurringCount, 'lançamento fixo', 'lançamentos fixos')} associados irão juntos para a lixeira.</p>
    <p class="notice warn" role="alert">Você poderá restaurar esses dados por 30 dias. Depois, serão removidos automaticamente.</p>`,
    h`<button class="btn back" data-action="dlg-close">Cancelar</button><button class="btn danger" data-action="acct-del-confirm">Mover para a lixeira</button>`);
}
function dlgBudget() {
  const d = ui.dlg.d;
  return dlgWrap(h`<div class="head" style="flex-wrap:nowrap"><h2 id="dt">Limite de <span class="expense-name">${expenseTitle(d.cat)}</span><i>.</i></h2>${closeBtn}</div>
    <p class="small muted">Quanto você quer gastar por mês nesta categoria? O Aurora avisa quando chegar perto.</p>
    ${d.confirmClear ? h`<p class="notice warn" role="alert">O orçamento irá para a lixeira por 30 dias. Confirme para continuar.</p>` : ''}
    <form id="dlgform" class="form" data-form="dlg-budget">${dlgField(h`Limite mensal (<span class="money">R$</span>)`, h`<input id="f0" class="amt-in" type="text" inputmode="decimal" data-dlg="limit" value="${d.limit}" placeholder="0,00">`, 'full')}</form>`,
    h`${d.confirmClear ? h`<button type="button" class="btn back" data-action="budget-clear-cancel">Cancelar remoção</button><button type="button" class="btn danger" data-action="budget-clear">Confirmar remoção</button>` : h`${d.limit ? h`<button type="button" class="btn back" data-action="budget-clear">Remover limite</button>` : h`<button type="button" class="btn back" data-action="dlg-close">Cancelar</button>`}<button class="btn primary" type="submit" form="dlgform">Salvar</button>`}`);
}
function dlgGoal() {
  const d = ui.dlg.d;
  return dlgWrap(h`<div class="head" style="flex-wrap:nowrap"><h2 id="dt">Novo objetivo<i>.</i></h2>${closeBtn}</div>
    <form id="dlgform" class="form" data-form="dlg-goal">${dlgField('Nome', h`<input id="f0" type="text" data-dlg="name" value="${d.name}" maxlength="50" required placeholder="Ex.: Viagem, reserva de emergência">`, 'full')}${dlgField(h`Valor do objetivo (<span class="money">R$</span>)`, h`<input type="text" inputmode="decimal" data-dlg="target" value="${d.target}" placeholder="0,00" required>`)}${dlgField(h`Já guardado (<span class="money">R$</span>)`, h`<input type="text" inputmode="decimal" data-dlg="saved" value="${d.saved}" placeholder="0,00">`)}${dlgField('Prazo (opcional)', h`<input type="date" data-dlg="deadline" value="${d.deadline}">`, 'full')}</form>`,
    h`<button class="btn back" data-action="dlg-close">Cancelar</button><button class="btn primary" type="submit" form="dlgform">Criar objetivo</button>`);
}
function dlgDeposit() {
  const d = ui.dlg.d, g = S.finance.goals.find((x) => x.id === d.id);
  return dlgWrap(h`<div class="head" style="flex-wrap:nowrap"><h2 id="dt">Guardar em <span class="user-value">${g ? g.name : 'objetivo'}</span><i>.</i></h2>${closeBtn}</div>
    <p class="small muted">Este valor atualiza apenas o acompanhamento do objetivo; não altera o saldo de uma conta nem cria um lançamento. Para retirar, informe um valor negativo.</p>
    <form id="dlgform" class="form" data-form="dlg-deposit">${dlgField(h`Valor (<span class="money">R$</span>)`, h`<input id="f0" class="amt-in" type="text" inputmode="decimal" data-dlg="amount" value="${d.amount}" placeholder="0,00" required>`, 'full')}</form>`,
    h`<button class="btn back" data-action="dlg-close">Cancelar</button><button class="btn primary" type="submit" form="dlgform">Confirmar</button>`);
}
function dlgPayInv() {
  const d = ui.dlg.d, card = accById(d.cardId), srcs = S.finance.accounts.filter((a) => !isCredit(a));
  return dlgWrap(h`<div class="head" style="flex-wrap:nowrap"><h2 id="dt">Pagar fatura<i>.</i></h2>${closeBtn}</div>
    <p class="small muted">${card ? h`<span class="user-value">${accountDisplayName(card)}</span>` : ''}: o pagamento sai da conta escolhida e reduz o valor em aberto do cartão.</p>
    <form id="dlgform" class="form" data-form="dlg-payinv">${dlgField(h`Valor (<span class="money">R$</span>)`, h`<input id="f0" class="amt-in" type="text" inputmode="decimal" data-dlg="amount" value="${d.amount}" required>`, 'full')}${dlgField('Pagar com', h`<select data-dlg="from">${srcs.map((a) => h`<option class="user-value" value="${a.id}" ${a.id === d.from ? raw('selected') : ''}>${accountDisplayName(a)} · ${money(accBalance(a))}</option>`)}</select>`, 'full')}</form>`,
    h`<button class="btn back" data-action="dlg-close">Cancelar</button><button class="btn primary" type="submit" form="dlgform">Pagar</button>`);
}
function dlgTxDel() {
  const d = ui.dlg.d, t = S.finance.tx.find((x) => x.id === d.id) || {}, g = S.finance.tx.filter((x) => x.groupId === d.gid), after = g.filter((x) => x.date >= (t.date || ''));
  if (!d.gid) return dlgWrap(h`<div class="head" style="flex-wrap:nowrap"><h2 id="dt">Excluir lançamento?<i>.</i></h2>${closeBtn}</div>
    <p class="small"><span class="${t.type === 'out' ? 'expense-name' : 'user-value'}">${t.type === 'out' ? expenseTitle(t.desc || t.category || 'Este lançamento') : t.desc || t.category || 'Este lançamento'}</span> · ${t.date || ''} · ${t.cents ? money(t.cents) : ''}</p>
    <p class="small muted">O lançamento poderá ser restaurado pela lixeira por 30 dias.</p>`,
    h`<button class="btn back" data-action="dlg-close">Cancelar</button><button class="btn danger" data-action="txdel-do" data-k="one">Excluir</button>`);
  const opt = (k, title, sub) => h`<button type="button" class="mrow" data-action="txdel-do" data-k="${k}"><span class="mk">${icon('trash', 18)}</span><span class="grow"><b>${title}</b><small>${sub} · restaurável por 30 dias</small></span></button>`;
  return dlgWrap(h`<div class="head" style="flex-wrap:nowrap"><h2 id="dt">Excluir qual parte?<i>.</i></h2>${closeBtn}</div><p class="small muted">Este lançamento faz parte de uma série de ${g.length} (parcelas ou fixa mensal).</p>
    <div class="more">${opt('one', 'Só este', '1 lançamento')}${opt('next', 'Este e os próximos', after.length + ' lançamentos')}${opt('all', 'Toda a série', g.length + ' lançamentos')}</div>`, h`<button class="btn back" data-action="dlg-close">Cancelar</button>`);
}
Object.assign(DLG, { txdel: dlgTxDel, tx: dlgTx, 'category-manager': dlgCategoryManager, 'category-new': dlgCategoryNew, account: dlgAccount, acctdelete: dlgAccountDelete, budget: dlgBudget, goal: dlgGoal, deposit: dlgDeposit, payinv: dlgPayInv });

/* ========== Ações e formulários de Finanças ========== */
const F_ = () => S.finance;
Object.assign(ACTIONS, {
  'fin-tab': (el) => {
    if (!FIN_TABS.some(([key]) => key === el.dataset.t)) { console.error('Aurora: seção de Finanças inválida.', el.dataset.t); return; }
    ui.finTab = el.dataset.t;
    render();
  },
  'fin-go': (el) => { ui.finTab = el.dataset.t; if (el.dataset.f) ui.finFilter = el.dataset.f; render(); window.scrollTo(0, 0); },
  'fin-filter': (el) => { ui.finFilter = el.dataset.f; render(); },
  'fin-month': (el) => { const n = Number(el.dataset.n); ui.finMonth = n === 0 ? today().slice(0, 7) : shiftMonth(ui.finMonth, n); render(); },
  'rep-kind': (el) => { ui.repKind = el.dataset.k; render(); },
  'rep-basis': (el) => { ui.repBasis = el.dataset.b === 'cash' ? 'cash' : 'competence'; render(); },
  'tx-new': () => newTxDlg('out'),
  'tx-new-in': () => newTxDlg('in'),
  'tx-kind': (el) => { const d = ui.dlg.d, k = el.dataset.k; if (d.kind === k) return; d.kind = k; d.category = k === 'in' ? catNames('in')[0] : catNames('out')[0]; if (k === 'tr' && (!d.toAccountId || d.toAccountId === d.accountId)) d.toAccountId = (S.finance.accounts.find((a) => a.id !== d.accountId) || {}).id || ''; render(); },
  'edit-tx': (el) => { const t = S.finance.tx.find((x) => x.id === el.dataset.id); if (t) dlgOpen('tx', { id: t.id, kind: t.type, amount: moneyIn(t.cents), desc: t.desc || '', category: t.category || catNames('out')[0], accountId: t.accountId, toAccountId: t.toAccountId || '', date: t.date, settledDate: t.settledDate || t.date, paid: isPaid(t), repeat: 'none', times: '2', recId: t.recId || '' }); },
  'tx-paid': (el) => {
    const transaction = S.finance.tx.find((item) => item.id === el.dataset.id);
    if (!transaction) return;
    const wasPaid = isPaid(transaction), previousSettledDate = transaction.settledDate;
    transaction.paid = !wasPaid;
    if (transaction.paid && !isCredit(accById(transaction.accountId))) transaction.settledDate = today();
    else delete transaction.settledDate;
    commit('finance');
    if (transaction.paid) completionFeedback(`.fr[data-k="${transaction.id}"]`);
    toast(transaction.paid
      ? (transaction.type === 'in' ? 'Marcado como recebido.' : 'Marcado como pago.')
      : 'Voltou para pendente.', () => {
      transaction.paid = wasPaid;
      if (previousSettledDate) transaction.settledDate = previousSettledDate;
      else delete transaction.settledDate;
      commit('finance');
    });
  },
  'tx-del-dlg': () => { const cur = S.finance.tx.find((x) => x.id === ui.dlg.d.id); if (!cur) return dlgClose(); dlgOpen('txdel', { id: cur.id, ...(cur.groupId && S.finance.tx.filter((x) => x.groupId === cur.groupId).length > 1 ? { gid: cur.groupId } : {}) }); },
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
  'category-new': (el) => { const kind = el.dataset.kind; if (kind !== 'out' && kind !== 'in') return toast('Escolha um tipo de categoria válido.'); dlgOpen('category-new', { kind, name: '' }); },
  'fin-csv': () => finCsv(),
  'acct-new': () => dlgOpen('account', { name: '', bank: '', type: (S.settings.accountTypes[0] || 'checking'), balance: '', limit: '', closing: '', due: '' }),
  'acct-edit': (el) => { const a = accById(el.dataset.id); if (a) dlgOpen('account', { id: a.id, name: accountDisplayName(a), bank: a.bank || '', type: a.type, balance: moneyIn(accBalance(a)), cur0: accBalance(a), limit: moneyIn(a.limitCents), closing: a.closingDay || '', due: a.dueDay || '' }); },
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
  'pay-inv': (el) => { const c = accById(el.dataset.id), i = cardInfo(c), from = S.finance.accounts.find((a) => !isCredit(a)); if (c && from) dlgOpen('payinv', { cardId: c.id, amount: moneyIn(Math.min(i.total || i.used, i.used) || i.used), from: from.id }); },
});
Object.assign(FORMS, {
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
    if (!d.id && d.repeat === 'parcel' && (!Number.isInteger(Number(d.times)) || Number(d.times) < 2 || Number(d.times) > 60)) return toast('Informe entre 2 e 60 parcelas.');
    const base = { type: d.kind, accountId: d.accountId, category: tr ? 'Transferência' : d.category, desc: d.desc.trim().slice(0, 80) };
    if (tr) base.toAccountId = d.toAccountId;
    const paid = tr || isCredit(acc) ? true : !!d.paid;
    const settledDate = !tr && !isCredit(acc) && paid ? d.settledDate : '';
    if (d.id) {
      const t = S.finance.tx.find((x) => x.id === d.id);
      if (!t) return dlgClose();
      Object.assign(t, base, { cents, date: d.date, paid });
      if (!tr) delete t.toAccountId;
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
    const n = d.repeat === 'none' || tr ? 1 : clamp(Math.round(num(d.times)) || 2, 2, 60), gid = n > 1 ? newId() : undefined;
    for (let i = 0; i < n; i++) {
      const part = d.repeat === 'parcel' ? Math.floor(cents / n) + (i === 0 ? cents - Math.floor(cents / n) * n : 0) : cents;
      const installmentDate = addMonths(d.date, i);
      const installmentPaid = isCredit(acc) ? true : i === 0 ? paid : false;
      S.finance.tx.push({
        id: newId(),
        ...base,
        cents: part,
        date: installmentDate,
        paid: installmentPaid,
        ...(!isCredit(acc) && installmentPaid ? { settledDate: i === 0 ? settledDate : installmentDate } : {}),
        createdAt: Date.now() + i,
        ...(n > 1 ? { groupId: gid, desc: `${base.desc || base.category} (${i + 1}/${n})` } : {}),
      });
    }
    ui.finMonth = d.date.slice(0, 7); ui.dlg = null; commit('finance'); toast(n > 1 ? `${n} lançamentos criados.` : 'Lançamento adicionado.');
  },
  'dlg-account': () => {
    const d = ui.dlg.d, name = d.name.trim(), current = d.id ? accById(d.id) : null; if (!name) return toast('Dê um nome à conta.');
    if (!Object.hasOwn(ACCOUNT_TYPES, d.type) || (d.id && !current)) return toast('Confira o tipo e a conta selecionados.');
    if (d.bank && d.bank !== OTHER_BANK && !Object.hasOwn(BANKS, d.bank) && (!current || current.bank !== d.bank)) return toast('Escolha um banco ou instituição válido.');
    const bal = d.balance.trim() ? parseMoney(d.balance) : 0, lim = d.limit && d.limit.trim() ? parseMoney(d.limit) : 0;
    if (!Number.isSafeInteger(bal) || !Number.isSafeInteger(lim) || lim < 0) return toast('Confira os valores digitados. Use valores em reais, como 1.234,56.');
    const cl = d.closing.trim() ? Number(d.closing) : 0, du = d.due.trim() ? Number(d.due) : 0;
    if (d.type === 'credit' && ((d.closing.trim() && (!Number.isInteger(cl) || cl < 1 || cl > 31)) || (d.due.trim() && (!Number.isInteger(du) || du < 1 || du > 31)))) return toast('Os dias de fechamento e vencimento devem ser números inteiros de 1 a 31.');
    const patch = { name: accountDisplayName({ name: name.slice(0, 40), bank: d.bank || '' }), type: d.type, bank: d.bank || '', initialCents: d.id ? current.initialCents + (bal - (d.cur0 || 0)) : bal, limitCents: d.type === 'credit' && lim > 0 ? lim : 0, closingDay: d.type === 'credit' && cl >= 1 && cl <= 31 ? cl : 0, dueDay: d.type === 'credit' && du >= 1 && du <= 31 ? du : 0 };
    if (d.id) Object.assign(current, patch); else S.finance.accounts.push({ id: newId(), ...patch });
    ui.dlg = null; commit('finance');
  },
  'dlg-budget': () => { const d = ui.dlg.d, c = parseMoney(d.limit); if (!(c > 0)) return toast('Informe um limite maior que zero.'); Object.defineProperty(S.finance.budgets, d.cat, { value: { cents: c }, enumerable: true, writable: true, configurable: true }); ui.dlg = null; commit('finance'); },
  'dlg-category': () => {
    const d = ui.dlg.d, name = String(d.name || '').trim().slice(0, 30);
    if (d.kind !== 'out' && d.kind !== 'in') return toast('Escolha um tipo de categoria válido.');
    if (!name) return toast('Informe o nome da categoria.');
    if (listArr(d.kind).some((category) => norm(category.name) === norm(name))) return toast('Já existe uma categoria com esse nome.');
    addItem(d.kind, name);
    ui.dlg = createDialog('category-manager', {});
    commit('settings');
    toast('Categoria adicionada.');
  },
  'dlg-goal': () => { const d = ui.dlg.d, t = parseMoney(d.target), sv = d.saved.trim() ? parseMoney(d.saved) : 0; if (!d.name.trim() || !(t > 0) || Number.isNaN(sv)) return toast('Informe o nome e o valor do objetivo.'); S.finance.goals.push({ id: newId(), name: d.name.trim().slice(0, 50), targetCents: t, savedCents: Math.max(0, sv), deadline: isDay(d.deadline) ? d.deadline : '' }); ui.dlg = null; commit('finance'); },
  'dlg-deposit': () => { const d = ui.dlg.d, g = S.finance.goals.find((x) => x.id === d.id), v = parseMoney(d.amount); if (!g || Number.isNaN(v) || v === 0) return toast('Informe um valor.'); g.savedCents = Math.max(0, g.savedCents + v); ui.dlg = null; commit('finance'); toast(v > 0 ? 'Valor guardado.' : 'Valor retirado.'); },
  'dlg-payinv': () => {
    const d = ui.dlg.d, cents = parseMoney(d.amount), card = accById(d.cardId), source = accById(d.from);
    if (!Number.isSafeInteger(cents) || cents <= 0) return toast('Informe um valor maior que zero.');
    if (!card || !isCredit(card) || !source || isCredit(source) || source.id === card.id) return toast('Escolha um cartão e uma conta de origem válidos.');
    const outstanding = cardInfo(card).used;
    if (outstanding <= 0) return toast('Este cartão não tem valores em aberto.');
    if (cents > outstanding) return toast(h`O pagamento não pode ultrapassar o valor em aberto de ${money(outstanding)}.`);
    S.finance.tx.push({ id: newId(), type: 'tr', accountId: source.id, toAccountId: card.id, cents, category: 'Transferência', desc: 'Pagamento da fatura', date: today(), paid: true, createdAt: Date.now() });
    ui.dlg = null; commit('finance'); toast('Pagamento registrado.');
  },
});
Object.assign(CHANGES, { 'fin-cat': (el) => { ui.finCat = el.value; render(); }, 'fin-acc': (el) => { ui.finAcc = el.value; render(); } });

/* ---- exportar CSV ---- */
const csvCell = (v) => { const s = String(v == null ? '' : v); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
async function finCsv() {
  const rows = filteredTx(), head = ['Data', 'Data de pagamento/recebimento', 'Tipo', 'Descrição', 'Categoria', 'Conta', 'Valor', 'Situação'];
  const lines = rows.map((t) => [t.date, t.settledDate || '', { in: 'Receita', out: 'Despesa', tr: 'Transferência' }[t.type], t.desc || '', t.category || '', accName(t.accountId), (t.type === 'out' ? -t.cents : t.cents) / 100, isPaid(t) ? 'Pago' : 'Pendente'].map(csvCell).join(';'));
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
    <div class="row" style="gap:8px"><button class="btn sm" data-action="rec-list">${icon('repeat', 16)}Fixas${n ? ' (' + n + ')' : ''}</button><label class="btn sm" style="cursor:pointer">${icon('download', 16)}Importar extrato<input type="file" class="sr" accept=".csv,.ofx,.txt,text/csv,text/plain" data-change="fin-import" aria-label="Importar extrato CSV ou OFX"></label></div></div>`;
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
    <p class="fine"><span class="lg" style="background:var(--bad)"></span>a pagar <span class="lg" style="background:var(--ok)"></span>a receber <span class="lg" style="background:var(--line2)"></span>pago/recebido</p></div>
    <section class="card"><div class="head"><h3>${ui.finDay === tdy ? 'Hoje' : cap(longDate(ui.finDay))}</h3><span class="small ${tot < 0 ? '' : 'muted'}">${day.length ? money(tot) : ''}</span></div>
      ${day.length ? h`<ul class="list">${day.map(finRow)}</ul>` : h`<p class="small muted">Nada neste dia.</p>`}
      <button class="btn sm" data-action="tx-new-day">${icon('plus', 16)}Lançamento neste dia</button></section>`;
}

/* ---- fixas: lista e edição ---- */
function dlgRecurList() {
  const rs = recList();
  return dlgWrap(h`<div class="head" style="flex-wrap:nowrap"><h2 id="dt">Lançamentos fixos<i>.</i></h2>${closeBtn}</div>
    <p class="small muted">Contas e receitas que se repetem todo mês. O Aurora cria os próximos meses sozinho. Para criar uma, use Lançamento e escolha "Fixa mensal".</p>
    ${rs.length ? h`<ul class="list more">${rs.map((r) => h`<li><button type="button" class="mrow" data-action="rec-edit" data-id="${r.id}"><span class="mk">${icon(catMeta({ type: r.type, category: r.category }).i, 20)}</span><span class="grow"><b><span class="${r.type === 'out' ? 'expense-name' : 'user-value'}">${r.type === 'out' ? expenseTitle(r.desc || r.category) : r.desc || r.category}</span>${r.paused ? ' · pausada' : ''}</b><small>${r.type === 'in' ? '+' : '−'}${money(r.cents)} · <span class="user-value">${recWhen(r)}</span></small></span>${icon('chevRight', 16)}</button></li>`)}</ul>` : h`<div class="empty"><b>Nenhuma fixa ainda</b><span>Aluguel, salário, assinaturas: crie uma vez e esqueça.</span></div>`}`,
    h`<button class="btn back" data-action="dlg-close">Fechar</button>`);
}
function dlgRecur() {
  const d = ui.dlg.d, kind = d.kind, cats = catNames(kind), cl = cats.includes(d.category) ? cats : [d.category, ...cats], accs = S.finance.accounts;
  return dlgWrap(h`<div class="head" style="flex-wrap:nowrap"><h2 id="dt">Editar fixa<i>.</i></h2>${closeBtn}</div>
    <form id="dlgform" class="form" data-form="dlg-recur">
      ${dlgField('Descrição', h`<input id="f0" type="text" data-dlg="desc" value="${d.desc}" maxlength="80" autocomplete="off">`, 'full')}
      ${dlgField(h`Valor (<span class="money">R$</span>)`, h`<input type="text" class="amt-in" inputmode="decimal" data-dlg="amount" value="${d.amount}" required>`)}${dlgField('Dia do mês', h`<input type="number" min="1" max="31" data-dlg="day" value="${d.day}" inputmode="numeric">`)}
      ${dlgField('Categoria', h`<select data-dlg="category">${cl.map((c) => h`<option class="${kind === 'out' ? 'expense-name' : 'user-value'}" value="${c}" ${c === d.category ? raw('selected') : ''}>${kind === 'out' ? expenseTitle(c) : c}</option>`)}</select>`)}${dlgField('Conta', h`<select data-dlg="accountId">${accs.map((a) => h`<option class="user-value" value="${a.id}" ${a.id === d.accountId ? raw('selected') : ''}>${accountDisplayName(a)}</option>`)}</select>`)}
      <label class="row full" style="gap:12px;min-height:44px;flex-wrap:nowrap;align-items:flex-start"><input type="checkbox" data-dlg="future" ${d.future ? raw('checked') : ''}><span class="small"><b>Aplicar aos próximos já criados</b><br><span class="muted">Atualiza os meses futuros que ainda não foram pagos.</span></span></label>
      <label class="row full" style="gap:12px;min-height:44px;flex-wrap:nowrap;align-items:flex-start"><input type="checkbox" data-dlg="paused" ${d.paused ? raw('checked') : ''}><span class="small"><b>Pausar</b><br><span class="muted">Para de criar novos meses.</span></span></label>
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
  return dlgWrap(h`<div class="head" style="flex-wrap:nowrap"><h2 id="dt">Importar extrato<i>.</i></h2>${closeBtn}</div>
    <p class="small muted"><b>${d.file}</b>: ${d.rows.length} lançamentos encontrados${dups ? `, ${dups} parecem já existir (desmarcados)` : ''}. Confira as categorias antes de importar.</p>
    ${d.truncated ? h`<p class="notice warn full" role="status">O arquivo tem mais de 500 lançamentos. A prévia inclui os primeiros 500; importe o restante em outro arquivo para não deixar registros de fora.</p>` : ''}
    <div class="form">${dlgField('Importar para a conta', h`<select data-dlg="accountId">${S.finance.accounts.map((a) => h`<option class="user-value" value="${a.id}" ${a.id === d.accountId ? raw('selected') : ''}>${accountDisplayName(a)}</option>`)}</select>`, 'full')}
      <label class="row full" style="gap:12px;min-height:44px;flex-wrap:nowrap;align-items:flex-start"><input type="checkbox" data-dlg="invert" ${d.invert ? raw('checked') : ''}><span class="small"><b>Inverter entradas e saídas</b><br><span class="muted">Use se o arquivo mostra as compras como valores positivos (comum em fatura de cartão).</span></span></label></div>
    <ul class="list imp">${d.rows.map((r, i) => h`<li><label class="row" style="gap:10px;flex-wrap:nowrap;align-items:flex-start;cursor:pointer;width:100%"><input type="checkbox" data-dlg="rows.${i}.on" ${r.on ? raw('checked') : ''} aria-label="Importar ${r.desc}"><span class="grow" style="min-width:0"><b class="ellip ${r.kind === 'out' ? 'expense-name' : 'user-value'}">${r.kind === 'out' ? expenseTitle(r.desc) : r.desc}</b><span class="small muted">${shortDate(r.date)}${r.dup ? ' · possível duplicado' : ''}</span></span><span class="amt ${r.kind}">${r.kind === 'in' ? '+' : '−'}${money(r.abs)}</span></label>
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
    ${names.length ? h`<div class="f"><span class="lbl">Despesas por categoria</span><ul class="list cmpl">${names.map((n) => h`<li><div class="grow"><div class="row" style="justify-content:space-between;flex-wrap:nowrap"><b class="expense-name">${expenseTitle(n)}</b><span class="small">${dl(ca[n] || 0, cb[n] || 0, false)}</span></div>
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
  page.setAttribute('aria-label', 'carregando o Aurora');
  const brand = document.createElement('span');
  brand.className = 'account-loading-brand';
  brand.setAttribute('aria-hidden', 'true');
  const card = document.createElement('section');
  card.className = 'account-loading-card';
  card.setAttribute('aria-hidden', 'true');
  for (const className of ['is-title', '', 'is-field', '', 'is-field', 'is-button', 'is-short']) {
    const line = document.createElement('span');
    line.className = `account-loading-line ${className}`.trim();
    line.setAttribute('aria-hidden', 'true');
    card.append(line);
  }
  page.append(brand, card);
  root.replaceChildren(page);
}

async function startAuthenticatedAurora(root, initialMode = 'login', allowPublicReturn = false) {
  const { requireAccount, showAccountError } = await import('./services/account-auth.js');
  renderAccountLoading(root);
  let returnedToPublic = false;
  accountSession = await requireAccount(root, initialMode, {
    allowPublicReturn,
    onPublicReturn: () => { returnedToPublic = true; },
    onAccountDeleted: () => {
      returnedToPublic = true;
      history.replaceState(null, '', postSignOutPath(location));
    },
  });
  if (!accountSession) {
    if (returnedToPublic) renderLanding(root);
    return;
  }
  Persist.attach(accountSession);

  try {
    purgeRemovedStudyDataFromBrowserStorage(window.localStorage, accountSession.user.id);
    await loadAccountData();
    initializeBirthdayFromMetadata(accountSession.user);
  } catch (error) {
    console.error('Aurora: a conta foi autenticada, mas os dados protegidos não puderam ser carregados.', error);
    showAccountError(root, error instanceof Error ? error.message : 'Os dados da conta não puderam ser carregados. Nenhum dado local foi usado como substituto.');
    return;
  }

  purgeExpiredTrash();
  if (ui.persistFailed.size) toast('Alguns dados protegidos não puderam ser carregados ou salvos. As cópias originais foram preservadas; faça um backup antes de continuar.');
  const recurringReconciled = reconcileRecurringTransactions();
  const recurringGenerated = genRecurring();
  if (recurringReconciled || recurringGenerated) saveSlices('finance');
  window.addEventListener('hashchange', onRoute);
  onRoute();
  if (!profileSetupComplete()) openProfileSetup();
  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('/service-worker.js');
      await navigator.serviceWorker.ready;
      await initializePomodoroPush();
    } catch (error) {
      console.error('O Aurora não conseguiu iniciar o suporte offline.', error);
      ui.pushNotice = pomodoroPushErrorMessage(error);
      if (ui.route === 'pomodoro') render();
    }
  }
  if (S.pomodoro.startedAt !== null && getPomodoroPushStatus().enabled) syncPomodoroPushSchedule(S.pomodoro);
  Persist.retryPending();
  setInterval(tick, 1000);
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
  const routeMeta = document.querySelector('meta[name="aurora-route"]')?.content === 'landing';
  const isPublicLanding = routeMeta && isPublicLandingHash(location.hash);
  const localPreview = Boolean(import.meta.env.DEV && new URLSearchParams(location.search).has('preview'));
  if (localPreview) {
    ui.preview = true;
    S.settings.profile.name = 'Pessoa';
    S.settings.profile.preferredName = 'Pessoa';
    S.settings.onboardingComplete = true;
    S.settings.introSeen = true;
    loadSample();
    if (!location.hash || location.hash === '#landing') history.replaceState(null, '', `${location.pathname}${location.search}#inicio`);
    window.addEventListener('hashchange', onRoute);
    onRoute();
    setInterval(tick, 1000);
    return;
  }
  if (routeMeta && location.hash === '#landing') {
    history.replaceState(null, '', `${location.pathname}${location.search}`);
  }
  if (!isPublicLanding) {
    await startAuthenticatedAurora(root);
    return;
  }
  initializePublicAppearance();
  renderLanding(root);
  root.addEventListener('click', (event) => {
    if (handlePublicControl(event, root)) return;
    const action = event.target instanceof Element ? event.target.closest('[data-public-action]')?.dataset.publicAction : null;
    if (action === 'landing') {
      event.preventDefault();
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
    root.querySelectorAll('[data-public-action]').forEach((button) => {
      if (button instanceof HTMLButtonElement) button.disabled = true;
    });
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
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return;

  const closeButton = target.closest('[data-legal-modal-close]');
  if (closeButton) {
    closeButton.closest('dialog[data-legal-modal]')?.close();
    return;
  }

  const dialog = target.closest('dialog[data-legal-modal]');
  if (dialog && target === dialog) {
    dialog.close();
    return;
  }

  const trigger = target.closest('[data-legal-document]');
  const linkedDocument = dialog && !target.closest('[data-legal-direct]')
    ? target.closest('a[href]')
    : null;
  const linkedPath = linkedDocument ? new URL(linkedDocument.href, location.href).pathname : '';
  const documentName = trigger?.dataset.legalDocument
    || (linkedPath === '/terms.html' ? 'terms' : linkedPath === '/privacy.html' ? 'privacy' : '');
  if (!documentName) return;

  const modal = document.querySelector('dialog[data-legal-modal]');
  if (!(modal instanceof HTMLDialogElement)) {
    console.error('Aurora: o diálogo de documentos legais não está disponível.');
    return;
  }
  event.preventDefault();
  if (await showLegalDocument(modal, documentName)) updateLegalConsentReading(modal);
});

function updateLegalConsentReading(dialog) {
  const documentName = dialog.dataset.legalDocument;
  const content = dialog.querySelector('[data-legal-dialog-content]');
  const consentForm = document.querySelector('form[data-legal-consent]');
  if (
    !['terms', 'privacy'].includes(documentName)
    || !content
    || !consentForm
    || !isLegalDocumentAtEnd(content)
  ) return;

  consentForm.dataset[`${documentName}Read`] = 'true';
  const termsRead = consentForm.dataset.termsRead === 'true';
  const privacyRead = consentForm.dataset.privacyRead === 'true';
  const checkbox = consentForm.elements.termsAccepted;
  checkbox.disabled = !(termsRead && privacyRead);
  const status = consentForm.querySelector('[data-legal-reading-status]');
  if (termsRead && privacyRead) {
    status.textContent = 'Você percorreu os dois documentos até o final. O aceite está disponível.';
  } else {
    const readDocuments = [
      termsRead ? 'Termos de Uso' : '',
      privacyRead ? 'Política de Privacidade' : '',
    ].filter(Boolean);
    status.textContent = readDocuments.length
      ? `Documento percorrido até o final: ${readDocuments.join(', ')}. Leia o outro documento até o final para liberar o aceite.`
      : 'Leia os Termos de Uso e a Política de Privacidade até o final para liberar o aceite.';
  }
}

document.addEventListener('scroll', (event) => {
  if (!(event.target instanceof Element) || !event.target.matches('[data-legal-dialog-content]')) return;
  const dialog = event.target.closest('dialog[data-legal-modal]');
  if (dialog) updateLegalConsentReading(dialog);
}, true);

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  const dialog = document.querySelector('dialog[data-legal-modal][open]');
  if (!dialog) return;
  event.preventDefault();
  dialog.close();
});

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
  if (!synchronized && !window.confirm('Ainda há alterações que não foram confirmadas pela nuvem. Elas podem ser descartadas ao sair. Deseja sair mesmo assim?')) {
    button.disabled = false;
    return;
  }
  try {
    await cancelPomodoroPushSchedule();
  } catch {
    if (!window.confirm('Não foi possível cancelar os avisos Push do Pomodoro. Eles podem continuar neste dispositivo. Deseja sair mesmo assim?')) {
      button.disabled = false;
      return;
    }
  }
  const { error } = await accountSession.client.auth.signOut({ scope: 'local' });
  if (error) {
    button.disabled = false;
    toast('Não foi possível encerrar a sessão. Tente novamente antes de compartilhar este dispositivo.');
    return;
  }
  Persist.wipe();
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

startAurora().catch((error) => {
  console.error('Aurora: a inicialização segura falhou.', error);
  showAccountStartupError(document.getElementById('app'), 'Não foi possível carregar os módulos de conta. Inicie o projeto com `npm run dev`; a demonstração pública não exige login.');
});
