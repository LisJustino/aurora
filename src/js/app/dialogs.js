import { $, esc, h, raw } from '../utils/dom.js';
import { morphHtml } from '../utils/dom-morph.js';
import { icon } from '../utils/icons.js';
import { DIAS, isDay, pk, shortDate, today } from '../utils/dates.js';
import { newId } from '../utils/ids.js';
import { getPageScrollPosition, lockPageScroll } from '../utils/scroll-lock.js';
import { TASK_ICONS, taskIconKey } from '../features/planning/task-icons.js';
import { MAX_BULK_HABITS, parseBulkHabits } from '../features/habits/bulk-habits.js';
import { getReleaseNotes } from '../features/release-notes.js';
import { prefersReducedMotion } from '../utils/motion.js';
import {
  DEFAULT_HABIT_COLOR,
  DEFAULT_HABIT_ICON,
  HABIT_COLORS,
  HABIT_ICONS,
  habitEntryForDay,
  habitEntryOptions,
  habitEntryType,
  isWaterHabit,
  isWeightHabit,
} from '../features/habits/model.js';
import { estimateWaterGoal, parseWaterWeightKg, waterGoalForHabit } from '../features/habits/water-goal.js';
import { REPEATS } from '../features/planning/recurrence.js';
import { MAX_BULK_TASKS, parseBulkTasks } from '../features/planning/bulk-tasks.js';
import { searchRecords } from '../features/search/search.js';
import { finishOnboard } from './actions.js';
import { norm, plural } from './core.js';
import { CYC, cycLabel, hasAnyLog, isBleeding } from './cycle.js';
import { HABIT_COLOR_NAMES } from './habits.js';
import { homeFirstTaskSlices } from './home.js';
import { DLG } from './onboarding.js';
import { commit, saveSlices, saveSlicesWithRollback, snapshotSlices } from './persistence.js';
import { applyTheme, describeDialogOpener, prioOptions, render, restoreDialogOpener } from './render.js';
import { mkTask, toast } from './samples-backup.js';
import { relationalDataWipeScope } from './settings.js';
import { areaEmpty, areaOn, fieldError } from './shell.js';
import { maybeOpenReleaseNotes } from './startup.js';
import {
  allTags,
  currentProfileAge,
  cycleDialogViews,
  isValidCycleLog,
  S,
  settingsView,
  toastController,
  ui,
} from './state.js';

// Diálogos
function profileSetupDraft() {
  return {
    step: 0,
    needs: [],
    theme: S.settings.theme,
    originalAreas: { ...S.settings.areas },
    areas: { ...S.settings.areas },
    areaOverrides: {},
  };
}
export function profileSetupComplete() {
  return S.settings.onboardingComplete;
}
export function openProfileSetup() {
  if (profileSetupComplete() || ui.dlg?.type === 'onboard') return;
  ui.returnDialog = null;
  ui.dlg = createDialog('onboard', profileSetupDraft());
  render();
}
export const NON_EDITABLE_DIALOGS = new Set([
  'action-confirm',
  'account-delete',
  'acctdelete',
  'area-tutorial',
  'confirmation',
  'cycle-report',
  'discard',
  'export',
  'habit-other-day',
  'import',
  'installment-summary',
  'onboard',
  'recurlist',
  'release-notes',
  'search',
  'txdel',
  'wipe',
  'wipe-complete',
]);
export function dialogTracksDirty(dialog) {
  return Boolean(dialog && !NON_EDITABLE_DIALOGS.has(dialog.type));
}
export function createDialog(type, d) {
  return { type, d, dirty: false, initial: JSON.stringify(d) };
}
export function dialogDraftSnapshot(draft) {
  const value = { ...draft };
  ['confirm', 'confirmClear', 'confirmDel', 'error', 'step'].forEach((key) => {
    delete value[key];
  });
  return JSON.stringify(value);
}
export function askDiscardDialog(next = null, onDiscard = null) {
  const previous = ui.dlg;
  ui.dlgPending = { previous, next, onDiscard };
  ui.dlg = createDialog('discard', {});
  render();
}
export const dlgOpen = (type, d = {}) => {
  const next = createDialog(type, d);
  if (dialogTracksDirty(ui.dlg) && ui.dlg.dirty) {
    askDiscardDialog(next);
    return;
  }
  ui.dlg = next;
  // Avisos de confirmação (sem "Desfazer") escondem o título e os campos do diálogo; saem quando um diálogo abre.
  if (ui.toast && !ui.toast.undo && ['success', 'info'].includes(ui.toast.tone)) {
    toastController.clear();
  }
  render();
};
export function confirmInDialog(message) {
  if (ui.confirmResolver) {
    console.error('Aurora: já existe uma confirmação pendente.');
    return Promise.resolve(false);
  }
  if (dialogTracksDirty(ui.dlg) && ui.dlg.dirty) {
    console.error('Aurora: não é possível abrir uma confirmação durante uma edição pendente.');
    toast('Salve ou feche a edição antes de confirmar esta ação.', 'info');
    return Promise.resolve(false);
  }
  return new Promise((resolve) => {
    ui.confirmPrevious = ui.dlg;
    ui.confirmResolver = resolve;
    ui.dlg = createDialog('confirmation', { message });
    render();
  });
}
export function settleDialogConfirmation(confirmed) {
  const resolve = ui.confirmResolver;
  if (!resolve) return;
  ui.confirmResolver = null;
  ui.dlg = ui.confirmPrevious;
  ui.confirmPrevious = null;
  ui.dlgPending = null;
  render();
  resolve(confirmed);
}
export const CONFIRMABLE_ACTIONS = new Set([
  'annual-goal-delete',
  'appearance-reset',
  'clear-sample',
  'del-task',
  'cyc-clear',
  'cycle-clear-all',
  'cyc-period-delete',
  'goal-del',
  'habit-delete',
  'menu-reset',
  'trash-delete-permanent',
  'trash-empty',
  'trash-restore-all',
]);
export function requestActionConfirmation(action, data, title, message, confirmLabel = 'Confirmar') {
  if (!CONFIRMABLE_ACTIONS.has(action)) {
    console.error('Aurora: ação sem confirmação configurada.', action);
    toast('Não foi possível confirmar esta ação.', 'info');
    return;
  }
  ui.confirmPrevious = ui.dlg && !ui.dlg.dirty ? ui.dlg : null;
  dlgOpen('action-confirm', { action, data, title, message, confirmLabel });
}
export const dlgKeepEditing = () => {
  if (ui.dlg?.type !== 'discard' || !ui.dlgPending) return;
  ui.dlg = ui.dlgPending.previous;
  ui.dlgPending = null;
  render();
};
export const dlgDiscardChanges = () => {
  if (ui.dlg?.type !== 'discard') return;
  const pending = ui.dlgPending;
  ui.dlg = pending?.next || null;
  if (pending?.previous?.type === 'onboard') ui.returnDialog = null;
  ui.dlgPending = null;
  render();
  if (pending?.onDiscard) pending.onDiscard();
};
export const dlgClose = () => {
  if (ui.dlg?.type === 'account-delete' && ui.dlg.d.pending) return;
  if (ui.dlg?.type === 'category-new' && ui.dlg.d.fromTransaction) {
    const returnToTransaction = () => {
      const previous = ui.categoryReturnDialog;
      ui.categoryReturnDialog = null;
      ui.dlg = previous?.type === 'tx' ? previous : null;
      render();
    };
    if (ui.dlg.dirty) {
      askDiscardDialog(null, returnToTransaction);
      return;
    }
    returnToTransaction();
    return;
  }
  if (dialogTracksDirty(ui.dlg) && ui.dlg.dirty) {
    askDiscardDialog();
    return;
  }
  if (ui.dlg?.type === 'onboard') {
    finishOnboard(true);
    return;
  }
  if (ui.dlg?.type === 'area-tutorial') {
    const afterOnboarding = ui.dlg.d.afterOnboarding === true;
    ui.dlg = null;
    ui.dlgPending = null;
    render();
    if (afterOnboarding) void maybeOpenReleaseNotes();
    return;
  }
  if (ui.dlg?.type === 'confirmation') {
    settleDialogConfirmation(false);
    return;
  }
  if (ui.dlg?.type === 'action-confirm') {
    ui.dlg = ui.confirmPrevious;
    ui.confirmPrevious = null;
    render();
    return;
  }
  if (ui.dlg?.type === 'discard') {
    dlgKeepEditing();
    return;
  }
  ui.dlg = null;
  ui.dlgPending = null;
  render();
};
export const setPath = (o, p, v) => {
  const ks = p.split('.');
  const last = ks.pop();
  const t = ks.reduce((a, k) => a[k], o);
  t[last] = v;
};
export const dlgField = (label, inner, cls = '') =>
  h`<label class="f ${cls}"><span class="f-label">${label}</span>${inner}</label>`;
