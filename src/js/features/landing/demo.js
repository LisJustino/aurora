import { iconSvg as demoIcon } from '../../utils/icons.js';
import { animateProgressRing, playMotion, prefersReducedMotion } from '../../utils/motion.js';
import { renderPublicHeader } from '../appearance/public-controls.js';
import { timeBasedGreeting } from '../profile/model.js';
import { brl, parseMoney } from '../../utils/currency.js';

const DEMO_NAV_ITEMS = [
  ['today', 'Hoje', 'home'],
  ['tasks', 'Tarefas', 'calendarCheck'],
  ['habits', 'Hábitos', 'leaf'],
  ['cycle', 'Ciclo', 'heart'],
  ['finance', 'Finanças', 'wallet'],
  ['water', 'Água', 'water'],
  ['annual', 'Plano anual', 'target'],
  ['calendar', 'Google Agenda', 'calendar'],
];

const demoControllers = new WeakMap();

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function stopLandingDemo(root) {
  const controller = demoControllers.get(root);
  if (!controller) return;
  root.removeEventListener('click', controller.onClick);
  root.removeEventListener('submit', controller.onSubmit);
  root.removeEventListener('input', controller.onInput);
  demoControllers.delete(root);
}

function escapeDemoText(value) {
  return String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character],
  );
}

function renderTaskRows(tasks) {
  const nextTaskId = tasks.find((task) => !task.done)?.id;
  return `<ul class="list demo-task-list">${tasks
    .map(
      (task) => `
    <li class="task ${task.done ? 'done' : task.id === nextTaskId ? 'is-next' : ''}">
      <button type="button" class="chk" role="checkbox" aria-checked="${String(task.done)}"
        aria-label="${task.done ? 'Marcar como pendente' : 'Marcar como concluída'}: ${escapeDemoText(task.title)}"
        data-demo-action="task-toggle"
        data-task-id="${escapeDemoText(task.id)}"><span>${demoIcon('check', 15)}</span></button>
      <div class="tt"><span class="ttl">${escapeDemoText(task.title)}</span><span
        class="meta">${task.done ? '<span>Concluída</span>' : task.id === nextTaskId ? '<span class="m-warn">Próximo passo</span>' : '<span class="m-warn">Hoje</span>'}<span>Exemplo</span></span></div>
    </li>`,
    )
    .join('')}</ul>`;
}

function renderHabitCard(state, { large = false } = {}) {
  const days = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
  const dayNames = ['segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado', 'domingo'];
  const completed = state.habitDays.filter(Boolean).length;
  return `
    <section class="card demo-habit-card ${large ? 'demo-habit-card--large' : ''}" aria-labelledby="demo-habit-title">
      <div class="head"><div><p class="section-kicker">Um cuidado seu</p><h2
        id="demo-habit-title">Alongar um pouquinho</h2></div>${demoIcon('leaf', 20)}</div>
      <p class="demo-muted" aria-live="polite">${completed} ${completed === 1 ? 'dia' : 'dias'} nesta semana</p>
      <div class="demo-habit-week" role="group"
        aria-label="Marque os dias em que fez este hábito">${days
          .map(
            (day, index) => `<button type="button"
        class="${state.habitDays[index] ? 'is-complete' : ''}" aria-pressed="${String(state.habitDays[index])}"
        aria-label="${dayNames[index]}: ${state.habitDays[index] ? 'marcado' : 'não marcado'}"
        data-demo-action="habit-toggle" data-day-index="${index}">${day}</button>`,
          )
          .join('')}</div>
      <p class="demo-session-note">Check-ins de exemplo. Nada fica salvo ao sair.</p>
    </section>`;
}

function renderPageHeading(eyebrow, title, description = '') {
  return `<header class="demo-page-heading"><div><p class="section-kicker">${eyebrow}</p><h1
    tabindex="-1">${title}<i>.</i></h1>${description ? `<p>${description}</p>` : ''}</div></header>`;
}

