import { $ } from '../utils/dom.js';
import { backupSnoozeUntil } from '../features/backup/reminder.js';
import { confirmInDialog, createDialog, dlgOpen, requestActionConfirmation } from './dialogs.js';
import { commit, Persist, saveSlices } from './persistence.js';
import { nav, render, resetSettingsTabBeforeLeaving } from './render.js';
import { clearSample, doExport, exportRecoveryData, toast } from './samples-backup.js';
import { applyLegacyImport, clearLegacyBrowserData, discoverLegacyImport, unlockLegacyImport } from './settings.js';
import { defaults, S, setS, SLICES, stamps, syncState, ui } from './state.js';

export const DATA_ACTIONS = {
  'backup-snooze': () => {
    S.settings.prefs.backupReminderSnoozedUntil = backupSnoozeUntil();
    commit('settings');
  },
  'clear-sample': () => {
    if (ui.confirmedAction !== 'clear-sample')
      return requestActionConfirmation(
        'clear-sample',
        {},
        'Remover dados de exemplo?',
        'Somente os registros identificados como exemplos serão removidos. Seus dados pessoais serão mantidos.',
        'Remover exemplos',
      );
    clearSample();
  },
  export: () => {
    void doExport();
  },
  'recovery-export': () => {
    void exportRecoveryData();
  },
  'persist-retry': () => Persist.retryPending(),
  'legacy-import-discover': () => {
    void discoverLegacyImport();
  },
  'legacy-import-unlock': () => {
    void unlockLegacyImport();
  },
  'legacy-import-apply': () => {
    void applyLegacyImport();
  },
  'legacy-import-clear': () => clearLegacyBrowserData(),
  'copy-export': async () => {
    if (Object.keys(ui.integrityIssues).length)
      return toast('O backup normal não foi copiado para evitar omitir dados locais inválidos.', 'warning');
    if (
      !(await confirmInDialog(
        'O backup copiado não tem proteção própria por senha e pode incluir dados financeiros, de saúde e do ciclo. Guarde-o em um local privado. Deseja continuar?',
      ))
    )
      return;
    const ta = $('#exp');
    try {
      await navigator.clipboard.writeText(ta.value);
      toast('Backup copiado.', 'success');
    } catch (error) {
      ta.focus();
      ta.select();
      toast('O backup foi selecionado. Copie manualmente e guarde-o em um local privado.', 'warning');
    }
    S.settings.prefs.lastBackup = new Date().toISOString();
    saveSlices('settings');
  },
  'import-apply': async (button) => {
    const p = ui.dlg && ui.dlg.d && ui.dlg.d.parsed;
    if (!p) {
      toast('Não foi possível localizar os dados do backup.', 'warning');
      return;
    }

    const previousState = Object.fromEntries(SLICES.map((k) => [k, S[k]]));
    const previousStamps = Object.fromEntries(SLICES.map((k) => [k, stamps[k]]));
    const blockedBefore = new Set(ui.persistBlocked);
    const failedBefore = new Set(ui.persistFailed);
    const issuesBefore = { ...ui.integrityIssues };

    const restoreSet = (target, snapshot) => {
      target.clear();
      for (const value of snapshot) target.add(value);
    };

    const restoreMetadata = () => {
      for (const k of SLICES) {
        S[k] = previousState[k];

        if (previousStamps[k] === undefined) {
          delete stamps[k];
        } else {
          stamps[k] = previousStamps[k];
        }
      }

      restoreSet(ui.persistBlocked, blockedBefore);
      restoreSet(ui.persistFailed, failedBefore);
      ui.integrityIssues = { ...issuesBefore };
    };

    if (S.settings.prefs.birthdayCorrectionUsed) {
      p.settings.prefs.birthday = S.settings.prefs.birthday;
      p.settings.prefs.birthdayCorrectionUsed = true;
      p.settings.profile.age = S.settings.profile.age;
    }
    if (typeof S.settings.prefs.releaseNotesSeen === 'string') {
      p.settings.prefs.releaseNotesSeen = S.settings.prefs.releaseNotesSeen;
    } else {
      delete p.settings.prefs.releaseNotesSeen;
    }
    for (const k of SLICES) S[k] = p[k];
    if (Persist.replacing) return;
    Persist.replacing = true;
    button.disabled = true;
    try {
      await Persist.replaceAll();
    } catch (error) {
      restoreMetadata();
      render();
      console.error('Aurora: a restauração relacional do backup não foi concluída.', error);
      toast('A restauração não foi confirmada. Os dados anteriores foram mantidos.', 'error');
      return;
    } finally {
      Persist.replacing = false;
    }

    ui.settingsDraft = null;
    ui.settingsDraftBase = null;
    ui.dlg = null;
    ui.financeValuesHidden = S.settings.prefs.financeValuesHidden;
    render();
    toast('Backup restaurado na sua conta.', 'success');
  },
  'wipe-ask': () => dlgOpen('wipe'),
  wipe: async (button) => {
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    toast('Verificando e apagando os dados…', 'info');
    try {
      const synchronized = await Persist.flush();
      if (!synchronized) {
        button.disabled = false;
        button.removeAttribute('aria-busy');
        toast(
          ui.persistError
            ? `Não foi possível confirmar os dados salvos. ${ui.persistError} Nada foi apagado.`
            : 'Não foi possível confirmar que seus dados estão salvos. Nada foi apagado; tente novamente.',
          'warning',
        );
        return;
      }
      await Persist.clear();
    } catch (error) {
      button.disabled = false;
      button.removeAttribute('aria-busy');
      console.error('Aurora: a exclusão dos dados relacionais falhou.', error);
      toast(
        error instanceof Error
          ? error.message
          : 'Não foi possível confirmar a exclusão dos dados. Recarregue a página para conferir o estado da conta antes de tentar novamente.',
        'error',
      );
      return;
    }

    setS(defaults());
    ui.financeValuesHidden = S.settings.prefs.financeValuesHidden;
    ui.settingsDraft = null;
    ui.settingsDraftBase = null;
    ui.persistBlocked.clear();
    ui.persistFailed.clear();
    ui.integrityIssues = {};
    syncState.pending.clear();
    syncState.failed.clear();
    syncState.conflicts.clear();
    ui.dlg = createDialog('wipe-complete', {});
    ui.dlgPending = null;
    resetSettingsTabBeforeLeaving();
    nav('inicio');
  },
  'wipe-home': () => {
    ui.dlg = null;
    render();
  },
};
