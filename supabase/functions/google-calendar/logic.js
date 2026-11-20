// Regras do Google Agenda no servidor, sem dependência do Deno para poder ser testada em Node.
import {
  decryptRefreshToken,
  encryptRefreshToken,
  revokeGoogleToken,
} from '../_shared/google-calendar-tokens.js';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';
const CALENDAR_LIST_URL = 'https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=1';
const CONNECTION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_SELECTED_CALENDARS = 50;
const COLUMNS = 'id,email,selected_calendar_ids,refresh_token_encrypted';

export class GoogleCalendarError extends Error {
  constructor(code, status) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

export function normalizeCalendarIds(value) {
  if (!Array.isArray(value)) throw new GoogleCalendarError('invalid-request', 400);
  const ids = value.filter((item) => typeof item === 'string' && item.length > 0 && item.length <= 256);
  if (ids.length !== value.length || ids.length > MAX_SELECTED_CALENDARS) {
    throw new GoogleCalendarError('invalid-request', 400);
  }
  return [...new Set(ids)];
}

function publicConnection(row) {
  return {
    id: row.id,
    email: row.email,
    selectedCalendarIds: Array.isArray(row.selected_calendar_ids) ? row.selected_calendar_ids : [],
  };
}

async function postToken(params, { clientId, clientSecret, fetchImpl }) {
  const response = await fetchImpl(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, ...params }),
  });
  const body = await response.json().catch(() => ({}));
  return { ok: response.ok, body };
}

async function verifyCalendarReadAccess(accessToken, fetchImpl) {
  let response;
  try {
    response = await fetchImpl(CALENDAR_LIST_URL, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    });
  } catch {
    throw new GoogleCalendarError('service-unavailable', 503);
  }
  if (response.status === 403) {
    const body = await response.json().catch(() => ({}));
    const reasons = Array.isArray(body?.error?.errors)
      ? body.error.errors.map((error) => error?.reason)
      : [];
    if (reasons.includes('accessNotConfigured')) {
      throw new GoogleCalendarError('calendar-api-not-enabled', 503);
    }
    throw new GoogleCalendarError('calendar-scope-missing', 403);
  }
  if (response.status === 401) throw new GoogleCalendarError('authorization-rejected', 400);
  if (!response.ok) throw new GoogleCalendarError('service-unavailable', 503);
}

async function findConnection(db, userId, id) {
  if (!CONNECTION_ID_PATTERN.test(String(id || ''))) throw new GoogleCalendarError('invalid-request', 400);
  const { data, error } = await db
    .from('google_calendar_connections')
    .select(COLUMNS)
    .eq('user_id', userId)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new GoogleCalendarError('service-unavailable', 503);
  if (!data) throw new GoogleCalendarError('not-found', 404);
  return data;
}

export async function handleGoogleCalendarAction(input, {
  db, userId, key, clientId, clientSecret, origin, fetchImpl = fetch,
}) {
  const credentials = { clientId, clientSecret, fetchImpl };
  const action = input?.action;

  if (action === 'list') {
    const { data, error } = await db
      .from('google_calendar_connections')
      .select(COLUMNS)
      .eq('user_id', userId)
      .order('created_at', { ascending: true });
    if (error) throw new GoogleCalendarError('service-unavailable', 503);
    return { accounts: (data || []).map(publicConnection) };
  }

  if (action === 'connect') {
    const code = typeof input.code === 'string' ? input.code : '';
    if (!code || code.length > 2048 || typeof origin !== 'string' || !origin) {
      throw new GoogleCalendarError('invalid-request', 400);
    }
    const exchange = await postToken({ code, grant_type: 'authorization_code', redirect_uri: origin }, credentials);
    if (!exchange.ok || !exchange.body.access_token) throw new GoogleCalendarError('authorization-rejected', 400);
    await verifyCalendarReadAccess(exchange.body.access_token, fetchImpl);
    const infoResponse = await fetchImpl(USERINFO_URL, {
      headers: { Authorization: `Bearer ${exchange.body.access_token}` },
    });
    const info = infoResponse.ok ? await infoResponse.json().catch(() => ({})) : {};
    if (!info.sub || !info.email) throw new GoogleCalendarError('authorization-rejected', 400);

    let refreshToken = exchange.body.refresh_token;
    if (!refreshToken) {
      // Google só reenvia o refresh token no primeiro consentimento; reaproveitamos o guardado.
      const { data: existing } = await db
        .from('google_calendar_connections')
        .select(COLUMNS)
        .eq('user_id', userId)
        .eq('google_subject', info.sub)
        .maybeSingle();
      if (!existing) throw new GoogleCalendarError('no-refresh-token', 400);
      refreshToken = await decryptRefreshToken(existing.refresh_token_encrypted, key, userId);
    }

    const { data, error } = await db
      .from('google_calendar_connections')
      .upsert({
        user_id: userId,
        google_subject: info.sub,
        email: info.email,
        refresh_token_encrypted: await encryptRefreshToken(refreshToken, key, userId),
      }, { onConflict: 'user_id,google_subject' })
      .select(COLUMNS)
      .single();
    if (error || !data) throw new GoogleCalendarError('service-unavailable', 503);
    return {
      account: publicConnection(data),
      accessToken: exchange.body.access_token,
      expiresIn: Number(exchange.body.expires_in) || 3600,
    };
  }

  if (action === 'token') {
    const row = await findConnection(db, userId, input.id);
    const refreshToken = await decryptRefreshToken(row.refresh_token_encrypted, key, userId).catch(() => null);
    if (!refreshToken) throw new GoogleCalendarError('service-unavailable', 503);
    const refreshed = await postToken({ refresh_token: refreshToken, grant_type: 'refresh_token' }, credentials);
    if (!refreshed.ok || !refreshed.body.access_token) {
      if (refreshed.body?.error === 'invalid_grant') {
        // O acesso foi revogado no Google ou expirou: removemos para o app pedir nova autorização.
        await db.from('google_calendar_connections').delete().eq('user_id', userId).eq('id', row.id);
        throw new GoogleCalendarError('reauthorization-required', 409);
      }
      throw new GoogleCalendarError('service-unavailable', 503);
    }
    return { accessToken: refreshed.body.access_token, expiresIn: Number(refreshed.body.expires_in) || 3600 };
  }

  if (action === 'select') {
    const row = await findConnection(db, userId, input.id);
    const calendarIds = normalizeCalendarIds(input.calendarIds);
    const { error } = await db
      .from('google_calendar_connections')
      .update({ selected_calendar_ids: calendarIds })
      .eq('user_id', userId)
      .eq('id', row.id);
    if (error) throw new GoogleCalendarError('service-unavailable', 503);
    return { selectedCalendarIds: calendarIds };
  }

  if (action === 'disconnect') {
    const row = await findConnection(db, userId, input.id);
    const refreshToken = await decryptRefreshToken(row.refresh_token_encrypted, key, userId).catch(() => null);
    if (refreshToken) await revokeGoogleToken(refreshToken, fetchImpl);
    const { error } = await db.from('google_calendar_connections').delete().eq('user_id', userId).eq('id', row.id);
    if (error) throw new GoogleCalendarError('service-unavailable', 503);
    return { disconnected: true };
  }

  throw new GoogleCalendarError('invalid-request', 400);
}
