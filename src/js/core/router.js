export function resolveRoute(value, availableRoutes) {
  const hash = String(value || '');
  const [routeValue, queryString = ''] = hash.split('?');
  const legacyProfile = routeValue === 'perfil';
  const legacyGym = routeValue === 'academia';
  const legacyWater = routeValue === 'agua';
  const route = legacyWater ? 'habitos' : routeValue === 'pessoal' || legacyGym ? 'inicio' : legacyProfile ? 'config' : routeValue;
  return {
    route: availableRoutes.has(route) ? route : 'inicio',
    replaceHash: legacyWater ? 'habitos' : value === 'pessoal' || legacyGym ? 'inicio' : legacyProfile ? 'config' : null,
    query: queryString,
  };
}

export function isPublicLandingHash(hash) {
  const value = String(hash || '').replace(/^#/, '').split('?')[0];
  return ['', 'landing', 'landing-main', 'demonstracao'].includes(value);
}

export function accountModeFromHash(hash) {
  const [route, queryString = ''] = String(hash || '').replace(/^#/, '').split('?');
  const params = new URLSearchParams(queryString);
  if (route === 'entrar') return 'login';
  if (route === 'criar-conta') return params.get('etapa') === 'acesso' ? 'signup-access' : 'signup-profile';
  if (route === 'esqueci-senha') return 'recovery';
  if (route === 'nova-senha') return 'update-password';
  return null;
}

export function accountHashForMode(mode) {
  if (mode === 'login') return '#entrar';
  if (mode === 'signup' || mode === 'signup-profile' || mode === 'oauth-profile') return '#criar-conta';
  if (mode === 'signup-access') return '#criar-conta?etapa=acesso';
  if (mode === 'recovery') return '#esqueci-senha';
  if (mode === 'update-password') return '#nova-senha';
  if (mode === 'landing') return '#demonstracao';
  return null;
}

export function isPublicAccountHash(hash) {
  return accountModeFromHash(hash) !== null;
}

export function postSignOutPath(locationLike) {
  const url = new URL(locationLike.href);
  url.pathname = '/';
  url.search = '';
  url.hash = '';
  return url.pathname;
}

export function settingsRootPath(locationLike) {
  const url = new URL(locationLike.href);
  if (!url.hash.startsWith('#config?')) return null;
  url.hash = 'config';
  return `${url.pathname}${url.search}${url.hash}`;
}

export function redirectToPublicLanding(locationLike) {
  locationLike.replace(postSignOutPath(locationLike));
}
