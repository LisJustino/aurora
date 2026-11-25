
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { filterValidRecords, isPlainObject, validateFinanceReferences } from '../src/js/core/data-integrity.js';
import { formatMoneyInput, parseMoney } from '../src/js/utils/currency.js';
import { addDays, addMonths, isDay, normalizeDay, today } from '../src/js/utils/dates.js';
import {
  accountModeFromLocation,
  accountPathForMode,
  canonicalPublicPath,
  isDemoLocation,
  isPublicLandingHash,
  isPublicLandingLocation,
  postSignOutPath,
  redirectToPublicLanding,
  resolveRoute,
  routeFromLocation,
  routePathFor,
  settingsRootPath,
} from '../src/js/core/router.js';
import {
  isValidMenuOrder,
  isValidVisibleMenuItems,
  canMoveMenuItem,
  moveMenuItem,
  normalizeMenuOrder,
  normalizeVisibleMenuItems,
} from '../src/js/features/navigation/menu.js';
import {
  accountBalanceOn,
  accountBalance,
  linkedGoalProgressCents,
  byCategory as summarizeByCategory,
  monthStats,
  monthlyCloseSummary,
  netAccountBalance,
  netAccountBalanceOn,
  projectedNetAccountBalance,
  installmentSummary,
  reportMonthStats,
  recurringBillsDueOn,
  expenseBudgetByCategory,
} from '../src/js/features/finance/calculations.js';
import {
  ACCOUNT_TYPES,
  isValidAccountType,
  normalizeAccountType,
} from '../src/js/features/finance/accounts.js';
import {
  parseStatement,
  statementDuplicateStatus,
} from '../src/js/features/finance/statement.js';
import {
  AREA_GUIDES,
  AREA_GUIDE_IDS,
  FINANCE_PRIVACY_NOTICE,
  isValidAreaTutorialsSeen,
  normalizeAreaTutorialsSeen,
} from '../src/js/features/area-guides.js';

import { APPEARANCE_PRESETS, LOOK_DEFAULT, PALETTES, darkenFor, hexOk, lum, paletteColors } from '../src/js/features/appearance/palettes.js';
import { renderPublicHeader } from '../src/js/features/appearance/public-controls.js';
import { nextDue } from '../src/js/features/planning/recurrence.js';
import { parseQuickDate } from '../src/js/features/planning/quick-date.js';
import { matchCategoryRule, normalizeCategoryRules } from '../src/js/features/finance/category-rules.js';
import { searchRecords } from '../src/js/features/search/search.js';
import { filteredTasks, todayTasks } from '../src/js/features/planning/task-selection.js';
import {
  ANNUAL_PLAN_IDEA_CATEGORIES,
  ANNUAL_PLAN_IDEAS,
  filterAnnualPlanIdeas,
  isValidAnnualPlans,
  normalizeAnnualPlans,
} from '../src/js/features/planning/annual-plan.js';
import {
  createSuggestedHabits,
  habitColor,
  habitIconKey,
  habitSuggestionTags,
  featuredHabitSuggestions,
  habitIsComplete,
  habitIsSkipped,
  filterSuggestedHabits,
  remainingHabitSuggestions,
  isWaterHabit,
  HABIT_COLORS,
  HABIT_ICON_KEYS,
  SUGGESTED_HABITS,
  SUGGESTED_HABIT_CATEGORIES,
  SUGGESTED_HABIT_TAGS,
  habitStats,
  habitDayOverview,
  habitEntryType,
  habitEntryOptions,
  habitEntryForDay,
  habitMonthStats,
  habitWeekDailyProgress,
  habitWeekReview,
  habitWeekOverview,
  habitWeeklyTarget,
  isValidHabit,
  normalizeHabits,
} from '../src/js/features/habits/model.js';
import {
  estimateWaterGoal,
  isValidWaterGoalMl,
  normalizeWaterHabit,
  parseWaterMl,
  parseWaterWeightKg,
  waterGoalFromName,
  waterGoalForHabit,
  waterGoalReached,
  waterMlForDay,
  waterWeekProgress,
} from '../src/js/features/habits/water-goal.js';
import { weightChange } from '../src/js/features/habits/weight-tracking.js';
import { filterWeightInput } from '../src/js/features/profile/weight.js';
import {
  ageFromBirthdayReference,
  createBirthdayReference,
  formatBirthday,
  isValidBirthdayReference,
} from '../src/js/features/profile/birthday.js';
import {
  normalizeProfileAppearance,
  PROFILE_APPEARANCE_DEFAULT,
  PROFILE_AVATARS,
  PROFILE_AVATAR_COLORS,
  PROFILE_GREETING_STYLES,
} from '../src/js/features/profile/model.js';
import { isProfileAvatarImageData, PROFILE_AVATAR_MAX_BYTES } from '../src/js/features/profile/avatar-image.js';
import { canAccessCycle } from '../src/js/features/cycle/access.js';
import { habitCreatedOn, habitStartedOnOrBefore, isValidHabitCreatedAt } from '../src/js/features/habits/dates.js';
import {
  defaultHomeLayout,
  HOME_AREA_COLORS,
  HOME_MESSAGE_MAX_LENGTH,
  HOME_MODES,
  normalizeHomeAreaColors,
  normalizeHomeLayout,
  normalizeHomeMessage,
  normalizeHomeMode,
  normalizeHomeModes,
  normalizeHomeShortcuts,
  defaultHomeShortcuts,
  homeFirstStepsProgress,
  homeAreaColorValue,
} from '../src/js/features/home/personalization.js';
import { weeklyReview } from '../src/js/features/planning/week.js';
import {
  isTrashExpired,
  isValidTrashEntry,
  normalizeTrash,
  sortTrashEntriesByExpiry,
  trashDaysRemaining,
  TRASH_RETENTION_MS,
} from '../src/js/features/trash/model.js';
import { isValidCycleSexualLog } from '../src/js/features/cycle/log.js';
import { cycleDayNumber, cycleStats, periodDaySet, topSymptoms } from '../src/js/features/cycle/calculations.js';
import { estimatedCyclePhase } from '../src/js/features/cycle/phases.js';
import {
  createCyclePeriod,
  cycleLogDays,
  cyclePeriodDays,
  mergeCycleLogSymptoms,
  MAX_CYCLE_LOG_RANGE_DAYS,
  MAX_CYCLE_PERIOD_DAYS,
} from '../src/js/features/cycle/period.js';
import { renderLanding } from '../src/js/features/landing/view.js';
import { renderHomeView } from '../src/js/features/home/view.js';
import { renderCycleView } from '../src/js/features/cycle/view.js';
import { renderFinanceView } from '../src/js/features/finance/view.js';
import { renderGoogleCalendarPlanPanel, renderPlanningView } from '../src/js/features/planning/view.js';
import { createToastController } from '../src/js/features/feedback/toast.js';
import {
  FEEDBACK_PROMPT_INTERVAL_MS,
  feedbackPromptNextAt,
  feedbackSuggestionHref,
  isFeedbackPromptDue,
  isValidFeedbackPromptNextAt,
  normalizeFeedbackPromptNextAt,
  renderFeedbackPrompt,
} from '../src/js/features/feedback/prompt.js';
import { IC, ICON_SIZES, icon, iconSvg } from '../src/js/utils/icons.js';
import { readAppSource } from './app-source.mjs';

// Compara HTML e código sem depender de quebras de linha e vírgulas finais
const flatHtml = (value) => String(value).replace(/\s+/g, ' ');
const flatCode = (value) => String(value).replace(/\s+/g, '').replace(/,(?=[)\]}])/g, '');
import { emptyState } from '../src/js/utils/empty-state.js';
import { h } from '../src/js/utils/dom.js';

const results = [];

const test = (name, run) => {
  try {
    run();
    results.push({ name, passed: true });
  } catch (error) {
    results.push({
      name,
      passed: false,
      message: error instanceof Error ? error.message : String(error),
    });
  }
};

test('convite de feedback respeita os cinco dias e direciona para o formulário no app', () => {
  const now = Date.UTC(2026, 0, 1);
  const nextAt = feedbackPromptNextAt(now);
  if (Date.parse(nextAt) !== now + FEEDBACK_PROMPT_INTERVAL_MS
    || isFeedbackPromptDue(nextAt, now + FEEDBACK_PROMPT_INTERVAL_MS - 1)
    || !isFeedbackPromptDue(nextAt, now + FEEDBACK_PROMPT_INTERVAL_MS)
    || isFeedbackPromptDue('data inválida', now + FEEDBACK_PROMPT_INTERVAL_MS)
    || normalizeFeedbackPromptNextAt(nextAt) !== nextAt
    || normalizeFeedbackPromptNextAt('data inválida') !== null
    || !isValidFeedbackPromptNextAt(nextAt)
    || !isValidFeedbackPromptNextAt(null)
    || isValidFeedbackPromptNextAt('data inválida')
    || feedbackSuggestionHref() !== '/ajustes/conta') {
    throw new Error('O agendamento, a validação ou o link de sugestão está incorreto.');
  }
  const prompt = renderFeedbackPrompt().s;
  if (!prompt.includes('Está gostando do Aurora?')
    || !prompt.includes('data-action="feedback-prompt-dismiss"')
    || !prompt.includes('href="/ajustes/conta"')
    || !prompt.includes('Sugerir uma melhoria')) {
    throw new Error('O convite deve oferecer avaliação, adiamento e acesso ao formulário no app.');
  }
  let invalidNowRejected = false;
  try {
    feedbackPromptNextAt(Number.NaN);
  } catch (error) {
    invalidNowRejected = error instanceof TypeError;
  }
  if (!invalidNowRejected) throw new Error('Um horário inválido deve ser rejeitado.');
});

test('estado vazio preserva semântica, ação e escape de texto', () => {
  const markup = emptyState({
    title: 'Nada <por aqui',
    description: 'Uma frase de apoio.',
    action: h`<button type="button" class="btn primary">Começar</button>`,
    headingLevel: 'h4',
    className: 'state-test',
    hidden: true,
  }).s;
  if (!markup.includes('class="empty empty-state state-test"')
    || !markup.includes('<h4 class="empty-state-title">Nada &lt;por aqui.</h4>')
    || !markup.includes('<p class="empty-state-description">Uma frase de apoio.</p>')
    || !markup.includes('<button type="button" class="btn primary">Começar</button>')
    || !markup.includes('hidden>')) {
    throw new Error('O estado vazio deve manter o heading, a ação e o texto escapado.');
  }
});

test('Ciclo não renderiza o estado vazio antes do controle de consentimento', () => {
  const html = renderCycleView({
    S: {},
    ui: {},
    gate: () => '<section>Consentimento necessário</section>',
    areaPageTitle: () => h`<header>Ciclo</header>`,
  }).s;
  if (!html.includes('Consentimento necessário') || html.includes('Seu ciclo começa no seu tempo')) {
    throw new Error('O estado inicial do Ciclo não deve aparecer antes do consentimento.');
  }
});

test('Ciclo identifica estimativas passadas e resume sinais registrados sem inferir causas', () => {
  const asOfDate = today();
  const logDay = addDays(asOfDate, -1);
  const cycleLog = { [logDay]: { pain: ['cramps'] } };
  const render = (daysSinceLastStart) => {
    const lastStart = addDays(asOfDate, -daysSinceLastStart);
    const previousStart = addDays(lastStart, -28);
    return renderCycleView({
      S: {
        cycle: [{ start: previousStart, end: previousStart }, { start: lastStart, end: lastStart }],
        cycleLog,
      },
      ui: { cycDay: '', calMonth: asOfDate.slice(0, 7), openDetails: {} },
      gate: () => null,
      areaPageTitle: () => h`<header>Ciclo</header>`,
      cycleStats,
      dayLog: (day) => cycleLog[day] || {},
      cycleDayNumber,
      hasAnyLog: (log) => Boolean(log?.flow || log?.pain?.length),
      cyclePeriodEnd: (period) => period.end || period.start,
      cycleCalendarPhase: () => '',
      topSymptoms,
      cycLabel: (_category, value) => value,
      weekStartDay: () => 1,
      clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
      plural: (count, singular, pluralForm) => count === 1 ? singular : pluralForm,
      cycleLogSummary: () => '',
      CYC_ICON: { flow: 'droplet' },
      cap: (value) => value,
      ymLabel: (value) => value,
    }).s;
  };
  const pastEstimate = render(40);
  const futureEstimate = render(10);

  if (!pastEstimate.includes('Data estimada já passou')
    || !pastEstimate.includes('A data estimada já passou.')
    || pastEstimate.includes('Próximo início estimado')
    || !futureEstimate.includes('Próximo início estimado')
    || futureEstimate.includes('Data estimada já passou')
    || pastEstimate.includes('Mais registrados nos últimos 90 dias')
    || !pastEstimate.includes('cramps')) {
    throw new Error('O Ciclo deve sinalizar datas estimadas passadas e não mostrar o resumo de registros dos últimos 90 dias.');
  }
});

test('aviso de conexão de Finanças aparece apenas na visão geral e no acesso bloqueado', () => {
  const options = {
    S: { finance: { accounts: [], tx: [] } },
    ui: { finTab: 'resumo', financeValuesHidden: false },
    gate: () => null,
    areaPageTitle: () => h`<header>Finanças</header>`,
    financePrivacyNotice: () => h`<aside class="finance-privacy-note">Privacidade</aside>`,
    finSectionPicker: () => h`<nav>Seções</nav>`,
    panels: { resumo: () => h`<section>Resumo</section>`, cartoes: () => h`<section>Cartões</section>` },
  };
  const overview = renderFinanceView(options).s;
  const cards = renderFinanceView({ ...options, ui: { ...options.ui, finTab: 'cartoes' } }).s;
  const locked = renderFinanceView({
    ...options,
    gate: () => h`<section>Acesso necessário</section>`,
  }).s;
  if ((overview.match(/finance-privacy-note/g) || []).length !== 1
    || overview.includes('finance-week-chart') || overview.includes('Despesas desta semana')
    || !overview.includes('<header>Finanças</header>') || !overview.includes('fin-section-content')
    || cards.includes('finance-privacy-note')
    || (locked.match(/finance-privacy-note/g) || []).length !== 1
    || !locked.includes('Acesso necessário')) {
    throw new Error('O aviso deve aparecer na visão geral e no acesso bloqueado, sem repetição nas outras seções.');
  }
});

test('Movimentações financeiras oferece apenas a lista de lançamentos', () => {
  const source = readAppSource();
  if (
    source.includes('data-action="fin-view"') ||
    source.includes('data-action="fin-day"') ||
    source.includes('data-action="tx-new-day"') ||
    source.includes('export function finCal()')
  ) {
    throw new Error('Movimentações financeiras não deve oferecer a antiga visão de calendário.');
  }
});

