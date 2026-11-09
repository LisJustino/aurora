import { PALETTES } from '../appearance/palettes.js';

export const HOME_BLOCKS = [
  ['today', 'Plano de hoje', 'Tarefas pendentes, atrasadas e concluídas.'],
  ['habits', 'Hábitos de hoje', 'Check-ins e acompanhamento da rotina.'],
  ['summary', 'Resumo do dia', 'Tarefas de hoje, atrasadas, sem data e dados das áreas ativas.'],
  ['quick', 'Adicionar tarefa', 'Campo rápido para registrar o próximo passo.'],
];

export const HOME_SHORTCUTS = [
  { id: 'task', label: 'Nova tarefa', icon: 'calendarCheck', description: 'Criar uma tarefa para hoje.', action: 'quick-action-task' },
  { id: 'habit', label: 'Novo hábito', icon: 'check', description: 'Adicionar um hábito à rotina.', action: 'quick-action-habit', area: 'habits' },
  { id: 'finance', label: 'Finanças', icon: 'wallet', description: 'Criar uma conta ou lançamento.', action: 'quick-action-finance', area: 'finances' },
];

export const HOME_MODES = Object.freeze({
  overview: Object.freeze({
    label: 'Visão geral',
    description: 'Todos os blocos e atalhos disponíveis.',
    layout: Object.freeze({ order: HOME_BLOCKS.map(([id]) => id), visible: HOME_BLOCKS.map(([id]) => id) }),
    shortcuts: HOME_SHORTCUTS.map(({ id }) => id),
  }),
  focus: Object.freeze({
    label: 'Essencial',
    description: 'Tarefa rápida e plano do dia.',
    layout: Object.freeze({ order: ['quick', 'today', 'summary', 'habits'], visible: ['quick', 'today'] }),
    shortcuts: ['task'],
  }),
  routine: Object.freeze({
    label: 'Rotina',
    description: 'Hábitos, plano do dia e atalhos do cotidiano.',
    layout: Object.freeze({ order: ['habits', 'today', 'summary', 'quick'], visible: ['habits', 'today', 'summary'] }),
    shortcuts: ['task', 'habit', 'finance'],
  }),
});

export const HOME_AREA_COLORS = Object.freeze([
  Object.freeze({ id: 'planning', label: 'Planejar', css: 'planning' }),
  Object.freeze({ id: 'habits', label: 'Hábitos', css: 'habits' }),
  Object.freeze({ id: 'finances', label: 'Finanças', css: 'finances' }),
  Object.freeze({ id: 'cycle', label: 'Ciclo', css: 'cycle' }),
  Object.freeze({ id: 'water', label: 'Água', css: 'water' }),
]);

export const HOME_MESSAGE_MAX_LENGTH = 120;
export const HOME_BLOCK_IDS = HOME_BLOCKS.map(([id]) => id);
export const HOME_SHORTCUT_IDS = HOME_SHORTCUTS.map(({ id }) => id);
export const HOME_AREA_COLOR_IDS = HOME_AREA_COLORS.map(({ id }) => id);

export function defaultHomeLayout() {
  return { order: [...HOME_BLOCK_IDS], visible: [...HOME_BLOCK_IDS] };
}

export function normalizeHomeLayout(value) {
  const layout = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const order = Array.isArray(layout.order) ? layout.order.filter((id) => HOME_BLOCK_IDS.includes(id)) : [];
  const visible = Array.isArray(layout.visible) ? layout.visible.filter((id) => HOME_BLOCK_IDS.includes(id)) : HOME_BLOCK_IDS;
  return {
    order: ['today', ...new Set(order.filter((id) => id !== 'today')), ...HOME_BLOCK_IDS.filter((id) => !order.includes(id) && id !== 'today')],
    visible: [...new Set(visible)],
  };
}

export function defaultHomeShortcuts() {
  return [...HOME_SHORTCUT_IDS];
}

export function normalizeHomeShortcuts(value) {
  if (!Array.isArray(value)) return defaultHomeShortcuts();
  return [...new Set(value.filter((id) => HOME_SHORTCUT_IDS.includes(id)))];
}

export function defaultHomeModes() {
  return Object.fromEntries(Object.entries(HOME_MODES).map(([id, mode]) => [id, {
    layout: normalizeHomeLayout(mode.layout),
    shortcuts: normalizeHomeShortcuts(mode.shortcuts),
  }]));
}

export function normalizeHomeModes(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const defaults = defaultHomeModes();
  return Object.fromEntries(Object.entries(HOME_MODES).map(([id]) => {
    const saved = source[id] && typeof source[id] === 'object' && !Array.isArray(source[id]) ? source[id] : {};
    return [id, {
      layout: normalizeHomeLayout(saved.layout ?? defaults[id].layout),
      shortcuts: normalizeHomeShortcuts(saved.shortcuts ?? defaults[id].shortcuts),
    }];
  }));
}

export function normalizeHomeMode(value) {
  return Object.hasOwn(HOME_MODES, value) ? value : 'overview';
}

export function normalizeHomeMessage(value) {
  return typeof value === 'string' ? value.trim().slice(0, HOME_MESSAGE_MAX_LENGTH) : '';
}

export function normalizeHomeAreaColors(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return Object.fromEntries(Object.entries(source)
    .filter(([id, color]) => HOME_AREA_COLOR_IDS.includes(id) && Object.hasOwn(PALETTES, color)));
}

function luminance(hex) {
  const channels = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255)
    .map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(foreground, background) {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

export function homeAreaColorValue(paletteId, mode) {
  const palette = PALETTES[paletteId];
  if (!palette) return '';
  if (mode !== 'dark') return palette[2];

  const background = '#17151b';
  const color = palette[1];
  if (contrastRatio(color, background) >= 4.5) return color;

  const rgb = [1, 3, 5].map((index) => parseInt(color.slice(index, index + 2), 16));
  for (let amount = 0.08; amount <= 1; amount += 0.04) {
    const candidate = `#${rgb.map((channel) => Math.round(channel + (255 - channel) * amount)
      .toString(16).padStart(2, '0')).join('')}`;
    if (contrastRatio(candidate, background) >= 4.5) return candidate;
  }
  return '#ffffff';
}
