# 3. Database schema

16 tables, 18 functions, RLS on everything. Postgres, hosted by Supabase
(project ref `ipwheuikchuoyskrfghi`). Defined by 34 migrations under
`supabase/migrations/`, running from 2026-06-26 to 2026-08-16.

## The governing principle

**The database, not the app, decides who can see what.** RLS is enabled on
every public table. Where a rule is more complex than row ownership, writes go
through a `SECURITY DEFINER` RPC that is the *only* write path — so calling the
REST API directly with the anon key gets you nothing the app wouldn't.

Three tables have **no insert policy at all**: `age_verifications`,
`biometric_consents`, and `subscriptions`. Only edge functions using the
service role write them. A user must never be able to assert their own passing
age check, their own consent record, or their own Premium status.

## Tables

### Core — `20260626204436_init_schema.sql`

**`profiles`** — one row per user, keyed to `auth.users.id`.
`name` (1-50 chars), `age` (18-120, enforced by check constraint), `gender`
(Man / Woman / Non-binary), `bio` (≤500, optional), `avatar_emoji`,
`photo_url`, `interests` (text array), timestamps.
Later additions: `age_verified` (public "Verified" badge), `referral_code`.

**`swipes`** — `swiper_id`, `swiped_id`, `direction` (like/pass).
Unique on the pair; a check prevents swiping yourself. **No insert policy** —
writes only via `record_swipe()`.

**`matches`** — `user_a`, `user_b`, unique pair, with `check (user_a < user_b)`
so a pair can only be stored one way round and duplicates are impossible.
Never client-inserted; created by `record_swipe()` on mutual likes.

**`messages`** — `match_id`, `sender_id`, `body` (1-2000 chars). Published to
Realtime. Rate-limited by trigger.

### Safety — `20260627000200_blocks_and_reports.sql`

**`blocks`** — `blocker_id`, `blocked_id`, unique pair, no self-blocks.
**`reports`** — `reporter_id`, `reported_id`, `reason` (one of
inappropriate_photos / harassment / fake_profile / spam / other), optional
`details` (≤1000).

Both are direct-insert + RLS rather than RPC-wrapped, because the access rules
are simple enough that a policy expresses them completely.

### Location — `20260724000000_proximity_matching.sql`

**`profile_locations`** — `user_id` (PK), `latitude`, `longitude`, `updated_at`.
Range-checked. **Readable only by its owner.** This separation is the whole
privacy design: exact coordinates never leave this table, and other users only
receive a fuzzy band computed server-side by `fuzzy_distance_label()`.

### Money — `20260724000100` / `20260724000200`

**`subscriptions`** — `plan`, `status` (active/cancelled/expired),
`razorpay_order_id`, `razorpay_payment_id` (unique — replay protection),
`amount_paise`, `wallet_paise_applied`, `starts_at`, `expires_at`.

The `plan` check constraint has been widened twice as the product changed:
`('monthly','quarterly')` → `+ 'launch_promo'` → `+ 'month1','month2','month5'`.
A promo grant is an ordinary subscription row with a distinct plan and zero
amount, so every Premium check works on it without modification.

**`referrals`** — `referrer_id`, `referred_id` (unique — one referrer per
person), no self-referral.

**`wallet_transactions`** — append-only ledger. `amount_paise` (non-zero),
`reason` (referral_bonus / premium_redemption), `reference_id`. Balance is the
**sum of the ledger, not a mutable counter**, so it cannot be pushed negative
or double-credited by a retry.

**`razorpay_order_attempts`** — IP-keyed rate-limit ledger for anonymous
website checkout. Pruned by a daily cron.

### Legal and verification

**`legal_attestations`** — the verbatim 18+ wording a user agreed to, and when.
One row per user.

**`dpdp_consents`** — the verbatim DPDP Act 2023 consent wording, and when.
One row per user.

**`age_verifications`** — outcome-only record: `provider`, `passed`,
`estimated_age_min`, `estimated_age_max`, `verified_at`. **The selfie itself is
never stored** — not in this table, not in storage, not in logs. The `provider`
column is per-row so historical results stay attributable across provider
changes (yoti → aws_rekognition → facepp).

**`biometric_consents`** — added 2026-08-16. One row **per transmission**, not
per user, because each verification attempt sends a fresh image and so needs
its own consent event. Written by the edge function immediately *before* the
image is sent, so "consent was recorded before the image left the country" is
a control-flow guarantee rather than a convention.

### Website

**`waitlist`** — `email` (unique), `created_at`. Anon can insert (that is the
entire point of a public signup form) but never read. The public count is
exposed only through `get_waitlist_count()`.

**`rate_limits`** — server-side abuse caps.

## Functions

| Function | Purpose |
|---|---|
| `record_swipe` | The only swipe write path. Enforces like-caps, block checks, creates matches on mutual likes |
| `get_candidate_profiles` | Server-side discovery deck: excludes swiped, blocked (both directions), and self |
| `get_pending_likes` | "Who liked you" — Premium-gated |
| `is_premium` | Single source of truth for Premium status |
| `fuzzy_distance_label` | Turns two coordinate pairs into a band like "3-5 km away" |
| `haversine_km` | Distance maths |
| `record_referral` / `set_referral_code` / `generate_referral_code` | Refer & Earn |
| `get_wallet_balance_paise` | Sums the append-only ledger |
| `claim_launch_promo` / `get_launch_promo_claimed_count` | First-300 promo |
| `get_waitlist_count` | Public counter without exposing the table |
| `enforce_message_rate_limit` | Trigger — message flooding |
| `check_razorpay_order_rate_limit` | Per-IP cap on anonymous order creation |
| `protect_age_verified` | Trigger — stops users flipping their own verified flag |
| `get_user_id_by_email` | Matches a pre-launch purchase to an account |
| `set_updated_at` | Standard timestamp trigger |

## Security hardening applied over time

- **`20260627003100`** — column-level protection for `age_verified`. The
  existing "update your own profile" policy checked row ownership but not
  *which columns* changed, so any user could have set their own verified badge.
- **`20260725000001`** — locked down three `SECURITY DEFINER` RPCs that were
  callable unauthenticated by anon. Found by the daily audit; all three were
  exploitable.
- **`20260802000001`** — dropped permissive `profile_locations` policies that
  exposed exact GPS to any authenticated user.
- **`20260808000000`** — pinned `search_path` on six functions flagged by the
  Supabase linter (`function_search_path_mutable`).
- **`20260810000000`** — wrapped `auth.uid()` as `(select auth.uid())` in 22
  RLS policies, for the linter's `auth_rls_initplan` performance finding.
- **`20260810100000`** — moved profile photos to a **private** bucket with
  signed URLs. Previously every avatar had a permanently valid public URL
  fetchable by anyone, unauthenticated.

## Known schema concern

`razorpay_order_attempts` still carries an `anon_select_...` policy with
`qual=true` — an unrestricted read policy for the anonymous role. It is
**dormant, not exploitable**: no table-level `GRANT SELECT` to `anon` exists,
so live requests get `42501 permission denied`. But the policy is wrong-shaped
and would silently expose every row (order attempts, IPs, timestamps) the
moment any future migration adds that grant. Carried in the security reports as
unresolved since 2026-08-09. See [open items](09-open-items.md).
