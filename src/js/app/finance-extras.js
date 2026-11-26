import { h, raw } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { formatMoneyInput, parseMoney } from '../utils/currency.js';
import { MESES, pad, shortDate, today } from '../utils/dates.js';
import { newId } from '../utils/ids.js';
import { reportMonthStats } from '../features/finance/calculations.js';
import { matchCategoryRule } from '../features/finance/category-rules.js';
import { ACTIONS } from './actions.js';
import { norm, plural } from './core.js';
import { askDiscardDialog, closeBtn, createDialog, dlgClose, dlgField, dlgOpen, dlgWrap } from './dialogs.js';
import { moneyIn } from './finance-dialogs.js';
import {
  accById,
  accName,
  accountOptionLabel,
  byCategory,
  catMeta,
  isCredit,
  isPaid,
  outMeta,
  shiftMonth,
  ymLabel,
} from './finance-view.js';
import { CHANGES, FORMS, num } from './forms.js';
import { DLG } from './onboarding.js';
import { commit, createTrashRecord, moveRecordsToTrash, restoreTrashEntry } from './persistence.js';
import { render } from './render.js';
import { toast } from './samples-backup.js';
import { areaEmpty, cap, expenseTitle, money } from './shell.js';
import { catNames, S, ui } from './state.js';

// Finanças 2: lançamentos fixos, importação de extratos e relatórios
export const recList = () => S.finance.recurring || (S.finance.recurring = []);
export function reconcileRecurringTransactions() {
  const winners = new Map();
  S.finance.tx.forEach((transaction) => {
    if (!transaction.recId) return;
    const key = `${transaction.recId}:${transaction.date}`;
    const previous = winners.get(key);
    // A mesma fixa só pode gerar um lançamento por mês. Em duplicatas antigas,
    // preservamos o registro já quitado, quando houver um.
    if (!previous || (isPaid(transaction) && !isPaid(previous))) winners.set(key, transaction);
  });
  const next = S.finance.tx.filter(
    (transaction) => !transaction.recId || winners.get(`${transaction.recId}:${transaction.date}`) === transaction,
  );
  const changed = next.length !== S.finance.tx.length;
  if (changed) S.finance.tx = next;
  return changed;
}
export function genRecurring() {
  const F = S.finance,
    rs = F.recurring;
  if (!rs || !rs.length) return false;
  const hz = shiftMonth(today().slice(0, 7), 3);
  let ch = false;
  rs.forEach((r) => {
    const acc = accById(r.accountId);
    if (!acc || r.paused) return;
    let ym = r.lastYM ? shiftMonth(r.lastYM, 1) : r.startYM,
      g = 0;
    while (ym <= hz && (!r.endYM || ym <= r.endYM) && g++ < 60) {
      const dim = new Date(Number(ym.slice(0, 4)), Number(ym.slice(5)), 0).getDate(),
        date = `${ym}-${pad(Math.min(r.day, dim))}`;
      if (!F.tx.some((transaction) => transaction.recId === r.id && transaction.date === date)) {
        const paid = isCredit(acc) ? true : ym === r.startYM && r.firstPaid !== undefined ? r.firstPaid : false;
        F.tx.push({
          id: newId(),
          type: r.type,
          accountId: r.accountId,
          category: r.category,
          desc: r.desc,
          cents: r.cents,
          date,
          ...(paid && !isCredit(acc) ? { settledDate: date } : {}),
          paid,
          createdAt: Date.now() + g,
          recId: r.id,
        });
      }
      r.lastYM = ym;
      ch = true;
      ym = shiftMonth(ym, 1);
    }
    delete r.firstPaid;
  });
  return ch;
}
export const recById = (id) => recList().find((r) => r.id === id);
const recWhen = (r) => `dia ${r.day} · ${accName(r.accountId)} · ${r.category}`;

