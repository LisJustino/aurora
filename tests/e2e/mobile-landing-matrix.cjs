const { chromium, webkit, devices } = require('playwright');

const BASE = process.argv[2] || 'http://127.0.0.1:5173';
const profiles = [
  { name: 'iPhone 13 Mini', browser: webkit },
  { name: 'iPhone 16', browser: webkit },
  { name: 'Galaxy S24', browser: chromium },
  { name: 'Pixel 7', browser: chromium },
];
const results = [];

function check(passed, profile, name, detail = '') {
  results.push(passed);
  console.log(`${passed ? 'OK   ' : 'FALHA'} — ${profile}: ${name}${detail ? ` (${detail})` : ''}`);
}

async function checkLanding(page, profile, viewportLabel) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(resolve));
  });
  if (await page.evaluate(() => innerWidth <= 700)) {
    await page.locator('.public-hero .product-preview .preview-task-row').first().waitFor();
  }
  const metrics = await page.evaluate(() => {
    const rect = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const bounds = element.getBoundingClientRect();
      return {
        left: bounds.left,
        right: bounds.right,
        width: bounds.width,
        height: bounds.height,
        visible: bounds.width > 0 && bounds.height > 0 && getComputedStyle(element).display !== 'none',
      };
    };
    const targets = [
      ...document.querySelectorAll(
        '.public-topbar .public-account-action[data-public-action="login"], .public-topbar .public-header-tools .iconbtn, .public-hero .public-actions .btn, .public-hero [data-landing-task]',
      ),
    ].filter((element) => element.getClientRects().length > 0);

    return {
      viewportWidth: innerWidth,
      pageWidth: document.documentElement.scrollWidth,
      brand: rect('.public-site > .public-topbar .brand'),
      wordmark: rect('.public-site > .public-topbar .wordmark'),
      headerActions: rect('.public-site > .public-topbar .public-header-actions'),
      signupHeader: rect('.public-site > .public-topbar .public-account-action[data-public-action="signup"]'),
      title: rect('.public-hero h1'),
      hero: rect('.public-hero'),
      preview: rect('.public-hero .product-preview'),
      previewTasks: Boolean(document.querySelector('.public-hero .product-preview .preview-task-row')),
      targets: targets.map((element) => {
        const bounds = element.getBoundingClientRect();
        return { width: bounds.width, height: bounds.height };
      }),
    };
  });

  check(metrics.pageWidth <= metrics.viewportWidth, profile, `sem overflow horizontal (${viewportLabel})`,
    `${metrics.pageWidth}px / ${metrics.viewportWidth}px`);
  check(metrics.brand?.visible
    && (metrics.viewportWidth <= 900 ? !metrics.wordmark?.visible : metrics.wordmark?.visible),
  profile, `marca usa só o ícone no mobile e o nome no desktop (${viewportLabel})`);
  check(metrics.headerActions && metrics.brand.right <= metrics.headerActions.left + 1,
    profile, `marca e ações do cabeçalho não se sobrepõem (${viewportLabel})`);
  check(metrics.signupHeader?.visible,
    profile, `cabeçalho mostra o CTA de cadastro (${viewportLabel})`);
  check(metrics.viewportWidth > 700 || metrics.preview?.visible,
    profile, `prévia aparece no hero móvel (${viewportLabel})`);
  check(metrics.viewportWidth > 700 || metrics.previewTasks,
    profile, `prévia móvel mostra tarefas fictícias (${viewportLabel})`);
  check(metrics.title?.visible && metrics.title.width > 0 && metrics.title.height > 0,
    profile, `título principal visível (${viewportLabel})`);
  check(metrics.hero?.visible && metrics.hero.right <= metrics.viewportWidth,
    profile, `hero cabe na largura disponível (${viewportLabel})`);
  check(metrics.targets.length >= 4
    && metrics.targets.every((target) => target.width >= 44 && target.height >= 44),
  profile, `controles visíveis com área de toque mínima de 44px (${viewportLabel})`,
  JSON.stringify(metrics.targets));
}

