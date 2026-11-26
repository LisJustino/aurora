import { $ } from '../utils/dom.js';
import { dk, isDay, normalizeDay, today } from '../utils/dates.js';
import { filterValidRecords, isPlainObject } from '../core/data-integrity.js';
import { isValidAccountType, normalizeAccountType } from '../features/finance/accounts.js';
import { createToastController } from '../features/feedback/toast.js';
import { isValidFeedbackPromptNextAt, normalizeFeedbackPromptNextAt } from '../features/feedback/prompt.js';
import { isValidAreaTutorialsSeen, normalizeAreaTutorialsSeen } from '../features/area-guides.js';
import { isTaskIconKey } from '../features/planning/task-icons.js';
import { isValidAnnualPlans, normalizeAnnualPlans } from '../features/planning/annual-plan.js';
import { normalizeCategoryRules } from '../features/finance/category-rules.js';
import { normalizeBudgetSettings } from '../features/finance/budget-insights.js';
import { isValidBirthdayReference } from '../features/profile/birthday.js';
import { normalizeProfileAppearance, PROFILE_APPEARANCE_DEFAULT } from '../features/profile/model.js';
import { isProfileAvatarImageData } from '../features/profile/avatar-image.js';
import {
  defaultHomeModes,
  defaultHomeShortcuts,
  normalizeHomeAreaColors,
  normalizeHomeLayout,
  normalizeHomeMessage,
  normalizeHomeMode,
  normalizeHomeModes,
  normalizeHomeShortcuts,
} from '../features/home/personalization.js';
import { isValidHabit, normalizeHabits } from '../features/habits/model.js';
import { isValidWaterGoalMl } from '../features/habits/water-goal.js';
import { hexOk, LOOK_DEFAULT, PALETTES } from '../features/appearance/palettes.js';
import {
  DEFAULT_MENU_ORDER,
  DEFAULT_VISIBLE_MENU_ITEMS,
  isValidMenuOrder,
  isValidVisibleMenuItems,
  normalizeMenuOrder,
  normalizeVisibleMenuItems,
} from '../features/navigation/menu.js';
import { REPEATS } from '../features/planning/recurrence.js';
import { isValidTrashEntry as isValidTrashEntryModel, normalizeTrash } from '../features/trash/model.js';
import { isValidCycleSexualLog, isValidCycleSocialLog, isValidCycleTrackingLog } from '../features/cycle/log.js';
import {
  CAT_ICONS,
  categoryLeafName,
  categoryPathParts,
  DEF_LISTS,
  defaultHomeLayout,
  defCats,
  isTime,
  norm,
  normalizeCategoryEntry,
  preserveCopyTerms,
  SEX,
} from './core.js';
import { Persist, saveSlices } from './persistence.js';
import { render } from './render.js';
import { toast } from './samples-backup.js';

