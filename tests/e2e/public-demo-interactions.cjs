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
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors = [];
  const interactionRequests = [];
  const mainModuleRequests = [];
  const tutorialRequests = [];
  let collectRequests = false;
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.endsWith('/src/js/main.js')) mainModuleRequests.push(request.url());
    if (/\.(mp4|webm)$/i.test(url.pathname)) tutorialRequests.push(request.url());
    if (collectRequests) interactionRequests.push(request.url());
  });

  await page.goto(BASE);
  await page.keyboard.press('Tab');
  check(await page.locator('.public-site > .skip:first-child').evaluate((link) =>
    document.activeElement === link && link.getAttribute('href') === '#landing-main'),
  'primeiro foco da landing permite pular para o conteúdo');
  await page.keyboard.press('Enter');
  check(await page.locator('#landing-main').evaluate((main) => document.activeElement === main),
    'link de pular leva o foco ao conteúdo principal');
  const themeButton = page.locator('[data-public-control="theme-cycle"]');
  for (const [mode, label, title] of [
    ['light', 'Alternar para tema escuro', 'Tema atual: claro. Alternar para tema escuro'],
    ['dark', 'Alternar para tema automático', 'Tema atual: escuro. Alternar para tema automático'],
    ['auto', 'Alternar para tema claro', 'Tema atual: automático. Alternar para tema claro'],
  ]) {
    check(await themeButton.getAttribute('aria-label') === label
      && await themeButton.getAttribute('title') === title,
    `controle de tema informa o estado ${mode} e a próxima ação`);
    await themeButton.click();
  }
  check(await themeButton.getAttribute('aria-label') === 'Alternar para tema escuro'
    && await page.evaluate(() => document.documentElement.dataset.theme === 'light'),
  'controle de tema mantém o ciclo claro, escuro e automático');
  check(mainModuleRequests.length === 0, 'landing pública não baixa o módulo completo antes da autenticação');
  check(await page.locator('.public-values p, .preview-cycle-week i, .preview-cycle-days i, .preview-cycle-note, .preview-cycle-privacy, .preview-task-heading small, .preview-task-row b, .preview-task-row small, .public-footer .footer-brand p, .public-footer .footer-meta').evaluateAll((elements) =>
    elements.every((element) => parseFloat(getComputedStyle(element).fontSize) >= 14)),
  'texto informativo e interativo da landing tem no mínimo 14px');
  check(await page.getByRole('heading', { name: 'Menos ruído. Mais clareza no dia.' }).count() === 1, 'landing apresenta o benefício principal do Aurora');
  check(await page.getByText('Feito para a vida como ela é').count() === 1
    && await page.locator('.public-values > .public-value').count() === 4
    && await page.locator('.public-journey-grid').count() === 0,
  'landing apresenta as áreas sem repetir uma jornada intermediária');
  const tutorialTabs = page.getByRole('tablist', { name: 'Áreas do Aurora' });
  check(await tutorialTabs.getByRole('tab').count() === 5
    && await page.locator('.landing-tutorial-panel:visible').count() === 1
    && await page.locator('.landing-tutorial-panel video').count() === 5
    && await page.locator('.landing-tutorial-panel video').evaluateAll((videos) =>
      videos.every((video) => video.preload === 'none'
        && video.muted
        && video.playsInline
        && video.controls
        && !video.hasAttribute('autoplay')
        && video.width === 1280
        && video.height === 720
        && !video.querySelector('source[type="video/mp4"]')?.hasAttribute('src')
        && video.querySelectorAll('source').length === 1)
    && document.querySelector('.landing-tutorial-panel:not([hidden]) video').poster.endsWith('/src/assets/tutorials/inicio.webp')
    && [...document.querySelectorAll('[data-tutorial-poster]')].every((panel) =>
      panel.dataset.tutorialPoster.endsWith(`/src/assets/tutorials/${panel.dataset.area}.webp`))),
  'vídeos usam poster WebP, dimensões explícitas e controles nativos sem carregar as fontes antes da interação');
  check(tutorialRequests.length === 0
    && await page.locator('.landing-tutorial-panel video').first().evaluate((video) => video.paused),
  'landing não transfere nem reproduz vídeos no carregamento inicial, mesmo com movimento reduzido');
  await tutorialTabs.getByRole('tab', { name: 'Início' }).focus();
  await page.keyboard.press('ArrowRight');
  const selectedTutorialSource = await page.locator('.landing-tutorial-panel:visible video source[type="video/mp4"]').getAttribute('src');
  check(await tutorialTabs.getByRole('tab', { name: 'Planejar' }).getAttribute('aria-selected') === 'true'
    && await page.locator('.landing-tutorial-panel:visible').count() === 1
    && await page.locator('.landing-tutorial-panel:visible video').getAttribute('aria-label') === 'Demonstração em vídeo: Planejar'
    && (await page.locator('.landing-tutorial-panel:visible video').getAttribute('poster')).endsWith('/planejar.webp')
    && selectedTutorialSource?.includes('planejar.mp4'),
  'abas de demonstração são navegáveis pelo teclado e mostram um player por vez');
  await tutorialTabs.getByRole('tab', { name: 'Início' }).click();
  check(await page.locator('.landing-tutorial-panel:visible video').evaluate((video) => {
    const bounds = video.getBoundingClientRect();
    return bounds.height > 0 && Math.abs(bounds.width / bounds.height - 16 / 9) < 0.02;
  }), 'vídeo da landing respeita a proporção 16:9 em tela estreita');
  const community = page.locator('.public-community');
  check(await community.evaluate((section) =>
    section.previousElementSibling?.classList.contains('public-tutorials')
    && section.previousElementSibling.previousElementSibling?.classList.contains('public-features')
    && section.nextElementSibling?.classList.contains('public-cta-panel'))
    && await community.getByRole('heading', { name: 'Ajude a melhorar o Aurora' }).count() === 1
    && await community.getByRole('link', { name: 'Enviar uma sugestão' }).getAttribute('href') === '#public-suggestion'
    && await community.getByText(/Conte o que tornaria sua rotina mais simples/).count() === 1,
  'convite de feedback aparece após as áreas sem destacar falta de avaliações');
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    check(await community.evaluate((section) => {
      const bounds = section.getBoundingClientRect();
      const link = section.querySelector('a').getBoundingClientRect();
      return link.left >= bounds.left && link.right <= bounds.right
        && document.documentElement.scrollWidth <= innerWidth;
    }), `convite da comunidade cabe sem overflow em ${width}px`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  check(await page.getByRole('heading', { name: 'Feito por uma pessoa só, com cuidado' }).count() === 0
    && await page.locator('.public-main > .public-maker').count() === 0
    && await page.locator('.public-main > .public-features').evaluate((features) =>
      features.previousElementSibling?.classList.contains('public-hero')),
  'landing apresenta as áreas diretamente após o hero, sem a seção removida');
  const suggestionDisclosure = page.locator('[data-suggestion-disclosure]');
  const pricingDisclosure = page.locator('.public-faq-item').first();
  check(await pricingDisclosure.evaluate((item) => item.open)
    && await pricingDisclosure.locator('p').isVisible()
    && await pricingDisclosure.locator('summary').getAttribute('aria-expanded') === 'true',
  'resposta sobre gratuidade está aberta e acessível por padrão');
  await pricingDisclosure.locator('summary').click();
  await page.waitForFunction(() => document.querySelector('.public-faq-item summary').getAttribute('aria-expanded') === 'false');
  check(!(await pricingDisclosure.evaluate((item) => item.open)),
    'resposta sobre gratuidade ainda pode ser recolhida');
  check(await page.locator('.public-faq-item').first().locator('summary').textContent().then((text) => /grátis/i.test(text))
    && await page.locator('.public-faq-item:not([data-suggestion-disclosure])').count() === 10
    && await page.locator('.public-faq-item').count() === 11
    && await page.locator('.public-faq').getByText(/não são criptografados|sem conexão|confirmar meu e-mail/i).count() === 0
    && await page.locator('.public-faq').getByText(/Onde ficam meus dados\?|Posso exportar meus dados\?|Posso apagar minha conta\?/).count() === 3
    && await page.locator('.public-footer form[data-footer-suggestion]').count() === 0
    && await suggestionDisclosure.count() === 1
    && await suggestionDisclosure.evaluate((disclosure) =>
      !disclosure.open && Boolean(disclosure.closest('.public-faq-list')))
    && await suggestionDisclosure.locator(':scope > summary').getAttribute('aria-expanded') === 'false'
    && await suggestionDisclosure.locator('form[data-footer-suggestion]').count() === 1
    && !(await suggestionDisclosure.locator('form[data-footer-suggestion]').isVisible()),
  'FAQ mantém respostas recolhidas e o formulário de sugestão no fim');
  check(await page.locator('.public-value-preview').count() === 4
    && await page.locator('.public-value-preview video').count() === 0
    && await page.locator('.public-value-preview').evaluateAll((previews) => previews.filter((preview) => preview.getClientRects().length).every((preview) => {
      const box = preview.getBoundingClientRect();
      return box.width > 100 && preview.scrollWidth <= box.width + 2;
    })),
  'cada área tem uma prévia estática feita em HTML e CSS');
  check(await page.locator('.public-value:visible').count() === 1, 'celular exibe uma área por vez');
  await page.getByRole('button', { name: 'Ciclo', exact: true }).click();
  check(await page.locator('.public-value:visible h3').textContent() === 'Ciclo'
    && await page.getByRole('button', { name: 'Ciclo', exact: true }).getAttribute('aria-pressed') === 'true',
  'seletor móvel troca a área exibida');
  check(await page.getByText('profissional e mãe').count() === 0
    && await page.getByText('estudante e freelancer').count() === 0
    && await page.getByText('gestora de rotina').count() === 0, 'landing não apresenta depoimentos fictícios');
  check(await page.locator('.public-hero [data-public-action="demo"]').evaluate((button) => button.classList.contains('primary'))
    && await page.locator('.public-hero a[href="/demonstracao"]').count() === 1
    && await page.locator('.public-header-actions [data-public-action="signup"]').evaluate((button) => !button.classList.contains('primary'))
    && await page.locator('.public-hero .public-actions .btn.primary').count() === 1,
  'demonstração é o único CTA primário do hero e abre como página sem cadastro');
  check(await page.locator('.public-hero .public-actions').evaluate((actions) =>
    actions.nextElementSibling?.matches('.public-price-note')
    && actions.nextElementSibling.textContent.includes('Grátis e sem cadastro.')),
  'informação de gratuidade aparece diretamente abaixo do CTA');
  check(await page.locator('.preview-cycle-privacy').getAttribute('href') === '/privacy'
    && await page.locator('.public-values').getAttribute('role') === 'group',
  'link de privacidade vai direto ao destino final e o grupo de áreas tem nome semântico');
  check(await page.locator('.preview-phone-nav').getByText('Ciclo').count() === 1,
    'prévia do celular mostra as quatro áreas, incluindo Ciclo');
  check(await page.locator('.public-hero [data-public-action="signup"], .public-hero [data-public-action="login"]').count() === 0,
    'hero não repete ações de cadastro ou entrada');
  check(await page.locator('.public-cta-panel [data-public-action="signup"], .public-cta-panel [data-public-action="demo"]').count() === 0,
    'painel de instalação mantém sua ação própria');
  check(await page.locator('.public-final-cta').count() === 0
    && await page.locator('.public-main').evaluate((main) =>
      main.nextElementSibling?.matches('footer.public-footer')),
  'a landing termina no conteúdo útil e segue direto ao rodapé');
  await page.setViewportSize({ width: 390, height: 844 });
  const heroTask = page.locator('.public-hero [data-landing-task]').last();
  const heroTasks = page.locator('.public-hero [data-landing-task]');
  check(await page.locator('.public-hero .preview-phone').count() === 1
    && await page.locator('.preview-phone [data-landing-task]').count() === 3
    && await page.locator('.public-hero .preview-float').count() === 0,
  'hero apresenta um único celular com tarefas interativas, sem cartões flutuantes');
  check(await page.locator('.preview-phone').evaluate((phone) => {
    const bounds = phone.getBoundingClientRect();
    return bounds.height / bounds.width >= 1.7;
  })
    && await page.locator('.preview-phone-screen').count() === 1
    && await page.locator('.preview-phone-logo').evaluate((logo) => logo.complete && logo.naturalWidth > 0 && logo.alt === '')
    && await page.locator('.preview-phone-wordmark').textContent() === 'aurora.',
  'prévia mostra uma tela de celular com o logo oficial do Aurora');
  const taskName = await heroTask.getAttribute('aria-label');
  check(await heroTask.locator('i').evaluate((mark) => getComputedStyle(mark).color === 'rgba(0, 0, 0, 0)'),
    'tarefa pendente não exibe uma marca de conclusão');
  await heroTask.click();
  check(await heroTask.getAttribute('aria-pressed') === 'true'
    && await heroTask.getAttribute('aria-label') === taskName
    && await heroTask.locator('small').textContent() === 'Concluída'
    && await heroTask.locator('i').evaluate((mark) => mark.textContent === '✓' && getComputedStyle(mark).color !== 'rgba(0, 0, 0, 0)')
    && await page.locator('[data-preview-task-summary]').textContent() === '3 de 3 feitas'
    && await page.locator('[data-landing-task-group]').getAttribute('aria-label') === '3 de 3 tarefas de exemplo concluídas'
    && await page.locator('.preview-task-progress i').evaluate((progress) => progress.style.width) === '100%',
  'mock do hero permite concluir uma tarefa sem sair da landing');
  await heroTask.focus();
  await page.keyboard.press('Space');
  await heroTasks.nth(0).click();
  await heroTasks.nth(1).click();
  check(await heroTask.getAttribute('aria-pressed') === 'false'
    && await heroTask.getAttribute('aria-label') === taskName
    && await heroTask.locator('i').evaluate((mark) => getComputedStyle(mark).color === 'rgba(0, 0, 0, 0)')
    && await heroTasks.first().locator('small').textContent() === 'Seu próximo passo'
    && await page.locator('[data-preview-task-summary]').textContent() === '0 de 3 feitas'
    && await page.locator('.preview-task-progress i').evaluate((progress) => progress.style.width) === '0%',
  'tarefas podem ser desmarcadas pelo teclado e pelo clique, atualizando o progresso');
  for (const task of await heroTasks.all()) await task.click();
  await page.setViewportSize({ width: 320, height: 720 });
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'landing não tem overflow horizontal em 320 px');
  check(await page.locator('.public-journey-grid').count() === 0,
    'landing não repete a proposta de valor em uma jornada no celular');
  await page.setViewportSize({ width: 390, height: 844 });
  const termsTrigger = page.locator('[data-legal-document="terms"]').first();
  await page.evaluate(() => window.scrollTo(0, 200));
  const legalScrollBefore = await page.evaluate(() => window.scrollY);
  await termsTrigger.evaluate((button) => button.click());
  const legalDialog = page.locator('dialog[data-legal-modal]');
  await legalDialog.locator('.legal-document').waitFor();
  check(await legalDialog.evaluate((dialog) => dialog.open), 'documentos legais continuam acessíveis sem carregar o módulo completo');
  check(
    await page.evaluate(() => document.documentElement.dataset.scrollLocked === 'true'
      && getComputedStyle(document.documentElement).overflow === 'hidden'),
    'modal legal bloqueia a rolagem do fundo',
  );
  await legalDialog.locator('.legal-document h1').click();
  check(await legalDialog.evaluate((dialog) => dialog.open), 'clique no conteúdo não fecha o modal legal');
  const hashBeforeLegalIndex = new URL(page.url()).hash;
  await legalDialog.getByRole('link', { name: 'Limites dos recursos', exact: true }).click();
  check(await legalDialog.evaluate((dialog) => dialog.open)
    && new URL(page.url()).hash === hashBeforeLegalIndex
    && await legalDialog.locator('#terms-limits').isVisible(),
  'índice do modal navega no documento sem mudar a URL da landing');
  await legalDialog.locator('.legal-modal-footer [data-legal-modal-close]').focus();
  await page.keyboard.press('Tab');
  check(
    await legalDialog.locator('[data-legal-modal-close]').first().evaluate((button) => document.activeElement === button),
    'foco permanece preso dentro do modal legal',
  );
  await legalDialog.locator('[data-legal-modal-close]').first().click();
  await page.waitForFunction(() => !document.querySelector('dialog[data-legal-modal]').open);
  await page.waitForTimeout(200);
  const legalCloseState = await page.evaluate((scrollY) => ({
    scrollY: window.scrollY,
    expectedScrollY: scrollY,
    locked: document.documentElement.dataset.scrollLocked,
    activeElement: document.activeElement?.outerHTML,
  }), legalScrollBefore);
  check(
    Math.abs(legalCloseState.scrollY - legalCloseState.expectedScrollY) <= 40
      && legalCloseState.locked === undefined
      && legalCloseState.activeElement?.includes('data-legal-document="terms"'),
    'fechar o modal restaura o foco de abertura e a rolagem',
    JSON.stringify(legalCloseState),
  );
  await page.locator('[data-legal-document="privacy"]').first().click();
  await legalDialog.locator('.legal-document').waitFor();
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('dialog[data-legal-modal]').open
    && document.activeElement.matches('[data-legal-document="privacy"]'));
  const escapeFocus = await page.evaluate(() => document.activeElement?.outerHTML || '');
  check(escapeFocus.includes('data-legal-document="privacy"'), 'Escape fecha o modal e devolve o foco ao acionador', escapeFocus);
  await termsTrigger.click();
  await legalDialog.locator('.legal-document').waitFor();
  const backdropPoint = await legalDialog.evaluate((dialog) => {
    const bounds = dialog.getBoundingClientRect();
    return bounds.bottom < innerHeight
      ? { x: Math.min(innerWidth - 1, bounds.left + 1), y: innerHeight - 1 }
      : { x: 1, y: 1 };
  });
  await page.mouse.click(backdropPoint.x, backdropPoint.y);
  await page.waitForFunction(() => !document.querySelector('dialog[data-legal-modal]').open);
  check(true, 'clique no fundo fecha o modal legal');
  const demoCtas = await page.locator('.public-site [data-public-action="demo"]').allTextContents();
  check(demoCtas.every((label) => label.trim() === 'Ver demonstração'),
    'todos os CTAs públicos de demonstração usam o mesmo rótulo');
  await page.locator('.public-hero [data-public-action="demo"]').focus();
  await page.keyboard.press('Enter');
  await page.getByRole('heading', { name: /^(Bom dia|Boa tarde|Boa noite), pessoa/i }).waitFor();
  check(new URL(page.url()).pathname === '/demonstracao'
    && await page.getByRole('heading', { name: /^(Bom dia|Boa tarde|Boa noite), pessoa/i }).isVisible(),
  'o CTA da landing abre a demonstração sem cadastro pelo teclado');
  mainModuleRequests.length = 0;
  await page.goto(`${BASE}/demonstracao`);
  await page.getByRole('heading', { name: /^(Bom dia|Boa tarde|Boa noite), pessoa/i }).waitFor();
  check(mainModuleRequests.length === 0, 'a demonstração direta não baixa o módulo completo');
  check(await page.locator('.demo-nav-link').count() === 8, 'demonstração oferece navegação pelas áreas do app');
  const sampleBanner = page.getByRole('note');
  check(await sampleBanner.getByText('Demonstração com dados fictícios.', { exact: true }).isVisible()
    && await sampleBanner.getByRole('link', { name: 'Criar conta', exact: true }).isVisible(),
  'a faixa identifica os dados fictícios e oferece criação de conta');
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    const bannerLayout = await page.locator('.sample-banner').evaluate((banner) => {
      const bounds = banner.getBoundingClientRect();
      const topbarBounds = document.querySelector('.demo-app > .public-topbar').getBoundingClientRect();
      const copy = banner.querySelector('.sample-banner-copy');
      const hero = document.querySelector('.home-head');
      const heroTop = hero.getBoundingClientRect().top;
      banner.style.display = 'none';
      const heroTopWithoutBanner = hero.getBoundingClientRect().top;
      banner.style.display = '';
      return {
        position: getComputedStyle(banner).position,
        height: bounds.height,
        top: bounds.top,
        topbarBottom: topbarBounds.bottom,
        copyFits: copy.scrollWidth <= copy.clientWidth,
        pageFits: document.documentElement.scrollWidth <= innerWidth,
        heroStaysInPlace: Math.abs(heroTop - heroTopWithoutBanner) <= 1,
      };
    });
    check(bannerLayout.position === 'fixed' && bannerLayout.height <= 44
      && Math.abs(bannerLayout.top - bannerLayout.topbarBottom) <= 1
      && bannerLayout.copyFits && bannerLayout.pageFits && bannerLayout.heroStaysInPlace,
    `a faixa fixa cabe sem deslocar o conteúdo em ${width}px`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [themeName, theme] of Object.entries({
    claro: { theme: 'light' },
    escuro: { theme: 'dark' },
    'alto contraste': { contrast: 'high' },
    'alto contraste escuro': { theme: 'dark', contrast: 'high' },
  })) {
    const contrastRatios = await page.evaluate((attributes) => {
      const root = document.documentElement;
      delete root.dataset.theme;
      delete root.dataset.contrast;
      Object.assign(root.dataset, attributes);
      const banner = document.querySelector('.sample-banner');
      const copy = banner.querySelector('.sample-banner-copy');
      const action = banner.querySelector('.btn');
      const parseColor = (value) => {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 1;
        const context = canvas.getContext('2d');
        context.fillStyle = value;
        context.fillRect(0, 0, 1, 1);
        return Array.from(context.getImageData(0, 0, 1, 1).data);
      };
      const luminance = (channels) => {
        const linear = channels.slice(0, 3).map((channel) => {
          const value = channel / 255;
          return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
        });
        return .2126 * linear[0] + .7152 * linear[1] + .0722 * linear[2];
      };
      const contrast = (foreground, background) => {
        const fg = parseColor(foreground);
        const bg = parseColor(background);
        const alpha = fg[3] / 255;
        const blended = fg.slice(0, 3).map((channel, index) => channel * alpha + bg[index] * (1 - alpha));
        const first = luminance(blended);
        const second = luminance(bg);
        return (Math.max(first, second) + .05) / (Math.min(first, second) + .05);
      };
      const bannerBackground = getComputedStyle(banner).backgroundColor;
      return [
        contrast(getComputedStyle(copy).color, bannerBackground),
        contrast(getComputedStyle(action).color, getComputedStyle(action).backgroundColor),
      ];
    }, theme);
    check(contrastRatios.every((ratio) => ratio >= 4.5),
      `o texto da faixa mantém contraste mínimo em ${themeName}`,
      `${contrastRatios.map((ratio) => ratio.toFixed(2)).join(':1, ')}:1`);
  }
  await page.evaluate(() => { document.documentElement.dataset.theme = 'light'; delete document.documentElement.dataset.contrast; });
  await page.waitForTimeout(500);
  const storageBefore = await page.evaluate(() => JSON.stringify({
    local: Object.fromEntries(Object.keys(localStorage).sort().map((key) => [key, localStorage.getItem(key)])),
    session: Object.fromEntries(Object.keys(sessionStorage).sort().map((key) => [key, sessionStorage.getItem(key)])),
  }));
  await page.evaluate(() => document.fonts.ready);
  collectRequests = true;

  check(await page.getByRole('heading', { name: 'Qual é o próximo passo?' }).count() === 1
    && await page.locator('[data-demo-task-form] input').count() === 1,
  'Início da demonstração oferece o campo de tarefa usado no app');
  const taskInput = page.locator('#demo-home-task');
  await taskInput.fill('   ');
  await page.getByRole('button', { name: 'Adicionar', exact: true }).click();
  check(await page.locator('.home-today-card .task').count() === 3
    && await taskInput.evaluate((input) => !input.validity.valid),
  'tarefa vazia ou composta de espaços não é adicionada');
  const newTaskTitle = 'Tarefa <b>sem HTML</b>';
  await taskInput.fill(newTaskTitle);
  await page.getByRole('button', { name: 'Adicionar', exact: true }).click();
  check(await page.locator('.home-today-card .task').count() === 4
    && await page.getByText(newTaskTitle, { exact: true }).count() === 1
    && await page.locator('.home-today-card b').count() === 0,
  'tarefa criada no Início é exibida como texto escapado, não como HTML');
  await page.locator('.demo-nav [data-demo-view="tasks"]').click();
  const newTask = page.getByRole('checkbox', { name: `Marcar como concluída: ${newTaskTitle}` });
  check(await page.locator('.demo-task-list .task').count() === 4
    && await page.locator('.demo-task-list [role="checkbox"]').count() === 4
    && await page.locator('.demo-add-form input').count() === 1,
  'tarefa criada no Início também aparece no planejamento');
  await newTask.click();
  check(await page.getByRole('checkbox', { name: `Marcar como pendente: ${newTaskTitle}` })
    .getAttribute('aria-checked') === 'true'
    && await page.locator('.demo-area-panel .pill').textContent() === '3 de 4 feitos',
  'tarefa de exemplo pode ser marcada como concluída');
  const reducedTaskMotion = await page.getByRole('checkbox', { name: `Marcar como pendente: ${newTaskTitle}` })
    .locator('span').evaluate((span) => ({
      animationName: getComputedStyle(span).animationName,
      transitionProperty: getComputedStyle(span).transitionProperty,
    }));
  check(reducedTaskMotion.animationName === 'none' && reducedTaskMotion.transitionProperty === 'none',
    'conclusão troca o estado sem animação quando o movimento é reduzido');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const demoProgressMotion = await page.locator('.demo-nav [data-demo-view="today"]').evaluate((button) => {
    button.click();
    const ring = document.querySelector('.home-head .ring-fg');
    return {
      animationName: getComputedStyle(ring).animationName,
      from: getComputedStyle(ring).strokeDashoffset,
      to: ring.getAttribute('stroke-dashoffset'),
    };
  });
  check(demoProgressMotion.animationName === 'progress-ring-fill'
    && demoProgressMotion.from !== demoProgressMotion.to,
  'anel do Início preenche do progresso anterior ao novo');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('.demo-nav [data-demo-view="tasks"]').click();

  await page.getByRole('link', { name: 'Hábitos', exact: true }).click();
  check(await page.locator('.demo-habit-card [data-demo-action="habit-toggle"]').count() === 7,
    'check-ins de hábito podem ser alternados nesta visita');
  await page.getByRole('button', { name: 'quarta-feira: não marcado' }).click();
  check(await page.getByRole('button', { name: 'quarta-feira: marcado' }).getAttribute('aria-pressed') === 'true'
    && await page.locator('.demo-habit-card .demo-muted').textContent() === '3 dias nesta semana',
  'marcar um hábito atualiza o check-in e o resumo semanal');

  check(await page.getByRole('link', { name: 'Foco', exact: true }).count() === 0
    && await page.locator('.demo-focus-card, .focus-timer, .pomodoro-mini').count() === 0,
  'demonstração não oferece uma área de timer');

  await page.getByRole('link', { name: 'Ciclo', exact: true }).click();
  const cycleDays = await page.locator('[data-demo-action="cycle-day"]').evaluateAll((buttons) =>
    buttons.map((button) => button.dataset.day));
  const expectedCycleDays = await page.evaluate(() => {
    const first = new Date();
    first.setHours(0, 0, 0, 0);
    first.setDate(first.getDate() - ((first.getDay() + 6) % 7));
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(first);
      date.setDate(first.getDate() + index);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    });
  });
  check(JSON.stringify(cycleDays) === JSON.stringify(expectedCycleDays),
    'calendário de ciclo gera a semana a partir da data local');
  await page.getByRole('button', { name: 'Registrar cólica leve' }).click();
  check(await page.getByRole('heading', { name: 'Sintoma registrado: cólicas leves.' }).count() === 1,
    'demonstração permite visualizar um sintoma fictício de ciclo');
  await page.getByRole('link', { name: 'Finanças', exact: true }).click();
  const currentMonth = await page.evaluate(() => new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' })
    .format(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  check(await page.getByRole('heading', { name: new RegExp(`^${currentMonth}$`, 'i') }).count() === 1
    && await page.getByText('R$ 1.960,00', { exact: true }).count() === 1,
  'resumo financeiro usa o mês atual e mantém o total alinhado à landing');
  await page.getByLabel('Lançar uma despesa fictícia').waitFor();
  await page.locator('#demo-expense-title').fill('Café de teste');
  await page.getByLabel('Valor da despesa').fill('12,50');
  await page.locator('[data-demo-expense-form] button[type="submit"]').click();
  check(await page.getByText('Café de teste', { exact: true }).count() === 1
    && await page.getByText('R$ 1.972,50', { exact: true }).count() === 1,
  'despesa fictícia atualiza o total usando centavos');
  await page.getByRole('button', { name: 'Mês anterior' }).click();
  const previousMonth = await page.evaluate(() => {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - 1);
    return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(date);
  });
  check(await page.getByRole('heading', { name: new RegExp(`^${previousMonth}$`, 'i') }).count() === 1,
    'finanças permite comparar o mês anterior à data atual');
  await page.getByRole('link', { name: 'Água', exact: true }).click();
  const waterProgress = page.locator('.demo-water-progress');
  check(await waterProgress.getAttribute('value') === '1250', 'área de Água apresenta o registro fictício atual');
  await page.getByRole('button', { name: 'Registrar 250 mL' }).click();
  check(await waterProgress.getAttribute('value') === '1500', 'registro de água altera apenas a demonstração');
  await page.getByRole('link', { name: 'Plano anual', exact: true }).click();
  await page.locator('#demo-annual-goal').fill('Fazer uma viagem especial');
  await page.locator('[data-demo-annual-form] button[type="submit"]').click();
  check(await page.getByText('Fazer uma viagem especial', { exact: true }).count() === 1,
    'Plano anual permite adicionar uma conquista fictícia');
  await page.getByRole('link', { name: 'Google Agenda', exact: true }).click();
  await page.getByRole('button', { name: 'Simular conexão' }).click();
  check(await page.getByRole('heading', { name: 'Agenda conectada (exemplo)' }).count() === 1,
    'Google Agenda é apresentada como uma prévia fictícia sem autenticar');

  const storageAfter = await page.evaluate(() => JSON.stringify({
    local: Object.fromEntries(Object.keys(localStorage).sort().map((key) => [key, localStorage.getItem(key)])),
    session: Object.fromEntries(Object.keys(sessionStorage).sort().map((key) => [key, sessionStorage.getItem(key)])),
  }));
  check(storageAfter === storageBefore, 'interações não gravam dados no navegador');
  check(interactionRequests.length === 0, 'interações não fazem requisições de rede', interactionRequests.join(', '));
  check(await page.getByRole('link', { name: 'Criar conta' }).count() > 0, 'CTA para criar conta permanece disponível');
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'demonstração não tem overflow horizontal em 390 px');
  collectRequests = false;
  await page.reload();
  await page.getByRole('link', { name: 'Tarefas', exact: true }).click();
  check(await page.locator('.demo-task-list .task').count() === 3
    && await page.locator('.demo-task-list .task').getByText(newTaskTitle, { exact: true }).count() === 0,
  'recarregar descarta as alterações da demonstração');

  await page.setViewportSize({ width: 1280, height: 900 });
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'demonstração não tem overflow horizontal em desktop');
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.evaluate(() => window.scrollTo(0, 0));
  const demoLayout = await page.evaluate(() => {
    const header = document.querySelector('.demo-app > .topbar').getBoundingClientRect();
    const main = document.querySelector('.demo-main').getBoundingClientRect();
    return {
      headerVisible: header.width > 0 && header.top === 0 && header.height < 150,
      mainFitsWorkspace: main.top >= header.bottom && main.right <= document.documentElement.clientWidth,
    };
  });
  check(demoLayout.headerVisible, 'demonstração usa a navegação superior do app no desktop');
  check(demoLayout.mainFitsWorkspace, 'conteúdo fica abaixo da navegação superior');
  await page.getByRole('link', { name: 'Voltar à página inicial' }).click();
  check(await page.locator('.public-journey-grid').count() === 0,
    'landing não repete a proposta de valor em uma jornada no desktop');
  check(
    await page.locator('.public-values').evaluate((grid) => {
      const cards = [...grid.children];
      const columns = new Set(cards.map((card) => Math.round(card.getBoundingClientRect().left)));
      const rows = new Set(cards.map((card) => Math.round(card.getBoundingClientRect().top)));
      return cards.length === 4 && columns.size === 2 && rows.size === 2;
    }),
    'as quatro áreas ficam organizadas em uma grade equilibrada no desktop',
  );
  await page.getByRole('link', { name: 'Perguntas', exact: true }).click();
  check(
    new URL(page.url()).hash === '#public-faq'
      && await page.locator('#public-faq').evaluate((section) => {
        const bounds = section.getBoundingClientRect();
        return bounds.top >= 0 && bounds.top < innerHeight;
      }),
    'o link Perguntas do cabeçalho leva ao FAQ',
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Ciclo', exact: true }).click();
  await page.locator('.public-community-link').click();
  await page.waitForFunction(() => document.querySelector('[data-suggestion-disclosure] > summary')?.getAttribute('aria-expanded') === 'true');
  check(
    await page.locator('[data-suggestion-disclosure] > summary').getAttribute('aria-expanded') === 'true'
      && await page.locator('[data-suggestion-disclosure] form[data-footer-suggestion]').isVisible()
      && await page.evaluate(() => document.activeElement === document.querySelector('[data-suggestion-disclosure] > summary'))
      && new URL(page.url()).hash === '#public-suggestion',
    'atalho de sugestão abre o formulário, atualiza o hash e posiciona o foco',
  );
  await page.locator('[name="message"]').fill('Uma sugestão de teste');
  const taskState = await page.locator('[data-landing-task]').last().getAttribute('aria-pressed');
  await page.locator('.public-topbar [data-public-action="login"]').click();
  await page.getByRole('heading', { name: 'Entrar na sua conta' }).waitFor();
  check(await page.title() === 'Entrar na sua conta | aurora.', 'login tem título próprio');
  await page.locator('.account-site-header .public-brand-link').click();
  await page.locator('.public-hero').waitFor();
  check(await page.locator('.public-value:visible h3').textContent() === 'Ciclo'
    && await page.locator('[name="message"]').inputValue() === 'Uma sugestão de teste'
    && await page.locator('[data-landing-task]').last().getAttribute('aria-pressed') === taskState,
  'voltar do login preserva o estado da landing nesta aba');
  await page.evaluate(() => window.scrollTo(0, 600));
  await page.waitForFunction(() => !document.querySelector('.public-mobile-cta').hidden);
  check(await page.locator('.public-mobile-cta').isVisible()
    && await page.locator('.public-mobile-cta').getAttribute('data-public-action') === 'demo',
  'CTA móvel continua oferecendo a demonstração após voltar do login');
  await page.locator('.public-topbar [data-public-action="signup"]').click();
  await page.getByRole('heading', { name: 'Seu perfil' }).waitFor();
  check(await page.title() === 'Seu perfil | aurora.', 'cadastro tem título próprio');
  await page.locator('.account-site-header .public-brand-link').click();
  await page.locator('.public-hero').waitFor();
  check(new URL(page.url()).pathname === '/'
    && await page.locator('[name="message"]').inputValue() === 'Uma sugestão de teste',
  'logo do cadastro retorna à landing preservando o rascunho');
  check(errors.length === 0, 'sem erros no console', errors.slice(0, 3).join(' | '));

  await context.close();
  await browser.close();
  process.exit(results.every(Boolean) ? 0 : 1);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
