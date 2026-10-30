# Aurora

Aurora é uma aplicação web responsiva de organização pessoal. A interface usa HTML, CSS próprio e JavaScript em módulos ES; Vite é usado apenas para empacotar a SPA, sem React ou TypeScript.

## Executar

No PowerShell, na raiz do repositório, instale as dependências e crie o arquivo local de ambiente:

```powershell
npm install
Copy-Item .env.example .env.local
```

Abra `.env.local` e substitua os valores vazios pelos dados públicos em Supabase → Project Settings → API / API Keys:

```dotenv
VITE_SUPABASE_LOCAL_URL=https://SEU-PROJETO-DE-TESTE.supabase.co
VITE_SUPABASE_LOCAL_ANON_KEY=SUA_CHAVE_PUBLICA_ANON_OU_PUBLISHABLE
```

Use um projeto Supabase de desenvolvimento/teste separado do projeto de produção. Assim, o mesmo e-mail pode ter uma conta em cada projeto. Use somente a Project URL e a chave pública anon/publishable; não use `service_role` ou chaves secretas. O `.gitignore` exclui `.env.local`; nunca compartilhe seu conteúdo.

Depois, ainda na raiz do projeto, inicie o servidor de desenvolvimento:

```powershell
npm run dev
```

Deixe esse terminal aberto e acesse a URL que o Vite mostrar, normalmente **`http://localhost:5173/`**, sem acrescentar `#landing` ao endereço. Se reiniciar o servidor ou alterar arquivos do frontend, atualize também o navegador com `Ctrl+Shift+R` para descarregar uma cópia antiga em cache. Se a porta 5173 estiver ocupada, o Vite escolhe outra livre, como 5174; use a URL exibida no terminal. Não inicie outro servidor se já houver um Vite ativo: use a URL dele ou pare-o no terminal original com `Ctrl+C` antes de iniciar novamente. Reinicie o Vite depois de editar `.env.local`, pois as variáveis são lidas ao iniciar. Hashes como `#planejar` são rotas internas protegidas. Não use `python -m http.server`, Live Server ou abra o `index.html` diretamente: eles não resolvem os módulos do app. `VITE_SUPABASE_LOCAL_URL` e `VITE_SUPABASE_LOCAL_ANON_KEY` são necessárias para entrar ou criar conta localmente; a landing e a demonstração fictícia funcionam sem elas.

`npm run build` gera o site em `dist/`; `npm run preview` serve esse build localmente.

A aplicação apresenta a landing e uma demonstração interativa com dados fictícios. Marcar um hábito, iniciar o cronômetro e concluir a tarefa de exemplo alteram somente o estado em memória da demonstração; nada é enviado pela rede ou gravado no navegador. É necessário entrar ou criar conta para acessar dados pessoais. A conta usa Supabase Auth e Postgres relacional, com RLS por usuário. O Worker de avisos Push é opcional e separado. Consulte [docs/cloudflare-pages.md](./docs/cloudflare-pages.md) para instruções de publicação.

### Testar no Android pela rede Wi-Fi

Com o celular e o computador na mesma rede Wi-Fi, inicie o Vite na raiz do projeto. Ele é necessário para resolver os módulos npm usados pelo app:

```powershell
npm run dev -- --host 0.0.0.0 --port 8765
```

No Windows, execute `ipconfig` e anote o endereço IPv4 da conexão Wi-Fi (por exemplo, `192.168.1.10`). No Chrome do celular, abra `http://ENDERECO-IP:8765/`, substituindo pelo endereço encontrado. Se o Windows perguntar, permita o acesso do Node.js em redes privadas. Se a página não abrir, confira se os dois aparelhos continuam na mesma rede e se o firewall permite a conexão. Um servidor estático como `python -m http.server` não serve o código-fonte do app corretamente.

Os dados da conta são carregados e gravados no Supabase; fora da sessão gerenciada pelo supabase-js, o app não mantém cópia persistente dos dados no navegador. A importação dos dados legados é uma ação explícita em Ajustes → Dados e backup. Por padrão, a sessão de autenticação usa `sessionStorage`; se você marcar **Manter conectado**, somente a sessão do Supabase fica em `localStorage` neste dispositivo. Dados do app nunca são gravados no armazenamento local do navegador. Para testar conta em celular, use HTTPS e URLs de retorno permitidas no painel.

