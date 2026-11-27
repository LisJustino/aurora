import { iconSvg as demoIcon } from '../../utils/icons.js';
import { animateProgressRing, playMotion, prefersReducedMotion } from '../../utils/motion.js';
import { renderPublicHeader } from '../appearance/public-controls.js';
import { timeBasedGreeting } from '../profile/model.js';
import { brl, parseMoney } from '../../utils/currency.js';

const DEMO_NAV_ITEMS = [
  ['today', 'Início', 'home', 'inicio'],
  ['tasks', 'Planejar', 'calendarCheck', 'planejar'],
  ['habits', 'Hábitos', 'leaf', 'habitos'],
  ['finance', 'Finanças', 'wallet', 'financas'],
  ['cycle', 'Ciclo', 'heart', 'ciclo'],
];

const DEMO_PLAN_TABS = [
  ['tasks', 'Tarefas', 'list'],
  ['annual', 'Plano anual', 'target'],
  ['calendar', 'Calendário', 'calendar'],
  ['review', 'Revisão', 'chart'],
];

const DEMO_FIN_TABS = [
  ['resumo', 'Visão geral', 'home'],
  ['lancamentos', 'Movimentações', 'list'],
  ['planejamento', 'Orçamentos', 'target'],
];

const demoControllers = new WeakMap();

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function capitalizeFirst(value) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : '';
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
      <button type="button" class="chk ${task.priority === 'high' ? 'p-high' : task.priority === 'low' ? 'p-low' : 'p-normal'}" role="checkbox" aria-checked="${String(task.done)}"
        aria-label="${task.done ? 'Marcar como pendente' : 'Marcar como concluída'}: ${escapeDemoText(task.title)}"
        data-demo-action="task-toggle"
        data-task-id="${escapeDemoText(task.id)}"><span>${demoIcon('check', 15)}</span></button>
      <div class="tt">
        <span class="ttl">${escapeDemoText(task.title)}</span>
        <span class="meta">
          ${task.done ? '<span class="badge">Concluída</span>' : task.id === nextTaskId ? '<span class="badge warn">Próxima</span>' : `<span class="badge">${escapeDemoText(task.dueDate || 'Hoje')}</span>`}
          ${task.tag ? `<span class="tag">#${escapeDemoText(task.tag)}</span>` : ''}
          ${task.priority === 'high' ? '<span class="m-warn">Prioridade alta</span>' : ''}
        </span>
      </div>
    </li>`,
    )
    .join('')}</ul>`;
}

function renderHabitCard(title, category, days, { large = false, id = 'alongar', target = 5 } = {}) {
  const dayNames = ['segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado', 'domingo'];
  const dayLabels = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
  const completed = days.filter(Boolean).length;
  return `
    <section class="card demo-habit-card ${large ? 'demo-habit-card--large' : ''}" aria-labelledby="demo-habit-title-${id}">
      <div class="head">
        <div>
          <p class="section-kicker">${category}</p>
          <h2 id="demo-habit-title-${id}">${escapeDemoText(title)}</h2>
        </div>
        <span class="demo-area-badge demo-area-badge--habits" aria-hidden="true">${demoIcon('leaf', 20)}</span>
      </div>
      <p class="demo-muted" aria-live="polite">${completed} de ${target} dias nesta semana · ${completed >= target ? 'Meta da semana atingida!' : `faltam ${target - completed} dias`}</p>
      <div class="demo-habit-week" role="group" aria-label="Marque os dias de ${escapeDemoText(title)}">
        ${dayLabels
          .map(
            (day, index) => `<button type="button"
          class="${days[index] ? 'is-complete' : ''}" aria-pressed="${String(days[index])}"
          aria-label="${dayNames[index]}: ${days[index] ? 'marcado' : 'não marcado'}"
          data-demo-action="habit-toggle" data-habit-id="${id}" data-day-index="${index}">${day}</button>`,
          )
          .join('')}
      </div>
      <p class="demo-session-note">Toque nos dias para registrar check-ins interativos.</p>
    </section>`;
}

function renderWaterCard(state) {
  const goal = state.waterGoal || 2000;
  const percent = Math.min(100, Math.round((state.waterMl / goal) * 100));
  const remaining = Math.max(0, goal - state.waterMl);
  const segments = 8;
  const filledSegments = Math.min(segments, Math.round((state.waterMl / goal) * segments));
  return `
    <section class="card demo-water-card" aria-labelledby="demo-water-title">
      <div class="demo-water-main">
        <p class="section-kicker demo-water-kicker">Hidratação diária</p>
        <div class="demo-water-headline">
          <h2 id="demo-water-title" class="demo-water-amount">${state.waterMl.toLocaleString('pt-BR')} mL</h2>
          <span class="demo-water-goal">de ${goal.toLocaleString('pt-BR')} mL · ${remaining > 0 ? `faltam ${remaining.toLocaleString('pt-BR')} mL` : 'meta atingida! 🎉'}</span>
        </div>
        <div class="demo-water-segments" role="progressbar" aria-label="Hidratação de exemplo"
          aria-valuemin="0" aria-valuemax="${goal}" aria-valuenow="${Math.min(goal, state.waterMl)}">${Array.from(
            { length: segments },
            (_, index) => `<span class="${index < filledSegments ? 'is-filled' : ''}" aria-hidden="true"></span>`,
          ).join('')}</div>
      </div>
      <div class="demo-water-actions">
        <span class="demo-water-percent" aria-live="polite">${percent}%</span>
        <button class="btn demo-water-btn" type="button" data-demo-action="water-add" data-amount="250">${demoIcon('water', 16)}+250 mL</button>
        <button class="btn demo-water-btn" type="button" data-demo-action="water-add" data-amount="500">${demoIcon('water', 16)}+500 mL</button>
      </div>
    </section>`;
}

function renderPageHeading(title, description = '') {
  return `<header class="demo-page-heading"><div><h1 tabindex="-1">${title}<i>.</i></h1>${description ? `<p>${description}</p>` : ''}</div></header>`;
}

function demoNotice() {
  return `<div class="notice sample-banner demo-mode-strip" role="note"><span class="demo-mode-dot"
    aria-hidden="true"></span><span class="sample-banner-copy">Demonstração interativa · explore o Aurora com dados de exemplo</span></div>`;
}

