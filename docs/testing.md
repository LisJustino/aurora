# Validação e testes

## Ambiente atual

O projeto não usa bundler nem dependências npm. Para executar os testes automatizados, inicie um servidor HTTP na raiz do repositório:

```bat
python -m http.server 8765
```

Abra `http://localhost:8765/tests/` no navegador. O runner nativo utiliza módulos JavaScript do navegador e não exige dependências externas.

A validação automatizada cobre utilitários, integridade básica de registros, roteamento e cálculos financeiros. Ela não substitui a validação manual de interface, persistência, backups e interações.

## Verificações para alterações de interface

1. Abra `http://localhost:8765/` e confirme que a aplicação é renderizada sem erros no console.
2. Abra diretamente as entradas em `pages/` e confirme que o metadado direciona para a rota esperada.
3. Teste a navegação por hashes e os menus móvel e desktop.
4. Verifique formulários, modais, foco de teclado, largura móvel e ausência de overflow horizontal.
5. Confira no DevTools Network se há imports CSS ou JavaScript com erro.
6. Recarregue a página e confirme que os dados relevantes continuam disponíveis.
7. Em Ajustes, selecione uma seção e recarregue; a seção selecionada deve continuar aberta.
8. No celular, confira a centralização da navegação com dois e três itens e se uma área ativada aparece no menu mesmo quando estava oculta.
9. Confira a saudação com um nome misto de maiúsculas e minúsculas, a ação inicial do Pomodoro sem rolagem e a exibição dos logotipos financeiros.
10. Confira que mensagens longas do toast quebram linha e podem ser lidas por completo.
11. Em Ciclo, confirme que a seção “Saúde menstrual e sexual” abre expandida e que as orientações sobre relações durante a menstruação ficam visíveis.
12. No registro diário do Ciclo, teste atividade sexual sem método informado, seleção de um ou mais métodos, as opções exclusivas “Nenhum método” e “Prefiro não informar”, desmarcação e persistência após recarregar.

### Fluxo do assistente de perfil — 2026-10-27

- **Correção:** ações internas do assistente (`Continuar`, `Voltar`, escolha de tema/áreas e conclusão) só dispensam a exigência de perfil enquanto o diálogo de onboarding está ativo; as demais ações continuam bloqueadas até concluir o perfil.
- **Aprovado:** testes unitários de controle de acesso cobrem ações do onboarding dentro e fora do fluxo, e confirmam que ações comuns ainda exigem perfil.
- **Aprovado:** em viewport de 390 × 844 px e origem isolada `127.0.0.1:8766`, o onboarding avançou pelos três passos, concluiu com idade e peso vazios e persistiu nome, identidade e conclusão após reload.
- **Aprovado:** em origem nova `127.0.0.1:8767`, tentar criar tarefa antes do perfil abriu o onboarding sem criar tarefa; ao falhar a gravação de `settings`, o diálogo permaneceu aberto, o status indicou alterações pendentes e `onboardingComplete` continuou falso. Após restaurar a gravação, o perfil foi concluído e permaneceu após reload; criar tarefa então abriu o formulário esperado.
- **Aprovado:** runner nativo no navegador — 45/45 testes; `node --check` nos arquivos JavaScript alterados e `git diff --check`.
- **Integridade:** chaves `aurora.app.*`, envelope `{v,t}`, esquema de configurações e formatos de backup não foram alterados.

### Registro sexual no Ciclo — 2026-10-27

- **Aprovado:** runner nativo no navegador — 47/47 testes, incluindo validação de ocorrência, métodos conhecidos, combinações, opções exclusivas e registros legados sem esses campos.
- **Aprovado:** `node --check` para `main.js`, `features/cycle/log.js` e `tests/run.js`; três casos adicionais de validação executados em Node; `git diff --check`.
- **Compatibilidade:** permanecem as chaves `aurora.app.cycleLog`, o envelope `{v,t}` e as versões de backup 1 e 2. Os campos são opcionais, validados também na importação/recuperação e entram nos backups locais existentes.
- **Não executado:** interação visual do formulário e reload por navegador em larguras móvel e desktop; as páginas integradas do navegador não estavam disponíveis para essa validação.
- **Não validado:** iPhone/Safari físico e leitor de tela.

### Revalidação mobile e semântica — 2026-10-27

- **Aprovado:** 32 combinações de rotas (Início, Planejar, Pomodoro, Finanças, Estudos, Hábitos, Ciclo e Ajustes) e larguras de 320, 375, 390 e 430 px; sem overflow horizontal do documento e sem erros de console ou requisições falhas.
- **Aprovado:** no assistente em 390 × 844 px, o diálogo expõe `role="dialog"`, `aria-modal="true"` e título associado; os controles interativos visíveis inspecionados têm nome acessível.
- **Não validado:** sequência de Tab/Shift+Tab, acionamento por teclado, leitor de tela/VoiceOver e comportamento em Safari/iPhone físico. A ferramenta de navegador desta sessão não forneceu entrada real de teclado nem leitor de tela; viewport Chromium é apenas emulação.
- **Relato de VoiceOver:** a pessoa não conseguiu navegar entre as seções de Ajustes. A navegação foi alterada de botões de ação para links reais, cada um com destino de seção, estado `aria-current="page"` e relação `aria-controls`; o manipulador atual mantém a atualização de rota, foco e rolagem horizontal.
- **Aprovado em Chromium emulado (390 × 844 px):** o app expõe quatro links dentro da navegação de Ajustes; ativar Personalização atualiza a seção e a hash, mantém o foco no link selecionado e mantém a relação `aria-controls` resolvida. A suíte do navegador passou em 47/47 testes.
- **Pendente:** validar a navegação corrigida com VoiceOver no iPhone. A emulação não substitui leitor de tela/Safari físico, e não há resultado de VoiceOver real a registrar.

### Teste em Android pela rede local

1. Inicie o servidor na raiz do projeto com `python -m http.server 8765 --bind 0.0.0.0`.
2. Conecte computador e celular à mesma rede Wi-Fi; no Android, abra `http://IP-DO-COMPUTADOR:8765/` no Chrome. O IPv4 do computador aparece em `ipconfig`.
3. Teste navegação, formulários, recarga e persistência. Os dados criados ficam no navegador do celular e não são compartilhados com o computador.
4. Esse teste usa HTTP pela rede e requer o computador e o servidor ligados; ele não valida instalação PWA nem uso offline. Para essas funções é necessária uma origem HTTPS.