// Estado
export const defaults = () => ({
  tasks: [],
  habits: [],
  settings: {
    profile: { name: '', preferredName: '', sex: '', age: null, weightKg: null, heightCm: null },
    areas: { finances: false, gym: false, water: false, cycle: false, habits: false },
    theme: 'rose',
    look: { ...LOOK_DEFAULT },
    lists: DEF_LISTS.map((x) => ({ ...x })),
    cats: defCats(),
    weightTracking: false,
    onboardingComplete: false,
    introSeen: false,
    prefs: {
      waterGoalMl: 2000,
      vibrationEnabled: true,
      financeValuesHidden: false,
      cycleDiscreet: false,
      backupReminderSnoozedUntil: null,
      birthday: null,
      birthdayCorrectionUsed: false,
      areaTutorialsSeen: [],
      firstStepsDismissed: false,
      firstStepsStarted: false,
      menuOrder: [...DEFAULT_MENU_ORDER],
      visibleMenuItems: [...DEFAULT_VISIBLE_MENU_ITEMS],
      homeLayout: defaultHomeLayout(),
      homeMode: 'overview',
      homeModes: defaultHomeModes(),
      homeShortcuts: defaultHomeShortcuts(),
      homeMessage: '',
      areaColors: {},
      profileAppearance: { ...PROFILE_APPEARANCE_DEFAULT },
      annualPlans: {},
      financeCategoryRules: [],
      financeBudgetSettings: {},
      lastBackup: null,
      feedbackPromptNextAt: null,
      sample: false,
      weeklyReviewReminder: false,
      weeklyReflection: null,
      trash: [],
    },
  },
  water: [],
  gym: { templates: [], logs: [] },
  finance: { accounts: [], tx: [], budgets: {}, goals: [], recurring: [] },
  cycle: [],
  cycleLog: {},
  weight: [],
});
export const SLICES = Object.keys(defaults());
export let S = defaults();
export let accountSession = null;
export let releaseNoticePending = false;
export let pwaRegistration = null;
export let pwaReloading = false;
export let pwaApplying = false;
export let pwaUpdateAutoBlocked = false;
export let pwaSupportPromise = null;
export const syncState = {
  pending: new Set(),
  failed: new Set(),
  conflicts: new Set(),
};
export const ui = {
  preview: false,
  feedbackPromptVisible: false,
  feedbackPromptScheduleAttempted: false,
  dragId: null,
  quickActionsOpen: false,
  planView: 'lista',
  annualYear: String(Math.max(2026, Number(today().slice(0, 4)) + 1)),
  annualEditingGoalId: '',
  annualGoalFormOpen: false,
  annualGoalQuarter: '',
  annualGoalDraft: null,
  annualIdeaCategory: 'all',
  annualIdeaQuery: '',
  taskCal: dk().slice(0, 7),
  taskWeek: today(),
  taskDay: dk(),
  googleCalendar: { status: 'disconnected', accounts: [], error: '', requestId: 0 },
  habitMonth: today().slice(0, 7),
  habitTab: 'hoje',
  habitReordering: false,
  habitHistoryId: '',
  habitWeekOpen: {},
  habitSuggestions: null,
  habitIdeaCategory: 'all',
  habitIdeaTag: 'all',
  habitIdeasExpanded: false,
  profileDraft: null,
  profileSaving: false,
  profileImageBusy: false,
  settingsDraft: null,
  settingsDraftBase: null,
  settingsMenuOpen: false,
  settingsSaving: false,
  route: 'inicio',
  status: 'local',
  toast: null,
  dlg: null,
  dlgPending: null,
  confirmPrevious: null,
  confirmResolver: null,
  confirmedAction: null,
  returnDialog: null,
  focusActive: false,
  financeValuesHidden: false,
  financeWeekDay: '',
  settingsTab: 'profile',
  trashFilter: 'all',
  trashQuery: '',
  pwaUpdateAvailable: false,
  pwaUpdateDismissed: false,
  exploreNoticeDismissed: false,
  filters: { f: 'todas', q: '', sort: 'prazo' },
  finMonth: dk().slice(0, 7),
  finTab: 'resumo',
  finPlanTab: 'limites',
  finReportTab: 'resumo',
  finViewMode: 'lista',
  finCalDay: '',
  finTag: '',
  finFlowRange: '6m',
  finForecastDays: 30,
  finForecastExpanded: false,
  finBudgetQ: '',
  finInvoiceShift: {},
  finFilter: 'todos',
  finAcc: '',
  finQ: '',
  finCat: '',
  repKind: 'out',
  repAcc: '',
  repCat: '',
  repBasis: 'competence',
  calMonth: dk().slice(0, 7),
  cycSymptomFilter: '',
  openDetails: {},
  persistFailed: new Set(),
  persistError: '',
  persistBlocked: new Set(),
  integrityIssues: {},
  legacyImport: {
    step: 'start',
    browserData: null,
    discovery: null,
    error: '',
    busy: false,
    completed: false,
    cleanup: null,
    cleanupConfirmed: false,
  },
};
ui.habitCelebrationDay = '';
export const toastController = createToastController({
  readToast: () => ui.toast,
  writeToast: (toast) => {
    ui.toast = toast;
  },
  getContext: () => ({ top: Boolean(ui.dlg || ui.quickActionsOpen) }),
  getOverride: () => {
    if (Object.keys(ui.integrityIssues).length) {
      const slices = Object.keys(ui.integrityIssues).join(', ');
      return `Dados inválidos em ${slices}. A gravação está bloqueada; revise Dados e recuperação em Ajustes.`;
    }
    if (ui.persistFailed.size) {
      return {
        message: 'Não foi possível salvar as alterações. Confira sua conexão e tente novamente.',
        details: ui.persistError,
      };
    }
    return null;
  },
  normalizeMessage: preserveCopyTerms,
});
ui.cycleConsentBusy = false;
ui.cycleConsentError = '';
export const stamps = {};
const cloneSettings = (settings) => JSON.parse(JSON.stringify(settings));
export function sameJsonValue(a, b) {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((value, index) => sameJsonValue(value, b[index]))
    );
  }
  const keysA = Object.keys(a).sort();
  const keysB = Object.keys(b).sort();
  return (
    keysA.length === keysB.length && keysA.every((key, index) => key === keysB[index] && sameJsonValue(a[key], b[key]))
  );
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
export function settingsView() {
  return ui.settingsDraft ? mergeSettingsDraft(ui.settingsDraftBase, ui.settingsDraft, S.settings) : S.settings;
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
export function updateSettingsDraft(update, shouldRender = true) {
  if (!ui.settingsDraft) {
    ui.settingsDraftBase = cloneSettings(S.settings);
    ui.settingsDraft = cloneSettings(S.settings);
  }
  update(ui.settingsDraft);
  if (shouldRender) render();
  scheduleSettingsAutosave();
}
export function settingsDraftDirty() {
  return Boolean(ui.settingsDraft && JSON.stringify(settingsView()) !== JSON.stringify(S.settings));
}
let settingsAutosaveTimer = null;
export let profileAutosaveTimer = null;
function scheduleSettingsAutosave() {
  clearTimeout(settingsAutosaveTimer);
  settingsAutosaveTimer = setTimeout(() => {
    settingsAutosaveTimer = null;
    void saveSettingsDraft();
  }, 250);
}
export function scheduleProfileAutosave(delay = 500) {
  clearTimeout(profileAutosaveTimer);
  profileAutosaveTimer = null;
  if (!ui.profileDraft) return;
  profileAutosaveTimer = setTimeout(() => {
    profileAutosaveTimer = null;
    if (ui.profileSaving || ui.settingsSaving || ui.profileImageBusy) return;
    void saveProfileDraft();
  }, delay);
}
export async function saveSettingsDraft() {
  if (!settingsDraftDirty()) return true;
  if (ui.settingsSaving || ui.profileSaving) return false;
  const previousSettings = cloneSettings(S.settings);
  const draft = settingsView();
  let saveAgain = false;
  ui.settingsSaving = true;
  render();
  try {
    S.settings = normalizeSettings(draft);
    if (!saveSlices('settings')) {
      S.settings = previousSettings;
      return false;
    }
    if (!ui.preview && !(await Persist.flush())) {
      S.settings = previousSettings;
      return false;
    }
    const latestDraft = settingsView();
    if (sameJsonValue(latestDraft, S.settings)) {
      ui.settingsDraft = null;
      ui.settingsDraftBase = null;
    } else {
      ui.settingsDraftBase = cloneSettings(S.settings);
      ui.settingsDraft = cloneSettings(latestDraft);
      saveAgain = true;
    }
    if (!saveAgain) toast(ui.preview ? 'Salvo nesta demonstração.' : 'Salvo.', 'success');
    return !saveAgain;
  } catch (error) {
    console.error('Aurora: não foi possível preparar os ajustes para salvar.', error);
    S.settings = previousSettings;
    toast('Não foi possível salvar os ajustes. Suas alterações continuam na tela; tente novamente.', 'error');
    return false;
  } finally {
    ui.settingsSaving = false;
    render();
    if (saveAgain) scheduleSettingsAutosave();
    if (ui.profileDraft) scheduleProfileAutosave();
  }
}
export async function saveProfileDraft() {
  clearTimeout(profileAutosaveTimer);
  profileAutosaveTimer = null;
  if (!ui.profileDraft) return true;
  if (ui.profileSaving || ui.settingsSaving || ui.profileImageBusy) return false;
  const draft = {
    ...ui.profileDraft,
    appearance: normalizeProfileAppearance(ui.profileDraft.appearance),
  };
  const ageInput = String(draft.age ?? '').trim();
  const age = ageInput ? Number(ageInput) : null;
  if (!draft.name.trim()) {
    toast('Informe seu nome.', 'error');
    $('#pname')?.focus();
    return false;
  }
  if (!draft.preferredName.trim()) {
    toast('Informe como prefere ser chamado(a).', 'error');
    $('#ppreferred')?.focus();
    return false;
  }
  if (!Object.hasOwn(SEX, draft.sex)) {
    toast('Selecione uma identidade de gênero.', 'error');
    $('#psex')?.focus();
    return false;
  }
  if (ageInput && (!Number.isInteger(age) || age < 0 || age > 120)) {
    toast('A idade deve ser um número inteiro entre 0 e 120 anos.', 'error');
    $('#page')?.focus();
    return false;
  }
  const previousSettings = cloneSettings(S.settings);
  ui.profileSaving = true;
  let saveAgain = false;
  let renderAfterSave = false;
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
      toast('Não foi possível salvar as alterações. Tente novamente.', 'error');
      renderAfterSave = true;
      return false;
    }
    if (!ui.preview && !(await Persist.flush())) {
      S.settings = previousSettings;
      renderAfterSave = true;
      return false;
    }
    if (!ui.profileDraft || sameJsonValue(ui.profileDraft, draft)) {
      ui.profileDraft = null;
      toast(
        ui.preview
          ? 'Alterações aplicadas nesta demonstração; elas não serão salvas após sair.'
          : 'Perfil salvo automaticamente.',
        'success',
      );
    } else {
      saveAgain = true;
    }
    return !saveAgain;
  } catch (error) {
    S.settings = previousSettings;
    console.error('Aurora: não foi possível salvar o perfil.', error);
    toast('Não foi possível salvar o perfil. Suas alterações continuam na tela; tente novamente.', 'error');
    renderAfterSave = true;
    return false;
  } finally {
    ui.profileSaving = false;
    if (renderAfterSave) render();
    if (saveAgain) scheduleProfileAutosave();
    if (settingsDraftDirty()) scheduleSettingsAutosave();
  }
}
export let habitsTemplate = null;
export let habitsTemplatePromise = null;
export let habitsTemplateError = false;
export let renderHabitsView = null;
export let loadHabitsTemplate = null;
export let renderHabitsTemplate = null;
export let estimatedCyclePhase = null;
export let renderCycleView = null;
export let cycleDialogViews = null;
export let cycleModulesPromise = null;
export let financeDialogViews = null;
export let financePrivacyNotice = null;
export let renderFinanceView = null;
export let financeModulesPromise = null;
export let renderedRoute = null;
export const routeScrollPositions = new Map();

