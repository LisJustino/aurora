const { chromium } = require('playwright');

const BASE = process.argv[2] || 'http://127.0.0.1:5173';
const results = [];
const check = (passed, name, detail = '') => {
  results.push(passed);
  console.log(`${passed ? 'OK   ' : 'FALHA'} — ${name}${detail ? ` (${detail})` : ''}`);
};

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 320, height: 780 }, isMobile: true, hasTouch: true });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto(BASE);
  const heroAt320 = await page.locator('.public-hero').evaluate((hero) => Math.round(hero.getBoundingClientRect().height));
  check(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)
      && await page.locator('.landing-tutorial-panel:visible').count() === 1,
    'landing se ajusta a 320 px sem overflow e mantém uma demonstração selecionada',
  );
  check(
    await page.locator('.public-hero .landing-hero-actions').evaluate((actions) => actions.getBoundingClientRect().bottom <= innerHeight),
    'hero mobile estreito mantém as ações principais visíveis sem rolagem',
    `${heroAt320}px`,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  check(
    await page.locator('.public-hero .landing-hero-actions').evaluate((actions) => actions.getBoundingClientRect().bottom <= innerHeight),
    'hero mobile compacto mantém as ações principais visíveis sem rolagem',
  );
  await page.setViewportSize({ width: 768, height: 900 });
  check(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)
      && await page.locator('.landing-tutorial-tabs').isVisible(),
    'navegação das demonstrações se ajusta a tablets sem overflow',
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  const desktopLanding = await page.evaluate(() => {
    const actions = [...document.querySelectorAll('.public-hero .landing-hero-actions a')]
      .map((button) => button.getBoundingClientRect());
    const preview = document.querySelector('.landing-tutorial-panel:not([hidden]) picture.landing-screen-light img').getBoundingClientRect();
    return {
      hasPrimaryAndDemo: actions.length === 2,
      tutorialFits: preview.width > 0 && preview.right <= document.documentElement.clientWidth,
    };
  });
  check(desktopLanding.hasPrimaryAndDemo, 'hero mantém ações de cadastro e demonstração');
  check(desktopLanding.tutorialFits, 'prévia da demonstração permanece dentro da largura no desktop');
  await page.setViewportSize({ width: 320, height: 780 });
  check(
    await page.locator('.public-account-section, .public-account-access').count() === 0,
    'convite final redundante foi removido da landing',
  );
  const heroSignup = page.locator('.public-topbar [data-public-action="signup"]');
  check(
    await heroSignup.count() === 1 && await heroSignup.evaluate((button) => button.classList.contains('primary')),
    'cadastro permanece disponível e em destaque no cabeçalho',
  );
  check(await page.locator('.public-faq-item').count() === 6,
    'FAQ da landing apresenta seis respostas essenciais');
  await page.getByRole('link', { name: /criar conta/i }).first().click();
  await page.locator('.account-form[data-account-mode="signup-profile"]').waitFor();
  check(await page.getByRole('button', { name: 'Criar conta com Google' }).count() === 1, 'cadastro oferece opção visível para criar conta com Google');
  check(await page.locator('.account-google-icon').count() === 1, 'opção de cadastro inclui o ícone do Google');

  const ageConfirmation = page.getByLabel('Confirmo que tenho pelo menos 16 anos.');
  const profileContinue = page.getByRole('button', { name: 'Continuar' });
  check(await page.locator('input[type="date"]').count() === 0,
    'cadastro não solicita nem armazena data de nascimento');
  check(await ageConfirmation.count() === 1 && await profileContinue.isDisabled(),
    'confirmação explícita da idade mínima é obrigatória');
  check(
    await page.locator('#account-age-status').evaluate((status) => status.hidden && !status.textContent.trim()),
    'aviso de idade não aparece antes da interação',
  );

  await page.locator('#account-name').fill('Pessoa de teste');
  check(
    await page.locator('#account-preferredName').inputValue() === 'Pessoa',
    'nome preferido recebe o primeiro nome automaticamente',
  );
  await page.locator('#account-preferredName').fill('Teste');
  await ageConfirmation.check();
  check(!await profileContinue.isDisabled(), 'confirmação da idade mínima libera a etapa seguinte');
  await ageConfirmation.uncheck();
  check(
    /pelo menos 16 anos/i.test(await page.locator('#account-age-status').textContent())
      && await profileContinue.isDisabled(),
    'remover a confirmação bloqueia o cadastro e explica o requisito',
  );

  await page.setViewportSize({ width: 390, height: 844 });
  check(await ageConfirmation.evaluate((input) => {
    const rect = input.getBoundingClientRect();
    return rect.left >= 0 && rect.right <= innerWidth && document.documentElement.scrollWidth <= innerWidth;
  }), 'confirmação de idade cabe na viewport de 390 px');

  await page.setViewportSize({ width: 1280, height: 900 });
  await ageConfirmation.check();
  await page.getByRole('button', { name: 'Continuar' }).click();
  const emailHint = await page.locator('#account-email-help').textContent();
  check(/não precisa confirmar o e-mail para entrar/i.test(emailHint), 'etapa de acesso explica que a confirmação não é exigida');
  check(/erro pode impedir a recuperação da senha/i.test(emailHint), 'etapa de acesso alerta sobre endereço incorreto');
  check(await page.getByLabel('Confirmar e-mail', { exact: true }).count() === 0,
    'cadastro pede o e-mail apenas uma vez');
  const signupPassword = page.getByLabel('Senha', { exact: true });
  check(await signupPassword.getAttribute('minlength') === '12'
    && await signupPassword.getAttribute('maxlength') === '72',
  'senha nova aceita de 12 a 72 caracteres');
  await page.getByLabel('E-mail', { exact: true }).fill('pessoa@example.com');
  await signupPassword.fill('simplepassphrase');
  await page.getByLabel('Confirmar senha', { exact: true }).fill('simplepassphrase');
  await page.locator('.account-form input[name="termsAccepted"]').check();
  check(await page.locator('.account-form button[type="submit"]').isEnabled(),
    'senha longa sem composição obrigatória libera o cadastro');
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
