import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  parseAllowedOrigins,
  removeRemotePushSubscriptions,
} from './push-cleanup.js';

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
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'method-not-allowed' }, 405, requestOrigin || undefined);
  }

  const authorization = request.headers.get('Authorization') || '';
  const tokenMatch = /^Bearer ([^\s]+)$/.exec(authorization);
  if (!tokenMatch) return jsonResponse({ error: 'unauthorized' }, 401, requestOrigin || undefined);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error('delete-account: required Supabase secrets are not configured.');
    return jsonResponse({ error: 'service-unavailable' }, 503, requestOrigin || undefined);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser(tokenMatch[1]);
  if (userError || !userData.user) {
    return jsonResponse({ error: 'unauthorized' }, 401, requestOrigin || undefined);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const pushSubscriptions = [];
  const pageSize = 100;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await adminClient
      .from('push_subscriptions')
      .select('worker_client_id,worker_capability')
      .eq('user_id', userData.user.id)
      .range(offset, offset + pageSize - 1);
    if (error) {
      console.error('delete-account: Push credentials could not be loaded.');
      return jsonResponse({ error: 'account-deletion-unavailable' }, 503, requestOrigin || undefined);
    }
    pushSubscriptions.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }

  try {
    await removeRemotePushSubscriptions(pushSubscriptions, {
      apiUrl: Deno.env.get('POMODORO_PUSH_API_URL'),
      origin: requestOrigin && allowedOrigins.includes(requestOrigin) ? requestOrigin : '',
    });
  } catch (error) {
    console.error('delete-account: remote Push cleanup was not confirmed.', error);
    return jsonResponse({ error: 'push-cleanup-unavailable' }, 503, requestOrigin || undefined);
  }

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(userData.user.id);
  if (deleteError) {
    console.error('delete-account: Supabase did not confirm account deletion.');
    return jsonResponse({ error: 'account-deletion-unavailable' }, 503, requestOrigin || undefined);
  }

  return jsonResponse({ deleted: true }, 200, requestOrigin || undefined);
});
