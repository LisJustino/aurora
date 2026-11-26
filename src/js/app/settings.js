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
  PROFILE_GREETING_STYLES,
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
import {
  filterTrashEntries,
  isTrashExpired,
  sortTrashEntriesByExpiry,
  TRASH_CATEGORIES,
  trashDaysRemaining,
  trashEntryCategory,
  trashEntryDisplay,
} from '../features/trash/model.js';
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
const HOME_MESSAGE_PRESETS = Object.freeze([
  'Um passo de cada vez.',
  'Foco no que importa hoje.',
  'Ritmo leve, mente tranquila.',
  'Constância vence intensidade.',
]);
const WATER_GOAL_PRESETS = Object.freeze([
  [1500, '1,5 L'],
  [2000, '2 L'],
  [2500, '2,5 L'],
  [3000, '3 L'],
]);
function aparencia(s) {
  s = settingsView();
  const L = s.look;
  const currentPalette = s.theme === 'custom' ? 'Personalizada' : PALETTES[s.theme]?.[0] || PALETTES.rose[0];
  const canUseCycle = canAccessCycle(s.profile, ui.preview);
  const waterGoalMl = s.prefs.waterGoalMl || 2000;
  const waterPresetMatches = WATER_GOAL_PRESETS.some(([value]) => value === waterGoalMl);
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
      id="appearance-settings-title">Aparência e leitura</h2><p>Ajuste o tema, as cores, a leitura, a acessibilidade e o comportamento da rotina. As alterações são salvas automaticamente.</p></div><button
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
        <i class="appearance-custom-preview"${
          s.theme === 'custom' ? raw(` style="background:${paletteColors('custom', L)[0]}"`) : ''
        } aria-hidden="true"></i>
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
      'appearance-routine-title',
      'Rotina e comportamento',
      'Ajuste calendário, meta padrão de água, retorno tátil e privacidade nas telas.',
      h`<div class="routine-settings-stack">
      <div class="appearance-settings-controls">
        <div class="appearance-settings-option"><span
          class="appearance-settings-label">A semana começa na</span>${settingsSegment(
            s.look,
            'weekStart',
            'Primeiro dia da semana',
            [
              [1, 'Segunda'],
              [0, 'Domingo'],
            ],
            'preferences-week-start',
          )}</div>
        <div class="appearance-settings-option"><span
          class="appearance-settings-label">Meta diária de água${waterPresetMatches ? '' : ` · ${waterGoalMl.toLocaleString('pt-BR')} mL`}</span><div
          class="seg" role="group" aria-label="Meta diária de água padrão">${WATER_GOAL_PRESETS.map(
            ([value, label]) =>
              h`<button type="button" data-action="preferences-water-goal" data-v="${value}"
                aria-pressed="${String(waterGoalMl === value)}">${label}</button>`,
          )}</div></div>
      </div>
      <div class="accessibility-options accessibility-settings-options routine-settings-options">
        ${accessibilityOption('settings-accessibility-vibration', 'accessibility-vibration', 'Retorno tátil', 'Vibração sutil ao concluir tarefas, hábitos e registros.', s.prefs.vibrationEnabled !== false)}
        ${accessibilityOption('settings-pref-weekly-review', 'preferences-weekly-review', 'Revisão semanal', 'Destaca o lembrete para revisar sua semana aos domingos.', s.prefs.weeklyReviewReminder === true)}
        ${accessibilityOption('settings-pref-finance-hidden', 'preferences-finance-hidden', 'Ocultar valores financeiros', 'Esconde saldos e lançamentos até você tocar para exibir.', s.prefs.financeValuesHidden === true)}
        ${
          canUseCycle
            ? accessibilityOption(
                'settings-pref-cycle-discreet',
                'preferences-cycle-discreet',
                'Modo discreto no Ciclo',
                'Oculta termos detalhados do ciclo na tela inicial e nos resumos.',
                s.prefs.cycleDiscreet === true,
              )
            : ''
        }
      </div>
    </div>`,
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
        id="profile-appearance-title">Identidade visual</h3><p>Escolha um símbolo e uma cor para o seu perfil.</p></div><button
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
        <div class="profile-appearance-option"><span class="appearance-settings-label">Saudação</span><div
          class="seg" role="group" aria-label="Estilo da saudação">${PROFILE_GREETING_STYLES.map(
            ([id, label]) => h`<button type="button"
          data-action="profile-appearance" data-k="greeting" data-v="${id}"
          aria-pressed="${String(appearance.greeting === id)}" ${profileControlsDisabled ? raw('disabled') : ''}>${
            id === 'dynamic' ? 'Por horário' : label
          }</button>`,
          )}</div></div>
      </div>
    </section>
  </form>
  </div>`;
}
function accountSettings(s) {
  const email = accountSession?.user?.email || '';
  const activeAreas = Object.values(s.areas || {}).filter(Boolean).length;
  const offlinePending = Persist.offlineQueuedCount || (Persist.pendingSnapshot ? 1 : 0);
  const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
  const syncTone = ui.preview ? 'neutral' : offlinePending > 0 ? 'warn' : 'ok';
  const syncLabel = ui.preview
    ? 'Modo demonstração'
    : offlinePending > 0
      ? isOffline
        ? 'Alterações aguardando conexão'
        : 'Sincronizando alterações…'
      : 'Tudo sincronizado';
  return h`<div class="settings-account-list">
    <section class="card settings-section-card account-session-card" aria-labelledby="account-session-title">
      <div class="settings-section-heading"><div><h2
        id="account-session-title">Conta e ajuda</h2><p
        class="account-session-email">${
          email
            ? h`Conectada como <b>${email}</b>`
            : 'Você está navegando no modo demonstração. Suas alterações ficam apenas nesta sessão.'
        }</p></div></div>
      <div class="account-status-row">
        <span class="account-status-pill is-${syncTone}">${icon(syncTone === 'ok' ? 'check' : syncTone === 'warn' ? 'cloud' : 'sparkles', 14)}<span>${syncLabel}</span></span>
        <span class="account-status-pill is-neutral">${icon('grid', 14)}<span>${activeAreas} ${plural(activeAreas, 'área opcional ativa', 'áreas opcionais ativas')}</span></span>
        ${
          !ui.preview && Persist.pendingSnapshot && !isOffline
            ? h`<button type="button" class="btn sm" data-action="persist-retry">${icon('refresh', 14)}Sincronizar agora</button>`
            : ''
        }
      </div>
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
    <section class="card settings-section-card account-resources-card" aria-labelledby="account-resources-title">
      <div class="settings-section-heading"><div><h2
        id="account-resources-title">Ajuda e documentos</h2><p>Novidades, Termos de Uso, Política de Privacidade e contato com o Aurora.</p></div></div>
      <div class="row account-resource-actions"><button type="button" class="btn sm"
        data-action="release-notes-open">${icon('sparkles', 15)}Novidades</button><button type="button" class="btn sm"
        data-legal-document="terms">Termos de Uso</button><button type="button" class="btn sm"
        data-legal-document="privacy">Política de Privacidade</button><a class="btn ghost sm"
        href="mailto:${CONTACT_EMAIL}">Falar com o Aurora</a></div>
    </section>
    <section class="card settings-section-card account-delete-card danger-zone" aria-labelledby="account-delete-title">
      <div class="settings-section-heading account-delete-heading"><div><h2
        id="account-delete-title">Excluir conta</h2><p>A exclusão apaga a conta e todos os dados e não pode ser desfeita.</p></div><button
        type="button" class="btn danger" data-action="account-delete-open">Excluir conta</button></div>
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
  ['account', 'Conta e ajuda', 'info', 'Sessão, novidades e documentos'],
];
const SETTINGS_SECTION_GROUPS = [
  { label: 'Conta', items: ['profile', 'account'] },
  { label: 'Preferências', items: ['personalization', 'home', 'areas-navigation'] },
  { label: 'Dados e cuidado', items: ['calendars', 'data', 'mental-health'] },
];
function homeLayoutSettings(s) {
  const activeMode = s.prefs.homeMode;
  const modeDefaults = defaultHomeModes()[activeMode];
  const layout = s.prefs.homeLayout;
  const ordered = layout.order.map((id) => HOME_BLOCKS.find(([blockId]) => blockId === id)).filter(Boolean);
  const isDefault = sameJsonValue(layout, modeDefaults.layout);
  const currentMessage = s.prefs.homeMessage || '';
  return h`<section class="home-layout-settings" aria-labelledby="home-layout-title">
    <div class="settings-section-heading"><div><h2
      id="home-layout-title">Tela inicial</h2><p>Escolha um modo, escreva uma frase pessoal e organize os blocos da sua tela inicial.</p></div><button
      type="button" class="btn sm"
      data-action="home-layout-reset" ${isDefault ? raw('disabled') : ''}>Restaurar modo</button></div>
    <div class="home-mode-grid" role="group"
      aria-label="Modos da tela inicial">${Object.entries(HOME_MODES).map(
        ([id, mode]) => h`<button type="button"
      class="home-mode-option" data-action="home-mode" data-home-mode="${id}"
      aria-pressed="${String(activeMode === id)}"><b>${mode.label}</b><small>${mode.description}</small></button>`,
      )}</div>
    <div class="home-message-wrap">
      <label class="home-message-field"><span>Mensagem pessoal <small>Opcional · até ${HOME_MESSAGE_MAX_LENGTH} caracteres</small></span><textarea
        data-keep data-change="home-message" maxlength="${HOME_MESSAGE_MAX_LENGTH}" rows="2"
        placeholder="Ex.: Um passo de cada vez."
        aria-describedby="home-message-count">${currentMessage}</textarea><small id="home-message-count"
        class="home-message-count"
        aria-live="polite">${currentMessage.length}/${HOME_MESSAGE_MAX_LENGTH}</small></label>
      <div class="home-message-presets" role="group" aria-label="Sugestões de mensagem pessoal">
        ${HOME_MESSAGE_PRESETS.map(
          (preset) => h`<button type="button" class="chip home-message-preset" data-action="home-message-preset"
            data-v="${preset}" aria-pressed="${String(currentMessage.trim() === preset)}">${preset}</button>`,
        )}
        ${
          currentMessage.trim()
            ? h`<button type="button" class="btn ghost sm home-message-clear" data-action="home-message-preset"
                data-v="">Limpar</button>`
            : ''
        }
      </div>
    </div>
    <ol class="home-layout-list" aria-label="Blocos da tela inicial">${ordered.map(
      ([id, label, description], index) => h`<li class="home-layout-item">
      <label class="home-layout-toggle"><input type="checkbox" class="settings-switch" data-change="home-block-visible" data-home-block="${id}"
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
    <p class="settings-section-intro">Escolha quais áreas ficam ativas e organize a ordem do menu. Desativar ou ocultar uma área nunca apaga seus dados.</p>
    <p class="small muted">Início fica sempre primeiro. Restaurar o padrão ajusta só a ordem e visibilidade do menu.</p>
    <ol class="areas-navigation-list" aria-label="Áreas e menus principais">${items.map((item) => {
      const areaName = item.area ? AREAS[item.area]?.[0] || item.label : item.label;
      const areaDescription = item.area
        ? AREAS[item.area]?.[1] || ''
        : item.id === 'inicio'
          ? 'Página inicial do Aurora'
          : 'Tarefas, prazos e planejamento';
      const orderIndex = orderedItems.findIndex(({ id }) => id === item.id);
      const orderLabel = item.id === 'inicio' ? 'Sempre primeiro' : item.id === 'planejar' ? 'Sempre visível' : '';
      const areaEnabled = item.area ? s.areas[item.area] === true : true;
      const inMenu = s.prefs.visibleMenuItems.includes(item.id);
      return h`<li class="areas-navigation-item${item.area && !areaEnabled ? ' is-inactive' : ''}">
        <span class="areas-navigation-icon" data-area="${item.area || item.id}" aria-hidden="true">${icon(item.icon, 20)}</span>
        <div class="areas-navigation-main">
          <div class="areas-navigation-name"><b>${areaName}</b><small
            class="area-status${areaEnabled ? ' is-active' : ''}">${
              item.area ? (areaEnabled ? 'Ativa' : 'Desativada') : 'Principal'
            }</small></div>
          <span class="areas-navigation-desc">${areaDescription}</span>
        </div>
        <div class="areas-navigation-controls">
          ${
            item.area
              ? h`<label class="areas-navigation-toggle"><input type="checkbox" class="settings-switch" data-change="area"
                  data-area="${item.area}"
                  aria-label="${areaEnabled ? 'Desativar' : 'Ativar'} área ${areaName}" ${areaEnabled ? raw('checked') : ''}><span
                  class="areas-toggle-label">Ativa</span></label>`
              : ''
          }
          ${
            item.area && !HIDDEN_MENU_IDS.includes(item.id)
              ? h`<label class="menu-visibility${inMenu ? ' is-on' : ''}"><input type="checkbox" id="menu-visible-${item.id}" data-keep
                data-change="menu-visible" data-menu-id="${item.id}"
                aria-label="${inMenu ? 'Ocultar' : 'Mostrar'} ${item.label} no menu" ${inMenu ? raw('checked') : ''}><span>${icon(inMenu ? 'eye' : 'eyeOff', 14)}<span>No menu</span></span></label>`
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
                aria-label="Mover ${item.label} para cima">${icon('arrowUp', 16)}</button>`
                  : ''
              }
              ${
                canMoveMenuItem(s.prefs.menuOrder, item.id, 1, HIDDEN_MENU_IDS)
                  ? h`<button type="button" class="ibtn"
                id="menu-move-down-${item.id}" data-action="menu-move" data-menu-id="${item.id}" data-direction="1"
                aria-label="Mover ${item.label} para baixo">${icon('arrowDown', 16)}</button>`
                  : ''
              }
            </span>`
          }
        </div>
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
export function trashResultsHtml(p) {
  const activeEntries = sortTrashEntriesByExpiry(p.trash.filter((entry) => !isTrashExpired(entry)));
  if (!activeEntries.length) {
    return areaEmpty(
      'A lixeira está vazia.',
      'Quando você excluir itens, eles ficam disponíveis aqui por até 30 dias.',
      h`<a class="btn primary" href="/inicio">Ir para o início</a>`,
      'trash',
      'h3',
      'settings-trash-empty',
    );
  }
  const filtered = filterTrashEntries(activeEntries, { category: ui.trashFilter, query: ui.trashQuery });
  if (!filtered.length) {
    return h`<div class="settings-trash-no-match" role="status">
      <p>Nenhum item encontrado com esse filtro.</p>
      <button type="button" class="btn sm" data-action="trash-search-clear">Limpar filtros</button>
    </div>`;
  }
  return h`<ul class="list trash-list">${filtered.map((entry) => {
    const days = trashDaysRemaining(entry);
    const info = trashEntryDisplay(entry);
    return h`<li class="settings-trash-entry">
      <span class="settings-trash-icon" data-tone="${info.tone}" aria-hidden="true">${icon(info.icon, 18)}</span>
      <div class="grow">
        <div class="settings-trash-title-row">
          <div class="ttl">${info.title}</div>
          <span class="settings-trash-badge" data-tone="${info.tone}">${info.badgeLabel}</span>
          ${info.recordCount > 1 ? h`<span class="settings-trash-extra">${info.recordCount} registros</span>` : ''}
        </div>
        <div class="settings-trash-meta">
          <span class="small muted">Excluído em ${shortDate(isoDay(entry.deletedAt))}</span>
          <span class="settings-trash-expiry${days <= 7 ? ' is-urgent' : ''}">${days} ${plural(days, 'dia restante', 'dias restantes')}</span>
        </div>
      </div>
      <div class="settings-trash-actions">
        <button type="button" class="btn sm" data-action="trash-restore" data-id="${entry.id}"
          aria-label="Restaurar ${info.title}">${icon('undo', 14)}Restaurar</button>
        <button type="button" class="ibtn settings-trash-delete" data-action="trash-delete-permanent"
          data-id="${entry.id}" aria-label="Excluir ${info.title} permanentemente"
          title="Excluir permanentemente">${icon('trash', 16)}</button>
      </div>
    </li>`;
  })}</ul>`;
}
function dataSettings(p) {
  const integritySlices = Object.keys(ui.integrityIssues);
  const trashEntries = sortTrashEntriesByExpiry(p.trash.filter((entry) => !isTrashExpired(entry)));
  const categoryCounts = new Map();
  trashEntries.forEach((entry) => {
    const category = trashEntryCategory(entry);
    categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
  });
  const activeFilter =
    ui.trashFilter !== 'all' && !categoryCounts.get(ui.trashFilter) ? 'all' : ui.trashFilter || 'all';
  if (activeFilter !== ui.trashFilter) ui.trashFilter = activeFilter;
  const visibleCategories = TRASH_CATEGORIES.filter(
    (category) => category.id === 'all' || (categoryCounts.get(category.id) || 0) > 0,
  );
  const filteredEntries = filterTrashEntries(trashEntries, { category: activeFilter, query: ui.trashQuery });
  const isFiltered = activeFilter !== 'all' || Boolean(ui.trashQuery.trim());
  const canUseCycle = canAccessCycle(S.settings.profile, ui.preview);
  const summaryStats = [
    ['Tarefas', S.tasks.length, 'calendarCheck', 'planning'],
    ['Hábitos', S.habits.length, 'check', 'habits'],
    ['Lançamentos', S.finance.tx.length, 'wallet', 'finances'],
    ...(canUseCycle ? [['Ciclo', S.cycle.length, 'heart', 'cycle']] : []),
    ['Na lixeira', trashEntries.length, 'trash', 'neutral'],
  ];
  return h`<section class="card settings-section-card settings-data-overview"
    aria-labelledby="settings-data-overview-title">
    <div class="settings-section-heading"><h2
      id="settings-data-overview-title">Gerenciar seus dados</h2><p>Veja o resumo dos registros da sua conta, recupere itens excluídos ou limpe os dados quando precisar.</p></div>
    <ul class="settings-data-summary" aria-label="Resumo dos registros na conta">${summaryStats.map(
      ([label, count, ic, tone]) =>
        h`<li class="settings-data-stat" data-tone="${tone}"><span class="settings-data-stat-icon" aria-hidden="true">${icon(ic, 16)}</span><div><b>${count}</b><span>${label}</span></div></li>`,
    )}</ul>
    ${
      integritySlices.length
        ? h`<div class="notice warn"
      role="alert"><span>Há dados com formato inválido em ${integritySlices.join(', ')}. Os dados originais foram preservados e não serão sobrescritos. Baixe uma cópia de recuperação antes de buscar ajuda.</span><button
      type="button" class="btn sm"
      data-action="recovery-export">${icon('download', 18)}Baixar cópia de recuperação</button></div>`
        : ''
    }
  </section>
    <section class="card settings-section-card settings-data-trash" aria-labelledby="trash-title">
      <div class="settings-section-heading settings-trash-header">
        <div><h2 id="trash-title" tabindex="-1">Lixeira <span
          class="settings-data-count">${trashEntries.length}</span></h2><p>Itens excluídos podem ser restaurados por até 30 dias. Os que vencem primeiro aparecem no topo.</p></div>
        ${
          trashEntries.length
            ? h`<div class="settings-trash-bulk">
              <button type="button" class="btn sm" data-action="trash-restore-all" ${filteredEntries.length ? '' : raw('disabled')}>${icon('undo', 15)}${isFiltered ? 'Restaurar filtrados' : 'Restaurar tudo'}</button>
              <button type="button" class="btn sm danger-outline" data-action="trash-empty" ${filteredEntries.length ? '' : raw('disabled')}>${icon('trash', 15)}${isFiltered ? 'Excluir filtrados' : 'Esvaziar lixeira'}</button>
            </div>`
            : ''
        }
      </div>
      ${
        trashEntries.length
          ? h`<div class="settings-trash-toolbar">
            ${
              visibleCategories.length > 2
                ? h`<div class="settings-trash-filters" role="group" aria-label="Filtrar lixeira por área">${visibleCategories.map(
                    (category) => {
                      const count = category.id === 'all' ? trashEntries.length : categoryCounts.get(category.id) || 0;
                      return h`<button type="button" class="chip trash-filter-pill" data-action="trash-filter"
                        data-trash-category="${category.id}" aria-pressed="${String(activeFilter === category.id)}">${category.label} <span
                        class="trash-filter-count">${count}</span></button>`;
                    },
                  )}</div>`
                : ''
            }
            <div class="settings-trash-search">
              <span class="settings-trash-search-icon" aria-hidden="true">${icon('search', 16)}</span>
              <input id="trash-search" type="search" data-input="trash-search" value="${ui.trashQuery}"
                placeholder="Buscar na lixeira…" aria-label="Buscar na lixeira" autocomplete="off">
              <button type="button" id="trash-search-clear" class="ibtn settings-trash-search-clear"
                data-action="trash-search-clear" aria-label="Limpar busca" ${ui.trashQuery.trim() ? '' : raw('hidden')}>${icon('close', 14)}</button>
            </div>
          </div>`
          : ''
      }
      <div id="trash-results">${trashResultsHtml(p)}</div>
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
