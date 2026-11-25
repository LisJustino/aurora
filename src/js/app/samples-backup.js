import { $ } from '../utils/dom.js';
import { addDays, isDay, pad, today } from '../utils/dates.js';
import { newId } from '../utils/ids.js';
import { filterValidRecords, isPlainObject } from '../core/data-integrity.js';
import { linkedGoalProgressCents } from '../features/finance/calculations.js';
import { taskIconKey } from '../features/planning/task-icons.js';
import { containsRemovedStudyData } from '../features/backup/validation.js';
import { isValidHabit } from '../features/habits/model.js';
import { REPEATS } from '../features/planning/recurrence.js';
import { isTime, SEX } from './core.js';
import { confirmInDialog, dlgOpen } from './dialogs.js';
import { shiftMonth } from './finance-view.js';
import { commit, Persist } from './persistence.js';
import { setToast } from './render.js';
import { isFiniteValue, isNonEmptyText, isText, isValidTask, normalizeSlice, S, SLICES, ui } from './state.js';

// Ações, formulários, importação/exportação e arranque
export const findTask = (id) => S.tasks.find((t) => t.id === id);
export const mkTask = (o) => ({
  id: newId(),
  title: '',
  done: false,
  tag: 'Pessoal',
  dueDate: null,
  priority: 'normal',
  createdAt: Date.now(),
  ...o,
});
const taskDraft = (due = '') => ({
  create: true,
  title: '',
  due,
  time: '',
  repeat: 'none',
  priority: 'normal',
  icon: '',
  tags: [],
  notes: '',
  subs: [],
});
export const openTaskDialog = (due = '') => dlgOpen('task', taskDraft(due));
export const toast = setToast;

