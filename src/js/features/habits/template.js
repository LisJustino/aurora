import templateSource from './template.html?raw';
import { renderHtmlTemplate } from '../../utils/html-template.js';

export function loadHabitsTemplate() {
  return Promise.resolve(templateSource);
}

export function renderHabitsTemplate(template, slots) {
  return renderHtmlTemplate(template, slots, 'Hábitos');
}
