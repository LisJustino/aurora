# Design system do Aurora

## Direção visual

O fundo do aplicativo permanece neutro em todas as rotas. Os destaques principais compartilham a superfície `--hero`, o raio e a elevação do sistema; cores de área aparecem em ícones, indicadores e estados, sem criar um tema visual separado para cada página.

O Aurora combina uma base neutra e tranquila com sinais de marca mais expressivos onde a pessoa começa ou decide: a saudação do Início e o hero público usam o degradê rosa-ameixa `--hero-home`, e um brilho ambiental discreto `--canvas-glow` dá profundidade ao fundo sem competir com os cartões. O destaque acompanha a paleta e o tema; as demais áreas mantêm superfícies compartilhadas. Estados de sucesso, atenção e erro usam cores semânticas distintas e devem continuar acompanhados de texto, ícone ou rótulo — nunca depender apenas da cor.

A tipografia usa DM Sans variável, auto-hospedada sob a SIL Open Font License, com fontes do sistema como fallback. Isso mantém a aparência consistente sem depender de CDN; o fallback funciona quando a fonte não pode ser carregada. Peso e tamanho criam hierarquia; valores financeiros, contadores e gráficos usam números tabulares para facilitar comparação. Gradientes ficam restritos a elementos que expressem dados ou identidade; o hero de Início pode usar um brilho sutil da paleta como expressão da identidade Aurora.

## Tokens

Os valores-base estão em `src/css/design-system/tokens.css`. O tema claro é padrão; a pessoa pode escolher Claro, Escuro ou Automático. Em Automático, o Aurora acompanha a preferência de tema do sistema. O tema escuro redefine superfícies, texto, bordas e cores semânticas. `--p` e `--pd` são atualizados pelo seletor de paleta existente, portanto componentes devem usar `--accent`, `--btn` e `--soft*` em vez de fixar tons de marca.

