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
        const indicator = loader.locator('.account-loading-indicator');
        await loader.waitFor({ state: 'visible' });
        const state = await loader.evaluate((element) => {
          const box = element.getBoundingClientRect();
          const content = element.querySelector('.account-loading-content').getBoundingClientRect();
          const probe = document.createElement('span');
          probe.style.backgroundColor = 'var(--loading-canvas)';
          element.append(probe);
          const canvasBackground = getComputedStyle(probe).backgroundColor;
          probe.remove();
          return {
            box: { x: box.x, y: box.y, width: box.width, height: box.height },
            content: { y: content.y, bottom: content.bottom },
            document: [document.documentElement.scrollWidth, document.documentElement.scrollHeight],
            bodyOverflow: getComputedStyle(document.body).overflowY,
            background: getComputedStyle(element).backgroundColor,
            canvasBackground,
            role: element.getAttribute('role'),
            legacyCard: element.querySelector('.loading-welcome-card'),
          };
        });
        assert.deepEqual(state.box, { x: 0, y: 0, ...viewport });
        assert.ok(
          state.content.y >= 0 && state.content.bottom <= viewport.height,
          `o conteúdo de carregamento não deve ser cortado pela viewport ${JSON.stringify(viewport)}: ${JSON.stringify(state.content)}`,
        );
        assert.deepEqual(state.document, [viewport.width, viewport.height]);
        assert.equal(state.bodyOverflow, 'hidden');
        assert.equal(state.background, state.canvasBackground);
        assert.equal(state.role, 'status');
        assert.equal(state.legacyCard, null);
        assert.equal(await loader.locator('.account-loading-message').textContent(), 'Preparando seu espaço…');
        assert.equal(await loader.locator('.account-loading-message').evaluate((element) => getComputedStyle(element, '::after').content), 'none');
        assert.equal(await loader.locator('.account-loading-brand img').getAttribute('src'), '/icons/favicon.svg');
        const start = await indicator.evaluate((element) => element.getAnimations()[0].currentTime);
        await page.waitForTimeout(100);
        assert.ok(await indicator.evaluate((element) => element.getAnimations()[0].currentTime) > start);
        await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' });
        await page.waitForTimeout(50);
        assert.equal(await indicator.evaluate((element) => getComputedStyle(element).animationName), 'none');
        const darkState = await loader.evaluate((element) => {
          const probe = document.createElement('span');
          probe.style.backgroundColor = 'var(--loading-canvas)';
          element.append(probe);
          const canvasBackground = getComputedStyle(probe).backgroundColor;
          probe.remove();
          return {
            theme: document.documentElement.dataset.theme,
            background: getComputedStyle(element).backgroundColor,
            canvasBackground,
          };
        });
        assert.equal(darkState.theme, 'dark');
        assert.equal(darkState.background, darkState.canvasBackground);
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
