import { $ } from '../utils/dom.js';
import { newId } from '../utils/ids.js';
import { isPlainObject } from '../core/data-integrity.js';
import { hasCurrentCycleDataConsent } from '../services/account-auth.js';
import { createBirthdayReferenceFromParts } from '../features/profile/birthday.js';
import { isTrashExpired } from '../features/trash/model.js';
import { cyclePeriodKey, syncLatestCycleWeight } from './cycle.js';
import { render } from './render.js';
import { toast } from './samples-backup.js';
import {
  accountSession,
  defaults,
  isValidTrashEntry,
  normalizeSlice,
  S,
  sameJsonValue,
  setS,
  SLICES,
  stamps,
  syncState,
  ui,
} from './state.js';

// Persistência (local e relacional)
export const Persist = {
  userId: '',
  store: null,
  inFlight: null,
  pendingSnapshot: null,
  confirmedState: null,
  rawTables: null,
  replacing: false,
  async attach({ client, user }) {
    const { RelationalAccountStore } = await import('../data/relational-account-store.js');
    this.userId = user.id;
    this.store = new RelationalAccountStore(client, user.id);
    this.confirmedState = null;
    ui.persistError = '';
  },
  save(slice) {
    return this.saveMany([slice]);
  },
  saveMany(slices) {
    if (this.replacing || !this.store || slices.some((slice) => !SLICES.includes(slice))) return false;
    if (ui.persistBlocked.size || Object.keys(ui.integrityIssues).length) {
      slices.forEach((slice) => ui.persistFailed.add(slice));
      toast('Há dados que precisam de revisão antes de salvar. Nenhuma área foi enviada para a nuvem.', 'error');
      return false;
    }
    if (navigator.onLine === false) {
      if (this.confirmedState) setS(JSON.parse(JSON.stringify(this.confirmedState)));
      ui.persistError = '';
      slices.forEach((slice) => {
        ui.persistFailed.add(slice);
        syncState.failed.add(slice);
      });
      toast('Sem conexão: a alteração foi desfeita e não foi salva. Conecte-se e tente novamente.', 'error');
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
      return (
        syncState.pending.size === 0 &&
        syncState.failed.size === 0 &&
        ui.persistFailed.size === 0 &&
        ui.persistBlocked.size === 0
      );
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
          let saveTimer = 0;
          const saveTimeout = new Promise((_, reject) => {
            saveTimer = setTimeout(
              () => reject(new Error('A nuvem não respondeu a tempo. Verifique sua conexão e tente novamente.')),
              30000,
            );
          });
          try {
            await Promise.race([this.store.save(snapshot, this.confirmedState), saveTimeout]);
          } finally {
            clearTimeout(saveTimer);
          }
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
              setS(JSON.parse(JSON.stringify(this.confirmedState)));
            }
          }
          const isVersionConflict = error instanceof Error && error.code === 'version_conflict';
          syncState.pending.forEach((slice) => syncState.failed.add(slice));
          syncState.failed.add('account');
          syncState.pending.clear();
          ui.persistFailed.add('account');
          ui.persistError =
            error instanceof Error
              ? error.message.replace(/^Não foi possível salvar as alterações na conta\.\s*/, '').slice(0, 200)
              : '';
          if (isVersionConflict) {
            syncState.conflicts.add('account');
          } else {
            console.error('Aurora: a gravação relacional não foi confirmada.', error);
            toast(
              error instanceof Error
                ? error.message
                : 'Não foi possível salvar. Tente novamente quando a conexão estiver estável.',
              'error',
            );
          }
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
      toast('Ainda sem conexão. As alterações não foram enviadas.', 'info');
      return;
    }
    if (this.pendingSnapshot) {
      ui.persistError = '';
      setS(JSON.parse(JSON.stringify(this.pendingSnapshot)));
      syncState.pending.add('account');
      syncState.failed.delete('account');
      ui.persistFailed.delete('account');
      void this.flush();
      render();
    }
  },
  async replaceAll() {
    if (!this.store) throw new Error('A conta não está pronta para restaurar dados.');
    if (!hasCurrentCycleDataConsent(accountSession?.user)) {
      throw new Error(
        'Para restaurar um backup e substituir os dados da conta, registre primeiro o consentimento específico de Ciclo. Assim, os registros de saúde existentes não serão alterados sem autorização.',
      );
    }
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
  },
};
export async function loadAccountData() {
  const loaded = await Persist.store.load({
    includeCycle: hasCurrentCycleDataConsent(accountSession?.user),
  });
  const next = defaults();
  const integrityIssues = {};
  const persistBlocked = new Set();
  const persistFailed = new Set();
  for (const slice of SLICES) {
    const normalized = normalizeSlice(slice, loaded[slice] ?? next[slice]);
    next[slice] = normalized.value;
    if (normalized.invalidCount) {
      integrityIssues[slice] = normalized.invalidCount;
      persistBlocked.add(slice);
      persistFailed.add(slice);
    }
  }
  Object.assign(S, next);
  ui.financeValuesHidden = S.settings.prefs.financeValuesHidden;
  Persist.rawTables = Persist.store.rawTables;
  for (const slice of SLICES) stamps[slice] = Date.now();
  ui.integrityIssues = integrityIssues;
  ui.persistBlocked = persistBlocked;
  ui.persistFailed = persistFailed;
  syncState.failed.clear();
  persistFailed.forEach((slice) => syncState.failed.add(slice));
  Persist.confirmedState = JSON.parse(JSON.stringify(S));
}
export function initializeBirthdayFromMetadata(user) {
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
export const saveSlices = (...ks) => {
  if (ui.preview) return true;
  const saved = Persist.saveMany([...new Set(ks)]);
  if (!saved && navigator.onLine !== false) {
    toast('Não foi possível preparar a gravação. Os dados originais continuam na tela; tente novamente.', 'error');
  }
  return saved;
};
export const commit = (...ks) => {
  if (saveSlices(...ks)) render();
};
const cloneSlice = (slice) => JSON.parse(JSON.stringify(S[slice]));
export function snapshotSlices(slices) {
  return Object.fromEntries(slices.map((slice) => [slice, cloneSlice(slice)]));
}
export function restoreSliceSnapshot(snapshot) {
  Object.entries(snapshot).forEach(([slice, value]) => {
    S[slice] = value;
  });
}
export function saveSlicesWithRollback(slices, snapshot, shouldRender = true, context = 'a lixeira') {
  const blocked = slices.filter((slice) => ui.persistBlocked.has(slice));
  if (blocked.length) {
    restoreSliceSnapshot(snapshot);
    toast(
      `Não foi possível salvar ${context} porque os dados de ${blocked.join(', ')} estão bloqueados para gravação.`,
      'error',
    );
    if (shouldRender) render();
    return false;
  }
  if (!ui.preview && !Persist.saveMany(slices)) {
    restoreSliceSnapshot(snapshot);
    toast(`Não foi possível preparar ${context} para salvar; os dados originais foram mantidos.`, 'error');
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
export function createTrashRecord(collection, key, index, value) {
  return { collection, key, index, value: JSON.parse(JSON.stringify(value)) };
}
export function moveRecordsToTrash(label, records, sourceSlices, removeRecords) {
  if (!records.length) return null;
  const slices = [...new Set([...sourceSlices, 'settings'])];
  if (slices.some((slice) => ui.persistBlocked.has(slice))) {
    toast('Não foi possível usar a lixeira porque os dados desta área estão bloqueados para gravação.', 'error');
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
export function moveFinanceTransactionsToTrash(transactions) {
  const removed = transactions.filter((transaction) => S.finance.tx.includes(transaction));
  if (!removed.length) return false;
  const records = removed.map((transaction) =>
    createTrashRecord('finance.tx', transaction.id, S.finance.tx.indexOf(transaction), transaction),
  );
  const first = removed[0];
  const label =
    removed.length > 1
      ? `Lançamentos financeiros (${removed.length})`
      : `Lançamento: ${first.desc || first.category || 'Finanças'}`;
  const entry = moveRecordsToTrash(label, records, ['finance'], () => {
    const ids = new Set(removed.map((transaction) => transaction.id));
    S.finance.tx = S.finance.tx.filter((transaction) => !ids.has(transaction.id));
    ui.dlg = null;
  });
  if (entry)
    toast(
      removed.length > 1 ? 'Lançamentos movidos para a lixeira.' : 'Lançamento movido para a lixeira.',
      'action',
      () => restoreTrashEntry(entry.id),
    );
  return Boolean(entry);
}
function trashCollection(draft, collection) {
  if (collection === 'cycleLog') return draft.cycleLog;
  if (collection === 'finance.budgets') return draft.finance.budgets;
  if (collection.startsWith('finance.')) return draft.finance[collection.slice('finance.'.length)];
  return draft[collection];
}
export function restoreTrashEntry(id) {
  const entry = S.settings.prefs.trash.find((item) => item.id === id);
  if (!entry) return false;
  if (isTrashExpired(entry)) {
    const snapshot = snapshotSlices(['settings']);
    S.settings.prefs.trash = S.settings.prefs.trash.filter((item) => item.id !== id);
    saveSlicesWithRollback(['settings'], snapshot);
    toast('O prazo de 30 dias terminou; o item foi removido da lixeira.', 'success');
    return false;
  }
  if (!isValidTrashEntry(entry)) {
    console.error('Aurora: o item da lixeira não passou pela validação antes da restauração.', id);
    toast('Este item não pode ser restaurado com segurança. Ele continua na lixeira.', 'error');
    return false;
  }
  const dataSlices = [...new Set(entry.records.map((record) => trashSlice(record.collection)))];
  const restoresCycleWeight = entry.records.some(
    (record) => record.collection === 'cycleLog' && Number.isFinite(record.value.weightKg),
  );
  const slices = [...new Set([...dataSlices, 'settings', ...(restoresCycleWeight ? ['habits'] : [])])];
  if (slices.some((slice) => ui.persistBlocked.has(slice))) {
    toast('Não é possível restaurar enquanto os dados de destino estiverem bloqueados para gravação.', 'error');
    return false;
  }
  const snapshot = snapshotSlices(slices);
  const drafts = Object.fromEntries(dataSlices.map((slice) => [slice, cloneSlice(slice)]));
  const records = [...entry.records].sort((a, b) => {
    const rank = (record) =>
      record.collection === 'finance.accounts'
        ? 0
        : record.collection === 'finance.tx'
          ? 1
          : record.collection === 'finance.recurring'
            ? 2
            : 3;
    return rank(a) - rank(b) || a.index - b.index;
  });
  for (const record of records) {
    const target = trashCollection(drafts, record.collection);
    if (Array.isArray(target)) {
      const alreadyExists =
        record.collection === 'cycle'
          ? target.some((item) => cyclePeriodKey(item) === record.key)
          : target.some((item) => item.id === record.key);
      if (alreadyExists) {
        toast('Um registro com o mesmo identificador já existe. O item continua na lixeira.', 'info');
        return false;
      }
      target.splice(Math.min(record.index, target.length), 0, record.value);
    } else if (isPlainObject(target)) {
      if (Object.hasOwn(target, record.key)) {
        toast('Já existe um registro com a mesma chave. O item continua na lixeira.', 'info');
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
      toast('Este item não pode ser restaurado com segurança. Ele continua na lixeira.', 'error');
      return false;
    }
  }
  const accounts = new Set(drafts.finance?.accounts.map((account) => account.id) || []);
  for (const record of entry.records) {
    if (record.collection === 'finance.tx') {
      const transaction = record.value;
      if (
        !accounts.has(transaction.accountId) ||
        (transaction.type === 'tr' && !accounts.has(transaction.toAccountId))
      ) {
        toast('Restaure primeiro a conta vinculada. O item continua na lixeira.', 'info');
        return false;
      }
    }
    if (record.collection === 'finance.recurring' && !accounts.has(record.value.accountId)) {
      toast('Restaure primeiro a conta vinculada. O item continua na lixeira.', 'info');
      return false;
    }
    if (record.collection === 'finance.goals' && record.value.linkedAccountId) {
      if (!accounts.has(record.value.linkedAccountId)) {
        toast('Restaure primeiro a conta vinculada. O objetivo continua na lixeira.', 'info');
        return false;
      }
      if (drafts.finance.goals.some((goal) => goal.linkedAccountId === record.value.linkedAccountId)) {
        toast('A conta já acompanha outro objetivo. Desvincule-a primeiro; o item continua na lixeira.', 'info');
        return false;
      }
    }
  }
  dataSlices.forEach((slice) => {
    S[slice] = drafts[slice];
  });
  S.settings.prefs.trash = S.settings.prefs.trash.filter((item) => item.id !== id);
  if (restoresCycleWeight) syncLatestCycleWeight();
  if (!saveSlicesWithRollback(slices, snapshot)) return false;
  toast(`${entry.label} restaurado.`, 'success');
  requestAnimationFrame(() => {
    const heading = $('#trash-title');
    if (heading) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
  });
  return true;
}
export function purgeExpiredTrash() {
  const current = S.settings.prefs.trash;
  const remaining = current.filter((entry) => !isTrashExpired(entry));
  if (remaining.length === current.length || ui.persistBlocked.has('settings')) return;
  const snapshot = snapshotSlices(['settings']);
  S.settings.prefs.trash = remaining;
  saveSlicesWithRollback(['settings'], snapshot, false);
}
