const { chromium } = require('playwright');

const BASE = process.argv[2] || 'http://127.0.0.1:5173';
const results = [];
const check = (passed, name, detail = '') => {
  results.push(passed);
  console.log(`${passed ? 'OK   ' : 'FALHA'} — ${name}${detail ? ` (${detail})` : ''}`);
};

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 320, height: 700 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.goto(`${BASE}/?preview#inicio`);
  const quickTrigger = page.getByRole('button', { name: 'Ações rápidas' });
  await quickTrigger.waitFor({ state: 'visible' });
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'shell não tem overflow horizontal em 320 px');
  const homeOrder = await page.evaluate(() => ({
    plan: document.querySelector('.home-today-card')?.getBoundingClientRect().top,
    onboarding: document.querySelector('.home-first-steps')?.getBoundingClientRect().top,
    summary: document.querySelector('.home-primary > .strip')?.getBoundingClientRect().top,
    sampleNotice: [...document.querySelectorAll('.main > .notice')].find((item) => item.textContent.includes('dados de exemplo'))?.getBoundingClientRect().top,
  }));
  check(homeOrder.plan < homeOrder.onboarding, 'plano de hoje aparece antes dos primeiros passos');
  check(homeOrder.summary === undefined || homeOrder.plan < homeOrder.summary, 'plano de hoje aparece antes dos resumos no layout padrão');
  const nextActionTitle = await page.locator('.home-next-action h2').allTextContents();
  const todayPlanCopy = await page.locator('.home-today-card').innerText();
  check(nextActionTitle.every((title) => !todayPlanCopy.includes(title)), 'próxima ação não repete um item do plano de hoje');
  check(homeOrder.sampleNotice < homeOrder.plan, 'aviso de demonstração permanece antes das ações');
  const sampleNoticeLayout = await page.evaluate(() => {
    const notice = document.querySelector('.sample-banner');
    const copy = notice.querySelector('.grow').getBoundingClientRect();
    const action = notice.querySelector('.btn').getBoundingClientRect();
    return action.top >= copy.bottom && action.left >= copy.left;
  });
  check(sampleNoticeLayout, 'aviso de demonstração mantém texto legível no celular');
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const dockClearance = await page.evaluate(() => {
    const nav = document.querySelector('.topbar .nav');
    const finalAction = document.querySelector('.home-tools .home-tool:last-child');
    return finalAction.getBoundingClientRect().bottom <= nav.getBoundingClientRect().top;
  });
  check(dockClearance, 'última ação do Início pode ser alcançada acima do dock móvel');
  await quickTrigger.click();
  const quickMenu = page.locator('#quick-actions-menu');
  await quickMenu.waitFor({ state: 'visible' });
  check(await quickMenu.getByRole('button', { name: 'Nova tarefa' }).count() === 1, 'ações rápidas oferecem criação de tarefa');
  check(await quickMenu.getByRole('button', { name: 'Nova tarefa' }).evaluate((button) => button === document.activeElement), 'abrir ações rápidas posiciona o foco no primeiro item');
  await page.keyboard.press('Escape');
  check(await quickMenu.isHidden(), 'Esc fecha as ações rápidas');
  check(await quickTrigger.evaluate((button) => button === document.activeElement), 'Esc devolve o foco ao acionador');

  await quickTrigger.click();
  await page.locator('.nav-scrim').click();
  check(await quickMenu.isHidden(), 'clique fora fecha as ações rápidas');
  await quickTrigger.click();
  await quickMenu.getByRole('button', { name: 'Nova tarefa' }).click();
  const taskDialog = page.locator('#dlg');
  await taskDialog.waitFor({ state: 'visible' });
  check(await taskDialog.getByRole('heading', { name: 'Nova tarefa.' }).count() === 1, 'atalho abre o formulário existente de tarefa');
  await taskDialog.locator('[data-dlg="title"]').fill('Tarefa para desfazer');
  await taskDialog.locator('button[type="submit"][form="dlgform"]').click();
  await taskDialog.waitFor({ state: 'detached' });
  await page.locator('.nav a[href="#planejar"]').click();
  const taskCheck = page.getByRole('checkbox', { name: 'Concluir: Tarefa para desfazer' });
  await taskCheck.click();
  check(await page.getByRole('status').filter({ hasText: 'Tarefa concluída.' }).count() === 1, 'conclusão de tarefa oferece desfazer');
  await page.locator('#toast').getByRole('button', { name: 'Desfazer' }).click();
  const reopenedTask = page.getByRole('checkbox', { name: 'Concluir: Tarefa para desfazer' });
  check(await reopenedTask.count() === 1 && await reopenedTask.getAttribute('aria-checked') === 'false', 'desfazer reabre a tarefa e atualiza o estado acessível');

  for (const [actionName, dialogTitle] of [
    ['Novo hábito', 'Novo hábito.'],
    ['Lançamento', 'Novo lançamento.'],
  ]) {
    await quickTrigger.click();
    await quickMenu.getByRole('button', { name: actionName }).click();
    await taskDialog.waitFor({ state: 'visible' });
    check(await taskDialog.getByRole('heading', { name: dialogTitle }).count() === 1, `${actionName} abre o formulário existente`);
    await page.keyboard.press('Escape');
    await taskDialog.waitFor({ state: 'detached' });
  }

  const breakpoints = [];
  for (const width of [768, 900, 1024, 1100, 1199, 1200, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    breakpoints.push(await page.evaluate(() => {
      const nav = document.querySelector('.topbar .nav');
      const currentLabel = nav.querySelector('a[aria-current="page"] .tab-label-group');
      const sidebar = getComputedStyle(document.querySelector('.app')).gridTemplateColumns.startsWith('256px');
      const navLabels = [...nav.querySelectorAll(':scope > a .tab-label-group')];
      return {
        width: innerWidth,
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        sidebar,
        activeLabelVisible: currentLabel ? currentLabel.getBoundingClientRect().width > 0 : true,
        allNavLabelsVisible: navLabels.length > 0 && navLabels.every((label) => label.getBoundingClientRect().width > 1),
        createLabelVisible: nav.querySelector('.nav-quick-trigger .tab-label-group').getBoundingClientRect().width > 1,
        navPosition: getComputedStyle(nav).position,
      };
    }));
  }
  check(breakpoints.every(({ overflow }) => !overflow), 'sem overflow horizontal entre 768 e 1440 px', JSON.stringify(breakpoints));
  check(breakpoints.find(({ width }) => width === 1024)?.activeLabelVisible, 'nome da área atual permanece visível em tablet');
  const labeledTablet = breakpoints.find(({ width }) => width === 1100);
  check(labeledTablet?.allNavLabelsVisible && labeledTablet?.createLabelVisible, 'nomes das áreas e de Criar ficam visíveis no tablet largo');
  check(breakpoints.find(({ width }) => width === 1200)?.sidebar, 'barra lateral entra a partir de 1200 px');
  check(breakpoints.find(({ width }) => width === 768)?.navPosition === 'fixed', 'dock inferior permanece em tablet estreito');
  const searchTrigger = page.getByRole('button', { name: /Buscar no Aurora/ });
  check(await searchTrigger.isVisible(), 'busca global fica visível no cabeçalho autenticado');
  await searchTrigger.click();
  check(await page.locator('#dlg').getByRole('heading', { name: 'Buscar no Aurora.' }).count() === 1, 'acionador abre a busca global');
  await page.keyboard.press('Escape');
  check(await page.locator('#dlg').count() === 0 && await searchTrigger.evaluate((button) => button === document.activeElement), 'Esc fecha a busca e devolve foco ao acionador');
  check(errors.length === 0, 'sem erros no console', errors.slice(0, 3).join(' | '));

  await browser.close();
  process.exit(results.every(Boolean) ? 0 : 1);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
