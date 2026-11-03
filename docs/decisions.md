# Princípios do produto

- As rotas compartilham a mesma aplicação e navegação. `pages/*.html` são
  entradas da SPA, não cópias independentes das telas.
- A demonstração pública usa dados fictícios e interações somente em memória;
  não autentica, não faz requisições nem persiste dados. Dados pessoais exigem
  autenticação e permanecem isolados por usuário no banco.
- A landing deve distinguir recursos existentes da demonstração interativa,
  descrever com precisão o cadastro e o tratamento de dados e não publicar
  depoimentos, avaliações ou perfis de usuários fictícios como prova social.
- A aplicação preserva a compatibilidade de dados e backups existentes.
  Importações e exclusões de dados legados exigem ação e confirmação explícitas.
- Backups JSON sem proteção continuam compatíveis e são exportados com aviso.
  Também há uma opção de cifrar o mesmo conteúdo com AES-256-GCM e uma senha
  exclusiva derivada por PBKDF2; a senha nunca é salva e não pode ser
  recuperada se esquecida. A cópia bruta de recuperação continua sem cifra.
- A área do Ciclo oferece informação geral, não diagnóstico nem método
  contraceptivo. Datas e dados de saúde são tratados como informação pessoal.
- O hábito “Beber água” permite registrar cada volume em mL e acompanhar a meta
  diária; os registros usam a fatia de água compatível com os backups existentes.
- A revisão semanal de Hábitos resume check-ins por hábito até o dia atual,
  respeita dias pulados e metas semanais e permite abrir o editor existente
  para ajustar o plano. Ela não cria um histórico ou formato de persistência
  adicional e mantém linguagem sem pressão.
- Hábitos ativos e arquivados podem ser excluídos com confirmação. A exclusão
  move o hábito e seu histórico para a lixeira por 30 dias, permitindo
  restauração; arquivar continua sendo uma alternativa que preserva o hábito
  na área de Hábitos.
- O catálogo de ideias de Hábitos contém 100 sugestões e os filtros de
  categoria e contexto usam seletores com rótulos explícitos e uma ação para
  limpar os filtros; não há busca de texto. As quatro sugestões iniciais priorizam
  categorias diferentes; se alguma já existir, outras ideias completam a
  prévia. Descrições longas ficam resumidas nos cartões e aparecem completas ao
  personalizar. Escolher uma ideia continua abrindo o editor antes de gravar;
  filtros e expansão são estado temporário, e as características pertencem
  apenas ao catálogo de sugestões, não aos hábitos salvos.
- A área de Hábitos prioriza o check-in do dia e mantém a semana visível por
  hábito; histórico e gerenciamento continuam acessíveis em detalhes
  recolhidos. A revisão semanal não aparece antes de existir um hábito ativo
  ou pausado, e explicações de notificações ficam recolhidas.
- Notificações Push do Pomodoro e dos lembretes de Hábitos são opcionais,
  ativadas por ação explícita da pessoa e limitadas aos dados necessários ao
  agendamento; nomes e conteúdo dos hábitos não são enviados ao Worker. A
  inscrição é compartilhada neste dispositivo, então desativá-la interrompe
  ambos os recursos.
- A interface mantém suporte a teclado, leitores de tela, layouts responsivos
  e temas claro e escuro.
- O estado de persistência do shell informa somente gravações em andamento ou
  problemas recuperáveis; depois de salvar, não exibe uma confirmação positiva
  persistente.
- Os indicadores do resumo financeiro são atalhos para Lançamentos e preservam
  o mês selecionado; receitas, despesas e pendências aplicam seus filtros,
  enquanto Resultado abre a lista completa do mês.
- Compras parceladas informam parcela atual e total. A data preenchida
  corresponde à parcela atual; são criados somente os lançamentos dessa
  parcela até a última, sem reconstruir parcelas anteriores. O valor informado
  continua sendo o total da compra, dividido em centavos entre as parcelas.
- O diário do Ciclo permite registrar separadamente atividade sexual com outra
  pessoa, masturbação e a quantidade opcional de orgasmos por dia. Métodos
  contraceptivos aparecem somente para atividade com outra pessoa; os campos
  novos são opcionais e não alteram registros anteriores.
- Enquanto um diálogo modal ou os painéis de notificações e acessibilidade
  estiverem abertos, o scroll do conteúdo externo fica bloqueado; ao fechá-los,
  a posição anterior da página é restaurada e o cabeçalho permanece visível.
