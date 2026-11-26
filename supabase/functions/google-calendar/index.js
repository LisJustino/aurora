import { createClient } from 'npm:@supabase/supabase-js@2';
import { GoogleCalendarError, handleGoogleCalendarAction } from './logic.js';
import { importEncryptionKey } from '../_shared/google-calendar-tokens.js';
import { parseAllowedOrigins } from '../delete-account/allowed-origins.js';

const corsHeaders = (origin) => ({
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '600',
  Vary: 'Origin',
});

const MAX_BODY_BYTES = 16384;

function jsonResponse(body, status, origin) {
  const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
  if (origin) Object.assign(headers, corsHeaders(origin));
  return new Response(JSON.stringify(body), { status, headers });
}


Deno.serve(async (request) => {
  const allowedOrigins = parseAllowedOrigins(Deno.env.get('ALLOWED_ORIGINS'));
  const requestOrigin = request.headers.get('Origin') || '';
  if (requestOrigin && !allowedOrigins.includes(requestOrigin)) {
    return jsonResponse({ error: 'origin-not-allowed' }, 403);
  }
  if (request.method === 'OPTIONS') {
    if (!requestOrigin) return jsonResponse({ error: 'origin-not-allowed' }, 403);
    return new Response(null, { status: 204, headers: corsHeaders(requestOrigin) });
  }
  const origin = requestOrigin || undefined;
  if (request.method !== 'POST') return jsonResponse({ error: 'method-not-allowed' }, 405, origin);

  const tokenMatch = /^Bearer ([^\s]+)$/.exec(request.headers.get('Authorization') || '');
  if (!tokenMatch) return jsonResponse({ error: 'unauthorized' }, 401, origin);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
  const encryptionSecret = Deno.env.get('GOOGLE_TOKEN_ENCRYPTION_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !clientId || !clientSecret || !encryptionSecret) {
    console.error('google-calendar: required secrets are not configured.');
    return jsonResponse({ error: 'service-unavailable' }, 503, origin);
  }

  let key;
  try {
    key = await importEncryptionKey(encryptionSecret);
  } catch {
    console.error('google-calendar: GOOGLE_TOKEN_ENCRYPTION_KEY is invalid.');
    return jsonResponse({ error: 'service-unavailable' }, 503, origin);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser(tokenMatch[1]);
  if (userError || !userData.user) return jsonResponse({ error: 'unauthorized' }, 401, origin);

  const contentLength = Number(request.headers.get('content-length') || '0');
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return jsonResponse({ error: 'payload-too-large' }, 413, origin);
  }

  let input;
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).length > MAX_BODY_BYTES) {
      return jsonResponse({ error: 'payload-too-large' }, 413, origin);
    }
    input = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ error: 'invalid-request' }, 400, origin);
  }

  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  try {
    const result = await handleGoogleCalendarAction(input, {
      db, userId: userData.user.id, key, clientId, clientSecret, origin: requestOrigin,
    });
    return jsonResponse(result, 200, origin);
  } catch (error) {
    if (error instanceof GoogleCalendarError) return jsonResponse({ error: error.code }, error.status, origin);
    console.error('google-calendar: unexpected failure.');
    return jsonResponse({ error: 'service-unavailable' }, 503, origin);
  }
});
