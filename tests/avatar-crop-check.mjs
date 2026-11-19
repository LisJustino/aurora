import assert from 'node:assert/strict';
import { PROFILE_AVATAR_MAX_ZOOM, computeAvatarCrop } from '../src/js/features/profile/avatar-image.js';

// Sem ajuste: recorte quadrado centralizado, do tamanho do lado menor.
assert.deepEqual(computeAvatarCrop(900, 600), { zoom: 1, size: 600, focusX: 450, focusY: 300, sx: 150, sy: 0 });
assert.deepEqual(computeAvatarCrop(600, 900), { zoom: 1, size: 600, focusX: 300, focusY: 450, sx: 0, sy: 150 });

// Zoom reduz o recorte; o ponto de foco acompanha o que a pessoa arrastou.
const zoomed = computeAvatarCrop(900, 600, { zoom: 2, focusX: 600, focusY: 200 });
assert.equal(zoomed.size, 300);
assert.equal(zoomed.sx, 450);
assert.equal(zoomed.sy, 50);

// O recorte nunca sai da imagem, mesmo com foco nos cantos ou fora dela.
const corner = computeAvatarCrop(900, 600, { zoom: 2, focusX: 0, focusY: 0 });
assert.equal(corner.sx, 0);
assert.equal(corner.sy, 0);
const outside = computeAvatarCrop(900, 600, { zoom: 3, focusX: 5000, focusY: 5000 });
assert.ok(outside.sx + outside.size <= 900 && outside.sy + outside.size <= 600);

// Zoom inválido ou exagerado é limitado.
assert.equal(computeAvatarCrop(900, 600, { zoom: 99 }).zoom, PROFILE_AVATAR_MAX_ZOOM);
assert.equal(computeAvatarCrop(900, 600, { zoom: 0.2 }).zoom, 1);
assert.equal(computeAvatarCrop(900, 600, { zoom: Number.NaN }).zoom, 1);
assert.deepEqual(computeAvatarCrop(900, 600, { focusX: Number.NaN, focusY: Number.NaN }), computeAvatarCrop(900, 600));

console.log('avatar-crop-check: all checks passed');
