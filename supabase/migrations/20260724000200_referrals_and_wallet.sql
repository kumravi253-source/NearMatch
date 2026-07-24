-- Refer & Earn: every profile gets a short referral code; a new user
-- who signed up with someone's code creates a referrals row, which
-- credits the referrer's wallet ledger. Wallet balance is the sum of
-- an append-only ledger, not a mutable counter, so it can never be
-- pushed negative or double-credited by a retry.

alter table public.profiles add column referral_code text unique;

create or replace function public.generate_referral_code()
returns text
language plpgsql
as $$
declare
  v_code text;
  v_exists boolean;
begin
  loop
    v_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 7));
    select exists(select 1 from public.profiles where referral_code = v_code) into v_exists;
    exit when not v_exists;
  end loop;
  return v_code;
end;
$$;

create or replace function public.set_referral_code()
returns trigger
language plpgsql
as $$
begin
  if new.referral_code is null then
    new.referral_code := public.generate_referral_code();
  end if;
  return new;
end;
$$;

create trigger profiles_set_referral_code
  before insert on public.profiles
  for each row
  execute function public.set_referral_code();

-- Backfill codes for any profiles that already existed before this
-- migration (there are none in production yet, but this makes the
-- migration correct regardless of when it runs).
update public.profiles set referral_code = public.generate_referral_code() where referral_code is null;

alter table public.profiles alter column referral_code set not null;

-- ---------------------------------------------------------------------
-- referrals
-- ---------------------------------------------------------------------
create table public.referrals (
  id bigint generated always as identity primary key,
  referrer_id uuid not null references auth.users (id) on delete cascade,
  referred_id uuid not null unique references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (referrer_id <> referred_id)
);

alter table public.referrals enable row level security;

create policy "users can view referrals they made"
  on public.referrals for select
  to authenticated
  using (referrer_id = auth.uid());

-- ---------------------------------------------------------------------
-- wallet_transactions: append-only ledger, no client writes at all —
-- only record_referral() below and the verify-razorpay-payment edge
-- function (service role, for redemption debits) ever insert here.
-- ---------------------------------------------------------------------
create table public.wallet_transactions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  amount_paise int not null check (amount_paise <> 0),
  reason text not null check (reason in ('referral_bonus', 'premium_redemption')),
  reference_id bigint,
  created_at timestamptz not null default now()
);

alter table public.wallet_transactions enable row level security;

create policy "users can view their own wallet transactions"
  on public.wallet_transactions for select
  to authenticated
  using (user_id = auth.uid());

create index wallet_transactions_user_id_idx on public.wallet_transactions (user_id);

create or replace function public.get_wallet_balance_paise(p_user_id uuid default auth.uid())
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(amount_paise), 0)::int
  from public.wallet_transactions
  where user_id = p_user_id;
$$;

revoke all on function public.get_wallet_balance_paise(uuid) from public;
grant execute on function public.get_wallet_balance_paise(uuid) to authenticated;

-- record_referral: called once, right after a brand-new signup, with
-- whatever code (if any) the user typed in on the signup form. Only
-- ever credits the referrer of the CALLER's own new signup — a client
-- cannot use this to credit arbitrary referral pairs or replay bonuses
-- (unique constraint on referred_id makes it a one-shot per account).
create or replace function public.record_referral(p_referral_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_user_id uuid := auth.uid();
  v_referrer_id uuid;
  v_referral_id bigint;
begin
  if v_new_user_id is null then
    raise exception 'not authenticated';
  end if;

  if p_referral_code is null or length(trim(p_referral_code)) = 0 then
    return;
  end if;

  select id into v_referrer_id
  from public.profiles
  where referral_code = upper(trim(p_referral_code));

  if v_referrer_id is null or v_referrer_id = v_new_user_id then
    return;
  end if;

  insert into public.referrals (referrer_id, referred_id)
  values (v_referrer_id, v_new_user_id)
  on conflict (referred_id) do nothing
  returning id into v_referral_id;

  if v_referral_id is not null then
    insert into public.wallet_transactions (user_id, amount_paise, reason, reference_id)
    values (v_referrer_id, 10000, 'referral_bonus', v_referral_id);
  end if;
end;
$$;

revoke all on function public.record_referral(text) from public;
grant execute on function public.record_referral(text) to authenticated;