// ferramentas da aba Lançamentos
export function finTools() {
  return h`<div class="fin-tools"><div class="row fin-tools-actions"><button type="button" class="btn sm primary"
      data-action="tx-new">${icon('plus', 16)}Novo</button><button type="button" class="btn sm"
      data-action="tx-bulk">${icon('list', 16)}Cadastrar vários</button><label
      class="btn sm fin-import-action">${icon('upload', 16)}Importar extrato<input type="file" class="sr"
      accept=".csv,.ofx,.txt,text/csv,text/plain" data-change="fin-import"
      aria-label="Importar extrato CSV ou OFX"></label><button type="button" class="btn ghost sm"
      data-action="fin-csv">${icon('download', 16)}<span>Exportar <span
      class="case-preserve">CSV</span></span></button></div></div>`;
}
// fixas: lista e edição
function dlgRecurList() {
  const rs = recList();
  return dlgWrap(
    h`<div class="head head-nowrap"><h2 id="dt">Lançamentos fixos</h2>${closeBtn}</div>
    <p class="small muted">Contas e receitas que se repetem todo mês. O Aurora cria os próximos meses sozinho. Para criar uma, use Lançamento e escolha "Fixa mensal".</p>
    ${
      rs.length
        ? h`<ul class="list more">${rs.map(
            (r) => h`<li><button type="button" class="mrow"
      data-action="rec-edit" data-id="${r.id}"><span
      class="mk">${icon(catMeta({ type: r.type, category: r.category }).i, 20)}</span><span class="grow"><b><span
      class="${r.type === 'out' ? 'expense-name' : 'user-value'}">${r.type === 'out' ? expenseTitle(r.desc || r.category) : r.desc || r.category}</span>${r.paused ? ' · pausada' : ''}</b><small>${r.type === 'in' ? '+' : '−'}${money(r.cents)} · <span
      class="user-value">${recWhen(r)}</span></small></span>${icon('chevRight', 16)}</button></li>`,
          )}</ul>`
        : areaEmpty(
            'Nenhum lançamento fixo ainda.',
            'Se quiser, registre uma despesa ou receita mensal para acompanhar aqui.',
            h`<button
      type="button" class="btn primary"
      data-action="tx-new">${icon('plus', 16)}Criar lançamento fixo</button>`,
            'repeat',
            'h3',
          )
    }`,
    h`<button class="btn back" data-action="dlg-close">Fechar</button>`,
  );
}
function dlgRecur() {
  const d = ui.dlg.d,
    kind = d.kind,
    cats = catNames(kind),
    cl = cats.includes(d.category) ? cats : [d.category, ...cats],
    accs = S.finance.accounts;
  return dlgWrap(
    h`<div class="head head-nowrap"><h2 id="dt">Editar fixa</h2>${closeBtn}</div>
    <form id="dlgform" class="form" data-form="dlg-recur">
      ${dlgField(
        'Descrição',
        h`<input id="f0" type="text" data-dlg="desc" value="${d.desc}" maxlength="80"
        autocomplete="off">`,
        'full',
      )}
      ${dlgField(
        h`Valor (<span class="money">R$</span>)`,
        h`<input type="text" class="amt-in money-input"
        inputmode="decimal" data-dlg="amount" value="${formatMoneyInput(d.amount)}"
        required>`,
      )}${dlgField(
        'Dia do mês',
        h`<input type="number" min="1" max="31" data-dlg="day" value="${d.day}"
        inputmode="numeric">`,
      )}
      ${dlgField(
        'Categoria',
        h`<select data-dlg="category">${cl.map(
          (c) => h`<option
        class="${kind === 'out' ? 'expense-name' : 'user-value'}"
        value="${c}" ${c === d.category ? raw('selected') : ''}>${kind === 'out' ? expenseTitle(c) : c}</option>`,
        )}</select>`,
      )}${dlgField(
        'Conta',
        h`<select
        data-dlg="accountId">${accs.map(
          (a) => h`<option class="user-value"
        value="${a.id}" ${a.id === d.accountId ? raw('selected') : ''}>${accountOptionLabel(a)}</option>`,
        )}</select>`,
      )}
      <label class="row full form-choice-row"><input type="checkbox"
        data-dlg="future" ${d.future ? raw('checked') : ''}><span
        class="small"><b>Aplicar aos próximos já criados</b><br><span
        class="muted">Atualiza os meses futuros que ainda não foram pagos.</span></span></label>
      <label class="row full form-choice-row"><input type="checkbox"
        data-dlg="paused" ${d.paused ? raw('checked') : ''}><span class="small"><b>Pausar</b><br><span
        class="muted">Para de criar novos meses.</span></span></label>
      ${
        d.confirmDel
          ? h`<p class="notice warn full"
        role="alert">A fixa e os próximos meses ainda não pagos irão para a lixeira por 30 dias. Os meses já pagos ficam. Toque em "Confirmar exclusão".</p>`
          : ''
      }
    </form>`,
    h`<button type="button" class="btn danger back"
      data-action="rec-del">${d.confirmDel ? 'Confirmar exclusão' : icon('trash', 18)}</button><button
      class="btn primary" type="submit" form="dlgform">Salvar</button>`,
  );
}

