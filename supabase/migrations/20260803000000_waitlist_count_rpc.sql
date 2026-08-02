-- Lets the website show live waitlist momentum pre-launch ("X people
-- already waiting") without exposing the waitlist table itself, which
-- has no anon SELECT policy (insert-only — see 20260628190000_waitlist.sql).
-- Same shape as get_launch_promo_claimed_count(): a count-only RPC is
-- safe to expose publicly since it leaks no emails, just a number.

create or replace function public.get_waitlist_count()
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from public.waitlist;
$$;

revoke all on function public.get_waitlist_count() from public;
grant execute on function public.get_waitlist_count() to authenticated, anon;
