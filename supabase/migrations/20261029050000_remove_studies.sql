begin;

do $$
declare
  settings_row record;
  cleaned_preferences jsonb;
  entry jsonb;
  record_value jsonb;
  cleaned_records jsonb;
  cleaned_trash jsonb;
begin
  if to_regclass('public.user_settings') is not null then
    for settings_row in
      select user_id, preferences, enabled_areas
      from public.user_settings
    loop
      cleaned_preferences := coalesce(settings_row.preferences, '{}'::jsonb);
      if jsonb_typeof(cleaned_preferences) = 'object' then
        cleaned_preferences := cleaned_preferences - 'studyGoalMin' #- '{prefs,studyGoalMin}';

        if jsonb_typeof(cleaned_preferences -> 'areas') = 'object' then
          cleaned_preferences := jsonb_set(
            cleaned_preferences,
            '{areas}',
            (cleaned_preferences -> 'areas') - 'studies',
            true
          );
        end if;

        if jsonb_typeof(cleaned_preferences -> 'trash') = 'array' then
          cleaned_trash := '[]'::jsonb;
          for entry in
            select value from jsonb_array_elements(cleaned_preferences -> 'trash')
          loop
            if jsonb_typeof(entry -> 'records') = 'array' then
              cleaned_records := '[]'::jsonb;
              for record_value in
                select value from jsonb_array_elements(entry -> 'records')
              loop
                if (record_value ->> 'collection') is null
                  or record_value ->> 'collection' not in ('subjects', 'sessions', 'timer.subject') then
                  cleaned_records := cleaned_records || jsonb_build_array(record_value);
                end if;
              end loop;
              if jsonb_array_length(cleaned_records) > 0 then
                cleaned_trash := cleaned_trash || jsonb_build_array(
                  jsonb_set(entry, '{records}', cleaned_records, true)
                );
              end if;
            else
              cleaned_trash := cleaned_trash || jsonb_build_array(entry);
            end if;
          end loop;
          cleaned_preferences := jsonb_set(cleaned_preferences, '{trash}', cleaned_trash, true);
        end if;
      end if;

      update public.user_settings
      set preferences = cleaned_preferences,
          enabled_areas = coalesce(settings_row.enabled_areas, '{}'::jsonb) - 'studies'
      where user_id = settings_row.user_id;
    end loop;
  end if;

  if to_regclass('public.timer_state') is not null then
    if to_regclass('public.trash_records') is not null then
      delete from public.trash_records
      where collection in ('subjects', 'sessions', 'timer.subject')
        or entity_table in ('study_subjects', 'study_sessions')
        or (
          entity_table = 'timer_state'
          and entity_id in (
            select id from public.timer_state where timer_kind = 'study'
          )
        );
    end if;
    delete from public.timer_state where timer_kind = 'study';
  end if;

  if to_regclass('public.trash_records') is not null then
    delete from public.trash_records
    where collection in ('subjects', 'sessions', 'timer.subject')
      or entity_table in ('study_subjects', 'study_sessions');
  end if;
end;
$$;

do $$
begin
  if to_regclass('public.user_data') is not null then
    delete from public.user_data where slice in ('subjects', 'sessions', 'timer');
    alter table public.user_data drop constraint if exists user_data_slice_check;
    alter table public.user_data add constraint user_data_slice_check
      check (slice in (
        'tasks', 'pomodoro', 'settings', 'water', 'gym', 'finance',
        'cycle', 'cycleLog', 'weight', 'habits'
      ));
  end if;

  if to_regclass('public.timer_state') is not null then
    alter table public.timer_state
      drop constraint if exists timer_state_user_id_subject_id_fkey;
    drop index if exists public.timer_state_user_subject_id_idx;
    alter table public.timer_state drop column if exists subject_id;
    alter table public.timer_state drop constraint if exists timer_state_timer_kind_check;
    alter table public.timer_state
      add constraint timer_state_timer_kind_check check (timer_kind = 'pomodoro') not valid;
    alter table public.timer_state validate constraint timer_state_timer_kind_check;
  end if;
end;
$$;

alter table public.trash_records
  drop constraint if exists trash_records_collection_check;
alter table public.trash_records
  add constraint trash_records_collection_check check (collection in (
    'tasks', 'habits', 'water', 'cycle', 'cycleLog',
    'finance.accounts', 'finance.tx', 'finance.budgets',
    'finance.goals', 'finance.recurring'
  )) not valid;
alter table public.trash_records
  validate constraint trash_records_collection_check;

alter table public.trash_records
  drop constraint if exists trash_records_entity_table_check;
alter table public.trash_records
  add constraint trash_records_entity_table_check check (entity_table in (
    'tasks', 'habits', 'water_logs', 'cycle_periods', 'cycle_days',
    'finance_accounts', 'finance_transactions', 'finance_budgets',
    'finance_goals', 'finance_recurrences', 'timer_state'
  )) not valid;
alter table public.trash_records
  validate constraint trash_records_entity_table_check;

drop table if exists public.study_sessions;
drop table if exists public.study_subjects;

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
    'weekly_reflections', 'task_tag_assignments', 'subtasks', 'tasks', 'tags', 'task_lists'
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

