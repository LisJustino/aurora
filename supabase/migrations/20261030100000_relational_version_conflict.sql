begin;

drop function if exists public.apply_relational_changes(jsonb);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := greatest(clock_timestamp(), old.updated_at + interval '1 microsecond');
  return new;
end;
$$;

create function public.apply_relational_changes(p_changes jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  change jsonb;
  table_name text;
  version_column text;
  column_list text;
  selected_columns text;
  update_list text;
  conflict_target text;
  rows_value jsonb;
  row_value jsonb;
  version_value jsonb;
  current_updated_at timestamptz;
  expected_updated_at timestamptz;
  changed_versions jsonb;
  deleted_versions jsonb;
  table_versions jsonb;
  result jsonb := '[]'::jsonb;
  replace_missing boolean;
  table_allowlist constant text[] := array[
    'profiles', 'user_settings', 'task_lists', 'tags', 'tasks', 'subtasks',
    'task_tag_assignments', 'weekly_reflections',
    'timer_state', 'pomodoro_daily_stats', 'habits', 'habit_logs', 'water_logs',
    'gym_templates', 'gym_template_exercises', 'gym_logs', 'finance_accounts',
    'finance_transactions', 'finance_budgets', 'finance_goals', 'finance_recurrences',
    'cycle_periods', 'cycle_days', 'weight_logs', 'push_subscriptions', 'trash_records'
  ];
begin
  if not public.has_totp_aal2() then
    raise exception 'Uma sessão autenticada é obrigatória';
  end if;
  if jsonb_typeof(p_changes) <> 'array' or octet_length(p_changes::text) > 10000000 then
    raise exception 'Formato ou tamanho de gravação inválido';
  end if;

  for change in select value from jsonb_array_elements(p_changes)
  loop
    table_name := change ->> 'table';
    rows_value := change -> 'rows';
    if not table_name = any(table_allowlist)
      or jsonb_typeof(rows_value) <> 'array'
      or (change ? 'expected_versions' and jsonb_typeof(change -> 'expected_versions') <> 'array')
      or (change ? 'replace_missing' and jsonb_typeof(change -> 'replace_missing') <> 'boolean') then
      raise exception 'Tabela ou lote de gravação inválido';
    end if;

    conflict_target := case
      when table_name in ('profiles', 'user_settings') then 'user_id'
      else 'id'
    end;
    version_column := conflict_target;
    replace_missing := coalesce((change ->> 'replace_missing')::boolean, true);
    perform pg_advisory_xact_lock(hashtextextended(
      table_name || ':' || auth.uid()::text,
      0
    ));

    select
      string_agg(format('%I', attribute.attname), ', ' order by attribute.attnum),
      string_agg(format('(record_value).%I', attribute.attname), ', ' order by attribute.attnum),
      string_agg(
        format('%1$I = excluded.%1$I', attribute.attname),
        ', ' order by attribute.attnum
      ) filter (where attribute.attname not in ('id', 'created_at', 'updated_at'))
    into column_list, selected_columns, update_list
    from pg_catalog.pg_attribute as attribute
    where attribute.attrelid = format('public.%I', table_name)::regclass
      and attribute.attnum > 0
      and not attribute.attisdropped
      and attribute.attname not in ('created_at', 'updated_at');

    for version_value in
      select value
      from jsonb_array_elements(coalesce(change -> 'expected_versions', '[]'::jsonb))
    loop
      expected_updated_at := nullif(version_value ->> 'expected_updated_at', '')::timestamptz;
      perform pg_advisory_xact_lock(hashtextextended(
        table_name || ':' || (version_value ->> version_column),
        0
      ));
      execute format(
        'select target.updated_at from public.%I target where target.%I = ($1 ->> %L)::uuid for update',
        table_name,
        version_column,
        version_column
      )
      into current_updated_at
      using version_value;

      if current_updated_at is distinct from expected_updated_at then
        raise exception using
          errcode = 'P0001',
          message = 'version_conflict: A linha foi atualizada em outro dispositivo. Recarregue os dados da conta e tente novamente.';
      end if;
    end loop;

    for row_value in select value from jsonb_array_elements(rows_value)
    loop
      if row_value ? 'expected_updated_at' then
        expected_updated_at := nullif(row_value ->> 'expected_updated_at', '')::timestamptz;
        perform pg_advisory_xact_lock(hashtextextended(
          table_name || ':' || (row_value ->> version_column),
          0
        ));
        execute format(
          'select target.updated_at from public.%I target where target.%I = ($1 ->> %L)::uuid for update',
          table_name,
          version_column,
          version_column
        )
        into current_updated_at
        using row_value;

        if current_updated_at is distinct from expected_updated_at then
          raise exception using
            errcode = 'P0001',
            message = 'version_conflict: A linha foi atualizada em outro dispositivo. Recarregue os dados da conta e tente novamente.';
        end if;
      end if;
    end loop;

    if jsonb_array_length(rows_value) > 0 then
      execute format(
        'with saved as (
           insert into public.%I (%s)
           select %s from jsonb_populate_recordset(null::public.%I, $1) as record_value
           on conflict (%I) do update set %s
           returning id, user_id, updated_at
         )
         select coalesce(
           jsonb_agg(jsonb_build_object(''id'', id, ''user_id'', user_id, ''updated_at'', updated_at)),
           ''[]''::jsonb
         ) from saved',
        table_name,
        column_list,
        selected_columns,
        table_name,
        conflict_target,
        update_list
      )
      into changed_versions
      using rows_value;
    else
      changed_versions := '[]'::jsonb;
    end if;

    table_versions := changed_versions;
    if replace_missing and exists (
      select 1
      from pg_catalog.pg_attribute as attribute
      where attribute.attrelid = format('public.%I', table_name)::regclass
        and attribute.attname = 'deleted_at'
        and not attribute.attisdropped
    ) then
      execute format(
        'with deleted as (
           update public.%I target
           set deleted_at = now()
           where target.user_id = (select auth.uid())
             and target.deleted_at is null
             and target.id <> all(coalesce(
               array(select (record_value ->> ''id'')::uuid from jsonb_array_elements($1) as record_value),
               array[]::uuid[]
             ))
           returning target.id, target.user_id, target.updated_at
         )
         select coalesce(
           jsonb_agg(jsonb_build_object(''id'', id, ''user_id'', user_id, ''updated_at'', updated_at)),
           ''[]''::jsonb
         ) from deleted',
        table_name
      )
      into deleted_versions
      using rows_value;
      table_versions := table_versions || deleted_versions;
    end if;

    result := result || jsonb_build_array(jsonb_build_object(
      'table', table_name,
      'rows', table_versions
    ));
  end loop;

  return result;
end;
$$;

revoke all on function public.apply_relational_changes(jsonb) from public, anon;
grant execute on function public.apply_relational_changes(jsonb) to authenticated;

commit;
