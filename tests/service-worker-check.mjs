import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('../service-worker.js', import.meta.url), 'utf8');
const handlers = new Map();
const stored = new Map();
let skipWaitingCalls = 0;
const cache = {
  match: async (request) => stored.get(typeof request === 'string' ? request : request.url),
  put: async (request, response) => stored.set(typeof request === 'string' ? request : request.url, response),
};
const self = {
  location: { origin: 'https://aurora.test' },
  registration: { scope: 'https://aurora.test/' },
  clients: { claim: async () => {} },
  addEventListener: (type, handler) => handlers.set(type, handler),
  skipWaiting: async () => { skipWaitingCalls += 1; },
};
const fetchCalls = [];
const htmlResponse = {
  ok: true,
  type: 'basic',
  headers: { get: () => 'text/html; charset=utf-8' },
  clone() { return this; },
};
const assetResponse = {
  ok: true,
  type: 'basic',
  headers: { get: () => 'application/javascript' },
  clone() { return this; },
};

runInNewContext(source, {
  self,
  URL,
  Promise,
  caches: { keys: async () => [], open: async () => cache, match: cache.match },
  fetch: async (request, options) => {
    fetchCalls.push({ request, options });
    const pathname = new URL(typeof request === 'string' ? request : request.url).pathname;
    if (pathname === '/pages/inicio.html' || pathname === '/config') {
      throw new Error('offline');
    }
    return pathname.endsWith('.html')
      || pathname === '/'
      ? htmlResponse
      : assetResponse;
  },
  console,
});

assert.equal(handlers.has('install'), false, 'updated workers must wait for the user action');
let waitUntilPromise;
handlers.get('message')({
  data: { type: 'OTHER' },
  waitUntil: (promise) => { waitUntilPromise = promise; },
});
assert.equal(skipWaitingCalls, 0);
handlers.get('message')({
  data: { type: 'SKIP_WAITING' },
  waitUntil: (promise) => { waitUntilPromise = promise; },
});
await waitUntilPromise;
assert.equal(skipWaitingCalls, 1, 'only the explicit message should activate the waiting worker');

const dispatchFetch = async (request) => {
  let responsePromise;
  handlers.get('fetch')({
    request,
    respondWith: (promise) => { responsePromise = promise; },
  });
  return responsePromise;
};
const request = (path, mode = 'cors') => ({
  method: 'GET',
  url: `https://aurora.test${path}`,
  mode,
});

assert.equal(await dispatchFetch(request('/api/account')), undefined, 'API responses must remain outside the cache');
assert.equal(await dispatchFetch(request('/rest/v1/tasks')), undefined, 'Supabase REST responses must remain outside the cache');
assert.equal(await dispatchFetch(request('/assets/app-abc12345.js?session=private')), undefined, 'query-string requests must not be cached');
assert.equal(await dispatchFetch(request('/service-worker.js')), undefined, 'the worker script must be revalidated by the browser');
assert.equal(await dispatchFetch(request('/manifest.webmanifest')), undefined, 'the manifest must not be cached by the worker');

const assetRequest = request('/assets/app-abc12345.js');
assert.equal(await dispatchFetch(assetRequest), assetResponse);
const fetchCountAfterAssetMiss = fetchCalls.length;
assert.equal(await dispatchFetch(assetRequest), assetResponse, 'app assets should be cache-first');
assert.equal(fetchCalls.length, fetchCountAfterAssetMiss, 'cached app assets should not be fetched again');

const rootRequest = request('/', 'navigate');
assert.equal(await dispatchFetch(rootRequest), htmlResponse);
assert.equal(fetchCalls.at(-1).options.cache, 'no-cache', 'HTML navigations must prefer the network');
const indexFallback = stored.get('https://aurora.test/index.html');
assert.equal(indexFallback, htmlResponse, 'the HTML shell should be available as an offline fallback');
assert.equal(await dispatchFetch(request('/pages/inicio.html', 'navigate')), htmlResponse, 'offline routes should fall back to the HTML shell');
assert.equal(await dispatchFetch(request('/config?section=data', 'navigate')), htmlResponse, 'offline path routes with query state should fall back to the HTML shell');
assert.equal(stored.has('https://aurora.test/config?section=data'), false, 'query-specific route state must not be cached');

assert.match(source, /aurora-static-v11/);
assert.match(source, /APP_SHELL_ASSET/);
assert.match(source, /APP_ROUTE/);
assert.match(source, /APP_DOCUMENT/);

console.log('Service worker: shell restrito, cache-first de assets, HTML network-first e atualização sob demanda verificados.');
