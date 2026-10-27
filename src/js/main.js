import { runStorageTransaction } from './core/backup-transaction.js';

import { readStorage, removeStorage, writeStorage } from './services/storage.js';
import { $, $$, esc, h, raw } from './utils/dom.js';
import { icon } from './utils/icons.js';
import { brl, parseMoney } from './utils/currency.js';
import {
  addDays, clock, dayDiff, DIAS, dk, dur, isoDay, isDay, longDate,
  MESES, MESES_L, pad, pk, shortDate, today,
} from './utils/dates.js';
import { newId } from './utils/ids.js';
import {
  actionNeedsProfileSetup,
} from './core/access-control.js';
import { filterValidRecords, isPlainObject } from './core/data-integrity.js';
import { resolveRoute } from './core/router.js';
import {
  accountBalance as balanceForAccount,
  byCategory as summarizeByCategory,
  cardInfo as calculateCardInfo,
  invoiceMonth,
  isCreditAccount,
  isPaid as transactionIsPaid,
  monthStats as summarizeMonth,
  netAccountBalance,
  recurringBillsDueOn,
  signedAmount,
} from './features/finance/calculations.js';
import { loadStudiesTemplate, renderStudiesTemplate } from './features/studies/template.js';
import {
  advancePomodoro,
  effectivePomodoroSettings,
  longBreakMinutes,
  normalizePomodoroHistory,
  recentFocusDays,
  POMODORO_PRESETS,
  POMODOROS_PER_LONG_BREAK,
  phaseDurationSeconds,
  phaseElapsedSeconds,
  studyElapsedSeconds,
} from './features/studies/pomodoro.js';
import {
  playPomodoroChime,
  resumePomodoroAudioContext,
} from './features/studies/pomodoro-audio.js';
import {
  cancelPomodoroPushSchedule,
  disablePomodoroPush,
  enablePomodoroPush,
  getPomodoroPushStatus,
  pomodoroPushErrorMessage,
  schedulePomodoroPush,
} from './services/pomodoro-push.js';
import { loadWaterTemplate, renderWaterTemplate } from './features/water/template.js';
import {
  createSuggestedHabits,
  habitWeeklyTarget,
  habitIsComplete,
  habitMonthDays,
  habitMonthStats,
  habitStats,
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
import { estimateWaterGoal } from './features/habits/water-goal.js';
import { hexOk, LOOK_DEFAULT, PALETTES, paletteColors } from './features/appearance/palettes.js';
import {
  DEFAULT_VISIBLE_MENU_ITEMS,
  DEFAULT_MENU_ORDER,
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
const catInfo = (k, n) => { const L = S.settings.cats[k]; const c = L.find((x) => x.name === n) || (n === 'Estudos' && L.find((x) => x.name === 'Educação')); return c ? { c: c.color, i: c.icon } : { c: '#8b8b95', i: 'tag' }; };
const LEGACY_START_PAGES = { inicio: 'Início', planejar: 'Planejar', estudos: 'Estudos' };
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
const AREAS = { pomodoro: ['Pomodoro', 'Ciclos de foco e pausa para organizar seu tempo'], finances: ['Finanças', 'Contas, entradas e saídas'], studies: ['Estudos', 'Cronômetro, matérias e histórico de estudos'], cycle: ['Ciclo', 'Registro e estimativas'], habits: ['Hábitos', 'Rotinas e histórico semanal'] };
const SEX = { f: 'Mulher', m: 'Homem', nb: 'Pessoa não binária', o: 'Outra identidade de gênero', n: 'Prefiro não informar' };
const hasRequiredProfile = (profile) => typeof profile?.name === 'string'
  && Boolean(profile.name.trim())
  && Object.hasOwn(SEX, profile.sex);
const waterWhy = (c) => `${c.kg.toLocaleString('pt-BR')} kg × ${c.per} ml = ${c.exact.toLocaleString('pt-BR')} ml, arredondado para ${c.ml.toLocaleString('pt-BR')} ml${c.assumed ? ' (sem a idade, usei 35 ml/kg)' : ''}.`;
const PRIO = { low: 'Baixa', normal: 'Normal', high: 'Alta' };
const HOME_BLOCKS = [
  ['summary', 'Resumo do dia', 'Indicadores de estudos, tarefas sem data e hidratação.'],
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
  tasks: [], subjects: [], sessions: [],
  habits: [],
  timer: { elapsedSeconds: 0, startedAt: null, subjectId: '', phase: 'focus', phaseElapsedSeconds: 0, completedPomodoros: 0, dailyCompletedPomodoros: 0, dailyCompletedOn: '' },
  pomodoro: { elapsedSeconds: 0, startedAt: null, phase: 'focus', phaseElapsedSeconds: 0, completedPomodoros: 0, dailyCompletedPomodoros: 0, dailyCompletedOn: '', focusTaskId: '' },
  settings: { profile: { name: '', sex: '', age: null, weightKg: null, heightCm: null }, areas: { pomodoro: false, finances: false, studies: false, gym: false, water: false, cycle: false, habits: false }, theme: 'rose', look: { ...LOOK_DEFAULT }, lists: DEF_LISTS.map((x) => ({ ...x })), cats: defCats(), weightTracking: false, accountTypes: ['checking', 'cash'], onboardingComplete: false, introSeen: false, prefs: { studyGoalMin: 120, waterGoalMl: 2000, menuOrder: [...DEFAULT_MENU_ORDER], visibleMenuItems: [...DEFAULT_VISIBLE_MENU_ITEMS], homeLayout: defaultHomeLayout(), pomodoro: { on: false, preset: 'classic', focusMin: 25, breakMin: 5, longBreakMin: 15 }, lastBackup: null, sample: false, weeklyReflection: null, trash: [] } },
  water: [], gym: { templates: [], logs: [] }, finance: { accounts: [], tx: [], budgets: {}, goals: [], recurring: [] }, cycle: [], cycleLog: {}, weight: [],
});
const SLICES = Object.keys(defaults());
let S = defaults();
const ui = { dragId: null, alerts: {}, fired: {}, snooze: {}, notificationsOpen: false, accessibilityOpen: false, navigationOpen: false, planView: 'lista', taskCal: dk().slice(0, 7), taskWeek: today(), taskDay: dk(), habitMonth: today().slice(0, 7), habitSuggestions: null, profileDraft: null, settingsDraft: null, settingsDraftBase: null, route: 'inicio', status: 'local', toast: null, dlg: null, dlgPending: null, confirmPrevious: null, confirmedAction: null, returnDialog: null, focusActive: false, settingsTab: 'profile', pushBusy: false, pushNotice: '', exploreNoticeDismissed: false, filters: { f: 'todas', q: '', sort: 'prazo' }, finMonth: dk().slice(0, 7), finTab: 'resumo', finFilter: 'todos', finAcc: '', finQ: '', finView: 'lista', finDay: '', finCat: '', repKind: 'out', calMonth: dk().slice(0, 7), openDetails: {}, persistFailed: new Set(), persistBlocked: new Set(), integrityIssues: {} };
const stamps = {};
const cloneSettings = (settings) => JSON.parse(JSON.stringify(settings));
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
let studiesTemplate = null;
let studiesTemplatePromise = null;
let studiesTemplateError = false;
let waterTemplate = null;
let waterTemplatePromise = null;
let waterTemplateError = false;
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
  o.profile.sex = Object.hasOwn(SEX, profile.sex) ? profile.sex : '';
  o.profile.age = Number.isInteger(profile.age) && profile.age >= 5 && profile.age <= 120 ? profile.age : null;
  o.profile.weightKg = Number.isFinite(profile.weightKg) && profile.weightKg >= 20 && profile.weightKg <= 400 ? profile.weightKg : null;
  o.profile.heightCm = Number.isInteger(profile.heightCm) && profile.heightCm >= 80 && profile.heightCm <= 250 ? profile.heightCm : null;
  o.areas = Object.fromEntries(Object.keys(d.areas).map((key) => [key, typeof areas[key] === 'boolean' ? areas[key] : d.areas[key]]));
  o.prefs = { ...d.prefs, ...prefs };
  o.prefs.menuOrder = normalizeMenuOrder(prefs.menuOrder);
  o.prefs.visibleMenuItems = normalizeVisibleMenuItems(prefs.visibleMenuItems);
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
  o.prefs.studyGoalMin = Number.isInteger(prefs.studyGoalMin) && prefs.studyGoalMin >= 10 && prefs.studyGoalMin <= 1440 ? prefs.studyGoalMin : d.prefs.studyGoalMin;
  o.prefs.waterGoalMl = Number.isInteger(prefs.waterGoalMl) && prefs.waterGoalMl >= 500 && prefs.waterGoalMl <= 10000 ? prefs.waterGoalMl : d.prefs.waterGoalMl;
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
  if (!['auto', 'light', 'dark'].includes(L.mode)) L.mode = 'auto';
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
const isValidSubject = (record) => isPlainObject(record)
  && isNonEmptyText(record.id) && isText(record.name)
  && optional(record, 'archived', (value) => typeof value === 'boolean');
const isValidSession = (record) => isPlainObject(record)
  && isNonEmptyText(record.id) && isText(record.subjectId) && isText(record.subjectName)
  && isFiniteValue(record.durationSeconds) && record.durationSeconds >= 0
  && isIsoTimestamp(record.completedAt);
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
  subjects: isValidSubject,
  sessions: isValidSession,
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
  if (record.collection === 'timer.subject') {
    return isNonEmptyText(record.value.subjectId) && record.value.subjectId === record.key;
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
    if (Object.hasOwn(prefs, 'menuOrder') && prefs.menuOrder !== undefined
      && !isValidMenuOrder(prefs.menuOrder)) issues++;
    if (Object.hasOwn(prefs, 'visibleMenuItems') && prefs.visibleMenuItems !== undefined
      && !isValidVisibleMenuItems(prefs.visibleMenuItems)) issues++;
    if (Object.hasOwn(prefs, 'pomodoro') && prefs.pomodoro !== undefined && !isPlainObject(prefs.pomodoro)) issues++;
    ['studyGoalMin', 'waterGoalMl'].forEach((key) => {
      if (Object.hasOwn(prefs, key) && prefs[key] !== undefined
        && !(Number.isInteger(prefs[key])
          && (key === 'studyGoalMin' ? prefs[key] >= 10 && prefs[key] <= 1440 : prefs[key] >= 500 && prefs[key] <= 10000))) issues++;
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
      issues += normalizeTrash(prefs.trash, isValidTrashEntry).rejectedCount;
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
    if (Object.hasOwn(look, 'start') && look.start !== undefined     && !Object.hasOwn(LEGACY_START_PAGES, look.start)) issues++;
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
  if (k === 'timer' || k === 'pomodoro') {
    let invalidCount = 0;
    if (!isPlainObject(v)) return { value: d, invalidCount: 1 };
    const timer = { ...d, ...v };
    if (!isFiniteValue(timer.elapsedSeconds) || timer.elapsedSeconds < 0) { timer.elapsedSeconds = d.elapsedSeconds; invalidCount++; }
    if (timer.startedAt !== null && !isFiniteValue(timer.startedAt)) { timer.startedAt = d.startedAt; invalidCount++; }
    if (k === 'timer' && !isText(timer.subjectId)) { timer.subjectId = d.subjectId; invalidCount++; }
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
    if (k === 'pomodoro') {
      if (typeof timer.focusTaskId !== 'string') { timer.focusTaskId = ''; invalidCount++; }
      if (typeof timer.focusLabel === 'string' && timer.focusLabel.trim()) timer.focusLabel = timer.focusLabel.trim().slice(0, 40); else delete timer.focusLabel;
    }
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
      subjects: isValidSubject,
      sessions: isValidSession,
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
const Persist = {
  lsKey: (k) => 'aurora.app.' + k,
  hadLocalData: false,
  loadLocal() {
    for (const k of SLICES) {
      try {
        const r = readStorage(this.lsKey(k));
        if (r == null) continue;
        this.hadLocalData = true;
        if (!isPlainObject(r) || !Object.hasOwn(r, 'v')) {
          ui.persistFailed.add(k);
          ui.persistBlocked.add(k);
          ui.integrityIssues[k] = 1;
          console.error(`Aurora: o envelope local de ${k} não tem o formato esperado; o valor original foi preservado.`);
          continue;
        }
        const normalized = normalizeSlice(k, r.v);
        S[k] = normalized.value;
        stamps[k] = isFiniteValue(r.t) ? r.t : 0;
        if (normalized.invalidCount) {
          ui.persistFailed.add(k);
          ui.persistBlocked.add(k);
          ui.integrityIssues[k] = normalized.invalidCount;
          console.error(`Aurora: ${normalized.invalidCount} registro(s) local(is) inválido(s) em ${k}; o valor original foi preservado.`);
        }
      } catch (e) {
        ui.persistFailed.add(k);
        if (e instanceof SyntaxError) {
          ui.persistBlocked.add(k);
          ui.integrityIssues[k] = 1;
        }
        console.error(`Aurora: não foi possível ler os dados locais de ${k}.`, e);
      }
    }
  },
  save(k) {
    if (ui.persistBlocked.has(k)) return false;
    const t = Date.now();
    try {
      writeStorage(this.lsKey(k), { v: S[k], t });
      stamps[k] = t;
      ui.persistFailed.delete(k);
      return true;
    } catch (e) {
      ui.persistFailed.add(k);
      console.error(`Aurora: não foi possível salvar os dados locais de ${k}.`, e);
      return false;
    }
  },
  wipe() { for (const k of SLICES) { try { removeStorage(this.lsKey(k)); } catch (e) { /* ok */ } } },
};
const saveSlices = (...ks) => {
  const saved = ks.map((k) => Persist.save(k));
  if (saved.includes(false)) toast('Alguns dados locais não puderam ser salvos ou lidos. Recarregar pode descartar alterações; faça um backup dos dados disponíveis.');
  return saved.every(Boolean);
};
const commit = (...ks) => { saveSlices(...ks); render(); };
const cloneSlice = (slice) => JSON.parse(JSON.stringify(S[slice]));
function snapshotSlices(slices) {
  return Object.fromEntries(slices.map((slice) => [slice, cloneSlice(slice)]));
}
function restoreSliceSnapshot(snapshot) {
  Object.entries(snapshot).forEach(([slice, value]) => { S[slice] = value; });
}
function persistSlicesAtomically(slices, snapshot, shouldRender = true, context = 'a lixeira') {
  const blocked = slices.filter((slice) => ui.persistBlocked.has(slice));
  if (blocked.length) {
    restoreSliceSnapshot(snapshot);
    toast(`Não foi possível salvar ${context} porque os dados de ${blocked.join(', ')} estão bloqueados para gravação.`);
    if (shouldRender) render();
    return false;
  }
  const storageKeys = slices.map((slice) => Persist.lsKey(slice));
  const keyToSlice = new Map(storageKeys.map((key, index) => [key, slices[index]]));
  const previousStamps = Object.fromEntries(slices.map((slice) => [slice, stamps[slice]]));
  const savedStamps = new Map();
  const result = runStorageTransaction({
    keys: storageKeys,
    readRaw: readStorage,
    writeRaw: writeStorage,
    removeRaw: removeStorage,
    persist: (key) => {
      const slice = keyToSlice.get(key);
      if (!slice) return false;
      const t = Date.now();
      writeStorage(key, { v: S[slice], t });
      savedStamps.set(slice, t);
      return true;
    },
  });
  if (!result.ok) {
    restoreSliceSnapshot(snapshot);
    slices.forEach((slice) => {
      if (previousStamps[slice] === undefined) delete stamps[slice];
      else stamps[slice] = previousStamps[slice];
      ui.persistFailed.add(slice);
    });
    console.error(`Aurora: não foi possível persistir ${context}.`, result.error);
    toast(result.rollbackFailed
      ? 'A gravação falhou e a restauração do armazenamento não foi confirmada. Faça um backup antes de continuar.'
      : `Não foi possível salvar ${context}; os dados originais foram mantidos.`);
    if (shouldRender) render();
    return false;
  }
  slices.forEach((slice) => {
    stamps[slice] = savedStamps.get(slice);
    ui.persistFailed.delete(slice);
  });
  if (shouldRender) render();
  return true;
}
function trashSlice(collection) {
  if (collection === 'cycleLog') return 'cycleLog';
  if (collection === 'timer.subject') return 'timer';
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
  return persistSlicesAtomically(slices, snapshot) ? entry : null;
}
function trashCollection(draft, collection) {
  if (collection === 'cycleLog') return draft.cycleLog;
  if (collection === 'timer.subject') return draft.timer;
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
    persistSlicesAtomically(['settings'], snapshot);
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
    if (record.collection === 'timer.subject') {
      if (!target.subjectId) target.subjectId = record.value.subjectId;
      continue;
    }
    if (Array.isArray(target)) {
      if (target.some((item) => item.id === record.key)) {
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
  if (!persistSlicesAtomically(slices, snapshot)) return false;
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
  persistSlicesAtomically(['settings'], snapshot, false);
}

/* Ícones: src/js/utils/icons.js */
const GRAD = raw('<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><linearGradient id="auroraGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#D991AA"/><stop offset="1" stop-color="#8D4665"/></linearGradient></defs></svg>');
const brandIcon = (size = 40) => raw(`<svg width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="18" fill="url(#auroraGrad)"/><path d="M32 14 46 48h-7.5l-2.600-6.800H28.100L25.5 48H18zm0 12.5-3.200 8.5h6.400z" fill="#fff"/><circle cx="46.5" cy="17.5" r="4" fill="#FBE7D3"/></svg>`);
const configLink = () => h`<a class="inline-link" href="#config?weight" aria-label="Abrir Ajustes e editar o peso">ajustes</a>`;

/* ========== Casca, roteamento e componentes comuns ========== */
const ROUTE_TITLES = { inicio: 'Início', planejar: 'Planejar', pomodoro: 'Pomodoro', financas: 'Finanças', ciclo: 'Ciclo', habitos: 'Hábitos', config: 'Ajustes' };
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const money = (cents) => h`<span class="money">${brl(cents)}</span>`;
const expenseTitle = (name) => String(name ?? '').toLocaleLowerCase('pt-BR').replace(/^(\s*\p{L})/u, (first) => first.toLocaleUpperCase('pt-BR'));
const tabLabel = (label) => h`<span class="tab-label-group"><span class="tab-label">${label.toLowerCase()}</span><i class="tab-period" aria-hidden="true">.</i></span>`;
const brandLink = h`<a class="brand" href="#inicio" aria-label="aurora, início">${brandIcon(36)}<span class="wordmark">aurora<i>.</i></span></a>`;

const notificationCount = () => Object.keys(ui.alerts).length;
function updateDocumentTitle() {
  const title = ui.focusActive ? 'Estudos' : ROUTE_TITLES[ui.route] || 'Aurora';
  document.title = `${notificationCount() ? `(${notificationCount()}) ` : ''}${title.toLowerCase()} | aurora`;
}
function notificationButton(cls, id) {
  const count = notificationCount();
  return h`<button type="button" id="${id}" class="${cls} notification-trigger" data-action="toggle-notifications" aria-label="${count ? `Notificações, ${count} ativas` : 'Notificações'}" aria-expanded="${ui.notificationsOpen}" aria-controls="notification-panel" aria-haspopup="dialog" title="Notificações">${icon('bell', 20)}${count ? h`<span class="notification-count" aria-hidden="true">${count > 99 ? '99+' : count}</span>` : ''}${cls.includes('nl') ? h`<span>Notificações</span>` : ''}</button>`;
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
    <header class="notification-head"><div><h2 id="notification-title">Notificações</h2><span class="small muted">${items.length ? `${items.length} ${plural(items.length, 'ativa', 'ativas')}` : 'Tudo em dia'}</span></div>${items.length > 1 ? h`<button type="button" class="btn ghost sm notification-clear" data-action="rem-dismiss-all">Dispensar todas</button>` : ''}<button type="button" class="ibtn dlg-close" id="notification-close" data-action="close-notifications" aria-label="Fechar notificações">${icon('close', 18)}</button></header>
    ${items.length ? h`<div class="notification-list" aria-live="polite">${items.map(([k, a]) => {
      const habit = a.kind === 'habit' ? S.habits.find((item) => item.id === a.id) : null;
      return h`<article class="notification-item is-${a.kind || 'task'}" ${habit ? raw(`style="--nc:${habitColor(habit)}"`) : ''}>
      <span class="notification-icon">${icon(a.kind === 'pomodoro' ? 'clock' : habit ? habitIconKey(habit) : 'bell', 18)}</span>
      <div class="notification-copy"><div class="notification-meta"><span class="notification-kind">${kindLabel(a)}</span><span class="notification-ago">${agoLabel(a.at)}</span><button class="ibtn notification-x" data-action="rem-dismiss" data-k="${k}" aria-label="Dispensar: ${a.title}">${icon('close', 16)}</button></div><b class="user-value">${a.title}</b>${a.kind === 'pomodoro' ? '' : h`<small>${a.kind === 'habit' ? `lembrete das ${a.time}` : `tarefa das ${a.time}`}</small>`}${a.detail ? h`<p>${a.detail}</p>` : ''}</div>
      <div class="notification-actions">${a.kind === 'pomodoro'
        ? h`<button class="btn sm primary" data-action="pomo-pause" data-k="${k}">Pausar ${a.phase === 'focus' ? 'foco' : 'intervalo'}</button>`
        : a.kind === 'habit'
          ? h`<button class="btn sm primary" data-action="habit-reminder-done" data-k="${k}" data-id="${a.id}">${habit?.tracking === 'water' ? 'Registrar água' : 'Marcar hábito'}</button>`
          : h`<button class="btn sm primary" data-action="rem-done" data-k="${k}" data-id="${a.id}">Concluir</button><button class="btn sm" data-action="rem-snooze" data-k="${k}">+10 min</button><button class="btn sm" data-action="rem-snooze" data-k="${k}" data-min="60">+1 h</button>`}</div>
    </article>`; })}</div>` : h`<div class="notification-empty">${icon('check', 20)}<b>Nenhuma notificação por enquanto</b><span>Lembretes de tarefas e hábitos e avisos do Pomodoro aparecem aqui.</span></div>`}
    ${upcoming.length ? h`<section class="notification-upcoming" aria-labelledby="notification-upcoming-title"><h3 id="notification-upcoming-title">Próximos hoje</h3><ul>${upcoming.map((u) => h`<li><time class="nu-time">${u.time}</time><span class="grow user-value">${u.kind === 'finance' ? `${u.title} · ${u.detail}` : u.title}</span><small>${u.kind === 'habit' ? 'hábito' : u.kind === 'finance' ? 'conta fixa' : 'tarefa'}</small></li>`)}</ul></section>` : ''}
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
function clearPomodoroNotifications(slice) {
  Object.keys(ui.alerts).forEach((key) => {
    const alert = ui.alerts[key];
    if (alert.kind === 'pomodoro' && (!slice || alert.timerSlice === slice)) delete ui.alerts[key];
  });
}
function shell(body) {
  const overdue = S.tasks.filter((t) => !t.done && t.dueDate && t.dueDate < today()).length;
  const menuItems = orderMenuItems(S.settings.prefs.menuOrder, S.settings.areas, false, S.settings.prefs.visibleMenuItems, HIDDEN_MENU_IDS);
  const compactItems = menuItems.slice(0, 4);
  const secondaryItems = menuItems.slice(4);
  const isCurrent = (id) => id === ui.route && (id !== 'planejar' || !ui.focusActive) || (id === 'estudos' && ui.focusActive);
  const navLink = ({ id, label, icon: iconName, area }, className = '') => h`<a class="${area ? 'nav-area ' : ''}${className}" href="#${id}" ${isCurrent(id) ? raw('aria-current="page"') : ''} ${id === 'planejar' ? raw('data-action="plan-home"') : id === 'estudos' ? raw('data-action="focus-go"') : ''}><span class="ni">${icon(iconName, area ? 20 : 22)}${id === 'planejar' && overdue ? h`<span class="dot" aria-label="${overdue} tarefas atrasadas"></span>` : ''}</span>${tabLabel(label)}</a>`;
  const currentInMore = secondaryItems.some(({ id }) => isCurrent(id));
  const navItems = h`${compactItems.map((item) => navLink(item, 'nav-primary'))}${secondaryItems.map((item) => navLink(item, 'nav-secondary'))}${secondaryItems.length ? h`<button type="button" class="nav-more-trigger" data-action="nav-more-toggle" aria-expanded="${String(ui.navigationOpen)}" aria-controls="nav-more-menu" ${currentInMore ? raw('aria-current="page"') : ''}><span class="ni">${icon('more', 22)}</span><span>mais</span></button><div class="nav-more-menu" id="nav-more-menu" ${ui.navigationOpen ? '' : raw('hidden')}><button type="button" class="nav-more-link nav-create" data-action="quick-create-open"><span class="ni">${icon('plus', 22)}</span><span>criar novo</span></button>${secondaryItems.map((item) => navLink(item, 'nav-more-link'))}</div>` : ''}`;
  return h`${GRAD}<a class="skip" href="#main" data-action="skip">Pular para o conteúdo principal</a><div class="app">
    <!-- aria-expanded and aria-controls announce the popover state and its relationship to assistive technology. -->
    ${ui.navigationOpen ? h`<div class="nav-scrim" data-action="nav-more-toggle" aria-hidden="true"></div>` : ''}<header class="topbar">${brandLink}<nav class="nav" aria-label="Principal">${navItems}</nav><span class="header-actions">${modeBtn('iconbtn theme-trigger')}<button type="button" class="iconbtn global-search-trigger" data-action="search-open" aria-label="Busca global" title="Buscar (Ctrl+K)">${icon('search', 20)}</button>${notificationButton('iconbtn', 'notification-top')}<span class="accessibility-control"><button type="button" id="accessibility-trigger" class="iconbtn" data-action="accessibility-toggle" aria-label="Tema e acessibilidade" aria-expanded="${String(ui.accessibilityOpen)}" aria-haspopup="true" aria-controls="accessibility-panel" title="Tema e acessibilidade">${icon('accessibility', 20)}</button>${accessibilityPanel()}</span><a class="profile-link iconbtn" href="#config" ${ui.route === 'config' ? raw('aria-current="page"') : ''} aria-label="Perfil e configurações" title="Perfil e configurações">${icon('user', 20)}</a></span></header>
    <main class="main" id="main" data-route="${ui.route}" data-view="${ui.focusActive ? 'focus' : 'default'}" tabindex="-1">
      ${notificationsHtml()}
      ${ui.route === 'inicio' && !profileSetupComplete() && !ui.exploreNoticeDismissed ? h`<section class="notice welcome-card" aria-labelledby="welcome-title"><span class="welcome-mark">${icon('sparkles', 22)}</span><div class="welcome-copy"><h2 id="welcome-title">Boas-vindas ao <span class="brand-name">Aurora</span><i>.</i></h2><p>Para usar a plataforma, configure seu nome e sua identidade de gênero. Você pode escolher “Prefiro não informar”; seus dados ficam neste navegador.</p></div><div class="welcome-actions"><button class="btn primary" data-action="open-profile-setup">Configurar perfil</button></div></section>` : ''}
      ${body}
    </main>
    <footer class="app-footer"><span class="small muted">aurora · organização pessoal</span><span class="save-indicator" data-status="${ui.persistFailed.size ? 'warning' : 'saved'}" role="status" aria-live="polite">${ui.persistFailed.size ? 'Alterações pendentes de backup' : 'Salvo neste navegador'}</span></footer>
  </div>`;
}
function weeklyReviewView() {
  const review = weeklyReview(
    S.tasks,
    habitsWithWater(),
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
  const studySeconds = week.reduce((total, day) => total + studyOn(day), 0);
  const weekTx = S.finance.tx.filter((transaction) => transaction.date >= week[0] && transaction.date <= week[6] && transaction.type !== 'tr');
  const weekIncome = weekTx.filter((transaction) => transaction.type === 'in').reduce((total, transaction) => total + transaction.cents, 0);
  const weekOut = weekTx.filter((transaction) => transaction.type === 'out').reduce((total, transaction) => total + transaction.cents, 0);
  const reflection = S.settings.prefs.weeklyReflection?.weekOf === week[0]
    ? S.settings.prefs.weeklyReflection.text
    : '';
  const overdue = S.tasks.filter((task) => !task.done && task.dueDate && task.dueDate < today()).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  return h`<div class="weekly-review">
    <section class="weekly-review-hero"><div><span>FECHAMENTO SEMANAL</span><h2>Veja o que avançou<i>.</i></h2><p>${first.getDate()} ${MESES_L[first.getMonth()]}–${last.getDate()} ${MESES_L[last.getMonth()]} · use este retrato para ajustar a próxima semana.</p></div><div class="weekly-review-actions"><button class="btn primary" data-action="plan-open">${icon('plus', 16)}Planejar próxima semana</button><button class="btn" data-action="weekly-open-finances">${icon('wallet', 16)}Ver finanças</button></div></section>
    <section class="card weekly-review-main"><div class="head"><div><p class="section-kicker">SEU RITMO</p><h2>Revisão da semana<i>.</i></h2></div><span class="small muted">Atualizada hoje</span></div>
      <div class="review-stats">
        <div class="stat"><b>${review.tasks.completed}</b><span>tarefas concluídas</span></div>
        <div class="stat"><b>${completion}%</b><span>hábitos concluídos</span></div>
        <div class="stat"><b>${money(weekOut)}</b><span>gastos nesta semana</span><small>Entradas ${brl(weekIncome)} · resultado ${brl(weekIncome - weekOut)}</small></div>
        <div class="stat"><b>${dur(studySeconds)}</b><span>tempo de estudo</span></div>
      </div>
      <section class="review-habits" aria-labelledby="review-habits-title"><h3 id="review-habits-title">Hábitos</h3>
        ${review.habits.count
          ? h`<p>${review.habits.completed} de ${review.habits.scheduled} check-ins previstos concluídos (${completion}%). Em ${review.habits.count} ${plural(review.habits.count, 'hábito ativo', 'hábitos ativos')}.</p>`
          : h`<p class="small muted">Nenhum hábito ativo para esta revisão.</p>`}
      </section>
    </section>
    <section class="card weekly-reflection" aria-labelledby="weekly-reflection-title">
      <div class="head"><div><p class="section-kicker">UM MINUTO PARA VOCÊ</p><h2 id="weekly-reflection-title">O que vale repetir ou ajustar?</h2></div><span class="small muted">Opcional</span></div>
      <label class="f"><span class="sr">Reflexão da semana</span><textarea id="weekly-reflection" data-keep maxlength="500" rows="3" placeholder="Uma pequena vitória, algo que aprendeu ou uma mudança para a próxima semana…">${reflection}</textarea></label>
      <div class="row"><button type="button" class="btn primary sm" data-action="weekly-save-reflection">Salvar reflexão</button></div>
    </section>
    <div class="weekly-review-grid">${overdue.length ? h`<section class="card weekly-review-alert"><div class="head"><div><p class="section-kicker">PRECISA DE ATENÇÃO</p><h2>${overdue.length} ${plural(overdue.length, 'tarefa atrasada', 'tarefas atrasadas')}<i>.</i></h2></div><button class="btn ghost sm" data-action="weekly-open-overdue">Organizar</button></div><ul class="list">${overdue.slice(0, 3).map(taskRow)}</ul></section>` : h`<section class="card weekly-review-clear"><span>${icon('check', 20)}</span><div><h2>Sem tarefas atrasadas<i>.</i></h2><p>Você pode entrar na próxima semana com mais clareza.</p></div></section>`}
    <section class="card"><div class="head"><div><p class="section-kicker">OLHANDO À FRENTE</p><h2>Prioridades da próxima semana<i>.</i></h2></div><span class="small muted">${nextFirst.getDate()}–${nextLast.getDate()} ${MESES_L[nextLast.getMonth()]}</span></div>
      ${review.nextWeek.tasks.length
        ? h`<ul class="list">${review.nextWeek.tasks.map(taskRow)}</ul>`
        : empty('Semana livre por enquanto', 'Crie um plano por etapas ou adicione a próxima prioridade.', h`<button class="btn" data-action="plan-open">${icon('plus', 16)}Planejar semana</button>`, 'calendar')}
    </section></div>
    <section class="review-discovery" aria-label="Atalhos úteis"><span>PRÓXIMOS PASSOS</span><button type="button" data-action="weekly-open-studies">${icon('book', 16)}Registrar estudo</button><button type="button" data-action="weekly-open-habits">${icon('check', 16)}Revisar hábitos</button><button type="button" data-action="weekly-open-finances">${icon('wallet', 16)}Conferir gastos</button></section>
  </div>`;
}

const greet = () => { const hr = new Date().getHours(); return hr < 5 ? 'Boa madrugada' : hr < 12 ? 'Bom dia' : hr < 18 ? 'Boa tarde' : 'Boa noite'; };
const PAGE_CONTEXT = {
  Planejar: ['Organização do dia', 'Transforme prioridades em tarefas, prazos e planos possíveis.'],
  Estudos: ['Aprendizado com intenção', 'Planeje sessões, mantenha o foco e acompanhe seu ritmo de estudo.'],
  Pomodoro: ['Tempo com intenção', 'Estruture ciclos de foco e pausa no seu próprio ritmo.'],
  Finanças: ['Visão financeira', 'Acompanhe contas, movimentos e objetivos em um só lugar.'],
  Água: ['Bem-estar diário', 'Registre sua hidratação e acompanhe a meta de hoje.'],
  Ciclo: ['Acompanhamento pessoal', 'Registre sinais e acompanhe seu ciclo com privacidade.'],
  Hábitos: ['Rotina que evolui', 'Acompanhe pequenos passos e construa constância no dia a dia.'],
  Ajustes: ['Central de preferências', 'Personalize seu perfil, organize as áreas e cuide da sua experiência.'],
};
const pageTitle = (title, action = '') => {
  const [eyebrow, description] = PAGE_CONTEXT[title] || [];
  return h`<header class="page-title"><div class="page-title-copy">${eyebrow ? h`<span class="page-title-eyebrow">${eyebrow}</span>` : ''}<h1>${title.toLowerCase()}<i>.</i></h1>${description ? h`<p>${description}</p>` : ''}</div>${action}</header>`;
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
  const bars = points.map((p, i) => { const x = gap + i * (bw + gap), yy = y(p.v); return `<rect class="b ${p.today ? 'today' : ''}" x="${x}" y="${yy}" width="${bw}" height="${Math.max(0, H - bot - yy)}" rx="6"><title>${esc(p.label)}: ${p.v} ${unit}</title></rect><text x="${x + bw / 2}" y="${H - 7}" text-anchor="middle">${esc(p.label)}</text>`; }).join('');
  const g = goal ? `<text class="goal-label" x="4" y="16" text-anchor="start">meta ${goal} ${unit}</text><line class="g" x1="0" x2="${W}" y1="${y(goal)}" y2="${y(goal)}"/>` : '';
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
    <header class="accessibility-head"><div><h2 id="accessibility-title">Tema e acessibilidade</h2><p>As preferências ficam salvas neste navegador.</p></div><button type="button" class="ibtn dlg-close" id="accessibility-close" data-action="accessibility-close" aria-label="Fechar tema e acessibilidade">${icon('close', 18)}</button></header>
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
    <a class="btn accessibility-more" id="accessibility-more" href="#config?section=personalization" data-action="accessibility-more">Mais opções em Personalização</a>
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
  renderDialog();
  $('#app').inert = Boolean(ui.dlg);
  renderToast();
  tick();
}
function setToast(msg, undo) {
  clearTimeout(ui.toastT);
  if (Object.keys(ui.integrityIssues).length) {
    const slices = Object.keys(ui.integrityIssues).join(', ');
    msg = `Dados locais inválidos em ${slices}. O original foi preservado; abra Ajustes para baixar uma cópia ou importar um backup.`;
    undo = null;
  } else if (ui.persistFailed.size) {
    msg = 'Alterações não salvas no navegador. Faça um backup e verifique o espaço de armazenamento.';
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
  el.innerHTML = h`<span class="toast-icon" aria-hidden="true">${icon(icons[ui.toast.tone], 18)}</span><span class="toast-content"><span class="toast-label">${labels[ui.toast.tone]}</span><span class="toast-message">${ui.toast.msg}</span></span>${ui.toast.undo ? h`<button data-action="undo">Desfazer</button>` : ''}<i class="toast-timer" aria-hidden="true"></i>`.s;
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
  if (r === 'agua') ui.openDetails.water = true;
  ui.booted = true;
  const resolved = resolveRoute(r, new Set(Object.keys(ROUTES)));
  // Um acesso direto a #estudos já é uma escolha explícita da pessoa: abre a área
  // imediatamente, em vez de deixá-la presa na tela de ativação opcional.
  if (resolved.focusActive && !S.settings.areas.studies) {
    S.settings.areas.studies = true;
    Persist.save('settings');
  }
  ui.route = resolved.route;
  ui.focusActive = resolved.focusActive;
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
const studySecs = studyElapsedSeconds;
const timerPhaseName = (phase) => phase === 'long-break' ? 'pausa longa' : phase === 'short-break' ? 'pausa curta' : 'foco';
const timerPhaseLabel = (phase, running, started) => {
  const name = timerPhaseName(phase);
  if (!started) return 'Pronto para começar';
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${running ? 'em andamento' : 'pausado'}`;
};
const timerPhaseMessage = (phase, pom, completed, includeCycle = true) => {
  if (!includeCycle) {
    return phase === 'focus'
      ? `${pom.focusMin} min de foco, depois pausa curta de ${pom.breakMin} min.`
      : phase === 'long-break'
        ? `Pausa longa de ${longBreakMinutes(pom)} min antes de recomeçar.`
        : `Pausa curta de ${pom.breakMin} min.`;
  }
  const cycle = phase === 'focus'
    ? (completed % POMODOROS_PER_LONG_BREAK) + 1
    : completed % POMODOROS_PER_LONG_BREAK || POMODOROS_PER_LONG_BREAK;
  return phase === 'focus'
    ? `Ciclo ${cycle} de 4 · ${pom.focusMin} min de foco, depois pausa curta de ${pom.breakMin} min.`
    : phase === 'long-break'
      ? `Quatro ciclos concluídos · pausa longa de ${longBreakMinutes(pom)} min antes de recomeçar.`
      : `Ciclo ${cycle} de 4 · pausa curta de ${pom.breakMin} min.`;
};
const timerCycleLabel = (phase, completed) => {
  const cycle = phase === 'focus'
    ? (completed % POMODOROS_PER_LONG_BREAK) + 1
    : completed % POMODOROS_PER_LONG_BREAK || POMODOROS_PER_LONG_BREAK;
  return `Ciclo ${cycle} de ${POMODOROS_PER_LONG_BREAK}`;
};
const timerReset = (subjectId = '', progress = S.timer) => ({
  elapsedSeconds: 0,
  startedAt: null,
  subjectId,
  phase: 'focus',
  phaseElapsedSeconds: 0,
  completedPomodoros: 0,
  dailyCompletedPomodoros: progress.dailyCompletedPomodoros || 0,
  dailyCompletedOn: progress.dailyCompletedOn || '',
  history: normalizePomodoroHistory(progress.history),
});
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
const pomodoroSettingsForTimer = (slice) => slice === 'pomodoro'
  ? effectivePomodoroSettings(S.settings.prefs.pomodoro)
  : S.settings.prefs.pomodoro;

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
function playPomodoroSound() {
  const context = pomodoroAudioContext;
  if (!context) return;
  const play = () => {
    if (context.state !== 'running') return;
    try {
      playPomodoroChime(context);
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
    : schedulePomodoroPush(timer, pomodoroSettingsForTimer('pomodoro'));
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
        await schedulePomodoroPush(S.pomodoro, pomodoroSettingsForTimer('pomodoro'));
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
function togglePomodoroTimer(slice) {
  const now = Date.now(), pom = pomodoroSettingsForTimer(slice);
  let timer = S[slice];
  if (timer.startedAt !== null) {
    const advanced = advancePomodoro(timer, pom, now);
    timer = { ...advanced.timer, phaseElapsedSeconds: phaseElapsedSeconds(advanced.timer, now), startedAt: null };
    if (advanced.transitions.length) notifyPomodoroPhase(advanced.transitions[advanced.transitions.length - 1], timer, slice);
  } else {
    if (slice === 'timer' && !activeSubjects().some((subject) => subject.id === timer.subjectId)) {
      return toast('Escolha uma matéria antes de iniciar.');
    }
    activatePomodoroAudio();
    timer = { ...timer, startedAt: now };
  }
  S[slice] = timer;
  commit(slice);
  if (slice === 'pomodoro') syncPomodoroPushSchedule(timer);
}
function skipPomodoroBreak(slice) {
  const now = Date.now(), advanced = advancePomodoro(S[slice], pomodoroSettingsForTimer(slice), now);
  let timer = advanced.timer;
  if (timer.phase === 'focus') {
    if (advanced.transitions.length) {
      S[slice] = timer;
      notifyPomodoroPhase(advanced.transitions[advanced.transitions.length - 1], timer, slice);
      commit(slice);
      if (slice === 'pomodoro') syncPomodoroPushSchedule(timer);
    }
    return;
  }
  S[slice] = { ...timer, phase: 'focus', phaseElapsedSeconds: 0, startedAt: timer.startedAt === null ? null : now };
  commit(slice);
  if (slice === 'pomodoro') syncPomodoroPushSchedule(S[slice]);
}
function finishPomodoro(slice) {
  const advanced = advancePomodoro(S[slice], pomodoroSettingsForTimer(slice));
  if (advanced.transitions.length) notifyPomodoroPhase(advanced.transitions[advanced.transitions.length - 1], advanced.timer, slice);
  const timer = advanced.timer;
  clearPomodoroNotifications(slice);
  if (slice === 'timer') {
    const seconds = studySecs(timer), subject = S.subjects.find((item) => item.id === timer.subjectId);
    S.timer = timerReset(timer.subjectId, timer);
    if (seconds > 0 && subject) {
      S.sessions.unshift({ id: newId(), subjectId: subject.id, subjectName: subject.name, durationSeconds: seconds, completedAt: new Date().toISOString() });
      commit('sessions', 'timer');
      toast(h`Sessão de <span class="user-value">${subject.name}</span> salva: ${dur(seconds)}.`);
      return;
    }
  } else {
    const focusTask = S.tasks.find((task) => task.id === timer.focusTaskId);
    const focusedSeconds = timer.elapsedSeconds + (timer.phase === 'focus' ? phaseElapsedSeconds(timer) : 0);
    if (focusTask && focusedSeconds > 0) focusTask.focusSeconds = (focusTask.focusSeconds || 0) + focusedSeconds;
    S.pomodoro = standaloneTimerReset(timer);
  }
  commit(...(slice === 'pomodoro' && timer.focusTaskId ? ['pomodoro', 'tasks'] : [slice]));
  if (slice === 'pomodoro') syncPomodoroPushSchedule(S[slice]);
  if (slice === 'pomodoro') toast('Pomodoro concluído.');
}
function discardPomodoro(slice) {
  const previous = S[slice];
  clearPomodoroNotifications(slice);
  S[slice] = slice === 'timer' ? timerReset(previous.subjectId, previous) : standaloneTimerReset(previous);
  commit(slice);
  if (slice === 'pomodoro') syncPomodoroPushSchedule(S[slice]);
  toast(slice === 'timer' ? 'Sessão descartada.' : 'Pomodoro descartado.', () => {
    S[slice] = previous;
    commit(slice);
    if (slice === 'pomodoro') syncPomodoroPushSchedule(previous);
  });
}
const sessionsOn = (k) => S.sessions.filter((s) => isoDay(s.completedAt) === k);
const studyOn = (k) => sessionsOn(k).reduce((a, s) => a + s.durationSeconds, 0);
const waterOn = (k) => S.water.filter((w) => isoDay(w.at) === k).reduce((a, w) => a + w.ml, 0);
const habitCompletedFor = (habit, day) => habitIsComplete(
  habit,
  day,
  waterOn(day),
  S.settings.prefs.waterGoalMl,
);
function habitsWithWater() {
  const savedWaterHabit = S.habits.find((habit) => habit.tracking === 'water');
  if (savedWaterHabit?.status === 'archived') return S.habits;
  const waterHabit = savedWaterHabit || {
    id: 'builtin-water-habit',
    name: 'Beber água',
    days: [0, 1, 2, 3, 4, 5, 6],
    completions: [],
    status: 'active',
    tracking: 'water',
  };
  return [waterHabit, ...S.habits.filter((habit) => habit.tracking !== 'water')];
}
const sampleBanner = () => S.settings.prefs.sample ? h`<div class="notice warn" role="note">${icon('info', 18)}<div class="grow">Você está vendo dados de exemplo. Eles ajudam a conhecer o app, mas não são seus.</div><button class="btn sm" data-action="clear-sample">Limpar exemplos</button></div>` : '';
const BACKUP_REMINDER_DAYS = 14;
function backupReminderDays(now = Date.now()) {
  if (S.settings.prefs.sample || ui.backupReminderHidden) return 0;
  const created = S.tasks.map((t) => Number(t.createdAt)).filter(Number.isFinite);
  const hasData = S.tasks.length || S.finance.tx.length || S.sessions.length || S.habits?.length;
  if (!hasData) return 0;
  const lastBackup = S.settings.prefs.lastBackup ? Date.parse(S.settings.prefs.lastBackup) : null;
  const reference = lastBackup ?? (created.length ? Math.min(...created) : null);
  if (!Number.isFinite(reference)) return 0;
  const days = Math.floor((now - reference) / 864e5);
  return days >= BACKUP_REMINDER_DAYS ? days : 0;
}
const backupReminder = () => {
  const days = backupReminderDays();
  if (!days) return '';
  const text = S.settings.prefs.lastBackup ? `Seu último backup foi há ${days} dias.` : `Você usa o Aurora há ${days} dias e ainda não exportou um backup.`;
  return h`<div class="notice backup-reminder" role="note">${icon('archive', 18)}<div class="grow"><b>Hora de guardar uma cópia</b><br><span class="small">${text} Os dados ficam só neste navegador.</span></div><a class="btn sm primary" href="#config?section=data">Fazer backup</a><button type="button" class="btn sm ghost" data-action="backup-reminder-dismiss">Agora não</button></div>`;
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
    habitsWithWater().filter((habit) => (
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
    return h`<section class="card home-next-action" aria-labelledby="home-next-title"><div class="home-next-mark">${icon('calendarCheck', 19)}</div><div class="grow"><span class="section-kicker">PRÓXIMA AÇÃO</span><h2 id="home-next-title">${task.title}</h2><p>${label}${task.priority === 'high' ? ' · prioridade alta' : ''}</p></div>${areaOn('pomodoro') ? h`<button type="button" class="btn primary" data-action="task-focus" data-id="${task.id}">${icon('play', 16)}Começar foco</button>` : h`<button type="button" class="btn primary" data-action="edit-task" data-id="${task.id}">Abrir tarefa</button>`}</section>`;
  }
  if (next.type === 'habit') {
    const habit = next.habit, water = habit.tracking === 'water';
    return h`<section class="card home-next-action" aria-labelledby="home-next-title"><div class="home-next-mark" style="--hc:${habitColor(habit)}">${icon(habitIconKey(habit), 19)}</div><div class="grow"><span class="section-kicker">PRÓXIMA AÇÃO</span><h2 id="home-next-title">${habit.name}</h2><p>${water ? 'A meta de água de hoje ainda está em andamento.' : 'Este hábito ainda falta hoje.'}</p></div>${water ? h`<a class="btn primary" href="#agua">Registrar água</a>` : h`<button type="button" class="btn primary" data-action="habit-check" data-id="${habit.id}">Marcar como feito</button>`}</section>`;
  }
  const days = dayDiff(next.due, todayKey);
  const dueLabel = days < 0 ? `Vencida há ${Math.abs(days)} ${plural(Math.abs(days), 'dia', 'dias')}`
    : days === 0 ? 'Vence hoje' : `Vence em ${days} ${plural(days, 'dia', 'dias')}`;
  return h`<section class="card home-next-action" aria-labelledby="home-next-title"><div class="home-next-mark">${icon('card', 19)}</div><div class="grow"><span class="section-kicker">PRÓXIMA AÇÃO</span><h2 id="home-next-title">Fatura de ${accountDisplayName(next.account)}</h2><p>${dueLabel} · ${shortDate(next.due)}</p></div><a class="btn primary" href="#financas">Ver Finanças</a></section>`;
}

function homeHabitCheckins() {
  if (!areaOn('habits')) return '';
  const scheduled = habitsWithWater().filter((habit) => (
    (habit.status || 'active') === 'active'
    && habit.days.includes(pk(today()).getDay())
  ));
  if (!scheduled.length) return '';
  const waterGoal = settingsView().prefs.waterGoalMl;
  return h`<section class="card home-habit-checkins" aria-labelledby="home-habits-title">
    <div class="head"><h2 id="home-habits-title">Hábitos de hoje<i>.</i></h2><a class="btn ghost sm" href="#habitos">Ver hábitos</a></div>
    <ul class="list">${scheduled.map((habit) => {
      const water = habit.tracking === 'water';
      const completed = habitCompletedFor(habit, today());
      const skipped = habitIsSkipped(habit, today(), today());
      const volume = waterOn(today());
      const progress = water ? clamp(Math.round(volume / waterGoal * 100), 0, 100) : 0;
      return h`<li class="home-habit-row">
        <span class="home-habit-icon" style="--hc:${habitColor(habit)}">${icon(habitIconKey(habit), 18)}</span>
        <span class="grow"><b>${habit.name}</b>${water
          ? h`<span class="small muted">${volume.toLocaleString('pt-BR')} de ${waterGoal.toLocaleString('pt-BR')} ml · dados de Água</span><span class="bar home-habit-progress" role="progressbar" aria-label="Progresso de água do hábito" aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100"><span style="width:${progress}%"></span></span>`
          : h`<span class="small muted">${completed ? 'Concluído hoje' : skipped ? 'Dia pulado hoje' : 'Ainda não marcado'}</span>`}</span>
        ${water
          ? h`<a class="btn sm ${completed ? 'back' : 'primary'}" href="#agua">${completed ? 'Meta atingida' : 'Registrar água'}</a>`
          : h`<button type="button" class="btn sm ${completed || skipped ? 'back' : 'primary'}" data-action="${skipped ? 'habit-skip' : 'habit-check'}" data-id="${habit.id}" aria-pressed="${completed || skipped}">${icon(completed ? 'check' : skipped ? 'close' : 'plus', 16)}${completed ? 'Concluído' : skipped ? 'Desfazer pulo' : 'Marcar'}</button>`}
      </li>`;
    })}</ul>
  </section>`;
}

function viewInicio() {
  const name = S.settings.profile.name.trim();
  const tt = todayTasks(), pend = tt.filter((t) => !t.done), doneN = tt.length - pend.length;
  const overdue = pend.filter((t) => t.dueDate < today());
  const dueToday = pend.filter((t) => t.dueDate === today());
  const completed = tt.filter((t) => t.done);
  const inbox = S.tasks.filter((t) => !t.dueDate && !t.done);
  const goal = settingsView().prefs.studyGoalMin, running = S.timer.startedAt !== null;
  const optionalAreas = areaTiles();
  const homeLayout = settingsView().prefs.homeLayout;
  const sundayReview = pk(today()).getDay() === 0;
  const showHomeBlock = (id) => homeLayout.visible.includes(id);
  const homeBlockStyle = (id) => `style="order:${homeLayout.order.indexOf(id)}"`;
  const habitsToday = areaOn('habits') ? habitsWithWater().filter((hb) => (hb.status || 'active') === 'active' && hb.days.includes(pk(today()).getDay())) : [];
  const habitsLeft = habitsToday.filter((hb) => !habitCompletedFor(hb, today())
    && !habitIsSkipped(hb, today(), today())).length;
  const habitNote = habitsToday.length ? (habitsLeft ? ` Faltam ${habitsLeft} ${plural(habitsLeft, 'hábito', 'hábitos')}.` : ' Hábitos de hoje em dia.') : '';
  const lead = (!tt.length ? 'Seu dia está livre por enquanto. Que tal planejar algo?' : pend.length ? `Você tem ${pend.length} ${plural(pend.length, 'tarefa pendente', 'tarefas pendentes')} para hoje.` : 'Tudo concluído por hoje. Aproveite o resto do dia.') + habitNote;
  return h`
    <header class="home-head" aria-labelledby="hi"><div><p class="date">${cap(longDate(today()))}</p><h1 id="hi">${greet().toLowerCase()}${name ? h`, <span class="proper-name">${name}</span>` : ''}<i>.</i></h1><p class="lead">${lead}</p><button type="button" class="home-action" data-action="home-quick-focus">${icon('plus', 18)}Adicionar tarefa para hoje${icon('chevRight', 16)}</button></div>${tt.length ? ring(doneN, tt.length) : ''}</header>
    ${sampleBanner()}
    ${backupReminder()}
    ${sundayReview ? h`<section class="card home-next-action home-weekly-review" aria-labelledby="home-weekly-review-title"><div class="home-next-mark">${icon('chart', 19)}</div><div class="grow"><span class="section-kicker">DOMINGO · REVISÃO DA SEMANA</span><h2 id="home-weekly-review-title">Um minuto para reconhecer seu progresso</h2><p>Veja hábitos, tarefas concluídas e gastos antes de começar uma nova semana.</p></div><button type="button" class="btn primary" data-action="home-weekly-review">Fazer revisão</button></section>` : ''}
    <div class="home-dashboard${optionalAreas ? '' : ' no-optional-areas'}">
      <div class="home-primary">
        ${homeNextAction()}
        ${showHomeBlock('summary') ? h`<section class="strip" aria-label="Resumo do dia" ${raw(homeBlockStyle('summary'))}>
          ${areaOn('studies') ? h`<a href="#estudos" data-action="focus-go"><b>${dur(studyOn(today()))}</b><span>estudo hoje · abrir Estudos</span></a>` : ''}
          <a href="#planejar" data-action="filter-inbox"><b>${inbox.length}</b><span>sem data</span></a>
          <a href="#agua"><b>${(waterOn(today()) / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} L</b><span>água de ${(S.settings.prefs.waterGoalMl / 1000).toLocaleString('pt-BR')} L</span></a>
        </section>` : ''}
        ${showHomeBlock('quick') ? h`<section class="card home-quick-card" aria-labelledby="home-quick-title" ${raw(homeBlockStyle('quick'))}>
          <div class="home-quick-copy"><span class="home-quick-mark" aria-hidden="true">${icon('plus', 18)}</span><div><h2 id="home-quick-title">Qual é o próximo passo<i>?</i></h2><p>Registre uma tarefa para hoje sem sair da sua rotina.</p></div></div>
          <form class="home-quick-form" data-form="home-quick-task"><label class="sr" for="home-quick-title-input">Nova tarefa para hoje</label><input id="home-quick-title-input" name="title" type="text" maxlength="120" autocomplete="off" placeholder="Ex.: revisar a apresentação" required><button class="btn primary" type="submit">${icon('plus', 16)}Adicionar</button></form>
        </section>` : ''}
        ${showHomeBlock('habits') ? h`<div ${raw(homeBlockStyle('habits'))}>${homeHabitCheckins()}</div>` : ''}
        ${showHomeBlock('today') ? h`<section class="card home-today-card" aria-labelledby="th" ${raw(homeBlockStyle('today'))}><div class="head"><div><p class="section-kicker">SEU PLANO</p><h2 id="th">Hoje<i>.</i></h2></div><div class="row"><a class="btn ghost sm" href="#planejar">Ver planejamento</a></div></div>
          ${tt.length ? h`<div class="home-task-groups">
            ${overdue.length ? h`<section class="home-task-group is-overdue" aria-label="Tarefas atrasadas"><h3>${icon('alert', 15)}Atrasadas <span>${overdue.length}</span></h3><ul class="list">${overdue.map(taskRow)}</ul></section>` : ''}
            ${dueToday.length ? h`<section class="home-task-group" aria-label="Tarefas para hoje"><h3>${icon('calendarCheck', 15)}Para hoje <span>${dueToday.length}</span></h3><ul class="list">${dueToday.map(taskRow)}</ul></section>` : ''}
            ${completed.length ? h`<details class="home-completed"><summary>${icon('check', 15)}Concluídas hoje <span>${completed.length}</span></summary><ul class="list">${completed.map(taskRow)}</ul></details>` : ''}
          </div>` : empty('Seu dia está aberto', 'Inclua a primeira prioridade acima ou monte um plano por etapas.', h`<a class="btn" href="#planejar">Montar plano por etapas</a>`, 'calendarCheck')}
        </section>` : ''}
      </div>
      ${optionalAreas ? h`<section class="home-areas" aria-labelledby="ar">${optionalAreas}</section>` : ''}
    </div>
    ${!areaOn('studies') ? h`<section class="home-tools" aria-labelledby="home-tools-title">
      <div class="head"><h2 id="home-tools-title">O que você pode fazer<i>.</i></h2></div>
      <div class="home-tool-grid">
        <a class="home-tool" href="#planejar"><span class="home-tool-icon">${icon('calendarCheck', 20)}</span><span><b>Planejar</b><small>Tarefas, prazos, calendário e planos por etapas.</small></span>${icon('chevRight', 18, 'home-tool-go')}</a>
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
  return h`${ui.focusActive ? areaNav('estudos') : ''}${pageTitle(ui.focusActive ? 'Estudos' : 'Planejar')}${ui.focusActive ? h`<div class="row"><button class="btn sm" data-action="plan-home">${icon('calendarCheck', 16)}Voltar ao planejamento</button></div>` : ''}
    ${ui.focusActive ? (gate('studies', 'Estudos') || focusSection()) : h`<section class="card focus-entry"><div><h2>Estudos<i>.</i></h2><p class="small muted">Concentre-se, organize matérias e acompanhe cada sessão.</p></div><button class="btn" data-action="focus-go">${icon('book', 18)}Abrir Estudos</button></section>`}
    ${ui.focusActive ? '' : h`
    <section class="card qa-card" aria-labelledby="nt"><div class="head"><h2 id="nt" class="sr">Nova tarefa</h2><div class="row"><button type="button" class="btn primary sm" data-action="task-new">${icon('plus', 16)}Nova tarefa</button><button type="button" class="btn sm" data-action="plan-open">${icon('calendar', 16)}Plano por etapas</button></div></div></section>
    <section class="planning-shortcuts" aria-label="Atalhos de planejamento"><span>ATENÇÃO AO SEU PLANO</span><button type="button" data-action="plan-view" data-v="semana">${icon('calendarCheck', 16)}Organizar a semana</button><button type="button" data-action="plan-view" data-v="revisao">${icon('chart', 16)}Fazer revisão semanal</button><button type="button" data-action="focus-go">${icon('book', 16)}Abrir Estudos</button></section>
    <section class="card plain" aria-labelledby="mt"><h2 id="mt" class="sr">Minhas tarefas</h2>
      <div class="seg" role="group" aria-label="Modo de visualização"><button type="button" aria-pressed="${ui.planView === 'lista'}" data-action="plan-view" data-v="lista">${icon('list', 16)}Lista</button><button type="button" aria-pressed="${ui.planView === 'calendario'}" data-action="plan-view" data-v="calendario">${icon('calendar', 16)}Calendário</button><button type="button" aria-pressed="${ui.planView === 'semana'}" data-action="plan-view" data-v="semana">${icon('calendarCheck', 16)}Semana</button><button type="button" aria-pressed="${ui.planView === 'revisao'}" data-action="plan-view" data-v="revisao">${icon('chart', 16)}Revisão</button></div>
      ${ui.planView === 'calendario' ? taskCalendar() : ui.planView === 'semana' ? taskWeek() : ui.planView === 'revisao' ? weeklyReviewView() : h`<div class="scroll-x" role="group" aria-label="Filtrar tarefas">${FILTERS.map(([k, l]) => h`<button class="chip" aria-pressed="${f.f === k}" data-action="set-filter" data-f="${k}">${l}</button>`)}${allTags().map((g) => h`<button class="chip" aria-pressed="${f.f === 'etq:' + g}" data-action="set-filter" data-f="${'etq:' + g}">#${g}</button>`)}</div>
      <div class="row"><label class="search"><span class="sr">Buscar tarefas</span>${icon('search', 18)}<input type="search" id="q" data-keep value="${f.q}" placeholder="Buscar tarefas" data-input="search"></label>
        <label style="flex:0 0 132px"><span class="sr">Ordenar</span><select id="sortsel" data-change="sort">${[['prazo', 'Por prazo'], ['prioridade', 'Prioridade'], ['recentes', 'Recentes'], ['manual', 'Manual']].map(([k, l]) => h`<option value="${k}" ${f.sort === k ? raw('selected') : ''}>${l}</option>`)}</select></label></div>
      <div id="task-results" aria-live="polite">${taskListHtml()}</div>`}</section>
    ${plansHtml()}`}`;
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
        const editable = S.habits.includes(habit) && habit.status === 'active' && habit.tracking !== 'water' && scheduled && !future;
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
  return SUGGESTED_HABITS.filter((suggestion) => (
    suggestion.tracking !== 'water'
    && !names.has(norm(suggestion.name))
  ));
}
const HABIT_COLOR_NAMES = ['Rosa', 'Coral', 'Âmbar', 'Verde-claro', 'Verde', 'Azul-claro', 'Azul', 'Lilás', 'Roxo', 'Vermelho', 'Cinza', 'Marrom'];
function habitStreakLabel(stats) {
  const weekly = stats.weeklyStreak !== null && stats.weeklyStreak !== undefined;
  const n = weekly ? stats.weeklyStreak : stats.streak;
  if (!n) return 'Comece hoje';
  return `${n} ${weekly ? plural(n, 'semana seguida', 'semanas seguidas') : plural(n, 'dia seguido', 'dias seguidos')}`;
}
function habitRow(habit, opts = {}) {
  const isWater = habit.tracking === 'water';
  const status = habit.status || 'active';
  const saved = S.habits.includes(habit);
  const dayOn = habit.days.includes(pk(today()).getDay());
  const skipped = habitIsSkipped(habit, today(), today());
  const canCheck = status === 'active' && dayOn && !skipped;
  const done = habitCompletedFor(habit, today());
  const stats = habitStats(habit, today(), weekStartDay(), (day) => habitCompletedFor(habit, day));
  const color = habitColor(habit);
  const goal = settingsView().prefs.waterGoalMl;
  const volume = waterOn(today());
  const waterPct = clamp(Math.round(volume / goal * 100), 0, 100);
  const open = ui.openDetails[`hab-${habit.id}`] || (isWater && ui.openDetails.water) ? raw('open') : '';
  const target = stats.weeklyTarget ?? stats.scheduledThisWeek;
  const sub = isWater
    ? `${volume.toLocaleString('pt-BR')} de ${goal.toLocaleString('pt-BR')} ml`
    : status === 'paused' ? 'Pausado' : skipped ? 'Dia pulado' : !dayOn ? habitDaysLabel(habit) : habitStreakLabel(stats);
  const orderList = S.habits.filter((item) => item.tracking !== 'water' && item.status !== 'archived');
  const orderIndex = orderList.indexOf(habit);
  const circleLabel = isWater
    ? 'Adicionar 200 ml de água'
    : `${skipped ? 'Dia pulado' : done ? 'Desmarcar' : 'Marcar como feito'}: ${habit.name}`;
  return h`<li class="habit-row${done ? ' is-done' : ''}${isWater ? ' habit-water-row' : ''}${canCheck ? '' : ' is-off'}" data-habit-id="${habit.id}" style="--hc:${color}"${isWater ? raw(' id="agua" tabindex="-1"') : ''}>
    <button type="button" class="habit-circle" data-action="${isWater ? 'add-water' : 'habit-check'}" ${isWater ? raw('data-ml="200"') : ''} data-id="${habit.id}" ${isWater ? '' : raw(`aria-pressed="${done}"`)} aria-label="${circleLabel}" ${isWater || canCheck ? '' : raw('disabled')}>
      <span class="habit-circle-icon">${icon(habitIconKey(habit), 22)}</span><span class="habit-circle-check">${icon('check', 22)}</span>
    </button>
    <details class="habit-more" id="d-hab-${habit.id}" ${open}>
      <summary><span class="habit-main"><span class="habit-title">${habit.name}${status === 'paused' ? h` <span class="badge">Pausado</span>` : ''}</span><span class="habit-sub">${isWater ? sub : h`${canCheck && stats.goalMet ? h`${icon('sparkles', 13)}Meta da semana cumprida · ` : ''}${sub}`}</span>${isWater ? h`<span class="habit-water-bar" role="progressbar" aria-label="Progresso de água de hoje" aria-valuenow="${waterPct}" aria-valuemin="0" aria-valuemax="100"><span style="width:${waterPct}%"></span></span>` : ''}</span>${icon('chevDown', 18, 'chev')}</summary>
      <div class="habit-more-body">
        ${isWater ? h`<div class="habit-water-content">${habitWaterDetails()}<div class="row habit-actions"><span class="small muted">Registrar:</span>${[300, 500].map((ml) => h`<button type="button" class="btn sm water-habit-add" data-action="add-water" data-ml="${ml}">${icon('plus', 15)}${ml} ml</button>`)}</div></div>` : h`
        <div class="habit-week" role="group" aria-label="Esta semana: ${stats.completedThisWeek} de ${target} dias. Toque num dia que passou para marcar ou desmarcar.">${stats.week.map((w) => {
          const stateLabel = `${longDate(w.day)}: ${w.skipped ? 'dia pulado' : w.completed ? 'concluído' : w.scheduled ? (w.day > today() ? 'programado' : 'não concluído') : 'não programado'}`;
          const editable = saved && status === 'active' && w.scheduled && w.day <= today();
          return h`<button type="button" class="habit-dot${w.completed ? ' is-done' : ''}${w.skipped ? ' is-skipped' : ''}${!w.scheduled ? ' is-off' : ''}${w.day === today() ? ' is-today' : ''}" data-action="habit-day" data-id="${habit.id}" data-d="${w.day}" aria-pressed="${w.completed}" aria-label="${stateLabel}" ${editable ? '' : raw('disabled')}><i aria-hidden="true">${DIAS[pk(w.day).getDay()].slice(0, 1)}</i></button>`;
        })}</div>
        <p class="small muted">${habitDaysLabel(habit)}${habit.remind ? ` · lembrete ${habit.remind}` : ''}<br>${stats.completedThisWeek} de ${target} nesta semana</p>
        ${habitMonthlyHistory(habit)}${saved ? habitYearHeat(habit) : ''}`}
        ${saved ? h`<div class="row habit-actions">${!isWater && status !== 'archived' ? h`<button type="button" class="ibtn" data-action="habit-move" data-dir="-1" data-id="${habit.id}" aria-label="Mover ${habit.name} para cima" ${orderIndex <= 0 ? raw('disabled') : ''}>${icon('arrowUp', 18)}</button><button type="button" class="ibtn" data-action="habit-move" data-dir="1" data-id="${habit.id}" aria-label="Mover ${habit.name} para baixo" ${orderIndex < 0 || orderIndex >= orderList.length - 1 ? raw('disabled') : ''}>${icon('arrowDown', 18)}</button>` : ''}${!isWater && status === 'active' && dayOn && !done ? h`<button type="button" class="btn sm ghost" data-action="habit-skip" data-id="${habit.id}" aria-pressed="${skipped}">${skipped ? 'Desfazer pulo' : 'Pular hoje'}</button>` : ''}<button type="button" class="btn sm" data-action="habit-edit-open" data-id="${habit.id}">${icon('pencil', 15)}Editar</button><button type="button" class="btn sm" data-action="habit-toggle-pause" data-id="${habit.id}">${icon(status === 'active' ? 'pause' : 'play', 15)}${status === 'active' ? 'Pausar' : 'Retomar'}</button><button type="button" class="btn sm ghost" data-action="habit-archive" data-id="${habit.id}">${icon('archive', 15)}Arquivar</button></div>` : ''}
      </div>
    </details>
  </li>`;
}
function viewHabits() {
  if (!areaOn('habits')) return h`${pageTitle('Hábitos')}${gate('habits', 'Hábitos')}`;
  const suggestions = remainingHabitSuggestions();
  const live = habitsWithWater().filter((habit) => (habit.status || 'active') !== 'archived');
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
  return h`${pageTitle('Hábitos')}
    <section class="card habit-today" aria-labelledby="habit-today-title">
      <header class="habit-today-head">
        <div><h2 id="habit-today-title">Hoje<i>.</i></h2><p class="small muted">${todaySummary}</p></div>
        <button type="button" class="btn primary" data-action="habit-new">${icon('plus', 16)}Novo hábito</button>
      </header>
      ${eligibleToday ? h`<div class="habit-today-bar" role="progressbar" aria-label="Hábitos concluídos hoje, sem contar dias pulados" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pct}%"></span></div>` : ''}
      ${todays.length ? h`<ul class="habit-list" aria-label="Hábitos de hoje">${todays.map((habit) => habitRow(habit))}</ul>` : empty('Dia livre', 'Crie um hábito ou escolha uma ideia abaixo.', h`<button type="button" class="btn" data-action="habit-new">${icon('plus', 16)}Novo hábito</button>`, 'check')}
      ${live.some((habit) => habit.remind) ? h`<p class="fine habit-reminder-note">Lembretes aparecem enquanto o Aurora está aberto.</p>` : ''}
    </section>
    ${others.length ? h`<details class="card habit-others" id="d-others" ${ui.openDetails.others ? raw('open') : ''}><summary><b>Fora de hoje</b><span class="habit-count">${others.length}</span>${icon('chevDown', 18, 'chev')}</summary><ul class="habit-list">${others.map((habit) => habitRow(habit))}</ul></details>` : ''}
    ${suggestions.length ? h`<details class="card habit-ideas" id="d-ideas" ${ideasOpen}>
      <summary><span><b>Ideias de hábitos</b><small>Toque para criar com ícone e cor já escolhidos.</small></span><span class="habit-count">${suggestions.length}</span>${icon('chevDown', 18, 'chev')}</summary>
      <div class="habit-idea-grid">${suggestions.map((idea) => h`<button type="button" class="habit-idea" data-action="habit-idea" data-id="${idea.id}" style="--hc:${habitColor(idea)}"><span class="habit-idea-icon">${icon(habitIconKey(idea), 22)}</span><b>${idea.name}</b></button>`)}</div>
    </details>` : ''}
    ${archived.length ? h`<details class="card habit-archived" id="d-archived" ${ui.openDetails.archived ? raw('open') : ''}><summary><b>Arquivados</b><span class="habit-count">${archived.length}</span>${icon('chevDown', 18, 'chev')}</summary><ul class="habit-list">${archived.map((habit) => h`<li class="habit-row is-off" style="--hc:${habitColor(habit)}"><span class="habit-circle is-static">${icon(habitIconKey(habit), 22)}</span><div class="habit-main"><span class="habit-title">${habit.name}</span><span class="habit-sub">${habitDaysLabel(habit)}</span></div><button type="button" class="btn sm" data-action="habit-restore" data-id="${habit.id}">Restaurar</button><button type="button" class="ibtn" data-action="habit-edit-open" data-id="${habit.id}" aria-label="Editar hábito arquivado ${habit.name}">${icon('pencil', 18)}</button></li>`)}</ul></details>` : ''}`;
}

/* ---------- Foco ---------- */
const activeSubjects = () => S.subjects.filter((s) => !s.archived);
function requestStudiesTemplate() {
  if (studiesTemplate || studiesTemplatePromise) return;
  studiesTemplateError = false;
  studiesTemplatePromise = loadStudiesTemplate().then(
    (template) => {
      studiesTemplate = template;
      studiesTemplatePromise = null;
      if (ui.route === 'planejar' && ui.focusActive) render();
    },
    (error) => {
      studiesTemplatePromise = null;
      studiesTemplateError = true;
      console.error('Aurora: não foi possível carregar o template da área de Estudos.', error);
      if (ui.route === 'planejar' && ui.focusActive) render();
    },
  );
}
function focusSection() {
  const subs = activeSubjects();
  const goal = settingsView().prefs.studyGoalMin, todayMin = Math.round(studyOn(today()) / 60);
  const pc = clamp(Math.round(todayMin / goal * 100), 0, 100);
  const week = weekDays(today(), weekStartDay());
  const weekStart = week[0], weekEnd = week[week.length - 1];
  const weekSeconds = S.sessions.filter((session) => {
    const day = isoDay(session.completedAt);
    return day >= weekStart && day <= weekEnd;
  }).reduce((sum, session) => sum + session.durationSeconds, 0);
  const weekGoal = goal * 7;
  const weekMin = Math.round(weekSeconds / 60);
  const weekPc = clamp(Math.round(weekMin / weekGoal * 100), 0, 100);
  const hist = [...S.sessions].sort((a, b) => b.completedAt.localeCompare(a.completedAt)).slice(0, 15);
  if (!studiesTemplate) {
    if (!studiesTemplateError) return h`<section class="card" role="status">Carregando Estudos…</section>`;
    return h`<section class="card" role="alert"><p>Não foi possível carregar a área de Estudos.</p><button class="btn" data-action="retry-studies-template">Tentar novamente</button></section>`;
  }
  const slots = {
    'goal-label': h`${todayMin} de ${goal} min`.s,
    'goal-progress': h`${pc}`.s,
    'goal-value': h`${goal}`.s,
    'today-study-time': h`${dur(studyOn(today()))}`.s,
    'week-study-time': h`${dur(weekSeconds)}`.s,
    'week-study-progress': h`${weekPc}`.s,
    'week-study-copy': h`${weekMin} de ${weekGoal} min`.s,
    'active-subjects': h`${subs.length}`.s,
    'study-primary-action': subs.length
      ? h`<button class="btn primary" data-action="studies-open-manual">Registrar sessão</button>`.s
      : h`<button class="btn primary" data-action="studies-open-subject">${icon('plus', 18)}Criar primeira matéria</button>`.s,
    'settings-save-disabled': settingsDraftDirty() ? '' : 'disabled',
    'settings-discard-disabled': settingsDraftDirty() ? '' : 'disabled hidden',
    'study-chart': h`${barChart(last7((k) => Math.round(studyOn(k) / 60)), goal, 'min')}`.s,
    'subjects-open': ui.openDetails.subj || !S.subjects.length ? 'open' : '',
    'subjects-icon': icon('book', 18).s,
    'chevron-icon': icon('chevDown', 16, 'chev').s,
    'subjects-count': h`${S.subjects.length}`.s,
    'add-icon': icon('plus', 18).s,
    'subjects-list': S.subjects.length ? h`<ul class="list subject-progress-list">${S.subjects.map((s) => {
      const sessions = S.sessions.filter((session) => session.subjectId === s.id);
      const weeklySeconds = sessions.filter((session) => { const day = isoDay(session.completedAt); return day >= weekStart && day <= weekEnd; }).reduce((sum, session) => sum + session.durationSeconds, 0);
      const latest = [...sessions].sort((a, b) => b.completedAt.localeCompare(a.completedAt))[0];
      const subjectProgress = clamp(Math.round(weeklySeconds / (weekGoal * 60) * 100), 0, 100);
      return h`<li><div class="grow"><div class="ttl">${s.name} ${s.archived ? h`<span class="badge">Arquivada</span>` : ''}</div><span class="subject-progress-meta">${dur(weeklySeconds)} nesta semana${latest ? ` · última sessão ${shortDate(isoDay(latest.completedAt))}` : ' · sem sessões ainda'}</span><div class="bar subject-week-progress" role="progressbar" aria-valuenow="${subjectProgress}" aria-valuemin="0" aria-valuemax="100" aria-label="Contribuição de ${s.name} para a meta semanal compartilhada"><span style="width:${subjectProgress}%"></span></div></div><button class="btn sm" data-action="arch-subject" data-id="${s.id}">${s.archived ? 'Reativar' : 'Arquivar'}</button><button class="ibtn" data-action="del-subject" data-id="${s.id}" aria-label="Remover matéria ${s.name}">${icon('trash', 18)}</button></li>`;
    })}</ul>`.s : '',
    'manual-open': ui.openDetails.man ? 'open' : '',
    'manual-icon': icon('plus', 18).s,
    'manual-subject-options': h`${S.subjects.map((s) => h`<option class="user-value" value="${s.id}">${s.name}</option>`)}`.s,
    today: h`${today()}`.s,
    'manual-submit-disabled': S.subjects.length ? '' : 'disabled',
    'session-history': hist.length ? h`<ul class="list">${hist.map((s) => h`<li><div class="grow"><div class="ttl">${s.subjectName}</div><span class="small muted">${shortDate(isoDay(s.completedAt))} · ${dur(s.durationSeconds)}</span></div><button class="ibtn" data-action="edit-session" data-id="${s.id}" aria-label="Editar sessão de ${s.subjectName}">${icon('pencil', 18)}</button><button class="ibtn" data-action="del-session" data-id="${s.id}" aria-label="Excluir sessão de ${s.subjectName}">${icon('trash', 18)}</button></li>`)}</ul>`.s : empty('Nenhuma sessão ainda', S.subjects.length ? 'Registre sua primeira sessão para acompanhar seu histórico.' : 'Crie uma matéria antes de registrar sua primeira sessão.', S.subjects.length ? h`<button type="button" class="btn" data-action="studies-open-manual">${icon('plus', 16)}Registrar sessão</button>` : h`<button type="button" class="btn" data-action="studies-open-subject">${icon('plus', 16)}Criar primeira matéria</button>`, 'book').s,
  };
  return raw(renderStudiesTemplate(studiesTemplate, slots));
}

function viewPomodoro() {
  const g = gate('pomodoro', 'Pomodoro');
  if (g) return h`${areaNav('pomodoro')}${pageTitle('Pomodoro')}${g}`;
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
  const cyclePosition = timer.phase === 'focus' ? (timer.completedPomodoros % POMODOROS_PER_LONG_BREAK) + 1 : timer.completedPomodoros % POMODOROS_PER_LONG_BREAK || POMODOROS_PER_LONG_BREAK;
  const completedToday = timer.dailyCompletedOn === today() ? timer.dailyCompletedPomodoros : 0;
  const pushStatus = getPomodoroPushStatus();
  const pushButtonDisabled = ui.pushBusy || (!pushStatus.enabled && (!pushStatus.configured || !pushStatus.supported || pushStatus.permission === 'denied'));
  return h`${areaNav('pomodoro')}${pageTitle('Pomodoro')}
    <section class="card focus-timer free-pomodoro" data-phase="${timer.phase}" aria-labelledby="standalone-pomodoro-title">
      <header class="focus-timer-head"><div><span class="focus-eyebrow">SEU RITMO DE FOCO</span><h2 id="standalone-pomodoro-title">Um ciclo de cada vez<i>.</i></h2><p class="free-pomodoro-subtitle">${focusTask ? h`Tarefa: <b class="user-value">${focusTask.title}</b> · ${dur(focusedSeconds)} focados` : timer.focusLabel ? h`Foco em: <b class="user-value">${timer.focusLabel}</b>` : 'Escolha um bloco, comece e deixe o relógio cuidar das pausas.'}</p></div><div class="focus-timer-badges"><span class="focus-phase" id="standalone-pomo-phase">${timerPhaseName(timer.phase)}</span><span class="focus-cycle-count" id="standalone-pomo-cycles">${timerCycleLabel(timer.phase, timer.completedPomodoros)}</span><span class="focus-cycle-count" id="standalone-pomo-today">${completedToday} ${plural(completedToday, 'ciclo hoje', 'ciclos hoje')}</span></div></header>
      <div class="focus-timer-body">
        <div class="focus-dial" aria-hidden="true"><svg viewBox="0 0 112 112"><circle class="focus-dial-track" cx="56" cy="56" r="50"/><circle class="focus-dial-progress" id="standalone-pomo-progress" cx="56" cy="56" r="50" style="stroke-dasharray:314.2;stroke-dashoffset:${(circumference * (1 - Math.min(1, elapsed / duration))).toFixed(1)}"/></svg><div class="focus-clock"><div class="timer" id="standalone-pomo-clock" role="timer" aria-live="off">${clock(remaining)}</div><span class="small muted" id="standalone-pomo-state">${timerPhaseLabel(timer.phase, running, hasProgress)}</span></div></div>
        <div class="focus-timer-actions">
          <div class="focus-controls">
          <button class="btn primary" data-action="toggle-free-timer">${icon(running ? 'pause' : 'play', 18)}${running ? 'Pausar' : hasProgress ? 'Retomar' : 'Começar Pomodoro'}</button>
          ${timer.phase !== 'focus' ? h`<button class="btn" data-action="skip-free-break">Pular pausa</button>` : ''}
          ${hasProgress || running ? h`<button class="btn" data-action="finish-free-timer">${icon('check', 18)}Concluir Pomodoro</button><button class="btn ghost" data-action="discard-free-timer">Descartar</button>` : ''}
          </div>
          <p class="focus-prompt" id="standalone-pomo-copy">${timerPhaseMessage(timer.phase, pom, timer.completedPomodoros, false)}</p>
          <div class="pomodoro-cycle-card"><div><span>SEQUÊNCIA ATUAL</span><b>${cyclePosition}º bloco de foco</b></div><ol class="pomodoro-cycle-track" aria-label="Progresso do ciclo de quatro blocos">${Array.from({ length: POMODOROS_PER_LONG_BREAK }, (_, index) => h`<li class="${index < cyclePosition - 1 ? 'done' : index === cyclePosition - 1 ? 'current' : ''}"><span>${index + 1}</span></li>`)}</ol><small>Após o quarto bloco, você ganha uma pausa longa.</small></div>
          <form class="free-pomodoro-settings" data-form="settings-save" novalidate>
            <div class="free-pomodoro-settings-head"><div><span>CONFIGURAÇÃO</span><h3>Bloco de tempo</h3></div><b>${pom.focusMin} / ${pom.breakMin} min</b></div>
            <div class="free-pomodoro-presets" role="group" aria-label="Bloco de tempo">
              <button type="button" class="chip" data-action="set-free-pomodoro-preset" data-preset="classic" aria-pressed="${preferences.preset === 'classic' ? 'true' : 'false'}" ${presetDisabled ? raw('disabled') : ''}>Clássico · ${POMODORO_PRESETS.classic.focusMin}/${POMODORO_PRESETS.classic.breakMin} min</button>
              <button type="button" class="chip" data-action="set-free-pomodoro-preset" data-preset="custom" aria-pressed="${preferences.preset === 'custom' ? 'true' : 'false'}" ${presetDisabled ? raw('disabled') : ''}>Personalizado · ${preferences.focusMin}/${preferences.breakMin} min</button>
            </div>
            <p class="small muted free-pomodoro-hint">${presetDisabled ? 'Conclua ou descarte o Pomodoro atual para trocar o bloco ou editar os tempos.' : preferences.preset === 'custom' ? 'Edite os tempos de foco e pausa.' : 'Selecione Personalizado para definir outros tempos.'}</p>
            ${preferences.preset === 'custom' ? h`<div class="form free-pomodoro-durations">
              <label class="f">Foco (min)<input type="number" inputmode="numeric" data-change="free-pomo-focus" min="5" max="120" step="1" value="${preferences.focusMin}" ${presetDisabled ? raw('disabled') : ''}></label>
              <label class="f">Pausa longa (min)<input type="number" inputmode="numeric" data-change="free-pomo-long" min="5" max="60" step="1" value="${longBreakMinutes(preferences)}" ${presetDisabled ? raw('disabled') : ''}></label>
              <label class="f">Pausa curta (min)<input type="number" inputmode="numeric" data-change="free-pomo-break" min="1" max="60" step="1" value="${preferences.breakMin}" ${presetDisabled ? raw('disabled') : ''}></label>
            </div>` : ''}
            ${settingsSaveButton()}
          </form>
          <label class="f free-pomodoro-label">Em que você vai focar? <span class="muted small">(opcional)</span><input type="text" id="pomo-focus-label" data-change="pomo-label" maxlength="40" autocomplete="off" placeholder="Ex.: relatório, inglês, faxina" value="${timer.focusLabel || ''}"></label>
        </div>
      </div>
      <section class="pomodoro-push-settings" aria-labelledby="pomodoro-push-title">
        <div><h3 id="pomodoro-push-title">Avisos fora do app</h3><p>Receba uma notificação do sistema a cada mudança de fase enquanto este Pomodoro estiver rodando.</p></div>
        <button type="button" class="btn" data-action="pomodoro-push-toggle" aria-pressed="${pushStatus.enabled ? 'true' : 'false'}" ${pushButtonDisabled ? raw('disabled') : ''}>${ui.pushBusy ? 'Atualizando…' : pushStatus.enabled ? 'Desativar avisos' : 'Ativar avisos'}</button>
        <p class="pomodoro-push-status" role="status" aria-live="polite">${ui.pushNotice || pushStatus.message}</p>
        <p class="pomodoro-push-privacy">A autorização é opcional. Seus dados e o nome da tarefa ficam neste dispositivo; o serviço recebe somente a inscrição Push e os horários/fases necessários ao timer.</p>
      </section>
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
  const defs = [['pomodoro', 'clock'], ['studies', 'book'], ['finances', 'wallet'], ['cycle', 'heart']]
    .filter(([a]) => !areaOn(a));
  if (!defs.length) return '';
  return h`<div class="head"><h2 id="ar">Áreas opcionais<i>.</i></h2><a class="btn ghost sm" href="#config">Gerenciar</a></div><div class="tiles">${defs.map(([a, ic]) => h`<button class="tile off" data-action="enable-area" data-area="${a}"><span class="mk" data-area="${a}">${icon(ic, 22)}</span><h3>${AREAS[a][0]}</h3><span class="v">Ativar</span><span class="s">${AREAS[a][1]}</span></button>`)}</div>`;
}

function requestWaterTemplate() {
  if (waterTemplate || waterTemplatePromise) return;
  waterTemplateError = false;
  waterTemplatePromise = loadWaterTemplate().then(
    (template) => {
      waterTemplate = template;
      waterTemplatePromise = null;
      if (ui.route === 'habitos') {
        render();
        if (location.hash.slice(1).split('?')[0] === 'agua') focusRouteTarget('agua');
      }
    },
    (error) => {
      waterTemplatePromise = null;
      waterTemplateError = true;
      console.error('Aurora: não foi possível carregar o template da área de Água.', error);
      if (ui.route === 'habitos') {
        render();
        if (location.hash.slice(1).split('?')[0] === 'agua') focusRouteTarget('agua');
      }
    },
  );
}

function habitWaterDetails() {
  if (!waterTemplate) {
    if (!waterTemplatePromise && !waterTemplateError) requestWaterTemplate();
    return waterTemplateError
      ? h`<section class="card" role="alert"><p>Não foi possível carregar o histórico de Água.</p><button class="btn" data-action="retry-water-template">Tentar novamente</button></section>`
      : h`<p class="small muted" role="status">Carregando histórico de água…</p>`;
  }
  const goal = settingsView().prefs.waterGoalMl;
  const ents = S.water.filter((w) => isoDay(w.at) === today()).sort((a, b) => b.at.localeCompare(a.at));
  const calculation = estimateWaterGoal(S.settings.profile);
  const slots = {
    'water-explanation': calculation
      ? h`<span class="water-note-icon">${icon('info', 16)}</span><span>${waterWhy(calculation)} Ajuste a meta diária abaixo.</span>`.s
      : h`<span class="water-note-icon">${icon('info', 16)}</span><span>Você pode ajustar a meta diária abaixo. Informe seu peso em ${configLink()} se quiser receber uma sugestão personalizada.</span>`.s,
    'water-goal': h`${goal}`.s,
    'settings-save-disabled': settingsDraftDirty() ? '' : 'disabled',
    'settings-discard-disabled': settingsDraftDirty() ? '' : 'disabled hidden',
    'weekly-chart': h`${barChart(last7(waterOn), goal, 'ml')}`.s,
    'water-history': ents.length
      ? h`<ul class="list">${ents.map((w) => h`<li>${icon('droplet', 18)}<div class="grow ttl">${w.ml} ml <span class="small muted">· ${new Date(w.at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span></div><button class="ibtn" data-action="del-water" data-id="${w.id}" aria-label="Remover ${w.ml} ml">${icon('trash', 18)}</button></li>`)}</ul>`.s
      : empty('Nenhum registro hoje', 'Use os botões rápidos para registrar o que você bebeu.').s,
  };
  return raw(renderWaterTemplate(waterTemplate, slots));
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
function periodDaySet() {
  const set = new Set();
  Object.entries(S.cycleLog).forEach(([k, l]) => { if (isBleeding(l)) set.add(k); });
  S.cycle.forEach((c) => { const end = c.end || c.start; for (let k = c.start, n = 0; k <= end && n < 15; k = addDays(k, 1), n++) set.add(k); });
  return set;
}
function cycleStats() {
  const set = periodDaySet(), days = [...set].sort(), starts = [];
  days.forEach((k) => { if (!set.has(addDays(k, -1))) starts.push(k); });
  const lens = [];
  for (let i = 1; i < starts.length; i++) { const d = dayDiff(starts[i], starts[i - 1]); if (d >= 15 && d <= 60) lens.push(d); }
  const avg = lens.length ? Math.round(lens.reduce((a, b) => a + b, 0) / lens.length) : null;
  return { set, starts, avg, next: avg && starts.length ? addDays(starts[starts.length - 1], avg) : null };
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
  const g = gate('cycle', 'Ciclo'); if (g) return h`${areaNav('ciclo')}${pageTitle('Ciclo')}${g}`;
  const st = cycleStats(), tdy = today(), sel = ui.cycDay && ui.cycDay <= tdy ? ui.cycDay : tdy, log = dayLog(sel);
  const ym = ui.calMonth, [y, m] = ym.split('-').map(Number), first = new Date(y, m - 1, 1), nDays = new Date(y, m, 0).getDate();
  const strip = Array.from({ length: 14 }, (_, i) => addDays(tdy, i - 13));
  const dn = cycleDayNumber(sel, st);
  const hasCycleHistory = st.starts.length > 0;
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
  return h`${areaNav('ciclo')}${pageTitle('Ciclo')}
    <section class="cycle-overview" aria-labelledby="cycle-overview-title"><header class="cycle-overview-head"><div><span>${hasCycleHistory ? 'SEU CICLO' : 'PRIMEIROS PASSOS'}</span><h2 id="cycle-overview-title">${cycleMoment[0]}<i>.</i></h2><p>${cycleMoment[1]}</p></div><button type="button" class="btn primary" data-action="cyc-open">${icon('plus', 16)}${hasAnyLog(log) ? 'Editar registro' : hasCycleHistory ? 'Registrar este dia' : 'Registrar primeiro dia'}</button></header>${hasCycleHistory ? h`<div class="stats cycle-overview-stats">${dn ? h`<div class="cycle-day-ring ${st.avg ? '' : 'is-unestimated'}" ${st.avg ? `style="--cycle-progress:${cycleProgress}%"` : ''}><span><b>${dn}</b><small>dia do ciclo</small></span></div>` : ''}${st.avg ? h`<div class="stat"><b>${st.avg} dias</b><span>duração média do ciclo</span></div><div class="stat"><b>${shortDate(st.next)}</b><span>próximo início estimado</span></div>` : h`<p class="cycle-next-step">Registre o próximo início da menstruação para calcular a duração média e mostrar estimativas.</p>`}</div>` : ''}</section>
    <section class="card cycle-day-entry" aria-labelledby="cd"><div class="head"><div><h2 id="cd">${sel === tdy ? 'Hoje' : cap(longDate(sel))}<i>.</i></h2><p class="cycle-day-summary">${hasAnyLog(log) ? cycleLogSummary(log) : hasCycleHistory ? 'Sem registro neste dia. Se quiser, anote sintomas ou fluxo.' : 'Ainda não há registro neste dia. Escolha uma data e registre o fluxo para começar.'}</p></div>${hasAnyLog(log) ? h`<button type="button" class="btn ghost sm" data-action="cyc-clear">Limpar o dia</button>` : ''}</div>
      <div class="scroll-x" role="group" aria-label="Escolher o dia">${strip.map((k) => h`<button type="button" class="dchip ${k === sel ? 'on' : ''} ${st.set.has(k) ? 'per' : ''}" data-action="cyc-day" data-d="${k}" aria-pressed="${k === sel}" aria-label="${longDate(k)}${st.set.has(k) ? ', período' : ''}${hasAnyLog(S.cycleLog[k]) ? ', com registro' : ''}"><span>${DIAS[pk(k).getDay()]}</span><b>${pk(k).getDate()}</b><i class="${hasAnyLog(S.cycleLog[k]) ? 'on' : ''}"></i></button>`)}</div></section>
    <section class="card cycle-calendar-card"><div class="head"><button class="ibtn" data-action="cal-month" data-n="-1" aria-label="Mês anterior">${icon('chevLeft', 20)}</button><div><p class="section-kicker">CALENDÁRIO DO CICLO</p><h2>${cap(ymLabel(ym))}</h2><p class="cycle-calendar-help">Selecione um dia. As cores indicam registros ou fases estimadas.</p></div><button class="ibtn" data-action="cal-month" data-n="1" aria-label="Próximo mês">${icon('chevRight', 20)}</button></div>
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
      <summary class="cycle-health-summary"><span><span class="cycle-health-eyebrow">INFORMAÇÃO E CUIDADO</span><strong>Saúde menstrual e sexual</strong><small>Entenda mudanças do ciclo, cuidados nas relações e quando buscar ajuda.</small></span>${icon('chevDown', 18)}</summary>
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
    <div class="notice">${icon('info', 18)}<span>As estimativas usam os intervalos entre inícios registrados. Não substituem avaliação profissional e não servem como método contraceptivo.</span></div>`;
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
    <div class="appearance-settings-heading"><div><h2 id="appearance-settings-title">Personalização<i>.</i></h2><p>Aparência, calendário e acessibilidade em um só lugar. As mudanças aparecem como prévia; use Salvar para mantê-las.</p></div><button type="button" class="btn sm" data-action="appearance-reset" ${defaultAppearance ? raw('disabled') : ''}>Restaurar padrão visual</button></div>
    ${group('appearance-mode-title', 'Tema', 'Claro, escuro ou o mesmo do seu aparelho. O tema é salvo ao tocar.', h`<div class="seg" role="group" aria-label="Tema">${[['auto', 'Automático', 'monitor'], ['light', 'Claro', 'sun'], ['dark', 'Escuro', 'moon']].map(([value, text, ic]) => h`<button type="button" id="personalization-mode-${value}" aria-pressed="${String(L.mode === value)}" data-action="accessibility-mode" data-v="${value}">${icon(ic, 16)}<span>${text}</span></button>`)}</div>`)}
    ${group('appearance-color-title', 'Cor de destaque', `Paleta atual: ${currentPalette}. Escolha outra ou personalize uma cor.`, h`<div class="swatches appearance-swatches" role="group" aria-label="Paletas de cor">${Object.entries(PALETTES).map(([k, [n, c]]) => h`<button type="button" class="swatch" aria-label="Cor ${n}" aria-pressed="${String(s.theme === k)}" data-action="set-theme" data-v="${k}"><i style="background:${c}" aria-hidden="true"></i>${n}</button>`) }
      <label class="swatch appearance-custom-color${s.theme === 'custom' ? ' is-selected' : ''}"><i style="background:${s.theme === 'custom' ? paletteColors('custom', L)[0] : 'conic-gradient(#e0507a,#e8a33a,#6cc070,#3fa7d6,#8a6ae0,#e0507a)'}" aria-hidden="true"></i>Escolher cor<input type="color" class="sr" data-change="look-custom" value="${L.custom}" aria-label="Escolher cor de destaque"></label></div>`)}
    ${group('appearance-reading-title', 'Leitura e espaçamento', 'Ajuste o tamanho do texto e a distância entre os elementos da tela.', h`<div class="appearance-settings-controls">
      <div class="appearance-settings-option"><span class="appearance-settings-label">Tamanho do texto</span>${settingsSegment(L, 'font', 'Tamanho do texto', [['s', 'Pequeno', '', 'sample'], ['m', 'Médio', '', 'sample'], ['l', 'Grande', '', 'sample']])}</div>
      <div class="appearance-settings-option"><span class="appearance-settings-label">Espaçamento</span>${settingsSegment(L, 'density', 'Espaçamento', [['comfy', 'Confortável'], ['compact', 'Compacto']])}</div>
    </div>`)}
    ${group('appearance-calendar-title', 'Calendário', 'Escolha o dia em que a semana começa nas visualizações do Aurora.', h`<div class="appearance-settings-controls"><div class="appearance-settings-option"><span class="appearance-settings-label">A semana começa na</span>${settingsSegment(s.look, 'weekStart', 'Primeiro dia da semana', [[1, 'Segunda'], [0, 'Domingo']], 'preferences-week-start')}</div></div>`)}
    ${group('appearance-accessibility-title', 'Acessibilidade', 'Opções adicionais para melhorar a distinção visual e reduzir animações.', h`<div class="settings-options">
      <label class="setting-toggle"><input type="checkbox" data-change="look-contrast" ${L.contrast ? raw('checked') : ''}><span class="setting-toggle-copy"><b>Alto contraste</b><span>Reforça textos secundários, bordas e foco dos controles.</span></span></label>
      <label class="setting-toggle"><input type="checkbox" data-change="look-readable" ${L.readable ? raw('checked') : ''}><span class="setting-toggle-copy"><b>Legibilidade aprimorada</b><span>Usa fonte simples e aumenta o espaçamento entre linhas.</span></span></label>
      <label class="setting-toggle"><input type="checkbox" data-change="look-highlight-links" ${L.highlightLinks ? raw('checked') : ''}><span class="setting-toggle-copy"><b>Destacar links</b><span>Sublinha os links para identificá-los com mais facilidade.</span></span></label>
      <label class="setting-toggle"><input type="checkbox" data-change="look-motion" ${L.reduceMotion ? raw('checked') : ''}><span class="setting-toggle-copy"><b>Reduzir movimento</b><span>Remove transições e animações da interface.</span></span></label>
    </div>`)}
    ${settingsSaveButton()}
  </form>`;
}
function profileSettings(s) {
  s = settingsView();
  const p = ui.profileDraft || {
    name: s.profile.name,
    sex: s.profile.sex || '',
    age: s.profile.age == null ? '' : String(s.profile.age),
    weightKg: s.profile.weightKg == null ? '' : String(s.profile.weightKg),
  };
  const wc = estimateWaterGoal(s.profile);
  const profileDirty = profileDraftHasChanges(p, s.profile);
  return h`<div class="profile-settings-container">
    <form id="profile-settings-form" class="card profile-settings" aria-labelledby="settings-profile-title" data-form="settings-profile" novalidate>
    <div class="profile-settings-heading"><h2 id="settings-profile-title">Seu perfil<i>.</i></h2><p>Nome e identidade de gênero são obrigatórios. Idade e peso são opcionais e ajudam a sugerir uma meta de água.</p></div>
    <div class="profile-greeting-preview" aria-live="polite"><span class="profile-greeting-avatar" aria-hidden="true">${icon('user', 22)}</span><span class="profile-greeting-copy"><span>PRÉVIA NA TELA INICIAL</span><b>${greet().toLowerCase()}, <span id="profile-preview-name" class="proper-name">${p.name.trim() || 'seu nome'}</span>.</b></span></div>
    <section class="profile-settings-group" aria-labelledby="profile-name-title">
      <div><h3 id="profile-name-title">Informações do perfil</h3><p>Você pode alterar estas informações quando quiser. Não perguntamos sua orientação sexual.</p></div>
      <div class="form profile-settings-fields">
        <label class="f" for="pname">Como quer ser chamada(o)?<input type="text" id="pname" data-profile-field="name" value="${p.name}" maxlength="50" autocomplete="given-name" required></label>
        <label class="f" for="psex">Identidade de gênero<select id="psex" data-profile-field="sex" required aria-describedby="profile-sex-help"><option value="">Selecione uma opção</option>${Object.entries(SEX).map(([key, label]) => h`<option value="${key}" ${p.sex === key ? raw('selected') : ''}>${label}</option>`)}</select><span class="profile-field-help" id="profile-sex-help">Inclui opções para pessoas cis, trans e não binárias. Você também pode preferir não informar.</span></label>
      </div>
    </section>
    <section class="profile-settings-group" aria-labelledby="profile-water-title">
      <div><h3 id="profile-water-title">Sugestão de hidratação</h3><p>Idade e peso podem ajudar a estimar uma meta diária de água. Informe apenas o que quiser.</p></div>
      <div class="form profile-settings-fields"><label class="f" for="pa">Idade<input type="number" id="pa" data-profile-field="age" min="5" max="120" aria-describedby="profile-age-help" value="${p.age}"><span class="profile-field-help" id="profile-age-help">De 5 a 120 anos.</span></label><label class="f" for="pk">Peso (kg)<input type="text" id="pk" data-profile-field="weightKg" inputmode="decimal" aria-describedby="profile-weight-help" value="${p.weightKg}"><span class="profile-field-help" id="profile-weight-help">De 20 a 400 kg. Você pode usar vírgula ou ponto.</span></label></div>
      ${wc ? h`<div class="profile-water-suggestion"><div class="notice">${icon('droplet', 18)}<div class="grow"><b>Meta sugerida: ${wc.ml.toLocaleString('pt-BR')} ml por dia</b><br><span class="small">${waterWhy(wc)} É uma referência geral para adultos saudáveis. Em calor, treino intenso, gravidez ou amamentação costuma precisar de mais. Com doença renal, cardíaca ou orientação médica de limitar líquidos, siga seu médico.</span></div></div><div class="row"><button type="button" class="btn sm" data-action="suggest-water" ${wc.ml === s.prefs.waterGoalMl || profileDirty ? raw('disabled') : ''}>${wc.ml === s.prefs.waterGoalMl ? 'Meta já aplicada' : 'Usar esta meta'}</button></div></div>` : ''}
    </section>
      <div class="row profile-settings-actions"><button class="btn primary" type="submit" ${profileDirty ? '' : raw('disabled')}>Salvar</button></div>
      </form>
  </div>`;
}
function profileDraftHasChanges(draft, profile) {
  return draft.name !== (profile.name || '')
    || draft.sex !== (profile.sex || '')
    || draft.age !== (profile.age == null ? '' : String(profile.age))
    || draft.weightKg !== (profile.weightKg == null ? '' : String(profile.weightKg));
}

const LEGACY_SETTINGS_TABS = { appearance: 'personalization', preferences: 'personalization', calendar: 'personalization', areas: 'areas-navigation', navigation: 'areas-navigation' };
const settingsTabId = (id) => LEGACY_SETTINGS_TABS[id] || id;
const SETTINGS_SECTIONS = [
  ['profile', 'Seu perfil', 'user', 'Nome e identidade de gênero'],
  ['personalization', 'Personalização', 'sun', 'Aparência, calendário e acessibilidade'],
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
    <p class="small muted">Ative ou desative as áreas e organize os menus no mesmo lugar. Desativar uma área ou ocultar seu menu não apaga os dados. Início permanece sempre primeiro; Água fica dentro de Hábitos. Restaurar padrão volta à ordem inicial e marca todos os menus opcionais como visíveis, sem ativar áreas nem alterar dados.</p>
    <ol class="areas-navigation-list" aria-label="Áreas e menus principais">${items.map((item) => {
      const areaName = item.area ? AREAS[item.area]?.[0] || item.label : item.label;
      const areaDescription = item.area ? AREAS[item.area]?.[1] || '' : item.id === 'inicio' ? 'Página inicial do Aurora' : 'Tarefas, prazos e planejamento';
      const orderIndex = orderedItems.findIndex(({ id }) => id === item.id);
      const orderLabel = item.id === 'inicio' ? 'Sempre primeiro' : item.id === 'planejar' ? 'Sempre visível' : item.id === 'agua' ? 'Acessada dentro de Hábitos' : '';
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
              <button type="button" class="ibtn" id="menu-move-up-${item.id}" data-action="menu-move" data-menu-id="${item.id}" data-direction="-1" aria-label="Mover ${item.label} para cima" ${orderIndex <= 1 ? raw('disabled') : ''}>${icon('arrowUp', 18)}</button>
              <button type="button" class="ibtn" id="menu-move-down-${item.id}" data-action="menu-move" data-menu-id="${item.id}" data-direction="1" aria-label="Mover ${item.label} para baixo" ${item.id === 'inicio' || orderIndex === orderedItems.length - 1 ? raw('disabled') : ''}>${icon('arrowDown', 18)}</button>
            </span>`}
        </span>
      </li>`;
    })}</ol>
    ${homeLayoutSettings(s)}
    ${settingsSaveButton()}
  </form>`;
}
function dataSettings(p) {
  const integritySlices = Object.keys(ui.integrityIssues);
  const failedSlices = [...ui.persistFailed];
  const trashEntries = p.trash.filter((entry) => !isTrashExpired(entry)).sort((a, b) => b.deletedAt - a.deletedAt);
  return h`<section class="card settings-section-card"><div class="settings-section-heading"><h2>Backup<i>.</i></h2><p>Baixe uma cópia dos seus dados para guardar ou levar para outro navegador.</p></div>
    <div class="notice data-location" role="status">${icon('archive', 18)}<span>Os dados são salvos automaticamente apenas neste navegador. Não há conta nem sincronização.</span></div>
    <p class="small muted">${p.lastBackup ? 'Último backup exportado neste navegador: ' + shortDate(isoDay(p.lastBackup)) + '.' : 'Você ainda não exportou um backup neste navegador.'}</p>
    ${integritySlices.length ? h`<div class="notice warn" role="alert"><span>Há dados locais inválidos em ${integritySlices.join(', ')}. Os valores originais continuam preservados e não serão sobrescritos. Importe um backup confiável para recuperar os dados; também baixe uma cópia bruta antes de substituir.</span></div><button class="btn" data-action="recovery-export">${icon('download', 18)}Baixar cópia de recuperação</button>` : ''}
    ${failedSlices.length && !integritySlices.length ? h`<div class="notice warn" role="alert"><span>Não foi possível ler ou salvar: ${failedSlices.join(', ')}. Alterações nessas áreas podem não estar gravadas; confira o espaço do navegador e faça um backup dos dados disponíveis.</span></div>` : ''}
    <div class="row"><button class="btn" data-action="export">${icon('download', 18)}Exportar backup</button></div></section>
    <section class="card settings-section-card"><div class="settings-section-heading"><h2>Restaurar<i>.</i></h2><p>Escolha um backup para conferir o conteúdo antes da confirmação. A restauração substitui os dados atuais; não combina registros.</p></div>
    <div class="row"><label class="btn backup-file-label">${icon('upload', 18)}Escolher backup<input type="file" accept="application/json,.json" data-change="import" class="sr"></label></div>
    <p class="err" id="imperr" role="alert"></p>
    <p class="small muted">São aceitos backups do Aurora nas versões 1 e 2.</p></section>
    <section class="card settings-section-card" aria-labelledby="trash-title"><div class="settings-section-heading"><h2 id="trash-title" tabindex="-1">Lixeira<i>.</i></h2><p>Itens excluídos ficam disponíveis para restauração por 30 dias. Depois, são removidos automaticamente. A lixeira também acompanha os backups exportados.</p></div>
      ${trashEntries.length
        ? h`<ul class="list">${trashEntries.map((entry) => {
          const days = trashDaysRemaining(entry);
          return h`<li><div class="grow"><div class="ttl">${entry.label}</div><span class="small muted">Excluído em ${shortDate(isoDay(entry.deletedAt))} · ${days} ${plural(days, 'dia restante', 'dias restantes')}</span></div><button type="button" class="btn sm" data-action="trash-restore" data-id="${entry.id}" aria-label="Restaurar ${entry.label}">Restaurar</button></li>`;
        })}</ul>`
        : h`<p class="small muted">A lixeira está vazia.</p>`}
    </section>
    <section class="card settings-section-card"><div class="settings-section-heading"><h2>Zona de cuidado<i>.</i></h2><p>Experimente a plataforma com exemplos ou apague os dados deste navegador.</p></div>
    <div class="row"><button class="btn" data-action="load-sample">Explorar com exemplos</button>
    <button class="btn danger" data-action="wipe-ask">${icon('trash', 18)}Apagar todos os dados</button></div></section>`;
}
function settingsStorageNotice(selectedTab) {
  if (selectedTab === 'data') return '';
  const integritySlices = Object.keys(ui.integrityIssues);
  if (integritySlices.length) {
    return h`<div class="notice warn settings-storage-notice" role="alert"><span>Há dados locais inválidos em ${integritySlices.join(', ')}. Os originais foram preservados; revise Dados e backup antes de continuar.</span><button type="button" class="btn sm" data-action="settings-section" data-settings-tab="data">Revisar dados</button></div>`;
  }
  const failedSlices = [...ui.persistFailed];
  if (failedSlices.length) {
    return h`<div class="notice warn settings-storage-notice" role="alert"><span>Não foi possível ler ou salvar: ${failedSlices.join(', ')}. Algumas alterações podem não estar gravadas.</span><button type="button" class="btn sm" data-action="settings-section" data-settings-tab="data">Ver opções de backup</button></div>`;
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
      <nav class="settings-menu" aria-label="Opções de Ajustes"><span class="settings-menu-heading">PREFERÊNCIAS</span>${SETTINGS_SECTIONS.map(([id, label, ic, description]) => h`<a class="settings-link" href="#config?section=${encodeURIComponent(id)}" data-action="settings-section" data-settings-tab="${id}" aria-controls="settings-content" ${selected === id ? raw('aria-current="page"') : ''}><span class="settings-link-icon">${icon(ic, 19)}</span><span class="settings-link-copy"><b>${tabLabel(label)}</b><small>${description}</small></span>${icon('chevRight', 16, 'settings-link-arrow')}</a>`)}</nav>
      <div class="settings-content" id="settings-content">${content}</div>
    </div>`;
}

const ROUTES = { inicio: viewInicio, planejar: viewPlanejar, pomodoro: viewPomodoro, financas: viewFinancas, ciclo: viewCiclo, habitos: viewHabits, config: viewConfig };

/* ========== Diálogos ========== */
function profileSetupDraft() {
  const p = S.settings.profile;
  return { step: 0, name: p.name || '', sex: p.sex || '', age: p.age || '', kg: p.weightKg || '', height: p.heightCm || '', theme: S.settings.theme, areas: { ...S.settings.areas } };
}
function profileSetupComplete() {
  return S.settings.onboardingComplete && hasRequiredProfile(S.settings.profile);
}
function openProfileSetup() {
  if (profileSetupComplete() || ui.dlg?.type === 'onboard') return;
  S.settings.introSeen = true;
  ui.exploreNoticeDismissed = true;
  ui.returnDialog = ui.dlg?.type === 'intro' ? null : ui.dlg;
  ui.dlg = createDialog('onboard', profileSetupDraft());
  commit('settings');
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
  'del-session',
  'del-subject',
  'del-task',
  'del-water',
  'cyc-clear',
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
  if (ui.dlg?.type === 'onboard') return;
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
  return dlgWrap(h`<div class="head"><div><h2 id="dt">${d.title}<i>.</i></h2><p class="small">${d.message}</p></div>${closeBtn}</div>
    <p class="notice warn" role="alert">A ação só será executada depois que você confirmar.</p>`,
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
    : h`<div class="card flat"><b>${d.goal.trim()}</b><ul class="list">${titles.map((t, i) => h`<li>${icon('check', 16)}<span class="grow">${t}</span>${d.start ? h`<span class="badge">${shortDate(d.spread ? addDays(d.start, i) : d.start)}</span>` : ''}</li>`)}</ul><p class="fine">Prioridade ${PRIO[d.priority].toLowerCase()}${d.start ? '' : ' · sem data (vai para a caixa de entrada)'}</p></div>`;
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
    : `Opcional · ${single ? 'escolha 1' : 'várias opções'}`;
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
        <p class="fine">Os registros de ciclo ficam neste dispositivo e podem ser incluídos nos backups locais.</p>` : h`<p class="fine" id="cycle-sexual-note">Opcional. Não registramos essa informação se você não marcar a opção.</p>`}
    </section>
  </form>`,
  h`<button type="button" class="btn back" data-action="dlg-close">Cancelar</button><button type="submit" class="btn primary" form="dlgform">Salvar registro</button>`);
}
function dlgSession() {
  const d = ui.dlg.d;
  return dlgWrap(h`<div class="head" style="flex-wrap:nowrap"><h2 id="dt">Editar sessão<i>.</i></h2>${closeBtn}</div>
    <form id="dlgform" class="form" data-form="dlg-session">${dlgField('Minutos', h`<input id="f0" type="number" min="1" max="1440" data-dlg="min" value="${d.min}" required>`)}${dlgField('Data', h`<input type="date" data-dlg="date" value="${d.date}" max="${today()}">`)}</form>`,
    h`<button class="btn back" data-action="dlg-close">Cancelar</button><button class="btn primary" type="submit" form="dlgform">Salvar</button>`);
}
function dlgHabitEdit() {
  const d = ui.dlg.d, edit = Boolean(d.id), habit = edit ? S.habits.find((item) => item.id === d.id) : null;
  return dlgWrap(h`<div class="head" style="flex-wrap:nowrap"><div><h2 id="dt">${edit ? 'Editar hábito' : 'Novo hábito'}<i>.</i></h2><p class="small muted">${edit ? 'Ajuste os dias e o lembrete deste hábito.' : 'Escolha um nome e os dias em que quer acompanhar.'}</p></div>${closeBtn}</div>
    <form id="dlgform" class="form" data-form="habit-edit">
      <label class="f full">Nome<input id="f0" name="name" type="text" data-dlg="name" value="${d.name}" maxlength="60" required autocomplete="off" placeholder="Ex.: Ler por 10 minutos"></label>
      ${habit?.tracking === 'water' ? '' : h`<fieldset class="habit-look full"><legend>Ícone</legend><div class="habit-icon-picker">${HABIT_ICONS.map(([key, label]) => h`<label title="${label}"><input type="radio" name="icon" value="${key}" data-dlg="icon" ${(d.icon || DEFAULT_HABIT_ICON) === key ? raw('checked') : ''}><span>${icon(key, 20)}<i class="sr">${label}</i></span></label>`)}</div></fieldset>
      <fieldset class="habit-look full"><legend>Cor</legend><div class="habit-color-picker">${HABIT_COLORS.map((color, index) => h`<label title="${HABIT_COLOR_NAMES[index]}"><input type="radio" name="color" value="${color}" data-dlg="color" ${(d.color || DEFAULT_HABIT_COLOR).toLowerCase() === color ? raw('checked') : ''}><span style="--c:${color}"><i class="sr">${HABIT_COLOR_NAMES[index]}</i>${icon('check', 16)}</span></label>`)}</div></fieldset>`}
      <fieldset class="habit-schedule full"><legend>Em quais dias?</legend><div class="habit-weekday-picker">${DIAS.map((day, index) => h`<label class="${index === pk(today()).getDay() ? 'is-today' : ''}"><input type="checkbox" name="days" value="${index}" ${d.days.includes(index) ? raw('checked') : ''}><span>${day}</span></label>`)}</div></fieldset>
      <label class="f full">Meta na semana (opcional)<select name="weeklyGoal"><option value="" ${d.weeklyGoal ? '' : raw('selected')}>Todos os dias marcados</option>${[1, 2, 3, 4, 5, 6, 7].map((n) => h`<option value="${n}" ${Number(d.weeklyGoal) === n ? raw('selected') : ''}>${n} ${plural(n, 'vez', 'vezes')} por semana</option>`)}</select><span class="small muted">Com meta, a semana conta como cumprida ao atingir esse número de dias, mesmo sem marcar todos.</span></label>
      <label class="f full">Lembrete no app (opcional)<input type="time" name="remind" data-dlg="remind" value="${d.remind || ''}"><span class="small muted">Só aparece enquanto o Aurora estiver aberto.</span></label>
    </form>
    ${habit ? h`<div class="habit-edit-history">${habitMonthlyHistory(habit)}</div>` : ''}`,
    h`${edit ? h`<button type="button" class="btn danger back" data-action="habit-delete-dialog">${icon('trash', 18)}Excluir</button><button type="button" class="btn back" data-action="${habit?.status === 'archived' ? 'habit-restore' : 'habit-archive'}" data-id="${d.id}">${habit?.status === 'archived' ? 'Restaurar' : 'Arquivar'}</button>` : h`<button class="btn back" data-action="dlg-close">Cancelar</button>`}<button class="btn primary" type="submit" form="dlgform">${edit ? 'Salvar alterações' : 'Adicionar hábito'}</button>`);
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
    water: areaOn('water') ? S.water : [],
    subjects: areaOn('studies') ? S.subjects : [],
    sessions: areaOn('studies') ? S.sessions : [],
    cycleLogs: searchableCycleLogs,
  }, query);
  if (String(query).trim().length < 2) return h`<p class="small muted">Digite pelo menos duas letras para buscar em Planejar, Estudos, Hábitos, Finanças e Ciclo.</p>`;
  if (!results.length) return empty('Nenhum resultado', 'Tente outro nome, categoria ou descrição.', '', 'search');
  const resultIcons = { task: 'check', transaction: 'wallet', habit: 'sparkles', water: 'droplet', subject: 'book', session: 'book', cycle: 'heart' };
  const groups = [...results.reduce((map, item) => {
    if (!map.has(item.area)) map.set(item.area, []);
    map.get(item.area).push(item);
    return map;
  }, new Map())];
  return h`<div class="global-search-results">${groups.map(([area, items]) => h`<section class="global-search-group" aria-label="Resultados em ${area}"><h3>${area}<span>${items.length}</span></h3><ul class="list">${items.map((item) => h`<li><button type="button" class="global-search-result" data-action="search-result" data-kind="${item.kind}" data-id="${item.id}"><span class="global-search-kind">${icon(resultIcons[item.kind] || 'search', 16)}</span><span class="grow"><b class="ttl">${item.title}</b><small class="small muted">${item.detail || item.kind}</small></span>${icon('chevRight', 16)}</button></li>`)}</ul></section>`)}</div>`;
}
function dlgSearch() {
  const query = ui.dlg.d.query || '';
  return dlgWrap(h`<div class="head global-search-head"><div><h2 id="dt">Buscar no Aurora<i>.</i></h2><p class="small muted">Planejar, Estudos, Hábitos, Finanças e Ciclo</p></div>${closeBtn}</div>
    <label class="search global-search-input"><span class="sr">Buscar em todas as áreas</span>${icon('search', 18)}<input id="f0" type="search" data-dlg="query" value="${query}" placeholder="Nome, matéria, categoria ou descrição" autocomplete="off"></label>
    <div id="global-search-results" aria-live="polite">${globalSearchResults(query)}</div>`,
    h`    <span class="small muted">Atalho: Ctrl+K ou ⌘K · Esc para fechar</span><button class="btn back" data-action="dlg-close">Fechar</button>`);
}
function dlgQuickCreate() {
  const option = (kind, iconName, title, description, tone = '') => h`<button type="button" class="quick-create-option ${tone}" data-action="quick-create" data-kind="${kind}"><span class="quick-create-icon">${icon(iconName, 20)}</span><span><b>${title}</b><small>${description}</small></span>${icon('chevRight', 16)}</button>`;
  const hasAccounts = S.finance.accounts.length > 0;
  return dlgWrap(h`<div class="quick-create-head"><span class="quick-create-brand" aria-hidden="true">${icon('plus', 20)}</span><div><p>ATENÇÃO AO AGORA</p><h2 id="dt">O que você quer criar<i>?</i></h2><span>Escolha um registro e continue no contexto certo.</span></div>${closeBtn}</div><div class="quick-create-list">
    ${option('task', 'check', 'Tarefa', 'Algo que você precisa fazer hoje.', 'accent')}
    ${option('expense', 'wallet', hasAccounts ? 'Despesa' : 'Conta financeira', hasAccounts ? 'Registre uma saída ou compromisso.' : 'Cadastre onde seu dinheiro fica primeiro.', 'finance')}
    ${option('habit', 'check', 'Hábito', 'Um pequeno passo para repetir na rotina.', 'habit')}
    ${areaOn('studies') ? option('subject', 'book', 'Matéria', 'Comece a acompanhar seus estudos.', 'study') : ''}
    ${areaOn('cycle') ? option('cycle', 'heart', 'Registro do ciclo', 'Registre como você está hoje.', 'cycle') : ''}
  </div>`, h`<button class="btn back" data-action="dlg-close">Cancelar</button>`, 'quick-create-dialog');
}
function dlgWipe() {
  return dlgWrap(h`<div class="head destructive-heading"><span class="destructive-mark" aria-hidden="true">${icon('trash', 20)}</span><div><p class="destructive-eyebrow">Ação permanente</p><h2 id="dt">Apagar todos os dados?</h2></div>${closeBtn}</div>
    <div class="destructive-summary"><p class="destructive-copy">Isso remove todas as informações salvas neste navegador. Depois da confirmação, não será possível recuperar os dados.</p>
    <aside class="destructive-note" role="alert">${icon('alert', 18)}<span><b>Faça um backup antes</b><small>Exporte uma cópia agora se quiser guardar seus dados.</small></span></aside></div>`,
    h`<button type="button" class="btn back" data-action="dlg-close">Cancelar e manter dados</button><button type="button" class="btn danger" data-action="wipe">Apagar permanentemente</button>`,
    'destructive-dialog');
}
function dlgWipeComplete() {
  return dlgWrap(h`<div class="wipe-complete"><span class="wipe-complete-mark" aria-hidden="true">${icon('check', 24)}</span><div class="wiz-h"><span class="eyebrow">Tudo pronto</span><h2 id="dt">Seus dados foram apagados<i>.</i></h2><p>Você voltou ao Início. Para criar, editar ou explorar exemplos, configure seu perfil primeiro.</p></div></div>`,
    h`<button type="button" class="btn primary" data-action="wipe-home">Ir para o Início</button>`,
    'wipe-complete-dialog');
}

/* ---- Boas-vindas em 3 passos ---- */
const OB_AREAS = [['finances', 'wallet'], ['cycle', 'heart'], ['habits', 'check']];
function dlgOnboard() {
  const d = ui.dlg.d, st = d.step;
  const kg = num(d.kg), age = Math.round(num(d.age));
  const waterGoal = kg >= 20 && kg <= 400
    ? estimateWaterGoal({ weightKg: kg, age: age >= 5 && age <= 120 ? age : null })
    : null;
  const dots = h`<div class="steps" aria-label="Passo ${st + 1} de 3">${[0, 1, 2].map((i) => h`<i class="${i <= st ? 'on' : ''}"></i>`)}</div>`;
  let body, foot;
  if (st === 0) {
    body = h`${dots}<div class="wiz-h">${brandIcon(52)}<h2 id="dt">Oi! Vamos deixar o <span class="brand-name">Aurora</span> com a sua cara<i>.</i></h2><p>Para usar a plataforma, informe seu nome e sua identidade de gênero. Idade e peso são opcionais; você pode escolher “Prefiro não informar”.</p></div>
      ${dlgField('Como você quer ser chamada(o)?', h`<input id="f0" type="text" data-dlg="name" value="${d.name}" maxlength="50" autocomplete="given-name" placeholder="Seu nome ou apelido" required>`)}
      ${dlgField('Como você se identifica?', h`<select data-dlg="sex" required aria-describedby="onboard-sex-help"><option value="">Selecione uma opção</option>${Object.entries(SEX).map(([key, label]) => h`<option value="${key}" ${d.sex === key ? raw('selected') : ''}>${label}</option>`)}</select><span class="profile-field-help" id="onboard-sex-help">Identidade de gênero não define orientação sexual. As opções incluem pessoas cis, trans e não binárias.</span>`)}
      `;
    foot = h`<button class="btn primary" data-action="ob-next">Continuar</button>`;
  } else if (st === 1) {
    body = h`${dots}<div class="wiz-h"><h2 id="dt">Conte um pouco sobre você<i>.</i></h2><p>Opcional. Idade e peso só ajudam a sugerir uma meta de água. Você pode deixar tudo em branco e alterar depois em Ajustes.</p></div>
      <div class="trio">${dlgField('Idade', h`<input id="f0" type="number" data-dlg="age" value="${d.age}" min="5" max="120" inputmode="numeric" placeholder="anos">`)}${dlgField('Peso', h`<input type="text" data-dlg="kg" value="${d.kg}" inputmode="decimal" placeholder="kg">`)}</div>
      ${waterGoal ? h`<div class="notice">${icon('droplet', 18)}<span>Com esse peso, sua meta de água sugerida será <b>${waterGoal.ml.toLocaleString('pt-BR')} ml</b> por dia.</span></div>` : ''}`;
    foot = h`<button class="btn back" data-action="ob-back">Voltar</button><button class="btn primary" data-action="ob-next">Continuar</button>`;
  } else {
    body = h`${dots}<div class="wiz-h"><h2 id="dt">O que você quer acompanhar<i>.</i></h2><p>Ative só o que fizer sentido. Dá para mudar depois.</p></div>
      <div class="f" role="group" aria-label="Cor do app"><span style="font-size:.8125rem;font-weight:600;color:var(--muted)">Escolha uma cor</span><div class="swatches">${Object.entries(PALETTES).map(([k, [n, c]]) => h`<button type="button" class="swatch" aria-pressed="${d.theme === k}" data-action="ob-theme" data-v="${k}"><i style="background:${c}"></i>${n}</button>`)}</div></div>
      <div style="display:flex;flex-direction:column;gap:10px">${OB_AREAS.map(([a, ic]) => h`<button type="button" class="opt" aria-pressed="${!!d.areas[a]}" data-action="ob-area" data-v="${a}"><span class="mk" data-area="${a}">${icon(ic, 22)}</span><span class="tx"><b>${AREAS[a][0]}</b><span>${AREAS[a][1]}</span></span><span class="tick">${icon('check', 15)}</span></button>`)}</div>`;
    foot = h`<button class="btn back" data-action="ob-back">Voltar</button><button class="btn primary" data-action="ob-finish">Começar</button>`;
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
      <li><span>Matérias e sessões de estudo</span><b>${p.subjects.length} · ${p.sessions.length}</b></li>
      <li><span>Hábitos e contas financeiras</span><b>${p.habits.length} · ${p.finance.accounts.length}</b></li>
      <li><span>Lançamentos financeiros</span><b>${p.finance.tx.length}</b></li>
      <li><span>Registros de hidratação e dias de ciclo</span><b>${p.water.length} · ${Object.keys(p.cycleLog).length}</b></li>
    </ul>
    <div class="notice warn" role="alert">${icon('alert', 18)}<span>Ao confirmar, todos os dados atuais deste navegador serão substituídos pelo conteúdo do backup. Para manter os dados atuais, exporte um backup antes.</span></div>`,
    h`<button class="btn back" data-action="dlg-close">Cancelar</button><button class="btn primary" data-action="import-apply">Substituir meus dados</button>`);
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
const DLG = { taskplan: dlgTaskPlan, task: dlgTask, 'cycle-log': dlgCycleLog, session: dlgSession, 'habit-edit': dlgHabitEdit, search: dlgSearch, 'quick-create': dlgQuickCreate, 'action-confirm': dlgActionConfirm, wipe: dlgWipe, 'wipe-complete': dlgWipeComplete, onboard: dlgOnboard, export: dlgExport, import: dlgImport };
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
  const isIntro = ui.dlg.type === 'intro', isCycleLog = ui.dlg.type === 'cycle-log';
  const opening = !el, typeChanged = Boolean(el && el.dataset.dialogType !== ui.dlg.type);
  const af = !opening && !typeChanged && document.activeElement && document.activeElement.closest('#dlg') ? document.activeElement : null;
  const afSel = af ? { id: af.id, data: af.dataset.dlg, action: af.dataset.action, v: af.dataset.v, c: af.dataset.c } : null;
  const prevScroll = !opening ? (el.querySelector('.dlg-body') || {}).scrollTop : 0;
  if (opening) { if (!ui.lastFocus) ui.lastFocus = describeDialogOpener(document.activeElement); el = document.createElement('div'); el.id = 'dlg'; el.className = 'dlg-back is-opening'; setTimeout(() => el.classList.remove('is-opening'), 500); document.body.appendChild(el); document.documentElement.style.overflow = 'hidden'; }
  el.classList.toggle('is-intro', isIntro);
  fitDlg();
  el.innerHTML = `<div class="dlg${isIntro ? ' intro-dialog' : ''}${isCycleLog ? ' cycle-log-dialog' : ''}" role="dialog" aria-modal="true" aria-labelledby="dt">${DLG[ui.dlg.type]().s}</div>`;
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
  const sub = [{ id: newId(), name: 'Biologia', ...sm }, { id: newId(), name: 'Matemática', ...sm }];
  S.subjects.push(...sub);
  S.tasks.push(
    mkTask({ title: 'Revisar capítulo 3 de Biologia', dueDate: t, priority: 'high', ...sm }),
    mkTask({ title: 'Lista de exercícios de Matemática', dueDate: addDays(t, 2), ...sm }),
    mkTask({ title: 'Marcar consulta de rotina', dueDate: addDays(t, -1), ...sm }),
    mkTask({ title: 'Comprar um caderno novo', ...sm }),
    mkTask({ title: 'Arrumar a mesa de estudos', done: true, doneAt: new Date().toISOString(), dueDate: t, priority: 'low', ...sm }));
  for (let i = 1; i <= 5; i++) S.sessions.push({ id: newId(), subjectId: sub[i % 2].id, subjectName: sub[i % 2].name, durationSeconds: (25 + i * 9) * 60, completedAt: new Date(pk(addDays(t, -i)).getTime() + 15 * 36e5).toISOString(), ...sm });
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
  Object.assign(S.settings.areas, { studies: true, water: true, finances: true, cycle: true, habits: true, pomodoro: true });
  S.settings.prefs.sample = true;
  S.settings.areas.cycle = true;
  commit(...SLICES);
}
const keepNonSample = (a) => a.filter((x) => !x.sample);
function removeSampleData() {
  S.tasks = keepNonSample(S.tasks); S.subjects = keepNonSample(S.subjects); S.sessions = keepNonSample(S.sessions); S.water = keepNonSample(S.water);
  S.gym = { templates: keepNonSample(S.gym.templates), logs: keepNonSample(S.gym.logs) };
  const accs = keepNonSample(S.finance.accounts);
  S.finance = { accounts: accs, tx: S.finance.tx.filter((x) => !x.sample && accs.some((a) => a.id === x.accountId)), budgets: Object.fromEntries(Object.entries(S.finance.budgets || {}).filter(([, b]) => !b.sample)), goals: keepNonSample(S.finance.goals || []), recurring: (S.finance.recurring || []).filter((r) => accs.some((a) => a.id === r.accountId)) };
  S.cycle = keepNonSample(S.cycle); S.cycleLog = Object.fromEntries(Object.entries(S.cycleLog).filter(([, l]) => !l.sample)); S.weight = keepNonSample(S.weight);
  if (!S.subjects.some((s) => s.id === S.timer.subjectId)) S.timer = timerReset();
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
    profile: { name: s.profile.name.slice(0, 50) },
    tasks: S.tasks.map((t) => ({ id: t.id, title: t.title, done: t.done, tag: t.tag, dueDate: t.dueDate, priority: t.priority, groupId: t.groupId, groupTitle: t.groupTitle, doneAt: t.doneAt, createdAt: t.createdAt, repeat: t.repeat, time: t.time, remind: t.remind, subtasks: t.subtasks, tags: t.tags, notes: t.notes, order: t.order, focusSeconds: t.focusSeconds })),
    subjects: S.subjects.map((x) => ({ id: x.id, name: x.name, archived: !!x.archived })),
    studySessions: S.sessions.map((x) => ({ id: x.id, subjectId: x.subjectId, subjectName: x.subjectName, durationSeconds: x.durationSeconds, completedAt: x.completedAt })),
    studyTimer: S.timer, areas: s.areas, theme: s.theme === 'custom' ? 'rose' : s.theme, weightTracking: s.weightTracking, accountTypes: s.accountTypes, onboardingComplete: s.onboardingComplete, introSeen: s.introSeen },
    extras: { themeFull: s.theme, look: s.look, lists: s.lists, cats: s.cats, water: S.water, gym: S.gym, finance: S.finance, cycle: S.cycle, cycleLog: S.cycleLog, weight: S.weight, habits: S.habits, pomodoroTimer: S.pomodoro, prefs: s.prefs, about: { sex: s.profile.sex, age: s.profile.age, weightKg: s.profile.weightKg, heightCm: s.profile.heightCm } } }, null, 2);
}
async function doExport() {
  if (Object.keys(ui.integrityIssues).length) {
    toast('O backup normal não foi criado para evitar omitir dados locais inválidos. Baixe a cópia de recuperação ou importe um backup confiável.');
    return;
  }
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
  const rawStorage = {};
  for (const slice of Object.keys(ui.integrityIssues)) {
    try {
      const value = window.localStorage.getItem(Persist.lsKey(slice));
      if (value === null) throw new Error(`A chave local de ${slice} não foi encontrada.`);
      rawStorage[slice] = value;
    } catch (error) {
      console.error(`Aurora: não foi possível ler a cópia bruta de ${slice}.`, error);
      toast(`Não foi possível baixar a cópia de recuperação de ${slice}.`);
      return;
    }
  }
  if (!Object.keys(rawStorage).length) {
    toast('Não há dados locais bloqueados para exportar.');
    return;
  }
  const recovery = JSON.stringify({
    app: 'aurora-recovery',
    version: 1,
    exportedAt: new Date().toISOString(),
    rawStorage,
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
  if (d.introSeen !== undefined && typeof d.introSeen !== 'boolean') throw new Error('O indicador da introdução no backup está inválido.');
  if (d.profile !== undefined && (!isPlainObject(d.profile)
    || (d.profile.name !== undefined && !isText(d.profile.name)))) throw new Error('O perfil do backup está inválido.');
  const sourceTasks = backupRecords(d.tasks, (task) => isPlainObject(task) && isText(task.title)
    && isValidTask({ ...task, id: isNonEmptyText(task.id) ? task.id : 'backup-task' }), 'tarefas');
  const sourceSubjects = backupRecords(d.subjects, (subject) => isPlainObject(subject) && isText(subject.name), 'matérias');
  const sourceSessions = backupRecords(d.studySessions, (session) => isPlainObject(session)
    && isFiniteValue(session.durationSeconds) && session.durationSeconds >= 0
    && isIsoTimestamp(session.completedAt), 'sessões de estudo');
  const ids = new Set(), uniq = (x) => { if (typeof x.id !== 'string' || !x.id || ids.has(x.id)) x.id = newId(); ids.add(x.id); return x; };
  const tasks = sourceTasks.map((t) => uniq({ id: t.id, title: t.title.slice(0, 120), done: !!t.done, tag: typeof t.tag === 'string' ? t.tag : 'Pessoal', dueDate: isDay(t.dueDate) ? t.dueDate : null, priority: ['low', 'normal', 'high'].includes(t.priority) ? t.priority : 'normal', ...(t.groupId !== undefined ? { groupId: t.groupId } : {}), ...(t.groupTitle !== undefined ? { groupTitle: t.groupTitle } : {}), ...(t.doneAt !== undefined ? { doneAt: t.doneAt } : {}), createdAt: t.createdAt || Date.now(), ...(REPEATS[t.repeat] && t.repeat !== 'none' ? { repeat: t.repeat } : {}), ...(isTime(t.time) ? { time: t.time } : {}), ...(Number.isFinite(Number(t.remind)) && t.remind !== null && isTime(t.time) ? { remind: Number(t.remind) } : {}), ...(Number.isSafeInteger(t.focusSeconds) && t.focusSeconds >= 0 ? { focusSeconds: t.focusSeconds } : {}), ...(Array.isArray(t.tags) && t.tags.length ? { tags: t.tags.slice(0, 12).map((g) => g.slice(0, 24)) } : {}), ...(typeof t.notes === 'string' && t.notes ? { notes: t.notes.slice(0, 2000) } : {}), ...(Number.isFinite(t.order) ? { order: t.order } : {}), ...(Array.isArray(t.subtasks) && t.subtasks.length ? { subtasks: t.subtasks.slice(0, 40).map((x) => ({ id: x.id || newId(), title: x.title.slice(0, 100), done: !!x.done })) } : {}) }));
  const subjects = sourceSubjects.map((x) => uniq({ id: x.id, name: x.name, archived: !!x.archived }));
  const sessions = sourceSessions.map((x) => uniq({ id: x.id, subjectId: String(x.subjectId || ''), subjectName: String(x.subjectName || 'Matéria'), durationSeconds: x.durationSeconds, completedAt: x.completedAt }));
  const t0 = d.studyTimer || {};
  if (d.studyTimer !== undefined && !isPlainObject(d.studyTimer)) throw new Error('O cronômetro do backup está inválido.');
  const onboardingComplete = typeof d.onboardingComplete === 'boolean' ? d.onboardingComplete : true;
  const settingsResult = normalizeSlice('settings', { profile: { name: String(d.profile?.name || '').slice(0, 50) }, areas: d.areas, theme: ex.themeFull !== undefined ? ex.themeFull : d.theme, look: ex.look, lists: ex.lists, cats: ex.cats, weightTracking: d.weightTracking, accountTypes: d.accountTypes, onboardingComplete, introSeen: typeof d.introSeen === 'boolean' ? d.introSeen : onboardingComplete, prefs: ex.prefs });
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
  const timer = validatedBackupSlice('timer', d.studyTimer || timerReset());
  const pomodoro = validatedBackupSlice('pomodoro', Object.hasOwn(ex, 'pomodoroTimer') ? ex.pomodoroTimer : standaloneTimerReset());
  const habits = backupRecords(ex.habits, isValidHabit, 'hábitos');
  return {
    tasks: validatedBackupSlice('tasks', tasks),
    subjects: validatedBackupSlice('subjects', subjects),
    sessions: validatedBackupSlice('sessions', sessions),
    timer,
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
  'nav-more-toggle': () => { ui.navigationOpen = !ui.navigationOpen; render(); if (ui.toast) renderToast(); },
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
    if (!input) return;
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
    if (habit.tracking === 'water') {
      ui.notificationsOpen = false;
      return nav('agua');
    }
    const day = today();
    if (!habit.completions.includes(day)) habit.completions = [...habit.completions, day];
    ui.notificationsOpen = false;
    nav('habitos');
    commit('habits');
  },
  'rem-snooze': (el) => { const a = ui.alerts[el.dataset.k]; if (a) { ui.snooze[el.dataset.k] = Date.now() + (Number(el.dataset.min) || 10) * 60000; delete ui.alerts[el.dataset.k]; delete ui.fired[el.dataset.k]; render(); } },
  'rem-dismiss': (el) => { delete ui.alerts[el.dataset.k]; render(); },
  'rem-dismiss-all': () => { const had = Object.keys(ui.alerts).length; Object.keys(ui.alerts).forEach((k) => { if (ui.alerts[k].kind === 'pomodoro') clearPomodoroNotifications(ui.alerts[k].timerSlice); delete ui.alerts[k]; }); ui.notificationsOpen = false; render(); if (had) toast('Notificações dispensadas.'); },
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
    } else if (timer.startedAt === null && timer.phase === 'focus') {
      togglePomodoroTimer('pomodoro');
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
  'quick-create-open': () => { ui.navigationOpen = false; dlgOpen('quick-create'); },
  'quick-create': (el) => {
    const kind = el.dataset.kind;
    ui.dlg = null;
    if (kind === 'task') return openTaskDialog(today());
    if (kind === 'expense') return S.finance.accounts.length ? newTxDlg('out') : dlgOpen('account', { name: '', bank: '', type: (S.settings.accountTypes[0] || 'checking'), balance: '', limit: '', closing: '', due: '' });
    if (kind === 'habit') return dlgOpen('habit-edit', { name: '', days: [0, 1, 2, 3, 4, 5, 6], remind: '', weeklyGoal: '', icon: DEFAULT_HABIT_ICON, color: HABIT_COLORS[S.habits.length % HABIT_COLORS.length] });
    if (kind === 'subject') { ui.openDetails.subj = true; nav('estudos'); return; }
    if (kind === 'cycle') { nav('ciclo'); requestAnimationFrame(() => ACTIONS['cyc-open']()); }
  },
  'search-result': (el) => {
    const query = ui.dlg?.d.query || '';
    ui.dlg = null;
    if (el.dataset.kind === 'task') {
      const task = findTask(el.dataset.id);
      if (!task) return toast('Esta tarefa não está mais disponível.');
      ui.focusActive = false;
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
    if (el.dataset.kind === 'water') {
      if (!S.water.some((entry) => entry.id === el.dataset.id)) return toast('Este registro de hidratação não está mais disponível.');
      nav('agua');
      return;
    }
    if (el.dataset.kind === 'subject') {
      if (!S.subjects.some((subject) => subject.id === el.dataset.id)) return toast('Esta matéria não está mais disponível.');
      ui.openDetails.subj = true;
      nav('estudos');
      return;
    }
    if (el.dataset.kind === 'session') {
      if (!S.sessions.some((session) => session.id === el.dataset.id)) return toast('Esta sessão de estudos não está mais disponível.');
      nav('estudos');
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
    togglePomodoroTimer(alert.timerSlice === 'pomodoro' ? 'pomodoro' : 'timer');
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
    if (saved) toast(text ? 'Reflexão salva neste navegador.' : 'Reflexão removida.');
  },
  'weekly-open-finances': () => { ui.finTab = 'resumo'; nav('financas'); },
  'weekly-open-studies': () => { ui.openDetails.man = true; nav('estudos'); },
  'weekly-open-habits': () => nav('habitos'),
  'habit-idea': (el) => {
    const idea = SUGGESTED_HABITS.find((item) => item.id === el.dataset.id && item.tracking !== 'water');
    if (!idea) return;
    dlgOpen('habit-edit', { name: idea.name, days: [0, 1, 2, 3, 4, 5, 6], remind: '', weeklyGoal: '', icon: idea.icon, color: idea.color });
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
    if (habit?.tracking === 'water') return nav('agua');
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
    if (!habit || habit.tracking === 'water' || (habit.status || 'active') !== 'active'
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
    if (!habit || habit.tracking === 'water' || habit.status === 'paused'
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
    const order = S.habits.filter((item) => item.tracking !== 'water' && item.status !== 'archived');
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
  'habit-water-open': () => {
    ui.openDetails.water = true;
    if (ui.route !== 'habitos') return nav('habitos');
    render();
    requestAnimationFrame(() => {
      const target = $('#agua');
      if (target) { target.focus({ preventScroll: true }); target.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    });
  },
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
  'focus-go': () => { ui.focusActive = true; if (ui.route === 'planejar') { if (location.hash.slice(1) !== 'estudos') nav('estudos'); else render(); $('#tm')?.scrollIntoView({ block: 'start' }); } else nav('estudos'); },
  'studies-open-manual': () => { ui.openDetails.man = true; render(); requestAnimationFrame(() => document.querySelector('#d-man select')?.focus()); },
  'studies-open-subject': () => { ui.openDetails.subj = true; render(); requestAnimationFrame(() => document.querySelector('#sn')?.focus()); },
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
  'retry-studies-template': () => { requestStudiesTemplate(); render(); },
  'retry-water-template': () => { requestWaterTemplate(); render(); },
  'set-free-pomodoro-preset': (el) => {
    const preset = el.dataset.preset, timer = S.pomodoro;
    if (!['classic', 'custom'].includes(preset)) return;
    if (timer.startedAt !== null || timer.elapsedSeconds > 0 || timer.completedPomodoros > 0 || phaseElapsedSeconds(timer) > 0) {
      return toast('Conclua ou descarte o Pomodoro atual para trocar o bloco.');
    }
    updateSettingsDraft((settings) => { settings.prefs.pomodoro.preset = preset; });
  },
  'toggle-free-timer': () => togglePomodoroTimer('pomodoro'),
  'skip-free-break': () => skipPomodoroBreak('pomodoro'),
  'finish-free-timer': () => finishPomodoro('pomodoro'),
  'discard-free-timer': () => discardPomodoro('pomodoro'),
  'pomodoro-push-toggle': () => togglePomodoroPush(),
  'plan-home': () => { if (!ui.focusActive) return; ui.focusActive = false; if (ui.route === 'planejar') { if (location.hash.slice(1) === 'estudos') nav('planejar'); else render(); } },
  'open-profile-setup': () => openProfileSetup(),
  'filter-inbox': () => { ui.filters.f = 'caixa'; },
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
  'toggle-timer': () => togglePomodoroTimer('timer'),
  'skip-break': () => skipPomodoroBreak('timer'),
  'finish-timer': () => finishPomodoro('timer'),
  'discard-timer': () => discardPomodoro('timer'),
  'arch-subject': (el) => { const s = S.subjects.find((x) => x.id === el.dataset.id); if (!s) return; if (!s.archived && S.timer.startedAt !== null && S.timer.subjectId === s.id) return toast('Pause ou conclua a sessão antes de arquivar.'); s.archived = !s.archived; if (s.archived && S.timer.subjectId === s.id) S.timer.subjectId = ''; commit('subjects', 'timer'); },
  'del-subject': (el) => {
    const subject = S.subjects.find((item) => item.id === el.dataset.id);
    if (!subject) return;
    if (S.timer.startedAt !== null && S.timer.subjectId === subject.id) return toast('Pause ou conclua a sessão antes de remover.');
    if (ui.confirmedAction !== 'del-subject') return requestActionConfirmation('del-subject', { id: subject.id }, 'Remover matéria?', `A matéria "${subject.name}" irá para a lixeira por 30 dias; o histórico de sessões continuará disponível.`, 'Remover matéria');
    const i = S.subjects.findIndex((item) => item.id === subject.id);
    if (i < 0) return;
    const records = [createTrashRecord('subjects', subject.id, i, subject)];
    if (S.timer.subjectId === subject.id) {
      records.push(createTrashRecord('timer.subject', subject.id, 0, { subjectId: subject.id }));
    }
    const entry = moveRecordsToTrash(`Matéria: ${subject.name}`, records, ['subjects', 'timer'], () => {
      S.subjects.splice(i, 1);
      if (S.timer.subjectId === subject.id) S.timer = { ...S.timer, subjectId: '' };
    });
    if (entry) toast('Matéria movida para a lixeira. O histórico de sessões foi mantido.', () => restoreTrashEntry(entry.id));
  },
  'edit-session': (el) => { const s = S.sessions.find((x) => x.id === el.dataset.id); if (s) dlgOpen('session', { id: s.id, min: Math.max(1, Math.round(s.durationSeconds / 60)), date: isoDay(s.completedAt) }); },
  'del-session': (el) => {
    const session = S.sessions.find((item) => item.id === el.dataset.id);
    if (!session) return;
    if (ui.confirmedAction !== 'del-session') return requestActionConfirmation('del-session', { id: session.id }, 'Excluir sessão?', `A sessão de "${session.subjectName}" irá para a lixeira por 30 dias.`, 'Excluir sessão');
    const i = S.sessions.findIndex((item) => item.id === session.id);
    if (i < 0) return;
    const entry = moveRecordsToTrash(`Sessão de estudo: ${session.subjectName}`, [
      createTrashRecord('sessions', session.id, i, session),
    ], ['sessions'], () => { S.sessions.splice(i, 1); });
    if (entry) toast('Sessão movida para a lixeira.', () => restoreTrashEntry(entry.id));
  },
  'add-water': (el) => { S.water.push({ id: newId(), ml: Number(el.dataset.ml), at: new Date().toISOString() }); commit('water'); completionFeedback('.habit-water-row .habit-circle'); },
  'del-water': (el) => {
    const entry = S.water.find((item) => item.id === el.dataset.id);
    if (!entry) return;
    if (ui.confirmedAction !== 'del-water') return requestActionConfirmation('del-water', { id: entry.id }, 'Remover registro de água?', `O registro de ${entry.ml} ml irá para a lixeira por 30 dias.`, 'Remover registro');
    const i = S.water.findIndex((item) => item.id === entry.id);
    if (i < 0) return;
    const trashEntry = moveRecordsToTrash(`Água: ${entry.ml} ml`, [
      createTrashRecord('water', entry.id, i, entry),
    ], ['water'], () => { S.water.splice(i, 1); });
    if (trashEntry) toast('Registro movido para a lixeira.', () => restoreTrashEntry(trashEntry.id));
  },
  'cal-month': (el) => { ui.calMonth = shiftMonth(ui.calMonth, Number(el.dataset.n)); render(); },
  'cyc-day': (el) => { ui.cycDay = el.dataset.d; ui.calMonth = el.dataset.d.slice(0, 7); render(); },
  'cyc-open': () => {
    const day = ui.cycDay && ui.cycDay <= today() ? ui.cycDay : today();
    dlgOpen('cycle-log', { day, log: cycleLogDraft(dayLog(day)) });
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
  'suggest-water': () => {
    const c = estimateWaterGoal(S.settings.profile);
    if (!c) return;
    updateSettingsDraft((settings) => { settings.prefs.waterGoalMl = c.ml; });
    toast(`Meta de água sugerida: ${settingsView().prefs.waterGoalMl} ml. Salve para aplicá-la.`);
  },
  'toggle-acc': (el) => updateSettingsDraft((settings) => {
    const k = el.dataset.v, types = settings.accountTypes;
    settings.accountTypes = types.includes(k) ? types.filter((x) => x !== k) : [...types, k];
  }),
  'export': () => doExport(),
  'recovery-export': () => exportRecoveryData(),
  'copy-export': async () => { if (Object.keys(ui.integrityIssues).length) return toast('O backup normal não foi copiado para evitar omitir dados locais inválidos.'); const ta = $('#exp'); try { await navigator.clipboard.writeText(ta.value); toast('Copiado.'); } catch (e) { ta.focus(); ta.select(); toast('Selecionei o texto: copie manualmente.'); } S.settings.prefs.lastBackup = new Date().toISOString(); saveSlices('settings'); },
  'import-apply': () => {
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

    for (const k of SLICES) {
      S[k] = p[k];
      ui.persistBlocked.delete(k);
    }

    const result = runStorageTransaction({
      keys: SLICES,
      readRaw: (k) => window.localStorage.getItem(Persist.lsKey(k)),
      writeRaw: (k, value) => window.localStorage.setItem(Persist.lsKey(k), value),
      removeRaw: (k) => window.localStorage.removeItem(Persist.lsKey(k)),
      persist: (k) => Persist.save(k),
    });

    if (!result.ok) {
      restoreMetadata();

      if (result.rollbackFailed) {
        ui.persistBlocked.clear();
        ui.persistFailed.clear();

        for (const k of SLICES) {
          ui.persistBlocked.add(k);
          ui.persistFailed.add(k);
        }

        ui.integrityIssues = Object.fromEntries(SLICES.map((k) => [k, 1]));
        render();
        toast('Falha ao salvar e restaurar todos os dados. Não recarregue a página; o armazenamento precisa ser recuperado.');
        return;
      }

      render();

      toast(
        result.stage === 'snapshot'
          ? 'Não foi possível ler o armazenamento antes da importação. Nenhum dado foi substituído.'
          : 'A gravação do backup falhou. Os dados anteriores foram restaurados.'
      );
      return;
    }

    ui.persistBlocked.clear();
    ui.persistFailed.clear();
    ui.integrityIssues = {};
    ui.settingsDraft = null;
    ui.settingsDraftBase = null;
    ui.dlg = null;
    render();
    toast('Backup importado.');
    if (!profileSetupComplete()) openProfileSetup();
  },
  'wipe-ask': () => dlgOpen('wipe'),
  'wipe': () => { S = defaults(); ui.settingsDraft = null; ui.settingsDraftBase = null; ui.dlg = createDialog('wipe-complete', {}); ui.dlgPending = null; ui.persistBlocked.clear(); ui.integrityIssues = {}; location.hash = 'inicio'; commit(...SLICES); },
  'wipe-home': () => { ui.dlg = null; render(); },
  'ob-theme': (el) => { ui.dlg.d.theme = el.dataset.v; render(); },
  'ob-next': () => {
    if (ui.dlg?.d.step === 0) {
      if (!ui.dlg.d.name.trim()) return fieldError('Informe seu nome ou apelido para continuar.', '[data-dlg="name"]');
      if (!Object.hasOwn(SEX, ui.dlg.d.sex)) return fieldError('Selecione uma identidade de gênero ou “Prefiro não informar”.', '[data-dlg="sex"]');
    }
    ui.dlg.d.step++;
    render();
  },
  'ob-back': () => { ui.dlg.d.step--; render(); },
  'ob-area': (el) => { const a = el.dataset.v, ar = ui.dlg.d.areas; ui.dlg.d.touched = true; ar[a] = !ar[a]; render(); },
  'ob-finish': () => finishOnboard(),
};
function finishOnboard() {
  const d = ui.dlg.d;
  if (!hasRequiredProfile(d)) {
    d.step = 0;
    render();
    return fieldError(
      d.name.trim() ? 'Selecione uma identidade de gênero ou “Prefiro não informar”.' : 'Informe seu nome ou apelido para continuar.',
      d.name.trim() ? '[data-dlg="sex"]' : '[data-dlg="name"]',
    );
  }
  const snapshot = snapshotSlices(['settings', 'weight']);
  Object.assign(S.settings, { onboardingComplete: true, introSeen: true, theme: d.theme });
  Object.assign(S.settings.profile, { name: d.name.trim().slice(0, 50), sex: d.sex });
  applyAbout(d);
  S.settings.areas = { ...S.settings.areas, ...d.areas };
  if (!persistSlicesAtomically(['settings', 'weight'], snapshot, false, 'o perfil')) {
    render();
    return;
  }
  ui.dlg = ui.returnDialog;
  ui.returnDialog = null;
  render();
  toast('Perfil configurado.');
}
/* ---- Sobre você ---- */
function applyAbout(d) {
  const p = S.settings.profile, age = Math.round(num(d.age)), kg = num(d.kg);
  p.age = age >= 5 && age <= 120 ? age : null; p.weightKg = kg >= 20 && kg <= 400 ? Math.round(kg * 10) / 10 : null;
  if (p.weightKg) { S.settings.prefs.waterGoalMl = estimateWaterGoal(p).ml; S.settings.weightTracking = true; S.weight.push({ id: newId(), kg: p.weightKg, date: today() }); }
}

/* ---- Formulários ---- */
const num = (v) => Number(String(v).replace(',', '.'));
const FORMS = {
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
      sex: S.settings.profile.sex || '',
      age: S.settings.profile.age == null ? '' : String(S.settings.profile.age),
      weightKg: S.settings.profile.weightKg == null ? '' : String(S.settings.profile.weightKg),
    };
    const ageInput = draft.age.trim(), weightInput = draft.weightKg.trim();
    const age = ageInput ? Math.round(num(ageInput)) : null;
    const weightKg = weightInput ? num(weightInput) : null;
    if (!draft.name.trim()) { toast('Informe seu nome ou apelido.'); $('#pname')?.focus(); return; }
    if (!Object.hasOwn(SEX, draft.sex)) { toast('Selecione uma identidade de gênero ou “Prefiro não informar”.'); $('#psex')?.focus(); return; }
    if (ageInput && (!Number.isFinite(age) || age < 5 || age > 120)) return toast('A idade deve estar entre 5 e 120 anos.');
    if (weightInput && (!Number.isFinite(weightKg) || weightKg < 20 || weightKg > 400)) return toast('O peso deve estar entre 20 e 400 kg.');
    const previousProfile = { ...S.settings.profile };
    Object.assign(S.settings.profile, { name: draft.name.trim().slice(0, 50), sex: draft.sex, age, weightKg: weightKg == null ? null : Math.round(weightKg * 10) / 10 });
    if (!saveSlices('settings')) {
      S.settings.profile = previousProfile;
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
    if (!days.length || days.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) return toast('Selecione pelo menos um dia válido.');
    if (remind && !isTime(remind)) return fieldError('Informe um horário válido para o lembrete.', '[data-dlg="remind"]');
    if (weeklyGoal && (!Number.isInteger(weeklyGoal) || weeklyGoal < 1 || weeklyGoal > days.length)) return toast('A meta semanal não pode passar do número de dias escolhidos.');
    if (habitsWithWater().some((item) => item.id !== draft?.id && norm(item.name) === norm(name))) return fieldError('Você já acompanha um hábito com esse nome.', '[data-dlg="name"]');
    if (draft?.id && !habit) return dlgClose();
    if (habit) {
      Object.assign(habit, { name: name.slice(0, 60), days, ...look });
      if (remind) habit.remind = remind;
      else delete habit.remind;
      if (weeklyGoal) habit.weeklyGoal = weeklyGoal;
      else delete habit.weeklyGoal;
    } else {
      S.habits.push({ id: newId(), name: name.slice(0, 60), days, completions: [], status: 'active', ...look, ...(remind ? { remind } : {}), ...(weeklyGoal ? { weeklyGoal } : {}) });
    }
    ui.dlg = null;
    const saved = saveSlices('habits');
    render();
    if (saved) toast(habit ? 'Hábito atualizado.' : 'Hábito adicionado.');
  },
  'tg-add': (f, d) => { const v = String(d.get('tg') || '').trim().replace(/^#/, '').toLowerCase().replace(/[^\p{L}\d_-]/gu, '').slice(0, 24); if (!v) return; const a = ui.dlg.d.tags = ui.dlg.d.tags || []; if (!a.includes(v)) a.push(v); render(); const i = $('#tgn'); if (i) i.focus(); },
  'st-add': (f, d) => { const v = String(d.get('st') || '').trim().slice(0, 100); if (!v) return; (ui.dlg.d.subs = ui.dlg.d.subs || []).push({ id: newId(), title: v, done: false }); render(); const i = $('#stn'); if (i) i.focus(); },
  'subject': (f, d) => { const name = String(d.get('name')).trim(); if (!name) return; if (S.subjects.some((s) => norm(s.name) === norm(name))) return toast('Você já cadastrou uma matéria com esse nome.'); const s = { id: newId(), name: name.slice(0, 60) }; S.subjects.push(s); if (!S.timer.subjectId) S.timer.subjectId = s.id; ui.openDetails.subj = true; f.reset(); commit('subjects', 'timer'); },
  'manual-session': (f, d) => { const min = Math.round(num(d.get('min'))), sub = S.subjects.find((s) => s.id === d.get('subjectId')); if (!sub || !(min >= 1 && min <= 1440)) return toast('Informe matéria e minutos (1 a 1440).'); const day = isDay(d.get('date')) ? d.get('date') : today(); S.sessions.push({ id: newId(), subjectId: sub.id, subjectName: sub.name, durationSeconds: min * 60, completedAt: new Date(pk(day).getTime() + 12 * 36e5).toISOString() }); ui.openDetails.man = false; f.reset(); commit('sessions'); toast('Sessão registrada.'); },
  'water': (f, d) => { const ml = Math.round(num(d.get('ml'))); if (!(ml >= 10 && ml <= 3000)) return toast('Informe entre 10 e 3000 ml.'); S.water.push({ id: newId(), ml, at: new Date().toISOString() }); f.reset(); commit('water'); },
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
  'dlg-session': () => { const d = ui.dlg.d, s = S.sessions.find((x) => x.id === d.id), min = Math.round(num(d.min)); if (!s) return dlgClose(); if (!(min >= 1 && min <= 1440)) return toast('Informe de 1 a 1440 minutos.'); const day = isDay(d.date) ? d.date : isoDay(s.completedAt); s.durationSeconds = min * 60; if (day !== isoDay(s.completedAt)) s.completedAt = new Date(pk(day).getTime() + 12 * 36e5).toISOString(); ui.dlg = null; commit('sessions'); },
};
const CHANGES = {
  'sort': (el) => { ui.filters.sort = el.value; render(); },
  'timer-subject': (el) => { S.timer.subjectId = el.value; commit('timer'); },
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
  'goal-study': (el) => updateSettingsDraft((settings) => {
    settings.prefs.studyGoalMin = clamp(Math.round(num(el.value)) || 120, 10, 1440);
  }, false),
  'goal-water': (el) => updateSettingsDraft((settings) => {
    settings.prefs.waterGoalMl = clamp(Math.round(num(el.value) / 50) * 50 || 2000, 500, 10000);
  }, false),
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
  'free-pomo-long': (el) => {
    const timer = S.pomodoro;
    if (timer.startedAt !== null || timer.elapsedSeconds > 0 || timer.completedPomodoros > 0 || phaseElapsedSeconds(timer) > 0) {
      return toast('Conclua ou descarte o Pomodoro atual para editar os tempos.');
    }
    updateSettingsDraft((settings) => {
      settings.prefs.pomodoro.longBreakMin = clamp(Math.round(num(el.value)) || 15, 5, 60);
      settings.prefs.pomodoro.preset = 'custom';
    }, false);
  },
  'import': (el) => { const f = el.files && el.files[0]; importFile(f); el.value = ''; },
};
const SETTINGS_INPUT_CHANGES = new Set(['goal-study', 'goal-water', 'free-pomo-focus', 'free-pomo-break', 'free-pomo-long']);

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
document.addEventListener('drop', (e) => { const li = e.target.closest && e.target.closest('.task[draggable]'); if (!li || !ui.dragId) return; e.preventDefault(); const d = findTask(ui.dragId), t = findTask(li.dataset.k); ui.dragId = null; if (!d || !t || d === t) return; if (!requireProfileSetup()) return; renumberTasks(); d.order = t.order - 500; commit('tasks'); });
document.addEventListener('dragend', () => { ui.dragId = null; });
let tickN = 0;
function checkReminders() {
  const now = Date.now(), currentTime = new Date(now).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); let changed = false, triggered = false;
  S.tasks.forEach((t) => {
    if (t.done || !t.dueDate || !t.time || t.remind == null) return;
    const due = new Date(`${t.dueDate}T${t.time}:00`).getTime(), fire = due - Number(t.remind) * 60000, key = `${t.id}|${t.dueDate}|${t.time}|${t.remind}`;
    if (now >= fire && now <= due + 2 * 3600000 && !ui.fired[key] && now >= (ui.snooze[key] || 0)) { ui.fired[key] = true; ui.alerts[key] = { id: t.id, title: t.title, time: t.time, due, at: now }; triggered = true; changed = true; }
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
    triggered = true;
    changed = true;
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
  if (changed) { if (triggered) ui.notificationsOpen = true; render(); }
}
function notifyPomodoroPhase(phase, timer = S.timer, slice = 'timer') {
  playPomodoroSound();
  clearPomodoroNotifications(slice);
  const pom = pomodoroSettingsForTimer(slice);
  const key = `pomodoro:${slice}:${timer.completedPomodoros}:${phase}`;
  const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const alert = phase === 'focus'
    ? { title: 'Hora de voltar ao foco', detail: `A pausa acabou. O próximo bloco de foco dura ${pom.focusMin} min.` }
    : phase === 'long-break'
      ? { title: 'Pausa longa', detail: `Você concluiu quatro ciclos. Descanse por ${longBreakMinutes(pom)} min.` }
      : { title: 'Pausa curta', detail: `Bloco de foco concluído. Descanse por ${pom.breakMin} min.` };
  ui.alerts[key] = { kind: 'pomodoro', phase, timerSlice: slice, ...alert, time, at: Date.now() };
  ui.notificationsOpen = true;
}
function syncPomodoroTimer(now = Date.now()) {
  const changed = [];
  ['timer', 'pomodoro'].forEach((slice) => {
    const advanced = advancePomodoro(S[slice], pomodoroSettingsForTimer(slice), now);
    if (!advanced.transitions.length) return;
    S[slice] = advanced.timer;
    notifyPomodoroPhase(advanced.transitions[advanced.transitions.length - 1], advanced.timer, slice);
    changed.push(slice);
  });
  if (!changed.length) return false;
  commit(...changed);
  if (changed.includes('pomodoro')) syncPomodoroPushSchedule(S.pomodoro);
  return true;
}
function tick() {
  if (tickN++ % 10 === 0) checkReminders();
  if (syncPomodoroTimer()) return;
  if (dk() !== lastDay) { lastDay = dk(); render(); return; }
  const now = Date.now();
  [['timer', '#clock', '#tstate', '#pomo-phase', '#pomo-cycles', '#pomo-copy', '.focus-dial-progress'],
    ['pomodoro', '#standalone-pomo-clock', '#standalone-pomo-state', '#standalone-pomo-phase', '#standalone-pomo-cycles', '#standalone-pomo-copy', '#standalone-pomo-progress']]
    .forEach(([slice, clockSelector, stateSelector, phaseSelector, cycleSelector, copySelector, dialSelector]) => {
      const timer = S[slice], pom = pomodoroSettingsForTimer(slice);
      const elapsed = phaseElapsedSeconds(timer, now), duration = phaseDurationSeconds(pom, timer.phase);
      const clockElement = $(clockSelector);
      if (!clockElement) return;
      clockElement.textContent = clock(Math.max(0, duration - elapsed));
      const phaseLabel = phaseSelector ? $(phaseSelector) : null, cycleLabel = cycleSelector ? $(cycleSelector) : null, copy = $(copySelector), dial = $(dialSelector);
      const hasProgress = timer.elapsedSeconds > 0 || timer.completedPomodoros > 0 || elapsed > 0;
      if (phaseLabel) phaseLabel.textContent = timerPhaseName(timer.phase);
      if (cycleLabel) cycleLabel.textContent = timerCycleLabel(timer.phase, timer.completedPomodoros);
      if (copy) copy.textContent = timerPhaseMessage(timer.phase, pom, timer.completedPomodoros, slice !== 'pomodoro');
      const state = $(stateSelector);
      if (state) state.textContent = timerPhaseLabel(timer.phase, timer.startedAt !== null, hasProgress);
      if (dial) {
        dial.style.strokeDashoffset = `${(2 * Math.PI * 50 * (1 - Math.min(1, elapsed / duration))).toFixed(1)}`;
        dial.closest('.focus-timer')?.setAttribute('data-phase', timer.phase);
      }
      if (slice === 'pomodoro') {
        const dailyCount = $('#standalone-pomo-today');
        const completedToday = timer.dailyCompletedOn === today() ? timer.dailyCompletedPomodoros : 0;
        if (dailyCount) dailyCount.textContent = `${completedToday} ${plural(completedToday, 'ciclo hoje', 'ciclos hoje')}`;
      }
    });
}

document.addEventListener('click', () => {
  if (S.timer.startedAt !== null || S.pomodoro.startedAt !== null) activatePomodoroAudio();
});

/* ---- Eventos globais ---- */
const taskPlanDirty = () => ui.dlg.type === 'taskplan' && !ui.dlg.d.confirm && (ui.dlg.d.goal.trim() || ui.dlg.d.steps.trim());
function requireProfileSetup() {
  if (profileSetupComplete()) return true;
  openProfileSetup();
  return false;
}
document.addEventListener('click', (e) => {
  if (profileSetupComplete() || ui.dlg?.type === 'onboard') return;
  const target = e.target instanceof Element
    ? e.target.closest('button,input,select,textarea,[role="button"],[data-action]')
    : null;
  if (!target || !actionNeedsProfileSetup(target.dataset.action)) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  requireProfileSetup();
}, true);
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]'); if (!el || el.disabled) return;
  const focusBeforeAction = !ui.dlg ? describeDialogOpener(el) : null;
  if (focusBeforeAction) ui.lastFocus = focusBeforeAction;
  const onboardingAction = ui.dlg?.type === 'onboard' && Boolean(el.closest('.dlg'));
  if (actionNeedsProfileSetup(el.dataset.action, onboardingAction) && !requireProfileSetup()) { if (!ui.dlg) ui.lastFocus = null; e.preventDefault(); return; }
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
  if (!profileSetupComplete() && ui.dlg?.type !== 'onboard') {
    e.preventDefault();
    e.stopImmediatePropagation();
    requireProfileSetup();
    return;
  }
  const f = e.target.closest('[data-form]'); if (!f) return;
  e.preventDefault();
  const fn = FORMS[f.dataset.form]; if (fn) fn(f, new FormData(f));
});
document.addEventListener('input', (e) => {
  const el = e.target;
  if (!profileSetupComplete() && ui.dlg?.type !== 'onboard') {
    e.stopImmediatePropagation();
    requireProfileSetup();
    return;
  }
  const changeKey = el.dataset && el.dataset.change;
  if (SETTINGS_INPUT_CHANGES.has(changeKey) && CHANGES[changeKey]) CHANGES[changeKey](el);
  if (ui.dlg && ui.dlg.type !== 'search' && el instanceof Element && el.closest('#dlg') && el.matches('input:not([type="file"]),textarea,select')) ui.dlg.dirty = true;
  if (el.dataset.profileField && ['name', 'sex', 'age', 'weightKg'].includes(el.dataset.profileField)) {
    const draft = {
      name: $('#pname')?.value || '',
      sex: $('#psex')?.value || '',
      age: $('#pa')?.value || '',
      weightKg: $('#pk')?.value || '',
    };
    ui.profileDraft = profileDraftHasChanges(draft, S.settings.profile) ? draft : null;
    const saveButton = $('#profile-settings-form [type="submit"]');
    if (saveButton) saveButton.disabled = !ui.profileDraft;
    const previewName = $('#profile-preview-name');
    if (previewName) previewName.textContent = draft.name.trim() || 'seu nome';
  }
  if (el.dataset.dlg && ui.dlg) {
    setPath(ui.dlg.d, el.dataset.dlg, el.type === 'checkbox' ? el.checked : el.value);
    if (ui.dlg.type === 'search' && el.dataset.dlg === 'query') {
      const results = $('#global-search-results');
      if (results) results.innerHTML = globalSearchResults(el.value).s;
    } else if (ui.dlg.type === 'cycle-log' && el.dataset.dlg === 'log.sexualActivity') {
      if (!el.checked) ui.dlg.d.log.contraceptionMethods = [];
      render();
    } else if (['sex', 'accountId', 'repeat', 'type', 'tag', 'category', 'time', 'invert'].includes(el.dataset.dlg) || el.dataset.dlg.startsWith('rows.')) {
      if (ui.dlg.type === 'impfin' && (el.dataset.dlg === 'accountId' || el.dataset.dlg === 'invert')) impRecalc(ui.dlg.d, el.dataset.dlg === 'invert');
      render();
    }
  }
  if (el.dataset.input === 'fin-search') { ui.finQ = el.value; const r = $('#tx-results'); if (r) r.innerHTML = txListHtml().s; }
  if (el.dataset.input === 'search') { ui.filters.q = el.value; const r = $('#task-results'); if (r) r.innerHTML = taskListHtml().s; }
});
document.addEventListener('change', (e) => {
  const el = e.target, key = el.dataset && el.dataset.change;
  if (!profileSetupComplete() && ui.dlg?.type !== 'onboard') {
    e.preventDefault();
    e.stopImmediatePropagation();
    requireProfileSetup();
    return;
  }
  if (ui.dlg && ui.dlg.type !== 'search' && el instanceof Element && el.closest('#dlg') && el.matches('input:not([type="file"]),textarea,select')) ui.dlg.dirty = true;
  if (el.dataset && el.dataset.dlg === 'bank' && ui.dlg) setPath(ui.dlg.d, 'bank', el.value);
  const fn = key && !SETTINGS_INPUT_CHANGES.has(key) && CHANGES[key]; if (fn) fn(el);
});
document.addEventListener('beforeinput', (e) => {
  if (profileSetupComplete() || ui.dlg?.type === 'onboard') return;
  e.preventDefault();
  e.stopImmediatePropagation();
  requireProfileSetup();
}, true);
document.addEventListener('toggle', (e) => { const el = e.target; if (el.tagName === 'DETAILS' && el.id) { ui.openDetails[el.id.replace('d-', '')] = el.open; if (el.open) el.querySelectorAll('.habit-year-grid').forEach((grid) => { grid.scrollLeft = grid.scrollWidth; }); } }, true);
document.addEventListener('keydown', (e) => {
  if (ui.dlg?.type === 'onboard' && e.key === 'Escape') { e.preventDefault(); return; }
  if (!profileSetupComplete() && ui.dlg?.type !== 'onboard') {
    const control = e.target instanceof Element
      ? e.target.closest('button,input,select,textarea,[role="button"],[data-action]')
      : null;
    const shortcut = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k'
      || e.key.toLowerCase() === 'n' && !e.ctrlKey && !e.metaKey && !e.altKey;
    if (control && !['Tab', 'Shift', 'Control', 'Alt', 'Meta'].includes(e.key) || shortcut) {
      e.preventDefault();
      e.stopImmediatePropagation();
      requireProfileSetup();
      return;
    }
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    if (ui.dlg?.type === 'onboard') return;
    e.preventDefault();
    dlgOpen('search', { query: '' });
    return;
  }
  // Atalho "N": criação rápida, só fora de campos de texto e sem outro diálogo aberto.
  if (e.key.toLowerCase() === 'n' && !e.ctrlKey && !e.metaKey && !e.altKey && !ui.dlg && !e.target.closest?.('input, textarea, select, [contenteditable="true"]')) {
    e.preventDefault();
    ACTIONS['quick-create-open']();
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
      <span class="grow"><span class="ttl ${t.type === 'out' ? 'expense-name' : ''}">${title}</span><span class="meta2">${showDate ? h`<span class="tx-date">${t.date === today() ? 'Hoje' : shortDate(t.date)}</span> · ` : ''}${sub}${!paid ? h` · <span class="m-warn">${t.type === 'in' ? 'A receber' : 'A pagar'}${t.date < today() ? ' · atrasado' : ''}</span>` : ''}</span></span>
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
    <div class="stats3"><div><b>${money(avg)}</b><span>gasto médio por dia até ${day}</span></div>${proj !== null ? h`<div><b>${money(proj)}</b><span>projeção com base nos dias decorridos</span></div>` : h`<div><b>${money(out)}</b><span>despesas até o fim do mês</span></div>`}<div><b class="${delta !== null && delta > 0 ? 'err' : ''}">${delta === null ? '—' : (delta > 0 ? '+' : '') + delta + '%'}</b><span>vs. mesmo período anterior</span></div></div>
    <p class="small muted">${rate !== null ? (rate >= 0 ? `Você está guardando ${rate}% da receita deste mês.` : `As despesas passaram a receita em ${Math.abs(rate)}%.`) : 'Sem receitas registradas neste mês.'}${top ? h` Maior gasto: <span class="expense-name">${expenseTitle(top[0])}</span> (${money(top[1])}).` : ''}</p></section>`;
}
function balanceSparkline() {
  const days = Array.from({ length: 7 }, (_, index) => addDays(today(), index - 6));
  const current = netBalance();
  const signedOn = (transaction) => transaction.type === 'in' ? transaction.cents : transaction.type === 'out' ? -transaction.cents : 0;
  const values = days.map((day) => current - S.finance.tx.filter((transaction) => transaction.date > day).reduce((total, transaction) => total + signedOn(transaction), 0));
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
  const pend = st.tx.filter((t) => !isPaid(t)).sort((a, b) => a.date.localeCompare(b.date));
  const cats = byCategory(st.tx, 'out'), totOut = st.outAll;
  const cards = F.accounts.filter(isCredit);
  const recents = [...F.tx].sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 5);
  const bud = Object.entries(F.budgets).filter(([, b]) => b && b.cents > 0), budSpent = bud.reduce((s, [c]) => s + (cats.find(([n]) => n === c)?.[1] || 0), 0), budTot = bud.reduce((s, [, b]) => s + b.cents, 0);
  return h`${monthNav()}
    <section class="fin-hero" aria-label="Resumo financeiro"><div class="fin-hero-top"><div><p class="fh-l">DISPONÍVEL AGORA</p><p class="fh-v ${bal < 0 ? 'neg' : ''}">${money(bal)}</p></div><div class="fin-hero-actions"><button class="btn sm" data-action="tx-new-in">${icon('plus', 16)}Receita</button><button class="btn sm primary" data-action="tx-new">${icon('plus', 16)}Despesa</button></div></div>${balanceSparkline()}
      <p class="fh-s">${cur ? h`Projeção das contas até o fim do mês: <b>${money(forecast)}</b>` : h`${cap(ymLabel(ym))}`}</p>
      <div class="fh-row"><div><span>Receitas lançadas</span><b>${money(st.inAll)}</b><small>${money(st.inPaid)} recebidas</small></div><div><span>Despesas lançadas</span><b>${money(st.outAll)}</b><small>${money(st.outPaid)} pagas · ${money(st.outPending)} pendentes · ${money(st.cardOut)} no cartão</small></div><div><span>Resultado</span><b>${money(st.inAll - st.outAll)}</b><small>no mês</small></div></div></section>
    ${finRitmo(ym, st, cur)}
    <div class="fin-overview-grid"><div class="fin-overview-primary">${pend.length ? h`<section class="card finance-attention"><div class="head"><div><p class="section-kicker">PRÓXIMOS COMPROMISSOS</p><h2>A pagar e a receber<i>.</i></h2></div><button class="btn ghost sm" data-action="fin-go" data-t="lancamentos" data-f="pendentes">Ver todos</button></div><ul class="list">${pend.slice(0, 5).map(finRow)}</ul></section>` : ''}
      <section class="card"><div class="head"><div><p class="section-kicker">COMPOSIÇÃO DO MÊS</p><h2>Despesas por categoria<i>.</i></h2></div><button class="btn ghost sm" data-action="fin-go" data-t="relatorios">Relatórios</button></div>
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
  return h`<section class="card finance-fixas" aria-labelledby="fin-fixas-title"><div class="head"><div><p class="section-kicker">TODO MÊS</p><h2 id="fin-fixas-title">Lançamentos fixos<i>.</i></h2><p class="small muted">${rs.length} ${plural(rs.length, 'fixa ativa', 'fixas ativas')}: ${money(out)} em despesas${inc ? h` e ${money(inc)} em receitas` : ''} por mês.</p></div><button class="btn ghost sm" data-action="rec-list">${icon('repeat', 16)}Gerenciar</button></div></section>`;
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
      <div class="row" style="justify-content:space-between"><button class="btn ghost sm" data-action="fin-csv">${icon('download', 16)}Exportar CSV</button></div>
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
    ${accs.length ? h`<ul class="cards">${accs.map((a) => { const balance = accBalance(a), bankName = a.bank === OTHER_BANK ? 'outro banco / não listado' : Object.hasOwn(BANKS, a.bank) ? BANKS[a.bank].name : a.bank, name = accountDisplayName(a); return h`<li><button class="acc" data-action="acct-edit" data-id="${a.id}" aria-label="Editar conta ${name}${bankName ? ', ' + bankName : ''}, ${balance < 0 ? 'saldo negativo de ' + brl(Math.abs(balance)) : 'saldo ' + brl(balance)}">${accountChip(a)}<span class="grow"><span class="ttl">${name}</span><span class="small muted">${ACCOUNT_TYPES[a.type] || a.type}${bankName ? h` · <span class="user-value">${bankName}</span>` : ''}</span></span><b class="${balance < 0 ? 'neg' : ''}">${money(balance)}</b></button></li>`; })}</ul>` : h`<div class="card">${empty('Nenhuma conta ainda', 'Cadastre uma conta, a carteira ou a poupança. O aurora não se conecta a bancos: tudo é digitado por você.', h`<button class="btn primary" data-action="acct-new">Criar conta</button>`, 'wallet')}</div>`}
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
  const ym = ui.finMonth, kind = ui.repKind, st = monthStats(ym), list = byCategory(st.tx, kind), total = list.reduce((s, [, v]) => s + v, 0);
  const col = (n) => kind === 'out' ? outMeta(n).c : catMeta({ type: 'in', category: n }).c;
  const months = Array.from({ length: 6 }, (_, i) => { const m = shiftMonth(ym, i - 5), s = monthStats(m); return { l: MESES[Number(m.slice(5)) - 1], i: s.inAll, o: s.outAll }; });
  const avgOut = Math.round(months.reduce((s, m) => s + m.o, 0) / 6);
  return h`${monthNav()}
    <section class="card"><div class="seg" role="group" aria-label="Tipo"><button type="button" aria-pressed="${kind === 'out'}" data-action="rep-kind" data-k="out">Despesas</button><button type="button" aria-pressed="${kind === 'in'}" data-action="rep-kind" data-k="in">Receitas</button></div>
      ${list.length ? h`<div class="donut-row"><div class="donut-w">${donut(list.map(([n, v]) => ({ v, c: col(n) })), total, (kind === 'out' ? 'Despesas' : 'Receitas') + ' do mês por categoria')}<div class="dc"><b>${money(total)}</b><span>${kind === 'out' ? 'gastos' : 'recebidos'}</span></div></div></div>
        <ul class="list">${list.map(([n, v]) => h`<li><span class="sw" style="background:${col(n)}"></span><span class="grow ttl ${kind === 'out' ? 'expense-name' : ''}">${kind === 'out' ? expenseTitle(n) : n}</span><span class="small muted">${Math.round(v / total * 100)}%</span><b>${money(v)}</b></li>`)}</ul>` : empty(kind === 'out' ? 'Sem despesas neste mês' : 'Sem receitas neste mês', 'Registre lançamentos para ver o relatório.', h`<button class="btn" data-action="tx-new">${icon('plus', 16)}Registrar lançamento</button>`, kind === 'out' ? 'pie' : 'wallet')}</section>
    ${finCompare()}
    <section class="card"><h2>Últimos 6 meses<i>.</i></h2>${flowChart(months)}<p class="fine"><span class="lg" style="background:var(--ok)"></span>receitas <span class="lg" style="background:var(--bad)"></span>despesas</p><p class="small muted">Média de despesas: <b>${money(avgOut)}</b> por mês.</p></section>`;
}

function viewFinancas() {
  const g = gate('finances', 'Finanças'); if (g) return h`${areaNav('financas')}${pageTitle('Finanças')}${g}`;
  const panel = { resumo: finResumo, lancamentos: finLanc, contas: finContas, orcamento: finOrc, relatorios: finRel }[ui.finTab] || finResumo;
  const noAcc = !S.finance.accounts.length;
  const createAction = noAcc ? '' : h`<button class="btn primary finance-page-action" data-action="tx-new">${icon('plus', 18)}Novo lançamento</button>`;
  return h`${areaNav('financas')}${pageTitle('Finanças', createAction)}
    ${noAcc ? h`<div class="fin-section-content"><section class="card guided-empty finance-guided-empty"><span class="guided-empty-mark">${icon('wallet', 24)}</span><div class="guided-empty-copy"><span>PRIMEIRO PASSO</span><h2>Comece por uma conta<i>.</i></h2><p>Cadastre a conta, carteira ou poupança onde seu dinheiro fica. Depois, receitas e despesas passam a aparecer no seu resumo.</p></div><ol class="guided-empty-steps"><li class="is-current"><b>1</b><span>Cadastre uma conta</span></li><li><b>2</b><span>Registre um lançamento</span></li><li><b>3</b><span>Acompanhe seu mês</span></li></ol><button class="btn primary" data-action="acct-new">${icon('plus', 18)}Criar primeira conta</button></section>${financeAccountTypeSettings()}</div>` : h`<div class="fin-section-content">${finSectionPicker()}${panel()}</div>${fab()}<div class="fab-clearance" aria-hidden="true"></div>`}`;
}

/* ========== Diálogos de Finanças ========== */
const moneyIn = (c) => (c ? (c / 100).toFixed(2).replace('.', ',') : '');
function newTxDlg(kind = 'out') {
  const accs = S.finance.accounts, first = accs.find((a) => !isCredit(a)) || accs[0];
  dlgOpen('tx', { kind, amount: '', desc: '', category: kind === 'in' ? catNames('in')[0] : catNames('out')[0], accountId: first ? first.id : '', toAccountId: (accs.find((a) => a.id !== (first || {}).id) || {}).id || '', date: today(), paid: true, repeat: 'none', times: '2' });
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
    <p class="small muted">Para retirar, informe um valor negativo.</p>
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
  'tx-new': () => newTxDlg('out'),
  'tx-new-in': () => newTxDlg('in'),
  'tx-kind': (el) => { const d = ui.dlg.d, k = el.dataset.k; if (d.kind === k) return; d.kind = k; d.category = k === 'in' ? catNames('in')[0] : catNames('out')[0]; if (k === 'tr' && (!d.toAccountId || d.toAccountId === d.accountId)) d.toAccountId = (S.finance.accounts.find((a) => a.id !== d.accountId) || {}).id || ''; render(); },
  'edit-tx': (el) => { const t = S.finance.tx.find((x) => x.id === el.dataset.id); if (t) dlgOpen('tx', { id: t.id, kind: t.type, amount: moneyIn(t.cents), desc: t.desc || '', category: t.category || catNames('out')[0], accountId: t.accountId, toAccountId: t.toAccountId || '', date: t.date, paid: isPaid(t), repeat: 'none', times: '2', recId: t.recId || '' }); },
  'tx-paid': (el) => { const t = S.finance.tx.find((x) => x.id === el.dataset.id); if (!t) return; t.paid = !isPaid(t); commit('finance'); if (t.paid) completionFeedback(`.fr[data-k="${t.id}"]`); toast(t.paid ? (t.type === 'in' ? 'Marcado como recebido.' : 'Marcado como pago.') : 'Voltou para pendente.', () => { t.paid = !t.paid; commit('finance'); }); },
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
    if (!tr && !isCredit(acc) && d.date > today() && d.paid) return toast('Para um lançamento futuro, desmarque a opção de pagamento realizado.');
    if (!d.id && d.repeat === 'parcel' && (!Number.isInteger(Number(d.times)) || Number(d.times) < 2 || Number(d.times) > 60)) return toast('Informe entre 2 e 60 parcelas.');
    const base = { type: d.kind, accountId: d.accountId, category: tr ? 'Transferência' : d.category, desc: d.desc.trim().slice(0, 80) };
    if (tr) base.toAccountId = d.toAccountId;
    const paid = tr || isCredit(acc) ? true : !!d.paid;
    if (d.id) { const t = S.finance.tx.find((x) => x.id === d.id); if (!t) return dlgClose(); Object.assign(t, base, { cents, date: d.date, paid }); if (!tr) delete t.toAccountId; ui.finMonth = d.date.slice(0, 7); ui.dlg = null; commit('finance'); return toast('Lançamento atualizado.'); }
    if (d.repeat === 'fixed' && !tr) {
      const r = { id: newId(), type: d.kind, accountId: d.accountId, category: base.category, desc: base.desc, cents, day: pk(d.date).getDate(), startYM: d.date.slice(0, 7), lastYM: null, firstPaid: paid };
      recList().push(r); genRecurring(); ui.finMonth = d.date.slice(0, 7); ui.dlg = null; commit('finance'); toast('Fixa criada. Os próximos meses aparecem sozinhos.'); return;
    }
    const n = d.repeat === 'none' || tr ? 1 : clamp(Math.round(num(d.times)) || 2, 2, 60), gid = n > 1 ? newId() : undefined;
    for (let i = 0; i < n; i++) {
      const part = d.repeat === 'parcel' ? Math.floor(cents / n) + (i === 0 ? cents - Math.floor(cents / n) * n : 0) : cents;
      S.finance.tx.push({ id: newId(), ...base, cents: part, date: addMonths(d.date, i), paid: isCredit(acc) ? true : i === 0 ? paid : false, createdAt: Date.now() + i, ...(n > 1 ? { groupId: gid, desc: `${base.desc || base.category} (${i + 1}/${n})` } : {}) });
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
  const rows = filteredTx(), head = ['Data', 'Tipo', 'Descrição', 'Categoria', 'Conta', 'Valor', 'Situação'];
  const lines = rows.map((t) => [t.date, { in: 'Receita', out: 'Despesa', tr: 'Transferência' }[t.type], t.desc || '', t.category || '', accName(t.accountId), (t.type === 'out' ? -t.cents : t.cents) / 100, isPaid(t) ? 'Pago' : 'Pendente'].map(csvCell).join(';'));
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
        F.tx.push({ id: newId(), type: r.type, accountId: r.accountId, category: r.category, desc: r.desc, cents: r.cents, date, paid: isCredit(acc) ? true : (ym === r.startYM && r.firstPaid !== undefined ? r.firstPaid : false), createdAt: Date.now() + g, recId: r.id });
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
const normDate = (y, m, d) => { const dt = new Date(Number(y), Number(m) - 1, Number(d)); return dt.getFullYear() === Number(y) && dt.getMonth() === Number(m) - 1 && dt.getDate() === Number(d) ? `${y}-${pad(Number(m))}-${pad(Number(d))}` : null; };
function parseDateAny(s) {
  s = String(s || '').trim(); let m;
  if ((m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)) || (m = /^(\d{4})(\d{2})(\d{2})/.exec(s))) return normDate(m[1], m[2], m[3]);
  if ((m = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4}|\d{2})\b/.exec(s))) return normDate(m[3].length === 2 ? '20' + m[3] : m[3], m[2], m[1]);
  return null;
}
function csvRows(text) {
  const first = text.split(/\r?\n/).find((l) => l.trim()) || '', cnt = (c) => (first.match(new RegExp('\\' + c, 'g')) || []).length;
  const delim = [';', '\t', ','].sort((a, b) => cnt(b) - cnt(a))[0], rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true; else if (c === delim) { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.some((x) => x.trim())) rows.push(row); row = []; }
    else cur += c;
  }
  row.push(cur); if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}
const moneyAny = (s) => { let t = String(s || '').trim(); if (!t) return NaN; const neg = /^\(.*\)$/.test(t) || /-\s*$/.test(t) || /^-/.test(t) || /\bD\b$/i.test(t); t = t.replace(/[^\d,.]/g, ''); if (!t) return NaN; const v = parseMoney(t); return Number.isNaN(v) ? NaN : neg ? -Math.abs(v) : v; };
function parseStatement(text, name) {
  const out = [];
  if (/<STMTTRN>/i.test(text) || /\.ofx$/i.test(name || '')) {
    text.split(/<STMTTRN>/i).slice(1).forEach((blk) => {
      const g = (k) => { const m = new RegExp('<' + k + '>([^<\\r\\n]*)', 'i').exec(blk); return m ? m[1].trim() : ''; };
      const date = parseDateAny(g('DTPOSTED')), v = Number(g('TRNAMT').replace(',', '.'));
      if (date && Number.isFinite(v) && v !== 0) out.push({ date, desc: (g('MEMO') || g('NAME') || 'Lançamento').slice(0, 80), cents: Math.round(v * 100) });
    });
    return out;
  }
  const rows = csvRows(text); if (rows.length < 2) return out;
  let hi = rows.findIndex((r) => r.some((c) => /^(data|date)/i.test(c.trim())) && r.some((c) => /valor|value|amount|d[ée]bito|cr[ée]dito|quantia/i.test(c)));
  let iD, iT, iV, iDeb, iCre, start;
  if (hi >= 0) {
    const H = rows[hi].map((c) => c.trim().toLowerCase()), find = (re) => H.findIndex((c) => re.test(c));
    iD = find(/^(data|date)/); iT = find(/descri|hist|memo|estabel|lan[çc]amento|title|t[íi]tulo|nome/); iV = find(/valor|value|amount|quantia/); iDeb = find(/d[ée]bito/); iCre = find(/cr[ée]dito/); start = hi + 1;
  } else {
    const r0 = rows[0]; iD = r0.findIndex((c) => parseDateAny(c)); iV = r0.findIndex((c, i) => i !== iD && !Number.isNaN(moneyAny(c)) && /\d/.test(c)); iT = r0.findIndex((c, i) => i !== iD && i !== iV && c.trim().length > 2); start = 0;
  }
  if (iD < 0 || (iV < 0 && iDeb < 0 && iCre < 0)) return out;
  if (iT < 0) iT = rows[start] ? rows[start].findIndex((c, i) => i !== iD && i !== iV && i !== iDeb && i !== iCre) : -1;
  for (let i = start; i < rows.length && out.length < 500; i++) {
    const r = rows[i], date = parseDateAny(r[iD]); if (!date) continue;
    let v = NaN; if (iV >= 0) v = moneyAny(r[iV]); else { const dv = moneyAny(r[iDeb]), cv = moneyAny(r[iCre]); v = (Number.isNaN(cv) ? 0 : Math.abs(cv)) - (Number.isNaN(dv) ? 0 : Math.abs(dv)); }
    if (Number.isNaN(v) || v === 0) continue;
    out.push({ date, desc: String(iT >= 0 ? r[iT] : '').trim().slice(0, 80) || 'Lançamento', cents: v });
  }
  return out;
}
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
  'imp-apply': () => { const d = ui.dlg.d, ids = []; d.rows.filter((r) => r.on).forEach((r, i) => { const id = newId(); ids.push(id); S.finance.tx.push({ id, type: r.kind, accountId: d.accountId, category: r.cat, desc: r.desc, cents: r.abs, date: r.date, paid: true, createdAt: Date.now() + i }); });
    const mo = d.rows.filter((r) => r.on).map((r) => r.date).sort().pop(); if (mo) ui.finMonth = mo.slice(0, 7); ui.dlg = null; commit('finance'); toast(`${ids.length} ${plural(ids.length, 'lançamento importado', 'lançamentos importados')}.`, () => { S.finance.tx = S.finance.tx.filter((t) => !ids.includes(t.id)); commit('finance'); }); },
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
  const rows = parseStatement(text, f.name); if (!rows.length) return toast('Não encontrei lançamentos. Use CSV (data, descrição, valor) ou OFX.');
  const acc = S.finance.accounts.find((a) => !isCredit(a)) || S.finance.accounts[0], d = { file: f.name.slice(0, 40), accountId: acc.id, invert: false, rows: rows.map((r) => ({ ...r, on: true })) };
  impRecalc(d, true); dlgOpen('impfin', d); } });

/* ---- comparar meses ---- */
const monthOpts = () => Array.from({ length: 12 }, (_, i) => shiftMonth(today().slice(0, 7), -i));
function finCompare() {
  const A = ui.cmpA || ui.finMonth, B = ui.cmpB || shiftMonth(A, -1), sa = monthStats(A), sb = monthStats(B);
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
Persist.loadLocal();
purgeExpiredTrash();
if (ui.persistFailed.size) toast('Alguns dados locais não puderam ser lidos ou salvos. Recarregar pode descartar alterações; faça um backup dos dados disponíveis.');
const recurringReconciled = reconcileRecurringTransactions();
const recurringGenerated = genRecurring();
if (recurringReconciled || recurringGenerated) saveSlices('finance');
window.addEventListener('hashchange', onRoute);
onRoute();
const authResult = new URLSearchParams(location.search).get('auth');
if (authResult) {
  history.replaceState(null, '', location.pathname + location.hash);
  ui.settingsTab = 'account';
  nav('config');
  toast(authResult === 'success' ? 'Conta Google conectada. Verifique o estado da conta em Ajustes.' : 'Não foi possível concluir o login Google.');
}
requestStudiesTemplate();
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register(new URL('../../service-worker.js', import.meta.url)).catch((error) => {
    console.error('O Aurora não conseguiu iniciar o suporte offline.', error);
  });
}
if (S.pomodoro.startedAt !== null && getPomodoroPushStatus().enabled) syncPomodoroPushSchedule(S.pomodoro);
setInterval(tick, 1000);
