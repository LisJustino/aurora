const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const base = new URL((process.argv[2] || 'http://127.0.0.1:5173').replace(/\/$/, '/'));
const url = new URL('/docs/design-system.html', base);

(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.goto(url.toString());
    const combo = page.getByRole('combobox', { name: 'Frequência' });
    const native = page.locator('select[name="frequency"]');
    await combo.waitFor();
    assert.equal(await combo.getAttribute('aria-expanded'), 'false');
    assert.equal(await combo.getAttribute('aria-required'), 'true');
    assert.equal(await native.getAttribute('aria-hidden'), 'true');
    assert.equal(await native.evaluate((select) => select.checkValidity()), false);

    await native.evaluate((select) => {
      select.dataset.events = '';
      select.addEventListener('input', () => { select.dataset.events += 'input '; });
      select.addEventListener('change', () => { select.dataset.events += 'change'; });
    });
    await combo.press('ArrowDown');
    assert.equal(await combo.getAttribute('aria-expanded'), 'true');
    await combo.press('Enter');
    assert.equal(await native.inputValue(), 'weekly');
    assert.equal(await native.evaluate((select) => select.dataset.events), 'input change');
    assert.equal(await combo.getAttribute('aria-expanded'), 'false');

    await combo.click();
    await combo.press('Escape');
    assert.equal(await combo.getAttribute('aria-expanded'), 'false');

    await combo.click();
    const menu = page.getByRole('listbox', { name: 'Frequência' });
    const selected = menu.getByRole('option', { name: 'Uma vez por semana' });
    const selectedColor = await selected.evaluate((option) => getComputedStyle(option).backgroundColor);
    assert.notEqual(selectedColor, 'rgb(0, 120, 215)');
    await menu.getByRole('option', { name: 'Todos os dias' }).click();
    assert.equal(await native.inputValue(), 'daily');
    assert.equal(await native.evaluate((select) => new FormData(select.form).get('frequency')), 'daily');

    await native.evaluate((select) => {
      select.value = 'weekly';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    assert.match(await combo.textContent(), /Uma vez por semana/);
    await native.evaluate((select) => { select.disabled = true; });
    await page.waitForFunction(() => document.querySelector('select[name="frequency"]').nextElementSibling.getAttribute('aria-disabled') === 'true');
    await native.evaluate((select) => { select.disabled = false; });
    await page.waitForFunction(() => document.querySelector('select[name="frequency"]').nextElementSibling.getAttribute('aria-disabled') === 'false');

    await page.evaluate(() => {
      const select = document.createElement('select');
      select.setAttribute('aria-label', 'Opção dinâmica');
      select.innerHTML = '<option value="one">Primeira opção</option>';
      document.body.append(select);
    });
    const dynamic = page.getByRole('combobox', { name: 'Opção dinâmica' });
    await dynamic.waitFor();
    await dynamic.click();
    assert.equal(await page.getByRole('option', { name: 'Primeira opção' }).count(), 1);
    await page.getByRole('option', { name: 'Primeira opção' }).click();

    const unavailable = page.getByRole('combobox', { name: 'Seleção indisponível' });
    assert.equal(await unavailable.getAttribute('aria-disabled'), 'true');
    await unavailable.evaluate((element) => element.click());
    assert.equal(await unavailable.getAttribute('aria-expanded'), 'false');

    const invalid = page.getByRole('combobox', { name: 'Seleção com erro' });
    assert.equal(await invalid.getAttribute('aria-invalid'), 'true');
    assert.equal(await invalid.getAttribute('aria-describedby'), 'ds-select-error');

    await page.getByRole('button', { name: 'escuro' }).click();
    await combo.click();
    const darkSurface = await page.getByRole('listbox', { name: 'Frequência' })
      .evaluate((element) => getComputedStyle(element).backgroundColor);
    assert.notEqual(darkSurface, 'rgb(255, 255, 255)');

    await page.setViewportSize({ width: 390, height: 844 });
    await combo.scrollIntoViewIfNeeded();
    await combo.click();
    const bounds = await page.getByRole('listbox', { name: 'Frequência' }).evaluate((element) => {
      const { top, right, bottom, left } = element.getBoundingClientRect();
      return { top, right, bottom, left };
    });
    assert.ok(bounds.top >= 0 && bounds.bottom <= 844, `Menu fora da viewport vertical: ${JSON.stringify(bounds)}`);
    assert.ok(bounds.left >= 0 && bounds.right <= 390, `Menu fora da viewport horizontal: ${JSON.stringify(bounds)}`);
    await page.locator('h1').first().click();
    assert.equal(await combo.getAttribute('aria-expanded'), 'false');
    assert.deepEqual(pageErrors, []);

    const checks = await browser.newPage();
    await checks.goto(new URL('/tests/design-system-check.html', base).toString());
    await checks.waitForFunction(() => document.querySelector('#status')?.textContent.includes('verificações'));
    const status = await checks.locator('#status').textContent();
    const tokenCheck = await checks.locator('#results li').filter({ hasText: 'Toda var(--token) usada existe' }).textContent();
    assert.match(tokenCheck, /^OK/);
    console.log(`Select design system: keyboard, native synchronization, states, themes and mobile placement passed. ${status}`);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
