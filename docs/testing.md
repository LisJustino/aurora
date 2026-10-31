# Testes

## Aplicação web

Confira a separação de ambientes: `.env.local` deve apontar para
`cltymialatksylhzsitz` (`aurora-dev`); Cloudflare Preview deve receber
`VITE_SUPABASE_TARGET=development` e a URL/chave Preview de `aurora-dev`;
Cloudflare Production deve receber `VITE_SUPABASE_TARGET=production` e a
URL/chave Production de `aurora-prod` (`xeneztudcqdumfhwotry`). A configuração
deve recusar target ausente, URL de outro projeto ou chave ausente sem iniciar
autenticação. Com ambos projetos configurados, use o mesmo e-mail para criar
uma conta em cada um e confirme os dois usuários nos respectivos painéis
Supabase; não reutilize dados de produção durante a validação.

Ao navegar para outra área a partir de Ajustes e retornar pelo histórico ou pelo menu, confirme que “Seu perfil” é selecionado. Recarregue enquanto outra aba de Ajustes estiver aberta e confirme que essa aba permanece selecionada.

No cadastro, valide que erros de e-mail já associado (incluindo a resposta sem sessão com lista de identidades vazia do Supabase) explicam que uma exclusão confirmada permite criar uma conta nova, sem restaurar dados antigos. A exclusão só é considerada concluída com a confirmação explícita da Edge Function, que chama a Admin API em modo de exclusão definitiva; erros desconhecidos mantêm uma mensagem segura e genérica.

Nos projetos Supabase de desenvolvimento e produção, confirme que **Authentication → Providers → Email → Confirm email** está desativado. Um cadastro novo deve receber sessão imediatamente; se o provedor retornar usuário sem sessão, a tela deve apontar a configuração incompatível, não orientar a pessoa a confirmar o e-mail. Contas antigas pendentes devem receber instrução para liberação manual no Dashboard; o app não pode oferecer reenvio de confirmação. Ao abrir um callback com `error_code=otp_expired`, o login deve explicar que o link expirou, limpar parâmetros de erro da URL e manter um caminho recuperável sem expor a descrição técnica do provedor.

Com Google habilitado e `/#inicio` cadastrado como URL de retorno no Supabase, teste o botão social. O retorno deve abrir a área autenticada, não a landing pública. No primeiro acesso, o OAuth também cria a conta no Supabase; nome, nome de preferência, idade mínima de 18 anos e aceite dos documentos são obrigatórios antes de carregar os dados. Cancelar esse cadastro deve encerrar a sessão. O login Apple/iCloud não deve aparecer nem ser aceito como novo fluxo por enquanto; a detecção de identidade Apple existente permanece para compatibilidade.

Nos campos de e-mail do cadastro, login e recuperação, confira sugestões após `@`, lista inicial compacta, filtragem, seleção por teclado/toque e a possibilidade de continuar digitando um domínio que não aparece. Ao abrir o login, os campos vazios não devem exibir erros; a validação não deve mostrar erro enquanto o campo está em edição e deve avisar depois que a pessoa sair de um endereço inválido.

Na etapa de perfil do cadastro em mobile, confirme que o texto introdutório redundante fica oculto para aproximar o campo de nascimento do viewport; em desktop, a introdução permanece visível. Confira também a largura do campo em 320 px e o comportamento do teclado/seletor nativo em um dispositivo físico.

### Segurança e fallback

