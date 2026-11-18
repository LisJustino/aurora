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
    if (collectRequests && !/\.(woff2?|ttf|otf)$/i.test(url.pathname)) interactionRequests.push(request.url());
  });

  await page.goto(BASE);
  check(await page.locator('.public-site').evaluate((site) =>
    [...site.querySelectorAll('*')].filter((element) => element.getClientRects().length > 0)
      .every((element) => getComputedStyle(element).animationName === 'none')),
  'landing não usa animações de entrada ou movimento automático');
  await page.emulateMedia({ reducedMotion: 'reduce' });
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
  check(await page.locator('.landing-tutorial-description, .landing-tutorial-summary li, .public-faq-item p, .public-trust-copy p, .public-footer .footer-brand p, .public-footer .footer-meta').evaluateAll((elements) =>
    elements.every((element) => parseFloat(getComputedStyle(element).fontSize) >= 14)),
  'texto informativo e interativo da landing tem no mínimo 14px');
  check(await page.getByRole('heading', { name: 'Vamos por partes.' }).count() === 1, 'landing fala de organizar um dia de cada vez');
  check(await page.locator('.public-problem-card, .public-value, .public-area-capture, .public-demo-invite').count() === 0,
    'landing não repete o conteúdo das demonstrações em cards ou convites');
  const tutorialTabs = page.getByRole('tablist', { name: 'Escolha o que quer ver' });
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
    section.parentElement?.classList.contains('public-main')
    && section.previousElementSibling?.classList.contains('public-closing')
    && section.nextElementSibling?.classList.contains('public-faq'))
    && await community.getByRole('heading', { name: 'Conta pra gente' }).count() === 1
    && await community.getByText('Mandar uma ideia', { exact: true }).count() === 1
    && await community.getByText(/O que ficou faltando\? O que atrapalhou\?/).count() === 1,
  'convite de feedback fica junto ao encerramento, antes do FAQ');
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    check(await community.evaluate((section) => {
      const bounds = section.getBoundingClientRect();
      const summary = section.querySelector('.public-suggestion > summary').getBoundingClientRect();
      return summary.left >= bounds.left && summary.right <= bounds.right
        && document.documentElement.scrollWidth <= innerWidth;
    }), `convite de feedback cabe sem overflow em ${width}px`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  check(await page.getByRole('heading', { name: 'Feito por uma pessoa só, com cuidado' }).count() === 0
    && await page.locator('.public-main > .public-tutorials').evaluate((tutorials) =>
      tutorials.previousElementSibling?.classList.contains('public-hero'))
    && await page.locator('.public-main > .public-trust').evaluate((trust) =>
      trust.previousElementSibling?.classList.contains('public-tutorials'))
    && await page.locator('.public-main > .public-closing').evaluate((closing) =>
      closing.previousElementSibling?.classList.contains('public-trust'))
    && await page.locator('.public-main > .public-community').evaluate((section) =>
      section.previousElementSibling?.classList.contains('public-closing'))
    && await page.locator('.public-main > .public-faq').evaluate((faq) =>
      faq.previousElementSibling?.classList.contains('public-community')),
  'landing segue do hero ao vídeo, informações essenciais, instalação, feedback e FAQ');
  const suggestionDisclosure = page.locator('[data-suggestion-disclosure]');
  const pricingDisclosure = page.locator('.public-faq-item').first();
  check(!(await pricingDisclosure.evaluate((item) => item.open))
    && !(await pricingDisclosure.locator('p').isVisible())
    && await pricingDisclosure.locator('summary').getAttribute('aria-expanded') === 'false',
  'respostas da FAQ começam recolhidas');
  await pricingDisclosure.locator('summary').click();
  await page.waitForFunction(() => document.querySelector('.public-faq-item summary').getAttribute('aria-expanded') === 'true');
  check(await pricingDisclosure.evaluate((item) => item.open)
    && await pricingDisclosure.locator('p').isVisible(),
  'resposta sobre gratuidade abre pela pergunta');
  check(await page.locator('.public-faq-item').first().locator('summary').textContent().then((text) => /grátis/i.test(text))
    && await page.locator('.public-faq-item').count() === 5
    && await page.locator('.public-faq').getByText(/não são criptografados|sem conexão|confirmar meu e-mail/i).count() === 0
    && await page.locator('.public-faq').getByText('Como cuido dos meus dados?', { exact: true }).count() === 0
    && await page.locator('.public-trust a[href="/privacy.html"]').count() === 1
    && await page.locator('.public-footer form[data-footer-suggestion]').count() === 0
    && await suggestionDisclosure.count() === 1
    && await suggestionDisclosure.evaluate((disclosure) =>
      !disclosure.open && Boolean(disclosure.closest('.public-community')))
    && await suggestionDisclosure.locator(':scope > summary').getAttribute('aria-expanded') === 'false'
    && await suggestionDisclosure.locator('form[data-footer-suggestion]').count() === 1
    && !(await suggestionDisclosure.locator('form[data-footer-suggestion]').isVisible()),
  'FAQ reduzido mantém cinco dúvidas e o formulário de sugestão fica separado');
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
    && actions.nextElementSibling.textContent.includes('É grátis e dá para experimentar')),
  'informação de gratuidade aparece diretamente abaixo do CTA');
  check(await page.locator('.public-trust a[href="/privacy.html"]').count() === 1
    && await page.locator('.public-header-nav .ni').count() === 0,
  'privacidade tem link direto e a navegação pública evita ícones decorativos');
  check(await page.locator('.public-faq-item').evaluateAll((items) => items.every((item) => {
    const style = getComputedStyle(item);
    return style.backgroundColor === 'rgba(0, 0, 0, 0)' && style.boxShadow === 'none' && style.borderRadius === '0px';
  })), 'perguntas aparecem como linhas simples, sem caixas individuais');
  check(await page.locator('.public-community, .public-cta-panel').evaluateAll((sections) => sections.every((section) => {
    const style = getComputedStyle(section);
    return style.backgroundColor === 'rgba(0, 0, 0, 0)' && style.boxShadow === 'none' && style.borderRadius === '0px';
  })), 'convites de feedback e instalação não usam caixas decorativas');
  check(await page.locator('.public-hero picture source').getAttribute('srcset') === '/screenshots/demo-mobile.png'
    && await page.locator('.public-hero .public-product-capture').getAttribute('alt') === 'Tela da demonstração interativa do Aurora, com dados fictícios.',
  'hero usa a captura real da demonstração e inclui a variante móvel');
  check(await page.locator('.public-hero [data-public-action="signup"], .public-hero [data-public-action="login"]').count() === 0,
    'hero não repete ações de cadastro ou entrada');
  check(await page.locator('.public-cta-panel [data-public-action="signup"], .public-cta-panel [data-public-action="demo"]').count() === 0
    && await page.locator('.public-cta-panel [data-action="pwa-install"]').count() === 1
    && await page.locator('.public-cta-panel .public-actions .btn').count() === 1
    && await page.locator('.public-footer [data-action="pwa-install"]').count() === 0,
  'instalação é a única ação no encerramento e não se repete no rodapé');
  check(await page.locator('.public-final-cta').count() === 0
    && await page.locator('.public-main').evaluate((main) =>
      main.nextElementSibling?.matches('footer.public-footer')),
  'a landing termina no conteúdo útil e segue direto ao rodapé');
  await page.setViewportSize({ width: 390, height: 844 });
  const heroCapture = page.locator('.public-product-capture');
  check(await heroCapture.evaluate((image) =>
    image.complete && image.naturalWidth === 390 && image.naturalHeight === 844
      && image.currentSrc.endsWith('/screenshots/demo-mobile.png')),
  'hero carrega a captura real em formato móvel');
  await page.setViewportSize({ width: 1280, height: 844 });
  check(await heroCapture.evaluate((image) =>
    image.complete && image.naturalWidth === 1280 && image.naturalHeight === 720
      && image.currentSrc.endsWith('/screenshots/demo-wide.png')),
  'hero troca para a captura real em formato desktop');
  check(await page.locator('.public-area-capture img, .public-problem-card, .public-value, .public-demo-invite').count() === 0,
    'a landing usa os vídeos como apresentação das áreas, sem cards duplicados');
  await page.setViewportSize({ width: 320, height: 720 });
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'landing não tem overflow horizontal em 320 px');
  check(await page.locator('.public-journey-grid').count() === 0,
    'landing não repete a proposta de valor em uma jornada no celular');
  check(await page.locator('.public-area-capture img, .public-problem-card, .public-value').count() === 0
    && await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  'a landing simplificada cabe na tela estreita sem rolagem horizontal');
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
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    const navigationLayout = await page.locator('.demo-nav').evaluate((nav) => ({
      overflowX: getComputedStyle(nav).overflowX,
      clientWidth: nav.clientWidth,
      scrollWidth: nav.scrollWidth,
      linksFit: [...nav.querySelectorAll('.demo-nav-link')].every((link) =>
        link.getBoundingClientRect().width >= 80 && link.scrollWidth <= link.clientWidth + 1),
      pageFits: document.documentElement.scrollWidth <= innerWidth,
    }));
    check(navigationLayout.overflowX === 'auto'
      && navigationLayout.scrollWidth > navigationLayout.clientWidth
      && navigationLayout.linksFit && navigationLayout.pageFits,
    `menu da demonstração permite rolagem sem sobrepor rótulos em ${width}px`);
  }
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

  const taskPrompt = page.locator('.home-quick-copy p');
  const quickTaskForm = page.locator('.home-quick-card [data-demo-task-form]');
  check(await page.getByRole('heading', { name: 'Qual é o próximo passo?' }).count() === 1
    && await taskPrompt.textContent() === 'Experimente adicionar uma tarefa.'
    && await quickTaskForm.evaluate((form) => Boolean(form.parentElement.querySelector('.home-quick-copy p').compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING))
    && await quickTaskForm.locator('input').count() === 1
    && await page.locator('.home-quick-card .demo-session-note').textContent() === 'As mudanças são descartadas ao sair.',
  'Início da demonstração convida a adicionar uma tarefa antes do campo');
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

  for (const width of [1024, 1200, 1280, 1366, 1400]) {
    await page.setViewportSize({ width, height: 900 });
    const navigationLayout = await page.locator('.demo-app > .topbar').evaluate((header) => {
      const bounds = (selector) => header.querySelector(selector).getBoundingClientRect();
      const brand = bounds('.brand');
      const nav = bounds('.demo-nav');
      const actions = bounds('.public-header-actions');
      const menu = header.querySelector('.demo-nav');
      return {
        menuFits: menu.scrollWidth <= menu.clientWidth + 1,
        menuBelowActions: nav.top >= Math.max(brand.bottom, actions.bottom),
        pageFits: document.documentElement.scrollWidth <= innerWidth,
      };
    });
    check(navigationLayout.menuFits
      && navigationLayout.menuBelowActions
      && navigationLayout.pageFits,
    `menu da demonstração cabe sem corte em ${width}px`);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  check(await page.locator('.demo-nav').evaluate((nav) => nav.scrollWidth <= nav.clientWidth + 1),
    'menu da demonstração cabe em uma linha na tela larga');
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
  check(await page.locator('.public-area-capture img, .public-problem-card, .public-value').count() === 0
    && await page.locator('.public-hero .public-product-capture').evaluate((image) =>
      image.complete && image.naturalWidth === 1280 && image.currentSrc.endsWith('/screenshots/demo-wide.png'))
    && await page.locator('.landing-tutorial-panel:not([hidden]) video').evaluate((video) => {
      const bounds = video.getBoundingClientRect();
      return bounds.width > 0 && bounds.right <= document.documentElement.clientWidth;
    }), 'landing mantém captura e vídeos sem cards duplicados ou overflow no desktop');
  await page.getByRole('link', { name: 'Perguntas', exact: true }).click();
  check(
    new URL(page.url()).hash === '#public-faq'
      && await page.locator('#public-faq').evaluate((section) => {
        const bounds = section.getBoundingClientRect();
        return bounds.top >= 0 && bounds.top < innerHeight;
      }),
    'o link Perguntas do cabeçalho leva ao FAQ',
  );
  await page.getByRole('link', { name: 'Como funciona', exact: true }).click();
  check(
    new URL(page.url()).hash === '#public-tutorials'
      && await page.locator('#public-tutorials').evaluate((section) => {
        const bounds = section.getBoundingClientRect();
        return bounds.top >= 0 && bounds.top < innerHeight;
      }),
    'o link Como funciona leva às demonstrações sem uma seção duplicada de áreas',
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('tab', { name: 'Finanças' }).click();
  await page.locator('[data-suggestion-disclosure] > summary').click();
  await page.waitForFunction(() => document.querySelector('[data-suggestion-disclosure] > summary')?.getAttribute('aria-expanded') === 'true');
  check(
    await page.locator('[data-suggestion-disclosure] > summary').getAttribute('aria-expanded') === 'true'
      && await page.locator('[data-suggestion-disclosure] form[data-footer-suggestion]').isVisible()
      && await page.evaluate(() => document.activeElement === document.querySelector('[data-suggestion-disclosure] > summary')),
    'atalho de sugestão abre o formulário com foco no controle',
  );
  await page.locator('[name="message"]').fill('Uma sugestão de teste');
  await page.locator('.public-topbar [data-public-action="login"]').click();
  await page.getByRole('heading', { name: 'Entrar na sua conta' }).waitFor();
  check(await page.title() === 'Entrar na sua conta | aurora.', 'login tem título próprio');
  await page.locator('.account-site-header .public-brand-link').click();
  await page.locator('.public-hero').waitFor();
  check(await page.getByRole('tab', { name: 'Finanças' }).getAttribute('aria-selected') === 'true'
    && await page.locator('[name="message"]').inputValue() === 'Uma sugestão de teste'
    && await page.locator('.public-product-capture').count() === 1,
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
