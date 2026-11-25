import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CONTACT_EMAIL, normalizeSuggestionMessage, submitSuggestion } from '../src/js/features/footer/suggestions.js';
import { renderFooterContent, renderSuggestionForm } from '../src/js/features/footer/view.js';

const publicFooter = renderFooterContent({ demoAvailable: true }).replace(/\s+/g, ' ');
const authenticatedFooter = renderFooterContent({ authenticated: true });
const footerWithSuggestions = renderFooterContent({ suggestionForm: true });
const suggestionForms = [...footerWithSuggestions.matchAll(/<form class="footer-suggestion-form"[\s\S]*?<\/form>/g)]
  .map(([form]) => form);
const sharedSuggestionForm = renderSuggestionForm().match(/<form class="footer-suggestion-form"[\s\S]*?<\/form>/)?.[0];
assert.equal(CONTACT_EMAIL, 'lisjustino@gmail.com');
assert.equal(suggestionForms.length, 2);
assert.equal(suggestionForms[0], suggestionForms[1]);
assert.equal(suggestionForms[0], sharedSuggestionForm);
assert.ok(suggestionForms.every((form) => form.includes('data-suggestion-error role="alert"')));
assert.ok(suggestionForms.every((form) => form.includes('name="message"')
  && form.includes('minlength="10"')
  && form.includes('maxlength="2000"')));
assert.ok(suggestionForms.every((form) => !form.includes('name="email"')
  && !form.includes('name="name"')
  && !form.includes(CONTACT_EMAIL)));
assert.ok(footerWithSuggestions.includes(`href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>`));
assert.match(publicFooter, /href="\/demonstracao" data-public-action="demo">Ver demonstração/);
assert.match(publicFooter, /data-suggestion-status role="status"/);
assert.doesNotMatch(renderFooterContent(), /data-action="copy-contact-email"/);
assert.match(authenticatedFooter, /href="\/ajustes">Perfil e ajustes<\/a>/);
assert.doesNotMatch(authenticatedFooter, /data-account-signout|Sair da conta/);
assert.match(publicFooter, /class="btn sm back footer-back-to-top" type="button" data-action="footer-scroll-top">Voltar ao topo/);
assert.match(sharedSuggestionForm, /Sua sugestão/);
assert.match(sharedSuggestionForm, /data-suggestion-count/);
assert.match(sharedSuggestionForm, /Sua mensagem vai para análise/);
assert.match(sharedSuggestionForm, /placeholder="Conte o que poderia ser mais simples, útil ou melhor…"/);

const mainJs = readFileSync(
  new URL('../src/js/main.js', import.meta.url),
  'utf8',
);
const accountSettingsBlock = mainJs.match(/function accountSettings\(s\) \{([\s\S]*?)\n\}\nfunction profileDraftHasChanges/)?.[1] ?? '';
assert.doesNotMatch(accountSettingsBlock, /data-account-signout|Sair da conta/);

const settingsCss = readFileSync(
  new URL('../src/css/pages/settings.css', import.meta.url),
  'utf8',
);
assert.match(settingsCss, /\.main\[data-route="config"\] \.settings-account-list \{ gap: var\(--space-5\); \}/);

const settingsView = readFileSync(
  new URL('../src/js/features/settings/view.js', import.meta.url),
  'utf8',
);
assert.match(settingsView, /Você não precisa passar por isso sozinho/);
assert.match(settingsView, /Falar com alguém agora/);
assert.match(settingsView, /Se houver risco imediato/);
assert.match(settingsView, /tel:188/);
assert.match(settingsView, /tel:192/);

const landingCss = readFileSync(
  new URL('../src/css/pages/landing.css', import.meta.url),
  'utf8',
);
assert.match(landingCss, /@media \(width <= 360px\)[\s\S]*?\.landing-footer-nav \{ grid-template-columns: minmax\(0, 1fr\);/);
assert.match(landingCss, /\.landing-footer-meta \{ align-items: flex-start; flex-direction: column; \}/);
assert.equal(normalizeSuggestionMessage('  Uma ideia que ajuda o app.  '), 'Uma ideia que ajuda o app.');
assert.throws(() => normalizeSuggestionMessage('   '), TypeError);
assert.throws(() => normalizeSuggestionMessage('curto'), TypeError);
assert.throws(() => normalizeSuggestionMessage('x'.repeat(2001)), TypeError);
assert.throws(() => normalizeSuggestionMessage(null), TypeError);
let submittedSuggestion;
await submitSuggestion({
  functions: {
    invoke: async (name, options) => {
      submittedSuggestion = { name, options };
      return { error: null };
    },
  },
}, '  Uma ideia que ajuda o app.  ');
assert.deepEqual(submittedSuggestion, {
  name: 'submit-suggestion',
  options: { body: { message: 'Uma ideia que ajuda o app.' } },
});
const submissionError = new Error('submission failed');
await assert.rejects(submitSuggestion({
  functions: { invoke: async () => ({ error: submissionError }) },
}, 'Uma ideia que ajuda o app.'), (error) => error === submissionError);
await assert.rejects(submitSuggestion({}, 'Uma ideia que ajuda o app.'), /não está disponível/);

const suggestionMigration = readFileSync(
  new URL('../supabase/migrations/20261116000000_public_suggestions.sql', import.meta.url),
  'utf8',
);
assert.match(suggestionMigration, /enable row level security/i);
assert.match(suggestionMigration, /grant execute on function public\.submit_public_suggestion\(text, text\) to anon/i);
assert.match(suggestionMigration, /submission_count > 3/);
assert.match(suggestionMigration, /interval '1 hour'/);
assert.match(suggestionMigration, /revoke all on table public\.public_suggestions from public, anon, authenticated/i);

console.log('footer-suggestions-check: all checks passed');
