const { spawn, spawnSync } = require('node:child_process');
const { existsSync } = require('node:fs');
const { createServer } = require('node:net');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const VITE = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
const servers = [];
let DEV_URL;
let PREVIEW_URL;

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

function startServer(mode, port) {
  const server = spawn(process.execPath, [
    VITE,
    mode,
    '--host',
    '127.0.0.1',
    '--port',
    String(port),
    '--strictPort',
  ], {
    cwd: ROOT,
    env: { ...process.env, CI: '1' },
    stdio: 'inherit',
  });
  servers.push(server);
  return server;
}

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function waitForServer(server, url) {
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`O servidor Vite encerrou antes de ficar disponível: ${url}`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await delay(250);
  }
  throw new Error(`Tempo esgotado aguardando o servidor Vite: ${url}`);
}

function runSuite(file, ...args) {
  console.log(`\n==> ${file}`);
  const result = spawnSync(process.execPath, [
    path.join(ROOT, 'tests', 'e2e', file),
    ...args,
  ], {
    cwd: ROOT,
    env: { ...process.env, CI: '1' },
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${file} terminou com código ${result.status ?? result.signal}.`);
  }
}

function runCrossBrowserSuite(browserName) {
  console.log(`\n==> cross-browser-smoke.cjs (${browserName})`);
  const result = spawnSync(process.execPath, [
    path.join(ROOT, 'tests', 'e2e', 'cross-browser-smoke.cjs'),
    DEV_URL,
  ], {
    cwd: ROOT,
    env: { ...process.env, CI: '1', PLAYWRIGHT_BROWSER: browserName },
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`cross-browser-smoke.cjs (${browserName}) terminou com código ${result.status ?? result.signal}.`);
  }
}

async function stopServers() {
  for (const server of servers.reverse()) {
    if (server.exitCode === null) server.kill();
  }
}

async function main() {
  if (!existsSync(VITE)) throw new Error('Vite não está instalado. Execute npm ci antes dos testes E2E.');
  if (!existsSync(path.join(ROOT, 'dist', 'index.html'))) {
    throw new Error('Build ausente. Execute npm run build antes dos testes E2E do CI.');
  }

  const devPort = await findAvailablePort();
  let previewPort = await findAvailablePort();
  while (previewPort === devPort) previewPort = await findAvailablePort();
  DEV_URL = `http://127.0.0.1:${devPort}`;
  PREVIEW_URL = `http://127.0.0.1:${previewPort}`;
  const devServer = startServer('dev', devPort);
  const previewServer = startServer('preview', previewPort);
  await Promise.all([
    waitForServer(devServer, DEV_URL),
    waitForServer(previewServer, PREVIEW_URL),
  ]);

  runSuite('public-demo-interactions.cjs', DEV_URL);
  runSuite('mobile-landing-matrix.cjs', DEV_URL);
  runSuite('habits-app-experience.cjs', DEV_URL);
  runSuite('backup-export-import.cjs', DEV_URL);
  runSuite('pwa-update.cjs', PREVIEW_URL);
  runSuite('offline-confirmation.cjs', DEV_URL);
  runSuite('signup-birthdate.cjs', DEV_URL);
  runSuite('auth-flows.cjs');
  runSuite('app-shell-quick-actions.cjs', DEV_URL);
  runSuite('app-shell-pomodoro-mini.cjs', DEV_URL);
  runSuite('accessibility.cjs', DEV_URL);
  runSuite('custom-select.cjs', DEV_URL);
  runSuite('cycle-intimacy.cjs', DEV_URL);
  runSuite('finance-improvements.cjs', DEV_URL);
  runSuite('weekly-review-flow.cjs', DEV_URL);
  runSuite('modal-scroll-lock.cjs', DEV_URL);
  runSuite('auth-preview-boundary.cjs', DEV_URL, PREVIEW_URL);
  if (process.env.RUN_BROWSER_MATRIX === '1') {
    runCrossBrowserSuite('firefox');
    runCrossBrowserSuite('webkit');
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(stopServers);
