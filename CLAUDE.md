# Aurora — instruções do projeto

## Princípios permanentes

- Faça mudanças incrementais e preserve as decisões de produto descritas em `docs/decisions.md`.
- Preserve localStorage, backups, IDs e registros. Não limpe dados nem faça migrações destrutivas.
- Não crie backend, autenticação, sincronização, acesso bancário ou dependências sem solicitação e aprovação explícitas.
- Não reescreva `src/js/main.js` de uma vez. A composição ainda depende de estado e handlers compartilhados.
- Mantenha acessibilidade, responsividade e temas claro/escuro.
- Não publique, sincronize, faça commit ou envie código ao GitHub.
- Não declare testes sem executá-los; consulte `docs/testing.md` para os comandos e limites de validação.

## Arquitetura que existe

- `index.html` é a entrada canônica; `pages/*.html` são entradas leves de rotas da mesma SPA, não telas completas estáticas.
- `src/js/main.js` ainda concentra templates, estado, eventos e inicialização.
- `src/js/core/` contém router; a personalização do perfil é opcional e não bloqueia o uso.
- Regras puras de finanças estão em `src/js/features/finance/calculations.js`.
- `src/js/services/` contém storage JSON e busca local; `src/js/utils/` contém DOM, datas, moeda e IDs.
- `src/css/main.css` importa tokens, base, layout e folhas de componentes/páginas na ordem necessária à cascata.
- A persistência usa `aurora.app.*`, envelope `{v,t}` e backup JSON versões 1 e 2.

Leia `docs/architecture.md` e `docs/data-model.md` antes de mover código ou alterar dados.

## Diretrizes de implementação

- Preserve fronteiras de módulos, navegação, rotas e contratos documentados.
- Mantenha responsividade, temas, semântica, teclado e rótulos acessíveis.
- Preserve chaves, envelopes, backups, IDs e compatibilidade sem migrações destrutivas.
- Use centavos inteiros nos cálculos financeiros.
- Teste os fluxos afetados e registre somente resultados verificados.
