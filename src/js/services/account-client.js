import { hasSupabaseConfig, getSupabaseClient } from '../data/supabase-client.js';
import { isAccountDeletionConfirmed } from './account-errors.js';

let clientPromise;

export async function getAccountClient() {
  if (!hasSupabaseConfig()) {
    throw new Error('O projeto de contas não está configurado com uma URL HTTPS e uma chave pública.');
  }
  if (!clientPromise) {
    clientPromise = Promise.resolve()
      .then(() => getSupabaseClient())
      .catch((error) => {
        clientPromise = null;
        throw error;
      });
  }
  return clientPromise;
}

export async function requestAccountDeletion(client) {
  const { data, error } = await client.functions.invoke('delete-account');
  if (!isAccountDeletionConfirmed(error, data)) {
    console.error('Aurora: a exclusão segura da conta não foi confirmada.', error);
    return false;
  }
  return true;
}