export const dlgWrap = (body, foot, bodyClass = '') =>
  h`<div class="dlg-body ${bodyClass}">${body}</div><div class="dlg-foot">${foot}</div>`;
export const closeBtn = h`<button type="button" class="ibtn dlg-close" data-action="dlg-close"
  aria-label="Fechar">${icon('close', 20)}</button>`;

export function dlgActionConfirm() {
  const d = ui.dlg.d;
  return dlgWrap(
    h`<div class="head confirmation-heading"><span class="confirmation-mark"
      aria-hidden="true">${icon('alert', 22)}</span><div><p class="confirmation-eyebrow">Confirmação necessária</p><h2
      id="dt">${d.title}</h2></div>${closeBtn}</div>
    <p class="confirmation-copy">${d.message}</p>
    <aside class="confirmation-note"
      role="alert">${icon('alert', 18)}<span><b>A ação só será executada depois que você confirmar.</b></span></aside>`,
    h`<button type="button" class="btn back" data-action="action-confirm-cancel">Cancelar</button><button type="button"
      class="btn danger" data-action="action-confirm-accept">${d.confirmLabel}</button>`,
  );
}
export function dlgConfirmation() {
  const d = ui.dlg.d;
  return dlgWrap(
    h`<div class="head confirmation-heading"><span class="confirmation-mark"
      aria-hidden="true">${icon('alert', 22)}</span><div><p class="confirmation-eyebrow">Confirmação necessária</p><h2
      id="dt">Continuar?</h2></div>${closeBtn}</div>
    <p class="confirmation-copy">${d.message}</p>`,
    h`<button type="button" class="btn back" data-action="confirmation-cancel">Cancelar</button><button type="button"
      class="btn primary" data-action="confirmation-accept">Continuar</button>`,
  );
}
export function dlgReleaseNotes() {
  const notes = getReleaseNotes();
  if (!notes) {
    return dlgWrap(
      h`<div class="head head-nowrap"><h2 id="dt">Novidades</h2>${closeBtn}</div><p
        class="muted">Você já está usando a versão mais recente do Aurora.</p>`,
      h`<button type="button" class="btn primary" data-action="dlg-close">Fechar</button>`,
    );
  }
  return dlgWrap(
    h`<div class="head release-notes-head"><span class="release-notes-mark"
      aria-hidden="true">${icon('sparkles', 20)}</span><div class="release-notes-heading"><p
      class="release-notes-version">Novidades${notes.dateLabel ? ` · ${notes.dateLabel}` : ''}</p><h2
      id="dt">${notes.title}</h2></div>${closeBtn}</div>
    <p class="release-notes-intro">${notes.intro}</p>
    <ul class="release-notes-list">${notes.items.map(
      (item) => h`<li class="release-notes-item"><span class="release-notes-item-icon"
        aria-hidden="true">${icon(item.icon || 'sparkles', 18)}</span><div class="release-notes-item-copy"><div
        class="release-notes-item-head"><strong>${item.title}</strong>${
          item.badge
            ? h`<span
        class="release-notes-badge is-${item.tone || 'new'}">${item.badge}</span>`
            : ''
        }</div>${item.description ? h`<p>${item.description}</p>` : ''}</div></li>`,
    )}</ul>`,
    h`<button type="button" class="btn primary" data-action="dlg-close">Entendi</button>`,
    'release-notes-dialog',
  );
}
const TASK_BULK_EXAMPLES = [
  'Pagar condomínio 28/11',
  'Ligar para o dentista amanhã 14h30 #saúde',
  'Comprar presente #família',
];
export function dlgTaskBulk() {
  const d = ui.dlg.d;
  if (d.step === 'review') {
    const valid = d.rows.filter((row) => !row.error),
      invalid = d.rows.length - valid.length;
    const chosen = valid.filter((row) => row.on);
    return dlgWrap(
      h`<div class="head head-nowrap"><h2 id="dt">Confira antes de criar</h2>${closeBtn}</div>
      <p class="small muted" role="status"
        aria-live="polite">${valid.length} ${plural(valid.length, 'tarefa entendida', 'tarefas entendidas')}${invalid ? h` · <b>${invalid} ${plural(invalid, 'precisa', 'precisam')} de ajuste</b>` : ''}. Marcadas: ${chosen.length}.</p>
      <ul class="list imp bulk-entry-list">${d.rows.map((row, index) =>
        row.error
          ? h`<li class="bulk-entry-error"><span class="grow"><b class="ellip user-value">${row.source}</b><span
            class="small bulk-entry-error-text">${icon('alert', 14)} Linha ${row.line}: ${row.error}</span></span></li>`
          : h`<li><label class="row import-row-label"><input type="checkbox"
            data-dlg="rows.${index}.on" ${row.on ? raw('checked') : ''} aria-label="Criar ${row.title}"><span
            class="grow"><b class="ellip user-value">${row.title}</b><span
            class="small muted">${row.dueDate ? `${shortDate(row.dueDate)}${row.time ? ` · ${row.time}` : ''}` : 'Sem prazo'}${row.tags.length ? ` · ${row.tags.map((tag) => `#${tag}`).join(' ')}` : ''}${row.duplicate ? ' · já existe (desmarcada)' : ''}</span></span></label></li>`,
      )}</ul>`,
      h`<button type="button" class="btn back" data-action="taskbulk-back">Voltar e editar</button><button type="button"
        class="btn primary"
        data-action="taskbulk-apply" ${chosen.length ? '' : raw('disabled')}>Criar ${chosen.length ? `(${chosen.length})` : ''}</button>`,
    );
  }
  return dlgWrap(
    h`<div class="head head-nowrap"><h2 id="dt">Criar várias tarefas</h2>${closeBtn}</div>
    <p class="small muted">Escreva uma tarefa por linha. Depois, confira antes de criar.</p>
    <form id="dlgform" class="form" data-form="dlg-taskbulk" novalidate>
      ${dlgField(
        'Tarefas',
        h`<textarea id="f0" class="bulk-entry-text" data-dlg="text" rows="9" spellcheck="true"
        autocomplete="off" autocapitalize="sentences">${d.text || ''}</textarea>`,
        'full',
      )}
    </form>
    <section class="bulk-entry-examples" aria-label="Exemplos">
      <p class="fine"><b>Exemplos:</b></p>
      ${TASK_BULK_EXAMPLES.map(
        (example) => h`<div class="bulk-entry-example"><code
        class="bulk-entry-example-text user-value">${example}</code></div>`,
      )}
    </section>
    <details class="bulk-entry-help">
      <summary>Como montar cada linha</summary>
      <ul class="fine">
        <li><b>Prazo:</b> escreva hoje, amanhã, um dia da semana ou uma data como 20/11. Sem prazo, a tarefa vai para a caixa de entrada.</li>
        <li><b>Horário:</b> acrescente 14h ou 14h30 junto com o prazo.</li>
        <li><b>Etiquetas:</b> use #saúde, #casa e assim por diante.</li>
        <li><b>Marcadores:</b> pode colar listas com "-", "•" ou números; eles são ignorados.</li>
      </ul>
      <p class="fine muted">Você pode criar até ${MAX_BULK_TASKS} tarefas por vez. Tarefas iguais a uma já aberta vêm desmarcadas.</p>
    </details>`,
    h`<button type="button" class="btn back" data-action="dlg-close">Cancelar</button><button class="btn primary"
      type="submit" form="dlgform">Revisar</button>`,
  );
}
export function reviewBulkTasks() {
  const d = ui.dlg.d;
  const rows = parseBulkTasks(d.text, today(), S.tasks);
  if (!rows.length) return fieldError('Escreva ao menos uma tarefa.', '[data-dlg="text"]');
  d.rows = rows;
  d.step = 'review';
  render();
}
export function applyBulkTasks() {
  const d = ui.dlg?.type === 'taskbulk' ? ui.dlg.d : null;
  const chosen = (d?.rows || []).filter((row) => !row.error && row.on);
  if (!chosen.length) return toast('Marque ao menos uma tarefa.', 'info');
  const slices = homeFirstTaskSlices();
  const base = Date.now();
  const created = chosen.map((row, index) =>
    mkTask({
      title: row.title,
      dueDate: row.dueDate,
      createdAt: base + index,
      ...(row.time ? { time: row.time } : {}),
      ...(row.tags.length ? { tags: [...row.tags] } : {}),
    }),
  );
  S.tasks.push(...created);
  ui.dlg = null;
  const saved = saveSlices(...slices);
  render();
  if (!saved) return;
  const ids = new Set(created.map((task) => task.id));
  toast(`${created.length} ${plural(created.length, 'tarefa criada', 'tarefas criadas')}.`, 'action', () => {
    S.tasks = S.tasks.filter((task) => !ids.has(task.id));
    commit('tasks');
  });
}
const HABIT_BULK_EXAMPLES = [
  'Ler 10 páginas - seg a sex',
  'Treinar - seg, qua, sex',
  'Correr - 3x por semana',
  'Alongar',
];
export function dlgHabitBulk() {
  const d = ui.dlg.d;
  if (d.step === 'review') {
    const valid = d.rows.filter((row) => !row.error),
      invalid = d.rows.length - valid.length;
    const chosen = valid.filter((row) => row.on);
    return dlgWrap(
      h`<div class="head head-nowrap"><h2 id="dt">Confira antes de criar</h2>${closeBtn}</div>
      <p class="small muted" role="status"
        aria-live="polite">${valid.length} ${plural(valid.length, 'hábito entendido', 'hábitos entendidos')}${invalid ? h` · <b>${invalid} ${plural(invalid, 'precisa', 'precisam')} de ajuste</b>` : ''}. Marcados: ${chosen.length}.</p>
      <ul class="list imp bulk-entry-list">${d.rows.map((row, index) =>
        row.error
          ? h`<li class="bulk-entry-error"><span class="grow"><b class="ellip user-value">${row.source}</b><span
            class="small bulk-entry-error-text">${icon('alert', 14)} Linha ${row.line}: ${row.error}</span></span></li>`
          : h`<li><label class="row import-row-label"><input type="checkbox"
            data-dlg="rows.${index}.on" ${row.on ? raw('checked') : ''} aria-label="Criar ${row.name}"><span
            class="grow"><b class="ellip user-value">${row.name}</b><span
            class="small muted">${row.days.length === 7 ? 'Todos os dias' : row.days.map((day) => DIAS[day]).join(', ')}${row.weeklyGoal ? ` · meta ${row.weeklyGoal}x por semana` : ''}${row.duplicate ? ' · já existe (desmarcado)' : ''}</span></span></label></li>`,
      )}</ul>`,
      h`<button type="button" class="btn back" data-action="habitbulk-back">Voltar e editar</button><button
        type="button" class="btn primary"
        data-action="habitbulk-apply" ${chosen.length ? '' : raw('disabled')}>Criar ${chosen.length ? `(${chosen.length})` : ''}</button>`,
    );
  }
  return dlgWrap(
    h`<div class="head head-nowrap"><h2 id="dt">Criar vários hábitos</h2>${closeBtn}</div>
    <p class="small muted">Escreva um hábito por linha. Depois, confira antes de criar.</p>
    <form id="dlgform" class="form" data-form="dlg-habitbulk" novalidate>
      ${dlgField(
        'Hábitos',
        h`<textarea id="f0" class="bulk-entry-text" data-dlg="text" rows="9" spellcheck="true"
        autocomplete="off" autocapitalize="sentences">${d.text || ''}</textarea>`,
        'full',
      )}
    </form>
    <section class="bulk-entry-examples" aria-label="Exemplos">
      <p class="fine"><b>Exemplos:</b></p>
      ${HABIT_BULK_EXAMPLES.map(
        (example) => h`<div class="bulk-entry-example"><code
        class="bulk-entry-example-text user-value">${example}</code></div>`,
      )}
    </section>
    <details class="bulk-entry-help">
      <summary>Como montar cada linha</summary>
      <ul class="fine">
        <li><b>Nome e dias:</b> escreva o nome, um hífen e os dias. Sem dias, o hábito vale para todos.</li>
        <li><b>Dias:</b> seg, ter, qua…, "seg a sex", "dias úteis", "fim de semana" ou "todos os dias".</li>
        <li><b>Meta semanal:</b> acrescente 3x por semana (ou 3x) para definir uma meta.</li>
        <li><b>Marcadores:</b> pode colar listas com "-", "•" ou números; eles são ignorados.</li>
      </ul>
      <p class="fine muted">Você pode criar até ${MAX_BULK_HABITS} hábitos por vez. Nomes que você já usa vêm desmarcados. Ícone e cor podem ser ajustados depois.</p>
    </details>`,
    h`<button type="button" class="btn back" data-action="dlg-close">Cancelar</button><button class="btn primary"
      type="submit" form="dlgform">Revisar</button>`,
  );
}
export function reviewBulkHabits() {
  const d = ui.dlg.d;
  const rows = parseBulkHabits(d.text, S.habits);
  if (!rows.length) return fieldError('Escreva ao menos um hábito.', '[data-dlg="text"]');
  d.rows = rows;
  d.step = 'review';
  render();
}
export function applyBulkHabits() {
  const d = ui.dlg?.type === 'habitbulk' ? ui.dlg.d : null;
  const chosen = (d?.rows || []).filter((row) => !row.error && row.on);
  if (!chosen.length) return toast('Marque ao menos um hábito.', 'info');
  let hasWaterHabit = S.habits.some(isWaterHabit);
  const base = Date.now(),
    start = S.habits.length;
  const created = [];
  chosen.forEach((row, index) => {
    const water = isWaterHabit({ name: row.name });
    if (water && hasWaterHabit) return;
    if (water) hasWaterHabit = true;
    created.push({
      id: newId(),
      name: row.name.slice(0, 60),
      days: [...row.days],
      completions: [],
      createdAt: base + index,
      status: 'active',
      color: HABIT_COLORS[(start + created.length) % HABIT_COLORS.length],
      ...(water ? { tracking: 'water', icon: 'droplet', waterGoalMl: S.settings.prefs.waterGoalMl } : {}),
      ...(row.weeklyGoal ? { weeklyGoal: row.weeklyGoal } : {}),
    });
  });
  if (!created.length) {
    return toast('Você já tem um hábito de água cadastrado.', 'info');
  }
  S.habits.push(...created);
  ui.dlg = null;
  const saved = saveSlices('habits');
  render();
  if (!saved) return;
  const ids = new Set(created.map((habit) => habit.id));
  toast(`${created.length} ${plural(created.length, 'hábito criado', 'hábitos criados')}.`, 'action', () => {
    S.habits = S.habits.filter((habit) => !ids.has(habit.id));
    commit('habits');
  });
}
export function dlgTask() {
  const d = ui.dlg.d,
    subs = d.subs || [],
    creating = d.create === true;
  return dlgWrap(
    h`<div class="head task-dialog-head"><span class="task-dialog-mark"
      aria-hidden="true">${icon(creating ? 'plus' : 'check', 20)}</span><div><p
      class="task-dialog-eyebrow">${creating ? 'planejamento completo' : 'organize os detalhes'}</p><h2
      id="dt">${creating ? 'Nova tarefa' : 'Editar tarefa'}</h2></div>${closeBtn}</div>
    <form id="dlgform" class="form task-form" data-form="dlg-task" novalidate>${dlgField(
      'Título',
      h`<input id="f0"
      type="text" data-dlg="title" value="${d.title}" maxlength="120" required
      placeholder="O que você precisa fazer?">`,
      'full task-title-field',
    )}
      <fieldset class="task-icon-field full"><legend>Ícone <span>(opcional)</span></legend><div
        class="task-icon-picker">
        <label title="Sem ícone"><input type="radio" name="task-icon" value=""
          data-dlg="icon" ${!taskIconKey(d.icon) ? raw('checked') : ''}><span>${icon('close', 18)}<i
          class="sr">Sem ícone</i></span></label>
        ${TASK_ICONS.map(
          ([key, label]) => h`<label title="${label}"><input type="radio" name="task-icon" value="${key}"
          data-dlg="icon"
          aria-label="${label}" ${taskIconKey(d.icon) === key ? raw('checked') : ''}><span>${icon(key, 20)}<i
          class="sr">${label}</i></span></label>`,
        )}
      </div></fieldset>
      ${dlgField('Prazo', h`<input type="date" data-dlg="due" value="${d.due}">`)}${dlgField(
        'Hora',
        h`<input
        class="task-time-input" type="time" data-dlg="time" value="${d.time || ''}">`,
      )}
      ${dlgField(
        'Repetir',
        h`<select data-dlg="repeat">${Object.entries(REPEATS).map(
          ([k, v]) => h`<option
        value="${k}" ${k === (d.repeat || 'none') ? raw('selected') : ''}>${v}</option>`,
        )}</select>`,
      )}
      ${dlgField('Prioridade', h`<select data-dlg="priority">${prioOptions(d.priority)}</select>`)}
      <details class="task-notes full" ${d.notes ? raw('open') : ''}><summary><span>Adicionar notas</span><span>opcional</span><span
        class="task-notes-disclosure" aria-hidden="true">${icon('chevDown', 16)}</span></summary><textarea
        data-dlg="notes" rows="3" maxlength="2000"
        placeholder="Detalhes, links, o que lembrar…">${d.notes || ''}</textarea></details></form>
    <div class="f"><span class="lbl">Etiquetas</span>
      ${
        (d.tags || []).length
          ? h`<div class="chips">${d.tags.map(
              (g, i) => h`<span class="chip on tgchip">#${g}<button
        type="button" class="ibtn" data-action="tg-del" data-i="${i}"
        aria-label="Remover etiqueta ${g}">${icon('close', 14)}</button></span>`,
            )}</div>`
          : ''
      }
      <form class="aibar" data-form="tg-add"><label class="sr" for="tgn">Nova etiqueta</label><input type="text"
        id="tgn" name="tg" maxlength="24" placeholder="Adicionar etiqueta" autocomplete="off"><button class="btn sm"
        type="submit">${icon('plus', 16)}Adicionar</button></form>
      ${
        allTags().filter((g) => !(d.tags || []).includes(g)).length
          ? h`<div class="chips">${allTags()
              .filter((g) => !(d.tags || []).includes(g))
              .slice(0, 8)
              .map(
                (g) => h`<button type="button" class="chip" data-action="tg-pick" data-v="${g}">#${g}</button>`,
              )}</div>`
          : ''
      }</div>
    <div class="f"><span
      class="lbl">Subtarefas${subs.length ? ` (${subs.filter((x) => x.done).length}/${subs.length})` : ''}</span>
      ${
        subs.length
          ? h`<ul class="list tight subl">${subs.map(
              (x, i) => h`<li><button type="button" class="chk"
        role="checkbox" aria-checked="${!!x.done}" aria-label="${x.done ? 'Reabrir' : 'Concluir'}: ${x.title}"
        data-action="st-toggle" data-i="${i}"><span>${icon('check', 15)}</span></button><span
        class="grow ${x.done ? 'st-done' : ''}">${x.title}</span><button type="button" class="ibtn" data-action="st-del"
        data-i="${i}" aria-label="Remover ${x.title}">${icon('close', 18)}</button></li>`,
            )}</ul>`
          : ''
      }
      <form class="aibar" data-form="st-add"><label class="sr" for="stn">Nova subtarefa</label><input type="text"
        id="stn" name="st" maxlength="100" placeholder="Adicionar subtarefa" autocomplete="off"><button class="btn sm"
        type="submit">${icon('plus', 16)}Adicionar</button></form></div>`,
    creating
      ? h`<button type="button" class="btn back" data-action="dlg-close">Cancelar</button><button class="btn primary"
        type="submit" form="dlgform">Adicionar tarefa</button>`
      : h`<button type="button" class="btn danger back" data-action="del-task-dlg"
        aria-label="Excluir tarefa">${icon('trash', 18)}</button><button type="button" class="btn back"
        data-action="dlg-close">Cancelar</button><button class="btn primary" type="submit"
        form="dlgform">Salvar</button>`,
    'task-dialog',
  );
}
export function saveCycleLogDay(day, log) {
  if (!isDay(day) || day > today() || !isValidCycleLog(log))
    return (toast('Não foi possível salvar este registro.', 'info'), false);
  const snapshot = snapshotSlices(['cycleLog']);
  if (hasAnyLog(log)) S.cycleLog[day] = log;
  else delete S.cycleLog[day];
  if (!saveSlicesWithRollback(['cycleLog'], snapshot, false, 'registro do ciclo')) return false;
  ui.cycDay = day;
  render();
  return true;
}
export function dlgCycleLog() {
  return cycleDialogViews.log();
}
export function dlgCyclePeriod() {
  return cycleDialogViews.period();
}
export function dlgCycleReport() {
  const d = ui.dlg.d;
  return dlgWrap(
    h`<div class="head head-nowrap"><h2 id="dt">Resumo para consulta</h2>${closeBtn}</div>
    <div class="cycle-report-options" role="group" aria-label="Campos opcionais do resumo">
      <button type="button" class="chip" data-action="cyc-report-option" data-k="includeMedication"
        aria-pressed="${String(Boolean(d.includeMedication))}">Incluir medicação</button>
      <button type="button" class="chip" data-action="cyc-report-option" data-k="includeNotes"
        aria-pressed="${String(Boolean(d.includeNotes))}">Incluir anotações (90 dias)</button>
    </div>
    ${raw(d.html)}`,
    h`<button class="btn back" data-action="dlg-close">Fechar</button><button class="btn primary"
      data-action="cyc-report-print">${icon('list', 16)}Imprimir ou salvar PDF</button>`,
    'cycle-report-body',
  );
}
export function dlgHabitEdit() {
  const d = ui.dlg.d,
    edit = Boolean(d.id),
    habit = edit ? S.habits.find((item) => item.id === d.id) : null;
  const waterHabit = Boolean(d.waterSuggestion || d.tracking === 'water' || isWaterHabit(habit));
  const weightHabit = Boolean(d.weightEntry || d.tracking === 'weight' || isWeightHabit(habit));
  const entryType = d.entryType || habitEntryType(habit) || 'check';
  const entryOptions = d.entryOptions || habitEntryOptions(habit);
  const entryValue = d.entryValue || habitEntryForDay(habit, today()) || '';
  const waterGoal =
    d.waterGoalMl ?? (habit ? waterGoalForHabit(habit, S.settings.prefs.waterGoalMl) : S.settings.prefs.waterGoalMl);
  return dlgWrap(
    h`<div class="head head-nowrap"><div><h2
      id="dt">${d.recordWaterAfterSave ? 'Criar acompanhamento de água' : edit ? 'Editar hábito' : 'Novo hábito'}</h2><p
      class="small muted">${d.recordWaterAfterSave ? 'Ao criar o hábito, 250 mL serão registrados.' : edit ? 'Ajuste os dias deste hábito.' : 'Escolha um nome e os dias em que quer acompanhar.'}</p></div>${closeBtn}</div>
    ${d.enableHabits ? h`<p class="fine">A área Hábitos será ativada para mostrar seu acompanhamento.</p>` : ''}
    ${d.suggestionDescription ? h`<p class="habit-idea-detail fine">${d.suggestionDescription}</p>` : ''}
    <form id="dlgform" class="form" data-form="habit-edit" novalidate>
      <label class="f full">Nome<input id="f0" name="name" type="text" data-dlg="name" value="${d.name}" maxlength="60"
        required autocomplete="off" placeholder="Ex.: Ler por 10 minutos"></label>
      ${
        waterHabit
          ? h`${
              d.waterSuggestion || d.waterWeightPersistent
                ? h`<label class="f full">Peso para estimativa
        <span class="water-weight-input"><input id="water-weight-kg" name="waterWeightKg" type="text"
          data-dlg="waterWeightKg" inputmode="decimal" autocomplete="off" maxlength="6" value="${d.waterWeightKg || ''}"
          aria-describedby="water-weight-help" placeholder="Ex.: 65,5"><span aria-hidden="true">kg</span></span>
        <span class="profile-field-help"
          id="water-weight-help">${d.waterWeightPersistent ? 'De 20 a 400 kg. Esse peso atualiza o perfil e recalcula automaticamente a meta de água.' : 'De 20 a 400 kg. Esse peso será usado somente para calcular uma sugestão e não será salvo no perfil.'}</span></label>
        <p class="fine full" id="water-goal-preview"
          aria-live="polite">${waterSuggestionPreview(d.waterWeightKg || '')}</p>`
                : ''
            }
        <label class="f full" for="water-goal-ml">Meta diária de água (mL)<input id="water-goal-ml" name="waterGoalMl"
          type="number" data-dlg="waterGoalMl" min="500" max="10000" step="50" value="${waterGoal}" required
          aria-describedby="water-goal-help"><span class="profile-field-help"
          id="water-goal-help">É uma referência ajustável, não uma recomendação médica. Registre os volumes para acompanhar o dia.</span></label>
        ${
          d.waterSuggestion
            ? h`<p
          class="fine full">A estimativa considera a idade informada em Ajustes (ou uma referência adulta) e o peso informado acima. Você pode ajustar a meta. Ao atingir o volume, o check-in do dia é concluído.</p>`
            : ''
        }`
          : ''
      }
      ${
        weightHabit
          ? h`<label class="f full">Peso de hoje
        <span class="water-weight-input"><input id="weight-kg" name="weightKg" type="text" data-dlg="weightKg"
          inputmode="decimal" autocomplete="off" maxlength="6" value="${d.weightKg || ''}"
          aria-describedby="weight-help" placeholder="Ex.: 65,5"><span aria-hidden="true">kg</span></span>
        <span class="profile-field-help"
          id="weight-help">De 20 a 400 kg. A medição será comparada com a última registrada.</span></label>`
          : ''
      }
      ${
        d.entryPrompt
          ? h`<label class="f full">${d.entryPrompt}
        ${
          entryType === 'select'
            ? h`<select name="entryValue" data-dlg="entryValue"><option
              value="">Escolha uma opção</option>${entryOptions.map(
                (option) => h`<option
              value="${option}" ${entryValue === option ? raw('selected') : ''}>${option}</option>`,
              )}</select>`
            : h`<textarea name="entryValue" data-dlg="entryValue" rows="3" maxlength="500"
              placeholder="Escreva o registro de hoje">${entryValue}</textarea>`
        }
      </label>`
          : ''
      }
      ${
        !waterHabit && !weightHabit
          ? h`<fieldset class="habit-look full"><legend>Como registrar?</legend>
        <label class="f"><select name="entryType" data-dlg="entryType">
          <option value="check" ${entryType === 'check' ? raw('selected') : ''}>Só marcar concluído</option>
          <option value="text" ${entryType === 'text' ? raw('selected') : ''}>Escrever uma anotação</option>
          <option value="select" ${entryType === 'select' ? raw('selected') : ''}>Escolher uma opção</option>
        </select></label>
        ${
          entryType === 'select'
            ? h`<label class="f">Opções (uma por linha)<textarea name="entryOptions"
          data-dlg="entryOptions" rows="4" maxlength="1200"
          placeholder="Ex.: Fácil&#10;Moderado&#10;Difícil">${entryOptions.join('\n')}</textarea></label>`
            : ''
        }
      </fieldset>`
          : ''
      }
      <fieldset class="habit-schedule full"><legend>Em quais dias?</legend><div
        class="habit-weekday-picker">${DIAS.map(
          (day, index) => h`<label
        class="${index === pk(today()).getDay() ? 'is-today' : ''}"><input type="checkbox" name="days"
        value="${index}" ${d.days.includes(index) ? raw('checked') : ''}><span>${day}</span></label>`,
        )}</div></fieldset>
      <label class="f full">Meta na semana (opcional)<select name="weeklyGoal"><option
        value="" ${d.weeklyGoal ? '' : raw('selected')}>Todos os dias marcados</option>${[1, 2, 3, 4, 5, 6, 7].map(
          (n) => h`<option
        value="${n}" ${Number(d.weeklyGoal) === n ? raw('selected') : ''}>${n} ${plural(n, 'vez', 'vezes')} por semana</option>`,
        )}</select><span
        class="small muted">Com meta, a semana conta como cumprida ao atingir esse número de dias, mesmo sem marcar todos.</span></label>
      <fieldset class="habit-look full"><legend>Ícone</legend><div
        class="habit-icon-picker">${HABIT_ICONS.map(
          ([key, label]) => h`<label title="${label}"><input type="radio"
        name="icon" value="${key}"
        data-dlg="icon" ${(d.icon || DEFAULT_HABIT_ICON) === key ? raw('checked') : ''}><span>${icon(key, 20)}<i
        class="sr">${label}</i></span></label>`,
        )}</div></fieldset>
      <fieldset class="habit-look full"><legend>Cor</legend><div
        class="habit-color-picker">${HABIT_COLORS.map(
          (color, index) => h`<label
        title="${HABIT_COLOR_NAMES[index]}"><input type="radio" name="color" value="${color}"
        data-dlg="color" ${(d.color || DEFAULT_HABIT_COLOR).toLowerCase() === color ? raw('checked') : ''}><span
        style="--c:${color}"><i
        class="sr">${HABIT_COLOR_NAMES[index]}</i>${icon('check', 16)}</span></label>`,
        )}</div></fieldset>
    </form>`,
    h`${
      edit
        ? h`<button type="button" class="btn danger back"
      data-action="habit-delete-dialog">${icon('trash', 18)}Excluir</button><button type="button" class="btn back"
      data-action="${habit?.status === 'archived' ? 'habit-restore' : 'habit-archive'}"
      data-id="${d.id}">${habit?.status === 'archived' ? 'Restaurar' : 'Arquivar'}</button>`
        : h`<button
      class="btn back" data-action="dlg-close">Cancelar</button>`
    }<button class="btn primary" type="submit"
      form="dlgform">${d.recordWaterAfterSave ? 'Criar e registrar 250 mL' : edit ? 'Salvar alterações' : 'Adicionar hábito'}</button>`,
  );
}
function waterSuggestionPreview(weightInput) {
  const text = String(weightInput ?? '').trim();
  if (!text) return 'Informe seu peso para calcular uma meta de referência.';
  const weightKg = parseWaterWeightKg(text);
  if (weightKg === null) return 'Informe um peso entre 20 e 400 kg para calcular a meta.';
  const age = currentProfileAge(S.settings);
  const goal = estimateWaterGoal({ weightKg, age });
  const ageText = age == null ? 'a referência adulta (idade não informada)' : `a idade de ${age} anos`;
  return `Estimativa: ${goal.ml.toLocaleString('pt-BR')} mL, considerando ${ageText} e ${weightKg.toLocaleString('pt-BR')} kg. Você pode ajustar a meta abaixo.`;
}
export function updateWaterSuggestionWeight(weightInput) {
  const draft = ui.dlg?.d;
  if (!draft?.waterSuggestion) return;
  const weightKg = parseWaterWeightKg(weightInput);
  const goal = weightKg === null ? null : estimateWaterGoal({ weightKg, age: currentProfileAge(S.settings) });
  if (!draft.waterGoalEdited && goal) draft.waterGoalMl = goal.ml;
  const preview = $('#water-goal-preview');
  if (preview) preview.textContent = waterSuggestionPreview(weightInput);
  const goalInput = $('#water-goal-ml');
  if (goalInput && !draft.waterGoalEdited && goal) goalInput.value = String(goal.ml);
}
function highlightSearchText(value, query) {
  const text = String(value || '');
  const needle = norm(query);
  if (!needle) return h`${text}`;
  const chars = Array.from(text);
  const positions = [];
  let folded = '';
  chars.forEach((character, index) => {
    const normalized = norm(character);
    folded += normalized;
    for (let offset = 0; offset < normalized.length; offset += 1) positions.push(index);
  });
  const tokens = folded.includes(needle)
    ? [needle]
    : [...new Set(needle.split(/\s+/).filter(Boolean))].sort((a, b) => b.length - a.length);
  const ranges = [];
  for (const token of tokens) {
    const idx = folded.indexOf(token);
    if (idx < 0) continue;
    const start = positions[idx];
    const end = positions[idx + token.length - 1] + 1;
    ranges.push([start, end]);
  }
  if (!ranges.length) return h`${text}`;
  ranges.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
  const merged = [];
  for (const [start, end] of ranges) {
    const last = merged[merged.length - 1];
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }
  let out = '';
  let cursor = 0;
  for (const [start, end] of merged) {
    if (start > cursor) out += esc(chars.slice(cursor, start).join(''));
    out += `<mark>${esc(chars.slice(start, end).join(''))}</mark>`;
    cursor = end;
  }
  if (cursor < chars.length) out += esc(chars.slice(cursor).join(''));
  return raw(out);
}
function globalSearchAreas() {
  return ['Planejar', ...(areaOn('habits') ? ['Hábitos'] : []), 'Finanças', ...(areaOn('cycle') ? ['Ciclo'] : [])].join(
    ', ',
  );
}
export function globalSearchResults(query) {
  const searchAreas = globalSearchAreas();
  const searchableCycleLogs = areaOn('cycle')
    ? Object.fromEntries(
        Object.entries(S.cycleLog).map(([date, value]) => {
          const log = value && typeof value === 'object' ? value : {};
          const searchText = CYC.flatMap(({ id, title }) => {
            const rawValue = log[id];
            const values = Array.isArray(rawValue) ? rawValue : rawValue ? [rawValue] : [];
            return [title, ...values.map((entry) => cycLabel(id, entry))];
          }).join(' ');
          return [
            date,
            { ...log, searchText: `${searchText}${isBleeding(log) ? ' menstruação fluxo menstrual' : ''}` },
          ];
        }),
      )
    : {};
  const results = searchRecords(
    {
      tasks: S.tasks,
      annualPlans: S.settings.prefs.annualPlans || {},
      transactions: S.finance.tx,
      accounts: S.finance.accounts,
      financeGoals: S.finance.goals || [],
      habits: areaOn('habits') ? S.habits : [],
      water: [],
      cycleLogs: searchableCycleLogs,
      actions: [
        {
          id: 'new-task',
          action: 'new-task',
          area: 'Ações',
          title: 'Nova tarefa',
          detail: 'Criar uma tarefa',
          aliases: ['criar tarefa', 'adicionar tarefa'],
        },
        ...(areaOn('habits') && S.habits.some((habit) => isWaterHabit(habit) && habit.status === 'active')
          ? [
              {
                id: 'add-water',
                action: 'add-water',
                area: 'Ações',
                title: 'Registrar água',
                detail: 'Adicionar um registro de hidratação',
                aliases: ['água', 'hidratação', 'beber água'],
              },
            ]
          : []),
        ...(areaOn('finances')
          ? [
              {
                id: 'open-finances',
                action: 'open-finances',
                area: 'Ações',
                title: 'Ir para Finanças',
                detail: 'Abrir a área financeira',
                aliases: ['finanças', 'financeiro', 'dinheiro'],
              },
            ]
          : []),
      ],
    },
    query,
  );
  if (String(query).trim().length < 2)
    return h`<p class="small muted">Digite pelo menos duas letras para buscar em ${searchAreas}.</p>`;
  if (!results.length)
    return areaEmpty(
      'Nenhum resultado encontrado.',
      `Tente outra palavra, nome, categoria ou descrição. Áreas pesquisadas: ${searchAreas}.`,
      h`<button type="button" class="btn primary"
        data-action="search-clear">${icon('search', 16)}Limpar busca</button>`,
      'search',
      'h3',
      'global-search-empty',
    );
  const resultIcons = {
    task: 'check',
    'annual-goal': 'target',
    transaction: 'wallet',
    account: 'bank',
    'finance-goal': 'target',
    habit: 'sparkles',
    cycle: 'heart',
    action: 'plus',
    water: 'droplet',
  };
  const queryTerms = norm(query).split(/\s+/).filter(Boolean);
  const groups = [
    ...results.reduce((map, item) => {
      if (!map.has(item.area)) map.set(item.area, []);
      map.get(item.area).push(item);
      return map;
    }, new Map()),
  ];
  return h`<div class="global-search-results">${groups.map(
    ([area, items]) =>
      h`<section class="global-search-group"
        aria-label="Resultados em ${area}"><h3>${area}<span>${items.length}</span></h3><ul class="list">${items.map(
          (item) => {
            const titleText = norm(item.title);
            const detailText = norm(item.detail);
            const titleMatches = queryTerms.some((token) => titleText.includes(token));
            const detailMatches = queryTerms.some((token) => detailText.includes(token));
            const snippet =
              !titleMatches && !detailMatches && item.matchText
                ? highlightSearchText(item.matchText, query)
                : highlightSearchText(item.detail || item.kind, query);
            return h`<li><button type="button" class="global-search-result" data-action="search-result"
            data-kind="${item.kind}" data-id="${item.id}" data-command="${item.action || ''}"><span
            class="global-search-kind">${icon(resultIcons[item.kind] || 'search', 16)}</span><span class="grow"><b
            class="ttl">${highlightSearchText(item.title, query)}</b><small
            class="small muted">${snippet}</small></span>${icon('chevRight', 16)}</button></li>`;
          },
        )}</ul></section>`,
  )}</div>`;
}
export function dlgSearch() {
  const query = ui.dlg.d.query || '';
  const searchAreas = globalSearchAreas();
  return dlgWrap(
    h`<div class="head global-search-head"><div><h2 id="dt">Buscar no Aurora</h2><p
      class="small muted">${searchAreas}</p></div>${closeBtn}</div>
    <label class="search global-search-input"><span
      class="sr">Buscar em todas as áreas</span>${icon('search', 18)}<input id="f0" type="search" data-dlg="query"
      value="${query}" placeholder="Tarefa, meta, hábito, conta ou descrição" autocomplete="off"></label>
    <div id="global-search-results" aria-live="polite">${globalSearchResults(query)}</div>`,
    h`    <span class="small muted">Atalho: Ctrl+K ou ⌘K · Esc para fechar</span><button class="btn back"
      data-action="dlg-close">Fechar</button>`,
  );
}
export function dlgWipe() {
  return dlgWrap(
    h`<div class="head destructive-heading"><span class="destructive-mark"
      aria-hidden="true">${icon('alert', 22)}</span><div><p class="destructive-eyebrow">Ação permanente</p><h2
      id="dt">Apagar os dados salvos?</h2></div>${closeBtn}</div>
    <div class="destructive-summary"><p class="destructive-copy">Serão apagados estes dados:</p>
    ${relationalDataWipeScope()}
    <p class="small muted">Sua conta e seu acesso continuam ativos. Cópias antigas ainda não importadas serão preservadas.</p>
    <aside class="destructive-note"
      role="alert">${icon('alert', 18)}<span><b>Ação irreversível</b><small>Não será possível recuperar os dados apagados.</small></span></aside></div>`,
    h`<button type="button" class="btn back" data-action="dlg-close">Cancelar e manter os dados</button><button
      type="button" class="btn danger" data-action="wipe">Apagar permanentemente</button>`,
    'destructive-dialog',
  );
}
export function dlgWipeComplete() {
  const warning = ui.dlg.d.warning;
  return dlgWrap(
    h`<div class="wipe-complete"><span class="wipe-complete-mark"
      aria-hidden="true">${icon(warning ? 'alert' : 'check', 24)}</span><div class="wiz-h"><span
      class="eyebrow">${warning ? 'Ação parcial' : 'Tudo pronto'}</span><h2
      id="dt">Seus dados foram apagados</h2><p>${warning || 'As cópias antigas ainda não importadas foram preservadas. Sua conta continua ativa e você pode começar novamente.'}</p></div></div>`,
    h`<button type="button" class="btn primary" data-action="wipe-home">Ir para o Início</button>`,
    'wipe-complete-dialog',
  );
}