- CSP e headers de segurança são validados em `_headers`; a política inclui `default-src 'self'`, `connect-src` para o Supabase e o Worker de Push, `frame-ancestors 'none'` e `form-action 'self'`.
- O fallback SPA continua em `/index.html` para rotas, mas `/src/*`, `/icons/*` e `/pages/*` devem responder 404 quando o arquivo não existir.
- Depois de `npm run build`, confirme que todas as entradas HTML apontam para o manifest na raiz publicada; o arquivo não pode ser reescrito para `/assets/`, pois `start_url` e `scope` são relativos ao manifest.
- A persistência relacional usa delta por tabela e bloqueia sobrescrita de linha mais nova com conflito `version_conflict`; a aba recarrega os dados em foco quando não há pendências.
- Campos opcionais nulos no banco devem ser omitidos ao reconstruir registros, não materializados como propriedades `undefined`, para que a validação de tarefas não bloqueie dados válidos.
- A migration `20261030100000_relational_version_conflict.sql` foi aplicada no projeto Supabase de desenvolvimento em 2026-10-30; uma consulta somente de leitura confirmou que `apply_relational_changes(jsonb)` retorna `jsonb`. Depois da migration, uma tarefa de teste permaneceu após recarregar o app sem erro; os dados da tentativa anterior também estavam presentes.

### Publicação e decisões pendentes

- Antes de ampliar a divulgação, siga o checklist de [`cloudflare-pages.md`](./cloudflare-pages.md): revisão jurídica dos documentos, confirmação operacional do projeto de produção e testes dos fluxos com contas fictícias.
- A produção ainda precisa de verificação independente das configurações Supabase; o estado do projeto de desenvolvimento não comprova as configurações de produção.
- O cadastro permanece sem confirmação de e-mail. A interface deve avisar que o endereço precisa estar correto e acessível para permitir recuperação da senha.
- Analytics comportamental e scripts de terceiros estão adiados; a publicação não deve adicionar rastreadores ou eventos sem uma nova decisão e revisão da política/consentimento.
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

```powershell
npx playwright install chromium
node tests/e2e/dialog-mobile.cjs http://127.0.0.1:5173
node tests/e2e/legal-dialog-mobile.cjs http://127.0.0.1:5173
node tests/e2e/close-buttons.cjs http://127.0.0.1:5173
node tests/e2e/legal-consent-flow.cjs http://127.0.0.1:5173
node tests/e2e/email-domain-suggestions.cjs http://127.0.0.1:5173
node tests/e2e/notifications.cjs http://127.0.0.1:5173
node tests/e2e/home-first-steps.cjs http://127.0.0.1:5173
node tests/e2e/empty-filter-recovery.cjs http://127.0.0.1:5173
node tests/e2e/planning-quick-task.cjs http://127.0.0.1:5173
node tests/e2e/public-demo-interactions.cjs http://127.0.0.1:5173
node tests/e2e/signup-birthdate.cjs http://127.0.0.1:5173
```

O cenário de notificações confirma que lembretes novos não abrem o painel
automaticamente, que o indicador do sino permite encontrá-los e que abrir,
adiar e dispensar continuam funcionando em mobile e desktop.
- `node tests/e2e/signup-birthdate.cjs` confere a grade compacta da landing (cards até 320 px, duas colunas no tablet e composição 3+2 centralizada no desktop), os CTAs em desktop/tablet/mobile, a altura do hero em 320 px e 390 px e o seletor de nascimento sem enviar o cadastro.
- **Aprovado (2026-10-29):** `node tests/e2e/notifications.cjs http://127.0.0.1:5173` — fluxo mobile/desktop, sem overflow horizontal nem erros no console.

## Prévia visual local

