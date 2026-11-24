import { createClient } from 'npm:@supabase/supabase-js@2';
import { parseAllowedOrigins } from '../delete-account/allowed-origins.js';

const corsHeaders = (origin) => ({
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '600',
  Vary: 'Origin',
});

function jsonResponse(body, status, origin) {
  const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
  if (origin) Object.assign(headers, corsHeaders(origin));
  return new Response(JSON.stringify(body), { status, headers });
}

async function hashRequestKey(ip, pepper) {
  const bytes = new TextEncoder().encode(`${pepper}:${ip}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (request) => {
  const requestOrigin = request.headers.get('Origin') || '';
  const allowedOrigins = parseAllowedOrigins(Deno.env.get('ALLOWED_ORIGINS'));
  if (!requestOrigin || !allowedOrigins.includes(requestOrigin)) {
    return jsonResponse({ error: 'origin-not-allowed' }, 403);
  }
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(requestOrigin) });
  }
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'method-not-allowed' }, 405, requestOrigin);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const pepper = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !pepper) {
    console.error('submit-suggestion: required Supabase secrets are not configured.');
    return jsonResponse({ error: 'service-unavailable' }, 503, requestOrigin);
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: 'invalid-request' }, 400, requestOrigin);
  }
  const message = typeof payload?.message === 'string' ? payload.message.trim() : '';
  if (message.length < 10 || message.length > 2000) {
    return jsonResponse({ error: 'invalid-suggestion' }, 400, requestOrigin);
  }

  const forwardedFor = request.headers.get('x-forwarded-for') || '';
  const sourceIp = forwardedFor.split(',').map((value) => value.trim()).filter(Boolean).at(-1);
  if (!sourceIp || sourceIp.length > 64 || !/^[0-9a-fA-F:.]+$/.test(sourceIp)) {
    return jsonResponse({ error: 'request-ip-unavailable' }, 503, requestOrigin);
  }

  const requestHash = await hashRequestKey(sourceIp, pepper);
  const client = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.rpc('submit_public_suggestion', {
    p_message: message,
    p_request_hash: requestHash,
  });
  if (error) {
    const limited = error.message === 'suggestion_rate_limited';
    if (!limited) console.error('submit-suggestion: database rejected a suggestion.', error.code);
    return jsonResponse(
      { error: limited ? 'rate-limited' : 'submission-failed' },
      limited ? 429 : 503,
      requestOrigin,
    );
  }
  if (data?.accepted !== true) {
    console.error('submit-suggestion: database returned an unexpected response.');
    return jsonResponse({ error: 'submission-failed' }, 503, requestOrigin);
  }
  return jsonResponse({ accepted: true }, 200, requestOrigin);
});
