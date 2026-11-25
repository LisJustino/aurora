function setupKeyboardViewportSafety() {
  if (typeof window === 'undefined' || !('visualViewport' in window)) return;
  if (window.__auroraKeyboardViewportSafety) return;

  const updateKeyboardInset = () => {
    const viewport = window.visualViewport;
    const keyboardInset = Math.max(0, window.innerHeight - viewport.height - (viewport.offsetTop || 0));
    document.documentElement.style.setProperty('--keyboard-offset', `${keyboardInset}px`);

    const active = document.activeElement;
    if (!(active instanceof HTMLElement) || active.closest('#dlg')) return;
    if (!active.matches('input, textarea, select, [contenteditable="true"]')) return;
    if (keyboardInset > 100) {
      active.scrollIntoView({ block: 'center', inline: 'nearest' });
    }
  };

  window.visualViewport.addEventListener('resize', updateKeyboardInset);
  window.visualViewport.addEventListener('scroll', updateKeyboardInset);
  document.addEventListener(
    'focusin',
    (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement) || target.closest('#dlg')) return;
      if (!target.matches('input, textarea, select, [contenteditable="true"]')) return;
      if (!window.visualViewport || window.visualViewport.height >= window.innerHeight) return;
      target.scrollIntoView({ block: 'center', inline: 'nearest' });
    },
    true,
  );

  window.__auroraKeyboardViewportSafety = true;
}

export function registerViewportKeyboard() {
  setupKeyboardViewportSafety();
}