| Grupo | Tokens e regra |
| --- | --- |
| Fundo e superfícies | `--bg` é o fundo da aplicação; `--surface` é a superfície padrão; `--surface-soft` é uma superfície discreta; `--surface-strong` e `--surface-raised` destacam cartões e camadas flutuantes. `--hero` dá um tom compartilhado aos destaques de página; `--hero-home` preserva o rosa-ameixa da marca na saudação do Início e no hero público. `--canvas-glow` colore o fundo com sutileza. `--surface-qr` permanece branco nos dois temas para manter a leitura de QR codes. |
| Texto e bordas | `--ink` para conteúdo principal, `--muted` para informação secundária, `--line` para separação sutil e `--line-strong`/`--line2` para limites de controles (alvo mínimo de 3:1 contra a superfície). |
| Marca e interação | `--accent` destaca seleção e navegação; `--btn`/`--on-btn` definem ações globais e `--public-primary`/`--on-public-primary` ações públicas de conta; `--soft`/`--soft2` criam realces discretos. Todo botão habilitado ganha elevação de 1 px no hover em dispositivos apontadores; estilos específicos podem completar o realce sem removê-lo. Na demonstração, ações desabilitadas podem manter um realce visual quando apontadas, mas não ficam clicáveis nem mudam de estado. |
| Semântica | `--ok`, `--warn` e `--bad`, com suas variantes `*-soft`, comunicam resultado, atenção e erro; `--area-*` diferencia os chips de ícone. Mantenha rótulos e mensagens junto à cor. |
| Foco | `--focus` fornece um contorno visível de 3 px, independente da cor de destaque escolhida; `--focus-ring-shadow` e `--current-control-shadow` concentram sombras de foco/seleção. |
| Espaçamento | Escala-base de 4, 8, 12, 16, 24, 32, 40 e 48 px (`--space-1` a `--space-8`), ampliada até 80 px (`--space-9` a `--space-12`) para grandes intervalos; `--space-half` fica reservado a detalhes de 2 px. |
| Cartões | `--card-padding` define o recuo padrão (24 px), `--card-padding-compact` o recuo móvel fluido (16–24 px) e `--card-content-gap` o intervalo entre blocos internos. A densidade compacta da plataforma pode reduzir esses valores. |
| Botões | `.btn` compartilha altura de 44 px, raio `--button-radius`, intervalo `--button-gap` e recuos `--button-padding-inline*`; `.sm`, `.large` e `.block` mudam somente tamanho ou largura. |
| Listas | `.list` é a estrutura-base para listas semânticas (`ul`/`ol`): itens independentes têm superfície, borda, raio e respiro próprios, com `--list-gap` entre linhas. `--list-row-gap` separa conteúdo da linha; `--list-row-padding-*` mantém texto e ações afastados das bordas. Dentro de `.grp`, as linhas ficam sem cartões individuais e usam divisórias internas. A densidade compacta reduz o padding vertical por token. |
| Estrutura | `--content-width` define o container compartilhado de 1120 px; `--topbar-height` e `--header-blur` padronizam o cabeçalho público. |
| Raios | `--r-xs` 8, `--r-sm` 12, `--r-control` 16 (controles), `--r-group` 20 (itens agrupados), `--r` 28 (cartões), `--r-large` 36 (destaques de página) e `--r-pill` para indicadores. Nunca escreva raios em px fora deste catálogo. |
| Tipografia | `--text-2xs` 11, `--text-xs` 12, `--text-meta` 13, `--text-sm` 14, `--text-md` 15, `--text-base` 16, `--text-lg` 18, `--text-xl` 20, `--text-title` 22, `--text-2xl` 24, `--text-3xl` 28; fluidos: `--text-page-title`, `--text-hero`, `--text-display`, `--text-section`, `--text-heading`. Use `--text-hero` apenas para a saudação do Início; títulos de outras rotas mantêm a escala de página. Nunca escreva tamanhos em rem/px (exceção: o 16 px da raiz e o `max(16px, …)` dos campos). |
| Controles | `--control-sm` 40, `--control-md` 44 (alvo de toque), `--control-field` 48 (campos), `--control-lg` 52. Elementos densos de calendário e gráfico (36 px ou menos) ficam fora desta escala. |
| Texto sobre cor sólida | `--on-solid` (círculos de hábito, selos e cores de área). |
| Elevação | Cartões podem usar a elevação discreta `--card-shadow`; listas e grupos mantêm borda e superfície sem sombras. `--shadow` é reservado a camadas flutuantes como diálogos e toasts. |
| Listas e diálogos | Linhas de listas usam `--list-row-border`, `--list-row-radius` e `--list-row-surface`; o hover usa `--list-row-hover` e `--list-row-hover-border`. Diálogos compartilham `--dialog-padding` e `--dialog-padding-compact`, além do mesmo cabeçalho, botão de fechar e rodapé de ações. |

## Onde fica cada coisa

| Arquivo (`src/css/design-system/`) | Conteúdo |
| --- | --- |
| `tokens.css` | Fonte única de todos os tokens e dos temas claro, escuro e de contraste. |
| `buttons.css` (fechar) | Todo "X" de diálogo ou painel é `ibtn dlg-close` (40×40, raio `--r-sm`, canto superior direito do cabeçalho). Botões de texto que fecham são `btn back`: "Cancelar" em formulários e "Fechar" em diálogos só de leitura. |
| `touch.css` | Camada compartilhada próxima ao fim: destaques de rota com a superfície `--hero`, áreas de toque ampliadas, hierarquia do Início, pulo ao concluir, calendário anual, erro junto ao campo (`.field-err`), indicador do item ativo na barra e separação dos cartões no tema escuro. Vem depois das folhas de área; rotas isoladas podem ter ajustes próprios depois dela. |
| `cards.css` | `.card` e variações, além de `.shortcut-grid` e `.shortcut-card` para links compactos de navegação. Use `.shortcut-card--wide` quando um destino precisar ocupar a linha inteira em grades largas. |
| `lists.css` | `.list` e linhas-base independentes, com espaço, superfície, borda e hover compartilhados. `.grp .list` é a variante agrupada com divisórias, ajustada em `components/task-actions.css`. |
| `buttons.css` | `.btn` (primário, padrão, `.back`, fantasma, perigo; `.sm`, `.large`, `.block`) e `.ibtn`/`.iconbtn`. Tamanho, recuo, raio e intervalo seguem tokens compartilhados; o hover eleva o controle, e estados desabilitados não recebem elevação. |
| `components/tasks.css` e `pages/habits.css` | Conteúdo e interações de tarefas e hábitos; as listas de hábitos preservam a grade do controle de conclusão e reutilizam os tokens de espaçamento e aparência de linha. |
| `fields.css` e `fields-skin.css` | Rótulo, input, select, textarea, checkbox, grade de formulário e campos compostos. A aparência final (`fields-skin.css`) vem depois dos estilos de página de propósito. `select` mantém o menu nativo do navegador. |
| `selectors.css` | Abas, `.chip` e `.seg` para navegação, filtros e alternâncias rápidas; não substituem campos de escolha em formulários. |
| `feedback.css` | `.badge` e `.empty`. |

