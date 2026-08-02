-- Rate limit for create-razorpay-order. Unlike the swipe/message limits in
-- rate_limits.sql, this endpoint is called anonymously from the public
-- website checkout (no NearMatch login, so no auth.uid() to key on) — this
-- keys on caller IP instead. Only reachable via service_role: the edge
-- function calls it with the service key, it's never exposed to anon/
-- authenticated via RLS/PostgREST directly.

create table if not exists public.razorpay_order_attempts (
  id bigserial primary key,
  ip inet not null,
  created_at timestamptz not null default now()
);

create index if not exists razorpay_order_attempts_ip_idx
  on public.razorpay_order_attempts (ip);

revoke all on table public.razorpay_order_attempts from public, anon, authenticated;
grant all on table public.razorpay_order_attempts to service_role;

create or replace function public.check_razorpay_order_rate_limit(p_ip inet)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recent_count int;
begin
  -- Prune this IP's old attempts first, so the table can't grow
  -- unbounded without needing a separate cleanup job.
  delete from public.razorpay_order_attempts
  where ip = p_ip and created_at <= now() - interval '10 minutes';

  select count(*) into v_recent_count
  from public.razorpay_order_attempts
  where ip = p_ip;

  if v_recent_count >= 5 then
    raise exception 'rate_limit_exceeded: too many order attempts, try again later';
  end if;

  insert into public.razorpay_order_attempts (ip) values (p_ip);
end;
$$;

revoke all on function public.check_razorpay_order_rate_limit(inet) from public, anon, authenticated;
grant execute on function public.check_razorpay_order_rate_limit(inet) to service_role;
