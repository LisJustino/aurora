begin;

drop policy if exists "Owners with MFA access" on public.tasks;

create policy "Owners can manage their own tasks"
  on public.tasks
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

commit;
