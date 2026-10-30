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
      const { appendLegalConsent } = await import('/src/js/services/account-auth.js');
      const form = document.createElement('form');
      form.id = 'consent-test-form';
      const card = document.createElement('section');
      card.className = 'account-card';
      appendLegalConsent(form);
      card.append(form);
      document.querySelector('main').replaceChildren(card);
    });

    const form = page.locator('#consent-test-form');
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

    await checkbox.check();
    assert.equal(await form.evaluate((element) => element.checkValidity()), true, 'aceite deve liberar a validação');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true, 'overflow horizontal em 320 px');
    assert.deepEqual(pageErrors, [], 'erros JavaScript');
    console.log('legal-consent-flow: aceite explícito, links em novas abas e largura 320 px aprovados');
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
