
import { readFileSync } from 'node:fs';
import { filterValidRecords, isPlainObject, validateFinanceReferences } from '../src/js/core/data-integrity.js';
import { formatMoneyInput, parseMoney } from '../src/js/utils/currency.js';
import { addDays, addMonths, isDay, normalizeDay } from '../src/js/utils/dates.js';
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
import { nextDue } from '../src/js/features/planning/recurrence.js';
import { parseQuickDate } from '../src/js/features/planning/quick-date.js';
import { buildTaskPushReminders } from '../src/js/features/push/task-reminders.js';
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
} from '../src/js/features/habits/water-goal.js';
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
import { canAccessCycle } from '../src/js/features/cycle/access.js';
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
import {
  BACKUP_ACTIVITY_THRESHOLD,
  BACKUP_REMINDER_DAYS,
  backupReminderStatus,
} from '../src/js/features/backup/reminder.js';
import { renderLanding } from '../src/js/features/landing/view.js';
import { createToastController } from '../src/js/features/feedback/toast.js';
import { IC, ICON_SIZES, icon, iconSvg } from '../src/js/utils/icons.js';

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
    || select('concluidas', '', 'recentes') !== 'Antiga,Feita'
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
      goals: [{ id: 'goal-1', title: 'Viajar', action: 'Pesquisar destinos', quarter: 'q2', done: false, customField: true }],
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
  const source = readFileSync(new URL('../src/js/main.js', import.meta.url), 'utf8');
  const start = source.indexOf('async function continueAuthenticatedAurora(');
  const end = source.indexOf('\nexport async function startAuthenticatedAurora', start);
  if (start < 0 || end <= start) throw new Error('Não foi possível localizar a inicialização dos dados autenticados.');
  const startup = source.slice(start, end);
  const timer = startup.indexOf('setInterval(tick, 1000)');
  const serviceWorker = startup.indexOf('await registerPwaSupport()');
  if (timer < 0 || serviceWorker <= timer) throw new Error('O timer precisa iniciar antes do service worker.');
});

