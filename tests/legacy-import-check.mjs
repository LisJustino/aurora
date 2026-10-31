import assert from 'node:assert/strict';
import {
  inspectLegacySources,
  clearImportedBrowserStorage,
  containsRemovedStudyData,
  loadLegacySources,
  purgeRemovedStudyDataFromBrowserStorage,
  scanLegacyBrowserStorage,
  unlockLegacySources,
} from '../src/js/data/legacy-import.js';
import {
  hasAllExpectedRecords,
  prepareLegacyImport,
} from '../src/js/data/legacy-import-model.js';
import {
  createVault,
  encryptAccountSlice,
} from '../src/js/services/crypto-vault.js';

class MemoryStorage {
  constructor(values = {}) {
    this.values = new Map(Object.entries(values));
  }

  get length() {
    return this.values.size;
  }

  key(index) {
    return [...this.values.keys()][index] ?? null;
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.values.set(key, value);
  }

  removeItem(key) {
    this.values.delete(key);
  }
}

const userId = 'c8f73ed5-b6d6-4f4a-9c4a-93cbcb7477ac';
const removedStudyStorage = new MemoryStorage({
  'aurora.app.subjects': JSON.stringify({ v: [{ id: 'old-subject' }] }),
  'aurora.app.sessions': JSON.stringify({ v: [{ id: 'old-session' }] }),
  'aurora.app.timer': JSON.stringify({ v: { elapsedSeconds: 80 } }),
  [`aurora.user.${userId}.subjects`]: JSON.stringify({ v: { ciphertext: 'old' } }),
  'aurora.app.settings': JSON.stringify({
    v: {
      areas: { studies: true, habits: true },
      prefs: {
        studyGoalMin: 120,
        trash: [
          { id: 'study-trash', records: [{ collection: 'subjects', key: 'old-subject' }] },
          { id: 'other-trash', records: [{ collection: 'tasks', key: 'old-task' }] },
        ],
      },
    },
    t: 10,
  }),
});
purgeRemovedStudyDataFromBrowserStorage(removedStudyStorage, userId);
assert.equal(removedStudyStorage.getItem('aurora.app.subjects'), null);
assert.equal(removedStudyStorage.getItem('aurora.app.sessions'), null);
assert.equal(removedStudyStorage.getItem('aurora.app.timer'), null);
assert.equal(removedStudyStorage.getItem(`aurora.user.${userId}.subjects`), null);
const cleanedSettings = JSON.parse(removedStudyStorage.getItem('aurora.app.settings'));
assert.deepEqual(cleanedSettings.v.areas, { habits: true });
assert.equal(Object.hasOwn(cleanedSettings.v.prefs, 'studyGoalMin'), false);
assert.deepEqual(cleanedSettings.v.prefs.trash, [
  { id: 'other-trash', records: [{ collection: 'tasks', key: 'old-task' }] },
]);

assert.throws(
  () => purgeRemovedStudyDataFromBrowserStorage(new MemoryStorage({
    'aurora.app.settings': '{invalid',
    'aurora.app.subjects': JSON.stringify({ v: [{ id: 'preserve-on-error' }] }),
  }), userId),
  /nenhuma cópia foi apagada/,
);
for (const removedSlice of ['subjects', 'sessions', 'timer', 'studySessions', 'studyTimer']) {
  assert.equal(containsRemovedStudyData({ [removedSlice]: [] }), true);
}
assert.equal(containsRemovedStudyData({ areas: { studies: true } }), true);
assert.equal(containsRemovedStudyData({}, { prefs: { studyGoalMin: 60 } }), true);
assert.equal(containsRemovedStudyData({}, { prefs: {
  trash: [{ records: [{ collection: 'timer.subject' }] }],
} }), true);
assert.equal(containsRemovedStudyData({ tasks: [] }, { prefs: { trash: [] } }), false);