- Rolagens iniciadas pela interface respeitam tanto a preferência de movimento
  reduzido do sistema quanto a opção salva no Aurora. O painel público de
  acessibilidade é uma seção expansível, fecha com Escape e devolve o foco ao
  acionador.
- O onboarding inicial recomenda áreas conforme as necessidades escolhidas,
  permite revisar as ativações e informa que elas podem ser alteradas depois
  em Ajustes → Áreas e navegação. Planejar permanece sempre disponível.
- No Pomodoro, os tempos de foco e pausa são editáveis entre sessões; ritmos
  prontos são atalhos que preenchem os campos. Uma sessão iniciada ou com
  progresso bloqueia alterações de duração até ser concluída ou descartada.
  Os minutos permanecem nas preferências existentes e nos backups atuais.
- O cadastro e cada atualização de documentos exigem aceite explícito dos
  Termos de Uso e da Política de Privacidade. Recusar uma atualização enquanto
  autenticada oferece exclusão permanente da conta, com confirmação digitada;
  a exclusão só é concluída depois da limpeza Push e confirmação do Supabase.
- O cadastro não exige idade mínima. A data completa de nascimento é usada para
  calcular a idade do perfil, mas não é armazenada.
- O cadastro não exige confirmação do e-mail para liberar acesso. Projetos
  Supabase devem autoconfirmar novos cadastros; endereços incorretos podem
  impedir recuperação da conta. A landing e a etapa de cadastro devem deixar
  esse risco claro antes da criação da conta. O app não envia links de
  confirmação; contas antigas pendentes precisam ser liberadas manualmente no
  Dashboard do Supabase.
- Métricas comportamentais e analytics de terceiros estão adiados. Não
  adicionar scripts ou eventos de rastreamento até definir finalidade,
  minimização, retenção, transparência na Política de Privacidade e necessidade
  de novo aceite; métricas agregadas de hospedagem também dependem de decisão
  explícita. A exceção opt-in de Google Identity Services serve apenas para
  autorizar leitura do Google Calendar após ação explícita; não adiciona
  analytics.
- No cadastro, um e-mail que o Supabase identifica como já associado recebe
  orientação de que uma exclusão confirmada libera novo cadastro sem os dados
  anteriores; erros não reconhecidos continuam sem detalhes técnicos do
  provedor.
- A exclusão confirmada da conta é definitiva. O mesmo e-mail pode ser usado
  para um novo cadastro, que recebe um novo ID e não restaura os dados da conta
  anterior; falha ou ausência de confirmação não deve ser apresentada como
  exclusão concluída.
- Os documentos legais ficam acessíveis no footer em um diálogo modal, com
  páginas estáticas de fallback. O conteúdo ainda exige revisão jurídica e
  confirmação das configurações operacionais antes de publicação definitiva.
  Alterações nos documentos precisam manter alinhados os metadados HTML, a
  versão em `account-auth.js` e o fluxo de novo aceite; não editar conteúdo
  versionado sem revisar esse impacto.

## Selects da plataforma

Os selects compartilham um menu Aurora para manter o visual consistente entre navegadores e sistemas operacionais. A camada acessível controla abertura, opções, foco e teclado, enquanto o `<select>` original permanece no formulário como fonte de valor, validação, rótulos e eventos. Assim, os fluxos existentes de formulários e filtros continuam integrados sem depender da aparência nativa do menu.

## Persistência e compatibilidade

- Dados de conta são associados ao usuário autenticado e protegidos por RLS.
- Falhas de leitura ou gravação devem ser informadas; a interface não deve
  apresentar uma operação malsucedida como concluída.
- Campos opcionais nulos vindos do banco são omitidos ao reconstruir o estado;
  propriedades próprias com `undefined` não podem fazer registros válidos
  falharem na validação de integridade.
- Não remover chaves, registros, tabelas ou formatos de backup legados sem
  revisão de compatibilidade e confirmação explícita.

## Data de liquidação financeira

`date` permanece a data de competência do lançamento. O campo opcional
`settledDate` registra o dia em que uma receita/despesa de conta foi paga ou
recebida, permitindo relatórios por competência ou caixa. Registros existentes
sem a nova data não são regravados nem migrados em massa: quando necessário,
usam `date` como aproximação, com aviso na interface. Compras no cartão
continuam na competência da compra; pagamentos de fatura são transferências e
aparecem como saída no caixa. O saldo histórico considera apenas movimentos
liquidados e não inclui cartões no saldo disponível. Contribuições de objetivos
seguem como acompanhamento, sem movimentar contas ou criar lançamentos.

