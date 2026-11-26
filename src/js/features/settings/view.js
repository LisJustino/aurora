import { h, raw } from '../../utils/dom.js';
import { routePathFor } from '../../core/router.js';
import { icon } from '../../utils/icons.js';

export function renderSettingsSegment(look, key, label, options, action = 'look') {
  return h`<div class="seg" role="group" aria-label="${label}">${options.map(
    ([value, text, ic, sample]) => h`<button
    type="button" aria-pressed="${String(look[key]) === String(value)}" data-action="${action}" data-k="${key}"
    data-v="${value}">${ic ? icon(ic, 16) : ''}${
      sample
        ? h`<span
    class="appearance-font-sample appearance-font-sample-${value}" aria-hidden="true">Aa</span>`
        : ''
    }<span
    class="appearance-segment-label">${text}</span></button>`,
  )}</div>`;
}

function renderSettingsSectionContent(s, p, selectedTab, renderers) {
  switch (selectedTab) {
    case 'personalization':
      return renderers.appearance(s);
    case 'home':
      return renderers.home(s);
    case 'areas-navigation':
      return renderers.areasNavigation(s);
    case 'data':
      return renderers.data(p);
    case 'calendars':
      return renderers.calendars();
    case 'mental-health':
      return h`<section class="surface-open mental-health-support" aria-labelledby="mental-health-title">
      <div class="mental-health-hero">
        <span class="mental-health-mark" aria-hidden="true">${icon('heart', 24)}</span>
        <div>
          <p class="section-kicker">Um espaço de cuidado</p>
          <h2 id="mental-health-title">Você não precisa passar por isso sozinho.</h2>
          <p>Pedir apoio também é um jeito de cuidar de si. Quando estiver difícil, escolher o próximo passo pode começar em pequenos gestos.</p>
        </div>
      </div>
      <div class="mental-health-resource-grid">
        <article class="mental-health-resource mental-health-resource-primary">
          <span class="mental-health-resource-mark" aria-hidden="true">${icon('heart', 20)}</span>
          <div>
            <h3>Falar com alguém agora</h3>
            <p>O CVV oferece escuta gratuita e sigilosa por telefone ou online, todos os dias, a qualquer hora.</p>
          </div>
          <div class="mental-health-actions">
            <a class="btn primary sm" href="tel:188">${icon('phone', 16)} Ligar 188</a>
            <a class="btn ghost sm" href="https://cvv.org.br/" target="_blank"
              rel="noopener noreferrer">Conversar pelo site</a>
          </div>
        </article>
        <article class="mental-health-resource">
          <span class="mental-health-resource-mark" aria-hidden="true">${icon('activity', 20)}</span>
          <div>
            <h3>Buscar cuidado na saúde pública</h3>
            <p>Uma UBS pode acolher e orientar sobre atendimento pelo SUS. Os CAPS oferecem cuidado especializado em saúde mental.</p>
          </div>
          <a class="btn ghost sm" href="https://www.gov.br/saude/pt-br/composicao/saes/desmad/raps" target="_blank"
            rel="noopener noreferrer">Conhecer a rede do SUS</a>
        </article>
      </div>
      <article class="mental-health-emergency">
        <span class="mental-health-resource-mark" aria-hidden="true">${icon('alert', 20)}</span>
        <div>
          <h3>Se houver risco imediato</h3>
          <p>Procure uma emergência ou peça ajuda de alguém próximo. Se houver risco à vida, ligue para o SAMU pelo 192.</p>
        </div>
        <a class="btn sm" href="tel:192">${icon('phone', 16)} Ligar 192</a>
      </article>
      <p class="mental-health-disclaimer">O Aurora não oferece atendimento psicológico. Estas informações são um caminho de apoio e não substituem acompanhamento profissional.</p>
    </section>`;
    case 'account':
      return renderers.account(s);
    default:
      return renderers.profile(s);
  }
}

export function renderSettingsView({ S, ui, sections, sectionGroups, settingsTabId, tabLabel, pageTitle, renderers }) {
  const s = S.settings;
  const p = s.prefs;
  const requestedTab = settingsTabId(ui.settingsTab);
  const selectedSection = sections.find(([id]) => id === requestedTab) || sections[0];
  const selected = selectedSection[0];
  const content = renderSettingsSectionContent(s, p, selected, renderers);
  const menuGroups = sectionGroups.map(
    (group) =>
      h`<div class="settings-menu-group"><span class="settings-menu-heading">${group.label}</span>${group.items.map(
        (id) => {
          const section = sections.find(([item]) => item === id);
          if (!section) return '';
          const [key, label, ic, description] = section;
          return h`<a class="settings-link" href="${routePathFor(`config?section=${encodeURIComponent(key)}`)}"
            data-action="settings-section" data-settings-tab="${key}"
            aria-controls="settings-content" ${selected === key ? raw('aria-current="page"') : ''}><span
            class="settings-link-icon">${icon(ic, 19)}</span><span
            class="settings-link-copy"><b>${tabLabel(label)}</b><small>${description}</small></span>${icon('chevRight', 16, 'settings-link-arrow')}</a>`;
        },
      )}</div>`,
  );
  return h`${pageTitle('Ajustes')}
    <div class="settings-layout">
      <nav class="settings-menu" aria-label="Opções de Ajustes">${menuGroups}</nav>
      <div class="settings-content" id="settings-content" role="region"
        aria-label="Seção de ajustes: ${selectedSection[1]}">${content}</div>
    </div>`;
}
