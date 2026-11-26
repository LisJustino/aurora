import { $ } from '../utils/dom.js';
import { newId } from '../utils/ids.js';
import { isPlainObject } from '../core/data-integrity.js';
import { clearOfflinePending, readOfflinePending, writeOfflinePending } from '../data/offline-queue.js';
import { hasCurrentCycleDataConsent } from '../services/cycle-consent.js';
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
  offlineQueuedCount: 0,
  offlineQueuedSlices: new Set(),
  confirmedState: null,
  rawTables: null,
  replacing: false,
  async attach({ client, user, prefetchedAccountLoad = null }) {
    const { RelationalAccountStore } = await import('../data/relational-account-store.js');
    this.userId = user.id;
    this.store = new RelationalAccountStore(client, user.id, { prefetchedAccountLoad });
    this.confirmedState = null;
    this.offlineQueuedCount = 0;
    this.offlineQueuedSlices.clear();
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
    if (navigator.onLine === false) {
      const wasEmpty = this.offlineQueuedCount === 0;
      this.offlineQueuedCount += 1;
      slices.forEach((slice) => this.offlineQueuedSlices.add(slice));
      void writeOfflinePending(this.userId, {
        snapshot: this.pendingSnapshot,
        slices: [...this.offlineQueuedSlices],
        count: this.offlineQueuedCount,
      });
      if (wasEmpty) {
        toast('Sem conexão: alteração salva neste aparelho e será sincronizada ao reconectar.', 'info');
      }
      return true;
    }
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
      if (this.userId) {
        void writeOfflinePending(this.userId, {
          snapshot: this.pendingSnapshot,
          slices: [...(this.offlineQueuedSlices.size ? this.offlineQueuedSlices : syncState.pending)],
          count: Math.max(1, this.offlineQueuedCount),
        });
      }
      return false;
    }
    const hadOfflineQueue = this.offlineQueuedCount > 0;
    const task = (async () => {
      let supersededRetries = 0;
      while (this.pendingSnapshot) {
        const snapshot = this.pendingSnapshot;
        this.pendingSnapshot = null;
        try {
          const controller = typeof AbortController === 'function' ? new AbortController() : null;
          let saveTimer = 0;
          const saveTimeout = new Promise((_, reject) => {
            saveTimer = setTimeout(() => {
              controller?.abort();
              reject(new Error('A nuvem não respondeu a tempo. Verifique sua conexão e tente novamente.'));
            }, 30000);
          });
          try {
            await Promise.race([
              this.store.save(snapshot, this.confirmedState, { signal: controller?.signal }),
              saveTimeout,
            ]);
          } finally {
            clearTimeout(saveTimer);
          }
          this.confirmedState = JSON.parse(JSON.stringify(snapshot));
          supersededRetries = 0;
          this.offlineQueuedCount = 0;
          this.offlineQueuedSlices.clear();
          void clearOfflinePending(this.userId);
          syncState.pending.clear();
          syncState.failed.clear();
          syncState.conflicts.clear();
          ui.persistFailed.clear();
          ui.persistError = '';
        } catch (error) {
          const isVersionConflict = error instanceof Error && error.code === 'version_conflict';
          if (navigator.onLine === false && !isVersionConflict) {
            if (!this.pendingSnapshot) this.pendingSnapshot = snapshot;
            this.offlineQueuedCount = Math.max(1, this.offlineQueuedCount);
            syncState.pending.forEach((slice) => this.offlineQueuedSlices.add(slice));
            void writeOfflinePending(this.userId, {
              snapshot: this.pendingSnapshot,
              slices: [...this.offlineQueuedSlices],
              count: this.offlineQueuedCount,
            });
            return false;
          }
          if (this.pendingSnapshot && !isVersionConflict && navigator.onLine !== false && supersededRetries < 2) {
            supersededRetries += 1;
            console.error('Aurora: uma gravação anterior falhou; tentando enviar a alteração mais recente.', error);
            continue;
          }
          if (!this.pendingSnapshot) {
            this.pendingSnapshot = snapshot;
            if (this.confirmedState && sameJsonValue(S, snapshot)) {
              setS(JSON.parse(JSON.stringify(this.confirmedState)));
            }
          } else if (this.confirmedState && sameJsonValue(S, this.pendingSnapshot)) {
            setS(JSON.parse(JSON.stringify(this.confirmedState)));
          }
          syncState.pending.forEach((slice) => syncState.failed.add(slice));
          syncState.failed.add('account');
          syncState.pending.clear();
          ui.persistFailed.add('account');
          ui.persistError =
            error instanceof Error
              ? error.message.replace(/^Não foi possível salvar as alterações na conta\.\s*/, '').slice(0, 200)
              : '';
          if (isVersionConflict) {
            this.offlineQueuedCount = 0;
            this.offlineQueuedSlices.clear();
            void clearOfflinePending(this.userId);
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
      if (hadOfflineQueue) {
        toast('Alterações offline sincronizadas com sucesso.', 'success');
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
      toast('Ainda sem conexão. Suas alterações continuam salvas neste aparelho.', 'info');
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
    this.offlineQueuedCount = 0;
    this.offlineQueuedSlices.clear();
    void clearOfflinePending(this.userId);
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
    this.offlineQueuedCount = 0;
    this.offlineQueuedSlices.clear();
    void clearOfflinePending(this.userId);
    this.rawTables = null;
    this.confirmedState = JSON.parse(JSON.stringify(defaults()));
    syncState.pending.clear();
    syncState.failed.clear();
    syncState.conflicts.clear();
  },
  wipe() {
    const previousUserId = this.userId;
    this.pendingSnapshot = null;
    this.offlineQueuedCount = 0;
    this.offlineQueuedSlices.clear();
    if (previousUserId) void clearOfflinePending(previousUserId);
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
  if (Persist.userId && !persistBlocked.size) {
    const queued = await readOfflinePending(Persist.userId);
    if (queued?.snapshot) {
      const targetSlices = queued.slices.length ? queued.slices.filter((slice) => SLICES.includes(slice)) : SLICES;
      let appliedAny = false;
      for (const slice of targetSlices) {
        if (!Object.hasOwn(queued.snapshot, slice)) continue;
        const normalized = normalizeSlice(slice, queued.snapshot[slice]);
        if (!normalized.invalidCount) {
          S[slice] = normalized.value;
          Persist.offlineQueuedSlices.add(slice);
          syncState.pending.add(slice);
          appliedAny = true;
        }
      }
      if (appliedAny) {
        ui.financeValuesHidden = S.settings.prefs.financeValuesHidden;
        Persist.offlineQueuedCount = queued.count;
        Persist.pendingSnapshot = JSON.parse(JSON.stringify(S));
        if (navigator.onLine !== false) void Persist.flush();
      } else {
        void clearOfflinePending(Persist.userId);
      }
    }
  }
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
export function deleteTrashEntryPermanently(id) {
  const entry = S.settings.prefs.trash.find((item) => item.id === id);
  if (!entry) return false;
  if (ui.persistBlocked.has('settings')) {
    toast('Não é possível excluir da lixeira enquanto as preferências estiverem bloqueadas para gravação.', 'error');
    return false;
  }
  const snapshot = snapshotSlices(['settings']);
  S.settings.prefs.trash = S.settings.prefs.trash.filter((item) => item.id !== id);
  if (!saveSlicesWithRollback(['settings'], snapshot, true, 'a exclusão definitiva da lixeira')) return false;
  toast('Item excluído permanentemente.', 'info');
  requestAnimationFrame(() => {
    const heading = $('#trash-title');
    if (heading) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
  });
  return true;
}
export function emptyTrashEntries(ids = null) {
  if (ui.persistBlocked.has('settings')) {
    toast('Não é possível esvaziar a lixeira enquanto as preferências estiverem bloqueadas para gravação.', 'error');
    return 0;
  }
  const current = S.settings.prefs.trash;
  if (!current.length) return 0;
  const targetIds = Array.isArray(ids) ? new Set(ids) : null;
  const remaining = targetIds ? current.filter((entry) => !targetIds.has(entry.id)) : [];
  const removedCount = current.length - remaining.length;
  if (!removedCount) return 0;
  const snapshot = snapshotSlices(['settings']);
  S.settings.prefs.trash = remaining;
  if (!remaining.length) {
    ui.trashFilter = 'all';
    ui.trashQuery = '';
  }
  if (!saveSlicesWithRollback(['settings'], snapshot, true, 'a limpeza da lixeira')) return 0;
  toast(
    targetIds && remaining.length
      ? `${removedCount} ${removedCount === 1 ? 'item excluído' : 'itens excluídos'} permanentemente.`
      : 'Lixeira esvaziada.',
    'info',
  );
  requestAnimationFrame(() => {
    const heading = $('#trash-title');
    if (heading) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
  });
  return removedCount;
}
export function restoreTrashEntries(ids) {
  const idSet = new Set(Array.isArray(ids) ? ids : []);
  if (!idSet.size) return { restored: 0, skipped: 0 };
  const candidates = S.settings.prefs.trash
    .filter((entry) => idSet.has(entry.id) && !isTrashExpired(entry) && isValidTrashEntry(entry))
    .sort((a, b) => {
      const rank = (entry) =>
        entry.records.some((record) => record.collection === 'finance.accounts')
          ? 0
          : entry.records.some((record) => record.collection.startsWith('finance.'))
            ? 1
            : 2;
      return rank(a) - rank(b) || a.deletedAt - b.deletedAt;
    });
  if (!candidates.length) return { restored: 0, skipped: 0 };

  const allDataSlices = [
    ...new Set(candidates.flatMap((entry) => entry.records.map((record) => trashSlice(record.collection)))),
  ];
  const restoresAnyCycleWeight = candidates.some((entry) =>
    entry.records.some((record) => record.collection === 'cycleLog' && Number.isFinite(record.value.weightKg)),
  );
  const slices = [...new Set([...allDataSlices, 'settings', ...(restoresAnyCycleWeight ? ['habits'] : [])])];
  if (slices.some((slice) => ui.persistBlocked.has(slice))) {
    toast('Não é possível restaurar enquanto os dados de destino estiverem bloqueados para gravação.', 'error');
    return { restored: 0, skipped: candidates.length };
  }

  const snapshot = snapshotSlices(slices);
  const drafts = Object.fromEntries(allDataSlices.map((slice) => [slice, cloneSlice(slice)]));
  const restoredIds = new Set();
  let skipped = 0;

  for (const entry of candidates) {
    const entrySlices = [...new Set(entry.records.map((record) => trashSlice(record.collection)))];
    const entryDrafts = Object.fromEntries(
      entrySlices.map((slice) => [slice, JSON.parse(JSON.stringify(drafts[slice]))]),
    );
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
    let ok = true;
    for (const record of records) {
      const target = trashCollection(entryDrafts, record.collection);
      if (Array.isArray(target)) {
        const alreadyExists =
          record.collection === 'cycle'
            ? target.some((item) => cyclePeriodKey(item) === record.key)
            : target.some((item) => item.id === record.key);
        if (alreadyExists) {
          ok = false;
          break;
        }
        target.splice(Math.min(record.index, target.length), 0, record.value);
      } else if (isPlainObject(target)) {
        if (Object.hasOwn(target, record.key)) {
          ok = false;
          break;
        }
        Object.defineProperty(target, record.key, {
          value: record.value,
          enumerable: true,
          writable: true,
          configurable: true,
        });
      } else {
        ok = false;
        break;
      }
    }
    if (ok && entryDrafts.finance) {
      const accounts = new Set(entryDrafts.finance.accounts.map((account) => account.id));
      for (const record of entry.records) {
        if (record.collection === 'finance.tx') {
          const tx = record.value;
          if (!accounts.has(tx.accountId) || (tx.type === 'tr' && !accounts.has(tx.toAccountId))) {
            ok = false;
            break;
          }
        }
        if (record.collection === 'finance.recurring' && !accounts.has(record.value.accountId)) {
          ok = false;
          break;
        }
        if (record.collection === 'finance.goals' && record.value.linkedAccountId) {
          if (
            !accounts.has(record.value.linkedAccountId) ||
            entryDrafts.finance.goals.filter((goal) => goal.linkedAccountId === record.value.linkedAccountId).length > 1
          ) {
            ok = false;
            break;
          }
        }
      }
    }
    if (ok) {
      entrySlices.forEach((slice) => {
        drafts[slice] = entryDrafts[slice];
      });
      restoredIds.add(entry.id);
    } else {
      skipped++;
    }
  }

  if (!restoredIds.size) {
    toast('Não foi possível restaurar os itens selecionados. Eles continuam na lixeira.', 'info');
    return { restored: 0, skipped };
  }

  allDataSlices.forEach((slice) => {
    S[slice] = drafts[slice];
  });
  S.settings.prefs.trash = S.settings.prefs.trash.filter((item) => !restoredIds.has(item.id));
  if (!S.settings.prefs.trash.length) {
    ui.trashFilter = 'all';
    ui.trashQuery = '';
  }
  if (restoresAnyCycleWeight) syncLatestCycleWeight();
  if (!saveSlicesWithRollback(slices, snapshot)) return { restored: 0, skipped: candidates.length };

  const count = restoredIds.size;
  toast(
    skipped
      ? `${count} ${count === 1 ? 'item restaurado' : 'itens restaurados'}; ${skipped} ${skipped === 1 ? 'permaneceu' : 'permaneceram'} na lixeira.`
      : `${count} ${count === 1 ? 'item restaurado' : 'itens restaurados'}.`,
    'success',
  );
  requestAnimationFrame(() => {
    const heading = $('#trash-title');
    if (heading) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
  });
  return { restored: count, skipped };
}
export function purgeExpiredTrash() {
  const current = S.settings.prefs.trash;
  const remaining = current.filter((entry) => !isTrashExpired(entry));
  if (remaining.length === current.length || ui.persistBlocked.has('settings')) return;
  const snapshot = snapshotSlices(['settings']);
  S.settings.prefs.trash = remaining;
  saveSlicesWithRollback(['settings'], snapshot, false);
}