## Foco e registros antigos de Estudos

O Pomodoro é a única ferramenta de foco e pode ser usado para qualquer
atividade. Não há área de Estudos, cadastro de matérias ou registro de sessões.
As fatias locais antigas são removidas após autenticação, os dados relacionais
e as fatias cifradas exclusivas de Estudos são removidos pela migration
`20261029050000_remove_studies.sql`, e backups que ainda contenham esses dados
são rejeitados. Preferências relacionais são limpas sem apagar as demais
configurações. Uma preferência dentro do antigo envelope cifrado misto só
pode ser identificada depois de descriptografar a cópia; a normalização não a
reintroduz na conta atual, mas a cópia cifrada original permanece até ser
apagada como parte da limpeza legada. Migrations históricas permanecem no
repositório como registro do schema anterior; elas não representam o schema
ativo após a migration de remoção.

## Google Calendar no Planejar

A integração é opcional e somente de leitura. Google Identity Services solicita
uma autorização separada, iniciada em Planejar, com o escopo
`calendar.readonly`; o login Google do Supabase continua sem esse escopo e não
é alterado. O navegador consulta diretamente calendários e eventos do mês
visível. Tokens, nomes e eventos permanecem apenas na memória da aba: não são
persistidos no navegador ou no backend, incluídos em backups ou enviados ao
Worker. A permissão externa pode ser removida nas configurações da Conta
Google. A Política de Privacidade e o aceite legal passam para 1.6 antes de
habilitar essa leitura.

## Regressão automatizada e extrações de `main.js`

O CI executa treze cenários E2E com Chromium contra Vite local: demonstração
pública, Hábitos, backup cifrado, atualização PWA, estado offline, cadastro
sem envio, navegação/ações rápidas, mini Pomodoro, limites entre prévia e build
de produção, acessibilidade/contraste, selects nativos e customizados,
regressões de Finanças e scroll de diálogos/painéis em mobile e desktop. O fluxo
smoke em Firefox e WebKit cobre tarefa, diálogo, console e viewport móvel; não
repete toda a suíte. Esses cenários usam dados fictícios e não acessam projetos
Supabase remotos. Um job separado sobe Postgres Supabase local descartável,
aplica as migrations, verifica RLS e força duas gravações concorrentes com a
mesma versão, confirmando a rejeição da gravação obsoleta. A suíte não
substitui autenticação remota, atualização PWA real hospedada, concorrência em
Preview, exclusão real nem configuração dos ambientes publicados.

Extrações de `main.js` devem começar por regras puras, mover apenas
responsabilidades com fronteira clara e preservar o estado único da aplicação.
O primeiro passo é manter em `features/habits/model.js` a regra pura de
remoção das ideias de hábitos já existentes. Templates e handlers continuam
compostos em `main.js`; a extração do monólito é incremental e não está
concluída.

## Hierarquia e retorno da área logada

O Início mantém o plano de hoje antes dos resumos nos layouts padrão; ordens já
personalizadas não são substituídas. “Primeiros passos” usa as áreas ativadas,
mostra o progresso e destaca uma única sugestão sem abrir fluxos
automaticamente. Em tablets largos, os rótulos das áreas e de criação ficam
visíveis; atalhos compactos continuam identificáveis pelo nome.

O shell autenticado informa quando a conta foi sincronizada, está salvando ou
precisa de atenção por falha/conexão. A demonstração local não exibe uma
confirmação de sincronização. Esse retorno é derivado do estado existente da
persistência; não cria campos ou gravações adicionais.

## Descoberta e controle de ações frequentes

A busca global não tem botão no cabeçalho e permanece disponível pelo atalho
Ctrl+K/⌘K. Novos lançamentos sugerem conta e categoria do último lançamento
válido do mesmo tipo; as sugestões são derivadas dos dados existentes, sem
preferência persistida adicional. Concluir tarefa, marcar hábito ou pular um
dia oferece desfazer pelo toast, reutilizando a fatia atual e sem alterar o
formato de backup. A pausa de uma hora afeta somente lembretes internos de
tarefas e hábitos nesta instância do app; não altera permissões ou avisos Push
do sistema. Estados vazios usam anúncio `status` educado para leitores de tela.
