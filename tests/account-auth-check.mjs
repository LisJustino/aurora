import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  calculateAge,
  createLegalConsentMetadata,
  hasCurrentLegalConsent,
  hasCompleteAdultProfile,
  hasSocialIdentity,
  authCallbackErrorMessage,
  getOAuthRedirectUrl,
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

assert.deepEqual(resolveSupabaseConfig({
  isDevelopment: true,
  localUrl: 'https://cltymialatksylhzsitz.supabase.co',
  localAnonKey: 'test-public-key',
  previewUrl: 'https://cltymialatksylhzsitz.supabase.co',
  previewAnonKey: 'preview-public-key',
  productionUrl: 'https://xeneztudcqdumfhwotry.supabase.co',
  productionAnonKey: 'production-public-key',
}), {
  url: 'https://cltymialatksylhzsitz.supabase.co',
  anonKey: 'test-public-key',
});
assert.deepEqual(resolveSupabaseConfig({
  isDevelopment: false,
  targetEnvironment: 'development',
  localUrl: 'https://cltymialatksylhzsitz.supabase.co',
  localAnonKey: 'test-public-key',
  previewUrl: 'https://cltymialatksylhzsitz.supabase.co',
  previewAnonKey: 'preview-public-key',
  productionUrl: 'https://xeneztudcqdumfhwotry.supabase.co',
  productionAnonKey: 'production-public-key',
}), {
  url: 'https://cltymialatksylhzsitz.supabase.co',
  anonKey: 'preview-public-key',
});
assert.deepEqual(resolveSupabaseConfig({
  isDevelopment: true,
  targetEnvironment: 'production',
  productionUrl: 'https://xeneztudcqdumfhwotry.supabase.co',
  productionAnonKey: 'legacy-public-key',
}), { url: '', anonKey: '' });
assert.deepEqual(resolveSupabaseConfig({
  isDevelopment: false,
  targetEnvironment: 'production',
  previewUrl: 'https://cltymialatksylhzsitz.supabase.co',
  previewAnonKey: 'preview-public-key',
  productionUrl: 'https://xeneztudcqdumfhwotry.supabase.co',
  productionAnonKey: 'production-public-key',
}), {
  url: 'https://xeneztudcqdumfhwotry.supabase.co',
  anonKey: 'production-public-key',
});
assert.deepEqual(resolveSupabaseConfig({
  isDevelopment: false,
  targetEnvironment: 'development',
  previewUrl: 'https://xeneztudcqdumfhwotry.supabase.co',
  previewAnonKey: 'production-key-must-not-be-accepted-for-preview',
}), { url: '', anonKey: '' });
assert.deepEqual(resolveSupabaseConfig({
  isDevelopment: false,
  productionUrl: 'https://xeneztudcqdumfhwotry.supabase.co',
  productionAnonKey: 'production-public-key',
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
assert.match(
  authCallbackErrorMessage({
    search: '?error=access_denied&error_code=otp_expired&error_description=private+provider+details',
  }),
  /link expirou ou já foi usado/i,
);
assert.doesNotMatch(
  authCallbackErrorMessage({
    search: '?error=access_denied&error_code=otp_expired&error_description=private+provider+details',
  }),
  /private provider details/i,
);
assert.equal(authCallbackErrorMessage({ search: '' }), '');
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
assert.equal(LEGAL_DOCUMENT_VERSION, '1.4');
const termsDocument = readFileSync(new URL('../terms.html', import.meta.url), 'utf8');
const privacyDocument = readFileSync(new URL('../privacy.html', import.meta.url), 'utf8');
const accountAuthSource = readFileSync(new URL('../src/js/services/account-auth.js', import.meta.url), 'utf8');
const landingSource = readFileSync(new URL('../src/js/features/landing/view.js', import.meta.url), 'utf8');
assert.match(termsDocument, /<meta name="aurora-legal-version" content="1\.4">/);
assert.match(privacyDocument, /<meta name="aurora-legal-version" content="1\.4">/);
assert.match(termsDocument, /provedor deve permitir o acesso sem confirmação do e-mail/);
assert.doesNotMatch(termsDocument, /confirme o endereço de e-mail/);
assert.match(accountAuthSource, /não precisa confirmar o e-mail para entrar/i);
assert.match(accountAuthSource, /erro pode impedir a recuperação da senha/i);
assert.match(landingSource, /acesso é liberado assim que a conta é criada/i);
assert.match(landingSource, /erro de digitação pode impedir a recuperação da senha/i);
assert.doesNotMatch(landingSource, /acesso é liberado sem confirmação de e-mail/i);
assert.equal(hasCurrentLegalConsent({
  user_metadata: {
    terms_version: '1.4',
    privacy_policy_version: '1.4',
    terms_accepted_at: '2026-10-29T12:00:00.000Z',
  },
}), true);
assert.equal(hasCurrentLegalConsent({
  user_metadata: {
    terms_version: '1.1',
    privacy_policy_version: '1.3',
    terms_accepted_at: '2026-10-29T12:00:00.000Z',
  },
}), false);
assert.equal(hasCurrentLegalConsent({ user_metadata: null }), false);
assert.throws(() => createLegalConsentMetadata(new Date('invalid')), TypeError);
assert.equal(getOAuthRedirectUrl('https://aurora.example/pages/financas.html'), 'https://aurora.example/#inicio');
assert.equal(getOAuthRedirectUrl('http://127.0.0.1:5173/'), 'http://127.0.0.1:5173/#inicio');
assert.equal(hasCompleteAdultProfile({
  user_metadata: {
    name: 'Ana',
    preferred_name: 'Ana',
    age: 18,
    birthday_month: 10,
    birthday_day: 30,
    birthday_reference_date: '2020-10-30',
  },
}), true);
assert.equal(hasCompleteAdultProfile({
  user_metadata: {
    name: 'Ana',
    preferred_name: 'Ana',
    age: 17,
    birthday_month: 10,
    birthday_day: 30,
    birthday_reference_date: '2020-10-30',
  },
}), false);
assert.equal(hasSocialIdentity({ app_metadata: { provider: 'google' } }), true);
assert.equal(hasSocialIdentity({ identities: [{ provider: 'apple' }] }), true);
assert.equal(hasSocialIdentity({ app_metadata: { provider: 'email' } }), false);

assert.doesNotMatch(accountAuthSource, /createGenderSelect\(form/);
assert.doesNotMatch(accountAuthSource, /form\.elements\.sex\.checkValidity\(\)/);
assert.doesNotMatch(accountAuthSource, /sex:\s*profileDraft\.sex/);
assert.doesNotMatch(accountAuthSource, /auth\.resend\(/);
assert.doesNotMatch(accountAuthSource, /verify-email/);
assert.match(accountAuthSource, /confirme-a manualmente em Authentication → Users/);
assert.match(accountAuthSource, /provider: result\.oauthProvider/);
assert.match(accountAuthSource, /Continuar com Google \(Gmail\)/);
assert.doesNotMatch(accountAuthSource, /Continuar com Apple \(iCloud\)/);
assert.match(accountAuthSource, /result\.oauthProvider !== 'google'/);
assert.match(accountAuthSource, /oauth-profile/);

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
