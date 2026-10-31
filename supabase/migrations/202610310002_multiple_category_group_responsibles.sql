create table if not exists public.category_group_responsibles (
  group_id uuid not null references public.category_groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint category_group_responsibles_pkey primary key (group_id, user_id)
);

create index if not exists category_group_responsibles_user_id_idx
  on public.category_group_responsibles(user_id);

alter table public.category_group_responsibles enable row level security;

-- The app accesses this table only from authenticated server routes using service_role.
grant all on table public.category_group_responsibles to service_role;

-- Preserve every previously configured single-user responsibility.
insert into public.category_group_responsibles(group_id, user_id)
select id, responsible_user_id
from public.category_groups
where responsible_user_id is not null
on conflict (group_id, user_id) do nothing;
