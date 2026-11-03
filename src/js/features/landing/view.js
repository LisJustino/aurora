import { iconSvg as demoIcon } from '../../utils/icons.js';
import { prefersReducedMotion } from '../../utils/motion.js';
import { renderPublicHeader } from '../appearance/public-controls.js';
import { renderFooterContent } from '../footer/view.js';

function publicHeader() {
  return renderPublicHeader();
}

function publicFooter({ demoAvailable = false } = {}) {
  return `<footer class="app-footer public-footer site-footer">${renderFooterContent({ demoAvailable })}</footer>`;
}

const demoControllers = new WeakMap();

function stopDemo(root) {
  const controller = demoControllers.get(root);
  if (!controller) return;
  clearInterval(controller.interval);
  root.removeEventListener('click', controller.onClick);
  demoControllers.delete(root);
}

function demoHomeHeading(prefix = 'demo') {
  return `
    <header class="home-head" aria-labelledby="${prefix}-title">
      <div>
        <p class="date">Um exemplo de dia</p>
        <h1 id="${prefix}-title">Bom dia, pessoa<i>.</i></h1>
        <p class="lead">Escolha uma coisa de cada vez. Seu plano pode mudar — tudo bem.</p>
        <button type="button" class="home-action" data-demo-action="focus-task">${demoIcon('calendarCheck', 18)}Ver tarefas de exemplo${demoIcon('chevRight', 16)}</button>
      </div>
      <div class="ringw demo-ring" role="img" aria-label="Duas de três tarefas de exemplo concluídas" data-demo-progress>
        <svg viewBox="0 0 80 80" aria-hidden="true"><circle class="ring-bg" cx="40" cy="40" r="34" fill="none" stroke-width="7"/><circle class="ring-fg" data-demo-ring-progress cx="40" cy="40" r="34" fill="none" stroke-width="7" stroke-linecap="round" stroke-dasharray="142 214" transform="rotate(-90 40 40)"/></svg>
        <span class="rt" data-demo-task-count>2/3</span>
      </div>
    </header>`;
}

function demoTodayCard(prefix = 'demo') {
  return `
    <section class="card home-today-card" aria-labelledby="${prefix}-today-title">
      <div class="head">
        <div><p class="section-kicker">Seu plano</p><h2 id="${prefix}-today-title">Hoje<i>.</i></h2></div>
        <span class="pill" data-demo-task-summary aria-live="polite">2 de 3 feitos</span>
      </div>
      <div class="home-task-groups">
        <section class="home-task-group" aria-labelledby="${prefix}-task-group">
          <h3 id="${prefix}-task-group">${demoIcon('calendarCheck', 16)}Para hoje <span>3</span></h3>
          <ul class="list">
            <li class="task done"><span class="chk" role="checkbox" aria-checked="true" aria-disabled="true" aria-label="Concluída: Organizar a semana"><span>${demoIcon('check', 15)}</span></span><div class="tt"><span class="ttl">Organizar a semana</span><span class="meta">Concluída · exemplo</span></div></li>
            <li class="task demo-example-task"><button type="button" class="chk" role="checkbox" aria-checked="false" aria-label="Concluir: Ler por alguns minutos" data-demo-action="task-toggle"><span>${demoIcon('check', 15)}</span></button><div class="tt"><span class="ttl">Ler por alguns minutos</span><span class="meta" data-demo-task-status>Sem horário marcado · exemplo</span></div></li>
            <li class="task"><span class="chk" role="checkbox" aria-checked="false" aria-disabled="true" aria-label="Pendente: Fazer uma pausa"><span>${demoIcon('check', 15)}</span></span><div class="tt"><span class="ttl">Fazer uma pausa longe da tela</span><span class="meta">Quando puder</span></div></li>
          </ul>
        </section>
      </div>
    </section>`;
}

function demoFocusCard(prefix = 'demo') {
  return `
    <section class="card demo-focus-card" aria-labelledby="${prefix}-focus-title">
      <div class="head"><div><p class="section-kicker">Foco</p><h2 id="${prefix}-focus-title">Um tempo para você<i>.</i></h2></div>${demoIcon('clock', 20)}</div>
      <div class="timer" aria-label="Exemplo: 25 minutos" data-demo-timer aria-live="off">25:00</div>
      <p class="demo-muted">Uma sessão curta também conta.</p>
      <button class="btn" type="button" data-demo-action="timer-toggle" aria-pressed="false">Iniciar foco de exemplo</button>
    </section>`;
}

