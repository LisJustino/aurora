// Fluxos de ponta a ponta no navegador real. NÃO é dependência do projeto (não há package.json).
// Uso: sirva a pasta do projeto (python3 -m http.server 8765), tenha o Playwright instalado
// no seu computador e rode: node tests/e2e/flows.cjs [http://localhost:8765]
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'http://localhost:8765';
const results = [];
const check = (passed, name, detail = '') => { results.push(passed); console.log(`${passed ? 'OK   ' : 'FALHA'} — ${name}${detail ? ` (${detail})` : ''}`); };

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  for (const [label, viewport] of [['celular', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 900 }]]) {
    const context = await browser.newContext({ viewport, serviceWorkers: 'allow' });
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(`${label}: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`${label}: ${m.text()}`); });
    const go = async (route) => { await page.evaluate((r) => { location.hash = r; }, route); await page.waitForTimeout(400); };
    await page.goto(BASE); await page.waitForTimeout(500);
    await page.getByText('ver um exemplo').first().click().catch(() => {});
    await page.waitForTimeout(600);

    // Hábitos: marcar dia passado, desfazer, reordenar
    await page.evaluate(() => {
      const habits = ['a', 'b', 'c'].map((id, i) => ({ id, name: ['Ler', 'Meditar', 'Alongar'][i], days: [0, 1, 2, 3, 4, 5, 6], completions: [], status: 'active' }));
      localStorage.setItem('aurora.app.habits', JSON.stringify({ v: habits, t: Date.now() }));
    });
    await page.reload(); await page.waitForTimeout(500); await go('habitos');
    await page.evaluate(() => document.querySelector('#d-hab-b > summary').click()); await page.waitForTimeout(300);
    await page.evaluate(() => ([...document.querySelectorAll('#d-hab-b .habit-dot:not(:disabled):not(.is-today)')][0] || document.querySelector('#d-hab-b .habit-dot.is-today')).click()); await page.waitForTimeout(300);
    const read = () => page.evaluate(() => JSON.parse(localStorage.getItem('aurora.app.habits')).v);
    check((await read()).find((h) => h.id === 'b').completions.length === 1, `${label}: marca um dia (passado, ou hoje se a semana só tem hoje)`);
    await page.evaluate(() => document.querySelector('[data-action="undo"]').click()); await page.waitForTimeout(300);
    check((await read()).find((h) => h.id === 'b').completions.length === 0, `${label}: desfazer reverte a marcação`);
    await page.evaluate(() => document.querySelector('[data-action="habit-move"][data-id="b"][data-dir="1"]').click()); await page.waitForTimeout(300);
    check((await read()).map((h) => h.id).join('') === 'acb', `${label}: reordenar persiste`);
    check(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), `${label}: Hábitos sem rolagem horizontal`);

    // Pomodoro: rótulo opcional
    await go('pomodoro');
    await page.fill('#pomo-focus-label', ' Inglês '); await page.press('#pomo-focus-label', 'Tab'); await page.waitForTimeout(300);
    check(await page.evaluate(() => JSON.parse(localStorage.getItem('aurora.app.pomodoro')).v.focusLabel) === 'Inglês', `${label}: rótulo do Pomodoro salvo`);

    // Início: hábito pendente dá lugar à fatura quando é concluído
    await page.evaluate(() => {
      const settings = JSON.parse(localStorage.getItem('aurora.app.settings'));
      settings.v.areas.habits = true; settings.v.areas.finances = true;
      localStorage.setItem('aurora.app.settings', JSON.stringify(settings));
      const now = new Date(), day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const dueDay = now.getDate() === daysInMonth ? 1 : Math.min(daysInMonth, now.getDate() + 5);
      localStorage.setItem('aurora.app.tasks', JSON.stringify({ v: [], t: Date.now() }));
      localStorage.setItem('aurora.app.habits', JSON.stringify({ v: [
        { id: 'water-test', name: 'Água', days: [0, 1, 2, 3, 4, 5, 6], completions: [], status: 'archived', tracking: 'water' },
        { id: 'habit-next', name: 'Alongar', days: [now.getDay()], completions: [], status: 'active' },
      ], t: Date.now() }));
      localStorage.setItem('aurora.app.finance', JSON.stringify({ v: {
        accounts: [{ id: 'card-test', name: 'Cartão teste', type: 'credit', initialCents: 0, limitCents: 100000, closingDay: now.getDate(), dueDay }],
        tx: [{ id: 'purchase-test', type: 'out', accountId: 'card-test', cents: 10000, date: day, paid: true, createdAt: Date.now() }],
        budgets: {}, goals: [], recurring: [],
      }, t: Date.now() }));
    });
    await page.reload(); await page.waitForTimeout(500); await go('inicio');
    check((await page.locator('.home-next-action').innerText()).toLowerCase().includes('alongar'), `${label}: Início destaca hábito pendente`);
    await page.evaluate(() => {
      const stored = JSON.parse(localStorage.getItem('aurora.app.habits'));
      const now = new Date(), day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      stored.v.find((habit) => habit.id === 'habit-next').completions = [day];
      localStorage.setItem('aurora.app.habits', JSON.stringify(stored));
    });
    await page.reload(); await page.waitForTimeout(500); await go('inicio');
    check((await page.locator('.home-next-action').innerText()).toLowerCase().includes('fatura de cartão teste'), `${label}: após o hábito, Início destaca fatura próxima`);

    // Início e Pomodoro: escolher a próxima tarefa, iniciar o foco e atribuir o tempo
    await page.evaluate(() => {
      const settings = JSON.parse(localStorage.getItem('aurora.app.settings'));
      settings.v.areas.pomodoro = true;
      localStorage.setItem('aurora.app.settings', JSON.stringify(settings));
      const now = new Date(), day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      localStorage.setItem('aurora.app.tasks', JSON.stringify({ v: [{ id: 'focus-flow', title: 'Revisar proposta', done: false, tag: 'Pessoal', dueDate: day, time: '16:00', priority: 'normal', createdAt: Date.now() }], t: Date.now() }));
    });
    await page.reload(); await page.waitForTimeout(500); await go('inicio');
    check((await page.locator('.home-next-action').innerText()).toLowerCase().includes('revisar proposta'), `${label}: Início destaca a tarefa com horário`);
    await page.locator('.home-next-action [data-action="task-focus"]').evaluate((button) => button.click()); await page.waitForTimeout(400);
    check(page.url().endsWith('#pomodoro') && (await page.locator('main').innerText()).toLowerCase().includes('tarefa: revisar proposta'), `${label}: Pomodoro inicia vinculado à tarefa`);
    await page.evaluate(() => {
      const timer = JSON.parse(localStorage.getItem('aurora.app.pomodoro'));
      timer.v.startedAt = null;
      timer.v.phaseElapsedSeconds = 61;
      localStorage.setItem('aurora.app.pomodoro', JSON.stringify(timer));
    });
    await page.reload(); await page.waitForTimeout(500);
    await page.locator('[data-action="finish-free-timer"]').evaluate((button) => button.click()); await page.waitForTimeout(300);
    const focusedTask = await page.evaluate(() => JSON.parse(localStorage.getItem('aurora.app.tasks')).v.find((task) => task.id === 'focus-flow'));
    check(focusedTask.focusSeconds === 61, `${label}: conclusão salva o tempo de foco na tarefa`);
    await go('inicio');
    check((await page.locator('.home-today-card').innerText()).toLowerCase().includes('foco 1 min'), `${label}: tempo focado aparece junto à tarefa`);

    // Tema: o botão do cabeçalho alterna e persiste
    const mode = () => page.evaluate(() => JSON.parse(localStorage.getItem('aurora.app.settings') || '{}').v?.look?.mode);
    const before = await mode();
    await page.evaluate(() => document.querySelector('.theme-trigger').click()); await page.waitForTimeout(300);
    check((await mode()) !== before, `${label}: botão de tema altera o modo`);

    // Erro de formulário aparece junto ao campo, com foco e aria-invalid
    await go('habitos');
    await page.evaluate(() => document.querySelector('[data-action="habit-new"]').click()); await page.waitForTimeout(400);
    await page.evaluate(() => { const f = document.querySelector('#dlgform'); f.noValidate = true; f.requestSubmit(); }); await page.waitForTimeout(300);
    check(await page.evaluate(() => !!document.querySelector('#dlg .field-err') && document.activeElement?.getAttribute('aria-invalid') === 'true'), `${label}: erro do formulário fica no campo`);
    await page.reload(); await page.waitForTimeout(500);

    // Atalho N abre criação rápida, mas não dentro de campos
    await go('inicio');
    await page.keyboard.press('n'); await page.waitForTimeout(300);
    check(await page.evaluate(() => !!document.querySelector('dialog[open], [role="dialog"]')), `${label}: atalho N abre criação rápida`);
    await page.keyboard.press('Escape'); await page.waitForTimeout(200);
    await context.close();
  }

  // Offline
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'allow' });
  const page = await context.newPage();
  await page.goto(BASE); await page.waitForTimeout(1500); await page.reload(); await page.waitForTimeout(1500);
  await context.setOffline(true); await page.reload(); await page.waitForTimeout(1500);
  check(await page.evaluate(() => document.body.innerText.length > 50), 'offline: o app abre sem rede depois da primeira visita');
  await context.close();

  check(!errors.length, 'sem erros no console', errors.slice(0, 3).join(' | '));
  await browser.close();
  process.exit(results.every(Boolean) ? 0 : 1);
})();
