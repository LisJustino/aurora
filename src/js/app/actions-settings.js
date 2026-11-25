import { $ } from '../utils/dom.js';
import { routeFromLocation, routePathFor } from '../core/router.js';
import {
  normalizeProfileAppearance,
  PROFILE_APPEARANCE_DEFAULT,
  PROFILE_AVATAR_COLORS,
  PROFILE_AVATARS,
  PROFILE_GREETING_STYLES,
} from '../features/profile/model.js';
import { defaultHomeModes, HOME_BLOCK_IDS, HOME_MODES } from '../features/home/personalization.js';
import { APPEARANCE_PRESETS, LOOK_DEFAULT } from '../features/appearance/palettes.js';
import {
  defaultMenuPreferences,
  HIDDEN_MENU_IDS,
  isDefaultMenuPreferences,
  MENU_ITEMS,
  moveMenuItem,
} from '../features/navigation/menu.js';
import { saveActiveHomeMode } from './core.js';
import { requestActionConfirmation } from './dialogs.js';
import { cycleThemeMode, render, setActiveRouteLocationKey, setThemeMode } from './render.js';
import { toast } from './samples-backup.js';
import {
  adjustCurrentProfileAvatar,
  profileDraftFromSettings,
  profileDraftHasChanges,
  ROUTES,
  SETTINGS_SECTIONS,
} from './settings.js';
import { updateAccessibilityLook } from './shell.js';
import {
  normalizeSettings,
  S,
  sameJsonValue,
  scheduleProfileAutosave,
  settingsView,
  ui,
  updateSettingsDraft,
} from './state.js';

