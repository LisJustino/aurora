export const PROFILE_AVATAR_MAX_FILE_BYTES = 8 * 1024 * 1024;
export const PROFILE_AVATAR_MAX_BYTES = 240 * 1024;
const PROFILE_AVATAR_MAX_DATA_URL_LENGTH = Math.ceil(PROFILE_AVATAR_MAX_BYTES / 3) * 4
  + 'data:image/jpeg;base64,'.length;
const PROFILE_AVATAR_DATA_URL_PREFIX = 'data:image/jpeg;base64,';

export function isProfileAvatarImageData(value) {
  if (typeof value !== 'string' || value.length > PROFILE_AVATAR_MAX_DATA_URL_LENGTH
    || !value.startsWith(PROFILE_AVATAR_DATA_URL_PREFIX)) return false;
  const payload = value.slice(PROFILE_AVATAR_DATA_URL_PREFIX.length);
  if (!payload.startsWith('/9j/') || payload.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(payload)) return false;
  const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0;
  return payload.length / 4 * 3 - padding <= PROFILE_AVATAR_MAX_BYTES;
}

function canvasToJpegBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Não foi possível preparar a foto neste navegador.'));
        return;
      }
      if (blob.type !== 'image/jpeg') {
        reject(new Error('Este navegador não conseguiu converter a foto para um formato compatível.'));
        return;
      }
      resolve(blob);
    }, 'image/jpeg', quality);
  });
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      if (isProfileAvatarImageData(reader.result)) resolve(reader.result);
      else reject(new Error('A foto preparada excedeu o limite permitido.'));
    }, { once: true });
    reader.addEventListener('error', () => reject(new Error('Não foi possível ler a foto preparada.')), { once: true });
    reader.readAsDataURL(blob);
  });
}

const PROFILE_AVATAR_OUTPUT_SIDE = 512;

function assertAvatarFile(file) {
  const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
  if (!file || !allowedTypes.has(file.type)) {
    throw new Error('Escolha uma imagem JPG, PNG ou WebP.');
  }
  if (!Number.isSafeInteger(file.size) || file.size <= 0 || file.size > PROFILE_AVATAR_MAX_FILE_BYTES) {
    throw new Error('A imagem precisa ter até 8 MB.');
  }
}

async function bitmapFromBlob(blob) {
  if (typeof createImageBitmap !== 'function') {
    throw new Error('Este navegador não oferece suporte para preparar fotos de perfil.');
  }
  let bitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch {
    throw new Error('Não foi possível abrir esse arquivo como imagem.');
  }
  if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 40000000) {
    bitmap.close();
    throw new Error('A imagem tem dimensões grandes demais. Escolha outra foto.');
  }
  return bitmap;
}

/** Abre o arquivo escolhido como imagem, já validado. Quem chama deve fechar o bitmap. */
export async function openProfileAvatarFile(file) {
  assertAvatarFile(file);
  return bitmapFromBlob(file);
}

/** Abre uma foto de perfil já salva (data URL JPEG) para ajustar o enquadramento. */
export async function openProfileAvatarData(dataUrl) {
  if (!isProfileAvatarImageData(dataUrl)) throw new Error('Não foi possível abrir a foto atual.');
  const binary = atob(dataUrl.slice(PROFILE_AVATAR_DATA_URL_PREFIX.length));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bitmapFromBlob(new Blob([bytes], { type: 'image/jpeg' }));
}

/**
 * Recorte quadrado do enquadramento escolhido. `zoom` >= 1 aproxima a foto; `focusX`/`focusY`
 * são o ponto da imagem (em pixels) que fica no centro. O recorte nunca sai da imagem.
 */
export function computeAvatarCrop(width, height, { zoom = 1, focusX = width / 2, focusY = height / 2 } = {}) {
  const safeZoom = Math.min(PROFILE_AVATAR_MAX_ZOOM, Math.max(1, Number.isFinite(zoom) ? zoom : 1));
  const size = Math.min(width, height) / safeZoom;
  const clamp = (value, total) => Math.min(total - size / 2, Math.max(size / 2, Number.isFinite(value) ? value : total / 2));
  const x = clamp(focusX, width);
  const y = clamp(focusY, height);
  return { zoom: safeZoom, size, focusX: x, focusY: y, sx: x - size / 2, sy: y - size / 2 };
}
export const PROFILE_AVATAR_MAX_ZOOM = 4;

async function encodeAvatar(bitmap, source, outputWidth, outputHeight) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('Não foi possível preparar a foto neste navegador.');
  let width = outputWidth;
  let height = outputHeight;
  while (true) {
    canvas.width = width;
    canvas.height = height;
    context.fillStyle = '#fff';
    context.fillRect(0, 0, width, height);
    context.imageSmoothingQuality = 'high';
    context.drawImage(bitmap, source.sx, source.sy, source.sw, source.sh, 0, 0, width, height);
    for (const quality of [0.82, 0.68, 0.54, 0.4]) {
      const blob = await canvasToJpegBlob(canvas, quality);
      if (blob.size <= PROFILE_AVATAR_MAX_BYTES) return await blobToDataUrl(blob);
    }
    if (Math.max(width, height) < 96) break;
    const nextWidth = Math.max(1, Math.floor(width * 0.8));
    const nextHeight = Math.max(1, Math.floor(height * 0.8));
    if (nextWidth === width && nextHeight === height) break;
    width = nextWidth;
    height = nextHeight;
  }
  throw new Error('Não foi possível reduzir essa foto o suficiente. Escolha outra imagem.');
}

/** Gera a foto final (JPEG quadrado de até 512 px e 240 KB) a partir do enquadramento escolhido. */
export function cropProfileAvatar(bitmap, crop) {
  const side = Math.max(1, Math.min(PROFILE_AVATAR_OUTPUT_SIDE, Math.round(crop.size)));
  return encodeAvatar(bitmap, { sx: crop.sx, sy: crop.sy, sw: crop.size, sh: crop.size }, side, side);
}

export async function compressProfileAvatar(file) {
  const bitmap = await openProfileAvatarFile(file);
  try {
    const scale = Math.min(1, PROFILE_AVATAR_OUTPUT_SIDE / Math.max(bitmap.width, bitmap.height));
    return await encodeAvatar(
      bitmap,
      { sx: 0, sy: 0, sw: bitmap.width, sh: bitmap.height },
      Math.max(1, Math.round(bitmap.width * scale)),
      Math.max(1, Math.round(bitmap.height * scale)),
    );
  } finally {
    bitmap.close();
  }
}
