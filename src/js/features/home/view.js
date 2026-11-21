import { h, raw } from '../../utils/dom.js';
import { icon } from '../../utils/icons.js';
import { brl } from '../../utils/currency.js';

export function renderHomeView(model, renderers) {
  const {
    name,
    profileAppearance,
    greeting,
    dateLabel,
    daySummary,
    weekProgress,
    homeMessage,
    lead,
    tt,
    sundayReview,
    overdue,
    dueToday,
    completed,
    nextTask,
    inbox,
    emptyWorkspace,
    openCompleted,
    optionalAreas,
    homeShortcuts,
    showHomeBlock,
    homeBlockStyle,
    financeUpcoming = null,
  } = model;
  const {
    areaGuideButton,
    empty,
    homeFirstSteps,
    homeHabitCheckins,
    homeInboxReminder,
    profileAvatarMarkup,
    sampleBanner,
    homeUpcomingTasks,
    taskRow,
  } = renderers;
  const weekTotal = weekProgress.completed + weekProgress.pending;
  const weekPercent = weekTotal ? Math.round(weekProgress.completed / weekTotal * 100) : 0;

  return h`
    <header class="home-head" aria-labelledby="hi"><div><p class="date">${dateLabel}</p><div class="home-greeting">${profileAvatarMarkup(profileAppearance, 'home-profile-avatar')}<h1 id="hi" class="type-editorial-display">${greeting}${name ? h`, <span class="proper-name">${name}</span>` : ''}<i>.</i></h1></div>${homeMessage ? h`<p class="home-personal-message">${homeMessage}</p>` : ''}${lead ? h`<p class="lead">${lead}</p>` : ''}<div class="home-head-actions"><a class="home-action" href="/planejar">${icon('calendar', 18)}Planejar${icon('chevRight', 16)}</a>${areaGuideButton('inicio')}</div></div></header>
    ${homeFirstSteps()}
    ${sampleBanner()}
    <div class="home-dashboard no-optional-areas">
      <div class="home-primary">
        ${showHomeBlock('summary') ? h`<section class="home-day-summary card" ${raw(homeBlockStyle('summary'))} aria-labelledby="home-day-summary-title">
          <h2 id="home-day-summary-title">Hoje</h2>
          ${daySummary.tasks.next
            ? h`<a class="home-day-next-task" href="/planejar" aria-label="Próxima tarefa: ${daySummary.tasks.next.title}">${icon('calendarCheck', 18)}<span><small>PRÓXIMA TAREFA</small><b>${daySummary.tasks.next.title}</b></span>${icon('chevRight', 16)}</a>`
            : h`<p class="home-day-next-task is-empty">Nenhuma tarefa atrasada ou para hoje.</p>`}
          <div class="home-day-chips" role="group" aria-label="Resumo das áreas de hoje">
            <a class="home-day-chip home-day-chip--plan" href="/planejar" aria-label="Tarefas, ${daySummary.tasks.done} de ${daySummary.tasks.total} feitas">
              <span class="home-day-chip-count" aria-hidden="true">${daySummary.tasks.done}/${daySummary.tasks.total}</span><span class="home-day-chip-copy">Tarefas</span>
            </a>
            ${daySummary.habits ? h`<a class="home-day-chip home-day-chip--habits" href="/habitos" aria-label="Hábitos, ${daySummary.habits.done} de ${daySummary.habits.total} feitos, ${daySummary.habits.remaining} faltando">
              <span class="home-day-chip-count" aria-hidden="true">${daySummary.habits.done}/${daySummary.habits.total}</span><span class="home-day-chip-copy">Hábitos <small>${daySummary.habits.remaining ? `Faltam ${daySummary.habits.remaining}` : daySummary.habits.total ? 'Tudo feito' : 'Sem hábitos hoje'}</small></span>
            </a>` : ''}
            ${daySummary.water ? h`<a class="home-day-chip home-day-chip--water" href="/habitos" aria-label="Água, ${daySummary.water.total.toLocaleString('pt-BR')} de ${daySummary.water.goal.toLocaleString('pt-BR')} mililitros">
              <span class="home-day-chip-count" aria-hidden="true">${daySummary.water.percent}%</span><span class="home-day-chip-copy">Água <small>${daySummary.water.total.toLocaleString('pt-BR')} / ${daySummary.water.goal.toLocaleString('pt-BR')} mL</small></span>
            </a>` : ''}
            ${daySummary.cycle ? h`<a class="home-day-chip home-day-chip--cycle" href="/ciclo" aria-label="${daySummary.cycle.day === null ? 'Ciclo, dia não calculado' : `Ciclo, dia ${daySummary.cycle.day} do ciclo`}">
              <span class="home-day-chip-count" aria-hidden="true">${daySummary.cycle.day ?? '—'}</span><span class="home-day-chip-copy">Ciclo</span>
            </a>` : ''}
            ${daySummary.balance ? h`<a class="home-day-chip home-day-chip--balance" href="/financas" aria-label="${daySummary.balance.hidden ? 'Saldo atual nas contas oculto' : `Saldo atual nas contas: ${brl(daySummary.balance.cents)}`}">
              <span class="home-day-chip-count" aria-hidden="true">${daySummary.balance.hidden ? '••••' : brl(daySummary.balance.cents)}</span><span class="home-day-chip-copy">Saldo</span>
            </a>` : ''}
          </div>
          ${financeUpcoming ? h`<a class="home-day-upcoming${financeUpcoming.overdue ? ' has-overdue' : ''}" href="/financas" aria-label="${financeUpcoming.hidden ? `A vencer em ${financeUpcoming.days} dias: ${financeUpcoming.count} ${financeUpcoming.count === 1 ? 'compromisso, valor oculto' : 'compromissos, valor oculto'}` : `A vencer em ${financeUpcoming.days} dias: ${financeUpcoming.count} ${financeUpcoming.count === 1 ? 'compromisso' : 'compromissos'}, ${brl(financeUpcoming.cents)}`}${financeUpcoming.overdue ? `, ${financeUpcoming.overdue} em atraso` : ''}">
            ${icon('wallet', 16)}<span><small>A VENCER EM ${financeUpcoming.days} DIAS</small><b>${financeUpcoming.count} ${financeUpcoming.count === 1 ? 'compromisso' : 'compromissos'} · ${financeUpcoming.hidden ? '••••' : brl(financeUpcoming.cents)}${financeUpcoming.overdue ? ` · ${financeUpcoming.overdue} em atraso` : ''}</b></span>${icon('chevRight', 16)}
          </a>` : ''}
        </section>` : ''}
        ${showHomeBlock('quick') ? h`<section class="card surface-open home-quick-card" ${raw(homeBlockStyle('quick'))} aria-labelledby="home-quick-title">
          <div class="home-quick-copy"><span class="home-quick-mark" aria-hidden="true">${icon('plus', 18)}</span><div><h2 id="home-quick-title" class="type-editorial-title">Qual é o próximo passo<i>?</i></h2><p id="home-quick-help">Use “amanhã 14h” ou um dia da semana. Compromissos precisam de dia e hora.</p></div></div>
          <form class="home-quick-form" data-form="home-quick-task">
            <label class="sr" for="home-quick-title-input">Nova tarefa ou compromisso</label>
            <input id="home-quick-title-input" name="title" type="text" maxlength="120" autocomplete="off" enterkeyhint="done" placeholder="Ex.: revisar apresentação amanhã 14h" aria-describedby="home-quick-help home-quick-date-preview" required>
            <label class="sr" for="home-quick-kind">Tipo de registro</label>
            <select id="home-quick-kind" name="kind" aria-label="Tipo de registro"><option value="task">Tarefa</option><option value="appointment">Compromisso</option></select>
            <label class="sr" for="home-quick-priority">Prioridade</label>
            <select id="home-quick-priority" name="priority" aria-label="Prioridade"><option value="normal">Normal</option><option value="high">Alta</option><option value="low">Baixa</option></select>
            <button class="btn primary home-quick-submit" type="submit" disabled>${icon('plus', 16)}Adicionar</button>
            <span id="home-quick-date-preview" class="home-quick-date badge" aria-live="polite">Hoje</span>
          </form>
        </section>` : ''}
        ${showHomeBlock('today') ? h`<div class="home-today-block" ${raw(homeBlockStyle('today'))}>
          <section class="home-today-card" aria-labelledby="th"><div class="head"><div><p class="section-kicker">Seu plano</p><h2 id="th" class="type-editorial-title">Hoje</h2></div></div>
            ${completed.length && !overdue.length && !dueToday.length ? h`<div class="home-day-complete" role="status">${icon('check', 20)}<div><b>Dia concluído</b><p>Você terminou as tarefas de hoje. Amanhã é um novo começo.</p></div></div>` : ''}
            ${tt.length ? h`<div class="home-task-groups">
              ${overdue.length ? h`<section class="home-task-group is-overdue" aria-label="Tarefas atrasadas"><h3>${icon('alert', 15)}Atrasadas <span>${overdue.length}</span></h3><ul class="list">${overdue.map((task) => taskRow(task, false, task.id === nextTask?.id))}</ul></section>` : ''}
              ${dueToday.length ? h`<section class="home-task-group" aria-label="Tarefas para hoje"><h3>${icon('calendarCheck', 15)}Para hoje <span>${dueToday.length}</span></h3><ul class="list">${dueToday.map((task) => taskRow(task, false, task.id === nextTask?.id))}</ul></section>` : ''}
              ${completed.length ? h`<details class="home-completed" id="d-home-completed" ${openCompleted ? raw('open') : ''}><summary>${icon('check', 15)}Concluídas hoje <span class="home-completed-count">${completed.length}</span><span class="home-disclosure-indicator" aria-hidden="true">${icon('chevDown', 16)}</span></summary><ul class="list">${completed.map(taskRow)}</ul></details>` : ''}
            </div>` : empty(
              emptyWorkspace ? 'Seu Início começa aqui' : 'Seu dia está aberto',
              emptyWorkspace
                ? 'Adicione sua primeira tarefa pelo campo “Qual é o próximo passo?” acima.'
                : 'Inclua uma prioridade no Planejar ou use as ações rápidas.',
              emptyWorkspace ? '' : h`<a class="btn" href="/planejar">${icon('list', 16)}Ver tarefas no Planejar</a>`,
              'calendarCheck',
            )}
          </section>
          ${homeUpcomingTasks()}
          <section class="surface-open home-week-progress" aria-labelledby="home-week-progress-title">
            <div class="head"><div><p class="section-kicker">Seu ritmo</p><h2 id="home-week-progress-title">Esta semana<i>.</i></h2></div><a class="btn ghost sm" href="/planejar">Planejar</a></div>
            ${weekTotal
              ? h`<div class="home-week-progress-copy"><b>${weekProgress.completed} de ${weekTotal}</b><span>tarefas resolvidas ou planejadas</span></div>
                <div class="home-week-progress-track" role="progressbar" aria-label="Tarefas concluídas nesta semana" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${weekPercent}" aria-valuetext="${weekProgress.completed} de ${weekTotal} tarefas concluídas">
                  <span style="width: ${weekPercent}%"></span>
                </div>`
              : h`<p class="home-week-progress-empty">Sua semana ainda está em aberto. Uma tarefa já ajuda a começar.</p><a class="btn sm" href="/planejar">${icon('plus', 16)}Adicionar tarefa</a>`}
          </section>
        </div>` : ''}
        ${showHomeBlock('habits') ? h`<div class="home-habits-block" ${raw(homeBlockStyle('habits'))}>${homeHabitCheckins(false)}</div>` : ''}
      </div>
    </div>
    ${homeShortcuts.length ? h`<section class="surface-open home-tools" aria-labelledby="home-tools-title">
      <div class="head"><div><p class="section-kicker">Atalhos</p><h2 id="home-tools-title">Ações rápidas<i>.</i></h2></div></div>
      <div class="home-tool-grid${homeShortcuts.length === 1 ? ' single' : ''}">
        ${homeShortcuts.map((shortcut) => h`<button class="home-tool" type="button" data-action="${shortcut.action}">
          <span class="home-tool-icon" aria-hidden="true">${icon(shortcut.icon, 18)}</span>
          <span><b>${shortcut.label}</b><small>${shortcut.description}</small></span>
          <span class="home-tool-go" aria-hidden="true">${icon('chevRight', 16)}</span>
        </button>`)}
      </div>
    </section>` : ''}
    ${optionalAreas ? h`<section class="surface-open home-areas" aria-labelledby="ar">${optionalAreas}</section>` : ''}
    ${homeInboxReminder(inbox)}
    ${sundayReview ? h`<section class="card home-next-action home-weekly-review" aria-labelledby="home-weekly-review-title"><div class="home-next-mark">${icon('chart', 19)}</div><div class="grow"><span class="section-kicker">Domingo · sua semana</span><h2 id="home-weekly-review-title">Um momento para olhar com carinho</h2><p>Veja um retrato simples de tarefas, água e hábitos.</p></div><button type="button" class="btn primary" data-action="home-weekly-review">Ver minha semana</button></section>` : ''}
  `;
}
