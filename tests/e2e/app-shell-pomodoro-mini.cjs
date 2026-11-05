const { chromium } = require('playwright');

const BASE = process.argv[2] || 'http://127.0.0.1:5173';
const results = [];
const check = (passed, name, detail = '') => {
  results.push(passed);
  console.log(`${passed ? 'OK   ' : 'FALHA'} — ${name}${detail ? ` (${detail})` : ''}`);
};

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.goto(`${BASE}/?preview#pomodoro`);
  const timerToggle = page.locator('[data-action="toggle-free-timer"]');
  await timerToggle.waitFor();
  check(await page.locator('#pomodoro-mini').isHidden(), 'mini controle fica oculto na tela completa do Pomodoro');
  const dialFit = [];
  for (const width of [320, 390, 768, 900, 1100, 1366]) {
    await page.setViewportSize({ width, height: 844 });
    dialFit.push(await page.locator('.focus-clock').evaluate((clock) => ({
      width: innerWidth,
      timerFits: clock.querySelector('.timer').scrollWidth <= clock.clientWidth - 4,
    })));
  }
  check(dialFit.every(({ timerFits }) => timerFits), 'tempo do Pomodoro cabe dentro do mostrador sem cortar as bordas', JSON.stringify(dialFit));
  await page.setViewportSize({ width: 1280, height: 900 });
  await timerToggle.click();
  await page.locator('.topbar .nav a[href="/planejar"]').first().click();

  const mini = page.locator('#pomodoro-mini');
  const miniToggle = page.getByRole('button', { name: 'Pausar Pomodoro' });
  await mini.waitFor({ state: 'visible' });
  check(await mini.isVisible(), 'mini Pomodoro acompanha a navegação para outra área');
  check(await mini.locator('#pomodoro-mini-phase').textContent() === 'Foco · em andamento', 'fase e estado do timer são apresentados');

  const runningClock = await mini.locator('#pomodoro-mini-clock').textContent();
  await page.waitForFunction(
    (initialClock) => document.querySelector('#pomodoro-mini-clock')?.textContent !== initialClock,
    runningClock,
    { timeout: 3500 },
  );
  check(await mini.locator('#pomodoro-mini-clock').textContent() !== runningClock, 'tempo restante atualiza sem duplicar o timer');

  await miniToggle.focus();
  await page.keyboard.press('Enter');
  const pausedToggle = page.getByRole('button', { name: 'Retomar Pomodoro' });
  await pausedToggle.waitFor();
  const pausedClock = await mini.locator('#pomodoro-mini-clock').textContent();
  await page.waitForTimeout(1200);
  check(await mini.locator('#pomodoro-mini-phase').textContent() === 'Foco · pausado', 'timer pode ser pausado pelo teclado');
  check(await mini.locator('#pomodoro-mini-clock').textContent() === pausedClock, 'contagem permanece parada após pausar');

  await pausedToggle.focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Pausar Pomodoro' }).waitFor();
  check(await mini.locator('#pomodoro-mini-phase').textContent() === 'Foco · em andamento', 'timer pode ser retomado pelo teclado');

  for (const width of [320, 390, 768, 1024, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `mini Pomodoro não causa overflow em ${width} px`);
    check(await mini.isVisible(), `mini Pomodoro permanece visível em ${width} px`);
    check(
      await mini.evaluate((element) => element.getBoundingClientRect().width <= Math.min(440, innerWidth)),
      `mini Pomodoro mantém largura compacta em ${width} px`,
    );
  }

  await mini.locator('#pomodoro-mini-open').focus();
  await page.keyboard.press('Enter');
  await page.locator('.free-pomodoro').waitFor();
  check(new URL(page.url()).pathname === '/pomodoro', 'atalho por teclado retorna à tela completa do Pomodoro');
  check(await mini.isHidden(), 'mini controle não duplica a tela completa');
  check(errors.length === 0, 'sem erros no console', errors.slice(0, 3).join(' | '));

  await context.close();
  await browser.close();
  process.exit(results.every(Boolean) ? 0 : 1);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
