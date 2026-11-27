import { $ } from '../utils/dom.js';
import { addDays, isDay, shortDate, today } from '../utils/dates.js';
import { newId } from '../utils/ids.js';
import { taskIconKey } from '../features/planning/task-icons.js';
import { simpleListNameKey } from '../features/planning/simple-lists.js';
import { ANNUAL_PLAN_IDEA_CATEGORIES, ANNUAL_PLAN_IDEAS } from '../features/planning/annual-plan.js';
import { MAX_COUNT_TARGET } from '../features/planning/goal-progress.js';
import { playMotion, prefersReducedMotion } from '../utils/motion.js';
import { weekDays } from '../features/planning/week.js';
import { nextDue } from '../features/planning/recurrence.js';
import { ACTIONS } from './actions.js';
import { plural } from './core.js';

import { applyBulkTasks, askDiscardDialog, dlgClose, dlgOpen, requestActionConfirmation } from './dialogs.js';
import { shiftMonth } from './finance-view.js';
import { moveTask } from './global-events-drag.js';
import {
  authorizeGoogleCalendar,
  connectedGoogleCalendarAccounts,
  disconnectGoogleCalendar,
  googleCalendar,
  loadGoogleCalendarEvents,
  prepareGoogleCalendar,
  toggleGoogleCalendar,
} from './google-agenda.js';
import { todayTasks } from './home.js';
import {
  createTrashRecord,
  moveRecordsToTrash,
  restoreTrashEntry,
  saveSlicesWithRollback,
  snapshotSlices,
} from './persistence.js';
import { showMoreResults, taskListHtml, updateAnnualIdeaFilters } from './planning.js';
import { nav, openFinanceQuickAction, render } from './render.js';
import { findTask, mkTask, openTaskDialog, toast } from './samples-backup.js';
import { completionFeedback, vibrateFeedback } from './shell.js';
import { S, settingsView, ui, weekStartDay } from './state.js';

