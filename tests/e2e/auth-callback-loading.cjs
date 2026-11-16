const assert = require('node:assert/strict');
const { readdirSync, readFileSync } = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const BASE = process.argv[2] || 'http://127.0.0.1:4173';
const assets = path.resolve(__dirname, '..', '..', 'dist', 'assets');
const sdkChunks = readdirSync(assets).filter((file) => file.endsWith('.js')
  && readFileSync(path.join(assets, file), 'utf8').includes('Multiple GoTrueClient instances detected'));
assert.equal(sdkChunks.length, 1, 'o build deve separar o SDK Supabase em um único chunk');

(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const startupRequests = [];
    page.on('request', (request) => {
      if (/\/(?:loading-appearance|landing-guard)\.js(?:\?|$)/.test(request.url())) startupRequests.push(request.url());
    });
    await page.route('**/assets/*.js', (route) => route.abort());
    for (const viewport of [{ width: 320, height: 700 }, { width: 1280, height: 800 }]) {
      await page.setViewportSize(viewport);
      for (const path of ['/?code=callback-test', '/?error=access_denied', '/?type=recovery', '/#type=recovery']) {
        await page.goto(`${BASE}${path}`, { waitUntil: 'load' });
        assert.equal(await page.locator('.public-site').count(), 0, `${path}: a landing não deve aparecer no retorno`);
        assert.equal(await page.locator('.app-skeleton[role="status"]').isVisible(), true);
        assert.equal(await page.evaluate(() => document.documentElement.dataset.auroraAuthCallback), 'true');
        assert.equal(new URL(page.url()).search + new URL(page.url()).hash, path.slice(1));
      }
      await page.goto(`${BASE}/?utm_source=teste`, { waitUntil: 'load' });
      assert.equal(await page.locator('.public-site[data-prerendered]').isVisible(), true, 'a landing comum continua disponível');
      assert.equal(await page.evaluate(() => document.documentElement.dataset.auroraAuthCallback), undefined);
      await page.goto(`${BASE}/entrar`, { waitUntil: 'load' });
      assert.equal(await page.locator('.public-site').count(), 0, 'rotas da aplicação não devem mostrar a landing');
      assert.equal(await page.locator('.app-skeleton[role="status"]').isVisible(), true);
    }
    assert.deepEqual(startupRequests, [], 'Os scripts iniciais não devem gerar requisições adicionais.');
    const installedPage = await browser.newPage();
    await installedPage.addInitScript(() => {
      const matchMedia = window.matchMedia.bind(window);
      window.matchMedia = (query) => query === '(display-mode: standalone)'
        ? { matches: true }
        : matchMedia(query);
    });
    await installedPage.route('**/assets/*.js', (route) => route.abort());
    await installedPage.goto(BASE, { waitUntil: 'load' });
    assert.equal(await installedPage.locator('.public-site').count(), 0, 'o app instalado não deve mostrar a landing');
    assert.equal(await installedPage.locator('.app-skeleton[role="status"]').isVisible(), true);
    await installedPage.close();
    for (const viewport of [{ width: 320, height: 700 }, { width: 1280, height: 800 }]) {
      const landingPage = await browser.newPage({ viewport, serviceWorkers: 'block' });
      let releaseScripts;
      const scriptsReady = new Promise((resolve) => { releaseScripts = resolve; });
      await landingPage.route('**/assets/*.js', async (route) => {
        await scriptsReady;
        await route.continue();
      });
      await landingPage.goto(BASE, { waitUntil: 'commit' });
      const title = landingPage.locator('#landing-title');
      await title.waitFor({ state: 'visible' });
      const originalTitle = await title.elementHandle();
      assert.equal(await landingPage.locator('.public-main').evaluate((main) => getComputedStyle(main).animationName), 'none');
      releaseScripts();
      const task = landingPage.locator('[data-landing-task]').last();
      await landingPage.waitForFunction(() => document.documentElement.dataset.theme === 'light'
        && document.querySelector('[data-public-control="theme-cycle"]')?.getAttribute('aria-label') === 'Alternar para tema escuro');
      assert.equal(await title.evaluate((element, original) => element === original, originalTitle), true, 'o título pré-renderizado deve ser preservado');
      await task.click();
      assert.equal(await task.getAttribute('aria-pressed'), 'true', 'a landing hidratada deve continuar interativa');
      await landingPage.close();
    }
    const appHtml = await (await fetch(`${BASE}/pages/inicio.html`)).text();
    const fullCss = appHtml.match(/href="([^"]*main-[^"]*\.css)"/)?.[1];
    assert.ok(fullCss, 'o build deve fornecer a folha completa da aplicação');
    const cssPage = await browser.newPage({ serviceWorkers: 'block' });
    const cssRequests = [];
    const sdkRequests = [];
    cssPage.on('request', (request) => {
      if (new URL(request.url()).pathname === fullCss) cssRequests.push(request.url());
      if (new URL(request.url()).pathname === `/assets/${sdkChunks[0]}`) sdkRequests.push(request.url());
    });
    await cssPage.goto(BASE, { waitUntil: 'networkidle' });
    assert.equal(cssRequests.length, 0, 'a landing não deve solicitar a folha completa');
    assert.equal(sdkRequests.length, 0, 'a landing sem sessão não deve baixar o SDK Supabase');
    await cssPage.locator('.public-hero [data-public-action="demo"]').click();
    await cssPage.locator('.demo-main .home-head').waitFor();
    assert.equal(cssRequests.length, 1, 'a demonstração deve carregar a folha completa');
    assert.equal(await cssPage.locator('.demo-main .home-head').evaluate((header) => getComputedStyle(header).display), 'flex');
    assert.equal(await cssPage.locator('#app').getAttribute('aria-busy'), null);
    await cssPage.close();
    const accountPage = await browser.newPage({ serviceWorkers: 'block' });
    const accountCss = accountPage.waitForResponse((response) =>
      new URL(response.url()).pathname === fullCss && response.ok());
    await accountPage.goto(`${BASE}/entrar`, { waitUntil: 'domcontentloaded' });
    await accountCss;
    await accountPage.close();
    const failurePage = await browser.newPage({ serviceWorkers: 'block' });
    await failurePage.route(`**${fullCss}`, (route) => route.abort());
    await failurePage.goto(BASE, { waitUntil: 'load' });
    await failurePage.locator('.public-hero [data-public-action="demo"]').click();
    await failurePage.getByRole('alert').getByRole('heading', { name: 'Não foi possível carregar o Aurora' }).waitFor();
    assert.equal(await failurePage.locator('#app').getAttribute('aria-busy'), null);
    await failurePage.close();
    const offlineContext = await browser.newContext();
    const offlinePage = await offlineContext.newPage();
    await offlinePage.goto(BASE, { waitUntil: 'load' });
    await offlinePage.waitForFunction(async (href) => Boolean(navigator.serviceWorker.controller)
      && Boolean(await caches.match(new URL(href, location.origin).href)), fullCss);
    await offlineContext.setOffline(true);
    await offlinePage.locator('.public-hero [data-public-action="demo"]').click();
    await offlinePage.locator('.demo-main .home-head').waitFor();
    assert.equal(await offlinePage.locator('.demo-main .home-head').evaluate((header) => getComputedStyle(header).display), 'flex');
    await offlineContext.close();
    console.log('Callback: carregamento sem landing em mobile e desktop, preservando a URL.');
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
