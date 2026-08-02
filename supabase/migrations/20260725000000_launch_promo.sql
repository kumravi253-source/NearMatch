-- Launch promo: the first 300 people to sign up on or after launch
-- (Sept 1, 2026 IST) get 15 days of free Premium (unlimited likes,
-- priority discovery, Who Liked You). Reuses the existing
-- subscriptions/is_premium machinery — a promo grant IS a
-- subscription row, just with a distinct plan value and zero amount,
-- so every existing Premium check works on it unchanged.

alter table public.subscriptions drop constraint subscriptions_plan_check;
alter table public.subscriptions add constraint subscriptions_plan_check
  check (plan in ('monthly', 'quarterly', 'launch_promo'));

-- Grants the promo to the caller if: it hasn't launched yet (no-op,
-- returns false), they already have any subscription (no-op, false —
-- one shot per account, no stacking with a real purchase), or the
-- 300-slot cap is already full (false). Otherwise inserts a 15-day
-- subscription and returns true.
--
-- Note: there's a small race window between the count check and the
-- insert under concurrent signups right at launch, so the cap could
-- overshoot by a few under heavy simultaneous traffic. Acceptable for
-- a free promotional grant; not worth an advisory lock here.
create or replace function public.claim_launch_promo()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_promo_count int;
  v_has_subscription boolean;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if now() < '2026-09-01 00:00:00+05:30'::timestamptz then
    return false;
  end if;

  select exists(select 1 from public.subscriptions where user_id = v_user_id) into v_has_subscription;
  if v_has_subscription then
    return false;
  end if;

  select count(*) into v_promo_count from public.subscriptions where plan = 'launch_promo';
  if v_promo_count >= 300 then
    return false;
  end if;

  insert into public.subscriptions (
    user_id, plan, status, razorpay_order_id, razorpay_payment_id, amount_paise, starts_at, expires_at
  )
  values (
    v_user_id, 'launch_promo', 'active', 'launch_promo', 'launch_promo_' || v_user_id::text, 0, now(), now() + interval '15 days'
  );

  return true;
end;
$$;

revoke all on function public.claim_launch_promo() from public;
grant execute on function public.claim_launch_promo() to authenticated;

-- Lets the website show "X of 300 claimed" honestly, without exposing
-- the subscriptions table itself.
create or replace function public.get_launch_promo_claimed_count()
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from public.subscriptions where plan = 'launch_promo';
$$;

revoke all on function public.get_launch_promo_claimed_count() from public;
grant execute on function public.get_launch_promo_claimed_count() to authenticated, anon;
