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
  check(await page.getByRole('heading', { name: 'Menos ruído. Mais clareza no dia.' }).count() === 1, 'landing apresenta o benefício principal do Aurora');
  check(await page.getByText('Da cabeça cheia a um próximo passo possível').count() === 1
    && await page.locator('.public-journey-step').count() === 3
    && await page.locator('.public-journey').count() === 0,
  'landing mostra como o Aurora transforma organização em ações e revisão semanal dentro de uma única seção');
  check(await page.getByText('Planner de tarefas, hábitos, foco e finanças em um só lugar.').count() === 1
    && await page.getByText('Totalmente grátis').count() > 0
    && await page.getByRole('heading', { name: 'Feito por uma pessoa só, com cuidado' }).count() === 1,
  'landing explica o produto, informa que é grátis e mostra a transparência do criador');
  check(await page.locator('.public-faq-item').first().locator('summary').textContent().then((text) => /grátis/i.test(text))
    && await page.locator('.public-faq form[data-footer-suggestion]').count() === 0
    && await page.locator('.public-footer form[data-footer-suggestion]').count() === 1,
  'FAQ começa por preço e o formulário de sugestão fica no rodapé');
  check(await page.locator('.public-value-media').count() === 5, 'cada área tem um espaço para vídeo mudo');
  check(await page.getByText('profissional e mãe').count() === 0
    && await page.getByText('estudante e freelancer').count() === 0
    && await page.getByText('gestora de rotina').count() === 0, 'landing não apresenta depoimentos fictícios');
  check(await page.locator('.public-hero [data-public-action="signup"]').evaluate((button) => button.classList.contains('primary'))
    && !await page.locator('.public-hero [data-public-action="demo"]').evaluate((button) => button.classList.contains('primary')), 'cadastro é o CTA principal e demonstração é alternativa');
  await page.setViewportSize({ width: 320, height: 720 });
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'landing não tem overflow horizontal em 320 px');
  check(
    await page.locator('.public-journey-grid').evaluate((grid) => {
      const positions = [...grid.children].map((step) => Math.round(step.getBoundingClientRect().left));
      return new Set(positions).size === 1;
    }),
    'percurso de valor se adapta a uma coluna em celular estreito',
  );
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
  await page.mouse.click(1, 1);
  await page.waitForFunction(() => !document.querySelector('dialog[data-legal-modal]').open);
  check(true, 'clique no fundo fecha o modal legal');
  await page.locator('.public-hero').getByRole('link', { name: 'Ver demo em 1 minuto' }).click();
  check(mainModuleRequests.length === 0, 'demonstração pública não baixa o módulo completo');
  await page.getByRole('heading', { name: /^(Bom dia|Boa tarde|Boa noite), pessoa/i }).waitFor();
  check(await page.locator('.demo-nav-link').count() === 6, 'demonstração oferece navegação pelas áreas do app');
  check(await page.getByText('dados de exemplo', { exact: false }).count() === 1, 'a demonstração deixa claro que os dados são fictícios e temporários');
  await page.waitForTimeout(500);
  const storageBefore = await page.evaluate(() => JSON.stringify({
    local: Object.fromEntries(Object.keys(localStorage).sort().map((key) => [key, localStorage.getItem(key)])),
    session: Object.fromEntries(Object.keys(sessionStorage).sort().map((key) => [key, sessionStorage.getItem(key)])),
  }));
  collectRequests = true;

  await page.getByRole('link', { name: 'Tarefas', exact: true }).click();
  const task = page.locator('[data-task-id="read"]');
  await task.focus();
  await page.keyboard.press('Space');
  check(await task.getAttribute('aria-checked') === 'true', 'tarefa fictícia pode ser concluída pelo teclado');
  check(await page.getByText('3 de 3 feitos').count() === 1, 'progresso e resumo acompanham a tarefa');
  await page.getByLabel('Adicionar uma tarefa de exemplo').fill('Revisar a semana');
  await page.getByRole('button', { name: 'Adicionar', exact: true }).click();
  check(await page.getByText('Revisar a semana').count() === 1
    && await page.getByText('3 de 4 feitos').count() === 1,
  'tarefas de exemplo podem ser adicionadas apenas durante a demonstração');

  await page.getByRole('link', { name: 'Hábitos', exact: true }).click();
  const habit = page.getByRole('button', { name: 'Marcar hoje' });
  await habit.focus();
  await page.keyboard.press('Enter');
  check(await page.getByRole('button', { name: 'Desmarcar hoje' }).getAttribute('aria-pressed') === 'true', 'hábito fictício pode ser marcado pelo teclado');
  check((await page.locator('[data-demo-habit-count]').textContent()).includes('3'), 'resumo semanal do hábito é atualizado');

  await page.getByRole('link', { name: 'Foco', exact: true }).click();
  await page.getByRole('button', { name: '15 min' }).click();
  const timer = page.locator('[data-demo-timer]');
  const initialTime = await timer.textContent();
  check(initialTime === '15:00', 'duração do foco pode ser escolhida');
  await page.getByRole('button', { name: 'Iniciar foco' }).focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1200);
  const runningTime = await timer.textContent();
  check(runningTime !== initialTime, 'cronômetro inicia e atualiza');
  check(await page.getByRole('button', { name: '25 min' }).isDisabled(), 'duração fica estável durante o foco');
  await page.getByRole('button', { name: 'Pausar foco' }).click();
  check(await page.getByRole('button', { name: 'Iniciar foco' }).getAttribute('aria-pressed') === 'false', 'cronômetro pode ser pausado');
  await page.getByRole('button', { name: 'Iniciar foco' }).click();
  await page.evaluate(() => {
    const now = Date.now.bind(Date);
    Date.now = () => now() + 16 * 60 * 1000;
  });
  await page.getByRole('button', { name: 'Iniciar novamente' }).waitFor();
  check(await timer.textContent() === '00:00', 'cronômetro de exemplo indica quando o foco termina');
  await page.getByRole('button', { name: 'Reiniciar cronômetro' }).click();
  check(await timer.textContent() === '15:00'
    && await page.getByRole('button', { name: 'Iniciar foco' }).isEnabled(),
  'cronômetro concluído pode ser reiniciado sem sair da demonstração');

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

  await page.setViewportSize({ width: 1280, height: 900 });
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'demonstração não tem overflow horizontal em desktop');
  await page.setViewportSize({ width: 1366, height: 900 });
  const demoLayout = await page.evaluate(() => {
    const sidebar = document.querySelector('.demo-app > .topbar').getBoundingClientRect();
    const main = document.querySelector('.demo-main').getBoundingClientRect();
    return {
      sidebarVisible: sidebar.width >= 180 && sidebar.left === 0 && sidebar.bottom >= innerHeight,
      mainFitsWorkspace: main.left >= sidebar.right && main.right <= document.documentElement.clientWidth,
    };
  });
  check(demoLayout.sidebarVisible, 'demonstração usa a navegação lateral do app no desktop');
  check(demoLayout.mainFitsWorkspace, 'conteúdo respeita a coluna ao lado da navegação');
  await page.getByRole('link', { name: 'Voltar à página inicial' }).click();
  check(
    await page.locator('.public-journey-grid').evaluate((grid) => {
      const positions = [...grid.children].map((step) => Math.round(step.getBoundingClientRect().left));
      return new Set(positions).size === 3;
    }),
    'percurso de valor organiza os três momentos em colunas no desktop',
  );
  check(errors.length === 0, 'sem erros no console', errors.slice(0, 3).join(' | '));

  await context.close();
  await browser.close();
  process.exit(results.every(Boolean) ? 0 : 1);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
