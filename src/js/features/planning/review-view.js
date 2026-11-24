import { h } from '../../utils/dom.js';
import { brl } from '../../utils/currency.js';

// Revisão semanal: recebe os dados já calculados e só desenha a tela.
export function renderWeeklyReviewView(model, { taskRow }) {
  const {
    review,
    week,
    weekMoney = null,
    currentReflection = '',
    reflectionEditing = false,
    formatDay,
  } = model;
  const habitPercent = review.habits.scheduled
    ? Math.round(review.habits.completed / review.habits.scheduled * 100)
    : 0;
  return h`<div class="weekly-review">
    <section class="weekly-review-hero"><div><span>Revisão gentil</span><h2>Sua semana</h2><p>De ${formatDay(week[0])} a ${formatDay(week[6])}. Cada passo conta, no seu tempo.</p></div></section>
    <section class="card weekly-review-main" aria-label="Resumo da semana">
      <div class="review-stats">
        <div class="stat"><b>${review.tasks.completed}</b><span>Tarefas concluídas</span></div>
        <div class="stat"><b>${review.tasks.pending}</b><span>Pendentes nesta semana</span></div>
        <div class="stat"><b>${review.waterDays}</b><span>Dias com meta de água</span></div>
        <div class="stat"><b>${review.habits.onTrack}</b><span>Hábitos em dia</span></div>
      </div>
    </section>
    ${review.habits.count ? h`<section class="card weekly-review-habits" aria-labelledby="weekly-habits-title">
      <div class="head"><h3 id="weekly-habits-title">Hábitos</h3><span class="small muted">${review.habits.completed} de ${review.habits.scheduled}</span></div>
      ${review.habits.scheduled
        ? h`<div class="home-week-progress-track" role="progressbar" aria-label="Check-ins de hábitos nesta semana" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${habitPercent}" aria-valuetext="${review.habits.completed} de ${review.habits.scheduled} check-ins feitos"><span style="width: ${habitPercent}%"></span></div>
          <p class="small muted">${review.habits.onTrack} de ${review.habits.count} ${review.habits.count === 1 ? 'hábito está' : 'hábitos estão'} em dia.</p>`
        : h`<p class="small muted" role="status">Nenhum check-in previsto até agora nesta semana.</p>`}
    </section>` : ''}
    ${weekMoney ? h`<section class="card weekly-review-money" aria-labelledby="weekly-money-title">
      <div class="head"><h3 id="weekly-money-title">Dinheiro da semana</h3></div>
      <p>${weekMoney.hidden ? 'Valores ocultos.' : h`Você gastou <b>${brl(weekMoney.spending.current)}</b> até hoje.`}${!weekMoney.hidden && weekMoney.spending.hasPrevious ? h` Na semana passada, no mesmo trecho, foram ${brl(weekMoney.spending.previous)}.` : ''}</p>
      ${weekMoney.budget ? h`<p class="small muted">${weekMoney.hidden
        ? `Limites do mês: ${weekMoney.budget.over.length ? `${weekMoney.budget.over.length} acima do combinado.` : 'tudo dentro do combinado.'}`
        : `Limites do mês: ${brl(weekMoney.budget.spent)} de ${brl(weekMoney.budget.limit)}${weekMoney.budget.over.length ? `. Acima do limite: ${weekMoney.budget.over.slice(0, 3).join(', ')}${weekMoney.budget.over.length > 3 ? ` e mais ${weekMoney.budget.over.length - 3}` : ''}.` : ', dentro do combinado.'}`}</p>` : ''}
      ${weekMoney.dues.length ? h`<p class="small muted">Vencem na próxima semana: ${weekMoney.dues.slice(0, 3).map((item) => `${item.label}${weekMoney.hidden ? '' : ` (${brl(item.cents)})`}`).join(', ')}${weekMoney.dues.length > 3 ? ` e mais ${weekMoney.dues.length - 3}` : ''}.</p>` : h`<p class="small muted">Nenhuma conta vence na próxima semana.</p>`}
    </section>` : ''}
    <section class="card weekly-review-tasks" aria-labelledby="weekly-overdue-title">
      <div class="head"><h3 id="weekly-overdue-title">Tarefas atrasadas</h3><span class="small muted">${review.tasks.overdue}</span></div>
      ${review.tasks.overdueTasks.length
        ? h`<ul class="list">${review.tasks.overdueTasks.map((task) => taskRow(task))}</ul>`
        : h`<p class="small muted" role="status">Nenhuma tarefa atrasada.</p>`}
    </section>
    <section class="card weekly-review-tasks" aria-labelledby="weekly-next-title">
      <div class="head"><div><h3 id="weekly-next-title">Próxima semana</h3><p class="small muted">${formatDay(review.nextWeek.start)} a ${formatDay(review.nextWeek.end)}</p></div><span class="small muted">${review.nextWeek.tasks.length} pendente(s)</span></div>
      ${review.nextWeek.tasks.length
        ? h`<ul class="list">${review.nextWeek.tasks.map((task) => taskRow(task, true))}</ul>`
        : h`<p class="small muted" role="status">Nenhuma tarefa planejada para a próxima semana.</p>`}
    </section>
    ${currentReflection && !reflectionEditing
      ? h`<section class="card weekly-reflection is-answered" aria-labelledby="weekly-reflection-title">
      <div class="head"><div><p class="section-kicker">Para a próxima semana</p><h2 id="weekly-reflection-title">${currentReflection}</h2></div><button type="button" class="btn sm" data-action="weekly-reflection-edit">Mudar</button></div>
      <p class="small muted" role="status">Sua resposta está salva na revisão desta semana.</p>
    </section>`
      : h`<section class="card weekly-reflection" aria-labelledby="weekly-reflection-title">
      <div class="head"><div><p class="section-kicker">Um convite, sem pressa</p><h2 id="weekly-reflection-title">O que você quer levar para a próxima semana?</h2></div></div>
      <p class="small muted">Se quiser, escolha uma opção. Sua resposta ficará salva na revisão semanal.</p>
      <div class="weekly-review-choices" role="group" aria-label="Respostas rápidas">
        ${['Menos tarefas', 'Mais pausas', 'Manter assim'].map((choice) => h`<button type="button" class="btn" data-action="weekly-reflection-save" data-v="${choice}" aria-pressed="${String(currentReflection === choice)}">${choice}</button>`)}
      </div>
    </section>`}
  </div>`;
}
