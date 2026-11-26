import { h, raw } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { brl as formatBRL } from '../utils/currency.js';
import { MESES_L, today } from '../utils/dates.js';
import { emptyState } from '../utils/empty-state.js';
import { lockPageScroll } from '../utils/scroll-lock.js';
import { routePathFor } from '../core/router.js';
import { renderFeedbackPrompt } from '../features/feedback/prompt.js';
import { AREA_GUIDES } from '../features/area-guides.js';
import { canAccessCycle } from '../features/cycle/access.js';
import { renderFooterContent, renderLegalDialog } from '../features/footer/view.js';
import { normalizeProfileAppearance, timeBasedGreeting } from '../features/profile/model.js';
import { habitIsSkipped, isWaterHabit } from '../features/habits/model.js';
import { waterGoalForHabit, waterGoalReached, waterMlForDay } from '../features/habits/water-goal.js';
import { PALETTES } from '../features/appearance/palettes.js';
import { HIDDEN_MENU_IDS, MENU_ITEMS, normalizeVisibleMenuItems, orderMenuItems } from '../features/navigation/menu.js';
import { weekDays, weeklyReview } from '../features/planning/week.js';
import { monthBudgetProgress, weekSpending } from '../features/planning/week-finance.js';
import { renderWeeklyReviewView } from '../features/planning/review-view.js';
import { triggerHapticFeedback } from '../services/native-experience.js';

import { releaseDialogScroll, setReleaseDialogScroll } from './dialogs.js';
import { isCredit, upcomingDueItems } from './finance-view.js';
import { habitCompletedFor } from './home.js';
import { Persist } from './persistence.js';
import { modeBtn, taskRow } from './render.js';
import { toast } from './samples-backup.js';
import { accountSession, S, syncState, ui, updateSettingsDraft, weekStartDay } from './state.js';

/* Ícones: src/js/utils/icons.js */
const GRAD = raw(
  '<svg class="app-definitions" width="0" height="0" aria-hidden="true"><defs><linearGradient id="auroraGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#D991AA"/><stop offset="1" stop-color="#8D4665"/></linearGradient></defs></svg>',
);
export const brandIcon = (size = 40) =>
  raw(
    `<svg width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="18"
      fill="url(#auroraGrad)"/><path d="M32 14 46 48h-7.5l-2.600-6.800H28.100L25.5 48H18zm0 12.5-3.200 8.5h6.400z"
      fill="#fff"/><circle cx="46.5" cy="17.5" r="4" fill="#FBE7D3"/></svg>`,
  );

// Casca, roteamento e componentes comuns
const ROUTE_TITLES = {
  inicio: 'Início',
  planejar: 'Planejar',
  financas: 'Finanças',
  ciclo: 'Ciclo',
  habitos: 'Hábitos',
  config: 'Ajustes',
};
export const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
export const brl = (cents) => (ui.route === 'financas' && ui.financeValuesHidden ? '••••' : formatBRL(cents));
export const money = (cents) =>
  ui.route === 'financas' && ui.financeValuesHidden
    ? h`<span class="money" aria-label="Valor oculto">••••</span>`
    : h`<span class="money">${formatBRL(cents)}</span>`;
export const expenseTitle = (name) =>
  String(name ?? '').replace(/^(\s*\p{L})/u, (first) => first.toLocaleUpperCase('pt-BR'));
export const tabLabel = (label) => h`<span class="tab-label-group"><span class="tab-label">${label}</span></span>`;
const brandLink = h`<a class="brand" href="/inicio" aria-label="aurora., início">${brandIcon(36)}<span
  class="wordmark">aurora<i>.</i></span></a>`;

export function updateDocumentTitle() {
  const title = ROUTE_TITLES[ui.route] || 'aurora.';
  document.title = `${title} | aurora.`;
}
export function acquireActiveScrollLocks() {
  if (ui.dlg && !releaseDialogScroll) setReleaseDialogScroll(lockPageScroll());
}
/* Erro junto ao campo: marca o campo, escreve a mensagem logo abaixo e leva o foco até ele.
   Só mexe no DOM do diálogo aberto; some quando a pessoa volta a digitar. Cai para o aviso se não achar o campo. */
