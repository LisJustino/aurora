const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const base = process.argv[2] || 'http://127.0.0.1:5179';

(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${base}/tests/design-system-check.html`);
    await page.waitForFunction(() => !document.querySelector('#status').textContent.includes('Lendo'));
    const failures = await page.locator('#results li').filter({ hasText: 'FALHOU' }).allTextContents();
    assert.deepEqual(errors, [], 'A checagem não deve apresentar erros de JavaScript');
    assert.deepEqual(failures, [], failures.join('\n'));
    console.log(await page.locator('#status').textContent());

    await page.route('**/src/css/pages/landing.css?*', async (route) => {
      const response = await route.fetch();
      const body = await response.text();
      const exported = body.match(/^export default ("(?:\\.|[^"\\])*");?/);
      assert.ok(exported, 'O CSS deve ser carregado como texto pelo Vite');
      const css = `${JSON.parse(exported[1])}\n.spacing-probe { gap: 7px; padding: 9px; }`;
      await route.fulfill({ response, body: `export default ${JSON.stringify(css)};` });
    });
    await page.reload();
    await page.waitForFunction(() => !document.querySelector('#status').textContent.includes('Lendo'));
    const detected = await page.locator('#results li').filter({ hasText: 'FALHOU' }).allTextContents();
    assert.equal(detected.length, 2, `Esperadas duas infrações de espaçamento: ${detected.join('\n')}`);
    assert.ok(detected.some((line) => line.includes('gap:')));
    assert.ok(detected.some((line) => line.includes('padding:')));

    await page.unrouteAll();
    await page.goto(`${base}/tests/contrast-check.html`);
    await page.waitForFunction(() => Array.isArray(window.__contrastFailures));
    const contrastFailures = await page.evaluate(() => window.__contrastFailures);
    assert.deepEqual(contrastFailures, [], contrastFailures.join('\n'));
    console.log(await page.locator('#status').textContent());
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
