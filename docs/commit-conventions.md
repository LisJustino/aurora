# Mensagens de commit

Use títulos claros, em português, que descrevam a mudança. O formato padrão é:

```text
tipo(escopo): resumo com verbo no infinitivo
```

O escopo é opcional. Mantenha o título em até 72 caracteres, sem ponto final.
Use um corpo após uma linha em branco quando contexto, motivação ou efeitos
importantes não couberem no título. Prefira poucos tópicos objetivos; não repita
uma lista de arquivos alterados.

Tipos:

- `feat`: recurso novo
- `fix`: correção de comportamento
- `refactor`: reorganização sem mudança funcional intencional
- `perf`: melhoria de desempenho
- `test`: criação ou ajuste de testes
- `docs`: documentação
- `build`: build ou dependências
- `ci`: integração e automação
- `style`: formatação sem mudança funcional
- `chore`: manutenção geral
- `revert`: reversão de uma mudança
- `merge`: integração de branches; preserve o número da pull request no título
  ou no corpo quando houver

Exemplos:

```text
feat(financas): permitir filtrar transações por conta

- manter os filtros selecionados ao alternar a página
- cobrir a combinação de conta e período nos testes
```

```text
fix(auth): tratar cadastro com confirmação de e-mail pendente
```

A autoria é definida pelos campos `user.name` e `user.email` do Git, não pelo
texto da mensagem. Ao reescrever mensagens, preserve os metadados de autoria.
