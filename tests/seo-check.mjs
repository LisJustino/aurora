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
const countTags = (html, pattern) =>
  [...html.matchAll(pattern)].length;

for (const page of ['index.html', '404.html', 'offline.html', 'privacy.html', 'terms.html']) {
  const html = await readFile(resolve(dist, page), 'utf8');
  assert.equal(countTags(html, /<title(?:\s[^>]*)?>/gi), 1, `${page}: deve conter exatamente um title.`);
  for (const [attr, name] of [
    ['name', 'description'],
    ['name', 'robots'],
    ['property', 'og:title'],
    ['property', 'og:description'],
    ['name', 'twitter:title'],
    ['name', 'twitter:description'],
  ]) {
    const matches = countTags(html, new RegExp(`<meta\\s[^>]*${attr}="${name}"[^>]*>`, 'gi'));
    if (matches > 1) assert.fail(`${page}: meta ${attr}="${name}" está duplicada.`);
  }
  const canonicals = countTags(html, /<link\s[^>]*rel="canonical"[^>]*>/gi);
  if (canonicals > 1) assert.fail(`${page}: canonical está duplicado.`);
}
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

for (const legacyPage of [
  'agua', 'ajustes', 'ciclo', 'financas', 'habitos', 'inicio', 'perfil', 'planejar',
]) {
  await access(resolve(dist, 'pages', `${legacyPage}.html`))
    .then(() => assert.fail(`pages/${legacyPage}.html: página legada não deve ser publicada em dist/.`))
    .catch((error) => {
      if (error?.code !== 'ENOENT') throw error;
    });
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
const imageAlt = meta(home, 'property', 'og:image:alt');
assert.equal(meta(home, 'name', 'twitter:image:alt'), imageAlt);
assert.match(imageAlt, /Vamos por partes\./);
for (const area of ['Planejar', 'Hábitos', 'Finanças', 'Ciclo']) assert.ok(imageAlt.includes(area));
const socialImage = await readFile(distFile('/og/aurora-1200x630.png'));
assert.equal(socialImage.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
assert.equal(socialImage.readUInt32BE(16), 1200);
assert.equal(socialImage.readUInt32BE(20), 630);

const jsonLd = [...home.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].flatMap((m) => JSON.parse(m[1]));
const types = jsonLd.map((item) => item['@type']);
assert.ok(types.includes('SoftwareApplication'), 'JSON-LD sem SoftwareApplication.');
assert.ok(!types.includes('FAQPage'), 'FAQPage não deve gerar dados estruturados incompatíveis com os rich results atuais.');
const landingTitle = 'aurora. — tarefas, hábitos, finanças e ciclo';
const landingDescription = 'Anote o que está pendente. Escolha o que cabe hoje e deixe o resto para depois.';
assert.equal(home.match(/<title>([^<]+)<\/title>/)?.[1], landingTitle);
const searchDescription = meta(home, 'name', 'description');
assert.ok(searchDescription.length >= 130 && searchDescription.length <= 155,
  'A descrição de busca da landing deve ter aproximadamente 145 caracteres.');
assert.match(searchDescription, /Aurora é grátis e dá para experimentar sem cadastro/);
assert.equal(meta(home, 'property', 'og:title'), landingTitle);
assert.equal(meta(home, 'property', 'og:description'), landingDescription);
assert.equal(meta(home, 'name', 'twitter:title'), landingTitle);
assert.equal(meta(home, 'name', 'twitter:description'), landingDescription);
const softwareApplication = jsonLd.find((item) => item['@type'] === 'SoftwareApplication');
assert.equal(softwareApplication?.description, landingDescription);

const manifestFiles = ['manifest.webmanifest', 'manifest-light.webmanifest', 'manifest-dark.webmanifest'];
const manifests = await Promise.all(manifestFiles.map(async (file) =>
  JSON.parse(await readFile(resolve(dist, file), 'utf8'))));
const manifest = manifests[0];
const expectedShortcuts = [
  { name: 'Hoje', short_name: 'Hoje', url: './inicio' },
  { name: 'Tarefas', short_name: 'Tarefas', url: './planejar' },
  { name: 'Hábitos', short_name: 'Hábitos', url: '/habitos' },
  { name: 'Água', short_name: 'Água', url: '/habitos' },
  { name: 'Finanças', short_name: 'Finanças', url: '/financas' },
];
for (const [index, item] of manifests.entries()) {
  const shortcuts = item.shortcuts?.map(({ name, short_name, url }) => ({ name, short_name, url }));
  assert.deepEqual(shortcuts, expectedShortcuts, `${manifestFiles[index]} deve incluir os atalhos acordados, sem Ciclo.`);
  assert.deepEqual(item.shortcuts, manifest.shortcuts, `${manifestFiles[index]} deve manter atalhos idênticos.`);
  for (const shortcut of item.shortcuts) {
    for (const icon of shortcut.icons || []) {
      await assertServed(`/${icon.src.replace(/^\.\//, '')}`, `${manifestFiles[index]} shortcut icon`);
    }
  }
}
assert.equal(manifest.description, landingDescription, 'manifest deve acompanhar a promessa atual da landing.');
const tokens = await readFile(new URL('../src/css/design-system/tokens.css', import.meta.url), 'utf8');
const socialGenerator = await readFile(new URL('../scripts/generate-social-image.mjs', import.meta.url), 'utf8');
const socialGradient = socialGenerator.match(/linear-gradient\(135deg,\s*(#[\da-f]{6}) 0%,\s*(#[\da-f]{6}) 52%,\s*(#[\da-f]{6}) 100%\)/i);
assert.ok(socialGradient, 'O degradê da imagem social deve acompanhar a capa.');
for (const [index, token] of ['--public-hero-start', '--plum', '--public-hero-end'].entries()) {
  const color = tokens.match(new RegExp(`${token}:\\s*(#[\\da-f]{6})\\s*;`, 'i'))?.[1];
  assert.equal(socialGradient[index + 1], color, `${token}: a imagem social deve acompanhar a capa.`);
}
const textContent = (markup) => markup.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, '').trim();
const heroHeading = home.match(/<h1 id="landing-title">([\s\S]*?)<\/h1>/)?.[1];
const socialHeading = socialGenerator.match(/<h1>([\s\S]*?)<\/h1>/)?.[1];
assert.ok(heroHeading && socialHeading, 'Os títulos da capa e da imagem social devem existir.');
assert.equal(textContent(socialHeading), textContent(heroHeading));
const lightBackground = tokens.match(/--canvas-initial:\s*(#[\da-f]{6})\s*;/i)?.[1];
assert.ok(lightBackground, 'O fundo inicial deve estar definido nos tokens.');
assert.equal(manifest.background_color, lightBackground, 'A splash deve acompanhar o fundo inicial.');
assert.equal(manifest.theme_color, lightBackground, 'O manifesto deve acompanhar o fundo inicial.');
for (const page of ['index.html', 'privacy.html', 'terms.html']) {
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
for (const href of ['/favicon.ico', '/icons/apple-touch-icon.png', '/icons/favicon-32.png', '/icons/favicon-512.png']) {
  await assertServed(href, 'ícone');
  await assertNotRedirected(href, 'ícone');
}
const faviconPng = await readFile(distFile('/icons/favicon-512.png'));
assert.equal(faviconPng.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
assert.equal(faviconPng.readUInt32BE(16), 512);
assert.equal(faviconPng.readUInt32BE(20), 512);
for (const page of ['index.html', 'privacy.html', 'terms.html', '404.html', 'offline.html']) {
  const html = await readFile(resolve(dist, page), 'utf8');
  const faviconHref = html.match(/<link rel="icon" type="image\/png" sizes="512x512" href="([^"]*favicon-512[^"]*\.png)">/)?.[1];
  assert.ok(faviconHref, `${page}: favicon PNG de alta resolução ausente.`);
  await assertServed(new URL(faviconHref, origin).pathname, `${page}: favicon PNG`);
}

const robots = await readFile(resolve(dist, 'robots.txt'), 'utf8');
assert.ok(robots.includes(`Sitemap: ${origin}/sitemap.xml`), 'robots.txt sem referência ao sitemap.');
const sitemap = await readFile(resolve(dist, 'sitemap.xml'), 'utf8');
const sitemapPaths = [...sitemap.matchAll(/<loc>https:\/\/aurora-rotinas\.com\.br([^<]*)<\/loc>/g)]
  .map((match) => match[1]);
assert.deepEqual(sitemapPaths, ['/', '/privacy', '/terms'],
  'O sitemap deve conter somente URLs públicas canônicas, sem aliases ou redirecionamentos.');
for (const path of sitemapPaths) {
  assert.ok(sitemap.includes(`<loc>${origin}${path}</loc>`), `sitemap.xml sem ${path}.`);
}
for (const [path, page] of [['/privacy', 'privacy.html'], ['/terms', 'terms.html']]) {
  const html = await readFile(resolve(dist, page), 'utf8');
  assert.ok(html.includes(`<link rel="canonical" href="${origin}${path}">`),
    `${path}: canonical deve apontar para a própria URL indexável.`);
}

console.log('SEO: metadados, imagem social, ícones, JSON-LD, robots e sitemap verificados em dist/.');
