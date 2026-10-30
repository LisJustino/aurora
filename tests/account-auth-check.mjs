import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  calculateAge,
  createLegalConsentMetadata,
  hasCurrentLegalConsent,
  isAccountDeletionConfirmed,
  isExistingAccountSignup,
  isPasswordRecoveryCallback,
  LEGAL_DOCUMENT_VERSION,
  meetsPasswordRequirements,
  getEmailDomainSuggestions,
  signupErrorMessage,
} from '../src/js/services/account-auth.js';
import {
  createAuthSessionStorage,
  resolveSupabaseConfig,
  setRememberSession,
} from '../src/js/data/supabase-client.js';
import { isLegalDocumentAtEnd } from '../src/js/features/footer/legal-dialog.js';

assert.deepEqual(resolveSupabaseConfig({
  isDevelopment: true,
  localUrl: 'https://test-project.supabase.co',
  localAnonKey: 'test-public-key',
  productionUrl: 'https://production-project.supabase.co',
  productionAnonKey: 'production-public-key',
}), {
  url: 'https://test-project.supabase.co',
  anonKey: 'test-public-key',
});
assert.deepEqual(resolveSupabaseConfig({
  isDevelopment: false,
  localUrl: 'https://test-project.supabase.co',
  localAnonKey: 'test-public-key',
  productionUrl: 'https://production-project.supabase.co',
  productionAnonKey: 'production-public-key',
}), {
  url: 'https://production-project.supabase.co',
  anonKey: 'production-public-key',
});
assert.deepEqual(resolveSupabaseConfig({
  isDevelopment: true,
  productionUrl: 'https://legacy-project.supabase.co',
  productionAnonKey: 'legacy-public-key',
}), { url: '', anonKey: '' });
const createStorage = () => {
  const entries = new Map();
  return {
    entries,
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, String(value)),
    removeItem: (key) => entries.delete(key),
  };
};
const localAuthStorage = createStorage();
const sessionAuthStorage = createStorage();
const authSessionStorage = createAuthSessionStorage({
  localStorage: localAuthStorage,
  sessionStorage: sessionAuthStorage,
});
setRememberSession(false);
await authSessionStorage.setItem('sb-test-auth-token', 'session-only');
assert.equal(sessionAuthStorage.getItem('sb-test-auth-token'), 'session-only');
assert.equal(localAuthStorage.getItem('sb-test-auth-token'), null);
setRememberSession(true);
await authSessionStorage.setItem('sb-test-auth-token', 'remembered');
assert.equal(localAuthStorage.getItem('sb-test-auth-token'), 'remembered');
assert.equal(sessionAuthStorage.getItem('sb-test-auth-token'), null);
setRememberSession(false);
assert.equal(await authSessionStorage.getItem('sb-test-auth-token'), 'remembered');
await authSessionStorage.removeItem('sb-test-auth-token');
assert.equal(localAuthStorage.getItem('sb-test-auth-token'), null);
assert.equal(sessionAuthStorage.getItem('sb-test-auth-token'), null);
assert.equal(isPasswordRecoveryCallback({ search: '?type=recovery', hash: '' }), true);
assert.equal(isPasswordRecoveryCallback({ search: '', hash: '#type=recovery' }), true);
assert.equal(isPasswordRecoveryCallback({ search: '?code=', hash: '' }), false);
assert.equal(isPasswordRecoveryCallback({ search: '', hash: '#type=signup' }), false);
assert.equal(isPasswordRecoveryCallback(null), false);
assert.deepEqual(getEmailDomainSuggestions('ana@gma'), ['ana@gmail.com']);
assert.deepEqual(getEmailDomainSuggestions('ana@out'), ['ana@outlook.com', 'ana@outlook.com.br']);
assert.deepEqual(getEmailDomainSuggestions('ana@GMA'), ['ana@gmail.com']);
assert.deepEqual(getEmailDomainSuggestions('ana@empresa.example'), []);
assert.deepEqual(getEmailDomainSuggestions('ana@'), [
  'ana@gmail.com',
  'ana@outlook.com',
  'ana@hotmail.com',
  'ana@yahoo.com',
  'ana@icloud.com',
  'ana@live.com',
  'ana@proton.me',
  'ana@protonmail.com',
  'ana@outlook.com.br',
  'ana@hotmail.com.br',
  'ana@yahoo.com.br',
  'ana@uol.com.br',
  'ana@bol.com.br',
]);
assert.deepEqual(getEmailDomainSuggestions('ana'), []);
assert.equal(isExistingAccountSignup({ code: 'user_already_exists' }), true);
assert.equal(isExistingAccountSignup({ message: 'User already registered' }), true);
assert.equal(isExistingAccountSignup(null, {
  session: null,
  user: { identities: [] },
}), true);
assert.equal(isExistingAccountSignup({ code: 'weak_password' }), false);
assert.equal(isAccountDeletionConfirmed(null, { deleted: true }), true);
assert.equal(isAccountDeletionConfirmed(null, { deleted: false }), false);
assert.equal(isAccountDeletionConfirmed({ message: 'failed' }, { deleted: true }), false);
assert.match(signupErrorMessage({ code: 'user_already_exists' }), /ainda está associado a uma conta/);
assert.match(signupErrorMessage(null, {
  session: null,
  user: { identities: [] },
}), /criar uma conta nova, sem recuperar os dados anteriores/);
assert.match(signupErrorMessage({ code: 'weak_password' }), /requisitos de segurança/);
assert.match(signupErrorMessage({ code: 'invalid_email' }), /e-mail foi digitado corretamente/);
assert.match(signupErrorMessage({ status: 429 }), /Muitas tentativas/);
assert.equal(
  signupErrorMessage({ code: 'unexpected_error' }),
  'Não foi possível concluir a solicitação. Confira os dados e tente novamente.',
);

