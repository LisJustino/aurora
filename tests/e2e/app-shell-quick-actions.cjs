const { chromium } = require('playwright');

const BASE = process.argv[2] || 'http://127.0.0.1:5173';
const results = [];
const check = (passed, name, detail = '') => {
  results.push(passed);
  console.log(`${passed ? 'OK   ' : 'FALHA'} — ${name}${detail ? ` (${detail})` : ''}`);
};

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 320, height: 700 } });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.goto(`${BASE}/?preview#inicio`);
  const moreTrigger = page.getByRole('button', { name: /Mais áreas/ });
  await moreTrigger.waitFor({ state: 'visible' });
  const moreMenu = page.locator('#nav-more-menu');
  const quickTrigger = moreMenu.locator('.nav-more-create');
  const quickMenu = page.locator('#quick-actions-menu');
  const openQuickActions = async () => {
    if (await quickMenu.isVisible()) return;
    if (await moreMenu.isHidden()) await moreTrigger.click();
    await quickTrigger.click();
    await quickMenu.waitFor({ state: 'visible' });
  };
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'shell não tem overflow horizontal em 320 px');
  check(await page.evaluate(() => (
    document.querySelector('#app > .app-definitions')?.getBoundingClientRect().height === 0
    && document.querySelector('#app > .app')?.getBoundingClientRect().top === 0
  )), 'SVG de definições não cria espaço acima do app');
  const mobileNavLabels = [];
  await page.evaluate(() => document.fonts.ready);
  for (const width of [320, 360, 390, 430]) {
    await page.setViewportSize({ width, height: 700 });
    mobileNavLabels.push(await page.evaluate(() => ({
      width: innerWidth,
      brandHidden: getComputedStyle(document.querySelector('.topbar .wordmark')).display === 'none',
      collapseToggleHidden: getComputedStyle(document.querySelector('.sidebar-toggle')).display === 'none',
      dockedAsFloatingCapsule: (() => {
        const nav = document.querySelector('.topbar .nav');
        const bounds = nav.getBoundingClientRect();
        const style = getComputedStyle(nav);
        return style.position === 'fixed'
          && bounds.left >= 7 && bounds.left <= 9
          && bounds.right <= innerWidth - 7 && bounds.right >= innerWidth - 9
          && bounds.bottom >= innerHeight - 9 && bounds.bottom <= innerHeight - 7
          && style.borderTopLeftRadius === style.borderTopRightRadius
          && style.borderTopLeftRadius === style.borderBottomLeftRadius
          && style.borderTopLeftRadius === style.borderBottomRightRadius;
      })(),
      actionsInsideBackground: (() => {
        const nav = document.querySelector('.topbar .nav');
        const bounds = nav.getBoundingClientRect();
        return [...nav.children]
          .filter((child) => getComputedStyle(child).display !== 'none'
            && !child.classList.contains('nav-more-menu')
            && !child.classList.contains('nav-quick-control'))
          .every((child) => {
            const item = child.getBoundingClientRect();
            return item.left >= bounds.left - 1 && item.right <= bounds.right + 1;
          });
      })(),
      labelsFit: [...document.querySelectorAll('.topbar .nav > .nav-primary .tab-label-group')]
        .every((label) => label.scrollWidth <= label.clientWidth + 1),
      createInMore: (() => {
        const nav = document.querySelector('.topbar .nav');
        return getComputedStyle(nav.querySelector(':scope > .nav-quick-control > .nav-quick-trigger')).display === 'none'
          && Boolean(nav.querySelector('.nav-more-menu .nav-more-create'));
      })(),
    })));
  }
  check(mobileNavLabels.every(({ dockedAsFloatingCapsule }) => dockedAsFloatingCapsule),
    'dock móvel fica flutuante, com recuo e cantos arredondados entre 320 e 430 px', JSON.stringify(mobileNavLabels));
  check(mobileNavLabels.every(({ actionsInsideBackground }) => actionsInsideBackground),
    'atalhos do dock ficam dentro do fundo entre 320 e 430 px', JSON.stringify(mobileNavLabels));
  check(mobileNavLabels.every(({ labelsFit }) => labelsFit), 'nomes do dock móvel não são cortados entre 320 e 430 px', JSON.stringify(mobileNavLabels));
  check(mobileNavLabels.every(({ createInMore }) => createInMore),
    'ação Criar fica dentro de Mais e não ocupa uma coluna do dock', JSON.stringify(mobileNavLabels));
  check(mobileNavLabels.every(({ brandHidden }) => brandHidden),
    'marca usa apenas o símbolo no cabeçalho móvel para preservar espaço', JSON.stringify(mobileNavLabels));
  check(mobileNavLabels.every(({ collapseToggleHidden }) => collapseToggleHidden),
    'controle da barra lateral não aparece no dock móvel', JSON.stringify(mobileNavLabels));
  await page.setViewportSize({ width: 320, height: 700 });
  await moreTrigger.click();
  const moreMenuLabelsFit = await page.evaluate(() => {
    const menu = document.querySelector('.nav-more-menu');
    const bounds = menu.getBoundingClientRect();
    const dock = document.querySelector('.topbar .nav').getBoundingClientRect();
    const create = menu.querySelector('.nav-more-create');
    const createBounds = create.getBoundingClientRect();
    return bounds.left >= 0
      && bounds.right <= innerWidth
      && bounds.left >= dock.left - 1
      && bounds.right <= dock.right + 1
      && bounds.bottom <= dock.top
      && [...menu.querySelectorAll('.nav-more-link, .nav-more-create')].every((item) => item.scrollWidth <= item.clientWidth + 1)
      && createBounds.width >= 44
      && createBounds.height >= 44
      && createBounds.left >= bounds.left
      && createBounds.right <= bounds.right;
  });
  check(moreMenuLabelsFit, 'menu Mais encaixa no dock e inclui Criar com rótulos inteiros');
  await quickTrigger.click();
  await quickMenu.waitFor({ state: 'visible' });
  check(await quickMenu.isVisible(), 'Criar abre as ações rápidas a partir de Mais');
  await page.keyboard.press('Escape');
  check(await quickMenu.isHidden(), 'Esc fecha as ações rápidas abertas por Mais');
  check(await moreTrigger.evaluate((button) => button === document.activeElement), 'Esc devolve o foco ao acionador Mais');
  await moreTrigger.click();
  const homeOrder = await page.evaluate(() => ({
    plan: document.querySelector('.home-today-card')?.getBoundingClientRect().top,
    primaryBottom: document.querySelector('.home-primary')?.getBoundingClientRect().bottom,
    areas: document.querySelector('.home-areas')?.getBoundingClientRect().top,
    onboarding: document.querySelector('.home-first-steps')?.getBoundingClientRect().top,
    summary: document.querySelector('.home-primary > .strip')?.getBoundingClientRect().top,
    sampleNotice: [...document.querySelectorAll('.main > .notice')].find((item) => item.textContent.includes('dados de exemplo'))?.getBoundingClientRect().top,
  }));
  check(homeOrder.plan < homeOrder.onboarding, 'plano de hoje aparece antes dos primeiros passos');
  check(homeOrder.summary === undefined || homeOrder.plan < homeOrder.summary, 'plano de hoje aparece antes dos resumos no layout padrão');
  check(homeOrder.areas === undefined || homeOrder.areas >= homeOrder.primaryBottom, 'atalhos das áreas ficam depois do plano e dos resumos');
  check(await page.locator('.home-head .home-action').count() === 0, 'cabeçalho não repete o formulário rápido de tarefa');
  check(await page.locator('.home-quick-form').isVisible(), 'formulário rápido permanece como ação principal');
  check(await page.locator('.home-tools [data-action="quick-action-task"]').count() === 0, 'atalho favorito de tarefa não duplica o formulário rápido');
  check(await page.locator('.home-inbox-reminder').count() === 0
    || await page.locator('.home-inbox-reminder a[data-action="filter-inbox"]').count() === 1,
  'tarefas sem data têm uma ação direta para organizá-las');
  const guideContrast = await page.locator('.home-head .area-guide-button').evaluate((button) => {
    const rgb = (color) => color.match(/[\d.]+/g).slice(0, 3).map(Number);
    const luminance = (color) => rgb(color).map((channel) => {
      const value = channel / 255;
      return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
    }).reduce((sum, channel, index) => sum + channel * [.2126, .7152, .0722][index], 0);
    const style = getComputedStyle(button);
    const values = [luminance(style.color), luminance(style.backgroundColor)].sort((a, b) => b - a);
    return (values[0] + .05) / (values[1] + .05);
  });
  check(guideContrast >= 4.5, 'botão Como usar? mantém contraste legível sobre a cor do cabeçalho', guideContrast.toFixed(2));
  const taskNextStep = page.locator('.home-today-card .home-next-task .home-next-step-label');
  const habitNextStep = page.locator('.home-habit-checkins .home-habit-row.is-next .home-next-step-label');
  const nextStepCount = await taskNextStep.count() + await habitNextStep.count();
  check(nextStepCount <= 1, 'Início destaca no máximo um próximo passo');
  const hasOpenTask = await page.locator('.home-today-card .home-task-group .task:not(.done)').count() > 0;
  const hasOpenHabit = await page.locator('.home-habit-checkins [data-action="habit-check"]').count() > 0;
  check(nextStepCount === Number(hasOpenTask || hasOpenHabit), 'próximo passo aparece na lista de tarefas ou hábitos sem criar um cartão repetido');
  check(await page.locator('.home-next-action:not(.home-weekly-review)').count() === await page.locator('.home-bill-reminder').count(),
    'lembretes financeiros permanecem secundários fora do plano do dia');
  check(homeOrder.sampleNotice < homeOrder.plan, 'aviso de demonstração permanece antes das ações');
  const sampleNoticeLayout = await page.evaluate(() => {
    const notice = document.querySelector('.sample-banner');
    const copy = notice.querySelector('.grow').getBoundingClientRect();
    const action = notice.querySelector('.btn').getBoundingClientRect();
    return action.top >= copy.bottom && action.left >= copy.left;
  });
  check(sampleNoticeLayout, 'aviso de demonstração mantém texto legível no celular');
  await page.locator('.nav a[href="/planejar"]').click();
  const upcomingTasks = [
    ['Agenda amanhã', 1],
    ['Agenda em quatro dias', 4],
    ['Agenda em cinco dias', 5],
    ['Agenda em seis dias', 6],
    ['Agenda fora do período', 8],
  ];
  for (const [title, days] of upcomingTasks) {
    await page.locator('[data-action="task-new"]').first().click();
    const dialog = page.locator('#dlg');
    await dialog.waitFor({ state: 'visible' });
    const dueDate = await page.evaluate((offset) => {
      const date = new Date();
      date.setHours(12, 0, 0, 0);
      date.setDate(date.getDate() + offset);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }, days);
    await dialog.locator('[data-dlg="title"]').fill(title);
    await dialog.locator('[data-dlg="due"]').fill(dueDate);
    await dialog.getByRole('button', { name: 'Adicionar tarefa', exact: true }).click();
    await dialog.waitFor({ state: 'detached' });
  }
  await page.locator('.nav a[href="/inicio"]').click();
  const upcomingCard = page.locator('.home-upcoming-card');
  await upcomingCard.waitFor({ state: 'visible' });
  const upcomingTitles = await upcomingCard.locator('.task .ttl').allInnerTexts();
  check(upcomingTitles.join('|') === ['Agenda amanhã', 'Organizar documentos', 'Agenda em quatro dias'].join('|'),
    'home mostra em ordem as três próximas tarefas com data', upcomingTitles.join(' | '));
  const upcomingMore = await upcomingCard.locator('.home-upcoming-more').innerText();
  check(upcomingMore === '+ 2 tarefas na lista completa.',
    'home informa quando há mais tarefas futuras do que o limite da prévia', upcomingMore);
  check(await upcomingCard.getByText('Agenda fora do período').count() === 0,
    'prévia limita tarefas ao período de sete dias');
  await page.locator('.nav a[href="/planejar"]').click();
  await page.locator('[data-action="task-new"]').first().click();
  const inboxTaskDialog = page.locator('#dlg');
  await inboxTaskDialog.waitFor({ state: 'visible' });
  await inboxTaskDialog.locator('[data-dlg="title"]').fill('Tarefa sem data para organizar');
  await inboxTaskDialog.locator('button[type="submit"][form="dlgform"]').click();
  await inboxTaskDialog.waitFor({ state: 'detached' });
  await page.locator('.nav a[href="/inicio"]').click();
  const inboxReminder = page.locator('.home-inbox-reminder');
  await inboxReminder.waitFor({ state: 'visible' });
  check(/^\d+ tarefas? sem data/.test(await inboxReminder.locator('b').innerText()),
    'tarefas sem data aparecem como uma lista para organizar');
  await inboxReminder.getByRole('link', { name: 'Organizar tarefas' }).click();
  check(await page.locator('.task .ttl').filter({ hasText: 'Tarefa sem data para organizar' }).count() === 1,
    'organizar tarefas sem data abre Planejar já filtrado');
  await page.locator('.nav a[href="/inicio"]').click();
  await page.locator('.nav a[href="/planejar"]').click();
  await page.locator('[aria-label="Filtrar tarefas"] [data-f="todas"]').click();
  await page.locator('.nav a[href="/inicio"]').click();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const dockClearance = await page.evaluate(() => {
    const nav = document.querySelector('.topbar .nav');
    const finalAction = document.querySelector('.home-tools .home-tool:last-child');
    return finalAction.getBoundingClientRect().bottom <= nav.getBoundingClientRect().top;
  });
  check(dockClearance, 'última ação do Início pode ser alcançada acima do dock móvel');
  await openQuickActions();
  check(await page.evaluate(() => {
    const menu = document.querySelector('#quick-actions-menu').getBoundingClientRect();
    const dock = document.querySelector('.topbar .nav').getBoundingClientRect();
    return menu.left >= dock.left - 1
      && menu.right <= dock.right + 1
      && menu.bottom <= dock.top;
  }), 'menu Criar encaixa no dock sem desencontro horizontal');
  check(await quickMenu.getByRole('button', { name: 'Nova tarefa' }).count() === 1, 'ações rápidas oferecem criação de tarefa');
  check(await quickMenu.getByRole('button', { name: 'Nova tarefa' }).evaluate((button) => button === document.activeElement), 'abrir ações rápidas posiciona o foco no primeiro item');
  await page.keyboard.press('Escape');
  check(await quickMenu.isHidden(), 'Esc fecha as ações rápidas');
  check(await moreTrigger.evaluate((button) => button === document.activeElement), 'Esc devolve o foco ao acionador Mais');

  await openQuickActions();
  await page.locator('.nav-scrim').click();
  check(await quickMenu.isHidden(), 'clique fora fecha as ações rápidas');
  await openQuickActions();
  await quickMenu.getByRole('button', { name: 'Nova tarefa' }).click();
  const taskDialog = page.locator('#dlg');
  await taskDialog.waitFor({ state: 'visible' });
  check(await taskDialog.getByRole('heading', { name: 'Nova tarefa.' }).count() === 1, 'atalho abre o formulário existente de tarefa');
  await taskDialog.locator('[data-dlg="title"]').fill('Tarefa para desfazer');
  await taskDialog.locator('button[type="submit"][form="dlgform"]').click();
  await taskDialog.waitFor({ state: 'detached' });
  await page.locator('.nav a[href="/planejar"]').click();
  const taskCheck = page.getByRole('checkbox', { name: 'Concluir: Tarefa para desfazer' });
  await taskCheck.click();
  check(await page.getByRole('status').filter({ hasText: 'Tarefa concluída.' }).count() === 1, 'conclusão de tarefa oferece desfazer');
  await page.locator('#toast').getByRole('button', { name: 'Desfazer' }).click();
  const reopenedTask = page.getByRole('checkbox', { name: 'Concluir: Tarefa para desfazer' });
  check(await reopenedTask.count() === 1 && await reopenedTask.getAttribute('aria-checked') === 'false', 'desfazer reabre a tarefa e atualiza o estado acessível');

  for (const [actionName, dialogTitle] of [
    ['Novo hábito', 'Novo hábito.'],
    ['Lançamento', 'Novo lançamento.'],
  ]) {
    await openQuickActions();
    await quickMenu.getByRole('button', { name: actionName }).click();
    await taskDialog.waitFor({ state: 'visible' });
    check(await taskDialog.getByRole('heading', { name: dialogTitle }).count() === 1, `${actionName} abre o formulário existente`);
    await page.keyboard.press('Escape');
    await taskDialog.waitFor({ state: 'detached' });
  }

  const breakpoints = [];
  for (const width of [768, 900, 1024, 1100, 1199, 1200, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    breakpoints.push(await page.evaluate(() => {
      const nav = document.querySelector('.topbar .nav');
      const currentLabel = nav.querySelector('a[aria-current="page"] .tab-label-group');
      const sidebarElement = document.querySelector('.app > .topbar');
      const sidebarBounds = sidebarElement.getBoundingClientRect();
      const sidebar = getComputedStyle(document.querySelector('.app')).gridTemplateColumns.startsWith('220px');
      const sidebarFixed = getComputedStyle(sidebarElement).position === 'fixed'
        && Math.abs(sidebarBounds.top) <= 1
        && Math.abs(sidebarBounds.bottom - innerHeight) <= 1;
      const navLabels = [...nav.querySelectorAll(':scope > a.nav-primary .tab-label-group')];
      return {
        width: innerWidth,
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        reloadButtonVisible: getComputedStyle(nav.parentElement.querySelector('[data-action="reload-app"]')).display !== 'none',
        sidebar,
        sidebarFixed,
        activeLabelVisible: currentLabel ? currentLabel.getBoundingClientRect().width > 0 : true,
        primaryLabelsVisible: navLabels.length > 0 && navLabels.every((label) => label.getBoundingClientRect().width > 1),
        createLabelVisible: nav.querySelector('.nav-quick-trigger .tab-label-group').getBoundingClientRect().width > 1,
        sidebarToggleVisible: getComputedStyle(document.querySelector('.sidebar-toggle')).display !== 'none',
        navPosition: getComputedStyle(nav).position,
      };
    }));
  }
  check(breakpoints.every(({ overflow }) => !overflow), 'sem overflow horizontal entre 768 e 1440 px', JSON.stringify(breakpoints));
  check(breakpoints.find(({ width }) => width === 1024)?.activeLabelVisible, 'nome da área atual permanece visível em tablet');
  const labeledTablet = breakpoints.find(({ width }) => width === 1100);
  check(labeledTablet?.primaryLabelsVisible && labeledTablet?.createLabelVisible, 'nomes da navegação principal e de Criar ficam visíveis no tablet largo');
  check(breakpoints.find(({ width }) => width === 1200)?.sidebar, 'barra lateral entra a partir de 1200 px');
  check(breakpoints.find(({ width }) => width === 1200)?.sidebarFixed,
    'barra lateral desktop permanece fixa na altura da janela', JSON.stringify(breakpoints.find(({ width }) => width === 1200)));
  check(breakpoints.find(({ width }) => width === 1200)?.sidebarToggleVisible
    && !breakpoints.find(({ width }) => width === 1199)?.sidebarToggleVisible,
  'controle de recolher só aparece no layout de barra lateral', JSON.stringify(breakpoints));
  for (const width of [900, 1024, 1199]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(100);
    check(await moreMenu.isHidden(), `menu Mais fica fechado em ${width} px`);
    const compactHeaderHeight = await page.locator('.topbar').evaluate((header) => header.getBoundingClientRect().height);
    await moreTrigger.click();
    await moreMenu.waitFor({ state: 'visible' });
    const compactMenuLayout = await page.evaluate(() => {
      const header = document.querySelector('.topbar').getBoundingClientRect();
      const nav = document.querySelector('.topbar .nav').getBoundingClientRect();
      const menu = document.querySelector('#nav-more-menu');
      const menuBounds = menu.getBoundingClientRect();
      return {
        headerHeight: header.height,
        menuPosition: getComputedStyle(menu).position,
        menuBelowNav: menuBounds.top >= nav.bottom,
        menuWithinViewport: menuBounds.left >= 0 && menuBounds.right <= innerWidth,
        linksFit: [...menu.querySelectorAll('.nav-more-link, .nav-more-create')].every((item) => (
          item.scrollWidth <= item.clientWidth + 1
          && item.getBoundingClientRect().width > 0
        )),
      };
    });
    check(Math.abs(compactMenuLayout.headerHeight - compactHeaderHeight) <= 1 && compactMenuLayout.menuPosition === 'absolute',
      `menu Mais flutua sem alterar o cabeçalho em ${width} px`, JSON.stringify(compactMenuLayout));
    check(compactMenuLayout.menuBelowNav && compactMenuLayout.menuWithinViewport && compactMenuLayout.linksFit,
      `menu Mais cabe na tela e mantém os rótulos em ${width} px`, JSON.stringify(compactMenuLayout));
    await moreTrigger.click();
    check(await moreMenu.isHidden(), `acionador Mais fecha o painel em ${width} px`);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}/?preview#config?section=areas-navigation`);
  const cycleAreaToggle = page.locator('[data-change="area"][data-area="cycle"]');
  const cycleMenuToggle = page.locator('#menu-visible-ciclo');
  const cycleWasEnabled = await cycleAreaToggle.isChecked();
  const cycleWasVisible = await cycleMenuToggle.isChecked();
  await cycleAreaToggle.check();
  await cycleMenuToggle.check();
  if (!cycleWasEnabled || !cycleWasVisible) await page.locator('[data-settings-save-button]').click();
  await page.setViewportSize({ width: 1440, height: 900 });
  const cycleSidebarLink = page.locator('.app > .topbar .nav > a.nav-secondary[href="/ciclo"]');
  await cycleSidebarLink.waitFor({ state: 'visible' });
  check(await cycleSidebarLink.isVisible(), 'Ciclo ativo aparece como link direto na barra lateral desktop');
  const sidebarToggle = page.getByRole('button', { name: 'Recolher menu lateral' });
  check(await sidebarToggle.isVisible(), 'controle para recolher o menu aparece na barra lateral web');
  await sidebarToggle.click();
  const collapsedSidebar = await page.locator('.app').evaluate((app) => ({
    collapsed: app.classList.contains('sidebar-collapsed'),
    columns: getComputedStyle(app).gridTemplateColumns,
    toggleLabel: app.querySelector('.sidebar-toggle')?.getAttribute('aria-label'),
    homeLinkLabel: app.querySelector('.nav-primary[href="/inicio"]')?.innerText.trim(),
    iconVisible: app.querySelector('.nav-primary[href="/inicio"] .ni')?.getBoundingClientRect().width > 0,
    controlsAtTopRight: (() => {
      const actions = app.querySelector('.header-actions');
      const bounds = actions.getBoundingClientRect();
      return getComputedStyle(actions).position === 'fixed'
        && bounds.top >= 16
        && bounds.right <= innerWidth - 16
        && bounds.left > app.querySelector('.topbar').getBoundingClientRect().right;
    })(),
  }));
  check(collapsedSidebar.collapsed && collapsedSidebar.columns.startsWith('76px'),
    'menu lateral recolhe para uma coluna compacta de ícones', JSON.stringify(collapsedSidebar));
  check(collapsedSidebar.toggleLabel === 'Expandir menu lateral'
    && collapsedSidebar.homeLinkLabel.startsWith('Início') && collapsedSidebar.iconVisible,
  'menu recolhido mantém nomes acessíveis e atualiza o acionador', JSON.stringify(collapsedSidebar));
  check(collapsedSidebar.controlsAtTopRight,
    'controles do tema, notificações e perfil permanecem no topo ao recolher', JSON.stringify(collapsedSidebar));
  await page.locator('.app > .topbar .nav a[href="/planejar"]').click();
  await page.locator('.main[data-route="planejar"]').waitFor();
  check(await page.locator('.app').evaluate((app) => app.classList.contains('sidebar-collapsed')),
    'estado recolhido permanece ao navegar entre telas');
  await page.getByRole('button', { name: 'Expandir menu lateral' }).click();
  check(!(await page.locator('.app').evaluate((app) => app.classList.contains('sidebar-collapsed'))),
    'menu lateral expande pelo controle');
  const sidebarControlsLayout = await page.locator('.app').evaluate((app) => {
    const actions = app.querySelector('.header-actions');
    const nav = app.querySelector('.nav');
    const create = nav.querySelector('.nav-quick-trigger');
    const main = app.querySelector('.main');
    const rect = (element) => element.getBoundingClientRect();
    const actionsBounds = rect(actions);
    const navBounds = rect(nav);
    const createBounds = rect(create);
    const firstContent = [...main.children].find((element) => (
      !element.matches('.notification-panel, .fab')
      && getComputedStyle(element).display !== 'none'
    ));
    return {
      actionsDisplay: getComputedStyle(actions).display,
      visibleButtons: [...actions.children].filter((button) => getComputedStyle(button).display !== 'none').length,
      actionsAtTopRight: getComputedStyle(actions).position === 'fixed'
        && actionsBounds.top >= 16
        && actionsBounds.right <= innerWidth - 16
        && actionsBounds.left > navBounds.right,
      actionsBounds: { left: actionsBounds.left, top: actionsBounds.top, right: actionsBounds.right, bottom: actionsBounds.bottom },
      navRight: navBounds.right,
      mainClearsActions: firstContent && rect(firstContent).top >= actionsBounds.bottom,
      createFits: createBounds.width > 0
        && createBounds.left >= navBounds.left
        && createBounds.right <= navBounds.right
        && create.scrollWidth <= create.clientWidth,
    };
  });
  check(sidebarControlsLayout.actionsDisplay === 'flex' && sidebarControlsLayout.visibleButtons >= 3,
    'tema, notificações e perfil ficam agrupados no topo', JSON.stringify(sidebarControlsLayout));
  check(sidebarControlsLayout.actionsAtTopRight && sidebarControlsLayout.mainClearsActions,
    'controles superiores ficam à direita sem cobrir o conteúdo', JSON.stringify(sidebarControlsLayout));
  check(sidebarControlsLayout.createFits,
    'botão Criar cabe inteiro dentro da barra lateral', JSON.stringify(sidebarControlsLayout));
  const sidebarItemOrder = await page.locator('.app > .topbar .nav').evaluate((nav) => (
    [...nav.children]
      .filter((item) => getComputedStyle(item).display !== 'none'
        && !item.classList.contains('nav-more-menu'))
      .map((item) => item.classList.contains('nav-quick-control')
        ? 'criar'
        : item.getAttribute('href'))
  ));
  check(sidebarItemOrder[0] === '/inicio', 'Início permanece como primeiro item da barra lateral', sidebarItemOrder.join(', '));
  check(sidebarItemOrder.slice(0, 5).join(',') === '/inicio,/planejar,/financas,/ciclo,/habitos',
    'ordem padrão das áreas segue o menu visual nos breakpoints', sidebarItemOrder.join(', '));
  const sidebarHabitsIndex = sidebarItemOrder.indexOf('/habitos');
  const sidebarCreateIndex = sidebarItemOrder.indexOf('criar');
  check(sidebarHabitsIndex < 0 || sidebarCreateIndex > sidebarHabitsIndex,
    'Criar aparece depois de Hábitos na barra lateral', sidebarItemOrder.join(', '));
  check(breakpoints.find(({ width }) => width === 768)?.navPosition === 'fixed', 'dock inferior permanece em tablet estreito');
  check(breakpoints.find(({ width }) => width === 1024)?.reloadButtonVisible,
    'botão de atualização permanece disponível no layout compacto do navegador');
  check(!breakpoints.find(({ width }) => width === 1200)?.reloadButtonVisible,
    'botão de atualização não aparece na visão web');
  const sidebarAfterRouteChanges = [];
  await page.evaluate(() => {
    window.__appRootMutations = 0;
    window.__appRootObserver = new MutationObserver((records) => {
      window.__appRootMutations += records.filter((record) => record.target.id === 'app').length;
    });
    window.__appRootObserver.observe(document.querySelector('#app'), { childList: true });
  });
  const rendersBeforeRouteChange = await page.evaluate(() => window.__appRootMutations);
  await page.locator('.app > .topbar .nav a[href="/inicio"]').click();
  await page.locator('.main[data-route="inicio"]').waitFor();
  await page.waitForTimeout(100);
  const routeRenderCount = await page.evaluate((before) => window.__appRootMutations - before, rendersBeforeRouteChange);
  check(routeRenderCount === 1, 'trocar de tela renderiza o shell uma única vez', String(routeRenderCount));
  await page.evaluate(() => window.__appRootObserver.disconnect());
  for (const [path, route] of [['/inicio', 'inicio'], ['/planejar', 'planejar']]) {
    await page.locator(`.topbar .nav a[href="${path}"]`).click();
    await page.locator(`.main[data-route="${route}"]`).waitFor();
    sidebarAfterRouteChanges.push(await page.locator('.app > .topbar').evaluate((sidebar) => {
      const bounds = sidebar.getBoundingClientRect();
      return {
        position: getComputedStyle(sidebar).position,
        top: bounds.top,
        bottom: bounds.bottom,
        viewportHeight: innerHeight,
      };
    }));
  }
  check(sidebarAfterRouteChanges.every(({ position, top, bottom, viewportHeight }) => (
    position === 'fixed' && Math.abs(top) <= 1 && Math.abs(bottom - viewportHeight) <= 1
  )), 'barra lateral não se desloca ao alternar entre telas', JSON.stringify(sidebarAfterRouteChanges));
  check(await page.locator('.app > .topbar .global-search-trigger').count() === 0,
    'busca global não aparece como botão no cabeçalho');
  await page.keyboard.press('Control+k');
  check(await page.locator('#dlg').getByRole('heading', { name: 'Buscar no Aurora.' }).count() === 1, 'acionador abre a busca global');
  await page.keyboard.press('Escape');
  check(await page.locator('#dlg').count() === 0, 'Esc fecha a busca aberta pelo atalho de teclado');
  check(errors.length === 0, 'sem erros no console', errors.slice(0, 3).join(' | '));

  await browser.close();
  process.exit(results.every(Boolean) ? 0 : 1);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