export function fieldError(message, selector) {
  const field = selector ? document.querySelector(`#dlg ${selector}`) : null;
  if (!field) return toast(message, 'info');
  const label = field.type === 'checkbox' ? field.closest('fieldset') : field.closest('label') || field.parentElement;
  label.querySelector('.field-err')?.remove();
  const note = document.createElement('span');
  note.className = 'err field-err';
  note.id = `err-${Math.random().toString(36).slice(2, 8)}`;
  note.setAttribute('role', 'alert');
  note.textContent = message;
  label.append(note);
  field.setAttribute('aria-invalid', 'true');
  field.setAttribute('aria-describedby', note.id);
  const inputTarget = field.type === 'checkbox' ? label : field;
  const clear = () => {
    note.remove();
    field.removeAttribute('aria-invalid');
    field.removeAttribute('aria-describedby');
    inputTarget.removeEventListener('input', clear);
    inputTarget.removeEventListener('change', clear);
  };
  inputTarget.addEventListener('input', clear);
  inputTarget.addEventListener('change', clear);
  field.focus();
}
export function completionFeedback(selector) {
  requestAnimationFrame(() => {
    const target = document.querySelector(selector);
    if (!target) return;
    target.classList.remove('completion-feedback');
    void target.offsetWidth;
    target.classList.add('completion-feedback');
    setTimeout(() => target.classList.remove('completion-feedback'), 760);
  });
}
export function vibrateFeedback(kind = 'light') {
  if (S.settings.prefs.vibrationEnabled === false) return;
  triggerHapticFeedback(kind);
}
export function updateAccessibilityLook(updates, focusId) {
  updateSettingsDraft((settings) => {
    settings.look = { ...settings.look, ...updates };
  });
  if (focusId) document.getElementById(focusId)?.focus();
}
export function shell(body) {
  const overdue = S.tasks.filter((t) => !t.done && t.dueDate && t.dueDate < today()).length;
  const menuAreas = { ...S.settings.areas, cycle: areaOn('cycle') };
  const menuItems = orderMenuItems(
    S.settings.prefs.menuOrder,
    menuAreas,
    false,
    S.settings.prefs.visibleMenuItems,
    HIDDEN_MENU_IDS,
  );
  const hasActiveArea = Object.values(menuAreas).some(Boolean);
  const isCurrent = (id) => id === ui.route;
  const feedbackPrompt = ui.feedbackPromptVisible ? renderFeedbackPrompt() : '';
  // No celular a barra comporta as 5 áreas visíveis (o "+" de criar e o perfil ficam no topo). O "Mais" só aparece se um dia houver mais de 5.
  const MOBILE_NAV_PRIMARY = 5;
  const overflowItems = menuItems.slice(MOBILE_NAV_PRIMARY);
  const navLink = ({ id, label, icon: iconName, area }, index) =>
    h`<a class="nav-item" href="/${id}"
      data-route="${id}" ${index >= MOBILE_NAV_PRIMARY ? raw('data-overflow="true"') : ''} ${isCurrent(id) ? raw('aria-current="page"') : ''}><span
      class="ni">${icon(iconName, area ? 20 : 22)}${
        id === 'planejar' && overdue
          ? h`<span class="dot"
      aria-label="${overdue} tarefas atrasadas"></span>`
          : ''
      }</span>${tabLabel(label)}</a>`;
  const financeQuickActions = !areaOn('finances')
    ? ''
    : !S.finance.accounts.length
      ? h`<button type="button" data-action="quick-action-account"><span
        class="ni">${icon('wallet', 18)}</span><span>Criar conta financeira</span></button>`
      : ui.route === 'financas'
        ? h`
        ${
          S.finance.accounts.length > 1
            ? h`<button type="button" data-action="quick-action-finance"
          data-kind="tr"><span class="ni">${icon('repeat', 18)}</span><span>Transferência</span></button>`
            : ''
        }
        <button type="button" data-action="quick-action-finance" data-kind="in"><span
          class="ni">${icon('plus', 18)}</span><span>Receita</span></button>
        <button type="button" data-action="quick-action-finance" data-kind="out"><span
          class="ni">${icon('arrowDown', 18)}</span><span>Despesa</span></button>
        <button type="button" data-action="quick-action-bulk"><span
          class="ni">${icon('list', 18)}</span><span>Cadastrar vários</span></button>
        ${
          S.finance.accounts.some(isCredit)
            ? h`<button type="button" data-action="quick-action-finance"
          data-kind="card"><span class="ni">${icon('card', 18)}</span><span>Despesa cartão</span></button>`
            : ''
        }`
        : h`<button type="button" data-action="quick-action-transaction"><span
          class="ni">${icon('wallet', 18)}</span><span>Lançamento</span></button>`;
  const isFinanceRoute = ui.route === 'financas';
  const quickActionItems = isFinanceRoute
    ? financeQuickActions
    : h`
      <button type="button" data-action="quick-action-task"><span
        class="ni">${icon('calendarCheck', 18)}</span><span>Nova tarefa</span></button>
      ${
        areaOn('habits')
          ? h`<button type="button" data-action="quick-action-habit"><span
        class="ni">${icon('check', 18)}</span><span>Novo hábito</span></button>`
          : ''
      }
      <button type="button" data-action="quick-action-water"><span
        class="ni">${icon('water', 18)}</span><span>Beber água</span></button>
      ${financeQuickActions}
      ${
        !areaOn('finances') || !S.finance.accounts.length
          ? h`<button type="button"
        data-action="quick-action-expense"><span
        class="ni">${icon('arrowDown', 18)}</span><span>Lançar despesa</span></button>`
          : ''
      }`;
  const quickActionsHeading = isFinanceRoute ? 'Ações de Finanças' : 'Criar rapidamente';
  const quickActions = h`<div class="nav-quick-control${isFinanceRoute ? ' finance-quick-control' : ''}">
    <button type="button" class="nav-quick-trigger iconbtn${isFinanceRoute ? ' finance-fab-trigger' : ''}"
      data-action="quick-actions-toggle" title="Criar" aria-label="Ações rápidas"
      aria-expanded="${String(ui.quickActionsOpen)}" aria-controls="quick-actions-menu">${icon('plus', 20)}</button>
    <div class="quick-actions-menu${isFinanceRoute ? ' finance-quick-actions-menu' : ''}" id="quick-actions-menu"
      role="group" aria-label="${quickActionsHeading}" ${ui.quickActionsOpen ? '' : raw('hidden')}><p
      class="quick-actions-heading">${quickActionsHeading}</p>${quickActionItems}</div>
  </div>`;
  // Em Finanças o menu fica na camada do botão flutuante (desktop); no celular o "+" do topo abre esse mesmo menu.
  const headerQuickActions = isFinanceRoute
    ? h`<button type="button" class="nav-quick-trigger iconbtn finance-header-trigger"
      data-action="quick-actions-toggle" title="Criar" aria-label="Ações rápidas"
      aria-expanded="${String(ui.quickActionsOpen)}" aria-controls="quick-actions-menu">${icon('plus', 20)}</button>`
    : quickActions;
  const financeQuickActionsBackdrop =
    isFinanceRoute && ui.quickActionsOpen
      ? h`<button type="button" class="finance-actions-backdrop" data-action="quick-actions-toggle"
        aria-label="Fechar ações financeiras"></button>`
      : '';
  const financeQuickActionsLayer = isFinanceRoute ? h`${financeQuickActionsBackdrop}${quickActions}` : '';
  const hasOverflow = overflowItems.length > 0;
  const overflowCurrent = overflowItems.some(({ id }) => isCurrent(id));
  const accountAppearance = normalizeProfileAppearance(S.settings.prefs.profileAppearance);
  const profileMenu = h`<details class="profile-menu-control">
    <summary class="profile-link iconbtn profile-menu-trigger${overflowCurrent ? ' is-current' : ''}"
      aria-label="${hasOverflow ? 'Mais áreas' : 'Menu da conta'}" title="${hasOverflow ? 'Mais' : 'Conta'}"
      aria-controls="profile-menu">${
        hasOverflow
          ? h`<span class="ni ni-account">${icon('user', 20)}</span><span
      class="ni ni-more">${icon('more', 20)}</span>`
          : profileAvatarMarkup(accountAppearance, 'profile-menu-avatar', 20)
      }<span
      class="mobile-nav-label">${tabLabel(hasOverflow ? 'Mais' : 'Conta')}</span></summary>
  </details>`;
  const headerProfileMenu = h`<details class="profile-menu-control">
    <summary class="profile-link iconbtn profile-menu-trigger" aria-label="Perfil e conta" title="Perfil e conta"
      aria-controls="profile-menu">${profileAvatarMarkup(accountAppearance, 'profile-menu-avatar', 20)}</summary>
  </details>`;
  const profileMenuPanel = h`<div class="profile-menu-panel" id="profile-menu" role="group"
    aria-label="Perfil e navegação">
    ${
      hasOverflow
        ? h`<div class="nav-overflow-group" role="group"
      aria-label="Mais áreas">${overflowItems.map(
        ({ id, label, icon: iconName }) => h`<a
      class="profile-menu-item nav-overflow-item" href="/${id}"
      data-route="${id}" ${isCurrent(id) ? raw('aria-current="page"') : ''}>${icon(iconName, 18)}<span>${label}</span></a>`,
      )}</div>`
        : ''
    }
    <a class="profile-menu-item profile-menu-account-item"
      href="${routePathFor('config')}">${profileAvatarMarkup(accountAppearance, 'profile-menu-item-avatar', 18)}<span>Perfil e ajustes</span></a>
    ${
      accountSession?.user && !ui.preview
        ? h`<button
      class="profile-menu-item profile-menu-signout profile-menu-account-item" type="button"
      data-account-signout><span>Sair da conta</span></button>`
        : ''
    }
  </div>`;
  const headerAccountMenu = h`<details class="header-account-control">
    <summary class="iconbtn header-account-trigger" aria-label="Perfil e conta"
      title="Perfil e conta">${profileAvatarMarkup(accountAppearance, 'profile-menu-avatar', 20)}</summary>
    <div class="header-account-panel" role="group" aria-label="Perfil e conta">
      <a class="profile-menu-item"
        href="${routePathFor('config')}">${profileAvatarMarkup(accountAppearance, 'profile-menu-item-avatar', 18)}<span>Perfil e ajustes</span></a>
      ${
        accountSession?.user && !ui.preview
          ? h`<button class="profile-menu-item profile-menu-signout" type="button"
        data-account-signout><span>Sair da conta</span></button>`
          : ''
      }
    </div>
  </details>`;
  const navLinks = menuItems.map(navLink);
  const navItems = h`${navLinks}${profileMenu}${
    !hasActiveArea
      ? h`<a class="nav-enable-areas"
    href="${routePathFor('config?section=areas-navigation')}" data-action="areas-nav-open"><span
    class="ni">${icon('plus', 22)}</span><span>Ativar áreas</span></a>`
      : ''
  }`;
  return h`${GRAD}<a class="skip" href="#main" data-action="skip">Pular para o conteúdo principal</a><div
    class="app${ui.preview ? ' preview-shell' : ''}">
    <div class="pull-refresh-indicator" role="status" aria-live="polite" aria-atomic="true" aria-hidden="true"><span
      class="pull-refresh-icon" aria-hidden="true">${icon('refresh', 20)}</span><span
      class="pull-refresh-label"></span></div>
    <header class="topbar">${brandLink}<nav class="nav" id="primary-navigation"
      aria-label="Principal">${navItems}</nav>${profileMenuPanel}<div
      class="header-actions">${headerQuickActions}${modeBtn('iconbtn theme-trigger')}${headerProfileMenu}${headerAccountMenu}</div></header>
    ${financeQuickActionsLayer}
    <main class="main" id="main" data-route="${ui.route}" tabindex="-1">
      ${feedbackPrompt}
      ${persistenceStatus()}
      ${
        ui.preview && navigator.onLine === false
          ? h`<div class="notice warn offline-banner"
        role="status">${icon('alert', 18)}<span>Sem conexão com a internet. Alterações feitas offline não serão salvas; conecte-se e tente novamente.</span></div>`
          : ''
      }
      ${body}
      ${raw(renderLegalDialog())}
    </main>
    ${
      ui.preview
        ? h`<footer
      class="app-footer site-footer">${raw(renderFooterContent({ authenticated: false, preview: true, includeLegalDialog: false }))}</footer>`
        : ''
    }
  </div>`;
}
function persistenceStatus() {
  if (ui.preview || !Persist.store) return '';
  let status;
  let message;
  let action = '';
  if (syncState.conflicts.size) {
    status = 'error';
    message = 'Sua conta mudou em outro dispositivo; recarregue para continuar.';
    action = h`<button type="button" class="btn ghost sm" data-action="reload-app">Recarregar conta</button>`;
  } else if (ui.persistBlocked.size || Object.keys(ui.integrityIssues).length) {
    status = 'warning';
    message = 'Dados protegidos precisam de revisão antes de salvar.';
    action = h`<a class="btn ghost sm" href="${routePathFor('config?section=data')}">Revisar dados</a>`;
  } else if (navigator.onLine === false) {
    status = 'warning';
    const queuedCount = Persist.offlineQueuedCount || (Persist.pendingSnapshot ? 1 : 0);
    message = Persist.pendingSnapshot
      ? `Sem conexão · ${queuedCount} ${queuedCount === 1 ? 'alteração salva' : 'alterações salvas'} neste aparelho. Sincronizaremos ao reconectar.`
      : 'Sem conexão · alterações serão salvas neste aparelho e sincronizadas ao reconectar.';
    action = '';
  } else if (syncState.pending.size) {
    status = 'pending';
    message =
      Persist.offlineQueuedCount > 0 ? 'Reconectado · sincronizando alterações offline…' : 'Salvando alterações…';
  } else if (syncState.failed.size || ui.persistFailed.size) {
    status = 'error';
    message = Persist.pendingSnapshot
      ? 'Não foi possível sincronizar. Alterações ainda estão nesta página.'
      : 'Não foi possível salvar. Confira os dados da conta.';
    action = Persist.pendingSnapshot
      ? h`<button type="button" class="btn ghost sm" data-action="persist-retry">Tentar novamente</button>`
      : h`<a class="btn ghost sm" href="${routePathFor('config?section=data')}">Ver dados</a>`;
  } else return '';
  return h`<div class="sync-status" data-status="${status}" role="status" aria-live="polite"
    aria-atomic="true"><span class="sync-status-copy">${message}</span>${action}</div>`;
}
export function weeklyReviewView() {
  const waterGoal = waterGoalForHabit(S.habits.find(isWaterHabit), S.settings.prefs.waterGoalMl);
  const review = weeklyReview(
    S.tasks,
    S.habits,
    today(),
    weekStartDay(),
    (habit, day) => habitCompletedFor(habit, day),
    (habit, day) => habitIsSkipped(habit, day, today()),
    (day) => waterGoalReached(waterMlForDay(S.water, day), waterGoal),
  );
  const week = weekDays(today(), weekStartDay());
  const weekMoney =
    areaOn('finances') && S.finance.accounts.length
      ? {
          hidden: S.settings.prefs.financeValuesHidden === true,
          spending: weekSpending(S.finance.tx, week[0], today()),
          budget: monthBudgetProgress(S.finance.tx, S.finance.budgets, today().slice(0, 7)),
          dues: upcomingDueItems().filter(
            (item) => item.date >= review.nextWeek.start && item.date <= review.nextWeek.end,
          ),
        }
      : null;
  const savedReflection = S.settings.prefs.weeklyReflection;
  const currentReflection = savedReflection?.weekOf === week[0] ? savedReflection.text : '';
  const formatDay = (day) => {
    const [year, month, date] = day.split('-').map(Number);
    return `${date} de ${MESES_L[month - 1]} de ${year}`;
  };
  return renderWeeklyReviewView(
    { review, week, weekMoney, currentReflection, reflectionEditing: ui.reflectionEditing, formatDay },
    { taskRow },
  );
}

