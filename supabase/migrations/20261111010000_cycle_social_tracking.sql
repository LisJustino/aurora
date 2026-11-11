alter table public.cycle_days
  add column if not exists social text[] not null default '{}'::text[];

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'cycle_days_social_options_check'
      and conrelid = 'public.cycle_days'::regclass
  ) then
    alter table public.cycle_days
      add constraint cycle_days_social_options_check
      check (social <@ array[
        'interaction', 'preferred-quiet', 'wanted-socialize',
        'alone-time', 'interaction-helped', 'interaction-tired'
      ]::text[]);
  end if;
end;
$$;
