
import { readFileSync } from 'node:fs';
import { filterValidRecords, isPlainObject, validateFinanceReferences } from '../src/js/core/data-integrity.js';
import { runStorageTransaction } from '../src/js/core/backup-transaction.js';
import { formatMoneyInput, parseMoney } from '../src/js/utils/currency.js';
import { isDay } from '../src/js/utils/dates.js';
import {
  isPublicLandingHash,
  postSignOutPath,
  redirectToPublicLanding,
  resolveRoute,
  settingsRootPath,
} from '../src/js/core/router.js';
import { actionNeedsProfileSetup } from '../src/js/core/access-control.js';
import {
  isValidMenuOrder,
  isValidVisibleMenuItems,
  canMoveMenuItem,
  MENU_ITEMS,
  moveMenuItem,
  normalizeMenuOrder,
  normalizeVisibleMenuItems,
} from '../src/js/features/navigation/menu.js';
import {
  accountBalanceOn,
  accountBalance,
  byCategory as summarizeByCategory,
  monthStats,
  netAccountBalance,
  netAccountBalanceOn,
  reportMonthStats,
  recurringBillsDueOn,
} from '../src/js/features/finance/calculations.js';
import {
  ACCOUNT_TYPES,
  isValidAccountType,
  normalizeAccountType,
} from '../src/js/features/finance/accounts.js';
import { parseStatement } from '../src/js/features/finance/statement.js';
import { parseQuickTaskText } from '../src/js/features/planning/quick-entry.js';
import {
  AREA_GUIDES,
  AREA_GUIDE_IDS,
  FINANCE_PRIVACY_NOTICE,
  isValidAreaTutorialsSeen,
  normalizeAreaTutorialsSeen,
} from '../src/js/features/area-guides.js';

