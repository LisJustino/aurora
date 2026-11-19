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

export async function compressProfileAvatar(file) {
  const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
  if (!file || !allowedTypes.has(file.type)) {
    throw new Error('Escolha uma imagem JPG, PNG ou WebP.');
  }
  if (!Number.isSafeInteger(file.size) || file.size <= 0 || file.size > PROFILE_AVATAR_MAX_FILE_BYTES) {
    throw new Error('A imagem precisa ter até 8 MB.');
  }
  if (typeof createImageBitmap !== 'function') {
    throw new Error('Este navegador não oferece suporte para preparar fotos de perfil.');
  }

  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('Não foi possível abrir esse arquivo como imagem.');
  }

  try {
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 40000000) {
      throw new Error('A imagem tem dimensões grandes demais. Escolha outra foto.');
    }
    const scale = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height));
    let width = Math.max(1, Math.round(bitmap.width * scale));
    let height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Não foi possível preparar a foto neste navegador.');

    while (true) {
      canvas.width = width;
      canvas.height = height;
      context.fillStyle = '#fff';
      context.fillRect(0, 0, width, height);
      context.drawImage(bitmap, 0, 0, width, height);
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
  } finally {
    bitmap.close();
  }
}
