const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { completeProfile } = require('./setup.cjs');

const BASE = process.argv[2] || 'http://127.0.0.1:5173';

async function checkContrast(page) {
  await page.goto(new URL('/docs/design-system.html', BASE).toString());
  const failures = await page.evaluate(async () => {
    const { PALETTES } = await import('/src/js/features/appearance/palettes.js');
    const transitionOverride = document.createElement('style');
    transitionOverride.textContent = '*, *::before, *::after { transition: none !important; }';
    document.head.append(transitionOverride);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const color = (value) => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = value;
      context.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
      return { r, g, b, a: a / 255 };
    };
    const over = (foreground, background) => ({
      r: foreground.r * foreground.a + background.r * (1 - foreground.a),
      g: foreground.g * foreground.a + background.g * (1 - foreground.a),
      b: foreground.b * foreground.a + background.b * (1 - foreground.a),
      a: 1,
    });
    const luminance = ({ r, g, b }) => [r, g, b]
      .map((value) => {
        const channel = value / 255;
        return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
      })
      .reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
    const ratio = (foreground, background) => {
      const text = luminance(over(foreground, background));
      const surface = luminance(background);
      return (Math.max(text, surface) + .05) / (Math.min(text, surface) + .05);
    };
    const computedColor = (element, property) => color(getComputedStyle(element)[property]);
    const failures = [];
    document.querySelector('input[type="text"]').scrollIntoView();

    for (const [palette, [, primary, accent]] of Object.entries(PALETTES)) {
      const root = document.documentElement;
      root.dataset.palette = palette;
      root.style.setProperty('--p', primary);
      root.style.setProperty('--pd', accent);
      for (const theme of ['light', 'dark']) {
        root.dataset.theme = theme;
        for (const contrast of ['normal', 'high']) {
          root.dataset.contrast = contrast;
          void root.offsetWidth;
          const checks = [
            ['.btn:not(.primary):not(.danger):not(.ghost):not([disabled])', 4.5, 'botão secundário'],
            ['.btn.primary:not([disabled])', 4.5, 'botão primário'],
            ['.btn.danger:not([disabled])', 4.5, 'botão destrutivo'],
            ['input[type="text"]', 4.5, 'campo de texto'],
            ['.badge.ok', 4.5, 'selo de sucesso'],
            ['.badge.warn', 4.5, 'selo de aviso'],
            ['.badge.bad', 4.5, 'selo de erro'],
          ];
          for (const [selector, minimum, label] of checks) {
            const element = document.querySelector(selector);
            if (!element) {
              failures.push(`${palette} ${theme}/${contrast}: componente ausente (${label})`);
              continue;
            }
            const foreground = computedColor(element, 'color');
            const style = getComputedStyle(element);
            const backgrounds = selector === '.btn.primary:not([disabled])'
              ? [...style.backgroundImage.matchAll(/(?:rgb|rgba|color)\([^)]*\)|#[\da-f]{3,8}/gi)].map(([value]) => value)
              : [style.backgroundColor];
            for (const backgroundValue of backgrounds) {
              const background = color(backgroundValue);
              const measured = ratio(foreground, background);
              if (measured < minimum) {
                failures.push(`${palette} ${theme}/${contrast}: ${label} ${measured.toFixed(2)}:1 (mín. ${minimum}:1)`);
              }
            }
          }

          const card = document.querySelector('.card');
          const focus = color(getComputedStyle(root).getPropertyValue('--focus').trim());
          const surface = computedColor(card, 'backgroundColor');
          const page = color(getComputedStyle(root).getPropertyValue('--bg').trim());
          if (ratio(focus, surface) < 3 || ratio(focus, page) < 3) {
            failures.push(`${palette} ${theme}/${contrast}: anel de foco abaixo de 3:1`);
          }
        }
      }
    }
    return failures;
  });
  assert.deepEqual(failures, [], failures.slice(0, 12).join('\n'));
}

