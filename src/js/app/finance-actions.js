import { $, h } from '../utils/dom.js';
import { parseMoney } from '../utils/currency.js';
import { addMonths, isDay, pk, today } from '../utils/dates.js';
import { newId } from '../utils/ids.js';
import {
  installmentSummary as summarizeInstallments,
  linkedGoalProgressCents,
} from '../features/finance/calculations.js';
import { ACCOUNT_TYPES } from '../features/finance/accounts.js';
import { ANNUAL_PLAN_LIMITS } from '../features/planning/annual-plan.js';
import { HABIT_TARGETS, MAX_COUNT_TARGET } from '../features/planning/goal-progress.js';
import { matchCategoryRule } from '../features/finance/category-rules.js';
import { budgetSettingsFor, normalizeBudgetSettings } from '../features/finance/budget-insights.js';
import { hexOk } from '../features/appearance/palettes.js';
import { ACTIONS } from './actions.js';
import { CAT_ICONS, categoryLeafName, findBankByName, LIST_COLORS, norm, OTHER_BANK, plural } from './core.js';
import { createDialog, dlgClose, dlgOpen, requestActionConfirmation } from './dialogs.js';
import {
  anticipationCandidates,
  applyBulkEntry,
  moneyIn,
  newTxDlg,
  prepareTransactionDialogForAnother,
  recentTransactionDefaults,
} from './finance-dialogs.js';
import { genRecurring, recList } from './finance-extras.js';
import {
  accBalance,
  accById,
  accName,
  accountDisplayName,
  cardInfo,
  filteredTx,
  FIN_ACCOUNT_TABS,
  FIN_TABS,
  isCredit,
  isPaid,
  nextCardDueDate,
  scheduledInvoicePrincipal,
  shiftMonth,
} from './finance-view.js';
import { CHANGES, FORMS } from './forms.js';
import { addItem, findCategory, listArr, replaceCategoryReferences, resolveNew } from './onboarding.js';
import {
  commit,
  createTrashRecord,
  moveFinanceTransactionsToTrash,
  moveRecordsToTrash,
  restoreTrashEntry,
  saveSlices,
  saveSlicesWithRollback,
  snapshotSlices,
} from './persistence.js';
import { render } from './render.js';
import { downloadFile, toast } from './samples-backup.js';
import { completionFeedback, fieldError, money } from './shell.js';
import { accountSession, categoryMatch, catNames, isSafeInteger, S, ui } from './state.js';

