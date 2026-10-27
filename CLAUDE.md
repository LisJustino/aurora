# Aurora — instruções do projeto

## Princípios permanentes

- Faça mudanças incrementais e preserve as decisões de produto descritas em `docs/decisions.md`.
- Preserve localStorage, backups, IDs e registros. Não limpe dados nem faça migrações destrutivas.
- Não crie backend, autenticação, sincronização, acesso bancário ou dependências sem solicitação e aprovação explícitas.
- Não reescreva `src/js/main.js` de uma vez. A composição ainda depende de estado e handlers compartilhados.
- Mantenha acessibilidade, responsividade e temas claro/escuro.
- Não publique, sincronize, faça commit ou envie código ao GitHub.
- Não declare testes sem executá-los; use `docs/testing.md` para registrar limites e resultados.

## Arquitetura que existe

- `index.html` é a entrada canônica; `pages/*.html` são entradas leves de rotas da mesma SPA, não telas completas estáticas.
- `src/js/main.js` ainda concentra templates, estado, eventos e inicialização.
- `src/js/core/` contém router e controle de acesso local.
- Regras puras de finanças estão em `src/js/features/finance/calculations.js`.
- `src/js/services/` contém storage JSON e busca local; `src/js/utils/` contém DOM, datas, moeda e IDs.
- `src/css/main.css` importa tokens, base, layout e folhas de componentes/páginas na ordem necessária à cascata.
- A persistência usa `aurora.app.*`, envelope `{v,t}` e backup JSON versões 1 e 2.

Leia `docs/architecture.md` e `docs/data-model.md` antes de mover código ou alterar dados.

## Skills por tipo de trabalho

- Arquitetura: `~/.copilot/skills/aurora-architecture/SKILL.md`
- Interface e acessibilidade: `~/.copilot/skills/aurora-ui/SKILL.md`
- Integridade de dados: `~/.copilot/skills/aurora-data-integrity/SKILL.md`
- Finanças: `~/.copilot/skills/aurora-finance/SKILL.md`
- Qualidade e validação: `~/.copilot/skills/aurora-quality/SKILL.md`

Skills são instruções pessoais sob demanda, fora do repositório. O workspace multi-root pessoal as exibe no VS Code junto com o projeto; este arquivo mantém apenas regras gerais para agentes que leem `CLAUDE.md`.
