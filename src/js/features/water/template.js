import { loadHtmlTemplate, renderHtmlTemplate } from '../../utils/html-template.js';

export function loadWaterTemplate() {
  return loadHtmlTemplate(new URL('./template.html', import.meta.url), 'Água');
}

export function renderWaterTemplate(template, slots) {
  return renderHtmlTemplate(template, slots, 'Água');
}
