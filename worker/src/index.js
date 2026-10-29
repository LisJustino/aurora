import { buildPushPayload } from '@block65/webcrypto-web-push';

const API_PREFIX = '/api';
const MAX_BODY_BYTES = 16_384;
const MAX_SCHEDULE_HORIZON_MS = 4 * 60 * 60 * 1000;
const CLIENT_ID_PATTERN = /^[A-Za-z0-9_-]{20,64}$/;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,64}$/;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;
const PHASES = new Set(['focus', 'short-break', 'long-break']);
const PUSH_HOSTS = [
  (hostname) => hostname === 'web.push.apple.com' || hostname.endsWith('.push.apple.com'),
  (hostname) => hostname === 'fcm.googleapis.com',
  (hostname) => hostname === 'push.services.mozilla.com' || hostname.endsWith('.push.services.mozilla.com'),
  (hostname) => hostname.endsWith('.notify.windows.com'),
];

const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
});

function allowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => {
      try {
        const url = new URL(origin);
        return url.origin === origin
          && (url.protocol === 'https:' || (env.ENVIRONMENT === 'development' && url.protocol === 'http:' && url.hostname === 'localhost'));
      } catch {
        return false;
      }
    });
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Aurora-Client',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  };
}

async function readJson(request) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type') || '')) return null;
  const declaredSize = Number(request.headers.get('Content-Length') || 0);
  if (declaredSize > MAX_BODY_BYTES) return null;
  if (!request.body) return {};
  const reader = request.body.getReader();
  const chunks = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > MAX_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  try {
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(value, keys) {
  return isPlainObject(value)
    && Object.keys(value).length === keys.length
    && keys.every((key) => Object.hasOwn(value, key));
}

function validEncodedBytes(value, expectedLength, prefix) {
  if (typeof value !== 'string' || value.length > 128 || !BASE64URL_PATTERN.test(value)) return false;
  try {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')), (character) => character.charCodeAt(0));
    return bytes.length === expectedLength && (prefix === undefined || bytes[0] === prefix);
  } catch {
    return false;
  }
}

function validSchedule(value, now = Date.now()) {
  return hasExactKeys(value, ['phase', 'phaseEndsAt', 'focusMin', 'breakMin', 'longBreakMin', 'completedPomodoros'])
    && PHASES.has(value.phase)
    && Number.isSafeInteger(value.phaseEndsAt)
    && value.phaseEndsAt > now
    && value.phaseEndsAt <= now + MAX_SCHEDULE_HORIZON_MS
    && Number.isInteger(value.focusMin) && value.focusMin >= 5 && value.focusMin <= 120
    && Number.isInteger(value.breakMin) && value.breakMin >= 1 && value.breakMin <= 60
    && Number.isInteger(value.longBreakMin) && value.longBreakMin >= 5 && value.longBreakMin <= 60
    && Number.isSafeInteger(value.completedPomodoros)
    && value.completedPomodoros >= 0
    && value.completedPomodoros <= 1_000_000;
}

function validSubscription(value) {
  if (!hasExactKeys(value, ['subscription']) || !isPlainObject(value.subscription)) return false;
  const subscription = value.subscription;
  if (!hasExactKeys(subscription, ['endpoint', 'expirationTime', 'keys'])) return false;
  if (typeof subscription.endpoint !== 'string' || subscription.endpoint.length > 2048) return false;
  let endpoint;
  try {
    endpoint = new URL(subscription.endpoint);
  } catch {
    return false;
  }
  if (
    endpoint.protocol !== 'https:'
    || endpoint.username
    || endpoint.password
    || endpoint.port
    || !PUSH_HOSTS.some((isAllowed) => isAllowed(endpoint.hostname))
  ) return false;
  if (
    subscription.expirationTime !== null
    && (!Number.isSafeInteger(subscription.expirationTime) || subscription.expirationTime <= Date.now())
  ) return false;
  if (!hasExactKeys(subscription.keys, ['p256dh', 'auth'])) return false;
  const { p256dh, auth } = subscription.keys;
  return validEncodedBytes(p256dh, 65, 4) && validEncodedBytes(auth, 16);
}

async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function makeRandomToken(byteLength) {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function registerClient(env, request, headers) {
  if (request.method !== 'POST') return json({ error: 'method-not-allowed' }, 405, headers);
  const body = await readJson(request);
  if (!hasExactKeys(body, [])) return json({ error: 'invalid-request' }, 400, headers);
  const ip = request.headers.get('CF-Connecting-IP');
  if (!ip) return json({ error: 'server-unavailable' }, 503, headers);
  if (env.REGISTER_RATE_LIMIT) {
    try {
      const { success } = await env.REGISTER_RATE_LIMIT.limit({ key: ip });
      if (!success) return json({ error: 'rate-limited' }, 429, headers);
    } catch {
      return json({ error: 'server-unavailable' }, 503, headers);
    }
  } else if (env.ENVIRONMENT !== 'development') {
    return json({ error: 'server-unavailable' }, 503, headers);
  }
  const clientId = makeRandomToken(24);
  const capability = makeRandomToken(32);
  let provisioned;
  try {
    const stub = env.POMODORO_ALARMS.get(env.POMODORO_ALARMS.idFromName(clientId));
    provisioned = await stub.fetch('https://internal/provision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ authHash: await sha256(capability) }),
    });
  } catch {
    return json({ error: 'server-unavailable' }, 503, headers);
  }
  if (!provisioned.ok) return json({ error: 'server-unavailable' }, 503, headers);
  return json({ clientId, capability }, 201, headers);
}

async function dispatchClientOperation(env, request, headers, operation, body) {
  const clientId = request.headers.get('X-Aurora-Client') || '';
  const authorization = request.headers.get('Authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!CLIENT_ID_PATTERN.test(clientId) || !TOKEN_PATTERN.test(token)) {
    return json({ error: 'unauthorized' }, 401, headers);
  }
  if (operation === 'subscribe' && !validSubscription(body)) {
    return json({ error: 'invalid-subscription' }, 400, headers);
  }
  if (operation === 'schedule' && request.method === 'POST' && !validSchedule(body)) {
    return json({ error: 'schedule-horizon' }, 400, headers);
  }
  if (!['subscribe', 'unsubscribe', 'schedule', 'cancel'].includes(operation)) {
    return json({ error: 'not-found' }, 404, headers);
  }
  if (env.API_RATE_LIMIT) {
    try {
      const { success } = await env.API_RATE_LIMIT.limit({ key: clientId });
      if (!success) return json({ error: 'rate-limited' }, 429, headers);
    } catch {
      return json({ error: 'server-unavailable' }, 503, headers);
    }
  } else if (env.ENVIRONMENT !== 'development') {
    return json({ error: 'server-unavailable' }, 503, headers);
  }
  let response;
  try {
    const stub = env.POMODORO_ALARMS.get(env.POMODORO_ALARMS.idFromName(clientId));
    const internal = new Request(`https://internal/${operation}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Aurora-Client': clientId,
      },
      body: JSON.stringify(body || {}),
    });
    response = await stub.fetch(internal);
  } catch {
    return json({ error: 'server-unavailable' }, 503, headers);
  }
  let result;
  try {
    result = await readJson(response);
  } catch {
    return json({ error: 'server-unavailable' }, 503, headers);
  }
  return json(result || { error: 'server-unavailable' }, response.status, headers);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const origins = allowedOrigins(env);
    if (!origin || !origins.includes(origin)) return json({ error: 'cors' }, 403);
    const headers = corsHeaders(origin);
    if (!url.pathname.startsWith(`${API_PREFIX}/`)) return json({ error: 'not-found' }, 404, headers);
    if (url.search) return json({ error: 'invalid-request' }, 400, headers);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (url.pathname === `${API_PREFIX}/config`) {
      if (request.method !== 'GET') return json({ error: 'method-not-allowed' }, 405, headers);
      if (!validEncodedBytes(env.VAPID_PUBLIC_KEY, 65, 4)) {
        return json({ error: 'server-unavailable' }, 503, headers);
      }
      return json({ publicKey: env.VAPID_PUBLIC_KEY }, 200, headers);
    }
    if (url.pathname === `${API_PREFIX}/clients`) {
      return registerClient(env, request, headers);
    }
    const path = url.pathname;
    if (path === `${API_PREFIX}/subscription`) {
      if (request.method === 'POST') {
        const body = await readJson(request);
        if (!body) return json({ error: 'invalid-request' }, 400, headers);
        return dispatchClientOperation(env, request, headers, 'subscribe', body);
      }
      if (request.method === 'DELETE') {
        if (request.body) return json({ error: 'invalid-request' }, 400, headers);
        return dispatchClientOperation(env, request, headers, 'unsubscribe', {});
      }
    }
    if (path === `${API_PREFIX}/schedule`) {
      if (request.method === 'POST') {
        const body = await readJson(request);
        if (!body) return json({ error: 'invalid-request' }, 400, headers);
        return dispatchClientOperation(env, request, headers, 'schedule', body);
      }
      if (request.method === 'DELETE') {
        if (request.body) return json({ error: 'invalid-request' }, 400, headers);
        return dispatchClientOperation(env, request, headers, 'cancel', {});
      }
    }
    return json({ error: 'not-found' }, 404, headers);
  },
};

function validStoredSchedule(value) {
  return isPlainObject(value)
    && PHASES.has(value.phase)
    && Number.isSafeInteger(value.phaseEndsAt)
    && Number.isInteger(value.focusMin)
    && Number.isInteger(value.breakMin)
    && Number.isInteger(value.longBreakMin)
    && Number.isSafeInteger(value.completedPomodoros);
}

function phaseDurationMs(schedule, phase) {
  const minutes = phase === 'focus'
    ? schedule.focusMin
    : phase === 'long-break'
      ? schedule.longBreakMin
      : schedule.breakMin;
  return minutes * 60_000;
}

function transition(schedule) {
  let completedPomodoros = schedule.completedPomodoros;
  let phase;
  if (schedule.phase === 'focus') {
    completedPomodoros += 1;
    phase = 'short-break';
  } else {
    phase = 'focus';
  }
  return {
    ...schedule,
    phase,
    completedPomodoros,
    phaseEndsAt: schedule.phaseEndsAt + phaseDurationMs(schedule, phase),
  };
}

function notificationFor(phase) {
  if (phase === 'focus') {
    return { title: 'Aurora · Pomodoro', body: 'A pausa terminou. Hora de retomar o foco.' };
  }
  if (phase === 'long-break') {
    return { title: 'Aurora · Pomodoro', body: 'Hora da pausa.' };
  }
  return { title: 'Aurora · Pomodoro', body: 'Bloco de foco concluído. Hora da pausa.' };
}

function constantTimeEqual(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

export class PomodoroAlarm {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.storage = state.storage;
  }

  async authenticate(request) {
    const savedHash = await this.storage.get('authHash');
    const authorization = request.headers.get('Authorization') || '';
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    if (!savedHash || !TOKEN_PATTERN.test(token)) return false;
    return constantTimeEqual(savedHash, await sha256(token));
  }

  async fetch(request) {
    const path = new URL(request.url).pathname;
    if (path === '/provision' && request.method === 'POST') {
      if (await this.storage.get('authHash')) return json({ error: 'already-provisioned' }, 409);
      const body = await readJson(request);
      if (!hasExactKeys(body, ['authHash']) || !/^[a-f0-9]{64}$/.test(body.authHash)) {
        return json({ error: 'invalid-request' }, 400);
      }
      await this.storage.put('authHash', body.authHash);
      return json({ ok: true }, 201);
    }
    if (!(await this.authenticate(request))) return json({ error: 'unauthorized' }, 401);

    if (path === '/subscribe' && request.method === 'POST') {
      const body = await readJson(request);
      if (!validSubscription(body)) return json({ error: 'invalid-subscription' }, 400);
      await this.storage.put('subscription', body.subscription);
      return json({ ok: true });
    }
    if (path === '/unsubscribe' && request.method === 'POST') {
      await this.storage.delete(['subscription', 'schedule']);
      await this.state.storage.deleteAlarm();
      return json({ ok: true });
    }
    if (path === '/schedule' && request.method === 'POST') {
      const body = await readJson(request);
      if (!validSchedule(body)) return json({ error: 'schedule-horizon' }, 400);
      if (!(await this.storage.get('subscription'))) return json({ error: 'subscription-required' }, 409);
      await this.storage.put('schedule', body);
      await this.state.storage.setAlarm(body.phaseEndsAt);
      return json({ ok: true, scheduledAt: body.phaseEndsAt });
    }
    if (path === '/cancel' && request.method === 'POST') {
      await this.storage.delete('schedule');
      await this.state.storage.deleteAlarm();
      return json({ ok: true });
    }
    return json({ error: 'not-found' }, 404);
  }

  async alarm() {
    let schedule = await this.storage.get('schedule');
    const subscription = await this.storage.get('subscription');
    if (!validStoredSchedule(schedule) || !subscription) {
      await this.storage.delete('schedule');
      await this.state.storage.deleteAlarm();
      return;
    }
    let transitions = 0;
    const now = Date.now();
    while (schedule.phaseEndsAt <= now && transitions < 512) {
      schedule = transition(schedule);
      transitions += 1;
    }
    if (transitions >= 512) {
      await this.storage.delete('schedule');
      await this.state.storage.deleteAlarm();
      return;
    }
    await this.storage.put('schedule', schedule);
    await this.state.storage.setAlarm(schedule.phaseEndsAt);
    if (!transitions) return;

    const notification = notificationFor(schedule.phase);
    try {
      const payload = await buildPushPayload({
        data: JSON.stringify(notification),
        options: { ttl: 3600, urgency: 'normal' },
      }, subscription, {
        subject: this.env.VAPID_SUBJECT,
        publicKey: this.env.VAPID_PUBLIC_KEY,
        privateKey: this.env.VAPID_PRIVATE_KEY,
      });
      const response = await fetch(subscription.endpoint, payload);
      if (response.status === 404 || response.status === 410 || response.status === 400) {
        await this.storage.delete(['subscription', 'schedule']);
        await this.state.storage.deleteAlarm();
      } else if (!response.ok) {
        console.warn(`Push do Pomodoro rejeitado pelo serviço (${response.status}).`);
      }
    } catch {
      console.warn('Não foi possível enviar um aviso Push do Pomodoro.');
    }
  }
}
