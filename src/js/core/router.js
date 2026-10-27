export function resolveRoute(value, availableRoutes) {
  const hash = String(value || '');
  const [routeValue, queryString = ''] = hash.split('?');
  const legacyStudies = routeValue === 'estudos';
  const legacyProfile = routeValue === 'perfil';
  const legacyGym = routeValue === 'academia';
  const legacyWater = routeValue === 'agua';
  const route = legacyStudies ? 'planejar' : legacyWater ? 'habitos' : routeValue === 'pessoal' || legacyGym ? 'inicio' : legacyProfile ? 'config' : routeValue;
  return {
    route: availableRoutes.has(route) ? route : 'inicio',
    focusActive: legacyStudies,
    scrollTarget: legacyWater ? 'agua' : null,
    replaceHash: value === 'pessoal' || legacyGym ? 'inicio' : legacyProfile ? 'config' : null,
    query: queryString,
  };
}
