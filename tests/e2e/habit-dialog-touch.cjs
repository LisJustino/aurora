// Novo hábito no celular: toques reais em ícone, cor e dia, e foco no horário, sem deslocar o conteúdo para o lado.
// Não é dependência do projeto. Uso: node tests/e2e/habit-dialog-touch.cjs [http://localhost:8765]
const { chromium, devices } = require('playwright');
const { completeProfile, enableAreas } = require('./setup.cjs');
(async()=>{const b=await chromium.launch();
const p=await (await b.newContext({...devices['iPhone 14']})).newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto((process.argv[2] || 'http://localhost:8765') + '/'); await p.waitForTimeout(300); await completeProfile(p); await enableAreas(p,['habits']); await p.waitForTimeout(400);
await p.evaluate(()=>location.hash='habitos'); await p.waitForTimeout(300);
await p.evaluate(()=>document.querySelector('[data-action="habit-new"]').click()); await p.waitForTimeout(500);
// toca em ícone, cor e dia reais
const tap=async(sel)=>{const el=p.locator(sel).first(); await el.scrollIntoViewIfNeeded(); const bb=await el.boundingBox(); await p.touchscreen.tap(bb.x+bb.width/2,bb.y+bb.height/2); await p.waitForTimeout(150)};
await tap('.habit-icon-picker label:nth-child(3)'); await tap('.habit-color-picker label:nth-child(4)'); await tap('.habit-weekday-picker label:nth-child(2)');
console.log(await p.evaluate(()=>JSON.stringify({icon:document.querySelector('.habit-icon-picker input:checked')?.value,color:document.querySelector('.habit-color-picker input:checked')?.value,dias:[...document.querySelectorAll('.habit-weekday-picker input:checked')].map(i=>i.value).join(''),sl:document.querySelector('#dlg .dlg-body').scrollLeft,x:document.querySelector('#dlg .dlg').getBoundingClientRect().left})));
await p.evaluate(()=>{document.querySelector('[data-dlg=remind]').focus()}); await p.waitForTimeout(300);
console.log('após focar o horário', await p.evaluate(()=>JSON.stringify({sl:document.querySelector('#dlg .dlg-body').scrollLeft,x:document.querySelector('#dlg .dlg').getBoundingClientRect().left,sw:document.querySelector('#dlg .dlg-body').scrollWidth})));
console.log(errs.join('|')||'sem erros'); await b.close();})();
