const LEGAL_DOCUMENTS = Object.freeze({
  terms: Object.freeze({ title: 'Termos de Uso', path: '/terms.html' }),
  privacy: Object.freeze({ title: 'Política de Privacidade', path: '/privacy.html' }),
});

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
