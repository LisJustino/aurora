const { chromium } = require('playwright');

const BASE = process.argv[2] || 'http://127.0.0.1:5173';
const SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';
const localDay = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  const apiRequests = [];
  let identityScriptLoads = 0;
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.route('https://accounts.google.com/gsi/client', (route) => {
    identityScriptLoads += 1;
    return route.fulfill({
      contentType: 'application/javascript',
      body: `let tokenNumber=0;window.googleInitPrompts=[];window.google={accounts:{oauth2:{initTokenClient:({callback,prompt})=>{window.googleInitPrompts.push(prompt);return {requestAccessToken:()=>callback({access_token:"test-token-"+ ++tokenNumber,expires_in:3600,scope:"${SCOPE}"})}}}}};`,
    });
  });
  await page.route('https://www.googleapis.com/calendar/v3/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const accountNumber = request.headers().authorization?.endsWith('-2') ? 2 : 1;
    apiRequests.push({ method: request.method(), url });
    if (url.pathname.endsWith('/calendarList')) {
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            { id: `primary-${accountNumber}@example.test`, summary: `Pessoal ${accountNumber}`, primary: true, selected: true, accessRole: 'owner' },
            { id: `shared-${accountNumber}`, summary: `Compartilhado ${accountNumber}`, selected: false, accessRole: 'reader' },
          ],
        }),
      });
    }
    if (url.pathname.endsWith('/events')) {
      const eventTitle = url.pathname.includes(`shared-${accountNumber}`)
        ? `Evento compartilhado da conta ${accountNumber}`
        : `Evento da conta ${accountNumber}`;
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ items: [{ summary: eventTitle, start: { date: localDay(new Date()) } }] }),
      });
    }
    return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
  });

  try {
    await page.goto(`${BASE}/?preview#config?section=calendars`);
    if (identityScriptLoads) throw new Error('O Google Identity Services foi carregado antes de uma ação explícita.');
    await page.getByRole('button', { name: 'Adicionar conta Google' }).click();
    await page.getByRole('button', { name: 'Autorizar acesso do Google Calendar' }).waitFor();
    if (identityScriptLoads !== 1) throw new Error('O Google Identity Services não foi carregado após uma ação explícita.');
    await page.getByRole('button', { name: 'Autorizar acesso do Google Calendar' }).click();
    await page.getByText('primary-1@example.test').waitFor();

    await page.getByRole('button', { name: 'Adicionar conta Google' }).click();
    await page.getByRole('button', { name: 'Autorizar acesso do Google Calendar' }).waitFor();
    await page.getByRole('button', { name: 'Autorizar acesso do Google Calendar' }).click();
    await page.getByText('primary-2@example.test').waitFor();
    if (await page.evaluate(() => window.googleInitPrompts.some((prompt) => prompt !== 'select_account'))) {
      throw new Error('A autorização não ofereceu a escolha explícita da conta Google.');
    }

    await page.evaluate(() => { location.hash = 'planejar'; });
    await page.locator('[data-change="plan-view"]').selectOption('calendario');
    await page.getByText('Evento da conta 1').waitFor();
    await page.getByText('Evento da conta 2').waitFor();
    if (!await page.locator('.google-event-dot').count()) throw new Error('Os eventos não marcaram o dia correto.');
    if (await page.locator('.google-calendar-panel').textContent().then((text) => !text.includes('Somente leitura'))) {
      throw new Error('A integração não informa que é somente de leitura.');
    }

    await page.getByRole('link', { name: 'Gerenciar agendas' }).click();
    await page.getByRole('button', { name: 'Compartilhado 2' }).click();
    await page.getByRole('link', { name: 'Planejar' }).click();
    await page.getByText('Evento compartilhado da conta 2').waitFor();
    if (apiRequests.some((request) => request.method !== 'GET')) throw new Error('A integração enviou uma solicitação que não é somente de leitura.');

    await page.setViewportSize({ width: 320, height: 720 });
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) {
      throw new Error('Planejar tem overflow horizontal em 320 px.');
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) {
      throw new Error('Planejar tem overflow horizontal em desktop.');
    }

    await page.evaluate(() => {
      const url = new URL(location.href);
      url.pathname = '/config';
      url.hash = '';
      url.searchParams.set('section', 'calendars');
      history.pushState(null, '', `${url.pathname}${url.search}`);
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await page.locator('.google-calendar-account').first().waitFor();
    await page.setViewportSize({ width: 320, height: 720 });
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) {
      throw new Error('Ajustes → Agendas tem overflow horizontal em 320 px.');
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) {
      throw new Error('Ajustes → Agendas tem overflow horizontal em desktop.');
    }
    await page.locator('.google-calendar-account').filter({ hasText: 'primary-1@example.test' })
      .getByRole('button', { name: 'Desconectar' }).click();
    await page.getByText('primary-1@example.test').waitFor({ state: 'detached' });
    await page.getByText('primary-2@example.test').waitFor();
    await page.reload();
    await page.getByRole('button', { name: 'Adicionar conta Google' }).waitFor();
    if (await page.locator('.google-calendar-account').count()) {
      throw new Error('As contas ou autorizações persistiram após recarregar a página.');
    }
    if (errors.length) throw new Error(`Erros no navegador: ${errors.join('; ')}`);
    console.log('google-calendar-e2e: all checks passed');
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
