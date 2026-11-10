import { h } from '../../utils/dom.js';
import { FINANCE_PRIVACY_NOTICE } from '../area-guides.js';

export function financePrivacyNotice() {
  return h`<aside class="notice finance-privacy-note" role="note"><span><strong>Sem conexão bancária</strong><span>${FINANCE_PRIVACY_NOTICE}</span></span></aside>`;
}
