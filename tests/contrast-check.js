// Confere o contraste (WCAG AA, 4.5:1 para texto) dos pares de tokens em cada paleta, tema e modo de alto contraste.
// Rode em http://localhost:8765/tests/contrast-check.html — usa o CSS real, sem dependências.
import { PALETTES } from '../src/js/features/appearance/palettes.js';

const probe = document.getElementById('probe');
const root = document.documentElement;
// O navegador pode devolver color(srgb …) para color-mix; o canvas normaliza tudo para RGBA de 8 bits.
const canvas = document.createElement('canvas');
canvas.width = canvas.height = 1;
const context = canvas.getContext('2d', { willReadFrequently: true });
const toRgb = (token) => {
  probe.style.color = `var(${token})`;
  const value = getComputedStyle(probe).color;
  context.clearRect(0, 0, 1, 1);
  context.fillStyle = '#000';
  context.fillStyle = value;
  context.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
  return { r, g, b, a: a / 255 };
};
const lum = ({ r, g, b }) => {
  const [x, y, z] = [r, g, b].map((v) => { const c = v / 255; return c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; });
  return .2126 * x + .7152 * y + .0722 * z;
};
// Cores com transparência são compostas sobre o fundo antes de medir.
const over = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 });
const ratio = (fg, bg) => { const f = over(fg, bg), a = lum(f), b = lum(bg); return (Math.max(a, b) + .05) / (Math.min(a, b) + .05); };

// [texto, fundo, mínimo, descrição]
const PAIRS = [
  ['--ink', '--bg', 4.5, 'texto sobre o fundo'],
  ['--ink', '--surface', 4.5, 'texto sobre cartões'],
  ['--muted', '--surface', 4.5, 'texto secundário sobre cartões'],
  ['--muted', '--bg', 4.5, 'texto secundário sobre o fundo'],
  ['--accent', '--surface', 4.5, 'destaque sobre cartões'],
  ['--ok', '--ok-soft', 4.5, 'selo de sucesso'],
  ['--warn', '--warn-soft', 4.5, 'selo de aviso'],
  ['--bad', '--bad-soft', 4.5, 'selo de erro'],
  ['--on-btn', '--btn', 4.5, 'texto do botão primário'],
  ['--focus', '--surface', 3, 'anel de foco sobre cartões'],
  ['--focus', '--bg', 3, 'anel de foco sobre o fundo'],
];

const results = [];
const failures = [];
const modes = [['light', 'normal'], ['dark', 'normal'], ['light', 'high'], ['dark', 'high']];
for (const [paletteKey, [, p, pd]] of Object.entries(PALETTES)) {
  root.style.setProperty('--p', p);
  root.style.setProperty('--pd', pd);
  root.setAttribute('data-palette', paletteKey);
  for (const [theme, contrast] of modes) {
    root.setAttribute('data-theme', theme);
    root.setAttribute('data-contrast', contrast);
    const bg = toRgb('--bg');
    for (const [fgToken, bgToken, min, label] of PAIRS) {
      let background;
      try { background = toRgb(bgToken); } catch { continue; }
      if (background.a < 1) background = over(background, bg);
      const value = ratio(toRgb(fgToken), background);
      if (value < min) failures.push(`${paletteKey} · ${theme}/${contrast} · ${label}: ${value.toFixed(2)} (mín. ${min})`);
    }
  }
}
const total = Object.keys(PALETTES).length * modes.length * PAIRS.length;
results.push({ passed: !failures.length, name: `${total} combinações de paleta, tema e contraste atendem ao mínimo`, detail: failures.slice(0, 12).join(' | ') });

const list = document.getElementById('results');
results.forEach(({ passed, name, detail }) => {
  const li = document.createElement('li');
  li.textContent = `${passed ? 'OK' : 'FALHA'} — ${name}${detail ? ` — ${detail}` : ''}`;
  list.append(li);
});
document.getElementById('status').textContent = failures.length ? `${failures.length} combinações abaixo do mínimo` : 'Todas as combinações passaram';
window.__contrastFailures = failures;
