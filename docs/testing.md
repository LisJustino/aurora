# Testes

## Comandos e cobertura automatizada

Execute na raiz do repositório:

```powershell
npm ci
npm test
npm run build
npx playwright install chromium firefox webkit
npm run test:e2e:ci
npm --prefix worker ci
npm --prefix worker test
```

O workflow do GitHub executa `npm test`, sobe um Postgres Supabase local
isolado, aplica todas as migrations, roda `supabase/tests/rls_isolation.sql`
e um conflito concorrente com duas conexões PostgreSQL, faz o build, treze
cenários E2E em Chromium e um fluxo-smoke em Firefox e WebKit em cada push
e pull request. Esse job usa somente containers locais descartáveis e não
acessa projetos Supabase remotos. `npm run
test:e2e:ci` inicia servidores Vite temporários em `127.0.0.1:5179` e
`127.0.0.1:4180`, usa somente demonstração e dados fictícios e encerra os
servidores ao final. Ele exige o build e o navegador Chromium instalados.
Os cenários também verificam acessibilidade e contraste, sincronização dos
selects customizados com os controles nativos, regressões de Finanças e
bloqueio/restauração do scroll em diálogos e painéis móveis e desktop.

Os testes de lógica e persistência usam dados simulados. A integração Supabase
usa banco local descartável, não credenciais nem dados remotos. O teste
concorrente cria um usuário temporário no banco local, sincroniza duas
conexões sobre a mesma versão e confirma que a gravação obsoleta é rejeitada;
o fixture é removido ao final. O teste de falha de persistência simula a
indisponibilidade da RPC, verifica que a versão confirmada não avança e que uma
tentativa posterior consegue salvar. A cobertura de backup cifrado inclui
exportação sem texto puro, round-trip, senha incorreta, adulteração e
preservação do fluxo de prévia; os backups comuns v1/v2 continuam aceitos pelo
parser existente. A persistência também cobre gravação e recuperação quando o
estado do Pomodoro não possui timer carregado.

O fluxo de atualização PWA em Chromium usa um `ServiceWorkerContainer` de teste
para conferir aviso, adiamento, nova notificação e mensagem explícita
`SKIP_WAITING`; o ciclo real de instalação/atualização ainda deve ser conferido
em Preview com dois builds servidos na mesma origem. Firefox e WebKit exercitam
tarefa, diálogo, console e layout móvel; a matriz não equivale a repetir todos
os E2E nem a testar Safari/iOS ou dispositivos físicos.

## Pendências externas de lançamento

- Revisão jurídica assinada dos Termos de Uso e da Política de Privacidade.
- Conferência no Dashboard Supabase de Production: migrations, RLS,
  autoconfirmação, URLs de retorno e Edge Function de exclusão.
- Fluxos autenticados em contas fictícias de Preview e Production: cadastro,
  login, recuperação, persistência após reload e exclusão definitiva.
- Repetir em Preview a corrida de duas sessões autenticadas reais, além da
  corrida automatizada coberta no Postgres local descartável.

Esses itens exigem responsáveis, acesso e evidências externas. Build, CI e
testes locais não os marcam como concluídos.

Os registros de aprovação datados nas seções abaixo são históricos; não
substituem uma nova execução dos comandos nem comprovam o estado atual dos
ambientes remotos.

## Roteiros manuais de regressão

Confira a separação de ambientes: `.env.local` deve apontar para
`cltymialatksylhzsitz` (`aurora-dev`); Cloudflare Preview deve receber
`VITE_SUPABASE_TARGET=development` e a URL/chave Preview de `aurora-dev`;
Cloudflare Production deve receber `VITE_SUPABASE_TARGET=production` e a
URL/chave Production de `aurora-prod` (`xeneztudcqdumfhwotry`). A configuração
deve recusar target ausente, URL de outro projeto ou chave ausente sem iniciar
autenticação. Com ambos projetos configurados, use o mesmo e-mail para criar
uma conta em cada um e confirme os dois usuários nos respectivos painéis
Supabase; não reutilize dados de produção durante a validação.

Na landing, confirme que criar conta é o CTA principal e a demonstração é a
alternativa; o texto deve informar que finanças são registradas manualmente e
que a demonstração usa exemplos fictícios sem salvar alterações. Não deve
haver depoimentos fictícios, nem promessas vagas de preço ou privacidade. Em
320 px, mobile e desktop, confira a grade de áreas, o FAQ e a ausência de
overflow horizontal. A demonstração interativa cobre uma tarefa, um hábito e
o Pomodoro; finanças e ciclo são apresentados, mas não simulados nela.

Com uma sessão válida salva, abra a rota raiz e confirme que a área autenticada
é carregada sem precisar tocar em “Entrar”; depois encerre a sessão e confirme
que a landing pública volta a aparecer. Com uma sessão só de navegador, confirme
que a restauração funciona na aba atual, mas não persiste em outro navegador.

