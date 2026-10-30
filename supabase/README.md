# Supabase

## Migrations

As migrations SQL ficam em `supabase/migrations/`. Elas criam e atualizam as tabelas relacionais, compatibilidade de IDs, lixeira, RPCs e políticas RLS. A migration de remoção de Estudos apaga as fatias cifradas e os registros relacionais dedicados à função; `user_keys` e as demais fatias são preservadas.

Use projetos Supabase separados para desenvolvimento/teste e produção. O app local usa `VITE_SUPABASE_LOCAL_URL` e `VITE_SUPABASE_LOCAL_ANON_KEY`; Preview do Cloudflare usa `VITE_SUPABASE_TARGET=development` com `VITE_SUPABASE_PREVIEW_URL` e `VITE_SUPABASE_PREVIEW_ANON_KEY`; Production usa `VITE_SUPABASE_TARGET=production` com `VITE_SUPABASE_PRODUCTION_URL` e `VITE_SUPABASE_PRODUCTION_ANON_KEY`. O cliente rejeita qualquer URL Supabase cujo project ref não corresponda ao ambiente esperado. A unicidade de e-mail vale dentro de cada projeto, permitindo o mesmo e-mail nos dois ambientes. Aplique e valide as migrations separadamente em cada projeto, confirmando o destino antes de executar qualquer operação.

Para permitir acesso imediato após o cadastro, em cada projeto abra **Authentication → Providers → Email** e desative **Confirm email**. Com essa opção ativa, o Supabase cria a conta sem emitir uma sessão e a pessoa não consegue entrar até confirmar o endereço; o app informa essa configuração e mantém reenvio para cadastros pendentes. Sem confirmação obrigatória, um e-mail digitado incorretamente pode impedir a recuperação da conta.

## Entrar com Google (Gmail)

O botão social disponível no Aurora usa Google OAuth pelo Supabase. Configure-o separadamente em cada projeto Supabase de desenvolvimento e produção; as credenciais do provedor ficam somente no Dashboard do Supabase, nunca no `.env`, no frontend ou no repositório. Apple/iCloud está temporariamente desativado na interface; contas Apple existentes continuam reconhecidas.

1. Em **Authentication → URL Configuration**, defina o **Site URL** do projeto de desenvolvimento como `http://127.0.0.1:5173/` e, em produção, como `https://aurora-9ze.pages.dev/`. Permita estes **Redirect URLs** no projeto de desenvolvimento:
   - `http://localhost:5173/`
   - `http://127.0.0.1:5173/`
   - `http://localhost:5173/**`
   - `http://127.0.0.1:5173/**`
   Em produção, permita somente os redirects exatos `https://aurora-9ze.pages.dev/` e `https://aurora-9ze.pages.dev/#inicio`. O app retorna a `/#inicio` após o OAuth para abrir a área autenticada, em vez da landing pública. Não cadastre endereços de produção no projeto de desenvolvimento nem vice-versa.
2. Para **Google (Gmail)**, crie um cliente OAuth do tipo **Web application** no Google Cloud Console. Em **Authorized JavaScript origins**, adicione `http://localhost:5173`, `http://127.0.0.1:5173` e `https://aurora-9ze.pages.dev`. Em **Authorized redirect URIs**, adicione o callback de cada projeto Supabase: desenvolvimento `https://cltymialatksylhzsitz.supabase.co/auth/v1/callback` e produção `https://xeneztudcqdumfhwotry.supabase.co/auth/v1/callback`. Ative o provedor em **Authentication → Sign In / Providers → Google** em cada projeto Supabase e informe o Client ID e o Client Secret do Google.
3. Em **Authentication → Sign In / Providers → Google**, habilite Google nos projetos em que será usado e salve as credenciais. No primeiro acesso social, o fluxo exige nome, nome de preferência, idade mínima de 18 anos e aceite dos documentos; o Aurora não abre os dados da conta antes disso.
4. Teste o fluxo local com o projeto de desenvolvimento e a URL `http://127.0.0.1:5173/#inicio`; depois teste produção em `https://aurora-9ze.pages.dev/#inicio`. Na primeira autenticação Google, o provedor cria uma conta Supabase quando ainda não existe uma identidade correspondente; o Aurora então exige nome, nome de preferência, idade mínima de 18 anos e aceite dos documentos antes de carregar os dados. Segredos OAuth devem ser inseridos somente no Dashboard Supabase. As variáveis `VITE_SUPABASE_*` continuam sendo apenas a URL do projeto e sua chave publicável.

