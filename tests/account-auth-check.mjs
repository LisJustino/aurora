import assert from 'node:assert/strict';
import {
  calculateAge,
  createLegalConsentMetadata,
  hasCurrentLegalConsent,
  isPasswordRecoveryCallback,
  LEGAL_DOCUMENT_VERSION,
  meetsPasswordRequirements,
} from '../src/js/services/account-auth.js';
import { resolveSupabaseConfig } from '../src/js/data/supabase-client.js';
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

assert.equal(isPasswordRecoveryCallback({ search: '?type=recovery', hash: '' }), true);
assert.equal(isPasswordRecoveryCallback({ search: '', hash: '#type=recovery' }), true);
assert.equal(isPasswordRecoveryCallback({ search: '?code=', hash: '' }), false);
assert.equal(isPasswordRecoveryCallback({ search: '', hash: '#type=signup' }), false);
assert.equal(isPasswordRecoveryCallback(null), false);

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