export const PLANNING_ACTIONS = {
  'planning-list-select': (el) => {
    const name = S.settings.lists?.find(
      (list) => simpleListNameKey(list.name) === simpleListNameKey(el.dataset.name),
    )?.name;
    if (!name) return;
    ui.taskListName = name;
    ui.editingTaskList = false;
    render();
  },
  'planning-list-reopen-completed': (el) => {
    const list = S.settings.lists?.find((item) => simpleListNameKey(item.name) === simpleListNameKey(el.dataset.name));
    if (!list) return;
    const completed = S.tasks.filter(
      (task) => task.done && simpleListNameKey(task.list) === simpleListNameKey(list.name),
    );
    if (!completed.length) return;

    const previousState = completed.map((task) => ({ id: task.id, doneAt: task.doneAt }));
    const snapshot = snapshotSlices(['tasks']);
    completed.forEach((task) => {
      task.done = false;
      task.doneAt = undefined;
    });
    if (!saveSlicesWithRollback(['tasks'], snapshot, true, 'a reabertura dos itens da lista')) return;
    render();
    toast(`${completed.length} ${plural(completed.length, 'item reaberto', 'itens reabertos')}.`, 'action', () => {
      const undoSnapshot = snapshotSlices(['tasks']);
      previousState.forEach(({ id, doneAt }) => {
        const task = findTask(id);
        if (!task) return;
        task.done = true;
        if (doneAt === undefined) delete task.doneAt;
        else task.doneAt = doneAt;
      });
      if (saveSlicesWithRollback(['tasks'], undoSnapshot, true, 'a restauração dos itens concluídos')) {
        render();
      }
    });
  },
  'planning-list-rename-mode': () => {
    ui.editingTaskList = true;
    render();
    requestAnimationFrame(() => {
      const input = document.querySelector('#planning-list-rename [name="name"]');
      input?.focus();
      input?.select();
    });
  },
  'planning-list-rename-cancel': () => {
    ui.editingTaskList = false;
    render();
  },
  'planning-list-delete': (el) => {
    const list = S.settings.lists?.find((item) => simpleListNameKey(item.name) === simpleListNameKey(el.dataset.name));
    if (!list || S.settings.lists.length < 2) return;
    const fallback = S.settings.lists.find((item) => item !== list);
    if (!fallback) return;
    if (ui.confirmedAction !== 'planning-list-delete') {
      return requestActionConfirmation(
        'planning-list-delete',
        { name: list.name, fallback: fallback.name },
        'Excluir lista?',
        `A lista “${list.name}” será removida. Os itens existentes serão mantidos em “${fallback.name}”.`,
        'Excluir lista',
      );
    }
    const currentList = S.settings.lists.find((item) => simpleListNameKey(item.name) === simpleListNameKey(list.name));
    const destination = S.settings.lists.find(
      (item) => simpleListNameKey(item.name) === simpleListNameKey(fallback.name),
    );
    if (!currentList || !destination || S.settings.lists.length < 2) return;
    const snapshot = snapshotSlices(['settings', 'tasks']);
    S.settings.lists = S.settings.lists.filter((item) => item !== currentList);
    S.tasks.forEach((task) => {
      if (simpleListNameKey(task.list) === simpleListNameKey(currentList.name)) task.list = destination.name;
    });
    ui.taskListName = destination.name;
    ui.editingTaskList = false;
    if (!saveSlicesWithRollback(['settings', 'tasks'], snapshot, true, 'a exclusão da lista')) return;
    render();
    toast(`Itens mantidos em “${destination.name}”.`, 'success');
  },
  'edit-task': (el) => {
    const task = findTask(el.dataset.id);
    if (task)
      dlgOpen('task', {
        tags: [...(task.tags || [])],
        notes: task.notes || '',
        id: task.id,
        title: task.title,
        due: task.dueDate || '',
        time: task.time || '',
        repeat: task.repeat || 'none',
        subs: (task.subtasks || []).map((item) => ({ ...item })),
        priority: task.priority,
        icon: taskIconKey(task.icon),
      });
  },
  'google-calendar-event-toggle': (el) => {
    const key = String(el.dataset.eventKey || '');
    if (!key) return;
    const snapshot = snapshotSlices(['tasks']);
    let task = S.tasks.find((item) => item.groupId === key);
    if (!task) {
      const title = String(el.dataset.eventTitle || '')
        .trim()
        .slice(0, 120);
      if (!title) return;
      task = {
        id: newId(),
        title,
        done: false,
        dueDate: isDay(el.dataset.eventDay) ? el.dataset.eventDay : null,
        priority: 'normal',
        createdAt: Date.now(),
        groupId: key,
        groupTitle: String(el.dataset.calendarName || el.dataset.accountLabel || 'Google Calendar').slice(0, 120),
      };
      if (el.dataset.eventTime) task.time = el.dataset.eventTime;
      S.tasks.push(task);
    }
    task.done = !task.done;
    task.doneAt = task.done ? new Date().toISOString() : undefined;
    if (!saveSlicesWithRollback(['tasks'], snapshot, false, 'a conclusão do evento')) return;
    render();
    if (task.done) vibrateFeedback('light');
    toast(task.done ? 'Evento marcado como concluído.' : 'Evento reaberto.', task.done ? 'success' : 'info');
  },
  'tasks-show-more': () => showMoreResults('tasks', '#task-results', taskListHtml),
  'quick-action-task': () => {
    ui.quickActionsOpen = false;
    openTaskDialog(today());
  },
  'quick-action-bulk': () => {
    openFinanceQuickAction(() => ACTIONS['tx-bulk']());
  },
  'focus-quick-task': () => openTaskDialog(today()),
  'task-bulk': () => dlgOpen('taskbulk', { step: 'edit', text: '', rows: [] }),
  'taskbulk-back': () => {
    if (ui.dlg?.type === 'taskbulk') {
      ui.dlg.d.step = 'edit';
      render();
    }
  },
  'taskbulk-apply': () => applyBulkTasks(),
  'focus-task-title': () => openTaskDialog(),
  'task-new': (el) => openTaskDialog(isDay(el.dataset.due) ? el.dataset.due : ''),
  toggle: (el) => {
    const task = findTask(el.dataset.id);
    if (!task) return;
    const wasDone = task.done,
      previousDoneAt = task.doneAt,
      completing = !task.done;
    const reducedMotion = prefersReducedMotion(settingsView().look.reduceMotion);
    const dayTasks = ui.route === 'inicio' ? todayTasks() : [];
    const completesLastTaskOfDay =
      completing && dayTasks.filter((item) => !item.done).length === 1 && dayTasks.some((item) => item.id === task.id);
    const row = completing ? [...document.querySelectorAll('.task')].find((item) => item.dataset.k === task.id) : null;
    const snapshot = snapshotSlices(['tasks']);
    task.done = completing;
    task.doneAt = task.done ? new Date().toISOString() : undefined;
    let nextTask = null;
    if (task.done && task.repeat && task.repeat !== 'none' && task.dueDate) {
      let nextDate = nextDue(task.dueDate, task.repeat),
        attempts = 0;
      while (nextDate < today() && attempts++ < 800) nextDate = nextDue(nextDate, task.repeat);
      nextTask = {
        ...task,
        id: newId(),
        done: false,
        doneAt: undefined,
        dueDate: nextDate,
        createdAt: Date.now(),
        subtasks: (task.subtasks || []).map((subtask) => ({ ...subtask, done: false })),
      };
      delete nextTask.sample;
      S.tasks.push(nextTask);
    }
    if (!saveSlicesWithRollback(['tasks'], snapshot, !completing, 'a conclusão da tarefa')) {
      if (completing) render();
      return;
    }
    if (completing) {
      if (row && !reducedMotion) {
        row.style.height = `${row.getBoundingClientRect().height}px`;
        row.classList.add('done', 'is-completing');
        playMotion(row.querySelector('.ttl'), 'is-task-completing');
        row.inert = true;
        const checkbox = row.querySelector('[data-action="toggle"]');
        checkbox?.setAttribute('aria-checked', 'true');
        checkbox?.setAttribute('aria-label', `Reabrir: ${task.title}`);
        requestAnimationFrame(() => {
          row.style.height = '0px';
          row.classList.add('is-collapsing');
        });
        setTimeout(() => {
          if (row.isConnected) render();
          if (completesLastTaskOfDay && ui.route === 'inicio') {
            playMotion(document.querySelector('.home-head'), 'is-day-completion');
          }
        }, 260);
      } else {
        render();
        if (completesLastTaskOfDay && ui.route === 'inicio') {
          playMotion(document.querySelector('.home-head'), 'is-day-completion');
        }
      }
      vibrateFeedback(completesLastTaskOfDay ? 'success' : 'light');
      completionFeedback(`.task[data-k="${task.id}"]`);
      const message = nextTask ? `Concluída. Próxima: ${shortDate(nextTask.dueDate)}.` : 'Tarefa concluída.';
      toast(message, 'action', () => {
        const currentTask = findTask(task.id);
        if (!currentTask) return;
        const undoSnapshot = snapshotSlices(['tasks']);
        currentTask.done = wasDone;
        if (previousDoneAt === undefined) delete currentTask.doneAt;
        else currentTask.doneAt = previousDoneAt;
        if (nextTask) S.tasks = S.tasks.filter((item) => item.id !== nextTask.id);
        saveSlicesWithRollback(['tasks'], undoSnapshot, true, 'a ação de concluir a tarefa');
      });
    }
  },
  'tg-del': (el) => {
    ui.dlg.d.tags.splice(Number(el.dataset.i), 1);
    render();
  },
  'tg-pick': (el) => {
    const a = (ui.dlg.d.tags = ui.dlg.d.tags || []);
    if (!a.includes(el.dataset.v)) a.push(el.dataset.v);
    render();
  },
  'mv-up': (el) => moveTask(el.dataset.id, -1),
  'mv-down': (el) => moveTask(el.dataset.id, 1),
  'st-toggle': (el) => {
    const x = (ui.dlg.d.subs || [])[Number(el.dataset.i)];
    if (x) {
      x.done = !x.done;
      render();
    }
  },
  'st-del': (el) => {
    const a = ui.dlg.d.subs || [];
    a.splice(Number(el.dataset.i), 1);
    render();
  },
  'plan-view': (el) => {
    if (!['lista', 'listas', 'calendario', 'revisao', 'anual'].includes(el.dataset.v)) return;
    const focusTab = el.getAttribute('role') === 'tab';
    ui.planView = el.dataset.v;
    ui.annualEditingGoalId = '';
    ui.annualGoalFormOpen = false;
    ui.annualGoalDraft = null;
    render();
    if (focusTab) requestAnimationFrame(() => document.getElementById(`plan-tab-${ui.planView}`)?.focus());
    if (ui.planView === 'calendario' || (ui.planView === 'lista' && ui.taskCal === today().slice(0, 7))) {
      const staleAccounts = connectedGoogleCalendarAccounts()
        .filter((account) => account.loadedMonth !== ui.taskCal)
        .map((account) => account.id);
      if (staleAccounts.length) void loadGoogleCalendarEvents(staleAccounts);
    }
  },
  'annual-goal-edit': (el) => {
    const goals = S.settings.prefs.annualPlans?.[ui.annualYear]?.goals || [];
    const goal = goals.find((item) => item.id === el.dataset.id);
    if (!goal) return;
    ui.annualEditingGoalId = el.dataset.id;
    ui.annualGoalQuarter = goal.quarter;
    ui.annualGoalFormOpen = true;
    ui.annualGoalDraft = null;
    render();
  },
  'annual-goal-add': (el) => {
    const quarter = el.dataset.quarter || '';
    if (!['', 'q1', 'q2', 'q3', 'q4'].includes(quarter)) return;
    ui.annualEditingGoalId = '';
    ui.annualGoalQuarter = quarter;
    ui.annualGoalFormOpen = true;
    ui.annualGoalDraft = null;
    render();
    requestAnimationFrame(() => document.querySelector('.annual-goal-form [name="title"]')?.focus());
  },
  'annual-idea-use': (el) => {
    const idea = ANNUAL_PLAN_IDEAS.find((item) => item.id === el.dataset.id);
    if (!idea) return;
    ui.annualEditingGoalId = '';
    ui.annualGoalQuarter = '';
    ui.annualGoalDraft = { title: idea.title, action: idea.action };
    ui.annualGoalFormOpen = true;
    render();
    requestAnimationFrame(() => {
      const title = document.querySelector('.annual-goal-form [name="title"]');
      title?.scrollIntoView({ block: 'center' });
      title?.focus();
    });
  },
  'annual-idea-category': (el) => {
    const category = el.dataset.category || 'all';
    if (category !== 'all' && !ANNUAL_PLAN_IDEA_CATEGORIES.some((item) => item.id === category)) return;
    ui.annualIdeaCategory = category;
    updateAnnualIdeaFilters();
  },
  'annual-ideas-clear': () => {
    ui.annualIdeaCategory = 'all';
    ui.annualIdeaQuery = '';
    const search = document.querySelector('[data-input="annual-ideas-search"]');
    if (search) search.value = '';
    updateAnnualIdeaFilters();
  },
  'annual-goal-edit-cancel': () => {
    ui.annualEditingGoalId = '';
    ui.annualGoalFormOpen = false;
    ui.annualGoalDraft = null;
    render();
  },
  'annual-goal-toggle': (el) => {
    const plan = S.settings.prefs.annualPlans?.[ui.annualYear];
    const goal = plan?.goals.find((item) => item.id === el.dataset.id);
    if (!goal) return;
    const snapshot = snapshotSlices(['settings']);
    goal.done = !goal.done;
    if (saveSlicesWithRollback(['settings'], snapshot) && goal.done) vibrateFeedback('success');
  },
  'annual-goal-count': (el) => {
    const goal = S.settings.prefs.annualPlans?.[ui.annualYear]?.goals.find((item) => item.id === el.dataset.id);
    if (goal?.track?.kind !== 'count') return;
    const next = Math.max(0, goal.track.current + (Number(el.dataset.n) < 0 ? -1 : 1));
    if (next === goal.track.current || next > MAX_COUNT_TARGET * 10) return;
    const snapshot = snapshotSlices(['settings']);
    goal.track.current = next;
    if (saveSlicesWithRollback(['settings'], snapshot) && next === goal.track.target)
      toast('Meta alcançada. Parabéns!', 'success');
  },
  'annual-goal-task': (el) => {
    const plan = S.settings.prefs.annualPlans?.[ui.annualYear];
    const goal = plan?.goals.find((item) => item.id === el.dataset.id);
    if (!goal) return;
    const linkedTask = findTask(goal.taskId);
    if (linkedTask) {
      return ACTIONS['edit-task']({ dataset: { id: linkedTask.id } });
    }
    const title = goal.action && goal.action.length <= 120 ? goal.action : goal.title;
    const notes = goal.action && goal.action !== title ? goal.action : '';
    const snapshot = snapshotSlices(['settings', 'tasks']);
    const task = mkTask({
      title,
      dueDate: null,
      priority: 'normal',
      tags: ['Plano anual'],
      ...(notes ? { notes } : {}),
    });
    goal.taskId = task.id;
    S.tasks.push(task);
    if (saveSlicesWithRollback(['settings', 'tasks'], snapshot, true, 'a tarefa do plano anual')) {
      toast('Tarefa criada e vinculada à conquista.', 'success');
    }
  },
  'annual-goal-finance': () => {
    ui.finTab = 'planejamento';
    ui.finPlanTab = 'objetivos';
    nav('financas');
  },
  'annual-goal-delete': (el) => {
    const plan = S.settings.prefs.annualPlans?.[ui.annualYear];
    const goal = plan?.goals.find((item) => item.id === el.dataset.id);
    if (!goal) return;
    if (ui.confirmedAction !== 'annual-goal-delete') {
      return requestActionConfirmation(
        'annual-goal-delete',
        { id: goal.id },
        'Excluir conquista?',
        `“${goal.title}” será removida do plano anual.${findTask(goal.taskId) ? ' A tarefa vinculada permanecerá na sua lista.' : ''}`,
        'Excluir conquista',
      );
    }
    const snapshot = snapshotSlices(['settings']);
    plan.goals = plan.goals.filter((item) => item.id !== goal.id);
    if (ui.annualEditingGoalId === goal.id) ui.annualEditingGoalId = '';
    saveSlicesWithRollback(['settings'], snapshot);
  },
  'google-calendar-prepare': () => prepareGoogleCalendar(),
  'google-calendar-authorize': () => authorizeGoogleCalendar(),
  'google-calendar-refresh': (el) => {
    if (el.dataset.accountId) void loadGoogleCalendarEvents([el.dataset.accountId]);
  },
  'google-calendar-toggle': (el) => toggleGoogleCalendar(el.dataset.accountId, el.dataset.calendarId),
  'google-calendar-disconnect': (el) => disconnectGoogleCalendar(el.dataset.accountId),
  'weekly-open-overdue': () => {
    ui.planView = 'lista';
    ui.filters.f = 'atrasadas';
    nav('planejar');
  },
  'home-weekly-review': () => {
    ui.planView = 'revisao';
    nav('planejar');
  },
  'weekly-open-review': () => {
    ui.planView = 'revisao';
    if (ui.route === 'planejar') render();
    else nav('planejar');
  },
  'weekly-reflection-save': (el) => {
    const choice = ['Menos tarefas', 'Mais pausas', 'Manter assim'].find((value) => value === el.dataset.v);
    if (!choice) return;
    const weekStart = weekDays(today(), weekStartDay())[0];
    const snapshot = snapshotSlices(['settings']);
    S.settings.prefs.weeklyReflection = { weekOf: weekStart, text: choice };
    ui.reflectionEditing = false;
    if (!saveSlicesWithRollback(['settings'], snapshot, true, 'a reflexão semanal')) return;
    toast('Reflexão semanal salva.', 'success');
  },
  'weekly-reflection-edit': () => {
    ui.reflectionEditing = true;
    render();
  },
  'weekly-defer-task': (el) => {
    const task = findTask(el.dataset.id);
    if (!task || task.done || !isDay(task.dueDate)) return;
    const previousDate = task.dueDate;
    const snapshot = snapshotSlices(['tasks']);
    task.dueDate = addDays(task.dueDate, 7);
    const deferredDate = task.dueDate;
    if (!saveSlicesWithRollback(['tasks'], snapshot, true, 'o adiamento da tarefa')) return;
    toast('Tarefa adiada por uma semana.', 'action', () => {
      const currentTask = findTask(el.dataset.id);
      if (!currentTask || currentTask.dueDate !== deferredDate) {
        toast('A tarefa mudou depois do adiamento; as alterações atuais foram preservadas.', 'warning');
        return;
      }
      const current = snapshotSlices(['tasks']);
      currentTask.dueDate = previousDate;
      saveSlicesWithRollback(['tasks'], current, true, 'a restauração da tarefa');
    });
  },
  'tasks-reschedule-overdue': (el) => {
    const when = el.dataset.when === 'tomorrow' ? 'tomorrow' : 'today';
    const todayKey = today();
    const targetDate = when === 'tomorrow' ? addDays(todayKey, 1) : todayKey;
    const overdue = S.tasks.filter(
      (task) =>
        !task.done &&
        isDay(task.dueDate) &&
        task.dueDate < todayKey &&
        !String(task.groupId || '').startsWith('google-calendar:'),
    );
    if (!overdue.length) return;
    const previous = overdue.map((task) => ({ id: task.id, dueDate: task.dueDate }));
    const snapshot = snapshotSlices(['tasks']);
    overdue.forEach((task) => {
      task.dueDate = targetDate;
    });
    if (!saveSlicesWithRollback(['tasks'], snapshot, true, 'o reagendamento das tarefas atrasadas')) return;
    vibrateFeedback('light');
    const whenLabel = when === 'tomorrow' ? 'amanhã' : 'hoje';
    toast(
      `${overdue.length} ${plural(overdue.length, 'tarefa atrasada movida', 'tarefas atrasadas movidas')} para ${whenLabel}.`,
      'action',
      () => {
        const undoSnapshot = snapshotSlices(['tasks']);
        let restored = 0;
        previous.forEach(({ id, dueDate }) => {
          const currentTask = findTask(id);
          if (!currentTask || currentTask.dueDate !== targetDate) return;
          currentTask.dueDate = dueDate;
          restored++;
        });
        if (!restored) return;
        saveSlicesWithRollback(['tasks'], undoSnapshot, true, 'a restauração das tarefas atrasadas');
      },
    );
  },
  'task-reschedule': (el) => {
    const task = findTask(el.dataset.id);
    if (!task || task.done) return;
    const when = el.dataset.when;
    const todayKey = today();
    let targetDate;
    let label;
    if (when === 'today') {
      targetDate = todayKey;
      label = 'Tarefa reagendada para hoje.';
    } else if (when === 'tomorrow') {
      targetDate = addDays(todayKey, 1);
      label = 'Tarefa reagendada para amanhã.';
    } else if (when === 'next-week') {
      targetDate = addDays(task.dueDate && task.dueDate >= todayKey ? task.dueDate : todayKey, 7);
      label = `Tarefa reagendada para ${shortDate(targetDate)}.`;
    } else if (when === 'none') {
      targetDate = null;
      label = 'Data removida. A tarefa ficou sem prazo.';
    } else {
      return;
    }
    const previousDate = task.dueDate || null;
    if (previousDate === targetDate) return;
    const snapshot = snapshotSlices(['tasks']);
    if (targetDate) task.dueDate = targetDate;
    else delete task.dueDate;
    if (!saveSlicesWithRollback(['tasks'], snapshot, true, 'o reagendamento da tarefa')) return;
    vibrateFeedback('light');
    toast(label, 'action', () => {
      const currentTask = findTask(task.id);
      if (!currentTask || (currentTask.dueDate || null) !== targetDate) {
        toast('A tarefa mudou depois do reagendamento; as alterações atuais foram preservadas.', 'warning');
        return;
      }
      const current = snapshotSlices(['tasks']);
      if (previousDate) currentTask.dueDate = previousDate;
      else delete currentTask.dueDate;
      saveSlicesWithRollback(['tasks'], current, true, 'a restauração da tarefa');
    });
  },
  'task-swipe-defer': (el) => {
    const task = findTask(el.dataset.id);
    if (!task || task.done) return;
    const previousDate = task.dueDate;
    const deferredDate = addDays(today(), 1);
    const snapshot = snapshotSlices(['tasks']);
    task.dueDate = deferredDate;
    if (!saveSlicesWithRollback(['tasks'], snapshot, true, 'o adiamento da tarefa')) return;
    toast('Tarefa adiada para amanhã.', 'action', () => {
      const currentTask = findTask(task.id);
      if (!currentTask || currentTask.dueDate !== deferredDate) {
        toast('A tarefa mudou depois do adiamento; as alterações atuais foram preservadas.', 'warning');
        return;
      }
      const current = snapshotSlices(['tasks']);
      if (previousDate) currentTask.dueDate = previousDate;
      else delete currentTask.dueDate;
      saveSlicesWithRollback(['tasks'], current, true, 'a restauração da tarefa');
    });
  },
  'weekly-open-finances': () => {
    ui.finTab = 'resumo';
    nav('financas');
  },
  'weekly-open-habits': () => nav('habitos'),
  'tcal-month': (el) => {
    ui.taskCal = shiftMonth(ui.taskCal, Number(el.dataset.n));
    ui.googleCalendar.accounts.forEach((account) => {
      account.events = [];
      account.loadedMonth = '';
    });
    ui.googleCalendar.requestId += 1;
    render();
    if (googleCalendar.isConnected()) void loadGoogleCalendarEvents();
  },
  'tcal-day': (el) => {
    ui.taskDay = el.dataset.d;
    render();
  },
  'tweek-nav': (el) => {
    ui.taskWeek = addDays(ui.taskWeek, Number(el.dataset.n) * 7);
    render();
  },
  'tweek-today': () => {
    ui.taskWeek = today();
    render();
  },
  'week-add': (el) => {
    if (!isDay(el.dataset.d)) return;
    openTaskDialog(el.dataset.d);
  },
  'del-task': (el) => {
    const task = findTask(el.dataset.id);
    if (!task) return;
    if (ui.confirmedAction !== 'del-task')
      return requestActionConfirmation(
        'del-task',
        { id: task.id },
        'Excluir tarefa?',
        `A tarefa "${task.title}" irá para a lixeira por 30 dias.`,
        'Excluir tarefa',
      );
    const i = S.tasks.findIndex((item) => item.id === task.id);
    if (i < 0) return;
    const entry = moveRecordsToTrash(
      `Tarefa: ${task.title}`,
      [createTrashRecord('tasks', task.id, i, task)],
      ['tasks'],
      () => {
        S.tasks.splice(i, 1);
      },
    );
    if (entry) toast('Tarefa movida para a lixeira.', 'action', () => restoreTrashEntry(entry.id));
  },
  'del-task-dlg': () => {
    const id = ui.dlg?.d?.id;
    const task = findTask(id);
    if (!task) return dlgClose();
    if (ui.dlg.dirty) {
      askDiscardDialog(null, () =>
        requestActionConfirmation(
          'del-task',
          { id },
          'Excluir tarefa?',
          `A tarefa "${task.title}" irá para a lixeira por 30 dias.`,
          'Excluir tarefa',
        ),
      );
      return;
    }
    requestActionConfirmation(
      'del-task',
      { id },
      'Excluir tarefa?',
      `A tarefa "${task.title}" irá para a lixeira por 30 dias.`,
      'Excluir tarefa',
    );
  },
  'set-filter': (el) => {
    ui.filters.f = el.dataset.f;
    render();
  },
  'task-filters-clear': () => {
    ui.filters.f = 'todas';
    ui.filters.q = '';
    const search = $('#q');
    if (search) search.value = '';
    render();
  },
  'filter-inbox': (_, event) => {
    event.preventDefault();
    ui.filters.f = 'caixa';
    nav('planejar');
  },
  'filter-overdue': (_, event) => {
    event.preventDefault();
    ui.filters.f = 'atrasadas';
    nav('planejar');
  },
};
