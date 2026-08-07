-- Records the exact wording a user consented to for personal data
-- processing under India's Digital Personal Data Protection Act,
-- 2023, and when. Mirrors legal_attestations: one row per user,
-- written the first time they're authenticated (the signup form
-- requires acceptance before it submits, so by the time any session
-- exists for a user, consent has already happened; this table is the
-- durable record of it).

create table public.dpdp_consents (
  id bigint generated always as identity primary key,
  user_id uuid not null unique references auth.users (id) on delete cascade,
  consent_text text not null,
  consented_at timestamptz not null default now()
);

alter table public.dpdp_consents enable row level security;

create policy "users can record their own consent"
  on public.dpdp_consents for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "users can view their own consent"
  on public.dpdp_consents for select
  to authenticated
  using (user_id = auth.uid());
