import { h } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { AREA_GUIDE_IDS, AREA_GUIDES } from '../features/area-guides.js';
import { canAccessCycle } from '../features/cycle/access.js';
import { hexOk, PALETTES } from '../features/appearance/palettes.js';
import { CAT_ICONS, categoryLeafName, LIST_COLORS, norm } from './core.js';
import {
  closeBtn,
  dlgActionConfirm,
  dlgConfirmation,
  dlgCycleLog,
  dlgCyclePeriod,
  dlgCycleReport,
  dlgHabitBulk,
  dlgHabitEdit,
  dlgReleaseNotes,
  dlgSearch,
  dlgTask,
  dlgTaskBulk,
  dlgWipe,
  dlgWipeComplete,
  dlgWrap,
} from './dialogs.js';
import { dlgTx } from './finance-dialogs.js';
import { dlgHabitOtherDay } from './habit-other-day.js';
import { recList } from './finance-extras.js';
import { commit } from './persistence.js';
import { toast } from './samples-backup.js';
import { brandIcon } from './shell.js';
import { S, ui } from './state.js';

// Personalização inicial
export const ONBOARDING_NEEDS = [
  {
    id: 'organization',
    icon: 'calendarCheck',
    title: 'Organizar meu dia',
    description: 'Tarefas, prazos e prioridades.',
    areas: [],
  },
  {
    id: 'habits',
    icon: 'check',
    title: 'Criar bons hábitos',
    description: 'Água, leitura, movimento e outros hábitos.',
    areas: ['habits'],
  },
  {
    id: 'finances',
    icon: 'wallet',
    title: 'Organizar meu dinheiro',
    description: 'Receitas, gastos e objetivos.',
    areas: ['finances'],
  },
  {
    id: 'cycle',
    icon: 'heart',
    title: 'Acompanhar meu ciclo',
    description: 'Registrar sinais e consultar estimativas.',
    areas: ['cycle'],
  },
];
export const ONBOARDING_AREAS = [
  { id: 'habits', icon: 'check', title: 'Hábitos', description: 'Crie uma rotina e acompanhe sua constância.' },
  { id: 'finances', icon: 'wallet', title: 'Finanças', description: 'Organize contas, gastos, receitas e objetivos.' },
  { id: 'cycle', icon: 'heart', title: 'Ciclo', description: 'Registre sinais e acompanhe estimativas do ciclo.' },
];
const ONBOARDING_TOUR_AREAS = [
  { id: 'inicio', icon: 'calendarCheck' },
  { id: 'planejar', icon: 'calendarCheck' },
  { id: 'habitos', icon: 'check' },
  { id: 'financas', icon: 'wallet' },
  { id: 'ciclo', icon: 'heart' },
];
export function onboardingTourAreas(draft) {
  return ONBOARDING_TOUR_AREAS.filter(({ id }) => {
    if (!AREA_GUIDES[id]) return false;
    if (id === 'inicio' || id === 'planejar') return true;
    return draft.areas[id] && (id !== 'ciclo' || canAccessCycle(S.settings.profile, ui.preview));
  });
}
export function refreshOnboardingRecommendations(draft) {
  const recommended = new Set(
    ONBOARDING_NEEDS.filter((need) => draft.needs.includes(need.id)).flatMap((need) => need.areas),
  );
  draft.recommendedAreas = [...recommended];
  draft.areas = { ...draft.originalAreas };
  recommended.forEach((area) => {
    draft.areas[area] = true;
  });
  Object.entries(draft.areaOverrides).forEach(([area, enabled]) => {
    draft.areas[area] = enabled;
  });
}
function dlgOnboard() {
  const d = ui.dlg.d,
    st = d.step;
  const onboardingNeeds = ONBOARDING_NEEDS.filter(
    (need) => need.id !== 'cycle' || canAccessCycle(S.settings.profile, ui.preview),
  );
  const onboardingAreas = ONBOARDING_AREAS.filter(
    (area) => area.id !== 'cycle' || canAccessCycle(S.settings.profile, ui.preview),
  );
  const dots = h`<div class="steps" aria-label="Passo ${st + 1} de 5">${[0, 1, 2, 3, 4].map(
    (i) => h`<i
    class="${i <= st ? 'on' : ''}"></i>`,
  )}</div>`;
  let body, foot;
  if (st === 0) {
    const overviewAreas = [
      {
        id: 'inicio',
        icon: 'calendarCheck',
        title: 'Início',
        description: 'Veja o que importa hoje e encontre atalhos para agir.',
      },
      {
        id: 'planejar',
        icon: 'calendarCheck',
        title: 'Planejar',
        description: 'Organize tarefas com prazos, prioridades e diferentes visualizações.',
      },
      { id: 'habitos', icon: 'check', title: 'Hábitos', description: 'Crie hábitos e marque o que fez em cada dia.' },
      {
        id: 'financas',
        icon: 'wallet',
        title: 'Finanças',
        description: 'Cadastre contas manualmente e acompanhe receitas, gastos e objetivos.',
      },
      ...(canAccessCycle(S.settings.profile, ui.preview)
        ? [
            {
              id: 'ciclo',
              icon: 'heart',
              title: 'Ciclo',
              description: 'Registre informações e consulte estimativas baseadas no seu histórico.',
            },
          ]
        : []),
    ];
    body = h`${dots}<div class="onboard-overview">
      <div class="onboard-intro"><span class="onboard-brand">${brandIcon(52)}</span><div class="wiz-h"><span
        class="eyebrow">Conheça o Aurora</span><h2
        id="dt">Tarefas, hábitos, dinheiro e ciclo num lugar só</h2><p>Ative só as áreas que você vai usar. Dá para mudar isso depois, em Ajustes.</p></div></div>
      <div class="onboard-overview-cards"
        aria-label="O que você pode fazer no Aurora">${overviewAreas.map(
          (area) => h`<article
        class="onboard-overview-card"><span class="mk">${icon(area.icon, 20)}</span><span
        class="tx"><b>${area.title}</b><span>${area.description}</span></span></article>`,
        )}</div>
      ${
        canAccessCycle(S.settings.profile, ui.preview)
          ? h`<p
        class="fine">${icon('info', 15)} Ciclo é opcional e só fica disponível com consentimento específico.</p>`
          : ''
      }
    </div>`;
    foot = h`<button class="btn back" data-action="ob-skip">Pular personalização</button><button class="btn primary"
      data-action="ob-next">Vamos personalizar</button>`;
  } else if (st === 1) {
    body = h`${dots}<div class="onboard-intro"><span class="onboard-brand">${brandIcon(52)}</span><div
      class="wiz-h"><span class="eyebrow">Personalização inicial</span><h2
      id="dt">O que você quer melhorar no seu dia a dia?</h2><p>Escolha uma ou mais opções; você pode mudar depois.</p></div></div>
      <fieldset class="onboard-fieldset"><legend>Escolha o que faz sentido para você agora.</legend><div
        class="onboard-options">${onboardingNeeds.map(
          (need) => h`<button type="button" class="opt"
        aria-pressed="${d.needs.includes(need.id)}" data-action="ob-need" data-v="${need.id}"><span
        class="mk">${icon(need.icon, 22)}</span><span
        class="tx"><b>${need.title}</b><span>${need.description}</span></span><span
        class="tick">${icon('check', 15)}</span></button>`,
        )}</div></fieldset>
      <p class="fine">${icon('info', 15)} Suas tarefas e seu planejamento já ficam disponíveis; não é preciso ativar uma área para começar a se organizar.</p>`;
    foot = h`<button class="btn back" data-action="ob-skip">Pular personalização</button><button class="btn primary"
      data-action="ob-next">Ver sugestões</button>`;
  } else if (st === 2) {
    const solutionIds = onboardingAreas.filter((area) => d.areas[area.id] || d.recommendedAreas.includes(area.id));
    const hasOrganizationNeed = d.needs.includes('organization');
    body = h`${dots}<div class="wiz-h"><h2
      id="dt">Estas ferramentas podem ajudar</h2><p>Ativamos as sugestões a partir das suas respostas. Desmarque o que não quiser usar agora.</p></div>
      ${
        hasOrganizationNeed
          ? h`<article class="onboard-solution-note"><span
        class="mk">${icon('calendarCheck', 22)}</span><span
        class="tx"><b>Planejar</b><span>Tarefas, prazos e prioridades já estão disponíveis para organizar seu dia.</span></span><span
        class="onboard-always-on">Sempre disponível</span></article>`
          : ''
      }
      ${
        solutionIds.length
          ? h`<fieldset class="onboard-fieldset"><legend>Áreas do Aurora</legend><div
        class="onboard-solution-list">${solutionIds.map(
          (area) => h`<button type="button" class="opt onboard-solution"
        aria-pressed="${!!d.areas[area.id]}" data-action="ob-area" data-v="${area.id}"><span
        class="mk">${icon(area.icon, 22)}</span><span
        class="tx"><b>${area.title}</b><span>${area.description}</span><small>${d.recommendedAreas.includes(area.id) ? 'Sugestão baseada nas suas respostas' : 'Já estava ativa na sua conta'}</small></span><span
        class="tick">${icon('check', 15)}</span></button>`,
        )}</div></fieldset>`
          : h`<p
        class="notice">${icon('sparkles', 18)}<span>Nenhuma área adicional selecionada. Você pode ativá-las quando quiser em Ajustes.</span></p>`
      }
      <p class="fine">${icon('info', 15)} Você pode mudar essas escolhas depois em Ajustes → Áreas e menu.</p>`;
    foot = h`<button class="btn back" data-action="ob-skip">Pular personalização</button><button class="btn back"
      data-action="ob-back">Voltar</button><button class="btn primary" data-action="ob-next">Continuar</button>`;
  } else if (st === 3) {
    body = h`${dots}<div class="wiz-h"><h2
      id="dt">Deixe o Aurora com a sua cara</h2><p>Essas opções são opcionais e você pode alterá-las depois em Ajustes.</p></div>
      <div class="onboard-theme"><span class="f-label">Cor do app</span><div
        class="swatches">${Object.entries(PALETTES).map(
          ([key, [name, color]]) => h`<button type="button" class="swatch"
        aria-pressed="${d.theme === key}" data-action="ob-theme" data-v="${key}"><i
        style="background:${color}"></i>${name}</button>`,
        )}</div></div>`;
    foot = h`<button class="btn back" data-action="ob-skip">Pular personalização</button><button class="btn back"
      data-action="ob-back">Voltar</button><button class="btn primary" data-action="ob-next">Continuar</button>`;
  } else {
    const tourAreas = onboardingTourAreas(d);
    body = h`${dots}<div class="wiz-h"><span class="eyebrow">Guia opcional</span><h2
      id="dt">Quer conhecer o que dá para fazer?</h2><p>Escolha uma área para abrir o guia rápido ao concluir. Você também pode abrir quando quiser pelo ícone “?” no canto superior direito de cada tela.</p></div>
      <div class="onboard-tour-cards" aria-label="Guias disponíveis">${tourAreas.map((area) => {
        const guide = AREA_GUIDES[area.id];
        return h`<button type="button" class="opt onboard-tour-card" data-action="ob-finish-guide"
          data-route="${area.id}"><span class="mk">${icon(area.icon, 20)}</span><span
          class="tx"><b>${guide.title}</b><span>${guide.summary}</span><small>Concluir e abrir guia</small></span>${icon('chevRight', 16, 'onboard-tour-play')}</button>`;
      })}</div>
      <p class="fine">${icon('info', 15)} Os guias mostram os principais recursos, passos e atalhos reais de cada área.</p>`;
    foot = h`<button class="btn back" data-action="ob-skip">Pular personalização</button><button class="btn back"
      data-action="ob-back">Voltar</button><button class="btn primary"
      data-action="ob-finish">Concluir e começar</button>`;
  }
  return dlgWrap(body, foot, st === 0 ? 'onboard-needs-dialog' : '');
}
function dlgExport() {
  if (Object.keys(ui.integrityIssues).length) {
    return dlgWrap(
      h`<div class="head head-nowrap"><h2 id="dt">Backup indisponível</h2>${closeBtn}</div><p class="notice warn"
        role="alert">Há fatias locais inválidas. Baixe uma cópia bruta ou importe um backup confiável antes de criar um backup normalizado.</p>`,
      h`<button class="btn" data-action="recovery-export">Baixar cópia de recuperação</button><button class="btn back"
        data-action="dlg-close">Fechar</button>`,
    );
  }
  return dlgWrap(
    h`<div class="head head-nowrap"><h2
      id="dt">${ui.dlg.d.kind === 'csv' ? 'Seus lançamentos' : 'Seu backup'}</h2>${closeBtn}</div>
    <p class="small muted">${ui.dlg.d.kind === 'csv' ? 'O download direto não está disponível aqui. Copie o texto e salve em um arquivo .csv.' : 'O download direto não está disponível aqui. Copie o conteúdo e salve em um arquivo de backup para importar depois.'}</p>
    <textarea id="exp" class="finance-export-json" readonly rows="8">${ui.dlg.d.json}</textarea>`,
    h`<button class="btn back" data-action="dlg-close">Fechar</button><button class="btn primary"
      data-action="copy-export">Copiar</button>`,
  );
}
function dlgImport() {
  const p = ui.dlg.d.parsed;
  return dlgWrap(
    h`<div class="head"><div><h2 id="dt">Importar este backup?</h2><p
      class="small muted">Revise o conteúdo validado antes de substituir os dados atuais. Configurações e perfil também serão restaurados.</p></div>${closeBtn}</div>
    <ul class="backup-preview">
      <li><span>Tarefas</span><b>${p.tasks.length}</b></li>
      <li><span>Hábitos</span><b>${p.habits.length}</b></li>
      <li><span>Contas financeiras</span><b>${p.finance.accounts.length}</b></li>
      <li><span>Lançamentos financeiros</span><b>${p.finance.tx.length}</b></li>
      <li><span>Orçamentos, objetivos e contas fixas</span><b>${Object.keys(p.finance.budgets).length} · ${p.finance.goals.length} · ${p.finance.recurring.length}</b></li>
      <li><span>Registros de hidratação</span><b>${p.water.length}</b></li>
      <li><span>Períodos e dias de ciclo</span><b>${p.cycle.length} · ${Object.keys(p.cycleLog).length}</b></li>
      <li><span>Registros de peso</span><b>${p.weight.length}</b></li>
      <li><span>Itens na lixeira</span><b>${p.settings.prefs.trash.length}</b></li>
    </ul>
    <div class="notice warn"
      role="alert">${icon('alert', 18)}<span>Esta opção não mescla os dados. Ao confirmar, todos os dados relacionais atuais desta conta serão substituídos pelo conteúdo do backup. Para manter uma cópia dos dados atuais, cancele e exporte um backup antes.</span></div>`,
    h`<button class="btn back" data-action="dlg-close">Cancelar</button><button class="btn primary"
      data-action="import-apply">Substituir meus dados</button>`,
  );
}
function dlgAreaTutorial() {
  const activeRoute = ui.dlg.d.route;
  const guide = AREA_GUIDES[activeRoute];
  if (!guide)
    return dlgWrap(
      h`<div class="head"><h2 id="dt">Guia indisponível</h2>${closeBtn}</div><p
        role="alert">Não foi possível localizar o guia desta área.</p>`,
      h`<button class="btn back" data-action="dlg-close">Fechar</button>`,
    );
  const availableGuides = AREA_GUIDE_IDS.filter(
    (id) => id !== 'ciclo' || canAccessCycle(S.settings.profile, ui.preview),
  );
  const features = Array.isArray(guide.features) ? guide.features : [];
  const tips = Array.isArray(guide.tips) ? guide.tips : [];
  return dlgWrap(
    h`<div class="head area-tutorial-head"><div><p class="section-kicker">Guia rápido</p><h2
      id="dt">Como usar ${guide.title}</h2></div>${closeBtn}</div>
    <div class="area-guide-tabs" role="tablist" aria-label="Escolher guia de outra área">${availableGuides.map((id) => {
      const item = AREA_GUIDES[id];
      const selected = id === activeRoute;
      return h`<button type="button" class="chip area-guide-tab" role="tab" aria-selected="${String(selected)}"
        data-action="area-guide-switch" data-area-guide="${id}">${icon(item.icon || 'help', 15)}${item.title}</button>`;
    })}</div>
    <p class="area-tutorial-intro">${guide.summary}</p>
    ${
      features.length
        ? h`<section class="area-guide-section" aria-labelledby="area-guide-features-title">
      <h3 id="area-guide-features-title">O que você pode fazer aqui</h3>
      <ul class="area-guide-grid">${features.map(
        (feature) => h`<li class="area-guide-card">
          <span class="area-guide-card-icon" aria-hidden="true">${icon(feature.icon || 'sparkles', 18)}</span>
          <div class="area-guide-card-copy">
            <b>${feature.title}</b>
            <p>${feature.text}</p>
            ${feature.where ? h`<span class="area-guide-where">${feature.where}</span>` : ''}
          </div>
        </li>`,
      )}</ul>
    </section>`
        : ''
    }
    <section class="area-guide-section area-guide-steps-box" aria-labelledby="area-guide-steps-title">
      <h3 id="area-guide-steps-title">Por onde começar</h3>
      <ol class="area-guide-steps">${guide.steps.map(
        (step) => h`<li><strong>${step.title}</strong><span>${step.text}</span></li>`,
      )}</ol>
    </section>
    ${
      tips.length
        ? h`<section class="area-guide-section area-guide-tips" aria-labelledby="area-guide-tips-title">
      <h3 id="area-guide-tips-title">${icon('sparkles', 16)}Dicas e atalhos</h3>
      <ul>${tips.map((tip) => h`<li>${tip}</li>`)}</ul>
    </section>`
        : ''
    }
    ${guide.note ? h`<p class="area-guide-note">${icon('info', 16)}<span>${guide.note}</span></p>` : ''}`,
    h`<button class="btn primary" data-action="dlg-close">Entendi</button>`,
    'area-tutorial-body',
  );
}
export function listArr(g) {
  return S.settings.cats[g];
}
export function findCategory(g, name, parentName = '') {
  const categories = listArr(g);
  if (parentName) {
    const parent = categories.find((category) => norm(category.name) === norm(parentName));
    return parent?.subcategories?.find((category) => norm(categoryLeafName(category)) === norm(name)) || null;
  }
  return categories.find((category) => norm(category.name) === norm(name)) || null;
}
export function addItem(g, name, parentName = '', color = '', iconName = '') {
  const arr = listArr(g),
    value = String(name || '')
      .trim()
      .slice(0, 30);
  if (!value) return '';
  const parent = String(parentName || '').trim();
  if (parent) {
    const parentEntry = arr.find((category) => norm(category.name) === norm(parent));
    if (parentEntry) {
      const subcategories = Array.isArray(parentEntry.subcategories) ? parentEntry.subcategories : [];
      const existing = subcategories.find((category) => norm(categoryLeafName(category)) === norm(value));
      if (existing) return `${parentEntry.name} > ${categoryLeafName(existing)}`;
      parentEntry.subcategories = [
        ...subcategories,
        {
          name: value,
          color: hexOk(color) ? color : parentEntry.color,
          icon: CAT_ICONS.includes(iconName) ? iconName : parentEntry.icon,
          subcategories: [],
        },
      ];
      return `${parentEntry.name} > ${value}`;
    }
  }
  const ex = arr.find((category) => norm(category.name) === norm(value));
  if (ex) return ex.name;
  arr.push({
    name: value,
    color: hexOk(color) ? color : LIST_COLORS[arr.length % LIST_COLORS.length],
    icon: CAT_ICONS.includes(iconName) ? iconName : 'tag',
    subcategories: [],
  });
  return value;
}
export function replaceCategoryReferences(oldPath, newPath) {
  if (oldPath === newPath) return false;
  if (Object.hasOwn(S.finance.budgets, oldPath) && Object.hasOwn(S.finance.budgets, newPath)) return null;
  let changed = false;
  [S.finance.tx, recList()].forEach((records) =>
    records.forEach((record) => {
      if (record.category === oldPath) {
        record.category = newPath;
        changed = true;
      }
    }),
  );
  S.settings.prefs.financeCategoryRules.forEach((rule) => {
    if (rule.category === oldPath) {
      rule.category = newPath;
      changed = true;
    }
  });
  if (Object.hasOwn(S.finance.budgets, oldPath)) {
    Object.defineProperty(S.finance.budgets, newPath, {
      value: S.finance.budgets[oldPath],
      enumerable: true,
      writable: true,
      configurable: true,
    });
    delete S.finance.budgets[oldPath];
    changed = true;
  }
  const budgetSettings = S.settings.prefs.financeBudgetSettings;
  if (Object.hasOwn(budgetSettings, oldPath)) {
    Object.defineProperty(budgetSettings, newPath, {
      value: budgetSettings[oldPath],
      enumerable: true,
      writable: true,
      configurable: true,
    });
    delete budgetSettings[oldPath];
    changed = true;
  }
  return changed;
}
export function resolveNew(g, d, key) {
  if (d[key] !== '__new') return true;
  const n = String(d.newName || '')
    .trim()
    .slice(0, 30);
  if (!n) {
    toast('Dê um nome para a nova opção.', 'info');
    return false;
  }
  const parentName = String(d.newParent || '').trim();
  d[key] = addItem(g, n, parentName, d.newColor, d.newIcon);
  d.newName = '';
  d.newParent = '';
  d.newColor = '';
  d.newIcon = '';
  commit('settings');
  return true;
}
export const DLG = {
  task: dlgTask,
  taskbulk: dlgTaskBulk,
  habitbulk: dlgHabitBulk,
  'habit-other-day': dlgHabitOtherDay,
  tx: dlgTx,
  'cycle-log': dlgCycleLog,
  'cycle-period': dlgCyclePeriod,
  'cycle-report': dlgCycleReport,
  'habit-edit': dlgHabitEdit,
  search: dlgSearch,
  'action-confirm': dlgActionConfirm,
  confirmation: dlgConfirmation,
  'release-notes': dlgReleaseNotes,
  wipe: dlgWipe,
  'wipe-complete': dlgWipeComplete,
  onboard: dlgOnboard,
  'area-tutorial': dlgAreaTutorial,
  export: dlgExport,
  import: dlgImport,
};
DLG.discard = () =>
  dlgWrap(
    h`<div class="head"><div><h2 id="dt">Descartar alterações?</h2><p
      class="small muted">Há alterações que ainda não foram salvas. Se sair agora, elas serão perdidas.</p></div></div>`,
    h`<button type="button" class="btn" data-action="dlg-keep">Continuar editando</button><button type="button"
      class="btn danger" data-action="dlg-discard">Descartar alterações</button>`,
  );