async function checkAccountScreen(page, profile, viewportLabel) {
  const metrics = await page.evaluate(() => {
    const card = document.querySelector('.account-card');
    const bounds = card?.getBoundingClientRect();
    const targets = [
      ...document.querySelectorAll(
        '.account-form input:not([type="checkbox"]):not([type="hidden"]), .account-form button',
      ),
    ].filter((element) => element.getClientRects().length > 0);

    return {
      viewportWidth: innerWidth,
      pageWidth: document.documentElement.scrollWidth,
      card: card && bounds ? {
        width: bounds.width,
        overflowY: getComputedStyle(card).overflowY,
        scrollHeight: card.scrollHeight,
        clientHeight: card.clientHeight,
      } : null,
      targets: targets.map((element) => {
        const bounds = element.getBoundingClientRect();
        return { width: bounds.width, height: bounds.height };
      }),
    };
  });

  check(metrics.pageWidth <= metrics.viewportWidth, profile, `formulário sem overflow horizontal (${viewportLabel})`);
  check(Boolean(metrics.card)
    && metrics.card.overflowY === 'visible'
    && metrics.card.scrollHeight <= metrics.card.clientHeight + 1,
  profile, `cartão de conta não cria rolagem interna (${viewportLabel})`);
  check(metrics.targets.length > 0
    && metrics.targets.every((target) => target.width >= 44 && target.height >= 44),
  profile, `campos e ações do formulário têm alvos de toque de 44px (${viewportLabel})`,
  JSON.stringify(metrics.targets));
}

