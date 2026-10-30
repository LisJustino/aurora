export const FINANCE_PRIVACY_NOTICE = 'O Aurora não se conecta a bancos nem solicita sua senha bancária. Você escolhe o que cadastrar ou importar; esses registros ficam associados à sua conta Aurora e são tratados conforme a Política de Privacidade.';

export const AREA_GUIDES = {
  inicio: {
    title: 'Início',
    summary: 'Acompanhe o dia e encontre atalhos para suas áreas.',
    video: new URL('../../assets/tutorials/inicio.webm', import.meta.url).href,
    fallbackVideo: new URL('../../assets/tutorials/inicio.mp4', import.meta.url).href,
    steps: [
      { title: 'Comece pelo que importa', text: 'Confira as tarefas de hoje e os avisos que pedem sua atenção. Abra uma tarefa para ver detalhes ou atualizar o andamento.' },
      { title: 'Use os atalhos do painel', text: 'Crie uma tarefa ou inicie um foco sem sair de Início. Os atalhos levam você direto à ação.' },
      { title: 'Deixe a tela com a sua cara', text: 'Em Ajustes, escolha quais áreas aparecem e organize os blocos do painel para destacar o que você mais usa.' },
    ],
  },
  planejar: {
    title: 'Planejar',
    summary: 'Organize tarefas por prazo e escolha a visualização que ajuda você.',
    video: new URL('../../assets/tutorials/planejar.webm', import.meta.url).href,
    fallbackVideo: new URL('../../assets/tutorials/planejar.mp4', import.meta.url).href,
    steps: [
      { title: 'Transforme planos em tarefas', text: 'Adicione um título e, se ajudar, escolha prazo, prioridade e lista. Você pode começar sem preencher tudo.' },
      { title: 'Escolha como visualizar', text: 'Use a lista para acompanhar itens, o calendário ou a semana para ver datas e a revisão para retomar o que ficou pendente.' },
      { title: 'Encontre e atualize', text: 'Combine busca e filtros para localizar tarefas. Marque como concluída ou abra para ajustar os detalhes.' },
      { title: 'Reorganize sem perder o fio', text: 'Se os planos mudarem, edite o prazo ou a prioridade. A visualização acompanha as alterações.' },
    ],
  },
  pomodoro: {
    title: 'Pomodoro',
    summary: 'Alterne períodos de foco e pausa no seu próprio ritmo.',
    video: new URL('../../assets/tutorials/pomodoro.webm', import.meta.url).href,
    fallbackVideo: new URL('../../assets/tutorials/pomodoro.mp4', import.meta.url).href,
    steps: [
      { title: 'Escolha um foco', text: 'Escreva no que quer trabalhar ou associe uma tarefa. Você também pode iniciar sem escolher nenhum dos dois.' },
      { title: 'Inicie e acompanhe', text: 'Comece o timer para alternar foco e pausa. Se precisar interromper, pause e retome no seu tempo.' },
      { title: 'Ajuste ao seu ritmo', text: 'Em Ajustes, personalize a duração dos períodos e o som. Notificações fora do Aurora são opcionais.' },
      { title: 'Confira seu progresso', text: 'Ao concluir um período de foco associado a uma tarefa, o tempo concluído é somado a ela.' },
    ],
  },
  financas: {
    title: 'Finanças',
    summary: 'Monte um retrato financeiro manual: você decide quais contas e lançamentos registrar.',
    video: new URL('../../assets/tutorials/financas.webm', import.meta.url).href,
    fallbackVideo: new URL('../../assets/tutorials/financas.mp4', import.meta.url).href,
    steps: [
      { title: 'Comece pelas contas', text: 'Cadastre manualmente uma conta ou carteira e informe o saldo inicial que deseja acompanhar. O Aurora não importa saldos do banco por conta própria.' },
      { title: 'Registre cada movimentação', text: 'Adicione receitas e despesas com valor, data, categoria e conta. Os valores são aqueles que você informar.' },
      { title: 'Transfira sem duplicar gastos', text: 'Ao mover dinheiro entre suas contas, use transferência e escolha origem e destino. Ela altera os saldos, mas não entra como receita nem despesa.' },
      { title: 'Acompanhe e corrija', text: 'Consulte os resumos, filtros e relatórios com base nos registros feitos. Se algo estiver errado, edite ou remova o lançamento correspondente.' },
    ],
    note: FINANCE_PRIVACY_NOTICE,
  },
  habitos: {
    title: 'Hábitos',
    summary: 'Monte rotinas possíveis e acompanhe os registros dia a dia.',
    video: new URL('../../assets/tutorials/habitos.webm', import.meta.url).href,
    fallbackVideo: new URL('../../assets/tutorials/habitos.mp4', import.meta.url).href,
    steps: [
      { title: 'Escolha algo possível', text: 'Crie um hábito com um nome claro e selecione os dias em que pretende praticá-lo. Você pode ajustar a rotina depois.' },
      { title: 'Registre sem cobrança', text: 'Marque os dias em que concluiu. Se não aconteceu, registre como pulado quando quiser manter esse contexto no histórico.' },
      { title: 'Revise sua rotina', text: 'Use o histórico para perceber padrões e editar, pausar ou arquivar hábitos que já não combinam com seu momento.' },
      { title: 'Inclua água se fizer sentido', text: 'Adicione “Beber água”, informe o peso para estimar a meta usando a idade de Ajustes e registre cada volume em mL. Ao atingir a meta, o dia é concluído automaticamente.' },
    ],
  },
  ciclo: {
    title: 'Ciclo',
    summary: 'Registre períodos e, se quiser, sintomas e outras observações.',
    video: new URL('../../assets/tutorials/ciclo.webm', import.meta.url).href,
    fallbackVideo: new URL('../../assets/tutorials/ciclo.mp4', import.meta.url).href,
    steps: [
      { title: 'Registre o que aconteceu', text: 'Adicione o início e o fim do período conforme seus registros. Você pode corrigir datas quando precisar.' },
      { title: 'Use o calendário', text: 'Selecione um dia para consultar ou adicionar sintomas e observações. Compartilhe apenas o que se sentir confortável em registrar.' },
      { title: 'Entenda as estimativas', text: 'Com dados suficientes, o calendário pode apresentar médias e estimativas calculadas a partir do seu histórico.' },
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
  return Array.isArray(value)
    && value.every((route) => typeof route === 'string' && KNOWN_AREA_TUTORIAL_IDS.has(route))
    && new Set(value).size === value.length;
}
