-- Premium subscriptions. Rows here are only ever written by the
-- verify-razorpay-payment edge function (service role), after it has
-- independently verified the payment with Razorpay's HMAC signature —
-- never by a client claiming "I paid." No insert/update/delete policy
-- exists for authenticated users; select-your-own is all clients get.

create table public.subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  plan text not null check (plan in ('monthly', 'quarterly')),
  status text not null default 'active' check (status in ('active', 'cancelled', 'expired')),
  razorpay_order_id text not null,
  razorpay_payment_id text not null unique,
  amount_paise int not null check (amount_paise >= 0),
  wallet_paise_applied int not null default 0 check (wallet_paise_applied >= 0),
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

create policy "users can view their own subscriptions"
  on public.subscriptions for select
  to authenticated
  using (user_id = auth.uid());

create index subscriptions_user_id_idx on public.subscriptions (user_id);
create index subscriptions_active_idx on public.subscriptions (user_id, expires_at) where status = 'active';

-- True if the given user (default: caller) has any active, unexpired
-- subscription. SECURITY DEFINER so it can be called by any
-- authenticated user to check ANY other user's status (needed for
-- discovery-priority ordering), without granting general read access
-- to the subscriptions table itself.
create or replace function public.is_premium(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.subscriptions
    where user_id = p_user_id
      and status = 'active'
      and expires_at > now()
  );
$$;

revoke all on function public.is_premium(uuid) from public;
grant execute on function public.is_premium(uuid) to authenticated;

-- Resolves an email to an auth.users id. Used only by the
-- verify-razorpay-payment edge function to link a website purchase
-- (which has no app session, just an email typed into the payment
-- modal) to the matching NearMatch account. Deliberately NOT granted
-- to authenticated/anon — email-to-user-id lookup is an enumeration
-- risk if exposed to clients, so only the service role (used
-- exclusively by trusted edge functions) can call it.
create or replace function public.get_user_id_by_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select id from auth.users where lower(email) = lower(p_email) limit 1;
$$;

revoke all on function public.get_user_id_by_email(text) from public;
grant execute on function public.get_user_id_by_email(text) to service_role;
