const LEGAL_DOCUMENTS = Object.freeze({
  terms: Object.freeze({ title: 'Termos de Uso', path: '/terms.html' }),
  privacy: Object.freeze({ title: 'Política de Privacidade', path: '/privacy.html' }),
});

export function isLegalDocumentAtEnd({ scrollTop, clientHeight, scrollHeight }) {
  return Number.isFinite(scrollTop)
    && Number.isFinite(clientHeight)
    && Number.isFinite(scrollHeight)
    && scrollTop + clientHeight >= scrollHeight - 2;
}

export async function showLegalDocument(dialog, name) {
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
  if (!dialog.open) dialog.showModal();

  try {
    const response = await fetch(documentInfo.path, { cache: 'no-store' });
    if (!response.ok) throw new Error(`O documento respondeu com HTTP ${response.status}.`);
    const parsed = new DOMParser().parseFromString(await response.text(), 'text/html');
    const source = parsed.querySelector('main.legal-document');
    if (!source) throw new Error('O conteúdo do documento não foi encontrado.');

    const safeCopy = document.importNode(source, true);
    safeCopy.querySelector('.legal-document-footer')?.remove();
    safeCopy.querySelectorAll('script, iframe, object, embed, form').forEach((element) => element.remove());
    safeCopy.querySelectorAll('*').forEach((element) => {
      [...element.attributes].forEach((attribute) => {
        if (attribute.name.toLowerCase().startsWith('on')) element.removeAttribute(attribute.name);
      });
    });
    content.replaceChildren(safeCopy);
    content.scrollTop = 0;
    status.hidden = true;
    content.setAttribute('aria-busy', 'false');
    dialog.dataset.legalDocument = name;
    content.setAttribute('aria-label', documentInfo.title);
    content.focus({ preventScroll: true });
    return true;
  } catch (error) {
    console.error('Aurora: não foi possível carregar o documento legal no modal.', error);
    delete dialog.dataset.legalDocument;
    const fallback = document.createElement('a');
    fallback.href = documentInfo.path;
    fallback.dataset.legalDirect = '';
    fallback.textContent = `Abrir ${documentInfo.title} em uma página`;
    status.replaceChildren(
      document.createTextNode('Não foi possível carregar este documento no modal. '),
      fallback,
    );
    status.hidden = false;
    content.setAttribute('aria-busy', 'false');
    return false;
  }
}