Em Finanças, no resumo, confirme que “Últimos lançamentos” inclui somente o mês
selecionado e, no mês atual, não lista datas futuras nem lançamentos de meses
seguintes gerados por fixas. Em Gerenciar categorias, edite nome, ícone e cor
de uma categoria usada em lançamentos, crie uma subcategoria com identidade
visual própria e confira a atualização dos lançamentos e limites associados ao
renomear. No formulário, selecione uma data diferente de hoje e confirme que
“Já paguei/recebi” é desmarcado; revise se “Data do lançamento” e “Data do
pagamento/recebimento” deixam clara a diferença entre competência e caixa. O
checkbox e sua explicação devem permanecer alinhados, e a data de pagamento
com sua explicação não devem dividir a mesma linha. Em celular, os três tipos
de lançamento não devem se deslocar horizontalmente ao selecionar Receita ou
Transferência; a seção ativa de Finanças deve continuar focada e visível após a
navegação.

Ao navegar para outra área a partir de Ajustes e retornar pelo histórico ou pelo menu, confirme que “Seu perfil” é selecionado. Recarregue enquanto outra aba de Ajustes estiver aberta e confirme que essa aba permanece selecionada.

Na navegação, confira os atalhos das áreas sem overflow entre 768 e 1199 px, o nome da rota ativa visível no tablet, os nomes das áreas e de “Criar” visíveis entre 1100 e 1199 px e a barra lateral a partir de 1200 px; os demais atalhos devem continuar identificáveis pelo nome ao passar o mouse ou receber foco. A busca não aparece no cabeçalho e Ctrl+K continua abrindo a busca global. No móvel, o dock mantém quatro atalhos de área, “Mais” abre as opções restantes e “Criar” abre as ações rápidas; toque fora e Esc fecham os painéis, e Esc devolve o foco ao acionador. A criação rápida deve reutilizar os formulários existentes e listar hábitos/finanças somente quando essas áreas estiverem ativadas.

No Início, em 320 px, 390 px e desktop, confirme que o destaque inicial é compacto, que o plano de hoje vem antes dos resumos nos padrões novos e que uma tarefa exibida no plano não é repetida como “Próxima ação”. Preferências de ordem existentes devem continuar preservadas. Em “Primeiros passos”, confira o progresso, a sugestão única, o texto de hábitos quando ainda não existe hábito ativo, as áreas ativadas, o recolhimento e a opção de dispensar. Confira o estado vazio do plano, a lista de concluídas recolhida/expandida, o skeleton de carregamento e confirmações de sucesso/alerta/erro em tema claro, escuro e com movimento reduzido.

Com uma conta fictícia autenticada, confirme que o estado do shell informa “Salvando…” durante a gravação, “Tudo salvo na sua conta” depois da confirmação e um aviso recuperável quando a gravação falha ou não há conexão. A prévia local não deve afirmar que os dados foram sincronizados.

`node tests/e2e/app-shell-quick-actions.cjs http://127.0.0.1:5173` valida as ações rápidas, o foco por teclado, os rótulos da navegação em tablet, a área ativa e a transição do dock para a barra lateral entre 320 e 1440 px.

`node tests/e2e/app-shell-pomodoro-mini.cjs http://127.0.0.1:5173` valida o mini Pomodoro durante a navegação entre áreas, os controles por teclado e a ausência de overflow em telas móveis e desktop.

Em Ajustes → Seu perfil, experimente os símbolos, cores e três formas de saudação; a prévia deve acompanhar as escolhas e o nome preferido, e as mudanças só devem ser persistidas ao salvar. Recarregue e confira a preferência, depois restaure o perfil padrão e salve. Em Personalização, teste os presets Calmo, Clássico e Vibrante, ajuste os controles individuais após um preset, descarte alterações e confirme que modo do tema e opções de acessibilidade não são sobrescritos. Selecione cores por área e confira títulos, ícones e indicadores em tema claro, escuro e automático, inclusive com contraste alto. Use os links de Rotina para acessar os ajustes existentes de Pomodoro e lembretes sem duplicar preferências. Em Áreas e navegação, alterne entre Visão geral, Foco e Rotina, altere layouts e favoritos em cada um, troque de modo e confirme que as escolhas ficam isoladas; escreva/limpe a mensagem pessoal, restaure o modo atual e salve. Confira os atalhos favoritos com as áreas habilitadas e desabilitadas, inclusive Finanças sem conta cadastrada, e valide o limite de 120 caracteres. Teste em 320 px e desktop, com teclado e tema escuro. Recarregue e confirme a persistência. Verifique também a importação/exportação de backup anterior, que deve continuar compatível e usar os padrões para os campos novos ausentes.

