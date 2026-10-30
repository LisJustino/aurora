const assert = require('node:assert/strict');
const { chromium } = require('playwright');

async function run() {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.goto(process.argv[2] || 'http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
    const opened = await page.evaluate(async () => {
      const dialog = document.createElement('dialog');
      dialog.className = 'dlg legal-modal';
      dialog.id = 'consent-test-dialog';
      dialog.dataset.legalModal = '';
      dialog.setAttribute('aria-labelledby', 'legal-modal-title');
      dialog.innerHTML = `
        <header class="head legal-modal-header"><h2 id="legal-modal-title" data-legal-dialog-title></h2>
          <button type="button" data-legal-modal-close aria-label="Fechar">Fechar</button></header>
        <p data-legal-dialog-status role="status" hidden></p>
        <div class="dlg-body legal-modal-content" data-legal-dialog-content role="region" tabindex="0"></div>
        <footer class="dlg-foot legal-modal-footer">
          <label data-legal-consent-choice hidden><input type="checkbox" data-legal-consent-checkbox disabled></label>
          <span data-legal-reading-progress role="status" aria-live="polite" hidden></span>
          <button type="button" data-legal-jump-to-end aria-label="Ir ao fim do próximo documento não lido" hidden>Ir ao fim</button>
          <button type="button" data-legal-consent-confirm hidden disabled>Confirmar aceite</button>
          <button type="button" data-legal-close-only>Fechar</button>
        </footer>`;
      document.body.append(dialog);
      const { showLegalConsentDocuments } = await import('/src/js/features/footer/legal-dialog.js');
      return showLegalConsentDocuments(dialog);
    });
    assert.equal(opened, true, 'documentos de aceite não carregaram');

    const dialog = page.locator('#consent-test-dialog');
    const progress = dialog.locator('[data-legal-reading-progress]');
    const checkbox = dialog.locator('[data-legal-consent-checkbox]');
    const confirm = dialog.locator('[data-legal-consent-confirm]');
    assert.equal(await progress.textContent(), '0 de 2 lidos');
    assert.equal(await checkbox.isDisabled(), true, 'aceite liberado antes da leitura');

    const jump = dialog.locator('[data-legal-jump-to-end]');
    await jump.focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('#consent-test-dialog [data-legal-reading-progress]')?.textContent === '1 de 2 lidos');
    await page.evaluate(async () => {
      const consentDialog = document.querySelector('#consent-test-dialog');
      const { showLegalConsentDocuments } = await import('/src/js/features/footer/legal-dialog.js');
      await showLegalConsentDocuments(consentDialog);
    });
    assert.equal(await progress.textContent(), '1 de 2 lidos', 'progresso se perdeu ao reabrir');

    await jump.focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('#consent-test-dialog [data-legal-reading-progress]')?.textContent === '2 de 2 lidos');
    assert.equal(await checkbox.isDisabled(), false, 'aceite não liberado após os dois documentos');
    await checkbox.check();
    assert.equal(await confirm.isDisabled(), false, 'confirmação não liberada após marcar o aceite');
    assert.deepEqual(pageErrors, [], 'erros JavaScript');
    console.log('legal-consent-progress: teclado, progresso e aceite aprovados em 390 px');
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
