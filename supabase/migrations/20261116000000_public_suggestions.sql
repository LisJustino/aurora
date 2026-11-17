begin;

create table if not exists public.public_suggestions (
  id bigint generated always as identity primary key,
  message text not null check (char_length(btrim(message)) between 10 and 2000),
  created_at timestamptz not null default now()
);

alter table public.public_suggestions enable row level security;
alter table public.public_suggestions force row level security;
revoke all on table public.public_suggestions from public, anon, authenticated;

create table if not exists public.public_suggestion_rate_limits (
  request_hash text primary key check (request_hash ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz not null,
  submissions integer not null check (submissions > 0)
);

alter table public.public_suggestion_rate_limits enable row level security;
alter table public.public_suggestion_rate_limits force row level security;
revoke all on table public.public_suggestion_rate_limits from public, anon, authenticated;

create or replace function public.submit_public_suggestion(p_message text, p_request_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_message text := btrim(coalesce(p_message, ''));
  submission_count integer;
begin
  if char_length(normalized_message) < 10 or char_length(normalized_message) > 2000
    or p_request_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'invalid_suggestion';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_request_hash));
  delete from public.public_suggestion_rate_limits
  where window_started_at < now() - interval '1 day';

  insert into public.public_suggestion_rate_limits (request_hash, window_started_at, submissions)
  values (p_request_hash, now(), 1)
  on conflict (request_hash) do update
  set window_started_at = case
        when public.public_suggestion_rate_limits.window_started_at < now() - interval '1 hour' then now()
        else public.public_suggestion_rate_limits.window_started_at
      end,
      submissions = case
        when public.public_suggestion_rate_limits.window_started_at < now() - interval '1 hour' then 1
        else public.public_suggestion_rate_limits.submissions + 1
      end
  returning submissions into submission_count;

  if submission_count > 3 then
    raise exception using errcode = 'P0001', message = 'suggestion_rate_limited';
  end if;

  insert into public.public_suggestions (message) values (normalized_message);
  return jsonb_build_object('accepted', true);
end;
$$;

revoke all on function public.submit_public_suggestion(text, text) from public, authenticated;
grant execute on function public.submit_public_suggestion(text, text) to anon;

commit;
