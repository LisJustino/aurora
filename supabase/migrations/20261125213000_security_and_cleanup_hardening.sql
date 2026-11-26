-- Endurece permissões de sugestões públicas, corrige a ordem de limpeza relacional,
-- remove política RLS redundante em tasks, reforça validação de idade e cria índice de rate-limit.
begin;

-- 1. Garante as tabelas/função de sugestões públicas e restringe submit_public_suggestion à service_role
--    (evita bypass de origem e rate-limit via chave anon).
create table if not exists public.public_suggestions (
  id bigint generated always as identity primary key,
  message text not null check (char_length(btrim(message)) between 10 and 2000),
  created_at timestamptz not null default now()
);

alter table public.public_suggestions enable row level security;
alter table public.public_suggestions force row level security;
revoke all on table public.public_suggestions from public, anon, authenticated;

create table if not exists public.public_suggestion_rate_limits (
  request_hash text primary key check (request_hash ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz not null,
  submissions integer not null check (submissions > 0)
);

alter table public.public_suggestion_rate_limits enable row level security;
alter table public.public_suggestion_rate_limits force row level security;
revoke all on table public.public_suggestion_rate_limits from public, anon, authenticated;

create or replace function public.submit_public_suggestion(p_message text, p_request_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_message text := btrim(coalesce(p_message, ''));
  submission_count integer;
begin
  if char_length(normalized_message) < 10 or char_length(normalized_message) > 2000
    or p_request_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'invalid_suggestion';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_request_hash));
  delete from public.public_suggestion_rate_limits
  where window_started_at < now() - interval '1 day';

  insert into public.public_suggestion_rate_limits (request_hash, window_started_at, submissions)
  values (p_request_hash, now(), 1)
  on conflict (request_hash) do update
  set window_started_at = case
        when public.public_suggestion_rate_limits.window_started_at < now() - interval '1 hour' then now()
        else public.public_suggestion_rate_limits.window_started_at
      end,
      submissions = case
        when public.public_suggestion_rate_limits.window_started_at < now() - interval '1 hour' then 1
        else public.public_suggestion_rate_limits.submissions + 1
      end
  returning submissions into submission_count;

  if submission_count > 3 then
    raise exception using errcode = 'P0001', message = 'suggestion_rate_limited';
  end if;

  insert into public.public_suggestions (message) values (normalized_message);
  return jsonb_build_object('accepted', true);
end;
$$;

revoke all on function public.submit_public_suggestion(text, text) from public, anon, authenticated;
grant execute on function public.submit_public_suggestion(text, text) to service_role;

-- 2. Índice para limpeza eficiente da janela de rate-limit de sugestões.
create index if not exists public_suggestion_rate_limits_window_idx
  on public.public_suggestion_rate_limits (window_started_at);

-- 3. Remove política permissiva redundante em public.tasks (já coberta pelas 4 políticas CRUD por comando).
drop policy if exists "Owners can manage their own tasks" on public.tasks;

-- 4. Corrige ordem de exclusão em clear_relational_data (finance_transactions antes de finance_recurrences,
--    respeitando FK ON DELETE RESTRICT) e atualiza account_types padrão.
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
    'finance_transactions', 'finance_recurrences', 'finance_goals', 'finance_budgets',
    'finance_accounts', 'gym_logs',
    'gym_template_exercises', 'gym_templates', 'water_logs',
    'habit_logs', 'habits', 'pomodoro_daily_stats', 'timer_state',
    'daily_checkins', 'weekly_reflections', 'task_tag_assignments', 'subtasks', 'tasks', 'tags', 'task_lists'
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
      account_types = array['checking', 'savings', 'investment']::text[];
end;
$$;

revoke all on function public.clear_relational_data() from public, anon;
grant execute on function public.clear_relational_data() to authenticated;

