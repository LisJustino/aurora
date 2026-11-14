import { iconSvg as demoIcon } from '../../utils/icons.js';
import { renderPublicHeader } from '../appearance/public-controls.js';
import { initializeFaqDisclosure, renderFooterContent, renderSuggestionForm } from '../footer/view.js';
import { renderLandingDemo, stopLandingDemo } from './demo.js';

const phoneBrandLogo = new URL('../../../../icons/favicon.svg', import.meta.url).href;

export { renderLandingDemo };

const landingControllers = new WeakMap();
const landingState = { tasks: null, area: 0, tutorialArea: 'inicio', suggestion: {} };
const LANDING_TUTORIALS = [
  {
    id: 'inicio',
    title: 'Início',
    description: 'Veja o resumo do dia, os atalhos e os próximos passos na tela inicial.',
  },
  {
    id: 'planejar',
    title: 'Planejar',
    description: 'Acompanhe tarefas por prazo e alterne entre lista, calendário e semana.',
  },
  {
    id: 'habitos',
    title: 'Hábitos',
    description: 'Marque seus hábitos, revise a sequência e acompanhe a meta de água.',
  },
  {
    id: 'ciclo',
    title: 'Ciclo',
    description: 'Registre períodos e sintomas e consulte a visão do calendário.',
  },
  {
    id: 'financas',
    title: 'Finanças',
    description: 'Cadastre contas e lançamentos manuais para acompanhar suas movimentações.',
  },
];
const LANDING_VIDEO_POSTER = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 540"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#29233a"/><stop offset="1" stop-color="#76506b"/></linearGradient></defs><rect width="960" height="540" fill="url(#g)"/><circle cx="480" cy="270" r="52" fill="#fff"/><path d="M466 242v56l48-28z" fill="#57405d"/></svg>',
)}`;

function landingTutorialSources() {
  if (typeof window === 'undefined') return {};
  return {
    inicio: {
      mp4: new URL('../../../assets/tutorials/inicio.mp4', import.meta.url).href,
      webm: new URL('../../../assets/tutorials/inicio.webm', import.meta.url).href,
    },
    planejar: {
      mp4: new URL('../../../assets/tutorials/planejar.mp4', import.meta.url).href,
      webm: new URL('../../../assets/tutorials/planejar.webm', import.meta.url).href,
    },
    habitos: {
      mp4: new URL('../../../assets/tutorials/habitos.mp4', import.meta.url).href,
      webm: new URL('../../../assets/tutorials/habitos.webm', import.meta.url).href,
    },
    ciclo: {
      mp4: new URL('../../../assets/tutorials/ciclo.mp4', import.meta.url).href,
      webm: new URL('../../../assets/tutorials/ciclo.webm', import.meta.url).href,
    },
    financas: {
      mp4: new URL('../../../assets/tutorials/financas.mp4', import.meta.url).href,
      webm: new URL('../../../assets/tutorials/financas.webm', import.meta.url).href,
    },
  };
}

function publicHeader() {
  return renderPublicHeader();
}

function publicFooter({ demoAvailable = false } = {}) {
  return `<footer class="app-footer public-footer site-footer">${renderFooterContent({ demoAvailable, includeFaq: false, pwaInstall: true })}</footer>`;
}

export function renderLanding(root) {
  landingControllers.get(root)?.();
  stopLandingDemo(root);
  document.title = 'aurora. — tarefas, hábitos, finanças e ciclo';
  if (!root.querySelector?.('.public-site[data-prerendered]')) root.innerHTML = landingMarkup();
  initializeLandingTaskMock(root);
  initializeAreaSelector(root);
  initializeLandingTutorials(root);
  initializeFaqDisclosure(root);
}

function initializeAreaSelector(root) {
  const selector = root.querySelector('[data-area-selector]');
  const cards = [...root.querySelectorAll('.public-values > .public-value')];
  if (!selector || cards.length === 0) return;
  const buttons = [...selector.querySelectorAll('button')];
  if (buttons.length !== cards.length) return;
  const media = window.matchMedia('(max-width: 700px)');
  let selected = landingState.area;
  const update = () => {
    selector.hidden = !media.matches;
    cards.forEach((card, index) => {
      card.hidden = media.matches && index !== selected;
    });
    buttons.forEach((button, index) => {
      button.setAttribute('aria-pressed', String(index === selected));
    });
  };
  const onClick = (event) => {
    const button = event.target.closest('button');
    const index = buttons.indexOf(button);
    if (index < 0) return;
    selected = index;
    landingState.area = index;
    update();
  };
  selector.addEventListener('click', onClick);
  media.addEventListener('change', update);
  const previousCleanup = landingControllers.get(root);
  landingControllers.set(root, () => {
    previousCleanup?.();
    selector.removeEventListener('click', onClick);
    media.removeEventListener('change', update);
  });
  update();
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

function initializeLandingTaskMock(root) {
  if (typeof root.addEventListener !== 'function') return;
  const tasks = [...root.querySelectorAll('[data-landing-task]')];
  if (landingState.tasks?.length === tasks.length) {
    tasks.forEach((task, index) => task.setAttribute('aria-pressed', String(landingState.tasks[index])));
  }
  const updateTasks = () => {
    const nextTask = tasks.find((task) => task.getAttribute('aria-pressed') !== 'true');
    let completed = 0;
    tasks.forEach((task) => {
      const done = task.getAttribute('aria-pressed') === 'true';
      completed += Number(done);
      task.classList.toggle('is-done', done);
      task.classList.toggle('is-current', !done && task === nextTask);
      const status = task.querySelector('small');
      if (status) status.textContent = done ? 'Concluída' : task === nextTask ? 'Seu próximo passo' : 'Hoje';
    });

    const summary = root.querySelector('[data-preview-task-summary]');
    if (summary) summary.textContent = `${completed} de ${tasks.length} feitas`;
    const count = root.querySelector('[data-preview-task-count]');
    if (count) count.textContent = String(tasks.length);
    const progress = root.querySelector('.preview-task-progress i');
    if (progress) progress.style.width = `${tasks.length ? (completed / tasks.length) * 100 : 0}%`;
    const group = root.querySelector('[data-landing-task-group]');
    group?.setAttribute('aria-label', `${completed} de ${tasks.length} tarefas de exemplo concluídas`);
  };
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
  const onClick = (event) => {
    if (!(event.target instanceof Element)) return;
    const clickedTask = event.target.closest('[data-landing-task]');
    if (!(clickedTask instanceof HTMLButtonElement)) return;
    clickedTask.setAttribute('aria-pressed', String(clickedTask.getAttribute('aria-pressed') !== 'true'));
    landingState.tasks = tasks.map((task) => task.getAttribute('aria-pressed') === 'true');
    updateTasks();
  };
  root.addEventListener('click', onClick);
  root.addEventListener('input', onInput);
  const previousCleanup = landingControllers.get(root);
  landingControllers.set(root, () => {
    previousCleanup?.();
    root.removeEventListener?.('click', onClick);
    root.removeEventListener?.('input', onInput);
  });
  if (tasks.length) updateTasks();
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
            <p class="public-eyebrow"><span aria-hidden="true"></span> Um planner independente para a vida real</p>
            <h1 id="landing-title">Menos ruído. Mais clareza no dia<span>.</span></h1>
            <p class="public-subtitle">Organize tarefas, hábitos, finanças e ciclo no seu ritmo, com clareza para o que importa hoje e sem culpa.</p>
            <div class="public-actions">
              <a class="btn primary large" href="/criar-conta" data-public-action="signup">Criar conta grátis</a>
              <a class="btn large" href="/demonstracao" data-public-action="demo">Conhecer o Aurora</a>
            </div>
            <p class="public-price-note">A demonstração usa dados fictícios e não salva suas mudanças.</p>
            <p class="public-account-note">Já tem conta? <a href="/entrar" data-public-action="login">Entre com Google</a></p>
          </div>
          <figure class="product-preview" aria-label="Prévia visual das áreas do Aurora">
            <div class="preview-phone">
              <div class="preview-phone-screen">
                <div class="preview-phone-status" aria-hidden="true">
                  <span>9:41</span>
                  <span class="preview-phone-island"><i></i></span>
                  <span class="preview-phone-status-icons">
                    <span class="preview-phone-signal"><i></i><i></i><i></i><i></i></span>
                    <span class="preview-phone-battery"><i></i></span>
                  </span>
                </div>
                <span class="preview-phone-brand"><img class="preview-phone-logo" src="${phoneBrandLogo}" alt="" width="24" height="24"><span class="preview-phone-wordmark">aurora<span>.</span></span></span>
                <span class="preview-phone-title">Seu dia, com calma.</span>
                <div class="preview-tasks" role="group" data-landing-task-group aria-label="2 de 3 tarefas de exemplo concluídas">
                  <span class="preview-task-heading">Para hoje <b data-preview-task-count>3</b><small data-preview-task-summary aria-live="polite">2 de 3 feitas</small></span>
                  <span class="preview-task-progress"><i></i></span>
                  <button type="button" class="preview-task-row is-done" data-landing-task data-preview-area="planner" aria-pressed="true" aria-label="Organizar a semana"><i aria-hidden="true">✓</i><span><b>Organizar a semana</b><small>Concluída</small></span></button>
                  <button type="button" class="preview-task-row is-done" data-landing-task data-preview-area="habits" aria-pressed="true" aria-label="Responder mensagem"><i aria-hidden="true">✓</i><span><b>Responder mensagem</b><small>Concluída</small></span></button>
                  <button type="button" class="preview-task-row is-current" data-landing-task data-preview-area="finances" aria-pressed="false" aria-label="Ler por alguns minutos"><i aria-hidden="true">✓</i><span><b>Ler por alguns minutos</b><small>Seu próximo passo</small></span></button>
                </div>
                <div class="preview-phone-nav" aria-hidden="true">
                  <span class="is-current preview-nav-home">${demoIcon('home', 15)}Início</span>
                  <span class="preview-nav-planner">${demoIcon('calendarCheck', 15)}Planejar</span>
                  <span class="preview-nav-habits">${demoIcon('leaf', 15)}Hábitos</span>
                  <span class="preview-nav-cycle">${demoIcon('heart', 15)}Ciclo</span>
                  <span class="preview-nav-finances">${demoIcon('wallet', 15)}Finanças</span>
                </div>
              </div>
            </div>
          </figure>
        </section>
        <section class="public-features" id="public-features" aria-labelledby="public-features-title">
          <div class="public-section-heading"><p class="public-eyebrow">Feito para a vida como ela é</p><h2 id="public-features-title">Escolha por onde começar</h2><p class="public-section-lead">Cada espaço cuida de uma parte do seu dia. Você usa só o que fizer sentido agora.</p></div>
          <div class="public-area-selector" data-area-selector role="group" aria-label="Escolha uma área para conhecer" hidden>
            <button type="button" aria-pressed="true">Planejar</button>
            <button type="button" aria-pressed="false">Hábitos</button>
            <button type="button" aria-pressed="false">Finanças</button>
            <button type="button" aria-pressed="false">Ciclo</button>
          </div>
          <div class="public-values" role="group" aria-label="Demonstração visual das quatro áreas">
          <article class="card public-value">
            <span class="public-value-icon" aria-hidden="true">${demoIcon('calendarCheck', 22)}</span>
            <div><h3>Planejar</h3><p>Organize tarefas e prazos; acompanhe o que já foi concluído.</p></div>
            <div class="public-value-preview preview-area-planner" aria-hidden="true">
              <span class="preview-mini-heading">HOJE <b>3</b><small>2 de 3 feitas</small></span>
              <span class="preview-mini-progress"><i></i></span>
              <span class="preview-mini-task is-done"><i>✓</i>Organizar a semana</span>
              <span class="preview-mini-task is-done"><i>✓</i>Responder uma mensagem</span>
              <span class="preview-mini-task"><i></i>Ler por alguns minutos</span>
            </div>
          </article>
          <article class="card public-value">
            <span class="public-value-icon" aria-hidden="true">${demoIcon('leaf', 22)}</span>
            <div><h3>Hábitos</h3><p>Registre check-ins e metas semanais com espaço para ajustar o plano à sua rotina.</p></div>
            <div class="public-value-preview preview-area-habits" aria-hidden="true">
              <span class="preview-mini-heading">Beber água <small>5/7</small></span>
              <span class="preview-habit-days"><i>Seg</i><i>Ter</i><i>Qua</i><i>Qui</i><i>Sex</i><i>Sáb</i><i>Dom</i></span>
              <span class="preview-habit-dots"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span>
              <span class="preview-mini-heading">Ler 10 minutos <small>3/5</small></span>
              <span class="preview-habit-days is-short"><i>Seg</i><i>Ter</i><i>Qua</i><i>Qui</i><i>Sex</i></span>
              <span class="preview-habit-dots is-short"><i></i><i></i><i></i><i></i><i></i></span>
            </div>
          </article>
          <article class="card public-value">
            <span class="public-value-icon" aria-hidden="true">${demoIcon('wallet', 22)}</span>
            <div><h3>Finanças</h3><p>Registre receitas, despesas e cartões manualmente. O Aurora não se conecta a bancos.</p></div>
            <div class="public-value-preview preview-area-finance" aria-hidden="true">
              <div><small>Receitas</small><strong>R$ 3.200</strong></div>
              <div><small>Despesas</small><strong>R$ 1.960</strong></div>
              <span class="preview-finance-bars"><i></i><i></i><i></i><i></i><i></i><i></i></span>
            </div>
          </article>
          <article class="card public-value">
            <span class="public-value-icon" aria-hidden="true">${demoIcon('heart', 22)}</span>
            <div><h3>Ciclo</h3><p>Com consentimento específico, acompanhe períodos e sintomas. As informações são gerais e não substituem orientação profissional.</p></div>
            <div class="public-value-preview preview-area-cycle">
              <span class="preview-cycle-week"><i>S</i><i>T</i><i>Q</i><i>Q</i><i>S</i><i>S</i><i>D</i></span>
              <span class="preview-cycle-days"><i>2</i><i class="is-period">3</i><i class="is-period">4</i><i class="is-period">5</i><i>6</i><i>7</i><i>8</i></span>
              <span class="preview-cycle-note">${demoIcon('lock', 13)}Acesso restrito à sua conta</span>
              <a class="preview-cycle-privacy" href="/privacy" target="_blank" rel="noopener noreferrer">Saiba mais na Política de Privacidade</a>
            </div>
          </article>
          </div>
        </section>
        <section class="public-tutorials" aria-labelledby="public-tutorials-title" data-landing-tutorials>
          <div class="public-section-heading">
            <p class="public-eyebrow">Veja por dentro</p>
            <h2 id="public-tutorials-title">Veja cada área funcionando</h2>
            <p class="public-section-lead">Escolha uma área para conhecer o Aurora em ação.</p>
          </div>
          <div class="landing-tutorial-tabs" role="tablist" aria-label="Áreas do Aurora">
            ${LANDING_TUTORIALS.map((area) => {
              const selected = area.id === activeTutorialArea;
              return `<button type="button" class="landing-tutorial-tab" role="tab" id="landing-tutorial-tab-${area.id}" aria-controls="landing-tutorial-panel-${area.id}" aria-selected="${selected}" tabindex="${selected ? '0' : '-1'}" data-landing-tutorial-tab="${area.id}" data-area="${area.id}">${area.title}</button>`;
            }).join('')}
          </div>
          <div class="landing-tutorial-panels">
            ${LANDING_TUTORIALS.map((area) => {
              const selected = area.id === activeTutorialArea;
              return `<section class="landing-tutorial-panel" role="tabpanel" id="landing-tutorial-panel-${area.id}" aria-labelledby="landing-tutorial-tab-${area.id}" tabindex="0" data-landing-tutorial-panel="${area.id}" data-area="${area.id}"${selected ? '' : ' hidden'}>
                <div class="landing-tutorial-frame">
                <video class="landing-tutorial-video" controls preload="none" muted playsinline poster="${LANDING_VIDEO_POSTER}" aria-label="Demonstração em vídeo: ${area.title}">
                  <source data-tutorial-source="mp4" type="video/mp4">
                  <source data-tutorial-source="webm" type="video/webm">
                </video>
                <button type="button" class="landing-tutorial-play" data-landing-tutorial-play aria-label="Carregar e reproduzir o vídeo de ${area.title}">${demoIcon('play', 24)}<span>Reproduzir vídeo</span></button>
                </div>
                <p class="landing-tutorial-status" data-landing-tutorial-status role="status" aria-live="polite" hidden></p>
                <p class="landing-tutorial-description">${area.description}</p>
              </section>`;
            }).join('')}
          </div>
        </section>
        <section class="public-community" aria-labelledby="public-community-title">
          <div class="public-community-copy">
            <p class="public-eyebrow">Convite aberto</p>
            <h2 id="public-community-title">Sua experiência pode ajudar o Aurora a evoluir.</h2>
            <p>Ainda não temos avaliações ou números públicos para compartilhar. Enquanto isso, conheça a demonstração e envie uma sugestão baseada na sua rotina.</p>
          </div>
          <a class="btn primary large public-community-link" href="#public-suggestion">Compartilhar uma sugestão</a>
        </section>
        <section class="public-cta-panel" aria-labelledby="public-cta-title">
          <div class="public-cta-copy">
            <h2 id="public-cta-title">Leve sua rotina com você</h2>
            <p>Adicione o Aurora à tela inicial do celular e tenha seu espaço à mão quando precisar.</p>
            <ul class="public-install-note">
              <li><strong>Android:</strong> toque em “Instalar no celular” e siga as instruções.</li>
              <li><strong>iPhone:</strong> no Safari, toque em Compartilhar → Adicionar à Tela de Início.</li>
            </ul>
          </div>
          <div class="public-actions">
            <button class="btn primary" type="button" data-action="pwa-install">${demoIcon('download', 16)}Instalar no celular</button>
          </div>
        </section>
        <section class="public-faq" id="public-faq" aria-labelledby="public-faq-title">
          <div class="public-section-heading">
            <p class="public-eyebrow">Antes de começar</p>
            <h2 id="public-faq-title">Perguntas frequentes</h2>
          </div>
          <div class="public-faq-list compact-card-grid">
            <details class="card public-faq-item" open>
              <summary>O Aurora é grátis?${demoIcon('chevDown', 16)}</summary>
              <p>Sim. O Aurora é totalmente grátis e não pede cartão de crédito.</p>
            </details>
            <details class="card public-faq-item">
              <summary>Posso experimentar sem criar conta?${demoIcon('chevDown', 16)}</summary>
              <p>Sim. A demonstração usa dados fictícios. Você pode adicionar uma tarefa e marcar um hábito; as mudanças ficam só durante a visita e não são salvas.</p>
            </details>
            <details class="card public-faq-item">
              <summary>Funciona no celular?${demoIcon('chevDown', 16)}</summary>
              <p>Sim. O Aurora funciona no navegador do celular e pode ser instalado na tela inicial.</p>
            </details>
            <details class="card public-faq-item">
              <summary>O Aurora se conecta ao meu banco?${demoIcon('chevDown', 16)}</summary>
              <p>Não. Receitas, despesas e cartões são registrados manualmente; o Aurora não se conecta a contas bancárias.</p>
            </details>
            <details class="card public-faq-item">
              <summary>O que posso fazer em Ciclo?${demoIcon('chevDown', 16)}</summary>
              <p>Acompanhe datas e sintomas com seu consentimento específico. As informações são gerais e não substituem orientação profissional.</p>
            </details>
            <details class="card public-faq-item" id="public-suggestion" data-suggestion-disclosure>
              <summary>Envie uma sugestão${demoIcon('chevDown', 16)}</summary>
              ${renderSuggestionForm()}
            </details>
          </div>
        </section>
      </main>
      ${publicFooter({ demoAvailable: true })}
      <a class="public-mobile-cta btn primary" href="/demonstracao" data-public-action="demo" hidden>Abrir demonstração</a>
    </div>`;
}
