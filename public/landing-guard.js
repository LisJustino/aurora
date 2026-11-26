// Mantém o HTML pré-renderizado só para quem visita a landing em "/" sem estar logado.
// Outras rotas, retornos de autenticação e qualquer visita com sessão salva (aba ou app instalado) usam o
// carregamento, para a landing não piscar antes de a área logada abrir.
(function () {
  var path = window.location.pathname.replace(/index\.html$/, '');
  var query = new URLSearchParams(window.location.search);
  var hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  var authCallback = (path === '/' || path === '') && (
    Boolean(query.get('code')) || Boolean(query.get('error')) || Boolean(query.get('error_code'))
    || query.get('type') === 'recovery' || hash.get('type') === 'recovery'
  );
  if (authCallback) document.documentElement.dataset.auroraAuthCallback = 'true';
  var app = document.getElementById('app');
  var template = document.getElementById('app-skeleton');
  if (!app || !template || !app.querySelector('[data-prerendered]')) return;
  var hasSession = false;
  try {
    for (var i = 0; i < window.localStorage.length; i += 1) {
      if (/^sb-.+-auth-token$/.test(window.localStorage.key(i) || '')) { hasSession = true; break; }
    }
    if (!hasSession) {
      for (var j = 0; j < window.sessionStorage.length; j += 1) {
        if (/^sb-.+-auth-token$/.test(window.sessionStorage.key(j) || '')) { hasSession = true; break; }
      }
    }
  } catch (error) { hasSession = false; }
  if (authCallback || hasSession || (path !== '/' && path !== '')) {
    app.innerHTML = '';
    app.appendChild(template.content.cloneNode(true));
  }
})();
