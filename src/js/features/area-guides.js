export const FINANCE_PRIVACY_NOTICE =
  'O Aurora não se conecta a bancos nem solicita sua senha bancária. Você escolhe o que cadastrar ou importar; esses registros ficam associados à sua conta Aurora e são tratados conforme a Política de Privacidade.';

export const AREA_GUIDES = {
  inicio: {
    title: 'Início',
    icon: 'home',
    summary: 'Seu painel do dia: veja o que precisa de atenção agora e aja em poucos toques.',
    features: [
      {
        icon: 'calendarCheck',
        title: 'Resumo do dia',
        text: 'Acompanhe em um olhar quantas tarefas, eventos do Google Agenda, hábitos e água já foram feitos hoje, além da próxima tarefa pendente.',
        where: 'Bloco Resumo do dia',
      },
      {
        icon: 'plus',
        title: 'Captura rápida e botão +',
        text: 'Anote uma tarefa na hora pelo campo de captura rápida ou toque no + no topo para criar tarefa, hábito, água, lançamento ou registro do ciclo.',
        where: 'Topo do app → +',
      },
      {
        icon: 'droplet',
        title: 'Hábitos e água direto daqui',
        text: 'Marque os hábitos programados para hoje e registre 250 mL de água sem precisar sair da tela inicial.',
        where: 'Bloco Hábitos de hoje',
      },
      {
        icon: 'sliders',
        title: 'Modos e blocos personalizados',
        text: 'Alterne entre os modos Foco, Rotina e Visão geral, escolha quais blocos aparecem e reordene a tela do seu jeito.',
        where: 'Ajustes → Tela inicial',
      },
    ],
    steps: [
      {
        title: 'Veja o que importa hoje',
        text: 'Confira a próxima tarefa no Resumo do dia e os itens atrasados ou programados para hoje.',
      },
      {
        title: 'Marque e registre rápido',
        text: 'Conclua tarefas, dê check nos hábitos do dia e use o botão + no topo sempre que precisar anotar algo novo.',
      },
      {
        title: 'Adapte o painel à sua rotina',
        text: 'Em Ajustes → Tela inicial e Áreas e menu, ligue só as áreas que usa e escolha quais blocos aparecem no Início.',
      },
    ],
    tips: [
      'Pressione Ctrl+K (ou /) em qualquer tela para abrir a busca global e encontrar tarefas, hábitos, lançamentos ou anotações.',
      'No domingo, o painel pode lembrar você de abrir a Revisão semanal para fechar a semana com calma.',
    ],
  },
  planejar: {
    title: 'Planejar',
    icon: 'calendarCheck',
    summary: 'Organize tarefas do dia a dia, calendário unificado, revisão da semana e plano anual.',
    features: [
      {
        icon: 'list',
        title: 'Filtros, busca e ordem manual',
        text: 'Filtre por Todas, Pendentes, Atrasadas ou #etiquetas, busque por palavra e ordene por prazo, prioridade, recentes ou arrastando manualmente.',
        where: 'Aba Tarefas',
      },
      {
        icon: 'note',
        title: 'Criar várias tarefas de uma vez',
        text: 'Digite ou cole uma tarefa por linha com data, hora e #etiqueta (ex.: “Dentista amanhã 14h30 #saúde”) para criar todas de uma só vez.',
        where: 'Topo → Várias',
      },
      {
        icon: 'target',
        title: 'Plano anual com progresso real',
        text: 'Defina metas por trimestre, use ideias prontas ou ligue cada meta a tarefas ou hábitos para acompanhar o progresso automaticamente.',
        where: 'Aba Plano anual',
      },
      {
        icon: 'calendar',
        title: 'Calendário + Google Agenda',
        text: 'Visualize tarefas e compromissos do Google Agenda juntos no mês ou na semana. Conecte sua conta em Ajustes → Agendas.',
        where: 'Aba Calendário',
      },
      {
        icon: 'chart',
        title: 'Revisão semanal',
        text: 'Veja o que foi concluído na semana, reorganize o que ficou pendente e registre uma reflexão rápida antes da próxima semana.',
        where: 'Aba Revisão',
      },
    ],
    steps: [
      {
        title: 'Adicione tarefas do jeito mais rápido',
        text: 'Use Nova tarefa para preencher prazo, prioridade, repetição e etiquetas, ou clique em Várias para lançar uma lista inteira de uma vez.',
      },
      {
        title: 'Alterne entre as 4 visões',
        text: 'Use Tarefas para executar, Calendário para ver prazos e Google Agenda, Plano anual para metas maiores e Revisão para fechar a semana.',
      },
      {
        title: 'Mantenha tudo em movimento',
        text: 'Toque numa tarefa para editar detalhes, adiar o prazo ou adicionar recorrência; tarefas recorrentes geram a próxima ocorrência ao concluir.',
      },
    ],
    tips: [
      'No celular, deslize uma tarefa para o lado para concluir ou agir sem abrir o formulário.',
      'No modo de ordenação Manual, você pode arrastar as tarefas para escolher exatamente a ordem que quer seguir.',
    ],
  },
  financas: {
    title: 'Finanças',
    icon: 'wallet',
    summary: 'Controle manual e privado das suas contas, cartões, lançamentos, orçamentos e relatórios.',
    features: [
      {
        icon: 'wallet',
        title: 'Resumo e modo discreto',
        text: 'Acompanhe saldo total, entradas, saídas do mês e alertas de vencimento. Toque no ícone de olho no topo para ocultar todos os valores.',
        where: 'Aba Resumo e Topo → 👁',
      },
      {
        icon: 'list',
        title: 'Lançamentos e entrada em lote',
        text: 'Registre receitas, despesas, parcelas e transferências entre contas. Use o botão Vários para cadastrar múltiplos lançamentos de uma vez.',
        where: 'Aba Lançamentos',
      },
      {
        icon: 'card',
        title: 'Contas e cartões de crédito',
        text: 'Cadastre contas correntes, carteiras e cartões com fechamento e vencimento para acompanhar faturas e registrar pagamentos.',
        where: 'Aba Contas',
      },
      {
        icon: 'target',
        title: 'Orçamentos, fixas e metas',
        text: 'Defina tetos de gasto por categoria, configure contas fixas recorrentes, acompanhe metas de economia e crie regras automáticas de categoria.',
        where: 'Aba Planejamento',
      },
      {
        icon: 'chart',
        title: 'Relatórios e comparativos',
        text: 'Compare meses, veja para onde vai a maior parte dos gastos por categoria e acompanhe a evolução do saldo ao longo do tempo.',
        where: 'Aba Relatórios',
      },
    ],
    steps: [
      {
        title: 'Cadastre suas contas e cartões',
        text: 'Na aba Contas, cadastre manualmente cada conta ou carteira com o saldo inicial e, se usar, adicione seus cartões de crédito.',
      },
      {
        title: 'Registre entradas, saídas e transferências',
        text: 'Lance movimentações com valor, data, conta e categoria. Ao mover dinheiro entre contas suas, use Transferência para não duplicar receita nem despesa.',
      },
      {
        title: 'Planeje e acompanhe o mês',
        text: 'Configure orçamentos e contas fixas em Planejamento e confira o andamento no Resumo e nos Relatórios.',
      },
    ],
    tips: [
      'Toque no olho no topo de Finanças para esconder os valores sempre que abrir o app em público.',
      'Crie regras em Planejamento → Gerenciar categorias para preencher a categoria automaticamente ao digitar uma descrição parecida.',
    ],
    note: FINANCE_PRIVACY_NOTICE,
  },
  habitos: {
    title: 'Hábitos',
    icon: 'sparkles',
    summary: 'Acompanhe sua rotina diária, água, peso e evolução histórica sem complicação.',
    features: [
      {
        icon: 'check',
        title: 'Tudo direto na linha do hábito',
        text: 'Toque no círculo para marcar hoje, na setinha para marcar dias desta semana e em ⋯ para Editar, Pular hoje, Pausar, Ver histórico, Arquivar ou Excluir.',
        where: 'Aba Meus hábitos',
      },
      {
        icon: 'calendarCheck',
        title: 'Registrar outro dia e outros hábitos',
        text: 'Use Registrar outro dia para marcar vários hábitos de uma data passada de uma vez. Hábitos de outros dias ou pausados aparecem logo abaixo em Outros hábitos.',
        where: 'Aba Meus hábitos',
      },
      {
        icon: 'droplet',
        title: 'Tipos de registro, água e peso',
        text: 'Crie hábitos de check simples, anotação diária, escolha de opções, Beber água (meta estimada por peso/idade e botões rápidos de mL) ou Medir peso.',
        where: 'Novo hábito → Como registrar?',
      },
      {
        icon: 'grip',
        title: 'Vários de uma vez, ideias e ordem',
        text: 'Adicione vários hábitos numa lista, explore o catálogo de Ideias com filtros ou toque em Reordenar para arrastar e escolher a ordem da lista.',
        where: 'Aba Meus hábitos',
      },
      {
        icon: 'chart',
        title: 'Histórico, insights e 12 meses',
        text: 'Veja o ritmo da semana, sequências em risco, seu melhor dia, calendário mensal clicável (para corrigir dias passados) e mapa dos últimos 12 meses.',
        where: 'Aba Histórico',
      },
    ],
    steps: [
      {
        title: 'Crie ou escolha uma ideia',
        text: 'Toque em Novo hábito ou abra Ideias de hábitos para escolher nome, dias da semana, meta semanal (ex.: 3x na semana), ícone e cor.',
      },
      {
        title: 'Marque hoje ou pule sem culpa',
        text: 'Toque no círculo para concluir hoje. Se não der, abra o menu ⋯ e escolha Pular hoje para preservar sua sequência sem contar como falha.',
      },
      {
        title: 'Acompanhe água com facilidade',
        text: 'No hábito “Beber água”, informe o peso para estimar a meta e registre cada volume em mL pelos atalhos rápidos. Ao atingir a meta, o dia é concluído automaticamente.',
      },
    ],
    tips: [
      'Definir uma meta semanal (por exemplo, 3 vezes por semana) deixa o hábito mais flexível sem exigir todos os dias.',
      'Toque em ⋯ → Ver histórico em qualquer hábito para ir direto ao calendário mensal e anual dele.',
    ],
  },
  ciclo: {
    title: 'Ciclo',
    icon: 'heart',
    summary: 'Registre períodos, sintomas e medicações com privacidade e veja padrões do seu corpo.',
    features: [
      {
        icon: 'eyeOff',
        title: 'Modo discreto instantâneo',
        text: 'Toque no ícone de olho no topo para ocultar imediatamente datas, sintomas e previsões sempre que precisar de privacidade.',
        where: 'Topo → 👁',
      },
      {
        icon: 'blood',
        title: 'Registro rápido de períodos',
        text: 'Use Começou hoje em 1 toque, registre períodos atuais ou anteriores e corrija datas de início e fim quando quiser.',
        where: 'Visão geral → Registrar período',
      },
      {
        icon: 'calendar',
        title: 'Diário completo por dia',
        text: 'Toque em qualquer dia no calendário para anotar fluxo, sintomas (dor, humor, digestão, pele, sono), medicação/anticoncepcional, vida íntima e notas.',
        where: 'Calendário → Toque em um dia',
      },
      {
        icon: 'activity',
        title: 'Previsão em faixa e padrões',
        text: 'Com ciclos registrados, acompanhe a fase estimada, a janela prevista do próximo período, histórico de durações e sintomas mais frequentes por fase.',
        where: 'Visão geral e Histórico',
      },
    ],
    steps: [
      {
        title: 'Registre seu período',
        text: 'Toque em Começou hoje ou Registrar período para marcar o início e, quando encerrar, o fim. Você também pode lançar períodos anteriores para gerar médias mais precisas.',
      },
      {
        title: 'Anote o que fizer sentido no calendário',
        text: 'Selecione qualquer dia para registrar intensidade do fluxo, sintomas, medicação e observações — todos os campos são opcionais.',
      },
      {
        title: 'Acompanhe fases e tendências',
        text: 'Conforme seu histórico cresce, o Aurora calcula médias de duração, previsão em faixa do próximo período e padrões de sintomas.',
      },
    ],
    tips: [
      'Registrar 2 ou 3 períodos anteriores já libera estimativas mais úteis de duração e janela do próximo ciclo.',
      'Use o modo discreto (👁) para esconder a tela inteira sem sair do app.',
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