import { LOOK_DEFAULT, PALETTES, darkenFor, hexOk, lum, paletteColors } from '../src/js/features/appearance/palettes.js';
import { nextDue } from '../src/js/features/planning/recurrence.js';
import {
  createSuggestedHabits,
  habitColor,
  habitIconKey,
  habitIsComplete,
  habitIsSkipped,
  isWaterHabit,
  HABIT_COLORS,
  HABIT_ICON_KEYS,
  SUGGESTED_HABITS,
  habitStats,
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
import { weeklyReview } from '../src/js/features/planning/week.js';
import {
  isTrashExpired,
  isValidTrashEntry,
  normalizeTrash,
  trashDaysRemaining,
  TRASH_RETENTION_MS,
} from '../src/js/features/trash/model.js';
import {
  advancePomodoro,
  cyclesPerLongBreak,
  effectivePomodoroSettings,
  longBreakMinutes,
  normalizePomodoroHistory,
  phaseDurationSeconds,
  recentFocusDays,
} from '../src/js/features/pomodoro/pomodoro.js';
import {
  DEFAULT_POMODORO_SOUND_VOLUME,
  playPomodoroChime,
  resumePomodoroAudioContext,
} from '../src/js/features/pomodoro/pomodoro-audio.js';
import { isValidCycleSexualLog } from '../src/js/features/cycle/log.js';
import {
  createCyclePeriod,
  cycleLogDays,
  cyclePeriodDays,
  mergeCycleLogSymptoms,
  MAX_CYCLE_LOG_RANGE_DAYS,
  MAX_CYCLE_PERIOD_DAYS,
} from '../src/js/features/cycle/period.js';
import { createPomodoroSchedule } from '../src/js/services/pomodoro-push.js';
import {
  BACKUP_ACTIVITY_THRESHOLD,
  BACKUP_REMINDER_DAYS,
  backupReminderStatus,
} from '../src/js/features/backup/reminder.js';
import { renderLanding } from '../src/js/features/landing/view.js';

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

test('inicia os alertas antes de aguardar o service worker', () => {
  const source = readFileSync(new URL('../src/js/main.js', import.meta.url), 'utf8');
  const start = source.indexOf('async function continueAuthenticatedAurora(');
  const end = source.indexOf('\nasync function startAuthenticatedAurora', start);
  if (start < 0 || end <= start) throw new Error('Não foi possível localizar a inicialização dos dados autenticados.');
  const startup = source.slice(start, end);
  const timer = startup.indexOf('setInterval(tick, 1000)');
  const serviceWorker = startup.indexOf('await navigator.serviceWorker.ready');
  if (timer < 0 || serviceWorker <= timer) throw new Error('O timer precisa iniciar antes do service worker.');
});

test('falha ao carregar dados oferece tentar novamente e sair', () => {
  const source = readFileSync(new URL('../src/js/main.js', import.meta.url), 'utf8');
  const start = source.indexOf('function showAccountDataLoadError(');
  const end = source.indexOf('\nasync function continueAuthenticatedAurora', start);
  const continuation = source.slice(end, source.indexOf('\nasync function startAuthenticatedAurora', end));
  const screen = source.slice(start, end);
  if (start < 0 || end <= start
    || !screen.includes("retry.textContent = 'Tentar novamente'")
    || !screen.includes("exit.textContent = 'Sair'")
    || !continuation.includes('showAccountDataLoadError(root, error, user)')) {
    throw new Error('A falha de carga precisa oferecer ações recuperáveis e ser conectada ao catch.');
  }
});

test('confirmações nativas foram substituídas e o feedback de persistência informa status', () => {
  const source = readFileSync(new URL('../src/js/main.js', import.meta.url), 'utf8');
  if (source.includes('window.confirm')) throw new Error('Ainda há confirmação nativa no app.');
  if (!source.includes('Salvo às') || !source.includes('Alterações feitas offline não serão salvas')) {
    throw new Error('O shell precisa exibir o horário salvo e o aviso offline persistente.');
  }
});

test('landing comunica valor, demonstração e privacidade financeira com precisão', () => {
  const root = { innerHTML: '' };
  renderLanding(root);
  const entryHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const expectedContent = [
    'Mais clareza para a sua semana',
    'Criar conta e começar',
    'Explorar a demonstração',
    'não acessa sua conta nem salva alterações',
    'sem conexão com bancos',
    'usuário autenticado',
    'Um passo de cada vez',
    'Reserve um tempo de foco',
  ];
  expectedContent.forEach((text) => {
    if (!root.innerHTML.includes(text)) throw new Error(`Conteúdo ausente na landing: ${text}`);
  });
  if (!entryHtml.includes('<title>aurora. — mais clareza para a sua rotina</title>')
    || !entryHtml.includes('property="og:title" content="aurora. — mais clareza para a sua rotina"')
    || !entryHtml.includes('name="twitter:title" content="aurora. — mais clareza para a sua rotina"')) {
    throw new Error('Os metadados de busca e compartilhamento precisam acompanhar a promessa atual da landing.');
  }
  const landingView = readFileSync(new URL('../src/js/features/landing/view.js', import.meta.url), 'utf8');
  if (!landingView.includes('Finanças, ciclo e os demais recursos estão disponíveis ao criar uma conta.')) {
    throw new Error('A demonstração precisa informar quais recursos não são interativos.');
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

test('orientações cobrem as telas e esclarecem a privacidade financeira', () => {
  const routes = ['inicio', 'planejar', 'pomodoro', 'financas', 'habitos', 'ciclo'];
  equal(AREA_GUIDE_IDS.join(','), routes.join(','));
  Object.values(AREA_GUIDES).forEach((guide) => {
    ok(guide.title);
    ok(guide.summary);
    ok(guide.steps.length >= 3);
    guide.steps.forEach((step) => {
      ok(step.title);
      ok(step.text);
    });
    ok(guide.video.endsWith('.webm'));
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

test('ações da personalização inicial só são liberadas enquanto o diálogo está ativo', () => {
  equal(actionNeedsProfileSetup('ob-need', true), false);
  equal(actionNeedsProfileSetup('ob-area', true), false);
  equal(actionNeedsProfileSetup('ob-skip', true), false);
  equal(actionNeedsProfileSetup('ob-skip', false), true);
  equal(actionNeedsProfileSetup('home-quick-task', true), true);
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

test('transação de backup persiste todas as chaves em caso de sucesso', () => {
  const storage = new Map([['a', 'antigo-a'], ['b', 'antigo-b']]);
  const result = runStorageTransaction({
    keys: ['a', 'b'],
    readRaw: (key) => storage.has(key) ? storage.get(key) : null,
    writeRaw: (key, value) => storage.set(key, value),
    removeRaw: (key) => storage.delete(key),
    persist: (key) => {
      storage.set(key, `novo-${key}`);
      return true;
    },
  });

  equal(result.ok, true);
  equal(storage.get('a'), 'novo-a');
  equal(storage.get('b'), 'novo-b');
});

test('transação restaura os valores anteriores quando uma gravação falha', () => {
  const storage = new Map([['a', 'antigo-a'], ['b', 'antigo-b']]);
  const result = runStorageTransaction({
    keys: ['a', 'b'],
    readRaw: (key) => storage.has(key) ? storage.get(key) : null,
    writeRaw: (key, value) => storage.set(key, value),
    removeRaw: (key) => storage.delete(key),
    persist: (key) => {
      if (key === 'a') storage.set(key, 'novo-a');
      if (key === 'b') return false;
      return true;
    },
  });

  equal(result.ok, false);
  equal(result.rollbackFailed, false);
  equal(storage.get('a'), 'antigo-a');
  equal(storage.get('b'), 'antigo-b');
});

test('transação identifica quando o próprio rollback falha', () => {
  const storage = new Map([['a', 'antigo-a'], ['b', 'antigo-b']]);
  const result = runStorageTransaction({
    keys: ['a', 'b'],
    readRaw: (key) => storage.get(key),
    writeRaw: (key, value) => {
      if (key === 'a') throw new Error('Rollback simulado');
      storage.set(key, value);
    },
    removeRaw: (key) => storage.delete(key),
    persist: (key) => {
      if (key === 'a') storage.set(key, 'novo-a');
      if (key === 'b') return false;
      return true;
    },
  });

  equal(result.ok, false);
  equal(result.rollbackFailed, true);
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

test('interpreta prazos de tarefa rápida sem depender do timezone do servidor', () => {
  equal(JSON.stringify(parseQuickTaskText('Revisar hoje', '2026-10-30')), JSON.stringify({
    title: 'Revisar', dueDate: '2026-10-30', time: '', hasDeadline: true, error: '',
  }));
  equal(JSON.stringify(parseQuickTaskText('Ler amanhã às 18:30', '2026-10-30')), JSON.stringify({
    title: 'Ler', dueDate: '2026-10-31', time: '18:30', hasDeadline: true, error: '',
  }));
  equal(JSON.stringify(parseQuickTaskText('Enviar relatório sexta 18h', '2026-10-30')), JSON.stringify({
    title: 'Enviar relatório', dueDate: '2026-10-30', time: '18:00', hasDeadline: true, error: '',
  }));
  equal(parseQuickTaskText('Reunião sexta', '2026-10-31').dueDate, '2026-11-06');
  equal(parseQuickTaskText('Planejar semana', '2026-10-30').title, 'Planejar semana');
  truthy(/horário válido/.test(parseQuickTaskText('Entregar sexta 25h', '2026-10-30').error));
  truthy(/Escreva a tarefa/.test(parseQuickTaskText('amanhã 18h', '2026-10-30').error));
});

test('valida atividade sexual e métodos contraceptivos do diário do ciclo', () => {
  truthy(isValidCycleSexualLog({}));
  truthy(isValidCycleSexualLog({ sexualActivity: true }));
  truthy(isValidCycleSexualLog({ sexualActivity: true, contraceptionMethods: ['condom', 'pill'] }));
  truthy(isValidCycleSexualLog({ sexualActivity: true, contraceptionMethods: ['none'] }));
  truthy(isValidCycleSexualLog({ sexualActivity: true, contraceptionMethods: ['undisclosed'] }));
  falsy(isValidCycleSexualLog({ sexualActivity: 'sim' }));
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

test('mantém aliases legados, redireciona Água para Hábitos e limita rotas desconhecidas', () => {
  const routes = new Set(['inicio', 'planejar', 'pomodoro', 'habitos', 'config']);

  truthy(MENU_ITEMS.some((item) => item.id === 'pomodoro'));
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

test('descarta opções de menu desconhecidas ao normalizar preferências', () => {
  const oldOrder = ['inicio', 'planejar', 'pomodoro', 'financas', 'retired', 'agua', 'ciclo', 'habitos'];
  const oldVisibleItems = ['pomodoro', 'financas', 'retired', 'agua', 'ciclo', 'habitos'];

  truthy(isValidMenuOrder(oldOrder));
  truthy(isValidVisibleMenuItems(oldVisibleItems));
  equal(normalizeMenuOrder(oldOrder).join(','), 'inicio,planejar,pomodoro,financas,agua,ciclo,habitos');
  equal(normalizeVisibleMenuItems(oldVisibleItems).join(','), 'pomodoro,financas,agua,ciclo,habitos');
  falsy(isValidMenuOrder([...oldOrder, 'retired']));
  falsy(isValidVisibleMenuItems([...oldVisibleItems, 'retired']));
});

test('mantém Início e Planejar fixos e só oferece movimentos possíveis no menu', () => {
  const order = ['inicio', 'pomodoro', 'planejar', 'financas', 'agua', 'ciclo', 'habitos'];

  equal(normalizeMenuOrder(order).join(','), 'inicio,planejar,pomodoro,financas,agua,ciclo,habitos');
  equal(moveMenuItem(order, 'planejar', 1).join(','), 'inicio,planejar,pomodoro,financas,agua,ciclo,habitos');
  equal(moveMenuItem(order, 'pomodoro', -1).join(','), 'inicio,planejar,pomodoro,financas,agua,ciclo,habitos');
  truthy(canMoveMenuItem(order, 'pomodoro', 1));
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
    settingsRootPath({ href: 'https://aurora.local/pages/ajustes.html?source=pwa#config?section=data' }),
    '/pages/ajustes.html?source=pwa#config',
  );
  equal(settingsRootPath({ href: 'https://aurora.local/pages/inicio.html#inicio' }), null);
  equal(settingsRootPath({ href: 'https://aurora.local/pages/ajustes.html#config' }), null);
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
  ok(SUGGESTED_HABITS.length >= 12);
  equal(new Set(SUGGESTED_HABITS.map((item) => item.id)).size, SUGGESTED_HABITS.length);
  for (const id of ['water', 'reading', 'movement', 'pause']) ok(SUGGESTED_HABITS.some((item) => item.id === id), id);
  for (const item of SUGGESTED_HABITS) {
    ok(HABIT_ICON_KEYS.includes(item.icon), `ícone de ${item.id}`);
    ok(HABIT_COLORS.includes(item.color), `cor de ${item.id}`);
  }
  const created = createSuggestedHabits(['sleep'], [], () => 'n1');
  equal(created[0].icon, 'moon');
  ok(isValidHabit(created[0]));
});

/* ---- Pomodoro ---- */
const noon = new Date(2026, 9, 21, 12, 0, 0).getTime();
function mockAudioContext() {
  const oscillators = [], gains = [];
  return {
    currentTime: 1,
    destination: {},
    oscillators,
    gains,
    createOscillator() {
      const oscillator = {
        frequency: { setValueAtTime(value) { oscillator.frequencyValue = value; } },
        connect() {},
        start(value) { oscillator.startAt = value; },
        stop(value) { oscillator.stopAt = value; },
      };
      oscillators.push(oscillator);
      return oscillator;
    },
    createGain() {
      const ramps = [];
      const gain = {
        ramps,
        gain: {
          setValueAtTime(value) { gain.initialGain = value; },
          exponentialRampToValueAtTime(value) { ramps.push(value); },
        },
        connect() {},
      };
      gains.push(gain);
      return gain;
    },
  };
}
const freshTimer = (extra = {}) => ({
  elapsedSeconds: 0,
  startedAt: noon - 26 * 60 * 1000,
  phase: 'focus',
  phaseElapsedSeconds: 0,
  completedPomodoros: 0,
  dailyCompletedPomodoros: 0,
  dailyCompletedOn: '',
  ...extra,
});

test('retoma o áudio interrompido no Safari móvel', () => {
  let resumes = 0;
  const context = {
    state: 'interrupted',
    resume() {
      resumes += 1;
      return Promise.resolve();
    },
  };

  resumePomodoroAudioContext(context);
  equal(resumes, 1);
});

test('não reinicia um contexto de áudio que já está ativo', () => {
  let resumes = 0;
  const context = {
    state: 'running',
    resume() {
      resumes += 1;
      return Promise.resolve();
    },
  };

  resumePomodoroAudioContext(context);
  equal(resumes, 0);
});

test('o toque padrão do Pomodoro tem volume reforçado', () => {
  const context = mockAudioContext();
  playPomodoroChime(context);
  equal(DEFAULT_POMODORO_SOUND_VOLUME, 75);
  equal(Math.round(context.gains[0].ramps[0] * 100), 60);
});

test('o toque e o volume escolhidos alteram o aviso sonoro', () => {
  const context = mockAudioContext();
  playPomodoroChime(context, { tone: 'bell', volume: 40 });
  equal(context.oscillators.length, 3);
  equal(context.oscillators[0].type, 'triangle');
  equal(context.oscillators[0].frequencyValue, 1046);
  equal(Math.round(context.gains[0].ramps[0] * 100), 32);
});

test('volume zero silencia o aviso sem criar áudio', () => {
  const context = mockAudioContext();
  playPomodoroChime(context, { volume: 0 });
  equal(context.oscillators.length, 0);
});

test('pausa longa usa o tempo configurado e volta a 15 min se o valor for inválido', () => {
  equal(phaseDurationSeconds({ focusMin: 25, breakMin: 5, longBreakMin: 20 }, 'long-break'), 1200);
  equal(phaseDurationSeconds({ focusMin: 25, breakMin: 5, longBreakMin: 3 }, 'long-break'), 900);
  equal(phaseDurationSeconds({ focusMin: 25, breakMin: 5 }, 'long-break'), 900);
  equal(longBreakMinutes({ longBreakMin: 60 }), 60);
});

test('preset clássico fixa 25/5/15 mesmo com valores personalizados salvos', () => {
  const effective = effectivePomodoroSettings({ preset: 'classic', focusMin: 40, breakMin: 10, longBreakMin: 30 });
  equal(effective.focusMin, 25);
  equal(effective.breakMin, 5);
  equal(effective.longBreakMin, 15);
});

test('concluir um bloco de foco avança a fase e registra o dia no histórico', () => {
  const settings = { focusMin: 25, breakMin: 5, longBreakMin: 15 };
  const { timer, transitions } = advancePomodoro(freshTimer(), settings, noon);
  equal(transitions.length, 1);
  equal(timer.phase, 'short-break');
  equal(timer.completedPomodoros, 1);
  equal(timer.history['2026-10-21'], 1);
});

test('o quarto bloco leva à pausa longa configurada', () => {
  const settings = { focusMin: 25, breakMin: 5, longBreakMin: 20 };
  const { timer } = advancePomodoro(freshTimer({ completedPomodoros: 3 }), settings, noon);
  equal(timer.phase, 'long-break');
  equal(phaseDurationSeconds(settings, timer.phase), 1200);
});

test('a quantidade de blocos até a pausa longa pode ser personalizada', () => {
  equal(cyclesPerLongBreak({ cyclesPerLongBreak: 6 }), 6);
  equal(cyclesPerLongBreak({ cyclesPerLongBreak: 1 }), 4);
  const settings = { focusMin: 25, breakMin: 5, longBreakMin: 20, cyclesPerLongBreak: 6 };
  let timer = freshTimer({ completedPomodoros: 5 });
  const { timer: advanced } = advancePomodoro(timer, settings, noon);
  equal(advanced.phase, 'long-break');
});

test('Pomodoro independente alterna foco e pausa sem ciclos', () => {
  const settings = { focusMin: 25, breakMin: 5, longBreakMin: 20, longBreakEnabled: false };
  const { timer } = advancePomodoro(freshTimer({ completedPomodoros: 3 }), settings, noon);
  equal(timer.phase, 'short-break');
  equal(phaseDurationSeconds(settings, timer.phase), 300);
});

test('histórico do Pomodoro descarta entradas inválidas e limita a 30 dias', () => {
  const dirty = { 'ruim': 2, '2026-10-01': -1, '2026-10-02': 1.5, '2026-10-03': 4 };
  const clean = normalizePomodoroHistory(dirty);
  equal(JSON.stringify(clean), JSON.stringify({ '2026-10-03': 4 }));
  equal(JSON.stringify(normalizePomodoroHistory(null)), '{}');
  const many = Object.fromEntries(Array.from({ length: 40 }, (_, index) => [`2026-01-${String(index % 28 + 1).padStart(2, '0')}`, 1]));
  truthy(Object.keys(normalizePomodoroHistory(many)).length <= 30);
});

test('últimos 7 dias do Pomodoro preenchem zeros e terminam no dia informado', () => {
  const days = recentFocusDays({ '2026-10-21': 3, '2026-10-18': 2 }, '2026-10-21', 7);
  equal(days.length, 7);
  equal(days[0].day, '2026-10-15');
  equal(days[6].day, '2026-10-21');
  equal(days[6].count, 3);
  equal(days[3].count, 2);
  equal(days[1].count, 0);
});

test('o agendamento Push do Pomodoro contém somente fase, horários e durações', () => {
  const now = 1_000_000;
  const schedule = createPomodoroSchedule({
    phase: 'short-break',
    startedAt: now - 60_000,
    phaseElapsedSeconds: 30,
    completedPomodoros: 1,
    focusTaskId: 'local-task',
    focusLabel: 'texto privado',
  }, {
    focusMin: 25,
    breakMin: 5,
    longBreakMin: 15,
  }, now);

  equal(schedule.phaseEndsAt, now + 210_000);
  equal(schedule.completedPomodoros, 1);
  equal(Object.keys(schedule).some((key) => /task|label|name|text/i.test(key)), false);
  equal(createPomodoroSchedule({ startedAt: null }, {}, now), null);
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
