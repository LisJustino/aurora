const REMOVED_STUDY_COLLECTIONS = new Set(['subjects', 'sessions', 'timer.subject']);

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