Em Hábitos, abra “Revisar cada hábito” e confira o resumo até a data atual,
excluindo dias pulados e sem contar dias futuros. “Ajustar” deve abrir o editor
do hábito correspondente, preservar os check-ins e permitir salvar dias/meta;
os hábitos pausados devem continuar disponíveis na ação de retomada. “Excluir”
deve estar disponível nos hábitos ativos e arquivados, pedir confirmação e
mover o hábito e seu histórico para a lixeira por 30 dias; a ação de desfazer
deve restaurá-los. Arquivar continua preservando o hábito na lista de
arquivados. Confira também em largura móvel e com tema escuro.

Na primeira visita a Hábitos, confirme que o estado “Dia livre” não repete o
botão “Novo hábito”, que não há resumo semanal sem hábitos e que somente quatro
ideias são exibidas até “Ver todas”. Buscar ou filtrar ideias deve revelar os
resultados correspondentes, atualizar a contagem e o estado acessível do filtro.
As quatro ideias iniciais devem representar categorias distintas. Combine os
filtros de categoria e contexto (“Poucos minutos”, “Em casa” e “Sem
equipamento”), confira contagens e estados selecionados e busque também por
termos dos contextos. Cartões resumem descrições longas em até duas linhas; ao
personalizar, a descrição completa aparece no editor sem gravar antes de salvar.
Com um hábito ativo, confirme que a semana fica visível sem expandir os detalhes,
que dias passados programados podem ser marcados/desmarcados e que histórico e
ações de gerenciamento continuam acessíveis ao expandir cada seção. Lembretes
do sistema devem começar recolhidos e manter a ativação explícita. Em 320 px,
390 px e desktop, confirme que sete dias permanecem utilizáveis, sem overflow
horizontal; verifique também tema escuro, teclado e movimento reduzido.

Nas “Ideias de hábitos”, confira busca por nome, descrição e características,
busca sem diferenciação de acentos, filtros combinados por categoria/contexto,
contagem e estado sem resultados. Selecionar uma ideia deve continuar abrindo
o editor sem gravar antes da confirmação; verifique foco/teclado e largura móvel.

No cadastro, valide que erros de e-mail já associado (incluindo a resposta sem sessão com lista de identidades vazia do Supabase) explicam que uma exclusão confirmada permite criar uma conta nova, sem restaurar dados antigos. A exclusão só é considerada concluída com a confirmação explícita da Edge Function, que chama a Admin API em modo de exclusão definitiva; erros desconhecidos mantêm uma mensagem segura e genérica.

Nos projetos Supabase de desenvolvimento e produção, confirme que **Authentication → Providers → Email → Confirm email** está desativado. Um cadastro novo deve receber sessão imediatamente; se o provedor retornar usuário sem sessão, a tela deve apontar a configuração incompatível, não orientar a pessoa a confirmar o e-mail. Contas antigas pendentes devem receber instrução para liberação manual no Dashboard; o app não pode oferecer reenvio de confirmação. Ao abrir um callback com `error_code=otp_expired`, o login deve explicar que o link expirou, limpar parâmetros de erro da URL e manter um caminho recuperável sem expor a descrição técnica do provedor.

Com Google habilitado e `/#inicio` cadastrado como URL de retorno no Supabase, teste o botão social. O retorno deve abrir a área autenticada, não a landing pública. No primeiro acesso, o OAuth também cria a conta no Supabase; nome, nome de preferência, data de nascimento válida (com idade entre 0 e 120 anos) e aceite dos documentos são obrigatórios antes de carregar os dados. Cadastros abaixo de 18 anos, inclusive com idade zero, não devem ser bloqueados. Cancelar esse cadastro deve encerrar a sessão. O login Apple/iCloud não deve aparecer nem ser aceito como novo fluxo por enquanto; a detecção de identidade Apple existente permanece para compatibilidade.

Para a integração opcional de calendário, configure `VITE_GOOGLE_CALENDAR_CLIENT_ID` com um Client ID Web dedicado, ative a Google Calendar API e cadastre a origem do app no Google Cloud. No Planejar → Calendário, “Conectar” apenas carrega a biblioteca após ação explícita; “Autorizar” pede escopo somente de leitura. Confirme que é possível escolher calendários, ver eventos no mês e no dia, navegar entre meses, atualizar e parar de exibir; nenhuma ação deve criar/alterar eventos ou persistir token/eventos após recarga. Verifique a revogação em Conta Google → Segurança e console sem tokens nem conteúdo dos eventos. A versão 1.6 dos documentos deve exigir novo aceite das contas existentes. Teste o serviço isoladamente com `node tests/google-calendar-check.mjs`. Um teste com conta Google real depende da configuração do Client ID, consentimento e eventual verificação do app no Google Cloud.

