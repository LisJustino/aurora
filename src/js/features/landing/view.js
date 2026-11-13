import { iconSvg as demoIcon } from '../../utils/icons.js';
import { renderPublicHeader } from '../appearance/public-controls.js';
import { initializeFaqDisclosure, renderFooterContent, renderSuggestionForm } from '../footer/view.js';
import { renderLandingDemo, stopLandingDemo } from './demo.js';

const phoneBrandLogo = new URL('../../../../icons/favicon.svg', import.meta.url).href;

export { renderLandingDemo };

const landingControllers = new WeakMap();
const landingState = { tasks: null, area: 0, suggestion: {} };

function publicHeader() {
  return renderPublicHeader();
}

function publicFooter({ demoAvailable = false } = {}) {
  return `<footer class="app-footer public-footer site-footer">${renderFooterContent({ demoAvailable, includeFaq: false, pwaInstall: true })}</footer>`;
}

export function renderLanding(root) {
  landingControllers.get(root)?.();
  stopLandingDemo(root);
  document.title = 'aurora. — tarefas, hábitos, foco, ciclo e finanças';
  const prerendered = Boolean(root.querySelector?.('.public-site[data-prerendered]'));
  root.innerHTML = landingMarkup();
  initializeLandingTaskMock(root);
  initializeAreaSelector(root);
  if (prerendered) {
    // Evita repetir a animação de entrada sobre o conteúdo já exibido.
    root.querySelector('.public-main')?.classList.add('is-hydrated');
  }
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
      const title = task.querySelector('b')?.textContent?.trim() || 'Tarefa';
      const status = task.querySelector('small');
      if (status) status.textContent = done ? 'Concluída' : task === nextTask ? 'Seu próximo passo' : 'Hoje';
      task.setAttribute('aria-label', `${done ? 'Marcar como pendente' : 'Marcar como concluída'}: ${title}`);
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
  return `
    <div class="public-site">
      <a class="skip" href="#landing-main" data-public-action="skip">Pular para o conteúdo principal</a>
      ${publicHeader()}
      <main class="public-main" id="landing-main" tabindex="-1">
        <section class="public-hero public-hero-card" aria-labelledby="landing-title">
          <div class="public-copy">
            <p class="public-eyebrow"><span aria-hidden="true"></span> Um planner independente para a vida real</p>
            <h1 id="landing-title">Menos ruído. Mais clareza no dia<span>.</span></h1>
            <p class="public-subtitle">Tarefas, hábitos, foco, ciclo e finanças no seu ritmo.</p>
            <p class="public-lead">Veja o que importa hoje e dê o próximo passo, sem lista infinita e sem culpa.</p>
            <div class="public-actions">
              <a class="btn primary large" href="/demonstracao" data-public-action="demo">Abrir demonstração</a>
              <a class="btn large" href="#public-features">Ver áreas</a>
            </div>
            <p class="public-price-note"><strong>Grátis e sem cadastro.</strong> A demonstração usa dados fictícios.</p>
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
                  <button type="button" class="preview-task-row is-done" data-landing-task aria-pressed="true" aria-label="Marcar como pendente: Organizar a semana"><i aria-hidden="true">✓</i><span><b>Organizar a semana</b><small>Concluída</small></span></button>
                  <button type="button" class="preview-task-row is-done" data-landing-task aria-pressed="true" aria-label="Marcar como pendente: Responder uma mensagem"><i aria-hidden="true">✓</i><span><b>Responder uma mensagem</b><small>Concluída</small></span></button>
                  <button type="button" class="preview-task-row is-current" data-landing-task aria-pressed="false" aria-label="Marcar como concluída: Ler por alguns minutos"><i aria-hidden="true"></i><span><b>Ler por alguns minutos</b><small>Seu próximo passo</small></span></button>
                </div>
                <div class="preview-phone-nav" aria-hidden="true">
                  <span class="is-current">${demoIcon('home', 15)}Início</span>
                  <span>${demoIcon('calendarCheck', 15)}Planejar</span>
                  <span>${demoIcon('leaf', 15)}Hábitos</span>
                  <span>${demoIcon('heart', 15)}Ciclo</span>
                  <span>${demoIcon('wallet', 15)}Finanças</span>
                </div>
              </div>
            </div>
          </figure>
        </section>
        <section class="public-maker" aria-labelledby="public-maker-title">
          <span class="public-value-icon" aria-hidden="true">${demoIcon('heart', 22)}</span>
          <div>
            <h2 id="public-maker-title">Feito por uma pessoa só, com cuidado</h2>
            <p>O Aurora é criado e mantido por Elisa da Silva Justino. As sugestões chegam direto a ela: <a href="mailto:lisjustino@gmail.com">fale por e-mail</a> ou use o formulário de sugestões.</p>
          </div>
        </section>
        <section class="public-features" id="public-features" aria-labelledby="public-features-title">
          <div class="public-section-heading"><p class="public-eyebrow">Feito para a vida como ela é</p><h2 id="public-features-title">Escolha por onde começar</h2><p class="public-section-lead">Cada espaço cuida de uma parte do seu dia. Você usa só o que fizer sentido agora.</p></div>
          <div class="public-area-selector" data-area-selector role="group" aria-label="Escolha uma área para conhecer" hidden>
            <button type="button" aria-pressed="true">Planejar</button>
            <button type="button" aria-pressed="false">Hábitos</button>
            <button type="button" aria-pressed="false">Finanças</button>
            <button type="button" aria-pressed="false">Ciclo</button>
          </div>
          <div class="public-values" aria-label="Demonstração visual das quatro áreas">
          <article class="card public-value">
            <span class="public-value-icon" aria-hidden="true">${demoIcon('calendarCheck', 22)}</span>
            <div><h3>Planejar</h3><p>Organize tarefas, prazos e momentos de foco; acompanhe o que já foi concluído.</p></div>
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
              <span class="preview-habit-dots"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span>
              <span class="preview-mini-heading">Ler 10 minutos <small>3/5</small></span>
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
              <a class="preview-cycle-privacy" href="/privacy.html" target="_blank" rel="noopener noreferrer">Saiba mais na Política de Privacidade</a>
            </div>
          </article>
          </div>
        </section>
        <section class="public-cta-panel" aria-labelledby="public-cta-title">
          <div class="public-cta-copy">
            <h2 id="public-cta-title">Leve sua rotina com você</h2>
            <p>Adicione o Aurora à tela inicial do celular e tenha seu espaço à mão quando precisar.</p>
            <p class="public-install-note"><span>Android: toque para instalar. iPhone: no Safari, toque em Compartilhar → Adicionar à Tela de Início.</span></p>
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
            <details class="card public-faq-item">
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
            <details class="card public-faq-item" data-suggestion-disclosure>
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
