import { DIAS, longDate, pk, today } from '../../utils/dates.js';
import { h, raw } from '../../utils/dom.js';
import { icon } from '../../utils/icons.js';
import {
  featuredHabitSuggestions, filterSuggestedHabits, habitIsSkipped,
  habitSuggestionTags, habitWeekOverview, habitWeekReview,
  remainingHabitSuggestions, SUGGESTED_HABIT_CATEGORIES, SUGGESTED_HABIT_TAGS,
} from './model.js';

export function renderHabitsView(dependencies) {
  const {
    S, ui, areaOn, areaPageTitle, gate, habitsTemplate,
    habitsTemplatePromise, habitsTemplateError, requestHabitsTemplate,
    weekStartDay, habitCompletedFor, getPushNotificationStatus, plural, habitRow,
    preserveCopyTerms, habitColor, habitIconKey, habitDaysLabel, renderHabitsTemplate, empty,
  } = dependencies;

  if (!areaOn('habits')) return h`${areaPageTitle('habitos', 'Hábitos')}${gate('habits', 'Hábitos')}`;
  if (!habitsTemplate) {
    if (!habitsTemplatePromise && !habitsTemplateError) requestHabitsTemplate();
    return habitsTemplateError
      ? h`${areaPageTitle('habitos', 'Hábitos')}<section class="card" role="alert"><p>Não foi possível carregar a área de Hábitos.</p><button class="btn" data-action="retry-habits-template">Tentar novamente</button></section>`
      : h`${areaPageTitle('habitos', 'Hábitos')}<section class="card habit-loading" role="status" aria-label="Carregando Hábitos"><span class="sr">Carregando Hábitos…</span><div aria-hidden="true"><span></span><span></span><span></span></div></section>`;
  }
  const suggestions = remainingHabitSuggestions(S.habits);
  const previewIdeas = new Set(featuredHabitSuggestions(suggestions).map(({ id }) => id));
  const firstUse = S.habits.length === 0;
  const initialIdeaPreview = firstUse
    && !ui.habitIdeasExpanded
    && ui.habitIdeaCategory === 'all'
    && ui.habitIdeaTag === 'all'
    && !String(ui.habitIdeaQuery || '').trim();
  const live = S.habits.filter((habit) => (habit.status || 'active') !== 'archived');
  const archived = S.habits.filter((habit) => habit.status === 'archived');
  const overview = habitWeekOverview(
    live,
    today(),
    weekStartDay(),
    habitCompletedFor,
    (habit, day) => habitIsSkipped(habit, day, today()),
  );
  const weekReview = habitWeekReview(
    live,
    today(),
    weekStartDay(),
    habitCompletedFor,
    (habit, day) => habitIsSkipped(habit, day, today()),
  );
  const hasTaskReminders = S.tasks.some((task) => !task.done && task.dueDate && task.time && task.remind != null);
  const hasReminders = live.some((habit) => habit.status === 'active' && habit.remind) || hasTaskReminders;
  const pushStatus = hasReminders ? getPushNotificationStatus() : null;
  const pushButtonDisabled = ui.pushBusy || (pushStatus && !pushStatus.enabled
    && (!pushStatus.configured || !pushStatus.supported || pushStatus.permission === 'denied'));
  const dow = pk(today()).getDay();
  const todays = live.filter((habit) => (habit.status || 'active') === 'active' && habit.days.includes(dow));
  const others = live.filter((habit) => !todays.includes(habit));
  const skippedN = todays.filter((habit) => habitIsSkipped(habit, today(), today())).length;
  const eligibleToday = todays.length - skippedN;
  const doneN = todays.filter((habit) => !habitIsSkipped(habit, today(), today()) && habitCompletedFor(habit, today())).length;
  const pct = eligibleToday ? Math.round(doneN / eligibleToday * 100) : 0;
  const todaySummary = eligibleToday
    ? `${doneN} de ${eligibleToday} ${plural(eligibleToday, 'hábito', 'hábitos')} ${doneN === eligibleToday ? '— tudo feito!' : 'feitos'}${skippedN ? ` · ${skippedN} ${plural(skippedN, 'dia pulado', 'dias pulados')}` : ''}`
    : skippedN ? `${skippedN} ${plural(skippedN, 'dia pulado hoje', 'dias pulados hoje')}` : 'Nenhum hábito programado para hoje.';
  const dayComplete = eligibleToday > 0 && doneN === eligibleToday;
  const ideasOpen = ui.openDetails.ideas ? raw('open') : '';
  const suggestionGroups = SUGGESTED_HABIT_CATEGORIES
    .map((category) => ({
      ...category,
      habits: suggestions
        .filter((suggestion) => suggestion.category === category.id)
        .map((suggestion) => ({ ...suggestion, tags: habitSuggestionTags(suggestion) })),
    }))
    .filter((category) => category.habits.length);
  const matchingIdeaIds = new Set(filterSuggestedHabits(
    suggestions,
    ui.habitIdeaCategory,
    ui.habitIdeaTag,
    ui.habitIdeaQuery,
  ).map((suggestion) => suggestion.id));
  const slots = {
    'page-title': h`${areaPageTitle('habitos', 'Hábitos')}`.s,
    'today-summary': h`${todaySummary}`.s,
    'add-button': todays.length ? h`<button type="button" class="btn primary" data-action="habit-new">${icon('plus', 16)}Novo hábito</button>`.s : '',
    'today-progress': eligibleToday
      ? h`<div class="habit-today-bar" role="progressbar" aria-label="Hábitos concluídos hoje, sem contar dias pulados" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pct}%"></span></div>`.s
      : '',
    'day-complete': dayComplete
      ? h`<div class="habit-day-complete${ui.habitCelebrationDay === today() ? ' is-celebrating' : ''}" role="status" aria-live="polite">${icon('sparkles', 20)}<span><b>Dia concluído!</b><small>Você marcou todos os hábitos programados para hoje.</small></span></div>`.s
      : '',
    'todays-habits': todays.length
      ? h`<ul class="habit-list" aria-label="Hábitos de hoje">${todays.map((habit) => habitRow(habit))}</ul>`.s
      : empty('Dia livre', 'Crie um hábito ou escolha uma ideia abaixo.', h`<button type="button" class="btn primary" data-action="habit-new">${icon('plus', 16)}Novo hábito</button>`, 'check').s,
    'reminder-note': hasReminders
      ? h`<div class="habit-reminder-note">
        <button type="button" class="btn sm" role="switch" data-action="habit-push-toggle" aria-checked="${pushStatus.enabled ? 'true' : 'false'}" ${pushButtonDisabled ? raw('disabled') : ''}>${icon('bell', 16)}${ui.pushBusy ? 'Atualizando…' : 'Avisos fora do app'}</button>
        <p class="small muted" role="status" aria-live="polite">${preserveCopyTerms(ui.habitPushNotice || pushStatus.message)}</p>
      </div>`.s
      : '',
    'week-overview': live.length ? h`<section class="card habit-week-overview" aria-labelledby="habit-week-overview-title">
      <div><h2 id="habit-week-overview-title">Sua semana até agora<i>.</i></h2><p class="small muted">${overview.planned
        ? `Você marcou ${overview.completed} de ${overview.planned} dias programados até hoje.`
        : 'Ainda não há dias ativos programados nesta semana.'}</p></div>
      ${overview.planned ? h`<progress value="${overview.completed}" max="${overview.planned}" aria-label="Consistência dos hábitos nesta semana"></progress>` : ''}
      ${weekReview.length ? h`<details class="habit-review" id="d-habit-review" ${ui.openDetails['habit-review'] ? raw('open') : ''}>
        <summary><span><b>Revisar cada hábito</b><small>Veja seu ritmo e ajuste o plano quando precisar.</small></span><span class="habit-count">${weekReview.length}</span>${icon('chevDown', 16, 'habit-disclosure-indicator')}</summary>
        <ul aria-label="Resumo semanal por hábito">${weekReview.map(({ habit, completed, planned, weeklyTarget, goalMet }) => {
          const target = weeklyTarget ?? planned;
          const progress = target ? Math.min(completed, target) : 0;
          const summary = weeklyTarget !== null
            ? `${completed} de ${weeklyTarget} na meta semanal · ${planned} ${plural(planned, 'dia programado', 'dias programados')} até hoje`
            : planned
              ? `${completed} de ${planned} ${plural(planned, 'dia programado', 'dias programados')} até hoje`
              : 'Ainda sem dias programados nesta semana.';
          return h`<li style="--hc:${habitColor(habit)}">
            <span class="home-habit-icon">${icon(habitIconKey(habit), 18)}</span>
            <div class="habit-review-copy"><b>${habit.name}</b><p>${summary}</p>
              ${target ? h`<progress value="${progress}" max="${target}" aria-label="Progresso de ${habit.name} na meta semanal"></progress>` : ''}
              ${goalMet ? h`<small>Meta semanal alcançada</small>` : ''}
            </div>
            <button type="button" class="btn sm" data-action="habit-edit-open" data-id="${habit.id}" aria-label="Ajustar ${habit.name}">Ajustar</button>
          </li>`;
        })}</ul>
      </details>` : ''}
      ${overview.paused.length ? h`<details class="habit-resume-list"><summary>Hábitos que você pode retomar <span class="habit-count">${overview.paused.length}</span>${icon('chevDown', 16, 'habit-disclosure-indicator')}</summary><ul>${overview.paused.map((habit) => h`<li><span class="user-value">${habit.name}</span><button type="button" class="btn sm" data-action="habit-toggle-pause" data-id="${habit.id}">Retomar</button></li>`)}</ul></details>` : ''}
    </section>`.s : '',
    'other-habits': others.length
      ? h`<details class="card habit-others" id="d-others" ${ui.openDetails.others ? raw('open') : ''}><summary><b>Fora de hoje</b><span class="habit-count">${others.length}</span>${icon('chevDown', 18, 'chev')}</summary><ul class="habit-list">${others.map((habit) => habitRow(habit))}</ul></details>`.s
      : '',
    'habit-ideas': suggestions.length
      ? h`<details class="card habit-ideas${firstUse ? ' is-first-use' : ''}" id="d-ideas" ${ideasOpen}>
        <summary><span><b>${firstUse ? 'Escolha seus primeiros hábitos' : 'Ideias de hábitos'}</b><small>${firstUse ? 'Comece com uma pequena mudança; você pode personalizar depois.' : 'Encontre uma ideia e personalize antes de adicionar.'}</small></span><span class="habit-count">${suggestions.length}</span>${icon('chevDown', 18, 'chev')}</summary>
        <div class="habit-idea-tools" ${initialIdeaPreview ? raw('hidden') : ''}>
          <label class="search habit-idea-search"><span class="sr">Buscar ideias de hábitos</span>${icon('search', 18)}<input type="search" data-input="habit-ideas-search" value="${ui.habitIdeaQuery || ''}" placeholder="Buscar por nome ou descrição" autocomplete="off"></label>
          <div class="habit-idea-filter-grid">
            <label class="f"><span>Categoria</span><select data-change="habit-idea-category" aria-label="Categoria das ideias">
              <option value="all" ${ui.habitIdeaCategory === 'all' ? raw('selected') : ''}>Todas as categorias</option>
              ${SUGGESTED_HABIT_CATEGORIES.map((category) => h`<option value="${category.id}" ${ui.habitIdeaCategory === category.id ? raw('selected') : ''}>${category.title}</option>`)}
            </select></label>
            <label class="f"><span>Contexto</span><select data-change="habit-idea-context" aria-label="Contexto das ideias">
              <option value="all" ${ui.habitIdeaTag === 'all' ? raw('selected') : ''}>Qualquer contexto</option>
              ${SUGGESTED_HABIT_TAGS.map((tag) => h`<option value="${tag.id}" ${ui.habitIdeaTag === tag.id ? raw('selected') : ''}>${tag.title}</option>`)}
            </select></label>
          </div>
          <p class="small muted">Busque por palavra ou combine categoria e contexto.</p>
          <div class="habit-idea-filter-status"><p class="small muted" data-habit-idea-count role="status" aria-live="polite">${matchingIdeaIds.size} ${plural(matchingIdeaIds.size, 'ideia encontrada', 'ideias encontradas')}</p><button type="button" class="btn ghost sm" data-action="habit-ideas-clear" ${ui.habitIdeaCategory !== 'all' || ui.habitIdeaTag !== 'all' || ui.habitIdeaQuery ? '' : raw('hidden')}>Limpar filtros</button></div>
        </div>
        <p class="habit-idea-empty small muted" data-habit-idea-empty ${matchingIdeaIds.size ? raw('hidden') : ''}>Nenhuma ideia encontrada. Ajuste os filtros.</p>
        <div class="habit-idea-categories${initialIdeaPreview ? ' is-preview' : ''}" id="habit-idea-categories">${suggestionGroups.map((category) => h`<section class="habit-idea-section" aria-labelledby="habit-ideas-${category.id}" ${category.habits.some((idea) => matchingIdeaIds.has(idea.id)) ? '' : raw('hidden')}><h3 id="habit-ideas-${category.id}">${category.title}</h3><div class="habit-idea-grid">${category.habits.map((idea) => h`<button type="button" class="habit-idea" data-habit-idea data-preview="${previewIdeas.has(idea.id) ? 'false' : 'true'}" data-action="habit-idea" data-id="${idea.id}" data-tags="${idea.tags.map(({ id }) => id).join(' ')}" ${!matchingIdeaIds.has(idea.id) || (!ui.habitIdeasExpanded && ui.habitIdeaCategory === 'all' && ui.habitIdeaTag === 'all' && !String(ui.habitIdeaQuery || '').trim() && !previewIdeas.has(idea.id)) ? raw('hidden') : ''} style="--hc:${habitColor(idea)}"><span class="habit-idea-icon">${icon(habitIconKey(idea), 22)}</span><span class="habit-idea-copy"><b>${idea.name}</b><small>${idea.description}</small>${idea.tags.length ? h`<span class="habit-idea-tags" aria-label="Características">${idea.tags.map((tag) => h`<span class="habit-idea-tag">${tag.title}</span>`)}</span>` : ''}<span class="habit-idea-cta">${icon('plus', 14)}Personalizar</span></span></button>`)}</div></section>`)}</div>
        <button type="button" class="btn ghost sm habit-ideas-expand" data-action="habit-ideas-expand" aria-controls="habit-idea-categories" aria-expanded="${String(ui.habitIdeasExpanded)}" ${suggestions.length <= 4 || (ui.habitIdeaCategory !== 'all' || ui.habitIdeaTag !== 'all' || ui.habitIdeaQuery) ? raw('hidden') : ''}>${ui.habitIdeasExpanded ? 'Mostrar menos ideias' : `Ver todas as ${suggestions.length} ideias`}</button>
      </details>`.s
      : '',
    'archived-habits': archived.length
      ? h`<details class="card habit-archived" id="d-archived" ${ui.openDetails.archived ? raw('open') : ''}><summary><b>Arquivados</b><span class="habit-count">${archived.length}</span>${icon('chevDown', 18, 'chev')}</summary><ul class="habit-list">${archived.map((habit) => h`<li class="habit-row is-off" style="--hc:${habitColor(habit)}"><span class="habit-circle is-static">${icon(habitIconKey(habit), 22)}</span><div class="habit-main"><span class="habit-title">${habit.name}</span><span class="habit-sub">${habitDaysLabel(habit)}</span></div><button type="button" class="btn sm" data-action="habit-restore" data-id="${habit.id}">Restaurar</button><button type="button" class="btn sm danger" data-action="habit-delete" data-id="${habit.id}">${icon('trash', 15)}Excluir</button><button type="button" class="ibtn" data-action="habit-edit-open" data-id="${habit.id}" aria-label="Editar hábito arquivado ${habit.name}">${icon('pencil', 18)}</button></li>`)}</ul></details>`.s
      : '',
  };
  return raw(renderHabitsTemplate(habitsTemplate, slots));

}
