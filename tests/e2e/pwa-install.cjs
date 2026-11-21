const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const BASE = process.argv[2] || 'http://127.0.0.1:5173';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(BASE);
  await page.locator('.public-hero').waitFor();

  await page.evaluate(() => {
    const event = new Event('beforeinstallprompt', { cancelable: true });
    event.prompt = async () => {};
    event.userChoice = Promise.resolve({ outcome: 'accepted' });
    window.dispatchEvent(event);
  });
  assert.equal(await page.locator('#pwa-install-notice').count(), 0);

  const install = page.locator('[data-action="pwa-install"]').first();
  await install.scrollIntoViewIfNeeded();
  await install.click();
  assert.equal(await page.locator('#pwa-install-notice').isVisible(), true);

  await browser.close();
  console.log('PWA: evento não abre automaticamente e ação explícita abre instruções.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
