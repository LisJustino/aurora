import { iconSvg } from '../../utils/icons.js';

const brandLogo = new URL('../../../../icons/favicon.svg', import.meta.url).href;

export function renderSuggestionForm() {
  return `<div class="footer-faq-content">
    <p>O formulário abre o aplicativo de e-mail configurado no seu dispositivo. Confira a mensagem e toque em Enviar; o Aurora não recebe nem guarda o rascunho. Se não tiver um aplicativo configurado, copie o e-mail de contato. Não inclua senhas nem informações pessoais sensíveis.</p>
    <form class="footer-suggestion-form" data-footer-suggestion>
      <label for="footer-suggestion-name">Seu nome (opcional)</label>
      <input id="footer-suggestion-name" name="name" type="text" maxlength="100" autocomplete="name">
      <label for="footer-suggestion-email">E-mail para resposta (opcional)</label>
      <input id="footer-suggestion-email" name="email" type="email" maxlength="254" autocomplete="email">
      <label for="footer-suggestion-message">Sua sugestão</label>
      <textarea id="footer-suggestion-message" name="message" rows="4" maxlength="2000" required></textarea>
      <p class="notice warn full" data-suggestion-error role="alert" hidden></p>
      <button class="btn ghost" type="submit">Abrir meu e-mail para enviar</button>
      <button class="btn back" type="button" data-action="copy-contact-email">Copiar e-mail de contato</button>
      <p class="fine" data-suggestion-copy-status role="status" aria-live="polite"></p>
      <p class="fine" data-suggestion-copy-fallback hidden>Copie este endereço: lisjustino@gmail.com</p>
    </form>
  </div>`;
}

