begin;

alter table public.tasks
  alter column group_key type text,
  alter column group_title type text;

alter table public.finance_transactions
  alter column group_key type text;

commit;
