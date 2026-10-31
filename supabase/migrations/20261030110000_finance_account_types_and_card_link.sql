begin;

update public.finance_accounts
set account_type = 'checking'
where account_type = 'cash';

alter table public.finance_accounts
  drop constraint if exists finance_accounts_account_type_check;
alter table public.finance_accounts
  add constraint finance_accounts_account_type_check
  check (account_type in ('checking', 'savings', 'investment', 'credit'));

alter table public.finance_accounts
  add column linked_account_id uuid;
alter table public.finance_accounts
  add constraint finance_accounts_linked_account_owner_fkey
  foreign key (user_id, linked_account_id)
  references public.finance_accounts (user_id, id)
  on delete set null (linked_account_id);
alter table public.finance_accounts
  add constraint finance_accounts_linked_account_type_check
  check (linked_account_id is null or account_type = 'credit');
create index finance_accounts_user_linked_account_idx
  on public.finance_accounts (user_id, linked_account_id)
  where linked_account_id is not null;

alter table public.user_settings
  drop constraint if exists user_settings_account_types_check;
update public.user_settings
set account_types = array['checking', 'savings', 'investment']::text[];
alter table public.user_settings
  alter column account_types
  set default array['checking', 'savings', 'investment']::text[];
alter table public.user_settings
  add constraint user_settings_account_types_check
  check (account_types <@ array['checking', 'savings', 'investment', 'cash']::text[]);

commit;