export function profileGreeting(style) {
  if (style === 'hello') return 'Olá';
  if (style === 'oi') return 'Oi';
  return timeBasedGreeting();
}
export function profileAvatarMarkup(appearance, className = 'profile-greeting-avatar', iconSize = 22) {
  const profileAppearance = normalizeProfileAppearance(appearance);
  const color = PALETTES[profileAppearance.avatarColor]?.[1] || PALETTES.rose[1];
  const content = profileAppearance.avatarImage
    ? h`<img class="profile-avatar-image" src="${profileAppearance.avatarImage}" alt="">`
    : icon(profileAppearance.avatar, iconSize);
  return h`<span class="${className}" style="--profile-avatar-color:${color}" aria-hidden="true">${content}</span>`;
}
const PAGE_CONTEXT = {
  Planejar: ['Tarefas e prazos', 'Crie tarefas, organize a semana e acompanhe itens atrasados.'],
  Finanças: ['Contas e lançamentos', 'Acompanhe saldos, receitas, despesas e objetivos.'],
  Ciclo: ['Ciclo menstrual', 'Registre menstruação e sintomas para consultar o histórico e as estimativas.'],
  Hábitos: ['Registro de hábitos', 'Marque os dias realizados e consulte a frequência semanal.'],
  Ajustes: ['Perfil e preferências', 'Edite o perfil, organize as áreas e ajuste as preferências do aplicativo.'],
};
export const pageTitle = (title, action = '') => {
  const [eyebrow, description] = PAGE_CONTEXT[title] || [];
  return h`<header class="page-title"><div class="page-title-copy">${
    eyebrow
      ? h`<span
    class="page-title-eyebrow">${eyebrow}</span>`
      : ''
  }<h1>${title}</h1>${description ? h`<p>${description}</p>` : ''}</div>${action}</header>`;
};
export const empty = (title, text, action = '', iconName = 'inbox') =>
  h`<section class="empty" role="status" aria-live="polite" aria-label="${title}"><span class="eic"
    aria-hidden="true">${icon(iconName, 28)}</span><div
    class="empty-copy"><b>${title}</b><span>${text}</span></div>${
      action
        ? h`<div
    class="empty-action">${action}</div>`
        : ''
    }</section>`;
