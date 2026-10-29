export const BACKUP_REMINDER_DAYS = 14;
export const BACKUP_ACTIVITY_THRESHOLD = 20;

export function backupReminderStatus({ lastBackupAt = null, activityAt = [], now = Date.now() }) {
  const validActivityAt = activityAt.filter((timestamp) => Number.isFinite(timestamp) && timestamp > 0);
  if (!validActivityAt.length) return null;

  const lastBackup = Number.isFinite(lastBackupAt) ? lastBackupAt : null;
  const reference = lastBackup ?? validActivityAt.reduce((oldest, timestamp) => Math.min(oldest, timestamp), Infinity);
  const days = Math.floor((now - reference) / 864e5);
  const activities = validActivityAt.filter((timestamp) => lastBackup === null || timestamp > lastBackup).length;
  const byActivity = activities >= BACKUP_ACTIVITY_THRESHOLD && days < BACKUP_REMINDER_DAYS;

  if (days < BACKUP_REMINDER_DAYS && !byActivity) return null;
  return { days: Math.max(0, days), activities, byActivity };
}
