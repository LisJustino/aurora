begin;

create or replace function public.load_relational_account(p_include_cycle boolean default true)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  account_snapshot jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'Uma sessão autenticada é necessária para carregar os dados.'
      using errcode = '28000';
  end if;

  select jsonb_build_object(
    'profiles', coalesce((select jsonb_agg(to_jsonb(t)) from public.profiles as t), '[]'::jsonb),
    'user_settings', coalesce((select jsonb_agg(to_jsonb(t)) from public.user_settings as t), '[]'::jsonb),
    'task_lists', coalesce((select jsonb_agg(to_jsonb(t)) from public.task_lists as t), '[]'::jsonb),
    'tags', coalesce((select jsonb_agg(to_jsonb(t)) from public.tags as t), '[]'::jsonb),
    'tasks', coalesce((select jsonb_agg(to_jsonb(t)) from public.tasks as t), '[]'::jsonb),
    'subtasks', coalesce((select jsonb_agg(to_jsonb(t)) from public.subtasks as t), '[]'::jsonb),
    'task_tag_assignments', coalesce((select jsonb_agg(to_jsonb(t)) from public.task_tag_assignments as t), '[]'::jsonb),
    'weekly_reflections', coalesce((select jsonb_agg(to_jsonb(t)) from public.weekly_reflections as t), '[]'::jsonb),
    'daily_checkins', coalesce((select jsonb_agg(to_jsonb(t)) from public.daily_checkins as t), '[]'::jsonb),
    'timer_state', coalesce((select jsonb_agg(to_jsonb(t)) from public.timer_state as t), '[]'::jsonb),
    'pomodoro_daily_stats', coalesce((select jsonb_agg(to_jsonb(t)) from public.pomodoro_daily_stats as t), '[]'::jsonb),
    'habits', coalesce((select jsonb_agg(to_jsonb(t)) from public.habits as t), '[]'::jsonb),
    'habit_logs', coalesce((select jsonb_agg(to_jsonb(t)) from public.habit_logs as t), '[]'::jsonb),
    'water_logs', coalesce((select jsonb_agg(to_jsonb(t)) from public.water_logs as t), '[]'::jsonb),
    'gym_templates', coalesce((select jsonb_agg(to_jsonb(t)) from public.gym_templates as t), '[]'::jsonb),
    'gym_template_exercises', coalesce((select jsonb_agg(to_jsonb(t)) from public.gym_template_exercises as t), '[]'::jsonb),
    'gym_logs', coalesce((select jsonb_agg(to_jsonb(t)) from public.gym_logs as t), '[]'::jsonb),
    'finance_accounts', coalesce((select jsonb_agg(to_jsonb(t)) from public.finance_accounts as t), '[]'::jsonb),
    'finance_recurrences', coalesce((select jsonb_agg(to_jsonb(t)) from public.finance_recurrences as t), '[]'::jsonb),
    'finance_transactions', coalesce((select jsonb_agg(to_jsonb(t)) from public.finance_transactions as t), '[]'::jsonb),
    'finance_budgets', coalesce((select jsonb_agg(to_jsonb(t)) from public.finance_budgets as t), '[]'::jsonb),
    'finance_goals', coalesce((select jsonb_agg(to_jsonb(t)) from public.finance_goals as t), '[]'::jsonb),
    'cycle_periods', case when p_include_cycle
      then coalesce((select jsonb_agg(to_jsonb(t)) from public.cycle_periods as t), '[]'::jsonb)
      else '[]'::jsonb end,
    'cycle_days', case when p_include_cycle
      then coalesce((select jsonb_agg(to_jsonb(t)) from public.cycle_days as t), '[]'::jsonb)
      else '[]'::jsonb end,
    'weight_logs', coalesce((select jsonb_agg(to_jsonb(t)) from public.weight_logs as t), '[]'::jsonb),
    'trash_records', coalesce((select jsonb_agg(to_jsonb(t)) from public.trash_records as t
      where p_include_cycle or t.collection not in ('cycle', 'cycleLog')), '[]'::jsonb)
  ) into account_snapshot;

  return account_snapshot;
end;
$$;

revoke all on function public.load_relational_account(boolean) from public, anon;
grant execute on function public.load_relational_account(boolean) to authenticated;

commit;
