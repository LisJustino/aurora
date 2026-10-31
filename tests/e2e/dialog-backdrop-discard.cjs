const assert = require('node:assert/strict');
const { chromium, devices } = require('playwright');
const { completeProfile } = require('./setup.cjs');

async function verifyBackdropDiscard(browser, name, options, base) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  try {
    await page.goto(base.toString());
    await completeProfile(page);
    await page.evaluate(() => { location.hash = 'planejar'; });
    await page.locator('[data-action="task-new"]').click();
    await page.locator('#dlg[data-dialog-type="task"]').waitFor();
    await page.locator('#dlg [data-dlg="title"]').fill('Rascunho de teste');
    await page.locator('#dlg').click({ position: { x: 2, y: 2 } });
    await page.locator('#dlg[data-dialog-type="discard"]').waitFor();
    assert.match(await page.locator('#dlg').innerText(), /Se sair agora, elas serão perdidas\./);

    await page.locator('[data-action="dlg-keep"]').click();
    assert.equal(await page.locator('#dlg [data-dlg="title"]').inputValue(), 'Rascunho de teste');
    await page.locator('#dlg').click({ position: { x: 2, y: 2 } });
    await page.locator('[data-action="dlg-discard"]').click();
    await page.locator('#dlg').waitFor({ state: 'detached' });
    assert.deepEqual(errors, [], `${name}: erro de JavaScript`);
    console.log(`${name}: clicar fora avisa, mantém ou descarta o rascunho corretamente.`);
  } finally {
    await context.close();
  }
}

(async () => {
  const browser = await chromium.launch();
  const base = new URL((process.argv[2] || 'http://localhost:8765').replace(/\/$/, '/'));
  base.searchParams.set('preview', '1');

  try {
    await verifyBackdropDiscard(browser, 'celular', devices['iPhone 14'], base);
    await verifyBackdropDiscard(browser, 'desktop', { viewport: { width: 1280, height: 900 } }, base);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