O fluxo da interface com respostas Google simuladas pode ser validado iniciando
o Vite com qualquer Client ID de teste configurado e executando
`npm run test:e2e:google-calendar -- http://127.0.0.1:5173`; o teste não chama
serviços externos.

Nos campos de e-mail do cadastro, login e recuperação, confira sugestões após `@`, lista inicial compacta, filtragem, seleção por teclado/toque e a possibilidade de continuar digitando um domínio que não aparece. Ao abrir o login, os campos vazios não devem exibir erros; a validação não deve mostrar erro enquanto o campo está em edição e deve avisar depois que a pessoa sair de um endereço inválido.

Na etapa de perfil do cadastro em mobile, confirme que o texto introdutório redundante fica oculto para aproximar o campo de nascimento do viewport; em desktop, a introdução permanece visível. Confira também a largura do campo em 320 px e o comportamento do teclado/seletor nativo em um dispositivo físico.

### Segurança e fallback

- CSP e headers de segurança são validados em `_headers`; a política inclui `default-src 'self'`, permissões restritas de script/frame/conexão para Google Identity Services e Google Calendar, `connect-src` para Supabase e Worker Push, `frame-ancestors 'none'` e `form-action 'self'`.
- O fallback SPA continua em `/index.html` para rotas, mas `/src/*`, `/icons/*` e `/pages/*` devem responder 404 quando o arquivo não existir.
- Depois de `npm run build`, confirme que todas as entradas HTML apontam para o manifest na raiz publicada; o arquivo não pode ser reescrito para `/assets/`, pois `start_url` e `scope` são relativos ao manifest.
- A persistência relacional usa delta por tabela e bloqueia sobrescrita de linha mais nova com conflito `version_conflict`; a aba recarrega os dados em foco quando não há pendências.
- Campos opcionais nulos no banco devem ser omitidos ao reconstruir registros, não materializados como propriedades `undefined`, para que a validação de tarefas não bloqueie dados válidos.
- A migration `20261030100000_relational_version_conflict.sql` foi aplicada no projeto Supabase de desenvolvimento em 2026-10-30; uma consulta somente de leitura confirmou que `apply_relational_changes(jsonb)` retorna `jsonb`. Depois da migration, uma tarefa de teste permaneceu após recarregar o app sem erro; os dados da tentativa anterior também estavam presentes.

### Publicação e decisões pendentes

- Antes de ampliar a divulgação, siga o checklist de [`cloudflare-pages.md`](./cloudflare-pages.md): revisão jurídica dos documentos, confirmação operacional do projeto de produção e testes dos fluxos com contas fictícias.
- A produção ainda precisa de verificação independente das configurações Supabase; o estado do projeto de desenvolvimento não comprova as configurações de produção.
- O cadastro permanece sem confirmação de e-mail. A interface deve avisar que o endereço precisa estar correto e acessível para permitir recuperação da senha.
- Analytics comportamental e rastreadores de terceiros continuam adiados; Google Identity Services é carregado somente por ação explícita e exclusivamente para conceder a leitura opcional de calendário descrita na Política de Privacidade.
- Não altere a versão dos documentos legais sem alinhar `terms.html`, `privacy.html`, `LEGAL_DOCUMENT_VERSION` e o fluxo de reconsentimento; uma nova versão pode exigir aceite de contas existentes.

Na raiz do repositório, instale as dependências e execute:

```powershell
npm ci
npm test
npm run build
```

Para validar a interface no navegador:

```powershell
npm run dev
```

Abra `http://localhost:5173/`. O runner de verificações de interface fica em
`http://localhost:5173/tests/`.

Os testes E2E opcionais usam Playwright:
para `auth-preview-boundary.cjs`, mantenha o servidor de desenvolvimento na
porta 5173 e, depois do build, sirva a versão de produção na porta 4173 em
outro terminal. O cenário usa somente dados fictícios e bloqueia conexões
externas.

```powershell
npx playwright install chromium
node tests/e2e/dialog-mobile.cjs http://127.0.0.1:5173
node tests/e2e/legal-dialog-mobile.cjs http://127.0.0.1:5173
node tests/e2e/modal-scroll-lock.cjs http://127.0.0.1:5173
node tests/e2e/close-buttons.cjs http://127.0.0.1:5173
node tests/e2e/legal-consent-flow.cjs http://127.0.0.1:5173
node tests/e2e/email-domain-suggestions.cjs http://127.0.0.1:5173
node tests/e2e/notifications.cjs http://127.0.0.1:5173
node tests/e2e/home-first-steps.cjs http://127.0.0.1:5173
node tests/e2e/habits-app-experience.cjs http://127.0.0.1:5173
node tests/e2e/empty-filter-recovery.cjs http://127.0.0.1:5173
node tests/e2e/finance-improvements.cjs http://127.0.0.1:5173
node tests/e2e/planning-task-form.cjs http://127.0.0.1:5173
node tests/e2e/public-demo-interactions.cjs http://127.0.0.1:5173
node tests/e2e/signup-birthdate.cjs http://127.0.0.1:5173
node tests/e2e/custom-select.cjs http://127.0.0.1:5173
node tests/e2e/accessibility.cjs http://127.0.0.1:5173
node tests/e2e/auth-preview-boundary.cjs http://127.0.0.1:5173 http://127.0.0.1:4173
```

