import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import worker, { PomodoroAlarm } from '../src/index.js';

class MemoryStorage {
  constructor() {
    this.values = new Map();
    this.alarm = null;
  }

  async get(key) {
    return this.values.get(key);
  }

  async put(key, value) {
    this.values.set(key, structuredClone(value));
  }

  async delete(keys) {
    const list = Array.isArray(keys) ? keys : [keys];
    list.forEach((key) => this.values.delete(key));
    return list.length;
  }

  async setAlarm(timestamp) {
    this.alarm = timestamp;
  }

  async deleteAlarm() {
    this.alarm = null;
  }
}

class MemoryNamespace {
  constructor(env) {
    this.env = env;
    this.objects = new Map();
  }

  idFromName(name) {
    return name;
  }

  get(id) {
    if (!this.objects.has(id)) {
      const state = { storage: new MemoryStorage() };
      this.objects.set(id, {
        state,
        instance: new PomodoroAlarm(state, this.env),
        fetch: (input, init) => this.objects.get(id).instance.fetch(
          input instanceof Request ? input : new Request(input, init),
        ),
      });
    }
    return this.objects.get(id);
  }
}

async function vapidKeys() {
  const pair = await webcrypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify'],
  );
  const jwk = await webcrypto.subtle.exportKey('jwk', pair.privateKey);
  const publicKey = Buffer.concat([
    Buffer.from([4]),
    Buffer.from(jwk.x, 'base64url'),
    Buffer.from(jwk.y, 'base64url'),
  ]).toString('base64url');
  return { publicKey, privateKey: Buffer.from(jwk.d, 'base64url').toString('base64url') };
}

async function environment(overrides = {}) {
  const keys = await vapidKeys();
  const env = {
    ALLOWED_ORIGINS: 'https://aurora-9ze.pages.dev',
    ENVIRONMENT: 'production',
    VAPID_PUBLIC_KEY: keys.publicKey,
    VAPID_PRIVATE_KEY: keys.privateKey,
    VAPID_SUBJECT: 'mailto:test@example.invalid',
    REGISTER_RATE_LIMIT: { limit: async () => ({ success: true }) },
    API_RATE_LIMIT: { limit: async () => ({ success: true }) },
    ...overrides,
  };
  env.POMODORO_ALARMS = new MemoryNamespace(env);
  return env;
}

