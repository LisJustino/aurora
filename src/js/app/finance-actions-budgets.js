import { linkedGoalProgressCents } from '../features/finance/calculations.js';
import { budgetSettingsFor } from '../features/finance/budget-insights.js';
import { ACTIONS } from './actions.js';
import { dlgOpen, requestActionConfirmation } from './dialogs.js';
import { moneyIn } from './finance-dialogs.js';
import { accById, isCredit, cardInfo, nextCardDueDate } from './finance-view.js';
import { moveRecordsToTrash, createTrashRecord, restoreTrashEntry } from './persistence.js';
import { render } from './render.js';
import { toast } from './samples-backup.js';
import { S, ui } from './state.js';

export function registerFinanceBudgetActions() {
  Object.assign(ACTIONS, {
    'budget-edit': (el) => {
      const c = el.dataset.c,
        b = S.finance.budgets[c],
        options = budgetSettingsFor(S.settings.prefs.financeBudgetSettings, c);
      dlgOpen('budget', {
        cat: c,
        limit: b ? moneyIn(b.cents) : '',
        alertPct: String(options.alertPct),
        pinned: options.pinned,
      });
    },
    'budget-use-suggestion': (el) => {
      ui.dlg.d.limit = moneyIn(Number(el.dataset.cents) || 0);
      render();
    },
    'budget-clear': () => {
      const d = ui.dlg.d;
      if (!d.confirmClear) {
        d.confirmClear = true;
        render();
        return;
      }
      const budget = S.finance.budgets[d.cat];
      if (!budget) {
        ui.dlg = null;
        return render();
      }
      const entry = moveRecordsToTrash(
        `Orçamento: ${d.cat}`,
        [createTrashRecord('finance.budgets', d.cat, 0, budget)],
        ['finance'],
        () => {
          delete S.finance.budgets[d.cat];
          ui.dlg = null;
        },
      );
      if (entry) toast('Orçamento movido para a lixeira.', 'action', () => restoreTrashEntry(entry.id));
    },
    'budget-clear-cancel': () => {
      ui.dlg.d.confirmClear = false;
      render();
    },
    'goal-new': () => dlgOpen('goal', { name: '', target: '', saved: '', linkedAccountId: '', deadline: '' }),
    'goal-edit': (el) => {
      const goal = S.finance.goals.find((item) => item.id === el.dataset.id);
      if (!goal) return toast('Objetivo não encontrado.', 'info');
      const savedCents = linkedGoalProgressCents(goal, S.finance.accounts, S.finance.tx);
      dlgOpen('goal', {
        id: goal.id,
        name: goal.name,
        target: moneyIn(goal.targetCents),
        saved: moneyIn(savedCents),
        linkedAccountId: goal.linkedAccountId || '',
        deadline: goal.deadline || '',
      });
    },
    'goal-dep': (el) => dlgOpen('deposit', { id: el.dataset.id, amount: '' }),
    'goal-del': (el) => {
      const goal = S.finance.goals.find((item) => item.id === el.dataset.id);
      if (!goal) return;
      if (ui.confirmedAction !== 'goal-del')
        return requestActionConfirmation(
          'goal-del',
          { id: goal.id },
          'Excluir objetivo?',
          `O objetivo "${goal.name}" irá para a lixeira por 30 dias.`,
          'Excluir objetivo',
        );
      const i = S.finance.goals.findIndex((item) => item.id === goal.id);
      if (i < 0) return;
      const entry = moveRecordsToTrash(
        `Objetivo: ${goal.name}`,
        [createTrashRecord('finance.goals', goal.id, i, goal)],
        ['finance'],
        () => {
          S.finance.goals.splice(i, 1);
        },
      );
      if (entry) toast('Objetivo movido para a lixeira.', 'action', () => restoreTrashEntry(entry.id));
    },
    'pay-inv': (el) => {
      const card = accById(el.dataset.id);
      if (!card || !isCredit(card)) return;
      const info = cardInfo(card),
        sources = S.finance.accounts.filter((account) => !isCredit(account));
      const source = sources.find((account) => account.id === card.linkedAccountId) || sources[0];
      if (source)
        dlgOpen('payinv', {
          cardId: card.id,
          amount: moneyIn(Math.min(info.total || info.used, info.used) || info.used),
          from: source.id,
          mode: 'single',
          times: '2',
          interest: '0,00',
          firstDueDate: nextCardDueDate(card),
        });
    },
  });
}
