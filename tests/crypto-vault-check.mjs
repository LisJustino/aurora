import assert from 'node:assert/strict';
import {
  createVault,
  decryptAccountSlice,
  encryptAccountSlice,
  unlockVaultWithPassword,
  unlockVaultWithRecovery,
} from '../src/js/services/crypto-vault.js';

const userId = 'c4827d44-9e90-4c09-95a0-6128bd7c839c';
const envelope = {
  v: { cycleLog: { '2026-01-03': { sexualActivity: true } }, finance: { cents: 2450 } },
  t: 1_767_430_000_000,
};
const vault = await createVault('Aurora secure test passphrase 2026!', userId);

assert.equal(vault.dataKey.extractable, false);
assert.equal(vault.record.key_version, 1);
assert.equal(vault.recoveryKey.length, 43);
assert.equal(vault.record.password_wrap.ciphertext.length, 64);
assert.equal(vault.record.recovery_wrap.ciphertext.length, 64);

const encrypted = await encryptAccountSlice(vault.dataKey, userId, 'finance', envelope);
assert.deepEqual(Object.keys(encrypted).sort(), ['ciphertext', 'iv', 'v']);
assert.equal(JSON.stringify(encrypted).includes('sexualActivity'), false);
assert.deepEqual(await decryptAccountSlice(vault.dataKey, userId, 'finance', encrypted), envelope);

const sameValueAgain = await encryptAccountSlice(vault.dataKey, userId, 'finance', envelope);
assert.notEqual(sameValueAgain.iv, encrypted.iv);
await assert.rejects(decryptAccountSlice(vault.dataKey, 'another-user', 'finance', encrypted));
await assert.rejects(decryptAccountSlice(vault.dataKey, userId, 'cycleLog', encrypted));

const tamperedCiphertext = `${encrypted.ciphertext[0] === 'A' ? 'B' : 'A'}${encrypted.ciphertext.slice(1)}`;
const tampered = { ...encrypted, ciphertext: tamperedCiphertext };
await assert.rejects(decryptAccountSlice(vault.dataKey, userId, 'finance', tampered));

const passwordKey = await unlockVaultWithPassword(
  'Aurora secure test passphrase 2026!',
  vault.record,
  userId,
);
assert.deepEqual(await decryptAccountSlice(passwordKey, userId, 'finance', encrypted), envelope);
await assert.rejects(unlockVaultWithPassword('incorrect password', vault.record, userId));

const recoveryKey = await unlockVaultWithRecovery(vault.recoveryKey, vault.record, userId);
assert.deepEqual(await decryptAccountSlice(recoveryKey, userId, 'finance', encrypted), envelope);
const wrongRecoveryKey = `${vault.recoveryKey[0] === 'A' ? 'B' : 'A'}${vault.recoveryKey.slice(1)}`;
await assert.rejects(unlockVaultWithRecovery(wrongRecoveryKey, vault.record, userId));

console.log('crypto-vault-check: all checks passed');
