import { ACTIONS } from './actions.js';
import { vibrateFeedback } from './shell.js';
import { ui } from './state.js';

const PULL_REFRESH_THRESHOLD = 80;
const PULL_REFRESH_MAX_OFFSET = 88;
const PULL_REFRESH_ACTIVATE_Y = 12;
let pullRefreshState = null;
let pullRefreshSettleTimer = 0;

function hasScrolledVerticalAncestor(target) {
  let node = target instanceof Element ? target : null;
  while (node && node !== document.body && node !== document.documentElement) {
    if (node.scrollTop > 0) {
      const overflowY = getComputedStyle(node).overflowY;
      if (overflowY === 'auto' || overflowY === 'scroll') return true;
    }
    node = node.parentElement;
  }
  return false;
}

function dampedPullOffset(deltaY) {
  if (deltaY <= 0) return 0;
  return PULL_REFRESH_MAX_OFFSET * (1 - Math.exp(-deltaY / 100));
}

function clearPullRefreshProps(app, indicator, { animate = false } = {}) {
  clearTimeout(pullRefreshSettleTimer);
  app.classList.remove('is-pulling-to-refresh', 'is-pull-refresh-ready', 'is-refreshing');
  if (animate) {
    app.classList.add('is-pull-settling');
    pullRefreshSettleTimer = setTimeout(() => {
      app.classList.remove('is-pull-settling');
    }, 280);
  } else {
    app.classList.remove('is-pull-settling');
  }
  app.style.removeProperty('--pull-refresh-offset');
  app.style.removeProperty('--pull-refresh-content-offset');
  app.style.removeProperty('--pull-refresh-rotation');
  app.style.removeProperty('--pull-refresh-progress');
  indicator.setAttribute('aria-hidden', 'true');
  const label = indicator.querySelector('.pull-refresh-label');
  if (label) label.textContent = '';
}

const resetPullRefresh = (animate = false) => {
  if (!pullRefreshState) return;
  const { app, indicator, engaged } = pullRefreshState;
  pullRefreshState = null;
  clearPullRefreshProps(app, indicator, { animate: animate && engaged });
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

// Depois de um swipe a linha ainda recebe um clique; este bloco o descarta e devolve true quando o descartou.
export function swallowSuppressedSwipeClick(e) {
  if (
    Date.now() < suppressSwipeClickUntil &&
    suppressSwipeClickRow instanceof Node &&
    suppressSwipeClickRow.contains(e.target)
  ) {
    suppressSwipeClickUntil = 0;
    suppressSwipeClickRow = null;
    e.preventDefault();
    e.stopImmediatePropagation();
    return true;
  }
  if (Date.now() >= suppressSwipeClickUntil) suppressSwipeClickRow = null;
  return false;
}

export function registerGestureEvents() {
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
        target.closest(
          'input, textarea, select, [contenteditable="true"], .habit-drag-handle, .habit-menu[open], .task-menu[open]',
        ) ||
        hasScrolledVerticalAncestor(target)
      )
        return;
      const app = document.querySelector('.app');
      const indicator = app?.querySelector('.pull-refresh-indicator');
      if (!app || !indicator) return;
      clearTimeout(pullRefreshSettleTimer);
      app.classList.remove('is-pull-settling');
      const touch = event.touches[0];
      pullRefreshState = {
        app,
        indicator,
        startX: touch.clientX,
        startY: touch.clientY,
        deltaY: 0,
        engaged: false,
        ready: false,
      };
    },
    { passive: true },
  );
  document.addEventListener(
    'touchmove',
    (event) => {
      if (!pullRefreshState) return;
      if (event.touches.length !== 1) {
        resetPullRefresh(true);
        return;
      }
      const touch = event.touches[0];
      const deltaX = touch.clientX - pullRefreshState.startX;
      const deltaY = touch.clientY - pullRefreshState.startY;
      if (deltaY <= 0 || window.scrollY > 0) {
        resetPullRefresh(true);
        return;
      }
      if (!pullRefreshState.engaged) {
        if (Math.abs(deltaX) > Math.max(10, deltaY * 0.75)) {
          resetPullRefresh(false);
          return;
        }
        if (deltaY < PULL_REFRESH_ACTIVATE_Y) return;
        pullRefreshState.engaged = true;
      }
      if (event.cancelable) event.preventDefault();
      pullRefreshState.deltaY = deltaY;
      const offset = dampedPullOffset(deltaY);
      const progress = Math.min(1, deltaY / PULL_REFRESH_THRESHOLD);
      const ready = deltaY >= PULL_REFRESH_THRESHOLD;
      if (ready && !pullRefreshState.ready) {
        vibrateFeedback('light');
      }
      pullRefreshState.ready = ready;
      pullRefreshState.app.classList.add('is-pulling-to-refresh');
      pullRefreshState.app.classList.toggle('is-pull-refresh-ready', ready);
      pullRefreshState.app.style.setProperty('--pull-refresh-offset', `${offset.toFixed(1)}px`);
      pullRefreshState.app.style.setProperty('--pull-refresh-content-offset', `${(offset * 0.85).toFixed(1)}px`);
      pullRefreshState.app.style.setProperty('--pull-refresh-rotation', `${Math.round(progress * 300)}deg`);
      pullRefreshState.app.style.setProperty('--pull-refresh-progress', `${Math.round(progress * 100)}%`);
      pullRefreshState.indicator.setAttribute('aria-hidden', 'false');
      pullRefreshState.indicator.querySelector('.pull-refresh-label').textContent = ready
        ? 'Solte para atualizar'
        : 'Continue puxando para atualizar';
    },
    { passive: false },
  );
  document.addEventListener(
    'touchend',
    (event) => {
      if (!pullRefreshState) return;
      if (event.touches.length !== 0) {
        resetPullRefresh(true);
        return;
      }
      const shouldRefresh = pullRefreshState.engaged && pullRefreshState.deltaY >= PULL_REFRESH_THRESHOLD;
      const wasEngaged = pullRefreshState.engaged;
      const { app, indicator } = pullRefreshState;
      if (wasEngaged) {
        suppressSwipeClickUntil = Date.now() + 350;
        suppressSwipeClickRow = app;
      }
      if (!shouldRefresh) {
        resetPullRefresh(true);
        return;
      }
      pullRefreshState = null;
      vibrateFeedback('success');
      app.classList.remove('is-pulling-to-refresh');
      app.classList.add('is-pull-settling', 'is-pull-refresh-ready', 'is-refreshing');
      app.style.setProperty('--pull-refresh-offset', '54px');
      app.style.setProperty('--pull-refresh-content-offset', '56px');
      app.style.setProperty('--pull-refresh-progress', '100%');
      indicator.setAttribute('aria-hidden', 'false');
      indicator.querySelector('.pull-refresh-label').textContent = 'Atualizando…';
      requestAnimationFrame(() => {
        ACTIONS['reload-app']();
        if (ui.dlg) {
          clearPullRefreshProps(app, indicator, { animate: true });
        }
      });
    },
    { passive: true },
  );
  document.addEventListener('touchcancel', () => resetPullRefresh(true), { passive: true });
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
    const habitSummary = event.target.closest('.habit-row .habit-main');
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
}
