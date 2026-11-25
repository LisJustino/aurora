import { renderPublicHeader } from '../appearance/public-controls.js';
import { initializeFaqDisclosure } from '../footer/view.js';
import { iconSvg } from '../../utils/icons.js';
import { APP_URL, demo, login, privacy, signup } from './links.js';
import { renderLandingDemo, stopLandingDemo } from './demo.js';

export { renderLandingDemo };

const landingControllers = new WeakMap();
const landingState = { tutorialArea: 'hoje' };
const LANDING_TUTORIALS = [
  {
    id: 'hoje',
    title: 'Hoje',
    icon: 'sun',
    color: 'var(--area-plan)',
    heading: 'O seu dia, numa tela só',
    description: 'Ao abrir o Aurora, você vê na hora o que é para hoje: tarefas e hábitos organizados na sua tela.',
    steps: [
      'Tarefas atrasadas e do dia em destaque',
      'Anote algo novo sem sair da tela',
      'Escolha quais blocos aparecem',
    ],
    image: '/src/assets/tutorials/landing/hoje.webp',
    imageMobile: '/assets/landing-areas/hoje-mobile.webp',
    alt: 'Tela inicial do Aurora com tarefas e hábitos para o dia.',
  },
  {
    id: 'tarefas',
    title: 'Tarefas',
    icon: 'calendarCheck',
    color: 'var(--area-plan)',
    heading: 'Tire as pendências da cabeça',
    description:
      'Anote o que precisa fazer, com prazo e prioridade se quiser, e veja tudo em lista, calendário ou semana.',
    steps: [
      'Prazo e prioridade em segundos',
      'Lista, calendário ou visão da semana',
      'Busca e filtros para achar qualquer coisa',
    ],
    image: '/src/assets/tutorials/landing/tarefas.webp',
    imageMobile: '/assets/landing-areas/tarefas-mobile.webp',
    alt: 'Tela de tarefas do Aurora com opções de lista, calendário e semana.',
  },
  {
    id: 'habitos',
    title: 'Hábitos',
    icon: 'repeat',
    color: 'var(--area-habits)',
    heading: 'Hábitos que cabem na sua semana',
    description: 'Escolha o que quer repetir e em quais dias. Quando a rotina mudar, é só ajustar.',
    steps: ['Dias da semana para cada hábito', 'Marque o que fez ou pule um dia', 'Sequência e meta de água'],
    image: '/src/assets/tutorials/landing/habitos.webp',
    imageMobile: '/assets/landing-areas/habitos-mobile.webp',
    alt: 'Tela de hábitos do Aurora com acompanhamento semanal.',
  },
  {
    id: 'financas',
    title: 'Finanças',
    icon: 'wallet',
    color: 'var(--area-finances)',
    heading: 'Saiba para onde vai o dinheiro',
    description:
      'Anote contas, receitas e despesas para acompanhar o que entra e o que sai. O Aurora não acessa seu banco.',
    steps: ['Contas e saldos num só lugar', 'Receitas, despesas e transferências', 'Relatórios para entender o mês'],
    image: '/src/assets/tutorials/landing/financas.webp',
    imageMobile: '/assets/landing-areas/financas-mobile.webp',
    alt: 'Tela de finanças do Aurora com contas e lançamentos.',
  },
  {
    id: 'ciclo',
    title: 'Ciclo',
    icon: 'heart',
    color: 'var(--area-cycle)',
    heading: 'Seu ciclo junto com o resto da rotina',
    description:
      'Anote períodos e sintomas e consulte datas e médias. É um acompanhamento informativo e as estimativas podem variar.',
    steps: ['Início e fim de cada período', 'Sintomas e observações do dia', 'Calendário e médias do ciclo'],
    image: '/src/assets/tutorials/landing/ciclo.webp',
    imageMobile: '/assets/landing-areas/ciclo-mobile.webp',
    alt: 'Tela de Ciclo do Aurora com calendário e registros informativos.',
  },
];