/* Ajusta a camada do diálogo à área visível quando o teclado está aberto.
   Sem teclado ela ocupa a tela toda (inset: 0), sem depender de visualViewport. Com teclado, só a altura e o topo
   seguem a área visível; a largura nunca muda (o deslocamento horizontal do iOS fazia o painel andar para os lados),
   e as mudanças são agrupadas para o painel não acompanhar a animação do teclado quadro a quadro. */
let fitTimer = 0;
export let releaseDialogScroll = null;
let dialogHistoryEntry = false;
let dialogHistoryScrollPosition = null;
function restoreDialogHistoryScroll(position) {
  if (!position) return;
  requestAnimationFrame(() => {
    window.scrollTo({ left: position.left, top: position.top, behavior: 'instant' });
  });
}
function applyFitDlg() {
  const el = $('#dlg'),
    v = window.visualViewport;
  if (!el) return;
  const keyboard = v && window.innerHeight - v.height > 120;
  el.classList.toggle('is-keyboard-open', Boolean(keyboard));
  if (!keyboard) {
    Object.assign(el.style, { inset: '0', left: '', right: '', top: '', width: '', height: '' });
    el.style.removeProperty('--dialog-available-height');
    return;
  }
  const height = Math.round(v.height);
  Object.assign(el.style, {
    inset: 'auto',
    left: '0',
    right: '0',
    width: 'auto',
    top: `${Math.max(0, Math.round(v.offsetTop))}px`,
    height: `${height}px`,
  });
  el.style.setProperty('--dialog-available-height', `${height}px`);
}
function fitDlg() {
  applyFitDlg();
}
function fitDlgSoon() {
  clearTimeout(fitTimer);
  fitTimer = setTimeout(() => {
    applyFitDlg();
    keepKeyboardControlVisible();
  }, 90);
}
let keyboardFocusTarget = null;
function keepKeyboardControlVisible() {
  const viewport = window.visualViewport;
  const target = keyboardFocusTarget;
  if (!viewport || !target?.isConnected || window.innerHeight - viewport.height <= 120) return;
  requestAnimationFrame(() => {
    if (!target.isConnected) return;
    const body = target.closest('#dlg .dlg-body');
    if (!body) return;
    const bounds = target.getBoundingClientRect();
    const bodyBounds = body.getBoundingClientRect();
    const top = Math.max(bodyBounds.top, viewport.offsetTop) + 12;
    const bottom = Math.min(bodyBounds.bottom, viewport.offsetTop + viewport.height) - 16;
    if (bounds.top < top) body.scrollTop += bounds.top - top;
    else if (bounds.bottom > bottom) body.scrollTop += bounds.bottom - bottom;
  });
}
// Modal como folha no celular: saída animada e arrastar para fechar
const isSheetViewport = () => window.matchMedia('(width < 900px)').matches;
function animateSheetExit(dialogEl) {
  if (!isSheetViewport() || prefersReducedMotion(settingsView().look.reduceMotion)) return;
  const sheet = dialogEl.querySelector('.dlg:not(.intro-dialog)');
  if (!sheet || typeof sheet.animate !== 'function') return;
  const rect = sheet.getBoundingClientRect();
  if (!rect.height) return;
  const ghost = document.createElement('div');
  ghost.className = 'dlg-ghost';
  ghost.setAttribute('aria-hidden', 'true');
  ghost.inert = true;
  const backdrop = document.createElement('div');
  backdrop.className = 'dlg-ghost-backdrop';
  const copy = sheet.cloneNode(true);
  copy.querySelectorAll('[id]').forEach((node) => node.removeAttribute('id'));
  copy.classList.remove('is-dragging', 'is-settling');
  copy.style.cssText = `top:${rect.top}px;left:${rect.left}px;width:${rect.width}px;height:${rect.height}px;max-height:none;`;
  ghost.append(backdrop, copy);
  document.body.appendChild(ghost);
  const distance = window.innerHeight - rect.top;
  const timing = { duration: 220, easing: 'cubic-bezier(.4, 0, 1, 1)', fill: 'forwards' };
  const startOpacity = Number.parseFloat(dialogEl.style.getPropertyValue('--sheet-progress')) || 1;
  backdrop.animate([{ opacity: startOpacity }, { opacity: 0 }], { ...timing, easing: 'ease' });
  const slide = copy.animate([{ transform: 'translateY(0)' }, { transform: `translateY(${distance}px)` }], timing);
  const cleanup = () => ghost.remove();
  slide.addEventListener('finish', cleanup);
  slide.addEventListener('cancel', cleanup);
  setTimeout(cleanup, 600);
}
function setupSheetDrag() {
  const CLOSE_DISTANCE = 110;
  const CLOSE_VELOCITY = 0.6;
  let drag = null;
  const interactive = 'button, a, input, select, textarea, label, summary, [role="button"], [contenteditable]';
  const reset = (sheet, dialogEl) => {
    sheet.classList.remove('is-dragging');
    sheet.classList.add('is-settling');
    sheet.style.transform = '';
    dialogEl.style.removeProperty('--sheet-progress');
    setTimeout(() => sheet.classList.remove('is-settling'), 260);
  };
  document.addEventListener(
    'pointerdown',
    (event) => {
      if (drag || !event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
      if (!(event.target instanceof Element) || !isSheetViewport()) return;
      const dialogEl = event.target.closest('#dlg');
      const sheet = dialogEl?.querySelector('.dlg:not(.intro-dialog)');
      if (!dialogEl || !sheet || !sheet.contains(event.target)) return;
      const onHandle = Boolean(event.target.closest('.dlg-handle'));
      const head = event.target.closest('.head');
      const onHead = Boolean(head) && head === sheet.querySelector('.head') && !event.target.closest(interactive);
      if (!onHandle && !onHead) return;
      drag = {
        sheet,
        dialogEl,
        pointerId: event.pointerId,
        startY: event.clientY,
        lastY: event.clientY,
        lastTime: event.timeStamp,
        velocity: 0,
        offset: 0,
        height: sheet.offsetHeight || 1,
      };
    },
    { passive: true },
  );
  document.addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const offset = Math.max(0, event.clientY - drag.startY);
    const elapsed = event.timeStamp - drag.lastTime;
    if (elapsed > 0) drag.velocity = (event.clientY - drag.lastY) / elapsed;
    drag.lastY = event.clientY;
    drag.lastTime = event.timeStamp;
    drag.offset = offset;
    if (offset > 4) drag.sheet.classList.add('is-dragging');
    drag.sheet.style.transform = `translateY(${offset}px)`;
    drag.dialogEl.style.setProperty('--sheet-progress', String(Math.max(0.15, 1 - offset / drag.height)));
  });
  const finish = (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const { sheet, dialogEl, offset, velocity } = drag;
    drag = null;
    if (offset <= 4) {
      sheet.style.transform = '';
      sheet.classList.remove('is-dragging');
      return;
    }
    const shouldClose = event.type === 'pointerup' && (offset > CLOSE_DISTANCE || velocity > CLOSE_VELOCITY);
    if (!shouldClose) {
      reset(sheet, dialogEl);
      return;
    }
    dlgClose();
    // Se o fechamento foi barrado (ex.: confirmação de descarte), a folha volta para o lugar.
    if (sheet.isConnected && document.getElementById('dlg')?.contains(sheet)) reset(sheet, dialogEl);
  };
  document.addEventListener('pointerup', finish);
  document.addEventListener('pointercancel', finish);
}
/* O diálogo é redesenhado a cada mudança de estado. Para a pessoa continuar no mesmo campo, guardamos qual era
   (por id, data-dlg, ação, name e posição) e onde estava o cursor, e voltamos a ele depois do redesenho. */
