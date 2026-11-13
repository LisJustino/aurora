const { chromium } = require('playwright');

const BASE = process.argv[2] || 'http://127.0.0.1:5173';
const results = [];
const check = (passed, name, detail = '') => {
  results.push(passed);
  console.log(`${passed ? 'OK   ' : 'FALHA'} — ${name}${detail ? ` (${detail})` : ''}`);
};

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.goto(`${BASE}/?preview#habitos`);
  await page.locator('.habit-today').waitFor({ state: 'visible' });
  check(await page.locator('.habit-today .empty').count() === 1, 'estado vazio usa uma orientação sem ação duplicada');
  check(await page.locator('.habit-today [data-action="habit-new"]').count() === 1, 'criação manual tem uma única ação principal');
  check(await page.locator('.habit-ideas').getAttribute('open') === null
    && await page.locator('[data-habit-idea]:visible').count() === 0,
  'ideias de hábitos começam recolhidas');
  await page.locator('.habit-ideas > summary').click();
  await page.locator('.habit-today .empty [data-action="habit-new"]').click();
  await page.locator('#dlg button[form="dlgform"][type="submit"]').click();
  check(await page.locator('#dlg [data-dlg="name"]').getAttribute('aria-invalid') === 'true', 'nome vazio do hábito recebe erro inline');
  await page.locator('#dlg [data-dlg="name"]').fill('Leitura de teste');
  for (const day of await page.locator('#dlg [name="days"]').all()) await day.uncheck();
  await page.locator('#dlg button[form="dlgform"][type="submit"]').click();
  check(await page.locator('#dlg [name="days"]').first().getAttribute('aria-invalid') === 'true'
    && await page.locator('#dlg .habit-schedule [role="alert"]').count() === 1, 'dias vazios recebem erro inline');
  await page.locator('#dlg [name="days"]').last().check();
  check(await page.locator('#dlg .habit-schedule [role="alert"]').count() === 0, 'selecionar outro dia remove o erro');
  await page.locator('#dlg [data-action="dlg-close"]').first().click();
  if (await page.locator('#dlg [data-action="dlg-discard"]').count()) await page.locator('#dlg [data-action="dlg-discard"]').click();
  await page.locator('[data-action="habit-idea"][data-id="water"]').click();
  await page.locator('#dlg [data-dlg="waterGoalMl"]').fill('');
  await page.locator('#dlg button[form="dlgform"][type="submit"]').click();
  check(await page.locator('#dlg [data-dlg="waterGoalMl"]').getAttribute('aria-invalid') === 'true',
    'meta de água vazia continua inválida');
  await page.locator('#dlg [data-action="dlg-close"]').first().click();
  if (await page.locator('#dlg [data-action="dlg-discard"]').count()) await page.locator('#dlg [data-action="dlg-discard"]').click();
  check(await page.locator('.habit-week-overview').count() === 0, 'sem hábitos, a revisão semanal não ocupa espaço');
  check(await page.locator('[data-habit-idea]:not([hidden])').count() === 4, 'prévia mostra quatro ideias');
  check(await page.locator('.habit-ideas summary b').textContent() === 'Escolha seus primeiros hábitos'
    && await page.locator('.habit-idea-tools').isHidden()
    && await page.locator('.habit-idea-categories').evaluate((catalog) => catalog.classList.contains('is-preview'))
    && await page.locator('.habit-idea-section h3:visible, .habit-idea-tags:visible').count() === 0,
  'primeira escolha destaca as ideias sem expor filtros e categorias');
  const featured = await page.locator('[data-habit-idea][data-preview="false"]').evaluateAll((ideas) => ideas.map((idea) => ({
    id: idea.dataset.id,
    category: idea.closest('.habit-idea-section').querySelector('h3').textContent,
  })));
  check(featured.map(({ id }) => id).join(',') === 'water,stretch,reading,fruit'
    && new Set(featured.map(({ category }) => category)).size === 4,
  'prévia destaca quatro categorias distintas', JSON.stringify(featured));
  check(await page.locator('.habit-idea-copy > small').first().evaluate((description) => getComputedStyle(description).webkitLineClamp) === '2',
    'descrições dos cartões são resumidas visualmente');
  const showAll = page.locator('[data-action="habit-ideas-expand"]');
  const totalIdeas = await page.locator('[data-habit-idea]').count();
  check(totalIdeas === 100, 'catálogo completo mostra exatamente 100 ideias');
  await showAll.click();
  check(await page.locator('[data-habit-idea]:not([hidden])').count() === totalIdeas
    && await page.locator('.habit-idea-tools').isVisible()
    && await showAll.getAttribute('aria-expanded') === 'true',
  'explorar o catálogo revela todas as ideias, a busca e os filtros');
  check(await page.locator('.habit-idea-search input').count() === 1,
    'catálogo oferece busca por nome e descrição');
  const ideaSearch = page.locator('.habit-idea-search input');
  await ideaSearch.fill('idioma');
  check(await page.locator('[data-habit-idea]:not([hidden])').count() > 0
    && await page.locator('[data-habit-idea]:not([hidden])').evaluateAll((ideas) => (
      ideas.every((idea) => `${idea.querySelector('b').textContent} ${idea.querySelector('small').textContent}`.toLocaleLowerCase().includes('idioma'))
    )), 'busca filtra ideias pelo texto no catálogo');
  await ideaSearch.fill('');
  await showAll.click();
  check(await page.locator('[data-habit-idea]:not([hidden])').count() === 4
    && await page.locator('.habit-idea-tools').isHidden(),
  'lista de ideias pode ser recolhida e os filtros voltam a ocultar');
  await showAll.click();
  await page.locator('.habit-idea-tools').waitFor({ state: 'visible' });
  const contextFilter = page.getByRole('combobox', { name: 'Contexto das ideias' });
  await contextFilter.focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('p');
  await page.keyboard.press('Enter');
  const quickVisible = page.locator('[data-habit-idea]:not([hidden])');
  check(await page.locator('select[data-change="habit-idea-context"]').inputValue() === 'quick'
    && await quickVisible.count() > 0
    && await quickVisible.evaluateAll((ideas) => ideas.every((idea) => idea.dataset.tags.split(' ').includes('quick'))),
  'seletor de contexto funciona pelo teclado e filtra ideias');
  const categoryFilter = page.getByRole('combobox', { name: 'Categoria das ideias' });
  await categoryFilter.focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  const movementQuick = page.locator('[data-habit-idea]:not([hidden])');
  check(await page.locator('select[data-change="habit-idea-category"]').inputValue() === 'movement'
    && await movementQuick.count() > 0
    && await movementQuick.evaluateAll((ideas) => ideas.every((idea) => (
      idea.closest('.habit-idea-section').querySelector('h3').textContent === 'Corpo e movimento'
      && idea.dataset.tags.split(' ').includes('quick')
    )))
    && await page.locator('[data-habit-idea-count]').textContent() === `${await movementQuick.count()} ideias encontradas`,
  'categoria e contexto podem ser combinados com contagem correspondente');
  await categoryFilter.focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Home');
  await page.keyboard.press('Enter');
  await contextFilter.focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  check(await page.locator('select[data-change="habit-idea-context"]').inputValue() === 'no-equipment'
    && await page.locator('[data-habit-idea]:not([hidden])').evaluateAll((ideas) => ideas.length > 0
      && ideas.every((idea) => idea.dataset.tags.split(' ').includes('no-equipment'))),
  'contexto sem equipamento filtra resultados');
  await page.locator('[data-action="habit-ideas-clear"]').click();
  check(await page.locator('select[data-change="habit-idea-category"]').inputValue() === 'all'
    && await page.locator('select[data-change="habit-idea-context"]').inputValue() === 'all'
    && await page.locator('[data-action="habit-ideas-clear"]').isHidden()
    && await page.locator('[data-habit-idea]:not([hidden])').count() === totalIdeas,
  'ação limpar filtros restaura os seletores e o catálogo');
  await showAll.click();
  check(await page.locator('[data-habit-idea]:not([hidden])').count() === 4,
    'prévia inicial continua disponível após recolher o catálogo');
  const featuredIdea = page.locator('[data-habit-idea][data-id="reading"]');
  const readingDescription = await featuredIdea.locator('.habit-idea-copy > small').textContent();
  await featuredIdea.click();
  check(await page.locator('.habit-idea-detail').textContent() === readingDescription,
    'personalização mostra a descrição completa da ideia');
  await page.locator('[data-action="dlg-close"]').last().click();
  check(await page.locator('.habit-row[data-habit-id]').count() === 0,
    'abrir personalização não grava a ideia');
  await page.locator('.habit-today [data-action="habit-new"]').click();
  await page.locator('#dlgform [data-dlg="name"]').fill('Alongar por cinco minutos');
  await page.locator('#dlgform [data-dlg="remind"]').fill('09:00');
  await page.locator('button[form="dlgform"][type="submit"]').click();
  const row = page.locator('.habit-row[data-habit-id]').first();
  await row.waitFor({ state: 'visible' });
  check(await row.locator('.habit-week').isVisible()
    && await row.locator('.habit-dot').count() === 7, 'semana fica visível no cartão sem abrir detalhes');
  check(await row.locator('.habit-more').evaluate((details) => !details.open), 'detalhes do hábito começam recolhidos');
  const reminderNote = page.locator('.habit-reminder-note');
  check(await reminderNote.getByRole('switch', { name: 'Avisos fora do app' }).count() === 1
    && await reminderNote.locator('summary').count() === 0,
  'controle de notificações apresenta o interruptor sem explicações extensas');
  await row.locator('.habit-circle').click();
  check(await row.locator('.habit-circle').getAttribute('aria-pressed') === 'true', 'check-in principal pode ser concluído diretamente');
  check(await row.locator('.habit-more > summary .habit-streak').textContent() === 'Sequência: 1 dia programado',
    'sequência individual fica visível sem abrir os detalhes');
  check(await page.getByRole('status').filter({ hasText: 'Dia concluído!' }).count() === 1,
    'concluir o último hábito do dia mostra o estado de dia concluído');
  check(await page.locator('#toast').getByText('Hábito marcado como concluído.').count() === 1, 'marcação de hábito oferece desfazer');
  await page.locator('#toast').getByRole('button', { name: 'Desfazer' }).click();
  check(await page.locator('.habit-day-complete').count() === 0,
    'desfazer a última marcação remove o estado de dia concluído');
  check(await row.locator('.habit-streak').count() === 0, 'desfazer o check-in atualiza a sequência');
  const undoneHabitState = await row.locator('.habit-circle').evaluate((button) => ({
    pressed: button.getAttribute('aria-pressed'),
    action: button.dataset.action,
    text: button.textContent.trim(),
  }));
  check(undoneHabitState.pressed === 'false', 'desfazer remove a marcação do hábito', JSON.stringify(undoneHabitState));
  await row.locator('.habit-more > summary').click();
  check(await row.locator('.habit-management').isVisible()
    && await row.locator('.habit-management').evaluate((details) => !details.open), 'gerenciamento fica agrupado e recolhido');
  await row.locator('.habit-management > summary').click();
  check(await row.getByRole('button', { name: 'Editar' }).isVisible(), 'ações do hábito continuam disponíveis ao expandir gerenciamento');

  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    const layout = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > innerWidth,
      week: [...document.querySelectorAll('.habit-week')].map((week) => ({
        right: week.getBoundingClientRect().right,
        dots: [...week.querySelectorAll('.habit-dot')].map((dot) => {
          const rect = dot.getBoundingClientRect();
          return { right: rect.right, height: rect.height };
        }),
      })),
      filters: document.querySelector('.habit-idea-filter-grid')?.getBoundingClientRect(),
      filterColumns: document.querySelector('.habit-idea-filter-grid')
        ? getComputedStyle(document.querySelector('.habit-idea-filter-grid')).gridTemplateColumns.split(' ').length
        : 0,
    }));
    check(!layout.overflow && layout.week.every(({ right, dots }) => (
      dots.length === 7 && dots.at(-1).right <= right + 1 && (width > 700 || dots.every(({ height }) => height >= 44))
    )) && layout.filters?.right <= width + 1
      && layout.filterColumns === (width <= 520 ? 1 : 2),
    `sem overflow e filtros adaptados ao viewport de ${width} px`, JSON.stringify(layout));
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const lightSurface = await page.locator('[data-habit-idea]:not([hidden])').first()
    .evaluate((idea) => getComputedStyle(idea).backgroundColor);
  await page.evaluate(() => { location.hash = 'config?section=personalization'; });
  await page.locator('#personalization-mode-dark').click();
  await page.evaluate(() => { location.hash = 'habitos'; });
  await page.locator('[data-habit-idea]:not([hidden])').first().waitFor();
  const darkLayout = await page.evaluate(() => ({
    theme: document.documentElement.dataset.theme,
    overflow: document.documentElement.scrollWidth > innerWidth,
    surface: getComputedStyle(document.querySelector('[data-habit-idea]:not([hidden])')).backgroundColor,
  }));
  check(darkLayout.theme === 'dark' && !darkLayout.overflow && darkLayout.surface !== lightSurface,
    'cartões e filtros permanecem utilizáveis em tema escuro', JSON.stringify(darkLayout));
  check(errors.length === 0, 'sem erros no console', errors.slice(0, 3).join(' | '));

  await browser.close();
  process.exit(results.every(Boolean) ? 0 : 1);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
