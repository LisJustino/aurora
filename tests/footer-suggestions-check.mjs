import assert from 'node:assert/strict';
import { CONTACT_EMAIL, createSuggestionMailto } from '../src/js/features/footer/suggestions.js';
import { renderFooterContent, renderSuggestionForm } from '../src/js/features/footer/view.js';

const publicFooter = renderFooterContent({ demoAvailable: true });
const footerWithSuggestions = renderFooterContent({ suggestionForm: true });
const suggestionForms = [...footerWithSuggestions.matchAll(/<form class="footer-suggestion-form"[\s\S]*?<\/form>/g)]
  .map(([form]) => form);
const sharedSuggestionForm = renderSuggestionForm().match(/<form class="footer-suggestion-form"[\s\S]*?<\/form>/)?.[0];
assert.equal(CONTACT_EMAIL, 'lisjustino@gmail.com');
assert.equal(suggestionForms.length, 2);
assert.equal(suggestionForms[0], suggestionForms[1]);
assert.equal(suggestionForms[0], sharedSuggestionForm);
assert.ok(suggestionForms.every((form) => form.includes('data-suggestion-error role="alert"')));
assert.ok(suggestionForms.every((form) => form.includes(CONTACT_EMAIL)));
assert.ok(footerWithSuggestions.includes(`href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>`));
assert.match(publicFooter, /href="\/demonstracao" data-public-action="demo">Explorar demonstração/);
assert.match(publicFooter, /data-action="copy-contact-email">Copiar e-mail de contato/);
assert.match(publicFooter, /data-suggestion-copy-status role="status"/);
assert.match(renderFooterContent(), /data-action="copy-contact-email"/);
assert.match(publicFooter, /class="btn sm back footer-back-to-top" type="button" data-action="footer-scroll-top">Voltar ao topo/);
assert.doesNotMatch(publicFooter, /Supabase|service_role|\.env\.local/);

const mailto = new URL(createSuggestionMailto({
  name: 'Elisa & Aurora',
  email: 'elisa@example.com',
  message: 'Uma ideia: foco, rotina e bem-estar.',
}));

assert.equal(mailto.protocol, 'mailto:');
assert.equal(mailto.pathname, CONTACT_EMAIL);
assert.equal(mailto.searchParams.get('subject'), 'Sugestão para o Aurora');
assert.equal(mailto.searchParams.get('body'), [
  'Nome: Elisa & Aurora',
  'E-mail para resposta: elisa@example.com',
  'Sugestão:\nUma ideia: foco, rotina e bem-estar.',
].join('\n\n'));
assert.throws(() => createSuggestionMailto({ message: '  ' }), TypeError);
assert.throws(() => createSuggestionMailto({ name: 7, message: 'Sugestão' }), TypeError);

console.log('footer-suggestions-check: all checks passed');
