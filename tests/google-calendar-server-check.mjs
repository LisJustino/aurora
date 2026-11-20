import assert from 'node:assert/strict';
import {
  decryptRefreshToken,
  encryptRefreshToken,
  importEncryptionKey,
} from '../supabase/functions/_shared/google-calendar-tokens.js';
import {
  GoogleCalendarError,
  handleGoogleCalendarAction,
  normalizeCalendarIds,
} from '../supabase/functions/google-calendar/logic.js';

const secret = Buffer.alloc(32, 7).toString('base64url');
const key = await importEncryptionKey(secret);
const userId = '11111111-1111-4111-8111-111111111111';
const otherUser = '22222222-2222-4222-8222-222222222222';

// Criptografia: ida e volta, valor distinto a cada vez e preso ao usuário.
const encrypted = await encryptRefreshToken('refresh-secret', key, userId);
assert.match(encrypted, /^v1\./);
assert.equal(encrypted.includes('refresh-secret'), false);
assert.notEqual(encrypted, await encryptRefreshToken('refresh-secret', key, userId));
assert.equal(await decryptRefreshToken(encrypted, key, userId), 'refresh-secret');
await assert.rejects(decryptRefreshToken(encrypted, key, otherUser));
await assert.rejects(importEncryptionKey('curta'), /encryption-key-invalid/);

// Banco falso mínimo com a mesma interface encadeada do Supabase.
function createDb(rows = []) {
  const table = rows;
  const builder = (filters = {}, mode = 'select') => ({
    select: () => builder(filters, mode),
    eq: (column, value) => builder({ ...filters, [column]: value }, mode),
    order: () => builder(filters, mode),
    delete: () => builder(filters, 'delete'),
    update: (patch) => builder({ ...filters, __patch: patch }, 'update'),
    upsert: (row) => builder({ __row: row }, 'upsert'),
    single: () => builder(filters, mode).resolve(true),
    maybeSingle: () => builder(filters, mode).resolve(true),
    then: (ok, fail) => builder(filters, mode).resolve(false).then(ok, fail),
    resolve: async (single) => {
      const match = (row) => Object.entries(filters).every(([k, v]) => k.startsWith('__') || row[k] === v);
      if (mode === 'upsert') {
        const input = filters.__row;
        let row = table.find((item) => item.user_id === input.user_id && item.google_subject === input.google_subject);
        if (row) Object.assign(row, input);
        else { row = { id: `00000000-0000-4000-8000-${String(table.length + 1).padStart(12, '0')}`, selected_calendar_ids: [], ...input }; table.push(row); }
        return { data: row, error: null };
      }
      if (mode === 'delete') {
        for (let i = table.length - 1; i >= 0; i -= 1) if (match(table[i])) table.splice(i, 1);
        return { data: null, error: null };
      }
      if (mode === 'update') {
        table.filter(match).forEach((row) => Object.assign(row, filters.__patch));
        return { data: null, error: null };
      }
      const found = table.filter(match);
      return { data: single ? found[0] || null : found, error: null };
    },
  });
  return { rows: table, from: () => builder() };
}

const calls = [];
const tokenRedirectUris = [];
const google = (handlers) => async (url, options = {}) => {
  calls.push(String(url));
  if (String(url).includes('oauth2.googleapis.com/token')) {
    tokenRedirectUris.push(new URLSearchParams(options.body).get('redirect_uri'));
  }
  const handler = Object.entries(handlers).find(([part]) => String(url).includes(part))?.[1];
  const result = handler
    ? handler(options)
    : String(url).includes('/calendar/v3/users/me/calendarList')
      ? { status: 200, body: { items: [] } }
      : { status: 404, body: {} };
  return { ok: result.status < 400, status: result.status, json: async () => result.body };
};
const base = (db, fetchImpl) => ({
  db, userId, key, clientId: 'id', clientSecret: 'secret', origin: 'https://aurora-rotinas.com.br', fetchImpl,
});

// connect: troca o código, grava só criptografado e devolve token de acesso.
const db = createDb();
const connected = await handleGoogleCalendarAction({ action: 'connect', code: 'abc' }, base(db, google({
  'oauth2.googleapis.com/token': () => ({ status: 200, body: { access_token: 'access-1', refresh_token: 'refresh-1', expires_in: 3599 } }),
  'userinfo': () => ({ status: 200, body: { sub: 'g-1', email: 'pessoa@example.test' } }),
})));
assert.equal(connected.accessToken, 'access-1');
assert.equal(tokenRedirectUris.at(-1), 'https://aurora-rotinas.com.br');
assert.equal(connected.account.email, 'pessoa@example.test');
assert.equal(JSON.stringify(connected).includes('refresh-1'), false);
assert.equal(db.rows.length, 1);
assert.equal(JSON.stringify(db.rows).includes('refresh-1'), false);
const id = connected.account.id;

