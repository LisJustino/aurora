import { h } from '../../utils/dom.js';
import { icon } from '../../utils/icons.js';
import { emptyState } from '../../utils/empty-state.js';

export function financePrivacyNotice() {
  return h`<aside class="notice finance-privacy-note" role="note"><span>Sem conexão bancária. <a href="/privacy.html"
    data-legal-document="privacy" target="_blank" rel="noopener noreferrer">Saiba mais</a></span></aside>`;
}

export function renderFinanceView({ S, ui, gate, areaPageTitle, financePrivacyNotice, finSectionPicker, panels }) {
  const accessNotice = gate('finances', 'Finanças');
  if (accessNotice) {
    return h`${areaPageTitle('financas', 'Finanças')}${financePrivacyNotice()}${accessNotice}`;
  }
  const panel = panels[ui.finTab] || panels.resumo;
  const isOverview = ui.finTab === 'resumo' || !panels[ui.finTab];
  const noAccounts = !S.finance.accounts.length;
  const visibilityAction = h`<button type="button" class="ibtn finance-visibility-toggle"
    data-action="finance-values-toggle" aria-pressed="${String(ui.financeValuesHidden)}"
    aria-label="${ui.financeValuesHidden ? 'Mostrar valores financeiros' : 'Ocultar valores financeiros'}"
    title="${ui.financeValuesHidden ? 'Mostrar valores' : 'Ocultar valores'}">${icon(ui.financeValuesHidden ? 'eyeOff' : 'eye', 18)}</button>`;
  const createAction = h`<span class="finance-page-actions">${visibilityAction}</span>`;
  const emptyAccounts = h`<section class="surface-open">${emptyState({
    title: 'Nenhuma conta ainda.',
    description: 'Crie uma conta e comece a registrar seus movimentos.',
    action: h`<button type="button" class="btn primary"
      data-action="acct-new">${icon('plus', 18)}Criar primeira conta</button>`,
    iconName: 'wallet',
    headingLevel: 'h3',
  })}</section>`;
  return h`${areaPageTitle('financas', 'Finanças', createAction)}${isOverview ? financePrivacyNotice() : ''}
    <div class="fin-section-content">${finSectionPicker()}<div id="fin-panel" role="tabpanel"
      aria-labelledby="fin-tab-${ui.finTab}">${noAccounts && ui.finTab !== 'contas' ? emptyAccounts : panel()}</div></div>`;
}
