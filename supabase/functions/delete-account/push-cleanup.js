const CLIENT_ID_PATTERN = /^[A-Za-z0-9_-]{20,64}$/;
const CAPABILITY_PATTERN = /^[A-Za-z0-9_-]{32,64}$/;

export function parseAllowedOrigins(value) {
  return String(value || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => {
      try {
        const url = new URL(origin);
        return url.origin === origin
          && !url.hostname.includes('*')
          && url.protocol === 'https:';
      } catch {
        return false;
      }
    });
}

export function createSubscriptionEndpoint(apiUrl) {
  let base;
  try {
    base = new URL(apiUrl);
  } catch {
    throw new Error('push-service-not-configured');
  }
  if (
    base.protocol !== 'https:'
    || base.username
    || base.password
    || base.pathname !== '/'
    || base.search
    || base.hash
  ) throw new Error('push-service-not-configured');
  return new URL('/api/subscription', base);
}

export async function removeRemotePushSubscriptions(subscriptions, {
  apiUrl,
  origin,
  fetcher = fetch,
}) {
  if (!subscriptions.length) return;
  if (!origin) throw new Error('push-origin-not-allowed');
  const endpoint = createSubscriptionEndpoint(apiUrl);

  for (const subscription of subscriptions) {
    if (
      !CLIENT_ID_PATTERN.test(subscription.worker_client_id)
      || !CAPABILITY_PATTERN.test(subscription.worker_capability)
    ) throw new Error('push-credentials-invalid');

    const response = await fetcher(endpoint, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${subscription.worker_capability}`,
        Origin: origin,
        'X-Aurora-Client': subscription.worker_client_id,
      },
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error('push-cleanup-failed');
  }
}
