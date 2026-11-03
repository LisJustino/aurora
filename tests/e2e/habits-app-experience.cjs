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
  check(await page.locator('.habit-empty').count() === 1, 'estado vazio usa uma orientação sem ação duplicada');
  check(await page.locator('.habit-today-head [data-action="habit-new"]').count() === 1, 'criação manual tem uma única ação principal');
  check(await page.locator('.habit-week-overview').count() === 0, 'sem hábitos, a revisão semanal não ocupa espaço');
  check(await page.locator('[data-habit-idea]:not([hidden])').count() === 4, 'prévia mostra quatro ideias');
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
  await showAll.click();
  check(await page.locator('[data-habit-idea]:not([hidden])').count() === totalIdeas
    && await showAll.getAttribute('aria-expanded') === 'true', 'ação expande todas as ideias e atualiza o estado acessível');
  await showAll.click();
  check(await page.locator('[data-habit-idea]:not([hidden])').count() === 4, 'lista de ideias pode ser recolhida');
  const quickFilter = page.locator('[data-action="habit-idea-tag-filter"][data-id="quick"]');
  await quickFilter.focus();
  await page.keyboard.press('Enter');
  const quickVisible = page.locator('[data-habit-idea]:not([hidden])');
  check(await quickFilter.getAttribute('aria-pressed') === 'true'
    && await quickVisible.count() > 0
    && await quickVisible.evaluateAll((ideas) => ideas.every((idea) => idea.dataset.tags.split(' ').includes('quick'))),
  'tag de duração filtra ideias e atualiza estado acessível');
  const movementFilter = page.locator('[data-action="habit-idea-filter"][data-id="movement"]');
  await movementFilter.click();
  const movementQuick = page.locator('[data-habit-idea]:not([hidden])');
  check(await movementFilter.getAttribute('aria-pressed') === 'true'
    && await movementQuick.count() > 0
    && await quickFilter.locator('span').textContent() === String(await movementQuick.count())
    && await movementQuick.evaluateAll((ideas) => ideas.every((idea) => (
      idea.closest('.habit-idea-section').querySelector('h3').textContent === 'Corpo e movimento'
      && idea.dataset.tags.split(' ').includes('quick')
    )))
    && await page.locator('[data-habit-idea-count]').textContent() === `${await movementQuick.count()} ideias encontradas`,
  'categoria e contexto podem ser combinados com contagem correspondente');
  await page.locator('[data-action="habit-idea-filter"][data-id="all"]').click();
  const noEquipmentFilter = page.locator('[data-action="habit-idea-tag-filter"][data-id="no-equipment"]');
  await noEquipmentFilter.click();
  check(await noEquipmentFilter.getAttribute('aria-pressed') === 'true'
    && await page.locator('[data-habit-idea]:not([hidden])').evaluateAll((ideas) => ideas.length > 0
      && ideas.every((idea) => idea.dataset.tags.split(' ').includes('no-equipment'))),
  'contexto sem equipamento filtra resultados');
  await page.locator('[data-input="habit-ideas"]').fill('sem equipamento');
  check(await page.locator('[data-habit-idea]:not([hidden])').evaluateAll((ideas) => ideas.length > 0
    && ideas.every((idea) => idea.dataset.tags.split(' ').includes('no-equipment'))),
  'busca pelo nome do contexto encontra somente ideias correspondentes');
  await page.locator('[data-input="habit-ideas"]').fill('');
  await page.locator('[data-action="habit-idea-tag-filter"][data-id="all"]').click();
  const featuredIdea = page.locator('[data-habit-idea][data-id="reading"]');
  const readingDescription = await featuredIdea.locator('.habit-idea-copy > small').textContent();
  await featuredIdea.click();
  check(await page.locator('.habit-idea-detail').textContent() === readingDescription,
    'personalização mostra a descrição completa da ideia');
  await page.locator('[data-action="dlg-close"]').last().click();
  check(await page.locator('.habit-row[data-habit-id]').count() === 0,
    'abrir personalização não grava a ideia');
  const search = page.locator('[data-input="habit-ideas"]');
  await search.fill('meditar');
  check(await page.locator('[data-habit-idea]:not([hidden])').count() === 1
    && await showAll.isHidden(), 'busca revela resultados sem impor o limite da prévia');
  await search.fill('');

  await page.locator('.habit-today-head [data-action="habit-new"]').click();
  await page.locator('#dlgform [data-dlg="name"]').fill('Alongar por cinco minutos');
  await page.locator('button[form="dlgform"][type="submit"]').click();
  const row = page.locator('.habit-row[data-habit-id]').first();
  await row.waitFor({ state: 'visible' });
  check(await row.locator('.habit-week').isVisible()
    && await row.locator('.habit-dot').count() === 7, 'semana fica visível no cartão sem abrir detalhes');
  check(await row.locator('.habit-more').evaluate((details) => !details.open), 'detalhes do hábito começam recolhidos');
  await row.locator('.habit-circle').click();
  check(await row.locator('.habit-circle').getAttribute('aria-pressed') === 'true', 'check-in principal pode ser concluído diretamente');
  check(await page.locator('#toast').getByText('Hábito marcado como concluído.').count() === 1, 'marcação de hábito oferece desfazer');
  await page.locator('#toast').getByRole('button', { name: 'Desfazer' }).click();
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
    }));
    check(!layout.overflow && layout.week.every(({ right, dots }) => (
      dots.length === 7 && dots.at(-1).right <= right + 1 && (width > 700 || dots.every(({ height }) => height >= 44))
    )), `sem overflow e com dias utilizáveis no viewport de ${width} px`, JSON.stringify(layout));
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const lightSurface = await page.locator('[data-habit-idea]:not([hidden])').first()
    .evaluate((idea) => getComputedStyle(idea).backgroundColor);
  await page.locator('#accessibility-trigger').click();
  await page.locator('#accessibility-mode-dark').click();
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
