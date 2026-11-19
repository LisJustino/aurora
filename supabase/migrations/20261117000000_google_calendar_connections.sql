-- Conexões do Google Agenda mantidas no servidor.
-- O refresh token fica criptografado (AES-GCM, chave só na função) e a tabela
-- não tem política de RLS: apenas a função com service role consegue ler ou gravar.
create table public.google_calendar_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  google_subject text not null,
  email text not null,
  refresh_token_encrypted text not null,
  selected_calendar_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint google_calendar_connections_selected_is_array check (jsonb_typeof(selected_calendar_ids) = 'array'),
  constraint google_calendar_connections_user_subject_key unique (user_id, google_subject)
);

alter table public.google_calendar_connections enable row level security;
revoke all on public.google_calendar_connections from public, anon, authenticated;

create trigger google_calendar_connections_set_updated_at
  before update on public.google_calendar_connections
  for each row execute function public.set_updated_at();
