/**
 * Executa gravações em sequência e tenta restaurar o armazenamento original
 * caso alguma delas falhe. Não garante atomicidade se o próprio rollback falhar.
 */
export function runStorageTransaction({
  keys,
  readRaw,
  writeRaw,
  removeRaw,
  persist,
}) {
  if (
    !Array.isArray(keys)
    || typeof readRaw !== 'function'
    || typeof writeRaw !== 'function'
    || typeof removeRaw !== 'function'
    || typeof persist !== 'function'
  ) {
    throw new TypeError('Configuração inválida para a transação de armazenamento.');
  }

  const original = new Map();

  try {
    for (const key of keys) {
      original.set(key, readRaw(key));
    }
  } catch (error) {
    return {
      ok: false,
      stage: 'snapshot',
      rollbackFailed: false,
      failedKeys: [],
      error,
    };
  }

  const failedKeys = [];

  try {
    for (const key of keys) {
      if (persist(key) !== true) {
        failedKeys.push(key);
        throw new Error(`Falha ao persistir a chave "${key}".`);
      }
    }

    return {
      ok: true,
      stage: 'complete',
      rollbackFailed: false,
      failedKeys: [],
      error: null,
    };
  } catch (error) {
    let rollbackFailed = false;

    for (const key of keys) {
      try {
        const value = original.get(key);

        if (value === null) {
          removeRaw(key);
        } else {
          writeRaw(key, value);
        }
      } catch (rollbackError) {
        rollbackFailed = true;
      }
    }

    return {
      ok: false,
      stage: 'persist',
      rollbackFailed,
      failedKeys,
      error,
    };
  }
}
