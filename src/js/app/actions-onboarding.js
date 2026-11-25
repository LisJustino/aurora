import { finishOnboard } from './actions.js';
import {
  ONBOARDING_AREAS,
  ONBOARDING_NEEDS,
  onboardingTourAreas,
  refreshOnboardingRecommendations,
} from './onboarding.js';
import { render } from './render.js';
import { toast } from './samples-backup.js';
import { ui } from './state.js';

export const ONBOARDING_ACTIONS = {
  'ob-theme': (el) => {
    ui.dlg.d.theme = el.dataset.v;
    render();
  },
  'ob-next': () => {
    if (ui.dlg.d.step === 1) refreshOnboardingRecommendations(ui.dlg.d);
    ui.dlg.d.step++;
    render();
  },
  'ob-back': () => {
    ui.dlg.d.step--;
    render();
  },
  'ob-need': (el) => {
    const need = el.dataset.v;
    if (!ONBOARDING_NEEDS.some((item) => item.id === need)) return;
    const selected = new Set(ui.dlg.d.needs);
    if (selected.has(need)) selected.delete(need);
    else selected.add(need);
    ui.dlg.d.needs = [...selected];
    refreshOnboardingRecommendations(ui.dlg.d);
    render();
  },
  'ob-area': (el) => {
    const area = el.dataset.v;
    if (!ONBOARDING_AREAS.some((item) => item.id === area)) return;
    ui.dlg.d.areas[area] = !ui.dlg.d.areas[area];
    ui.dlg.d.areaOverrides[area] = ui.dlg.d.areas[area];
    render();
  },
  'ob-skip': () => finishOnboard(true),
  'ob-finish': () => finishOnboard(),
  'ob-finish-guide': (el) => {
    const route = el.dataset.route;
    if (!onboardingTourAreas(ui.dlg.d).some((area) => area.id === route)) {
      console.error('Aurora: tutorial de primeiro acesso solicitado para uma área indisponível.', route);
      toast('Não foi possível abrir esse tutorial. Escolha um dos guias disponíveis.', 'info');
      return;
    }
    finishOnboard(false, route);
  },
};
