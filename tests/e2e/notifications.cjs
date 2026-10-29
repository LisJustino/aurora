// Notificações: novos lembretes não abrem o painel sozinhos; o sino mostra o indicador e permite abrir, adiar e dispensar.
// Não é dependência do projeto. Uso: node tests/e2e/notifications.cjs [http://localhost:5173]
const assert = require('node:assert/strict');
const { chromium, devices } = require('playwright');

const BASE = process.argv[2] || 'http://localhost:5173';

async function addTask(page, title, offsetMinutes) {
  const date = await page.evaluate((offset) => {
    const due = new Date(Date.now() + offset * 60000);
    const padNumber = (value) => String(value).padStart(2, '0');
    return {
      day: `${due.getFullYear()}-${padNumber(due.getMonth() + 1)}-${padNumber(due.getDate())}`,
      time: `${padNumber(due.getHours())}:${padNumber(due.getMinutes())}`,
    };
  }, offsetMinutes);
  await page.locator('[data-action="task-new"]').first().click();
  await page.locator('[data-dlg="title"]').fill(title);
  await page.locator('[data-dlg="due"]').fill(date.day);
  await page.locator('[data-dlg="time"]').fill(date.time);
  await page.locator('[data-dlg="remind"]').selectOption('0');
  await page.locator('button[type="submit"][form="dlgform"]').click();
}

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  try {
    for (const [name, contextOptions] of [
      ['mobile', devices['iPhone 14']],
      ['desktop', { viewport: { width: 1280, height: 800 } }],
    ]) {
      const context = await browser.newContext(contextOptions);
      const page = await context.newPage();
      page.on('pageerror', (error) => errors.push(`${name}: ${error.message}`));
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(`${name}: ${message.text()}`);
      });
      await page.goto(new URL('/?preview', BASE).toString());
      await page.waitForTimeout(500);
      await page.addStyleTag({ content: '.preview-shell .header-actions .notification-trigger { display: inline-flex !important; }' });
      await page.evaluate(() => { location.hash = 'planejar'; });
      await page.locator('[data-action="task-new"]').first().waitFor({ state: 'visible' });

      await addTask(page, 'Enviar relatório', -5);
      await addTask(page, 'Separar documentos', -2);
      await addTask(page, 'Ligar para o dentista', 90);

      assert.equal(await page.locator('#notification-panel').isVisible(), false, `${name}: painel não deve abrir automaticamente`);
      const trigger = page.locator('#notification-top');
      await page.waitForFunction(
        () => document.querySelector('#notification-top .notification-count')?.textContent === '2',
        null,
        { timeout: 30000 },
      );
      assert.equal(await trigger.locator('.notification-count').textContent(), '2', `${name}: indicador deve mostrar os dois lembretes`);
      assert.match(await page.locator('#notification-announcer').textContent(), /Abra Notificações para conferir\./);
      await trigger.click();
      await page.locator('#notification-panel').waitFor({ state: 'visible' });
      assert.equal(await page.locator('.notification-item').count(), 2, `${name}: deve exibir os dois lembretes`);
      assert.equal(await page.locator('.notification-section-title').textContent(), 'Agora');
      assert.equal(await page.locator('.notification-upcoming h3').textContent(), 'Ainda hoje');
      assert.equal(await page.locator('.notification-upcoming li').count(), 1, `${name}: deve exibir o próximo lembrete`);

      if (name === 'mobile') {
        await page.locator('[data-action="rem-snooze"][data-min="60"]').first().click();
        assert.equal(await page.locator('.notification-item').count(), 1, 'adiar deve remover o aviso da lista ativa');
        await page.locator('[data-action="rem-dismiss"]').click();
        assert.equal(await page.locator('.notification-item').count(), 0, 'dispensar deve limpar o aviso da lista ativa');
        assert.equal(await page.locator('#notification-panel').isVisible(), true, 'dispensar um aviso deve manter o painel aberto');
      }

      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${name}: não deve haver overflow horizontal`);
      console.log(`${name}: notificações aprovadas`);
      await context.close();
    }
    assert.deepEqual(errors, [], `erros no navegador: ${errors.join('|')}`);
    console.log('sem erros no navegador');
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
