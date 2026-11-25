export const FINANCE_PRIVACY_NOTICE =
  'O Aurora não se conecta a bancos nem solicita sua senha bancária. Você escolhe o que cadastrar ou importar; esses registros ficam associados à sua conta Aurora e são tratados conforme a Política de Privacidade.';

const tutorialAsset = (name) => `/src/assets/tutorials/${name}`;

export const AREA_GUIDES = {
  inicio: {
    title: 'Início',
    summary: 'Acompanhe o dia e encontre atalhos para suas áreas.',
    video: tutorialAsset('inicio.mp4'),
    poster: tutorialAsset('inicio.webp'),
    mobileVideo: tutorialAsset('inicio-mobile.mp4'),
    mobilePoster: tutorialAsset('inicio-mobile.webp'),
    steps: [
      {
        title: 'Comece pelo que importa',
        text: 'Confira as tarefas de hoje e os avisos que pedem sua atenção. Abra uma tarefa para ver detalhes ou atualizar o andamento.',
      },
      {
        title: 'Consulte seus hábitos',
        text: 'Veja o que está agendado para hoje e marque apenas o que você concluiu.',
      },
      {
        title: 'Deixe a tela com a sua cara',
        text: 'Em Ajustes, escolha quais áreas aparecem e organize os blocos do painel para destacar o que você mais usa.',
      },
    ],
  },
  planejar: {
    title: 'Planejar',
    summary: 'Organize tarefas por prazo e escolha a visualização que ajuda você.',
    video: tutorialAsset('planejar.mp4'),
    poster: tutorialAsset('planejar.webp'),
    mobileVideo: tutorialAsset('planejar-mobile.mp4'),
    mobilePoster: tutorialAsset('planejar-mobile.webp'),
    steps: [
      {
        title: 'Crie as tarefas',
        text: 'Adicione um título e, se ajudar, escolha prazo, prioridade e lista. Você pode começar sem preencher tudo.',
      },
      {
        title: 'Escolha como visualizar',
        text: 'Use o Plano anual para dividir conquistas em etapas ligadas a tarefas ou hábitos. A lista, o calendário, a semana e a revisão ajudam a cuidar do dia a dia.',
      },
      {
        title: 'Encontre e atualize',
        text: 'Combine busca e filtros para localizar tarefas. Marque como concluída ou abra para ajustar os detalhes.',
      },
      {
        title: 'Reorganize sem perder o fio',
        text: 'Se os planos mudarem, edite o prazo ou a prioridade. A visualização acompanha as alterações.',
      },
    ],
  },
  financas: {
    title: 'Finanças',
    summary: 'Monte um retrato financeiro manual: você decide quais contas e lançamentos registrar.',
    video: tutorialAsset('financas.mp4'),
    poster: tutorialAsset('financas.webp'),
    mobileVideo: tutorialAsset('financas-mobile.mp4'),
    mobilePoster: tutorialAsset('financas-mobile.webp'),
    steps: [
      {
        title: 'Comece pelas contas',
        text: 'Cadastre manualmente uma conta ou carteira e informe o saldo inicial que deseja acompanhar. O Aurora não importa saldos bancários por conta própria.',
      },
      {
        title: 'Registre cada movimentação',
        text: 'Adicione receitas e despesas com valor, data, categoria e conta. Os valores são aqueles que você informar.',
      },
      {
        title: 'Transfira sem duplicar gastos',
        text: 'Ao mover dinheiro entre suas contas, use transferência e escolha origem e destino. Ela altera os saldos, mas não entra como receita nem despesa.',
      },
      {
        title: 'Acompanhe e corrija',
        text: 'Consulte os resumos, filtros e relatórios com base nos registros feitos. Se algo estiver errado, edite ou remova o lançamento correspondente.',
      },
    ],
    note: FINANCE_PRIVACY_NOTICE,
  },
  habitos: {
    title: 'Hábitos',
    summary: 'Crie hábitos e acompanhe os registros dia a dia.',
    video: tutorialAsset('habitos.mp4'),
    poster: tutorialAsset('habitos.webp'),
    mobileVideo: tutorialAsset('habitos-mobile.mp4'),
    mobilePoster: tutorialAsset('habitos-mobile.webp'),
    steps: [
      {
        title: 'Comece por algo simples',
        text: 'Crie um hábito com um nome claro e selecione os dias em que pretende praticá-lo. Você pode ajustar a rotina depois.',
      },
      {
        title: 'Registre sem cobrança',
        text: 'Marque os dias em que concluiu. Se não aconteceu, registre como pulado quando quiser manter esse contexto no histórico.',
      },
      {
        title: 'Revise sua rotina',
        text: 'Use o histórico para perceber padrões e editar, pausar ou arquivar hábitos que já não combinam com seu momento.',
      },
      {
        title: 'Inclua água se fizer sentido',
        text: 'Adicione “Beber água”, informe o peso para estimar a meta usando a idade de Ajustes e registre cada volume em mL. Ao atingir a meta, o dia é concluído automaticamente.',
      },
    ],
  },
  ciclo: {
    title: 'Ciclo',
    summary: 'Registre períodos e, se quiser, sintomas e outras observações.',
    video: tutorialAsset('ciclo.mp4'),
    poster: tutorialAsset('ciclo.webp'),
    mobileVideo: tutorialAsset('ciclo-mobile.mp4'),
    mobilePoster: tutorialAsset('ciclo-mobile.webp'),
    steps: [
      {
        title: 'Registre o que aconteceu',
        text: 'Adicione o início e o fim do período conforme seus registros. Você pode corrigir datas quando precisar.',
      },
      {
        title: 'Use o calendário',
        text: 'Selecione um dia para consultar ou adicionar sintomas e observações. Compartilhe apenas o que se sentir confortável em registrar.',
      },
      {
        title: 'Entenda as estimativas',
        text: 'Com dados suficientes, o calendário pode apresentar médias e estimativas calculadas a partir do seu histórico.',
      },
    ],
    note: 'As estimativas são informativas, baseadas nos registros feitos no Aurora, e não substituem avaliação profissional nem servem como método contraceptivo.',
  },
};

export const AREA_GUIDE_IDS = Object.keys(AREA_GUIDES);
const KNOWN_AREA_TUTORIAL_IDS = new Set([...AREA_GUIDE_IDS, 'config']);

export function normalizeAreaTutorialsSeen(value) {
  return Array.isArray(value)
    ? [...new Set(value.filter((route) => typeof route === 'string' && KNOWN_AREA_TUTORIAL_IDS.has(route)))]
    : [];
}

export function isValidAreaTutorialsSeen(value) {
  return (
    Array.isArray(value) &&
    value.every((route) => typeof route === 'string' && KNOWN_AREA_TUTORIAL_IDS.has(route)) &&
    new Set(value).size === value.length
  );
}
