import { $ } from '../utils/dom.js';
import { today } from '../utils/dates.js';
import { ACTIONS } from './actions.js';
import {
  filteredTx,
  accName,
  isPaid,
  FIN_TABS,
  FIN_ACCOUNT_TABS,
  FIN_PLAN_TABS,
  FIN_REPORT_TABS,
  isCredit,
  shiftMonth,
} from './finance-view.js';
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
    'fin-plan-tab': (el) => {
      if (!FIN_PLAN_TABS.some(([key]) => key === el.dataset.t)) return;
      ui.finPlanTab = el.dataset.t;
      render();
      requestAnimationFrame(() => {
        $(`.finance-plan-option[data-t="${ui.finPlanTab}"]`)?.focus({ preventScroll: true });
      });
    },
    'fin-report-tab': (el) => {
      if (!FIN_REPORT_TABS.some(([key]) => key === el.dataset.t)) return;
      ui.finReportTab = el.dataset.t;
      render();
      requestAnimationFrame(() => {
        $(`.finance-report-option[data-t="${ui.finReportTab}"]`)?.focus({ preventScroll: true });
      });
    },
    'fin-view-mode': (el) => {
      const mode = el.dataset.mode === 'calendario' ? 'calendario' : 'lista';
      if (ui.finViewMode === mode) return;
      ui.finViewMode = mode;
      if (mode === 'calendario' && (!ui.finCalDay || !ui.finCalDay.startsWith(`${ui.finMonth}-`))) {
        ui.finCalDay = today().startsWith(`${ui.finMonth}-`) ? today() : `${ui.finMonth}-01`;
      }
      render();
    },
    'fin-cal-day': (el) => {
      const day = el.dataset.day;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day || '')) return;
      ui.finCalDay = day;
      render();
    },
    'fin-tag': (el) => {
      const tag = el.dataset.tag || '';
      ui.finTag = ui.finTag === tag ? '' : tag;
      render();
    },
    'fin-flow-range': (el) => {
      ui.finFlowRange = el.dataset.v === 'year' ? 'year' : '6m';
      render();
    },
    'fin-forecast-days': (el) => {
      const days = Number(el.dataset.v);
      if (![30, 60, 90].includes(days)) return;
      ui.finForecastDays = days;
      ui.finForecastExpanded = false;
      render();
    },
    'fin-forecast-more': () => {
      ui.finForecastExpanded = !ui.finForecastExpanded;
      render();
    },
    'acct-statement': (el) => {
      const id = el.dataset.id;
      if (!S.finance.accounts.some((account) => account.id === id)) return;
      ui.finTab = 'lancamentos';
      ui.finViewMode = 'lista';
      ui.finFilter = 'todos';
      ui.finAcc = id;
      ui.finCat = '';
      ui.finQ = '';
      ui.finTag = '';
      ui.finFiltersOpen = true;
      render();
      window.scrollTo(0, 0);
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
      if (el.dataset.sub === 'contas') ui.finAccountTab = 'contas';
      if (ui.finTab === 'planejamento' && FIN_PLAN_TABS.some(([key]) => key === el.dataset.sub)) {
        ui.finPlanTab = el.dataset.sub;
      }
      if (ui.finTab === 'relatorios' && FIN_REPORT_TABS.some(([key]) => key === el.dataset.sub)) {
        ui.finReportTab = el.dataset.sub;
      }
      if (el.hasAttribute('data-clear-fin-filters')) {
        ui.finQ = '';
        ui.finAcc = '';
        ui.finCat = '';
        ui.finTag = '';
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
      ui.finTag = '';
      const search = $('#fq');
      if (search) search.value = '';
      render();
    },
    'fin-month': (el) => {
      const n = Number(el.dataset.n);
      ui.finMonth = n === 0 ? today().slice(0, 7) : shiftMonth(ui.finMonth, n);
      if (ui.finViewMode === 'calendario') {
        ui.finCalDay = today().startsWith(`${ui.finMonth}-`) ? today() : `${ui.finMonth}-01`;
      }
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
