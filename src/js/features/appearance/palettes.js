/* Paletas de cor e cálculo de contraste do tema. Funções puras, sem acesso a estado ou DOM. */
export const PALETTES = {
  rose: ['Rosé', '#c8a19e', '#78504c'], coral: ['Coral', '#e07a5f', '#b5432a'], crimson: ['Carmim', '#d6455d', '#a8213a'], plum: ['Ameixa', '#a24f9e', '#7c2f78'],
  lavender: ['Lavanda', '#9a86b2', '#75618e'], indigo: ['Índigo', '#6a67d8', '#4a46b8'], ocean: ['Oceano', '#3b6fd1', '#274da6'], sky: ['Céu', '#4f9be0', '#1f68b3'],
  teal: ['Turquesa', '#2fa3b0', '#12707c'], mint: ['Menta', '#4fb59a', '#1f7a63'], sage: ['Sálvia', '#829a89', '#5f7967'], amber: ['Âmbar', '#d99a2b', '#8a5a00'],
  earth: ['Terra', '#ad8c76', '#795b47'], graphite: ['Grafite', '#7b8794', '#46505b']
};
export const LOOK_DEFAULT = { mode: 'auto', custom: '#7c6cf0', density: 'comfy', font: 'm', contrast: false, readable: false, highlightLinks: false, reduceMotion: false, weekStart: 1, start: 'inicio' };
export const hexOk = (v) => /^#[0-9a-f]{6}$/i.test(String(v));
export function lum(hex) { const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; }
export function darkenFor(hex) { let c = hex; for (let i = 0; i < 40 && 1.05 / (lum(c) + .05) < 5; i++) { const n = [1, 3, 5].map((j) => Math.round(parseInt(c.slice(j, j + 2), 16) * .93).toString(16).padStart(2, '0')); c = '#' + n.join(''); } return c; }
export function paletteColors(t, look) { if (t === 'custom') { const p = hexOk(look.custom) ? look.custom : LOOK_DEFAULT.custom; return [p, darkenFor(p)]; } const x = PALETTES[t] || PALETTES.rose; return [x[1], x[2]]; }
