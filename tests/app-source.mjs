import { readFileSync, readdirSync } from 'node:fs';

// Junta o main.js e os módulos de src/js/app para os testes que conferem o código-fonte como texto
const jsDir = new URL('../src/js/', import.meta.url);

export function readAppSource() {
  const modules = readdirSync(new URL('app/', jsDir)).filter((f) => f.endsWith('.js')).sort();
  const parts = [readFileSync(new URL('main.js', jsDir), 'utf8')];
  for (const file of modules) parts.push(readFileSync(new URL(`app/${file}`, jsDir), 'utf8'));
  return parts.join('\n');
}
