const { chromium } = require('playwright');

const BASE = process.argv[2] || 'http://127.0.0.1:5173';
const results = [];
const check = (passed, name, detail = '') => {
  results.push(passed);
  console.log(`${passed ? 'OK   ' : 'FALHA'} — ${name}${detail ? ` (${detail})` : ''}`);
};

function localDateValue(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 320, height: 780 }, isMobile: true, hasTouch: true });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto(BASE);
  await page.getByRole('button', { name: /criar conta/i }).first().click();

  const birthDate = page.locator('#account-birthDate');
  const initialState = await birthDate.evaluate((input) => {
    const rect = input.getBoundingClientRect();
    const style = getComputedStyle(input);
    return {
      type: input.type,
      appearance: style.appearance,
      width: rect.width,
      right: rect.right,
      viewportWidth: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
    };
  });
  check(initialState.type === 'date', 'campo mantém seletor de data nativo');
  check(initialState.appearance !== 'none', 'aparência e controle nativos estão ativos', initialState.appearance);
  check(initialState.width > 0 && initialState.right <= initialState.viewportWidth, 'campo cabe na viewport de 320 px');
  check(initialState.scrollWidth <= initialState.viewportWidth, 'cadastro não tem overflow horizontal em 320 px');

  await page.locator('#account-name').fill('Pessoa de teste');
  await page.locator('#account-preferredName').fill('Teste');
  await birthDate.fill('2000-10-29');
  check(
    (await page.locator('#account-age-status').textContent()).includes('maior de idade'),
    'data válida calcula a idade sem enviar o formulário',
  );
  check(!await page.locator('.account-form button[type="submit"]').isDisabled(), 'data válida libera a etapa seguinte');

  const minorDate = new Date();
  minorDate.setFullYear(minorDate.getFullYear() - 17);
  await birthDate.fill(localDateValue(minorDate));
  check(
    (await page.locator('#account-age-status').textContent()).includes('a partir dos 18 anos'),
    'data de menor de idade continua bloqueada',
  );
  check(await page.locator('.account-form button[type="submit"]').isDisabled(), 'data de menor não libera a etapa');
  check(errors.length === 0, 'sem erros JavaScript', errors.slice(0, 3).join(' | '));

  await page.setViewportSize({ width: 390, height: 844 });
  const at390 = await birthDate.evaluate((input) => {
    const rect = input.getBoundingClientRect();
    return { right: rect.right, viewportWidth: innerWidth, scrollWidth: document.documentElement.scrollWidth };
  });
  check(at390.right <= at390.viewportWidth && at390.scrollWidth <= at390.viewportWidth, 'campo permanece dentro da viewport de 390 px');

  await page.setViewportSize({ width: 1280, height: 900 });
  check(
    await birthDate.evaluate((input) => getComputedStyle(input).appearance !== 'none'),
    'aparência nativa permanece ativa em desktop',
  );

  await browser.close();
  process.exit(results.every(Boolean) ? 0 : 1);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
