alter table public.cycle_days
  add column if not exists weight_kg numeric(5, 2),
  add column if not exists ovulation_test_result text,
  add column if not exists pregnancy_test_result text,
  add column if not exists medication_taken boolean;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'cycle_days_weight_kg_check'
      and conrelid = 'public.cycle_days'::regclass
  ) then
    alter table public.cycle_days
      add constraint cycle_days_weight_kg_check
      check (weight_kg is null or weight_kg between 20 and 400);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'cycle_days_ovulation_test_result_check'
      and conrelid = 'public.cycle_days'::regclass
  ) then
    alter table public.cycle_days
      add constraint cycle_days_ovulation_test_result_check
      check (ovulation_test_result is null or ovulation_test_result in (
        'positive', 'negative', 'inconclusive', 'undisclosed'
      ));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'cycle_days_pregnancy_test_result_check'
      and conrelid = 'public.cycle_days'::regclass
  ) then
    alter table public.cycle_days
      add constraint cycle_days_pregnancy_test_result_check
      check (pregnancy_test_result is null or pregnancy_test_result in (
        'positive', 'negative', 'inconclusive', 'undisclosed'
      ));
  end if;
end;
$$;
