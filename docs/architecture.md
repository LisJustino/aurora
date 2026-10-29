# Arquitetura atual

## Execução e navegação

`index.html` e os documentos em `pages/` são entradas HTML para a mesma aplicação de página única. A raiz usa `meta[name="aurora-route"]` com `landing` para mostrar uma apresentação pública antes do acesso, com uma demonstração somente de leitura composta por dados fictícios. A demonstração não inicializa persistência nem autenticação. Landing, demonstração e gate de conta mantêm conteúdos e ações públicas, mas compartilham os padrões visuais do app autenticado para cores, cabeçalho, controles e rodapé; nenhum menu de rota protegida é exposto antes da autenticação. Preferências visuais públicas valem somente durante a visita e não são gravadas nas fatias da conta. Entradas em `pages/` continuam declarando uma área protegida e exigindo autenticação. Cada entrada declara `meta[name="aurora-route"]`; `src/js/main.js` lê esse valor apenas no primeiro carregamento sem hash. Depois disso, a navegação é resolvida por hash através de `src/js/core/router.js`; `#pessoal` redireciona para Início.

O shell, os menus e os modais são compartilhados e renderizados no elemento `#app`. Não há cabeçalho, navegação ou estado duplicado por página. As entradas HTML definem idioma, título, descrição, CSS e módulo de inicialização. O conteúdo dinâmico das telas permanece em `main.js`; as entradas não são templates HTML independentes.

## Responsabilidades existentes

- `src/js/main.js`: composição e inicialização; estado em memória `S`; interface e formulários; despacho de eventos; integração entre áreas.
- `src/js/core/router.js`: canonicalização de rotas, incluindo aliases legados para o Pomodoro.
- `src/js/core/`: roteamento e compatibilidade de rotas; a personalização do perfil é opcional e não bloqueia ações.
- `src/js/services/account-auth.js`: gate de conta, cadastro em etapas (perfil, acesso e confirmação de e-mail), login por senha e recuperação de acesso; não exige MFA. A saída da sessão local fica no shell de `main.js` e é acessada em Ajustes → Seu perfil; ao sair, a aplicação retorna à landing pública na raiz.
- `src/js/data/`: cliente Supabase singleton, `RelationalAccountStore` e módulos temporários de leitura/mesclagem dos dados legados para importação explícita.
- `src/js/services/crypto-vault.js`: leitor legado temporário, chamado somente quando a pessoa informa a senha do cofre na tela de importação; não participa do login ou persistência relacional.
- `src/js/features/finance/calculations.js`: cálculos puros de saldo, totais mensais, categorias e cartão; recebe os dados e dependências explicitamente.
- `src/js/features/finance/statement.js`: leitura pura de extratos CSV/OFX, com limite de prévia informado pela interface.
- `src/js/features/landing/view.js`: landing pública e demonstração fictícia somente de leitura; as ações de cadastro e login usam o fluxo de conta existente.
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

A inicialização bloqueia a tela principal até que o usuário esteja confirmado e autenticado. RLS restringe a leitura e gravação a `auth.uid()`; MFA não é obrigatório. A sessão de autenticação é a única persistência de dados do usuário permitida no navegador; o estado do app vive em memória e as gravações vão diretamente ao Supabase. Se a rede cair, a interface avisa e bloqueia gravações; falhas de persistência ficam visíveis e só são reenviadas após ação explícita. O service worker pode armazenar somente recursos estáticos do app; nunca respostas de API. Backups e cópias de recuperação continuam em JSON sem criptografia e exigem confirmação. A inicialização remove do armazenamento local as fatias antigas exclusivas de Estudos; a migration `20261029050000_remove_studies.sql` remove seus registros relacionais e cifrados no banco.

Termos de Uso e Política de Privacidade são documentos públicos versão 1.2, abertos em um `<dialog>` compartilhado no footer, com páginas estáticas como fallback. Cadastro e renovação do aceite só liberam a caixa e o botão após os dois documentos serem percorridos até o fim. O aceite é registrado nos metadados da conta. Uma conta existente sem aceite atual fica bloqueada até aceitar ou recusar; a recusa apresenta um aviso e pede confirmação final. A Edge Function `delete-account` valida a sessão, limpa inscrições Push remotas e exclui a conta; não há chave administrativa no navegador. A função precisa ser configurada e publicada pelo responsável, conforme `supabase/README.md`, antes de a exclusão funcionar.

Falhas de leitura e gravação são reportadas no console e na interface. Se a conversão detectar registros incompatíveis, as gravações são bloqueadas para não substituir o conjunto relacional por uma versão incompleta; uma cópia recuperável pode ser exportada. O único backend opcional é isolado em `worker/`: o Worker Cloudflare valida origem e entradas, enquanto uma Durable Object por instalação mantém a inscrição e a fase/horário necessário para acionar o Push. Nenhuma tarefa, perfil ou outra fatia é transmitida.

O service worker raiz exibe Push somente quando não há uma janela do Aurora visível. O app não pede permissão no carregamento; a solicitação acontece no controle explícito da tela do Pomodoro. Recursos estáticos usam stale-while-revalidate; Termos de Uso e Política de Privacidade usam network-first, com cache como fallback offline; navegação também é network-first e pode usar somente HTML estático em cache como fallback.

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
