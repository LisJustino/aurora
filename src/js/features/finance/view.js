import { h } from '../../utils/dom.js';
import { icon } from '../../utils/icons.js';

export function financePrivacyNotice() {
  return h`<aside class="notice finance-privacy-note" role="note"><span>Sem conexão bancária. <a href="/privacy.html" data-legal-document="privacy" target="_blank" rel="noopener noreferrer">Saiba mais</a></span></aside>`;
}

export function renderFinanceView({
  S,
  ui,
  gate,
  areaPageTitle,
  empty,
  financePrivacyNotice,
  finSectionPicker,
  panels,
  fab,
}) {
  const accessNotice = gate('finances', 'Finanças');
  if (accessNotice) {
    return h`${areaPageTitle('financas', 'Finanças')}${financePrivacyNotice()}${accessNotice}`;
  }
  const panel = panels[ui.finTab] || panels.resumo;
  const noAccounts = !S.finance.accounts.length;
  const visibilityAction = h`<button type="button" class="ibtn finance-visibility-toggle" data-action="finance-values-toggle" aria-pressed="${String(ui.financeValuesHidden)}" aria-label="${ui.financeValuesHidden ? 'Mostrar valores financeiros' : 'Ocultar valores financeiros'}" title="${ui.financeValuesHidden ? 'Mostrar valores' : 'Ocultar valores'}">${icon(ui.financeValuesHidden ? 'eyeOff' : 'eye', 18)}</button>`;
  const createAction = h`<span class="finance-page-actions">${visibilityAction}${noAccounts ? '' : h`<button type="button" class="btn primary finance-page-action" data-action="tx-new">${icon('plus', 18)}Novo lançamento</button>${fab()}`}</span>`;
  const emptyAccounts = h`<section class="card">${empty('Comece por uma conta', 'Cadastre uma conta corrente, poupança ou investimento. Depois, receitas e despesas aparecem no resumo.', h`<button class="btn primary" data-action="acct-new">${icon('plus', 18)}Criar primeira conta</button>`, 'wallet')}</section>`;
  return h`${areaPageTitle('financas', 'Finanças', createAction)}${financePrivacyNotice()}
    <div class="fin-section-content">${finSectionPicker()}<div id="fin-panel" role="tabpanel" aria-labelledby="fin-tab-${ui.finTab}">${noAccounts ? (ui.finTab === 'cartoes' ? panels.cartoes() : emptyAccounts) : panel()}</div></div>`;
}
