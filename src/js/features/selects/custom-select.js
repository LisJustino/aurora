const controlsBySelect = new WeakMap();
const documentObservers = new WeakMap();
const controls = new Set();
let activeControl = null;
let nextId = 0;

const normalizeText = (value) => String(value || '').trim().replace(/\s+/g, ' ');
const normalizedSearch = (value) => normalizeText(value)
  .toLocaleLowerCase('pt-BR')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '');

function uniqueId(document, prefix) {
  let id;
  do {
    id = `${prefix}-${++nextId}`;
  } while (document.getElementById(id));
  return id;
}

function labelText(label) {
  if (label.hasAttribute('aria-label')) return normalizeText(label.getAttribute('aria-label'));
  const copy = label.cloneNode(true);
  copy.querySelectorAll('select, button, input, textarea, a, [contenteditable="true"], [aria-hidden="true"], .field-err, .account-field-error')
    .forEach((element) => element.remove());
  return normalizeText(copy.textContent);
}

function disabledOption(option) {
  return !option || option.disabled
    || (option.parentElement?.tagName === 'OPTGROUP' && option.parentElement.disabled);
}

function enabledOptionFrom(control, start, direction) {
  for (let index = start; index >= 0 && index < control.select.options.length; index += direction) {
    if (!disabledOption(control.select.options[index])) return index;
  }
  return -1;
}

function optionElement(control, index) {
  return control.menu?.querySelector(`[data-select-option-index="${index}"]`) || null;
}

function setActiveOption(control, index, scroll = true) {
  control.activeIndex = index;
  control.menu?.querySelectorAll('[data-select-option-index]').forEach((option) => {
    option.removeAttribute('data-active');
  });
  const option = index >= 0 ? optionElement(control, index) : null;
  if (option) {
    option.setAttribute('data-active', 'true');
    control.trigger.setAttribute('aria-activedescendant', option.id);
    if (scroll) option.scrollIntoView({ block: 'nearest' });
  } else {
    control.trigger.removeAttribute('aria-activedescendant');
  }
}

function createOption(control, option, index) {
  const element = control.document.createElement('div');
  element.className = 'ds-select__option';
  element.id = `${control.menuId}-option-${index}`;
  element.dataset.selectOptionIndex = String(index);
  element.setAttribute('role', 'option');
  element.setAttribute('aria-selected', String(index === control.select.selectedIndex));
  element.setAttribute('aria-disabled', String(disabledOption(option)));
  element.setAttribute('aria-posinset', String(index + 1));
  element.setAttribute('aria-setsize', String(control.select.options.length));
  element.textContent = normalizeText(option.label);
  return element;
}

function buildMenu(control) {
  const menu = control.document.createElement('div');
  menu.className = 'ds-select__menu';
  menu.id = control.menuId;
  menu.setAttribute('role', 'listbox');
  if (control.trigger.hasAttribute('aria-label')) {
    menu.setAttribute('aria-label', control.trigger.getAttribute('aria-label'));
  } else if (control.trigger.hasAttribute('aria-labelledby')) {
    menu.setAttribute('aria-labelledby', control.trigger.getAttribute('aria-labelledby'));
  }

  let previousGroup = null;
  let currentGroup = null;
  for (const [index, option] of Array.from(control.select.options).entries()) {
    const parent = option.parentElement?.tagName === 'OPTGROUP' ? option.parentElement : null;
    if (parent !== previousGroup) {
      currentGroup = null;
      if (parent) {
        currentGroup = control.document.createElement('div');
        currentGroup.className = 'ds-select__group';
        currentGroup.setAttribute('role', 'group');
        currentGroup.setAttribute('aria-label', normalizeText(parent.label));
        const label = control.document.createElement('span');
        label.className = 'ds-select__group-label';
        label.setAttribute('aria-hidden', 'true');
        label.textContent = normalizeText(parent.label);
        currentGroup.append(label);
        menu.append(currentGroup);
      }
      previousGroup = parent;
    }

    const row = createOption(control, option, index);
    (currentGroup || menu).append(row);
  }

  menu.addEventListener('pointerdown', (event) => {
    if (event.target instanceof Element && event.target.closest('[data-select-option-index]')) {
      event.preventDefault();
    }
  });
  menu.addEventListener('pointermove', (event) => {
    const option = event.target instanceof Element
      ? event.target.closest('[data-select-option-index]')
      : null;
    if (!option) return;
    const index = Number(option.dataset.selectOptionIndex);
    if (!disabledOption(control.select.options[index])) setActiveOption(control, index, false);
  });
  menu.addEventListener('click', (event) => {
    const option = event.target instanceof Element
      ? event.target.closest('[data-select-option-index]')
      : null;
    if (!option) return;
    const index = Number(option.dataset.selectOptionIndex);
    if (!disabledOption(control.select.options[index])) chooseOption(control, index);
  });
  return menu;
}

