const { chromium } = require('playwright');

const BASE = process.argv[2] || 'http://127.0.0.1:5173';
const results = [];
const check = (passed, name, detail = '') => {
  results.push(passed);
  console.log(`${passed ? 'OK   ' : 'FALHA'} — ${name}${detail ? ` (${detail})` : ''}`);
};

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto(`${BASE}/?preview#planejar`);

  await page.locator('.planning-overview').waitFor({ state: 'visible' });
  check(await page.locator('.planning-overview-stat, .planning-shortcuts').count() === 0,
    'Planejar não duplica filtros nem seletores de visualização');
  check(await page.locator('[data-change="plan-view"]').count() === 1,
    'Planejar mantém um seletor único para os modos de visualização');
  const upcomingFilter = page.locator('[aria-label="Filtrar tarefas"] [data-f="proximas"]');
  await upcomingFilter.click();
  const upcomingChip = page.locator('[aria-label="Filtrar tarefas"] [data-f="proximas"]');
  check(await upcomingChip.getAttribute('aria-pressed') === 'true',
    'filtro dos próximos sete dias ativa a lista correspondente');
  const upcomingResults = await page.locator('#task-results .task').allInnerTexts();
  check(upcomingResults.some((text) => text.includes('Organizar documentos'))
    && upcomingResults.every((text) => !text.includes('Marcar consulta de rotina')),
  'filtro de próximos dias mantém tarefas futuras e exclui as atrasadas');
  await page.locator('[aria-label="Filtrar tarefas"] [data-f="caixa"]').click();
  check(await page.locator('[aria-label="Filtrar tarefas"] [data-f="caixa"]').getAttribute('aria-pressed') === 'true',
    'filtro de tarefas sem data permanece disponível na lista');
  await page.locator('[aria-label="Filtrar tarefas"] [data-f="pendentes"]').click();
  check(await page.locator('[aria-label="Filtrar tarefas"] [data-f="pendentes"]').getAttribute('aria-pressed') === 'true',
    'filtro de pendentes retorna à lista de tarefas abertas');
  check(await page.locator('.planning-quick-entry').count() === 0, 'Planejar não oferece tarefa rápida');
  check(await page.getByText('Plano por etapas', { exact: true }).count() === 0, 'Planejar não oferece o fluxo por etapas');
  await page.getByRole('button', { name: 'Nova tarefa' }).first().click();
  const dialog = page.locator('#dlg [role="dialog"]');
  await dialog.waitFor({ state: 'visible' });
  check(await page.locator('#dlg input[type="time"]').count() === 1, 'formulário completo inclui o campo de horário');
  check(await page.evaluate(() => {
    const active = document.activeElement;
    return !(active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement);
  }), 'abrir modal não foca um campo nem abre o teclado');
  const timeBox = await page.locator('#dlg input[type="time"]').boundingBox();
  check(Boolean(timeBox && timeBox.x >= 0 && timeBox.x + timeBox.width <= 390), 'campo de horário cabe na largura mobile');
  check(await page.locator('#dlg .task-icon-picker input[type="radio"]').count() >= 20, 'formulário oferece uma variedade de ícones');
  await page.locator('#dlg button[form="dlgform"]').click();
  check(await page.locator('#dlg [data-dlg="title"]').getAttribute('aria-invalid') === 'true'
    && await page.locator('#dlg [role="alert"]').innerText() === 'Escreva um título.',
  'título vazio recebe erro inline');
  await page.locator('#dlg [data-dlg="title"]').fill('Revisar leitura');
  await page.locator('#dlg [data-dlg="repeat"]').selectOption('day');
  await page.locator('#dlg button[form="dlgform"]').click();
  check(await page.locator('#dlg [data-dlg="due"]').getAttribute('aria-invalid') === 'true'
    && await page.locator('#dlg [role="alert"]').innerText() === 'Defina um prazo para repetir ou ter horário.',
  'repetição exige prazo explícito');
  await page.locator('#dlg [data-dlg="repeat"]').selectOption('none');
  await page.locator('#dlg [data-dlg="time"]').fill('10:30');
  await page.locator('#dlg button[form="dlgform"]').click();
  check(await page.locator('#dlg [data-dlg="due"]').getAttribute('aria-invalid') === 'true',
    'horário exige prazo explícito');
  await page.locator('#dlg [data-dlg="due"]').fill('2026-11-15');
  await page.getByRole('radio', { name: 'Estudos' }).check();
  await page.locator('#dlg button[form="dlgform"]').click();
  const createdTask = page.locator('.task').filter({ hasText: 'Revisar leitura' });
  check(await createdTask.locator('.task-title-icon').count() === 1, 'ícone escolhido aparece na tarefa criada');
  await createdTask.locator('.tt[data-action="edit-task"]').click();
  check(await page.locator('#dlg [data-dlg="icon"][value="book"]').isChecked(), 'ícone permanece selecionado ao editar');
  await page.locator('#dlg [data-action="dlg-close"]').first().click();
  await page.locator('[data-change="plan-view"]').selectOption('calendario');
  await page.locator('[data-action="tcal-month"][data-n="1"]').click();
  const calendarDay = page.locator('[data-action="tcal-day"]').first();
  const calendarDate = await calendarDay.getAttribute('data-d');
  await calendarDay.click();
  const calendarEmpty = page.locator('.empty[role="status"]').filter({ hasText: 'Nada marcado para este dia.' });
  await calendarEmpty.getByRole('button', { name: 'Adicionar tarefa neste dia' }).click();
  check(await page.locator('#dlg [data-dlg="due"]').inputValue() === calendarDate, 'ação do calendário pré-seleciona o dia vazio');
  await page.locator('#dlg [data-action="dlg-close"]').first().click();
  await page.locator('[data-change="plan-view"]').selectOption('semana');
  const weekAction = page.locator('.week-day .empty[role="status"] [data-action="week-add"]').first();
  const weekDate = await weekAction.getAttribute('data-d');
  await weekAction.click();
  check(await page.locator('#dlg [data-dlg="due"]').inputValue() === weekDate, 'ação da semana pré-seleciona o dia vazio');
  await page.locator('#dlg [data-action="dlg-close"]').first().click();
  await page.setViewportSize({ width: 320, height: 568 });
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Planejar não tem overflow horizontal em 320 px');
  check(await page.locator('.header-actions .iconbtn:visible').evaluateAll((buttons) => buttons.every((button) => {
    const rect = button.getBoundingClientRect();
    return rect.width >= 44 && rect.height >= 44;
  })), 'botões visíveis do cabeçalho mantêm alvo de 44 px');
  check(errors.length === 0, 'sem erros no console', errors.slice(0, 3).join(' | '));

  await context.close();
  await browser.close();
  process.exit(results.every(Boolean) ? 0 : 1);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
