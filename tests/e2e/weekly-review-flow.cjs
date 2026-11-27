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
    && await page.locator('.weekly-review-hero').getByText('Sua semana').count() === 1
    && await page.locator('.weekly-review .review-stats .stat').count() === 4
    && await page.locator('#weekly-overdue-title').count() === 1
    && await page.locator('#weekly-next-title').count() === 1
    && await page.locator('#weekly-reflection-text').count() === 1,
  'revisão mostra o período, pendências, atrasos, próxima semana e reflexão livre');
  check(await page.locator('.weekly-review').getByText(/Ciclo|Finanças|peso/i).count() === 0,
    'a revisão não exibe dados de Ciclo, finanças ou peso');

  await page.locator('.weekly-review [data-action="weekly-reflection-save"][data-v="Mais pausas"]').click();
  check((await page.locator('#toast').textContent()).includes('Reflexão semanal salva'),
    'resposta rápida é salva como reflexão semanal');
  check(await page.locator('.weekly-reflection.is-answered #weekly-reflection-title').textContent() === 'Mais pausas',
    'a resposta salva fica destacada na revisão');
  await page.locator('[data-action="plan-view"][data-v="lista"]').click();
  check(await page.locator('#task-results li.task').filter({ hasText: 'Mais pausas' }).count() === 0,
    'a reflexão não cria tarefa indevida');
  await page.locator('[data-action="plan-view"][data-v="revisao"]').click();
  check(await page.locator('.weekly-review').count() === 1
    && await page.locator('.weekly-reflection.is-answered #weekly-reflection-title').textContent() === 'Mais pausas',
  'resposta permanece visível ao reabrir Sua semana');

  const mobileLayout = await page.evaluate(() => ({
    width: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  check(mobileLayout.scrollWidth <= mobileLayout.width,
    'a revisão não cria rolagem horizontal em largura móvel', JSON.stringify(mobileLayout));

  await page.goto(`${BASE}/?preview#config?section=personalization`);
  const reminder = page.locator('#settings-pref-weekly-review');
  await reminder.waitFor();
  check(await reminder.getAttribute('aria-pressed') === 'false',
    'o lembrete semanal começa desligado');
  await reminder.click();
  await page.waitForTimeout(350);
  check(await reminder.getAttribute('aria-pressed') === 'true',
    'a opção de lembrete pode ser ativada sem solicitar permissão Push');
  await page.locator('a[href="/habitos"]:visible').first().click();
  await page.locator('.main[data-route="habitos"]').waitFor({ state: 'visible' });
  await page.evaluate(() => {
    history.pushState(null, '', '/config?section=personalization');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await reminder.waitFor();
  check(await reminder.getAttribute('aria-pressed') === 'true',
    'lembrete semanal permanece ativado após trocar de área');
  check(errors.length === 0, 'sem erros no console', errors.join(' | '));

  await browser.close();
  if (results.some((passed) => !passed)) process.exitCode = 1;
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
