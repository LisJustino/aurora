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
  const quickCard = page.locator('.home-quick-card');
  await quickCard.waitFor({ state: 'visible' });
  check(await quickCard.locator('#home-quick-title-input').isVisible(), 'próximo passo fica visível sem abrir Mais do Início');
  check(await quickCard.evaluate((element) => !element.closest('.home-extras')), 'captura rápida fica fora do conteúdo secundário');
  check(await page.locator('.home-extras').getAttribute('open') === null, 'Mais do Início começa recolhido');
  const card = page.locator('.home-first-steps');
  check(await card.count() === 0, 'cartão de primeiro acesso não aparece na demonstração com tarefas fictícias');
  check(await page.locator('#dlg').count() === 0, 'tutorial não abre automaticamente');
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Início não tem overflow horizontal em 390 px');
  await page.setViewportSize({ width: 1366, height: 768 });
  const desktopLayout = await page.evaluate(() => {
    const hero = document.querySelector('.home-head').getBoundingClientRect();
    const guide = document.querySelector('.home-head .area-guide-button');
    const steps = document.querySelector('.home-first-steps');
    const guideStyle = getComputedStyle(guide);
    const ghostButton = document.createElement('button');
    ghostButton.className = 'btn ghost';
    guide.parentElement.append(ghostButton);
    const ghostStyle = getComputedStyle(ghostButton);
    const guideMatchesGhostStyle = [
      'backgroundColor', 'borderTopColor', 'minHeight', 'borderRadius',
      'paddingLeft', 'paddingRight', 'fontSize', 'fontWeight', 'boxShadow',
    ]
      .every((property) => guideStyle[property] === ghostStyle[property]);
    ghostButton.remove();
    const heroStyle = getComputedStyle(document.querySelector('.home-head'));
    const guideRightEdge = guide.getBoundingClientRect().right;
    const heroRightEdge = hero.right
      - parseFloat(heroStyle.borderRightWidth)
      - parseFloat(heroStyle.paddingRight);
    const guideAlignedRight = Math.abs(
      guideRightEdge - heroRightEdge,
    ) < 1;
    return {
      heroWidth: hero.width,
      guideInHeader: Boolean(guide),
      guideAlignedRight,
      guideMatchesGhostStyle,
      stepsColumn: getComputedStyle(document.querySelector('.home-extras')).gridColumn,
      stepsPresent: Boolean(steps),
    };
  });
  check(desktopLayout.guideInHeader && desktopLayout.stepsColumn === '1 / -1' && !desktopLayout.stepsPresent, 'atalho do tutorial fica no cabeçalho e cartão de primeiro acesso não aparece na demonstração');
  check(desktopLayout.guideAlignedRight, 'atalho “Como usar?” fica alinhado à direita no cabeçalho do Início');
  check(desktopLayout.guideMatchesGhostStyle, 'atalho do Início mantém o estilo compartilhado dos botões “Como usar?”');
  await page.setViewportSize({ width: 390, height: 844 });

  for (const route of ['planejar', 'financas', 'habitos', 'ciclo']) {
    await page.goto(`${BASE}/?preview#${route}`);
    const guide = page.locator('.page-title .area-page-actions .area-guide-button');
    await guide.waitFor({ state: 'visible' });
    check(await guide.count() === 1, `atalho “Como usar?” fica junto ao título em ${route}`);
    check(await guide.evaluate((button) => {
      const bounds = button.getBoundingClientRect();
      return bounds.left >= 0 && bounds.right <= innerWidth;
    }), `atalho de ${route} cabe na largura móvel`);
  }
  await page.goto(`${BASE}/?preview#inicio`);
  check(await page.getByRole('link', { name: 'Personalizar início' }).count() === 0, 'atalho Personalizar início foi removido do destaque');
  await page.locator('.profile-menu-trigger').click();
  await page.locator('#profile-menu a[href="/config"]').click();
  await page.locator('.settings-link[data-settings-tab="areas-navigation"]').click();
  await page.locator('.areas-navigation-settings').waitFor({ state: 'visible' });
  check(await page.locator('.areas-navigation-settings').count() === 1, 'opções de áreas e menu seguem acessíveis em Ajustes');
  check(await page.evaluate(() => new URLSearchParams(location.search).has('preview')), 'modo de prévia continua ativo ao navegar para Ajustes');
  await page.locator('.nav a[href="/inicio"]').click();
  check(await card.count() === 0, 'cartão de primeiro acesso não aparece na demonstração');

  await page.locator('.profile-menu-trigger').click();
  await page.locator('#profile-menu a[href="/config"]').click();
  await page.locator('.settings-link[data-settings-tab="areas-navigation"]').click();
  const activeAreas = await page.locator('.areas-navigation-toggle input:checked').evaluateAll((inputs) => inputs.map((input) => input.dataset.area));
  for (const area of activeAreas) {
    await page.locator(`.areas-navigation-toggle input[data-area="${area}"]`).uncheck();
  }
  await page.getByText('Salvo nesta demonstração.').waitFor({ state: 'visible' });
  await page.waitForFunction(() => document.querySelectorAll('.topbar .nav > a.nav-item').length === 2);
  await page.locator('.nav a[href="/inicio"]').click();
  check(await card.count() === 0, 'cartão de primeiro acesso permanece oculto na demonstração');

  await page.reload();
  check(await page.evaluate(() => new URLSearchParams(location.search).has('preview')), 'modo de prévia continua ativo após recarregar');

  await page.setViewportSize({ width: 360, height: 844 });
  const quickInput = page.locator('#home-quick-title-input');
  const quickSubmit = page.locator('.home-quick-form button[type="submit"]');
  check(await quickInput.getAttribute('enterkeyhint') === 'done', 'captura rápida sugere concluir no teclado móvel');
  check(await quickSubmit.isDisabled(), 'botão Adicionar começa desabilitado sem título');
  const quickLayout = await page.evaluate(() => {
    const input = document.querySelector('#home-quick-title-input').getBoundingClientRect();
    const button = document.querySelector('.home-quick-submit').getBoundingClientRect();
    const badge = document.querySelector('#home-quick-date-preview');
    return {
      inputCenter: input.top + input.height / 2,
      buttonCenter: button.top + button.height / 2,
      buttonWidth: button.width,
      buttonHeight: button.height,
      badgeTop: badge.getBoundingClientRect().top,
      buttonBottom: button.bottom,
      badgeWhiteSpace: getComputedStyle(badge).whiteSpace,
      badgeFits: badge.scrollWidth <= badge.clientWidth,
      noOverflow: document.documentElement.scrollWidth <= innerWidth,
    };
  });
  check(Math.abs(quickLayout.inputCenter - quickLayout.buttonCenter) < 1
    && quickLayout.buttonWidth >= 44 && quickLayout.buttonHeight >= 44,
  'campo e botão de envio cabem na mesma linha com alvo de toque de 44 px em 360 px');
  check(quickLayout.badgeTop >= quickLayout.buttonBottom
    && quickLayout.badgeWhiteSpace === 'nowrap' && quickLayout.badgeFits && quickLayout.noOverflow,
    'badge de prazo não quebra e não causa overflow horizontal em 360 px');
  await quickInput.fill('Revisar relatório amanhã 14h #trabalho');
  check((await page.locator('#home-quick-date-preview').innerText()).includes('14:00'),
    'captura rápida mostra a prévia do horário antes de salvar');
  check(await quickSubmit.isEnabled(), 'botão Adicionar habilita quando há título');
  await quickInput.press('Enter');
  const quickToast = page.locator('#toast .toast-message');
  await page.waitForFunction(() => /^Tarefa adicionada para .+ às 14:00\.$/.test(
    document.querySelector('#toast .toast-message')?.textContent || '',
  ));
  check((await quickToast.innerText()).startsWith('Tarefa adicionada para ')
    && (await quickToast.innerText()).includes('às 14:00'),
    'envio por Enter confirma o prazo no toast');
  check(await quickInput.inputValue() === ''
    && await quickInput.evaluate((input) => input === document.activeElement),
  'envio por Enter limpa o campo e devolve o foco');
  check(await quickSubmit.isDisabled(), 'botão Adicionar volta a desabilitar após o envio');

  await quickInput.fill('Preparar pauta hoje');
  await quickSubmit.click();
  await quickToast.waitFor({ state: 'visible' });
  check((await quickToast.innerText()).includes('Tarefa adicionada para hoje.'),
    'envio pelo botão confirma o prazo no toast');
  check(await quickInput.inputValue() === ''
    && await quickInput.evaluate((input) => input === document.activeElement),
  'envio pelo botão limpa o campo e devolve o foco');
  await page.locator('.nav a[href="/planejar"]').click();
  const createdTask = page.locator('.task').filter({ hasText: 'Revisar relatório' });
  check(await page.getByText('Revisar relatório', { exact: true }).count() >= 1
    && await createdTask.filter({ hasText: 'amanhã 14h' }).count() === 0,
  'captura rápida cria a tarefa sem manter a expressão de data no título');
  check(await page.getByText('Preparar pauta', { exact: true }).count() >= 1,
    'envio pelo botão também cria a tarefa');
  await page.locator('.nav a[href="/inicio"]').click();

  await page.getByRole('button', { name: 'Como usar?' }).focus();
  await page.keyboard.press('Enter');
  const video = page.locator('.area-tutorial-video');
  await video.waitFor({ state: 'visible' });
  check(await video.getAttribute('autoplay') === null, 'vídeo só abre pela ação explícita e não usa autoplay');
  const sources = await video.locator('source').evaluateAll((items) => items.map(({ type, src }) => ({ type, src })));
  check(sources.map(({ type }) => type).join(',') === 'video/mp4', 'player usa vídeo MP4 H.264 sem fallback duplicado');
  check(await video.evaluate((element) => element.currentSrc.endsWith('.mp4')), 'navegador compatível escolhe o MP4');
  check(await Promise.all(sources.map(async ({ src }) => (await page.request.get(src)).ok())).then((results) => results.every(Boolean)), 'arquivo MP4 responde pela origem local');
  await page.keyboard.press('Escape');
  await page.locator('#dlg').waitFor({ state: 'detached' });
  await page.locator('.profile-menu-trigger').click();
  await page.locator('#profile-menu a[href="/config"]').click();
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