const DIALOG_FOCUSABLE = 'input, select, textarea, button, summary, [tabindex]:not([tabindex="-1"])';
function dialogFocusSnapshot(root, active) {
  if (!active || active.classList.contains('dlg')) return null;
  let caret = null;
  try {
    if (typeof active.selectionStart === 'number')
      caret = { start: active.selectionStart, end: active.selectionEnd, dir: active.selectionDirection };
  } catch (e) {
    caret = null;
  }
  return {
    id: active.id,
    data: active.dataset.dlg,
    action: active.dataset.action,
    v: active.dataset.v,
    c: active.dataset.c,
    name: active.getAttribute('name'),
    value: active.matches('input[type="radio"], input[type="checkbox"]') ? active.value : null,
    tag: active.tagName,
    type: active.type,
    index: [...root.querySelectorAll(DIALOG_FOCUSABLE)].indexOf(active),
    caret,
  };
}
function findDialogFocusTarget(root, snap) {
  const esc = (value) => CSS.escape(String(value));
  const valueSel = snap.value != null ? `[value="${esc(snap.value)}"]` : '';
  const byId = snap.id ? document.getElementById(snap.id) : null;
  if (byId && root.contains(byId)) return byId;
  const byData = snap.data ? root.querySelector(`[data-dlg="${esc(snap.data)}"]${valueSel}`) : null;
  if (byData) return byData;
  const byAction = snap.action
    ? root.querySelector(
        `[data-action="${esc(snap.action)}"]${snap.v ? `[data-v="${esc(snap.v)}"]` : ''}${snap.c ? `[data-c="${esc(snap.c)}"]` : ''}`,
      )
    : null;
  if (byAction) return byAction;
  const byName = snap.name
    ? root.querySelector(`${snap.tag.toLowerCase()}[name="${esc(snap.name)}"]${valueSel}`)
    : null;
  if (byName) return byName;
  const sameSlot = snap.index >= 0 ? root.querySelectorAll(DIALOG_FOCUSABLE)[snap.index] : null;
  return sameSlot && sameSlot.tagName === snap.tag && sameSlot.type === snap.type ? sameSlot : null;
}
export function renderDialog() {
  let el = $('#dlg');
  if (ui.dlg && ui.dlg.type === 'onboard' && profileSetupComplete()) ui.dlg = null;
  if (!ui.dlg) {
    if (dialogHistoryEntry) {
      dialogHistoryEntry = false;
      const scrollPosition = dialogHistoryScrollPosition;
      dialogHistoryScrollPosition = null;
      if (scrollPosition) {
        window.addEventListener('popstate', () => restoreDialogHistoryScroll(scrollPosition), { once: true });
      }
      history.back();
    }
    if (el) {
      animateSheetExit(el);
      if (el instanceof HTMLDialogElement && el.open) el.close();
      el.remove();
      $('#app').inert = false;
      const lf = ui.lastFocus;
      ui.lastFocus = null;
      restoreDialogOpener(lf);
    }
    releaseDialogScroll?.();
    releaseDialogScroll = null;
    return;
  }
  if (!dialogHistoryEntry) {
    const state = history.state && typeof history.state === 'object' ? history.state : {};
    dialogHistoryScrollPosition = getPageScrollPosition();
    history.pushState({ ...state, auroraDialog: true }, '', location.href);
    dialogHistoryEntry = true;
  }
  const isIntro = ui.dlg.type === 'intro',
    isCycleLog = ui.dlg.type === 'cycle-log';
  const isCyclePeriod = ui.dlg.type === 'cycle-period';
  const opening = !el,
    typeChanged = Boolean(el && el.dataset.dialogType !== ui.dlg.type);
  const af =
    !opening && !typeChanged && document.activeElement && document.activeElement.closest('#dlg')
      ? document.activeElement
      : null;
  const afSel = af ? dialogFocusSnapshot(el, af) : null;
  const prevScroll = !opening ? (el.querySelector('.dlg-body') || {}).scrollTop : 0;
  const prevDetails = !opening && !typeChanged ? [...el.querySelectorAll('details')].map((item) => item.open) : null;
  if (opening) {
    if (!ui.lastFocus) ui.lastFocus = describeDialogOpener(document.activeElement);
    el = document.createElement('dialog');
    el.id = 'dlg';
    el.className = 'dlg-back is-opening';
    el.addEventListener('cancel', (event) => {
      event.preventDefault();
      if (ui.dlg) dlgClose();
    });
    setTimeout(() => el.classList.remove('is-opening'), 500);
    document.body.appendChild(el);
    if (!releaseDialogScroll) releaseDialogScroll = lockPageScroll();
  }
  el.classList.toggle('is-intro', isIntro);
  el.dataset.route = ui.route;
  fitDlg();
  el.setAttribute('aria-labelledby', 'dt');
  const isCardAccount = ui.dlg.type === 'account' && ui.dlg.d?.type === 'credit';
  const dialogHtml = `<div
    class="dlg${isIntro ? ' intro-dialog' : ''}${isCycleLog ? ' cycle-log-dialog' : ''}${isCyclePeriod ? ' cycle-period-dialog' : ''}${isCardAccount ? ' card-account-dialog' : ''}"
    tabindex="-1"><span class="dlg-handle" aria-hidden="true"></span>${DLG[ui.dlg.type]().s}</div>`;
  morphHtml(el, dialogHtml, { forceReplace: opening || typeChanged });
  if (!el.open) el.showModal();
  el.dataset.dialogType = ui.dlg.type;
  $('#app').inert = true;
  // Seções recolhíveis (ex.: "Adicionar notas") mantêm o que a pessoa abriu ou fechou; senão a altura muda e o conteúdo pula.
  if (prevDetails) {
    const items = el.querySelectorAll('details');
    if (items.length === prevDetails.length)
      items.forEach((item, index) => {
        item.open = prevDetails[index];
      });
  }
  const body = el.querySelector('.dlg-body');
  if (body && prevScroll) body.scrollTop = prevScroll;
  applyTheme(ui.dlg.type === 'onboard' ? ui.dlg.d.theme : undefined);
  const dialogRoot = el.querySelector('.dlg');
  let target = afSel ? findDialogFocusTarget(el, afSel) : null;
  if (!target) target = dialogRoot;
  if ((opening || typeChanged) && !afSel) target = dialogRoot;
  if ((opening || typeChanged) && ui.dlg.type === 'search') target = el.querySelector('[data-dlg="query"]');
  if ((opening || typeChanged) && ui.dlg.type === 'task') target = el.querySelector('[data-dlg="title"]');
  if (target) target.focus({ preventScroll: true });
}
export function setReleaseDialogScroll(value) {
  releaseDialogScroll = value;
  return value;
}