### Perfil antes de interagir

1. Em um perfil de navegador isolado, abra a aplicação sem dados locais e confirme que Início aparece sem abrir automaticamente o assistente.
2. Tente uma ação em uma tela ou nos dados de exemplo; confirme que o assistente de perfil abre e que a ação não é executada antes de concluir.
3. Avance pelos passos e conclua; confirme que o assistente fecha, a ação pode ser repetida e o perfil permanece após recarregar.
4. Apague os dados, selecione **Começar do zero** e confirme que o assistente não abre: a aplicação retorna a Início.
5. Em seguida, tente navegar por um controle interativo, editar um campo ou enviar um formulário; confirme que o perfil é exigido antes de qualquer alteração. A navegação entre telas para consulta continua disponível.

#### Resultado — 2026-10-26

- **Aprovado:** o botão da introdução abriu a personalização; os três passos foram concluídos, e a tela inicial permaneceu disponível após recarregar.
- **Aprovado:** pular a personalização fechou o fluxo e a introdução não reapareceu após recarregar.
- **Aprovado:** o aviso de meta de água não interrompe mais o segundo passo quando o peso está vazio ou fora do intervalo válido.
- **Aprovado:** 43/43 testes do runner nativo no navegador; introdução conferida em viewport de 390 × 844 px.

### Plano de hoje e navegação móvel — 2026-10-26

- **Aprovado:** em viewport de 390 px, o estado vazio de “Seu plano hoje” empilha ícone, texto e ação; o texto recebeu 277 px de largura, em vez de ficar espremido entre ícone e botão.
- **Aprovado:** navegação inferior móvel usa largura adequada e os rótulos “início” e “planejar” têm espaço de sobra; sem overflow horizontal (390 px de viewport, 375 px de conteúdo emulado).
- **Aprovado:** em 320, 360, 430, 900 e 1280 px, não houve overflow horizontal; o estado vazio manteve a apresentação horizontal no desktop.
- **Limitação:** a conferência foi em navegador integrado/emulado, não em aparelho Android físico nem com leitor de tela.

### Foco do menu de Ajustes no celular — 2026-10-26

- **Aprovado:** ao selecionar Dados e backup em viewport móvel, a seção Backup é renderizada, seu botão recebe foco e permanece visível na faixa horizontal; o hash preserva `section=data`.
- **Aprovado:** voltar a Ajustes pelo hash mantém a seção selecionada.
- **Limitação:** conferência feita no navegador integrado/emulado, não em aparelho físico nem com leitor de tela.

### Resultado — 2026-10-26

- 41/41 testes automatizados nativos aprovados em `tests/`.
- Em origem HTTP isolada, a seção de Ajustes permaneceu selecionada após reload; o nome `LiS Júlia` manteve a capitalização na prévia e na Home.
- Na largura móvel de 390 px, a navegação com dois e três itens ficou centralizada; ativar Estudos com o item oculto o adicionou ao menu sem criar um botão “Mais”.
- O botão do Pomodoro ficou visível sem rolagem na tela de 390 × 844 px; um logotipo Nubank carregou como SVG.
- Mensagem sintética longa do toast quebrou linhas e permaneceu rolável; mensagens curtas mantiveram largura compacta.
- Não foram testados aparelho físico, leitor de tela nem todos os logotipos bancários. Os fluxos Playwright externos não foram executados porque o pacote não está instalado neste ambiente.

## Estudos / Foco

- Abra `pages/estudos.html` diretamente e acesse `#estudos` a partir de `index.html`; confirme que o alias continua levando a Foco dentro de Planejar.
- Confirme o estado de área desativada e ative Estudos sem apagar sessões existentes.
- Cadastre uma matéria, inicie, pause e conclua uma sessão; recarregue e confirme a persistência da matéria, da sessão e do histórico.
- Registre uma sessão manual, edite e exclua uma sessão; confirme que o histórico e a meta diária refletem as alterações.
- Verifique na rede o carregamento de `src/js/features/studies/template.html`.
- Inicie um Pomodoro com durações curtas de teste; confira o progresso circular, a mudança para pausa, a notificação com ação de pausar, o som ao mudar de fase e o comportamento contínuo, sem pausa automática.
- No Safari do iPhone, confira o som com a página aberta e após voltar do segundo plano. O iOS pode suspender páginas e áudio quando o app fica em segundo plano ou a tela bloqueia; som nesse estado não é garantido por uma página web.

### Push opcional do Pomodoro

- Execute `npm test` dentro de `worker/`; isso usa mocks locais, sem credenciais Cloudflare ou envio a um Push Service.
- Em perfil/origem isolados, confirme que a tela explica quando a API ainda não foi configurada, não pede permissão no carregamento e mantém o timer utilizável sem Push.
- Depois da implantação, toque em **Ativar avisos** para conferir permissão e inscrição; teste iniciar, pausar, pular pausa, concluir, descartar, reabrir o app e desativar. Confira no painel Cloudflare que cada alarme corresponde apenas à fase/horário previsto.
- Teste um push com a aplicação visível (sem notificação do sistema duplicada) e oculta/fechada (notificação do sistema). Confirme ainda CORS da origem permitida e rejeição de outra origem.
- No iPhone, instale pelo Safari em **Adicionar à Tela de Início**, abra pelo ícone e repita o fluxo com iOS/iPadOS 16.4 ou posterior. Permissão e som precisam de conferência física.

### Retomada de áudio do Pomodoro — 2026-10-27

- **Aprovado:** `node --check` em `src/js/main.js`, `src/js/features/studies/pomodoro-audio.js` e `tests/run.js`; 45/45 testes passaram em `http://localhost:8765/tests/`.
- **Aprovado:** a retomada do contexto de áudio é tentada para estados diferentes de `running`, incluindo `interrupted`, usado pelo Safari no iOS.
- **Não executado:** teste de som em iPhone/Safari físico.
- **Limitação:** o iOS pode suspender a página e o áudio em segundo plano ou com a tela bloqueada; a aplicação web não garante um alarme nesse estado.
- Abra e feche a central de notificações pelo sino em desktop e celular; confira estado vazio, contador, concluir, adiar e dispensar lembretes, além do fechamento pelo botão e pela tecla Escape.

