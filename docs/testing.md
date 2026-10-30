# Testes

## Aplicação web

Ao navegar para outra área a partir de Ajustes e retornar pelo histórico ou pelo menu, confirme que “Seu perfil” é selecionado. Recarregue enquanto outra aba de Ajustes estiver aberta e confirme que essa aba permanece selecionada.

No cadastro, valide que erros de e-mail já associado (incluindo a resposta sem sessão com lista de identidades vazia do Supabase) explicam que uma exclusão confirmada permite criar uma conta nova, sem restaurar dados antigos. A exclusão só é considerada concluída com a confirmação explícita da Edge Function, que chama a Admin API em modo de exclusão definitiva; erros desconhecidos mantêm uma mensagem segura e genérica.

Nos campos de e-mail do cadastro, login e recuperação, confira sugestões após `@`, seleção por teclado/toque e a possibilidade de continuar digitando um domínio que não aparece. As sugestões são opcionais e não alteram a validação do e-mail.

Na etapa de perfil do cadastro em mobile, confirme que o texto introdutório redundante fica oculto para aproximar o campo de nascimento do viewport; em desktop, a introdução permanece visível. Confira também a largura do campo em 320 px e o comportamento do teclado/seletor nativo em um dispositivo físico.

### Segurança e fallback

- CSP e headers de segurança são validados em `_headers`; a política inclui `default-src 'self'`, `connect-src` para o Supabase e o Worker de Push, `frame-ancestors 'none'` e `form-action 'self'`.
- O fallback SPA continua em `/index.html` para rotas, mas `/src/*`, `/icons/*` e `/pages/*` devem responder 404 quando o arquivo não existir.
- A persistência relacional usa delta por tabela e bloqueia sobrescrita de linha mais nova com conflito `version_conflict`; a aba recarrega os dados em foco quando não há pendências.
- A migration `20261030100000_relational_version_conflict.sql` precisa ser aplicada depois das migrations relacionais; ela atualiza a RPC para retornar as versões persistidas. As verificações locais não substituem a execução da migration e os testes SQL em um projeto Supabase isolado.

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
node tests/e2e/notifications.cjs http://127.0.0.1:5173
node tests/e2e/home-first-steps.cjs http://127.0.0.1:5173
node tests/e2e/planning-quick-task.cjs http://127.0.0.1:5173
node tests/e2e/public-demo-interactions.cjs http://127.0.0.1:5173
```

O cenário de notificações confirma que lembretes novos não abrem o painel
automaticamente, que o indicador do sino permite encontrá-los e que abrir,
adiar e dispensar continuam funcionando em mobile e desktop.
- **Aprovado (2026-10-29):** `node tests/e2e/notifications.cjs http://127.0.0.1:5173` — fluxo mobile/desktop, sem overflow horizontal nem erros no console.

## Prévia visual local

- **Aprovado:** `node tests/e2e/dialog-mobile.cjs http://127.0.0.1:5173` — o campo recebe foco na abertura em iPhone e desktop, sem deslocar o diálogo.
- **Aprovado:** `node tests/e2e/close-buttons.cjs http://127.0.0.1:5173` — os controles medem 40×40 px e mantêm raio consistente em celular e desktop.
- O antigo `tests/e2e/flows.cjs` foi removido: dependia de persistência legada no navegador e não representava os contratos atuais de conta e dados relacionais.
- `node tests/e2e/home-first-steps.cjs` verifica o cartão, a ausência de abertura automática, o botão “Como usar?” e os dois formatos locais de vídeo.
- `node tests/e2e/planning-quick-task.cjs` verifica a prévia do prazo, confirmação, cancelamento e criação por Enter em 390 px.
- `node tests/e2e/public-demo-interactions.cjs` verifica hábito/tarefa/timer por teclado, zero requisições e zero gravações no navegador, em 390 px e desktop.
- **Aprovado (2026-10-30):** `npm test` — 82/82 testes base, além das verificações de conta, exclusão, sugestões, cofre, persistência relacional e importação; a persistência cobre no-op, delta de linhas, conflito por versão e substituição explícita.
- **Aprovado (2026-10-30):** `npm run build`, `node --check` nos arquivos JavaScript alterados e `git diff --check`.
- **Não executado:** aplicação da migration e concorrência real contra PostgreSQL/Supabase; não há banco local de teste configurado neste ambiente.

