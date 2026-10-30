const CACHE_NAME = 'aurora-static-v8';
const API_PATH = /\/api(?:\/|$)/;
const LEGAL_DOCUMENT = /\/(?:terms|privacy)\.html$/;
const STATIC_ASSET = /\.(?:html|css|m?js|woff2?|ttf|otf|svg|png|jpe?g|webp|gif|ico|webmanifest)$/i;

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

  if (LEGAL_DOCUMENT.test(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(request, { cache: 'no-cache' });
        if (response.ok && response.type === 'basic') {
          await cache.put(request, response.clone()).catch((error) => {
            console.warn('O Aurora não conseguiu atualizar o documento legal no cache offline.', error);
          });
        }
        return response;
      } catch (networkError) {
        const cached = await cache.match(request);
        if (cached) return cached;
        throw networkError;
      }
    })());
    return;
  }

  if (STATIC_ASSET.test(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      const update = fetch(request, { cache: 'no-cache' }).then((response) => {
        if (!response.ok || response.type !== 'basic') return response;
        return cache.put(request, response.clone()).then(() => response, (error) => {
          console.warn('O Aurora não conseguiu atualizar o cache offline.', error);
          return response;
        });
      });

      if (cached) {
        event.waitUntil(update.then(
          () => {},
          (error) => console.warn('O Aurora não conseguiu atualizar um recurso estático.', error),
        ));
        return cached;
      }

      try {
        return await update;
      } catch (networkError) {
        const fallback = await caches.match(request);
        if (fallback) return fallback;
        throw networkError;
      }
    })());
    return;
  }

  if (request.mode !== 'navigate') return;

  event.respondWith((async () => {
    try {
      const response = await fetch(request, { cache: 'no-cache' });
      if (response.ok && response.type === 'basic' && response.headers.get('Content-Type')?.startsWith('text/html')) {
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
    const habitReminder = payload.kind === 'habit-reminder';
    const title = habitReminder
      ? 'Aurora · Hábitos'
      : typeof payload.title === 'string' && payload.title.length <= 80
      ? payload.title
      : 'Aurora · Pomodoro';
    const body = habitReminder
      ? 'Um horário de hábito chegou. Abra o Aurora para conferir sua rotina.'
      : typeof payload.body === 'string' && payload.body.length <= 180
      ? payload.body
      : 'Uma nova fase do Pomodoro começou.';
    await self.registration.showNotification(title, {
      body,
      icon: new URL('./icons/aurora-192.png', self.registration.scope).href,
      badge: new URL('./icons/aurora-192.png', self.registration.scope).href,
      tag: habitReminder ? 'aurora-habits' : 'aurora-pomodoro',
      renotify: false,
      data: { route: habitReminder ? 'habitos' : 'pomodoro' },
    });
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);
    const route = event.notification.data?.route === 'habitos' ? 'habitos' : 'pomodoro';
    const targetUrl = new URL(`./pages/${route === 'habitos' ? 'habitos' : 'pomodoro'}.html`, self.registration.scope).href;
    if (existing) {
      if (typeof existing.navigate === 'function') await existing.navigate(targetUrl);
      await existing.focus();
      return;
    }
    await self.clients.openWindow(targetUrl);
  })());
});
