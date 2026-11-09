import { iconSvg as demoIcon } from '../../utils/icons.js';
import { prefersReducedMotion } from '../../utils/motion.js';
import { renderPublicHeader } from '../appearance/public-controls.js';
import { timeBasedGreeting } from '../profile/model.js';

const DEMO_NAV_ITEMS = [
  ['today', 'Hoje', 'home'],
  ['tasks', 'Tarefas', 'calendarCheck'],
  ['habits', 'Hábitos', 'leaf'],
  ['cycle', 'Ciclo', 'heart'],
  ['finance', 'Finanças', 'wallet'],
];

const demoControllers = new WeakMap();

export function stopLandingDemo(root) {
  const controller = demoControllers.get(root);
  if (!controller) return;
  root.removeEventListener('click', controller.onClick);
  demoControllers.delete(root);
}

function escapeDemoText(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function renderTaskRows(tasks) {
  const nextTaskId = tasks.find((task) => !task.done)?.id;
  return `<ul class="list demo-task-list">${tasks.map((task) => `
    <li class="task ${task.done ? 'done' : task.id === nextTaskId ? 'is-next' : ''}">
      <span class="chk" aria-hidden="true"><span>${demoIcon('check', 15)}</span></span>
      <div class="tt"><span class="ttl">${escapeDemoText(task.title)}</span><span class="meta">${task.done ? '<span>Concluída</span>' : task.id === nextTaskId ? '<span class="m-warn">Próximo passo</span>' : '<span class="m-warn">Hoje</span>'}<span>Exemplo</span></span></div>
    </li>`).join('')}</ul>`;
}

function renderHabitCard({ large = false } = {}) {
  const days = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
  return `
    <section class="card demo-habit-card ${large ? 'demo-habit-card--large' : ''}" aria-labelledby="demo-habit-title">
      <div class="head"><div><p class="section-kicker">Um cuidado seu</p><h2 id="demo-habit-title">Alongar um pouquinho</h2></div>${demoIcon('leaf', 20)}</div>
      <p class="demo-muted">2 dias nesta semana</p>
      <div class="demo-habit-week" aria-label="Check-ins fictícios nesta semana">${days.map((day, index) => `<span class="${index < 2 ? 'is-complete' : ''}" aria-hidden="true">${day}</span>`).join('')}</div>
      <p class="demo-readonly-note">Registro de exemplo · somente leitura.</p>
    </section>`;
}

function renderPageHeading(eyebrow, title, description = '') {
  return `<header class="demo-page-heading"><div><p class="section-kicker">${eyebrow}</p><h1 tabindex="-1">${title}</h1>${description ? `<p>${description}</p>` : ''}</div></header>`;
}

function demoNotice() {
  return `<div class="notice warn sample-banner" role="note">${demoIcon('info', 18)}<div class="grow"><strong>Você está na demonstração</strong><span>Dados fictícios, somente leitura. Nada é enviado nem salvo na sua conta.</span></div><a class="btn sm" href="/criar-conta" data-public-action="signup">Criar minha conta</a></div>`;
}

function renderHomeTask(task) {
  return `<li class="task ${task.done ? 'done' : ''}">
      <span class="chk" aria-hidden="true"><span>${demoIcon('check', 15)}</span></span>
      <div class="tt"><span class="ttl">${escapeDemoText(task.title)}</span><span class="meta"><span class="m-warn">Hoje</span><span>Exemplo</span></span></div>
    </li>`;
}

function renderToday(state) {
  const done = state.tasks.filter((task) => task.done);
  const open = state.tasks.filter((task) => !task.done);
  const completed = done.length;
  const total = state.tasks.length;
  const circumference = 2 * Math.PI * 32;
  const offset = circumference * (1 - completed / total);
  const lead = open.length ? `Você tem ${open.length} ${open.length === 1 ? 'tarefa pendente' : 'tarefas pendentes'} para hoje.` : 'Tudo concluído por hoje. Aproveite o resto do dia.';
  const shortDate = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: 'numeric', month: 'long' }).format(new Date()).replace(/[.,]/g, '').replace(/^(\S+) /, '$1, ');
  return `
    <header class="home-head" aria-labelledby="demo-greeting">
      <div>
        <p class="date">${escapeDemoText(shortDate.charAt(0).toUpperCase() + shortDate.slice(1))}</p>
        <h1 id="demo-greeting" tabindex="-1">${timeBasedGreeting()}, <span class="proper-name">Pessoa</span><i>.</i></h1>
        <p class="lead" aria-live="polite">${lead}</p>
        <div class="home-head-actions"><button type="button" class="home-action" data-demo-view="tasks">${demoIcon('plus', 18)}Ver tarefas de exemplo${demoIcon('chevRight', 16)}</button></div>
      </div>
      <div class="ringw" role="img" aria-label="${completed} de ${total} tarefas de hoje concluídas"><svg width="76" height="76" viewBox="0 0 76 76" aria-hidden="true"><circle class="ring-bg" cx="38" cy="38" r="32" fill="none" stroke-width="7"/><circle class="ring-fg" cx="38" cy="38" r="32" fill="none" stroke-width="7" stroke-linecap="round" stroke-dasharray="${circumference.toFixed(1)}" stroke-dashoffset="${offset.toFixed(1)}" transform="rotate(-90 38 38)"/></svg><div class="rt">${completed}/${total}</div></div>
    </header>
    ${demoNotice()}
    <div class="home-dashboard no-optional-areas">
      <div class="home-primary">
        <section class="card home-today-card" aria-labelledby="demo-today-tasks-title">
          <div class="head"><div><p class="section-kicker">Seu plano</p><h2 id="demo-today-tasks-title">Hoje<i>.</i></h2></div><div class="row"><button type="button" class="btn ghost sm" data-demo-view="tasks">Ver planejamento</button></div></div>
          <div class="home-task-groups">
            ${open.length ? `<section class="home-task-group" aria-label="Tarefas para hoje"><h3>${demoIcon('calendarCheck', 15)}Para hoje <span>${open.length}</span></h3><ul class="list">${open.map(renderHomeTask).join('')}</ul></section>` : ''}
            ${done.length ? `<details class="home-completed"><summary>${demoIcon('check', 15)}Concluídas hoje <span class="home-completed-count">${done.length}</span></summary><ul class="list">${done.map(renderHomeTask).join('')}</ul></details>` : ''}
          </div>
        </section>
        <section class="strip" aria-label="Resumo do dia">
          <a href="/demonstracao" data-demo-view="tasks"><b>${total}</b><span>Tarefas hoje</span></a>
          <a href="/demonstracao" data-demo-view="tasks"><b>0</b><span>Atrasadas</span></a>
          <a href="/demonstracao" data-demo-view="tasks"><b>${open.length}</b><span>Pendentes</span></a>
        </section>
        <section class="card home-quick-card" aria-labelledby="demo-quick-title">
          <div class="home-quick-copy"><span class="home-quick-mark" aria-hidden="true">${demoIcon('plus', 18)}</span><div><h2 id="demo-quick-title">Qual é o próximo passo<i>?</i></h2><p>Na sua conta, você pode registrar tarefas e organizar o dia.</p></div></div>
          <p class="demo-readonly-note">Esta prévia é somente de leitura e não salva alterações.</p>
        </section>
      </div>
    </div>`;
}
function renderTasks(state) {
  const completed = state.tasks.filter((task) => task.done).length;
  return `${renderPageHeading('Seu planejamento', 'Tarefas', 'Organize o que precisa acontecer, sem exigir que tudo seja para hoje.')}
    <section class="card demo-area-panel" aria-labelledby="demo-task-list-title">
      <div class="head"><div><p class="section-kicker">Um passo de cada vez</p><h2 id="demo-task-list-title">Tarefas de exemplo</h2></div><span class="pill" aria-live="polite">${completed} de ${state.tasks.length} feitos</span></div>
      ${renderTaskRows(state.tasks)}
      <p class="demo-note">Os exemplos são somente de leitura. Crie uma conta para registrar suas próprias tarefas.</p>
    </section>`;
}

