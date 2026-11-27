begin;

create or replace function public.enforce_authenticated_owner()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not public.has_totp_aal2() then
    raise exception using
      errcode = 'P0001',
      message = 'Uma sessão autenticada é obrigatória';
  end if;

  new.user_id := (select auth.uid());
  return new;
end;
$$;

revoke all on function public.enforce_authenticated_owner() from public, anon;
grant execute on function public.enforce_authenticated_owner() to authenticated;

do $migration$
declare
  table_record record;
begin
  for table_record in
    select columns.table_name
    from information_schema.columns as columns
    join information_schema.tables as tables
      on tables.table_schema = columns.table_schema
      and tables.table_name = columns.table_name
    where columns.table_schema = 'public'
      and columns.column_name = 'user_id'
      and tables.table_type = 'BASE TABLE'
  loop
    execute format(
      'drop trigger if exists enforce_authenticated_owner on public.%I',
      table_record.table_name
    );
    execute format(
      'create trigger enforce_authenticated_owner
       before insert or update of user_id on public.%I
       for each row execute function public.enforce_authenticated_owner()',
      table_record.table_name
    );
  end loop;
end;
$migration$;

commit;
