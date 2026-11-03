begin;

alter table public.profiles
  drop constraint if exists profiles_age_check;
alter table public.profiles
  add constraint profiles_age_check
  check (age is null or age between 0 and 120);

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  metadata_name text := new.raw_user_meta_data ->> 'name';
  metadata_preferred_name text := new.raw_user_meta_data ->> 'preferred_name';
  metadata_sex text := new.raw_user_meta_data ->> 'sex';
  metadata_age text := new.raw_user_meta_data ->> 'age';
  profile_age smallint;
begin
  if new.raw_user_meta_data ? 'name'
    and jsonb_typeof(new.raw_user_meta_data -> 'name') <> 'string' then
    raise exception 'O nome do perfil é inválido';
  end if;
  if new.raw_user_meta_data ? 'preferred_name'
    and jsonb_typeof(new.raw_user_meta_data -> 'preferred_name') <> 'string' then
    raise exception 'O nome preferido do perfil é inválido';
  end if;
  if new.raw_user_meta_data ? 'sex'
    and jsonb_typeof(new.raw_user_meta_data -> 'sex') <> 'string' then
    raise exception 'A identidade de gênero do perfil é inválida';
  end if;
  if metadata_sex is not null and metadata_sex not in ('', 'f', 'm', 'nb', 'o', 'n') then
    raise exception 'A identidade de gênero do perfil é inválida';
  end if;
  if metadata_age is not null then
    if jsonb_typeof(new.raw_user_meta_data -> 'age') <> 'number'
      or metadata_age !~ '^[0-9]{1,3}$' then
      raise exception 'A idade do perfil é inválida';
    end if;
    profile_age := metadata_age::smallint;
    if profile_age < 0 or profile_age > 120 then
      raise exception 'A idade do perfil é inválida';
    end if;
  end if;

  insert into public.profiles (user_id, display_name, preferred_name, sex, age)
  values (
    new.id,
    left(btrim(coalesce(metadata_name, '')), 50),
    left(btrim(coalesce(metadata_preferred_name, metadata_name, '')), 50),
    nullif(metadata_sex, ''),
    profile_age
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

commit;