function demoNotice() {
  return `<div class="notice sample-banner" role="note"><span
    class="sample-banner-copy">Demonstração com dados fictícios.</span><a class="btn sm" href="/criar-conta"
    data-public-action="signup">Criar conta</a></div>`;
}

function renderHomeTask(task) {
  return `<li class="task ${task.done ? 'done' : ''}">
      <span class="chk" aria-hidden="true"><span>${demoIcon('check', 15)}</span></span>
      <div class="tt"><span class="ttl">${escapeDemoText(task.title)}</span><span
        class="meta"><span>Exemplo</span></span></div>
    </li>`;
}

function renderToday(state) {
  const done = state.tasks.filter((task) => task.done);
  const open = state.tasks.filter((task) => !task.done);
  const todayIndex = (new Date().getDay() + 6) % 7;
  const habitDone = state.habitDays[todayIndex];
  const completed = done.length;
  const total = state.tasks.length;
  const circumference = 2 * Math.PI * 32;
  const offset = circumference * (1 - completed / total);
  const lead = open.length
    ? `Você tem ${open.length} ${open.length === 1 ? 'tarefa pendente' : 'tarefas pendentes'}.`
    : 'Tudo concluído. Aproveite o resto do dia.';
  const shortDate = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: 'numeric', month: 'long' })
    .format(new Date())
    .replace(/[.,]/g, '')
    .replace(/^(\S+) /, '$1, ');
  return `
    ${demoNotice()}
    <header class="home-head" aria-labelledby="demo-greeting">
      <div>
        <p class="date">${escapeDemoText(shortDate.charAt(0).toUpperCase() + shortDate.slice(1))}</p>
        <h1 id="demo-greeting" class="type-editorial-display" tabindex="-1">${timeBasedGreeting()}, <span
          class="proper-name">Pessoa</span><i>.</i></h1>
        <p class="lead" aria-live="polite">${lead}</p>
      </div>
      <div class="demo-home-progress">
        <div class="ringw" role="img" aria-label="${completed} de ${total} tarefas de hoje concluídas"><svg width="76"
          height="76" viewBox="0 0 76 76" aria-hidden="true"><circle class="ring-bg" cx="38" cy="38" r="32" fill="none"
          stroke-width="7"/><circle class="ring-fg" cx="38" cy="38" r="32" fill="none" stroke-width="7"
          stroke-linecap="round" stroke-dasharray="${circumference.toFixed(1)}" stroke-dashoffset="${offset.toFixed(1)}"
          transform="rotate(-90 38 38)"/></svg><div class="rt">${completed}/${total}</div></div>
        <span class="demo-home-progress-label" aria-hidden="true">Tarefas</span>
      </div>
    </header>
    <div class="home-dashboard no-optional-areas">
      <div class="home-primary">
        <section class="card home-today-card" aria-labelledby="demo-today-tasks-title">
          <div class="head"><div><p class="section-kicker">Seu plano</p><h2 id="demo-today-tasks-title"
            class="type-editorial-title">Hoje</h2></div><div class="row"><button type="button" class="btn ghost sm"
            data-demo-view="tasks">Ver planejamento</button></div></div>
          <div class="home-task-groups">
            ${
              open.length
                ? `<section class="home-task-group"
              aria-label="Tarefas para hoje"><h3>${demoIcon('calendarCheck', 15)}Para hoje <span>${open.length}</span></h3><ul
              class="list">${open.map(renderHomeTask).join('')}</ul></section>`
                : ''
            }
            ${
              done.length
                ? `<details class="home-completed"><summary>${demoIcon('check', 15)}Concluídas hoje <span
              class="home-completed-count">${done.length}</span></summary><ul
              class="list">${done.map(renderHomeTask).join('')}</ul></details>`
                : ''
            }
          </div>
        </section>
        <section class="card home-habit-checkins" aria-labelledby="demo-habits-title">
          <div class="head"><h2 id="demo-habits-title">Hábitos de hoje</h2><button type="button" class="btn ghost sm"
            data-demo-view="habits">Ver hábitos</button></div>
          <ul class="list"><li class="home-habit-row">
            <span class="home-habit-icon" aria-hidden="true">${demoIcon('leaf', 18)}</span>
            <span class="grow"><b>Alongar um pouquinho</b><span
              class="small muted">${habitDone ? 'Concluído hoje' : 'Ainda não marcado'}</span></span>
            <button type="button" class="btn sm ${habitDone ? 'back' : 'primary'}" data-demo-action="habit-toggle"
              data-day-index="${todayIndex}" aria-pressed="${String(habitDone)}">${demoIcon(habitDone ? 'check' : 'plus', 16)}${habitDone ? 'Concluído' : 'Marcar'}</button>
          </li></ul>
        </section>
        <section class="strip" aria-label="Resumo do dia">
          <a href="/demonstracao" data-demo-view="tasks"><b>${total}</b><span>Tarefas hoje</span></a>
          <a href="/demonstracao" data-demo-view="tasks"><b>0</b><span>Atrasadas</span></a>
          <a href="/demonstracao" data-demo-view="tasks"><b>${open.length}</b><span>Pendentes</span></a>
        </section>
        <section class="card home-quick-card" aria-labelledby="demo-quick-title">
          <div class="home-quick-copy"><span class="home-quick-mark"
            aria-hidden="true">${demoIcon('plus', 18)}</span><div><h2 id="demo-quick-title"
            class="type-editorial-title">Qual é o próximo passo<i>?</i></h2><p>Experimente adicionar uma tarefa.</p></div></div>
          <form class="home-quick-form demo-quick-form" data-demo-task-form>
            <label class="sr" for="demo-home-task">Nova tarefa</label>
            <input id="demo-home-task" name="title" type="text" maxlength="80" autocomplete="off"
              placeholder="Ex.: caminhar por 10 minutos" required data-demo-task-input>
            <button type="submit" class="btn primary">Adicionar</button>
          </form>
          <p class="demo-session-note">As mudanças são descartadas ao sair.</p>
        </section>
      </div>
    </div>`;
}
function renderTasks(state) {
  const completed = state.tasks.filter((task) => task.done).length;
  return `${renderPageHeading('Seu planejamento', 'Tarefas', 'Organize o que precisa acontecer, sem exigir que tudo seja para hoje.')}
    <section class="card demo-area-panel" aria-labelledby="demo-task-list-title">
      <div class="head"><div><p class="section-kicker">Um passo de cada vez</p><h2
        id="demo-task-list-title">Tarefas de exemplo</h2></div><span class="pill"
        aria-live="polite">${completed} de ${state.tasks.length} feitos</span></div>
      ${renderTaskRows(state.tasks)}
      <form class="demo-add-form" data-demo-task-form>
        <label for="demo-new-task">Adicione uma tarefa de exemplo</label>
        <div><input id="demo-new-task" name="title" type="text" maxlength="80" autocomplete="off"
          placeholder="Ex.: caminhar por 10 minutos" required data-demo-task-input><button class="btn primary"
          type="submit">Adicionar</button></div>
        <p class="demo-note" id="demo-task-help">A tarefa fica só nesta demonstração e não é salva.</p>
      </form>
    </section>`;
}

