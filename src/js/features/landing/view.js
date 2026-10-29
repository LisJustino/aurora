import { IC } from '../../utils/icons.js';
import { renderPublicHeader } from '../appearance/public-controls.js';
import { renderFooterContent } from '../footer/view.js';

function demoIcon(name, size = 18) {
  return `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${IC[name] || ''}</svg>`;
}

function publicHeader() {
  return renderPublicHeader();
}

function publicFooter({ demoAvailable = false } = {}) {
  return `<footer class="app-footer public-footer site-footer">${renderFooterContent({ demoAvailable })}</footer>`;
}

function demoHomeHeading(prefix = 'demo') {
  return `
    <header class="home-head" aria-labelledby="${prefix}-title">
      <div>
        <p class="date">Um exemplo de dia</p>
        <h1 id="${prefix}-title">Bom dia, pessoa<i>.</i></h1>
        <p class="lead">Escolha uma coisa de cada vez. Seu plano pode mudar — tudo bem.</p>
        <button type="button" class="home-action" disabled>${demoIcon('plus', 18)}Adicionar tarefa para hoje${demoIcon('chevRight', 16)}</button>
      </div>
      <div class="ringw demo-ring" role="img" aria-label="Duas de três tarefas de exemplo concluídas">
        <svg viewBox="0 0 80 80" aria-hidden="true"><circle class="ring-bg" cx="40" cy="40" r="34" fill="none" stroke-width="7"/><circle class="ring-fg" cx="40" cy="40" r="34" fill="none" stroke-width="7" stroke-linecap="round" stroke-dasharray="142 214" transform="rotate(-90 40 40)"/></svg>
        <span class="rt">2/3</span>
      </div>
    </header>`;
}

function demoTodayCard(prefix = 'demo') {
  return `
    <section class="card home-today-card" aria-labelledby="${prefix}-today-title">
      <div class="head">
        <div><p class="section-kicker">Seu plano</p><h2 id="${prefix}-today-title">Hoje<i>.</i></h2></div>
        <span class="pill">2 de 3 feitos</span>
      </div>
      <div class="home-task-groups">
        <section class="home-task-group" aria-labelledby="${prefix}-task-group">
          <h3 id="${prefix}-task-group">${demoIcon('calendarCheck', 16)}Para hoje <span>3</span></h3>
          <ul class="list">
            <li class="task done"><span class="chk" role="checkbox" aria-checked="true" aria-disabled="true" aria-label="Concluída: Organizar a semana"><span>${demoIcon('check', 15)}</span></span><div class="tt"><span class="ttl">Organizar a semana</span><span class="meta">Concluída · exemplo</span></div></li>
            <li class="task"><span class="chk" role="checkbox" aria-checked="false" aria-disabled="true" aria-label="Pendente: Ler por alguns minutos"><span>${demoIcon('check', 15)}</span></span><div class="tt"><span class="ttl">Ler por alguns minutos</span><span class="meta">Sem horário marcado</span></div></li>
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
      <div class="timer" aria-label="Exemplo: 25 minutos">25:00</div>
      <p class="demo-muted">Uma sessão curta também conta.</p>
      <button class="btn" type="button" disabled>Cronômetro de exemplo</button>
    </section>`;
}

