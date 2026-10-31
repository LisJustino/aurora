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
  const heroAt320 = await page.locator('.public-hero').evaluate((hero) => Math.round(hero.getBoundingClientRect().height));
  check(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)
      && await page.locator('.public-values').evaluate((grid) => {
        const lefts = [...grid.children].map((card) => Math.round(card.getBoundingClientRect().left));
        return new Set(lefts).size === 1;
      }),
    'landing se ajusta a 320 px sem overflow e mantém uma coluna legível',
  );
  check(heroAt320 <= 660, 'hero mobile estreito mantém altura controlada', `${heroAt320}px`);
  await page.setViewportSize({ width: 390, height: 844 });
  const heroAt390 = await page.locator('.public-hero').evaluate((hero) => Math.round(hero.getBoundingClientRect().height));
  check(heroAt390 <= 620, 'hero mobile compacto deixa mais conteúdo visível sem rolagem', `${heroAt390}px`);
  await page.setViewportSize({ width: 768, height: 900 });
  check(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)
      && await page.locator('.public-values').evaluate((grid) => {
        const cards = [...grid.children].map((card) => card.getBoundingClientRect());
        const top = cards[0].top;
        const lefts = cards.filter((card) => Math.abs(card.top - top) < 1).map((card) => Math.round(card.left));
        return new Set(lefts).size === 2;
      }),
    'grade de áreas se ajusta a tablets sem overflow',
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  const desktopLanding = await page.evaluate(() => {
    const actions = [...document.querySelectorAll('.public-hero .public-actions .btn')]
      .map((button) => button.getBoundingClientRect());
    const values = [...document.querySelectorAll('.public-value')]
      .map((card) => card.getBoundingClientRect());
    const cardsContainer = document.querySelector('.public-values').getBoundingClientRect();
    const firstRow = values.filter((card) => Math.abs(card.top - values[0].top) < 1);
    const secondRow = values.filter((card) => Math.abs(card.top - values[3].top) < 1);
    return {
      actionsShareRow: actions.length === 2 && Math.abs(actions[0].top - actions[1].top) < 1,
      firstRow: firstRow.length === 3,
      secondRow: secondRow.length === 2,
      centeredSecondRow: Math.abs(
        (secondRow[0].left + secondRow[1].right) / 2 - (cardsContainer.left + cardsContainer.right) / 2,
      ) < 2,
      cardWidth: Math.max(...values.map((card) => card.width)),
    };
  });
  check(desktopLanding.actionsShareRow, 'CTAs do hero ficam lado a lado no desktop');
  check(
    desktopLanding.firstRow && desktopLanding.secondRow && desktopLanding.centeredSecondRow,
    'áreas do produto formam três mais duas e centralizam a última linha',
  );
  check(desktopLanding.cardWidth <= 320, 'cards da landing permanecem compactos no desktop', `${Math.round(desktopLanding.cardWidth)}px`);
  await page.setViewportSize({ width: 320, height: 780 });
  check(
    await page.locator('.public-account-section, .public-account-access').count() === 0,
    'convite final redundante foi removido da landing',
  );
  check(
    await page.locator('#landing-main').evaluate((main) => main.lastElementChild?.classList.contains('public-faq')),
    'FAQ encerra o conteúdo principal antes do rodapé',
  );
  check(
    await page.locator('#landing-main [data-public-action="signup"]').count() === 1,
    'CTA principal de cadastro permanece disponível no hero',
  );
  await page.locator('.public-faq-item').nth(1).locator('summary').click();
  const emailFaq = await page.locator('.public-faq-item').nth(1).textContent();
  check(/acesso é liberado assim que a conta é criada/i.test(emailFaq), 'FAQ explica que não há confirmação de e-mail');
  check(/erro de digitação pode impedir a recuperação da senha/i.test(emailFaq), 'FAQ alerta sobre recuperação da senha');
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
  await birthDate.fill('2000-10-29');
  await page.getByRole('button', { name: 'Continuar' }).click();
  const emailHint = await page.locator('#account-email-help').textContent();
  check(/não precisa confirmar o e-mail para entrar/i.test(emailHint), 'etapa de acesso explica que a confirmação não é exigida');
  check(/erro pode impedir a recuperação da senha/i.test(emailHint), 'etapa de acesso alerta sobre endereço incorreto');
  await page.setViewportSize({ width: 320, height: 780 });
  check(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    'aviso de recuperação não cria overflow horizontal em 320 px',
  );
  check(errors.length === 0, 'sem erros após avançar para o acesso', errors.slice(0, 3).join(' | '));

  await browser.close();
  process.exit(results.every(Boolean) ? 0 : 1);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
