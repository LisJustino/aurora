# Design system do Aurora

## Direção visual

O Aurora usa uma linguagem calma, legível e orientada à ação: um fundo neutro levemente quente, superfícies sólidas compartilhadas e bordas sutis reduzem ruído e mantêm as áreas coesas. O acento rosa-vinho preserva reconhecimento de marca e destaca seleção, hierarquia e ações primárias, sem virar decoração em cada componente. Estados de sucesso, atenção e erro usam cores semânticas distintas e devem continuar acompanhados de texto, ícone ou rótulo — nunca depender apenas da cor.

A tipografia usa DM Sans variável, auto-hospedada sob a SIL Open Font License, com fontes do sistema como fallback. Isso mantém a aparência consistente sem depender de CDN; o fallback funciona quando a fonte não pode ser carregada. Peso e tamanho criam hierarquia; valores financeiros, contadores e gráficos usam números tabulares para facilitar comparação. Gradientes ficam restritos a elementos que expressem dados ou identidade; o hero de Início pode usar um brilho sutil da paleta como expressão da identidade Aurora.

## Tokens

Os valores-base estão em `src/css/design-system/tokens.css`. O tema claro é padrão e o tema escuro é escolhido manualmente; o sistema operacional não altera o tema do Aurora. O tema escuro redefine superfícies, texto, bordas e cores semânticas. `--p` e `--pd` são atualizados pelo seletor de paleta existente, portanto componentes devem usar `--accent`, `--btn` e `--soft*` em vez de fixar tons de marca.

| Grupo | Tokens e regra |
| --- | --- |
| Fundo e superfícies | `--bg` é o fundo da aplicação; `--surface` é a superfície padrão; `--surface-soft` é uma superfície discreta; `--surface-strong` e `--surface-raised` destacam cartões e camadas flutuantes. |
| Texto e bordas | `--ink` para conteúdo principal, `--muted` para informação secundária, `--line` para separação sutil e `--line-strong`/`--line2` para limites de controles (alvo mínimo de 3:1 contra a superfície). |
| Marca e interação | `--accent` destaca seleção e navegação; `--btn` e `--on-btn` definem ação primária e seu texto; `--soft`/`--soft2` criam realces discretos. |
| Semântica | `--ok`, `--warn` e `--bad`, com suas variantes `*-soft`, comunicam resultado, atenção e erro; `--area-*` diferencia os chips de ícone. Mantenha rótulos e mensagens junto à cor. |
| Foco | `--focus` fornece um contorno visível de 3 px, independente da cor de destaque escolhida. |
| Espaçamento | Escala-base de 4, 8, 12, 16, 24, 32, 40 e 48 px (`--space-1` a `--space-8`). Use incrementos menores dentro de controles e maiores entre seções. |
| Raios | `--r-xs` 8, `--r-sm` 12, `--r-control` 14 (controles), `--r-group` 18 (itens agrupados), `--r` 24 (cartões), `--r-large` 32 (destaques de página) e `--r-pill` para indicadores. Nunca escreva raios em px. |
| Tipografia | `--text-2xs` 11, `--text-xs` 12, `--text-meta` 13, `--text-sm` 14, `--text-md` 15, `--text-base` 16, `--text-lg` 18, `--text-xl` 20, `--text-title` 22, `--text-2xl` 24, `--text-3xl` 28; fluidos: `--text-page-title`, `--text-display`, `--text-section`, `--text-heading`. Nunca escreva tamanhos em rem/px (exceção: o 16 px da raiz e o `max(16px, …)` dos campos). |
| Controles | `--control-sm` 40, `--control-md` 44 (alvo de toque), `--control-field` 48 (campos), `--control-lg` 52. Elementos densos de calendário e gráfico (36 px ou menos) ficam fora desta escala. |
| Texto sobre cor sólida | `--on-solid` (círculos de hábito, selos e cores de área). |
| Elevação | Cartões podem usar a elevação discreta `--card-shadow`; listas e grupos mantêm borda e superfície sem sombras. `--shadow` é reservado a camadas flutuantes como diálogos e toasts. |
| Listas e diálogos | Linhas de listas usam `--list-row-border`, `--list-row-radius` e `--list-row-surface`; o hover usa `--list-row-hover` e `--list-row-hover-border`. Diálogos compartilham `--dialog-padding` e `--dialog-padding-compact`, além do mesmo cabeçalho, botão de fechar e rodapé de ações. |

## Onde fica cada coisa

