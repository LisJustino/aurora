const TABLES = [
  'profiles', 'user_settings', 'task_lists', 'tags', 'tasks', 'subtasks',
  'task_tag_assignments', 'weekly_reflections', 'timer_state',
  'pomodoro_daily_stats', 'habits', 'habit_logs', 'water_logs',
  'gym_templates', 'gym_template_exercises', 'gym_logs', 'finance_accounts',
  'finance_transactions', 'finance_budgets', 'finance_goals', 'finance_recurrences',
  'cycle_periods', 'cycle_days', 'weight_logs', 'push_subscriptions', 'trash_records',
];
const MANAGED_TABLES = TABLES.filter((table) => table !== 'push_subscriptions');
const versionId = (table, row) => (
  table === 'profiles' || table === 'user_settings'
    ? row.user_id
    : row.id
);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const uuidLike = (value) => typeof value === 'string' && UUID.test(value);
const localDate = (timestamp) => {
  const date = new Date(timestamp);
  const pad = (part) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};
const toIso = (value) => value == null ? null : new Date(value).toISOString();
const fromIso = (value) => value == null ? null : Date.parse(value);
const sortObject = (value) => {
  if (Array.isArray(value)) return value.map((item) => sortObject(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, sortObject(item)]));
  }
  return value;
};
const rowSignature = (row) => {
  const data = { ...(row || {}) };
  delete data.updated_at;
  delete data.expected_updated_at;
  return JSON.stringify(sortObject(data));
};
const byId = (rows) => new Map(rows.map((row) => [row.id, row]));
const includeActive = (row) => !row.deleted_at;
const dateMonth = (month) => `${month}-01`;
const timeOnly = (time) => time ? String(time).slice(0, 5) : '';
const monthFromDate = (value) => value ? String(value).slice(0, 7) : '';
const numeric = (value) => {
  const number = Number(value);
  if (!Number.isSafeInteger(number)) throw new Error('O banco retornou um valor numérico fora do limite seguro.');
  return number;
};

function getIdMap() {
  return new Map(TABLES.map((table) => [table, new Map()]));
}

function idFor(idMap, table, sourceId) {
  const key = String(sourceId);
  if (uuidLike(key)) return key;
  const map = idMap.get(table);
  if (map.has(key)) return map.get(key);
  const id = crypto.randomUUID();
  map.set(key, id);
  return id;
}

function sourceId(idMap, table, databaseId) {
  const map = idMap.get(table);
  for (const [source, id] of map) {
    if (id === databaseId) return source;
  }
  return databaseId;
}

function rowId(idMap, table, userId, sourceIdValue, extra = {}) {
  const source = String(sourceIdValue);
  return {
    id: idFor(idMap, table, source),
    user_id: userId,
    legacy_id: uuidLike(source) ? null : source,
    updated_at: toIso(Date.now()),
    ...extra,
  };
}

function diffTableRows(previousRows = [], nextRows = []) {
  const previousMap = new Map((previousRows || []).map((row) => [row.id, row]));
  const nextMap = new Map((nextRows || []).map((row) => [row.id, row]));
  const changed = [];

  for (const row of nextRows) {
    const previous = previousMap.get(row.id);
    if (!previous || rowSignature(previous) !== rowSignature(row)) {
      changed.push(row);
    }
  }

  for (const [id, row] of previousMap) {
    if (!nextMap.has(id)) {
      changed.push({ ...row, updated_at: toIso(Date.now()), deleted_at: toIso(Date.now()) });
    }
  }

  return changed;
}

function databaseId(idMap, table, appId) {
  return appId == null || appId === '' ? null : idFor(idMap, table, appId);
}

function queryError(table, error) {
  console.error(`Aurora: a leitura relacional de ${table} falhou.`, error);
  throw new Error('Não foi possível carregar todos os dados da conta. Tente novamente quando a conexão estiver estável.');
}

async function selectAll(client, table) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await client.from(table).select('*').range(from, from + 999);
    if (error) queryError(table, error);
    rows.push(...(data || []));
    if (!data || data.length < 1000) return rows;
  }
}

function pushRow(target, table, row) {
  if (!target.has(table)) target.set(table, []);
  target.get(table).push(row);
}

function recordsForTrash(settings) {
  return Array.isArray(settings?.prefs?.trash) ? settings.prefs.trash : [];
}

function activeTrashRows(settings, userId, idMap, lookupEntityId) {
  const rows = [];
  recordsForTrash(settings).forEach((entry) => {
    if (!entry || !Array.isArray(entry.records)) return;
    entry.records.forEach((record, index) => {
      const entity = trashEntity(record);
      if (!entity) return;
      const id = lookupEntityId(entity.table, entity.sourceId);
      rows.push(rowId(idMap, 'trash_records', userId, `${entry.id}|${index}|${record.collection}|${record.key}`, {
        entry_legacy_id: entry.id,
        collection: record.collection,
        record_key: String(record.key),
        record_index: index,
        label: String(entry.label || 'Registro removido').slice(0, 160),
        entity_table: entity.table,
        entity_id: id,
        removed_at: toIso(entry.deletedAt),
        is_test_data: false,
        deleted_at: null,
      }));
    });
  });
  return rows;
}