O cenário de notificações confirma que lembretes novos não abrem o painel
automaticamente, que o indicador do sino permite encontrá-los e que abrir,
adiar e dispensar continuam funcionando em mobile e desktop; também confere
pausar e retomar lembretes internos e a mensagem de que avisos do sistema não
são alterados.
- `node tests/e2e/signup-birthdate.cjs` confere a grade compacta da landing (cards até 320 px, duas colunas no tablet e composição 3+2 centralizada no desktop), o hero compacto e os CTAs em desktop/tablet/mobile, o seletor de nascimento e a liberação do cadastro para menores e idade zero sem enviar o cadastro.
- `node tests/e2e/custom-select.cjs` valida o menu padronizado em desktop e mobile, navegação por teclado, sincronização de valor/eventos, rótulo acessível, campo desabilitado e posicionamento dentro da viewport.
- `node tests/e2e/accessibility.cjs` valida os painéis público e autenticado (Escape, retorno de foco e semântica disclosure), movimento reduzido do sistema e preferência salva, ampliação do texto, foco visível, contraste de componentes reais nas 14 paletas e reflow em viewports de 640 e 320 CSS px. As larguras simulam a condição de reflow; não substituem teste manual de zoom do navegador.
- `node tests/e2e/legal-consent-flow.cjs` valida o painel Aurora de reaceite, os links acessíveis dos documentos, o aceite obrigatório e os layouts mobile/desktop.
- **Aprovado (2026-10-29):** `node tests/e2e/notifications.cjs http://127.0.0.1:5173` — fluxo mobile/desktop, sem overflow horizontal nem erros no console.

## Prévia visual local

- `node tests/e2e/dialog-mobile.cjs http://127.0.0.1:5173` — verifica diálogos móveis e desktop sem abrir o teclado automaticamente.
- `node tests/e2e/modal-scroll-lock.cjs http://127.0.0.1:5173` — verifica que notificações, pesquisa, acessibilidade pública/autenticada e modais bloqueiam o scroll externo, mantêm o cabeçalho visível e restauram a posição ao fechar em mobile/desktop.
- **Aprovado:** `node tests/e2e/close-buttons.cjs http://127.0.0.1:5173` — os controles medem 40×40 px e mantêm raio consistente em celular e desktop.
- O mesmo roteiro confere título acessível nos diálogos amostrados e o cabeçalho de “Apagar dados relacionais”; o onboarding em tela cheia e o leitor legal nativo são exceções intencionais ao modal comum.
- O antigo `tests/e2e/flows.cjs` foi removido: dependia de persistência legada no navegador e não representava os contratos atuais de conta e dados relacionais.
- `node tests/e2e/home-first-steps.cjs` verifica ações iniciais conforme as áreas ativas, ocultação após conclusão, atalho de personalização, layout móvel/desktop, botão “Como usar?” e os dois formatos locais de vídeo.
- `node tests/e2e/empty-filter-recovery.cjs` verifica recuperação de resultados vazios por busca em Planejar e Finanças, anúncio educado dos estados vazios, largura móvel/desktop e console; no onboarding real, confira a escolha de áreas e a indicação de onde alterá-las depois.
- `node tests/e2e/finance-improvements.cjs` verifica categorias e subcategorias personalizadas, reutilização da conta/categoria mais recente, status de pagamento conforme a data, foco da seção, posição dos tipos de lançamento e recorte mensal do resumo em perfil de demonstração.
- `node tests/e2e/app-shell-quick-actions.cjs` verifica acionador/fechamento da busca global, conclusão e desfazer de uma tarefa, além das ações rápidas e navegação responsiva.
- `node tests/e2e/habits-app-experience.cjs` também verifica desfazer uma marcação de hábito em dados isolados da prévia.
- `node tests/e2e/planning-task-form.cjs` verifica o formulário completo, ausência de criação rápida e do fluxo por etapas, abertura sem foco automático e campo de horário em 390 px.
- `node tests/e2e/public-demo-interactions.cjs` verifica hábito/tarefa/timer por teclado, zero requisições e zero gravações no navegador, em 390 px e desktop.
- **Aprovado (2026-10-30):** `node tests/e2e/email-domain-suggestions.cjs http://127.0.0.1:5190` — lista compacta, filtragem, seleção por teclado/clique e validação após sair do campo, em 320 px e desktop.
- **Aprovado (2026-10-30):** `npm test` — 82/82 testes base, além das verificações de conta, exclusão, sugestões, cofre, persistência relacional e importação; a persistência cobre no-op, delta de linhas, conflito por versão e substituição explícita.
- **Aprovado (2026-10-30):** `npm run build`, `node --check` nos arquivos JavaScript alterados e `git diff --check`.
- **Aprovado (2026-10-30):** aplicação de `20261030100000_relational_version_conflict.sql` no Supabase de desenvolvimento; consulta a `pg_get_function_result` confirmou `jsonb`.
- **Aprovado (2026-10-30):** gravação real de uma tarefa de teste após a migration e releitura após recarga no projeto de desenvolvimento, sem erro.
- **Aprovado (2026-10-30):** `node tests/relational-store-check.mjs` e navegador local — campos opcionais nulos são omitidos no mapeamento relacional; a tarefa antes ocultada voltou a aparecer sem bloqueio. Nenhuma gravação foi feita durante esta correção.
- A falha de gravação de Finanças em Production exige verificar no Dashboard do projeto `aurora-prod` as migrations pendentes, especialmente `20261030110000_finance_account_types_and_card_link.sql`, e registrar o erro da requisição/RPC antes de aplicar qualquer mudança. A validação de uma migration no projeto dev não confirma o estado de Production.
- O erro `23503` em `finance_transactions_recurrence_owner_fkey` indica que um lançamento recorrente foi enviado antes da recorrência referenciada; o teste relacional confirma que `finance_recurrences` é persistida antes de `finance_transactions`, sem alterar IDs ou schema.
- **Pendente:** testar concorrência real contra PostgreSQL/Supabase; não há banco local de teste configurado neste ambiente.

