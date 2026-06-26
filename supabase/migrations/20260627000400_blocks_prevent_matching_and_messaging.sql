-- Defense in depth: the UI never shows a blocked user as a swipe
-- candidate, but record_swipe() is a public RPC any client could call
-- directly with an arbitrary id. Without a check here, a match (and
-- therefore a messaging channel) could still form between two users
-- where one has blocked the other. Block first, match never; if a
-- match already existed before the block, messaging is shut down too.

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

-- Shut down messaging in any match where a block exists between the
-- two participants, regardless of when the block was created relative
-- to the match.
drop policy if exists "participants can send messages in their matches" on public.messages;

create policy "participants can send messages in their matches"
  on public.messages for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.matches m
      where m.id = match_id
        and (m.user_a = auth.uid() or m.user_b = auth.uid())
    )
    and not exists (
      select 1 from public.matches m
      join public.blocks b
        on (b.blocker_id = m.user_a and b.blocked_id = m.user_b)
        or (b.blocker_id = m.user_b and b.blocked_id = m.user_a)
      where m.id = match_id
    )
  );
