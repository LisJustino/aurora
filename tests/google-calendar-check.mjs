import assert from 'node:assert/strict';
import { createGoogleCalendarService, GOOGLE_CALENDAR_SCOPE } from '../src/js/services/google-calendar.js';

let now = 10_000;
let tokenOptions;
const requests = [];
const identity = {
  accounts: {
    oauth2: {
      initTokenClient(options) {
        tokenOptions = options;
        return {
          requestAccessToken() {
            options.callback({
              access_token: 'test-calendar-token',
              expires_in: 3600,
              scope: GOOGLE_CALENDAR_SCOPE,
            });
          },
        };
      },
    },
  },
};
const jsonResponse = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});
const service = createGoogleCalendarService({
  clientId: 'calendar-test.apps.googleusercontent.com',
  now: () => now,
  loadIdentity: async () => identity,
  fetchImpl: async (url, options) => {
    const parsed = new URL(url);
    requests.push({ url: parsed, options });
    if (parsed.pathname.endsWith('/calendarList')) {
      return parsed.searchParams.has('pageToken')
        ? jsonResponse({ items: [{ id: 'shared', summary: 'Compartilhado', accessRole: 'reader' }] })
        : jsonResponse({
          items: [
            { id: 'primary', summary: 'Pessoal', primary: true, selected: true, accessRole: 'owner' },
            { id: 'busy-only', summary: 'Disponibilidade', accessRole: 'freeBusyReader' },
          ],
          nextPageToken: 'next',
        });
    }
    if (parsed.pathname.endsWith('/events')) {
      return jsonResponse({
        items: [
          { summary: 'Feriado', start: { date: '2026-11-03' } },
          { summary: 'Reunião <teste>', start: { dateTime: '2026-11-02T10:30:00-03:00' } },
          { status: 'cancelled', summary: 'Cancelado', start: { date: '2026-11-04' } },
          { summary: 'Data inválida', start: { date: '2026-02-30' } },
        ],
      });
    }
    return jsonResponse({}, 404);
  },
});

assert.equal(service.isConfigured(), true);
assert.equal(service.isConnected(), false);
await service.prepare();
assert.equal(service.isPrepared(), true);
await service.authorize();
assert.equal(service.isConnected(), true);
assert.equal(tokenOptions.scope, GOOGLE_CALENDAR_SCOPE);
assert.equal(tokenOptions.client_id, 'calendar-test.apps.googleusercontent.com');

const calendars = await service.getCalendars();
assert.deepEqual(calendars, [
  { id: 'primary', name: 'Pessoal', primary: true, selected: true },
  { id: 'shared', name: 'Compartilhado', primary: false, selected: false },
]);

const events = await service.getEvents(['primary'], {
  start: new Date(2026, 10, 1),
  end: new Date(2026, 11, 1),
});
assert.equal(events.length, 2);
assert.deepEqual(events.map((event) => event.day), ['2026-11-02', '2026-11-03']);
assert.equal(events[0].title, 'Reunião <teste>');
assert.equal(events[1].allDay, true);
assert.equal(events[1].time, 'Dia inteiro');
assert.equal(requests.every(({ options }) => options.method === 'GET'
  && options.credentials === 'omit'
  && options.cache === 'no-store'
  && options.headers.Authorization === 'Bearer test-calendar-token'), true);
assert.equal(requests.every(({ url }) => url.searchParams.has('access_token') === false), true);

await assert.rejects(
  service.getEvents(['primary'], { start: new Date(2026, 10, 1), end: new Date(2026, 10, 1) }),
  /período selecionado.*inválido/i,
);
await assert.rejects(service.getEvents([''], { start: new Date(2026, 10, 1), end: new Date(2026, 11, 1) }), /calendários válidos/i);

service.clear();
assert.equal(service.isConnected(), false);
await assert.rejects(service.getCalendars(), /expirou/i);

let missingConfigLoaderCalled = false;
const missingConfig = createGoogleCalendarService({
  clientId: '',
  loadIdentity: async () => { missingConfigLoaderCalled = true; return identity; },
});
assert.equal(missingConfig.isConfigured(), false);
await assert.rejects(missingConfig.prepare(), /ainda não foi configurada/i);
assert.equal(missingConfigLoaderCalled, false);

const denied = createGoogleCalendarService({
  clientId: 'calendar-test.apps.googleusercontent.com',
  loadIdentity: async () => ({
    accounts: {
      oauth2: {
        initTokenClient: (options) => ({
          requestAccessToken: () => options.callback({ error: 'access_denied' }),
        }),
      },
    },
  }),
  fetchImpl: async () => jsonResponse({}),
});
await denied.prepare();
await assert.rejects(denied.authorize(), /autorização.*cancelada/i);
assert.equal(denied.isConnected(), false);

const expiring = createGoogleCalendarService({
  clientId: 'calendar-test.apps.googleusercontent.com',
  now: () => now,
  loadIdentity: async () => identity,
  fetchImpl: async () => jsonResponse({ items: [] }),
});
await expiring.prepare();
await expiring.authorize();
now += 3_600_001;
assert.equal(expiring.isConnected(), false);
await assert.rejects(expiring.getCalendars(), /expirou/i);

console.log('google-calendar-check: all checks passed');