export function renderLanding(root) {
  landingControllers.get(root)?.();
  stopLandingDemo(root);
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
            <p class="public-eyebrow">App de organização pessoal</p>
            <h1 id="landing-title" class="type-editorial-display">Sua rotina inteira,<br><em>num app só.</em></h1>
            <p class="landing-hero-lead">Tarefas, hábitos, finanças e ciclo no mesmo lugar. Abra, veja o que é para hoje e deixe o resto para depois, sem planilha e sem cinco apps diferentes.</p>
            <div class="landing-hero-actions">
              <a class="btn primary large" href="${signup}"
                data-public-action="signup">Criar minha conta grátis ${iconSvg('arrow', 20)}</a>
              <a class="btn ghost large" href="${demo}" data-public-action="demo">Testar sem cadastro</a>
            </div>
            <ul class="landing-proof-list" aria-label="Informações rápidas">
              <li>Grátis, sem cartão</li><li>Funciona no celular</li><li>Em português</li>
            </ul>
          </div>
          <figure class="landing-hero-visual">
            <div class="landing-hero-desktop">
              <img class="landing-screen-light" src="${desktopLight}" width="1280" height="720"
                alt="Visão clara do Aurora no computador, com tarefas e áreas da rotina organizadas."
                fetchpriority="high">
              <img class="landing-screen-dark" src="${desktopDark}" width="1280" height="720"
                alt="Visão escura do Aurora no computador, com tarefas e áreas da rotina organizadas."
                fetchpriority="high">
            </div>
            <div class="landing-hero-phone">
              <img class="landing-screen-light" src="${mobileLight}" width="612" height="680"
                alt="Visão clara do Aurora no celular, com tarefas do dia." fetchpriority="high">
              <img class="landing-screen-dark" src="${mobileDark}" width="612" height="680"
                alt="Visão escura do Aurora no celular, com tarefas do dia." fetchpriority="high">
            </div>
            <figcaption class="visually-hidden">O Aurora funciona no computador e no celular.</figcaption>
          </figure>
        </section>

        <section class="public-tutorials landing-section" id="areas" aria-labelledby="public-tutorials-title"
          data-landing-areas>
          <div class="public-section-heading landing-section-heading">
            <p class="public-eyebrow">O que dá para organizar</p>
            <h2 id="public-tutorials-title"
              class="type-editorial-title">Cinco partes da sua vida, sem trocar de app.</h2>
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
            <p class="public-eyebrow">Como começar</p>
            <h2 id="landing-steps-title" class="type-editorial-title">Três passos e o dia já fica mais leve.</h2>
          </div>
          <ol class="landing-steps-grid">
            <li><span>1</span><h3>Crie sua conta</h3><p>É grátis e não pede cartão. Funciona direto no navegador.</p></li>
            <li><span>2</span><h3>Anote o que está pendente</h3><p>Tarefas, contas, hábitos: coloque tudo do jeito que vier à cabeça.</p></li>
            <li><span>3</span><h3>Escolha o que cabe hoje</h3><p>O Aurora mostra o seu dia. O resto fica guardado para quando der.</p></li>
          </ol>
          <a class="btn primary large landing-steps-cta" href="${signup}"
            data-public-action="signup">Começar agora, é grátis</a>
        </section>

        <section class="public-trust landing-trust landing-section" aria-labelledby="public-trust-title">
          <div class="public-section-heading landing-section-heading">
            <p class="public-eyebrow">Pode confiar</p>
            <h2 id="public-trust-title" class="type-editorial-title">Simples de usar, tranquilo de confiar.</h2>
          </div>
          <div class="landing-trust-grid">
            <article><span>${iconSvg('sparkles', 22)}</span><div><h3>Grátis de verdade</h3><p>Você usa tudo sem pagar e sem informar cartão.</p></div></article>
            <article><span>${iconSvg('download', 22)}</span><div><h3>Seus dados são seus</h3><p>Baixe uma cópia dos seus registros ou exclua a conta quando quiser, nos Ajustes.</p></div></article>
            <article><span>${iconSvg('bank', 22)}</span><div><h3>Não acessa seu banco</h3><p>Você anota receitas e despesas. Nenhuma conta bancária é conectada.</p></div></article>
            <article><span>${iconSvg('grid', 22)}</span><div><h3>Vira app no celular</h3><p>Adicione o Aurora à tela inicial no Android ou no iPhone e abra com um toque.</p></div></article>
          </div>
          <p class="landing-trust-privacy">Quer os detalhes? <a
            href="${privacy}">Leia a Política de Privacidade.</a></p>
        </section>

        <section class="public-faq landing-faq landing-section" id="faq" aria-labelledby="public-faq-title">
          <div class="public-section-heading landing-section-heading">
            <p class="public-eyebrow">Perguntas</p>
            <h2 id="public-faq-title" class="type-editorial-title">Antes de começar.</h2>
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
          <p>Crie sua conta grátis e organize o que importa hoje.</p>
          <div class="landing-final-actions">
            <a class="btn primary large" href="${signup}"
              data-public-action="signup">Criar minha conta grátis ${iconSvg('arrow', 20)}</a>
            <a class="landing-text-link" href="${demo}" data-public-action="demo">ou testar sem cadastro</a>
          </div>
        </section>
      </main>
      ${landingFooter()}
      <a class="public-mobile-cta btn primary" href="${signup}" data-public-action="signup" aria-hidden="true"
        hidden>Criar minha conta grátis</a>
    </div>`;
}
