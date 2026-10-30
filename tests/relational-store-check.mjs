import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { RelationalAccountStore } from '../src/js/data/relational-account-store.js';

for (const migrationName of [
  '20261028190000_relational_persistence.sql',
  '20261029021000_relational_upsert_conflict_target.sql',
]) {
  const migration = await readFile(new URL(`../supabase/migrations/${migrationName}`, import.meta.url), 'utf8');
  assert.match(migration, /when table_name in \('profiles', 'user_settings'\) then 'user_id'/i);
  assert.match(migration, /else 'id'\s+end;/i);
  assert.match(migration, /on conflict \(%I\) do update set %s/i);
  assert.doesNotMatch(migration, /on conflict\s+do update/i);
}
const settledDateMigration = await readFile(
  new URL('../supabase/migrations/20261029030000_finance_settled_date.sql', import.meta.url),
  'utf8',
);
assert.match(settledDateMigration, /add column if not exists settled_date date/i);
assert.doesNotMatch(settledDateMigration, /update\s+public\.finance_transactions/i);

const trashCollectionMigration = await readFile(
  new URL('../supabase/migrations/20261029040000_trash_cycle_collection.sql', import.meta.url),
  'utf8',
);
assert.match(trashCollectionMigration, /drop constraint if exists trash_records_collection_check/i);
assert.match(trashCollectionMigration, /'cycle', 'cycleLog'/i);
assert.match(trashCollectionMigration, /drop constraint if exists trash_records_entity_table_check/i);
assert.match(trashCollectionMigration, /'cycle_periods', 'cycle_days'/i);
assert.match(trashCollectionMigration, /validate constraint trash_records_collection_check/i);
assert.match(trashCollectionMigration, /validate constraint trash_records_entity_table_check/i);
assert.doesNotMatch(trashCollectionMigration, /invalid_collection_count/i);
assert.doesNotMatch(trashCollectionMigration, /invalid_entity_table_count/i);

const studyRemovalMigration = await readFile(
  new URL('../supabase/migrations/20261029050000_remove_studies.sql', import.meta.url),
  'utf8',
);
assert.match(studyRemovalMigration, /delete from public\.user_data where slice in \('subjects', 'sessions', 'timer'\)/i);
assert.match(studyRemovalMigration, /drop table if exists public\.study_sessions/i);
assert.match(studyRemovalMigration, /drop table if exists public\.study_subjects/i);
assert.match(studyRemovalMigration, /drop column if exists subject_id/i);
assert.match(studyRemovalMigration, /check \(timer_kind = 'pomodoro'\)/i);
assert.match(studyRemovalMigration, /slice_count <> 10/i);
const activeAllowlist = studyRemovalMigration.match(
  /table_allowlist constant text\[\] := array\[([\s\S]*?)\];/i,
);
assert.ok(activeAllowlist);
assert.doesNotMatch(activeAllowlist[1], /study_subjects|study_sessions/i);

const rlsIsolationTest = await readFile(
  new URL('../supabase/tests/rls_isolation.sql', import.meta.url),
  'utf8',
);
assert.match(rlsIsolationTest, /valid-trash-a/i);
assert.match(rlsIsolationTest, /when check_violation/i);
assert.match(rlsIsolationTest, /User A inserted trash for User B/i);

const userId = 'c8f73ed5-b6d6-4f4a-9c4a-93cbcb7477ac';
const writes = [];
const client = {
  async rpc(name, args) {
    writes.push({ name, args });
    return { error: null };
  },
};
const state = {
  settings: {
    profile: { name: 'Pessoa', preferredName: 'Pessoa' },
    areas: { finances: true },
    lists: [],
    cats: { out: [], in: [] },
    prefs: {
      trash: [{
        id: 'trashed-cycle-period',
        deletedAt: Date.parse('2026-10-29T12:00:00Z'),
        label: 'Ciclo: período removido',
        records: [{
          collection: 'cycle',
          key: '2026-10-10|2026-10-12',
          index: 0,
          value: { start: '2026-10-10', end: '2026-10-12' },
        }],
      }],
      birthday: { month: 10, day: 29, ageAtReference: 26, referenceDate: '2026-10-29' },
      birthdayCorrectionUsed: false,
    },
    onboardingComplete: true,
    introSeen: true,
  },
  tasks: [{ id: 'legacy-task-id', title: 'Tarefa', done: false, priority: 'normal', subtasks: [], tags: [] }],
  pomodoro: { elapsedSeconds: 0, startedAt: null, phase: 'focus', phaseElapsedSeconds: 0, completedPomodoros: 0, dailyCompletedPomodoros: 0, history: {} },
  habits: [],
  water: [{ id: 'water-log-1', ml: 250, at: '2026-10-29T12:00:00.000Z' }],
  gym: { templates: [], logs: [] },
  finance: {
    accounts: [{ id: 'account-1', name: 'Conta', type: 'checking', initialCents: 0 }],
    tx: [
      { id: 'tx-1', type: 'out', accountId: 'account-1', cents: 1234, date: '2026-10-28', settledDate: '2026-10-29', desc: 'Teste' },
      { id: 'tx-legacy', type: 'in', accountId: 'account-1', cents: 2500, date: '2026-10-27', desc: 'Antigo' },
    ],
    budgets: { Mercado: { cents: 5000 } },
    goals: [],
    recurring: [],
  },
  cycle: [{ start: '2026-10-25', end: '2026-10-29' }],
  cycleLog: {},
  weight: [],
};