function positionMenu(control) {
  if (!control.menu || !control.select.isConnected) return;
  const rect = control.trigger.getBoundingClientRect();
  const viewport = window.visualViewport;
  const viewportTop = viewport?.offsetTop || 0;
  const viewportHeight = viewport?.height || window.innerHeight;
  const viewportWidth = viewport?.width || window.innerWidth;
  const margin = 12;
  const gap = 6;
  const availableBelow = Math.max(0, viewportTop + viewportHeight - rect.bottom - gap - margin);
  const availableAbove = Math.max(0, rect.top - viewportTop - gap - margin);
  const maxMenuHeight = Number.parseFloat(
    window.getComputedStyle(control.document.documentElement).getPropertyValue('--select-menu-max-height'),
  ) || 288;
  const desiredHeight = Math.min(maxMenuHeight, control.menu.scrollHeight);
  const openBelow = availableBelow >= Math.min(desiredHeight, 160) || availableBelow >= availableAbove;
  const availableHeight = openBelow ? availableBelow : availableAbove;
  const maxHeight = Math.max(0, Math.min(maxMenuHeight, availableHeight));
  const width = Math.min(rect.width, viewportWidth - margin * 2);
  const left = Math.max(margin, Math.min(rect.left, viewportWidth - margin - width));
  const height = Math.min(control.menu.scrollHeight, maxHeight);
  const top = openBelow ? rect.bottom + gap : rect.top - gap - height;

  control.menu.style.left = `${left}px`;
  control.menu.style.top = `${Math.max(viewportTop + margin, top)}px`;
  control.menu.style.width = `${width}px`;
  control.menu.style.maxHeight = `${maxHeight}px`;
}

function closeMenu(control = activeControl) {
  if (!control) return;
  control.menu?.remove();
  control.menu = null;
  control.activeIndex = -1;
  control.trigger.setAttribute('aria-expanded', 'false');
  control.trigger.removeAttribute('aria-controls');
  control.trigger.removeAttribute('aria-activedescendant');
  if (activeControl === control) {
    activeControl = null;
    window.removeEventListener('resize', repositionActiveMenu);
    window.removeEventListener('scroll', repositionActiveMenu, true);
    window.visualViewport?.removeEventListener('resize', repositionActiveMenu);
    window.visualViewport?.removeEventListener('scroll', repositionActiveMenu);
  }
}

function repositionActiveMenu() {
  if (!activeControl) return;
  const rect = activeControl.trigger.getBoundingClientRect();
  if (rect.bottom < 0 || rect.top > window.innerHeight) {
    closeMenu(activeControl);
    return;
  }
  positionMenu(activeControl);
}

function openMenu(control, initial = 'selected') {
  if (control.select.matches(':disabled') || !control.select.options.length) return;
  if (activeControl && activeControl !== control) closeMenu(activeControl);
  if (activeControl === control) return;

  activeControl = control;
  control.menu = buildMenu(control);
  control.trigger.setAttribute('aria-expanded', 'true');
  control.trigger.setAttribute('aria-controls', control.menuId);
  control.document.body.append(control.menu);

  let index = -1;
  if (initial === 'first') index = enabledOptionFrom(control, 0, 1);
  else if (initial === 'last') index = enabledOptionFrom(control, control.select.options.length - 1, -1);
  else if (!disabledOption(control.select.options[control.select.selectedIndex])) index = control.select.selectedIndex;
  else index = enabledOptionFrom(control, 0, 1);
  setActiveOption(control, index);
  positionMenu(control);

  window.addEventListener('resize', repositionActiveMenu);
  window.addEventListener('scroll', repositionActiveMenu, true);
  window.visualViewport?.addEventListener('resize', repositionActiveMenu);
  window.visualViewport?.addEventListener('scroll', repositionActiveMenu);
}

