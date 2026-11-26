export const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export function isValidTrashEntry(entry, isValidRecord) {
  if (typeof isValidRecord !== 'function') return false;
  const recordKeys = new Set();
  const validRecords =
    Array.isArray(entry?.records) &&
    entry.records.every((record) => {
      if (!isValidRecord(record)) return false;
      const key = `${record.collection}:${record.key}`;
      if (recordKeys.has(key)) return false;
      recordKeys.add(key);
      return true;
    });
  return (
    entry !== null &&
    typeof entry === 'object' &&
    !Array.isArray(entry) &&
    typeof entry.id === 'string' &&
    entry.id.trim().length > 0 &&
    Number.isSafeInteger(entry.deletedAt) &&
    entry.deletedAt > 0 &&
    typeof entry.label === 'string' &&
    entry.label.trim().length > 0 &&
    entry.label.length <= 120 &&
    validRecords &&
    entry.records.length > 0
  );
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

export function sortTrashEntriesByExpiry(entries) {
  return [...entries].sort((a, b) => a.deletedAt - b.deletedAt);
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

export const TRASH_CATEGORIES = Object.freeze([
  Object.freeze({ id: 'all', label: 'Tudo', icon: 'archive', tone: 'neutral' }),
  Object.freeze({ id: 'tasks', label: 'Tarefas', icon: 'calendarCheck', tone: 'planning' }),
  Object.freeze({ id: 'habits', label: 'Hábitos', icon: 'check', tone: 'habits' }),
  Object.freeze({ id: 'finance', label: 'Finanças', icon: 'wallet', tone: 'finances' }),
  Object.freeze({ id: 'cycle', label: 'Ciclo', icon: 'heart', tone: 'cycle' }),
]);

const COLLECTION_META = {
  tasks: { category: 'tasks', badgeLabel: 'Tarefa', icon: 'calendarCheck', tone: 'planning' },
  habits: { category: 'habits', badgeLabel: 'Hábito', icon: 'check', tone: 'habits' },
  water: { category: 'habits', badgeLabel: 'Água', icon: 'droplet', tone: 'water' },
  'finance.accounts': { category: 'finance', badgeLabel: 'Conta', icon: 'bank', tone: 'finances' },
  'finance.tx': { category: 'finance', badgeLabel: 'Lançamento', icon: 'wallet', tone: 'finances' },
  'finance.budgets': { category: 'finance', badgeLabel: 'Orçamento', icon: 'pie', tone: 'finances' },
  'finance.goals': { category: 'finance', badgeLabel: 'Objetivo', icon: 'target', tone: 'finances' },
  'finance.recurring': { category: 'finance', badgeLabel: 'Recorrência', icon: 'repeat', tone: 'finances' },
  cycle: { category: 'cycle', badgeLabel: 'Período do ciclo', icon: 'heart', tone: 'cycle' },
  cycleLog: { category: 'cycle', badgeLabel: 'Registro do ciclo', icon: 'heart', tone: 'cycle' },
};

const TRASH_PREFIX_RE =
  /^(?:Tarefa|Hábito|Lançamento|Conta|Objetivo|Orçamento|Fixa|Período|Ciclo|Registro(?: do Ciclo)?)\s*:\s*/i;

function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function trashEntryCategory(entry) {
  const firstCollection = entry?.records?.[0]?.collection || '';
  if (COLLECTION_META[firstCollection]) return COLLECTION_META[firstCollection].category;
  if (firstCollection.startsWith('finance.')) return 'finance';
  if (firstCollection.startsWith('cycle')) return 'cycle';
  if (firstCollection === 'habits' || firstCollection === 'water') return 'habits';
  return 'tasks';
}

export function trashEntryDisplay(entry) {
  const firstCollection = entry?.records?.[0]?.collection || '';
  const meta = COLLECTION_META[firstCollection] || {
    category: trashEntryCategory(entry),
    badgeLabel: 'Item',
    icon: 'archive',
    tone: 'planning',
  };
  const rawLabel = String(entry?.label || '').trim();
  const stripped = rawLabel.replace(TRASH_PREFIX_RE, '').trim();
  return {
    category: meta.category,
    badgeLabel: meta.badgeLabel,
    icon: meta.icon,
    tone: meta.tone,
    title: stripped || rawLabel || meta.badgeLabel,
    recordCount: Array.isArray(entry?.records) ? entry.records.length : 1,
  };
}

export function filterTrashEntries(entries, { category = 'all', query = '' } = {}) {
  const safeCategory = TRASH_CATEGORIES.some((item) => item.id === category) ? category : 'all';
  const needle = normalizeSearchText(query);
  return entries.filter((entry) => {
    const info = trashEntryDisplay(entry);
    if (safeCategory !== 'all' && info.category !== safeCategory) return false;
    if (!needle) return true;
    const haystack = normalizeSearchText(`${entry.label} ${info.title} ${info.badgeLabel}`);
    return haystack.includes(needle);
  });
}