A ordem dos imports em `src/css/main.css` é parte do desenho: estilos-base de campos entram cedo para que as páginas possam ajustá-los, e a aparência final entra tarde. Cartões, diálogos, navegação e páginas continuam em `components/` e `pages/`, mas usam os mesmos tokens.

## Regras para novos estilos

1. Use tokens: tamanho de fonte (`--text-*`), raio (`--r-*`), altura de controle (`--control-*`), espaço (`--space-*`, `--card-*`, `--button-*`, `--list-*`) e cor (`--accent`, `--ink`, `--on-solid` etc.).
2. Reutilize `.list` para itens independentes e `.grp` para itens relacionados que compartilham um único contorno; use `<ul>`/`<ol>` e preserve a ordem e semântica dos dados.
3. Reutilize `.btn`, `.ibtn`, `.chip`, `.seg`, `.badge`, `.empty` e os campos; ajuste a posição por contexto (`.meu-bloco .btn { flex: 1 }`), não a aparência.
4. Use `.card` para conteúdo agrupado; mantenha distância entre blocos com o espaço interno do componente, sem margens avulsas nos filhos. Para destinos de navegação que precisam de título e descrição, use `.shortcut-grid` e `.shortcut-card`; o link inteiro deve ser clicável, com foco visível e sem controles interativos aninhados.
5. Um hábito novo de visual vira token aqui antes de se espalhar pelas telas.
6. Rode `tests/design-system-check.html` por HTTP (Vite ou servidor estático): ele lê as folhas CSS originais, reprova tamanhos de fonte, raios, alturas e brancos soltos, e qualquer `var(--token)` inexistente.
7. Confira o resultado em `docs/design-system.html` nos temas claro e escuro.

## Tipografia e layout

- Corpo: DM Sans variável com fallback do sistema em 16 px, entrelinha 1,5; os controles mantêm pelo menos 16 px para evitar zoom automático em celulares.
- Títulos: escala fluida para H1; H2 e H3 usam níveis descendentes, sem competir com o título da página.
- Texto secundário: 14 px; detalhes e metadados: 12 px, sem usar tamanhos pequenos para instruções essenciais.
- A interface usa minúsculas como identidade; a marca é sempre `aurora`. Preserve a caixa de nomes próprios, marcas externas e conteúdo digitado (`.proper-name`, `.user-value`, `.ttl`, `.tgx`, `.expense-name`, `.bank-logo`). Para siglas, formatos e unidades com caixa significativa, use `.case-preserve` no trecho exato; não aplique a exceção à frase inteira.
- A aplicação limita a moldura a 1200 px e o conteúdo de leitura a 880 px. A navegação principal fica no cabeçalho em telas largas e fixa no rodapé em telas estreitas.
- A largura móvel respeita áreas seguras do dispositivo. Grades devem usar colunas mínimas flexíveis e permitir quebra de valores longos; listas e abas podem rolar horizontalmente apenas dentro do próprio controle.

## Componentes e estados

