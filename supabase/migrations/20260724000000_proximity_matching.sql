-- Proximity matching, privacy-first: exact coordinates are never
-- readable by anyone except their owner. `public.profiles` already has
-- a blanket "viewable by authenticated users" SELECT policy, so lat/lng
-- cannot live there — any user could just select it directly. Instead,
-- location lives in its own owner-only table, and the only thing that
-- ever leaves it for other users is a fuzzy distance bucket computed
-- server-side.

create table public.profile_locations (
  user_id uuid primary key references auth.users (id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  updated_at timestamptz not null default now()
);

alter table public.profile_locations enable row level security;

create policy "users can manage their own location"
  on public.profile_locations for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create trigger profile_locations_set_updated_at
  before update on public.profile_locations
  for each row execute function public.set_updated_at();

-- Haversine distance in km between two lat/lng points.
create or replace function public.haversine_km(
  lat1 double precision, lon1 double precision,
  lat2 double precision, lon2 double precision
)
returns double precision
language sql
immutable
parallel safe
as $$
  select 6371 * acos(
    least(1.0, greatest(-1.0,
      sin(radians(lat1)) * sin(radians(lat2))
      + cos(radians(lat1)) * cos(radians(lat2)) * cos(radians(lon2 - lon1))
    ))
  );
$$;

-- Buckets a raw distance into a fuzzy, non-reversible label. This is
-- the actual privacy mechanism — even the app itself never receives a
-- precise figure for another user, only this.
create or replace function public.fuzzy_distance_label(km double precision)
returns text
language sql
immutable
parallel safe
as $$
  select case
    when km is null then null
    when km < 1 then 'Less than 1 km away'
    when km < 3 then '1-3 km away'
    when km < 5 then '3-5 km away'
    when km < 10 then '5-10 km away'
    when km < 25 then '10-25 km away'
    when km < 50 then '25-50 km away'
    when km < 100 then '50-100 km away'
    else '100+ km away'
  end;
$$;

-- Replaces get_candidate_profiles: same exclusion logic as before
-- (self, already-swiped, blocked either direction), now also nearest
-- first when the viewer has a location on file, falling back to the
-- original newest-first ordering when they don't (e.g. denied the
-- permission prompt). Returns a distance_label, never raw distance or
-- coordinates.
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
  cross join viewer_location v
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
    case when v.latitude is null then p.created_at end desc,
    case when v.latitude is not null then public.haversine_km(v.latitude, v.longitude, pl.latitude, pl.longitude) end asc nulls last
  limit greatest(1, least(p_limit, 100));
$$;

revoke all on function public.get_candidate_profiles(int) from public;
grant execute on function public.get_candidate_profiles(int) to authenticated;

revoke all on function public.haversine_km(double precision, double precision, double precision, double precision) from public;
grant execute on function public.haversine_km(double precision, double precision, double precision, double precision) to authenticated;

revoke all on function public.fuzzy_distance_label(double precision) from public;
grant execute on function public.fuzzy_distance_label(double precision) to authenticated;
