import { h, raw } from '../../utils/dom.js';
import { icon } from '../../utils/icons.js';
import { DIAS, longDate, MESES_L, pad, pk, shortDate } from '../../utils/dates.js';
import { tasksForWeek, weekDays } from './week.js';
import {
  ANNUAL_PLAN_IDEA_CATEGORIES,
  ANNUAL_PLAN_IDEAS,
  ANNUAL_PLAN_LIMITS,
  filterAnnualPlanIdeas,
} from './annual-plan.js';

export function renderPlanningView({
  S,
  ui,
  filterOptions,
  allTags,
  areaPageTitle,
  plural,
  today,
  taskCalendar,
  taskWeek,
  weeklyReviewView,
  taskListHtml,
  plansHtml,
}) {
  const filters = ui.filters;
  const annualPlanView = () => renderAnnualPlanView({ S, ui, plural, today });
  return h`${areaPageTitle('planejar', 'Planejar', h`<button type="button" class="btn sm ${ui.planView === 'anual' ? 'primary' : 'ghost'}" data-action="plan-view" data-v="anual">${icon('calendar', 16)}Plano anual</button><button type="button" class="btn sm ${ui.planView === 'anual' ? 'ghost' : 'primary'}" data-action="task-new">${icon('plus', 16)}Nova tarefa</button>`)}
    <section class="card plain" aria-labelledby="mt"><h2 id="mt" class="sr">${ui.planView === 'anual' ? 'Plano anual' : 'Minhas tarefas'}</h2>
      <div class="tabs plan-view-segments" role="tablist" aria-label="Modo de visualização">${[['lista', 'Lista', 'list'], ['calendario', 'Calendário', 'calendar'], ['semana', 'Semana', 'calendarCheck'], ['revisao', 'Revisão', 'chart'], ['anual', 'Plano anual', 'target']].map(([value, label, ic]) => h`<button type="button" class="tab" role="tab" id="plan-tab-${value}" aria-controls="plan-panel" tabindex="${ui.planView === value ? '0' : '-1'}" data-action="plan-view" data-v="${value}" aria-selected="${String(ui.planView === value)}">${icon(ic, 18)}<span>${label}</span></button>`)}</div>
      <div id="plan-panel" role="tabpanel" aria-labelledby="plan-tab-${ui.planView}">${ui.planView === 'anual' ? annualPlanView() : ui.planView === 'calendario' ? taskCalendar() : ui.planView === 'semana' ? taskWeek() : ui.planView === 'revisao' ? weeklyReviewView() : h`<div class="scroll-x" role="group" aria-label="Filtrar tarefas">${filterOptions.map(([key, label]) => h`<button class="chip" aria-pressed="${filters.f === key}" data-action="set-filter" data-f="${key}">${label}</button>`)}${allTags().map((tag) => h`<button class="chip" aria-pressed="${filters.f === 'etq:' + tag}" data-action="set-filter" data-f="${'etq:' + tag}">#${tag}</button>`)}</div>
      <div class="row"><label class="search"><span class="sr">Buscar tarefas</span>${icon('search', 18)}<input type="search" id="q" data-keep value="${filters.q}" placeholder="Buscar tarefas" data-input="search"></label>
        <label class="task-sort-field"><span class="sr">Ordenar</span><select id="sortsel" data-change="sort">${[['prazo', 'Por prazo'], ['prioridade', 'Prioridade'], ['recentes', 'Recentes'], ['manual', 'Manual']].map(([key, label]) => h`<option value="${key}" ${filters.sort === key ? raw('selected') : ''}>${label}</option>`)}</select></label></div>
      <div id="task-results" aria-live="polite" tabindex="-1">${taskListHtml()}</div>`}</div></section>
    ${ui.planView === 'anual' ? '' : plansHtml()}`;
}

