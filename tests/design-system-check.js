// Verifica se o CSS usa os tokens do design system em vez de valores soltos.
// Abra por HTTP no Vite ou em servidor estático.
const results = [];
const check = (passed, name, detail = '') => results.push({ passed: Boolean(passed), name, detail });

const loadCss = async (url, seen = new Set()) => {
  const source = new URL(url, location.href);
  source.search += `${source.search ? '&' : '?'}raw`;
  if (seen.has(source.href)) return [];
  seen.add(source.href);
  const response = await fetch(source.href, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Não foi possível carregar ${source.pathname}: HTTP ${response.status}.`);
  const moduleText = await response.text();
  const rawExport = moduleText.match(/^export default ("(?:\\.|[^"\\])*");?/);
  const text = rawExport ? JSON.parse(rawExport[1]) : moduleText;
  const out = [{ file: source.pathname.replace(/^.*\/src\/css\//, ''), text }];
  for (const [, rel] of text.matchAll(/@import\s+url\(["']?([^"')]+)["']?\)/g)) {
    const dependency = new URL(rel, source);
    dependency.search += `${dependency.search ? '&' : '?'}raw`;
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
const SET_BY_SCRIPT = new Set([
  '--c', '--category-tone', '--cycle-progress', '--loading-primary', '--loading-accent',
  '--profile-avatar-color', '--preset-color',
  '--scroll-lock-offset-x', '--scroll-lock-offset-y',
]);
const allText = files.map((item) => strip(item.text)).join('\n');
const responsiveWidths = new Set([...allText.matchAll(/@media([^{}]*)/g)].flatMap(([, query]) => (
  [...query.matchAll(/width\s*[<>]=?\s*([\d.]+)px/g)].map(([, width]) => Number(width))
)));
check(
  [...responsiveWidths].sort((a, b) => a - b).join(',') === '480,700,900,1200',
  'Breakpoints responsivos usam apenas 480, 700, 900 e 1200 px',
  [...responsiveWidths].sort((a, b) => a - b).join(', '),
);
const loadingResponse = await fetch('/loading-appearance.js', { cache: 'no-store' });
if (!loadingResponse.ok) throw new Error(`Não foi possível carregar a aparência inicial: HTTP ${loadingResponse.status}.`);
const loadingScript = await loadingResponse.text();
check(['--loading-primary', '--loading-accent'].every((name) => loadingScript.includes(`setProperty('${name}'`)),
  'Tokens da aparência de carregamento são definidos pelo script inicial');
const defined = new Set([...allText.matchAll(/(--[\w-]+)\s*:/g)].map((match) => match[1]));
const missing = [...new Set([...allText.matchAll(/var\((--[\w-]+)\s*\)/g)].map((match) => match[1]))]
  .filter((name) => !defined.has(name) && !SET_BY_SCRIPT.has(name));
check(files.length > 20, 'main.css importa as folhas esperadas', `${files.length} arquivos`);
check(!files.some((item) => item.file === 'components/visual-refresh.css'), 'Regras visuais estão nas folhas de origem');
check(files.some((item) => item.file === 'design-system/lists.css'), 'O padrão de listas está no design system');
const pageTitleStyles = files.find((item) => item.file === 'design-system/page-titles.css');
const pageTitleOverrides = offenders(/\.main\[data-route=["'][^"']+["']\]\s*>\s*\.page-title/g);
check(Boolean(pageTitleStyles) && pageTitleStyles.text.includes('.main > .page-title') && !pageTitleOverrides.length, 'Cabeçalhos de página usam o componente compartilhado', pageTitleOverrides.join(', '));
check(Boolean(pageTitleStyles) && pageTitleStyles.text.includes('.main h1[tabindex="-1"]:focus { outline: none; }'), 'Títulos focados pela navegação não exibem contorno de controle');
check(files.some((item) => item.file === 'design-system/cards.css' && item.text.includes('.compact-card-grid') && item.text.includes('.shortcut-grid') && item.text.includes('.shortcut-card')), 'O padrão de cartões compactos está no design system');
const modalStyles = files.find((item) => item.file === 'components/modals.css');
check(Boolean(modalStyles) && !strip(modalStyles.text).includes('!important'), 'Modais não dependem de !important');
check(!missing.length, 'Toda var(--token) usada existe', missing.join(', '));
const buttonStyles = files.find((item) => item.file === 'design-system/buttons.css');
check(Boolean(buttonStyles)
  && buttonStyles.text.includes('.btn:hover')
  && buttonStyles.text.includes('.btn:active')
  && buttonStyles.text.includes('.btn:disabled')
  && buttonStyles.text.includes('.btn[aria-disabled="true"]'), 'Botões cobrem hover, active e indisponibilidade');
check(Boolean(buttonStyles)
  && buttonStyles.text.includes('.btn[aria-busy="true"]:not(.is-loading)::before')
  && buttonStyles.text.includes('@keyframes button-spin'), 'Botões ocupados exibem progresso sem spinner duplicado');
check(Boolean(buttonStyles)
  && buttonStyles.text.includes('max-width: 100%')
  && buttonStyles.text.includes('overflow-wrap: anywhere'), 'Rótulos de botões podem quebrar em telas estreitas');
check(allText.includes(':focus-visible'), 'O foco de teclado tem estilo visível');
check(allText.includes('prefers-reduced-motion: reduce'), 'Movimento reduzido tem suporte');

// base.css fixa 16 px no elemento raiz: é a base de todos os rem, por isso é a única exceção.
const fontSizeLiterals = offenders(/font-size:\s*[^;{}]*\b\d*\.?\d+(?:rem|px|em|vw|vh)\b[^;{}]*[;}]/g)
  .filter((item) => ![
    'base.css: font-size: 16px;',
    'design-system/fields.css: font-size: max(16px, var(--text-base));',
    'design-system/custom-selects.css: font-size: max(16px, var(--text-base));',
  ].includes(item));
check(!fontSizeLiterals.length, 'Tamanhos de fonte usam tokens --text-* (com mínimo de 16 px nos campos)', fontSizeLiterals.slice(0, 6).join(' | '));
const fontShorthandLiterals = offenders(/font:\s*[^;{}]*\b\d*\.?\d+(?:rem|px|em)\b[^;{}]*[;}]/g);
check(!fontShorthandLiterals.length, 'Atalhos font usam tokens tipográficos', fontShorthandLiterals.slice(0, 6).join(' | '));

const radiusLiterals = offenders(/border-radius:\s*[^;{}]*\d+(?:\.\d+)?px[^;{}]*[;}]/g);
check(!radiusLiterals.length, 'Raios usam tokens --r-*', radiusLiterals.slice(0, 6).join(' | '));

const heightLiterals = offenders(/min-height:\s*(?:38|40|42|44|46|48|50|52|54)px\s*[;}]/g);
check(!heightLiterals.length, 'Alturas mínimas de controle usam --control-*', heightLiterals.slice(0, 6).join(' | '));

const hexLiterals = offenders(/(?:color|background|border-color|fill|stroke):\s*#(?:fff|ffffff|000|000000)(?![\w])/gi);
check(!hexLiterals.length, 'Cores sólidas em branco/preto usam --on-solid ou tokens de tema (misturas com color-mix são permitidas)', hexLiterals.slice(0, 6).join(' | '));
const directHexColors = offenders(/(?:^|[;{]\s*)(?:--[\w-]+|color|background(?:-color)?|border(?:-color)?|fill|stroke)\s*:[^;{}]*#[\da-f]{3,8}\b/gi);
check(!directHexColors.length, 'Cores CSS usam tokens, sem valores hex literais fora de tokens.css', directHexColors.slice(0, 6).join(' | '));

const importantBaseline = {
  'base.css': 9,
  'components/navigation-responsive.css': 5,
  'components/preferences.css': 1,
  'design-system/buttons.css': 1,
  'pages/account.css': 4,
  'pages/home.css': 2,
  'pages/legal.css': 1,
};
const addedImportant = outsideTokens.flatMap(({ file, text }) => {
  const count = [...strip(text).matchAll(/!important\b/g)].length;
  const baseline = importantBaseline[file] || 0;
  return count > baseline ? [`${file}: ${count} (limite ${baseline})`] : [];
});
check(!addedImportant.length, 'Não foram adicionadas declarações !important',
  addedImportant.join(', ') || 'inventário legado preservado');

const sizeTokens = files.find((item) => item.file === 'design-system/tokens.css')?.text || '';
const undersizedTokens = [...sizeTokens.matchAll(/--text-([\w-]+)\s*:\s*([^;]+);/g)].flatMap(([, name, value]) => {
  if (['loading-spark', 'loading-spark-compact'].includes(name)) return [];
  const match = /^\s*(\d*\.?\d+)(px|rem|em)\b/.exec(value);
  if (!match) return [];
  const pixels = Number(match[1]) * (match[2] === 'px' ? 1 : 16);
  return pixels < 12 ? [`--text-${name}: ${value.trim()}`] : [];
});
check(!undersizedTokens.length, 'Tokens tipográficos funcionais não ficam abaixo de 12 px',
  undersizedTokens.join(', ') || 'mínimo legível mantido');

const spacingBaseline = {
  'base.css': [0, 2],
  'components/accessibility.css': [2, 1],
  'components/controls.css': [1, 0],
  'components/footer.css': [1, 8],
  'components/modals.css': [50, 57],
  'components/navigation-responsive.css': [20, 23],
  'components/navigation.css': [12, 13],
  'components/preferences.css': [25, 13],
  'components/responsive.css': [1, 1],
  'components/task-actions.css': [2, 2],
  'components/task-details.css': [4, 3],
  'components/tasks.css': [20, 7],
  'design-system/buttons.css': [0, 1],
  'design-system/custom-selects.css': [2, 8],
  'design-system/feedback.css': [5, 1],
  'design-system/fields.css': [3, 6],
  'design-system/selectors.css': [6, 10],
  'design-system/touch.css': [2, 9],
  'layout.css': [3, 8],
  'pages/account.css': [35, 33],
  'pages/areas.css': [57, 34],
  'pages/finance-responsive.css': [6, 4],
  'pages/finance.css': [58, 38],
  'pages/habits.css': [59, 39],
  'pages/home.css': [50, 29],
  'pages/landing.css': [3, 3],
  'pages/layouts.css': [24, 25],
  'pages/legal.css': [0, 1],
  'pages/settings.css': [7, 6],
};
const spacingPatterns = [
  /(?<![\w-])(?:gap|row-gap|column-gap)\s*:\s*[^;{}]*\b\d*\.?\d+(?:px|rem)\b[^;{}]*(?=[;}])/g,
  /(?<![\w-])padding(?:-(?:block|inline|top|bottom|left|right|block-start|block-end|inline-start|inline-end))?\s*:\s*[^;{}]*\b\d*\.?\d+(?:px|rem)\b[^;{}]*(?=[;}])/g,
];
for (const [index, label] of ['gap', 'padding'].entries()) {
  const increased = [];
  let total = 0;
  for (const { file, text } of outsideTokens) {
    const count = [...strip(text).matchAll(spacingPatterns[index])].length;
    total += count;
    const limit = spacingBaseline[file]?.[index] ?? 0;
    if (count > limit) increased.push(`${file}: ${count} (limite ${limit})`);
  }
  check(!increased.length, `${label}: sem aumento de literais px/rem por arquivo`,
    `${total} declarações legadas; ${increased.length ? increased.join(' | ') : 'conversão gradual pendente'}`);
}

const scale = new Set([...allText.matchAll(/--text-(2xs|xs|meta|sm|md|base|lg|xl|title|2xl|3xl|4xl)\s*:/g)].map((match) => match[1]));
check(scale.size === 12, 'A escala de tipografia tem os 12 degraus', [...scale].join(', '));
for (const name of [
  '--control-sm', '--control-md', '--control-field', '--control-lg',
  '--r-xs', '--r-sm', '--r-control', '--r-group', '--r', '--r-large', '--r-pill', '--on-solid',
  '--priority-low',
  '--text-4xl', '--text-timer',
  '--card-padding', '--card-padding-compact', '--card-content-gap',
  '--card-compact-min-width', '--card-compact-max-width', '--card-compact-gap',
  '--shadow-sm',
  '--button-gap', '--button-padding-inline', '--button-padding-inline-sm', '--button-padding-inline-lg', '--button-radius',
  '--list-gap', '--list-row-gap', '--list-row-padding-block', '--list-row-padding-inline',
]) {
  check(defined.has(name), `Token ${name} definido`);
}
const buttonRadius = allText.match(/--button-radius\s*:\s*var\((--[\w-]+)\)/);
check(buttonRadius?.[1] === '--r-group', 'Botões usam o raio arredondado --r-group');

const failed = results.filter((item) => !item.passed).length;
document.querySelector('#status').textContent = failed
  ? `${failed} de ${results.length} verificações falharam.`
  : `${results.length}/${results.length} verificações passaram.`;
document.querySelector('#results').innerHTML = results
  .map((item) => `<li>${item.passed ? 'OK' : 'FALHOU'} — ${item.name}${item.detail ? ` (${item.detail})` : ''}</li>`)
  .join('');