export function normalizeSettings(s) {
  const d = defaults().settings;
  const source = isPlainObject(s) ? s : {};
  const profile = isPlainObject(source.profile) ? source.profile : {};
  const areas = isPlainObject(source.areas) ? source.areas : {};
  const prefs = isPlainObject(source.prefs) ? source.prefs : {};
  const o = { ...d, ...source };
  o.profile = { ...d.profile, ...profile };
  o.profile.name = typeof profile.name === 'string' ? profile.name.slice(0, 50) : d.profile.name;
  o.profile.preferredName =
    typeof profile.preferredName === 'string' && profile.preferredName.trim()
      ? profile.preferredName.slice(0, 50)
      : o.profile.name;
  o.profile.sex = Object.hasOwn(SEX, profile.sex) ? profile.sex : '';
  o.profile.age = Number.isInteger(profile.age) && profile.age >= 0 && profile.age <= 120 ? profile.age : null;
  o.profile.weightKg =
    Number.isFinite(profile.weightKg) && profile.weightKg >= 20 && profile.weightKg <= 400 ? profile.weightKg : null;
  o.profile.heightCm =
    Number.isInteger(profile.heightCm) && profile.heightCm >= 80 && profile.heightCm <= 250 ? profile.heightCm : null;
  o.areas = Object.fromEntries(
    Object.keys(d.areas).map((key) => [key, typeof areas[key] === 'boolean' ? areas[key] : d.areas[key]]),
  );
  o.prefs = { ...d.prefs, ...prefs };
  o.prefs.annualPlans = normalizeAnnualPlans(prefs.annualPlans);
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
  o.prefs.financeCategoryRules = normalizeCategoryRules(prefs.financeCategoryRules);
  o.prefs.financeBudgetSettings = normalizeBudgetSettings(prefs.financeBudgetSettings);
  o.prefs.waterGoalMl =
    Number.isInteger(prefs.waterGoalMl) && prefs.waterGoalMl >= 500 && prefs.waterGoalMl <= 10000
      ? prefs.waterGoalMl
      : d.prefs.waterGoalMl;
  o.prefs.habitWaterGoals = Object.fromEntries(
    Object.entries(isPlainObject(prefs.habitWaterGoals) ? prefs.habitWaterGoals : {}).filter(
      ([id, goal]) => id.length <= 200 && isValidWaterGoalMl(goal),
    ),
  );
  o.prefs.birthday = isValidBirthdayReference(prefs.birthday) ? { ...prefs.birthday } : null;
  o.prefs.birthdayCorrectionUsed = prefs.birthdayCorrectionUsed === true;
  o.prefs.vibrationEnabled = typeof prefs.vibrationEnabled === 'boolean' ? prefs.vibrationEnabled : true;
  o.prefs.financeValuesHidden = prefs.financeValuesHidden === true;
  o.prefs.cycleDiscreet = prefs.cycleDiscreet === true;
  o.prefs.backupReminderSnoozedUntil =
    typeof prefs.backupReminderSnoozedUntil === 'string' &&
    Number.isFinite(Date.parse(prefs.backupReminderSnoozedUntil))
      ? prefs.backupReminderSnoozedUntil
      : null;
  o.prefs.firstStepsDismissed = prefs.firstStepsDismissed === true;
  o.prefs.firstStepsStarted = prefs.firstStepsStarted === true;
  o.prefs.sample = typeof prefs.sample === 'boolean' ? prefs.sample : d.prefs.sample;
  o.prefs.weeklyReviewReminder = prefs.weeklyReviewReminder === true;
  o.prefs.lastBackup =
    typeof prefs.lastBackup === 'string' && Number.isFinite(Date.parse(prefs.lastBackup)) ? prefs.lastBackup : null;
  o.prefs.feedbackPromptNextAt = normalizeFeedbackPromptNextAt(prefs.feedbackPromptNextAt);
  o.prefs.weeklyReflection =
    isPlainObject(prefs.weeklyReflection) &&
    isDay(prefs.weeklyReflection.weekOf) &&
    typeof prefs.weeklyReflection.text === 'string' &&
    prefs.weeklyReflection.text.length <= 500
      ? { weekOf: prefs.weeklyReflection.weekOf, text: prefs.weeklyReflection.text }
      : null;
  o.prefs.trash = normalizeTrash(prefs.trash === undefined ? [] : prefs.trash, isValidTrashEntry).entries;
  o.weightTracking = typeof source.weightTracking === 'boolean' ? source.weightTracking : d.weightTracking;
  o.onboardingComplete =
    typeof source.onboardingComplete === 'boolean' ? source.onboardingComplete : d.onboardingComplete;
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
  const cleanL = (a, withIcon) =>
    (Array.isArray(a) ? a : [])
      .filter((x) => x && typeof x.name === 'string' && x.name.trim())
      .slice(0, 60)
      .map((x) => ({
        name: x.name.trim().slice(0, 30),
        color: hexOk(x.color) ? x.color : '#8b8b95',
        ...(withIcon
          ? { icon: CAT_ICONS.includes(x.icon) ? x.icon : 'tag' }
          : typeof x.folder === 'string' && x.folder.trim()
            ? { folder: x.folder.trim().slice(0, 30) }
            : {}),
      }));
  const cleanCategoryGroup = (a, kind) =>
    (Array.isArray(a) ? a : [])
      .map((category) => normalizeCategoryEntry(category, kind, {}, true, true))
      .filter(Boolean)
      .slice(0, 60);
  o.lists = cleanL(s?.lists);
  if (!o.lists.length) o.lists = DEF_LISTS.map((x) => ({ ...x }));
  const dc = defCats();
  o.cats = { out: cleanCategoryGroup(s?.cats?.out, 'out'), in: cleanCategoryGroup(s?.cats?.in, 'in') };
  if (!o.cats.out.length) o.cats.out = dc.out;
  if (!o.cats.in.length) o.cats.in = dc.in;
  if (!PALETTES[o.theme] && o.theme !== 'custom') o.theme = 'rose';
  delete o.accountTypes;
  return o;
}
export function currentProfileAge(settings) {
  return settings?.profile?.age ?? null;
}
const optional = (record, key, predicate) => !Object.hasOwn(record, key) || predicate(record[key]);
export const isText = (value) => typeof value === 'string';
export const isNonEmptyText = (value) => isText(value) && value.trim().length > 0;
export const isFiniteValue = (value) => typeof value === 'number' && Number.isFinite(value);
export const isSafeInteger = (value) => Number.isSafeInteger(value);
const isIsoTimestamp = (value) => isText(value) && Number.isFinite(Date.parse(value));
export const isValidTask = (record) =>
  isPlainObject(record) &&
  isNonEmptyText(record.id) &&
  isText(record.title) &&
  optional(record, 'done', (value) => typeof value === 'boolean') &&
  optional(record, 'tag', isText) &&
  optional(record, 'dueDate', (value) => value === null || isDay(value)) &&
  optional(record, 'priority', (value) => ['low', 'normal', 'high'].includes(value)) &&
  optional(record, 'icon', isTaskIconKey) &&
  optional(record, 'createdAt', isFiniteValue) &&
  optional(record, 'focusSeconds', (value) => Number.isSafeInteger(value) && value >= 0) &&
  optional(record, 'doneAt', (value) => value === undefined || isIsoTimestamp(value)) &&
  optional(record, 'time', isTime) &&
  optional(record, 'repeat', (value) => Object.hasOwn(REPEATS, value)) &&
  optional(record, 'tags', (value) => Array.isArray(value) && value.every(isText)) &&
  optional(record, 'notes', isText) &&
  optional(record, 'order', isFiniteValue) &&
  optional(record, 'groupId', isText) &&
  optional(record, 'groupTitle', isText) &&
  optional(record, 'sample', (value) => typeof value === 'boolean') &&
  optional(
    record,
    'subtasks',
    (value) =>
      Array.isArray(value) &&
      value.every(
        (item) =>
          isPlainObject(item) &&
          isText(item.title) &&
          optional(item, 'id', isNonEmptyText) &&
          optional(item, 'done', (done) => typeof done === 'boolean'),
      ),
  );
