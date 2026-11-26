import { esc, h, raw } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { brl as formatBRL } from '../utils/currency.js';
import { addDays, addMonths, dayDiff, longDate, MESES, MESES_L, pad, pk, shortDate, today } from '../utils/dates.js';
import {
  accountBalance as balanceForAccount,
  accountBalanceOn,
  balanceSplit,
  byCategory as summarizeByCategory,
  cardInfo as calculateCardInfo,
  cardInvoice as calculateCardInvoice,
  dailyBudgetRoom,
  expenseBudgetByCategory,
  goalMonthlyPlan,
  installmentSummary as summarizeInstallments,
  isCreditAccount,
  isPaid as transactionIsPaid,
  linkedGoalProgressCents,
  monthlyCloseSummary as summarizeMonthlyClose,
  monthStats as summarizeMonth,
  netAccountBalance,
  projectedNetAccountBalance,
  reportMonthStats,
  savingsRatePercent,
} from '../features/finance/calculations.js';
import { ACCOUNT_TYPES } from '../features/finance/accounts.js';
import { buildCashflowForecast, FORECAST_HORIZONS } from '../features/finance/cashflow-forecast.js';
import { extractFinanceTags, stripFinanceTags } from '../features/finance/quick-entry.js';
import { cycleStats, nextPeriodRange } from '../features/cycle/calculations.js';
import { budgetReport, budgetSettingsFor } from '../features/finance/budget-insights.js';
import { hasCurrentCycleDataConsent } from '../services/cycle-consent.js';
import { agendaForMonth as buildAgendaForMonth } from '../features/planning/agenda.js';
import { bankFieldValue, BANKS, norm, OTHER_BANK, plural } from './core.js';
import { finCompare, finTools, recList } from './finance-extras.js';
import { listPage } from './planning.js';
import { areaEmpty, areaOn, areaPageTitle, brl, cap, empty, expenseTitle, gate, money, tabLabel } from './shell.js';
import { accountSession, catInfo, catNames, financePrivacyNotice, renderFinanceView, S, ui } from './state.js';

// Finanças (contas, cartões, lançamentos, orçamento, relatórios)
export const catMeta = (t) => {
  if (t.type === 'tr') return { c: 'color-mix(in srgb, var(--accent) 38%, var(--muted))', i: 'transfer' };
  return catInfo(t.type === 'in' ? 'in' : 'out', t.category);
};
export const outMeta = (n) => catInfo('out', n);
export const ACC_ICON = { checking: 'bank', savings: 'trendUp', investment: 'trendUp', credit: 'card' };
export const isPaid = transactionIsPaid;
export const isCredit = isCreditAccount;
export const accById = (id) => S.finance.accounts.find((a) => a.id === id);
export const accountDisplayName = (account) => {
  const name = account?.name || '';
  const bank = Object.values(BANKS).find((item) => {
    const prefix = name.slice(0, item.name.length);
    return (
      prefix.toLocaleLowerCase('pt-BR') === item.name.toLocaleLowerCase('pt-BR') &&
      (!name[item.name.length] || /[\s\d]/.test(name[item.name.length]))
    );
  });
  return bank
    ? bank.name + name.slice(bank.name.length)
    : name
      ? name[0].toLocaleUpperCase('pt-BR') + name.slice(1)
      : name;
};
const accountTypeLabel = (account) => ACCOUNT_TYPES[account.type] || account.type;
export const accountOptionLabel = (account) => `${accountDisplayName(account)} · ${accountTypeLabel(account)}`;
export const accName = (id) => {
  const account = accById(id);
  return account ? accountDisplayName(account) : 'Conta removida';
};
export const shiftMonth = (ym, n) => {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};
export const ymLabel = (ym) => {
  const [y, m] = ym.split('-').map(Number);
  return `${MESES_L[m - 1]} de ${y}`;
};
export const accBalance = (account) => balanceForAccount(account, S.finance.tx);
const netBalance = () => netAccountBalance(S.finance.accounts, S.finance.tx);
const monthStats = (month) => summarizeMonth(S.finance.tx, month, accById);
export const byCategory = summarizeByCategory;

// fatura do cartão
export const cardInfo = (card) =>
  calculateCardInfo(S.finance, card, today(), {
    shiftMonth,
    parseDate: pk,
    accountBalance: accBalance,
  });
export function nextCardDueDate(card) {
  const due = cardInfo(card).due;
  if (!due) return addMonths(today(), 1);
  if (due > today()) return due;
  const nextMonth = shiftMonth(due.slice(0, 7), 1);
  const lastDay = new Date(Number(nextMonth.slice(0, 4)), Number(nextMonth.slice(5, 7)), 0).getDate();
  return `${nextMonth}-${pad(Math.min(Number(due.slice(8, 10)), lastDay))}`;
}
export function scheduledInvoicePrincipal(cardId) {
  return S.finance.tx
    .filter(
      (transaction) => transaction.invoiceInstallment && transaction.toAccountId === cardId && !isPaid(transaction),
    )
    .reduce((sum, transaction) => sum + transaction.cents - (transaction.interestCents || 0), 0);
}
const cardDueLabel = (date) => {
  if (!date) return '';
  const days = dayDiff(date, today());
  if (days < 0) return h`<span class="badge bad">Vencimento passou</span>`;
  if (days === 0) return h`<span class="badge warn">Vence hoje</span>`;
  if (days <= 7) return h`<span class="badge warn">Vence em ${days} ${plural(days, 'dia', 'dias')}</span>`;
  return '';
};

// gráficos
function donut(items, total, label) {
  let off = 0;
  const segs = items
    .map((it) => {
      const p = (it.v / total) * 100,
        visible = Math.max(0, p - 1.25);
      const s = `<circle class="donut-segment" cx="21" cy="21" r="15.9155" fill="none" stroke="${it.c}" stroke-width="6"
        stroke-dasharray="${visible.toFixed(2)} ${(100 - visible).toFixed(2)}"
        stroke-dashoffset="${(25 - off).toFixed(2)}"
        tabindex="0"><title>${esc(it.label || label)}: ${esc(brl(it.v))} (${Math.round(p)}%)</title></circle>`;
      off += p;
      return s;
    })
    .join('');
  return raw(
    `<svg class="donut" viewBox="0 0 42 42" role="img" aria-label="${esc(label)}"><circle cx="21" cy="21" r="15.9155"
      fill="none" stroke="var(--soft2)" stroke-width="6"/>${segs}</svg>`,
  );
}

