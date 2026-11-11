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
  let failNextUserLookup = false;
  let rejectNextUserLookup = false;
  let logoutRequests = 0;
  let expectedAuthErrorResponses = 0;
  let expectedAuthUnauthorizedResponses = 0;
  let expectedAuthServerErrors = 0;
  let pkceRequests = 0;
  let simulateRelational = false;
  let manyTasks = false;
  let manyTransactions = false;
  let homeFixtures = false;
  let habitFixtures = false;
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
        introRight: intro.getBoundingClientRect().right,
        introWidth: intro.getBoundingClientRect().width,
        cardTop: card.getBoundingClientRect().top,
        cardLeft: card.getBoundingClientRect().left,
        cardWidth: card.getBoundingClientRect().width,
      };
    });
    assert.equal(layout.minHeight, '0px', `${label}: a tela não deve reservar um viewport vazio`);
    if (layout.isMobile) {
      assert.equal(layout.introDisplay, 'none', `${label}: a introdução não deve empurrar o formulário no celular`);
    } else {
      assert.ok(layout.introTop <= layout.cardTop + 1, `${label}: a introdução deve começar junto ao formulário`);
      assert.ok(layout.introRight <= layout.cardLeft + 1, `${label}: o formulário deve ficar ao lado do painel de boas-vindas`);
      assert.ok(layout.cardWidth >= layout.introWidth * 0.9, `${label}: o formulário deve ter espaço proporcional ao painel`);
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
    if (/status of 401 \(Unauthorized\)/i.test(message.text()) && expectedAuthUnauthorizedResponses > 0) {
      expectedAuthUnauthorizedResponses -= 1;
      return;
    }
    if (/status of 503 \(Service Unavailable\)/i.test(message.text()) && expectedAuthServerErrors > 0) {
      expectedAuthServerErrors -= 1;
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
    if (simulateRelational && request.method() === 'GET' && requestUrl.pathname.startsWith('/rest/v1/')) {
      if ((homeFixtures || habitFixtures) && requestUrl.pathname === '/rest/v1/user_settings') {
        return jsonResponse(route, 200, [{ enabled_areas: { habits: true }, preferences: {} }], corsOrigin);
      }
      if (homeFixtures && requestUrl.pathname === '/rest/v1/tasks') {
        const now = new Date();
        const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        return jsonResponse(route, 200, [{
          id: '00000000-0000-4000-8000-000000000201', title: 'Tarefa concluída',
          is_completed: true, due_date: day, completed_at: now.toISOString(),
          priority: 'normal', sort_order: 1, focus_seconds: 0,
        }], corsOrigin);
      }
      if (habitFixtures && requestUrl.pathname === '/rest/v1/habits') {
        return jsonResponse(route, 200, [{
          id: '00000000-0000-4000-8000-000000000202', name: 'Hábito teste',
          scheduled_days: [0, 1, 2, 3, 4, 5, 6], status: 'active',
        }], corsOrigin);
      }
      if (manyTransactions && requestUrl.pathname === '/rest/v1/user_settings') {
        return jsonResponse(route, 200, [{ enabled_areas: { finances: true }, preferences: {} }], corsOrigin);
      }
      if (manyTransactions && requestUrl.pathname === '/rest/v1/finance_accounts') {
        return jsonResponse(route, 200, [{
          id: '00000000-0000-4000-8000-000000000101', name: 'Conta teste',
          account_type: 'checking', initial_cents: 0, bank: null,
          limit_cents: null, closing_day: null, due_day: null,
        }], corsOrigin);
      }
      if (manyTransactions && requestUrl.pathname === '/rest/v1/finance_transactions') {
        const now = new Date();
        const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        const rows = Array.from({ length: 23 }, (_, index) => ({
          id: `00000000-0000-4000-8001-${String(index + 1).padStart(12, '0')}`,
          transaction_type: 'out',
          account_id: '00000000-0000-4000-8000-000000000101',
          amount_cents: 100,
          transaction_date: day,
          is_paid: true,
          description: `Lançamento teste ${String(index + 1).padStart(2, '0')}`,
        }));
        return jsonResponse(route, 200, rows, corsOrigin);
      }
      if (manyTasks && requestUrl.pathname === '/rest/v1/tasks') {
        const rows = Array.from({ length: 23 }, (_, index) => ({
          id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
          title: `Tarefa de teste ${String(index + 1).padStart(2, '0')}`,
          is_completed: false,
          due_date: '2026-01-01',
          priority: 'normal',
          sort_order: index,
          focus_seconds: 0,
          task_created_at: '2026-01-01T12:00:00.000Z',
        }));
        return jsonResponse(route, 200, rows, corsOrigin);
      }
      return jsonResponse(route, 200, [], corsOrigin);
    }
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
      if (requestUrl.searchParams.get('grant_type') === 'pkce') {
        pkceRequests += 1;
        assert.equal(body.auth_code, 'callback-test');
        assert.equal(body.code_verifier, 'verifier-test');
        await delay(350);
      } else if (requestUrl.searchParams.get('grant_type') === 'password') {
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
      if (failNextUserLookup) {
        failNextUserLookup = false;
        expectedAuthServerErrors += 1;
        return jsonResponse(route, 503, { code: 'service_unavailable', msg: 'Temporarily unavailable' }, corsOrigin);
      }
      if (rejectNextUserLookup) {
        rejectNextUserLookup = false;
        expectedAuthUnauthorizedResponses += 1;
        return jsonResponse(route, 401, { code: 'session_not_found', msg: 'Session is no longer valid' }, corsOrigin);
      }
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
    if (endpoint === 'POST /auth/v1/logout') {
      logoutRequests += 1;
      return jsonResponse(route, 204, {}, corsOrigin);
    }

    unexpectedAuthRequests.push(endpoint);
    return jsonResponse(route, 404, { code: 'not_found', msg: 'Unexpected test request' }, corsOrigin);
  });

  try {
    await page.goto(BASE);
    await page.evaluate(() => {
      sessionStorage.setItem('sb-cltymialatksylhzsitz-auth-token-code-verifier', JSON.stringify('verifier-test'));
    });
    user = {
      id: '00000000-0000-4000-8000-000000000002',
      aud: 'authenticated',
      role: 'authenticated',
      email: 'google@example.test',
      app_metadata: { provider: 'google', providers: ['google'] },
      user_metadata: { name: 'Pessoa de teste' },
      identities: [{ identity_id: 'e2e-google-identity', provider: 'google' }],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await page.goto(`${BASE}/?code=callback-test`);
    await page.locator('.app-skeleton[role="status"]').waitFor({ state: 'visible' });
    assert.equal(await page.locator('.public-site').count(), 0, 'callback Google não deve renderizar a landing');
    await page.getByRole('heading', { name: 'Complete seu perfil' }).waitFor();
    assert.equal(pkceRequests, 1, 'callback deve trocar o código PKCE exatamente uma vez');
    assert.equal(await page.locator('.public-site').count(), 0);
    assert.equal(new URL(page.url()).searchParams.has('code'), false);
    user.user_metadata = {
      name: 'Pessoa de teste',
      preferred_name: 'Pessoa',
      age: 36,
      birthday_month: 1,
      birthday_day: 1,
      birthday_reference_date: '2026-01-01',
      terms_accepted_at: '2026-01-01T00:00:00.000Z',
      terms_version: '1.9',
      privacy_policy_version: '1.9',
    };
    simulateRelational = true;
    for (const destination of ['/inicio', '/planejar', '/financas', '/habitos']) {
      manyTasks = destination === '/planejar';
      manyTransactions = destination === '/financas';
      homeFixtures = destination === '/inicio';
      habitFixtures = destination === '/habitos';
      await page.evaluate((returnTo) => {
        sessionStorage.removeItem('sb-cltymialatksylhzsitz-auth-token');
        sessionStorage.setItem('sb-cltymialatksylhzsitz-auth-token-code-verifier', JSON.stringify('verifier-test'));
        if (returnTo !== '/inicio') sessionStorage.setItem('aurora:return-to', returnTo);
        else sessionStorage.removeItem('aurora:return-to');
      }, destination);
      await page.goto(`${BASE}/?code=callback-test`);
      await page.locator('.app-skeleton[role="status"]').waitFor({ state: 'visible' });
      assert.equal(await page.locator('.public-site').count(), 0, 'a landing não deve aparecer durante a troca de código');
      await page.waitForURL(`**${destination}`);
      await page.locator('.main').waitFor({ state: 'visible' });
      assert.equal(await page.locator('.public-site').count(), 0);
      if (destination === '/inicio') {
        await page.locator('.main[data-route="inicio"] > .home-head h1').waitFor();
        const firstSteps = page.locator('.home-first-steps');
        await firstSteps.locator('summary').evaluate((element) => element.click());
        await page.waitForTimeout(0);
        assert.equal(await firstSteps.evaluate((element) => element.open), true);
        await page.locator('.nav-more-trigger').evaluate((element) => element.click());
        assert.equal(await firstSteps.evaluate((element) => element.open), true,
          'Primeiros passos deve permanecer aberto após renderização');
        await page.locator('.nav-more-trigger').evaluate((element) => element.click());
        await firstSteps.locator('summary').evaluate((element) => element.click());
        await page.waitForTimeout(0);
        assert.equal(await firstSteps.evaluate((element) => element.open), false);
        await page.locator('.nav-more-trigger').evaluate((element) => element.click());
        assert.equal(await firstSteps.evaluate((element) => element.open), false,
          'Primeiros passos deve permanecer fechado após renderização');
        await page.locator('.nav-more-trigger').evaluate((element) => element.click());
        const completed = page.locator('.home-completed');
        await completed.locator('summary').evaluate((element) => element.click());
        await page.locator('.nav-more-trigger').evaluate((element) => element.click());
        assert.equal(await completed.evaluate((element) => element.open), true,
          'Tarefas concluídas deve permanecer aberto após renderização');
        for (const width of [375, 1280]) {
          await page.setViewportSize({ width, height: 850 });
          for (const theme of ['light', 'dark']) {
            const result = await page.evaluate((selectedTheme) => {
              document.documentElement.dataset.theme = selectedTheme;
              const hero = document.querySelector('.main[data-route="inicio"] > .home-head');
              const title = hero.querySelector('h1');
              const canvas = document.createElement('canvas');
              const context = canvas.getContext('2d', { willReadFrequently: true });
              const color = (value) => {
                context.clearRect(0, 0, 1, 1);
                context.fillStyle = value;
                context.fillRect(0, 0, 1, 1);
                return [...context.getImageData(0, 0, 1, 1).data].slice(0, 3);
              };
              const luminance = (rgb) => rgb.map((value) => {
                const channel = value / 255;
                return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
              }).reduce((sum, channel, index) => sum + channel * [.2126, .7152, .0722][index], 0);
              const foreground = luminance(color(getComputedStyle(title).color));
              const background = luminance(color(getComputedStyle(hero).backgroundColor));
              return {
                documentWidth: document.documentElement.scrollWidth,
                viewportWidth: innerWidth,
                titleWidth: title.getBoundingClientRect().width,
                contrast: (Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05),
              };
            }, theme);
            assert.ok(result.documentWidth <= result.viewportWidth, `Início ${width}px/${theme}: sem overflow`);
            assert.ok(result.titleWidth > 0, `Início ${width}px/${theme}: saudação visível`);
            assert.ok(result.contrast >= 4.5, `Início ${width}px/${theme}: contraste ${result.contrast.toFixed(2)}`);
          }
        }
        await page.setViewportSize({ width: 390, height: 844 });
      } else if (destination === '/planejar') {
        const results = page.locator('#task-results');
        assert.equal(await results.locator('.task').count(), 10);
        assert.match(await results.innerText(), /Mostrando 10 de 23 tarefas/);
        await results.getByRole('button', { name: 'Mostrar mais tarefas' }).evaluate((element) => element.click());
        assert.equal(await results.locator('.task').count(), 20);
        await results.getByRole('button', { name: 'Mostrar mais tarefas' }).evaluate((element) => element.click());
        assert.equal(await results.locator('.task').count(), 23);
        assert.equal(await results.getByRole('button', { name: 'Mostrar mais tarefas' }).count(), 0);
        await page.locator('#q').evaluate((input) => {
          input.value = 'teste 01';
          input.dispatchEvent(new Event('input', { bubbles: true }));
        });
        assert.equal(await results.locator('.task').count(), 1);
        await page.locator('#q').evaluate((input) => {
          input.value = '';
          input.dispatchEvent(new Event('input', { bubbles: true }));
        });
        assert.equal(await results.locator('.task').count(), 10,
          'Alterar a busca deve reiniciar a paginação');
      } else if (destination === '/financas') {
        await page.locator('[data-action="fin-tab"][data-t="lancamentos"]').evaluate((button) => button.click());
        const results = page.locator('#tx-results');
        assert.equal(await results.locator('.fr').count(), 10, await page.locator('.main').innerText());
        assert.match(await results.innerText(), /Mostrando 10 de 23 lançamentos/);
        assert.match(await results.locator('.gsum').innerText(), /23,00/,
          'O total diário deve incluir também os lançamentos ainda não exibidos');
        await results.getByRole('button', { name: 'Mostrar mais lançamentos' }).evaluate((button) => button.click());
        assert.equal(await results.locator('.fr').count(), 20);
        await results.getByRole('button', { name: 'Mostrar mais lançamentos' }).evaluate((button) => button.click());
        assert.equal(await results.locator('.fr').count(), 23);
        await page.locator('#fq').evaluate((input) => {
          input.value = 'teste 01';
          input.dispatchEvent(new Event('input', { bubbles: true }));
        });
        assert.equal(await results.locator('.fr').count(), 1);
        await page.locator('#fq').evaluate((input) => {
          input.value = '';
          input.dispatchEvent(new Event('input', { bubbles: true }));
        });
        assert.equal(await results.locator('.fr').count(), 10);
      } else {
        const habit = page.locator('.habit-row').filter({ hasText: 'Hábito teste' });
        await habit.waitFor();
        await habit.locator('.habit-more > summary').evaluate((element) => element.click());
        await habit.locator('.habit-month > summary').evaluate((element) => element.click());
        await habit.locator('.habit-month [data-action="habit-month"][data-n="-1"]').evaluate((button) => button.click());
        assert.equal(await habit.locator('.habit-month').evaluate((element) => element.open), true,
          'Histórico mensal deve permanecer aberto ao mudar de mês');
      }
    }
    assert.equal(pkceRequests, 5);
    await page.evaluate(() => sessionStorage.removeItem('sb-cltymialatksylhzsitz-auth-token'));
    simulateRelational = false;
    user = null;
    await page.goto(`${BASE}/?error=access_denied`);
    await page.getByRole('heading', { name: 'Entrar na sua conta' }).waitFor();
    assert.match(await page.locator('.account-form').innerText(), /Não foi possível concluir o link de acesso/);
    assert.equal(new URL(page.url()).searchParams.has('error'), false);
    await page.goto(BASE);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.locator('.public-topbar [data-public-action="login"]').click();
    await page.getByRole('heading', { name: 'Entrar na sua conta' }).waitFor();
    assert.equal(new URL(page.url()).pathname, '/entrar', 'link de login deve abrir sua rota própria');
    assert.match(await page.title(), /Entrar na sua conta \| aurora\./);
    assert.equal(await page.locator('.account-form input[name="email"]').getAttribute('autocomplete'), 'email');
    assert.equal(await page.locator('.account-form input[name="password"]').getAttribute('autocomplete'), 'current-password');
    assert.equal(await page.locator('.account-site-header .public-brand-link').count(), 1, 'login iniciado pela landing deve manter a marca no header');
    assert.equal(await page.locator('.account-site-header .account-home-link').count(), 1, 'login deve oferecer botão de retorno ao início');
    assert.equal(await page.locator('.account-auth-header-actions').count(), 1, 'login deve manter os controles de autenticação e aparência');
    await assertAccountCardDoesNotScrollInternally('login em desktop');
    await assertAuthLayout('login em desktop');
    await page.setViewportSize({ width: 390, height: 844 });
    await assertAuthLayout('login no celular');
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.locator('.account-auth-header-actions [data-account-mode="signup"]').click();
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
    await page.goto(`${BASE}/planejar`);
    await page.getByRole('heading', { name: 'Entrar na sua conta' }).waitFor();
    assert.equal(new URL(page.url()).pathname, '/entrar', 'rota protegida sem sessão deve redirecionar ao login');
    assert.equal(await page.evaluate(() => sessionStorage.getItem('aurora:return-to')), '/planejar', 'rota pedida deve ser guardada para depois do login');
    await page.goto(BASE);

    await page.evaluate(async () => {
      const { requireAccount } = await import('/src/js/services/account-auth.js');
      window.startAuthFlow = (mode) => {
        window.authFlowDone = false;
        window.authFlowError = '';
        window.authFlowResult = null;
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
    assert.equal(await page.locator('.account-site-header .public-brand-link').count(), 1, 'cadastro deve manter a marca no header');
    await page.setViewportSize({ width: 1280, height: 720 });
    await assertAccountCardDoesNotScrollInternally('perfil do cadastro em desktop');
    await assertAuthLayout('perfil do cadastro em desktop');
    await page.setViewportSize({ width: 390, height: 844 });
    await assertAuthLayout('perfil do cadastro no celular');
    await page.getByLabel('Nome', { exact: true }).fill('Pessoa de teste');
    const preferredName = page.getByLabel('Nome de preferência (opcional)', { exact: true });
    assert.equal(await preferredName.evaluate((input) => input.required), false, 'nome de preferência deve ser opcional');
    await preferredName.fill('');
    await page.getByLabel('Data de nascimento').fill('1990-01-01');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByRole('heading', { name: 'Crie seu acesso' }).waitFor();
    const passwordCriteria = page.locator('.account-password-strength .account-strength-label');
    assert.equal(await passwordCriteria.innerText(), 'Critérios atendidos: 0 de 5');
    await page.getByLabel('Senha', { exact: true }).fill('Aurora1');
    assert.equal(await passwordCriteria.innerText(), 'Critérios atendidos: 4 de 5');
    await page.getByLabel('Senha', { exact: true }).fill('Aurora123!');
    assert.equal(await passwordCriteria.innerText(), 'Critérios atendidos: 5 de 5');
    assert.equal(await page.locator('.account-auth-header-actions').count(), 1, 'etapa de acesso deve manter os controles de aparência');
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
    assert.equal(user.user_metadata.preferred_name, 'Pessoa', 'nome de preferência vazio deve usar o primeiro nome como padrão');
    assert.equal(signupRequests, 1, 'cadastro válido deve chamar o provedor uma vez');

    await page.evaluate(async () => {
      await window.authFlowResult.client.auth.signOut({ scope: 'local' });
      window.startAuthFlow('signup');
    });
    await page.getByRole('heading', { name: 'Seu perfil' }).waitFor();
    await page.getByLabel('Nome', { exact: true }).fill('Segunda tentativa');
    await page.getByLabel('Nome de preferência (opcional)', { exact: true }).fill('');
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
    assert.equal(await page.locator('.account-auth-header-actions').count(), 1, 'login deve manter os controles de aparência');
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

    const savedAuthKeyCount = await page.evaluate(
      () => Object.keys(localStorage).filter((key) => key.endsWith('-auth-token')).length,
    );
    assert.equal(savedAuthKeyCount, 1, 'a sessão de login marcada para persistir deve ficar no armazenamento local');
    const logoutRequestsBeforeRestoreFailure = logoutRequests;
    failNextUserLookup = true;
    await page.evaluate(() => window.startAuthFlow('login'));
    await page.waitForFunction(() => window.authFlowDone);
    assert.equal(await page.evaluate(() => window.authFlowResult), null);
    await page.getByText(/a sessão salva foi mantida/i).waitFor();
    assert.equal(logoutRequests, logoutRequestsBeforeRestoreFailure, 'uma falha temporária ao validar a sessão não deve encerrar o login');
    assert.equal(
      await page.evaluate(() => Object.keys(localStorage).filter((key) => key.endsWith('-auth-token')).length),
      1,
      'a sessão persistente deve continuar salva após uma falha temporária',
    );
    await page.evaluate(() => window.startAuthFlow('login'));
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
    assert.equal(await page.locator('.account-auth-header-actions').count(), 1, 'recuperação deve manter os controles de aparência');
    await page.setViewportSize({ width: 1280, height: 720 });
    await assertAccountCardDoesNotScrollInternally('recuperação em desktop');
    await assertAuthLayout('recuperação em desktop');
    await page.setViewportSize({ width: 390, height: 844 });
    await assertAuthLayout('recuperação no celular');
    await page.getByLabel('E-mail', { exact: true }).fill('pessoa@example.com');
    await page.getByRole('button', { name: 'Enviar instruções' }).click();
    await page.getByText('Se houver uma conta vinculada a esse e-mail, você receberá instruções para redefinir a senha. Confira também o spam e aguarde alguns minutos.').waitFor();
    await page.locator('.account-success-hero', { hasText: 'Link enviado' }).waitFor();
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
    assert.equal(await page.locator('.account-auth-header-actions').count(), 1, 'atualização da senha deve manter os controles de aparência');
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
    await page.locator('.account-success-hero', { hasText: 'Senha atualizada' }).waitFor();
    assert.equal(await page.evaluate(() => location.search), '', 'callback de redefinição é removido da URL');
    assert.equal(await page.locator('.account-message[data-tone="success"]').count(), 1);
    await page.getByLabel('E-mail', { exact: true }).fill('pessoa@example.com');
    await page.getByLabel('Senha', { exact: true }).fill('NovaSenha456!');
    await page.locator('.account-form button[type="submit"]').click();
    await page.waitForFunction(() => window.authFlowDone);
    assert.equal(await page.evaluate(() => window.authFlowError), '');
    assert.equal(await page.evaluate(() => window.authFlowResult?.user.email), 'pessoa@example.com');
    rejectNextUserLookup = true;
    await page.evaluate(() => window.startAuthFlow('login'));
    await page.waitForFunction(() => window.authFlowDone);
    await page.getByText('Sua sessão expirou. Entre novamente para continuar.').waitFor();
    assert.equal(
      await page.evaluate(() => Object.keys(localStorage).filter((key) => key.endsWith('-auth-token')).length),
      0,
      'uma sessão recusada pelo serviço deve ser removida',
    );
    assert.deepEqual(loginPasswords, ['SenhaErrada123!', 'Aurora123!', 'Aurora123!', 'NovaSenha456!']);
    assert.deepEqual(externalRequests, [], 'nenhuma requisição real fora do servidor local e do mock deve ocorrer');
    assert.deepEqual(unexpectedAuthRequests, [], 'somente endpoints de autenticação esperados devem ser chamados');
    assert.deepEqual(errors, [], 'o fluxo não deve gerar erros no console');
    console.log('auth-flows: callback Google, cadastro, login, recuperação e redefinição passaram com Supabase simulado');
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
