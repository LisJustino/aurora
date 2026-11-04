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
  await page.locator('.planning-shortcuts [data-action="plan-view"][data-v="revisao"]').click();
  check(await page.locator('.weekly-review').count() === 1
    && await page.locator('#weekly-reflection').count() === 1,
  'revisão semanal combina resumo e reflexão opcional');

  await page.locator('.weekly-review [data-action="task-new"]').first().click();
  const due = new Date();
  due.setHours(12, 0, 0, 0);
  due.setDate(due.getDate() + 7);
  const dueDate = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}`;
  const taskTitle = 'Prioridade da próxima semana';
  await page.locator('#dlg [data-dlg="title"]').fill(taskTitle);
  await page.locator('#dlg [data-dlg="due"]').fill(dueDate);
  await page.getByRole('button', { name: 'Adicionar tarefa', exact: true }).click();

  const task = page.locator('.weekly-review li.task').filter({ hasText: taskTitle });
  const actions = task.locator('.weekly-plan-actions');
  check(await actions.count() === 1
    && await actions.getByRole('button', { name: 'Manter' }).count() === 1
    && await actions.getByRole('button', { name: 'Ajustar' }).count() === 1
    && await actions.getByRole('button', { name: 'Adiar uma semana' }).count() === 1,
  'cada prioridade oferece manter, ajustar ou adiar');

  await actions.getByRole('button', { name: 'Adiar uma semana' }).click();
  check(await page.locator('.weekly-review li.task').filter({ hasText: taskTitle }).count() === 0
    && (await page.locator('#toast').textContent()).includes('Tarefa adiada por uma semana'),
  'adiar move a tarefa para a semana seguinte e informa o resultado');
  await page.locator('#toast [data-action="undo"]').click();
  const restoredTask = page.locator('.weekly-review li.task').filter({ hasText: taskTitle });
  check(await restoredTask.locator('.weekly-plan-actions').count() === 1,
    'desfazer restaura a tarefa à semana originalmente planejada');
  await restoredTask.locator('.weekly-plan-actions').getByRole('button', { name: 'Manter' }).click();
  check(await page.locator('.weekly-review li.task').filter({ hasText: taskTitle }).count() === 1,
    'manter conserva a tarefa sem alterar sua data');
  const mobileLayout = await page.evaluate(() => ({
    width: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    overflowing: [...document.querySelectorAll('body *')].map((element) => ({
      name: `${element.tagName.toLowerCase()}.${String(element.className).replace(/\s+/g, '.')}`,
      left: Math.round(element.getBoundingClientRect().left),
      right: Math.round(element.getBoundingClientRect().right),
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    })).filter((element) => element.scrollWidth > element.clientWidth + 2
      || element.right > innerWidth + 1).slice(0, 8),
  }));
  check(mobileLayout.scrollWidth <= mobileLayout.width,
    'ações da revisão não criam rolagem horizontal em largura móvel', JSON.stringify(mobileLayout));
  await restoredTask.locator('.weekly-plan-actions').getByRole('button', { name: 'Ajustar' }).click();
  check((await page.locator('#dlg h2').textContent()).includes('Editar tarefa'),
    'ajustar abre o formulário existente da tarefa');
  await page.locator('#dlg').getByRole('button', { name: 'Cancelar', exact: true }).click();
  check(errors.length === 0, 'sem erros no console', errors.join(' | '));

  await browser.close();
  if (results.some((passed) => !passed)) process.exitCode = 1;
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