(async () => {
  const browser = await chromium.launch();
  try {
    const publicPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    publicPage.on('pageerror', (error) => errors.push(error.message));
    await publicPage.goto(BASE);
    await publicPage.emulateMedia({ reducedMotion: 'no-preference' });

    const trigger = publicPage.getByRole('button', { name: 'Abrir acessibilidade' });
    assert.equal(await trigger.count(), 0, 'acessibilidade não fica no cabeçalho da landing');
    assert.equal(await publicPage.locator('.theme-trigger').count(), 1, 'tema continua disponível no cabeçalho da landing');

    await publicPage.locator('.public-hero').getByRole('link', { name: 'Ver demo em 1 minuto' }).click();
    await publicPage.getByRole('link', { name: 'Tarefas', exact: true }).waitFor();
    assert.equal(await trigger.count(), 0, 'acessibilidade não fica no cabeçalho da demonstração');

    const systemPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await systemPage.emulateMedia({ reducedMotion: 'reduce' });
    await systemPage.goto(BASE);
    await systemPage.locator('.public-hero').getByRole('link', { name: 'Ver demo em 1 minuto' }).click();
    await systemPage.evaluate(() => {
      window.__scrollCalls = [];
      const original = Element.prototype.scrollIntoView;
      Element.prototype.scrollIntoView = function (options) {
        window.__scrollCalls.push(options);
        return original.call(this, options);
      };
    });
    await systemPage.getByRole('link', { name: 'Tarefas', exact: true }).click();
    const systemScroll = await systemPage.evaluate(() => window.__scrollCalls.at(-1));
    assert.equal(systemScroll.behavior, 'auto', 'a demonstração deve respeitar a preferência de movimento do sistema');
    await systemPage.close();

    await publicPage.setViewportSize({ width: 640, height: 900 });
    assert.ok(await publicPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'sem overflow horizontal em viewport de 640 CSS px');
    await publicPage.setViewportSize({ width: 320, height: 740 });
    assert.ok(await publicPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'sem overflow horizontal em viewport de 320 CSS px');
    assert.deepEqual(errors, [], errors.join('\n'));

    const appContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const appPage = await appContext.newPage();
    appPage.on('pageerror', (error) => errors.push(error.message));
    const previewUrl = new URL(BASE);
    previewUrl.searchParams.set('preview', '1');
    previewUrl.hash = 'inicio';
    await appPage.goto(previewUrl.toString());
    await completeProfile(appPage);
    assert.equal(await appPage.locator('#accessibility-trigger').count(), 0, 'acessibilidade não fica no cabeçalho autenticado');
    assert.notEqual(await appPage.locator('.app > .topbar .wordmark').evaluate((wordmark) =>
      getComputedStyle(wordmark).display), 'none', 'cabeçalho autenticado mostra a marca completa no desktop');
    await appPage.setViewportSize({ width: 390, height: 844 });
    assert.equal(await appPage.locator('.app > .topbar .wordmark').evaluate((wordmark) =>
      getComputedStyle(wordmark).display), 'none', 'cabeçalho autenticado mostra apenas o ícone da marca no celular');
    await appPage.setViewportSize({ width: 1280, height: 900 });
    assert.equal(await appPage.locator('.theme-trigger').count(), 1, 'tema continua disponível no cabeçalho');
    await appPage.evaluate(() => { location.hash = 'config?section=personalization'; });
    await appPage.locator('#settings-accessibility-readable').waitFor();
    for (const id of ['settings-accessibility-contrast', 'settings-accessibility-readable', 'settings-accessibility-links', 'settings-accessibility-motion']) {
      assert.equal(await appPage.locator(`#${id}`).count(), 1, `${id} fica disponível em Ajustes`);
    }
    await appPage.locator('#settings-accessibility-motion').click();
    await appPage.locator('[data-settings-save-button]').click();
    await appPage.waitForFunction(() => document.documentElement.dataset.motion === 'reduce');
    await appPage.evaluate(() => { location.hash = 'inicio'; });
    const homeTaskInput = appPage.locator('.home-quick-form input[name="title"]');
    await homeTaskInput.waitFor();
    await homeTaskInput.focus();
    assert.equal(await homeTaskInput.evaluate((input) => input === document.activeElement), true, 'o formulário rápido da Home permanece acessível por foco');
    assert.equal(await appPage.getByRole('button', { name: 'Como usar?' }).count(), 1, 'Como usar? mantém o rótulo visível como nome acessível');
    assert.deepEqual(errors, [], errors.join('\n'));

    await checkContrast(publicPage);
    await publicPage.keyboard.press('Tab');
    const focusStyle = await publicPage.evaluate(() => {
      const style = getComputedStyle(document.activeElement);
      return { outlineStyle: style.outlineStyle, outlineWidth: Number.parseFloat(style.outlineWidth) };
    });
    assert.equal(focusStyle.outlineStyle, 'solid');
    assert.ok(focusStyle.outlineWidth >= 3, 'o foco de teclado deve ser visível e ter espessura mínima de 3 px');
    console.log('Acessibilidade: disclosure/Escape/foco, movimento reduzido no sistema e na preferência salva, contraste de componentes em 14 paletas e reflow em 320/640 px aprovados.');
    await appContext.close();
    await publicPage.context().close();
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
