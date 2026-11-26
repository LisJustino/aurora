import { ACTIONS } from './actions.js';
import { LIST_COLORS } from './core.js';
import { dlgOpen, dlgClose } from './dialogs.js';
import { moneyIn } from './finance-dialogs.js';
import { accById, accountDisplayName, accBalance } from './finance-view.js';
import { listArr, findCategory } from './onboarding.js';
import {
  snapshotSlices,
  saveSlicesWithRollback,
  createTrashRecord,
  moveRecordsToTrash,
  restoreTrashEntry,
} from './persistence.js';
import { render } from './render.js';
import { toast } from './samples-backup.js';
import { accountSession, S, categoryMatch, ui } from './state.js';

export function registerFinanceAccountActions() {
  Object.assign(ACTIONS, {
    'account-delete-open': () => {
      if (!accountSession) return toast('Entre na conta que deseja excluir.', 'info');
      dlgOpen('account-delete');
    },
    'category-manager': () => dlgOpen('category-manager', {}),
    'finance-category-rule-delete': (el) => {
      const index = S.settings.prefs.financeCategoryRules.findIndex((rule) => rule.id === el.dataset.id);
      if (index < 0) return;
      const snapshot = snapshotSlices(['settings']);
      S.settings.prefs.financeCategoryRules.splice(index, 1);
      if (!saveSlicesWithRollback(['settings'], snapshot, false, 'a regra de categoria')) return;
      render();
      toast('Regra automática removida.', 'success');
    },
    'category-new': (el) => {
      const kind = el.dataset.kind;
      if (kind !== 'out' && kind !== 'in') return toast('Escolha um tipo de categoria válido.', 'info');
      dlgOpen('category-new', {
        kind,
        name: '',
        icon: 'tag',
        color: LIST_COLORS[listArr(kind).length % LIST_COLORS.length],
      });
    },
    'category-edit': (el) => {
      const { kind, name, parent = '' } = el.dataset;
      if ((kind !== 'out' && kind !== 'in') || !findCategory(kind, name, parent))
        return toast('Não foi possível localizar essa categoria.', 'info');
      const match = categoryMatch(kind, parent ? `${parent} > ${name}` : name);
      const category = match?.subcategory || match?.category;
      if (!category) return toast('Não foi possível localizar essa categoria.', 'info');
      dlgOpen('category-new', {
        kind,
        editName: name,
        parent,
        name: category.name,
        icon: category.icon,
        color: category.color,
      });
    },
    'acct-new': () =>
      dlgOpen('account', { name: '', bank: '', type: 'checking', balance: '', limit: '', closing: '', due: '' }),
    'acct-new-card': () =>
      dlgOpen('account', {
        name: '',
        bank: '',
        type: 'credit',
        linkedAccountId: '',
        balance: '',
        limit: '',
        closing: '',
        due: '',
      }),
    'acct-edit': (el) => {
      const a = accById(el.dataset.id);
      if (a)
        dlgOpen('account', {
          id: a.id,
          name: accountDisplayName(a),
          bank: a.bank || '',
          type: a.type,
          linkedAccountId: a.linkedAccountId || '',
          balance: moneyIn(accBalance(a)),
          cur0: accBalance(a),
          limit: moneyIn(a.limitCents),
          closing: a.closingDay ? String(a.closingDay) : '',
          due: a.dueDay ? String(a.dueDay) : '',
        });
    },
    'acct-del': () => {
      const a = accById(ui.dlg.d.id);
      if (a) dlgOpen('acctdelete', { id: a.id });
    },
    'acct-del-confirm': () => {
      const account = accById(ui.dlg.d.id);
      if (!account) return dlgClose();
      if (S.finance.goals.some((goal) => goal.linkedAccountId === account.id)) {
        return toast('Desvincule esta conta dos objetivos antes de movê-la para a lixeira.', 'error');
      }
      const transactions = S.finance.tx.filter(
        (transaction) => transaction.accountId === account.id || transaction.toAccountId === account.id,
      );
      const recurring = (S.finance.recurring || []).filter((item) => item.accountId === account.id);
      const records = [
        createTrashRecord('finance.accounts', account.id, S.finance.accounts.indexOf(account), account),
        ...transactions.map((transaction) =>
          createTrashRecord('finance.tx', transaction.id, S.finance.tx.indexOf(transaction), transaction),
        ),
        ...recurring.map((item) =>
          createTrashRecord('finance.recurring', item.id, S.finance.recurring.indexOf(item), item),
        ),
      ];
      const entry = moveRecordsToTrash(
        `Conta e lançamentos: ${accountDisplayName(account)}`,
        records,
        ['finance'],
        () => {
          S.finance.accounts = S.finance.accounts.filter((item) => item.id !== account.id);
          S.finance.tx = S.finance.tx.filter(
            (item) => item.accountId !== account.id && item.toAccountId !== account.id,
          );
          S.finance.recurring = S.finance.recurring.filter((item) => item.accountId !== account.id);
          ui.dlg = null;
        },
      );
      if (entry) toast('Conta e dados associados movidos para a lixeira.', 'action', () => restoreTrashEntry(entry.id));
    },
  });
}
