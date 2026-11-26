import { commit } from './persistence.js';
import { S } from './state.js';

const EDGE = 72;
const SCROLL_STEP = 14;
let drag = null;

/** Posição de destino: quantas das outras linhas ficam acima do ponteiro. */
function targetIndex(clientY) {
  return drag.others.filter((row) => {
    const box = row.getBoundingClientRect();
    return box.top + box.height / 2 < clientY;
  }).length;
}

function markTarget(index) {
  drag.others.forEach((row, at) => {
    row.classList.toggle('is-drop-before', at === index && index < drag.others.length);
    row.classList.toggle('is-drop-after', index === drag.others.length && at === drag.others.length - 1);
  });
}

function finish(apply) {
  if (!drag) return;
  const { row, handle, id, target, pointerId } = drag;
  drag = null;
  row.classList.remove('is-dragging');
  row.style.transform = '';
  document.querySelectorAll('.is-drop-before, .is-drop-after').forEach((el) => {
    el.classList.remove('is-drop-before', 'is-drop-after');
  });
  try {
    handle.releasePointerCapture(pointerId);
  } catch {
    /* o ponteiro já foi liberado */
  }
  if (!apply) return;
  const active = S.habits.filter((habit) => habit.status !== 'archived');
  const moved = active.find((habit) => habit.id === id);
  if (!moved) return;
  const reordered = active.filter((habit) => habit !== moved);
  reordered.splice(target, 0, moved);
  if (reordered.every((habit, index) => habit === active[index])) return;
  let next = 0;
  S.habits = S.habits.map((habit) => (habit.status === 'archived' ? habit : reordered[next++]));
  commit('habits');
  requestAnimationFrame(() => document.querySelector(`.habit-drag-handle[data-id="${id}"]`)?.focus());
}

function autoScroll(clientY) {
  if (clientY < EDGE) window.scrollBy(0, -SCROLL_STEP);
  else if (clientY > window.innerHeight - EDGE) window.scrollBy(0, SCROLL_STEP);
}

export function registerHabitReorder() {
  document.addEventListener('pointerdown', (event) => {
    const handle = event.target instanceof Element ? event.target.closest('.habit-drag-handle') : null;
    if (!handle || (event.pointerType === 'mouse' && event.button !== 0)) return;
    const row = handle.closest('.habit-manage-row');
    if (!row) return;
    event.preventDefault();
    drag = {
      id: handle.dataset.id,
      handle,
      row,
      pointerId: event.pointerId,
      startY: event.clientY,
      others: [...row.parentElement.children].filter((item) => item !== row),
      target: [...row.parentElement.children].indexOf(row),
    };
    handle.setPointerCapture(event.pointerId);
    row.classList.add('is-dragging');
  });
  document.addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    event.preventDefault();
    autoScroll(event.clientY);
    drag.row.style.transform = `translateY(${event.clientY - drag.startY}px)`;
    drag.target = targetIndex(event.clientY);
    markTarget(drag.target);
  });
  document.addEventListener('pointerup', (event) => {
    if (drag && event.pointerId === drag.pointerId) finish(true);
  });
  document.addEventListener('pointercancel', (event) => {
    if (drag && event.pointerId === drag.pointerId) finish(false);
  });
}
