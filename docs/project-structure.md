# Estrutura do projeto

```text
aurora/
├── index.html
├── pages/                     # Entradas de rota da SPA, sem duplicar shell
├── src/
│   ├── css/
│   │   ├── design-system/     # Tokens, botões, campos, seletores e feedback
│   │   ├── base.css
│   │   ├── layout.css
│   │   ├── main.css
│   │   ├── components/        # Componentes e ajustes responsivos
│   │   └── pages/             # Início, Aurora e Finanças
│   ├── data/
│   └── js/
│       ├── main.js            # Composição atual; ainda concentrada
│       ├── core/              # Router e controle de acesso
│       ├── features/finance/  # Cálculos financeiros
│       ├── features/studies/  # Template HTML de Foco/Estudos
│       ├── features/water/    # Template HTML de Água
│       ├── services/          # Persistência e busca local
│       └── utils/             # DOM, ícones, templates HTML, datas, moeda e IDs
├── worker/                     # Cloudflare Worker + Durable Object do Push opcional
│   ├── src/index.js
│   ├── test/
│   └── wrangler.toml
├── docs/
├── CLAUDE.md
└── aurora-legacy.html         # Artefato original preservado como referência
```

As skills pessoais do Aurora ficam em `~/.copilot/skills/`, fora do repositório. O workspace multi-root local as exibe no VS Code sem incluí-las no Git.

## Entradas HTML disponíveis

| Arquivo | Tela inicial |
|---|---|
| `index.html` | Início, entrada canônica |
| `pages/inicio.html` | Início |
| `pages/planejar.html` | Planejar |
| `pages/foco.html` | Foco dentro de Planejar |
| `pages/estudos.html` | Alias de compatibilidade para Foco |
| `pages/financas.html` | Finanças |
| `pages/academia.html` | Academia |
| `pages/agua.html` | Água |
| `pages/ciclo.html` | Ciclo |
| `pages/agente.html` | Assistente Aurora |
| `pages/perfil.html` | Perfil |
| `pages/ajustes.html` | Ajustes (`config`) |

As entradas usam o mesmo `#app`, `main.css` e `main.js`; o metadado `aurora-route` escolhe a tela inicial. São arquivos HTML reais para acesso direto e metadados, não duplicatas das telas estáticas. A estrutura de Foco/Estudos e Água está em fragmentos HTML externos; seus dados e handlers continuam compostos em `main.js`. As demais telas ainda usam templates JavaScript no compositor. `src/js/services/pomodoro-push.js` integra apenas o Pomodoro independente ao serviço opcional configurado em `pomodoro-push-config.js`.

O serviço Cloudflare em `worker/` é implantação independente e não é necessário para executar o Aurora localmente. Consulte [pomodoro-push.md](./pomodoro-push.md) antes de configurar ou publicar o serviço.

## Adicionar uma rota

1. Confirme se é uma página independente ou um modo de uma área já existente. Não crie uma segunda navegação para uma função existente.
2. Para uma rota real, adicione a renderização à tabela `ROUTES` e seus links a todos os pontos de navegação relevantes em `main.js`.
3. Crie uma entrada em `pages/` com `lang="pt-BR"`, viewport, título, descrição, `meta[name="aurora-route"]`, `../src/css/main.css`, `#app` e `../src/js/main.js`.
4. Atualize README/docs e teste entrada direta, hashes, menus móvel/desktop e estado persistido.
5. Até que os templates sejam extraídos, não coloque uma segunda cópia de shell ou lógica de negócio no documento de página.

## Adicionar uma feature

Comece com uma fronteira pequena e independente. Regras puras devem receber entradas por argumento e ficar fora do DOM; registre handlers no ponto de composição existente somente até que seja seguro extrair o fluxo completo. Evite importar o arquivo principal em um módulo de feature. Preserve as chaves `aurora.app.*`, IDs e contratos de backup.
