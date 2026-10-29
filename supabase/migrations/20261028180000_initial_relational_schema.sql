begin;

create or replace function public.has_totp_aal2()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal' = 'aal2', false)
    and (
      coalesce(auth.jwt() -> 'amr', '[]'::jsonb) @> '[{"method":"totp"}]'::jsonb
      or coalesce(auth.jwt() -> 'amr', '[]'::jsonb) @> '[{"method":"mfa/totp"}]'::jsonb
    );
$$;

revoke all on function public.has_totp_aal2() from public, anon;
grant execute on function public.has_totp_aal2() to authenticated;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public, anon, authenticated;

create or replace function public.is_valid_weekdays(days smallint[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    cardinality(days) between 1 and 7
    and days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]
    and cardinality(days) = (
      select count(distinct weekday)::integer
      from unnest(days) as weekdays(weekday)
    ),
    false
  );
$$;

revoke all on function public.is_valid_weekdays(smallint[]) from public, anon;
grant execute on function public.is_valid_weekdays(smallint[]) to authenticated;

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique default auth.uid() references auth.users (id) on delete cascade,
  display_name varchar(50) not null default '',
  preferred_name varchar(50) not null default '',
  sex text check (sex is null or sex in ('', 'f', 'm', 'nb', 'o', 'n')),
  age smallint check (age is null or age between 5 and 120),
  weight_kg numeric(5, 2) check (weight_kg is null or weight_kg between 20 and 400),
  height_cm smallint check (height_cm is null or height_cm between 80 and 250),
  timezone text not null default 'America/Sao_Paulo' check (length(timezone) between 1 and 80),
  theme varchar(40) not null default 'rose' check (length(theme) between 1 and 40),
  appearance jsonb not null default '{}'::jsonb check (jsonb_typeof(appearance) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique default auth.uid() references auth.users (id) on delete cascade,
  preferences jsonb not null default '{}'::jsonb check (jsonb_typeof(preferences) = 'object'),
  enabled_areas jsonb not null default '{}'::jsonb check (jsonb_typeof(enabled_areas) = 'object'),
  account_types text[] not null default array['checking', 'cash']::text[]
    check (account_types <@ array['checking', 'savings', 'cash', 'credit']::text[]),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.task_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name varchar(30) not null check (length(btrim(name)) between 1 and 30),
  color varchar(7) not null default '#c97994' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  folder varchar(30) check (folder is null or length(folder) <= 30),
  sort_order integer not null default 0,
  is_test_data boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, id)
);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name varchar(24) not null check (length(btrim(name)) between 1 and 24),
  is_test_data boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, id),
  unique (user_id, name)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title varchar(500) not null check (length(btrim(title)) between 1 and 500),
  is_completed boolean not null default false,
  tag varchar(30),
  list_id uuid,
  group_key varchar(100),
  group_title varchar(120),
  due_date date,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  task_created_at timestamptz,
  completed_at timestamptz,
  planned_time time without time zone,
  repeat_rule text not null default 'none' check (repeat_rule in ('none', 'day', 'weekday', 'week', 'month', 'year')),
  remind_minutes smallint check (remind_minutes is null or remind_minutes in (0, 10, 30, 60, 1440)),
  notes varchar(5000),
  sort_order numeric not null default 0,
  focus_seconds integer not null default 0 check (focus_seconds >= 0),
  is_test_data boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, id),
  foreign key (user_id, list_id) references public.task_lists (user_id, id) on delete restrict
);

create table public.subtasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  task_id uuid not null,
  title varchar(300) not null check (length(btrim(title)) between 1 and 300),
  is_completed boolean not null default false,
  sort_order integer not null default 0,
  is_test_data boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, id),
  foreign key (user_id, task_id) references public.tasks (user_id, id) on delete cascade
);

create table public.task_tag_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  task_id uuid not null,
  tag_id uuid not null,
  is_test_data boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, id),
  unique (task_id, tag_id),
  foreign key (user_id, task_id) references public.tasks (user_id, id) on delete cascade,
  foreign key (user_id, tag_id) references public.tags (user_id, id) on delete cascade
);

create table public.weekly_reflections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  week_of date not null,
  reflection varchar(500) not null default '' check (length(reflection) <= 500),
  is_test_data boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, week_of)
);

create table public.study_subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name varchar(100) not null check (length(btrim(name)) between 1 and 100),
  is_archived boolean not null default false,
  is_test_data boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, id)
);

