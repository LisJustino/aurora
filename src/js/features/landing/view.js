import { iconSvg as demoIcon } from '../../utils/icons.js';
import { renderPublicHeader } from '../appearance/public-controls.js';
import { initializeFaqDisclosure, renderFooterContent } from '../footer/view.js';
import { renderLandingDemo, stopLandingDemo } from './demo.js';

export { renderLandingDemo };

function publicHeader() {
  return renderPublicHeader();
}

function publicFooter({ demoAvailable = false } = {}) {
  return `<footer class="app-footer public-footer site-footer">${renderFooterContent({ demoAvailable, includeFaq: false, pwaInstall: true, suggestionForm: true })}</footer>`;
}

export function renderLanding(root) {
  stopLandingDemo(root);
  document.title = 'aurora. — planner semanal, hábitos e finanças em um só lugar';
  const prerendered = Boolean(root.querySelector?.('.public-site[data-prerendered]'));
  root.innerHTML = landingMarkup();
  if (prerendered) {
    // Evita repetir a animação de entrada sobre o conteúdo já exibido.
    root.querySelector('.public-main')?.classList.add('is-hydrated');
  }
  initializeFaqDisclosure(root);
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
            <p class="public-subtitle">Planner de tarefas, hábitos, foco e finanças em um só lugar.</p>
            <p class="public-lead">Abra uma tela, veja o que importa hoje e dê o próximo passo em segundos — sem lista infinita e sem culpa.</p>
            <div class="public-actions">
              <a class="btn primary large" href="/criar-conta" data-public-action="signup">Começar grátis</a>
              <a class="btn large" href="#public-features">Ver demo em 1 minuto</a>
            </div>
            <p class="public-price-note"><strong>Totalmente grátis.</strong> Sem cartão de crédito.</p>
          </div>
          <figure class="product-preview" aria-label="Prévia visual das áreas do Aurora">
            <div class="preview-float preview-tasks" aria-hidden="true">
              <span class="preview-task-heading">Para hoje <b>3</b><small>2 de 3 feitas</small></span>
              <span class="preview-task-progress"><i></i></span>
              <span class="preview-task-row is-done"><i>✓</i><span><b>Organizar a semana</b><small>Concluída</small></span></span>
              <span class="preview-task-row is-done"><i>✓</i><span><b>Responder uma mensagem</b><small>Concluída</small></span></span>
              <span class="preview-task-row is-current"><i></i><span><b>Ler por alguns minutos</b><small>Seu próximo passo</small></span></span>
            </div>
            <div class="preview-float preview-focus" aria-hidden="true">
              <span class="preview-float-label">${demoIcon('clock', 15)} Foco</span>
              <strong>25:00</strong>
              <span class="preview-float-note">Pomodoro</span>
            </div>
            <div class="preview-float preview-habits" aria-hidden="true">
              <span class="preview-float-label">${demoIcon('leaf', 15)} Hábitos <b>5/7</b></span>
              <span class="preview-habit-caption">Beber água</span>
              <span class="preview-habit-dots"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span>
            </div>
            <div class="preview-float preview-finance" aria-hidden="true">
              <span class="preview-float-label">${demoIcon('wallet', 15)} Finanças</span>
              <span class="preview-float-note">Saldo do mês</span>
              <strong>R$ 1.240</strong>
              <span class="preview-finance-bars"><i></i><i></i><i></i><i></i><i></i></span>
            </div>
          </figure>
          <div class="public-hero-support">
            <ul class="public-proof" aria-label="Informações práticas sobre o Aurora">
              <li><strong>Veja funcionando em 1 minuto</strong><span>demonstração sem cadastro</span></li>
                            <li><strong>Tudo em um app só</strong><span>tarefas, hábitos, foco, finanças e ciclo</span></li>
                            <li><strong>Finanças manuais</strong><span>sem conexão bancária, você registra o que quiser</span></li>
            </ul>
          </div>
        </section>
        <section class="public-maker" aria-labelledby="public-maker-title">
          <span class="public-value-icon" aria-hidden="true">${demoIcon('heart', 22)}</span>
          <div>
            <h2 id="public-maker-title">Feito por uma pessoa só, com cuidado</h2>
            <p>O Aurora é criado e mantido por Elisa da Silva Justino. É grátis, está em evolução e as sugestões chegam direto a ela — use o formulário no rodapé.</p>
          </div>
        </section>
        <section class="public-features" id="public-features" aria-labelledby="public-features-title">
          <div class="public-section-heading"><p class="public-eyebrow">Da cabeça cheia a um próximo passo possível</p><h2 id="public-features-title">Cinco áreas, no seu ritmo</h2><p class="public-section-lead">Veja como Planejar, Foco, Hábitos, Finanças e Ciclo se encaixam na sua rotina. Comece por uma área e explore as outras quando quiser.</p></div>
          <ol class="public-journey-grid" aria-label="Como o Aurora ajuda no dia a dia">
            <li class="public-journey-step"><span class="public-journey-number" aria-hidden="true">01</span><div><h3>Despeje tudo</h3><p>Anote como vier; o que não tem data fica guardado.</p></div></li>
            <li class="public-journey-step"><span class="public-journey-number" aria-hidden="true">02</span><div><h3>Veja só o que cabe hoje</h3><p>Dia puxado? Reduza o plano em vez de abandonar tudo.</p></div></li>
            <li class="public-journey-step"><span class="public-journey-number" aria-hidden="true">03</span><div><h3>Perceba o que avançou</h3><p>Veja conclusões, hábitos e para onde foi o dinheiro.</p></div></li>
          </ol>
          <div class="public-values" aria-label="Demonstração visual das cinco áreas">
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
            <span class="public-value-icon" aria-hidden="true">${demoIcon('clock', 22)}</span>
            <div><h3>Foco</h3><p>Personalize os períodos de foco e pausa; use o Pomodoro com ou sem uma tarefa.</p></div>
            <div class="public-value-preview preview-area-focus" aria-hidden="true">
              <div class="preview-focus-dial"><strong>25:00</strong></div>
              <span class="preview-focus-caption">Foco · 25 min</span>
              <span class="preview-focus-caption is-muted">Pausa · 5 min</span>
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
            <div><h3>Ciclo</h3><p>Acompanhe períodos e sintomas. As informações são gerais e não substituem orientação profissional.</p></div>
            <div class="public-value-preview preview-area-cycle" aria-hidden="true">
              <span class="preview-cycle-week"><i>S</i><i>T</i><i>Q</i><i>Q</i><i>S</i><i>S</i><i>D</i></span>
              <span class="preview-cycle-days"><i>2</i><i class="is-period">3</i><i class="is-period">4</i><i class="is-period">5</i><i>6</i><i>7</i><i>8</i></span>
              <span class="preview-cycle-note">${demoIcon('lock', 13)} Dados privados da sua conta</span>
            </div>
          </article>
          </div>
        </section>
        <section class="public-cta-panel" aria-labelledby="public-cta-title">
          <div class="public-cta-copy">
            <p class="public-eyebrow">Grátis, sem cartão de crédito</p>
            <h2 id="public-cta-title">Escolha como quer começar</h2>
            <p>Sinta o Aurora na prática com a demonstração (exemplos fictícios, sem cadastro e sem salvar alterações) ou crie sua conta e comece com os seus próprios registros.</p>
            <p class="public-install-note">${demoIcon('download', 16)}<span>Instale no celular: adicione o Aurora à tela inicial e use como um app.</span></p>
          </div>
          <div class="public-actions">
            <a class="btn primary large" href="/criar-conta" data-public-action="signup">Criar minha conta grátis</a>
            <a class="btn large" href="#public-features">Ver a demonstração</a>
          </div>
        </section>
        <section class="public-faq" aria-labelledby="public-faq-title">
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
              <p>Sim. A página se adapta a telas pequenas e pode ser instalada como app: no navegador, use “Baixar o app” no rodapé ou “Adicionar à tela inicial”. Ela abre em tela cheia, mas precisa de conexão para gravar seus dados.</p>
            </details>
            <details class="card public-faq-item">
              <summary>Posso exportar meus dados?${demoIcon('chevDown', 16)}</summary>
              <p>Sim. Em Ajustes você baixa um backup em JSON com seus registros, com opção de proteger o arquivo com senha. As Finanças também exportam em CSV.</p>
            </details>
            <details class="card public-faq-item">
              <summary>Como meus dados são protegidos?${demoIcon('chevDown', 16)}</summary>
              <p>Os registros salvos ficam associados à sua conta, e as regras de acesso do banco restringem os dados à conta autenticada. Eles não são criptografados de ponta a ponta. Leia a <a href="./privacy.html" target="_blank" rel="noopener noreferrer">Política de Privacidade</a> para conhecer detalhes e limitações.</p>
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
                  <p>Não. O acesso é liberado assim que a conta é criada. Confira o endereço antes: um erro de digitação pode impedir a recuperação da senha.</p>
                </details>
                <details class="card public-faq-item">
                  <summary>Posso apagar minha conta?${demoIcon('chevDown', 16)}</summary>
                  <p>Sim. Você pode iniciar a exclusão permanente nas configurações; o Aurora pede confirmação antes de apagar a conta e os dados associados.</p>
                </details>
                <details class="card public-faq-item">
                  <summary>A demonstração usa meus dados?${demoIcon('chevDown', 16)}</summary>
                  <p>Não. Ela usa apenas informações fictícias, não acessa sua conta e não salva alterações.</p>
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
                  <p>Elisa da Silva Justino: <a href="mailto:lisjustino@gmail.com">lisjustino@gmail.com</a>. Você também pode enviar uma sugestão pelo formulário no rodapé.</p>
                </details>
              </div>
            </details>
          </div>
        </section>
      </main>
      ${publicFooter({ demoAvailable: true })}
    </div>`;
}