const isValidWaterEntry = (record) =>
  isPlainObject(record) &&
  isNonEmptyText(record.id) &&
  isFiniteValue(record.ml) &&
  record.ml > 0 &&
  isIsoTimestamp(record.at);
const isValidGymTemplate = (record) =>
  isPlainObject(record) &&
  isNonEmptyText(record.id) &&
  isText(record.name) &&
  Array.isArray(record.exercises) &&
  record.exercises.every(isText);
const isValidGymLog = (record) =>
  isPlainObject(record) &&
  isNonEmptyText(record.id) &&
  isDay(record.date) &&
  optional(record, 'name', isText) &&
  optional(record, 'minutes', isFiniteValue) &&
  optional(record, 'notes', isText);
const isValidAccount = (record) =>
  isPlainObject(record) &&
  isNonEmptyText(record.id) &&
  isText(record.name) &&
  isValidAccountType(record.type) &&
  isSafeInteger(record.initialCents) &&
  optional(record, 'bank', isText) &&
  optional(record, 'linkedAccountId', isNonEmptyText) &&
  optional(record, 'limitCents', (value) => isSafeInteger(value) && value >= 0) &&
  optional(record, 'closingDay', (value) => Number.isInteger(value) && value >= 0 && value <= 31) &&
  optional(record, 'dueDay', (value) => Number.isInteger(value) && value >= 0 && value <= 31);
