-- Switching age verification from AWS Rekognition to Face++ (Megvii):
-- a single API key + secret instead of IAM users, access keys, and an
-- AWS Organizations-level opt-out policy. Same audit trail, just a
-- different provider tag on new rows.

alter table public.age_verifications
  alter column provider set default 'facepp';
