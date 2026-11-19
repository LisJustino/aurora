const { chromium } = require('playwright');
const assert = require('node:assert/strict');

const base = process.argv[2] || 'http://127.0.0.1:5173';
const blockSelectors = [
  ['today', '.home-today-block'],
  ['habits', '.home-habits-block'],
  ['summary', '.home-day-summary'],
  ['quick', '.home-quick-card'],
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  try {
    await page.goto(`${base}/?preview#inicio`);
    await page.locator('.home-today-block').waitFor();

    for (const [mode, visible, expectedOrder] of [
      ['focus', ['today', 'quick'], ['today', 'quick']],
      ['routine', ['today', 'habits', 'summary'], ['today', 'summary']],
      ['overview', ['today', 'habits', 'summary', 'quick'], ['today', 'summary', 'quick']],
    ]) {
      await page.locator('.header-account-trigger:visible').click();
      await page.locator('.header-account-panel a[href="/config"]').click();
      await page.locator('.settings-menu [data-settings-tab="home"]').click();
      await page.locator(`[data-action="home-mode"][data-home-mode="${mode}"]`).click();
      await page.getByText('Salvo nesta demonstração.').waitFor({ state: 'visible' });
      await page.locator('.nav > a[href="/inicio"]').click();
      await page.locator('.home-today-block').waitFor();

      for (const [id, selector] of blockSelectors) {
        assert.equal(await page.locator(selector).count(), visible.includes(id) ? 1 : 0, `${mode}: ${id} visibility`);
      }

      const actualOrder = await page.locator('.home-primary').evaluate(
        (grid, selectors) => [...grid.children]
          .filter((element) => element.offsetParent !== null)
          .sort((left, right) => left.getBoundingClientRect().top - right.getBoundingClientRect().top)
          .map((element) => selectors.find(([, selector]) => element.matches(selector))?.[0]),
        blockSelectors,
      );
      assert.deepEqual(actualOrder, expectedOrder, `${mode}: visible block order`);
      console.log(`${mode}: visibilidade e ordem OK`);
    }

    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
