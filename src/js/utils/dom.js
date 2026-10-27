export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[character]));

class Raw {
  constructor(s) {
    this.s = s;
  }
}

export const raw = (value) => new Raw(value);

const serialize = (value) => value instanceof Raw
  ? value.s
  : Array.isArray(value)
    ? value.map(serialize).join('')
    : value === false || value == null
      ? ''
      : esc(value);

export const h = (strings, ...values) => raw(strings.reduce(
  (result, part, index) => result + part + (index < values.length ? serialize(values[index]) : ''),
  '',
));