function syncControl(control) {
  const { select, trigger } = control;
  if (activeControl === control && select.matches(':disabled')) closeMenu(control);
  const selected = select.options[select.selectedIndex];
  trigger.textContent = selected ? normalizeText(selected.label) : '';
  trigger.setAttribute('aria-disabled', String(select.matches(':disabled')));
  trigger.tabIndex = select.matches(':disabled') ? -1 : control.tabIndex;

  if (select.hasAttribute('aria-invalid')) {
    trigger.setAttribute('aria-invalid', select.getAttribute('aria-invalid'));
  } else if (!control.generatedInvalid) {
    trigger.removeAttribute('aria-invalid');
  }
  if (select.hasAttribute('aria-describedby')) {
    trigger.setAttribute('aria-describedby', select.getAttribute('aria-describedby'));
  } else {
    trigger.removeAttribute('aria-describedby');
  }
  if (select.hasAttribute('aria-errormessage')) {
    trigger.setAttribute('aria-errormessage', select.getAttribute('aria-errormessage'));
  } else {
    trigger.removeAttribute('aria-errormessage');
  }
  if (select.required) trigger.setAttribute('aria-required', 'true');
  else trigger.removeAttribute('aria-required');

  if (activeControl === control) {
    control.menu?.remove();
    control.menu = buildMenu(control);
    control.document.body.append(control.menu);
    control.trigger.setAttribute('aria-controls', control.menuId);
    const activeIndex = disabledOption(select.options[control.activeIndex])
      ? -1
      : control.activeIndex;
    setActiveOption(control, activeIndex, false);
    positionMenu(control);
  }
}

function chooseOption(control, index) {
  const option = control.select.options[index];
  if (!option || disabledOption(option)) return;
  const changed = control.select.selectedIndex !== index;
  control.select.selectedIndex = index;
  control.generatedInvalid = false;
  closeMenu(control);
  syncControl(control);
  if (!changed) return;
  control.select.dispatchEvent(new Event('input', { bubbles: true }));
  control.select.dispatchEvent(new Event('change', { bubbles: true }));
}

function typeahead(control, character) {
  clearTimeout(control.typeaheadTimer);
  control.typeahead += normalizedSearch(character);
  control.typeaheadTimer = setTimeout(() => { control.typeahead = ''; }, 700);
  const options = Array.from(control.select.options);
  const start = control.activeIndex >= 0 ? control.activeIndex + 1 : 0;
  const ordered = [...options.slice(start), ...options.slice(0, start)];
  const match = ordered.find((option) => (
    !disabledOption(option) && normalizedSearch(option.label).startsWith(control.typeahead)
  ));
  if (match) setActiveOption(control, options.indexOf(match));
}

function onTriggerKeydown(control, event) {
  const key = event.key;
  const isOpen = activeControl === control;

  if (key === 'Escape' && isOpen) {
    event.preventDefault();
    event.stopPropagation();
    closeMenu(control);
    return;
  }
  if (key === 'Tab') {
    if (isOpen) closeMenu(control);
    return;
  }

  if (!isOpen) {
    if (key === 'ArrowDown' || key === 'ArrowUp' || key === 'Enter' || key === ' ') {
      event.preventDefault();
      openMenu(control, key === 'ArrowUp' ? 'last' : key.startsWith('Arrow') ? 'first' : 'selected');
    } else if (key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      openMenu(control);
      if (activeControl === control) typeahead(control, key);
    }
    return;
  }

  if (key === 'ArrowDown' || key === 'ArrowUp') {
    event.preventDefault();
    const direction = key === 'ArrowDown' ? 1 : -1;
    const start = control.activeIndex < 0
      ? (direction > 0 ? 0 : control.select.options.length - 1)
      : control.activeIndex + direction;
    setActiveOption(control, enabledOptionFrom(control, start, direction));
  } else if (key === 'Home' || key === 'End') {
    event.preventDefault();
    const index = key === 'Home'
      ? enabledOptionFrom(control, 0, 1)
      : enabledOptionFrom(control, control.select.options.length - 1, -1);
    setActiveOption(control, index);
  } else if (key === 'Enter' || key === ' ') {
    event.preventDefault();
    if (control.activeIndex >= 0) chooseOption(control, control.activeIndex);
  } else if (key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey) {
    event.preventDefault();
    typeahead(control, key);
  }
}

function connectLabel(control, label) {
  const handleLabelClick = (event) => {
    if (control.select.matches(':disabled')) return;
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('button, a, input, select, textarea, [contenteditable="true"], [role="button"], .ds-select__trigger')) return;
    event.preventDefault();
    control.trigger.focus({ preventScroll: true });
  };
  label.addEventListener('click', handleLabelClick);
  control.labels.push([label, handleLabelClick]);
}

