const APP_ROUTES = new Set([
  'inicio', 'planejar', 'financas', 'habitos', 'ciclo', 'config',
]);
const ACCOUNT_ROUTES = new Set(['entrar', 'criar-conta', 'esqueci-senha', 'nova-senha']);

function routeParts(value) {
  const [route = '', query = ''] = String(value || '').split('?');
  return { route, query };
}

function canonicalRoute(route) {
  if (route === 'agua') return 'habitos';
  if (route === 'pessoal' || route === 'academia') return 'inicio';
  if (route === 'perfil' || route === 'ajustes') return 'config';
  return route;
}

function locationPathRoute(locationLike) {
  const url = new URL(locationLike.href);
  const parts = url.pathname.split('/').filter(Boolean);
  const last = parts[parts.length - 1] || '';
  if (!last) return '';
  return last.replace(/\.html$/i, '');
}

function locationHashRoute(locationLike) {
  const { route, query } = routeParts(String(locationLike.hash || '').replace(/^#/, ''));
  if (!route) return null;
  const isKnownRoute = APP_ROUTES.has(canonicalRoute(route))
    || route === 'agua'
    || route === 'perfil'
    || route === 'pessoal'
    || route === 'academia';
  const isPublicRoute = route === 'landing' || route === 'demonstracao';
  if (!isKnownRoute && !ACCOUNT_ROUTES.has(route) && !isPublicRoute) return null;
  return { route, query };
}

export function routePathFor(value) {
  const { route, query } = routeParts(value);
  const path = route ? `/${canonicalRoute(route)}` : '/';
  return `${path}${query ? `?${query}` : ''}`;
}

export function routeFromLocation(locationLike, availableRoutes, fallbackRoute = 'inicio') {
  const url = new URL(locationLike.href);
  const hashRoute = locationHashRoute(url);
  let routeValue = hashRoute?.route || locationPathRoute(url) || fallbackRoute;
  let query = url.search.slice(1);

  if (hashRoute) {
    const params = new URLSearchParams(query);
    new URLSearchParams(hashRoute.query).forEach((value, key) => params.set(key, value));
    query = params.toString();
  }

  const resolved = resolveRoute(routeValue, availableRoutes);
  const canonicalPath = routePathFor(`${resolved.route}${query ? `?${query}` : ''}`);
  const needsCanonicalPath = Boolean(hashRoute)
    || url.pathname !== canonicalPath.split('?')[0]
    || (!hashRoute && resolved.replaceHash);

  return {
    ...resolved,
    query,
    replacePath: needsCanonicalPath
      ? `${canonicalPath}${hashRoute ? '' : url.hash}`
      : null,
  };
}

export function canonicalPublicPath(locationLike) {
  const url = new URL(locationLike.href);
  const hashRoute = locationHashRoute(url);
  if (!hashRoute) return null;
  if (hashRoute.route === 'landing') return `/${url.search}`;
  if (hashRoute.route === 'demonstracao') return `/demonstracao${url.search}`;
  if (ACCOUNT_ROUTES.has(hashRoute.route)) {
    const params = new URLSearchParams(url.search);
    new URLSearchParams(hashRoute.query).forEach((value, key) => params.set(key, value));
    const query = params.toString();
    return `/${hashRoute.route}${query ? `?${query}` : ''}`;
  }
  const params = new URLSearchParams(url.search);
  new URLSearchParams(hashRoute.query).forEach((value, key) => params.set(key, value));
  const query = params.toString();
  return `${routePathFor(hashRoute.route)}${query ? `?${query}` : ''}`;
}

export function isDemoLocation(locationLike) {
  const url = new URL(locationLike.href);
  return locationPathRoute(url) === 'demonstracao'
    || locationHashRoute(url)?.route === 'demonstracao';
}

export function isPublicAccountLocation(locationLike) {
  const url = new URL(locationLike.href);
  const hashRoute = locationHashRoute(url);
  return accountModeForRoute(
    hashRoute?.route || locationPathRoute(url),
    hashRoute?.query || url.search.slice(1),
  ) !== null;
}

export function isPublicLandingLocation(locationLike) {
  const url = new URL(locationLike.href);
  const pathRoute = locationPathRoute(url);
  if (pathRoute === 'demonstracao') return true;
  if (pathRoute) return false;
  const hashRoute = locationHashRoute(url);
  return !hashRoute || hashRoute.route === 'landing' || hashRoute.route === 'demonstracao';
}

export function accountModeFromLocation(locationLike) {
  const url = new URL(locationLike.href);
  const hashRoute = locationHashRoute(url);
  const route = hashRoute?.route || locationPathRoute(url);
  const query = hashRoute?.query || url.search.slice(1);
  return accountModeForRoute(route, query);
}

function accountModeForRoute(route, queryString = '') {
  const params = new URLSearchParams(queryString);
  if (route === 'entrar') return 'login';
  if (route === 'criar-conta') return params.get('etapa') === 'acesso' ? 'signup-access' : 'signup-profile';
  if (route === 'esqueci-senha') return 'recovery';
  if (route === 'nova-senha') return 'update-password';
  return null;
}

export function accountPathForMode(mode) {
  if (mode === 'login') return '/entrar';
  if (mode === 'signup' || mode === 'signup-profile' || mode === 'oauth-profile') return '/criar-conta';
  if (mode === 'signup-access') return '/criar-conta?etapa=acesso';
  if (mode === 'recovery') return '/esqueci-senha';
  if (mode === 'update-password') return '/nova-senha';
  if (mode === 'landing') return '/demonstracao';
  return null;
}

export function resolveRoute(value, availableRoutes) {
  const hash = String(value || '');
  const { route: routeValue, query: queryString } = routeParts(hash);
  const legacyProfile = routeValue === 'perfil';
  const legacyGym = routeValue === 'academia';
  const legacyWater = routeValue === 'agua';
  const route = canonicalRoute(routeValue);
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
  return accountModeForRoute(route, queryString);
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
  if (canonicalRoute(locationPathRoute(url)) !== 'config'
    || (!url.searchParams.has('section') && !url.searchParams.has('weight'))) return null;
  url.pathname = '/config';
  url.searchParams.delete('section');
  url.searchParams.delete('weight');
  url.hash = '';
  return `${url.pathname}${url.search}`;
}

export function redirectToPublicLanding(locationLike) {
  locationLike.replace(postSignOutPath(locationLike));
}
