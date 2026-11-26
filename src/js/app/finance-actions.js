// Registra as ações e os formulários de Finanças, agrupados por assunto.
import { registerFinanceNavigationActions } from './finance-actions-navigation.js';
import { registerFinanceTransactionActions } from './finance-actions-transactions.js';
import { registerFinanceAccountActions } from './finance-actions-accounts.js';
import { registerFinanceBudgetActions } from './finance-actions-budgets.js';
import { registerFinanceForms } from './finance-forms.js';

export function registerFinanceActions() {
  registerFinanceNavigationActions();
  registerFinanceTransactionActions();
  registerFinanceAccountActions();
  registerFinanceBudgetActions();
  registerFinanceForms();
}
