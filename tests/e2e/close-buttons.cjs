// Mede o botão de fechar em cada diálogo e painel (tamanho, distância do topo e da direita, raio).
// Todos devem ter 40x40 e o mesmo raio. Não é dependência do projeto. Uso: node tests/e2e/close-buttons.cjs
const { chromium, devices } = require('playwright');
const { completeProfile, enableAreas } = require('./setup.cjs');
(async()=>{const b=await chromium.launch();
const base = new URL((process.argv[2] || 'http://localhost:8765').replace(/\/$/, '/'));
base.searchParams.set('preview', '1');
for (const [n,ctx] of [['celular',devices['iPhone 14']],['desktop',{viewport:{width:1280,height:900}}]]) {
const p=await (await b.newContext(ctx)).newPage();
await p.goto(base.toString()); await p.waitForTimeout(400); await completeProfile(p); await enableAreas(p,['habits','finances']); await p.waitForTimeout(500);
const rows=[];
const measure=async(label)=>{rows.push(label+': '+await p.evaluate(()=>{const c=[...document.querySelectorAll('.dlg-close')].find(e=>e.getBoundingClientRect().width>0);if(!c)return 'sem X';const box=c.closest('.dlg')||c.closest('[role=dialog]')||c.parentElement.parentElement;const r=c.getBoundingClientRect(),b=box.getBoundingClientRect();return `${Math.round(r.width)}x${Math.round(r.height)} topo ${Math.round(r.top-b.top)} dir ${Math.round(b.right-r.right)} raio ${getComputedStyle(c).borderRadius} fundo ${getComputedStyle(c).backgroundColor}`}))};
const act=async(route,sel,label)=>{await p.evaluate(h=>location.hash=h,route); await p.waitForTimeout(350); const ok=await p.evaluate(s=>{const e=document.querySelector(s);if(e){e.click();return true}return false},sel); await p.waitForTimeout(450); if(!ok){rows.push(label+': botão de abrir não achado');return} await measure(label); await p.evaluate(()=>{const c=document.querySelector('[data-action="dlg-close"],[data-action="close-notifications"],#accessibility-close'); c&&c.click()}); await p.waitForTimeout(300); await p.reload(); await p.waitForTimeout(500)};
await act('habitos','[data-action="habit-new"]','novo hábito');
await act('planejar','[data-action="task-new"]','nova tarefa');
await act('financas','[data-action="tx-new"]','novo lançamento');
await p.evaluate(()=>{location.hash='financas'}); await p.waitForTimeout(300); await p.evaluate(()=>document.querySelector('[data-action="fin-tab"][data-t="contas"]')?.click()); await p.waitForTimeout(300); await act('financas','[data-action="acct-new"]','nova conta');
await p.evaluate(()=>location.hash='financas');
await act('inicio','.global-search-trigger','busca');
await p.evaluate(()=>location.hash='inicio'); await p.waitForTimeout(300);
await act('inicio','[data-action="accessibility-toggle"]','tema e acessibilidade');
await act('inicio','[data-action="toggle-notifications"]','notificações');
console.log('== '+n+'\n'+rows.join('\n'));}
await b.close();})();