function trashEntity(record) {
  const mapping = {
    tasks: ['tasks', record?.value?.id],
    habits: ['habits', record?.value?.id],
    water: ['water_logs', record?.value?.id],
    cycleLog: ['cycle_days', record?.key],
    cycle: ['cycle_periods', record?.key],
    'finance.accounts': ['finance_accounts', record?.value?.id],
    'finance.tx': ['finance_transactions', record?.value?.id],
    'finance.budgets': ['finance_budgets', record?.key],
    'finance.goals': ['finance_goals', record?.value?.id],
    'finance.recurring': ['finance_recurrences', record?.value?.id],
  }[record?.collection];
  return mapping && mapping[1] != null ? { table: mapping[0], sourceId: mapping[1] } : null;
}

function deletedAtFor(settings, collection, sourceIdValue) {
  for (const entry of recordsForTrash(settings)) {
    for (const record of entry.records || []) {
      if (record.collection === collection && String(record.key) === String(sourceIdValue)) {
        return toIso(entry.deletedAt);
      }
    }
  }
  return null;
}

function indexForTrash(settings, collection) {
  const map = new Map();
  recordsForTrash(settings).forEach((entry) => {
    for (const record of entry.records || []) {
      if (record.collection === collection) map.set(String(record.key), record);
    }
  });
  return map;
}

