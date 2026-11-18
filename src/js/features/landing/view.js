import { iconSvg as demoIcon } from '../../utils/icons.js';
import { AREA_GUIDES } from '../area-guides.js';
import { renderPublicHeader } from '../appearance/public-controls.js';
import { initializeFaqDisclosure, renderFooterContent, renderSuggestionForm } from '../footer/view.js';
import { renderLandingDemo, stopLandingDemo } from './demo.js';

export { renderLandingDemo };

const landingControllers = new WeakMap();
const landingState = { tutorialArea: 'inicio', suggestion: {} };
const LANDING_TUTORIALS = [
  {
    id: 'inicio',
    title: 'Início',
    description: 'Veja o que ficou para hoje e os atalhos que você escolheu deixar na tela.',
    poster: AREA_GUIDES.inicio.poster,
    steps: ['O que aparece na tela inicial', 'Como marcar uma tarefa como feita', 'Como escolher os blocos que aparecem'],
  },
  {
    id: 'planejar',
    title: 'Planejar',
    description: 'Anote o que precisa fazer e escolha se quer olhar por lista, calendário ou semana.',
    poster: AREA_GUIDES.planejar.poster,
    steps: ['Anotar uma tarefa, prazo e prioridade', 'Mudar entre lista, calendário e semana', 'Usar busca e filtros para encontrar uma tarefa'],
  },
  {
    id: 'habitos',
    title: 'Hábitos',
    description: 'Acompanhe o que quer repetir e ajuste os dias quando a rotina mudar.',
    poster: AREA_GUIDES.habitos.poster,
    steps: ['Escolher os dias da semana', 'Marcar o que fez ou pular um dia', 'Acompanhar a sequência e a meta de água'],
  },
  {
    id: 'ciclo',
    title: 'Ciclo',
    description: 'Anote períodos e sintomas e consulte datas e médias. As estimativas podem variar.',
    poster: AREA_GUIDES.ciclo.poster,
    steps: ['Anotar o início e o fim do período', 'Registrar sintomas e observações', 'Consultar o calendário e as médias'],
  },
  {
    id: 'financas',
    title: 'Finanças',
    description: 'Anote contas, receitas e despesas para acompanhar o dinheiro que entra e sai.',
    poster: AREA_GUIDES.financas.poster,
    steps: ['Cadastrar uma conta', 'Anotar receitas e despesas', 'Registrar transferências e consultar relatórios'],
  },
];

function landingTutorialSources() {
  if (typeof window === 'undefined') return {};
  return Object.fromEntries(LANDING_TUTORIALS.map(({ id }) => [id, { mp4: AREA_GUIDES[id].video }]));
}

function publicHeader() {
  return renderPublicHeader();
}

function publicFooter({ demoAvailable = false } = {}) {
  return `<footer class="app-footer public-footer site-footer">${renderFooterContent({ demoAvailable, includeFaq: false })}</footer>`;
}

export function renderLanding(root) {
  landingControllers.get(root)?.();
  stopLandingDemo(root);
  document.title = 'aurora. — tarefas, hábitos, finanças e ciclo';
  if (!root.querySelector?.('.public-site[data-prerendered]')) root.innerHTML = landingMarkup();
  initializeSuggestionFormState(root);
  initializeLandingTutorials(root);
  initializeFaqDisclosure(root);
  initializeSuggestionDisclosure(root);
}

function initializeSuggestionDisclosure(root) {
  const disclosure = root.querySelector('[data-suggestion-disclosure]');
  const summary = disclosure?.querySelector(':scope > summary');
  if (!disclosure || !summary || typeof window === 'undefined') return;

  const openSuggestion = () => {
    disclosure.open = true;
    summary.focus({ preventScroll: true });
  };
  const onHashChange = () => {
    if (window.location.hash === `#${disclosure.id}`) openSuggestion();
  };

  window.addEventListener('hashchange', onHashChange);
  if (window.location.hash === `#${disclosure.id}`) openSuggestion();

  const previousCleanup = landingControllers.get(root);
  landingControllers.set(root, () => {
    previousCleanup?.();
    window.removeEventListener('hashchange', onHashChange);
  });
}

