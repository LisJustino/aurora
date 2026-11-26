import { $, h, raw } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { isoDay, shortDate } from '../utils/dates.js';
import { canAccessCycle } from '../features/cycle/access.js';
import { renderSuggestionForm } from '../features/footer/view.js';
import { CONTACT_EMAIL } from '../features/footer/suggestions.js';
import { hasCurrentCycleDataConsent } from '../services/cycle-consent.js';
import {
  normalizeProfileAppearance,
  PROFILE_APPEARANCE_DEFAULT,
  PROFILE_AVATAR_COLORS,
  PROFILE_AVATARS,
} from '../features/profile/model.js';
import { openProfileAvatarData, openProfileAvatarFile } from '../features/profile/avatar-image.js';
import {
  defaultHomeModes,
  HOME_BLOCKS,
  HOME_MESSAGE_MAX_LENGTH,
  HOME_MODES,
} from '../features/home/personalization.js';
import { APPEARANCE_PRESETS, LOOK_DEFAULT, paletteColors, PALETTES } from '../features/appearance/palettes.js';
import {
  canMoveMenuItem,
  HIDDEN_MENU_IDS,
  isDefaultMenuPreferences,
  MENU_ITEMS,
  normalizeMenuOrder,
} from '../features/navigation/menu.js';
import { renderSettingsSegment as settingsSegment, renderSettingsView } from '../features/settings/view.js';
import { isTrashExpired, sortTrashEntriesByExpiry, trashDaysRemaining } from '../features/trash/model.js';
import { AREAS, plural, SEX } from './core.js';
import { viewCiclo } from './cycle.js';
import { confirmInDialog } from './dialogs.js';
import { viewFinancas } from './finance-view.js';
import { googleCalendarSettingsPanel } from './google-agenda.js';
import { viewHabits } from './habits.js';
import { viewInicio } from './home.js';
import { Persist } from './persistence.js';
import { viewPlanejar } from './planning.js';
import { accessibilityOption, render } from './render.js';
import { toast } from './samples-backup.js';
import { areaEmpty, pageTitle, profileAvatarMarkup, profileGreeting, tabLabel } from './shell.js';
import {
  accountSession,
  defaults,
  normalizeSlice,
  S,
  sameJsonValue,
  scheduleProfileAutosave,
  setS,
  settingsDraftDirty,
  settingsView,
  SLICES,
  syncState,
  ui,
} from './state.js';

