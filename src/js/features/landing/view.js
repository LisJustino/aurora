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
    alt: 'Tela inicial do Aurora mostrando o dia da Marina com tarefas, próximos compromissos e resumo da semana.',
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
    steps: ['Contas, cartões e saldos claros', 'Orçamentos por categoria e metas', 'Nenhuma senha bancária solicitada'],
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
  const desktopLight = '/src/assets/landing-desktop.webp';
  const desktopDark = '/src/assets/landing-desktop-dark.webp';
  const mobileLight = '/src/assets/landing-mobile.webp';
  const mobileDark = '/src/assets/landing-mobile-dark.webp';
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
          <figure class="landing-hero-visual">
            <div class="landing-hero-desktop">
              <picture class="landing-screen-light">
                <source media="(max-width: 700px)" srcset="${mobileLight}" type="image/webp">
                <img src="${desktopLight}" width="1280" height="760"
                  alt="Tela inicial do Aurora no modo claro, com tarefas do dia, próximos compromissos e resumo da semana."
                  fetchpriority="high">
              </picture>
              <picture class="landing-screen-dark">
                <source media="(max-width: 700px)" srcset="${mobileDark}" type="image/webp">
                <img src="${desktopDark}" width="1280" height="760"
                  alt="Tela inicial do Aurora no modo escuro, com tarefas do dia, próximos compromissos e resumo da semana."
                  decoding="async">
              </picture>
            </div>
            <figcaption class="visually-hidden">O Aurora funciona no computador e no celular.</figcaption>
          </figure>
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
            <li><span>01</span><h3>Crie sua conta grátis</h3><p>Sem cartão e sem precisar baixar nada — abre direto no navegador ou como app no celular.</p></li>
            <li><span>02</span><h3>Despeje o que está na cabeça</h3><p>Anote tarefas, contas, hábitos e compromissos sem se preocupar em organizar tudo de uma vez.</p></li>
            <li><span>03</span><h3>Abra todo dia com clareza</h3><p>O Aurora traz para a frente só o que importa hoje. O resto espera com calma até a hora certa.</p></li>
          </ol>
        </section>

        <section class="public-trust landing-trust landing-section" aria-labelledby="public-trust-title">
          <div class="public-section-heading landing-section-heading">
            <h2 id="public-trust-title" class="type-editorial-title">Feito para dar paz, não para prender sua atenção.</h2>
            <p class="landing-trust-privacy">Quer ler os detalhes? <a
              href="${privacy}">Política de Privacidade</a>.</p>
          </div>
          <div class="landing-trust-grid">
            <article><div><h3>Grátis de verdade</h3><p>Você usa todas as áreas sem assinatura, sem anúncios e sem informar cartão.</p></div></article>
            <article><div><h3>Seus dados pertencem a você</h3><p>Exporte uma cópia completa dos seus registros ou apague sua conta quando quiser, direto nos Ajustes.</p></div></article>
            <article><div><h3>Sem conexão com bancos</h3><p>Você anota apenas o que quiser acompanhar. Nenhuma conta bancária ou senha financeira é pedida.</p></div></article>
            <article><div><h3>Funciona no computador e no celular</h3><p>Adicione à tela inicial no Android ou no iPhone e abra com um toque, igual a um app nativo.</p></div></article>
          </div>
        </section>

        <section class="public-faq landing-faq landing-section" id="faq" aria-labelledby="public-faq-title">
          <div class="public-section-heading landing-section-heading">
            <h2 id="public-faq-title" class="type-editorial-title">Perguntas frequentes.</h2>
          </div>
          <div class="public-faq-list">
            <details class="public-faq-item" name="landing-faq">
              <summary>O Aurora é grátis?</summary>
              <p>Sim. É grátis e você não precisa informar cartão.</p>
            </details>
            <details class="public-faq-item" name="landing-faq">
              <summary>Posso testar antes de criar conta?</summary>
              <p>Pode. A demonstração usa dados de exemplo: você adiciona uma tarefa e marca um hábito para ver como funciona. Nada fica salvo quando você sai.</p>
            </details>
            <details class="public-faq-item" name="landing-faq">
              <summary>Preciso baixar alguma coisa?</summary>
              <p>Não. O Aurora funciona pelo navegador do celular ou do computador. Se quiser, adicione um atalho na tela inicial do celular.</p>
            </details>
            <details class="public-faq-item" name="landing-faq">
              <summary>O Aurora se conecta ao meu banco?</summary>
              <p>Não. Ele não acessa sua conta bancária. Você anota cada receita, despesa ou cartão.</p>
            </details>
            <details class="public-faq-item" name="landing-faq">
              <summary>Posso levar meus dados ou apagar a conta?</summary>
              <p>Sim. Em Ajustes, você baixa uma cópia dos seus registros ou inicia a exclusão da conta e dos dados.</p>
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
          <p>Crie sua conta grátis e comece a organizar o que importa hoje.</p>
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