function renderCycle(state) {
  const dates = [9, 10, 11, 12, 13, 14, 15];
  const weekdays = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
  return `${renderPageHeading('Exemplo fictício', 'Ciclo', 'Veja como um registro pode ajudar a observar padrões ao longo do tempo.')}
    <section class="card demo-area-panel" aria-labelledby="demo-cycle-title">
      <div class="head"><div><p class="section-kicker">Outubro de 2026</p><h2 id="demo-cycle-title">Escolha um dia</h2></div>${demoIcon('heart', 20)}</div>
      <div class="demo-calendar" role="group" aria-label="Dias de exemplo no calendário">${dates.map((day, index) => `<button type="button" class="${state.cycleDay === day ? 'is-selected' : ''}" data-demo-action="cycle-day" data-day="${day}" aria-pressed="${String(state.cycleDay === day)}"><span>${weekdays[index]}</span>${day}</button>`).join('')}</div>
      <div class="demo-cycle-detail" aria-live="polite"><p class="section-kicker">Dia ${state.cycleDay} · exemplo</p><h3>${state.cycleDay === 12 ? 'Um dia comum também é informação.' : 'Um registro fictício do seu ciclo.'}</h3><p>Os dados desta tela são ilustrativos; não representam previsão médica.</p></div>
      <p class="demo-note">Este exemplo não registra nem prevê dados de saúde. Informações sobre ciclo são gerais e não substituem orientação profissional.</p>
    </section>`;
}