const isValidTransaction = (record) =>
  isPlainObject(record) &&
  isNonEmptyText(record.id) &&
  ['in', 'out', 'tr'].includes(record.type) &&
  isNonEmptyText(record.accountId) &&
  isSafeInteger(record.cents) &&
  record.cents > 0 &&
  isDay(record.date) &&
  optional(record, 'settledDate', isDay) &&
  optional(record, 'interestCents', (value) => isSafeInteger(value) && value >= 0 && value <= record.cents) &&
  optional(record, 'anticipatedDate', isDay) &&
  optional(record, 'groupId', isText) &&
  optional(record, 'invoiceInstallment', (value) => typeof value === 'boolean') &&
  optional(record, 'category', isText) &&
  optional(record, 'desc', isText) &&
  optional(record, 'paid', (value) => typeof value === 'boolean') &&
  optional(record, 'createdAt', isFiniteValue) &&
  optional(record, 'toAccountId', isNonEmptyText) &&
  (record.type !== 'tr' || isNonEmptyText(record.toAccountId)) &&
  (record.invoiceInstallment !== true || (record.type === 'tr' && isNonEmptyText(record.groupId)));
const isValidGoal = (record) =>
  isPlainObject(record) &&
  isNonEmptyText(record.id) &&
  isNonEmptyText(record.name) &&
  record.name.length <= 50 &&
  isSafeInteger(record.targetCents) &&
  record.targetCents > 0 &&
  isSafeInteger(record.savedCents) &&
  record.savedCents >= 0 &&
  optional(record, 'deadline', (value) => value === '' || value === null || isDay(value)) &&
  optional(record, 'linkedAccountId', isNonEmptyText);
const isValidRecurring = (record) =>
  isPlainObject(record) &&
  isNonEmptyText(record.id) &&
  ['in', 'out'].includes(record.type) &&
  isNonEmptyText(record.accountId) &&
  isText(record.category) &&
  isSafeInteger(record.cents) &&
  record.cents > 0 &&
  Number.isInteger(record.day) &&
  record.day >= 1 &&
  record.day <= 31 &&
  /^\d{4}-(0[1-9]|1[0-2])$/.test(record.startYM) &&
  optional(record, 'lastYM', (value) => value === null || /^\d{4}-(0[1-9]|1[0-2])$/.test(value)) &&
  optional(record, 'desc', isText) &&
  optional(record, 'firstPaid', (value) => typeof value === 'boolean') &&
  optional(record, 'paused', (value) => typeof value === 'boolean');
