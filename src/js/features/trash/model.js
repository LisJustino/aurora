export const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export function isValidTrashEntry(entry, isValidRecord) {
  if (typeof isValidRecord !== 'function') return false;
  const recordKeys = new Set();
  const validRecords = Array.isArray(entry?.records)
    && entry.records.every((record) => {
      if (!isValidRecord(record)) return false;
      const key = `${record.collection}:${record.key}`;
      if (recordKeys.has(key)) return false;
      recordKeys.add(key);
      return true;
    });
  return entry !== null
    && typeof entry === 'object'
    && !Array.isArray(entry)
    && typeof entry.id === 'string'
    && entry.id.trim().length > 0
    && Number.isSafeInteger(entry.deletedAt)
    && entry.deletedAt > 0
    && typeof entry.label === 'string'
    && entry.label.trim().length > 0
    && entry.label.length <= 120
    && validRecords
    && entry.records.length > 0;
}

export function normalizeTrash(value, isValidEntry) {
  if (!Array.isArray(value)) return { entries: [], rejectedCount: 1 };
  const entries = [];
  const ids = new Set();
  let rejectedCount = 0;
  value.forEach((entry) => {
    if (!isValidEntry(entry) || ids.has(entry.id)) {
      rejectedCount++;
      return;
    }
    ids.add(entry.id);
    entries.push(entry);
  });
  return { entries, rejectedCount };
}

export function isTrashExpired(entry, now = Date.now()) {
  return now - entry.deletedAt >= TRASH_RETENTION_MS;
}

export function trashDaysRemaining(entry, now = Date.now()) {
  return Math.min(
    Math.ceil(TRASH_RETENTION_MS / 86400000),
    Math.max(0, Math.ceil((TRASH_RETENTION_MS - (now - entry.deletedAt)) / 86400000)),
  );
}
