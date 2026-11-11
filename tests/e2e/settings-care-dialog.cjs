const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const base = process.argv[2] || 'http://127.0.0.1:5173';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    await page.goto(`${base}/?preview#config`);
    await page.locator('.profile-settings-actions').waitFor();
    assert.equal(await page.locator('.profile-settings-actions').evaluate((element) => getComputedStyle(element).position), 'static');
    assert.equal(await page.locator('.settings-unsaved-bar').evaluate((element) => getComputedStyle(element).position), 'static');
    await page.locator('[data-settings-tab="mental-health"]').click();
    assert.match(await page.locator('#settings-content').innerText(), /UBS/);
    assert.equal(await page.locator('#settings-content a[href="tel:188"]').count(), 1);
    assert.equal(await page.locator('#settings-content a[href="tel:192"]').count(), 1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);

    await page.goto(`${base}/?preview#planejar`);
    await page.getByRole('button', { name: 'Nova tarefa' }).first().click();
    await page.locator('#dlg [data-dlg="title"]').waitFor();
    await page.locator('#dlg .task-notes summary').click();
    const result = await page.evaluate(async () => {
      const viewport = window.visualViewport;
      Object.defineProperty(viewport, 'height', { configurable: true, value: 500 });
      const input = document.querySelector('#dlg [data-dlg="notes"]');
      input.focus({ preventScroll: true });
      input.closest('.dlg-body').scrollTop = 0;
      viewport.dispatchEvent(new Event('resize'));
      await new Promise((resolve) => setTimeout(resolve, 300));
      const bounds = input.getBoundingClientRect();
      const body = input.closest('.dlg-body').getBoundingClientRect();
      return { top: bounds.top, bottom: bounds.bottom, bodyTop: body.top, bodyBottom: body.bottom };
    });
    assert(result.top >= result.bodyTop && result.bottom <= Math.min(result.bodyBottom, 500));
    assert.deepEqual(errors, []);
    console.log('OK — apoio psicológico, ações do perfil e campo visível com viewport reduzido');
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
