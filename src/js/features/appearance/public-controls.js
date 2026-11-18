import { LOOK_DEFAULT, paletteColors } from './palettes.js';
import { iconSvg } from '../../utils/icons.js';
import { syncNativeAppearance } from '../../services/native-experience.js';
import { APP_URL, login as loginUrl, signup as signupUrl } from '../landing/links.js';

const publicLook = { ...LOOK_DEFAULT };
let accessibilityOpen = false;
let systemThemeQuery = null;

const icon = iconSvg;
const brandLogo = new URL('../../../../icons/favicon.svg', import.meta.url).href;
const themeLabels = { auto: 'automático', light: 'claro', dark: 'escuro' };
const nextTheme = { auto: 'light', light: 'dark', dark: 'auto' };
const themeAction = (mode) => `Alternar para tema ${themeLabels[nextTheme[mode]]}`;
const themeTooltip = (mode) => `Tema atual: ${themeLabels[mode]}. ${themeAction(mode)}`;
function setAccessibilityOpen(open) {
  accessibilityOpen = open;
}

export function renderPublicHeader({ demo = false, authMode = '' } = {}) {
  const isLanding = !demo && !authMode;
  const sectionHref = (id) => isLanding ? `#${id}` : `/#${id}`;
  const publicNav = demo ? '' : `
    <nav class="public-header-nav" aria-label="Navegação principal">
      <a href="${sectionHref('areas')}">O que dá para organizar</a>
      <a href="${sectionHref('steps')}">Como começar</a>
      <a href="${sectionHref('faq')}">Perguntas</a>
    </nav>`;
  const accountAction = (mode, label) => {
    const isCurrentMode = authMode === mode;
    const action = authMode ? `data-account-mode="${mode}"` : `data-public-action="${mode}"`;
    const current = isCurrentMode ? 'aria-current="page" disabled' : '';
    const variant = mode === 'signup' ? 'primary' : '';
    const accessibleLabel = mode === 'signup' ? 'Criar conta grátis' : 'Entrar';
    if (!authMode) {
      const href = isLanding
        ? (mode === 'signup' ? signupUrl : loginUrl)
        : (mode === 'signup' ? '/criar-conta' : '/entrar');
      return `<a class="btn ${variant} public-account-action" href="${href}" data-public-action="${mode}" aria-label="${accessibleLabel}">${label}</a>`;
    }
    return `<button type="button" class="btn ${variant} public-account-action ${isCurrentMode ? 'is-current' : ''}" ${action} aria-label="${accessibleLabel}" ${current}>${label}</button>`;
  };
  const accountSignupLabel = 'Criar conta<span class="landing-header-free"> grátis</span>';
  return `
    <header class="topbar public-topbar ${authMode ? 'account-public-header' : ''}">
      <a class="brand public-brand-link" href="${isLanding ? `${APP_URL}/` : './'}" data-public-action="landing" aria-label="aurora., página inicial"><img class="public-brand-icon" src="${brandLogo}" alt="" aria-hidden="true" width="36" height="36"><span class="wordmark">aurora<span>.</span></span></a>
      ${publicNav}
      <span class="header-actions public-header-actions">
        ${accountAction('login', 'Entrar')}
        ${accountAction('signup', accountSignupLabel)}
        <span class="public-header-tools" role="group" aria-label="Preferências da página">
          <button type="button" class="iconbtn theme-trigger" data-public-control="theme-cycle" aria-label="${themeAction(publicLook.mode)}" title="${themeTooltip(publicLook.mode)}">${icon(publicLook.mode === 'auto' ? 'monitor' : publicLook.mode === 'dark' ? 'moon' : 'sun', 20)}</button>
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
  window.auroraManifestTheme?.setMode(publicLook.mode);
  root.setAttribute('data-density', publicLook.density);
  root.setAttribute('data-fs', publicLook.font);
  root.setAttribute('data-contrast', publicLook.contrast ? 'high' : 'normal');
  root.setAttribute('data-readable', String(publicLook.readable));
  root.setAttribute('data-links', publicLook.highlightLinks ? 'highlight' : 'normal');
  root.setAttribute('data-motion', publicLook.reduceMotion ? 'reduce' : 'normal');
  const themeColor = getComputedStyle(root).getPropertyValue('--bg').trim();
  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => { meta.content = themeColor; });
  syncNativeAppearance(effectiveMode);
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
      motion: publicLook.reduceMotion,
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
    theme.setAttribute('aria-label', themeAction(publicLook.mode));
    theme.title = themeTooltip(publicLook.mode);
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
  setAccessibilityOpen(false);
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

export function handlePublicKeydown(event) {
  if (event.key !== 'Escape' || !accessibilityOpen) return false;
  event.preventDefault();
  setAccessibilityOpen(false);
  syncPublicControls();
  document.getElementById('public-accessibility-trigger')?.focus({ preventScroll: true });
  return true;
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
      setAccessibilityOpen(!accessibilityOpen);
      syncPublicControls();
      if (accessibilityOpen) document.getElementById('public-accessibility-trigger')?.focus({ preventScroll: true });
      return true;
    case 'accessibility-close':
      setAccessibilityOpen(false);
      syncPublicControls();
      document.getElementById('public-accessibility-trigger')?.focus({ preventScroll: true });
      return true;
    case 'theme-cycle':
      publicLook.mode = nextTheme[publicLook.mode];
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
    case 'motion':
      publicLook.reduceMotion = !publicLook.reduceMotion;
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