### Registro histórico de Estudos — 2026-10-16

Uma validação anterior em servidor HTTP local e origem isolada registrou:

- Entrada direta por `pages/estudos.html` e acesso por `index.html#estudos`.
- Ativação da área, cadastro de matéria, registro manual e sessão pelo cronômetro.
- Matéria e sessões preservadas no `localStorage` após recarregar; histórico e meta renderizados corretamente.
- Correspondência dos 22 slots do template com a composição JavaScript, sem erros de página.
- `git diff --check` sem erros; foram observados avisos de conversão LF/CRLF.

Os dados usados ficaram restritos à origem isolada de teste. Esse registro é histórico e não substitui a execução dos cenários após novas alterações.

## Testes automatizados

Execute os testes em `http://localhost:8765/tests/` e confira o resumo e o resultado individual de cada caso.

### Menu “Mais” — 2026-10-26

- **Aprovado:** `node --check src/js/main.js`.
- **Aprovado:** 43/43 testes em `http://localhost:8765/tests/`.
- **Aprovado:** em 1366 px, o painel ficou opaco, “Criar novo” destacado dentro do bloco e o menu fechou ao clicar fora.
- **Aprovado:** em 390 px, o scrim continuou visível e o menu fechou ao tocar fora; sem erros de página.
- **Limitação:** a verificação foi feita em navegador integrado/emulado, não em aparelho físico nem com leitor de tela.

### Revalidação final — 2026-10-26

- **Aprovado:** `node --check` em `src/js/main.js`, `src/js/features/habits/model.js`, `src/js/features/planning/week.js`, `src/js/features/finance/calculations.js`, `src/js/features/trash/model.js` e `tests/run.js`.
- **Aprovado:** 43/43 verificações do runner nativo; executadas em Node com um adaptador mínimo para a saída DOM, para validar as regras puras sem depender do navegador.
- **Aprovado:** `index.html#habitos` carregou no navegador integrado e expôs o onboarding, a navegação e o estado opcional da área.
- **Aprovado:** no fluxo por teclado, Tab focou primeiro o link “Pular para o conteúdo principal” e Enter moveu o foco para o `<main>`.
- **Aprovado:** em origem local isolada, uma tarefa foi excluída, permaneceu na lixeira após recarregar e foi restaurada; a conta financeira de teste e seu lançamento associado também foram movidos juntos e restaurados.
- **Limitação:** o navegador integrado não carregou as páginas em `tests/`, embora o servidor HTTP local respondesse 200 aos arquivos. As verificações do runner desta rodada foram executadas em Node, não no navegador.
- **Não executado:** `git diff --check`, pois o diretório de trabalho informado não é um repositório Git.
- **Não executado:** aparelho iPhone real, teclado físico e leitor de tela. Os fluxos Playwright externos seguem indisponíveis porque o pacote não está instalado neste ambiente.

### Execução anterior pelo navegador — 2026-10-26

**41/41 testes aprovados** em `http://localhost:8876/tests/`, servido localmente em origem isolada. A rodada incluiu filtros para contas fixas pendentes com vencimento hoje, sequência/meta de hábitos com dia pulado, neutralidade da pausa ativa e revisão semanal. Nenhum armazenamento de perfil existente foi usado.

Os scripts em `tests/e2e/` não foram executados: o pacote `playwright` não está instalado neste ambiente. A validação em iPhone físico, gravação de tela e teste com leitor de tela também não foram executados; emulação e testes automatizados não substituem esses cenários.

### Resultado registrado — 2026-10-16

**13/13 testes aprovados.**

1. Reconhece objetos simples e rejeita formatos incompatíveis.
2. Aceita objetos sem protótipo e rejeita instâncias de classes nativas.
3. Filtra registros inválidos e informa a quantidade preservada.
4. Preserva referências válidas e conta todos os registros rejeitados.
5. Converte valores monetários brasileiros para centavos exatos.
6. Rejeita valores monetários inválidos ou fora do intervalo seguro.
7. Aceita sinais, espaços e decimais válidos em valores monetários.
8. Valida datas civis, incluindo anos bissextos.
9. Rejeita datas com formato incorreto ou dias inexistentes.
10. Mantém os aliases e limita rotas desconhecidas a Início.
11. Calcula saldos em centavos e exclui cartão do saldo líquido.
12. Ignora lançamentos pendentes no saldo das contas.
13. Resume o mês distinguindo transferências e compras no cartão.

O resultado se refere aos casos implementados no runner; não comprova a ausência de falhas em todos os módulos ou fluxos da aplicação.

## Integridade de dados e backups

**Importante:** execute os testes destrutivos somente em uma origem e perfil de navegador isolados. Não use os dados reais da aplicação.

- Abra `/tests/` por HTTP e confirme que todos os testes automatizados aparecem como aprovados.
- Em uma origem isolada, injete uma fatia com registros malformados e confirme que a aplicação inicializa, identifica a fatia afetada e preserva o valor bruto sem sobrescrevê-lo.
- Em Ajustes, baixe a cópia de recuperação e confira se contém os valores brutos bloqueados. Essa cópia não deve ser tratada como backup importável.
- Tente importar backups válidos das versões 1 e 2 e confirme a substituição explícita dos dados.
- Tente importar um backup com registros inválidos e confirme que ele é rejeitado integralmente antes da confirmação.
- Após uma restauração válida, recarregue a aplicação e confirme que a fatia voltou a ser gravável e que os dados esperados persistiram.
- Verifique o comportamento quando uma gravação no armazenamento falha durante a restauração. Confirme se a aplicação comunica a falha sem informar sucesso indevidamente.
- Teste dados ausentes, JSON inválido, formatos incompatíveis e backups acima do limite permitido.
- Não execute `tests/integrity-check.html` no perfil real: esse teste modifica chaves do `localStorage`. Use somente a origem isolada prevista para a validação.

## Verificações para Dados e Finanças

Utilize um perfil de navegador ou uma origem isolada, sem apagar o perfil existente.