function buildRows(userId, state, idMap) {
  const rows = new Map();
  const settings = state.settings;
  const taskSources = [
    ...(state.tasks || []),
    ...[...indexForTrash(settings, 'tasks').values()].map((record) => record.value),
  ];
  const taskLists = [...(settings.lists || [])];
  for (const task of taskSources) {
    if (task.list && !taskLists.some((list) => list.name === task.list)) {
      taskLists.push({ name: task.list, color: '#c97994' });
    }
  }
  const listIds = new Map();
  taskLists.forEach((list, index) => {
    const listId = idFor(idMap, 'task_lists', list.name);
    listIds.set(list.name, listId);
    pushRow(rows, 'task_lists', rowId(idMap, 'task_lists', userId, list.name, {
      name: list.name,
      color: list.color || '#c97994',
      folder: list.folder || null,
      sort_order: index,
      is_test_data: false,
      deleted_at: null,
    }));
  });

  const profile = settings.profile || {};
  pushRow(rows, 'profiles', {
    id: userId,
    user_id: userId,
    display_name: profile.name || '',
    preferred_name: profile.preferredName || '',
    sex: profile.sex || '',
    age: profile.age ?? null,
    weight_kg: profile.weightKg ?? null,
    height_cm: profile.heightCm ?? null,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo',
    theme: settings.theme || 'rose',
    appearance: settings.look || {},
  });
  const prefs = { ...(settings.prefs || {}) };
  delete prefs.trash;
  delete prefs.weeklyReflection;
  pushRow(rows, 'user_settings', {
    id: userId,
    user_id: userId,
    preferences: {
      ...prefs,
      cats: settings.cats || { out: [], in: [] },
      weightTracking: settings.weightTracking === true,
      onboardingComplete: settings.onboardingComplete === true,
      introSeen: settings.introSeen === true,
    },
    enabled_areas: settings.areas || {},
    account_types: settings.accountTypes || ['checking', 'cash'],
  });
  if (settings.prefs?.weeklyReflection?.weekOf) {
    const reflection = settings.prefs.weeklyReflection;
    pushRow(rows, 'weekly_reflections', rowId(idMap, 'weekly_reflections', userId, reflection.weekOf, {
      week_of: reflection.weekOf,
      reflection: reflection.text || '',
      is_test_data: false,
      deleted_at: null,
    }));
  }

  const tasks = [...(state.tasks || [])];
  const trashedTasks = indexForTrash(settings, 'tasks');
  trashedTasks.forEach((record) => {
    if (!tasks.some((task) => task.id === record.value.id)) tasks.push(record.value);
  });
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const taskTags = new Set();
  tasks.forEach((task) => (task.tags || []).forEach((tag) => taskTags.add(tag)));
  const tagIds = new Map();
  for (const tag of taskTags) {
    const id = idFor(idMap, 'tags', tag);
    tagIds.set(tag, id);
    pushRow(rows, 'tags', rowId(idMap, 'tags', userId, tag, {
      name: tag,
      is_test_data: false,
      deleted_at: null,
    }));
  }
  for (const task of tasks) {
    const removedAt = deletedAtFor(settings, 'tasks', task.id);
    const taskId = idFor(idMap, 'tasks', task.id);
    pushRow(rows, 'tasks', rowId(idMap, 'tasks', userId, task.id, {
      title: task.title,
      is_completed: task.done === true,
      tag: task.tag || null,
      list_id: task.list ? listIds.get(task.list) || null : null,
      group_key: task.groupId || null,
      group_title: task.groupTitle || null,
      due_date: task.dueDate || null,
      priority: task.priority || 'normal',
      task_created_at: Number.isFinite(task.createdAt) ? toIso(task.createdAt) : null,
      completed_at: task.doneAt || null,
      planned_time: task.time || null,
      repeat_rule: task.repeat || 'none',
      remind_minutes: task.remind ?? null,
      notes: task.notes || null,
      sort_order: Number.isFinite(task.order) ? task.order : 0,
      focus_seconds: Number.isSafeInteger(task.focusSeconds) ? task.focusSeconds : 0,
      is_test_data: task.sample === true,
      deleted_at: removedAt,
    }));
    (task.subtasks || []).forEach((subtask, index) => {
      const subId = subtask.id || `${task.id}:subtask:${index}`;
      pushRow(rows, 'subtasks', rowId(idMap, 'subtasks', userId, subId, {
        task_id: taskId,
        title: subtask.title,
        is_completed: subtask.done === true,
        sort_order: index,
        is_test_data: task.sample === true,
        deleted_at: removedAt,
      }));
    });
    (task.tags || []).forEach((tag) => {
      const key = `${task.id}|${tag}`;
      pushRow(rows, 'task_tag_assignments', rowId(idMap, 'task_tag_assignments', userId, key, {
        task_id: taskId,
        tag_id: tagIds.get(tag),
        is_test_data: task.sample === true,
        deleted_at: removedAt,
      }));
    });
  }

  const timer = state.pomodoro;
  const timerId = idFor(idMap, 'timer_state', 'pomodoro');
  pushRow(rows, 'timer_state', {
    id: timerId,
    user_id: userId,
    timer_kind: 'pomodoro',
    focus_task_id: databaseId(idMap, 'tasks', timer.focusTaskId),
    elapsed_seconds: Math.max(0, Math.floor(timer.elapsedSeconds || 0)),
    started_at: toIso(timer.startedAt),
    phase: timer.phase || 'focus',
    phase_elapsed_seconds: Math.max(0, Math.floor(timer.phaseElapsedSeconds || 0)),
    completed_pomodoros: Math.max(0, Math.floor(timer.completedPomodoros || 0)),
    daily_completed_pomodoros: Math.max(0, Math.floor(timer.dailyCompletedPomodoros || 0)),
    daily_completed_on: timer.dailyCompletedOn || null,
    focus_label: timer.focusLabel || null,
    is_test_data: false,
  });
  Object.entries(state.pomodoro?.history || {}).forEach(([day, count]) => {
    pushRow(rows, 'pomodoro_daily_stats', rowId(idMap, 'pomodoro_daily_stats', userId, day, {
      stat_date: day,
      completed_count: count,
      is_test_data: false,
      deleted_at: null,
    }));
  });

  const habits = [...(state.habits || [])];
  indexForTrash(settings, 'habits').forEach((record) => {
    if (!habits.some((item) => item.id === record.value.id)) habits.push(record.value);
  });
  for (const habit of habits) {
    const removedAt = deletedAtFor(settings, 'habits', habit.id);
    const habitId = idFor(idMap, 'habits', habit.id);
    pushRow(rows, 'habits', rowId(idMap, 'habits', userId, habit.id, {
      name: habit.name,
      scheduled_days: habit.days,
      status: habit.status || 'active',
      skipped_dates: habit.skipped || [],
      paused_from: habit.pausedFrom || null,
      paused_days: habit.pausedDays || null,
      tracking: habit.tracking || null,
      icon: habit.icon || null,
      color: habit.color || null,
      weekly_goal: habit.weeklyGoal || null,
      remind: habit.remind || null,
      is_test_data: habit.sample === true,
      deleted_at: removedAt,
    }));
    for (const [status, days] of [['completed', habit.completions || []], ['skipped', habit.skipped || []]]) {
      days.forEach((day) => pushRow(rows, 'habit_logs', rowId(idMap, 'habit_logs', userId, `${habit.id}|${status}|${day}`, {
        habit_id: habitId,
        log_date: day,
        status,
        note: null,
        is_test_data: habit.sample === true,
        deleted_at: removedAt,
      })));
    }
  }

  const water = [...(state.water || [])];
  indexForTrash(settings, 'water').forEach((record) => {
    if (!water.some((item) => item.id === record.value.id)) water.push(record.value);
  });
  for (const entry of water) {
    pushRow(rows, 'water_logs', rowId(idMap, 'water_logs', userId, entry.id, {
      log_date: localDate(entry.at),
      recorded_at: entry.at,
      amount_ml: Math.round(entry.ml),
      is_test_data: entry.sample === true,
      deleted_at: deletedAtFor(settings, 'water', entry.id),
    }));
  }

  const templates = state.gym?.templates || [];
  for (const template of templates) {
    const templateId = idFor(idMap, 'gym_templates', template.id);
    pushRow(rows, 'gym_templates', rowId(idMap, 'gym_templates', userId, template.id, {
      name: template.name,
      is_test_data: template.sample === true,
      deleted_at: null,
    }));
    (template.exercises || []).forEach((name, index) => pushRow(rows, 'gym_template_exercises', rowId(
      idMap,
      'gym_template_exercises',
      userId,
      `${template.id}|${index}|${name}`,
      {
        template_id: templateId,
        name,
        sort_order: index,
        is_test_data: template.sample === true,
        deleted_at: null,
      },
    )));
  }
  for (const log of state.gym?.logs || []) {
    pushRow(rows, 'gym_logs', rowId(idMap, 'gym_logs', userId, log.id, {
      log_date: log.date,
      name: log.name || null,
      minutes: log.minutes ?? null,
      notes: log.notes || null,
      is_test_data: log.sample === true,
      deleted_at: null,
    }));
  }

  const accounts = [...(state.finance?.accounts || [])];
  const tx = [...(state.finance?.tx || [])];
  const goals = [...(state.finance?.goals || [])];
  const recurring = [...(state.finance?.recurring || [])];
  indexForTrash(settings, 'finance.accounts').forEach((record) => {
    if (!accounts.some((item) => item.id === record.value.id)) accounts.push(record.value);
  });
  indexForTrash(settings, 'finance.tx').forEach((record) => {
    if (!tx.some((item) => item.id === record.value.id)) tx.push(record.value);
  });
  indexForTrash(settings, 'finance.goals').forEach((record) => {
    if (!goals.some((item) => item.id === record.value.id)) goals.push(record.value);
  });
  indexForTrash(settings, 'finance.recurring').forEach((record) => {
    if (!recurring.some((item) => item.id === record.value.id)) recurring.push(record.value);
  });
  for (const account of accounts) {
    pushRow(rows, 'finance_accounts', rowId(idMap, 'finance_accounts', userId, account.id, {
      name: account.name,
      account_type: account.type,
      initial_cents: account.initialCents,
      bank: account.bank || null,
      limit_cents: account.limitCents ?? null,
      closing_day: account.closingDay ?? null,
      due_day: account.dueDay ?? null,
      is_test_data: account.sample === true,
      deleted_at: deletedAtFor(settings, 'finance.accounts', account.id),
    }));
  }
  for (const recurrence of recurring) {
    pushRow(rows, 'finance_recurrences', rowId(idMap, 'finance_recurrences', userId, recurrence.id, {
      transaction_type: recurrence.type,
      account_id: databaseId(idMap, 'finance_accounts', recurrence.accountId),
      category: recurrence.category,
      amount_cents: recurrence.cents,
      day_of_month: recurrence.day,
      start_month: dateMonth(recurrence.startYM),
      last_month: recurrence.lastYM ? dateMonth(recurrence.lastYM) : null,
      description: recurrence.desc || null,
      first_paid: recurrence.firstPaid === true,
      is_paused: recurrence.paused === true,
      is_test_data: recurrence.sample === true,
      deleted_at: deletedAtFor(settings, 'finance.recurring', recurrence.id),
    }));
  }
  for (const transaction of tx) {
    pushRow(rows, 'finance_transactions', rowId(idMap, 'finance_transactions', userId, transaction.id, {
      transaction_type: transaction.type,
      account_id: databaseId(idMap, 'finance_accounts', transaction.accountId),
      to_account_id: databaseId(idMap, 'finance_accounts', transaction.toAccountId),
      amount_cents: transaction.cents,
      transaction_date: transaction.date,
      settled_date: transaction.settledDate || null,
      entered_at: Number.isFinite(transaction.createdAt) ? toIso(transaction.createdAt) : null,
      category: transaction.category || null,
      description: transaction.desc || null,
      is_paid: transaction.paid === true,
      group_key: transaction.groupId || null,
      recurrence_id: databaseId(idMap, 'finance_recurrences', transaction.recId),
      is_test_data: transaction.sample === true,
      deleted_at: deletedAtFor(settings, 'finance.tx', transaction.id),
    }));
  }
  Object.entries(state.finance?.budgets || {}).forEach(([category, budget]) => {
    pushRow(rows, 'finance_budgets', rowId(idMap, 'finance_budgets', userId, category, {
      category,
      amount_cents: budget.cents,
      is_test_data: budget.sample === true,
      deleted_at: deletedAtFor(settings, 'finance.budgets', category),
    }));
  });
  indexForTrash(settings, 'finance.budgets').forEach((record, category) => {
    if (Object.hasOwn(state.finance?.budgets || {}, category)) return;
    pushRow(rows, 'finance_budgets', rowId(idMap, 'finance_budgets', userId, category, {
      category,
      amount_cents: record.value.cents,
      is_test_data: record.value.sample === true,
      deleted_at: deletedAtFor(settings, 'finance.budgets', category),
    }));
  });
  for (const record of [...goals, ...indexForTrash(settings, 'finance.goals').values()].map((item) => item.value || item)) {
    if (rows.get('finance_goals')?.some((row) => row.id === idFor(idMap, 'finance_goals', record.id))) continue;
    pushRow(rows, 'finance_goals', rowId(idMap, 'finance_goals', userId, record.id, {
      name: record.name,
      target_cents: record.targetCents,
      saved_cents: record.savedCents,
      deadline: record.deadline || null,
      is_test_data: record.sample === true,
      deleted_at: deletedAtFor(settings, 'finance.goals', record.id),
    }));
  }

  const activePeriods = [...(state.cycle || [])];
  const activePeriodKeys = new Set(activePeriods.map((period) => `${period.start}|${period.end || ''}`));
  const trashedPeriods = [...indexForTrash(settings, 'cycle').entries()]
    .filter(([key]) => !activePeriodKeys.has(key));
  for (const period of activePeriods) {
    const key = `${period.start}|${period.end || ''}`;
    pushRow(rows, 'cycle_periods', rowId(idMap, 'cycle_periods', userId, key, {
      start_date: period.start,
      end_date: period.end || null,
      is_test_data: period.sample === true,
      deleted_at: null,
    }));
  }
  for (const [key, record] of trashedPeriods) {
    const period = record.value;
    pushRow(rows, 'cycle_periods', rowId(idMap, 'cycle_periods', userId, key, {
      start_date: period.start,
      end_date: period.end || null,
      is_test_data: period.sample === true,
      deleted_at: deletedAtFor(settings, 'cycle', key),
    }));
  }
  const cycleDays = { ...(state.cycleLog || {}) };
  indexForTrash(settings, 'cycleLog').forEach((record) => {
    if (!Object.hasOwn(cycleDays, record.key)) cycleDays[record.key] = record.value;
  });
  Object.entries(cycleDays).forEach(([day, log]) => pushRow(rows, 'cycle_days', rowId(idMap, 'cycle_days', userId, day, {
    log_date: day,
    flow: log.flow || null,
    energy: log.energy || null,
    sleep: log.sleep || null,
    discharge: log.discharge || null,
    note: log.note || null,
    pain: log.pain || [],
    mood: log.mood || [],
    digestion: log.digestion || [],
    skin: log.skin || [],
    sexual_activity: log.sexualActivity ?? null,
    contraception_methods: log.contraceptionMethods || [],
    is_test_data: log.sample === true,
    deleted_at: deletedAtFor(settings, 'cycleLog', day),
  })));
  for (const item of state.weight || []) {
    pushRow(rows, 'weight_logs', rowId(idMap, 'weight_logs', userId, item.id, {
      log_date: item.date,
      weight_kg: item.kg,
      is_test_data: item.sample === true,
      deleted_at: null,
    }));
  }

  activeTrashRows(settings, userId, idMap, (table, source) => databaseId(idMap, table, source))
    .forEach((row) => pushRow(rows, 'trash_records', row));
  return rows;
}

