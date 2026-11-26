import { h } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { addDays, longDate, pk, today } from '../utils/dates.js';
import { routePathFor } from '../core/router.js';
import { netAccountBalance } from '../features/finance/calculations.js';
import { todayTasks as selectTodayTasks } from '../features/planning/task-selection.js';
import { canAccessCycle } from '../features/cycle/access.js';
import { cycleDayNumber, cycleStats } from '../features/cycle/calculations.js';
import { hasCurrentCycleDataConsent } from '../services/cycle-consent.js';
import { normalizeProfileAppearance } from '../features/profile/model.js';
import { homeFirstStepsProgress } from '../features/home/personalization.js';
import {
  habitColor,
  habitDayOverview,
  habitIconKey,
  habitIsComplete,
  habitIsSkipped,
  isWaterHabit,
} from '../features/habits/model.js';
import { waterGoalForHabit, waterMlForDay } from '../features/habits/water-goal.js';
import { weeklyReview } from '../features/planning/week.js';
import { backupReminder } from '../features/backup/reminder.js';
import { renderHomeView } from '../features/home/view.js';
import { createHomeDaySummary } from '../features/home/day-summary.js';
import { calendarEventTaskKey, calendarEventsList, todayCalendarEvents } from './google-agenda.js';
import { AREAS, plural } from './core.js';
import { UPCOMING_WINDOW_DAYS, upcomingDueItems } from './finance-view.js';
import { saveSlicesWithRollback, snapshotSlices } from './persistence.js';
import { taskRow } from './render.js';
import { areaGuideButton, areaOn, cap, empty, profileAvatarMarkup, profileGreeting } from './shell.js';
import { accountSession, S, settingsView, ui } from './state.js';

// Páginas: Início, Planejar, Foco
export const todayTasks = () => selectTodayTasks(S.tasks, today());
export const habitCompletedFor = (habit, day) => habitIsComplete(habit, day);
const sampleBanner = () =>
  S.settings.prefs.sample
    ? h`<div class="notice warn sample-banner" role="note">${icon('info', 18)}<div
      class="grow">Dados de exemplo, não são seus.</div><button class="btn sm"
      data-action="clear-sample">Limpar exemplos</button></div>`
    : '';

function homeInboxReminder(tasks) {
  if (!tasks.length) return '';
  return h`<section class="notice home-inbox-reminder" aria-labelledby="home-inbox-title">
    ${icon('inbox', 18)}
    <div class="grow"><b
      id="home-inbox-title">${tasks.length} ${plural(tasks.length, 'tarefa sem data', 'tarefas sem data')}</b><span>Escolha o que você quer planejar agora; o restante pode esperar.</span></div>
    <a class="btn ghost sm" href="/planejar" data-action="filter-inbox">Organizar tarefas</a>
  </section>`;
}

function homeUpcomingTasks() {
  const endDate = addDays(today(), 7);
  const upcoming = S.tasks
    .filter((task) => !task.done && task.dueDate > today() && task.dueDate <= endDate)
    .sort(
      (left, right) =>
        left.dueDate.localeCompare(right.dueDate) || (left.time || '99:99').localeCompare(right.time || '99:99'),
    );
  if (!upcoming.length) return '';
  const preview = upcoming.slice(0, 3);
  const remaining = upcoming.length - preview.length;
  return h`<section class="card home-upcoming-card" aria-labelledby="home-upcoming-title">
    <div class="head"><div><h2 id="home-upcoming-title">Próximos 7 dias</h2></div><a class="btn ghost sm"
      href="/planejar">Ver planejamento</a></div>
    <ul class="list">${preview.map((task) => taskRow(task))}</ul>
    ${
      remaining
        ? h`<p
      class="home-upcoming-more">+ ${remaining} ${plural(remaining, 'tarefa', 'tarefas')} na lista completa.</p>`
        : ''
    }
  </section>`;
}