// componentes
export const catChip = (meta) => h`<span class="ci" style="--c:${meta.c}">${icon(meta.i, 18)}</span>`;
function accountChip(account) {
  const bank = account.bank !== OTHER_BANK && Object.hasOwn(BANKS, account.bank) ? BANKS[account.bank] : null;
  return bank
    ? h`<span class="bank-logo" aria-hidden="true"><img src="${bank.logo}" alt=""></span>`
    : catChip({ c: '#5fa68a', i: ACC_ICON[account.type] || 'bank' });
}
export function finRow(t, { showDate = false } = {}) {
  const meta = catMeta(t),
    acc = accById(t.accountId),
    paid = isPaid(t),
    tr = t.type === 'tr';
  const installment = !!t.groupId && !t.recId;
  const sub = tr
    ? h`<span class="user-value">${accName(t.accountId)} → ${accName(t.toAccountId)}</span>`
    : h`<span class="expense-name">${expenseTitle(t.category)}</span> · <span
      class="user-value">${accName(t.accountId)}</span>`;
  const rawTitle =
    t.type === 'out' ? expenseTitle(t.desc || t.category) : t.desc || (tr ? 'Transferência' : t.category);
  const tags = extractFinanceTags(t.desc);
  const title = stripFinanceTags(rawTitle) || (t.type === 'out' ? expenseTitle(t.category) : t.category) || rawTitle;
  const canToggle = t.invoiceInstallment || (!tr && !isCredit(acc));
  const paymentAction = t.invoiceInstallment
    ? paid
      ? 'Voltar parcela da fatura para pendente'
      : 'Marcar parcela da fatura como paga'
    : t.type === 'in'
      ? 'Marcar como recebido'
      : 'Marcar como pago';
  return h`<li class="fr ${paid ? '' : 'pend'}" data-k="${t.id}">
    <button class="fr-main" data-action="${installment ? 'installment-open' : 'edit-tx'}" data-id="${t.id}"
      aria-label="${installment ? 'Ver resumo da parcela' : 'Editar lançamento'} ${t.type === 'out' ? 'despesa' : t.type === 'in' ? 'receita' : 'transferência'} de ${brl(t.cents)}: ${title}">${catChip(meta)}
      <span class="grow"><span class="ttl ${t.type === 'out' ? 'expense-name' : ''}">${title}${
        tags.length ? tags.map((tag) => h` <span class="fin-tag-pill">#${tag}</span>`) : ''
      }</span><span
        class="meta2">${
          showDate
            ? h`<span
        class="tx-date">${t.date === today() ? 'Hoje' : shortDate(t.date)}</span> · `
            : ''
        }${sub}${paid && t.settledDate && t.settledDate !== t.date ? h` · ${t.type === 'in' ? 'recebido' : 'pago'} em ${shortDate(t.settledDate)}` : ''}${t.type === 'out' || t.invoiceInstallment ? (t.interestCents != null ? h` · ${t.interestCents === 0 ? 'Sem juros' : h`Juros ${money(t.interestCents)}`}` : '') : ''}${t.type === 'out' && t.anticipatedDate ? h` · Antecipada em ${shortDate(t.anticipatedDate)}` : ''}${
          !paid
            ? h` <span
        class="m-warn">${t.type === 'in' ? 'A receber' : 'A pagar'}${t.date < today() ? ' · atrasado' : ''}</span>`
            : ''
        }</span></span>
      <span class="amt ${t.type}">${t.type === 'in' ? '+' : t.type === 'out' ? '−' : ''}${money(t.cents)}</span></button>
    ${
      canToggle
        ? h`<button class="pk ${paid ? 'on' : ''}" role="switch" aria-checked="${paid ? 'true' : 'false'}"
      data-action="tx-paid" data-id="${t.id}" aria-label="${paymentAction}: ${title}"
      title="${paymentAction}">${icon('check', 16)}</button>`
        : h`<span class="pk-sp pk-badge" aria-hidden="true" title="${tr ? 'Transferência' : 'Compra no cartão'}">${icon(tr ? 'transfer' : 'card', 15)}</span>`
    }
  </li>`;
}
function financeInstallmentPlans() {
  const month = today().slice(0, 7),
    plans = new Map();
  S.finance.tx.forEach((transaction) => {
    if (!transaction.groupId || transaction.recId) return;
    const summary = summarizeInstallments(S.finance.tx, transaction.id, accById, month);
    if (!summary?.remainingCount) return;
    const key = JSON.stringify([
      transaction.groupId,
      transaction.type,
      transaction.accountId,
      transaction.toAccountId || '',
    ]);
    if (plans.has(key)) return;
    const next = summary.installments.find((item) =>
      summary.cardPurchase ? item.date.slice(0, 7) >= month : !isPaid(item),
    );
    if (next) plans.set(key, { transaction: next, summary });
  });
  return [...plans.values()].sort((a, b) => a.summary.endDate.localeCompare(b.summary.endDate));
}
function finInstallments() {
  const plans = financeInstallmentPlans();
  return h`<section class="card finance-installments" aria-labelledby="finance-installments-title">
    <div class="head"><div><h2 id="finance-installments-title">Parcelamentos em andamento</h2>
      <p class="small muted">${
        plans.length
          ? 'Veja quantas parcelas faltam, o valor restante e quando cada série termina.'
          : 'Registre uma despesa parcelada para acompanhar aqui o que falta e quando termina.'
      }</p></div></div>
    ${
      plans.length
        ? h`<ul class="list">${plans.map(({ transaction, summary }) => {
            const title = (transaction.desc || transaction.category || 'Série parcelada').replace(
              /\s+\(\d+\/\d+\)$/,
              '',
            );
            return h`<li><button type="button" class="finance-installment-plan" data-action="installment-open"
              data-id="${transaction.id}" aria-label="Ver parcelas de ${title}">
        <span class="finance-installment-mark" aria-hidden="true">${icon('repeat', 18)}</span>
        <span class="grow"><b>${title}</b><small>${summary.remainingCount} ${plural(summary.remainingCount, 'parcela restante', 'parcelas restantes')} · termina ${shortDate(summary.endDate)}</small></span>
        <span class="finance-installment-value"><small>Valor restante</small><b>${money(summary.remainingCents)}</b></span>${icon('chevRight', 16)}
      </button></li>`;
          })}</ul>`
        : areaEmpty(
            'Nenhuma série parcelada em andamento.',
            'Acompanhe aqui o valor restante e as próximas datas de uma despesa parcelada.',
            h`<button type="button" class="btn primary"
              data-action="tx-new-installment">${icon('plus', 16)}Registrar compra parcelada</button>`,
            'repeat',
            'h3',
            'finance-installments-empty-state',
          )
    }
  </section>`;
}
const monthNav = () =>
  h`<div class="mnav"><button class="ibtn" data-action="fin-month" data-n="-1"
    aria-label="Mês anterior">${icon('chevLeft', 20)}</button><span class="mlabel"
    aria-live="polite">${cap(ymLabel(ui.finMonth))}</span>${
      ui.finMonth !== today().slice(0, 7)
        ? h`<button
    class="btn sm" type="button" data-action="fin-month" data-n="0" aria-label="Voltar para o mês atual"
    title="Voltar para o mês atual">Hoje</button>`
        : ''
    }<button class="ibtn" data-action="fin-month" data-n="1"
    aria-label="Próximo mês">${icon('chevRight', 20)}</button></div>`;
export const FIN_TABS = [
  ['resumo', 'Visão geral', 'home'],
  ['lancamentos', 'Movimentações', 'list'],
  ['contas', 'Contas e cartões', 'bank'],
  ['planejamento', 'Planejamento', 'target'],
  ['relatorios', 'Relatórios', 'pie'],
];
const finSectionPicker = () => {
  const [key] = FIN_TABS.find(([id]) => id === ui.finTab) || FIN_TABS[0];
  return h`<div class="tabs fin-section-menu" role="tablist"
    aria-label="Seções de Finanças">${FIN_TABS.map(
      ([id, name, sectionIcon]) => h`<button type="button"
    class="tab fin-section-option" role="tab" id="fin-tab-${id}" aria-controls="fin-panel"
    tabindex="${id === key ? '0' : '-1'}" data-action="fin-tab" data-t="${id}"
    aria-selected="${id === key}">${icon(sectionIcon, 18)}${tabLabel(name)}</button>`,
    )}</div>`;
};
export const FIN_ACCOUNT_TABS = [
  ['contas', 'Contas'],
  ['cartoes', 'Cartões'],
];
export const FIN_PLAN_TABS = [
  ['limites', 'Limites'],
  ['objetivos', 'Objetivos'],
  ['compromissos', 'Fixos e parcelas'],
];
export const FIN_REPORT_TABS = [
  ['resumo', 'Resumo'],
  ['projecao', 'Projeção'],
  ['categorias', 'Por categoria'],
  ['comparar', 'Comparar meses'],
];
const finAccountPicker = () => {
  const active = ui.finAccountTab === 'cartoes' ? 'cartoes' : 'contas';
  const counts = {
    contas: S.finance.accounts.filter((account) => !isCredit(account)).length,
    cartoes: S.finance.accounts.filter(isCredit).length,
  };
  return h`<div class="tabs finance-account-tabs" role="tablist"
    aria-label="Contas e cartões">${FIN_ACCOUNT_TABS.map(
      ([id, label]) => h`<button type="button"
    class="tab finance-account-option" role="tab" id="fin-account-tab-${id}" aria-controls="fin-account-panel"
    tabindex="${active === id ? '0' : '-1'}" data-action="fin-account-tab" data-t="${id}"
    aria-selected="${active === id}">${label}${counts[id] ? h`<span class="fin-tab-count">${counts[id]}</span>` : ''}</button>`,
    )}</div>`;
};
const finPlanPicker = (counts) => {
  const active = FIN_PLAN_TABS.some(([id]) => id === ui.finPlanTab) ? ui.finPlanTab : 'limites';
  return h`<div class="tabs finance-sub-tabs finance-plan-tabs" role="tablist"
    aria-label="Seções de planejamento">${FIN_PLAN_TABS.map(
      ([id, label]) => h`<button type="button"
    class="tab finance-plan-option" role="tab" id="fin-plan-tab-${id}" aria-controls="fin-plan-panel"
    tabindex="${active === id ? '0' : '-1'}" data-action="fin-plan-tab" data-t="${id}"
    aria-selected="${active === id}">${label}${counts[id] ? h`<span class="fin-tab-count">${counts[id]}</span>` : ''}</button>`,
    )}</div>`;
};
const finReportPicker = () => {
  const active = FIN_REPORT_TABS.some(([id]) => id === ui.finReportTab) ? ui.finReportTab : 'resumo';
  return h`<div class="tabs finance-sub-tabs finance-report-tabs" role="tablist"
    aria-label="Seções de relatórios">${FIN_REPORT_TABS.map(
      ([id, label]) => h`<button type="button"
    class="tab finance-report-option" role="tab" id="fin-report-tab-${id}" aria-controls="fin-report-panel"
    tabindex="${active === id ? '0' : '-1'}" data-action="fin-report-tab" data-t="${id}"
    aria-selected="${active === id}">${label}</button>`,
    )}</div>`;
};
// Resumo
function expenseTrendChart(ym, cur) {
  if (ym > today().slice(0, 7)) {
    return h`<p class="fine finance-trend-empty">Este mês ainda é futuro; não há evolução diária real para mostrar.</p>`;
  }
  const [year, month] = ym.split('-').map(Number);
  const lastDay = cur ? today() : `${ym}-${pad(new Date(year, month, 0).getDate())}`;
  const monthRange = ui.financeTrendRange === 'month';
  const days = monthRange
    ? Array.from({ length: Number(lastDay.slice(8)) }, (_, index) => `${ym}-${pad(index + 1)}`)
    : Array.from({ length: 7 }, (_, index) => addDays(lastDay, index - 6));
  const rangeLabel = monthRange ? 'Despesas do mês' : 'Despesas nos últimos 7 dias';
  const totals = days.map((day) =>
    S.finance.tx
      .filter((transaction) => transaction.type === 'out' && transaction.date === day)
      .reduce((sum, transaction) => sum + transaction.cents, 0),
  );
  const max = Math.max(1, ...totals);
  const selectedDay = days.includes(ui.financeWeekDay) ? ui.financeWeekDay : '';
  const compactAmount = (cents) => {
    if (ui.financeValuesHidden) return '••••';
    const value = cents / 100;
    if (value >= 1_000_000_000)
      return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value / 1_000_000_000)} bi`;
    if (value >= 1_000_000)
      return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value / 1_000_000)} mi`;
    if (value >= 1_000)
      return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value / 1_000)} mil`;
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(
      value,
    );
  };
  const summary = days
    .map((day, index) => `${longDate(day)}: ${ui.financeValuesHidden ? 'valor oculto' : formatBRL(totals[index])}`)
    .join('; ');
  const selectedIndex = days.indexOf(selectedDay);
  const showDayLabel = (index) => !monthRange || index === 0 || (index + 1) % 5 === 0 || index === days.length - 1;
  return h`<div class="finance-week-chart" role="group" aria-label="${rangeLabel}">
    <div class="finance-week-chart-grid${monthRange ? ' is-month' : ''}" style="--week-cols:${days.length}">${days.map(
      (day, index) => {
        const selected = day === selectedDay;
        const percentage = totals[index] ? Math.max(4, Math.round((totals[index] / max) * 100)) : 0;
        return h`<div class="finance-week-chart-column">
        ${
          monthRange
            ? ''
            : h`<span class="finance-week-chart-value"
          aria-hidden="true">${compactAmount(totals[index])}</span>`
        }
        <button type="button"
          class="finance-week-chart-bar${day === today() ? ' is-today' : ''}${selected ? ' is-selected' : ''}${totals[index] ? ' has-value' : ''}"
          id="finance-week-day-${day}" data-action="finance-week-day" data-day="${day}"
          aria-pressed="${String(selected)}"
          aria-label="${longDate(day)}: ${ui.financeValuesHidden ? 'valor oculto' : formatBRL(totals[index])}">
          <span class="finance-week-chart-track" aria-hidden="true"><span
            style="--week-fill:${percentage}%"></span></span>
        </button>
        <span class="finance-week-chart-day"
          aria-hidden="true">${showDayLabel(index) ? (monthRange ? String(Number(day.slice(8))) : shortDate(day)) : ''}</span>
      </div>`;
      },
    )}</div>
    ${
      selectedDay
        ? h`<p class="finance-week-chart-selected"
      aria-live="polite"><b>${longDate(selectedDay)}:</b> ${money(totals[selectedIndex])}</p>`
        : ''
    }
    <span class="sr">${rangeLabel}: ${summary}</span>
  </div>`;
}

