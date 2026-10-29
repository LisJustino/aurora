begin;

do $$
declare
  table_name text;
  legacy_tables constant text[] := array[
    'task_lists', 'tags', 'tasks', 'subtasks', 'task_tag_assignments',
    'weekly_reflections', 'study_subjects', 'study_sessions', 'pomodoro_daily_stats',
    'habits', 'habit_logs', 'water_logs', 'gym_templates', 'gym_template_exercises',
    'gym_logs', 'finance_accounts', 'finance_transactions', 'finance_budgets',
    'finance_goals', 'finance_recurrences', 'cycle_periods', 'cycle_days', 'weight_logs'
  ];
begin
  foreach table_name in array legacy_tables loop
    execute format('alter table public.%I add column if not exists legacy_id text', table_name);
    execute format(
      'create unique index if not exists %I on public.%I (user_id, legacy_id) where legacy_id is not null',
      table_name || '_legacy_id_unique',
      table_name
    );
  end loop;
end;
$$;

create table public.trash_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  legacy_id text not null,
  entry_legacy_id text not null,
  collection text not null check (collection in (
    'tasks', 'subjects', 'sessions', 'habits', 'water', 'cycle', 'cycleLog',
    'timer.subject', 'finance.accounts', 'finance.tx', 'finance.budgets',
    'finance.goals', 'finance.recurring'
  )),
  record_key text not null,
  record_index integer not null check (record_index >= 0),
  label varchar(160) not null check (length(label) between 1 and 160),
  entity_table text not null check (entity_table in (
    'tasks', 'study_subjects', 'study_sessions', 'habits', 'water_logs',
    'cycle_periods', 'cycle_days', 'finance_accounts', 'finance_transactions', 'finance_budgets',
    'finance_goals', 'finance_recurrences', 'timer_state'
  )),
  entity_id uuid,
  removed_at timestamptz not null,
  is_test_data boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, legacy_id)
);

create index trash_records_user_entry_idx on public.trash_records (user_id, entry_legacy_id);
create index trash_records_user_removed_idx on public.trash_records (user_id, removed_at desc);
create index trash_records_entity_idx on public.trash_records (user_id, entity_table, entity_id);
create trigger trash_records_set_updated_at
  before update on public.trash_records
  for each row execute function public.set_updated_at();

alter table public.trash_records enable row level security;
create policy trash_records_select_own_aal2 on public.trash_records
  for select to authenticated
  using (user_id = (select auth.uid()) and public.has_totp_aal2());
create policy trash_records_insert_own_aal2 on public.trash_records
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.has_totp_aal2());
create policy trash_records_update_own_aal2 on public.trash_records
  for update to authenticated
  using (user_id = (select auth.uid()) and public.has_totp_aal2())
  with check (user_id = (select auth.uid()) and public.has_totp_aal2());
create policy trash_records_delete_own_aal2 on public.trash_records
  for delete to authenticated
  using (user_id = (select auth.uid()) and public.has_totp_aal2());
grant select, insert, update, delete on public.trash_records to authenticated;
revoke all on public.trash_records from public, anon;

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

create or replace function public.clear_relational_data()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  table_name text;
  table_order constant text[] := array[
    'trash_records', 'push_subscriptions', 'weight_logs', 'cycle_days', 'cycle_periods',
    'finance_recurrences', 'finance_goals', 'finance_budgets',
    'finance_transactions', 'finance_accounts', 'gym_logs',
    'gym_template_exercises', 'gym_templates', 'water_logs',
    'habit_logs', 'habits', 'pomodoro_daily_stats', 'timer_state',
    'study_sessions', 'study_subjects', 'weekly_reflections',
    'task_tag_assignments', 'subtasks', 'tasks', 'tags', 'task_lists'
  ];
begin
  if (select auth.uid()) is null or not public.has_totp_aal2() then
    raise exception 'Uma sessão autenticada é obrigatória';
  end if;

  foreach table_name in array table_order
  loop
    execute format(
      'delete from public.%I where user_id = (select auth.uid())',
      table_name
    );
  end loop;

  insert into public.profiles (user_id)
  values ((select auth.uid()))
  on conflict (user_id) do update
  set display_name = '',
      preferred_name = '',
      sex = null,
      age = null,
      weight_kg = null,
      height_cm = null,
      timezone = 'America/Sao_Paulo',
      theme = 'rose',
      appearance = '{}'::jsonb;

  insert into public.user_settings (user_id)
  values ((select auth.uid()))
  on conflict (user_id) do update
  set preferences = '{}'::jsonb,
      enabled_areas = '{}'::jsonb,
      account_types = array['checking', 'cash']::text[];
end;
$$;

revoke all on function public.clear_relational_data() from public, anon;
grant execute on function public.clear_relational_data() to authenticated;

commit;
