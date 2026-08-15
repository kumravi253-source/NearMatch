-- Backfill for the pre-launch billing bug (see
-- security-reports/2026-08-10-full-audit.md, finding P0).
--
-- verify-razorpay-payment set starts_at = now() at the moment of payment,
-- while the pricing page sold these same plans on the promise that "Premium
-- activates the moment we launch on September 1, 2026." Every Independence
-- Day plan sold before launch therefore had its clock already running against
-- an app that does not exist yet: a ₹399 one-month bought on 2026-08-10
-- expired 2026-09-09, leaving 8 usable days out of 30, and the shortfall grew
-- by a day for every day closer to launch the sale happened.
--
-- The edge function now floors starts_at at launch. This repairs the rows
-- written before that fix.
--
-- The window is shifted forward whole rather than recomputed from
-- PLAN_DURATION_DAYS, so that any wallet bonus days already folded into
-- expires_at (see wallet_paise_applied) survive the correction untouched.
-- Postgres evaluates the right-hand side of an UPDATE against the old row, so
-- the expires_at expression below still sees the pre-shift starts_at.
--
-- Scoped to the three Independence Day plans, which are the only ones sold
-- under that promise. 'launch_promo' grants are excluded on purpose:
-- claim_launch_promo() is a hard no-op before launch, so those rows never
-- start early. Legacy 'monthly'/'quarterly' rows are left alone as well.
--
-- Idempotent: after this runs, no matching row has starts_at < launch.

update public.subscriptions
set
  expires_at = expires_at + ('2026-09-01 00:00:00+05:30'::timestamptz - starts_at),
  starts_at  = '2026-09-01 00:00:00+05:30'::timestamptz
where plan in ('month1', 'month2', 'month5')
  and starts_at < '2026-09-01 00:00:00+05:30'::timestamptz;
