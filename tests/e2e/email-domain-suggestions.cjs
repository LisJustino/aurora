const assert = require('node:assert/strict');
const { chromium } = require('playwright');

async function run() {
  const browser = await chromium.launch();
  try {
    for (const viewport of [
      { width: 320, height: 720 },
      { width: 1366, height: 768 },
    ]) {
      const page = await browser.newPage({ viewport });
      const pageErrors = [];
      page.on('pageerror', (error) => pageErrors.push(error.message));
      await page.goto(process.argv[2] || 'http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
      await page.evaluate(async () => {
        const { createAccountForm } = await import('/src/js/services/account-auth.js');
        createAccountForm(document.querySelector('#app'), {
          title: 'Entre na sua conta',
          description: 'Informe seus dados de acesso.',
          mode: 'login',
        });
      });
      assert.equal(await page.locator('.account-field-error').count(), 0, 'abrir login não deve exibir erros nos campos vazios');
      assert.equal(await page.locator('[aria-invalid="true"]').count(), 0, 'campos do login não devem iniciar inválidos visualmente');
      assert.equal(await page.getByRole('button', { name: 'Entrar' }).isDisabled(), true, 'login vazio deve permanecer desabilitado');

      await page.evaluate(async () => {
        const { createAccountForm } = await import('/src/js/services/account-auth.js');
        createAccountForm(document.querySelector('#app'), {
          title: 'Crie seu acesso',
          description: 'Informe seu e-mail e escolha uma senha.',
          mode: 'signup-access',
        });
      });

      const email = page.getByRole('textbox', { name: 'E-mail' });
      await email.fill('elisa@');
      const popup = page.locator('.account-email-suggestions');
      assert.equal(await popup.isVisible(), true, 'sugestões devem abrir depois de @');
      assert.equal(await popup.locator('[role="option"]').count(), 4, 'lista inicial deve ser compacta');
      assert.equal(await page.locator('.account-field-error').count(), 0, 'não mostrar erro enquanto o e-mail está sendo digitado');
      await email.press('ArrowDown');
      await email.press('Enter');
      assert.equal(await email.inputValue(), 'elisa@gmail.com', 'seleção por teclado');
      assert.equal(await popup.isVisible(), false, 'lista deve fechar após selecionar');

      await email.fill('elisa@out');
      assert.equal(await popup.locator('[role="option"]').count(), 2, 'digitação deve filtrar as opções');
      await popup.getByRole('option', { name: 'elisa@outlook.com', exact: true }).click();
      assert.equal(await email.inputValue(), 'elisa@outlook.com', 'seleção por toque/clique');

      await email.fill('elisa@empresa.');
      assert.equal(await popup.isVisible(), false, 'domínio personalizado deve permitir continuar digitando');
      assert.equal(await page.locator('.account-field-error').count(), 0, 'não mostrar erro durante a digitação');
      await email.press('Tab');
      assert.equal(await email.getAttribute('aria-invalid'), 'true', 'validar depois que a pessoa sair do campo');
      assert.equal(await page.locator('.account-field-error').count(), 1, 'erro deve aparecer ao sair de um e-mail inválido');
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
        true,
        `overflow horizontal em ${viewport.width}px`,
      );
      assert.deepEqual(pageErrors, [], 'erros JavaScript');
      console.log(`email-domain-suggestions: teclado, clique, validação após blur e ${viewport.width}px aprovados`);
      await page.close();
    }
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
