import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/js/main.js', import.meta.url), 'utf8');
const handler = source.match(/function onPushNotification\(event\) \{[\s\S]*?\n\}/)?.[0];
const startup = source.match(/  purgeExpiredTrash\(\);[\s\S]*?  Persist\.retryPending\(\);/)?.[0];
assert.ok(handler, 'O handler de Push deve existir no compositor.');
assert.ok(startup, 'A inicialização autenticada deve estar disponível.');

const listeners = new EventTarget();
const messages = [];
let initialized = 0;
const context = {
  window: listeners,
  ui: { persistFailed: new Set(), route: 'inicio' },
  toast: (message) => messages.push(message),
  purgeExpiredTrash() {},
  preloadEnabledRouteModules() {},
  reconcileRecurringTransactions: () => false,
  genRecurring: () => false,
  saveSlices() {},
  onRoute() {},
  releaseNoticePending: false,
  profileSetupComplete: () => true,
  maybeOpenReleaseNotes() {},
  openProfileSetup() {},
  setInterval() {},
  tick() {},
  registerPwaSupport: async () => ({}),
  isNativeApp: () => false,
  initializePushNotifications: async () => {
    initialized += 1;
    for (const kind of ['habit-reminder', 'task-reminder', 'weekly-review']) {
      const event = new Event('aurora:push-notification');
      event.detail = { kind };
      listeners.dispatchEvent(event);
    }
  },
  syncHabitReminderSchedule: async () => {},
  Persist: { retryPending() {} },
  console,
};
const createStartup = new Function(...Object.keys(context), `${handler}\nreturn async function start() {\n${startup}\n};`);
const start = createStartup(...Object.values(context));

await start();
assert.equal(initialized, 1);
assert.deepEqual(messages, [
  'Um horário de hábito chegou. Abra Hábitos para conferir sua rotina.',
  'Um lembrete de tarefa chegou. Abra Planejar para conferir sua lista.',
  'Sua semana está disponível em Planejar, quando quiser.',
]);
const ignored = new Event('aurora:push-notification');
ignored.detail = { kind: 'other' };
listeners.dispatchEvent(ignored);
assert.equal(messages.length, 3);

await start();
assert.equal(initialized, 2);
assert.equal(messages.length, 6, 'A reinicialização não deve duplicar o listener.');
assert.equal((source.match(/addEventListener\('aurora:push-notification'/g) || []).length, 1);
assert.ok(source.indexOf('const toast = setToast;') < source.indexOf("addEventListener('aurora:push-notification'"));
console.log('push-notification-startup: all checks passed');
