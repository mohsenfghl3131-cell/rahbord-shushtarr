alter table public.messages
  add column if not exists sender_deleted_at timestamptz null,
  add column if not exists recipient_deleted_at timestamptz null;

create index if not exists messages_sender_visible_idx
  on public.messages (sender_id, created_at desc)
  where sender_deleted_at is null;

create index if not exists messages_recipient_visible_idx
  on public.messages (recipient_id, created_at desc)
  where recipient_deleted_at is null;
