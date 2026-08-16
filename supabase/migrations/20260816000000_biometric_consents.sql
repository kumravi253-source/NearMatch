-- Durable record of the specific consent given before a selfie is sent to
-- the age-estimation provider.
--
-- Why this is separate from dpdp_consents: that one is the blanket signup
-- consent covering profile data, photos and messages, all processed by us or
-- by infrastructure acting on our instructions. The selfie check is different
-- on three counts at once -- it is biometric data, it goes to a specifically
-- named third party, and that party is outside India -- so it needs its own
-- consent, given at the point of use rather than bundled into signup. The
-- Privacy Policy already promised this ("we ask for it separately in the app
-- before that feature runs"); this table is what makes that promise auditable.
--
-- Not unique on user_id, unlike legal_attestations and dpdp_consents: a user
-- can attempt verification more than once (bad lighting, multiple faces in
-- frame), and each attempt sends a fresh image, so each one needs its own
-- consent event. The row records consent to a single transmission, not a
-- standing permission.
--
-- Rows are written exclusively by the verify-age Edge Function via the service
-- role, immediately before the outbound call to the provider. Writing it there
-- rather than from the client is what makes the ordering guarantee real: if
-- this insert fails, the image is never sent.

create table public.biometric_consents (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  consent_text text not null,
  provider text not null,
  consented_at timestamptz not null default now()
);

create index biometric_consents_user_id_idx on public.biometric_consents (user_id);

alter table public.biometric_consents enable row level security;

create policy "users can view their own biometric consent"
  on public.biometric_consents for select
  to authenticated
  using (user_id = (select auth.uid()));

-- No insert/update/delete policy, matching age_verifications: the Edge
-- Function's service role bypasses RLS, and nothing else should be able to
-- write or retract a consent record. A consent log a client can edit is not
-- a consent log.

comment on table public.biometric_consents is
  'One row per selfie transmission to the age-estimation provider, written by '
  'the verify-age Edge Function via the service role immediately before the '
  'outbound call. Records the exact consent wording the user was shown on that '
  'attempt. Not unique per user -- each verification attempt sends a fresh '
  'image and so requires its own consent.';

comment on column public.biometric_consents.consent_text is
  'Verbatim copy of the string displayed to the user, as sent by the app on '
  'this attempt. Stored as-shown rather than validated against a server-side '
  'constant so that records written by older app versions stay truthful about '
  'what those versions actually displayed.';

comment on column public.biometric_consents.provider is
  'Provider the consent named, so a record stays attributable after any future '
  'provider switch. Mirrors age_verifications.provider.';
