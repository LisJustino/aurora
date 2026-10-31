const { chromium } = require('playwright');

const BASE = process.argv[2] || 'http://127.0.0.1:5173';
const results = [];
const check = (passed, name, detail = '') => {
  results.push(passed);
  console.log(`${passed ? 'OK   ' : 'FALHA'} — ${name}${detail ? ` (${detail})` : ''}`);
};

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.goto(`${BASE}/?preview#planejar`);
  const taskSearch = page.getByRole('searchbox', { name: 'Buscar tarefas' });
  await taskSearch.fill('nao-existe-aurora');
  await page.locator('#task-results .empty').waitFor({ state: 'visible' });
  check(await page.locator('#task-results').getByRole('button', { name: 'Limpar filtros' }).count() === 1, 'tarefas sem resultados oferecem limpar filtros');
  await page.locator('#task-results').getByRole('button', { name: 'Limpar filtros' }).click();
  check(await page.locator('#task-results .task').count() > 0 && await taskSearch.inputValue() === '', 'limpar filtros restaura tarefas e busca');
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Planejar não tem overflow horizontal em 390 px');

  await page.goto(`${BASE}/?preview#financas`);
  await page.getByRole('button', { name: 'Lançamentos' }).click();
  const transactionSearch = page.getByRole('searchbox', { name: 'Buscar lançamentos' });
  await transactionSearch.fill('nao-existe-aurora');
  await page.locator('#tx-results .empty').waitFor({ state: 'visible' });
  check(await page.locator('#tx-results').getByRole('button', { name: 'Limpar filtros' }).count() === 1, 'lançamentos sem resultados oferecem limpar filtros');
  await page.locator('#tx-results').getByRole('button', { name: 'Limpar filtros' }).click();
  check(await page.locator('#tx-results .grp').count() > 0 && await transactionSearch.inputValue() === '', 'limpar filtros restaura lançamentos e busca');
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Finanças não tem overflow horizontal em 390 px');

  await page.setViewportSize({ width: 1366, height: 768 });
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Finanças não tem overflow horizontal em desktop');
  check(errors.length === 0, 'sem erros no console', errors.slice(0, 3).join(' | '));

  await browser.close();
  process.exit(results.every(Boolean) ? 0 : 1);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