| Arquivo (`src/css/design-system/`) | Conteúdo |
| --- | --- |
| `tokens.css` | Fonte única de todos os tokens e dos temas claro, escuro e de contraste. |
| `buttons.css` (fechar) | Todo "X" de diálogo ou painel é `ibtn dlg-close` (40×40, raio `--r-sm`, canto superior direito do cabeçalho). Botões de texto que fecham são `btn back`: "Cancelar" em formulários e "Fechar" em diálogos só de leitura. |
| `touch.css` | Camada final: áreas de toque ampliadas, hierarquia do Início, pulo ao concluir, calendário anual, erro junto ao campo (`.field-err`), indicador do item ativo na barra e separação dos cartões no tema escuro. Fica por último no `main.css` de propósito. |
| `cards.css` | `.card` e variações (`.flat`, etc.). O hover usa `--shadow-hover`. As regras visuais finas dos cartões ainda estão em `components/visual-refresh.css` (migração parcial). |
| `buttons.css` | `.btn` (primário, padrão, `.back`, fantasma, perigo; `.sm`, `.large`, `.block`) e `.ibtn`/`.iconbtn`. |
| `fields.css` e `fields-skin.css` | Rótulo, input, select, textarea, checkbox, grade de formulário e campos compostos. A aparência final (`fields-skin.css`) vem depois dos estilos de página de propósito. |
| `selectors.css` | Abas, `.chip` e `.seg`. |
| `feedback.css` | `.badge` e `.empty`. |

A ordem dos imports em `src/css/main.css` é parte do desenho: estilos-base de campos entram cedo para que as páginas possam ajustá-los, e a aparência final entra tarde. Cartões, diálogos, navegação e páginas continuam em `components/` e `pages/`, mas usam os mesmos tokens.

## Regras para novos estilos

1. Use tokens: tamanho de fonte (`--text-*`), raio (`--r-*`), altura de controle (`--control-*`), espaço (`--space-*`) e cor (`--accent`, `--ink`, `--on-solid` etc.).
2. Reutilize `.btn`, `.ibtn`, `.chip`, `.seg`, `.badge`, `.empty` e os campos; ajuste a posição por contexto (`.meu-bloco .btn { flex: 1 }`), não a aparência.
3. Um hábito novo de visual vira token aqui antes de se espalhar pelas telas.
4. Rode `tests/design-system-check.html`: ele reprova tamanhos de fonte, raios, alturas e brancos soltos, e qualquer `var(--token)` inexistente.
5. Confira o resultado em `docs/design-system.html` nos temas claro e escuro.

## Tipografia e layout

- Corpo: DM Sans variável com fallback do sistema em 16 px, entrelinha 1,5; os controles mantêm pelo menos 16 px para evitar zoom automático em celulares.
- Títulos: escala fluida para H1; H2 e H3 usam níveis descendentes, sem competir com o título da página.
- Texto secundário: 14 px; detalhes e metadados: 12 px, sem usar tamanhos pequenos para instruções essenciais.
- A aplicação limita a moldura a 1200 px e o conteúdo de leitura a 880 px. A navegação principal fica no cabeçalho em telas largas e fixa no rodapé em telas estreitas.
- A largura móvel respeita áreas seguras do dispositivo. Grades devem usar colunas mínimas flexíveis e permitir quebra de valores longos; listas e abas podem rolar horizontalmente apenas dentro do próprio controle.

## Componentes e estados

