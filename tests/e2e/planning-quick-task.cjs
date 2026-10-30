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
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto(`${BASE}/?preview#planejar`);

  const input = page.getByRole('textbox', { name: 'Nova tarefa' });
  await input.fill('Enviar proposta sexta 18h');
  check((await page.locator('#planning-quick-preview').textContent()).includes('às 18:00'), 'mostra o prazo interpretado enquanto digita');
  await input.press('Enter');
  const confirmation = page.locator('#dlg');
  await confirmation.waitFor({ state: 'visible' });
  check((await confirmation.innerText()).includes('Prazo interpretado'), 'apresenta o prazo antes da confirmação');
  check((await confirmation.innerText()).includes('18:00'), 'confirma horário interpretado');
  await confirmation.getByRole('button', { name: 'Cancelar' }).click();
  check(await page.locator('.task').filter({ hasText: 'Enviar proposta' }).count() === 0, 'cancelar não cria a tarefa');

  await input.fill('Enviar proposta sexta 18h');
  await input.press('Enter');
  await page.locator('#dlg').getByRole('button', { name: 'Continuar' }).click();
  const task = page.locator('.task').filter({ hasText: 'Enviar proposta' });
  await task.waitFor({ state: 'visible' });
  check((await task.innerText()).includes('18:00'), 'Enter cria a tarefa com o horário interpretado');
  const expectedDay = await page.evaluate(() => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    const delta = (5 - date.getDay() + 7) % 7;
    date.setDate(date.getDate() + delta);
    return delta === 0 ? 'Hoje' : `${date.getDate()} ${['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][date.getMonth()]}`;
  });
  check((await task.innerText()).includes(expectedDay), 'sexta-feira é interpretada como próximo prazo válido');
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Planejar não tem overflow horizontal em 390 px');
  check(errors.length === 0, 'sem erros no console', errors.slice(0, 3).join(' | '));

  await context.close();
  await browser.close();
  process.exit(results.every(Boolean) ? 0 : 1);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
