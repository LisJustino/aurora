# Aurora: inventário do projeto (repo LisJustino/aurora, commit 80fdca2)

SPA em JavaScript puro (módulos ES), sem bundler e sem dependências. Dados em `localStorage` (`aurora.app.*`, envelope `{v,t}`), backup JSON v1 e v2.

## Telas (rotas por hash)
- `#inicio`: cartão "boa noite" com progresso do dia, campo rápido de tarefa, hábitos de hoje, tarefas agrupadas (atrasadas, hoje, concluídas), áreas opcionais.
- `#planejar`: lista, calendário e semana; filtros, busca, ordenação, plano por etapas, revisão semanal, subtarefas, etiquetas, repetição e lembretes. Foco/Estudos é uma visão de Planejar (`#estudos`).
- `#habitos`: check-ins diários, sugestões, histórico mensal, lembretes e hidratação (água é um hábito).
- `#pomodoro`: ciclos de foco/pausa, 4 blocos até a pausa longa, presets e tempos personalizados, aviso sonoro.
- `#financas`: contas, cartões, lançamentos, fixas, orçamentos, metas, comparação de meses, importação CSV e exportação.
- `#ciclo`: registro do dia por modal, calendário com fases estimadas, sintomas mais frequentes.
- `#config`: perfil, aparência (tema, cor, fonte, densidade), áreas e menus, dados e backup, acessibilidade.
- Recursos globais: busca (Ctrl+K), notificações, criação rápida (+), onboarding, dados de exemplo.

