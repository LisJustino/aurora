(function () {
  var appearanceMode = 'auto';
  var root = document.documentElement;
  var systemTheme = typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;

  function applyInitialTheme() {
    root.setAttribute('data-theme', systemTheme && systemTheme.matches ? 'dark' : 'light');
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
