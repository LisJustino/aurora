const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const BASE = process.argv[2] || 'http://127.0.0.1:5179';

(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.route('**/src/js/main.js*', (route) => route.abort());
    await page.route('**/src/js/public-entry.js*', (route) => route.abort());

    for (const viewport of [{ width: 1280, height: 800 }, { width: 320, height: 568 }, { width: 568, height: 320 }]) {
      await page.setViewportSize(viewport);
      for (const path of ['/', '/pages/agua.html']) {
        await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
        const loader = page.locator('#app > main');
        const spinner = loader.locator('.account-loading-indicator');
        const skeleton = loader.locator('.account-loading-skeleton');
        await loader.waitFor({ state: 'visible' });
        await page.waitForTimeout(300);
        const state = await loader.evaluate((element) => {
          const box = element.getBoundingClientRect();
          return {
            box: { x: box.x, y: box.y, width: box.width, height: box.height },
            document: [document.documentElement.scrollWidth, document.documentElement.scrollHeight],
            bodyOverflow: getComputedStyle(document.body).overflowY,
            role: element.getAttribute('role'),
            content: element.querySelector('.account-loading-content').getBoundingClientRect().toJSON(),
          };
        });
        assert.deepEqual(state.box, { x: 0, y: 0, ...viewport });
        assert.deepEqual(state.document, [viewport.width, viewport.height]);
        assert.equal(state.bodyOverflow, 'hidden');
        assert.equal(state.role, 'status');
        assert.ok(
          state.content.top >= 0 && state.content.bottom <= viewport.height,
          `${viewport.width}x${viewport.height}: ${JSON.stringify(state.content)}`,
        );
        assert.ok(state.content.left >= 0 && state.content.right <= viewport.width);
        assert.equal(await loader.locator('.account-loading-message').textContent(), 'Preparando seu espaço…');
        assert.equal(await skeleton.locator('.loading-skeleton-row').count(), 3);
        assert.equal(await skeleton.getAttribute('aria-hidden'), 'true');
        assert.equal(await skeleton.locator('.loading-skeleton-heading').evaluate((element) => getComputedStyle(element).animationName), 'account-loading-shimmer');
        const start = await spinner.evaluate((element) => element.getAnimations()[0].currentTime);
        await page.waitForTimeout(200);
        const end = await spinner.evaluate((element) => element.getAnimations()[0].currentTime);
        assert.ok(end > start, 'O indicador precisa girar enquanto a tela está carregando.');

        await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
        assert.equal(await loader.locator('.account-loading-brand-text').evaluate((element) => getComputedStyle(element).color), 'rgb(53, 27, 61)');
        await page.emulateMedia({ reducedMotion: 'reduce' });
        assert.equal(await spinner.evaluate((element) => getComputedStyle(element).animationName), 'none');
        assert.equal(await skeleton.locator('.loading-skeleton-heading').evaluate((element) => getComputedStyle(element).animationName), 'none');
        await page.emulateMedia({ reducedMotion: 'no-preference' });

        await loader.evaluate((element) => element.remove());
        assert.notEqual(await page.evaluate(() => getComputedStyle(document.body).overflowY), 'hidden');
      }
    }
    await page.goto(`${BASE}/pages/agua.html`, { waitUntil: 'networkidle' });
    const storedAppearance = {
      palette: 'customized', mode: 'light', reduceMotion: false,
      primary: '#4fb59a', accent: '#1f7a63',
    };
    await page.evaluate((value) => localStorage.setItem('aurora.loading-appearance.v1', JSON.stringify(value)), storedAppearance);
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await page.evaluate(() => document.documentElement.dataset.loadingPalette), 'customized');
    assert.equal(await page.locator('.account-loading-brand-dot').evaluate((element) => getComputedStyle(element).color), 'rgb(31, 122, 99)');
    assert.equal(await page.locator('.account-loading-brand-text').evaluate((element) => getComputedStyle(element, '::before').backgroundColor), 'rgb(31, 122, 99)');

    await page.evaluate(() => {
      const value = JSON.parse(localStorage.getItem('aurora.loading-appearance.v1'));
      value.mode = 'dark';
      value.reduceMotion = true;
      localStorage.setItem('aurora.loading-appearance.v1', JSON.stringify(value));
    });
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await page.locator('.account-loading-message').evaluate((element) => getComputedStyle(element).color), 'rgb(247, 241, 240)');
    assert.equal(await page.locator('.account-loading-indicator').evaluate((element) => getComputedStyle(element).animationName), 'none');

    await page.emulateMedia({ colorScheme: 'dark' });
    await page.evaluate(() => {
      localStorage.setItem('aurora.loading-appearance.v1', JSON.stringify({
        palette: 'rose', mode: 'auto', reduceMotion: false,
        primary: '#c8a19e', accent: '#78504c',
      }));
    });
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await page.locator('.account-loading-message').evaluate((element) => getComputedStyle(element).color), 'rgb(247, 241, 240)');
    await page.emulateMedia({ colorScheme: 'light' });
    assert.equal(await page.locator('.account-loading-message').evaluate((element) => getComputedStyle(element).color), 'rgb(53, 27, 61)');
    await page.evaluate(() => window.auroraLoadingAppearance.clear());
    assert.equal(await page.evaluate(() => localStorage.getItem('aurora.loading-appearance.v1')), null);
    assert.equal(await page.evaluate(() => document.documentElement.hasAttribute('data-loading-palette')), false);
    console.log('Carregamento: animação, tema, movimento reduzido e ausência de rolagem verificados.');
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
