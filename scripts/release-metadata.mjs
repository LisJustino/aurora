import { execFileSync } from 'node:child_process';

const NON_USER_FACING_TYPES = new Set(['build', 'chore', 'ci', 'docs', 'refactor', 'style', 'test']);
const VISIBLE_TYPES = {
  feat: 'Novidade',
  fix: 'Correção',
  perf: 'Melhoria',
  revert: 'Reversão',
};

export function releaseTitleFromCommit(subject) {
  if (typeof subject !== 'string') return '';
  const cleanSubject = subject.trim();
  if (!cleanSubject) return '';
  if (/^merge (?:pull request|branch|remote-tracking branch)\b/i.test(cleanSubject)) return '';

  const conventional = cleanSubject.match(/^([a-z]+)(?:\([^)]+\))?!?:\s*(.+)$/i);
  if (!conventional) return cleanSubject;

  const [, type, summary] = conventional;
  const normalizedType = type.toLowerCase();
  if (NON_USER_FACING_TYPES.has(normalizedType)) return '';

  const label = VISIBLE_TYPES[normalizedType];
  if (!label) return cleanSubject;
  const readableSummary = summary.trim().replace(/^./u, (character) => character.toLocaleUpperCase('pt-BR'));
  return `${label}: ${readableSummary}`;
}

export function releaseItemsFromCommit(body) {
  if (typeof body !== 'string') return [];
  const lines = body.split(/\r?\n/);
  const headingIndex = lines.findIndex((line) => /^novidades no aurora:\s*$/i.test(line.trim()));
  if (headingIndex < 0) return [];

  const items = [];
  for (const line of lines.slice(headingIndex + 1)) {
    const cleanLine = line.trim();
    if (!cleanLine) {
      if (items.length) break;
      continue;
    }
    if (/^[A-Za-z][A-Za-z0-9-]*:\s/.test(cleanLine)) break;
    const text = cleanLine.replace(/^(?:[-*]\s+|\d+[.)]\s+)/, '').trim();
    if (!text) continue;
    const splitIndex = text.indexOf(': ');
    if (splitIndex > 0 && splitIndex <= 64) {
      items.push({
        title: text.slice(0, splitIndex).trim(),
        description: text.slice(splitIndex + 2).trim(),
      });
    } else {
      items.push({ title: text, description: '' });
    }
  }
  return items;
}

export function releaseDescriptionFromCommit(body) {
  const items = releaseItemsFromCommit(body);
  if (!items.length) return '';
  return items
    .map((item) => (item.description ? `${item.title}: ${item.description}` : item.title))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function releaseMetadataFromCommits(commits) {
  const release = commits.find(
    (commit) => releaseTitleFromCommit(commit.subject) && releaseItemsFromCommit(commit.body).length > 0,
  );
  if (!release) return null;
  const items = releaseItemsFromCommit(release.body);
  const description = releaseDescriptionFromCommit(release.body);
  return {
    id: release.id,
    title: releaseTitleFromCommit(release.subject),
    items,
    ...(description ? { description } : {}),
  };
}

function runGit(root, args) {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

export function readReleaseMetadata(root) {
  const log = runGit(root, ['log', '-100', '--format=%H%x1f%s%x1f%b%x1e', 'HEAD']);
  const commits = log
    .split('\x1e')
    .map((record) => {
      const fields = record.trim().split('\x1f');
      return fields.length < 2
        ? null
        : { id: fields[0].trim(), subject: fields[1].trim(), body: fields.slice(2).join('\x1f').trim() };
    })
    .filter(Boolean);

  const release = releaseMetadataFromCommits(commits);
  if (release) return release;

  const fallbackId = process.env.CF_PAGES_COMMIT_SHA || process.env.GITHUB_SHA || 'development';
  return { id: fallbackId, title: '', items: [] };
}
