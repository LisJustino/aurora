import { cp, copyFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const output = resolve(root, 'dist');
const outputAssets = resolve(output, 'src', 'assets');

await mkdir(output, { recursive: true });
await mkdir(outputAssets, { recursive: true });
await Promise.all([
  cp(resolve(root, 'icons'), resolve(output, 'icons'), { recursive: true }),
  copyFile(resolve(root, 'service-worker.js'), resolve(output, 'service-worker.js')),
  copyFile(resolve(root, 'manifest.webmanifest'), resolve(output, 'manifest.webmanifest')),
  copyFile(resolve(root, '404.html'), resolve(output, '404.html')),
  copyFile(resolve(root, '_headers'), resolve(output, '_headers')),
  copyFile(resolve(root, '_redirects'), resolve(output, '_redirects')),
  copyFile(resolve(root, 'src', 'assets', 'landing-desktop.png'), resolve(outputAssets, 'landing-desktop.png')),
  copyFile(resolve(root, 'src', 'assets', 'landing-mobile.png'), resolve(outputAssets, 'landing-mobile.png')),
]);
