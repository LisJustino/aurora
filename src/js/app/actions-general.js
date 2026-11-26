import { $ } from '../utils/dom.js';
import { today } from '../utils/dates.js';
import { taskCompletedOn } from '../features/planning/task-selection.js';
import { AREA_GUIDES } from '../features/area-guides.js';
import { prefersReducedMotion } from '../utils/motion.js';
import { showPwaInstallPrompt } from '../services/pwa-install.js';
import { isWaterHabit } from '../features/habits/model.js';
import { ACTIONS, focusQuickActionsTrigger } from './actions.js';
import {
  CONFIRMABLE_ACTIONS,
  confirmInDialog,
  dlgClose,
  dlgDiscardChanges,
  dlgKeepEditing,
  dlgOpen,
  requestActionConfirmation,
  settleDialogConfirmation,
} from './dialogs.js';
import { newTxDlg } from './finance-dialogs.js';
import { shiftMonth, txListHtml } from './finance-view.js';
import {
  commit,
  deleteTrashEntryPermanently,
  emptyTrashEntries,
  restoreTrashEntries,
  restoreTrashEntry,
  saveSlicesWithRollback,
  snapshotSlices,
} from './persistence.js';
import { showMoreResults } from './planning.js';
import { applyPwaUpdate, nav, openFinanceQuickAction, render, renderPwaUpdateNotice, renderToast } from './render.js';
import { findTask, openTaskDialog, toast } from './samples-backup.js';
import { setAreaEnabled, vibrateFeedback } from './shell.js';
import { S, settingsDraftDirty, settingsView, ui } from './state.js';
import {
  filterTrashEntries,
  isTrashExpired,
  sortTrashEntriesByExpiry,
  trashEntryDisplay,
} from '../features/trash/model.js';

