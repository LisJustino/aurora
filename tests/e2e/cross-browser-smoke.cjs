const assert = require('node:assert/strict');
const { browserType } = require('./browser-type.cjs');

const BASE = process.argv[2] || 'http://127.0.0.1:5179';

(async () => {
  const browser = await browserType.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [];
  const externalRequests = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.route('**/*', (route) => {
    if (new URL(route.request().url()).origin === new URL(BASE).origin) return route.continue();
    externalRequests.push(route.request().url());
    return route.abort();
  });

  await page.goto(`${BASE}/?preview#inicio`);
  await page.getByRole('heading', { level: 1 }).waitFor();
  await page.evaluate(() => { location.hash = 'planejar'; });
  await page.getByRole('button', { name: 'Nova tarefa' }).first().click();
  await page.locator('#dlg [data-dlg="title"]').fill('Teste de navegador');
  await page.getByRole('button', { name: 'Adicionar tarefa', exact: true }).click();
  await page.getByText('Teste de navegador', { exact: true }).waitFor();

  await page.setViewportSize({ width: 320, height: 740 });
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    `${browserType.name()}: overflow horizontal em 320 px`,
  );
  assert.deepEqual(errors, [], `${browserType.name()}: ${errors.join('\n')}`);
  assert.deepEqual(externalRequests, [], `${browserType.name()}: requisições externas`);

  await context.close();
  await browser.close();
  console.log(`${browserType.name()}: fluxo de tarefa, modal e viewport móvel aprovados.`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
