begin;

alter table public.finance_transactions
  add column if not exists settled_date date;

commit;