export const isValidCycleLog = (record) =>
  isPlainObject(record) &&
  ['flow', 'energy', 'sleep', 'discharge', 'note'].every((key) => optional(record, key, isText)) &&
  ['pain', 'mood', 'digestion', 'skin'].every((key) =>
    optional(record, key, (value) => Array.isArray(value) && value.every(isText)),
  ) &&
  isValidCycleSocialLog(record) &&
  isValidCycleTrackingLog(record) &&
  optional(record, 'orgasmCount', (value) => Number.isInteger(value) && value >= 0 && value <= 99) &&
  isValidCycleSexualLog(record);
const isValidCycleEntry = (record) =>
  isPlainObject(record) &&
  isDay(record.start) &&
  optional(record, 'end', (value) => value === null || (isDay(value) && value >= record.start));
const isValidWeight = (record) =>
  isPlainObject(record) &&
  isNonEmptyText(record.id) &&
  isFiniteValue(record.kg) &&
  record.kg >= 20 &&
  record.kg <= 400 &&
  isDay(record.date);
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
  if (
    !isPlainObject(record) ||
    !isNonEmptyText(record.key) ||
    !Number.isSafeInteger(record.index) ||
    record.index < 0 ||
    !isPlainObject(record.value)
  )
    return false;
  if (record.collection === 'cycleLog') return isDay(record.key) && isValidCycleLog(record.value);
  if (record.collection === 'cycle') {
    return isValidCycleEntry(record.value) && record.key === `${record.value.start}|${record.value.end || ''}`;
  }
  if (record.collection === 'finance.budgets') {
    return isPlainObject(record.value) && isSafeInteger(record.value.cents) && record.value.cents > 0;
  }
  const validator = TRASH_RECORD_VALIDATORS[record.collection];
  return Boolean(validator && validator(record.value) && record.key === record.value.id);
};
export const isValidTrashEntry = (entry) => isValidTrashEntryModel(entry, isValidTrashRecord);
const recordsOrEmpty = (value, validator) =>
  value == null ? { records: [], rejectedCount: 0 } : filterValidRecords(value, validator);

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
    if (
      Object.hasOwn(profile, 'preferredName') &&
      profile.preferredName !== undefined &&
      !isText(profile.preferredName)
    )
      issues++;
    if (
      Object.hasOwn(profile, 'sex') &&
      profile.sex !== undefined &&
      profile.sex !== '' &&
      !Object.hasOwn(SEX, profile.sex)
    )
      issues++;
    if (
      Object.hasOwn(profile, 'age') &&
      profile.age !== undefined &&
      profile.age !== null &&
      !(Number.isInteger(profile.age) && profile.age >= 0 && profile.age <= 120)
    )
      issues++;
    if (
      Object.hasOwn(profile, 'weightKg') &&
      profile.weightKg !== undefined &&
      profile.weightKg !== null &&
      !(isFiniteValue(profile.weightKg) && profile.weightKg >= 20 && profile.weightKg <= 400)
    )
      issues++;
    if (
      Object.hasOwn(profile, 'heightCm') &&
      profile.heightCm !== undefined &&
      profile.heightCm !== null &&
      !(Number.isInteger(profile.heightCm) && profile.heightCm >= 80 && profile.heightCm <= 250)
    )
      issues++;
  }
  if (isPlainObject(value.areas)) {
    issues += Object.keys(defaults().settings.areas).filter(
      (key) => Object.hasOwn(value.areas, key) && typeof value.areas[key] !== 'boolean',
    ).length;
  }
  if (isPlainObject(value.prefs)) {
    const prefs = value.prefs;
    if (
      Object.hasOwn(prefs, 'profileAppearance') &&
      (!isPlainObject(prefs.profileAppearance) ||
        (Object.hasOwn(prefs.profileAppearance, 'avatarImage') &&
          !isProfileAvatarImageData(prefs.profileAppearance.avatarImage)))
    )
      issues++;
    if (Object.hasOwn(prefs, 'annualPlans') && !isValidAnnualPlans(prefs.annualPlans)) issues++;
    if (Object.hasOwn(prefs, 'birthday') && prefs.birthday !== null && !isValidBirthdayReference(prefs.birthday))
      issues++;
    if (Object.hasOwn(prefs, 'birthdayCorrectionUsed') && typeof prefs.birthdayCorrectionUsed !== 'boolean') issues++;
    if (Object.hasOwn(prefs, 'financeValuesHidden') && typeof prefs.financeValuesHidden !== 'boolean') issues++;
    if (Object.hasOwn(prefs, 'cycleDiscreet') && typeof prefs.cycleDiscreet !== 'boolean') issues++;
    if (
      Object.hasOwn(prefs, 'backupReminderSnoozedUntil') &&
      prefs.backupReminderSnoozedUntil !== null &&
      (!isText(prefs.backupReminderSnoozedUntil) || !Number.isFinite(Date.parse(prefs.backupReminderSnoozedUntil)))
    )
      issues++;
    if (Object.hasOwn(prefs, 'firstStepsDismissed') && typeof prefs.firstStepsDismissed !== 'boolean') issues++;
    if (Object.hasOwn(prefs, 'firstStepsStarted') && typeof prefs.firstStepsStarted !== 'boolean') issues++;
    if (Object.hasOwn(prefs, 'menuOrder') && prefs.menuOrder !== undefined && !isValidMenuOrder(prefs.menuOrder))
      issues++;
    if (
      Object.hasOwn(prefs, 'visibleMenuItems') &&
      prefs.visibleMenuItems !== undefined &&
      !isValidVisibleMenuItems(prefs.visibleMenuItems)
    )
      issues++;
    if (
      Object.hasOwn(prefs, 'areaTutorialsSeen') &&
      prefs.areaTutorialsSeen !== undefined &&
      !isValidAreaTutorialsSeen(prefs.areaTutorialsSeen)
    )
      issues++;
    ['waterGoalMl'].forEach((key) => {
      if (
        Object.hasOwn(prefs, key) &&
        prefs[key] !== undefined &&
        !(Number.isInteger(prefs[key]) && prefs[key] >= 500 && prefs[key] <= 10000)
      )
        issues++;
    });
    if (Object.hasOwn(prefs, 'sample') && prefs.sample !== undefined && typeof prefs.sample !== 'boolean') issues++;
    if (
      Object.hasOwn(prefs, 'vibrationEnabled') &&
      prefs.vibrationEnabled !== undefined &&
      typeof prefs.vibrationEnabled !== 'boolean'
    )
      issues++;
    if (
      Object.hasOwn(prefs, 'weeklyReviewReminder') &&
      prefs.weeklyReviewReminder !== undefined &&
      typeof prefs.weeklyReviewReminder !== 'boolean'
    )
      issues++;
    if (
      Object.hasOwn(prefs, 'lastBackup') &&
      prefs.lastBackup !== undefined &&
      prefs.lastBackup !== null &&
      (!isText(prefs.lastBackup) || !Number.isFinite(Date.parse(prefs.lastBackup)))
    )
      issues++;
    if (Object.hasOwn(prefs, 'feedbackPromptNextAt') && !isValidFeedbackPromptNextAt(prefs.feedbackPromptNextAt))
      issues++;
    if (
      Object.hasOwn(prefs, 'weeklyReflection') &&
      prefs.weeklyReflection !== null &&
      (!isPlainObject(prefs.weeklyReflection) ||
        !isDay(prefs.weeklyReflection.weekOf) ||
        !isText(prefs.weeklyReflection.text) ||
        prefs.weeklyReflection.text.length > 500)
    )
      issues++;
    if (Object.hasOwn(prefs, 'trash') && prefs.trash !== undefined) {
      issues += normalizeTrash(withoutRemovedStudyTrash(prefs.trash), isValidTrashEntry).rejectedCount;
    }
  }
  if (Object.hasOwn(value, 'look') && isPlainObject(value.look)) {
    const look = value.look;
    if (Object.hasOwn(look, 'mode') && look.mode !== undefined && !['auto', 'light', 'dark'].includes(look.mode))
      issues++;
    if (Object.hasOwn(look, 'density') && look.density !== undefined && !['comfy', 'compact'].includes(look.density))
      issues++;
    if (Object.hasOwn(look, 'font') && look.font !== undefined && !['s', 'm', 'l'].includes(look.font)) issues++;
    if (Object.hasOwn(look, 'contrast') && look.contrast !== undefined && typeof look.contrast !== 'boolean') issues++;
    if (Object.hasOwn(look, 'readable') && look.readable !== undefined && typeof look.readable !== 'boolean') issues++;
    if (
      Object.hasOwn(look, 'highlightLinks') &&
      look.highlightLinks !== undefined &&
      typeof look.highlightLinks !== 'boolean'
    )
      issues++;
    if (
      Object.hasOwn(look, 'reduceMotion') &&
      look.reduceMotion !== undefined &&
      typeof look.reduceMotion !== 'boolean'
    )
      issues++;
    if (Object.hasOwn(look, 'weekStart') && look.weekStart !== undefined && ![0, 1, '0', '1'].includes(look.weekStart))
      issues++;
    if (Object.hasOwn(look, 'start') && look.start !== undefined && typeof look.start !== 'string') issues++;
    if (Object.hasOwn(look, 'custom') && look.custom !== undefined && !hexOk(look.custom)) issues++;
  }
  if (Object.hasOwn(value, 'theme') && value.theme !== undefined && !PALETTES[value.theme] && value.theme !== 'custom')
    issues++;
  if (
    Object.hasOwn(value, 'weightTracking') &&
    value.weightTracking !== undefined &&
    typeof value.weightTracking !== 'boolean'
  )
    issues++;
  if (
    Object.hasOwn(value, 'onboardingComplete') &&
    value.onboardingComplete !== undefined &&
    typeof value.onboardingComplete !== 'boolean'
  )
    issues++;
  if (Object.hasOwn(value, 'introSeen') && value.introSeen !== undefined && typeof value.introSeen !== 'boolean')
    issues++;
  if (Object.hasOwn(value, 'lists') && value.lists !== undefined) {
    if (!Array.isArray(value.lists)) issues++;
    else
      issues += value.lists.filter(
        (item) =>
          !isPlainObject(item) ||
          !isNonEmptyText(item.name) ||
          optional(item, 'color', hexOk) === false ||
          optional(item, 'folder', isText) === false,
      ).length;
  }
  if (Object.hasOwn(value, 'accountTypes') && value.accountTypes !== undefined) {
    if (!Array.isArray(value.accountTypes)) issues++;
    else issues += value.accountTypes.filter((key) => !isValidAccountType(key)).length;
  }
  if (Object.hasOwn(value, 'cats') && value.cats !== undefined) {
    if (!isPlainObject(value.cats)) issues++;
    else
      ['out', 'in'].forEach((key) => {
        if (!Object.hasOwn(value.cats, key)) return;
        if (!Array.isArray(value.cats[key])) {
          issues++;
          return;
        }
        issues += value.cats[key].filter(
          (item) =>
            !isPlainObject(item) ||
            !isNonEmptyText(item.name) ||
            optional(item, 'color', hexOk) === false ||
            optional(item, 'icon', (iconName) => CAT_ICONS.includes(iconName)) === false,
        ).length;
      });
  }
  return issues;
}

