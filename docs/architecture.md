# Arquitetura atual

## Execução e navegação

`index.html` e os documentos em `pages/` são entradas HTML para a mesma aplicação de página única. A raiz usa `meta[name="aurora-route"]` com `landing` para mostrar uma apresentação pública antes do acesso, com uma demonstração interativa composta por dados fictícios. Marcar um hábito, iniciar o cronômetro e concluir uma tarefa altera somente o estado em memória da demonstração; ela não inicializa autenticação, não faz requisições para essas ações e não persiste dados. Landing, demonstração e gate de conta mantêm conteúdos e ações públicas, mas compartilham os padrões visuais do app autenticado para cores, cabeçalho, controles e rodapé; nenhum menu de rota protegida é exposto antes da autenticação. Preferências visuais públicas valem somente durante a visita e não são gravadas nas fatias da conta. Entradas em `pages/` continuam declarando uma área protegida e exigindo autenticação. Cada entrada declara `meta[name="aurora-route"]`; `src/js/main.js` lê esse valor apenas no primeiro carregamento sem hash. Depois disso, a navegação é resolvida por hash através de `src/js/core/router.js`; `#pessoal` redireciona para Início.

Em Ajustes, a aba ativa permanece no hash para ser restaurada ao recarregar a página. Ao sair da área, a entrada de histórico de Ajustes é normalizada para `#config`, então retornar à área abre “Seu perfil”.

O shell, os menus e os modais são compartilhados e renderizados no elemento `#app`. Não há cabeçalho, navegação ou estado duplicado por página. As entradas HTML definem idioma, título, descrição, CSS e módulo de inicialização. O conteúdo dinâmico das telas permanece em `main.js`; as entradas não são templates HTML independentes.

## Responsabilidades existentes

- `src/js/main.js`: composição e inicialização; estado em memória `S`; interface e formulários; despacho de eventos; integração entre áreas.
- `src/js/core/router.js`: canonicalização de rotas, incluindo aliases legados para o Pomodoro.
- `src/js/core/`: roteamento e compatibilidade de rotas; a personalização do perfil é opcional e não bloqueia ações.
- `src/js/services/account-auth.js`: gate de conta, cadastro em duas etapas (perfil e acesso), login por senha, OAuth com Google e recuperação de acesso; OAuth retorna a `/#inicio` para iniciar a área autenticada, e o primeiro acesso Google exige perfil adulto e aceite dos documentos antes de carregar os dados. O Apple/iCloud está temporariamente indisponível para novos logins, mas a identificação de contas Apple existentes continua reconhecida para compatibilidade. Contas por e-mail entram sem confirmação obrigatória e o projeto Supabase precisa estar configurado para autoconfirmar. O app não envia links de confirmação; cadastros antigos pendentes precisam ser liberados manualmente no Dashboard do Supabase. A exclusão confirmada remove definitivamente o usuário; um novo cadastro com o mesmo e-mail cria uma conta com novo ID e sem os dados anteriores. Erros identificados de e-mail ainda associado orientam a pessoa a entrar ou verificar a exclusão; erros desconhecidos não exibem mensagens técnicas do provedor. Não exige MFA. A saída da sessão local fica no shell de `main.js` e é acessada em Ajustes → Seu perfil; ao sair, a aplicação retorna à landing pública na raiz.
- `src/js/data/`: cliente Supabase singleton, `RelationalAccountStore` e módulos temporários de leitura/mesclagem dos dados legados para importação explícita.
- `src/js/services/crypto-vault.js`: leitor legado temporário, chamado somente quando a pessoa informa a senha do cofre na tela de importação; não participa do login ou persistência relacional.
- `src/js/features/finance/calculations.js`: cálculos puros de saldo, totais mensais, categorias e cartão; recebe os dados e dependências explicitamente. `src/js/features/finance/accounts.js` centraliza tipos de conta e compatibilidade com o tipo legado `cash`. A composição em `main.js` mantém seções separadas para contas e cartões; o vínculo opcional de um cartão somente pré-seleciona a conta no pagamento da fatura.
- `src/js/features/finance/statement.js`: leitura pura de extratos CSV/OFX, com limite de prévia informado pela interface.
- `src/js/features/landing/view.js`: landing pública com passos iniciais e demonstração fictícia interativa em memória; a demonstração cobre uma tarefa, um hábito e o Pomodoro, e as ações de cadastro/login usam o fluxo de conta existente.
- `src/js/features/planning/quick-entry.js`: interpretação pura de prazos relativos em tarefas rápidas; a composição e confirmação permanecem em `main.js`.
- `src/js/features/footer/view.js`: conteúdo compartilhado do footer público, do fluxo de conta e do shell autenticado; ações de conta seguem o contexto da tela e o FAQ é estático.
- `src/js/features/footer/legal-dialog.js`: carrega os documentos legais públicos no diálogo compartilhado do footer e oferece link de fallback se o carregamento falhar.
- `supabase/functions/delete-account/`: exclusão autenticada da conta após recusa confirmada dos documentos, limpando Push remoto antes da exclusão Admin.
- `src/js/features/profile/model.js`: opções compartilhadas de identidade de gênero usadas no cadastro e nos Ajustes.
- `src/js/features/appearance/public-controls.js`: cabeçalho e controles temporários de tema/acessibilidade para as telas públicas; não lê nem grava as preferências privadas da conta.
- `src/js/features/pomodoro/`: lógica e áudio do timer independente; não cria matérias ou sessões. `src/js/features/habits/` mantém o fragmento HTML e o modelo de hábitos; estado e handlers continuam compostos em `main.js`. A sugestão de água registra volumes por dia na fatia `water` existente e conclui o hábito ao atingir a meta.
- `src/js/services/pomodoro-push.js`: inscrição opt-in do timer independente e sincronização mínima de fase/horário com a API de Push. A inscrição e a credencial-capacidade ficam em `push_subscriptions`; `PushManager` mantém a inscrição do navegador.
- `src/js/services/local-search.js`: busca local determinística.
- `src/js/utils/`: DOM e interpolação HTML escapada, ícones SVG (`icons.js`), datas civis locais, valores monetários em centavos e geração de IDs.
- `src/css/design-system/`: tokens (cor, tipografia, espaço, raios, controles) e componentes-base (botões, campos, seletores, selos e estado vazio); regras e critérios em [design-system.md](./design-system.md), referência visual em [design-system.html](./design-system.html).
- `src/css/base.css`, `layout.css`: elementos básicos e estrutura responsiva.
- `src/css/components/` e `src/css/pages/`: estilos de componentes e áreas.
- `src/css/main.css`: ponto único de importação CSS. A ordem conserva a cascata anterior.