## Worker de notificações

O Worker tem dependências e testes separados:

```powershell
npm --prefix worker ci
npm --prefix worker test
```

## Personalização inicial

- Confirme que a primeira etapa oferece organização, foco, hábitos, finanças e ciclo; água e movimento aparecem como hábitos, sem prometer volume em mL nem sugerir uma área Academia.
- Em 1340 × 720, confira a grade em três colunas sem rolagem; em 390 px e 320 px, os cartões ficam em uma coluna sem overflow horizontal.

## Tutoriais por área

- No Início, confira o cartão “Primeiros passos” com tarefa, hábito, foco e conta financeira; dispense-o e confirme que `firstStepsDismissed` é salvo em `user_settings.preferences`.
- Confirme que nenhum tutorial abre sozinho. O botão “Como usar?” abre o roteiro e o vídeo em Início, Planejar, Pomodoro, Finanças, Hábitos e Ciclo; Ajustes não tem tutorial.
- Em Finanças, confira o aviso permanente de ausência de conexão bancária e que os registros adicionados ficam associados à conta Aurora.
- Teste controles de vídeo, roteiro textual, teclado, tema claro/escuro e larguras móvel e desktop; não deve haver overflow horizontal.
- Os vídeos são arquivos locais WebM com fallback MP4 e não carregam um player ou serviço de terceiros.
- Os tutoriais são gravados em 24 fps, 1280 × 720 e 2,4 Mbps para manter legibilidade em tela cheia sem sobrecarregar a decodificação móvel; depois de qualquer regeneração, valide reprodução contínua e seek no Chromium.
- Em Planejar, valide “hoje”, “amanhã” e “sexta 18h”: confira a prévia antes de confirmar, cancele sem criar e use Enter para confirmar a tarefa.
- Em rede indisponível, confirme que o aviso permanece visível e que o salvamento é bloqueado; não exiba horário de salvamento no cabeçalho. Confirme também cancelar e aceitar nos diálogos de backup, importação, recarga e saída.
- Simule falha de `load()` do store autenticado: a tela deve oferecer “Tentar novamente” e “Sair”, sem exibir estado vazio como se os dados tivessem sido carregados.
- Para a sugestão “Beber água”, confira que a idade é editável em Ajustes e que o peso informado no formulário só calcula uma estimativa, sem salvar no perfil ou histórico; o campo deve indicar kg e aceitar decimais. Edite a meta independente do nome, registre volumes em mL, confira a soma do dia local, a conclusão automática e a persistência. Importe também um hábito legado com “mL/dia” no nome e confirme que sua meta é preservada e o sufixo deixa de ser necessário. Verifique exportação/importação e reload sem alterar a versão do backup.
- Em Hábitos, confira o panorama semanal agregado, as ações de retomar hábitos pausados e o destaque discreto de pendentes; “Hoje” não deve cobrar sequências nem substituir seu foco por histórico.
- Em Hábitos, confira sugestões separadas por categoria e a cartela expandida de ícones no formulário de criação.
- Em Ciclo, registre sintomas em dias diferentes e confirme que cada registro afeta somente o dia selecionado.
- Em perfil isolado e HTTPS, configure um horário e dias em um hábito; autorize Push somente pelo botão explícito, confirme uma mensagem genérica fora do app e que o clique abre Hábitos. Marcar ou pular o dia deve atualizar o agendamento. Desativar a inscrição deve interromper também o Push do Pomodoro. Sem configuração de Worker/permissão, o horário deve continuar descrito como preferência e não como alarme garantido.
- **Aprovado (2026-10-29):** `npm test` — 76/76 testes base e verificações de conta, exclusão, sugestões, cofre, persistência relacional e importação legada; inclui validação do peso usado na estimativa de água.
- **Aprovado (2026-10-29):** `npm run build`, verificações de sintaxe nos módulos alterados e `git diff --check`.
- **Limite:** o navegador local sem sessão autenticada mostrou a landing pública; não foi possível validar visualmente Ajustes e o diálogo do hábito.
- **Aprovado:** os seis WebM finais reportam 1280 × 720, duração finita e seek funcional no Chromium; a captura do diálogo de Início em 1366 × 768 foi conferida visualmente.
- **Limite:** o Chromium headless concluiu o vídeo de Finanças sem erro de mídia, mas a cadência medida variou; fluidez em dispositivo físico ainda precisa de confirmação.
- **Aprovado:** `npm run build` incluiu os seis WebM na saída de produção; não foi gerado vídeo para Ajustes.
- **Aprovado (2026-10-29):** `npm test` — 75/75 testes base e verificações de conta, exclusão, sugestões, cofre, persistência relacional e importação legada.
- **Aprovado (2026-10-29):** `npm run build` — compilação de produção concluída.
- O navegador local sem sessão autenticada exibiu o gate de acesso; não foi possível validar visualmente a tela autenticada de Hábitos neste ambiente.
- Abertura automática, persistência após recarga, temas e layout móvel/desktop ainda não foram validados no navegador.