function taskFromRow(row, tables, idMap, includeDeleted = false) {
  const taskId = sourceId(idMap, 'tasks', row.id);
  const tags = tables.task_tag_assignments
    .filter((assignment) => assignment.task_id === row.id && (includeDeleted || includeActive(assignment)))
    .map((assignment) => tables.tags.find((tag) => tag.id === assignment.tag_id)?.name)
    .filter(Boolean);
  const subtasks = tables.subtasks
    .filter((subtask) => subtask.task_id === row.id && (includeDeleted || includeActive(subtask)))
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((subtask) => ({
      id: sourceId(idMap, 'subtasks', subtask.id),
      title: subtask.title,
      done: subtask.is_completed,
    }));
  return {
    id: taskId,
    title: row.title,
    done: row.is_completed,
    tag: row.tag || undefined,
    list: tables.task_lists.find((list) => list.id === row.list_id)?.name,
    groupId: row.group_key || undefined,
    groupTitle: row.group_title || undefined,
    dueDate: row.due_date,
    priority: row.priority,
    createdAt: fromIso(row.task_created_at) || undefined,
    doneAt: row.completed_at || undefined,
    time: timeOnly(row.planned_time) || undefined,
    repeat: row.repeat_rule === 'none' ? undefined : row.repeat_rule,
    remind: row.remind_minutes ?? undefined,
    notes: row.notes || undefined,
    order: Number(row.sort_order) || 0,
    focusSeconds: row.focus_seconds,
    tags: tags.length ? tags : undefined,
    subtasks: subtasks.length ? subtasks : undefined,
    sample: row.is_test_data || undefined,
  };
}

