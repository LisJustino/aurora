begin;

do $$
declare
  trigger_source text;
begin
  select pg_get_functiondef(p.oid)
  into trigger_source
  from pg_proc as p
  join pg_namespace as n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'create_profile_for_new_user';

  if trigger_source is null or trigger_source not ilike '%preferred_name%'
    or trigger_source not ilike '%metadata_sex%' then
    raise exception
      'Execute 20261029000000_signup_profile_metadata.sql antes de rls_isolation.sql';
  end if;
end;
$$;

do $$
declare
  table_name text;
  relation_oid oid;
  has_rls boolean;
  policy_count integer;
  user_tables constant text[] := array[
    'profiles', 'user_settings', 'task_lists', 'tags', 'tasks', 'subtasks',
    'task_tag_assignments', 'weekly_reflections',
    'timer_state', 'pomodoro_daily_stats', 'habits', 'habit_logs', 'water_logs',
    'gym_templates', 'gym_template_exercises', 'gym_logs', 'finance_accounts',
    'finance_recurrences', 'finance_transactions', 'finance_budgets', 'finance_goals',
    'cycle_periods', 'cycle_days', 'weight_logs', 'push_subscriptions', 'trash_records'
  ];
begin
  foreach table_name in array user_tables loop
    select c.oid, c.relrowsecurity
    into relation_oid, has_rls
    from pg_class as c
    join pg_namespace as n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = table_name;

    if relation_oid is null or not has_rls then
      raise exception 'RLS is not enabled on public.%', table_name;
    end if;

    select count(*) into policy_count
    from pg_policies
    where schemaname = 'public'
      and tablename = table_name
      and cmd in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
      and 'authenticated' = any(roles)
      and not (roles && array['public', 'anon']::name[]);
    if policy_count <> 4 then
      raise exception 'Expected four private CRUD policies on public.%; found %', table_name, policy_count;
    end if;

    if exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = table_name
        and roles && array['public', 'anon']::name[]
    ) then
      raise exception 'A public or anon policy exists on public.%', table_name;
    end if;
  end loop;
end;
$$;

do $$
declare
  table_name text;
  has_rls boolean;
  has_force_rls boolean;
  policy_count integer;
  command_count integer;
begin
  foreach table_name in array array['user_data', 'user_keys'] loop
    select c.relrowsecurity, c.relforcerowsecurity
    into has_rls, has_force_rls
    from pg_class as c
    join pg_namespace as n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = table_name;

    if has_rls is distinct from true or has_force_rls is distinct from true then
      raise exception 'RLS and FORCE RLS must be enabled on public.%', table_name;
    end if;

    select count(*) into policy_count
    from pg_policies
    where schemaname = 'public'
      and tablename = table_name
      and 'authenticated' = any(roles);
    select count(distinct cmd) into command_count
    from pg_policies
    where schemaname = 'public'
      and tablename = table_name
      and 'authenticated' = any(roles);
    if policy_count <> (case when table_name = 'user_data' then 4 else 2 end)
      or command_count <> (case when table_name = 'user_data' then 4 else 2 end) then
      raise exception 'Unexpected authenticated policy count on public.%: %', table_name, policy_count;
    end if;

    if exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = table_name
        and roles && array['public', 'anon']::name[]
    ) then
      raise exception 'A public or anon policy exists on public.%', table_name;
    end if;
  end loop;
