# Publicação no Cloudflare Pages

## Build

Configure o projeto do Pages com a raiz do repositório, o comando
`npm run build` e a pasta de saída `dist/`. O build inclui os arquivos
estáticos necessários para servir a SPA e suas rotas.

## Variáveis de ambiente

Configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` nos ambientes em que
login e dados de conta serão usados. São valores públicos destinados ao cliente;
políticas RLS continuam obrigatórias. Nunca use chaves `service_role`,
`sb_secret_*`, senhas ou chaves privadas em variáveis `VITE_*`.

Configure também as URLs de redirecionamento no Supabase para cada origem
publicada e para os ambientes de desenvolvimento necessários.

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
