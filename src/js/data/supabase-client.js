import { createClient } from '@supabase/supabase-js';

export function resolveSupabaseConfig({
  isDevelopment,
  localUrl,
  localAnonKey,
  productionUrl,
  productionAnonKey,
}) {
  return isDevelopment
    ? { url: localUrl || '', anonKey: localAnonKey || '' }
    : { url: productionUrl || '', anonKey: productionAnonKey || '' };
}

const isDevelopment = import.meta.env?.DEV === true;
const { url: supabaseUrl, anonKey: supabaseAnonKey } = resolveSupabaseConfig({
  isDevelopment,
  localUrl: isDevelopment ? import.meta.env?.VITE_SUPABASE_LOCAL_URL : '',
  localAnonKey: isDevelopment ? import.meta.env?.VITE_SUPABASE_LOCAL_ANON_KEY : '',
  productionUrl: isDevelopment ? '' : import.meta.env?.VITE_SUPABASE_PRODUCTION_URL,
  productionAnonKey: isDevelopment ? '' : import.meta.env?.VITE_SUPABASE_PRODUCTION_ANON_KEY,
});
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
let rememberSession = false;

export function setRememberSession(enabled) {
  rememberSession = enabled === true;
}

export function createAuthSessionStorage({ localStorage, sessionStorage }) {
  return {
    async getItem(key) {
      const persistentSession = localStorage.getItem(key);
      if (persistentSession !== null) {
        rememberSession = true;
        return persistentSession;
      }
      return sessionStorage.getItem(key);
    },
    async setItem(key, value) {
      const preferredStorage = rememberSession ? localStorage : sessionStorage;
      const otherStorage = rememberSession ? sessionStorage : localStorage;
      preferredStorage.setItem(key, value);
      otherStorage.removeItem(key);
    },
    async removeItem(key) {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    },
  };
}

export function getSupabaseClient() {
  if (!isSafeSupabaseConfig()) {
    const variables = import.meta.env?.DEV
      ? 'VITE_SUPABASE_LOCAL_URL e VITE_SUPABASE_LOCAL_ANON_KEY'
      : 'VITE_SUPABASE_PRODUCTION_URL e VITE_SUPABASE_PRODUCTION_ANON_KEY';
    throw new Error(`Configure ${variables} com os valores públicos do projeto Supabase correspondente.`);
  }
  if (!client) {
    client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
        persistSession: true,
        storage: createAuthSessionStorage({
          localStorage: window.localStorage,
          sessionStorage: window.sessionStorage,
        }),
      },
    });
  }
  return client;
}

export function hasSupabaseConfig() {
  return isSafeSupabaseConfig();
}
