import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { iconSvg } from '../src/js/utils/icons.js';

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
    body { margin: 0; width: 1200px; height: 630px; font-family: var(--font); background: linear-gradient(135deg, #3f2b2a 0%, #593047 52%, #7b504d 100%); color: var(--public-hero-ink); }
    main { display: flex; height: 100%; align-items: center; padding: 55px 76px; gap: 68px; }
    .copy { flex: 1; min-width: 0; }
    .brand { margin: 0 0 38px; color: var(--public-hero-ink); font-size: 48px; font-weight: 700; letter-spacing: -2px; }
    h1 { margin: 0; font-size: 64px; line-height: 1.08; letter-spacing: -2.5px; }
    .chips { display: flex; gap: 10px; margin-top: 30px; }
    .chip { padding: 8px 14px; border-radius: var(--r-pill); background: color-mix(in srgb, var(--tone) 16%, white); color: var(--tone); font-size: 15px; font-weight: 700; }
    .subtitle { max-width: 500px; margin: 27px 0 0; color: rgb(255 250 246 / 85%); font-size: 24px; line-height: 1.4; }
    .device { display: flex; width: 340px; height: 520px; flex: none; flex-direction: column; padding: 24px 18px 16px; border: 8px solid var(--preview-phone-frame); border-radius: 40px; background: var(--surface); box-shadow: 0 22px 42px -24px rgb(18 10 10 / 65%); color: var(--ink); }
    .app-brand { color: var(--accent); font-size: 23px; font-weight: 700; }
    .greeting { margin: 30px 0 18px; font-size: 22px; font-weight: 700; }
    .card { padding: 16px; border: 1px solid var(--line); border-radius: var(--r-card); background: var(--surface-strong); }
    .card-title { font-size: 20px; font-weight: 700; }
    .progress { margin: 7px 0 12px; color: var(--muted); font-size: 15px; }
    .task { display: flex; align-items: center; gap: 9px; padding: 10px 0; font-size: 15px; }
    .check { display: grid; width: 22px; height: 22px; flex: none; place-items: center; border: 2px solid var(--accent); border-radius: 50%; color: var(--accent); font-weight: 700; }
    .nav { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); margin-top: auto; padding-top: 15px; border-top: 1px solid var(--line); }
    .nav span { display: grid; justify-items: center; gap: 4px; color: var(--tone); font-size: 10px; font-weight: 700; white-space: nowrap; }
  </style><main><div class="copy"><p class="brand">aurora.</p><h1>Menos ruído.<br>Mais clareza no dia.</h1>
    <div class="chips"><span class="chip" style="--tone: var(--area-plan)">Planejar</span><span class="chip" style="--tone: var(--area-habits)">Hábitos</span><span class="chip" style="--tone: var(--area-finances)">Finanças</span><span class="chip" style="--tone: var(--area-cycle)">Ciclo</span></div>
    <p class="subtitle">Tarefas, hábitos, finanças e ciclo no seu ritmo.</p></div>
    <div class="device"><div class="app-brand">aurora.</div><div class="greeting">Seu dia, com calma.</div><div class="card"><div class="card-title">Para hoje</div><div class="progress">2 de 3 tarefas feitas</div><div class="task"><span class="check">✓</span>Organizar a semana</div><div class="task"><span class="check">✓</span>Responder mensagem</div><div class="task"><span class="check"></span>Ler por alguns minutos</div></div><div class="nav"><span style="--tone: var(--accent)">${iconSvg('home', 17)}Início</span><span style="--tone: var(--area-plan)">${iconSvg('calendarCheck', 17)}Planejar</span><span style="--tone: var(--area-habits)">${iconSvg('leaf', 17)}Hábitos</span><span style="--tone: var(--area-cycle)">${iconSvg('heart', 17)}Ciclo</span><span style="--tone: var(--area-finances)">${iconSvg('wallet', 17)}Finanças</span></div></div>
  </main></html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: output });
} finally {
  await browser.close();
}