export function registerDialogs() {
  if (window.visualViewport) visualViewport.addEventListener('resize', fitDlgSoon);
  window.addEventListener('resize', fitDlgSoon);
  document.addEventListener('focusin', (event) => {
    const target = event.target;
    keyboardFocusTarget =
      target instanceof HTMLElement &&
      target.matches(
        '#app input:not([type="checkbox"], [type="radio"], [type="button"], [type="submit"], [type="range"], [type="color"]), #app textarea, #app select, #dlg input:not([type="checkbox"], [type="radio"], [type="button"], [type="submit"], [type="range"], [type="color"]), #dlg textarea, #dlg select',
      )
        ? target
        : null;
    keepKeyboardControlVisible();
  });
  document.addEventListener('focusout', (event) => {
    if (event.target === keyboardFocusTarget) keyboardFocusTarget = null;
  });
  if (window.visualViewport) visualViewport.addEventListener('resize', keepKeyboardControlVisible);
  window.addEventListener('popstate', (event) => {
    if (!dialogHistoryEntry || event.state?.auroraDialog === true) return;
    dialogHistoryEntry = false;
    const scrollPosition = dialogHistoryScrollPosition;
    dialogHistoryScrollPosition = null;
    if (ui.dlg) {
      if (ui.dlg.type === 'category-new' && ui.dlg.d.fromTransaction) {
        ui.dlg = ui.categoryReturnDialog;
        ui.categoryReturnDialog = null;
      } else {
        ui.dlg = null;
      }
      render();
    }
    restoreDialogHistoryScroll(scrollPosition);
  });
  setupSheetDrag();
}
