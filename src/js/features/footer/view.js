const brandLogo = new URL('../../../../icons/favicon.svg', import.meta.url).href;

export function renderFooterContent({
  authenticated = false,
  accountError = false,
  preview = false,
  demoAvailable = false,
} = {}) {
  const accountLinks = preview
    ? '<a class="footer-link" href="#config">Perfil e ajustes da prévia</a><span class="footer-link footer-preview-label">Modo de prévia local</span>'
    : authenticated
    ? `<a class="footer-link" href="#config">Perfil e ajustes</a><button class="footer-link" type="button" data-account-signout>Sair da conta</button>`
    : accountError
      ? `<a class="footer-link" href="/">Voltar à página inicial</a>`
      : `<button class="footer-link" type="button" data-public-action="login">Entrar</button><button class="footer-link" type="button" data-public-action="signup">Criar conta</button>`;
  const demoLink = demoAvailable
    ? '<button class="footer-link" type="button" data-public-action="demo">Explorar demonstração</button>'
    : '';

  return `
    <div class="site-footer-content">
      <div class="footer-brand">
        <div class="footer-brand-mark"><img src="${brandLogo}" alt="" aria-hidden="true" width="32" height="32"><span class="wordmark">aurora<span>.</span></span></div>
      </div>
      <nav class="footer-nav" aria-label="Conta">
        <h2>Conta</h2>
        <div class="footer-link-list">${accountLinks}${demoLink}</div>
      </nav>
      <nav class="footer-nav" aria-label="Informações legais">
        <h2>Informações legais</h2>
        <div class="footer-link-list">
          <button class="footer-link" type="button" data-legal-document="terms">Termos de Uso</button>
          <button class="footer-link" type="button" data-legal-document="privacy">Política de Privacidade</button>
        </div>
      </nav>
      <details class="footer-faq">
        <summary>Perguntas frequentes <span aria-hidden="true">+</span></summary>
        <div class="footer-faq-content">
          <details>
            <summary>A demonstração usa meus dados?</summary>
            <p>Não. Ela usa apenas informações fictícias, não acessa sua conta e não salva alterações.</p>
          </details>
          <details>
            <summary>Preciso de uma conta?</summary>
            <p>Você pode explorar a demonstração sem cadastro. Para guardar seus próprios dados, crie e confirme uma conta.</p>
          </details>
          <details>
            <summary>O que acontece sem conexão?</summary>
            <p>O Aurora avisa quando está sem conexão e bloqueia gravações. Alterações offline não são sincronizadas automaticamente.</p>
          </details>
          <details>
            <summary>Como configuro o acesso à conta?</summary>
            <p>Adicione a URL do projeto e a chave pública anon ou publishable em .env.local e reinicie o servidor Vite. Nunca use uma chave service_role ou secret.</p>
          </details>
          <details>
            <summary>Como envio uma sugestão?</summary>
            <p>O formulário abaixo abre o aplicativo de e-mail configurado no seu dispositivo. Confira a mensagem e toque em Enviar; o Aurora não recebe nem guarda o rascunho. Não inclua senhas ou informações pessoais sensíveis.</p>
            <form class="footer-suggestion-form" data-footer-suggestion>
              <label for="footer-suggestion-name">Seu nome (opcional)</label>
              <input id="footer-suggestion-name" name="name" type="text" maxlength="100" autocomplete="name">
              <label for="footer-suggestion-email">E-mail para resposta (opcional)</label>
              <input id="footer-suggestion-email" name="email" type="email" maxlength="254" autocomplete="email">
              <label for="footer-suggestion-message">Sua sugestão</label>
              <textarea id="footer-suggestion-message" name="message" rows="4" maxlength="2000" required></textarea>
              <button class="btn ghost" type="submit">Abrir meu e-mail para enviar</button>
            </form>
          </details>
          <details>
            <summary>Como entro em contato com a responsável?</summary>
            <p>Elisa da Silva Justino: <a href="mailto:lisjustino@gmail.com">lisjustino@gmail.com</a>.</p>
          </details>
        </div>
      </details>
      <div class="footer-meta">
        <span>© ${new Date().getFullYear()} Aurora</span>
        <button class="footer-back-to-top" type="button" data-action="footer-scroll-top">Voltar ao topo</button>
      </div>
      <dialog class="dlg legal-modal" data-legal-modal aria-labelledby="legal-modal-title">
        <header class="head legal-modal-header">
          <h2 id="legal-modal-title" data-legal-dialog-title>Documento legal</h2>
          <button class="ibtn dlg-close" type="button" data-legal-modal-close aria-label="Fechar documento legal">×</button>
        </header>
        <p class="legal-modal-status" data-legal-dialog-status role="status" aria-live="polite" hidden></p>
        <div class="dlg-body legal-modal-content" data-legal-dialog-content role="region" aria-busy="false" tabindex="0"></div>
        <footer class="dlg-foot legal-modal-footer">
          <label class="legal-modal-consent" data-legal-consent-choice hidden>
            <input type="checkbox" data-legal-consent-checkbox disabled>
            <span>Li e aceito os Termos de Uso e a Política de Privacidade.</span>
          </label>
          <button class="btn primary" type="button" data-legal-consent-confirm hidden disabled>Confirmar aceite</button>
          <button class="btn back" type="button" data-legal-modal-close data-legal-close-only>Fechar</button>
        </footer>
      </dialog>
    </div>`;
}
