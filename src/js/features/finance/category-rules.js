const MAX_RULES = 50;
const MAX_PHRASE_LENGTH = 80;
const normalizeText = (value) => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('pt-BR')
  .trim();

export function normalizeCategoryRules(value) {
  if (!Array.isArray(value)) return [];
  const ids = new Set();
  return value.flatMap((rule) => {
    if (!rule || typeof rule !== 'object' || Array.isArray(rule)) return [];
    const id = typeof rule.id === 'string' ? rule.id.trim() : '';
    const phrase = typeof rule.phrase === 'string' ? rule.phrase.trim().slice(0, MAX_PHRASE_LENGTH) : '';
    const category = typeof rule.category === 'string' ? rule.category.trim().slice(0, 100) : '';
    const kind = rule.kind;
    if (!id || id.length > 64 || ids.has(id) || !normalizeText(phrase)
      || !category || !['in', 'out'].includes(kind)) return [];
    ids.add(id);
    return [{ id, phrase, category, kind }];
  }).slice(0, MAX_RULES);
}

export function matchCategoryRule(description, kind, rules) {
  const text = normalizeText(description);
  if (!text || !['in', 'out'].includes(kind)) return null;
  const normalizedRules = normalizeCategoryRules(rules);
  return normalizedRules.find((rule) => rule.kind === kind && text.includes(normalizeText(rule.phrase))) || null;
}
