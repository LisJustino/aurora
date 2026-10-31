import { decryptAccountSlice, unlockVaultWithPassword } from '../services/crypto-vault.js';

export const LEGACY_SLICES = [
  'tasks', 'pomodoro', 'settings',
  'water', 'gym', 'finance', 'cycle', 'cycleLog', 'weight', 'habits',
];

const LEGACY_SLICE_SET = new Set(LEGACY_SLICES);
const REMOVED_STUDY_COLLECTIONS = new Set(['subjects', 'sessions', 'timer.subject']);

export function containsRemovedStudyData(data, extras = {}) {
  const removedSlices = ['subjects', 'sessions', 'timer', 'studySessions', 'studyTimer'];
  const trashContainsRemovedCollection = (prefs) => Array.isArray(prefs?.trash)
    && prefs.trash.some((entry) => Array.isArray(entry?.records)
      && entry.records.some((record) => REMOVED_STUDY_COLLECTIONS.has(record?.collection)));
  return removedSlices.some((key) => Object.hasOwn(data || {}, key))
    || Object.hasOwn(data?.areas || {}, 'studies')
    || Object.hasOwn(extras?.areas || {}, 'studies')
    || Object.hasOwn(data?.prefs || {}, 'studyGoalMin')
    || Object.hasOwn(extras?.prefs || {}, 'studyGoalMin')
    || trashContainsRemovedCollection(data?.prefs)
    || trashContainsRemovedCollection(extras?.prefs);
}

export function purgeRemovedStudyDataFromBrowserStorage(storage, userId) {
  if (!storage || typeof userId !== 'string' || !userId) {
    throw new Error('Não foi possível acessar as cópias antigas deste navegador.');
  }
  const settingsKey = 'aurora.app.settings';
  const rawSettings = storage.getItem(settingsKey);
  let updatedSettings = null;
  if (rawSettings !== null) {
    let envelope;
    try {
      envelope = JSON.parse(rawSettings);
    } catch {
      throw new Error('As configurações antigas não puderam ser lidas; nenhuma cópia foi apagada.');
    }
    if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)
      || !envelope.v || typeof envelope.v !== 'object' || Array.isArray(envelope.v)) {
      throw new Error('As configurações antigas têm formato inválido; nenhuma cópia foi apagada.');
    }
    const value = { ...envelope.v };
    if (value.areas && typeof value.areas === 'object' && !Array.isArray(value.areas)) {
      value.areas = { ...value.areas };
      delete value.areas.studies;
    }
    if (value.prefs && typeof value.prefs === 'object' && !Array.isArray(value.prefs)) {
      value.prefs = { ...value.prefs };
      delete value.prefs.studyGoalMin;
      if (Array.isArray(value.prefs.trash)) {
        value.prefs.trash = value.prefs.trash.flatMap((entry) => {
          if (!Array.isArray(entry?.records)) return [entry];
          const records = entry.records.filter((record) => !REMOVED_STUDY_COLLECTIONS.has(record?.collection));
          return records.length ? [{ ...entry, records }] : [];
        });
      }
    }
    updatedSettings = JSON.stringify({ ...envelope, v: value });
  }

  if (updatedSettings !== null && updatedSettings !== rawSettings) {
    storage.setItem(settingsKey, updatedSettings);
  }
  for (const slice of ['subjects', 'sessions', 'timer']) {
    storage.removeItem(`aurora.app.${slice}`);
    storage.removeItem(`aurora.user.${userId}.${slice}`);
  }
}

function parseLocalEnvelope(raw, key) {
  let envelope;
  try {
    envelope = JSON.parse(raw);
  } catch {
    throw new Error(`O dado antigo "${key}" não é um JSON válido. Ele foi preservado; nada foi importado.`);
  }
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)
    || !Object.hasOwn(envelope, 'v')
    || (envelope.t !== undefined && !Number.isFinite(envelope.t))) {
    throw new Error(`O dado antigo "${key}" tem um envelope incompatível. Ele foi preservado; nada foi importado.`);
  }
  return { value: envelope.v, savedAt: Number.isFinite(envelope.t) ? envelope.t : 0 };
}

