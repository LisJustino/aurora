const { chromium } = require('playwright');

const BASE = process.argv[2] || 'http://127.0.0.1:5173';
const results = [];
const check = (passed, name, detail = '') => {
  results.push(passed);
  console.log(`${passed ? 'OK   ' : 'FALHA'} — ${name}${detail ? ` (${detail})` : ''}`);
};
const swipe = async (page, locator, direction) => {
  await locator.evaluate((target, direction) => {
    const bounds = target.getBoundingClientRect();
    const startX = bounds.left + bounds.width / 2;
    const startY = bounds.top + bounds.height / 2;
    const endX = startX + (direction === 'left' ? -120 : 120);
    const pointer = (type, x) => new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: 74,
      pointerType: 'touch',
      isPrimary: true,
      clientX: x,
      clientY: startY,
    });
    target.dispatchEvent(pointer('pointerdown', startX));
    document.dispatchEvent(pointer('pointermove', endX));
    document.dispatchEvent(pointer('pointerup', endX));
  }, direction);
  await page.waitForTimeout(240);
};

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.goto(`${BASE}/?preview#planejar`);
  const task = page.locator('.task').filter({ hasText: 'Organizar documentos' });
  await task.waitFor({ state: 'visible' });
  const dueDate = async () => {
    await task.locator('.tt[data-action="edit-task"]').click();
    const date = await page.locator('#dlg [data-dlg="due"]').inputValue();
    await page.locator('#dlg [data-action="dlg-close"]').first().click();
    return date;
  };
  const originalDate = await dueDate();

  await swipe(page, task.locator('.tt'), 'left');
  await page.locator('#toast').getByRole('button', { name: 'Desfazer' }).waitFor({ state: 'visible' });
  check(await task.evaluate((row) => row.classList.contains('done')),
    'deslizar à esquerda conclui a tarefa');
  await page.locator('#toast').getByRole('button', { name: 'Desfazer' }).click();
  await task.waitFor({ state: 'visible' });
  check(!await task.evaluate((row) => row.classList.contains('done')),
    'desfazer restaura a tarefa concluída por gesto');

  await swipe(page, task.locator('.tt'), 'right');
  await page.locator('#toast').getByRole('button', { name: 'Desfazer' }).waitFor({ state: 'visible' });
  const deferredDate = await dueDate();
  check(deferredDate !== originalDate, 'deslizar à direita adia a tarefa para o próximo dia');
  await page.locator('#toast').getByRole('button', { name: 'Desfazer' }).click();
  check(await dueDate() === originalDate, 'desfazer restaura o prazo original da tarefa');
  check(errors.length === 0, 'sem erros no console', errors.slice(0, 3).join(' | '));

  await context.close();
  await browser.close();
  process.exit(results.every(Boolean) ? 0 : 1);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