## Documentos legais e exclusão de conta

- **Aprovado (2026-10-30):** `npm test` verifica que, após excluir a conta, a navegação substitui a página interna pela landing pública na raiz.
- **Aprovado (2026-10-30):** `node tests/e2e/legal-dialog-mobile.cjs http://127.0.0.1:5173` — Chromium simulando iPhone 12 em retrato/paisagem, 320 × 568 e desktop; modal dentro da tela, documento rolável e rodapé visível, sem overflow horizontal ou erros JavaScript.
- **Aprovado:** `npm test` — 71/71 testes base e verificações de conta, consentimento e limite de rolagem, Edge Function/Push, sugestões, cofre, persistência relacional e importação legada.
- **Aprovado:** `npm run build`, `node --check` nos módulos alterados e `git diff --check`.
- **Aprovado (2026-10-29):** Chromium local — landing atualizada e cadastro em duas etapas a 390 px; em 320 px o campo de e-mail permaneceu dentro do cartão, com texto de recuperação associado ao campo e sem overflow horizontal.
- **Aprovado (2026-10-30):** Chromium a 320 px — aceite explícito no formulário, links para os dois documentos em novas abas e sem overflow horizontal nem erros JavaScript.
- **Aprovado (2026-10-29):** Chromium em 390 px com Supabase simulado — cadastro recebeu uma sessão com `email_confirmed_at` vazio e avançou sem a etapa de confirmação; nenhuma conta ou requisição foi enviada a um projeto remoto e não houve erros JavaScript.
- **Aprovado:** navegador local — etapas de perfil/acesso navegáveis, campos do perfil preservados ao voltar e e-mail mantido ao alternar entre acesso e recuperação; sem overflow horizontal em 390 px e 1366 px.
- **Aprovado:** formulário de cadastro — aceite explícito com links legais em novas abas e, em viewports móveis estreitos/baixos, o cartão cresce com a página em vez de cortar o formulário com uma rolagem interna; sem overflow horizontal.
- **Não executado automaticamente:** implantação da Edge Function, exclusão real de conta, limpeza em Worker publicado, CORS/configuração de secrets ou exclusão em cascata no Supabase. Esses cenários exigem projeto isolado e conta/inscrição fictícias; nunca testar em conta real.
- **Aprovado (2026-10-30):** leitura pública de Auth Settings no projeto Supabase de desenvolvimento confirmou `mailer_autoconfirm=false` antes da alteração e `true` depois que a pessoa desativou **Confirm email** no Dashboard. O projeto de produção não foi verificado.
- **Aprovado (2026-10-30):** login na conta existente, gravação de uma tarefa após a migration e confirmação de que ela permaneceu após recarregar o app. Os dados da tentativa anterior também apareceram; nenhuma conta ou registro foi apagado.
- O aceite não depende mais de rolar o conteúdo até o final; a caixa obrigatória permanece no formulário e os documentos abrem em novas abas.
- Cadastro remoto de uma conta nova não foi testado; testes locais cobrem o callback expirado e garantem que o app não envie links de confirmação.

