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
    assert.equal(await notice.count(), 0, 'aviso automático não aparece antes de 15 segundos');
    await page.clock.fastForward(1);
    assert.equal(await notice.isVisible(), true, 'aviso aparece após 15 segundos');
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
    await page.evaluate(() => window.scrollTo(0, document.querySelector('.public-hero').getBoundingClientRect().bottom + window.scrollY + 1));
    await notice.waitFor({ state: 'visible' });
    await notice.getByRole('button', { name: 'Agora não' }).click();
    await page.clock.fastForward(15000);
    await dispatchInstallPrompt(page);
    assert.equal(await notice.count(), 0, 'aviso dispensado não reaparece automaticamente');
    await page.context().close();

    page = await newPage();
    notice = page.locator('#pwa-install-notice');
    await page.evaluate(() => window.scrollTo(0, document.querySelector('.public-hero').getBoundingClientRect().bottom + window.scrollY + 1));
    await page.waitForFunction(() => document.querySelector('.public-hero').getBoundingClientRect().bottom <= 0);
    assert.equal(await notice.count(), 0, 'rolagem não cria aviso sem evento de instalação');
    await dispatchInstallPrompt(page);
    await notice.waitFor({ state: 'visible' });
    await page.context().close();

    page = await newPage();
    notice = page.locator('#pwa-install-notice');
    await page.clock.fastForward(15000);
    assert.equal(await notice.count(), 0, 'não há aviso automático sem evento de instalação');
    await dispatchInstallPrompt(page);
    assert.equal(await notice.isVisible(), true, 'evento tardio aproveita o tempo já decorrido');
    await page.context().close();

    page = await newPage();
    notice = page.locator('#pwa-install-notice');
    await page.locator('.public-cta-panel [data-action="pwa-install"]').evaluate((button) => button.click());
    assert.equal(await notice.isVisible(), true, 'pedido explícito mostra instruções imediatamente');
    await dispatchInstallPrompt(page);
    assert.equal(await notice.getByRole('button', { name: 'Instalar', exact: true }).isVisible(), true,
      'evento tardio atualiza as instruções solicitadas');
    await notice.getByRole('button', { name: 'Agora não' }).click();
    await page.clock.fastForward(15000);
    assert.equal(await notice.count(), 0, 'pedido explícito não agenda outro aviso');
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
    await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
    await page.clock.fastForward(15000);
    assert.equal(await notice.count(), 0, 'instalação concluída cancela o aviso pendente');
    await page.context().close();
    assert.deepEqual(errors, []);
    console.log('PWA: instalação automática adiada, rolagem e pedido explícito verificados.');
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
