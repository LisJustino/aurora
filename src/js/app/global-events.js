import { $, $$ } from '../utils/dom.js';
import { formatMoneyInput, parseMoney } from '../utils/currency.js';
import { dk, longDate, today } from '../utils/dates.js';
import { linkedGoalProgressCents } from '../features/finance/calculations.js';
import { handlePublicKeydown } from '../features/appearance/public-controls.js';
import { filterWeightInput } from '../features/profile/weight.js';
import { HOME_MESSAGE_MAX_LENGTH } from '../features/home/personalization.js';
import { habitEntryOptions } from '../features/habits/model.js';
import { parseQuickDate } from '../features/planning/quick-date.js';
import { ACTIONS, focusQuickActionsTrigger } from './actions.js';
import { findBankByName, LIST_COLORS, orderOf, OTHER_BANK } from './core.js';
import {
  createDialog,
  dialogDraftSnapshot,
  dlgClose,
  dlgOpen,
  globalSearchResults,
  setPath,
  updateWaterSuggestionWeight,
} from './dialogs.js';
import { invoicePlanPreviewText, moneyIn } from './finance-dialogs.js';
import { impRecalc } from './finance-extras.js';
import { accById, txListHtml } from './finance-view.js';
import { CHANGES, FORMS, SETTINGS_INPUT_CHANGES } from './forms.js';
import { updateHabitIdeaFilters } from './habits.js';
import { listArr } from './onboarding.js';
import { commit, loadAccountData, Persist } from './persistence.js';
import { filteredTasks, taskListHtml, updateAnnualIdeaFilters } from './planning.js';
import { describeDialogOpener, render } from './render.js';
import { findTask } from './samples-backup.js';
import { applyProfileAvatarFile, firstName, profileDraftFromSettings, profileDraftHasChanges } from './settings.js';
import { profileGreeting } from './shell.js';
import { categoryMatch, S, scheduleProfileAutosave, syncState, ui } from './state.js';

// Relógio
let lastDay = today();
function renumberTasks() {
  [...S.tasks]
    .sort((a, b) => orderOf(a) - orderOf(b))
    .forEach((t, i) => {
      t.order = (i + 1) * 1000;
    });
}
export function moveTask(id, dir) {
  const list = filteredTasks().filter((t) => !t.done),
    i = list.findIndex((t) => t.id === id),
    j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  renumberTasks();
  const a = list[i],
    b = list[j],
    o = a.order;
  a.order = b.order;
  b.order = o;
  commit('tasks');
  requestAnimationFrame(() => {
    const el = $(`[data-action="${dir < 0 ? 'mv-up' : 'mv-down'}"][data-id="${id}"]`);
    if (el) el.focus();
  });
}
export function tick() {
  if (Persist.replacing) return;
  if (dk() !== lastDay) {
    lastDay = dk();
    render();
  }
}
const PULL_REFRESH_THRESHOLD = 80;
let pullRefreshState = null;
const resetPullRefresh = () => {
  if (!pullRefreshState) return;
  pullRefreshState.app.classList.remove('is-pulling-to-refresh');
  pullRefreshState.app.classList.remove('is-pull-refresh-ready');
  pullRefreshState.app.classList.remove('is-refreshing');
  pullRefreshState.app.style.removeProperty('--pull-refresh-offset');
  pullRefreshState.app.style.removeProperty('--pull-refresh-rotation');
  pullRefreshState.indicator.setAttribute('aria-hidden', 'true');
  pullRefreshState.indicator.querySelector('.pull-refresh-label').textContent = '';
  pullRefreshState = null;
};
let listSwipeState = null;
let suppressSwipeClickUntil = 0;
let suppressSwipeClickRow = null;
const resetListSwipeVisual = (state) => {
  if (!state?.row.isConnected) return;
  state.row.classList.remove('is-swiping', 'is-swipe-committing');
  delete state.row.dataset.swipeDirection;
  delete state.row.dataset.swipeLabel;
  state.row.style.removeProperty(state.kind === 'task' ? '--task-swipe-x' : '--swipe-x');
};
const resetListSwipe = (state) => resetListSwipeVisual(state);

