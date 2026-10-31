// Verifica se o CSS usa os tokens do design system em vez de valores soltos.
// Regras em docs/design-system.md. Abra por HTTP no Vite ou em servidor estático.
const results = [];
const check = (passed, name, detail = '') => results.push({ passed: Boolean(passed), name, detail });

const loadCss = async (url, seen = new Set()) => {
  const source = new URL(url, location.href);
  source.searchParams.set('raw', '');
  if (seen.has(source.href)) return [];
  seen.add(source.href);
  const response = await fetch(source.href, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Não foi possível carregar ${source.pathname}: HTTP ${response.status}.`);
  const moduleText = await response.text();
  const rawExport = moduleText.match(/^export default ("(?:\\.|[^"\\])*");?$/);
  const text = rawExport ? JSON.parse(rawExport[1]) : moduleText;
  const out = [{ file: source.pathname.replace(/^.*\/src\/css\//, ''), text }];
  for (const [, rel] of text.matchAll(/@import\s+url\(["']?([^"')]+)["']?\)/g)) {
    const dependency = new URL(rel, source);
    dependency.searchParams.set('raw', '');
    out.push(...await loadCss(dependency.href, seen));
  }
  return out;
};

const files = await loadCss('/src/css/main.css');
const strip = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '');
const outsideTokens = files.filter((item) => item.file !== 'design-system/tokens.css');
const offenders = (regex, filter = () => true) => outsideTokens.flatMap(({ file, text }) => (
  [...strip(text).matchAll(regex)].filter((match) => filter(match)).map((match) => `${file}: ${match[0]}`)
));

// Variáveis definidas só por JavaScript (estilos inline) ficam de fora da checagem.
const SET_BY_SCRIPT = new Set(['--c', '--category-tone', '--cycle-progress']);
const allText = files.map((item) => strip(item.text)).join('\n');
const defined = new Set([...allText.matchAll(/(--[\w-]+)\s*:/g)].map((match) => match[1]));
const missing = [...new Set([...allText.matchAll(/var\((--[\w-]+)\s*\)/g)].map((match) => match[1]))]
  .filter((name) => !defined.has(name) && !SET_BY_SCRIPT.has(name));
check(files.length > 20, 'main.css importa as folhas esperadas', `${files.length} arquivos`);
check(!files.some((item) => item.file === 'components/visual-refresh.css'), 'Regras visuais estão nas folhas de origem');
check(files.some((item) => item.file === 'design-system/lists.css'), 'O padrão de listas está no design system');
check(files.some((item) => item.file === 'design-system/cards.css' && item.text.includes('.compact-card-grid') && item.text.includes('.shortcut-grid') && item.text.includes('.shortcut-card')), 'O padrão de cartões compactos está no design system');
const modalStyles = files.find((item) => item.file === 'components/modals.css');
check(Boolean(modalStyles) && !strip(modalStyles.text).includes('!important'), 'Modais não dependem de !important');
check(!missing.length, 'Toda var(--token) usada existe', missing.join(', '));

// base.css fixa 16 px no elemento raiz: é a base de todos os rem, por isso é a única exceção.
const fontLiterals = offenders(/font-size:\s*(?:\d*\.?\d+(?:rem|px)|\d+\.\d+em)\s*[;}]/g)
  .filter((item) => item !== 'base.css: font-size: 16px;');
check(!fontLiterals.length, 'Tamanhos de fonte usam --text-* (exceto clamp e o mínimo de 16 px dos campos)', fontLiterals.slice(0, 6).join(' | '));

const radiusLiterals = offenders(/border-radius:\s*[^;{}]*\d+(?:\.\d+)?px[^;{}]*[;}]/g);
check(!radiusLiterals.length, 'Raios usam tokens --r-*', radiusLiterals.slice(0, 6).join(' | '));

const heightLiterals = offenders(/min-height:\s*(?:38|40|42|44|46|48|50|52|54)px\s*[;}]/g);
check(!heightLiterals.length, 'Alturas mínimas de controle usam --control-*', heightLiterals.slice(0, 6).join(' | '));

const hexLiterals = offenders(/(?:color|background|border-color|fill|stroke):\s*#(?:fff|ffffff|000|000000)(?![\w])/gi);
check(!hexLiterals.length, 'Cores sólidas em branco/preto usam --on-solid ou tokens de tema (misturas com color-mix são permitidas)', hexLiterals.slice(0, 6).join(' | '));

const scale = new Set([...allText.matchAll(/--text-(2xs|xs|meta|sm|md|base|lg|xl|title|2xl|3xl)\s*:/g)].map((match) => match[1]));
check(scale.size === 11, 'A escala de tipografia tem os 11 degraus', [...scale].join(', '));
for (const name of [
  '--control-sm', '--control-md', '--control-field', '--control-lg',
  '--r-xs', '--r-sm', '--r-control', '--r-group', '--r', '--r-large', '--r-pill', '--on-solid',
  '--card-padding', '--card-padding-compact', '--card-content-gap',
  '--card-compact-min-width', '--card-compact-max-width', '--card-compact-gap',
  '--shadow-sm',
  '--button-gap', '--button-padding-inline', '--button-padding-inline-sm', '--button-padding-inline-lg', '--button-radius',
  '--list-gap', '--list-row-gap', '--list-row-padding-block', '--list-row-padding-inline',
]) {
  check(defined.has(name), `Token ${name} definido`);
}

const failed = results.filter((item) => !item.passed).length;
document.querySelector('#status').textContent = failed
  ? `${failed} de ${results.length} verificações falharam.`
  : `${results.length}/${results.length} verificações passaram.`;
document.querySelector('#results').innerHTML = results
  .map((item) => `<li>${item.passed ? 'OK' : 'FALHOU'} — ${item.name}${item.detail ? ` (${item.detail})` : ''}</li>`)
  .join('');
