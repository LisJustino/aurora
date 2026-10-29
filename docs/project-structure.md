# Estrutura do projeto

```text
aurora/
├── index.html                  # Entrada canônica da SPA
├── 404.html                    # fallback estático para rotas não encontradas
├── service-worker.js           # Service worker no escopo da raiz
├── manifest.webmanifest
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
│       │   └── footer/         # Conteúdo compartilhado do footer
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

Os arquivos de entrada, o manifest e o service worker permanecem na raiz porque as rotas públicas e o escopo do service worker dependem desses caminhos. `pages/` contém documentos leves da mesma SPA; não é uma pasta de páginas estáticas independentes.

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

As entradas usam o mesmo `#app`, `main.css` e `main.js`; o metadado `aurora-route` escolhe a tela inicial. A entrada canônica mostra uma landing pública e uma demonstração somente de leitura com dados fictícios; criar conta ou entrar libera o acesso protegido, e voltar à demonstração não inicia uma sessão. Landing, demonstração e gate de conta compartilham cabeçalho com cadastro, login, tema, acessibilidade e atualização. Preferências visuais públicas são temporárias e não alteram os dados privados da conta. As entradas de área continuam protegidas por autenticação. São arquivos HTML reais para acesso direto e metadados, não duplicatas das telas estáticas. `pages/agua.html` e `#agua` são aliases legados para Hábitos. `404.html` é o fallback estático de erro para publicação em hospedagem compatível. Hábitos usa um fragmento HTML externo; as demais telas usam templates JavaScript no compositor. A fatia Água continua compatível com importação e backup e agora registra os volumes do hábito “Beber água”. Não há entradas, rotas ou dados de Estudos; a migration `20261029050000_remove_studies.sql` remove os registros antigos do banco. `src/js/services/pomodoro-push.js` integra apenas o Pomodoro independente ao serviço opcional.

`terms.html` e `privacy.html` são documentos públicos estáticos, não rotas da SPA. O cadastro exige percorrer ambos até o final antes de liberar a caixa e o botão de aceite; o aceite registra versões e instante nos metadados da conta. Os controles no footer e no cadastro abrem os documentos no diálogo compartilhado. Uma conta existente com versão antiga precisa aceitar novamente; recusar apresenta o aviso de exclusão permanente e exige digitar `EXCLUIR` antes de chamar a Edge Function `delete-account`. Essa função precisa ser configurada e publicada manualmente pelo responsável; consulte `supabase/README.md`. O FAQ compartilhado permite preparar uma sugestão no aplicativo de e-mail escolhido pela pessoa; o Aurora não envia nem armazena o rascunho. Os documentos informam a responsável e o contato, mas continuam pendentes de revisão jurídica e confirmação da política de retenção e das configurações dos provedores.

O serviço Cloudflare em `worker/` é implantação independente e não é necessário para executar o Aurora localmente. Consulte [pomodoro-push.md](./pomodoro-push.md) antes de configurar ou publicar o serviço.

## Adicionar uma rota

1. Confirme se é uma página independente ou um modo de uma área já existente. Não crie uma segunda navegação para uma função existente.
2. Para uma rota real, adicione a renderização à tabela `ROUTES` e seus links a todos os pontos de navegação relevantes em `main.js`.
3. Crie uma entrada em `pages/` com `lang="pt-BR"`, viewport, título, descrição, `meta[name="aurora-route"]`, `../src/css/main.css`, `#app` e `../src/js/main.js`.
4. Atualize README/docs e teste entrada direta, hashes, menus móvel/desktop e estado persistido.
5. Até que os templates sejam extraídos, não coloque uma segunda cópia de shell ou lógica de negócio no documento de página.

## Adicionar uma feature

Comece com uma fronteira pequena e independente. Regras puras devem receber entradas por argumento e ficar fora do DOM; registre handlers no ponto de composição existente somente até que seja seguro extrair o fluxo completo. Evite importar o arquivo principal em um módulo de feature. Preserve as chaves `aurora.app.*`, IDs e contratos de backup.
