const assert = require('node:assert/strict');
const { chromium, devices } = require('playwright');
const { completeProfile, enableAreas } = require('./setup.cjs');

async function scrollPageBeforeModal(page, label) {
  const position = await page.evaluate(() => {
    window.scrollTo(0, Math.min(200, document.documentElement.scrollHeight - innerHeight));
    return {
      scrollY: window.scrollY,
      bodyTop: document.body.getBoundingClientRect().top,
      scrollHeight: document.documentElement.scrollHeight,
      viewportHeight: innerHeight,
    };
  });
  assert(position.scrollY > 0, `${label}: a página precisa ter conteúdo rolável`);
  return position;
}

async function assertLocked(page, position, label) {
  const before = await page.evaluate(() => {
    const header = document.querySelector('.app > .topbar, .public-site > .public-topbar');
    const rect = header?.getBoundingClientRect();
    return {
      bodyTop: document.body.getBoundingClientRect().top,
      overflow: getComputedStyle(document.documentElement).overflow,
      scrollLocked: document.documentElement.dataset.scrollLocked,
      headerTop: rect?.top,
      headerBottom: rect?.bottom,
      viewportHeight: innerHeight,
    };
  });
  assert.equal(before.overflow, 'hidden', `${label}: o scroll da raiz não foi bloqueado`);
  assert.equal(before.scrollLocked, 'true', `${label}: estado visual de scroll lock ausente`);
  if (before.headerTop !== undefined) {
    assert(before.headerTop >= -1 && before.headerTop < 2, `${label}: cabeçalho não permaneceu no topo (${before.headerTop}px)`);
    assert(before.headerBottom > 0 && before.headerBottom <= before.viewportHeight, `${label}: cabeçalho saiu da viewport`);
  }
  await page.mouse.move(5, 5);
  await page.mouse.wheel(0, 600);
  await page.waitForTimeout(100);
  const after = await page.evaluate(() => ({
    bodyTop: document.body.getBoundingClientRect().top,
    headerTop: document.querySelector('.app > .topbar, .public-site > .public-topbar')?.getBoundingClientRect().top,
  }));
  assert.equal(after.bodyTop, before.bodyTop, `${label}: o scroll externo moveu a página`);
  if (before.headerTop !== undefined) assert.equal(after.headerTop, before.headerTop, `${label}: o cabeçalho saiu do topo`);
  return position;
}

async function assertUnlocked(page, label) {
  const state = await page.evaluate(() => ({
    overflow: getComputedStyle(document.documentElement).overflow,
    bodyPosition: document.body.style.position,
    scrollLocked: document.documentElement.dataset.scrollLocked,
  }));
  assert.notEqual(state.overflow, 'hidden', `${label}: o scroll da raiz continuou bloqueado`);
  assert.notEqual(state.bodyPosition, 'fixed', `${label}: o corpo continuou fixo`);
  assert.equal(state.scrollLocked, undefined, `${label}: atributo de scroll lock não foi removido`);
}

async function checkCustomDialog(browser, options, label, base) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  try {
    await page.goto(base.toString());
    await completeProfile(page);
    await enableAreas(page, ['habits']);
    await page.evaluate(() => { location.hash = 'habitos'; });
    await page.locator('[data-action="habit-new"]').first().waitFor();
    const position = await scrollPageBeforeModal(page, `${label}, modal Aurora`);
    await page.evaluate(() => document.querySelector('[data-action="habit-new"]').click());
    await page.locator('#dlg').waitFor();
    assert.equal(await page.locator('#dlg').evaluate((dialog) => dialog instanceof HTMLDialogElement && dialog.open), true,
      `${label}: diálogos do app devem usar <dialog> nativo em modo modal`);
    await assertLocked(page, position, `${label}, modal Aurora`);
    await page.locator('#dlg [data-action="dlg-close"]').first().click();
    await page.locator('#dlg').waitFor({ state: 'detached' });
    await page.evaluate((scrollY) => window.scrollTo(0, scrollY), position.scrollY);
    await page.waitForFunction((scrollY) => Math.abs(window.scrollY - scrollY) <= 40, position.scrollY);
    const restored = await page.evaluate(() => ({
      scrollY: window.scrollY,
      bodyTop: document.body.getBoundingClientRect().top,
      scrollHeight: document.documentElement.scrollHeight,
      viewportHeight: innerHeight,
    }));
    assert(Math.abs(restored.scrollY - position.scrollY) <= 40, `${label}: posição não foi restaurada (${JSON.stringify({ position, restored })})`);
    await assertUnlocked(page, `${label}, modal Aurora`);

    const searchPosition = await scrollPageBeforeModal(page, `${label}, pesquisa`);
    await page.keyboard.press('Control+k');
    await page.locator('#dlg[data-dialog-type="search"]').waitFor();
    await assertLocked(page, searchPosition, `${label}, pesquisa`);
    await page.locator('#dlg [data-action="dlg-close"]').first().click();
    await page.locator('#dlg').waitFor({ state: 'detached' });
    await page.waitForFunction((scrollY) => Math.abs(window.scrollY - scrollY) <= 40, searchPosition.scrollY);
    const searchRestored = await page.evaluate(() => window.scrollY);
    assert(
      Math.abs(searchRestored - searchPosition.scrollY) <= 40,
      `${label}: posição não foi restaurada após pesquisa (${searchRestored} != ${searchPosition.scrollY})`,
    );
    await assertUnlocked(page, `${label}, pesquisa`);
  } finally {
    await context.close();
  }
}

