alter table public.cycle_days
  add column if not exists masturbation_activity boolean,
  add column if not exists orgasm_count integer;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'cycle_days_orgasm_count_check'
      and conrelid = 'public.cycle_days'::regclass
  ) then
    alter table public.cycle_days
      add constraint cycle_days_orgasm_count_check
      check (orgasm_count is null or orgasm_count between 0 and 99);
  end if;
end;
$$;
