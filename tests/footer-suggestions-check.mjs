import assert from 'node:assert/strict';
import { createSuggestionMailto } from '../src/js/features/footer/suggestions.js';
import { renderFooterContent } from '../src/js/features/footer/view.js';

const publicFooter = renderFooterContent({ demoAvailable: true });
assert.match(publicFooter, /data-public-action="demo">Explorar demonstração/);
assert.doesNotMatch(renderFooterContent(), /data-public-action="demo"/);
assert.match(publicFooter, /class="btn sm back footer-back-to-top" type="button" data-action="footer-scroll-top">Voltar ao topo/);
assert.doesNotMatch(publicFooter, /Supabase|service_role|\.env\.local/);

const mailto = new URL(createSuggestionMailto({
  name: 'Elisa & Aurora',
  email: 'elisa@example.com',
  message: 'Uma ideia: foco, rotina e bem-estar.',
}));

assert.equal(mailto.protocol, 'mailto:');
assert.equal(mailto.pathname, 'lisjustino@gmail.com');
assert.equal(mailto.searchParams.get('subject'), 'Sugestão para o Aurora');
assert.equal(mailto.searchParams.get('body'), [
  'Nome: Elisa & Aurora',
  'E-mail para resposta: elisa@example.com',
  'Sugestão:\nUma ideia: foco, rotina e bem-estar.',
].join('\n\n'));
assert.throws(() => createSuggestionMailto({ message: '  ' }), TypeError);
assert.throws(() => createSuggestionMailto({ name: 7, message: 'Sugestão' }), TypeError);

console.log('footer-suggestions-check: all checks passed');