async function checkPanel(browser, options, label, base, triggerSelector, panelSelector, closeSelector) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  try {
    await page.goto(base.toString());
    await completeProfile(page);
    const position = await scrollPageBeforeModal(page, `${label}, painel`);
    await page.locator(triggerSelector).first().evaluate((element) => element.click());
    await page.locator(panelSelector).waitFor({ state: 'visible' });
    await assertUnlocked(page, `${label}, painel`);
    if (label.includes('notificações') && label.startsWith('desktop')) {
      await page.locator(closeSelector).first().evaluate((element) => element.click());
      await page.locator(panelSelector).waitFor({ state: 'hidden' });
      await assertUnlocked(page, `${label}, notificações fechadas`);
      const restoredPanel = await page.evaluate(() => window.scrollY);
      assert(Math.abs(restoredPanel - position.scrollY) <= 40, `${label}: posição não foi restaurada após fechar notificações (${restoredPanel} != ${position.scrollY})`);
      await page.locator(triggerSelector).first().evaluate((element) => element.click());
      await page.locator(panelSelector).waitFor({ state: 'visible' });
      await page.keyboard.press('Control+k');
      await page.locator('#dlg[data-dialog-type="search"]').waitFor();
      await assertLocked(page, position, `${label}, pesquisa sobreposta`);
      await page.keyboard.press('Escape');
      await page.locator(panelSelector).waitFor({ state: 'hidden' });
      await assertLocked(page, position, `${label}, pesquisa após fechar notificações`);
      await page.keyboard.press('Escape');
      await page.locator('#dlg').waitFor({ state: 'detached' });
      await assertUnlocked(page, `${label}, pesquisa fechada`);
      return;
    }
    await page.locator(closeSelector).first().evaluate((element) => element.click());
    await page.locator(panelSelector).waitFor({ state: 'hidden' });
    const restored = await page.evaluate(() => window.scrollY);
    assert(Math.abs(restored - position.scrollY) <= 40, `${label}: posição não foi restaurada após fechar o painel (${restored} != ${position.scrollY})`);
    await assertUnlocked(page, `${label}, painel`);
  } finally {
    await context.close();
  }
}

async function checkLegalDialog(browser, options, label, base) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  try {
    await page.goto(base.toString(), { waitUntil: 'networkidle' });
    const position = await scrollPageBeforeModal(page, `${label}, modal legal`);
    await page.evaluate(() => document.querySelector('[data-legal-document="terms"]').click());
    await page.locator('dialog[data-legal-modal][open]').waitFor();
    await assertLocked(page, position, `${label}, modal legal`);
    await page.locator('[data-legal-modal-close]').first().click();
    await page.locator('dialog[data-legal-modal][open]').waitFor({ state: 'detached' });
    const restored = await page.evaluate(() => window.scrollY);
    assert(Math.abs(restored - position.scrollY) <= 40, `${label}: posição não foi restaurada (${restored} != ${position.scrollY})`);
  } finally {
    await context.close();
  }
}

(async () => {
  const browser = await chromium.launch();
  const base = new URL((process.argv[2] || 'http://127.0.0.1:5173/').replace(/\/$/, '/'));
  base.searchParams.set('preview', '1');
  const viewports = [
    ['iPhone 13', devices['iPhone 13']],
    ['desktop', { viewport: { width: 1280, height: 900 } }],
  ];

  try {
    for (const [label, options] of viewports) {
      await checkCustomDialog(browser, options, label, base);
      await checkPanel(browser, options, `${label}, notificações`, base, '[data-action="toggle-notifications"]', '#notification-panel', '[data-action="close-notifications"]');
      await checkLegalDialog(browser, options, label, base);
      console.log(`${label}: notificações não bloqueiam a tela; diálogos modais bloqueiam e restauram o scroll.`);
    }
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