export function normalizeSlice(k, v) {
  const d = defaults()[k];
  if (v == null) return { value: d, invalidCount: 0 };
  if (k === 'settings') {
    return { value: normalizeSettings(v), invalidCount: settingsIssueCount(v) };
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
    else
      Object.entries(v.budgets || {}).forEach(([name, budget]) => {
        if (isNonEmptyText(name) && isPlainObject(budget) && isSafeInteger(budget.cents) && budget.cents > 0) {
          Object.defineProperty(budgets, name, { value: budget, enumerable: true, writable: true, configurable: true });
        } else invalidCount++;
      });
    const financeTx = tx.records.map((transaction) => {
      const date = normalizeDay(transaction.date) || transaction.date;
      const settledDate = transaction.settledDate
        ? normalizeDay(transaction.settledDate) || transaction.settledDate
        : undefined;
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
export function setS(value) {
  S = value;
  return value;
}

export function setAccountSession(value) {
  accountSession = value;
  return value;
}

export function setReleaseNoticePending(value) {
  releaseNoticePending = value;
  return value;
}

export function setPwaRegistration(value) {
  pwaRegistration = value;
  return value;
}

export function setPwaReloading(value) {
  pwaReloading = value;
  return value;
}

export function setPwaApplying(value) {
  pwaApplying = value;
  return value;
}

export function setPwaUpdateAutoBlocked(value) {
  pwaUpdateAutoBlocked = value;
  return value;
}

export function setPwaSupportPromise(value) {
  pwaSupportPromise = value;
  return value;
}

export function setProfileAutosaveTimer(value) {
  profileAutosaveTimer = value;
  return value;
}

export function setHabitsTemplate(value) {
  habitsTemplate = value;
  return value;
}

export function setHabitsTemplatePromise(value) {
  habitsTemplatePromise = value;
  return value;
}

export function setHabitsTemplateError(value) {
  habitsTemplateError = value;
  return value;
}

export function setRenderHabitsView(value) {
  renderHabitsView = value;
  return value;
}

export function setLoadHabitsTemplate(value) {
  loadHabitsTemplate = value;
  return value;
}

export function setRenderHabitsTemplate(value) {
  renderHabitsTemplate = value;
  return value;
}

export function setEstimatedCyclePhase(value) {
  estimatedCyclePhase = value;
  return value;
}

export function setRenderCycleView(value) {
  renderCycleView = value;
  return value;
}

export function setCycleDialogViews(value) {
  cycleDialogViews = value;
  return value;
}

export function setCycleModulesPromise(value) {
  cycleModulesPromise = value;
  return value;
}

export function setFinanceDialogViews(value) {
  financeDialogViews = value;
  return value;
}

export function setFinancePrivacyNotice(value) {
  financePrivacyNotice = value;
  return value;
}

export function setRenderFinanceView(value) {
  renderFinanceView = value;
  return value;
}

export function setFinanceModulesPromise(value) {
  financeModulesPromise = value;
  return value;
}

export function setRenderedRoute(value) {
  renderedRoute = value;
  return value;
}

// Leituras do estado que antes ficavam no núcleo
export const weekStartDay = () => {
  try {
    return settingsView().look.weekStart === 0 ? 0 : 1;
  } catch (e) {
    return 1;
  }
};
export const allTags = () =>
  [...new Set(S.tasks.flatMap((t) => t.tags || []))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
export const categoryEntries = (kind) =>
  (Array.isArray(S.settings.cats?.[kind]) ? S.settings.cats[kind] : [])
    .map((category) => normalizeCategoryEntry(category, kind))
    .filter(Boolean);
export const topCategoryNames = (kind) => categoryEntries(kind).map((category) => category.name);
export const categoryMatch = (kind, value) => {
  const target = String(value ?? '').trim();
  if (!target) return null;
  const { parent, child } = categoryPathParts(target);
  const categories = categoryEntries(kind);
  if (parent) {
    const parentEntry = categories.find((category) => norm(category.name) === norm(parent));
    if (!parentEntry) return null;
    const subcategory = (parentEntry.subcategories || []).find(
      (category) => norm(categoryLeafName(category)) === norm(child),
    );
    return subcategory
      ? { category: parentEntry, subcategory, fullName: `${parentEntry.name} > ${categoryLeafName(subcategory)}` }
      : null;
  }
  const direct = categories.find((category) => norm(category.name) === norm(target));
  if (direct) return { category: direct, subcategory: null, fullName: direct.name };
  for (const category of categories) {
    const subcategory = (category.subcategories || []).find((item) => norm(categoryLeafName(item)) === norm(target));
    if (subcategory) return { category, subcategory, fullName: `${category.name} > ${categoryLeafName(subcategory)}` };
  }
  return null;
};
export const catNames = (k) =>
  categoryEntries(k).flatMap((category) => {
    const subcategories = Array.isArray(category.subcategories)
      ? category.subcategories.map((subcategory) => `${category.name} > ${categoryLeafName(subcategory)}`)
      : [];
    return [category.name, ...subcategories];
  });
export const catInfo = (k, n) => {
  const match = categoryMatch(k, n);
  if (!match) return { c: '#8b8b95', i: 'tag' };
  const source = match.subcategory || match.category;
  return { c: source.color || '#8b8b95', i: source.icon || 'tag' };
};
