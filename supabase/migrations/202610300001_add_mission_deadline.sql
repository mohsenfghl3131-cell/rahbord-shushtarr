alter table public.missions
  add column if not exists deadline_at timestamptz null;

create index if not exists missions_deadline_idx
  on public.missions (deadline_at);
