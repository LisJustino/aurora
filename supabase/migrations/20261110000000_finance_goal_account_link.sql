alter table public.finance_goals
  add column if not exists linked_account_id uuid;

do $migration$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'finance_goals_user_linked_account_fkey'
      and conrelid = 'public.finance_goals'::regclass
  ) then
    alter table public.finance_goals
      add constraint finance_goals_user_linked_account_fkey
      foreign key (user_id, linked_account_id)
      references public.finance_accounts (user_id, id)
      on delete restrict;
  end if;
end
$migration$;

create unique index if not exists finance_goals_user_linked_account_idx
  on public.finance_goals (user_id, linked_account_id)
  where linked_account_id is not null and deleted_at is null;