function financeRecordFromRow(row, table, idMap) {
  const id = sourceId(idMap, table, row.id);
  if (table === 'finance_accounts') return {
    id, name: row.name, type: row.account_type, initialCents: numeric(row.initial_cents),
    bank: row.bank || undefined, limitCents: row.limit_cents == null ? undefined : numeric(row.limit_cents),
    closingDay: row.closing_day ?? undefined, dueDay: row.due_day ?? undefined,
    sample: row.is_test_data || undefined,
  };
  if (table === 'finance_transactions') return {
    id, type: row.transaction_type,
    accountId: sourceId(idMap, 'finance_accounts', row.account_id),
    ...(row.to_account_id ? { toAccountId: sourceId(idMap, 'finance_accounts', row.to_account_id) } : {}),
    cents: numeric(row.amount_cents), date: row.transaction_date,
    ...(row.settled_date ? { settledDate: row.settled_date } : {}),
    ...(row.category ? { category: row.category } : {}),
    ...(row.description ? { desc: row.description } : {}),
    paid: row.is_paid,
    ...(row.entered_at ? { createdAt: fromIso(row.entered_at) } : {}),
    ...(row.group_key ? { groupId: row.group_key } : {}),
    ...(row.recurrence_id ? { recId: sourceId(idMap, 'finance_recurrences', row.recurrence_id) } : {}),
    sample: row.is_test_data || undefined,
  };
  if (table === 'finance_goals') return {
    id, name: row.name, targetCents: numeric(row.target_cents),
    savedCents: numeric(row.saved_cents), deadline: row.deadline,
    sample: row.is_test_data || undefined,
  };
  if (table === 'finance_recurrences') return {
    id, type: row.transaction_type,
    accountId: sourceId(idMap, 'finance_accounts', row.account_id),
    category: row.category, cents: numeric(row.amount_cents),
    day: row.day_of_month, startYM: monthFromDate(row.start_month),
    lastYM: monthFromDate(row.last_month), desc: row.description || undefined,
    firstPaid: row.first_paid, paused: row.is_paused, sample: row.is_test_data || undefined,
  };
  return { cents: numeric(row.amount_cents), sample: row.is_test_data || undefined };
}