## Estado e persistência

`S` é a fonte de verdade em memória. `RelationalAccountStore` converte as fatias existentes em linhas relacionais e usa a RPC `apply_relational_changes` para gravar a substituição numa transação com RLS por usuário autenticado. Identificadores não UUID recebem mapeamento estável por `legacy_id`; a lixeira é representada por `trash_records` e `deleted_at`. A tela temporária em Ajustes analisa `aurora.app.*`, caches cifrados do usuário e `user_data` com o leitor legado, valida as fatias e mescla por IDs sem sobrescrever dados relacionais existentes. A limpeza local exige uma confirmação posterior à conferência e remove apenas as chaves que não mudaram desde a análise. `user_data`, `user_keys` e o código de leitura permanecem até aprovação separada; nada é removido automaticamente. Schema, políticas e RPCs ficam em `supabase/migrations/`; consulte também [data-model.md](./data-model.md).

A inicialização bloqueia a tela principal até que o usuário esteja autenticado. RLS restringe a leitura e gravação a `auth.uid()`; MFA não é obrigatório. O Supabase deve ter **Confirm email** desativado para emitir uma sessão logo após o cadastro. O app não envia links de confirmação; cadastros antigos pendentes precisam ser liberados manualmente no Dashboard. Sem confirmação obrigatória, e-mails incorretos podem impedir recuperação de conta. A sessão de autenticação é a única persistência de dados do usuário permitida no navegador; o estado do app vive em memória e as gravações vão diretamente ao Supabase. Se a rede cair, a interface avisa e bloqueia gravações; falhas de persistência ficam visíveis e só são reenviadas após ação explícita. A RPC relacional grava apenas linhas alteradas, verifica suas versões `updated_at` e apresenta conflito para recarga em vez de sobrescrever dados modificados em outra sessão. O service worker pode armazenar somente recursos estáticos do app; nunca respostas de API. Backups e cópias de recuperação continuam em JSON sem criptografia e exigem confirmação. A inicialização remove do armazenamento local as fatias antigas exclusivas de Estudos; a migration `20261029050000_remove_studies.sql` remove seus registros relacionais e cifrados no banco.