- Digite `0,10`, `1.234,56` e `10.000,00`; confira os centavos e a formatação.
- Confirme que valores vazios, negativos em campos que exigem valores positivos e separadores ambíguos são tratados corretamente.
- Registre uma receita e uma despesa; compare receita, despesa, resultado e saldo com a soma manual em centavos.
- Edite e exclua um lançamento; confirme que os totais não duplicam e são recalculados.
- Teste transferências e compras no cartão separadamente; não contabilize transferências como receita ou despesa.
- Teste filtros por mês, tipo, conta, categoria e busca, inclusive na virada de mês e ano.
- Recarregue a aplicação e confirme a persistência dos lançamentos.
- Gere um backup antes de testar a restauração.
- Teste faturas válidas, pagamentos parciais e tentativas de pagamento acima do valor em aberto.
- Confira saldos com lançamentos pagos e pendentes, além de contas bancárias, dinheiro e cartão de crédito.

## Registrar resultados

Para cada rodada de validação, registre a data, o ambiente, os comandos executados, os cenários testados e seus resultados.

Diferencie explicitamente:

- **Aprovado:** cenário efetivamente executado e validado.
- **Falhou:** cenário executado com resultado diferente do esperado.
- **Não executado:** cenário ainda não validado.
- **Limitação conhecida:** comportamento ou cobertura que ainda exige implementação ou investigação.

Um servidor HTTP respondendo não comprova que JavaScript, armazenamento, acessibilidade ou interações funcionaram.

## Comandos de validação

Execute na raiz do repositório, pelo CMD integrado do VS Code:

```bat
git diff --check
node --check tests\run.js
git status --short --untracked-files=all
```

Depois, execute os testes pelo navegador em `http://localhost:8765/tests/`.

Antes de concluir uma fase, revise as alterações com `git diff`, confirme que os arquivos não relacionados ao trabalho foram preservados e registre o que ficou pendente. Não faça commit, push, merge ou exclusão de arquivos sem autorização explícita.

### Registro de validação — 2026-10-24

Executado em servidor HTTP local (`python -m http.server`) com Chromium automatizado:

- `tests/index.html`: 34 de 34 testes passaram, incluindo os novos de recorrência de tarefas, modelo de hábitos (meta semanal, sequências, sugestões), Pomodoro (pausa longa configurável, histórico de blocos) e paletas de cor (contraste).
- `tests/integrity-check.html`: 6 de 6 verificações passaram. O teste passou a abrir `#config?section=data`, onde ficam a cópia de recuperação e a importação de backup.
- Navegação por todas as rotas em 390 px e 1280 px sem erros de console e sem rolagem horizontal, com dados de exemplo e todas as áreas ativas.
- Verificado manualmente por script: seção Ajustes > Personalização (início da semana salvo), menu Tema e acessibilidade no cabeçalho, lembrete de backup (aparece com 14 dias ou mais e some em "Agora não"), criação e edição de hábito com meta semanal, pausa longa personalizada e histórico de 7 dias do Pomodoro.
- Não validado: notificações sonoras do Pomodoro, instalação do PWA e o comportamento em Safari/Firefox.

### Registro de validação — 2026-10-24 (redesenho de Hábitos)

Executado em servidor HTTP local com Chromium automatizado:

- `tests/index.html`: 37 de 37 testes passaram (3 novos: validação de `icon`/`color` opcionais, padrões seguros de exibição e catálogo de ideias).
- `tests/integrity-check.html`: 6 de 6 verificações passaram.
- Verificado por script em 390 px e 1280 px, sem erros de console e sem rolagem horizontal: marcar o hábito com um toque (círculo), abrir os detalhes da linha, editar um hábito trocando ícone e cor (gravados no armazenamento), abrir uma ideia de hábito com nome, ícone e cor preenchidos.
- Não validado: leitor de tela real, navegação completa por teclado no seletor de ícones, Safari/Firefox, e as ações dentro de "Fora de hoje" e de "Arquivados" (a tela carregou sem erro com hábitos pausados e de outro dia, mas não cliquei nessas linhas).

### Registro de validação — 2026-10-24 (design system)

Executado em servidor HTTP local com Chromium automatizado:

- `tests/index.html`: 37 de 37 testes passaram. `tests/integrity-check.html`: 6 de 6.
- `tests/design-system-check.html` (novo): 19 de 19 verificações passaram (sem tamanhos de fonte, raios, alturas ou brancos soltos; todo `var(--token)` existe; escala completa). Provei que o teste falha: com cinco violações injetadas ele reprovou as cinco, e voltou a passar ao removê-las.
- Comparação de capturas, antes e depois, de 7 telas, 2 larguras (390 e 1280 px) e 2 temas, mais 13 estados extras (diálogos de tarefa, busca, hábito, lançamento e ciclo, abas de Finanças e seções de Ajustes): sem erros de console, sem rolagem horizontal. A mudança de tokens e a mudança de botões, campos e seletores ficaram idênticas ao pixel, exceto Finanças (botões de 38 px foram para 40 px). A troca de valores soltos por tokens moveu elementos em poucos pixels (a página mais afetada, Finanças no celular, cresceu 14 px de 3.527) e conferi lado a lado Planejar, Finanças e os diálogos de hábito e de lançamento.
- `docs/design-system.html` carregou nos temas claro e escuro, em 390 e 1100 px, sem erro e sem rolagem horizontal.
- Não validado: leitor de tela, Safari/Firefox, e estados que as capturas não alcançam (hover, foco por teclado, toasts, diálogos de importação/exclusão e o onboarding).
- Avisos (toasts) movidos para o topo e ampliados: conferidos por captura (390 e 1280 px, temas claro e escuro) com o aviso de "Desfazer" ao arquivar um hábito. Os tipos sucesso, atenção e erro usam o mesmo componente e só foram vistos pelo estilo, não um a um.
- Tema no celular (390 px, toque simulado): o seletor Automático/Claro/Escuro agora também está no topo de Ajustes > Personalização; trocar para Escuro aplicou o tema, manteve após recarregar, e o painel do cabeçalho continuou funcionando. Avisos descem para o rodapé enquanto o painel de tema, as notificações ou o menu "mais" estão abertos. Não testado em iPhone real.
- Cabeçalho: o botão "+" (criar novo) foi trocado por um botão de tema de um toque (Automático → Claro → Escuro). Conferido a 390 px (toque simulado) e 1280 px: alternância na ordem esperada, tema mantido após recarregar, sem rolagem horizontal. O menu de criação rápida ficou sem ponto de entrada no cabeçalho; as ações "Nova tarefa", "Novo hábito" e "Novo lançamento" continuam nas telas.