function initializeLandingTutorials(root) {
  const section = root.querySelector('[data-landing-tutorials]');
  if (!section) return;
  const tabs = [...section.querySelectorAll('[data-landing-tutorial-tab]')];
  const panels = [...section.querySelectorAll('[data-landing-tutorial-panel]')];
  if (!tabs.length || tabs.length !== panels.length) return;
  let sources = null;
  const prepareVideo = (panel) => {
    if (!panel) return;
    if (!sources) sources = landingTutorialSources();
    const areaSources = sources[panel.dataset.landingTutorialPanel];
    const video = panel.querySelector('video');
    if (!areaSources || !video || video.dataset.tutorialLoaded === 'true') return;
    video.poster = panel.dataset.tutorialPoster;
    panel.querySelectorAll('[data-tutorial-source]').forEach((source) => {
      const url = areaSources[source.dataset.tutorialSource];
      if (url) source.src = url;
    });
    video.dataset.tutorialLoaded = 'true';
    video.load();
  };
  const selectArea = (area, loadVideo = false) => {
    const activeTab = tabs.find((tab) => tab.dataset.landingTutorialTab === area);
    if (!activeTab) return;
    tabs.forEach((tab) => {
      const selected = tab === activeTab;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    panels.forEach((panel) => {
      panel.hidden = panel.dataset.landingTutorialPanel !== area;
      const video = panel.querySelector('video');
      if (panel.hidden && video && !video.paused) video.pause();
    });
    const activePanel = panels.find((panel) => panel.dataset.landingTutorialPanel === area);
    if (activePanel) activePanel.querySelector('video').poster = activePanel.dataset.tutorialPoster;
    if (loadVideo) prepareVideo(panels.find((panel) => panel.dataset.landingTutorialPanel === area));
    landingState.tutorialArea = area;
  };
  const playVideo = async (button) => {
    const panel = button.closest('[data-landing-tutorial-panel]');
    const video = panel?.querySelector('video');
    const status = panel?.querySelector('[data-landing-tutorial-status]');
    if (!panel || !video || !status) return;
    prepareVideo(panel);
    status.hidden = true;
    try {
      await video.play();
    } catch {
      status.textContent = 'Não foi possível iniciar o vídeo. Tente novamente pelos controles.';
      status.hidden = false;
    }
  };
  const onClick = (event) => {
    if (!(event.target instanceof Element)) return;
    const playButton = event.target.closest('[data-landing-tutorial-play]');
    if (playButton && section.contains(playButton)) {
      void playVideo(playButton);
      return;
    }
    const tab = event.target.closest('[data-landing-tutorial-tab]');
    if (tab && tabs.includes(tab)) selectArea(tab.dataset.landingTutorialTab, true);
  };
  const onKeyDown = (event) => {
    if (!(event.target instanceof Element)) return;
    const tab = event.target.closest('[data-landing-tutorial-tab]');
    const index = tabs.indexOf(tab);
    if (index < 0) return;
    const nextIndex = event.key === 'ArrowRight'
      ? (index + 1) % tabs.length
      : event.key === 'ArrowLeft'
        ? (index - 1 + tabs.length) % tabs.length
        : event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? tabs.length - 1
            : -1;
    if (nextIndex < 0) return;
    event.preventDefault();
    const nextTab = tabs[nextIndex];
    selectArea(nextTab.dataset.landingTutorialTab, true);
    nextTab.focus();
  };
  const videoListeners = [];
  panels.forEach((panel) => {
    const video = panel.querySelector('video');
    const playButton = panel.querySelector('[data-landing-tutorial-play]');
    const status = panel.querySelector('[data-landing-tutorial-status]');
    if (!video || !playButton || !status) return;
    const showPlayButton = () => { playButton.hidden = false; };
    const hidePlayButton = () => { playButton.hidden = true; };
    const showVideoError = () => {
      status.textContent = 'Este vídeo não pode ser reproduzido neste navegador.';
      status.hidden = false;
    };
    video.addEventListener('playing', hidePlayButton);
    video.addEventListener('pause', showPlayButton);
    video.addEventListener('error', showVideoError);
    videoListeners.push(
      [video, 'playing', hidePlayButton],
      [video, 'pause', showPlayButton],
      [video, 'error', showVideoError],
    );
  });
  section.addEventListener('click', onClick);
  section.addEventListener('keydown', onKeyDown);
  const previousCleanup = landingControllers.get(root);
  landingControllers.set(root, () => {
    previousCleanup?.();
    section.removeEventListener('click', onClick);
    section.removeEventListener('keydown', onKeyDown);
    section.querySelectorAll('video').forEach((video) => video.pause());
    videoListeners.forEach(([video, type, listener]) => video.removeEventListener(type, listener));
  });
  selectArea(landingState.tutorialArea);
}

function initializeSuggestionFormState(root) {
  if (typeof root.addEventListener !== 'function') return;
  const suggestion = root.querySelector('[data-footer-suggestion]');
  if (suggestion) {
    for (const [name, value] of Object.entries(landingState.suggestion)) {
      const field = suggestion.elements.namedItem(name);
      if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) field.value = value;
    }
  }
  const onInput = (event) => {
    const field = event.target;
    if ((field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement)
      && field.form === suggestion && field.name) {
      landingState.suggestion[field.name] = field.value;
    }
  };
  root.addEventListener('input', onInput);
  const previousCleanup = landingControllers.get(root);
  landingControllers.set(root, () => {
    previousCleanup?.();
    root.removeEventListener?.('input', onInput);
  });
}

export function landingMarkup() {
  const activeTutorialArea = LANDING_TUTORIALS.some(({ id }) => id === landingState.tutorialArea)
    ? landingState.tutorialArea
    : 'inicio';
  return `
    <div class="public-site">
      <a class="skip" href="#landing-main" data-public-action="skip">Pular para o conteúdo principal</a>
      ${publicHeader()}
      <main class="public-main" id="landing-main" tabindex="-1">
        <section class="public-hero public-hero-card" aria-labelledby="landing-title">
          <div class="public-copy">
            <p class="public-eyebrow">Quando tem coisa demais na cabeça</p>
            <h1 id="landing-title">Vamos por partes<span>.</span></h1>
            <p class="public-subtitle">Anote o que está pendente. Escolha o que cabe hoje e deixe o resto para depois. Tarefas, hábitos, finanças e ciclo ficam aqui.</p>
            <div class="public-actions">
              <a class="btn primary large" href="/demonstracao" data-public-action="demo">Ver demonstração</a>
            </div>
            <p class="public-price-note">É grátis e dá para experimentar sem criar conta. A demonstração usa dados de exemplo e nada fica salvo.</p>
          </div>
          <figure class="product-preview">
            <picture>
              <source srcset="/screenshots/demo-mobile.png" media="(max-width: 700px)" width="390" height="844">
              <img class="public-product-capture" src="/screenshots/demo-wide.png" width="1280" height="720" alt="Tela da demonstração interativa do Aurora, com dados fictícios." fetchpriority="high">
            </picture>
            <figcaption>Captura real da demonstração, com dados fictícios.</figcaption>
          </figure>
        </section>

        <section class="public-tutorials" id="public-tutorials" aria-labelledby="public-tutorials-title" data-landing-tutorials>
          <div class="public-section-heading">
            <p class="public-eyebrow">Se quiser, dá uma olhada</p>
            <h2 id="public-tutorials-title">Veja como funciona</h2>
            <p class="public-section-lead">Escolha uma área. As etapas também estão descritas abaixo.</p>
          </div>
          <div class="landing-tutorial-tabs" role="tablist" aria-label="Escolha o que quer ver">
            ${LANDING_TUTORIALS.map((area) => {
              const selected = area.id === activeTutorialArea;
              return `<button type="button" class="landing-tutorial-tab" role="tab" id="landing-tutorial-tab-${area.id}" aria-controls="landing-tutorial-panel-${area.id}" aria-selected="${selected}" tabindex="${selected ? '0' : '-1'}" data-landing-tutorial-tab="${area.id}" data-area="${area.id}">${area.title}</button>`;
            }).join('')}
          </div>
          <div class="landing-tutorial-panels">
            ${LANDING_TUTORIALS.map((area) => {
              const selected = area.id === activeTutorialArea;
              return `<section class="landing-tutorial-panel" role="tabpanel" id="landing-tutorial-panel-${area.id}" aria-labelledby="landing-tutorial-tab-${area.id}" tabindex="0" data-landing-tutorial-panel="${area.id}" data-tutorial-poster="${area.poster}" data-area="${area.id}"${selected ? '' : ' hidden'}>
                <div class="landing-tutorial-frame">
                <video class="landing-tutorial-video" width="1280" height="720" controls preload="none" muted playsinline aria-label="Demonstração em vídeo: ${area.title}">
                  <source data-tutorial-source="mp4" type="video/mp4">
                </video>
                <button type="button" class="landing-tutorial-play" data-landing-tutorial-play aria-label="Carregar e reproduzir o vídeo de ${area.title}">${demoIcon('play', 24)}<span>Reproduzir vídeo</span></button>
                </div>
                <div class="landing-tutorial-summary" data-tutorial-summary>
                  <h3>Prefere ler?</h3>
                  <p class="landing-tutorial-transcript-note">O vídeo não tem narração. Aqui estão as etapas, por escrito.</p>
                  <ul>${area.steps.map((step) => `<li>${step}</li>`).join('')}</ul>
                </div>
                <p class="landing-tutorial-status" data-landing-tutorial-status role="status" aria-live="polite" hidden></p>
                <p class="landing-tutorial-description">${area.description}</p>
              </section>`;
            }).join('')}
          </div>
        </section>
        <section class="public-trust" aria-labelledby="public-trust-title">
          <div class="public-section-heading">
            <p class="public-eyebrow">Transparência e confiança</p>
            <h2 id="public-trust-title">Você decide o que registrar</h2>
            <p class="public-section-lead">Veja onde os dados ficam, como levar uma cópia ou excluir sua conta e o que esperar sem conexão.</p>
          </div>
          <div class="public-trust-copy">
            <p>Os registros da sua conta ficam no Supabase, associados ao seu usuário e protegidos por regras de acesso. O navegador não é o armazenamento principal; sessões e cópias antigas do app são exceções. Os registros relacionais não usam criptografia de ponta a ponta. <a href="/privacy.html">Leia a Política de Privacidade</a>.</p>
            <p>Em Ajustes → Dados e backup, baixe uma cópia dos seus registros. Em Ajustes → Seu perfil, você pode iniciar a exclusão da conta e dos dados. Cópias baixadas ficam sob seu controle.</p>
            <p>Algumas telas que já abriram podem continuar disponíveis sem conexão. Entrar e salvar exigem conexão; alterações feitas offline não ficam aguardando sincronização automática.</p>
          </div>
        </section>

        <section class="public-closing" aria-labelledby="public-closing-title">
          <section class="public-cta-panel" aria-labelledby="public-closing-title">
            <div class="public-cta-copy">
              <p class="public-eyebrow">Se quiser</p>
              <h2 id="public-closing-title">Deixe o Aurora por perto</h2>
              <p>Instale no celular para abrir o Aurora pela tela inicial.</p>
              <ul class="public-install-note">
                <li><strong>Android:</strong> toque em “Instalar no celular” e siga as etapas.</li>
                <li><strong>iPhone:</strong> no Safari, toque em Compartilhar e depois em Adicionar à Tela de Início.</li>
              </ul>
            </div>
            <div class="public-actions">
              <button class="btn primary" type="button" data-action="pwa-install">Instalar no celular</button>
            </div>
          </section>
        </section>
        <section class="public-community" aria-labelledby="public-community-title">
          <div class="public-community-copy">
            <p class="public-eyebrow">Se algo não encaixar</p>
            <h2 id="public-community-title">Conta pra gente</h2>
            <p>O que ficou faltando? O que atrapalhou? Você pode mandar uma ideia.</p>
          </div>
          <details class="public-suggestion" id="public-suggestion" data-suggestion-disclosure>
            <summary>Mandar uma ideia</summary>
            ${renderSuggestionForm()}
          </details>
        </section>
        <section class="public-faq" id="public-faq" aria-labelledby="public-faq-title">
          <div class="public-section-heading">
            <p class="public-eyebrow">Antes de começar</p>
            <h2 id="public-faq-title">Dúvidas comuns</h2>
          </div>
          <div class="public-faq-list compact-card-grid">
            <details class="public-faq-item">
              <summary>O Aurora é grátis?</summary>
              <p>Sim. É grátis, e você não precisa informar cartão.</p>
            </details>
            <details class="public-faq-item">
              <summary>Posso experimentar sem criar conta?</summary>
              <p>Sim. A demonstração usa dados de exemplo. Você pode adicionar uma tarefa e marcar um hábito, mas as mudanças não ficam guardadas quando você sai.</p>
            </details>
            <details class="public-faq-item">
              <summary>Funciona no celular?</summary>
              <p>Sim. Funciona pelo navegador do celular. Se preferir, você pode deixar um atalho na tela inicial.</p>
            </details>
            <details class="public-faq-item">
              <summary>O Aurora se conecta ao meu banco?</summary>
              <p>Não. O Aurora não acessa sua conta bancária. Você anota cada receita, despesa ou cartão.</p>
            </details>
            <details class="public-faq-item">
              <summary>O que posso fazer em Ciclo?</summary>
              <p>Com seu consentimento, você pode anotar datas e sintomas. É um acompanhamento informativo, não substitui orientação de um profissional de saúde.</p>
            </details>
          </div>
        </section>
      </main>
      ${publicFooter({ demoAvailable: true })}
      <a class="public-mobile-cta btn primary" href="/demonstracao" data-public-action="demo" hidden>Ver demonstração</a>
    </div>`;
}
