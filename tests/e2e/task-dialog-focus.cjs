const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const base = process.argv[2] || 'http://127.0.0.1:5173';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  try {
    await page.goto(`${base}/?preview#planejar`);
    await page.getByRole('button', { name: 'Nova tarefa' }).first().click();
    const title = page.locator('#dlg [data-dlg="title"]');
    await title.waitFor({ state: 'visible' });
    assert.equal(await title.evaluate((input) => document.activeElement === input), true);

    const titleVisible = await page.evaluate(async () => {
      const viewport = window.visualViewport;
      Object.defineProperty(viewport, 'height', { configurable: true, value: 500 });
      const input = document.querySelector('#dlg [data-dlg="title"]');
      const body = input.closest('.dlg-body');
      body.scrollTop = body.scrollHeight;
      viewport.dispatchEvent(new Event('resize'));
      await new Promise((resolve) => setTimeout(resolve, 300));
      const bounds = input.getBoundingClientRect();
      const bodyBounds = body.getBoundingClientRect();
      return bounds.top >= Math.max(bodyBounds.top, viewport.offsetTop)
        && bounds.bottom <= Math.min(bodyBounds.bottom, viewport.offsetTop + viewport.height);
    });
    assert.equal(titleVisible, true, 'o título deve ficar visível com a área reduzida pelo teclado');

    await page.locator('#dlg [data-action="dlg-close"]').first().click();
    await page.locator('[data-action="edit-task"]').first().click();
    const editTitle = page.locator('#dlg [data-dlg="title"]');
    await editTitle.waitFor({ state: 'visible' });
    assert.equal(await editTitle.evaluate((input) => document.activeElement === input), true);
    assert.deepEqual(errors, []);
    console.log('OK — foco inicial e visibilidade do título ao criar e editar tarefas');
  } finally {
    await context.close();
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
