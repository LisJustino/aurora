import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = resolve(fileURLToPath(new URL('..', import.meta.url)), 'dist');
const origin = 'https://aurora-rotinas.com.br';

const distFile = (urlPath) => resolve(dist, `.${decodeURIComponent(urlPath)}`);
const meta = (html, attr, name) =>
  html.match(new RegExp(`<meta ${attr}="${name}" content="([^"]*)"`))?.[1];

async function assertServed(urlPath, label) {
  await access(distFile(urlPath)).catch(() => assert.fail(`${label}: ${urlPath} não existe em dist/.`));
}

async function assertNotRedirected(urlPath, label) {
  const rules = (await readFile(resolve(dist, '_redirects'), 'utf8')).split('\n').map((l) => l.trim()).filter(Boolean);
  for (const rule of rules) {
    const [from, , status] = rule.split(/\s+/);
    if (status !== '404' || !from.endsWith('/*')) continue;
    assert.ok(!urlPath.startsWith(from.slice(0, -1)), `${label}: ${urlPath} cai na regra bloqueada "${rule}".`);
  }
}

for (const page of ['index.html', 'privacy.html', 'terms.html']) {
  const html = await readFile(resolve(dist, page), 'utf8');
  const title = html.match(/<title>([^<]+)<\/title>/)?.[1];
  const description = meta(html, 'name', 'description');
  assert.ok(title && title.length <= 60, `${page}: title ausente ou acima de 60 caracteres.`);
  assert.ok(description && description.length >= 50 && description.length <= 160, `${page}: description ausente ou fora de 50–160 caracteres.`);
}

const home = await readFile(resolve(dist, 'index.html'), 'utf8');
assert.ok(home.includes('data-prerendered'), 'index.html: landing não foi pré-renderizada.');
assert.match(home, /<link rel="canonical" href="https:\/\/aurora-rotinas\.com\.br\/">/);

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
assert.ok(types.includes('WebApplication') && types.includes('FAQPage'), 'JSON-LD sem WebApplication/FAQPage.');

const manifest = JSON.parse(await readFile(resolve(dist, 'manifest.webmanifest'), 'utf8'));
for (const icon of manifest.icons) {
  const urlPath = `/${icon.src.replace(/^\.\//, '')}`;
  await assertServed(urlPath, 'manifest');
  await assertNotRedirected(urlPath, 'manifest');
}
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
