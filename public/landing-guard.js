// Mantém o HTML pré-renderizado só na landing em "/" no navegador.
// Outras rotas e o app instalado voltam ao esqueleto de carregamento.
(function () {
  var app = document.getElementById('app');
  var template = document.getElementById('app-skeleton');
  if (!app || !template || !app.querySelector('[data-prerendered]')) return;
  var standalone = window.navigator.standalone === true
    || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  var path = window.location.pathname.replace(/index\.html$/, '');
  if (standalone || (path !== '/' && path !== '')) {
    app.innerHTML = '';
    app.appendChild(template.content.cloneNode(true));
  }
})();
