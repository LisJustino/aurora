import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || '';
const isSafeSupabaseConfig = () => {
  if (!supabaseUrl || !supabaseAnonKey || /service[_-]?role/i.test(supabaseAnonKey)) return false;
  try {
    const url = new URL(supabaseUrl);
    return url.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(url.hostname);
  } catch {
    return false;
  }
};

let client;

export function getSupabaseClient() {
  if (!isSafeSupabaseConfig()) {
    throw new Error('Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY com os valores públicos do projeto.');
  }
  if (!client) {
    client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
        persistSession: true,
        storage: window.sessionStorage,
      },
    });
  }
  return client;
}

export function hasSupabaseConfig() {
  return isSafeSupabaseConfig();
}