// Ajustes
function activeAppearancePreset(settings) {
  return (
    Object.entries(APPEARANCE_PRESETS).find(
      ([, preset]) =>
        settings.theme === preset.theme &&
        settings.look.density === preset.density &&
        settings.look.font === preset.font,
    )?.[0] || ''
  );
}
function aparencia(s) {
  s = settingsView();
  const L = s.look;
  const currentPalette = s.theme === 'custom' ? 'Personalizada' : PALETTES[s.theme]?.[0] || PALETTES.rose[0];
  const group = (id, title, description, content) =>
    h`<section class="appearance-settings-group" aria-labelledby="${id}"><div class="appearance-settings-copy"><h3
      id="${id}">${title}</h3><p>${description}</p></div>${content}</section>`;
  const defaultAppearance =
    s.theme === 'rose' &&
    L.custom === LOOK_DEFAULT.custom &&
    L.density === LOOK_DEFAULT.density &&
    L.font === LOOK_DEFAULT.font &&
    !L.contrast &&
    !L.readable &&
    !L.highlightLinks &&
    !L.reduceMotion;
  return h`<form class="card appearance-settings" data-form="settings-save" aria-labelledby="appearance-settings-title">
    <div class="appearance-settings-heading"><div><h2
      id="appearance-settings-title">Aparência e leitura</h2><p>Ajuste o tema, as cores, o tamanho do texto, o espaçamento e o calendário. As alterações são salvas automaticamente.</p></div><button
      type="button" class="btn sm"
      data-action="appearance-reset" ${defaultAppearance ? raw('disabled') : ''}>Restaurar padrão visual</button></div>
    ${group(
      'appearance-presets-title',
      'Estilos prontos',
      'Escolha uma combinação inicial; você pode ajustar cada opção depois.',
      h`<div
      class="appearance-preset-grid" role="group"
      aria-label="Estilos prontos">${Object.entries(APPEARANCE_PRESETS).map(
        ([id, preset]) => h`<button type="button"
      class="appearance-preset" data-action="appearance-preset" data-v="${id}"
      aria-pressed="${String(activeAppearancePreset(s) === id)}"><span class="appearance-preset-swatch"
      style="--preset-color:${PALETTES[preset.theme][1]}"
      aria-hidden="true">${icon('check', 14)}</span><span><b>${preset.label}</b><small>${preset.description}</small></span></button>`,
      )}</div>`,
    )}
    ${group(
      'appearance-mode-title',
      'Tema',
      'Claro, escuro ou o mesmo do seu aparelho. O tema é salvo ao tocar.',
      h`<div class="seg" role="group" aria-label="Tema">${[
        ['auto', 'Automático', 'monitor'],
        ['light', 'Claro', 'sun'],
        ['dark', 'Escuro', 'moon'],
      ].map(
        ([value, text, ic]) =>
          h`<button type="button" id="personalization-mode-${value}" aria-pressed="${String(L.mode === value)}"
            data-action="accessibility-mode" data-v="${value}">${icon(ic, 16)}<span>${text}</span></button>`,
      )}</div>`,
    )}
    ${group(
      'appearance-color-title',
      'Cor de destaque',
      `Paleta atual: ${currentPalette}.`,
      h`<div class="swatches appearance-swatches" role="group"
        aria-label="Paletas de cor">${Object.entries(PALETTES).map(
          ([k, [n, c]]) => h`<button type="button"
        class="swatch" aria-label="Cor ${n}" aria-pressed="${String(s.theme === k)}" data-action="set-theme"
        data-v="${k}"><i style="background:${c}" aria-hidden="true"></i><span>${n}</span></button>`,
        )}
      <label class="swatch appearance-custom-color${s.theme === 'custom' ? ' is-selected' : ''}"
        title="Escolher cor personalizada">
        <i class="appearance-custom-preview"
          style="background:${s.theme === 'custom' ? paletteColors('custom', L)[0] : '#ffffff'}" aria-hidden="true"></i>
        <span>Personalizada</span>
        <input class="sr" type="color" data-change="look-custom" value="${L.custom}"
          aria-label="Escolher cor personalizada">
      </label></div>`,
    )}
    ${group(
      'appearance-reading-title',
      'Leitura e espaçamento',
      'Ajuste o tamanho do texto e a distância entre os elementos da tela.',
      h`<div class="appearance-settings-controls">
      <div class="appearance-settings-option"><span
        class="appearance-settings-label">Tamanho do texto</span>${settingsSegment(L, 'font', 'Tamanho do texto', [
          ['s', 'Pequeno', '', 'sample'],
          ['m', 'Médio', '', 'sample'],
          ['l', 'Grande', '', 'sample'],
        ])}</div>
      <div class="appearance-settings-option"><span
        class="appearance-settings-label">Espaçamento</span>${settingsSegment(L, 'density', 'Espaçamento', [
          ['comfy', 'Confortável'],
          ['compact', 'Compacto'],
        ])}</div>
    </div>`,
    )}
    ${group(
      'appearance-accessibility-title',
      'Acessibilidade',
      'Personalize contraste, leitura, links e movimento para todas as telas.',
      h`<div class="accessibility-options accessibility-settings-options">
      ${accessibilityOption('settings-accessibility-contrast', 'accessibility-contrast', 'Alto contraste', 'Reforça textos, bordas e foco.', L.contrast)}
      ${accessibilityOption('settings-accessibility-readable', 'accessibility-readable', 'Legibilidade aprimorada', 'Usa uma fonte simples e aumenta o espaçamento entre linhas.', L.readable)}
      ${accessibilityOption('settings-accessibility-links', 'accessibility-links', 'Destacar links', 'Sublinha os links para identificá-los com mais facilidade.', L.highlightLinks)}
      ${accessibilityOption('settings-accessibility-motion', 'accessibility-motion', 'Reduzir movimento', 'Reduz animações e rolagens suaves.', L.reduceMotion)}
    </div>`,
    )}
    ${group(
      'appearance-calendar-title',
      'Calendário',
      'Escolha o dia em que a semana começa nas visualizações do Aurora.',
      h`<div class="appearance-settings-controls"><div class="appearance-settings-option"><span
        class="appearance-settings-label">A semana começa na</span>${settingsSegment(
          s.look,
          'weekStart',
          'Primeiro dia da semana',
          [
            [1, 'Segunda'],
            [0, 'Domingo'],
          ],
          'preferences-week-start',
        )}</div></div>`,
    )}
  </form>`;
}
export function firstName(value) {
  const normalized = String(value || '').trim();
  if (!normalized) return '';
  return normalized.split(/\s+/)[0];
}
export function profileDraftFromSettings(settings) {
  const baseName = String(settings.profile.name || '');
  const preferred =
    settings.profile.preferredName && settings.profile.preferredName.trim()
      ? settings.profile.preferredName
      : firstName(baseName);
  return {
    name: baseName,
    preferredName: preferred,
    sex: settings.profile.sex || '',
    age: settings.profile.age == null ? '' : String(settings.profile.age),
    appearance: normalizeProfileAppearance(settings.prefs.profileAppearance),
  };
}
function profileSettings(s) {
  s = settingsView();
  const p = ui.profileDraft || profileDraftFromSettings(s);
  const appearance = normalizeProfileAppearance(p.appearance);
  const defaultProfileAppearance = sameJsonValue(appearance, PROFILE_APPEARANCE_DEFAULT);
  const profileControlsDisabled = ui.profileSaving || ui.profileImageBusy;
  return h`<div class="profile-settings-container">
    <form id="profile-settings-form" class="card profile-settings" aria-labelledby="settings-profile-title"
      data-form="settings-profile" novalidate>
    <div class="profile-settings-heading"><h2
      id="settings-profile-title">Seu perfil</h2><p>É assim que o Aurora se apresenta para você. Suas alterações são salvas automaticamente.</p></div>
    <div class="profile-greeting-preview" aria-live="polite">${profileAvatarMarkup(appearance)}<span
      class="profile-greeting-copy"><span>Prévia na tela Início</span><b><span
      id="profile-preview-greeting">${profileGreeting(appearance.greeting)}</span>, <span id="profile-preview-name"
      class="proper-name">${p.preferredName.trim() || p.name.trim() || 'Seu nome'}</span>.</b></span></div>
    <section class="profile-settings-group" aria-labelledby="profile-name-title">
      <div><h3 id="profile-name-title">Informações do perfil</h3></div>
      <div class="form profile-settings-fields">
        <label class="f" for="pname">Nome<input type="text" id="pname" data-profile-field="name" value="${p.name}"
          maxlength="50" autocomplete="name" required></label>
        <label class="f" for="ppreferred">Como prefere ser chamada?<input type="text" id="ppreferred"
          data-profile-field="preferredName" value="${p.preferredName}" maxlength="50" autocomplete="nickname"
          aria-describedby="profile-preferred-help" placeholder="${firstName(p.name) || 'Elisa'}"><span
          class="profile-field-help" id="profile-preferred-help">É o nome que aparece na saudação.</span></label>
        <label class="f" for="psex">Identidade de gênero · obrigatória<select id="psex" data-profile-field="sex"
          aria-describedby="profile-sex-help" required><option
          value="">Selecione uma opção</option>${Object.entries(SEX).map(
            ([key, label]) => h`<option
          value="${key}" ${p.sex === key ? raw('selected') : ''}>${label}</option>`,
          )}</select><span
          class="profile-field-help"
          id="profile-sex-help">Selecione uma opção. Ciclo fica disponível apenas para mulheres.</span></label>
        <label class="f" for="page">Idade · opcional<input type="number" id="page" data-profile-field="age" min="0"
          max="120" step="1" inputmode="numeric" aria-describedby="profile-age-help" value="${p.age}"
          placeholder="Opcional"><span class="profile-field-help"
          id="profile-age-help">Usamos só para sugerir a meta de água nos Hábitos.</span></label>
      </div>
    </section>
    <section class="profile-settings-group" aria-labelledby="profile-appearance-title">
      <div class="profile-appearance-heading"><div><h3
        id="profile-appearance-title">Identidade visual.</h3><p>Escolha um símbolo e uma cor para o seu perfil.</p></div><button
        type="button" class="btn sm"
        data-action="profile-appearance-reset" ${defaultProfileAppearance || profileControlsDisabled ? raw('disabled') : ''}>Restaurar padrão</button></div>
      <div class="profile-appearance-controls">
        <div class="profile-appearance-option">
          <span class="appearance-settings-label">Foto de perfil</span>
          <div class="profile-avatar-upload-actions">
            <button type="button" class="btn sm"
              data-action="profile-avatar-choose" ${profileControlsDisabled ? raw('disabled') : ''}>${ui.profileImageBusy ? 'Preparando foto…' : 'Escolher foto'}</button>
            ${
              appearance.avatarImage
                ? h`<button type="button" class="btn sm"
              data-action="profile-avatar-adjust" ${profileControlsDisabled ? raw('disabled') : ''}>Ajustar enquadramento</button><button
              type="button" class="btn sm"
              data-action="profile-avatar-remove" ${profileControlsDisabled ? raw('disabled') : ''}>Remover foto</button>`
                : ''
            }
            <input id="profile-avatar-file" type="file" accept="image/jpeg,image/png,image/webp"
              data-profile-avatar-file hidden>
          </div>
          <p class="profile-avatar-upload-help">JPG, PNG ou WebP até 8 MB. Você escolhe o corte e a posição; a imagem será reduzida para até 240 KB. A foto é salva nas preferências da conta, protegida pelas regras de acesso (sem criptografia ponta a ponta) e sincronizada entre dispositivos.</p>
          ${
            ui.profileImageBusy
              ? h`<p class="profile-avatar-upload-status" role="status"
            aria-live="polite">Preparando foto…</p>`
              : ''
          }
        </div>
        <div class="profile-appearance-option"><span class="appearance-settings-label">Símbolo</span><div
          class="profile-avatar-options" role="group"
          aria-label="Símbolo do perfil">${PROFILE_AVATARS.map(
            ([id, label]) => h`<button type="button"
          class="profile-avatar-option" data-action="profile-appearance" data-k="avatar" data-v="${id}"
          aria-label="${label}" title="${label}"
          aria-pressed="${String(appearance.avatar === id)}">${icon(id, 20)}</button>`,
          )}</div></div>
        <div class="profile-appearance-option"><span class="appearance-settings-label">Cor</span><div
          class="profile-avatar-colors" role="group"
          aria-label="Cor do símbolo">${PROFILE_AVATAR_COLORS.map(
            ([id, label]) => h`<button type="button"
          class="profile-avatar-color" data-action="profile-appearance" data-k="avatarColor" data-v="${id}"
          aria-label="${label}" title="${label}" aria-pressed="${String(appearance.avatarColor === id)}"><span
          style="--profile-avatar-color:${PALETTES[id][1]}"
          aria-hidden="true">${appearance.avatarColor === id ? icon('check', 12) : ''}</span></button>`,
          )}</div></div>
      </div>
    </section>
  </form>
  </div>`;
}
function accountSettings(s) {
  return h`<div class="settings-account-list">
    <section class="card settings-section-card account-session-card" aria-labelledby="account-session-title">
      <div class="settings-section-heading"><div><h2
        id="account-session-title">Conta e ajuda</h2>${
          accountSession?.user?.email
            ? h`<p
        class="account-session-email">Conectada como <b>${accountSession.user.email}</b></p>`
            : ''
        }</div></div>
    </section>
    ${
      !ui.preview
        ? h`<section class="card settings-section-card account-feedback-card" aria-labelledby="account-feedback-title">
      <div class="settings-section-heading"><h2
        id="account-feedback-title">Ajude a melhorar o Aurora</h2><p>Conte uma ideia, melhoria ou algo que não funcionou como esperado.</p></div>
      ${raw(renderSuggestionForm())}
    </section>`
        : ''
    }
    <section class="card settings-section-card account-delete-card danger-zone" aria-labelledby="account-delete-title">
      <div class="settings-section-heading account-delete-heading"><div><h2
        id="account-delete-title">Excluir conta</h2><p>A exclusão apaga a conta e todos os dados e não pode ser desfeita.</p></div><button
        type="button" class="btn danger" data-action="account-delete-open">Excluir conta</button></div>
    </section>
    <section class="card settings-section-card account-resources-card" aria-labelledby="account-resources-title">
      <div class="settings-section-heading"><div><h2
        id="account-resources-title">Ajuda e documentos</h2><p>Termos de Uso, Política de Privacidade e contato com o Aurora.</p></div></div>
      <div class="row account-resource-actions"><button type="button" class="btn sm"
        data-legal-document="terms">Termos de Uso</button><button type="button" class="btn sm"
        data-legal-document="privacy">Política de Privacidade</button><a class="btn ghost sm"
        href="mailto:${CONTACT_EMAIL}">Falar com o Aurora</a></div>
    </section>
  </div>`;
}
export function profileDraftHasChanges(draft, profile, savedAppearance = PROFILE_APPEARANCE_DEFAULT) {
  return (
    draft.name !== (profile.name || '') ||
    draft.preferredName !== (profile.preferredName || profile.name || '') ||
    draft.sex !== (profile.sex || '') ||
    draft.age !== (profile.age == null ? '' : String(profile.age)) ||
    !sameJsonValue(normalizeProfileAppearance(draft.appearance), normalizeProfileAppearance(savedAppearance))
  );
}

