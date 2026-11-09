export const MENU_ITEMS = [
  { id: 'inicio', label: 'Início', icon: 'home', area: null },
  { id: 'planejar', label: 'Planejar', icon: 'calendarCheck', area: null },
  { id: 'financas', label: 'Finanças', icon: 'wallet', area: 'finances' },
  { id: 'ciclo', label: 'Ciclo', icon: 'heart', area: 'cycle' },
  { id: 'habitos', label: 'Hábitos', icon: 'check', area: 'habits' },
  { id: 'agua', label: 'Água', icon: 'droplet', area: 'water' },
];

const LEGACY_MENU_ID_ALIASES = {
  habits: 'habitos',
  finances: 'financas',
  cycle: 'ciclo',
  water: 'agua',
  inicio: 'inicio',
  planejar: 'planejar',
};

const normalizeMenuId = (value) => {
  if (typeof value !== 'string') return null;
  const id = value.trim();
  return LEGACY_MENU_ID_ALIASES[id] || id;
};

export const HIDDEN_MENU_IDS = ['agua'];
export const FIXED_MENU_IDS = ['inicio', 'planejar'];
export const DEFAULT_MENU_ORDER = MENU_ITEMS.map(({ id }) => id);
export const OPTIONAL_MENU_IDS = MENU_ITEMS.filter(({ area }) => area).map(({ id }) => id);
export const DEFAULT_VISIBLE_MENU_ITEMS = [...OPTIONAL_MENU_IDS];

export function defaultMenuPreferences() {
  return {
    menuOrder: [...DEFAULT_MENU_ORDER],
    visibleMenuItems: [...DEFAULT_VISIBLE_MENU_ITEMS],
  };
}

export function isDefaultMenuPreferences(value) {
  if (!Array.isArray(value?.menuOrder) || !Array.isArray(value.visibleMenuItems)) return false;
  const defaults = defaultMenuPreferences();
  const visible = new Set(value.visibleMenuItems);
  return value.menuOrder.length === defaults.menuOrder.length
    && value.menuOrder.every((id, index) => id === defaults.menuOrder[index])
    && value.visibleMenuItems.length === defaults.visibleMenuItems.length
    && visible.size === defaults.visibleMenuItems.length
    && value.visibleMenuItems.every((id) => defaults.visibleMenuItems.includes(id));
}

const menuIds = new Set(DEFAULT_MENU_ORDER);
const menuItemsById = new Map(MENU_ITEMS.map((item) => [item.id, item]));
export function normalizeMenuOrder(value) {
  const order = [...FIXED_MENU_IDS];
  if (Array.isArray(value)) {
    for (const valueId of value) {
      const normalizedId = normalizeMenuId(valueId);
      if (normalizedId && menuIds.has(normalizedId) && !FIXED_MENU_IDS.includes(normalizedId) && !order.includes(normalizedId)) {
        order.push(normalizedId);
      }
    }
  }
  for (const id of DEFAULT_MENU_ORDER) {
    if (!FIXED_MENU_IDS.includes(id) && !order.includes(id)) order.push(id);
  }
  return order;
}

export function isValidMenuOrder(value) {
  if (!Array.isArray(value) || new Set(value).size !== value.length
    || !value.every((id) => typeof id === 'string')) return false;
  const recognizedIds = new Set(value
    .map((id) => normalizeMenuId(id))
    .filter((id) => menuIds.has(id)));
  return recognizedIds.size === MENU_ITEMS.length
    && DEFAULT_MENU_ORDER.every((id) => recognizedIds.has(id));
}

export function normalizeVisibleMenuItems(value) {
  if (!Array.isArray(value)) return [...OPTIONAL_MENU_IDS];
  const visible = new Set(value
    .map((id) => normalizeMenuId(id))
    .filter((id) => OPTIONAL_MENU_IDS.includes(id)));
  return OPTIONAL_MENU_IDS.filter((id) => visible.has(id));
}

export function isValidVisibleMenuItems(value) {
  if (!Array.isArray(value)) return false;
  const ids = value.map((id) => normalizeMenuId(id)).filter(Boolean);
  return ids.length === value.length
    && ids.every((id) => typeof id === 'string')
    && new Set(ids).size === ids.length;
}

export function orderMenuItems(order, areas, includeDisabled = false, visibleMenuItems = OPTIONAL_MENU_IDS, hiddenMenuItems = []) {
  const visible = new Set(normalizeVisibleMenuItems(visibleMenuItems));
  const hidden = new Set(hiddenMenuItems);
  return normalizeMenuOrder(order)
    .map((id) => menuItemsById.get(id))
    .filter((item) => !hidden.has(item.id) && (!item.area || (visible.has(item.id) && (includeDisabled || areas?.[item.area] === true))));
}

export function moveMenuItem(order, id, direction, hiddenMenuItems = []) {
  const normalized = normalizeMenuOrder(order);
  const hidden = new Set(hiddenMenuItems);
  const canonicalId = normalizeMenuId(id);
  if (!canonicalId || !menuIds.has(canonicalId) || hidden.has(canonicalId) || FIXED_MENU_IDS.includes(canonicalId) || ![-1, 1].includes(direction)) return normalized;
  const from = normalized.indexOf(canonicalId);
  let to = from + direction;
  while (to > 0 && to < normalized.length && hidden.has(normalized[to])) to += direction;
  if (to < FIXED_MENU_IDS.length || to >= normalized.length) return normalized;
  [normalized[from], normalized[to]] = [normalized[to], normalized[from]];
  return normalized;
}

export function canMoveMenuItem(order, id, direction, hiddenMenuItems = []) {
  const current = normalizeMenuOrder(order);
  const moved = moveMenuItem(current, id, direction, hiddenMenuItems);
  return moved.some((item, index) => item !== current[index]);
}
