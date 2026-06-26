-- Blocking and reporting. Both are direct-insert + RLS (same pattern as
-- messages) rather than RPC wrappers, since the access rules are simple
-- ownership checks with no cross-table invariant to protect atomically.

create table public.blocks (
  id bigint generated always as identity primary key,
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index blocks_blocked_id_idx on public.blocks (blocked_id);

alter table public.blocks enable row level security;

create policy "users can block others"
  on public.blocks for insert
  to authenticated
  with check (blocker_id = auth.uid());

create policy "users can view blocks involving them"
  on public.blocks for select
  to authenticated
  using (blocker_id = auth.uid() or blocked_id = auth.uid());

create policy "users can unblock people they blocked"
  on public.blocks for delete
  to authenticated
  using (blocker_id = auth.uid());

create table public.reports (
  id bigint generated always as identity primary key,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reported_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null check (reason in ('inappropriate_photos', 'harassment', 'fake_profile', 'spam', 'other')),
  details text check (char_length(details) <= 1000),
  created_at timestamptz not null default now(),
  check (reporter_id <> reported_id)
);

alter table public.reports enable row level security;

create policy "users can file reports"
  on public.reports for insert
  to authenticated
  with check (reporter_id = auth.uid());

create policy "users can view their own reports"
  on public.reports for select
  to authenticated
  using (reporter_id = auth.uid());
