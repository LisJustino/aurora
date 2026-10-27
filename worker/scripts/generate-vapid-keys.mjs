import { webcrypto } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const encode = (value) => Buffer.from(value).toString('base64url');
const pair = await webcrypto.subtle.generateKey(
  { name: 'ECDSA', namedCurve: 'P-256' },
  true,
  ['sign', 'verify'],
);
const jwk = await webcrypto.subtle.exportKey('jwk', pair.privateKey);
const publicKey = encode(Buffer.concat([
  Buffer.from([4]),
  Buffer.from(jwk.x, 'base64url'),
  Buffer.from(jwk.y, 'base64url'),
]));
const privateKey = encode(Buffer.from(jwk.d, 'base64url'));
await writeFile(
  resolve(dirname(fileURLToPath(import.meta.url)), '..', '.dev.vars'),
  `VAPID_PUBLIC_KEY=${publicKey}\nVAPID_PRIVATE_KEY=${privateKey}\nVAPID_SUBJECT=mailto:dev@example.invalid\n`,
  { flag: 'wx', mode: 0o600 },
);
console.log('Chaves gravadas em worker/.dev.vars (arquivo local ignorado pelo Git).');
