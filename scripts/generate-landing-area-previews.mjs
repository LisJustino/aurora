import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));
const outputDirectory = join(root, 'public', 'assets', 'landing-areas');
const areas = [
  { id: 'hoje', route: 'inicio' },
  { id: 'tarefas', route: 'planejar' },
  { id: 'habitos', route: 'habitos' },
  { id: 'financas', route: 'financas' },
  { id: 'ciclo', route: 'ciclo' },
];
const server = await createServer({
  configFile: join(root, 'vite.config.js'),
  logLevel: 'error',
  server: { host: '127.0.0.1', port: 0 },
});
let browser;

try {
  await server.listen();
  const address = server.httpServer.address();
  if (!address || typeof address === 'string') throw new Error('Could not determine the landing preview server address.');
  const baseUrl = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch();
  await mkdir(outputDirectory, { recursive: true });

  for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      colorScheme: theme,
      reducedMotion: 'reduce',
    });
    try {
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });

      for (const area of areas) {
        const response = await page.goto(`${baseUrl}/?preview#${area.route}`, { waitUntil: 'networkidle' });
        if (!response?.ok()) throw new Error(`Could not load ${area.route}: ${response?.status()}`);
        await page.locator(`.main[data-route="${area.route}"]`).waitFor({ state: 'visible' });
        await page.evaluate(async (color) => {
          await document.fonts.ready;
          document.documentElement.setAttribute('data-theme', color);
          await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        }, theme);

        const screenshot = await page.screenshot({ type: 'png', animations: 'disabled' });
        const dataUrl = await page.evaluate(async (base64) => {
          const image = new Image();
          image.src = `data:image/png;base64,${base64}`;
          await image.decode();
          const canvas = document.createElement('canvas');
          canvas.width = image.naturalWidth;
          canvas.height = image.naturalHeight;
          canvas.getContext('2d').drawImage(image, 0, 0);
          const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.96));
          if (!blob || blob.type !== 'image/webp') throw new Error('Could not encode the mobile preview as WebP.');
          return await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(blob);
          });
        }, screenshot.toString('base64'));

        const prefix = 'data:image/webp;base64,';
        if (typeof dataUrl !== 'string' || !dataUrl.startsWith(prefix)) {
          throw new Error(`Could not encode the ${area.id} ${theme} preview.`);
        }
        const image = Buffer.from(dataUrl.slice(prefix.length), 'base64');
        if (image.length < 10_000) throw new Error(`The ${area.id} ${theme} preview is unexpectedly small.`);

        const suffix = theme === 'dark' ? '-mobile-dark.webp' : '-mobile.webp';
        const output = join(outputDirectory, `${area.id}${suffix}`);
        await writeFile(output, image);
        console.log(`Created ${output} (${image.length} bytes)`);
      }

      if (errors.length) throw new AggregateError(errors, `Could not render mobile area previews in ${theme} mode.`);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser?.close();
  await server.close();
}
