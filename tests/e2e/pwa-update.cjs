const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const BASE = process.argv[2] || 'http://127.0.0.1:5179';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  await context.addInitScript(() => {
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
    const registration = Object.assign(eventTarget(), {
      waiting: waitingWorker,
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
  await notice.waitFor({ state: 'visible' });
  assert.match(await notice.innerText(), /nova versão.*atualizar quando terminar/i);
  assert.deepEqual(await page.evaluate(() => window.__pwaMessages || []), []);

  await notice.getByRole('button', { name: 'Agora não' }).click();
  await notice.waitFor({ state: 'detached' });

  await page.evaluate(() => {
    const registration = window.__pwaRegistration;
    const listeners = new Map();
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
  await notice.waitFor({ state: 'visible' });
  await notice.getByRole('button', { name: 'Atualizar' }).click();
  await page.waitForFunction(() => window.__pwaMessages?.some((message) => message.type === 'SKIP_WAITING'));
  assert.equal(await notice.getByRole('button', { name: 'Atualizar' }).isDisabled(), true);
  assert.deepEqual(errors, []);

  await context.close();
  await browser.close();
  console.log('PWA: aviso de atualização, adiamento, nova notificação e ativação explícita aprovados.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
