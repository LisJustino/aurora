const { chromium } = require('playwright');
const { mkdtemp, readFile, rm, writeFile } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const BASE = process.argv[2] || 'http://127.0.0.1:5179';
let browser;
let temporaryDirectory;

(async () => {
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto(`${BASE}/?preview#config?section=data`);
  const backupInput = page.locator('input[data-change="import"]');
  const backupCardText = await page.locator('.settings-backup-card').innerText();
  if (await page.locator('[data-action="load-sample"]').count()) {
    throw new Error('A conta não deve oferecer carregamento de exemplos em Ajustes.');
  }
  if (/\bjson\b/i.test(backupCardText)) {
    throw new Error('A área de backup ainda mostra o termo técnico JSON.');
  }
  const legacyImport = page.locator('details.settings-data-migration');
  const legacySummary = legacyImport.locator('summary');
  if (await legacyImport.evaluate((element) => element.open)) {
    throw new Error('A importação de dados antigos deve ficar recolhida inicialmente.');
  }
  await legacySummary.focus();
  await page.keyboard.press('Enter');
  if (!(await legacyImport.evaluate((element) => element.open))) {
    throw new Error('A importação de dados antigos não abriu pelo teclado.');
  }
  await page.keyboard.press('Enter');
  if (await legacyImport.evaluate((element) => element.open)) {
    throw new Error('A importação de dados antigos não fechou pelo teclado.');
  }
  for (const width of [320, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)) {
      throw new Error(`A área de backup tem overflow horizontal em ${width}px.`);
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });

  await page.getByRole('button', { name: 'Exportar backup' }).click();
  const plainDownloadPromise = page.waitForEvent('download');
  await page.locator('#dlg').getByRole('button', { name: 'Continuar' }).click();
  await page.locator('#dlg').waitFor({ state: 'detached' });
  const plainDownload = await plainDownloadPromise;
  const plainBackup = JSON.parse(await readFile(await plainDownload.path(), 'utf8'));
  if (plainBackup.app !== 'aurora' || plainBackup.version !== 2) {
    throw new Error('A exportação JSON antiga deixou de preservar o formato Aurora v2.');
  }
  await backupInput.setInputFiles(await plainDownload.path());
  await page.locator('#dlg').getByRole('heading', { name: 'Importar este backup?' }).waitFor();
  if (!(await page.locator('#dlg').innerText()).includes('Esta opção não mescla os dados.')) {
    throw new Error('A prévia deve informar que a restauração substitui os dados, sem mesclar.');
  }
  for (const label of ['Contas financeiras', 'Registros de hidratação', 'Itens na lixeira']) {
    if (!(await page.locator('#dlg .backup-preview').innerText()).includes(label)) {
      throw new Error(`O resumo da cópia não mostra ${label}.`);
    }
  }
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await page.locator('#dlg').waitFor({ state: 'detached' });

  temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'aurora-backup-check-'));
  const intimacyBackupPath = path.join(temporaryDirectory, 'backup-cycle-intimacy.json');
  await writeFile(intimacyBackupPath, JSON.stringify({
    ...plainBackup,
    extras: {
      ...plainBackup.extras,
      cycleLog: {
        ...(plainBackup.extras.cycleLog || {}),
        '2026-03-01': {
          sexualActivity: false,
          sexToysUsed: true,
          libido: 'low',
          orgasmOccurred: false,
          mood: ['concentration', 'memory'],
          social: ['interaction', 'interaction-helped'],
          weightKg: 65.5,
          ovulationTestResult: 'positive',
          pregnancyTestResult: 'negative',
          medicationTaken: false,
        },
      },
    },
  }));
  await backupInput.setInputFiles(intimacyBackupPath);
  await page.locator('#dlg').getByRole('heading', { name: 'Importar este backup?' }).waitFor();
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await page.locator('#dlg').waitFor({ state: 'detached' });

  const versionOnePath = path.join(temporaryDirectory, 'backup-v1.json');
  await writeFile(versionOnePath, JSON.stringify({ ...plainBackup, version: 1 }));
  await backupInput.setInputFiles(versionOnePath);
  await page.locator('#dlg').getByRole('heading', { name: 'Importar este backup?' }).waitFor();
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await page.locator('#dlg').waitFor({ state: 'detached' });

  if (errors.length) throw new Error(`Erros no console: ${errors.join(' | ')}`);

  await browser.close();
  browser = null;
  if (temporaryDirectory) {
    await rm(temporaryDirectory, { recursive: true, force: true });
    temporaryDirectory = null;
  }
  console.log('Backups Aurora v1/v2: exportação, compatibilidade e prévia de restauração verificadas.');
})().catch(async (error) => {
  console.error(error);
  if (browser) await browser.close();
  if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true });
  process.exitCode = 1;
});
