const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const BASE = process.argv[2] || 'http://127.0.0.1:5173';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.goto(BASE);
  await page.locator('.public-hero').waitFor();

  assert.equal(await page.locator('.public-hero h1').count(), 1);
  assert.equal(await page.locator('.landing-tutorial-tab').count(), 5);
  assert.equal(await page.locator('.landing-tutorial-panel:visible').count(), 1);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);

  await page.keyboard.press('Tab');
  assert.equal(await page.locator('.public-site > .skip:first-child').evaluate((link) =>
    document.activeElement === link && link.getAttribute('href') === '#landing-main'), true);

  const themeButton = page.locator('[data-public-control="theme-cycle"]');
  await themeButton.click();
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'dark');
  assert.match(await themeButton.getAttribute('title'), /Tema atual: escuro/);
  await themeButton.click();
  assert.match(await themeButton.getAttribute('title'), /Tema atual: automático/);
  await themeButton.click();
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'light');
  assert.match(await themeButton.getAttribute('title'), /Tema atual: claro/);

  const tabs = page.getByRole('tablist', { name: 'Áreas da sua rotina' });
  await tabs.getByRole('tab', { name: 'Hoje' }).click();
  await tabs.getByRole('tab', { name: 'Tarefas' }).click();
  assert.equal(await tabs.getByRole('tab', { name: 'Tarefas' }).getAttribute('aria-selected'), 'true');
  assert.equal(await page.locator('.landing-tutorial-panel:visible').getAttribute('data-area'), 'tarefas');

  const faq = page.locator('.public-faq-item').first();
  await faq.locator('summary').click();
  assert.equal(await faq.evaluate((item) => item.open), true);

  await page.setViewportSize({ width: 320, height: 720 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);

  await page.goto(`${BASE}/demonstracao`);
  assert.doesNotMatch(await page.locator('body').innerText(), /Ã|Â|ðŸ|â€”|â€|âˆ/);
  const homeHabit = page.locator('.home-habit-checkins [data-demo-action="habit-toggle"]');
  await homeHabit.waitFor();
  assert.equal(
    await page.locator('.home-task-groups .home-task-group').getByText('Ler por alguns minutos', { exact: true }).count(),
    1,
  );
  assert.equal(await page.getByText('Alongar um pouquinho', { exact: true }).count(), 1);
  const habitDay = await homeHabit.getAttribute('data-day-index');
  const initialPressed = await homeHabit.getAttribute('aria-pressed');
  const initialStatus = initialPressed === 'true' ? 'Concluído hoje' : 'Ainda não marcado';
  const nextStatus = initialPressed === 'true' ? 'Ainda não marcado' : 'Concluído hoje';
  assert.equal(await page.locator('.home-habit-checkins').getByText(initialStatus, { exact: true }).count(), 1);
  await homeHabit.click();
  const updatedHomeHabit = page.locator(`.home-habit-checkins [data-day-index="${habitDay}"]`);
  assert.notEqual(await updatedHomeHabit.getAttribute('aria-pressed'), initialPressed);
  assert.equal(await page.locator('.home-habit-checkins').getByText(nextStatus, { exact: true }).count(), 1);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.locator('.demo-nav a[data-demo-view="habits"]').click();
  assert.equal(
    await page.locator(`.demo-habit-card--large [data-habit-id="alongar"][data-day-index="${habitDay}"]`).getAttribute('aria-pressed'),
    initialPressed === 'true' ? 'false' : 'true',
  );

  assert.deepEqual(errors, []);

  await browser.close();
  console.log('Landing atual: hero, abas, tema, FAQ, hábitos da demonstração e responsividade verificados.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
