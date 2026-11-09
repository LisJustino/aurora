import assert from 'node:assert/strict';
import {
  releaseDescriptionFromCommit,
  releaseMetadataFromCommits,
  releaseTitleFromCommit,
} from '../scripts/release-metadata.mjs';
globalThis.__AURORA_RELEASE_METADATA__ = {
  id: 'release-123',
  title: 'Novidade: Criar painel',
  description: 'Agora você pode acompanhar as novidades em um só lugar.',
};
const {
  getReleaseNotes,
  markReleaseNotesSeen,
  RELEASE_VERSION,
  shouldShowReleaseNotes,
} = await import('../src/js/features/release-notes.js');

assert.equal(RELEASE_VERSION, 'release-123');
assert.deepEqual(getReleaseNotes(RELEASE_VERSION), {
  title: 'O que mudou no Aurora',
  items: [{
    title: 'Novidade: Criar painel',
    description: 'Agora você pode acompanhar as novidades em um só lugar.',
  }],
});
assert.equal(getReleaseNotes('0.0.0'), null);
assert.equal(releaseTitleFromCommit('feat(financas): filtrar lançamentos por conta'), 'Novidade: Filtrar lançamentos por conta');
assert.equal(releaseTitleFromCommit('fix(auth): corrigir retorno ao login'), 'Correção: Corrigir retorno ao login');
assert.equal(releaseTitleFromCommit('perf(home): acelerar abertura do início'), 'Melhoria: Acelerar abertura do início');
assert.equal(releaseTitleFromCommit('docs: atualizar instruções'), '');
assert.equal(releaseTitleFromCommit('test: cobrir fluxo'), '');
assert.equal(releaseTitleFromCommit('Merge pull request #123 from aurora/feature'), '');
assert.equal(releaseTitleFromCommit(''), '');
assert.equal(releaseDescriptionFromCommit(`Novidades no Aurora:
- Agora você pode acompanhar suas tarefas com mais facilidade.
Reviewed-by: Example`), 'Agora você pode acompanhar suas tarefas com mais facilidade.');
assert.equal(releaseDescriptionFromCommit('Detalhes técnicos sem seção pública.'), '');
assert.deepEqual(releaseMetadataFromCommits([
  { id: 'docs-commit', subject: 'docs: atualizar instruções' },
  {
    id: 'feature-commit',
    subject: 'feat: criar painel de novidades',
    body: 'Novidades no Aurora:\nAgora você acompanha as atualizações em um só lugar.',
  },
]), {
  id: 'feature-commit',
  title: 'Novidade: Criar painel de novidades',
  description: 'Agora você acompanha as atualizações em um só lugar.',
});

const settings = { prefs: {} };
assert.equal(shouldShowReleaseNotes(settings), true);
assert.equal(markReleaseNotesSeen(settings), true);
assert.equal(shouldShowReleaseNotes(settings), false);
assert.equal(shouldShowReleaseNotes(settings, 'release-older'), false);
assert.equal(shouldShowReleaseNotes({ prefs: { releaseNotesSeen: 'release-older' } }), true);
assert.equal(shouldShowReleaseNotes({ prefs: {} }, '0.0.0'), false);
assert.equal(markReleaseNotesSeen({}, 'release-123'), false);

console.log('release-notes-check: ok');