test('Planejar mantém Calendário acessível junto às outras visualizações', () => {
  const html = renderPlanningView({
    S: { settings: { prefs: { annualPlans: {} } } },
    ui: { planView: 'revisao', filters: { f: 'todas', q: '', sort: 'prazo' } },
    filterOptions: [],
    allTags: () => [],
    areaPageTitle: (_route, _title, action) => h`<header>${action}</header>`,
    plural: (count, singular, pluralForm) => count === 1 ? singular : pluralForm,
    today: () => '2026-11-18',
    taskCalendar: () => '<section>Calendário de tarefas e eventos</section>',
    taskWeek: () => '<section>Semana</section>',
    weeklyReviewView: () => '<section>Revisão semanal</section>',
    taskListHtml: () => '<ul></ul>',
  }).s;
  const expectedViews = ['lista', 'calendario', 'revisao', 'anual'];
  const taskTabIndex = html.indexOf('id="plan-tab-lista"');
  const annualTabIndex = html.indexOf('id="plan-tab-anual"');
  const calendarTabIndex = html.indexOf('id="plan-tab-calendario"');
  if (!expectedViews.every((view) => html.includes(`id="plan-tab-${view}"`))
    || html.includes('id="plan-tab-semana"')
    || !(taskTabIndex < annualTabIndex && annualTabIndex < calendarTabIndex)
    || !html.includes('aria-labelledby="plan-tab-revisao"')
    || !html.includes('Revisão semanal')
    || !html.includes('data-action="task-new"')
    || html.includes('plan-tool-review')
    || html.includes('>Ver tarefas</button>')) {
    throw new Error('Todas as visualizações, incluindo o Calendário, devem estar acessíveis no mesmo seletor.');
  }
  const calendarsPanel = renderGoogleCalendarPlanPanel([
    { selectedIds: ['primary', 'work'] },
    { selectedIds: ['primary'] },
  ]).s;
  if (!calendarsPanel.includes('3 calendários selecionados em 2 contas')
    || !calendarsPanel.includes('Selecione um dia para ver os eventos junto às tarefas.')) {
    throw new Error('O Calendário deve indicar os calendários conectados e como ver os eventos.');
  }
});

test('Início aplica visibilidade e ordem dos blocos sem duplicar a ação principal', () => {
  let emptyArgs;
  const defaultBlockOrder = defaultHomeLayout().order;
  const model = {
    name: '',
    profileAppearance: {},
    greeting: 'Bom dia',
    dateLabel: 'Hoje',
    daySummary: {
      tasks: { done: 2, total: 3 },
      habits: { done: 1, total: 2, remaining: 1 },
      water: { total: 750, goal: 2000, percent: 38 },
      cycle: null,
    },
    weekProgress: { completed: 3, pending: 2 },
    homeMessage: '',
    lead: '',
    tt: [],
    sundayReview: false,
    optionalAreas: '',
    overdue: [],
    dueToday: [],
    completed: [],
    nextTask: null,
    inbox: [],
    homeShortcuts: [],
    emptyWorkspace: true,
    openCompleted: false,
    financeAccountsCount: 0,
    showHomeBlock: () => true,
    homeBlockStyle: (id) => `style="order:${defaultBlockOrder.indexOf(id)}"`,
  };
  const renderers = {
    areaGuideButton: () => '',
    backupReminder: () => '',
    empty: (...args) => {
      emptyArgs = args;
      return 'EMPTY-STATE';
    },
    homeFirstSteps: () => '',
    homeHabitCheckins: () => 'HABITS',
    homeInboxReminder: () => '',
    homeUpcomingTasks: () => 'UPCOMING',
    profileAvatarMarkup: () => '',
    sampleBanner: () => '',
    taskRow: () => '',
  };
  const html = flatHtml(renderHomeView(model, renderers).s);
  const quickIndex = html.indexOf('class="card surface-open home-quick-card"');
  const todayIndex = html.indexOf('class="home-today-card"');
  const habitsIndex = html.indexOf('HABITS');
  const summaryIndex = html.indexOf('class="home-day-summary card"');
  if (html.includes('Mais do Início') || html.includes('class="home-extras"')) {
    throw new Error('A Home não deve exibir a seção Mais do Início.');
  }
  if (quickIndex < 0 || todayIndex < 0 || habitsIndex < 0 || summaryIndex < 0
    || ![
      ['home-today-block', 'today'],
      ['home-habits-block', 'habits'],
      ['home-day-summary card', 'summary'],
      ['card surface-open home-quick-card', 'quick'],
    ].every(([className, id]) => html.includes(`class="${className}" style="order:${defaultBlockOrder.indexOf(id)}"`))) {
    throw new Error('A Home deve aplicar a ordem configurada aos blocos.');
  }
  if (!html.includes('aria-label="Tarefas, 2 de 3 feitas"')
    || !html.includes('aria-label="Hábitos, 1 de 2 feitos, 1 faltando"')
    || !html.includes('aria-label="Água, 750 de 2.000 mililitros"')
    || !html.includes('home-day-chip-count" aria-hidden="true">38%')
    || !html.includes('aria-valuetext="3 de 5 tarefas concluídas"')
    || !html.includes('name="kind"')
    || !html.includes('value="appointment">Compromisso')
    || !html.includes('name="priority"')
    || !html.includes('UPCOMING')
    || html.includes('href="/ciclo"')) {
    throw new Error('A Home deve apresentar dados acessíveis, captura configurável e ocultar Ciclo sem consentimento.');
  }
  for (const [id, selector] of [
    ['summary', 'home-day-summary'],
    ['quick', 'home-quick-card'],
    ['today', 'home-today-block'],
    ['habits', 'home-habits-block'],
  ]) {
    const hiddenBlockHtml = renderHomeView({
      ...model,
      showHomeBlock: (blockId) => blockId !== id,
    }, renderers).s;
    if (hiddenBlockHtml.includes(selector)) {
      throw new Error(`O bloco ${id} deve desaparecer quando desativado.`);
    }
    if (id === 'today' && (hiddenBlockHtml.includes('UPCOMING') || hiddenBlockHtml.includes('home-week-progress'))) {
      throw new Error('Ocultar Hoje também deve ocultar os próximos compromissos e o progresso semanal.');
    }
  }
  const cycleHtml = flatHtml(renderHomeView({
    ...model,
    daySummary: { ...model.daySummary, cycle: { day: 12 } },
  }, renderers).s);
  if (!cycleHtml.includes('href="/ciclo" aria-label="Ciclo, dia 12 do ciclo"')
    || !cycleHtml.includes('home-day-chip-count" aria-hidden="true">12')) {
    throw new Error('A faixa deve exibir o dia de Ciclo recebido do modelo.');
  }
  const upcomingHtml = renderHomeView({
    ...model,
    financeUpcoming: { count: 2, cents: 35000, overdue: 1, days: 14, hidden: false },
  }, renderers).s;
  const hiddenUpcomingHtml = renderHomeView({
    ...model,
    financeUpcoming: { count: 1, cents: 12000, overdue: 0, days: 14, hidden: true },
  }, renderers).s;
  if (!upcomingHtml.includes('class="home-day-upcoming has-overdue" href="/financas"')
    || !upcomingHtml.includes('2 compromissos')
    || !upcomingHtml.includes('1 em atraso')
    || html.includes('home-day-upcoming')
    || !hiddenUpcomingHtml.includes('••••')
    || !hiddenUpcomingHtml.includes('valor oculto')
    || /R\$\s?120,00/.test(hiddenUpcomingHtml)) {
    throw new Error('A Início deve resumir vencimentos de Finanças, destacar atrasos e respeitar a ocultação de valores.');
  }
  const noWaterHtml = renderHomeView({
    ...model,
    daySummary: { ...model.daySummary, water: null },
  }, renderers).s;
  if (noWaterHtml.includes('href="/agua"') || noWaterHtml.includes('home-day-chip--water')) {
    throw new Error('A faixa deve ocultar Água quando o hábito de água não está ativo.');
  }
  const noHabitsHtml = renderHomeView({
    ...model,
    daySummary: { ...model.daySummary, habits: null, water: null },
  }, renderers).s;
  if (noHabitsHtml.includes('href="/habitos"') || noHabitsHtml.includes('home-day-chip--habits')) {
    throw new Error('A faixa deve ocultar Hábitos quando a área está desativada.');
  }
  const noWeekTasksHtml = renderHomeView({
    ...model,
    weekProgress: { completed: 0, pending: 0 },
  }, renderers).s;
  if (!noWeekTasksHtml.includes('Sua semana ainda está em aberto.')
    || noWeekTasksHtml.includes('home-week-progress-track')) {
    throw new Error('O progresso semanal sem registros deve mostrar uma orientação, sem percentuais artificiais.');
  }
  const hiddenBalanceHtml = renderHomeView({
    ...model,
    daySummary: { ...model.daySummary, balance: { cents: 12345, hidden: true } },
  }, renderers).s;
  if (!hiddenBalanceHtml.includes('Saldo atual nas contas oculto')
    || hiddenBalanceHtml.includes('R$ 123,45')) {
    throw new Error('O saldo financeiro deve respeitar a preferência de ocultação.');
  }
  const visibleBalanceHtml = renderHomeView({
    ...model,
    daySummary: { ...model.daySummary, balance: { cents: 12345, hidden: false } },
  }, renderers).s;
  if (!/Saldo atual nas contas: R\$[^0-9]*123,45/.test(visibleBalanceHtml)) {
    throw new Error('O resumo financeiro deve apresentar o saldo real quando estiver visível.');
  }
  if (emptyArgs?.[0] !== 'Seu Início começa aqui'
    || emptyArgs[2] !== ''
    || !html.includes('home-quick-form')) {
    throw new Error('O estado sem tarefas, hábitos e contas deve apontar para a captura rápida sem uma segunda ação.');
  }
});

test('seleção de tarefas preserva filtros, ordenação e dados originais', () => {
  const tasks = [
    { title: 'Revisão', done: false, dueDate: '2026-11-09', time: '10:00', priority: 'normal', tags: ['Trabalho'], createdAt: 1 },
    { title: 'Próxima', done: false, dueDate: '2026-11-17', priority: 'high', createdAt: 2 },
    { title: 'Sem data', done: false, dueDate: '', priority: 'low', notes: 'Reunião', createdAt: 3 },
    { title: 'Feita', done: true, dueDate: '2026-11-09', doneAt: '2026-11-10T12:00:00', priority: 'normal', createdAt: 4 },
    { title: 'Antiga', done: true, dueDate: '2026-11-09', doneAt: '2026-11-08T12:00:00', priority: 'normal', createdAt: 5 },
  ];
  const deps = { normalize: (value) => String(value).toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, ''), orderOf: (task) => task.order ?? task.createdAt ?? 0 };
  const select = (f, q = '', sort = 'prazo') => filteredTasks(tasks, { f, q, sort }, '2026-11-10', deps).map((task) => task.title).join(',');
  if (select('atrasadas') !== 'Revisão' || select('proximas') !== 'Próxima'
    || select('caixa') !== 'Sem data' || select('etq:Trabalho') !== 'Revisão'
    || select('todas', 'reuniao') !== 'Sem data'
    || select('todas', '', 'prazo') !== 'Revisão,Próxima,Sem data,Feita'
    || select('concluidas', '', 'recentes') !== 'Feita'
    || select('pendentes', '', 'prioridade') !== 'Próxima,Revisão,Sem data') {
    throw new Error('Filtros ou ordenação de tarefas foram alterados.');
  }
  if (todayTasks(tasks, '2026-11-10').map((task) => task.title).join(',') !== 'Revisão,Feita'
    || tasks[0].title !== 'Revisão') throw new Error('Seleção do dia ou ordem original incorreta.');
});

test('planos anuais validam formato, limites e preservam campos desconhecidos', () => {
  const plans = {
    2027: {
      intention: 'Abrir espaço para o que importa.',
      customField: 'preservado',
      goals: [{ id: 'goal-1', title: 'Viajar', action: 'Pesquisar destinos', quarter: 'q2', done: false, taskId: 'task-123', customField: true }],
    },
  };
  if (!isValidAnnualPlans(plans)
    || isValidAnnualPlans({ ...plans, 2028: { intention: '', goals: [{ ...plans[2027].goals[0], done: 'sim' }] } })
    || isValidAnnualPlans({ ...plans, 2027: { ...plans[2027], goals: [{ ...plans[2027].goals[0], id: '' }] } })
    || isValidAnnualPlans({ ...plans, 2027: { ...plans[2027], intention: 'a'.repeat(301) } })
    || isValidAnnualPlans({ ...plans, 2027: { ...plans[2027], goals: [{ ...plans[2027].goals[0], quarter: 'q5' }] } })
    || isValidAnnualPlans({ invalid: plans[2027] })) throw new Error('O formato do plano anual aceitou registros inválidos.');
  const normalized = normalizeAnnualPlans(plans);
  if (normalized[2027].customField !== 'preservado'
    || normalized[2027].goals[0].customField !== true
    || normalized[2027].goals[0].taskId !== 'task-123'
    || normalizeAnnualPlans({ invalid: plans[2027] })[2027] !== undefined) {
    throw new Error('A normalização não preservou os campos futuros ou aceitou o ano inválido.');
  }
});

test('catálogo do Plano anual tem ideias por categoria e busca sem acentos', () => {
  const ids = new Set(ANNUAL_PLAN_IDEAS.map((idea) => idea.id));
  if (ANNUAL_PLAN_IDEAS.length < 20 || ids.size !== ANNUAL_PLAN_IDEAS.length
    || ANNUAL_PLAN_IDEA_CATEGORIES.length < 5
    || ANNUAL_PLAN_IDEAS.some((idea) => !ANNUAL_PLAN_IDEA_CATEGORIES.some((category) => category.id === idea.category)
      || !idea.title || !idea.action)) {
    throw new Error('O catálogo precisa conter ao menos 20 ideias únicas com categoria, título e primeiro passo.');
  }
  if (filterAnnualPlanIdeas('dinheiro').length !== 4
    || filterAnnualPlanIdeas('all', 'saude').map((idea) => idea.id).join(',') !== 'preventive-care'
    || filterAnnualPlanIdeas('relacoes', 'viagem').length !== 0) {
    throw new Error('A busca e o filtro por categoria não correspondem às ideias disponíveis.');
  }
});

test('inicia os alertas antes de aguardar o service worker', () => {
  const source = readAppSource();
  const start = source.indexOf('async function continueAuthenticatedAurora(');
  const end = source.indexOf('\nexport async function startAuthenticatedAurora', start);
  if (start < 0 || end <= start) throw new Error('Não foi possível localizar a inicialização dos dados autenticados.');
  const startup = source.slice(start, end);
  const timer = startup.indexOf('setInterval(tick, 1000)');
  const serviceWorker = startup.indexOf('await registerPwaSupport()');
  if (timer < 0 || serviceWorker <= timer) throw new Error('O timer precisa iniciar antes do service worker.');
});

test('falha ao carregar dados oferece tentar novamente e sair', () => {
  const source = readAppSource();
  const start = source.indexOf('function showAccountDataLoadError(');
  const end = source.indexOf('\nasync function continueAuthenticatedAurora', start);
  const continuation = source.slice(end, source.indexOf('\nexport async function startAuthenticatedAurora', end));
  const screen = source.slice(start, end);
  if (start < 0 || end <= start
    || !screen.includes("retry.textContent = 'Tentar novamente'")
    || !screen.includes("exit.textContent = 'Sair'")
    || !continuation.includes('showAccountDataLoadError(root, error, user)')) {
    throw new Error('A falha de carga precisa oferecer ações recuperáveis e ser conectada ao catch.');
  }
});

test('indicador só aparece durante a gravação ou quando requer atenção', () => {
  const source = readAppSource();
  if (source.includes('window.confirm')) throw new Error('Ainda há confirmação nativa no app.');
  if (source.includes('Salvo às')
    || source.includes('Tudo salvo e sincronizado')
    || source.includes('data-status="saved"')
    || !source.includes('Salvando alterações…')
    || !source.includes('Não foi possível sincronizar.')
    || !source.includes('Sua conta mudou em outro dispositivo')
    || !source.includes('Sem conexão. Alterações não serão salvas.')
    || !source.includes('Alterações feitas offline não serão salvas')
    || !source.includes('class="sync-status"')
    || source.includes('persistenceNotice()')
    || source.includes('class="save-indicator')) {
    throw new Error('O shell não deve mostrar confirmação de sucesso; só deve avisar durante gravação ou quando há algo a resolver.');
  }
});

