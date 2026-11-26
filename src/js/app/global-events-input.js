import { $ } from '../utils/dom.js';
import { formatMoneyInput, parseMoney } from '../utils/currency.js';
import { today, longDate } from '../utils/dates.js';
import { linkedGoalProgressCents } from '../features/finance/calculations.js';
import { filterWeightInput } from '../features/profile/weight.js';
import { HOME_MESSAGE_MAX_LENGTH } from '../features/home/personalization.js';
import { parseQuickDate } from '../features/planning/quick-date.js';
import { LIST_COLORS, OTHER_BANK, findBankByName } from './core.js';
import { createDialog, setPath, updateWaterSuggestionWeight, globalSearchResults } from './dialogs.js';
import { moneyIn, invoicePlanPreviewText } from './finance-dialogs.js';
import { impRecalc } from './finance-extras.js';
import { accById, txListHtml } from './finance-view.js';
import { SETTINGS_INPUT_CHANGES, CHANGES } from './forms.js';
import { updateHabitIdeaFilters } from './habits.js';
import { listArr } from './onboarding.js';
import { taskListHtml, updateAnnualIdeaFilters } from './planning.js';
import { render } from './render.js';
import { firstName, profileDraftFromSettings, profileDraftHasChanges } from './settings.js';
import { profileGreeting } from './shell.js';
import { ui, S, scheduleProfileAutosave, categoryMatch } from './state.js';

