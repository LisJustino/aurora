// Mantém o HTML pré-renderizado só na landing em "/" no navegador.
// Outras rotas, retornos de autenticação e o app instalado usam o carregamento.
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
  var standalone = window.navigator.standalone === true
    || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  if (authCallback || standalone || (path !== '/' && path !== '')) {
    app.innerHTML = '';
    app.appendChild(template.content.cloneNode(true));
  }
})();
