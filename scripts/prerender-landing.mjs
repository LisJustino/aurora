import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const indexPath = resolve(root, 'dist', 'index.html');

globalThis.document = { title: '' };
const { landingMarkup } = await import(pathToFileURL(resolve(root, 'src/js/features/landing/view.js')).href);

const iconFileUrl = new URL('../icons/favicon.svg', pathToFileURL(resolve(root, 'src/js/features/landing/view.js'))).href;
const iconFileUrlFromModule = new URL('../../../../icons/favicon.svg', pathToFileURL(resolve(root, 'src/js/features/landing/view.js'))).href;
let markup = landingMarkup()
  .split(iconFileUrlFromModule).join('/icons/favicon.svg')
  .split(iconFileUrl).join('/icons/favicon.svg')
  .replace('<div class="public-site">', '<div class="public-site" data-prerendered>');

if (markup.includes('file://')) throw new Error('Landing pré-renderizada contém URL file://.');

const html = await readFile(indexPath, 'utf8');
const appHtml = await readFile(resolve(root, 'dist', 'pages', 'inicio.html'), 'utf8');
const appStylesheet = appHtml.match(/<link rel="stylesheet"[^>]*href="(\/assets\/[a-zA-Z0-9_-]+\.css)"/)?.[1];
if (!appStylesheet) throw new Error('Folha de estilos da aplicação não encontrada no build.');
const headers = await readFile(resolve(root, 'dist', '_headers'), 'utf8');
const scriptPolicy = headers.match(/^\s*Content-Security-Policy:.*?script-src\s+([^;]+)/m)?.[1];
async function inlineScript(name) {
  const script = (await readFile(resolve(root, 'public', name), 'utf8')).replace(/\r\n?/g, '\n');
  const hash = `'sha256-${createHash('sha256').update(script).digest('base64')}'`;
  if (!scriptPolicy?.split(/\s+/).includes(hash) || /<\/script/i.test(script)) {
    throw new Error(`O script ${name} inline não corresponde à política de segurança.`);
  }
  return `<script>${script}</script>`;
}
const appearance = await inlineScript('loading-appearance.js');
const guard = await inlineScript('landing-guard.js');
const appearanceTag = '<script src="/loading-appearance.js"></script>';
if (!html.includes(appearanceTag)) throw new Error('Script de aparência não encontrado em dist/index.html.');
const match = html.match(/<div id="app">([\s\S]*?)<\/div>\s*<script src="\/landing-guard\.js"><\/script>/);
if (!match) throw new Error('Marcador #app não encontrado em dist/index.html.');

const replaced = html.replace(appearanceTag, () => appearance).replace('</head>', `  <meta name="aurora-app-css" content="${appStylesheet}">\n</head>`).replace(
  match[0],
  () => `<div id="app">${markup}</div>\n  <template id="app-skeleton">${match[1]}</template>\n  ${guard}`,
);
await writeFile(indexPath, replaced);
console.log('Landing pré-renderizada em dist/index.html');
