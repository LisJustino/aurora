const CACHE_NAME = 'aurora-static-v14';
const API_PATH = /\/(?:api|auth|functions|rest|rpc|storage)(?:\/|$)/i;
const APP_ROUTE = /^\/(?:inicio|planejar|pomodoro|financas|habitos|agua|ciclo|config|ajustes|perfil|pessoal|academia|entrar|criar-conta|esqueci-senha|nova-senha|demonstracao)\/?$/i;
const APP_DOCUMENT = /^\/(?:index\.html|pages\/(?:agua|ajustes|ciclo|financas|habitos|inicio|perfil|planejar)\.html|terms\.html|privacy\.html|(?:inicio|planejar|pomodoro|financas|habitos|agua|ciclo|config|ajustes|perfil|pessoal|academia|entrar|criar-conta|esqueci-senha|nova-senha|demonstracao)\/?)$/i;
const APP_SHELL_ASSET = /^\/(?:(?:assets\/.+\.(?:css|m?js|woff2?|ttf|otf))|(?:icons\/.+\.(?:svg|png|jpe?g|webp|ico))|(?:screenshots\/.+\.(?:png|webp))|favicon\.svg)$/i;

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') event.waitUntil(self.skipWaiting());
  if (event.data?.type === 'CACHE_PUBLIC_STYLES') {
    event.waitUntil((async () => {
      const url = new URL(event.data.url, self.location.origin);
      if (url.origin !== self.location.origin || !/^\/assets\/[a-zA-Z0-9_-]+\.css$/.test(url.pathname) || url.search || url.hash) {
        throw new Error('A URL dos estilos offline é inválida.');
      }
      const cache = await caches.open(CACHE_NAME);
      if (await cache.match(url.href)) return;
      const response = await fetch(url.href, { priority: 'low' });
      if (!response.ok || response.type !== 'basic') throw new Error('Os estilos offline não puderam ser carregados.');
      await cache.put(url.href, response);
    })().catch((error) => {
      console.warn('O Aurora não conseguiu preparar os estilos offline.', error);
    }));
  }
});

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const offlineUrl = new URL('./offline.html', self.registration.scope);
    const response = await fetch(offlineUrl, { cache: 'reload' });
    if (!response.ok || response.type !== 'basic') {
      throw new Error('A página offline não pôde ser armazenada.');
    }
    const cache = await caches.open(CACHE_NAME);
    await cache.put(offlineUrl.href, response);
  })());
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

  if (url.pathname === '/loading-appearance.js') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(request, { cache: 'no-cache' });
        if (response.ok && response.type === 'basic') await cache.put(request, response.clone());
        return response;
      } catch (error) {
        const cached = await cache.match(request);
        if (cached) return cached;
        throw error;
      }
    })());
    return;
  }

  if (APP_SHELL_ASSET.test(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      // O CSS antecipado e o link com crossorigin podem enviar Origin diferente.
      const cached = await cache.match(request, url.pathname.endsWith('.css') ? { ignoreVary: true } : undefined);
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
      const offlinePage = await cache.match(new URL('./offline.html', self.registration.scope).href);
      if (offlinePage) return offlinePage;
      throw networkError;
    }
  })());
});

