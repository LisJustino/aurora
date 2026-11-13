import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('../../service-worker.js', import.meta.url), 'utf8');

function serviceWorkerHarness({ fetchImplementation = async () => {} } = {}) {
  const listeners = new Map();
  const shown = [];
  const windows = [];
  const focused = [];
  const opened = [];
  const cached = new Map();
  const cacheKey = (request) => typeof request === 'string' ? request : request.url;
  const cache = {
    match: async (request) => cached.get(cacheKey(request)),
    put: async (request, response) => cached.set(cacheKey(request), response),
  };
  const cacheStorage = {
    open: async () => cache,
    match: async (request) => cache.match(request),
    keys: async () => [],
    delete: async () => true,
  };
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
  runInNewContext(source, { self, URL, console, caches: cacheStorage, fetch: fetchImplementation });
  return { listeners, shown, windows, focused, opened, self, cached };
}

function fetchEvent(request) {
  let response;
  const waitUntil = [];
  return {
    event: {
      request,
      respondWith: (promise) => { response = Promise.resolve(promise); },
      waitUntil: (promise) => waitUntil.push(promise),
    },
    getResponse: () => response,
    waitUntil,
  };
}

function basicResponse(contentType) {
  return {
    ok: true,
    type: 'basic',
    headers: { get: (name) => name === 'Content-Type' ? contentType : null },
    clone() { return this; },
  };
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

test('Push desconhecido é ignorado e lembrete de hábito em segundo plano é exibido', async () => {
  const harness = serviceWorkerHarness();
  const { event, complete } = pushEvent({ kind: 'unknown' });
  harness.windows.push({ visibilityState: 'visible', url: 'https://aurora.example/' });
  harness.listeners.get('push')(event);
  await complete();
  assert.equal(harness.shown.length, 0);

  harness.windows[0].visibilityState = 'hidden';
  const hiddenPush = pushEvent({ kind: 'habit-reminder' });
  harness.listeners.get('push')(hiddenPush.event);
  await hiddenPush.complete();
  assert.equal(harness.shown.length, 1);
  assert.equal(harness.shown[0][0], 'aurora. · Hábitos');
  assert.match(harness.shown[0][1].body, /horário de hábito chegou/i);
  assert.equal(harness.shown[0][1].tag, 'aurora-habits');
});

test('aviso de hábito usa texto genérico e abre a área de Hábitos ao ser clicado', async () => {
  const harness = serviceWorkerHarness();
  const reminder = pushEvent({ kind: 'habit-reminder' });
  harness.listeners.get('push')(reminder.event);
  await reminder.complete();
  assert.equal(harness.shown[0][0], 'aurora. · Hábitos');
  assert.match(harness.shown[0][1].body, /horário de hábito chegou/i);
  assert.equal(harness.shown[0][1].tag, 'aurora-habits');
  assert.equal(harness.shown[0][1].data.route, 'habitos');

  const navigated = [];
  const focused = [];
  harness.windows.push({
    visibilityState: 'hidden',
    url: 'https://aurora.example/',
    navigate: async (url) => navigated.push(url),
    focus: async () => focused.push(true),
  });
  let completion;
  harness.listeners.get('notificationclick')({
    notification: { data: { route: 'habitos' }, close() {} },
    waitUntil: (promise) => { completion = promise; },
  });
  await completion;
  assert.deepEqual(navigated, ['https://aurora.example/habitos']);
  assert.deepEqual(focused, [true]);
});

test('aviso de tarefa não revela o título e abre Planejar ao ser clicado', async () => {
  const harness = serviceWorkerHarness();
  const reminder = pushEvent({ kind: 'task-reminder', title: 'Pagar luz' });
  harness.listeners.get('push')(reminder.event);
  await reminder.complete();
  assert.equal(harness.shown[0][0], 'aurora. · Planejar');
  assert.match(harness.shown[0][1].body, /lembrete de tarefa chegou/i);
  assert.equal(harness.shown[0][1].body.includes('Pagar luz'), false);
  assert.equal(harness.shown[0][1].tag, 'aurora-tasks');
  assert.equal(harness.shown[0][1].data.route, 'planejar');

  const navigated = [];
  const focused = [];
  harness.windows.push({
    visibilityState: 'hidden',
    url: 'https://aurora.example/',
    navigate: async (url) => navigated.push(url),
    focus: async () => focused.push(true),
  });
  let completion;
  harness.listeners.get('notificationclick')({
    notification: { data: { route: 'planejar' }, close() {} },
    waitUntil: (promise) => { completion = promise; },
  });
  await completion;
  assert.deepEqual(navigated, ['https://aurora.example/planejar']);
  assert.deepEqual(focused, [true]);
});

test('clique em notificação legada do timer não abre uma rota removida', async () => {
  const harness = serviceWorkerHarness();
  const focused = [];
  harness.windows.push({
    visibilityState: 'hidden',
    url: 'https://aurora.example/',
    focus: async () => focused.push(true),
  });
  let completion;
  harness.listeners.get('notificationclick')({
    notification: { data: { route: 'pomodoro' }, close() {} },
    waitUntil: (promise) => { completion = promise; },
  });
  await completion;
  assert.deepEqual(focused, []);
  assert.equal(harness.opened.length, 0);
});

test('Cache Storage guarda apenas recursos estáticos e documentos HTML de navegação', async () => {
  const html = basicResponse('text/html; charset=utf-8');
  const script = basicResponse('text/javascript');
  let fetchCount = 0;
  const harness = serviceWorkerHarness({
    fetchImplementation: async () => {
      fetchCount += 1;
      return fetchCount === 1 ? script : html;
    },
  });

  const scriptFetch = fetchEvent({
    method: 'GET',
    mode: 'same-origin',
    url: 'https://aurora.example/assets/app.js',
  });
  harness.listeners.get('fetch')(scriptFetch.event);
  assert.equal(await scriptFetch.getResponse(), script);
  await Promise.all(scriptFetch.waitUntil);
  assert.equal(harness.cached.has('https://aurora.example/assets/app.js'), true);

  const apiFetch = fetchEvent({
    method: 'GET',
    mode: 'same-origin',
    url: 'https://aurora.example/rpc/user-data',
  });
  harness.listeners.get('fetch')(apiFetch.event);
  assert.equal(apiFetch.getResponse(), undefined);
  assert.equal(harness.cached.has('https://aurora.example/rpc/user-data'), false);

  const navigationFetch = fetchEvent({
    method: 'GET',
    mode: 'navigate',
    url: 'https://aurora.example/pages/inicio.html',
  });
  harness.listeners.get('fetch')(navigationFetch.event);
  assert.equal(await navigationFetch.getResponse(), html);
  assert.equal(harness.cached.has('https://aurora.example/pages/inicio.html'), true);
});

test('rota legada do timer usa o shell offline em vez de uma tela removida', async () => {
  const shell = basicResponse('text/html; charset=utf-8');
  const harness = serviceWorkerHarness({
    fetchImplementation: async () => { throw new Error('offline'); },
  });
  harness.cached.set('https://aurora.example/index.html', shell);
  const navigationFetch = fetchEvent({
    method: 'GET',
    mode: 'navigate',
    url: 'https://aurora.example/pomodoro',
  });
  harness.listeners.get('fetch')(navigationFetch.event);
  assert.equal(await navigationFetch.getResponse(), shell);
});
