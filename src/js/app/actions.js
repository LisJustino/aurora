import { pk, today } from '../utils/dates.js';
import { newId } from '../utils/ids.js';
import { habitIsSkipped } from '../features/habits/model.js';
import { waterGoalForHabit, waterGoalReached, waterMlForDay } from '../features/habits/water-goal.js';
import { createDialog } from './dialogs.js';
import { onboardingTourAreas } from './onboarding.js';
import { saveSlicesWithRollback, snapshotSlices } from './persistence.js';
import { render } from './render.js';
import { toast } from './samples-backup.js';
import { setAreaEnabled, vibrateFeedback } from './shell.js';
import { maybeOpenReleaseNotes } from './startup.js';
import { S, ui } from './state.js';
import { CYCLE_ACTIONS } from './actions-cycle.js';
import { HABIT_ACTIONS } from './actions-habits.js';
import { PLANNING_ACTIONS } from './actions-planning.js';
import { SETTINGS_ACTIONS } from './actions-settings.js';
import { DATA_ACTIONS } from './actions-data.js';
import { ONBOARDING_ACTIONS } from './actions-onboarding.js';
import { GENERAL_ACTIONS } from './actions-general.js';

// Ações por clique
export function recordWaterEntry(amount, habit) {
  const day = today();
  const target = waterGoalForHabit(habit, S.settings.prefs.waterGoalMl);
  const reached = waterGoalReached(waterMlForDay(S.water, day) + amount, target);
  const completing = Boolean(
    habit &&
    reached &&
    habit.days.includes(pk(day).getDay()) &&
    !habitIsSkipped(habit, day, day) &&
    !habit.completions.includes(day),
  );
  const slices = ['water', ...(completing ? ['habits'] : [])];
  const snapshot = snapshotSlices(slices);
  S.water.push({ id: newId(), ml: amount, at: new Date().toISOString() });
  if (completing) habit.completions.push(day);
  const saved = saveSlicesWithRollback(slices, snapshot, false, 'o registro de água');
  if (!saved) return false;
  render();
  vibrateFeedback(completing ? 'success' : 'light');
  toast(
    completing
      ? `Meta diária atingida! ${amount.toLocaleString('pt-BR')} mL registrados.`
      : `${amount.toLocaleString('pt-BR')} mL registrados.`,
    'success',
  );
  return true;
}
export function focusQuickActionsTrigger() {
  const trigger = [...document.querySelectorAll('.nav-quick-trigger')].find(
    (element) => element.getClientRects().length > 0,
  );
  trigger?.focus();
}

export const ACTIONS = {};
export function finishOnboard(skip = false, tutorialRoute = '') {
  const d = ui.dlg.d;
  if (tutorialRoute && !onboardingTourAreas(d).some((area) => area.id === tutorialRoute)) {
    console.error('Aurora: tutorial de primeiro acesso solicitado para uma área indisponível.', tutorialRoute);
    toast('Não foi possível abrir esse tutorial. Escolha um dos guias disponíveis.', 'info');
    return false;
  }
  const snapshot = snapshotSlices(['settings']);
  Object.assign(S.settings, { onboardingComplete: true, introSeen: true });
  if (!skip) {
    S.settings.theme = d.theme;
    Object.keys(S.settings.areas).forEach((area) => {
      if (d.areas[area] && !S.settings.areas[area]) setAreaEnabled(S.settings, area, true);
      else if (!d.areas[area]) S.settings.areas[area] = false;
    });
  }
  if (!saveSlicesWithRollback(['settings'], snapshot, false, 'a personalização inicial')) {
    render();
    return false;
  }
  ui.dlg = tutorialRoute
    ? createDialog('area-tutorial', { route: tutorialRoute, afterOnboarding: true })
    : ui.returnDialog;
  ui.returnDialog = null;
  render();
  toast(
    skip ? 'Personalização inicial pulada. Você pode ativar áreas em Ajustes.' : 'Aurora personalizado para você.',
    'info',
  );
  if (!tutorialRoute) void maybeOpenReleaseNotes();
  return true;
}

export function registerActions() {
  Object.assign(
    ACTIONS,
    CYCLE_ACTIONS,
    HABIT_ACTIONS,
    PLANNING_ACTIONS,
    SETTINGS_ACTIONS,
    DATA_ACTIONS,
    ONBOARDING_ACTIONS,
    GENERAL_ACTIONS,
  );
}