create table public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id uuid,
  subject_name varchar(100) not null default '',
  task_id uuid,
  duration_seconds integer not null check (duration_seconds >= 0),
  completed_at timestamptz not null,
  is_test_data boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, id),
  foreign key (user_id, subject_id) references public.study_subjects (user_id, id) on delete restrict,
  foreign key (user_id, task_id) references public.tasks (user_id, id) on delete restrict
);

create table public.timer_state (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  timer_kind text not null check (timer_kind in ('study', 'pomodoro')),
  subject_id uuid,
  focus_task_id uuid,
  elapsed_seconds integer not null default 0 check (elapsed_seconds >= 0),
  started_at timestamptz,
  phase text not null default 'focus' check (phase in ('focus', 'short-break', 'long-break')),
  phase_elapsed_seconds integer not null default 0 check (phase_elapsed_seconds between 0 and 7200),
  completed_pomodoros integer not null default 0 check (completed_pomodoros >= 0),
  daily_completed_pomodoros integer not null default 0 check (daily_completed_pomodoros >= 0),
  daily_completed_on date,
  focus_label varchar(40),
  is_test_data boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, timer_kind),
  foreign key (user_id, subject_id) references public.study_subjects (user_id, id) on delete restrict,
  foreign key (user_id, focus_task_id) references public.tasks (user_id, id) on delete restrict
);

create table public.pomodoro_daily_stats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  stat_date date not null,
  completed_count integer not null default 0 check (completed_count >= 0 and completed_count < 1000),
  is_test_data boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, stat_date)
);

create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name varchar(60) not null check (length(btrim(name)) between 1 and 60),
  scheduled_days smallint[] not null check (public.is_valid_weekdays(scheduled_days)),
  status text not null default 'active' check (status in ('active', 'paused', 'archived')),
  skipped_dates date[] not null default '{}'::date[],
  paused_from date,
  paused_days smallint[] check (paused_days is null or public.is_valid_weekdays(paused_days)),
  tracking text check (tracking is null or tracking = 'water'),
  icon varchar(20),
  color varchar(7) check (color is null or color ~ '^#[0-9A-Fa-f]{6}$'),
  weekly_goal smallint check (weekly_goal is null or weekly_goal between 1 and 7),
  remind time without time zone,
  is_test_data boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, id)
);

create table public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  habit_id uuid not null,
  log_date date not null,
  status text not null check (status in ('completed', 'skipped')),
  note varchar(500),
  is_test_data boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (habit_id, log_date),
  foreign key (user_id, habit_id) references public.habits (user_id, id) on delete cascade
);

create table public.water_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  log_date date not null,
  recorded_at timestamptz not null default now(),
  amount_ml integer not null check (amount_ml between 1 and 10000),
  is_test_data boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.gym_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name varchar(100) not null check (length(btrim(name)) between 1 and 100),
  is_test_data boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, id)
);

create table public.gym_template_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  template_id uuid not null,
  name varchar(100) not null check (length(btrim(name)) between 1 and 100),
  sort_order integer not null default 0,
  is_test_data boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, id),
  foreign key (user_id, template_id) references public.gym_templates (user_id, id) on delete cascade
);

create table public.gym_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  log_date date not null,
  name varchar(100),
  minutes integer check (minutes is null or minutes between 0 and 1440),
  notes varchar(2000),
  is_test_data boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.finance_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name varchar(80) not null check (length(btrim(name)) between 1 and 80),
  account_type text not null check (account_type in ('checking', 'savings', 'cash', 'credit')),
  initial_cents bigint not null,
  bank varchar(80),
  limit_cents bigint check (limit_cents is null or limit_cents >= 0),
  closing_day smallint check (closing_day is null or closing_day between 0 and 31),
  due_day smallint check (due_day is null or due_day between 0 and 31),
  is_test_data boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, id)
);

create table public.finance_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  transaction_type text not null check (transaction_type in ('in', 'out', 'tr')),
  account_id uuid not null,
  to_account_id uuid,
  amount_cents bigint not null check (amount_cents > 0),
  transaction_date date not null,
  entered_at timestamptz,
  category varchar(60),
  description varchar(300),
  is_paid boolean not null default false,
  group_key varchar(100),
  recurrence_id uuid,
  is_test_data boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, id),
  check ((transaction_type = 'tr') = (to_account_id is not null)),
  check (to_account_id is null or to_account_id <> account_id),
  foreign key (user_id, account_id) references public.finance_accounts (user_id, id) on delete restrict,
  foreign key (user_id, to_account_id) references public.finance_accounts (user_id, id) on delete restrict
);

