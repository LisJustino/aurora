create or replace function public.has_authenticated_user()
returns boolean
language sql
stable
set search_path = ''
as $$
  select (select auth.uid()) is not null;
$$;

revoke all on function public.has_authenticated_user() from public, anon;
grant execute on function public.has_authenticated_user() to authenticated;

create or replace function public.has_totp_aal2()
returns boolean
language sql
stable
set search_path = ''
as $$
  select public.has_authenticated_user();
$$;

revoke all on function public.has_totp_aal2() from public, anon;
grant execute on function public.has_totp_aal2() to authenticated;
comment on function public.has_totp_aal2() is
  'Compatibility helper for existing RLS policies; checks authentication only and does not require MFA.';

create table if not exists public.user_keys (
  user_id uuid primary key references auth.users (id) on delete cascade,
  key_version integer not null check (key_version = 1),
  salt text not null check (salt ~ '^[A-Za-z0-9_-]{22}$'),
  password_wrap jsonb not null check (
    case when jsonb_typeof(password_wrap) = 'object' then
      password_wrap ?& array['iv', 'ciphertext']
      and password_wrap - 'iv' - 'ciphertext' = '{}'::jsonb
      and jsonb_typeof(password_wrap -> 'iv') = 'string'
      and password_wrap ->> 'iv' ~ '^[A-Za-z0-9_-]{16}$'
      and jsonb_typeof(password_wrap -> 'ciphertext') = 'string'
      and password_wrap ->> 'ciphertext' ~ '^[A-Za-z0-9_-]{64}$'
    else false end
  ),
  recovery_wrap jsonb not null check (
    case when jsonb_typeof(recovery_wrap) = 'object' then
      recovery_wrap ?& array['iv', 'ciphertext']
      and recovery_wrap - 'iv' - 'ciphertext' = '{}'::jsonb
      and jsonb_typeof(recovery_wrap -> 'iv') = 'string'
      and recovery_wrap ->> 'iv' ~ '^[A-Za-z0-9_-]{16}$'
      and jsonb_typeof(recovery_wrap -> 'ciphertext') = 'string'
      and recovery_wrap ->> 'ciphertext' ~ '^[A-Za-z0-9_-]{64}$'
    else false end
  ),
  created_at timestamptz not null default now()
);

alter table public.user_keys enable row level security;
alter table public.user_keys force row level security;

drop policy if exists "Users can read their own keys at aal2" on public.user_keys;
create policy "Users can read their own keys at aal2"
  on public.user_keys for select to authenticated
  using (auth.uid() = user_id and public.has_authenticated_user());

drop policy if exists "Users can insert their own keys at aal2" on public.user_keys;
create policy "Users can insert their own keys at aal2"
  on public.user_keys for insert to authenticated
  with check (auth.uid() = user_id and public.has_authenticated_user());

revoke all on table public.user_keys from public, anon, authenticated;
grant select, insert on table public.user_keys to authenticated;

create table if not exists public.user_data (
  user_id uuid not null references auth.users (id) on delete cascade,
  slice text not null check (slice in (
    'tasks', 'pomodoro', 'settings',
    'water', 'gym', 'finance', 'cycle', 'cycleLog', 'weight', 'habits'
  )),
  data jsonb not null check (
    pg_column_size(data) <= 2000000
    and case when jsonb_typeof(data) = 'object' then
      data ?& array['v', 'iv', 'ciphertext']
      and data - 'v' - 'iv' - 'ciphertext' = '{}'::jsonb
      and data ->> 'v' = '1'
      and jsonb_typeof(data -> 'iv') = 'string'
      and data ->> 'iv' ~ '^[A-Za-z0-9_-]{16}$'
      and jsonb_typeof(data -> 'ciphertext') = 'string'
      and data ->> 'ciphertext' ~ '^[A-Za-z0-9_-]{22,}$'
    else false end
  ),
  revision integer not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, slice)
);

