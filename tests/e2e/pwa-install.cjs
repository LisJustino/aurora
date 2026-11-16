const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const BASE = process.argv[2] || 'http://127.0.0.1:5173';

async function dispatchInstallPrompt(page) {
  return page.evaluate(() => {
    const event = new Event('beforeinstallprompt', { cancelable: true });
    event.prompt = async () => { window.__installPromptCalls = (window.__installPromptCalls || 0) + 1; };
    event.userChoice = Promise.resolve({ outcome: 'accepted' });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  });
}

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  async function newPage() {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    const now = new Date('2026-01-01T12:00:00Z');
    await page.clock.install({ time: now });
    await page.clock.pauseAt(now);
    await page.goto(BASE);
    await page.locator('.public-hero').waitFor();
    return page;
  }

  try {
    let page = await newPage();
    let notice = page.locator('#pwa-install-notice');
    assert.equal(await dispatchInstallPrompt(page), true);
    await page.clock.fastForward(14999);
    assert.equal(await notice.count(), 0, 'evento de instalação não exibe aviso sem solicitação');
    await page.clock.fastForward(1);
    assert.equal(await notice.count(), 0, 'tempo decorrido não exibe aviso automaticamente');
    await page.locator('.public-cta-panel [data-action="pwa-install"]').evaluate((button) => button.click());
    assert.equal(await notice.isVisible(), true, 'pedido explícito mostra o aviso');
    for (const width of [320, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(await notice.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        return bounds.left >= 0 && bounds.right <= innerWidth && document.documentElement.scrollWidth <= innerWidth;
      }), true, `aviso sem overflow em ${width}px`);
    }
    await notice.getByRole('button', { name: 'Instalar', exact: true }).click();
    assert.equal(await page.evaluate(() => window.__installPromptCalls), 1);
    assert.equal(await notice.count(), 0);
    await page.context().close();

    page = await newPage();
    notice = page.locator('#pwa-install-notice');
    await dispatchInstallPrompt(page);
    await page.locator('.public-cta-panel [data-action="pwa-install"]').evaluate((button) => button.click());
    await notice.getByRole('button', { name: 'Agora não' }).click();
    await page.evaluate(() => window.scrollTo(0, document.querySelector('.public-hero').getBoundingClientRect().bottom + window.scrollY + 1));
    await page.clock.fastForward(15000);
    assert.equal(await notice.count(), 0, 'aviso dispensado não reaparece automaticamente');
    await page.context().close();

    page = await newPage();
    notice = page.locator('#pwa-install-notice');
    await page.evaluate(() => window.scrollTo(0, document.querySelector('.public-hero').getBoundingClientRect().bottom + window.scrollY + 1));
    await page.waitForFunction(() => document.querySelector('.public-hero').getBoundingClientRect().bottom <= 0);
    assert.equal(await notice.count(), 0, 'rolagem não cria aviso sem evento de instalação');
    await dispatchInstallPrompt(page);
    assert.equal(await notice.count(), 0, 'evento de instalação isolado não exibe aviso');
    await page.locator('.public-cta-panel [data-action="pwa-install"]').evaluate((button) => button.click());
    assert.equal(await notice.isVisible(), true, 'pedido explícito continua disponível após rolar a página');
    await page.context().close();

    page = await newPage();
    notice = page.locator('#pwa-install-notice');
    await page.clock.fastForward(15000);
    assert.equal(await notice.count(), 0, 'não há aviso automático após aguardar');
    await dispatchInstallPrompt(page);
    assert.equal(await notice.count(), 0, 'evento tardio não exibe aviso sem solicitação');
    await page.locator('.public-cta-panel [data-action="pwa-install"]').evaluate((button) => button.click());
    assert.equal(await notice.isVisible(), true, 'pedido explícito funciona após aguardar');
    await page.context().close();

    page = await newPage();
    notice = page.locator('#pwa-install-notice');
    await page.locator('.public-cta-panel [data-action="pwa-install"]').evaluate((button) => button.click());
    await notice.getByRole('button', { name: 'Agora não' }).click();
    await dispatchInstallPrompt(page);
    assert.equal(await notice.count(), 0, 'evento tardio não reabre aviso dispensado');
    await page.context().close();

    page = await newPage();
    notice = page.locator('#pwa-install-notice');
    await page.locator('.public-cta-panel [data-action="pwa-install"]').evaluate((button) => button.click());
    assert.equal(await notice.isVisible(), true, 'pedido explícito mostra instruções imediatamente');
    await dispatchInstallPrompt(page);
    assert.equal(await notice.getByRole('button', { name: 'Instalar', exact: true }).isVisible(), true,
      'evento tardio atualiza as instruções solicitadas');
    await notice.getByRole('button', { name: 'Agora não' }).click();
    await dispatchInstallPrompt(page);
    await page.clock.fastForward(15000);
    assert.equal(await notice.count(), 0, 'aviso dispensado não reaparece após evento ou tempo');
    await page.context().close();

    page = await newPage();
    notice = page.locator('#pwa-install-notice');
    await dispatchInstallPrompt(page);
    await page.locator('.public-cta-panel [data-action="pwa-install"]').evaluate((button) => button.click());
    assert.equal(await notice.getByRole('button', { name: 'Instalar', exact: true }).isVisible(), true,
      'pedido explícito usa imediatamente o evento de instalação disponível');
    await page.context().close();

    page = await newPage();
    notice = page.locator('#pwa-install-notice');
    await dispatchInstallPrompt(page);
    await page.locator('.public-cta-panel [data-action="pwa-install"]').evaluate((button) => button.click());
    assert.equal(await notice.isVisible(), true);
    await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
    assert.equal(await notice.count(), 0, 'instalação concluída cancela o aviso visível');
    await page.context().close();
    assert.deepEqual(errors, []);
    console.log('PWA: aviso somente após pedido explícito e instalação verificados.');
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