(async () => {
  for (const profile of profiles) {
    const browser = await profile.browser.launch();
    try {
      const context = await browser.newContext({
        ...devices[profile.name],
        reducedMotion: 'reduce',
      });
      const page = await context.newPage();
      const errors = [];
      const externalRequests = [];
      const mainModuleRequests = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      await page.route('**/*', (route) => {
        if (new URL(route.request().url()).origin === new URL(BASE).origin) return route.continue();
        externalRequests.push(route.request().url());
        return route.abort();
      });
      page.on('request', (request) => {
        if (new URL(request.url()).pathname.endsWith('/src/js/main.js')) {
          mainModuleRequests.push(request.url());
        }
      });

      await page.goto(BASE);
      await page.getByRole('heading', { name: 'Menos ruído. Mais clareza no dia.' }).waitFor();
      if (profile.browser === webkit) {
        const installNotice = page.locator('#pwa-install-notice');
        check(await installNotice.count() === 0,
          profile.name, 'instruções de instalação não cobrem a landing automaticamente');
        const installLink = page.getByRole('button', { name: 'Baixar o app' });
        await installLink.scrollIntoViewIfNeeded();
        await installLink.click();
        check(await installNotice.isVisible()
          && await installNotice.getByText(/No Safari, toque em Compartilhar/).isVisible(),
        profile.name, 'instruções de instalação aparecem após solicitação explícita');
        await installNotice.getByRole('button', { name: 'Agora não' }).click();
        await page.evaluate(() => window.scrollTo(0, 0));
      }
      await page.setViewportSize({ width: 1280, height: 900 });
      await checkLanding(page, profile.name, 'desktop');
      await page.setViewportSize(devices[profile.name].viewport);
      await checkLanding(page, profile.name, 'perfil do aparelho');

      await page.setViewportSize({ width: 320, height: 720 });
      await checkLanding(page, profile.name, '320px');
      await page.setViewportSize({ width: 520, height: 844 });
      await checkLanding(page, profile.name, '520px');
      await page.setViewportSize(devices[profile.name].viewport);

      await page.locator('.public-hero').getByRole('link', { name: 'Ver demo em 1 minuto' }).click();
      await page.getByRole('heading', { name: /^(Bom dia|Boa tarde|Boa noite), pessoa/i }).waitFor();
      check(await page.locator('.demo-nav-link').count() === 6,
        profile.name, 'demonstração expõe navegação das seis áreas');
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        profile.name, 'demonstração não tem overflow horizontal');
      check(await page.locator('.demo-nav-link').evaluateAll((links) =>
        links.every((link) => link.getBoundingClientRect().height >= 44)),
      profile.name, 'navegação da demonstração tem alvos de toque de 44px');
      check(await page.locator('.demo-nav-link').evaluateAll((links) =>
        links.every((link) => {
          const label = link.querySelector('span');
          return label && label.scrollWidth <= label.clientWidth;
        })),
      profile.name, 'rótulos da navegação da demonstração não são cortados');
      check(await page.locator('.demo-app .brand .wordmark').count() === 1,
        profile.name, 'demonstração usa a marca do cabeçalho do app');
      if (devices[profile.name].viewport.width <= 700) {
        check(await page.locator('.demo-nav').evaluate((nav) =>
          getComputedStyle(nav).position === 'fixed'
            && innerHeight - nav.getBoundingClientRect().bottom <= 12
            && nav.getBoundingClientRect().bottom <= innerHeight),
        profile.name, 'dock móvel fixo respeita a borda inferior da tela');
        check(await page.locator('.demo-app > .topbar [data-public-action="signup"]').evaluate((button) =>
          button.classList.contains('primary'))
          && !(await page.locator('.demo-app > .topbar [data-public-action="login"]').evaluate((button) =>
            button.classList.contains('primary'))),
        profile.name, 'cadastro é primário e entrar permanece secundário no cabeçalho');
      }
      await page.getByRole('link', { name: 'Tarefas', exact: true }).click();
      check(await page.getByRole('link', { name: 'Tarefas', exact: true }).evaluate((button) =>
        button.classList.contains('is-current')),
      profile.name, 'navegação da demonstração responde ao toque');
      check(mainModuleRequests.length === 0,
        profile.name, 'landing e demonstração não carregam o módulo autenticado');

      const installNotice = page.locator('#pwa-install-notice');
      if (await installNotice.count()) {
        await installNotice.getByRole('button', { name: 'Agora não' }).click();
      }
      await page.getByRole('link', { name: 'Voltar à página inicial' }).click();
      await page.locator('.public-site > .public-topbar [data-public-action="login"]').click();
      await page.getByRole('heading', { name: 'Entrar na sua conta' }).waitFor();
      await checkAccountScreen(page, profile.name, 'login');
      await page.locator('.account-site-header [data-account-mode="signup"]').click();
      await page.getByRole('heading', { name: 'Seu perfil' }).waitFor();
      await checkAccountScreen(page, profile.name, 'cadastro');
      await page.setViewportSize({ width: 320, height: 780 });
      await checkAccountScreen(page, profile.name, 'cadastro a 320px');
      await page.setViewportSize(devices[profile.name].viewport);
      await page.locator('.account-site-header [data-account-mode="login"]').click();
      await page.getByRole('heading', { name: 'Entrar na sua conta' }).waitFor();
      await page.getByRole('button', { name: 'Esqueci minha senha' }).click();
      await page.getByRole('heading', { name: 'Recuperar acesso' }).waitFor();
      await checkAccountScreen(page, profile.name, 'recuperação');
      await page.setViewportSize({ width: 320, height: 780 });
      await checkAccountScreen(page, profile.name, 'recuperação a 320px');
      check(mainModuleRequests.length > 0,
        profile.name, 'fluxo de conta carrega a área autenticada somente ao ser solicitado');
      check(externalRequests.length === 0,
        profile.name, 'teste de conta não envia requisições para serviços externos',
        externalRequests.join(', '));
      check(errors.length === 0, profile.name, 'console limpo', errors.slice(0, 3).join(' | '));

      await context.close();
    } finally {
      await browser.close();
    }
  }

  console.log(`\n${results.filter(Boolean).length}/${results.length} verificações passaram.`);
  process.exitCode = results.every(Boolean) ? 0 : 1;
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
