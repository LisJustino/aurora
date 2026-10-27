// Diálogos no celular: o teclado não abre sozinho e o painel não pula. Não é dependência do projeto.
// Uso: node tests/e2e/dialog-mobile.cjs [http://localhost:8765]  (iPhone 13 emulado; no desktop o foco automático continua)
const { chromium, devices } = require('playwright');
(async()=>{const b=await chromium.launch(); const errs=[];
for (const [n,ctx] of [['iphone',devices['iPhone 13']],['desktop',{viewport:{width:1280,height:900}}]]) {
const p=await (await b.newContext(ctx)).newPage(); p.on('pageerror',e=>errs.push(e.message));
await p.goto((process.argv[2] || 'http://localhost:8765') + '/'); await p.waitForTimeout(400); await p.getByText('ver um exemplo').first().click().catch(()=>{}); await p.waitForTimeout(500);
await p.evaluate(()=>location.hash='habitos'); await p.waitForTimeout(400);
await p.evaluate(()=>document.querySelector('[data-action="habit-new"]').click()); await p.waitForTimeout(700);
console.log(n,'foco ao abrir:', await p.evaluate(()=>document.activeElement.tagName+'.'+(document.activeElement.dataset.dlg||document.activeElement.className)));
const y1=await p.evaluate(()=>document.querySelector('#dlg .dlg').getBoundingClientRect().top);
await p.evaluate(()=>document.querySelector('[data-dlg=name]').focus()); await p.waitForTimeout(300);
const y2=await p.evaluate(()=>document.querySelector('#dlg .dlg').getBoundingClientRect().top);
console.log(n,'topo do diálogo antes/depois de focar o campo', Math.round(y1), Math.round(y2));
console.log(n,'toast presente', await p.evaluate(()=>!!document.querySelector('#toast'))); 
}
console.log(errs.join('|')||'sem erros'); await b.close();})();
