import { h } from '../../utils/dom.js';
import { DIAS, longDate, pk } from '../../utils/dates.js';
import { icon } from '../../utils/icons.js';
import { emptyState } from '../../utils/empty-state.js';
import { expenseWeekTotals } from './calculations.js';

export function financePrivacyNotice() {
  return h`<aside class="notice finance-privacy-note" role="note"><span>Sem conexão bancária. <a href="/privacy.html" data-legal-document="privacy" target="_blank" rel="noopener noreferrer">Saiba mais</a></span></aside>`;
}

export function renderFinanceView({
  S,
  ui,
  gate,
  areaPageTitle,
  financePrivacyNotice,
  finSectionPicker,
  weekStartDay,
  formatMoney,
  today,
  panels,
}) {
  const accessNotice = gate('finances', 'Finanças');
  if (accessNotice) {
    return h`${areaPageTitle('financas', 'Finanças')}${financePrivacyNotice()}${accessNotice}`;
  }
  const panel = panels[ui.finTab] || panels.resumo;
  const noAccounts = !S.finance.accounts.length;
  const expenseWeek = expenseWeekTotals(S.finance.tx, today(), weekStartDay());
  const maxExpense = Math.max(0, ...expenseWeek.map(({ cents }) => cents));
  const expenseSummary = expenseWeek.filter(({ cents }) => cents > 0).length
    ? `Despesas desta semana: ${expenseWeek.map(({ cents }) => formatMoney(cents)).join(', ')}.`
    : 'Despesas: nenhum lançamento nesta semana.';
  const expenseWeekChart = h`<section class="card finance-week-chart" aria-labelledby="finance-week-chart-title">
    <div><h2 id="finance-week-chart-title">Despesas desta semana</h2></div>
    <div class="finance-week-chart-grid">${expenseWeek.map(({ day, cents }) => {
      const percentage = maxExpense ? Math.round(cents / maxExpense * 100) : 0;
      return h`<div class="finance-week-chart-column">
        <div class="finance-week-chart-bar${day === today() ? ' is-today' : ''}" role="img" aria-label="${longDate(day)}: ${formatMoney(cents)} em despesas">
          <span style="--week-fill:${percentage}%"></span>
        </div>
        <span class="finance-week-chart-day" aria-hidden="true">${DIAS[pk(day).getDay()]}</span>
      </div>`;
    })}</div>
    <span class="sr">${expenseSummary}</span>
  </section>`;
  const visibilityAction = h`<button type="button" class="ibtn finance-visibility-toggle" data-action="finance-values-toggle" aria-pressed="${String(ui.financeValuesHidden)}" aria-label="${ui.financeValuesHidden ? 'Mostrar valores financeiros' : 'Ocultar valores financeiros'}" title="${ui.financeValuesHidden ? 'Mostrar valores' : 'Ocultar valores'}">${icon(ui.financeValuesHidden ? 'eyeOff' : 'eye', 18)}</button>`;
  const createAction = h`<span class="finance-page-actions">${visibilityAction}</span>`;
  const emptyAccounts = h`<section class="card">${emptyState({
    title: 'Nenhuma conta ainda.',
    description: 'Comece com uma conta e registre seus movimentos no seu ritmo.',
    action: h`<button type="button" class="btn primary" data-action="acct-new">${icon('plus', 18)}Criar primeira conta</button>`,
    iconName: 'wallet',
    headingLevel: 'h3',
  })}</section>`;
  return h`${areaPageTitle('financas', 'Finanças', createAction)}${financePrivacyNotice()}${expenseWeekChart}
    <div class="fin-section-content">${finSectionPicker()}<div id="fin-panel" role="tabpanel" aria-labelledby="fin-tab-${ui.finTab}">${noAccounts ? (ui.finTab === 'cartoes' ? panels.cartoes() : emptyAccounts) : panel()}</div></div>`;
}
