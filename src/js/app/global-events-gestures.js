import { ACTIONS } from './actions.js';
import { ui } from './state.js';

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
}
