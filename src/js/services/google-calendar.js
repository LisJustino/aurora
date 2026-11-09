export const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';

const GOOGLE_IDENTITY_SCRIPT = 'https://accounts.google.com/gsi/client';
const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isCalendarDay(value) {
  if (typeof value !== 'string' || !DAY_PATTERN.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function localDay(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function normalizeEvent(event, calendarId) {
  if (!event || typeof event !== 'object' || event.status === 'cancelled') return null;
  const start = event.start;
  if (!start || typeof start !== 'object') return null;

  const allDay = typeof start.date === 'string';
  const date = allDay ? start.date : '';
  const instant = allDay ? NaN : Date.parse(start.dateTime);
  const day = allDay ? date : Number.isFinite(instant) ? localDay(new Date(instant)) : '';
  if (!isCalendarDay(day)) return null;

  return {
    calendarId,
    title: typeof event.summary === 'string' && event.summary.trim()
      ? event.summary.trim().slice(0, 200)
      : 'Sem título',
    day,
    allDay,
    time: allDay
      ? 'Dia inteiro'
      : new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(instant)),
    order: allDay ? new Date(`${day}T00:00:00`).getTime() : instant,
  };
}

async function loadGoogleIdentity() {
  if (globalThis.google?.accounts?.oauth2) return globalThis.google;
  if (typeof document === 'undefined') throw new Error('Não foi possível carregar a conexão com o Google neste ambiente.');

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GOOGLE_IDENTITY_SCRIPT;
    script.async = true;
    script.defer = true;
    script.referrerPolicy = 'no-referrer';
    script.onload = () => {
      if (globalThis.google?.accounts?.oauth2) resolve(globalThis.google);
      else reject(new Error('O Google não disponibilizou a autorização de calendário. Tente novamente.'));
    };
    script.onerror = () => reject(new Error('Não foi possível carregar a autorização do Google. Verifique a conexão e tente novamente.'));
    document.head.append(script);
  });
}

function requireCalendarClientId(clientId) {
  if (typeof clientId !== 'string' || !clientId.trim()) {
    throw new Error('A conexão com o Google Calendar ainda não foi configurada neste ambiente.');
  }
}

