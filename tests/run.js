
import { filterValidRecords, isPlainObject, validateFinanceReferences } from '../src/js/core/data-integrity.js';
import { runStorageTransaction } from '../src/js/core/backup-transaction.js';
import { parseMoney } from '../src/js/utils/currency.js';
import { isDay } from '../src/js/utils/dates.js';
import { resolveRoute } from '../src/js/core/router.js';
import { actionNeedsProfileSetup } from '../src/js/core/access-control.js';
import {
  accountBalance,
  monthStats,
  netAccountBalance,
  recurringBillsDueOn,
} from '../src/js/features/finance/calculations.js';

import { LOOK_DEFAULT, PALETTES, darkenFor, hexOk, lum, paletteColors } from '../src/js/features/appearance/palettes.js';
import { nextDue } from '../src/js/features/planning/recurrence.js';
import {
  createSuggestedHabits,
  habitColor,
  habitIconKey,
  habitIsSkipped,
  HABIT_COLORS,
  HABIT_ICON_KEYS,
  SUGGESTED_HABITS,
  habitStats,
  habitWeeklyTarget,
  isValidHabit,
} from '../src/js/features/habits/model.js';
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
  effectivePomodoroSettings,
  longBreakMinutes,
  normalizePomodoroHistory,
  phaseDurationSeconds,
  recentFocusDays,
} from '../src/js/features/studies/pomodoro.js';
import { resumePomodoroAudioContext } from '../src/js/features/studies/pomodoro-audio.js';
import { isValidCycleSexualLog } from '../src/js/features/cycle/log.js';
import { createPomodoroSchedule } from '../src/js/services/pomodoro-push.js';

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

test('rejeita datas com formato incorreto ou dias inexistentes', () => {
  falsy(isDay('2024-2-01'));
  falsy(isDay('2024-04-31'));
  falsy(isDay('2024/04/30'));
  falsy(isDay(''));
  falsy(isDay(null));
});

test('mantém os aliases e limita rotas desconhecidas a Início', () => {
  const routes = new Set(['inicio', 'planejar', 'config']);

  equal(resolveRoute('estudos', routes).route, 'planejar');
  equal(resolveRoute('estudos', routes).focusActive, true);
  equal(resolveRoute('pessoal', routes).replaceHash, 'inicio');
  equal(resolveRoute('perfil', routes).route, 'config');
  equal(resolveRoute('perfil', routes).replaceHash, 'config');
  equal(resolveRoute('academia', routes).route, 'inicio');
  equal(resolveRoute('academia', routes).replaceHash, 'inicio');
  equal(resolveRoute('invalida', routes).route, 'inicio');
});

test('calcula saldos em centavos e exclui cartão do saldo líquido', () => {
  const checking = { id: 'checking', type: 'checking', initialCents: 10000 };
  const cash = { id: 'cash', type: 'cash', initialCents: 1000 };
  const card = { id: 'card', type: 'credit', initialCents: 0 };

  const transactions = [
    { type: 'in', accountId: 'checking', cents: 5000, paid: true },
    { type: 'out', accountId: 'checking', cents: 1250, paid: true },
    {
      type: 'tr',
      accountId: 'checking',
      toAccountId: 'cash',
      cents: 2000,
      paid: true,
    },
    { type: 'out', accountId: 'card', cents: 3000, paid: true },
  ];

  equal(accountBalance(checking, transactions), 11750);
  equal(accountBalance(cash, transactions), 3000);
  equal(accountBalance(card, transactions), -3000);
  equal(netAccountBalance([checking, cash, card], transactions), 14750);
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

test('acoes do app exigem perfil, exceto configurar perfil, pular conteúdo ou iniciar do zero', () => {
  const taskActions = [
    'toggle', 'rem-done', 'mv-up', 'mv-down', 'del-task', 'edit-task',
    'del-plan', 'del-task-dlg', 'plan-create',
  ];

  taskActions.forEach((action) => equal(actionNeedsProfileSetup(action), true));
  equal(actionNeedsProfileSetup('li-new'), true);
  equal(actionNeedsProfileSetup('load-sample'), true);

  equal(actionNeedsProfileSetup('toggle-timer'), true);
  equal(actionNeedsProfileSetup('open-profile-setup'), false);
  equal(actionNeedsProfileSetup('skip'), false);
  equal(actionNeedsProfileSetup('wipe-home'), false);

  ['ob-next', 'ob-back', 'ob-theme', 'ob-area', 'ob-finish'].forEach((action) => {
    equal(actionNeedsProfileSetup(action), true);
    equal(actionNeedsProfileSetup(action, true), false);
  });
  equal(actionNeedsProfileSetup('task-new', true), true);
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

test('sugestões de hábito não duplicam nomes nem a água', () => {
  let count = 0;
  const created = createSuggestedHabits(['reading', 'water'], [{ ...habitBase, name: 'LER POR 10 MINUTOS' }], () => `id-${++count}`);
  equal(created.length, 1);
  equal(created[0].tracking, 'water');
  const again = createSuggestedHabits(['water'], [{ ...habitBase, id: 'w', name: 'Água', tracking: 'water' }], () => 'x');
  equal(again.length, 0);
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
  equal(habitIconKey({ ...habitBase, tracking: 'water', icon: 'bike' }), 'droplet');
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
