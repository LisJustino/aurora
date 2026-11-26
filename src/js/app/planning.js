import { h } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { isoDay, today } from '../utils/dates.js';
import { filteredTasks as selectFilteredTasks } from '../features/planning/task-selection.js';
import { filterAnnualPlanIdeas } from '../features/planning/annual-plan.js';
import {
  renderGoogleCalendarPlanPanel,
  renderPlanningView,
  renderTaskCalendar,
  renderTaskWeek,
} from '../features/planning/view.js';
import { norm, orderOf, plural } from './core.js';
import { calendarAgenda, ymLabel } from './finance-view.js';
import {
  calendarEventTaskKey,
  calendarEventsList,
  connectedGoogleCalendarAccounts,
  todayCalendarEvents,
} from './google-agenda.js';
import { taskRow } from './render.js';
import { areaEmpty, areaPageTitle, cap, weeklyReviewView } from './shell.js';
import { allTags, S, ui, weekStartDay } from './state.js';

const FILTERS = [
  ['todas', 'Todas'],
  ['pendentes', 'Pendentes'],
  ['atrasadas', 'Atrasadas'],
  ['proximas', 'Próximos 7 dias'],
  ['caixa', 'Sem data'],
  ['concluidas', 'Concluídas hoje'],
  ['historico', 'Histórico'],
];
const LIST_PAGE_SIZE = 10;
const listPages = {
  tasks: { key: '', limit: LIST_PAGE_SIZE },
  transactions: { key: '', limit: LIST_PAGE_SIZE },
};
export function listPage(name, key) {
  const page = listPages[name];
  if (page.key !== key) {
    page.key = key;
    page.limit = LIST_PAGE_SIZE;
  }
  return page;
}
export function showMoreResults(name, selector, renderResults) {
  const results = document.querySelector(selector);
  if (!results) return;
  const previousCount = results.querySelectorAll('li.task, li.fr').length;
  listPages[name].limit += LIST_PAGE_SIZE;
  results.innerHTML = renderResults().s;
  const firstNewRow = results.querySelectorAll('li.task, li.fr')[previousCount];
  const next = firstNewRow?.querySelector('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  (next || results.querySelector('[data-action$="-show-more"]') || results).focus();
}
export function filteredTasks() {
  return selectFilteredTasks(
    S.tasks.filter((task) => !String(task.groupId || '').startsWith('google-calendar:')),
    ui.filters,
    today(),
    { normalize: norm, orderOf },
  );
}
export function taskListHtml() {
  const all = filteredTasks(),
    { f, sort } = ui.filters,
    tdy = today();
  const events = todayCalendarEvents();
  const page = listPage('tasks', JSON.stringify([f, ui.filters.q, sort]));
  const r = all.slice(0, page.limit);
  if (!r.length && !events.length) {
    const hasTasks = S.tasks.length > 0;
    const hasFilters = f !== 'todas' || ui.filters.q.trim() !== '';
    const actions = hasTasks
      ? hasFilters
        ? h`<button type="button" class="btn primary" data-action="task-filters-clear">Limpar filtros</button>`
        : h`<button type="button" class="btn primary"
          data-action="task-new">${icon('plus', 16)}Criar a primeira tarefa</button>`
      : hasFilters
        ? h`<button type="button" class="btn primary"
          data-action="task-new">${icon('plus', 16)}Criar a primeira tarefa</button><button type="button"
          class="btn ghost" data-action="task-filters-clear">Limpar filtros</button>`
        : h`<button type="button" class="btn primary"
          data-action="task-new">${icon('plus', 16)}Criar a primeira tarefa</button>`;
    return areaEmpty(
      hasTasks ? 'Nenhuma tarefa encontrada.' : 'Nada por aqui ainda.',
      hasTasks
        ? 'Nenhuma tarefa combina com estes filtros. Você pode ajustar a busca.'
        : 'Crie a primeira tarefa para começar.',
      actions,
      hasTasks ? 'search' : 'calendarCheck',
      'h3',
    );
  }
  const overdueActionBar = (count) =>
    count > 0
      ? h`<div class="overdue-bulk-bar" role="group" aria-label="Reagendar tarefas atrasadas">
          <span class="small muted">${count} ${plural(count, 'tarefa atrasada', 'tarefas atrasadas')}</span>
          <div class="overdue-bulk-actions">
            <button type="button" class="btn sm" data-action="tasks-reschedule-overdue"
              data-when="today">${icon('calendarCheck', 15)}Mover para hoje</button>
            <button type="button" class="btn sm ghost" data-action="tasks-reschedule-overdue"
              data-when="tomorrow">${icon('calendar', 15)}Para amanhã</button>
          </div>
        </div>`
      : '';
  const more =
    all.length > r.length
      ? h`<p class="small muted">Mostrando ${r.length} de ${all.length} tarefas</p><button type="button" class="btn"
        data-action="tasks-show-more">Mostrar mais tarefas</button>`
      : '';
  if (!(sort === 'prazo' && (f === 'todas' || f === 'pendentes' || f.startsWith('etq:'))))
    return h`${f === 'atrasadas' ? overdueActionBar(all.length) : ''}${
      events.length && f !== 'historico' && f !== 'concluidas'
        ? h`<section class="grp"><h3 class="gh">Eventos de hoje<span
      class="n">${events.length}</span></h3>${calendarEventsList(events)}</section>`
        : ''
    }${
      r.length
        ? h`<ul
      class="list">${r.map(taskRow)}</ul>`
        : ''
    }${more}`;
  const G = [
    ['Atrasadas', 'bad', (t) => !t.done && t.dueDate && t.dueDate < tdy],
    ['Hoje', '', (t) => !t.done && t.dueDate === tdy],
    ['Próximas', '', (t) => !t.done && t.dueDate && t.dueDate > tdy],
    ['Sem data', '', (t) => !t.done && !t.dueDate],
    ['Concluídas', '', (t) => t.done && (t.doneAt ? isoDay(t.doneAt) === tdy : t.dueDate === tdy)],
  ];
  return h`<div class="task-results-groups">${G.map(([l, c, fn]) => {
    const it = r.filter(fn);
    const totalInGroup = all.filter(fn).length;
    const ev = l === 'Hoje' ? events : [];
    return it.length || ev.length
      ? h`<section class="grp"><h3 class="gh ${c}">${l}<span
        class="n">${totalInGroup + ev.length}</span></h3>${l === 'Atrasadas' ? overdueActionBar(totalInGroup) : ''}${ev.length ? calendarEventsList(ev) : ''}${
          it.length
            ? h`<ul
        class="list">${it.map(taskRow)}</ul>`
            : ''
        }</section>`
      : '';
  })}</div>${more}`;
}
export function viewPlanejar() {
  return renderPlanningView({
    S,
    ui,
    filterOptions: FILTERS,
    allTags,
    areaPageTitle,
    plural,
    today,
    taskCalendar: () =>
      renderTaskCalendar({
        S,
        ui,
        weekStartDay,
        today,
        connectedGoogleCalendarAccounts,
        cap,
        ymLabel,
        taskRow,
        googleCalendarPlanPanel: () => renderGoogleCalendarPlanPanel(connectedGoogleCalendarAccounts()),
        agendaForMonth: calendarAgenda,
        calendarEventTaskKey,
      }),
    taskWeek: () =>
      renderTaskWeek({
        S,
        ui,
        weekStartDay,
        today,
        cap,
        taskRow,
      }),
    weeklyReviewView,
    taskListHtml,
  });
}

export function updateAnnualIdeaFilters() {
  const visibleIds = new Set(filterAnnualPlanIdeas(ui.annualIdeaCategory, ui.annualIdeaQuery).map((idea) => idea.id));
  document.querySelectorAll('[data-annual-idea]').forEach((card) => {
    card.hidden = !visibleIds.has(card.dataset.annualIdea);
  });
  document.querySelectorAll('[data-action="annual-idea-category"]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.category === ui.annualIdeaCategory));
  });
  const count = document.querySelector('[data-annual-ideas-count]');
  if (count) count.textContent = `${visibleIds.size} ${plural(visibleIds.size, 'ideia', 'ideias')}`;
  const empty = document.querySelector('.annual-ideas-empty');
  if (empty) empty.hidden = visibleIds.size > 0;
  const clear = document.querySelector('.annual-ideas-filter-status [data-action="annual-ideas-clear"]');
  if (clear)
    clear.hidden =
      visibleIds.size === 0 || (ui.annualIdeaCategory === 'all' && !String(ui.annualIdeaQuery || '').trim());
}