test('landing prioriza cadastro e apresenta as áreas e garantias com clareza', () => {
  const root = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [], addEventListener: () => {} };
  const previousDocument = globalThis.document;
  const documentStub = { title: '' };
  globalThis.document = documentStub;
  try {
    renderLanding(root);
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
  const markup = root.innerHTML;
  const landingTitle = 'Aurora — tarefas, hábitos, finanças e ciclo num app só';
  if (documentStub.title !== landingTitle) throw new Error('A landing deve atualizar o título da aba.');
  const entryHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const expectedContent = [
    'App de organização pessoal',
    'Sua rotina inteira,',
    'num app só.',
    'Criar minha conta grátis',
    'Testar sem cadastro',
    'Grátis, sem cartão',
    'Funciona no celular',
    'Em português',
    'Cinco partes da sua vida, sem trocar de app.',
    'O seu dia, numa tela só',
    'Tire as pendências da cabeça',
    'Hábitos que cabem na sua semana',
    'Saiba para onde vai o dinheiro',
    'Seu ciclo junto com o resto da rotina',
    'Três passos e o dia já fica mais leve.',
    'Simples de usar, tranquilo de confiar.',
    'Seus dados são seus',
    'Não acessa seu banco',
    'Vira app no celular',
    'Posso testar antes de criar conta?',
    'Posso levar meus dados ou apagar a conta?',
    'Com seu consentimento, você anota datas e sintomas e consulta médias.',
    'Menos coisa na cabeça.',
    'Mais dia para viver.',
    'Leia a Política de Privacidade.',
  ];
  expectedContent.forEach((text) => {
    if (!markup.includes(text)) throw new Error(`Conteúdo ausente na landing: ${text}`);
  });
  const heroStart = markup.indexOf('class="public-hero landing-hero"');
  const heroEnd = markup.indexOf('</section>', heroStart);
  const hero = markup.slice(heroStart, heroEnd);
  if (hero.indexOf('data-public-action="signup"') < 0
    || hero.indexOf('data-public-action="signup"') > hero.indexOf('data-public-action="demo"')
    || !hero.includes('btn primary large')
    || !hero.includes('landing-hero-phone')) {
    throw new Error('O cadastro deve ser a ação principal e aparecer antes da demonstração no hero.');
  }
  const sectionMarkers = [
    'class="public-hero landing-hero"',
    'class="public-tutorials landing-section"',
    'class="landing-steps landing-section"',
    'class="public-trust landing-trust landing-section"',
    'class="public-faq landing-faq landing-section"',
    'class="public-closing landing-final-cta landing-section"',
  ].map((marker) => markup.indexOf(marker));
  if (sectionMarkers.some((position) => position < 0)
    || sectionMarkers.some((position, index) => index > 0 && position <= sectionMarkers[index - 1])) {
    throw new Error('A landing deve manter os seis blocos na ordem definida.');
  }
  if ((markup.match(/role="tab" /g) || []).length !== 5
    || (markup.match(/role="tabpanel"/g) || []).length !== 5
    || (markup.match(/class="public-faq-item"/g) || []).length !== 6
    || (markup.match(/name="landing-faq"/g) || []).length !== 6) {
    throw new Error('As cinco abas e seis perguntas devem estar disponíveis com controles acessíveis.');
  }
  if (!markup.includes('href="https://aurora-rotinas.com.br/criar-conta"')
    || !markup.includes('href="https://aurora-rotinas.com.br/entrar"')
    || !markup.includes('href="https://aurora-rotinas.com.br/demonstracao"')
    || !markup.includes('href="https://aurora-rotinas.com.br/privacy.html"')) {
    throw new Error('As ações da landing devem apontar apenas para rotas definidas do Aurora.');
  }
  if (!markup.includes('loading="lazy"')
    || !markup.includes('alt="Tela de tarefas do Aurora')
    || !markup.includes('aria-label="Navegação principal"')
    || !markup.includes('data-public-control="theme-cycle"')) {
    throw new Error('Imagens, navegação e controle de tema precisam acompanhar os critérios da landing.');
  }
  const structuredData = [...entryHtml.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .flatMap((match) => JSON.parse(match[1]));
  const softwareApplication = structuredData.find((item) => item['@type'] === 'SoftwareApplication');
  const description = 'Organize sua rotina num só lugar: tarefas, hábitos, finanças e ciclo. Grátis, sem cartão e funciona no celular.';
  if (softwareApplication?.description !== description
    || !entryHtml.includes(`<title>${landingTitle}</title>`)
    || !entryHtml.includes(`property="og:title" content="${landingTitle}"`)
    || !entryHtml.includes(`name="twitter:title" content="${landingTitle}"`)
    || !entryHtml.includes(`name="description" content="${description}"`)) {
    throw new Error('Os metadados de busca e compartilhamento precisam acompanhar a landing.');
  }
  if (!entryHtml.includes('id="app"') || !entryHtml.includes('app-skeleton')
    || !entryHtml.includes('account-loading-indicator')
    || !entryHtml.includes('/landing-guard.js')) {
    throw new Error('A entrada precisa exibir o carregamento animado e carregar o guard externo.');
  }
  const prerenderScript = readFileSync(new URL('../scripts/prerender-landing.mjs', import.meta.url), 'utf8');
  if (!prerenderScript.includes('data-prerendered') || !prerenderScript.includes('file://')) {
    throw new Error('O build precisa pré-renderizar a landing sem URLs file://.');
  }
});

test('cabeçalho de autenticação compartilha navegação e ação principal da landing', () => {
  const markup = renderPublicHeader({ authMode: 'login' });
  if (!markup.includes('href="/#areas">O que dá para organizar</a>')
    || !markup.includes('href="/#steps">Como começar</a>')
    || !markup.includes('href="/#faq">Perguntas</a>')
    || !/class="btn primary public-account-action[^"]*"\s+data-account-mode="signup"/.test(markup)
    || !markup.includes('data-public-control="theme-cycle"')) {
    throw new Error('O cabeçalho de autenticação deve manter navegação, CTA e controle de tema da landing.');
  }
});

test('modal de cartão organiza identificação, pagamento e limite em seções claras', () => {
  const mainJs = readAppSource();
  const financeCss = readFileSync(new URL('../src/css/pages/finance.css', import.meta.url), 'utf8');
  if (!mainJs.includes('Identificação')
    || !mainJs.includes('Pagamento da fatura')
    || !mainJs.includes('Limite e datas')
    || !mainJs.includes('Dívida inicial')
    || !mainJs.includes('data-dlg="bankOption"')
    || !mainJs.includes('bank-custom-entry')
    || !mainJs.includes('Outro / não listado')
    || !mainJs.includes('isCardAccount')
    || !mainJs.includes('card-account-dialog')
    || !financeCss.includes('.dlg.card-account-dialog')
    || !financeCss.includes('.bank-name-control > .ds-select')
    || !financeCss.includes('.account-dialog-section')) {
    throw new Error('O modal de cartão deve separar os dados e usar uma largura adequada.');
  }
});

const equal = (actual, expected) => {
  if (actual !== expected) {
    throw new Error(
      `Esperado ${JSON.stringify(expected)}, recebido ${JSON.stringify(actual)}.`,
    );
  }
};

const ok = (value, message = 'Esperava um valor verdadeiro.') => {
  if (!value) throw new Error(message);
};

const truthy = (value) => {
  if (!value) throw new Error('Esperava um valor verdadeiro.');
};

const falsy = (value) => {
  if (value) throw new Error('Esperava um valor falso.');
};

test('toast usa o tom explícito e destaca falhas de persistência', () => {
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const previousSetTimeout = globalThis.setTimeout;
  const previousClearTimeout = globalThis.clearTimeout;
  const previousNow = Date.now;
  const written = [];
  const timer = { hidden: false, style: {} };
  const element = {
    className: '',
    innerHTML: '',
    setAttribute(name, value) { this[name] = value; },
    querySelector(selector) { return selector === '.toast-timer' ? timer : null; },
  };
  let override = null;
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    writable: true,
    value: { getElementById: () => element },
  });
  globalThis.setTimeout = () => 1;
  globalThis.clearTimeout = () => {};
  let now = 10000;
  Date.now = () => now;
  try {
    const controller = createToastController({
      readToast: () => written.at(-1) || null,
      writeToast: (toast) => written.push(toast),
      getContext: () => ({ top: false }),
      getOverride: () => override,
      normalizeMessage: (message) => message,
    });
    controller.show('Não foi possível salvar.', 'error');
    equal(written.at(-1).tone, 'error');
    equal(element.role, 'alert');
    controller.show('Salvo.', 'success');
    equal(written.at(-1).tone, 'success');
    equal(timer.style.animationDuration, '5000ms');
    now += 2500;
    controller.render();
    equal(timer.style.animationDelay, '-2500ms');
    controller.show('Alterado.', 'success', () => {});
    equal(timer.style.animationDuration, '9000ms');
    override = { message: 'Falha ao carregar.', details: 'Conexão indisponível.' };
    controller.show('Salvo.', 'success');
    equal(written.at(-1).tone, 'error');
    equal(written.at(-1).details, 'Conexão indisponível.');
  } finally {
    if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument);
    else delete globalThis.document;
    globalThis.setTimeout = previousSetTimeout;
    globalThis.clearTimeout = previousClearTimeout;
    Date.now = previousNow;
  }
});

test('captura rápida reconhece datas civis, horário e preserva etiquetas', () => {
  const tomorrow = parseQuickDate('Revisar amanhã 14h30 #trabalho', '2026-11-10');
  equal(tomorrow.title, 'Revisar #trabalho');
  equal(tomorrow.date, '2026-11-11');
  equal(tomorrow.time, '14:30');
  equal(parseQuickDate('Pagar sexta-feira', '2026-11-10').date, '2026-11-13');
  equal(parseQuickDate('Hoje 9:05 reunião', '2026-11-10').time, '09:05');
  equal(parseQuickDate('Planejar amanhã', '2026-12-31').date, '2027-01-01');
  equal(parseQuickDate('Revisar #sexta', '2026-11-10').title, 'Revisar #sexta');
  equal(parseQuickDate('Revisar tarefa', '2026-11-10').date, '2026-11-10');
  const nextWeek = parseQuickDate('Revisar próxima semana', '2026-11-18');
  equal(nextWeek.title, 'Revisar');
  equal(nextWeek.date, '2026-11-25');
  equal(parseQuickDate('Renovar documento 20/11', '2026-11-18').date, '2026-11-20');
  equal(parseQuickDate('Renovar documento 20/11/2027', '2026-11-18').date, '2027-11-20');
  ok(parseQuickDate('Agendar consulta 31/02', '2026-11-18').error);
  ok(parseQuickDate('Agendar consulta 20/11/26', '2026-11-18').error);
  ok(parseQuickDate('Revisar amanhã 25h', '2026-11-10').error);
  ok(parseQuickDate('Revisar hoje sexta', '2026-11-10').error);
});

test('revisão semanal inclui atrasos antigos e tarefas priorizadas da próxima semana', () => {
  const review = weeklyReview([
    { id: 'overdue', title: 'Tarefa atrasada', dueDate: '2026-11-10', priority: 'normal', done: false },
    { id: 'this-week', title: 'Tarefa desta semana', dueDate: '2026-11-20', priority: 'normal', done: false },
    { id: 'next-week', title: 'Tarefa da próxima semana', dueDate: '2026-11-25', priority: 'high', done: false },
    { id: 'completed', title: 'Tarefa concluída', dueDate: '2026-11-12', done: true, doneAt: '2026-11-17T12:00:00.000Z' },
  ], [], '2026-11-18');
  equal(review.tasks.completed, 1);
  equal(review.tasks.pending, 1);
  equal(review.tasks.overdue, 1);
  equal(review.tasks.overdueTasks[0].id, 'overdue');
  equal(review.nextWeek.tasks[0].id, 'next-week');
});


test('regras de categoria são validadas e aplicadas por primeira correspondência sem diferenciar acentos', () => {
  const rules = normalizeCategoryRules([
    { id: 'rule-food', phrase: 'CAFÉ CENTRAL', category: 'Alimentação', kind: 'out' },
    { id: 'rule-income', phrase: 'freelance', category: 'Renda extra', kind: 'in' },
    { id: 'rule-duplicate', phrase: 'inválida', category: 'Lazer', kind: 'other' },
    { id: 'rule-food', phrase: 'repetida', category: 'Lazer', kind: 'out' },
  ]);
  equal(rules.length, 2);
  equal(matchCategoryRule('Compra no Cafe Central - unidade 2', 'out', rules)?.id, 'rule-food');
  equal(matchCategoryRule('Pagamento freelance', 'in', rules)?.category, 'Renda extra');
  equal(matchCategoryRule('Compra no Cafe Central', 'in', rules), null);
  equal(matchCategoryRule('Outro estabelecimento', 'out', rules), null);
});

test('busca local ordena por relevância e inclui ações sem expor registros ausentes', () => {
  const results = searchRecords({
    tasks: [
      { id: 'weak', title: 'Revisar orçamento', notes: 'Acompanhar finanças depois' },
      { id: 'strong', title: 'Finanças' },
    ],
    actions: [{ id: 'finance', action: 'open-finances', area: 'Ações', title: 'Ir para Finanças', aliases: ['financeiro'] }],
  }, 'finanças');
  equal(results[0].id, 'strong');
  equal(results[1].kind, 'action');
  equal(results[2].id, 'weak');
  equal(searchRecords({ tasks: [] }, 'x').length, 0);
});

test('catálogo de ícones mantém estilo, acessibilidade e entradas válidas', () => {
  ok(Object.isFrozen(IC));
  ok(Object.isFrozen(ICON_SIZES));
  for (const name of HABIT_ICON_KEYS) {
    ok(Object.hasOwn(IC, name), `ícone de hábito ${name} precisa existir no catálogo`);
  }
  for (const [name, paths] of Object.entries(IC)) {
    ok(paths.startsWith('<'), `caminhos de ${name}`);
    const markup = iconSvg(name);
    ok(markup.includes('viewBox="0 0 24 24"'), `viewBox de ${name}`);
    ok(markup.includes('stroke="currentColor"'), `cor herdada de ${name}`);
    ok(markup.includes('aria-hidden="true"') && markup.includes('focusable="false"'), `acessibilidade de ${name}`);
  }
  ok(icon('home').s.includes('width="18"'));
  ok(iconSvg('home', ICON_SIZES.navigation, 'nav-icon').includes('class="ic nav-icon"'));
  let unknownRejected = false;
  try {
    iconSvg('toString');
  } catch (error) {
    unknownRejected = error instanceof RangeError;
  }
  ok(unknownRejected, 'ícones ausentes precisam falhar explicitamente');
  let invalidSizeRejected = false;
  try {
    iconSvg('home', 0);
  } catch (error) {
    invalidSizeRejected = error instanceof RangeError;
  }
  ok(invalidSizeRejected, 'tamanhos inválidos precisam falhar explicitamente');
});

