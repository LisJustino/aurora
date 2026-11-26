import { $$ } from '../utils/dom.js';
import { dk, today } from '../utils/dates.js';
import { handlePublicKeydown } from '../features/appearance/public-controls.js';
import { habitEntryOptions } from '../features/habits/model.js';
import { ACTIONS, focusQuickActionsTrigger } from './actions.js';
import { dialogDraftSnapshot, dialogTracksDirty, dlgClose, dlgOpen, setPath } from './dialogs.js';
import { CHANGES, FORMS, SETTINGS_INPUT_CHANGES } from './forms.js';
import { loadAccountData, Persist } from './persistence.js';
import { describeDialogOpener, render } from './render.js';
import { applyProfileAvatarFile } from './settings.js';
import { syncState, ui } from './state.js';
import { registerDragEvents } from './global-events-drag.js';
import { registerHabitReorder } from './habit-reorder.js';
import { registerGestureEvents, swallowSuppressedSwipeClick } from './global-events-gestures.js';
import { registerInputEvents } from './global-events-input.js';

// Relógio
let lastDay = today();
export function tick() {
  if (Persist.replacing) return;
  if (dk() !== lastDay) {
    lastDay = dk();
    render();
  }
}

export function registerGlobalEvents() {
  registerDragEvents();
  registerHabitReorder();
  // Eventos globais
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState !== 'visible') return;
    if (Persist.store && Persist.pendingSnapshot && !Persist.inFlight && navigator.onLine !== false) {
      void Persist.flush();
      return;
    }
    if (
      !Persist.store ||
      Persist.inFlight ||
      Persist.pendingSnapshot ||
      syncState.pending.size ||
      ui.persistFailed.size ||
      Object.keys(ui.integrityIssues).length
    ) {
      return;
    }
    try {
      await loadAccountData();
      render();
    } catch (error) {
      console.error('Aurora: a conta foi recarregada em segundo plano e falhou.', error);
    }
  });
  registerGestureEvents();
  document.addEventListener('click', (e) => {
    if (swallowSuppressedSwipeClick(e)) return;
    const el = e.target.closest('[data-action]');
    if (!el || el.disabled) return;
    if (ui.legacyImport.busy) return;
    const focusBeforeAction = !ui.dlg ? describeDialogOpener(el, { viaPointer: e.detail > 0 }) : null;
    if (focusBeforeAction) ui.lastFocus = focusBeforeAction;
    const taskToPop =
      el.dataset.action === 'toggle' && el.getAttribute('aria-checked') !== 'true' ? el.dataset.id : null;
    const activeDialog = ui.dlg;
    const previousDraft = activeDialog?.d ? dialogDraftSnapshot(activeDialog.d) : null;
    const fn = ACTIONS[el.dataset.action];
    if (fn) fn(el, e);
    if (!ui.dlg) ui.lastFocus = null;
    if (
      dialogTracksDirty(activeDialog) &&
      ui.dlg === activeDialog &&
      previousDraft !== null &&
      previousDraft !== dialogDraftSnapshot(activeDialog.d)
    )
      activeDialog.dirty = true;
    if (taskToPop)
      document.querySelectorAll('.chk[data-action="toggle"]').forEach((button) => {
        if (button.dataset.id === taskToPop) button.classList.add('pop');
      });
  });
  document.addEventListener('click', (e) => {
    const target = e.target;
    if (
      !ui.quickActionsOpen ||
      !(target instanceof Element) ||
      target.closest('#quick-actions-menu, .nav-quick-trigger')
    )
      return;
    ui.quickActionsOpen = false;
    render();
  });
  document.addEventListener('click', (e) => {
    const accountMenu = document.querySelector('.header-account-control[open]');
    if (
      accountMenu &&
      e.target instanceof Node &&
      (!accountMenu.contains(e.target) ||
        (e.target instanceof Element && e.target.closest('.header-account-panel a, .header-account-panel button')))
    )
      accountMenu.open = false;
    const clickedTrigger = e.target instanceof Element ? e.target.closest('.profile-menu-trigger') : null;
    if (clickedTrigger) {
      const clickedMenu = clickedTrigger.closest('.profile-menu-control');
      document.querySelectorAll('.profile-menu-control[open]').forEach((openMenu) => {
        if (openMenu !== clickedMenu) openMenu.open = false;
      });
    }
    const menu = document.querySelector('.profile-menu-control[open]');
    const panel = document.querySelector('.topbar > .profile-menu-panel');
    if (menu && e.target instanceof Node && !menu.contains(e.target) && !panel?.contains(e.target)) {
      menu.open = false;
    }
    const clickedHabitMenu = e.target instanceof Element ? e.target.closest('.habit-menu') : null;
    const clickedHabitItem = e.target instanceof Element ? e.target.closest('.habit-menu-panel button') : null;
    document.querySelectorAll('.habit-menu[open]').forEach((openMenu) => {
      if (openMenu !== clickedHabitMenu || clickedHabitItem) openMenu.open = false;
    });
    const clickedTaskMenu = e.target instanceof Element ? e.target.closest('.task-menu') : null;
    const clickedTaskItem = e.target instanceof Element ? e.target.closest('.task-menu-panel button') : null;
    document.querySelectorAll('.task-menu[open]').forEach((openMenu) => {
      if (openMenu !== clickedTaskMenu || clickedTaskItem) openMenu.open = false;
    });
    if (ui.settingsMenuOpen && (!(e.target instanceof Element) || !e.target.closest('.settings-nav-shell'))) {
      ui.settingsMenuOpen = false;
      render();
    }
  });
  document.addEventListener('submit', (e) => {
    const f = e.target.closest('[data-form]');
    if (!f) return;
    e.preventDefault();
    const fn = FORMS[f.dataset.form];
    if (fn) fn(f, new FormData(f));
  });
  registerInputEvents();
  document.addEventListener('focusin', (e) => {
    const el = e.target;
    if (el instanceof HTMLInputElement && el.matches('.money-input') && el.value === '00,00') {
      el.select();
    }
  });
  document.addEventListener('change', (e) => {
    const el = e.target,
      key = el.dataset && el.dataset.change;
    if (el.matches('[data-dlg="entryType"]') && ui.dlg?.d) {
      ui.dlg.d.entryType = el.value;
      ui.dlg.d.entryOptions = habitEntryOptions({ entryOptions: ui.dlg.d.entryOptions });
      render();
      return;
    }
    if (el instanceof HTMLInputElement && el.matches('[data-profile-avatar-file]')) {
      const file = el.files?.[0] || null;
      el.value = '';
      if (file) void applyProfileAvatarFile(file);
      return;
    }
    if (
      dialogTracksDirty(ui.dlg) &&
      el instanceof Element &&
      el.closest('#dlg') &&
      el.matches('input:not([type="file"]),textarea,select')
    )
      ui.dlg.dirty = true;
    if (el.dataset?.dlg && ui.dlg) {
      const dlgKey = el.dataset.dlg;
      if (
        !['entryType', 'entryOptions', 'bankOption', 'category', 'subcategory'].includes(dlgKey) &&
        !(ui.dlg.type === 'tx' && dlgKey === 'date')
      ) {
        setPath(ui.dlg.d, dlgKey, el.type === 'checkbox' ? el.checked : el.value);
      }
    }
    if (ui.dlg?.type === 'tx' && el.dataset?.dlg === 'date' && el.value > today()) {
      ui.dlg.d.date = el.value;
      ui.dlg.d.paid = false;
      ui.dlg.d.settledDate = '';
      render();
      return;
    }
    if (ui.dlg?.type === 'tx' && el.dataset?.dlg === 'date') {
      ui.dlg.d.date = el.value;
    }
    const fn = key && !SETTINGS_INPUT_CHANGES.has(key) && CHANGES[key];
    if (fn) fn(el);
  });
  document.addEventListener(
    'toggle',
    (e) => {
      const el = e.target;
      if (el.matches?.('.cycle-symptom-group') && ui.dlg?.type === 'cycle-log') {
        const openGroups = new Set(ui.dlg.d.openGroups || []);
        const closedGroups = new Set(ui.dlg.d.closedGroups || []);
        if (el.open) {
          openGroups.add(el.dataset.category);
          closedGroups.delete(el.dataset.category);
        } else {
          openGroups.delete(el.dataset.category);
          closedGroups.add(el.dataset.category);
        }
        ui.dlg.d.openGroups = [...openGroups];
        ui.dlg.d.closedGroups = [...closedGroups];
      }
      if (el.tagName === 'DETAILS' && el.id) {
        ui.openDetails[el.id.replace('d-', '')] = el.open;
        if (el.open)
          el.querySelectorAll('.habit-year-grid').forEach((grid) => {
            grid.scrollLeft = grid.scrollWidth;
          });
      }
    },
    true,
  );
  document.addEventListener('keydown', (e) => {
    if (handlePublicKeydown(e)) return;
    const tab = e.target instanceof Element ? e.target.closest('[role="tab"]') : null;
    if (tab && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
      const list = tab.closest('[role="tablist"]');
      const tabs = list ? [...list.querySelectorAll('[role="tab"]:not([disabled])')] : [];
      const index = tabs.indexOf(tab);
      if (index >= 0) {
        e.preventDefault();
        const next =
          e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? tabs.length - 1
              : (index + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
        const target = tabs[next];
        const id = target.id;
        target.click();
        requestAnimationFrame(() => document.getElementById(id)?.focus());
        return;
      }
    }
    const searchShortcut = (e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k';
    const editable =
      e.target instanceof Element &&
      (e.target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])') ||
        e.target.isContentEditable);
    const slashShortcut = e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey && !editable;
    if (!e.isComposing && !ui.dlg && (searchShortcut || slashShortcut)) {
      e.preventDefault();
      dlgOpen('search', { query: '' });
      return;
    }
    if (e.key === 'Escape') {
      if (ui.settingsMenuOpen) {
        e.preventDefault();
        ui.settingsMenuOpen = false;
        render();
        requestAnimationFrame(() => document.querySelector('.settings-mobile-trigger')?.focus());
        return;
      }
      const openMenu = document.querySelector(
        '.profile-menu-control[open], .header-account-control[open], .habit-menu[open], .task-menu[open]',
      );
      if (openMenu) {
        e.preventDefault();
        openMenu.open = false;
        openMenu.querySelector('summary')?.focus();
        return;
      }
    }
    if (e.key === 'Escape' && ui.quickActionsOpen) {
      e.preventDefault();
      ui.quickActionsOpen = false;
      render();
      requestAnimationFrame(() => {
        focusQuickActionsTrigger();
      });
      return;
    }
    if (!ui.dlg) return;
    if (ui.dlg.type === 'tx') {
      if (e.key === 'Escape') {
        e.preventDefault();
        dlgClose();
      }
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      if (ui.lastFocus) ui.lastFocus.viaPointer = false;
      dlgClose();
      return;
    }
    if (e.key === 'Tab') {
      const f = $$('#dlg button,#dlg input:not(.sr),#dlg select,#dlg textarea,#dlg a[href]').filter((x) => !x.disabled);
      if (!f.length) return;
      const a = f[0],
        z = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) {
        e.preventDefault();
        z.focus();
      } else if (!e.shiftKey && document.activeElement === z) {
        e.preventDefault();
        a.focus();
      }
    }
  });
  document.addEventListener('mousedown', (e) => {
    if (e.target.id === 'dlg' && ui.dlg) dlgClose();
  });
}
