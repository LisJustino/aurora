import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import './pages-routing-check.mjs';

const dist = resolve(fileURLToPath(new URL('..', import.meta.url)), 'dist');
const origin = 'https://aurora-rotinas.com.br';

const distFile = (urlPath) => resolve(dist, `.${decodeURIComponent(urlPath)}`);
const meta = (html, attr, name) =>
  html.match(new RegExp(`<meta ${attr}="${name}" content="([^"]*)"`))?.[1];
const redirectRules = (await readFile(resolve(dist, '_redirects'), 'utf8'))
  .split('\n').map((line) => line.trim()).filter((line) => line && !line.startsWith('#'))
  .map((line) => line.split(/\s+/));

assert.equal(await readFile(resolve(dist, '_redirects'), 'utf8'),
  await readFile(new URL('../_redirects', import.meta.url), 'utf8'),
  'O build deve publicar as regras de rotas atuais.');

async function assertServed(urlPath, label) {
  await access(distFile(urlPath)).catch(() => assert.fail(`${label}: ${urlPath} não existe em dist/.`));
}

async function assertNotRedirected(urlPath, label) {
  for (const [from] of redirectRules) {
    assert.notEqual(urlPath, from, `${label}: ${urlPath} não deve ser reescrito como rota da SPA.`);
  }
}

for (const page of ['index.html', 'privacy.html', 'terms.html']) {
  const html = await readFile(resolve(dist, page), 'utf8');
  const title = html.match(/<title>([^<]+)<\/title>/)?.[1];
  const description = meta(html, 'name', 'description');
  assert.ok(title && title.length <= 60, `${page}: title ausente ou acima de 60 caracteres.`);
  assert.ok(description && description.length >= 50 && description.length <= 160, `${page}: description ausente ou fora de 50–160 caracteres.`);
}

for (const page of ['pages/agua.html', 'pages/ajustes.html', 'pages/ciclo.html', 'pages/financas.html', 'pages/habitos.html', 'pages/inicio.html', 'pages/perfil.html', 'pages/planejar.html']) {
  const html = await readFile(resolve(dist, page), 'utf8');
  assert.equal(meta(html, 'name', 'robots'), 'noindex', `${page}: rota protegida deve usar noindex.`);
}

const home = await readFile(resolve(dist, 'index.html'), 'utf8');
assert.ok(home.includes('data-prerendered'), 'index.html: landing não foi pré-renderizada.');
assert.match(home, /<link rel="canonical" href="https:\/\/aurora-rotinas\.com\.br\/">/);
const appStylesheet = meta(home, 'name', 'aurora-app-css');
assert.ok(appStylesheet, 'O CSS da aplicação deve estar disponível para o cache offline.');
await assertServed(appStylesheet, 'CSS da aplicação');
const headers = await readFile(resolve(dist, '_headers'), 'utf8');
const scriptPolicy = headers.match(/^\s*Content-Security-Policy:.*?script-src\s+([^;]+)/m)?.[1];
const connectPolicy = headers.match(/^\s*Content-Security-Policy:.*?connect-src\s+([^;]+)/m)?.[1];
assert.ok(scriptPolicy?.split(/\s+/).includes('https://static.cloudflareinsights.com'),
  'A política deve autorizar o script do Cloudflare Insights.');
assert.ok(connectPolicy?.split(/\s+/).includes('https://cloudflareinsights.com'),
  'A política deve autorizar as solicitações do Cloudflare Insights.');
for (const name of ['loading-appearance.js', 'landing-guard.js']) {
  const script = (await readFile(new URL(`../public/${name}`, import.meta.url), 'utf8')).replace(/\r\n?/g, '\n');
  const hash = `'sha256-${createHash('sha256').update(script).digest('base64')}'`;
  assert.ok(home.includes(`<script>${script}</script>`), `${name} deve estar inline na landing.`);
  assert.ok(!home.includes(`<script src="/${name}"></script>`), `${name} não deve ser solicitado pela landing.`);
  assert.ok(scriptPolicy?.split(/\s+/).includes(hash), `A política deve autorizar ${name}.`);
}

for (const [attr, name] of [['property', 'og:image'], ['name', 'twitter:image']]) {
  const url = meta(home, attr, name);
  assert.ok(url?.startsWith(`${origin}/`), `${name} ausente ou fora do domínio do site.`);
  const urlPath = url.slice(origin.length);
  await assertServed(urlPath, name);
  await assertNotRedirected(urlPath, name);
}
assert.equal(meta(home, 'property', 'og:image:width'), '1200');
assert.equal(meta(home, 'property', 'og:image:height'), '630');