## Limites

Os testes locais, por si só, não comprovam login, políticas RLS, migrations ou
gravações no projeto Supabase remoto; a validação manual de desenvolvimento está
registrada acima. Para testar políticas e concorrência, use um ambiente isolado e
os cenários SQL em `supabase/tests/rls_isolation.sql`. Não execute testes
destrutivos em dados reais.

Não inclua chaves privadas, tokens, dados de contas ou backups em testes,
capturas de tela ou logs.

## Footer compartilhado e acesso à conta

- O footer compartilhado aparece na landing, na demonstração, nos formulários de conta, nos erros de configuração e no shell autenticado. No tema escuro, mantém o fundo da página; no fluxo de conta, fica fora do elemento `<main>`.
- Na landing, o footer permite abrir a demonstração fictícia; em todos os contextos, “Voltar ao topo” respeita a preferência por movimento reduzido e não altera a rota.
- **Aprovado:** `npm test` — 56/56 testes base e verificações de conta, cofre, persistência relacional e importação; `npx vite build`; verificações de sintaxe e `git diff --check`. No navegador local, o formulário de login mostrou o footer sem overflow em 375 px e 1366 px, inclusive no tema escuro.
- `.env.local` contém os valores públicos do projeto Supabase local nas variáveis `VITE_SUPABASE_LOCAL_*`; `localhost:5173` voltou a mostrar o formulário de login. O build publicado usa variáveis `VITE_SUPABASE_PRODUCTION_*` e deve apontar para outro projeto. Essa verificação de footer não cobriu login real nem migrations remotas; a validação manual de persistência no projeto de desenvolvimento está registrada acima. Se o aviso de configuração reaparecer, reinicie o Vite para reler o arquivo; não compartilhe seus valores.

## Finanças — liquidação, relatórios e importação

- **Aprovado:** `node tests/run.js` — 61/61 testes, incluindo saldos históricos com transferências, visão por competência/caixa, centavos e prévia de extrato limitada a 500 linhas.
- **Aprovado:** `node tests/relational-store-check.mjs` — gravação/leitura de `settled_date` e verificação de migration aditiva, sem atualização retroativa.
- **Aprovado:** `node --check` em `src/js/main.js`, `src/js/features/finance/calculations.js` e `src/js/features/finance/statement.js`.
- **Aprovado:** `npx vite build`; entrada direta `pages/financas.html` em viewport de 390 e 1280 px, sem overflow horizontal nem erros de console. A rota exibiu o gate de autenticação.
- **Aprovado:** `npm run build` concluiu a compilação Vite e a cópia dos arquivos estáticos, incluindo `_headers` e `_redirects`.
- **Não executado:** aplicação da migration em um projeto Supabase de teste, login real, sessão autenticada com os novos relatórios, reload dos dados no Supabase e validação visual da tela financeira autenticada em mobile/desktop.
- **Limitação conhecida:** lançamentos antigos não têm data real de liquidação. Nos relatórios por caixa e no histórico do saldo, a data do lançamento é usada como aproximação até que a pessoa edite e informe uma data de pagamento/recebimento.
- **Limitação conhecida:** pagamentos de fatura aparecem como uma categoria única no caixa; não há rateio retroativo da liquidação entre categorias das compras do cartão.

## Remoção de Estudos e Pomodoro

- **Pomodoro:** a tela inicial mostra o botão logo abaixo do relógio e mantém “Tempos e som” fechado; abra os ajustes para conferir os presets Rápido (15/3), Clássico (25/5), Estendido (50/10) e Foco profundo (90/20). Edite foco/pausa manualmente, use “Salvar tempos” e confirme a persistência após recarregar. Os tempos não podem ser alterados durante uma sessão em andamento ou com progresso não encerrado.
- **Aprovado:** `npm test` — 71/71 testes base e verificações de conta, cofre, persistência relacional e importação legada; inclui a remoção das fatias locais, rejeição de backups antigos e schema sem tabelas de Estudos.
- **Aprovado:** `npm run build` — compilação de produção concluída; as entradas removidas `pages/estudos.html` e `pages/foco.html` não fazem parte do build.
- **Aprovado:** `node --check` nos arquivos JavaScript alterados e `git diff --check`.
- **Não executado:** aplicação da migration `20261029050000_remove_studies.sql` em Supabase. Dados remotos só serão apagados quando ela for revisada e aplicada no projeto correto.
- **Limite:** a migration não consegue remover uma preferência dentro do envelope cifrado misto `user_data.settings`; a normalização a exclui da cópia ativa, mas o original cifrado permanece até limpeza explícita da origem legada.
