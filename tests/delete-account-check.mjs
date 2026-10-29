import assert from 'node:assert/strict';
import {
  createSubscriptionEndpoint,
  parseAllowedOrigins,
  removeRemotePushSubscriptions,
} from '../supabase/functions/delete-account/push-cleanup.js';

assert.deepEqual(
  parseAllowedOrigins('https://aurora.example, http://localhost:5173, https://*.example'),
  ['https://aurora.example'],
);
assert.equal(createSubscriptionEndpoint('https://push.example').href, 'https://push.example/api/subscription');
assert.throws(() => createSubscriptionEndpoint('http://push.example'), /push-service-not-configured/);
assert.throws(() => createSubscriptionEndpoint('https://user:pass@push.example'), /push-service-not-configured/);

const subscription = {
  worker_client_id: 'a'.repeat(32),
  worker_capability: 'b'.repeat(43),
};
const calls = [];
await removeRemotePushSubscriptions([subscription, subscription], {
  apiUrl: 'https://push.example',
  origin: 'https://aurora.example',
  fetcher: async (url, options) => {
    calls.push({ url: url.href, options });
    return new Response(null, { status: 200 });
  },
});
assert.equal(calls.length, 2);
assert.equal(calls[0].url, 'https://push.example/api/subscription');
assert.equal(calls[0].options.method, 'DELETE');
assert.equal(calls[0].options.headers.Authorization, `Bearer ${subscription.worker_capability}`);
assert.equal(calls[0].options.headers.Origin, 'https://aurora.example');
assert.equal(calls[0].options.headers['X-Aurora-Client'], subscription.worker_client_id);

let fetchCalled = false;
await assert.rejects(removeRemotePushSubscriptions([subscription], {
  apiUrl: 'https://push.example',
  origin: 'https://aurora.example',
  fetcher: async () => {
    fetchCalled = true;
    return new Response(null, { status: 503 });
  },
}), /push-cleanup-failed/);
assert.equal(fetchCalled, true);

fetchCalled = false;
await assert.rejects(removeRemotePushSubscriptions([{
  ...subscription,
  worker_capability: 'invalid',
}], {
  apiUrl: 'https://push.example',
  origin: 'https://aurora.example',
  fetcher: async () => {
    fetchCalled = true;
    return new Response(null, { status: 200 });
  },
}), /push-credentials-invalid/);
assert.equal(fetchCalled, false);

console.log('delete-account-check: all checks passed');
