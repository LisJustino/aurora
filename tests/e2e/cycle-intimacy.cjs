const { chromium } = require('playwright');

const BASE = process.argv[2] || 'http://127.0.0.1:5173';
const results = [];
const check = (passed, name) => {
  results.push(passed);
  console.log(`${passed ? 'OK   ' : 'FALHA'} — ${name}`);
};

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  const lazyPage = await browser.newPage();
  const cycleViewRequests = [];
  lazyPage.on('request', (request) => {
    if (new URL(request.url()).pathname.endsWith('/src/js/features/cycle/view.js')) cycleViewRequests.push(request.url());
  });
  await lazyPage.goto(`${BASE}/?preview#inicio`);
  await lazyPage.locator('.home-head').waitFor();
  check(cycleViewRequests.length === 0, 'a tela de Ciclo não é carregada ao abrir o Início');
  await lazyPage.locator('.nav a[href="/ciclo"]').click();
  await lazyPage.locator('.cycle-health-card').waitFor();
  check(cycleViewRequests.length === 1, 'a tela de Ciclo é carregada ao acessar a área');
  await lazyPage.close();

  await page.goto(`${BASE}/?preview#ciclo`);
  const healthCard = page.locator('.cycle-health-card');
  check(await healthCard.evaluate((element) => !element.open), 'orientações de saúde começam recolhidas para reduzir a rolagem da tela');
  check((await healthCard.textContent()).includes('Contracepção e prevenção de ISTs são cuidados distintos'), 'orientações distinguem contracepção e prevenção de ISTs');
  check(!(await page.locator('[data-dlg="log.stiPrevention"]').count()), 'não há novo campo persistido de prevenção de ISTs');
  await page.getByRole('button', { name: 'Registrar este dia' }).click();
  const dialog = page.locator('#dlg');
  const intimacyGroup = dialog.locator('.cycle-intimacy-group');
  const mindGroup = dialog.locator('[data-category="mood"]');
  const socialGroup = dialog.locator('[data-category="social"]');
  await intimacyGroup.getByRole('heading', { name: 'Intimidade' }).waitFor();
  check(await mindGroup.getByRole('heading', { name: 'Mente e sentimentos' }).count() === 1, 'sentimentos, concentração e memória ficam no grupo de mente');
  check(await socialGroup.getByRole('heading', { name: 'Vida social' }).count() === 1, 'vida social tem um grupo próprio');
  check(await intimacyGroup.evaluate((element) => !element.open), 'seção opcional começa recolhida como os outros grupos do diário');
  await intimacyGroup.locator('summary').focus();
  await intimacyGroup.locator('summary').press('Enter');
  check(await intimacyGroup.evaluate((element) => element.open), 'seção íntima abre por teclado como os outros grupos do diário');
  const partneredActivity = intimacyGroup.locator('[data-action="cyc-sex"][data-v="yes"]');
  const noPartneredActivity = intimacyGroup.locator('[data-action="cyc-sex"][data-v="no"]');
  const masturbationActivity = intimacyGroup.locator('[data-action="cyc-intimacy-toggle"][data-k="masturbationActivity"]');
  const toysActivity = intimacyGroup.locator('[data-action="cyc-intimacy-toggle"][data-k="sexToysUsed"]');
  const highLibido = intimacyGroup.locator('[data-action="cyc-libido"][data-v="high"]');
  const orgasm = intimacyGroup.locator('[data-action="cyc-orgasm"][data-v="yes"]');
  const noOrgasm = intimacyGroup.locator('[data-action="cyc-orgasm"][data-v="no"]');
  const weightGroup = dialog.locator('details.cycle-symptom-group[data-category="weight"]');
  const testsGroup = dialog.locator('details.cycle-symptom-group[data-category="tests"]');
  const medicationGroup = dialog.locator('details.cycle-symptom-group[data-category="medication"]');
  const painGroup = dialog.locator('.cycle-symptom-grid [data-category="pain"]');
  const skinGroup = dialog.locator('.cycle-symptom-grid [data-category="skin"]');
  check(await dialog.locator('[data-dlg="log.orgasmCount"]').count() === 0, 'novos registros usam orgasmo sim/não sem contagem');
  await painGroup.locator('summary').click();
  await skinGroup.locator('summary').click();
  await mindGroup.locator('summary').click();
  await mindGroup.locator('[data-action="cyc-opt"][data-v="concentration"]').click();
  await mindGroup.locator('[data-action="cyc-opt"][data-v="memory"]').click();
  await socialGroup.locator('summary').click();
  await socialGroup.locator('[data-action="cyc-opt"][data-v="interaction"]').click();
  await socialGroup.locator('[data-action="cyc-opt"][data-v="interaction-helped"]').click();
  await weightGroup.locator('summary').click();
  await weightGroup.locator('[data-dlg="log.weightKg"]').fill('65,5');
  await testsGroup.locator('summary').click();
  await testsGroup.locator('[data-action="cyc-test-toggle"][data-k="ovulationTestResult"]').click();
  await testsGroup.locator('[data-action="cyc-test-result"][data-k="ovulationTestResult"][data-v="positive"]').click();
  await testsGroup.locator('[data-action="cyc-test-toggle"][data-k="pregnancyTestResult"]').click();
  await testsGroup.locator('[data-action="cyc-test-result"][data-k="pregnancyTestResult"][data-v="negative"]').click();
  await medicationGroup.locator('summary').click();
  await medicationGroup.locator('[data-action="cyc-medication"][data-v="yes"]').click();
  await page.setViewportSize({ width: 1366, height: 900 });
  const layout = await dialog.evaluate((element) => {
    const discharge = element.querySelector('[data-category="discharge"]').getBoundingClientRect();
    const intimacy = element.querySelector('[data-category="intimacy"]').getBoundingClientRect();
    const notes = element.querySelector('[data-dlg="log.note"]').closest('.f').getBoundingClientRect();
    const trackingGrid = element.querySelector('.cycle-daily-tracking-grid').getBoundingClientRect();
    const trackingCards = [...element.querySelectorAll('.cycle-daily-tracking-grid > details')].map((card) => card.getBoundingClientRect());
    const groupsInReadingOrder = [...element.querySelectorAll('.cycle-symptom-grid, .cycle-intimacy-grid, .cycle-daily-tracking-grid, [data-dlg="log.note"]')];
    return {
      topicsFollowOrder: groupsInReadingOrder.length === 4
        && groupsInReadingOrder[0].matches('.cycle-symptom-grid')
        && groupsInReadingOrder[1].matches('.cycle-intimacy-grid')
        && groupsInReadingOrder[2].matches('.cycle-daily-tracking-grid')
        && groupsInReadingOrder[3].matches('[data-dlg="log.note"]'),
      sideBySide: Math.abs(discharge.top - intimacy.top) < 8 && discharge.right <= intimacy.left + 8,
      notesBelow: notes.top > discharge.bottom && notes.width > element.querySelector('.cycle-intimacy-grid').getBoundingClientRect().width * 0.9,
      trackingCardsAligned: trackingCards.length === 3
        && Math.abs(trackingCards[0].top - trackingCards[1].top) < 2
        && Math.abs(trackingCards[0].width - trackingCards[1].width) < 2
        && Math.abs(trackingCards[2].left - trackingGrid.left) < 2
        && Math.abs(trackingCards[2].width - trackingGrid.width) < 2
        && trackingCards.every((card) => card.left >= trackingGrid.left && card.right <= trackingGrid.right + 1),
      oddSymptomCardFullWidth: (() => {
        const grid = element.querySelector('.cycle-symptom-grid');
        const cards = [...grid.children].map((card) => card.getBoundingClientRect());
        if (cards.length % 2 === 0) return true;
        const last = cards[cards.length - 1];
        const bounds = grid.getBoundingClientRect();
        return Math.abs(last.left - bounds.left) < 2 && Math.abs(last.width - bounds.width) < 2;
      })(),
    };
  });
  check(layout.topicsFollowOrder, 'sintomas, intimidade, registros complementares e anotação seguem uma sequência');
  check(layout.sideBySide, 'intimidade aparece lado a lado com corrimento no desktop');
  check(layout.notesBelow, 'anotações ficam sozinhas em largura inteira abaixo');
  check(layout.trackingCardsAligned, 'peso e testes dividem a primeira linha, e medicação ocupa a linha inteira');
  check(layout.oddSymptomCardFullWidth, 'último cartão de sintomas ocupa a linha inteira quando fica sem par');
  check(!(await dialog.locator('.cycle-group-mode').allTextContents()).some((text) => /toque para/i.test(text)), 'cartões não exibem instruções de toque para expandir');
  check(await dialog.getByRole('button', { name: 'Preservativo' }).count() === 0, 'métodos contraceptivos ficam ocultos sem atividade com outra pessoa');
  for (const width of [320, 390, 1366]) {
    await page.setViewportSize({ width, height: 844 });
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `formulário não tem overflow horizontal em ${width} px`);
    const symptomChoicesFit = await dialog.evaluate((element) => [...element.querySelectorAll('.cycle-symptom-group[open] .chips')].every((container) => {
      const bounds = container.getBoundingClientRect();
      const choices = [...container.children].map((choice) => choice.getBoundingClientRect());
      return choices.every((choice) => choice.left >= bounds.left - 1 && choice.right <= bounds.right + 1)
        && choices.every((choice, index) => choices.slice(index + 1).every((next) => {
          if (Math.abs(choice.top - next.top) > 2) return true;
          return choice.right <= next.left + 1 || next.right <= choice.left + 1;
        }));
    }));
    check(symptomChoicesFit, `opções não se sobrepõem nem ultrapassam os cartões em ${width} px`);
    const trackingColumns = await weightGroup.evaluate((card) => {
      const cards = [...card.parentElement.children].map((item) => item.getBoundingClientRect());
      const firstRow = cards.filter((item) => Math.abs(item.top - cards[0].top) < 2);
      const grid = card.parentElement.getBoundingClientRect();
      return {
        firstRow: firstRow.length,
        firstRowBalanced: Math.abs(cards[0].width - cards[1].width) < 2,
        thirdFullWidth: Math.abs(cards[2].left - grid.left) < 2 && Math.abs(cards[2].width - grid.width) < 2,
      };
    });
    if (width === 320) check(trackingColumns.firstRow === 1, 'cartões ocupam uma coluna em celular estreito');
    if (width === 390) check(trackingColumns.firstRow === 2 && trackingColumns.firstRowBalanced && trackingColumns.thirdFullWidth, 'cartões formam duas colunas equilibradas em celular maior');
  }
  await page.setViewportSize({ width: 390, height: 844 });
  check(await intimacyGroup.locator('.cycle-intimacy-choice').evaluateAll((buttons) => buttons.every((button) => getComputedStyle(button).whiteSpace === 'nowrap')), 'opções íntimas mantêm rótulos curtos em uma linha');
  await partneredActivity.click();
  check(await dialog.getByRole('button', { name: 'Preservativo' }).count() === 1, 'métodos contraceptivos aparecem para atividade com outra pessoa');
  check(await intimacyGroup.getByRole('button', { name: 'Sem método contraceptivo' }).count() === 1, 'é possível registrar atividade sem método contraceptivo');
  check((await dialog.locator('.cycle-intimacy-methods').textContent()).includes('Contracepção não significa prevenção de ISTs; preservativos ajudam a reduzir esse risco'), 'registro explica a diferença entre contracepção e prevenção de ISTs');
  await dialog.getByRole('button', { name: 'Preservativo' }).click();
  await highLibido.click();
  await masturbationActivity.click();
  await toysActivity.click();
  await orgasm.click();
  await dialog.getByRole('button', { name: 'Salvar registro' }).click();

  const summary = page.locator('.cycle-day-summary');
  check((await summary.textContent()).includes('Relação com outra pessoa'), 'resumo registra atividade com outra pessoa');
  check((await summary.textContent()).includes('Masturbação registrada'), 'resumo registra masturbação');
  check((await summary.textContent()).includes('Brinquedos registrados'), 'resumo registra uso de brinquedos');
  check((await summary.textContent()).includes('Libido alta'), 'resumo registra libido alta');
  check((await summary.textContent()).includes('Orgasmo'), 'resumo registra orgasmo');
  check((await summary.textContent()).includes('Mente e sentimentos: Dificuldade de concentração, Esquecimentos ou lapsos de memória'), 'resumo mostra as opções de mente selecionadas');
  check((await summary.textContent()).includes('Vida social: Tive interação social, Interação me fez bem'), 'resumo mostra as opções de vida social selecionadas');
  check((await summary.textContent()).includes('Peso: 65,5 kg'), 'peso do dia aparece no resumo');
  check((await summary.textContent()).includes('Teste de ovulação: Positivo'), 'resultado do teste de ovulação aparece no resumo');
  check((await summary.textContent()).includes('Teste de gravidez: Negativo'), 'resultado do teste de gravidez aparece no resumo');
  check((await summary.textContent()).includes('Tomou medicação'), 'registro de medicação aparece no resumo sem detalhes');

  await page.getByRole('button', { name: 'Registrar este dia' }).click();
  check(await mindGroup.locator('[data-action="cyc-opt"][data-v="concentration"]').getAttribute('aria-pressed') === 'true', 'opções de mente permanecem ao reabrir o dia');
  check(await mindGroup.locator('[data-action="cyc-opt"][data-v="memory"]').getAttribute('aria-pressed') === 'true', 'memória permanece ao reabrir o dia');
  check(await socialGroup.locator('[data-action="cyc-opt"][data-v="interaction"]').getAttribute('aria-pressed') === 'true', 'interação social permanece ao reabrir o dia');
  check(await socialGroup.locator('[data-action="cyc-opt"][data-v="interaction-helped"]').getAttribute('aria-pressed') === 'true', 'bem-estar social permanece ao reabrir o dia');
  check(await weightGroup.locator('[data-dlg="log.weightKg"]').inputValue() === '65.5', 'peso permanece ao reabrir o dia');
  check(await testsGroup.locator('[data-action="cyc-test-result"][data-k="ovulationTestResult"][data-v="positive"]').getAttribute('aria-pressed') === 'true', 'resultado de ovulação permanece ao reabrir');
  check(await testsGroup.locator('[data-action="cyc-test-result"][data-k="pregnancyTestResult"][data-v="negative"]').getAttribute('aria-pressed') === 'true', 'resultado de gravidez permanece ao reabrir');
  check(await medicationGroup.locator('[data-action="cyc-medication"][data-v="yes"]').getAttribute('aria-pressed') === 'true', 'registro de medicação permanece ao reabrir');
  check(await partneredActivity.getAttribute('aria-pressed') === 'true', 'atividade sexual é carregada ao reabrir o dia');
  check(await masturbationActivity.getAttribute('aria-pressed') === 'true', 'masturbação é carregada ao reabrir o dia');
  check(await toysActivity.getAttribute('aria-pressed') === 'true', 'uso de brinquedos é carregado ao reabrir o dia');
  check(await highLibido.getAttribute('aria-pressed') === 'true', 'libido é carregada ao reabrir o dia');
  check(await orgasm.getAttribute('aria-pressed') === 'true', 'orgasmo é carregado ao reabrir o dia');
  await noPartneredActivity.click();
  check(await dialog.getByRole('button', { name: 'Preservativo' }).count() === 0, 'métodos somem ao desmarcar atividade com outra pessoa');
  check(await masturbationActivity.getAttribute('aria-pressed') === 'true', 'registrar ausência de relação preserva masturbação');
  check(await noPartneredActivity.getAttribute('aria-pressed') === 'true', 'ausência de relação fica explicitamente selecionada');
  await noOrgasm.click();
  await medicationGroup.locator('[data-action="cyc-medication"][data-v="no"]').click();
  await dialog.getByRole('button', { name: 'Salvar registro' }).click();
  check((await summary.textContent()).includes('Masturbação registrada'), 'registro independente de masturbação continua salvo');
  check((await summary.textContent()).includes('Sem orgasmo'), 'ausência de orgasmo pode ser registrada');
  check((await summary.textContent()).includes('Não tomou medicação'), 'ausência de medicação pode ser registrada');
  check(!(await summary.textContent()).includes('Relação com outra pessoa'), 'ausência de relação não é confundida com atividade sexual');
  check((await summary.textContent()).includes('Sem relação com outra pessoa'), 'resumo informa a ausência explícita de relação');
  await page.getByRole('button', { name: 'Registrar este dia' }).click();
  check(await noPartneredActivity.getAttribute('aria-pressed') === 'true', 'ausência de relação permanece após reabrir');
  check(await noOrgasm.getAttribute('aria-pressed') === 'true', 'ausência de orgasmo permanece após reabrir');
  check(errors.length === 0, 'sem erros no console');

  await browser.close();
  process.exit(results.every(Boolean) ? 0 : 1);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
