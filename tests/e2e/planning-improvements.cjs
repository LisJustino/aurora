const { chromium } = require('playwright');
const assert = require('node:assert/strict');

const base = process.argv[2] || 'http://127.0.0.1:5173';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.goto(`${base}/?preview#planejar`);
  assert.equal(await page.locator('h2').filter({ hasText: /^Planos/ }).count(), 0);

  await page.locator('[data-action="plan-view"][data-v="semana"]').click();
  for (const width of [390, 1366]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.locator('.week-day').count(), 7);
    assert.equal(await page.locator('.week-day .empty-state').count(), 0);
    const emptyDays = page.locator('.week-day-empty');
    for (const day of await emptyDays.all()) {
      const button = day.locator('button[data-action="week-add"]');
      assert.equal(await button.count(), 1);
      assert.equal((await button.getAttribute('aria-label')).startsWith('Adicionar tarefa em '), true);
      assert.equal(await day.evaluate((element) => element.getBoundingClientRect().height < 100), true);
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  }

  await page.locator('[data-action="plan-view"][data-v="lista"]').click();
  await page.locator('[data-action="plan-view"][data-v="anual"]').click();
  await page.locator('[data-action="annual-goal-add"]').first().click();
  await page.locator('.annual-goal-title-field input').fill('Fazer uma viagem especial');
  await page.locator('.annual-goal-action-field input').fill('Pesquisar destinos e custos');
  await page.locator('.annual-goal-form button[type="submit"]').click();

  const goal = page.locator('.annual-goal').filter({ hasText: 'Fazer uma viagem especial' });
  await goal.locator('[data-action="annual-goal-task"]').click();
  assert.equal(await goal.locator('[data-action="annual-goal-task"]').textContent(), 'Abrir tarefa relacionada');
  await goal.locator('[data-action="annual-goal-task"]').click();
  assert.equal(await page.locator('#dlg [data-dlg="title"]').inputValue(), 'Pesquisar destinos e custos');
  await page.locator('#dlg [data-action="dlg-close"]').first().click();
  await page.locator('[data-action="plan-view"][data-v="lista"]').click();
  assert.equal(await page.locator('#task-results .task').filter({ hasText: 'Pesquisar destinos e custos' }).count(), 1);

  await page.locator('[data-action="weekly-open-review"]').click();
  assert.equal(await page.locator('#weekly-overdue-title').count(), 1);
  assert.equal(await page.locator('#weekly-next-title').count(), 1);
  await page.locator('[data-action="weekly-reflection-save"][data-v="Mais pausas"]').click();
  assert.equal((await page.locator('#toast').textContent()).includes('Reflexão semanal salva'), true);
  assert.equal(await page.locator('.weekly-reflection [aria-pressed="true"]').textContent(), 'Mais pausas');
  await page.locator('[data-action="plan-view"][data-v="lista"]').click();
  assert.equal(await page.locator('#task-results .task').filter({ hasText: 'Mais pausas' }).count(), 0);

  assert.deepEqual(errors, []);
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
