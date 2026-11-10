import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const output = process.env.AURORA_SOCIAL_OUTPUT
  ? resolve(process.env.AURORA_SOCIAL_OUTPUT)
  : fileURLToPath(new URL('../public/og/aurora-1200x630.png', import.meta.url));
const font = (await readFile(new URL('../src/fonts/dm-sans-latin.woff2', import.meta.url))).toString('base64');
const tokens = await readFile(new URL('../src/css/design-system/tokens.css', import.meta.url), 'utf8');
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><style>
    ${tokens}
    @font-face { font-family: "DM Sans"; src: url(data:font/woff2;base64,${font}) format("woff2"); font-weight: 100 1000; }
    * { box-sizing: border-box; }
    body { margin: 0; width: 1200px; height: 630px; font-family: var(--font); background: var(--bg); color: var(--ink); }
    main { display: flex; height: 100%; align-items: center; padding: 64px 76px; gap: 66px; }
    .copy { width: 520px; }
    .brand { margin: 0 0 28px; color: var(--accent); font-size: 55px; font-weight: 700; }
    h1 { margin: 0; font-size: 65px; line-height: 1.08; letter-spacing: -2px; }
    .subtitle { margin: 27px 0 0; font-size: 30px; line-height: 1.3; }
    .device { width: 350px; height: 520px; padding: 24px; border: 8px solid var(--ink); border-radius: 40px; background: var(--surface); box-shadow: var(--card-shadow); }
    .app-brand { color: var(--accent); font-size: 25px; font-weight: 700; }
    .greeting { margin: 35px 0 18px; font-size: 25px; font-weight: 700; }
    .card { padding: 20px; border: 1px solid var(--line); border-radius: var(--r-group); background: var(--surface); }
    .card-title { font-size: 24px; font-weight: 700; }
    .progress { color: var(--muted); font-size: 18px; margin: 8px 0 15px; }
    .task { display: flex; align-items: center; gap: 10px; padding: 10px 0; font-size: 18px; }
    .check { display: grid; width: 24px; height: 24px; place-items: center; border: 2px solid var(--accent); border-radius: 50%; color: var(--accent); font-weight: 700; }
    .nav { display: flex; justify-content: space-between; margin-top: 37px; color: var(--muted); font-size: 16px; }
  </style><main><div class="copy"><p class="brand">aurora.</p><h1>Menos ruído.<br>Mais clareza no dia.</h1><p class="subtitle">Tarefas, hábitos, ciclo e finanças em um só lugar.</p></div>
    <div class="device"><div class="app-brand">aurora.</div><div class="greeting">Seu dia, com calma.</div><div class="card"><div class="card-title">Para hoje</div><div class="progress">2 de 3 tarefas feitas</div><div class="task"><span class="check">✓</span>Organizar a semana</div><div class="task"><span class="check">✓</span>Responder mensagem</div><div class="task"><span class="check"></span>Ler por alguns minutos</div></div><div class="nav"><span>Início</span><span>Planejar</span><span>Hábitos</span></div></div>
  </main></html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: output });
} finally {
  await browser.close();
}
