-- Server-side candidate lookup. Replaces the client building an
-- exclude-list and sending it as a giant `not in (...)` filter — that
-- approach ships the caller's entire swipe history over the wire and
-- degrades linearly as it grows. This does the exclusion in the
-- database with index support, and returns only a page at a time.
--
-- Excludes: yourself, anyone you've already swiped on, and anyone with
-- a block between you in either direction.

create index swipes_swiper_id_idx on public.swipes (swiper_id);

create or replace function public.get_candidate_profiles(p_limit int default 30)
returns setof public.profiles
language sql
security definer
set search_path = public
stable
as $$
  select p.*
  from public.profiles p
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
  order by p.created_at desc
  limit greatest(1, least(p_limit, 100));
$$;

revoke all on function public.get_candidate_profiles(int) from public;
grant execute on function public.get_candidate_profiles(int) to authenticated;