- **Ações:** `.btn` padroniza altura, recuo, raio e espaço entre ícone e texto; controles de ícone têm alvo mínimo próximo a 44 px. Ações primárias são preenchidas, secundárias usam superfície e borda, e ações destrutivas usam a cor de erro com texto explícito.
- **Atalhos compactos:** `.shortcut-grid` agrupa links relacionados em duas colunas largas e uma coluna estreita. `.shortcut-card` mantém ícone decorativo, título, descrição e indicador de navegação; `.shortcut-card--wide` permite uma linha completa em grades largas. O cartão inteiro é o link, com estado de foco visível e sem botões internos.
- **Campos:** rótulos persistentes acima dos controles, altura mínima de 48 px, borda visível e estado de foco evidente. `select` permanece nativo, usa a mesma superfície, tipografia, borda, raio e foco dos demais campos, com indicador de abertura derivado do token de texto secundário. A variante compacta dentro de `.mini` conserva o agrupamento visual e uma área de interação próxima de 44 px. Hover e desabilitado têm estados próprios; `aria-invalid="true"` destaca o limite sem substituir mensagem de erro. Valores fechados longos podem ser truncados sem alargar o formulário.
- **Padrão de seleção em formulário:** use `<label class="f">` com um rótulo visível e um `<select>` nativo para escolhas únicas. Se a pessoa precisa escolher, comece com uma opção vazia, desabilitada e selecionada (por exemplo, “Selecione uma frequência”) e use valores explícitos nas opções; não use `placeholder` no `select`. Para indisponibilidade, aplique `disabled`. Para erro, combine `aria-invalid="true"` com uma mensagem textual associada por `aria-describedby` (e `role="alert"` quando o erro precisar ser anunciado imediatamente). Preserve teclado e menu nativos; não crie dropdown customizado. A página `docs/design-system.html` demonstra estados padrão, desabilitado e inválido.
- **Cartões e listas:** cartões usam recuo interno e intervalo entre conteúdos padronizados por tokens, além da mesma superfície opaca, borda sutil e elevação discreta em todas as áreas; destaques de página recebem apenas um leve tom da paleta. Para links de navegação com texto de apoio, use o padrão compacto documentado acima em vez de improvisar um cartão menor. `.list` separa itens em linhas com superfície própria e respiro; `.grp .list` usa divisórias internas sem cartões individuais. Listas interativas de áreas podem ajustar a disposição interna, mas preservam os tokens compartilhados.
- **Linhas de lista:** tarefas, hábitos, lançamentos, cartões financeiros e notificações compartilham a borda, o raio e a superfície definidos pelos tokens `--list-row-*`. O espaçamento e a disposição do conteúdo podem variar para preservar densidade e ações específicas da área; agrupamentos `.grp` continuam usando divisórias internas.
- **Estado vazio:** `.empty` tem uma única definição em `design-system/feedback.css`; as telas podem ajustar o contexto e o conteúdo, sem redefinir a estrutura visual global. Inclua ícone, orientação útil e uma ação de continuidade quando houver um próximo passo claro.
- **Landing pública:** use o degradê `--hero-home` no hero, capturas de tela reais com moldura simples e CTA principal de cadastro. Cards de recursos usam `.card`; preserve os controles públicos de tema e as respostas do FAQ, que devem refletir as decisões atuais do produto.
- **Opções de configuração:** `.setting-toggle` padroniza caixas de seleção com texto, descrição, superfície e foco visível; `.settings-options` agrupa várias opções com espaçamento consistente. Ambos usam tokens de tema e paleta, e também respeitam a densidade compacta.
- **Abas e filtros:** chips e controles segmentados são para filtros e alternâncias rápidas; a seleção é indicada por estado semântico (`aria-selected` ou `aria-pressed`) e por contraste/indicador visual, além da cor. Para campos de formulário com escolha única, use o padrão de `<select>` nativo acima.
- **Navegação:** telas largas exibem a marca, destinos principais e controles no cabeçalho superior; áreas opcionais ativadas também ficam visíveis na navegação. Ajustes e perfil têm acesso pelo cabeçalho. Em telas estreitas, a barra fixa do rodapé mantém Início e Planejar; entre 481 e 899 px ela flutua com os quatro cantos arredondados e rótulos de ao menos 12 px; até 480 px fica colada à borda inferior.
- **Diálogos e notificações:** diálogos usam cabeçalho e botão de fechar compartilhados, superfície elevada, conteúdo rolável e rodapé de ações separado; `--dialog-padding` e `--dialog-padding-compact` mantêm o recuo consistente entre desktop e celular. Ao fechar, o foco retorna ao controle que abriu o diálogo, mesmo quando a tela foi renderizada novamente. Variantes destrutivas, de tarefa e onboarding podem ajustar largura, conteúdo e ênfase sem substituir a estrutura comum. A central de notificações abre pelo sino na navegação (desktop) ou no cabeçalho (celular), mostra lembretes ativos e mantém ações acessíveis; avisos (toasts) são uma pílula compacta de uma linha (40–44 px), centralizada logo acima da barra inferior no celular e a 28 px do rodapé no desktop; cores invertidas (escuro no tema claro, claro no escuro) para manter o contraste sem faixa lateral nem sombra pesada; ícone pequeno na cor do tipo, texto de 14 px sem quebra de linha, "Desfazer" como link sublinhado, barra de tempo de 3 px, 5 s de duração (9 s com "Desfazer"). O rótulo do tipo fica só para leitores de tela. Com diálogo ou menu "Mais" aberto, o aviso sobe para o topo (`.toast-top`) para não cobrir os botões de baixo.
- **Estados vazios e carregamento:** conservar a explicação e a próxima ação no estado vazio; quando possível, oferecer uma ação contextual direta e um ícone decorativo maior. Indicadores de progresso devem manter texto ou valores acessíveis; gráficos devem ter rótulos que expliquem período e medida, limitar barras a 520 px e preservar proporções legíveis.
- **Foco e movimento:** `:focus-visible` tem contorno de alto destaque também em datas e chips selecionados. Mudanças de rota e conclusão de tarefa têm transições breves; a preferência por movimento reduzido desativa animações e transições não essenciais.
- **Escala de texto:** metadados e rótulos de gráficos devem usar unidades relativas à raiz para acompanhar os níveis de fonte do aplicativo; texto essencial não fica abaixo de 12 px no tamanho padrão.
- **Opções de `select`:** o campo fechado é estilizado pelo Aurora, mas o menu aberto e as opções seguem o navegador/sistema operacional para preservar o comportamento nativo de teclado e toque; não se promete aparência idêntica entre plataformas.

