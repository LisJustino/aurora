const { chromium } = require('playwright');

const BASE = process.argv[2] || 'http://127.0.0.1:5173';
const results = [];
const check = (passed, name, detail = '') => {
  results.push(passed);
  console.log(`${passed ? 'OK   ' : 'FALHA'} — ${name}${detail ? ` (${detail})` : ''}`);
};

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto(`${BASE}/?preview#planejar`);

  check(await page.locator('.planning-quick-entry').count() === 0, 'Planejar não oferece tarefa rápida');
  check(await page.getByText('Plano por etapas', { exact: true }).count() === 0, 'Planejar não oferece o fluxo por etapas');
  await page.getByRole('button', { name: 'Nova tarefa' }).first().click();
  const dialog = page.locator('#dlg [role="dialog"]');
  await dialog.waitFor({ state: 'visible' });
  check(await page.locator('#dlg input[type="time"]').count() === 1, 'formulário completo inclui o campo de horário');
  check(await page.evaluate(() => {
    const active = document.activeElement;
    return !(active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement);
  }), 'abrir modal não foca um campo nem abre o teclado');
  const timeBox = await page.locator('#dlg input[type="time"]').boundingBox();
  check(Boolean(timeBox && timeBox.x >= 0 && timeBox.x + timeBox.width <= 390), 'campo de horário cabe na largura mobile');
  await page.locator('#dlg [data-action="dlg-close"]').first().click();
  await page.setViewportSize({ width: 320, height: 568 });
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Planejar não tem overflow horizontal em 320 px');
  check(errors.length === 0, 'sem erros no console', errors.slice(0, 3).join(' | '));

  await context.close();
  await browser.close();
  process.exit(results.every(Boolean) ? 0 : 1);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
