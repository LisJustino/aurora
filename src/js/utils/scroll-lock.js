const ROOT_PROPERTIES = ['overflow', '--scroll-lock-offset-x', '--scroll-lock-offset-y'];
const BODY_PROPERTIES = ['position', 'top', 'left', 'right', 'width', 'overflow'];

let activeLocks = 0;
let originalState = null;

function captureProperties(element, properties) {
  return Object.fromEntries(properties.map((property) => [
    property,
    {
      value: element.style.getPropertyValue(property),
      priority: element.style.getPropertyPriority(property),
    },
  ]));
}

function restoreProperties(element, properties) {
  Object.entries(properties).forEach(([property, { value, priority }]) => {
    if (value) element.style.setProperty(property, value, priority);
    else element.style.removeProperty(property);
  });
}

export function lockPageScroll() {
  let released = false;
  if (activeLocks === 0) {
    const { body, documentElement } = document;
    if (!body) throw new Error('Não é possível bloquear o scroll antes de o documento carregar.');

    originalState = {
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      scrollLocked: documentElement.getAttribute('data-scroll-locked'),
      root: captureProperties(documentElement, ROOT_PROPERTIES),
      body: captureProperties(body, BODY_PROPERTIES),
    };
    documentElement.style.setProperty('overflow', 'hidden');
    documentElement.style.setProperty('--scroll-lock-offset-x', `${originalState.scrollX}px`);
    documentElement.style.setProperty('--scroll-lock-offset-y', `${originalState.scrollY}px`);
    documentElement.setAttribute('data-scroll-locked', 'true');
    Object.assign(body.style, {
      position: 'fixed',
      top: `${-originalState.scrollY}px`,
      left: `${-originalState.scrollX}px`,
      right: `${originalState.scrollX}px`,
      width: 'auto',
      overflow: 'hidden',
    });
  }
  activeLocks += 1;

  return () => {
    if (released) return;
    released = true;
    activeLocks -= 1;
    if (activeLocks > 0) return;

    const state = originalState;
    originalState = null;
    restoreProperties(document.documentElement, state.root);
    restoreProperties(document.body, state.body);
    if (state.scrollLocked === null) document.documentElement.removeAttribute('data-scroll-locked');
    else document.documentElement.setAttribute('data-scroll-locked', state.scrollLocked);
    window.scrollTo(state.scrollX, state.scrollY);
  };
}
