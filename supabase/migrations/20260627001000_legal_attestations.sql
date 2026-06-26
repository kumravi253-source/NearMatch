-- Records the exact wording a user agreed to and when. One row per
-- user — written the first time they're authenticated (immediately
-- after signup if email confirmation is off, or at first login after
-- confirming, if it's on). The signup form requires the checkbox to
-- be checked before it submits, so by the time any session exists for
-- a user, the attestation has already happened; this table is the
-- durable record of it.

create table public.legal_attestations (
  id bigint generated always as identity primary key,
  user_id uuid not null unique references auth.users (id) on delete cascade,
  attestation_text text not null,
  attested_at timestamptz not null default now()
);

alter table public.legal_attestations enable row level security;

create policy "users can record their own attestation"
  on public.legal_attestations for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "users can view their own attestation"
  on public.legal_attestations for select
  to authenticated
  using (user_id = auth.uid());
