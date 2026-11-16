import { dayDiff, shortDate, today } from '../../utils/dates.js';
import { h, raw } from '../../utils/dom.js';
import { icon } from '../../utils/icons.js';
import { taskIconKey } from './task-icons.js';
import { REPEATS } from './recurrence.js';

export function renderTaskRow(t, reviewNextWeek = false, homeNextStep = false, { route, sort } = {}) {
  const isReviewNextWeek = reviewNextWeek === true;
  const isHomeNextStep = homeNextStep === true;
  const d = t.dueDate ? dayDiff(t.dueDate, today()) : null;
  const tm = t.time ? ` ${t.time}` : '';
  const subs = t.subtasks || [];
  const sd = subs.filter((x) => x.done).length;
  const manual = route === 'planejar' && sort === 'manual' && !t.done;
  const taskIcon = taskIconKey(t.icon);
  const metadata = [];
  if (t.dueDate) {
    const dateLabel = !t.done && d < 0 ? `Atrasada · ${shortDate(t.dueDate)}${tm}`
      : d === 0 ? (isHomeNextStep ? t.time || '' : `Hoje${tm}`)
        : d === 1 ? `Amanhã${tm}` : `${shortDate(t.dueDate)}${tm}`;
    if (dateLabel) metadata.push({ icon: t.time ? 'clock' : 'calendar', label: dateLabel, tone: !t.done && d < 0 ? 'm-bad' : d === 0 && !isHomeNextStep ? 'm-warn' : '' });
  }
  if (t.priority === 'high') metadata.push({ icon: 'flag', label: 'Alta', tone: 'm-hi' });
  else if (t.priority === 'low') metadata.push({ icon: 'flag', label: 'Baixa', tone: '' });
  if (t.repeat && t.repeat !== 'none') metadata.push({ icon: 'repeat', label: REPEATS[t.repeat], tone: '' });
  if (t.remind != null && t.time) metadata.push({ icon: 'bell', label: `Lembrete · ${t.time}`, tone: '' });
  if (subs.length) metadata.push({ icon: 'list', label: `${sd}/${subs.length}`, tone: '' });
  if (t.notes) metadata.push({ icon: 'note', label: 'Nota', tone: '' });
  (t.tags || []).forEach((tag) => metadata.push({ icon: 'tag', label: `#${tag}`, tone: '' }));
  if (t.groupTitle) metadata.push({ icon: 'list', label: t.groupTitle, tone: '' });
  if (t.sample) metadata.push({ icon: 'sparkles', label: 'Exemplo', tone: '' });
  const shownMetadata = metadata.slice(0, 3);
  const extraMetadata = metadata.length - shownMetadata.length;

  return h`<li class="task ${t.done ? 'done' : ''}${isReviewNextWeek ? ' weekly-plan-task' : ''}${isHomeNextStep ? ' home-next-task' : ''}" data-k="${t.id}" ${manual ? raw('draggable="true"') : ''}>${manual ? h`<span class="mvc"><button type="button" class="ibtn mv" data-action="mv-up" data-id="${t.id}" aria-label="Mover para cima: ${t.title}">${icon('arrowUp', 16)}</button><button type="button" class="ibtn mv" data-action="mv-down" data-id="${t.id}" aria-label="Mover para baixo: ${t.title}">${icon('arrowDown', 16)}</button></span>` : ''}
    <button class="chk p-${t.priority}" role="checkbox" aria-checked="${String(t.done)}" aria-label="${t.done ? 'Reabrir' : 'Concluir'}: ${t.title}" data-action="toggle" data-id="${t.id}"><span>${icon('check', 15)}</span></button>
    <button class="tt" data-action="edit-task" data-id="${t.id}" aria-label="${isHomeNextStep ? 'Próximo passo. ' : ''}Editar: ${t.title}"><span class="task-title-line">${taskIcon ? icon(taskIcon, 17, 'task-title-icon') : ''}<span class="ttl">${t.title}</span>${isHomeNextStep ? h`<span class="home-next-step-label">Próximo passo</span>` : ''}</span>
      <span class="meta">${shownMetadata.map(({ icon: iconName, label, tone }) => h`<span class="meta-chip ${tone}" title="${label}">${icon(iconName, 12)}${label}</span>`)}${extraMetadata ? h`<span class="meta-chip meta-overflow" aria-label="${extraMetadata} metadados adicionais">+${extraMetadata}</span>` : ''}</span></button>
    <button class="ibtn" data-action="del-task" data-id="${t.id}" aria-label="Excluir ${t.title}">${icon('trash', 18)}</button>
    ${isReviewNextWeek ? h`<div class="weekly-plan-actions" role="group" aria-label="Decisão para ${t.title}"><button type="button" class="btn ghost sm" data-action="weekly-keep-task" data-id="${t.id}">Manter</button><button type="button" class="btn ghost sm" data-action="edit-task" data-id="${t.id}">Ajustar</button><button type="button" class="btn ghost sm" data-action="weekly-defer-task" data-id="${t.id}">Adiar uma semana</button></div>` : ''}
  </li>`;
}
