-- Profile photos were served from a public bucket, so every avatar sat on a
-- permanently valid URL that anyone could fetch without authenticating — no
-- account, no session, no rate limit. For a dating app that's a meaningful
-- exposure: the URL is derived from the user's uuid at a fixed filename
-- ("<user_id>/profile.jpg"), so a leaked uuid yields a leaked photo forever,
-- and a URL shared once stays live after the user deletes their account.
--
-- This makes the bucket private. Reads now go through short-lived signed URLs
-- minted per session (see src/lib/avatars.js), which expire and which require
-- an authenticated caller to obtain. Other users can still see each other's
-- photos in the deck — they just can no longer be fetched by the open
-- internet.
--
-- Note that profile_locations was already locked down this way; this brings
-- photos in line with the privacy posture the rest of the schema already has.

update storage.buckets set public = false where id = 'avatars';

-- Reads: authenticated only. The old policy granted SELECT to `public`, which
-- in PostgREST terms includes the anon role, hence the open access.
drop policy if exists "avatar images are publicly readable" on storage.objects;

create policy "authenticated users can read avatars"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'avatars');

-- Bucket metadata: same narrowing. Nothing anonymous needs to see this.
drop policy if exists "avatars bucket metadata is readable" on storage.buckets;

create policy "avatars bucket metadata is readable"
  on storage.buckets for select
  to authenticated
  using (id = 'avatars');

-- Backfill. profiles.photo_url historically held a fully-qualified public URL
-- with a cache-busting query string:
--   https://<ref>.supabase.co/storage/v1/object/public/avatars/<uid>/profile.jpg?v=123
-- Signed URLs are minted from the object path instead, so reduce existing rows
-- to just "<uid>/profile.jpg". Rows already holding a bare path, and rows with
-- no photo at all, are left alone.
update public.profiles
set photo_url = split_part(
      substring(
        photo_url
        from position('/storage/v1/object/public/avatars/' in photo_url)
             + length('/storage/v1/object/public/avatars/')
      ),
      '?',
      1
    )
where photo_url like '%/storage/v1/object/public/avatars/%';