export function renderAnnualPlanView({ S, ui, plural, today }) {
  const currentYear = Number(today().slice(0, 4));
  const plans = S.settings.prefs.annualPlans || {};
  const years = [...new Set([
    ...Array.from({ length: Math.max(1, currentYear + 4 - 2026) }, (_, index) => String(2026 + index)),
    ...Object.keys(plans),
  ])].filter((year) => /^\d{4}$/.test(year) && Number(year) >= 2026).sort();
  const year = ui.annualYear;
  const plan = plans[year] || { intention: '', goals: [] };
  const goals = plan.goals || [];
  const completed = goals.filter((goal) => goal.done).length;
  const editing = goals.find((goal) => goal.id === ui.annualEditingGoalId);
  const quarterData = [
    { id: 'q1', title: '1º trimestre', months: 'jan — mar' },
    { id: 'q2', title: '2º trimestre', months: 'abr — jun' },
    { id: 'q3', title: '3º trimestre', months: 'jul — set' },
    { id: 'q4', title: '4º trimestre', months: 'out — dez' },
    { id: '', title: 'Ao longo do ano', months: 'sem data definida' },
  ];
  const goalCard = (goal) => h`<li class="annual-goal${goal.done ? ' is-done' : ''}">
    <button type="button" class="annual-goal-check" data-action="annual-goal-toggle" data-id="${goal.id}" aria-pressed="${goal.done}" aria-label="${goal.done ? 'Reabrir' : 'Marcar como concluída'}: ${goal.title}">${goal.done ? icon('check', 16) : ''}</button>
    <div class="annual-goal-content"><h4>${goal.title}</h4>
      ${goal.action ? h`<p class="annual-goal-first-step"><b>Primeiro passo</b>${goal.action}</p>` : ''}</div>
    <button type="button" class="ibtn" data-action="annual-goal-edit" data-id="${goal.id}" aria-label="Editar conquista: ${goal.title}">${icon('pencil', 17)}</button>
    <button type="button" class="ibtn" data-action="annual-goal-delete" data-id="${goal.id}" aria-label="Excluir conquista: ${goal.title}">${icon('trash', 17)}</button>
  </li>`;
  const ideas = filterAnnualPlanIdeas(ui.annualIdeaCategory, ui.annualIdeaQuery);
  const visibleIdeaIds = new Set(ideas.map((idea) => idea.id));
  const goalForm = (quarter) => h`<form class="annual-goal-form" data-form="annual-goal-save" data-id="${editing?.id || ''}">
    <label class="annual-goal-title-field"><span>Conquista</span><input name="title" type="text" maxlength="${ANNUAL_PLAN_LIMITS.goalTitle}" required placeholder="Ex.: fazer uma viagem especial" value="${editing?.title || ui.annualGoalDraft?.title || ''}"></label>
    <label class="annual-goal-action-field"><span>Primeiro passo <small>(opcional)</small></span><input name="action" type="text" maxlength="${ANNUAL_PLAN_LIMITS.goalAction}" placeholder="Ex.: pesquisar destinos e custos" value="${editing?.action || ui.annualGoalDraft?.action || ''}"></label>
    <label class="annual-goal-quarter-field"><span>Quando?</span><select name="quarter"><option value="">Ao longo do ano</option>${quarterData.slice(0, 4).map(({ id, title }) => h`<option value="${id}" ${quarter === id ? raw('selected') : ''}>${title}</option>`)}</select></label>
    <div class="annual-goal-form-actions"><button type="submit" class="btn primary">${editing ? 'Salvar conquista' : 'Adicionar conquista'}</button><button type="button" class="btn ghost" data-action="annual-goal-edit-cancel">Cancelar</button></div>
  </form>`;
  const activeIdeaFilters = ui.annualIdeaCategory !== 'all' || Boolean(String(ui.annualIdeaQuery || '').trim());
  return h`<section class="annual-planner" aria-labelledby="annual-plan-title">
    <header class="annual-plan-hero">
      <div class="annual-plan-hero-copy"><p class="section-kicker">Seu próximo capítulo</p><h2 id="annual-plan-title">Um ano com intenção.</h2><p>Escolha o que importa e distribua suas conquistas ao longo de ${year}.</p>
        <label class="annual-year-select"><span>Planejando o ano de</span><select data-change="annual-plan-year" aria-label="Ano do plano">${years.map((option) => h`<option value="${option}" ${option === year ? raw('selected') : ''}>${option}</option>`)}</select></label>
      </div>
      <div class="annual-plan-progress-card" aria-label="Resumo das conquistas do ano">
        <span class="annual-plan-progress-ring" style="--annual-progress:${goals.length ? Math.round(completed / goals.length * 100) : 0}%"><b>${goals.length ? `${Math.round(completed / goals.length * 100)}%` : '—'}</b></span>
        <span><b>${goals.length} ${plural(goals.length, 'conquista', 'conquistas')}</b><small>${completed} concluída(s) · ${goals.length - completed} em andamento</small></span>
      </div>
    </header>
    <form class="annual-intention-form" data-form="annual-intention">
      <label for="annual-intention"><span class="annual-intention-label">Sua intenção para ${year}</span><span class="annual-intention-hint">O que você quer sentir, mudar ou priorizar neste ano?</span></label>
      <textarea id="annual-intention" name="intention" rows="2" maxlength="${ANNUAL_PLAN_LIMITS.intention}" placeholder="Ex.: ter mais tempo para mim e para quem amo.">${plan.intention}</textarea>
      <button type="submit" class="btn sm">${plan.intention ? 'Atualizar intenção' : 'Salvar intenção'}</button>
    </form>
    <details class="annual-ideas" id="d-annual-ideas" aria-labelledby="annual-ideas-title" ${ui.openDetails['annual-ideas'] ? raw('open') : ''}>
      <summary class="annual-ideas-summary"><span><b id="annual-ideas-title">Ideias para o seu ano</b><small>Inspirações para escolher no seu ritmo.</small></span><span class="annual-ideas-count">${ANNUAL_PLAN_IDEAS.length}</span>${icon('chevDown', 18, 'annual-ideas-chevron')}</summary>
      <div class="annual-ideas-content">
        <div class="annual-ideas-heading"><p>Escolha uma inspiração para preencher a conquista e o primeiro passo. Você revisa tudo antes de adicionar.</p></div>
        <div class="annual-ideas-controls">
          <label class="annual-ideas-search"><span>Buscar ideias</span><input type="search" data-input="annual-ideas-search" value="${ui.annualIdeaQuery}" placeholder="Ex.: viagem, estudos, descanso"></label>
          <div class="annual-ideas-filter-status"><span class="annual-ideas-result-count" data-annual-ideas-count role="status" aria-live="polite">${ideas.length} ${plural(ideas.length, 'ideia encontrada', 'ideias encontradas')}</span><button type="button" class="btn ghost sm" data-action="annual-ideas-clear" ${activeIdeaFilters ? '' : raw('hidden')}>Limpar busca e filtros</button></div>
        </div>
        <div class="annual-ideas-categories" role="group" aria-label="Filtrar ideias por categoria">
          ${[['all', 'Todas'], ...ANNUAL_PLAN_IDEA_CATEGORIES.map(({ id, label }) => [id, label])].map(([id, label]) => h`<button type="button" class="chip" data-action="annual-idea-category" data-category="${id}" aria-pressed="${String(ui.annualIdeaCategory === id)}">${label}</button>`)}
        </div>
        <div class="annual-ideas-grid">
          ${ANNUAL_PLAN_IDEAS.map((idea) => h`<button type="button" class="annual-idea" data-annual-idea="${idea.id}" data-action="annual-idea-use" data-id="${idea.id}" ${visibleIdeaIds.has(idea.id) ? '' : raw('hidden')}>
            <span class="annual-idea-category">${ANNUAL_PLAN_IDEA_CATEGORIES.find(({ id }) => id === idea.category)?.label || ''}</span>
            <b>${idea.title}</b><span class="annual-idea-first-step"><b>Primeiro passo</b>${idea.action}</span>
            <span class="annual-idea-use">${icon('plus', 15)} Usar esta ideia</span>
          </button>`)}
          <p class="annual-ideas-empty" ${ideas.length ? raw('hidden') : ''}>Nenhuma ideia encontrada. Tente outra busca ou limpe os filtros.</p>
        </div>
      </div>
    </details>
    <div class="annual-roadmap-heading"><div><p class="section-kicker">Seu roteiro</p><h3>O ano, passo a passo</h3></div><p class="small muted">Metas flexíveis: você pode mudar o trimestre quando quiser.</p></div>
    <div class="annual-roadmap">${quarterData.map(({ id, title, months }) => {
      const quarterGoals = goals.filter((goal) => goal.quarter === id);
      const quarterCompleted = quarterGoals.filter((goal) => goal.done).length;
      const isEditingHere = ui.annualGoalFormOpen && ui.annualGoalQuarter === id;
      return h`<section class="annual-quarter${isEditingHere ? ' is-editing' : ''}" data-quarter="${id}" aria-labelledby="annual-${id || 'year'}-title">
        <header class="annual-quarter-heading"><div><span class="annual-quarter-marker">${id ? id.toUpperCase() : icon('calendar', 16)}</span><div><h4 id="annual-${id || 'year'}-title">${title}</h4><small>${months}</small></div></div><span class="annual-quarter-count">${quarterCompleted}/${quarterGoals.length}</span></header>
        ${quarterGoals.length ? h`<ul class="annual-goal-list">${quarterGoals.map(goalCard)}</ul>` : h`<p class="annual-quarter-empty">${id ? 'Ainda sem conquistas para este período.' : 'Conquistas sem uma data específica ficam aqui.'}</p>`}
        ${isEditingHere ? goalForm(id) : h`<button type="button" class="annual-add-goal" data-action="annual-goal-add" data-quarter="${id}" aria-label="Adicionar conquista: ${title}">${icon('plus', 16)}Adicionar conquista</button>`}
      </section>`;
    })}</div>
  </section>`;
}

