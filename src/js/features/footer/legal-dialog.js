const LEGAL_DOCUMENTS = Object.freeze({
  terms: Object.freeze({ title: 'Termos de Uso', path: '/terms.html' }),
  privacy: Object.freeze({ title: 'Política de Privacidade', path: '/privacy.html' }),
});

function configureConsentControls(dialog, visible) {
  const choice = dialog.querySelector('[data-legal-consent-choice]');
  const checkbox = dialog.querySelector('[data-legal-consent-checkbox]');
  const confirm = dialog.querySelector('[data-legal-consent-confirm]');
  const close = dialog.querySelector('[data-legal-close-only]');
  if (!choice || !checkbox || !confirm || !close) {
    throw new Error('Os controles de aceite do diálogo legal estão incompletos.');
  }

  choice.hidden = !visible;
  confirm.hidden = !visible;
  close.hidden = visible;
  checkbox.checked = false;
  checkbox.disabled = true;
  confirm.disabled = true;
}

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
  delete dialog.dataset.legalConsent;
  configureConsentControls(dialog, false);
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

  configureConsentControls(dialog, false);
  title.textContent = documentInfo.title;
  status.textContent = 'Carregando documento…';
  status.hidden = false;
  content.replaceChildren();
  content.setAttribute('aria-busy', 'true');
  delete dialog.dataset.legalDocument;
  delete dialog.dataset.legalConsent;
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

export async function showLegalConsentDocuments(dialog) {
  if (!(dialog instanceof HTMLDialogElement)) return false;
  const title = dialog.querySelector('[data-legal-dialog-title]');
  const status = dialog.querySelector('[data-legal-dialog-status]');
  const content = dialog.querySelector('[data-legal-dialog-content]');
  if (!title || !status || !content) throw new Error('A estrutura do diálogo legal está incompleta.');

  configureConsentControls(dialog, true);
  title.textContent = 'Termos de Uso e Política de Privacidade';
  status.textContent = 'Carregando os documentos…';
  status.hidden = false;
  content.replaceChildren();
  content.setAttribute('aria-busy', 'true');
  delete dialog.dataset.legalDocument;
  dialog.dataset.legalConsent = 'true';
  if (!dialog.open) dialog.showModal();

  try {
    const documents = await Promise.all(['terms', 'privacy'].map(loadLegalDocument));
    content.replaceChildren(...documents);
    content.scrollTop = 0;
    content.setAttribute('aria-busy', 'false');
    content.setAttribute('aria-label', 'Termos de Uso e Política de Privacidade');
    status.textContent = 'Role até o final dos dois documentos para liberar a confirmação.';
    status.hidden = false;
    content.focus({ preventScroll: true });
    return true;
  } catch (error) {
    console.error('Aurora: não foi possível carregar os documentos legais no modal.', error);
    showLegalDocumentFallback(dialog, ['terms', 'privacy']);
    return false;
  }
}
