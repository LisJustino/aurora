import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));
const outputDirectory = join(root, 'public', 'assets', 'landing-areas');
const heroOutputDirectory = join(root, 'src', 'assets');
const tutorialOutputDirectory = join(root, 'src', 'assets', 'tutorials', 'landing');
const areas = [
  { id: 'hoje', route: 'inicio' },
  { id: 'tarefas', route: 'planejar' },
  { id: 'habitos', route: 'habitos' },
  { id: 'financas', route: 'financas' },
  { id: 'ciclo', route: 'ciclo' },
];

async function encodeWebp(page, screenshot, quality) {
  const dataUrl = await page.evaluate(async ({ base64, q }) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    canvas.getContext('2d').drawImage(image, 0, 0);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', q));
    if (!blob || blob.type !== 'image/webp') throw new Error('Could not encode preview as WebP.');
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }, { base64: screenshot.toString('base64'), q: quality });
  const prefix = 'data:image/webp;base64,';
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith(prefix)) {
    throw new Error('Could not encode preview as WebP.');
  }
  const image = Buffer.from(dataUrl.slice(prefix.length), 'base64');
  if (image.length < 10_000) throw new Error('Generated WebP preview is unexpectedly small.');
  return image;
}

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
  await mkdir(tutorialOutputDirectory, { recursive: true });

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
          document.querySelectorAll('.main > .notice').forEach((node) => {
            node.hidden = true;
          });
          const heading = document.querySelector('.home-head h1');
          if (heading) {
            const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT);
            for (let node = walker.nextNode(); node; node = walker.nextNode()) {
              if (node.textContent.includes('Pessoa')) {
                node.textContent = node.textContent.replace('Pessoa', 'Elisa');
              }
            }
          }
          await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        }, theme);

        const screenshot = await page.screenshot({ type: 'png', animations: 'disabled' });
        const image = await encodeWebp(page, screenshot, 0.96);

        const suffix = theme === 'dark' ? '-mobile-dark.webp' : '-mobile.webp';
        const output = join(outputDirectory, `${area.id}${suffix}`);
        await writeFile(output, image);
        console.log(`Created ${output} (${image.length} bytes)`);
        if (area.id === 'hoje') {
          const heroMobile = join(heroOutputDirectory, `landing${suffix}`);
          await writeFile(heroMobile, image);
          console.log(`Created ${heroMobile} (${image.length} bytes)`);
        }
      }

      if (errors.length) throw new AggregateError(errors, `Could not render mobile area previews in ${theme} mode.`);
    } finally {
      await context.close();
    }

    const tutorialDesktopContext = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: 1,
      colorScheme: theme,
      reducedMotion: 'reduce',
    });
    try {
      const page = await tutorialDesktopContext.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });

      for (const area of areas) {
        const response = await page.goto(`${baseUrl}/?preview#${area.route}`, { waitUntil: 'networkidle' });
        if (!response?.ok()) throw new Error(`Could not load desktop ${area.route}: ${response?.status()}`);
        await page.locator(`.main[data-route="${area.route}"]`).waitFor({ state: 'visible' });
        await page.evaluate(async (color) => {
          await document.fonts.ready;
          document.documentElement.setAttribute('data-theme', color);
          document.documentElement.style.scrollbarGutter = 'auto';
          document.documentElement.style.overflow = 'hidden';
          document.querySelectorAll('.main > .notice').forEach((node) => {
            node.hidden = true;
          });
          const heading = document.querySelector('.home-head h1');
          if (heading) {
            const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT);
            for (let node = walker.nextNode(); node; node = walker.nextNode()) {
              if (node.textContent.includes('Pessoa')) {
                node.textContent = node.textContent.replace('Pessoa', 'Elisa');
              }
            }
          }
          await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        }, theme);

        const screenshot = await page.screenshot({ type: 'png', animations: 'disabled' });
        const image = await encodeWebp(page, screenshot, 0.94);

        const tutorialSuffix = theme === 'dark' ? '-dark.webp' : '.webp';
        const tutorialOutput = join(tutorialOutputDirectory, `${area.id}${tutorialSuffix}`);
        await writeFile(tutorialOutput, image);
        console.log(`Created ${tutorialOutput} (${image.length} bytes)`);
      }

      if (errors.length) throw new AggregateError(errors, `Could not render desktop area previews in ${theme} mode.`);
    } finally {
      await tutorialDesktopContext.close();
    }

    const desktopHeroContext = await browser.newContext({
      viewport: { width: 1280, height: 760 },
      deviceScaleFactor: 2,
      colorScheme: theme,
      reducedMotion: 'reduce',
    });
    try {
      const page = await desktopHeroContext.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });

      const response = await page.goto(`${baseUrl}/?preview#inicio`, { waitUntil: 'networkidle' });
      if (!response?.ok()) throw new Error(`Could not load desktop hero: ${response?.status()}`);
      await page.locator('.main[data-route="inicio"]').waitFor({ state: 'visible' });
      await page.evaluate(async (color) => {
        await document.fonts.ready;
        document.documentElement.setAttribute('data-theme', color);
        document.documentElement.style.scrollbarGutter = 'auto';
        document.documentElement.style.overflow = 'hidden';
        document.querySelectorAll('.main > .notice').forEach((node) => {
          node.hidden = true;
        });
        const heading = document.querySelector('.home-head h1');
        if (heading) {
          const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT);
          for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            if (node.textContent.includes('Pessoa')) {
              node.textContent = node.textContent.replace('Pessoa', 'Elisa');
            }
          }
        }
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      }, theme);

      const screenshot = await page.screenshot({ type: 'png', animations: 'disabled' });
      const image = await encodeWebp(page, screenshot, 0.94);

      const desktopName = theme === 'dark' ? 'landing-desktop-dark.webp' : 'landing-desktop.webp';
      const desktopOutput = join(heroOutputDirectory, desktopName);
      await writeFile(desktopOutput, image);
      console.log(`Created ${desktopOutput} (${image.length} bytes)`);

      if (errors.length) throw new AggregateError(errors, `Could not render desktop hero in ${theme} mode.`);
    } finally {
      await desktopHeroContext.close();
    }
  }
} finally {
  await browser?.close();
  await server.close();
}