function renderCycle(state) {
  const firstDay = new Date();
  firstDay.setHours(0, 0, 0, 0);
  firstDay.setDate(firstDay.getDate() - ((firstDay.getDay() + 6) % 7));
  const dates = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(firstDay);
    date.setDate(firstDay.getDate() + index);
    return date;
  });
  const weekdays = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
  const dateLabel = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(firstDay);
  return `${renderPageHeading('Exemplo fictício', 'Ciclo', 'Veja como um registro pode ajudar a observar padrões ao longo do tempo.')}
    <section class="card demo-area-panel" aria-labelledby="demo-cycle-title">
      <div class="head"><div><p class="section-kicker">${escapeDemoText(dateLabel)}</p><h2
        id="demo-cycle-title">Escolha um dia</h2></div>${demoIcon('heart', 20)}</div>
      <div class="demo-calendar" role="group" aria-label="Dias de exemplo no calendário">${dates
        .map((date, index) => {
          const day = localDateKey(date);
          return `<button type="button" class="${state.cycleDay === day ? 'is-selected' : ''}"
            data-demo-action="cycle-day" data-day="${day}"
            aria-pressed="${String(state.cycleDay === day)}"><span>${weekdays[index]}</span>${date.getDate()}</button>`;
        })
        .join('')}</div>
      <div class="demo-cycle-detail" aria-live="polite"><p
        class="section-kicker">${escapeDemoText(new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(new Date(`${state.cycleDay}T12:00:00`)))} · exemplo</p><h3>${state.cycleSymptom ? 'Sintoma registrado: cólicas leves.' : 'Um registro fictício do seu ciclo.'}</h3><p>Os dados desta tela são ilustrativos; não representam previsão médica.</p><button
        class="btn sm" type="button"
        data-demo-action="cycle-symptom">${state.cycleSymptom ? 'Remover sintoma de exemplo' : 'Registrar cólica leve'}</button></div>
      <p class="demo-note">Este exemplo não registra nem prevê dados de saúde. Informações sobre ciclo são gerais e não substituem orientação profissional.</p>
    </section>`;
}