export const areaEmpty = (title, description, action, iconName = 'inbox', headingLevel = 'h3', className = '') =>
  emptyState({
    title,
    description,
    action,
    iconName,
    headingLevel,
    className,
  });
export const areaOn = (a) =>
  Boolean(S.settings.areas[a]) && (a !== 'cycle' || canAccessCycle(S.settings.profile, ui.preview));
export function setAreaEnabled(settings, area, enabled) {
  if (!Object.hasOwn(settings.areas, area)) return false;
  if (area === 'cycle' && enabled && !canAccessCycle(settings.profile, ui.preview)) return false;
  settings.areas[area] = enabled;
  if (enabled) {
    const menuItem = MENU_ITEMS.find((item) => item.area === area);
    if (menuItem) {
      settings.prefs.visibleMenuItems = normalizeVisibleMenuItems([...settings.prefs.visibleMenuItems, menuItem.id]);
    }
  }
  return true;
}
export function gate(area, name) {
  if (areaOn(area)) return null;
  return h`<div
    class="card">${empty(
      name + ' está desligado',
      'Esta área é opcional. Ative quando quiser; você pode desligar depois sem perder o que registrou.',
      h`<button
    class="btn primary" data-action="enable-area" data-area="${area}">Ativar ${name}</button>`,
    )}</div>`;
}
export function areaGuideButton(route) {
  if (!AREA_GUIDES[route]) return '';
  return h`<button type="button" class="btn ghost area-guide-button" data-action="area-guide-open"
    data-area-guide="${route}" title="Como usar?">${icon('help', 18)}<span class="area-guide-label">Como usar?</span></button>`;
}
export function areaPageTitle(route, title, action = '') {
  return pageTitle(
    title,
    h`${action ? h`<div class="area-page-extra">${action}</div>` : ''}<div class="area-page-actions">${areaGuideButton(route)}</div>`,
  );
}
