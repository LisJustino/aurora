alter table public.cycle_days
  add column masturbation_activity boolean,
  add column orgasm_count integer,
  add constraint cycle_days_orgasm_count_check
    check (orgasm_count is null or orgasm_count between 0 and 99);
