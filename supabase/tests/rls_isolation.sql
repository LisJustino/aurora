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
    'finance_transactions', 'finance_budgets', 'finance_goals', 'finance_recurrences',
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
