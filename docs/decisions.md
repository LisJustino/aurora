# Princípios do produto

- As rotas compartilham a mesma aplicação e navegação. `pages/*.html` são
  entradas da SPA, não cópias independentes das telas.
- A demonstração pública usa dados fictícios e interações somente em memória;
  não autentica, não faz requisições nem persiste dados. Dados pessoais exigem
  autenticação e permanecem isolados por usuário no banco.
- A aplicação preserva a compatibilidade de dados e backups existentes.
  Importações e exclusões de dados legados exigem ação e confirmação explícitas.
- Backups exportados são arquivos JSON sem criptografia; a interface deve
  informar isso antes da exportação.
- A área do Ciclo oferece informação geral, não diagnóstico nem método
  contraceptivo. Datas e dados de saúde são tratados como informação pessoal.
- O hábito “Beber água” permite registrar cada volume em mL e acompanhar a meta
  diária; os registros usam a fatia de água compatível com os backups existentes.
- Notificações Push do Pomodoro e dos lembretes de Hábitos são opcionais,
  ativadas por ação explícita da pessoa e limitadas aos dados necessários ao
  agendamento; nomes e conteúdo dos hábitos não são enviados ao Worker. A
  inscrição é compartilhada neste dispositivo, então desativá-la interrompe
  ambos os recursos.
- A interface mantém suporte a teclado, leitores de tela, layouts responsivos
  e temas claro e escuro.
- O onboarding inicial recomenda áreas conforme as necessidades escolhidas,
  permite revisar as ativações e informa que elas podem ser alteradas depois
  em Ajustes → Áreas e navegação. Planejar permanece sempre disponível.
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
  explícita.
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