function request(path, { method = 'GET', body, headers = {}, origin = 'https://aurora-9ze.pages.dev' } = {}) {
  const requestHeaders = new Headers({ Origin: origin, ...headers });
  if (body !== undefined && !requestHeaders.has('Content-Type')) requestHeaders.set('Content-Type', 'application/json');
  return new Request(`https://push.example${path}`, {
    method,
    headers: requestHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function call(env, path, options = {}) {
  const response = await worker.fetch(request(path, options), env);
  return { response, body: await response.json() };
}

async function register(env) {
  const result = await call(env, '/api/clients', {
    method: 'POST',
    body: {},
    headers: { 'CF-Connecting-IP': '192.0.2.10' },
  });
  assert.equal(result.response.status, 201);
  return result.body;
}

async function createSubscription() {
  const pair = await webcrypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits'],
  );
  return {
    endpoint: 'https://web.push.apple.com/push-id',
    expirationTime: null,
    keys: {
      p256dh: Buffer.from(await webcrypto.subtle.exportKey('raw', pair.publicKey)).toString('base64url'),
      auth: Buffer.alloc(16, 2).toString('base64url'),
    },
  };
}

function authHeaders(client) {
  return {
    Authorization: `Bearer ${client.capability}`,
    'X-Aurora-Client': client.clientId,
  };
}

test('CORS é exato, e a configuração pública expõe somente a chave VAPID pública', async () => {
  const env = await environment();
  const blocked = await call(env, '/api/config', { origin: 'https://attacker.example' });
  assert.equal(blocked.response.status, 403);
  const config = await call(env, '/api/config');
  assert.equal(config.response.status, 200);
  assert.equal(config.body.publicKey, env.VAPID_PUBLIC_KEY);
  assert.equal(Object.hasOwn(config.body, 'privateKey'), false);
  assert.equal(config.response.headers.get('Access-Control-Allow-Origin'), 'https://aurora-9ze.pages.dev');
  assert.equal(config.response.headers.get('Cache-Control'), 'no-store');
});

test('registro exige POST, JSON estrito, IP do Cloudflare e limite de taxa', async () => {
  const env = await environment();
  const wrongMethod = await call(env, '/api/clients', { method: 'GET' });
  assert.equal(wrongMethod.response.status, 405);
  const extraField = await call(env, '/api/clients', { method: 'POST', body: { email: 'x' } });
  assert.equal(extraField.response.status, 400);
  const wrongContentType = await call(env, '/api/clients', {
    method: 'POST',
    body: {},
    headers: { 'CF-Connecting-IP': '192.0.2.10', 'Content-Type': 'text/plain' },
  });
  assert.equal(wrongContentType.response.status, 400);
  const missingIp = await call(env, '/api/clients', { method: 'POST', body: {} });
  assert.equal(missingIp.response.status, 503);
  env.REGISTER_RATE_LIMIT = { limit: async () => ({ success: false }) };
  const limited = await call(env, '/api/clients', {
    method: 'POST',
    body: {},
    headers: { 'CF-Connecting-IP': '192.0.2.10' },
  });
  assert.equal(limited.response.status, 429);
});

test('requisições autenticadas também respeitam o limite por instalação', async () => {
  const env = await environment();
  const client = await register(env);
  env.API_RATE_LIMIT = { limit: async ({ key }) => ({ success: key !== client.clientId }) };
  const limited = await call(env, '/api/schedule', {
    method: 'DELETE',
    headers: authHeaders(client),
  });
  assert.equal(limited.response.status, 429);
  assert.equal(limited.body.error, 'rate-limited');
});

test('a inscrição rejeita destinos de rede arbitrários e estruturas inesperadas', async () => {
  const env = await environment();
  const client = await register(env);
  const pushSubscription = await createSubscription();
  const result = await call(env, '/api/subscription', {
    method: 'POST',
    headers: authHeaders(client),
    body: { subscription: { ...pushSubscription, endpoint: 'https://127.0.0.1/admin' } },
  });
  assert.equal(result.response.status, 400);
  assert.equal(result.body.error, 'invalid-subscription');
});

test('credencial autoriza a inscrição; o alarme avança a pausa mesmo após quatro blocos', async () => {
  const env = await environment();
  const client = await register(env);
  const pushSubscription = await createSubscription();
  const unauthenticated = await call(env, '/api/schedule', {
    method: 'POST',
    body: {},
    headers: { 'X-Aurora-Client': client.clientId },
  });
  assert.equal(unauthenticated.response.status, 401);

  const subscribed = await call(env, '/api/subscription', {
    method: 'POST',
    headers: authHeaders(client),
    body: { subscription: pushSubscription },
  });
  assert.equal(subscribed.response.status, 200);

  const now = Date.now();
  const schedule = {
    phase: 'focus',
    phaseEndsAt: now + 60_000,
    focusMin: 25,
    breakMin: 5,
    longBreakMin: 15,
    completedPomodoros: 3,
  };
  const scheduled = await call(env, '/api/schedule', {
    method: 'POST',
    headers: authHeaders(client),
    body: schedule,
  });
  assert.equal(scheduled.response.status, 200);

  const object = env.POMODORO_ALARMS.get(client.clientId);
  const originalNow = Date.now;
  const originalFetch = globalThis.fetch;
  let pushCount = 0;
  Date.now = () => schedule.phaseEndsAt;
  globalThis.fetch = async (url, init) => {
    pushCount += 1;
    assert.equal(url, pushSubscription.endpoint);
    assert.equal(init.method, 'post');
    return new Response(null, { status: 201 });
  };
  try {
    await object.instance.alarm();
  } finally {
    Date.now = originalNow;
    globalThis.fetch = originalFetch;
  }

  const next = await object.state.storage.get('schedule');
  assert.equal(next.phase, 'short-break');
  assert.equal(next.completedPomodoros, 4);
  assert.equal(next.phaseEndsAt, schedule.phaseEndsAt + 5 * 60_000);
  assert.equal(object.state.storage.alarm, next.phaseEndsAt);
  assert.equal(pushCount, 1);
  assert.equal(Object.keys(next).some((key) => /task|name|email/i.test(key)), false);
});

test('o servidor impõe horizonte curto e cancelar remove o alarme', async () => {
  const env = await environment();
  const client = await register(env);
  const pushSubscription = await createSubscription();
  await call(env, '/api/subscription', {
    method: 'POST',
    headers: authHeaders(client),
    body: { subscription: pushSubscription },
  });
  const tooFar = await call(env, '/api/schedule', {
    method: 'POST',
    headers: authHeaders(client),
    body: {
      phase: 'focus',
      phaseEndsAt: Date.now() + 5 * 60 * 60 * 1000,
      focusMin: 25,
      breakMin: 5,
      longBreakMin: 15,
      completedPomodoros: 0,
    },
  });
  assert.equal(tooFar.response.status, 400);
  assert.equal(tooFar.body.error, 'schedule-horizon');

  const valid = await call(env, '/api/schedule', {
    method: 'POST',
    headers: authHeaders(client),
    body: {
      phase: 'focus',
      phaseEndsAt: Date.now() + 60_000,
      focusMin: 25,
      breakMin: 5,
      longBreakMin: 15,
      completedPomodoros: 0,
    },
  });
  assert.equal(valid.response.status, 200);
  const cancelled = await call(env, '/api/schedule', {
    method: 'DELETE',
    headers: authHeaders(client),
  });
  assert.equal(cancelled.response.status, 200);
  const object = env.POMODORO_ALARMS.get(client.clientId);
  assert.equal(object.state.storage.alarm, null);
  assert.equal(await object.state.storage.get('schedule'), undefined);
  assert.ok(await object.state.storage.get('subscription'));
  await call(env, '/api/schedule', {
    method: 'POST',
    headers: authHeaders(client),
    body: {
      phase: 'focus',
      phaseEndsAt: Date.now() + 60_000,
      focusMin: 25,
      breakMin: 5,
      longBreakMin: 15,
      completedPomodoros: 0,
    },
  });
  const unsubscribed = await call(env, '/api/subscription', {
    method: 'DELETE',
    headers: authHeaders(client),
  });
  assert.equal(unsubscribed.response.status, 200);
  assert.equal(object.state.storage.alarm, null);
  assert.equal(await object.state.storage.get('schedule'), undefined);
  assert.equal(await object.state.storage.get('subscription'), undefined);
});

test('lembretes de hábitos são recorrentes, genéricos e compartilham o alarme do dispositivo', async () => {
  const env = await environment();
  const client = await register(env);
  const pushSubscription = await createSubscription();
  await call(env, '/api/subscription', {
    method: 'POST',
    headers: authHeaders(client),
    body: { subscription: pushSubscription },
  });
  const now = Date.parse('2026-10-26T14:00:00.000Z');
  const pomoEndsAt = Date.parse('2026-10-26T15:00:00.000Z');
  const reminder = {
    id: 'habit-0',
    days: [1],
    time: '10:02',
    timeZone: 'America/New_York',
    skipDate: null,
  };
  const originalNow = Date.now;
  const originalFetch = globalThis.fetch;
  let pushCount = 0;
  Date.now = () => now;
  try {
    const pomodoro = await call(env, '/api/schedule', {
      method: 'POST',
      headers: authHeaders(client),
      body: {
        phase: 'focus',
        phaseEndsAt: pomoEndsAt,
        focusMin: 25,
        breakMin: 5,
        longBreakMin: 15,
        completedPomodoros: 0,
      },
    });
    assert.equal(pomodoro.response.status, 200);
    const invalid = await call(env, '/api/habits', {
      method: 'POST',
      headers: authHeaders(client),
      body: { reminders: [{ ...reminder, name: 'Beber água' }] },
    });
    assert.equal(invalid.response.status, 400);
    assert.equal(invalid.body.error, 'invalid-habit-reminders');

    const scheduled = await call(env, '/api/habits', {
      method: 'POST',
      headers: authHeaders(client),
      body: { reminders: [reminder] },
    });
    assert.equal(scheduled.response.status, 200);
    assert.equal(scheduled.body.scheduledAt, Date.parse('2026-10-26T14:02:00.000Z'));
    const object = env.POMODORO_ALARMS.get(client.clientId);
    const saved = await object.state.storage.get('habitReminders');
    assert.deepEqual(saved, [reminder]);
    assert.equal(JSON.stringify(saved).includes('Beber água'), false);

    Date.now = () => scheduled.body.scheduledAt;
    globalThis.fetch = async (url) => {
      pushCount += 1;
      assert.equal(url, pushSubscription.endpoint);
      return new Response(null, { status: 201 });
    };
    await object.instance.alarm();
    assert.equal(pushCount, 1);
    assert.equal(object.state.storage.alarm, pomoEndsAt);
    assert.equal((await object.state.storage.get('schedule')).phase, 'focus');

    Date.now = () => pomoEndsAt;
    await object.instance.alarm();
    assert.equal(pushCount, 2);
    assert.equal((await object.state.storage.get('schedule')).phase, 'short-break');
    assert.equal(object.state.storage.alarm, Date.parse('2026-10-26T15:05:00.000Z'));

    const cleared = await call(env, '/api/habits', {
      method: 'DELETE',
      headers: authHeaders(client),
    });
    assert.equal(cleared.response.status, 200);
    assert.equal(await object.state.storage.get('habitReminders'), undefined);
    assert.equal(object.state.storage.alarm, Date.parse('2026-10-26T15:05:00.000Z'));
    await call(env, '/api/schedule', { method: 'DELETE', headers: authHeaders(client) });
    assert.equal(object.state.storage.alarm, null);
  } finally {
    Date.now = originalNow;
    globalThis.fetch = originalFetch;
  }
});

test('horário local inexistente no início do horário de verão é ignorado até a próxima ocorrência', async () => {
  const env = await environment();
  const client = await register(env);
  const pushSubscription = await createSubscription();
  await call(env, '/api/subscription', {
    method: 'POST',
    headers: authHeaders(client),
    body: { subscription: pushSubscription },
  });
  const now = Date.parse('2026-03-08T05:00:00.000Z');
  const originalNow = Date.now;
  Date.now = () => now;
  try {
    const scheduled = await call(env, '/api/habits', {
      method: 'POST',
      headers: authHeaders(client),
      body: {
        reminders: [{
          id: 'habit-0',
          days: [0],
          time: '02:30',
          timeZone: 'America/New_York',
          skipDate: null,
        }],
      },
    });
    assert.equal(scheduled.response.status, 200);
    assert.equal(scheduled.body.scheduledAt, Date.parse('2026-03-15T06:30:00.000Z'));
  } finally {
    Date.now = originalNow;
  }
});
