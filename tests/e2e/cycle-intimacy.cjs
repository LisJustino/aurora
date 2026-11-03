const { chromium } = require('playwright');

const BASE = process.argv[2] || 'http://127.0.0.1:5173';
const results = [];
const check = (passed, name) => {
  results.push(passed);
  console.log(`${passed ? 'OK   ' : 'FALHA'} — ${name}`);
};

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.goto(`${BASE}/?preview#ciclo`);
  await page.getByRole('button', { name: 'Registrar este dia' }).click();
  const dialog = page.locator('#dlg');
  await dialog.getByRole('heading', { name: 'Atividade sexual e orgasmos' }).waitFor();
  const partneredActivity = dialog.locator('[data-dlg="log.sexualActivity"]');
  const masturbationActivity = dialog.locator('[data-dlg="log.masturbationActivity"]');
  const orgasmCount = dialog.locator('[data-dlg="log.orgasmCount"]');
  check(await orgasmCount.getAttribute('min') === '0' && await orgasmCount.getAttribute('max') === '99', 'contagem aceita o intervalo de 0 a 99');
  check(await dialog.getByRole('button', { name: 'Preservativo' }).count() === 0, 'métodos contraceptivos ficam ocultos sem atividade com outra pessoa');
  for (const width of [320, 390, 1366]) {
    await page.setViewportSize({ width, height: 844 });
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `formulário não tem overflow horizontal em ${width} px`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await partneredActivity.check();
  check(await dialog.getByRole('button', { name: 'Preservativo' }).count() === 1, 'métodos contraceptivos aparecem para atividade com outra pessoa');
  await dialog.getByRole('button', { name: 'Preservativo' }).click();
  await masturbationActivity.check();
  await orgasmCount.fill('2');
  await dialog.getByRole('button', { name: 'Salvar registro' }).click();

  const summary = page.locator('.cycle-day-summary');
  check((await summary.textContent()).includes('Relação sexual registrada'), 'resumo registra atividade com outra pessoa');
  check((await summary.textContent()).includes('Masturbação registrada'), 'resumo registra masturbação');
  check((await summary.textContent()).includes('2 orgasmos'), 'resumo mostra a contagem de orgasmos');

  await page.getByRole('button', { name: 'Registrar este dia' }).click();
  check(await partneredActivity.isChecked(), 'atividade sexual é carregada ao reabrir o dia');
  check(await masturbationActivity.isChecked(), 'masturbação é carregada ao reabrir o dia');
  check(await orgasmCount.inputValue() === '2', 'contagem de orgasmos é carregada ao reabrir o dia');
  await partneredActivity.uncheck();
  check(await dialog.getByRole('button', { name: 'Preservativo' }).count() === 0, 'métodos somem ao desmarcar atividade com outra pessoa');
  check(await masturbationActivity.isChecked(), 'desmarcar atividade com outra pessoa preserva masturbação');
  await dialog.getByRole('button', { name: 'Salvar registro' }).click();
  check((await summary.textContent()).includes('Masturbação registrada'), 'registro independente de masturbação continua salvo');
  check((await summary.textContent()).includes('2 orgasmos'), 'registro de orgasmos continua salvo sem atividade com outra pessoa');
  check(!(await summary.textContent()).includes('Relação sexual registrada'), 'atividade com outra pessoa é removida sem apagar os outros dados');
  await page.getByRole('button', { name: 'Registrar este dia' }).click();
  await orgasmCount.fill('0');
  await dialog.getByRole('button', { name: 'Salvar registro' }).click();
  check((await summary.textContent()).includes('0 orgasmos'), 'zero orgasmos pode ser registrado separadamente de não informar');
  check(errors.length === 0, 'sem erros no console');

  await browser.close();
  process.exit(results.every(Boolean) ? 0 : 1);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