end;
$$;

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    'd7c0d0e7-fb7a-4a3f-9f72-151d6768a101',
    'authenticated', 'authenticated', 'rls-user-a@example.invalid', '',
    now(), '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Pessoa Exemplo","preferred_name":"Exemplo","sex":"nb","age":25}'::jsonb, now(), now()
  ),
  (
    'd7c0d0e7-fb7a-4a3f-9f72-151d6768a102',
    'authenticated', 'authenticated', 'rls-user-b@example.invalid', '',
    now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    'd7c0d0e7-fb7a-4a3f-9f72-151d6768a103',
    'authenticated', 'authenticated', 'rls-user-c@example.invalid', '',
    now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.user_keys (
  user_id, key_version, salt, password_wrap, recovery_wrap
)
values
  (
    'd7c0d0e7-fb7a-4a3f-9f72-151d6768a101', 1, repeat('A', 22),
    '{"iv":"AAAAAAAAAAAAAAAA","ciphertext":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"}'::jsonb,
    '{"iv":"AAAAAAAAAAAAAAAA","ciphertext":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"}'::jsonb
  ),
  (
    'd7c0d0e7-fb7a-4a3f-9f72-151d6768a102', 1, repeat('B', 22),
    '{"iv":"BBBBBBBBBBBBBBBB","ciphertext":"BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB"}'::jsonb,
    '{"iv":"BBBBBBBBBBBBBBBB","ciphertext":"BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB"}'::jsonb
  );

insert into public.user_data (user_id, slice, data)
values
  (
    'd7c0d0e7-fb7a-4a3f-9f72-151d6768a101', 'tasks',
    '{"v":"1","iv":"AAAAAAAAAAAAAAAA","ciphertext":"AAAAAAAAAAAAAAAAAAAAAA"}'::jsonb
  ),
  (
    'd7c0d0e7-fb7a-4a3f-9f72-151d6768a102', 'tasks',
    '{"v":"1","iv":"BBBBBBBBBBBBBBBB","ciphertext":"BBBBBBBBBBBBBBBBBBBBBB"}'::jsonb
  );

do $$
declare
  profile_count integer;
begin
  select count(*) into profile_count
  from public.profiles
  where user_id in (
    'd7c0d0e7-fb7a-4a3f-9f72-151d6768a101',
    'd7c0d0e7-fb7a-4a3f-9f72-151d6768a102'
  );
  if profile_count <> 2 then
    raise exception 'The signup trigger must create both profiles; got %', profile_count;
  end if;
end;
$$;

do $$
declare
  profile_record record;
begin
  select display_name, preferred_name, sex, age
  into profile_record
  from public.profiles
  where user_id = 'd7c0d0e7-fb7a-4a3f-9f72-151d6768a101';
  if profile_record.display_name <> 'Pessoa Exemplo'
    or profile_record.preferred_name <> 'Exemplo'
    or profile_record.sex <> 'nb'
    or profile_record.age <> 25 then
    raise exception 'The signup trigger must copy validated profile metadata';
  end if;
end;
$$;

reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

do $$
begin
  begin
    perform count(*) from public.user_keys;
    raise exception 'Anonymous users read user_keys';
  exception
    when insufficient_privilege then null;
  end;

  begin
    insert into public.user_keys (
      user_id, key_version, salt, password_wrap, recovery_wrap
    )
    values (
      'd7c0d0e7-fb7a-4a3f-9f72-151d6768a103', 1, repeat('C', 22),
      '{"iv":"CCCCCCCCCCCCCCCC","ciphertext":"CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC"}'::jsonb,
      '{"iv":"CCCCCCCCCCCCCCCC","ciphertext":"CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC"}'::jsonb
    );
    raise exception 'Anonymous users inserted user_keys';
  exception
    when insufficient_privilege then null;
  end;

  begin
    perform count(*) from public.user_data;
    raise exception 'Anonymous users read user_data';
  exception
    when insufficient_privilege then null;
  end;

  begin
    insert into public.user_data (user_id, slice, data)
    values (
      'd7c0d0e7-fb7a-4a3f-9f72-151d6768a101', 'tasks',
      '{"v":"1","iv":"CCCCCCCCCCCCCCCC","ciphertext":"CCCCCCCCCCCCCCCCCCCCCC"}'::jsonb
    );
    raise exception 'Anonymous users inserted user_data';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

reset role;

insert into public.tasks (id, user_id, title)
values
  ('e7c0d0e7-fb7a-4a3f-9f72-151d6768a101', 'd7c0d0e7-fb7a-4a3f-9f72-151d6768a101', 'Tarefa isolada A'),
  ('e7c0d0e7-fb7a-4a3f-9f72-151d6768a102', 'd7c0d0e7-fb7a-4a3f-9f72-151d6768a102', 'Tarefa isolada B');

do $$
begin
  begin
    insert into public.trash_records (
      user_id, legacy_id, entry_legacy_id, collection, record_key,
      record_index, label, entity_table, removed_at
    )
    values (
      'd7c0d0e7-fb7a-4a3f-9f72-151d6768a101',
      'invalid-collection', 'invalid-entry', 'invalid', '{}',
      0, 'Inválido', 'tasks', now()
    );
    raise exception 'The trash collection constraint accepted an invalid value';
  exception
    when check_violation then null;
  end;

  begin
    insert into public.trash_records (
      user_id, legacy_id, entry_legacy_id, collection, record_key,
      record_index, label, entity_table, removed_at
    )
    values (
      'd7c0d0e7-fb7a-4a3f-9f72-151d6768a101',
      'invalid-table', 'invalid-entry', 'tasks', '{}',
      0, 'Inválido', 'invalid_table', now()
    );
    raise exception 'The trash entity constraint accepted an invalid value';
  exception
    when check_violation then null;
  end;
end;
$$;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"d7c0d0e7-fb7a-4a3f-9f72-151d6768a101","role":"authenticated","aal":"aal2","amr":[{"method":"totp"}]}',
  true
);

