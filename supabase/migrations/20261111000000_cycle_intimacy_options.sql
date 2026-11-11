alter table public.cycle_days
  add column if not exists sex_toys_used boolean,
  add column if not exists libido_level text,
  add column if not exists orgasm_occurred boolean;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'cycle_days_libido_level_check'
      and conrelid = 'public.cycle_days'::regclass
  ) then
    alter table public.cycle_days
      add constraint cycle_days_libido_level_check
      check (libido_level is null or libido_level in ('high', 'low'));
  end if;
end;
$$;
