/* Fila local de alterações offline (IndexedDB por conta) com fallback seguro em memória.
   Permite registrar tarefas, hábitos, água, finanças e ciclo sem internet e sincronizar ao reconectar. */

const DB_NAME = 'aurora-offline-queue-v1';
const STORE_NAME = 'pending';
const DB_VERSION = 1;

const memoryFallback = new Map();

function hasIndexedDb() {
  return typeof indexedDB !== 'undefined' && typeof indexedDB.open === 'function';
}

function openQueueDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'userId' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Não foi possível abrir a fila offline.'));
  });
}

function normalizePendingRecord(userId, record) {
  if (!record || typeof record !== 'object' || record.userId !== userId) return null;
  if (!record.snapshot || typeof record.snapshot !== 'object') return null;
  const slices = Array.isArray(record.slices)
    ? [...new Set(record.slices.filter((item) => typeof item === 'string' && item.trim()))]
    : [];
  const count = Number.isInteger(record.count) && record.count > 0 ? record.count : Math.max(1, slices.length);
  const updatedAt = Number.isFinite(record.updatedAt) ? record.updatedAt : Date.now();
  return {
    userId,
    snapshot: JSON.parse(JSON.stringify(record.snapshot)),
    slices,
    count,
    updatedAt,
  };
}

export async function readOfflinePending(userId) {
  if (!userId || typeof userId !== 'string') return null;
  if (!hasIndexedDb()) {
    return normalizePendingRecord(userId, memoryFallback.get(userId));
  }
  try {
    const db = await openQueueDb();
    try {
      const record = await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get(userId);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
      return normalizePendingRecord(userId, record);
    } finally {
      db.close();
    }
  } catch (error) {
    console.warn('Aurora: não foi possível ler a fila offline local.', error);
    return normalizePendingRecord(userId, memoryFallback.get(userId));
  }
}

export async function writeOfflinePending(userId, { snapshot, slices = [], count = 1 }) {
  if (!userId || typeof userId !== 'string' || !snapshot || typeof snapshot !== 'object') return false;
  const record = normalizePendingRecord(userId, {
    userId,
    snapshot,
    slices,
    count,
    updatedAt: Date.now(),
  });
  if (!record) return false;
  memoryFallback.set(userId, record);
  if (!hasIndexedDb()) return true;
  try {
    const db = await openQueueDb();
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(record);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error || new Error('Transação da fila offline cancelada.'));
      });
      return true;
    } finally {
      db.close();
    }
  } catch (error) {
    console.warn('Aurora: não foi possível gravar na fila offline local.', error);
    return false;
  }
}

export async function clearOfflinePending(userId) {
  if (!userId || typeof userId !== 'string') return false;
  memoryFallback.delete(userId);
  if (!hasIndexedDb()) return true;
  try {
    const db = await openQueueDb();
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(userId);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      return true;
    } finally {
      db.close();
    }
  } catch (error) {
    console.warn('Aurora: não foi possível limpar a fila offline local.', error);
    return false;
  }
}