const vaultPassword = 'Aurora legacy import test passphrase!';
const vault = await createVault(vaultPassword, userId);
const encryptedTaskSlice = await encryptAccountSlice(vault.dataKey, userId, 'tasks', {
  v: [{ id: 'encrypted-task', title: 'Tarefa cifrada' }],
  t: 20,
});
const encryptedFinanceSlice = await encryptAccountSlice(vault.dataKey, userId, 'finance', {
  v: { accounts: [], tx: [], budgets: {}, goals: [], recurring: [] },
  t: 30,
});
const storage = new MemoryStorage({
  'aurora.app.tasks': JSON.stringify({ v: [{ id: 'legacy-task', title: 'Tarefa antiga' }], t: 10 }),
  [`aurora.user.${userId}.tasks`]: JSON.stringify({
    v: encryptedTaskSlice,
    t: 20,
  }),
  'aurora.user.other-user.tasks': JSON.stringify({ v: 1 }),
  'aurora.legacy.imported': 'true',
  'unrelated.preference': 'dark',
});
const browserData = scanLegacyBrowserStorage(storage, userId);
assert.deepEqual(Object.keys(browserData.plain), ['tasks']);
assert.deepEqual(Object.keys(browserData.encrypted), ['tasks']);
assert.deepEqual(browserData.markerKeys, ['aurora.legacy.imported']);
assert.deepEqual(browserData.unknownUserKeys, []);
assert.equal(Object.keys(browserData.snapshot).length, 2);

const original = browserData.snapshot['aurora.app.tasks'];
storage.setItem('aurora.app.tasks', JSON.stringify({ v: [{ id: 'newer' }], t: 11 }));
storage.setItem('unrelated.preference', 'light');
const cleanup = clearImportedBrowserStorage(storage, browserData.snapshot);
assert.deepEqual(cleanup.removed, [`aurora.user.${userId}.tasks`]);
assert.deepEqual(cleanup.changed, ['aurora.app.tasks']);
assert.equal(storage.getItem('aurora.app.tasks'), JSON.stringify({ v: [{ id: 'newer' }], t: 11 }));
assert.equal(storage.getItem('unrelated.preference'), 'light');
assert.equal(original.includes('legacy-task'), true);

const wrappedCacheStorage = new MemoryStorage({
  [`aurora.user.${userId}.tasks`]: JSON.stringify({ v: encryptedTaskSlice, t: 20 }),
});
const wrappedCache = scanLegacyBrowserStorage(wrappedCacheStorage, userId);
assert.deepEqual(wrappedCache.encrypted.tasks, encryptedTaskSlice);

const queryResults = {
  user_data: { data: [{ slice: 'finance', data: encryptedFinanceSlice }], error: null },
  user_keys: { data: vault.record, error: null },
};
const client = {
  from(table) {
    const result = queryResults[table];
    return {
      select() { return this; },
      eq() { return this; },
      maybeSingle() { return Promise.resolve(result); },
      then(resolve, reject) { return Promise.resolve(result).then(resolve, reject); },
    };
  },
};
const discovery = await inspectLegacySources({
  client,
  userId,
  browserData: wrappedCache,
});
assert.equal(discovery.requiresUnlock, true);
assert.equal(discovery.sources.length, 0);
assert.equal(discovery.encryptedBrowser.tasks.v, 1);
assert.equal(discovery.vaultRows.length, 1);
await assert.rejects(
  () => unlockLegacySources({ discovery, userId, password: 'wrong old vault password' }),
  /Essa senha não desbloqueou o cofre/,
);
const unlockedSources = await unlockLegacySources({
  discovery,
  userId,
  password: vaultPassword,
});
assert.equal(unlockedSources.vaultCount, 1);
assert.equal(unlockedSources.sources.length, 2);
const legacySources = await loadLegacySources({
  client,
  userId,
  password: vaultPassword,
  browserData: wrappedCache,
});
assert.equal(legacySources.vaultCount, 1);
assert.deepEqual(legacySources.sources.map(({ source, slice }) => [source, slice]), [
  ['browser-cache', 'tasks'],
  ['vault', 'finance'],
]);
assert.deepEqual(legacySources.sources[0].value, [{ id: 'encrypted-task', title: 'Tarefa cifrada' }]);
assert.deepEqual(legacySources.sources[1].value, {
  accounts: [], tx: [], budgets: {}, goals: [], recurring: [],
});
await assert.rejects(
  () => loadLegacySources({ client, userId, password: 'wrong old vault password', browserData: wrappedCache }),
  /Essa senha não desbloqueou o cofre/,
);
const browserOnlyClient = {
  from() {
    return {
      select() { return this; },
      eq() { return this; },
      then(resolve, reject) { return Promise.resolve({ data: [], error: null }).then(resolve, reject); },
    };
  },
};
const browserOnly = await inspectLegacySources({
  client: browserOnlyClient,
  userId,
  browserData: scanLegacyBrowserStorage(new MemoryStorage({
    'aurora.app.tasks': JSON.stringify({ v: [{ id: 'plain-task' }], t: 1 }),
  }), userId),
});
assert.equal(browserOnly.requiresUnlock, false);
assert.equal(browserOnly.sources.length, 1);
const browserOnlyDecoded = await unlockLegacySources({
  discovery: browserOnly,
  userId,
  password: '',
});
assert.equal(browserOnlyDecoded.sources[0].value[0].id, 'plain-task');
const missingVaultKeyClient = {
  from(table) {
    const result = table === 'user_data'
      ? { data: [], error: null }
      : { data: null, error: null };
    return {
      select() { return this; },
      eq() { return this; },
      maybeSingle() { return Promise.resolve(result); },
      then(resolve, reject) { return Promise.resolve(result).then(resolve, reject); },
    };
  },
};
await assert.rejects(
  () => inspectLegacySources({
    client: missingVaultKeyClient,
    userId,
    browserData: wrappedCache,
  }),
  /chave do cofre não foi encontrada/,
);