A segurança dos headers está definida em `_headers` e reforça o app com CSP restritivo, `Strict-Transport-Security`, `X-Frame-Options: DENY`, `X-Content-Type-Options`, `Referrer-Policy` e `frame-ancestors 'none'`. O fallback do Cloudflare Pages fica em `_redirects`: arquivos inexistentes em `/src/*`, `/icons/*` e `/pages/*` retornam 404 real, mantendo `/* /index.html 200` apenas para rotas da SPA. Quando a conta muda em outro dispositivo, `RelationalAccountStore` envia somente alterações desde o último estado confirmado e a migration nova de conflito rejeita linhas mais novas com `version_conflict`, exibindo aviso claro e pedindo recarga dos dados da conta. A revalidação em foco usa `visibilitychange` para recarregar a conta quando não há pendências.

Termos de Uso e Política de Privacidade são documentos públicos versão 1.4, abertos em um `<dialog>` compartilhado no footer, com páginas estáticas como fallback. Cadastro e renovação do aceite só liberam a caixa e o botão após os dois documentos serem percorridos até o fim. O aceite é registrado nos metadados da conta. Uma conta existente sem aceite atual fica bloqueada até aceitar ou recusar; a recusa apresenta um aviso e pede confirmação final. A Edge Function `delete-account` valida a sessão, limpa inscrições Push remotas e exclui a conta; não há chave administrativa no navegador. Após a confirmação da exclusão, o navegador substitui a página interna pela landing pública na raiz. A função precisa ser configurada e publicada pelo responsável, conforme `supabase/README.md`, antes de a exclusão funcionar.

Durante o aceite, o modal informa quantos documentos foram lidos, preserva esse progresso ao reabrir e oferece o botão acessível por teclado “Ir ao fim”. A confirmação só é habilitada depois que Termos e Privacidade chegam ao fim.

Falhas de leitura e gravação são reportadas no console e na interface. Se a conversão detectar registros incompatíveis, as gravações são bloqueadas para não substituir o conjunto relacional por uma versão incompleta; uma cópia recuperável pode ser exportada. O backend opcional de avisos é isolado em `worker/`: o Worker Cloudflare valida origem e entradas, enquanto uma Durable Object por instalação mantém a inscrição e os agendamentos mínimos do Pomodoro e dos lembretes de Hábitos. Os nomes e conteúdos dos hábitos não são transmitidos.

O service worker raiz exibe Push somente quando não há uma janela do Aurora visível. O app não pede permissão no carregamento; a solicitação acontece nos controles explícitos de Pomodoro ou Hábitos. Os lembretes de Hábitos enviam uma mensagem genérica e abrem essa área ao clicar. Recursos estáticos usam stale-while-revalidate; Termos de Uso e Política de Privacidade usam network-first, com cache como fallback offline; navegação também é network-first e pode usar somente HTML estático em cache como fallback.

## Composição da interface

`src/js/main.js` compõe estado, templates, eventos e fluxos das áreas. Hábitos
usa um fragmento HTML carregado por utilitário sem acesso ao estado da
aplicação; Água não tem mais uma tela própria. O hash legado `#agua` e a entrada
`pages/agua.html` levam à tela de Hábitos. Os dados históricos de água continuam
compatíveis com armazenamento e backup; o hábito “Beber água” usa essa fatia
para registrar volumes e acompanhar a meta diária. O Pomodoro funciona sem
registros de Estudos. Os cálculos financeiros e utilitários compartilhados
permanecem em módulos próprios.
Os roteiros e vídeos locais das orientações contextuais ficam em
`src/js/features/area-guides.js` e `src/assets/tutorials/`. O vídeo abre no
primeiro acesso às áreas de Início, Planejar, Pomodoro, Finanças, Hábitos e
Ciclo; a ação “Como usar?” permite revê-lo. Ajustes não oferece tutorial. As
áreas já apresentadas ficam registradas em `user_settings.preferences`, sem
criar uma tabela ou serviço. Finanças também exibe um aviso de que não há
conexão bancária e de que os registros adicionados ficam associados à conta
Aurora.
