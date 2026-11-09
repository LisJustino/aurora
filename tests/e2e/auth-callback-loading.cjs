const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const BASE = process.argv[2] || 'http://127.0.0.1:4173';

(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.route('**/assets/*.js', (route) => route.abort());
    for (const viewport of [{ width: 320, height: 700 }, { width: 1280, height: 800 }]) {
      await page.setViewportSize(viewport);
      for (const path of ['/?code=callback-test', '/?error=access_denied', '/?type=recovery', '/#type=recovery']) {
        await page.goto(`${BASE}${path}`, { waitUntil: 'load' });
        assert.equal(await page.locator('.public-site').count(), 0, `${path}: a landing não deve aparecer no retorno`);
        assert.equal(await page.locator('.app-skeleton[role="status"]').isVisible(), true);
        assert.equal(await page.evaluate(() => document.documentElement.dataset.auroraAuthCallback), 'true');
        assert.equal(new URL(page.url()).search + new URL(page.url()).hash, path.slice(1));
      }
      await page.goto(`${BASE}/?utm_source=teste`, { waitUntil: 'load' });
      assert.equal(await page.locator('.public-site[data-prerendered]').isVisible(), true, 'a landing comum continua disponível');
      assert.equal(await page.evaluate(() => document.documentElement.dataset.auroraAuthCallback), undefined);
    }
    console.log('Callback: carregamento sem landing em mobile e desktop, preservando a URL.');
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
