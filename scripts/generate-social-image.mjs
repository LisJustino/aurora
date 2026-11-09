import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';

const output = fileURLToPath(new URL('../public/og/aurora-1200x630.png', import.meta.url));
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><style>
    * { box-sizing: border-box; }
    body { margin: 0; width: 1200px; height: 630px; font-family: Arial, sans-serif; background: #f5e8e9; color: #38252d; }
    main { display: flex; height: 100%; align-items: center; padding: 64px 76px; gap: 66px; }
    .copy { width: 520px; }
    .brand { margin: 0 0 28px; color: #82465e; font-size: 55px; font-weight: 700; }
    h1 { margin: 0; font-size: 65px; line-height: 1.08; letter-spacing: -2px; }
    .subtitle { margin: 27px 0 0; font-size: 30px; line-height: 1.3; }
    .device { width: 350px; height: 520px; padding: 24px; border: 8px solid #38252d; border-radius: 40px; background: #fffaf8; box-shadow: 0 20px 50px #84546b44; }
    .app-brand { color: #82465e; font-size: 25px; font-weight: 700; }
    .greeting { margin: 35px 0 18px; font-size: 25px; font-weight: 700; }
    .card { padding: 20px; border: 1px solid #ded2d5; border-radius: 18px; background: white; }
    .card-title { font-size: 24px; font-weight: 700; }
    .progress { color: #6b5961; font-size: 18px; margin: 8px 0 15px; }
    .task { display: flex; align-items: center; gap: 10px; padding: 10px 0; font-size: 18px; }
    .check { display: grid; width: 24px; height: 24px; place-items: center; border: 2px solid #6977d7; border-radius: 50%; color: #6977d7; font-weight: 700; }
    .nav { display: flex; justify-content: space-between; margin-top: 37px; color: #6b5961; font-size: 16px; }
  </style><main><div class="copy"><p class="brand">aurora.</p><h1>Menos ruído.<br>Mais clareza no dia.</h1><p class="subtitle">Tarefas, hábitos, foco e finanças em um só lugar.</p></div>
    <div class="device"><div class="app-brand">aurora.</div><div class="greeting">Seu dia, com calma.</div><div class="card"><div class="card-title">Para hoje</div><div class="progress">2 de 3 tarefas feitas</div><div class="task"><span class="check">✓</span>Organizar a semana</div><div class="task"><span class="check">✓</span>Responder mensagem</div><div class="task"><span class="check"></span>Ler por alguns minutos</div></div><div class="nav"><span>Início</span><span>Planejar</span><span>Hábitos</span></div></div>
  </main></html>`);
  await page.screenshot({ path: output });
} finally {
  await browser.close();
}
