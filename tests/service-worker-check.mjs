import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('../service-worker.js', import.meta.url), 'utf8');
const handlers = new Map();
let skipWaitingCalls = 0;
const self = {
  location: { origin: 'https://aurora.test' },
  registration: { scope: 'https://aurora.test/' },
  clients: { claim: async () => {} },
  addEventListener: (type, handler) => handlers.set(type, handler),
  skipWaiting: async () => { skipWaitingCalls += 1; },
};

runInNewContext(source, {
  self,
  URL,
  Promise,
  caches: { keys: async () => [], open: async () => ({}) },
  fetch: async () => { throw new Error('fetch should not run in this test'); },
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

let handledByWorker = false;
handlers.get('fetch')({
  request: { method: 'GET', url: 'https://aurora.test/api/account', mode: 'cors' },
  respondWith: () => { handledByWorker = true; },
});
assert.equal(handledByWorker, false, 'API responses must remain outside the service-worker cache');
assert.match(source, /aurora-static-v9/);

console.log('Service worker: atualização sob demanda e exclusão de APIs do cache verificadas.');
