const CACHE_NAME = 'aurora-static-v3';
const API_PATH = /\/api(?:\/|$)/;

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames
      .filter((name) => name.startsWith('aurora-static-') && name !== CACHE_NAME)
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.search || API_PATH.test(url.pathname)) return;

  event.respondWith((async () => {
    try {
      const response = await fetch(request, { cache: 'no-cache' });
      if (response.ok && response.type === 'basic') {
        await caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone())).catch((error) => {
          console.warn('O Aurora não conseguiu atualizar o cache offline.', error);
        });
      }
      return response;
    } catch (networkError) {
      const cached = await caches.match(request);
      if (cached) return cached;
      if (request.mode === 'navigate') {
        const fallback = await caches.match(new URL('./index.html', self.registration.scope).href);
        if (fallback) return fallback;
      }
      throw networkError;
    }
  })());
});

self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (windows.some((client) => client.visibilityState === 'visible')) return;

    let payload = {};
    try {
      payload = event.data ? event.data.json() : {};
    } catch {
      payload = {};
    }
    const title = typeof payload.title === 'string' && payload.title.length <= 80
      ? payload.title
      : 'Aurora · Pomodoro';
    const body = typeof payload.body === 'string' && payload.body.length <= 180
      ? payload.body
      : 'Uma nova fase do Pomodoro começou.';
    await self.registration.showNotification(title, {
      body,
      icon: new URL('./icons/aurora-192.png', self.registration.scope).href,
      badge: new URL('./icons/aurora-192.png', self.registration.scope).href,
      tag: 'aurora-pomodoro',
      renotify: false,
    });
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);
    const pomodoroUrl = new URL('./pages/pomodoro.html', self.registration.scope).href;
    if (existing) {
      await existing.focus();
      return;
    }
    await self.clients.openWindow(pomodoroUrl);
  })());
});