export const GENERAL_ACTIONS = {
  'footer-scroll-top': () => {
    if (prefersReducedMotion(settingsView().look.reduceMotion)) {
      window.scrollTo(0, 0);
      return;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },
  'pwa-install': () => {
    showPwaInstallPrompt();
  },
  'pwa-update-dismiss': () => {
    ui.pwaUpdateDismissed = true;
    renderPwaUpdateNotice();
  },
  'pwa-update-apply': () => {
    void applyPwaUpdate();
  },
  'reload-app': () => {
    const hasUnsavedChanges =
      settingsDraftDirty() || Boolean(ui.profileDraft) || Boolean(ui.dlg?.dirty) || ui.persistFailed.size > 0;
    if (!hasUnsavedChanges) return window.location.reload();
    void confirmInDialog(
      'Há alterações que ainda não foram salvas. Recarregar pode descartá-las. Deseja continuar?',
    ).then((confirmed) => {
      if (confirmed) window.location.reload();
    });
  },
  'transactions-show-more': () => showMoreResults('transactions', '#tx-results', txListHtml),
  'quick-actions-toggle': () => {
    const opening = !ui.quickActionsOpen;
    ui.quickActionsOpen = opening;
    render();
    requestAnimationFrame(() => {
      const target = opening ? document.querySelector('#quick-actions-menu button') : null;
      if (target) target.focus();
      else focusQuickActionsTrigger();
    });
  },
  'quick-action-habit': () => {
    ui.quickActionsOpen = false;
    ACTIONS['habit-new']();
  },
  'quick-action-expense': () => {
    openFinanceQuickAction(() => newTxDlg('out'));
  },
  'quick-action-transaction': () => {
    openFinanceQuickAction(() => newTxDlg('out'));
  },
  'quick-action-finance': (el) => {
    const kind = el.dataset.kind;
    openFinanceQuickAction(() => newTxDlg(kind === 'card' ? 'out' : kind, kind === 'card'));
  },
  'quick-action-account': () => {
    openFinanceQuickAction(() => ACTIONS['acct-new']());
  },
  'areas-nav-open': (_, event) => {
    event.preventDefault();
    nav('config?section=areas-navigation');
  },
  'area-guide-open': (el) => {
    const route = el.dataset.areaGuide;
    if (!AREA_GUIDES[route]) {
      console.error('Aurora: tutorial solicitado para uma área desconhecida.', route);
      toast('Não foi possível abrir o guia desta área.', 'info');
      return;
    }
    dlgOpen('area-tutorial', { route });
  },
  'area-guide-switch': (el) => {
    const route = el.dataset.areaGuide;
    if (!AREA_GUIDES[route] || ui.dlg?.type !== 'area-tutorial') return;
    ui.dlg.d.route = route;
    render();
    requestAnimationFrame(() => {
      document.querySelector(`.area-guide-tab[data-area-guide="${route}"]`)?.focus({ preventScroll: true });
    });
  },
  'release-notes-open': () => {
    dlgOpen('release-notes');
  },
  'first-steps-dismiss': async () => {
    if (!(await confirmInDialog('Dispensar o cartão “Comece em 3 passos”? Ele não aparecerá novamente.'))) return;
    const snapshot = snapshotSlices(['settings']);
    S.settings.prefs.firstStepsDismissed = true;
    S.settings.prefs.firstStepsStarted = true;
    if (!saveSlicesWithRollback(['settings'], snapshot, false, 'a dispensa dos primeiros passos')) return;
    render();
  },
  'feedback-prompt-dismiss': () => {
    ui.feedbackPromptVisible = false;
    render();
  },
  'finance-values-toggle': () => {
    S.settings.prefs.financeValuesHidden = !S.settings.prefs.financeValuesHidden;
    ui.financeValuesHidden = S.settings.prefs.financeValuesHidden;
    commit('settings');
  },
  'finance-week-day': (el) => {
    const day = el.dataset.day;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day || '')) return;
    ui.financeWeekDay = day;
    render();
    document.getElementById(`finance-week-day-${day}`)?.focus({ preventScroll: true });
  },
  'finance-trend-range': (el) => {
    ui.financeTrendRange = el.dataset.v === 'month' ? 'month' : '7d';
    render();
    document
      .querySelector(`[data-action="finance-trend-range"][data-v="${ui.financeTrendRange}"]`)
      ?.focus({ preventScroll: true });
  },
  'search-open': () => dlgOpen('search', { query: '' }),
  'search-clear': () => {
    if (ui.dlg?.type !== 'search') return;
    ui.dlg.d.query = '';
    render();
    requestAnimationFrame(() => $('#f0')?.focus({ preventScroll: true }));
  },
  'search-result': (el) => {
    const query = ui.dlg?.d.query || '';
    ui.dlg = null;
    if (el.dataset.kind === 'action') {
      if (el.dataset.command === 'new-task') {
        openTaskDialog();
        return;
      }
      if (el.dataset.command === 'open-finances') {
        nav('financas');
        return;
      }
      if (el.dataset.command === 'add-water') {
        const habit = S.habits.find((item) => isWaterHabit(item) && item.status === 'active');
        if (!habit) return toast('Não há um hábito de água ativo para registrar.', 'info');
        ui.openDetails[`hab-${habit.id}`] = true;
        nav('habitos');
        requestAnimationFrame(() => document.getElementById(`water-amount-${CSS.escape(habit.id)}`)?.focus());
        return;
      }
    }
    if (el.dataset.kind === 'task') {
      const task = findTask(el.dataset.id);
      if (!task) return toast('Esta tarefa não está mais disponível.', 'info');
      ui.planView = 'lista';
      ui.filters.f = task.done && !taskCompletedOn(task, today()) ? 'historico' : 'todas';
      ui.filters.q = task.title || query;
      nav('planejar');
      return;
    }
    if (el.dataset.kind === 'annual-goal') {
      const [year] = String(el.dataset.id || '').split(':');
      if (!year || !S.settings.prefs.annualPlans?.[year])
        return toast('Esta conquista não está mais disponível.', 'info');
      ui.planView = 'anual';
      ui.annualYear = year;
      nav('planejar');
      return;
    }
    if (el.dataset.kind === 'account') {
      if (!S.finance.accounts.some((account) => account.id === el.dataset.id))
        return toast('Esta conta não está mais disponível.', 'info');
      ui.finTab = 'contas';
      nav('financas');
      return;
    }
    if (el.dataset.kind === 'finance-goal') {
      if (!S.finance.goals.some((goal) => goal.id === el.dataset.id))
        return toast('Este objetivo não está mais disponível.', 'info');
      ui.finTab = 'planejamento';
      ui.finPlanTab = 'objetivos';
      nav('financas');
      return;
    }
    if (el.dataset.kind === 'habit') {
      if (!S.habits.some((habit) => habit.id === el.dataset.id))
        return toast('Este hábito não está mais disponível.', 'info');
      nav('habitos');
      return;
    }
    if (el.dataset.kind === 'cycle') {
      if (!S.cycleLog[el.dataset.id]) return toast('Este registro do ciclo não está mais disponível.', 'info');
      ui.cycDay = el.dataset.id;
      ui.calMonth = el.dataset.id.slice(0, 7);
      nav('ciclo');
      return;
    }
    const transaction = S.finance.tx.find((item) => item.id === el.dataset.id);
    if (!transaction) return toast('Este lançamento não está mais disponível.', 'info');
    ui.finMonth = transaction.date.slice(0, 7);
    ui.finTab = 'lancamentos';
    ui.finFilter = 'todos';
    ui.finQ = transaction.desc || transaction.category || query;
    ui.finFiltersOpen = true;
    nav('financas');
  },
  'trash-restore': (el) => {
    if (restoreTrashEntry(el.dataset.id)) vibrateFeedback('success');
  },
  'trash-delete-permanent': (el) => {
    const id = el.dataset.id;
    const entry = S.settings.prefs.trash.find((item) => item.id === id);
    if (!entry) return;
    const info = trashEntryDisplay(entry);
    if (ui.confirmedAction !== 'trash-delete-permanent') {
      return requestActionConfirmation(
        'trash-delete-permanent',
        { id },
        'Excluir permanentemente?',
        `“${info.title}” será removido da lixeira e não poderá ser recuperado.`,
        'Excluir permanentemente',
      );
    }
    if (deleteTrashEntryPermanently(id)) vibrateFeedback('light');
  },
  'trash-restore-all': () => {
    const active = sortTrashEntriesByExpiry(S.settings.prefs.trash.filter((entry) => !isTrashExpired(entry)));
    const filtered = filterTrashEntries(active, { category: ui.trashFilter, query: ui.trashQuery });
    if (!filtered.length) return;
    const isFiltered = filtered.length < active.length;
    if (filtered.length > 1 && ui.confirmedAction !== 'trash-restore-all') {
      return requestActionConfirmation(
        'trash-restore-all',
        {},
        isFiltered ? 'Restaurar itens filtrados?' : 'Restaurar toda a lixeira?',
        `${filtered.length} itens serão restaurados para suas áreas de origem.`,
        'Restaurar itens',
      );
    }
    const result = restoreTrashEntries(filtered.map((entry) => entry.id));
    if (result.restored) vibrateFeedback('success');
  },
  'trash-empty': () => {
    const active = sortTrashEntriesByExpiry(S.settings.prefs.trash.filter((entry) => !isTrashExpired(entry)));
    const filtered = filterTrashEntries(active, { category: ui.trashFilter, query: ui.trashQuery });
    if (!filtered.length) return;
    const isFiltered = filtered.length < active.length;
    if (ui.confirmedAction !== 'trash-empty') {
      return requestActionConfirmation(
        'trash-empty',
        {},
        isFiltered ? 'Excluir itens filtrados?' : 'Esvaziar lixeira?',
        isFiltered
          ? `${filtered.length} ${filtered.length === 1 ? 'item exibido será apagado' : 'itens exibidos serão apagados'} permanentemente e não poderão ser recuperados.`
          : `Todos os ${active.length} ${active.length === 1 ? 'item da lixeira serão apagados' : 'itens da lixeira serão apagados'} permanentemente e não poderão ser recuperados.`,
        isFiltered ? 'Excluir filtrados' : 'Esvaziar lixeira',
      );
    }
    const removed = emptyTrashEntries(isFiltered ? filtered.map((entry) => entry.id) : null);
    if (removed) vibrateFeedback('light');
  },
  'trash-filter': (el) => {
    const category = el.dataset.trashCategory || 'all';
    if (ui.trashFilter === category) return;
    ui.trashFilter = category;
    render();
    requestAnimationFrame(() => {
      document.querySelector(`.trash-filter-pill[data-trash-category="${category}"]`)?.focus({ preventScroll: true });
    });
  },
  'trash-search-clear': () => {
    ui.trashQuery = '';
    ui.trashFilter = 'all';
    render();
    requestAnimationFrame(() => {
      $('#trash-search')?.focus({ preventScroll: true });
    });
  },
  'enable-area': (el) => {
    if (setAreaEnabled(S.settings, el.dataset.area, true)) commit('settings');
  },
  undo: () => {
    const u = ui.toast && ui.toast.undo;
    ui.toast = null;
    if (u) u();
    renderToast();
  },
  'action-confirm-cancel': () => dlgClose(),
  'confirmation-cancel': () => settleDialogConfirmation(false),
  'confirmation-accept': () => settleDialogConfirmation(true),
  'action-confirm-accept': () => {
    const d = ui.dlg?.type === 'action-confirm' ? ui.dlg.d : null;
    if (!d || !CONFIRMABLE_ACTIONS.has(d.action) || !ACTIONS[d.action]) {
      console.error('Aurora: confirmação de ação inválida.');
      ui.confirmPrevious = null;
      ui.dlg = null;
      render();
      toast('Não foi possível concluir esta ação.', 'info');
      return;
    }
    const { action, data } = d;
    ui.confirmPrevious = null;
    ui.dlg = null;
    render();
    ui.confirmedAction = action;
    try {
      ACTIONS[action]({ dataset: data });
    } finally {
      ui.confirmedAction = null;
    }
  },
  'dlg-close': () => dlgClose(),
  'dlg-keep': () => dlgKeepEditing(),
  'dlg-discard': () => dlgDiscardChanges(),
  skip: (el, e) => {
    e.preventDefault();
    const m = $('#main');
    if (m) {
      m.focus();
      m.scrollIntoView();
    }
  },
  'cal-month': (el) => {
    ui.calMonth = shiftMonth(ui.calMonth, Number(el.dataset.n));
    render();
  },
};
