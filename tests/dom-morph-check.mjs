import assert from 'node:assert/strict';
import { morphChildNodes, morphNode } from '../src/js/utils/dom-morph.js';

class MockNode {
  constructor(nodeType, nodeValue = null) {
    this.nodeType = nodeType;
    this.nodeValue = nodeValue;
    this.parentNode = null;
    this.childNodes = [];
  }
  get firstChild() {
    return this.childNodes[0] || null;
  }
  get nextSibling() {
    if (!this.parentNode) return null;
    const i = this.parentNode.childNodes.indexOf(this);
    return i >= 0 ? this.parentNode.childNodes[i + 1] || null : null;
  }
  appendChild(child) {
    return this.insertBefore(child, null);
  }
  insertBefore(child, ref) {
    if (child.parentNode) child.parentNode.removeChild(child);
    child.parentNode = this;
    const idx = ref ? this.childNodes.indexOf(ref) : -1;
    if (idx >= 0) this.childNodes.splice(idx, 0, child);
    else this.childNodes.push(child);
    return child;
  }
  removeChild(child) {
    const idx = this.childNodes.indexOf(child);
    if (idx >= 0) {
      this.childNodes.splice(idx, 1);
      child.parentNode = null;
    }
    return child;
  }
  replaceWith(next) {
    if (!this.parentNode) return;
    const parent = this.parentNode;
    parent.insertBefore(next, this);
    parent.removeChild(this);
  }
  cloneNode(deep = false) {
    const copy = new MockNode(this.nodeType, this.nodeValue);
    if (deep) this.childNodes.forEach((child) => copy.appendChild(child.cloneNode(true)));
    return copy;
  }
}

class MockElement extends MockNode {
  constructor(tag, attrs = {}, children = []) {
    super(1, null);
    this.tagName = tag.toUpperCase();
    this.namespaceURI = 'http://www.w3.org/1999/xhtml';
    this._attrs = new Map(Object.entries(attrs).map(([k, v]) => [k, String(v)]));
    this.value = attrs.value ?? '';
    this.checked = Object.hasOwn(attrs, 'checked');
    this.selected = Object.hasOwn(attrs, 'selected');
    this.disabled = Object.hasOwn(attrs, 'disabled');
    this.open = Object.hasOwn(attrs, 'open');
    children.forEach((child) => this.appendChild(typeof child === 'string' ? new MockNode(3, child) : child));
  }
  get type() {
    return this._attrs.get('type') || 'text';
  }
  get textContent() {
    return this.childNodes.map((c) => (c.nodeType === 3 ? c.nodeValue : c.textContent)).join('');
  }
  get attributes() {
    return [...this._attrs.entries()].map(([name, value]) => ({ name, value }));
  }
  getAttribute(name) {
    return this._attrs.has(name) ? this._attrs.get(name) : null;
  }
  hasAttribute(name) {
    return this._attrs.has(name);
  }
  setAttribute(name, value) {
    this._attrs.set(name, String(value));
  }
  removeAttribute(name) {
    this._attrs.delete(name);
  }
  querySelector() {
    return null;
  }
  cloneNode(deep = false) {
    const copy = new MockElement(this.tagName, Object.fromEntries(this._attrs.entries()));
    if (deep) this.childNodes.forEach((child) => copy.appendChild(child.cloneNode(true)));
    return copy;
  }
}

const el = (tag, attrs, children) => new MockElement(tag, attrs, children);

// 1. Keyed nodes preserve DOM identity across reorder, insert, and remove.
const a = el('li', { 'data-k': 't1', class: 'task' }, ['Primeira']);
const b = el('li', { 'data-k': 't2', class: 'task' }, ['Segunda']);
const c = el('li', { 'data-k': 't3', class: 'task' }, ['Terceira']);
const fromList = el('ul', {}, [a, b, c]);
const toList = el('ul', {}, [
  el('li', { 'data-k': 't3', class: 'task done' }, ['Terceira concluída']),
  el('li', { 'data-k': 't4', class: 'task' }, ['Quarta']),
  el('li', { 'data-k': 't1', class: 'task' }, ['Primeira']),
]);
morphChildNodes(fromList, toList);
assert.equal(fromList.childNodes.length, 3);
assert.strictEqual(fromList.childNodes[0], c, 'nó t3 deve ser preservado ao reordenar');
assert.equal(c.getAttribute('class'), 'task done');
assert.equal(c.textContent, 'Terceira concluída');
assert.equal(fromList.childNodes[1].getAttribute('data-k'), 't4');
assert.strictEqual(fromList.childNodes[2], a, 'nó t1 deve ser preservado');
assert.equal(b.parentNode, null, 'nó t2 removido deve sair do DOM');

// 2. Form properties sync accurately while honoring data-keep.
const input = el('input', { type: 'text', value: 'antes' });
input.value = 'editado';
morphNode(input, el('input', { type: 'text', value: '' }));
assert.equal(input.value, '', 'input sem data-keep deve refletir limpeza do template');

const kept = el('input', { type: 'text', 'data-keep': '1', value: '' });
kept.value = 'digitando agora';
morphNode(kept, el('input', { type: 'text', 'data-keep': '1', value: '' }));
assert.equal(kept.value, 'digitando agora', 'input com data-keep preserva valor vivo');

const check = el('input', { type: 'checkbox' });
check.checked = true;
morphNode(check, el('input', { type: 'checkbox' }));
assert.equal(check.checked, false, 'checkbox sincroniza propriedade checked');

const details = el('details', {});
details.open = true;
morphNode(details, el('details', { open: '' }));
assert.equal(details.open, true);
morphNode(details, el('details', {}));
assert.equal(details.open, false);

// 3. Mixed keyed + unkeyed children keep exact ordering.
const keep = el('div', { id: 'keep' }, ['Mantido']);
const mixedFrom = el('section', {}, [keep, el('p', {}, ['Antigo'])]);
const mixedTo = el('section', {}, [el('span', {}, ['Novo']), el('div', { id: 'keep' }, ['Atualizado'])]);
morphChildNodes(mixedFrom, mixedTo);
assert.equal(mixedFrom.childNodes.length, 2);
assert.equal(mixedFrom.childNodes[0].tagName, 'SPAN');
assert.strictEqual(mixedFrom.childNodes[1], keep);
assert.equal(keep.textContent, 'Atualizado');

console.log('dom-morph-check: ok');
