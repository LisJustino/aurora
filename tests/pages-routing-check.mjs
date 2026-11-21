import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const redirects = await readFile(new URL('../_redirects', import.meta.url), 'utf8');
const rules = redirects.split('\n').map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#'))
  .map((line) => line.split(/\s+/));
const canonicalRoutes = ['inicio', 'planejar', 'financas', 'habitos', 'ciclo', 'ajustes', 'entrar', 'criar-conta', 'esqueci-senha', 'nova-senha', 'demonstracao'];
for (const route of canonicalRoutes) {
  assert.ok(rules.some(([from, to, status]) => from === `/${route}` && to === '/' && status === '200'),
    `/${route}: a rota precisa servir a entrada da SPA no Cloudflare Pages.`);
  assert.ok(rules.some(([from, to, status]) => from === `/${route}/` && to === `/${route}` && status === '301'),
    `/${route}/: a barra final deve redirecionar para a URL canônica.`);
}
for (const section of ['perfil', 'aparencia', 'inicio', 'areas', 'dados', 'agendas', 'apoio', 'conta']) {
  assert.ok(rules.some(([from, to, status]) => from === `/ajustes/${section}` && to === '/' && status === '200'),
    `/ajustes/${section}: a seção precisa servir a entrada da SPA no Cloudflare Pages.`);
  assert.ok(rules.some(([from, to, status]) => from === `/ajustes/${section}/` && to === `/ajustes/${section}` && status === '301'),
    `/ajustes/${section}/: a barra final deve redirecionar para a URL canônica.`);
}

const redirectTargets = {
  '/agua': '/habitos',
  '/config': '/ajustes',
  '/perfil': '/ajustes/perfil',
  '/pessoal': '/inicio',
  '/academia': '/inicio',
  '/pomodoro': '/inicio',
  '/pages/inicio.html': '/inicio',
  '/pages/planejar.html': '/planejar',
  '/pages/financas.html': '/financas',
  '/pages/habitos.html': '/habitos',
  '/pages/agua.html': '/habitos',
  '/pages/ciclo.html': '/ciclo',
  '/pages/perfil.html': '/ajustes/perfil',
  '/pages/ajustes.html': '/ajustes',
};
for (const [from, to] of Object.entries(redirectTargets)) {
  assert.ok(rules.some(([ruleFrom, ruleTo, status]) => ruleFrom === from && ruleTo === to && status === '301'),
    `${from}: rota legada deve redirecionar 301 para ${to}.`);
}
for (const route of ['/privacy', '/terms']) {
  assert.ok(!rules.some(([from]) => from === route),
    `${route}: a rota limpa de documento não deve redirecionar para o arquivo .html.`);
  assert.ok(rules.some(([from, to, status]) => from === `${route}/` && to === route && status === '301'),
    `${route}/: a barra final deve redirecionar para a URL canônica sem .html.`);
}
assert.ok(rules.some(([from, to, status]) => from === '/*' && to === '/404.html' && status === '404'),
  'URLs desconhecidas devem usar a página 404 com status HTTP 404.');
assert.ok(rules.filter(([from]) => from.includes('*')).every(([from, to, status]) =>
  from === '/*' && to === '/404.html' && status === '404'),
  'Não deve haver wildcard da SPA que torne recursos ou páginas desconhecidas em 200.');

console.log('Cloudflare Pages: rotas conhecidas usam proxy 200 para a raiz; recursos inexistentes não são reescritos.');