### Registro de validação — 2026-10-25 (hábitos avançados, painel do dia, Pomodoro, Finanças, contraste, offline)

Executado em servidor HTTP local com Chromium automatizado:

- `tests/index.html`: 37 de 37. `tests/integrity-check.html`: 6 de 6. `tests/design-system-check.html`: 19 de 19.
- `tests/contrast-check.html` (novo): 14 paletas × claro/escuro × normal/alto contraste × 11 pares de tokens (texto, texto secundário, destaque, selos de sucesso/aviso/erro, botão primário, foco) atendem ao mínimo WCAG AA (4,5:1 para texto, 3:1 para o anel de foco). A página usa o CSS real e normaliza as cores pelo canvas (o navegador devolve `color-mix` em `color(srgb …)`).
- `tests/e2e/flows.cjs` (novo, não é dependência do projeto): 16 de 16 em 390 e 1280 px. Marcar um dia passado, desfazer, reordenar hábitos, rótulo do Pomodoro, botão de tema, atalho N e abertura offline; sem erros de console.
- Hábitos: pontinhos da semana e células do mês viraram botões (marcam dias passados; futuros e não programados ficam desabilitados); setas subir/descer mudam a ordem do array `S.habits`; calendário anual (53 semanas) dentro dos detalhes. Corrigida uma rolagem horizontal de 783 px a 390 px causada por `min-width` dos itens da grade.
- Início: o texto de abertura agora também diz quantos hábitos faltam hoje.
- Pomodoro: campo opcional "Em que você vai focar?" (`focusLabel` em `aurora.app.pomodoro`, até 40 caracteres, não altera `S.sessions` nem o histórico de Estudos, D-002). Salva ao sair do campo e sobrevive a recarregar.
- Finanças: exportar CSV e comparar meses já existiam; foi adicionado o card "Lançamentos fixos" no Resumo (quantidade e total mensal, com botão Gerenciar).
- PWA/offline: o service worker guarda no cache cada arquivo visitado (rede primeiro), então os novos arquivos entram sozinhos. Com Chromium: registro do worker ok, 57 arquivos em cache depois de visitar 5 rotas, recarregar sem rede abriu o app e a navegação por hash continuou.
- Refatoração: ícones saíram de `main.js` para `src/js/utils/icons.js`; `cards.css` foi para `design-system/` (mesma posição na cascata); `--shadow-hover` virou token.
- Não validado: iPhone real, leitor de tela, Safari/Firefox, instalação do PWA, som do Pomodoro, o calendário anual com um ano completo de dados reais, ordem de foco dentro de todos os diálogos. A migração do `visual-refresh.css` (1.384 linhas) ficou **parcial**: só os cartões foram movidos; o restante continua como camada de visual e segue pendente.

### Registro de validação — 2026-10-25 (melhorias visuais de usabilidade)

Executado em servidor HTTP local com Chromium automatizado:

- `tests/index.html`: 37 de 37. `tests/integrity-check.html`: 6 de 6. `tests/design-system-check.html`: 19 de 19. `tests/contrast-check.html`: 0 falhas. `tests/e2e/flows.cjs`: todos os fluxos passam (agora com o erro de formulário no campo).
- Varredura de 7 rotas × 390 e 1280 px × claro e escuro (28 telas): sem erros de console e sem rolagem horizontal.
- Medição de alvos de toque a 390 px em todas as rotas, com os `<details>` abertos: antes havia botões de 34–38 px em Planejar e Hábitos (corrigidos para 40–44 px); restam só o seletor de conta de Finanças (círculo de 36 px) e um link de texto, ambos com a área clicável ampliada por um pseudo-elemento (`touch.css`). A medição olha o tamanho desenhado, não a área ampliada.
- Verificado por script: erro de formulário junto ao campo (nome do hábito vazio e valor do lançamento), com foco, `aria-invalid` e remoção ao digitar.
- Verificado por captura (390 px, claro e escuro): Início, Hábitos e Finanças. Seções de Finanças em uma só fileira rolável.
- Não validado: iPhone real (teclado aberto, barra do Safari), leitor de tela, animação de conclusão vista em movimento (só confirmei que a classe é aplicada), hover e foco por teclado nas telas alteradas.

- 2026-10-25 (menu "Mais"): o painel do menu ficou opaco e atrás dele entra um fundo escurecido e desfocado (`.nav-scrim`, só abaixo de 900 px); toque fora e Esc fecham. Conferido por captura a 390 px em claro e escuro. O cabeçalho no topo continua sem escurecer. Não testado em iPhone real.

- 2026-10-25 (diálogos no celular): ao abrir um diálogo com campo de texto em tela de toque, o foco vai para o próprio diálogo (o teclado só abre ao tocar no campo); no desktop o foco automático continua. Diálogos com campos ficam presos ao topo no celular (posição 12 px antes e depois de focar o campo, medido). A animação de entrada roda só na abertura (`.is-opening`), não a cada atualização do diálogo. Avisos de sucesso/informação sem "Desfazer" somem quando um diálogo abre, porque cobriam o título. Conferido com o iPhone 13 emulado (`tests/e2e/dialog-mobile.cjs`). Não testado: teclado real do iOS, que redimensiona a janela visível; só medi o diálogo sem teclado.

- 2026-10-25 (diálogo com teclado, 2ª correção): `fitDlg` deixou de usar `visualViewport.offsetLeft`/largura e de ouvir o evento `scroll` do `visualViewport` (no iOS isso fazia o painel andar para os lados e acompanhar a animação do teclado). Sem teclado a camada usa `inset: 0`; com teclado (janela visível mais de 120 px menor que a janela), só topo e altura seguem a área visível, com atraso de 90 ms para agrupar os eventos. Conferido só em Chromium emulado (iPhone 14, janela reduzida para simular o teclado). **Não validado em iPhone real**, que foi onde o problema apareceu.

