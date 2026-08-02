-- Security fix: lock down SECURITY DEFINER RPCs that were callable by anon/authenticated
-- Found by daily security audit 2026-07-25. All three were exploitable unauthenticated.

-- 1. get_wallet_balance_paise: pin body to auth.uid() so callers can only see their own balance
create or replace function public.get_wallet_balance_paise(p_user_id uuid default auth.uid())
returns int
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(sum(amount_paise), 0)::int
  from public.wallet_transactions
  where user_id = auth.uid();
$$;
revoke all on function public.get_wallet_balance_paise(uuid) from public;
revoke execute on function public.get_wallet_balance_paise(uuid) from anon;
grant execute on function public.get_wallet_balance_paise(uuid) to authenticated;

-- 2. get_user_id_by_email: service_role only — only the verify-razorpay-payment edge function needs it
revoke all on function public.get_user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.get_user_id_by_email(text) to service_role;

-- 3. is_premium: pin body to auth.uid() so callers can only check their own status
create or replace function public.is_premium(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.subscriptions
    where user_id = auth.uid()
      and status = 'active'
      and expires_at > now()
  );
$$;
revoke all on function public.is_premium(uuid) from public;
revoke execute on function public.is_premium(uuid) from anon;
grant execute on function public.is_premium(uuid) to authenticated;
