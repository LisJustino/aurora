const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const BASE = process.argv[2] || 'http://127.0.0.1:5179';

(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.addInitScript(() => {
      window.loadingStorageCalls = [];
      for (const method of ['getItem', 'setItem', 'removeItem']) {
        const original = Storage.prototype[method];
        Storage.prototype[method] = function (key, ...args) {
          if (key === 'aurora.loading-appearance.v1') window.loadingStorageCalls.push(method);
          return original.call(this, key, ...args);
        };
      }
    });
    await page.route('**/src/js/main.js*', (route) => route.abort());
    await page.route('**/src/js/public-entry.js*', (route) => route.abort());

    for (const viewport of [{ width: 1280, height: 800 }, { width: 320, height: 568 }, { width: 568, height: 320 }]) {
      await page.setViewportSize(viewport);
      for (const path of ['/', '/pages/agua.html']) {
        await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'no-preference' });
        await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
        const loader = page.locator('#app > main');
        const spinner = loader.locator('.account-loading-indicator');
        const skeleton = loader.locator('.account-loading-skeleton');
        await loader.waitFor({ state: 'visible' });
        const state = await loader.evaluate((element) => {
          const box = element.getBoundingClientRect();
          return {
            box: { x: box.x, y: box.y, width: box.width, height: box.height },
            document: [document.documentElement.scrollWidth, document.documentElement.scrollHeight],
            bodyOverflow: getComputedStyle(document.body).overflowY,
            background: getComputedStyle(element).backgroundColor,
            role: element.getAttribute('role'),
          };
        });
        assert.deepEqual(state.box, { x: 0, y: 0, ...viewport });
        assert.deepEqual(state.document, [viewport.width, viewport.height]);
        assert.equal(state.bodyOverflow, 'hidden');
        assert.equal(state.background, 'rgb(248, 248, 246)');
        assert.equal(state.role, 'status');
        assert.equal(await loader.locator('.account-loading-message').textContent(), 'Preparando seu espaço…');
        assert.equal(await loader.locator('.account-loading-message').evaluate((element) => getComputedStyle(element, '::after').content), 'none');
        assert.equal(await loader.locator('.account-loading-brand img').getAttribute('src'), '/icons/favicon.svg');
        assert.equal(await skeleton.getAttribute('aria-hidden'), 'true');
        assert.equal(await skeleton.locator('.loading-skeleton-hero').count(), 1);
        assert.equal(await skeleton.locator('.loading-skeleton-card').count(), 2);
        const start = await spinner.evaluate((element) => element.getAnimations()[0].currentTime);
        await page.waitForTimeout(100);
        assert.ok(await spinner.evaluate((element) => element.getAnimations()[0].currentTime) > start);
        await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' });
        assert.equal(await spinner.evaluate((element) => getComputedStyle(element).animationName), 'none');
        assert.equal(await loader.evaluate((element) => getComputedStyle(element).backgroundColor), 'rgb(28, 27, 25)');
        assert.deepEqual(await page.evaluate(() => window.loadingStorageCalls), []);
        await loader.evaluate((element) => element.remove());
        assert.notEqual(await page.evaluate(() => getComputedStyle(document.body).overflowY), 'hidden');
      }
    }

    await page.goto(`${BASE}/pages/agua.html`, { waitUntil: 'networkidle' });
    assert.match(await page.locator('link[rel="manifest"]').getAttribute('href'), /manifest-dark\.webmanifest$/);
    await page.evaluate(() => window.auroraManifestTheme.setMode('light'));
    assert.match(await page.locator('link[rel="manifest"]').getAttribute('href'), /manifest-light\.webmanifest$/);
    await page.evaluate(() => window.auroraManifestTheme.setMode('auto'));
    await page.emulateMedia({ colorScheme: 'light' });
    await page.waitForFunction(() => document.querySelector('link[rel="manifest"]').href.endsWith('manifest-light.webmanifest'));
    assert.match(await page.locator('link[rel="manifest"]').getAttribute('href'), /manifest-light\.webmanifest$/);
    assert.deepEqual(await page.evaluate(() => window.loadingStorageCalls), []);
    console.log('Carregamento: layout, temas, movimento reduzido, manifesto e ausência de armazenamento verificados.');
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
