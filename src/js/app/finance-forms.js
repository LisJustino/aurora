import { h } from '../utils/dom.js';
import { parseMoney } from '../utils/currency.js';
import { isDay, today, pk, addMonths } from '../utils/dates.js';
import { newId } from '../utils/ids.js';
import { ACCOUNT_TYPES } from '../features/finance/accounts.js';
import { ANNUAL_PLAN_LIMITS } from '../features/planning/annual-plan.js';
import { HABIT_TARGETS, MAX_COUNT_TARGET } from '../features/planning/goal-progress.js';
import { matchCategoryRule } from '../features/finance/category-rules.js';
import { normalizeBudgetSettings } from '../features/finance/budget-insights.js';
import { hexOk } from '../features/appearance/palettes.js';
import { plural, findBankByName, norm, OTHER_BANK, CAT_ICONS, categoryLeafName } from './core.js';
import { dlgClose, createDialog } from './dialogs.js';
import { anticipationCandidates, prepareTransactionDialogForAnother } from './finance-dialogs.js';
import { recList, genRecurring } from './finance-extras.js';
import { isCredit, accById, accountDisplayName, cardInfo, scheduledInvoicePrincipal } from './finance-view.js';
import { FORMS, CHANGES } from './forms.js';
import { resolveNew, listArr, findCategory, replaceCategoryReferences, addItem } from './onboarding.js';
import { snapshotSlices, saveSlicesWithRollback, commit, saveSlices } from './persistence.js';
import { render } from './render.js';
import { toast } from './samples-backup.js';
import { fieldError, money } from './shell.js';
import { S, ui, catNames, isSafeInteger } from './state.js';