export function renderTaskCalendar({
  S,
  ui,
  weekStartDay,
  today,
  connectedGoogleCalendarAccounts,
  cap,
  ymLabel,
  taskRow,
  empty,
  googleCalendarPlanPanel,
}) {
  const ym = ui.taskCal, [y, m] = ym.split('-').map(Number), ws = weekStartDay(), first = new Date(y, m - 1, 1), n = new Date(y, m, 0).getDate(), tdy = today();
  const eventsByDay = new Map();
  connectedGoogleCalendarAccounts().forEach((account) => account.events.forEach((event) => {
    const dayEvents = eventsByDay.get(event.day) || [];
    dayEvents.push(event);
    eventsByDay.set(event.day, dayEvents);
  }));
  const weekdays = Array.from({ length: 7 }, (_, index) => DIAS[(ws + index) % 7]);
  const by = {};
  S.tasks.forEach((task) => {
    if (task.dueDate && task.dueDate.startsWith(ym) && !(task.done && ui.filters.f === 'pendentes')) {
      (by[task.dueDate] = by[task.dueDate] || []).push(task);
    }
  });
  const cells = [];
  for (let index = 0; index < (first.getDay() + 7 - ws) % 7; index++) cells.push('<span></span>');
  for (let dayNumber = 1; dayNumber <= n; dayNumber++) {
    const key = `${ym}-${pad(dayNumber)}`;
    const tasks = by[key] || [];
    const pending = tasks.filter((task) => !task.done);
    const dayEvents = eventsByDay.get(key) || [];
    const labels = [
      `${pending.length} ${pending.length === 1 ? 'tarefa pendente' : 'tarefas pendentes'}`,
      ...(dayEvents.length ? [`${dayEvents.length} ${dayEvents.length === 1 ? 'evento' : 'eventos'} das agendas conectadas`] : []),
    ];
    const markers = [
      pending.length ? '<u class="has-tasks"></u>'.repeat(Math.min(pending.length, 3)) : tasks.length ? '<u class="dn"></u>' : '',
      dayEvents.length ? '<u class="google-event-dot"></u>' : '',
    ].join('');
    cells.push(`<button type="button" class="tc ${key === tdy ? 't' : ''} ${key === ui.taskDay ? 's' : ''} ${pending.some((task) => key < task.dueDate) ? 'od' : ''}" data-action="tcal-day" data-d="${key}" aria-label="${dayNumber} de ${MESES_L[m - 1]}, ${labels.join(', ')}"><b>${dayNumber}</b><i>${markers}</i></button>`);
  }
  const day = S.tasks.filter((task) => task.dueDate === ui.taskDay)
    .sort((a, b) => a.done - b.done || (a.time || '99:99').localeCompare(b.time || '99:99'));
  const selectedEvents = eventsByDay.get(ui.taskDay) || [];
  const connectedAccounts = connectedGoogleCalendarAccounts();
  return h`<div class="tcal-wrap"><div class="mnav"><button class="ibtn" data-action="tcal-month" data-n="-1" aria-label="Mês anterior">${icon('chevLeft', 20)}</button><b>${cap(ymLabel(ym))}</b><button class="ibtn" data-action="tcal-month" data-n="1" aria-label="Próximo mês">${icon('chevRight', 20)}</button></div>
    ${googleCalendarPlanPanel()}
    <div class="tcal" role="group" aria-label="Calendário de tarefas e eventos das agendas conectadas">${weekdays.map((weekday) => h`<em>${weekday}</em>`)}${raw(cells.join(''))}</div></div>
    ${connectedAccounts.length ? h`<section class="card google-calendar-day" aria-labelledby="google-calendar-day-title">
      <div class="head"><h3 id="google-calendar-day-title">Eventos · ${cap(longDate(ui.taskDay))}</h3><span class="badge">Somente leitura</span></div>
      ${selectedEvents.length
        ? h`<ul class="google-calendar-events">${selectedEvents.map((event) => h`<li><time>${event.time}</time><span class="grow"><b>${event.title}</b><small>${event.calendarName} · ${event.accountLabel}</small></span></li>`)}</ul>`
        : h`<p class="small muted">Nenhum evento das agendas conectadas neste dia.</p>`}
    </section>` : ''}
    <section class="card"><div class="head"><h3>${ui.taskDay === tdy ? 'Hoje' : cap(longDate(ui.taskDay))}</h3><span class="small muted">${day.filter((task) => !task.done).length} pendente(s)</span></div>
      ${day.length ? h`<ul class="list">${day.map(taskRow)}</ul><button type="button" class="btn sm" data-action="task-new" data-due="${ui.taskDay}">${icon('plus', 16)}Adicionar tarefa neste dia</button>` : empty('Dia livre', 'Nada marcado para este dia.', h`<button type="button" class="btn primary" data-action="task-new" data-due="${ui.taskDay}">${icon('plus', 16)}Adicionar tarefa neste dia</button>`, 'calendarCheck')}</section>`;
}

