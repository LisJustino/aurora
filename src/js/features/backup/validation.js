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