export function createGoogleCalendarService({
  clientId = import.meta.env?.VITE_GOOGLE_CALENDAR_CLIENT_ID || '',
  fetchImpl = globalThis.fetch,
  loadIdentity = loadGoogleIdentity,
  now = () => Date.now(),
} = {}) {
  let identity;
  let identityPromise;
  let accessToken = '';
  let accessTokenExpiresAt = 0;

  const clearAccess = () => {
    accessToken = '';
    accessTokenExpiresAt = 0;
  };

  const getAccessToken = () => {
    if (!accessToken || accessTokenExpiresAt <= now()) {
      clearAccess();
      throw new Error('A autorização do Google Calendar expirou. Conecte novamente para continuar.');
    }
    return accessToken;
  };

  const request = async (url) => {
    const token = getAccessToken();
    let response;
    try {
      response = await fetchImpl(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        cache: 'no-store',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
      });
    } catch {
      throw new Error('Não foi possível acessar o Google Calendar. Verifique sua conexão e tente novamente.');
    }

    if (response.status === 401) {
      clearAccess();
      throw new Error('A autorização do Google Calendar expirou ou foi revogada. Conecte novamente.');
    }
    if (response.status === 403) throw new Error('O Google não autorizou a leitura deste calendário.');
    if (response.status === 429) throw new Error('O Google Calendar recebeu muitas solicitações. Aguarde e tente novamente.');
    if (!response.ok) throw new Error('O Google Calendar está indisponível. Tente novamente.');

    let result;
    try {
      result = await response.json();
    } catch {
      throw new Error('O Google Calendar retornou uma resposta inválida.');
    }
    if (!result || typeof result !== 'object' || Array.isArray(result)) {
      throw new Error('O Google Calendar retornou uma resposta inválida.');
    }
    return result;
  };

  const pagedItems = async (url) => {
    const items = [];
    let pageToken = '';
    const seenTokens = new Set();
    do {
      const pageUrl = new URL(url);
      if (pageToken) pageUrl.searchParams.set('pageToken', pageToken);
      const page = await request(pageUrl.href);
      if (Array.isArray(page.items)) items.push(...page.items);
      pageToken = typeof page.nextPageToken === 'string' ? page.nextPageToken : '';
      if (pageToken && seenTokens.has(pageToken)) {
        throw new Error('O Google Calendar retornou páginas repetidas. Tente atualizar novamente.');
      }
      if (pageToken) seenTokens.add(pageToken);
    } while (pageToken);
    return items;
  };

  return {
    isConfigured() {
      return typeof clientId === 'string' && clientId.trim().length > 0;
    },
    isConnected() {
      return Boolean(accessToken && accessTokenExpiresAt > now());
    },
    isPrepared() {
      return Boolean(identity?.accounts?.oauth2);
    },
    async prepare() {
      requireCalendarClientId(clientId);
      if (!identityPromise) {
        identityPromise = Promise.resolve()
          .then(() => loadIdentity())
          .then((loadedIdentity) => {
            if (!loadedIdentity?.accounts?.oauth2) {
              throw new Error('O Google não disponibilizou a autorização de calendário. Tente novamente.');
            }
            identity = loadedIdentity;
          })
          .catch((error) => {
            identityPromise = null;
            throw error;
          });
      }
      await identityPromise;
    },
    authorize({ prompt = 'select_account' } = {}) {
      requireCalendarClientId(clientId);
      if (!identity?.accounts?.oauth2) throw new Error('Prepare a conexão com o Google antes de autorizar.');

      return new Promise((resolve, reject) => {
        let settled = false;
        const fail = (message) => {
          if (settled) return;
          settled = true;
          clearAccess();
          reject(new Error(message));
        };
        try {
          const tokenClient = identity.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope: GOOGLE_CALENDAR_SCOPE,
            prompt,
            callback: (response) => {
              if (response?.error) {
                fail(response.error === 'access_denied'
                  ? 'A autorização do Google Calendar foi cancelada.'
                  : 'Não foi possível autorizar a leitura do Google Calendar.');
                return;
              }
              const scopes = typeof response?.scope === 'string' ? response.scope.split(/\s+/) : [];
              const expiresIn = Number(response?.expires_in);
              if (typeof response?.access_token !== 'string'
                || !response.access_token
                || !scopes.includes(GOOGLE_CALENDAR_SCOPE)
                || !Number.isFinite(expiresIn)
                || expiresIn <= 0) {
                fail('O Google não confirmou a permissão necessária para ler os calendários.');
                return;
              }
              settled = true;
              accessToken = response.access_token;
              accessTokenExpiresAt = now() + expiresIn * 1000;
              resolve();
            },
            error_callback: () => fail('A janela de autorização do Google não pôde ser aberta. Tente novamente.'),
          });
          tokenClient.requestAccessToken();
        } catch {
          fail('Não foi possível iniciar a autorização do Google Calendar. Tente novamente.');
        }
      });
    },
    async getCalendars() {
      const items = await pagedItems(`${GOOGLE_CALENDAR_API}/users/me/calendarList?maxResults=250`);
      return items
        .filter((calendar) => calendar && typeof calendar.id === 'string' && calendar.id
          && ['owner', 'writer', 'reader'].includes(calendar.accessRole))
        .map((calendar) => ({
          id: calendar.id,
          name: typeof calendar.summary === 'string' && calendar.summary.trim()
            ? calendar.summary.trim().slice(0, 120)
            : 'Sem nome',
          primary: calendar.primary === true,
          selected: calendar.selected === true,
        }));
    },
    async getEvents(calendarIds, { start, end } = {}) {
      if (!Array.isArray(calendarIds) || !calendarIds.every((id) => typeof id === 'string' && id)) {
        throw new Error('Selecione calendários válidos para atualizar os eventos.');
      }
      if (!(start instanceof Date) || !(end instanceof Date)
        || !Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())
        || end <= start) {
        throw new Error('O período selecionado para o calendário é inválido.');
      }

      const events = [];
      for (const calendarId of new Set(calendarIds)) {
        const url = new URL(`${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`);
        url.searchParams.set('singleEvents', 'true');
        url.searchParams.set('orderBy', 'startTime');
        url.searchParams.set('maxResults', '2500');
        url.searchParams.set('timeMin', start.toISOString());
        url.searchParams.set('timeMax', end.toISOString());
        const items = await pagedItems(url.href);
        items.forEach((event) => {
          const normalized = normalizeEvent(event, calendarId);
          if (normalized) events.push(normalized);
        });
      }
      return events.sort((left, right) => left.order - right.order || left.title.localeCompare(right.title, 'pt-BR'));
    },
    clear() {
      clearAccess();
    },
  };
}
