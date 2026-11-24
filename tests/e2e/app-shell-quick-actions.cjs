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
  await page.locator('.preview-shell .main').waitFor();
  await page.setViewportSize({ width: 1280, height: 800 });
  const headerButtonOrder = await page.locator('.header-actions').evaluate((actions) =>
    Array.from(actions.children)
      .filter((child) => child.getClientRects().length && getComputedStyle(child).visibility !== 'hidden')
      .map((child) => {
        if (child.matches('.profile-menu-control')) {
          const trigger = child.querySelector('.profile-menu-trigger');
          return {
            name: 'profile',
            label: trigger.getAttribute('aria-label'),
            title: trigger.title,
            left: child.getBoundingClientRect().left,
          };
        }
        if (child.matches('.nav-quick-control')) return { name: 'create', left: child.getBoundingClientRect().left };
        if (child.matches('.theme-trigger')) return { name: 'theme', left: child.getBoundingClientRect().left };
        return { name: 'other', left: child.getBoundingClientRect().left };
      }),
  );
  await page.setViewportSize({ width: 320, height: 700 });
  check(headerButtonOrder.map(({ name }) => name).join(',') === 'create,theme,profile'
    && headerButtonOrder[2].label === 'Perfil e conta'
    && headerButtonOrder[2].title === 'Perfil e conta'
    && headerButtonOrder.every((item, index) => index === 0 || headerButtonOrder[index - 1].left < item.left),
    'cabeçalho mantém Criar, Tema e Perfil nessa ordem',
    headerButtonOrder.map(({ name }) => name).join(' → '));
  check(await page.locator('.global-quick-actions, .global-quick-fab').count() === 0, 'não há botão flutuante de criação duplicado');
  const mobileNavBackgrounds = await page.locator('.topbar .nav').evaluate((nav) => {
    const root = document.documentElement;
    const previousTheme = root.dataset.theme;
    const backgrounds = ['light', 'dark'].map((theme) => {
      root.dataset.theme = theme;
      const color = getComputedStyle(nav).backgroundColor;
      const alpha = color.startsWith('rgba(')
        ? Number(color.slice(color.lastIndexOf(',') + 1).replace(')', '').trim())
        : 1;
      return { theme, alpha };
    });
    if (previousTheme) root.dataset.theme = previousTheme;
    else delete root.dataset.theme;
    return backgrounds;
  });
  check(mobileNavBackgrounds.every(({ alpha }) => alpha === 1),
    'menu móvel tem fundo opaco nos temas claro e escuro', JSON.stringify(mobileNavBackgrounds));
  const quickTrigger = () => page.locator('.nav-quick-trigger:visible').first();
  const quickMenu = page.locator('#quick-actions-menu');
  const openQuickActions = async () => {
    if (await quickMenu.isVisible()) return;
    await quickTrigger().click();
    await quickMenu.waitFor({ state: 'visible' });
  };
  await openQuickActions();
  check(await quickMenu.getByRole('button', { name: 'Beber água', exact: true }).count() === 1,
    'atalho de água permanece no menu do header');
  await page.keyboard.press('Escape');
  const shortcutPage = await browser.newPage();
  await shortcutPage.emulateMedia({ reducedMotion: 'reduce' });
  const shortcutErrors = [];
  shortcutPage.on('pageerror', (error) => shortcutErrors.push(error.message));
  await shortcutPage.goto(`${BASE}/?preview#inicio`);
  await shortcutPage.locator('.nav-quick-trigger:visible').first().click();
  await shortcutPage.locator('#quick-actions-menu').waitFor({ state: 'visible' });
  await shortcutPage.locator('#quick-actions-menu [data-action="quick-action-expense"], #quick-actions-menu [data-action="quick-action-transaction"]').first().click();
  await shortcutPage.locator('#dlg').getByRole('heading', { name: 'Novo lançamento' }).waitFor();
  check(shortcutErrors.length === 0, 'atalho financeiro do Início carrega o formulário sem abrir Finanças', shortcutErrors.join(' | '));
  await shortcutPage.keyboard.press('Escape');
  check(await shortcutPage.locator('.home-day-complete').count() === 0, 'dia não aparece concluído com tarefas pendentes');
  const pendingToday = shortcutPage.locator('.home-today-card .home-task-group [data-action="toggle"][aria-checked="false"]');
  while (await pendingToday.count()) {
    const taskId = await pendingToday.first().getAttribute('data-id');
    await pendingToday.first().click();
    await shortcutPage.waitForFunction((id) => !document.querySelector(
      `.home-today-card .home-task-group .task[data-k="${id}"]`,
    ), taskId);
  }
  await shortcutPage.locator('.home-day-complete').waitFor({ state: 'visible' });
  const reducedCompletion = await shortcutPage.locator('.home-head').evaluate((header) => ({
    hasMotionClass: header.classList.contains('is-day-completion'),
    animationName: getComputedStyle(header).animationName,
    lead: header.querySelector('.lead').textContent,
  }));
  check(await shortcutPage.locator('.home-day-complete').isVisible()
    && !reducedCompletion.hasMotionClass
    && reducedCompletion.animationName === 'none'
    && reducedCompletion.lead.includes('Tudo concluído por hoje.'),
  'dia concluído atualiza a mensagem sem animação quando o movimento é reduzido');
  await shortcutPage.locator('.home-completed > summary').click();
  await shortcutPage.locator('.home-completed [data-action="toggle"]').first().click();
  await shortcutPage.locator('.home-day-complete').waitFor({ state: 'detached' });
  check(await shortcutPage.locator('.home-day-complete').count() === 0, 'reabrir uma tarefa remove a conclusão do dia');
  await shortcutPage.close();
  const motionPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await motionPage.emulateMedia({ reducedMotion: 'no-preference' });
  await motionPage.goto(`${BASE}/?preview#inicio`);
  await motionPage.locator('.home-today-card').waitFor();
  const firstMotionTask = motionPage.locator('.home-today-card .home-task-group [data-action="toggle"][aria-checked="false"]').first();
  const firstMotionTaskId = await firstMotionTask.getAttribute('data-id');
  const taskMotion = await firstMotionTask.evaluate((button) => {
    button.click();
    return {
      check: getComputedStyle(button.querySelector('span')).animationName,
      title: getComputedStyle(button.closest('.task').querySelector('.ttl')).animationName,
    };
  });
  check(taskMotion.check === 'task-check-pop' && taskMotion.title === 'task-title-complete',
    'concluir uma tarefa anima o círculo e a cor do texto riscado');
  await motionPage.waitForFunction((id) => !document.querySelector(
    `.home-today-card .home-task-group .task[data-k="${id}"]`,
  ), firstMotionTaskId);
  const remainingMotionTasks = motionPage.locator('.home-today-card .home-task-group [data-action="toggle"][aria-checked="false"]');
  while (await remainingMotionTasks.count()) {
    const taskId = await remainingMotionTasks.first().getAttribute('data-id');
    await remainingMotionTasks.first().click();
    await motionPage.waitForFunction((id) => !document.querySelector(
      `.home-today-card .home-task-group .task[data-k="${id}"]`,
    ), taskId);
  }
  await motionPage.waitForFunction(() => document.querySelector('.home-head.is-day-completion'));
  const completedDayMotion = await motionPage.locator('.home-head').evaluate((header) => ({
    animationName: getComputedStyle(header).animationName,
    duration: getComputedStyle(header).animationDuration,
    lead: header.querySelector('.lead').textContent,
  }));
  check(completedDayMotion.animationName === 'home-completion-glow'
    && completedDayMotion.duration === '1.2s'
    && completedDayMotion.lead.includes('Tudo concluído por hoje.'),
  'última tarefa destaca o cartão por 1,2 s e atualiza a mensagem');
  const annualRingMotion = await motionPage.evaluate(async () => {
    const { animateProgressRings, captureProgressRings } = await import('/src/js/utils/motion.js');
    const container = document.createElement('div');
    const ring = document.createElement('span');
    ring.className = 'annual-plan-progress-ring';
    ring.style.setProperty('--annual-progress', '25');
    container.append(ring);
    document.body.append(container);
    const previous = captureProgressRings(container);
    ring.style.setProperty('--annual-progress', '50');
    animateProgressRings(container, previous);
    const result = {
      animationName: getComputedStyle(ring).animationName,
      from: ring.style.getPropertyValue('--motion-progress-from'),
      to: ring.style.getPropertyValue('--motion-progress-to'),
    };
    document.documentElement.setAttribute('data-reduce-motion', 'true');
    const reducedRing = document.createElement('span');
    reducedRing.className = 'annual-plan-progress-ring';
    reducedRing.style.setProperty('--annual-progress', '20');
    container.append(reducedRing);
    const reducedPrevious = captureProgressRings(container);
    reducedRing.style.setProperty('--annual-progress', '40');
    animateProgressRings(container, reducedPrevious);
    result.reducedMotion = !reducedRing.classList.contains('is-progress-animating')
      && getComputedStyle(reducedRing).animationName === 'none';
    document.documentElement.removeAttribute('data-reduce-motion');
    container.remove();
    return result;
  });
  check(annualRingMotion.animationName === 'annual-progress-fill'
    && annualRingMotion.from === '25%'
    && annualRingMotion.to === '50%'
    && annualRingMotion.reducedMotion,
  'anel de progresso anima do valor anterior ao novo e respeita movimento reduzido');
  await motionPage.close();
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
      brandVisible: getComputedStyle(document.querySelector('.topbar .wordmark')).display !== 'none',
      collapseToggleHidden: !document.querySelector('.sidebar-toggle'),
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
      labelsFit: [...document.querySelectorAll('.topbar .nav > a:not(.nav-enable-areas) .tab-label-group')]
        .every((label) => label.scrollWidth <= label.clientWidth + 1),
      directNavigation: (() => {
        const nav = document.querySelector('.topbar .nav');
        const links = [...nav.querySelectorAll(':scope > a:not(.nav-enable-areas)')];
        const items = [...nav.children].filter((child) => getComputedStyle(child).display !== 'none');
        const profile = nav.querySelector('.profile-menu-control');
        const shownLinks = links.filter((link) => getComputedStyle(link).display !== 'none');
        const profileHidden = !profile || getComputedStyle(profile).display === 'none';
        return links.length === 5 && shownLinks.length === 5 && items.length === 5 && !nav.querySelector('.mobile-nav-create-trigger')
          && items.every((item) => item.matches('a.nav-item')) && profileHidden;
      })(),
      headerGap: parseFloat(getComputedStyle(document.querySelector('.app > .topbar .header-actions')).gap),
    })));
  }
  check(mobileNavLabels.every(({ dockedAsFloatingCapsule }) => dockedAsFloatingCapsule),
    'dock móvel fica flutuante, com recuo e cantos arredondados entre 320 e 430 px', JSON.stringify(mobileNavLabels));
  check(mobileNavLabels.every(({ actionsInsideBackground }) => actionsInsideBackground),
    'atalhos do dock ficam dentro do fundo entre 320 e 430 px', JSON.stringify(mobileNavLabels));
  check(mobileNavLabels.every(({ labelsFit }) => labelsFit), 'nomes do dock móvel não são cortados entre 320 e 430 px', JSON.stringify(mobileNavLabels));
  check(mobileNavLabels.every(({ directNavigation }) => directNavigation),
    'dock mostra as cinco áreas direto, sem o Mais', JSON.stringify(mobileNavLabels));
  check(mobileNavLabels.every(({ brandVisible }) => brandVisible),
    'nome da marca permanece visível no cabeçalho móvel', JSON.stringify(mobileNavLabels));
  check(mobileNavLabels.every(({ collapseToggleHidden }) => collapseToggleHidden),
    'controle da barra lateral não aparece no dock móvel', JSON.stringify(mobileNavLabels));
  await page.setViewportSize({ width: 320, height: 700 });
  check(await page.locator('.home-extras').count() === 0
    && await page.locator('.home-quick-card .home-quick-form').isVisible(), 'o próximo passo permanece visível sem blocos extras recolhíveis');
  const homeOrder = await page.evaluate(() => ({
    plan: document.querySelector('.home-today-card')?.getBoundingClientRect().top,
    primaryBottom: document.querySelector('.home-primary')?.getBoundingClientRect().bottom,
    areas: document.querySelector('.home-areas')?.getBoundingClientRect().top,
    onboarding: document.querySelector('.home-first-steps')?.getBoundingClientRect().top,
    summary: document.querySelector('.home-day-summary')?.getBoundingClientRect().top,
    sampleNotice: [...document.querySelectorAll('.main > .notice')].find((item) => item.textContent.includes('dados de exemplo'))?.getBoundingClientRect().top,
  }));
  check(homeOrder.onboarding === undefined, 'cartão de primeiro acesso não aparece na demonstração com tarefas fictícias');
  check(homeOrder.summary === undefined || homeOrder.plan < homeOrder.summary, 'plano de hoje aparece antes dos resumos no layout padrão');
  check(homeOrder.areas === undefined || homeOrder.areas >= homeOrder.primaryBottom, 'atalhos das áreas ficam depois do plano e dos resumos');
  check(await page.locator('.home-head .home-action[href="/planejar"]').count() === 1, 'cabeçalho oferece uma ação direta para planejar o dia');
  check(await page.locator('.home-quick-card .home-quick-form').isVisible(), 'formulário rápido permanece acessível fora dos blocos adicionais');
  check(await page.locator('.home-tools [data-action="quick-action-task"]').count() === 0, 'atalho favorito de tarefa não duplica o formulário rápido');
  check(await page.locator('.home-inbox-reminder').count() === 0
    || await page.locator('.home-inbox-reminder a[data-action="filter-inbox"]').count() === 1,
  'tarefas sem data têm uma ação direta para organizá-las');
  const guideContrast = await page.locator('.home-head .area-guide-button').evaluate((button) => {
    const rgb = (color) => {
      const channels = color.match(/[\d.]+/g).slice(0, 3).map(Number);
      return color.startsWith('color(srgb') ? channels.map((channel) => channel * 255) : channels;
    };
    const luminance = (color) => rgb(color).map((channel) => {
      const value = channel / 255;
      return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
    }).reduce((sum, channel, index) => sum + channel * [.2126, .7152, .0722][index], 0);
    const style = getComputedStyle(button);
    const header = button.closest('.home-head');
    const background = style.backgroundColor.endsWith(', 0)')
      ? getComputedStyle(header).backgroundColor
      : style.backgroundColor;
    const values = [luminance(style.color), luminance(background)].sort((a, b) => b - a);
    return {
      ratio: (values[0] + .05) / (values[1] + .05),
      foreground: style.color,
      background,
      buttonBackground: style.backgroundColor,
    };
  });
  check(guideContrast.ratio >= 4.5, 'botão Como usar? mantém contraste legível sobre a cor do cabeçalho', JSON.stringify(guideContrast));
  const personalMessageUsesHeroColor = await page.evaluate(async () => {
    const { PALETTES } = await import('/src/js/features/appearance/palettes.js');
    const root = document.documentElement;
    const header = document.querySelector('.home-head');
    const message = document.createElement('p');
    const transitionOverride = document.createElement('style');
    const original = {
      theme: root.getAttribute('data-theme'),
      contrast: root.getAttribute('data-contrast'),
      primary: root.style.getPropertyValue('--p'),
      accent: root.style.getPropertyValue('--pd'),
    };
    transitionOverride.textContent = '.home-head, .home-head * { transition: none !important; }';
    document.head.append(transitionOverride);
    message.className = 'home-personal-message';
    message.textContent = 'Mensagem de teste';
    header.querySelector(':scope > div').append(message);
    let matchesHeroColor = true;
    let minimumContrast = Infinity;
    const luminance = ([red, green, blue]) => [red, green, blue]
      .map((channel) => channel / 255)
      .map((channel) => (channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4))
      .reduce((sum, channel, index) => sum + channel * [.2126, .7152, .0722][index], 0);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const rgb = (color) => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      return [...context.getImageData(0, 0, 1, 1).data];
    };
    try {
      for (const [, [, primary, accent]] of Object.entries(PALETTES)) {
        root.style.setProperty('--p', primary);
        root.style.setProperty('--pd', accent);
        for (const theme of ['light', 'dark']) {
          root.setAttribute('data-theme', theme);
          for (const contrast of ['normal', 'high']) {
            root.setAttribute('data-contrast', contrast);
            const messageColor = getComputedStyle(message).color;
            if (messageColor !== getComputedStyle(header.querySelector('h1')).color) matchesHeroColor = false;
            const foreground = rgb(messageColor);
            const headerStyle = getComputedStyle(header);
            const background = rgb(headerStyle.backgroundColor);
            if (foreground[3] !== 255 || background[3] !== 255 || headerStyle.backgroundImage !== 'none') {
              minimumContrast = 0;
              continue;
            }
            const foregroundLuminance = luminance(foreground);
            const backgroundLuminance = luminance(background);
            const ratio = (Math.max(foregroundLuminance, backgroundLuminance) + .05)
              / (Math.min(foregroundLuminance, backgroundLuminance) + .05);
            minimumContrast = Math.min(minimumContrast, ratio);
          }
        }
      }
    } finally {
      transitionOverride.remove();
      message.remove();
      if (original.theme === null) root.removeAttribute('data-theme');
      else root.setAttribute('data-theme', original.theme);
      if (original.contrast === null) root.removeAttribute('data-contrast');
      else root.setAttribute('data-contrast', original.contrast);
      if (original.primary) root.style.setProperty('--p', original.primary);
      else root.style.removeProperty('--p');
      if (original.accent) root.style.setProperty('--pd', original.accent);
      else root.style.removeProperty('--pd');
    }
    return { matchesHeroColor, minimumContrast };
  });
  check(personalMessageUsesHeroColor.matchesHeroColor && personalMessageUsesHeroColor.minimumContrast >= 4.5,
    'mensagem pessoal mantém contraste mínimo de 4,5:1 em todas as paletas, temas e modos de contraste',
    personalMessageUsesHeroColor.minimumContrast.toFixed(2));
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
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.locator('.profile-menu-trigger:visible').click();
  const profileSettingsLink = page.locator('#profile-menu a[href="/ajustes"]');
  const profileMenuClickable = await profileSettingsLink.evaluate((link) => {
    const bounds = link.getBoundingClientRect();
    const hit = document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
    return bounds.width > 0 && link.contains(hit);
  });
  check(profileMenuClickable, 'menu de perfil desktop fica acima do conteúdo e pode ser acionado');
  await page.keyboard.press('Escape');
  await openQuickActions();
  check(await quickMenu.isVisible(), 'ações rápidas continuam disponíveis no tablet');
  check(await quickMenu.getByRole('button', { name: 'Nova tarefa' }).count() === 1, 'ações rápidas oferecem criação de tarefa');
  check(await quickMenu.getByRole('button', { name: 'Nova tarefa' }).evaluate((button) => button === document.activeElement), 'abrir ações rápidas posiciona o foco no primeiro item');
  await page.keyboard.press('Escape');
  check(await quickMenu.isHidden(), 'Esc fecha as ações rápidas');
  check(await quickTrigger().evaluate((button) => button === document.activeElement), 'Esc devolve o foco ao acionador de ações rápidas');

  await openQuickActions();
  await page.locator('.main').click({ position: { x: 10, y: 10 } });
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
  for (const theme of ['light', 'dark']) {
    for (const width of [360, 390, 768, 900, 1024, 1200, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate((value) => document.documentElement.setAttribute('data-theme', value), theme);
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      breakpoints.push(await page.evaluate(() => {
        const nav = document.querySelector('.topbar .nav');
        const links = [...nav.querySelectorAll(':scope > a.nav-item')];
        // No celular as cinco áreas ficam direto na barra, sem o Mais.
        const shown = links.filter((link) => link.getClientRects().length);
        const active = nav.querySelector('[aria-current="page"]');
        const areaBounds = {
          left: shown[0].getBoundingClientRect().left,
          right: shown[shown.length - 1].getBoundingClientRect().right,
        };
        const headerBounds = nav.closest('.topbar').getBoundingClientRect();
        const navBackground = getComputedStyle(nav).backgroundColor;
        const navAlpha = navBackground.startsWith('rgba(')
          ? Number(navBackground.slice(navBackground.lastIndexOf(',') + 1).replace(')', '').trim())
          : 1;
        return {
          width: innerWidth,
          theme: document.documentElement.dataset.theme,
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
          position: getComputedStyle(nav).position,
          navOpaque: navAlpha === 1,
          areaCenterDelta: Math.abs(
            (areaBounds.left + areaBounds.right) / 2 - (headerBounds.left + headerBounds.right) / 2,
          ),
          labelsVisible: shown.length === (innerWidth < 900 ? 3 : 5) && shown.every((link) => {
            const label = link.querySelector('.tab-label-group');
            const rect = label.getBoundingClientRect();
            return rect.width > 0 && label.scrollWidth <= label.clientWidth + 1;
          }),
          activeCircle: active && getComputedStyle(active.querySelector('.ni')).backgroundColor !== 'rgba(0, 0, 0, 0)',
          noMore: !document.querySelector('.nav-more-trigger, .nav-more-menu, .sidebar-toggle'),
          headerCreate: !document.querySelector('.mobile-nav-create-trigger')
            && Boolean(document.querySelector('.header-actions .nav-quick-trigger')?.getClientRects().length),
        };
      }));
    }
  }
  check(breakpoints.every(({ overflow }) => !overflow), 'sem overflow nos tamanhos e temas solicitados', JSON.stringify(breakpoints));
  check(breakpoints.every(({ labelsVisible, activeCircle, noMore, headerCreate }) => labelsVisible && activeCircle && noMore && headerCreate),
    'áreas, estado ativo e criação permanecem visíveis nos dois temas', JSON.stringify(breakpoints));
  check(breakpoints.every(({ width, position }) => width < 900 ? position === 'fixed' : position === 'relative'),
    'dock e barra superior usam os breakpoints previstos', JSON.stringify(breakpoints));
  check(breakpoints.filter(({ width }) => width >= 900).every(({ areaCenterDelta }) => areaCenterDelta <= 40),
    'áreas ficam centralizadas no header web', JSON.stringify(breakpoints));
  check(breakpoints.filter(({ width }) => width < 900).every(({ navOpaque }) => navOpaque),
    'menu móvel tem fundo opaco nos temas claro e escuro', JSON.stringify(breakpoints));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}/?preview#config?section=areas-navigation`);
  const cycleAreaToggle = page.locator('[data-change="area"][data-area="cycle"]');
  const cycleMenuToggle = page.locator('#menu-visible-ciclo');
  const financeAreaToggle = page.locator('[data-change="area"][data-area="finances"]');
  const financeMenuToggle = page.locator('#menu-visible-financas');
  const habitsAreaToggle = page.locator('[data-change="area"][data-area="habits"]');
  const habitsMenuToggle = page.locator('#menu-visible-habitos');
  const cycleWasEnabled = await cycleAreaToggle.isChecked();
  const cycleWasVisible = await cycleMenuToggle.isChecked();
  let menuSettingsChanged = false;
  await cycleAreaToggle.check();
  await cycleMenuToggle.check();
  for (const toggle of [financeAreaToggle, financeMenuToggle, habitsAreaToggle, habitsMenuToggle]) {
    if (!await toggle.isChecked()) {
      await toggle.check();
      menuSettingsChanged = true;
    }
  }
  if (!cycleWasEnabled || !cycleWasVisible || menuSettingsChanged) {
    await page.getByText('Salvo nesta demonstração.').waitFor({ state: 'visible' });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  const cycleLink = page.locator('.app > .topbar .nav > a.nav-item[href="/ciclo"]');
  await cycleLink.waitFor({ state: 'visible' });
  check(await cycleLink.isVisible(), 'Ciclo ativo aparece como link direto na barra superior');
  let orderChanged = false;
  for (let moves = 0; moves < 5; moves++) {
    const moveUp = page.locator('#menu-move-up-habitos');
    if (!await moveUp.count()) break;
    await moveUp.click();
    orderChanged = true;
  }
  if (orderChanged) await page.getByText('Salvo nesta demonstração.').waitFor({ state: 'visible' });
  await page.setViewportSize({ width: 390, height: 844 });
  const mobilePrimaryLinks = await page.locator('.topbar .nav > a:not(.nav-enable-areas)').evaluateAll((links) => (
    links.map((link) => link.getAttribute('href'))
  ));
  check(mobilePrimaryLinks.join(',') === '/inicio,/planejar,/habitos,/financas,/ciclo',
    'dock móvel mantém todas as áreas na ordem escolhida');
  const mobileShownLinks = await page.locator('.topbar .nav > a:not(.nav-enable-areas):visible').evaluateAll((links) => (
    links.map((link) => link.getAttribute('href'))
  ));
  check(mobileShownLinks.join(',') === '/inicio,/planejar,/habitos,/financas,/ciclo',
    'dock móvel mostra as cinco áreas na ordem escolhida');
  check(!await page.locator('.topbar .nav .profile-menu-trigger').isVisible(),
    'dock móvel não tem o botão Mais quando todas as áreas cabem');
  await page.locator('.mobile-profile-menu .profile-menu-trigger').click();
  const profileMenu = page.locator('#profile-menu');
  check(await profileMenu.locator('a[href="/ajustes"]').isVisible(),
    'cabeçalho móvel mantém o acesso a Perfil e ajustes');
  check(await profileMenu.locator('.nav-overflow-group').count() === 0,
    'menu da conta não lista áreas, porque todas estão no dock');
  await page.keyboard.press('Escape');
  check(await page.locator('.profile-menu-control').getAttribute('open') === null,
    'Escape fecha o menu da conta');
  await cycleMenuToggle.uncheck();
  await page.waitForFunction(() => document.querySelectorAll('.topbar .nav > a:not(.nav-enable-areas)').length === 4);
  check(await page.locator('.topbar .nav > a:not(.nav-enable-areas):visible').count() === 4,
    'dock mostra as quatro áreas restantes quando Ciclo não está no menu');
  await cycleMenuToggle.check();
  await page.waitForFunction(() => document.querySelectorAll('.topbar .nav > a:not(.nav-enable-areas)').length === 5);
  await page.setViewportSize({ width: 1440, height: 900 });
  orderChanged = false;
  for (let moves = 0; moves < 5; moves++) {
    const moveDown = page.locator('#menu-move-down-habitos');
    if (!await moveDown.count()) break;
    await moveDown.click();
    orderChanged = true;
  }
  if (orderChanged) await page.getByText('Salvo nesta demonstração.').waitFor({ state: 'visible' });
  await page.waitForFunction(() => (
    [...document.querySelectorAll('.topbar .nav > a.nav-item')].map((link) => link.getAttribute('href')).join(',')
      === '/inicio,/planejar,/financas,/ciclo,/habitos'
  ));
  const desktopOrder = await page.locator('.topbar .nav > a.nav-item').evaluateAll((links) => links.map((link) => link.getAttribute('href')));
  await page.setViewportSize({ width: 390, height: 844 });
  const updatedMobileOrder = await page.locator('.topbar .nav > a.nav-item').evaluateAll((links) => links.map((link) => link.getAttribute('href')));
  check(desktopOrder.join(',') === updatedMobileOrder.join(','),
    'barra superior preserva a ordem configurada no dock', desktopOrder.join(', '));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(300);
  const headerAfterRouteChanges = [];
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
    headerAfterRouteChanges.push(await page.locator('.app > .topbar').evaluate((header) => {
      const bounds = header.getBoundingClientRect();
      return {
        position: getComputedStyle(header).position,
        top: bounds.top,
      };
    }));
  }
  check(headerAfterRouteChanges.every(({ position, top }) => position === 'sticky' && Math.abs(top) <= 1),
    'barra superior permanece no topo ao alternar entre telas', JSON.stringify(headerAfterRouteChanges));
  await page.locator('#plan-tab-lista').focus();
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => document.activeElement?.id === 'plan-tab-calendario');
  check(await page.locator('#plan-tab-calendario').getAttribute('aria-selected') === 'true'
    && await page.locator('#plan-panel').getAttribute('aria-labelledby') === 'plan-tab-calendario',
  'setas selecionam a visão de Planejar e mantêm o foco');
  await page.locator('.nav a[href="/financas"]').click();
  await page.locator('#fin-tab-resumo').focus();
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => document.activeElement?.id === 'fin-tab-lancamentos');
  check(await page.locator('#fin-panel').getAttribute('aria-labelledby') === 'fin-tab-lancamentos',
    'setas selecionam a seção de Finanças e mantêm o foco');
  await page.locator('#fin-view-lista').focus();
  await page.keyboard.press('End');
  await page.waitForFunction(() => document.activeElement?.id === 'fin-view-cal');
  check(await page.locator('#fin-view-cal').getAttribute('aria-selected') === 'true'
    && await page.locator('#fin-view-panel').getAttribute('aria-labelledby') === 'fin-view-cal',
  'teclado seleciona a visão de lançamentos');
  await page.locator('.profile-menu-trigger:visible').first().click();
  await page.locator('#profile-menu a[href="/ajustes"]').click();
  const settingsState = await page.locator('.settings-link[aria-current="page"]').evaluate((link) => ({
    background: getComputedStyle(link).backgroundColor,
    iconBackground: getComputedStyle(link.querySelector('.settings-link-icon')).backgroundColor,
    color: getComputedStyle(link).color,
    accent: getComputedStyle(link).getPropertyValue('--accent').trim(),
  }));
  check(settingsState.background === 'rgba(0, 0, 0, 0)' && settingsState.iconBackground !== 'rgba(0, 0, 0, 0)',
    'ajustes usa círculo no ícone sem fundo no item', JSON.stringify(settingsState));
  const searchTrigger = page.locator('.app > .topbar .global-search-trigger');
  check(await searchTrigger.count() === 0, 'busca não aparece no cabeçalho');
  await page.keyboard.press('Control+k');
  await page.waitForFunction(() => document.activeElement?.matches('#dlg input[data-dlg="query"]'));
  await page.locator('#dlg input[data-dlg="query"]').fill('termo sem correspondência 94735');
  check((await page.locator('#global-search-results').textContent()).includes('Tente outra palavra')
    && (await page.locator('#global-search-results').textContent()).includes('Áreas pesquisadas'),
  'busca sem resultados oferece sugestões e informa as áreas');
  await page.keyboard.press('Escape');
  check(await page.locator('#dlg').count() === 0, 'Esc fecha a busca aberta pelo atalho de teclado');
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press('/');
  await page.waitForFunction(() => document.activeElement?.matches('#dlg input[data-dlg="query"]'));
  await page.keyboard.type('/');
  check(await page.locator('#dlg input[data-dlg="query"]').inputValue() === '/',
    'barra continua abrindo a busca fora dos campos');
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 1280, height: 900 });
  check(await page.locator('.app > .topbar .mobile-refresh-trigger').count() === 0,
    'cabeçalho não mostra botão de recarga');
  check(await page.locator('.app > .topbar .header-actions').evaluate((actions) => parseFloat(getComputedStyle(actions).gap) >= 8),
    'ações do cabeçalho têm espaçamento confortável em desktop');
  await page.setViewportSize({ width: 320, height: 720 });
  check(await page.locator('.app > .topbar .mobile-refresh-trigger').count() === 0,
    'celular usa o gesto de puxar para atualizar em vez de um botão');
  check(await page.locator('.app > .topbar .global-search-trigger').count() === 0,
    'busca não aparece no celular');
  check(await page.locator('.app > .topbar .header-actions').evaluate((actions) => parseFloat(getComputedStyle(actions).gap) >= 4),
    'ações do cabeçalho mantêm espaçamento entre botões no celular');
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    'cabeçalho não causa overflow no celular');
  await page.evaluate(() => window.scrollTo(0, 0));
  const shortPull = await page.evaluate(() => {
    const target = document.querySelector('#main');
    const dispatch = (type, y, isTouching) => {
      const touch = new Touch({ identifier: 1, target, clientX: 120, clientY: y });
      target.dispatchEvent(new TouchEvent(type, {
        touches: isTouching ? [touch] : [],
        changedTouches: [touch],
        bubbles: true,
        cancelable: true,
      }));
    };
    dispatch('touchstart', 100, true);
    dispatch('touchmove', 145, true);
    const label = document.querySelector('.pull-refresh-label').textContent;
    dispatch('touchend', 145, false);
    return {
      label,
      cleared: document.querySelector('.pull-refresh-indicator').getAttribute('aria-hidden') === 'true',
    };
  });
  check(shortPull.label === 'Continue puxando para atualizar' && shortPull.cleared,
    'puxão curto mostra a orientação e não dispara atualização');
  const pullRefreshTime = await page.evaluate(() => performance.timeOrigin);
  await page.evaluate(() => {
    const target = document.querySelector('#main');
    const touch = (clientY) => new Touch({ identifier: 1, target, clientX: 120, clientY });
    const start = touch(100);
    target.dispatchEvent(new TouchEvent('touchstart', { touches: [start], changedTouches: [start], bubbles: true, cancelable: true }));
    const move = touch(220);
    target.dispatchEvent(new TouchEvent('touchmove', { touches: [move], changedTouches: [move], bubbles: true, cancelable: true }));
    target.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [move], bubbles: true, cancelable: true }));
  });
  await page.waitForFunction((previousTime) => performance.timeOrigin > previousTime, pullRefreshTime);
  check(await page.locator('.app > .topbar').count() === 1,
    'puxar do topo recarrega o app');
  check(errors.length === 0, 'sem erros no console', errors.slice(0, 3).join(' | '));

  await browser.close();
  process.exit(results.every(Boolean) ? 0 : 1);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
