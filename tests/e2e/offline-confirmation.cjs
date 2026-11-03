const { chromium } = require('playwright');

const BASE = process.argv[2] || 'http://127.0.0.1:5173';
const results = [];
const check = (passed, name, detail = '') => {
  results.push(passed);
  console.log(`${passed ? 'OK   ' : 'FALHA'} — ${name}${detail ? ` (${detail})` : ''}`);
};

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto(`${BASE}/?preview#inicio`);

  await context.setOffline(true);
  await page.waitForFunction(() => document.querySelector('.offline-banner'));
  check(await page.locator('.offline-banner').isVisible(), 'aviso offline permanece visível');
  check((await page.locator('.offline-banner').innerText()).includes('não serão salvas'), 'aviso explicita que alterações offline não serão salvas');
  await context.setOffline(false);
  await page.waitForFunction(() => !document.querySelector('.offline-banner'));

  await page.evaluate(() => { location.hash = 'config?section=appearance'; });
  await page.waitForFunction(() => location.hash === '#config?section=appearance');
  await page.setViewportSize({ width: 1024, height: 844 });
  await page.locator('[data-action="set-theme"][aria-pressed="false"]').first().click();
  const saveSettings = page.locator('[data-settings-save-button]').last();
  await saveSettings.waitFor({ state: 'visible' });
  await page.waitForFunction(() => !document.querySelector('[data-settings-save-button]:disabled'));
  await page.locator('[data-action="reload-app"]').click();
  const reloadConfirmation = page.locator('#dlg');
  await reloadConfirmation.getByText('Há alterações que ainda não foram salvas. Recarregar pode descartá-las. Deseja continuar?').waitFor();
  await reloadConfirmation.getByRole('button', { name: 'Cancelar' }).click();
  check(await saveSettings.isEnabled(), 'cancelar recarga preserva o rascunho de ajustes');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { location.hash = 'config?section=data'; });
  await page.getByRole('button', { name: 'Exportar backup' }).click();
  const backupConfirmation = page.locator('#dlg');
  await backupConfirmation.getByText('O arquivo de backup é JSON em texto puro, sem criptografia. Ele pode conter dados financeiros, de saúde e do ciclo. Guarde-o em um local privado. Deseja continuar?').waitFor();
  await backupConfirmation.getByRole('button', { name: 'Cancelar' }).click();
  check(await backupConfirmation.count() === 0, 'cancelar exportação fecha apenas a confirmação');
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'sem overflow horizontal em 390 px');
  check(errors.length === 0, 'sem erros no console', errors.slice(0, 3).join(' | '));

  await context.close();
  await browser.close();
  process.exit(results.every(Boolean) ? 0 : 1);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
