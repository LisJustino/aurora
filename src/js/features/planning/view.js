import { h, raw } from '../../utils/dom.js';
import { icon } from '../../utils/icons.js';
import { emptyState } from '../../utils/empty-state.js';
import { DIAS, longDate, MESES_L, pad, pk, shortDate } from '../../utils/dates.js';
import { tasksForWeek, weekDays } from './week.js';
import { agendaLabel, agendaMarker } from './agenda.js';
import { DEFAULT_HABIT_TARGET, HABIT_TARGETS, MAX_COUNT_TARGET, yearBalance } from './goal-progress.js';
import { routePathFor } from '../../core/router.js';
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
}) {
  const filters = ui.filters;
  const annualPlanView = () => renderAnnualPlanView({ S, ui, plural, today });
  const views = [
    ['lista', 'Tarefas', 'list'],
    ['anual', 'Plano anual', 'target'],
    ['calendario', 'Calendário', 'calendar'],
    ['revisao', 'Revisão', 'chart'],
  ];
  const planView = ui.planView === 'semana' ? 'calendario' : ui.planView;
  const activeView = views.find(([value]) => value === planView) || views[0];
  return h`${areaPageTitle(
    'planejar',
    'Planejar',
    h`<button type="button" class="btn sm"
    data-action="task-bulk">${icon('list', 16)}Várias</button><button type="button" class="btn sm primary"
    data-action="task-new">${icon('plus', 16)}Nova tarefa</button>`,
  )}
    <section class="surface-open plain" aria-labelledby="mt"><h2 id="mt" class="sr">${activeView[1]}</h2>
      <div class="tabs plan-view-segments" role="tablist"
        aria-label="Visualizações do Planejar">${views.map(
          ([value, label, ic]) => h`<button type="button" class="tab"
        role="tab" id="plan-tab-${value}" aria-controls="plan-panel" tabindex="${planView === value ? '0' : '-1'}"
        data-action="plan-view" data-v="${value}"
        aria-selected="${String(planView === value)}">${icon(ic, 18)}<span>${label}</span></button>`,
        )}</div>
      <div id="plan-panel" role="tabpanel" aria-labelledby="plan-tab-${activeView[0]}">${
        planView === 'anual'
          ? annualPlanView()
          : planView === 'calendario'
            ? taskCalendar()
            : planView === 'revisao'
              ? weeklyReviewView()
              : h`<div class="scroll-x" role="group"
                aria-label="Filtrar tarefas">${filterOptions.map(
                  ([key, label]) => h`<button class="chip"
                aria-pressed="${filters.f === key}" data-action="set-filter"
                data-f="${key}">${label}</button>`,
                )}${allTags().map(
                  (tag) => h`<button class="chip"
                aria-pressed="${filters.f === 'etq:' + tag}" data-action="set-filter"
                data-f="${'etq:' + tag}">#${tag}</button>`,
                )}</div>
      <div class="row"><label class="search"><span class="sr">Buscar tarefas</span>${icon('search', 18)}<input
        type="search" id="q" data-keep value="${filters.q}" placeholder="Buscar tarefas" data-input="search"></label>
        <label class="task-sort-field"><span class="sr">Ordenar</span><select id="sortsel" data-change="sort">${[
          ['prazo', 'Por prazo'],
          ['prioridade', 'Prioridade'],
          ['recentes', 'Recentes'],
          ['manual', 'Manual'],
        ].map(
          ([key, label]) => h`<option value="${key}" ${filters.sort === key ? raw('selected') : ''}>${label}</option>`,
        )}</select></label></div>
      <div id="task-results" aria-live="polite" tabindex="-1">${taskListHtml()}</div>`
      }</div></section>`;
}
export function renderAnnualPlanView({ S, ui, plural, today }) {
  const currentYear = Number(today().slice(0, 4));
  const plans = S.settings.prefs.annualPlans || {};
  const years = [
    ...new Set([
      ...Array.from({ length: Math.max(1, currentYear + 4 - 2026) }, (_, index) => String(2026 + index)),
      ...Object.keys(plans),
    ]),
  ]
    .filter((year) => /^\d{4}$/.test(year) && Number(year) >= 2026)
    .sort();
  const year = ui.annualYear;
  const plan = plans[year] || { intention: '', goals: [] };
  const goals = plan.goals || [];
  const balance = yearBalance(goals, { today: today(), year, habits: S.habits });
  const progressOf = new Map(balance.items.map(({ goal, progress }) => [goal.id, progress]));
  const completed = balance.kept;
  const editing = goals.find((goal) => goal.id === ui.annualEditingGoalId);
  const quarterData = [
    { id: 'q1', title: '1º trimestre', months: 'jan — mar' },
    { id: 'q2', title: '2º trimestre', months: 'abr — jun' },
    { id: 'q3', title: '3º trimestre', months: 'jul — set' },
    { id: 'q4', title: '4º trimestre', months: 'out — dez' },
    { id: '', title: 'Ao longo do ano', months: 'sem data definida' },
  ];
  const STATUS_LABEL = {
    done: 'Cumprida',
    'on-track': 'No ritmo',
    behind: 'Atrasada',
    missed: 'Não cumprida',
    open: 'Em aberto',
  };
  const goalCard = (goal) => {
    const linkedTask = S.tasks.find((task) => task.id === goal.taskId);
    const progress = progressOf.get(goal.id);
    const isDone = progress.status === 'done';
    return h`<li class="annual-goal${isDone ? ' is-done' : ''}">
      <button type="button" class="annual-goal-check" data-action="annual-goal-toggle" data-id="${goal.id}"
        aria-pressed="${goal.done}"
        aria-label="${goal.done ? 'Reabrir' : 'Marcar como concluída'}: ${goal.title}">${isDone ? icon('check', 16) : ''}</button>
      <div class="annual-goal-content"><h4>${goal.title}</h4>
        <p class="annual-goal-status is-${progress.status}"><b>${STATUS_LABEL[progress.status]}</b>${progress.detail ? ` · ${progress.detail}` : ''}</p>
        ${
          progress.pct !== null
            ? h`<progress class="annual-goal-bar is-${progress.status}" value="${progress.pct}"
          max="100" aria-label="Andamento de ${goal.title}"></progress>`
            : ''
        }
        ${
          goal.track?.kind === 'count'
            ? h`<div class="annual-goal-counter" role="group"
          aria-label="Contar: ${goal.title}"><button type="button" class="btn sm" data-action="annual-goal-count"
          data-id="${goal.id}" data-n="-1" aria-label="Diminuir um">−1</button><button type="button"
          class="btn sm primary" data-action="annual-goal-count" data-id="${goal.id}" data-n="1"
          aria-label="Somar um">+1</button></div>`
            : ''
        }
        ${goal.action ? h`<p class="annual-goal-first-step"><b>Primeiro passo</b>${goal.action}</p>` : ''}
        <button type="button" class="btn ghost sm" data-action="annual-goal-task"
          data-id="${goal.id}">${linkedTask ? 'Abrir tarefa relacionada' : goal.action ? 'Criar tarefa do primeiro passo' : 'Criar tarefa para esta conquista'}</button>
      </div>
      <button type="button" class="ibtn" data-action="annual-goal-edit" data-id="${goal.id}"
        aria-label="Editar conquista: ${goal.title}">${icon('pencil', 17)}</button>
      <button type="button" class="ibtn" data-action="annual-goal-delete" data-id="${goal.id}"
        aria-label="Excluir conquista: ${goal.title}">${icon('trash', 17)}</button>
    </li>`;
  };
  const ideas = filterAnnualPlanIdeas(ui.annualIdeaCategory, ui.annualIdeaQuery);
  const visibleIdeaIds = new Set(ideas.map((idea) => idea.id));
  const goalForm = (
    quarter,
  ) => h`<form class="annual-goal-form" data-form="annual-goal-save" data-id="${editing?.id || ''}">
    <label class="annual-goal-title-field"><span>Conquista</span><input name="title" type="text"
      maxlength="${ANNUAL_PLAN_LIMITS.goalTitle}" required placeholder="Ex.: fazer uma viagem especial"
      value="${editing?.title || ui.annualGoalDraft?.title || ''}"></label>
    <label class="annual-goal-action-field"><span>Primeiro passo <small>(opcional)</small></span><input name="action"
      type="text" maxlength="${ANNUAL_PLAN_LIMITS.goalAction}" placeholder="Ex.: pesquisar destinos e custos"
      value="${editing?.action || ui.annualGoalDraft?.action || ''}"></label>
    <label class="annual-goal-track-field"><span>Acompanhar um hábito <small>(opcional)</small></span><select
      name="habitId"><option
      value="">Não, vou marcar sozinha</option>${S.habits
        .filter((habit) => (habit.status || 'active') !== 'archived')
        .map(
          (habit) => h`<option
      value="${habit.id}" ${editing?.track?.kind === 'habit' && editing.track.habitId === habit.id ? raw('selected') : ''}>${habit.name}</option>`,
        )}</select></label>
    <label class="annual-goal-track-field"><span>Meta do hábito</span><select
      name="targetPct">${HABIT_TARGETS.map(
        (value) => h`<option
      value="${value}" ${(editing?.track?.kind === 'habit' ? editing.track.targetPct : DEFAULT_HABIT_TARGET) === value ? raw('selected') : ''}>${value === 100 ? 'Todos os dias programados' : `${value}% dos dias programados`}</option>`,
      )}</select></label>
    <label class="annual-goal-track-field"><span>Ou contar até <small>(ex.: 12 livros)</small></span><input
      name="countTarget" type="number" inputmode="numeric" min="1" max="${MAX_COUNT_TARGET}" step="1"
      placeholder="Sem contagem" value="${editing?.track?.kind === 'count' ? editing.track.target : ''}"></label>
    <label class="annual-goal-quarter-field"><span>Quando?</span><select name="quarter"><option
      value="">Ao longo do ano</option>${quarterData.slice(0, 4).map(
        ({ id, title }) => h`<option
      value="${id}" ${quarter === id ? raw('selected') : ''}>${title}</option>`,
      )}</select></label>
    <div class="annual-goal-form-actions"><button type="submit"
      class="btn primary">${editing ? 'Salvar conquista' : 'Adicionar conquista'}</button><button type="button"
      class="btn ghost" data-action="annual-goal-edit-cancel">Cancelar</button></div>
  </form>`;
  const activeIdeaFilters = ui.annualIdeaCategory !== 'all' || Boolean(String(ui.annualIdeaQuery || '').trim());
  return h`<section class="annual-planner" aria-labelledby="annual-plan-title">
    <header class="annual-plan-hero">
      <div class="annual-plan-hero-copy"><p class="section-kicker">Seu próximo capítulo</p><h2
        id="annual-plan-title">Um ano com intenção.</h2><p>Defina conquistas, distribua por trimestre e acompanhe cada passo com tarefas ou hábitos.</p>
        <label class="annual-year-select"><span>Planejando o ano de</span><select data-change="annual-plan-year"
          aria-label="Ano do plano">${years.map(
            (option) => h`<option
          value="${option}" ${option === year ? raw('selected') : ''}>${option}</option>`,
          )}</select></label>
      </div>
      <div class="annual-plan-progress-card" aria-label="Resumo das conquistas do ano">
        <span class="annual-plan-progress-ring"
          style="--annual-progress:${goals.length ? Math.round((completed / goals.length) * 100) : 0}%"><b>${goals.length ? `${Math.round((completed / goals.length) * 100)}%` : '—'}</b></span>
        <span><b>${goals.length} ${plural(goals.length, 'conquista', 'conquistas')}</b><small>${balance.ended ? `Você cumpriu ${completed} de ${goals.length}` : `${completed} cumprida(s) · ${balance.counts['on-track']} no ritmo · ${balance.counts.behind} atrasada(s)`}</small></span>
      </div>
    </header>
    ${
      goals.length
        ? h`<section class="annual-balance${balance.ended ? ' is-final' : ''}" aria-labelledby="annual-balance-title">
      <p class="section-kicker">${balance.ended ? `Balanço de ${year}` : `Como ${year} está indo`}</p>
      <h3 id="annual-balance-title">${
        balance.ended
          ? completed === goals.length
            ? 'Você cumpriu tudo o que prometeu.'
            : `Você cumpriu ${completed} de ${goals.length} ${plural(goals.length, 'promessa', 'promessas')}.`
          : balance.counts.behind || balance.counts.missed
            ? `${balance.counts.behind} ${plural(balance.counts.behind, 'conquista pede', 'conquistas pedem')} atenção.`
            : 'Tudo no ritmo até agora.'
      }</h3>
      <ul class="annual-balance-list">${balance.items
        .filter(({ progress }) => balance.ended || progress.status === 'behind' || progress.status === 'missed')
        .map(
          ({ goal, progress }) => h`<li
        class="is-${progress.status}"><b>${goal.title}</b><span>${STATUS_LABEL[progress.status]}${progress.detail ? ` · ${progress.detail}` : ''}</span></li>`,
        )}</ul>
    </section>`
        : ''
    }
    <form class="annual-intention-form" data-form="annual-intention">
      <label for="annual-intention"><span class="annual-intention-label">Sua intenção para ${year}</span><span
        class="annual-intention-hint">O que você quer sentir, mudar ou priorizar neste ano?</span></label>
      <textarea id="annual-intention" name="intention" rows="2" maxlength="${ANNUAL_PLAN_LIMITS.intention}"
        placeholder="Ex.: ter mais tempo para mim e para quem amo.">${plan.intention}</textarea>
      <button type="submit" class="btn sm">${plan.intention ? 'Atualizar intenção' : 'Salvar intenção'}</button>
    </form>
    <details class="annual-ideas" id="d-annual-ideas"
      aria-labelledby="annual-ideas-title" ${ui.openDetails['annual-ideas'] ? raw('open') : ''}>
      <summary class="annual-ideas-summary"><span><b
        id="annual-ideas-title">Ideias para o seu ano</b><small>Sugestões para você escolher.</small></span><span
        class="annual-ideas-count">${ANNUAL_PLAN_IDEAS.length}</span>${icon('chevDown', 18, 'annual-ideas-chevron')}</summary>
      <div class="annual-ideas-content">
        <div class="annual-ideas-heading"><p>Escolha uma inspiração para preencher a conquista e o primeiro passo. Você revisa tudo antes de adicionar.</p></div>
        <div class="annual-ideas-controls">
          <label class="annual-ideas-search"><span>Buscar ideias</span><input type="search"
            data-input="annual-ideas-search" value="${ui.annualIdeaQuery}"
            placeholder="Ex.: viagem, estudos, descanso"></label>
          <div class="annual-ideas-filter-status"><span class="annual-ideas-result-count" data-annual-ideas-count
            role="status"
            aria-live="polite">${ideas.length} ${plural(ideas.length, 'ideia encontrada', 'ideias encontradas')}</span><button
            type="button" class="btn ghost sm"
            data-action="annual-ideas-clear" ${activeIdeaFilters && ideas.length ? '' : raw('hidden')}>Limpar busca e filtros</button></div>
        </div>
        <div class="annual-ideas-categories" role="group" aria-label="Filtrar ideias por categoria">
          ${[['all', 'Todas'], ...ANNUAL_PLAN_IDEA_CATEGORIES.map(({ id, label }) => [id, label])].map(
            ([id, label]) => h`<button
            type="button" class="chip" data-action="annual-idea-category" data-category="${id}"
            aria-pressed="${String(ui.annualIdeaCategory === id)}">${label}</button>`,
          )}
        </div>
        <div class="annual-ideas-grid">
          ${ANNUAL_PLAN_IDEAS.map(
            (
              idea,
            ) => h`<button type="button" class="annual-idea" data-annual-idea="${idea.id}" data-action="annual-idea-use"
              data-id="${idea.id}" ${visibleIdeaIds.has(idea.id) ? '' : raw('hidden')}>
            <span class="annual-idea-category">${ANNUAL_PLAN_IDEA_CATEGORIES.find(({ id }) => id === idea.category)?.label || ''}</span>
            <b>${idea.title}</b><span class="annual-idea-first-step"><b>Primeiro passo</b>${idea.action}</span>
            <span class="annual-idea-use">${icon('plus', 15)} Usar esta ideia</span>
          </button>`,
          )}
          ${emptyState({
            title: 'Nenhuma ideia encontrada.',
            description: 'Tente outra palavra ou limpe os filtros para ver outras inspirações.',
            action: h`<button type="button" class="btn primary"
              data-action="annual-ideas-clear">Limpar filtros</button>`,
            iconName: 'search',
            headingLevel: 'h4',
            className: 'annual-ideas-empty',
            hidden: ideas.length > 0,
          })}
        </div>
      </div>
    </details>
    <div class="annual-roadmap-heading"><div><p
      class="section-kicker">Seu roteiro</p><h3>O ano, passo a passo</h3></div><p
      class="small muted">Metas flexíveis: você pode mudar o trimestre quando quiser.</p></div>
    <div class="annual-roadmap">${quarterData.map(({ id, title, months }) => {
      const quarterGoals = goals.filter((goal) => goal.quarter === id);
      const quarterCompleted = quarterGoals.filter((goal) => goal.done).length;
      const isEditingHere = ui.annualGoalFormOpen && ui.annualGoalQuarter === id;
      return h`<section class="annual-quarter${isEditingHere ? ' is-editing' : ''}" data-quarter="${id}"
        aria-labelledby="annual-${id || 'year'}-title">
        <header class="annual-quarter-heading"><div><span
          class="annual-quarter-marker">${id ? id.toUpperCase() : icon('calendar', 16)}</span><div><h4
          id="annual-${id || 'year'}-title">${title}</h4><small>${months}</small></div></div><span
          class="annual-quarter-count">${quarterCompleted}/${quarterGoals.length}</span></header>
        ${
          quarterGoals.length
            ? h`<ul class="annual-goal-list">${quarterGoals.map(goalCard)}</ul>`
            : isEditingHere
              ? ''
              : emptyState({
                  title: id ? 'Ainda sem conquistas neste período.' : 'Sem conquistas sem data.',
                  description: 'Você pode escolher um passo pequeno ou deixar este espaço em aberto.',
                  action: h`<button type="button" class="btn primary" data-action="annual-goal-add"
                    data-quarter="${id}">Adicionar conquista</button>`,
                  iconName: 'target',
                  headingLevel: 'h5',
                  className: 'annual-quarter-empty',
                })
        }
        ${
          isEditingHere
            ? goalForm(id)
            : quarterGoals.length
              ? h`<button type="button" class="annual-add-goal"
          data-action="annual-goal-add" data-quarter="${id}"
          aria-label="Adicionar conquista: ${title}">${icon('plus', 16)}Adicionar conquista</button>`
              : ''
        }
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
  googleCalendarPlanPanel,
  calendarEventTaskKey,
  agendaForMonth = () => ({}),
}) {
  const ym = ui.taskCal,
    [y, m] = ym.split('-').map(Number),
    ws = weekStartDay(),
    first = new Date(y, m - 1, 1),
    n = new Date(y, m, 0).getDate(),
    tdy = today();
  const eventsByDay = new Map();
  connectedGoogleCalendarAccounts().forEach((account) =>
    account.events.forEach((event) => {
      const dayEvents = eventsByDay.get(event.day) || [];
      const eventIdentity = event.accountIdentity || account.identity;
      const key =
        eventIdentity && event.calendarId && event.id
          ? `${eventIdentity}:${event.calendarId}:${event.id}`
          : `${event.title}:${event.day}:${event.time}`;
      if (
        !dayEvents.some((existing) => {
          const existingIdentity = existing.accountIdentity || account.identity;
          const existingKey =
            existingIdentity && existing.calendarId && existing.id
              ? `${existingIdentity}:${existing.calendarId}:${existing.id}`
              : `${existing.title}:${existing.day}:${existing.time}`;
          return existingKey === key;
        })
      )
        dayEvents.push(event);
      eventsByDay.set(event.day, dayEvents);
    }),
  );
  const weekdays = Array.from({ length: 7 }, (_, index) => DIAS[(ws + index) % 7]);
  const by = {};
  S.tasks.forEach((task) => {
    if (task.dueDate && task.dueDate.startsWith(ym) && !(task.done && ui.filters.f === 'pendentes')) {
      (by[task.dueDate] = by[task.dueDate] || []).push(task);
    }
  });
  const agenda = agendaForMonth(ym);
  const cells = [];
  for (let index = 0; index < (first.getDay() + 7 - ws) % 7; index++) cells.push('<span></span>');
  for (let dayNumber = 1; dayNumber <= n; dayNumber++) {
    const key = `${ym}-${pad(dayNumber)}`;
    const tasks = by[key] || [];
    const pending = tasks.filter((task) => !task.done);
    const dayEvents = eventsByDay.get(key) || [];
    const labels = [
      `${pending.length} ${pending.length === 1 ? 'tarefa pendente' : 'tarefas pendentes'}`,
      ...(dayEvents.length
        ? [`${dayEvents.length} ${dayEvents.length === 1 ? 'evento' : 'eventos'} das agendas conectadas`]
        : []),
      ...agendaLabel(agenda[key] || []),
    ];
    const markers = [
      pending.length
        ? '<u class="has-tasks"></u>'.repeat(Math.min(pending.length, 3))
        : tasks.length
          ? '<u class="dn"></u>'
          : '',
      dayEvents.length ? '<u class="google-event-dot"></u>' : '',
      agendaMarker(agenda[key] || []),
    ].join('');
    cells.push(
      `<button type="button"
        class="tc ${key === tdy ? 't' : ''} ${key === ui.taskDay ? 's' : ''} ${key < tdy && pending.length ? 'od' : ''}"
        data-action="tcal-day" data-d="${key}"
        aria-label="${dayNumber} de ${MESES_L[m - 1]}, ${labels.join(', ')}"><b>${dayNumber}</b><i>${markers}</i></button>`,
    );
  }
  while (cells.length % 7 !== 0) cells.push('<span></span>');
  const day = S.tasks
    .filter((task) => task.dueDate === ui.taskDay && !String(task.groupId || '').startsWith('google-calendar:'))
    .sort((a, b) => a.done - b.done || (a.time || '99:99').localeCompare(b.time || '99:99'));
  const selectedEvents = eventsByDay.get(ui.taskDay) || [];
  const connectedAccounts = connectedGoogleCalendarAccounts();
  const eventSourceLabel = (event) =>
    event.calendarName === event.accountLabel
      ? event.calendarName || 'Google Calendar'
      : event.calendarName && event.accountLabel
        ? `${event.calendarName} · ${event.accountLabel}`
        : event.calendarName || event.accountLabel || 'Google Calendar';
  return h`<div class="tcal-wrap"><div class="mnav"><button class="ibtn" data-action="tcal-month" data-n="-1"
    aria-label="Mês anterior">${icon('chevLeft', 20)}</button><b>${cap(ymLabel(ym))}</b><button class="ibtn"
    data-action="tcal-month" data-n="1" aria-label="Próximo mês">${icon('chevRight', 20)}</button></div>
    ${googleCalendarPlanPanel()}
    <div class="tcal" role="group"
      aria-label="Calendário de tarefas, contas, ciclo e eventos das agendas conectadas">${weekdays.map((weekday) => h`<em>${weekday}</em>`)}${raw(cells.join(''))}</div></div>
    ${
      connectedAccounts.length
        ? h`<section class="surface-open google-calendar-day" aria-labelledby="google-calendar-day-title">
      <div class="head"><h3 id="google-calendar-day-title">Eventos · ${cap(longDate(ui.taskDay))}</h3><span
        class="badge">Ações locais</span></div>
      ${
        selectedEvents.length
          ? h`<ul class="google-calendar-events">${selectedEvents.map((event) => {
              const key = calendarEventTaskKey(event);
              const task = key ? S.tasks.find((item) => item.groupId === key) : null;
              const done = task?.done === true;
              return h`<li><time>${event.time}</time><button type="button" class="chk google-calendar-event-check"
                role="checkbox" aria-checked="${String(done)}"
                aria-label="${done ? 'Reabrir tarefa criada do evento' : 'Marcar evento como concluído'}: ${event.title}"
                data-action="google-calendar-event-toggle" data-event-key="${key}" data-event-title="${event.title}"
                data-event-day="${event.day}" data-event-time="${event.allDay ? '' : event.time}"
                data-calendar-name="${event.calendarName}"
                data-account-label="${event.accountLabel}"><span>${icon('check', 15)}</span></button><span
                class="grow"><b>${event.title}</b><small>${eventSourceLabel(event)}</small></span></li>`;
            })}</ul>`
          : emptyState({
              title: 'Nenhum evento neste dia.',
              description: 'Você pode conferir as agendas conectadas ou escolher outra data.',
              action: h`<a class="btn primary"
                href="${routePathFor('config?section=calendars')}">Gerenciar agendas</a>`,
              iconName: 'calendar',
              headingLevel: 'h4',
              className: 'google-calendar-day-empty',
            })
      }
    </section>`
        : ''
    }
    ${
      (agenda[ui.taskDay] || []).length
        ? h`<section class="surface-open agenda-day" aria-labelledby="agenda-day-title">
      <div class="head"><h3 id="agenda-day-title">Contas e ciclo · ${cap(longDate(ui.taskDay))}</h3></div>
      <ul class="agenda-day-list">${agenda[ui.taskDay].map(
        (item) => h`<li class="agenda-${item.kind}"><span
        class="agenda-day-icon">${icon(item.kind === 'cycle' ? 'heart' : 'wallet', 16)}</span><span
        class="grow">${item.label}</span>${item.amount ? h`<b>${item.amount}</b>` : ''}</li>`,
      )}</ul>
    </section>`
        : ''
    }
    <section class="card"><div class="head"><h3>${ui.taskDay === tdy ? 'Hoje' : cap(longDate(ui.taskDay))}</h3><span
      class="small muted">${day.filter((task) => !task.done).length} pendente(s)</span></div>
      ${
        day.length
          ? h`<ul class="list">${day.map(taskRow)}</ul><button type="button" class="btn sm" data-action="task-new"
            data-due="${ui.taskDay}">${icon('plus', 16)}Adicionar tarefa neste dia</button>`
          : emptyState({
              title: 'Dia livre.',
              description: 'Nada marcado para este dia. Você pode adicionar uma tarefa se fizer sentido.',
              action: h`<button type="button" class="btn primary" data-action="task-new"
                data-due="${ui.taskDay}">${icon('plus', 16)}Adicionar tarefa neste dia</button>`,
              iconName: 'calendarCheck',
              headingLevel: 'h4',
            })
      }</section>`;
}