const jsonLd = [...home.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].flatMap((m) => JSON.parse(m[1]));
const types = jsonLd.map((item) => item['@type']);
assert.ok(types.includes('SoftwareApplication') && types.includes('FAQPage'), 'JSON-LD sem SoftwareApplication/FAQPage.');
const landingTitle = 'aurora. — tarefas, hábitos, finanças e ciclo';
const landingDescription = 'Organize tarefas, hábitos, finanças e ciclo no seu ritmo.';
assert.equal(home.match(/<title>([^<]+)<\/title>/)?.[1], landingTitle);
assert.equal(meta(home, 'name', 'description'), landingDescription);
assert.equal(meta(home, 'property', 'og:title'), landingTitle);
assert.equal(meta(home, 'property', 'og:description'), landingDescription);
assert.equal(meta(home, 'name', 'twitter:title'), landingTitle);
assert.equal(meta(home, 'name', 'twitter:description'), landingDescription);
const softwareApplication = jsonLd.find((item) => item['@type'] === 'SoftwareApplication');
assert.equal(softwareApplication?.description, landingDescription);
const landingFaq = jsonLd.find((item) => item['@type'] === 'FAQPage');
assert.equal(landingFaq?.mainEntity?.length, 5, 'FAQ estruturado deve conter apenas as perguntas essenciais.');
assert.ok(landingFaq.mainEntity.every((question) => home.includes(question.name)),
  'FAQ estruturado deve corresponder às perguntas da landing pré-renderizada.');

const manifest = JSON.parse(await readFile(resolve(dist, 'manifest.webmanifest'), 'utf8'));
assert.equal(manifest.description, landingDescription, 'manifest deve acompanhar a promessa atual da landing.');
const tokens = await readFile(new URL('../src/css/design-system/tokens.css', import.meta.url), 'utf8');
const lightBackground = tokens.match(/--canvas-initial:\s*(#[\da-f]{6})\s*;/i)?.[1];
assert.ok(lightBackground, 'O fundo inicial deve estar definido nos tokens.');
assert.equal(manifest.background_color, lightBackground, 'A splash deve acompanhar o fundo inicial.');
assert.equal(manifest.theme_color, lightBackground, 'O manifesto deve acompanhar o fundo inicial.');
for (const page of ['index.html', 'privacy.html', 'terms.html', 'pages/agua.html', 'pages/ajustes.html', 'pages/ciclo.html', 'pages/financas.html', 'pages/habitos.html', 'pages/inicio.html', 'pages/perfil.html', 'pages/planejar.html']) {
  const html = await readFile(resolve(dist, page), 'utf8');
  assert.ok(html.includes(`name="theme-color" content="${lightBackground}" media="(prefers-color-scheme: light)"`),
    `${page}: theme-color claro não corresponde ao fundo inicial.`)
}
for (const icon of manifest.icons) {
  const urlPath = `/${icon.src.replace(/^\.\//, '')}`;
  await assertServed(urlPath, 'manifest');
  await assertNotRedirected(urlPath, 'manifest');
}
assert.equal(manifest.screenshots?.length, 2, 'manifest deve incluir capturas para formatos amplo e estreito.');
for (const screenshot of manifest.screenshots) {
  const urlPath = `/${screenshot.src.replace(/^\.\//, '')}`;
  await assertServed(urlPath, 'manifest screenshot');
  await assertNotRedirected(urlPath, 'manifest screenshot');
}
await assertServed('/offline.html', 'fallback offline');
for (const href of ['/favicon.ico', '/icons/apple-touch-icon.png', '/icons/favicon-32.png']) {
  await assertServed(href, 'ícone');
  await assertNotRedirected(href, 'ícone');
}

const robots = await readFile(resolve(dist, 'robots.txt'), 'utf8');
assert.ok(robots.includes(`Sitemap: ${origin}/sitemap.xml`), 'robots.txt sem referência ao sitemap.');
const sitemap = await readFile(resolve(dist, 'sitemap.xml'), 'utf8');
for (const path of ['/', '/privacy.html', '/terms.html']) {
  assert.ok(sitemap.includes(`<loc>${origin}${path}</loc>`), `sitemap.xml sem ${path}.`);
}

console.log('SEO: metadados, imagem social, ícones, JSON-LD, robots e sitemap verificados em dist/.');
