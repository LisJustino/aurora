import { formatMoneyInput } from '../../utils/currency.js';
import { h, raw } from '../../utils/dom.js';
import { icon } from '../../utils/icons.js';

export function createFinanceDialogViews(dependencies) {
  const {
    ui, S, topCategoryNames, categoryMatch,
    accountOptionLabel, accById, isCredit, expenseTitle, categoryInfo, recById, today, dlgWrap, dlgField, closeBtn,
    anticipationCandidates,
  } = dependencies;
  return { transaction };

function transaction() {
  const d = ui.dlg.d, accs = S.finance.accounts, edit = !!d.id, tr = d.kind === 'tr', acc = accById(d.accountId);
  const canContinue = !edit && ['out', 'in', 'tr'].includes(d.kind);
  const categoryKind = d.kind === 'in' ? 'in' : 'out';
  const categorySelection = categoryMatch(categoryKind, d.category);
  const categoryParent = categorySelection?.category.name || d.category || topCategoryNames(categoryKind)[0] || '';
  const categoryParents = topCategoryNames(categoryKind);
  const parentOptions = categoryParents.includes(categoryParent) ? categoryParents : [categoryParent, ...categoryParents];
  const selectedParent = categoryMatch(categoryKind, categoryParent)?.category;
  const subcategories = selectedParent?.subcategories || [];
  const selectedSubcategory = categorySelection?.subcategory?.name || '';
  const originalDate = S.finance.tx.find((item) => item.id === d.id)?.date;
  const canAnticipate = !!d.groupId && anticipationCandidates(d.groupId, originalDate).length > 0;
  const hasInstallmentInterest = d.kind === 'out' && (edit ? !!d.groupId : d.repeat === 'parcel');
  const amountLabel = d.repeat === 'parcel'
    ? d.installmentAmountMode === 'installment' ? 'Valor de cada parcela' : 'Valor total da compra'
    : 'Valor';
  const kinds = [['out', 'Despesa'], ['in', 'Receita'], ['tr', 'Transferência']];
  const formSection = (label) => h`<h3 class="finance-form-section full">${label}</h3>`;
  return dlgWrap(h`<div class="head head-nowrap"><h2 id="dt">${edit ? 'Editar lançamento' : 'Novo lançamento'}</h2>${closeBtn}</div>
    ${d.recId && recById(d.recId) ? h`<div class="notice">${icon('repeat', 18)}<span class="small grow">Faz parte de uma fixa mensal. Mudar aqui afeta só este mês.</span><button type="button" class="btn sm" data-action="rec-edit" data-id="${d.recId}">Editar fixa</button></div>` : ''}
    <div class="seg finance-transaction-type" role="group" aria-label="Tipo de lançamento">${kinds.map(([k, l]) => h`<button type="button" aria-pressed="${d.kind === k}" data-action="tx-kind" data-k="${k}">${l}</button>`)}</div>
    <form id="dlgform" class="form" data-form="dlg-tx">
      ${formSection('Detalhes do lançamento')}
      ${dlgField(h`${amountLabel} (<span class="money">R$</span>)`, h`<input id="f0" class="amt-in money-input" type="text" inputmode="decimal" data-dlg="amount" value="${formatMoneyInput(d.amount)}" placeholder="00,00" required autocomplete="off">`, 'full')}
      ${hasInstallmentInterest ? dlgField(h`Juros desta parcela (<span class="money">R$</span>)`, h`<input class="money-input" type="text" inputmode="decimal" data-dlg="interest" value="${formatMoneyInput(d.interest || '')}" placeholder="00,00" autocomplete="off">`, 'full') : ''}
      ${!edit && hasInstallmentInterest ? h`<p class="fine full">Informe zero se não houver juros. O valor é informativo e já está incluído na parcela; as demais podem ser editadas individualmente.</p>` : ''}
      ${dlgField('Descrição', h`<input type="text" data-dlg="desc" value="${d.desc}" maxlength="80" placeholder="${tr ? 'Ex.: Reserva do mês' : 'Ex.: Mercado'}" autocomplete="off">`, 'full')}
      ${tr ? '' : h`${dlgField('Categoria', h`<select data-dlg="category">${parentOptions.map((name) => { const meta = categoryInfo(categoryKind, name); return h`<option class="expense-name" data-icon="${meta.i}" data-color="${meta.c}" value="${name}" ${name === categoryParent ? raw('selected') : ''}>${expenseTitle(name)}</option>`; })}<option value="__new">Criar nova categoria…</option></select>`, 'full')}
        ${dlgField('Subcategoria (opcional)', h`<select data-dlg="subcategory"><option value="" ${selectedSubcategory ? '' : raw('selected')}>Sem subcategoria</option>${subcategories.map((subcategory) => { const meta = categoryInfo(categoryKind, `${categoryParent} > ${subcategory.name}`); return h`<option class="expense-name" data-icon="${meta.i}" data-color="${meta.c}" value="${subcategory.name}" ${subcategory.name === selectedSubcategory ? raw('selected') : ''}>${expenseTitle(subcategory.name)}</option>`; })}<option value="__new">Criar subcategoria…</option></select>`, 'full')}`}
      ${formSection(tr ? 'Contas da transferência' : 'Conta e período')}
      ${dlgField(tr ? 'Sai de' : 'Conta', h`<select data-dlg="accountId">${accs.map((a) => h`<option class="user-value" value="${a.id}" ${a.id === d.accountId ? raw('selected') : ''}>${accountOptionLabel(a)}</option>`)}</select>`)}
      ${tr ? dlgField('Vai para', h`<select data-dlg="toAccountId">${accs.filter((a) => a.id !== d.accountId).map((a) => h`<option class="user-value" value="${a.id}" ${a.id === d.toAccountId ? raw('selected') : ''}>${accountOptionLabel(a)}</option>`)}</select>`) : dlgField('Data do lançamento', h`<input type="date" data-dlg="date" value="${d.date}">`)}
      ${tr ? dlgField('Data da transferência', h`<input type="date" data-dlg="date" value="${d.date}">`, 'full') : h`<p class="fine full">Esta data organiza o lançamento no mês. Se não for hoje, ele começa como pendente.</p>`}
      ${!tr && !isCredit(acc) ? h`${formSection('Situação do pagamento')}<label class="row full tx-settlement-toggle"><input type="checkbox" data-dlg="paid" ${d.paid ? raw('checked') : ''}><span class="small tx-settlement-toggle-copy"><b>${d.kind === 'in' ? 'Já recebi' : 'Já paguei'}</b><span class="muted">${d.kind === 'in' ? 'Desmarque para deixar como "a receber".' : 'Desmarque para deixar como "a pagar".'} Outra data desmarca esta opção automaticamente.</span></span></label>` : ''}
      ${!tr && !isCredit(acc) && d.paid ? h`${dlgField(d.kind === 'in' ? 'Data do recebimento' : 'Data do pagamento', h`<input type="date" data-dlg="settledDate" value="${d.settledDate || d.date}" max="${today()}" required>`, 'full')}<p class="fine full">Quando o valor entrou ou saiu da conta. Os relatórios por caixa usam esta data.</p>` : ''}
      ${canAnticipate ? h`<div class="notice full"><span class="small grow">Você pode marcar as parcelas futuras desta série como antecipadas.</span><button type="button" class="btn sm" data-action="tx-anticipate-open">Antecipar parcelas</button></div>` : ''}
      ${!edit && !tr ? h`${formSection('Repetição')}${dlgField('Repetir', h`<select data-dlg="repeat"><option value="none" ${d.repeat === 'none' ? raw('selected') : ''}>Não repetir</option><option value="parcel" ${d.repeat === 'parcel' ? raw('selected') : ''}>Parcelado</option><option value="fixed" ${d.repeat === 'fixed' ? raw('selected') : ''}>Fixa mensal</option></select>`, 'full')}${d.repeat === 'parcel' ? h`<fieldset class="finance-installment-fields full">
        <legend>Configuração das parcelas</legend>
        <p class="fine full finance-installment-help">A data do lançamento acima corresponde à parcela atual. Parcelas anteriores não serão criadas.</p>
        ${dlgField('Número desta parcela', h`<input type="number" data-dlg="currentInstallment" min="1" max="60" value="${d.currentInstallment || '1'}" inputmode="numeric">`)}
        ${dlgField('Total de parcelas', h`<input type="number" data-dlg="times" min="2" max="60" value="${d.times}" inputmode="numeric">`)}
        ${dlgField('O valor acima representa', h`<select data-dlg="installmentAmountMode"><option value="total" ${d.installmentAmountMode !== 'installment' ? raw('selected') : ''}>Valor total da compra</option><option value="installment" ${d.installmentAmountMode === 'installment' ? raw('selected') : ''}>Valor de cada parcela</option></select>`, 'full')}
        <p class="fine full finance-installment-help">${d.installmentAmountMode === 'installment'
          ? 'Esse valor será usado em cada parcela.'
          : 'O total será dividido igualmente; eventuais centavos restantes ficam na primeira parcela da série.'}</p>
      </fieldset>` : ''}${d.repeat === 'fixed' ? h`<p class="fine full">Criada todo mês automaticamente, no mesmo dia. Edite ou pause em Fixas, na aba Lançamentos.</p>` : ''}` : ''}
    </form>`,
    h`${edit ? h`<button class="btn danger back" data-action="tx-del-dlg">${icon('trash', 18)}</button>` : h`<button class="btn back" data-action="dlg-close">Cancelar</button>${canContinue ? h`<button class="btn ghost" type="submit" form="dlgform" data-action="tx-save-and-another">Continuar e salvar</button>` : ''}`}<button class="btn primary" type="submit" form="dlgform" data-action="tx-save">${edit ? 'Salvar' : 'Adicionar'}</button>`);
}
}
