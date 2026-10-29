# Publicação no Cloudflare Pages

## Build

Configure o projeto do Pages com a raiz do repositório, o comando
`npm run build` e a pasta de saída `dist/`. O build inclui os arquivos
estáticos necessários para servir a SPA e suas rotas.

## Variáveis de ambiente

O app local usa `VITE_SUPABASE_LOCAL_URL` e
`VITE_SUPABASE_LOCAL_ANON_KEY` em `.env.local`, apontando para `aurora-dev`.
No Cloudflare Pages, configure as mesmas variáveis de build em cada ambiente:

| Ambiente do Pages | Projeto Supabase | Variáveis |
|---|---|---|
| Preview | `aurora-dev` | `VITE_SUPABASE_PRODUCTION_URL`, `VITE_SUPABASE_PRODUCTION_ANON_KEY` |
| Production | `aurora-prod` | `VITE_SUPABASE_PRODUCTION_URL`, `VITE_SUPABASE_PRODUCTION_ANON_KEY` |

O nome `PRODUCTION` nas variáveis também é usado em Preview: ambos são builds
de produção do Vite, e o Cloudflare injeta valores diferentes conforme o
ambiente do Pages. Assim, o Preview e o app local usam `aurora-dev`, enquanto o
site publicado usa `aurora-prod`, que preserva os dados existentes. Como a
unicidade de e-mail vale dentro de cada projeto Supabase, o mesmo endereço pode
ter uma conta em cada ambiente.

As variáveis antigas `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` podem ser
mantidas temporariamente para compatibilidade com deployments criados antes da
separação. Remova-as somente depois de publicar uma versão que use os nomes
novos.

As chaves anon/publishable são valores públicos destinados ao cliente; políticas
RLS continuam obrigatórias. Nunca use chaves `service_role`, `sb_secret_*`,
senhas ou chaves privadas em variáveis `VITE_*`.

Configure também as URLs de redirecionamento no Supabase para cada origem
publicada e para os ambientes de desenvolvimento necessários.
Alterações de variáveis só entram em vigor no próximo build/deploy do Pages.

## Banco e autenticação

Antes de liberar o app, revise e aplique as migrations de
[`supabase/migrations/`](../supabase/migrations/) na ordem. Execute os testes de
isolamento descritos em [`supabase/README.md`](../supabase/README.md) em um
ambiente adequado. Testes locais de build não verificam login, RLS nem
gravações remotas.

## Worker de Push opcional

O Worker não é publicado pelo build do Pages. Implante-o separadamente conforme
[`pomodoro-push.md`](./pomodoro-push.md) e configure seus secrets diretamente no
ambiente do Worker. Não inclua secrets no repositório, no `wrangler.toml`, em
variáveis `VITE_*` ou no bundle do frontend.

## Verificação após publicar

- Abra a entrada principal e as rotas diretas.
- Confirme o carregamento de CSS, JavaScript, manifest e service worker.
- Teste login e gravação com uma conta de teste, quando Supabase estiver
  configurado.
- Verifique HTTPS, cabeçalhos, console e navegação em larguras móveis e desktop.
