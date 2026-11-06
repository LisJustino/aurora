import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { getSupabaseClient, hasSupabaseConfig } from '../data/supabase-client.js';
import { NATIVE_AUTH_REDIRECT_URL, parseNativeAuthCallback } from '../utils/native-auth-callback.js';
import { isNativeApp } from '../utils/platform.js';

let bridgePromise = null;
let handledCallback = null;

function routeForCallback({ error, recovery }) {
  if (error) return '/entrar?error=access_denied';
  return recovery ? '/nova-senha?type=recovery' : '/entrar';
}

async function handleNativeAuthCallback(value) {
  const callback = parseNativeAuthCallback(value);
  if (!callback) return;
  if (handledCallback === value) return;
  handledCallback = value;

  try {
    await Browser.close();
  } catch (error) {
    console.warn('O Aurora não conseguiu fechar a janela de autenticação do sistema.', error);
  }

  if (!callback.error) {
    if (!callback.code) {
      console.error('O retorno de autenticação nativa não trouxe um código válido.');
      history.replaceState(null, '', '/entrar?error=access_denied');
      window.location.reload();
      return;
    }

    try {
      if (!hasSupabaseConfig()) throw new Error('O projeto de contas não está configurado.');
      const client = getSupabaseClient();
      const { error } = await client.auth.exchangeCodeForSession(callback.code);
      if (error) throw error;
    } catch (error) {
      console.error('O Aurora não conseguiu concluir o retorno de autenticação nativa.', error);
      history.replaceState(null, '', '/entrar?error=access_denied');
      window.location.reload();
      return;
    }
  }

  history.replaceState(null, '', routeForCallback(callback));
  window.location.reload();
}

export function initializeNativeAuthBridge() {
  if (!isNativeApp()) return Promise.resolve(false);
  if (!bridgePromise) {
    bridgePromise = (async () => {
      await App.addListener('appUrlOpen', ({ url }) => {
        void handleNativeAuthCallback(url);
      });
      const launch = await App.getLaunchUrl();
      if (launch?.url) await handleNativeAuthCallback(launch.url);
      return true;
    })().catch((error) => {
      bridgePromise = null;
      console.error('O Aurora não conseguiu preparar o retorno seguro de autenticação nativa.', error);
      return false;
    });
  }
  return bridgePromise;
}

export async function startNativeOAuth(client, provider) {
  if (!isNativeApp()) return false;
  const { data, error } = await client.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: NATIVE_AUTH_REDIRECT_URL,
      skipBrowserRedirect: true,
    },
  });
  if (error) throw error;
  if (!data.url) throw new Error('O provedor não retornou um endereço de autenticação.');
  await Browser.open({ url: data.url, presentationStyle: 'popover' });
  return true;
}

export { NATIVE_AUTH_REDIRECT_URL };
