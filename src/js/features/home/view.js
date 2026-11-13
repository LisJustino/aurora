import { h, raw } from '../../utils/dom.js';
import { icon } from '../../utils/icons.js';

export function renderHomeView(model, renderers) {
  const {
    name,
    profileAppearance,
    greeting,
    dateLabel,
    homeMessage,
    lead,
    tt,
    sundayReview,
    optionalAreas,
    overdue,
    dueToday,
    completed,
    nextTask,
    inbox,
    homeShortcuts,
    openCompleted,
    openExtras,
    financeAccountsCount,
    showHomeBlock,
    homeBlockStyle,
  } = model;
  const {
    areaGuideButton,
    backupReminder,
    empty,
    homeFirstSteps,
    homeHabitCheckins,
    homeInboxReminder,
    homeUpcomingBill,
    homeUpcomingTasks,
    profileAvatarMarkup,
    sampleBanner,
    taskRow,
  } = renderers;

  return h`
    <header class="home-head" aria-labelledby="hi"><div><p class="date">${dateLabel}</p><h1 id="hi">${profileAvatarMarkup(profileAppearance, 'home-profile-avatar')}${greeting}${name ? h`, <span class="proper-name">${name}</span>` : ''}<i>.</i></h1>${homeMessage ? h`<p class="home-personal-message">${homeMessage}</p>` : ''}<p class="lead">${lead}</p><div class="home-head-actions"><a class="home-action" href="/planejar">${icon('calendar', 18)}Planejar${icon('chevRight', 16)}</a>${areaGuideButton('inicio')}</div></div></header>
    ${sampleBanner()}
    <div class="home-dashboard no-optional-areas">
      <div class="home-primary">
        ${!nextTask && showHomeBlock('habits') ? homeHabitCheckins(true, true) : ''}
        ${showHomeBlock('today') ? h`<section class="home-today-card" aria-labelledby="th"><div class="head"><div><p class="section-kicker">Seu plano</p><h2 id="th">Hoje</h2></div></div>
          ${completed.length && !overdue.length && !dueToday.length ? h`<div class="home-day-complete" role="status">${icon('check', 20)}<div><b>Dia concluído</b><p>Você terminou as tarefas de hoje. Amanhã é um novo começo.</p></div></div>` : ''}
          ${tt.length ? h`<div class="home-task-groups">
            ${overdue.length ? h`<section class="home-task-group is-overdue" aria-label="Tarefas atrasadas"><h3>${icon('alert', 15)}Atrasadas <span>${overdue.length}</span></h3><ul class="list">${overdue.map((task) => taskRow(task, false, task.id === nextTask?.id))}</ul></section>` : ''}
            ${dueToday.length ? h`<section class="home-task-group" aria-label="Tarefas para hoje"><h3>${icon('calendarCheck', 15)}Para hoje <span>${dueToday.length}</span></h3><ul class="list">${dueToday.map((task) => taskRow(task, false, task.id === nextTask?.id))}</ul></section>` : ''}
            ${completed.length ? h`<details class="home-completed" id="d-home-completed" ${openCompleted ? raw('open') : ''}><summary>${icon('check', 15)}Concluídas hoje <span class="home-completed-count">${completed.length}</span><span class="home-disclosure-indicator" aria-hidden="true">${icon('chevDown', 16)}</span></summary><ul class="list">${completed.map(taskRow)}</ul></details>` : ''}
          </div>` : empty('Seu dia está aberto', 'Inclua uma prioridade no Planejar ou use as ações rápidas.', h`<a class="btn" href="/planejar">${icon('list', 16)}Ver tarefas no Planejar</a>`, 'calendarCheck')}
        </section>` : ''}
      </div>
    </div>
    <details class="home-extras" id="d-home-extras" ${openExtras ? raw('open') : ''}>
      <summary>Mais do Início ${icon('chevDown', 18)}</summary>
      <div class="home-extras-content">
        ${sundayReview ? h`<section class="card home-next-action home-weekly-review" aria-labelledby="home-weekly-review-title"><div class="home-next-mark">${icon('chart', 19)}</div><div class="grow"><span class="section-kicker">Domingo · revisão da semana</span><h2 id="home-weekly-review-title">Um minuto para reconhecer seu progresso</h2><p>Veja hábitos, tarefas concluídas e gastos antes de começar uma nova semana.</p></div><button type="button" class="btn primary" data-action="home-weekly-review">${icon('chart', 16)}Fazer revisão</button></section>` : ''}
        <div class="home-dashboard${optionalAreas ? '' : ' no-optional-areas'}">
        <div class="home-primary">
        ${showHomeBlock('summary') ? h`<section class="strip" aria-label="Resumo do dia" ${raw(homeBlockStyle('summary'))}>
          <a href="/planejar" data-action="filter-overdue"><b>${overdue.length}</b><span>Atrasadas</span></a>
        </section>` : ''}
        ${showHomeBlock('quick') ? h`<section class="card home-quick-card" aria-labelledby="home-quick-title" ${raw(homeBlockStyle('quick'))}>
          <div class="home-quick-copy"><span class="home-quick-mark" aria-hidden="true">${icon('plus', 18)}</span><div><h2 id="home-quick-title">Qual é o próximo passo<i>?</i></h2><p>Use “amanhã 14h” ou um dia da semana para escolher o prazo.</p></div></div>
          <form class="home-quick-form" data-form="home-quick-task"><label class="sr" for="home-quick-title-input">Nova tarefa</label><input id="home-quick-title-input" name="title" type="text" maxlength="120" autocomplete="off" placeholder="Ex.: revisar apresentação amanhã 14h" aria-describedby="home-quick-date-preview" required><span id="home-quick-date-preview" class="home-quick-date badge" aria-live="polite">Hoje</span><button class="btn primary" type="submit">${icon('plus', 16)}Adicionar</button></form>
        </section>` : ''}
        ${showHomeBlock('habits') ? h`<div ${raw(homeBlockStyle('habits'))}>${homeHabitCheckins(false)}</div>` : ''}
        ${homeUpcomingTasks()}
        ${homeInboxReminder(inbox)}
        ${homeUpcomingBill()}
      </div>
      ${optionalAreas ? h`<section class="home-areas" aria-labelledby="ar">${optionalAreas}</section>` : ''}
    </div>
    ${homeFirstSteps()}
    ${backupReminder()}
        ${homeShortcuts.length ? h`<section class="home-tools" aria-labelledby="home-tools-title">
      <div class="head"><h2 id="home-tools-title">Ações favoritas<i>.</i></h2></div>
      <div class="home-tool-grid compact-card-grid">
        ${homeShortcuts.map((shortcut) => {
          const action = shortcut.id === 'finance' && !financeAccountsCount ? 'quick-action-account' : shortcut.action;
          const label = shortcut.id === 'finance'
            ? financeAccountsCount ? 'Novo lançamento' : 'Criar conta financeira'
            : shortcut.label;
          return h`<button class="home-tool" type="button" data-action="${action}"><span class="home-tool-icon">${icon(shortcut.icon, 20)}</span><span><b>${label}</b><small>${shortcut.description}</small></span>${icon('chevRight', 18, 'home-tool-go')}</button>`;
        })}
      </div>
        </section>` : ''}
      </div>
    </details>`;
}