function validateEnvelope(envelope, label) {
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)
    || !Object.hasOwn(envelope, 'v')
    || (envelope.t !== undefined && !Number.isFinite(envelope.t))) {
    throw new Error(`O envelope antigo de ${label} é incompatível. Os dados originais foram preservados.`);
  }
  return { value: envelope.v, savedAt: Number.isFinite(envelope.t) ? envelope.t : 0 };
}

export function scanLegacyBrowserStorage(storage, userId) {
  if (!storage || typeof userId !== 'string' || !userId) {
    throw new Error('Não foi possível acessar as chaves antigas desta conta.');
  }

  const plain = {};
  const encrypted = {};
  const snapshot = {};
  const markerKeys = [];
  const unknownUserKeys = [];
  let length;
  try {
    length = storage.length;
  } catch {
    throw new Error('O navegador bloqueou a leitura dos dados antigos. Eles não foram alterados.');
  }

  for (let index = 0; index < length; index += 1) {
    let key;
    let raw;
    try {
      key = storage.key(index);
      if (typeof key !== 'string') continue;
      if (key.startsWith('aurora.legacy.')) {
        markerKeys.push(key);
        continue;
      }
      if (!key.startsWith('aurora.app.') && !key.startsWith(`aurora.user.${userId}.`)) continue;
      raw = storage.getItem(key);
    } catch {
      throw new Error('Não foi possível ler uma das chaves antigas. Nenhum dado foi alterado.');
    }
    if (raw === null) continue;

    if (key.startsWith('aurora.app.')) {
      const slice = key.slice('aurora.app.'.length);
      if (!LEGACY_SLICE_SET.has(slice)) continue;
      plain[slice] = parseLocalEnvelope(raw, key);
      snapshot[key] = raw;
      continue;
    }

    const slice = key.slice(`aurora.user.${userId}.`.length);
    if (!LEGACY_SLICE_SET.has(slice)) {
      unknownUserKeys.push(key);
      continue;
    }
    let value;
    try {
      value = JSON.parse(raw);
    } catch {
      throw new Error(`O cache cifrado antigo "${key}" está inválido. Ele foi preservado; nada foi importado.`);
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error(`O cache cifrado antigo "${key}" tem formato incompatível. Ele foi preservado.`);
    }
    const wrapped = value.t !== undefined
      && Number.isFinite(value.t)
      && value.v && typeof value.v === 'object' && !Array.isArray(value.v)
      ? value.v
      : value;
    encrypted[slice] = wrapped;
    snapshot[key] = raw;
  }

  return { plain, encrypted, snapshot, markerKeys, unknownUserKeys };
}

async function loadVaultRecord(client, userId) {
  const { data, error } = await client
    .from('user_keys')
    .select('key_version,salt,password_wrap,recovery_wrap')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    console.error('Aurora: não foi possível ler o cofre antigo da conta.', error);
    throw new Error('Não foi possível acessar o cofre antigo da conta. Nada foi alterado.');
  }
  return data;
}

async function loadVaultRows(client, userId) {
  const { data, error } = await client
    .from('user_data')
    .select('slice,data')
    .eq('user_id', userId);
  if (error) {
    console.error('Aurora: não foi possível ler as áreas antigas da conta.', error);
    throw new Error('Não foi possível acessar os dados cifrados da conta. Nada foi alterado.');
  }
  return data || [];
}