create or replace function public.import_user_slices(p_slices jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  slice_name text;
  encrypted_data jsonb;
begin
  if current_user_id is null or not public.has_authenticated_user() then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.user_keys where user_id = current_user_id) then
    raise exception 'Encrypted vault required' using errcode = '42501';
  end if;
  if p_slices is null or jsonb_typeof(p_slices) is distinct from 'object'
    or p_slices = '{}'::jsonb then
    raise exception 'Invalid import';
  end if;

  for slice_name, encrypted_data in select key, value from jsonb_each(p_slices)
  loop
    if slice_name not in (
      'tasks', 'pomodoro', 'settings', 'water', 'gym', 'finance',
      'cycle', 'cycleLog', 'weight', 'habits'
    ) then
      raise exception 'Invalid data area';
    end if;
    if (case when jsonb_typeof(encrypted_data) = 'object' then
      encrypted_data ?& array['v', 'iv', 'ciphertext']
      and encrypted_data - 'v' - 'iv' - 'ciphertext' = '{}'::jsonb
      and encrypted_data ->> 'v' = '1'
      and jsonb_typeof(encrypted_data -> 'iv') = 'string'
      and encrypted_data ->> 'iv' ~ '^[A-Za-z0-9_-]{16}$'
      and jsonb_typeof(encrypted_data -> 'ciphertext') = 'string'
      and encrypted_data ->> 'ciphertext' ~ '^[A-Za-z0-9_-]{22,}$'
    else false end) is not true
      or pg_column_size(encrypted_data) > 2000000 then
      raise exception 'Invalid encrypted data envelope';
    end if;
  end loop;

  if exists (select 1 from public.user_data where user_id = current_user_id) then
    raise exception 'Account already has data';
  end if;

  insert into public.user_data (user_id, slice, data, revision)
  select current_user_id, entry.key, entry.value, 1
  from jsonb_each(p_slices) as entry;
end;
$$;

revoke all on function public.import_user_slices(jsonb) from public, anon;
grant execute on function public.import_user_slices(jsonb) to authenticated;

create or replace function public.replace_user_slices(p_slices jsonb, p_revisions jsonb)
returns table (slice text, data jsonb, revision integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  slice_name text;
  encrypted_data jsonb;
  expected_revision integer;
  current_revision integer;
  slice_count integer;
begin
  if current_user_id is null or not public.has_authenticated_user() then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.user_keys where user_id = current_user_id) then
    raise exception 'Encrypted vault required' using errcode = '42501';
  end if;
  if p_slices is null or jsonb_typeof(p_slices) is distinct from 'object'
    or p_revisions is null or jsonb_typeof(p_revisions) is distinct from 'object' then
    raise exception 'Invalid replacement set';
  end if;
  select count(*) into slice_count from jsonb_object_keys(p_slices);
  if slice_count <> 10 then
    raise exception 'Invalid replacement set';
  end if;
  select count(*) into slice_count from jsonb_object_keys(p_revisions);
  if slice_count <> 10 then
    raise exception 'Invalid replacement set';
  end if;

  for slice_name, encrypted_data in select key, value from jsonb_each(p_slices)
  loop
    if slice_name not in (
      'tasks', 'pomodoro', 'settings', 'water', 'gym', 'finance',
      'cycle', 'cycleLog', 'weight', 'habits'
    ) then
      raise exception 'Invalid data area';
    end if;
    if (case when jsonb_typeof(encrypted_data) = 'object' then
      encrypted_data ?& array['v', 'iv', 'ciphertext']
      and encrypted_data - 'v' - 'iv' - 'ciphertext' = '{}'::jsonb
      and encrypted_data ->> 'v' = '1'
      and jsonb_typeof(encrypted_data -> 'iv') = 'string'
      and encrypted_data ->> 'iv' ~ '^[A-Za-z0-9_-]{16}$'
      and jsonb_typeof(encrypted_data -> 'ciphertext') = 'string'
      and encrypted_data ->> 'ciphertext' ~ '^[A-Za-z0-9_-]{22,}$'
    else false end) is not true
      or pg_column_size(encrypted_data) > 2000000 then
      raise exception 'Invalid encrypted data envelope';
    end if;
    if not (p_revisions ? slice_name) then
      raise exception 'Missing expected revision';
    end if;
  end loop;

  for slice_name in select key from jsonb_each(p_revisions)
  loop
    if slice_name not in (
      'tasks', 'pomodoro', 'settings', 'water', 'gym', 'finance',
      'cycle', 'cycleLog', 'weight', 'habits'
    ) then
      raise exception 'Invalid revision area';
    end if;
    if jsonb_typeof(p_revisions -> slice_name) <> 'number'
      or p_revisions ->> slice_name !~ '^[0-9]{1,9}$' then
      raise exception 'Invalid expected revision';
    end if;
    expected_revision := (p_revisions ->> slice_name)::integer;
    select user_data.revision into current_revision
      from public.user_data
      where user_data.user_id = current_user_id and user_data.slice = slice_name
      for update;
    if not found then current_revision := 0; end if;
    if current_revision <> expected_revision then
      raise exception 'Concurrent data update' using errcode = '40001';
    end if;
  end loop;

  insert into public.user_data (user_id, slice, data, revision, updated_at)
  select current_user_id, entry.key, entry.value,
    (p_revisions ->> entry.key)::integer + 1, now()
  from jsonb_each(p_slices) as entry
  on conflict (user_id, slice) do update
    set data = excluded.data,
        revision = excluded.revision,
        updated_at = excluded.updated_at;

  return query
    select user_data.slice, user_data.data, user_data.revision
    from public.user_data
    where user_data.user_id = current_user_id
      and user_data.slice in (select jsonb_object_keys(p_slices));
end;
$$;

revoke all on function public.replace_user_slices(jsonb, jsonb) from public, anon;
grant execute on function public.replace_user_slices(jsonb, jsonb) to authenticated;

commit;
