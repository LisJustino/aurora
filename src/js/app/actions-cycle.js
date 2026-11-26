import { esc } from '../utils/dom.js';
import { isDay, longDate, shortDate, today } from '../utils/dates.js';
import { cycleStats } from '../features/cycle/calculations.js';
import { buildCycleReport, CYCLE_REPORT_PRINT_CSS, cycleReportHtml } from '../features/cycle/report.js';
import { createCycleDataConsentRevocationMetadata, hasCurrentCycleDataConsent } from '../services/cycle-consent.js';
import { CYCLE_CONTRACEPTION_METHODS, CYCLE_TEST_RESULTS } from '../features/cycle/log.js';
import { plural } from './core.js';
import {
  CYC,
  cycLabel,
  cycleLogDraft,
  cyclePeriodEnd,
  cyclePeriodKey,
  dayLog,
  syncLatestCycleWeight,
} from './cycle.js';
import { confirmInDialog, dlgOpen, requestActionConfirmation, saveCycleLogDay } from './dialogs.js';
import { commit, createTrashRecord, moveRecordsToTrash, restoreTrashEntry, saveSlices } from './persistence.js';
import { render } from './render.js';
import { toast } from './samples-backup.js';
import { accountSession, S, ui } from './state.js';

export const CYCLE_ACTIONS = {
  'cycle-consent-revoke': async () => {
    if (ui.cycleConsentBusy || !accountSession?.client?.auth?.updateUser) return;
    const confirmed = await confirmInDialog(
      'Retirar o consentimento vai bloquear a área Ciclo, mas não apaga os registros já salvos. Para pedir a exclusão, use o contato da Política de Privacidade ou exclua sua conta em Ajustes → Seu perfil.',
    );
    if (!confirmed) return;
    ui.cycleConsentBusy = true;
    render();
    try {
      const { data, error } = await accountSession.client.auth.updateUser({
        data: createCycleDataConsentRevocationMetadata(),
      });
      if (error) throw error;
      if (!data?.user || data.user.id !== accountSession.user?.id || hasCurrentCycleDataConsent(data.user)) {
        throw new Error('O provedor não confirmou a revogação do consentimento.');
      }
      accountSession.user = data.user;
      toast('Consentimento retirado. Ciclo foi bloqueado; os registros existentes foram mantidos.', 'error');
    } catch (error) {
      console.error('Aurora: não foi possível retirar o consentimento para dados de Ciclo.', error);
      toast('Não foi possível retirar o consentimento. Confira sua conexão e tente novamente.', 'warning');
    } finally {
      ui.cycleConsentBusy = false;
      render();
    }
  },
  'cycle-discreet-toggle': () => {
    S.settings.prefs.cycleDiscreet = !S.settings.prefs.cycleDiscreet;
    commit('settings');
  },
  'cyc-quick': (el) => {
    const category = el.dataset.c,
      value = el.dataset.v;
    const group = CYC.find(({ id }) => id === category);
    if (
      !group ||
      group.single ||
      !['pain', 'mood', 'digestion', 'skin'].includes(category) ||
      !group.opts.some(([optionValue]) => optionValue === value)
    )
      return;
    const day = ui.cycDay && ui.cycDay <= today() ? ui.cycDay : today();
    const log = structuredClone(dayLog(day));
    const current = Array.isArray(log[category]) ? log[category] : [];
    log[category] = current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
    if (!log[category].length) delete log[category];
    saveCycleLogDay(day, log);
  },
  'cyc-med-quick': (el) => {
    if (!['yes', 'no'].includes(el.dataset.v)) return;
    const day = today();
    const log = structuredClone(dayLog(day));
    if (typeof log.medicationTaken === 'boolean') return;
    log.medicationTaken = el.dataset.v === 'yes';
    if (saveCycleLogDay(day, log)) toast('Medicação de hoje registrada.', 'success');
  },
  'cyc-report-open': () => {
    const todayKey = today();
    const report = buildCycleReport({
      cycleLog: S.cycleLog,
      stats: cycleStats(S.cycleLog, S.cycle, todayKey),
      asOfDate: todayKey,
      getLabel: cycLabel,
    });
    dlgOpen('cycle-report', { html: cycleReportHtml(report, { esc, longDate, shortDate, plural }) });
  },
  'cyc-report-print': () => {
    const html = ui.dlg?.type === 'cycle-report' ? ui.dlg.d.html : '';
    if (!html) return;
    const frame = document.createElement('iframe');
    frame.title = 'Resumo do ciclo para impressão';
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    frame.srcdoc = `<!doctype html><html lang="pt-BR"><head><meta
      charset="utf-8"><title>Resumo do ciclo</title><style>${CYCLE_REPORT_PRINT_CSS}</style></head><body>${html}</body></html>`;
    frame.onload = () => {
      try {
        frame.contentWindow.focus();
        frame.contentWindow.print();
      } catch {
        toast('Não foi possível abrir a impressão neste aparelho.', 'info');
      }
      setTimeout(() => frame.remove(), 60000);
    };
    document.body.appendChild(frame);
  },
  'cyc-day': (el) => {
    ui.cycDay = el.dataset.d;
    ui.calMonth = el.dataset.d.slice(0, 7);
    render();
  },
  'cyc-open': () => {
    const day = ui.cycDay && ui.cycDay <= today() ? ui.cycDay : today();
    dlgOpen('cycle-log', { day, log: cycleLogDraft(dayLog(day)) });
  },
  'cyc-flow-open': () => {
    const day = ui.cycDay && ui.cycDay <= today() ? ui.cycDay : today();
    dlgOpen('cycle-log', { day, log: cycleLogDraft(dayLog(day)), quickFlow: true });
  },
  'cyc-period-open': () => {
    const day = ui.cycDay && ui.cycDay <= today() ? ui.cycDay : today();
    dlgOpen('cycle-period', { start: day, end: day });
  },
  'cyc-period-past': () => dlgOpen('cycle-period', { start: '', end: today() }),
  'cyc-start-today': () => {
    const day = today();
    if (S.cycle.some((period) => period.start <= day && cyclePeriodEnd(period) >= day)) {
      ui.cycDay = day;
      render();
      return toast('Hoje já faz parte de um período registrado.', 'info');
    }
    S.cycle.push({ start: day, end: null });
    ui.cycDay = day;
    ui.calMonth = day.slice(0, 7);
    const saved = saveSlices('cycle');
    render();
    if (saved) toast('Início registrado para hoje. Você pode ajustar o último dia depois.', 'success');
  },
  'cyc-period-edit': (el) => {
    const index = Number(el.dataset.index);
    const period = Number.isInteger(index) ? S.cycle[index] : null;
    if (!period) return toast('Este período não está mais disponível.', 'info');
    dlgOpen('cycle-period', {
      index,
      originalStart: period.start,
      originalEnd: period.end || '',
      start: period.start,
      end: period.end || today(),
    });
  },
  'cyc-period-delete': (el) => {
    const index = Number(el.dataset.index);
    const period = Number.isInteger(index) ? S.cycle[index] : null;
    if (!period) return toast('Este período não está mais disponível.', 'info');
    const label = `o período de ${shortDate(period.start)}${cyclePeriodEnd(period) === period.start ? '' : ` a ${shortDate(cyclePeriodEnd(period))}`}`;
    if (ui.confirmedAction !== 'cyc-period-delete') {
      return requestActionConfirmation(
        'cyc-period-delete',
        { index },
        'Excluir período?',
        `${label} irá para a lixeira por 30 dias. Os registros diários de sintomas e anotações serão mantidos.`,
        'Excluir período',
      );
    }
    const entry = moveRecordsToTrash(
      `Ciclo: ${label}`,
      [createTrashRecord('cycle', cyclePeriodKey(period), index, period)],
      ['cycle'],
      () => {
        S.cycle.splice(index, 1);
      },
    );
    if (entry) toast('Período movido para a lixeira.', 'action', () => restoreTrashEntry(entry.id));
  },
  'cyc-opt': (el) => {
    if (ui.dlg?.type !== 'cycle-log') return;
    const c = CYC.find((x) => x.id === el.dataset.c),
      v = el.dataset.v,
      l = ui.dlg.d.log;
    if (!c || !c.opts.some(([value]) => value === v)) return;
    if (c.single) l[c.id] = l[c.id] === v ? '' : v;
    else {
      const a = l[c.id] || [];
      l[c.id] = a.includes(v) ? a.filter((x) => x !== v) : [...a, v];
    }
    ui.dlg.dirty = true;
    if (c.id !== 'flow') {
      ui.dlg.d.openGroups = [...new Set([...(ui.dlg.d.openGroups || []), c.id])];
      ui.dlg.d.closedGroups = (ui.dlg.d.closedGroups || []).filter((group) => group !== c.id);
    }
    render();
  },
  'cyc-method': (el) => {
    if (ui.dlg?.type !== 'cycle-log' || !ui.dlg.d.log.sexualActivity) return;
    const method = el.dataset.v;
    if (!CYCLE_CONTRACEPTION_METHODS.some(({ id }) => id === method)) return;
    const selected = ui.dlg.d.log.contraceptionMethods || [];
    if (method === 'none' || method === 'undisclosed') {
      ui.dlg.d.log.contraceptionMethods = selected.includes(method) ? [] : [method];
    } else {
      const methods = selected.filter((item) => item !== 'none' && item !== 'undisclosed');
      ui.dlg.d.log.contraceptionMethods = methods.includes(method)
        ? methods.filter((item) => item !== method)
        : [...methods, method];
    }
    ui.dlg.dirty = true;
    render();
  },
  'cyc-sex': (el) => {
    const log = ui.dlg?.type === 'cycle-log' ? ui.dlg.d.log : null;
    if (!log || !['yes', 'no'].includes(el.dataset.v)) return;
    const value = el.dataset.v === 'yes';
    if (log.sexualActivity === value) {
      delete log.sexualActivity;
      delete log.contraceptionMethods;
    } else {
      log.sexualActivity = value;
      if (!value) delete log.contraceptionMethods;
    }
    ui.dlg.d.openGroups = [...new Set([...(ui.dlg.d.openGroups || []), 'intimacy'])];
    ui.dlg.d.closedGroups = (ui.dlg.d.closedGroups || []).filter((group) => group !== 'intimacy');
    ui.dlg.d.dirty = true;
    render();
  },
  'cyc-libido': (el) => {
    const log = ui.dlg?.type === 'cycle-log' ? ui.dlg.d.log : null;
    if (!log || !['high', 'low'].includes(el.dataset.v)) return;
    if (log.libido === el.dataset.v) delete log.libido;
    else log.libido = el.dataset.v;
    ui.dlg.d.openGroups = [...new Set([...(ui.dlg.d.openGroups || []), 'intimacy'])];
    ui.dlg.d.closedGroups = (ui.dlg.d.closedGroups || []).filter((group) => group !== 'intimacy');
    ui.dlg.d.dirty = true;
    render();
  },
  'cyc-intimacy-toggle': (el) => {
    const log = ui.dlg?.type === 'cycle-log' ? ui.dlg.d.log : null;
    const key = el.dataset.k;
    if (!log || !['masturbationActivity', 'sexToysUsed'].includes(key)) return;
    if (log[key]) delete log[key];
    else log[key] = true;
    ui.dlg.d.openGroups = [...new Set([...(ui.dlg.d.openGroups || []), 'intimacy'])];
    ui.dlg.d.closedGroups = (ui.dlg.d.closedGroups || []).filter((group) => group !== 'intimacy');
    ui.dlg.d.dirty = true;
    render();
  },
  'cyc-orgasm': (el) => {
    const log = ui.dlg?.type === 'cycle-log' ? ui.dlg.d.log : null;
    if (!log || !['yes', 'no'].includes(el.dataset.v)) return;
    const value = el.dataset.v === 'yes';
    if (log.orgasmOccurred === value) delete log.orgasmOccurred;
    else log.orgasmOccurred = value;
    ui.dlg.d.openGroups = [...new Set([...(ui.dlg.d.openGroups || []), 'intimacy'])];
    ui.dlg.d.closedGroups = (ui.dlg.d.closedGroups || []).filter((group) => group !== 'intimacy');
    ui.dlg.d.dirty = true;
    render();
  },
  'cyc-test-toggle': (el) => {
    const log = ui.dlg?.type === 'cycle-log' ? ui.dlg.d.log : null;
    const key = el.dataset.k;
    if (!log || !['ovulationTestResult', 'pregnancyTestResult'].includes(key)) return;
    if (log[key]) delete log[key];
    else log[key] = 'undisclosed';
    ui.dlg.d.openGroups = [...new Set([...(ui.dlg.d.openGroups || []), 'tests'])];
    ui.dlg.d.closedGroups = (ui.dlg.d.closedGroups || []).filter((group) => group !== 'tests');
    ui.dlg.d.dirty = true;
    render();
  },
  'cyc-test-result': (el) => {
    const log = ui.dlg?.type === 'cycle-log' ? ui.dlg.d.log : null;
    const key = el.dataset.k;
    if (
      !log ||
      !['ovulationTestResult', 'pregnancyTestResult'].includes(key) ||
      !CYCLE_TEST_RESULTS.some(([value]) => value === el.dataset.v)
    )
      return;
    log[key] = el.dataset.v;
    ui.dlg.d.openGroups = [...new Set([...(ui.dlg.d.openGroups || []), 'tests'])];
    ui.dlg.d.closedGroups = (ui.dlg.d.closedGroups || []).filter((group) => group !== 'tests');
    ui.dlg.d.dirty = true;
    render();
  },
  'cyc-medication': (el) => {
    const log = ui.dlg?.type === 'cycle-log' ? ui.dlg.d.log : null;
    if (!log || !['yes', 'no'].includes(el.dataset.v)) return;
    const value = el.dataset.v === 'yes';
    if (log.medicationTaken === value) delete log.medicationTaken;
    else log.medicationTaken = value;
    ui.dlg.d.openGroups = [...new Set([...(ui.dlg.d.openGroups || []), 'medication'])];
    ui.dlg.d.closedGroups = (ui.dlg.d.closedGroups || []).filter((group) => group !== 'medication');
    ui.dlg.d.dirty = true;
    render();
  },
  'cyc-clear': (el) => {
    const k =
      ui.confirmedAction === 'cyc-clear' ? el.dataset.day : ui.cycDay && ui.cycDay <= today() ? ui.cycDay : today();
    if (!isDay(k)) return;
    const previous = S.cycleLog[k];
    if (!previous) return;
    if (ui.confirmedAction !== 'cyc-clear')
      return requestActionConfirmation(
        'cyc-clear',
        { day: k },
        'Remover registro do ciclo?',
        `O registro de ${longDate(k)} irá para a lixeira por 30 dias.`,
        'Remover registro',
      );
    const affectedSlices = Number.isFinite(previous.weightKg) ? ['cycleLog', 'habits'] : ['cycleLog'];
    const entry = moveRecordsToTrash(
      `Ciclo: ${longDate(k)}`,
      [createTrashRecord('cycleLog', k, 0, previous)],
      affectedSlices,
      () => {
        delete S.cycleLog[k];
        if (Number.isFinite(previous.weightKg)) syncLatestCycleWeight();
      },
    );
    if (entry) toast('Registro movido para a lixeira.', 'action', () => restoreTrashEntry(entry.id));
  },
  'cycle-clear-all': () => {
    const records = [
      ...S.cycle.map((period, index) => createTrashRecord('cycle', cyclePeriodKey(period), index, period)),
      ...Object.entries(S.cycleLog).map(([day, log]) => createTrashRecord('cycleLog', day, 0, log)),
    ];
    if (!records.length) return toast('Não há registros do Ciclo para mover.', 'info');
    if (ui.confirmedAction !== 'cycle-clear-all') {
      return requestActionConfirmation(
        'cycle-clear-all',
        {},
        'Mover registros do Ciclo?',
        'Todos os períodos e registros diários irão para a lixeira por 30 dias. O peso do Perfil e a meta de água dos Hábitos serão mantidos.',
        'Mover para a lixeira',
      );
    }
    const entry = moveRecordsToTrash('Registros do Ciclo', records, ['cycle', 'cycleLog'], () => {
      S.cycle = [];
      S.cycleLog = {};
    });
    if (!entry) return;
    ui.cycDay = '';
    ui.calMonth = today().slice(0, 7);
    render();
    toast('Registros do Ciclo movidos para a lixeira.', 'action', () => restoreTrashEntry(entry.id));
  },
};
