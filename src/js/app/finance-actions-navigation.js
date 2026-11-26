import { $ } from '../utils/dom.js';
import { today } from '../utils/dates.js';
import { ACTIONS } from './actions.js';
import { filteredTx, accName, isPaid, FIN_TABS, FIN_ACCOUNT_TABS, isCredit, shiftMonth } from './finance-view.js';
import { render } from './render.js';
import { toast, downloadFile } from './samples-backup.js';
import { ui, S } from './state.js';

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

export function registerFinanceNavigationActions() {
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
    'fin-csv': () => finCsv(),
  });
}
