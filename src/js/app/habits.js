import { h, raw } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { addDays, DIAS, isoDay, longDate, pk, today } from '../utils/dates.js';
import { habitStartedOnOrBefore } from '../features/habits/dates.js';
import {
  filterSuggestedHabits,
  habitColor,
  habitEntryForDay,
  habitEntryType,
  habitIconKey,
  habitIsSkipped,
  habitMonthDays,
  habitMonthStats,
  habitStats,
  habitWeeklyTarget,
  isWaterHabit,
  isWeightHabit,
  remainingHabitSuggestions,
} from '../features/habits/model.js';
import {
  waterGoalForHabit,
  waterGoalReached,
  waterMlForDay,
  waterWeekProgress,
} from '../features/habits/water-goal.js';
import { weekDays } from '../features/planning/week.js';
import { plural, preserveCopyTerms } from './core.js';
import { ymLabel } from './finance-view.js';
import { habitCompletedFor } from './home.js';
import { saveSlicesWithRollback, snapshotSlices } from './persistence.js';
import { render } from './render.js';
import { toast } from './samples-backup.js';
import { areaOn, areaPageTitle, cap, gate } from './shell.js';
import {
  habitsTemplate,
  habitsTemplateError,
  habitsTemplatePromise,
  loadHabitsTemplate,
  renderHabitsTemplate,
  renderHabitsView,
  S,
  setHabitsTemplate,
  setHabitsTemplateError,
  setHabitsTemplatePromise,
  setLoadHabitsTemplate,
  setRenderHabitsTemplate,
  setRenderHabitsView,
  ui,
  weekStartDay,
} from './state.js';