## Aplicação por área

- **Início:** a saudação ocupa a primeira faixa visual com o degradê rosa-ameixa; tarefas de hoje e áreas opcionais vêm juntas na faixa seguinte, lado a lado em telas largas. Os atalhos não competem com a saudação nem ganham uma segunda moldura de cartão. Chips de área usam cores semânticas, ações têm foco e hover visíveis, e o resumo não substitui a lista de tarefas.
- **Planejar e Foco:** filtros e tarefas favorecem leitura e execução. No modo Foco, o cronômetro ganha escala visual e progresso circular; as notificações sinalizam o início da pausa sem som ou pausa automática, enquanto meta, matérias e histórico permanecem em segundo plano.
- **Finanças:** saldo e totais são separados dos lançamentos e relatórios; valores usam algarismos tabulares e podem quebrar sem provocar rolagem horizontal. Negativos exibem o sinal e também descrevem o saldo ou tipo de lançamento em seu rótulo acessível, sem depender só da cor. Gráficos de rosca mantêm pequenos vãos entre categorias para distinguir segmentos.
- **Academia e Ciclo:** Academia combina indicadores e registros; Ciclo agrupa seleção de data, sintomas e calendário sem misturar estimativas com registros. Água é uma sugestão de hábito comum, sem componentes próprios.
- **Perfil e Ajustes:** Perfil abre com um resumo pessoal e organiza identidade, apelido, dados opcionais e ciclo numa grade que se adapta à largura; Ajustes mantém formulários agrupados por assunto. Controles destrutivos permanecem numa zona identificável e exigem confirmação existente.

## Verificação e limites

O sistema define regras para os temas claro e escuro, que são escolhidos manualmente; a aparência também depende da paleta escolhida pela pessoa e dos dados locais. Contraste, quebra de conteúdo, foco de teclado e fluxos de diálogo precisam ser verificados nos dois temas e em larguras móveis e desktop antes de declarar conformidade.

O alvo desta implementação é a aplicação modular iniciada por `index.html`, incluindo as entradas de rota em `pages/`.
