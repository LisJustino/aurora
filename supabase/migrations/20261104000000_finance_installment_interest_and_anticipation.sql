alter table public.finance_transactions
  add column if not exists interest_cents bigint
    check (interest_cents is null or (interest_cents >= 0 and interest_cents <= amount_cents)),
  add column if not exists anticipated_date date,
  add column if not exists invoice_installment boolean not null default false;
