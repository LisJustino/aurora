import assert from 'node:assert/strict';
import { deleteAccountPermanently } from '../supabase/functions/delete-account/account-deletion.js';
import { parseAllowedOrigins } from '../supabase/functions/delete-account/allowed-origins.js';

let deleteUserArguments;
await deleteAccountPermanently({
  auth: {
    admin: {
      deleteUser: async (...args) => {
        deleteUserArguments = args;
        return { error: null };
      },
    },
  },
}, 'user-id');
assert.deepEqual(deleteUserArguments, ['user-id', false]);

assert.deepEqual(
  parseAllowedOrigins('https://aurora.example, http://localhost:5173, https://*.example'),
  ['https://aurora.example'],
);

console.log('delete-account-check: all checks passed');
