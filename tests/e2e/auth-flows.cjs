const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const { existsSync } = require('node:fs');
const { createServer } = require('node:net');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const VITE = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
let BASE;
let server;
const AUTH_URL = 'https://cltymialatksylhzsitz.supabase.co';
const AUTH_KEY = 'aurora-e2e-public-key';

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function findAvailablePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      probe.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        if (!address || typeof address === 'string') {
          reject(new Error('Não foi possível determinar uma porta local disponível.'));
          return;
        }
        resolve(address.port);
      });
    });
  });
}

async function waitForServer() {
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error('O Vite encerrou antes de iniciar o teste de autenticação.');
    try {
      const response = await fetch(BASE);
      if (response.ok) return;
    } catch {}
    await delay(250);
  }
  throw new Error('Tempo esgotado aguardando o Vite no teste de autenticação.');
}

function jsonResponse(route, status, body, origin) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    headers: {
      'access-control-allow-origin': origin,
      'access-control-allow-headers': 'apikey,authorization,content-type,x-client-info',
      'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
    },
    body: JSON.stringify(body),
  });
}

async function main() {
  if (!existsSync(VITE)) throw new Error('Vite não está instalado. Execute npm ci antes dos testes E2E.');
  const port = await findAvailablePort();
  BASE = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, [
    VITE,
    '--host',
    '127.0.0.1',
    '--port',
    String(port),
    '--strictPort',
  ], {
    cwd: ROOT,
    env: {
      ...process.env,
      CI: '1',
      VITE_SUPABASE_LOCAL_URL: AUTH_URL,
      VITE_SUPABASE_LOCAL_ANON_KEY: AUTH_KEY,
    },
    stdio: 'ignore',
  });
  await waitForServer();

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  const externalRequests = [];
  const unexpectedAuthRequests = [];
  let user = null;
  let password = '';
  let recoveryRequests = 0;
  let signupRequests = 0;
  const loginPasswords = [];
  let delayNextLogin = false;
  let expectedAuthErrorResponses = 0;
  const assertAccountCardDoesNotScrollInternally = async (label) => {
    const dimensions = await page.locator('.account-card').evaluate((card) => ({
      overflowY: getComputedStyle(card).overflowY,
      scrollHeight: card.scrollHeight,
      clientHeight: card.clientHeight,
    }));
    assert.equal(dimensions.overflowY, 'visible', `${label}: o cartão não deve criar uma área de rolagem própria`);
    assert.ok(
      dimensions.scrollHeight <= dimensions.clientHeight + 1,
      `${label}: o conteúdo do cartão deve expandir sem rolagem interna`,
    );
  };
  const assertAuthLayout = async (label) => {
    const layout = await page.locator('.account-gate').evaluate((gate) => {
      const intro = gate.querySelector('.account-intro');
      const card = gate.querySelector('.account-card');
      return {
        isMobile: matchMedia('(max-width: 760px)').matches,
        minHeight: getComputedStyle(gate).minHeight,
        introDisplay: getComputedStyle(intro).display,
        introTop: intro.getBoundingClientRect().top,
        cardTop: card.getBoundingClientRect().top,
      };
    });
    assert.equal(layout.minHeight, '0px', `${label}: a tela não deve reservar um viewport vazio`);
    if (layout.isMobile) {
      assert.equal(layout.introDisplay, 'none', `${label}: a introdução não deve empurrar o formulário no celular`);
    } else {
      assert.ok(layout.introTop <= layout.cardTop + 1, `${label}: a introdução deve começar junto ao formulário`);
    }
  };
  const assertNoHorizontalOverflow = async (label) => {
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const dimensions = await page.evaluate(() => ({
      viewport: innerWidth,
      document: document.documentElement.scrollWidth,
      overflowing: [...document.querySelectorAll('body *')]
        .filter((element) => element.getBoundingClientRect().right > innerWidth + 1)
        .slice(0, 8)
        .map((element) => ({
          tag: element.tagName,
          className: typeof element.className === 'string' ? element.className : '',
          right: Math.round(element.getBoundingClientRect().right),
          width: Math.round(element.getBoundingClientRect().width),
        })),
    }));
    assert.ok(
      dimensions.document <= dimensions.viewport,
      `${label}: ${JSON.stringify(dimensions)}`,
    );
  };
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    if (/status of 429 \(Too Many Requests\)/i.test(message.text())) return;
    if (/status of 400 \(Bad Request\)/i.test(message.text()) && expectedAuthErrorResponses > 0) {
      expectedAuthErrorResponses -= 1;
      return;
    }
    errors.push(message.text());
  });
  await page.route('**/*', async (route) => {
    const request = route.request();
    const requestUrl = new URL(request.url());
    if (requestUrl.origin === BASE) return route.continue();
    if (requestUrl.origin !== AUTH_URL) {
      externalRequests.push(request.url());
      return route.abort();
    }

    const corsOrigin = BASE;
    if (request.method() === 'OPTIONS') {
      return route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': corsOrigin,
          'access-control-allow-headers': request.headers()['access-control-request-headers'] || '*',
          'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
        },
      });
    }

    const endpoint = `${request.method()} ${requestUrl.pathname}`;
    if (endpoint === 'POST /auth/v1/signup') {
      signupRequests += 1;
      const body = request.postDataJSON();
      if (user && body.email.toLowerCase() === user.email.toLowerCase()) {
        return jsonResponse(route, 200, {
          user: {
            id: user.id,
            email: body.email,
            identities: [],
          },
          session: null,
        }, corsOrigin);
      }
      user = {
        id: '00000000-0000-4000-8000-000000000001',
        aud: 'authenticated',
        role: 'authenticated',
        email: body.email,
        email_confirmed_at: null,
        app_metadata: { provider: 'email', providers: ['email'] },
        user_metadata: body.data,
        identities: [{ identity_id: 'e2e-email-identity', provider: 'email' }],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      password = body.password;
      const session = {
        access_token: 'e2e-access-token',
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        refresh_token: 'e2e-refresh-token',
        user,
      };
      return jsonResponse(route, 200, { ...session, user }, corsOrigin);
    }
    if (endpoint === 'POST /auth/v1/token') {
      const body = request.postDataJSON();
      if (requestUrl.searchParams.get('grant_type') === 'password') {
        loginPasswords.push(body.password);
        if (!user || body.email !== user.email || body.password !== password) {
          expectedAuthErrorResponses += 1;
          return jsonResponse(route, 400, { code: 'invalid_credentials', msg: 'Invalid login credentials' }, corsOrigin);
        }
        if (delayNextLogin) {
          delayNextLogin = false;
          await delay(350);
        }
      } else if (requestUrl.searchParams.get('grant_type') !== 'refresh_token') {
        unexpectedAuthRequests.push(endpoint);
        return jsonResponse(route, 400, { code: 'unsupported_grant_type', msg: 'Unsupported grant type' }, corsOrigin);
      }
      const session = {
        access_token: 'e2e-access-token',
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        refresh_token: 'e2e-refresh-token',
        user,
      };
      return jsonResponse(route, 200, session, corsOrigin);
    }
    if (endpoint === 'GET /auth/v1/user') {
      return jsonResponse(route, 200, user || {}, corsOrigin);
    }
    if (endpoint === 'PUT /auth/v1/user') {
      const body = request.postDataJSON();
      if (body.password) password = body.password;
      if (body.data) user.user_metadata = { ...user.user_metadata, ...body.data };
      user.updated_at = new Date().toISOString();
      return jsonResponse(route, 200, user, corsOrigin);
    }
    if (endpoint === 'POST /auth/v1/recover') {
      recoveryRequests += 1;
      if (recoveryRequests === 1) return jsonResponse(route, 200, {}, corsOrigin);
      return jsonResponse(route, 429, {
        code: 'over_email_send_rate_limit',
        msg: 'Email rate limit exceeded',
      }, corsOrigin);
    }
    if (endpoint === 'POST /auth/v1/logout') return jsonResponse(route, 204, {}, corsOrigin);

    unexpectedAuthRequests.push(endpoint);
    return jsonResponse(route, 404, { code: 'not_found', msg: 'Unexpected test request' }, corsOrigin);
  });

  try {
    await page.goto(BASE);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.locator('.public-topbar [data-public-action="login"]').click();
    await page.getByRole('heading', { name: 'Entrar na sua conta' }).waitFor();
    assert.equal(new URL(page.url()).pathname, '/entrar', 'link de login deve abrir sua rota própria');
    assert.match(await page.title(), /Entrar na sua conta \| aurora\./);
    assert.equal(await page.locator('.account-form input[name="email"]').getAttribute('autocomplete'), 'email');
    assert.equal(await page.locator('.account-form input[name="password"]').getAttribute('autocomplete'), 'current-password');
    assert.equal(await page.locator('.account-public-header').count(), 1, 'login iniciado pela landing deve manter o header público');
    await assertAccountCardDoesNotScrollInternally('login em desktop');
    await assertAuthLayout('login em desktop');
    await page.setViewportSize({ width: 390, height: 844 });
    await assertAuthLayout('login no celular');
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.locator('.account-public-header [data-account-mode="signup"]').click();
    await page.getByRole('heading', { name: 'Seu perfil' }).waitFor();
    assert.equal(new URL(page.url()).pathname, '/criar-conta', 'cadastro deve abrir sua rota própria');
    await page.goBack();
    await page.getByRole('heading', { name: 'Entrar na sua conta' }).waitFor();
    assert.equal(new URL(page.url()).pathname, '/entrar', 'voltar no navegador retorna ao login');
    await page.goForward();
    await page.getByRole('heading', { name: 'Seu perfil' }).waitFor();
    assert.equal(new URL(page.url()).pathname, '/criar-conta', 'avançar no navegador retorna ao cadastro');
    await page.goto(`${BASE}/criar-conta?etapa=acesso`);
    await page.getByRole('heading', { name: 'Crie seu acesso' }).waitFor();
    assert.equal(await page.title(), 'Crie seu acesso | aurora.');
    assert.equal(await page.locator('.account-form input[name="email"]').getAttribute('autocomplete'), 'email');
    assert.equal(await page.locator('.account-form input[name="password"]').getAttribute('autocomplete'), 'new-password');
    await page.goto(`${BASE}/esqueci-senha`);
    await page.getByRole('heading', { name: 'Recuperar acesso' }).waitFor();
    assert.equal(await page.title(), 'Recuperar acesso | aurora.');
    await page.goto(`${BASE}/nova-senha`);
    await page.getByRole('heading', { name: 'Atualizar senha' }).waitFor();
    assert.equal(await page.title(), 'Atualizar senha | aurora.');
    await page.goto(`${BASE}/demonstracao`);
    await page.locator('#demo-main').waitFor();
    assert.equal(await page.title(), 'Demonstração | aurora.');
    await page.goto(BASE);

    await page.evaluate(async () => {
      const { requireAccount } = await import('/src/js/services/account-auth.js');
      window.startAuthFlow = (mode) => {
        window.authFlowDone = false;
        window.authFlowError = '';
        window.authFlowPromise = requireAccount(document.querySelector('#app'), mode, {
          allowPublicReturn: true,
        }).then((result) => {
          window.authFlowResult = result;
          window.authFlowDone = true;
          return result;
        }).catch((error) => {
          window.authFlowError = error instanceof Error ? error.message : String(error);
          window.authFlowDone = true;
          return null;
        });
        return window.authFlowPromise;
      };
      window.startAuthFlow('signup');
    });

    await page.getByRole('heading', { name: 'Seu perfil' }).waitFor();
    assert.equal(await page.locator('.account-public-header').count(), 1, 'cadastro deve manter o header público');
    await page.setViewportSize({ width: 1280, height: 720 });
    await assertAccountCardDoesNotScrollInternally('perfil do cadastro em desktop');
    await assertAuthLayout('perfil do cadastro em desktop');
    await page.setViewportSize({ width: 390, height: 844 });
    await assertAuthLayout('perfil do cadastro no celular');
    await page.getByLabel('Nome', { exact: true }).fill('Pessoa de teste');
    await page.getByLabel('Como você prefere ser chamado(a)?', { exact: true }).fill('Teste');
    await page.getByLabel('Data de nascimento').fill('1990-01-01');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByRole('heading', { name: 'Crie seu acesso' }).waitFor();
    assert.equal(await page.locator('.account-public-header').count(), 1, 'etapa de acesso do cadastro deve manter o header público');
    await page.setViewportSize({ width: 1280, height: 720 });
    await assertAccountCardDoesNotScrollInternally('cadastro em desktop');
    await assertAuthLayout('cadastro em desktop');
    await page.setViewportSize({ width: 390, height: 844 });
    await assertAuthLayout('cadastro no celular');
    await page.setViewportSize({ width: 320, height: 780 });
    await assertNoHorizontalOverflow('a confirmação de e-mail deve caber em 320 px');
    await page.setViewportSize({ width: 390, height: 844 });
    const email = page.getByLabel('E-mail', { exact: true });
    const confirmEmail = page.getByLabel('Confirmar e-mail', { exact: true });
    const signupButton = page.locator('.account-form button[type="submit"]');
    await email.fill('pessoa@example.com');
    await confirmEmail.fill('pessoa-errada@example.com');
    await page.getByLabel('Senha', { exact: true }).fill('Aurora123!');
    await page.getByLabel('Confirmar senha', { exact: true }).fill('Aurora123!');
    await page.locator('.account-form input[name="termsAccepted"]').check();
    assert.equal(await signupButton.isDisabled(), true, 'o cadastro deve bloquear e-mails divergentes');
    assert.match(await page.locator('#account-confirmEmail-error').textContent(), /não coincidem/i);
    assert.equal(signupRequests, 0, 'e-mails divergentes não devem chamar o provedor');
    await confirmEmail.fill('PESSOA@EXAMPLE.COM');
    assert.equal(await signupButton.isEnabled(), true, 'endereços coincidentes ignorando caixa alta liberam o cadastro');
    await signupButton.click();
    await page.waitForFunction(() => window.authFlowDone);
    assert.equal(await page.evaluate(() => window.authFlowError), '');
    assert.equal(await page.evaluate(() => window.authFlowResult?.user.email), 'pessoa@example.com');
    assert.equal(signupRequests, 1, 'cadastro válido deve chamar o provedor uma vez');

    await page.evaluate(async () => {
      await window.authFlowResult.client.auth.signOut({ scope: 'local' });
      window.startAuthFlow('signup');
    });
    await page.getByRole('heading', { name: 'Seu perfil' }).waitFor();
    await page.getByLabel('Nome', { exact: true }).fill('Segunda tentativa');
    await page.getByLabel('Como você prefere ser chamado(a)?', { exact: true }).fill('Teste');
    await page.getByLabel('Data de nascimento').fill('1990-01-01');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByRole('heading', { name: 'Crie seu acesso' }).waitFor();
    await page.getByLabel('E-mail', { exact: true }).fill('PESSOA@example.com');
    await page.getByLabel('Confirmar e-mail', { exact: true }).fill('pessoa@example.com');
    await page.getByLabel('Senha', { exact: true }).fill('Aurora123!');
    await page.getByLabel('Confirmar senha', { exact: true }).fill('Aurora123!');
    await page.locator('.account-form input[name="termsAccepted"]').check();
    await page.locator('.account-form button[type="submit"]').click();
    await page.getByText(/já está vinculado a uma conta, então não criamos outra/i).waitFor();
    assert.equal(signupRequests, 2, 'o segundo cadastro deve consultar o servidor e ser recusado');
    await page.locator('.account-link-switch[data-account-mode="login"]').click();
    await page.getByRole('heading', { name: 'Entrar na sua conta' }).waitFor();
    assert.equal(await page.locator('.account-public-header').count(), 1, 'login deve manter o header público');
    await page.getByLabel('E-mail', { exact: true }).fill('pessoa@example.com');
    const loginPassword = page.getByLabel('Senha', { exact: true });
    await loginPassword.fill('SenhaErrada123!');
    await loginPassword.press('Enter');
    await page.getByText('E-mail ou senha incorretos. Confira os dados e tente novamente.').waitFor();
    await page.getByLabel('Senha', { exact: true }).fill('Aurora123!');
    delayNextLogin = true;
    await page.getByLabel('Senha', { exact: true }).press('Enter');
    const loginSubmit = page.locator('.account-form button[type="submit"]');
    await loginSubmit.waitFor({ state: 'visible' });
    await page.locator('.account-form button.is-loading').waitFor();
    assert.equal(await loginSubmit.getAttribute('aria-busy'), 'true', 'login deve expor estado de carregamento');
    assert.match(await loginSubmit.textContent(), /aguarde/i, 'botão informa que o envio está em andamento');
    await page.waitForFunction(() => window.authFlowDone);
    assert.equal(await page.evaluate(() => window.authFlowError), '');
    assert.equal(await page.evaluate(() => window.authFlowResult?.user.email), 'pessoa@example.com');

    await page.evaluate(async () => {
      await window.authFlowResult.client.auth.signOut({ scope: 'local' });
      window.startAuthFlow('login');
    });
    await page.getByRole('heading', { name: 'Entrar na sua conta' }).waitFor();
    await page.getByRole('button', { name: 'Esqueci minha senha' }).click();
    await page.getByRole('heading', { name: 'Recuperar acesso' }).waitFor();
    assert.equal(await page.locator('.account-public-header').count(), 1, 'recuperação deve manter o header público');
    await page.setViewportSize({ width: 1280, height: 720 });
    await assertAccountCardDoesNotScrollInternally('recuperação em desktop');
    await assertAuthLayout('recuperação em desktop');
    await page.setViewportSize({ width: 390, height: 844 });
    await assertAuthLayout('recuperação no celular');
    await page.getByLabel('E-mail', { exact: true }).fill('pessoa@example.com');
    await page.getByRole('button', { name: 'Enviar instruções' }).click();
    await page.getByText('Se houver uma conta vinculada a esse e-mail, você receberá instruções para redefinir a senha. Confira também o spam e aguarde alguns minutos.').waitFor();
    await page.getByRole('button', { name: 'Enviar instruções' }).click();
    await page.getByText(/aguarde alguns minutos/i).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Enviar instruções' }).isEnabled(), true, 'a pessoa pode tentar novamente após o limite');
    assert.equal(recoveryRequests, 2, 'solicitações de recuperação simuladas');

    await page.evaluate(() => {
      window.startAuthFlow('login');
    });
    await page.getByRole('heading', { name: 'Entrar na sua conta' }).waitFor();
    await page.getByLabel('E-mail', { exact: true }).fill('pessoa@example.com');
    await page.getByLabel('Senha', { exact: true }).fill('Aurora123!');
    await page.locator('.account-form button[type="submit"]').click();
    await page.waitForFunction(() => window.authFlowDone);
    assert.equal(await page.evaluate(() => window.authFlowError), '');

    await page.evaluate(() => {
      history.replaceState(null, '', '/?type=recovery');
      window.startAuthFlow('login');
    });
    await page.getByRole('heading', { name: 'Atualizar senha' }).waitFor();
    assert.equal(await page.locator('.account-public-header').count(), 1, 'atualização da senha deve manter o header público');
    await page.setViewportSize({ width: 1280, height: 720 });
    await assertAccountCardDoesNotScrollInternally('atualização de senha em desktop');
    await assertAuthLayout('atualização de senha em desktop');
    await page.setViewportSize({ width: 320, height: 780 });
    await assertAuthLayout('atualização de senha em celular estreito');
    await assertNoHorizontalOverflow('a confirmação da nova senha deve caber em 320 px');
    await page.setViewportSize({ width: 390, height: 844 });
    const updatePasswordButton = page.locator('.account-form button[type="submit"]');
    await page.getByLabel('Nova senha', { exact: true }).fill('NovaSenha456!');
    await page.getByLabel('Confirmar nova senha', { exact: true }).fill('Diferente456!');
    assert.equal(await updatePasswordButton.isDisabled(), true, 'a redefinição deve bloquear senhas divergentes');
    await page.getByLabel('Confirmar nova senha', { exact: true }).fill('NovaSenha456!');
    assert.equal(await updatePasswordButton.isEnabled(), true, 'senhas correspondentes liberam a redefinição');
    await updatePasswordButton.click();
    await page.getByRole('heading', { name: 'Entrar na sua conta' }).waitFor();
    await page.getByText('Senha atualizada. Entre usando sua nova senha.').waitFor();
    assert.equal(await page.evaluate(() => location.search), '', 'callback de redefinição é removido da URL');
    assert.equal(await page.locator('.account-message[data-tone="success"]').count(), 1);
    await page.getByLabel('E-mail', { exact: true }).fill('pessoa@example.com');
    await page.getByLabel('Senha', { exact: true }).fill('NovaSenha456!');
    await page.locator('.account-form button[type="submit"]').click();
    await page.waitForFunction(() => window.authFlowDone);
    assert.equal(await page.evaluate(() => window.authFlowError), '');
    assert.equal(await page.evaluate(() => window.authFlowResult?.user.email), 'pessoa@example.com');
    assert.deepEqual(loginPasswords, ['SenhaErrada123!', 'Aurora123!', 'Aurora123!', 'NovaSenha456!']);
    assert.deepEqual(externalRequests, [], 'nenhuma requisição real fora do servidor local e do mock deve ocorrer');
    assert.deepEqual(unexpectedAuthRequests, [], 'somente endpoints de autenticação esperados devem ser chamados');
    assert.deepEqual(errors, [], 'o fluxo não deve gerar erros no console');
    console.log('auth-flows: cadastro, bloqueio de e-mail duplicado, login, recuperação, limite de tentativas e redefinição passaram com Supabase simulado');
  } finally {
    await page.close();
    await browser.close();
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    if (server && server.exitCode === null) server.kill();
  });
