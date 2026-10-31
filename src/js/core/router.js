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
  return ['', 'landing', 'landing-main'].includes(value);
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