export function renderTaskWeek({ S, ui, weekStartDay, today, cap, taskRow }) {
  const days = weekDays(ui.taskWeek, weekStartDay());
  const entries = tasksForWeek(
    S.tasks.filter((task) => !String(task.groupId || '').startsWith('google-calendar:')),
    days,
  );
  const first = pk(days[0]),
    last = pk(days[6]);
  const label =
    first.getMonth() === last.getMonth()
      ? `${first.getDate()}–${last.getDate()} ${MESES_L[last.getMonth()]} ${last.getFullYear()}`
      : `${shortDate(days[0])}–${shortDate(days[6])}`;
  return h`<div class="week-planner">
    <div class="mnav"><button class="ibtn" data-action="tweek-nav" data-n="-1"
      aria-label="Semana anterior">${icon('chevLeft', 20)}</button><b>${label}</b><button class="ibtn"
      data-action="tweek-nav" data-n="1" aria-label="Próxima semana">${icon('chevRight', 20)}</button><button
      class="btn sm" data-action="tweek-today">Esta semana</button></div>
    <div class="week-days">${entries.map(
      ({
        day,
        tasks,
      }) => h`<section class="week-day${day === today() ? ' is-today' : ''}" aria-labelledby="week-${day}">
      <div class="head"><h3
        id="week-${day}">${cap(DIAS[pk(day).getDay()])} <span>${shortDate(day)}</span>${
          day === today()
            ? h` <span
        class="badge">Hoje</span>`
            : ''
        }</h3><span
        class="small muted">${tasks.filter((task) => !task.done).length} pendente(s)</span></div>
      ${
        tasks.length
          ? h`<ul class="list">${tasks.map(taskRow)}</ul><button type="button" class="btn ghost sm"
        data-action="week-add" data-d="${day}">${icon('plus', 15)}Adicionar tarefa</button>`
          : h`<div
        class="week-day-empty"><span class="small muted">Dia livre</span><button type="button" class="btn ghost sm"
        data-action="week-add" data-d="${day}"
        aria-label="Adicionar tarefa em ${cap(DIAS[pk(day).getDay()])} ${shortDate(day)}">${icon('plus', 15)}Adicionar</button></div>`
      }
    </section>`,
    )}</div>
  </div>`;
}

export function renderGoogleCalendarPlanPanel(accounts) {
  const selectedCalendars = accounts.reduce((count, account) => count + account.selectedIds.length, 0);
  return h`<section class="surface-open google-calendar-panel" aria-labelledby="google-calendar-title">
    <div class="head"><div><h3 id="google-calendar-title">Seus calendários</h3><span
      class="badge">Somente leitura</span></div><a class="btn sm"
      href="${routePathFor('config?section=calendars')}">Gerenciar</a></div>
    ${
      accounts.length
        ? h`<p class="small muted">${selectedCalendars} ${selectedCalendars === 1 ? 'calendário selecionado' : 'calendários selecionados'} em ${accounts.length} ${accounts.length === 1 ? 'conta' : 'contas'}. Selecione um dia para ver os eventos junto às tarefas.</p>`
        : emptyState({
            title: 'Nenhuma agenda conectada.',
            description: 'Conecte uma agenda quando quiser ver seus eventos ao lado das tarefas.',
            action: h`<a class="btn primary" href="${routePathFor('config?section=calendars')}">Conectar agenda</a>`,
            iconName: 'calendar',
            headingLevel: 'h4',
            className: 'google-calendar-plan-empty',
          })
    }
  </section>`;
}
