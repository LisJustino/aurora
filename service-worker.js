const CACHE_NAME = 'aurora-static-v11';
const API_PATH = /\/(?:api|auth|functions|rest|rpc|storage)(?:\/|$)/i;
const APP_ROUTE = /^\/(?:inicio|planejar|pomodoro|financas|habitos|agua|ciclo|config|ajustes|perfil|pessoal|academia|entrar|criar-conta|esqueci-senha|nova-senha|demonstracao)\/?$/i;
const APP_DOCUMENT = /^\/(?:index\.html|pages\/(?:agua|ajustes|ciclo|financas|habitos|inicio|perfil|planejar|pomodoro)\.html|terms\.html|privacy\.html|(?:inicio|planejar|pomodoro|financas|habitos|agua|ciclo|config|ajustes|perfil|pessoal|academia|entrar|criar-conta|esqueci-senha|nova-senha|demonstracao)\/?)$/i;
const APP_SHELL_ASSET = /^\/(?:assets\/.+\.(?:css|m?js|woff2?|ttf|otf)|icons\/.+\.(?:svg|png|jpe?g|webp|ico)|favicon\.svg)$/i;

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') event.waitUntil(self.skipWaiting());
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
  if (request.method !== 'GET' || url.origin !== self.location.origin || API_PATH.test(url.pathname)) return;
  const isAppNavigation = request.mode === 'navigate' && (
    url.pathname === '/'
    || APP_DOCUMENT.test(url.pathname)
  );
  if (url.search && !isAppNavigation) return;

  if (APP_SHELL_ASSET.test(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      if (cached) return cached;

      const response = await fetch(request);
      if (response.ok && response.type === 'basic') {
        await cache.put(request, response.clone());
      }
      return response;
    })());
    return;
  }

  if (!isAppNavigation) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      const response = await fetch(request, { cache: 'no-cache' });
      if (response.ok && response.type === 'basic' && response.headers.get('Content-Type')?.startsWith('text/html')) {
        if (!url.search) await cache.put(request, response.clone());
        if (url.pathname === '/' || url.pathname.startsWith('/pages/') || APP_ROUTE.test(url.pathname)) {
          await cache.put(new URL('./index.html', self.registration.scope).href, response.clone());
        }
      }
      return response;
    } catch (networkError) {
      const cached = await cache.match(request);
      if (cached) return cached;
      const fallback = await cache.match(new URL('./index.html', self.registration.scope).href);
      if (fallback) return fallback;
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
      ? 'aurora. · Hábitos'
      : typeof payload.title === 'string' && payload.title.length <= 80
      ? payload.title
      : 'aurora. · Pomodoro';
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
    const targetUrl = new URL(`./${route}`, self.registration.scope).href;
    if (existing) {
      if (typeof existing.navigate === 'function') await existing.navigate(targetUrl);
      await existing.focus();
      return;
    }
    await self.clients.openWindow(targetUrl);
  })());
});
