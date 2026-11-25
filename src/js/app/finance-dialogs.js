import { $, h, raw } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { formatMoneyInput, parseMoney } from '../utils/currency.js';
import { addMonths, longDate, MESES, shortDate, today } from '../utils/dates.js';
import { newId } from '../utils/ids.js';
import {
  buildBulkRecords,
  bulkRowInstallmentCents,
  findBulkAccount,
  parseBulkText,
  resolveBulkCategory,
} from '../features/finance/bulk-entry.js';
import { installmentSummary as summarizeInstallments } from '../features/finance/calculations.js';
import { ACCOUNT_TYPES } from '../features/finance/accounts.js';
import { BUDGET_ALERT_OPTIONS, budgetHistory, suggestBudgetCents } from '../features/finance/budget-insights.js';
import {
  bankFieldValue,
  BANKS,
  CAT_ICONS,
  CATEGORY_ICON_LABELS,
  categoryLeafName,
  findBankByName,
  LIST_COLORS,
  norm,
  OTHER_BANK,
  plural,
} from './core.js';
import { closeBtn, dlgField, dlgOpen, dlgWrap } from './dialogs.js';
import { genRecurring, guessCategory, recList } from './finance-extras.js';
import {
  ACC_ICON,
  accBalance,
  accById,
  accountDisplayName,
  accountOptionLabel,
  catChip,
  isCredit,
  isPaid,
  shiftMonth,
} from './finance-view.js';
import { addItem, DLG } from './onboarding.js';
import { commit } from './persistence.js';
import { render } from './render.js';
import { toast } from './samples-backup.js';
import { areaEmpty, brl, expenseTitle, fieldError, money } from './shell.js';
import { categoryEntries, catInfo, catNames, financeDialogViews, S, topCategoryNames, ui } from './state.js';