export const SETTINGS_ACTIONS = {
  'profile-avatar-choose': () => {
    if (!ui.profileImageBusy && !ui.profileSaving) $('#profile-avatar-file')?.click();
  },
  'profile-avatar-adjust': () => {
    if (!ui.profileImageBusy && !ui.profileSaving) void adjustCurrentProfileAvatar();
  },
  'profile-avatar-remove': () => {
    if (ui.profileImageBusy || ui.profileSaving) return;
    const draft = ui.profileDraft || profileDraftFromSettings(S.settings);
    const appearance = { ...draft.appearance };
    delete appearance.avatarImage;
    draft.appearance = normalizeProfileAppearance(appearance);
    ui.profileDraft = profileDraftHasChanges(draft, S.settings.profile, S.settings.prefs.profileAppearance)
      ? draft
      : null;
    render();
    scheduleProfileAutosave();
    toast('Foto removida. A alteração será salva automaticamente.', 'info');
  },
  'accessibility-mode': (el) => {
    setThemeMode(el.dataset.v);
    document.getElementById(el.id)?.focus();
  },
  'accessibility-contrast': (el) => updateAccessibilityLook({ contrast: !settingsView().look.contrast }, el.id),
  'accessibility-readable': (el) => updateAccessibilityLook({ readable: !settingsView().look.readable }, el.id),
  'accessibility-links': (el) =>
    updateAccessibilityLook({ highlightLinks: !settingsView().look.highlightLinks }, el.id),
  'accessibility-spacing': (el) =>
    updateAccessibilityLook({ density: settingsView().look.density === 'comfy' ? 'compact' : 'comfy' }, el.id),
  'accessibility-motion': (el) => updateAccessibilityLook({ reduceMotion: !settingsView().look.reduceMotion }, el.id),
  'settings-section': (el, event) => {
    const tab = el.dataset.settingsTab;
    if (!SETTINGS_SECTIONS.some(([id]) => id === tab)) return;
    event.preventDefault();
    ui.settingsTab = tab;
    const url = new URL(routePathFor(`config?section=${encodeURIComponent(tab)}`), location.origin);
    new URL(location.href).searchParams.forEach((value, key) => {
      if (key !== 'section' && key !== 'weight') url.searchParams.append(key, value);
    });
    url.hash = '';
    history.pushState(null, '', `${url.pathname}${url.search}`);
    const resolved = routeFromLocation(url, new Set(Object.keys(ROUTES)));
    setActiveRouteLocationKey(`${resolved.route}?${resolved.query}`);
    render();
    const selectedTab = $(`.settings-menu [data-settings-tab="${tab}"]`);
    selectedTab?.focus({ preventScroll: true });
    if (window.matchMedia('(max-width: 760px)').matches) {
      selectedTab?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  },
  'menu-move': (el) => {
    const direction = Number(el.dataset.direction);
    const id = el.dataset.menuId;
    if (![-1, 1].includes(direction) || !MENU_ITEMS.some((item) => item.id === id)) return;
    const current = settingsView().prefs.menuOrder;
    const order = moveMenuItem(current, id, direction, HIDDEN_MENU_IDS);
    if (order.every((item, index) => item === current[index])) return;
    updateSettingsDraft((settings) => {
      settings.prefs.menuOrder = order;
    });
    const focusDirection = direction < 0 ? 'down' : 'up';
    document.getElementById(`menu-move-${focusDirection}-${id}`)?.focus();
  },
  'menu-reset': () => {
    const defaults = defaultMenuPreferences();
    const currentSettings = settingsView();
    const current = {
      menuOrder: [...currentSettings.prefs.menuOrder],
      visibleMenuItems: [...currentSettings.prefs.visibleMenuItems],
    };
    if (isDefaultMenuPreferences(current)) return;
    if (ui.confirmedAction !== 'menu-reset')
      return requestActionConfirmation(
        'menu-reset',
        {},
        'Restaurar menus padrão?',
        'A ordem personalizada será substituída pela ordem inicial e todos os menus opcionais voltarão a ficar visíveis. A ativação das áreas e seus dados não serão alterados.',
        'Restaurar menus',
      );
    updateSettingsDraft((settings) => Object.assign(settings.prefs, defaults));
    document.querySelector('[data-settings-tab="areas-navigation"]')?.focus();
    toast('Padrão dos menus selecionado. Será salvo automaticamente.', 'info');
  },
  'home-block-move': (el) => {
    const id = el.dataset.homeBlock,
      direction = Number(el.dataset.direction);
    if (!HOME_BLOCK_IDS.includes(id) || id === 'today' || ![-1, 1].includes(direction)) return;
    const current = settingsView().prefs.homeLayout.order;
    const index = current.indexOf(id),
      target = index + direction;
    if (index < 1 || target < 1 || target >= current.length) return;
    const order = [...current];
    [order[index], order[target]] = [order[target], order[index]];
    updateSettingsDraft((settings) => {
      settings.prefs.homeLayout.order = order;
      saveActiveHomeMode(settings);
    });
  },
  'home-mode': (el) => {
    const mode = el.dataset.homeMode;
    if (!Object.hasOwn(HOME_MODES, mode) || mode === settingsView().prefs.homeMode) return;
    updateSettingsDraft((settings) => {
      settings.prefs.homeMode = mode;
      const saved = settings.prefs.homeModes[mode];
      settings.prefs.homeLayout = { order: [...saved.layout.order], visible: [...saved.layout.visible] };
    });
  },
  'home-layout-reset': () => {
    const mode = settingsView().prefs.homeMode;
    const defaults = defaultHomeModes()[mode];
    const prefs = settingsView().prefs;
    if (sameJsonValue(prefs.homeLayout, defaults.layout)) return;
    updateSettingsDraft((settings) => {
      settings.prefs.homeLayout = { order: [...defaults.layout.order], visible: [...defaults.layout.visible] };
      saveActiveHomeMode(settings);
    });
    toast('Modo inicial restaurado. Será salvo automaticamente.', 'success');
  },
  'set-theme': (el) =>
    updateSettingsDraft((settings) => {
      settings.theme = el.dataset.v;
    }),
  'appearance-preset': (el) => {
    const preset = APPEARANCE_PRESETS[el.dataset.v];
    if (!preset) return;
    updateSettingsDraft((settings) => {
      settings.theme = preset.theme;
      settings.look.density = preset.density;
      settings.look.font = preset.font;
    });
  },
  'profile-appearance': (el) => {
    if (ui.profileImageBusy || ui.profileSaving) return;
    const key = el.dataset.k,
      value = el.dataset.v;
    const validOptions =
      key === 'avatar'
        ? PROFILE_AVATARS
        : key === 'avatarColor'
          ? PROFILE_AVATAR_COLORS
          : key === 'greeting'
            ? PROFILE_GREETING_STYLES
            : [];
    if (!validOptions.some(([id]) => id === value)) return;
    const draft = ui.profileDraft || profileDraftFromSettings(S.settings);
    draft.appearance = normalizeProfileAppearance({ ...draft.appearance, [key]: value });
    ui.profileDraft = profileDraftHasChanges(draft, S.settings.profile, S.settings.prefs.profileAppearance)
      ? draft
      : null;
    render();
    scheduleProfileAutosave();
  },
  'profile-appearance-reset': () => {
    if (ui.profileImageBusy || ui.profileSaving) return;
    const draft = ui.profileDraft || profileDraftFromSettings(S.settings);
    if (sameJsonValue(draft.appearance, PROFILE_APPEARANCE_DEFAULT)) return;
    draft.appearance = { ...PROFILE_APPEARANCE_DEFAULT };
    ui.profileDraft = profileDraftHasChanges(draft, S.settings.profile, S.settings.prefs.profileAppearance)
      ? draft
      : null;
    render();
    scheduleProfileAutosave();
    toast('Identidade visual padrão selecionada. Será salva automaticamente.', 'info');
  },
  'preferences-week-start': (el) => {
    const weekStart = Number(el.dataset.v);
    if (![0, 1].includes(weekStart)) return;
    updateSettingsDraft((settings) => {
      settings.look.weekStart = weekStart;
    });
  },
  'appearance-reset': () => {
    if (ui.confirmedAction !== 'appearance-reset')
      return requestActionConfirmation(
        'appearance-reset',
        {},
        'Restaurar aparência padrão?',
        'Cores, tipografia, espaçamento e opções de acessibilidade voltarão aos valores padrão. O modo do tema escolhido no cabeçalho será mantido.',
        'Restaurar padrão',
      );
    updateSettingsDraft((settings) => {
      settings.theme = 'rose';
      settings.look = {
        ...settings.look,
        custom: LOOK_DEFAULT.custom,
        density: LOOK_DEFAULT.density,
        font: LOOK_DEFAULT.font,
        contrast: LOOK_DEFAULT.contrast,
        readable: LOOK_DEFAULT.readable,
        highlightLinks: LOOK_DEFAULT.highlightLinks,
        reduceMotion: LOOK_DEFAULT.reduceMotion,
      };
    });
    toast('Padrão visual selecionado. Será salvo automaticamente.', 'info');
  },
  look: (el) => {
    const k = el.dataset.k,
      v = k === 'weekStart' ? Number(el.dataset.v) : el.dataset.v;
    updateSettingsDraft((settings) => {
      settings.look = normalizeSettings({ look: { ...settings.look, [k]: v } }).look;
    });
  },
  'look-cycle': cycleThemeMode,
};