assert.deepEqual(createLegalConsentMetadata(new Date('2026-10-29T12:00:00.000Z')), {
  terms_accepted_at: '2026-10-29T12:00:00.000Z',
  terms_version: LEGAL_DOCUMENT_VERSION,
  privacy_policy_version: LEGAL_DOCUMENT_VERSION,
});
assert.equal(LEGAL_DOCUMENT_VERSION, '1.2');
assert.equal(hasCurrentLegalConsent({
  user_metadata: {
    terms_version: '1.2',
    privacy_policy_version: '1.2',
    terms_accepted_at: '2026-10-29T12:00:00.000Z',
  },
}), true);
assert.equal(hasCurrentLegalConsent({
  user_metadata: {
    terms_version: '1.1',
    privacy_policy_version: '1.2',
    terms_accepted_at: '2026-10-29T12:00:00.000Z',
  },
}), false);
assert.equal(hasCurrentLegalConsent({ user_metadata: null }), false);
assert.equal(isLegalDocumentAtEnd({ scrollTop: 0, clientHeight: 500, scrollHeight: 500 }), true);
assert.equal(isLegalDocumentAtEnd({ scrollTop: 400, clientHeight: 500, scrollHeight: 1000 }), false);
assert.equal(isLegalDocumentAtEnd({ scrollTop: 500, clientHeight: 500, scrollHeight: 1000 }), true);
assert.equal(isLegalDocumentAtEnd({ scrollTop: 498, clientHeight: 500, scrollHeight: 1000 }), true);
assert.equal(isLegalDocumentAtEnd({ scrollTop: Number.NaN, clientHeight: 500, scrollHeight: 1000 }), false);
assert.throws(() => createLegalConsentMetadata(new Date('invalid')), TypeError);

const accountAuthSource = readFileSync(new URL('../src/js/services/account-auth.js', import.meta.url), 'utf8');
assert.doesNotMatch(accountAuthSource, /createGenderSelect\(form/);
assert.doesNotMatch(accountAuthSource, /form\.elements\.sex\.checkValidity\(\)/);
assert.doesNotMatch(accountAuthSource, /sex:\s*profileDraft\.sex/);

assert.equal(meetsPasswordRequirements('Abc12!'), true);
assert.equal(meetsPasswordRequirements('Abc1!'), false);
assert.equal(meetsPasswordRequirements('abcdef1!'), false);
assert.equal(meetsPasswordRequirements('ABCDEF1!'), false);
assert.equal(meetsPasswordRequirements('Abcdefg!'), false);
assert.equal(meetsPasswordRequirements('Abcdef1g'), false);
assert.equal(meetsPasswordRequirements(`A${'b'.repeat(69)}1!`), true);
assert.equal(meetsPasswordRequirements(`A${'b'.repeat(70)}1!`), false);

const today = new Date(2026, 9, 29, 12);
assert.equal(calculateAge('2008-10-29', today), 18);
assert.equal(calculateAge('2008-10-30', today), 17);
assert.equal(calculateAge('2008-10-28', today), 18);
assert.equal(calculateAge('2000-02-30', today), null);
assert.equal(calculateAge('2027-01-01', today), null);
assert.equal(calculateAge('1900-01-01', today), null);

console.log('account-auth-check: all checks passed');
