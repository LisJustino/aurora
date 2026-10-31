import { LOOK_DEFAULT, paletteColors } from './palettes.js';
import { IC } from '../../utils/icons.js';

const publicLook = { ...LOOK_DEFAULT };
let accessibilityOpen = false;
let systemThemeQuery = null;

const icon = (name, size = 18) => `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${IC[name] || ''}</svg>`;
const brandLogo = new URL('../../../../icons/favicon.svg', import.meta.url).href;
const button = (label, action, pressed, description) => `
  <button type="button" class="accessibility-option" data-public-control="${action}" aria-pressed="${String(pressed)}">
    <span class="accessibility-option-copy"><b>${label}</b><small>${description}</small></span>
    <span class="accessibility-state" aria-hidden="true">${pressed ? 'Ativado' : 'Desativado'}</span>
  </button>`;

function accessibilityPanel() {
  const fontIndex = ['s', 'm', 'l'].indexOf(publicLook.font);
  return `
    <section class="accessibility-panel public-accessibility-panel" id="public-accessibility-panel" aria-labelledby="public-accessibility-title" ${accessibilityOpen ? '' : 'hidden'}>
      <header class="accessibility-head">
        <div><h2 id="public-accessibility-title">Tema e acessibilidade</h2><p>Preferências temporárias, só nesta visita.</p></div>
        <button type="button" class="ibtn dlg-close" data-public-control="accessibility-close" aria-label="Fechar tema e acessibilidade">${icon('close', 18)}</button>
      </header>
      <div class="accessibility-font" role="group" aria-label="Tamanho do texto">
        <span class="accessibility-group-label">Tamanho do texto</span>
        <div class="accessibility-font-controls">
          <button type="button" class="btn sm" data-public-control="font" data-step="-1" aria-label="Diminuir tamanho do texto" ${fontIndex <= 0 ? 'disabled' : ''}>A−</button>
          <button type="button" class="btn sm" data-public-control="font-reset" aria-label="Restaurar tamanho padrão do texto" ${publicLook.font === 'm' ? 'disabled' : ''}>Padrão</button>
          <button type="button" class="btn sm" data-public-control="font" data-step="1" aria-label="Aumentar tamanho do texto" ${fontIndex >= 2 ? 'disabled' : ''}>A+</button>
        </div>
      </div>
      <div class="accessibility-font" role="group" aria-label="Tema">
        <span class="accessibility-group-label">Tema</span>
        <div class="seg" role="group" aria-label="Escolha o tema">
          ${[['auto', 'Automático', 'monitor'], ['light', 'Claro', 'sun'], ['dark', 'Escuro', 'moon']].map(([value, label, iconName]) => `<button type="button" data-public-control="mode" data-value="${value}" aria-pressed="${String(publicLook.mode === value)}">${icon(iconName, 16)}<span>${label}</span></button>`).join('')}
        </div>
      </div>
      <div class="accessibility-options">
        ${button('Alto contraste', 'contrast', publicLook.contrast, 'Reforça textos, bordas e foco.')}
        ${button('Legibilidade aprimorada', 'readable', publicLook.readable, 'Usa fonte simples e aumenta o espaçamento entre linhas.')}
        ${button('Destacar links', 'links', publicLook.highlightLinks, 'Sublinha os links para identificá-los com mais facilidade.')}
        ${button('Espaçamento confortável', 'spacing', publicLook.density === 'comfy', 'Aumenta o respiro e as áreas para toque.')}
      </div>
      <button type="button" class="btn accessibility-reset" data-public-control="reset">Restaurar configurações visuais</button>
    </section>`;
}

