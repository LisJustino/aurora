const ENCRYPTED_BACKUP_APP = 'aurora-encrypted-backup';
const ENCRYPTED_BACKUP_VERSION = 1;
const KDF_ITERATIONS = 600_000;
const MAX_BACKUP_BYTES = 5 * 1024 * 1024;
const MAX_ENVELOPE_BYTES = 7 * 1024 * 1024;
const BACKUP_CONTEXT = new TextEncoder().encode('Aurora encrypted backup v1');

function encodeBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeBase64Url(value, expectedLength = null) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error('O backup criptografado tem um formato inválido.');
  }
  let binary;
  try {
    binary = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
  } catch {
    throw new Error('O backup criptografado tem um formato inválido.');
  }
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  if ((expectedLength !== null && bytes.length !== expectedLength)
    || encodeBase64Url(bytes) !== value) {
    throw new Error('O backup criptografado tem um formato inválido.');
  }
  return bytes;
}

function deriveBackupKey(password, salt) {
  const passwordBytes = new TextEncoder().encode(password);
  return crypto.subtle.importKey('raw', passwordBytes, 'PBKDF2', false, ['deriveKey'])
    .then((passwordKey) => crypto.subtle.deriveKey(
      { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: KDF_ITERATIONS },
      passwordKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    ))
    .finally(() => passwordBytes.fill(0));
}

export function isEncryptedBackup(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && value.app === ENCRYPTED_BACKUP_APP;
}

export async function encryptBackup(plaintext, password) {
  if (typeof plaintext !== 'string' || new TextEncoder().encode(plaintext).length > MAX_BACKUP_BYTES) {
    throw new Error('O backup excede o limite de 5 MB.');
  }
  if (typeof password !== 'string' || password.length < 12 || password.length > 72) {
    throw new Error('Use uma senha de 12 a 72 caracteres.');
  }

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveBackupKey(password, salt);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: BACKUP_CONTEXT, tagLength: 128 },
    key,
    new TextEncoder().encode(plaintext),
  );
  const envelope = {
    app: ENCRYPTED_BACKUP_APP,
    version: ENCRYPTED_BACKUP_VERSION,
    kdf: { name: 'PBKDF2-SHA-256', iterations: KDF_ITERATIONS, salt: encodeBase64Url(salt) },
    cipher: { name: 'AES-256-GCM', iv: encodeBase64Url(iv), ciphertext: encodeBase64Url(new Uint8Array(ciphertext)) },
  };
  const serialized = JSON.stringify(envelope, null, 2);
  if (new TextEncoder().encode(serialized).length > MAX_ENVELOPE_BYTES) {
    throw new Error('O backup criptografado excede o limite permitido.');
  }
  return serialized;
}

export async function decryptBackup(envelope, password) {
  if (!isEncryptedBackup(envelope) || envelope.version !== ENCRYPTED_BACKUP_VERSION
    || envelope.kdf?.name !== 'PBKDF2-SHA-256'
    || envelope.kdf.iterations !== KDF_ITERATIONS
    || envelope.cipher?.name !== 'AES-256-GCM'
    || typeof password !== 'string' || password.length < 12 || password.length > 72
    || typeof envelope.cipher?.ciphertext !== 'string'
    || envelope.cipher.ciphertext.length > 7 * 1024 * 1024) {
    throw new Error('Este arquivo criptografado não é compatível ou está inválido.');
  }

  const salt = decodeBase64Url(envelope.kdf.salt, 16);
  const iv = decodeBase64Url(envelope.cipher.iv, 12);
  const ciphertext = decodeBase64Url(envelope.cipher.ciphertext);
  if (ciphertext.length < 16 || ciphertext.length > MAX_BACKUP_BYTES + 16) {
    throw new Error('O backup criptografado excede o limite permitido ou está incompleto.');
  }

  try {
    const key = await deriveBackupKey(password, salt);
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv, additionalData: BACKUP_CONTEXT, tagLength: 128 },
      key,
      ciphertext,
    );
    if (plaintext.byteLength > MAX_BACKUP_BYTES) throw new Error('O backup excede o limite de 5 MB.');
    const plaintextBytes = new Uint8Array(plaintext);
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(plaintextBytes);
    } finally {
      plaintextBytes.fill(0);
    }
  } catch {
    throw new Error('Senha incorreta ou backup danificado.');
  }
}