// Exemplos
export function loadSample() {
  // Exemplos são uma demonstração única: recarregá-los atualiza o conjunto, nunca duplica dados.
  if (S.settings.prefs.sample) removeSampleData();
  const t = today(),
    sm = { sample: true };
  S.tasks.push(
    mkTask({ title: 'Revisar orçamento mensal', dueDate: t, priority: 'high', ...sm }),
    mkTask({ title: 'Organizar documentos', dueDate: addDays(t, 2), ...sm }),
    mkTask({ title: 'Marcar consulta de rotina', dueDate: addDays(t, -1), ...sm }),
    mkTask({ title: 'Comprar um caderno novo', ...sm }),
    mkTask({
      title: 'Arrumar a mesa de trabalho',
      done: true,
      doneAt: new Date().toISOString(),
      dueDate: t,
      priority: 'low',
      ...sm,
    }),
  );
  for (let i = 0; i < 4; i++)
    S.water.push({
      id: newId(),
      ml: [300, 500, 200, 300][i],
      at: new Date(Date.now() - i * 36e5).toISOString(),
      ...sm,
    });
  const acc = { id: newId(), name: 'Conta principal', type: 'checking', initialCents: 150000, ...sm },
    investment = { id: newId(), name: 'Investimentos', type: 'investment', initialCents: 12000, ...sm },
    card = {
      id: newId(),
      name: 'Cartão',
      type: 'credit',
      initialCents: 0,
      limitCents: 300000,
      closingDay: 20,
      dueDay: 28,
      ...sm,
    };
  S.finance.accounts.push(acc, investment, card);
  const mo = (n, day) => {
      const ym = shiftMonth(t.slice(0, 7), n);
      return `${ym}-${pad(day)}`;
    },
    tt = (type, accountId, cents, category, desc, date, paid = true) => ({
      id: newId(),
      type,
      accountId,
      cents,
      category,
      desc,
      date,
      paid,
      createdAt: Date.now(),
      ...sm,
    });
  S.finance.tx.push(
    tt('in', acc.id, 320000, 'Salário', 'Salário', mo(0, 5)),
    tt('out', acc.id, 95000, 'Moradia', 'Aluguel', mo(0, 8)),
    tt('out', acc.id, 28990, 'Assinaturas', 'Internet', mo(0, 12)),
    tt('out', card.id, 32050, 'Alimentação', 'Mercado', addDays(t, -1)),
    tt('out', card.id, 8900, 'Lazer', 'Cinema', addDays(t, -3)),
    tt('out', investment.id, 2500, 'Transporte', 'Ônibus', addDays(t, -2)),
    tt('out', acc.id, 18000, 'Saúde', 'Farmácia', addDays(t, 3), false),
    tt('in', acc.id, 45000, 'Renda extra', 'Freelance', addDays(t, 6), false),
    tt('in', acc.id, 320000, 'Salário', 'Salário', mo(-1, 5)),
    tt('out', acc.id, 95000, 'Moradia', 'Aluguel', mo(-1, 8)),
    tt('out', card.id, 61000, 'Compras', 'Roupas', mo(-1, 14)),
    tt('out', acc.id, 54000, 'Alimentação', 'Mercado do mês', mo(-1, 20)),
    tt('in', acc.id, 320000, 'Salário', 'Salário', mo(-2, 5)),
    tt('out', acc.id, 95000, 'Moradia', 'Aluguel', mo(-2, 8)),
    tt('out', acc.id, 47000, 'Alimentação', 'Mercado do mês', mo(-2, 21)),
  );
  S.finance.budgets = {
    ...S.finance.budgets,
    Alimentação: { cents: 80000, sample: true },
    Lazer: { cents: 30000, sample: true },
  };
  S.finance.goals.push({
    id: newId(),
    name: 'Viagem de férias',
    targetCents: 400000,
    savedCents: 120000,
    deadline: addDays(t, 150),
    ...sm,
  });
  [-57, -29, -1].forEach((off, i) => {
    const st0 = addDays(t, off);
    for (let d = 0; d < (i < 2 ? 5 : 1); d++) {
      const k = addDays(st0, d);
      if (k > t) break;
      S.cycleLog[k] = {
        flow: d === 0 ? 'medium' : d < 3 ? 'heavy' : 'light',
        pain: d < 2 ? ['cramp'] : [],
        mood: d === 0 ? ['sensitive'] : [],
        energy: d < 2 ? 'low' : '',
        sample: true,
      };
    }
  });
  Object.assign(S.settings.areas, { water: true, finances: true, cycle: true, habits: true });
  S.settings.prefs.sample = true;
  S.settings.areas.cycle = true;
  commit(...SLICES);
}
const keepNonSample = (a) => a.filter((x) => !x.sample);
function removeSampleData() {
  S.tasks = keepNonSample(S.tasks);
  S.water = keepNonSample(S.water);
  S.gym = { templates: keepNonSample(S.gym.templates), logs: keepNonSample(S.gym.logs) };
  const removedAccountIds = new Set(
    S.finance.accounts.filter((account) => account.sample).map((account) => account.id),
  );
  S.finance.goals.forEach((goal) => {
    if (!removedAccountIds.has(goal.linkedAccountId)) return;
    goal.savedCents = linkedGoalProgressCents(goal, S.finance.accounts, S.finance.tx);
    delete goal.linkedAccountId;
  });
  const accs = keepNonSample(S.finance.accounts);
  S.finance = {
    accounts: accs,
    tx: S.finance.tx.filter((x) => !x.sample && accs.some((a) => a.id === x.accountId)),
    budgets: Object.fromEntries(Object.entries(S.finance.budgets || {}).filter(([, b]) => !b.sample)),
    goals: keepNonSample(S.finance.goals || []),
    recurring: (S.finance.recurring || []).filter((r) => accs.some((a) => a.id === r.accountId)),
  };
  S.cycle = keepNonSample(S.cycle);
  S.cycleLog = Object.fromEntries(Object.entries(S.cycleLog).filter(([, l]) => !l.sample));
  S.weight = keepNonSample(S.weight);
  S.settings.prefs.sample = false;
}
export function clearSample() {
  removeSampleData();
  commit(...SLICES);
  toast('Exemplos removidos.', 'success');
}

