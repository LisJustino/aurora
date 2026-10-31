import { createClient } from '@supabase/supabase-js';

const PROJECT_REFS = {
  development: 'cltymialatksylhzsitz',
  production: 'xeneztudcqdumfhwotry',
};

export function resolveSupabaseConfig({
  isDevelopment,
  targetEnvironment,
  localUrl,
  localAnonKey,
  previewUrl,
  previewAnonKey,
  productionUrl,
  productionAnonKey,
}) {
  let environment;
  let url;
  let anonKey;
  if (isDevelopment) {
    environment = 'development';
    url = localUrl;
    anonKey = localAnonKey;
  } else if (targetEnvironment === 'development') {
    environment = 'development';
    url = previewUrl;
    anonKey = previewAnonKey;
  } else if (targetEnvironment === 'production') {
    environment = 'production';
    url = productionUrl;
    anonKey = productionAnonKey;
  } else {
    return { url: '', anonKey: '' };
  }

  try {
    const expectedHost = `${PROJECT_REFS[environment]}.supabase.co`;
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== 'https:' || parsedUrl.hostname !== expectedHost) {
      return { url: '', anonKey: '' };
    }
  } catch {
    return { url: '', anonKey: '' };
  }
  return { url: url || '', anonKey: anonKey || '' };
}

const isDevelopment = import.meta.env?.DEV === true;
const { url: supabaseUrl, anonKey: supabaseAnonKey } = resolveSupabaseConfig({
  isDevelopment,
  targetEnvironment: isDevelopment ? '' : import.meta.env?.VITE_SUPABASE_TARGET,
  localUrl: isDevelopment ? import.meta.env?.VITE_SUPABASE_LOCAL_URL : '',
  localAnonKey: isDevelopment ? import.meta.env?.VITE_SUPABASE_LOCAL_ANON_KEY : '',
  previewUrl: isDevelopment || import.meta.env?.VITE_SUPABASE_TARGET !== 'development'
    ? ''
    : import.meta.env?.VITE_SUPABASE_PREVIEW_URL,
  previewAnonKey: isDevelopment || import.meta.env?.VITE_SUPABASE_TARGET !== 'development'
    ? ''
    : import.meta.env?.VITE_SUPABASE_PREVIEW_ANON_KEY,
  productionUrl: isDevelopment ? '' : import.meta.env?.VITE_SUPABASE_PRODUCTION_URL,
  productionAnonKey: isDevelopment ? '' : import.meta.env?.VITE_SUPABASE_PRODUCTION_ANON_KEY,
});
const supabaseEnvironment = isDevelopment ? 'development' : import.meta.env?.VITE_SUPABASE_TARGET;
const isSafeSupabaseConfig = () => {
  if (!supabaseUrl || !supabaseAnonKey || /service[_-]?role/i.test(supabaseAnonKey)) return false;
  try {
    const url = new URL(supabaseUrl);
    return url.protocol === 'https:'
      && url.hostname === `${PROJECT_REFS[supabaseEnvironment]}.supabase.co`;
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
    const variables = isDevelopment
      ? 'VITE_SUPABASE_LOCAL_URL e VITE_SUPABASE_LOCAL_ANON_KEY do projeto aurora-dev'
      : supabaseEnvironment === 'development'
        ? 'VITE_SUPABASE_TARGET=development, VITE_SUPABASE_PREVIEW_URL e VITE_SUPABASE_PREVIEW_ANON_KEY do projeto aurora-dev'
        : supabaseEnvironment === 'production'
          ? 'VITE_SUPABASE_TARGET=production, VITE_SUPABASE_PRODUCTION_URL e VITE_SUPABASE_PRODUCTION_ANON_KEY do projeto aurora-prod'
          : 'VITE_SUPABASE_TARGET como development ou production';
    throw new Error(`Configuração Supabase inválida. Configure ${variables}. O Aurora bloqueia qualquer projeto diferente do ambiente esperado.`);
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