function loadTrash(tables, idMap) {
  const groups = new Map();
  const entityRows = {
    tasks: tables.tasks,
    habits: tables.habits,
    water_logs: tables.water_logs,
    cycle_days: tables.cycle_days,
    cycle_periods: tables.cycle_periods,
    finance_accounts: tables.finance_accounts,
    finance_transactions: tables.finance_transactions,
    finance_budgets: tables.finance_budgets,
    finance_goals: tables.finance_goals,
    finance_recurrences: tables.finance_recurrences,
  };
  for (const stored of tables.trash_records.filter(includeActive)) {
    if (!groups.has(stored.entry_legacy_id)) {
      groups.set(stored.entry_legacy_id, {
        id: stored.entry_legacy_id,
        deletedAt: fromIso(stored.removed_at),
        label: stored.label,
        records: [],
      });
    }
    let value;
    const row = (entityRows[stored.entity_table] || []).find((item) => item.id === stored.entity_id);
    if (!row) throw new Error('Um item da lixeira perdeu seu registro relacional; a conta foi bloqueada para evitar perda.');
    if (stored.collection === 'tasks') value = taskFromRow(row, tables, idMap, true);
    else if (stored.collection === 'habits') value = habitFromRow(row, tables, idMap, true);
    else if (stored.collection === 'water') value = {
      id: sourceId(idMap, 'water_logs', row.id), ml: row.amount_ml, at: row.recorded_at,
    };
    else if (stored.collection === 'cycleLog') value = cycleLogFromRow(row);
    else if (stored.collection === 'cycle') value = {
      start: row.start_date,
      end: row.end_date,
      sample: row.is_test_data || undefined,
    };
    else if (stored.collection.startsWith('finance.')) {
      const table = {
        'finance.accounts': 'finance_accounts',
        'finance.tx': 'finance_transactions',
        'finance.budgets': 'finance_budgets',
        'finance.goals': 'finance_goals',
        'finance.recurring': 'finance_recurrences',
      }[stored.collection];
      value = financeRecordFromRow(row, table, idMap);
    }
    groups.get(stored.entry_legacy_id).records.push({
      collection: stored.collection,
      key: stored.record_key,
      index: stored.record_index,
      value,
    });
  }
  return [...groups.values()].map((entry) => ({
    ...entry,
    records: entry.records.sort((a, b) => a.index - b.index),
  }));
}

function habitFromRow(row, tables, idMap, includeDeleted = false) {
  const habitId = sourceId(idMap, 'habits', row.id);
  const logs = tables.habit_logs.filter((log) => log.habit_id === row.id && (includeDeleted || includeActive(log)));
  const completions = logs.filter((log) => log.status === 'completed').map((log) => log.log_date);
  const skipped = logs.filter((log) => log.status === 'skipped').map((log) => log.log_date);
  return {
    id: habitId,
    name: row.name,
    days: row.scheduled_days,
    completions,
    status: row.status,
    skipped: skipped.length ? skipped : undefined,
    pausedFrom: row.paused_from || undefined,
    pausedDays: row.paused_days || undefined,
    tracking: row.tracking || undefined,
    icon: row.icon || undefined,
    color: row.color || undefined,
    weeklyGoal: row.weekly_goal || undefined,
    remind: timeOnly(row.remind) || undefined,
    sample: row.is_test_data || undefined,
  };
}

function cycleLogFromRow(row) {
  return {
    ...(row.flow ? { flow: row.flow } : {}),
    ...(row.energy ? { energy: row.energy } : {}),
    ...(row.sleep ? { sleep: row.sleep } : {}),
    ...(row.discharge ? { discharge: row.discharge } : {}),
    ...(row.note ? { note: row.note } : {}),
    ...(row.pain?.length ? { pain: row.pain } : {}),
    ...(row.mood?.length ? { mood: row.mood } : {}),
    ...(row.digestion?.length ? { digestion: row.digestion } : {}),
    ...(row.skin?.length ? { skin: row.skin } : {}),
    ...(row.sexual_activity !== null ? { sexualActivity: row.sexual_activity } : {}),
    ...(row.contraception_methods?.length ? { contraceptionMethods: row.contraception_methods } : {}),
    sample: row.is_test_data || undefined,
  };
}

