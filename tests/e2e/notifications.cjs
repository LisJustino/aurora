// Notificações: cria uma tarefa e um hábito com lembrete vencido, abre o painel e confere os cartões, o "Próximos hoje", adiar 1 h e dispensar.
// Não é dependência do projeto. Uso: node tests/e2e/notifications.cjs [http://localhost:8765]
const { chromium, devices } = require('playwright');
(async()=>{const b=await chromium.launch(); const errs=[];
for (const [n,ctx] of [['m',devices['iPhone 14']],['d',{viewport:{width:1280,height:800}}]]) {
const p=await (await b.newContext(ctx)).newPage(); p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
await p.goto((process.argv[2] || 'http://localhost:8765') + '/'); await p.waitForTimeout(400); await p.getByText('ver um exemplo').first().click().catch(()=>{}); await p.waitForTimeout(500);
await p.evaluate(()=>{
 const now=new Date(), pad=x=>String(x).padStart(2,'0'), hm=d=>pad(d.getHours())+':'+pad(d.getMinutes()), day=now.getFullYear()+'-'+pad(now.getMonth()+1)+'-'+pad(now.getDate());
 const t=JSON.parse(localStorage.getItem('aurora.app.tasks')); 
 const mk=(id,title,min)=>({id,title,done:false,priority:'normal',dueDate:day,time:hm(new Date(now.getTime()+min*60000)),remind:0,createdAt:Date.now(),tags:[]});
 t.v.push(mk('rt1','Enviar relatório',-1)); t.v.push(mk('rt2','Ligar para o dentista',90)); localStorage.setItem('aurora.app.tasks',JSON.stringify(t));
 const hb=[{id:'h1',name:'Meditar',days:[0,1,2,3,4,5,6],completions:[],status:'active',remind:hm(new Date(now.getTime()-5*60000)),icon:'meditate',color:'#8a7ac4'},{id:'h2',name:'Alongar',days:[0,1,2,3,4,5,6],completions:[],status:'active',remind:hm(new Date(now.getTime()+40*60000))}];
 localStorage.setItem('aurora.app.habits',JSON.stringify({v:hb,t:Date.now()}));});
await p.reload(); await p.waitForTimeout(2500);
console.log(n,'painel aberto', await p.evaluate(()=>!document.getElementById('notification-panel').hidden), 'ativas', await p.evaluate(()=>document.querySelectorAll('.notification-item').length), 'próximos', await p.evaluate(()=>document.querySelectorAll('.notification-upcoming li').length), 'ago', await p.evaluate(()=>[...document.querySelectorAll('.notification-ago')].map(e=>e.textContent).join('|')));

if(n==='m'){ await p.evaluate(()=>document.querySelector('[data-action="rem-snooze"][data-min="60"]').click()); await p.waitForTimeout(300); console.log('após adiar 1h', await p.evaluate(()=>document.querySelectorAll('.notification-item').length));
 await p.evaluate(()=>document.querySelector('[data-action="rem-dismiss-all"]')?.click()); await p.waitForTimeout(300); console.log('após dispensar tudo', await p.evaluate(()=>document.querySelectorAll('.notification-item').length), await p.evaluate(()=>document.getElementById('notification-panel').hidden)); }
console.log(n,'overflow', await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth));
}
console.log(errs.join('|')||'sem erros'); await b.close();})();
