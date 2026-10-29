import { loadHtmlTemplate, renderHtmlTemplate } from '../../utils/html-template.js';

export function loadHabitsTemplate() {
  return loadHtmlTemplate(new URL('./template.html', import.meta.url), 'Hábitos');
}

export function renderHabitsTemplate(template, slots) {
  return renderHtmlTemplate(template, slots, 'Hábitos');
}