// exportar CSV
const csvCell = (v) => {
  const s = String(v == null ? '' : v);
  return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
async function finCsv() {
  const rows = filteredTx(),
    head = [
      'Data',
      'Data de pagamento/recebimento',
      'Data da antecipação',
      'Tipo',
      'Descrição',
      'Categoria',
      'Conta',
      'Valor',
      'Juros já incluídos no valor',
      'Situação',
    ];
  const lines = rows.map((t) =>
    [
      t.date,
      t.settledDate || '',
      t.anticipatedDate || '',
      { in: 'Receita', out: 'Despesa', tr: 'Transferência' }[t.type],
      t.desc || '',
      t.category || '',
      accName(t.accountId),
      (t.type === 'out' ? -t.cents : t.cents) / 100,
      t.interestCents == null ? '' : t.interestCents / 100,
      isPaid(t) ? 'Pago' : 'Pendente',
    ]
      .map(csvCell)
      .join(';'),
  );
  const csv = '\uFEFF' + [head.join(';'), ...lines].join('\r\n'),
    name = `aurora-lancamentos-${ui.finMonth}.csv`;
  if (!rows.length) return toast('Não há lançamentos para exportar neste filtro.', 'info');
  downloadFile(name, csv, 'text/csv;charset=utf-8');
  toast('Arquivo baixado.', 'success');
}

export function registerFinanceActions() {
  // Ações e formulários de Finanças
  Object.assign(ACTIONS, {
    'finance-category-rule-focus': () => document.querySelector('.finance-category-rule-form [name="phrase"]')?.focus(),
    'fin-tab': (el) => {
      if (!FIN_TABS.some(([key]) => key === el.dataset.t)) {
        console.error('Aurora: seção de Finanças inválida.', el.dataset.t);
        return;
      }
      ui.finTab = el.dataset.t;
      render();
      requestAnimationFrame(() => {
        const selected = $(`.fin-section-option[data-t="${ui.finTab}"]`);
        selected?.focus({ preventScroll: true });
        selected?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      });
    },
    'fin-account-tab': (el) => {
      if (!FIN_ACCOUNT_TABS.some(([key]) => key === el.dataset.t)) {
        console.error('Aurora: subseção de contas inválida.', el.dataset.t);
        return;
      }
      ui.finAccountTab = el.dataset.t;
      render();
      requestAnimationFrame(() => {
        const selected = $(`.finance-account-option[data-t="${ui.finAccountTab}"]`);
        selected?.focus({ preventScroll: true });
      });
    },
    'invoice-shift': (el) => {
      const id = el.dataset.id,
        step = Number(el.dataset.d) === 1 ? 1 : -1;
      if (!S.finance.accounts.some((account) => account.id === id && isCredit(account))) return;
      const current = ui.finInvoiceShift[id] || 0;
      ui.finInvoiceShift = { ...ui.finInvoiceShift, [id]: Math.max(-24, Math.min(12, current + step)) };
      ui.openDetails[`invoice-${id}`] = true;
      render();
      requestAnimationFrame(() =>
        $(`[data-action="invoice-shift"][data-id="${id}"][data-d="${step}"]`)?.focus({ preventScroll: true }),
      );
    },
    'fin-go': (el) => {
      const target = el.dataset.t;
      ui.finTab = target === 'cartoes' ? 'contas' : target === 'orcamento' ? 'planejamento' : target;
      if (target === 'cartoes' || el.dataset.sub === 'cartoes') ui.finAccountTab = 'cartoes';
      if (el.hasAttribute('data-clear-fin-filters')) {
        ui.finQ = '';
        ui.finAcc = '';
        ui.finCat = '';
      }
      if (el.dataset.f) ui.finFilter = el.dataset.f;
      render();
      window.scrollTo(0, 0);
      requestAnimationFrame(() => {
        const selected = $(`.fin-section-option[data-t="${ui.finTab}"]`);
        selected?.focus({ preventScroll: true });
        selected?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      });
    },
    'fin-filter': (el) => {
      ui.finFilter = el.dataset.f;
      render();
    },
    'fin-filters-toggle': () => {
      ui.finFiltersOpen = !ui.finFiltersOpen;
      render();
    },
    'fin-filters-clear': () => {
      ui.finFilter = 'todos';
      ui.finQ = '';
      ui.finAcc = '';
      ui.finCat = '';
      const search = $('#fq');
      if (search) search.value = '';
      render();
    },
    'fin-month': (el) => {
      const n = Number(el.dataset.n);
      ui.finMonth = n === 0 ? today().slice(0, 7) : shiftMonth(ui.finMonth, n);
      render();
    },
    'rep-kind': (el) => {
      ui.repKind = el.dataset.k;
      render();
    },
    'rep-basis': (el) => {
      ui.repBasis = el.dataset.b === 'cash' ? 'cash' : 'competence';
      render();
    },
    'tx-new': () => newTxDlg('out'),
    'tx-new-installment': () => newTxDlg('out', false, 'parcel'),
    'tx-new-in': () => newTxDlg('in'),
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
          desc: t.desc || '',
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
    'account-delete-open': () => {
      if (!accountSession) return toast('Entre na conta que deseja excluir.', 'info');
      dlgOpen('account-delete');
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
    'fin-csv': () => finCsv(),
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
  Object.assign(FORMS, {
    'annual-intention': (form, data) => {
      const intention = String(data.get('intention') || '').trim();
      if (intention.length > ANNUAL_PLAN_LIMITS.intention) {
        return fieldError('A intenção precisa ter até 300 caracteres.', '#annual-intention');
      }
      const plans = S.settings.prefs.annualPlans;
      const snapshot = snapshotSlices(['settings']);
      const plan = plans[ui.annualYear] || { intention: '', goals: [] };
      plan.intention = intention;
      plans[ui.annualYear] = plan;
      if (saveSlicesWithRollback(['settings'], snapshot)) toast('Intenção salva para o ano.', 'success');
    },
    'annual-goal-save': (form, data) => {
      const title = String(data.get('title') || '').trim();
      const action = String(data.get('action') || '').trim();
      const quarter = String(data.get('quarter') || '');
      if (!title || title.length > ANNUAL_PLAN_LIMITS.goalTitle) {
        return fieldError('Informe uma conquista com até 120 caracteres.', '[name="title"]');
      }
      if (action.length > ANNUAL_PLAN_LIMITS.goalAction) {
        return fieldError('O primeiro passo precisa ter até 280 caracteres.', '[name="action"]');
      }
      if (!['', 'q1', 'q2', 'q3', 'q4'].includes(quarter)) {
        return fieldError('Escolha um período válido.', '[name="quarter"]');
      }
      const habitId = String(data.get('habitId') || '');
      const countTarget = String(data.get('countTarget') || '').trim();
      if (habitId && countTarget)
        return fieldError('Escolha só uma forma de acompanhar: um hábito ou uma contagem.', '[name="countTarget"]');
      if (habitId && !S.habits.some((habit) => habit.id === habitId))
        return fieldError('Escolha um hábito válido.', '[name="habitId"]');
      const targetPct = Number(data.get('targetPct') || 80);
      if (habitId && !HABIT_TARGETS.includes(targetPct))
        return fieldError('Escolha uma meta válida para o hábito.', '[name="targetPct"]');
      const countValue = countTarget ? Number(countTarget) : 0;
      if (countTarget && (!Number.isInteger(countValue) || countValue < 1 || countValue > MAX_COUNT_TARGET)) {
        return fieldError('Informe uma contagem inteira entre 1 e 100.000.', '[name="countTarget"]');
      }
      const snapshot = snapshotSlices(['settings']);
      const plans = S.settings.prefs.annualPlans;
      const plan = plans[ui.annualYear] || { intention: '', goals: [] };
      const goal = form.dataset.id ? plan.goals.find((item) => item.id === form.dataset.id) : null;
      if (form.dataset.id && !goal) return toast('Esta conquista não está mais disponível.', 'info');
      if (!goal && plan.goals.length >= ANNUAL_PLAN_LIMITS.goals) {
        return toast('Este ano já tem o limite de conquistas. Remova uma antes de adicionar outra.', 'warning');
      }
      const previousCount = goal?.track?.kind === 'count' ? goal.track.current : 0;
      const track = habitId
        ? { kind: 'habit', habitId, targetPct }
        : countTarget
          ? { kind: 'count', target: countValue, current: previousCount }
          : null;
      if (goal) {
        Object.assign(goal, { title, action, quarter });
        if (track) goal.track = track;
        else delete goal.track;
      } else plan.goals.push({ id: newId(), title, action, quarter, done: false, ...(track ? { track } : {}) });
      plans[ui.annualYear] = plan;
      if (saveSlicesWithRollback(['settings'], snapshot)) {
        ui.annualEditingGoalId = '';
        ui.annualGoalFormOpen = false;
        ui.annualGoalDraft = null;
        render();
        toast(goal ? 'Conquista atualizada.' : 'Conquista adicionada ao plano.', 'success');
      }
    },
    'dlg-txanticipate': () => {
      const d = ui.dlg.d,
        eligible = anticipationCandidates(d.groupId, d.fromDate);
      const selectedIds = new Set(
        Array.from(document.querySelectorAll('#dlg [data-advance-id]:checked')).map((input) => input.dataset.advanceId),
      );
      const selected = eligible.filter((transaction) => selectedIds.has(transaction.id));
      if (!isDay(d.date) || d.date > today())
        return fieldError('Informe uma data válida de antecipação, até hoje.', '[data-dlg="date"]');
      if (!selected.length || selected.length !== selectedIds.size)
        return toast('Selecione uma ou mais parcelas disponíveis.', 'error');
      const card = isCredit(accById(selected[0].accountId));
      const previous = selected.map((transaction) => ({
        transaction,
        paid: Object.hasOwn(transaction, 'paid') ? transaction.paid : undefined,
        settledDate: Object.hasOwn(transaction, 'settledDate') ? transaction.settledDate : undefined,
        anticipatedDate: Object.hasOwn(transaction, 'anticipatedDate') ? transaction.anticipatedDate : undefined,
      }));
      selected.forEach((transaction) => {
        transaction.anticipatedDate = d.date;
        if (!card) {
          transaction.paid = true;
          transaction.settledDate = d.date;
        }
      });
      ui.dlg = null;
      commit('finance');
      toast(
        `${selected.length} ${plural(selected.length, 'parcela antecipada', 'parcelas antecipadas')}.`,
        'action',
        () => {
          previous.forEach(({ transaction, paid, settledDate, anticipatedDate }) => {
            if (paid === undefined) delete transaction.paid;
            else transaction.paid = paid;
            if (settledDate === undefined) delete transaction.settledDate;
            else transaction.settledDate = settledDate;
            if (anticipatedDate === undefined) delete transaction.anticipatedDate;
            else transaction.anticipatedDate = anticipatedDate;
          });
          commit('finance');
        },
      );
    },
    'dlg-tx': () => {
      const d = ui.dlg.d,
        continueAfterSave = !ui.dlg.d.id && ui.dlg.d.continueAfterSave === true;
      delete d.continueAfterSave;
      const cents = parseMoney(d.amount),
        tr = d.kind === 'tr',
        acc = accById(d.accountId);
      if (!(cents > 0)) return fieldError('Informe um valor maior que zero.', '[data-dlg="amount"]');
      if (!['out', 'in', 'tr'].includes(d.kind)) return toast('Escolha um tipo de lançamento válido.', 'info');
      if (!tr && !resolveNew(d.kind === 'in' ? 'in' : 'out', d, 'category')) return;
      if (!acc) return toast('Escolha uma conta.', 'info');
      if (tr && (!d.toAccountId || d.toAccountId === d.accountId))
        return toast('Escolha duas contas diferentes.', 'info');
      if (!isDay(d.date)) return toast('Informe a data.', 'error');
      if (tr && d.date > today())
        return toast('Uma transferência futura não pode ser registrada como realizada.', 'error');
      if (!tr && !isCredit(acc) && d.date > today() && d.paid)
        return toast('Para um lançamento futuro, desmarque a opção de pagamento realizado.', 'info');
      if (!tr && !isCredit(acc) && d.paid && (!isDay(d.settledDate) || d.settledDate > today())) {
        return toast('Informe uma data válida de pagamento ou recebimento, até hoje.', 'error');
      }
      if (!d.id && d.repeat === 'parcel') {
        const currentInstallment = Number(d.currentInstallment),
          totalInstallments = Number(d.times);
        if (!Number.isInteger(totalInstallments) || totalInstallments < 2 || totalInstallments > 60)
          return toast('Informe um total entre 2 e 60 parcelas.', 'error');
        if (!Number.isInteger(currentInstallment) || currentInstallment < 1 || currentInstallment > totalInstallments)
          return toast('A parcela atual deve estar entre 1 e o total de parcelas.', 'info');
        if (!['total', 'installment'].includes(d.installmentAmountMode || 'total'))
          return toast('Escolha como informar o valor do parcelamento.', 'info');
      }
      const totalInstallments = d.repeat === 'parcel' ? Number(d.times) : 1;
      const firstInstallment = d.repeat === 'parcel' ? Number(d.currentInstallment) : 1;
      const interestInput =
        d.kind === 'out' && (d.id ? d.groupId : d.repeat === 'parcel') ? String(d.interest || '').trim() : '';
      const interestCents = interestInput ? parseMoney(interestInput) : undefined;
      const installmentCents =
        d.repeat === 'parcel' && d.installmentAmountMode !== 'installment'
          ? Math.floor(cents / totalInstallments) + (firstInstallment === 1 ? cents % totalInstallments : 0)
          : cents;
      if (
        interestInput &&
        (!Number.isSafeInteger(interestCents) || interestCents < 0 || interestCents > installmentCents)
      ) {
        return fieldError('Informe juros válidos, entre zero e o valor da parcela.', '[data-dlg="interest"]');
      }
      const matchedRule =
        !d.id && !d.categoryTouched && !tr
          ? matchCategoryRule(d.desc, d.kind, S.settings.prefs.financeCategoryRules)
          : null;
      const category =
        matchedRule && catNames(d.kind).includes(matchedRule.category) ? matchedRule.category : d.category;
      const base = {
        type: d.kind,
        accountId: d.accountId,
        category: tr ? 'Transferência' : category,
        desc: d.desc.trim().slice(0, 80),
      };
      if (tr) base.toAccountId = d.toAccountId;
      const paid = tr || isCredit(acc) ? true : !!d.paid;
      const settledDate = !tr && !isCredit(acc) && paid ? d.settledDate : '';
      if (d.id) {
        const t = S.finance.tx.find((x) => x.id === d.id);
        if (!t) return dlgClose();
        Object.assign(t, base, { cents, date: d.date, paid });
        if (!tr) delete t.toAccountId;
        if (base.type === 'out' && d.groupId && interestCents !== undefined) t.interestCents = interestCents;
        else delete t.interestCents;
        if (base.type !== 'out' || (!isCredit(acc) && !paid)) delete t.anticipatedDate;
        if (settledDate) t.settledDate = settledDate;
        else delete t.settledDate;
        ui.finMonth = d.date.slice(0, 7);
        ui.dlg = null;
        commit('finance');
        return toast('Lançamento atualizado.', 'success');
      }
      if (d.repeat === 'fixed' && !tr) {
        const r = {
          id: newId(),
          type: d.kind,
          accountId: d.accountId,
          category: base.category,
          desc: base.desc,
          cents,
          day: pk(d.date).getDate(),
          startYM: d.date.slice(0, 7),
          lastYM: null,
          firstPaid: paid,
        };
        recList().push(r);
        genRecurring();
        ui.finMonth = d.date.slice(0, 7);
        if (continueAfterSave) {
          prepareTransactionDialogForAnother(d, base.category);
          commit('finance');
          toast('Fixa criada. Você já pode cadastrar outra.', 'success');
          return;
        }
        ui.dlg = null;
        commit('finance');
        toast('Fixa criada. Os próximos meses aparecem sozinhos.', 'success');
        return;
      }
      const installmentsToCreate = totalInstallments - firstInstallment + 1;
      const gid = totalInstallments > 1 ? newId() : undefined;
      for (let offset = 0; offset < installmentsToCreate; offset++) {
        const installmentNumber = firstInstallment + offset;
        const part =
          d.repeat === 'parcel'
            ? d.installmentAmountMode === 'installment'
              ? cents
              : Math.floor(cents / totalInstallments) +
                (installmentNumber === 1 ? cents - Math.floor(cents / totalInstallments) * totalInstallments : 0)
            : cents;
        const installmentDate = addMonths(d.date, offset);
        const installmentPaid = isCredit(acc) ? true : offset === 0 ? paid : false;
        S.finance.tx.push({
          id: newId(),
          ...base,
          cents: part,
          date: installmentDate,
          paid: installmentPaid,
          ...(!isCredit(acc) && installmentPaid ? { settledDate: offset === 0 ? settledDate : installmentDate } : {}),
          ...(interestCents !== undefined ? { interestCents: offset === 0 ? interestCents : 0 } : {}),
          createdAt: Date.now() + offset,
          ...(totalInstallments > 1
            ? { groupId: gid, desc: `${base.desc || base.category} (${installmentNumber}/${totalInstallments})` }
            : {}),
        });
      }
      ui.finMonth = d.date.slice(0, 7);
      if (continueAfterSave) {
        prepareTransactionDialogForAnother(d, base.category);
        commit('finance');
        toast(
          installmentsToCreate > 1
            ? `${installmentsToCreate} lançamentos criados. Você já pode cadastrar outro.`
            : 'Lançamento adicionado. Você já pode cadastrar outro.',
          'success',
        );
        return;
      }
      ui.dlg = null;
      commit('finance');
      toast(
        installmentsToCreate > 1 ? `${installmentsToCreate} lançamentos criados.` : 'Lançamento adicionado.',
        'success',
      );
    },
    'dlg-account': () => {
      const d = ui.dlg.d,
        name = d.name.trim(),
        current = d.id ? accById(d.id) : null;
      if (!name) return toast('Dê um nome à conta.', 'info');
      if (!Object.hasOwn(ACCOUNT_TYPES, d.type) || (d.id && !current))
        return toast('Confira o tipo e a conta selecionados.', 'warning');
      const linkedAccount = d.type === 'credit' && d.linkedAccountId ? accById(d.linkedAccountId) : null;
      if (d.type === 'credit' && d.linkedAccountId && (!linkedAccount || isCredit(linkedAccount)))
        return toast('Escolha uma conta válida para pagar a fatura.', 'info');
      const bankName = String(d.bank || '')
        .trim()
        .slice(0, 40);
      const knownBank = findBankByName(bankName);
      const bank = norm(bankName) === norm('Outro / não listado') ? OTHER_BANK : knownBank ? knownBank[0] : bankName;
      const bal = d.balance.trim() ? parseMoney(d.balance) : 0,
        lim = d.limit && d.limit.trim() ? parseMoney(d.limit) : 0;
      if (!Number.isSafeInteger(bal) || !Number.isSafeInteger(lim) || lim < 0)
        return toast('Confira os valores digitados. Use valores em reais, como 1.234,56.', 'warning');
      const cl = d.closing.trim() ? Number(d.closing) : 0,
        du = d.due.trim() ? Number(d.due) : 0;
      if (
        d.type === 'credit' &&
        ((d.closing.trim() && (!Number.isInteger(cl) || cl < 1 || cl > 31)) ||
          (d.due.trim() && (!Number.isInteger(du) || du < 1 || du > 31)))
      )
        return toast('Os dias de fechamento e vencimento devem ser números inteiros de 1 a 31.', 'info');
      const patch = {
        name: accountDisplayName({ name: name.slice(0, 40), bank }),
        type: d.type,
        bank,
        initialCents: d.id ? current.initialCents + (bal - (d.cur0 || 0)) : bal,
        limitCents: d.type === 'credit' && lim > 0 ? lim : 0,
        closingDay: d.type === 'credit' && cl >= 1 && cl <= 31 ? cl : 0,
        dueDay: d.type === 'credit' && du >= 1 && du <= 31 ? du : 0,
      };
      if (linkedAccount) patch.linkedAccountId = linkedAccount.id;
      if (d.id) {
        Object.assign(current, patch);
        if (d.type === 'credit' && !linkedAccount) delete current.linkedAccountId;
      } else S.finance.accounts.push({ id: newId(), ...patch });
      ui.dlg = null;
      commit('finance');
    },
    'dlg-budget': () => {
      const d = ui.dlg.d,
        c = parseMoney(d.limit);
      if (!(c > 0)) return toast('Informe um limite maior que zero.', 'error');
      Object.defineProperty(S.finance.budgets, d.cat, {
        value: { cents: c },
        enumerable: true,
        writable: true,
        configurable: true,
      });
      S.settings.prefs.financeBudgetSettings = normalizeBudgetSettings({
        ...S.settings.prefs.financeBudgetSettings,
        [d.cat]: { alertPct: Number(d.alertPct), pinned: d.pinned === true },
      });
      ui.dlg = null;
      commit('finance', 'settings');
    },
    'dlg-category': () => {
      const d = ui.dlg.d,
        name = String(d.name || '')
          .trim()
          .slice(0, 30),
        parentName = String(d.parent || '').trim();
      if (d.kind !== 'out' && d.kind !== 'in') return toast('Escolha um tipo de categoria válido.', 'info');
      const transactionDialog = d.fromTransaction ? ui.categoryReturnDialog : null;
      if (
        d.fromTransaction &&
        (transactionDialog?.type !== 'tx' || (transactionDialog.d.kind === 'in' ? 'in' : 'out') !== d.kind)
      ) {
        return toast('Não foi possível retornar ao lançamento. Feche esta janela e tente novamente.', 'info');
      }
      if (!name) return toast('Informe o nome da categoria.', 'error');
      if (!CAT_ICONS.includes(d.icon) || !hexOk(d.color)) return toast('Escolha um ícone e uma cor válidos.', 'info');
      const parentEntry = parentName
        ? listArr(d.kind).find((category) => norm(category.name) === norm(parentName))
        : null;
      if (parentName && !parentEntry) return toast('Escolha uma categoria pai válida.', 'info');
      const existing = d.editName ? findCategory(d.kind, d.editName, parentName) : null;
      if (d.editName && !existing) return toast('Não foi possível localizar essa categoria.', 'info');
      const siblings = parentEntry ? parentEntry.subcategories || [] : listArr(d.kind);
      const duplicate = siblings.some(
        (category) =>
          category !== existing && norm(parentEntry ? categoryLeafName(category) : category.name) === norm(name),
      );
      if (duplicate) return toast('Já existe uma categoria com esse nome.', 'info');
      const financeChanges = [];
      let addedPath = '';
      if (existing) {
        const oldName = categoryLeafName(existing);
        const oldPath = parentName ? `${parentName} > ${oldName}` : oldName;
        const newPath = parentName ? `${parentName} > ${name}` : name;
        const paths = [[oldPath, newPath]];
        if (!parentName) {
          (existing.subcategories || []).forEach((subcategory) => {
            const child = categoryLeafName(subcategory);
            paths.push([`${oldName} > ${child}`, `${name} > ${child}`]);
          });
        }
        if (paths.some(([oldValue, newValue]) => oldValue !== newValue && Object.hasOwn(S.finance.budgets, newValue))) {
          return toast(
            'Já existe um limite com o novo nome. Ajuste esse limite antes de renomear a categoria.',
            'info',
          );
        }
        existing.name = name;
        existing.color = d.color;
        existing.icon = d.icon;
        paths.forEach(([oldValue, newValue]) => {
          const changed = replaceCategoryReferences(oldValue, newValue);
          if (changed === null) financeChanges.push(false);
          else if (changed) financeChanges.push(true);
        });
      } else {
        addedPath = addItem(d.kind, name, parentName, d.color, d.icon);
      }
      if (d.fromTransaction) {
        if (!addedPath)
          return toast('Não foi possível adicionar a categoria. Confira os dados e tente novamente.', 'warning');
        transactionDialog.d.category = addedPath;
        transactionDialog.d.categoryTouched = true;
        transactionDialog.dirty = true;
        ui.categoryReturnDialog = null;
        ui.dlg = transactionDialog;
        commit('settings');
        toast('Categoria adicionada e selecionada no lançamento.', 'success');
        return;
      }
      ui.dlg = createDialog('category-manager', {});
      commit(...(financeChanges.includes(true) ? ['settings', 'finance'] : ['settings']));
      toast(existing ? 'Categoria atualizada.' : 'Categoria adicionada.', 'success');
    },
    'dlg-goal': () => {
      const d = ui.dlg.d,
        name = d.name.trim(),
        target = parseMoney(d.target);
      const linkedAccount = d.linkedAccountId ? accById(d.linkedAccountId) : null;
      const saved = d.linkedAccountId ? 0 : d.saved.trim() ? parseMoney(d.saved) : 0;
      if (!name || name.length > 50) return fieldError('Informe um nome com até 50 caracteres.', '[data-dlg="name"]');
      if (!Number.isSafeInteger(target) || target <= 0)
        return fieldError('Informe um valor maior que zero.', '[data-dlg="target"]');
      if (!d.linkedAccountId && (!Number.isSafeInteger(saved) || saved < 0)) {
        return fieldError('Informe um valor válido, igual ou maior que zero.', '[data-dlg="saved"]');
      }
      if (d.deadline && !isDay(d.deadline)) return fieldError('Informe um prazo válido.', '[data-dlg="deadline"]');
      if (d.linkedAccountId && (!linkedAccount || isCredit(linkedAccount))) {
        return fieldError('Escolha uma conta disponível, sem ser cartão de crédito.', '[data-dlg="linkedAccountId"]');
      }
      if (
        d.linkedAccountId &&
        S.finance.goals.some((goal) => goal.id !== d.id && goal.linkedAccountId === d.linkedAccountId)
      ) {
        return fieldError(
          'Esta conta já acompanha outro objetivo. Escolha outra ou desvincule-a primeiro.',
          '[data-dlg="linkedAccountId"]',
        );
      }
      const values = {
        name,
        targetCents: target,
        savedCents: linkedAccount
          ? d.id
            ? (S.finance.goals.find((goal) => goal.id === d.id)?.savedCents ?? 0)
            : 0
          : saved,
        ...(linkedAccount ? { linkedAccountId: linkedAccount.id } : {}),
        deadline: d.deadline || '',
      };
      if (d.id) {
        const goal = S.finance.goals.find((item) => item.id === d.id);
        if (!goal) return toast('Objetivo não encontrado.', 'info');
        Object.assign(goal, values);
        if (!linkedAccount) delete goal.linkedAccountId;
      } else S.finance.goals.push({ id: newId(), ...values });
      ui.dlg = null;
      commit('finance');
    },
    'dlg-deposit': () => {
      const d = ui.dlg.d,
        goal = S.finance.goals.find((item) => item.id === d.id),
        amount = parseMoney(d.amount);
      if (!goal) return toast('Objetivo não encontrado.', 'info');
      if (!Number.isSafeInteger(amount) || amount === 0)
        return fieldError('Informe um valor diferente de zero.', '[data-dlg="amount"]');
      const total = goal.savedCents + amount;
      if (!Number.isSafeInteger(total)) return fieldError('Informe um valor menor.', '[data-dlg="amount"]');
      goal.savedCents = Math.max(0, total);
      ui.dlg = null;
      const saved = saveSlices('finance');
      render();
      if (saved) toast(amount > 0 ? 'Valor guardado.' : 'Valor retirado.', 'info');
    },
    'dlg-payinv': () => {
      const d = ui.dlg.d,
        cents = parseMoney(d.amount),
        card = accById(d.cardId),
        source = accById(d.from);
      if (!Number.isSafeInteger(cents) || cents <= 0) return toast('Informe um valor maior que zero.', 'error');
      if (!card || !isCredit(card) || !source || isCredit(source) || source.id === card.id)
        return toast('Escolha um cartão e uma conta de origem válidos.', 'info');
      const outstanding = cardInfo(card).used;
      if (outstanding <= 0) return toast('Este cartão não tem valores em aberto.', 'info');
      if (d.mode === 'installments') {
        const times = Number(d.times),
          interestCents = parseMoney(d.interest);
        const available = Math.max(0, outstanding - scheduledInvoicePrincipal(card.id));
        if (!Number.isInteger(times) || times < 2 || times > 60) return toast('Informe de 2 a 60 parcelas.', 'error');
        if (!isSafeInteger(interestCents) || interestCents < 0)
          return toast('Informe um valor válido de juros por parcela.', 'error');
        if (!isDay(d.firstDueDate) || d.firstDueDate < today())
          return toast('Informe o vencimento de hoje ou de uma data futura.', 'error');
        if (cents > available)
          return toast(
            h`O valor a parcelar não pode ultrapassar ${money(available)} (saldo em aberto descontadas outras parcelas programadas).`,
            'info',
          );
        const groupId = newId(),
          baseCents = Math.floor(cents / times),
          remainder = cents % times;
        const plan = Array.from({ length: times }, (_, index) => {
          const principalPart = baseCents + (index === 0 ? remainder : 0);
          const installmentCents = principalPart + interestCents;
          if (!isSafeInteger(installmentCents) || installmentCents <= 0) return null;
          return {
            id: newId(),
            type: 'tr',
            accountId: source.id,
            toAccountId: card.id,
            cents: installmentCents,
            interestCents,
            category: 'Transferência',
            desc: `Fatura parcelada (${index + 1}/${times})`,
            date: addMonths(d.firstDueDate, index),
            paid: false,
            invoiceInstallment: true,
            groupId,
            createdAt: Date.now() + index,
          };
        });
        if (plan.some((transaction) => !transaction || !isDay(transaction.date))) {
          return toast('Não foi possível gerar as datas ou os valores das parcelas. Revise os dados.', 'info');
        }
        S.finance.tx.push(...plan);
        ui.finMonth = plan[0].date.slice(0, 7);
        ui.dlg = null;
        commit('finance');
        const total = plan.reduce((sum, transaction) => sum + transaction.cents, 0);
        return toast(
          `${times} parcelas programadas, totalizando ${money(total)}. O saldo da conta não foi alterado.`,
          'info',
        );
      }
      if (d.mode !== 'single') return toast('Escolha uma forma de pagamento válida.', 'info');
      if (cents > outstanding)
        return toast(h`O pagamento não pode ultrapassar o valor em aberto de ${money(outstanding)}.`, 'info');
      S.finance.tx.push({
        id: newId(),
        type: 'tr',
        accountId: source.id,
        toAccountId: card.id,
        cents,
        category: 'Transferência',
        desc: 'Pagamento da fatura',
        date: today(),
        paid: true,
        createdAt: Date.now(),
      });
      ui.dlg = null;
      commit('finance');
      toast('Pagamento registrado.', 'success');
    },
  });
  Object.assign(CHANGES, {
    'fin-cat': (el) => {
      ui.finCat = el.value;
      render();
    },
    'fin-acc': (el) => {
      ui.finAcc = el.value;
      render();
    },
    'rep-acc': (el) => {
      ui.repAcc = el.value;
      render();
    },
    'rep-cat': (el) => {
      ui.repCat = el.value;
      render();
    },
  });
}