export function renderFooterContent({
  authenticated = false,
  accountError = false,
  preview = false,
  demoAvailable = false,
  includeLegalDialog = true,
  includeFaq = true,
  pwaInstall = false,
  suggestionForm = false,
} = {}) {
  const isStandalone = typeof navigator !== 'undefined' && (
    navigator.standalone === true
    || (typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(display-mode: standalone)').matches)
  );
  const accountLinks = preview
    ? '<a class="footer-link" href="/config">Perfil e ajustes da prévia</a><span class="footer-link footer-preview-label">Modo de prévia local</span>'
    : authenticated
    ? `<a class="footer-link" href="/config">Perfil e ajustes</a><button class="footer-link" type="button" data-account-signout>Sair da conta</button>`
    : accountError
      ? `<a class="footer-link" href="/">Voltar à página inicial</a>`
      : `<a class="footer-link" href="/entrar" data-public-action="login">Entrar</a><a class="footer-link" href="/criar-conta" data-public-action="signup">Criar conta</a>`;
  const demoLink = demoAvailable
    ? '<a class="footer-link" href="/demonstracao" data-public-action="demo">Explorar demonstração</a>'
    : '';
  const installLink = pwaInstall && !isStandalone && typeof window !== 'undefined'
    ? '<button class="footer-link" type="button" data-action="pwa-install">Baixar o app</button>'
    : '';

  return `
    <div class="site-footer-content">
      <div class="footer-brand">
        <div class="footer-brand-mark"><img src="${brandLogo}" alt="" aria-hidden="true" width="32" height="32"><span class="wordmark">aurora<span>.</span></span></div>
        <p>Organize sua rotina com tarefas, foco, hábitos e finanças em um único lugar.</p>
      </div>
      <nav class="footer-nav" aria-label="Conta">
        <h2>Conta</h2>
        <div class="footer-link-list">${accountLinks}</div>
      </nav>
      <nav class="footer-nav" aria-label="Demonstração e app">
        <h2>Uso</h2>
        <div class="footer-link-list">${demoLink}${installLink}</div>
      </nav>
      <nav class="footer-nav" aria-label="Informações legais">
        <h2>Informações legais</h2>
        <div class="footer-link-list">
          <button class="footer-link" type="button" data-legal-document="terms">Termos de Uso</button>
          <button class="footer-link" type="button" data-legal-document="privacy">Política de Privacidade</button>
        </div>
      </nav>
      ${includeFaq ? `<details class="footer-faq">
        <summary>Perguntas frequentes <span aria-hidden="true">${iconSvg('chevDown', 16)}</span></summary>
        <div class="footer-faq-content">
          <details>
            <summary>A demonstração usa meus dados?<span class="footer-faq-disclosure" aria-hidden="true">${iconSvg('chevDown', 16)}</span></summary>
            <p>Não. Ela usa apenas informações fictícias, não acessa sua conta e não salva alterações.</p>
          </details>
          <details>
            <summary>Preciso de uma conta?<span class="footer-faq-disclosure" aria-hidden="true">${iconSvg('chevDown', 16)}</span></summary>
            <p>Você pode explorar a demonstração sem cadastro. Para guardar seus próprios registros, crie uma conta.</p>
          </details>
          <details>
            <summary>O que acontece sem conexão?<span class="footer-faq-disclosure" aria-hidden="true">${iconSvg('chevDown', 16)}</span></summary>
            <p>O Aurora avisa quando está sem conexão e bloqueia novas gravações. Alterações offline não são sincronizadas automaticamente.</p>
          </details>
          <details>
            <summary>Como envio uma sugestão?<span class="footer-faq-disclosure" aria-hidden="true">${iconSvg('chevDown', 16)}</span></summary>
            <p>O formulário abaixo abre o aplicativo de e-mail configurado no seu dispositivo. Confira a mensagem e toque em Enviar; o Aurora não recebe nem guarda o rascunho. Se não tiver um aplicativo configurado, copie o e-mail de contato. Não inclua senhas ou informações pessoais sensíveis.</p>
            <form class="footer-suggestion-form" data-footer-suggestion>
              <label for="footer-suggestion-name">Seu nome (opcional)</label>
              <input id="footer-suggestion-name" name="name" type="text" maxlength="100" autocomplete="name">
              <label for="footer-suggestion-email">E-mail para resposta (opcional)</label>
              <input id="footer-suggestion-email" name="email" type="email" maxlength="254" autocomplete="email">
              <label for="footer-suggestion-message">Sua sugestão</label>
              <textarea id="footer-suggestion-message" name="message" rows="4" maxlength="2000" required></textarea>
              <button class="btn ghost" type="submit">Abrir meu e-mail para enviar</button>
              <button class="btn back" type="button" data-action="copy-contact-email">Copiar e-mail de contato</button>
              <p class="fine" data-suggestion-copy-status role="status" aria-live="polite"></p>
              <p class="fine" data-suggestion-copy-fallback hidden>Copie este endereço: lisjustino@gmail.com</p>
            </form>
          </details>
          <details>
            <summary>Como entro em contato com quem criou o Aurora?<span class="footer-faq-disclosure" aria-hidden="true">${iconSvg('chevDown', 16)}</span></summary>
            <p>Elisa da Silva Justino: <a href="mailto:lisjustino@gmail.com">lisjustino@gmail.com</a>.</p>
          </details>
        </div>
      </details>` : ''}
      ${suggestionForm ? `<details class="footer-faq footer-suggestion">
        <summary>Enviar uma sugestão <span aria-hidden="true">${iconSvg('chevDown', 16)}</span></summary>
        ${renderSuggestionForm()}
      </details>` : ''}
      <div class="footer-meta">
        <span>© ${new Date().getFullYear()} aurora.</span>
        <button class="btn sm back footer-back-to-top" type="button" data-action="footer-scroll-top">Voltar ao topo</button>
      </div>
      ${includeLegalDialog ? renderLegalDialog() : ''}
    </div>`;
}

export function initializeFaqDisclosure(root) {
  root.querySelectorAll('details.footer-faq, .footer-faq-content details, details.public-faq-item, details.public-faq-more').forEach((details) => {
    const summary = details.querySelector(':scope > summary');
    if (!summary || summary.dataset.expandedStateBound) return;
    summary.dataset.expandedStateBound = 'true';
    const syncExpanded = () => summary.setAttribute('aria-expanded', String(details.open));
    syncExpanded();
    details.addEventListener('toggle', syncExpanded);
  });
}

export function renderLegalDialog() {
  return `
    <dialog class="dlg legal-modal" data-legal-modal aria-labelledby="legal-modal-title">
      <header class="head legal-modal-header">
        <h2 id="legal-modal-title" data-legal-dialog-title>Documento legal</h2>
        <button class="ibtn dlg-close" type="button" data-legal-modal-close aria-label="Fechar documento legal">${iconSvg('close', 18)}</button>
      </header>
      <p class="legal-modal-status" data-legal-dialog-status role="status" aria-live="polite" hidden></p>
      <div class="dlg-body legal-modal-content" data-legal-dialog-content role="region" aria-busy="false" tabindex="0"></div>
      <footer class="dlg-foot legal-modal-footer">
        <button class="btn back" type="button" data-legal-modal-close>Fechar</button>
      </footer>
    </dialog>`;
}
