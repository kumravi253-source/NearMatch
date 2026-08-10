-- The prose describing age_verifications lives in the migration that created
-- it, which named Yoti — accurate at the time, but the provider has changed
-- twice since (Yoti -> AWS Rekognition -> Face++), each in its own migration.
-- Reconstructing "who actually receives our users' selfies" therefore means
-- reading three files in the right order, which is a poor answer to give a
-- regulator, an auditor, or a new engineer.
--
-- Those migrations are already applied, so they stay as the historical record.
-- Instead, attach the current description to the objects themselves, where
-- \d+ and any schema browser will surface it.
--
-- Deliberately worded to state only what this codebase controls. What Face++
-- does with an image after it arrives is governed by Megvii's terms, not by
-- anything assertable here.

comment on table public.age_verifications is
  'Outcome-only audit record of selfie-based age estimation. Rows are written '
  'exclusively by the verify-age Edge Function via the service role, never by '
  'clients, so a user cannot assert their own passing result. The selfie is '
  'sent from the device to the Edge Function, forwarded to the provider for a '
  'single request, and never persisted by us -- no image is stored in this '
  'table, in storage, or in logs. Provider retention is governed by the '
  'provider''s own terms. Current provider: Face++ (Megvii), Detect endpoint, '
  'requesting only the "age" attribute.';

comment on column public.age_verifications.provider is
  'Which estimation provider produced this row. Default has moved yoti -> '
  'aws_rekognition -> facepp; the Edge Function now sets it explicitly rather '
  'than relying on the default. Kept per-row so historical results stay '
  'attributable to the provider that produced them after any future switch.';

comment on column public.age_verifications.estimated_age_min is
  'Lower bound of the estimate. Face++ returns a single point value rather '
  'than a range, so the Edge Function widens it by a fixed margin in each '
  'direction to reflect the model''s typical error.';

comment on column public.age_verifications.estimated_age_max is
  'Upper bound of the estimate. See estimated_age_min for how it is derived.';

comment on column public.profiles.age_verified is
  'Public "Verified" badge flag, readable by other users. Exists separately '
  'from age_verifications because that table is RLS-locked to its owner and '
  'so cannot be what other users check against. Written only by the '
  'verify-age Edge Function.';
