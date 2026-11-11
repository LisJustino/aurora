import { iconSvg as demoIcon } from '../../utils/icons.js';
import { renderPublicHeader } from '../appearance/public-controls.js';
import { initializeFaqDisclosure, renderFooterContent, renderSuggestionForm } from '../footer/view.js';
import { renderLandingDemo, stopLandingDemo } from './demo.js';

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
  document.title = 'aurora. — planner semanal, hábitos e finanças em um só lugar';
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
            <p class="public-eyebrow"><span aria-hidden="true"></span> Planner pessoal para quem vive com a cabeça cheia</p>
            <h1 id="landing-title">Menos ruído. Mais clareza no dia<span>.</span></h1>
            <p class="public-subtitle">Planner de tarefas, hábitos, ciclo e finanças em um só lugar.</p>
            <p class="public-lead">Veja o que importa hoje e dê o próximo passo, sem lista infinita e sem culpa.</p>
            <div class="public-actions">
              <a class="btn primary large" href="/criar-conta" data-public-action="signup">Começar grátis</a>
              <a class="btn large" href="/demonstracao" data-public-action="demo">Ver demo em 1 minuto</a>
            </div>
            <p class="public-price-note"><strong>Totalmente grátis.</strong> Sem cartão de crédito. Demo com dados fictícios, sem cadastro.</p>
            <p class="public-account-note">Já tem conta? <a href="/entrar" data-public-action="login">Entre com Google</a> ou sua senha.</p>
          </div>
          <figure class="product-preview" aria-label="Prévia visual das áreas do Aurora">
            <div class="preview-phone">
              <span class="preview-phone-brand">aurora<span>.</span></span>
              <span class="preview-phone-title">Seu dia, com calma.</span>
              <div class="preview-tasks" role="group" data-landing-task-group aria-label="2 de 3 tarefas de exemplo concluídas">
                <span class="preview-task-heading">Para hoje <b data-preview-task-count>3</b><small data-preview-task-summary aria-live="polite">2 de 3 feitas</small></span>
                <span class="preview-task-progress"><i></i></span>
                <button type="button" class="preview-task-row is-done" data-landing-task aria-pressed="true" aria-label="Marcar como pendente: Organizar a semana"><i aria-hidden="true">✓</i><span><b>Organizar a semana</b><small>Concluída</small></span></button>
                <button type="button" class="preview-task-row is-done" data-landing-task aria-pressed="true" aria-label="Marcar como pendente: Responder uma mensagem"><i aria-hidden="true">✓</i><span><b>Responder uma mensagem</b><small>Concluída</small></span></button>
                <button type="button" class="preview-task-row is-current" data-landing-task aria-pressed="false" aria-label="Marcar como concluída: Ler por alguns minutos"><i aria-hidden="true"></i><span><b>Ler por alguns minutos</b><small>Seu próximo passo</small></span></button>
              </div>
              <div class="preview-phone-nav" aria-hidden="true">
                <span>${demoIcon('home', 16)}Início</span><span>${demoIcon('calendarCheck', 16)}Planejar</span><span>${demoIcon('leaf', 16)}Hábitos</span><span>${demoIcon('wallet', 16)}Finanças</span>
              </div>
            </div>
          </figure>
          <div class="public-hero-support">
            <ul class="public-proof" aria-label="Informações práticas sobre o Aurora">
              <li><strong>Veja funcionando em 1 minuto</strong><span>demonstração sem cadastro</span></li>
                            <li><strong>Tudo em um app só</strong><span>tarefas, hábitos e finanças</span></li>
                            <li><strong>Finanças manuais</strong><span>sem conexão bancária, você registra o que quiser</span></li>
            </ul>
          </div>
        </section>
        <section class="public-features" id="public-features" aria-labelledby="public-features-title">
          <div class="public-section-heading"><p class="public-eyebrow">Da cabeça cheia a um próximo passo possível</p><h2 id="public-features-title">Quatro áreas, no seu ritmo</h2><p class="public-section-lead">Veja como Planejar, Hábitos, Finanças e Ciclo se encaixam na sua rotina. Comece por uma área e explore as outras quando quiser.</p></div>
          <h3 class="public-journey-title">Como levar isso para a semana</h3>
          <ol class="public-journey-grid" aria-label="Como o Aurora ajuda no dia a dia" tabindex="0">
            <li class="public-journey-step"><span class="public-journey-number" aria-hidden="true">01</span><div><h3>Despeje tudo</h3><p>Anote como vier; o que não tem data fica guardado.</p></div></li>
            <li class="public-journey-step"><span class="public-journey-number" aria-hidden="true">02</span><div><h3>Veja só o que cabe hoje</h3><p>Dia puxado? Reduza o plano em vez de abandonar tudo.</p></div></li>
            <li class="public-journey-step"><span class="public-journey-number" aria-hidden="true">03</span><div><h3>Perceba o que avançou</h3><p>Veja conclusões, hábitos e para onde foi o dinheiro.</p></div></li>
          </ol>
          <div class="public-area-selector" data-area-selector role="group" aria-label="Escolha uma área para conhecer" hidden>
            <button type="button" aria-pressed="true">Planejar</button>
            <button type="button" aria-pressed="false">Hábitos</button>
            <button type="button" aria-pressed="false">Finanças</button>
            <button type="button" aria-pressed="false">Ciclo</button>
          </div>
          <div class="public-values" aria-label="Demonstração visual das quatro áreas">
          <article class="card public-value">
            <span class="public-value-icon" aria-hidden="true">${demoIcon('calendarCheck', 22)}</span>
            <div><h3>Planejar</h3><p>Organize tarefas por dia, defina prazos e acompanhe o que já foi concluído.</p></div>
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
        <section class="public-maker" aria-labelledby="public-maker-title">
          <span class="public-value-icon" aria-hidden="true">${demoIcon('heart', 22)}</span>
          <div>
            <h2 id="public-maker-title">Feito por uma pessoa só, com cuidado</h2>
            <p>O Aurora é criado e mantido por Elisa da Silva Justino. As sugestões chegam direto a ela: <a href="mailto:lisjustino@gmail.com">fale por e-mail</a> ou use o formulário de sugestões.</p>
          </div>
        </section>
        <section class="public-cta-panel" aria-labelledby="public-cta-title">
          <div class="public-cta-copy">
            <p class="public-eyebrow">Grátis, sem cartão</p>
            <h2 id="public-cta-title">Escolha como quer começar</h2>
            <p>Explore a demonstração somente de leitura, com dados fictícios e sem cadastro, ou crie sua conta para guardar seus próprios registros.</p>
            <p class="public-install-note"><span>Android: toque para instalar. iPhone: no Safari, toque em Compartilhar → Adicionar à Tela de Início.</span></p>
          </div>
          <div class="public-actions">
            <a class="btn primary large" href="/criar-conta" data-public-action="signup">Criar minha conta</a>
            <a class="btn large" href="/demonstracao" data-public-action="demo">Ver a demonstração</a>
            <button class="btn" type="button" data-action="pwa-install">${demoIcon('download', 16)}Instalar no celular</button>
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
              <summary>Funciona no celular?${demoIcon('chevDown', 16)}</summary>
              <p>Sim. A página se adapta a telas pequenas e pode ser instalada como app. No iPhone, abra no Safari, toque em Compartilhar e escolha Adicionar à Tela de Início. É necessária uma conexão para gravar seus dados.</p>
            </details>
            <details class="card public-faq-item">
              <summary>Posso exportar meus dados?${demoIcon('chevDown', 16)}</summary>
              <p>Sim. Em Ajustes você baixa um backup em JSON com seus registros, com opção de proteger o arquivo com senha. As Finanças também exportam em CSV.</p>
            </details>
            <details class="card public-faq-item">
              <summary>Como meus dados são protegidos?${demoIcon('chevDown', 16)}</summary>
              <p>O acesso aos registros é restrito à sua conta autenticada. Eles não são criptografados de ponta a ponta. Leia a <a href="/privacy.html" target="_blank" rel="noopener noreferrer">Política de Privacidade</a> para conhecer detalhes e limitações.</p>
            </details>
            <details class="card public-faq-item">
              <summary>O Aurora se conecta ao meu banco?${demoIcon('chevDown', 16)}</summary>
              <p>Não. Receitas, despesas e cartões são registrados manualmente; o Aurora não se conecta a contas bancárias.</p>
            </details>
            <details class="public-faq-more">
              <summary>Ver todas as perguntas${demoIcon('chevDown', 16)}</summary>
              <div class="public-faq-extra">
                <details class="card public-faq-item">
                  <summary>Preciso confirmar meu e-mail?${demoIcon('chevDown', 16)}</summary>
                  <p>Não. No cadastro, você digita o endereço duas vezes para reduzir erros. Confira se ele está correto: um endereço inválido pode impedir a recuperação da senha.</p>
                </details>
                <details class="card public-faq-item">
                  <summary>Posso apagar minha conta?${demoIcon('chevDown', 16)}</summary>
                  <p>Sim. Em Ajustes → Seu perfil, escolha Excluir conta e confirme digitando EXCLUIR. A exclusão permanente remove a conta e os dados associados.</p>
                </details>
                <details class="card public-faq-item">
                  <summary>A demonstração usa meus dados?${demoIcon('chevDown', 16)}</summary>
                  <p>Não. A demonstração é somente de leitura: usa informações fictícias, não acessa sua conta e não salva alterações.</p>
                </details>
                <details class="card public-faq-item">
                  <summary>Preciso autorizar o uso dos dados do Ciclo?${demoIcon('chevDown', 16)}</summary>
                  <p>Sim. Antes de abrir Ciclo, o Aurora pede um consentimento específico para tratar os dados de saúde que você registrar. Você pode recusar e continuar usando as outras áreas. Consulte a <a href="/privacy.html" target="_blank" rel="noopener noreferrer">Política de Privacidade</a>.</p>
                </details>
                <details class="card public-faq-item">
                  <summary>Preciso de uma conta?${demoIcon('chevDown', 16)}</summary>
                  <p>Você pode explorar a demonstração sem cadastro. Para guardar seus próprios registros, crie uma conta.</p>
                </details>
                <details class="card public-faq-item">
                  <summary>O que acontece sem conexão?${demoIcon('chevDown', 16)}</summary>
                  <p>O Aurora avisa quando está sem conexão e bloqueia novas gravações. Alterações offline não são sincronizadas automaticamente.</p>
                </details>
                <details class="card public-faq-item">
                  <summary>Como entro em contato com quem criou o Aurora?${demoIcon('chevDown', 16)}</summary>
                  <p>Elisa da Silva Justino: <a href="mailto:lisjustino@gmail.com">lisjustino@gmail.com</a>. Você também pode enviar uma sugestão pelo formulário abaixo.</p>
                </details>
              </div>
            </details>
          </div>
        </section>
        <section class="public-suggestion" aria-labelledby="public-suggestion-title">
          <h2 id="public-suggestion-title">Envie uma sugestão</h2>
          ${renderSuggestionForm()}
        </section>
      </main>
      ${publicFooter({ demoAvailable: true })}
      <a class="public-mobile-cta btn primary" href="/criar-conta" data-public-action="signup" hidden>Começar grátis</a>
    </div>`;
}
