import { renderPublicHeader } from '../appearance/public-controls.js';
import { initializeFaqDisclosure } from '../footer/view.js';
import { iconSvg } from '../../utils/icons.js';
import { APP_URL, demo, login, privacy, signup } from './links.js';

const landingControllers = new WeakMap();
const landingState = { tutorialArea: 'hoje' };
const LANDING_TUTORIALS = [
  {
    id: 'hoje',
    title: 'Hoje',
    icon: 'sun',
    color: 'var(--area-plan)',
    heading: 'Veja o dia inteiro sem abrir três telas',
    description:
      'O que vence hoje, seus hábitos da semana e os próximos compromissos aparecem logo de cara — só o essencial, sem poluição.',
    steps: [
      'Prioridades e prazos do dia em destaque',
      'Anote uma ideia nova sem sair da tela',
      'Escolha exatamente quais blocos aparecem',
    ],
    image: '/src/assets/tutorials/landing/hoje.webp',
    imageMobile: '/assets/landing-areas/hoje-mobile.webp',
    alt: 'Tela inicial do Aurora mostrando o dia da Elisa com tarefas, próximos compromissos e resumo da semana.',
  },
  {
    id: 'tarefas',
    title: 'Tarefas',
    icon: 'calendarCheck',
    color: 'var(--area-plan)',
    heading: 'Tire da cabeça sem transformar tudo em urgência',
    description:
      'Anote rápido o que precisa resolver, defina prazo só quando fizer sentido e alterne entre lista, calendário ou visão semanal.',
    steps: ['Prazo, prioridade e tags em segundos', 'Lista, calendário mensal ou semana', 'Busca e filtros diretos'],
    image: '/src/assets/tutorials/landing/tarefas.webp',
    imageMobile: '/assets/landing-areas/tarefas-mobile.webp',
    alt: 'Tela de tarefas do Aurora com tarefas organizadas por prazo e prioridade.',
  },
  {
    id: 'habitos',
    title: 'Hábitos',
    icon: 'repeat',
    color: 'var(--area-habits)',
    heading: 'Constância leve, no ritmo da sua semana',
    description:
      'Escolha em quais dias quer praticar cada hábito, acompanhe sua hidratação e registre até dias anteriores quando esquecer.',
    steps: ['Dias flexíveis para cada hábito', 'Marque, pule ou registre outro dia', 'Meta diária de água integrada'],
    image: '/src/assets/tutorials/landing/habitos.webp',
    imageMobile: '/assets/landing-areas/habitos-mobile.webp',
    alt: 'Tela de hábitos do Aurora com acompanhamento semanal de leitura, caminhada, alongamento e água.',
  },
  {
    id: 'financas',
    title: 'Finanças',
    icon: 'wallet',
    color: 'var(--area-finances)',
    heading: 'Clareza sobre o mês, sem conectar seu banco',
    description:
      'Acompanhe contas, cartões, entradas, gastos e metas num só lugar para saber quanto ainda cabe no mês com tranquilidade.',
    steps: ['Contas, cartões e saldos claros', 'Orçamentos por categoria e metas', 'Gastos fixos e previsão do mês'],
    image: '/src/assets/tutorials/landing/financas.webp',
    imageMobile: '/assets/landing-areas/financas-mobile.webp',
    alt: 'Tela de finanças do Aurora com saldo mensal, contas, movimentações e metas.',
  },
  {
    id: 'ciclo',
    title: 'Ciclo',
    icon: 'heart',
    color: 'var(--area-cycle)',
    heading: 'Seu ciclo ao lado do resto da rotina',
    description:
      'Registre períodos, fluxo e sintomas e consulte o calendário e as médias com privacidade. Acompanhamento informativo que não substitui orientação médica.',
    steps: [
      'Registro simples de dias e sintomas',
      'Calendário claro e médias do ciclo',
      'Opcional e controlado por você',
    ],
    image: '/src/assets/tutorials/landing/ciclo.webp',
    imageMobile: '/assets/landing-areas/ciclo-mobile.webp',
    alt: 'Tela de ciclo do Aurora com calendário e acompanhamento informativo.',
  },
];

export function renderLanding(root) {
  landingControllers.get(root)?.();
  document.title = 'Aurora — tarefas, hábitos, finanças e ciclo num app só';
  if (!root.querySelector?.('.public-site[data-prerendered]')) root.innerHTML = landingMarkup();
  initializeLandingTutorials(root);
  initializeFaqDisclosure(root);
}