export function registerFinanceForms() {
  Object.assign(FORMS, {
    'annual-intention': (form, data) => {
      const intention = String(data.get('intention') || '').trim();
      if (intention.length > ANNUAL_PLAN_LIMITS.intention) {
        return fieldError('A intenção precisa ter até 300 caracteres.', '#annual-intention');
      }
      const plans = S.settings.prefs.annualPlans;
      const snapshot = snapshotSlices(['settings']);
      const plan = plans[ui.annualYear] || { intention: '', goals: [] };
      plan.intention = intention;
      plans[ui.annualYear] = plan;
      if (saveSlicesWithRollback(['settings'], snapshot)) toast('Intenção salva para o ano.', 'success');
    },
    'annual-goal-save': (form, data) => {
      const title = String(data.get('title') || '').trim();
      const action = String(data.get('action') || '').trim();
      const quarter = String(data.get('quarter') || '');
      if (!title || title.length > ANNUAL_PLAN_LIMITS.goalTitle) {
        return fieldError('Informe uma conquista com até 120 caracteres.', '[name="title"]');
      }
      if (action.length > ANNUAL_PLAN_LIMITS.goalAction) {
        return fieldError('O primeiro passo precisa ter até 280 caracteres.', '[name="action"]');
      }
      if (!['', 'q1', 'q2', 'q3', 'q4'].includes(quarter)) {
        return fieldError('Escolha um período válido.', '[name="quarter"]');
      }
      const habitId = String(data.get('habitId') || '');
      const countTarget = String(data.get('countTarget') || '').trim();
      if (habitId && countTarget)
        return fieldError('Escolha só uma forma de acompanhar: um hábito ou uma contagem.', '[name="countTarget"]');
      if (habitId && !S.habits.some((habit) => habit.id === habitId))
        return fieldError('Escolha um hábito válido.', '[name="habitId"]');
      const targetPct = Number(data.get('targetPct') || 80);
      if (habitId && !HABIT_TARGETS.includes(targetPct))
        return fieldError('Escolha uma meta válida para o hábito.', '[name="targetPct"]');
      const countValue = countTarget ? Number(countTarget) : 0;
      if (countTarget && (!Number.isInteger(countValue) || countValue < 1 || countValue > MAX_COUNT_TARGET)) {
        return fieldError('Informe uma contagem inteira entre 1 e 100.000.', '[name="countTarget"]');
      }
      const snapshot = snapshotSlices(['settings']);
      const plans = S.settings.prefs.annualPlans;
      const plan = plans[ui.annualYear] || { intention: '', goals: [] };
      const goal = form.dataset.id ? plan.goals.find((item) => item.id === form.dataset.id) : null;
      if (form.dataset.id && !goal) return toast('Esta conquista não está mais disponível.', 'info');
      if (!goal && plan.goals.length >= ANNUAL_PLAN_LIMITS.goals) {
        return toast('Este ano já tem o limite de conquistas. Remova uma antes de adicionar outra.', 'warning');
      }
      const previousCount = goal?.track?.kind === 'count' ? goal.track.current : 0;
      const track = habitId
        ? { kind: 'habit', habitId, targetPct }
        : countTarget
          ? { kind: 'count', target: countValue, current: previousCount }
          : null;
      if (goal) {
        Object.assign(goal, { title, action, quarter });
        if (track) goal.track = track;
        else delete goal.track;
      } else plan.goals.push({ id: newId(), title, action, quarter, done: false, ...(track ? { track } : {}) });
      plans[ui.annualYear] = plan;
      if (saveSlicesWithRollback(['settings'], snapshot)) {
        ui.annualEditingGoalId = '';
        ui.annualGoalFormOpen = false;
        ui.annualGoalDraft = null;
        render();
        toast(goal ? 'Conquista atualizada.' : 'Conquista adicionada ao plano.', 'success');
      }
    },
    'dlg-txanticipate': () => {
      const d = ui.dlg.d,
        eligible = anticipationCandidates(d.groupId, d.fromDate);
      const selectedIds = new Set(
        Array.from(document.querySelectorAll('#dlg [data-advance-id]:checked')).map((input) => input.dataset.advanceId),
      );
      const selected = eligible.filter((transaction) => selectedIds.has(transaction.id));
      if (!isDay(d.date) || d.date > today())
        return fieldError('Informe uma data válida de antecipação, até hoje.', '[data-dlg="date"]');
      if (!selected.length || selected.length !== selectedIds.size)
        return toast('Selecione uma ou mais parcelas disponíveis.', 'error');
      const card = isCredit(accById(selected[0].accountId));
      const previous = selected.map((transaction) => ({
        transaction,
        paid: Object.hasOwn(transaction, 'paid') ? transaction.paid : undefined,
        settledDate: Object.hasOwn(transaction, 'settledDate') ? transaction.settledDate : undefined,
        anticipatedDate: Object.hasOwn(transaction, 'anticipatedDate') ? transaction.anticipatedDate : undefined,
      }));
      selected.forEach((transaction) => {
        transaction.anticipatedDate = d.date;
        if (!card) {
          transaction.paid = true;
          transaction.settledDate = d.date;
        }
      });
      ui.dlg = null;
      commit('finance');
      toast(
        `${selected.length} ${plural(selected.length, 'parcela antecipada', 'parcelas antecipadas')}.`,
        'action',
        () => {
          previous.forEach(({ transaction, paid, settledDate, anticipatedDate }) => {
            if (paid === undefined) delete transaction.paid;
            else transaction.paid = paid;
            if (settledDate === undefined) delete transaction.settledDate;
            else transaction.settledDate = settledDate;
            if (anticipatedDate === undefined) delete transaction.anticipatedDate;
            else transaction.anticipatedDate = anticipatedDate;
          });
          commit('finance');
        },
      );
    },
    'dlg-tx': () => {
      const d = ui.dlg.d,
        continueAfterSave = !ui.dlg.d.id && ui.dlg.d.continueAfterSave === true;
      delete d.continueAfterSave;
      const cents = parseMoney(d.amount),
        tr = d.kind === 'tr',
        acc = accById(d.accountId);
      if (!(cents > 0)) return fieldError('Informe um valor maior que zero.', '[data-dlg="amount"]');
      if (!['out', 'in', 'tr'].includes(d.kind)) return toast('Escolha um tipo de lançamento válido.', 'info');
      if (!tr && !resolveNew(d.kind === 'in' ? 'in' : 'out', d, 'category')) return;
      if (!acc) return toast('Escolha uma conta.', 'info');
      if (tr && (!d.toAccountId || d.toAccountId === d.accountId))
        return toast('Escolha duas contas diferentes.', 'info');
      if (!isDay(d.date)) return toast('Informe a data.', 'error');
      if (tr && d.date > today())
        return toast('Uma transferência futura não pode ser registrada como realizada.', 'error');
      if (!tr && !isCredit(acc) && d.date > today() && d.paid)
        return toast('Para um lançamento futuro, desmarque a opção de pagamento realizado.', 'info');
      if (!tr && !isCredit(acc) && d.paid && (!isDay(d.settledDate) || d.settledDate > today())) {
        return toast('Informe uma data válida de pagamento ou recebimento, até hoje.', 'error');
      }
      if (!d.id && d.repeat === 'parcel') {
        const currentInstallment = Number(d.currentInstallment),
          totalInstallments = Number(d.times),
          installmentAmountMode = d.installmentAmountMode || 'total';
        if (!Number.isInteger(totalInstallments) || totalInstallments < 2 || totalInstallments > 60)
          return toast('Informe um total entre 2 e 60 parcelas.', 'error');
        if (!Number.isInteger(currentInstallment) || currentInstallment < 1 || currentInstallment > totalInstallments)
          return toast('A parcela atual deve estar entre 1 e o total de parcelas.', 'info');
        if (!['total', 'installment'].includes(installmentAmountMode))
          return toast('Escolha como informar o valor do parcelamento.', 'info');
        if (installmentAmountMode === 'total' && cents < totalInstallments) {
          return fieldError('O valor total precisa ser de pelo menos R$ 0,01 por parcela.', '[data-dlg="amount"]');
        }
      }
      const totalInstallments = d.repeat === 'parcel' ? Number(d.times) : 1;
      const firstInstallment = d.repeat === 'parcel' ? Number(d.currentInstallment) : 1;
      const interestInput =
        d.kind === 'out' && (d.id ? d.groupId : d.repeat === 'parcel') ? String(d.interest || '').trim() : '';
      const interestCents = interestInput ? parseMoney(interestInput) : undefined;
      const installmentCents =
        d.repeat === 'parcel' && d.installmentAmountMode !== 'installment'
          ? Math.floor(cents / totalInstallments) + (firstInstallment === 1 ? cents % totalInstallments : 0)
          : cents;
      if (
        interestInput &&
        (!Number.isSafeInteger(interestCents) || interestCents < 0 || interestCents > installmentCents)
      ) {
        return fieldError('Informe juros válidos, entre zero e o valor da parcela.', '[data-dlg="interest"]');
      }
      const matchedRule =
        !d.id && !d.categoryTouched && !tr
          ? matchCategoryRule(d.desc, d.kind, S.settings.prefs.financeCategoryRules)
          : null;
      const category =
        matchedRule && catNames(d.kind).includes(matchedRule.category) ? matchedRule.category : d.category;
      const base = {
        type: d.kind,
        accountId: d.accountId,
        category: tr ? 'Transferência' : category,
        desc: d.desc.trim().slice(0, 80),
      };
      if (tr) base.toAccountId = d.toAccountId;
      const paid = tr || isCredit(acc) ? true : !!d.paid;
      const settledDate = !tr && !isCredit(acc) && paid ? d.settledDate : '';
      if (d.id) {
        const t = S.finance.tx.find((x) => x.id === d.id);
        if (!t) return dlgClose();
        Object.assign(t, base, { cents, date: d.date, paid });
        if (!tr) delete t.toAccountId;
        if (base.type === 'out' && d.groupId && interestCents !== undefined) t.interestCents = interestCents;
        else delete t.interestCents;
        if (base.type !== 'out' || (!isCredit(acc) && !paid)) delete t.anticipatedDate;
        if (settledDate) t.settledDate = settledDate;
        else delete t.settledDate;
        ui.finMonth = d.date.slice(0, 7);
        ui.dlg = null;
        commit('finance');
        return toast('Lançamento atualizado.', 'success');
      }
      if (d.repeat === 'fixed' && !tr) {
        const r = {
          id: newId(),
          type: d.kind,
          accountId: d.accountId,
          category: base.category,
          desc: base.desc,
          cents,
          day: pk(d.date).getDate(),
          startYM: d.date.slice(0, 7),
          lastYM: null,
          firstPaid: paid,
        };
        recList().push(r);
        genRecurring();
        ui.finMonth = d.date.slice(0, 7);
        if (continueAfterSave) {
          prepareTransactionDialogForAnother(d, base.category);
          commit('finance');
          toast('Fixa criada. Você já pode cadastrar outra.', 'success');
          return;
        }
        ui.dlg = null;
        commit('finance');
        toast('Fixa criada. Os próximos meses aparecem sozinhos.', 'success');
        return;
      }
      const installmentsToCreate = totalInstallments - firstInstallment + 1;
      const gid = totalInstallments > 1 ? newId() : undefined;
      for (let offset = 0; offset < installmentsToCreate; offset++) {
        const installmentNumber = firstInstallment + offset;
        const part =
          d.repeat === 'parcel'
            ? d.installmentAmountMode === 'installment'
              ? cents
              : Math.floor(cents / totalInstallments) +
                (installmentNumber === 1 ? cents - Math.floor(cents / totalInstallments) * totalInstallments : 0)
            : cents;
        const installmentDate = addMonths(d.date, offset);
        const installmentPaid = isCredit(acc) ? true : offset === 0 ? paid : false;
        S.finance.tx.push({
          id: newId(),
          ...base,
          cents: part,
          date: installmentDate,
          paid: installmentPaid,
          ...(!isCredit(acc) && installmentPaid ? { settledDate: offset === 0 ? settledDate : installmentDate } : {}),
          ...(interestCents !== undefined ? { interestCents: offset === 0 ? interestCents : 0 } : {}),
          createdAt: Date.now() + offset,
          ...(totalInstallments > 1
            ? { groupId: gid, desc: `${base.desc || base.category} (${installmentNumber}/${totalInstallments})` }
            : {}),
        });
      }
      ui.finMonth = d.date.slice(0, 7);
      if (continueAfterSave) {
        prepareTransactionDialogForAnother(d, base.category);
        commit('finance');
        toast(
          installmentsToCreate > 1
            ? `${installmentsToCreate} lançamentos criados. Você já pode cadastrar outro.`
            : 'Lançamento adicionado. Você já pode cadastrar outro.',
          'success',
        );
        return;
      }
      ui.dlg = null;
      commit('finance');
      toast(
        installmentsToCreate > 1 ? `${installmentsToCreate} lançamentos criados.` : 'Lançamento adicionado.',
        'success',
      );
    },
    'dlg-account': () => {
      const d = ui.dlg.d,
        name = d.name.trim(),
        current = d.id ? accById(d.id) : null;
      if (!name) return toast('Dê um nome à conta.', 'info');
      if (!Object.hasOwn(ACCOUNT_TYPES, d.type) || (d.id && !current))
        return toast('Confira o tipo e a conta selecionados.', 'warning');
      const linkedAccount = d.type === 'credit' && d.linkedAccountId ? accById(d.linkedAccountId) : null;
      if (d.type === 'credit' && d.linkedAccountId && (!linkedAccount || isCredit(linkedAccount)))
        return toast('Escolha uma conta válida para pagar a fatura.', 'info');
      const bankName = String(d.bank || '')
        .trim()
        .slice(0, 40);
      const knownBank = findBankByName(bankName);
      const bank = norm(bankName) === norm('Outro / não listado') ? OTHER_BANK : knownBank ? knownBank[0] : bankName;
      const bal = d.balance.trim() ? parseMoney(d.balance) : 0,
        lim = d.limit && d.limit.trim() ? parseMoney(d.limit) : 0;
      if (!Number.isSafeInteger(bal) || !Number.isSafeInteger(lim) || lim < 0)
        return toast('Confira os valores digitados. Use valores em reais, como 1.234,56.', 'warning');
      const cl = d.closing.trim() ? Number(d.closing) : 0,
        du = d.due.trim() ? Number(d.due) : 0;
      if (
        d.type === 'credit' &&
        ((d.closing.trim() && (!Number.isInteger(cl) || cl < 1 || cl > 31)) ||
          (d.due.trim() && (!Number.isInteger(du) || du < 1 || du > 31)))
      )
        return toast('Os dias de fechamento e vencimento devem ser números inteiros de 1 a 31.', 'info');
      const patch = {
        name: accountDisplayName({ name: name.slice(0, 40), bank }),
        type: d.type,
        bank,
        initialCents: d.id ? current.initialCents + (bal - (d.cur0 || 0)) : bal,
        limitCents: d.type === 'credit' && lim > 0 ? lim : 0,
        closingDay: d.type === 'credit' && cl >= 1 && cl <= 31 ? cl : 0,
        dueDay: d.type === 'credit' && du >= 1 && du <= 31 ? du : 0,
      };
      if (linkedAccount) patch.linkedAccountId = linkedAccount.id;
      if (d.id) {
        Object.assign(current, patch);
        if (d.type === 'credit' && !linkedAccount) delete current.linkedAccountId;
      } else S.finance.accounts.push({ id: newId(), ...patch });
      ui.dlg = null;
      commit('finance');
    },
    'dlg-budget': () => {
      const d = ui.dlg.d,
        c = parseMoney(d.limit);
      if (!(c > 0)) return toast('Informe um limite maior que zero.', 'error');
      Object.defineProperty(S.finance.budgets, d.cat, {
        value: { cents: c },
        enumerable: true,
        writable: true,
        configurable: true,
      });
      S.settings.prefs.financeBudgetSettings = normalizeBudgetSettings({
        ...S.settings.prefs.financeBudgetSettings,
        [d.cat]: { alertPct: Number(d.alertPct), pinned: d.pinned === true },
      });
      ui.dlg = null;
      commit('finance', 'settings');
    },
    'dlg-category': () => {
      const d = ui.dlg.d,
        name = String(d.name || '')
          .trim()
          .slice(0, 30),
        parentName = String(d.parent || '').trim();
      if (d.kind !== 'out' && d.kind !== 'in') return toast('Escolha um tipo de categoria válido.', 'info');
      const transactionDialog = d.fromTransaction ? ui.categoryReturnDialog : null;
      if (
        d.fromTransaction &&
        (transactionDialog?.type !== 'tx' || (transactionDialog.d.kind === 'in' ? 'in' : 'out') !== d.kind)
      ) {
        return toast('Não foi possível retornar ao lançamento. Feche esta janela e tente novamente.', 'info');
      }
      if (!name) return toast('Informe o nome da categoria.', 'error');
      if (!CAT_ICONS.includes(d.icon) || !hexOk(d.color)) return toast('Escolha um ícone e uma cor válidos.', 'info');
      const parentEntry = parentName
        ? listArr(d.kind).find((category) => norm(category.name) === norm(parentName))
        : null;
      if (parentName && !parentEntry) return toast('Escolha uma categoria pai válida.', 'info');
      const existing = d.editName ? findCategory(d.kind, d.editName, parentName) : null;
      if (d.editName && !existing) return toast('Não foi possível localizar essa categoria.', 'info');
      const siblings = parentEntry ? parentEntry.subcategories || [] : listArr(d.kind);
      const duplicate = siblings.some(
        (category) =>
          category !== existing && norm(parentEntry ? categoryLeafName(category) : category.name) === norm(name),
      );
      if (duplicate) return toast('Já existe uma categoria com esse nome.', 'info');
      const financeChanges = [];
      let addedPath = '';
      if (existing) {
        const oldName = categoryLeafName(existing);
        const oldPath = parentName ? `${parentName} > ${oldName}` : oldName;
        const newPath = parentName ? `${parentName} > ${name}` : name;
        const paths = [[oldPath, newPath]];
        if (!parentName) {
          (existing.subcategories || []).forEach((subcategory) => {
            const child = categoryLeafName(subcategory);
            paths.push([`${oldName} > ${child}`, `${name} > ${child}`]);
          });
        }
        if (paths.some(([oldValue, newValue]) => oldValue !== newValue && Object.hasOwn(S.finance.budgets, newValue))) {
          return toast(
            'Já existe um limite com o novo nome. Ajuste esse limite antes de renomear a categoria.',
            'info',
          );
        }
        existing.name = name;
        existing.color = d.color;
        existing.icon = d.icon;
        paths.forEach(([oldValue, newValue]) => {
          const changed = replaceCategoryReferences(oldValue, newValue);
          if (changed === null) financeChanges.push(false);
          else if (changed) financeChanges.push(true);
        });
      } else {
        addedPath = addItem(d.kind, name, parentName, d.color, d.icon);
      }
      if (d.fromTransaction) {
        if (!addedPath)
          return toast('Não foi possível adicionar a categoria. Confira os dados e tente novamente.', 'warning');
        transactionDialog.d.category = addedPath;
        transactionDialog.d.categoryTouched = true;
        transactionDialog.dirty = true;
        ui.categoryReturnDialog = null;
        ui.dlg = transactionDialog;
        commit('settings');
        toast('Categoria adicionada e selecionada no lançamento.', 'success');
        return;
      }
      ui.dlg = createDialog('category-manager', {});
      commit(...(financeChanges.includes(true) ? ['settings', 'finance'] : ['settings']));
      toast(existing ? 'Categoria atualizada.' : 'Categoria adicionada.', 'success');
    },
    'dlg-goal': () => {
      const d = ui.dlg.d,
        name = d.name.trim(),
        target = parseMoney(d.target);
      const linkedAccount = d.linkedAccountId ? accById(d.linkedAccountId) : null;
      const saved = d.linkedAccountId ? 0 : d.saved.trim() ? parseMoney(d.saved) : 0;
      if (!name || name.length > 50) return fieldError('Informe um nome com até 50 caracteres.', '[data-dlg="name"]');
      if (!Number.isSafeInteger(target) || target <= 0)
        return fieldError('Informe um valor maior que zero.', '[data-dlg="target"]');
      if (!d.linkedAccountId && (!Number.isSafeInteger(saved) || saved < 0)) {
        return fieldError('Informe um valor válido, igual ou maior que zero.', '[data-dlg="saved"]');
      }
      if (d.deadline && !isDay(d.deadline)) return fieldError('Informe um prazo válido.', '[data-dlg="deadline"]');
      if (d.linkedAccountId && (!linkedAccount || isCredit(linkedAccount))) {
        return fieldError('Escolha uma conta disponível, sem ser cartão de crédito.', '[data-dlg="linkedAccountId"]');
      }
      if (
        d.linkedAccountId &&
        S.finance.goals.some((goal) => goal.id !== d.id && goal.linkedAccountId === d.linkedAccountId)
      ) {
        return fieldError(
          'Esta conta já acompanha outro objetivo. Escolha outra ou desvincule-a primeiro.',
          '[data-dlg="linkedAccountId"]',
        );
      }
      const values = {
        name,
        targetCents: target,
        savedCents: linkedAccount
          ? d.id
            ? (S.finance.goals.find((goal) => goal.id === d.id)?.savedCents ?? 0)
            : 0
          : saved,
        ...(linkedAccount ? { linkedAccountId: linkedAccount.id } : {}),
        deadline: d.deadline || '',
      };
      if (d.id) {
        const goal = S.finance.goals.find((item) => item.id === d.id);
        if (!goal) return toast('Objetivo não encontrado.', 'info');
        Object.assign(goal, values);
        if (!linkedAccount) delete goal.linkedAccountId;
      } else S.finance.goals.push({ id: newId(), ...values });
      ui.dlg = null;
      commit('finance');
    },
    'dlg-deposit': () => {
      const d = ui.dlg.d,
        goal = S.finance.goals.find((item) => item.id === d.id),
        amount = parseMoney(d.amount);
      if (!goal) return toast('Objetivo não encontrado.', 'info');
      if (!Number.isSafeInteger(amount) || amount === 0)
        return fieldError('Informe um valor diferente de zero.', '[data-dlg="amount"]');
      const total = goal.savedCents + amount;
      if (!Number.isSafeInteger(total)) return fieldError('Informe um valor menor.', '[data-dlg="amount"]');
      goal.savedCents = Math.max(0, total);
      ui.dlg = null;
      const saved = saveSlices('finance');
      render();
      if (saved) toast(amount > 0 ? 'Valor guardado.' : 'Valor retirado.', 'info');
    },
    'dlg-payinv': () => {
      const d = ui.dlg.d,
        cents = parseMoney(d.amount),
        card = accById(d.cardId),
        source = accById(d.from);
      if (!Number.isSafeInteger(cents) || cents <= 0) return toast('Informe um valor maior que zero.', 'error');
      if (!card || !isCredit(card) || !source || isCredit(source) || source.id === card.id)
        return toast('Escolha um cartão e uma conta de origem válidos.', 'info');
      const outstanding = cardInfo(card).used;
      if (outstanding <= 0) return toast('Este cartão não tem valores em aberto.', 'info');
      if (d.mode === 'installments') {
        const times = Number(d.times),
          interestCents = parseMoney(d.interest);
        const available = Math.max(0, outstanding - scheduledInvoicePrincipal(card.id));
        if (!Number.isInteger(times) || times < 2 || times > 60) return toast('Informe de 2 a 60 parcelas.', 'error');
        if (!isSafeInteger(interestCents) || interestCents < 0)
          return toast('Informe um valor válido de juros por parcela.', 'error');
        if (!isDay(d.firstDueDate) || d.firstDueDate < today())
          return toast('Informe o vencimento de hoje ou de uma data futura.', 'error');
        if (cents > available)
          return toast(
            h`O valor a parcelar não pode ultrapassar ${money(available)} (saldo em aberto descontadas outras parcelas programadas).`,
            'info',
          );
        const groupId = newId(),
          baseCents = Math.floor(cents / times),
          remainder = cents % times;
        const plan = Array.from({ length: times }, (_, index) => {
          const principalPart = baseCents + (index === 0 ? remainder : 0);
          const installmentCents = principalPart + interestCents;
          if (!isSafeInteger(installmentCents) || installmentCents <= 0) return null;
          return {
            id: newId(),
            type: 'tr',
            accountId: source.id,
            toAccountId: card.id,
            cents: installmentCents,
            interestCents,
            category: 'Transferência',
            desc: `Fatura parcelada (${index + 1}/${times})`,
            date: addMonths(d.firstDueDate, index),
            paid: false,
            invoiceInstallment: true,
            groupId,
            createdAt: Date.now() + index,
          };
        });
        if (plan.some((transaction) => !transaction || !isDay(transaction.date))) {
          return toast('Não foi possível gerar as datas ou os valores das parcelas. Revise os dados.', 'info');
        }
        S.finance.tx.push(...plan);
        ui.finMonth = plan[0].date.slice(0, 7);
        ui.dlg = null;
        commit('finance');
        const total = plan.reduce((sum, transaction) => sum + transaction.cents, 0);
        return toast(
          h`${times} parcelas programadas, totalizando ${money(total)}. O saldo da conta não foi alterado.`,
          'info',
        );
      }
      if (d.mode !== 'single') return toast('Escolha uma forma de pagamento válida.', 'info');
      if (cents > outstanding)
        return toast(h`O pagamento não pode ultrapassar o valor em aberto de ${money(outstanding)}.`, 'info');
      S.finance.tx.push({
        id: newId(),
        type: 'tr',
        accountId: source.id,
        toAccountId: card.id,
        cents,
        category: 'Transferência',
        desc: 'Pagamento da fatura',
        date: today(),
        paid: true,
        createdAt: Date.now(),
      });
      ui.dlg = null;
      commit('finance');
      toast('Pagamento registrado.', 'success');
    },
  });
  Object.assign(CHANGES, {
    'fin-cat': (el) => {
      ui.finCat = el.value;
      render();
    },
    'fin-acc': (el) => {
      ui.finAcc = el.value;
      render();
    },
    'rep-acc': (el) => {
      ui.repAcc = el.value;
      render();
    },
    'rep-cat': (el) => {
      ui.repCat = el.value;
      render();
    },
  });
}