function enhanceSelect(select) {
  if (controlsBySelect.has(select) || !select.parentNode) return;

  const document = select.ownerDocument;
  const labels = Array.from(select.labels || []);
  const wrapper = document.createElement('span');
  wrapper.className = 'ds-select';
  const trigger = document.createElement('span');
  trigger.className = 'ds-select__trigger';
  trigger.setAttribute('role', 'combobox');
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-autocomplete', 'none');

  const control = {
    document,
    select,
    wrapper,
    trigger,
    menu: null,
    menuId: uniqueId(document, 'ds-select-listbox'),
    activeIndex: -1,
    tabIndex: select.tabIndex,
    labels: [],
    generatedInvalid: false,
    typeahead: '',
    typeaheadTimer: 0,
  };
  trigger.id = select.id ? `ds-${select.id}-combobox` : uniqueId(document, 'ds-select-combobox');
  if (select.hasAttribute('aria-labelledby')) {
    trigger.setAttribute('aria-labelledby', select.getAttribute('aria-labelledby'));
  } else if (select.hasAttribute('aria-label')) {
    trigger.setAttribute('aria-label', select.getAttribute('aria-label'));
  } else if (labels.length) {
    const text = labels.map(labelText).filter(Boolean).join(' ');
    if (text) trigger.setAttribute('aria-label', text);
  }
  if (select.title) trigger.title = select.title;
  if (select.classList.contains('impcat')) trigger.classList.add('impcat');

  select.parentNode.insertBefore(wrapper, select);
  wrapper.append(select, trigger);
  select.classList.add('ds-select__native');
  select.setAttribute('aria-hidden', 'true');
  select.tabIndex = -1;

  trigger.addEventListener('click', (event) => {
    event.preventDefault();
    if (activeControl === control) closeMenu(control);
    else openMenu(control);
  });
  trigger.addEventListener('keydown', (event) => onTriggerKeydown(control, event));
  select.addEventListener('input', () => syncControl(control));
  select.addEventListener('change', () => syncControl(control));
  select.addEventListener('focus', () => trigger.focus({ preventScroll: true }));
  select.addEventListener('invalid', () => {
    control.generatedInvalid = !select.hasAttribute('aria-invalid');
    trigger.setAttribute('aria-invalid', 'true');
    trigger.focus({ preventScroll: true });
  });
  for (const label of labels) connectLabel(control, label);

  controlsBySelect.set(select, control);
  controls.add(control);
  syncControl(control);
}

function visitSelects(node) {
  if (!(node instanceof Element || node instanceof Document)) return;
  if (node instanceof HTMLSelectElement) enhanceSelect(node);
  node.querySelectorAll?.('select').forEach(enhanceSelect);
}

function controlForMutation(target) {
  if (target instanceof HTMLSelectElement) return controlsBySelect.get(target);
  const select = target instanceof Element ? target.closest('select') : null;
  return select ? controlsBySelect.get(select) : null;
}

function handleDocumentPointerDown(event) {
  if (!activeControl) return;
  const target = event.target instanceof Element ? event.target : null;
  if (target && (activeControl.wrapper.contains(target) || activeControl.menu?.contains(target))) return;
  closeMenu(activeControl);
}

function initializeObserver(document, root) {
  const existing = documentObservers.get(document);
  if (existing) {
    visitSelects(root);
    return existing;
  }

  const observeRoot = document.body || document.documentElement;
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'childList') {
        const control = controlForMutation(record.target);
        if (control) syncControl(control);
        record.addedNodes.forEach(visitSelects);
      } else {
        const control = controlForMutation(record.target);
        if (control) syncControl(control);
        if (record.target instanceof Element) record.target.querySelectorAll('select').forEach((select) => {
          const nestedControl = controlsBySelect.get(select);
          if (nestedControl) syncControl(nestedControl);
        });
      }
    }

    for (const control of controls) {
      if (control.select.isConnected) continue;
      if (activeControl === control) closeMenu(control);
      control.labels.forEach(([label, listener]) => label.removeEventListener('click', listener));
      clearTimeout(control.typeaheadTimer);
      controls.delete(control);
    }
  });

  observer.observe(observeRoot, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['aria-describedby', 'aria-errormessage', 'aria-invalid', 'disabled', 'required'],
  });
  document.addEventListener('pointerdown', handleDocumentPointerDown);
  documentObservers.set(document, observer);
  visitSelects(root);
  return observer;
}

export function initializeCustomSelects(root = document) {
  const document = root instanceof Document ? root : root.ownerDocument;
  if (!document) throw new TypeError('Os selects customizados precisam estar vinculados a um documento.');
  return initializeObserver(document, root);
}
