create table if not exists public.telegram_integration_settings (
  id boolean primary key default true check (id = true),
  chat_id text,
  topic_map jsonb not null default '{}'::jsonb,
  letters_topic_id text,
  announcements_topic_id text,
  reports_enabled boolean not null default false,
  letters_enabled boolean not null default false,
  announcements_enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
alter table public.telegram_integration_settings enable row level security;
revoke all on public.telegram_integration_settings from anon, authenticated;
