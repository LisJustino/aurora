import { h, raw } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { today } from '../utils/dates.js';
import { norm } from './core.js';
import { render } from './render.js';
import { toast } from './samples-backup.js';
import { accountSession, S, ui } from './state.js';

let googleCalendarServiceFactory = null;
let googleCalendarServicePromise = null;
function loadGoogleCalendarServiceFactory() {
  if (!googleCalendarServicePromise) {
    googleCalendarServicePromise = import('../services/google-calendar.js')
      .then(({ createGoogleCalendarService }) => {
        googleCalendarServiceFactory = createGoogleCalendarService;
        return googleCalendarServiceFactory;
      })
      .catch((error) => {
        googleCalendarServicePromise = null;
        throw error;
      });
  }
  return googleCalendarServicePromise;
}
let googleCalendarPendingService = null;
let googleCalendarConnectionSequence = 0;
export const googleCalendar = {
  isConfigured: () => Boolean(import.meta.env?.VITE_GOOGLE_CALENDAR_CLIENT_ID?.trim()),
  isConnected: () => ui.googleCalendar.accounts.some((account) => account.service.isConnected()),
  isPrepared: () => googleCalendarPendingService?.isPrepared() || false,
  clear: () => {
    googleCalendarPendingService?.clear();
    googleCalendarPendingService = null;
    ui.googleCalendar.accounts.forEach((account) => account.service.clear());
  },
  prepare: async () => {
    const createService = await loadGoogleCalendarServiceFactory();
    googleCalendarPendingService = createService();
    await googleCalendarPendingService.prepare();
  },
  authorize: () => {
    if (!googleCalendarPendingService) throw new Error('Prepare a conexão com o Google antes de autorizar.');
    return googleCalendarPendingService.authorize({ prompt: 'select_account' });
  },
  // Com conta Aurora ativa a conexão fica guardada no servidor e se renova sozinha.
  persistent: () => Boolean(accountSession?.client && !ui.preview),
  connections: async () => {
    const { createGoogleConnections } = await import('../services/google-calendar-connections.js');
    return createGoogleConnections(accountSession.client);
  },
  getEvents: async (account, ...args) => account.service.getEvents(...args),
};
/* Eventos de hoje das agendas Google conectadas: o mesmo que o Calendário mostra, para a lista ter tudo de hoje. */
export function todayCalendarEvents({ respectFilters = true } = {}) {
  const { f, q } = ui.filters;
  if (respectFilters && f !== 'todas' && f !== 'pendentes') return [];
  const query = respectFilters ? norm(q.trim()) : '';
  const seen = new Set();
  return connectedGoogleCalendarAccounts()
    .flatMap((account) => account.events)
    .filter(
      (event) => event.day === today() && (!query || norm(`${event.title} ${event.calendarName}`).includes(query)),
    )
    .filter((event) => {
      const key =
        event.accountIdentity && event.calendarId && event.id
          ? `google-calendar:${event.accountIdentity}:${event.calendarId}:${event.id}`
          : `google-calendar:fallback:${event.title}:${event.day}:${event.time}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((x, y) => String(x.time || '').localeCompare(String(y.time || '')));
}
export function calendarEventTaskKey(event) {
  if (
    typeof event?.accountIdentity !== 'string' ||
    !event.accountIdentity ||
    typeof event?.calendarId !== 'string' ||
    !event.calendarId ||
    typeof event?.id !== 'string' ||
    !event.id
  )
    return '';
  return `google-calendar:${event.accountIdentity}:${event.calendarId}:${event.id}`;
}
const calendarEventSourceLabel = (event) =>
  event.calendarName === event.accountLabel
    ? event.calendarName || 'Google Calendar'
    : event.calendarName && event.accountLabel
      ? `${event.calendarName} · ${event.accountLabel}`
      : event.calendarName || event.accountLabel || 'Google Calendar';
export const calendarEventsList = (events) =>
  h`<ul class="google-calendar-events">${events.map((event) => {
    const key = calendarEventTaskKey(event);
    const task = key ? S.tasks.find((item) => item.groupId === key) : null;
    const done = task?.done === true;
    return h`<li><time>${event.time}</time><button type="button" class="chk google-calendar-event-check" role="checkbox"
      aria-checked="${String(done)}"
      aria-label="${done ? 'Reabrir tarefa criada do evento' : 'Marcar evento como concluído'}: ${event.title}"
      data-action="google-calendar-event-toggle" data-event-key="${key}" data-event-title="${event.title}"
      data-event-day="${event.day}" data-event-time="${event.allDay ? '' : event.time}"
      data-calendar-name="${event.calendarName}"
      data-account-label="${event.accountLabel}"><span>${icon('check', 15)}</span></button><span class="grow"><b
      class="user-value">${event.title}</b><small>${calendarEventSourceLabel(event)}</small></span></li>`;
  })}</ul>`;
export function googleCalendarSettingsPanel() {
  const state = ui.googleCalendar;
  const configured = googleCalendar.isConfigured();
  const prepared = googleCalendar.isPrepared();
  const busy = ['loading-sdk', 'authorizing', 'loading-calendars'].includes(state.status);
  const statusText = {
    'loading-sdk': 'Preparando a autorização segura do Google…',
    authorizing: 'Aguardando sua autorização do Google…',
    'loading-calendars': 'Carregando seus calendários…',
  }[state.status];
  return h`<section class="card google-calendar-panel" aria-labelledby="google-calendar-settings-title">
    <div class="head">
      <div><h2 id="google-calendar-settings-title">Google Calendar</h2><span class="badge">Somente leitura</span></div>
    </div>
    <p class="small muted">Conecte várias contas Google e escolha quais calendários aparecem em Planejar. O Aurora não cria nem altera eventos. ${googleCalendar.persistent() ? 'A conexão fica guardada com segurança na sua conta Aurora e se renova sozinha: você só precisa autorizar uma vez, até remover a conta aqui ou nas permissões do Google.' : 'Nesta demonstração, autorizações e eventos ficam somente nesta aba e precisam ser conectados novamente ao recarregar a página.'}</p>
    ${
      !configured
        ? h`<p class="small"
      role="alert">Integração indisponível: configure <code>VITE_GOOGLE_CALENDAR_CLIENT_ID</code> neste ambiente.</p>`
        : ''
    }
    ${
      configured && !prepared && !busy
        ? h`<button type="button" class="btn"
      data-action="google-calendar-prepare">${state.status === 'error' ? 'Tentar novamente' : 'Adicionar conta Google'}</button>`
        : ''
    }
    ${
      configured && prepared && !busy
        ? h`<button type="button" class="btn primary"
      data-action="google-calendar-authorize">Autorizar acesso do Google Calendar</button>`
        : ''
    }
    ${statusText ? h`<p class="small muted" role="status" aria-live="polite">${statusText}</p>` : ''}
    ${state.error ? h`<p class="small google-calendar-error" role="alert">${state.error}</p>` : ''}
    ${
      state.accounts.length
        ? h`<div class="google-calendar-accounts" aria-label="Contas Google conectadas">${state.accounts.map(
            (account) => {
              const selected = new Set(account.selectedIds);
              const connected = account.service.isConnected();
              return h`<section class="google-calendar-account" aria-labelledby="google-calendar-account-${account.id}">
        <div class="head"><div><h3 id="google-calendar-account-${account.id}">${account.label}</h3><span
          class="badge">${connected ? 'Conectada' : 'Acesso expirado · remova e adicione novamente'}</span></div>
          <div class="row"><button type="button" class="btn sm" data-action="google-calendar-refresh"
            data-account-id="${account.id}" ${!connected || account.status === 'loading-events' ? raw('disabled') : ''}>Atualizar</button><button
            type="button" class="btn sm ghost" data-action="google-calendar-disconnect"
            data-account-id="${account.id}">Desconectar</button></div>
        </div>
        ${account.error ? h`<p class="small google-calendar-error" role="alert">${account.error}</p>` : ''}
        ${
          account.status === 'loading-events'
            ? h`<p class="small muted"
          role="status">Buscando eventos deste mês…</p>`
            : ''
        }
        ${
          account.calendars.length
            ? h`<div class="google-calendar-sources" aria-label="Calendários de ${account.label}">
          <span class="small muted">Calendários exibidos</span>
          ${account.calendars.map(
            (calendar) => h`<button type="button" class="google-calendar-source"
            data-action="google-calendar-toggle" data-account-id="${account.id}" data-calendar-id="${calendar.id}"
            aria-pressed="${selected.has(calendar.id)}" ${!connected || busy || account.status === 'loading-events' ? raw('disabled') : ''}>${selected.has(calendar.id) ? icon('check', 15) : icon('plus', 15)}<span>${calendar.name}${calendar.primary ? ' · principal' : ''}</span></button>`,
          )}
        </div>`
            : ''
        }
      </section>`;
            },
          )}</div>`
        : ''
    }
    <p class="fine">Para remover uma permissão concedida ao Aurora, gerencie o acesso nas <a
      href="https://myaccount.google.com/permissions" target="_blank"
      rel="noopener noreferrer">permissões da sua Conta Google</a>.</p>
  </section>`;
}
function googleCalendarRange(month) {
  const [year, monthNumber] = month.split('-').map(Number);
  return {
    start: new Date(year, monthNumber - 1, 1),
    end: new Date(year, monthNumber, 1),
  };
}
export function resetGoogleCalendarState() {
  googleCalendar.clear();
  ui.googleCalendar.requestId += 1;
  ui.googleCalendar = { status: 'disconnected', accounts: [], error: '', requestId: ui.googleCalendar.requestId };
}
export function connectedGoogleCalendarAccounts() {
  const accounts = [];
  ui.googleCalendar.accounts.forEach((account) => {
    if (account.service.isConnected()) accounts.push(account);
    else if (account.events.length) {
      account.events = [];
      account.loadedMonth = '';
      account.status = 'disconnected';
    }
  });
  return accounts;
}
export async function loadGoogleCalendarEvents(
  accountIds = connectedGoogleCalendarAccounts().map((account) => account.id),
) {
  const state = ui.googleCalendar;
  const month = ui.taskCal;
  const requestId = ++state.requestId;
  const accounts = connectedGoogleCalendarAccounts().filter((account) => accountIds.includes(account.id));
  accounts.forEach((account) => {
    account.events = [];
    account.loadedMonth = '';
    account.error = '';
    account.status = 'loading-events';
  });
  render();
  const range = googleCalendarRange(month);
  const results = await Promise.all(
    accounts.map(async (account) => {
      if (!account.selectedIds.length) return { account, events: [] };
      try {
        const events = await googleCalendar.getEvents(account, account.selectedIds, range);
        return { account, events };
      } catch (error) {
        return {
          account,
          error: error instanceof Error ? error.message : 'Não foi possível carregar os eventos deste calendário.',
        };
      }
    }),
  );
  if (state !== ui.googleCalendar || state.requestId !== requestId || ui.taskCal !== month) return;
  results.forEach(({ account, events, error }) => {
    if (error) {
      account.status = account.service.isConnected() ? 'error' : 'disconnected';
      account.error = error;
      account.events = [];
      return;
    }
    const names = new Map(account.calendars.map((calendar) => [calendar.id, calendar.name]));
    account.events = events.map((event) => ({
      ...event,
      accountIdentity: account.identity,
      accountLabel: account.label,
      calendarName: names.get(event.calendarId) || 'Google Calendar',
    }));
    account.loadedMonth = month;
    account.status = 'connected';
  });
  render();
}
async function loadGoogleCalendarList(connection = null, restoredService = null) {
  const state = ui.googleCalendar;
  const service = restoredService || googleCalendarPendingService;
  if (!service) throw new Error('A autorização do Google foi perdida. Inicie a conexão novamente.');
  const requestId = ++state.requestId;
  state.status = 'loading-calendars';
  state.error = '';
  render();
  try {
    const calendars = await service.getCalendars();
    if (
      ui.googleCalendar !== state ||
      state.requestId !== requestId ||
      (!restoredService && googleCalendarPendingService !== service)
    )
      return;
    if (!calendars.length) throw new Error('Nenhum calendário com permissão de leitura foi encontrado.');
    const primary = calendars.find((calendar) => calendar.primary);
    const accountIdentity = connection?.email || primary?.id || '';
    if (accountIdentity && state.accounts.some((account) => account.identity === accountIdentity)) {
      throw new Error('Esta conta Google já está conectada nesta aba.');
    }
    const primaryIds = calendars.filter((calendar) => calendar.primary).map((calendar) => calendar.id);
    const knownIds = new Set(calendars.map((calendar) => calendar.id));
    const savedIds = (connection?.selectedCalendarIds || []).filter((id) => knownIds.has(id));
    const selectedIds = savedIds.length
      ? savedIds
      : primaryIds.length
        ? primaryIds
        : calendars.filter((calendar) => calendar.selected).map((calendar) => calendar.id);
    if (!selectedIds.length) selectedIds.push(calendars[0].id);
    const account = {
      id: String(++googleCalendarConnectionSequence),
      serverId: connection?.id || '',
      identity: accountIdentity,
      label: accountIdentity.includes('@') ? accountIdentity : `Conta Google ${state.accounts.length + 1}`,
      service,
      calendars,
      selectedIds,
      events: [],
      error: '',
      status: 'connected',
      loadedMonth: '',
    };
    state.accounts.push(account);
    if (!restoredService) googleCalendarPendingService = null;
    state.status = 'connected';
    state.error = '';
    render();
    await loadGoogleCalendarEvents([account.id]);
  } catch (error) {
    if (ui.googleCalendar !== state || state.requestId !== requestId) return;
    state.status = 'error';
    state.error = error instanceof Error ? error.message : 'Não foi possível carregar seus calendários do Google.';
    service.clear();
    if (googleCalendarPendingService === service) googleCalendarPendingService = null;
    if (restoredService) state.status = state.accounts.length ? 'connected' : 'disconnected';
    render();
  }
}
// Reabre as contas guardadas no servidor assim que o app inicia, sem pedir nova autorização.
export async function restoreGoogleCalendarAccounts() {
  if (!googleCalendar.isConfigured() || !googleCalendar.persistent()) return;
  const state = ui.googleCalendar;
  try {
    const [createService, connections] = await Promise.all([
      loadGoogleCalendarServiceFactory(),
      googleCalendar.connections(),
    ]);
    const saved = await connections.list();
    if (ui.googleCalendar !== state) return;
    for (const connection of saved) {
      if (ui.googleCalendar !== state) return;
      if (state.accounts.some((account) => account.serverId === connection.id)) continue;
      const service = createService();
      service.useTokenProvider(() => connections.token(connection.id));
      await loadGoogleCalendarList(connection, service);
    }
  } catch (error) {
    console.error('Aurora: não foi possível restaurar o Google Agenda.', error);
  }
}
export function prepareGoogleCalendar() {
  if (!googleCalendar.isConfigured())
    return toast('A conexão com o Google Calendar ainda não foi configurada neste ambiente.', 'info');
  const state = ui.googleCalendar;
  state.status = 'loading-sdk';
  state.error = '';
  render();
  void googleCalendar
    .prepare()
    .then(() => {
      if (ui.googleCalendar !== state) return;
      state.status = 'ready';
      render();
    })
    .catch((error) => {
      if (ui.googleCalendar !== state) return;
      state.status = 'error';
      state.error =
        error instanceof Error ? error.message : 'Não foi possível preparar a conexão com o Google Calendar.';
      render();
    });
}
export function authorizeGoogleCalendar() {
  const state = ui.googleCalendar;
  const requestId = ++state.requestId;
  let authorization;
  const persistent = googleCalendar.persistent();
  try {
    authorization = persistent ? googleCalendarPendingService.authorizeCode() : googleCalendar.authorize();
  } catch (error) {
    ui.googleCalendar.status = 'error';
    ui.googleCalendar.error =
      error instanceof Error ? error.message : 'Não foi possível iniciar a autorização do Google Calendar.';
    render();
    return;
  }
  state.status = 'authorizing';
  state.error = '';
  render();
  void authorization
    .then(async (code) => {
      if (ui.googleCalendar !== state || state.requestId !== requestId) return;
      if (!persistent) return loadGoogleCalendarList();
      state.status = 'loading-calendars';
      render();
      const service = googleCalendarPendingService;
      const connections = await googleCalendar.connections();
      const result = await connections.connect(code);
      if (ui.googleCalendar !== state || state.requestId !== requestId) return;
      service.useTokenProvider(() => connections.token(result.account.id), result);
      return loadGoogleCalendarList(result.account);
    })
    .catch((error) => {
      if (ui.googleCalendar !== state || state.requestId !== requestId) return;
      state.status = googleCalendar.isPrepared() ? 'ready' : 'error';
      state.error = error instanceof Error ? error.message : 'Não foi possível autorizar a leitura do Google Calendar.';
      render();
    });
}
export function toggleGoogleCalendar(accountId, calendarId) {
  const account = ui.googleCalendar.accounts.find((item) => item.id === accountId);
  if (!account?.service.isConnected() || !account.calendars.some((calendar) => calendar.id === calendarId)) return;
  account.selectedIds = account.selectedIds.includes(calendarId)
    ? account.selectedIds.filter((id) => id !== calendarId)
    : [...account.selectedIds, calendarId];
  if (account.serverId) {
    void googleCalendar
      .connections()
      .then((connections) => connections.select(account.serverId, account.selectedIds))
      .catch(() => toast('Não foi possível guardar a seleção de calendários. Ela vale apenas até recarregar.', 'info'));
  }
  void loadGoogleCalendarEvents([account.id]);
}
export function disconnectGoogleCalendar(accountId) {
  const index = ui.googleCalendar.accounts.findIndex((account) => account.id === accountId);
  if (index < 0) return;
  const [account] = ui.googleCalendar.accounts.splice(index, 1);
  account.service.clear();
  ui.googleCalendar.requestId += 1;
  render();
  void loadGoogleCalendarEvents();
  if (account.serverId) {
    void googleCalendar
      .connections()
      .then((connections) => connections.disconnect(account.serverId))
      .then(() => toast('A conta Google foi desconectada e o acesso foi revogado.', 'success'))
      .catch(() =>
        toast(
          'Removemos a conta aqui, mas não foi possível revogar o acesso. Remova o Aurora nas permissões da sua Conta Google.',
          'warning',
        ),
      );
    return;
  }
  toast('A conta foi desconectada desta aba.', 'success');
}
