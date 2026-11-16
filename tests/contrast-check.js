// Confere o contraste (WCAG AA, 4.5:1 para texto) dos pares de tokens em cada paleta, tema e modo de alto contraste.
// Rode em http://localhost:8765/tests/contrast-check.html — usa o CSS real, sem dependências.
import { PALETTES } from '../src/js/features/appearance/palettes.js';

const probe = document.getElementById('probe');
probe.classList.add('main');
probe.dataset.route = 'contrast-check';
probe.style.display = 'none';
const root = document.documentElement;
// O navegador pode devolver color(srgb …) para color-mix; o canvas normaliza tudo para RGBA de 8 bits.
const canvas = document.createElement('canvas');
canvas.width = canvas.height = 1;
const context = canvas.getContext('2d', { willReadFrequently: true });
const colorToRgb = (value) => {
  context.clearRect(0, 0, 1, 1);
  context.fillStyle = '#000';
  context.fillStyle = value;
  context.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
  return { r, g, b, a: a / 255 };
};
const toRgb = (token) => {
  probe.style.color = `var(${token})`;
  return colorToRgb(getComputedStyle(probe).color);
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
  ['--ink', '--surface-strong', 4.5, 'texto sobre superfícies principais'],
  ['--muted', '--surface-strong', 4.5, 'texto secundário sobre superfícies principais'],
  ['--accent', '--surface-strong', 4.5, 'destaque sobre superfícies principais'],
  ['--muted', '--bg', 4.5, 'texto secundário sobre o fundo'],
  ['--ink', '--hero', 4.5, 'texto sobre destaque neutro'],
  ['--muted', '--hero', 4.5, 'texto secundário sobre destaque neutro'],
  ['--on-hero-home', '--hero-home', 4.5, 'texto sobre saudação'],
  ['--muted', '--hero-home', 4.5, 'texto secundário sobre saudação'],
  ['--accent', '--hero-home', 4.5, 'destaque sobre saudação'],
  ['--ink', '--brand-surface', 4.5, 'texto sobre saudação colorida'],
  ['--muted', '--brand-surface', 4.5, 'texto secundário sobre saudação colorida'],
  ['--accent', '--brand-surface', 4.5, 'destaque sobre saudação colorida'],
  ['--ink', '--brand-surface-strong', 4.5, 'texto sobre chamada pública'],
  ['--muted', '--brand-surface-strong', 4.5, 'texto secundário sobre chamada pública'],
  ['--accent', '--area-heading-surface', 4.5, 'destaque sobre cabeçalho de área'],
  ['--muted', '--area-heading-surface', 4.5, 'texto secundário sobre cabeçalho de área'],
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
const areaRoutes = ['planejar', 'habitos', 'agua', 'financas', 'ciclo'];
const areaBackgrounds = [
  ['--surface', 4.5, 'texto e chip'],
  ['--surface-strong', 4.5, 'menu'],
  ['--area-heading-surface', 4.5, 'título'],
  ['--surface-soft', 3, 'anel de progresso'],
  ['--area-track', 3, 'trilha de progresso'],
  ['--surface', 3, 'ícone e borda'],
];
const fixture = document.createElement('div');
fixture.hidden = true;
fixture.innerHTML = '<header class="topbar"><nav class="nav"><a class="nav-item" aria-current="page"><span class="ni"></span><span class="tab-period">.</span></a></nav></header><main class="main"><header class="page-title"><span class="page-title-eyebrow">Área</span><h1>Título<i>.</i></h1></header><button class="chip" aria-pressed="true">Filtro</button><div class="bar"><span></span></div><div class="annual-plan-progress-ring"></div><div class="cycle-day-ring" style="--cycle-progress:50%"></div><section class="water-tracker"><progress></progress></section><section class="empty empty-state"><span class="eic empty-state-icon" aria-hidden="true"></span><div class="empty-copy"><h3 class="empty-state-title">Nada por aqui.</h3><p class="empty-state-description">Uma frase de apoio para esta área.</p></div><div class="empty-action"><button type="button" class="btn primary">Começar</button></div></section></main><div class="dlg-back"><button class="chip" aria-pressed="true">Filtro</button></div>';
document.body.append(fixture);
const navItem = fixture.querySelector('.nav-item');
const main = fixture.querySelector('.main');
const dialog = fixture.querySelector('.dlg-back');
const sameColor = (a, b) => ['r', 'g', 'b', 'a'].every((key) => a[key] === b[key]);
for (const [paletteKey, [, p, pd]] of Object.entries(PALETTES)) {
  root.style.setProperty('--p', p);
  root.style.setProperty('--pd', pd);
  root.setAttribute('data-palette', paletteKey);
  for (const [theme, contrast] of modes) {
    root.setAttribute('data-theme', theme);
    root.setAttribute('data-contrast', contrast);
    probe.dataset.route = 'contrast-check';
    const bg = toRgb('--bg');
    for (const [fgToken, bgToken, min, label] of PAIRS) {
      let background;
      try { background = toRgb(bgToken); } catch { continue; }
      if (background.a < 1) background = over(background, bg);
      const value = ratio(toRgb(fgToken), background);
      if (value < min) failures.push(`${paletteKey} · ${theme}/${contrast} · ${label}: ${value.toFixed(2)} (mín. ${min})`);
    }
    for (const route of areaRoutes) {
      probe.dataset.route = route;
      navItem.dataset.route = route;
      main.dataset.route = route;
      dialog.dataset.route = route;
      probe.style.setProperty('--area-track', 'color-mix(in srgb, var(--area) 13%, var(--surface))');
      const areaColor = toRgb('--area');
      const emptyState = main.querySelector('.empty-state');
      const emptyTitle = emptyState.querySelector('.empty-state-title');
      const emptyDescription = emptyState.querySelector('.empty-state-description');
      const emptyIcon = emptyState.querySelector('.empty-state-icon');
      const emptyButton = emptyState.querySelector('.empty-action > .btn');
      const emptyStyle = getComputedStyle(emptyState);
      const emptyBackground = colorToRgb(emptyStyle.backgroundColor);
      const descriptionStyle = getComputedStyle(emptyDescription);
      probe.style.backgroundColor = 'var(--soft)';
      probe.style.borderTopColor = 'var(--line-strong)';
      probe.style.borderRadius = 'var(--r-card)';
      const emptyIconStyle = getComputedStyle(emptyIcon);
      if (emptyStyle.borderStyle !== 'dashed'
        || !sameColor(colorToRgb(emptyStyle.borderTopColor), colorToRgb(getComputedStyle(probe).borderTopColor))
        || !sameColor(emptyBackground, colorToRgb(getComputedStyle(probe).backgroundColor))
        || Number.parseFloat(emptyStyle.borderRadius) !== Number.parseFloat(getComputedStyle(probe).borderRadius)
        || emptyIconStyle.width !== '48px'
        || emptyIconStyle.height !== '48px') {
        failures.push(`${paletteKey} · ${theme}/${contrast} · ${route} · estrutura do estado vazio incompatível`);
      }
      if (ratio(colorToRgb(getComputedStyle(emptyTitle).color), emptyBackground) < 4.5) {
        failures.push(`${paletteKey} · ${theme}/${contrast} · ${route} · título do estado vazio: contraste abaixo de 4.5`);
      }
      if (ratio(colorToRgb(descriptionStyle.color), emptyBackground) < 4.5) {
        failures.push(`${paletteKey} · ${theme}/${contrast} · ${route} · apoio do estado vazio: contraste abaixo de 4.5`);
      }
      if (Number.parseFloat(descriptionStyle.fontSize) < 12) {
        failures.push(`${paletteKey} · ${theme}/${contrast} · ${route} · apoio do estado vazio: abaixo de 12 px`);
      }
      const iconBackground = colorToRgb(getComputedStyle(emptyIcon).backgroundColor);
      if (ratio(colorToRgb(getComputedStyle(emptyIcon).color), iconBackground) < 3) {
        failures.push(`${paletteKey} · ${theme}/${contrast} · ${route} · ícone do estado vazio: contraste abaixo de 3`);
      }
      const emptyButtonStyle = getComputedStyle(emptyButton);
      if (ratio(colorToRgb(emptyButtonStyle.color), colorToRgb(emptyButtonStyle.backgroundColor)) < 4.5) {
        failures.push(`${paletteKey} · ${theme}/${contrast} · ${route} · botão do estado vazio: contraste abaixo de 4.5`);
      }
      for (const [backgroundToken, min, label] of areaBackgrounds) {
        const value = ratio(areaColor, toRgb(backgroundToken));
        if (value < min) failures.push(`${paletteKey} · ${theme}/${contrast} · ${route} · ${label}: ${value.toFixed(2)} (mín. ${min})`);
      }
      for (const [element, property, label] of [
        [navItem, 'color', 'menu'],
        [navItem.querySelector('.ni'), 'color', 'ícone do menu'],
        [navItem.querySelector('.tab-period'), 'color', 'ponto do menu'],
        [main.querySelector('.page-title-eyebrow'), 'color', 'kicker'],
        [main.querySelector('h1 i'), 'color', 'ponto do título'],
        [main.querySelector('.chip'), 'color', 'chip'],
        [main.querySelector('.chip'), 'borderTopColor', 'borda do chip'],
        [dialog.querySelector('.chip'), 'color', 'chip do diálogo'],
        [dialog.querySelector('.chip'), 'borderTopColor', 'borda do chip do diálogo'],
        [main.querySelector('.bar > span'), 'backgroundColor', 'progresso'],
      ]) {
        if (!sameColor(colorToRgb(getComputedStyle(element)[property]), areaColor)) {
          failures.push(`${paletteKey} · ${theme}/${contrast} · ${route} · ${label}: cor incorreta`);
        }
      }
      for (const [element, label] of [[navItem, 'menu'], [navItem.querySelector('.ni'), 'ícone do menu'], [main.querySelector('.chip'), 'chip']]) {
        const style = getComputedStyle(element);
        const value = ratio(colorToRgb(style.color), colorToRgb(style.backgroundColor));
        if (value < 4.5) failures.push(`${paletteKey} · ${theme}/${contrast} · ${route} · ${label}: ${value.toFixed(2)} (mín. 4.5)`);
      }
      if (route === 'planejar' || route === 'ciclo') {
        probe.style.color = 'var(--area)';
        const ring = main.querySelector(route === 'planejar' ? '.annual-plan-progress-ring' : '.cycle-day-ring');
        if (!getComputedStyle(ring).backgroundImage.includes(getComputedStyle(probe).color)) {
          failures.push(`${paletteKey} · ${theme}/${contrast} · ${route} · anel: cor incorreta`);
        }
      }
      if (route === 'habitos' && !sameColor(colorToRgb(getComputedStyle(main.querySelector('.water-tracker progress')).accentColor), toRgb('--area-water'))) {
        failures.push(`${paletteKey} · ${theme}/${contrast} · água · progresso: cor incorreta`);
      }
    }
  }
}
const total = Object.keys(PALETTES).length * modes.length * (PAIRS.length + areaRoutes.length * areaBackgrounds.length);
results.push({ passed: !failures.length, name: `${total} combinações de paleta, tema e contraste atendem ao mínimo`, detail: failures.slice(0, 12).join(' | ') });

const list = document.getElementById('results');
results.forEach(({ passed, name, detail }) => {
  const li = document.createElement('li');
  li.textContent = `${passed ? 'OK' : 'FALHA'} — ${name}${detail ? ` — ${detail}` : ''}`;
  list.append(li);
});
document.getElementById('status').textContent = failures.length ? `${failures.length} combinações abaixo do mínimo` : 'Todas as combinações passaram';
window.__contrastFailures = failures;
