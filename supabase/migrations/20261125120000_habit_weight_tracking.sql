begin;

-- O hábito de peso grava tracking = 'weight'; a regra original só aceitava nulo ou 'water'.
alter table public.habits
  drop constraint if exists habits_tracking_check;

alter table public.habits
  add constraint habits_tracking_check
  check (tracking is null or tracking in ('water', 'weight'));

commit;