export async function applyProfileAvatarFile(file) {
  await adjustAndApplyProfileAvatar(() => openProfileAvatarFile(file), 'Ajustar foto');
}

export async function adjustCurrentProfileAvatar() {
  const draft = ui.profileDraft || profileDraftFromSettings(S.settings);
  const current = draft.appearance?.avatarImage;
  if (!current) return;
  await adjustAndApplyProfileAvatar(() => openProfileAvatarData(current), 'Ajustar enquadramento');
}

async function adjustAndApplyProfileAvatar(openBitmap, title) {
  const routeAtStart = ui.route;
  if (routeAtStart !== 'config' || ui.profileSaving || ui.profileImageBusy) return;
  ui.profileImageBusy = true;
  render();
  let success = false;
  let errorMessage = '';
  let bitmap = null;
  try {
    bitmap = await openBitmap();
    const { adjustProfileAvatar } = await import('../features/profile/avatar-cropper.js');
    const avatarImage = await adjustProfileAvatar(bitmap, { title });
    if (!avatarImage || ui.route !== 'config') return;
    const draft = ui.profileDraft || profileDraftFromSettings(S.settings);
    draft.appearance = normalizeProfileAppearance({ ...draft.appearance, avatarImage });
    ui.profileDraft = profileDraftHasChanges(draft, S.settings.profile, S.settings.prefs.profileAppearance)
      ? draft
      : null;
    success = true;
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : 'Não foi possível preparar a foto.';
  } finally {
    bitmap?.close();
    ui.profileImageBusy = false;
    render();
    if (ui.profileDraft) scheduleProfileAutosave();
  }
  if (routeAtStart === ui.route && success) {
    toast('Foto pronta. Ela será salva automaticamente.', 'success');
  } else if (routeAtStart === ui.route && errorMessage) toast(errorMessage, 'error');
}

