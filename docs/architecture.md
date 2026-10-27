# Arquitetura atual

## Execução e navegação

`index.html` e os documentos em `pages/` são entradas HTML para a mesma aplicação de página única. Cada entrada declara `meta[name="aurora-route"]`; `src/js/main.js` lê esse valor apenas no primeiro carregamento sem hash. Depois disso, navegação e compatibilidade são resolvidas por hash através de `src/js/core/router.js`. A rota `#estudos` (e `pages/estudos.html`) abre Foco dentro de Planejar e permanece no endereço para que recarregar preserve essa visualização; ao voltar ao Planejar, o hash passa a `#planejar`. `#pessoal` redireciona para Início.

O shell, os menus e os modais são compartilhados e renderizados no elemento `#app`. Não há cabeçalho, navegação ou estado duplicado por página. As entradas HTML definem idioma, título, descrição, CSS e módulo de inicialização. O conteúdo dinâmico das telas permanece em `main.js`; as entradas não são templates HTML independentes.

## Responsabilidades existentes

- `src/js/main.js`: composição e inicialização; estado em memória `S`; interface e formulários; despacho de eventos; integração entre áreas.
- `src/js/core/router.js`: canonicalização de rotas, incluindo alias de Estudos.
- `src/js/core/access-control.js`: conjuntos de ações, formulários e mudanças que solicitam configuração local do perfil.
- `src/js/features/finance/calculations.js`: cálculos puros de saldo, totais mensais, categorias e cartão; recebe os dados e dependências explicitamente.
- `src/js/features/studies/` e `src/js/features/water/`: fragmentos HTML das telas Foco/Estudos e Água e módulos finos de carregamento/renderização. `src/js/utils/html-template.js` compartilha a busca HTTP e a substituição validada de slots; estado, cálculos e handlers continuam compostos em `main.js`.
- `src/js/services/storage.js`: operações JSON de baixo nível no `localStorage`.
- `src/js/services/pomodoro-push.js`: inscrição opt-in do timer independente e sincronização mínima de fase/horário com a API de Push; o endereço implantado fica em `pomodoro-push-config.js`. Não acessa as fatias locais nem o timer de Estudos.
- `src/js/services/local-search.js`: busca local determinística.
- `src/js/utils/`: DOM e interpolação HTML escapada, ícones SVG (`icons.js`), datas civis locais, valores monetários em centavos e geração de IDs.
- `src/css/design-system/`: tokens (cor, tipografia, espaço, raios, controles) e componentes-base (botões, campos, seletores, selos e estado vazio); regras e critérios em [design-system.md](./design-system.md), referência visual em [design-system.html](./design-system.html).
- `src/css/base.css`, `layout.css`: elementos básicos e estrutura responsiva.
- `src/css/components/` e `src/css/pages/`: estilos de componentes e áreas.
- `src/css/main.css`: ponto único de importação CSS. A ordem conserva a cascata anterior.

## Estado e persistência

`S` é a fonte de verdade em memória. Cada seção é gravada como `{ v, t }` na chave `aurora.app.<slice>`. Os nomes das fatias e suas normalizações estão em `main.js`; detalhes e contratos estão em [data-model.md](./data-model.md). O módulo `storage.js` não conhece o domínio.

Falhas de leitura e gravação das fatias principais são reportadas no console e no status da interface. JSON corrompido bloqueia sobrescrita automática daquela fatia até restauração explícita ou redefinição confirmada, evitando apagar silenciosamente o conteúdo bruto. O único backend opcional é isolado em `worker/`: o Worker Cloudflare valida origem e entradas, enquanto uma Durable Object por instalação mantém a inscrição e a fase/horário necessário para acionar o Push. Nenhuma fatia da aplicação ou dado de tarefa é transmitido.

O service worker raiz exibe Push somente quando não há uma janela do Aurora visível. O app não pede permissão no carregamento; a solicitação acontece no controle explícito da tela do Pomodoro.

## Limites atuais e próximos passos

O HTML de entrada e a composição visual estão separados, mas `main.js` ainda reúne a maioria dos templates, eventos e fluxos das áreas. Foco/Estudos e Água têm fragmentos externos; a composição dos slots, o estado, os cálculos e os handlers permanecem no compositor. O utilitário de templates recebe a URL e o nome da feature explicitamente e não acessa o estado da aplicação. Os utilitários e cálculos financeiros extraídos também são módulos independentes. A separação das páginas ainda não foi concluída: continue extraindo uma feature por vez, mantendo as dependências explícitas e validando no navegador. Não mover estado persistido nem alterar as chaves como parte dessa extração.

A aplicação roda em um workspace convencional com vários arquivos e servidor HTTP estático. Este repositório não contém configuração para empacotar um Claude Artifact monolítico; não é possível inferir ou alterar capacidades internas desse produto a partir do workspace.