function finRitmo(ym, st, cur) {
  if (!st.outAll && !st.inAll) return '';
  const [y, m] = ym.split('-').map(Number),
    dim = new Date(y, m, 0).getDate(),
    day = cur ? Number(today().slice(8)) : dim;
  const elapsed = cur ? today() : `${ym}-${pad(dim)}`;
  const seen = st.tx.filter((t) => t.date <= elapsed),
    out = seen.filter((t) => t.type === 'out').reduce((s, t) => s + t.cents, 0),
    income = seen.filter((t) => t.type === 'in').reduce((s, t) => s + t.cents, 0);
  const prevYM = shiftMonth(ym, -1),
    prev = monthStats(prevYM),
    prevDim = new Date(Number(prevYM.slice(0, 4)), Number(prevYM.slice(5)), 0).getDate();
  const prevDay = cur ? Math.min(day, prevDim) : prevDim,
    prevEnd = `${prevYM}-${pad(prevDay)}`;
  const prevOut = prev.tx.filter((t) => t.type === 'out' && t.date <= prevEnd).reduce((s, t) => s + t.cents, 0);
  const avg = Math.round(out / day),
    proj = cur ? Math.round((out / day) * dim) : null;
  const delta = prevOut ? Math.round(((out - prevOut) / prevOut) * 100) : null,
    rate = income > 0 ? Math.round(((income - out) / income) * 100) : null;
  const top = byCategory(seen, 'out')[0];
  return h`<section class="surface-open finance-rhythm"><div class="head"><div><h2>Evolução das despesas</h2><p
    class="small muted">${ui.financeTrendRange === 'month' ? 'Mês inteiro' : `Últimos 7 dias${cur ? '' : ' do período selecionado'}`}</p></div>
      <div class="scroll-x finance-trend-range" role="group" aria-label="Período do gráfico"><button type="button"
        class="chip" aria-pressed="${ui.financeTrendRange !== 'month'}" data-action="finance-trend-range"
        data-v="7d">7 dias</button><button type="button" class="chip" aria-pressed="${ui.financeTrendRange === 'month'}"
        data-action="finance-trend-range" data-v="month">Mês</button></div></div>
    ${expenseTrendChart(ym, cur)}
    <div class="stats3"><div><b>${money(avg)}</b><span>Gasto médio por dia até ${day}</span></div>${proj !== null ? h`<div><b>${money(proj)}</b><span>Projeção com base nos dias decorridos</span></div>` : h`<div><b>${money(out)}</b><span>Despesas até o fim do mês</span></div>`}<div><b
      class="${delta !== null && delta > 0 ? 'err' : ''}">${delta === null ? '—' : (delta > 0 ? '+' : '') + delta + '%'}</b><span>vs. mesmo período anterior</span></div></div>
    <p class="small muted">${rate !== null ? (rate >= 0 ? `Você está guardando ${rate}% da receita deste mês.` : `As despesas superaram a receita em ${Math.abs(rate)}%.`) : 'Sem receitas registradas neste mês.'}${
      top
        ? h` Maior gasto: <span
      class="expense-name">${expenseTitle(top[0])}</span> (${money(top[1])}).`
        : ''
    }</p></section>`;
}
const CATEGORY_BAR_LIMIT = 5;
function categoryBars(items, total) {
  const rest = items.slice(CATEGORY_BAR_LIMIT);
  const restValue = rest.reduce((sum, [, value]) => sum + value, 0);
  const rows = items.slice(0, CATEGORY_BAR_LIMIT).map(([name, value]) => {
    const meta = catMeta({ type: 'out', category: name });
    const percent = total ? Math.round((value / total) * 100) : 0;
    return h`<li><span class="category-bar-icon" style="--category-tone:${meta.c}">${icon(meta.i, 15)}</span><span
      class="category-bar-copy"><span class="expense-name">${expenseTitle(name)}</span><span
      class="category-bar-track"><i
      style="width:${percent}%;--category-tone:${meta.c}"></i></span></span><b>${money(value)}</b><small>${percent}%</small></li>`;
  });
  if (rest.length) {
    const percent = total ? Math.round((restValue / total) * 100) : 0;
    rows.push(
      h`<li class="category-bar-others"><span class="category-bar-icon"
        style="--category-tone:var(--muted)">${icon('pie', 15)}</span><span class="category-bar-copy"><span
        class="expense-name">Outras categorias (${rest.length})</span><span class="category-bar-track"><i
        style="width:${percent}%;--category-tone:var(--muted)"></i></span></span><b>${money(restValue)}</b><small>${percent}%</small></li>`,
    );
  }
  return h`<ul class="category-bars">${rows}</ul>`;
}
function categoryDonut(items, total) {
  if (!total || !items.length) return '';
  const top = items.slice(0, CATEGORY_BAR_LIMIT);
  const restValue = items.slice(CATEGORY_BAR_LIMIT).reduce((sum, [, value]) => sum + value, 0);
  const slices = [
    ...top.map(([name, value]) => [value, catMeta({ type: 'out', category: name }).c]),
    ...(restValue ? [[restValue, 'var(--muted)']] : []),
  ];
  let acc = 0;
  const stops = slices.map(([value, tone]) => {
    const start = (acc / total) * 100;
    acc += value;
    return `${tone} ${start.toFixed(2)}% ${((acc / total) * 100).toFixed(2)}%`;
  });
  const leader = top[0];
  const leaderPercent = Math.round((leader[1] / total) * 100);
  return h`<div class="category-donut" role="img"
    aria-label="Maior categoria: ${expenseTitle(leader[0])}, ${leaderPercent}% das despesas do mês"><span
    class="category-donut-ring" style="background:conic-gradient(${stops.join(',')})"></span><span
    class="category-donut-center"><small>Despesas</small><b>${money(total)}</b></span></div>`;
}
const FLOW_CHART_MONTHS = 6;
function monthlyFlowChart(ym, avgOut = null) {
  const yearMode = ui.finFlowRange === 'year';
  const year = ym.slice(0, 4);
  const months = yearMode
    ? Array.from({ length: 12 }, (_, index) => `${year}-${pad(index + 1)}`)
    : Array.from({ length: FLOW_CHART_MONTHS }, (_, index) => shiftMonth(ym, index - (FLOW_CHART_MONTHS - 1)));
  const data = months.map((month) => {
    const stats = monthStats(month);
    return { month, income: stats.inAll, expense: stats.outAll };
  });
  if (!data.some((item) => item.income || item.expense)) return '';
  const max = Math.max(...data.map((item) => Math.max(item.income, item.expense)), 1);
  const totalIn = data.reduce((sum, item) => sum + item.income, 0);
  const totalOut = data.reduce((sum, item) => sum + item.expense, 0);
  const totalSaved = totalIn - totalOut;
  const yearRate = savingsRatePercent(totalIn, totalOut);
  const hidden = S.settings.prefs.financeValuesHidden;
  const formatFlowAmount = (cents) => (hidden ? 'valor oculto' : brl(cents));
  const summary = data
    .map(
      (item) =>
        `${MESES_L[Number(item.month.slice(5)) - 1]}: receitas ${formatFlowAmount(item.income)}, despesas ${formatFlowAmount(item.expense)}`,
    )
    .join('; ');
  const columns = data.map((item) => {
    const label = MESES_L[Number(item.month.slice(5)) - 1].slice(0, 3);
    return h`<li class="${item.month === ym ? 'is-current' : ''}"><span class="flow-bars" aria-hidden="true"><i
      class="is-income" style="height:${Math.round((item.income / max) * 100)}%"></i><i class="is-expense"
      style="height:${Math.round((item.expense / max) * 100)}%"></i></span><span
      class="flow-label">${label}</span></li>`;
  });
  return h`<section class="card finance-flow-chart"><div
    class="head"><div><h2>${yearMode ? `Balanço de ${year}` : `Últimos ${FLOW_CHART_MONTHS} meses`}</h2><p
    class="small muted">Receitas e despesas lado a lado.</p></div><div class="finance-flow-head-right"><div
    class="seg sm" role="group" aria-label="Período do balanço"><button type="button"
    aria-pressed="${String(!yearMode)}" data-action="fin-flow-range" data-v="6m">6 meses</button><button type="button"
    aria-pressed="${String(yearMode)}" data-action="fin-flow-range" data-v="year">Ano ${year}</button></div><span
    class="flow-legend" aria-hidden="true"><span class="is-income">Receitas</span><span
    class="is-expense">Despesas</span></span></div></div>
    ${
      yearMode
        ? h`<div class="finance-annual-stats">
          <div><span>Receitas no ano</span><b class="fin-income">${money(totalIn)}</b></div>
          <div><span>Despesas no ano</span><b class="fin-expense">${money(totalOut)}</b></div>
          <div><span>Economia anual</span><b class="${totalSaved < 0 ? 'fin-expense' : 'fin-income'}">${totalSaved < 0 ? '−' : ''}${money(Math.abs(totalSaved))}</b></div>
          <div><span>Taxa de economia</span><b>${yearRate === null ? '—' : `${yearRate}%`}</b></div>
        </div>`
        : ''
    }
    <ol class="flow-columns${yearMode ? ' is-year' : ''}" role="img" aria-label="${summary}">${columns}</ol>${
      avgOut !== null && !yearMode
        ? h`<p class="small muted">Média de despesas: <b>${money(avgOut)}</b> por mês.</p>`
        : ''
    }</section>`;
}
export const UPCOMING_WINDOW_DAYS = 14;
export function calendarAgenda(ym) {
  const F = S.finance,
    now = today();
  const hidden = S.settings.prefs.financeValuesHidden;
  const amount = (cents) => (hidden ? '' : brl(cents));
  let bills = [],
    invoices = [];
  if (areaOn('finances') && F.accounts.length) {
    bills = F.tx
      .filter((t) => t.type === 'out' && !isPaid(t) && t.date.startsWith(`${ym}-`) && !isCredit(accById(t.accountId)))
      .map((t) => ({ date: t.date, label: t.desc || t.category || 'Despesa', amount: amount(t.cents) }));
    invoices = F.accounts.filter(isCredit).flatMap((card) => {
      const info = cardInfo(card);
      const pending = Math.max(0, -accountBalanceOn(card, F.tx, now) - scheduledInvoicePrincipal(card.id));
      return info.due && info.due.startsWith(`${ym}-`) && pending > 0
        ? [{ date: info.due, label: `Fatura ${accountDisplayName(card)}`, amount: amount(pending) }]
        : [];
    });
  }
  const showCycle =
    !ui.preview &&
    !S.settings.prefs.sample &&
    !S.settings.prefs.cycleDiscreet &&
    areaOn('cycle') &&
    hasCurrentCycleDataConsent(accountSession?.user);
  const cycleRange = showCycle ? nextPeriodRange(cycleStats(S.cycleLog, S.cycle, now)) : null;
  return buildAgendaForMonth(ym, { bills, invoices, cycleRange });
}
export function upcomingDueItems() {
  const F = S.finance,
    now = today(),
    limit = addDays(now, UPCOMING_WINDOW_DAYS);
  const bills = F.tx
    .filter((t) => t.type === 'out' && !isPaid(t) && t.date <= limit && !isCredit(accById(t.accountId)))
    .map((t) => ({
      key: `tx-${t.id}`,
      date: t.date,
      label: t.desc || t.category || 'Despesa',
      cents: t.cents,
      kind: 'bill',
    }));
  const invoices = F.accounts.filter(isCredit).flatMap((card) => {
    const info = cardInfo(card);
    const pending = Math.max(0, -accountBalanceOn(card, F.tx, now) - scheduledInvoicePrincipal(card.id));
    return info.due && info.due <= limit && pending > 0
      ? [
          {
            key: `card-${card.id}`,
            date: info.due,
            label: `Fatura ${accountDisplayName(card)}`,
            cents: pending,
            kind: 'invoice',
          },
        ]
      : [];
  });
  return [...bills, ...invoices].sort((a, b) => a.date.localeCompare(b.date) || b.cents - a.cents);
}
function finProximos() {
  const items = upcomingDueItems();
  if (!items.length) {
    return h`<section class="surface-open finance-upcoming"><div
      class="head"><div><h2>A vencer em ${UPCOMING_WINDOW_DAYS} dias</h2></div></div><p
      class="small muted">Nada pendente para os próximos ${UPCOMING_WINDOW_DAYS} dias.</p></section>`;
  }
  const shown = items.slice(0, 4),
    total = items.reduce((sum, item) => sum + item.cents, 0);
  return h`<section class="surface-open finance-upcoming"><div
    class="head"><div><h2>A vencer em ${UPCOMING_WINDOW_DAYS} dias</h2><p
    class="small muted">${items.length} ${plural(items.length, 'compromisso', 'compromissos')} · ${money(total)}</p></div><button
    class="btn ghost sm" data-action="fin-go" data-t="lancamentos" data-f="pendentes"
    data-clear-fin-filters>Ver pendentes</button></div>
    <ul class="list finance-upcoming-list">${shown.map((item) => {
      const days = dayDiff(item.date, today());
      const when =
        days < 0
          ? h`<span class="badge bad">Atrasado</span>`
          : days === 0
            ? h`<span class="badge warn">Hoje</span>`
            : h`<span class="small muted">${shortDate(item.date)}</span>`;
      return h`<li class="finance-upcoming-item"><span class="grow"><span
        class="ttl expense-name">${item.label}</span></span>${when}<b>${money(item.cents)}</b></li>`;
    })}</ul>
    ${
      items.length > shown.length
        ? h`<p
      class="small muted">+ ${items.length - shown.length} ${plural(items.length - shown.length, 'outro', 'outros')} nos próximos ${UPCOMING_WINDOW_DAYS} dias.</p>`
        : ''
    }</section>`;
}
function finLimitesAtencao(ym) {
  const F = S.finance,
    totals = Object.fromEntries(expenseBudgetByCategory(F.tx, ym, today()).total);
  const alerts = Object.entries(F.budgets || {})
    .map(([name, budget]) => ({
      name,
      limit: budget.cents || 0,
      spent: totals[name] || 0,
      ...budgetSettingsFor(S.settings.prefs.financeBudgetSettings, name),
    }))
    .filter((row) => row.limit > 0 && (row.pinned || (row.spent / row.limit) * 100 >= row.alertPct))
    .sort((a, b) => b.spent / b.limit - a.spent / a.limit)
    .slice(0, 3);
  if (!alerts.length) return '';
  return h`<section class="surface-open finance-limit-alerts"><div
    class="head"><div><h2>Limites em atenção</h2></div><button class="btn ghost sm" data-action="fin-go"
    data-t="planejamento" data-sub="limites">Ver limites</button></div>
    <ul class="list finance-limit-alert-list">${alerts.map((row) => {
      const over = row.spent > row.limit,
        meta = outMeta(row.name);
      return h`<li><span class="finance-limit-alert-row">${catChip(meta)}<span class="grow"><span
        class="ttl expense-name">${expenseTitle(row.name)}</span><span class="meta2">${
          over
            ? h`<span
        class="m-bad">acima em ${money(row.spent - row.limit)}</span>`
            : h`restam ${money(row.limit - row.spent)}`
        } · ${money(row.spent)} de ${money(row.limit)}</span>${budBar(row.spent, row.limit)}</span></span></li>`;
    })}</ul></section>`;
}
function finQuickEntry() {
  if (!S.finance.accounts.length) return '';
  return h`<form class="card finance-quick-entry" data-form="finance-quick-add" aria-label="Lançamento rápido">
    <div class="finance-quick-row">
      <span class="finance-quick-icon" aria-hidden="true">${icon('sparkles', 16)}</span>
      <input id="finance-quick-input" type="text" maxlength="120" autocomplete="off"
        placeholder="Lançamento rápido: mercado 85,50 · +salario 3200 · uber 24 ontem cartao #viagem"
        aria-label="Lançamento rápido por texto" aria-describedby="finance-quick-preview">
      <button type="submit" class="btn sm primary" disabled>Lançar</button>
    </div>
    <p id="finance-quick-preview" class="finance-quick-preview" data-state="idle" aria-live="polite">Ex.: mercado 85,50 · +salario 3200 · uber 24 ontem cartao #trabalho</p>
  </form>`;
}
function finResumo() {
  const F = S.finance,
    ym = ui.finMonth,
    st = monthStats(ym),
    cur = ym === today().slice(0, 7),
    bal = netBalance();
  const [forecastYear, forecastMonth] = today().slice(0, 7).split('-').map(Number);
  const forecastThrough = `${today().slice(0, 7)}-${pad(new Date(forecastYear, forecastMonth, 0).getDate())}`;
  const forecastInvoices = F.accounts.filter(isCredit).map((card) => ({
    dueDate: cardInfo(card).due,
    cents: Math.max(0, -accountBalanceOn(card, F.tx, today()) - scheduledInvoicePrincipal(card.id)),
  }));
  const forecast = projectedNetAccountBalance(F.accounts, F.tx, forecastThrough, forecastInvoices);
  const result = st.inAll - st.outAll;
  const balanceParts = balanceSplit(F.accounts, F.tx);
  const savingsRate = savingsRatePercent(st.inAll, st.outAll);
  const prevStats = monthStats(shiftMonth(ym, -1));
  const resultDiff = result - (prevStats.inAll - prevStats.outAll);
  const resultDelta =
    prevStats.inAll || prevStats.outAll
      ? h`<span class="finance-result-delta ${resultDiff < 0 ? 'is-negative' : ''}">${resultDiff === 0 ? 'Igual ao mês anterior' : h`${resultDiff > 0 ? '+' : '−'}${money(Math.abs(resultDiff))} vs. mês anterior`}</span>`
      : '';
  const cats = byCategory(st.tx, 'out'),
    totOut = st.outAll;
  const attentionLimits = finLimitesAtencao(ym);
  const attentionCards = finCartoesAtencao();
  const goalFocus = finObjetivoFoco();
  const recentDescription = cur ? 'Mês atual · até hoje.' : `Mês selecionado · ${ymLabel(ym)}.`;
  const flowMax = Math.max(st.inAll, st.outAll, 1);
  const recents = st.tx
    .filter((transaction) => !cur || transaction.date <= today())
    .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, 5);
  return h`${monthNav()}
    <section class="fin-hero" aria-label="Saldo atual das contas">
      <div class="fin-hero-main"><div><p class="fh-l">Saldo atual nas contas</p><p
        class="fh-v ${bal < 0 ? 'neg' : ''}">${money(bal)}</p><p
        class="fh-context">${balanceParts.hasSaved ? h`Disponível ${money(balanceParts.availableCents)} · guardado ${money(balanceParts.savedCents)}. Sem compras no cartão.` : 'Saldo real disponível, sem incluir compras no cartão.'}</p></div><div
        class="fin-hero-actions"><button class="btn sm"
        data-action="tx-new-in">${icon('plus', 16)}Receita</button><button class="btn sm primary"
        data-action="tx-new">${icon('plus', 16)}Despesa</button><button class="btn sm"
        data-action="tx-bulk">${icon('list', 16)}Vários</button></div></div>
      <div class="finance-projection">${
        cur
          ? h`<p
        class="section-kicker">Estimativa até o fim do mês</p><b>${money(forecast)}</b><p>Estimativa, não o saldo atual.</p><div
        class="finance-projection-footer"><details
        class="finance-projection-note"><summary>Como é calculada${icon('chevDown', 14)}</summary><p>Considera que os compromissos do mês serão pagos. Compras futuras no cartão não entram.</p></details><button
        type="button" class="btn ghost sm" data-action="fin-go" data-t="relatorios"
        data-sub="projecao">Projeção 30/60/90d</button></div>`
          : h`<p
        class="section-kicker">Mês selecionado</p><b>${cap(ymLabel(ym))}</b><p>O saldo acima é o saldo atual das contas.</p>`
      }</div>
      ${cur ? finGastoDiario(ym) : ''}
    </section>
    ${finQuickEntry()}
    <section class="finance-month-snapshot" aria-labelledby="finance-month-title">
      <div class="finance-month-heading"><div><h2 id="finance-month-title">Resumo do mês</h2></div><p
        class="small muted">${cap(ymLabel(ym))}</p></div>
      <div class="fh-row">
        <button type="button" class="finance-summary-stat is-income" data-action="fin-go" data-t="lancamentos"
          data-f="in" data-clear-fin-filters aria-label="Ver receitas lançadas no mês"><span
          class="finance-summary-icon"
          aria-hidden="true">${icon('plus', 16)}</span><span>Receitas</span><b>${money(st.inAll)}</b><span
          class="finance-flow-track" aria-hidden="true"><i
          style="width:${Math.round((st.inAll / flowMax) * 100)}%"></i></span><small>${money(st.inPaid)} recebidas</small></button>
        <button type="button" class="finance-summary-stat is-expense" data-action="fin-go" data-t="lancamentos"
          data-f="out" data-clear-fin-filters aria-label="Ver despesas lançadas no mês"><span
          class="finance-summary-icon"
          aria-hidden="true">${icon('arrowDown', 16)}</span><span>Despesas</span><b>${money(st.outAll)}</b><span
          class="finance-flow-track" aria-hidden="true"><i
          style="width:${Math.round((st.outAll / flowMax) * 100)}%"></i></span><small>${money(st.outPaid)} pagas · ${money(st.outPending)} pendentes</small></button>
        <button type="button" class="finance-summary-stat is-result${result < 0 ? ' is-negative' : ''}"
          data-action="fin-go" data-t="lancamentos" data-f="todos" data-clear-fin-filters
          aria-label="Ver lançamentos do mês para conferir o resultado"><span class="finance-summary-icon"
          aria-hidden="true">${icon('pie', 16)}</span><span>Resultado do mês</span><b>${money(result)}</b><small>${savingsRate === null ? 'Receitas menos despesas' : savingsRate >= 0 ? `Você guardou ${savingsRate}% da receita` : `Despesas ${Math.abs(savingsRate)}% acima da receita`}${resultDelta}</small></button>
      </div>
    </section>
    ${
      cur || attentionLimits || attentionCards || goalFocus
        ? h`<div
      class="fin-overview-grid fin-overview-attention">${cur ? finProximos() : ''}${attentionLimits}${attentionCards}${goalFocus}</div>`
        : ''
    }
    <div class="fin-overview-grid">
      <section class="surface-open finance-category-breakdown"><div
        class="head"><div><h2>Despesas por categoria</h2></div><button class="btn ghost sm" data-action="fin-go"
        data-t="relatorios" data-sub="categorias">Relatórios</button></div>
        ${
          cats.length
            ? h`${categoryDonut(cats, totOut)}${categoryBars(cats, totOut)}`
            : areaEmpty(
                'Nenhuma despesa neste mês.',
                'Quando houver um lançamento, a divisão por categoria aparecerá aqui.',
                h`<button
          type="button" class="btn primary"
          data-action="tx-new">${icon('plus', 16)}Registrar despesa</button>`,
                'pie',
                'h3',
              )
        }</section>
      <section class="surface-open finance-recent"><div class="head"><div><h2>Últimos lançamentos</h2><p
        class="small muted">${recentDescription}</p></div><button class="btn ghost sm" data-action="fin-go"
        data-t="lancamentos">Ver todos</button></div>${
          recents.length
            ? h`<ul
        class="list">${recents.map((t) => finRow(t, { showDate: true }))}</ul>`
            : areaEmpty(
                'Nenhum lançamento neste mês.',
                'Quando registrar algo, os lançamentos recentes aparecerão aqui.',
                h`<button
        type="button" class="btn primary"
        data-action="tx-new">${icon('plus', 16)}Criar primeiro lançamento</button>`,
                'list',
                'h3',
              )
        }</section>
    </div>
    `;
}
function finGastoDiario(ym) {
  const room = dailyBudgetRoom(S.finance.budgets, S.finance.tx, ym, today());
  if (!room.hasLimits) {
    return h`<div class="finance-daily-room is-empty"><p
      class="section-kicker">Pode gastar por dia</p><p>Defina limites por categoria para ver quanto ainda cabe em cada dia.</p><button
      type="button" class="btn ghost sm" data-action="fin-go" data-t="planejamento" data-sub="limites">Definir limites</button></div>`;
  }
  if (!room.perDayCents) {
    return h`<div class="finance-daily-room is-over"><p
      class="section-kicker">Pode gastar por dia</p><b>${money(0)}</b><p>${room.overCents ? h`Os limites já passaram ${money(room.overCents)}.` : 'Os limites do mês já foram usados.'}</p></div>`;
  }
  return h`<div class="finance-daily-room"><p
    class="section-kicker">Pode gastar por dia</p><b>${money(room.perDayCents)}</b><p>Restam ${money(room.remainingCents)} nos limites, para ${room.daysLeft} ${plural(room.daysLeft, 'dia', 'dias')}.</p></div>`;
}
function finCartoesAtencao() {
  const F = S.finance;
  const alerts = F.accounts
    .filter((card) => isCredit(card) && card.limitCents > 0)
    .map((card) => ({ card, info: cardInfo(card) }))
    .filter(({ card, info }) => info.used / card.limitCents >= 0.8)
    .sort((a, b) => b.info.used / b.card.limitCents - a.info.used / a.card.limitCents)
    .slice(0, 3);
  if (!alerts.length) return '';
  return h`<section class="surface-open finance-card-alerts"><div
    class="head"><div><h2>Limite do cartão</h2></div><button class="btn ghost sm" data-action="fin-go"
    data-t="contas" data-sub="cartoes">Ver cartões</button></div>
    <ul class="list finance-limit-alert-list">${alerts.map(
      ({ card, info }) => h`<li><span
      class="finance-limit-alert-row">${accountChip(card)}<span class="grow"><span
      class="ttl">${accountDisplayName(card)}</span><span class="meta2">${
        info.used >= card.limitCents
          ? h`<span
      class="m-bad">limite atingido</span>`
          : h`disponível ${money(info.avail ?? 0)}`
      } · ${money(info.used)} de ${money(card.limitCents)}</span>${budBar(info.used, card.limitCents)}</span></span></li>`,
    )}</ul></section>`;
}
function goalPlanLine(goal, savedCents) {
  const plan = goalMonthlyPlan(goal, savedCents, today());
  if (plan.complete) return '';
  if (plan.overdue)
    return h`<span class="small goal-plan is-late">Prazo vencido · faltam ${money(plan.remainingCents)}.</span>`;
  if (!plan.perMonthCents)
    return h`<span
      class="small muted goal-plan">Faltam ${money(plan.remainingCents)}. Defina um prazo para ver quanto guardar por mês.</span>`;
  return h`<span
    class="small goal-plan">Faltam ${money(plan.remainingCents)} · guarde cerca de <b>${money(plan.perMonthCents)}</b> por mês, durante ${plan.months} ${plural(plan.months, 'mês', 'meses')}.</span>`;
}
function finObjetivoFoco() {
  const F = S.finance;
  const open = (F.goals || [])
    .map((goal) => ({ goal, saved: linkedGoalProgressCents(goal, F.accounts, F.tx) }))
    .filter(({ goal, saved }) => goal.targetCents > 0 && saved < goal.targetCents);
  if (!open.length) return '';
  open.sort(
    (a, b) =>
      (a.goal.deadline ? 0 : 1) - (b.goal.deadline ? 0 : 1) ||
      (a.goal.deadline || '').localeCompare(b.goal.deadline || '') ||
      b.saved / b.goal.targetCents - a.saved / a.goal.targetCents,
  );
  const { goal, saved } = open[0];
  const percent = Math.min(100, Math.round((saved / goal.targetCents) * 100));
  return h`<section class="surface-open finance-goal-focus"><div class="head"><div><p
    class="section-kicker">Objetivo em foco</p><h2 class="expense-name">${goal.name}</h2></div><button
    class="btn ghost sm" data-action="fin-go" data-t="planejamento" data-sub="objetivos">Ver objetivos</button></div>
    <div class="row budget-total-row"><b>${percent}%</b><span
      class="small muted">${money(saved)} de ${money(goal.targetCents)}</span></div>
    <div class="bar goal-progress" role="progressbar" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100"
      aria-label="Progresso de ${goal.name}"><span style="width:${percent}%"></span></div>
    ${goalPlanLine(goal, saved)}
    <p class="small muted">${goal.deadline ? `Prazo: ${shortDate(goal.deadline)}.` : 'Sem prazo definido.'}${open.length > 1 ? ` Mais ${open.length - 1} ${plural(open.length - 1, 'objetivo', 'objetivos')} em andamento.` : ''}</p></section>`;
}
function finFixas() {
  const all = [...recList()].sort((a, b) => Number(a.paused) - Number(b.paused) || a.day - b.day);
  const active = all.filter((r) => !r.paused);
  const out = active.filter((r) => r.type === 'out').reduce((t, r) => t + r.cents, 0),
    inc = active.filter((r) => r.type === 'in').reduce((t, r) => t + r.cents, 0);
  return h`<section class="card finance-fixas" aria-labelledby="fin-fixas-title"><div class="head"><div><h2
    id="fin-fixas-title">Lançamentos fixos</h2><p
    class="small muted">${active.length ? h`${active.length} ${plural(active.length, 'ativo', 'ativos')}: ${money(out)} em despesas${inc ? h` e ${money(inc)} em receitas` : ''} por mês.` : 'Acompanhe contas e receitas que se repetem todo mês.'}</p></div><div class="row finance-fixas-actions"><button
    type="button" class="btn sm primary" data-action="tx-new-fixed">${icon('plus', 15)}Nova fixa</button><button
    type="button" class="btn ghost sm" data-action="rec-list">${icon('repeat', 15)}Gerenciar</button></div></div>${
      all.length
        ? h`<ul class="list finance-fixas-list">${all.map((r) => {
            const meta = catMeta({ type: r.type, category: r.category });
            const title = r.type === 'out' ? expenseTitle(r.desc || r.category) : r.desc || r.category;
            return h`<li class="fr${r.paused ? ' pend' : ''}"><button type="button" class="fr-main"
              data-action="rec-edit" data-id="${r.id}" aria-label="Editar lançamento fixo ${title}">${catChip(meta)}<span
              class="grow"><span class="ttl ${r.type === 'out' ? 'expense-name' : ''}">${title}${
                r.paused ? h` <span class="badge">Pausada</span>` : ''
              }</span><span class="meta2">Todo dia ${r.day} · ${accName(r.accountId)} · ${expenseTitle(r.category)}</span></span><span
              class="amt ${r.type}">${r.type === 'in' ? '+' : '−'}${money(r.cents)}</span>${icon('chevRight', 16)}</button></li>`;
          })}</ul>`
        : areaEmpty(
            'Nenhum lançamento fixo cadastrado.',
            'Configure despesas ou receitas mensais para acompanhá-las direto por aqui.',
            h`<button type="button" class="btn primary"
              data-action="tx-new-fixed">${icon('plus', 16)}Criar lançamento fixo</button>`,
            'repeat',
            'h3',
          )
    }</section>`;
}
const budBar = (spent, lim) => {
  const pc = lim ? Math.min(100, Math.round((spent / lim) * 100)) : 0,
    cls = spent > lim ? 'over' : pc >= 80 ? 'near' : '';
  return h`<div class="bar ${cls}" role="progressbar" aria-valuenow="${pc}" aria-valuemin="0" aria-valuemax="100"><span
    style="width:${pc}%"></span></div>`;
};