do $$
declare
  visible_count integer;
  affected_rows integer;
begin
  select count(*) into visible_count from public.user_keys;
  if visible_count <> 1 then
    raise exception 'User A must see exactly its own vault key; got %', visible_count;
  end if;

  select count(*) into visible_count
  from public.user_keys
  where user_id = 'd7c0d0e7-fb7a-4a3f-9f72-151d6768a102';
  if visible_count <> 0 then
    raise exception 'User A read User B vault key';
  end if;

  select count(*) into visible_count from public.user_data;
  if visible_count <> 1 then
    raise exception 'User A must see exactly its own legacy data; got %', visible_count;
  end if;

  select count(*) into visible_count
  from public.user_data
  where user_id = 'd7c0d0e7-fb7a-4a3f-9f72-151d6768a102';
  if visible_count <> 0 then
    raise exception 'User A read User B legacy data';
  end if;

  update public.user_data
  set data = '{"v":"1","iv":"CCCCCCCCCCCCCCCC","ciphertext":"CCCCCCCCCCCCCCCCCCCCCC"}'::jsonb
  where user_id = 'd7c0d0e7-fb7a-4a3f-9f72-151d6768a102';
  get diagnostics affected_rows = row_count;
  if affected_rows <> 0 then
    raise exception 'User A updated User B legacy data';
  end if;

  delete from public.user_data
  where user_id = 'd7c0d0e7-fb7a-4a3f-9f72-151d6768a102';
  get diagnostics affected_rows = row_count;
  if affected_rows <> 0 then
    raise exception 'User A deleted User B legacy data';
  end if;

  begin
    insert into public.user_keys (
      user_id, key_version, salt, password_wrap, recovery_wrap
    )
    values (
      'd7c0d0e7-fb7a-4a3f-9f72-151d6768a103', 1, repeat('C', 22),
      '{"iv":"CCCCCCCCCCCCCCCC","ciphertext":"CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC"}'::jsonb,
      '{"iv":"CCCCCCCCCCCCCCCC","ciphertext":"CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC"}'::jsonb
    );
    raise exception 'User A inserted User B vault key';
  exception
    when insufficient_privilege then null;
  end;

  begin
    insert into public.user_data (user_id, slice, data)
    values (
      'd7c0d0e7-fb7a-4a3f-9f72-151d6768a103', 'tasks',
      '{"v":"1","iv":"CCCCCCCCCCCCCCCC","ciphertext":"CCCCCCCCCCCCCCCCCCCCCC"}'::jsonb
    );
    raise exception 'User A inserted User B legacy data';
  exception
    when insufficient_privilege then null;
  end;

  select count(*) into visible_count from public.tasks;
  if visible_count <> 1 then
    raise exception 'User A must see exactly its own task; got %', visible_count;
  end if;

  update public.tasks
  set title = 'Tentativa de alteração cruzada'
  where id = 'e7c0d0e7-fb7a-4a3f-9f72-151d6768a102';
  get diagnostics affected_rows = row_count;
  if affected_rows <> 0 then
    raise exception 'User A updated User B task';
  end if;

  delete from public.tasks
  where id = 'e7c0d0e7-fb7a-4a3f-9f72-151d6768a102';
  get diagnostics affected_rows = row_count;
  if affected_rows <> 0 then
    raise exception 'User A deleted User B task';
  end if;

  begin
    insert into public.tasks (user_id, title)
    values ('d7c0d0e7-fb7a-4a3f-9f72-151d6768a102', 'Tentativa de inserção cruzada');
    raise exception 'User A inserted a row for User B';
  exception
    when insufficient_privilege then null;
  end;

  insert into public.trash_records (
    user_id, legacy_id, entry_legacy_id, collection, record_key,
    record_index, label, entity_table, removed_at
  )
  values (
    'd7c0d0e7-fb7a-4a3f-9f72-151d6768a101',
    'valid-trash-a', 'valid-entry-a', 'cycle', '{}',
    0, 'Registro válido A', 'cycle_periods', now()
  );

  begin
    insert into public.trash_records (
      user_id, legacy_id, entry_legacy_id, collection, record_key,
      record_index, label, entity_table, removed_at
    )
    values (
      'd7c0d0e7-fb7a-4a3f-9f72-151d6768a102',
      'cross-trash-a', 'cross-entry-a', 'tasks', '{}',
      0, 'Tentativa cruzada', 'tasks', now()
    );
    raise exception 'User A inserted trash for User B';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

