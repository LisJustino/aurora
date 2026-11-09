import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const redirects = await readFile(new URL('../_redirects', import.meta.url), 'utf8');
const rules = redirects.split('\n').map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#'))
  .map((line) => line.split(/\s+/));
const appRoutes = [
  'inicio', 'planejar', 'pomodoro', 'financas', 'habitos', 'agua', 'ciclo',
  'config', 'ajustes', 'perfil', 'pessoal', 'academia', 'entrar', 'criar-conta',
  'esqueci-senha', 'nova-senha', 'demonstracao',
];

for (const route of appRoutes) {
  for (const suffix of ['', '/']) {
    const path = `/${route}${suffix}`;
    assert.ok(rules.some(([from, to, status]) => from === path && to === '/' && status === '200'),
      `${path}: a rota precisa servir a entrada da SPA no Cloudflare Pages.`);
  }
}
assert.ok(rules.every(([from, , status]) => !from.includes('*') && status === '200'),
  'As regras do Pages devem alcançar apenas rotas conhecidas, sem capturar recursos inexistentes.');

console.log('Cloudflare Pages: rotas conhecidas usam proxy 200 para a raiz; recursos inexistentes não são reescritos.');
