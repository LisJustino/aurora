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
  const selectAccount = async (accountId) => {
    const select = page.locator('#dlg [data-dlg="accountId"]');
    const options = await select.locator('option').evaluateAll((items) => items.map((option) => ({
      value: option.value,
      label: option.textContent.trim(),
    })));
    const optionName = options.find((option) => option.value === accountId)?.label;
    if (!optionName) throw new Error(`A conta ${accountId} não está disponível no formulário: ${JSON.stringify(options)}`);
    await page.getByRole('combobox', { name: 'Conta', exact: true }).click();
    await page.getByRole('option', { name: optionName, exact: true }).click();
  };

  await page.goto(`${BASE}/?preview#financas`);
  await page.getByRole('button', { name: 'Resumo', exact: true }).waitFor();
  check(await page.evaluate(() => {
    const nav = document.querySelector('.topbar .nav').getBoundingClientRect();
    const fab = document.querySelector('.finance-fab');
    const fabBounds = fab.getBoundingClientRect();
    const fabBottom = parseFloat(getComputedStyle(fab).bottom);
    return Math.abs(nav.bottom - innerHeight) <= 1
      && Math.abs(fabBounds.bottom - (innerHeight - fabBottom)) <= 1
      && fabBounds.bottom <= nav.top - 12;
  }), 'dock fica no rodapé sem cobrir a ação fixa de lançamento');
  const recent = await page.locator('.finance-recent').textContent();
  const selectedMonth = await page.locator('.mnav .mlabel').textContent();
  check(!recent.includes('Mercado do mês'), 'resumo não mistura lançamentos dos meses anteriores');
  check(await page.locator('.fh-row .finance-summary-stat').count() === 4, 'resumo mostra quatro indicadores');
  check(await page.locator('.finance-month-snapshot').count() === 1
    && await page.locator('.fin-hero .finance-summary-stat').count() === 0, 'saldo e indicadores mensais aparecem em blocos separados');
  check(await page.locator('.fh-row .finance-flow-track').count() === 2, 'resumo compara visualmente receitas e despesas');
  check(await page.locator('.finance-month-close').count() === 1
    && await page.locator('.finance-close-stats > div').count() === 6,
  'fechamento mensal resume recebidos, pagos, pendências, fixas e cartões');
  check((await page.locator('.finance-month-close').textContent()).includes('Maior categoria de despesa')
    && (await page.locator('.finance-month-close').textContent()).includes('pagamento da fatura é uma transferência'),
  'fechamento identifica atenção por categoria e explica o tratamento do cartão');
  await page.locator('.finance-month-close').getByRole('button', { name: 'Conferir pendências' }).click();
  check(await page.locator('.scroll-x button[data-action="fin-filter"][data-f="pendentes"]').getAttribute('aria-pressed') === 'true',
    'fechamento abre diretamente as pendências do mês');
  check(await page.locator('.mnav .mlabel').textContent() === selectedMonth, 'atalho do fechamento preserva o mês selecionado');
  await page.locator('.fin-section-option[data-t="resumo"]').click();
  await page.getByRole('button', { name: 'Ver receitas lançadas no mês' }).click();
  const revenueRows = await page.locator('#tx-results .fr').evaluateAll((rows) => rows.map((row) => row.querySelector('.amt')?.classList.contains('in') ?? false));
  check(await page.locator('.fin-section-option[data-t="lancamentos"]').getAttribute('aria-pressed') === 'true', 'indicador de receitas abre Lançamentos');
  check(revenueRows.length > 0 && revenueRows.every(Boolean), 'indicador de receitas filtra apenas receitas do mês');
  check(await page.locator('.mnav .mlabel').textContent() === selectedMonth, 'atalho de receitas preserva o mês selecionado');
  await page.locator('.fin-section-option[data-t="resumo"]').click();
  for (const [label, expectedFilter] of [
    ['Ver despesas lançadas no mês', 'out'],
    ['Ver lançamentos do mês para conferir o resultado', 'todos'],
    ['Ver lançamentos pendentes do mês', 'pendentes'],
  ]) {
    await page.getByRole('button', { name: label }).click();
    check(await page.locator(`.scroll-x button[data-action="fin-filter"][data-f="${expectedFilter}"]`).getAttribute('aria-pressed') === 'true', `${label} aplica filtro ${expectedFilter}`);
    check(await page.locator('.mnav .mlabel').textContent() === selectedMonth, `${label} preserva o mês selecionado`);
    await page.locator('.fin-section-option[data-t="resumo"]').click();
  }
  check(await page.locator('.finance-pending-summary > div').count() === 2, 'compromissos destacam totais a pagar e receber');
  check(await page.locator('.finance-trend-chart circle').count() === 7, 'gráfico mostra os últimos sete dias');
  await page.locator('.finance-fab').click();
  await page.locator('#quick-actions-menu').getByRole('button', { name: 'Despesa', exact: true }).click();
  check(await page.evaluate(() => (
    getComputedStyle(document.documentElement).backgroundColor
      === getComputedStyle(document.body).backgroundColor
  )), 'fundo do documento permanece aplicado enquanto a modal está aberta');
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
  await page.locator('#quick-actions-menu').getByRole('button', { name: 'Despesa', exact: true }).click();
  await page.locator('#dlg [data-dlg="amount"]').fill('10,01');
  await page.locator('#dlg [data-dlg="desc"]').fill('Série parcelada de teste');
  const nonCreditAccount = await page.locator('#dlg [data-dlg="accountId"] option').evaluateAll((options) => (
    options.find((option) => !/cartão|crédito/i.test(option.textContent))?.value
  ));
  await selectAccount(nonCreditAccount);
  const installmentDate = new Date();
  installmentDate.setDate(1);
  installmentDate.setMonth(installmentDate.getMonth() + 2);
  installmentDate.setDate(new Date(installmentDate.getFullYear(), installmentDate.getMonth() + 1, 0).getDate());
  const currentInstallmentDate = `${installmentDate.getFullYear()}-${String(installmentDate.getMonth() + 1).padStart(2, '0')}-${String(installmentDate.getDate()).padStart(2, '0')}`;
  await page.locator('#dlg [data-dlg="date"]').fill(currentInstallmentDate);
  await page.locator('#dlg [data-dlg="repeat"]').selectOption('parcel');
  check(await page.locator('#dlg [data-dlg="currentInstallment"]').count() === 1, 'parcelamento permite informar a parcela atual');
  check(await page.locator('#dlg [data-dlg="times"]').getAttribute('max') === '60', 'parcelamento mantém limite de 60 parcelas');
  check(await page.locator('#dlg [data-dlg="interest"]').count() === 1, 'parcelamento permite informar juros da parcela atual');
  await page.locator('#dlg [data-dlg="interest"]').fill('0,10');
  await page.locator('#dlg [data-dlg="currentInstallment"]').fill('11');
  await page.locator('#dlg [data-dlg="times"]').fill('10');
  await page.getByRole('button', { name: 'Adicionar', exact: true }).click();
  check(await page.locator('#dlg [data-dlg="currentInstallment"]').count() === 1, 'parcelamento rejeita parcela atual maior que o total');
  await page.locator('#dlg [data-dlg="currentInstallment"]').fill('3');
  await page.locator('#dlg [data-dlg="interest"]').fill('1,50');
  await page.getByRole('button', { name: 'Adicionar', exact: true }).click();
  check(await page.locator('#dlg [data-dlg="interest"]').count() === 1, 'juros maiores que o valor individual da parcela são rejeitados');
  await page.locator('#dlg [data-dlg="interest"]').fill('0,10');
  await page.getByRole('button', { name: 'Adicionar', exact: true }).click();
  await page.locator('.fin-section-option[data-t="lancamentos"]').click();
  await page.locator('.mnav [data-n="-1"]').click();
  await page.locator('.mnav [data-n="-1"]').click();
  const earlierInstallments = await page.locator('#tx-results .fr .ttl').allTextContents();
  await page.locator('.mnav [data-n="1"]').click();
  const immediatelyEarlierInstallments = await page.locator('#tx-results .fr .ttl').allTextContents();
  await page.locator('.mnav [data-n="1"]').click();
  const generatedInstallments = [];
  for (let offset = 0; offset < 8; offset++) {
    const rows = await page.locator('#tx-results .fr').evaluateAll((items) => items.map((item) => ({
      title: item.querySelector('.ttl')?.textContent?.trim(),
      amount: item.querySelector('.amt')?.textContent?.trim(),
    })));
    generatedInstallments.push(rows.find((row) => row.title === `Série parcelada de teste (${offset + 3}/10)`));
    if (offset < 7) await page.locator('.mnav [data-n="1"]').click();
  }
  check(!earlierInstallments.some((title) => title.startsWith('Série parcelada de teste'))
    && !immediatelyEarlierInstallments.some((title) => title.startsWith('Série parcelada de teste')), 'parcelamento não cria parcelas anteriores à atual');
  check(generatedInstallments.every((row) => row?.amount.includes('1,00')), '3/10 a 10/10 são criadas mensalmente com a divisão correta dos centavos');
  check(await page.locator('#tx-results .fr').filter({ hasText: 'Série parcelada de teste (10/10)' }).locator('.meta2').textContent()
    .then((text) => text.includes('Sem juros')), 'parcelas seguintes podem ser explicitamente sem juros');
  for (let month = 0; month < 6; month++) await page.locator('.mnav [data-n="-1"]').click();
  await page.locator('#tx-results .fr').filter({ hasText: 'Série parcelada de teste (4/10)' }).locator('[data-action="edit-tx"]').click();
  await page.locator('#dlg [data-dlg="interest"]').fill('999,00');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  check(await page.locator('#dlg [data-dlg="interest"]').count() === 1, 'juros acima do valor da parcela são rejeitados');
  await page.locator('#dlg [data-dlg="interest"]').fill('0,25');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  const editedInstallment = page.locator('#tx-results .fr').filter({ hasText: 'Série parcelada de teste (4/10)' });
  const editedInstallmentMeta = await editedInstallment.locator('.meta2').textContent();
  const hasEditedInterest = editedInstallmentMeta.includes('0,25');
  check(hasEditedInterest, 'juros podem ser ajustados em cada parcela', hasEditedInterest ? '' : editedInstallmentMeta);
  await page.locator('.scroll-x button[data-action="fin-filter"][data-f="todos"]').evaluate((button) => button.click());
  await editedInstallment.locator('[data-action="edit-tx"]').click();
  await page.getByRole('button', { name: 'Antecipar parcelas' }).click();
  check(await page.locator('#dlg input[data-advance-id]').count() > 0, 'antecipação permite selecionar parcelas futuras');
  await page.locator('#dlg input[data-advance-id]').first().check();
  await page.getByRole('button', { name: 'Confirmar antecipação' }).click();
  const anticipationToast = await page.locator('.toast-message').textContent().catch(() => '');
  const anticipatedInstallment = page.locator('#tx-results .fr').filter({ hasText: 'Série parcelada de teste (4/10)' });
  const anticipatedInstallmentMeta = await anticipatedInstallment.locator('.meta2').textContent();
  const accountAnticipationApplied = anticipatedInstallmentMeta.includes('Antecipada em') && anticipatedInstallmentMeta.includes('pago em');
  check(accountAnticipationApplied, 'antecipar parcela de conta registra pagamento sem deslocar o mês',
    accountAnticipationApplied ? '' : `${anticipatedInstallmentMeta}; aviso: ${anticipationToast}`);
  await page.locator('.mnav [data-n="0"]').click();

  await page.locator('.finance-fab').click();
  await page.locator('#quick-actions-menu').getByRole('button', { name: 'Despesa', exact: true }).click();
  await page.locator('#dlg [data-dlg="amount"]').fill('60,00');
  await page.locator('#dlg [data-dlg="desc"]').fill('Série de cartão antecipável');
  const creditAccount = await page.locator('#dlg [data-dlg="accountId"] option').evaluateAll((options) => (
    options.find((option) => /cartão|crédito/i.test(option.textContent))?.value
  ));
  await selectAccount(creditAccount);
  await page.locator('#dlg [data-dlg="date"]').fill(currentInstallmentDate);
  await page.locator('#dlg [data-dlg="repeat"]').selectOption('parcel');
  await page.locator('#dlg [data-dlg="times"]').fill('3');
  await page.locator('#dlg [data-dlg="interest"]').fill('0,50');
  await page.getByRole('button', { name: 'Adicionar', exact: true }).click();
  await page.locator('.fin-section-option[data-t="lancamentos"]').click();
  await page.locator('.scroll-x button[data-action="fin-filter"][data-f="todos"]').evaluate((button) => button.click());
  const cardInstallment = page.locator('#tx-results .fr').filter({ hasText: 'Série de cartão antecipável (1/3)' });
  const cardRowExists = await cardInstallment.count() === 1;
  const cardRows = await page.locator('#tx-results .fr .ttl').allTextContents();
  check(cardRowExists, 'compra parcelada no cartão cria a primeira parcela',
    cardRowExists ? '' : `${cardRows.join(' | ')}; aviso: ${await page.locator('.toast-message').textContent().catch(() => '')}`);
  if (cardRowExists) {
    const originalCardMonth = await page.locator('.mnav .mlabel').textContent();
    const originalCardDateHeader = await cardInstallment.evaluate((row) => row.closest('.grp')?.querySelector('.gh')?.textContent);
    check(await cardInstallment.locator('.meta2').textContent().then((text) => text.includes('0,50')), 'juros da parcela de cartão aparecem sem alterar o valor da parcela');
    await cardInstallment.locator('[data-action="edit-tx"]').click();
    await page.getByRole('button', { name: 'Antecipar parcelas' }).click();
    const cardAnticipationDialog = page.locator('#dlg');
    check(await cardAnticipationDialog.locator('input[data-advance-id]').count() === 3
      && await cardAnticipationDialog.textContent().then((text) => text.includes('sem criar pagamento nem alterar saldos')), 'cartão oferece antecipação sem criar pagamento ou alterar saldos');
    check(await cardAnticipationDialog.locator('.dlg').evaluate((dialog) => {
      const bounds = dialog.getBoundingClientRect();
      return bounds.left >= 0 && bounds.right <= innerWidth;
    }), 'diálogo de antecipação cabe na largura móvel');
    await cardAnticipationDialog.locator('input[data-advance-id]').first().check();
    await page.getByRole('button', { name: 'Confirmar antecipação' }).click();
    const annotatedCardInstallment = page.locator('#tx-results .fr').filter({ hasText: 'Série de cartão antecipável (1/3)' });
    const cardAnticipationApplied = await annotatedCardInstallment.locator('.meta2').textContent().then((text) => text.includes('Antecipada em'))
      && await page.locator('.mnav .mlabel').textContent() === originalCardMonth
      && await annotatedCardInstallment.evaluate((row) => row.closest('.grp')?.querySelector('.gh')?.textContent) === originalCardDateHeader
      && await annotatedCardInstallment.locator('.amt').textContent().then((text) => text.includes('20,00'));
    check(cardAnticipationApplied, 'antecipação no cartão preserva mês, data e valor originais');
    await page.locator('.mnav [data-n="0"]').click();
  }

  await page.locator('.fin-section-option[data-t="cartoes"]').click();
  const invoicePayButton = page.locator('button[data-action="pay-inv"]').first();
  const invoiceCardId = await invoicePayButton.getAttribute('data-id');
  await invoicePayButton.click();
  await page.locator('#dlg [data-dlg="mode"]').selectOption('installments');
  const invoiceSourceId = await page.locator('#dlg [data-dlg="from"]').inputValue();
  await page.locator('#dlg [data-dlg="amount"]').fill('12,01');
  await page.locator('#dlg [data-dlg="times"]').fill('3');
  await page.locator('#dlg [data-dlg="interest"]').fill('1,00');
  const firstInvoiceDue = await page.locator('#dlg [data-dlg="firstDueDate"]').inputValue();
  check(firstInvoiceDue >= await page.locator('#dlg [data-dlg="firstDueDate"]').getAttribute('min'), 'parcelamento sugere um vencimento futuro');
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.getByRole('button', { name: 'Descartar alterações', exact: true }).click();
  await page.locator('.fin-section-option[data-t="contas"]').click();
  const accountBalanceText = async () => {
    const balance = page.locator(`.acc[data-id="${invoiceSourceId}"] b`);
    if (!await balance.count()) {
      const state = await page.evaluate(() => ({
        activeTab: document.querySelector('.fin-section-option[aria-pressed="true"]')?.dataset.t,
        accounts: [...document.querySelectorAll('.acc')].map((account) => ({
          id: account.dataset.id,
          label: account.getAttribute('aria-label'),
        })),
        accountSection: document.querySelector('.fin-section-content')?.innerText,
      }));
      throw new Error(`Conta de origem ${invoiceSourceId} não está na lista: ${JSON.stringify(state)}`);
    }
    return balance.textContent();
  };
  const balanceBeforeInvoicePlan = await accountBalanceText();

  await page.locator('.fin-section-option[data-t="cartoes"]').click();
  await page.locator(`button[data-action="pay-inv"][data-id="${invoiceCardId}"]`).click();
  await page.locator('#dlg [data-dlg="mode"]').selectOption('installments');
  await page.locator('#dlg [data-dlg="amount"]').fill('12,01');
  await page.locator('#dlg [data-dlg="times"]').fill('3');
  await page.locator('#dlg [data-dlg="interest"]').fill('1,00');
  await page.locator('#dlg [data-dlg="firstDueDate"]').fill(firstInvoiceDue);
  check(await page.locator('#dlg').textContent().then((text) => text.includes('R$ 15,01')),
    'prévia soma os juros de cada parcela ao principal');
  await page.getByRole('button', { name: 'Programar parcelas' }).click();
  check((await page.locator('.toast-message').textContent()).includes('saldo da conta não foi alterado'),
    'programar fatura informa que não houve débito imediato');
  check(await page.locator('button[data-action="pay-inv"]').first().locator('xpath=..').textContent()
    .then((text) => text.includes('3 parcelas de fatura programadas') && text.includes('R$ 15,01')),
    'cartão mostra a quantidade e o total das parcelas futuras');
  await page.locator('.fin-section-option[data-t="contas"]').click();
  const balanceAfterPlan = await accountBalanceText();
  check(balanceAfterPlan === balanceBeforeInvoicePlan, 'programar parcelas não reduz o saldo da conta de origem');

  await page.locator('.fin-section-option[data-t="lancamentos"]').click();
  await page.locator('.scroll-x button[data-action="fin-filter"][data-f="pendentes"]').evaluate((button) => button.click());
  const invoicePlanRow = page.locator('#tx-results .fr').filter({ hasText: 'Fatura parcelada (1/3)' });
  check(await invoicePlanRow.count() === 1
    && await invoicePlanRow.locator('.amt').textContent().then((text) => text.includes('5,01'))
    && await invoicePlanRow.locator('.meta2').textContent().then((text) => text.includes('Juros') && text.includes('1,00'))
    && await invoicePlanRow.locator('[data-action="tx-paid"]').getAttribute('aria-checked') === 'false',
  'cada parcela aparece como transferência pendente com principal e juros discriminados');
  await invoicePlanRow.locator('[data-action="tx-paid"]').click();
  await page.locator('.scroll-x button[data-action="fin-filter"][data-f="todos"]').evaluate((button) => button.click());
  check(await invoicePlanRow.locator('[data-action="tx-paid"]').getAttribute('aria-checked') === 'true',
    'parcela futura da fatura pode ser marcada como paga');
  await page.locator('.fin-section-option[data-t="contas"]').click();
  const balanceAfterFirstInstallment = await accountBalanceText();
  check(balanceAfterFirstInstallment !== balanceAfterPlan, 'marcar uma parcela como paga atualiza o saldo da conta de origem');
  await page.locator('.fin-section-option[data-t="cartoes"]').click();
  check(await page.locator('button[data-action="pay-inv"]').first().locator('xpath=..').textContent()
    .then((text) => text.includes('2 parcelas de fatura programadas') && text.includes('R$ 10,00')),
    'pagamento de uma parcela atualiza o total programado restante');

  await page.locator('.finance-fab').click();
  await page.locator('#quick-actions-menu').getByRole('button', { name: 'Despesa', exact: true }).click();
  await page.locator('#dlg [data-dlg="amount"]').fill('25,50');
  await page.locator('#dlg [data-dlg="desc"]').fill('Parcela com valor informado');
  await selectAccount(nonCreditAccount);
  await page.locator('#dlg [data-dlg="date"]').fill(currentInstallmentDate);
  await page.locator('#dlg [data-dlg="repeat"]').selectOption('parcel');
  check(await page.locator('#dlg [data-dlg="installmentAmountMode"]').count() === 1, 'parcelamento permite informar o valor de cada parcela');
  await page.locator('#dlg [data-dlg="installmentAmountMode"]').selectOption('installment');
  await page.locator('#dlg [data-dlg="currentInstallment"]').fill('3');
  await page.locator('#dlg [data-dlg="times"]').fill('10');
  await page.getByRole('button', { name: 'Adicionar', exact: true }).click();
  await page.locator('.fin-section-option[data-t="lancamentos"]').click();
  const enteredInstallment = page.locator('#tx-results .fr').filter({ hasText: 'Parcela com valor informado (3/10)' });
  check(await enteredInstallment.locator('.amt').textContent().then((amount) => amount.includes('25,50')), '3/10 usa o valor informado para cada parcela');
  await page.locator('.fin-section-option[data-t="resumo"]').click();

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
    await selectAccount(recentAccountOptions.find((value) => value !== selectedAccount));
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
  const overviewDesktopLayout = await page.evaluate(() => {
    const categories = document.querySelector('.finance-category-breakdown').getBoundingClientRect();
    const recent = document.querySelector('.finance-recent').getBoundingClientRect();
    return recent.left >= categories.right - 1 && Math.abs(recent.top - categories.top) < 2;
  });
  check(overviewDesktopLayout, 'composição do mês e últimos lançamentos ficam lado a lado no desktop');
  check(await page.locator('.finance-recent .list').evaluate((list) => getComputedStyle(list).gridTemplateColumns.split(' ').length === 2), 'últimos lançamentos organizados em duas colunas no desktop');
  await page.setViewportSize({ width: 390, height: 844 });
  const overviewMobileLayout = await page.evaluate(() => {
    const categories = document.querySelector('.finance-category-breakdown').getBoundingClientRect();
    const recent = document.querySelector('.finance-recent').getBoundingClientRect();
    return recent.top >= categories.bottom;
  });
  check(overviewMobileLayout, 'composição do mês e últimos lançamentos continuam empilhados no celular');
  check(await page.locator('.fin-section-menu').evaluate((menu) => (
    menu.scrollWidth <= menu.clientWidth
      && menu.querySelectorAll('.fin-section-option').length === 6
  )), 'todas as seções ficam visíveis sem rolagem horizontal no celular');
  check(errors.length === 0, 'sem erros no console', errors.slice(0, 3).join(' | '));

  await browser.close();
  process.exit(results.every(Boolean) ? 0 : 1);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