## Páginas e navegação

- `index.html` é a entrada canônica.
- `pages/` contém entradas HTML leves com metadados específicos para abrir cada rota da SPA, sem cópias da navegação ou da lógica.
- As páginas compartilham o mesmo aplicativo e a mesma conta online. A navegação interna continua usando hashes (`#planejar`, `#financas` etc.).
- Pomodoro é a única ferramenta de foco e pode ser usada para qualquer atividade. Não há área de Estudos, cadastro de matérias ou registro de sessões. Backups que contenham os dados removidos não são aceitos; as exclusões locais e do Supabase são efetivadas, respectivamente, ao entrar na aplicação e ao aplicar a migration `20261029050000_remove_studies.sql`.
- O conteúdo interativo das telas é composto em `src/js/main.js`. As entradas em `pages/` não são páginas HTML estáticas independentes.

## Organização do código

- `src/css/design-system/`: tokens e componentes-base (botões, campos, seletores, selos, estado vazio). Veja `docs/design-system.md` e abra `docs/design-system.html` para a referência visual.
- `src/css/base.css`, `layout.css` e `main.css`: tokens, regras base, estrutura e ponto de entrada dos estilos.
- `src/css/components/`: estilos reutilizáveis e ajustes responsivos. Os imports em `main.css` preservam a ordem original para evitar regressões de cascata.
- `src/css/pages/`: estilos específicos para Início, Aurora e Finanças.
- `src/js/main.js`: composição atual da aplicação, estado da interface, templates dinâmicos, eventos e inicialização.
- `src/js/core/`: resolução de rotas e regras de acesso ao perfil.
- `src/js/features/finance/calculations.js`: cálculos financeiros sem manipulação de DOM.
- `src/js/data/`: cliente Supabase singleton e camada de acesso relacional; `src/js/services/` contém autenticação, Push e busca determinística.
- `supabase/migrations/`: migrations versionadas do schema relacional e políticas RLS por usuário; aplique conforme [supabase/README.md](./supabase/README.md).
- `src/js/utils/`: templates HTML escapados, moeda, datas e IDs.
- `docs/`: arquitetura, estrutura, modelo de dados, testes e decisões.

Consulte [docs/project-structure.md](./docs/project-structure.md) antes de adicionar uma rota ou feature, [docs/architecture.md](./docs/architecture.md) para os contratos atuais e [docs/design-system.md](./docs/design-system.md) para os tokens e regras visuais.

## Funcionalidades

Início, tarefas, Planejar, Pomodoro independente, revisão semanal com reflexão opcional, perfil e ajustes; lixeira com retenção de 30 dias; áreas opcionais de Finanças, Hábitos, Academia e Ciclo; sugestão de água como hábito comum, pausas e dias pulados neutros; busca local; backup/restauração; tema claro/escuro e layout responsivo. Consulte [docs/data-model.md](./docs/data-model.md) para os dados persistidos.

## Dados e privacidade

O app exige login antes de exibir ou alterar dados, mas novos cadastros não precisam confirmar o e-mail para entrar. Desative **Confirm email** no provedor Email de cada projeto Supabase. Sem essa confirmação, um endereço digitado incorretamente pode impedir a recuperação da conta. O banco aplica políticas RLS por usuário, sem exigir MFA/AAL2. Os dados relacionais ficam legíveis pelo Postgres. O leitor antigo do cofre permanece somente para a importação explícita; dados e tabelas legados não são apagados automaticamente.

RLS restringe as linhas ao `auth.uid()` da sessão autenticada. Apenas URL do projeto e chave pública Supabase podem estar no build cliente; `service_role`/secret nunca deve ser usada no navegador. Os dados ficam somente em memória durante o uso e no banco, sem cache local de dados. Exceções de persistência no navegador: sessão gerenciada pelo supabase-js; cache do service worker de recursos estáticos; inscrição mantida pelo PushManager do navegador. A credencial do Worker Push é movida para `push_subscriptions`; qualquer chave antiga do Push é migrada quando possível.

