import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('../../service-worker.js', import.meta.url), 'utf8');

function serviceWorkerHarness() {
  const listeners = new Map();
  const shown = [];
  const windows = [];
  const focused = [];
  const opened = [];
  const self = {
    addEventListener: (name, listener) => listeners.set(name, listener),
    location: { origin: 'https://aurora.example' },
    registration: {
      scope: 'https://aurora.example/',
      showNotification: async (...args) => shown.push(args),
    },
    clients: {
      matchAll: async () => windows,
      openWindow: async (url) => opened.push(url),
    },
  };
  runInNewContext(source, { self, URL, console, caches: {}, fetch: async () => {} });
  return { listeners, shown, windows, focused, opened, self };
}

function pushEvent(data) {
  let task;
  return {
    event: {
      data: { json: () => data },
      waitUntil: (promise) => { task = promise; },
    },
    complete: async () => task,
  };
}

test('Push visível não duplica o aviso do sistema; Push em segundo plano o exibe', async () => {
  const harness = serviceWorkerHarness();
  const { event, complete } = pushEvent({ title: 'Aurora · Pomodoro', body: 'Pausa curta concluída.' });
  harness.windows.push({ visibilityState: 'visible', url: 'https://aurora.example/' });
  harness.listeners.get('push')(event);
  await complete();
  assert.equal(harness.shown.length, 0);

  harness.windows[0].visibilityState = 'hidden';
  const hiddenPush = pushEvent({ title: 'Aurora · Pomodoro', body: 'Pausa curta concluída.' });
  harness.listeners.get('push')(hiddenPush.event);
  await hiddenPush.complete();
  assert.equal(harness.shown.length, 1);
  assert.equal(harness.shown[0][0], 'Aurora · Pomodoro');
  assert.equal(harness.shown[0][1].body, 'Pausa curta concluída.');
  assert.equal(harness.shown[0][1].tag, 'aurora-pomodoro');
});

test('clique na notificação foca uma janela existente ou abre o app', async () => {
  const harness = serviceWorkerHarness();
  const focused = [];
  harness.windows.push({
    visibilityState: 'hidden',
    url: 'https://aurora.example/pages/pomodoro.html',
    focus: async () => focused.push(true),
  });
  let completion;
  harness.listeners.get('notificationclick')({
    notification: { close() {} },
    waitUntil: (promise) => { completion = promise; },
  });
  await completion;
  assert.deepEqual(focused, [true]);
  assert.equal(harness.opened.length, 0);

  harness.windows.length = 0;
  harness.listeners.get('notificationclick')({
    notification: { close() {} },
    waitUntil: (promise) => { completion = promise; },
  });
  await completion;
  assert.deepEqual(harness.opened, ['https://aurora.example/pages/pomodoro.html']);
});
