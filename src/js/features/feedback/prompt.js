import { h } from '../../utils/dom.js';

export const FEEDBACK_PROMPT_INTERVAL_MS = 5 * 24 * 60 * 60 * 1000;

export function feedbackPromptNextAt(now = Date.now()) {
  if (!Number.isFinite(now)) throw new TypeError('O horário do lembrete deve ser válido.');
  return new Date(now + FEEDBACK_PROMPT_INTERVAL_MS).toISOString();
}

export function isFeedbackPromptDue(nextAt, now = Date.now()) {
  if (!Number.isFinite(now) || typeof nextAt !== 'string') return false;
  const timestamp = Date.parse(nextAt);
  return Number.isFinite(timestamp) && timestamp <= now;
}

export function normalizeFeedbackPromptNextAt(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : null;
}

export function isValidFeedbackPromptNextAt(value) {
  return value === null || (typeof value === 'string' && Number.isFinite(Date.parse(value)));
}

export function feedbackSuggestionHref() {
  return '/ajustes/conta';
}

export function renderFeedbackPrompt() {
  return h`<section class="notice feedback-prompt" aria-labelledby="feedback-prompt-title">
    <div class="feedback-prompt-copy"><b id="feedback-prompt-title">Está gostando do Aurora?</b><p>Tem uma ideia ou sentiu falta de algo? Conte para quem desenvolve o Aurora.</p></div>
    <div class="row feedback-prompt-actions">
      <button type="button" class="btn primary" data-action="feedback-prompt-dismiss">Sim, estou gostando</button>
      <a class="btn ghost" href="${feedbackSuggestionHref()}">Sugerir uma melhoria</a>
      <button type="button" class="btn back" data-action="feedback-prompt-dismiss">Agora não</button>
    </div>
  </section>`;
}
