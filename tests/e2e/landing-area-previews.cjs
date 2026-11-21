const { chromium } = require('playwright');
const assert = require('node:assert/strict');

const BASE = process.argv[2] || 'http://127.0.0.1:5173';
const areas = [
  ['hoje', 'Hoje'],
  ['tarefas', 'Tarefas'],
  ['habitos', 'Hábitos'],
  ['financas', 'Finanças'],
  ['ciclo', 'Ciclo'],
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  try {
    await page.goto(BASE);
    await page.locator('[data-landing-tutorial-panel="hoje"]').waitFor();

    for (const [id, label] of areas) {
      await page.getByRole('tab', { name: label }).click();
      const image = page.locator(`[data-landing-tutorial-panel="${id}"] picture.landing-screen-light img`);
      await image.evaluate((img) => img.decode());
      const desktop = await image.evaluate((img) => ({
        src: img.currentSrc,
        width: img.naturalWidth,
        height: img.naturalHeight,
      }));
      assert(desktop.src.endsWith(`/src/assets/tutorials/landing/${id}.webp`));
      assert.deepEqual([desktop.width, desktop.height], [1280, 720]);
    }

    for (const [width, height] of [[390, 844], [1440, 900]]) {
      await page.setViewportSize({ width, height });
      await page.evaluate((theme) => document.documentElement.setAttribute('data-theme', theme), 'light');
      for (const [id, label] of areas) {
        await page.getByRole('tab', { name: label }).click();
        const panel = page.locator(`[data-landing-tutorial-panel="${id}"]`);
        const image = panel.locator('picture.landing-screen-light img');
        await image.evaluate((img) => img.decode());
        const metrics = await image.evaluate((img) => ({
          src: img.currentSrc,
          width: img.naturalWidth,
          height: img.naturalHeight,
          renderedWidth: img.getBoundingClientRect().width,
        }));
        if (width <= 700) {
          assert(metrics.src.includes(`${id}-mobile.webp`));
          assert(metrics.width >= metrics.renderedWidth);
          assert(metrics.height > metrics.width);
        } else {
          assert(metrics.src.endsWith(`/src/assets/tutorials/landing/${id}.webp`));
        }
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      }
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    for (const [id, label] of areas) {
      await page.getByRole('tab', { name: label }).click();
      const image = page.locator(`[data-landing-tutorial-panel="${id}"] picture.landing-screen-dark img`);
      await image.evaluate((img) => img.decode());
      const source = await image.evaluate((img) => img.currentSrc);
      assert(source.includes(`${id}-mobile-dark.webp`));
    }

    assert.deepEqual(errors, []);
    console.log('OK — capturas das cinco áreas em desktop, mobile e tema escuro');
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