function buildState(tables, idMap) {
  const profile = tables.profiles[0] || {};
  const userSettings = tables.user_settings[0] || {};
  const preferences = userSettings.preferences || {};
  const active = (table) => tables[table].filter(includeActive);
  const taskRows = active('tasks');
  const settings = {
    profile: {
      name: profile.display_name || '',
      preferredName: profile.preferred_name || '',
      sex: profile.sex || '',
      age: profile.age ?? null,
      weightKg: profile.weight_kg == null ? null : Number(profile.weight_kg),
      heightCm: profile.height_cm ?? null,
    },
    areas: userSettings.enabled_areas || {},
    theme: profile.theme || 'rose',
    look: profile.appearance || {},
    lists: active('task_lists').sort((a, b) => a.sort_order - b.sort_order).map((row) => ({
      name: row.name, color: row.color, ...(row.folder ? { folder: row.folder } : {}),
    })),
    cats: preferences.cats || { out: [], in: [] },
    weightTracking: preferences.weightTracking === true,
    accountTypes: userSettings.account_types || ['checking', 'cash'],
    onboardingComplete: preferences.onboardingComplete === true,
    introSeen: preferences.introSeen === true,
    prefs: {
      ...preferences,
      weeklyReflection: active('weekly_reflections')
        .sort((a, b) => b.week_of.localeCompare(a.week_of))
        .map((row) => ({ weekOf: row.week_of, text: row.reflection }))[0] || null,
      trash: loadTrash(tables, idMap),
    },
  };
  delete settings.prefs.cats;
  delete settings.prefs.weightTracking;
  delete settings.prefs.onboardingComplete;
  delete settings.prefs.introSeen;

  const mapPomodoroTimer = () => {
    const row = active('timer_state').find((item) => item.timer_kind === 'pomodoro');
    if (!row) return null;
    idMap.get('timer_state').set('pomodoro', row.id);
    const timer = {
      elapsedSeconds: row.elapsed_seconds,
      startedAt: fromIso(row.started_at),
      phase: row.phase,
      phaseElapsedSeconds: row.phase_elapsed_seconds,
      completedPomodoros: row.completed_pomodoros,
      dailyCompletedPomodoros: row.daily_completed_pomodoros,
      dailyCompletedOn: row.daily_completed_on || '',
    };
    timer.focusTaskId = row.focus_task_id ? sourceId(idMap, 'tasks', row.focus_task_id) : '';
    if (row.focus_label) timer.focusLabel = row.focus_label;
    timer.history = Object.fromEntries(active('pomodoro_daily_stats').map((item) => [
      item.stat_date,
      item.completed_count,
    ]));
    return timer;
  };
  const financeAccounts = active('finance_accounts').map((row) => financeRecordFromRow(row, 'finance_accounts', idMap));
  const financeRecurring = active('finance_recurrences').map((row) => financeRecordFromRow(row, 'finance_recurrences', idMap));
  const finance = {
    accounts: financeAccounts,
    tx: active('finance_transactions').map((row) => financeRecordFromRow(row, 'finance_transactions', idMap)),
    budgets: Object.fromEntries(active('finance_budgets').map((row) => [
      row.category,
      financeRecordFromRow(row, 'finance_budgets', idMap),
    ])),
    goals: active('finance_goals').map((row) => financeRecordFromRow(row, 'finance_goals', idMap)),
    recurring: financeRecurring,
  };

  return {
    settings,
    tasks: taskRows.map((row) => taskFromRow(row, tables, idMap)),
    pomodoro: mapPomodoroTimer(),
    habits: active('habits').map((row) => habitFromRow(row, tables, idMap)),
    water: active('water_logs').map((row) => ({
      id: sourceId(idMap, 'water_logs', row.id),
      ml: row.amount_ml,
      at: row.recorded_at,
      sample: row.is_test_data || undefined,
    })),
    gym: {
      templates: active('gym_templates').map((row) => ({
        id: sourceId(idMap, 'gym_templates', row.id),
        name: row.name,
        exercises: active('gym_template_exercises')
          .filter((exercise) => exercise.template_id === row.id)
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((exercise) => exercise.name),
        sample: row.is_test_data || undefined,
      })),
      logs: active('gym_logs').map((row) => ({
        id: sourceId(idMap, 'gym_logs', row.id),
        date: row.log_date,
        ...(row.name ? { name: row.name } : {}),
        ...(row.minutes == null ? {} : { minutes: row.minutes }),
        ...(row.notes ? { notes: row.notes } : {}),
        sample: row.is_test_data || undefined,
      })),
    },
    finance,
    cycle: active('cycle_periods').map((row) => ({
      start: row.start_date,
      end: row.end_date,
      sample: row.is_test_data || undefined,
    })),
    cycleLog: Object.fromEntries(active('cycle_days').map((row) => [
      row.log_date,
      cycleLogFromRow(row),
    ])),
    weight: active('weight_logs').map((row) => ({
      id: sourceId(idMap, 'weight_logs', row.id),
      date: row.log_date,
      kg: Number(row.weight_kg),
      sample: row.is_test_data || undefined,
    })),
  };
}

export class RelationalAccountStore {
  constructor(client, userId) {
    if (!client || !userId) throw new Error('Uma sessão autenticada é necessária para acessar os dados.');
    this.client = client;
    this.userId = userId;
    this.idMap = getIdMap();
    this.rowVersions = new Map(TABLES.map((table) => [table, new Map()]));
  }

