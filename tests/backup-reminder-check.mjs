import assert from 'node:assert/strict';
import { backupReminder, backupSnoozeUntil } from '../src/js/features/backup/reminder.js';

const day = 24 * 60 * 60 * 1000;
const now = Date.parse('2026-11-22T12:00:00Z');
const ago = (days) => new Date(now - days * day).toISOString();

assert.equal(backupReminder({ lastBackup: ago(10), recordCount: 500, now }), null);
assert.deepEqual(backupReminder({ lastBackup: ago(30), recordCount: 1, now }), { never: false, days: 30 });
assert.deepEqual(backupReminder({ lastBackup: ago(75), recordCount: 1, now }), { never: false, days: 75 });
assert.deepEqual(backupReminder({ lastBackup: null, recordCount: 20, now }), { never: true, days: null });
assert.equal(backupReminder({ lastBackup: null, recordCount: 19, now }), null);
assert.deepEqual(backupReminder({ lastBackup: 'texto inválido', recordCount: 50, now }), { never: true, days: null });

// adiar por 7 dias
const snoozed = backupSnoozeUntil(now);
assert.equal(Date.parse(snoozed) - now, 7 * day);
assert.equal(backupReminder({ lastBackup: ago(90), snoozedUntil: snoozed, recordCount: 50, now }), null);
assert.deepEqual(backupReminder({ lastBackup: ago(90), snoozedUntil: snoozed, recordCount: 50, now: now + 8 * day }), { never: false, days: 98 });
assert.deepEqual(backupReminder({ lastBackup: ago(90), snoozedUntil: 'x', recordCount: 50, now }), { never: false, days: 90 });

console.log('backup-reminder-check: ok');
