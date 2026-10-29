begin;

create or replace function public.apply_relational_changes(p_changes jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  change jsonb;
  table_name text;
  column_list text;
  selected_columns text;
  update_list text;
  conflict_target text;
  rows_value jsonb;
  table_allowlist constant text[] := array[
    'profiles', 'user_settings', 'task_lists', 'tags', 'tasks', 'subtasks',
    'task_tag_assignments', 'weekly_reflections', 'study_subjects', 'study_sessions',
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
    if not table_name = any(table_allowlist) or jsonb_typeof(rows_value) <> 'array' then
      raise exception 'Tabela ou lote de gravação inválido';
    end if;
    conflict_target := case
      when table_name in ('profiles', 'user_settings') then 'user_id'
      else 'id'
    end;

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

    if jsonb_array_length(rows_value) > 0 then
      execute format(
        'insert into public.%I (%s) select %s from jsonb_populate_recordset(null::public.%I, $1) as record_value on conflict (%I) do update set %s',
        table_name,
        column_list,
        selected_columns,
        table_name,
        conflict_target,
        update_list
      ) using rows_value;
    end if;

    if exists (
      select 1
      from pg_catalog.pg_attribute as attribute
      where attribute.attrelid = format('public.%I', table_name)::regclass
        and attribute.attname = 'deleted_at'
        and not attribute.attisdropped
    ) then
      execute format(
        'update public.%I set deleted_at = now() where user_id = (select auth.uid()) and deleted_at is null and id <> all(coalesce(array(select (record_value ->> ''id'')::uuid from jsonb_array_elements($1) as record_value), array[]::uuid[]))',
        table_name
      ) using rows_value;
    end if;
  end loop;
end;
$$;

revoke all on function public.apply_relational_changes(jsonb) from public, anon;
grant execute on function public.apply_relational_changes(jsonb) to authenticated;

commit;
