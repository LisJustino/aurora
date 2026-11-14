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
  await page.locator('[data-action="plan-view"][data-v="revisao"]').click();
  check(await page.locator('.weekly-review').count() === 1
    && await page.locator('.weekly-review-hero').getByText('Sua semana.').count() === 1
    && await page.locator('.weekly-review .review-stats .stat').count() === 3
    && await page.locator('.weekly-review textarea').count() === 0,
  'revisão mostra o período e exatamente três números, sem campo para guardar respostas');
  check(await page.locator('.weekly-review').getByText(/Ciclo|Finanças|peso/i).count() === 0,
    'a revisão não exibe dados de Ciclo, finanças ou peso');

  await page.locator('.weekly-review [data-action="weekly-note"][data-v="Mais pausas"]').click();
  check((await page.locator('#toast').textContent()).includes('Anotação adicionada à sua lista de tarefas'),
    'resposta rápida cria somente uma anotação na lista de tarefas');
  await page.locator('[data-action="plan-view"][data-v="lista"]').click();
  check(await page.locator('#task-results li.task').filter({ hasText: 'Mais pausas' }).count() === 1,
    'a anotação aparece na lista de tarefas');
  await page.locator('[data-action="weekly-open-review"]').click();
  check(await page.locator('.weekly-review').count() === 1,
    'Planejar oferece um atalho para abrir Sua semana');

  const mobileLayout = await page.evaluate(() => ({
    width: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  check(mobileLayout.scrollWidth <= mobileLayout.width,
    'a revisão não cria rolagem horizontal em largura móvel', JSON.stringify(mobileLayout));

  await page.goto(`${BASE}/?preview#config?section=home`);
  const reminder = page.locator('[data-change="weekly-review-reminder"]');
  await reminder.waitFor();
  check(!(await reminder.isChecked()),
    'o lembrete semanal começa desligado');
  await reminder.click();
  await page.waitForTimeout(350);
  check(await reminder.isChecked(),
    'a opção de lembrete pode ser ativada sem solicitar permissão Push');
  check(errors.length === 0, 'sem erros no console', errors.join(' | '));

  await browser.close();
  if (results.some((passed) => !passed)) process.exitCode = 1;
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
