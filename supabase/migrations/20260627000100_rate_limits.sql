-- Server-side rate limiting. These caps exist to stop scripted abuse
-- (mass-liking, message-flooding), not to throttle normal human use —
-- the thresholds are well above anything a real person hits by hand.

-- Swipes: enforced inside record_swipe() itself, since that's already
-- the only write path for swipes (no direct insert policy exists).
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

  insert into public.swipes (swiper_id, swiped_id, direction)
  values (v_swiper_id, p_swiped_id, p_direction)
  on conflict (swiper_id, swiped_id) do update set direction = excluded.direction;

  if p_direction = 'pass' then
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

-- Messages: clients insert directly (governed by RLS for ownership/match
-- membership), so the rate limit goes in a BEFORE INSERT trigger rather
-- than a wrapper function — it applies no matter how the row gets there.
create or replace function public.enforce_message_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recent_count int;
begin
  select count(*) into v_recent_count
  from public.messages
  where sender_id = new.sender_id
    and created_at > now() - interval '1 minute';

  if v_recent_count >= 30 then
    raise exception 'rate_limit_exceeded: too many messages, slow down';
  end if;

  return new;
end;
$$;

create trigger messages_rate_limit
  before insert on public.messages
  for each row
  execute function public.enforce_message_rate_limit();
