-- Re-apply of 20260802000002_fix_candidate_location_cross_join.sql.
-- The 2026-08-02 fix (LEFT JOIN viewer_location ON TRUE) was found reverted
-- in production on 2026-08-05 — both functions were back to CROSS JOIN,
-- even though schema_migrations still listed 20260802000002 as applied and
-- the local migration file was untouched. The live function must have been
-- altered directly (e.g. via SQL Editor) outside the migration pipeline.
-- This migration re-applies the identical fix so schema_migrations carries
-- an explicit record tied to the 2026-08-05 incident, and reasserts intent
-- for anyone diffing migration history against live state.

create or replace function public.get_candidate_profiles(p_limit int default 30)
returns table (
  id uuid,
  name text,
  age int,
  gender text,
  bio text,
  avatar_emoji text,
  photo_url text,
  interests text[],
  created_at timestamptz,
  updated_at timestamptz,
  age_verified boolean,
  distance_label text
)
language sql
security definer
set search_path = public
stable
as $$
  with viewer_location as (
    select latitude, longitude from public.profile_locations where user_id = auth.uid()
  )
  select
    p.id, p.name, p.age, p.gender, p.bio, p.avatar_emoji, p.photo_url,
    p.interests, p.created_at, p.updated_at, p.age_verified,
    public.fuzzy_distance_label(
      public.haversine_km(v.latitude, v.longitude, pl.latitude, pl.longitude)
    ) as distance_label
  from public.profiles p
  left join public.profile_locations pl on pl.user_id = p.id
  left join viewer_location v on true
  where p.id <> auth.uid()
    and not exists (
      select 1 from public.swipes s
      where s.swiper_id = auth.uid() and s.swiped_id = p.id
    )
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = p.id)
         or (b.blocker_id = p.id and b.blocked_id = auth.uid())
    )
  order by
    public.is_premium(p.id) desc,
    case when v.latitude is null then p.created_at end desc,
    case when v.latitude is not null then public.haversine_km(v.latitude, v.longitude, pl.latitude, pl.longitude) end asc nulls last
  limit greatest(1, least(p_limit, 100));
$$;

revoke all on function public.get_candidate_profiles(int) from public;
grant execute on function public.get_candidate_profiles(int) to authenticated;

create or replace function public.get_pending_likes(p_limit int default 30)
returns table (
  id uuid,
  name text,
  age int,
  bio text,
  avatar_emoji text,
  photo_url text,
  interests text[],
  age_verified boolean,
  distance_label text
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.is_premium(auth.uid()) then
    raise exception 'premium_required: see who liked you is a Premium feature';
  end if;

  return query
  with viewer_location as (
    select latitude, longitude from public.profile_locations where user_id = auth.uid()
  )
  select
    p.id, p.name, p.age, p.bio, p.avatar_emoji, p.photo_url,
    p.interests, p.age_verified,
    public.fuzzy_distance_label(
      public.haversine_km(v.latitude, v.longitude, pl.latitude, pl.longitude)
    ) as distance_label
  from public.swipes s
  join public.profiles p on p.id = s.swiper_id
  left join public.profile_locations pl on pl.user_id = p.id
  left join viewer_location v on true
  where s.swiped_id = auth.uid()
    and s.direction = 'like'
    and not exists (
      select 1 from public.swipes s2
      where s2.swiper_id = auth.uid() and s2.swiped_id = s.swiper_id
    )
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = p.id)
         or (b.blocker_id = p.id and b.blocked_id = auth.uid())
    )
  order by s.created_at desc
  limit greatest(1, least(p_limit, 100));
end;
$$;

revoke all on function public.get_pending_likes(int) from public;
grant execute on function public.get_pending_likes(int) to authenticated;