export function renderLanding(root) {
  stopDemo(root);
  root.innerHTML = `
    <div class="public-site">
      <a class="skip" href="#landing-main" data-public-action="skip">Pular para o conteúdo principal</a>
      ${publicHeader()}
      <main class="public-main" id="landing-main" tabindex="-1">
        <section class="public-hero public-hero-card" aria-labelledby="landing-title">
          <div class="public-copy">
            <p class="public-eyebrow"><span aria-hidden="true"></span> Organização pessoal para a rotina real</p>
            <h1 id="landing-title">Mais clareza para a sua semana<span>.</span></h1>
            <p class="public-lead">Planeje tarefas, acompanhe hábitos e registre suas finanças manualmente, em um só lugar.</p>
            <div class="public-actions">
              <button class="btn primary large" type="button" data-public-action="signup">Criar conta e começar</button>
              <button class="btn large" type="button" data-public-action="demo">Explorar a demonstração</button>
            </div>
          </div>
          <figure class="product-preview" role="img" aria-label="Capturas da interface do aurora. em computador e celular">
            <div class="preview-device preview-device--desktop" aria-hidden="true">
              <div class="preview-device-screen">
                <img class="preview-capture preview-capture--desktop" src="./src/assets/landing-desktop.png" alt="" width="1440" height="900" decoding="async" fetchpriority="high">
              </div>
              <span class="preview-device-base"></span>
            </div>
            <div class="preview-device preview-device--mobile" aria-hidden="true">
              <span class="preview-device-side-button"></span>
              <div class="preview-device-screen">
                <span class="preview-device-notch"></span>
                <img class="preview-capture preview-capture--mobile" src="./src/assets/landing-mobile.png" alt="" width="390" height="844" decoding="async" fetchpriority="high">
              </div>
              <span class="preview-device-home-indicator"></span>
            </div>
          </figure>
          <div class="public-hero-support">
            <ul class="public-proof" aria-label="Informações práticas sobre o Aurora">
              <li><strong>Teste sem conta</strong><span>com exemplos fictícios</span></li>
              <li><strong>Finanças manuais</strong><span>sem conexão bancária</span></li>
              <li><strong>Seus registros</strong><span>na sua conta Aurora</span></li>
            </ul>
            <p class="public-reassurance">${demoIcon('lock', 17)}<span>Na demonstração, tarefas, hábitos e Pomodoro usam exemplos fictícios; suas alterações não são salvas nem sincronizadas.</span></p>
          </div>
        </section>
        <section class="public-features" aria-labelledby="public-features-title">
          <div class="public-section-heading"><p class="public-eyebrow">Conheça o produto</p><h2 id="public-features-title">O que você pode organizar</h2></div>
          <div class="public-values">
          <article class="card public-value">
            <span class="public-value-icon" aria-hidden="true">${demoIcon('calendarCheck', 22)}</span>
            <div><h3>Planejar</h3><p>Organize tarefas por dia, defina prazos e acompanhe o que já foi concluído.</p></div>
          </article>
          <article class="card public-value">
            <span class="public-value-icon" aria-hidden="true">${demoIcon('clock', 22)}</span>
            <div><h3>Foco</h3><p>Personalize os períodos de foco e pausa; use o Pomodoro com ou sem uma tarefa.</p></div>
          </article>
          <article class="card public-value">
            <span class="public-value-icon" aria-hidden="true">${demoIcon('leaf', 22)}</span>
            <div><h3>Hábitos</h3><p>Registre check-ins e metas semanais com espaço para ajustar o plano à sua rotina.</p></div>
          </article>
          <article class="card public-value">
            <span class="public-value-icon" aria-hidden="true">${demoIcon('wallet', 22)}</span>
            <div><h3>Finanças</h3><p>Registre receitas, despesas e cartões manualmente. O Aurora não se conecta a bancos.</p></div>
          </article>
          <article class="card public-value">
            <span class="public-value-icon" aria-hidden="true">${demoIcon('heart', 22)}</span>
            <div><h3>Ciclo</h3><p>Acompanhe períodos e sintomas. As informações são gerais e não substituem orientação profissional.</p></div>
          </article>
          </div>
        </section>
        <section class="public-cta-panel" aria-labelledby="public-cta-title">
          <div>
            <p class="public-eyebrow">Seus registros, no seu espaço</p>
            <h2 id="public-cta-title">Crie uma conta para começar a organizar a sua rotina.</h2>
          </div>
          <div class="public-actions">
            <button class="btn primary large" type="button" data-public-action="signup">Começar agora</button>
            <button class="btn large" type="button" data-public-action="demo">Ver demonstração</button>
          </div>
        </section>
        <section class="public-faq" aria-labelledby="public-faq-title">
          <div class="public-section-heading">
            <p class="public-eyebrow">Antes de começar</p>
            <h2 id="public-faq-title">Perguntas frequentes</h2>
          </div>
          <div class="public-faq-list compact-card-grid">
            <details class="card public-faq-item">
              <summary>Como meus dados são protegidos?${demoIcon('chevDown', 16)}</summary>
                <p>Os registros salvos pelo app ficam associados à sua conta. Consulte a Política de Privacidade para detalhes sobre o tratamento dos dados e como solicitar a exclusão.</p>
            </details>
            <details class="card public-faq-item">
              <summary>Preciso confirmar meu e-mail?${demoIcon('chevDown', 16)}</summary>
              <p>Não. O acesso é liberado assim que a conta é criada. Confira o endereço antes: um erro de digitação pode impedir a recuperação da senha.</p>
            </details>
            <details class="card public-faq-item">
              <summary>O Aurora se conecta ao meu banco?${demoIcon('chevDown', 16)}</summary>
              <p>Não. Receitas, despesas e cartões são registrados manualmente; o Aurora não se conecta a contas bancárias.</p>
            </details>
            <details class="card public-faq-item">
              <summary>Posso apagar minha conta?${demoIcon('chevDown', 16)}</summary>
              <p>Sim. Você pode iniciar a exclusão permanente nas configurações; aurora. pede confirmação antes de apagar a conta e os dados associados.</p>
            </details>
          </div>
        </section>
      </main>
      ${publicFooter({ demoAvailable: true })}
    </div>`;
}

