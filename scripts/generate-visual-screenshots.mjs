import { mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));
const outputRoot = process.env.AURORA_VISUAL_OUTPUT_DIR
  ? resolve(process.env.AURORA_VISUAL_OUTPUT_DIR)
  : root;
const server = await createServer({
  configFile: join(root, 'vite.config.js'),
  logLevel: 'error',
  server: { host: '127.0.0.1', port: 0 },
});
let browser;
try {
  await server.listen();
  const address = server.httpServer.address();
  if (!address || typeof address === 'string') throw new Error('Could not determine the visual capture server address.');
  const baseUrl = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch();
  const captures = [
    { path: ['public', 'screenshots', 'demo-wide.png'], route: '/demonstracao', selector: '[data-demo-screen]', width: 1280, height: 720 },
    { path: ['public', 'screenshots', 'demo-mobile.png'], route: '/demonstracao', selector: '[data-demo-screen]', width: 390, height: 844 },
    { path: ['docs', 'landing-shot.png'], route: '/', selector: '.public-hero', width: 1440, height: 900, fullPage: true },
    { path: ['docs', 'landing-shot-updated.png'], route: '/', selector: '.public-hero', width: 1440, height: 900, fullPage: true },
  ];
  for (const capture of captures) {
    const context = await browser.newContext({
      viewport: { width: capture.width, height: capture.height },
      colorScheme: 'light',
      reducedMotion: 'reduce',
      deviceScaleFactor: 1,
    });
    try {
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error));
      const response = await page.goto(`${baseUrl}${capture.route}`, { waitUntil: 'networkidle' });
      if (!response?.ok()) throw new Error(`Could not load ${capture.route}: ${response?.status()}`);
      await page.locator(capture.selector).waitFor({ state: 'visible' });
      await page.evaluate(() => document.fonts.ready);
      if (errors.length) throw new AggregateError(errors, `Could not render ${capture.route}.`);
      const output = join(outputRoot, ...capture.path);
      await mkdir(dirname(output), { recursive: true });
      await page.screenshot({ path: output, fullPage: capture.fullPage || false, animations: 'disabled' });
      console.log(`Created ${output}`);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser?.close();
  await server.close();
}
