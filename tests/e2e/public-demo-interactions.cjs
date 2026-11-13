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
  let collectRequests = false;
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.endsWith('/src/js/main.js')) mainModuleRequests.push(request.url());
    if (collectRequests) interactionRequests.push(request.url());
  });

  await page.goto(BASE);
  check(mainModuleRequests.length === 0, 'landing pública não baixa o módulo completo antes da autenticação');
  check(await page.locator('.public-values p, .preview-cycle-week i, .preview-cycle-days i, .preview-cycle-note, .preview-cycle-privacy, .preview-task-heading small, .preview-task-row b, .preview-task-row small, .public-footer .footer-brand p, .public-footer .footer-meta').evaluateAll((elements) =>
    elements.every((element) => parseFloat(getComputedStyle(element).fontSize) >= 14)),
  'texto informativo e interativo da landing tem no mínimo 14px');
  check(await page.getByRole('heading', { name: 'Menos ruído. Mais clareza no dia.' }).count() === 1, 'landing apresenta o benefício principal do Aurora');
  check(await page.getByText('Feito para a vida como ela é').count() === 1
    && await page.locator('.public-values > .public-value').count() === 4
    && await page.locator('.public-journey-grid').count() === 0,
  'landing apresenta as áreas sem repetir uma jornada intermediária');
  check(await page.getByRole('heading', { name: 'Feito por uma pessoa só, com cuidado' }).count() === 0
    && await page.locator('.public-main > .public-maker').count() === 0
    && await page.locator('.public-main > .public-features').evaluate((features) =>
      features.previousElementSibling?.classList.contains('public-hero')),
  'landing apresenta as áreas diretamente após o hero, sem a seção removida');
  const suggestionDisclosure = page.locator('[data-suggestion-disclosure]');
  check(await page.locator('.public-faq-item').first().locator('summary').textContent().then((text) => /grátis/i.test(text))
    && await page.locator('.public-faq-item:not([data-suggestion-disclosure])').count() === 5
    && await page.locator('.public-faq-item').count() === 6
    && await page.locator('.public-faq').getByText(/não são criptografados|sem conexão|confirmar meu e-mail/i).count() === 0
    && await page.locator('.public-footer form[data-footer-suggestion]').count() === 0
    && await suggestionDisclosure.count() === 1
    && await suggestionDisclosure.evaluate((disclosure) =>
      !disclosure.open && Boolean(disclosure.closest('.public-faq-list')))
    && await suggestionDisclosure.locator(':scope > summary').getAttribute('aria-expanded') === 'false'
    && await suggestionDisclosure.locator('form[data-footer-suggestion]').count() === 1
    && !(await suggestionDisclosure.locator('form[data-footer-suggestion]').isVisible()),
  'FAQ curto mantém a sugestão recolhida e detalhes técnicos fora da vitrine');
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
  check(await page.locator('.preview-cycle-privacy').getAttribute('href') === '/privacy'
    && await page.locator('.public-values').getAttribute('role') === 'group',
  'link de privacidade vai direto ao destino final e o grupo de áreas tem nome semântico');
  check(await page.locator('.preview-phone-nav').getByText('Ciclo').count() === 1,
    'prévia do celular mostra as quatro áreas, incluindo Ciclo');
  check(await page.locator('.public-hero [data-public-action="signup"], .public-hero [data-public-action="login"]').count() === 0,
    'hero não repete ações de cadastro ou entrada');
  check(await page.locator('.public-cta-panel [data-public-action="signup"], .public-cta-panel [data-public-action="demo"]').count() === 0,
    'chamada final propõe instalar o app em vez de repetir o cadastro ou a demonstração');
  const heroTask = page.locator('.public-hero [data-landing-task]').last();
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
  await heroTask.click();
  check(await heroTask.getAttribute('aria-pressed') === 'true'
    && await heroTask.locator('small').textContent() === 'Concluída'
    && await page.locator('.preview-task-progress i').evaluate((progress) => progress.style.width) === '100%',
  'mock do hero permite concluir uma tarefa sem sair da landing');
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
  await page.locator('.public-hero').getByRole('link', { name: 'Abrir demonstração' }).click();
  await page.getByRole('heading', { name: /^(Bom dia|Boa tarde|Boa noite), pessoa/i }).waitFor();
  check(new URL(page.url()).pathname === '/demonstracao'
    && await page.getByRole('heading', { name: /^(Bom dia|Boa tarde|Boa noite), pessoa/i }).isVisible(),
  'o CTA abre a demonstração sem cadastro');
  mainModuleRequests.length = 0;
  await page.goto(`${BASE}/demonstracao`);
  await page.getByRole('heading', { name: /^(Bom dia|Boa tarde|Boa noite), pessoa/i }).waitFor();
  check(mainModuleRequests.length === 0, 'a demonstração direta não baixa o módulo completo');
  check(await page.locator('.demo-nav-link').count() === 5, 'demonstração oferece navegação pelas áreas do app');
  check(await page.getByText(/dados fictícios.*não são salvas/i).count() === 1,
    'a demonstração informa que as edições são temporárias');
  await page.waitForTimeout(500);
  const storageBefore = await page.evaluate(() => JSON.stringify({
    local: Object.fromEntries(Object.keys(localStorage).sort().map((key) => [key, localStorage.getItem(key)])),
    session: Object.fromEntries(Object.keys(sessionStorage).sort().map((key) => [key, sessionStorage.getItem(key)])),
  }));
  collectRequests = true;

  await page.getByRole('button', { name: 'Adicionar tarefa de exemplo' }).click();
  check(await page.locator('.demo-task-list .task').count() === 3
    && await page.locator('.demo-task-list [role="checkbox"]').count() === 3
    && await page.locator('.demo-add-form input').count() === 1,
  'tarefas de exemplo podem ser concluídas e uma tarefa pode ser adicionada');
  const taskInput = page.locator('.demo-add-form input');
  await taskInput.fill('   ');
  await page.getByRole('button', { name: 'Adicionar', exact: true }).click();
  check(await page.locator('.demo-task-list .task').count() === 3
    && await taskInput.evaluate((input) => !input.validity.valid),
  'tarefa vazia ou composta de espaços não é adicionada');
  const newTaskTitle = 'Tarefa <b>sem HTML</b>';
  await taskInput.fill(newTaskTitle);
  await page.getByRole('button', { name: 'Adicionar', exact: true }).click();
  const newTask = page.getByRole('checkbox', { name: `Marcar como concluída: ${newTaskTitle}` });
  check(await page.locator('.demo-task-list .task').count() === 4
    && await page.getByText(newTaskTitle, { exact: true }).count() === 1
    && await page.locator('.demo-task-list b').count() === 0,
  'tarefa nova é exibida como texto escapado, não como HTML');
  await newTask.click();
  check(await page.getByRole('checkbox', { name: `Marcar como pendente: ${newTaskTitle}` })
    .getAttribute('aria-checked') === 'true'
    && await page.locator('.demo-area-panel .pill').textContent() === '3 de 4 feitos',
  'tarefa de exemplo pode ser marcada como concluída');

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
  await page.locator('[data-demo-action="cycle-day"][data-day="13"]').click();
  check(await page.getByText('Dia 13 · exemplo').count() === 1, 'calendário de ciclo permite navegar por dias fictícios');
  await page.getByRole('link', { name: 'Finanças', exact: true }).click();
  await page.getByRole('button', { name: 'Mês anterior' }).click();
  check(await page.getByRole('heading', { name: 'Setembro de 2026' }).count() === 1, 'finanças permite comparar meses fictícios');

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
  await page.locator('[data-suggestion-disclosure] > summary').click();
  check(
    await page.locator('[data-suggestion-disclosure] > summary').getAttribute('aria-expanded') === 'true'
      && await page.locator('[data-suggestion-disclosure] form[data-footer-suggestion]').isVisible(),
    'sugestão fica visível ao abrir o item da FAQ',
  );
  await page.locator('[name="message"]').fill('Uma sugestão de teste');
  const taskState = await page.locator('[data-landing-task]').last().getAttribute('aria-pressed');
  await page.locator('.public-topbar [data-public-action="login"]').click();
  await page.getByRole('heading', { name: 'Entrar na sua conta' }).waitFor();
  check(await page.title() === 'Entrar na sua conta | aurora.', 'login tem título próprio');
  await page.locator('.account-home-link').click();
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
