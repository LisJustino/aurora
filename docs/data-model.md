# Modelo de dados e compatibilidade

## Persistência

O estado é mantido em `localStorage`, uma chave por fatia:

```text
aurora.app.tasks
aurora.app.subjects
aurora.app.sessions
aurora.app.timer
aurora.app.settings
aurora.app.water
aurora.app.gym
aurora.app.finance
aurora.app.cycle
aurora.app.cycleLog
aurora.app.weight
```

Cada valor armazenado tem o envelope `{ "v": <estado>, "t": <timestamp> }`. A inicialização em `main.js` aplica `normalizeSlice`; configurações usam `normalizeSettings`. O módulo de baixo nível em `src/js/services/storage.js` apenas serializa JSON. Há ainda resumos locais com prefixo `aurora.brief.*`.

## Forma dos dados do domínio

- Tarefas: `id`, título, concluído, lista, data, prioridade e campos opcionais (repetição, etiquetas, notas, subtarefas e `focusSeconds`, total de segundos de foco concluídos nessa tarefa).
- Estudos: matérias, sessões concluídas e cronômetro ativo; vínculos de matéria usam IDs e nomes persistidos.
- Pomodoro: `aurora.app.pomodoro` pode guardar `focusTaskId` enquanto um ciclo está associado a uma tarefa; pausas não entram em `focusSeconds`. Os segundos são acumulados na tarefa ao concluir o Pomodoro.
- Perfil/configuração: `profile.name` e `profile.sex` (código legado para identidade de gênero), áreas habilitadas, aparência, categorias, listas, preferências e indicador local `onboardingComplete`. A configuração inicial exige nome e uma opção de identidade (`f`, `m`, `nb`, `o` ou `n`); `n` permite preferir não informar. O código `sex` e os valores históricos são mantidos por compatibilidade com armazenamento e backups locais.
- Áreas de tarefas começam com `Pessoal`; `Estudos` é uma área opcional de Foco, não uma lista de tarefas. Ao carregar configurações antigas, a opção de tarefa chamada `Estudos` sai da configuração, mas os registros já marcados com esse nome continuam intactos e filtráveis em Planejar como itens antigos.
- Finanças: `accounts`, `tx`, `budgets`, `goals` e `recurring`. Valores financeiros são inteiros em centavos (`initialCents`, `cents`, `limitCents`, `targetCents`, `savedCents`). Lançamentos relacionam contas por IDs e podem usar `groupId`/`recId`; transferências usam `toAccountId`.
- Hábitos: `id`, `name`, `days`, `completions` e `status`; `skipped` guarda datas puladas explicitamente, `pausedFrom` marca o início da pausa ativa e `pausedDays` preserva os dias da semana que estavam programados quando ela começou. Os campos são opcionais para compatibilidade com registros anteriores. Dias pulados e datas cobertas por uma pausa não entram nas taxas e não interrompem as sequências.
- Configurações: `prefs.weeklyReflection` guarda a reflexão opcional mais recente como `{ weekOf, text }`; o texto é limitado a 500 caracteres e segue no backup existente. `prefs.trash` guarda exclusões recuperáveis por até 30 dias, também dentro do backup existente; após o prazo, os registros são removidos automaticamente.
- Lixeira: cada item contém a data de exclusão, um rótulo e os registros originais com suas posições. Abrange tarefas e planos, hábitos, matérias e sessões, hidratação, registros diários do ciclo, objetivos/orçamentos e lançamentos/contas/fixas financeiras. Exclusões em cascata de contas e séries guardam juntos os registros associados. A restauração evita sobrescrever IDs ou chaves já existentes e exige que as contas referenciadas estejam disponíveis.
- Academia, Água e Ciclo: registros locais por dia; o ciclo tem registros estruturados e notas por data. Em `cycleLog`, `sexualActivity` (booleano) e `contraceptionMethods` (lista opcional de métodos) registram atividade sexual e métodos selecionados; se não houver atividade, esses campos não são gravados. Como os demais dados do ciclo, ficam no dispositivo e podem ser incluídos nos backups locais.

O objeto de cada feature e os campos opcionais são definidos pelos produtores em `main.js` e pelas normalizações atuais; não há migração geral de esquema. Entradas ausentes recebem defaults. Ao carregar, coleções e campos usados pela interface passam por validação estrutural; registros incompatíveis são omitidos apenas da cópia em memória, a fatia original permanece no `localStorage` e fica bloqueada para gravação. Ajustes permite baixar o conteúdo bruto bloqueado como cópia de recuperação e importar um backup compatível para substituição explícita.

## Backup

O backup JSON usa `app: "aurora"` e versões aceitas 1 e 2. `parseBackup` valida o envelope e os registros antes da confirmação de restauração; se detectar registros malformados, rejeita o arquivo inteiro, sem importar parcialmente. IDs existentes são preservados quando válidos/únicos; IDs duplicados ou inválidos são regenerados pela lógica de importação. Restaurar substitui explicitamente as fatias; não é sincronização ou merge automático.

Se houver dados locais bloqueados, o backup normal fica desativado para evitar produzir um arquivo que aparente conter todos os dados enquanto omite registros inválidos. A cópia de recuperação em Ajustes contém os valores brutos das chaves bloqueadas e não é um backup diretamente importável; mantenha-a junto de um backup Aurora válido antes de recuperar ou substituir dados.

### Exceção opcional: Push do Pomodoro

A inscrição é separada das fatias `aurora.app.*`: `aurora.push.pomodoro` guarda apenas o identificador aleatório da instalação, sua credencial-capacidade e o indicador local de ativação. Esse valor não é incluído nos backups nem enviado a outra instalação. Não há migração das chaves existentes.

Se a pessoa ativar avisos, a Durable Object correspondente à instalação guarda o hash dessa credencial, a inscrição Push exigida pelo navegador e uma programação limitada à fase, horário previsto da próxima transição, durações de foco/pausa e quantidade de blocos concluídos. Os bindings de limite de taxa do Cloudflare controlam novos registros e chamadas autenticadas sem armazenar contadores adicionais no objeto. O nome da tarefa, o rótulo de foco, o histórico e qualquer outra fatia permanecem locais. A programação avança uma fase por alarme enquanto o timer independente estiver rodando. Pausar, concluir, descartar ou desativar os avisos cancela o alarme; a inscrição pode ser removida ao desativar.

## Regras de preservação

- Não renomeie ou remova chaves, IDs, `accountId`, `toAccountId`, `groupId`, `recId` ou vínculos de estudos sem plano de compatibilidade.
- Não converta valores financeiros persistidos: os lançamentos existentes já usam centavos inteiros.
- Não limpe o armazenamento para testes. Use um perfil de navegador isolado e identificado.
- Se o JSON de uma fatia principal não puder ser lido, não sobrescreva essa chave automaticamente; faça backup/recuperação explícita.
- Não use `localStorage.clear()` em validação nem misture dados de produção com dados de teste.
