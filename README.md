# Aurora

App web para organizar a rotina num lugar só: tarefas, hábitos, finanças e ciclo menstrual. Funciona no celular como PWA, em português, e o site público fica em [aurora-rotinas.com.br](https://aurora-rotinas.com.br).

## O que tem

- **Início**: o resumo do dia, com tarefas, hábitos, água e o que vence na semana. Os blocos podem ser reordenados.
- **Planejar**: tarefas (inclusive várias de uma vez), eventos do Google Agenda, revisão semanal e plano anual com balanço no fim do ano.
- **Hábitos**: três abas (Hoje, Histórico e Gerenciar). Hoje tem a marcação diária e a água; Histórico, o calendário mensal e anual de cada hábito e a análise dos últimos 28 dias; Gerenciar, edição, pausa, ordem e criação em lote. Um botão abre a janela para registrar outro dia, marcando vários hábitos de uma vez.
- **Finanças**: contas, cartões e faturas, lançamentos (inclusive em lote), orçamentos, metas, parcelas e relatórios do mês.
- **Ciclo**: calendário, previsão em faixa, padrões e registros diários, com modo discreto. A área só aparece para perfis elegíveis.
- **Ajustes**: perfil e foto, aparência, preferências, backup e exportação dos dados, lixeira e exclusão da conta.
- **Demonstração**: dá para experimentar o app em `/demonstracao`, sem criar conta, com dados de exemplo.

## Como é feito

- JavaScript puro com módulos ES, sem framework. O HTML das telas é montado por funções em `src/js`.
- [Vite](https://vite.dev) para desenvolvimento e build. A landing é pré-renderizada no build.
- [Supabase](https://supabase.com) para login, banco Postgres com políticas de acesso por conta (RLS) e funções de borda (`delete-account`, `google-calendar`, `submit-suggestion`).
- Hospedagem estática no Cloudflare Pages. As regras de cabeçalho e de CSP estão em `_headers`, e os redirecionamentos em `_redirects`.
- PWA com service worker próprio (`service-worker.js`) e página offline.
- O projeto tem dependências do Capacitor, mas as pastas `android` e `ios` não estão no repositório.

## Estrutura

```
src/js/
  main.js          ponto de entrada do app logado
  public-entry.js  landing e demonstração
  account-entry.js login, cadastro e recuperação de senha
  app/             o app, dividido por área (estado, telas, ações, diálogos, Finanças...)
  core/            roteamento e verificação de integridade dos dados
  data/            cliente do Supabase, persistência relacional, importação antiga
  features/        regras e telas de cada área (finance, habits, cycle, planning...)
  services/        autenticação, Google Agenda, PWA
pages/             uma página HTML por rota, para o app abrir direto em cada área
supabase/
  migrations/      esquema do banco, em ordem
  functions/       funções de borda
  tests/           testes de isolamento entre contas (RLS)
scripts/           build, geração de imagens e vídeos dos tutoriais
tests/             testes em Node e testes de navegador (tests/e2e)
```

O estado do app fica em `src/js/app/state.js`. As ações de clique estão registradas em `src/js/app/actions.js`, agrupadas por área nos arquivos `actions-*.js`.

## Rodando

Precisa de Node 24.

```
npm install
npm run hooks:install
npm run dev
```

O `npm run dev` conversa com o projeto Supabase de desenvolvimento. Copie `.env.example` para `.env.local` e preencha `VITE_SUPABASE_LOCAL_URL` e `VITE_SUPABASE_LOCAL_ANON_KEY`. Sem isso o login não carrega, mas a demonstração funciona.

O `hooks:install` ativa o hook de `pre-push`, que roda `npm run build` antes de cada push.

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` | build de produção em `dist/` |
| `npm run preview` | serve o `dist/` |
| `npm run lint` | ESLint em `src/js` |
| `npm run format` | formata `src/js` com o Prettier |
| `npm run format:check` | confere a formatação de `src/js` e dos arquivos de configuração |
| `npm test` | testes em Node (lógica, textos, service worker, Supabase) |
| `npm run test:seo` | confere metadados e arquivos públicos no `dist/` |
| `npm run test:e2e:ci` | testes de navegador com Playwright |
| `npm run test:supabase:concurrency` | escritas simultâneas no banco local |
| `npm run tutorials:generate` | gera os vídeos dos tutoriais |
| `npm run visuals:generate` | gera capturas de tela e imagem de compartilhamento |

Os testes `test:seo` e `test:supabase:concurrency` precisam, respectivamente, do build feito e de um Postgres local na porta 54322. O fluxo completo está em `.github/workflows/tests.yml`.

## Variáveis de ambiente

Usadas no build de produção e de pré-visualização:

- `VITE_SUPABASE_TARGET`: `development` ou `production`.
- `VITE_SUPABASE_PREVIEW_URL` e `VITE_SUPABASE_PREVIEW_ANON_KEY`
- `VITE_SUPABASE_PRODUCTION_URL` e `VITE_SUPABASE_PRODUCTION_ANON_KEY`
- `VITE_GOOGLE_CALENDAR_CLIENT_ID`: client ID do Google para a integração com a Agenda.
- `VITE_PWA_ENABLED`: liga ou desliga o service worker.

O cliente só aceita URLs `https` do projeto Supabase esperado para cada ambiente.

## Banco de dados

As migrations em `supabase/migrations` são aplicadas em ordem de data. Para testar localmente:

```
supabase start
supabase db reset --local
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" --file=supabase/tests/rls_isolation.sql
```

Os dados relacionais ficam protegidos por RLS, de modo que cada conta só enxerga os próprios registros. Não há criptografia de ponta a ponta, e a política de privacidade do app (`privacy.html`) diz isso.

## Estilo do código

O Prettier formata o JavaScript com aspas simples, linhas de até 120 colunas e vírgula final (veja `.prettierrc.json`). Rode `npm run format` antes de commitar. O ESLint cuida de variáveis não declaradas e não usadas.

O HTML das telas fica dentro de template literals, que o Prettier não reformata. Ao quebrar uma linha longa, quebre só entre atributos de uma tag, para não criar espaço novo no layout.

## Commits

As mensagens seguem `tipo(área): verbo no infinitivo`, em minúsculas e em português, por exemplo `fix(finanças): corrigir o fluxo de lançamentos em lote`. Os tipos usados são `feat`, `fix`, `refactor` e `docs`. O arquivo `.gitmessage` traz o modelo; para usá-lo, rode `git config commit.template .gitmessage`.