// Lançamentos
const FIN_FILTERS = [
  ['todos', 'Todos'],
  ['out', 'Despesas'],
  ['in', 'Receitas'],
  ['tr', 'Transferências'],
  ['pendentes', 'Pendentes'],
];
export function filteredTx() {
  const ym = ui.finMonth,
    f = ui.finFilter,
    q = norm(ui.finQ.trim());
  return S.finance.tx
    .filter((t) => {
      if (!t.date.startsWith(ym)) return false;
      if (f === 'pendentes' ? isPaid(t) : f !== 'todos' && t.type !== f) return false;
      if (ui.finCat && t.category !== ui.finCat) return false;
      if (ui.finAcc && t.accountId !== ui.finAcc && t.toAccountId !== ui.finAcc) return false;
      if (ui.finTag && !extractFinanceTags(t.desc).includes(ui.finTag)) return false;
      if (!q) return true;
      const accounts = [accById(t.accountId), accById(t.toAccountId)].filter(Boolean);
      const searchTerms = [
        t.desc,
        t.category,
        t.type === 'in' ? 'receita' : t.type === 'out' ? 'despesa' : 'transferência',
        ...accounts.flatMap((account) => [
          accountDisplayName(account),
          accountTypeLabel(account),
          bankFieldValue(account.bank),
        ]),
      ];
      return searchTerms.some((term) => norm(term || '').includes(q));
    })
    .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0));
}
export function txListHtml() {
  const all = filteredTx();
  const page = listPage(
    'transactions',
    JSON.stringify([ui.finMonth, ui.finFilter, ui.finQ, ui.finAcc, ui.finCat, ui.finTag]),
  );
  const r = all.slice(0, page.limit);
  if (!r.length) {
    const filtered = !!(ui.finQ || ui.finAcc || ui.finCat || ui.finTag || ui.finFilter !== 'todos');
    return areaEmpty(
      filtered ? 'Nenhum lançamento encontrado.' : 'Nenhum lançamento neste mês.',
      filtered
        ? 'Ajuste os filtros ou limpe a busca para ver outros lançamentos.'
        : 'Quando registrar algo, ele aparecerá nesta lista.',
      filtered
        ? h`<button type="button" class="btn primary" data-action="fin-filters-clear">Limpar filtros</button>`
        : h`<button type="button" class="btn primary"
          data-action="tx-new">${icon('plus', 16)}Criar primeiro lançamento</button>`,
      filtered ? 'search' : 'list',
      'h3',
    );
  }
  const days = [];
  r.forEach((t) => {
    const l = days[days.length - 1];
    if (l && l.d === t.date) l.items.push(t);
    else days.push({ d: t.date, items: [t] });
  });
  const netByDay = new Map();
  all.forEach((t) =>
    netByDay.set(t.date, (netByDay.get(t.date) || 0) + (t.type === 'in' ? t.cents : t.type === 'out' ? -t.cents : 0)),
  );
  const selectedAccount = ui.finAcc ? accById(ui.finAcc) : null;
  const showRunningBalance = Boolean(selectedAccount && !isCredit(selectedAccount));
  return h`<div class="finance-results-groups">${days.map((g) => {
    const net = netByDay.get(g.d);
    const dayBalance = showRunningBalance ? accountBalanceOn(selectedAccount, S.finance.tx, g.d) : null;
    return h`<section class="grp"><h3 class="gh">${g.d === today() ? 'Hoje' : cap(longDate(g.d))}<span
      class="grow"></span>${
        dayBalance !== null
          ? h`<span class="gbal ${dayBalance < 0 ? 'neg' : ''}">Saldo ${money(dayBalance)}</span>`
          : ''
      }<span
      class="gsum ${net > 0 ? 'pos' : ''}">${net ? h`${net > 0 ? '+' : '−'}${money(Math.abs(net))}` : ''}</span></h3><ul
      class="list">${g.items.map(finRow)}</ul></section>`;
  })}</div>
    ${
      all.length > r.length
        ? h`<p class="small muted">Mostrando ${r.length} de ${all.length} lançamentos</p><button
      type="button" class="btn" data-action="transactions-show-more">Mostrar mais lançamentos</button>`
        : ''
    }`;
}
function finCalendarHtml() {
  const ym = ui.finMonth;
  const [year, month] = ym.split('-').map(Number);
  const weekStart = Number(S.settings.look?.weekStart) === 0 ? 0 : 1;
  const firstDow = new Date(year, month - 1, 1).getDay();
  const leading = (firstDow - weekStart + 7) % 7;
  const daysInMonth = new Date(year, month, 0).getDate();
  const weekHeaders =
    weekStart === 0
      ? ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
      : ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  const all = filteredTx();
  const byDay = new Map();
  all.forEach((tx) => {
    const bucket = byDay.get(tx.date) || { in: 0, out: 0, pend: 0, items: [] };
    if (tx.type === 'in') bucket.in += tx.cents;
    if (tx.type === 'out') bucket.out += tx.cents;
    if (!isPaid(tx)) bucket.pend++;
    bucket.items.push(tx);
    byDay.set(tx.date, bucket);
  });
  const cardDueByDay = new Map();
  S.finance.accounts.filter(isCredit).forEach((card) => {
    const info = cardInfo(card);
    if (info.due && info.due.startsWith(`${ym}-`) && info.used > 0) {
      const list = cardDueByDay.get(info.due) || [];
      list.push({ name: accountDisplayName(card), cents: info.total || info.used, id: card.id });
      cardDueByDay.set(info.due, list);
    }
  });
  const selectedDay =
    ui.finCalDay && ui.finCalDay.startsWith(`${ym}-`)
      ? ui.finCalDay
      : today().startsWith(`${ym}-`)
        ? today()
        : `${ym}-01`;
  const cells = [];
  for (let i = 0; i < leading; i++) cells.push(h`<span class="fin-cal-empty" aria-hidden="true"></span>`);
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${ym}-${pad(d)}`;
    const info = byDay.get(iso);
    const dues = cardDueByDay.get(iso) || [];
    const isSelected = iso === selectedDay;
    const isTodayDay = iso === today();
    cells.push(
      h`<button type="button" class="fin-cal-cell${isSelected ? ' is-selected' : ''}${isTodayDay ? ' is-today' : ''}${info || dues.length ? ' has-items' : ''}"
        data-action="fin-cal-day" data-day="${iso}" aria-pressed="${String(isSelected)}"
        aria-label="${longDate(iso)}${info ? `, ${info.items.length} lançamentos` : ''}${dues.length ? `, vencimento de fatura` : ''}">
        <span class="fin-cal-num">${d}</span>
        <span class="fin-cal-dots" aria-hidden="true">${info?.in ? h`<i class="is-in"></i>` : ''}${info?.out ? h`<i class="is-out"></i>` : ''}${info?.pend || dues.length ? h`<i class="is-due"></i>` : ''}</span>
      </button>`,
    );
  }
  const dayBucket = byDay.get(selectedDay);
  const dayDues = cardDueByDay.get(selectedDay) || [];
  return h`<div class="finance-calendar">
    <div class="fin-cal-head" aria-hidden="true">${weekHeaders.map((label) => h`<span>${label}</span>`)}</div>
    <div class="fin-cal-grid" role="grid" aria-label="Calendário financeiro de ${ymLabel(ym)}">${cells}</div>
    <div class="fin-cal-legend" aria-hidden="true"><span><i class="is-in"></i>Receita</span><span><i class="is-out"></i>Despesa</span><span><i class="is-due"></i>Pendente / fatura</span></div>
    <div class="fin-cal-day-panel">
      <div class="head"><div><h3>${selectedDay === today() ? 'Hoje' : cap(longDate(selectedDay))}</h3><p class="small muted">${
        dayBucket
          ? `${dayBucket.items.length} ${plural(dayBucket.items.length, 'lançamento', 'lançamentos')}`
          : 'Nenhum lançamento neste dia.'
      }</p></div><button type="button" class="btn sm" data-action="tx-new-on-date" data-date="${selectedDay}">${icon('plus', 15)}Novo neste dia</button></div>
      ${
        dayDues.length
          ? h`<div class="fin-cal-dues">${dayDues.map(
              (
                due,
              ) => h`<div class="notice fin-cal-due-row">${icon('card', 16)}<span class="grow">Vencimento da fatura <b>${due.name}</b> · ${money(due.cents)}</span><button
                type="button" class="btn sm" data-action="fin-go" data-t="contas" data-sub="cartoes">Ver cartão</button></div>`,
            )}</div>`
          : ''
      }
      ${dayBucket?.items?.length ? h`<ul class="list">${dayBucket.items.map(finRow)}</ul>` : ''}
    </div>
  </div>`;
}
function finLanc() {
  return h`${monthNav()}${finQuickEntry()}<div id="fin-view-panel">${finLancList()}</div>`;
}
function finLancList() {
  const st = monthStats(ui.finMonth);
  const balance = st.inAll - st.outAll;
  const activeFilters = (ui.finQ ? 1 : 0) + (ui.finAcc ? 1 : 0) + (ui.finCat ? 1 : 0) + (ui.finTag ? 1 : 0);
  const filtersOpen = Boolean(ui.finFiltersOpen);
  const viewMode = ui.finViewMode === 'calendario' ? 'calendario' : 'lista';
  const allTags = [...new Set(S.finance.tx.flatMap((tx) => extractFinanceTags(tx.desc)))].slice(0, 12);
  const selectedAccount = ui.finAcc ? accById(ui.finAcc) : null;
  const monthEnd = `${ui.finMonth}-${pad(new Date(Number(ui.finMonth.slice(0, 4)), Number(ui.finMonth.slice(5)), 0).getDate())}`;
  const selectedProjected =
    selectedAccount && !isCredit(selectedAccount) ? accountBalanceOn(selectedAccount, S.finance.tx, monthEnd) : null;
  return h`<section class="card finance-transactions-card">
      <div class="fin-lanc-header">
        <div class="scroll-x" role="group" aria-label="Filtrar lançamentos">${FIN_FILTERS.map(
          ([k, l]) => h`<button class="chip"
        aria-pressed="${ui.finFilter === k}" data-action="fin-filter" data-f="${k}">${l}</button>`,
        )}</div>
        <div class="fin-lanc-right">
          <div class="seg sm fin-view-toggle" role="group" aria-label="Modo de exibição">
            <button type="button" aria-pressed="${String(viewMode === 'lista')}" data-action="fin-view-mode" data-mode="lista">${icon('list', 14)}Lista</button>
            <button type="button" aria-pressed="${String(viewMode === 'calendario')}" data-action="fin-view-mode" data-mode="calendario">${icon('calendar', 14)}Calendário</button>
          </div>
          ${finTools()}
        </div>
      </div>
      ${
        allTags.length
          ? h`<div class="fin-tag-filter-row" role="group" aria-label="Filtrar por etiqueta">${allTags.map(
              (tag) => h`<button type="button" class="chip finance-tag-chip" data-action="fin-tag" data-tag="${tag}"
                aria-pressed="${String(ui.finTag === tag)}">#${tag}</button>`,
            )}</div>`
          : ''
      }
      <div class="row fin-filter-bar"><button type="button" class="btn sm fin-filter-toggle"
        data-action="fin-filters-toggle" aria-expanded="${String(filtersOpen)}"
        aria-controls="fin-filter-panel">${icon('sliders', 16)}Filtros${
          activeFilters
            ? h`<span class="fin-filter-count"
        aria-label="${activeFilters} ${plural(activeFilters, 'filtro ativo', 'filtros ativos')}">${activeFilters}</span>`
            : ''
        }</button></div>
      <div class="row fin-filter-row" id="fin-filter-panel" ${filtersOpen ? '' : raw('data-collapsed')}><label
        class="search"><span class="sr">Buscar lançamentos</span>${icon('search', 18)}<input type="search" id="fq"
        data-keep value="${ui.finQ}" placeholder="Descrição, categoria, conta ou #tag" data-input="fin-search"></label>
        <label><span class="sr">Filtrar por categoria</span><select data-change="fin-cat"><option
          value="">Categorias</option>${[...new Set([...catNames('out'), ...catNames('in')])].map(
            (c) => h`<option
          class="expense-name"
          value="${c}" ${ui.finCat === c ? raw('selected') : ''}>${expenseTitle(c)}</option>`,
          )}</select></label>
        <label><span class="sr">Filtrar por conta</span><select data-change="fin-acc"><option
          value="">Todas as contas</option>${S.finance.accounts.map(
            (a) => h`<option class="user-value"
          value="${a.id}" ${ui.finAcc === a.id ? raw('selected') : ''}>${accountOptionLabel(a)}</option>`,
          )}</select></label></div>
      <div class="fin-summary" role="group" aria-label="Resumo do mês">
        <div class="fin-sum-item"><span class="fin-sum-label">Receitas</span><b
          class="fin-sum-value fin-income">${money(st.inAll)}</b></div>
        <div class="fin-sum-item"><span class="fin-sum-label">Despesas</span><b
          class="fin-sum-value fin-expense">${money(st.outAll)}</b></div>
        <div class="fin-sum-item fin-sum-balance"><span class="fin-sum-label">${selectedProjected !== null ? `Previsto (${accountDisplayName(selectedAccount)})` : 'Saldo do mês'}</span><b
          class="fin-sum-value ${(selectedProjected !== null ? selectedProjected : balance) < 0 ? 'fin-expense' : (selectedProjected !== null ? selectedProjected : balance) > 0 ? 'fin-income' : ''}">${(selectedProjected !== null ? selectedProjected : balance) < 0 ? '−' : ''}${money(Math.abs(selectedProjected !== null ? selectedProjected : balance))}</b></div>
      </div>
      <div id="tx-results" aria-live="polite" tabindex="-1">${viewMode === 'calendario' ? finCalendarHtml() : txListHtml()}</div></section>`;
}

