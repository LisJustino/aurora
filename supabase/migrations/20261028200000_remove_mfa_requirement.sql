begin;

create or replace function public.has_authenticated_user()
returns boolean
language sql
stable
set search_path = ''
as $$
  select (select auth.uid()) is not null;
$$;

revoke all on function public.has_authenticated_user() from public, anon;
grant execute on function public.has_authenticated_user() to authenticated;

create or replace function public.has_totp_aal2()
returns boolean
language sql
stable
set search_path = ''
as $$
  select public.has_authenticated_user();
$$;

revoke all on function public.has_totp_aal2() from public, anon;
grant execute on function public.has_totp_aal2() to authenticated;

comment on function public.has_totp_aal2() is
  'Compatibility helper for existing RLS policies; checks authentication only and does not require MFA.';

commit;