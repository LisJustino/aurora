/* Atualização incremental do DOM: preserva nós persistentes (topo, navegação,
   listas com chave, inputs em foco e transições CSS) em vez de recriar toda a árvore. */

const KEY_ATTRS = ['id', 'data-k', 'data-habit-id', 'data-route', 'data-key'];
const FORM_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT', 'OPTION', 'DETAILS']);
const FORM_DESCENDANT_SELECTOR = 'input, textarea, select, option, details';

function nodeKey(node) {
  if (!node || node.nodeType !== 1) return null;
  for (const attr of KEY_ATTRS) {
    const value = node.getAttribute(attr);
    if (value) return `${node.tagName}:${attr}:${value}`;
  }
  return null;
}

function sameNodeShape(a, b) {
  if (!a || !b || a.nodeType !== b.nodeType) return false;
  if (a.nodeType !== 1) return true;
  if (a.tagName !== b.tagName || a.namespaceURI !== b.namespaceURI) return false;
  if (a.tagName === 'INPUT' && a.getAttribute('type') !== b.getAttribute('type')) return false;
  return true;
}

function canFastSkip(fromEl, toEl, activeElement) {
  if (FORM_TAGS.has(fromEl.tagName)) return false;
  if (activeElement && (fromEl === activeElement || fromEl.contains?.(activeElement))) return false;
  if (fromEl.querySelector?.(FORM_DESCENDANT_SELECTOR)) return false;
  if (typeof fromEl.isEqualNode === 'function' && fromEl.isEqualNode(toEl)) return true;
  return false;
}

function syncAttributes(fromEl, toEl) {
  const toAttrs = toEl.attributes;
  const fromAttrs = fromEl.attributes;
  for (let i = fromAttrs.length - 1; i >= 0; i--) {
    const name = fromAttrs[i].name;
    if (!toEl.hasAttribute(name)) fromEl.removeAttribute(name);
  }
  for (let i = 0; i < toAttrs.length; i++) {
    const { name, value } = toAttrs[i];
    if (fromEl.getAttribute(name) !== value) fromEl.setAttribute(name, value);
  }
}

function syncSpecialProps(fromEl, toEl) {
  const tag = fromEl.tagName;
  if (tag === 'INPUT') {
    if (fromEl.hasAttribute('data-keep')) return;
    const isCheckable = fromEl.type === 'checkbox' || fromEl.type === 'radio';
    if (isCheckable) {
      const nextChecked = toEl.hasAttribute('checked');
      if (fromEl.checked !== nextChecked) fromEl.checked = nextChecked;
    } else if (fromEl.type !== 'file') {
      const nextValue = toEl.getAttribute('value') ?? '';
      if (fromEl.value !== nextValue) fromEl.value = nextValue;
    }
    const nextDisabled = toEl.hasAttribute('disabled');
    if (fromEl.disabled !== nextDisabled) fromEl.disabled = nextDisabled;
    return;
  }
  if (tag === 'TEXTAREA') {
    if (fromEl.hasAttribute('data-keep')) return;
    const nextValue = toEl.textContent ?? '';
    if (fromEl.value !== nextValue) fromEl.value = nextValue;
    return;
  }
  if (tag === 'OPTION') {
    const nextSelected = toEl.hasAttribute('selected');
    if (fromEl.selected !== nextSelected) fromEl.selected = nextSelected;
    return;
  }
  if (tag === 'SELECT') {
    if (fromEl.hasAttribute('data-keep')) return;
    const selectedOpt = toEl.querySelector?.('option[selected]');
    const nextValue = selectedOpt ? selectedOpt.value : (toEl.options?.[0]?.value ?? '');
    if (fromEl.value !== nextValue) fromEl.value = nextValue;
    return;
  }
  if (tag === 'DETAILS') {
    const nextOpen = toEl.hasAttribute('open');
    if (fromEl.open !== nextOpen) fromEl.open = nextOpen;
  }
}

export function morphNode(fromNode, toNode, activeElement = null) {
  if (fromNode === toNode) return fromNode;
  if (!sameNodeShape(fromNode, toNode)) {
    const replacement = toNode.cloneNode(true);
    fromNode.replaceWith(replacement);
    return replacement;
  }
  if (fromNode.nodeType === 3 || fromNode.nodeType === 8) {
    if (fromNode.nodeValue !== toNode.nodeValue) fromNode.nodeValue = toNode.nodeValue;
    return fromNode;
  }
  if (fromNode.nodeType !== 1) return fromNode;

  if (canFastSkip(fromNode, toNode, activeElement)) return fromNode;

  syncAttributes(fromNode, toNode);
  if (fromNode.tagName === 'TEXTAREA') {
    syncSpecialProps(fromNode, toNode);
    return fromNode;
  }

  morphChildNodes(fromNode, toNode, activeElement);
  syncSpecialProps(fromNode, toNode);
  return fromNode;
}

export function morphChildNodes(fromParent, toParent, activeElement = null) {
  const keyed = new Map();
  for (let child = fromParent.firstChild; child; child = child.nextSibling) {
    const key = nodeKey(child);
    if (key && !keyed.has(key)) keyed.set(key, child);
  }

  const toChildren = [...toParent.childNodes];
  let cursor = fromParent.firstChild;

  for (let i = 0; i < toChildren.length; i++) {
    const toChild = toChildren[i];
    const key = nodeKey(toChild);
    const matched = key ? keyed.get(key) || null : null;

    if (matched) {
      keyed.delete(key);
      if (matched !== cursor) {
        fromParent.insertBefore(matched, cursor);
      } else {
        cursor = cursor.nextSibling;
      }
      morphNode(matched, toChild, activeElement);
      continue;
    }

    // Evita reaproveitar um nó com chave explícita que pertence a outro item futuro.
    while (cursor && nodeKey(cursor)) {
      const next = cursor.nextSibling;
      cursor = next;
    }

    if (!key && cursor && sameNodeShape(cursor, toChild)) {
      const next = cursor.nextSibling;
      morphNode(cursor, toChild, activeElement);
      cursor = next;
    } else {
      const inserted = toChild.cloneNode(true);
      fromParent.insertBefore(inserted, cursor);
    }
  }

  while (cursor) {
    const next = cursor.nextSibling;
    fromParent.removeChild(cursor);
    cursor = next;
  }

  // Remove quaisquer nós com chave que sobraram após o cursor ou ficaram fora da lista final.
  for (const leftover of keyed.values()) {
    if (leftover.parentNode === fromParent) fromParent.removeChild(leftover);
  }
}

export function morphHtml(container, html, { forceReplace = false } = {}) {
  if (!container) return;
  if (forceReplace || !container.firstChild || typeof document === 'undefined') {
    container.innerHTML = html;
    return;
  }
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  const activeElement = document.activeElement || null;
  morphChildNodes(container, tpl.content, activeElement);
}
