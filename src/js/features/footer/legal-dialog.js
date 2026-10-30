const LEGAL_DOCUMENTS = Object.freeze({
  terms: Object.freeze({ title: 'Termos de Uso', path: '/terms.html' }),
  privacy: Object.freeze({ title: 'Política de Privacidade', path: '/privacy.html' }),
});
const consentProgress = new WeakMap();

function configureConsentControls(dialog, visible) {
  const choice = dialog.querySelector('[data-legal-consent-choice]');
  const checkbox = dialog.querySelector('[data-legal-consent-checkbox]');
  const confirm = dialog.querySelector('[data-legal-consent-confirm]');
  const progress = dialog.querySelector('[data-legal-reading-progress]');
  const jumpToEnd = dialog.querySelector('[data-legal-jump-to-end]');
  const close = dialog.querySelector('[data-legal-close-only]');
  if (!choice || !checkbox || !confirm || !progress || !jumpToEnd || !close) {
    throw new Error('Os controles de aceite do diálogo legal estão incompletos.');
  }

  choice.hidden = !visible;
  confirm.hidden = !visible;
  progress.hidden = !visible;
  jumpToEnd.hidden = !visible;
  close.hidden = visible;
  checkbox.checked = false;
  checkbox.disabled = true;
  confirm.disabled = true;
}

function getConsentProgress(dialog) {
  let readDocuments = consentProgress.get(dialog);
  if (!readDocuments) {
    readDocuments = new Set();
    consentProgress.set(dialog, readDocuments);
  }
  return readDocuments;
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
    const documents = await Promise.all(['terms', 'privacy'].map(async (name) => {
      const documentContent = await loadLegalDocument(name);
      documentContent.dataset.legalDocumentName = name;
      return documentContent;
    }));
    content.replaceChildren(...documents);
    content.scrollTop = 0;
    content.setAttribute('aria-busy', 'false');
    content.setAttribute('aria-label', 'Termos de Uso e Política de Privacidade');
    status.hidden = true;
    updateLegalConsentProgress(dialog);
    content.focus({ preventScroll: true });
    return true;
  } catch (error) {
    console.error('Aurora: não foi possível carregar os documentos legais no modal.', error);
    showLegalDocumentFallback(dialog, ['terms', 'privacy']);
    return false;
  }
}

export function updateLegalConsentProgress(dialog) {
  if (dialog?.dataset.legalConsent !== 'true') return;
  const content = dialog.querySelector('[data-legal-dialog-content]');
  const checkbox = dialog.querySelector('[data-legal-consent-checkbox]');
  const confirm = dialog.querySelector('[data-legal-consent-confirm]');
  const progress = dialog.querySelector('[data-legal-reading-progress]');
  const jumpToEnd = dialog.querySelector('[data-legal-jump-to-end]');
  if (
    !content
    || !(checkbox instanceof HTMLInputElement)
    || !confirm
    || !progress
    || !jumpToEnd
  ) return;

  const documents = [...content.querySelectorAll('[data-legal-document-name]')];
  const readDocuments = getConsentProgress(dialog);
  const contentBounds = content.getBoundingClientRect();
  documents.forEach((documentContent) => {
    const documentBounds = documentContent.getBoundingClientRect();
    if (documentBounds.bottom <= contentBounds.bottom + 2) {
      readDocuments.add(documentContent.dataset.legalDocumentName);
    }
  });

  const count = readDocuments.size;
  progress.textContent = `${count} de 2 lidos`;
  jumpToEnd.hidden = count >= documents.length;
  checkbox.disabled = count < 2;
  confirm.disabled = checkbox.disabled || !checkbox.checked;
}

export function jumpToNextUnreadLegalDocument(dialog) {
  if (dialog?.dataset.legalConsent !== 'true') return;
  const content = dialog.querySelector('[data-legal-dialog-content]');
  if (!content) return;
  const readDocuments = getConsentProgress(dialog);
  const nextDocument = [...content.querySelectorAll('[data-legal-document-name]')]
    .find((documentContent) => !readDocuments.has(documentContent.dataset.legalDocumentName));
  if (!nextDocument) return;

  const contentBounds = content.getBoundingClientRect();
  const documentBounds = nextDocument.getBoundingClientRect();
  content.scrollBy({
    top: Math.max(0, documentBounds.bottom - contentBounds.bottom),
    behavior: 'smooth',
  });
}
