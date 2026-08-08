-- Independence Day pricing: website checkout now sells 1/2/5-month
-- Premium bundles (month1/month2/month5) instead of monthly/quarterly.
-- Old values are kept in the constraint (not dropped) so any existing
-- subscription rows already written with them stay valid — only the
-- website and edge functions stop issuing them going forward.
alter table public.subscriptions drop constraint subscriptions_plan_check;
alter table public.subscriptions add constraint subscriptions_plan_check
  check (plan in ('monthly', 'quarterly', 'launch_promo', 'month1', 'month2', 'month5'));
