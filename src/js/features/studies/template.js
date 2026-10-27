import { loadHtmlTemplate, renderHtmlTemplate } from '../../utils/html-template.js';

export function loadStudiesTemplate() {
  return loadHtmlTemplate(new URL('./template.html', import.meta.url), 'Estudos');
}

export function renderStudiesTemplate(template, slots) {
  return renderHtmlTemplate(template, slots, 'Estudos');
}
