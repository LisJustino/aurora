const { chromium } = require('playwright');
const assert = require('node:assert/strict');

const base = process.argv[2] || 'http://127.0.0.1:5173';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    await page.goto(`${base}/?preview#inicio`);
    await page.locator('.home-today-card').waitFor();
    const home = await page.evaluate(() => {
      const nav = [...document.querySelectorAll('.nav > .nav-primary, .nav > .nav-more-trigger')];
      const row = document.querySelector('.home-today-card .task');
      return {
        labels: nav.filter((item) => getComputedStyle(item).display !== 'none').map((item) => (item.querySelector('.tab-label') || item).textContent.trim()),
        targets: nav.map((item) => [item.getBoundingClientRect().width, item.getBoundingClientRect().height, parseFloat(getComputedStyle(item.querySelector('.tab-label') || item).fontSize)]),
        card: document.querySelector('.home-today-card').classList.contains('card'),
        radius: getComputedStyle(row).borderRadius,
        ring: document.querySelector('.home-head .ringw').getBoundingClientRect().width,
      };
    });
    assert.deepEqual(home.labels, ['Início', 'Planejar', 'Finanças', 'Hábitos', 'Mais']);
    assert(home.targets.every(([width, height, font]) => width >= 44 && height >= 44 && font >= 12));
    assert.equal(home.card, false);
    assert.equal(home.radius, '0px');
    assert.equal(home.ring, 64);
    await page.locator('.nav-more-trigger').click();
    assert.equal(await page.locator('#nav-more-menu a[href="/config"]').count(), 0);
    assert.equal(await page.locator('.profile-link[href="/config"]').isVisible(), true);
    await page.locator('.nav-more-trigger').click();
    await page.locator('.nav > a[href="/planejar"]').click();
    assert.equal(await page.locator('[data-action="plan-view"][data-v="lista"]').getAttribute('aria-pressed'), 'true');
    await page.locator('[data-action="plan-view"][data-v="semana"]').click();
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const layout = await page.locator('.week-days').evaluate((grid) => ({
        columns: getComputedStyle(grid).gridTemplateColumns.split(' ').length,
        today: grid.querySelector('.is-today') && getComputedStyle(grid.querySelector('.is-today')).order,
        overflow: document.documentElement.scrollWidth > innerWidth,
      }));
      assert.equal(layout.columns, width < 900 ? 1 : 7);
      if (width < 900 && layout.today !== null) assert.equal(layout.today, '-1');
      assert.equal(layout.overflow, false);
    }
    await page.locator('[data-action="plan-view"][data-v="lista"]').click();
    await page.locator('[aria-label="Filtrar tarefas"] [data-f="atrasadas"]').click();
    assert.equal(await page.locator('[aria-label="Filtrar tarefas"] [data-f="atrasadas"]').getAttribute('aria-pressed'), 'true');
    await page.locator('[data-action="plan-view"][data-v="anual"]').click();
    const annualYear = Number(await page.locator('[data-change="annual-plan-year"]').inputValue());
    assert.equal(annualYear, new Date().getFullYear() + 1);
    await page.locator('#annual-intention').fill('Abrir espaço para o que importa.');
    await page.locator('.annual-intention-form button[type="submit"]').click();
    assert.equal(await page.locator('#annual-intention').inputValue(), 'Abrir espaço para o que importa.');
    await page.locator('.annual-goal-title-field input').fill('Fazer uma viagem especial');
    await page.locator('.annual-goal-action-field input').fill('Pesquisar destinos e custos');
    await page.locator('.annual-goal-quarter-field select').selectOption('q2');
    await page.locator('.annual-goal-form button[type="submit"]').click();
    const annualGoal = page.locator('.annual-goal').filter({ hasText: 'Fazer uma viagem especial' });
    assert.equal(await annualGoal.count(), 1);
    assert.match(await annualGoal.innerText(), /2º trimestre/);
    await annualGoal.locator('[data-action="annual-goal-edit"]').click();
    await page.locator('.annual-goal-title-field input').fill('Fazer uma viagem marcante');
    await page.locator('.annual-goal-form button[type="submit"]').click();
    const editedGoal = page.locator('.annual-goal').filter({ hasText: 'Fazer uma viagem marcante' });
    await editedGoal.locator('[data-action="annual-goal-toggle"]').click();
    assert.equal(await editedGoal.locator('[data-action="annual-goal-toggle"]').getAttribute('aria-pressed'), 'true');
    await editedGoal.locator('[data-action="annual-goal-delete"]').click();
    await page.locator('[data-action="action-confirm-accept"]').click();
    assert.equal(await page.locator('.annual-goal').count(), 0);
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    }
    await page.goto(`${base}/?preview#financas`);
    await page.locator('.fin-section-option[data-t="orcamento"]').click();
    const goal = page.locator('.goal-item').first();
    await goal.waitFor();
    await goal.locator('[data-action="goal-edit"]').click();
    assert.equal(await page.locator('#dt').innerText(), 'Editar objetivo.');
    await page.locator('#dlg [data-dlg="name"]').fill('');
    await page.locator('#dlg button[form="dlgform"][type="submit"]').click();
    assert.equal(await page.locator('#dlg [data-dlg="name"]').getAttribute('aria-invalid'), 'true');
    await page.locator('#dlg [data-dlg="name"]').fill('Reserva de teste');
    await page.locator('#dlg [data-dlg="target"]').fill('0');
    await page.locator('#dlg button[form="dlgform"][type="submit"]').click();
    assert.equal(await page.locator('#dlg [data-dlg="target"]').getAttribute('aria-invalid'), 'true');
    await page.locator('#dlg [data-dlg="target"]').fill('100000');
    await page.locator('#dlg [data-dlg="saved"]').fill('-100');
    await page.locator('#dlg button[form="dlgform"][type="submit"]').click();
    assert.equal(await page.locator('#dlg [data-dlg="saved"]').getAttribute('aria-invalid'), 'true');
    await page.locator('#dlg [data-dlg="saved"]').fill('4.000,00');
    await page.locator('#dlg button[form="dlgform"][type="submit"]').click();
    assert.equal(await page.locator('.goal-item.is-complete .badge.ok').textContent(), 'Concluído');
    assert.equal(await page.locator('.goal-item .goal-percent').first().textContent(), '100%');
    await page.locator('.goal-item [data-action="goal-edit"]').first().click();
    assert.equal(await page.locator('#dlg [data-dlg="saved"]').inputValue(), '4.000,00');
    await page.locator('#dlg [data-action="dlg-close"]').first().click();
    await page.locator('.goal-item [data-action="goal-dep"]').first().click();
    assert.match(await page.locator('#dlg').innerText(), /não altera o saldo de uma conta nem cria um lançamento/);
    await page.locator('#dlg button[form="dlgform"][type="submit"]').click();
    assert.equal(await page.locator('#dlg [data-dlg="amount"]').getAttribute('aria-invalid'), 'true');
    await page.locator('#dlg [data-dlg="amount"]').fill('-100');
    await page.locator('#dlg button[form="dlgform"][type="submit"]').click();
    await page.locator('.goal-item [data-action="goal-edit"]').first().click();
    assert.equal(await page.locator('#dlg [data-dlg="saved"]').inputValue(), '3.999,00');
    await page.locator('#dlg [data-action="dlg-close"]').first().click();
    await page.locator('[data-action="goal-new"]').click();
    await page.locator('#dlg [data-dlg="name"]').fill('Novo objetivo de teste');
    await page.locator('#dlg [data-dlg="target"]').fill('10000');
    await page.locator('#dlg button[form="dlgform"][type="submit"]').click();
    assert.equal(await page.locator('.goal-item').filter({ hasText: 'Novo objetivo de teste' }).count(), 1);
    await page.locator('[data-t="lancamentos"].fin-section-option').click();
    await page.locator('[data-action="rec-list"]').first().click();
    const recurringEmpty = page.locator('#dlg .empty[role="status"]').filter({ hasText: 'Nenhuma fixa ainda' });
    await recurringEmpty.getByRole('button', { name: 'Novo lançamento' }).click();
    assert.equal(await page.locator('#dlg [data-form="dlg-tx"]').count(), 1);
    await page.locator('#dlg [data-action="dlg-close"]').first().click();
    await page.locator('[data-t="orcamento"].fin-section-option').click();
    for (const theme of ['light', 'dark']) {
      await page.evaluate((value) => document.documentElement.setAttribute('data-theme', value), theme);
      assert.equal(await page.locator('.goal-item.is-complete').isVisible(), true);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    }
    assert.deepEqual(errors, []);
    console.log('OK — hierarquia, dock, semana, filtros, plano anual e objetivos financeiros');
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
