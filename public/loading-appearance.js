(function () {
  var key = 'aurora.loading-appearance.v1';
  var root = document.documentElement;
  var hex = /^#[0-9a-f]{6}$/i;

  function apply(value) {
    if (!value || !hex.test(value.primary) || !hex.test(value.accent)
      || !['rose', 'customized'].includes(value.palette)
      || !['light', 'dark', 'auto'].includes(value.mode)
      || typeof value.reduceMotion !== 'boolean') return false;
    root.style.setProperty('--loading-primary', value.primary);
    root.style.setProperty('--loading-accent', value.accent);
    root.setAttribute('data-loading-palette', value.palette);
    root.setAttribute('data-loading-mode', value.mode);
    root.setAttribute('data-loading-motion', value.reduceMotion ? 'reduce' : 'normal');
    return true;
  }

  window.auroraLoadingAppearance = {
    save: function (value) {
      if (!apply(value)) throw new Error('A aparência de carregamento é inválida.');
      try {
        var serialized = JSON.stringify(value);
        if (localStorage.getItem(key) !== serialized) localStorage.setItem(key, serialized);
      } catch (error) {
        console.error('Aurora: não foi possível guardar a aparência para o carregamento.', error);
      }
    },
    clear: function () {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        console.error('Aurora: não foi possível remover a aparência de carregamento deste dispositivo.', error);
      }
      root.removeAttribute('data-loading-palette');
      root.removeAttribute('data-loading-mode');
      root.removeAttribute('data-loading-motion');
      root.style.removeProperty('--loading-primary');
      root.style.removeProperty('--loading-accent');
    }
  };

  try {
    var stored = localStorage.getItem(key);
    if (stored && !apply(JSON.parse(stored))) {
      console.error('Aurora: a aparência de carregamento armazenada é inválida.');
    }
  } catch (error) {
    console.error('Aurora: não foi possível ler a aparência de carregamento.', error);
  }
})();
