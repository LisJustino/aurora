const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const BASE = process.argv[2] || 'http://127.0.0.1:5179';
const OUTPUT = path.join(ROOT, 'test-results', 'visual-captures');
const PAGES = ['inicio', 'planejar', 'habitos'];
const VIEWPORTS = [
  { name: 'desktop', width: 1365, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];

async function setTheme(page, theme) {
  for (let attempt = 0; attempt < 3; attempt++) {
    if (await page.evaluate(() => document.documentElement.dataset.theme) === theme) return;
    await page.locator('.theme-trigger').click();
    await page.waitForFunction((expected) => document.documentElement.dataset.theme === expected, theme);
  }
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), theme);
  await page.getByText('Salvo nesta demonstração.').waitFor({ state: 'visible' });
}

(async () => {
  fs.mkdirSync(OUTPUT, { recursive: true });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      for (const theme of ['light', 'dark']) {
        for (const route of PAGES) {
          await page.goto(`${BASE}/?preview#${route}`);
          await page.locator('#app .main').waitFor();
          await setTheme(page, theme);
          await page.evaluate(() => document.fonts.ready);
          const layout = await page.evaluate(() => {
            const labels = [...document.querySelectorAll('.chip, .badge, .nav a, .settings-menu-heading, .section-kicker')];
            const small = labels
              .map((element) => ({ className: element.className, size: Number.parseFloat(getComputedStyle(element).fontSize) }))
              .filter(({ size }) => size < 12);
            return { overflow: document.documentElement.scrollWidth > innerWidth, small };
          });
          assert.equal(layout.overflow, false, `${route} overflows at ${viewport.width}px`);
          assert.deepEqual(layout.small, [], `${route} contains labels below 12px`);
          const file = `${route}-${theme}-${viewport.name}.png`;
          const image = await page.screenshot({
            path: path.join(OUTPUT, file),
            fullPage: true,
            animations: 'disabled',
          });
          assert.ok(image.length > 10_000, `${file} screenshot is unexpectedly small`);
          console.log(`OK — captura ${file}`);
        }
      }
    }
    assert.deepEqual(errors, [], errors.join('\n'));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
