import { AccountConflictError } from './account-errors.js';

const SLICES = new Set(['tasks', 'settings', 'water', 'gym', 'finance', 'cycle', 'cycleLog', 'weight', 'habits']);

function sameJsonValue(a, b) {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const keysA = Object.keys(a).sort();
  const keysB = Object.keys(b).sort();
  return (
    keysA.length === keysB.length &&
    keysA.every((key, index) => keysA[index] === keysB[index] && sameJsonValue(a[key], b[key]))
  );
}

export async function loadAccountSlices(client, userId) {
  const { data, error } = await client.from('user_data').select('slice,data,revision').eq('user_id', userId);
  if (error)
    throw new Error(
      'Não foi possível carregar os dados sincronizados. Os dados locais não serão usados como substituto.',
    );
  return new Map((data || []).map((row) => [row.slice, row]));
}

export async function saveAccountSlice(client, userId, slice, data, expectedRevision) {
  if (!SLICES.has(slice)) throw new Error('Tipo de dado não permitido para sincronização.');
  if (!isEncryptedEnvelope(data)) {
    throw new Error('O formato criptografado dos dados não é válido para sincronização.');
  }
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
    throw new Error('A revisão dos dados não é válida para sincronização.');
  }
  if (new TextEncoder().encode(JSON.stringify(data)).byteLength > 2_000_000) {
    throw new Error('Esta área excede o limite seguro de sincronização.');
  }
  if (expectedRevision === 0) {
    const { data: inserted, error } = await client
      .from('user_data')
      .insert({ user_id: userId, slice, data, revision: 1 })
      .select('revision')
      .maybeSingle();
    if (error) {
      if (error.code === '23505') throw new AccountConflictError(slice);
      throw new Error('Não foi possível sincronizar esta área.');
    }
    if (!inserted) throw new AccountConflictError(slice);
    return inserted.revision;
  }
  const { data: updated, error } = await client
    .from('user_data')
    .update({ data, revision: expectedRevision + 1, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('slice', slice)
    .eq('revision', expectedRevision)
    .select('revision')
    .maybeSingle();
  if (error) throw new Error('Não foi possível sincronizar esta área.');
  if (!updated) throw new AccountConflictError(slice);
  return updated.revision;
}

export async function importAccountSlices(client, slices) {
  if (!Object.keys(slices).length) throw new Error('A importação não contém áreas válidas.');
  Object.entries(slices).forEach(([slice, data]) => {
    if (!SLICES.has(slice) || !isEncryptedEnvelope(data)) {
      throw new Error('A importação contém uma área ou um envelope criptografado inválido.');
    }
  });
  const { error } = await client.rpc('import_user_slices', { p_slices: slices });
  if (error) throw new Error('A importação não foi concluída. Os dados locais foram preservados.');
  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();
  if (userError || !user) throw new Error('A sessão expirou; entre novamente para carregar os dados.');
  const rows = await loadAccountSlices(client, user.id);
  if (Object.keys(slices).some((slice) => !rows.has(slice))) {
    throw new Error('A nuvem não confirmou todas as áreas importadas.');
  }
  return rows;
}

function isEncryptedEnvelope(data) {
  return Boolean(
    data &&
    typeof data === 'object' &&
    data.v === 1 &&
    Object.keys(data).length === 3 &&
    typeof data.iv === 'string' &&
    /^[A-Za-z0-9_-]{16}$/.test(data.iv) &&
    typeof data.ciphertext === 'string' &&
    /^[A-Za-z0-9_-]{22,}$/.test(data.ciphertext) &&
    new TextEncoder().encode(JSON.stringify(data)).byteLength <= 2_000_000,
  );
}

export async function replaceAccountSlices(client, slices, expectedRevisions) {
  const sliceNames = Object.keys(slices);
  if (
    sliceNames.length !== SLICES.size ||
    sliceNames.some((slice) => !SLICES.has(slice) || !isEncryptedEnvelope(slices[slice])) ||
    Object.keys(expectedRevisions).length !== sliceNames.length ||
    Object.keys(expectedRevisions).some((slice) => !Object.hasOwn(slices, slice)) ||
    sliceNames.some((slice) => !Number.isSafeInteger(expectedRevisions[slice]) || expectedRevisions[slice] < 0)
  ) {
    throw new Error('O backup contém áreas ou revisões criptografadas inválidas.');
  }
  const { data, error } = await client.rpc('replace_user_slices', {
    p_slices: slices,
    p_revisions: expectedRevisions,
  });
  if (error) {
    if (error.code === '40001' || error.code === '23505') throw new AccountConflictError('backup');
    let remote;
    try {
      const { data: authData, error: authError } = await client.auth.getUser();
      if (authError || !authData.user) throw new Error('A sessão expirou.');
      remote = await loadAccountSlices(client, authData.user.id);
    } catch (verificationError) {
      throw new Error(
        'Não foi possível confirmar se a restauração foi concluída; os dados remotos foram preservados.',
        { cause: verificationError },
      );
    }
    if (sliceNames.every((slice) => sameJsonValue(remote.get(slice)?.data, slices[slice]))) return remote;
    throw new Error('A restauração não foi concluída. Os dados atuais foram preservados.');
  }
  const rows = new Map((data || []).map((row) => [row.slice, row]));
  if (sliceNames.some((slice) => !rows.has(slice))) {
    throw new Error('A nuvem não confirmou todas as áreas restauradas.');
  }
  return rows;
}

export async function deleteAccountData(client, userId) {
  const { error } = await client.from('user_data').delete().eq('user_id', userId);
  if (error) throw new Error('Não foi possível apagar os dados da conta na nuvem.');
}