const scopeDeniedDb = createDb();
await assert.rejects(handleGoogleCalendarAction({ action: 'connect', code: 'scope-denied' }, base(scopeDeniedDb, google({
  'oauth2.googleapis.com/token': () => ({ status: 200, body: { access_token: 'access-denied', refresh_token: 'refresh-denied', expires_in: 3599 } }),
  '/calendar/v3/users/me/calendarList': () => ({
    status: 403,
    body: { error: { errors: [{ reason: 'insufficientPermissions' }] } },
  }),
}))), (error) => error.code === 'calendar-scope-missing');
assert.equal(scopeDeniedDb.rows.length, 0, 'sem acesso de leitura, a conexão não é persistida');

await assert.rejects(
  handleGoogleCalendarAction(
    { action: 'connect', code: 'missing-origin' },
    { ...base(db, google({})), origin: '' },
  ),
  (error) => error.code === 'invalid-request',
);

// reconectar a mesma conta sem refresh token reaproveita o guardado.
await handleGoogleCalendarAction({ action: 'connect', code: 'def' }, base(db, google({
  'oauth2.googleapis.com/token': () => ({ status: 200, body: { access_token: 'access-2', expires_in: 3599 } }),
  'userinfo': () => ({ status: 200, body: { sub: 'g-1', email: 'pessoa@example.test' } }),
})));
assert.equal(db.rows.length, 1);
assert.equal(await decryptRefreshToken(db.rows[0].refresh_token_encrypted, key, userId), 'refresh-1');
// conta nova sem refresh token é recusada.
await assert.rejects(handleGoogleCalendarAction({ action: 'connect', code: 'x' }, base(db, google({
  'oauth2.googleapis.com/token': () => ({ status: 200, body: { access_token: 'a', expires_in: 3599 } }),
  'userinfo': () => ({ status: 200, body: { sub: 'g-2', email: 'outra@example.test' } }),
}))), (error) => error.code === 'no-refresh-token');

// list / select / token.
assert.deepEqual((await handleGoogleCalendarAction({ action: 'list' }, base(db, google({})))).accounts.map((a) => a.email), ['pessoa@example.test']);
assert.deepEqual((await handleGoogleCalendarAction({ action: 'select', id, calendarIds: ['a', 'a', 'b'] }, base(db, google({})))).selectedCalendarIds, ['a', 'b']);
assert.throws(() => normalizeCalendarIds('x'), GoogleCalendarError);
const refreshed = await handleGoogleCalendarAction({ action: 'token', id }, base(db, google({
  'oauth2.googleapis.com/token': () => ({ status: 200, body: { access_token: 'access-3', expires_in: 3599 } }),
})));
assert.equal(refreshed.accessToken, 'access-3');
// outro usuário não enxerga nem usa a conexão.
await assert.rejects(handleGoogleCalendarAction({ action: 'token', id }, { ...base(db, google({})), userId: otherUser }), (e) => e.code === 'not-found');
await assert.rejects(handleGoogleCalendarAction({ action: 'token', id: 'não-é-uuid' }, base(db, google({}))), (e) => e.code === 'invalid-request');

// acesso revogado no Google: remove a conexão e pede nova autorização.
await assert.rejects(handleGoogleCalendarAction({ action: 'token', id }, base(db, google({
  'oauth2.googleapis.com/token': () => ({ status: 400, body: { error: 'invalid_grant' } }),
}))), (e) => e.code === 'reauthorization-required' && e.status === 409);
assert.equal(db.rows.length, 0);

// disconnect revoga no Google e apaga.
const again = await handleGoogleCalendarAction({ action: 'connect', code: 'z' }, base(db, google({
  'oauth2.googleapis.com/token': () => ({ status: 200, body: { access_token: 'a', refresh_token: 'refresh-9', expires_in: 3599 } }),
  'userinfo': () => ({ status: 200, body: { sub: 'g-1', email: 'pessoa@example.test' } }),
})));
calls.length = 0;
await handleGoogleCalendarAction({ action: 'disconnect', id: again.account.id }, base(db, google({ 'revoke': () => ({ status: 200, body: {} }) })));
assert.equal(calls.some((url) => url.includes('/revoke')), true);
assert.equal(db.rows.length, 0);
await assert.rejects(handleGoogleCalendarAction({ action: 'nope' }, base(db, google({}))), (e) => e.code === 'invalid-request');

console.log('google-calendar-server-check: all checks passed');
