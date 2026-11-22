// Lembrete de backup: aparece quando a última cópia é antiga ou quando já há
// bastante coisa registrada e nunca houve uma cópia.
export const BACKUP_REMINDER_DAYS = 30;
export const BACKUP_SNOOZE_DAYS = 7;
export const BACKUP_MIN_RECORDS = 20;

const DAY_MS = 24 * 60 * 60 * 1000;
const validTime = (value) => (typeof value === 'string' ? Date.parse(value) : NaN);

export function backupReminder({ lastBackup, snoozedUntil, recordCount, now = Date.now() }) {
  const snooze = validTime(snoozedUntil);
  if (Number.isFinite(snooze) && now < snooze) return null;
  const last = validTime(lastBackup);
  if (Number.isFinite(last)) {
    const days = Math.floor((now - last) / DAY_MS);
    return days >= BACKUP_REMINDER_DAYS ? { never: false, days } : null;
  }
  return recordCount >= BACKUP_MIN_RECORDS ? { never: true, days: null } : null;
}

export function backupSnoozeUntil(now = Date.now()) {
  return new Date(now + BACKUP_SNOOZE_DAYS * DAY_MS).toISOString();
}
