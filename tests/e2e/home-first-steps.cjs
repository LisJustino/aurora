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
  check(await card.getByRole('heading', { name: 'Primeiros passos.' }).count() === 1, 'cartão aparece no Início');
  check(await card.locator('ol > li').count() === 4, 'cartão lista as quatro ações iniciais');
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
  await page.locator('.home-layout-settings').waitFor({ state: 'visible' });
  check(await page.locator('.areas-navigation-settings').count() === 1, 'atalho abre as opções de personalização da Home');
  await page.locator('.nav a[href="#inicio"]').click();
  await card.waitFor({ state: 'visible' });

  await page.getByRole('link', { name: 'Personalizar início' }).click();
  const activeAreas = await page.locator('.areas-navigation-toggle input:checked').evaluateAll((inputs) => inputs.map((input) => input.dataset.area));
  for (const area of activeAreas) {
    await page.locator(`.areas-navigation-toggle input[data-area="${area}"]`).uncheck();
  }
  await page.locator('.areas-navigation-settings [data-settings-save-button]').click();
  await page.locator('.nav a[href="#inicio"]').click();
  check(await card.count() === 0, 'primeiros passos oculta ações de áreas desativadas e some quando a tarefa restante já está concluída');

  await page.reload();
  await card.waitFor({ state: 'visible' });
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
  check(errors.length === 0, 'sem erros no console', errors.slice(0, 3).join(' | '));

  await context.close();
  await browser.close();
  process.exit(results.every(Boolean) ? 0 : 1);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