do $$
begin
  if exists (
    select 1 from public.user_data
    where case when jsonb_typeof(data) = 'object' then
      not (data ?& array['v', 'iv', 'ciphertext'])
      or data - 'v' - 'iv' - 'ciphertext' <> '{}'::jsonb
      or data ->> 'v' <> '1'
      or jsonb_typeof(data -> 'iv') <> 'string'
      or data ->> 'iv' !~ '^[A-Za-z0-9_-]{16}$'
      or jsonb_typeof(data -> 'ciphertext') <> 'string'
      or data ->> 'ciphertext' !~ '^[A-Za-z0-9_-]{22,}$'
    else true end
  ) then
    raise exception 'Existing user_data contains plaintext or an unsupported envelope. Preserve it and migrate it client-side before enabling E2EE.';
  end if;
  alter table public.user_data drop constraint if exists user_data_slice_check;
  alter table public.user_data add constraint user_data_slice_check check (slice in (
    'tasks', 'pomodoro', 'settings',
    'water', 'gym', 'finance', 'cycle', 'cycleLog', 'weight', 'habits'
  ));
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.user_data'::regclass
      and conname = 'user_data_ciphertext_envelope_check'
  ) then
    alter table public.user_data add constraint user_data_ciphertext_envelope_check check (
      case when jsonb_typeof(data) = 'object' then
        data ?& array['v', 'iv', 'ciphertext']
        and data - 'v' - 'iv' - 'ciphertext' = '{}'::jsonb
        and data ->> 'v' = '1'
        and jsonb_typeof(data -> 'iv') = 'string'
        and data ->> 'iv' ~ '^[A-Za-z0-9_-]{16}$'
        and jsonb_typeof(data -> 'ciphertext') = 'string'
        and data ->> 'ciphertext' ~ '^[A-Za-z0-9_-]{22,}$'
      else false end
    );
  end if;
end;
$$;

alter table public.user_data enable row level security;
alter table public.user_data force row level security;

drop policy if exists "Users can read their own data at aal2" on public.user_data;
create policy "Users can read their own data at aal2"
  on public.user_data for select to authenticated
  using (
    auth.uid() = user_id
    and public.has_authenticated_user()
    and exists (select 1 from public.user_keys as vault_keys where vault_keys.user_id = auth.uid())
  );

drop policy if exists "Users can insert their own data at aal2" on public.user_data;
create policy "Users can insert their own data at aal2"
  on public.user_data for insert to authenticated
  with check (
    auth.uid() = user_id
    and public.has_authenticated_user()
    and exists (select 1 from public.user_keys as vault_keys where vault_keys.user_id = auth.uid())
  );

drop policy if exists "Users can update their own data at aal2" on public.user_data;
create policy "Users can update their own data at aal2"
  on public.user_data for update to authenticated
  using (
    auth.uid() = user_id
    and public.has_authenticated_user()
    and exists (select 1 from public.user_keys as vault_keys where vault_keys.user_id = auth.uid())
  )
  with check (
    auth.uid() = user_id
    and public.has_authenticated_user()
    and exists (select 1 from public.user_keys as vault_keys where vault_keys.user_id = auth.uid())
  );

drop policy if exists "Users can delete their own data at aal2" on public.user_data;
create policy "Users can delete their own data at aal2"
  on public.user_data for delete to authenticated
  using (
    auth.uid() = user_id
    and public.has_authenticated_user()
    and exists (select 1 from public.user_keys as vault_keys where vault_keys.user_id = auth.uid())
  );

revoke all on table public.user_data from public, anon, authenticated;
grant select, insert, update, delete on table public.user_data to authenticated;

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
      'tasks', 'pomodoro', 'settings',
      'water', 'gym', 'finance', 'cycle', 'cycleLog', 'weight', 'habits'
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
      'tasks', 'pomodoro', 'settings',
      'water', 'gym', 'finance', 'cycle', 'cycleLog', 'weight', 'habits'
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
      'tasks', 'pomodoro', 'settings',
      'water', 'gym', 'finance', 'cycle', 'cycleLog', 'weight', 'habits'
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
