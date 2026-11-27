export const SIMPLE_LIST_LIMITS = Object.freeze({
  lists: 60,
  name: 30,
  item: 120,
  itemsPerBatch: 30,
});

export function normalizeSimpleListName(value) {
  if (typeof value !== 'string') return '';
  const name = value.trim().normalize('NFC');
  return name.length > SIMPLE_LIST_LIMITS.name ? '' : name;
}

export function simpleListNameKey(value) {
  return normalizeSimpleListName(value).normalize('NFKC').toLocaleLowerCase('pt-BR');
}

export function parseSimpleListItems(value) {
  if (typeof value !== 'string') return { items: [], error: 'Escreva pelo menos um item.' };
  const items = value
    .split(/\r?\n/)
    .map((item) =>
      item
        .trim()
        .replace(/^(?:[-*•]\s+|\d+[.)]\s+)/, '')
        .trim(),
    )
    .filter(Boolean);
  if (!items.length) return { items: [], error: 'Escreva pelo menos um item.' };
  if (items.length > SIMPLE_LIST_LIMITS.itemsPerBatch) {
    return { items: [], error: `Adicione até ${SIMPLE_LIST_LIMITS.itemsPerBatch} itens por vez.` };
  }
  if (items.some((item) => item.length > SIMPLE_LIST_LIMITS.item)) {
    return { items: [], error: `Cada item pode ter até ${SIMPLE_LIST_LIMITS.item} caracteres.` };
  }
  return { items, error: '' };
}
