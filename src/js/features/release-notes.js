const releaseMetadata = typeof __AURORA_RELEASE_METADATA__ === 'undefined'
  ? { id: 'development', title: '' }
  : __AURORA_RELEASE_METADATA__;

export const RELEASE_VERSION = releaseMetadata.id;

export function getReleaseNotes(version = RELEASE_VERSION) {
  if (version !== RELEASE_VERSION || !releaseMetadata.title) return null;
  return {
    title: 'O que mudou no Aurora',
    items: [{
      title: releaseMetadata.title,
      description: releaseMetadata.description || '',
    }],
  };
}

export function shouldShowReleaseNotes(settings, version = RELEASE_VERSION) {
  if (!getReleaseNotes(version)) return false;
  return settings?.prefs?.releaseNotesSeen !== version;
}

export function markReleaseNotesSeen(settings, version = RELEASE_VERSION) {
  if (!getReleaseNotes(version) || !settings?.prefs || typeof settings.prefs !== 'object') return false;
  settings.prefs.releaseNotesSeen = version;
  return true;
}
