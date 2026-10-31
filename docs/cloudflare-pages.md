# Publicação no Cloudflare Pages

## Build

Configure o projeto do Pages com a raiz do repositório, o comando
`npm run build` e a pasta de saída `dist/`. O build inclui os arquivos
estáticos necessários para servir a SPA e suas rotas.

## Variáveis de ambiente

O app local usa `VITE_SUPABASE_LOCAL_URL` e
`VITE_SUPABASE_LOCAL_ANON_KEY` em `.env.local`, apontando para `aurora-dev`.
No Cloudflare Pages, configure variáveis de build diferentes para cada
ambiente:

| Ambiente do Pages | Projeto Supabase | Variáveis |
|---|---|---|
| Preview | `aurora-dev` | `VITE_SUPABASE_TARGET=development`, `VITE_SUPABASE_PREVIEW_URL`, `VITE_SUPABASE_PREVIEW_ANON_KEY` |
| Production | `aurora-prod` | `VITE_SUPABASE_TARGET=production`, `VITE_SUPABASE_PRODUCTION_URL`, `VITE_SUPABASE_PRODUCTION_ANON_KEY` |

Defina as variáveis em **Settings → Environment variables**, nos escopos
Preview e Production correspondentes, e faça um novo deploy após salvar.
Preview e produção são builds de produção do Vite; por isso, o target explícito
seleciona o projeto. O app local usa somente as variáveis `LOCAL` e
`aurora-dev`. Além do target, o cliente confere o project ref esperado: Preview
aceita somente `cltymialatksylhzsitz` e Production somente
`xeneztudcqdumfhwotry`. Se o target estiver ausente ou a URL pertencer ao outro
projeto, a autenticação falha fechada, sem acessar nenhum banco. Como cada
projeto Supabase mantém seu próprio conjunto de usuários, o mesmo e-mail pode
ter uma conta em `aurora-dev` e outra em `aurora-prod`.

Não configure a URL ou a chave de `aurora-prod` no escopo Preview, nem as de
`aurora-dev` no escopo Production. Após ajustar as variáveis, publique um novo
deploy Preview e outro Production e confirme o target antes de testar login ou
cadastro.

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

## Checklist antes de ampliar a divulgação

Não considere o site pronto para divulgação ampla até concluir e registrar estes
itens:

- **Revisão dos documentos:** obtenha revisão jurídica dos Termos e da Política
  de Privacidade, especialmente sobre dados de ciclo/saúde e financeiros,
  operadores e região de hospedagem, retenção, exclusão, backups e Push. A
  revisão técnica do repositório não substitui essa validação.
- **Configuração de produção:** confirme no projeto Supabase de produção a
  autoconfirmação de novos cadastros, as URLs de retorno permitidas, a região,
  as políticas RLS e a publicação/configuração da Edge Function de exclusão.
  A configuração de desenvolvimento não comprova a de produção.
- **Fluxos com conta de teste:** em Preview e, depois, em Production, valide
  cadastro, login, recuperação de senha, leitura/gravação após recarregar e
  exclusão definitiva usando somente contas e dados fictícios. Não faça
  testes destrutivos em contas reais.
- **Entrega e acessibilidade:** confira a landing e a demonstração em mobile e
  desktop, navegação por teclado, links dos documentos, rotas diretas, erros no
  console, cabeçalhos, links quebrados e os arquivos do PWA. Registre problemas
  conhecidos antes de divulgar.
- **Analytics:** métricas comportamentais estão adiadas. Não adicionar scripts
  ou eventos de terceiros por enquanto; qualquer adoção futura exige revisar a
  Política de Privacidade, a CSP e o fluxo de aceite antes de publicar.

Os documentos legais ainda registram pendências de revisão e confirmação
operacional. Esses itens não são cobertos pelo build local nem pelos testes
automatizados.