function habitDaysLabel(habit) {
  const target = habitWeeklyTarget(habit);
  const base =
    habit.days.length === 7
      ? 'Todos os dias'
      : [...habit.days]
          .sort((a, b) => a - b)
          .map((day) => DIAS[day])
          .join(', ');
  return target ? `${base} · meta de ${target}x por semana` : base;
}
export function habitMonthlyHistory(habit) {
  const days = habitMonthDays(ui.habitMonth, weekStartDay());
  const stats = habitMonthStats(habit, ui.habitMonth, today(), (day) => habitCompletedFor(habit, day));
  return h`<details class="habit-month"
    id="d-month-${habit.id}" ${ui.openDetails[`month-${habit.id}`] ? raw('open') : ''}>
    <summary>Histórico mensal · ${cap(ymLabel(ui.habitMonth))}${icon('chevDown', 16, 'habit-disclosure-indicator')}</summary>
    <div class="mnav"><button class="ibtn" type="button" data-action="habit-month" data-n="-1"
      aria-label="Mês anterior">${icon('chevLeft', 18)}</button><b>${cap(ymLabel(ui.habitMonth))}</b><button
      class="ibtn" type="button" data-action="habit-month" data-n="1"
      aria-label="Próximo mês" ${ui.habitMonth >= today().slice(0, 7) ? raw('disabled') : ''}>${icon('chevRight', 18)}</button></div>
    <p class="small muted">${stats.completed} de ${stats.scheduled} dias programados concluídos até hoje neste mês.</p>
    <div class="habit-month-grid" role="group" aria-label="Calendário de ${habit.name} em ${ymLabel(ui.habitMonth)}">
      ${Array.from({ length: 7 }, (_, index) => DIAS[(weekStartDay() + index) % 7]).map(
        (day) => h`<span
        class="habit-month-weekday">${day}</span>`,
      )}
      ${days.map((day) => {
        if (!day) return h`<span class="habit-month-empty" aria-hidden="true"></span>`;
        const started = habitStartedOnOrBefore(habit, day);
        const scheduled = started && habit.days.includes(pk(day).getDay());
        const completed = started && habitCompletedFor(habit, day);
        const skipped = started && habitIsSkipped(habit, day, today());
        const future = day > today();
        const label = `${longDate(day)}: ${skipped ? 'dia pulado' : completed ? 'concluído' : scheduled ? (future ? 'programado' : 'não concluído') : 'não programado'}`;
        const cls = `habit-month-day${completed ? ' is-done' : ''}${skipped ? ' is-skipped' : ''}${!scheduled ? ' is-off' : ''}${future ? ' is-future' : ''}${day === today() ? ' is-today' : ''}`;
        const editable = S.habits.includes(habit) && (habit.status || 'active') === 'active' && scheduled && !future;
        return editable
          ? h`<button type="button" class="${cls}" data-action="habit-day" data-id="${habit.id}" data-d="${day}"
            aria-pressed="${completed}"
            aria-label="${label}"><b>${pk(day).getDate()}</b>${completed ? icon('check', 12) : ''}</button>`
          : h`<span class="${cls}"
            aria-label="${label}"><b>${pk(day).getDate()}</b>${completed ? icon('check', 12) : ''}</span>`;
      })}
    </div>
    <p class="small muted">Toque em um dia programado que já passou para marcar ou desmarcar.</p>
  </details>`;
}
function habitYearHeat(habit) {
  const start = weekStartDay();
  const end = today();
  const firstWeek = weekDays(addDays(end, -52 * 7), start)[0];
  const days = [];
  for (let day = firstWeek; day <= end; day = addDays(day, 1)) days.push(day);
  let done = 0,
    planned = 0;
  const cells = days.map((day) => {
    const started = habitStartedOnOrBefore(habit, day);
    const scheduled = started && habit.days.includes(pk(day).getDay());
    const completed = started && habitCompletedFor(habit, day);
    const skipped = started && habitIsSkipped(habit, day, end);
    if (scheduled && !skipped) planned += 1;
    if (completed) done += 1;
    return { day, scheduled, completed, skipped };
  });
  return h`<details class="habit-year" id="d-year-${habit.id}" ${ui.openDetails[`year-${habit.id}`] ? raw('open') : ''}>
    <summary>Ano em calendário${icon('chevDown', 16, 'habit-disclosure-indicator')}</summary>
    <p class="small muted">${done} de ${planned} ${plural(planned, 'dia programado concluído', 'dias programados concluídos')} nos últimos 12 meses.</p>
    <div class="habit-year-grid" role="img"
      aria-label="Calendário de 12 meses de ${habit.name}: ${done} de ${planned} dias programados concluídos">${cells.map(
        (cell) => h`<span
      class="habit-year-cell${cell.completed ? ' is-done' : cell.skipped ? ' is-skipped' : cell.scheduled ? ' is-missed' : ''}"
      title="${longDate(cell.day)}${cell.skipped ? ' · pulado' : ''}"></span>`,
      )}</div>
    <p class="habit-year-legend small muted"><span class="habit-year-cell"></span>não programado <span
      class="habit-year-cell is-missed"></span>não feito <span class="habit-year-cell is-skipped"></span>pulado <span
      class="habit-year-cell is-done"></span>feito</p>
  </details>`;
}
export function updateHabitIdeaFilters() {
  const remaining = remainingHabitSuggestions(S.habits);
  const suggestions = filterSuggestedHabits(remaining, ui.habitIdeaCategory, ui.habitIdeaTag, ui.habitIdeaQuery);
  const visibleIds = new Set(suggestions.map((suggestion) => suggestion.id));
  const defaultView =
    ui.habitIdeaCategory === 'all' && ui.habitIdeaTag === 'all' && !String(ui.habitIdeaQuery || '').trim();
  const previewOnly = defaultView && !ui.habitIdeasExpanded;
  const firstUsePreview = S.habits.length === 0 && previewOnly;
  document.querySelectorAll('[data-habit-idea]').forEach((button) => {
    button.hidden = !visibleIds.has(button.dataset.id) || (previewOnly && button.dataset.preview === 'true');
  });
  const ideaTools = document.querySelector('.habit-idea-tools');
  if (ideaTools) ideaTools.hidden = firstUsePreview;
  const ideaCategories = document.querySelector('.habit-idea-categories');
  if (ideaCategories) ideaCategories.classList.toggle('is-preview', firstUsePreview);
  document.querySelectorAll('.habit-idea-section').forEach((section) => {
    section.hidden = !section.querySelector('[data-habit-idea]:not([hidden])');
  });
  const count = document.querySelector('[data-habit-idea-count]');
  if (count)
    count.textContent = `${suggestions.length} ${plural(suggestions.length, 'ideia encontrada', 'ideias encontradas')}`;
  const empty = document.querySelector('.habit-idea-empty');
  if (empty) empty.hidden = suggestions.length > 0;
  const clearButton = document.querySelector('[data-action="habit-ideas-clear"]');
  if (clearButton) clearButton.hidden = defaultView || suggestions.length === 0;
  const expandButton = document.querySelector('[data-action="habit-ideas-expand"]');
  if (expandButton) {
    expandButton.hidden = !defaultView || suggestions.length <= 4;
    expandButton.setAttribute('aria-expanded', String(ui.habitIdeasExpanded));
    expandButton.textContent = ui.habitIdeasExpanded
      ? 'Mostrar menos ideias'
      : `Ver todas as ${suggestions.length} ideias`;
  }
}
export const HABIT_COLOR_NAMES = [
  'Rosa',
  'Coral',
  'Âmbar',
  'Verde-claro',
  'Verde',
  'Azul-claro',
  'Azul',
  'Lilás',
  'Roxo',
  'Vermelho',
  'Cinza',
  'Marrom',
];
function lastWaterEntryToday() {
  const day = today();
  return (
    S.water
      .filter(
        (entry) => typeof entry?.at === 'string' && Number.isFinite(Date.parse(entry.at)) && isoDay(entry.at) === day,
      )
      .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
      .at(-1) || null
  );
}
export function undoLastWaterEntry(habit) {
  const day = today();
  const last = lastWaterEntryToday();
  if (!last) return toast('Não há registro de água hoje para desfazer.', 'info');
  const target = waterGoalForHabit(habit, S.settings.prefs.waterGoalMl);
  const totalAfter = waterMlForDay(S.water, day) - Math.round(last.ml);
  const uncompleting = Boolean(habit && habit.completions.includes(day) && !waterGoalReached(totalAfter, target));
  const slices = ['water', ...(uncompleting ? ['habits'] : [])];
  const snapshot = snapshotSlices(slices);
  S.water = S.water.filter((entry) => entry.id !== last.id);
  if (uncompleting) habit.completions = habit.completions.filter((completed) => completed !== day);
  if (!saveSlicesWithRollback(slices, snapshot, false, 'a remoção do registro de água')) return;
  render();
  toast(`${Math.round(last.ml).toLocaleString('pt-BR')} mL removidos do dia.`, 'success');
}
function habitWaterTracker(habit) {
  if (!isWaterHabit(habit)) return '';
  const currentDay = today();
  const total = waterMlForDay(S.water, currentDay);
  const target = waterGoalForHabit(habit, S.settings.prefs.waterGoalMl);
  const remaining = Math.max(0, target - total);
  const week = waterWeekProgress(S.water, target, currentDay, weekStartDay());
  const goalDays = week.filter(({ goalReached }) => goalReached).length;
  return h`<section class="water-tracker" aria-label="Acompanhamento de água">
    <div class="water-tracker-summary"><b>${total.toLocaleString('pt-BR')} mL</b><span>de ${target.toLocaleString('pt-BR')} mL hoje</span></div>
    <progress value="${Math.min(total, target)}" max="${target}"
      aria-label="Progresso da meta diária de água"></progress>
    ${
      habit.status === 'active'
        ? h`<div class="water-quick-amounts" role="group"
          aria-label="Registrar quantidade rápida">${[150, 250, 330, 500].map(
            (ml) => h`<button type="button"
          class="btn sm" data-action="water-quick" data-id="${habit.id}"
          data-ml="${ml}">+${ml} mL</button>`,
          )}${
            lastWaterEntryToday()
              ? h`<button type="button" class="btn sm ghost"
          data-action="water-undo" data-id="${habit.id}">Desfazer último</button>`
              : ''
          }</div>
    <form class="water-add-form" data-form="water-add" data-id="${habit.id}">
      <label for="water-amount-${habit.id}">Quantidade consumida (mL)</label>
      <div class="water-add-controls"><input id="water-amount-${habit.id}" name="amount" type="number" min="1"
        max="10000" step="1" inputmode="numeric" placeholder="Ex.: 250" required><button type="submit"
        class="btn sm">Adicionar</button></div>
    </form>`
        : ''
    }
    <p class="small muted"
      aria-live="polite">${remaining ? `Faltam ${remaining.toLocaleString('pt-BR')} mL para a meta.` : 'Meta diária atingida. Você pode continuar registrando.'} · Meta diária cumprida em ${goalDays} de 7 dias nesta semana.</p>
  </section>`;
}
function waterSummary() {
  const total = waterMlForDay(S.water, today());
  const habit = S.habits.find(isWaterHabit);
  const target = waterGoalForHabit(habit, S.settings.prefs.waterGoalMl);
  const remaining = Math.max(0, target - total);
  return h`<section class="water-tracker water-tracker--quick" style="--hc:var(--area-water)"
    aria-label="Acompanhamento de água">
    <div class="water-tracker-summary"><b>${total.toLocaleString('pt-BR')} mL</b><span>de ${target.toLocaleString('pt-BR')} mL hoje</span></div>
    <progress value="${Math.min(total, target)}" max="${target}"
      aria-label="Progresso da meta diária de água"></progress>
    <button type="button" class="btn sm" data-action="quick-action-water">${icon('water', 16)}Registrar 250 mL</button>
    <p class="small muted"
      aria-live="polite">${remaining ? `Faltam ${remaining.toLocaleString('pt-BR')} mL para a meta.` : 'Meta diária atingida. Você pode continuar registrando.'}</p>
  </section>`;
}
function habitRow(habit) {
  const status = habit.status || 'active';
  const saved = S.habits.includes(habit);
  const dayOn = habit.days.includes(pk(today()).getDay());
  const skipped = habitIsSkipped(habit, today(), today());
  const canCheck = status === 'active' && dayOn && !skipped;
  const done = habitCompletedFor(habit, today());
  const pending = canCheck && !done;
  const stats = habitStats(habit, today(), weekStartDay(), (day) => habitCompletedFor(habit, day));
  const color = habitColor(habit);
  const open = ui.openDetails[`hab-${habit.id}`] ? raw('open') : '';
  const target = stats.weeklyTarget ?? stats.scheduledThisWeek;
  const waterTotal = isWaterHabit(habit) ? waterMlForDay(S.water, today()) : 0;
  const waterTarget = isWaterHabit(habit) ? waterGoalForHabit(habit, S.settings.prefs.waterGoalMl) : 0;
  const weightEntry = isWeightHabit(habit) ? S.weight.find((entry) => entry.date === today()) : null;
  const sub =
    status === 'paused'
      ? 'Pausado'
      : skipped
        ? 'Dia pulado'
        : isWaterHabit(habit)
          ? `${waterTotal.toLocaleString('pt-BR')} de ${waterTarget.toLocaleString('pt-BR')} mL hoje`
          : isWeightHabit(habit)
            ? weightEntry
              ? `Peso registrado: ${weightEntry.kg.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg`
              : 'Informe o peso de hoje'
            : habitEntryType(habit) !== 'check'
              ? habitEntryForDay(habit, today())
                ? `${habitEntryType(habit) === 'select' ? 'Escolha de hoje' : 'Registro de hoje'}: ${habitEntryForDay(habit, today())}`
                : habitEntryType(habit) === 'select'
                  ? 'Escolha uma opção hoje'
                  : 'Escreva o registro de hoje'
              : habitDaysLabel(habit);
  const orderList = S.habits.filter((item) => item.status !== 'archived');
  const orderIndex = orderList.indexOf(habit);
  const circleLabel = `${skipped ? 'Dia pulado' : done ? 'Desmarcar' : 'Marcar como feito'}: ${habit.name}`;
  return h`<li class="habit-row${done ? ' is-done' : ''}${pending ? ' is-pending' : ''}${canCheck ? '' : ' is-off'}"
    data-habit-id="${habit.id}" style="--hc:${color}">
    <button type="button" class="habit-circle" data-action="habit-check" data-id="${habit.id}"
      aria-pressed="${String(done)}" aria-label="${circleLabel}" ${canCheck ? '' : raw('disabled')}>
      <span class="habit-circle-icon">${icon(habitIconKey(habit), 22)}</span><span
        class="habit-circle-check">${icon('check', 22)}</span>
    </button>
    <details class="habit-more" id="d-hab-${habit.id}" ${open}>
      <summary><span class="habit-main"><span class="habit-title">${habit.name}${
        status === 'paused'
          ? h` <span
        class="badge">Pausado</span>`
          : ''
      }</span><span
        class="habit-sub">${canCheck && stats.goalMet ? h`${icon('sparkles', 13)}Meta da semana cumprida · ` : ''}${sub}</span>${
          stats.streak >= 2
            ? h`<span
        class="habit-streak">${stats.streak} dias seguidos</span>`
            : ''
        }</span>${icon('chevDown', 18, 'chev')}</summary>
      <div class="habit-more-body">
        ${habitWaterTracker(habit)}
        <p class="small muted">${habitDaysLabel(habit)}<br>${stats.completedThisWeek} de ${target} nesta semana</p>
        ${habitMonthlyHistory(habit)}${saved ? habitYearHeat(habit) : ''}
        ${
          saved
            ? h`<details
          class="habit-management"><summary>Gerenciar hábito${icon('chevDown', 16, 'habit-management-indicator')}</summary><div
          class="habit-actions" role="group"
          aria-label="Ações de ${habit.name}">${
            status === 'active' && dayOn && !done
              ? h`<button type="button"
          class="btn sm habit-action-wide" data-action="habit-skip" data-id="${habit.id}"
          aria-pressed="${skipped}">${icon(skipped ? 'undo' : 'chevRight', 15)}${skipped ? 'Desfazer pulo' : 'Pular hoje'}</button>`
              : ''
          }<button
          type="button" class="btn sm" data-action="habit-edit-open"
          data-id="${habit.id}">${icon('pencil', 15)}Editar</button><button type="button" class="btn sm"
          data-action="habit-toggle-pause"
          data-id="${habit.id}">${icon(status === 'active' ? 'pause' : 'play', 15)}${status === 'active' ? 'Pausar' : 'Retomar'}</button>${
            status !== 'archived'
              ? h`<button
          type="button" class="btn sm" data-action="habit-move" data-dir="-1" data-id="${habit.id}"
          aria-label="Mover ${habit.name} para cima" ${orderIndex <= 0 ? raw('disabled') : ''}>${icon('arrowUp', 15)}Subir</button><button
          type="button" class="btn sm" data-action="habit-move" data-dir="1" data-id="${habit.id}"
          aria-label="Mover ${habit.name} para baixo" ${orderIndex < 0 || orderIndex >= orderList.length - 1 ? raw('disabled') : ''}>${icon('arrowDown', 15)}Descer</button>`
              : ''
          }<button
          type="button" class="btn sm" data-action="habit-archive"
          data-id="${habit.id}">${icon('archive', 15)}Arquivar</button><button type="button" class="btn sm danger"
          data-action="habit-delete" data-id="${habit.id}">${icon('trash', 15)}Excluir</button></div></details>`
            : ''
        }
      </div>
    </details>
    <div class="habit-week" role="group"
      aria-label="Esta semana: ${stats.completedThisWeek} de ${target} dias. Toque num dia que passou para marcar ou desmarcar.">${stats.week.map(
        (w) => {
          const stateLabel = `${longDate(w.day)}: ${w.skipped ? 'dia pulado' : w.completed ? 'concluído' : w.scheduled ? (w.day > today() ? 'programado' : 'não concluído') : 'não programado'}`;
          const editable = saved && status === 'active' && w.scheduled && w.day <= today();
          return h`<button type="button"
          class="habit-dot${w.completed ? ' is-done' : ''}${w.skipped ? ' is-skipped' : ''}${!w.scheduled ? ' is-off' : ''}${w.day === today() ? ' is-today' : ''}"
          data-action="habit-day" data-id="${habit.id}" data-d="${w.day}" aria-pressed="${w.completed}"
          aria-label="${stateLabel}" ${editable ? '' : raw('disabled')}><span class="habit-dot-day"
          aria-hidden="true">${DIAS[pk(w.day).getDay()].slice(0, 3)}</span><i
          aria-hidden="true">${w.completed ? icon('check', 12) : w.skipped ? '–' : ''}</i></button>`;
        },
      )}</div>
    ${
      saved && status === 'active'
        ? h`<button type="button" class="btn sm habit-history-action"
          data-action="habit-history-open" data-id="${habit.id}"
          aria-label="Abrir histórico de ${habit.name} para registrar outro dia">${icon('calendarCheck', 15)}Registrar outro dia</button>`
        : ''
    }
  </li>`;
}
export function viewHabits() {
  if (!renderHabitsView) {
    requestHabitsTemplate();
    return h`${areaPageTitle('habitos', 'Hábitos')}<section class="card habit-loading" role="status"
      aria-label="Carregando Hábitos"><span class="sr">Carregando Hábitos…</span><div
      aria-hidden="true"><span></span><span></span><span></span></div></section>`;
  }
  return renderHabitsView({
    S,
    ui,
    areaOn,
    areaPageTitle,
    gate,
    habitsTemplate,
    habitsTemplatePromise,
    habitsTemplateError,
    requestHabitsTemplate,
    weekStartDay,
    habitCompletedFor,
    plural,
    habitRow,
    waterSummary,
    preserveCopyTerms,
    habitColor,
    habitIconKey,
    habitDaysLabel,
    renderHabitsTemplate,
  });
}

export function requestHabitsTemplate() {
  if (habitsTemplate || habitsTemplatePromise) return;
  setHabitsTemplateError(false);
  setHabitsTemplatePromise(
    Promise.all([import('../features/habits/view.js'), import('../features/habits/template.js')])
      .then(([viewModule, templateModule]) => {
        setRenderHabitsView(viewModule.renderHabitsView);
        setLoadHabitsTemplate(templateModule.loadHabitsTemplate);
        setRenderHabitsTemplate(templateModule.renderHabitsTemplate);
        return loadHabitsTemplate();
      })
      .then(
        (template) => {
          setHabitsTemplate(template);
          setHabitsTemplatePromise(null);
          if (ui.route === 'habitos') render();
        },
        (error) => {
          setHabitsTemplatePromise(null);
          setHabitsTemplateError(true);
          console.error('Aurora: não foi possível carregar o template da área de Hábitos.', error);
          if (ui.route === 'habitos') render();
        },
      ),
  );
}