function dateForFinanceOffset(offset) {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() - offset);
  return date;
}

function renderFinance(state) {
  const date = dateForFinanceOffset(state.financeMonth);
  const title = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(date);
  const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  const extraExpenses = state.demoExpenses.filter((item) => item.month === monthKey);
  const items =
    state.financeMonth === 0
      ? [
          ['Moradia', 'Casa', 145000, 'home'],
          ['Mercado', 'Alimentação', 42000, 'utensils'],
          ['Transporte', 'Rotina', 9000, 'bike'],
        ]
      : [
          ['Moradia', 'Casa', 120000, 'home'],
          ['Mercado', 'Alimentação', 39000, 'utensils'],
        ];
  const expenses =
    items.reduce((total, [, , cents]) => total + cents, 0) +
    extraExpenses.reduce((total, item) => total + item.cents, 0);
  const result = 320000 - expenses;
  return `${renderPageHeading('Exemplo fictício', 'Finanças', 'Uma visão simples para entender como organizar entradas e saídas.')}
    <section class="card demo-area-panel" aria-labelledby="demo-finance-title">
      <div class="head"><div><p class="section-kicker">Resumo do mês</p><h2
        id="demo-finance-title">${escapeDemoText(title)}</h2></div><div class="demo-month-controls" role="group"
        aria-label="Mês de exemplo"><button type="button" class="iconbtn" data-demo-action="finance-month"
        data-direction="-1"
        aria-label="Mês anterior" ${state.financeMonth === 1 ? 'disabled' : ''}>${demoIcon('chevLeft', 18)}</button><button
        type="button" class="iconbtn" data-demo-action="finance-month" data-direction="1"
        aria-label="Próximo mês" ${state.financeMonth === 0 ? 'disabled' : ''}>${demoIcon('chevRight', 18)}</button></div></div>
      <div class="demo-finance-summary" role="group" aria-label="Resumo financeiro"><article class="is-income"><span><i
        aria-hidden="true">${demoIcon('arrowDown', 15)}</i>Entradas</span><strong>${brl(320000)}</strong></article><article
        class="is-expense"><span><i
        aria-hidden="true">${demoIcon('arrowUp', 15)}</i>Saídas</span><strong>${brl(expenses)}</strong></article><article
        class="is-result${result < 0 ? ' is-negative' : ''}"><span><i
        aria-hidden="true">${demoIcon('pie', 15)}</i>Resultado</span><strong>${brl(result)}</strong></article></div>
      <h3 class="demo-list-heading">Movimentações de exemplo</h3>
      <ul class="demo-finance-list">${items
        .map(
          ([name, category, cents, icon]) => `<li><span
        class="demo-finance-mark">${demoIcon(icon, 17)}</span><span><b>${name}</b><small>${category} · exemplo</small></span><strong>− ${brl(cents)}</strong></li>`,
        )
        .join('')}${extraExpenses
        .map(
          (item) => `<li><span
        class="demo-finance-mark">${demoIcon('tag', 17)}</span><span><b>${escapeDemoText(item.title)}</b><small>Outra despesa · exemplo</small></span><strong>− ${brl(item.cents)}</strong></li>`,
        )
        .join('')}</ul>
      <form class="demo-add-form" data-demo-expense-form>
        <label for="demo-expense-title">Lançar uma despesa fictícia</label>
        <div><input id="demo-expense-title" name="title" type="text" maxlength="60" placeholder="Ex.: café"
          required><input name="amount" type="text" inputmode="decimal" maxlength="16" placeholder="R$ 12,50"
          aria-label="Valor da despesa" required><button class="btn primary" type="submit">Adicionar</button></div>
        <p class="demo-note" data-demo-finance-error role="status"
          aria-live="polite">Valores fictícios. Nada é salvo e não há conexão com bancos.</p>
      </form>
    </section>`;
}