test('orientações cobrem as telas e esclarecem a privacidade financeira', () => {
  const routes = ['inicio', 'planejar', 'financas', 'habitos', 'ciclo'];
  equal(AREA_GUIDE_IDS.join(','), routes.join(','));
  Object.values(AREA_GUIDES).forEach((guide) => {
    ok(guide.title);
    ok(guide.summary);
    ok(guide.steps.length >= 3);
    guide.steps.forEach((step) => {
      ok(step.title);
      ok(step.text);
    });
    ok(guide.video.endsWith('.mp4'));
    ok(guide.poster.endsWith('.webp'));
  });
  equal(Object.hasOwn(AREA_GUIDES, 'config'), false);
  ok(AREA_GUIDES.financas.steps.some((step) => step.text.includes('manualmente')));
  ok(AREA_GUIDES.habitos.steps.some((step) => step.text.includes('cada volume em mL') && step.text.includes('automaticamente')));
  ok(FINANCE_PRIVACY_NOTICE.includes('não se conecta a bancos'));
  ok(FINANCE_PRIVACY_NOTICE.includes('nem solicita sua senha bancária'));
  ok(FINANCE_PRIVACY_NOTICE.includes('associados à sua conta Aurora'));
  ok(AREA_GUIDES.ciclo.note.includes('método contraceptivo'));
});

test('preferências de tutoriais aceitam rotas conhecidas e mantêm compatibilidade anterior', () => {
  equal(normalizeAreaTutorialsSeen(undefined).length, 0);
  equal(normalizeAreaTutorialsSeen(['financas', 'financas', 'rota-inválida']).join(','), 'financas');
  equal(normalizeAreaTutorialsSeen(['config']).join(','), 'config');
  equal(isValidAreaTutorialsSeen([]), true);
  equal(isValidAreaTutorialsSeen(['financas', 'ciclo']), true);
  equal(isValidAreaTutorialsSeen(['config']), true);
  equal(isValidAreaTutorialsSeen(['financas', 'financas']), false);
  equal(isValidAreaTutorialsSeen(['rota-inválida']), false);
  equal(isValidAreaTutorialsSeen('financas'), false);
});

test('aniversário mantém somente dia e mês e atualiza a idade na data correta', () => {
  const birthday = createBirthdayReference('2000-10-29', new Date(2024, 9, 29));
  equal(birthday.ageAtReference, 24);
  equal(birthday.month, 10);
  equal(birthday.day, 29);
  equal(Object.hasOwn(birthday, 'year'), false);
  equal(isValidBirthdayReference(birthday), true);
  equal(formatBirthday(birthday), '29/10');
  equal(ageFromBirthdayReference(birthday, new Date(2025, 9, 28)), 24);
  equal(ageFromBirthdayReference(birthday, new Date(2025, 9, 29)), 25);
  equal(ageFromBirthdayReference(birthday, new Date(2026, 9, 29)), 26);
  const minorBirthday = createBirthdayReference('2010-10-29', new Date(2024, 9, 29));
  equal(minorBirthday.ageAtReference, 14);
  equal(isValidBirthdayReference(minorBirthday), true);
  const infantBirthday = createBirthdayReference('2024-10-29', new Date(2024, 9, 29));
  equal(infantBirthday.ageAtReference, 0);
  equal(isValidBirthdayReference(infantBirthday), true);
});

test('aniversário de 29 de fevereiro é contado em 28 de fevereiro nos anos comuns', () => {
  const birthday = createBirthdayReference('2000-02-29', new Date(2024, 1, 29));
  equal(ageFromBirthdayReference(birthday, new Date(2025, 1, 27)), 24);
  equal(ageFromBirthdayReference(birthday, new Date(2025, 1, 28)), 25);
});

test('sugestão de água considera idade registrada e usa referência adulta quando ausente', () => {
  const infant = estimateWaterGoal({ weightKg: 60, age: 0 });
  const middleAge = estimateWaterGoal({ weightKg: 60, age: 40 });
  const olderAdult = estimateWaterGoal({ weightKg: 60, age: 60 });
  const senior = estimateWaterGoal({ weightKg: 60, age: 70 });
  equal(infant.per, 40);
  equal(infant.assumed, false);
  const ageUnavailable = estimateWaterGoal({ weightKg: 60 });

  equal(middleAge.per, 35);
  equal(middleAge.ml, 2100);
  equal(olderAdult.per, 30);
  equal(olderAdult.ml, 1800);
  equal(senior.per, 25);
  equal(senior.ml, 1500);
  equal(ageUnavailable.per, 35);
  equal(ageUnavailable.assumed, true);
});

test('peso para estimativa de água aceita vírgula e valida limites sem gravar estado', () => {
  equal(parseWaterWeightKg('60,5'), 60.5);
  equal(parseWaterWeightKg('20'), 20);
  equal(parseWaterWeightKg('400'), 400);
  equal(parseWaterWeightKg(''), null);
  equal(parseWaterWeightKg('19.9'), null);
  equal(parseWaterWeightKg('400.1'), null);
  equal(parseWaterWeightKg('peso'), null);
});

test('campo de peso aceita números e um separador decimal, removendo letras', () => {
  equal(filterWeightInput('72,5'), '72,5');
  equal(filterWeightInput('72.5kg'), '72.5');
  equal(filterWeightInput('7a2,5'), '72,5');
  equal(filterWeightInput('70,2.3'), '70,23');
});

test('hábito de peso compara a medição atual com a última medição anterior', () => {
  const entries = [
    { id: 'a', date: '2026-11-20', kg: 70 },
    { id: 'b', date: '2026-11-22', kg: 69.5 },
  ];
  const loss = weightChange(entries, '2026-11-23', 69);
  equal(loss.direction, 'loss');
  equal(loss.difference, 0.5);
  const gain = weightChange(entries, '2026-11-23', 70.2);
  equal(gain.direction, 'gain');
  equal(gain.difference, 0.7);
  const same = weightChange(entries, '2026-11-23', 69.5);
  equal(same.direction, 'same');
  equal(same.difference, 0);
  equal(weightChange([], '2026-11-23', 69.5), null);
});

test('hábitos podem usar marcação, texto ou seleção', () => {
  equal(habitEntryType({}), 'check');
  equal(habitEntryType({ entryType: 'text' }), 'text');
  equal(habitEntryType({ entryType: 'select' }), 'select');
  equal(habitEntryOptions({ entryOptions: ['Fácil', 'Fácil', '', 'Difícil'] }).join(','), 'Fácil,Difícil');
  equal(habitEntryForDay({ entries: [{ day: '2026-11-23', value: 'Moderado' }] }, '2026-11-23'), 'Moderado');
});


test('a lixeira valida registros e rejeita identificadores duplicados', () => {
  const record = { collection: 'tasks', key: 'task-1', index: 0, value: { id: 'task-1' } };
  const validEntry = { id: 'trash-1', deletedAt: 1000, label: 'Tarefa: teste', records: [record] };
  const valid = (entry) => isValidTrashEntry(
    entry,
    (item) => item?.collection === 'tasks' && item.key === item.value?.id,
  );
  const normalized = normalizeTrash([validEntry, validEntry, { ...validEntry, records: [] }], valid);

  equal(normalized.entries.length, 1);
  equal(normalized.rejectedCount, 2);
});

test('a lixeira mantém itens por 30 dias e calcula os dias restantes', () => {
  const now = 100 * 86400000;
  const entry = { deletedAt: now - 5 * 86400000 };

  equal(isTrashExpired(entry, now), false);
  equal(trashDaysRemaining(entry, now), 25);
  equal(isTrashExpired({ deletedAt: now - TRASH_RETENTION_MS }, now), true);
});

test('a lixeira prioriza os itens que vencem primeiro sem alterar a lista original', () => {
  const newest = { id: 'newest', deletedAt: 3000 };
  const oldest = { id: 'oldest', deletedAt: 1000 };
  const entries = [newest, oldest];
  const ordered = sortTrashEntriesByExpiry(entries);

  equal(ordered.map((entry) => entry.id).join(','), 'oldest,newest');
  equal(entries[0], newest);
});

test('o backup preserva o tema personalizado em vez de reverter para a paleta base', () => {
  const source = readAppSource();
  ok(source.includes("theme: s.theme"), 'o backup precisa manter a seleção de tema atual');
  ok(!source.includes("theme: s.theme === 'custom' ? 'rose' : s.theme"), 'não pode forçar a cor personalizada de volta para a paleta rosé');
});

test('reconhece objetos simples e rejeita formatos incompatíveis', () => {
  truthy(isPlainObject({ value: 1 }));
  equal(isPlainObject([]), false);
  equal(isPlainObject(null), false);
});

test('aceita objetos sem protótipo e rejeita instâncias de classes nativas', () => {
  truthy(isPlainObject(Object.create(null)));
  falsy(isPlainObject(new Date()));
  falsy(isPlainObject(new Map()));
});

test('filtra registros inválidos e informa a quantidade preservada', () => {
  const result = filterValidRecords(
    [{ id: 'a' }, null, { id: 'b' }],
    (entry) => isPlainObject(entry) && typeof entry.id === 'string',
  );

  equal(result.records.length, 2);
  equal(result.rejectedCount, 1);
  equal(filterValidRecords({}, () => true).rejectedCount, 1);
});

test('preserva referências válidas e conta todos os registros rejeitados', () => {
  const valid = { id: 'valid' };
  const result = filterValidRecords(
    [valid, null, {}, { id: 1 }, valid],
    (entry) => isPlainObject(entry) && typeof entry.id === 'string',
  );

  equal(result.records.length, 2);
  equal(result.records[0], valid);
  equal(result.records[1], valid);
  equal(result.rejectedCount, 3);
});

test('converte valores monetários brasileiros para centavos exatos', () => {
  equal(parseMoney('0,10'), 10);
  equal(parseMoney('1.234,56'), 123456);
  equal(parseMoney('10.000,00'), 1000000);
});

test('formata valores monetários enquanto os dígitos são digitados', () => {
  equal(formatMoneyInput(''), '00,00');
  equal(formatMoneyInput('0'), '00,00');
  equal(formatMoneyInput('1'), '0,01');
  equal(formatMoneyInput('12'), '0,12');
  equal(formatMoneyInput('123'), '1,23');
  equal(formatMoneyInput('123456'), '1.234,56');
  equal(formatMoneyInput('-123'), '-1,23');
  equal(parseMoney(formatMoneyInput('123456')), 123456);
});

test('rejeita valores monetários inválidos ou fora do intervalo seguro', () => {
  truthy(Number.isNaN(parseMoney('1.234,567')));
  truthy(Number.isNaN(parseMoney('R$')));
  truthy(Number.isNaN(parseMoney('90071992547409,92')));
});

test('aceita sinais, espaços e decimais válidos em valores monetários', () => {
  equal(parseMoney(' R$ 1.234,56 '), 123456);
  equal(parseMoney('-10,50'), -1050);
  equal(parseMoney('+10,5'), 1050);
  equal(parseMoney('1.25'), 125);
});

test('valida datas civis incluindo anos bissextos', () => {
  truthy(isDay('2024-02-29'));
  equal(isDay('2025-02-29'), false);
  equal(isDay('2024-13-01'), false);
});

test('parcelas mensais preservam o dia de origem e ajustam meses curtos', () => {
  equal(addMonths('2026-01-31', 1), '2026-02-28');
  equal(addMonths('2026-01-31', 2), '2026-03-31');
  equal(addMonths('2028-01-31', 1), '2028-02-29');
  equal(addMonths('2026-03-31', -1), '2026-02-28');
});

test('valida atividade sexual e métodos contraceptivos do diário do ciclo', () => {
  truthy(isValidCycleSexualLog({}));
  truthy(isValidCycleSexualLog({ sexualActivity: true }));
  truthy(isValidCycleSexualLog({ sexualActivity: true, contraceptionMethods: ['condom', 'pill'] }));
  truthy(isValidCycleSexualLog({ sexualActivity: true, contraceptionMethods: ['none'] }));
  truthy(isValidCycleSexualLog({ sexualActivity: true, contraceptionMethods: ['undisclosed'] }));
  truthy(isValidCycleSexualLog({ masturbationActivity: true, orgasmCount: 0 }));
  truthy(isValidCycleSexualLog({ sexualActivity: true, masturbationActivity: true, orgasmCount: 2 }));
  falsy(isValidCycleSexualLog({ sexualActivity: 'sim' }));
  falsy(isValidCycleSexualLog({ masturbationActivity: 'sim' }));
  falsy(isValidCycleSexualLog({ orgasmCount: -1 }));
  falsy(isValidCycleSexualLog({ orgasmCount: 100 }));
  falsy(isValidCycleSexualLog({ orgasmCount: 1.5 }));
  falsy(isValidCycleSexualLog({ contraceptionMethods: ['condom'] }));
  falsy(isValidCycleSexualLog({ sexualActivity: true, contraceptionMethods: ['unknown'] }));
  falsy(isValidCycleSexualLog({ sexualActivity: true, contraceptionMethods: ['pill', 'pill'] }));
  falsy(isValidCycleSexualLog({ sexualActivity: true, contraceptionMethods: ['none', 'condom'] }));
  falsy(isValidCycleSexualLog({ sexualActivity: true, contraceptionMethods: ['undisclosed', 'pill'] }));
});

test('cria períodos menstruais por intervalo e rejeita datas ou duração inválidas', () => {
  const period = createCyclePeriod('2026-03-01', '2026-03-05', '2026-03-10');
  equal(period?.start, '2026-03-01');
  equal(period?.end, '2026-03-05');
  const singleDay = createCyclePeriod('2026-03-10', '2026-03-10', '2026-03-10');
  equal(singleDay?.start, '2026-03-10');
  equal(singleDay?.end, '2026-03-10');
  truthy(createCyclePeriod('2026-02-24', '2026-03-10', '2026-03-10'));
  equal(createCyclePeriod('2026-02-23', '2026-03-10', '2026-03-10'), null);
  equal(createCyclePeriod('2026-03-02', '2026-03-01', '2026-03-10'), null);
  equal(createCyclePeriod('2026-03-01', '2026-03-11', '2026-03-10'), null);
  equal(createCyclePeriod('2026-02-30', '2026-03-01', '2026-03-10'), null);
  equal(MAX_CYCLE_PERIOD_DAYS, 15);
});

test('marca até hoje períodos menstruais ainda em andamento', () => {
  equal(
    cyclePeriodDays('2026-03-10', null, '2026-03-12').join(','),
    '2026-03-10,2026-03-11,2026-03-12',
  );
  equal(
    cyclePeriodDays('2026-03-01', '2026-03-03', '2026-03-12').join(','),
    '2026-03-01,2026-03-02,2026-03-03',
  );
  equal(cyclePeriodDays('2026-03-13', null, '2026-03-12').length, 0);
});

test('cálculos do ciclo usam seis intervalos recentes e limitam fases férteis por variação', () => {
  const starts = ['2025-01-01'];
  [60, 27, 28, 30, 26, 29, 28].forEach((length) => {
    starts.push(addDays(starts[starts.length - 1], length));
  });
  const periods = starts.map((start) => ({ start, end: start }));
  const stats = cycleStats({}, periods, addDays(starts.at(-1), 1));

  equal(stats.starts.join(','), starts.join(','));
  equal(stats.observedIntervals, 6);
  equal(stats.avg, 28);
  equal(stats.min, 26);
  equal(stats.max, 30);
  equal(stats.variation, 4);
  equal(stats.canEstimateFertility, true);
  equal(stats.next, addDays(starts.at(-1), 28));
  equal(cycleDayNumber(addDays(starts.at(-1), 5), stats.starts), 6);

  const recentStarts = ['2025-01-01'];
  [25, 26, 27, 28, 29, 30, 90, 28].forEach((length) => {
    recentStarts.push(addDays(recentStarts[recentStarts.length - 1], length));
  });
  const recentStats = cycleStats({}, recentStarts.map((start) => ({ start, end: start })), addDays(recentStarts.at(-1), 1));
  equal(recentStats.observedIntervals, 5);
  equal(recentStats.avg, 28);
  equal(recentStats.min, 27);
  equal(recentStats.max, 30);
  equal(recentStats.hasOutOfRangeRecentInterval, true);
  equal(recentStats.canEstimateFertility, false);

  const variableStarts = ['2026-01-01', '2026-01-27', '2026-03-02'];
  const variableStats = cycleStats({}, variableStarts.map((start) => ({ start, end: start })), '2026-03-03');
  equal(variableStats.variation, 8);
  equal(variableStats.canEstimateFertility, false);
  equal(estimatedCyclePhase(addDays(variableStarts.at(-1), 8), variableStats.starts, variableStats.avg, variableStats.set, variableStats.canEstimateFertility), '');
  equal(estimatedCyclePhase(addDays(variableStarts.at(-1), 13), variableStats.starts, variableStats.avg, variableStats.set, variableStats.canEstimateFertility), '');
  equal(estimatedCyclePhase(variableStarts.at(-1), variableStats.starts, variableStats.avg, variableStats.set, variableStats.canEstimateFertility), 'menstruation');
});

