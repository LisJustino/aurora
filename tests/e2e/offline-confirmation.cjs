const { chromium } = require('playwright');

const BASE = process.argv[2] || 'http://127.0.0.1:5173';
const results = [];
const check = (passed, name, detail = '') => {
  results.push(passed);
  console.log(`${passed ? 'OK   ' : 'FALHA'} — ${name}${detail ? ` (${detail})` : ''}`);
};

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  const offlinePage = await page.goto(`${BASE}/offline.html`);
  check(offlinePage?.status() === 200, '/offline.html responde HTTP 200');
  for (const [colorScheme, expectedBackground] of [
    ['light', 'rgb(247, 240, 234)'],
    ['dark', 'rgb(28, 27, 25)'],
  ]) {
    await page.emulateMedia({ colorScheme });
    const background = await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
    check(background === expectedBackground, `/offline.html aplica tema ${colorScheme}`, background);
  }
  await page.goto(`${BASE}/offline.html`);
  await page.getByRole('link', { name: 'Tentar novamente' }).waitFor();
  const [offlineReload] = await Promise.all([
    page.waitForNavigation(),
    page.evaluate(() => window.dispatchEvent(new Event('online'))),
  ]);
  check(offlineReload?.status() === 200, 'a página offline recarrega quando a conexão volta');

  await page.goto(`${BASE}/?preview#inicio`);
  await page.locator('#app .app-definitions').waitFor({ state: 'attached' });

  await context.setOffline(true);
  await page.waitForFunction(() => document.querySelector('.offline-banner'));
  check(await page.locator('.offline-banner').isVisible(), 'aviso offline permanece visível');
  check((await page.locator('.offline-banner').innerText()).includes('não serão salvas'), 'aviso explicita que alterações offline não serão salvas');
  await context.setOffline(false);
  await page.waitForFunction(() => !document.querySelector('.offline-banner'));

  await page.evaluate(() => {
    history.pushState(null, '', '/config?section=profile');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  const profileName = page.locator('#pname');
  await profileName.waitFor();
  const originalProfileName = await profileName.inputValue();
  const profileSex = page.locator('#psex');
  if (!await profileSex.inputValue()) await profileSex.selectOption('f');
  const editedProfileName = `${originalProfileName} editado`;
  await profileName.fill(editedProfileName);
  await page.locator('#toast .toast-message')
    .filter({ hasText: 'Alterações aplicadas nesta demonstração' })
    .waitFor({ state: 'visible' });
  check(await profileName.inputValue() === editedProfileName, 'alterar o perfil salva automaticamente');
  check(await page.locator('.profile-settings-actions, .settings-unsaved-bar').count() === 0,
    'perfil não exibe botões de salvar nem barra de alterações pendentes');
  await page.locator('#toast .toast-message').waitFor({ state: 'hidden' });

  const secondProfileName = `${originalProfileName} em rascunho`;
  await profileName.fill(secondProfileName);
  await page.locator('#toast .toast-message')
    .filter({ hasText: 'Alterações aplicadas nesta demonstração' })
    .waitFor({ state: 'visible' });
  await page.locator('.settings-mobile-trigger').click();
  await page.locator('.settings-link[data-settings-tab="personalization"]').click();
  await page.waitForFunction(() => location.pathname === '/ajustes/aparencia' && !location.search);
  await page.locator('#settings-content[role="region"][aria-label="Seção de ajustes: Aparência e leitura"]').waitFor();
  await page.goBack();
  await page.waitForFunction(() => location.pathname === '/ajustes/perfil');
  check(await profileName.inputValue() === secondProfileName, 'perfil permanece salvo ao trocar de seção');
  await page.goForward();
  await page.waitForFunction(() => location.pathname === '/ajustes/aparencia');

  await page.evaluate(() => {
    history.replaceState(null, '', '/config?section=appearance');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await page.waitForFunction(() => location.pathname === '/ajustes/aparencia' && !location.search);
  check(
    await page.locator('#appearance-area-colors-title').count() === 0,
    'personalização não exibe mais a seção de cores por área',
  );
  await page.setViewportSize({ width: 1024, height: 844 });
  await page.locator('[data-action="set-theme"][aria-pressed="false"]').first().click();
  await page.getByText('Salvo nesta demonstração.').waitFor({ state: 'visible' });
  check(await page.locator('.appearance-settings .settings-save-actions').count() === 0,
    'aparência salva automaticamente sem barra de alterações pendentes');
  await page.goBack();
  await page.waitForFunction(() => location.pathname === '/ajustes/perfil');
  const pendingProfileName = `${originalProfileName} antes de navegar`;
  await profileName.fill(pendingProfileName);
  await page.locator('.topbar a[href="/inicio"]').first().click();
  await page.waitForFunction(() => location.pathname === '/inicio');
  check(await page.locator('#dlg').count() === 0, 'sair do Perfil salva automaticamente sem pedir confirmação');
  await page.goBack();
  await profileName.waitFor({ state: 'visible' });
  check(await profileName.inputValue() === pendingProfileName, 'alteração pendente permanece salva ao voltar');
  await page.goBack();
  await page.waitForFunction(() => location.pathname === '/inicio');
  check(await page.locator('#dlg').count() === 0, 'ajustes salvos não bloqueiam a navegação');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => {
    history.pushState(null, '', '/config?section=data');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await page.waitForFunction(() => location.pathname === '/ajustes/dados');
  check(
    await page.locator('.settings-data-overview h2').innerText() === 'Gerenciar seus dados',
    'Ajustes de dados mantém a seção de recuperação',
  );
  check(
    await page.locator('[data-action="export"], input[data-change="import"]').count() === 0,
    'Ajustes não oferece exportação ou restauração de backup',
  );
  check(
    await page.locator('.settings-data-migration').count() === 0
      && await page.locator('.settings-data-trash, .settings-data-care').count() === 2,
    'Importação antiga removida; lixeira e ações de dados continuam disponíveis',
  );
  const overflows = [];
  const inconsistentSpacing = [];
  const unlabeledSettingsSections = [];
  const sectionNames = {
    profile: 'Seu perfil',
    personalization: 'Aparência e leitura',
    home: 'Tela inicial',
    'areas-navigation': 'Áreas e menu',
    data: 'Dados e recuperação',
    calendars: 'Agendas',
    'mental-health': 'Apoio psicológico',
    account: 'Conta e ajuda',
  };
  for (const width of [320, 390, 768, 1024]) {
    await page.setViewportSize({ width, height: 844 });
    for (const section of Object.keys(sectionNames)) {
      await page.evaluate((id) => {
        history.pushState(null, '', `/config?section=${id}`);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }, section);
      await page.locator(`.settings-link[data-settings-tab="${section}"][aria-current="page"]`).waitFor({ state: 'attached' });
      const regionLabel = await page.locator('#settings-content').getAttribute('aria-label');
      if (regionLabel !== `Seção de ajustes: ${sectionNames[section]}`) {
        unlabeledSettingsSections.push(`${section} em ${width}px`);
      }
      if (width <= 700 && section === 'profile') {
        if (width === 390) {
          check(
            (await page.locator('#settings-profile-title').innerText()) === 'Seu perfil',
            'título do perfil sem pontuação duplicada',
          );
        }
        const trigger = page.locator('.settings-mobile-trigger');
        await trigger.waitFor({ state: 'visible' });
        await trigger.click();
        const menuLayout = await page.evaluate(() => {
          const menu = document.querySelector('.settings-menu');
          const links = [...menu.querySelectorAll('.settings-link')];
          const headings = [...menu.querySelectorAll('.settings-menu-heading')];
          return {
            visible: getComputedStyle(menu).display !== 'none',
            count: links.length,
            headingsVisible: headings.every((heading) => heading.getBoundingClientRect().height > 4),
          };
        });
        check(
          menuLayout.visible && menuLayout.count === Object.keys(sectionNames).length && menuLayout.headingsVisible,
          'menu móvel expande verticalmente com grupos e todas as seções',
        );
        await page.locator('.settings-link[data-settings-tab="account"]').click();
        await page.locator('.settings-link[data-settings-tab="account"][aria-current="page"]').waitFor({ state: 'attached' });
        check(
          (await trigger.getAttribute('aria-expanded')) === 'false',
          'menu móvel fecha após selecionar uma seção',
        );
        await trigger.click();
        await page.locator('.settings-link[data-settings-tab="profile"]').click();
        await page.locator('.settings-link[data-settings-tab="profile"][aria-current="page"]').waitFor({ state: 'attached' });
      }
      const cardSpacing = await page.locator(
        '.settings-content > .card, .settings-content > .surface-open, .settings-content > .profile-settings-container > .card, .settings-content > .settings-account-list > .card',
      ).evaluateAll((cards) => cards.map((card) => {
        const style = getComputedStyle(card);
        return { gap: style.gap, padding: style.padding };
      }));
      const isConsistent = cardSpacing.length > 0
        && cardSpacing.every((spacing) => spacing.gap === cardSpacing[0].gap
          && spacing.padding === cardSpacing[0].padding);
      if (!isConsistent) inconsistentSpacing.push(`${section} em ${width}px`);
      const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      if (hasOverflow) overflows.push(`${section} em ${width}px`);
    }
  }
  check(inconsistentSpacing.length === 0, 'cards de Ajustes usam espaçamento uniforme em todas as abas e larguras', inconsistentSpacing.join(', '));
  check(unlabeledSettingsSections.length === 0, 'todas as seções têm rótulo acessível', unlabeledSettingsSections.join(', '));
  check(overflows.length === 0, 'sem overflow horizontal nas seções de Ajustes entre 320 e 1024 px', overflows.join(', '));
  check(errors.length === 0, 'sem erros no console', errors.slice(0, 3).join(' | '));

  await context.close();
  await browser.close();
  process.exit(results.every(Boolean) ? 0 : 1);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
