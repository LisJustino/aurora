begin;

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
      or new.raw_user_meta_data -> 'birthday_reference_date' is distinct from old.raw_user_meta_data -> 'birthday_reference_date';
  end if;

  if not profile_fields_changed then
    return new;
  end if;

  if tg_op = 'INSERT' and metadata_provider <> 'email' and not (metadata ? 'age') then
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

drop trigger if exists auth_users_enforce_signup_minimum_age_insert on auth.users;
create trigger auth_users_enforce_signup_minimum_age_insert
  before insert on auth.users
  for each row execute function public.enforce_signup_minimum_age();

drop trigger if exists auth_users_enforce_signup_minimum_age_update on auth.users;
create trigger auth_users_enforce_signup_minimum_age_update
  before update of raw_user_meta_data on auth.users
  for each row execute function public.enforce_signup_minimum_age();

commit;
