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
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await page.locator('#dlg').waitFor({ state: 'detached' });

  temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'aurora-backup-check-'));
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