  async load() {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw new Error('Sem conexão com a internet. Os dados da conta não foram carregados.');
    }
    const result = await Promise.all(TABLES.map(async (table) => [table, await selectAll(this.client, table)]));
    const tables = Object.fromEntries(result);
    this.rawTables = tables;
    for (const table of TABLES) {
      this.rowVersions.get(table).clear();
      for (const row of tables[table]) {
        if (row.legacy_id) this.idMap.get(table).set(row.legacy_id, row.id);
        if (row.updated_at) this.rowVersions.get(table).set(versionId(table, row), row.updated_at);
      }
    }
    return buildState(tables, this.idMap);
  }

  async save(state, previousState = null) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw new Error('Sem conexão com a internet. A alteração não foi gravada; conecte-se e tente novamente.');
    }
    const rows = buildRows(this.userId, state, this.idMap);
    const previousRows = previousState ? buildRows(this.userId, previousState, this.idMap) : null;
    const changes = MANAGED_TABLES.map((table) => {
      const nextRows = rows.get(table) || [];
      const previousTableRows = previousRows?.get(table) || [];
      const replaceMissing = previousRows === null;
      const changedRows = previousRows ? diffTableRows(previousTableRows, nextRows) : nextRows;
      const versions = this.rowVersions.get(table);
      return {
        table,
        replace_missing: replaceMissing,
        expected_versions: replaceMissing
          ? [...versions].map(([id, updatedAt]) => ({
            id,
            user_id: this.userId,
            expected_updated_at: updatedAt,
          }))
          : [],
        rows: changedRows.map((row) => ({
          ...row,
          expected_updated_at: versions.get(versionId(table, row)) ?? null,
        })),
      };
    });
    const { data, error } = await this.client.rpc('apply_relational_changes', { p_changes: changes });
    if (error) {
      const conflictMessage = typeof error.message === 'string' ? error.message : '';
      const isVersionConflict = /version_conflict|recarregue os dados da conta|atualizada em outro dispositivo/i.test(conflictMessage)
        || String(error.code || '').toLowerCase() === 'version_conflict';
      if (isVersionConflict) {
        const friendlyMessage = conflictMessage || 'A linha foi atualizada em outro dispositivo. Recarregue os dados da conta e tente novamente.';
        const versionError = new Error(friendlyMessage);
        versionError.code = 'version_conflict';
        throw versionError;
      }
      console.error('Aurora: a gravação relacional da conta falhou.', error);
      const code = typeof error.code === 'string' && /^[\w-]{1,32}$/.test(error.code)
        ? `Código ${error.code}. `
        : '';
      const message = typeof error.message === 'string'
        ? error.message.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180)
        : '';
      throw new Error(`Não foi possível salvar as alterações na conta. ${code}${message}`.trim());
    }
    if (!Array.isArray(data)) {
      throw new Error('A gravação foi enviada, mas não foi possível confirmar as versões salvas. Recarregue os dados da conta antes de continuar.');
    }
    for (const change of changes) {
      const savedTable = data.find((result) => result?.table === change.table);
      if (!savedTable || !Array.isArray(savedTable.rows)) {
        throw new Error('A gravação foi enviada, mas não foi possível confirmar as versões salvas. Recarregue os dados da conta antes de continuar.');
      }
      for (const row of change.rows) {
        const key = versionId(change.table, row);
        if (!savedTable.rows.some((saved) => versionId(change.table, saved) === key && typeof saved.updated_at === 'string')) {
          throw new Error('A gravação foi enviada, mas não foi possível confirmar as versões salvas. Recarregue os dados da conta antes de continuar.');
        }
      }
    }
    for (const result of data) {
      if (!result || !Array.isArray(result.rows) || !this.rowVersions.has(result.table)) continue;
      const versions = this.rowVersions.get(result.table);
      for (const row of result.rows) {
        const key = versionId(result.table, row);
        if (typeof key === 'string' && typeof row.updated_at === 'string') {
          versions.set(key, row.updated_at);
        }
      }
    }
  }

  async findPushSubscription(endpoint) {
    const { data, error } = await this.client
      .from('push_subscriptions')
      .select('id,worker_client_id,worker_capability,subscription,is_enabled')
      .eq('user_id', this.userId);
    if (error) {
      console.error('Aurora: não foi possível ler a inscrição Push da conta.', error);
      throw new Error('Não foi possível verificar os avisos Push da conta.');
    }
    const row = (data || []).find((item) => item.subscription?.endpoint === endpoint);
    return row ? {
      id: row.id,
      clientId: row.worker_client_id,
      capability: row.worker_capability,
      subscription: row.subscription,
      enabled: row.is_enabled,
    } : null;
  }

  async savePushSubscription(credentials, subscription) {
    const { data, error } = await this.client
      .from('push_subscriptions')
      .upsert({
        user_id: this.userId,
        worker_client_id: credentials.clientId,
        worker_capability: credentials.capability,
        subscription,
        is_enabled: true,
      }, { onConflict: 'worker_client_id' })
      .select('id,worker_client_id,worker_capability,subscription,is_enabled')
      .single();
    if (error) {
      console.error('Aurora: não foi possível salvar a inscrição Push no banco.', error);
      throw new Error('Os avisos foram configurados, mas não foi possível salvar a inscrição na conta.');
    }
    return {
      id: data.id,
      clientId: data.worker_client_id,
      capability: data.worker_capability,
      subscription: data.subscription,
      enabled: data.is_enabled,
    };
  }

  async deletePushSubscription(clientId) {
    const { error } = await this.client
      .from('push_subscriptions')
      .delete()
      .eq('user_id', this.userId)
      .eq('worker_client_id', clientId);
    if (error) {
      console.error('Aurora: não foi possível remover a inscrição Push do banco.', error);
      throw new Error('Não foi possível remover a inscrição Push da conta.');
    }
  }

  async clear() {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw new Error('Sem conexão com a internet. Os dados não foram apagados.');
    }
    const { error } = await this.client.rpc('clear_relational_data');
    if (error) {
      console.error('Aurora: não foi possível apagar os dados relacionais da conta.', error);
      throw new Error('Não foi possível apagar os dados relacionais; os dados restantes foram preservados.');
    }
    this.rawTables = null;
    this.rowVersions = new Map(TABLES.map((table) => [table, new Map()]));
  }
}