export function renderPublicHeader({ demo = false, authMode = '' } = {}) {
  const isLanding = !demo && !authMode;
  const themeName = { auto: 'automático', light: 'claro', dark: 'escuro' }[publicLook.mode];
  const accountAction = (mode, label) => {
    const isCurrentMode = authMode === mode;
    const action = authMode ? `data-account-mode="${mode}"` : `data-public-action="${mode}"`;
    const current = isCurrentMode ? 'aria-current="page" disabled' : '';
    const variant = isLanding && mode === 'signup' ? 'primary' : '';
    const accessibleLabel = mode === 'signup' ? 'Criar conta' : 'Entrar na conta';
    return `<button type="button" class="btn ${variant} public-account-action ${isCurrentMode ? 'is-current' : ''}" ${action} aria-label="${accessibleLabel}" ${current}>${label}</button>`;
  };
  const nav = demo ? `
    <nav class="nav demo-nav" aria-label="Navegação da demonstração">
      <a aria-current="page" aria-disabled="true" tabindex="-1"><span class="ni">${icon('home', 20)}</span><span>Início</span></a>
      <a aria-disabled="true" tabindex="-1"><span class="ni">${icon('calendarCheck', 20)}</span><span>Planejar</span></a>
      <a aria-disabled="true" tabindex="-1"><span class="ni">${icon('clock', 20)}</span><span>Foco</span></a>
      <a aria-disabled="true" tabindex="-1"><span class="ni">${icon('check', 20)}</span><span>Hábitos</span></a>
    </nav>` : '';

  return `
    <header class="topbar public-topbar ${authMode ? 'account-public-header' : ''}">
      <a class="brand public-brand-link" href="./" ${authMode ? 'data-account-mode="landing"' : 'data-public-action="landing"'} aria-label="aurora., página inicial"><img class="public-brand-icon" src="${brandLogo}" alt="" aria-hidden="true" width="36" height="36"><span class="wordmark">aurora<span>.</span></span></a>
      ${nav}
      <span class="header-actions public-header-actions">
        ${accountAction('login', 'entrar')}
        ${accountAction('signup', 'criar conta')}
        <span class="public-header-tools" role="group" aria-label="Preferências da página">
          <button type="button" class="iconbtn theme-trigger" data-public-control="theme-cycle" aria-label="Alternar tema: ${themeName}" title="Alternar tema">${icon(publicLook.mode === 'auto' ? 'monitor' : publicLook.mode === 'dark' ? 'moon' : 'sun', 20)}</button>
          <span class="accessibility-control">
            <button type="button" id="public-accessibility-trigger" class="iconbtn" data-public-control="accessibility-toggle" aria-label="Abrir tema e acessibilidade" aria-expanded="${String(accessibilityOpen)}" aria-haspopup="true" aria-controls="public-accessibility-panel" title="Tema e acessibilidade">${icon('accessibility', 20)}</button>
            ${accessibilityPanel()}
          </span>
          ${isLanding ? '' : `<button type="button" class="iconbtn" data-public-control="refresh" aria-label="Atualizar a aplicação" title="Atualizar a aplicação">${icon('refresh', 20)}</button>`}
        </span>
      </span>
    </header>`;
}

function applyPublicLook() {
  const root = document.documentElement;
  const [primary, accent] = paletteColors('rose', publicLook);
  const effectiveMode = publicLook.mode === 'auto'
    ? (systemThemeQuery?.matches ? 'dark' : 'light')
    : publicLook.mode;
  root.style.setProperty('--p', primary);
  root.style.setProperty('--pd', accent);
  root.setAttribute('data-palette', 'rose');
  root.setAttribute('data-theme', effectiveMode);
  root.setAttribute('data-density', publicLook.density);
  root.setAttribute('data-fs', publicLook.font);
  root.setAttribute('data-contrast', publicLook.contrast ? 'high' : 'normal');
  root.setAttribute('data-readable', String(publicLook.readable));
  root.setAttribute('data-links', publicLook.highlightLinks ? 'highlight' : 'normal');
  root.setAttribute('data-motion', publicLook.reduceMotion ? 'reduce' : 'normal');
  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) themeColor.content = getComputedStyle(root).getPropertyValue('--bg').trim();
  syncPublicControls();
}