test('estimação de fases do ciclo e métricas de sintomas validam as janelas esperadas', () => {
  const starts = ['2026-01-01', '2026-01-29'];
  equal(estimatedCyclePhase('invalid-date', starts, 28), '');
  equal(estimatedCyclePhase(addDays(starts.at(-1), 8), starts, 28), 'fertile');
  equal(estimatedCyclePhase(addDays(starts.at(-1), 13), starts, 28), 'ovulation');
  equal(estimatedCyclePhase(addDays(starts.at(-1), 8), starts, 28, new Set(), false), '');

  const days = periodDaySet(
    { '2026-05-02': { flow: 'light' }, '2026-05-03': { flow: 'none' } },
    [{ start: '2026-05-05', end: '2026-05-06' }],
    '2026-05-10',
  );
  equal([...days].sort().join(','), '2026-05-02,2026-05-05,2026-05-06');

  const symptoms = topSymptoms({
    '2026-06-01': { pain: ['cramp', 'head'], mood: ['anxious'], energy: 'low', sleep: 'insomnia' },
    '2026-06-02': { pain: ['cramp'] },
    '2026-03-01': { pain: ['cramp'] },
  }, '2026-06-30', (category, value) => `${category}-${value}`);
  equal(symptoms.length, 5);
  equal(symptoms[0].category, 'pain');
  equal(symptoms[0].value, 'cramp');
  equal(symptoms[0].count, 2);
  equal(symptoms.some(({ value }) => value === 'head'), true);
  equal(symptoms.some(({ value }) => value === 'insomnia'), true);
  equal(symptoms.some(({ value }) => value === 'old'), false);
});

test('gera intervalo de dias para registro de sintomas sem aceitar datas inválidas', () => {
  equal(cycleLogDays('2026-03-01', '2026-03-03', '2026-03-10')?.join(','), '2026-03-01,2026-03-02,2026-03-03');
  equal(cycleLogDays('2026-03-10', '2026-03-10', '2026-03-10')?.length, 1);
  equal(cycleLogDays('2026-03-01', '2026-03-31', '2026-03-31')?.length, 31);
  equal(cycleLogDays('2026-03-01', '2026-04-01', '2026-04-01'), null);
  equal(cycleLogDays('2026-03-04', '2026-03-03', '2026-03-10'), null);
  equal(cycleLogDays('2026-03-01', '2026-03-11', '2026-03-10'), null);
  equal(cycleLogDays('2026-02-30', '2026-03-01', '2026-03-10'), null);
  equal(MAX_CYCLE_LOG_RANGE_DAYS, 31);
});

test('acrescenta sintomas em lote sem substituir os registros diários existentes', () => {
  const result = mergeCycleLogSymptoms(
    { flow: 'medium', pain: ['cramp'], mood: ['calm'], note: 'manter', sexualActivity: true },
    { pain: ['cramp', 'head'], mood: ['sad'], skin: ['oilyskin'], flow: ['light'] },
  );
  equal(result.pain.join(','), 'cramp,head');
  equal(result.mood.join(','), 'calm,sad');
  equal(result.skin.join(','), 'oilyskin');
  equal(result.flow, 'medium');
  equal(result.note, 'manter');
  equal(result.sexualActivity, true);
});

test('rejeita datas com formato incorreto ou dias inexistentes', () => {
  falsy(isDay('2024-2-01'));
  falsy(isDay('2024-04-31'));
  falsy(isDay('2024/04/30'));
  falsy(isDay(''));
  falsy(isDay(null));
});

test('normaliza datas legadas sem aceitar dias inexistentes', () => {
  equal(normalizeDay('2024/4/30'), '2024-04-30');
  equal(normalizeDay('2024/04/31'), '');
});

test('mantém aliases legados e direciona rotas removidas ou desconhecidas para Início', () => {
  const routes = new Set(['inicio', 'planejar', 'financas', 'habitos', 'config']);

  equal(resolveRoute('pomodoro', routes).route, 'inicio');
  equal(resolveRoute('pomodoro', routes).replaceHash, null);
  equal(resolveRoute('estudos', routes).route, 'inicio');
  equal(resolveRoute('estudos', routes).replaceHash, null);
  equal(resolveRoute('removida', routes).route, 'inicio');
  equal(resolveRoute('removida', routes).replaceHash, null);
  equal(resolveRoute('pessoal', routes).replaceHash, 'inicio');
  equal(resolveRoute('perfil', routes).route, 'config');
  equal(resolveRoute('perfil', routes).replaceHash, 'config');
  equal(resolveRoute('academia', routes).route, 'inicio');
  equal(resolveRoute('academia', routes).replaceHash, 'inicio');
  equal(resolveRoute('agua', routes).route, 'habitos');
  equal(resolveRoute('agua', routes).replaceHash, 'habitos');
  equal(resolveRoute('invalida', routes).route, 'inicio');
});

test('usa caminhos legíveis e converte hashes antigos sem perder query ou âncoras', () => {
  const routes = new Set(['inicio', 'planejar', 'financas', 'habitos', 'config']);
  equal(routePathFor('financas'), '/financas');
  equal(routePathFor('perfil'), '/ajustes/perfil');
  equal(routePathFor('config'), '/ajustes');
  equal(routePathFor('config?section=calendars'), '/ajustes/agendas');
  equal(routePathFor('config?weight'), '/ajustes/perfil?weight=');
  equal(routeFromLocation(new URL('https://aurora.local/financas'), routes).route, 'financas');
  equal(routeFromLocation(new URL('https://aurora.local/pomodoro'), routes).route, 'inicio');
  equal(routeFromLocation(new URL('https://aurora.local/pomodoro'), routes).replacePath, '/inicio');
  equal(routeFromLocation(new URL('https://aurora.local/ajustes/dados'), routes).route, 'config');
  equal(routeFromLocation(new URL('https://aurora.local/ajustes/dados'), routes).query, 'section=data');
  equal(routeFromLocation(new URL('https://aurora.local/ajustes/dados'), routes).replacePath, null);
  equal(routeFromLocation(new URL('https://aurora.local/ajustes/dados?source=pwa&section=profile'), routes).replacePath, '/ajustes/dados?source=pwa');
  equal(routeFromLocation(new URL('https://aurora.local/pages/inicio.html#main'), routes).replacePath, '/inicio#main');
  equal(routeFromLocation(new URL('https://aurora.local/#agua'), routes).replacePath, '/habitos');
  equal(routeFromLocation(new URL('https://aurora.local/#config?section=data'), routes).replacePath, '/ajustes/dados');
  equal(routeFromLocation(new URL('https://aurora.local/?source=pwa#config?section=data'), routes).replacePath, '/ajustes/dados?source=pwa');
  equal(routeFromLocation(new URL('https://aurora.local/config?section=data'), routes).replacePath, '/ajustes/dados');
  equal(routeFromLocation(new URL('https://aurora.local/perfil'), routes).replacePath, '/ajustes/perfil');
  equal(routeFromLocation(new URL('https://aurora.local/agua'), routes).route, 'habitos');
  equal(canonicalPublicPath(new URL('https://aurora.local/#inicio')), '/inicio');
  equal(canonicalPublicPath(new URL('https://aurora.local/#config?section=data')), '/ajustes/dados');
  equal(canonicalPublicPath(new URL('https://aurora.local/#criar-conta?etapa=acesso')), '/criar-conta?etapa=acesso');
});

test('resolve rotas públicas por caminho e preserva as âncoras da landing', () => {
  equal(accountPathForMode('login'), '/entrar');
  equal(accountPathForMode('signup-access'), '/criar-conta?etapa=acesso');
  equal(accountModeFromLocation(new URL('https://aurora.local/criar-conta?etapa=acesso')), 'signup-access');
  truthy(isPublicLandingLocation(new URL('https://aurora.local/')));
  truthy(isPublicLandingLocation(new URL('https://aurora.local/#landing-main')));
  truthy(isDemoLocation(new URL('https://aurora.local/demonstracao')));
  falsy(isPublicLandingLocation(new URL('https://aurora.local/inicio')));
  falsy(isPublicLandingLocation(new URL('https://aurora.local/#financas')));
});

test('descarta opções de menu removidas ao normalizar preferências antigas', () => {
  const oldOrder = ['inicio', 'planejar', 'pomodoro', 'financas', 'retired', 'agua', 'ciclo', 'habitos'];
  const oldVisibleItems = ['pomodoro', 'financas', 'retired', 'agua', 'ciclo', 'habitos'];

  truthy(isValidMenuOrder(oldOrder));
  truthy(isValidVisibleMenuItems(oldVisibleItems));
  equal(normalizeMenuOrder(oldOrder).join(','), 'inicio,planejar,financas,agua,ciclo,habitos');
  equal(normalizeVisibleMenuItems(oldVisibleItems).join(','), 'financas,ciclo,habitos,agua');
  falsy(isValidMenuOrder([...oldOrder, 'retired']));
  falsy(isValidVisibleMenuItems([...oldVisibleItems, 'retired']));
});

test('mantém Início e Planejar fixos e só oferece movimentos possíveis no menu', () => {
  const order = ['inicio', 'planejar', 'financas', 'agua', 'ciclo', 'habitos'];

  equal(normalizeMenuOrder(order).join(','), 'inicio,planejar,financas,agua,ciclo,habitos');
  equal(moveMenuItem(order, 'planejar', 1).join(','), 'inicio,planejar,financas,agua,ciclo,habitos');
  equal(moveMenuItem(order, 'pomodoro', -1).join(','), 'inicio,planejar,financas,agua,ciclo,habitos');
  falsy(canMoveMenuItem(order, 'pomodoro', 1));
  falsy(canMoveMenuItem(order, 'inicio', 1));
  falsy(canMoveMenuItem(order, 'planejar', 1));
  falsy(canMoveMenuItem(order, 'habitos', 1));
});

test('reconhece os hashes públicos da landing', () => {
  truthy(isPublicLandingHash(''));
  truthy(isPublicLandingHash('#landing'));
  truthy(isPublicLandingHash('#landing-main'));
  falsy(isPublicLandingHash('#inicio'));
});

test('ao sair da conta, redireciona para a landing pública', () => {
  equal(
    postSignOutPath({ href: 'https://aurora.local/pages/ajustes.html?source=pwa#config' }),
    '/',
  );
});

test('ao excluir a conta, navega para a landing pública', () => {
  const destinations = [];
  redirectToPublicLanding({
    href: 'https://aurora.local/pages/inicio.html?source=pwa#inicio',
    replace: (destination) => destinations.push(destination),
  });
  equal(destinations.join(','), '/');
});

test('ao sair de Ajustes, prepara o retorno na aba Seu perfil', () => {
  equal(
    settingsRootPath({ href: 'https://aurora.local/config?source=pwa&section=data' }),
    '/ajustes?source=pwa',
  );
  equal(settingsRootPath({ href: 'https://aurora.local/ajustes/dados?source=pwa' }), '/ajustes?source=pwa');
  equal(settingsRootPath({ href: 'https://aurora.local/inicio' }), null);
  equal(settingsRootPath({ href: 'https://aurora.local/config' }), null);
});

test('normaliza contas Dinheiro antigas para corrente e reconhece investimentos', () => {
  equal(normalizeAccountType('cash'), 'checking');
  equal(normalizeAccountType('investment'), 'investment');
  equal(isValidAccountType('cash'), true);
  equal(isValidAccountType('investment'), true);
  equal(isValidAccountType('unknown'), false);
  equal(ACCOUNT_TYPES.investment, 'Investimento');
  equal(Object.hasOwn(ACCOUNT_TYPES, 'cash'), false);
});

test('calcula saldos em centavos, inclui investimentos e exclui cartão do saldo líquido', () => {
  const checking = { id: 'checking', type: 'checking', initialCents: 10000 };
  const investment = { id: 'investment', type: 'investment', initialCents: 1000 };
  const card = { id: 'card', type: 'credit', initialCents: 0 };

  const transactions = [
    { type: 'in', accountId: 'checking', cents: 5000, paid: true },
    { type: 'out', accountId: 'checking', cents: 1250, paid: true },
    {
      type: 'tr',
      accountId: 'checking',
      toAccountId: 'investment',
      cents: 2000,
      paid: true,
    },
    { type: 'out', accountId: 'card', cents: 3000, paid: true },
  ];

  equal(accountBalance(checking, transactions), 11750);
  equal(accountBalance(investment, transactions), 3000);
  equal(accountBalance(card, transactions), -3000);
  equal(netAccountBalance([checking, investment, card], transactions), 14750);
});

test('ignora lançamentos pendentes no saldo das contas', () => {
  const account = { id: 'checking', type: 'checking', initialCents: 10000 };
  const transactions = [
    { type: 'in', accountId: 'checking', cents: 5000, paid: false },
    { type: 'out', accountId: 'checking', cents: 2000, paid: false },
    { type: 'out', accountId: 'checking', cents: 1000, paid: true },
  ];

  equal(accountBalance(account, transactions), 9000);
});

test('resumo de parcelas calcula vencimento final e valores ainda restantes', () => {
  const accounts = [
    { id: 'checking', type: 'checking' },
    { id: 'card', type: 'credit' },
  ];
  const transactions = [
    { id: 'first', groupId: 'purchase', type: 'out', accountId: 'checking', cents: 100, date: '2026-09-10', paid: true },
    { id: 'second', groupId: 'purchase', type: 'out', accountId: 'checking', cents: 101, date: '2026-10-10', paid: false },
    { id: 'third', groupId: 'purchase', type: 'out', accountId: 'checking', cents: 100, date: '2026-11-10', paid: false },
    { id: 'card-past', groupId: 'card-purchase', type: 'out', accountId: 'card', cents: 500, date: '2026-09-10', paid: true },
    { id: 'card-now', groupId: 'card-purchase', type: 'out', accountId: 'card', cents: 500, date: '2026-10-10', paid: true },
    { id: 'card-next', groupId: 'card-purchase', type: 'out', accountId: 'card', cents: 500, date: '2026-11-10', paid: true },
  ];
  const accountForId = (id) => accounts.find((account) => account.id === id);
  const purchase = installmentSummary(transactions, 'second', accountForId, '2026-10');
  const cardPurchase = installmentSummary(transactions, 'card-past', accountForId, '2026-10');

  equal(purchase.endDate, '2026-11-10');
  equal(purchase.remainingCents, 201);
  equal(purchase.remainingCount, 2);
  equal(purchase.selectedIndex, 1);
  equal(cardPurchase.endDate, '2026-11-10');
  equal(cardPurchase.remainingCents, 1000);
  equal(cardPurchase.remainingCount, 2);
  equal(cardPurchase.cardPurchase, true);
});

