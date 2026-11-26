import { addDays, DIAS, longDate, pk, today } from '../utils/dates.js';
import { h, raw } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { habitStartedOnOrBefore } from '../features/habits/dates.js';
import {
  habitColor,
  habitEntryType,
  habitIconKey,
  habitIsSkipped,
  isWaterHabit,
  isWeightHabit,
} from '../features/habits/model.js';
import { closeBtn, dlgWrap } from './dialogs.js';
import { habitCompletedFor } from './home.js';
import { S, ui } from './state.js';

export const OTHER_DAY_SPAN = 7;

/** Hábitos que dá para marcar à mão em `day`: ativos, programados e já iniciados. */
export function habitsForOtherDay(day) {
  const weekday = pk(day).getDay();
  return S.habits.filter(
    (habit) =>
      (habit.status || 'active') === 'active' &&
      habit.days.includes(weekday) &&
      habitStartedOnOrBefore(habit, day) &&
      habitEntryType(habit) === 'check' &&
      !isWaterHabit(habit) &&
      !isWeightHabit(habit),
  );
}

export function dlgHabitOtherDay() {
  const d = ui.dlg.d;
  const current = today();
  const days = Array.from({ length: OTHER_DAY_SPAN }, (_, index) => addDays(d.end, index - OTHER_DAY_SPAN + 1));
  const habits = habitsForOtherDay(d.day);
  const doneCount = habits.filter((habit) => habitCompletedFor(habit, d.day)).length;
  return dlgWrap(
    h`<div class="head head-nowrap"><h2 id="dt">Registrar outro dia</h2>${closeBtn}</div>
    <div class="habit-day-picker">
      <button type="button" class="ibtn" data-action="habit-other-shift" data-n="-1"
        aria-label="Ver os 7 dias anteriores">${icon('chevLeft', 18)}</button>
      <div class="habit-day-strip" role="group" aria-label="Escolha o dia">${days.map(
        (day) => h`<button type="button" class="habit-day-option${day === d.day ? ' is-selected' : ''}"
        data-action="habit-other-pick" data-d="${day}" aria-pressed="${day === d.day}"
        aria-label="${longDate(day)}${day === current ? ' (hoje)' : ''}"><span>${DIAS[pk(day).getDay()].slice(0, 3)}</span><b>${pk(day).getDate()}</b></button>`,
      )}</div>
      <button type="button" class="ibtn" data-action="habit-other-shift" data-n="1"
        aria-label="Ver os 7 dias seguintes" ${d.end >= current ? raw('disabled') : ''}>${icon('chevRight', 18)}</button>
    </div>
    <p class="small muted" role="status" aria-live="polite">${longDate(d.day)}${
      habits.length ? ` · ${doneCount} de ${habits.length} feitos` : ''
    }</p>
    ${
      habits.length
        ? h`<ul class="habit-other-list" aria-label="Hábitos de ${longDate(d.day)}">${habits.map((habit) => {
            const done = habitCompletedFor(habit, d.day);
            const skipped = habitIsSkipped(habit, d.day, current);
            return h`<li style="--hc:${habitColor(habit)}"><button type="button"
            class="habit-other-item${done ? ' is-done' : ''}" data-action="habit-other-toggle"
            data-id="${habit.id}" data-d="${d.day}" aria-pressed="${done}"><span
            class="habit-circle is-static"><span class="habit-circle-icon">${icon(habitIconKey(habit), 20)}</span><span
            class="habit-circle-check">${icon('check', 20)}</span></span><span class="habit-main"><span
            class="habit-title">${habit.name}</span>${skipped ? h`<span class="habit-sub">Dia pulado; marcar remove o pulo</span>` : ''}</span></button></li>`;
          })}</ul>`
        : h`<p class="muted">Nenhum hábito para marcar manualmente neste dia.</p>`
    }
    <p class="small muted">Água e peso são registrados pelos próprios registros.</p>`,
    h`<button type="button" class="btn primary" data-action="dlg-close">Concluir</button>`,
  );
}