function syncPublicControls() {
  const trigger = document.getElementById('public-accessibility-trigger');
  const panel = document.getElementById('public-accessibility-panel');
  if (trigger) trigger.setAttribute('aria-expanded', String(accessibilityOpen));
  if (panel) {
    panel.hidden = !accessibilityOpen;
    panel.querySelectorAll('[data-public-control="mode"]').forEach((item) => {
      item.setAttribute('aria-pressed', String(item.dataset.value === publicLook.mode));
    });
    const pressed = {
      contrast: publicLook.contrast,
      readable: publicLook.readable,
      links: publicLook.highlightLinks,
      spacing: publicLook.density === 'comfy',
    };
    Object.entries(pressed).forEach(([key, value]) => {
      const item = panel.querySelector(`[data-public-control="${key}"]`);
      if (!item) return;
      item.setAttribute('aria-pressed', String(value));
      const state = item.querySelector('.accessibility-state');
      if (state) state.textContent = value ? 'Ativado' : 'Desativado';
    });
    const fontIndex = ['s', 'm', 'l'].indexOf(publicLook.font);
    panel.querySelector('[data-step="-1"]').disabled = fontIndex <= 0;
    panel.querySelector('[data-step="1"]').disabled = fontIndex >= 2;
    panel.querySelector('[data-public-control="font-reset"]').disabled = publicLook.font === 'm';
  }
  const theme = document.querySelector('.public-header-actions [data-public-control="theme-cycle"]');
  if (theme) {
    const labels = { auto: 'automático', light: 'claro', dark: 'escuro' };
    theme.setAttribute('aria-label', `Tema ${labels[publicLook.mode]}`);
    theme.title = `Tema: ${labels[publicLook.mode]}`;
    theme.innerHTML = icon(publicLook.mode === 'auto' ? 'monitor' : publicLook.mode === 'dark' ? 'moon' : 'sun', 20);
  }
}

export function initializePublicAppearance() {
  publicLook.mode = LOOK_DEFAULT.mode;
  publicLook.density = LOOK_DEFAULT.density;
  publicLook.font = LOOK_DEFAULT.font;
  publicLook.contrast = LOOK_DEFAULT.contrast;
  publicLook.readable = LOOK_DEFAULT.readable;
  publicLook.highlightLinks = LOOK_DEFAULT.highlightLinks;
  publicLook.reduceMotion = LOOK_DEFAULT.reduceMotion;
  accessibilityOpen = false;
  if (!systemThemeQuery && typeof window.matchMedia === 'function') {
    systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const updateSystemTheme = () => {
      if (publicLook.mode === 'auto') applyPublicLook();
    };
    if (systemThemeQuery.addEventListener) systemThemeQuery.addEventListener('change', updateSystemTheme);
    else systemThemeQuery.addListener(updateSystemTheme);
  }
  applyPublicLook();
}

export function handlePublicControl(event, root) {
  const control = event.target instanceof Element
    ? event.target.closest('[data-public-control]')
    : null;
  if (!control || control.disabled) return false;
  event.preventDefault();

  switch (control.dataset.publicControl) {
    case 'refresh':
      window.location.reload();
      return true;
    case 'accessibility-toggle':
      accessibilityOpen = !accessibilityOpen;
      syncPublicControls();
      if (accessibilityOpen) document.getElementById('public-accessibility-trigger')?.focus();
      return true;
    case 'accessibility-close':
      accessibilityOpen = false;
      syncPublicControls();
      document.getElementById('public-accessibility-trigger')?.focus();
      return true;
    case 'theme-cycle':
      publicLook.mode = { auto: 'light', light: 'dark', dark: 'auto' }[publicLook.mode];
      break;
    case 'mode':
      if (!['auto', 'light', 'dark'].includes(control.dataset.value)) return true;
      publicLook.mode = control.dataset.value;
      break;
    case 'font':
      publicLook.font = ['s', 'm', 'l'][Math.max(0, Math.min(2, ['s', 'm', 'l'].indexOf(publicLook.font) + Number(control.dataset.step)))];
      break;
    case 'font-reset':
      publicLook.font = 'm';
      break;
    case 'contrast':
      publicLook.contrast = !publicLook.contrast;
      break;
    case 'readable':
      publicLook.readable = !publicLook.readable;
      break;
    case 'links':
      publicLook.highlightLinks = !publicLook.highlightLinks;
      break;
    case 'spacing':
      publicLook.density = publicLook.density === 'comfy' ? 'compact' : 'comfy';
      break;
    case 'reset':
      Object.assign(publicLook, LOOK_DEFAULT);
      break;
    default:
      return false;
  }
  applyPublicLook();
  const active = event.target instanceof Element ? event.target.closest('[data-public-control]') : null;
  if (active?.isConnected) active.focus();
  return true;
}
