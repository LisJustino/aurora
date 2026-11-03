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

  await page.getByRole('button', { name: 'Exportar JSON comum' }).click();
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

  const encryptDialog = page.locator('#dlg');
  await page.getByRole('button', { name: 'Exportar cifrado' }).click();
  await encryptDialog.getByRole('heading', { name: 'Proteger backup com senha.' }).waitFor();
  await encryptDialog.locator('#backup-password').fill('Senha de teste privada');
  await encryptDialog.locator('#backup-password-confirm').fill('Senha de teste privada');
  const downloadPromise = page.waitForEvent('download');
  await encryptDialog.getByRole('button', { name: 'Baixar backup cifrado' }).click();
  const download = await downloadPromise;
  const filePath = await download.path();
  const serialized = await readFile(filePath, 'utf8');
  const envelope = JSON.parse(serialized);
  if (envelope.app !== 'aurora-encrypted-backup' || serialized.includes('Revisar orçamento mensal')) {
    throw new Error('O backup cifrado não tem o envelope esperado ou expôs dados em texto puro.');
  }
  await encryptDialog.waitFor({ state: 'detached' });

  await backupInput.setInputFiles(filePath);
  const decryptDialog = page.locator('#dlg');
  await decryptDialog.getByRole('heading', { name: 'Desbloquear backup.' }).waitFor();
  await decryptDialog.locator('#backup-password').fill('Senha errada de teste');
  await decryptDialog.getByRole('button', { name: 'Desbloquear e revisar' }).click();
  await decryptDialog.getByRole('alert').getByText('Senha incorreta ou backup danificado.').waitFor();
  if (await decryptDialog.locator('#backup-password').inputValue() !== '') {
    throw new Error('A senha incorreta permaneceu no campo após a tentativa.');
  }

  await page.keyboard.press('Escape');
  await decryptDialog.waitFor({ state: 'detached' });
  await backupInput.setInputFiles(filePath);
  await page.locator('#dlg').getByRole('heading', { name: 'Desbloquear backup.' }).waitFor();
  await page.locator('#backup-password').fill('Senha de teste privada');
  await page.getByRole('button', { name: 'Desbloquear e revisar' }).click();
  await page.locator('#dlg').getByRole('heading', { name: 'Importar este backup?' }).waitFor();
  if (errors.length) throw new Error(`Erros no console: ${errors.join(' | ')}`);

  await browser.close();
  browser = null;
  if (temporaryDirectory) {
    await rm(temporaryDirectory, { recursive: true, force: true });
    temporaryDirectory = null;
  }
  console.log('Backups v1/v2 e cifrado: compatibilidade, ausência de texto puro, senha inválida e prévia verificadas.');
})().catch(async (error) => {
  console.error(error);
  if (browser) await browser.close();
  if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true });
  process.exitCode = 1;
});
