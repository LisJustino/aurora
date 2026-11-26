import { iconSvg } from '../../utils/icons.js';
import { CONTACT_EMAIL } from './suggestions.js';

const brandLogo = new URL('../../../../icons/favicon.svg', import.meta.url).href;

export function renderSuggestionForm() {
  return `<div class="footer-faq-content">
    <form class="footer-suggestion-form" data-footer-suggestion>
      <div class="suggestion-form-field">
        <div class="suggestion-form-label-row">
          <label for="footer-suggestion-message">Sua sugestão</label>
          <span class="suggestion-form-count" data-suggestion-count aria-live="polite">0 / 2000</span>
        </div>
        <textarea id="footer-suggestion-message" name="message" rows="5" minlength="10" maxlength="2000"
          placeholder="Conte o que poderia ser mais simples, útil ou melhor…"
          aria-describedby="footer-suggestion-privacy" required></textarea>
      </div>
      <div class="suggestion-privacy" id="footer-suggestion-privacy">
        <span aria-hidden="true">${iconSvg('shield', 16)}</span>
        <p>Sua mensagem vai para análise. Não pedimos nome nem e-mail; evite dados pessoais, senhas ou informações de saúde.</p>
      </div>
      <p class="notice warn full" data-suggestion-error role="alert" hidden></p>
      <div class="suggestion-form-actions">
        <p class="fine" data-suggestion-status role="status" aria-live="polite"></p>
        <button class="btn primary" type="submit">Enviar sugestão</button>
      </div>
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
  const isStandalone =
    typeof navigator !== 'undefined' &&
    (navigator.standalone === true ||
      (typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(display-mode: standalone)').matches));
  const accountLinks = preview
    ? '<a class="footer-link" href="/ajustes">Perfil e ajustes da prévia</a><span class="footer-link footer-preview-label">Modo de prévia local</span>'
    : authenticated
      ? '<a class="footer-link" href="/ajustes">Perfil e ajustes</a>'
      : accountError
        ? `<a class="footer-link" href="/">Voltar à página inicial</a>`
        : `<a class="footer-link" href="/entrar" data-public-action="login">Entrar</a><a class="footer-link"
          href="/criar-conta" data-public-action="signup">Criar conta</a>`;
  const demoLink = demoAvailable
    ? '<a class="footer-link" href="/demonstracao" data-public-action="demo">Ver demonstração</a>'
    : '';
  const installLink =
    pwaInstall && !isStandalone && typeof window !== 'undefined'
      ? '<button class="footer-link" type="button" data-action="pwa-install">Baixar o app</button>'
      : '';

  return `
    <div class="site-footer-content">
      <div class="footer-brand">
        <div class="footer-brand-mark"><img src="${brandLogo}" alt="" aria-hidden="true" width="32" height="32"><span
          class="wordmark">aurora<span>.</span></span></div>
        <p>Um lugar para anotar as coisas e voltar a elas quando der.</p>
      </div>
      <nav class="footer-nav" aria-label="Conta">
        <h2>Conta</h2>
        <div class="footer-link-list">${accountLinks}</div>
      </nav>
      ${
        demoLink || installLink
          ? `<nav class="footer-nav" aria-label="Demonstração e app">
        <h2>Uso</h2>
        <div class="footer-link-list">${demoLink}${installLink}</div>
      </nav>`
          : ''
      }
      <nav class="footer-nav" aria-label="Informações legais">
        <h2>Informações legais</h2>
        <div class="footer-link-list">
          <button class="footer-link" type="button" data-legal-document="terms">Termos de Uso</button>
          <button class="footer-link" type="button" data-legal-document="privacy">Política de Privacidade</button>
        </div>
      </nav>
      ${
        includeFaq
          ? `<details class="footer-faq">
        <summary>Perguntas frequentes <span aria-hidden="true">${iconSvg('chevDown', 16)}</span></summary>
        <div class="footer-faq-content">
          <details>
            <summary>A demonstração usa meus dados?<span class="footer-faq-disclosure"
              aria-hidden="true">${iconSvg('chevDown', 16)}</span></summary>
            <p>Não. Ela usa apenas informações fictícias, não acessa sua conta e não salva alterações.</p>
          </details>
          <details>
            <summary>Preciso de uma conta?<span class="footer-faq-disclosure"
              aria-hidden="true">${iconSvg('chevDown', 16)}</span></summary>
            <p>Você pode explorar a demonstração sem cadastro. Para guardar seus próprios registros, crie uma conta.</p>
          </details>
          <details>
            <summary>O que acontece sem conexão?<span class="footer-faq-disclosure"
              aria-hidden="true">${iconSvg('chevDown', 16)}</span></summary>
            <p>O Aurora avisa quando está sem conexão e bloqueia novas gravações. Alterações offline não são sincronizadas automaticamente.</p>
          </details>
          <details>
            <summary>Como posso apagar meus dados?<span class="footer-faq-disclosure"
              aria-hidden="true">${iconSvg('chevDown', 16)}</span></summary>
            <p>Inicie a exclusão permanente da conta em Ajustes → Seu perfil. Itens excluídos recentemente podem ser recuperados em Ajustes → Dados e recuperação.</p>
          </details>
          <details>
            <summary>Como envio uma sugestão?<span class="footer-faq-disclosure"
              aria-hidden="true">${iconSvg('chevDown', 16)}</span></summary>
            ${renderSuggestionForm()}
          </details>
          <details>
            <summary>Como entro em contato com quem criou o Aurora?<span class="footer-faq-disclosure"
              aria-hidden="true">${iconSvg('chevDown', 16)}</span></summary>
            <p>Elisa da Silva Justino: <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>
          </details>
        </div>
      </details>`
          : ''
      }
      ${
        suggestionForm
          ? `<details class="footer-faq footer-suggestion">
        <summary>Enviar uma sugestão <span aria-hidden="true">${iconSvg('chevDown', 16)}</span></summary>
        ${renderSuggestionForm()}
      </details>`
          : ''
      }
      <div class="footer-meta">
        <span>© ${new Date().getFullYear()} aurora.</span>
        <button class="btn sm back footer-back-to-top" type="button"
          data-action="footer-scroll-top">Voltar ao topo</button>
      </div>
      ${includeLegalDialog ? renderLegalDialog() : ''}
    </div>`;
}

export function initializeFaqDisclosure(root) {
  root
    .querySelectorAll(
      'details.footer-faq, .footer-faq-content details, details.public-faq-item, details[data-suggestion-disclosure]',
    )
    .forEach((details) => {
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
        <button class="ibtn dlg-close" type="button" data-legal-modal-close
          aria-label="Fechar documento legal">${iconSvg('close', 18)}</button>
      </header>
      <p class="legal-modal-status" data-legal-dialog-status role="status" aria-live="polite" hidden></p>
      <div class="dlg-body legal-modal-content" data-legal-dialog-content role="region" aria-busy="false"
        tabindex="0"></div>
      <footer class="dlg-foot legal-modal-footer">
        <button class="btn back" type="button" data-legal-modal-close>Fechar</button>
      </footer>
    </dialog>`;
}
