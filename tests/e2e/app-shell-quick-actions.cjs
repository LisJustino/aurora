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
    sampleNotice: [...document.querySelectorAll('.main > .notice')].find((item) => item.textContent.includes('dados de exemplo'))?.getBoundingClientRect().top,
  }));
  check(homeOrder.plan < homeOrder.onboarding, 'plano de hoje aparece antes dos primeiros passos');
  check(homeOrder.sampleNotice < homeOrder.plan, 'aviso de demonstração permanece antes das ações');
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
  await page.keyboard.press('Escape');
  await taskDialog.waitFor({ state: 'detached' });

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
  for (const width of [768, 900, 1024, 1199, 1200, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    breakpoints.push(await page.evaluate(() => {
      const nav = document.querySelector('.topbar .nav');
      const currentLabel = nav.querySelector('a[aria-current="page"] .tab-label-group');
      const sidebar = getComputedStyle(document.querySelector('.app')).gridTemplateColumns.startsWith('256px');
      return {
        width: innerWidth,
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        sidebar,
        activeLabelVisible: currentLabel ? currentLabel.getBoundingClientRect().width > 0 : true,
        navPosition: getComputedStyle(nav).position,
      };
    }));
  }
  check(breakpoints.every(({ overflow }) => !overflow), 'sem overflow horizontal entre 768 e 1440 px', JSON.stringify(breakpoints));
  check(breakpoints.find(({ width }) => width === 1024)?.activeLabelVisible, 'nome da área atual permanece visível em tablet');
  check(breakpoints.find(({ width }) => width === 1200)?.sidebar, 'barra lateral entra a partir de 1200 px');
  check(breakpoints.find(({ width }) => width === 768)?.navPosition === 'fixed', 'dock inferior permanece em tablet estreito');
  check(errors.length === 0, 'sem erros no console', errors.slice(0, 3).join(' | '));

  await browser.close();
  process.exit(results.every(Boolean) ? 0 : 1);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