export function registerInputEvents() {
  document.addEventListener('input', (e) => {
    const el = e.target;
    if (el.matches('[data-change="home-message"]')) {
      const counter = $('#home-message-count');
      if (counter) counter.textContent = `${el.value.length}/${HOME_MESSAGE_MAX_LENGTH}`;
    }
    if (el instanceof HTMLInputElement && el.matches('.money-input')) {
      const formattedValue = formatMoneyInput(el.value);
      if (formattedValue !== el.value) {
        el.value = formattedValue;
        el.setSelectionRange(formattedValue.length, formattedValue.length);
      }
    }
    if (el.matches('[data-dlg="waterWeightKg"]')) {
      const value = el.value;
      const cursor = el.selectionStart;
      const filteredValue = filterWeightInput(value);
      if (filteredValue !== value) {
        el.value = filteredValue;
        if (cursor !== null) {
          const filteredCursor = filterWeightInput(value.slice(0, cursor)).length;
          el.setSelectionRange(filteredCursor, filteredCursor);
        }
      }
    }
    if (el.matches('[data-dlg="log.weightKg"], [data-dlg="weightKg"]')) {
      const value = el.value;
      const cursor = el.selectionStart;
      const filteredValue = filterWeightInput(value);
      if (filteredValue !== value) {
        el.value = filteredValue;
        if (cursor !== null) {
          const filteredCursor = filterWeightInput(value.slice(0, cursor)).length;
          el.setSelectionRange(filteredCursor, filteredCursor);
        }
      }
    }
    if (el.matches('[data-dlg="entryOptions"]') && ui.dlg?.d) {
      ui.dlg.d.entryOptions = el.value
        .split('\n')
        .map((option) => option.trim())
        .filter(Boolean);
    }
    const changeKey = el.dataset && el.dataset.change;
    if (SETTINGS_INPUT_CHANGES.has(changeKey) && CHANGES[changeKey]) CHANGES[changeKey](el);
    const isTransactionCategoryField = ui.dlg?.type === 'tx' && ['category', 'subcategory'].includes(el.dataset?.dlg);
    const opensCategoryDialog = isTransactionCategoryField && el.value === '__new';
    if (isTransactionCategoryField && !opensCategoryDialog) ui.dlg.d.categoryTouched = true;
    if (
      ui.dlg &&
      ui.dlg.type !== 'search' &&
      !opensCategoryDialog &&
      el instanceof Element &&
      el.closest('#dlg') &&
      el.matches('input:not([type="file"]),textarea,select')
    )
      ui.dlg.dirty = true;
    if (el.dataset.profileField && ['name', 'preferredName', 'sex', 'age'].includes(el.dataset.profileField)) {
      const preferredInput = $('#ppreferred');
      if (el.dataset.profileField === 'name' && preferredInput && !preferredInput.value.trim()) {
        preferredInput.value = firstName(el.value || '');
      }
      const draft = {
        name: $('#pname')?.value || '',
        preferredName: preferredInput?.value || '',
        sex: $('#psex')?.value || '',
        age: $('#page')?.value || '',
        appearance: ui.profileDraft?.appearance || profileDraftFromSettings(S.settings).appearance,
      };
      ui.profileDraft = profileDraftHasChanges(draft, S.settings.profile, S.settings.prefs.profileAppearance)
        ? draft
        : null;
      scheduleProfileAutosave();
      const previewName = $('#profile-preview-name');
      if (previewName) previewName.textContent = draft.preferredName.trim() || draft.name.trim() || 'seu nome';
      const previewGreeting = $('#profile-preview-greeting');
      if (previewGreeting) previewGreeting.textContent = profileGreeting(draft.appearance.greeting);
    }
    if (el.dataset.dlg && ui.dlg) {
      if (ui.dlg.type === 'tx' && opensCategoryDialog) {
        const kind = ui.dlg.d.kind === 'in' ? 'in' : 'out';
        const selectedParent =
          el.dataset.dlg === 'subcategory' ? categoryMatch(kind, ui.dlg.d.category)?.category : null;
        ui.categoryReturnDialog = ui.dlg;
        ui.dlg = createDialog('category-new', {
          kind,
          ...(selectedParent ? { parent: selectedParent.name } : {}),
          name: '',
          icon: selectedParent?.icon || 'tag',
          color: selectedParent?.color || LIST_COLORS[listArr(kind).length % LIST_COLORS.length],
          fromTransaction: true,
        });
        render();
        return;
      }
      if (ui.dlg.type === 'tx' && el.dataset.dlg === 'subcategory') {
        const kind = ui.dlg.d.kind === 'in' ? 'in' : 'out';
        const parentName = categoryMatch(kind, ui.dlg.d.category)?.category.name || ui.dlg.d.category;
        ui.dlg.d.category = el.value ? `${parentName} > ${el.value}` : parentName;
        ui.dlg.dirty = true;
        render();
        return;
      }
      if (ui.dlg.type === 'habit-edit' && ui.dlg.d.waterSuggestion && el.dataset.dlg === 'waterGoalMl') {
        ui.dlg.d.waterGoalEdited = true;
      }
      if (
        ui.dlg.type === 'goal' &&
        el.dataset.dlg === 'linkedAccountId' &&
        ui.dlg.d.linkedAccountId &&
        ui.dlg.d.linkedAccountId !== el.value
      ) {
        const previousAccount = accById(ui.dlg.d.linkedAccountId);
        if (previousAccount) {
          const previousProgress = linkedGoalProgressCents(
            {
              linkedAccountId: previousAccount.id,
              savedCents: parseMoney(ui.dlg.d.saved) || 0,
            },
            S.finance.accounts,
            S.finance.tx,
          );
          ui.dlg.d.saved = moneyIn(previousProgress);
        }
      }
      if (ui.dlg.type === 'account' && el.dataset.dlg === 'bankOption') {
        const bankInput = $('#dlg [data-dlg="bank"]');
        ui.dlg.d.bank = el.value === OTHER_BANK ? OTHER_BANK : el.value;
        if (bankInput instanceof HTMLInputElement) {
          bankInput.closest('.bank-custom-entry').hidden = el.value !== OTHER_BANK;
          bankInput.required = el.value === OTHER_BANK;
          if (el.value !== OTHER_BANK) bankInput.value = '';
        }
        const bank = findBankByName(el.value);
        const logo = $('#dlg [data-bank-preview-logo]');
        const fallback = $('#dlg [data-bank-preview-fallback]');
        if (logo && fallback) {
          if (bank) logo.querySelector('img').src = bank[1].logo;
          logo.hidden = !bank;
          fallback.hidden = Boolean(bank);
        }
        return;
      }
      setPath(ui.dlg.d, el.dataset.dlg, el.type === 'checkbox' ? el.checked : el.value);
      if (ui.dlg.type === 'account' && el.dataset.dlg === 'bank') {
        const bank = findBankByName(el.value, true);
        const logo = $('#dlg [data-bank-preview-logo]');
        const fallback = $('#dlg [data-bank-preview-fallback]');
        if (logo && fallback) {
          if (bank) logo.querySelector('img').src = bank[1].logo;
          logo.hidden = !bank;
          fallback.hidden = Boolean(bank);
        }
      }
      if (ui.dlg.type === 'payinv' && ['amount', 'times', 'interest'].includes(el.dataset.dlg)) {
        const preview = $('#dlg [data-pay-invoice-preview]');
        if (preview) preview.textContent = invoicePlanPreviewText(ui.dlg.d);
      }
      if (ui.dlg.type === 'habit-edit' && ui.dlg.d.waterSuggestion && el.dataset.dlg === 'waterWeightKg') {
        updateWaterSuggestionWeight(el.value);
      } else if (ui.dlg.type === 'search' && el.dataset.dlg === 'query') {
        const results = $('#global-search-results');
        if (results) results.innerHTML = globalSearchResults(el.value).s;
      } else if (ui.dlg.type === 'cycle-log' && el.dataset.dlg === 'log.sexualActivity') {
        if (!el.checked) ui.dlg.d.log.contraceptionMethods = [];
        render();
      } else if (ui.dlg.type === 'category-new' && el.dataset.dlg === 'parent') {
        render();
      } else if (
        [
          'sex',
          'accountId',
          'linkedAccountId',
          'repeat',
          'installmentAmountMode',
          'mode',
          'type',
          'tag',
          'category',
          'time',
          'invert',
          'paid',
        ].includes(el.dataset.dlg) ||
        el.dataset.dlg.startsWith('rows.')
      ) {
        if (ui.dlg.type === 'impfin' && (el.dataset.dlg === 'accountId' || el.dataset.dlg === 'invert'))
          impRecalc(ui.dlg.d, el.dataset.dlg === 'invert');
        render();
      }
    }
    if (el.id === 'home-quick-title-input') {
      const date = parseQuickDate(el.value, today());
      const preview = $('#home-quick-date-preview');
      if (preview)
        preview.textContent =
          date.error || `${date.date === today() ? 'Hoje' : longDate(date.date)}${date.time ? ` · ${date.time}` : ''}`;
      const submit = el.form?.querySelector('button[type="submit"]');
      if (submit) submit.disabled = !el.value.trim();
    }
    if (el.dataset.input === 'fin-search') {
      ui.finQ = el.value;
      const r = $('#tx-results');
      if (r) r.innerHTML = txListHtml().s;
    }
    if (el.dataset.input === 'search') {
      ui.filters.q = el.value;
      const r = $('#task-results');
      if (r) r.innerHTML = taskListHtml().s;
    }
    if (el.dataset.input === 'habit-ideas-search') {
      ui.habitIdeaQuery = el.value;
      updateHabitIdeaFilters();
    }
    if (el.dataset.input === 'annual-ideas-search') {
      ui.annualIdeaQuery = el.value;
      updateAnnualIdeaFilters();
    }
  });
}