## Worker de notificações

O Worker tem dependências e testes separados:

```powershell
npm --prefix worker ci
npm --prefix worker test
```

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
- Para a sugestão “Beber água”, confira que a idade é editável em Ajustes e que o peso é informado no formulário do hábito, atualizando a estimativa sem salvar o peso no perfil ou no histórico. Registre volumes em mL, confira a soma do dia local, a conclusão automática ao atingir a meta e a persistência após recarregar.
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
- **Aprovado (2026-10-29):** Chromium em 390 px — campo de nascimento alinhado à área interna do cartão, sem overflow; os dois documentos aparecem juntos no diálogo, a confirmação fica bloqueada até o final da leitura e o aceite retorna ao formulário; sem erros JavaScript.
- **Aprovado (2026-10-29):** Chromium em 390 px com Supabase simulado — cadastro recebeu uma sessão com `email_confirmed_at` vazio e avançou sem a etapa de confirmação; nenhuma conta ou requisição foi enviada a um projeto remoto e não houve erros JavaScript.
- **Aprovado:** navegador local — etapas de perfil/acesso navegáveis, campos do perfil preservados ao voltar e e-mail mantido ao alternar entre acesso e recuperação; sem overflow horizontal em 390 px e 1366 px.
- **Aprovado:** formulário de cadastro — links dos documentos legais usam os botões do design system e, em viewports móveis estreitos/baixos, o cartão cresce com a página em vez de cortar o formulário com uma rolagem interna; sem overflow horizontal em 390 px e 565 px.
- **Não executado automaticamente:** implantação da Edge Function, exclusão real de conta, limpeza em Worker publicado, CORS/configuração de secrets ou exclusão em cascata no Supabase. Esses cenários exigem projeto isolado e conta/inscrição fictícias; nunca testar em conta real.
- O cadastro/login real e a configuração **Confirm email** nos projetos Supabase não foram testados. O acesso imediato depende de desativar essa opção em cada projeto; não foi criada nem alterada nenhuma conta remota.
- **Aprovado:** navegador local em 390 px — percorrer somente os Termos manteve o aceite bloqueado; percorrer também a Política liberou a caixa e o botão após marcar o aceite; sem overflow horizontal nem erros JavaScript.
- **Aprovado (2026-10-30):** `node tests/e2e/legal-consent-progress.cjs http://127.0.0.1:5174` — progresso “1 de 2 lidos”, botão “Ir ao fim” acionado por Enter, progresso preservado ao reabrir e aceite bloqueado até o fim dos dois documentos em 390 px.
- Login real e envio do cadastro, aceite e reenvio de confirmação não foram testados; a validação do fluxo foi feita localmente sem enviar dados ao Supabase.

## Limites

Os testes locais não comprovam login, políticas RLS, migrations ou gravações no
projeto Supabase remoto. Para validar essas partes, use um ambiente de teste e
os cenários SQL em `supabase/tests/rls_isolation.sql`. Não execute testes
destrutivos em dados reais.

Não inclua chaves privadas, tokens, dados de contas ou backups em testes,
capturas de tela ou logs.

## Footer compartilhado e acesso à conta

- O footer compartilhado aparece na landing, na demonstração, nos formulários de conta, nos erros de configuração e no shell autenticado. No tema escuro, mantém o fundo da página; no fluxo de conta, fica fora do elemento `<main>`.
- Na landing, o footer permite abrir a demonstração fictícia; em todos os contextos, “Voltar ao topo” respeita a preferência por movimento reduzido e não altera a rota.
- **Aprovado:** `npm test` — 56/56 testes base e verificações de conta, cofre, persistência relacional e importação; `npx vite build`; verificações de sintaxe e `git diff --check`. No navegador local, o formulário de login mostrou o footer sem overflow em 375 px e 1366 px, inclusive no tema escuro.
- `.env.local` contém os valores públicos do projeto Supabase local nas variáveis `VITE_SUPABASE_LOCAL_*`; `localhost:5173` voltou a mostrar o formulário de login. O build publicado usa variáveis `VITE_SUPABASE_PRODUCTION_*` e deve apontar para outro projeto. Login real e migrations remotas não foram validados. Se o aviso de configuração reaparecer, reinicie o Vite para reler o arquivo; não compartilhe seus valores.

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