Backups exportados e cópias de recuperação são JSON sem criptografia e podem conter dados financeiros e de saúde; proteja os arquivos e confirme antes de exportar.

### Configurar contas Supabase

1. Em cada projeto Supabase, desative **Authentication → Providers → Email → Confirm email** para liberar o acesso imediatamente após o cadastro. Configure também senha mínima de 6 caracteres (igual à regra do formulário do Aurora), nível mínimo de garantia AAL1 e as URLs de redirecionamento desse ambiente. O Aurora não exige MFA. Sem confirmação, um e-mail digitado incorretamente pode impedir a recuperação da conta.
2. Aplique as migrations versionadas na ordem descrita em [supabase/README.md](./supabase/README.md), incluindo a migration que remove a exigência de MFA, depois execute os testes SQL de isolamento.
3. Configure variáveis distintas no Cloudflare Pages: Preview usa `VITE_SUPABASE_TARGET=development` e `VITE_SUPABASE_PREVIEW_*` para `aurora-dev`; Production usa `VITE_SUPABASE_TARGET=production` e `VITE_SUPABASE_PRODUCTION_*` para `aurora-prod`. O app local usa `VITE_SUPABASE_LOCAL_*` em `.env.local`. O app confere o project ref e bloqueia a autenticação se um build apontar ao projeto errado. Veja [docs/cloudflare-pages.md](./docs/cloudflare-pages.md).
4. Em Ajustes → Dados e backup, analise os dados antigos e importe na conta correta. Confira os registros antes de marcar a confirmação para apagar as chaves antigas lidas deste navegador. A importação não apaga `user_data` nem `user_keys`; a remoção do código e das tabelas exige revisão e uma migration separada aprovada.

Antes de publicar, revise a configuração de autenticação, as migrations e as URLs de redirecionamento. Teste o isolamento com contas distintas em um ambiente apropriado.

### Avisos Push opcionais de Pomodoro e Hábitos

Os avisos de mudança de fase e os lembretes de hábitos podem ser ativados explicitamente nas respectivas áreas. Sem ativação, nenhuma permissão é solicitada; o horário de um hábito continua sendo apenas uma preferência para avisos enquanto o app está aberto.

Para publicar o backend separado no Cloudflare e conectar o front do Cloudflare Pages, siga [docs/pomodoro-push.md](./docs/pomodoro-push.md). O deploy requer uma conta Cloudflare, Node.js/npm e configuração manual do endereço da API, da origem CORS e de secrets VAPID. Nenhum segredo deve ser incluído no repositório. As configurações do front estão em [docs/cloudflare-pages.md](./docs/cloudflare-pages.md).

Quando ativado, o Supabase guarda a inscrição Push e a credencial exclusiva desta instalação sob RLS por usuário; o Worker armazena a programação mínima da próxima fase ou os dias, horários e fuso dos lembretes de Hábitos. Nenhum nome de tarefa/hábito, perfil, histórico, dados de outras áreas ou conteúdo do backup é enviado ao Worker. A inscrição é compartilhada neste dispositivo; desativá-la interrompe os avisos de ambos. A entrega depende do navegador, do sistema operacional, da rede e do serviço Push; não é garantida.

Em iPhone, Push requer iOS/iPadOS 16.4 ou posterior e o Aurora instalado na Tela de Início, aberto como PWA independente. A origem precisa ser HTTPS e a permissão deve ser concedida após tocar em **Ativar avisos**. O iOS pode suspender páginas e áudio; Push é uma notificação do sistema, mas a execução/entrega não é um alarme garantido. O som existente do Pomodoro não é garantido com o app em segundo plano ou a tela bloqueada.

## Testes e limitações

Execute `npm test` para a suíte da aplicação e `npm run build` para validar o bundle. O Worker de Push tem testes próprios. Os testes locais não comprovam login, RLS ou gravações no Supabase remoto. Consulte [docs/testing.md](./docs/testing.md) para os comandos e limites de validação.
