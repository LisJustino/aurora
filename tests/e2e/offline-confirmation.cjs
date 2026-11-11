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
  await profileName.fill(`${originalProfileName} editado`);
  const profileSave = page.locator('.profile-settings-actions [data-action="profile-save"]');
  const profileDiscard = page.locator('.profile-settings-actions [data-action="profile-discard"]');
  await page.waitForFunction(() => !document.querySelector('.profile-settings-actions [data-action="profile-save"]:disabled'));
  check(await profileSave.isEnabled(), 'perfil oferece salvar junto aos campos editados');
  check(await profileDiscard.isEnabled(), 'perfil oferece descartar junto aos campos editados');
  await profileDiscard.click();
  check(await profileName.inputValue() === originalProfileName, 'descartar restaura o perfil sem voltar ao topo');

  await profileName.fill(`${originalProfileName} em rascunho`);
  await page.locator('.settings-link[data-settings-tab="personalization"]').click();
  await page.waitForFunction(() => location.search === '?section=personalization');
  await page.locator('#settings-content[role="region"][aria-label="Seção de ajustes: Aparência e leitura"]').waitFor();
  await page.goBack();
  await page.waitForFunction(() => location.search === '?section=profile');
  check(await profileName.inputValue() === `${originalProfileName} em rascunho`, 'voltar entre seções preserva alterações não salvas');
  await profileDiscard.click();
  await page.goForward();
  await page.waitForFunction(() => location.search === '?section=personalization');

  await page.evaluate(() => {
    history.replaceState(null, '', '/config?section=appearance');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await page.waitForFunction(() => location.pathname === '/config' && location.search === '?section=appearance');
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
  await page.waitForFunction(() => location.search === '?section=profile');
  await page.goBack();
  await page.waitForFunction(() => location.pathname === '/inicio');
  check(await page.locator('#dlg').count() === 0, 'ajustes salvos não bloqueiam a navegação com aviso de rascunho');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => {
    history.pushState(null, '', '/config?section=data');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  check(
    (await page.locator('.settings-data-safety').innerText()).includes('de saúde e do ciclo'),
    'aviso de backup destaca a sensibilidade dos dados do ciclo',
  );
  await page.getByRole('button', { name: 'Exportar backup' }).click();
  const backupConfirmation = page.locator('#dlg');
  await backupConfirmation.getByText('O arquivo de backup não tem proteção própria por senha. Quem tiver acesso a ele poderá ver dados financeiros, de saúde e do ciclo. Guarde-o em um local privado. Deseja continuar?').waitFor();
  await backupConfirmation.getByRole('button', { name: 'Cancelar' }).click();
  check(await backupConfirmation.count() === 0, 'cancelar exportação fecha apenas a confirmação');
  const overflows = [];
  const inconsistentSpacing = [];
  const unlabeledSettingsSections = [];
  const sectionNames = {
    profile: 'Seu perfil',
    personalization: 'Aparência e leitura',
    home: 'Tela inicial',
    'areas-navigation': 'Áreas e menu',
    data: 'Dados e backup',
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
      await page.locator(`.settings-link[data-settings-tab="${section}"][aria-current="page"]`).waitFor();
      const regionLabel = await page.locator('#settings-content').getAttribute('aria-label');
      if (regionLabel !== `Seção de ajustes: ${sectionNames[section]}`) {
        unlabeledSettingsSections.push(`${section} em ${width}px`);
      }
      if (width <= 760 && section === 'profile') {
        if (width === 390) {
          check(
            (await page.locator('#settings-profile-title').innerText()) === 'Seu perfil.',
            'título do perfil sem pontuação duplicada',
          );
        }
        const menuLayout = await page.evaluate(() => {
          const menu = document.querySelector('.settings-menu');
          const links = [...menu.querySelectorAll('.settings-link')];
          return {
            scrollable: getComputedStyle(menu).overflowX === 'auto' && menu.scrollWidth > menu.clientWidth,
            count: links.length,
          };
        });
        check(
          menuLayout.scrollable && menuLayout.count === Object.keys(sectionNames).length,
          'menu móvel permite rolar por todas as abas',
        );
        await page.locator('.settings-link[data-settings-tab="account"]').click();
        await page.locator('.settings-link[data-settings-tab="account"][aria-current="page"]').waitFor();
        await page.locator('.settings-link[data-settings-tab="profile"]').click();
        await page.locator('.settings-link[data-settings-tab="profile"][aria-current="page"]').waitFor();
      }
      const cardSpacing = await page.locator(
        '.settings-content > .card, .settings-content > .profile-settings-container > .card, .settings-content > .settings-account-list > .card',
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
