-- Remove os dados do Pomodoro e das notificações push, recursos que saíram do Aurora.
-- As tabelas continuam existindo, vazias: várias funções do banco ainda as listam,
-- então elas só podem ser apagadas numa migration que redefina essas funções.
begin;

do $$
begin
  if to_regclass('public.trash_records') is not null then
    delete from public.trash_records
    where entity_table in ('timer_state', 'pomodoro_daily_stats', 'push_subscriptions');
  end if;

  if to_regclass('public.pomodoro_daily_stats') is not null then
    delete from public.pomodoro_daily_stats;
  end if;

  if to_regclass('public.timer_state') is not null then
    delete from public.timer_state;
  end if;

  if to_regclass('public.push_subscriptions') is not null then
    delete from public.push_subscriptions;
  end if;
end
$$;

commit;
