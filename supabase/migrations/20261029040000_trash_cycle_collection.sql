begin;

do $$
begin
  if to_regclass('public.trash_records') is null then
    raise exception 'Tabela public.trash_records não existe';
  end if;
end;
$$;

alter table public.trash_records
  drop constraint if exists trash_records_collection_check;

alter table public.trash_records
  add constraint trash_records_collection_check check (collection in (
    'tasks', 'subjects', 'sessions', 'habits', 'water', 'cycle', 'cycleLog',
    'timer.subject', 'finance.accounts', 'finance.tx', 'finance.budgets',
    'finance.goals', 'finance.recurring'
  )) not valid;

alter table public.trash_records
  validate constraint trash_records_collection_check;

alter table public.trash_records
  drop constraint if exists trash_records_entity_table_check;

alter table public.trash_records
  add constraint trash_records_entity_table_check check (entity_table in (
    'tasks', 'study_subjects', 'study_sessions', 'habits', 'water_logs',
    'cycle_periods', 'cycle_days', 'finance_accounts', 'finance_transactions',
    'finance_budgets', 'finance_goals', 'finance_recurrences', 'timer_state'
  )) not valid;

alter table public.trash_records
  validate constraint trash_records_entity_table_check;

do $$
begin
  if (
    select count(distinct conname)
    from pg_constraint
    where conname in (
      'trash_records_collection_check',
      'trash_records_entity_table_check'
    )
      and conrelid = 'public.trash_records'::regclass
      and contype = 'c'
  ) <> 2 then
    raise exception 'Constraints da lixeira não foram criadas corretamente';
  end if;
end;
$$;

comment on constraint trash_records_collection_check on public.trash_records is
  'Coleções suportadas por registros de lixeira';
comment on constraint trash_records_entity_table_check on public.trash_records is
  'Tabelas de entidade suportadas por registros de lixeira';

commit;
