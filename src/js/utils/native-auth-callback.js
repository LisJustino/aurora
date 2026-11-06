export const NATIVE_AUTH_REDIRECT_URL = 'br.com.aurora.rotinas://auth/callback';

export function parseNativeAuthCallback(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (url.protocol !== 'br.com.aurora.rotinas:'
    || url.hostname !== 'auth'
    || url.pathname !== '/callback') return null;

  const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
  const code = url.searchParams.get('code') || hash.get('code') || '';
  const error = url.searchParams.get('error') || hash.get('error') || '';
  const type = url.searchParams.get('type') || hash.get('type') || '';
  return {
    code: code.length <= 2048 ? code : '',
    error: error ? 'access_denied' : '',
    recovery: type === 'recovery',
  };
}