assert.throws(
  () => scanLegacyBrowserStorage(new MemoryStorage({
    'aurora.app.tasks': '{invalid',
  }), userId),
  /não é um JSON válido/,
);

const defaults = {
  tasks: [],
  habits: [],
  pomodoro: { elapsedSeconds: 0, startedAt: null },
  settings: {
    profile: { name: '', preferredName: '' },
    theme: 'rose',
    lists: [{ name: 'Pessoal' }],
    cats: { out: [], in: [] },
    prefs: { trash: [] },
    areas: { habits: false },
  },
  water: [],
  gym: { templates: [], logs: [] },
  finance: { accounts: [], tx: [], budgets: {}, goals: [], recurring: [] },
  cycle: [],
  cycleLog: {},
  weight: [],
};
const current = structuredClone(defaults);
current.tasks = [{ id: 'same-task', title: 'Versão da conta', tags: ['conta'], focusSeconds: 10 }];
current.habits = [{ id: 'same-habit', name: 'Alongar', completions: ['2026-10-28'], skipped: [] }];
const sources = [
  {
    source: 'browser',
    slice: 'tasks',
    savedAt: 10,
    value: [
      { id: 'same-task', title: 'Versão local', tags: ['local'], focusSeconds: 5 },
      { id: 'new-task', title: 'Nova tarefa', tags: [] },
    ],
  },
  {
    source: 'vault',
    slice: 'habits',
    savedAt: 20,
    value: [{ id: 'same-habit', name: 'Alongar', completions: ['2026-10-27'], skipped: [] }],
  },
  {
    source: 'vault',
    slice: 'settings',
    savedAt: 20,
    value: {
      ...defaults.settings,
      profile: { name: 'Pessoa', preferredName: 'Pessoa' },
      theme: 'lavender',
      lists: [{ name: 'Estudos' }],
      areas: { habits: true },
      prefs: { trash: [] },
    },
  },
];
const plan = prepareLegacyImport({
  currentState: current,
  sources,
  defaults,
  normalizeSlice: (slice, value) => ({ value, invalidCount: 0 }),
});
assert.equal(plan.state.tasks.length, 2);
assert.equal(plan.state.tasks.find((item) => item.id === 'same-task').title, 'Versão da conta');
assert.deepEqual(plan.state.tasks.find((item) => item.id === 'same-task').tags, ['conta', 'local']);
assert.deepEqual(plan.state.habits[0].completions.sort(), ['2026-10-27', '2026-10-28']);
assert.equal(plan.state.settings.profile.name, 'Pessoa');
assert.equal(plan.state.settings.theme, 'lavender');
assert.equal(plan.state.settings.areas.habits, true);
assert.deepEqual(plan.added, {
  tasks: 1,
  habits: 0,
  habitLogs: 1,
  water: 0,
  gym: 0,
  finance: 0,
  cycle: 0,
  weight: 0,
});
assert.equal(hasAllExpectedRecords(plan.state, plan.state), '');
assert.equal(hasAllExpectedRecords(plan.state, current), 'settings');
const incompleteHabits = structuredClone(plan.state);
incompleteHabits.habits[0].completions = ['2026-10-28'];
assert.equal(hasAllExpectedRecords(plan.state, incompleteHabits), 'habits');

console.log('legacy-import-check: all checks passed');
