import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { decryptBackup, encryptBackup, isEncryptedBackup } from '../src/js/features/backup/crypto.js';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

const source = JSON.stringify({
  app: 'aurora',
  version: 2,
  data: { tasks: [{ id: 'task-1', title: 'Plano privado' }] },
});
const password = 'senha forte de exemplo';
const serialized = await encryptBackup(source, password);
const envelope = JSON.parse(serialized);

assert.equal(isEncryptedBackup(envelope), true);
assert.equal(await decryptBackup(envelope, password), source);
assert.equal(isEncryptedBackup(JSON.parse(source)), false);
await assert.rejects(() => decryptBackup(envelope, 'senha completamente errada'), /Senha incorreta/);

const tampered = structuredClone(envelope);
const tamperedCiphertext = [...tampered.cipher.ciphertext];
const tamperIndex = Math.floor(tamperedCiphertext.length / 2);
tamperedCiphertext[tamperIndex] = tamperedCiphertext[tamperIndex] === 'A' ? 'B' : 'A';
tampered.cipher.ciphertext = tamperedCiphertext.join('');
await assert.rejects(() => decryptBackup(tampered, password), /Senha incorreta ou backup danificado/);
await assert.rejects(() => encryptBackup(source, 'curta'), /12 a 72 caracteres/);
await assert.rejects(() => decryptBackup({ ...envelope, kdf: { ...envelope.kdf, iterations: 1 } }, password), /inválido/);

console.log('Backup criptografado: compatibilidade de formato, round-trip e falhas verificados.');
