const assert = require('node:assert/strict');
const { chromium } = require('playwright');

async function run() {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 320, height: 720 } });
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.goto(process.argv[2] || 'http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
      const { createAccountForm } = await import('/src/js/services/account-auth.js');
      createAccountForm(document.querySelector('#app'), {
        title: 'Termos atualizados',
        description: 'Leia e aceite a versão atualizada dos documentos.',
        mode: 'legal-consent',
      });
    });

    const form = page.locator('.account-form[data-account-mode="legal-consent"]');
    const checkbox = form.getByRole('checkbox', {
      name: 'Li e aceito os Termos de Uso e a Política de Privacidade.',
    });
    assert.equal(await checkbox.isChecked(), false, 'aceite deve começar desmarcado');
    assert.equal(await form.evaluate((element) => element.checkValidity()), false, 'aceite deve ser obrigatório');
    for (const [label, path] of [
      ['Termos de Uso', '/terms.html'],
      ['Política de Privacidade', '/privacy.html'],
    ]) {
      const link = form.getByRole('link', { name: label });
      assert.equal(await link.getAttribute('href'), path);
      assert.equal(await link.getAttribute('target'), '_blank');
      assert.match(await link.getAttribute('rel'), /noopener/);
    }
    assert.equal(await form.locator('.account-legal-document').count(), 2, 'documentos devem aparecer em cartões Aurora');
    assert.equal(await page.locator('.account-gate > .account-intro').isVisible(), false, 'introdução genérica deve ser removida no reconsentimento');

    await checkbox.check();
    assert.equal(await form.evaluate((element) => element.checkValidity()), true, 'aceite deve liberar a validação');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true, 'overflow horizontal em 320 px');

    await page.setViewportSize({ width: 1440, height: 900 });
    const desktopCard = page.locator('.account-gate > .account-card');
    assert.equal(await desktopCard.evaluate((element) => element.getBoundingClientRect().width <= 640), true, 'cartão deve manter largura de leitura em desktop');
    assert.equal(await desktopCard.evaluate((element) => element.getBoundingClientRect().x > 0), true, 'cartão deve ficar centralizado em desktop');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true, 'overflow horizontal em desktop');

    await page.keyboard.press('Shift+Tab');
    const focusedDocument = page.locator('.account-legal-document').nth(1);
    assert.equal(await focusedDocument.evaluate((element) => element.matches(':focus-visible')), true, 'documentos devem ser alcançáveis e indicar foco pelo teclado');
    assert.deepEqual(pageErrors, [], 'erros JavaScript');
    console.log('legal-consent-flow: aceite, documentos, identidade visual e layouts mobile/desktop aprovados');
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
