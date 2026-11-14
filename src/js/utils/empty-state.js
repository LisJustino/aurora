import { renderHtmlTemplate } from './html-template.js';
import { h, raw } from './dom.js';
import { icon } from './icons.js';

const EMPTY_STATE_TEMPLATE = `<section class="empty empty-state {{class-name}}" data-empty-state role="status" aria-live="polite" {{hidden}}>
  <span class="eic empty-state-icon" aria-hidden="true">{{icon}}</span>
  <div class="empty-copy">
    <{{heading-level}} class="empty-state-title">{{title}}</{{heading-level}}>
    <p class="empty-state-description">{{description}}</p>
  </div>
  <div class="empty-action">{{action}}</div>
</section>`;
const HEADING_LEVELS = new Set(['h2', 'h3', 'h4', 'h5', 'h6']);

export function emptyState({
  title,
  description,
  action,
  iconName = 'sparkles',
  headingLevel = 'h3',
  className = '',
  hidden = false,
}) {
  const level = HEADING_LEVELS.has(headingLevel) ? headingLevel : 'h3';
  const stateTitle = String(title || '').trim();
  const finalTitle = /[.!?]$/.test(stateTitle) ? stateTitle : `${stateTitle}.`;
  const actionMarkup = action && typeof action.s === 'string' ? action.s : '';
  const html = renderHtmlTemplate(EMPTY_STATE_TEMPLATE, {
    'class-name': h`${className}`.s,
    hidden: hidden ? 'hidden' : '',
    icon: h`${icon(iconName, 24)}`.s,
    'heading-level': level,
    title: h`${finalTitle}`.s,
    description: h`${description || ''}`.s,
    action: actionMarkup,
  }, 'estado vazio');
  return raw(html);
}