function renderWater(state) {
  const percent = Math.min(100, Math.round((state.waterMl / 2000) * 100));
  return `${renderPageHeading('Um cuidado por vez', 'Água', 'Acompanhe uma meta diária e registre cada copo.')}
    <section class="card demo-area-panel" aria-labelledby="demo-water-title">
      <div class="head"><div><p class="section-kicker">Meta diária de exemplo</p><h2
        id="demo-water-title">${state.waterMl.toLocaleString('pt-BR')} / 2.000 mL</h2></div>${demoIcon('water', 20)}</div>
      <progress class="demo-water-progress" max="2000" value="${state.waterMl}"
        aria-label="${state.waterMl} de 2000 mililitros"></progress>
      <p class="demo-muted" aria-live="polite">${percent}% da meta diária</p>
      <button class="btn primary" type="button" data-demo-action="water-add">Registrar 250 mL</button>
      <p class="demo-note">Este registro é temporário e será descartado ao sair.</p>
    </section>`;
}

function renderAnnual(state) {
  const year = new Date().getFullYear();
  return `${renderPageHeading('Um passo de cada vez', 'Plano anual', 'Escolha uma intenção e experimente registrar uma conquista para o ano.')}
    <section class="card demo-area-panel" aria-labelledby="demo-annual-title">
      <div class="head"><div><p class="section-kicker">Seu próximo capítulo</p><h2
        id="demo-annual-title">Um ano com intenção · ${year}</h2></div>${demoIcon('target', 20)}</div>
      <p>${escapeDemoText(state.annualGoal || 'Que conquista gostaria de celebrar neste ano?')}</p>
      <form class="demo-add-form" data-demo-annual-form>
        <label for="demo-annual-goal">Adicionar uma conquista de exemplo</label>
        <div><input id="demo-annual-goal" name="goal" type="text" maxlength="120"
          placeholder="Ex.: fazer uma viagem especial" required><button class="btn primary"
          type="submit">Adicionar</button></div>
      </form>
      <p class="demo-note">Seu plano de exemplo existe só nesta demonstração.</p>
    </section>`;
}

