# Estrutura de front-end

A raiz `src/` concentra os ativos do frontend Aurora e deve continuar sendo a área de implementação do app web.

## Pastas principais

- `css/`: tokens, base, layout, componentes e estilos por área.
- `fonts/`: fontes variáveis auto-hospedadas e suas licenças.
- `data/`: dados estáticos e referências de conhecimento da aplicação.
- `js/`: lógica principal, rotas, acesso, serviços e módulos de feature.

## Regras

- Preserve a ordem de importação do CSS em `src/css/main.css` para não quebrar a cascata.
- Mantenha módulos puros fora do DOM, com dependências explícitas em argumento.
- Não mova chaves de persistência nem altere contratos de dados sem revisar backups e compatibilidade.
- A composição da UI continua concentrada em `src/js/main.js` até que uma feature seja extraída com segurança.
