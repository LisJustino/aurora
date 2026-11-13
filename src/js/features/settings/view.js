import { h, raw } from '../../utils/dom.js';
import { icon } from '../../utils/icons.js';

export function renderSettingsSegment(look, key, label, options, action = 'look') {
  return h`<div class="seg" role="group" aria-label="${label}">${options.map(([value, text, ic, sample]) => h`<button type="button" aria-pressed="${String(look[key]) === String(value)}" data-action="${action}" data-k="${key}" data-v="${value}">${ic ? icon(ic, 16) : ''}${sample ? h`<span class="appearance-font-sample appearance-font-sample-${value}" aria-hidden="true">Aa</span>` : ''}<span class="appearance-segment-label">${text}</span></button>`)}</div>`;
}

function renderSettingsStorageNotice(selectedTab, { integrityIssues, persistFailed, isOnline }) {
  if (selectedTab === 'data') return '';
  const integritySlices = Object.keys(integrityIssues);
  if (integritySlices.length) {
    return h`<div class="notice warn settings-storage-notice" role="alert"><span>Há dados inválidos em ${integritySlices.join(', ')}. A gravação está bloqueada para evitar perda; revise Dados e backup antes de continuar.</span><button type="button" class="btn sm" data-action="settings-section" data-settings-tab="data">Revisar dados</button></div>`;
  }
  const failedSlices = [...persistFailed];
  if (failedSlices.length) {
    return h`<div class="notice warn settings-storage-notice" role="alert"><span>Não foi possível salvar. Algumas alterações ainda não foram salvas.</span><button type="button" class="btn sm" data-action="persist-retry" ${isOnline ? '' : raw('disabled')}>Tentar novamente</button></div>`;
  }
  return '';
}

function renderSettingsSectionContent(s, p, selectedTab, renderers) {
  switch (selectedTab) {
    case 'personalization': return renderers.appearance(s);
    case 'home': return renderers.home(s);
    case 'areas-navigation': return renderers.areasNavigation(s);
    case 'data': return renderers.data(p);
    case 'calendars': return renderers.calendars();
    case 'mental-health': return h`<section class="card" aria-labelledby="mental-health-title">
      <div class="head"><div><h2 id="mental-health-title">${icon('heart', 20)} Apoio psicológico<i>.</i></h2><p>Você não precisa enfrentar momentos difíceis sem apoio. Estes recursos são voltados a pessoas no Brasil.</p></div></div>
      <h3>Onde buscar cuidado</h3>
      <p>Uma Unidade Básica de Saúde (UBS) pode acolher e orientar sobre atendimento psicológico pelo SUS. Os Centros de Atenção Psicossocial (CAPS) também oferecem cuidado em saúde mental.</p>
      <p><a class="inline-link" href="https://www.gov.br/saude/pt-br/composicao/saes/desmad/raps" target="_blank" rel="noopener noreferrer">Conheça a rede de atenção psicossocial do SUS</a></p>
      <h3>Acolhimento emocional</h3>
      <p>O CVV oferece escuta gratuita e sigilosa pelo telefone <a class="inline-link" href="tel:188">188</a>, 24 horas por dia, além de atendimento online.</p>
      <p><a class="inline-link" href="https://cvv.org.br/" target="_blank" rel="noopener noreferrer">Acessar o CVV</a></p>
      <h3>Em uma emergência</h3>
      <p>Se houver risco imediato, procure um serviço de emergência ou ligue para o SAMU pelo <a class="inline-link" href="tel:192">192</a>.</p>
      <p class="small muted">O Aurora não oferece atendimento psicológico e estas informações não substituem o acompanhamento profissional.</p>
    </section>`;
    case 'account': return renderers.account(s);
    default: return renderers.profile(s);
  }
}

function renderUnsavedSettingsBanner({ profileDraft, settingsDirty, saving }) {
  const dirty = Boolean(profileDraft) || settingsDirty;
  return h`<div class="settings-unsaved-bar" role="region" aria-label="Alterações não salvas" ${dirty ? '' : raw('hidden')}>
    <span>Alterações não salvas</span>
    <div class="settings-unsaved-actions">
      <button type="button" class="btn back" data-action="profile-discard" ${dirty && !saving ? '' : raw('disabled')}>Descartar alterações</button>
      <button type="button" class="btn primary" data-action="profile-save" aria-busy="${String(saving)}" ${dirty && !saving ? '' : raw('disabled')}>${saving ? 'Salvando...' : 'Salvar alterações'}</button>
    </div>
  </div>`;
}

export function renderSettingsView({
  S,
  ui,
  sections,
  sectionGroups,
  settingsTabId,
  tabLabel,
  pageTitle,
  storageNotice,
  settingsDirty,
  renderers,
}) {
  const s = S.settings;
  const p = s.prefs;
  const requestedTab = settingsTabId(ui.settingsTab);
  const selectedSection = sections.find(([id]) => id === requestedTab) || sections[0];
  const selected = selectedSection[0];
  const content = renderSettingsSectionContent(s, p, selected, renderers);
  const menuGroups = sectionGroups.map((group) => h`<div class="settings-menu-group"><span class="settings-menu-heading">${group.label}</span>${group.items.map((id) => {
    const section = sections.find(([item]) => item === id);
    if (!section) return '';
    const [key, label, ic, description] = section;
    return h`<a class="settings-link" href="/config?section=${encodeURIComponent(key)}" data-action="settings-section" data-settings-tab="${key}" aria-controls="settings-content" ${selected === key ? raw('aria-current="page"') : ''}><span class="settings-link-icon">${icon(ic, 19)}</span><span class="settings-link-copy"><b>${tabLabel(label)}</b><small>${description}</small></span>${icon('chevRight', 16, 'settings-link-arrow')}</a>`;
  })}</div>`);
  const unsavedBanner = renderUnsavedSettingsBanner({
    profileDraft: ui.profileDraft,
    settingsDirty,
    saving: ui.profileSaving || ui.settingsSaving,
  });
  return h`${pageTitle('Ajustes')}${storageNotice(selected)}${unsavedBanner}
    <div class="settings-layout">
      <nav class="settings-menu" aria-label="Opções de Ajustes">${menuGroups}</nav>
      <div class="settings-content" id="settings-content" role="region" aria-label="Seção de ajustes: ${selectedSection[1]}">${content}</div>
    </div>`;
}

export { renderSettingsStorageNotice };
