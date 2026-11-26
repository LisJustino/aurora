import assert from 'node:assert/strict';
import {
  releaseDescriptionFromCommit,
  releaseItemsFromCommit,
  releaseMetadataFromCommits,
  releaseTitleFromCommit,
} from '../scripts/release-metadata.mjs';

const {
  CURATED_RELEASE,
  getReleaseNotes,
  markReleaseNotesSeen,
  RELEASE_VERSION,
  shouldShowReleaseNotes,
} = await import('../src/js/features/release-notes.js');

assert.equal(RELEASE_VERSION, CURATED_RELEASE.id);
const curated = getReleaseNotes(RELEASE_VERSION);
assert.ok(curated);
assert.ok(curated.items.length >= 3);
assert.equal(
  curated.items.some((item) => /(?:main\.js|prettier|refactor|feat\(|fix\(|csp)/i.test(`${item.title} ${item.description}`)),
  false,
  'novidades exibidas ao usuário não devem conter jargão técnico de código',
);
assert.equal(getReleaseNotes('0.0.0'), null);

assert.equal(releaseTitleFromCommit('feat(financas): filtrar lançamentos por conta'), 'Novidade: Filtrar lançamentos por conta');
assert.equal(releaseTitleFromCommit('fix(auth): corrigir retorno ao login'), 'Correção: Corrigir retorno ao login');
assert.equal(releaseTitleFromCommit('perf(home): acelerar abertura do início'), 'Melhoria: Acelerar abertura do início');
assert.equal(releaseTitleFromCommit('refactor(app): dividir main.js em módulos'), '');
assert.equal(releaseTitleFromCommit('docs: atualizar instruções'), '');
assert.equal(releaseTitleFromCommit('test: cobrir fluxo'), '');
assert.equal(releaseTitleFromCommit('Merge pull request #123 from aurora/feature'), '');
assert.equal(releaseTitleFromCommit(''), '');

assert.deepEqual(
  releaseItemsFromCommit(`Novidades no Aurora:
- Painel atualizado: Agora você acompanha suas tarefas com mais facilidade.
- Novo guia rápido
Reviewed-by: Example`),
  [
    { title: 'Painel atualizado', description: 'Agora você acompanha suas tarefas com mais facilidade.' },
    { title: 'Novo guia rápido', description: '' },
  ],
);
assert.equal(
  releaseDescriptionFromCommit(`Novidades no Aurora:
- Agora você pode acompanhar suas tarefas com mais facilidade.
Reviewed-by: Example`),
  'Agora você pode acompanhar suas tarefas com mais facilidade.',
);
assert.equal(releaseDescriptionFromCommit('Detalhes técnicos sem seção pública.'), '');

// Commits sem seção pública "Novidades no Aurora:" não vazam texto técnico
assert.equal(
  releaseMetadataFromCommits([
    { id: 'refactor-commit', subject: 'refactor(app): dividir main.js', body: '' },
    { id: 'raw-feat', subject: 'feat(ux): ajustar css e submenus', body: '- Ajustar css' },
  ]),
  null,
);
assert.deepEqual(
  releaseMetadataFromCommits([
    { id: 'docs-commit', subject: 'docs: atualizar instruções', body: '' },
    {
      id: 'feature-commit',
      subject: 'feat: criar painel de novidades',
      body: 'Novidades no Aurora:\n- Novo painel: Agora você acompanha as atualizações em um só lugar.',
    },
  ]),
  {
    id: 'feature-commit',
    title: 'Novidade: Criar painel de novidades',
    items: [{ title: 'Novo painel', description: 'Agora você acompanha as atualizações em um só lugar.' }],
    description: 'Novo painel: Agora você acompanha as atualizações em um só lugar.',
  },
);

const settings = { prefs: {} };
assert.equal(shouldShowReleaseNotes(settings), true);
assert.equal(markReleaseNotesSeen(settings), true);
assert.equal(shouldShowReleaseNotes(settings), false);
assert.equal(shouldShowReleaseNotes({ prefs: { releaseNotesSeen: 'release-older' } }), true);
assert.equal(shouldShowReleaseNotes({ prefs: {} }, '0.0.0'), false);
assert.equal(markReleaseNotesSeen({}, '0.0.0'), false);

console.log('release-notes-check: ok');