// Diálogos de Finanças
export const moneyIn = (c) => (c ? (c / 100).toFixed(2).replace('.', ',') : '');
export function anticipationCandidates(groupId, fromDate = today()) {
  const group = S.finance.tx.filter((transaction) => transaction.groupId === groupId && transaction.type === 'out');
  const accountId = group[0]?.accountId;
  const credit = isCredit(accById(accountId));
  return group
    .filter(
      (transaction) =>
        transaction.accountId === accountId &&
        transaction.date >= today() &&
        transaction.date >= fromDate &&
        !transaction.anticipatedDate &&
        (credit || !isPaid(transaction)),
    )
    .sort((a, b) => a.date.localeCompare(b.date));
}
export function reviewBulkEntry() {
  const d = ui.dlg.d,
    accounts = S.finance.accounts,
    defaultAccount = accById(d.accountId);
  if (!defaultAccount) return toast('Escolha uma conta.', 'info');
  const parsed = parseBulkText(d.text, { today: today() });
  if (!parsed.length) return fieldError('Escreva ao menos um lançamento.', '[data-dlg="text"]');
  const categories = { out: categoryEntries('out'), in: categoryEntries('in') };
  const seen = new Set();
  d.rows = parsed.map((row) => {
    if (row.error) return row;
    const account = row.accountText ? findBulkAccount(accounts, row.accountText, accountDisplayName) : defaultAccount;
    const fail = (error) => ({ line: row.line, source: row.source, error });
    if (!account) return fail(`Não encontrei a conta "${row.accountText}".`);
    if (row.kind === 'in' && isCredit(account)) return fail('Uma receita não pode ir para um cartão de crédito.');
    const resolved = resolveBulkCategory(row, {
      categories,
      leafName: categoryLeafName,
      fallback: (item) => guessCategory(item.name, item.kind),
    });
    if (resolved.error) return fail(resolved.error);
    const nameKey = norm(row.name),
      installment = bulkRowInstallmentCents(row);
    const key = `${row.kind}|${row.repeat}|${nameKey}|${installment}|${row.date}|${account.id}`;
    const dup =
      seen.has(key) ||
      (row.repeat === 'fixed'
        ? recList().some(
            (item) =>
              item.type === row.kind &&
              item.cents === row.amountCents &&
              norm(item.desc || '') === nameKey &&
              item.day === Number(row.date.slice(8, 10)),
          )
        : S.finance.tx.some(
            (item) =>
              item.type === row.kind &&
              item.cents === installment &&
              item.date === row.date &&
              norm(String(item.desc || '').replace(/\s*\(\d+\/\d+\)$/, '')) === nameKey,
          ));
    seen.add(key);
    return {
      ...row,
      accountId: account.id,
      categoryPath: resolved.path,
      parent: resolved.parent,
      child: resolved.child,
      createParent: resolved.createParent,
      createChild: resolved.createChild,
      dup,
      on: !dup,
    };
  });
  d.step = 'review';
  render();
}
export function applyBulkEntry() {
  const d = ui.dlg?.type === 'txbulk' ? ui.dlg.d : null;
  const chosen = (d?.rows || []).filter((row) => !row.error && row.on);
  if (!chosen.length) return toast('Marque ao menos um lançamento.', 'info');
  const recIds = new Set(),
    txIds = new Set(),
    now = Date.now();
  let categoriesChanged = false;
  chosen.forEach((row, index) => {
    const account = accById(row.accountId);
    if (!account) return;
    let category = row.categoryPath;
    if (row.createParent || row.createChild) {
      const parentPath = addItem(row.kind, row.parent);
      category = row.child ? addItem(row.kind, row.child, parentPath) : parentPath;
      categoriesChanged = true;
    }
    category ||= catNames(row.kind)[0] || 'Outros';
    const { transactions, recurring } = buildBulkRecords(row, {
      newId,
      addMonths,
      account,
      isCredit,
      today: today(),
      category,
      now: now + index * 1000,
    });
    transactions.forEach((transaction) => {
      S.finance.tx.push(transaction);
      txIds.add(transaction.id);
    });
    if (recurring) {
      recList().push(recurring);
      recIds.add(recurring.id);
    }
  });
  genRecurring();
  const total = txIds.size + S.finance.tx.filter((transaction) => recIds.has(transaction.recId)).length;
  ui.finMonth = chosen
    .map((row) => row.date)
    .sort()[0]
    .slice(0, 7);
  ui.dlg = null;
  commit(...(categoriesChanged ? ['finance', 'settings'] : ['finance']));
  toast(
    total === chosen.length
      ? `${chosen.length} ${plural(chosen.length, 'lançamento cadastrado', 'lançamentos cadastrados')}.`
      : `${chosen.length} ${plural(chosen.length, 'lançamento cadastrado', 'lançamentos cadastrados')}, ${total} contando parcelas e meses das fixas.`,
    'action',
    () => {
      S.finance.tx = S.finance.tx.filter((transaction) => !txIds.has(transaction.id) && !recIds.has(transaction.recId));
      S.finance.recurring = recList().filter((item) => !recIds.has(item.id));
      commit('finance');
    },
  );
}
export function newTxDlg(kind = 'out', preferCredit = false, repeat = 'none') {
  const accs = S.finance.accounts;
  const defaults = recentTransactionDefaults(kind, preferCredit);
  const first =
    accs.find((account) => account.id === defaults.accountId) ||
    (preferCredit ? accs.find(isCredit) : null) ||
    accs.find((account) => !isCredit(account)) ||
    accs[0];
  const second =
    accs.find((account) => account.id === defaults.toAccountId && account.id !== first?.id) ||
    accs.find((account) => account.id !== first?.id);
  dlgOpen('tx', {
    kind,
    amount: '',
    desc: '',
    category: defaults.category,
    categoryTouched: false,
    accountId: first ? first.id : '',
    toAccountId: second?.id || '',
    date: today(),
    settledDate: today(),
    paid: true,
    interest: '0,00',
    repeat,
    currentInstallment: '1',
    installmentAmountMode: 'total',
    times: '2',
  });
}
export function prepareTransactionDialogForAnother(d, category) {
  Object.assign(d, {
    amount: '',
    desc: '',
    category,
    interest: '0,00',
    repeat: 'none',
    currentInstallment: '1',
    installmentAmountMode: 'total',
    times: '2',
  });
  delete d.continueAfterSave;
  if (ui.dlg) ui.dlg.dirty = false;
  requestAnimationFrame(() => $('#dlg input[data-dlg="amount"]')?.focus());
}
export function recentTransactionDefaults(kind, preferCredit = false) {
  const categoryType = kind === 'in' ? 'in' : 'out';
  const categories = catNames(categoryType);
  const accountAllowed = (account) => account && (kind === 'tr' || kind === 'in' ? !isCredit(account) : true);
  const latest = S.finance.tx
    .map((transaction, index) => ({ transaction, index }))
    .filter(({ transaction }) => transaction.type === kind)
    .sort((a, b) => Number(b.transaction.createdAt || 0) - Number(a.transaction.createdAt || 0) || b.index - a.index)
    .map(({ transaction }) => transaction);
  const recent = latest.find((transaction) => {
    const account = S.finance.accounts.find((item) => item.id === transaction.accountId);
    return (
      accountAllowed(account) &&
      (kind === 'tr'
        ? S.finance.accounts.some((item) => item.id === transaction.toAccountId && item.id !== account.id)
        : categories.includes(transaction.category))
    );
  });
  const preferredCredit = preferCredit
    ? latest.find((transaction) => {
        const account = S.finance.accounts.find((item) => item.id === transaction.accountId);
        return isCredit(account) && categories.includes(transaction.category);
      })
    : null;
  return {
    accountId: (preferredCredit || recent)?.accountId || '',
    category: (preferredCredit || recent)?.category || categories[0],
    toAccountId: kind === 'tr' ? recent?.toAccountId || '' : '',
  };
}
export function dlgTx() {
  return financeDialogViews.transaction();
}
function dlgTxBulk() {
  return financeDialogViews.bulk();
}
function dlgCategoryManager() {
  const renderCategoryNode = (kind, category) => {
    const subcategories = Array.isArray(category.subcategories) ? category.subcategories : [];
    const editButton = (name, parent = '') =>
      h`<button type="button" class="ibtn category-manager-edit" data-action="category-edit" data-kind="${kind}"
        data-name="${name}" data-parent="${parent}"
        aria-label="Personalizar categoria ${name}">${icon('pencil', 16)}</button>`;
    return h`<li class="category-manager-item">
      ${catChip(catInfo(kind, category.name))}
      <span class="grow ttl">${kind === 'out' ? expenseTitle(category.name) : category.name}</span>
      ${
        subcategories.length
          ? h`<span
        class="muted small">${subcategories.length} subcategoria${subcategories.length > 1 ? 's' : ''}</span>`
          : ''
      }
      ${editButton(category.name)}
    </li>${
      subcategories.length
        ? h`<li class="category-manager-sublist"><ul
      class="list category-manager-list category-manager-subcategories">${subcategories.map(
        (subcategory) => h`<li>${catChip(catInfo(kind, `${category.name} > ${categoryLeafName(subcategory)}`))}<span
      class="grow ttl">${kind === 'out' ? expenseTitle(`${category.name} > ${categoryLeafName(subcategory)}`) : `${category.name} > ${categoryLeafName(subcategory)}`}</span>${editButton(categoryLeafName(subcategory), category.name)}</li>`,
      )}</ul></li>`
        : ''
    }`;
  };
  const categoryGroup = (kind, label) => h`<section class="category-manager-group">
    <div class="head"><h3>${label}</h3><button type="button" class="btn sm" data-action="category-new"
      data-kind="${kind}">${icon('plus', 16)}Adicionar</button></div>
    <ul class="list category-manager-list">${categoryEntries(kind).map((category) => renderCategoryNode(kind, category))}</ul>
  </section>`;
  const ruleKind = ui.dlg.d.ruleKind === 'in' ? 'in' : 'out';
  const ruleCategories = catNames(ruleKind);
  const rules = S.settings.prefs.financeCategoryRules;
  return dlgWrap(
    h`<div class="head"><div><h2 id="dt">Gerenciar categorias</h2><p
      class="small muted">Organize as categorias usadas em lançamentos e limites. Você pode criar categorias principais e subcategorias.</p></div>${closeBtn}</div>
    ${categoryGroup('out', 'Despesas')}
    ${categoryGroup('in', 'Receitas')}
    <section class="category-manager-group finance-category-rules"><div class="head"><div><h3>Regras automáticas</h3><p
      class="small muted">Na importação e em novos lançamentos, uma frase da descrição pode sugerir uma categoria.</p></div></div>
      <form class="form finance-category-rule-form" data-form="finance-category-rule">
        <label class="f"><span>Tipo</span><select data-change="finance-rule-kind" aria-label="Tipo da regra"><option
          value="out" ${ruleKind === 'out' ? raw('selected') : ''}>Despesa</option><option
          value="in" ${ruleKind === 'in' ? raw('selected') : ''}>Receita</option></select></label>
        <label class="f"><span>Frase na descrição</span><input name="phrase" type="text" maxlength="80" required
          placeholder="Ex.: Café Central"></label>
        <label class="f"><span>Categoria</span><select name="category"
          required>${ruleCategories.map(
            (category) => h`<option
          value="${category}" ${category === ui.dlg.d.ruleCategory ? raw('selected') : ''}>${category}</option>`,
          )}</select></label>
        <button class="btn sm" type="submit">${icon('plus', 16)}Adicionar regra</button>
      </form>
      ${
        rules.length
          ? h`<ul class="finance-category-rule-list"
            aria-label="Regras configuradas">${rules.map(
              (
                rule,
              ) => h`<li><span><b>“${rule.phrase}”</b><small>${rule.kind === 'in' ? 'Receita' : 'Despesa'} · ${rule.category}</small></span><button
            type="button" class="ibtn" data-action="finance-category-rule-delete" data-id="${rule.id}"
            aria-label="Excluir regra para ${rule.phrase}">${icon('trash', 16)}</button></li>`,
            )}</ul>`
          : areaEmpty(
              'Nenhuma regra cadastrada.',
              'Você pode sugerir uma categoria para lançamentos que contenham uma frase específica.',
              h`<button type="button" class="btn primary"
                data-action="finance-category-rule-focus">${icon('plus', 16)}Adicionar primeira regra</button>`,
              'tag',
              'h4',
              'finance-category-rule-empty',
            )
      }
    </section>`,
    h`<button type="button" class="btn back" data-action="dlg-close">Fechar</button>`,
  );
}
function dlgCategoryNew() {
  const d = ui.dlg.d,
    kind = d.kind,
    editing = !!d.editName;
  const label = kind === 'in' ? 'receita' : 'despesa';
  const parents = topCategoryNames(kind);
  const parentName = parents.find((name) => name === d.parent);
  const title = editing ? 'Personalizar categoria' : parentName ? 'Nova subcategoria' : `Nova categoria de ${label}`;
  const description = editing
    ? 'A cor e o ícone também aparecem nos lançamentos.'
    : parentName
      ? `Ela ficará dentro de ${kind === 'out' ? expenseTitle(parentName) : parentName}.`
      : 'Escolha um nome, ícone e cor para identificar esta categoria nos lançamentos.';
  return dlgWrap(
    h`<div class="head"><div><h2 id="dt">${title}</h2><p class="small muted">${description}</p></div>${closeBtn}</div>
    <form id="dlgform" class="form category-form" data-form="dlg-category">
      ${
        !editing && parents.length
          ? h`<div class="category-parent-field f full"><label class="lbl"
        for="category-parent">Categoria principal</label><select id="category-parent" data-dlg="parent"><option
        value="">Nova categoria principal</option>${parents.map(
          (name) => h`<option
        value="${name}" ${d.parent === name ? raw('selected') : ''}>${kind === 'out' ? expenseTitle(name) : name}</option>`,
        )}</select><span
        class="category-form-help">Escolha uma categoria para criar uma subcategoria; deixe a opção inicial para criar uma categoria principal.</span></div>`
          : ''
      }
      ${dlgField(
        'Nome',
        h`<input id="f0" type="text" data-dlg="name" value="${d.name || ''}" maxlength="30"
        placeholder="${kind === 'in' ? 'Ex.: Venda de itens' : 'Ex.: Pets'}" required autocomplete="off">`,
        'full',
      )}
      <fieldset class="category-icon-field full"><legend>Ícone</legend><div class="category-icon-picker">
        ${CAT_ICONS.map(
          (name) => h`<label title="${CATEGORY_ICON_LABELS[name]}"><input type="radio"
          name="category-icon" data-dlg="icon" value="${name}"
          aria-label="${CATEGORY_ICON_LABELS[name]}" ${name === (d.icon || 'tag') ? raw('checked') : ''}><span
          aria-hidden="true">${icon(name, 19)}</span><i class="sr">${CATEGORY_ICON_LABELS[name]}</i></label>`,
        )}
      </div></fieldset>
      ${dlgField(
        'Cor',
        h`<input class="category-color-input" type="color" data-dlg="color"
        value="${d.color || LIST_COLORS[0]}" aria-label="Cor da categoria">`,
      )}
    </form>`,
    h`${
      d.fromTransaction
        ? h`<button type="button" class="btn back"
      data-action="dlg-close">Cancelar</button>`
        : h`<button type="button" class="btn back"
      data-action="category-manager">Voltar</button>`
    }<button type="submit" class="btn primary"
      form="dlgform">${editing ? 'Salvar' : 'Adicionar'}</button>`,
  );
}
function dlgAccount() {
  const d = ui.dlg.d,
    edit = !!d.id,
    card = d.type === 'credit';
  const types = Object.entries(ACCOUNT_TYPES).filter(([key]) => key !== 'credit');
  const paymentAccounts = S.finance.accounts.filter((account) => !isCredit(account));
  const typeDetails = {
    checking: 'Uso diário: pagar e receber.',
    savings: 'Dinheiro guardado e separado.',
    investment: 'Investimentos acompanhados junto ao saldo total.',
  };
  const bankValue = bankFieldValue(d.bank);
  const initialBank = findBankByName(bankValue, true);
  const selectedBank = findBankByName(bankValue);
  const showCustomBank = !selectedBank && Boolean(bankValue) && d.bank !== OTHER_BANK;
  return dlgWrap(
    h`<div class="head head-nowrap"><div><p class="dialog-eyebrow">${card ? 'Cartão de crédito' : 'Conta'}</p><h2
      id="dt">${edit ? (card ? 'Editar cartão' : 'Editar conta') : card ? 'Novo cartão' : 'Nova conta'}</h2></div>${closeBtn}</div>
    <form id="dlgform" class="form" data-form="dlg-account">
      ${
        card
          ? h`<section class="account-dialog-section full" aria-labelledby="account-card-identity-title">
        <h3 id="account-card-identity-title">Identificação</h3>
        ${dlgField(
          'Nome do cartão',
          h`<input id="f0" type="text" data-dlg="name" value="${d.name}" maxlength="40"
          required placeholder="Ex.: Nubank Platinum" autocomplete="off">`,
          'full',
        )}
        ${dlgField(
          'Banco ou instituição',
          h`<span class="bank-name-control"><select data-dlg="bankOption"
          aria-label="Banco ou instituição"><option
          value="" ${!bankValue ? raw('selected') : ''}>Selecione uma instituição</option>${Object.entries(BANKS).map(
            ([key, bank]) => h`<option
          value="${key}" ${selectedBank?.[0] === key ? raw('selected') : ''}>${bank.name}</option>`,
          )}<option
          value="${OTHER_BANK}" ${!selectedBank && bankValue ? raw('selected') : ''}>Outro / não listado</option></select><span
          class="bank-name-preview" data-bank-preview aria-hidden="true"><span class="bank-logo bank-preview-logo"
          data-bank-preview-logo ${initialBank ? '' : raw('hidden')}><img
          src="${initialBank ? initialBank[1].logo : ''}" alt=""></span><span
          data-bank-preview-fallback ${initialBank ? raw('hidden') : ''}>${catChip({ c: '#5fa68a', i: 'bank' })}</span></span></span><span
          class="bank-custom-entry" ${showCustomBank ? '' : raw('hidden')}><input type="text" data-dlg="bank"
          value="${showCustomBank ? bankValue : ''}" maxlength="40" placeholder="Digite o nome do banco"
          autocomplete="off" ${showCustomBank ? raw('required') : ''}></span>`,
          'full bank-name-field',
        )}
      </section>`
          : dlgField(
              'Nome da conta',
              h`<input id="f0" type="text" data-dlg="name" value="${d.name}" maxlength="40" required
                placeholder="Ex.: Nubank 1" autocomplete="off">`,
              'full',
            )
      }
      ${
        !card
          ? h`<fieldset class="f full account-type-field"><legend class="f-label">Tipo da conta</legend><p
        class="account-type-help">Contas correntes, poupanças e investimentos fazem parte do saldo total. Cartões são cadastrados separadamente.</p><div
        class="account-type-picker" role="radiogroup" aria-label="Tipo da conta">${types.map(
          ([key, label]) => h`<label
        class="account-type-choice"><input type="radio" name="account-type" data-dlg="type"
        value="${key}" ${key === d.type ? raw('checked') : ''}><span
        class="account-type-choice-icon">${catChip({ c: '#5fa68a', i: ACC_ICON[key] || 'bank' })}</span><span
        class="account-type-choice-copy"><b>${label}</b><small>${typeDetails[key]}</small></span><span
        class="account-type-choice-check"
        aria-hidden="true">${icon('check', 14)}</span></label>`,
        )}</div></fieldset>`
          : ''
      }
      ${
        !card
          ? dlgField(
              'Banco ou instituição',
              h`<span class="bank-name-control"><input type="text" data-dlg="bank"
        value="${bankValue}" maxlength="40" list="finance-bank-options" placeholder="Ex.: Nubank"
        autocomplete="off"><span class="bank-name-preview" data-bank-preview aria-hidden="true"><span
        class="bank-logo bank-preview-logo" data-bank-preview-logo ${initialBank ? '' : raw('hidden')}><img
        src="${initialBank ? initialBank[1].logo : ''}" alt=""></span><span
        data-bank-preview-fallback ${initialBank ? raw('hidden') : ''}>${catChip({ c: '#5fa68a', i: 'bank' })}</span></span></span><datalist
        id="finance-bank-options">${Object.values(BANKS).map(
          (bank) => h`<option
        value="${bank.name}"></option>`,
        )}</datalist><span
        class="small muted">O ícone aparece ao reconhecer o nome. Você também pode informar outra instituição.</span>`,
              'full bank-name-field',
            )
          : ''
      }
      ${
        !card
          ? h`<p
        class="small muted full">O Aurora não se conecta a bancos; as informações são registradas manualmente.</p>`
          : ''
      }
      ${
        card
          ? h`<section class="account-dialog-section full" aria-labelledby="account-card-payment-title">
        <h3 id="account-card-payment-title">Pagamento da fatura</h3>
        ${dlgField(
          'Conta usada para pagar',
          h`<select data-dlg="linkedAccountId"><option
          value="" ${d.linkedAccountId ? '' : raw('selected')}>Escolher ao pagar</option>${paymentAccounts.map(
            (account) => h`<option
          class="user-value"
          value="${account.id}" ${account.id === d.linkedAccountId ? raw('selected') : ''}>${accountOptionLabel(account)}</option>`,
          )}</select><span
          class="small muted">Você poderá confirmar outra conta antes de pagar.</span>`,
          'full',
        )}
      </section>`
          : ''
      }
      ${
        d.type === 'credit'
          ? h`<section class="account-dialog-section account-card-values full"
            aria-labelledby="account-card-values-title">
        <h3 id="account-card-values-title">Limite e datas</h3>
        ${dlgField(
          edit
            ? h`Dívida atual (<span class="money">R$</span>)`
            : h`Dívida inicial (<span
          class="money">R$</span>)`,
          h`<input type="text" class="money-input" inputmode="decimal" data-dlg="balance"
          value="${formatMoneyInput(d.balance)}" placeholder="0,00"><span
          class="small muted">Informe o total já usado no cartão, se houver.</span>`,
        )}
        ${dlgField(
          h`Limite total (<span class="money">R$</span>)`,
          h`<input type="text" class="money-input"
          inputmode="decimal" data-dlg="limit" value="${formatMoneyInput(d.limit)}" placeholder="0,00">`,
          '',
        )}
        ${dlgField(
          'Dia de fechamento',
          h`<input type="number" min="1" max="31" data-dlg="closing" value="${d.closing}"
          inputmode="numeric" placeholder="Ex.: 20">`,
        )}
        ${dlgField(
          'Dia de vencimento',
          h`<input type="number" min="1" max="31" data-dlg="due" value="${d.due}"
          inputmode="numeric" placeholder="Ex.: 27">`,
        )}
      </section>`
          : dlgField(
              edit ? h`Saldo atual (<span class="money">R$</span>)` : h`Saldo inicial (<span class="money">R$</span>)`,
              h`<input type="text" class="money-input" inputmode="decimal" data-dlg="balance"
                value="${formatMoneyInput(d.balance)}" placeholder="0,00">`,
            )
      }
    </form>`,
    h`${
      edit
        ? h`<button class="btn danger back" data-action="acct-del"
      aria-label="Excluir conta">${icon('trash', 18)}</button><button class="btn primary" type="submit"
      form="dlgform">Salvar</button>`
        : h`<button class="btn back" data-action="dlg-close">Cancelar</button><button
      class="btn primary" type="submit" form="dlgform">Salvar</button>`
    }`,
  );
}
function dlgAccountDelete() {
  const d = ui.dlg.d,
    a = accById(d.id);
  if (!a)
    return dlgWrap(
      h`<div class="head"><h2 id="dt">Conta não encontrada</h2>${closeBtn}</div><p
        class="small muted">A conta já não está disponível.</p>`,
      h`<button class="btn back" data-action="dlg-close">Fechar</button>`,
    );
  const txCount = S.finance.tx.filter((t) => t.accountId === a.id || t.toAccountId === a.id).length;
  const recurringCount = recList().filter((r) => r.accountId === a.id).length;
  return dlgWrap(
    h`<div class="head head-nowrap"><h2 id="dt">Excluir conta?</h2>${closeBtn}</div>
    <p class="small"><span
      class="user-value">${accountDisplayName(a)}</span>: a conta, ${txCount} ${plural(txCount, 'lançamento', 'lançamentos')} e ${recurringCount} ${plural(recurringCount, 'lançamento fixo', 'lançamentos fixos')} associados irão juntos para a lixeira.</p>
    <p class="notice warn"
      role="alert">Você poderá restaurar esses dados por 30 dias. Depois, serão removidos automaticamente.</p>`,
    h`<button class="btn back" data-action="dlg-close">Cancelar</button><button class="btn danger"
      data-action="acct-del-confirm">Mover para a lixeira</button>`,
  );
}
function dlgPermanentlyDeleteAccount() {
  return dlgWrap(
    h`<div class="head head-nowrap"><h2 id="dt">Excluir conta e dados permanentemente?</h2>${closeBtn}</div>
    <p class="small">Esta ação apagará sua conta e os dados associados. Não será possível recuperá-los. Um novo cadastro com este e-mail só poderá ser feito depois que a exclusão for confirmada.</p>
    <p class="notice warn" role="alert">Os arquivos de backup que você baixou não serão removidos automaticamente.</p>
    <form id="dlgform" class="form" data-form="account-delete">
      ${dlgField(
        'Digite EXCLUIR para confirmar',
        h`<input id="f0" type="text" name="deleteConfirmation"
        data-dlg="deleteConfirmation" maxlength="7" pattern="EXCLUIR" autocomplete="off" required>`,
        'full',
      )}
      <p class="notice warn full" data-account-delete-message role="alert" hidden></p>
    </form>`,
    h`<button type="button" class="btn back" data-action="dlg-close">Cancelar</button><button type="submit"
      class="btn danger" form="dlgform" data-account-delete-submit>Excluir conta e dados</button>`,
  );
}
function dlgBudget() {
  const d = ui.dlg.d;
  const history = budgetHistory(S.finance.tx, d.cat, ui.finMonth, 3, shiftMonth);
  const suggestion = suggestBudgetCents(history);
  const historyLine = history.some((entry) => entry.cents > 0)
    ? h`<p class="small muted budget-history">Últimos 3 meses: ${history.map((entry) => `${MESES[Number(entry.month.slice(5)) - 1]} ${money(entry.cents)}`).join(' · ')}</p>`
    : '';
  const suggestionLine = suggestion
    ? h`<p class="small budget-suggestion">Pela sua média, um limite de ${money(suggestion.cents)} seria realista. <button
      type="button" class="btn ghost sm" data-action="budget-use-suggestion"
      data-cents="${suggestion.cents}">Usar sugestão</button></p>`
    : '';
  const alertField = dlgField(
    'Avisar ao chegar em',
    h`<select data-dlg="alertPct">${BUDGET_ALERT_OPTIONS.map(
      (pct) => h`<option
      value="${pct}" ${String(pct) === String(d.alertPct) ? raw('selected') : ''}>${pct}% do limite</option>`,
    )}</select>`,
  );
  const pinnedField = h`<label class="row full form-choice-row"><input type="checkbox"
    data-dlg="pinned" ${d.pinned ? raw('checked') : ''}><span class="small"><b>Mostrar na Visão geral</b><br><span
    class="muted">Fixa este limite lá, mesmo longe do alerta.</span></span></label>`;
  return dlgWrap(
    h`<div class="head head-nowrap"><h2 id="dt">Limite de <span
      class="expense-name">${expenseTitle(d.cat)}</span></h2>${closeBtn}</div>
    <p class="small muted">Quanto você quer gastar por mês nesta categoria? O Aurora avisa quando chegar perto.</p>
    ${
      d.confirmClear
        ? h`<p class="notice warn"
      role="alert">O orçamento irá para a lixeira por 30 dias. Confirme para continuar.</p>`
        : ''
    }
    <form id="dlgform" class="form" data-form="dlg-budget">${dlgField(
      h`Limite mensal (<span
      class="money">R$</span>)`,
      h`<input id="f0" class="amt-in money-input" type="text" inputmode="decimal"
      data-dlg="limit" value="${formatMoneyInput(d.limit)}"
      placeholder="00,00">`,
      'full',
    )}${alertField}${pinnedField}</form>${historyLine}${suggestionLine}`,
    h`${
      d.confirmClear
        ? h`<button type="button" class="btn back"
      data-action="budget-clear-cancel">Cancelar remoção</button><button type="button" class="btn danger"
      data-action="budget-clear">Confirmar remoção</button>`
        : h`${
            d.limit
              ? h`<button type="button" class="btn back"
      data-action="budget-clear">Remover limite</button>`
              : h`<button type="button" class="btn back"
      data-action="dlg-close">Cancelar</button>`
          }<button class="btn primary" type="submit"
      form="dlgform">Salvar</button>`
    }`,
  );
}
function dlgGoal() {
  const d = ui.dlg.d;
  const linkedAccountIds = new Set(
    S.finance.goals.filter((goal) => goal.id !== d.id && goal.linkedAccountId).map((goal) => goal.linkedAccountId),
  );
  const linkedAccount = accById(d.linkedAccountId);
  return dlgWrap(
    h`<div class="head head-nowrap"><h2 id="dt">${d.id ? 'Editar objetivo' : 'Novo objetivo'}</h2>${closeBtn}</div>
    <form id="dlgform" class="form" data-form="dlg-goal" novalidate>
      ${dlgField(
        'Nome',
        h`<input id="f0" type="text" data-dlg="name" value="${d.name}" maxlength="50" required
        placeholder="Ex.: Viagem, reserva de emergência">`,
        'full',
      )}
      ${dlgField(
        h`Valor do objetivo (<span class="money">R$</span>)`,
        h`<input type="text" class="money-input"
        inputmode="decimal" data-dlg="target" value="${formatMoneyInput(d.target)}" placeholder="00,00" required>`,
      )}
      ${dlgField(
        h`Já guardado (<span class="money">R$</span>)`,
        h`<input type="text" class="money-input"
        inputmode="decimal" data-dlg="saved" value="${formatMoneyInput(d.saved)}"
        placeholder="00,00" ${d.linkedAccountId ? raw('disabled') : ''}>`,
      )}
      ${dlgField(
        'Acompanhar saldo da conta (opcional)',
        h`<select data-dlg="linkedAccountId"><option
        value="">Acompanhamento manual</option>${S.finance.accounts
          .filter((account) => !isCredit(account))
          .map(
            (account) => h`<option
        value="${account.id}" ${account.id === d.linkedAccountId ? raw('selected') : ''} ${linkedAccountIds.has(account.id) ? raw('disabled') : ''}>${accountOptionLabel(account)}${linkedAccountIds.has(account.id) ? ' · já vinculada a outro objetivo' : ''}</option>`,
          )}</select>`,
        'full',
      )}
      <p class="fine full">${
        d.linkedAccountId
          ? linkedAccount
            ? h`O saldo total de ${accountDisplayName(linkedAccount)} será usado como progresso e acompanhará os lançamentos dessa conta. Vincule uma conta dedicada a este objetivo.`
            : 'A conta vinculada não está disponível. Escolha outra conta ou volte ao acompanhamento manual.'
          : 'No modo manual, o valor guardado é editado aqui. Ao vincular uma conta, o saldo total dela passa a representar o progresso; não há movimentação automática.'
      }</p>
      ${dlgField('Prazo (opcional)', h`<input type="date" data-dlg="deadline" value="${d.deadline}">`, 'full')}
    </form>`,
    h`<button class="btn back" data-action="dlg-close">Cancelar</button><button class="btn primary" type="submit"
      form="dlgform">${d.id ? 'Salvar' : 'Criar objetivo'}</button>`,
  );
}
function dlgDeposit() {
  const d = ui.dlg.d,
    g = S.finance.goals.find((x) => x.id === d.id);
  return dlgWrap(
    h`<div class="head head-nowrap"><h2 id="dt">Guardar em <span
      class="user-value">${g ? g.name : 'objetivo'}</span></h2>${closeBtn}</div>
    <p class="small muted">Este valor atualiza apenas o acompanhamento do objetivo; não altera o saldo de uma conta nem cria um lançamento. Para retirar, informe um valor negativo.</p>
    <form id="dlgform" class="form" data-form="dlg-deposit" novalidate>${dlgField(
      h`Valor (<span
      class="money">R$</span>)`,
      h`<input id="f0" class="amt-in money-input" type="text" inputmode="decimal"
      data-dlg="amount" value="${formatMoneyInput(d.amount)}" placeholder="00,00" required>`,
      'full',
    )}</form>`,
    h`<button class="btn back" data-action="dlg-close">Cancelar</button><button class="btn primary" type="submit"
      form="dlgform">Confirmar</button>`,
  );
}
export function invoicePlanPreviewText(d) {
  const principalCents = parseMoney(d.amount),
    interestCents = parseMoney(d.interest || ''),
    times = Number(d.times);
  const totalCents = principalCents + interestCents * times;
  if (
    Number.isSafeInteger(principalCents) &&
    principalCents > 0 &&
    Number.isSafeInteger(interestCents) &&
    interestCents >= 0 &&
    Number.isInteger(times) &&
    times >= 2 &&
    times <= 60 &&
    Number.isSafeInteger(totalCents)
  ) {
    return `Principal em parcelas: ${brl(principalCents)}. Total programado com juros: ${brl(totalCents)}. A programação fica pendente e não reduz o saldo da conta até cada parcela ser marcada como paga.`;
  }
  return 'O principal será dividido em centavos pelas parcelas; os juros informados serão adicionados a cada uma. A programação fica pendente e não reduz o saldo da conta até cada parcela ser marcada como paga.';
}
function dlgPayInv() {
  const d = ui.dlg.d,
    card = accById(d.cardId),
    srcs = S.finance.accounts.filter((a) => !isCredit(a));
  const installments = d.mode === 'installments';
  return dlgWrap(
    h`<div class="head head-nowrap"><h2 id="dt">Pagar fatura</h2>${closeBtn}</div>
    <p class="small muted">${
      card
        ? h`<span
      class="user-value">${accountDisplayName(card)}</span>`
        : ''
    }: o pagamento sai da conta escolhida e reduz o valor em aberto do cartão.</p>
    <form id="dlgform" class="form" data-form="dlg-payinv">
      ${dlgField(
        'Forma de pagamento',
        h`<select data-dlg="mode"><option
        value="single" ${!installments ? raw('selected') : ''}>Pagamento único</option><option
        value="installments" ${installments ? raw('selected') : ''}>Parcelar fatura</option></select>`,
        'full',
      )}
      ${dlgField(
        h`${installments ? 'Valor da fatura a parcelar' : 'Valor'} (<span class="money">R$</span>)`,
        h`<input
        id="f0" class="amt-in money-input" type="text" inputmode="decimal" data-dlg="amount"
        value="${formatMoneyInput(d.amount)}" required>`,
        'full',
      )}
      ${dlgField(
        'Pagar com',
        h`<select data-dlg="from">${srcs.map(
          (a) => h`<option class="user-value"
        value="${a.id}" ${a.id === d.from ? raw('selected') : ''}>${accountOptionLabel(a)} · ${money(accBalance(a))}</option>`,
        )}</select>`,
        'full',
      )}
      ${
        installments
          ? h`
        ${dlgField(
          'Número de parcelas',
          h`<input type="number" data-dlg="times" min="2" max="60" step="1"
          value="${d.times || '2'}" inputmode="numeric" required>`,
        )}
        ${dlgField(
          h`Juros em cada parcela (<span class="money">R$</span>)`,
          h`<input class="money-input" type="text"
          inputmode="decimal" data-dlg="interest" value="${formatMoneyInput(d.interest || '0,00')}" required>`,
        )}
        ${dlgField(
          'Vencimento da primeira parcela',
          h`<input type="date" data-dlg="firstDueDate"
          value="${d.firstDueDate || ''}" min="${today()}" required>`,
          'full',
        )}
        <p class="fine full" data-pay-invoice-preview>${invoicePlanPreviewText(d)}</p>
      `
          : ''
      }
    </form>`,
    h`<button class="btn back" data-action="dlg-close">Cancelar</button><button class="btn primary" type="submit"
      form="dlgform">${installments ? 'Programar parcelas' : 'Pagar'}</button>`,
  );
}
function dlgTxDel() {
  const d = ui.dlg.d,
    t = S.finance.tx.find((x) => x.id === d.id) || {},
    g = S.finance.tx.filter((x) => x.groupId === d.gid),
    after = g.filter((x) => x.date >= (t.date || ''));
  if (!d.gid)
    return dlgWrap(
      h`<div class="head head-nowrap"><h2 id="dt">Excluir lançamento?</h2>${closeBtn}</div>
    <p class="small"><span
      class="${t.type === 'out' ? 'expense-name' : 'user-value'}">${t.type === 'out' ? expenseTitle(t.desc || t.category || 'Este lançamento') : t.desc || t.category || 'Este lançamento'}</span> · ${t.date || ''} · ${t.cents ? money(t.cents) : ''}</p>
    <p class="small muted">O lançamento poderá ser restaurado pela lixeira por 30 dias.</p>`,
      h`<button class="btn back" data-action="dlg-close">Cancelar</button><button class="btn danger"
        data-action="txdel-do" data-k="one">Excluir</button>`,
    );
  const opt = (
    k,
    title,
    count,
  ) => h`<button type="button" class="opt finance-series-delete-option" data-action="txdel-do" data-k="${k}">
    <span class="mk" aria-hidden="true">${icon('trash', 18)}</span>
    <span class="tx"><b>${title}</b><span>${count} · pode ser restaurado pela lixeira por até 30 dias</span></span>
  </button>`;
  return dlgWrap(
    h`<div class="head head-nowrap"><h2 id="dt">Excluir da série</h2>${closeBtn}</div>
    <p class="small muted">Esta série tem ${g.length} lançamentos. Escolha quais deseja remover.</p>
    <div class="finance-series-delete-options">
      ${opt('one', 'Só este lançamento', `1 ${plural(1, 'lançamento', 'lançamentos')}`)}
      ${opt('next', 'Este e os próximos', `${after.length} ${plural(after.length, 'lançamento', 'lançamentos')}`)}
      ${opt('all', 'Toda a série', `${g.length} ${plural(g.length, 'lançamento', 'lançamentos')}`)}
    </div>`,
    h`<button class="btn back" data-action="dlg-close">Cancelar</button>`,
  );
}
function dlgInstallmentSummary() {
  const transaction = S.finance.tx.find((item) => item.id === ui.dlg.d.id);
  const summary = summarizeInstallments(S.finance.tx, ui.dlg.d.id, accById, today().slice(0, 7));
  if (!transaction || !summary) {
    return dlgWrap(
      h`<div class="head head-nowrap"><h2 id="dt">Parcelas indisponíveis</h2>${closeBtn}</div>
      <p class="small muted">Esta série não está mais disponível. Feche e atualize a lista de lançamentos.</p>`,
      h`<button class="btn back" data-action="dlg-close">Fechar</button>`,
    );
  }

  const title = (transaction.desc || transaction.category || 'Série parcelada').replace(/\s+\(\d+\/\d+\)$/, '');
  const dialogTitle =
    transaction.type === 'out'
      ? 'Compra parcelada'
      : transaction.type === 'in'
        ? 'Recebimento parcelado'
        : 'Fatura parcelada';
  const rowLabel = (installment, index) => {
    const number = installment.desc?.match(/\((\d+)\/(\d+)\)$/);
    return number ? `${number[1]} de ${number[2]}` : `${index + 1} de ${summary.installments.length}`;
  };
  const installmentStatus = (installment) =>
    summary.cardPurchase
      ? installment.date.slice(0, 7) < today().slice(0, 7)
        ? 'Mês anterior'
        : 'Prevista'
      : isPaid(installment)
        ? 'Paga'
        : 'Pendente';

  return dlgWrap(
    h`<div class="head head-nowrap"><div><h2 id="dt">${dialogTitle}</h2><p
      class="small muted">${title}</p></div>${closeBtn}</div>
    <dl class="installment-summary-stats">
      <div><dt>Última parcela</dt><dd>${longDate(summary.endDate)} de ${summary.endDate.slice(0, 4)}</dd></div>
      <div><dt>Valor restante</dt><dd>${money(summary.remainingCents)}</dd></div>
      <div><dt>Parcelas restantes</dt><dd>${summary.remainingCount}</dd></div>
    </dl>
    <p class="fine">${
      summary.cardPurchase
        ? 'No cartão, o valor inclui as parcelas deste mês e dos próximos. O pagamento da fatura é separado.'
        : 'O valor restante soma as parcelas que ainda não foram marcadas como pagas.'
    }</p>
    <section class="installment-summary-schedule" aria-label="Parcelas da série">
      <h3>Parcelas</h3>
      <ul class="list">${summary.installments.map(
        (installment, index) => h`<li>
        <button type="button" class="installment-summary-row" data-action="edit-tx" data-id="${installment.id}"
          aria-current="${index === summary.selectedIndex ? 'step' : 'false'}"
          aria-label="Editar parcela ${rowLabel(installment, index)}">
          <span class="grow"><b>Parcela ${rowLabel(installment, index)}</b><small>${shortDate(installment.date)} · ${installmentStatus(installment)}${index === summary.selectedIndex ? ' · Selecionada' : ''}</small></span>
          <span class="amt ${installment.type}">${money(installment.cents)}</span>
        </button>
      </li>`,
      )}</ul>
    </section>`,
    h`<button class="btn back" data-action="dlg-close">Fechar</button>`,
  );
}
function dlgTxAnticipate() {
  const d = ui.dlg.d,
    transaction = S.finance.tx.find((item) => item.id === d.id);
  const installments = anticipationCandidates(d.groupId, d.fromDate),
    card = isCredit(accById(transaction?.accountId));
  return dlgWrap(
    h`<div class="head head-nowrap"><h2 id="dt">Antecipar parcelas</h2>${closeBtn}</div>
    ${
      card
        ? h`<p class="small muted">Selecione as parcelas e a data do registro. No cartão, a antecipação fica anotada sem criar pagamento nem alterar saldos; o pagamento da fatura continua sendo uma transferência separada.</p>`
        : h`<p class="small muted">Selecione as parcelas e a data em que foram pagas. Os meses originais permanecem; o pagamento será considerado no fluxo de caixa nessa data.</p>`
    }
    ${
      installments.length
        ? h`<form id="dlgform" class="form" data-form="dlg-txanticipate">
      ${dlgField(
        'Data da antecipação',
        h`<input id="f0" type="date" data-dlg="date" value="${d.date}" max="${today()}"
        required>`,
        'full',
      )}
      <fieldset class="finance-anticipation-list full"><legend
        class="small">Parcelas disponíveis</legend>${installments.map(
          (item) => h`<label class="row"><input
        type="checkbox" data-advance-id="${item.id}"><span
        class="grow">${item.desc || 'Parcela'} · ${shortDate(item.date)}</span><b>${money(item.cents)}</b></label>`,
        )}</fieldset>
    </form>`
        : h`<p class="fine">Não há parcelas futuras disponíveis para antecipar.</p>`
    }`,
    h`<button class="btn back" data-action="dlg-close">Cancelar</button>${
      installments.length
        ? h`<button
      class="btn primary" type="submit" form="dlgform">Confirmar antecipação</button>`
        : ''
    }`,
  );
}

export function registerFinanceDialogs() {
  Object.assign(DLG, {
    txbulk: dlgTxBulk,
    txdel: dlgTxDel,
    txanticipate: dlgTxAnticipate,
    'installment-summary': dlgInstallmentSummary,
    tx: dlgTx,
    'category-manager': dlgCategoryManager,
    'category-new': dlgCategoryNew,
    account: dlgAccount,
    acctdelete: dlgAccountDelete,
    'account-delete': dlgPermanentlyDeleteAccount,
    budget: dlgBudget,
    goal: dlgGoal,
    deposit: dlgDeposit,
    payinv: dlgPayInv,
  });
}