// importar extrato (CSV / OFX)
const KW = [
  [/mercado|supermerc|padaria|restaur|lanche|ifood|pizza|cafe|burger|acougue|hortifruti/, 'Alimentação'],
  [/uber|99 ?pop|combust|posto|estacion|onibus|metro|pedagio/, 'Transporte'],
  [/farmac|drog|medic|consulta|clinica|hospital|dentist/, 'Saúde'],
  [/aluguel|condominio|energia|enel|sabesp|internet|vivo|claro|tim /, 'Moradia'],
  [/netflix|spotify|cinema|ingresso|steam|disney|prime video/, 'Lazer'],
  [/curso|escola|faculdade|livro|udemy/, 'Educação'],
  [/salario|folha|pagamento de/, 'Salário'],
];
export function guessCategory(desc, kind) {
  const names = catNames(kind),
    n = norm(desc);
  const customRule = matchCategoryRule(desc, kind, S.settings.prefs.financeCategoryRules);
  if (customRule && names.includes(customRule.category)) return customRule.category;
  const hit =
    S.finance.tx.find((t) => t.type === kind && t.desc && norm(t.desc) === n) ||
    S.finance.tx.find((t) => t.type === kind && t.desc && norm(t.desc).length >= 4 && n.includes(norm(t.desc)));
  if (hit && names.includes(hit.category)) return hit.category;
  for (const [re, c] of KW) {
    const f = names.find((x) => norm(x) === norm(c));
    if (f && re.test(n)) return f;
  }
  return names.find((c) => /outro/i.test(c)) || names[0];
}
export function impRecalc(d, resetCats) {
  d.rows.forEach((r) => {
    const amt = d.invert ? -r.cents : r.cents;
    r.kind = amt > 0 ? 'in' : 'out';
    r.abs = Math.abs(amt);
    if (resetCats || !catNames(r.kind).includes(r.cat)) r.cat = guessCategory(r.desc, r.kind);
    const status = statementDuplicateStatus(
      {
        accountId: d.accountId,
        date: r.date,
        cents: r.abs,
        type: r.kind,
        desc: r.desc,
      },
      S.finance.tx,
    );
    r.dup = status.duplicate;
    r.possibleDup = status.possible;
    r.on = !r.dup;
  });
}
function dlgImport2() {
  const d = ui.dlg.d,
    selected = d.rows.filter((r) => r.on),
    n = selected.length;
  const selectedTotals = selected.reduce(
    (totals, row) => {
      totals[row.kind] += row.abs;
      return totals;
    },
    { in: 0, out: 0 },
  );
  const dups = d.rows.filter((r) => r.dup).length;
  const possibleDups = d.rows.filter((r) => r.possibleDup).length;
  return dlgWrap(
    h`<div class="head head-nowrap"><h2 id="dt">Importar extrato</h2>${closeBtn}</div>
    <p class="small muted"><b>${d.file}</b>: ${d.rows.length} lançamentos encontrados${dups ? `, ${dups} têm descrição correspondente e foram desmarcados como prováveis duplicatas para conferência` : ''}${possibleDups ? `, ${possibleDups} têm data, valor e tipo iguais a registros existentes, mas descrições diferentes; permanecem marcados para sua revisão` : ''}. Confira antes de importar.</p>
    <p class="small muted" role="status"
      aria-live="polite">Selecionados: ${n} · despesas ${money(selectedTotals.out)} · receitas ${money(selectedTotals.in)}.</p>
    ${
      d.truncated
        ? h`<p class="notice warn full"
      role="status">O arquivo tem mais de 500 lançamentos. A prévia inclui os primeiros 500; importe o restante em outro arquivo para não deixar registros de fora.</p>`
        : ''
    }
    <div class="form">${dlgField(
      'Importar para a conta',
      h`<select
      data-dlg="accountId">${S.finance.accounts.map(
        (a) => h`<option class="user-value"
      value="${a.id}" ${a.id === d.accountId ? raw('selected') : ''}>${accountOptionLabel(a)}</option>`,
      )}</select>`,
      'full',
    )}
      <label class="row full form-choice-row"><input type="checkbox"
        data-dlg="invert" ${d.invert ? raw('checked') : ''}><span
        class="small"><b>Inverter entradas e saídas</b><br><span
        class="muted">Use se o arquivo mostra as compras como valores positivos (comum em fatura de cartão).</span></span></label></div>
    <ul class="list imp">${d.rows.map(
      (r, i) => h`<li><label class="row import-row-label"><input type="checkbox"
        data-dlg="rows.${i}.on" ${r.on ? raw('checked') : ''} aria-label="Importar ${r.desc}"><span class="grow"><b
        class="ellip ${r.kind === 'out' ? 'expense-name' : 'user-value'}">${r.kind === 'out' ? expenseTitle(r.desc) : r.desc}</b><span
        class="small muted">${shortDate(r.date)}${r.dup ? ' · provável duplicata (desmarcada)' : r.possibleDup ? ' · confira possível semelhança' : ''}</span></span><span
        class="amt ${r.kind}">${r.kind === 'in' ? '+' : '−'}${money(r.abs)}</span></label>
      <select class="impcat" data-dlg="rows.${i}.cat"
        aria-label="Categoria de ${r.desc}">${catNames(r.kind).map(
          (c) => h`<option
        class="user-value" ${c === r.cat ? raw('selected') : ''}>${c}</option>`,
        )}</select></li>`,
    )}</ul>`,
    h`<button class="btn back" data-action="dlg-close">Cancelar</button><button class="btn primary"
      data-action="imp-apply" ${n ? '' : raw('disabled')}>Importar ${n ? '(' + n + ')' : ''}</button>`,
  );
}
let statementDuplicateStatus;

