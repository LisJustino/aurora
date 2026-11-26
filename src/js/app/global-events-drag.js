import { $ } from '../utils/dom.js';
import { orderOf } from './core.js';
import { commit } from './persistence.js';
import { filteredTasks } from './planning.js';
import { findTask } from './samples-backup.js';
import { S, ui } from './state.js';

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

export function registerDragEvents() {
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
}