test('saldo histórico considera transferências e data de liquidação sem incluir cartão', () => {
  const accounts = [
    { id: 'checking', type: 'checking', initialCents: 10000 },
    { id: 'savings', type: 'savings', initialCents: 0 },
    { id: 'card', type: 'credit', initialCents: 0 },
  ];
  const transactions = [
    { type: 'out', accountId: 'checking', cents: 2000, date: '2026-10-10', settledDate: '2026-11-02', paid: true },
    { type: 'in', accountId: 'checking', cents: 500, date: '2026-10-31', settledDate: '2026-11-01', paid: true },
    { type: 'out', accountId: 'checking', cents: 800, date: '2026-10-20', settledDate: '2026-10-21', paid: false },
    { type: 'out', accountId: 'card', cents: 3000, date: '2026-10-22', paid: true },
    { type: 'tr', accountId: 'checking', toAccountId: 'savings', cents: 1000, date: '2026-11-03', paid: true },
    { type: 'tr', accountId: 'checking', toAccountId: 'card', cents: 1000, date: '2026-11-04', paid: true },
  ];

  equal(accountBalanceOn(accounts[0], transactions, '2026-10-31'), 10000);
  equal(netAccountBalanceOn(accounts, transactions, '2026-10-31'), 10000);
  equal(accountBalanceOn(accounts[0], transactions, '2026-11-04'), 6500);
  equal(netAccountBalanceOn(accounts, transactions, '2026-11-04'), 7500);
});

test('projeção de saldo inclui pendências, transferências e faturas sem duplicar parcelas', () => {
  const accounts = [
    { id: 'checking', type: 'checking', initialCents: 10000 },
    { id: 'savings', type: 'savings', initialCents: 0 },
    { id: 'card', type: 'credit', initialCents: 0 },
  ];
  const transactions = [
    { type: 'out', accountId: 'checking', cents: 1000, date: '2026-11-01', paid: true },
    { type: 'out', accountId: 'checking', cents: 500, date: '2026-11-20', paid: false },
    { type: 'in', accountId: 'checking', cents: 1200, date: '2026-11-25', paid: false },
    { type: 'tr', accountId: 'checking', toAccountId: 'savings', cents: 700, date: '2026-11-26', paid: false },
    { type: 'tr', accountId: 'checking', toAccountId: 'card', cents: 1000, date: '2026-11-27', paid: false, invoiceInstallment: true, interestCents: 100 },
    { type: 'tr', accountId: 'card', toAccountId: 'checking', cents: 200, date: '2026-11-28', paid: false },
    { type: 'out', accountId: 'card', cents: 3000, date: '2026-11-29', paid: false },
    { type: 'out', accountId: 'checking', cents: 4000, date: '2026-12-01', paid: false },
  ];

  equal(projectedNetAccountBalance(accounts, transactions, '2026-11-30', [
    { dueDate: '2026-11-30', cents: 3000 },
    { dueDate: '2026-12-02', cents: 9000 },
  ]), 5900);
});

test('objetivo vinculado acompanha saldo não negativo da conta sem alterar o modo manual', () => {
  const accounts = [
    { id: 'checking', type: 'checking', initialCents: 5000 },
    { id: 'card', type: 'credit', initialCents: 0 },
  ];
  const transactions = [
    { type: 'in', accountId: 'checking', cents: 6000, date: '2026-10-01', paid: true },
    { type: 'out', accountId: 'checking', cents: 3000, date: '2026-10-02', paid: true },
    { type: 'out', accountId: 'checking', cents: 2000, date: '2026-10-03', paid: false },
  ];

  equal(linkedGoalProgressCents({
    linkedAccountId: 'checking',
    savedCents: 123,
  }, accounts, transactions), 8000);
  equal(linkedGoalProgressCents({
    linkedAccountId: 'card',
    savedCents: 456,
  }, accounts, transactions), 456);
  equal(linkedGoalProgressCents({ savedCents: 789 }, accounts, transactions), 789);
});

test('relatório de caixa usa data de liquidação e pagamento de fatura sem duplicar compras', () => {
  const accounts = [
    { id: 'checking', type: 'checking' },
    { id: 'card', type: 'credit' },
  ];
  const transactions = [
    { type: 'in', accountId: 'checking', cents: 5000, date: '2026-10-31', settledDate: '2026-11-01', paid: true },
    { type: 'out', accountId: 'checking', cents: 1200, date: '2026-10-10', settledDate: '2026-11-02', paid: true, category: 'Moradia' },
    { type: 'out', accountId: 'checking', cents: 800, date: '2026-10-15', paid: false, category: 'Alimentação' },
    { type: 'out', accountId: 'checking', cents: 300, date: '2026-10-30', paid: true, category: 'Outros' },
    { type: 'out', accountId: 'card', cents: 3000, date: '2026-10-22', paid: true, category: 'Lazer' },
    { type: 'tr', accountId: 'checking', toAccountId: 'card', cents: 1500, date: '2026-11-04', paid: true },
  ];
  const accountForId = (id) => accounts.find((account) => account.id === id);
  const competence = reportMonthStats(transactions, '2026-10', accountForId);
  const octoberCash = reportMonthStats(transactions, '2026-10', accountForId, 'cash');
  const novemberCash = reportMonthStats(transactions, '2026-11', accountForId, 'cash');

  equal(competence.inAll, 5000);
  equal(competence.outAll, 5300);
  equal(octoberCash.inAll, 0);
  equal(octoberCash.outAll, 300);
  equal(novemberCash.inAll, 5000);
  equal(novemberCash.outAll, 2700);
  const categories = Object.fromEntries(summarizeByCategory(novemberCash.tx, 'out'));
  equal(categories.Moradia, 1200);
  equal(categories['Pagamento de fatura'], 1500);
});

test('importação de extrato informa quando a prévia excede 500 registros', () => {
  const input = [
    'Data;Descrição;Valor',
    ...Array.from({ length: 501 }, (_, index) => `2026-10-01;Item ${index + 1};0,10`),
  ].join('\n');
  const parsed = parseStatement(input, 'extrato.csv');

  equal(parsed.transactions.length, 500);
  equal(parsed.truncated, true);
  equal(parsed.transactions[0].cents, 10);
  equal(parsed.transactions[499].desc, 'Item 500');
});

test('importação CSV preserva centavos, aceita datas civis e rejeita datas inválidas', () => {
  const parsed = parseStatement([
    '\uFEFFData;Descrição;Valor',
    '29/10/2026;Compra;1.234,56',
    '2026-02-29;Data inválida;10,00',
  ].join('\n'), 'extrato.csv');

  equal(parsed.truncated, false);
  equal(parsed.transactions.length, 1);
  equal(parsed.transactions[0].date, '2026-10-29');
  equal(parsed.transactions[0].cents, 123456);
});

test('importação OFX lê datas e valores em centavos', () => {
  const parsed = parseStatement(
    '<STMTTRN><DTPOSTED>20261029120000<TRNAMT>-10.50<MEMO>Compra</STMTTRN>',
    'extrato.ofx',
  );

  equal(parsed.transactions.length, 1);
  equal(parsed.transactions[0].date, '2026-10-29');
  equal(parsed.transactions[0].cents, -1050);
});

test('importação distingue duplicados idênticos de transações apenas semelhantes', () => {
  const existing = [{
    accountId: 'checking',
    type: 'out',
    cents: 1234,
    date: '2026-10-29',
    desc: 'Café da Praça',
  }];
  const exact = statementDuplicateStatus({
    accountId: 'checking',
    type: 'out',
    cents: 1234,
    date: '2026-10-29',
    desc: '  CAFE DA PRACA  ',
  }, existing);
  const similar = statementDuplicateStatus({
    accountId: 'checking',
    type: 'out',
    cents: 1234,
    date: '2026-10-29',
    desc: 'Padaria',
  }, existing);
  const distinct = statementDuplicateStatus({
    accountId: 'checking',
    type: 'out',
    cents: 1235,
    date: '2026-10-29',
    desc: 'Café da Praça',
  }, existing);

  equal(`${exact.duplicate}:${exact.possible}`, 'true:false');
  equal(`${similar.duplicate}:${similar.possible}`, 'false:true');
  equal(`${distinct.duplicate}:${distinct.possible}`, 'false:false');
});

test('resume mensal distingue transferência e compra no cartão', () => {
  const accounts = [
    { id: 'checking', type: 'checking' },
    { id: 'card', type: 'credit' },
  ];

  const transactions = [
    {
      type: 'in',
      date: '2026-10-01',
      cents: 10000,
      paid: true,
      accountId: 'checking',
    },
    {
      type: 'out',
      date: '2026-10-02',
      cents: 2500,
      paid: true,
      accountId: 'checking',
    },
    {
      type: 'out',
      date: '2026-10-03',
      cents: 1500,
      paid: true,
      accountId: 'card',
    },
    {
      type: 'tr',
      date: '2026-10-04',
      cents: 5000,
      paid: true,
      accountId: 'checking',
    },
  ];

  const summary = monthStats(
    transactions,
    '2026-10',
    (id) => accounts.find((account) => account.id === id),
  );

  equal(summary.inAll, 10000);
  equal(summary.outAll, 4000);
  equal(summary.outPaid, 2500);
  equal(summary.cardOut, 1500);
  equal(summary.tx.length, 3);
});

test('fechamento mensal resume pendências, fixas e cartão em centavos', () => {
  const accounts = [
    { id: 'checking', type: 'checking' },
    { id: 'card', type: 'credit' },
  ];
  const transactions = [
    { type: 'in', date: '2026-10-01', cents: 10000, paid: true, accountId: 'checking' },
    { type: 'out', date: '2026-10-02', cents: 2500, paid: true, accountId: 'checking', category: 'Mercado' },
    { type: 'out', date: '2026-10-03', cents: 1000, paid: false, accountId: 'checking', category: 'Moradia', recId: 'rent' },
    { type: 'out', date: '2026-10-04', cents: 750, paid: false, accountId: 'card', category: 'Transporte' },
    { type: 'out', date: '2026-10-05', cents: 2000, paid: true, accountId: 'checking', category: 'Moradia', recId: 'utilities' },
    { type: 'tr', date: '2026-10-06', cents: 7000, paid: true, accountId: 'checking' },
    { type: 'out', date: '2026-09-30', cents: 9000, paid: false, accountId: 'checking', category: 'Fora do mês' },
  ];
  const summary = monthlyCloseSummary(
    transactions,
    '2026-10',
    (id) => accounts.find((account) => account.id === id),
  );

  equal(summary.resultCents, 3750);
  equal(summary.inPaid, 10000);
  equal(summary.outPaid, 4500);
  equal(summary.pendingInCents, 0);
  equal(summary.pendingOutCents, 1000);
  equal(summary.recurringCents, 3000);
  equal(summary.recurringCount, 2);
  equal(summary.cardOut, 750);
  equal(summary.topExpense.join(':'), 'Moradia:3000');
});

test('limites financeiros separam despesas pela data do lançamento em centavos', () => {
  const totals = expenseBudgetByCategory([
    { type: 'out', date: '2026-10-10', cents: 1234, paid: false, category: 'Mercado' },
    { type: 'out', date: '2026-10-15', cents: 200, paid: true, category: 'Mercado' },
    { type: 'out', date: '2026-10-16', cents: 567, paid: false, category: 'Mercado' },
    { type: 'out', date: '2026-10-31', cents: 890, paid: false, category: 'Moradia' },
    { type: 'in', date: '2026-10-12', cents: 1000, category: 'Mercado' },
    { type: 'tr', date: '2026-10-12', cents: 500, category: 'Mercado' },
    { type: 'out', date: '2026-09-30', cents: 9000, category: 'Fora do mês' },
  ], '2026-10', '2026-10-15');

  equal(totals.total.map(([category, cents]) => `${category}:${cents}`).join(','), 'Mercado:2001,Moradia:890');
  equal(totals.throughToday.map(([category, cents]) => `${category}:${cents}`).join(','), 'Mercado:1434');
  equal(totals.afterToday.map(([category, cents]) => `${category}:${cents}`).join(','), 'Moradia:890,Mercado:567');
});

test('notificações incluem apenas contas fixas pendentes com vencimento hoje', () => {
  const transactions = [
    { id: 'due', type: 'out', recId: 'rent', date: '2026-10-26', paid: false, createdAt: 2 },
    { id: 'paid', type: 'out', recId: 'streaming', date: '2026-10-26', paid: true },
    { id: 'income', type: 'in', recId: 'salary', date: '2026-10-26', paid: false },
    { id: 'regular', type: 'out', date: '2026-10-26', paid: false },
    { id: 'later', type: 'out', recId: 'rent', date: '2026-10-27', paid: false },
  ];

  equal(recurringBillsDueOn(transactions, '2026-10-26').map((transaction) => transaction.id).join(','), 'due');
});

test('validateFinanceReferences rejeita referencias financeiras invalidas', () => {
  const finance = {
    accounts: [{ id: 'a' }, { id: 'b' }],
    tx: [
      { id: 'ok', type: 'out', accountId: 'a' },
      { id: 'missing-source', type: 'out', accountId: 'missing' },
      { id: 'missing-destination', type: 'tr', accountId: 'a', toAccountId: 'missing' },
      { id: 'same-account', type: 'tr', accountId: 'a', toAccountId: 'a' }
    ],
    recurring: [
      { id: 'valid-recurring', accountId: 'b' },
      { id: 'missing-recurring', accountId: 'missing' }
    ]
  };

  const result = validateFinanceReferences(finance);

  equal(result.invalidCount, 4);
  equal(result.value.tx.length, 1);
  equal(result.value.recurring.length, 1);

  // A validacao nao deve modificar o objeto recebido.
  equal(finance.tx.length, 4);
  equal(finance.recurring.length, 2);
});

test('validateFinanceReferences preserva referencias financeiras validas', () => {
  const finance = {
    accounts: [{ id: 'a' }, { id: 'b' }],
    tx: [
      { id: 'expense', type: 'out', accountId: 'a' },
      { id: 'transfer', type: 'tr', accountId: 'a', toAccountId: 'b' }
    ],
    recurring: [{ id: 'monthly', accountId: 'b' }]
  };

  const result = validateFinanceReferences(finance);

  equal(result.invalidCount, 0);
  equal(result.value.tx.length, 2);
  equal(result.value.recurring.length, 1);
});

/* ---- Recorrência de tarefas ---- */
test('recorrência mensal respeita o último dia do mês, inclusive em ano bissexto', () => {
  equal(nextDue('2026-01-31', 'month'), '2026-02-28');
  equal(nextDue('2024-01-31', 'month'), '2024-02-29');
  equal(nextDue('2024-02-29', 'year'), '2025-02-28');
});

test('recorrência diária, semanal e em dias úteis', () => {
  equal(nextDue('2026-10-23', 'day'), '2026-10-24');
  equal(nextDue('2026-10-23', 'week'), '2026-10-30');
  equal(nextDue('2026-10-23', 'weekday'), '2026-10-26');
  equal(nextDue('2026-10-26', 'weekday'), '2026-10-27');
});

/* ---- Hábitos ---- */
const habitBase = { id: 'h1', name: 'Ler', days: [0, 1, 2, 3, 4, 5, 6], completions: [] };

test('hábito aceita meta semanal de 1 a 7 e continua válido sem ela', () => {
  truthy(isValidHabit(habitBase));
  truthy(isValidHabit({ ...habitBase, weeklyGoal: 3 }));
  falsy(isValidHabit({ ...habitBase, weeklyGoal: 0 }));
  falsy(isValidHabit({ ...habitBase, weeklyGoal: 8 }));
  falsy(isValidHabit({ ...habitBase, weeklyGoal: 2.5 }));
});

