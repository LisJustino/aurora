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

const MAX_BODY_BYTES = 8192;

async function hashRequestKey(ip, pepper) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(pepper),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(`suggestion:${ip}`));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function extractClientIp(headers) {
  const forwarded = (headers.get('x-forwarded-for') || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const candidates = [
    headers.get('cf-connecting-ip'),
    headers.get('x-real-ip'),
    forwarded.at(-1),
  ];
  for (const raw of candidates) {
    const ip = String(raw || '').trim();
    if (ip && ip.length <= 64 && /^[0-9a-fA-F:.]+$/.test(ip)) return ip;
  }
  return '';
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
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const pepper = Deno.env.get('SUGGESTION_RATE_LIMIT_SECRET') || serviceRoleKey;
  if (!supabaseUrl || !serviceRoleKey || !pepper) {
    console.error('submit-suggestion: required Supabase secrets are not configured.');
    return jsonResponse({ error: 'service-unavailable' }, 503, requestOrigin);
  }

  const contentLength = Number(request.headers.get('content-length') || '0');
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return jsonResponse({ error: 'payload-too-large' }, 413, requestOrigin);
  }

  let payload;
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).length > MAX_BODY_BYTES) {
      return jsonResponse({ error: 'payload-too-large' }, 413, requestOrigin);
    }
    payload = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ error: 'invalid-request' }, 400, requestOrigin);
  }
  const message = typeof payload?.message === 'string' ? payload.message.trim() : '';
  if (message.length < 10 || message.length > 2000) {
    return jsonResponse({ error: 'invalid-suggestion' }, 400, requestOrigin);
  }

  const sourceIp = extractClientIp(request.headers);
  if (!sourceIp) {
    return jsonResponse({ error: 'request-ip-unavailable' }, 503, requestOrigin);
  }

  const requestHash = await hashRequestKey(sourceIp, pepper);
  const client = createClient(supabaseUrl, serviceRoleKey, {
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
