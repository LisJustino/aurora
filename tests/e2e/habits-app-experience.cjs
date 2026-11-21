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

  await page.goto(`${BASE}/?preview#habitos`);
  await page.locator('.main[data-route="habitos"]').waitFor();

  const waterShortcut = page.locator('[data-action="water-new"], [data-action="habit-new"][data-kind="water"]').first();
  if (await waterShortcut.count()) {
    await waterShortcut.click();
  }
  await page.locator('.main[data-route="habitos"]').waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);

  await page.locator('[data-action="habit-new"]').first().click();
  await page.locator('#dlgform [data-dlg="name"]').fill('Alongar por cinco minutos');
  for (const day of await page.locator('#dlgform [name="days"]').all()) {
    if (!await day.isChecked()) await day.check();
  }
  await page.locator('button[form="dlgform"][type="submit"]').click();
  await page.locator('.habit-row[data-habit-id]').first().waitFor();

  assert.equal(await page.locator('.habit-row[data-habit-id]').count() > 0, true);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.deepEqual(errors, []);

  await browser.close();
  console.log('Hábitos: criação, hidratação, responsividade e erros de execução verificados.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
