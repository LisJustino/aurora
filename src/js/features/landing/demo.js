import { iconSvg as demoIcon } from '../../utils/icons.js';
import { prefersReducedMotion } from '../../utils/motion.js';
import { renderPublicHeader } from '../appearance/public-controls.js';
import { timeBasedGreeting } from '../profile/model.js';

const DEMO_NAV_ITEMS = [
  ['today', 'Hoje', 'home'],
  ['tasks', 'Tarefas', 'calendarCheck'],
  ['focus', 'Foco', 'clock'],
  ['habits', 'Hábitos', 'leaf'],
  ['cycle', 'Ciclo', 'heart'],
  ['finance', 'Finanças', 'wallet'],
];

const demoControllers = new WeakMap();

export function stopLandingDemo(root) {
  const controller = demoControllers.get(root);
  if (!controller) return;
  clearInterval(controller.interval);
  root.removeEventListener('click', controller.onClick);
  root.removeEventListener('submit', controller.onSubmit);
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
      <button type="button" class="chk" role="checkbox" aria-checked="${String(task.done)}" aria-label="${task.done ? 'Reabrir' : 'Concluir'}: ${escapeDemoText(task.title)}" data-demo-action="task-toggle" data-task-id="${escapeDemoText(task.id)}"><span>${demoIcon('check', 15)}</span></button>
      <div class="tt"><span class="ttl">${escapeDemoText(task.title)}</span><span class="meta">${task.done ? '<span>Concluída</span>' : task.id === nextTaskId ? '<span class="m-warn">Próximo passo</span>' : '<span class="m-warn">Hoje</span>'}<span>Exemplo</span></span></div>
    </li>`).join('')}</ul>`;
}

function renderFocusCard(state, { large = false } = {}) {
  return `
    <section class="card demo-focus-card ${large ? 'demo-focus-card--large' : ''}" aria-labelledby="demo-focus-title">
      <div class="head"><div><p class="section-kicker">Um tempo para você</p><h2 id="demo-focus-title">${large ? 'Foco no seu ritmo' : 'Foco, depois uma pausa'}</h2></div>${demoIcon('clock', 20)}</div>
      <div class="timer" aria-label="Cronômetro de exemplo: 25:00" data-demo-timer aria-live="off">25:00</div>
      <p class="demo-muted">Uma sessão curta também conta.</p>
      <div class="demo-focus-presets" role="group" aria-label="Duração do foco">
        ${[15, 25, 45].map((minutes) => `<button type="button" class="btn sm" data-demo-action="timer-duration" data-minutes="${minutes}" aria-pressed="${String(minutes === state.focusMinutes)}">${minutes} min</button>`).join('')}
      </div>
      <button class="btn primary" type="button" data-demo-action="timer-toggle" aria-pressed="${String(Boolean(state.startedAt))}">${state.startedAt ? 'Pausar foco' : 'Iniciar foco'}</button>
      <button class="btn" type="button" data-demo-action="timer-reset">Reiniciar cronômetro</button>
    </section>`;
}

function renderHabitCard(state, { large = false } = {}) {
  const days = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
  return `
    <section class="card demo-habit-card ${large ? 'demo-habit-card--large' : ''}" aria-labelledby="demo-habit-title">
      <div class="head"><div><p class="section-kicker">Um cuidado seu</p><h2 id="demo-habit-title">Alongar um pouquinho</h2></div>${demoIcon('leaf', 20)}</div>
      <p class="demo-muted"><span data-demo-habit-count>${state.habitDone ? 3 : 2}</span> dias nesta semana</p>
      <div class="demo-habit-week" aria-label="Check-ins de exemplo nesta semana">${days.map((day, index) => `<span class="${index < 2 || (index === 2 && state.habitDone) ? 'is-complete' : ''}" aria-hidden="true">${day}</span>`).join('')}</div>
      <button class="btn" type="button" data-demo-action="habit-toggle" aria-pressed="${String(state.habitDone)}">${state.habitDone ? 'Desmarcar hoje' : 'Marcar hoje'}</button>
    </section>`;
}