function initializeLandingTutorials(root) {
  const section = root.querySelector('[data-landing-areas]');
  if (!section) return;
  const tabs = [...section.querySelectorAll('[data-landing-tutorial-tab]')];
  const panels = [...section.querySelectorAll('[data-landing-tutorial-panel]')];
  if (!tabs.length || tabs.length !== panels.length) return;
  const selectArea = (area) => {
    const activeTab = tabs.find((tab) => tab.dataset.landingTutorialTab === area);
    if (!activeTab) return;
    tabs.forEach((tab) => {
      const selected = tab === activeTab;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    panels.forEach((panel) => {
      panel.hidden = panel.dataset.landingTutorialPanel !== area;
    });
    landingState.tutorialArea = area;
  };
  const onClick = (event) => {
    if (!(event.target instanceof Element)) return;
    const tab = event.target.closest('[data-landing-tutorial-tab]');
    if (tab && tabs.includes(tab)) selectArea(tab.dataset.landingTutorialTab);
  };
  const onKeyDown = (event) => {
    if (!(event.target instanceof Element)) return;
    const tab = event.target.closest('[data-landing-tutorial-tab]');
    const index = tabs.indexOf(tab);
    if (index < 0) return;
    const nextIndex =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? (index + 1) % tabs.length
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? (index - 1 + tabs.length) % tabs.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? tabs.length - 1
              : -1;
    if (nextIndex < 0) return;
    event.preventDefault();
    const nextTab = tabs[nextIndex];
    selectArea(nextTab.dataset.landingTutorialTab);
    nextTab.focus();
  };
  section.addEventListener('click', onClick);
  section.addEventListener('keydown', onKeyDown);
  landingControllers.set(root, () => {
    section.removeEventListener('click', onClick);
    section.removeEventListener('keydown', onKeyDown);
  });
  selectArea(landingState.tutorialArea);
}

function landingFooter() {
  const logo = new URL('../../../../icons/favicon.svg', import.meta.url).href;
  return `<footer class="landing-footer">
    <div class="landing-footer-card">
      <div class="landing-footer-primary">
        <a class="landing-footer-brand" href="${APP_URL}/" data-public-action="landing"
          aria-label="aurora., página inicial">
          <img src="${logo}" alt="" width="36" height="36"><span>aurora<span>.</span></span>
        </a>
        <p>Uma rotina inteira, num app só.</p>
        <a class="landing-footer-cta" href="${signup}" data-public-action="signup">
          Criar conta grátis ${iconSvg('arrow', 18)}
        </a>
      </div>
      <nav class="landing-footer-nav" aria-label="Links do Aurora">
        <div class="landing-footer-link-group">
          <h2>Começar</h2>
          <a href="${signup}" data-public-action="signup">Criar conta</a>
          <a href="${login}" data-public-action="login">Entrar</a>
          <a href="${demo}" data-public-action="demo">Demonstração</a>
        </div>
        <div class="landing-footer-link-group">
          <h2>Explorar</h2>
          <a href="#areas">Áreas da rotina</a>
          <a href="#steps">Como começar</a>
          <a href="#faq">Perguntas</a>
          <button type="button" class="landing-footer-link" data-action="pwa-install">Instalar app</button>
        </div>
        <div class="landing-footer-link-group">
          <h2>Legal</h2>
          <a href="${privacy}">Privacidade</a>
          <a href="${APP_URL}/terms.html">Termos de uso</a>
        </div>
      </nav>
      <div class="landing-footer-meta">
        <p>© ${new Date().getFullYear()} Aurora</p>
        <a class="landing-footer-top" href="#landing-main">Voltar ao topo</a>
      </div>
    </div>
  </footer>`;
}

export function landingMarkup() {
  const activeTutorialArea = LANDING_TUTORIALS.some(({ id }) => id === landingState.tutorialArea)
    ? landingState.tutorialArea
    : 'hoje';
  return `
    <div class="public-site landing-marketing">
      <a class="skip" href="#landing-main" data-public-action="skip">Pular para o conteúdo principal</a>
      ${renderPublicHeader()}
      <main class="public-main" id="landing-main" tabindex="-1">
        <section class="public-hero landing-hero" aria-labelledby="landing-title">
          <div class="landing-hero-copy">
            <h1 id="landing-title" class="type-editorial-display">Sua rotina inteira,<br><em>num app só.</em></h1>
            <p class="landing-hero-lead">Abra pela manhã e veja em segundos o que realmente importa hoje — tarefas, hábitos, finanças e ciclo num espaço calmo, sem planilhas nem cinco apps disputando sua atenção.</p>
            <div class="landing-hero-actions">
              <a class="btn primary large" href="${signup}"
                data-public-action="signup">Criar minha conta grátis</a>
              <a class="landing-hero-secondary" href="${demo}" data-public-action="demo">Testar na demonstração</a>
            </div>
            <ul class="landing-proof-list" aria-label="Informações rápidas">
              <li>Grátis, sem cartão</li><li>No navegador ou no celular</li><li>Em português</li>
            </ul>
          </div>
        </section>

        <section class="public-tutorials landing-section" id="areas" aria-labelledby="public-tutorials-title"
          data-landing-areas>
          <div class="public-section-heading landing-section-heading">
            <h2 id="public-tutorials-title"
              class="type-editorial-title">Um lugar calmo para cada parte do dia.</h2>
          </div>
          <div class="landing-tutorial-tabs" role="tablist" aria-label="Áreas da sua rotina">
            ${LANDING_TUTORIALS.map((area) => {
              const selected = area.id === activeTutorialArea;
              return `<button type="button" class="landing-tutorial-tab" role="tab" id="landing-tutorial-tab-${area.id}"
                aria-controls="landing-tutorial-panel-${area.id}" aria-selected="${selected}"
                tabindex="${selected ? '0' : '-1'}" data-landing-tutorial-tab="${area.id}"
                style="--area-icon:${area.color}"><span
                class="landing-tab-icon">${iconSvg(area.icon, 20)}</span>${area.title}</button>`;
            }).join('')}
          </div>
          <div class="landing-tutorial-panels">
            ${LANDING_TUTORIALS.map((area) => {
              const selected = area.id === activeTutorialArea;
              return `<section class="landing-tutorial-panel" role="tabpanel" id="landing-tutorial-panel-${area.id}"
                aria-labelledby="landing-tutorial-tab-${area.id}" tabindex="0" data-landing-tutorial-panel="${area.id}"
                data-area="${area.id}"${selected ? '' : ' hidden'}>
                <div class="landing-area-copy">
                  <h3>${area.heading}</h3>
                  <p>${area.description}</p>
                  <ul>${area.steps.map((step) => `<li>${step}</li>`).join('')}</ul>
                </div>
                <div class="landing-area-preview">
                  <div class="landing-preview-chrome" aria-hidden="true"><i></i><i></i><i></i></div>
                  <picture class="landing-screen-light">
                    <source media="(max-width: 700px)" srcset="${area.imageMobile} 2x" type="image/webp">
                    <img src="${area.image}" alt="${area.alt}" loading="lazy" width="1280" height="720">
                  </picture>
                  <picture class="landing-screen-dark">
                    <source media="(max-width: 700px)"
                      srcset="${area.imageMobile.replace('-mobile.webp', '-mobile-dark.webp')} 2x" type="image/webp">
                    <img src="${area.image.replace('.webp', '-dark.webp')}" alt="${area.alt}" loading="lazy"
                      width="1280" height="720">
                  </picture>
                </div>
              </section>`;
            }).join('')}
          </div>
        </section>

        <section class="landing-steps landing-section" id="steps" aria-labelledby="landing-steps-title">
          <div class="public-section-heading landing-section-heading">
            <h2 id="landing-steps-title" class="type-editorial-title">Comece em um minuto.</h2>
          </div>
          <ol class="landing-steps-grid">
            <li><span>01</span><h3>Despeje o que está na mente</h3><p>Anote pendências, ideias e contas soltas em segundos, sem a pressão de categorizar tudo no primeiro instante.</p></li>
            <li><span>02</span><h3>Ajuste aos seus ritmos</h3><p>Escolha quais hábitos praticar nos dias certos e defina metas reais para o mês. O app se molda à sua rotina viva.</p></li>
            <li><span>03</span><h3>Comece a manhã com calma</h3><p>A tela Hoje reúne as prioridades imediatas. O que não é para hoje fica guardado, sem gerar ruído ou sobrecarga.</p></li>
          </ol>
        </section>

        <section class="public-trust landing-trust landing-section" aria-labelledby="public-trust-title">
          <div class="public-section-heading landing-section-heading">
            <h2 id="public-trust-title" class="type-editorial-title">Feito para dar paz, não para prender sua atenção.</h2>
            <p class="landing-trust-privacy">Quer ler os detalhes? <a
              href="${privacy}">Política de Privacidade</a>.</p>
          </div>
          <div class="landing-trust-grid">
            <article><div><h3>Espaço limpo e sem distrações</h3><p>Ambiente pensado para o seu foco: sem anúncios, sem notificações caça-cliques e sem truques para reter sua atenção.</p></div></article>
            <article><div><h3>Seus dados pertencem a você</h3><p>Nada de dados trancados. Baixe uma cópia completa dos seus registros a qualquer momento ou exclua sua conta em segundos direto nos Ajustes.</p></div></article>
            <article><div><h3>Sem conexão com bancos</h3><p>Controle financeiro seguro e sob seu domínio: você anota o que desejar sem nunca precisar compartilhar senhas ou chaves bancárias.</p></div></article>
            <article><div><h3>Funciona no computador e no celular</h3><p>Acesse pelo navegador ou adicione à tela inicial com um toque. Rápido, leve e pronto para acompanhar sua rotina em qualquer dispositivo.</p></div></article>
          </div>
        </section>

        <section class="public-faq landing-faq landing-section" id="faq" aria-labelledby="public-faq-title">
          <div class="public-section-heading landing-section-heading">
            <h2 id="public-faq-title" class="type-editorial-title">Perguntas frequentes.</h2>
          </div>
          <div class="public-faq-list">
            <details class="public-faq-item" name="landing-faq">
              <summary>O Aurora é realmente gratuito?</summary>
              <p>Sim, 100% gratuito. Não há assinaturas pagas escondidas, limite artificial no número de tarefas ou cobranças futuras.</p>
            </details>
            <details class="public-faq-item" name="landing-faq">
              <summary>Posso testar antes de criar conta?</summary>
              <p>Pode. A demonstração interativa traz dados de exemplo para você experimentar as telas de tarefas, hábitos e finanças na prática, sem precisar informar seu e-mail.</p>
            </details>
            <details class="public-faq-item" name="landing-faq">
              <summary>Preciso instalar pela loja de aplicativos?</summary>
              <p>Não é obrigatório. O Aurora roda direto no navegador e pode ser instalado na tela de início do seu Android ou iPhone com um toque (PWA), ocupando quase nenhum espaço.</p>
            </details>
            <details class="public-faq-item" name="landing-faq">
              <summary>Como funcionam as finanças sem integração bancária?</summary>
              <p>Você tem total autonomia e privacidade: registra suas despesas, receitas e cartões no seu ritmo, acompanhando orçamentos e saldo mensal sem nunca expor suas credenciais bancárias.</p>
            </details>
            <details class="public-faq-item" name="landing-faq">
              <summary>Posso levar meus dados ou apagar a conta?</summary>
              <p>Sim. Em Ajustes, você pode exportar um backup legível de todos os seus registros ou iniciar a exclusão imediata e definitiva da sua conta e de todos os dados associados.</p>
            </details>
            <details class="public-faq-item" name="landing-faq">
              <summary>O que posso fazer em Ciclo?</summary>
              <p>Com seu consentimento, você anota datas e sintomas e consulta médias. É um acompanhamento informativo e não substitui orientação de um profissional de saúde.</p>
            </details>
          </div>
        </section>

        <section class="public-closing landing-final-cta landing-section" aria-labelledby="public-closing-title">
          <h2 id="public-closing-title"
            class="type-editorial-title">Menos coisa na cabeça.<br><em>Mais dia para viver.</em></h2>
          <p>Comece em poucos minutos e sinta o alívio de uma rotina com clareza e sem ansiedade.</p>
          <div class="landing-final-actions">
            <a class="btn primary large" href="${signup}"
              data-public-action="signup">Criar minha conta grátis</a>
            <a class="landing-text-link" href="${demo}" data-public-action="demo">ou explorar a demonstração</a>
          </div>
        </section>
      </main>
      ${landingFooter()}
      <a class="public-mobile-cta btn primary" href="${signup}" data-public-action="signup" aria-hidden="true"
        hidden>Criar minha conta grátis</a>
    </div>`;
}