// comparar meses
const monthOpts = () => Array.from({ length: 12 }, (_, i) => shiftMonth(today().slice(0, 7), -i));
export function finCompare() {
  const A = ui.cmpA || ui.finMonth,
    B = ui.cmpB || shiftMonth(A, -1);
  const sa = reportMonthStats(S.finance.tx, A, accById, ui.repBasis);
  const sb = reportMonthStats(S.finance.tx, B, accById, ui.repBasis);
  const ca = Object.fromEntries(byCategory(sa.tx, 'out')),
    cb = Object.fromEntries(byCategory(sb.tx, 'out'));
  const names = [...new Set([...Object.keys(ca), ...Object.keys(cb)])]
      .sort((x, y) => Math.max(cb[y] || 0, ca[y] || 0) - Math.max(cb[x] || 0, ca[x] || 0))
      .slice(0, 8),
    mx = Math.max(1, ...names.map((n) => Math.max(ca[n] || 0, cb[n] || 0)));
  const dl = (a, b, good) => {
    if (!b && !a) return '—';
    const d = a - b,
      p = b ? Math.round((d / b) * 100) : null;
    return h`<span
      class="cmp-delta ${d === 0 ? 'muted' : d > 0 === good ? 'okc' : 'err'}"><span>${d > 0 ? '+' : d < 0 ? '−' : ''}${money(Math.abs(d))}</span>${p !== null ? h`<small class="cmp-pct">(${d > 0 ? '+' : d < 0 ? '−' : ''}${Math.abs(p)}%)</small>` : ''}</span>`;
  };
  const sel = (k, v) =>
    h`<select data-change="cmp-${k}"
      aria-label="Mês ${k === 'a' ? 'principal' : 'de comparação'}">${monthOpts().map(
        (m) => h`<option
      value="${m}" ${m === v ? raw('selected') : ''}>${cap(ymLabel(m))}</option>`,
      )}</select>`;
  return h`<section class="card"><h2>Comparar meses</h2>
    <div class="form">${dlgField('Mês', sel('a', A))}${dlgField('Comparar com', sel('b', B))}</div>
    <div class="finance-compare-table-wrap" role="region" aria-label="Comparação dos valores dos meses selecionados"
      tabindex="0"><table
      class="cmp"><thead><tr><th></th><th>${MESES[Number(A.slice(5)) - 1]}</th><th>${MESES[Number(B.slice(5)) - 1]}</th><th>Diferença</th></tr></thead><tbody>
      <tr><td>Receitas</td><td>${money(sa.inAll)}</td><td>${money(sb.inAll)}</td><td>${dl(sa.inAll, sb.inAll, true)}</td></tr>
      <tr><td>Despesas</td><td>${money(sa.outAll)}</td><td>${money(sb.outAll)}</td><td>${dl(sa.outAll, sb.outAll, false)}</td></tr>
      <tr><td>Resultado</td><td>${money(sa.inAll - sa.outAll)}</td><td>${money(sb.inAll - sb.outAll)}</td><td>${dl(sa.inAll - sa.outAll, sb.inAll - sb.outAll, true)}</td></tr></tbody></table></div>
    ${
      names.length
        ? h`<div class="f"><span class="lbl">Despesas por categoria</span><ul class="list cmpl">${names.map(
            (n) => h`<li><div class="grow"><div class="row finance-compare-row"><b
              class="expense-name">${expenseTitle(n)}</b><span
              class="small">${dl(ca[n] || 0, cb[n] || 0, false)}</span></div>
      <div class="pair" aria-hidden="true"><span
        style="width:${((ca[n] || 0) / mx) * 100}%;background:${outMeta(n).c}"></span></div><div class="pair b"
        aria-hidden="true"><span style="width:${((cb[n] || 0) / mx) * 100}%;background:${outMeta(n).c}"></span></div>
      <div class="small muted">${money(ca[n] || 0)} · ${money(cb[n] || 0)}</div></div></li>`,
          )}</ul><p class="fine">Barra cheia: ${cap(ymLabel(A))}. Barra clara: ${cap(ymLabel(B))}.</p></div>`
        : areaEmpty(
            'Nenhuma despesa para comparar.',
            'Quando houver despesas nos períodos selecionados, a comparação por categoria aparecerá aqui.',
            h`<button type="button" class="btn primary" data-action="tx-new">${icon('plus', 16)}Criar despesa</button>`,
            'pie',
            'h3',
            'finance-compare-empty',
          )
    }
    </section>`;
}

