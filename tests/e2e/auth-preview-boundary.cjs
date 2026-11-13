const { chromium } = require('playwright');

const DEV_BASE = process.argv[2] || 'http://127.0.0.1:5173';
const PRODUCTION_BASE = process.argv[3] || 'http://127.0.0.1:4173';
const allowedOrigins = new Set([DEV_BASE, PRODUCTION_BASE].map((base) => new URL(base).origin));
const results = [];
const check = (passed, name, detail = '') => {
  results.push(passed);
  console.log(`${passed ? 'OK   ' : 'FALHA'} — ${name}${detail ? ` (${detail})` : ''}`);
};

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await context.newPage();
  const errors = [];
  const externalRequests = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.route('**/*', (route) => {
    const requestUrl = route.request().url();
    if (allowedOrigins.has(new URL(requestUrl).origin)) return route.continue();
    externalRequests.push(requestUrl);
    return route.abort();
  });

  const developmentUrl = new URL('/inicio?preview=1', DEV_BASE);
  await page.goto(developmentUrl.toString());
  await page.getByText('Você está vendo dados de exemplo.', { exact: false }).waitFor({ state: 'visible' });
  check(await page.locator('.preview-shell').count() === 1, 'prévia local abre a área de demonstração');

  const routes = ['inicio', 'planejar', 'financas', 'ciclo', 'habitos', 'config'];
  for (const route of routes) {
    const link = route === 'config'
      ? page.locator('.profile-menu-trigger')
      : page.locator(`.nav a[href="/${route}"]`).first();
    await link.click();
    if (route === 'config') await page.locator('#profile-menu a[href="/config"]').click();
    await page.waitForFunction((expected) => location.pathname === `/${expected}`, route);
    check(await page.locator('main h1, main h2').count() > 0, `rota ${route} renderiza conteúdo`);
  }
  check(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    'área de demonstração não tem overflow horizontal em 375 px',
  );
  check(
    await page.evaluate(() => localStorage.length === 0),
    'navegação da demonstração não persiste dados locais',
  );

  const protectedUrl = new URL('/pages/inicio.html?preview=1', PRODUCTION_BASE);
  await page.goto(protectedUrl.toString());
  await page.getByRole('heading', { name: 'Acesso indisponível' }).waitFor({ state: 'visible' });
  check(
    !(await page.getByText('Você está vendo dados de exemplo.', { exact: false }).count()),
    'build de produção não ativa a prévia em rota protegida',
  );
  check(
    (await page.getByRole('alert').innerText()).includes('temporariamente indisponível'),
    'sem configuração de conta, a rota protegida mantém o gate de acesso',
  );
  check(externalRequests.length === 0, 'fluxo de prévia e gate não fazem chamadas externas', externalRequests.join(' | '));
  check(errors.length === 0, 'sem erros no console', errors.slice(0, 3).join(' | '));

  await context.close();
  await browser.close();
  process.exit(results.every(Boolean) ? 0 : 1);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