export async function inspectLegacySources({ client, userId, browserData }) {
  if (!client || !userId || !browserData) throw new Error('A sessão da conta não está disponível.');
  const localSources = Object.entries(browserData.plain).map(([slice, entry]) => ({
    source: 'browser',
    slice,
    savedAt: entry.savedAt,
    value: entry.value,
  }));
  const vaultRows = await loadVaultRows(client, userId);
  const needsVault = vaultRows.length > 0
    || Object.keys(browserData.encrypted).length > 0;
  if (!needsVault) {
    return {
      requiresUnlock: false,
      sources: localSources,
      encryptedBrowser: {},
      vaultRows: [],
      vaultRecord: null,
      vaultCount: 0,
    };
  }
  const vaultRecord = await loadVaultRecord(client, userId);
  if (needsVault && !vaultRecord) {
    throw new Error('Há dados cifrados, mas a chave do cofre não foi encontrada. Os dados foram preservados.');
  }
  const seenSlices = new Set();
  for (const row of vaultRows) {
    if (!LEGACY_SLICE_SET.has(row.slice) || seenSlices.has(row.slice)) {
      throw new Error('O cofre contém uma área desconhecida ou duplicada. Nada foi importado.');
    }
    seenSlices.add(row.slice);
  }
  return {
    requiresUnlock: true,
    sources: localSources,
    encryptedBrowser: browserData.encrypted,
    vaultRows,
    vaultRecord,
    vaultCount: vaultRows.length,
  };
}

export async function unlockLegacySources({ discovery, userId, password }) {
  if (!discovery || !userId) throw new Error('A sessão da conta não está disponível.');
  if (!discovery.requiresUnlock) {
    return { sources: discovery.sources || [], vaultCount: 0 };
  }
  if (typeof password !== 'string' || !password) {
    throw new Error('Informe a senha antiga do cofre para ler as cópias cifradas encontradas.');
  }

  let dataKey;
  try {
    dataKey = await unlockVaultWithPassword(password, discovery.vaultRecord, userId);
  } catch {
    throw new Error('Essa senha não desbloqueou o cofre. Confira a senha usada quando ele foi criado e tente novamente.');
  }

  const encryptedSources = [];
  for (const [slice, encrypted] of Object.entries(discovery.encryptedBrowser)) {
    try {
      const envelope = await decryptAccountSlice(dataKey, userId, slice, encrypted);
      const decoded = validateEnvelope(envelope, `aurora.user.${userId}.${slice}`);
      encryptedSources.push({ source: 'browser-cache', slice, ...decoded });
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('O envelope antigo')) throw error;
      console.error(`Aurora: o cache cifrado antigo de ${slice} não pôde ser decifrado.`, error);
      throw new Error(`O cache cifrado antigo de ${slice} não pôde ser decifrado. Ele foi preservado.`);
    }
  }

  const vaultSources = [];
  const seenSlices = new Set();
  for (const row of discovery.vaultRows) {
    if (!LEGACY_SLICE_SET.has(row.slice) || seenSlices.has(row.slice)) {
      throw new Error('O cofre contém uma área desconhecida ou duplicada. Nada foi importado.');
    }
    seenSlices.add(row.slice);
    try {
      const envelope = await decryptAccountSlice(dataKey, userId, row.slice, row.data);
      const decoded = validateEnvelope(envelope, row.slice);
      vaultSources.push({ source: 'vault', slice: row.slice, ...decoded });
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('O envelope antigo')) throw error;
      console.error(`Aurora: a área antiga ${row.slice} do cofre não pôde ser decifrada.`, error);
      throw new Error(`A área antiga ${row.slice} do cofre não pôde ser decifrada. Nenhum dado foi alterado.`);
    }
  }

  return {
    sources: [...(discovery.sources || []), ...encryptedSources, ...vaultSources],
    vaultCount: vaultSources.length,
  };
}

export async function loadLegacySources({ client, userId, password, browserData }) {
  const discovery = await inspectLegacySources({ client, userId, browserData });
  return unlockLegacySources({ discovery, userId, password });
}

export function clearImportedBrowserStorage(storage, snapshot) {
  const removed = [];
  const changed = [];
  const failed = [];
  Object.entries(snapshot || {}).forEach(([key, originalValue]) => {
    try {
      if (storage.getItem(key) !== originalValue) {
        changed.push(key);
        return;
      }
      storage.removeItem(key);
      removed.push(key);
    } catch {
      failed.push(key);
    }
  });
  return { removed, changed, failed };
}
