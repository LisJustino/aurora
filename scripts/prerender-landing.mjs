import { readFile, writeFile } from 'node:fs/promises';
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
const match = html.match(/<div id="app">([\s\S]*?)<\/div>\s*<script src="\/landing-guard\.js"><\/script>/);
if (!match) throw new Error('Marcador #app não encontrado em dist/index.html.');

const replaced = html.replace(
  match[0],
  `<div id="app">${markup}</div>\n  <template id="app-skeleton">${match[1]}</template>\n  <script src="/landing-guard.js"></script>`,
);
await writeFile(indexPath, replaced);
console.log('Landing pré-renderizada em dist/index.html');