const store = new RelationalAccountStore(client, userId);
await store.save(state);
assert.equal(writes.length, 1);
assert.equal(writes[0].name, 'apply_relational_changes');
const changeByTable = new Map(writes[0].args.p_changes.map((change) => [change.table, change.rows]));
assert.equal(changeByTable.get('tasks')[0].legacy_id, 'legacy-task-id');
assert.equal(changeByTable.get('finance_transactions')[0].amount_cents, 1234);
assert.equal(changeByTable.get('finance_transactions')[0].settled_date, '2026-10-29');
assert.equal(changeByTable.get('finance_transactions')[1].settled_date, null);
assert.equal(changeByTable.get('finance_transactions')[0].user_id, userId);
assert.equal(changeByTable.get('finance_budgets')[0].amount_cents, 5000);
assert.equal(changeByTable.get('cycle_periods')[0].start_date, '2026-10-25');
assert.equal(changeByTable.get('cycle_periods')[0].end_date, '2026-10-29');
assert.equal(changeByTable.get('water_logs')[0].amount_ml, 250);
assert.equal(changeByTable.get('water_logs')[0].recorded_at, '2026-10-29T12:00:00.000Z');
const trashedPeriod = changeByTable.get('cycle_periods').find((row) => row.start_date === '2026-10-10');
assert.ok(trashedPeriod?.deleted_at);
assert.equal(changeByTable.get('trash_records')[0].entity_table, 'cycle_periods');
assert.equal(changeByTable.get('trash_records')[0].record_key, '2026-10-10|2026-10-12');
assert.equal(changeByTable.get('profiles')[0].display_name, 'Pessoa');
assert.equal(changeByTable.get('user_settings')[0].preferences.onboardingComplete, true);
assert.equal(changeByTable.get('user_settings')[0].preferences.introSeen, true);
assert.deepEqual(changeByTable.get('user_settings')[0].preferences.birthday, {
  month: 10, day: 29, ageAtReference: 26, referenceDate: '2026-10-29',
});
assert.equal(changeByTable.get('user_settings')[0].preferences.birthdayCorrectionUsed, false);
assert.deepEqual(changeByTable.get('user_settings')[0].enabled_areas, { finances: true });
assert.equal(changeByTable.has('push_subscriptions'), false);
assert.equal(changeByTable.has('study_subjects'), false);
assert.equal(changeByTable.has('study_sessions'), false);
assert.equal(changeByTable.get('timer_state')[0].timer_kind, 'pomodoro');
assert.equal(Object.hasOwn(changeByTable.get('timer_state')[0], 'subject_id'), false);

const loadClient = {
  from(table) {
    return {
      select() {
        return this;
      },
      async range() {
        return { data: changeByTable.get(table) || [], error: null };
      },
    };
  },
};
const loadedState = await new RelationalAccountStore(loadClient, userId).load();
assert.equal(loadedState.finance.tx[0].settledDate, '2026-10-29');
assert.equal(loadedState.finance.tx[1].settledDate, undefined);
assert.deepEqual(loadedState.cycle, [{ start: '2026-10-25', end: '2026-10-29', sample: undefined }]);
assert.deepEqual(loadedState.water, [{
  id: 'water-log-1',
  ml: 250,
  at: '2026-10-29T12:00:00.000Z',
  sample: undefined,
}]);
const trashedPeriodRecord = loadedState.settings.prefs.trash[0].records[0];
assert.equal(trashedPeriodRecord.collection, 'cycle');
assert.equal(trashedPeriodRecord.key, '2026-10-10|2026-10-12');
assert.deepEqual(trashedPeriodRecord.value, {
  start: '2026-10-10',
  end: '2026-10-12',
  sample: undefined,
});

const saveErrorClient = {
  async rpc() {
    return {
      error: {
        code: '23514',
        message: 'A alteração não atende a uma regra do banco.',
        details: 'valor privado',
        hint: 'dica interna',
      },
    };
  },
};
const originalConsoleError = console.error;
console.error = () => {};
try {
  await assert.rejects(
    () => new RelationalAccountStore(saveErrorClient, userId).save(state),
    (error) => {
      assert.match(error.message, /Código 23514/);
      assert.match(error.message, /A alteração não atende a uma regra do banco/);
      assert.doesNotMatch(error.message, /valor privado|dica interna/);
      return true;
    },
  );
} finally {
  console.error = originalConsoleError;
}

const accountRows = {
  user_settings: [{
    id: userId,
    user_id: userId,
    preferences: { onboardingComplete: true, introSeen: true },
    enabled_areas: { finances: true },
  }],
};
const loadingClient = {
  from(table) {
    return {
      select() { return this; },
      async range() { return { data: accountRows[table] || [], error: null }; },
    };
  },
};
const loaded = await new RelationalAccountStore(loadingClient, userId).load();
assert.ok(Array.isArray(loaded.tasks));
assert.ok(Array.isArray(loaded.habits));
assert.deepEqual(loaded.finance.budgets, {});
assert.equal(loaded.settings.onboardingComplete, true);
assert.equal(loaded.settings.introSeen, true);
assert.deepEqual(loaded.settings.areas, { finances: true });

const failedClient = {
  from() {
    return {
      select() { return this; },
      async range() { return { data: null, error: new Error('unavailable') }; },
    };
  },
};
console.error = () => {};
try {
  await assert.rejects(
    () => new RelationalAccountStore(failedClient, userId).load(),
    /Não foi possível carregar todos os dados da conta/,
  );
} finally {
  console.error = originalConsoleError;
}

console.log('relational-store-check: all checks passed');