- 2026-10-25 (rolagem dos diálogos): o diálogo "O que você quer criar?" tinha `width: min(100% - 32px, 560px)` aplicada ao corpo (sobra de quando a classe estava no painel), o que deixava a lista 33 px mais estreita que o rodapé; agora `width: auto`. O corpo dos diálogos perde o `env(safe-area-*)` horizontal (a camada externa já o respeita) e ganha uma borda suave acima do rodapé em vez do corte seco, barra de rolagem fina e rodapé sem o espaço dobrado da área segura. No celular, o foco ao abrir vai sempre para o diálogo, o que tira o anel grande do botão "X". Conferido por captura em iPhone 14 emulado; não validado em iPhone real.

### Remoção da integração remota — 2026-10-26

- `tests/index.html`: 41 de 41 testes passaram.
- Em `http://localhost:8765/#config?section=data`, Ajustes mostra somente perfil, personalização, áreas/navegação e Dados e backup. Exportação e restauração continuam visíveis, com aviso de que os dados ficam apenas neste navegador.
- Após recarregar a tela, não houve erros de JavaScript nem requisições para `/api/`.
- Não testei exportação ou restauração nessa origem, para não gravar alterações nem substituir dados do navegador. Chaves `aurora.app.*`, envelope `{v,t}` e backups v1/v2 não foram alterados.
- Não validei larguras mobile/desktop nesta alteração.

- 2026-10-25 (modal de hábito andando para o lado): **não consegui reproduzir** em Chromium emulado (nenhuma largura de 320 a 820 px gera rolagem horizontal no corpo do diálogo), então a correção é defensiva: `overflow-x: clip` no corpo (bloqueia até a rolagem que o navegador faz ao focar um campo), `touch-action: pan-y` na camada do diálogo (bloqueia arrastar de lado; fica de fora dos diálogos com carrosséis horizontais) e os campos escondidos de ícone, cor e dia passaram a cobrir o próprio rótulo. Conferido por toques reais emulados (`tests/e2e/habit-dialog-touch.cjs`): ícone, cor e dia mudam, o corpo fica em `scrollLeft` 0 e o painel em x=12 depois de focar o horário. **Não validado em iPhone real.**

- 2026-10-25 (botões de fechar): medi o "X" em 8 diálogos e painéis (novo hábito, nova tarefa, novo lançamento, nova conta, busca, criação rápida, tema e acessibilidade, notificações), em 390 e 1280 px (`tests/e2e/close-buttons.cjs`): todos 40×40, raio de 12 px e mesmo fundo. O diálogo de tarefa tinha deslocamento próprio (21 px do topo, 27 px da direita no desktop); agora usa a mesma margem dos outros (17 px no celular, 21 px no desktop). Nos painéis (tema, notificações) a distância é de 17–19 px porque o contêiner é outro. Os botões de texto que fecham (Cancelar/Fechar) agora são todos `btn back`; antes quatro eram `btn` comum.

- 2026-10-25 (notificações): painel com tipo (tarefa, hábito, Pomodoro) e há quanto tempo chegou, ícone e cor do próprio hábito, botão de dispensar no canto de cada cartão, "Dispensar todas" (quando há mais de uma), adiar +10 min e +1 h nas tarefas e a seção "Próximos hoje" (tarefas com horário e hábitos com lembrete que ainda vão tocar; só leitura dos dados). O lembrete de hábito agora também aparece se a aba estava em segundo plano no minuto exato (janela de 15 minutos). Os avisos continuam só em memória, como antes: recarregar a página os apaga. Conferido por captura em 390 e 1280 px e por script (`tests/e2e/notifications.cjs`): 2 alertas ativos, "Próximos hoje" listado, adiar 1 h tira o aviso, sem erros de console e sem rolagem horizontal. Não validado: ver o painel abrir sozinho com a aba em segundo plano e notificações do sistema (não existem no app).

- 2026-10-26 (toasts compactos): o toast passou de cartão grande no topo para pílula de uma linha embaixo (44 px, 304–385 px de largura), com a mensagem de hábito encurtada ("meditar marcado · 19 out"). Conferido por captura a 390 e 1280 px em claro e escuro (`ts`), 37/37 testes, 6/6 integridade, 19/19 design system, 28 telas sem erros, `flows.cjs` 18/18, fechar e notificações sem erros. O teste `flows.cjs` dependia do dia da semana (às segundas não há dia passado na semana do hábito); agora usa o dia de hoje nesse caso. **Não validado**: iPhone real, leitor de tela (o rótulo do tipo só existe para ele), Safari/Firefox, e se a pílula embaixo continua perceptível o bastante (o toast antigo embaixo foi considerado discreto demais).

### Registro de validação — 2026-10-26 (próxima ação e Pomodoro por tarefa)

Executado em servidor HTTP local (`python -m http.server 8765`) com o Chromium integrado:

- `tests/index.html`: 43 de 43 testes passaram.
- Início selecionou uma tarefa pendente; iniciar foco abriu o Pomodoro com o título da tarefa. Após concluir um bloco parcial, recarregar e voltar a Início, o tempo acumulado apareceu na tarefa.
- Com dados locais de teste, um hábito pendente foi escolhido antes de uma fatura futura; ao concluir o hábito, a fatura com compra no ciclo e vencimento em cinco dias virou a próxima ação.
- Início em 390 e 1280 px: cartão e botões dentro da viewport, sem rolagem horizontal. O primeiro layout móvel excedia a tela; o cartão passou a usar grade móvel e a medição posterior não encontrou overflow.
- `node --check src/js/main.js` e `node --check tests/e2e/flows.cjs` passaram; o verificador do VS Code não apontou erros nos arquivos alterados.
- `tests/e2e/flows.cjs` não foi executado porque o pacote Playwright não está instalado; não foi adicionada dependência. O fluxo funcional foi verificado manualmente no Chromium integrado.
- O lembrete de backup de 14 dias já existia e permaneceu inalterado. A versão 2 do backup foi mantida; `focusSeconds` foi incluído na exportação e restauração, mas não testei download/importação de um arquivo nesta rodada. **Não validado**: Safari/iPhone real, leitor de tela e importação do novo campo via arquivo.