export function renderLandingDemo(root) {
  stopDemo(root);
  root.innerHTML = `
    <div class="app demo-app">
      <a class="skip" href="#demo-main" data-public-action="skip">Pular para o conteúdo principal</a>
      ${renderPublicHeader({ demo: true })}
      <main class="main demo-main" id="demo-main" data-route="inicio" tabindex="-1">
        <p class="demo-disclaimer" role="note" aria-label="Demonstração interativa com dados fictícios; as alterações não são salvas">${demoIcon('info', 17)} Demonstração interativa · exemplos fictícios · nada é salvo</p>
        ${demoHomeHeading()}
        <div class="home-dashboard demo-dashboard">
          <div class="home-primary">
            ${demoTodayCard()}
            <section class="card home-habit-checkins" aria-labelledby="demo-habits-title">
              <div class="head"><div><h2 id="demo-habits-title">Hábitos<i>.</i></h2></div><span class="pill">Esta semana</span></div>
              <ul class="list">
                <li class="home-habit-row"><span class="home-next-mark">${demoIcon('leaf', 19)}</span><span class="grow"><b>Alongar um pouquinho</b><span class="meta" data-demo-habit-status aria-live="polite">2 dias nesta semana</span></span><span class="demo-habit-dots" aria-hidden="true"><i class="is-complete"></i><i class="is-complete"></i><i></i><i></i><i></i><i></i><i></i></span><button type="button" class="btn sm" data-demo-action="habit-toggle" aria-pressed="false">Marcar hoje</button></li>
              </ul>
            </section>
          </div>
          <aside class="home-primary demo-side" aria-label="Outras áreas do aurora.">
            ${demoFocusCard()}
            <section class="card demo-area-card" aria-labelledby="demo-areas-title">
              <div class="head"><div><p class="section-kicker">Outras ferramentas</p><h2 id="demo-areas-title">Áreas<i>.</i></h2></div></div>
              <div class="tiles">
                <div class="tile"><span class="mk">${demoIcon('calendarCheck', 20)}</span><h3>Planejar</h3><span class="s">Tarefas e ideias</span></div>
                <div class="tile"><span class="mk">${demoIcon('heart', 20)}</span><h3>Hábitos</h3><span class="s">Registro semanal</span></div>
              </div>
            </section>
          </aside>
        </div>
        <section class="demo-cta"><div><h2>Acesse seus próprios registros</h2><p>Aqui você pode testar uma tarefa, um hábito e o Pomodoro. Finanças, ciclo e os demais recursos estão disponíveis ao criar uma conta.</p></div><div class="public-actions"><button class="btn primary" type="button" data-public-action="signup">Criar minha conta</button><button class="btn" type="button" data-public-action="landing">Voltar</button></div></section>
      </main>
      <footer class="app-footer public-footer demo-footer site-footer">${renderFooterContent()}</footer>
    </div>`;

  const state = {
    taskDone: false,
    habitDone: false,
    remainingMs: 25 * 60 * 1000,
    startedAt: 0,
    interval: null,
  };
  const update = () => {
    const task = root.querySelector('[data-demo-action="task-toggle"]');
    const count = state.taskDone ? 3 : 2;
    if (task) {
      task.setAttribute('aria-checked', String(state.taskDone));
      task.setAttribute('aria-label', `${state.taskDone ? 'Reabrir' : 'Concluir'}: Ler por alguns minutos`);
      task.closest('.task')?.classList.toggle('done', state.taskDone);
      root.querySelector('[data-demo-task-status]').textContent = state.taskDone ? 'Concluída · exemplo' : 'Sem horário marcado · exemplo';
    }
    root.querySelector('[data-demo-task-count]').textContent = `${count}/3`;
    root.querySelector('[data-demo-task-summary]').textContent = `${count} de 3 feitos`;
    root.querySelector('[data-demo-progress]').setAttribute('aria-label', `${count} de três tarefas de exemplo concluídas`);
    const circumference = 2 * Math.PI * 34;
    root.querySelector('[data-demo-ring-progress]').setAttribute('stroke-dasharray', `${(circumference * count / 3).toFixed(1)} ${circumference.toFixed(1)}`);

    const habit = root.querySelector('[data-demo-action="habit-toggle"]');
    if (habit) {
      habit.setAttribute('aria-pressed', String(state.habitDone));
      habit.textContent = state.habitDone ? 'Desmarcar hoje' : 'Marcar hoje';
      root.querySelector('[data-demo-habit-status]').textContent = `${state.habitDone ? 3 : 2} dias nesta semana`;
      root.querySelectorAll('.demo-habit-dots i')[2]?.classList.toggle('is-complete', state.habitDone);
    }

    const remaining = state.startedAt
      ? Math.max(0, state.remainingMs - (Date.now() - state.startedAt))
      : state.remainingMs;
    const totalSeconds = Math.ceil(remaining / 1000);
    const timer = root.querySelector('[data-demo-timer]');
    timer.textContent = `${String(Math.floor(totalSeconds / 60)).padStart(2, '0')}:${String(totalSeconds % 60).padStart(2, '0')}`;
    timer.setAttribute('aria-label', `Cronômetro de exemplo: ${timer.textContent}`);
    const timerButton = root.querySelector('[data-demo-action="timer-toggle"]');
    const running = Boolean(state.startedAt);
    timerButton.textContent = running
      ? 'Pausar foco de exemplo'
      : state.remainingMs === 0 ? 'Foco de exemplo concluído' : 'Iniciar foco de exemplo';
    timerButton.disabled = state.remainingMs === 0 && !running;
    timerButton.setAttribute('aria-pressed', String(running));
  };
  const onClick = (event) => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest('[data-demo-action]');
    if (!button || button.disabled) return;
    if (button.dataset.demoAction === 'focus-task') {
      root.querySelector('.demo-example-task')?.scrollIntoView({
        behavior: prefersReducedMotion(document.documentElement.dataset.motion === 'reduce') ? 'auto' : 'smooth',
        block: 'center',
      });
      root.querySelector('[data-demo-action="task-toggle"]')?.focus({ preventScroll: true });
    } else if (button.dataset.demoAction === 'task-toggle') {
      state.taskDone = !state.taskDone;
      update();
    } else if (button.dataset.demoAction === 'habit-toggle') {
      state.habitDone = !state.habitDone;
      update();
    } else if (button.dataset.demoAction === 'timer-toggle') {
      if (state.startedAt) {
        state.remainingMs = Math.max(0, state.remainingMs - (Date.now() - state.startedAt));
        state.startedAt = 0;
        clearInterval(state.interval);
        state.interval = null;
      } else if (state.remainingMs > 0) {
        state.startedAt = Date.now();
        state.interval = setInterval(() => {
          if (Date.now() - state.startedAt >= state.remainingMs) {
            state.remainingMs = 0;
            state.startedAt = 0;
            clearInterval(state.interval);
            state.interval = null;
          }
          update();
        }, 250);
      }
      update();
    }
  };
  state.onClick = onClick;
  demoControllers.set(root, state);
  root.addEventListener('click', onClick);
  update();
}
