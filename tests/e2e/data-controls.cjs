const { chromium } = require('playwright');

const BASE = process.argv[2] || 'http://127.0.0.1:5179';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.goto(`${BASE}/?preview#config?section=data`);
  await page.locator('.settings-data-overview').waitFor();

  if (await page.locator('[data-action="export"], input[data-change="import"], .settings-data-safety').count()) {
    throw new Error('A seção de dados ainda oferece controles de backup ou restauração.');
  }
  if (await page.locator('.settings-data-migration').count()) {
    throw new Error('A importação de dados antigos ainda aparece em Ajustes.');
  }
  for (const selector of [
    '.settings-data-trash',
    '.settings-data-care',
  ]) {
    if (await page.locator(selector).count() !== 1) {
      throw new Error(`A seção preservada não está disponível: ${selector}.`);
    }
  }

  const deletionScope = await page.locator('.settings-data-danger .settings-data-scope').innerText();
  for (const category of ['Tarefas', 'Hábitos', 'Finanças', 'Ciclo', 'Perfil']) {
    if (!deletionScope.includes(category)) {
      throw new Error(`A lista de dados a apagar não informa ${category}.`);
    }
  }
  await page.getByRole('button', { name: 'Apagar dados e manter a conta' }).click();
  const deletionDialog = page.locator('#dlg');
  await deletionDialog.getByRole('heading', { name: 'Apagar os dados salvos?' }).waitFor();
  if (!(await deletionDialog.locator('.settings-data-scope').innerText()).includes('Finanças')) {
    throw new Error('A confirmação não repete o escopo dos dados que serão apagados.');
  }
  if (!(await deletionDialog.innerText()).includes('Sua conta e seu acesso continuam ativos')) {
    throw new Error('A confirmação não esclarece que a conta será mantida.');
  }
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)) {
      throw new Error(`A confirmação de exclusão tem overflow horizontal em ${width}px.`);
    }
  }
  await deletionDialog.getByRole('button', { name: 'Cancelar e manter os dados' }).click();
  await deletionDialog.waitFor({ state: 'detached' });

  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)) {
      throw new Error(`A seção de dados tem overflow horizontal em ${width}px.`);
    }
  }
  if (errors.length) throw new Error(`Erros no console: ${errors.slice(0, 3).join(' | ')}`);

  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