export function renderLanding(root) {
  root.innerHTML = `
    <div class="public-site">
      <a class="skip" href="#landing-main" data-public-action="skip">Pular para o conteúdo principal</a>
      ${publicHeader()}
      <main class="public-main" id="landing-main" tabindex="-1">
        <section class="public-hero" aria-labelledby="landing-title">
          <div class="public-copy">
            <h1 id="landing-title">Tarefas, hábitos e finanças em um só lugar<span>.</span></h1>
            <p class="public-lead">Planeje a semana, use o Pomodoro e acompanhe seus hábitos e ciclo.</p>
            <div class="public-actions">
              <button class="btn primary large" type="button" data-public-action="demo">Ver demonstração</button>
              <button class="btn large" type="button" data-public-action="signup">Criar minha conta</button>
            </div>
            <p class="public-reassurance">${demoIcon('lock', 17)}<span>Experimente sem cadastro: a demonstração usa dados fictícios e não lê nem salva dados da sua conta.</span></p>
          </div>
          <figure class="product-preview" role="img" aria-label="Capturas da interface do Aurora em computador e celular">
            <div class="preview-monitor" aria-hidden="true">
              <div class="preview-monitor-screen">
                <img class="preview-device-screen" src="./src/assets/landing-desktop.png" alt="" width="1440" height="900" decoding="async">
              </div>
              <div class="preview-monitor-neck"></div>
              <div class="preview-monitor-base"></div>
            </div>
            <div class="preview-phone" aria-hidden="true">
              <div class="preview-phone-camera"></div>
              <div class="preview-phone-screen">
                <img class="preview-device-screen preview-device-screen-mobile" src="./src/assets/landing-mobile.png" alt="" width="390" height="844" decoding="async">
              </div>
            </div>
          </figure>
        </section>
        <section class="public-features" aria-labelledby="public-features-title">
          <div class="public-section-heading"><p class="public-eyebrow">Recursos</p><h2 id="public-features-title">Planejamento, foco e hábitos</h2></div>
          <div class="public-values">
          <article class="public-value">
            <span class="public-value-icon" aria-hidden="true">${demoIcon('calendarCheck', 22)}</span>
            <div><h3>Planejar</h3><p>Crie tarefas, defina prazos e organize a semana em lista ou calendário.</p></div>
          </article>
          <article class="public-value">
            <span class="public-value-icon" aria-hidden="true">${demoIcon('clock', 22)}</span>
            <div><h3>Foco</h3><p>Configure blocos Pomodoro e pausas; associe o timer a uma tarefa.</p></div>
          </article>
          <article class="public-value">
            <span class="public-value-icon" aria-hidden="true">${demoIcon('leaf', 22)}</span>
            <div><h3>Hábitos</h3><p>Marque os dias em que concluiu cada hábito e consulte a frequência.</p></div>
          </article>
          </div>
          <p class="public-features-more">Também há áreas para finanças e registro do ciclo; hidratação pode ser acompanhada como hábito.</p>
        </section>
        <section class="public-account-access" aria-labelledby="public-account-access-title">
          <h2 id="public-account-access-title">Acesso à conta</h2>
          <p>Confirme o endereço de e-mail cadastrado para acessar seus registros.</p>
        </section>
      </main>
      ${publicFooter({ demoAvailable: true })}
    </div>`;
}

export function renderLandingDemo(root) {
  root.innerHTML = `
    <div class="app demo-app">
      <a class="skip" href="#demo-main" data-public-action="skip">Pular para o conteúdo principal</a>
      ${renderPublicHeader({ demo: true })}
      <main class="main demo-main" id="demo-main" data-route="inicio" tabindex="-1">
        <p class="demo-disclaimer" role="note" aria-label="Demonstração com dados fictícios">${demoIcon('info', 17)} demonstração com dados fictícios</p>
        ${demoHomeHeading()}
        <div class="home-dashboard demo-dashboard">
          <div class="home-primary">
            ${demoTodayCard()}
            <section class="card home-habit-checkins" aria-labelledby="demo-habits-title">
              <div class="head"><div><h2 id="demo-habits-title">Hábitos<i>.</i></h2></div><span class="pill">Esta semana</span></div>
              <ul class="list">
                <li class="home-habit-row"><span class="home-next-mark">${demoIcon('leaf', 19)}</span><span class="grow"><b>Alongar um pouquinho</b><span class="meta">2 dias nesta semana</span></span><span class="demo-habit-dots" aria-hidden="true"><i class="is-complete"></i><i class="is-complete"></i><i></i><i></i><i></i><i></i><i></i></span></li>
              </ul>
            </section>
          </div>
          <aside class="home-primary demo-side" aria-label="Outras áreas do Aurora">
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
        <section class="demo-cta"><div><h2>Acesse seus próprios registros</h2><p>Crie uma conta para usar o Aurora fora da demonstração.</p></div><div class="public-actions"><button class="btn primary" type="button" data-public-action="signup">Criar minha conta</button><button class="btn" type="button" data-public-action="landing">Voltar</button></div></section>
      </main>
      <footer class="app-footer public-footer demo-footer site-footer">${renderFooterContent()}</footer>
    </div>`;
}
