# Decisões técnicas

## D-001 — Manter SPA e compartilhar a casca

As rotas existentes são telas dentro de um shell compartilhado; recriar navegação, estado e modais em vários documentos criaria duplicação. `pages/*.html` são entradas de rota leves que configuram a primeira tela via `meta[name="aurora-route"]`; a aplicação continua com navegação por hash.

## D-002 — Foco é visualização de Planejar

Foco e o cronômetro são uma ferramenta, não uma nova seção de planejamento. O alias legado `#estudos` e a entrada `pages/estudos.html` preservam acessibilidade sem migrar dados.

## D-003 — CSS particionado na ordem anterior

Os estilos foram separados por grupos contíguos e responsabilidade. `src/css/main.css` importa a ordem anterior dos blocos, pois a cascata existente tem overrides posteriores. Uma reorganização semântica mais agressiva deve ser medida e testada separadamente.

## D-004 — Extração gradual de JavaScript

Datas, moeda, DOM seguro, IDs, roteamento, acesso ao perfil e cálculos financeiros têm módulos próprios. `main.js` ainda é o ponto de composição e concentra templates/eventos; a extração completa será feita feature por feature para preservar a ordem de inicialização e o acesso ao estado.

## D-005 — Persistência local compatível

Preservam-se os nomes de chaves `aurora.app.*`, o envelope `{v,t}` e as versões de backup 1 e 2. Os dados pessoais continuam locais; não há autenticação de conta, sincronização de dados ou conexão bancária. A exceção limitada de Push está descrita em D-011.

## D-006 — Design system em `src/css/design-system/`

Tokens e componentes-base (botões, campos, seletores, selos, estado vazio) saíram de `controls.css`, `preferences.css`, `visual-refresh.css` e dos blocos `:root` duplicados para uma pasta própria. Valores soltos de fonte, raio e altura foram trocados por tokens. A reorganização foi medida (pelo padrão de D-003) comparando capturas de todas as telas, nos temas claro e escuro e em 390 e 1280 px, antes e depois. `tests/design-system-check.html` impede a volta dos valores soltos.

## D-007 — Pausas e pulos de hábitos são neutros

Um dia explicitamente pulado, ou um dia programado durante uma pausa, não conta como check-in nem como falha para metas, relatórios e sequências. A pausa registra as datas e os dias da semana originalmente programados; os dados de conclusão existentes permanecem intactos. Reflexões semanais são opcionais, locais e compatíveis com o envelope e as versões atuais de backup.

## D-008 — Lixeira local com retenção de 30 dias

Exclusões de registros recuperáveis movem o valor original e sua posição para `settings.prefs.trash`, junto com as alterações na fatia de origem em uma transação de armazenamento com rollback. A restauração não sobrescreve registros criados depois da exclusão; relações financeiras exigem que as contas vinculadas existam. A expiração é automática após 30 dias. A lixeira segue nos backups atuais sem trocar chaves nem versões; “Apagar todos os dados” continua sendo uma ação explicitamente permanente.

## D-007 — Aplicação local, sem sincronização de dados

O Aurora não oferece conta, sincronização remota de dados ou integração com Google Calendar. Os registros pessoais permanecem no navegador; exportação, restauração e recuperação são recursos locais e continuam disponíveis em Ajustes. O backend opcional de D-011 recebe somente os dados mínimos para notificações Push do Pomodoro.

## D-009 — Perfil mínimo antes do uso

Antes de usar a plataforma, a pessoa deve informar um nome e selecionar uma opção de identidade de gênero. “Prefiro não informar” é uma escolha válida; idade e peso continuam opcionais. A interface chama o campo de identidade de gênero, não solicita orientação sexual e mantém o campo/códigos legados para compatibilidade dos dados e backups.

## D-010 — Informação educativa na área do ciclo

A área do Ciclo pode apresentar orientação geral sobre variações menstruais, saúde sexual e sinais para buscar atendimento, com links para fontes de saúde. O conteúdo não diagnostica, não substitui avaliação profissional e não transforma estimativas do ciclo em método contraceptivo. A pessoa pode optar por registrar atividade sexual e métodos contraceptivos no diário do ciclo. Esses dados sensíveis permanecem locais, podem entrar nos backups escolhidos pela pessoa e não são enviados a serviços externos.

## D-011 — Push opcional e mínimo para o Pomodoro independente

O site continua estático no GitHub Pages e os dados da aplicação permanecem locais. A exceção explicitamente aprovada para notificações fora do app usa um Cloudflare Worker com Durable Object e Web Push compatível com Web Crypto. A inscrição exige gesto/permissão explícitos; o backend recebe somente a inscrição necessária, credencial-capacidade por instalação e fase/horário/durações do Pomodoro independente. Não transmite tarefa, perfil, histórico ou outras fatias. Alarmes avançam as fases enquanto o timer estiver rodando e são cancelados ao pausar, concluir, descartar ou desativar. CORS permite apenas origens HTTPS configuradas, e entradas, horizonte e frequência são limitados.
