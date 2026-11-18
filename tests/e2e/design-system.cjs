const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const base = process.argv[2] || 'http://127.0.0.1:5179';

(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of ['/', '/?preview#inicio']) {
        await page.goto(`${base}${route}`);
        const hero = page.locator(route === '/' ? '.public-hero' : '.home-head');
        await hero.waitFor({ state: 'visible' });
        await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; animation: none !important; }' });
        const themeShadows = [];
        for (const theme of ['light', 'dark']) {
          await page.evaluate((value) => { document.documentElement.dataset.theme = value; }, theme);
          const styles = await page.evaluate((selector) => {
            const root = getComputedStyle(document.documentElement);
            const probe = document.createElement('div');
            probe.style.boxShadow = 'var(--elev-2)';
            document.body.append(probe);
            const expected = getComputedStyle(probe).boxShadow;
            probe.remove();
            const heroStyle = getComputedStyle(document.querySelector(selector));
            const card = document.querySelector(selector === '.public-hero' ? '.public-community' : '.home-quick-card');
            const cardStyle = getComputedStyle(card);
            const dialog = document.createElement('div');
            dialog.className = 'dlg';
            document.body.append(dialog);
            const dialogStyle = getComputedStyle(dialog);
            const dialogRadius = dialogStyle.borderRadius;
            const dialogShadow = dialogStyle.boxShadow;
            dialog.remove();
            return {
              tokens: ['--r-sm', '--r-card', '--r-hero', '--r-pill', '--elev-0'].map((name) => root.getPropertyValue(name).trim()),
              aliases: ['--r', '--r-control', '--r-group', '--r-public-hero'].map((name) => root.getPropertyValue(name).trim()),
              heroRadius: heroStyle.borderRadius,
              heroShadow: heroStyle.boxShadow,
              expected,
              cardRadius: cardStyle.borderRadius,
              cardShadow: cardStyle.boxShadow,
              dialogRadius,
              dialogShadow,
            };
          }, route === '/' ? '.public-hero' : '.home-head');
          assert.deepEqual(styles.tokens, ['14px', '24px', '32px', '999px', 'none']);
          assert.deepEqual(styles.aliases, ['14px', '14px', '14px', '32px']);
          assert.equal(styles.heroRadius, '0px', `${route} ${width}px ${theme}: destaque editorial sem cartão`);
          assert.equal(styles.heroShadow, 'none', `${route} ${width}px ${theme}: destaque sem elevação de cartão`);
          assert.equal(styles.cardRadius, '0px', `${route} ${width}px ${theme}: seção editorial aberta`);
          assert.equal(styles.cardShadow, 'none', `${route} ${width}px ${theme}: seção sem elevação de cartão`);
          assert.equal(styles.dialogRadius, width < 900 ? '32px 32px 0px 0px' : '32px');
          assert.equal(styles.dialogShadow, styles.expected);
          themeShadows.push(styles.expected);
        }
        assert.notEqual(themeShadows[0], themeShadows[1], `${route} ${width}px: elevações adaptadas ao tema`);
        await page.emulateMedia({ colorScheme: 'dark' });
        const automaticShadow = await page.evaluate(() => {
          delete document.documentElement.dataset.theme;
          const probe = document.createElement('div');
          probe.style.boxShadow = 'var(--elev-2)';
          document.body.append(probe);
          const shadow = getComputedStyle(probe).boxShadow;
          probe.remove();
          return shadow;
        });
        assert.equal(automaticShadow, themeShadows[1], `${route} ${width}px: tema escuro automático`);
      }
    }
    console.log('OK — raios e elevações em destaques, seções e diálogos');
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of ['inicio', 'financas', 'habitos']) {
        await page.goto(`${base}/?preview#${route}`);
        await page.locator('.main[data-route]').waitFor();
        await page.waitForFunction((expected) => document.querySelector('.main[data-route]')?.dataset.route === expected, route);
        await page.waitForFunction(() => {
          const heading = document.querySelector('.main > .page-title h1') || document.querySelector('.home-head h1');
          return heading && getComputedStyle(heading).fontFamily.includes('Georgia');
        });
        const cohesion = await page.evaluate(() => {
          const title = document.querySelector('.main > .page-title') || document.querySelector('.home-head');
          const heading = title.querySelector('h1');
          const probe = document.createElement('span');
          probe.style.color = 'var(--accent)';
          document.body.append(probe);
          const accent = getComputedStyle(probe).color;
          probe.remove();
          const selectedTab = document.querySelector('.fin-section-menu .tab[aria-selected="true"]');
          return {
            font: getComputedStyle(heading).fontFamily,
            background: getComputedStyle(title).backgroundColor,
            borderBottom: getComputedStyle(title).borderBottomStyle,
            selectedTabColor: selectedTab && getComputedStyle(selectedTab).color,
            accent,
            overflow: document.documentElement.scrollWidth > innerWidth,
          };
        });
        assert.ok(cohesion.font.includes('Georgia'), `${route} ${width}px: título editorial compartilhado`);
        assert.equal(cohesion.background, 'rgba(0, 0, 0, 0)', `${route} ${width}px: cabeçalho aberto`);
        assert.equal(cohesion.borderBottom, 'solid', `${route} ${width}px: divisor editorial`);
        assert.equal(cohesion.overflow, false, `${route} ${width}px: sem rolagem horizontal`);
        if (route === 'financas') assert.equal(cohesion.selectedTabColor, cohesion.accent, `${route} ${width}px: aba usa acento da marca`);
      }
    }
    console.log('OK — títulos e navegação compartilham a linguagem editorial');
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