create table public.finance_budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category varchar(60) not null check (length(btrim(category)) between 1 and 60),
  amount_cents bigint not null check (amount_cents > 0),
  is_test_data boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, category)
);

create table public.finance_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name varchar(100) not null check (length(btrim(name)) between 1 and 100),
  target_cents bigint not null check (target_cents > 0),
  saved_cents bigint not null default 0 check (saved_cents >= 0),
  deadline date,
  is_test_data boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.finance_recurrences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  transaction_type text not null check (transaction_type in ('in', 'out')),
  account_id uuid not null,
  category varchar(60) not null default '',
  amount_cents bigint not null check (amount_cents > 0),
  day_of_month smallint not null check (day_of_month between 1 and 31),
  start_month date not null check (extract(day from start_month) = 1),
  last_month date check (last_month is null or extract(day from last_month) = 1),
  description varchar(300),
  first_paid boolean not null default false,
  is_paused boolean not null default false,
  is_test_data boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, id),
  foreign key (user_id, account_id) references public.finance_accounts (user_id, id) on delete restrict
);

alter table public.finance_transactions
  add constraint finance_transactions_recurrence_owner_fkey
  foreign key (user_id, recurrence_id) references public.finance_recurrences (user_id, id) on delete restrict;

create table public.cycle_periods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  start_date date not null,
  end_date date,
  is_test_data boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, id),
  check (end_date is null or end_date >= start_date)
);

create table public.cycle_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  log_date date not null,
  flow text check (flow is null or flow in ('', 'spot', 'light', 'medium', 'heavy')),
  energy varchar(40),
  sleep varchar(40),
  discharge varchar(80),
  note varchar(2000),
  pain text[] not null default '{}'::text[],
  mood text[] not null default '{}'::text[],
  digestion text[] not null default '{}'::text[],
  skin text[] not null default '{}'::text[],
  sexual_activity boolean,
  contraception_methods text[] not null default '{}'::text[],
  is_test_data boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (user_id, log_date),
  check (sexual_activity is distinct from false or cardinality(contraception_methods) = 0),
  check (cardinality(contraception_methods) = 0 or sexual_activity is true),
  check (contraception_methods <@ array[
    'condom', 'pill', 'injection', 'iud', 'implant', 'patch-ring',
    'emergency', 'other', 'none', 'undisclosed'
  ]::text[]),
  check (
    cardinality(array_remove(contraception_methods, 'none')) = cardinality(contraception_methods)
    or cardinality(contraception_methods) = 1
  ),
  check (
    cardinality(array_remove(contraception_methods, 'undisclosed')) = cardinality(contraception_methods)
    or cardinality(contraception_methods) = 1
  )
);

create table public.weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  log_date date not null,
  weight_kg numeric(5, 2) not null check (weight_kg between 20 and 400),
  is_test_data boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  worker_client_id varchar(64) not null check (worker_client_id ~ '^[A-Za-z0-9_-]{20,64}$'),
  worker_capability varchar(128) not null check (worker_capability ~ '^[A-Za-z0-9_-]{32,64}$'),
  subscription jsonb not null check (
    jsonb_typeof(subscription) = 'object'
    and jsonb_typeof(subscription -> 'endpoint') = 'string'
    and jsonb_typeof(subscription -> 'keys') = 'object'
  ),
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id),
  unique (worker_client_id)
);

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'name', ''), 50)
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

revoke all on function public.create_profile_for_new_user() from public, anon, authenticated;

create trigger on_auth_user_created_create_profile
  after insert on auth.users
  for each row execute function public.create_profile_for_new_user();

do $$
declare
  table_name text;
  user_tables constant text[] := array[
    'profiles', 'user_settings', 'task_lists', 'tags', 'tasks', 'subtasks',
    'task_tag_assignments', 'weekly_reflections', 'study_subjects', 'study_sessions',
    'timer_state', 'pomodoro_daily_stats', 'habits', 'habit_logs', 'water_logs',
    'gym_templates', 'gym_template_exercises', 'gym_logs', 'finance_accounts',
    'finance_transactions', 'finance_budgets', 'finance_goals', 'finance_recurrences',
    'cycle_periods', 'cycle_days', 'weight_logs', 'push_subscriptions'
  ];
