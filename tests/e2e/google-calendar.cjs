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
      body: `window.google={accounts:{oauth2:{initTokenClient:({callback})=>({requestAccessToken:()=>callback({access_token:"test-token",expires_in:3600,scope:"${SCOPE}"})})}}};`,
    });
  });
  await page.route('https://www.googleapis.com/calendar/v3/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    apiRequests.push({ method: request.method(), url });
    if (url.pathname.endsWith('/calendarList')) {
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ items: [{ id: 'primary', summary: 'Pessoal', primary: true, selected: true, accessRole: 'owner' }] }),
      });
    }
    if (url.pathname.endsWith('/events')) {
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ items: [{ summary: 'Evento de teste', start: { date: localDay(new Date()) } }] }),
      });
    }
    return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
  });

  try {
    await page.goto(`${BASE}/?preview#planejar`);
    if (identityScriptLoads) throw new Error('O Google Identity Services foi carregado antes de uma ação explícita.');
    await page.locator('[data-action="plan-view"][data-v="calendario"]').click();
    await page.getByRole('button', { name: 'Conectar Google Calendar' }).click();
    await page.getByRole('button', { name: 'Autorizar leitura do Google Calendar' }).waitFor();
    if (identityScriptLoads !== 1) throw new Error('O Google Identity Services não foi carregado após a ação de conexão.');
    await page.getByRole('button', { name: 'Autorizar leitura do Google Calendar' }).click();
    await page.getByText('Evento de teste').waitFor();
    if (!await page.locator('.google-event-dot').count()) throw new Error('O evento não marcou o dia correto.');
    if (await page.locator('.google-calendar-panel').textContent().then((text) => !text.includes('Somente leitura'))) {
      throw new Error('A integração não informa que é somente de leitura.');
    }
    if (apiRequests.some((request) => request.method !== 'GET')) throw new Error('A integração enviou uma solicitação que não é somente de leitura.');

    await page.getByRole('button', { name: 'Pessoal · principal' }).click();
    await page.getByText('Nenhum evento do Google Calendar neste dia.').waitFor();
    await page.getByRole('button', { name: 'Pessoal · principal' }).click();
    await page.getByText('Evento de teste').waitFor();
    await page.setViewportSize({ width: 320, height: 720 });
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) {
      throw new Error('Planejar tem overflow horizontal em 320 px.');
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) {
      throw new Error('Planejar tem overflow horizontal em desktop.');
    }

    await page.getByRole('button', { name: 'Parar de mostrar eventos' }).click();
    if (await page.getByText('Evento de teste').count()) throw new Error('Os eventos continuaram visíveis após desconectar.');
    if (errors.length) throw new Error(`Erros no navegador: ${errors.join('; ')}`);
    console.log('google-calendar-e2e: all checks passed');
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
