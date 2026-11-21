const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const BASE = process.argv[2] || 'http://127.0.0.1:5173';

(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });

    await page.goto(BASE);
    for (const [width, height] of [
      [320, 720],
      [390, 844],
      [520, 844],
      [768, 900],
      [1280, 900],
    ]) {
      await page.setViewportSize({ width, height });
      await page.locator('.public-hero').waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true,
        `${width}px: sem overflow horizontal`);
      assert.equal(await page.locator('.landing-tutorial-tab').count(), 5);
      assert.equal(await page.locator('.landing-tutorial-panel:visible').count(), 1);
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('.public-hero [data-public-action="demo"]').click();
    await page.locator('.demo-main .home-head').waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true,
      'demonstração móvel sem overflow');
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
  console.log('Matriz mobile da landing: larguras estreitas, tablets e desktop verificadas.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
