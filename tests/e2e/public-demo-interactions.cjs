const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const BASE = process.argv[2] || 'http://127.0.0.1:5173';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.goto(BASE);
  await page.locator('.public-hero').waitFor();

  assert.equal(await page.locator('.public-hero h1').count(), 1);
  assert.equal(await page.locator('.landing-tutorial-tab').count(), 5);
  assert.equal(await page.locator('.landing-tutorial-panel:visible').count(), 1);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);

  await page.keyboard.press('Tab');
  assert.equal(await page.locator('.public-site > .skip:first-child').evaluate((link) =>
    document.activeElement === link && link.getAttribute('href') === '#landing-main'), true);

  const themeButton = page.locator('[data-public-control="theme-cycle"]');
  await themeButton.click();
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'dark');
  await themeButton.click();
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), undefined);
  await themeButton.click();
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'light');

  const tabs = page.getByRole('tablist', { name: 'Áreas da sua rotina' });
  await tabs.getByRole('tab', { name: 'Hoje' }).click();
  await tabs.getByRole('tab', { name: 'Tarefas' }).click();
  assert.equal(await tabs.getByRole('tab', { name: 'Tarefas' }).getAttribute('aria-selected'), 'true');
  assert.equal(await page.locator('.landing-tutorial-panel:visible').getAttribute('data-area'), 'tarefas');

  const faq = page.locator('.public-faq-item').first();
  await faq.locator('summary').click();
  assert.equal(await faq.evaluate((item) => item.open), true);

  await page.setViewportSize({ width: 320, height: 720 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.deepEqual(errors, []);

  await browser.close();
  console.log('Landing atual: hero, abas, tema, FAQ e responsividade verificados.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
