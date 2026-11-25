import { addDays, dayDiff, isDay, pk, shortDate, today } from '../utils/dates.js';
import {
  DEFAULT_HABIT_COLOR,
  DEFAULT_HABIT_ICON,
  HABIT_COLORS,
  habitEntryForDay,
  habitEntryOptions,
  habitEntryType,
  habitIsSkipped,
  isWaterHabit,
  isWeightHabit,
  SUGGESTED_HABITS,
} from '../features/habits/model.js';
import { parseWaterMl, waterGoalForHabit } from '../features/habits/water-goal.js';
import { ACTIONS, focusQuickActionsTrigger, recordWaterEntry } from './actions.js';
import { applyBulkHabits, askDiscardDialog, dlgOpen, requestActionConfirmation } from './dialogs.js';
import { shiftMonth } from './finance-view.js';
import { requestHabitsTemplate, undoLastWaterEntry, updateHabitIdeaFilters } from './habits.js';
import { habitCompletedFor } from './home.js';
import {
  commit,
  createTrashRecord,
  moveRecordsToTrash,
  restoreTrashEntry,
  saveSlicesWithRollback,
  snapshotSlices,
} from './persistence.js';
import { render } from './render.js';
import { toast } from './samples-backup.js';
import { areaOn, completionFeedback, vibrateFeedback } from './shell.js';
import { S, ui } from './state.js';

