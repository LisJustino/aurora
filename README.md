# Aurora

Aurora é uma aplicação web responsiva de organização pessoal. A interface veio do artefato preservado em [aurora-legacy.html](./aurora-legacy.html); a aplicação executável usa HTML, CSS e JavaScript em arquivos separados, sem framework ou processo de build.

## Executar

Use um servidor HTTP estático a partir da raiz do projeto. Com Python:

```powershell
python -m http.server 8765
```

Abra `http://localhost:8765/`. O projeto também pode ser servido pelo Live Server do VS Code. Não abra os módulos ES diretamente por `file://`, pois os navegadores restringem imports nesse modo.

A aplicação principal continua sem framework, build, conta ou backend para os dados pessoais. O serviço de avisos Push é opcional e separado: o site permanece estático no GitHub Pages; um Cloudflare Worker com Durable Object recebe apenas a inscrição Push e os horários/fases necessários ao Pomodoro.

### Testar no Android pela rede Wi-Fi

Com o celular e o computador na mesma rede Wi-Fi, inicie o servidor na raiz do projeto:

```powershell
python -m http.server 8765 --bind 0.0.0.0
```

No Windows, execute `ipconfig` e anote o endereço IPv4 da conexão Wi-Fi (por exemplo, `192.168.1.10`). No Chrome do celular, abra `http://ENDERECO-IP:8765/`, substituindo pelo endereço encontrado. Se o Windows perguntar, permita o acesso do Python em redes privadas. Se a página não abrir, confira se os dois aparelhos continuam na mesma rede e se o firewall permite a conexão.

Os dados ficam no armazenamento local do navegador do celular e são independentes dos dados no computador ou em outro navegador. Esse acesso HTTP pela rede funciona para testar enquanto o servidor e o computador estiverem ligados, mas não permite instalar o Aurora como PWA offline; para isso, a origem precisa usar HTTPS. Não use uma rede Wi-Fi pública para esse teste.

## Páginas e navegação

- `index.html` é a entrada canônica.
- `pages/` contém entradas HTML leves com metadados específicos para abrir cada rota da SPA, sem cópias da navegação ou da lógica.
- As páginas compartilham o mesmo aplicativo e o mesmo armazenamento local. A navegação interna continua usando hashes (`#planejar`, `#financas` etc.).
- Foco é uma área opcional dentro de Planejar, com cronômetro, matérias e histórico. `pages/foco.html` e `pages/estudos.html` são atalhos de entrada para essa visualização; Estudos não é uma lista de tarefas.
- O conteúdo interativo das telas ainda é renderizado por `src/js/main.js`. As entradas em `pages/` não são páginas HTML estáticas independentes; a extração dos templates de tela é uma etapa futura.

## Organização do código

- `src/css/design-system/`: tokens e componentes-base (botões, campos, seletores, selos, estado vazio). Veja `docs/design-system.md` e abra `docs/design-system.html` para a referência visual.
- `src/css/base.css`, `layout.css` e `main.css`: tokens, regras base, estrutura e ponto de entrada dos estilos.
- `src/css/components/`: estilos reutilizáveis e ajustes responsivos. Os imports em `main.css` preservam a ordem original para evitar regressões de cascata.
- `src/css/pages/`: estilos específicos para Início, Aurora e Finanças.
- `src/js/main.js`: composição atual da aplicação, estado da interface, templates dinâmicos, eventos e inicialização.
- `src/js/core/`: resolução de rotas e regras de acesso ao perfil.
- `src/js/features/finance/calculations.js`: cálculos financeiros sem manipulação de DOM.
- `src/js/services/`: armazenamento local e busca determinística; `pomodoro-push.js` integra, de forma opcional, o timer independente ao Worker externo sem acessar as fatias locais.
- `src/js/utils/`: templates HTML escapados, moeda, datas e IDs.
- `docs/`: arquitetura, estrutura, modelo de dados, testes e decisões.
- As skills pessoais do Aurora para o VS Code ficam em `~/.copilot/skills/`, fora deste repositório; um workspace multi-root local permite visualizá-las junto com o projeto.
- `CLAUDE.md`: instruções gerais para agentes que trabalham neste repositório.

Consulte [docs/project-structure.md](./docs/project-structure.md) antes de adicionar uma rota ou feature, [docs/architecture.md](./docs/architecture.md) para os contratos atuais e [docs/design-system.md](./docs/design-system.md) para os tokens e regras visuais.

## Funcionalidades

Início, tarefas, Planejar/Foco, revisão semanal com reflexão opcional, perfil e ajustes; lixeira local de 30 dias; áreas opcionais de Finanças, Hábitos, Água, Academia e Ciclo; pausas e dias pulados neutros nos hábitos; assistente com busca local; backup/restauração; tema claro/escuro e layout responsivo. Consulte [docs/data-model.md](./docs/data-model.md) para os dados que de fato são persistidos.

## Dados e privacidade

O estado principal fica no `localStorage` deste navegador, sob chaves `aurora.app.*`. O backup e a restauração são manuais. A aplicação não sincroniza tarefas, finanças, perfil ou outros dados pessoais com servidor nem conecta contas bancárias. A configuração local do perfil não é autenticação.

### Avisos Push opcionais do Pomodoro

Os avisos de mudança de fase podem ser ativados explicitamente na tela do Pomodoro. A função é exclusiva do timer independente; não altera o cronômetro de Estudos. Sem ativação, o timer continua local e nenhuma permissão é solicitada.

Para publicar o backend separado no Cloudflare e conectar o site estático do GitHub Pages, siga [docs/pomodoro-push.md](./docs/pomodoro-push.md). O deploy requer uma conta Cloudflare, Node.js/npm e configuração manual do endereço da API, da origem CORS e de uma chave VAPID privada. Nenhuma credencial é incluída no repositório.

Quando ativado, o Cloudflare armazena a inscrição Push, um hash da credencial exclusiva desta instalação e a fase/horário da próxima mudança; a Durable Object agenda os próximos alarmes enquanto o timer estiver rodando. Nenhum nome de tarefa, perfil, histórico, dados de outras áreas ou conteúdo do backup é enviado. O temporizador e os registros originais permanecem locais. A entrega depende do navegador, do sistema operacional, da rede e do serviço Push; não é garantida.

Em iPhone, Push requer iOS/iPadOS 16.4 ou posterior e o Aurora instalado na Tela de Início, aberto como PWA independente. A origem precisa ser HTTPS e a permissão deve ser concedida após tocar em **Ativar avisos**. O iOS pode suspender páginas e áudio; Push é uma notificação do sistema, mas a execução/entrega não é um alarme garantido. O som existente do Pomodoro não é garantido com o app em segundo plano ou a tela bloqueada.

## Testes e limitações

A aplicação web não usa bundler ou dependências npm. A suíte principal roda no navegador em `/tests/`; a implantação opcional do Worker tem dependências Node/npm próprias em `worker/` e testes com `npm test`. Não há lint configurado. Consulte [docs/testing.md](./docs/testing.md) para comandos, resultados reproduzíveis e limitações conhecidas.

## Referência do produto

A experiência financeira segue princípios gerais de clareza e hierarquia. Não foi possível confirmar as telas atuais do aplicativo Minhas Finanças no ambiente utilizado; nenhuma tela ou marca foi copiada.