## Arquivos
- `index.html`, `service-worker.js`, `manifest.webmanifest`, `pages/*.html` (entradas de rota), `icons/`.
- `src/js/main.js` (~4.570 linhas: templates, estado, ações, formulários, diálogos).
- `src/js/core/`: router, access-control, data-integrity, backup-transaction.
- `src/js/features/`: finance/calculations, habits (model, water-goal), studies (pomodoro, pomodoro-audio, template), water/template, planning (week, recurrence), navigation/menu, search, cycle/phases.
- `src/js/services/`: storage e busca local. `src/js/utils/`: dom, dates, currency, ids, html-template.
- `src/css/`: tokens, base, layout, components/*, pages/* (home, habits, areas, finance, layouts), importados por `main.css`.
- `docs/`: architecture, data-model, decisions, design-system, pwa, project-structure, testing. `tests/`: index.html, integrity-check.html, run.js.

## Nesta atualização
1. `src/css/pages/home.css`: ícone do cartão "qual é o próximo passo?" estava invisível (cor igual ao fundo).
2. `src/css/pages/areas.css`: números 1 a 4 da sequência do Pomodoro invadiam o texto abaixo; setas do calendário do Ciclo quebravam em linhas separadas no celular.
3. `src/js/main.js`: removido o segundo botão "Novo hábito" (já existe no topo da tela); os dados de exemplo agora ativam Hábitos e Pomodoro.
4. `src/js/main.js` (Ajustes): "Aparência" e "Calendário" viraram uma única seção, "Personalização", com cor, leitura e espaçamento, início da semana e acessibilidade, e um só botão Salvar. Links antigos (`#config?section=appearance` e `preferences`) abrem a nova seção.
5. `tests/integrity-check.js`: o teste ainda procurava "cópia de recuperação" e "importar backup" na aba errada de Ajustes. Agora abre `#config?section=data`; passa 6 de 6.
6. Cabeçalho (`src/js/main.js`, `src/css/components/accessibility.css`): o botão de tema (monitor) saiu do cabeçalho. O botão de acessibilidade virou "Tema e acessibilidade", com seletor Automático/Claro/Escuro (salva ao tocar) e atalho "Mais opções em Personalização". Cabeçalho passa de 6 para 5 ícones.
7. Home (`src/css/pages/home.css`, `src/js/main.js`): o ícone `chart` não existia (chips "Fazer revisão semanal" e aba "Revisão" apareciam sem ícone); agora existe. O último cartão ímpar de "áreas opcionais" ocupa a linha inteira.
8. Lembrete de backup na Home: aparece após 14 dias sem backup (ou sem nunca ter exportado, contando da tarefa mais antiga). "Agora não" esconde até recarregar. Não grava nada novo nos dados.
9. Pomodoro: pausa longa configurável (5 a 60 min, padrão 15, só no preset Personalizado) e histórico dos últimos 7 dias. O histórico fica em `S.pomodoro.history` (mapa `AAAA-MM-DD: blocos`, no máximo 30 dias), validado ao carregar; dados antigos funcionam sem migração.
10. Hábitos: meta semanal opcional (`weeklyGoal`, 1 a 7, limitada aos dias escolhidos). Com meta, o cartão mostra "x de N nesta semana", "meta cumprida" e sequência em semanas. Hábitos sem meta não mudam.
11. Código: paletas e cálculo de contraste saíram de `main.js` para `src/js/features/appearance/palettes.js`. Novos testes em `tests/run.js` (de 19 para 34).
12. Hábitos redesenhados como lista simples de hoje (`viewHabits`, `habitRow` em `src/js/main.js`; `src/css/pages/habits.css`): cada hábito de hoje é uma linha com um círculo grande para marcar com um toque, ícone e cor próprios e a sequência ao lado ("3 dias seguidos"). Histórico mensal, dias da semana, editar, pausar e arquivar ficam dentro da linha (toque no nome para abrir). A água é uma linha igual às outras: o círculo soma 200 ml e o histórico e +300/+500 ml ficam dentro dela. Hábitos pausados ou fora de hoje ficam em "Fora de hoje"; "Ideias de hábitos" é uma grade com 11 sugestões (14 no catálogo, contando a água e as três antigas) que abre o formulário já preenchido. O formulário de hábito ganhou seletor de 23 ícones e 12 cores. Dados: `icon` e `color` são campos opcionais do hábito (`src/js/features/habits/model.js`), então hábitos antigos continuam válidos, sem migração. Os ícones novos estão no mapa `icon()` de `main.js`. Os cartões de "Hábitos de hoje" na Home também mostram o ícone e a cor.
13. Design system em `src/css/design-system/` (`tokens.css`, `buttons.css`, `fields.css`, `fields-skin.css`, `selectors.css`, `feedback.css`): tokens únicos (antes havia dois blocos `:root` que se sobrescreviam), escala de 11 tamanhos de fonte, raios `--r-xs` a `--r-pill`, alturas `--control-sm/md/field/lg` e `--on-solid`. Botões, campos, chips, segmentados, selos e estado vazio têm uma definição só. Foram trocados 243 tamanhos de fonte, 39 raios e 50 alturas soltos por tokens; o token indefinido `--text-body` foi corrigido. Novo modificador `.btn.large`. Novos: `docs/design-system.html` (referência visual com troca de tema) e `tests/design-system-check.html` (19 verificações). `docs/design-system.md` e `docs/decisions.md` (D-006) foram atualizados.
14. Tema: o seletor Automático/Claro/Escuro agora aparece também no topo de Ajustes > Personalização (antes só existia no menu do cabeçalho, difícil de achar no celular). Os avisos (toasts) ficam no topo, ampliados, e descem ao rodapé quando um painel do cabeçalho está aberto.
15. Cabeçalho: o botão "+" (criar novo) saiu e deu lugar a um botão de tema de um toque (Automático → Claro → Escuro). A ação `quick-create-open` continua no código, sem botão que a chame.
16. Hábitos (segunda rodada): os pontinhos da semana e as células do histórico mensal agora são botões que marcam ou desmarcam dias passados (com "Desfazer"); setas subir/descer reordenam; "ano em calendário" mostra 53 semanas. Tudo usa os campos que já existem (`completions`, ordem do array); nada foi migrado.
17. Início: o texto de abertura diz também quantos hábitos faltam hoje.
18. Pomodoro: campo opcional "Em que você vai focar?" (`focusLabel` em `S.pomodoro`, até 40 caracteres). É só um rótulo: não grava em `S.sessions` nem mexe no histórico de Estudos (D-002).
19. Finanças: card "Lançamentos fixos" no Resumo (quantidade e total mensal). Exportar CSV e comparar meses já existiam.
20. Atalho de criação rápida: botão "Criar" no menu Mais e tecla N (não dispara dentro de campos).
21. Testes novos: `tests/contrast-check.html` (contraste AA de 14 paletas × claro/escuro × alto contraste) e `tests/e2e/flows.cjs` (fluxos no navegador; exige Playwright no seu computador e não é dependência do projeto).
22. Código: ícones foram para `src/js/utils/icons.js` (`main.js` perdeu ~75 linhas); `cards.css` passou para `design-system/`; `--shadow-hover` virou token.
23. PWA/offline validado com Chromium: o service worker guarda no cache cada arquivo visitado, então os arquivos novos entram sozinhos; o app abriu sem rede.
24. Melhorias visuais (`src/css/design-system/touch.css`, `src/js/main.js`): áreas de toque ampliadas (círculos, pontinhos de hábito, links curtos) e botões de 34–38 px elevados para 40–44 px; o plano de hoje ganha destaque no Início e o cartão de entrada rápida fica mais curto no celular; o círculo marcado dá um pulo curto (respeita "reduzir movimento"); calendário anual com células de 14 px que abre mostrando os meses mais recentes; erros de formulário aparecem junto ao campo (função `fieldError`, usada no nome do hábito, lembrete e valor do lançamento); indicador forte do item ativo na barra inferior; cartões do tema escuro mais separados; seções de Finanças em uma única fileira rolável no celular; valores de Finanças alinhados à direita; estado "Dia livre" de Hábitos ganhou o botão "Novo hábito"; campos numéricos do Pomodoro com teclado numérico.
25. Não feito, de propósito: o texto todo em minúsculas (`base.css`) é uma escolha de identidade do app, então não mexi. Esqueleto de carregamento (não há carregamento: tudo é local; a transição entre telas já existia). Terminar a migração do `visual-refresh.css`. Sincronização e backup em nuvem não fazem parte do produto local.
26. 2026-10-26: removidas as chamadas de conta, sincronização remota e Google Calendar; os recursos de backup e recuperação locais foram preservados.

26. Menu "Mais" no celular: painel opaco e fundo escurecido com desfoque (antes dava para ler o conteúdo atrás). Toque fora ou Esc fecham.

27. Diálogos no celular: o teclado não abre mais sozinho (o foco vai para o diálogo e o teclado só abre ao tocar no campo); diálogos com campos ficam presos ao topo, para não pularem quando o teclado aparece; a animação de entrada roda só ao abrir; avisos de confirmação somem ao abrir um diálogo em vez de cobrir o título. No desktop o foco automático continua.

28. Diálogos com teclado no iPhone (segunda correção): o painel não segue mais o deslocamento horizontal nem a animação do teclado (`fitDlg` em `src/js/main.js`). Precisa de conferência em iPhone real.

29. Diálogos: a lista de "O que você quer criar?" ocupa a largura toda (havia uma largura errada no corpo); a borda da rolagem ficou suave, sem corte seco; margens simétricas; sem o anel grande no "X" ao abrir no celular.

30. Modal de novo hábito no iPhone: bloqueios contra deslocamento lateral (`overflow-x: clip`, `touch-action: pan-y`, seletores escondidos cobrindo o rótulo). Causa exata não reproduzida; precisa de conferência em iPhone real.

31. Botões de fechar padronizados: o "X" é um só componente em todos os diálogos e painéis (40×40); o diálogo de tarefa ganhou a mesma margem dos demais; os botões "Cancelar"/"Fechar" são todos do mesmo estilo.

32. Notificações (`src/js/main.js`, `src/css/components/navigation.css`): cada aviso mostra o tipo e há quanto tempo chegou; hábitos usam o próprio ícone e cor; "dispensar" fica no canto de cada cartão e há "Dispensar todas"; tarefas podem ser adiadas em 10 min ou 1 h; nova seção "Próximos hoje" com os lembretes que ainda vão tocar; lembretes de hábito têm janela de 15 minutos. Os avisos continuam só em memória (recarregar apaga).

33. Toasts compactos (`src/css/components/modals.css`, `src/js/main.js`): pílula de uma linha embaixo, cores invertidas, "Desfazer" em texto, sem faixa lateral; sobe para o topo só com diálogo ou menu "Mais" aberto. Mensagem de hábito encurtada. Teste `flows.cjs` não depende mais do dia da semana.

## Arquivos estranhos na raiz do repo
`h origin main` e `trutura e documentação do Aurora` parecem restos de comandos digitados no terminal. Não mexi neles, mas vale apagar.
