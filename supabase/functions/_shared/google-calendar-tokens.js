// Criptografia e revogação dos tokens do Google Agenda, compartilhadas pelas funções
// google-calendar e delete-account. O token nunca é gravado sem criptografia.
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const VERSION = 'v1';

function toBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function fromBase64Url(value) {
  const normalized = String(value).replaceAll('-', '+').replaceAll('_', '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export async function importEncryptionKey(secret) {
  let raw;
  try {
    raw = fromBase64Url(String(secret || '').trim());
  } catch {
    throw new Error('encryption-key-invalid');
  }
  if (raw.length !== 32) throw new Error('encryption-key-invalid');
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

// O user_id entra como dado autenticado: um valor copiado para outra conta não decifra.
export async function encryptRefreshToken(token, key, userId) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: encoder.encode(userId) },
    key,
    encoder.encode(token),
  );
  return `${VERSION}.${toBase64Url(iv)}.${toBase64Url(new Uint8Array(cipher))}`;
}

export async function decryptRefreshToken(value, key, userId) {
  const [version, iv, cipher] = String(value || '').split('.');
  if (version !== VERSION || !iv || !cipher) throw new Error('token-format-invalid');
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64Url(iv), additionalData: encoder.encode(userId) },
    key,
    fromBase64Url(cipher),
  );
  return decoder.decode(plain);
}

export async function revokeGoogleToken(token, fetchImpl = fetch) {
  try {
    const response = await fetchImpl('https://oauth2.googleapis.com/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