### Registro de validação — 2026-10-26 (revisão semanal, hábitos e lixeira)

Executado em origem HTTP local isolada (`localhost:8877`) com Chromium integrado:

- `tests/index.html`: 43 de 43 testes passaram no navegador.
- `tests/design-system-check.html`: 19 de 19 verificações passaram.
- `tests/contrast-check.html`: 616 combinações de paleta, tema e contraste passaram.
- Na lixeira, uma tarefa permaneceu excluída após recarregar e foi restaurada. A exclusão de uma conta financeira moveu junto o lançamento associado; ambos foram restaurados.
- `node --check` passou nos módulos JavaScript alterados.
- **Não validado**: iPhone real, leitor de tela e navegação completa por teclado. A validação anterior de teclado cobriu apenas o link “Pular para o conteúdo principal”.

### Auditoria de primeiros passos — 2026-10-26

Auditoria de leitura dos templates dinâmicos e fragmentos de Estudos e Água; não foi necessária mudança de interface:

- Início e Planejar: tarefa rápida, ações para criar a primeira tarefa e atalhos para semana, calendário e plano por etapas.
- Hábitos: criação direta, ideias prontas e indicação de que o dia está livre.
- Estudos e Pomodoro: o histórico orienta criar uma matéria ou registrar a primeira sessão; o timer explica como iniciar e o histórico informa onde os blocos concluídos aparecem.
- Água e Ciclo: o histórico vazio explica os registros rápidos; Ciclo mostra o primeiro passo e o que libera estimativas.
- Finanças: estados vazios orientam criar conta, lançamento e objetivo; orçamento explica como definir limites e a lista de fixas informa o caminho para criar a primeira.
- Buscas e filtros distinguem “sem dados” de “nenhum resultado para este filtro” e oferecem orientação para continuar.

Esta auditoria confirma a presença textual dos primeiros passos no código, não substitui a validação visual de cada estado em aparelho real nem testes com leitor de tela.

### Validação parcial de teclado — 2026-10-26

Em origem isolada (`localhost:8877`) com Chromium integrado:

- No diálogo de primeiro uso, Tab percorreu as ações e Enter em “Começar a planejar” fechou o diálogo.
- Tab e Enter ativaram “Pular para o conteúdo principal” e moveram o foco para o `<main>`.
- Sem usar o mouse, foi possível abrir o campo rápido, inserir uma tarefa e enviá-la com Enter; a tarefa apareceu na tela inicial e o status anunciou sucesso.
- Isto não cobre a ordem de foco de todas as rotas, diálogos e estados, nem leitor de tela; ambos permanecem pendentes.

### Navegação sem barra de áreas duplicada — 2026-10-26

- **Aprovado:** `tests/index.html` — 43 de 43 testes passaram em navegador Chromium via HTTP local.
- **Aprovado:** `node --check src/js/main.js`.
- **Aprovado:** Finanças, Pomodoro, Estudos, Ciclo e Hábitos renderizaram uma única barra superior. Uma barra `.areanav` temporária no DOM foi usada para confirmar `display: none` a 1365 px e 390 px.
- **Limitação:** o perfil isolado usado na navegação não tinha várias áreas opcionais ativas; a barra secundária foi validada por estilo calculado, sem alterar dados persistidos.

### Padronização de modais e listas — 2026-10-26

- **Aprovado:** `tests/index.html` — 43/43 testes passaram em navegador via HTTP local.
- **Aprovado:** `tests/design-system-check.html` — 19/19 verificações passaram, incluindo a resolução de todos os tokens CSS usados.
- **Aprovado:** `node --check src/js/main.js`.
- **Aprovado:** em perfil/origem isolada de teste, o diálogo de tarefa manteve semântica modal, foco dentro do diálogo, botão de fechar de 40 px e ações com 43 px de altura em 1280 × 900 e 390 × 844.
- **Aprovado:** em 390 × 844, a largura do diálogo foi 361 px e seu conteúdo não apresentou overflow horizontal (`scrollWidth` 364 px; `clientWidth` 364 px); o documento também não transbordou a largura da tela.
- **Aprovado:** Escape fechou o diálogo e devolveu o foco ao botão que o abriu, em desktop e celular; a restauração foi revalidada depois de a tela ser recriada.
- **Correção durante a validação:** o foco anterior era guardado como referência ao nó DOM, que deixava de existir após a renderização do shell. Agora a referência do controle é resolvida novamente após a renderização antes de restaurar o foco.
- **Limitação:** a verificação visual e de teclado cobriu o diálogo de tarefa em navegador integrado/emulado; outros tipos de diálogo, aparelho físico e leitor de tela não foram revalidados nesta rodada.

### Formulário de registro do ciclo — fluxo e sintomas

- **Aprovado:** `tests/index.html` — 43/43 testes passaram em navegador via HTTP local.
- **Aprovado:** `node --check src/js/main.js` e `node --check src/js/utils/icons.js`.
- **Aprovado:** o fluxo menstrual ficou em duas colunas em 320, 360, 390 e 430 px, e em quatro colunas em 1280 px; os quatro botões couberam na grade sem overflow.
- **Aprovado:** o diálogo e o documento não apresentaram overflow horizontal nas cinco larguras verificadas.
- **Aprovado:** a seleção exclusiva do fluxo e do sono continuou funcionando; acne e desejo de doce puderam ser selecionados simultaneamente. Os botões mantiveram nomes acessíveis em texto e os ícones correspondentes foram renderizados.
- **Limitação:** a validação foi feita em navegador integrado e origem local isolada; não foi feita em aparelho Android físico nem com leitor de tela.

### Perfil obrigatório no primeiro uso — 2026-10-26