export const HABIT_ACTIONS = {
  'quick-action-water': () => {
    const habit = S.habits.find((item) => isWaterHabit(item) && item.status === 'active');
    ui.quickActionsOpen = false;
    if (!habit && !S.habits.some(isWaterHabit)) {
      dlgOpen('habit-edit', {
        name: 'Beber água',
        days: [0, 1, 2, 3, 4, 5, 6],
        weeklyGoal: '',
        icon: 'droplet',
        color: HABIT_COLORS[S.habits.length % HABIT_COLORS.length],
        tracking: 'water',
        waterGoalMl: S.settings.prefs.waterGoalMl,
        enableHabits: !areaOn('habits'),
        recordWaterAfterSave: true,
      });
      return;
    }
    render();
    const amount = parseWaterMl('250');
    if (amount === null) return toast('Não foi possível registrar um copo de água.', 'error');
    recordWaterEntry(amount, habit);
    focusQuickActionsTrigger();
  },
  'habit-bulk': () => dlgOpen('habitbulk', { step: 'edit', text: '', rows: [] }),
  'habitbulk-back': () => {
    if (ui.dlg?.type === 'habitbulk') {
      ui.dlg.d.step = 'edit';
      render();
    }
  },
  'habitbulk-apply': () => applyBulkHabits(),
  'water-quick': (el) => {
    const habit = S.habits.find((item) => item.id === el.dataset.id);
    if (!habit || !isWaterHabit(habit) || habit.status !== 'active') {
      return toast('Este hábito de água não está disponível para registro.', 'info');
    }
    const amount = parseWaterMl(el.dataset.ml);
    if (amount === null) return toast('Não foi possível registrar essa quantidade.', 'error');
    recordWaterEntry(amount, habit);
  },
  'water-undo': (el) => {
    const habit = S.habits.find((item) => item.id === el.dataset.id);
    if (!habit || !isWaterHabit(habit)) return;
    undoLastWaterEntry(habit);
  },
  'habit-idea': (el) => {
    const idea = SUGGESTED_HABITS.find((item) => item.id === el.dataset.id);
    if (!idea) return;
    dlgOpen('habit-edit', {
      name: idea.name,
      suggestionDescription: idea.description,
      days: [0, 1, 2, 3, 4, 5, 6],
      weeklyGoal: '',
      icon: idea.icon,
      color: idea.color,
      ...(idea.id === 'water'
        ? {
            waterSuggestion: true,
            waterWeightKg: '',
            waterGoalMl: S.settings.prefs.waterGoalMl,
            waterGoalEdited: false,
          }
        : {}),
      ...(idea.id === 'weight' ? { tracking: 'weight', weightEntry: true, weightKg: '' } : {}),
    });
  },
  'habit-ideas-clear': () => {
    ui.habitIdeaCategory = 'all';
    ui.habitIdeaTag = 'all';
    ui.habitIdeaQuery = '';
    const search = document.querySelector('[data-input="habit-ideas-search"]');
    if (search) search.value = '';
    document.querySelectorAll('select[data-change^="habit-idea-"]').forEach((select) => {
      select.value = 'all';
    });
    updateHabitIdeaFilters();
  },
  'habit-ideas-expand': () => {
    ui.habitIdeasExpanded = !ui.habitIdeasExpanded;
    updateHabitIdeaFilters();
  },
  'habit-check': (el) => {
    const habit = S.habits.find((item) => item.id === el.dataset.id);
    if (!habit || (habit.status || 'active') !== 'active' || !habit.days.includes(pk(today()).getDay())) return;
    const day = today();
    if (isWeightHabit(habit)) {
      const todayEntry = S.weight.find((entry) => entry.date === day);
      dlgOpen('habit-edit', {
        id: habit.id,
        name: habit.name,
        days: [...habit.days],
        weeklyGoal: habit.weeklyGoal || '',
        tracking: 'weight',
        weightEntry: true,
        weightKg: todayEntry ? String(todayEntry.kg).replace('.', ',') : '',
        icon: habit.icon || DEFAULT_HABIT_ICON,
        color: habit.color || DEFAULT_HABIT_COLOR,
      });
      return;
    }
    const entryType = habitEntryType(habit);
    if (entryType !== 'check' && !habit.completions.includes(day)) {
      dlgOpen('habit-edit', {
        id: habit.id,
        name: habit.name,
        days: [...habit.days],
        weeklyGoal: habit.weeklyGoal || '',
        entryType,
        entryOptions: habitEntryOptions(habit),
        entryValue: habitEntryForDay(habit, day),
        entryPrompt: entryType === 'text' ? 'Registro de hoje' : 'Escolha o registro de hoje',
        icon: habit.icon || DEFAULT_HABIT_ICON,
        color: habit.color || DEFAULT_HABIT_COLOR,
      });
      return;
    }
    if (habitIsSkipped(habit, day, day)) return;
    const completing = !habit.completions.includes(day);
    const previousCelebrationDay = ui.habitCelebrationDay;
    const snapshot = snapshotSlices(['habits']);
    habit.completions = habit.completions.includes(day)
      ? habit.completions.filter((completed) => completed !== day)
      : [...habit.completions, day];
    const scheduledToday = S.habits.filter(
      (item) =>
        (item.status || 'active') === 'active' &&
        item.days.includes(pk(day).getDay()) &&
        !habitIsSkipped(item, day, day),
    );
    ui.habitCelebrationDay =
      completing && scheduledToday.length > 0 && scheduledToday.every((item) => habitCompletedFor(item, day))
        ? day
        : '';
    if (!saveSlicesWithRollback(['habits'], snapshot, true, 'a marcação do hábito')) {
      ui.habitCelebrationDay = previousCelebrationDay;
      return;
    }
    if (completing) {
      vibrateFeedback();
      completionFeedback(`[data-habit-id="${habit.id}"] .habit-circle`);
      toast('Hábito marcado como concluído.', 'action', () => {
        const currentHabit = S.habits.find((item) => item.id === habit.id);
        if (!currentHabit || !currentHabit.completions.includes(day)) return;
        const undoSnapshot = snapshotSlices(['habits']);
        currentHabit.completions = currentHabit.completions.filter((completed) => completed !== day);
        ui.habitCelebrationDay = '';
        saveSlicesWithRollback(['habits'], undoSnapshot, true, 'a marcação do hábito');
      });
    }
  },
  'habit-skip': (el) => {
    const habit = S.habits.find((item) => item.id === el.dataset.id);
    const day = today();
    if (
      !habit ||
      (habit.status || 'active') !== 'active' ||
      !habit.days.includes(pk(day).getDay()) ||
      habit.completions.includes(day)
    )
      return;
    const skipped = new Set(habit.skipped || []);
    const undoSkip = skipped.has(day);
    if (undoSkip) skipped.delete(day);
    else {
      if (skipped.size >= 10000)
        return toast('O histórico de dias pulados chegou ao limite de 10.000 registros.', 'warning');
      skipped.add(day);
    }
    const snapshot = snapshotSlices(['habits']);
    habit.skipped = [...skipped].sort();
    if (!saveSlicesWithRollback(['habits'], snapshot, true, 'a alteração do dia pulado')) return;
    toast(
      undoSkip ? 'Pulo removido.' : 'Hoje foi marcado como dia pulado.',
      undoSkip ? 'success' : 'action',
      undoSkip
        ? null
        : () => {
            const currentHabit = S.habits.find((item) => item.id === habit.id);
            if (!currentHabit || !(currentHabit.skipped || []).includes(day)) return;
            const undoSnapshot = snapshotSlices(['habits']);
            currentHabit.skipped = currentHabit.skipped.filter((skippedDay) => skippedDay !== day);
            saveSlicesWithRollback(['habits'], undoSnapshot, true, 'a marcação do dia pulado');
          },
    );
  },
  'habit-day': (el) => {
    const habit = S.habits.find((item) => item.id === el.dataset.id);
    const day = el.dataset.d;
    if (
      !habit ||
      (habit.status || 'active') !== 'active' ||
      !isDay(day) ||
      day > today() ||
      !habit.days.includes(pk(day).getDay())
    )
      return;
    const had = habit.completions.includes(day);
    const hadSkip = (habit.skipped || []).includes(day);
    habit.completions = had ? habit.completions.filter((item) => item !== day) : [...habit.completions, day].sort();
    if (hadSkip && !had) habit.skipped = habit.skipped.filter((item) => item !== day);
    commit('habits');
    if (!had) completionFeedback(`.habit-dot[data-id="${habit.id}"][data-d="${day}"]`);
    toast(
      had ? `Marcação de ${shortDate(day)} removida.` : `${habit.name} marcado · ${shortDate(day)}`,
      'action',
      () => {
        habit.completions = had ? [...habit.completions, day].sort() : habit.completions.filter((item) => item !== day);
        if (hadSkip) habit.skipped = [...new Set([...(habit.skipped || []), day])].sort();
        commit('habits');
      },
    );
  },
  'habit-history-open': (el) => {
    const habit = S.habits.find((item) => item.id === el.dataset.id);
    if (!habit || (habit.status || 'active') !== 'active') return;
    const habitDetails = document.getElementById(`d-hab-${habit.id}`);
    const monthDetails = document.getElementById(`d-month-${habit.id}`);
    if (habitDetails) habitDetails.open = true;
    if (monthDetails) monthDetails.open = true;
    ui.openDetails[`hab-${habit.id}`] = true;
    ui.openDetails[`month-${habit.id}`] = true;
    ui.habitMonth = today().slice(0, 7);
    render();
    requestAnimationFrame(() => document.getElementById(`d-month-${habit.id}`)?.querySelector('summary')?.focus());
  },
  'habit-move': (el) => {
    const dir = Number(el.dataset.dir) === -1 ? -1 : 1;
    const order = S.habits.filter((item) => item.status !== 'archived');
    const habit = S.habits.find((item) => item.id === el.dataset.id);
    const at = order.indexOf(habit);
    const other = order[at + dir];
    if (!habit || !other) return;
    const i = S.habits.indexOf(habit),
      j = S.habits.indexOf(other);
    [S.habits[i], S.habits[j]] = [S.habits[j], S.habits[i]];
    commit('habits');
    requestAnimationFrame(() =>
      document.querySelector(`[data-action="habit-move"][data-id="${habit.id}"][data-dir="${dir}"]`)?.focus(),
    );
  },
  'habit-new': () =>
    dlgOpen('habit-edit', {
      name: '',
      days: [0, 1, 2, 3, 4, 5, 6],
      weeklyGoal: '',
      icon: DEFAULT_HABIT_ICON,
      color: HABIT_COLORS[S.habits.length % HABIT_COLORS.length],
    }),
  'habit-delete': (el) => {
    const habit = S.habits.find((item) => item.id === el.dataset.id);
    if (!habit) return;
    if (ui.confirmedAction !== 'habit-delete')
      return requestActionConfirmation(
        'habit-delete',
        { id: habit.id },
        'Excluir hábito?',
        `O hábito "${habit.name}" e o histórico associado irão para a lixeira por 30 dias.`,
        'Excluir hábito',
      );
    const index = S.habits.findIndex((item) => item.id === habit.id);
    if (index < 0) return;
    const entry = moveRecordsToTrash(
      `Hábito: ${habit.name}`,
      [createTrashRecord('habits', habit.id, index, habit)],
      ['habits'],
      () => {
        S.habits.splice(index, 1);
      },
    );
    if (entry) toast('Hábito movido para a lixeira.', 'action', () => restoreTrashEntry(entry.id));
  },
  'habit-delete-dialog': () => {
    const id = ui.dlg?.d?.id;
    if (!id) return;
    if (ui.dlg.dirty) {
      askDiscardDialog(null, () =>
        requestActionConfirmation(
          'habit-delete',
          { id },
          'Excluir hábito?',
          `O hábito "${S.habits.find((item) => item.id === id)?.name || 'selecionado'}" e o histórico associado irão para a lixeira por 30 dias.`,
          'Excluir hábito',
        ),
      );
      return;
    }
    requestActionConfirmation(
      'habit-delete',
      { id },
      'Excluir hábito?',
      `O hábito "${S.habits.find((item) => item.id === id)?.name || 'selecionado'}" e o histórico associado irão para a lixeira por 30 dias.`,
      'Excluir hábito',
    );
  },
  'habit-edit-open': (el) => {
    const habit = S.habits.find((item) => item.id === el.dataset.id);
    if (habit && !isWaterHabit(habit) && !isWeightHabit(habit)) {
      const entryType = habitEntryType(habit);
      dlgOpen('habit-edit', {
        id: habit.id,
        name: habit.name,
        days: [...habit.days],
        weeklyGoal: habit.weeklyGoal || '',
        entryType,
        entryOptions: habitEntryOptions(habit),
        entryValue: habitEntryForDay(habit, today()),
        icon: habit.icon || DEFAULT_HABIT_ICON,
        color: habit.color || DEFAULT_HABIT_COLOR,
      });
      return;
    }
    if (habit && isWeightHabit(habit)) {
      const todayEntry = S.weight.find((entry) => entry.date === today());
      dlgOpen('habit-edit', {
        id: habit.id,
        name: habit.name,
        days: [...habit.days],
        weeklyGoal: habit.weeklyGoal || '',
        tracking: 'weight',
        weightEntry: true,
        weightKg: todayEntry ? String(todayEntry.kg).replace('.', ',') : '',
        icon: habit.icon || DEFAULT_HABIT_ICON,
        color: habit.color || DEFAULT_HABIT_COLOR,
      });
      return;
    }
    if (habit)
      dlgOpen('habit-edit', {
        id: habit.id,
        name: habit.name,
        days: [...habit.days],
        weeklyGoal: habit.weeklyGoal || '',
        ...(isWaterHabit(habit)
          ? {
              waterSuggestion: true,
              waterWeightPersistent: true,
              waterWeightKg: S.settings.profile.weightKg ? String(S.settings.profile.weightKg).replace('.', ',') : '',
              waterGoalMl: waterGoalForHabit(habit, S.settings.prefs.waterGoalMl),
              waterGoalEdited: false,
            }
          : {}),
        icon: habit.icon || DEFAULT_HABIT_ICON,
        color: habit.color || DEFAULT_HABIT_COLOR,
      });
  },
  'habit-toggle-pause': (el) => {
    const habit = S.habits.find((item) => item.id === el.dataset.id);
    if (!habit || habit.status === 'archived') return;
    if (ui.dlg?.d?.id === habit.id && ui.dlg.dirty) {
      const id = habit.id;
      askDiscardDialog(null, () => ACTIONS['habit-toggle-pause']({ dataset: { id } }));
      return;
    }
    if ((habit.status || 'active') === 'active') {
      habit.status = 'paused';
      habit.pausedFrom = today();
      habit.pausedDays = [...habit.days];
    } else {
      if (isDay(habit.pausedFrom)) {
        const pausedDays = new Set(habit.skipped || []);
        const scheduledDays = Array.isArray(habit.pausedDays) ? habit.pausedDays : habit.days;
        const pauseLength = Math.min(Math.max(dayDiff(today(), habit.pausedFrom) + 1, 0), 10000);
        for (let offset = 0; offset < pauseLength; offset++) {
          const day = addDays(habit.pausedFrom, offset);
          if (
            scheduledDays.includes(pk(day).getDay()) &&
            !habit.completions.includes(day) &&
            (pausedDays.size < 10000 || pausedDays.has(day))
          )
            pausedDays.add(day);
        }
        habit.skipped = [...pausedDays].sort();
        delete habit.pausedFrom;
      }
      delete habit.pausedDays;
      habit.status = 'active';
    }
    if (ui.dlg?.d?.id === habit.id) ui.dlg = null;
    commit('habits');
    toast(habit.status === 'paused' ? 'Hábito pausado.' : 'Hábito retomado.', 'info');
  },
  'habit-archive': (el) => {
    const habit = S.habits.find((item) => item.id === el.dataset.id);
    if (!habit || habit.status === 'archived') return;
    if (ui.dlg?.d?.id === habit.id && ui.dlg.dirty) {
      const id = habit.id;
      askDiscardDialog(null, () => ACTIONS['habit-archive']({ dataset: { id } }));
      return;
    }
    const previousStatus = habit.status || 'active';
    habit.status = 'archived';
    if (ui.dlg?.d?.id === habit.id) ui.dlg = null;
    commit('habits');
    toast('Hábito arquivado. O histórico foi preservado.', 'action', () => {
      habit.status = previousStatus;
      commit('habits');
    });
  },
  'habit-restore': (el) => {
    const habit = S.habits.find((item) => item.id === el.dataset.id);
    if (!habit || habit.status !== 'archived') return;
    if (ui.dlg?.d?.id === habit.id && ui.dlg.dirty) {
      const id = habit.id;
      askDiscardDialog(null, () => ACTIONS['habit-restore']({ dataset: { id } }));
      return;
    }
    habit.status = 'active';
    if (ui.dlg?.d?.id === habit.id) ui.dlg = null;
    commit('habits');
    toast('Hábito restaurado.', 'success');
  },
  'habit-month': (el) => {
    const next = shiftMonth(ui.habitMonth, Number(el.dataset.n));
    if (next > today().slice(0, 7)) return;
    ui.habitMonth = next;
    render();
  },
  'retry-habits-template': () => {
    requestHabitsTemplate();
    render();
  },
};
