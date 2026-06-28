-- Pre-launch email capture for the marketing site. Anon can insert
-- (that's the whole point — it's a public signup form) but never
-- read, update, or delete other people's rows. No auth required since
-- visitors aren't NearMatch users yet.

create table public.waitlist (
  id bigint generated always as identity primary key,
  email text not null unique,
  created_at timestamptz not null default now()
);

alter table public.waitlist enable row level security;

create policy "anyone can join the waitlist"
  on public.waitlist for insert
  to anon
  with check (true);