function renderCalendar(state) {
  return `${renderPageHeading('Um olhar sobre a semana', 'Google Agenda', 'No app, você pode consultar seus calendários do Google após autorizar o acesso.')}
    <section class="card demo-area-panel" aria-labelledby="demo-calendar-title">
      <div class="head"><div><p class="section-kicker">Prévia fictícia · somente leitura</p><h2
        id="demo-calendar-title">${state.calendarConnected ? 'Agenda conectada (exemplo)' : 'Veja como a integração funciona'}</h2></div>${demoIcon('calendar', 20)}</div>
      <ul class="demo-finance-list"><li><span
        class="demo-finance-mark">${demoIcon('calendarCheck', 17)}</span><span><b>Reunião de exemplo</b><small>Hoje · 10:00</small></span></li><li><span
        class="demo-finance-mark">${demoIcon('calendarCheck', 17)}</span><span><b>Tempo para você</b><small>Amanhã · 15:30</small></span></li></ul>
      <button class="btn" type="button"
        data-demo-action="calendar-toggle">${state.calendarConnected ? 'Desconectar exemplo' : 'Simular conexão'}</button>
      <p class="demo-note" role="status">A demonstração não acessa uma conta Google nem conecta nenhum calendário.</p>
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
      <div class="demo-area-single">${renderHabitCard(state, { large: true })}
      <section class="card demo-area-panel demo-habit-note"><p
        class="section-kicker">Nesta semana</p><h2>Constância também pode ter pausas.</h2><p>Marque os dias de exemplo. Nada será salvo na sua conta.</p></section>
      </div>`;
  }
  if (state.view === 'cycle') return renderCycle(state);
  if (state.view === 'finance') return renderFinance(state);
  if (state.view === 'water') return renderWater(state);
  if (state.view === 'annual') return renderAnnual(state);
  return renderCalendar(state);
}

function renderNavigation(state) {
  return DEMO_NAV_ITEMS.map(
    ([id, label, iconName]) =>
      `<a class="nav-item demo-nav-link ${state.view === id ? 'is-current' : ''}" href="/demonstracao" title="${label}"
        data-demo-view="${id}" ${state.view === id ? 'aria-current="page"' : ''}><span
        class="ni">${demoIcon(iconName, 22)}</span><span class="tab-label-group"><span
        class="tab-label">${label}</span></span></a>`,
  ).join('');
}