// Backup
function buildBackup() {
  const s = S.settings;
  const backupPreferences = { ...s.prefs };
  delete backupPreferences.releaseNotesSeen;
  return JSON.stringify(
    {
      app: 'aurora',
      version: 2,
      exportedAt: new Date().toISOString(),
      data: {
        profile: {
          name: s.profile.name.slice(0, 50),
          preferredName: (s.profile.preferredName || s.profile.name).slice(0, 50),
        },
        tasks: S.tasks.map((t) => ({
          id: t.id,
          title: t.title,
          done: t.done,
          tag: t.tag,
          dueDate: t.dueDate,
          priority: t.priority,
          icon: t.icon,
          groupId: t.groupId,
          groupTitle: t.groupTitle,
          doneAt: t.doneAt,
          createdAt: t.createdAt,
          repeat: t.repeat,
          time: t.time,
          subtasks: t.subtasks,
          tags: t.tags,
          notes: t.notes,
          order: t.order,
          focusSeconds: t.focusSeconds,
        })),
        areas: s.areas,
        theme: s.theme,
        weightTracking: s.weightTracking,
        onboardingComplete: s.onboardingComplete,
        introSeen: s.introSeen,
      },
      extras: {
        themeFull: s.theme,
        look: s.look,
        lists: s.lists,
        cats: s.cats,
        water: S.water,
        gym: S.gym,
        finance: S.finance,
        cycle: S.cycle,
        cycleLog: S.cycleLog,
        weight: S.weight,
        habits: S.habits,
        prefs: backupPreferences,
        about: { sex: s.profile.sex, age: s.profile.age, weightKg: s.profile.weightKg, heightCm: s.profile.heightCm },
      },
    },
    null,
    2,
  );
}
export async function doExport() {
  if (Object.keys(ui.integrityIssues).length) {
    toast(
      'O backup normal não foi criado para evitar omitir dados locais inválidos. Baixe a cópia de recuperação ou importe um backup confiável.',
      'warning',
    );
    return;
  }
  if (
    !(await confirmInDialog(
      'O arquivo de backup não tem proteção própria por senha. Quem tiver acesso a ele poderá ver dados financeiros, de saúde e do ciclo. Guarde-o em um local privado. Deseja continuar?',
    ))
  )
    return;
  const json = buildBackup(),
    name = `aurora-backup-${today()}.json`;
  downloadFile(name, json, 'application/json;charset=utf-8');
  S.settings.prefs.lastBackup = new Date().toISOString();
  commit('settings');
  toast('Backup baixado.', 'success');
}
export function downloadFile(name, contents, type) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function exportRecoveryData() {
  if (!Persist.rawTables || !Object.keys(Persist.rawTables).length) {
    toast('Não há dados bloqueados disponíveis para exportar.', 'error');
    return;
  }
  if (
    !(await confirmInDialog(
      'A cópia de recuperação contém dados da conta, inclusive informações de saúde e finanças, e não tem proteção própria por senha. Guarde-a em um local privado e não a compartilhe. Deseja continuar?',
    ))
  )
    return;
  const recovery = JSON.stringify(
    {
      app: 'aurora-recovery',
      version: 1,
      exportedAt: new Date().toISOString(),
      integrityIssues: ui.integrityIssues,
      tables: Persist.rawTables,
    },
    null,
    2,
  );
  downloadFile(`aurora-recovery-${today()}.json`, recovery, 'application/json;charset=utf-8');
  toast('Cópia bruta de recuperação baixada. Ela não altera nem substitui os dados atuais.', 'success');
}
function backupRecords(value, validator, label) {
  if (value == null) return [];
  const result = filterValidRecords(value, validator);
  if (result.rejectedCount) {
    throw new Error(`O backup contém ${result.rejectedCount} registro(s) inválido(s) em ${label}; nada foi importado.`);
  }
  return result.records;
}
function validatedBackupSlice(key, value) {
  const result = normalizeSlice(key, value);
  if (result.invalidCount) {
    throw new Error(`O backup contém dados inválidos em ${key}; nada foi importado.`);
  }
  return result.value;
}
function parseBackup(text) {
  if (text.length > 5 * 1024 * 1024) throw new Error('O arquivo excede o limite de 5 MB.');
  let j;
  try {
    j = JSON.parse(text);
  } catch {
    throw new Error('Não foi possível reconhecer este arquivo como um backup do Aurora.');
  }
  if (
    !isPlainObject(j) ||
    j.app !== 'aurora' ||
    ![1, 2].includes(j.version) ||
    !isPlainObject(j.data) ||
    (j.extras !== undefined && !isPlainObject(j.extras))
  )
    throw new Error('Este arquivo não é um backup compatível do Aurora.');
  const d = j.data,
    ex = j.extras || {};
  if (containsRemovedStudyData(d, ex)) {
    throw new Error('Este backup contém dados de uma função removida e não pode ser importado.');
  }
  if (d.introSeen !== undefined && typeof d.introSeen !== 'boolean')
    throw new Error('O indicador da introdução no backup está inválido.');
  if (
    d.profile !== undefined &&
    (!isPlainObject(d.profile) ||
      (d.profile.name !== undefined && !isText(d.profile.name)) ||
      (d.profile.preferredName !== undefined && !isText(d.profile.preferredName)))
  )
    throw new Error('O perfil do backup está inválido.');
  const sourceTasks = backupRecords(
    d.tasks,
    (task) =>
      isPlainObject(task) &&
      isText(task.title) &&
      isValidTask({ ...task, id: isNonEmptyText(task.id) ? task.id : 'backup-task' }),
    'tarefas',
  );
  const ids = new Set(),
    uniq = (x) => {
      if (typeof x.id !== 'string' || !x.id || ids.has(x.id)) x.id = newId();
      ids.add(x.id);
      return x;
    };
  const tasks = sourceTasks.map((t) =>
    uniq({
      id: t.id,
      title: t.title.slice(0, 120),
      done: !!t.done,
      tag: typeof t.tag === 'string' ? t.tag : 'Pessoal',
      dueDate: isDay(t.dueDate) ? t.dueDate : null,
      priority: ['low', 'normal', 'high'].includes(t.priority) ? t.priority : 'normal',
      ...(taskIconKey(t.icon) ? { icon: taskIconKey(t.icon) } : {}),
      ...(t.groupId !== undefined ? { groupId: t.groupId } : {}),
      ...(t.groupTitle !== undefined ? { groupTitle: t.groupTitle } : {}),
      ...(t.doneAt !== undefined ? { doneAt: t.doneAt } : {}),
      createdAt: t.createdAt || Date.now(),
      ...(REPEATS[t.repeat] && t.repeat !== 'none' ? { repeat: t.repeat } : {}),
      ...(isTime(t.time) ? { time: t.time } : {}),
      ...(Number.isSafeInteger(t.focusSeconds) && t.focusSeconds >= 0 ? { focusSeconds: t.focusSeconds } : {}),
      ...(Array.isArray(t.tags) && t.tags.length ? { tags: t.tags.slice(0, 12).map((g) => g.slice(0, 24)) } : {}),
      ...(typeof t.notes === 'string' && t.notes ? { notes: t.notes.slice(0, 2000) } : {}),
      ...(Number.isFinite(t.order) ? { order: t.order } : {}),
      ...(Array.isArray(t.subtasks) && t.subtasks.length
        ? {
            subtasks: t.subtasks
              .slice(0, 40)
              .map((x) => ({ id: x.id || newId(), title: x.title.slice(0, 100), done: !!x.done })),
          }
        : {}),
    }),
  );
  const onboardingComplete = typeof d.onboardingComplete === 'boolean' ? d.onboardingComplete : true;
  const settingsResult = normalizeSlice('settings', {
    profile: {
      name: String(d.profile?.name || '').slice(0, 50),
      preferredName: String(d.profile?.preferredName || d.profile?.name || '').slice(0, 50),
    },
    areas: d.areas,
    theme: ex.themeFull !== undefined ? ex.themeFull : d.theme,
    look: ex.look,
    lists: ex.lists,
    cats: ex.cats,
    weightTracking: d.weightTracking,
    onboardingComplete,
    introSeen: typeof d.introSeen === 'boolean' ? d.introSeen : onboardingComplete,
    prefs: ex.prefs,
  });
  if (settingsResult.invalidCount)
    throw new Error('As configurações do backup contêm dados inválidos; nada foi importado.');
  const settings = settingsResult.value;
  delete settings.prefs.releaseNotesSeen;
  if (ex.about !== undefined && !isPlainObject(ex.about))
    throw new Error('Os dados do perfil no backup estão inválidos.');
  if (ex.about && typeof ex.about === 'object') {
    const a = ex.about;
    if (
      (a.sex !== undefined && a.sex !== '' && !Object.hasOwn(SEX, a.sex)) ||
      (a.age !== undefined && a.age !== null && !(Number.isInteger(a.age) && a.age >= 0 && a.age <= 120)) ||
      (a.weightKg !== undefined &&
        a.weightKg !== null &&
        !(isFiniteValue(a.weightKg) && a.weightKg >= 20 && a.weightKg <= 400)) ||
      (a.heightCm !== undefined &&
        a.heightCm !== null &&
        !(Number.isInteger(a.heightCm) && a.heightCm >= 80 && a.heightCm <= 250))
    )
      throw new Error('Os dados do perfil no backup estão inválidos.');
    Object.assign(settings.profile, {
      sex: SEX[a.sex] ? a.sex : '',
      age: Number.isFinite(a.age) ? a.age : null,
      weightKg: Number.isFinite(a.weightKg) ? a.weightKg : null,
      heightCm: Number.isFinite(a.heightCm) ? a.heightCm : null,
    });
  }
  settings.prefs.sample = false;
  const habits = backupRecords(ex.habits, isValidHabit, 'hábitos');
  return {
    tasks: validatedBackupSlice('tasks', tasks),
    habits: validatedBackupSlice('habits', habits),
    settings,
    water: validatedBackupSlice('water', ex.water),
    gym: validatedBackupSlice('gym', ex.gym),
    finance: validatedBackupSlice('finance', ex.finance),
    cycle: validatedBackupSlice('cycle', ex.cycle),
    cycleLog: validatedBackupSlice('cycleLog', ex.cycleLog),
    weight: validatedBackupSlice('weight', ex.weight),
  };
}
export async function importFile(file) {
  const err = (m) => {
    const e = $('#imperr');
    if (e) e.textContent = m;
    else toast(m, 'info');
  };
  if (!file) return;
  if (file.size > 7 * 1024 * 1024) return err('O arquivo excede o limite permitido para backup.');
  let text;
  try {
    text = await file.text();
  } catch (error) {
    console.error('Aurora: não foi possível ler o arquivo de backup.', error);
    return err('Não consegui ler o arquivo.');
  }
  try {
    try {
      JSON.parse(text);
    } catch {
      const parsed = parseBackup(text);
      ui.dlg = null;
      dlgOpen('import', { parsed });
      return;
    }
    const parsed = parseBackup(text);
    ui.dlg = null;
    dlgOpen('import', { parsed });
  } catch (error) {
    err(error instanceof Error ? error.message : 'Este arquivo não pôde ser validado.');
  }
}
