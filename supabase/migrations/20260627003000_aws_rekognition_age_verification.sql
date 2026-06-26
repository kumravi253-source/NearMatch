-- Switching age verification from Yoti to AWS Rekognition's DetectFaces
-- (AgeRange attribute): well-documented SigV4-signed API, no guessing
-- at undocumented signing schemes, instant self-serve AWS account
-- instead of a vendor onboarding queue.
--
-- age_verifications stays as the detailed, owner-only audit record.
-- profiles.age_verified is new: a public boolean so OTHER users can
-- see the "Verified" badge — age_verifications itself is RLS-locked
-- to the owner, so it can't be the thing other users check against.

alter table public.profiles
  add column age_verified boolean not null default false;

alter table public.age_verifications
  alter column provider set default 'aws_rekognition';
