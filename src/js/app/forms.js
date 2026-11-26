import { $ } from '../utils/dom.js';
import { isDay, shortDate, today } from '../utils/dates.js';
import { newId } from '../utils/ids.js';
import { postSignOutPath } from '../core/router.js';
import { taskIconKey } from '../features/planning/task-icons.js';
import { createCycleDataConsentMetadata, hasCurrentCycleDataConsent } from '../services/cycle-consent.js';
import {
  createCyclePeriod,
  cycleLogDays,
  MAX_CYCLE_LOG_RANGE_DAYS,
  MAX_CYCLE_PERIOD_DAYS,
  mergeCycleLogSymptoms,
} from '../features/cycle/period.js';
import { HOME_BLOCK_IDS, HOME_MESSAGE_MAX_LENGTH } from '../features/home/personalization.js';
import {
  applyWeightToWaterHabits,
  HABIT_COLORS,
  HABIT_ENTRY_TYPES,
  HABIT_ICON_KEYS,
  habitEntryOptions,
  habitEntryType,
  isWaterHabit,
} from '../features/habits/model.js';
import {
  estimateWaterGoal,
  isValidWaterGoalMl,
  parseWaterMl,
  parseWaterWeightKg,
  waterGoalForHabit,
} from '../features/habits/water-goal.js';
import { weightChange } from '../features/habits/weight-tracking.js';
import { hexOk } from '../features/appearance/palettes.js';
import { MENU_ITEMS, normalizeVisibleMenuItems } from '../features/navigation/menu.js';
import { REPEATS } from '../features/planning/recurrence.js';
import { parseQuickDate } from '../features/planning/quick-date.js';
import { ACTIONS, focusQuickActionsTrigger, recordWaterEntry } from './actions.js';
import { isTime, norm, parseTags, plural, PRIO, saveActiveHomeMode } from './core.js';
import { cycleLogDraft, cyclePeriodKey, dayLog, hasAnyLog, syncLatestCycleWeight } from './cycle.js';
import { dlgClose, reviewBulkHabits, reviewBulkTasks } from './dialogs.js';
import { reviewBulkEntry } from './finance-dialogs.js';
import { resetGoogleCalendarState } from './google-agenda.js';
import { updateHabitIdeaFilters } from './habits.js';
import { homeFirstTaskSlices } from './home.js';
import {
  commit,
  loadAccountData,
  Persist,
  restoreSliceSnapshot,
  saveSlices,
  saveSlicesWithRollback,
  snapshotSlices,
} from './persistence.js';
import { render } from './render.js';
import { findTask, importFile, mkTask, toast } from './samples-backup.js';
import { areaOn, fieldError, setAreaEnabled } from './shell.js';
import { setIntentionalSignOut } from './startup.js';
import {
  accountSession,
  catNames,
  currentProfileAge,
  isValidCycleLog,
  S,
  saveProfileDraft,
  saveSettingsDraft,
  settingsView,
  ui,
  updateSettingsDraft,
} from './state.js';

