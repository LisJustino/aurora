# Deployar avisos Push do Pomodoro

O front do Aurora será hospedado no Cloudflare Pages em `https://aurora-9ze.pages.dev`; um domínio personalizado pode ser conectado depois. Este recurso opcional usa um Cloudflare Worker com Durable Objects e Web Push; não exige nem cria um backend para tarefas, perfil, finanças ou backups. Registros legados de Estudos não participam deste fluxo.

## Pré-requisitos

- Conta Cloudflare com Workers/Durable Objects habilitados e Node.js/npm atuais.
- Site Aurora publicado por HTTPS no Cloudflare Pages.
- Origem pública exata do site: `https://aurora-9ze.pages.dev`; configure-a também na allowlist CORS do Worker. Se adicionar domínio personalizado, atualize a allowlist e publique o Worker novamente.
- Para iPhone/iPad: iOS/iPadOS 16.4 ou posterior.

Este repositório não contém credenciais Cloudflare nem a chave privada VAPID. Não coloque segredos no Git nem em variáveis do GitHub. `VAPID_SUBJECT` deve ser configurado como secret do Worker, embora o contato seja transmitido como metadado VAPID ao serviço Push.

## Configurar e implantar a API

1. Em `worker/`, instale as dependências e crie uma chave VAPID local:

   ```powershell
   cd worker
   npm install
   node scripts/generate-vapid-keys.mjs
   ```

   O gerador cria `worker/.dev.vars`, arquivo local ignorado pelo Git, com a chave pública e a privada. Se o arquivo já existir, o gerador não o substitui. Guarde a chave privada com segurança.

2. Confira `worker/wrangler.toml`:
   - A origem padrão está configurada como `https://aurora-9ze.pages.dev`. Se usar domínio próprio, substitua-a pela origem HTTPS correspondente. Liste várias origens separadas por vírgula somente se realmente forem necessárias; não use `*`, caminho ou barra final.
   - A chave pública é gerada localmente e já está configurada no TOML. Se gerar outra chave, atualize as variáveis pública e local correspondentes.
   - Não declare `VAPID_SUBJECT` no TOML. Configure-o como secret do Worker em produção e desenvolvimento, usando o contato operacional autorizado no formato `mailto:...`.
   - Escolha dois `namespace_id` numéricos livres para os bindings Cloudflare Rate Limiting: `REGISTER_RATE_LIMIT` limita novos registros por endereço de rede e `API_RATE_LIMIT` limita chamadas autenticadas por instalação. Não armazene a chave privada no arquivo TOML.
   - Preserve `ENVIRONMENT = "production"` para o deploy padrão.

3. Crie os secrets do Worker sem colocá-los no histórico de comandos:

   ```powershell
   npx wrangler secret put VAPID_PRIVATE_KEY
   npx wrangler secret put VAPID_SUBJECT
   ```

   Cole o valor de cada secret no prompt do Wrangler. Faça login pelo Wrangler (`npx wrangler login`) se ainda não estiver autenticado. `VAPID_PRIVATE_KEY` pode vir do arquivo local ignorado `worker/.dev.vars`; `VAPID_SUBJECT` deve ser fornecido pelo responsável operacional.

4. Implante o Worker e a Durable Object:

   ```powershell
   npm run deploy
   ```

   O Wrangler informa a URL HTTPS do Worker, normalmente `https://aurora-pomodoro-push.<subdominio>.workers.dev`. A implantação e criação dos recursos Cloudflare são ações manuais; não são realizadas por este repositório.

5. Configure o frontend para usar somente essa API:
   - Em `src/js/services/pomodoro-push-config.js`, defina `POMODORO_PUSH_API_URL` com a URL HTTPS do Worker, sem `/api` no final.
   - Publique a versão atualizada do site no Cloudflare Pages após configurar a URL da API.

   Até esse endereço estar configurado e o Worker publicado, o botão de ativação permanece desabilitado e explica que falta configurar o serviço.

### Desenvolvimento local

Com `worker/.dev.vars` configurado, inicie o Worker em `worker/` com `npm run dev`. Para desenvolvimento com Vite, configure temporariamente a URL local do Worker e mantenha `ALLOWED_ORIGINS = "http://localhost:5173"` no ambiente `development`. O Worker local aceita HTTP apenas nesse ambiente; no deploy, exige origem HTTPS. Solicitar permissão ou ativar uma inscrição local ainda pode enviar avisos reais ao navegador de teste, por isso use um perfil isolado.

## Ativar no app

1. Abra o Aurora publicado no Safari do iPhone/iPad e use **Compartilhar → Adicionar à Tela de Início**. Abra o Aurora pelo ícone instalado, no modo de app independente; uma aba comum do Safari não atende ao requisito de Push no iOS.
2. Abra Pomodoro e toque em **Ativar avisos**. A permissão só é solicitada por esse gesto explícito. Aceite as notificações do sistema.
3. Inicie o timer independente. Cada fase seguinte é programada no Durable Object; pausas, conclusão e descarte cancelam o agendamento. Pular uma pausa atualiza o horário no serviço.
4. Use **Desativar avisos** para remover a inscrição deste dispositivo e cancelar alarmes no backend.

## Privacidade e limites

- A API recebe a inscrição Push, uma credencial aleatória por instalação e somente a fase, a hora prevista da transição, as durações do Pomodoro e a contagem necessária para a pausa longa. O servidor guarda apenas o hash da credencial.
- Tarefas, rótulos, perfil, histórico, dados financeiros, demais fatias e backups não são transmitidos ao Worker. A credencial do cliente fica em `push_subscriptions`, protegida por RLS por usuário. A antiga chave `aurora.push.pomodoro` só é lida para migrar uma inscrição existente e removida após a confirmação da gravação no banco.
- A Durable Object conserva uma inscrição e um alarme por instalação; cada transição agenda a seguinte apenas enquanto o timer estiver rodando. O horizonte de cada solicitação é limitado a quatro horas. Os bindings Cloudflare Rate Limiting limitam registro e solicitações autenticadas sem armazenar dados extras no objeto.
- CORS exige uma origem configurada exatamente; a API não aceita credenciais de cookies. O endpoint de Push precisa usar HTTPS e um domínio de serviço conhecido. As entradas JSON têm tamanho e formato limitados.
- O service worker mostra notificação do sistema somente se nenhuma janela do Aurora estiver visível. O app visível mantém seus próprios avisos e não recebe uma notificação de sistema duplicada.
- O aceite da API significa que uma fase foi agendada, não que o sistema operacional entregará a notificação. Rede, navegador, permissão, políticas do Push Service e economia de energia podem atrasar ou impedir a entrega. Se uma chamada de cancelamento falhar, a interface avisa que um aviso previamente agendado ainda pode chegar.
- Notificações Push não garantem som nem permitem que o Aurora imponha o volume, o som ou o comportamento de foco. O som de Pomodoro já existente depende de áudio no navegador e não é confiável com o app em segundo plano/tela bloqueada.

## Testes

- `npm test` em `worker/` valida CORS, limite de registro, credencial, entradas, horizonte e avanço/cancelamento dos alarmes sem acessar uma conta Cloudflare.
- A aplicação local é iniciada por `npm run dev` (Vite). Consulte [testing.md](./testing.md) para os comandos e limites de validação.
- A integração real de entrega, instalação na Tela de Início, permissão e som precisam ser verificadas depois do deploy, em dispositivo próprio; os testes de unidade não simulam um Push Service ou iPhone real.
