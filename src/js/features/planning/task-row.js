import { addDays, dayDiff, isoDay, shortDate, today } from '../../utils/dates.js';
import { h, raw } from '../../utils/dom.js';
import { icon } from '../../utils/icons.js';
import { taskIconKey } from './task-icons.js';
import { REPEATS } from './recurrence.js';

export function renderTaskRow(t, reviewNextWeek = false, homeNextStep = false, { route, sort } = {}) {
  const isReviewNextWeek = reviewNextWeek === true;
  const isHomeNextStep = homeNextStep === true;
  const todayKey = today();
  const tomorrowKey = addDays(todayKey, 1);
  const d = t.dueDate ? dayDiff(t.dueDate, todayKey) : null;
  const tm = t.time ? ` ${t.time}` : '';
  const subs = t.subtasks || [];
  const sd = subs.filter((x) => x.done).length;
  const manual = route === 'planejar' && sort === 'manual' && !t.done;
  const taskIcon = taskIconKey(t.icon);
  const metadata = [];
  if (t.done && t.doneAt) {
    const doneDay = isoDay(t.doneAt);
    if (doneDay && doneDay !== todayKey) {
      metadata.push({
        icon: 'check',
        label: `Concluída · ${shortDate(doneDay)}`,
        tone: '',
      });
    }
  }
  if (t.dueDate) {
    const dateLabel =
      !t.done && d < 0
        ? `Atrasada · ${shortDate(t.dueDate)}${tm}`
        : d === 0
          ? isHomeNextStep
            ? t.time || ''
            : `Hoje${tm}`
          : d === 1
            ? `Amanhã${tm}`
            : `${shortDate(t.dueDate)}${tm}`;
    if (dateLabel)
      metadata.push({
        icon: t.time ? 'clock' : 'calendar',
        label: dateLabel,
        tone: !t.done && d < 0 ? 'm-bad' : d === 0 && !isHomeNextStep ? 'm-warn' : '',
      });
  }
  if (t.priority === 'high') metadata.push({ icon: 'flag', label: 'Alta', tone: 'm-hi' });
  else if (t.priority === 'low') metadata.push({ icon: 'flag', label: 'Baixa', tone: '' });
  if (t.repeat && t.repeat !== 'none') metadata.push({ icon: 'repeat', label: REPEATS[t.repeat], tone: '' });
  if (subs.length) metadata.push({ icon: 'list', label: `${sd}/${subs.length}`, tone: '' });
  if (t.notes) metadata.push({ icon: 'note', label: 'Nota', tone: '' });
  (t.tags || []).forEach((tag) => metadata.push({ icon: 'tag', label: `#${tag}`, tone: '' }));
  if (t.groupTitle) metadata.push({ icon: 'list', label: t.groupTitle, tone: '' });
  if (t.sample) metadata.push({ icon: 'note', label: 'Exemplo', tone: '' });
  const shownMetadata = metadata.slice(0, 3);
  const extraMetadata = metadata.length - shownMetadata.length;

  return h`<li class="task ${t.done ? 'done' : ''}${isReviewNextWeek ? ' weekly-plan-task' : ''}${isHomeNextStep ? ' home-next-task' : ''}"
    data-k="${t.id}" ${manual ? raw('draggable="true"') : ''}>${
      manual
        ? h`<span class="mvc"><button type="button"
    class="ibtn mv" data-action="mv-up" data-id="${t.id}"
    aria-label="Mover para cima: ${t.title}">${icon('arrowUp', 16)}</button><button type="button" class="ibtn mv"
    data-action="mv-down" data-id="${t.id}"
    aria-label="Mover para baixo: ${t.title}">${icon('arrowDown', 16)}</button></span>`
        : ''
    }
    <button class="chk p-${t.priority}" role="checkbox" aria-checked="${String(t.done)}"
      aria-label="${t.done ? 'Reabrir' : 'Concluir'}: ${t.title}" data-action="toggle"
      data-id="${t.id}"><span>${icon('check', 15)}</span></button>
    <button class="tt" data-action="edit-task" data-id="${t.id}"
      aria-label="${isHomeNextStep ? 'Próximo passo. ' : ''}Editar: ${t.title}"><span
      class="task-title-line">${taskIcon ? icon(taskIcon, 17, 'task-title-icon') : ''}<span
      class="ttl">${t.title}</span>${
        isHomeNextStep
          ? h`<span
      class="home-next-step-label">Próximo passo</span>`
          : ''
      }</span>
      <span class="meta">${shownMetadata.map(
        ({ icon: iconName, label, tone }) => h`<span class="meta-chip ${tone}"
        title="${label}">${icon(iconName, 12)}${label}</span>`,
      )}${
        extraMetadata
          ? h`<span
        class="meta-chip meta-overflow"
        aria-label="${extraMetadata} metadados adicionais">+${extraMetadata}</span>`
          : ''
      }</span></button>
    <details class="task-menu">
      <summary class="ibtn task-menu-trigger" aria-label="Mais ações para ${t.title}" title="Mais ações">${icon('more', 18)}</summary>
      <div class="task-menu-panel" role="group" aria-label="Ações de ${t.title}">
        ${
          !t.done
            ? h`${
                t.dueDate !== todayKey
                  ? h`<button type="button" class="task-menu-item" data-action="task-reschedule"
          data-id="${t.id}" data-when="today">${icon('calendarCheck', 15)}<span>Para hoje</span></button>`
                  : ''
              }${
                t.dueDate !== tomorrowKey
                  ? h`<button type="button" class="task-menu-item" data-action="task-reschedule"
          data-id="${t.id}" data-when="tomorrow">${icon('calendar', 15)}<span>Para amanhã</span></button>`
                  : ''
              }<button type="button" class="task-menu-item" data-action="task-reschedule"
          data-id="${t.id}" data-when="next-week">${icon('arrow', 15)}<span>Próxima semana</span></button>${
            t.dueDate
              ? h`<button type="button" class="task-menu-item" data-action="task-reschedule"
          data-id="${t.id}" data-when="none">${icon('inbox', 15)}<span>Sem prazo</span></button>`
              : ''
          }<hr class="task-menu-sep">`
            : ''
        }
        <button type="button" class="task-menu-item" data-action="edit-task"
          data-id="${t.id}">${icon('pencil', 15)}<span>Editar</span></button>
        <button type="button" class="task-menu-item is-danger" data-action="del-task"
          data-id="${t.id}">${icon('trash', 15)}<span>Excluir</span></button>
      </div>
    </details>
    ${
      isReviewNextWeek
        ? h`<div class="weekly-plan-actions" role="group" aria-label="Ações para ${t.title}"><button
      type="button" class="btn ghost sm" data-action="edit-task" data-id="${t.id}">Ajustar</button><button type="button"
      class="btn ghost sm" data-action="weekly-defer-task" data-id="${t.id}">Adiar uma semana</button></div>`
        : ''
    }
  </li>`;
}