function updateDemoView(root, state, focusHeading = false) {
  const screen = root.querySelector('[data-demo-screen]');
  if (!(screen instanceof HTMLElement)) return;
  screen.innerHTML = renderDemoScreen(state);
  const ring = screen.querySelector('.home-head .ring-fg');
  if (ring) {
    const progress = state.tasks.length ? state.tasks.filter((task) => task.done).length / state.tasks.length : 0;
    const circumference = Number(ring.getAttribute('stroke-dasharray'));
    if (Number.isFinite(state.displayedHomeProgress)) {
      animateProgressRing(ring, circumference * (1 - state.displayedHomeProgress));
    }
    state.displayedHomeProgress = progress;
  }
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
    nextTaskId: 0,
    displayedHomeProgress: null,
    habitDays: [true, true, false, false, false, false, false],
    cycleDay: localDateKey(new Date()),
    cycleSymptom: false,
    financeMonth: 0,
    demoExpenses: [],
    waterMl: 1250,
    annualGoal: '',
    calendarConnected: false,
  };
  root.innerHTML = `
    <div class="app demo-app">
      <a class="skip" href="#demo-main" data-public-action="skip">Pular para o conteúdo principal</a>
      ${renderPublicHeader({ demo: true }).replace(
        '<span class="header-actions public-header-actions">',
        `<nav
        class="nav demo-nav" aria-label="Áreas de exemplo">${renderNavigation(state)}</nav><span
        class="header-actions public-header-actions">`,
      )}
      <main class="main demo-main" id="demo-main" data-route="inicio" tabindex="-1">
        <div class="demo-screen" data-demo-screen></div>
        <section class="demo-cta" id="demo-help"><div><p
          class="section-kicker">Gostou do que viu?</p><h2>Acesse seus próprios registros</h2><p>Crie sua conta para organizar tarefas, hábitos, ciclo e finanças. A demonstração continua sem salvar seus dados.</p></div><div
          class="public-actions"><a class="btn primary" href="/criar-conta"
          data-public-action="signup">Criar conta</a><a class="btn" href="/"
          data-public-action="landing">Voltar à página inicial</a></div></section>
        <footer class="demo-footer"><button type="button" class="footer-link"
          data-demo-action="help">Ajuda e sobre</button><span aria-hidden="true">·</span><button type="button"
          class="footer-link" data-legal-document="terms">Termos</button><span aria-hidden="true">·</span><button
          type="button" class="footer-link" data-legal-document="privacy">Privacidade</button></footer>
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
      state.cycleDay = button.dataset.day;
      state.cycleSymptom = false;
      updateDemoView(root, state);
    } else if (action === 'cycle-symptom') {
      state.cycleSymptom = !state.cycleSymptom;
      updateDemoView(root, state);
    } else if (action === 'water-add') {
      state.waterMl += 250;
      updateDemoView(root, state);
    } else if (action === 'calendar-toggle') {
      state.calendarConnected = !state.calendarConnected;
      updateDemoView(root, state);
    } else if (action === 'finance-month') {
      state.financeMonth = Math.min(1, Math.max(0, state.financeMonth - Number(button.dataset.direction)));
      updateDemoView(root, state);
    } else if (action === 'task-toggle') {
      const task = state.tasks.find((item) => item.id === button.dataset.taskId);
      if (!task) return;
      task.done = !task.done;
      updateDemoView(root, state);
      const updatedButton = [...root.querySelectorAll('[data-demo-action="task-toggle"]')].find(
        (item) => item.dataset.taskId === task.id,
      );
      if (task.done) {
        playMotion(updatedButton?.querySelector('span'), 'is-task-check-popping');
        playMotion(updatedButton?.closest('.task')?.querySelector('.ttl'), 'is-task-completing');
      }
      updatedButton?.focus({ preventScroll: true });
    } else if (action === 'habit-toggle') {
      const index = Number(button.dataset.dayIndex);
      if (!Number.isInteger(index) || index < 0 || index >= state.habitDays.length) return;
      state.habitDays[index] = !state.habitDays[index];
      updateDemoView(root, state);
      root
        .querySelector(`[data-demo-action="habit-toggle"][data-day-index="${index}"]`)
        ?.focus({ preventScroll: true });
    } else if (action === 'help') {
      root.querySelector('#demo-help')?.scrollIntoView({
        behavior: prefersReducedMotion(document.documentElement.dataset.motion === 'reduce') ? 'auto' : 'smooth',
        block: 'start',
      });
    }
  };
  const onSubmit = (event) => {
    if (!(event.target instanceof HTMLFormElement)) return;
    if (event.target.matches('[data-demo-expense-form]')) {
      event.preventDefault();
      const form = event.target;
      const title = form.elements.title.value.trim();
      const cents = parseMoney(form.elements.amount.value);
      const error = form.querySelector('[data-demo-finance-error]');
      if (!title || !Number.isSafeInteger(cents) || cents <= 0) {
        error.textContent = 'Informe uma descrição e um valor válido, maior que zero.';
        error.dataset.state = 'error';
        return;
      }
      const date = dateForFinanceOffset(state.financeMonth);
      state.demoExpenses.push({
        title: title.slice(0, 60),
        cents,
        month: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      });
      updateDemoView(root, state);
      return;
    }
    if (event.target.matches('[data-demo-annual-form]')) {
      event.preventDefault();
      state.annualGoal = event.target.elements.goal.value.trim();
      updateDemoView(root, state);
      return;
    }
    if (!event.target.matches('[data-demo-task-form]')) return;
    event.preventDefault();
    const form = event.target;
    const input = form.elements.namedItem('title');
    if (!(input instanceof HTMLInputElement)) return;
    const title = input.value.trim();
    if (!title) {
      input.setCustomValidity('Digite o nome da tarefa.');
      input.reportValidity();
      return;
    }
    state.tasks.push({ id: `demo-task-${state.nextTaskId++}`, title, done: false });
    updateDemoView(root, state);
    root.querySelector('[data-demo-task-input]')?.focus({ preventScroll: true });
  };
  const onInput = (event) => {
    if (event.target instanceof HTMLInputElement && event.target.matches('[data-demo-task-input]')) {
      event.target.setCustomValidity('');
    }
  };
  state.onClick = onClick;
  state.onSubmit = onSubmit;
  state.onInput = onInput;
  demoControllers.set(root, state);
  root.addEventListener('click', onClick);
  root.addEventListener('submit', onSubmit);
  root.addEventListener('input', onInput);
  updateDemoView(root, state);
}
