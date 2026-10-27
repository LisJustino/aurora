export async function loadHtmlTemplate(url, featureName) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Falha ao carregar o template de ${featureName} (HTTP ${response.status}).`);
  }
  return response.text();
}

export function renderHtmlTemplate(template, slots, featureName) {
  const rendered = template.replace(/\{\{([a-z-]+)\}\}/g, (placeholder, name) => {
    if (!Object.prototype.hasOwnProperty.call(slots, name)) {
      throw new Error(`Slot não fornecido no template de ${featureName}: ${name}.`);
    }
    if (typeof slots[name] !== 'string') {
      throw new Error(`O slot do template de ${featureName} precisa ser HTML serializado: ${name}.`);
    }
    return slots[name];
  });
  if (/\{\{[^}]+\}\}/.test(rendered)) {
    throw new Error(`O template de ${featureName} contém slots não resolvidos.`);
  }
  return rendered;
}
