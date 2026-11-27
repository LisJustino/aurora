import { h } from '../utils/dom.js';
import { isPlainObject } from '../core/data-integrity.js';
import { PROFILE_SEX } from '../features/profile/model.js';
import { defaultHomeLayout as defaultHomeLayoutModel } from '../features/home/personalization.js';
import { hexOk } from '../features/appearance/palettes.js';

// Núcleo: templates, datas, estado e persistência
export const isTime = (v) => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
export const orderOf = (t) => (t.order != null ? t.order : t.createdAt || 0);
export function parseTags(raw_) {
  const tags = [];
  const title = String(raw_)
    .replace(/(^|\s)#([\p{L}\d_-]{1,24})/gu, (m, sp, tg) => {
      const k = tg.toLowerCase();
      if (!tags.includes(k)) tags.push(k);
      return sp;
    })
    .replace(/\s{2,}/g, ' ')
    .trim();
  return { title: title || String(raw_).trim(), tags };
}
export const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
export const norm = (s) => String(s).toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[̀-ͯ]/g, '');
export const plural = (n, a, b) => (n === 1 ? a : b);

export const LIST_COLORS = [
  '#c97994',
  '#e07a5f',
  '#d9a05b',
  '#a3b55a',
  '#5fa68a',
  '#5aa5b8',
  '#7c8fd4',
  '#8a7ac4',
  '#a24f9e',
  '#d6455d',
  '#8b8b95',
  '#ad8c76',
];
export const CAT_ICONS = [
  'utensils',
  'home',
  'car',
  'heart',
  'book',
  'sparkles',
  'bag',
  'repeat',
  'user',
  'tag',
  'wallet',
  'plus',
  'trendUp',
  'calendar',
  'card',
  'bank',
];
export const CATEGORY_ICON_LABELS = {
  utensils: 'Alimentação',
  home: 'Casa',
  car: 'Transporte',
  heart: 'Saúde',
  book: 'Educação',
  sparkles: 'Brilho',
  bag: 'Compras',
  repeat: 'Recorrência',
  user: 'Pessoa',
  tag: 'Etiqueta',
  wallet: 'Carteira',
  plus: 'Mais',
  trendUp: 'Rendimentos',
  calendar: 'Calendário',
  card: 'Cartão',
  bank: 'Banco',
};
export const DEF_LISTS = [
  { name: 'Pessoal', color: '#c97994' },
  { name: 'Compras', color: '#72a578' },
];
const DEF_CATS = {
  out: [
    ['Alimentação', '#c97994', 'utensils'],
    ['Moradia', '#7c8fd4', 'home'],
    ['Transporte', '#5fa68a', 'car'],
    ['Saúde', '#d9a05b', 'heart'],
    ['Educação', '#8a7ac4', 'book'],
    ['Lazer', '#d27a6a', 'sparkles'],
    ['Compras', '#5aa5b8', 'bag'],
    ['Assinaturas', '#a3b55a', 'repeat'],
    ['Cuidados pessoais', '#b78a6e', 'user'],
    ['Outros', '#8b8b95', 'tag'],
  ],
  in: [
    ['Salário', '#3d9a6b', 'wallet'],
    ['Renda extra', '#5fb08a', 'plus'],
    ['Rendimentos', '#7bb89c', 'trendUp'],
    ['Presente', '#8fc7a8', 'sparkles'],
    ['Reembolso', '#4f9a74', 'repeat'],
    ['Outros', '#8b8b95', 'tag'],
  ],
};
const DEFAULT_CATEGORY_SUBCATEGORIES = {
  out: new Map(
    [
      [
        'Alimentação',
        [
          ['Mercado', 'bag', '#5aa5b8'],
          ['Feira', 'sparkles', '#5fa68a'],
          ['Restaurante', 'utensils', '#d9a05b'],
          ['Delivery', 'car', '#d27a6a'],
        ],
      ],
      [
        'Moradia',
        [
          ['Aluguel', 'home', '#7c8fd4'],
          ['Contas da casa', 'bank', '#5aa5b8'],
          ['Condomínio', 'card', '#a24f9e'],
          ['Manutenção', 'repeat', '#5fa68a'],
        ],
      ],
      [
        'Transporte',
        [
          ['Combustível', 'car', '#d9a05b'],
          ['Estacionamento', 'card', '#7c8fd4'],
          ['Transporte público', 'calendar', '#5aa5b8'],
          ['Manutenção', 'repeat', '#5fa68a'],
        ],
      ],
      [
        'Saúde',
        [
          ['Consultas', 'heart', '#d27a6a'],
          ['Exames', 'calendar', '#7c8fd4'],
          ['Medicamentos', 'plus', '#5fa68a'],
          ['Plano de saúde', 'card', '#5aa5b8'],
        ],
      ],
      [
        'Educação',
        [
          ['Mensalidade', 'book', '#8a7ac4'],
          ['Cursos', 'calendar', '#5aa5b8'],
          ['Material escolar', 'bag', '#d9a05b'],
        ],
      ],
      [
        'Lazer',
        [
          ['Viagens', 'calendar', '#5aa5b8'],
          ['Passeios', 'sparkles', '#a3b55a'],
          ['Eventos', 'sparkles', '#d27a6a'],
        ],
      ],
      [
        'Compras',
        [
          ['Roupas', 'bag', '#d27a6a'],
          ['Eletrônicos', 'card', '#7c8fd4'],
          ['Casa', 'home', '#5fa68a'],
        ],
      ],
      [
        'Assinaturas',
        [
          ['Streaming', 'sparkles', '#a24f9e'],
          ['Aplicativos', 'plus', '#5aa5b8'],
          ['Serviços', 'repeat', '#d9a05b'],
        ],
      ],
      [
        'Cuidados pessoais',
        [
          ['Higiene', 'user', '#5aa5b8'],
          ['Beleza', 'sparkles', '#d27a6a'],
          ['Academia', 'heart', '#5fa68a'],
        ],
      ],
    ].map(([name, subcategories]) => [
      norm(name),
      subcategories.map(([subcategory, icon, color]) => ({ name: subcategory, icon, color })),
    ]),
  ),
  in: new Map(
    [
      [
        'Salário',
        [
          ['Salário mensal', 'wallet', '#3d9a6b'],
          ['13º salário', 'calendar', '#7bb89c'],
          ['Férias', 'sparkles', '#5aa5b8'],
        ],
      ],
      [
        'Renda extra',
        [
          ['Freelance', 'user', '#5fb08a'],
          ['Vendas', 'bag', '#d9a05b'],
          ['Serviços', 'bank', '#7c8fd4'],
        ],
      ],
      [
        'Rendimentos',
        [
          ['Juros', 'trendUp', '#5fa68a'],
          ['Dividendos', 'wallet', '#7c8fd4'],
        ],
      ],
      [
        'Presente',
        [
          ['Aniversário', 'sparkles', '#d27a6a'],
          ['Datas comemorativas', 'calendar', '#a24f9e'],
        ],
      ],
      [
        'Reembolso',
        [
          ['Despesas reembolsadas', 'repeat', '#5aa5b8'],
          ['Devoluções', 'wallet', '#5fa68a'],
        ],
      ],
    ].map(([name, subcategories]) => [
      norm(name),
      subcategories.map(([subcategory, icon, color]) => ({ name: subcategory, icon, color })),
    ]),
  ),
};
const DEFAULT_CATEGORY_STYLES = Object.fromEntries(
  Object.entries(DEF_CATS).map(([kind, categories]) => [
    kind,
    new Map(categories.map(([name, color, iconName]) => [norm(name), { color, icon: iconName }])),
  ]),
);
export const defCats = () =>
  Object.fromEntries(
    Object.entries(DEF_CATS).map(([kind, categories]) => [
      kind,
      categories.map(([name, color, icon]) => ({
        name,
        color,
        icon,
        subcategories: (DEFAULT_CATEGORY_SUBCATEGORIES[kind]?.get(norm(name)) || []).map((subcategory) => ({
          ...subcategory,
          subcategories: [],
        })),
      })),
    ]),
  );