test('hábitos contam dias programados somente a partir da criação conhecida', () => {
  const createdAt = new Date(2026, 10, 18, 12).getTime();
  const habit = { ...habitBase, createdAt };
  equal(habitCreatedOn(habit), '2026-11-18');
  equal(habitStartedOnOrBefore(habit, '2026-11-17'), false);
  equal(habitStartedOnOrBefore(habit, '2026-11-18'), true);
  truthy(isValidHabit({ ...habit, createdAt }));
  falsy(isValidHabit({ ...habit, createdAt: Number.MAX_VALUE }));
  equal(isValidHabitCreatedAt(Number.MAX_VALUE), false);

  const before = habitDayOverview([habit], '2026-11-17');
  equal(before.planned, 0);
  const firstDay = habitDayOverview([habit], '2026-11-18');
  equal(firstDay.planned, 1);
  const isComplete = (item, day) => item.completions.includes(day);
  const isSkipped = (item, day) => habitIsSkipped(item, day, '2026-11-18');
  const week = habitWeekOverview([habit], '2026-11-18', 1, isComplete, isSkipped);
  equal(week.planned, 1);
  const month = habitMonthStats(habit, '2026-11', '2026-11-18');
  equal(month.scheduled, 1);
  const review = weeklyReview([], [habit], '2026-11-18', 1);
  equal(review.habits.scheduled, 1);

  equal(habitWeekOverview([habitBase], '2026-11-18', 1, isComplete, isSkipped).planned, 3);
});

test('meta semanal nunca passa do número de dias escolhidos', () => {
  equal(habitWeeklyTarget({ ...habitBase, days: [1, 3], weeklyGoal: 5 }), 2);
  equal(habitWeeklyTarget({ ...habitBase, weeklyGoal: 3 }), 3);
  equal(habitWeeklyTarget(habitBase), null);
});

test('revisão semanal resume somente dias programados até hoje e ignora dias pulados e pausados', () => {
  const habit = {
    ...habitBase,
    days: [1, 2, 3, 4],
    weeklyGoal: 2,
    completions: ['2026-10-19', '2026-10-22'],
    skipped: ['2026-10-20'],
  };
  const paused = { ...habitBase, id: 'h2', status: 'paused', days: [1, 2, 3] };
  const review = habitWeekReview(
    [habit, paused],
    '2026-10-21',
    1,
    (item, day) => item.completions.includes(day),
    (item, day) => habitIsSkipped(item, day, '2026-10-21'),
  );
  equal(review.length, 1);
  equal(review[0].completed, 1);
  equal(review[0].planned, 2);
  equal(review[0].weeklyTarget, 2);
  equal(review[0].goalMet, false);
  const metReview = habitWeekReview(
    [{ ...habit, completions: ['2026-10-19', '2026-10-21'] }],
    '2026-10-21',
    1,
    (item, day) => item.completions.includes(day),
    (item, day) => habitIsSkipped(item, day, '2026-10-21'),
  );
  equal(metReview[0].completed, 2);
  equal(metReview[0].goalMet, true);
});

test('estatísticas de hábito com meta semanal contam semanas seguidas', () => {
  const habit = { ...habitBase, weeklyGoal: 3, completions: ['2026-10-19', '2026-10-20', '2026-10-21'] };
  const stats = habitStats(habit, '2026-10-21', 1);
  equal(stats.completedThisWeek, 3);
  equal(stats.goalMet, true);
  equal(stats.weeklyStreak, 1);
  const harder = habitStats({ ...habit, weeklyGoal: 4 }, '2026-10-21', 1);
  equal(harder.goalMet, false);
  equal(harder.weeklyStreak, 0);
});

test('estatísticas de hábito sem meta mantêm a sequência diária', () => {
  const habit = { ...habitBase, completions: ['2026-10-19', '2026-10-20', '2026-10-21'] };
  const stats = habitStats(habit, '2026-10-21', 1);
  equal(stats.streak, 3);
  equal(stats.weeklyTarget, null);
  equal(stats.weeklyStreak, null);
});

test('meta de água explícita prevalece e nomes antigos são normalizados sem perda da meta', () => {
  const legacy = { ...habitBase, name: 'Beber água · 3.850 mL/dia', tracking: 'water' };
  const normalized = normalizeHabits([legacy]);
  equal(normalized.rejectedCount, 0);
  equal(normalized.records[0].name, 'Beber água');
  equal(normalized.records[0].waterGoalMl, 3850);
  equal(waterGoalForHabit({ ...normalized.records[0], waterGoalMl: 2600 }), 2600);
  equal(normalizeWaterHabit({ ...legacy, waterGoalMl: 2700 }).waterGoalMl, 2700);
  equal(waterGoalForHabit({ name: 'Beber água', tracking: 'water' }, 2800), 2800);
  equal(isValidWaterGoalMl(500), true);
  equal(isValidWaterGoalMl(10001), false);
  falsy(isValidHabit({ ...habitBase, waterGoalMl: 499 }));
});

test('panorama semanal conta somente dias programados até hoje e oferece pausados', () => {
  const active = {
    ...habitBase,
    days: [1, 2, 3],
    completions: ['2026-10-19'],
    skipped: ['2026-10-20'],
  };
  const paused = { ...habitBase, id: 'h2', status: 'paused', days: [1, 2, 3] };
  const overview = habitWeekOverview(
    [active, paused],
    '2026-10-21',
    1,
    (habit, day) => habit.completions.includes(day),
    (habit, day) => habitIsSkipped(habit, day, '2026-10-21'),
  );
  equal(overview.planned, 2);
  equal(overview.completed, 1);
  equal(overview.paused.length, 1);
});

test('panorama diário exclui pulos da meta e ignora hábitos pausados', () => {
  const completed = { ...habitBase, completions: ['2026-10-21'] };
  const skipped = { ...habitBase, id: 'h2', skipped: ['2026-10-21'] };
  const paused = { ...habitBase, id: 'h3', status: 'paused' };
  const overview = habitDayOverview(
    [completed, skipped, paused],
    '2026-10-21',
    (habit, day) => habit.completions.includes(day),
    (habit, day) => habitIsSkipped(habit, day, '2026-10-21'),
  );
  equal(overview.scheduled.length, 2);
  equal(overview.completed, 1);
  equal(overview.planned, 1);
  equal(overview.skipped, 1);
  equal(habitDayOverview([completed], 'not-a-day').planned, 0);
});

test('progresso diário dos hábitos segue a semana preferida e ignora dias pulados', () => {
  const habits = [
    { ...habitBase, id: 'h1', days: [1, 3, 4], completions: ['2026-10-19', '2026-10-21'] },
    { ...habitBase, id: 'h2', days: [3], completions: [] },
    { ...habitBase, id: 'h3', days: [3], completions: [], skipped: ['2026-10-21'] },
  ];
  const week = habitWeekDailyProgress(
    habits,
    '2026-10-21',
    1,
    (habit, day) => habit.completions.includes(day),
    (habit, day) => habitIsSkipped(habit, day, '2026-10-21'),
  );
  equal(week.length, 7);
  equal(week[0].day, '2026-10-19');
  equal(week[0].progress, 1);
  equal(week[2].planned, 2);
  equal(week[2].completed, 1);
  equal(week[2].progress, 0.5);
  equal(week[3].progress, 0);
  const sundayStart = habitWeekDailyProgress(habits, '2026-10-21', 0);
  equal(sundayStart[0].day, '2026-10-18');
  equal(sundayStart[1].day, '2026-10-19');
});

test('pular um dia exclui a data das metas e não interrompe sequência', () => {
  const habit = {
    ...habitBase,
    weeklyGoal: 2,
    completions: ['2026-10-19', '2026-10-21'],
    skipped: ['2026-10-20'],
  };
  const stats = habitStats(habit, '2026-10-21', 1);
  equal(habitIsSkipped(habit, '2026-10-20', '2026-10-21'), true);
  equal(stats.completedThisWeek, 2);
  equal(stats.goalMet, true);
  equal(stats.weeklyStreak, 1);
  equal(stats.streak, 2);
});

test('pausa ativa neutraliza dias programados desde o início da pausa', () => {
  const habit = {
    ...habitBase,
    status: 'paused',
    pausedFrom: '2026-10-20',
    completions: ['2026-10-19'],
  };
  const stats = habitStats(habit, '2026-10-21', 1);
  equal(habitIsSkipped(habit, '2026-10-20', '2026-10-21'), true);
  equal(stats.scheduledThisWeek, 5);
  equal(stats.streak, 1);
});

test('revisão semanal não inclui dias pulados na taxa de hábitos', () => {
  const habit = { ...habitBase, completions: ['2026-10-19'], skipped: ['2026-10-20'] };
  const review = weeklyReview(
    [],
    [habit],
    '2026-10-21',
    1,
    (item, day) => item.completions.includes(day),
    (item, day) => habitIsSkipped(item, day, '2026-10-21'),
  );
  equal(review.habits.scheduled, 2);
  equal(review.habits.completed, 1);
});

test('resumo semanal conta metas de água e hábitos em dia somente até hoje', () => {
  const habits = [
    { ...habitBase, id: 'on-track', completions: ['2026-10-19', '2026-10-20', '2026-10-21'] },
    { ...habitBase, id: 'behind', completions: ['2026-10-19'] },
    { ...habitBase, id: 'paused', status: 'paused', completions: ['2026-10-19'] },
  ];
  const review = weeklyReview(
    [
      { done: true, dueDate: '2026-10-19', doneAt: '2026-10-18T12:00:00.000Z' },
      { done: false, dueDate: '2026-10-20' },
      { done: true, dueDate: '2026-10-25', doneAt: '2026-10-21T12:00:00.000Z' },
      { done: true, dueDate: '2026-10-20' },
    ],
    habits,
    '2026-10-21',
    1,
    (habit, day) => habit.completions.includes(day),
    () => false,
    (day) => day === '2026-10-20' || day === '2026-10-21',
  );
  equal(review.tasks.completed, 2);
  equal(review.waterDays, 2);
  equal(review.habits.count, 2);
  equal(review.habits.onTrack, 1);
});

test('sugestão de água cria um hábito comum e evita duplicatas', () => {
  let count = 0;
  const created = createSuggestedHabits(['reading', 'water'], [{ ...habitBase, name: 'LER POR 10 MINUTOS' }], () => `id-${++count}`);
  equal(created.length, 1);
  equal(created[0].name, 'Beber água');
  equal(created[0].tracking, 'water');
  truthy(isValidHabitCreatedAt(created[0].createdAt));
  const again = createSuggestedHabits(['water'], [{ ...habitBase, id: 'w', name: 'Água', tracking: 'water' }], () => 'x');
  equal(again.length, 0);
  const customized = createSuggestedHabits(['water'], [{ ...habitBase, name: 'Beber água · 3.850 mL/dia' }], () => 'x');
  equal(customized.length, 0);
});

test('hábito de água legado passa a usar check-in comum sem invalidar dados antigos', () => {
  const legacy = { ...habitBase, tracking: 'water', completions: [] };
  ok(isValidHabit(legacy));
  truthy(isWaterHabit(legacy));
  falsy(habitIsComplete(legacy, '2026-10-21'));
  const checked = { ...legacy, tracking: undefined, completions: ['2026-10-21'] };
  truthy(isWaterHabit({ ...checked, name: 'Beber água · 3.850 mL/dia' }));
  truthy(habitIsComplete(checked, '2026-10-21'));
});

test('registros de água aceitam mililitros inteiros e somam somente o dia local', () => {
  equal(parseWaterMl('250'), 250);
  equal(parseWaterMl('0'), null);
  equal(parseWaterMl('250.5'), null);
  equal(parseWaterMl('10001'), null);
  equal(waterGoalFromName('Beber água · 3.800 mL/dia'), 3800);
  equal(waterGoalFromName('Beber água', 2500), 2500);
  equal(waterGoalFromName('Beber água', 100), 2000);
  const entries = [
    { ml: 250, at: '2026-10-29T12:00:00' },
    { ml: 500, at: '2026-10-29T15:00:00' },
    { ml: 1000, at: '2026-10-28T15:00:00' },
  ];
  const todayTotal = waterMlForDay(entries, '2026-10-29');
  equal(todayTotal, 750);
  equal(waterGoalReached(todayTotal, 750), true);
  equal(waterGoalReached(todayTotal, 751), false);
  equal(waterMlForDay([], '2026-02-30'), 0);
});

test('progresso semanal da água compara cada dia com a meta definida', () => {
  const entries = [
    ...['19', '20', '21', '22', '23'].map((day) => ({
      ml: 1000,
      at: `2026-10-${day}T12:00:00`,
    })),
    { ml: 500, at: '2026-10-24T12:00:00' },
  ];
  const week = waterWeekProgress(entries, 1000, '2026-10-21', 1);
  equal(week.length, 7);
  equal(week[0].day, '2026-10-19');
  equal(week.filter(({ goalReached }) => goalReached).length, 5);
  equal(week[5].progress, 0.5);
  equal(week[6].progress, 0);
  equal(waterWeekProgress(entries, 1000, '2026-10-21', 0)[0].day, '2026-10-18');
});

test('hábito aceita ícone e cor opcionais e rejeita valores inválidos', () => {
  ok(isValidHabit(habitBase), 'hábito antigo sem ícone/cor continua válido');
  ok(isValidHabit({ ...habitBase, icon: 'book', color: '#5aa5b8' }));
  ok(isValidHabit({ ...habitBase, skipped: ['2026-10-20'], pausedFrom: '2026-10-21', pausedDays: [1, 3] }));
  ok(!isValidHabit({ ...habitBase, skipped: ['2026-02-30'] }));
  ok(!isValidHabit({ ...habitBase, pausedFrom: '2026-02-30' }));
  ok(!isValidHabit({ ...habitBase, pausedDays: [7] }));
  ok(!isValidHabit({ ...habitBase, color: 'azul' }));
  ok(!isValidHabit({ ...habitBase, color: '#12345' }));
  ok(!isValidHabit({ ...habitBase, icon: 42 }));
  ok(!isValidHabit({ ...habitBase, icon: '<img>' }));
});

test('ícone e cor de exibição têm padrão seguro', () => {
  equal(habitIconKey(habitBase), 'sparkles');
  equal(habitIconKey({ ...habitBase, icon: 'inexistente' }), 'sparkles');
  equal(habitIconKey({ ...habitBase, icon: 'bike' }), 'bike');
  equal(habitIconKey({ ...habitBase, tracking: 'water', icon: 'bike' }), 'bike');
  equal(habitColor(habitBase), HABIT_COLORS[0]);
  equal(habitColor({ ...habitBase, color: '#d6455d' }), '#d6455d');
});