export function registerGlobalEvents() {
  document.addEventListener('dragstart', (e) => {
    const li = e.target.closest && e.target.closest('.task[draggable]');
    if (li) {
      ui.dragId = li.dataset.k;
      try {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', li.dataset.k);
      } catch (x) {
        /* ok */
      }
    }
  });
  document.addEventListener('dragover', (e) => {
    if (ui.dragId && e.target.closest && e.target.closest('.task[draggable]')) e.preventDefault();
  });
  document.addEventListener('drop', (e) => {
    const li = e.target.closest && e.target.closest('.task[draggable]');
    if (!li || !ui.dragId) return;
    e.preventDefault();
    const d = findTask(ui.dragId),
      t = findTask(li.dataset.k);
    ui.dragId = null;
    if (!d || !t || d === t) return;
    renumberTasks();
    d.order = t.order - 500;
    commit('tasks');
  });
  document.addEventListener('dragend', () => {
    ui.dragId = null;
  });
  // Eventos globais
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState !== 'visible') return;
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
  document.addEventListener(
    'touchstart',
    (event) => {
      if (
        event.touches.length !== 1 ||
        window.scrollY > 0 ||
        !window.matchMedia('(max-width: 899px)').matches ||
        ui.dlg
      )
        return;
      const target = event.target instanceof Element ? event.target : null;
      if (
        !target?.closest('#main') ||
        target.closest('button, a[href], input, textarea, select, summary, [contenteditable="true"], [role="button"]')
      )
        return;
      const app = document.querySelector('.app');
      const indicator = app?.querySelector('.pull-refresh-indicator');
      if (!app || !indicator) return;
      const touch = event.touches[0];
      pullRefreshState = { app, indicator, startX: touch.clientX, startY: touch.clientY, deltaY: 0 };
    },
    { passive: true },
  );
  document.addEventListener(
    'touchmove',
    (event) => {
      if (!pullRefreshState) return;
      if (event.touches.length !== 1) {
        resetPullRefresh();
        return;
      }
      const touch = event.touches[0];
      const deltaX = touch.clientX - pullRefreshState.startX;
      const deltaY = touch.clientY - pullRefreshState.startY;
      if (deltaY <= 0 || Math.abs(deltaX) > deltaY || window.scrollY > 0) {
        resetPullRefresh();
        return;
      }
      if (deltaY < 10) return;
      if (event.cancelable) event.preventDefault();
      pullRefreshState.deltaY = deltaY;
      pullRefreshState.app.classList.add('is-pulling-to-refresh');
      pullRefreshState.app.style.setProperty('--pull-refresh-offset', `${Math.min(70, deltaY * 0.55)}px`);
      pullRefreshState.app.style.setProperty('--pull-refresh-rotation', `${Math.min(180, deltaY * 2)}deg`);
      pullRefreshState.app.classList.toggle('is-pull-refresh-ready', deltaY >= PULL_REFRESH_THRESHOLD);
      pullRefreshState.indicator.setAttribute('aria-hidden', 'false');
      pullRefreshState.indicator.querySelector('.pull-refresh-label').textContent =
        deltaY >= PULL_REFRESH_THRESHOLD ? 'Solte para atualizar' : 'Continue puxando para atualizar';
    },
    { passive: false },
  );
  document.addEventListener(
    'touchend',
    (event) => {
      if (!pullRefreshState) return;
      if (event.touches.length !== 0) {
        resetPullRefresh();
        return;
      }
      const shouldRefresh = pullRefreshState.deltaY >= PULL_REFRESH_THRESHOLD;
      const { app, indicator } = pullRefreshState;
      resetPullRefresh();
      if (shouldRefresh) {
        app.classList.add('is-pulling-to-refresh', 'is-pull-refresh-ready', 'is-refreshing');
        app.style.setProperty('--pull-refresh-offset', '56px');
        indicator.setAttribute('aria-hidden', 'false');
        indicator.querySelector('.pull-refresh-label').textContent = 'Atualizando…';
        requestAnimationFrame(() => {
          ACTIONS['reload-app']();
          if (ui.dlg) {
            app.classList.remove('is-pulling-to-refresh', 'is-pull-refresh-ready', 'is-refreshing');
            app.style.removeProperty('--pull-refresh-offset');
            indicator.setAttribute('aria-hidden', 'true');
            indicator.querySelector('.pull-refresh-label').textContent = '';
          }
        });
      }
    },
    { passive: true },
  );
  document.addEventListener('touchcancel', resetPullRefresh, { passive: true });
  document.addEventListener('pointerdown', (event) => {
    if (suppressSwipeClickRow) {
      suppressSwipeClickUntil = 0;
      suppressSwipeClickRow = null;
    }
    if (!event.isPrimary || event.pointerType !== 'touch' || !(event.target instanceof Element)) return;
    const taskTitle = event.target.closest('.task .tt');
    const task = taskTitle?.closest('.task');
    if (task && !task.classList.contains('done')) {
      listSwipeState = {
        kind: 'task',
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        deltaX: 0,
        moved: false,
        row: task,
        id: task.dataset.k,
      };
      return;
    }
    const habitSummary = event.target.closest('.habit-more > summary');
    const habit = habitSummary?.closest('.habit-row');
    if (habit && habit.querySelector('.habit-circle:not(:disabled)')) {
      listSwipeState = {
        kind: 'habit',
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        deltaX: 0,
        moved: false,
        row: habit,
        id: habit.dataset.habitId,
      };
      return;
    }
    const financeMain = event.target.closest('.fr-main');
    const transaction = financeMain?.closest('.fr');
    if (transaction) {
      listSwipeState = {
        kind: 'finance',
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        deltaX: 0,
        moved: false,
        row: transaction,
        id: transaction.dataset.k,
      };
    }
  });
  document.addEventListener(
    'pointermove',
    (event) => {
      if (listSwipeState?.pointerId !== event.pointerId) return;
      const state = listSwipeState;
      const deltaX = event.clientX - state.startX;
      const deltaY = event.clientY - state.startY;
      if (Math.abs(deltaY) > 16 && Math.abs(deltaY) > Math.abs(deltaX)) {
        resetListSwipe(state);
        listSwipeState = null;
        return;
      }
      if (Math.abs(deltaX) < 10 || Math.abs(deltaX) <= Math.abs(deltaY)) return;
      const row = state.row;
      let action = '',
        direction = '',
        label = '';
      if (state.kind === 'task') {
        action = deltaX < 0 ? 'toggle' : 'task-swipe-defer';
        direction = deltaX < 0 ? 'complete' : 'defer';
        label = deltaX < 0 ? 'Concluir' : 'Adiar';
      } else if (state.kind === 'habit') {
        const completed = row.classList.contains('is-done');
        if (deltaX < 0 && !completed) {
          action = 'habit-check';
          direction = 'complete';
          label = 'Marcar como feito';
        } else if (deltaX > 0 && completed) {
          action = 'habit-check';
          direction = 'undo';
          label = 'Desmarcar';
        }
      } else if (state.kind === 'finance' && deltaX < 0) {
        action = 'tx-swipe-delete';
        direction = 'delete';
        label = 'Excluir';
      }
      if (!action) {
        resetListSwipeVisual(state);
        state.action = '';
        state.deltaX = 0;
        state.moved = false;
        return;
      }
      state.action = action;
      state.deltaX = deltaX;
      state.moved = true;
      row.classList.add('is-swiping');
      row.dataset.swipeDirection = direction;
      row.dataset.swipeLabel = label;
      row.style.setProperty(
        state.kind === 'task' ? '--task-swipe-x' : '--swipe-x',
        `${Math.max(-120, Math.min(120, deltaX))}px`,
      );
      event.preventDefault();
    },
    { passive: false },
  );
  document.addEventListener('pointerup', (event) => {
    if (listSwipeState?.pointerId !== event.pointerId) return;
    const state = listSwipeState;
    listSwipeState = null;
    if (!state.row.isConnected || !state.moved || !state.action || Math.abs(state.deltaX) < 84) {
      resetListSwipe(state);
      return;
    }
    state.row.classList.remove('is-swiping');
    state.row.classList.add('is-swipe-committing');
    state.row.style.setProperty(
      state.kind === 'task' ? '--task-swipe-x' : '--swipe-x',
      `${state.deltaX < 0 ? '-120vw' : '120vw'}`,
    );
    suppressSwipeClickUntil = Date.now() + 500;
    suppressSwipeClickRow = state.row;
    setTimeout(() => {
      ACTIONS[state.action]({ dataset: { id: state.id } });
    }, 170);
  });
  document.addEventListener('pointercancel', (event) => {
    if (listSwipeState?.pointerId === event.pointerId) {
      resetListSwipe(listSwipeState);
      listSwipeState = null;
    }
  });
  document.addEventListener('click', (e) => {
    if (
      Date.now() < suppressSwipeClickUntil &&
      suppressSwipeClickRow instanceof Node &&
      suppressSwipeClickRow.contains(e.target)
    ) {
      suppressSwipeClickUntil = 0;
      suppressSwipeClickRow = null;
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }
    if (Date.now() >= suppressSwipeClickUntil) suppressSwipeClickRow = null;
    const el = e.target.closest('[data-action]');
    if (!el || el.disabled) return;
    if (ui.legacyImport.busy) return;
    const focusBeforeAction = !ui.dlg ? describeDialogOpener(el) : null;
    if (focusBeforeAction) ui.lastFocus = focusBeforeAction;
    const taskToPop =
      el.dataset.action === 'toggle' && el.getAttribute('aria-checked') !== 'true' ? el.dataset.id : null;
    const activeDialog = ui.dlg;
    const previousDraft = activeDialog?.d ? dialogDraftSnapshot(activeDialog.d) : null;
    const fn = ACTIONS[el.dataset.action];
    if (fn) fn(el, e);
    if (!ui.dlg) ui.lastFocus = null;
    if (
      activeDialog &&
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
    if (!menu || !(e.target instanceof Node) || menu.contains(e.target) || panel?.contains(e.target)) return;
    menu.open = false;
  });
  document.addEventListener('submit', (e) => {
    const f = e.target.closest('[data-form]');
    if (!f) return;
    e.preventDefault();
    const fn = FORMS[f.dataset.form];
    if (fn) fn(f, new FormData(f));
  });
  document.addEventListener('input', (e) => {
    const el = e.target;
    if (el.matches('[data-change="home-message"]')) {
      const counter = $('#home-message-count');
      if (counter) counter.textContent = `${el.value.length}/${HOME_MESSAGE_MAX_LENGTH}`;
    }
    if (el instanceof HTMLInputElement && el.matches('.money-input')) {
      const formattedValue = formatMoneyInput(el.value);
      if (formattedValue !== el.value) {
        el.value = formattedValue;
        el.setSelectionRange(formattedValue.length, formattedValue.length);
      }
    }
    if (el.matches('[data-dlg="waterWeightKg"]')) {
      const value = el.value;
      const cursor = el.selectionStart;
      const filteredValue = filterWeightInput(value);
      if (filteredValue !== value) {
        el.value = filteredValue;
        if (cursor !== null) {
          const filteredCursor = filterWeightInput(value.slice(0, cursor)).length;
          el.setSelectionRange(filteredCursor, filteredCursor);
        }
      }
    }
    if (el.matches('[data-dlg="log.weightKg"], [data-dlg="weightKg"]')) {
      const value = el.value;
      const cursor = el.selectionStart;
      const filteredValue = filterWeightInput(value);
      if (filteredValue !== value) {
        el.value = filteredValue;
        if (cursor !== null) {
          const filteredCursor = filterWeightInput(value.slice(0, cursor)).length;
          el.setSelectionRange(filteredCursor, filteredCursor);
        }
      }
    }
    if (el.matches('[data-dlg="entryOptions"]') && ui.dlg?.d) {
      ui.dlg.d.entryOptions = el.value
        .split('\n')
        .map((option) => option.trim())
        .filter(Boolean);
    }
    const changeKey = el.dataset && el.dataset.change;
    if (SETTINGS_INPUT_CHANGES.has(changeKey) && CHANGES[changeKey]) CHANGES[changeKey](el);
    const isTransactionCategoryField = ui.dlg?.type === 'tx' && ['category', 'subcategory'].includes(el.dataset?.dlg);
    const opensCategoryDialog = isTransactionCategoryField && el.value === '__new';
    if (isTransactionCategoryField && !opensCategoryDialog) ui.dlg.d.categoryTouched = true;
    if (
      ui.dlg &&
      ui.dlg.type !== 'search' &&
      !opensCategoryDialog &&
      el instanceof Element &&
      el.closest('#dlg') &&
      el.matches('input:not([type="file"]),textarea,select')
    )
      ui.dlg.dirty = true;
    if (el.dataset.profileField && ['name', 'preferredName', 'sex', 'age'].includes(el.dataset.profileField)) {
      const preferredInput = $('#ppreferred');
      if (el.dataset.profileField === 'name' && preferredInput && !preferredInput.value.trim()) {
        preferredInput.value = firstName(el.value || '');
      }
      const draft = {
        name: $('#pname')?.value || '',
        preferredName: preferredInput?.value || '',
        sex: $('#psex')?.value || '',
        age: $('#page')?.value || '',
        appearance: ui.profileDraft?.appearance || profileDraftFromSettings(S.settings).appearance,
      };
      ui.profileDraft = profileDraftHasChanges(draft, S.settings.profile, S.settings.prefs.profileAppearance)
        ? draft
        : null;
      scheduleProfileAutosave();
      const previewName = $('#profile-preview-name');
      if (previewName) previewName.textContent = draft.preferredName.trim() || draft.name.trim() || 'seu nome';
      const previewGreeting = $('#profile-preview-greeting');
      if (previewGreeting) previewGreeting.textContent = profileGreeting(draft.appearance.greeting);
    }
    if (el.dataset.dlg && ui.dlg) {
      if (ui.dlg.type === 'tx' && opensCategoryDialog) {
        const kind = ui.dlg.d.kind === 'in' ? 'in' : 'out';
        const selectedParent =
          el.dataset.dlg === 'subcategory' ? categoryMatch(kind, ui.dlg.d.category)?.category : null;
        ui.categoryReturnDialog = ui.dlg;
        ui.dlg = createDialog('category-new', {
          kind,
          ...(selectedParent ? { parent: selectedParent.name } : {}),
          name: '',
          icon: selectedParent?.icon || 'tag',
          color: selectedParent?.color || LIST_COLORS[listArr(kind).length % LIST_COLORS.length],
          fromTransaction: true,
        });
        render();
        return;
      }
      if (ui.dlg.type === 'tx' && el.dataset.dlg === 'subcategory') {
        const kind = ui.dlg.d.kind === 'in' ? 'in' : 'out';
        const parentName = categoryMatch(kind, ui.dlg.d.category)?.category.name || ui.dlg.d.category;
        ui.dlg.d.category = el.value ? `${parentName} > ${el.value}` : parentName;
        ui.dlg.d.dirty = true;
        render();
        return;
      }
      if (ui.dlg.type === 'habit-edit' && ui.dlg.d.waterSuggestion && el.dataset.dlg === 'waterGoalMl') {
        ui.dlg.d.waterGoalEdited = true;
      }
      if (
        ui.dlg.type === 'goal' &&
        el.dataset.dlg === 'linkedAccountId' &&
        ui.dlg.d.linkedAccountId &&
        ui.dlg.d.linkedAccountId !== el.value
      ) {
        const previousAccount = accById(ui.dlg.d.linkedAccountId);
        if (previousAccount) {
          const previousProgress = linkedGoalProgressCents(
            {
              linkedAccountId: previousAccount.id,
              savedCents: parseMoney(ui.dlg.d.saved) || 0,
            },
            S.finance.accounts,
            S.finance.tx,
          );
          ui.dlg.d.saved = moneyIn(previousProgress);
        }
      }
      if (ui.dlg.type === 'account' && el.dataset.dlg === 'bankOption') {
        const bankInput = $('#dlg [data-dlg="bank"]');
        ui.dlg.d.bank = el.value === OTHER_BANK ? OTHER_BANK : el.value;
        if (bankInput instanceof HTMLInputElement) {
          bankInput.closest('.bank-custom-entry').hidden = el.value !== OTHER_BANK;
          bankInput.required = el.value === OTHER_BANK;
          if (el.value !== OTHER_BANK) bankInput.value = '';
        }
        const bank = findBankByName(el.value);
        const logo = $('#dlg [data-bank-preview-logo]');
        const fallback = $('#dlg [data-bank-preview-fallback]');
        if (logo && fallback) {
          if (bank) logo.querySelector('img').src = bank[1].logo;
          logo.hidden = !bank;
          fallback.hidden = Boolean(bank);
        }
        return;
      }
      setPath(ui.dlg.d, el.dataset.dlg, el.type === 'checkbox' ? el.checked : el.value);
      if (ui.dlg.type === 'account' && el.dataset.dlg === 'bank') {
        const bank = findBankByName(el.value, true);
        const logo = $('#dlg [data-bank-preview-logo]');
        const fallback = $('#dlg [data-bank-preview-fallback]');
        if (logo && fallback) {
          if (bank) logo.querySelector('img').src = bank[1].logo;
          logo.hidden = !bank;
          fallback.hidden = Boolean(bank);
        }
      }
      if (ui.dlg.type === 'payinv' && ['amount', 'times', 'interest'].includes(el.dataset.dlg)) {
        const preview = $('#dlg [data-pay-invoice-preview]');
        if (preview) preview.textContent = invoicePlanPreviewText(ui.dlg.d);
      }
      if (ui.dlg.type === 'habit-edit' && ui.dlg.d.waterSuggestion && el.dataset.dlg === 'waterWeightKg') {
        updateWaterSuggestionWeight(el.value);
      } else if (ui.dlg.type === 'search' && el.dataset.dlg === 'query') {
        const results = $('#global-search-results');
        if (results) results.innerHTML = globalSearchResults(el.value).s;
      } else if (ui.dlg.type === 'cycle-log' && el.dataset.dlg === 'log.sexualActivity') {
        if (!el.checked) ui.dlg.d.log.contraceptionMethods = [];
        render();
      } else if (ui.dlg.type === 'category-new' && el.dataset.dlg === 'parent') {
        render();
      } else if (
        [
          'sex',
          'accountId',
          'linkedAccountId',
          'repeat',
          'installmentAmountMode',
          'mode',
          'type',
          'tag',
          'category',
          'time',
          'invert',
          'paid',
        ].includes(el.dataset.dlg) ||
        el.dataset.dlg.startsWith('rows.')
      ) {
        if (ui.dlg.type === 'impfin' && (el.dataset.dlg === 'accountId' || el.dataset.dlg === 'invert'))
          impRecalc(ui.dlg.d, el.dataset.dlg === 'invert');
        render();
      }
    }
    if (el.id === 'home-quick-title-input') {
      const date = parseQuickDate(el.value, today());
      const preview = $('#home-quick-date-preview');
      if (preview)
        preview.textContent =
          date.error || `${date.date === today() ? 'Hoje' : longDate(date.date)}${date.time ? ` · ${date.time}` : ''}`;
      const submit = el.form?.querySelector('button[type="submit"]');
      if (submit) submit.disabled = !el.value.trim();
    }
    if (el.dataset.input === 'fin-search') {
      ui.finQ = el.value;
      const r = $('#tx-results');
      if (r) r.innerHTML = txListHtml().s;
    }
    if (el.dataset.input === 'search') {
      ui.filters.q = el.value;
      const r = $('#task-results');
      if (r) r.innerHTML = taskListHtml().s;
    }
    if (el.dataset.input === 'habit-ideas-search') {
      ui.habitIdeaQuery = el.value;
      updateHabitIdeaFilters();
    }
    if (el.dataset.input === 'annual-ideas-search') {
      ui.annualIdeaQuery = el.value;
      updateAnnualIdeaFilters();
    }
  });
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
      ui.dlg &&
      ui.dlg.type !== 'search' &&
      el instanceof Element &&
      el.closest('#dlg') &&
      el.matches('input:not([type="file"]),textarea,select')
    )
      ui.dlg.dirty = true;
    if (el.dataset && el.dataset.dlg === 'bank' && ui.dlg) setPath(ui.dlg.d, 'bank', el.value);
    if (ui.dlg?.type === 'tx' && el.dataset?.dlg === 'date' && el.value !== today()) {
      ui.dlg.d.paid = false;
      ui.dlg.d.settledDate = '';
      render();
      return;
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
      const profileMenu = document.querySelector('.profile-menu-control[open], .header-account-control[open]');
      if (profileMenu) {
        e.preventDefault();
        profileMenu.open = false;
        profileMenu.querySelector('summary')?.focus();
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