do $$
declare
  target_id constant uuid := 'e7c0d0e7-fb7a-4a3f-9f72-151d6768a101';
  stale_updated_at timestamptz;
  error_message text;
begin
  select updated_at
  into stale_updated_at
  from public.tasks
  where id = target_id;

  if stale_updated_at is null then
    raise exception 'The concurrency regression task is missing';
  end if;

  update public.tasks
  set title = 'Tarefa atualizada por outra sessão'
  where id = target_id;

  begin
    perform public.apply_relational_changes(jsonb_build_array(jsonb_build_object(
      'table', 'tasks',
      'rows', '[]'::jsonb,
      'expected_versions', jsonb_build_array(jsonb_build_object(
        'id', target_id,
        'expected_updated_at', stale_updated_at
      )),
      'replace_missing', false
    )));
    raise exception 'The relational apply function accepted a stale version';
  exception
    when others then
      get stacked diagnostics error_message = message_text;
      if error_message not like 'version_conflict:%' then
        raise;
      end if;
  end;
end;
$$;

select set_config(
  'request.jwt.claims',
  '{"sub":"d7c0d0e7-fb7a-4a3f-9f72-151d6768a102","role":"authenticated","aal":"aal2","amr":[{"method":"totp"}]}',
  true
);

do $$
declare
  visible_count integer;
begin
  select count(*) into visible_count from public.tasks;
  if visible_count <> 1 then
    raise exception 'User B must see exactly its own task; got %', visible_count;
  end if;
end;
$$;

do $$
declare
  function_source text;
begin
  select pg_get_functiondef(p.oid)
  into function_source
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'apply_relational_changes';

  if function_source is null or function_source !~* 'version_conflict|updated_at.*target\.updated_at' then
    raise exception 'The relational apply function must reject stale rows with a version-conflict error';
  end if;
end;
$$;

select set_config(
  'request.jwt.claims',
  '{"sub":"d7c0d0e7-fb7a-4a3f-9f72-151d6768a101","role":"authenticated","aal":"aal1","amr":[{"method":"password"}]}',
  true
);

do $$
declare
  visible_count integer;
begin
  select count(*) into visible_count from public.tasks;
  if visible_count <> 1 then
    raise exception 'Authenticated AAL1 user must see its own task; got % rows', visible_count;
  end if;
end;
$$;

rollback;