begin
  foreach table_name in array user_tables loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      table_name || '_set_updated_at',
      table_name
    );
    execute format('alter table public.%I enable row level security', table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using (user_id = (select auth.uid()) and public.has_totp_aal2())',
      table_name || '_select_own_aal2',
      table_name
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (user_id = (select auth.uid()) and public.has_totp_aal2())',
      table_name || '_insert_own_aal2',
      table_name
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (user_id = (select auth.uid()) and public.has_totp_aal2()) with check (user_id = (select auth.uid()) and public.has_totp_aal2())',
      table_name || '_update_own_aal2',
      table_name
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (user_id = (select auth.uid()) and public.has_totp_aal2())',
      table_name || '_delete_own_aal2',
      table_name
    );
    execute format(
      'grant select, insert, update, delete on public.%I to authenticated',
      table_name
    );
    execute format('revoke all on public.%I from public, anon', table_name);
    execute format(
      'create index %I on public.%I (user_id)',
      table_name || '_user_id_idx',
      table_name
    );
  end loop;
end;
$$;

create index tasks_user_due_date_idx on public.tasks (user_id, due_date) where deleted_at is null;
create index tasks_user_task_created_at_idx on public.tasks (user_id, task_created_at desc) where deleted_at is null;
create index tasks_user_status_idx on public.tasks (user_id, is_completed) where deleted_at is null;
create index tasks_user_priority_idx on public.tasks (user_id, priority) where deleted_at is null;
create index tasks_user_list_id_idx on public.tasks (user_id, list_id) where deleted_at is null;
create index subtasks_user_task_id_idx on public.subtasks (user_id, task_id) where deleted_at is null;
create index task_tag_assignments_user_tag_id_idx on public.task_tag_assignments (user_id, tag_id) where deleted_at is null;
create index weekly_reflections_user_week_idx on public.weekly_reflections (user_id, week_of desc) where deleted_at is null;
create index study_subjects_user_status_idx on public.study_subjects (user_id, is_archived) where deleted_at is null;
create index study_sessions_user_completed_at_idx on public.study_sessions (user_id, completed_at desc) where deleted_at is null;
create index study_sessions_user_subject_id_idx on public.study_sessions (user_id, subject_id) where deleted_at is null;
create index study_sessions_user_task_id_idx on public.study_sessions (user_id, task_id) where deleted_at is null;
create index timer_state_user_subject_id_idx on public.timer_state (user_id, subject_id);
create index timer_state_user_focus_task_id_idx on public.timer_state (user_id, focus_task_id);
create index pomodoro_daily_stats_user_date_idx on public.pomodoro_daily_stats (user_id, stat_date desc) where deleted_at is null;
create index habits_user_status_idx on public.habits (user_id, status) where deleted_at is null;
create index habit_logs_user_date_idx on public.habit_logs (user_id, log_date desc) where deleted_at is null;
create index habit_logs_user_habit_id_idx on public.habit_logs (user_id, habit_id) where deleted_at is null;
create index water_logs_user_date_idx on public.water_logs (user_id, log_date desc) where deleted_at is null;
create index gym_template_exercises_user_template_idx on public.gym_template_exercises (user_id, template_id, sort_order) where deleted_at is null;
create index gym_logs_user_date_idx on public.gym_logs (user_id, log_date desc) where deleted_at is null;
create index finance_transactions_user_date_idx on public.finance_transactions (user_id, transaction_date desc) where deleted_at is null;
create index finance_transactions_user_account_idx on public.finance_transactions (user_id, account_id) where deleted_at is null;
create index finance_transactions_user_to_account_idx on public.finance_transactions (user_id, to_account_id) where deleted_at is null;
create index finance_transactions_user_recurrence_idx on public.finance_transactions (user_id, recurrence_id) where deleted_at is null;
create index finance_transactions_user_type_idx on public.finance_transactions (user_id, transaction_type) where deleted_at is null;
create index finance_budgets_user_category_idx on public.finance_budgets (user_id, category) where deleted_at is null;
create index finance_goals_user_deadline_idx on public.finance_goals (user_id, deadline) where deleted_at is null;
create index finance_recurrences_user_status_idx on public.finance_recurrences (user_id, is_paused) where deleted_at is null;
create index finance_recurrences_user_account_idx on public.finance_recurrences (user_id, account_id) where deleted_at is null;
create index cycle_periods_user_start_date_idx on public.cycle_periods (user_id, start_date desc) where deleted_at is null;
create index cycle_days_user_date_idx on public.cycle_days (user_id, log_date desc) where deleted_at is null;
create index weight_logs_user_date_idx on public.weight_logs (user_id, log_date desc) where deleted_at is null;

commit;
