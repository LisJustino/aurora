async function completeProfile(page) {
  const onboarding = page.locator('#dlg[data-dialog-type="onboard"]');
  if (!(await onboarding.count())) {
    const customize = page.getByRole('button', { name: 'Personalizar perfil' });
    if (await customize.count()) await customize.click();
    else return;
  }
  await onboarding.waitFor({ state: 'visible' });
  await page.locator('[data-dlg="name"]').fill('Pessoa de teste');
  await page.locator('[data-dlg="sex"]').selectOption('n');
  await page.locator('[data-action="ob-next"]').click();
  await page.locator('[data-action="ob-next"]').click();
  await page.locator('[data-action="ob-finish"]').click();
  await onboarding.waitFor({ state: 'detached' });
}

async function enableAreas(page, areas) {
  await page.evaluate((enabledAreas) => {
    const settings = JSON.parse(localStorage.getItem('aurora.app.settings') || 'null');
    if (!settings?.v?.areas) return;
    for (const area of enabledAreas) {
      if (!Object.hasOwn(settings.v.areas, area)) throw new Error(`Área desconhecida: ${area}.`);
      settings.v.areas[area] = true;
    }
    localStorage.setItem('aurora.app.settings', JSON.stringify(settings));
  }, areas);
  await page.reload();
}

module.exports = { completeProfile, enableAreas };
