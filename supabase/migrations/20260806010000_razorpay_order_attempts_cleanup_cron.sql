-- check_razorpay_order_rate_limit() only prunes rows for the IP that is
-- currently calling, so one-off callers (healthchecks, genuine single
-- checkout attempts) leave permanent orphan rows in
-- razorpay_order_attempts. Low-priority per the 2026-08-05/06 security
-- reports, but cheap to close fully with a daily sweep.

create extension if not exists pg_cron with schema pg_catalog;

select
  cron.schedule(
    'razorpay-order-attempts-cleanup',
    '0 3 * * *', -- daily at 03:00 UTC (08:30 IST)
    $$ delete from public.razorpay_order_attempts where created_at < now() - interval '1 day'; $$
  )
where not exists (
  select 1 from cron.job where jobname = 'razorpay-order-attempts-cleanup'
);