export function registerFinanceExtras() {
  Object.assign(DLG, { recurlist: dlgRecurList, recur: dlgRecur, impfin: dlgImport2 });
  Object.assign(ACTIONS, {
    'rec-list': () => dlgOpen('recurlist', {}),
    'rec-edit': (el) => {
      const r = recById(el.dataset.id);
      if (r)
        dlgOpen('recur', {
          id: r.id,
          kind: r.type,
          desc: r.desc || '',
          amount: moneyIn(r.cents),
          day: r.day,
          category: r.category,
          accountId: r.accountId,
          future: true,
          paused: !!r.paused,
        });
    },
    'rec-del': () => {
      const d = ui.dlg.d;
      if (!d.confirmDel && ui.dlg.dirty) {
        const original = JSON.parse(ui.dlg.initial);
        original.confirmDel = true;
        askDiscardDialog(createDialog('recur', original));
        return;
      }
      if (!d.confirmDel) {
        d.confirmDel = true;
        ui.dlg.dirty = false;
        render();
        return;
      }
      const recurring = recById(d.id);
      if (!recurring) return dlgClose();
      const pendingTransactions = S.finance.tx.filter(
        (transaction) => transaction.recId === d.id && !isPaid(transaction) && transaction.date >= today(),
      );
      const records = [
        createTrashRecord('finance.recurring', recurring.id, S.finance.recurring.indexOf(recurring), recurring),
        ...pendingTransactions.map((transaction) =>
          createTrashRecord('finance.tx', transaction.id, S.finance.tx.indexOf(transaction), transaction),
        ),
      ];
      const entry = moveRecordsToTrash(
        `Fixa financeira: ${recurring.desc || recurring.category}`,
        records,
        ['finance'],
        () => {
          S.finance.recurring = recList().filter((item) => item.id !== recurring.id);
          const ids = new Set(pendingTransactions.map((transaction) => transaction.id));
          S.finance.tx = S.finance.tx.filter((transaction) => !ids.has(transaction.id));
          ui.dlg = null;
        },
      );
      if (entry) toast('Fixa movida para a lixeira.', 'action', () => restoreTrashEntry(entry.id));
    },
    'imp-apply': () => {
      const d = ui.dlg.d,
        ids = [];
      d.rows
        .filter((r) => r.on)
        .forEach((r, i) => {
          const id = newId();
          ids.push(id);
          const account = accById(d.accountId),
            paid = isCredit(account) || r.date <= today();
          S.finance.tx.push({
            id,
            type: r.kind,
            accountId: d.accountId,
            category: r.cat,
            desc: r.desc,
            cents: r.abs,
            date: r.date,
            ...(paid && account && !isCredit(account) ? { settledDate: r.date } : {}),
            paid,
            createdAt: Date.now() + i,
          });
        });
      const mo = d.rows
        .filter((r) => r.on)
        .map((r) => r.date)
        .sort()
        .pop();
      if (mo) ui.finMonth = mo.slice(0, 7);
      ui.dlg = null;
      commit('finance');
      toast(
        `${ids.length} ${plural(ids.length, 'lançamento importado', 'lançamentos importados')}${d.truncated ? '. O restante do arquivo não foi incluído; importe-o em partes.' : '.'}`,
        'action',
        () => {
          S.finance.tx = S.finance.tx.filter((t) => !ids.includes(t.id));
          commit('finance');
        },
      );
    },
  });
  Object.assign(FORMS, {
    'dlg-recur': () => {
      const d = ui.dlg.d,
        r = recById(d.id),
        cents = parseMoney(d.amount),
        day = Math.round(num(d.day));
      if (!r) return dlgClose();
      if (!(cents > 0)) return toast('Informe um valor maior que zero.', 'error');
      if (!(day >= 1 && day <= 31)) return toast('O dia deve ser de 1 a 31.', 'error');
      Object.assign(r, {
        desc: d.desc.trim().slice(0, 80),
        cents,
        day,
        category: d.category,
        accountId: d.accountId,
        paused: !!d.paused,
      });
      if (d.future)
        S.finance.tx.forEach((t) => {
          if (t.recId === r.id && !isPaid(t) && t.date >= today()) {
            const dim = new Date(Number(t.date.slice(0, 4)), Number(t.date.slice(5, 7)), 0).getDate();
            Object.assign(t, {
              desc: r.desc,
              cents,
              category: r.category,
              accountId: r.accountId,
              date: `${t.date.slice(0, 7)}-${pad(Math.min(day, dim))}`,
            });
          }
        });
      ui.dlg = null;
      genRecurring();
      commit('finance');
      toast('Fixa atualizada.', 'success');
    },
  });
  Object.assign(CHANGES, {
    'fin-import': async (el) => {
      const f = el.files && el.files[0];
      el.value = '';
      if (!f) return;
      if (f.size > 2 * 1024 * 1024) return toast('Arquivo grande demais (máx. 2 MB).', 'error');
      if (!S.finance.accounts.length) return toast('Crie uma conta antes de importar.', 'info');
      let text = '';
      try {
        text = await f.text();
      } catch (e) {
        return toast('Não consegui ler o arquivo.', 'error');
      }
      let parseStatement;
      try {
        ({ parseStatement, statementDuplicateStatus } = await import('../features/finance/statement.js'));
      } catch (error) {
        console.error('Aurora: não foi possível carregar a leitura de extratos.', error);
        toast('Não foi possível preparar a leitura do extrato. Tente novamente.', 'info');
        return;
      }
      const parsed = parseStatement(text, f.name);
      if (!parsed.transactions.length)
        return toast('Não encontrei lançamentos. Use CSV (data, descrição, valor) ou OFX.', 'error');
      const acc = S.finance.accounts.find((a) => !isCredit(a)) || S.finance.accounts[0],
        d = {
          file: f.name.slice(0, 40),
          accountId: acc.id,
          invert: false,
          truncated: parsed.truncated,
          rows: parsed.transactions.map((r) => ({ ...r, on: true })),
        };
      impRecalc(d, true);
      dlgOpen('impfin', d);
    },
  });
  Object.assign(CHANGES, {
    'cmp-a': (el) => {
      ui.cmpA = el.value;
      ui.cmpB = ui.cmpB && ui.cmpB !== el.value ? ui.cmpB : shiftMonth(el.value, -1);
      render();
    },
    'cmp-b': (el) => {
      ui.cmpB = el.value;
      render();
    },
  });
}
