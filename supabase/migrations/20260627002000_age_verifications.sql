-- Age verification results from a third-party selfie-based estimation
-- provider (Yoti). We never store the selfie image itself — it goes
-- directly from the device to the provider and is discarded on their
-- end per their retention policy. This table holds only the outcome.
--
-- Rows are written exclusively by a server-side Edge Function holding
-- the provider's secret key, never by the client directly — clients
-- can only read their own result.

create table public.age_verifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null default 'yoti',
  passed boolean not null,
  estimated_age_min int,
  estimated_age_max int,
  provider_reference text,
  verified_at timestamptz not null default now()
);

create index age_verifications_user_id_idx on public.age_verifications (user_id);

alter table public.age_verifications enable row level security;

create policy "users can view their own age verification"
  on public.age_verifications for select
  to authenticated
  using (user_id = auth.uid());

-- No insert/update/delete policy for authenticated/anon: rows are
-- written only via the service role from the Edge Function that talks
-- to Yoti, which bypasses RLS entirely. This is intentional — a client
-- must never be able to claim its own "passed" result.
