import { DIAS, longDate, pk, today } from '../../utils/dates.js';
import { waterMlForDay } from './water-goal.js';
import { habitInsights } from './insights.js';
import { h, raw } from '../../utils/dom.js';
import { icon } from '../../utils/icons.js';
import { emptyState } from '../../utils/empty-state.js';
import {
  HABIT_TABS,
  featuredHabitSuggestions,
  filterSuggestedHabits,
  habitDayOverview,
  habitIsSkipped,
  isWaterHabit,
  habitSuggestionTags,
  habitWeekDailyProgress,
  habitWeekOverview,
  habitWeekReview,
  remainingHabitSuggestions,
  SUGGESTED_HABIT_CATEGORIES,
  SUGGESTED_HABIT_TAGS,
} from './model.js';

export function renderHabitsView(dependencies) {
  const {
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
    habitManageRow,
    habitMonthlyHistory,
    habitYearHeat,
    habitWaterTracker,
    habitColor,
    habitIconKey,
    habitDaysLabel,
    waterSummary,
    renderHabitsTemplate,
  } = dependencies;

  if (!areaOn('habits')) return h`${areaPageTitle('habitos', 'Hábitos')}${gate('habits', 'Hábitos')}`;
  if (!habitsTemplate) {
    if (!habitsTemplatePromise && !habitsTemplateError) requestHabitsTemplate();
    return habitsTemplateError
      ? h`${areaPageTitle('habitos', 'Hábitos')}<section class="card"
        role="alert"><p>Não foi possível carregar a área de Hábitos.</p><button class="btn"
        data-action="retry-habits-template">Tentar novamente</button></section>`
      : h`${areaPageTitle('habitos', 'Hábitos')}<section class="card habit-loading" role="status"
        aria-label="Carregando Hábitos"><span class="sr">Carregando Hábitos…</span><div
        aria-hidden="true"><span></span><span></span><span></span></div></section>`;
  }
  const suggestions = remainingHabitSuggestions(S.habits);
  const previewIdeas = new Set(featuredHabitSuggestions(suggestions).map(({ id }) => id));
  const firstUse = S.habits.length === 0;
  const initialIdeaPreview =
    firstUse &&
    !ui.habitIdeasExpanded &&
    ui.habitIdeaCategory === 'all' &&
    ui.habitIdeaTag === 'all' &&
    !String(ui.habitIdeaQuery || '').trim();
  const live = S.habits.filter((habit) => (habit.status || 'active') !== 'archived');
  const activeLive = live.filter((habit) => (habit.status || 'active') === 'active');
  const pausedLive = live.filter((habit) => habit.status === 'paused');
  const allPaused = activeLive.length === 0 && pausedLive.length > 0;
  const archived = S.habits.filter((habit) => habit.status === 'archived');
  const currentDay = today();
  const weekStart = weekStartDay();
  const skippedForDay = (habit, day) => habitIsSkipped(habit, day, currentDay);
  const dailyProgress = habitWeekDailyProgress(live, currentDay, weekStart, habitCompletedFor, skippedForDay);
  const completeDays = dailyProgress.filter(({ day, complete }) => day <= currentDay && complete).length;
  const overview = habitWeekOverview(live, currentDay, weekStart, habitCompletedFor, skippedForDay);
  const weekReview = habitWeekReview(live, currentDay, weekStart, habitCompletedFor, skippedForDay);
  const todayOverview = habitDayOverview(live, today(), habitCompletedFor, (habit, day) =>
    habitIsSkipped(habit, day, today()),
  );
  const todays = todayOverview.scheduled;
  const others = live.filter((habit) => !todays.includes(habit));
  const skippedN = todayOverview.skipped;
  const eligibleToday = todayOverview.planned;
  const doneN = todayOverview.completed;
  const pct = eligibleToday ? Math.round((doneN / eligibleToday) * 100) : 0;
  const todaySummary = eligibleToday
    ? `${doneN} de ${eligibleToday} ${plural(eligibleToday, 'hábito', 'hábitos')} ${doneN === eligibleToday ? '— tudo feito!' : plural(eligibleToday, 'feito', 'feitos')}${skippedN ? ` · ${skippedN} ${plural(skippedN, 'dia pulado', 'dias pulados')}` : ''}`
    : skippedN
      ? `${skippedN} ${plural(skippedN, 'dia pulado hoje', 'dias pulados hoje')}`
      : 'Nenhum hábito programado para hoje.';
  const waterHabit = S.habits.find((habit) => (habit.status || 'active') === 'active' && isWaterHabit(habit));
  const hasActiveWaterHabit = Boolean(waterHabit);
  const visibleTodays = todays.filter((habit) => !isWaterHabit(habit) || habit === waterHabit);
  const waterTodayMl = waterMlForDay(S.water, currentDay);
  const dayComplete = eligibleToday > 0 && doneN === eligibleToday;
  const ideasOpen = ui.openDetails.ideas ? raw('open') : '';
  const suggestionGroups = SUGGESTED_HABIT_CATEGORIES.map((category) => ({
    ...category,
    habits: suggestions
      .filter((suggestion) => suggestion.category === category.id)
      .map((suggestion) => ({ ...suggestion, tags: habitSuggestionTags(suggestion) })),
  })).filter((category) => category.habits.length);
  const matchingIdeaIds = new Set(
    filterSuggestedHabits(suggestions, ui.habitIdeaCategory, ui.habitIdeaTag, ui.habitIdeaQuery).map(
      (suggestion) => suggestion.id,
    ),
  );
  const insights = habitInsights(live, currentDay);
  const pct0 = (rate) => `${Math.round(rate * 100)}%`;
  const dayName = (index) => DIAS[index];
  function insightsSection() {
    const hasRate = insights.scheduled >= 8 && insights.rate !== null;
    if (!hasRate && !insights.atRisk.length) return '';
    return h`<section class="surface-open habit-insights" aria-labelledby="habit-insights-title">
      <div><h2 id="habit-insights-title">Como está indo</h2>${
        hasRate
          ? h`<p
        class="small muted">Nos últimos ${insights.windowDays} dias você cumpriu ${insights.completed} de ${insights.scheduled} ${plural(insights.scheduled, 'dia programado', 'dias programados')} (${pct0(insights.rate)}).</p>`
          : ''
      }</div>
      <ul class="habit-insight-list">
        ${insights.atRisk.map(
          ({ habit, streak }) => h`<li class="is-risk" style="--hc:${habitColor(habit)}"><span
          class="home-habit-icon">${icon(habitIconKey(habit), 18)}</span><p><b>${habit.name}</b> está com ${streak} dias seguidos. Marque hoje para manter a sequência.</p></li>`,
        )}
        ${insights.struggling.slice(0, 3).map(
          ({ habit, completed, scheduled, rate }) => h`<li
          style="--hc:${habitColor(habit)}"><span
          class="home-habit-icon">${icon(habitIconKey(habit), 18)}</span><p><b>${habit.name}</b> foi cumprido em ${completed} de ${scheduled} dias (${pct0(rate)}). Que tal reduzir os dias ou a meta?</p><button
          type="button" class="btn sm" data-action="habit-edit-open" data-id="${habit.id}"
          aria-label="Editar ${habit.name}">${icon('pencil', 15)}Ajustar</button></li>`,
        )}
        ${
          insights.hardestWeekday
            ? h`<li><span
          class="home-habit-icon">${icon('calendarCheck', 18)}</span><p>${dayName(insights.hardestWeekday.weekday)} é seu dia mais difícil (${pct0(insights.hardestWeekday.rate)}). ${dayName(insights.easiestWeekday.weekday)} é o melhor (${pct0(insights.easiestWeekday.rate)}).</p></li>`
            : ''
        }
        ${
          insights.solid.length
            ? h`<li><span
              class="home-habit-icon">${icon('sparkles', 18)}</span><p>Mais constante${insights.solid.length > 1 ? 's' : ''}: <b>${insights.solid
                .slice(0, 3)
                .map(({ habit }) => habit.name)
                .join(', ')}</b>.</p></li>`
            : ''
        }
        ${
          insights.bestStreak && insights.bestStreak.bestStreak >= 7
            ? h`<li><span
          class="home-habit-icon">${icon('flag', 18)}</span><p>Maior sequência: <b>${insights.bestStreak.habit.name}</b>, ${insights.bestStreak.bestStreak} dias seguidos.</p></li>`
            : ''
        }
      </ul>
    </section>`.s;
  }
  const parts = {
    'page-title': h`${areaPageTitle('habitos', 'Hábitos')}`.s,
    'water-tracker': !hasActiveWaterHabit && waterTodayMl > 0 ? waterSummary().s : '',
    'habit-dashboard-class': live.length ? 'has-week' : '',
    'today-summary': h`${todaySummary}`.s,
    'add-button': h`<div class="habit-today-actions">${
      live.length
        ? h`<button type="button" class="btn sm"
        data-action="habit-other-open">${icon('calendarCheck', 15)}Registrar outro dia</button>`
        : ''
    }${
      todays.length
        ? h`<button type="button"
        class="btn" data-action="habit-new">${icon('plus', 16)}Novo hábito</button>`
        : ''
    }</div>`.s,
    'habit-insights': insightsSection(),
    'today-progress': eligibleToday
      ? h`<div class="habit-today-bar" role="progressbar" aria-label="Hábitos concluídos hoje, sem contar dias pulados"
        aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pct}%"></span></div>`.s
      : '',
    'day-complete': dayComplete
      ? h`<div class="habit-day-complete${ui.habitCelebrationDay === today() ? ' is-celebrating' : ''}" role="status"
        aria-live="polite">${icon('check', 20)}<span><b>Dia concluído!</b><small>Você marcou todos os hábitos programados para hoje.</small></span></div>`
          .s
      : '',
    'todays-habits': visibleTodays.length
      ? h`<ul class="habit-list" aria-label="Hábitos de hoje">${visibleTodays.map((habit) => habitRow(habit))}</ul>`.s
      : allPaused
        ? h`<div class="habit-pause-banner" role="status">${icon('pause', 20)}<div class="grow"><b>Modo pausa ativo</b><p class="small muted">Todos os ${pausedLive.length} ${plural(pausedLive.length, 'hábito está pausado', 'hábitos estão pausados')}. Suas sequências ficam protegidas até você voltar.</p></div><button type="button" class="btn primary sm" data-action="habits-resume-all">${icon('play', 15)}Retomar todos</button></div>`
            .s
        : emptyState({
            title: firstUse ? 'Seu primeiro hábito começa pequeno.' : 'Hoje pode ser um dia de pausa.',
            description: firstUse
              ? 'Escolha uma ideia que combine com você ou crie seu próprio hábito.'
              : 'Se quiser, ajuste sua rotina ou escolha outra ideia para começar.',
            action: h`<button type="button" class="btn primary"
              data-action="habit-new">${icon('plus', 16)}${firstUse ? 'Criar primeiro hábito' : 'Criar um hábito'}</button>`,
            iconName: 'check',
            headingLevel: 'h3',
            className: 'habit-today-empty',
          }).s,
    'week-overview': live.length
      ? h`<section class="surface-open habit-week-overview" aria-labelledby="habit-week-overview-title">
      <div><h2 id="habit-week-overview-title">Sua semana até agora</h2><p class="small muted">${
        overview.planned
          ? `Você marcou ${overview.completed} de ${overview.planned} ${plural(overview.planned, 'dia programado', 'dias programados')} até hoje.`
          : 'Ainda não há dias ativos programados nesta semana.'
      }</p></div>
      ${
        overview.planned
          ? h`<progress value="${overview.completed}" max="${overview.planned}"
        aria-label="Consistência dos hábitos nesta semana"></progress>`
          : ''
      }
      <div class="habit-week-chart">
        <h3>Ritmo diário</h3>
        <div class="habit-week-chart-grid">${dailyProgress.map(({ day, completed, planned, progress }) => {
          const percentage = Math.round(progress * 100);
          const label =
            day > currentDay
              ? `${longDate(day)}: dia futuro`
              : planned
                ? `${longDate(day)}: ${completed} de ${planned} hábitos concluídos`
                : `${longDate(day)}: nenhum hábito programado`;
          return h`<div class="habit-week-chart-column">
            <span class="habit-week-chart-count" aria-hidden="true">${day <= currentDay && planned ? `${completed}/${planned}` : ''}</span>
            <div class="habit-week-chart-bar${day === currentDay ? ' is-today' : ''}" role="img" aria-label="${label}">
              <span style="--week-fill:${percentage}%"></span>
            </div>
            <span class="habit-week-chart-day" aria-hidden="true">${DIAS[pk(day).getDay()]}</span>
          </div>`;
        })}</div>
        <span class="sr">Hábitos: ${completeDays} de 7 dias com todos os hábitos programados concluídos.</span>
      </div>
      ${
        weekReview.length
          ? h`<div class="habit-review">
        <h3>Cada hábito nesta semana</h3>
        <ul aria-label="Resumo semanal por hábito">${weekReview.map(
          ({ habit, completed, planned, weeklyTarget, goalMet }) => {
            const target = weeklyTarget ?? planned;
            const progress = target ? Math.min(completed, target) : 0;
            const summary =
              weeklyTarget !== null
                ? `${completed} de ${weeklyTarget} na meta semanal · ${planned} ${plural(planned, 'dia programado', 'dias programados')} até hoje`
                : planned
                  ? `${completed} de ${planned} ${plural(planned, 'dia programado', 'dias programados')} até hoje`
                  : 'Ainda sem dias programados nesta semana.';
            return h`<li style="--hc:${habitColor(habit)}">
            <span class="home-habit-icon">${icon(habitIconKey(habit), 18)}</span>
            <div class="habit-review-copy"><b>${habit.name}</b><p>${summary}</p>
              ${
                target
                  ? h`<progress value="${progress}" max="${target}"
                aria-label="Progresso de ${habit.name} na meta semanal"></progress>`
                  : ''
              }
              ${goalMet ? h`<small>Meta semanal alcançada</small>` : ''}
            </div>
            <button type="button" class="btn sm" data-action="habit-edit-open" data-id="${habit.id}"
              aria-label="Editar ${habit.name}">${icon('pencil', 15)}Editar</button>
          </li>`;
          },
        )}</ul>
      </div>`
          : ''
      }
    </section>`.s
      : '',
    'habit-ideas': suggestions.length
      ? h`<details class="card habit-ideas${firstUse ? ' is-first-use' : ''}" id="d-ideas" ${ideasOpen}>
        <summary><span class="habit-summary-copy"><span
          class="habit-summary-title"><b>${firstUse ? 'Escolha seus primeiros hábitos' : 'Ideias de hábitos'}</b><span
          class="habit-count">${suggestions.length}</span></span><small>${firstUse ? 'Comece com uma pequena mudança; você pode personalizar depois.' : 'Encontre uma ideia e personalize antes de adicionar.'}</small></span>${icon('chevDown', 18, 'chev')}</summary>
        <div class="habit-idea-tools" ${initialIdeaPreview ? raw('hidden') : ''}>
          <label class="search habit-idea-search"><span
            class="sr">Buscar ideias de hábitos</span>${icon('search', 18)}<input type="search"
            data-input="habit-ideas-search" value="${ui.habitIdeaQuery || ''}"
            placeholder="Buscar por nome ou descrição" autocomplete="off"></label>
          <div class="habit-idea-filter-grid">
            <label class="f"><span>Categoria</span><select data-change="habit-idea-category"
              aria-label="Categoria das ideias">
              <option value="all" ${ui.habitIdeaCategory === 'all' ? raw('selected') : ''}>Todas as categorias</option>
              ${SUGGESTED_HABIT_CATEGORIES.map(
                (category) => h`<option
                value="${category.id}" ${ui.habitIdeaCategory === category.id ? raw('selected') : ''}>${category.title}</option>`,
              )}
            </select></label>
            <label class="f"><span>Contexto</span><select data-change="habit-idea-context"
              aria-label="Contexto das ideias">
              <option value="all" ${ui.habitIdeaTag === 'all' ? raw('selected') : ''}>Qualquer contexto</option>
              ${SUGGESTED_HABIT_TAGS.map(
                (tag) => h`<option
                value="${tag.id}" ${ui.habitIdeaTag === tag.id ? raw('selected') : ''}>${tag.title}</option>`,
              )}
            </select></label>
          </div>
          <p class="small muted">Busque por palavra ou combine categoria e contexto.</p>
          <div class="habit-idea-filter-status"><p class="small muted" data-habit-idea-count role="status"
            aria-live="polite">${matchingIdeaIds.size} ${plural(matchingIdeaIds.size, 'ideia encontrada', 'ideias encontradas')}</p><button
            type="button" class="btn ghost sm"
            data-action="habit-ideas-clear" ${matchingIdeaIds.size && (ui.habitIdeaCategory !== 'all' || ui.habitIdeaTag !== 'all' || ui.habitIdeaQuery) ? '' : raw('hidden')}>Limpar filtros</button></div>
        </div>
        ${emptyState({
          title: 'Nenhuma ideia encontrada.',
          description: 'Tente outra palavra ou limpe os filtros para ver outras opções.',
          action: h`<button type="button" class="btn primary" data-action="habit-ideas-clear">Limpar filtros</button>`,
          iconName: 'search',
          headingLevel: 'h3',
          className: 'habit-idea-empty',
          hidden: matchingIdeaIds.size > 0,
        })}
        <div class="habit-idea-categories${initialIdeaPreview ? ' is-preview' : ''}"
          id="habit-idea-categories">${suggestionGroups.map(
            (category) => h`<section class="habit-idea-section"
          aria-labelledby="habit-ideas-${category.id}" ${category.habits.some((idea) => matchingIdeaIds.has(idea.id)) ? '' : raw('hidden')}><h3
          id="habit-ideas-${category.id}">${category.title}</h3><div
          class="habit-idea-grid">${category.habits.map(
            (idea) => h`<button type="button" class="habit-idea"
          data-habit-idea data-preview="${previewIdeas.has(idea.id) ? 'false' : 'true'}" data-action="habit-idea"
          data-id="${idea.id}"
          data-tags="${idea.tags.map(({ id }) => id).join(' ')}" ${!matchingIdeaIds.has(idea.id) || (!ui.habitIdeasExpanded && ui.habitIdeaCategory === 'all' && ui.habitIdeaTag === 'all' && !String(ui.habitIdeaQuery || '').trim() && !previewIdeas.has(idea.id)) ? raw('hidden') : ''}
          style="--hc:${habitColor(idea)}"><span class="habit-idea-icon">${icon(habitIconKey(idea), 22)}</span><span
          class="habit-idea-copy"><b>${idea.name}</b><small>${idea.description}</small>${
            idea.tags.length
              ? h`<span
          class="habit-idea-tags" aria-label="Características">${idea.tags.map(
            (tag) => h`<span
          class="habit-idea-tag">${tag.title}</span>`,
          )}</span>`
              : ''
          }<span
          class="habit-idea-cta">${icon('plus', 14)}Personalizar</span></span></button>`,
          )}</div></section>`,
          )}</div>
        <button type="button" class="btn ghost sm habit-ideas-expand" data-action="habit-ideas-expand"
          aria-controls="habit-idea-categories"
          aria-expanded="${String(ui.habitIdeasExpanded)}" ${suggestions.length <= 4 || ui.habitIdeaCategory !== 'all' || ui.habitIdeaTag !== 'all' || ui.habitIdeaQuery ? raw('hidden') : ''}>${ui.habitIdeasExpanded ? 'Mostrar menos ideias' : `Ver todas as ${suggestions.length} ideias`}</button>
      </details>`.s
      : '',
    'archived-habits': archived.length
      ? h`<details class="card habit-ideas habit-archived" id="d-archived" ${ui.openDetails.archived ? raw('open') : ''}>
        <summary><span class="habit-summary-copy"><span class="habit-summary-title"><b>Arquivados</b><span
          class="habit-count">${archived.length}</span></span><small>Histórico preservado; você pode restaurar quando quiser.</small></span>${icon('chevDown', 18, 'chev')}</summary>
        <ul class="habit-list">${archived.map(
          (habit) => h`<li class="habit-row is-off"
        style="--hc:${habitColor(habit)}"><span
        class="habit-circle is-static">${icon(habitIconKey(habit), 22)}</span><div class="habit-main"><span
        class="habit-title">${habit.name}</span><span class="habit-sub">${habitDaysLabel(habit)}</span></div><div
        class="habit-actions habit-actions--archived" role="group" aria-label="Ações de ${habit.name}"><button
        type="button" class="btn sm" data-action="habit-edit-open"
        data-id="${habit.id}">${icon('pencil', 15)}Editar</button><button type="button" class="btn sm"
        data-action="habit-restore" data-id="${habit.id}">${icon('undo', 15)}Restaurar</button><button type="button"
        class="btn sm danger" data-action="habit-delete"
        data-id="${habit.id}">${icon('trash', 15)}Excluir</button></div></li>`,
        )}</ul></details>`.s
      : '',
  };
  const tab = HABIT_TABS.some(([key]) => key === ui.habitTab) ? ui.habitTab : 'hoje';
  const hasAny = S.habits.length > 0;
  const tabs = hasAny
    ? h`<div class="tabs habit-tabs" role="tablist" aria-label="Seções de Hábitos">${HABIT_TABS.map(
        ([id, name, tabIcon]) => h`<button type="button" class="tab habit-tab" role="tab"
        id="habit-tab-${id}" aria-controls="habit-panel" tabindex="${id === tab ? '0' : '-1'}"
        data-action="habit-tab" data-t="${id}" aria-selected="${id === tab}">${icon(tabIcon, 18)}${name}</button>`,
      )}</div>`.s
    : '';
  const historyHabit = live.find((habit) => habit.id === ui.habitHistoryId) || live[0];
  const historySection = historyHabit
    ? h`<section class="card habit-history" aria-labelledby="habit-history-title">
      <h2 id="habit-history-title" class="habit-section-title">Calendário de cada hábito</h2>
      <div class="habit-history-chips" role="group" aria-label="Escolha o hábito">${live.map(
        (habit) => h`<button type="button" class="chip habit-history-chip" data-action="habit-history-pick"
        data-id="${habit.id}" aria-pressed="${habit.id === historyHabit.id}"
        style="--hc:${habitColor(habit)}">${habit.name}</button>`,
      )}</div>
      ${habitMonthlyHistory(historyHabit)}${habitYearHeat(historyHabit)}
    </section>`.s
    : '';
  const reordering = Boolean(ui.habitReordering) && live.length >= 2;
  const reorderSection = reordering
    ? h`<section class="card habit-manage" aria-labelledby="habit-manage-title">
      <header class="habit-today-head"><div><h2 id="habit-manage-title" class="habit-section-title">Reordenar hábitos<span
        class="habit-count">${live.length}</span></h2><p class="small muted">Arraste pelo ícone ou use as setas para mudar a ordem.</p></div><div
        class="habit-today-actions"><button type="button" class="btn primary sm"
        data-action="habit-reorder-toggle">${icon('check', 16)}Concluir</button></div></header>
      <ul class="habit-manage-list" aria-label="Ordem dos hábitos">${live.map((habit) => habitManageRow(habit))}</ul>
    </section>`.s
    : '';
  const waterTracker =
    waterHabit && !todays.includes(waterHabit) && !others.includes(waterHabit)
      ? habitWaterTracker(waterHabit).s
      : parts['water-tracker'];
  const todaySection = h`<section class="card habit-today" aria-labelledby="habit-today-title">
    <header class="habit-today-head">
      <div><h2 id="habit-today-title">Hoje</h2><p class="small muted">${raw(parts['today-summary'])}</p></div>
      ${raw(parts['add-button'])}
    </header>
    ${raw(parts['today-progress'])}${raw(parts['day-complete'])}${raw(parts['todays-habits'])}
  </section>`.s;
  const othersSection = others.length
    ? h`<section class="card habit-others" aria-labelledby="habit-others-title">
      <header class="habit-today-head"><div><h2 id="habit-others-title" class="habit-section-title">Outros hábitos<span
        class="habit-count">${others.length}</span></h2><p class="small muted">Programados para outros dias ou pausados.</p></div></header>
      <ul class="habit-list" aria-label="Outros hábitos">${others.map((habit) => habitRow(habit))}</ul>
    </section>`.s
    : '';
  const utilityBar = live.length
    ? h`<div class="habit-utility-bar" role="group" aria-label="Ações da lista de hábitos"><button type="button"
      class="btn sm ghost" data-action="habit-bulk">${icon('note', 15)}Adicionar vários</button>${
        live.length >= 2
          ? h`<button type="button" class="btn sm ghost"
      data-action="habit-reorder-toggle">${icon('grip', 15)}Reordenar</button>`
          : ''
      }${
        activeLive.length
          ? h`<button type="button" class="btn sm ghost"
      data-action="habits-pause-all">${icon('pause', 15)}Pausar todos</button>`
          : ''
      }${
        pausedLive.length
          ? h`<button type="button" class="btn sm ghost"
      data-action="habits-resume-all">${icon('play', 15)}Retomar pausados (${pausedLive.length})</button>`
          : ''
      }</div>`.s
    : '';
  const panels = {
    hoje: reordering
      ? `${reorderSection}`
      : `${waterTracker}${todaySection}${othersSection}${utilityBar}${parts['habit-ideas']}${parts['archived-habits']}`,
    historico: live.length
      ? `${parts['week-overview']}${parts['habit-insights']}${historySection}`
      : emptyState({
          title: 'Ainda não há histórico para mostrar.',
          description: 'Quando você tiver hábitos ativos, o calendário de cada um aparece aqui.',
          iconName: 'calendarCheck',
          headingLevel: 'h3',
        }).s,
  };
  const slots = {
    'page-title': parts['page-title'],
    'habit-tabs': tabs,
    'habit-panel': `<div id="habit-panel" class="habit-panel" role="${hasAny ? 'tabpanel' : 'region'}"${hasAny ? ` aria-labelledby="habit-tab-${tab}"` : ' aria-label="Hábitos"'}>${panels[hasAny ? tab : 'hoje']}</div>`,
  };
  return raw(renderHabitsTemplate(habitsTemplate, slots));
}