Apple/iCloud está pausado e não precisa ser configurado para novos logins. A configuração existente no Supabase, se houver, pode permanecer; o Aurora não inicia autenticação Apple até o recurso ser reativado.

Antes de aplicar em produção:

1. Confirme que há backup do projeto e que a migration foi revisada.
2. No Supabase Dashboard, abra **SQL Editor → New query** e aplique, na ordem do nome, `20261028180000_initial_relational_schema.sql`, `20261028190000_relational_persistence.sql`, `20261028200000_remove_mfa_requirement.sql`, `20261029000000_signup_profile_metadata.sql`, `20261029021000_relational_upsert_conflict_target.sql`, `20261029030000_finance_settled_date.sql`, `20261029040000_trash_cycle_collection.sql`, `20261029050000_remove_studies.sql` e `20261030100000_relational_version_conflict.sql`. A migration de remoção é destrutiva: apaga matérias, sessões, o timer legado de Estudos e registros de lixeira associados, além das fatias cifradas dedicadas; faça backup e revise antes de aplicá-la. A última migration atualiza a RPC de gravação para rejeitar versões desatualizadas e devolver as versões confirmadas. Execute no projeto correto. Não crie tabelas manualmente pelo painel. Em projetos que já aplicaram migrations anteriores, aplique apenas as pendentes na ordem correta.
3. Em **Table Editor**, confirme as tabelas, colunas, índices e que RLS está habilitado em cada tabela criada. Confirme também as RPCs `apply_relational_changes` (retorna `jsonb` com as versões salvas) e `clear_relational_data`.
4. Execute `supabase/tests/rls_isolation.sql` no SQL Editor. O script cria usuários fictícios com domínios `.invalid` dentro de uma transação e termina com `ROLLBACK`; ele não usa nem apaga contas reais.
5. Guarde o nome/versão da migration aplicada no registro operacional do projeto. Esta execução manual pelo SQL Editor não atualiza automaticamente o histórico local do Supabase CLI.

Para fluxo local/CI com histórico versionado e CLI, instale o Supabase CLI conforme a documentação oficial, inicialize a configuração se ainda não existir, vincule o projeto pretendido e aplique com `supabase db push`. Revise sempre o plano antes de confirmar; nunca aplique uma migration de desenvolvimento apontando para produção por engano.

## Verificar o schema antigo

Não é possível verificar do repositório se `supabase/schema.sql` foi executado no projeto remoto. No painel, abra **Database → Tables**, procure `user_data` e `user_keys` no schema `public` e confira a aba **Policies** de cada tabela. A presença dessas tabelas não prova, por si só, que todo o arquivo foi aplicado. No **SQL Editor**, confira também as funções `has_authenticated_user`, `import_user_slices` e `replace_user_slices` e compare-as com `supabase/schema.sql`.

Não execute de novo nem remova esse schema durante esta etapa. As migrations relacionais e a remoção de Estudos não são aplicadas automaticamente ao projeto remoto. Aplique a migration nova somente após revisar o destino e criar backup. O schema inclui allowlists sem as fatias removidas. Em **Authentication → Settings**, mantenha o nível mínimo de garantia em AAL1; a interface e as políticas RLS não exigem TOTP. Fatores existentes não são removidos pela migration.

## Segurança e modelo

