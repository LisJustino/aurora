import { lockPageScroll } from '../../utils/scroll-lock.js';
import {
  PROFILE_AVATAR_MAX_ZOOM,
  computeAvatarCrop,
  cropProfileAvatar,
} from './avatar-image.js';

const KEY_STEP = 0.04;

/**
 * Abre um diálogo para enquadrar a foto de perfil (arrastar para posicionar, controle para aproximar).
 * Resolve com o data URL da foto pronta, ou com null se a pessoa cancelar.
 */
export function adjustProfileAvatar(bitmap, { title = 'Ajustar foto' } = {}) {
  return new Promise((resolve) => {
    const dialog = document.createElement('dialog');
    dialog.className = 'dlg-back avatar-cropper-back';
    dialog.setAttribute('aria-labelledby', 'avatar-cropper-title');
    dialog.innerHTML = `
      <div class="dlg avatar-cropper">
        <div class="head"><div><h2 id="avatar-cropper-title"></h2><p>Arraste a foto para posicionar e use o controle para aproximar.</p></div></div>
        <div class="dlg-body avatar-cropper-body">
          <div class="avatar-cropper-stage" tabindex="0" role="group" aria-label="Área da foto. Use as setas do teclado para mover e + ou - para aproximar.">
            <canvas class="avatar-cropper-canvas" width="320" height="320"></canvas>
          </div>
          <label class="avatar-cropper-zoom"><span>Zoom</span><input type="range" min="1" max="${PROFILE_AVATAR_MAX_ZOOM}" step="0.01" value="1" aria-label="Zoom da foto"></label>
          <div class="avatar-cropper-previews" aria-hidden="true"><span class="avatar-cropper-preview is-lg"><canvas width="112" height="112"></canvas></span><span class="avatar-cropper-preview is-sm"><canvas width="52" height="52"></canvas></span><small>Assim aparece no Início e no menu</small></div>
        </div>
        <div class="dlg-foot"><button type="button" class="btn back" data-cropper="cancel">Cancelar</button><button type="button" class="btn" data-cropper="reset">Centralizar</button><button type="button" class="btn primary" data-cropper="apply">Usar esta foto</button></div>
      </div>`;
    dialog.querySelector('#avatar-cropper-title').textContent = title;

    const stage = dialog.querySelector('.avatar-cropper-stage');
    const canvas = dialog.querySelector('.avatar-cropper-canvas');
    const zoomInput = dialog.querySelector('input[type="range"]');
    const previews = [...dialog.querySelectorAll('.avatar-cropper-preview canvas')];
    const applyButton = dialog.querySelector('[data-cropper="apply"]');
    const context = canvas.getContext('2d');
    const state = { zoom: 1, focusX: bitmap.width / 2, focusY: bitmap.height / 2 };
    let releaseScroll = null;
    let settled = false;
    let drag = null;

    const crop = () => computeAvatarCrop(bitmap.width, bitmap.height, state);

    function draw() {
      const next = crop();
      Object.assign(state, { zoom: next.zoom, focusX: next.focusX, focusY: next.focusY });
      zoomInput.value = String(next.zoom);
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.imageSmoothingQuality = 'high';
      context.drawImage(bitmap, next.sx, next.sy, next.size, next.size, 0, 0, canvas.width, canvas.height);
      for (const target of previews) {
        const targetContext = target.getContext('2d');
        targetContext.imageSmoothingQuality = 'high';
        targetContext.drawImage(canvas, 0, 0, target.width, target.height);
      }
    }

    function move(dxFraction, dyFraction) {
      const current = crop();
      state.focusX = current.focusX + dxFraction * current.size;
      state.focusY = current.focusY + dyFraction * current.size;
      draw();
    }

    function setZoom(value) {
      state.zoom = value;
      draw();
    }

    function finish(result) {
      if (settled) return;
      settled = true;
      if (releaseScroll) releaseScroll();
      if (dialog.open) dialog.close();
      dialog.remove();
      resolve(result);
    }

    stage.addEventListener('pointerdown', (event) => {
      if (event.button > 0) return;
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
      stage.setPointerCapture(event.pointerId);
      stage.classList.add('is-dragging');
    });
    stage.addEventListener('pointermove', (event) => {
      if (!drag || drag.id !== event.pointerId) return;
      const rect = stage.getBoundingClientRect();
      const dx = (event.clientX - drag.x) / rect.width;
      const dy = (event.clientY - drag.y) / rect.height;
      drag.x = event.clientX;
      drag.y = event.clientY;
      move(-dx, -dy);
    });
    const endDrag = (event) => {
      if (drag && drag.id === event.pointerId) drag = null;
      stage.classList.remove('is-dragging');
    };
    stage.addEventListener('pointerup', endDrag);
    stage.addEventListener('pointercancel', endDrag);
    stage.addEventListener('wheel', (event) => {
      event.preventDefault();
      setZoom(state.zoom * (event.deltaY < 0 ? 1.08 : 1 / 1.08));
    }, { passive: false });
    stage.addEventListener('keydown', (event) => {
      const moves = { ArrowLeft: [-KEY_STEP, 0], ArrowRight: [KEY_STEP, 0], ArrowUp: [0, -KEY_STEP], ArrowDown: [0, KEY_STEP] };
      if (moves[event.key]) {
        event.preventDefault();
        move(...moves[event.key]);
      } else if (event.key === '+' || event.key === '=') {
        event.preventDefault();
        setZoom(state.zoom + 0.1);
      } else if (event.key === '-') {
        event.preventDefault();
        setZoom(state.zoom - 0.1);
      }
    });
    zoomInput.addEventListener('input', () => setZoom(Number(zoomInput.value)));

    dialog.addEventListener('click', async (event) => {
      const action = event.target instanceof Element ? event.target.closest('[data-cropper]')?.dataset.cropper : null;
      if (action === 'cancel') finish(null);
      else if (action === 'reset') {
        Object.assign(state, { zoom: 1, focusX: bitmap.width / 2, focusY: bitmap.height / 2 });
        draw();
      } else if (action === 'apply') {
        applyButton.disabled = true;
        applyButton.setAttribute('aria-busy', 'true');
        try {
          finish(await cropProfileAvatar(bitmap, crop()));
        } catch (error) {
          applyButton.disabled = false;
          applyButton.removeAttribute('aria-busy');
          const message = error instanceof Error ? error.message : 'Não foi possível preparar a foto.';
          let status = dialog.querySelector('.avatar-cropper-error');
          if (!status) {
            status = document.createElement('p');
            status.className = 'avatar-cropper-error';
            status.setAttribute('role', 'alert');
            dialog.querySelector('.avatar-cropper-body').append(status);
          }
          status.textContent = message;
        }
      }
    });
    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      finish(null);
    });

    document.body.append(dialog);
    releaseScroll = lockPageScroll();
    dialog.showModal();
    draw();
    stage.focus({ preventScroll: true });
  });
}
