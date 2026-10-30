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
  const interactionRequests = [];
  let collectRequests = false;
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('request', (request) => {
    if (collectRequests) interactionRequests.push(request.url());
  });

  await page.goto(BASE);
  await page.getByRole('button', { name: 'Ver demonstração' }).click();
  await page.getByRole('button', { name: 'Iniciar foco de exemplo' }).waitFor();
  await page.waitForTimeout(500);
  const storageBefore = await page.evaluate(() => JSON.stringify({
    local: Object.fromEntries(Object.keys(localStorage).sort().map((key) => [key, localStorage.getItem(key)])),
    session: Object.fromEntries(Object.keys(sessionStorage).sort().map((key) => [key, sessionStorage.getItem(key)])),
  }));
  collectRequests = true;

  const task = page.locator('[data-demo-action="task-toggle"]');
  await page.getByRole('button', { name: 'Ver tarefas de exemplo' }).click();
  await task.focus();
  await page.keyboard.press('Space');
  check(await task.getAttribute('aria-checked') === 'true', 'tarefa fictícia pode ser concluída pelo teclado');
  check(await page.locator('[data-demo-task-summary]').textContent() === '3 de 3 feitos', 'progresso e resumo acompanham a tarefa');

  const habit = page.getByRole('button', { name: 'Marcar hoje' });
  await habit.focus();
  await page.keyboard.press('Enter');
  check(await page.getByRole('button', { name: 'Desmarcar hoje' }).getAttribute('aria-pressed') === 'true', 'hábito fictício pode ser marcado pelo teclado');
  check((await page.locator('[data-demo-habit-status]').textContent()).includes('3 dias'), 'resumo semanal do hábito é atualizado');

  const timer = page.locator('[data-demo-timer]');
  const initialTime = await timer.textContent();
  await page.getByRole('button', { name: 'Iniciar foco de exemplo' }).focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1200);
  const runningTime = await timer.textContent();
  check(runningTime !== initialTime, 'cronômetro inicia e atualiza');
  await page.getByRole('button', { name: 'Pausar foco de exemplo' }).click();
  check(await page.getByRole('button', { name: 'Iniciar foco de exemplo' }).getAttribute('aria-pressed') === 'false', 'cronômetro pode ser pausado');

  const storageAfter = await page.evaluate(() => JSON.stringify({
    local: Object.fromEntries(Object.keys(localStorage).sort().map((key) => [key, localStorage.getItem(key)])),
    session: Object.fromEntries(Object.keys(sessionStorage).sort().map((key) => [key, sessionStorage.getItem(key)])),
  }));
  check(storageAfter === storageBefore, 'interações não gravam dados no navegador');
  check(interactionRequests.length === 0, 'interações não fazem requisições de rede', interactionRequests.join(', '));
  check(await page.getByRole('button', { name: 'Criar minha conta' }).count() > 0, 'CTA para criar conta permanece disponível');
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'demonstração não tem overflow horizontal em 390 px');

  await page.setViewportSize({ width: 1280, height: 900 });
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'demonstração não tem overflow horizontal em desktop');
  check(errors.length === 0, 'sem erros no console', errors.slice(0, 3).join(' | '));

  await context.close();
  await browser.close();
  process.exit(results.every(Boolean) ? 0 : 1);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