function renderHomeTask(task) {
  return `<li class="task ${task.done ? 'done' : ''}">
      <button type="button" class="chk ${task.priority === 'high' ? 'p-high' : task.priority === 'low' ? 'p-low' : 'p-normal'}" role="checkbox" aria-checked="${String(task.done)}"
        aria-label="${task.done ? 'Marcar como pendente' : 'Marcar como concluída'}: ${escapeDemoText(task.title)}"
        data-demo-action="task-toggle" data-task-id="${escapeDemoText(task.id)}"><span>${demoIcon('check', 15)}</span></button>
      <div class="tt">
        <span class="ttl">${escapeDemoText(task.title)}</span>
        <span class="meta">
          <span>${task.done ? 'Concluída' : 'Hoje'}</span>
          ${task.tag ? `<span class="tag">#${escapeDemoText(task.tag)}</span>` : ''}
          ${task.priority === 'high' && !task.done ? '<span class="m-warn">Prioridade alta</span>' : ''}
        </span>
      </div>
    </li>`;
}

function calculateCurrentBalance(state) {
  const extraExpenses = state.demoExpenses.reduce((sum, item) => sum + item.cents, 0);
  return 428000 - extraExpenses;
}

function renderToday(state) {
  const done = state.tasks.filter((task) => task.done);
  const todayIndex = (new Date().getDay() + 6) % 7;
  const open = state.tasks.filter((task) => !task.done);
  const nextTask = open[0] || state.tasks[0];
  const habitDone = state.habitDays[todayIndex];
  const total = state.tasks.length;
  const taskPct = total ? Math.round((done.length / total) * 100) : 0;
  const waterPct = Math.min(100, Math.round((state.waterMl / (state.waterGoal || 2000)) * 100));
  const currentBalance = calculateCurrentBalance(state);

  const lead = open.length
    ? `${open.length} ${open.length === 1 ? 'tarefa pendente para hoje' : 'tarefas pendentes para hoje'} · ${done.length} ${done.length === 1 ? 'concluída' : 'concluídas'}`
    : 'Tudo concluído por hoje. Parabéns!';
  const shortDate = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
    .format(new Date())
    .replace(/[.,]/g, '');

  return `
    ${demoNotice()}
    <header class="home-head" aria-labelledby="demo-greeting">
      <div>
        <p class="date">${escapeDemoText(capitalizeFirst(shortDate))}</p>
        <h1 id="demo-greeting" class="type-editorial-display" tabindex="-1">
          <span class="home-profile-avatar" style="--profile-avatar-color:var(--p)" aria-hidden="true">${demoIcon('sparkles', 20)}</span>${timeBasedGreeting()}, <span class="proper-name">Elisa</span><i>.</i>
        </h1>
        <p class="lead" aria-live="polite">${lead}</p>
      </div>
      <div class="demo-home-actions">
        <button type="button" class="btn primary demo-home-plan-btn" data-demo-view="tasks">${demoIcon('calendarCheck', 16)}Planejar</button>
      </div>
    </header>

    <div class="home-dashboard no-optional-areas">
      <div class="home-primary">
        <div class="home-bento-strip" aria-label="Pulso de hoje">
          <a class="home-bento-tile home-bento-tile--plan" href="/demonstracao" data-demo-view="tasks" style="--bento-pct:${taskPct}%">
            <div class="home-bento-top"><span class="home-bento-icon" aria-hidden="true">${demoIcon('calendarCheck', 16)}</span><span class="home-bento-label">Tarefas</span><span class="home-bento-ring" aria-hidden="true"></span></div>
            <b class="home-bento-value">${done.length}/${total}</b>
            <span class="home-bento-sub">${taskPct}% concluído hoje</span>
          </a>
          <a class="home-bento-tile home-bento-tile--water" href="/demonstracao" data-demo-view="habits" style="--bento-pct:${waterPct}%">
            <div class="home-bento-top"><span class="home-bento-icon" aria-hidden="true">${demoIcon('water', 16)}</span><span class="home-bento-label">Hidratação</span></div>
            <b class="home-bento-value">${waterPct}%</b>
            <span class="home-bento-bar" aria-hidden="true"><i style="width:${waterPct}%"></i></span>
            <span class="home-bento-sub">${state.waterMl.toLocaleString('pt-BR')} / 2.000 mL</span>
          </a>
          <a class="home-bento-tile home-bento-tile--finances" href="/demonstracao" data-demo-view="finance">
            <div class="home-bento-top"><span class="home-bento-icon" aria-hidden="true">${demoIcon('wallet', 16)}</span><span class="home-bento-label">Saldo atual</span></div>
            <b class="home-bento-value home-bento-value--money">${brl(currentBalance)}</b>
            <span class="home-bento-sub">1 a vencer em 5d</span>
          </a>
          <a class="home-bento-tile home-bento-tile--cycle" href="/demonstracao" data-demo-view="cycle">
            <div class="home-bento-top"><span class="home-bento-icon" aria-hidden="true">${demoIcon('heart', 16)}</span><span class="home-bento-label">Ciclo</span></div>
            <b class="home-bento-value">Dia 14</b>
            <span class="home-bento-sub">Fase folicular</span>
          </a>
        </div>

        <section class="card home-day-summary" aria-labelledby="demo-day-summary-title">
          <h2 id="demo-day-summary-title">Resumo do dia</h2>
          ${
            open.length && nextTask
              ? `<div class="home-day-next-task has-quick-action">
              <button type="button" class="chk ${nextTask.priority === 'high' ? 'p-high' : 'p-normal'}" role="checkbox"
                aria-checked="false" aria-label="Concluir: ${escapeDemoText(nextTask.title)}"
                data-demo-action="task-toggle" data-task-id="${escapeDemoText(nextTask.id)}"><span>${demoIcon('check', 15)}</span></button>
              <button type="button" class="home-day-next-task-body" data-demo-view="tasks"
                aria-label="Próxima tarefa: ${escapeDemoText(nextTask.title)}">
                <span><small>${nextTask.priority === 'high' ? 'PRIORIDADE ALTA' : 'PRÓXIMA TAREFA'}</small><b>${escapeDemoText(nextTask.title)}</b></span>${demoIcon('chevRight', 16)}
              </button>
            </div>`
              : `<a class="home-day-next-task" href="/demonstracao" data-demo-view="tasks" aria-label="Todas as tarefas de hoje concluídas">
              ${demoIcon('check', 18)}<span><small>TUDO FEITO</small><b>Tarefas de hoje concluídas</b></span>${demoIcon('chevRight', 16)}
            </a>`
          }
          <div class="home-day-chips" role="group" aria-label="Resumo das áreas de hoje">
            <a class="home-day-chip home-day-chip--plan" href="/demonstracao" data-demo-view="tasks"
              aria-label="Tarefas, ${done.length} de ${total} feitas">
              <span class="home-day-chip-count" aria-hidden="true">${done.length}/${total}</span>
              <span class="home-day-chip-copy">Tarefas</span>
            </a>
            <a class="home-day-chip home-day-chip--habits" href="/demonstracao" data-demo-view="habits"
              aria-label="Hábitos, ${habitDone ? '1 de 1 feito' : '0 de 1 feito'}">
              <span class="home-day-chip-count" aria-hidden="true">${habitDone ? '1/1' : '0/1'}</span>
              <span class="home-day-chip-copy">Hábitos</span>
            </a>
            <a class="home-day-chip home-day-chip--water" href="/demonstracao" data-demo-view="habits"
              aria-label="Água, ${state.waterMl.toLocaleString('pt-BR')} de 2.000 mL">
              <span class="home-day-chip-count" aria-hidden="true">${waterPct}%</span>
              <span class="home-day-chip-copy">Água</span>
            </a>
            <a class="home-day-chip home-day-chip--cycle" href="/demonstracao" data-demo-view="cycle"
              aria-label="Ciclo, dia 14">
              <span class="home-day-chip-count" aria-hidden="true">14</span>
              <span class="home-day-chip-copy">Ciclo</span>
            </a>
            <a class="home-day-chip home-day-chip--balance" href="/demonstracao" data-demo-view="finance"
              aria-label="Saldo atual: ${brl(currentBalance)}">
              <span class="home-day-chip-count" aria-hidden="true">${brl(currentBalance)}</span>
              <span class="home-day-chip-copy">Saldo</span>
            </a>
          </div>
          <a class="home-day-upcoming" href="/demonstracao" data-demo-view="finance"
            aria-label="A vencer em 5 dias: Internet e luz, R$ 289,90">
            ${demoIcon('wallet', 16)}<span><small>A VENCER EM 5 DIAS</small><b>Internet e luz · R$ 289,90</b></span>${demoIcon('chevRight', 16)}
          </a>
        </section>

        <section class="card home-today-card" aria-labelledby="demo-today-tasks-title">
          <div class="head">
            <div><h2 id="demo-today-tasks-title" class="type-editorial-title">Hoje</h2></div>
            <div class="row"><button type="button" class="btn ghost sm" data-demo-view="tasks">Ver planejamento</button></div>
          </div>
          <div class="home-task-groups">
            ${
              open.length
                ? `<section class="home-task-group" aria-label="Tarefas para hoje">
                <h3>${demoIcon('calendarCheck', 15)}Para hoje <span>${open.length}</span></h3>
                <ul class="list">${open.map(renderHomeTask).join('')}</ul>
              </section>`
                : '<p class="demo-muted" style="padding:var(--space-3) 0">Todas as tarefas de hoje foram concluídas!</p>'
            }
            ${
              done.length
                ? `<details class="home-completed" open><summary>${demoIcon('check', 15)}Concluídas hoje <span
                class="home-completed-count">${done.length}</span></summary><ul
                class="list">${done.map(renderHomeTask).join('')}</ul></details>`
                : ''
            }
          </div>
        </section>

        <section class="card home-habit-checkins" aria-labelledby="demo-habits-title">
          <div class="head">
            <h2 id="demo-habits-title">Hábitos de hoje</h2>
            <button type="button" class="btn ghost sm" data-demo-view="habits">Ver hábitos</button>
          </div>
          <ul class="list">
            <li class="home-habit-row">
              <span class="home-habit-icon" aria-hidden="true">${demoIcon('leaf', 18)}</span>
              <span class="grow">
                <b>Alongar um pouquinho</b>
                <span class="small muted">${habitDone ? 'Concluído hoje' : 'Ainda não marcado'}</span>
              </span>
              <button type="button" class="btn sm ${habitDone ? 'back' : 'primary'}" data-demo-action="habit-toggle"
                data-habit-id="alongar" data-day-index="${todayIndex}" aria-pressed="${String(habitDone)}">${demoIcon(habitDone ? 'check' : 'plus', 16)}${habitDone ? 'Concluído' : 'Marcar'}</button>
            </li>
            <li class="home-habit-row">
              <span class="home-habit-icon" aria-hidden="true">${demoIcon('water', 18)}</span>
              <span class="grow">
                <b>Hidratação diária</b>
                <span class="small muted">${state.waterMl.toLocaleString('pt-BR')} / 2.000 mL (${waterPct}%)</span>
              </span>
              <button type="button" class="btn sm ghost" data-demo-action="water-add" data-amount="250">
                ${demoIcon('plus', 16)}+250 mL
              </button>
            </li>
          </ul>
        </section>

        <section class="card home-quick-card" aria-labelledby="demo-quick-title">
          <div class="home-quick-copy">
            <span class="home-quick-mark" aria-hidden="true">${demoIcon('plus', 18)}</span>
            <div>
              <h2 id="demo-quick-title" class="type-editorial-title">Qual é o próximo passo<i>?</i></h2>
              <p>Adicione uma tarefa com tag ou prazo para testar o fluxo.</p>
            </div>
          </div>
          <form class="home-quick-form demo-quick-form" data-demo-task-form>
            <label class="sr" for="demo-home-task">Nova tarefa</label>
            <input id="demo-home-task" name="title" type="text" maxlength="80" autocomplete="off"
              placeholder="Ex.: revisar apresentação amanhã" required data-demo-task-input>
            <label class="sr" for="demo-quick-priority">Prioridade</label>
            <select id="demo-quick-priority" name="priority" aria-label="Prioridade">
              <option value="normal">Normal</option>
              <option value="high">Alta prioridade</option>
              <option value="low">Baixa</option>
            </select>
            <button type="submit" class="btn primary">Adicionar</button>
            <span class="home-quick-date badge" aria-live="polite">Hoje</span>
          </form>
        </section>
      </div>
    </div>`;
}

function renderPlanSubtabs(state) {
  return `<div class="demo-subtabs" role="tablist" aria-label="Visões de planejamento">${DEMO_PLAN_TABS.map(
    ([id, label, iconName]) => `<button type="button" class="demo-subtab ${state.planTab === id ? 'is-current' : ''}"
      role="tab" aria-selected="${String(state.planTab === id)}"
      data-demo-plan-tab="${id}">${demoIcon(iconName, 16)}<span>${label}</span></button>`,
  ).join('')}</div>`;
}

function renderTasks(state) {
  let panel = '';
  if (state.planTab === 'annual') {
    panel = renderAnnualPanel(state);
  } else if (state.planTab === 'calendar') {
    panel = renderCalendarPanel(state);
  } else if (state.planTab === 'review') {
    panel = renderReviewPanel(state);
  } else {
    const filter = state.planFilter || 'all';
    const query = (state.planSearch || '').toLowerCase().trim();
    const filteredTasks = state.tasks.filter((task) => {
      if (query && !task.title.toLowerCase().includes(query) && !(task.tag || '').toLowerCase().includes(query)) {
        return false;
      }
      if (filter === 'today') return task.dueDate === 'Hoje';
      if (filter === 'done') return task.done;
      if (filter === 'open') return !task.done;
      if (filter.startsWith('tag:')) return task.tag === filter.slice(4);
      return true;
    });
    const completed = state.tasks.filter((task) => task.done).length;

    panel = `
      <section class="card demo-area-panel" aria-labelledby="demo-task-list-title">
        <div class="head">
          <div>
            <p class="section-kicker">Organize no seu ritmo</p>
            <h2 id="demo-task-list-title">Tarefas e pendências</h2>
          </div>
          <span class="pill" aria-live="polite">${completed} de ${state.tasks.length} concluídas</span>
        </div>

        <div class="scroll-x" role="group" aria-label="Filtrar tarefas" style="margin-bottom:var(--space-3)">
          <button type="button" class="chip ${filter === 'all' ? 'is-active' : ''}" data-demo-plan-filter="all" aria-pressed="${String(filter === 'all')}">Todas</button>
          <button type="button" class="chip ${filter === 'today' ? 'is-active' : ''}" data-demo-plan-filter="today" aria-pressed="${String(filter === 'today')}">Hoje</button>
          <button type="button" class="chip ${filter === 'open' ? 'is-active' : ''}" data-demo-plan-filter="open" aria-pressed="${String(filter === 'open')}">Pendentes</button>
          <button type="button" class="chip ${filter === 'done' ? 'is-active' : ''}" data-demo-plan-filter="done" aria-pressed="${String(filter === 'done')}">Concluídas</button>
          <button type="button" class="chip ${filter === 'tag:rotina' ? 'is-active' : ''}" data-demo-plan-filter="tag:rotina" aria-pressed="${String(filter === 'tag:rotina')}">#rotina</button>
          <button type="button" class="chip ${filter === 'tag:trabalho' ? 'is-active' : ''}" data-demo-plan-filter="tag:trabalho" aria-pressed="${String(filter === 'tag:trabalho')}">#trabalho</button>
        </div>

        <div class="row" style="margin-bottom:var(--space-3)">
          <label class="search" style="flex:1">
            <span class="sr">Buscar tarefas</span>${demoIcon('search', 18)}
            <input type="search" data-demo-search value="${escapeDemoText(state.planSearch || '')}" placeholder="Buscar por título ou tag...">
          </label>
        </div>

        ${renderTaskRows(filteredTasks)}

        <form class="demo-add-form" data-demo-task-form style="margin-top:var(--space-4)">
          <label for="demo-new-task">Nova tarefa</label>
          <div style="display:flex;gap:var(--space-2);flex-wrap:wrap">
            <input id="demo-new-task" name="title" type="text" maxlength="80" autocomplete="off"
              placeholder="Ex.: revisar orçamento da viagem" required data-demo-task-input style="flex:1;min-width:200px">
            <input name="tag" type="text" maxlength="20" placeholder="#tag (opcional)" style="width:120px">
            <button class="btn primary" type="submit">Adicionar</button>
          </div>
          <p class="demo-note" id="demo-task-help">Esta demonstração é interativa e nada é enviado para servidores.</p>
        </form>
      </section>`;
  }
  return `${renderPageHeading('Planejar', 'Organize suas tarefas, visualize o plano anual e acompanhe o ritmo da sua semana.')}
    ${renderPlanSubtabs(state)}
    ${panel}`;
}

function renderAnnualPanel(state) {
  const year = new Date().getFullYear();
  return `
    <section class="card demo-area-panel" aria-labelledby="demo-annual-title">
      <div class="head">
        <div>
          <p class="section-kicker">Seu próximo capítulo</p>
          <h2 id="demo-annual-title">Plano anual · ${year}</h2>
        </div>
        <span class="demo-area-badge demo-area-badge--plan" aria-hidden="true">${demoIcon('target', 20)}</span>
      </div>
      <div class="demo-annual-goal-box">
        <p><strong>Intenção do ano:</strong> “${escapeDemoText(state.annualGoal || 'Viver com mais foco, saúde e tranquilidade')}”</p>
      </div>

      <h3 style="margin:var(--space-4) 0 var(--space-2);font-size:var(--text-base)">Conquistas planejadas para ${year}</h3>
      <ul class="list demo-task-list">
        ${(state.annualGoals || [])
          .map(
            (goal) => `
          <li class="task ${goal.done ? 'done' : ''}">
            <button type="button" class="chk" role="checkbox" aria-checked="${String(goal.done)}"
              data-demo-action="annual-toggle" data-goal-id="${goal.id}">
              <span>${demoIcon('check', 15)}</span>
            </button>
            <div class="tt">
              <span class="ttl">${escapeDemoText(goal.text)}</span>
              <span class="meta"><span class="badge">${escapeDemoText(goal.area)}</span></span>
            </div>
          </li>`,
          )
          .join('')}
      </ul>

      <form class="demo-add-form" data-demo-annual-form style="margin-top:var(--space-4)">
        <label for="demo-annual-goal">Adicionar uma meta anual</label>
        <div>
          <input id="demo-annual-goal" name="goal" type="text" maxlength="120"
            placeholder="Ex.: fazer uma viagem especial em família" required>
          <button class="btn primary" type="submit">Adicionar meta</button>
        </div>
      </form>
    </section>`;
}

function renderCalendarPanel(state) {
  const days = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
  const todayIndex = (new Date().getDay() + 6) % 7;
  return `
    <section class="card demo-area-panel" aria-labelledby="demo-calendar-title">
      <div class="head">
        <div>
          <p class="section-kicker">Visão semanal</p>
          <h2 id="demo-calendar-title">Calendário da semana</h2>
        </div>
        <span class="demo-area-badge demo-area-badge--plan" aria-hidden="true">${demoIcon('calendar', 20)}</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(130px, 1fr));gap:var(--space-2);margin:var(--space-3) 0">
        ${days
          .map(
            (dayName, index) => `
          <div class="card surface-soft" style="padding:var(--space-3);border-radius:var(--r);${index === todayIndex ? 'border:1px solid var(--accent);' : ''}">
            <div style="font-size:var(--text-xs);font-weight:var(--weight-bold);color:${index === todayIndex ? 'var(--accent)' : 'var(--muted)'};margin-bottom:var(--space-1)">
              ${dayName} ${index === todayIndex ? '· Hoje' : ''}
            </div>
            ${
              index === todayIndex
                ? `<div class="tag" style="display:block;margin-bottom:4px">Ler por alguns minutos</div>
                   <div class="tag" style="display:block">Revisão semanal</div>`
                : index === (todayIndex + 1) % 7
                  ? '<div class="tag" style="display:block">Marcar consulta</div>'
                  : '<div style="font-size:var(--text-xs);color:var(--muted)">Sem tarefas</div>'
            }
          </div>`,
          )
          .join('')}
      </div>
      <p class="demo-note">Alterne entre lista e calendário para organizar seus compromissos no ritmo natural da semana.</p>
    </section>`;
}

function renderReviewPanel(state) {
  const completed = state.tasks.filter((t) => t.done).length;
  return `
    <section class="card demo-area-panel" aria-labelledby="demo-review-title">
      <div class="head">
        <div>
          <p class="section-kicker">Reflexão semanal</p>
          <h2 id="demo-review-title">Ritmo da sua semana</h2>
        </div>
        <span class="demo-area-badge demo-area-badge--plan" aria-hidden="true">${demoIcon('chart', 20)}</span>
      </div>
      <div class="demo-finance-summary" role="group" aria-label="Métricas da semana">
        <article><span>${demoIcon('check', 15)} Tarefas feitas</span><strong>${completed}</strong></article>
        <article><span>${demoIcon('leaf', 15)} Hábitos mantidos</span><strong>2 ativos</strong></article>
        <article><span>${demoIcon('water', 15)} Hidratação</span><strong>${state.waterMl.toLocaleString('pt-BR')} mL</strong></article>
      </div>
      <p style="margin-top:var(--space-3);color:var(--muted);font-size:var(--text-sm)">
        O Aurora prioriza a constância leve: celebrar pequenas vitórias do dia ajuda a manter a rotina sem cobrança excessiva.
      </p>
    </section>`;
}

function renderHabits(state) {
  const completedStretch = state.habitDays.filter(Boolean).length;
  return `${renderPageHeading('Hábitos', 'Acompanhe sua hidratação e cultive pequenos cuidados no ritmo da semana.')}
    ${renderWaterCard(state)}
    <div style="display:grid;gap:var(--space-4)">
      ${renderHabitCard('Alongar um pouquinho', 'Corpo & Yoga · 5 dias/sem', state.habitDays, { large: true, id: 'alongar', target: 5 })}
      ${renderHabitCard('Ler 15 páginas', 'Mente & Foco · Diário', state.otherHabitDays['habit-read'], { large: true, id: 'read', target: 7 })}
      ${renderHabitCard('Caminhada ao ar livre', 'Saúde & Movimento · 3 dias/sem', state.otherHabitDays['habit-walk'], { large: true, id: 'walk', target: 3 })}
      <section class="card demo-area-panel demo-habit-note">
        <p class="section-kicker">Constância leve</p>
        <h2>${completedStretch} dias de alongamento nesta semana.</h2>
        <p>Toque em qualquer dia dos círculos acima para marcar ou desmarcar. O Aurora valoriza a flexibilidade: pausas também fazem parte de uma rotina sustentável.</p>
      </section>
    </div>`;
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
  const dateLabel = capitalizeFirst(
    new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(firstDay),
  );
  return `${renderPageHeading('Ciclo', 'Acompanhe seu ciclo ao lado do resto da rotina, com privacidade e clareza.')}
    <section class="card demo-area-panel" aria-labelledby="demo-cycle-title">
      <div class="head">
        <div>
          <p class="section-kicker">${escapeDemoText(dateLabel)} · Acompanhamento</p>
          <h2 id="demo-cycle-title">Fase Folicular · Dia 14</h2>
        </div>
        <span class="demo-area-badge demo-area-badge--cycle" aria-hidden="true">${demoIcon('heart', 20)}</span>
      </div>

      <div class="demo-calendar" role="group" aria-label="Dias de exemplo no calendário">${dates
        .map((date, index) => {
          const day = localDateKey(date);
          const isSelected = state.cycleDay === day;
          return `<button type="button" class="${isSelected ? 'is-selected' : ''}"
            data-demo-action="cycle-day" data-day="${day}"
            aria-pressed="${String(isSelected)}"><span>${weekdays[index]}</span><strong>${date.getDate()}</strong></button>`;
        })
        .join('')}</div>

      <div class="demo-cycle-detail" aria-live="polite">
        <p class="section-kicker">${escapeDemoText(new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(new Date(`${state.cycleDay}T12:00:00`)))}</p>
        <h3>${state.cycleSymptom ? 'Sintoma registrado: cólica leve anotada.' : 'Fase folicular estimada — energia e disposição em alta.'}</h3>
        <p>Acompanhe fluxo, sintomas e notas para entender suas variações de ritmo ao longo do mês.</p>
        <div style="display:flex;gap:var(--space-2);flex-wrap:wrap;margin-top:var(--space-2)">
          <button class="btn sm ${state.cycleSymptom ? '' : 'primary'}" type="button" data-demo-action="cycle-symptom">
            ${state.cycleSymptom ? 'Remover cólica' : '+ Registrar cólica leve'}
          </button>
          <button class="btn sm ghost" type="button" data-demo-action="cycle-flow">
            Fluxo: ${state.cycleFlow === 'light' ? 'Leve' : 'Nenhum'}
          </button>
        </div>
      </div>

      <div class="demo-finance-summary" role="group" aria-label="Médias informativas" style="margin-top:var(--space-4)">
        <article><span>${demoIcon('heart', 15)} Média do ciclo</span><strong>28 dias</strong></article>
        <article><span>${demoIcon('clock', 15)} Média do período</span><strong>5 dias</strong></article>
      </div>
      <p class="demo-note">Informações sobre o ciclo são estritamente privadas, ficam sob seu controle e têm finalidade informativa, não substituindo orientação médica.</p>
    </section>`;
}

function dateForFinanceOffset(offset) {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() - offset);
  return date;
}

function renderFinanceSubtabs(state) {
  return `<div class="demo-subtabs" role="tablist" aria-label="Seções de Finanças">${DEMO_FIN_TABS.map(
    ([id, label, iconName]) => `<button type="button" class="demo-subtab ${state.finTab === id ? 'is-current' : ''}"
      role="tab" aria-selected="${String(state.finTab === id)}"
      data-demo-fin-tab="${id}">${demoIcon(iconName, 16)}<span>${label}</span></button>`,
  ).join('')}</div>`;
}

function renderFinance(state) {
  const date = dateForFinanceOffset(state.financeMonth);
  const title = capitalizeFirst(new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(date));
  const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  const extraExpenses = state.demoExpenses.filter((item) => item.month === monthKey);

  const baseItems =
    state.financeMonth === 0
      ? [
          ['Aluguel e condomínio', 'Moradia', 145000, 'home'],
          ['Mercado da semana', 'Alimentação', 42000, 'utensils'],
          ['Internet fibra', 'Assinaturas', 12000, 'tag'],
          ['Farmácia e cuidados', 'Saúde', 6500, 'pill'],
          ['Transporte e combustível', 'Rotina', 9000, 'bike'],
        ]
      : [
          ['Aluguel e condomínio', 'Moradia', 145000, 'home'],
          ['Mercado do mês', 'Alimentação', 85000, 'utensils'],
          ['Internet fibra', 'Assinaturas', 12000, 'tag'],
        ];

  const expenses =
    baseItems.reduce((total, [, , cents]) => total + cents, 0) +
    extraExpenses.reduce((total, item) => total + item.cents, 0);
  const income = 520000;
  const result = income - expenses;
  const currentBalance = calculateCurrentBalance(state);

  let panelContent = '';
  if (state.finTab === 'lancamentos') {
    panelContent = `
      <h3 class="demo-list-heading">Lançamentos do mês</h3>
      <ul class="demo-finance-list">
        <li>
          <span class="demo-finance-mark" style="color:var(--ok)">${demoIcon('arrowDown', 17)}</span>
          <span><b>Salário e recebimentos</b><small>Conta Corrente · 05/${String(date.getMonth() + 1).padStart(2, '0')}</small></span>
          <strong style="color:var(--ok)">+ ${brl(income)}</strong>
        </li>
        ${baseItems
          .map(
            ([name, category, cents, icon]) => `<li>
          <span class="demo-finance-mark">${demoIcon(icon, 17)}</span>
          <span><b>${name}</b><small>${category} · exemplo</small></span>
          <strong>− ${brl(cents)}</strong>
        </li>`,
          )
          .join('')}
        ${extraExpenses
          .map(
            (item) => `<li>
          <span class="demo-finance-mark">${demoIcon('tag', 17)}</span>
          <span><b>${escapeDemoText(item.title)}</b><small>Despesa avulsa</small></span>
          <strong>− ${brl(item.cents)}</strong>
        </li>`,
          )
          .join('')}
      </ul>

      <form class="demo-add-form" data-demo-expense-form style="margin-top:var(--space-4)">
        <label for="demo-expense-title">Registrar uma despesa fictícia</label>
        <div>
          <input id="demo-expense-title" name="title" type="text" maxlength="60" placeholder="Ex.: café da tarde" required>
          <input name="amount" type="text" inputmode="decimal" maxlength="16" placeholder="R$ 15,00" aria-label="Valor" required>
          <button class="btn primary" type="submit">Lançar</button>
        </div>
        <p class="demo-note" data-demo-finance-error role="status" aria-live="polite">Nenhum dado bancário é solicitado. Você registra o que quiser acompanhar.</p>
      </form>`;
  } else if (state.finTab === 'planejamento') {
    panelContent = `
      <h3 class="demo-list-heading">Orçamentos por categoria</h3>
      <div style="display:grid;gap:var(--space-3);margin:var(--space-3) 0">
        <div class="card surface-soft" style="padding:var(--space-3)">
          <div style="display:flex;justify-content:space-between;margin-bottom:6px">
            <b>Moradia</b>
            <span>R$ 1.450 / R$ 1.450 (100%)</span>
          </div>
          <div class="demo-water-segments" role="progressbar" style="height:8px"><span class="is-filled" style="width:100%"></span></div>
        </div>
        <div class="card surface-soft" style="padding:var(--space-3)">
          <div style="display:flex;justify-content:space-between;margin-bottom:6px">
            <b>Alimentação e mercado</b>
            <span>${brl(42000 + extraExpenses.reduce((s, i) => s + i.cents, 0))} / R$ 1.200 (52%)</span>
          </div>
          <div class="demo-water-segments" role="progressbar" style="height:8px"><span class="is-filled" style="width:52%"></span></div>
        </div>
        <div class="card surface-soft" style="padding:var(--space-3)">
          <div style="display:flex;justify-content:space-between;margin-bottom:6px">
            <b>Lazer e saídas</b>
            <span>R$ 150 / R$ 400 (37%)</span>
          </div>
          <div class="demo-water-segments" role="progressbar" style="height:8px"><span class="is-filled" style="width:37%"></span></div>
        </div>
      </div>

      <h3 class="demo-list-heading" style="margin-top:var(--space-4)">Metas de economia</h3>
      <div class="card surface-soft" style="padding:var(--space-3)">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px">
          <b>Viagem de férias</b>
          <span style="color:var(--accent);font-weight:var(--weight-bold)">R$ 2.400 de R$ 5.000 (48%)</span>
        </div>
        <div class="demo-water-segments" role="progressbar" style="height:8px"><span class="is-filled" style="width:48%"></span></div>
      </div>`;
  } else {
    // Resumo geral
    panelContent = `
      <div class="head">
        <div>
          <p class="section-kicker">Resumo do mês</p>
          <h2 id="demo-finance-title">${escapeDemoText(title)}</h2>
        </div>
        <div class="demo-month-controls" role="group" aria-label="Mês de exemplo">
          <button type="button" class="iconbtn" data-demo-action="finance-month" data-direction="-1"
            aria-label="Mês anterior" ${state.financeMonth === 1 ? 'disabled' : ''}>${demoIcon('chevLeft', 18)}</button>
          <button type="button" class="iconbtn" data-demo-action="finance-month" data-direction="1"
            aria-label="Próximo mês" ${state.financeMonth === 0 ? 'disabled' : ''}>${demoIcon('chevRight', 18)}</button>
        </div>
      </div>

      <div class="demo-finance-summary" role="group" aria-label="Resumo financeiro">
        <article class="is-income">
          <span><i aria-hidden="true">${demoIcon('arrowDown', 15)}</i>Entradas</span>
          <strong>${brl(income)}</strong>
        </article>
        <article class="is-expense">
          <span><i aria-hidden="true">${demoIcon('arrowUp', 15)}</i>Saídas</span>
          <strong>${brl(expenses)}</strong>
        </article>
        <article class="is-result${result < 0 ? ' is-negative' : ''}">
          <span><i aria-hidden="true">${demoIcon('pie', 15)}</i>Resultado</span>
          <strong>${brl(result)}</strong>
        </article>
      </div>

      <h3 class="demo-list-heading">Contas e cartões</h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:var(--space-2);margin:var(--space-3) 0">
        <div class="card surface-soft" style="padding:var(--space-3)">
          <div style="font-size:var(--text-xs);color:var(--muted);display:flex;align-items:center;gap:6px">${demoIcon('bank', 14)} Conta Corrente</div>
          <b style="font-size:var(--text-base);display:block;margin-top:4px">${brl(currentBalance - 680000 > 0 ? currentBalance - 680000 : 245000)}</b>
        </div>
        <div class="card surface-soft" style="padding:var(--space-3)">
          <div style="font-size:var(--text-xs);color:var(--muted);display:flex;align-items:center;gap:6px">${demoIcon('wallet', 14)} Reserva de Emergência</div>
          <b style="font-size:var(--text-base);display:block;margin-top:4px">R$ 6.800,00</b>
        </div>
        <div class="card surface-soft" style="padding:var(--space-3)">
          <div style="font-size:var(--text-xs);color:var(--muted);display:flex;align-items:center;gap:6px">${demoIcon('card', 14)} Cartão de Crédito</div>
          <b style="font-size:var(--text-base);display:block;margin-top:4px;color:var(--warn)">Fatura: R$ 1.180,00</b>
          <span style="font-size:var(--text-xs);color:var(--muted)">Vence em 5 dias</span>
        </div>
      </div>

      <h3 class="demo-list-heading">Principais gastos do mês</h3>
      <ul class="demo-finance-list">
        ${baseItems
          .slice(0, 3)
          .map(
            ([name, category, cents, icon]) => `<li>
          <span class="demo-finance-mark">${demoIcon(icon, 17)}</span>
          <span><b>${name}</b><small>${category} · exemplo</small></span>
          <strong>− ${brl(cents)}</strong>
        </li>`,
          )
          .join('')}
      </ul>

      <form class="demo-add-form" data-demo-expense-form style="margin-top:var(--space-4)">
        <label for="demo-expense-title">Lançar uma despesa fictícia</label>
        <div>
          <input id="demo-expense-title" name="title" type="text" maxlength="60" placeholder="Ex.: café" required>
          <input name="amount" type="text" inputmode="decimal" maxlength="16" placeholder="R$ 12,50" aria-label="Valor da despesa" required>
          <button class="btn primary" type="submit">Adicionar</button>
        </div>
        <p class="demo-note" data-demo-finance-error role="status" aria-live="polite">Valores fictícios. Nada é salvo e não há conexão com bancos.</p>
      </form>`;
  }

  return `${renderPageHeading('Finanças', 'Acompanhe contas, cartões, entradas e orçamentos do mês sem expor senhas bancárias.')}
    ${renderFinanceSubtabs(state)}
    <section class="card demo-area-panel" aria-labelledby="demo-finance-title">
      ${panelContent}
    </section>`;
}

function renderDemoScreen(state) {
  if (state.view === 'today') return renderToday(state);
  return demoNotice() + renderDemoArea(state);
}

function renderDemoArea(state) {
  if (state.view === 'tasks') return renderTasks(state);
  if (state.view === 'habits') return renderHabits(state);
  if (state.view === 'cycle') return renderCycle(state);
  return renderFinance(state);
}

function routeForDemoView(view) {
  return DEMO_NAV_ITEMS.find(([id]) => id === view)?.[3] || 'inicio';
}

function renderNavigation(state) {
  return DEMO_NAV_ITEMS.map(
    ([id, label, iconName]) =>
      `<a class="nav-item demo-nav-link ${state.view === id ? 'is-current' : ''}" href="/demonstracao" title="${label}"
        data-demo-view="${id}" ${state.view === id ? 'aria-current="page"' : ''}><span
        class="ni">${demoIcon(iconName, 20)}</span><span class="tab-label-group"><span
        class="tab-label">${label}</span></span></a>`,
  ).join('');
}

function updateDemoView(root, state, focusHeading = false) {
  const main = root.querySelector('#demo-main');
  if (main instanceof HTMLElement) main.dataset.route = routeForDemoView(state.view);
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
  root.querySelectorAll('.demo-nav [data-demo-view]').forEach((item) => {
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
    planTab: 'tasks',
    planFilter: 'all',
    planSearch: '',
    finTab: 'resumo',
    tasks: [
      {
        id: 'organize',
        title: 'Organizar a semana no Aurora',
        priority: 'high',
        tag: 'rotina',
        dueDate: 'Hoje',
        done: true,
      },
      {
        id: 'message',
        title: 'Responder uma mensagem importante',
        priority: 'normal',
        tag: 'trabalho',
        dueDate: 'Hoje',
        done: true,
      },
      { id: 'read', title: 'Ler por alguns minutos', priority: 'high', tag: 'rotina', dueDate: 'Hoje', done: false },
      {
        id: 'call',
        title: 'Marcar consulta de rotina',
        priority: 'normal',
        tag: 'saúde',
        dueDate: 'Amanhã',
        done: false,
      },
      {
        id: 'groceries',
        title: 'Compras de hortifrúti da semana',
        priority: 'low',
        tag: 'casa',
        dueDate: 'Sem prazo',
        done: false,
      },
    ],
    nextTaskId: 1,
    displayedHomeProgress: null,
    habitDays: [true, true, false, false, false, false, false],
    otherHabitDays: {
      'habit-read': [true, true, true, false, false, false, false],
      'habit-walk': [false, true, false, true, false, false, false],
    },
    waterMl: 1250,
    waterGoal: 2000,
    financeMonth: 0,
    demoExpenses: [],
    cycleDay: localDateKey(new Date()),
    cycleSymptom: false,
    cycleFlow: 'light',
    annualGoal: 'Viver com mais foco, saúde e tranquilidade',
    annualGoals: [
      { id: 'g1', text: 'Completar reserva de emergência', area: 'Finanças', done: true },
      { id: 'g2', text: 'Caminhar ou praticar yoga 4x por semana', area: 'Saúde', done: false },
      { id: 'g3', text: 'Ler 12 livros ao longo do ano', area: 'Mente', done: false },
    ],
    calendarConnected: true,
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
          class="section-kicker">Gostou da experiência?</p><h2>Comece a organizar sua rotina no Aurora</h2><p>Crie sua conta grátis para salvar suas tarefas, hábitos, finanças e ciclo com segurança.</p></div><div
          class="public-actions"><a class="btn primary" href="/criar-conta"
          data-public-action="signup">Criar conta grátis</a><a class="btn" href="/"
          data-public-action="landing">Voltar à página inicial</a></div></section>
        <footer class="demo-footer"><button type="button" class="footer-link"
          data-demo-action="help">Ajuda e sobre</button><span aria-hidden="true">·</span><button type="button"
          class="footer-link" data-legal-document="terms">Termos</button><span aria-hidden="true">·</span><button
          type="button" class="footer-link" data-legal-document="privacy">Privacidade</button></footer>
      </main>
    </div>`;

  const onClick = (event) => {
    if (!(event.target instanceof Element)) return;

    const planTab = event.target.closest('[data-demo-plan-tab]');
    if (planTab instanceof HTMLElement) {
      event.preventDefault();
      state.planTab = planTab.dataset.demoPlanTab;
      updateDemoView(root, state);
      root.querySelector(`[data-demo-plan-tab="${state.planTab}"]`)?.focus({ preventScroll: true });
      return;
    }

    const finTab = event.target.closest('[data-demo-fin-tab]');
    if (finTab instanceof HTMLElement) {
      event.preventDefault();
      state.finTab = finTab.dataset.demoFinTab;
      updateDemoView(root, state);
      root.querySelector(`[data-demo-fin-tab="${state.finTab}"]`)?.focus({ preventScroll: true });
      return;
    }

    const planFilter = event.target.closest('[data-demo-plan-filter]');
    if (planFilter instanceof HTMLElement) {
      event.preventDefault();
      state.planFilter = planFilter.dataset.demoPlanFilter;
      updateDemoView(root, state);
      return;
    }

    const viewButton = event.target.closest('[data-demo-view]');
    if (viewButton instanceof HTMLElement) {
      event.preventDefault();
      state.view = viewButton.dataset.demoView;
      updateDemoView(root, state, true);
      window.scrollTo({
        top: 0,
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
    } else if (action === 'cycle-flow') {
      state.cycleFlow = state.cycleFlow === 'light' ? 'none' : 'light';
      updateDemoView(root, state);
    } else if (action === 'water-add') {
      const amount = Number(button.dataset.amount || 250);
      state.waterMl += amount;
      updateDemoView(root, state);
    } else if (action === 'calendar-toggle') {
      state.calendarConnected = !state.calendarConnected;
      updateDemoView(root, state);
    } else if (action === 'finance-month') {
      state.financeMonth = Math.min(1, Math.max(0, state.financeMonth - Number(button.dataset.direction)));
      updateDemoView(root, state);
    } else if (action === 'annual-toggle') {
      const goalId = button.dataset.goalId;
      const goal = state.annualGoals.find((g) => g.id === goalId);
      if (goal) {
        goal.done = !goal.done;
        updateDemoView(root, state);
      }
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
      const habitId = button.dataset.habitId || 'alongar';
      const index = Number(button.dataset.dayIndex);
      if (!Number.isInteger(index) || index < 0 || index >= 7) return;

      if (habitId === 'alongar') {
        state.habitDays[index] = !state.habitDays[index];
      } else if (state.otherHabitDays[habitId]) {
        state.otherHabitDays[habitId][index] = !state.otherHabitDays[habitId][index];
      }
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
        if (error) {
          error.textContent = 'Informe uma descrição e um valor válido, maior que zero.';
          error.dataset.state = 'error';
        }
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
      const goalText = event.target.elements.goal.value.trim();
      if (goalText) {
        state.annualGoals.push({
          id: `g-${Date.now()}`,
          text: goalText,
          area: 'Geral',
          done: false,
        });
        updateDemoView(root, state);
      }
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
    const priority = form.elements.namedItem('priority')?.value || 'normal';
    const tag = (form.elements.namedItem('tag')?.value || '').replace(/^#/, '').trim() || 'novo';
    state.tasks.unshift({
      id: `demo-task-${state.nextTaskId++}`,
      title,
      priority,
      tag,
      dueDate: 'Hoje',
      done: false,
    });
    updateDemoView(root, state);
    root.querySelector('[data-demo-task-input]')?.focus({ preventScroll: true });
  };

  const onInput = (event) => {
    if (event.target instanceof HTMLInputElement && event.target.matches('[data-demo-task-input]')) {
      event.target.setCustomValidity('');
    }
    if (event.target instanceof HTMLInputElement && event.target.matches('[data-demo-search]')) {
      state.planSearch = event.target.value;
      updateDemoView(root, state);
      const searchInput = root.querySelector('[data-demo-search]');
      if (searchInput instanceof HTMLInputElement) {
        searchInput.focus();
        searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
      }
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
