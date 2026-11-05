import { lockPageScroll } from '../../utils/scroll-lock.js';

const LEGAL_DOCUMENTS = Object.freeze({
  terms: Object.freeze({ title: 'Termos de Uso', path: '/terms.html' }),
  privacy: Object.freeze({ title: 'Política de Privacidade', path: '/privacy.html' }),
});
let legalDialogEventsInitialized = false;
const legalDialogReturnFocus = new WeakMap();
const legalDialogScrollState = new WeakMap();

async function loadLegalDocument(name) {
  const documentInfo = LEGAL_DOCUMENTS[name];
  if (!documentInfo) throw new Error('Documento legal desconhecido.');
  const response = await fetch(documentInfo.path, { cache: 'no-store' });
  if (!response.ok) throw new Error(`O documento respondeu com HTTP ${response.status}.`);
  const parsed = new DOMParser().parseFromString(await response.text(), 'text/html');
  const source = parsed.querySelector('main.legal-document');
  if (!source) throw new Error('O conteúdo do documento não foi encontrado.');

  source.querySelector('.legal-document-footer')?.remove();
  source.querySelectorAll('script, iframe, object, embed, form').forEach((element) => element.remove());
  source.querySelectorAll('*').forEach((element) => {
    [...element.attributes].forEach((attribute) => {
      if (attribute.name.toLowerCase().startsWith('on')) element.removeAttribute(attribute.name);
    });
  });
  return document.importNode(source, true);
}

function showLegalDocumentFallback(dialog, names) {
  const status = dialog.querySelector('[data-legal-dialog-status]');
  const content = dialog.querySelector('[data-legal-dialog-content]');
  delete dialog.dataset.legalDocument;
  const links = names.map((name) => {
    const link = document.createElement('a');
    link.href = LEGAL_DOCUMENTS[name].path;
    link.dataset.legalDirect = '';
    link.textContent = `Abrir ${LEGAL_DOCUMENTS[name].title} em uma página`;
    return link;
  });
  status.replaceChildren(
    document.createTextNode('Não foi possível carregar o documento no modal. '),
    ...links.flatMap((link, index) => index ? [document.createTextNode(' '), link] : [link]),
  );
  status.hidden = false;
  content.setAttribute('aria-busy', 'false');
}

export async function showLegalDocument(dialog, name, savedScrollPosition = { left: window.scrollX, top: window.scrollY }) {
  const documentInfo = LEGAL_DOCUMENTS[name];
  if (!documentInfo || !(dialog instanceof HTMLDialogElement)) return false;
  const title = dialog.querySelector('[data-legal-dialog-title]');
  const status = dialog.querySelector('[data-legal-dialog-status]');
  const content = dialog.querySelector('[data-legal-dialog-content]');
  if (!title || !status || !content) throw new Error('A estrutura do diálogo legal está incompleta.');

  title.textContent = documentInfo.title;
  status.textContent = 'Carregando documento…';
  status.hidden = false;
  content.replaceChildren();
  content.setAttribute('aria-busy', 'true');
  delete dialog.dataset.legalDocument;
  if (!dialog.open) {
    const trigger = legalDialogReturnFocus.get(dialog) ?? document.activeElement;
    if (!legalDialogReturnFocus.has(dialog)) {
      legalDialogReturnFocus.set(dialog, trigger instanceof HTMLElement ? trigger : document.body);
    }
    legalDialogScrollState.set(dialog, savedScrollPosition);
    const unlockScroll = lockPageScroll();
    const releaseOnClose = () => {
      dialog.removeEventListener('close', releaseOnClose);
      unlockScroll();
      const restoreScroll = legalDialogScrollState.get(dialog) ?? savedScrollPosition;
      legalDialogScrollState.delete(dialog);
      const returnFocus = legalDialogReturnFocus.get(dialog);
      legalDialogReturnFocus.delete(dialog);
      window.scrollTo({ left: restoreScroll.left, top: restoreScroll.top, behavior: 'auto' });
      if (returnFocus instanceof HTMLElement && returnFocus.isConnected) {
        returnFocus.focus({ preventScroll: true });
      }
    };
    dialog.addEventListener('close', releaseOnClose, { once: true });
    try {
      dialog.showModal();
    } catch (error) {
      dialog.removeEventListener('close', releaseOnClose);
      unlockScroll();
      legalDialogScrollState.delete(dialog);
      legalDialogReturnFocus.delete(dialog);
      throw error;
    }
  }

  try {
    content.replaceChildren(await loadLegalDocument(name));
    content.scrollTop = 0;
    status.hidden = true;
    content.setAttribute('aria-busy', 'false');
    dialog.dataset.legalDocument = name;
    content.setAttribute('aria-label', documentInfo.title);
    content.focus({ preventScroll: true });
    return true;
  } catch (error) {
    console.error('Aurora: não foi possível carregar o documento legal no modal.', error);
    showLegalDocumentFallback(dialog, [name]);
    return false;
  }
}

export function initializeLegalDialogEvents() {
  if (legalDialogEventsInitialized) return;
  legalDialogEventsInitialized = true;

  document.addEventListener('click', async (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    const closeButton = target.closest('[data-legal-modal-close]');
    if (closeButton) {
      closeButton.closest('dialog[data-legal-modal]')?.close();
      return;
    }

    const dialog = target.closest('dialog[data-legal-modal]');
    if (dialog && target === dialog) {
      const bounds = dialog.getBoundingClientRect();
      const isBackdrop = event.clientX < bounds.left || event.clientX > bounds.right
        || event.clientY < bounds.top || event.clientY > bounds.bottom;
      if (isBackdrop) dialog.close();
      return;
    }

    const trigger = target.closest('[data-legal-document]');
    const linkedDocument = dialog && !target.closest('[data-legal-direct]')
      ? target.closest('a[href]')
      : null;
    const linkedPath = linkedDocument ? new URL(linkedDocument.href, location.href).pathname : '';
    const documentName = trigger?.dataset.legalDocument
      || (linkedPath === '/terms.html' ? 'terms' : linkedPath === '/privacy.html' ? 'privacy' : '');
    if (!documentName) return;

    const modal = document.querySelector('dialog[data-legal-modal]');
    if (!(modal instanceof HTMLDialogElement)) {
      console.error('Aurora: o diálogo de documentos legais não está disponível.');
      return;
    }
    event.preventDefault();
    if (!modal.open) legalDialogReturnFocus.set(modal, trigger || linkedDocument || document.activeElement);
    await showLegalDocument(modal, documentName);
  });

  document.addEventListener('keydown', (event) => {
    const dialog = document.querySelector('dialog[data-legal-modal][open]');
    if (!dialog) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      dialog.close();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [...dialog.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )].filter((element) => !element.hidden && element.getAttribute('aria-hidden') !== 'true');
    if (!focusable.length) {
      event.preventDefault();
      dialog.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
      event.preventDefault();
      first.focus();
    }
  });
}
