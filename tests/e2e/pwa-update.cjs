const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const BASE = process.argv[2] || 'http://127.0.0.1:5179';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await context.addInitScript(() => {
    window.__pwaInitialUrl = location.href;
    const listeners = new Map();
    const eventTarget = () => ({
      addEventListener(type, callback) {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type).add(callback);
      },
      dispatchEvent(event) {
        for (const callback of listeners.get(event.type) || []) callback.call(this, event);
      },
    });
    const waitingWorker = {
      postMessage(message) {
        window.__pwaMessages = [...(window.__pwaMessages || []), message];
      },
    };
    window.__pwaWaitingWorker = waitingWorker;
    const registration = Object.assign(eventTarget(), {
      waiting: null,
      installing: null,
      update: async () => {},
    });
    const serviceWorker = Object.assign(eventTarget(), {
      controller: {},
      register: async () => registration,
      ready: Promise.resolve(registration),
    });
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: serviceWorker,
    });
    window.__pwaRegistration = registration;
    window.__pwaServiceWorker = serviceWorker;
  });

  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(BASE);
  const notice = page.locator('#pwa-update-notice');
  await page.evaluate(() => {
    const registration = window.__pwaRegistration;
    const listeners = new Map();
    registration.waiting = window.__pwaWaitingWorker;
    registration.installing = {
      state: 'installed',
      addEventListener(type, callback) {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type).add(callback);
      },
      dispatchEvent(event) {
        for (const callback of listeners.get(event.type) || []) callback.call(this, event);
      },
    };
    registration.waiting = {
      postMessage(message) {
        window.__pwaMessages = [...(window.__pwaMessages || []), message];
      },
    };
    registration.dispatchEvent(new Event('updatefound'));
    registration.installing.dispatchEvent(new Event('statechange'));
  });
  await page.waitForFunction(() => window.__pwaMessages?.some((message) => message.type === 'SKIP_WAITING'));
  assert.equal(await notice.count(), 0, 'a atualização deve ser aplicada sem exibir um aviso para clicar');
  await page.evaluate(() => history.replaceState(null, '', '/inicio?origem=teste#main'));
  const [response] = await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
    page.evaluate(() => window.__pwaServiceWorker.dispatchEvent(new Event('controllerchange'))),
  ]);
  assert.equal(response.status(), 200, 'a atualização deve recarregar a rota atual sem 404');
  const reloadedUrl = new URL(await page.evaluate(() => window.__pwaInitialUrl));
  assert.equal(reloadedUrl.pathname, '/inicio');
  assert.equal(reloadedUrl.search, '?origem=teste');
  assert.equal(reloadedUrl.hash, '#main');
  assert.equal(await page.getByText('Esta página não existe').count(), 0);
  assert.deepEqual(errors, []);

  await context.close();
  await browser.close();
  console.log('PWA: atualização automática inicial e após instalação, com recarga da rota móvel, aprovadas.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
