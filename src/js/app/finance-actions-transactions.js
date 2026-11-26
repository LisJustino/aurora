import { today } from '../utils/dates.js';
import { installmentSummary as summarizeInstallments } from '../features/finance/calculations.js';
import { extractFinanceTags, parseTagsInput, stripFinanceTags } from '../features/finance/quick-entry.js';
import { ACTIONS } from './actions.js';
import { dlgOpen, dlgClose } from './dialogs.js';
import {
  newTxDlg,
  recentTransactionDefaults,
  applyBulkEntry,
  moneyIn,
  anticipationCandidates,
} from './finance-dialogs.js';
import { accById, isCredit, isPaid } from './finance-view.js';
import { commit, moveFinanceTransactionsToTrash } from './persistence.js';
import { render } from './render.js';
import { toast } from './samples-backup.js';
import { completionFeedback } from './shell.js';
import { S, ui, catNames } from './state.js';

export function registerFinanceTransactionActions() {
  Object.assign(ACTIONS, {
    'tx-new': () => newTxDlg('out'),
    'tx-new-installment': () => newTxDlg('out', false, 'parcel'),
    'tx-new-fixed': () => newTxDlg('out', false, 'fixed'),
    'tx-new-card': (el) => newTxDlg('out', true, 'none', { accountId: el.dataset.id }),
    'tx-new-on-date': (el) => newTxDlg('out', false, 'none', { date: el.dataset.date }),
    'tx-new-in': () => newTxDlg('in'),
    'tx-tag-toggle': (el) => {
      if (ui.dlg?.type !== 'tx') return;
      const tag = el.dataset.tag;
      if (!tag) return;
      const current = parseTagsInput(ui.dlg.d.tags || '');
      const next = current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag];
      ui.dlg.d.tags = next.map((item) => `#${item}`).join(' ');
      ui.dlg.dirty = true;
      render();
    },
    'tx-bulk': () => {
      const accounts = S.finance.accounts;
      if (!accounts.length) return toast('Cadastre uma conta antes de lançar despesas.', 'info');
      const preferred =
        accById(recentTransactionDefaults('out').accountId) ||
        accounts.find((account) => !isCredit(account)) ||
        accounts[0];
      dlgOpen('txbulk', { step: 'edit', text: '', accountId: preferred.id, rows: [] });
    },
    'txbulk-back': () => {
      if (ui.dlg?.type === 'txbulk') {
        ui.dlg.d.step = 'edit';
        render();
      }
    },
    'txbulk-apply': () => applyBulkEntry(),
    'tx-save-and-another': () => {
      const dialog = ui.dlg;
      if (dialog?.type === 'tx' && !dialog.d.id && ['out', 'in', 'tr'].includes(dialog.d.kind)) {
        dialog.d.continueAfterSave = true;
      }
    },
    'tx-save': () => {
      const dialog = ui.dlg;
      if (dialog?.type === 'tx' && !dialog.d.id) delete dialog.d.continueAfterSave;
    },
    'tx-kind': (el) => {
      const d = ui.dlg.d,
        kind = el.dataset.k;
      if (d.kind === kind) return;
      const defaults = recentTransactionDefaults(kind);
      d.kind = kind;
      d.category = defaults.category;
      if (defaults.accountId) d.accountId = defaults.accountId;
      else if ((kind === 'in' || kind === 'tr') && isCredit(accById(d.accountId))) {
        d.accountId = (S.finance.accounts.find((account) => !isCredit(account)) || {}).id || '';
      }
      if (kind === 'tr') {
        d.toAccountId =
          defaults.toAccountId && defaults.toAccountId !== d.accountId
            ? defaults.toAccountId
            : (S.finance.accounts.find((account) => account.id !== d.accountId) || {}).id || '';
      }
      render();
    },
    'edit-tx': (el) => {
      const t = S.finance.tx.find((x) => x.id === el.dataset.id);
      if (t)
        dlgOpen('tx', {
          id: t.id,
          kind: t.type,
          amount: moneyIn(t.cents),
          interest: t.interestCents == null ? '' : moneyIn(t.interestCents) || '0,00',
          desc: stripFinanceTags(t.desc || ''),
          tags: extractFinanceTags(t.desc || '')
            .map((tag) => `#${tag}`)
            .join(' '),
          category: t.category || catNames('out')[0],
          accountId: t.accountId,
          toAccountId: t.toAccountId || '',
          date: t.date,
          settledDate: t.settledDate || t.date,
          paid: isPaid(t),
          repeat: 'none',
          times: '2',
          groupId: t.groupId || '',
          recId: t.recId || '',
        });
    },
    'installment-open': (el) => {
      if (!summarizeInstallments(S.finance.tx, el.dataset.id, accById, today().slice(0, 7))) {
        return toast('Esta série parcelada não está mais disponível.', 'info');
      }
      dlgOpen('installment-summary', { id: el.dataset.id });
    },
    'tx-anticipate-open': () => {
      const transaction = S.finance.tx.find((item) => item.id === ui.dlg.d.id);
      if (!transaction?.groupId) return toast('Esta parcela não pertence a uma série válida.', 'info');
      if (!anticipationCandidates(transaction.groupId, transaction.date).length)
        return toast('Não há parcelas futuras disponíveis para antecipar.', 'info');
      dlgOpen('txanticipate', {
        id: transaction.id,
        groupId: transaction.groupId,
        fromDate: transaction.date,
        date: today(),
      });
    },
    'tx-paid': (el) => {
      const transaction = S.finance.tx.find((item) => item.id === el.dataset.id);
      if (!transaction) return;
      const wasPaid = isPaid(transaction),
        previousSettledDate = transaction.settledDate,
        previousAnticipatedDate = transaction.anticipatedDate;
      transaction.paid = !wasPaid;
      if (transaction.paid && !isCredit(accById(transaction.accountId))) transaction.settledDate = today();
      else {
        delete transaction.settledDate;
        if (!transaction.paid) delete transaction.anticipatedDate;
      }
      commit('finance');
      if (transaction.paid) completionFeedback(`.fr[data-k="${transaction.id}"]`);
      toast(
        transaction.paid
          ? transaction.invoiceInstallment
            ? 'Parcela da fatura marcada como paga.'
            : transaction.type === 'in'
              ? 'Marcado como recebido.'
              : 'Marcado como pago.'
          : 'Voltou para pendente.',
        'action',
        () => {
          transaction.paid = wasPaid;
          if (previousSettledDate) transaction.settledDate = previousSettledDate;
          else delete transaction.settledDate;
          if (previousAnticipatedDate) transaction.anticipatedDate = previousAnticipatedDate;
          else delete transaction.anticipatedDate;
          commit('finance');
        },
      );
    },
    'tx-del-dlg': () => {
      const cur = S.finance.tx.find((x) => x.id === ui.dlg.d.id);
      if (!cur) return dlgClose();
      dlgOpen('txdel', {
        id: cur.id,
        ...(cur.groupId && S.finance.tx.filter((x) => x.groupId === cur.groupId).length > 1
          ? { gid: cur.groupId }
          : {}),
      });
    },
    'tx-swipe-delete': (el) => {
      const transaction = S.finance.tx.find((item) => item.id === el.dataset.id);
      if (!transaction) return toast('Este lançamento não está mais disponível.', 'info');
      const group =
        transaction.groupId && !transaction.recId
          ? S.finance.tx.filter((item) => item.groupId === transaction.groupId)
          : [];
      if (group.length > 1) return dlgOpen('txdel', { id: transaction.id, gid: transaction.groupId });
      moveFinanceTransactionsToTrash([transaction]);
    },
    'txdel-do': (el) => {
      const d = ui.dlg.d,
        t = S.finance.tx.find((x) => x.id === d.id);
      if (!t) return dlgClose();
      const k = el.dataset.k;
      const removed = S.finance.tx.filter((x) =>
        k === 'one' ? x.id === d.id : k === 'next' ? x.groupId === d.gid && x.date >= t.date : x.groupId === d.gid,
      );
      moveFinanceTransactionsToTrash(removed);
    },
  });
}