function renderPageHeading(eyebrow, title, description = '') {
  return `<header class="demo-page-heading"><div><p class="section-kicker">${eyebrow}</p><h1 tabindex="-1">${title}</h1>${description ? `<p>${description}</p>` : ''}</div></header>`;
}

function demoNotice() {
  return `<div class="notice warn sample-banner" role="note">${demoIcon('info', 18)}<div class="grow">Você está vendo dados de exemplo. Eles ajudam a conhecer o app, mas não são seus; nada é salvo.</div><button type="button" class="btn sm" data-public-action="signup">Criar conta</button></div>`;
}

function renderHomeTask(task) {
  return `<li class="task ${task.done ? 'done' : ''}">
      <button type="button" class="chk" role="checkbox" aria-checked="${String(task.done)}" aria-label="${task.done ? 'Reabrir' : 'Concluir'}: ${escapeDemoText(task.title)}" data-demo-action="task-toggle" data-task-id="${escapeDemoText(task.id)}"><span>${demoIcon('check', 15)}</span></button>
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
          <div class="home-quick-copy"><span class="home-quick-mark" aria-hidden="true">${demoIcon('plus', 18)}</span><div><h2 id="demo-quick-title">Qual é o próximo passo<i>?</i></h2><p>Registre uma tarefa para hoje sem sair da sua rotina.</p></div></div>
          <form class="home-quick-form" data-demo-form="task"><label class="sr" for="demo-home-task">Nova tarefa para hoje</label><input id="demo-home-task" name="title" type="text" maxlength="80" autocomplete="off" placeholder="Ex.: revisar a apresentação" required><button class="btn primary" type="submit">${demoIcon('plus', 16)}Adicionar</button></form>
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
      <form class="demo-add-form" data-demo-form="task">
        <label for="demo-new-task">Adicionar uma tarefa de exemplo</label>
        <div><input id="demo-new-task" name="title" type="text" maxlength="80" placeholder="O que você quer lembrar?" required><button class="btn primary" type="submit">Adicionar</button></div>
      </form>
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
  if (state.view === 'focus') {
    return `${renderPageHeading('Seu tempo', 'Foco', 'Escolha uma duração e experimente um período para você.')}
      <div class="demo-area-single">${renderFocusCard(state, { large: true })}</div>`;
  }
  if (state.view === 'habits') {
    return `${renderPageHeading('Pequenos cuidados', 'Hábitos', 'Acompanhe o que faz sentido para sua rotina, um dia de cada vez.')}
      <div class="demo-area-single">${renderHabitCard(state, { large: true })}
        <section class="card demo-area-panel demo-habit-note"><p class="section-kicker">Nesta semana</p><h2>Constância também pode ter pausas.</h2><p>Este exemplo muda só durante esta visita e não cria um registro na sua conta.</p></section>
      </div>`;
  }
  if (state.view === 'cycle') return renderCycle(state);
  return renderFinance(state);
}

function renderNavigation(state) {
  return DEMO_NAV_ITEMS.map(([id, label, iconName]) => `<a class="nav-primary demo-nav-link ${state.view === id ? 'is-current' : ''}" href="/demonstracao" title="${label}" data-demo-view="${id}" ${state.view === id ? 'aria-current="page"' : ''}><span class="ni">${demoIcon(iconName, 22)}</span><span class="tab-label-group"><span class="tab-label">${label}</span><i class="tab-period" aria-hidden="true">.</i></span></a>`).join('');
}

function updateTimer(root, state) {
  const remaining = state.startedAt
    ? Math.max(0, state.remainingMs - (Date.now() - state.startedAt))
    : state.remainingMs;
  const totalSeconds = Math.ceil(remaining / 1000);
  const label = `${String(Math.floor(totalSeconds / 60)).padStart(2, '0')}:${String(totalSeconds % 60).padStart(2, '0')}`;
  root.querySelectorAll('[data-demo-timer]').forEach((timer) => {
    timer.textContent = label;
    timer.setAttribute('aria-label', `Cronômetro de exemplo: ${label}`);
  });
  root.querySelectorAll('[data-demo-action="timer-toggle"]').forEach((button) => {
    button.textContent = state.startedAt ? 'Pausar foco' : state.remainingMs === 0 ? 'Iniciar novamente' : 'Iniciar foco';
    button.setAttribute('aria-pressed', String(Boolean(state.startedAt)));
  });
  root.querySelectorAll('[data-demo-action="timer-duration"]').forEach((button) => {
    button.disabled = Boolean(state.startedAt);
    button.setAttribute('aria-pressed', String(Number(button.dataset.minutes) === state.focusMinutes));
  });
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
  updateTimer(root, state);
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
    habitDone: false,
    cycleDay: 12,
    financeMonth: 0,
    focusMinutes: 25,
    remainingMs: 25 * 60 * 1000,
    startedAt: 0,
    interval: null,
  };
  root.innerHTML = `
    <div class="app demo-app">
      <a class="skip" href="#demo-main" data-public-action="skip">Pular para o conteúdo principal</a>
      ${renderPublicHeader({ demo: true }).replace('<span class="header-actions public-header-actions">', `<nav class="nav demo-nav" aria-label="Áreas de exemplo">${renderNavigation(state)}</nav><span class="header-actions public-header-actions">`)}
      <main class="main demo-main" id="demo-main" data-route="inicio" tabindex="-1">
        <div class="demo-screen" data-demo-screen></div>
        <section class="demo-cta" id="demo-help"><div><p class="section-kicker">Gostou do que viu?</p><h2>Acesse seus próprios registros</h2><p>Crie sua conta para organizar tarefas, foco, hábitos, ciclo e finanças. A demonstração continua sem salvar seus dados.</p></div><div class="public-actions"><button class="btn primary" type="button" data-public-action="signup">Criar conta</button><button class="btn" type="button" data-public-action="landing">Voltar à página inicial</button></div></section>
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
    if (action === 'task-toggle') {
      const task = state.tasks.find((item) => item.id === button.dataset.taskId);
      if (!task) return;
      task.done = !task.done;
      updateDemoView(root, state);
    } else if (action === 'habit-toggle') {
      state.habitDone = !state.habitDone;
      updateDemoView(root, state);
    } else if (action === 'timer-toggle') {
      if (state.startedAt) {
        state.remainingMs = Math.max(0, state.remainingMs - (Date.now() - state.startedAt));
        state.startedAt = 0;
        clearInterval(state.interval);
        state.interval = null;
      } else {
        if (state.remainingMs === 0) state.remainingMs = state.focusMinutes * 60 * 1000;
        state.startedAt = Date.now();
        state.interval = setInterval(() => {
          if (Date.now() - state.startedAt >= state.remainingMs) {
            state.remainingMs = 0;
            state.startedAt = 0;
            clearInterval(state.interval);
            state.interval = null;
          }
          updateTimer(root, state);
        }, 250);
      }
      updateTimer(root, state);
    } else if (action === 'timer-reset') {
      clearInterval(state.interval);
      state.interval = null;
      state.startedAt = 0;
      state.remainingMs = state.focusMinutes * 60 * 1000;
      updateTimer(root, state);
    } else if (action === 'timer-duration') {
      state.focusMinutes = Number(button.dataset.minutes);
      state.remainingMs = state.focusMinutes * 60 * 1000;
      updateTimer(root, state);
    } else if (action === 'cycle-day') {
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
  const onSubmit = (event) => {
    if (!(event.target instanceof HTMLFormElement) || event.target.dataset.demoForm !== 'task') return;
    event.preventDefault();
    const input = event.target.elements.namedItem('title');
    if (!(input instanceof HTMLInputElement)) return;
    const title = input.value.trim();
    if (!title) return;
    state.tasks.push({ id: `task-${Date.now()}-${state.tasks.length}`, title, done: false });
    state.view = 'tasks';
    updateDemoView(root, state);
    root.querySelector('#demo-new-task')?.focus({ preventScroll: true });
  };
  state.onClick = onClick;
  state.onSubmit = onSubmit;
  demoControllers.set(root, state);
  root.addEventListener('click', onClick);
  root.addEventListener('submit', onSubmit);
  updateDemoView(root, state);
}