// Contas e cartões
function invoiceStatusBadge(invoice, todayIso) {
  if (!invoice.total) return h`<span class="badge">Sem compras</span>`;
  if (invoice.dueDate && invoice.dueDate < todayIso) return h`<span class="badge bad">Vencida</span>`;
  if (invoice.dueDate && invoice.dueDate === todayIso) return h`<span class="badge warn">Vence hoje</span>`;
  if (invoice.closingDate && invoice.closingDate <= todayIso) return h`<span class="badge warn">Fechada</span>`;
  return h`<span class="badge ok">Aberta</span>`;
}
function creditCardCard(card, paymentAccounts) {
  const info = cardInfo(card),
    percent = card.limitCents ? Math.min(100, Math.round((info.used / card.limitCents) * 100)) : 0;
  const shift = ui.finInvoiceShift?.[card.id] || 0;
  const month = shiftMonth(info.ym, shift);
  const invoice = calculateCardInvoice(S.finance, card, month, { shiftMonth, parseDate: pk });
  const dates = [
    invoice.closingDate ? `fecha ${shortDate(invoice.closingDate)}` : '',
    invoice.dueDate ? `vence ${shortDate(invoice.dueDate)}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
  const scheduledInstallments = S.finance.tx.filter(
    (transaction) => transaction.invoiceInstallment && transaction.toAccountId === card.id && !isPaid(transaction),
  );
  const scheduledTotal = scheduledInstallments.reduce((sum, transaction) => sum + transaction.cents, 0);
  const bankName =
    card.bank === OTHER_BANK
      ? 'outro banco / não listado'
      : Object.hasOwn(BANKS, card.bank)
        ? BANKS[card.bank].name
        : card.bank;
  const paymentAccount = paymentAccounts.find((account) => account.id === card.linkedAccountId);
  const name = accountDisplayName(card);
  return h`<li class="cc"><div
    class="cc-top">${card.bank ? accountChip(card) : catChip({ c: '#7c8fd4', i: 'card' })}<span class="grow"><span
    class="ttl">${name}</span><span class="small muted">${
      bankName
        ? h`<span
    class="user-value">${bankName}</span> · `
        : ''
    }${card.closingDay ? 'Fecha dia ' + card.closingDay : ''}${card.dueDay ? ' · vence dia ' + card.dueDay : ''}</span>${cardDueLabel(info.due)}</span><button
    class="ibtn" data-action="acct-edit" data-id="${card.id}"
    aria-label="Editar cartão ${name}${bankName ? ', ' + bankName : ''}">${icon('pencil', 18)}</button></div>
    <div class="cc-invoice-inline">
      <div class="cc-invoice-nav">
        <button type="button" class="ibtn" data-action="invoice-shift" data-id="${card.id}"
          data-d="-1" aria-label="Fatura anterior do cartão ${name}">${icon('chevLeft', 18)}</button>
        <span class="cc-invoice-title"><b>Fatura de ${cap(ymLabel(month))}</b>${dates ? h`<small>${dates}</small>` : ''}</span>
        <button type="button" class="ibtn" data-action="invoice-shift" data-id="${card.id}" data-d="1"
          aria-label="Próxima fatura do cartão ${name}">${icon('chevRight', 18)}</button>
      </div>
      <div class="cc-metrics">
        <div class="cc-metric-main">
          <span class="small muted">Valor da fatura ${invoiceStatusBadge(invoice, today())}</span>
          <b class="cc-v">${money(invoice.total)}</b>
        </div>
        ${
          card.limitCents
            ? h`<div class="cc-metric">
                <span class="small muted">Limite usado</span>
                <b>${money(info.used)}</b>
              </div>
              <div class="cc-metric">
                <span class="small muted">Disponível</span>
                <b class="fin-income">${money(info.avail)}</b>
              </div>`
            : ''
        }
      </div>
    </div>
    ${
      card.limitCents
        ? h`<div class="bar ${percent >= 100 ? 'over' : percent >= 80 ? 'near' : ''}" role="progressbar"
      aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100" aria-label="Limite usado do cartão ${name}"><span
      style="width:${percent}%"></span></div><p
      class="small muted">Limite total ${money(card.limitCents)} (${percent}% comprometido${info.used > invoice.total ? ', incluindo parcelas futuras' : ''})</p>`
        : ''
    }
    <details class="cc-invoice" id="d-invoice-${card.id}" ${ui.openDetails[`invoice-${card.id}`] ? raw('open') : ''}>
      <summary><span>${
        invoice.purchases.length
          ? `Ver ${invoice.purchases.length} ${plural(invoice.purchases.length, 'compra', 'compras')} desta fatura`
          : 'Nenhuma compra nesta fatura'
      }${invoice.installmentCount ? ` (${invoice.installmentCount} ${plural(invoice.installmentCount, 'parcela', 'parcelas')})` : ''}</span>${icon('chevDown', 14)}</summary>
      ${
        invoice.purchases.length
          ? h`<ul class="list cc-invoice-list">${invoice.purchases.map((transaction) => finRow(transaction, { showDate: true }))}</ul>`
          : empty('Nenhuma compra nesta fatura', 'As compras feitas no cartão neste período aparecem aqui.', '', 'card')
      }
    </details>
    ${
      paymentAccount
        ? h`<p class="small muted">Conta preferencial para pagamento: <span
      class="user-value">${accountOptionLabel(paymentAccount)}</span></p>`
        : ''
    }
    ${
      scheduledInstallments.length
        ? h`<p
      class="small muted">${scheduledInstallments.length} ${plural(scheduledInstallments.length, 'parcela de fatura programada', 'parcelas de fatura programadas')} · ${money(scheduledTotal)} pendentes. Não descontadas do saldo da conta.</p>`
        : ''
    }
    <div class="row cc-actions"><button type="button" class="btn sm primary" data-action="tx-new-card"
      data-id="${card.id}">${icon('plus', 15)}Nova compra</button><button type="button" class="btn sm"
      data-action="pay-inv" data-id="${card.id}" ${info.used > 0 && paymentAccounts.length ? '' : raw('disabled')}>Pagar fatura</button></div></li>`;
}
function finContas() {
  const F = S.finance,
    accs = F.accounts.filter((a) => !isCredit(a));
  return h`<div class="head"><div><h2>Contas</h2><p class="small muted">Toque em uma conta para ver o extrato filtrado.</p></div><button class="btn sm"
      data-action="acct-new">${icon('plus', 16)}Nova conta</button></div>
    ${
      accs.length
        ? h`<ul class="cards">${accs.map((a) => {
            const balance = accBalance(a),
              bankName =
                a.bank === OTHER_BANK
                  ? 'outro banco / não listado'
                  : Object.hasOwn(BANKS, a.bank)
                    ? BANKS[a.bank].name
                    : a.bank,
              name = accountDisplayName(a);
            return h`<li class="acc-row"><button type="button" class="acc" data-action="acct-statement" data-id="${a.id}"
              aria-label="Ver extrato da conta ${name}${bankName ? ', ' + bankName : ''}, ${balance < 0 ? 'saldo negativo de ' + brl(Math.abs(balance)) : 'saldo ' + brl(balance)}">${accountChip(a)}<span
              class="grow"><span class="ttl">${name}</span><span
              class="small muted">${ACCOUNT_TYPES[a.type] || a.type}${
                bankName
                  ? h` · <span
              class="user-value">${bankName}</span>`
                  : ''
              } · ver extrato</span></span><b
              class="${balance < 0 ? 'neg' : ''}">${money(balance)}</b></button><button type="button"
              class="ibtn acc-edit-btn" data-action="acct-edit" data-id="${a.id}"
              aria-label="Editar conta ${name}" title="Editar conta">${icon('pencil', 16)}</button></li>`;
          })}</ul>`
        : h`<div class="card">${areaEmpty(
            'Nenhuma conta ainda.',
            'Você pode cadastrar uma conta e acompanhar os movimentos por aqui.',
            h`<button
          type="button" class="btn primary"
          data-action="acct-new">Criar primeira conta</button>`,
            'wallet',
            'h3',
          )}</div>`
    }`;
}
function finCartoes() {
  const cards = S.finance.accounts.filter(isCredit);
  const paymentAccounts = S.finance.accounts.filter((account) => !isCredit(account));
  return h`<div class="head"><div><h2>Cartões de crédito</h2><p
      class="small muted">Faturas, limites e pagamentos registrados manualmente.</p></div>${
        cards.length
          ? h`<button
      class="btn sm" data-action="acct-new-card">${icon('plus', 16)}Novo cartão</button>`
          : ''
      }</div>
    ${
      cards.length
        ? h`<ul
      class="cards">${cards.map((card) => creditCardCard(card, paymentAccounts))}</ul>`
        : h`<section
      class="card">${areaEmpty(
        'Nenhum cartão cadastrado.',
        'Se quiser, acompanhe faturas, limites e vencimentos de forma manual.',
        h`<button
      type="button" class="btn primary"
      data-action="acct-new-card">${icon('plus', 16)}Cadastrar primeiro cartão</button>`,
        'card',
        'h3',
      )}</section>`
    }`;
}
function finContasCartoes() {
  const active = ui.finAccountTab === 'cartoes' ? 'cartoes' : 'contas';
  const accounts = S.finance.accounts.filter((account) => !isCredit(account));
  const cards = S.finance.accounts.filter(isCredit);
  const balance = netBalance();
  const outstanding = cards.reduce((sum, card) => sum + cardInfo(card).used, 0);
  return h`<div class="finance-accounts-overview" role="group" aria-label="Resumo de contas e cartões">
      <button type="button" class="card flat finance-account-summary-tile${active === 'contas' ? ' is-active' : ''}"
        data-action="fin-account-tab" data-t="contas">
        <span class="small muted">Saldo em contas</span>
        <b class="fh-v ${balance < 0 ? 'neg' : ''}">${money(balance)}</b>
        <small class="muted">${accounts.length} ${plural(accounts.length, 'conta ativa', 'contas ativas')} · sem cartões</small>
      </button>
      <button type="button" class="card flat finance-account-summary-tile${active === 'cartoes' ? ' is-active' : ''}"
        data-action="fin-account-tab" data-t="cartoes">
        <span class="small muted">Em aberto nos cartões</span>
        <b class="fh-v">${money(outstanding)}</b>
        <small class="muted">${cards.length} ${plural(cards.length, 'cartão', 'cartões')} · fora do saldo em contas</small>
      </button>
    </div>
    ${finAccountPicker()}<div id="fin-account-panel" role="tabpanel"
    aria-labelledby="fin-account-tab-${active}">${active === 'cartoes' ? finCartoes() : finContas()}</div>`;
}

// Orçamento e objetivos
function budgetRowHtml(r) {
  const m = outMeta(r.n),
    over = r.lim > 0 && r.sp > r.lim;
  const alertPct = budgetSettingsFor(S.settings.prefs.financeBudgetSettings, r.n).alertPct;
  const nearLimit = r.lim > 0 && !over && (r.sp / r.lim) * 100 >= alertPct;
  const label = `Definir limite de ${r.n}${nearLimit ? `. Atenção: atingiu pelo menos ${alertPct}% do limite mensal.` : ''}`;
  return h`<li data-cat-name="${r.n}"><button class="fr-main" data-action="budget-edit" data-c="${r.n}"
    aria-label="${label}">${catChip(m)}<span class="grow"><span
    class="ttl expense-name">${expenseTitle(r.n)}</span>${
      r.lim
        ? h`<span
    class="meta2">Até hoje: ${money(r.realized)} · data futura: ${money(r.upcoming)} · total ${money(r.sp)} de ${money(r.lim)}${
      over
        ? h` · <span
    class="m-bad">acima em ${money(r.sp - r.lim)}</span>`
        : h` · restam ${money(r.lim - r.sp)}`
    }</span>${
      nearLimit
        ? h`<small
    class="budget-threshold-alert">Atenção: atingiu pelo menos ${alertPct}% do limite mensal.</small>`
        : ''
    }${budBar(r.sp, r.lim)}`
        : h`<span
    class="meta2">${r.sp ? h`Até hoje: ${money(r.realized)} · data futura: ${money(r.upcoming)} · total ${money(r.sp)} · ` : ''}sem limite</span>`
    }</span>${icon('chevRight', 16)}</button></li>`;
}
function finPlanLimites(ym) {
  const F = S.finance,
    asOfDate = today();
  const budgetTotals = expenseBudgetByCategory(F.tx, ym, asOfDate);
  const spent = Object.fromEntries(budgetTotals.total);
  const throughToday = Object.fromEntries(budgetTotals.throughToday);
  const afterToday = Object.fromEntries(budgetTotals.afterToday);
  const names = [...new Set([...catNames('out'), ...Object.keys(spent), ...Object.keys(F.budgets)])].filter(
    (n) => n !== 'Estudos' || spent[n] || F.budgets[n],
  );
  const rows = names
    .map((n) => ({
      n,
      sp: spent[n] || 0,
      realized: throughToday[n] || 0,
      upcoming: afterToday[n] || 0,
      lim: (F.budgets[n] || {}).cents || 0,
    }))
    .sort((a, b) => (b.lim > 0) - (a.lim > 0) || b.sp - a.sp);
  const activeRows = rows.filter((r) => r.lim > 0 || r.sp > 0);
  const otherRows = rows.filter((r) => r.lim === 0 && r.sp === 0);
  const primaryRows = activeRows.length ? activeRows : rows.filter((r) => !r.n.includes(' > '));
  const secondaryRows = activeRows.length ? otherRows : rows.filter((r) => r.n.includes(' > '));
  const limited = rows.filter((r) => r.lim > 0),
    tl = limited.reduce((s, r) => s + r.lim, 0),
    ts = limited.reduce((s, r) => s + r.sp, 0);
  const totalRealized = limited.reduce((s, r) => s + r.realized, 0);
  const totalUpcoming = limited.reduce((s, r) => s + r.upcoming, 0);
  const currentMonth = ym === asOfDate.slice(0, 7);
  const [budgetYear, budgetMonth] = ym.split('-').map(Number);
  const budgetDays = new Date(budgetYear, budgetMonth, 0).getDate();
  const daysLeft = currentMonth ? budgetDays - Number(asOfDate.slice(8)) + 1 : 0;
  const dailyRoom = daysLeft && tl > ts ? Math.floor((tl - ts) / daysLeft) : 0;
  const queryNeedle = norm((ui.finBudgetQ || '').trim());
  return h`<section class="card"><div class="head"><h2>Limites do mês</h2><button class="btn ghost sm"
      data-action="category-manager">Gerenciar categorias</button></div>
      ${
        limited.length
          ? h`<div><div class="row budget-total-row"><b>${money(ts)}</b><span
        class="small muted">de ${money(tl)}</span></div>${budBar(ts, tl)}<p
        class="small budget-summary-note ${ts > tl ? 'err' : 'muted'}">${ts > tl ? h`Passou ${money(ts - tl)} do limite total.` : h`Restam ${money(tl - ts)} nas categorias com limite.`}</p><p
        class="small muted">Do total, ${money(totalRealized)} têm data até hoje e ${money(totalUpcoming)} têm data futura. O limite soma ambos; a situação de pagamento é independente da data.</p>${
          currentMonth
            ? h`<p
        class="small budget-daily-room">${dailyRoom ? h`Você ainda pode gastar cerca de ${money(dailyRoom)} por dia nos próximos ${daysLeft} dias.` : ts >= tl ? 'Os limites mensais já foram atingidos.' : `Sem valor restante nos limites para os próximos ${daysLeft} dias.`}</p>`
            : ''
        }</div>`
          : h`<p
        class="small muted">Defina um limite mensal para as categorias em que quer controlar os gastos. Toque em uma categoria abaixo.</p>`
      }
      <ul class="list budget-list">${primaryRows.map(budgetRowHtml)}</ul>
      ${
        secondaryRows.length
          ? h`<details class="finance-other-categories" id="d-budget-other" ${ui.openDetails['budget-other'] ? raw('open') : ''}>
            <summary><span>Outras categorias sem limite (${secondaryRows.length})</span>${icon('chevDown', 16)}</summary>
            <label class="search finance-budget-search"><span class="sr">Buscar categoria</span>${icon('search', 16)}<input
              id="budget-cat-search" type="search" data-keep value="${ui.finBudgetQ || ''}"
              placeholder="Buscar categoria para definir limite…" data-input="budget-cat-search"></label>
            <ul class="list budget-other-list" id="budget-other-list">${secondaryRows.map((r) => {
              const hidden = queryNeedle && !norm(r.n).includes(queryNeedle);
              return hidden ? raw(budgetRowHtml(r).s.replace('<li ', '<li hidden ')) : budgetRowHtml(r);
            })}</ul>
          </details>`
          : ''
      }</section>`;
}
function finPlanObjetivos() {
  const F = S.finance;
  return h`<section class="card"><div class="head"><h2>Objetivos</h2>${
    F.goals.length
      ? h`<button class="btn sm"
    data-action="goal-new">${icon('plus', 16)}Novo objetivo</button>`
      : ''
  }</div>
    ${
      F.goals.length
        ? h`<ul class="goal-list">${F.goals.map((g) => {
            const savedCents = linkedGoalProgressCents(g, F.accounts, F.tx);
            const linkedAccount = F.accounts.find((account) => account.id === g.linkedAccountId);
            const pc = g.targetCents ? Math.min(100, Math.round((savedCents / g.targetCents) * 100)) : 0;
            const complete = savedCents >= g.targetCents;
            return h`<li class="goal-item${complete ? ' is-complete' : ''}"><div class="goal-heading"><span
              class="ttl">${g.name}${g.sample ? h` <span class="badge">Exemplo</span>` : ''}${
                complete
                  ? h` <span
              class="badge ok">Concluído</span>`
                  : ''
              }</span><b class="goal-percent">${pc}%</b></div><div
              class="bar goal-progress" role="progressbar" aria-valuenow="${pc}" aria-valuemin="0" aria-valuemax="100"
              aria-label="Progresso de ${g.name}"><span style="width:${pc}%"></span></div><span
              class="small muted">${money(savedCents)} de ${money(g.targetCents)} · ${linkedAccount ? `saldo acompanhado: ${accountDisplayName(linkedAccount)}` : g.linkedAccountId ? 'conta vinculada indisponível' : 'acompanhamento manual'} · ${g.deadline ? 'até ' + shortDate(g.deadline) : 'Sem prazo'}</span>${goalPlanLine(g, savedCents)}<div
              class="goal-actions"><button class="btn sm" data-action="goal-edit" data-id="${g.id}"
              aria-label="Editar objetivo ${g.name}">Editar</button>${
                linkedAccount
                  ? h`<span
              class="small muted">Saldo sincronizado com a conta</span>`
                  : h`<button class="btn sm"
              data-action="goal-dep" data-id="${g.id}">Guardar</button>`
              }<button class="ibtn" data-action="goal-del"
              data-id="${g.id}" aria-label="Excluir objetivo ${g.name}">${icon('trash', 18)}</button></div></li>`;
          })}</ul>`
        : areaEmpty(
            'Nenhum objetivo ainda.',
            'Defina um objetivo e acompanhe o quanto já separou para ele.',
            h`<button type="button" class="btn primary"
              data-action="goal-new">${icon('plus', 16)}Criar primeiro objetivo</button>`,
            'target',
            'h3',
          )
    }</section>`;
}
function finPlanejamento() {
  const F = S.finance,
    ym = ui.finMonth;
  const active = FIN_PLAN_TABS.some(([id]) => id === ui.finPlanTab) ? ui.finPlanTab : 'limites';
  const limitCount = Object.values(F.budgets || {}).filter((b) => (b?.cents || 0) > 0).length;
  const goalCount = (F.goals || []).length;
  const commitmentCount = financeInstallmentPlans().length + recList().filter((r) => !r.paused).length;
  const content =
    active === 'objetivos'
      ? finPlanObjetivos()
      : active === 'compromissos'
        ? h`${finInstallments()}${finFixas()}`
        : finPlanLimites(ym);
  return h`${active === 'limites' ? monthNav() : ''}${finPlanPicker({
    limites: limitCount,
    objetivos: goalCount,
    compromissos: commitmentCount,
  })}<div id="fin-plan-panel" role="tabpanel" aria-labelledby="fin-plan-tab-${active}">${content}</div>`;
}

// Relatórios
function finMonthClose(ym) {
  const close = summarizeMonthlyClose(S.finance.tx, ym, accById);
  return h`<details class="card finance-month-close" id="d-month-close" ${ui.openDetails['month-close'] ? raw('open') : ''}>
    <summary class="finance-month-close-summary"><span><b>Fechamento do mês</b><small>${cap(ymLabel(ym))} · revisão por competência</small></span><span
      class="finance-close-summary-hint">Detalhes${icon('chevDown', 14)}</span></summary>
    <p class="small muted">Compras no cartão entram no mês da compra; o pagamento da fatura é uma transferência.</p>
    <dl class="finance-close-stats">
      <div><dt>Resultado do mês</dt><dd
        class="${close.resultCents < 0 ? 'is-negative' : ''}">${money(close.resultCents)}</dd></div>
      <div><dt>Já recebido</dt><dd>${money(close.inPaid)}</dd></div>
      <div><dt>Já pago em contas</dt><dd>${money(close.outPaid)}</dd></div>
      <div><dt>Pendente em contas</dt><dd>${money(close.pendingInCents + close.pendingOutCents)}</dd><small>${money(close.pendingInCents)} a receber · ${money(close.pendingOutCents)} a pagar</small></div>
      <div><dt>Lançamentos fixos</dt><dd>${money(close.recurringCents)}</dd><small>${close.recurringCount} ${plural(close.recurringCount, 'lançamento', 'lançamentos')}</small></div>
      <div><dt>Compras no cartão</dt><dd>${money(close.cardOut)}</dd><small>Não reduz o saldo das contas.</small></div>
    </dl>
    <div class="finance-close-next">${
      close.topExpense
        ? h`<p><b>Maior categoria de despesa:</b> ${expenseTitle(close.topExpense[0])} · ${money(close.topExpense[1])}.</p>`
        : empty(
            'Nenhuma despesa neste mês',
            'Quando você lançar despesas, o fechamento mostra a maior categoria aqui.',
            '',
            'wallet',
          )
    }
      <div class="row"><button type="button" class="btn ghost sm" data-action="fin-go" data-t="lancamentos"
        data-f="pendentes" data-clear-fin-filters>Conferir pendências</button><button type="button" class="btn ghost sm"
        data-action="fin-go" data-t="relatorios" data-sub="comparar">Comparar meses</button></div>
    </div>
  </details>`;
}
function finRelatorioMensal(ym) {
  const F = S.finance,
    cur = ym === today().slice(0, 7);
  const items = budgetReport({
    transactions: F.tx,
    budgets: F.budgets,
    settings: S.settings.prefs.financeBudgetSettings,
    month: ym,
    previousMonth: shiftMonth(ym, -1),
    throughDay: cur ? Number(today().slice(8)) : null,
    accountForId: accById,
    formatMoney: brl,
    shiftMonth,
  });
  if (!items.length) return '';
  return h`<section class="card finance-month-report" aria-labelledby="finance-month-report-title"><div
    class="head"><div><p class="section-kicker">${cur ? 'Até hoje' : ymLabel(ym)}</p><h2
    id="finance-month-report-title">Relatório do mês</h2></div></div>
    <ul class="finance-report-list">${items.map(
      (item) => h`<li
      class="finance-report-item is-${item.tone}">${item.text}</li>`,
    )}</ul></section>`;
}
function finTagBreakdown(txs, kind) {
  const totals = new Map();
  txs
    .filter((tx) => tx.type === kind)
    .forEach((tx) => {
      extractFinanceTags(tx.desc).forEach((tag) => {
        totals.set(tag, (totals.get(tag) || 0) + tx.cents);
      });
    });
  const rows = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (!rows.length) return '';
  const max = Math.max(1, rows[0][1]);
  return h`<section class="card finance-tag-report"><h2>Por etiqueta (#tags)</h2><ul class="category-bars">${rows.map(
    ([tag, cents]) =>
      h`<li><span class="category-bar-icon" style="--category-tone:var(--accent)">${icon('tag', 15)}</span><span
        class="category-bar-copy"><span>#${tag}</span><span class="category-bar-track"><i
        style="width:${Math.round((cents / max) * 100)}%;--category-tone:var(--accent)"></i></span></span><b>${money(cents)}</b><small></small></li>`,
  )}</ul></section>`;
}
function finTopExpenses(st) {
  const top = st.tx
    .filter((t) => t.type === 'out')
    .sort((a, b) => b.cents - a.cents)
    .slice(0, 5);
  if (!top.length) return '';
  return h`<section class="card finance-top-expenses"><h2>Maiores despesas do mês</h2><ul
    class="list">${top.map((t) => finRow(t, { showDate: true }))}</ul></section>`;
}
function finCategoryTrend(txs, ym) {
  const span = Array.from({ length: 6 }, (_, i) => shiftMonth(ym, i - 5));
  const perMonth = span.map((m) => ({
    m,
    totals: new Map(byCategory(reportMonthStats(txs, m, accById, ui.repBasis).tx, 'out')),
  }));
  const overall = new Map();
  perMonth.forEach(({ totals }) =>
    totals.forEach((value, name) => overall.set(name, (overall.get(name) || 0) + value)),
  );
  const names = [...overall.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
  if (!names.length) return '';
  const category = names.includes(ui.repCat) ? ui.repCat : names[0];
  const values = perMonth.map(({ m, totals }) => ({ m, cents: totals.get(category) || 0 }));
  const max = Math.max(1, ...values.map((item) => item.cents));
  const average = Math.round(values.reduce((sum, item) => sum + item.cents, 0) / values.length);
  const meta = outMeta(category);
  return h`<section class="card finance-category-trend"><div class="head"><h2>Categoria mês a mês</h2></div>
    <label class="finance-report-account"><span class="sr">Escolher categoria</span><select
      data-change="rep-cat">${names.map(
        (name) => h`<option class="expense-name"
      value="${name}" ${name === category ? raw('selected') : ''}>${expenseTitle(name)}</option>`,
      )}</select></label>
    <ul class="category-bars">${values.map(
      (item) => h`<li><span
      class="category-bar-copy"><span>${MESES[Number(item.m.slice(5)) - 1]}</span><span class="category-bar-track"><i
      style="width:${Math.round((item.cents / max) * 100)}%;--category-tone:${meta.c}"></i></span></span><b>${money(item.cents)}</b></li>`,
    )}</ul>
    <p class="small muted">Média de ${money(average)} por mês nos últimos 6 meses.</p></section>`;
}
function forecastChartSvg(forecast, hidden) {
  if (hidden) {
    return h`<div class="finance-forecast-chart is-hidden" role="img"
      aria-label="Gráfico de projeção oculto no modo discreto"><p class="small muted">Gráfico oculto enquanto os valores estiverem escondidos.</p></div>`;
  }
  const points = forecast.points;
  if (!points.length) return '';
  const width = 600;
  const height = 156;
  const padX = 12;
  const padY = 16;
  const values = points.map((point) => point.balanceCents);
  const minVal = Math.min(...values, 0);
  const maxVal = Math.max(...values, 0);
  const span = Math.max(100, maxVal - minVal);
  const xFor = (index) => padX + (index / Math.max(1, points.length - 1)) * (width - padX * 2);
  const yFor = (cents) => height - padY - ((cents - minVal) / span) * (height - padY * 2);
  const coords = points.map((point, index) => [xFor(index), yFor(point.balanceCents)]);
  const line = coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const baseY = yFor(0);
  const area = `${coords[0][0].toFixed(1)},${baseY.toFixed(1)} ${line} ${coords[coords.length - 1][0].toFixed(1)},${baseY.toFixed(1)}`;
  const lowIndex = points.findIndex((point) => point.date === forecast.lowestPoint.date);
  const lowCoord = lowIndex >= 0 ? coords[lowIndex] : null;
  const dipsNegative = forecast.lowestPoint.balanceCents < 0;
  const midPoint = points[Math.floor(points.length / 2)];
  const summary = `Projeção de ${forecast.horizonDays} dias: saldo inicial ${brl(forecast.startBalanceCents)}, saldo final previsto ${brl(forecast.endBalanceCents)}, menor saldo ${brl(forecast.lowestPoint.balanceCents)} em ${shortDate(forecast.lowestPoint.date)}.`;
  return h`<div class="finance-forecast-chart">
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="${summary}">
      ${
        minVal < 0 && maxVal > 0
          ? raw(
              `<line class="forecast-zero-line" x1="${padX}" y1="${baseY.toFixed(1)}" x2="${width - padX}" y2="${baseY.toFixed(1)}" />`,
            )
          : ''
      }
      ${raw(`<polygon class="forecast-area${dipsNegative ? ' is-warn' : ''}" points="${area}" />`)}
      ${raw(`<polyline class="forecast-line${dipsNegative ? ' is-warn' : ''}" points="${line}" />`)}
      ${
        lowCoord
          ? raw(
              `<circle class="forecast-low-dot${dipsNegative ? ' is-warn' : ''}" cx="${lowCoord[0].toFixed(1)}" cy="${lowCoord[1].toFixed(1)}" r="4.5"><title>Menor saldo: ${esc(brl(forecast.lowestPoint.balanceCents))} em ${esc(shortDate(forecast.lowestPoint.date))}</title></circle>`,
            )
          : ''
      }
    </svg>
    <div class="finance-forecast-axis" aria-hidden="true">
      <span>Hoje (${shortDate(forecast.asOfDate)})</span>
      <span>${midPoint ? shortDate(midPoint.date) : ''}</span>
      <span>${shortDate(forecast.endDate)}</span>
    </div>
  </div>`;
}
function finCashflowForecast() {
  const F = S.finance;
  const now = today();
  const horizonDays = FORECAST_HORIZONS.includes(ui.finForecastDays) ? ui.finForecastDays : 30;
  const forecast = buildCashflowForecast({
    accounts: F.accounts,
    transactions: F.tx,
    recurring: F.recurring || [],
    asOfDate: now,
    horizonDays,
    shiftMonth,
    parseDate: pk,
    accountDisplayName,
  });
  const hidden = Boolean(ui.financeValuesHidden);
  const LIMIT = 12;
  const shownDays = ui.finForecastExpanded ? forecast.eventDays : forecast.eventDays.slice(0, LIMIT);
  return h`<section class="card finance-forecast" aria-labelledby="finance-forecast-title">
    <div class="head">
      <div>
        <p class="section-kicker">Fluxo futuro</p>
        <h2 id="finance-forecast-title">Projeção de saldo (${horizonDays} dias)</h2>
        <p class="small muted">De hoje (${shortDate(forecast.asOfDate)}) até ${shortDate(forecast.endDate)}.</p>
      </div>
      <div class="seg sm" role="group" aria-label="Horizonte da projeção">${FORECAST_HORIZONS.map(
        (days) => h`<button type="button" aria-pressed="${String(horizonDays === days)}"
          data-action="fin-forecast-days" data-v="${days}">${days} dias</button>`,
      )}</div>
    </div>
    ${
      forecast.firstNegativeDate
        ? h`<aside class="notice finance-forecast-alert is-warn" role="status">${icon('alert', 17)}<span>O saldo previsto fica negativo a partir de <b>${shortDate(forecast.firstNegativeDate)}</b>${hidden ? '.' : h` (menor ponto: <b>${money(forecast.lowestPoint.balanceCents)}</b> em ${shortDate(forecast.lowestPoint.date)}).`}</span></aside>`
        : forecast.eventDays.length
          ? h`<aside class="notice finance-forecast-alert is-ok" role="status">${icon('check', 17)}<span>Com os compromissos cadastrados, seu saldo se mantém positivo nos próximos ${horizonDays} dias.</span></aside>`
          : ''
    }
    <div class="finance-forecast-kpis">
      <div class="finance-forecast-kpi"><span>Saldo hoje</span><b class="${forecast.startBalanceCents < 0 ? 'fin-expense' : ''}">${money(forecast.startBalanceCents)}</b></div>
      <div class="finance-forecast-kpi"><span>Em ${horizonDays} dias</span><b class="${forecast.endBalanceCents < 0 ? 'fin-expense' : 'fin-income'}">${money(forecast.endBalanceCents)}</b></div>
      <div class="finance-forecast-kpi"><span>Entradas previstas</span><b class="fin-income">+${money(forecast.totalInCents)}</b></div>
      <div class="finance-forecast-kpi"><span>Saídas previstas</span><b class="fin-expense">−${money(forecast.totalOutCents)}</b></div>
    </div>
    ${forecastChartSvg(forecast, hidden)}
    <p class="small muted finance-forecast-low">Menor saldo previsto no período: <b class="${forecast.lowestPoint.balanceCents < 0 ? 'fin-expense' : ''}">${money(forecast.lowestPoint.balanceCents)}</b> em ${forecast.lowestPoint.date === now ? 'hoje' : shortDate(forecast.lowestPoint.date)}.</p>
  </section>
  <section class="card finance-forecast-timeline" aria-labelledby="finance-forecast-timeline-title">
    <div class="head">
      <div>
        <h3 id="finance-forecast-timeline-title">Linha do tempo prevista</h3>
        <p class="small muted">${
          forecast.eventDays.length
            ? `${forecast.eventDays.length} ${plural(forecast.eventDays.length, 'dia com movimentação prevista', 'dias com movimentações previstas')}.`
            : `Nenhuma conta pendente, fatura ou lançamento fixo previsto nos próximos ${horizonDays} dias.`
        }</p>
      </div>
    </div>
    ${
      shownDays.length
        ? h`<ol class="finance-forecast-days">${shownDays.map(
            (entry) => h`<li class="finance-forecast-day${entry.balanceCents < 0 ? ' is-negative' : ''}">
              <div class="finance-forecast-day-head">
                <b>${entry.date === now ? `Hoje · ${shortDate(entry.date)}` : shortDate(entry.date)}</b>
                <span class="finance-forecast-day-balance">Saldo: <b class="${entry.balanceCents < 0 ? 'fin-expense' : ''}">${money(entry.balanceCents)}</b></span>
              </div>
              <ul class="finance-forecast-day-items">${entry.items.map(
                (item) => h`<li>
                  <span class="grow">
                    <span class="ttl ${item.deltaCents < 0 ? 'expense-name' : ''}">${item.label}</span>
                    <small class="small muted">${item.overdue ? h`<span class="m-warn">Atrasado (${shortDate(item.originalDate)})</span>${item.detail ? ` · ${item.detail}` : ''}` : item.detail}</small>
                  </span>
                  <b class="amt ${item.deltaCents >= 0 ? 'in' : 'out'}">${item.deltaCents >= 0 ? '+' : '−'}${money(Math.abs(item.deltaCents))}</b>
                </li>`,
              )}</ul>
            </li>`,
          )}</ol>${
            forecast.eventDays.length > LIMIT
              ? h`<button type="button" class="btn sm ghost" data-action="fin-forecast-more">${ui.finForecastExpanded ? 'Mostrar menos dias' : `Ver todos os ${forecast.eventDays.length} dias`}</button>`
              : ''
          }`
        : areaEmpty(
            'Sem movimentações futuras no período.',
            'Cadastre lançamentos fixos, parcelas ou contas pendentes para acompanhar sua projeção de caixa aqui.',
            h`<button type="button" class="btn primary" data-action="fin-go" data-t="planejamento"
              data-sub="compromissos">Gerenciar fixos e parcelas</button>`,
            'trendUp',
            'h4',
          )
    }
    <p class="fine muted">Considera contas pendentes, parcelas, faturas de cartão e lançamentos fixos ativos. Novas compras à vista ou no cartão entram assim que forem registradas.</p>
  </section>`;
}
function finRel() {
  const ym = ui.finMonth,
    kind = ui.repKind;
  const active = FIN_REPORT_TABS.some(([id]) => id === ui.finReportTab) ? ui.finReportTab : 'resumo';
  const reportTx =
    ui.repAcc && accById(ui.repAcc)
      ? S.finance.tx.filter((t) => t.accountId === ui.repAcc || t.toAccountId === ui.repAcc)
      : S.finance.tx;
  const st = reportMonthStats(reportTx, ym, accById, ui.repBasis);
  const list = byCategory(st.tx, kind),
    total = list.reduce((s, [, v]) => s + v, 0);
  const col = (n) => (kind === 'out' ? outMeta(n).c : catMeta({ type: 'in', category: n }).c);
  const months = Array.from({ length: 6 }, (_, i) => {
    const m = shiftMonth(ym, i - 5),
      s = reportMonthStats(reportTx, m, accById, ui.repBasis);
    return { l: MESES[Number(m.slice(5)) - 1], i: s.inAll, o: s.outAll };
  });
  const avgOut = Math.round(months.reduce((s, m) => s + m.o, 0) / 6);
  const monthTransactions = monthStats(ym);
  let content;
  if (active === 'projecao') {
    content = finCashflowForecast();
  } else if (active === 'categorias') {
    content = h`<section class="card finance-report-categories">
      <div class="finance-report-controls">
        <div class="seg" role="group" aria-label="Período do relatório"><button type="button"
          aria-pressed="${ui.repBasis === 'competence'}" data-action="rep-basis"
          data-b="competence">Competência</button><button type="button" aria-pressed="${ui.repBasis === 'cash'}"
          data-action="rep-basis" data-b="cash">Caixa</button></div>
        <div class="seg" role="group" aria-label="Tipo"><button type="button" aria-pressed="${kind === 'out'}"
          data-action="rep-kind" data-k="out">Despesas</button><button type="button" aria-pressed="${kind === 'in'}"
          data-action="rep-kind" data-k="in">Receitas</button></div>
        <label class="finance-report-account"><span class="sr">Filtrar relatório por conta</span><select
          data-change="rep-acc"><option value="">Todas as contas</option>${S.finance.accounts.map(
            (a) => h`<option
          class="user-value"
          value="${a.id}" ${ui.repAcc === a.id ? raw('selected') : ''}>${accountOptionLabel(a)}</option>`,
          )}</select></label>
      </div>
      <p class="fine">${
        ui.repBasis === 'cash'
          ? 'Por data de pagamento ou recebimento. Pagamentos de fatura entram como saída no dia em que foram registrados; lançamentos antigos sem data de liquidação usam a data do lançamento.'
          : 'Por data em que a receita ou despesa aconteceu. Compras no cartão aparecem neste mês, independentemente do pagamento da fatura.'
      }</p>
      ${
        list.length
          ? h`<div class="finance-report-donut-layout"><div class="donut-row"><div class="donut-w">${donut(
              list.map(([n, v]) => ({ v, c: col(n) })),
              total,
              (kind === 'out' ? 'Despesas' : 'Receitas') + ' do mês por categoria',
            )}<div class="dc"><b>${money(total)}</b><span>${kind === 'out' ? 'gastos' : 'recebidos'}</span></div></div></div>
        <ul class="list">${list.map(
          ([n, v]) => h`<li><span class="sw" style="background:${col(n)}"></span><span
          class="grow ttl ${kind === 'out' ? 'expense-name' : ''}">${kind === 'out' ? expenseTitle(n) : n}</span><span
          class="small muted">${Math.round((v / total) * 100)}%</span><b>${money(v)}</b></li>`,
        )}</ul></div>`
          : areaEmpty(
              kind === 'out' ? 'Nenhuma despesa neste mês.' : 'Nenhuma receita neste mês.',
              'Quando houver lançamentos, este relatório mostrará a divisão por categoria.',
              h`<button type="button" class="btn primary"
                data-action="${kind === 'out' ? 'tx-new' : 'tx-new-in'}">${icon('plus', 16)}${kind === 'out' ? 'Criar despesa' : 'Criar receita'}</button>`,
              kind === 'out' ? 'pie' : 'wallet',
              'h3',
            )
      }</section>
      ${finTagBreakdown(st.tx, kind)}
      ${finTopExpenses(st)}
      ${finCategoryTrend(reportTx, ym)}`;
  } else if (active === 'comparar') {
    content = finCompare();
  } else {
    content = h`${finRelatorioMensal(ym)}
      ${finRitmo(ym, monthTransactions, ym === today().slice(0, 7))}
      ${finMonthClose(ym)}
      ${monthlyFlowChart(ym, avgOut)}`;
  }
  return h`${active !== 'comparar' && active !== 'projecao' ? monthNav() : ''}${finReportPicker()}<div id="fin-report-panel" role="tabpanel"
    aria-labelledby="fin-report-tab-${active}">${content}</div>`;
}

export function viewFinancas() {
  return renderFinanceView({
    S,
    ui,
    gate,
    areaPageTitle,
    financePrivacyNotice,
    finSectionPicker,
    panels: {
      resumo: finResumo,
      lancamentos: finLanc,
      contas: finContasCartoes,
      planejamento: finPlanejamento,
      relatorios: finRel,
    },
  });
}