function homeHabitCheckins(highlightNext = false, onlyNext = false) {
  if (!areaOn('habits')) return '';
  const day = today();
  const overview = habitDayOverview(S.habits, day, habitCompletedFor, (habit, targetDay) =>
    habitIsSkipped(habit, targetDay, day),
  );
  const pending = overview.scheduled.filter(
    (habit) => !habitCompletedFor(habit, day) && !habitIsSkipped(habit, day, day),
  );
  if (!pending.length) return '';
  const nextHabit = highlightNext ? pending[0] : null;
  if (onlyNext && !nextHabit) return '';
  return h`<section class="card home-habit-checkins" aria-label="${onlyNext ? 'Próximo passo' : 'Hábitos de hoje'}">
    <div class="head"><h2>${onlyNext ? 'Próximo passo' : 'Hábitos de hoje'}</h2><a class="btn ghost sm"
      href="/habitos">Ver hábitos</a></div>
    <ul class="list">${(onlyNext ? [nextHabit] : pending).map((habit) => {
      const completed = habitCompletedFor(habit, day);
      const skipped = habitIsSkipped(habit, day, day);
      return h`<li class="home-habit-row${habit.id === nextHabit?.id ? ' is-next' : ''}">
        <span class="home-habit-icon" style="--hc:${habitColor(habit)}">${icon(habitIconKey(habit), 18)}</span>
        <span class="grow"><b>${habit.name}</b><span
          class="small muted">${completed ? 'Concluído hoje' : skipped ? 'Dia pulado hoje' : 'Ainda não marcado'}</span>${
            habit.id === nextHabit?.id
              ? h`<span
          class="home-next-step-label">Próximo passo</span>`
              : ''
          }</span>
        <button type="button" class="btn sm ${completed || skipped ? 'back' : 'primary'}"
          data-action="${skipped ? 'habit-skip' : 'habit-check'}" data-id="${habit.id}"
          aria-pressed="${String(completed || skipped)}">${icon(completed ? 'check' : skipped ? 'close' : 'plus', 16)}${completed ? 'Concluído' : skipped ? 'Desfazer pulo' : 'Marcar'}</button>
      </li>`;
    })}</ul>
  </section>`;
}

let homeFirstStepsSessionKey = '';
let homeFirstStepsRendered = false;
export function homeFirstTaskSlices() {
  const slices = ['tasks'];
  if (!S.tasks.length && homeFirstStepsRendered && !S.settings.prefs.firstStepsStarted) {
    S.settings.prefs.firstStepsStarted = true;
    slices.push('settings');
  }
  return slices;
}
function homeFirstSteps() {
  const sessionKey = accountSession?.user?.id || 'local';
  if (sessionKey !== homeFirstStepsSessionKey) {
    homeFirstStepsSessionKey = sessionKey;
    homeFirstStepsRendered = false;
  }
  const settings = settingsView();
  const prefs = settings.prefs;
  if (ui.preview || prefs.sample || prefs.firstStepsDismissed) return '';
  if (S.tasks.length && !prefs.firstStepsStarted && !homeFirstStepsRendered) return '';
  if (!S.tasks.length && !prefs.firstStepsStarted && !homeFirstStepsRendered) {
    homeFirstStepsRendered = true;
    const snapshot = snapshotSlices(['settings']);
    prefs.firstStepsStarted = true;
    saveSlicesWithRollback(['settings'], snapshot, false, 'o início do cartão de primeiros passos');
  }
  homeFirstStepsRendered = true;

  const complete = homeFirstStepsProgress({
    theme: settings.theme,
    tasks: S.tasks,
    habits: S.habits,
  });
  const completedCount = complete.filter(Boolean).length;
  if (completedCount === 3) {
    const snapshot = snapshotSlices(['settings']);
    prefs.firstStepsDismissed = true;
    if (saveSlicesWithRollback(['settings'], snapshot, false, 'a conclusão dos primeiros passos')) return '';
  }
  const steps = [
    {
      label: 'Criar sua primeira tarefa',
      actionLabel: 'Abrir diálogo de nova tarefa',
      action: 'task-new',
      icon: 'calendarCheck',
    },
    {
      label: 'Marcar um hábito',
      actionLabel: 'Abrir Hábitos',
      href: '/habitos',
      icon: 'leaf',
    },
    {
      label: 'Escolher sua cor',
      actionLabel: 'Abrir preferências de aparência',
      href: routePathFor('config?section=personalization'),
      icon: 'sun',
    },
  ];
  return h`<section class="card home-first-steps" aria-labelledby="home-first-steps-title">
    <div class="home-first-steps-heading">
      <h2 id="home-first-steps-title">Comece em 3 passos</h2>
      <span class="home-first-steps-progress" role="status" aria-live="polite">${completedCount} de 3 feitos</span>
    </div>
    <div class="home-first-steps-progress-track" role="progressbar" aria-label="Progresso dos primeiros passos"
      aria-valuemin="0" aria-valuemax="3" aria-valuenow="${completedCount}"
      aria-valuetext="${completedCount} de 3 feitos">
      <span class="home-first-steps-progress-fill" style="width: ${(completedCount / 3) * 100}%"></span>
    </div>
    <ol class="home-first-steps-list" aria-label="Passos do primeiro acesso">${steps.map((step, index) => {
      const stepComplete = complete[index];
      const content = h`<span class="home-first-steps-mark"
        aria-hidden="true">${icon(stepComplete ? 'check' : step.icon, 18)}</span>
        <span class="home-first-steps-copy"><b>${step.label}</b><small>${stepComplete ? 'Feito' : step.actionLabel}</small></span>`;
      return h`<li class="${stepComplete ? 'is-complete' : ''}">${
        stepComplete
          ? h`<div class="home-first-steps-action" aria-label="${step.label}: feito">${content}</div>`
          : step.href
            ? h`<a class="home-first-steps-action" href="${step.href}">${content}</a>`
            : h`<button type="button" class="home-first-steps-action" data-action="${step.action}">${content}</button>`
      }</li>`;
    })}</ol>
    <button type="button" class="btn ghost sm home-first-steps-dismiss"
      data-action="first-steps-dismiss">Dispensar</button>
  </section>`;
}