export function renderTaskWeek({ S, ui, weekStartDay, today, cap, taskRow, empty }) {
  const days = weekDays(ui.taskWeek, weekStartDay());
  const entries = tasksForWeek(S.tasks, days);
  const first = pk(days[0]), last = pk(days[6]);
  const label = first.getMonth() === last.getMonth()
    ? `${first.getDate()}–${last.getDate()} ${MESES_L[last.getMonth()]} ${last.getFullYear()}`
    : `${shortDate(days[0])}–${shortDate(days[6])}`;
  return h`<div class="week-planner">
    <div class="mnav"><button class="ibtn" data-action="tweek-nav" data-n="-1" aria-label="Semana anterior">${icon('chevLeft', 20)}</button><b>${label}</b><button class="ibtn" data-action="tweek-nav" data-n="1" aria-label="Próxima semana">${icon('chevRight', 20)}</button><button class="btn sm" data-action="tweek-today">Esta semana</button></div>
    <div class="week-days">${entries.map(({ day, tasks }) => h`<section class="week-day${day === today() ? ' is-today' : ''}" aria-labelledby="week-${day}">
      <div class="head"><h3 id="week-${day}">${cap(DIAS[pk(day).getDay()])} <span>${shortDate(day)}</span>${day === today() ? h` <span class="badge">Hoje</span>` : ''}</h3><span class="small muted">${tasks.filter((task) => !task.done).length} pendente(s)</span></div>
      ${tasks.length ? h`<ul class="list">${tasks.map(taskRow)}</ul><button type="button" class="btn ghost sm" data-action="week-add" data-d="${day}">${icon('plus', 15)}Adicionar tarefa</button>` : empty('Dia livre', 'Nada marcado.', h`<button type="button" class="btn primary" data-action="week-add" data-d="${day}">Adicionar tarefa</button>`, 'calendarCheck')}
    </section>`)}</div>
  </div>`;
}