test('falha ao carregar dados oferece tentar novamente e sair', () => {
  const source = readFileSync(new URL('../src/js/main.js', import.meta.url), 'utf8');
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

test('confirmações nativas foram substituídas e o feedback de persistência não exibe horários salvos', () => {
  const source = readFileSync(new URL('../src/js/main.js', import.meta.url), 'utf8');
  if (source.includes('window.confirm')) throw new Error('Ainda há confirmação nativa no app.');
  if (source.includes('Salvo às')
    || !source.includes('Salvando…')
    || !source.includes('Falha ao salvar; tente novamente')
    || !source.includes('Alterações feitas offline não serão salvas')) {
    throw new Error('O shell não deve exibir horários de salvamento e deve manter avisos de erro e conexão.');
  }
});

test('landing comunica valor, demonstração e privacidade financeira com precisão', () => {
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
  if (documentStub.title !== 'aurora. — tarefas, hábitos, foco, ciclo e finanças') {
    throw new Error('A landing deve atualizar o título da aba.');
  }
  const entryHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const expectedContent = [
    'Menos ruído. Mais clareza no dia',
    'Um planner independente para a vida real',
    'Feito para a vida como ela é',
    'momentos de foco',
    'Criar conta',
    'Explorar demonstração',
    'Abrir demonstração',
    'Grátis e sem cadastro.',
    'Tarefas, hábitos, foco, ciclo e finanças no seu ritmo.',
    'totalmente grátis',
    'Feito por uma pessoa só, com cuidado',
    'preview-area-cycle',
    'Ciclo',
    'Escolha por onde começar',
    'Posso experimentar sem criar conta?',
    'data-footer-suggestion',
    'Leve sua rotina com você',
    'Adicione o Aurora à tela inicial do celular',
    'O Aurora não se conecta a bancos',
    'href="/privacy.html"',
    'Acompanhe datas e sintomas com seu consentimento específico',
  ];
  expectedContent.forEach((text) => {
    if (!root.innerHTML.includes(text)) throw new Error(`Conteúdo ausente na landing: ${text}`);
  });
  const structuredData = [...entryHtml.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .flatMap((match) => JSON.parse(match[1]));
  const softwareApplication = structuredData.find((item) => item['@type'] === 'SoftwareApplication');
  const landingFaq = structuredData.find((item) => item['@type'] === 'FAQPage');
  const faqNames = landingFaq?.mainEntity?.map((question) => question.name) || [];
  if (!/tarefas.*hábitos.*foco.*ciclo.*finanças/i.test(softwareApplication?.description || '')
    || faqNames.length !== 5
    || !faqNames.every((name) => root.innerHTML.includes(name))) {
    throw new Error('Metadados e FAQ estruturado devem acompanhar as áreas e perguntas atuais da landing.');
  }
  if (root.innerHTML.includes('public-hero-support')
    || root.innerHTML.includes('Veja como Planejar, Hábitos, Finanças e Ciclo se encaixam')) {
    throw new Error('A landing não deve repetir benefícios que já aparecem no título e nos cartões das áreas.');
  }
  if (root.innerHTML.indexOf('class="public-maker"') > root.innerHTML.indexOf('class="public-features"')) {
    throw new Error('A autoria deve aparecer antes da apresentação detalhada das áreas.');
  }
  if (root.innerHTML.includes('É o dado mais sensível do app')) {
    throw new Error('O aviso de privacidade não deve aparecer no cartão Ciclo da landing.');
  }
  if (root.innerHTML.includes('Na demonstração, tarefas, hábitos e Pomodoro')) {
    throw new Error('O aviso sobre dados fictícios da demonstração não deve aparecer no hero da landing.');
  }
  if (root.innerHTML.includes('public-testimonial')
    || root.innerHTML.includes('profissional e mãe')
    || root.innerHTML.includes('estudante e freelancer')
    || root.innerHTML.includes('gestora de rotina')) {
    throw new Error('A landing não deve apresentar depoimentos ou perfis fictícios como prova social.');
  }
  if (root.innerHTML.includes('não são criptografados')
    || root.innerHTML.includes('Preciso confirmar meu e-mail?')
    || root.innerHTML.includes('O que acontece sem conexão?')) {
    throw new Error('Detalhes de segurança, conta e conectividade devem ficar na Política de Privacidade e no próprio app.');
  }
  if (root.innerHTML.includes('Sem cobrança') || root.innerHTML.includes('Privacidade</strong>')) {
    throw new Error('A landing não deve prometer condições de cobrança ou privacidade sem especificá-las.');
  }
  const heroStart = root.innerHTML.indexOf('class="public-hero');
  const heroEnd = root.innerHTML.indexOf('</section>', heroStart);
  const heroMarkup = root.innerHTML.slice(heroStart, heroEnd);
  if (!heroMarkup.includes('href="/demonstracao"')
    || heroMarkup.includes('data-public-action="signup"')
    || heroMarkup.includes('data-public-action="login"')) {
    throw new Error('O hero deve convidar a experimentar o produto sem repetir ações de conta.');
  }
  if (root.innerHTML.includes('public-onboarding')) {
    throw new Error('A landing não deve repetir a apresentação das áreas com uma seção de onboarding separada.');
  }
  const landingTitle = 'aurora. — tarefas, hábitos, foco, ciclo e finanças';
  if (!entryHtml.includes(`<title>${landingTitle}</title>`)
    || !entryHtml.includes(`property="og:title" content="${landingTitle}"`)
    || !entryHtml.includes(`name="twitter:title" content="${landingTitle}"`)
    || landingTitle.length > 60) {
    throw new Error('Os metadados de busca e compartilhamento precisam acompanhar a promessa atual da landing.');
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
  ok(parseQuickDate('Revisar amanhã 25h', '2026-11-10').error);
  ok(parseQuickDate('Revisar hoje sexta', '2026-11-10').error);
});

test('Push de tarefas envia apenas horários futuros sem título e limita o lote', () => {
  const now = new Date(2026, 10, 26, 10, 0).getTime();
  const reminders = buildTaskPushReminders([
    { title: 'Tarefa privada posterior', dueDate: '2026-11-27', time: '12:00', remind: 10 },
    { title: 'Outra tarefa privada', dueDate: '2026-11-27', time: '11:30', remind: 30 },
    { title: 'Tarefa vencida', dueDate: '2026-11-26', time: '09:00', remind: 0 },
    { title: 'Tarefa concluída', done: true, dueDate: '2026-11-27', time: '13:00', remind: 0 },
  ], now);
  equal(JSON.stringify(reminders.map(({ id }) => id)), JSON.stringify(['task-1', 'task-0']));
  ok(reminders.every((reminder) => Object.keys(reminder).sort().join(',') === 'at,id'));
  equal(JSON.stringify(reminders).includes('privada'), false);
  const manyTasks = Array.from({ length: 101 }, (_, index) => ({
    dueDate: '2026-11-27', time: '12:00', remind: 0, title: `Privada ${index}`,
  }));
  equal(buildTaskPushReminders(manyTasks, now).length, 100);
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
    ok(guide.fallbackVideo.endsWith('.webm'));
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

test('lembrete de backup considera prazo e volume de registros desde o último backup', () => {
  const day = 86_400_000;
  const now = 40 * day;
  equal(backupReminderStatus({ activityAt: [], now }), null);
  equal(backupReminderStatus({ activityAt: [now - 13 * day], now }), null);
  equal(backupReminderStatus({ activityAt: [now - 14 * day], now }).days, BACKUP_REMINDER_DAYS);

  const activityAt = Array.from({ length: BACKUP_ACTIVITY_THRESHOLD }, (_, index) => now - index);
  const byActivity = backupReminderStatus({ lastBackupAt: now - day, activityAt, now });
  equal(byActivity.byActivity, true);
  equal(byActivity.activities, BACKUP_ACTIVITY_THRESHOLD);

  const recentBackup = backupReminderStatus({
    lastBackupAt: now - day,
    activityAt: [now - 2 * day],
    now,
  });
  equal(recentBackup, null);
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
  const source = readFileSync(new URL('../src/js/main.js', import.meta.url), 'utf8');
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
  equal(routePathFor('perfil'), '/config');
  equal(routePathFor('config?section=calendars'), '/config?section=calendars');
  equal(routeFromLocation(new URL('https://aurora.local/financas'), routes).route, 'financas');
  equal(routeFromLocation(new URL('https://aurora.local/pomodoro'), routes).route, 'inicio');
  equal(routeFromLocation(new URL('https://aurora.local/pomodoro'), routes).replacePath, '/inicio');
  equal(routeFromLocation(new URL('https://aurora.local/pages/inicio.html#main'), routes).replacePath, '/inicio#main');
  equal(routeFromLocation(new URL('https://aurora.local/#agua'), routes).replacePath, '/habitos');
  equal(routeFromLocation(new URL('https://aurora.local/#config?section=data'), routes).replacePath, '/config?section=data');
  equal(routeFromLocation(new URL('https://aurora.local/?source=pwa#config?section=data'), routes).replacePath, '/config?source=pwa&section=data');
  equal(routeFromLocation(new URL('https://aurora.local/agua'), routes).route, 'habitos');
  equal(canonicalPublicPath(new URL('https://aurora.local/#inicio')), '/inicio');
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
    '/config?source=pwa',
  );
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

test('sugestão de água cria um hábito comum e evita duplicatas', () => {
  let count = 0;
  const created = createSuggestedHabits(['reading', 'water'], [{ ...habitBase, name: 'LER POR 10 MINUTOS' }], () => `id-${++count}`);
  equal(created.length, 1);
  equal(created[0].name, 'Beber água');
  equal(created[0].tracking, 'water');
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
  equal(SUGGESTED_HABITS.length, 100);
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

test('Ciclo só é acessível para mulheres, exceto na demonstração fictícia', () => {
  equal(canAccessCycle({ sex: '' }), false);
  equal(canAccessCycle({ sex: 'm' }), false);
  equal(canAccessCycle({ sex: 'nb' }), false);
  equal(canAccessCycle({ sex: 'n' }), false);
  equal(canAccessCycle({ sex: 'f' }), true);
  equal(canAccessCycle({ sex: '' }, true), true);
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