function renderFinance(state) {
  const months = [
    { title: 'Outubro de 2026', income: 'R$ 3.200,00', expenses: 'R$ 600,00', items: [['Salário', 'Entrada', '+ R$ 3.200,00'], ['Mercado', 'Alimentação', '− R$ 420,00'], ['Transporte', 'Rotina', '− R$ 180,00']] },
    { title: 'Setembro de 2026', income: 'R$ 3.200,00', expenses: 'R$ 1.590,00', items: [['Salário', 'Entrada', '+ R$ 3.200,00'], ['Moradia', 'Casa', '− R$ 1.200,00'], ['Mercado', 'Alimentação', '− R$ 390,00']] },
  ];
  const month = months[state.financeMonth];
  return `${renderPageHeading('Exemplo fictício', 'Finanças', 'Uma visão simples para entender como organizar entradas e saídas.')}
    <section class="card demo-area-panel" aria-labelledby="demo-finance-title">
      <div class="head"><div><p class="section-kicker">Resumo do mês</p><h2 id="demo-finance-title">${month.title}</h2></div><div class="demo-month-controls" role="group" aria-label="Mês de exemplo"><button type="button" class="iconbtn" data-demo-action="finance-month" data-direction="-1" aria-label="Mês anterior" ${state.financeMonth === 1 ? 'disabled' : ''}>${demoIcon('chevLeft', 18)}</button><button type="button" class="iconbtn" data-demo-action="finance-month" data-direction="1" aria-label="Próximo mês" ${state.financeMonth === 0 ? 'disabled' : ''}>${demoIcon('chevRight', 18)}</button></div></div>
      <div class="demo-finance-summary"><article><span>Entradas</span><strong>${month.income}</strong></article><article><span>Saídas</span><strong>${month.expenses}</strong></article></div>
      <h3 class="demo-list-heading">Movimentações de exemplo</h3>
      <ul class="demo-finance-list">${month.items.map(([title, category, amount]) => `<li><span class="demo-finance-mark">${demoIcon('wallet', 17)}</span><span><b>${title}</b><small>${category} · exemplo</small></span><strong>${amount}</strong></li>`).join('')}</ul>
      <p class="demo-note">Valores fictícios. Nenhuma movimentação é salva e o Aurora não se conecta a bancos.</p>
    </section>`;
}

function renderDemoScreen(state) {
  if (state.view === 'today') return renderToday(state);
  return demoNotice() + renderDemoArea(state);
}

function renderDemoArea(state) {
  if (state.view === 'tasks') return renderTasks(state);
  if (state.view === 'habits') {
    return `${renderPageHeading('Pequenos cuidados', 'Hábitos', 'Acompanhe o que faz sentido para sua rotina, um dia de cada vez.')}
      <div class="demo-area-single">${renderHabitCard({ large: true })}
      <section class="card demo-area-panel demo-habit-note"><p class="section-kicker">Nesta semana</p><h2>Constância também pode ter pausas.</h2><p>Este exemplo é somente de leitura e não cria um registro na sua conta.</p></section>
      </div>`;
  }
  if (state.view === 'cycle') return renderCycle(state);
  return renderFinance(state);
}

