import { formatMoneyInput } from '../../utils/currency.js';
import { h, raw } from '../../utils/dom.js';
import { icon } from '../../utils/icons.js';

export function createFinanceDialogViews(dependencies) {
  const {
    ui, S, catNames, CAT_ICONS, CATEGORY_ICON_LABELS, LIST_COLORS,
    accountOptionLabel, accById, isCredit, expenseTitle, topCategoryNames,
    categoryMatch, recById, today, dlgWrap, dlgField, closeBtn,
    anticipationCandidates,
  } = dependencies;
  return { transaction };

function transaction() {
  const d = ui.dlg.d, accs = S.finance.accounts, edit = !!d.id, tr = d.kind === 'tr', acc = accById(d.accountId);
  const originalDate = S.finance.tx.find((item) => item.id === d.id)?.date;
  const canAnticipate = !!d.groupId && anticipationCandidates(d.groupId, originalDate).length > 0;
  const hasInstallmentInterest = d.kind === 'out' && (edit ? !!d.groupId : d.repeat === 'parcel');
  const kinds = [['out', 'Despesa'], ['in', 'Receita'], ['tr', 'Transferência']];
  const formSection = (label) => h`<h3 class="finance-form-section full">${label}</h3>`;
  const cats = catNames(d.kind === 'in' ? 'in' : 'out'), catList = cats.includes(d.category) || d.category === '__new' ? cats : [d.category, ...cats];
  return dlgWrap(h`<div class="head head-nowrap"><h2 id="dt">${edit ? 'Editar lançamento' : 'Novo lançamento'}<i>.</i></h2>${closeBtn}</div>
    ${d.recId && recById(d.recId) ? h`<div class="notice">${icon('repeat', 18)}<span class="small grow">Faz parte de uma fixa mensal. Mudar aqui afeta só este mês.</span><button type="button" class="btn sm" data-action="rec-edit" data-id="${d.recId}">Editar fixa</button></div>` : ''}
    <div class="seg finance-transaction-type" role="group" aria-label="Tipo de lançamento">${kinds.map(([k, l]) => h`<button type="button" aria-pressed="${d.kind === k}" data-action="tx-kind" data-k="${k}">${l}</button>`)}</div>
    <form id="dlgform" class="form" data-form="dlg-tx">
      ${formSection('Detalhes do lançamento')}
      ${dlgField(h`Valor (<span class="money">R$</span>)`, h`<input id="f0" class="amt-in money-input" type="text" inputmode="decimal" data-dlg="amount" value="${formatMoneyInput(d.amount)}" placeholder="00,00" required autocomplete="off">`, 'full')}
      ${hasInstallmentInterest ? dlgField(h`Juros desta parcela (<span class="money">R$</span>)`, h`<input class="money-input" type="text" inputmode="decimal" data-dlg="interest" value="${formatMoneyInput(d.interest || '')}" placeholder="00,00" autocomplete="off">`, 'full') : ''}
      ${!edit && hasInstallmentInterest ? h`<p class="fine full">Informe zero se não houver juros. O valor é informativo e já está incluído na parcela; as demais podem ser editadas individualmente.</p>` : ''}
      ${dlgField('Descrição', h`<input type="text" data-dlg="desc" value="${d.desc}" maxlength="80" placeholder="${tr ? 'Ex.: Reserva do mês' : 'Ex.: Mercado'}" autocomplete="off">`, 'full')}
      ${tr ? '' : dlgField('Categoria', h`<select data-dlg="category">${catList.map((c) => h`<option class="expense-name" value="${c}" ${c === d.category ? raw('selected') : ''}>${expenseTitle(c)}</option>`)}<option value="__new" ${d.category === '__new' ? raw('selected') : ''}>Criar nova categoria…</option></select>`, 'full')}
      ${!tr && d.category === '__new' ? h`
        ${topCategoryNames(d.kind === 'in' ? 'in' : 'out').length ? dlgField('Categoria pai (opcional)', h`<select data-dlg="newParent"><option value="">Nenhuma</option>${topCategoryNames(d.kind === 'in' ? 'in' : 'out').map((name) => h`<option value="${name}" ${d.newParent === name ? raw('selected') : ''}>${expenseTitle(name)}</option>`)}</select>`, 'full') : ''}
        ${dlgField('Nome da nova categoria', h`<input type="text" data-dlg="newName" value="${d.newName || ''}" maxlength="30" placeholder="Ex.: Pets" autocomplete="off">`, 'full')}
        ${dlgField('Ícone', h`<select data-dlg="newIcon">${CAT_ICONS.map((name) => h`<option value="${name}" ${name === (d.newIcon || 'tag') ? raw('selected') : ''}>${CATEGORY_ICON_LABELS[name]}</option>`)}</select>`)}
        ${dlgField('Cor', h`<input type="color" data-dlg="newColor" value="${d.newColor || (d.newParent ? categoryMatch(d.kind === 'in' ? 'in' : 'out', d.newParent)?.category.color : LIST_COLORS[0]) || LIST_COLORS[0]}" aria-label="Cor da nova categoria">`)}
      ` : ''}
      ${formSection(tr ? 'Contas da transferência' : 'Conta e período')}
      ${dlgField(tr ? 'Sai de' : 'Conta', h`<select data-dlg="accountId">${accs.map((a) => h`<option class="user-value" value="${a.id}" ${a.id === d.accountId ? raw('selected') : ''}>${accountOptionLabel(a)}</option>`)}</select>`)}
      ${tr ? dlgField('Vai para', h`<select data-dlg="toAccountId">${accs.filter((a) => a.id !== d.accountId).map((a) => h`<option class="user-value" value="${a.id}" ${a.id === d.toAccountId ? raw('selected') : ''}>${accountOptionLabel(a)}</option>`)}</select>`) : dlgField('Data do lançamento', h`<input type="date" data-dlg="date" value="${d.date}">`)}
      ${tr ? dlgField('Data da transferência', h`<input type="date" data-dlg="date" value="${d.date}">`, 'full') : h`<p class="fine full">Esta data organiza o lançamento no mês. Se não for hoje, ele começa como pendente.</p>`}
      ${!tr && !isCredit(acc) ? h`${formSection('Situação do pagamento')}<label class="row full tx-settlement-toggle"><input type="checkbox" data-dlg="paid" ${d.paid ? raw('checked') : ''}><span class="small tx-settlement-toggle-copy"><b>${d.kind === 'in' ? 'Já recebi' : 'Já paguei'}</b><span class="muted">${d.kind === 'in' ? 'Desmarque para deixar como "a receber".' : 'Desmarque para deixar como "a pagar".'} Outra data desmarca esta opção automaticamente.</span></span></label>` : ''}
      ${!tr && !isCredit(acc) && d.paid ? h`${dlgField(d.kind === 'in' ? 'Data do recebimento' : 'Data do pagamento', h`<input type="date" data-dlg="settledDate" value="${d.settledDate || d.date}" max="${today()}" required>`, 'full')}<p class="fine full">Quando o valor entrou ou saiu da conta. Os relatórios por caixa usam esta data.</p>` : ''}
      ${canAnticipate ? h`<div class="notice full"><span class="small grow">Você pode marcar as parcelas futuras desta série como antecipadas.</span><button type="button" class="btn sm" data-action="tx-anticipate-open">Antecipar parcelas</button></div>` : ''}
      ${!edit && !tr ? h`${formSection('Repetição')}${dlgField('Repetir', h`<select data-dlg="repeat"><option value="none" ${d.repeat === 'none' ? raw('selected') : ''}>Não repetir</option><option value="parcel" ${d.repeat === 'parcel' ? raw('selected') : ''}>Parcelado</option><option value="fixed" ${d.repeat === 'fixed' ? raw('selected') : ''}>Fixa mensal</option></select>`)}${d.repeat === 'parcel' ? h`${dlgField('Parcela atual', h`<input type="number" data-dlg="currentInstallment" min="1" max="60" value="${d.currentInstallment || '1'}" inputmode="numeric">`)}${dlgField('Total de parcelas', h`<input type="number" data-dlg="times" min="2" max="60" value="${d.times}" inputmode="numeric">`)}${dlgField('Valor informado', h`<select data-dlg="installmentAmountMode"><option value="total" ${d.installmentAmountMode !== 'installment' ? raw('selected') : ''}>Total da compra</option><option value="installment" ${d.installmentAmountMode === 'installment' ? raw('selected') : ''}>Valor de cada parcela</option></select>`)}` : ''}${d.repeat !== 'none' ? h`<p class="fine full">${d.repeat === 'parcel' ? d.installmentAmountMode === 'installment' ? 'O valor informado será usado em cada parcela. A data é da parcela atual; serão criadas somente esta e as seguintes. Parcelas anteriores não serão lançadas.' : 'O valor informado é o total da compra e será dividido igualmente. A data é da parcela atual; serão criadas somente esta e as seguintes. Parcelas anteriores não serão lançadas.' : 'Criada todo mês automaticamente, no mesmo dia. Edite ou pause em Fixas, na aba Lançamentos.'}</p>` : ''}` : ''}
    </form>`,
    h`${edit ? h`<button class="btn danger back" data-action="tx-del-dlg">${icon('trash', 18)}</button>` : h`<button class="btn back" data-action="dlg-close">Cancelar</button>`}<button class="btn primary" type="submit" form="dlgform">${edit ? 'Salvar' : 'Adicionar'}</button>`);
}
}
