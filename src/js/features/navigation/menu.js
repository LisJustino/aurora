export const MENU_ITEMS = [
  { id: 'inicio', label: 'Início', icon: 'home', area: null },
  { id: 'planejar', label: 'Planejar', icon: 'calendarCheck', area: null },
  { id: 'pomodoro', label: 'Pomodoro', icon: 'clock', area: 'pomodoro' },
  { id: 'financas', label: 'Finanças', icon: 'wallet', area: 'finances' },
  { id: 'estudos', label: 'Estudos', icon: 'book', area: 'studies' },
  { id: 'agua', label: 'Água', icon: 'droplet', area: 'water' },
  { id: 'ciclo', label: 'Ciclo', icon: 'heart', area: 'cycle' },
  { id: 'habitos', label: 'Hábitos', icon: 'check', area: 'habits' },
];

export const HIDDEN_MENU_IDS = ['agua'];
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
  const order = ['inicio'];
  if (Array.isArray(value)) {
    for (const id of value) {
      if (menuIds.has(id) && id !== 'inicio' && !order.includes(id)) order.push(id);
    }
  }
  for (const id of DEFAULT_MENU_ORDER) {
    if (id !== 'inicio' && !order.includes(id)) order.push(id);
  }
  return order;
}

export function isValidMenuOrder(value) {
  return Array.isArray(value)
    && value.length === MENU_ITEMS.length
    && value.every((id) => menuIds.has(id))
    && new Set(value).size === MENU_ITEMS.length;
}

export function normalizeVisibleMenuItems(value) {
  if (!Array.isArray(value)) return [...OPTIONAL_MENU_IDS];
  const visible = new Set(value.filter((id) => OPTIONAL_MENU_IDS.includes(id)));
  return OPTIONAL_MENU_IDS.filter((id) => visible.has(id));
}

export function isValidVisibleMenuItems(value) {
  return Array.isArray(value)
    && value.every((id) => OPTIONAL_MENU_IDS.includes(id))
    && new Set(value).size === value.length;
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
  if (!menuIds.has(id) || hidden.has(id) || id === 'inicio' || ![-1, 1].includes(direction)) return normalized;
  const from = normalized.indexOf(id);
  let to = from + direction;
  while (to > 0 && to < normalized.length && hidden.has(normalized[to])) to += direction;
  if (to <= 0 || to >= normalized.length) return normalized;
  [normalized[from], normalized[to]] = [normalized[to], normalized[from]];
  return normalized;
}
