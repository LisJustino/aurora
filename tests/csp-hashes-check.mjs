import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const headers = await readFile(resolve(root, '_headers'), 'utf8');
const policy = headers.match(/^\s*Content-Security-Policy:.*?script-src\s+([^;]+)/m)?.[1];
assert.ok(policy, 'A política script-src não foi encontrada em _headers.');
const allowed = new Set(policy.split(/\s+/));

const hashOf = (text) => `'sha256-${createHash('sha256').update(text).digest('base64')}'`;
const normalize = (text) => text.replace(/\r\n?/g, '\n');

// Scripts que o build coloca inline nas páginas: o hash precisa estar em _headers.
for (const name of ['loading-appearance.js', 'landing-guard.js']) {
  const script = normalize(await readFile(resolve(root, 'public', name), 'utf8'));
  assert.ok(allowed.has(hashOf(script)), `O hash de public/${name} não está em _headers. Atualize a CSP.`);
}

// Scripts inline escritos à mão nas páginas estáticas (JSON-LD e outros dados não executam).
const pages = ['public/offline.html', '404.html', 'terms.html', 'privacy.html'];
for (const page of pages) {
  const html = normalize(await readFile(resolve(root, page), 'utf8'));
  for (const match of html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (/type=["'](?:application\/(?:ld\+)?json|importmap-data)["']/i.test(match[1])) continue;
    assert.ok(allowed.has(hashOf(match[2])), `Um script inline de ${page} não tem hash em _headers.`);
  }
}

// Todo hash listado em _headers precisa ter origem conhecida, para não acumular hashes velhos.
const known = new Set();
for (const name of ['loading-appearance.js', 'landing-guard.js']) {
  known.add(hashOf(normalize(await readFile(resolve(root, 'public', name), 'utf8'))));
}
const offline = normalize(await readFile(resolve(root, 'public/offline.html'), 'utf8'));
for (const match of offline.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)) known.add(hashOf(match[1]));
for (const hash of allowed) {
  if (hash.startsWith("'sha256-")) assert.ok(known.has(hash), `O hash ${hash} em _headers não corresponde a nenhum script atual.`);
}

console.log('csp-hashes: ok');
