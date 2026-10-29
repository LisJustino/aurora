const KEY_VERSION = 1;
const PBKDF2_ITERATIONS = 600_000;
const encoder = new TextEncoder();

function requireCrypto() {
  if (!globalThis.crypto?.subtle || !globalThis.crypto?.getRandomValues) {
    throw new Error('Este navegador não oferece criptografia segura neste contexto. Use HTTPS para acessar os dados.');
  }
}

function encodeBytes(bytes) {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeBytes(value, expectedLength = null) {
  if (typeof value !== 'string' || value.length > 2_700_000 || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error('A chave criptográfica tem um formato inválido.');
  }
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64 + '='.repeat((4 - base64.length % 4) % 4));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  if (expectedLength !== null && bytes.length !== expectedLength) {
    throw new Error('A chave criptográfica tem um tamanho inválido.');
  }
  return bytes;
}

function associatedData(userId, purpose) {
  return encoder.encode(`aurora:${KEY_VERSION}:${userId}:${purpose}`);
}

async function derivePasswordKey(password, salt) {
  const passwordBytes = encoder.encode(password);
  try {
    const source = await crypto.subtle.importKey(
      'raw',
      passwordBytes,
      'PBKDF2',
      false,
      ['deriveKey'],
    );
    return await crypto.subtle.deriveKey(
      { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITERATIONS },
      source,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    );
  } finally {
    passwordBytes.fill(0);
  }
}

async function wrapRawKey(rawKey, wrappingKey, userId, purpose) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: associatedData(userId, purpose), tagLength: 128 },
    wrappingKey,
    rawKey,
  );
  return { iv: encodeBytes(iv), ciphertext: encodeBytes(new Uint8Array(ciphertext)) };
}

async function unwrapRawKey(wrapped, wrappingKey, userId, purpose) {
  const rawKey = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: decodeBytes(wrapped.iv, 12),
      additionalData: associatedData(userId, purpose),
      tagLength: 128,
    },
    wrappingKey,
    decodeBytes(wrapped.ciphertext),
  );
  if (rawKey.byteLength !== 32) throw new Error('A chave criptográfica não pôde ser validada.');
  const bytes = new Uint8Array(rawKey);
  try {
    return await crypto.subtle.importKey('raw', bytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  } finally {
    bytes.fill(0);
  }
}

export async function createVault(password, userId) {
  requireCrypto();
  if (typeof password !== 'string' || password.length < 12 || password.length > 72) {
    throw new Error('Use uma senha entre 12 e 72 caracteres.');
  }
  const rawKey = crypto.getRandomValues(new Uint8Array(32));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const recoveryKey = encodeBytes(crypto.getRandomValues(new Uint8Array(32)));
  const rawRecoveryKey = decodeBytes(recoveryKey, 32);
  try {
    const [passwordKey, recoveryWrappingKey] = await Promise.all([
      derivePasswordKey(password, salt),
      crypto.subtle.importKey('raw', rawRecoveryKey, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']),
    ]);
    const [passwordWrap, recoveryWrap, dataKey] = await Promise.all([
      wrapRawKey(rawKey, passwordKey, userId, 'password-wrap'),
      wrapRawKey(rawKey, recoveryWrappingKey, userId, 'recovery-wrap'),
      crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']),
    ]);
    return {
      dataKey,
      recoveryKey,
      record: {
        key_version: KEY_VERSION,
        salt: encodeBytes(salt),
        password_wrap: passwordWrap,
        recovery_wrap: recoveryWrap,
      },
    };
  } finally {
    rawKey.fill(0);
    salt.fill(0);
    rawRecoveryKey.fill(0);
  }
}

export async function unlockVaultWithPassword(password, record, userId) {
  requireCrypto();
  if (!record || record.key_version !== KEY_VERSION || typeof password !== 'string' || !password) {
    throw new Error('Não foi possível desbloquear os dados.');
  }
  const salt = decodeBytes(record.salt, 16);
  const key = await derivePasswordKey(password, salt);
  return unwrapRawKey(record.password_wrap, key, userId, 'password-wrap');
}

export async function unlockVaultWithRecovery(recoveryKey, record, userId) {
  requireCrypto();
  if (!record || record.key_version !== KEY_VERSION) {
    throw new Error('Não foi possível desbloquear os dados.');
  }
  const rawRecoveryKey = decodeBytes(recoveryKey, 32);
  try {
    const key = await crypto.subtle.importKey('raw', rawRecoveryKey, { name: 'AES-GCM' }, false, ['decrypt']);
    return await unwrapRawKey(record.recovery_wrap, key, userId, 'recovery-wrap');
  } finally {
    rawRecoveryKey.fill(0);
  }
}

export async function encryptAccountSlice(dataKey, userId, slice, envelope) {
  requireCrypto();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = encoder.encode(JSON.stringify(envelope));
  if (plaintext.byteLength > 1_450_000) {
    plaintext.fill(0);
    iv.fill(0);
    throw new Error('Esta área excede o limite seguro de sincronização.');
  }
  try {
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData: associatedData(userId, `slice:${slice}`), tagLength: 128 },
      dataKey,
      plaintext,
    );
    return {
      v: KEY_VERSION,
      iv: encodeBytes(iv),
      ciphertext: encodeBytes(new Uint8Array(ciphertext)),
    };
  } finally {
    plaintext.fill(0);
    iv.fill(0);
  }
}

export async function decryptAccountSlice(dataKey, userId, slice, encrypted) {
  requireCrypto();
  if (!encrypted || encrypted.v !== KEY_VERSION
    || Object.keys(encrypted).length !== 3
    || typeof encrypted.iv !== 'string'
    || typeof encrypted.ciphertext !== 'string') {
    throw new Error('Formato criptografado incompatível.');
  }
  const plaintext = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: decodeBytes(encrypted.iv, 12),
      additionalData: associatedData(userId, `slice:${slice}`),
      tagLength: 128,
    },
    dataKey,
    decodeBytes(encrypted.ciphertext),
  );
  const bytes = new Uint8Array(plaintext);
  try {
    const envelope = JSON.parse(new TextDecoder().decode(bytes));
    if (!envelope || typeof envelope !== 'object' || !Object.hasOwn(envelope, 'v')
      || !Object.hasOwn(envelope, 't') || !Number.isFinite(envelope.t)) {
      throw new Error('Envelope de dados criptografado inválido.');
    }
    return envelope;
  } finally {
    bytes.fill(0);
  }
}