test('catálogo de ideias tem ids únicos, ícones e cores válidos', () => {
  equal(SUGGESTED_HABITS.length, 99);
  equal(new Set(SUGGESTED_HABITS.map((item) => item.id)).size, SUGGESTED_HABITS.length);
  for (const id of ['water', 'reading', 'training', 'pause', 'dental-care', 'active-break', 'study', 'connect', 'mindful-meal', 'make-bed', 'five-minute-tidy', 'plan-rest', 'walk-with-dog', 'learn-language', 'weekly-reflection', 'try-new-recipe', 'clear-desk', 'weekly-reset', 'wash-face', 'yoga-at-home', 'brain-dump', 'prepare-lunch', 'check-daily-budget']) {
    ok(SUGGESTED_HABITS.some((item) => item.id === id), id);
  }
  ok(SUGGESTED_HABIT_CATEGORIES.some((category) => category.title === 'Cuidados pessoais'));
  ok(SUGGESTED_HABIT_CATEGORIES.some((category) => category.title === 'Cuidados com a mente'));
  ok(SUGGESTED_HABITS.some((item) => item.id === 'skincare' && item.category === 'personal-care'));
  ok(SUGGESTED_HABITS.some((item) => item.id === 'gym' && item.category === 'movement'));
  for (const item of SUGGESTED_HABITS) {
    ok(SUGGESTED_HABIT_CATEGORIES.some(({ id }) => id === item.category), `categoria de ${item.id}`);
    ok(HABIT_ICON_KEYS.includes(item.icon), `ícone de ${item.id}`);
    ok(HABIT_COLORS.includes(item.color), `cor de ${item.id}`);
    const tags = habitSuggestionTags(item);
    ok(tags.length > 0, `ao menos um contexto para ${item.id}`);
    for (const tag of tags) ok(SUGGESTED_HABIT_TAGS.some(({ id }) => id === tag.id), `tag ${tag.id} de ${item.id}`);
  }
  const featured = featuredHabitSuggestions(SUGGESTED_HABITS);
  equal(featured.map(({ id }) => id).join(','), 'water,stretch,reading,fruit');
  equal(new Set(featured.map(({ category }) => category)).size, 4);
  const fallback = featuredHabitSuggestions(SUGGESTED_HABITS.filter(({ id }) => !['water', 'stretch', 'reading', 'fruit'].includes(id)));
  equal(fallback.length, 4);
  equal(new Set(fallback.map(({ category }) => category)).size, 4);
  const created = createSuggestedHabits(['sleep'], [], () => 'n1');
  equal(created[0].icon, 'moon');
  ok(isValidHabit(created[0]));
});

test('ideias de hábitos filtram por categoria e contexto', () => {
  const movement = filterSuggestedHabits(SUGGESTED_HABITS, 'movement');
  ok(movement.length > 0);
  ok(movement.every((idea) => idea.category === 'movement'));
  const quick = filterSuggestedHabits(SUGGESTED_HABITS, 'all', 'quick');
  ok(quick.length > 0);
  ok(quick.every((idea) => habitSuggestionTags(idea).some(({ id }) => id === 'quick')));
  const movementWithoutEquipment = filterSuggestedHabits(SUGGESTED_HABITS, 'movement', 'no-equipment');
  ok(movementWithoutEquipment.length > 0);
  ok(movementWithoutEquipment.every((idea) => idea.category === 'movement'
    && habitSuggestionTags(idea).some(({ id }) => id === 'no-equipment')));
});

test('ideias de hábitos também podem ser buscadas por texto sem diferenciar acentos', () => {
  const matchingIdeas = filterSuggestedHabits(SUGGESTED_HABITS, 'all', 'all', 'saude bucal');
  ok(matchingIdeas.some(({ id }) => id === 'dental-care'));
  ok(filterSuggestedHabits(SUGGESTED_HABITS, 'movement', 'all', 'idioma').length === 0);
});

test('ideias de hábitos omitem hábitos já existentes sem diferenciar acentos e água', () => {
  const remaining = remainingHabitSuggestions([
    { name: 'LER POR 10 MINUTOS', status: 'archived' },
    { name: 'Hidratação personalizada', tracking: 'water' },
  ]);
  ok(!remaining.some((idea) => idea.id === 'reading'));
  ok(!remaining.some((idea) => idea.id === 'water'));
  ok(remaining.some((idea) => idea.id === 'sleep'));
});

/* ---- Paletas de cor ---- */
const contrastOnWhite = (hex) => 1.05 / (lum(hex) + .05);

test('o tema padrão do Aurora é claro', () => {
  equal(LOOK_DEFAULT.mode, 'light');
});

test('a tela inicial acompanha o tema do sistema até a aparência da conta carregar', () => {
  const attributes = {};
  const root = {
    style: {},
    setAttribute(name, value) { attributes[name] = value; },
    removeAttribute(name) { delete attributes[name]; },
  };
  const systemTheme = {
    matches: true,
    addEventListener(_name, listener) { this.listener = listener; },
  };
  const browserWindow = {
    matchMedia: () => systemTheme,
    addEventListener() {},
  };
  let manifestHref = 'https://aurora.test/manifest.webmanifest';
  const manifest = {
    get href() { return manifestHref; },
    set href(value) { manifestHref = String(value); },
  };
  const statusBar = {};
  const source = readFileSync(new URL('../public/loading-appearance.js', import.meta.url), 'utf8');

  runInNewContext(source, {
    URL,
    setTimeout(callback) { callback(); },
    window: browserWindow,
    document: {
      documentElement: root,
      querySelector(selector) {
        if (selector === 'link[rel="manifest"]') return manifest;
        if (selector === 'meta[name="apple-mobile-web-app-status-bar-style"]') return statusBar;
        return null;
      },
    },
  });

  equal(attributes['data-theme'], undefined);
  equal(root.style.colorScheme, 'dark');
  equal(root.style.backgroundColor, '#1c1b19');
  equal(manifestHref, 'https://aurora.test/manifest-dark.webmanifest');

  browserWindow.auroraManifestTheme.setMode('light');
  equal(attributes['data-theme'], 'light');
  equal(root.style.backgroundColor, '#faf8f5');
  equal(manifestHref, 'https://aurora.test/manifest-light.webmanifest');

  browserWindow.auroraManifestTheme.setMode('auto');
  systemTheme.matches = false;
  systemTheme.listener();
  equal(attributes['data-theme'], undefined);
  equal(root.style.colorScheme, 'light');
});

test('a paleta Rosé acompanha as cores do gradiente da logo', () => {
  const logo = readFileSync(new URL('../icons/favicon.svg', import.meta.url), 'utf8');
  const logoColors = [...logo.matchAll(/stop-color="(#[0-9a-f]{6})"/gi)].map((match) => match[1].toLowerCase());
  equal(PALETTES.rose[0], 'Rosé');
  equal(PALETTES.rose[1], logoColors[0]);
  equal(PALETTES.rose[2], logoColors[1]);
  truthy(PROFILE_AVATAR_COLORS.some(([id, label]) => id === 'rose' && label === PALETTES.rose[0]));
});

test('toda paleta nomeada gera cor de destaque com contraste mínimo 4,5 contra branco', () => {
  Object.keys(PALETTES).forEach((name) => {
    const [, dark] = paletteColors(name, LOOK_DEFAULT);
    truthy(contrastOnWhite(dark) >= 4.5);
  });
});

test('cor personalizada inválida volta ao padrão e válida é escurecida até ter contraste', () => {
  equal(paletteColors('custom', { custom: 'azul' })[0], LOOK_DEFAULT.custom);
  const [base, dark] = paletteColors('custom', { custom: '#ffd23f' });
  equal(base, '#ffd23f');
  truthy(contrastOnWhite(dark) >= 4.5);
  equal(hexOk('#12abEF'), true);
  equal(hexOk('#12abE'), false);
  equal(darkenFor('#000000'), '#000000');
});

test('presets de aparência apontam para paletas e opções válidas de leitura', () => {
  truthy(Object.keys(APPEARANCE_PRESETS).length >= 3);
  Object.values(APPEARANCE_PRESETS).forEach((preset) => {
    truthy(Object.hasOwn(PALETTES, preset.theme));
    truthy(['comfy', 'compact'].includes(preset.density));
    truthy(['s', 'm', 'l'].includes(preset.font));
  });
});

test('aparência de perfil valida opções sem descartar preferências futuras', () => {
  equal(JSON.stringify(normalizeProfileAppearance(null)), JSON.stringify(PROFILE_APPEARANCE_DEFAULT));
  equal(JSON.stringify(normalizeProfileAppearance({
    avatar: 'flower',
    avatarColor: 'sage',
    greeting: 'oi',
    futureOption: true,
  })), JSON.stringify({
    avatar: 'flower',
    avatarColor: 'sage',
    greeting: 'oi',
    futureOption: true,
  }));
  const invalid = normalizeProfileAppearance({ avatar: 'missing', avatarColor: '#ffffff', greeting: 'unknown' });
  equal(invalid.avatar, PROFILE_APPEARANCE_DEFAULT.avatar);
  equal(invalid.avatarColor, PROFILE_APPEARANCE_DEFAULT.avatarColor);
  equal(invalid.greeting, PROFILE_APPEARANCE_DEFAULT.greeting);
  truthy(PROFILE_AVATARS.length >= 4);
  truthy(PROFILE_AVATAR_COLORS.length >= 6);
  truthy(PROFILE_GREETING_STYLES.some(([id]) => id === 'dynamic'));
});

test('foto de perfil aceita apenas imagem JPEG dentro do limite salvo', () => {
  const validImage = 'data:image/jpeg;base64,/9j/AAAA';
  truthy(isProfileAvatarImageData(validImage));
  equal(normalizeProfileAppearance({ avatarImage: validImage }).avatarImage, validImage);
  equal(isProfileAvatarImageData('data:image/jpeg;base64,AAAA'), false);
  equal(isProfileAvatarImageData('data:image/svg+xml;base64,PHN2Zz4='), false);
  equal(isProfileAvatarImageData(`data:image/jpeg;base64,${'A'.repeat(Math.ceil((PROFILE_AVATAR_MAX_BYTES + 3) / 3) * 4)}`), false);
  equal(Object.hasOwn(normalizeProfileAppearance({ avatarImage: 'invalid' }), 'avatarImage'), false);
});

test('Ciclo só é acessível para mulheres, exceto na demonstração fictícia', () => {
  equal(canAccessCycle({ sex: '' }), false);
  equal(canAccessCycle({ sex: 'm' }), false);
  equal(canAccessCycle({ sex: 'nb' }), false);
  equal(canAccessCycle({ sex: 'n' }), false);
  equal(canAccessCycle({ sex: 'f' }), true);
  equal(canAccessCycle({ sex: '' }, true), true);
});

test('Home só oferece Ciclo nas áreas opcionais para perfis elegíveis', () => {
  const source = readAppSource();
  const start = source.indexOf('function areaTiles() {');
  const end = source.indexOf('\n}\n', start);
  if (start < 0 || end <= start) throw new Error('Não foi possível localizar as áreas opcionais da Home.');
  const areaTiles = source.slice(start, end);
  if (!areaTiles.includes('canAccessCycle(S.settings.profile, ui.preview)')) {
    throw new Error('A Home não deve oferecer Ciclo para perfis sem acesso à área.');
  }
  const onboardingStart = source.indexOf('function dlgOnboard() {');
  const onboardingEnd = source.indexOf('\nfunction dlgExport()', onboardingStart);
  if (onboardingStart < 0 || onboardingEnd <= onboardingStart) throw new Error('Não foi possível localizar o onboarding.');
  const onboarding = source.slice(onboardingStart, onboardingEnd);
  const flatOnboarding = flatCode(onboarding);
  equal(flatOnboarding.includes(flatCode("ONBOARDING_NEEDS.filter((need) => need.id !== 'cycle' || canAccessCycle(S.settings.profile, ui.preview))")), true);
  equal(flatOnboarding.includes(flatCode("ONBOARDING_AREAS.filter((area) => area.id !== 'cycle' || canAccessCycle(S.settings.profile, ui.preview))")), true);
});

test('progresso dos primeiros passos segue a ordem tarefa, hábito e cor', () => {
  equal(JSON.stringify(homeFirstStepsProgress({ theme: 'rose', tasks: [{}], habits: [] })), '[true,false,false]');
  equal(JSON.stringify(homeFirstStepsProgress({ theme: 'rose', tasks: [], habits: [{ completions: ['2026-11-18'] }] })), '[false,true,false]');
  equal(JSON.stringify(homeFirstStepsProgress({ theme: 'indigo', tasks: [], habits: [] })), '[false,false,true]');
});

test('preferências do Início normalizam modos, layouts, atalhos, mensagem e cores', () => {
  equal(JSON.stringify(normalizeHomeLayout({ order: ['quick', 'invalid'], visible: ['today', 'today', 'invalid'] })), JSON.stringify({
    order: ['today', 'quick', 'habits', 'summary'],
    visible: ['today'],
  }));
  equal(JSON.stringify(normalizeHomeLayout(null)), JSON.stringify(defaultHomeLayout()));
  equal(JSON.stringify(normalizeHomeShortcuts(['task', 'missing', 'task'])), JSON.stringify(['task']));
  equal(JSON.stringify(normalizeHomeShortcuts(null)), JSON.stringify(defaultHomeShortcuts()));
  equal(normalizeHomeMode('focus'), 'focus');
  equal(normalizeHomeMode('invalid'), 'overview');
  equal(JSON.stringify(Object.keys(normalizeHomeModes(null))), JSON.stringify(Object.keys(HOME_MODES)));
  equal(JSON.stringify(normalizeHomeModes({
    focus: {
      layout: { order: ['quick'], visible: ['quick'] },
      shortcuts: ['habit', 'invalid', 'habit'],
    },
  }).focus), JSON.stringify({
    layout: { order: ['today', 'quick', 'habits', 'summary'], visible: ['quick'] },
    shortcuts: ['habit'],
  }));
  equal(normalizeHomeMessage(`  mensagem ${'x'.repeat(HOME_MESSAGE_MAX_LENGTH)}  `), `mensagem ${'x'.repeat(HOME_MESSAGE_MAX_LENGTH - 9)}`);
  equal(normalizeHomeMessage(null), '');
  equal(JSON.stringify(homeFirstStepsProgress({
    theme: 'rose',
    tasks: [],
    habits: [{ completions: [] }, { completions: ['2026-10-20'] }],
  })), JSON.stringify([false, true, false]));
  equal(JSON.stringify(homeFirstStepsProgress({
    theme: 'coral',
    tasks: [{ id: 'task', done: true }],
    habits: [{ completions: [] }],
  })), JSON.stringify([true, false, true]));
  equal(JSON.stringify(homeFirstStepsProgress(null)), JSON.stringify([false, false, false]));
  equal(JSON.stringify(normalizeHomeAreaColors({ planning: 'coral', water: '#ffffff', unknown: 'rose' })), JSON.stringify({ planning: 'coral' }));
  truthy(HOME_AREA_COLORS.length >= 5);
});

test('cores escolhidas para áreas mantêm contraste nos temas claro e escuro', () => {
  const luminance = (hex) => lum(hex);
  const ratio = (foreground, background) => {
    const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
    return (values[0] + 0.05) / (values[1] + 0.05);
  };
  Object.keys(PALETTES).forEach((paletteId) => {
    ok(ratio(homeAreaColorValue(paletteId, 'light'), '#ffffff') >= 4.5, `${paletteId} em tema claro`);
    ok(ratio(homeAreaColorValue(paletteId, 'dark'), '#17151b') >= 4.5, `${paletteId} em tema escuro`);
  });
});

const failures = results.filter((result) => !result.passed);
if (typeof document !== 'undefined') {
  const summary = document.querySelector('#summary');
  const list = document.querySelector('#results');
  summary.textContent = `${results.length - failures.length}/${results.length} testes passaram.`;
  summary.className = failures.length ? 'fail' : 'pass';

  results.forEach((result) => {
    const item = document.createElement('li');
    item.className = result.passed ? 'pass' : 'fail';
    item.textContent = result.passed
      ? `OK — ${result.name}`
      : `FALHOU — ${result.name}: ${result.message}`;
    list.append(item);
  });
} else {
  failures.forEach((result) => console.error(`FALHOU — ${result.name}: ${result.message}`));
  console.log(`${results.length - failures.length}/${results.length} testes passaram.`);
  if (failures.length) process.exitCode = 1;
}
