const { chromium } = require('playwright');

const BASE = process.argv[2] || 'http://127.0.0.1:5173';
const results = [];
const check = (passed, name, detail = '') => {
  results.push(passed);
  console.log(`${passed ? 'OK   ' : 'FALHA'} — ${name}${detail ? ` (${detail})` : ''}`);
};

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.goto(`${BASE}/?preview#inicio`);
  const card = page.locator('.home-first-steps');
  await card.waitFor({ state: 'visible' });
  check(await card.locator('summary').innerText().then((text) => text.includes('Primeiros passos')), 'primeiros passos aparecem recolhidos no Início');
  check(await card.getByRole('link').count() === 0, 'ações iniciais ficam recolhidas por padrão');
  await card.locator('summary').click();
  check(await card.getByRole('link').count() === 4, 'ações iniciais podem ser expandidas');
  check(await card.locator('ol > li').count() === 4, 'cartão lista as quatro ações iniciais');
  check(await card.locator('.home-first-steps-progress').innerText().then((text) => /\d+ de 4 ações concluídas/.test(text)), 'cartão informa o progresso das ações iniciais');
  check(await card.locator('li.is-next').count() === 1 && await card.locator('li.is-next small').innerText() === 'Sugestão para você', 'cartão destaca uma próxima ação personalizada');
  check(await page.locator('#dlg').count() === 0, 'tutorial não abre automaticamente');
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Início não tem overflow horizontal em 390 px');
  await page.setViewportSize({ width: 1366, height: 768 });
  const desktopLayout = await page.evaluate(() => {
    const hero = document.querySelector('.home-head').getBoundingClientRect();
    const guide = document.querySelector('.area-guide-control');
    const steps = document.querySelector('.home-first-steps');
    return {
      heroWidth: hero.width,
      guideColumn: getComputedStyle(guide).gridColumn,
      stepsColumn: getComputedStyle(steps).gridColumn,
      stepsWidth: steps.getBoundingClientRect().width,
      actionColumns: getComputedStyle(steps.querySelector('.home-first-steps-list')).gridTemplateColumns.split(' ').length,
    };
  });
  check(desktopLayout.guideColumn === '1 / -1' && desktopLayout.stepsColumn === '1 / -1', 'tutorial e primeiros passos ocupam a largura total no desktop');
  check(desktopLayout.stepsWidth >= desktopLayout.heroWidth * 0.95 && desktopLayout.actionColumns === 4, 'ações iniciais ficam em quatro colunas no desktop');
  await page.setViewportSize({ width: 390, height: 844 });

  await page.getByRole('link', { name: 'Personalizar início' }).click();
  await page.locator('.areas-navigation-settings').waitFor({ state: 'visible' });
  check(await page.locator('.areas-navigation-settings').count() === 1, 'atalho abre as opções de áreas e menu');
  check(await page.evaluate(() => new URLSearchParams(location.search).has('preview')), 'modo de prévia continua ativo ao navegar para Ajustes');
  await page.locator('.nav a[href="/inicio"]').click();
  await card.waitFor({ state: 'visible' });

  await page.getByRole('link', { name: 'Personalizar início' }).click();
  const activeAreas = await page.locator('.areas-navigation-toggle input:checked').evaluateAll((inputs) => inputs.map((input) => input.dataset.area));
  for (const area of activeAreas) {
    await page.locator(`.areas-navigation-toggle input[data-area="${area}"]`).uncheck();
  }
  await page.locator('.areas-navigation-settings [data-settings-save-button]').click();
  await page.locator('.nav a[href="/inicio"]').click();
  check(await card.count() === 0, 'primeiros passos oculta ações de áreas desativadas e some quando a tarefa restante já está concluída');

  await page.reload();
  await card.waitFor({ state: 'visible' });
  check(await page.evaluate(() => new URLSearchParams(location.search).has('preview')), 'modo de prévia continua ativo após recarregar');
  await card.locator('summary').click();
  await card.getByRole('button', { name: 'Dispensar' }).click();
  check(await card.count() === 0, 'cartão pode ser dispensado');

  await page.getByRole('button', { name: 'Como usar?' }).focus();
  await page.keyboard.press('Enter');
  const video = page.locator('.area-tutorial-video');
  await video.waitFor({ state: 'visible' });
  check(await video.getAttribute('autoplay') === null, 'vídeo só abre pela ação explícita e não usa autoplay');
  const sources = await video.locator('source').evaluateAll((items) => items.map(({ type, src }) => ({ type, src })));
  check(sources.map(({ type }) => type).join(',') === 'video/webm,video/mp4', 'player oferece WebM e fallback MP4');
  check(await Promise.all(sources.map(async ({ src }) => (await page.request.get(src)).ok())).then((results) => results.every(Boolean)), 'arquivos WebM e MP4 respondem pela origem local');
  await page.keyboard.press('Escape');
  await page.locator('#dlg').waitFor({ state: 'detached' });
  await page.locator('.profile-link').click();
  await page.locator('.settings-link[data-settings-tab="account"]').click();
  await page.locator('.account-resources-card').waitFor({ state: 'visible' });
  await page.locator('.account-resources-card [data-legal-document="terms"]').click();
  await page.locator('dialog[data-legal-modal][open] .legal-document').waitFor({ state: 'visible' });
  check(await page.locator('[data-legal-dialog-title]').innerText() === 'Termos de Uso', 'documentos legais seguem acessíveis em Ajustes');
  await page.locator('[data-legal-modal-close]').first().click();
  await page.locator('dialog[data-legal-modal][open]').waitFor({ state: 'detached' });
  check(errors.length === 0, 'sem erros no console', errors.slice(0, 3).join(' | '));

  await context.close();
  await browser.close();
  process.exit(results.every(Boolean) ? 0 : 1);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
