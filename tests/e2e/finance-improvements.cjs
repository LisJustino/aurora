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

  await page.goto(`${BASE}/?preview#financas`);
  await page.getByRole('button', { name: 'Resumo', exact: true }).waitFor();
  const recent = await page.locator('.finance-recent').textContent();
  check(!recent.includes('Mercado do mês'), 'resumo não mistura lançamentos dos meses anteriores');
  check(await page.locator('.fh-row .finance-summary-stat').count() === 4, 'resumo mostra quatro indicadores');
  check(await page.locator('.finance-pending-summary > div').count() === 2, 'compromissos destacam totais a pagar e receber');
  check(await page.locator('.finance-trend-chart circle').count() === 7, 'gráfico mostra os últimos sete dias');
  await page.locator('.finance-fab').click();
  await page.locator('#quick-actions-menu').getByRole('button', { name: 'Despesa', exact: true }).click();
  await page.locator('#dlg [data-dlg="amount"]').fill('1,00');
  await page.locator('#dlg [data-dlg="desc"]').fill('Despesa futura de teste');
  const futureMonthDate = new Date();
  futureMonthDate.setDate(1);
  futureMonthDate.setMonth(futureMonthDate.getMonth() + 1);
  futureMonthDate.setDate(15);
  await page.locator('#dlg [data-dlg="date"]').fill(`${futureMonthDate.getFullYear()}-${String(futureMonthDate.getMonth() + 1).padStart(2, '0')}-${String(futureMonthDate.getDate()).padStart(2, '0')}`);
  await page.getByRole('button', { name: 'Adicionar', exact: true }).click();
  check(await page.locator('.finance-trend-empty').count() === 1, 'compromissos futuros não viram evolução de despesas realizadas');
  await page.locator('.mnav [data-n="0"]').click();
  await page.locator('.finance-trend-chart').waitFor();

  await page.locator('.finance-fab').click();
  const quickMenu = page.locator('#quick-actions-menu');
  await quickMenu.getByRole('button', { name: 'Despesa cartão', exact: true }).waitFor();
  check(await quickMenu.getByRole('button', { name: 'Transferência', exact: true }).count() === 1, 'ações rápidas oferecem transferência');
  check(await quickMenu.getByRole('button', { name: 'Receita', exact: true }).count() === 1, 'ações rápidas oferecem receita');
  check(await quickMenu.getByRole('button', { name: 'Despesa', exact: true }).count() === 1, 'ações rápidas oferecem despesa');
  await quickMenu.getByRole('button', { name: 'Despesa cartão', exact: true }).click();
  const selectedCard = await page.locator('#dlg [data-dlg="accountId"] option:checked').textContent();
  check(/cartão|crédito/i.test(selectedCard), 'despesa de cartão seleciona uma conta de crédito');
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.locator('.finance-fab').click();
  await quickMenu.getByRole('button', { name: 'Transferência', exact: true }).click();
  check(await page.locator('#dlg [data-dlg="toAccountId"]').count() === 1, 'atalho de transferência abre origem e destino');
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.locator('.finance-fab').click();
  await quickMenu.getByRole('button', { name: 'Receita', exact: true }).click();
  check(await page.locator('.finance-transaction-type button[data-k="in"]').getAttribute('aria-pressed') === 'true', 'atalho de receita abre o tipo correto');
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.locator('.finance-fab').click();
  await quickMenu.getByRole('button', { name: 'Despesa', exact: true }).click();
  await page.locator('#dlg [data-dlg="settledDate"]').waitFor();
  const recentAccountOptions = await page.locator('#dlg [data-dlg="accountId"] option').evaluateAll((options) => options.map((option) => option.value));
  const recentCategoryOptions = await page.locator('#dlg [data-dlg="category"] option').evaluateAll((options) => options.map((option) => option.value));
  if (recentAccountOptions.length > 1) {
    const selectedAccount = await page.locator('#dlg [data-dlg="accountId"]').inputValue();
    await page.locator('#dlg [data-dlg="accountId"]').selectOption(recentAccountOptions.find((value) => value !== selectedAccount));
  }
  if (recentCategoryOptions.length > 1) {
    const selectedCategory = await page.locator('#dlg [data-dlg="category"]').inputValue();
    await page.locator('#dlg [data-dlg="category"]').selectOption(recentCategoryOptions.find((value) => value !== selectedCategory));
  }
  const latestAccount = await page.locator('#dlg [data-dlg="accountId"]').inputValue();
  const latestCategory = await page.locator('#dlg [data-dlg="category"]').inputValue();
  check(await page.locator('#dlgform .finance-form-section').count() >= 3, 'formulário organiza campos em seções');
  const toggleLayout = await page.locator('#dlg .tx-settlement-toggle').evaluate((toggle) => {
    const checkbox = toggle.querySelector('input').getBoundingClientRect();
    const copy = toggle.querySelector('.tx-settlement-toggle-copy').getBoundingClientRect();
    return checkbox.right <= copy.left && Math.abs(checkbox.top - copy.top) < 4;
  });
  check(toggleLayout, 'checkbox de pagamento fica alinhado ao texto explicativo');
  const settlementLayout = await page.locator('#dlg [data-dlg="settledDate"]').evaluate((input) => {
    const field = input.closest('.f');
    const helper = field.nextElementSibling;
    return getComputedStyle(field).gridColumn === '1 / -1'
      && getComputedStyle(helper).gridColumn === '1 / -1'
      && helper.getBoundingClientRect().top >= field.getBoundingClientRect().bottom;
  });
  check(settlementLayout, 'data de pagamento e explicação ocupam linhas próprias em celular');
  await page.setViewportSize({ width: 560, height: 800 });
  const desktopToggleLayout = await page.locator('#dlg .tx-settlement-toggle').evaluate((toggle) => {
    const checkbox = toggle.querySelector('input').getBoundingClientRect();
    const copy = toggle.querySelector('.tx-settlement-toggle-copy').getBoundingClientRect();
    return checkbox.right <= copy.left && Math.abs(checkbox.top - copy.top) < 4;
  });
  check(desktopToggleLayout, 'checkbox de pagamento fica alinhado ao texto em desktop');
  const desktopSettlementLayout = await page.locator('#dlg [data-dlg="settledDate"]').evaluate((input) => {
    const field = input.closest('.f');
    const helper = field.nextElementSibling;
    return getComputedStyle(field).gridColumn === '1 / -1'
      && getComputedStyle(helper).gridColumn === '1 / -1'
      && helper.getBoundingClientRect().top >= field.getBoundingClientRect().bottom;
  });
  check(desktopSettlementLayout, 'data de pagamento e explicação ocupam linhas próprias em desktop');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#dlg [data-dlg="amount"]').fill('9,90');
  await page.locator('#dlg [data-dlg="desc"]').fill('iCloud');
  await page.locator('#dlg [data-dlg="repeat"]').selectOption('fixed');
  await page.getByRole('button', { name: 'Adicionar', exact: true }).click();
  const recentFixedCount = await page.locator('.finance-recent .ttl').filter({ hasText: /^icloud$/i }).count();
  check(recentFixedCount === 1, 'fixa criada aparece uma vez no resumo, sem meses futuros', String(recentFixedCount));
  await page.locator('.finance-fab').click();
  await page.locator('#quick-actions-menu').getByRole('button', { name: 'Despesa', exact: true }).click();
  check(await page.locator('#dlg [data-dlg="accountId"]').inputValue() === latestAccount, 'novo lançamento reutiliza a conta usada por último');
  check(await page.locator('#dlg [data-dlg="category"]').inputValue() === latestCategory, 'novo lançamento reutiliza a categoria usada por último');
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();

  await page.getByRole('button', { name: 'Orçamento', exact: true }).click();
  await page.getByRole('button', { name: 'Gerenciar categorias' }).click();
  await page.locator('.category-manager-item [data-action="category-edit"]').first().click();
  await page.locator('#dlg [data-dlg="name"]').fill('Alimentação personalizada');
  await page.locator('#dlg [data-dlg="icon"]').selectOption('car');
  await page.locator('#dlg [data-dlg="color"]').fill('#123abc');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  check(await page.locator('.category-manager-item').first().textContent().then((text) => text.includes('Alimentação personalizada')), 'categoria pode ter nome, ícone e cor personalizados');
  check(await page.locator('.category-manager-item').first().locator('.ci').getAttribute('style').then((style) => style.includes('#123abc')), 'cor personalizada aparece na categoria');

  const expenseCategories = page.locator('.category-manager-group').first();
  await expenseCategories.getByRole('button', { name: 'Adicionar' }).click();
  await page.locator('#dlg [data-dlg="parent"]').selectOption({ label: 'Moradia' });
  await page.locator('#dlg [data-dlg="name"]').fill('Condomínio');
  await page.locator('#dlg [data-dlg="icon"]').selectOption('home');
  await page.locator('#dlg [data-dlg="color"]').fill('#22aa88');
  await page.getByRole('button', { name: 'Adicionar', exact: true }).click();
  const subcategory = page.locator('.category-manager-subcategories li').filter({ hasText: 'Moradia > Condomínio' });
  check(await subcategory.count() === 1, 'subcategoria personalizada é adicionada ao grupo escolhido');
  check(await subcategory.locator('.ci').getAttribute('style').then((style) => style.includes('#22aa88')), 'subcategoria mantém sua própria cor');
  await page.locator('#dlg [data-action="dlg-close"]').last().click();
  check(await page.locator('.budget-list').getByText('Alimentação personalizada').count() === 1, 'renomear categoria atualiza os limites financeiros');
  await page.getByRole('button', { name: 'Resumo', exact: true }).click();
  const renamedTransaction = page.locator('.finance-recent .fr').filter({ hasText: 'Mercado' });
  check(await renamedTransaction.locator('.meta2').textContent().then((text) => text.includes('Alimentação personalizada')), 'renomear categoria atualiza lançamentos existentes');
  check(await renamedTransaction.locator('.ci').getAttribute('style').then((style) => style.includes('#123abc')), 'ícone do lançamento usa a cor personalizada');

  await page.getByRole('button', { name: 'Despesa', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Receita', exact: true }).click();
  const date = new Date();
  date.setDate(date.getDate() + 1);
  const futureDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  await page.locator('#dlg [data-dlg="date"]').fill(futureDate);
  check(!await page.locator('#dlg [data-dlg="paid"]').isChecked(), 'data diferente de hoje desmarca recebimento');
  check(await page.locator('#dlg [data-dlg="settledDate"]').count() === 0, 'data de liquidação some enquanto o lançamento está pendente');
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await page.getByRole('button', { name: 'Descartar alterações' }).click();

  await page.getByRole('button', { name: 'Lançamentos', exact: true }).click();
  await page.waitForFunction(() => document.activeElement?.dataset?.t === 'lancamentos');
  check(await page.evaluate(() => document.activeElement?.dataset?.t === 'lancamentos'), 'seção escolhida permanece focada');
  await page.locator('.finance-fab').click();
  await page.locator('#quick-actions-menu').getByRole('button', { name: 'Despesa', exact: true }).click();
  await page.waitForTimeout(600);
  const positionsBefore = await page.locator('.finance-transaction-type button').evaluateAll((buttons) => {
    const dialog = document.querySelector('#dlg .dlg').getBoundingClientRect();
    return buttons.map((button) => {
      const { x, y } = button.getBoundingClientRect();
      return { x: x - dialog.x, y: y - dialog.y };
    });
  });
  await page.getByRole('button', { name: 'Transferência', exact: true }).click();
  const positionsAfter = await page.locator('.finance-transaction-type button').evaluateAll((buttons) => {
    const dialog = document.querySelector('#dlg .dlg').getBoundingClientRect();
    return buttons.map((button) => {
      const { x, y } = button.getBoundingClientRect();
      return { x: x - dialog.x, y: y - dialog.y };
    });
  });
  const stableTypePositions = positionsBefore.every((position, index) => (
    position.x === positionsAfter[index].x && Math.abs(position.y - positionsAfter[index].y) < 2
  ));
  check(stableTypePositions, 'tipos de lançamento mantêm posição ao selecionar transferência', JSON.stringify({ positionsBefore, positionsAfter }));
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await page.getByRole('button', { name: 'Descartar alterações' }).click();

  await page.getByRole('button', { name: 'Resumo', exact: true }).click();
  await page.setViewportSize({ width: 320, height: 720 });
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Finanças não tem overflow horizontal em 320 px');
  await page.setViewportSize({ width: 1366, height: 768 });
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Finanças não tem overflow horizontal em desktop');
  check(await page.locator('.finance-recent .list').evaluate((list) => getComputedStyle(list).gridTemplateColumns.split(' ').length === 2), 'últimos lançamentos organizados em duas colunas no desktop');
  check(errors.length === 0, 'sem erros no console', errors.slice(0, 3).join(' | '));

  await browser.close();
  process.exit(results.every(Boolean) ? 0 : 1);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
