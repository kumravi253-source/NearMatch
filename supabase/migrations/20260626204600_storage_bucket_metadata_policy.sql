-- storage.buckets has its own RLS, separate from storage.objects.
-- Without this, GET /storage/v1/bucket(/:id) returns nothing for
-- anon/authenticated clients even though the bucket exists and its
-- objects are correctly readable. Harmless to expose bucket metadata
-- (name/public flag) for a bucket that's already public.

create policy "avatars bucket metadata is readable"
  on storage.buckets for select
  to public
  using (id = 'avatars');
