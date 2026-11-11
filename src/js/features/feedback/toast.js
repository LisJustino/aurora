import { h } from '../../utils/dom.js';
import { icon } from '../../utils/icons.js';

const TONES = new Set(['action', 'error', 'info', 'success', 'warning']);

export function createToastController({ readToast, writeToast, getContext, getOverride, normalizeMessage }) {
  let timeoutId = null;
  let expiresAt = 0;
  let duration = 0;

  function render() {
    let element = document.getElementById('toast');
    const toast = readToast();
    if (!toast) {
      element?.remove();
      return;
    }
    if (!element) {
      element = document.createElement('div');
      element.id = 'toast';
      element.className = 'toast';
      document.body.appendChild(element);
    }
    const icons = { success: 'check', warning: 'alert', error: 'alert', action: 'repeat', info: 'info' };
    const context = getContext();
    element.className = `toast toast-${toast.tone}${context.top ? ' toast-top' : ''}`;
    element.setAttribute('role', toast.tone === 'error' ? 'alert' : 'status');
    const message = typeof toast.msg === 'string' ? normalizeMessage(toast.msg) : toast.msg;
    element.innerHTML = h`<span class="toast-icon" aria-hidden="true">${icon(icons[toast.tone], 18)}</span><span class="toast-content"><span class="toast-message">${message}</span>${toast.details ? h`<details><summary>Ver detalhes</summary><span>${toast.details}</span></details>` : ''}</span>${toast.undo ? h`<button data-action="undo">Desfazer</button>` : ''}<i class="toast-timer" aria-hidden="true"></i>`.s;
    const timer = element.querySelector('.toast-timer');
    timer.hidden = !expiresAt;
    timer.style.animationDuration = `${duration}ms`;
    timer.style.animationDelay = `${Math.min(0, expiresAt - Date.now() - duration)}ms`;
    element.querySelector('details')?.addEventListener('toggle', (event) => {
      if (event.currentTarget.open) {
        clearTimeout(timeoutId);
        expiresAt = 0;
        timer.hidden = true;
      }
    });
  }

  function show(msg, tone, undo) {
    if (!TONES.has(tone)) throw new TypeError(`Tom de toast inválido: ${tone}`);
    const override = getOverride();
    let details = '';
    if (override) {
      msg = typeof override === 'string' ? override : override.message;
      details = typeof override === 'string' ? '' : override.details;
      tone = 'error';
      undo = null;
    }
    clearTimeout(timeoutId);
    duration = undo ? 9000 : 5000;
    expiresAt = Date.now() + duration;
    writeToast({ msg, undo, tone, details });
    timeoutId = setTimeout(() => {
      writeToast(null);
      render();
    }, duration);
    render();
  }

  return { render, show };
}