function renderNavigation(state) {
  return DEMO_NAV_ITEMS.map(([id, label, iconName]) => `<a class="nav-primary demo-nav-link ${state.view === id ? 'is-current' : ''}" href="/demonstracao" title="${label}" data-demo-view="${id}" ${state.view === id ? 'aria-current="page"' : ''}><span class="ni">${demoIcon(iconName, 22)}</span><span class="tab-label-group"><span class="tab-label">${label}</span><i class="tab-period" aria-hidden="true">.</i></span></a>`).join('');
}

function updateDemoView(root, state, focusHeading = false) {
  const screen = root.querySelector('[data-demo-screen]');
  if (!(screen instanceof HTMLElement)) return;
  screen.innerHTML = renderDemoScreen(state);
  root.querySelectorAll('[data-demo-view]').forEach((item) => {
    const active = item.dataset.demoView === state.view;
    item.classList.toggle('is-current', active);
    if (active) item.setAttribute('aria-current', 'page');
    else item.removeAttribute('aria-current');
  });
  if (focusHeading) screen.querySelector('h1')?.focus({ preventScroll: true });
}

export function renderLandingDemo(root) {
  stopLandingDemo(root);
  document.title = 'Demonstração | aurora.';
  const state = {
    view: 'today',
    tasks: [
      { id: 'organize', title: 'Organizar a semana', done: true },
      { id: 'message', title: 'Responder uma mensagem', done: true },
      { id: 'read', title: 'Ler por alguns minutos', done: false },
    ],
    cycleDay: 12,
    financeMonth: 0,
  };
  root.innerHTML = `
    <div class="app demo-app">
      <a class="skip" href="#demo-main" data-public-action="skip">Pular para o conteúdo principal</a>
      ${renderPublicHeader({ demo: true }).replace('<span class="header-actions public-header-actions">', `<nav class="nav demo-nav" aria-label="Áreas de exemplo">${renderNavigation(state)}</nav><span class="header-actions public-header-actions">`)}
      <main class="main demo-main" id="demo-main" data-route="inicio" tabindex="-1">
        <div class="demo-screen" data-demo-screen></div>
        <section class="demo-cta" id="demo-help"><div><p class="section-kicker">Gostou do que viu?</p><h2>Acesse seus próprios registros</h2><p>Crie sua conta para organizar tarefas, hábitos, ciclo e finanças. A demonstração continua sem salvar seus dados.</p></div><div class="public-actions"><a class="btn primary" href="/criar-conta" data-public-action="signup">Criar conta</a><a class="btn" href="/" data-public-action="landing">Voltar à página inicial</a></div></section>
        <footer class="demo-footer"><button type="button" class="footer-link" data-demo-action="help">Ajuda e sobre</button><span aria-hidden="true">·</span><button type="button" class="footer-link" data-legal-document="terms">Termos</button><span aria-hidden="true">·</span><button type="button" class="footer-link" data-legal-document="privacy">Privacidade</button></footer>
      </main>
    </div>`;

  const onClick = (event) => {
    if (!(event.target instanceof Element)) return;
    const viewButton = event.target.closest('[data-demo-view]');
    if (viewButton instanceof HTMLElement) {
      event.preventDefault();
      state.view = viewButton.dataset.demoView;
      updateDemoView(root, state, true);
      root.querySelector('[data-demo-screen] h1')?.scrollIntoView({
        block: 'start',
        behavior: prefersReducedMotion(document.documentElement.dataset.motion === 'reduce') ? 'auto' : 'smooth',
      });
      return;
    }
    const button = event.target.closest('[data-demo-action]');
    if (!(button instanceof HTMLButtonElement) || button.disabled) return;
    const action = button.dataset.demoAction;
    if (action === 'cycle-day') {
      state.cycleDay = Number(button.dataset.day);
      updateDemoView(root, state);
    } else if (action === 'finance-month') {
      state.financeMonth = Math.min(1, Math.max(0, state.financeMonth - Number(button.dataset.direction)));
      updateDemoView(root, state);
    } else if (action === 'help') {
      root.querySelector('#demo-help')?.scrollIntoView({
        behavior: prefersReducedMotion(document.documentElement.dataset.motion === 'reduce') ? 'auto' : 'smooth',
        block: 'start',
      });
    }
  };
  state.onClick = onClick;
  demoControllers.set(root, state);
  root.addEventListener('click', onClick);
  updateDemoView(root, state);
}