// Formulários
export const num = (v) => Number(String(v).replace(',', '.'));
async function deleteAccountFromSettings(form) {
  const submit = document.querySelector('[data-account-delete-submit]');
  const message = form.querySelector('[data-account-delete-message]');
  const showError = (text) => {
    message.textContent = text;
    message.hidden = false;
    if (submit) submit.disabled = false;
    if (ui.dlg?.type === 'account-delete') ui.dlg.d.pending = false;
  };
  if (!accountSession) return showError('Entre na conta que deseja excluir.');
  if (ui.legacyImport.busy) return showError('Aguarde a importação terminar antes de excluir a conta.');
  if (String(new FormData(form).get('deleteConfirmation') || '') !== 'EXCLUIR') {
    return showError('Digite EXCLUIR exatamente como aparece para confirmar.');
  }

  if (submit) submit.disabled = true;
  if (ui.dlg?.type === 'account-delete') ui.dlg.d.pending = true;
  try {
    if (!(await Persist.flush())) {
      showError(
        'Não foi possível confirmar a sincronização dos dados. Nenhuma exclusão foi solicitada; tente novamente quando a sincronização estiver concluída.',
      );
      return;
    }

    const { requestAccountDeletion } = await import('../services/account-auth.js');
    if (!(await requestAccountDeletion(accountSession.client))) {
      showError(
        'O Aurora não recebeu confirmação da exclusão. Verifique a conexão e o estado da conta antes de tentar novamente.',
      );
      return;
    }

    try {
      const registration = await navigator.serviceWorker?.getRegistration();
      const subscription = await registration?.pushManager?.getSubscription();
      if (subscription && !(await subscription.unsubscribe())) {
        throw new Error('O navegador não confirmou a remoção da inscrição Push local.');
      }
    } catch (error) {
      console.error('Aurora: a conta foi excluída, mas a inscrição Push local não foi removida.', error);
    }
    setIntentionalSignOut(true);
    try {
      const { error } = await accountSession.client.auth.signOut({ scope: 'local' });
      if (error) console.error('Aurora: a conta foi excluída, mas a sessão local não foi encerrada.', error);
    } catch (error) {
      console.error('Aurora: a conta foi excluída, mas a sessão local não foi encerrada.', error);
    }
    Persist.wipe();
    resetGoogleCalendarState();
    history.replaceState(null, '', postSignOutPath(location));
    location.reload();
  } catch (error) {
    console.error('Aurora: não foi possível confirmar a exclusão permanente da conta.', error);
    showError('Não foi possível confirmar a exclusão. Verifique o estado da conta antes de tentar novamente.');
  }
}
export const FORMS = {
  'dlg-taskbulk': () => reviewBulkTasks(),
  'dlg-habitbulk': () => reviewBulkHabits(),
  'dlg-txbulk': () => reviewBulkEntry(),
  'finance-category-rule': (form, data) => {
    const phrase = String(data.get('phrase') || '')
      .trim()
      .slice(0, 80);
    const kind = ui.dlg?.d?.ruleKind === 'in' ? 'in' : 'out';
    const category = String(data.get('category') || '').trim();
    if (!phrase) return toast('Informe uma frase para reconhecer.', 'warning');
    if (!catNames(kind).includes(category))
      return toast('Escolha uma categoria válida para o tipo selecionado.', 'warning');
    const rules = S.settings.prefs.financeCategoryRules;
    if (rules.length >= 50) return toast('Você pode configurar até 50 regras de categoria.', 'warning');
    if (rules.some((rule) => rule.kind === kind && norm(rule.phrase) === norm(phrase))) {
      return toast('Já existe uma regra com essa frase para este tipo.', 'info');
    }
    const snapshot = snapshotSlices(['settings']);
    rules.unshift({ id: newId(), phrase, category, kind });
    if (!saveSlicesWithRollback(['settings'], snapshot, false, 'a regra de categoria')) return;
    ui.dlg.d.ruleCategory = category;
    ui.dlg.dirty = false;
    render();
    toast('Regra automática adicionada.', 'success');
  },
  'cycle-data-consent': async (form) => {
    const checkbox = form.elements.namedItem('cycleConsent');
    if (!(checkbox instanceof HTMLInputElement) || !checkbox.checked) return;
    if (ui.cycleConsentBusy || !accountSession?.client?.auth?.updateUser) {
      ui.cycleConsentError =
        'Não foi possível acessar a conta para registrar o consentimento. Atualize a página e tente novamente.';
      render();
      return;
    }
    ui.cycleConsentBusy = true;
    ui.cycleConsentError = '';
    render();
    let consentRecorded = false;
    try {
      if (!(await Persist.flush())) {
        throw new Error('Sincronize as alterações da conta antes de abrir Ciclo.');
      }
      const { data, error } = await accountSession.client.auth.updateUser({
        data: createCycleDataConsentMetadata(),
      });
      if (error) throw error;
      if (!data?.user || data.user.id !== accountSession.user?.id || !hasCurrentCycleDataConsent(data.user)) {
        throw new Error('O provedor não confirmou o consentimento para dados de Ciclo.');
      }
      accountSession.user = data.user;
      consentRecorded = true;
      await loadAccountData();
    } catch (error) {
      console.error('Aurora: não foi possível registrar o consentimento para dados de Ciclo.', error);
      ui.cycleConsentError = consentRecorded
        ? 'Seu consentimento foi registrado, mas os dados de Ciclo não puderam ser carregados. Atualize a página para tentar novamente.'
        : 'Não foi possível registrar seu consentimento. Seus dados não foram alterados; confira a conexão e tente novamente.';
    } finally {
      ui.cycleConsentBusy = false;
      render();
      if (consentRecorded) requestAnimationFrame(() => window.scrollTo(0, 0));
    }
  },
  'account-delete': deleteAccountFromSettings,
  'water-add': (f, d) => {
    const habit = S.habits.find((item) => item.id === f.dataset.id);
    if (!habit || !isWaterHabit(habit) || habit.status !== 'active') {
      return toast('Este hábito de água não está disponível para registro.', 'info');
    }
    const amount = parseWaterMl(d.get('amount'));
    if (amount === null) return fieldError('Informe um volume inteiro entre 1 e 10.000 mL.', '[name="amount"]');
    recordWaterEntry(amount, habit);
  },
  'home-quick-task': (f, d) => {
    const title = String(d.get('title') || '').trim();
    if (!title) return toast('Escreva uma tarefa.', 'info');
    const kind = String(d.get('kind') || 'task');
    if (!['task', 'appointment'].includes(kind)) return toast('Escolha um tipo de registro válido.', 'info');
    const priority = String(d.get('priority') || 'normal');
    if (!Object.hasOwn(PRIO, priority)) return toast('Escolha uma prioridade válida.', 'info');
    const date = parseQuickDate(title, today());
    if (date.error) return toast(date.error, 'info');
    if (!date.title) return toast('Escreva o título da tarefa além da data.', 'info');
    if (kind === 'appointment' && (!date.recognized || !date.time)) {
      return toast('Para registrar um compromisso, informe o dia e a hora, como “amanhã 14h”.', 'info');
    }
    const parsed = parseTags(date.title);
    const tags =
      kind === 'appointment'
        ? ['Compromisso', ...parsed.tags.filter((tag) => norm(tag) !== norm('Compromisso')).slice(0, 11)]
        : parsed.tags;
    const slices = homeFirstTaskSlices();
    S.tasks.push(
      mkTask({
        title: parsed.title,
        dueDate: date.date,
        priority,
        ...(date.time ? { time: date.time } : {}),
        ...(tags.length ? { tags } : {}),
      }),
    );
    const saved = saveSlices(...slices);
    render();
    if (saved) {
      const deadline = date.date === today() ? 'hoje' : shortDate(date.date);
      toast(
        `${kind === 'appointment' ? 'Compromisso registrado' : 'Tarefa adicionada'} para ${deadline}${date.time ? ` às ${date.time}` : ''}.`,
        'success',
      );
      requestAnimationFrame(() => $('#home-quick-title-input')?.focus());
    }
  },
  'settings-save': saveSettingsDraft,
  'settings-profile': saveProfileDraft,
  habit: (f, d) => {
    const name = String(d.get('name') || '').trim();
    const days = [...new Set(d.getAll('days').map(Number))].sort((a, b) => a - b);
    const weeklyGoal = Number(d.get('weeklyGoal') || 0);
    if (!name) return toast('Dê um nome ao hábito.', 'info');
    if (!days.length || days.some((day) => !Number.isInteger(day) || day < 0 || day > 6))
      return toast('Selecione pelo menos um dia válido.', 'error');
    if (S.habits.some((habit) => norm(habit.name) === norm(name)))
      return toast('Você já acompanha um hábito com esse nome.', 'info');
    S.habits.push({
      id: newId(),
      name: name.slice(0, 60),
      days,
      completions: [],
      createdAt: Date.now(),
      status: 'active',
      ...(weeklyGoal ? { weeklyGoal } : {}),
    });
    f.reset();
    f.querySelectorAll('input[name="days"]').forEach((input) => {
      input.checked = true;
    });
    const saved = saveSlices('habits');
    render();
    if (saved) toast('Hábito adicionado.', 'success');
  },
  'habit-edit': (f, d) => {
    const draft = ui.dlg?.d;
    let habit = S.habits.find((item) => item.id === draft?.id);
    if (draft?.entryPrompt) {
      const entryType = HABIT_ENTRY_TYPES.includes(d.get('entryType')) ? d.get('entryType') : habitEntryType(habit);
      const entryValue = String(d.get('entryValue') || '').trim();
      if (!entryValue)
        return fieldError(
          entryType === 'text' ? 'Escreva o registro de hoje.' : 'Escolha uma opção.',
          '[data-dlg="entryValue"]',
        );
      if (entryType === 'select' && !habitEntryOptions(habit).includes(entryValue)) {
        return fieldError('Escolha uma opção válida.', '[data-dlg="entryValue"]');
      }
      const day = today();
      const snapshot = snapshotSlices(['habits']);
      const entries = (habit.entries || []).filter((entry) => entry.day !== day);
      entries.push({ day, value: entryValue });
      habit.entries = entries.sort((a, b) => a.day.localeCompare(b.day));
      if (!habit.completions.includes(day)) habit.completions = [...habit.completions, day].sort();
      if (!saveSlicesWithRollback(['habits'], snapshot, false, 'o registro do hábito')) return;
      ui.dlg = null;
      render();
      toast(`${entryValue}`, 'success');
      return;
    }
    if (draft?.weightEntry) {
      const weightKg = parseWaterWeightKg(d.get('weightKg'));
      if (weightKg === null) return fieldError('O peso deve estar entre 20 e 400 kg.', '[data-dlg="weightKg"]');
      const day = today();
      const name = String(d.get('name') || '').trim();
      if (!name) return fieldError('Dê um nome ao hábito.', '[data-dlg="name"]');
      const days = [...new Set(d.getAll('days').map(Number))].sort((a, b) => a - b);
      if (!days.length || days.some((value) => !Number.isInteger(value) || value < 0 || value > 6)) {
        return fieldError('Selecione pelo menos um dia válido.', '[name="days"]');
      }
      if (S.habits.some((item) => item.id !== draft?.id && norm(item.name) === norm(name))) {
        return fieldError('Você já acompanha um hábito com esse nome.', '[data-dlg="name"]');
      }
      const change = weightChange(S.weight, day, weightKg);
      const snapshot = snapshotSlices(['habits', 'weight', 'settings']);
      if (habit) {
        habit.name = name.slice(0, 60);
        habit.days = days;
        habit.tracking = 'weight';
        if (!habit.completions.includes(day)) habit.completions = [...habit.completions, day].sort();
      } else {
        habit = {
          id: newId(),
          name: name.slice(0, 60),
          days,
          completions: [day],
          createdAt: Date.now(),
          status: 'active',
          tracking: 'weight',
        };
        S.habits.push(habit);
      }
      const existing = S.weight.find((entry) => entry.date === day);
      if (existing) existing.kg = weightKg;
      else S.weight.push({ id: newId(), date: day, kg: weightKg });
      S.weight.sort((a, b) => a.date.localeCompare(b.date));
      S.settings.profile.weightKg = weightKg;
      const waterGoalMl = applyWeightToWaterHabits(S.habits, weightKg, currentProfileAge(S.settings));
      if (!saveSlicesWithRollback(['habits', 'weight', 'settings'], snapshot, false, 'a pesagem')) return;
      ui.dlg = null;
      render();
      const kg = (value) => value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
      const message = !change
        ? `Peso registrado: ${kg(weightKg)} kg.`
        : change.direction === 'loss'
          ? `Você perdeu ${kg(change.difference)} kg desde a última medição.`
          : change.direction === 'gain'
            ? `Você ganhou ${kg(change.difference)} kg desde a última medição.`
            : 'Seu peso permaneceu igual à última medição.';
      const waterNote = waterGoalMl ? ` A meta de água agora é ${waterGoalMl.toLocaleString('pt-BR')} mL.` : '';
      toast(message + waterNote, 'success');
      return;
    }
    const name = String(d.get('name') || '').trim();
    const days = [...new Set(d.getAll('days').map(Number))].sort((a, b) => a - b);
    const weeklyGoal = Number(d.get('weeklyGoal') || 0);
    const pickedIcon = String(d.get('icon') || '');
    const pickedColor = String(d.get('color') || '').toLowerCase();
    const look = {
      ...(HABIT_ICON_KEYS.includes(pickedIcon) ? { icon: pickedIcon } : {}),
      ...(HABIT_COLORS.includes(pickedColor) ? { color: pickedColor } : {}),
    };
    if (!name) return fieldError('Dê um nome ao hábito.', '[data-dlg="name"]');
    const waterWeightInput = String(d.get('waterWeightKg') || '').trim();
    if (
      (draft?.waterSuggestion || draft?.waterWeightPersistent) &&
      waterWeightInput &&
      parseWaterWeightKg(waterWeightInput) === null
    ) {
      return fieldError('O peso deve estar entre 20 e 400 kg.', '[data-dlg="waterWeightKg"]');
    }
    if (!days.length || days.some((day) => !Number.isInteger(day) || day < 0 || day > 6))
      return fieldError('Selecione pelo menos um dia válido.', '[name="days"]');
    if (weeklyGoal && (!Number.isInteger(weeklyGoal) || weeklyGoal < 1 || weeklyGoal > days.length))
      return toast('A meta semanal não pode passar do número de dias escolhidos.', 'error');
    if (S.habits.some((item) => item.id !== draft?.id && norm(item.name) === norm(name)))
      return fieldError('Você já acompanha um hábito com esse nome.', '[data-dlg="name"]');
    if (draft?.id && !habit) return dlgClose();
    let configuredEntryType = habit ? habitEntryType(habit) : 'check';
    let configuredEntryOptions = habit ? habitEntryOptions(habit) : [];
    if (!draft?.weightEntry && !draft?.entryPrompt) {
      const entryType = HABIT_ENTRY_TYPES.includes(d.get('entryType')) ? d.get('entryType') : 'check';
      const entryOptions =
        entryType === 'select'
          ? String(d.get('entryOptions') || '')
              .split('\n')
              .map((option) => option.trim())
              .filter(Boolean)
              .slice(0, 20)
          : [];
      if (entryType === 'select' && entryOptions.length < 2) {
        return fieldError('Informe pelo menos duas opções, uma por linha.', '[data-dlg="entryOptions"]');
      }
      configuredEntryType = entryType;
      configuredEntryOptions = entryOptions;
    }
    const tracksWater = Boolean(
      draft?.tracking === 'water' || draft?.waterSuggestion || isWaterHabit(habit) || isWaterHabit({ name }),
    );
    let waterGoalMl = tracksWater
      ? Number(
          d.has('waterGoalMl')
            ? d.get('waterGoalMl')
            : habit
              ? waterGoalForHabit(habit, S.settings.prefs.waterGoalMl)
              : S.settings.prefs.waterGoalMl,
        )
      : null;
    if (tracksWater && !isValidWaterGoalMl(waterGoalMl)) {
      return fieldError('A meta deve ser um valor inteiro entre 500 e 10.000 mL.', '[data-dlg="waterGoalMl"]');
    }
    const persistentWeight = draft?.waterWeightPersistent ? parseWaterWeightKg(waterWeightInput) : null;
    const weightSnapshot =
      draft?.waterWeightPersistent && waterWeightInput && persistentWeight !== null
        ? snapshotSlices(['habits', 'settings'])
        : null;
    if (draft?.waterWeightPersistent && waterWeightInput && persistentWeight !== null) {
      S.settings.profile.weightKg = persistentWeight;
      if (!draft.waterGoalEdited) {
        const estimate = estimateWaterGoal({ weightKg: persistentWeight, age: currentProfileAge(S.settings) });
        if (estimate) waterGoalMl = estimate.ml;
      }
    }
    const recordWaterAfterSave = !draft?.id && draft?.recordWaterAfterSave === true;
    const enableHabits = recordWaterAfterSave && draft.enableHabits && !areaOn('habits');
    const slices = ['habits', ...(enableHabits || draft?.waterWeightPersistent ? ['settings'] : [])];
    const snapshot = recordWaterAfterSave ? snapshotSlices(slices) : weightSnapshot;
    if (habit) {
      Object.assign(habit, {
        name: name.slice(0, 60),
        days,
        ...look,
        entryType: configuredEntryType,
        ...(configuredEntryType === 'select' ? { entryOptions: configuredEntryOptions } : { entryOptions: [] }),
        ...(tracksWater ? { tracking: 'water', waterGoalMl } : {}),
      });
      delete habit.remind;
      if (weeklyGoal) habit.weeklyGoal = weeklyGoal;
      else delete habit.weeklyGoal;
    } else {
      habit = {
        id: newId(),
        name: name.slice(0, 60),
        days,
        completions: [],
        entries: [],
        createdAt: Date.now(),
        status: 'active',
        entryType: configuredEntryType,
        ...(configuredEntryType === 'select' ? { entryOptions: configuredEntryOptions } : {}),
        ...look,
        ...(tracksWater ? { tracking: 'water', waterGoalMl } : {}),
        ...(weeklyGoal ? { weeklyGoal } : {}),
      };
      S.habits.push(habit);
    }
    if (recordWaterAfterSave) {
      if (enableHabits) {
        if (!setAreaEnabled(S.settings, 'habits', true)) {
          restoreSliceSnapshot(snapshot);
          return toast('Não foi possível ativar Hábitos para acompanhar a água.', 'error');
        }
      }
      if (!saveSlicesWithRollback(slices, snapshot, false, 'o acompanhamento de água')) return;
      ui.dlg = null;
      render();
      if (recordWaterEntry(parseWaterMl('250'), habit)) focusQuickActionsTrigger();
      return;
    }
    ui.dlg = null;
    const saved = snapshot
      ? saveSlicesWithRollback(slices, snapshot, false, 'o peso e a meta de água')
      : saveSlices('habits');
    render();
    if (saved) toast(habit ? 'Hábito atualizado.' : 'Hábito adicionado.', 'success');
  },
  'tg-add': (f, d) => {
    const v = String(d.get('tg') || '')
      .trim()
      .replace(/^#/, '')
      .toLowerCase()
      .replace(/[^\p{L}\d_-]/gu, '')
      .slice(0, 24);
    if (!v) return;
    const a = (ui.dlg.d.tags = ui.dlg.d.tags || []);
    if (!a.includes(v)) a.push(v);
    render();
    const i = $('#tgn');
    if (i) i.focus();
  },
  'st-add': (f, d) => {
    const v = String(d.get('st') || '')
      .trim()
      .slice(0, 100);
    if (!v) return;
    (ui.dlg.d.subs = ui.dlg.d.subs || []).push({ id: newId(), title: v, done: false });
    render();
    const i = $('#stn');
    if (i) i.focus();
  },
  'dlg-task': () => {
    const d = ui.dlg.d,
      title = String(d.title || '').trim();
    if (!title) return fieldError('Escreva um título.', '[data-dlg="title"]');
    const parsed = parseTags(title),
      repeat = REPEATS[d.repeat] && d.repeat !== 'none' ? d.repeat : null;
    if (document.querySelector('#dlg [data-dlg="time"]')?.validity.badInput || (d.time && !isTime(d.time)))
      return fieldError('Informe uma hora válida.', '[data-dlg="time"]');
    const time = isTime(d.time) ? d.time : null;
    if ((repeat || time) && !isDay(d.due))
      return fieldError('Defina um prazo para repetir ou ter horário.', '[data-dlg="due"]');
    if (d.due && !isDay(d.due)) return fieldError('Informe um prazo válido.', '[data-dlg="due"]');
    const dueDate = isDay(d.due) ? d.due : null;
    const priority = ['high', 'normal', 'low'].includes(d.priority) ? d.priority : 'normal';
    if (d.create) {
      const tags = [...new Set([...(Array.isArray(d.tags) ? d.tags : []), ...parsed.tags])];
      const slices = homeFirstTaskSlices();
      S.tasks.push(
        mkTask({
          title: parsed.title,
          dueDate,
          priority,
          ...(repeat ? { repeat } : {}),
          ...(time ? { time } : {}),
          ...(tags.length ? { tags } : {}),
          ...(taskIconKey(d.icon) ? { icon: taskIconKey(d.icon) } : {}),
          ...(Array.isArray(d.subs) && d.subs.length ? { subtasks: d.subs.map((item) => ({ ...item })) } : {}),
          ...(String(d.notes || '').trim() ? { notes: String(d.notes).trim().slice(0, 2000) } : {}),
        }),
      );
      ui.dlg = null;
      const saved = saveSlices(...slices);
      render();
      if (saved) toast('Tarefa adicionada.', 'success');
      return;
    }
    const t = findTask(d.id);
    if (!t) return dlgClose();
    Object.assign(t, {
      title,
      dueDate,
      priority,
      repeat: repeat || undefined,
      time: time || undefined,
      subtasks: (d.subs || []).length ? d.subs : undefined,
      tags: (d.tags || []).length ? d.tags : undefined,
      notes: (d.notes || '').trim().slice(0, 2000) || undefined,
    });
    delete t.remind;
    if (taskIconKey(d.icon)) t.icon = taskIconKey(d.icon);
    else delete t.icon;
    ui.dlg = null;
    commit('tasks');
  },
  'cycle-log': () => {
    const { day, log: draft } = ui.dlg.d;
    const log = cycleLogDraft(draft);
    if (typeof log.orgasmCount === 'string') {
      if (!log.orgasmCount.trim()) delete log.orgasmCount;
      else if (/^\d{1,2}$/.test(log.orgasmCount)) log.orgasmCount = Number(log.orgasmCount);
    }
    if (typeof log.weightKg === 'string') {
      const value = log.weightKg.trim();
      if (!value) delete log.weightKg;
      else {
        const weightKg = parseWaterWeightKg(value);
        if (weightKg === null) return fieldError('O peso deve estar entre 20 e 400 kg.', '[data-dlg="log.weightKg"]');
        log.weightKg = weightKg;
      }
    }
    if (!isDay(day) || day > today() || !isValidCycleLog(log)) return toast('Revise o registro do ciclo.', 'info');
    if (typeof log.note === 'string') {
      log.note = log.note.trim().slice(0, 500);
      if (!log.note) delete log.note;
    }
    if (log.sexualActivity !== true) {
      delete log.contraceptionMethods;
    } else if (!log.contraceptionMethods?.length) {
      delete log.contraceptionMethods;
    }
    if (!log.masturbationActivity) delete log.masturbationActivity;
    if (!log.sexToysUsed) delete log.sexToysUsed;
    const previousWeight = dayLog(day).weightKg;
    const weightChanged = previousWeight !== log.weightKg;
    const slices = weightChanged ? ['cycleLog', 'settings', 'habits'] : ['cycleLog'];
    const snapshot = snapshotSlices(slices);
    if (hasAnyLog(log)) S.cycleLog[day] = log;
    else delete S.cycleLog[day];
    if (weightChanged && Object.values(S.cycleLog).some((entry) => Number.isFinite(entry?.weightKg))) {
      syncLatestCycleWeight();
    }
    if (!saveSlicesWithRollback(slices, snapshot, false, 'registro do ciclo')) return;
    ui.cycDay = day;
    ui.dlg = null;
    render();
    toast('Registro do dia atualizado.', 'success');
  },
  'cycle-period': (f, d) => {
    const period = createCyclePeriod(String(d.get('start') || ''), String(d.get('end') || ''), today());
    if (!period)
      return toast(`Informe um intervalo válido, de até ${MAX_CYCLE_PERIOD_DAYS} dias, que termine até hoje.`, 'error');
    const draft = ui.dlg.d;
    const index = Number.isInteger(draft.index) ? draft.index : -1;
    const current = index >= 0 ? S.cycle[index] : null;
    if (
      index >= 0 &&
      (!current || current.start !== draft.originalStart || (current.end || '') !== draft.originalEnd)
    ) {
      return toast('Este período mudou desde que você abriu a edição. Feche e tente novamente.', 'info');
    }
    if (S.cycle.some((item, itemIndex) => itemIndex !== index && cyclePeriodKey(item) === cyclePeriodKey(period))) {
      return toast('Esse período já está registrado.', 'info');
    }
    if (current) S.cycle[index] = { ...current, ...period };
    else S.cycle.push(period);
    ui.cycDay = period.start;
    ui.calMonth = period.start.slice(0, 7);
    ui.dlg = null;
    const saved = saveSlices('cycle');
    render();
    if (saved) toast(current ? 'Período atualizado.' : 'Período registrado.', 'success');
  },
  'cycle-batch': (f, d) => {
    const days = cycleLogDays(String(d.get('start') || ''), String(d.get('end') || ''), today());
    if (!days)
      return toast(
        `Informe um intervalo válido de até ${MAX_CYCLE_LOG_RANGE_DAYS} dias, que termine até hoje.`,
        'error',
      );
    const symptoms = ui.dlg.d.symptoms;
    const selections = Object.fromEntries(
      Object.entries(symptoms).map(([category, values]) => [category, [...new Set(values)]]),
    );
    if (!Object.values(selections).some((values) => values.length))
      return toast('Selecione pelo menos um sintoma.', 'error');
    for (const day of days) {
      S.cycleLog[day] = mergeCycleLogSymptoms(dayLog(day), selections);
    }
    ui.cycDay = days[days.length - 1];
    ui.calMonth = ui.cycDay.slice(0, 7);
    ui.dlg = null;
    const saved = saveSlices('cycleLog');
    render();
    if (saved) toast(`Sintomas adicionados a ${days.length} ${plural(days.length, 'dia', 'dias')}.`, 'success');
  },
};
export const CHANGES = {
  'plan-view': (el) => ACTIONS['plan-view']({ dataset: { v: el.value } }),
  'finance-rule-kind': (el) => {
    if (ui.dlg?.type !== 'category-manager' || !['in', 'out'].includes(el.value)) return;
    ui.dlg.d.ruleKind = el.value;
    ui.dlg.d.ruleCategory = catNames(el.value)[0] || '';
    render();
  },
  'annual-plan-year': (el) => {
    if (!/^\d{4}$/.test(el.value) || Number(el.value) < 2026) return;
    ui.annualYear = el.value;
    ui.annualEditingGoalId = '';
    ui.annualGoalFormOpen = false;
    ui.annualGoalDraft = null;
    render();
  },
  'habit-idea-category': (el) => {
    ui.habitIdeaCategory = el.value || 'all';
    updateHabitIdeaFilters();
  },
  'habit-idea-context': (el) => {
    ui.habitIdeaTag = el.value || 'all';
    updateHabitIdeaFilters();
  },
  'legacy-import-cleanup-confirm': (el) => {
    ui.legacyImport.cleanupConfirmed = el.checked;
    const button = $('#legacy-import-clear');
    if (button) button.disabled = !el.checked || ui.legacyImport.busy;
  },
  sort: (el) => {
    ui.filters.sort = el.value;
    render();
  },
  area: (el) =>
    updateSettingsDraft((settings) => {
      setAreaEnabled(settings, el.dataset.area, el.checked);
    }),
  'menu-visible': (el) => {
    const id = el.dataset.menuId;
    if (!MENU_ITEMS.some((item) => item.id === id && item.area)) return;
    const visible = new Set(settingsView().prefs.visibleMenuItems);
    if (el.checked) visible.add(id);
    else visible.delete(id);
    updateSettingsDraft((settings) => {
      settings.prefs.visibleMenuItems = normalizeVisibleMenuItems([...visible]);
    });
  },
  'home-block-visible': (el) => {
    const id = el.dataset.homeBlock;
    if (!HOME_BLOCK_IDS.includes(id)) return;
    updateSettingsDraft((settings) => {
      const visible = new Set(settings.prefs.homeLayout.visible);
      if (el.checked) visible.add(id);
      else visible.delete(id);
      settings.prefs.homeLayout.visible = HOME_BLOCK_IDS.filter((blockId) => visible.has(blockId));
      saveActiveHomeMode(settings);
    });
  },
  'home-message': (el) => {
    updateSettingsDraft((settings) => {
      settings.prefs.homeMessage = el.value.slice(0, HOME_MESSAGE_MAX_LENGTH);
    }, false);
  },
  'look-custom': (el) => {
    if (hexOk(el.value))
      updateSettingsDraft((settings) => {
        settings.look.custom = el.value;
        settings.theme = 'custom';
      });
  },
  'look-contrast': (el) =>
    updateSettingsDraft((settings) => {
      settings.look.contrast = el.checked;
    }),
  'look-readable': (el) =>
    updateSettingsDraft((settings) => {
      settings.look.readable = el.checked;
    }),
  'look-highlight-links': (el) =>
    updateSettingsDraft((settings) => {
      settings.look.highlightLinks = el.checked;
    }),
  'look-motion': (el) =>
    updateSettingsDraft((settings) => {
      settings.look.reduceMotion = el.checked;
    }),
  import: (el) => {
    const f = el.files && el.files[0];
    void importFile(f);
    el.value = '';
  },
};
export const SETTINGS_INPUT_CHANGES = new Set(['home-message']);

// Salvar sem trocar a tela debaixo do dedo (campos de texto salvam ao sair do campo)
const flushDirty = () => {
  if (ui.dirty) {
    ui.dirty = false;
    clearTimeout(ui.dirtyT);
    render();
  }
};

export function registerForms() {
  document.addEventListener('click', () => setTimeout(flushDirty, 0));
}