export function renderGoogleCalendarPlanPanel(accounts) {
  return h`<section class="card google-calendar-panel" aria-labelledby="google-calendar-title">
    <div class="head"><div><h3 id="google-calendar-title">Agendas conectadas</h3><span class="badge">Somente leitura</span></div><a class="btn sm" href="/config?section=calendars">Gerenciar agendas</a></div>
    <p class="small muted">${accounts.length
      ? `${accounts.length} ${accounts.length === 1 ? 'conta Google conectada' : 'contas Google conectadas'}. Os eventos ficam disponíveis junto às tarefas enquanto esta aba estiver aberta.`
      : 'Conecte uma ou mais contas Google em Ajustes para ver os eventos junto às suas tarefas.'}</p>
  </section>`;
}

export function renderPlansView(tasks) {
  const groups = {};
  tasks.forEach((task) => {
    if (task.groupId) {
      (groups[task.groupId] ||= { title: task.groupTitle, items: [] }).items.push(task);
    }
  });
  const plans = Object.entries(groups);
  if (!plans.length) return '';
  return h`<section class="card"><h2>Planos<i>.</i></h2><ul class="list">${plans.map(([id, plan]) => {
    const done = plan.items.filter((task) => task.done).length;
    const percent = Math.round(done / plan.items.length * 100);
    return h`<li><div class="grow"><div class="ttl">${plan.title}</div><div class="bar plan-progress" role="progressbar" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100" aria-label="Progresso de ${plan.title}"><span style="width:${percent}%"></span></div><span class="small muted">${done} de ${plan.items.length} concluídas</span></div><button class="ibtn" data-action="del-plan" data-id="${id}" aria-label="Excluir plano ${plan.title}">${icon('trash', 18)}</button></li>`;
  })}</ul></section>`;
}