export function viewInicio() {
  const todayKey = today();
  const name = (S.settings.profile.preferredName || S.settings.profile.name).trim();
  const profileAppearance = normalizeProfileAppearance(settingsView().prefs.profileAppearance);
  const greeting = profileGreeting(profileAppearance.greeting);
  const tt = todayTasks(),
    pend = tt.filter((t) => !t.done);
  const todayPlanTasks = tt.filter((task) => task.dueDate === todayKey);
  const calendarEvents = todayCalendarEvents({ respectFilters: false }).map((event) => {
    const key = calendarEventTaskKey(event);
    return {
      ...event,
      done: Boolean(key && S.tasks.find((task) => task.groupId === key)?.done),
    };
  });
  const pendingCalendarEvents = calendarEvents.filter((event) => !event.done);
  const overdue = pend.filter((t) => t.dueDate < todayKey);
  const dueToday = pend.filter((t) => t.dueDate === todayKey);
  const completed = tt.filter((t) => t.done);
  const inbox = S.tasks.filter((t) => !t.dueDate && !t.done);
  const optionalAreas = areaTiles();
  const homePrefs = settingsView().prefs;
  const homeLayout = homePrefs.homeLayout;
  const homeMessage = homePrefs.homeMessage;
  const sundayReview = pk(todayKey).getDay() === 0;
  const showHomeBlock = (id) => homeLayout.visible.includes(id);
  const homeBlockStyle = (id) => `style="order:${homeLayout.order.indexOf(id)}"`;
  const emptyWorkspace =
    !S.tasks.length && !S.habits.some((habit) => (habit.status || 'active') === 'active') && !S.finance.accounts.length;
  const nextTask = showHomeBlock('today') ? overdue[0] || dueToday[0] : null;
  const habitsOverview = habitDayOverview(areaOn('habits') ? S.habits : [], todayKey, habitCompletedFor, (habit, day) =>
    habitIsSkipped(habit, day, todayKey),
  );
  const habitsToday = habitsOverview.scheduled;
  const habitsLeft = habitsOverview.planned - habitsOverview.completed;
  const habitNote = habitsToday.length
    ? habitsLeft
      ? ` Faltam ${habitsLeft} ${plural(habitsLeft, 'hábito', 'hábitos')}.`
      : ' Hábitos de hoje em dia.'
    : '';
  const taskSummary = [
    overdue.length ? `${overdue.length} ${plural(overdue.length, 'tarefa atrasada', 'tarefas atrasadas')}` : '',
    dueToday.length ? `${dueToday.length} ${plural(dueToday.length, 'tarefa para hoje', 'tarefas para hoje')}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
  const lead =
    (taskSummary ||
      (pendingCalendarEvents.length
        ? `${pendingCalendarEvents.length} ${plural(pendingCalendarEvents.length, 'evento pendente', 'eventos pendentes')} na agenda hoje.`
        : !tt.length && !calendarEvents.length
          ? 'Seu dia está livre por enquanto. Que tal planejar algo?'
          : 'Tudo concluído por hoje. Aproveite o resto do dia.')) + habitNote;
  const waterTotal = waterMlForDay(S.water, todayKey);
  const waterHabit = S.habits.find(isWaterHabit);
  const waterGoal = waterGoalForHabit(waterHabit, S.settings.prefs.waterGoalMl);
  const showWaterSummary =
    areaOn('habits') && (S.habits.some((habit) => isWaterHabit(habit) && habit.status === 'active') || waterTotal > 0);
  const showCycleSummary =
    !ui.preview && !S.settings.prefs.sample && areaOn('cycle') && hasCurrentCycleDataConsent(accountSession?.user);
  const showFinanceSummary = areaOn('finances') && S.finance.accounts.length > 0;
  const daySummary = createHomeDaySummary({
    todayTasks: todayPlanTasks,
    overdueTasks: overdue,
    dueTodayTasks: dueToday,
    calendarEvents,
    habits: areaOn('habits') ? habitsOverview : null,
    water: showWaterSummary ? { total: waterTotal, goal: waterGoal } : null,
    balance: showFinanceSummary
      ? {
          cents: netAccountBalance(S.finance.accounts, S.finance.tx),
          hidden: S.settings.prefs.financeValuesHidden,
        }
      : null,
    cycle: showCycleSummary
      ? {
          day: S.settings.prefs.cycleDiscreet
            ? null
            : cycleDayNumber(todayKey, cycleStats(S.cycleLog, S.cycle, todayKey).starts),
        }
      : null,
  });
  const weekProgress = weeklyReview(S.tasks, [], todayKey).tasks;
  const upcomingDue = showFinanceSummary ? upcomingDueItems() : [];
  const financeUpcoming = upcomingDue.length
    ? {
        count: upcomingDue.length,
        cents: upcomingDue.reduce((sum, item) => sum + item.cents, 0),
        overdue: upcomingDue.filter((item) => item.date < todayKey).length,
        days: UPCOMING_WINDOW_DAYS,
        hidden: Boolean(S.settings.prefs.financeValuesHidden),
      }
    : null;
  const backupNotice =
    !ui.preview && !S.settings.prefs.sample
      ? backupReminder({
          lastBackup: S.settings.prefs.lastBackup,
          snoozedUntil: S.settings.prefs.backupReminderSnoozedUntil,
          recordCount: S.tasks.length + S.finance.tx.length + S.habits.length + Object.keys(S.cycleLog).length,
        })
      : null;
  return renderHomeView(
    {
      name,
      profileAppearance,
      greeting,
      dateLabel: cap(longDate(today())),
      daySummary,
      calendarEvents,
      pendingCalendarEvents,
      weekProgress,
      homeMessage,
      lead: showHomeBlock('summary') ? lead : '',
      tt,
      sundayReview,
      optionalAreas,
      overdue,
      dueToday,
      completed,
      nextTask,
      inbox,
      emptyWorkspace,
      openCompleted: ui.openDetails['home-completed'],
      financeAccountsCount: S.finance.accounts.length,
      financeUpcoming,
      backupNotice,
      showHomeBlock,
      homeBlockStyle,
    },
    {
      areaGuideButton,
      empty,
      homeFirstSteps,
      homeHabitCheckins,
      homeInboxReminder,
      homeUpcomingTasks,
      calendarEventsList,
      profileAvatarMarkup,
      sampleBanner,
      taskRow,
    },
  );
}
function areaTiles() {
  const defs = [
    ['finances', 'wallet'],
    ...(canAccessCycle(S.settings.profile, ui.preview) ? [['cycle', 'heart']] : []),
  ].filter(([a]) => !areaOn(a));
  if (!defs.length) return '';
  return h`<div class="head"><h2 id="ar">Áreas opcionais</h2><a class="btn ghost sm"
    href="${routePathFor('config')}">Gerenciar</a></div><div class="tiles">${defs.map(
      ([a, ic]) => h`<button
    class="tile off" data-action="enable-area" data-area="${a}"><span class="mk"
    data-area="${a}">${icon(ic, 22)}</span><h3>${AREAS[a][0]}</h3><span class="v">Ativar</span><span
    class="s">${AREAS[a][1]}</span></button>`,
    )}</div>`;
}