export const categoryLeafName = (category) => {
  if (typeof category === 'string') return category.trim();
  if (isPlainObject(category) && typeof category.name === 'string') return category.name.trim();
  return '';
};
export const categoryPathParts = (value) => {
  const text = String(value ?? '').trim();
  const parts = text
    .split(/\s*>\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (!parts.length) return { parent: '', child: '' };
  if (parts.length === 1) return { parent: '', child: parts[0] };
  return { parent: parts[0], child: parts.slice(1).join(' > ') };
};
export const normalizeCategoryEntry = (
  category,
  kind,
  inherited = {},
  includeDefaults = true,
  upgradeInheritedStyles = false,
) => {
  const source = typeof category === 'string' ? { name: category } : category;
  if (!isPlainObject(source) || typeof source.name !== 'string') return null;
  const name = source.name.trim();
  if (!name) return null;
  const defaults = DEFAULT_CATEGORY_STYLES[kind]?.get(norm(name));
  const color = hexOk(source.color) ? source.color : inherited.color || defaults?.color || '#8b8b95';
  const iconName = CAT_ICONS.includes(source.icon) ? source.icon : defaults?.icon || inherited.icon || 'tag';
  const defaultSubcategories = includeDefaults ? DEFAULT_CATEGORY_SUBCATEGORIES[kind]?.get(norm(name)) || [] : [];
  const savedSubcategories = (Array.isArray(source.subcategories) ? source.subcategories : [])
    .map((item) => normalizeCategoryEntry(item, kind, { color, icon: iconName }, false))
    .filter(Boolean)
    .map((subcategory) => {
      const preset = defaultSubcategories.find((item) => norm(item.name) === norm(subcategory.name));
      if (!upgradeInheritedStyles || !preset || subcategory.color !== color || subcategory.icon !== iconName)
        return subcategory;
      return {
        ...subcategory,
        color: preset.color,
        icon: preset.icon,
      };
    });
  const candidates = [...savedSubcategories, ...defaultSubcategories];
  const seenSubcategories = new Set();
  const subcategories = candidates
    .map((item) => normalizeCategoryEntry(item, kind, { color, icon: iconName }, false))
    .filter((subcategory) => {
      if (!subcategory || seenSubcategories.has(norm(subcategory.name))) return false;
      seenSubcategories.add(norm(subcategory.name));
      return true;
    });
  return {
    name: name.slice(0, 30),
    color,
    icon: iconName,
    subcategories: subcategories.slice(0, 20),
  };
};
export const OTHER_BANK = 'other';
export const BANKS = {
  nubank: { name: 'Nubank', logo: new URL('../../assets/bank-logos/18236120.svg', import.meta.url).href },
  itau: { name: 'Itaú', logo: new URL('../../assets/bank-logos/60701190.svg', import.meta.url).href },
  bradesco: { name: 'Bradesco', logo: new URL('../../assets/bank-logos/60746948.svg', import.meta.url).href },
  banco_do_brasil: {
    name: 'Banco do Brasil',
    logo: new URL('../../assets/bank-logos/00000000.svg', import.meta.url).href,
  },
  santander: { name: 'Santander', logo: new URL('../../assets/bank-logos/90400888.svg', import.meta.url).href },
  caixa: { name: 'Caixa', logo: new URL('../../assets/bank-logos/00360305.svg', import.meta.url).href },
  inter: { name: 'Inter', logo: new URL('../../assets/bank-logos/00416968.svg', import.meta.url).href },
  c6: { name: 'C6 Bank', logo: new URL('../../assets/bank-logos/31872495.svg', import.meta.url).href },
  picpay: { name: 'PicPay', logo: new URL('../../assets/bank-logos/22896431.svg', import.meta.url).href },
  mercado_pago: { name: 'Mercado Pago', logo: new URL('../../assets/bank-logos/10573521.svg', import.meta.url).href },
  sicredi: { name: 'Sicredi', logo: new URL('../../assets/bank-logos/01181521.svg', import.meta.url).href },
  sicoob: { name: 'Sicoob', logo: new URL('../../assets/bank-logos/02038232.svg', import.meta.url).href },
};
export const findBankByName = (value, allowPrefix = false) => {
  const query = norm(String(value || '').trim());
  if (!query) return null;
  const entries = Object.entries(BANKS);
  return (
    entries.find(([key, bank]) => norm(key) === query || norm(bank.name) === query) ||
    (allowPrefix ? entries.find(([, bank]) => norm(bank.name).startsWith(query)) : null) ||
    null
  );
};
export const bankFieldValue = (value) =>
  value === OTHER_BANK ? 'Outro / não listado' : Object.hasOwn(BANKS, value) ? BANKS[value].name : value || '';
export const AREAS = {
  finances: ['Finanças', 'Contas, entradas e saídas'],
  cycle: ['Ciclo', 'Registro e estimativas'],
  habits: ['Hábitos', 'Rotinas e histórico semanal'],
};
export const SEX = PROFILE_SEX;
const CASE_TERMS = new Set([
  'Android',
  'CSV',
  'Google',
  'HTTPS',
  'iPhone',
  'JSON',
  'MB',
  'mL',
  'OFX',
  'Push',
  'URL',
  'VAPID',
]);
export const preserveCopyTerms = (text) =>
  h`${String(text)
    .split(/\b(Android|CSV|Google|HTTPS|iPhone|JSON|MB|mL|OFX|Push|URL|VAPID)\b/g)
    .map((part) => {
      return CASE_TERMS.has(part) ? h`<span class="case-preserve">${part}</span>` : part;
    })}`;
export const PRIO = { low: 'Baixa', normal: 'Normal', high: 'Alta' };
export const defaultHomeLayout = defaultHomeLayoutModel;
export function saveActiveHomeMode(settings) {
  const { homeMode, homeLayout, homeShortcuts } = settings.prefs;
  settings.prefs.homeModes[homeMode] = {
    layout: { order: [...homeLayout.order], visible: [...homeLayout.visible] },
    shortcuts: [...homeShortcuts],
  };
}
