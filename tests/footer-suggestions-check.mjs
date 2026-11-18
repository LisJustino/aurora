import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CONTACT_EMAIL, normalizeSuggestionMessage } from '../src/js/features/footer/suggestions.js';
import { renderFooterContent, renderSuggestionForm } from '../src/js/features/footer/view.js';

const publicFooter = renderFooterContent({ demoAvailable: true });
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
assert.match(authenticatedFooter, /href="\/config">Perfil e ajustes<\/a>/);
assert.doesNotMatch(authenticatedFooter, /data-account-signout|Sair da conta/);
assert.match(publicFooter, /class="btn sm back footer-back-to-top" type="button" data-action="footer-scroll-top">Voltar ao topo/);
assert.match(publicFooter, /A mensagem vai para análise/);
assert.equal(normalizeSuggestionMessage('  Uma ideia que ajuda o app.  '), 'Uma ideia que ajuda o app.');
assert.throws(() => normalizeSuggestionMessage('   '), TypeError);
assert.throws(() => normalizeSuggestionMessage('curto'), TypeError);
assert.throws(() => normalizeSuggestionMessage('x'.repeat(2001)), TypeError);
assert.throws(() => normalizeSuggestionMessage(null), TypeError);

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