- **Ações:** botões padrão e controles de ícone têm alvo mínimo próximo a 44 px; ações primárias são preenchidas, secundárias usam superfície e borda, e ações destrutivas usam a cor de erro com texto explícito.
- **Campos:** rótulos persistentes acima dos controles, altura mínima de 48 px, borda visível e estado de foco evidente. `select` permanece nativo, usa a mesma superfície, tipografia, borda, raio e foco dos demais campos, com indicador de abertura derivado do token de texto secundário. A variante compacta dentro de `.mini` conserva o agrupamento visual e uma área de interação próxima de 44 px. Hover e desabilitado têm estados próprios; `aria-invalid="true"` destaca o limite sem substituir mensagem de erro. Valores fechados longos podem ser truncados sem alargar o formulário.
- **Cartões e listas:** cartões usam a mesma superfície opaca, borda sutil e elevação discreta em todas as áreas; destaques de página recebem apenas um leve tom da paleta. Listas usam itens compactos sem sombras; listas agrupadas dentro de `.grp` usam divisórias internas sem borda por item.
- **Linhas de lista:** tarefas, hábitos, lançamentos, cartões financeiros e notificações compartilham a borda, o raio e a superfície definidos pelos tokens `--list-row-*`. O espaçamento e a disposição do conteúdo podem variar para preservar densidade e ações específicas da área; agrupamentos `.grp` continuam usando divisórias internas.
- **Estado vazio:** `.empty` tem uma única definição em `design-system/feedback.css`; as telas podem ajustar o contexto e o conteúdo, sem redefinir a estrutura visual global.
- **Opções de configuração:** `.setting-toggle` padroniza caixas de seleção com texto, descrição, superfície e foco visível; `.settings-options` agrupa várias opções com espaçamento consistente. Ambos usam tokens de tema e paleta, e também respeitam a densidade compacta.
- **Abas e filtros:** seleção é indicada por estado semântico (`aria-selected` ou `aria-pressed`) e por contraste/indicador visual, além da cor.
- **Navegação:** telas largas exibem a marca, destinos principais e controles no cabeçalho superior; áreas opcionais ativadas também ficam visíveis na navegação. Ajustes e perfil têm acesso pelo cabeçalho. Em telas estreitas, a barra fixa do rodapé mantém Início e Planejar; entre 481 e 899 px ela flutua com os quatro cantos arredondados e rótulos de ao menos 12 px; até 480 px fica colada à borda inferior.
- **Diálogos e notificações:** diálogos usam cabeçalho e botão de fechar compartilhados, superfície elevada, conteúdo rolável e rodapé de ações separado; `--dialog-padding` e `--dialog-padding-compact` mantêm o recuo consistente entre desktop e celular. Ao fechar, o foco retorna ao controle que abriu o diálogo, mesmo quando a tela foi renderizada novamente. Variantes destrutivas, de tarefa e onboarding podem ajustar largura, conteúdo e ênfase sem substituir a estrutura comum. A central de notificações abre pelo sino na navegação (desktop) ou no cabeçalho (celular), mostra lembretes ativos e mantém ações acessíveis; avisos (toasts) são uma pílula compacta de uma linha (40–44 px), centralizada logo acima da barra inferior no celular e a 28 px do rodapé no desktop; cores invertidas (escuro no tema claro, claro no escuro) para manter o contraste sem faixa lateral nem sombra pesada; ícone pequeno na cor do tipo, texto de 14 px sem quebra de linha, "Desfazer" como link sublinhado, barra de tempo de 3 px, 5 s de duração (9 s com "Desfazer"). O rótulo do tipo fica só para leitores de tela. Com diálogo ou menu "Mais" aberto, o aviso sobe para o topo (`.toast-top`) para não cobrir os botões de baixo.
- **Estados vazios e carregamento:** conservar a explicação e a próxima ação no estado vazio; quando possível, oferecer uma ação contextual direta e um ícone decorativo maior. Indicadores de progresso devem manter texto ou valores acessíveis; gráficos devem ter rótulos que expliquem período e medida, limitar barras a 520 px e preservar proporções legíveis.
- **Foco e movimento:** `:focus-visible` tem contorno de alto destaque também em datas e chips selecionados. Mudanças de rota e conclusão de tarefa têm transições breves; a preferência por movimento reduzido desativa animações e transições não essenciais.
- **Escala de texto:** metadados e rótulos de gráficos devem usar unidades relativas à raiz para acompanhar os níveis de fonte do aplicativo; texto essencial não fica abaixo de 12 px no tamanho padrão.
- **Opções de `select`:** o campo fechado é estilizado pelo Aurora, mas o menu aberto e as opções seguem o navegador/sistema operacional para preservar o comportamento nativo de teclado e toque; não se promete aparência idêntica entre plataformas.

## Aplicação por área

- **Início:** saudação e resumo do dia primeiro, em uma superfície de destaque; atalhos frequentes vêm antes de indicadores secundários. Em telas largas, tarefas de hoje e áreas opcionais ficam lado a lado. Os chips de ícone das áreas usam cores semânticas próprias. Os atalhos têm estados de foco e hover visíveis. O resumo compacto não substitui a lista de tarefas de hoje.
- **Planejar e Foco:** filtros e tarefas favorecem leitura e execução. No modo Foco, o cronômetro ganha escala visual e progresso circular; as notificações sinalizam o início da pausa sem som ou pausa automática, enquanto meta, matérias e histórico permanecem em segundo plano.
- **Finanças:** saldo e totais são separados dos lançamentos e relatórios; valores usam algarismos tabulares e podem quebrar sem provocar rolagem horizontal. Negativos exibem o sinal e também descrevem o saldo ou tipo de lançamento em seu rótulo acessível, sem depender só da cor. Gráficos de rosca mantêm pequenos vãos entre categorias para distinguir segmentos.
- **Água, Academia e Ciclo:** Água destaca a meta do dia e mantém o histórico acessível; Academia combina indicadores e registros; Ciclo agrupa seleção de data, sintomas e calendário sem misturar estimativas com registros.
- **Perfil e Ajustes:** Perfil abre com um resumo pessoal e organiza identidade, apelido, dados opcionais e ciclo numa grade que se adapta à largura; Ajustes mantém formulários agrupados por assunto. Controles destrutivos permanecem numa zona identificável e exigem confirmação existente.

## Verificação e limites

O sistema define regras para os temas claro e escuro, que são escolhidos manualmente; a aparência também depende da paleta escolhida pela pessoa e dos dados locais. Contraste, quebra de conteúdo, foco de teclado e fluxos de diálogo precisam ser verificados nos dois temas e em larguras móveis e desktop antes de declarar conformidade.

O alvo desta implementação é a aplicação modular iniciada por `index.html`, incluindo as entradas de rota em `pages/`. `aurora-legacy.html` é um artefato legado preservado, não uma segunda entrada do redesign; por ter CSS embutido, a regra de `select` foi espelhada nele sem acoplar a folha modular.
