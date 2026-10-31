# Estrutura do projeto

```text
aurora/
├── index.html                  # Entrada canônica da SPA
├── 404.html                    # fallback estático para rotas não encontradas
├── service-worker.js           # Service worker no escopo da raiz
├── public/
│   └── manifest.webmanifest    # Manifest preservado na raiz do build
├── favicon.svg                 # Cópia compatível do ícone em icons/
├── icons/                      # Ícones usados pelas entradas e pelo manifest
├── pages/                      # Entradas de rota da SPA, sem duplicar shell
├── src/
│   ├── assets/                 # Capturas da landing e logos de bancos
│   ├── css/
│   │   ├── design-system/     # Tokens, botões, campos, seletores e feedback
│   │   ├── base.css
│   │   ├── layout.css
│   │   ├── main.css
│   │   ├── components/        # Componentes e ajustes responsivos
│   │   └── pages/             # Landing, Início e áreas
│   ├── fonts/                  # Fontes locais e licenças
│   └── js/
│       ├── main.js            # Composição atual; ainda concentrada
│       ├── core/              # Router e compatibilidade de rotas
│       ├── features/           # Funcionalidades agrupadas por domínio
│       │   ├── footer/         # Conteúdo compartilhado do footer
│       │   └── selects/        # Combobox acessível compartilhado
│       ├── data/              # Store relacional e importador temporário do legado
│       ├── services/          # Autenticação, Push e busca local
│       └── utils/             # DOM, ícones, templates HTML, datas, moeda e IDs
├── terms.html                  # Termos públicos, fora da SPA autenticada
├── privacy.html                # Política pública, fora da SPA autenticada
├── tests/                      # Testes de lógica, verificações manuais e E2E
├── supabase/                   # Esquema do banco e políticas
│   └── functions/              # Edge Functions, incluindo exclusão autenticada de conta
├── worker/                     # Cloudflare Worker + Durable Object do Push opcional
│   ├── src/index.js
│   ├── test/
│   └── wrangler.toml
├── .github/workflows/          # CI dos testes nativos e do Worker
├── docs/
├── package-lock.json
└── README.md
```

As entradas e o service worker permanecem na raiz do build porque as rotas públicas e o escopo do service worker dependem desses caminhos. O manifest fica em `public/` para o Vite copiá-lo sem hash para a raiz publicada; `start_url` e `scope` são relativos à localização dele. `pages/` contém documentos leves da mesma SPA; não é uma pasta de páginas estáticas independentes.

## Entradas HTML disponíveis

| Arquivo | Tela inicial |
|---|---|
| `index.html` | Landing pública; Início após autenticação |
| `pages/inicio.html` | Início |
| `pages/planejar.html` | Planejar |
| `pages/financas.html` | Finanças |
| `pages/habitos.html` | Hábitos |
| `pages/agua.html` | Compatibilidade: abre Hábitos |
| `pages/ciclo.html` | Ciclo |
| `pages/perfil.html` | Perfil |
| `pages/ajustes.html` | Ajustes (`config`) |
| `pages/pomodoro.html` | Pomodoro |

As entradas usam o mesmo `#app`, `main.css` e `main.js`; o metadado `aurora-route` escolhe a tela inicial. A entrada canônica mostra uma landing pública e uma demonstração interativa com dados fictícios; marcar um hábito, iniciar o timer e concluir uma tarefa alteram somente estado em memória, sem autenticação, rede ou persistência. Criar conta ou entrar libera o acesso protegido, e voltar à demonstração não inicia uma sessão. Novos cadastros entram sem confirmar o e-mail; os projetos Supabase devem ter confirmação de e-mail desativada. O cadastro mostra duas etapas. O app não envia links de confirmação; contas antigas pendentes precisam ser liberadas manualmente no Dashboard do Supabase. Landing, demonstração e gate de conta compartilham cabeçalho com cadastro, login, tema, acessibilidade e atualização. Preferências visuais públicas são temporárias e não alteram os dados privados da conta. As entradas de área continuam protegidas por autenticação. São arquivos HTML reais para acesso direto e metadados, não duplicatas das telas estáticas. `pages/agua.html` e `#agua` são aliases legados para Hábitos. `404.html` é o fallback estático de erro para publicação em hospedagem compatível. Hábitos usa um fragmento HTML externo; as demais telas usam templates JavaScript no compositor. O cartão Primeiros passos usa `settings.prefs.firstStepsDismissed`, salvo em `user_settings.preferences`. O parser puro de prazos de Planejar fica em `src/js/features/planning/quick-entry.js`. A meta de água é independente do nome e persiste em `habits.waterGoalMl`; no modelo relacional, `user_settings.preferences.habitWaterGoals` faz a ponte por ID. O Worker de Push opcional agenda Pomodoro e lembretes genéricos de Hábitos sem receber nomes dos hábitos; a permissão é solicitada apenas após ação explícita. Não há entradas, rotas ou dados de Estudos; a migration `20261029050000_remove_studies.sql` remove os registros antigos do banco. `src/js/services/pomodoro-push.js` integra os dois recursos à inscrição Push compartilhada.

`terms.html` e `privacy.html` são documentos públicos estáticos, não rotas da SPA. No cadastro e no reconsentimento, a caixa de aceite fica no próprio formulário, e os documentos abrem em novas abas para preservar o que já foi preenchido. O aceite registra versões e instante nos metadados da conta. Os controles no footer abrem cada documento no diálogo compartilhado. Uma conta existente com versão antiga precisa aceitar novamente; recusar apresenta o aviso de exclusão permanente e exige digitar `EXCLUIR` antes de chamar a Edge Function `delete-account`. Essa função precisa ser configurada e publicada manualmente pelo responsável; consulte `supabase/README.md`. O FAQ compartilhado permite preparar uma sugestão no aplicativo de e-mail escolhido pela pessoa; o Aurora não envia nem armazena o rascunho. Os documentos informam a responsável e o contato, mas continuam pendentes de revisão jurídica e confirmação da política de retenção e das configurações dos provedores.

O serviço Cloudflare em `worker/` é implantação independente e não é necessário para executar o Aurora localmente. Consulte [pomodoro-push.md](./pomodoro-push.md) antes de configurar ou publicar o serviço.

## Adicionar uma rota

1. Confirme se é uma página independente ou um modo de uma área já existente. Não crie uma segunda navegação para uma função existente.
2. Para uma rota real, adicione a renderização à tabela `ROUTES` e seus links a todos os pontos de navegação relevantes em `main.js`.
3. Crie uma entrada em `pages/` com `lang="pt-BR"`, viewport, título, descrição, `meta[name="aurora-route"]`, `../src/css/main.css`, `#app` e `../src/js/main.js`.
4. Atualize README/docs e teste entrada direta, hashes, menus móvel/desktop e estado persistido.
5. Até que os templates sejam extraídos, não coloque uma segunda cópia de shell ou lógica de negócio no documento de página.

## Adicionar uma feature

Comece com uma fronteira pequena e independente. Regras puras devem receber entradas por argumento e ficar fora do DOM; registre handlers no ponto de composição existente somente até que seja seguro extrair o fluxo completo. Evite importar o arquivo principal em um módulo de feature. Preserve as chaves `aurora.app.*`, IDs e contratos de backup.
