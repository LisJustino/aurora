(function () {
  var appearanceMode = 'auto';
  var root = document.documentElement;
  var systemTheme = typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;

  function applyInitialTheme() {
    var isDark = Boolean(systemTheme && systemTheme.matches);
    root.setAttribute('data-theme', isDark ? 'dark' : 'light');
    root.style.colorScheme = isDark ? 'dark' : 'light';
    root.style.backgroundColor = isDark ? '#1c1b19' : '#f5f3ed';
    var statusBar = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (statusBar) statusBar.content = isDark ? 'black' : 'default';
  }

  function syncManifest(mode) {
    var manifest = document.querySelector('link[rel="manifest"]');
    if (!manifest) return;
    var isDark = mode === 'dark'
      || (mode === 'auto' && systemTheme && systemTheme.matches);
    var next = new URL('manifest-' + (isDark ? 'dark' : 'light') + '.webmanifest', manifest.href);
    if (manifest.href !== next.href) manifest.href = next.href;
  }

  window.auroraManifestTheme = {
    setMode: function (mode) {
      appearanceMode = mode;
      syncManifest(mode);
    }
  };
  applyInitialTheme();
  syncManifest(appearanceMode);
  if (systemTheme && typeof systemTheme.addEventListener === 'function') {
    systemTheme.addEventListener('change', function () {
      if (appearanceMode === 'auto') {
        applyInitialTheme();
        syncManifest(appearanceMode);
      }
    });
  }
})();