- **Aprovado:** `node tests/e2e/dialog-mobile.cjs http://127.0.0.1:5173` — o campo recebe foco na abertura em iPhone e desktop, sem deslocar o diálogo.
- **Aprovado:** `node tests/e2e/close-buttons.cjs http://127.0.0.1:5173` — os controles medem 40×40 px e mantêm raio consistente em celular e desktop.
- O mesmo roteiro confere título acessível nos diálogos amostrados e o cabeçalho de “Apagar dados relacionais”; o onboarding em tela cheia e o leitor legal nativo são exceções intencionais ao modal comum.
- O antigo `tests/e2e/flows.cjs` foi removido: dependia de persistência legada no navegador e não representava os contratos atuais de conta e dados relacionais.
- `node tests/e2e/home-first-steps.cjs` verifica ações iniciais conforme as áreas ativas, ocultação após conclusão, atalho de personalização, layout móvel/desktop, botão “Como usar?” e os dois formatos locais de vídeo.
- `node tests/e2e/empty-filter-recovery.cjs` verifica recuperação de resultados vazios por busca em Planejar e Finanças, largura móvel/desktop e console; no onboarding real, confira a escolha de áreas e a indicação de onde alterá-las depois.
- `node tests/e2e/planning-quick-task.cjs` verifica a prévia do prazo, confirmação, cancelamento e criação por Enter em 390 px.
- `node tests/e2e/public-demo-interactions.cjs` verifica hábito/tarefa/timer por teclado, zero requisições e zero gravações no navegador, em 390 px e desktop.
- **Aprovado (2026-10-30):** `node tests/e2e/email-domain-suggestions.cjs http://127.0.0.1:5190` — lista compacta, filtragem, seleção por teclado/clique e validação após sair do campo, em 320 px e desktop.
- **Aprovado (2026-10-30):** `npm test` — 82/82 testes base, além das verificações de conta, exclusão, sugestões, cofre, persistência relacional e importação; a persistência cobre no-op, delta de linhas, conflito por versão e substituição explícita.
- **Aprovado (2026-10-30):** `npm run build`, `node --check` nos arquivos JavaScript alterados e `git diff --check`.
- **Aprovado (2026-10-30):** aplicação de `20261030100000_relational_version_conflict.sql` no Supabase de desenvolvimento; consulta a `pg_get_function_result` confirmou `jsonb`.
- **Aprovado (2026-10-30):** gravação real de uma tarefa de teste após a migration e releitura após recarga no projeto de desenvolvimento, sem erro.
- **Aprovado (2026-10-30):** `node tests/relational-store-check.mjs` e navegador local — campos opcionais nulos são omitidos no mapeamento relacional; a tarefa antes ocultada voltou a aparecer sem bloqueio. Nenhuma gravação foi feita durante esta correção.
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
- Em rede indisponível, confirme que o aviso permanece visível e que o salvamento é bloqueado; um salvamento confirmado mostra “Salvo às HH:MM”. Confirme também cancelar e aceitar nos diálogos de backup, importação, recarga e saída.
- Simule falha de `load()` do store autenticado: a tela deve oferecer “Tentar novamente” e “Sair”, sem exibir estado vazio como se os dados tivessem sido carregados.
- Para a sugestão “Beber água”, confira que a idade é editável em Ajustes e que o peso informado no formulário só calcula uma estimativa, sem salvar no perfil ou histórico. Edite a meta independente do nome, registre volumes em mL, confira a soma do dia local, a conclusão automática e a persistência. Importe também um hábito legado com “mL/dia” no nome e confirme que sua meta é preservada e o sufixo deixa de ser necessário. Verifique exportação/importação e reload sem alterar a versão do backup.
- Em Hábitos, confira o panorama semanal agregado, as ações de retomar hábitos pausados e o destaque discreto de pendentes; “Hoje” não deve cobrar sequências nem substituir seu foco por histórico.
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

- **Aprovado:** `npm test` — 71/71 testes base e verificações de conta, cofre, persistência relacional e importação legada; inclui a remoção das fatias locais, rejeição de backups antigos e schema sem tabelas de Estudos.
- **Aprovado:** `npm run build` — compilação de produção concluída; as entradas removidas `pages/estudos.html` e `pages/foco.html` não fazem parte do build.
- **Aprovado:** `node --check` nos arquivos JavaScript alterados e `git diff --check`.
- **Não executado:** aplicação da migration `20261029050000_remove_studies.sql` em Supabase. Dados remotos só serão apagados quando ela for revisada e aplicada no projeto correto.
- **Limite:** a migration não consegue remover uma preferência dentro do envelope cifrado misto `user_data.settings`; a normalização a exclui da cópia ativa, mas o original cifrado permanece até limpeza explícita da origem legada.
