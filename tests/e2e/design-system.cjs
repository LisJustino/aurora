const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const base = process.argv[2] || 'http://127.0.0.1:5179';

(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${base}/tests/design-system-check.html`);
    await page.waitForFunction(() => !document.querySelector('#status').textContent.includes('Lendo'));
    const failures = await page.locator('#results li').filter({ hasText: 'FALHOU' }).allTextContents();
    assert.deepEqual(errors, [], 'A checagem não deve apresentar erros de JavaScript');
    assert.deepEqual(failures, [], failures.join('\n'));
    console.log(await page.locator('#status').textContent());

    await page.route('**/src/css/pages/landing.css?*', async (route) => {
      const response = await route.fetch();
      const body = await response.text();
      const exported = body.match(/^export default ("(?:\\.|[^"\\])*");?/);
      assert.ok(exported, 'O CSS deve ser carregado como texto pelo Vite');
      const css = `${JSON.parse(exported[1])}\n.spacing-probe { gap: 7px; padding: 9px; }`;
      await route.fulfill({ response, body: `export default ${JSON.stringify(css)};` });
    });
    await page.reload();
    await page.waitForFunction(() => !document.querySelector('#status').textContent.includes('Lendo'));
    const detected = await page.locator('#results li').filter({ hasText: 'FALHOU' }).allTextContents();
    assert.equal(detected.length, 2, `Esperadas duas infrações de espaçamento: ${detected.join('\n')}`);
    assert.ok(detected.some((line) => line.includes('gap:')));
    assert.ok(detected.some((line) => line.includes('padding:')));

    await page.unrouteAll();
    await page.goto(`${base}/tests/contrast-check.html`);
    await page.waitForFunction(() => Array.isArray(window.__contrastFailures));
    const contrastFailures = await page.evaluate(() => window.__contrastFailures);
    assert.deepEqual(contrastFailures, [], contrastFailures.join('\n'));
    console.log(await page.locator('#status').textContent());

    await page.goto(`${base}/?preview#inicio`);
    await page.locator('#d-home-extras > summary').click();
    await page.locator('.home-quick-mark').waitFor();
    for (const width of [360, 390, 768, 1024, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      for (const theme of ['light', 'dark']) {
        await page.evaluate((value) => { document.documentElement.dataset.theme = value; }, theme);
        const layout = await page.evaluate(() => {
          const sizes = (selector) => [...document.querySelectorAll(selector)].map((element) => {
            const style = getComputedStyle(element);
            return [style.width, style.height];
          });
          return {
            nav: sizes('.nav a.nav-item .ni'),
            home: sizes('.home-quick-mark, .home-tool-icon'),
            current: document.querySelectorAll('.nav a.nav-item[aria-current="page"]').length,
            overflow: document.documentElement.scrollWidth > innerWidth,
          };
        });
        assert.ok(layout.nav.length > 0 && layout.nav.every(([w, h]) => w === '32px' && h === '32px'), `${width}px ${theme}: ícones de navegação`);
        assert.ok(layout.home.length > 0 && layout.home.every(([w, h]) => w === '40px' && h === '40px'), `${width}px ${theme}: ícones do Início`);
        assert.equal(layout.current, 1, `${width}px ${theme}: uma área atual`);
        assert.equal(layout.overflow, false, `${width}px ${theme}: sem rolagem horizontal`);
        await page.keyboard.press('Tab');
        const current = page.locator('.nav a.nav-item[aria-current="page"]');
        await current.focus();
        const outline = await current.evaluate((element) => ({
          style: getComputedStyle(element).outlineStyle,
          width: getComputedStyle(element).outlineWidth,
        }));
        assert.equal(outline.style, 'solid', `${width}px ${theme}: foco da navegação visível`);
        assert.equal(outline.width, '3px', `${width}px ${theme}: espessura do foco`);
      }
    }

    await page.setViewportSize({ width: 320, height: 844 });
    await page.goto(`${base}/financas?preview=`);
    await page.getByRole('tab', { name: /Orçamento/ }).click();
    await page.getByRole('button', { name: 'Gerenciar categorias' }).click();
    const form = page.locator('.finance-category-rule-form');
    for (const [width, stacked] of [[320, true], [480, true], [560, false], [1280, false]]) {
      await page.setViewportSize({ width, height: 844 });
      const layout = await form.evaluate((element) => {
        const [first, second] = [...element.children].map((child) => child.getBoundingClientRect());
        return {
          stacked: second.top >= first.bottom,
          separated: second.left >= first.right,
          overflow: document.documentElement.scrollWidth > window.innerWidth,
        };
      });
      assert.equal(layout.overflow, false, `${width}px: formulário não deve causar rolagem horizontal`);
      assert.equal(stacked ? layout.stacked : layout.separated, true, `${width}px: disposição dos campos incorreta`);
    }
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