-- 5. Impede que age_confirmed=true contorne a validação quando age < 16 é informada explicitamente.
create or replace function public.enforce_signup_minimum_age()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  metadata jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  metadata_age text := metadata ->> 'age';
  metadata_month text := metadata ->> 'birthday_month';
  metadata_day text := metadata ->> 'birthday_day';
  metadata_reference_date text := metadata ->> 'birthday_reference_date';
  metadata_provider text := coalesce(new.raw_app_meta_data ->> 'provider', '');
  profile_fields_changed boolean;
  reference_date date;
  birth_month integer;
  birth_day integer;
begin
  if tg_op = 'INSERT' then
    profile_fields_changed := true;
  else
    profile_fields_changed :=
      new.raw_user_meta_data -> 'age' is distinct from old.raw_user_meta_data -> 'age'
      or new.raw_user_meta_data -> 'birthday_month' is distinct from old.raw_user_meta_data -> 'birthday_month'
      or new.raw_user_meta_data -> 'birthday_day' is distinct from old.raw_user_meta_data -> 'birthday_day'
      or new.raw_user_meta_data -> 'birthday_reference_date' is distinct from old.raw_user_meta_data -> 'birthday_reference_date'
      or new.raw_user_meta_data -> 'age_confirmed' is distinct from old.raw_user_meta_data -> 'age_confirmed';
  end if;

  if not profile_fields_changed then
    return new;
  end if;

  if tg_op = 'INSERT' and metadata_provider <> 'email' and not (metadata ? 'age_confirmed') then
    return new;
  end if;

  if jsonb_typeof(metadata -> 'age_confirmed') = 'boolean'
    and metadata -> 'age_confirmed' = 'true'::jsonb then
    if metadata ? 'age' then
      if jsonb_typeof(metadata -> 'age') is distinct from 'number'
        or metadata_age is null
        or metadata_age !~ '^[0-9]{1,3}$' then
        raise exception using errcode = 'P0001', message = 'signup_profile_incomplete';
      end if;
      if metadata_age::integer < 16 then
        raise exception using errcode = 'P0001', message = 'signup_minimum_age';
      end if;
      if metadata_age::integer > 120 then
        raise exception using errcode = 'P0001', message = 'signup_profile_incomplete';
      end if;
    end if;
    return new;
  end if;

  if not (metadata ? 'age')
    or jsonb_typeof(metadata -> 'age') is distinct from 'number'
    or metadata_age is null
    or metadata_age !~ '^[0-9]{1,3}$'
    or jsonb_typeof(metadata -> 'birthday_month') is distinct from 'number'
    or metadata_month is null
    or metadata_month !~ '^[0-9]{1,2}$'
    or jsonb_typeof(metadata -> 'birthday_day') is distinct from 'number'
    or metadata_day is null
    or metadata_day !~ '^[0-9]{1,2}$'
    or jsonb_typeof(metadata -> 'birthday_reference_date') is distinct from 'string'
    or metadata_reference_date is null
    or metadata_reference_date !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    raise exception using errcode = 'P0001', message = 'signup_profile_incomplete';
  end if;

  birth_month := metadata_month::integer;
  birth_day := metadata_day::integer;
  if birth_month < 1 or birth_month > 12
    or birth_day < 1 or birth_day > 31 then
    raise exception using errcode = 'P0001', message = 'signup_profile_incomplete';
  end if;

  begin
    reference_date := metadata_reference_date::date;
    perform make_date(2000, birth_month, birth_day);
  exception when datetime_field_overflow or invalid_datetime_format then
    raise exception using errcode = 'P0001', message = 'signup_profile_incomplete';
  end;

  if reference_date < date '1900-01-01' or reference_date > current_date then
    raise exception using errcode = 'P0001', message = 'signup_profile_incomplete';
  end if;

  if metadata_age::integer < 16 then
    raise exception using errcode = 'P0001', message = 'signup_minimum_age';
  end if;

  if metadata_age::integer > 120 then
    raise exception using errcode = 'P0001', message = 'signup_profile_incomplete';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_signup_minimum_age() from public, anon, authenticated;

commit;
