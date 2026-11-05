import { iconSvg as demoIcon } from '../../utils/icons.js';
import { renderPublicHeader } from '../appearance/public-controls.js';
import { initializeFaqDisclosure, renderFooterContent } from '../footer/view.js';
import { renderLandingDemo, stopLandingDemo } from './demo.js';

export { renderLandingDemo };

function publicHeader() {
  return renderPublicHeader();
}

function publicFooter({ demoAvailable = false } = {}) {
  return `<footer class="app-footer public-footer site-footer">${renderFooterContent({ demoAvailable, includeFaq: false, pwaInstall: true })}</footer>`;
}

export function renderLanding(root) {
  stopLandingDemo(root);
  document.title = 'aurora. — mais clareza para a sua rotina';
  root.innerHTML = `
    <div class="public-site">
      <a class="skip" href="#landing-main" data-public-action="skip">Pular para o conteúdo principal</a>
      ${publicHeader()}
      <main class="public-main" id="landing-main" tabindex="-1">
        <section class="public-hero public-hero-card" aria-labelledby="landing-title">
          <div class="public-copy">
            <p class="public-eyebrow"><span aria-hidden="true"></span> Planner pessoal para quem vive com a cabeça cheia</p>
            <h1 id="landing-title">Menos ruído. Mais clareza no dia<span>.</span></h1>
            <p class="public-lead">Chega de alternar entre agenda, notas, app de hábitos e planilha de gastos. No Aurora você abre uma tela, vê o que importa hoje e dá o próximo passo em segundos — sem lista infinita e sem culpa quando o dia foge do plano.</p>
            <div class="public-actions">
              <button class="btn primary large" type="button" data-public-action="signup">Criar conta</button>
              <button class="btn large" type="button" data-public-action="demo">Explorar demonstração</button>
            </div>
          </div>
          <figure class="product-preview">
            <picture class="preview-picture preview-picture-light">
              <source media="(max-width: 700px)" srcset="./src/assets/landing-mobile.png" width="716" height="716">
              <img class="preview-capture" src="./src/assets/landing-desktop.png" alt="Prévia ilustrativa do card Para hoje, com três tarefas de exemplo." width="1274" height="716" decoding="async" fetchpriority="high">
            </picture>
            <picture class="preview-picture preview-picture-dark" aria-hidden="true">
              <source media="(max-width: 700px)" srcset="./src/assets/landing-mobile-dark.png" width="716" height="716">
              <img class="preview-capture" src="./src/assets/landing-desktop-dark.png" alt="" width="1274" height="716" decoding="async">
            </picture>
          </figure>
          <div class="public-hero-support">
            <ul class="public-proof" aria-label="Informações práticas sobre o Aurora">
              <li><strong>Veja funcionando em 1 minuto</strong><span>demonstração sem cadastro</span></li>
                            <li><strong>Tudo em um app só</strong><span>tarefas, hábitos, foco, finanças e ciclo</span></li>
                            <li><strong>Finanças manuais</strong><span>sem conexão bancária, você registra o que quiser</span></li>
            </ul>
            <p class="public-reassurance">${demoIcon('lock', 17)}<span>Na demonstração, tarefas, hábitos e Pomodoro usam exemplos fictícios; suas alterações não são salvas nem sincronizadas.</span></p>
          </div>
        </section>
        <section class="public-journey" aria-labelledby="public-journey-title">
          <div class="public-section-heading">
            <p class="public-eyebrow">Um jeito mais leve de se organizar</p>
            <h2 id="public-journey-title">Da cabeça cheia a um próximo passo possível</h2>
            <p class="public-section-lead">Você não precisa organizar a vida inteira de uma vez. O Aurora ajuda a cuidar do agora e a ajustar o caminho com o tempo.</p>
          </div>
          <div class="public-journey-grid">
            <article class="card public-journey-step">
              <span class="public-journey-number" aria-hidden="true">01</span>
              <span class="public-value-icon" aria-hidden="true">${demoIcon('calendarCheck', 22)}</span>
              <div><h3>Despeje tudo, sem organizar</h3><p>Anote tarefas e compromissos como vierem. O que não tem data fica guardado para decidir depois.</p></div>
            </article>
            <article class="card public-journey-step">
              <span class="public-journey-number" aria-hidden="true">02</span>
              <span class="public-value-icon" aria-hidden="true">${demoIcon('leaf', 22)}</span>
              <div><h3>Veja só o que cabe hoje</h3><p>Uma tela com suas tarefas, hábitos e um timer de foco. Dia puxado? Reduza o plano em vez de abandonar tudo.</p></div>
            </article>
            <article class="card public-journey-step">
              <span class="public-journey-number" aria-hidden="true">03</span>
              <span class="public-value-icon" aria-hidden="true">${demoIcon('chart', 22)}</span>
              <div><h3>Perceba o que avançou</h3><p>No fim da semana, veja o que você concluiu, quais hábitos se mantiveram e para onde foi o dinheiro.</p></div>
            </article>
          </div>
        </section>
        <section class="public-features" aria-labelledby="public-features-title">
          <div class="public-section-heading"><p class="public-eyebrow">Use o que fizer sentido para você</p><h2 id="public-features-title">Sua rotina, em um só lugar</h2><p class="public-section-lead">Comece por uma área e acrescente outras quando precisar. Nada exige que você use tudo.</p></div>
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
          <div class="public-cta-copy">
            <p class="public-eyebrow">Comece pelo que mais pede atenção</p>
            <h2 id="public-cta-title">Escolha como quer começar</h2>
            <p>Sinta o Aurora na prática com a demonstração (exemplos fictícios, sem cadastro e sem salvar alterações) ou crie sua conta e comece com os seus próprios registros.</p>
          </div>
          <div class="public-actions">
            <button class="btn primary large" type="button" data-public-action="signup">Criar conta</button>
            <button class="btn large" type="button" data-public-action="demo">Explorar demonstração</button>
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
              <p>Os registros salvos ficam associados à sua conta, e as regras de acesso do banco restringem os dados à conta autenticada. Eles não são criptografados de ponta a ponta. Leia a <a href="./privacy.html" target="_blank" rel="noopener noreferrer">Política de Privacidade</a> para conhecer detalhes e limitações.</p>
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
              <p>Sim. Você pode iniciar a exclusão permanente nas configurações; o Aurora pede confirmação antes de apagar a conta e os dados associados.</p>
            </details>
            <details class="card public-faq-item">
              <summary>A demonstração usa meus dados?${demoIcon('chevDown', 16)}</summary>
              <p>Não. Ela usa apenas informações fictícias, não acessa sua conta e não salva alterações.</p>
            </details>
            <details class="public-faq-more">
              <summary>Ver todas as perguntas${demoIcon('chevDown', 16)}</summary>
              <div class="public-faq-extra">
                <details class="card public-faq-item">
                  <summary>Preciso de uma conta?${demoIcon('chevDown', 16)}</summary>
                  <p>Você pode explorar a demonstração sem cadastro. Para guardar seus próprios registros, crie uma conta.</p>
                </details>
                <details class="card public-faq-item">
                  <summary>O que acontece sem conexão?${demoIcon('chevDown', 16)}</summary>
                  <p>O Aurora avisa quando está sem conexão e bloqueia novas gravações. Alterações offline não são sincronizadas automaticamente.</p>
                </details>
                <details class="card public-faq-item">
                  <summary>Como envio uma sugestão?${demoIcon('chevDown', 16)}</summary>
                  <p>O formulário abaixo abre o aplicativo de e-mail configurado no seu dispositivo. Confira a mensagem e toque em Enviar; o Aurora não recebe nem guarda o rascunho. Não inclua senhas nem informações pessoais sensíveis.</p>
                  <form class="footer-suggestion-form" data-footer-suggestion>
                    <label for="footer-suggestion-name">Seu nome (opcional)</label>
                    <input id="footer-suggestion-name" name="name" type="text" maxlength="100" autocomplete="name">
                    <label for="footer-suggestion-email">E-mail para resposta (opcional)</label>
                    <input id="footer-suggestion-email" name="email" type="email" maxlength="254" autocomplete="email">
                    <label for="footer-suggestion-message">Sua sugestão</label>
                    <textarea id="footer-suggestion-message" name="message" rows="4" maxlength="2000" required></textarea>
                    <p class="notice warn full" data-suggestion-error role="alert" hidden></p>
                    <button class="btn ghost" type="submit">Abrir meu e-mail para enviar</button>
                  </form>
                </details>
                <details class="card public-faq-item">
                  <summary>Como entro em contato com quem criou o Aurora?${demoIcon('chevDown', 16)}</summary>
                  <p>Elisa da Silva Justino: <a href="mailto:lisjustino@gmail.com">lisjustino@gmail.com</a>.</p>
                </details>
              </div>
            </details>
          </div>
        </section>
      </main>
      ${publicFooter({ demoAvailable: true })}
    </div>`;
  initializeFaqDisclosure(root);
}