const LEGACY_SETTINGS_TABS = {
  appearance: 'personalization',
  preferences: 'personalization',
  calendar: 'personalization',
  areas: 'areas-navigation',
  navigation: 'areas-navigation',
};
export const settingsTabId = (id) => LEGACY_SETTINGS_TABS[id] || id;
export const SETTINGS_SECTIONS = [
  ['profile', 'Seu perfil', 'user', 'Nome, saudação e idade'],
  ['personalization', 'Aparência e leitura', 'sun', 'Tema, cores e acessibilidade'],
  ['home', 'Tela inicial', 'home', 'Modo e blocos da tela inicial'],
  ['areas-navigation', 'Áreas e menu', 'grid', 'Ativar áreas e organizar o menu'],
  ['data', 'Dados e recuperação', 'archive', 'Gerenciar a lixeira e a recuperação de dados'],
  ['calendars', 'Agendas', 'calendar', 'Conectar contas e escolher calendários'],
  ['mental-health', 'Apoio psicológico', 'heart', 'Onde buscar acolhimento e cuidado'],
  ['account', 'Conta e ajuda', 'info', 'Excluir e documentos'],
];
const SETTINGS_SECTION_GROUPS = [
  { label: 'Preferências', items: ['profile', 'personalization', 'home', 'areas-navigation'] },
  { label: 'Dados e conexões', items: ['data', 'calendars'] },
  { label: 'Conta e suporte', items: ['account', 'mental-health'] },
];
function homeLayoutSettings(s) {
  const activeMode = s.prefs.homeMode;
  const modeDefaults = defaultHomeModes()[activeMode];
  const layout = s.prefs.homeLayout;
  const ordered = layout.order.map((id) => HOME_BLOCKS.find(([blockId]) => blockId === id)).filter(Boolean);
  const isDefault = sameJsonValue(layout, modeDefaults.layout);
  return h`<section class="home-layout-settings" aria-labelledby="home-layout-title">
    <div class="settings-section-heading"><div><h3
      id="home-layout-title">Tela inicial</h3><p>Escolha um modo e personalize os blocos da tela inicial.</p></div><button
      type="button" class="btn sm"
      data-action="home-layout-reset" ${isDefault ? raw('disabled') : ''}>Restaurar modo</button></div>
    <div class="home-mode-grid" role="group"
      aria-label="Modos da tela inicial">${Object.entries(HOME_MODES).map(
        ([id, mode]) => h`<button type="button"
      class="home-mode-option" data-action="home-mode" data-home-mode="${id}"
      aria-pressed="${String(activeMode === id)}"><b>${mode.label}</b><small>${mode.description}</small></button>`,
      )}</div>
    <label class="home-message-field"><span>Mensagem pessoal <small>Opcional · até ${HOME_MESSAGE_MAX_LENGTH} caracteres</small></span><textarea
      data-keep data-change="home-message" maxlength="${HOME_MESSAGE_MAX_LENGTH}" rows="2"
      placeholder="Ex.: Um passo de cada vez."
      aria-describedby="home-message-count">${s.prefs.homeMessage}</textarea><small id="home-message-count"
      class="home-message-count"
      aria-live="polite">${s.prefs.homeMessage.length}/${HOME_MESSAGE_MAX_LENGTH}</small></label>
    <ol class="home-layout-list" aria-label="Blocos da tela inicial">${ordered.map(
      ([id, label, description], index) => h`<li class="home-layout-item">
      <label class="home-layout-toggle"><input type="checkbox" data-change="home-block-visible" data-home-block="${id}"
        aria-label="${layout.visible.includes(id) ? 'Ocultar' : 'Mostrar'} ${label} na tela inicial" ${layout.visible.includes(id) ? raw('checked') : ''}><span><b>${label}</b><small>${description}</small></span></label>
      <span class="home-layout-controls"><span>${id === 'today' ? '1º · fixo' : `${index + 1}º`}</span>${
        id === 'today'
          ? ''
          : h`<button
        type="button" class="ibtn" data-action="home-block-move" data-home-block="${id}" data-direction="-1"
        aria-label="Mover ${label} para cima" ${index === 1 ? raw('disabled') : ''}>${icon('arrowUp', 16)}</button><button
        type="button" class="ibtn" data-action="home-block-move" data-home-block="${id}" data-direction="1"
        aria-label="Mover ${label} para baixo" ${index === ordered.length - 1 ? raw('disabled') : ''}>${icon('arrowDown', 16)}</button>`
      }</span>
    </li>`,
    )}</ol>
  </section>`;
}
function areasNavigationSettings(s) {
  s = settingsView();
  const items = normalizeMenuOrder(s.prefs.menuOrder)
    .map((id) => MENU_ITEMS.find((item) => item.id === id))
    .filter(
      (item) =>
        item && !HIDDEN_MENU_IDS.includes(item.id) && (item.id !== 'ciclo' || canAccessCycle(s.profile, ui.preview)),
    );
  const orderedItems = items;
  const isDefaultMenuSettings = isDefaultMenuPreferences(s.prefs);
  return h`<form class="card areas-navigation-settings" data-form="settings-save">
    <div class="head areas-navigation-head"><h2>Áreas e menu</h2><button type="button" class="btn sm"
      data-action="menu-reset" ${isDefaultMenuSettings ? raw('disabled') : ''}>Restaurar padrão</button></div>
    <p class="settings-section-intro">Escolha quais áreas aparecem e organize o acesso pelo menu. Desativar ou ocultar uma área não apaga seus dados.</p>
    <p class="small muted">Início fica sempre primeiro. Beber água é uma sugestão de hábito em Hábitos. Restaurar o padrão não ativa áreas nem altera registros.</p>
    <ol class="areas-navigation-list compact-card-grid" aria-label="Áreas e menus principais">${items.map((item) => {
      const areaName = item.area ? AREAS[item.area]?.[0] || item.label : item.label;
      const areaDescription = item.area
        ? AREAS[item.area]?.[1] || ''
        : item.id === 'inicio'
          ? 'Página inicial do Aurora'
          : 'Tarefas, prazos e planejamento';
      const orderIndex = orderedItems.findIndex(({ id }) => id === item.id);
      const orderLabel = item.id === 'inicio' ? 'Sempre primeiro' : item.id === 'planejar' ? 'Sempre visível' : '';
      const areaEnabled = item.area ? s.areas[item.area] === true : false;
      return h`<li class="areas-navigation-item">
        <span class="areas-navigation-icon">${icon(item.icon, 20)}</span>
        ${
          item.area
            ? h`<label class="areas-navigation-toggle"><input type="checkbox" data-change="area"
              data-area="${item.area}"
              aria-label="${areaEnabled ? 'Desativar' : 'Ativar'} área ${areaName}" ${areaEnabled ? raw('checked') : ''}><span
              class="setting-toggle-copy"><span class="areas-navigation-name"><b>${areaName}</b><small
              class="area-status${areaEnabled ? ' is-active' : ''}">${areaEnabled ? 'Ativa' : 'Desativada'}</small></span><span>${areaDescription}</span></span></label>`
            : h`<span class="areas-navigation-copy"><b>${areaName}</b><span>${areaDescription}</span></span>`
        }
        <span class="areas-navigation-controls">
          ${
            item.area && !HIDDEN_MENU_IDS.includes(item.id)
              ? h`<label class="menu-visibility"><input type="checkbox" id="menu-visible-${item.id}" data-keep
                data-change="menu-visible" data-menu-id="${item.id}"
                aria-label="${s.prefs.visibleMenuItems.includes(item.id) ? 'Ocultar' : 'Mostrar'} ${item.label} no menu" ${s.prefs.visibleMenuItems.includes(item.id) ? raw('checked') : ''}><span>Mostrar no menu</span></label>`
              : h`<span class="menu-always-visible">${orderLabel}</span>`
          }
          ${
            HIDDEN_MENU_IDS.includes(item.id)
              ? ''
              : h`<span class="areas-navigation-order"><span
                class="areas-navigation-position">${item.id === 'inicio' ? '1º' : item.id === 'planejar' ? 'Fixo' : `${orderIndex + 1}º`}</span>
              ${
                canMoveMenuItem(s.prefs.menuOrder, item.id, -1, HIDDEN_MENU_IDS)
                  ? h`<button type="button" class="ibtn"
                id="menu-move-up-${item.id}" data-action="menu-move" data-menu-id="${item.id}" data-direction="-1"
                aria-label="Mover ${item.label} para cima">${icon('arrowUp', 18)}</button>`
                  : ''
              }
              ${
                canMoveMenuItem(s.prefs.menuOrder, item.id, 1, HIDDEN_MENU_IDS)
                  ? h`<button type="button" class="ibtn"
                id="menu-move-down-${item.id}" data-action="menu-move" data-menu-id="${item.id}" data-direction="1"
                aria-label="Mover ${item.label} para baixo">${icon('arrowDown', 18)}</button>`
                  : ''
              }
            </span>`
          }
        </span>
      </li>`;
    })}</ol>
  </form>`;
}
function homeSettings(s) {
  s = settingsView();
  return h`<form class="card home-settings" data-form="settings-save">
    ${homeLayoutSettings(s)}
  </form>`;
}
function setLegacyImportError(message) {
  ui.legacyImport.error = message;
  ui.legacyImport.busy = false;
  render();
}
let legacyImportModulesPromise;
function loadLegacyImportModules() {
  if (!legacyImportModulesPromise) {
    legacyImportModulesPromise = Promise.all([
      import('../data/legacy-import.js'),
      import('../data/legacy-import-model.js'),
    ])
      .then(([importer, model]) => ({ ...importer, ...model }))
      .catch((error) => {
        legacyImportModulesPromise = null;
        throw error;
      });
  }
  return legacyImportModulesPromise;
}
async function prepareLegacyImportPreview(migration, sources, vaultCount) {
  const { prepareLegacyImport } = await loadLegacyImportModules();
  const browserData = migration.browserData;
  const sourceCounts = {
    browser: Object.keys(browserData.plain).length,
    encryptedBrowser: Object.keys(browserData.encrypted).length,
    vault: vaultCount,
  };
  const currentState = JSON.parse(JSON.stringify(S));
  const plan = prepareLegacyImport({
    currentState,
    sources,
    defaults: defaults(),
    normalizeSlice,
  });
  migration.preview = {
    browserData,
    currentState,
    plan,
    sourceCounts,
  };
  browserData.plain = {};
  browserData.encrypted = {};
  migration.browserData = null;
  migration.discovery = null;
  migration.step = plan.slices.length ? 'review' : 'empty';
}
export async function discoverLegacyImport() {
  if (!accountSession || !Persist.store || ui.legacyImport.busy) return;
  ui.legacyImport = {
    step: 'start',
    browserData: null,
    discovery: null,
    preview: null,
    error: '',
    busy: true,
    completed: false,
    cleanup: null,
    cleanupConfirmed: false,
  };
  render();
  try {
    const { inspectLegacySources, scanLegacyBrowserStorage } = await loadLegacyImportModules();
    const browserData = scanLegacyBrowserStorage(window.localStorage, accountSession.user.id);
    const discovery = await inspectLegacySources({
      client: accountSession.client,
      userId: accountSession.user.id,
      browserData,
    });
    const migration = ui.legacyImport;
    migration.browserData = browserData;
    migration.discovery = discovery;
    if (discovery.requiresUnlock) {
      migration.step = 'unlock';
    } else {
      await prepareLegacyImportPreview(migration, discovery.sources, discovery.vaultCount);
    }
  } catch (error) {
    console.error('Aurora: a busca por dados antigos não foi concluída.', error);
    ui.legacyImport.error =
      error instanceof Error ? error.message : 'Não foi possível localizar os dados antigos. Eles foram preservados.';
  } finally {
    ui.legacyImport.busy = false;
    render();
  }
}
export async function unlockLegacyImport() {
  const migration = ui.legacyImport;
  if (!accountSession || !migration.discovery?.requiresUnlock || migration.busy) return;
  const passwordInput = $('#legacy-vault-password');
  const password = passwordInput?.value || '';
  if (passwordInput) passwordInput.value = '';
  migration.busy = true;
  migration.error = '';
  render();
  try {
    const { unlockLegacySources } = await loadLegacyImportModules();
    const { sources, vaultCount } = await unlockLegacySources({
      discovery: migration.discovery,
      userId: accountSession.user.id,
      password,
    });
    await prepareLegacyImportPreview(migration, sources, vaultCount);
  } catch (error) {
    console.error('Aurora: o cofre antigo não pôde ser desbloqueado para importação.', error);
    migration.error =
      error instanceof Error ? error.message : 'Não foi possível ler o cofre antigo. Os dados continuam preservados.';
  } finally {
    migration.busy = false;
    render();
  }
}
export async function applyLegacyImport() {
  const migration = ui.legacyImport;
  const preview = migration.preview;
  if (!accountSession || !Persist.store || !preview || migration.busy || migration.completed) return;
  if (!sameJsonValue(S, preview.currentState)) {
    migration.preview = null;
    migration.browserData = null;
    migration.discovery = null;
    migration.step = 'start';
    migration.error =
      'Os dados da conta mudaram desde a análise. Analise novamente; nenhuma cópia antiga foi alterada.';
    render();
    return;
  }
  if (settingsDraftDirty() || ui.profileDraft || ui.dlg) {
    setLegacyImportError('Salve ou feche as alterações abertas antes de importar. Nenhuma origem antiga foi alterada.');
    return;
  }
  let hasAllExpectedRecords;
  try {
    ({ hasAllExpectedRecords } = await loadLegacyImportModules());
  } catch (error) {
    console.error('Aurora: não foi possível carregar o verificador da importação antiga.', error);
    setLegacyImportError(
      'Não foi possível carregar a verificação de dados antigos. As cópias foram preservadas; tente novamente.',
    );
    return;
  }
  const addedTotal = Object.values(preview.plan.added).reduce((sum, count) => sum + count, 0);
  if (!hasCurrentCycleDataConsent(accountSession?.user)) {
    setLegacyImportError(
      'Antes de importar dados antigos, registre o consentimento específico de Ciclo. A importação substitui tabelas da conta e precisa preservar os dados de saúde que possam existir.',
    );
    return;
  }
  if (
    !(await confirmInDialog(
      `Importar os dados antigos para esta conta? A prévia encontrou ${addedTotal} novo(s) registro(s), além de configurações que possam ser recuperadas. Dados atuais desta conta serão mantidos e não haverá duplicação por ID. Os dados antigos só serão apagados depois de nova confirmação.`,
    ))
  )
    return;
  if (ui.persistBlocked.size || Object.keys(ui.integrityIssues).length) {
    setLegacyImportError(
      'A conta atual tem dados bloqueados para gravação. Resolva a integridade dos dados antes de importar; nenhuma origem antiga foi alterada.',
    );
    return;
  }
  if (!(await Persist.flush())) {
    setLegacyImportError('Há alterações da conta ainda não confirmadas. Salve ou resolva os erros antes de importar.');
    return;
  }
  if (!sameJsonValue(S, preview.currentState) || settingsDraftDirty() || ui.profileDraft || ui.dlg) {
    migration.preview = null;
    migration.browserData = null;
    migration.discovery = null;
    migration.step = 'start';
    migration.error =
      'Os dados da conta mudaram desde a análise. Analise novamente; nenhuma cópia antiga foi alterada.';
    render();
    return;
  }
  if (navigator.onLine === false) {
    setLegacyImportError('Sem conexão: a importação não foi gravada. Os dados antigos continuam preservados.');
    return;
  }

  migration.busy = true;
  migration.error = '';
  Persist.replacing = true;
  render();
  try {
    if (!sameJsonValue(S, preview.plan.state)) {
      await Persist.store.save(preview.plan.state);
    }
    const loaded = await Persist.store.load();
    const confirmed = {};
    for (const slice of SLICES) {
      const normalized = normalizeSlice(slice, loaded[slice] ?? defaults()[slice]);
      if (normalized.invalidCount) {
        throw new Error(
          `A conferência encontrou dados incompatíveis em ${slice}. A importação não foi confirmada; mantenha as cópias antigas.`,
        );
      }
      confirmed[slice] = normalized.value;
    }
    const missing = hasAllExpectedRecords(preview.plan.state, confirmed);
    if (missing) {
      throw new Error(
        `A conferência não encontrou todos os registros esperados em ${missing}. A importação não foi confirmada; mantenha as cópias antigas.`,
      );
    }
    setS(confirmed);
    Persist.rawTables = Persist.store.rawTables;
    Persist.confirmedState = JSON.parse(JSON.stringify(confirmed));
    Persist.pendingSnapshot = null;
    ui.persistFailed.clear();
    ui.persistBlocked.clear();
    syncState.pending.clear();
    syncState.failed.clear();
    syncState.conflicts.clear();
    ui.settingsDraft = null;
    ui.settingsDraftBase = null;
    preview.plan.state = null;
    preview.currentState = null;
    preview.browserData.plain = {};
    preview.browserData.encrypted = {};
    migration.browserData = null;
    migration.discovery = null;
    migration.completed = true;
    migration.step = 'verified';
    migration.cleanupConfirmed = false;
    toast('Importação gravada e conferida na conta.', 'info');
  } catch (error) {
    console.error('Aurora: a importação relacional dos dados antigos não foi confirmada.', error);
    migration.error =
      error instanceof Error
        ? error.message
        : 'Não foi possível confirmar a importação. Os dados antigos foram preservados; você pode analisar e tentar novamente.';
  } finally {
    Persist.replacing = false;
    migration.busy = false;
    render();
  }
}
export async function clearLegacyBrowserData() {
  const migration = ui.legacyImport;
  const preview = migration.preview;
  const snapshot = preview?.browserData?.snapshot;
  if (!migration.completed || !snapshot || !Object.keys(snapshot).length || migration.busy) return;
  if (!migration.cleanupConfirmed) {
    migration.error = 'Confirme que revisou os dados importados antes de remover as cópias deste navegador.';
    render();
    return;
  }
  migration.cleanupConfirmed = false;
  let result;
  try {
    const { clearImportedBrowserStorage } = await loadLegacyImportModules();
    result = clearImportedBrowserStorage(window.localStorage, snapshot);
  } catch (error) {
    console.error('Aurora: não foi possível preparar a limpeza das cópias antigas.', error);
    setLegacyImportError(
      error instanceof Error ? error.message : 'Não foi possível limpar as cópias antigas; elas continuam preservadas.',
    );
    return;
  }
  result.removed.forEach((key) => {
    delete snapshot[key];
  });
  if (result.changed.length) {
    migration.preview = null;
    migration.completed = false;
    migration.step = 'start';
    migration.error = `${result.removed.length} chave(s) foram apagadas, mas ${result.changed.length} mudaram depois da análise. Analise novamente antes de continuar; essas cópias não foram removidas.`;
  } else if (result.failed.length) {
    preview.cleanup = {
      failed: result.failed.length,
      changed: 0,
      message: `${result.removed.length} chave(s) apagadas. Não foi possível apagar ${result.failed.length}; você pode tentar novamente.`,
    };
  } else {
    preview.cleanup = {
      failed: 0,
      changed: 0,
      message: `${result.removed.length} chave(s) antiga(s) apagadas deste navegador. O cofre antigo e os dados da sua conta continuam preservados.`,
    };
  }
  render();
}
function dataSettings(p) {
  const integritySlices = Object.keys(ui.integrityIssues);
  const trashEntries = sortTrashEntriesByExpiry(p.trash.filter((entry) => !isTrashExpired(entry)));
  return h`<section class="card settings-section-card settings-data-overview"
    aria-labelledby="settings-data-overview-title">
    <div class="settings-section-heading"><h2
      id="settings-data-overview-title">Gerenciar seus dados</h2><p>Recupere itens excluídos ou confira o estado dos dados da conta.</p></div>
    ${
      integritySlices.length
        ? h`<div class="notice warn"
      role="alert"><span>Há dados com formato inválido em ${integritySlices.join(', ')}. Os dados originais foram preservados e não serão sobrescritos. Baixe uma cópia de recuperação antes de buscar ajuda.</span><button
      type="button" class="btn sm"
      data-action="recovery-export">${icon('download', 18)}Baixar cópia de recuperação</button></div>`
        : ''
    }
  </section>
    <section class="card settings-section-card settings-data-trash" aria-labelledby="trash-title"><div
      class="settings-section-heading"><h2 id="trash-title" tabindex="-1">Lixeira <span
      class="settings-data-count">${trashEntries.length}</span></h2><p>Os itens excluídos podem ser restaurados por até 30 dias. Os que vencem primeiro aparecem no topo.</p></div>
      ${
        trashEntries.length
          ? h`<ul class="list trash-list">${trashEntries.map((entry) => {
              const days = trashDaysRemaining(entry);
              return h`<li class="settings-trash-entry"><div class="grow"><div class="ttl">${entry.label}</div><span
                class="small muted">Excluído em ${shortDate(isoDay(entry.deletedAt))}</span><span
                class="settings-trash-expiry${days <= 7 ? ' is-urgent' : ''}">${days} ${plural(days, 'dia restante', 'dias restantes')}</span></div><button
                type="button" class="btn sm" data-action="trash-restore" data-id="${entry.id}"
                aria-label="Restaurar ${entry.label}">Restaurar</button></li>`;
            })}</ul>`
          : areaEmpty(
              'A lixeira está vazia.',
              'Quando você excluir itens, eles ficam disponíveis aqui por até 30 dias.',
              h`<a class="btn primary" href="/inicio">Ir para o início</a>`,
              'trash',
              'h3',
              'settings-trash-empty',
            )
      }
    </section>
    <section class="card settings-section-card settings-data-care" aria-labelledby="settings-care-title">
      <div class="settings-section-heading"><h2
        id="settings-care-title">Limpar dados da conta</h2><p>Apaga seus registros e preferências no Aurora, mas mantém sua conta e seu acesso.</p></div>
      <div class="settings-data-care-actions">
        <section class="settings-data-action settings-data-danger" aria-labelledby="settings-delete-title">
          <h3 id="settings-delete-title">${icon('trash', 18)}O que será apagado</h3>
          ${relationalDataWipeScope()}
          <p class="small muted">Cópias antigas ainda não importadas serão preservadas.</p>
          <button type="button" class="btn danger" data-action="wipe-ask">Apagar dados e manter a conta</button>
        </section>
      </div>
    </section>`;
}
export function relationalDataWipeScope() {
  return h`<ul class="settings-data-scope" aria-label="Dados que serão apagados">
    <li>Tarefas, listas, etiquetas, registros diários e revisões semanais.</li>
    <li>Hábitos, registros de água e treinos.</li>
    <li>Finanças: contas, lançamentos, orçamentos, metas e recorrências.</li>
    <li>Registros do Ciclo, pesagens e itens da lixeira.</li>
    <li>Perfil, preferências e configuração de notificações.</li>
  </ul>`;
}
function viewConfig() {
  return renderSettingsView({
    S,
    ui,
    sections: SETTINGS_SECTIONS,
    sectionGroups: SETTINGS_SECTION_GROUPS,
    settingsTabId,
    tabLabel,
    pageTitle,
    renderers: {
      appearance: aparencia,
      home: homeSettings,
      areasNavigation: areasNavigationSettings,
      data: dataSettings,
      calendars: googleCalendarSettingsPanel,
      account: accountSettings,
      profile: profileSettings,
    },
  });
}

export const ROUTES = {
  inicio: viewInicio,
  planejar: viewPlanejar,
  financas: viewFinancas,
  ciclo: viewCiclo,
  habitos: viewHabits,
  config: viewConfig,
};