Todas as tabelas com dados de conta são privadas, têm RLS e políticas separadas de leitura, inserção, atualização e exclusão. As operações exigem correspondência do `user_id` com a sessão autenticada; não exigem AAL2/TOTP. As tabelas não concedem acesso a `anon` nem `public`. O arquivo `tests/rls_isolation.sql` valida acesso próprio com AAL1 e rejeita leitura, inserção, atualização e exclusão cruzadas. A função de gravação usa `SECURITY INVOKER`, allowlist de tabelas e RLS; não usa service_role. As gravações incrementais comparam `updated_at` à versão lida, serializam alterações do mesmo usuário/tabela e retornam novas versões; conflitos pedem recarga em vez de sobrescrever silenciosamente.

## Exclusão de conta após recusa dos termos

`supabase/functions/delete-account/` contém a Edge Function invocada depois que uma pessoa autenticada recusa os documentos atualizados e confirma digitando `EXCLUIR`. A função valida o JWT com `auth.getUser`, consulta apenas as credenciais Push da própria conta, solicita a remoção remota de cada inscrição e só então exclui definitivamente o usuário via Admin API (sem soft delete). As referências `ON DELETE CASCADE` removem os registros relacionais, `user_data` e `user_keys` associados. Após a confirmação da exclusão, o mesmo e-mail pode criar uma conta nova: ela recebe outro ID e não restaura dados da conta anterior. Se a limpeza Push ou a exclusão Admin não for confirmada, a resposta é erro e a interface não afirma que a conta foi apagada.

Para configurar e publicar manualmente, com o Supabase CLI instalado e vinculado ao projeto correto:

1. Confirme que o Worker de Push está publicado e que sua allowlist `ALLOWED_ORIGINS` inclui exatamente a origem de produção do Aurora.
2. Defina `ALLOWED_ORIGINS` no ambiente da Edge Function com as origens HTTPS exatas da aplicação, separadas por vírgula e sem barra final. Defina `POMODORO_PUSH_API_URL` como a URL HTTPS base do Worker, sem `/api`. No projeto vinculado, por exemplo: `supabase secrets set ALLOWED_ORIGINS=https://SEU-SITE.example POMODORO_PUSH_API_URL=https://SEU-WORKER.workers.dev`.
3. Use as variáveis de projeto fornecidas pelo Supabase (`SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY`); nunca coloque a service-role key no frontend, em arquivos versionados ou em logs. A função usa essa chave somente no servidor para consultar as credenciais e excluir o usuário autenticado.
4. Publique manualmente com `supabase functions deploy delete-account`. Não use `--no-verify-jwt`; o gateway deve exigir JWT e a função valida novamente o usuário.
5. Teste primeiro num projeto Supabase isolado com uma conta fictícia e uma inscrição Push de teste. Confirme tanto a exclusão concluída quanto a falha de limpeza sem exclusão. Não teste com conta real.

O repositório não publica a função, define secrets nem altera projetos Supabase remotos automaticamente. Se não houver inscrição Push associada, a URL do Worker não é necessária para processar a exclusão.

## Entidades relacionais

- Conta: `profiles` (nome, identidade, idade, peso, altura, fuso, tema e aparência) e `user_settings` (preferências e áreas habilitadas).
- Planejamento: `task_lists`, `tags`, `tasks`, `subtasks`, `task_tag_assignments` e `weekly_reflections`.
- Foco: `timer_state` (somente Pomodoro) e `pomodoro_daily_stats`.
- Hábitos e bem-estar: `habits`, `habit_logs`, `water_logs`, `gym_templates`, `gym_template_exercises`, `gym_logs`, `cycle_periods`, `cycle_days` e `weight_logs`.
- Finanças: `finance_accounts`, `finance_transactions`, `finance_budgets`, `finance_goals` e `finance_recurrences`; todos os valores monetários são centavos inteiros.
- Push: `push_subscriptions`, protegida pelo mesmo isolamento de usuário.

Datas civis (por exemplo, vencimentos e registros diários) são `date`; instantes são `timestamptz`. Tabelas de conteúdo têm `is_test_data`; registros recuperáveis usam `deleted_at`. Listas de dias e seleções categóricas usam arrays de tipos nativos; `jsonb` fica restrito a aparência e preferências realmente configuráveis.
