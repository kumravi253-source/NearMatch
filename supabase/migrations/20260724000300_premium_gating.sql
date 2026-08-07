-- Wires is_premium() into actual product behavior:
--   1. Free users are capped at 10 likes per rolling 24h; Premium is
--      unlimited. Enforced inside record_swipe() itself — the only
--      write path for swipes — so it can't be bypassed by calling the
--      RPC directly with a different client.
--   2. Discovery ordering gives Premium profiles priority, ahead of
--      the existing distance/recency ordering.
--   3. get_pending_likes(): "see who liked you", gated to Premium.

create or replace function public.record_swipe(p_swiped_id uuid, p_direction text)
returns table (matched boolean, match_id bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_swiper_id uuid := auth.uid();
  v_reverse_like boolean;
  v_match_id bigint;
  v_user_a uuid;
  v_user_b uuid;
  v_recent_swipe_count int;
  v_blocked boolean;
  v_daily_like_count int;
begin
  if v_swiper_id is null then
    raise exception 'not authenticated';
  end if;

  if p_direction not in ('like', 'pass') then
    raise exception 'invalid direction';
  end if;

  if v_swiper_id = p_swiped_id then
    raise exception 'cannot swipe on yourself';
  end if;

  select count(*) into v_recent_swipe_count
  from public.swipes
  where swiper_id = v_swiper_id
    and created_at > now() - interval '1 minute';

  if v_recent_swipe_count >= 60 then
    raise exception 'rate_limit_exceeded: too many swipes, slow down';
  end if;

  if p_direction = 'like' and not public.is_premium(v_swiper_id) then
    select count(*) into v_daily_like_count
    from public.swipes
    where swiper_id = v_swiper_id
      and direction = 'like'
      and created_at > now() - interval '24 hours';

    if v_daily_like_count >= 10 then
      raise exception 'daily_like_limit_reached: free plan allows 10 likes per day';
    end if;
  end if;

  insert into public.swipes (swiper_id, swiped_id, direction)
  values (v_swiper_id, p_swiped_id, p_direction)
  on conflict (swiper_id, swiped_id) do update set direction = excluded.direction;

  if p_direction = 'pass' then
    return query select false, null::bigint;
    return;
  end if;

  select exists (
    select 1 from public.blocks
    where (blocker_id = v_swiper_id and blocked_id = p_swiped_id)
       or (blocker_id = p_swiped_id and blocked_id = v_swiper_id)
  ) into v_blocked;

  if v_blocked then
    return query select false, null::bigint;
    return;
  end if;

  select exists (
    select 1 from public.swipes
    where swiper_id = p_swiped_id
      and swiped_id = v_swiper_id
      and direction = 'like'
  ) into v_reverse_like;

  if not v_reverse_like then
    return query select false, null::bigint;
    return;
  end if;

  if v_swiper_id < p_swiped_id then
    v_user_a := v_swiper_id;
    v_user_b := p_swiped_id;
  else
    v_user_a := p_swiped_id;
    v_user_b := v_swiper_id;
  end if;

  insert into public.matches (user_a, user_b)
  values (v_user_a, v_user_b)
  on conflict (user_a, user_b) do nothing
  returning id into v_match_id;

  if v_match_id is null then
    select id into v_match_id from public.matches
    where user_a = v_user_a and user_b = v_user_b;
  end if;

  return query select true, v_match_id;
end;
$$;

-- Same candidate logic as the proximity-matching migration, with one
-- extra leading sort key: the candidate's own Premium status. A
-- Premium candidate outranks a non-Premium one regardless of
-- distance/recency; within the same Premium tier, prior ordering
-- (nearest first, or newest first with no viewer location) applies.
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

-- "See who liked you": everyone who swiped 'like' on the caller, that
-- the caller hasn't swiped on back yet (once they do, it's either a
-- match — visible in Matches — or a pass, and either way it should
-- drop out of this list). Premium-gated: raises a distinct error the
-- client uses to show an upsell instead of an empty list, so "no likes
-- yet" and "you're not Premium" never look the same to the user.
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