- **Aprovado:** `tests/index.html` — 43/43 testes passaram em navegador via HTTP local.
- **Aprovado:** `node --check src/js/main.js`.
- **Aprovado:** em origem local isolada, a configuração inicial exigiu nome e identidade de gênero antes de avançar; nome vazio e identidade não selecionada foram rejeitados. “Pessoa não binária” e “Prefiro não informar” foram aceitos.
- **Aprovado:** escolhas de cor e áreas opcionais só aparecem após preencher os campos obrigatórios.
- **Aprovado:** o modal abriu com foco no próprio diálogo, sem foco automático no campo de texto; Escape e clique no fundo não fecharam a configuração. A página permaneceu inerte até concluir o fluxo.
- **Aprovado:** em 320, 360, 390, 430 e 1280 px, o modal e a página não tiveram overflow horizontal.
- **Aprovado:** um perfil local antigo com configuração marcada como concluída, mas sem identidade, foi direcionado à configuração obrigatória sem perder o nome. A escolha de identidade pôde ser editada em Ajustes e permaneceu após recarregar.
- **Aprovado:** backup versão 2 exportado e importado no perfil isolado preservou o código de identidade já armazenado.
- **Integridade:** chaves `aurora.app.*`, envelope `{v,t}`, nomes de campos e versões de backup não foram renomeados; foi adicionada somente a opção `nb`, mantendo os códigos existentes.
- **Limitação:** fluxo testado em navegador integrado/origem isolada, não em aparelho Android físico nem com leitor de tela. Falhas de armazenamento bloqueado não foram simuladas nesta rodada.

### Indicador da navegação inferior — 2026-10-26

- **Aprovado:** em viewport mobile, a navegação não desenha mais a linha sobreposta acima do ícone ativo; a seleção continua visível pelo fundo arredondado, cor e `aria-current="page"`.
- **Aprovado:** a verificação cobriu 390 px e 1280 px; a navegação desktop não usa esse indicador e permaneceu inalterada.

### Link de salto durante o overscroll — 2026-10-27

- **Aprovado:** o link permanece invisível e sem área de toque quando não está em foco; com foco de teclado, aparece no topo e continua podendo levar ao conteúdo principal.
- **Aprovado:** inspeção em Chromium integrado confirmou `position: fixed`, opacidade 0 no estado inicial e opacidade 1 no estado `:focus-visible`.
- **Aprovado:** a validação de perfil não bloqueia mais a ação do link; o teste automatizado confirma que `skip` é isento da configuração de perfil obrigatório, e a ativação leva o foco ao `<main>`.
- **Aprovado:** 45/45 testes passaram no runner HTTP; na rota Ciclo, larguras de 320, 360, 390, 430, 900 e 1280 px não apresentaram overflow horizontal nem erros de console ou requisição.
- **Limitação:** a área Ciclo estava desligada neste navegador; o formulário de registro não foi ativado para evitar modificar dados persistentes. A borracha de rolagem foi relatada em Android, mas não testada em aparelho físico nesta rodada.

### Formulário do ciclo — organização visual dos sintomas — 2026-10-26

- **Aprovado:** `tests/index.html` — 43/43 testes passaram; `tests/design-system-check.html` — 19/19 verificações passaram.
- **Aprovado:** `node --check src/js/main.js` e `node --check src/js/utils/icons.js`.
- **Aprovado:** diálogo conferido em 320, 390, 430 e 1280 px. Os 38 sintomas não ultrapassaram a tela, não houve overflow no documento/diálogo nem rótulos cortados; cada categoria tem cor própria e cada grupo usa ícones distintos.
- **Aprovado:** no diálogo, fluxo continuou de escolha única e opções de pele permaneceram de múltipla escolha; `aria-pressed` anuncia corretamente `true`/`false`.
- **Limitação:** validação em navegador integrado com origem isolada; não foi feita em aparelho Android físico nem com leitor de tela.

### Informações de saúde no Ciclo e ícone de escape — 2026-10-27

- **Aprovado:** a seção educativa inicia recolhida, expande por seu resumo nativo e oferece seis referências externas com `target="_blank"` e `rel="noopener noreferrer"`.
- **Aprovado:** os textos orientam sobre mudanças menstruais, sexo e proteção, dor e busca de atendimento; não foi adicionado campo nem persistência de atividade sexual.
- **Aprovado:** em viewport 320, 390, 430 e 1280 px, a seção e seus links não causaram overflow. O ícone de escape agora renderiza um caminho SVG preenchido e a escolha única do fluxo permanece funcional (`aria-pressed`).
- **Aprovado:** `node --check src/js/main.js` e `node --check src/js/utils/icons.js`.
- **Limitação:** navegador Chromium integrado; conteúdo não substitui orientação clínica, e não houve validação em aparelho Android físico ou com leitor de tela.

### Implementação do Push opcional do Pomodoro — 2026-10-27

- **Aprovado:** `node --check` em `src/js/main.js`, `src/js/services/pomodoro-push.js`, `src/js/services/pomodoro-push-config.js`, `service-worker.js` e `tests/run.js`.
- **Aprovado:** runner HTTP isolado em `http://localhost:8766/tests/` — 47/47 casos; `npm test` em `worker/` — 8/8 casos para CORS, limites de registro/instalação, validação da inscrição, autenticação-capacidade, horizonte, alarme de fase, cancelamento e exibição/supressão de notificações pelo service worker.
- **Aprovado:** `tests/design-system-check.html` — 19/19 verificações; os tokens usados pelos novos estilos existem.
- **Aprovado:** `npm run deploy -- --dry-run` em `worker/` gerou o bundle e reconheceu Durable Object, binding de limite de registro e variáveis sem tentar implantar.
- **Aprovado:** em perfil isolado `localhost:8766`, o primeiro uso concluiu a configuração local, o Pomodoro foi ativado, o controle Push explicou que ainda falta configurar a API e permaneceu inativo; em viewport 390 × 844 px não houve overflow. Iniciar e pausar o timer não fez requisições `/api` sem ativação; o timer pausado persistiu após reload, sem erros de console ou da página.
- **Não executado:** deploy Cloudflare/GitHub Pages, entrega de Push real, permissão e notificação em app visível/fechado, Add-to-Home-Screen/Push em iPhone ou teste físico de áudio. Não havia conta Cloudflare nem dispositivo iOS acessível.
- **Limitação:** Wrangler avisa que o binding Cloudflare Rate Limiting configurado em `unsafe.bindings` é experimental; o dry-run de produção reconheceu o binding. O ambiente local de desenvolvimento não usa esse binding e mantém limite por instalação.
- **Limitação:** o navegador integrado estava com `Notification.permission = "denied"`; a API ainda não estava configurada. Não foi solicitado nem alterado nenhum segredo, e o backend não foi implantado.
