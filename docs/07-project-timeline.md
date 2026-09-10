# 7. Project timeline

Reconstructed from 34 migrations, 77 commits, 40 security reports and 8
functional reports. The migrations start **2026-06-26**; the git history in
this repository starts **2026-07-31**, so the first five weeks are visible only
through migration timestamps and the audit reports.

---

## Phase 1 — Core product (26–28 June 2026)

Built fast, and built with the security model already in place rather than
bolted on later.

- **26 Jun** — `init_schema`: profiles, swipes, matches, messages. Matches
  never client-inserted. Avatar storage, bucket metadata policy, Realtime
  enabled on `messages`.
- **27 Jun** — Rate limits. Blocks and reports. Server-side candidate lookup
  (`get_candidate_profiles`), replacing a client that built an exclude-list and
  sent it as a giant `not in (...)` filter. Blocks wired into matching and
  messaging as defence in depth — *"the UI never shows a blocked user as a
  candidate, but `record_swipe()` is a public RPC any client could call."*
- **27 Jun** — Legal attestations, then age verification. The provider changed
  **twice in one day**: Yoti → AWS Rekognition → Face++.
- **27 Jun** — `protect_age_verified`: closed a hole where the "update your own
  profile" policy checked row ownership but not which columns changed, letting
  any user set their own verified badge.
- **28 Jun** — Website waitlist table.

## Phase 2 — Monetisation and compliance (22–25 July 2026)

- **22 Jul** — DPDP consents, recording the exact wording users agree to.
- **24 Jul** — **Proximity matching**, privacy-first: exact coordinates in a
  separate owner-only table, fuzzy distance bands for everyone else.
- **24 Jul** — Premium subscriptions, written only by the payment edge function.
- **24 Jul** — Refer & Earn with an append-only wallet ledger.
- **24 Jul** — Premium gating: 10 likes/24h free vs unlimited, priority
  discovery placement, "who liked you" behind the paywall.
- **25 Jul** — Launch promo: first 300 signups after 1 Sept get 15 days free.
- **25 Jul** — **Security fix**: three `SECURITY DEFINER` RPCs were callable
  unauthenticated by anon. All three exploitable. Found by the daily audit.

## Phase 3 — The DNS incident (22–24 July 2026)

The first audits found `nearmatch.in` **not resolving to Netlify at all**. The
apex A records pointed at GoDaddy infrastructure, so the live domain served a
GoDaddy Website Builder placeholder — which happened to also be titled
"NearMatch", making it easy to miss on a glance at the homepage. Every page
except `/` 404'd in production, including the Razorpay payment page and every
DPDP-relevant legal page.

The audit deliberately did **not** touch DNS: *"this is exactly the kind of
shared-infrastructure, hard-to-reverse change that needs the founder's explicit
decision."* Resolved by 5 August, when audits confirmed the site serving over
Netlify Edge with valid SSL.

## Phase 4 — Hardening and the recurring regression (31 Jul – 8 Aug 2026)

Where the git history begins.

- **31 Jul** — Removed a failing CI workflow. Fixed duplicate `react-native`
  install breaking EAS. Reverted the waitlist from Salesforce back to Supabase.
- **2 Aug** — Big security day: locked down RPC grants, rate-limited
  `create-razorpay-order` and pinned its CORS to `nearmatch.in`, dropped
  permissive `profile_locations` policies exposing exact GPS to any user.
- **2 Aug** — Waitlist notifications via Resend + ntfy.sh.
- **3 Aug** — **Expo SDK 54 → 57**. iPad support disabled (never designed for
  tablet). iOS submitted to App Review ~02:20 IST.
- **6–8 Aug** — The **CROSS JOIN regression**, three times (see below).
- **8 Aug** — Seed fixtures for App Store review. Reduce Motion respected in
  the swipe deck. `search_path` pinned on six linter-flagged functions.

### The CROSS JOIN regression

`get_candidate_profiles()` and `get_pending_likes()` both joined against a
`viewer_location` CTE. With `CROSS JOIN`, a viewer who had **no row** in
`profile_locations` got **zero candidates** — an empty app.

Fixed on **2 Aug** (`LEFT JOIN viewer_location ON TRUE`). Then found reverted in
production and re-applied on **5 Aug**. Then again on **7 Aug**. Then the
**source** was finally fixed on 8 Aug in the two migrations that kept
reintroducing it — `20260724000300_premium_gating.sql` and
`20260724000000_proximity_matching.sql` — which were being replayed and
overwriting the fix.

Three regressions of the same bug before anyone looked at where it was coming
from. The daily functional check now scans the entire schema for `cross join`
in `pg_proc` on every run.

## Phase 5 — The analytics bot (7–10 Aug 2026)

An automated integration added Vexo Analytics (PR #1). It also:

- **gutted `App.js`** — restored in PR #3 (`f83811b`)
- **broke the EAS build** with a lockfile mismatch — fixed in PR #2 (`cd83b13`)
- started collecting production telemetry **with no Privacy Policy disclosure**,
  which went unnoticed for nine days

## Phase 6 — Launch preparation (9–15 Aug 2026)

- **9 Aug** — Hero background video and new brand mark added to the website.
  *This is the 15 MB file that suspended the site eleven days later.*
- **9 Aug** — Independence Day pricing: 1/2/5-month bundles replacing
  monthly/quarterly.
- **10 Aug** — `auth.uid()` wrapped as `(select auth.uid())` across 22 RLS
  policies for the linter's `auth_rls_initplan` finding.
- **10 Aug** — **Avatar privacy fix** (PR #4): profile photos moved from a
  public bucket to a private one with signed URLs. Previously every avatar had
  a permanently valid URL anyone could fetch unauthenticated.
- **10 Aug** — Age-verification provider documented on the schema itself
  (PR #5), because reconstructing "who receives our users' selfies" meant
  reading three migrations in the right order.
- **15 Aug** — Version bumped to **1.0.1** for the avatar privacy release.

## Phase 7 — Vendor disclosure audit (16 Aug 2026)

Triggered by the question *"is there any third-party vendor who works for AI?"*
The answer was Face++ — and the audit that followed found the Privacy Policy
had drifted badly from what the code actually did. **PR #9:**

- Vexo disclosed (collecting undisclosed for nine days).
- A **real biometric consent step** built — the policy had claimed one existed
  since before there was any such thing.
- Google Analytics, Google Fonts and the host disclosed; the policy had
  contained no occurrence of "Google", "analytics" or "cookie" at all, while
  `privacy.html` was itself one of the instrumented pages.
- The website's no-account checkout path documented; the policy had said
  website collection was the waitlist "and only that".
- `netlify.toml` deleted as dead — **later reverted, see below**.

## Phase 8 — The bandwidth suspension (20 Aug 2026)

**Netlify suspended nearmatch.in** after the 15 MB hero video exhausted the
free tier's 100 GB monthly allowance.

PR #11 fixed it by attaching the video source at runtime only when the
connection can afford it, dropping mobile and reduced-motion views from 15.21 MB
to 0.25 MB. It also moved cache rules into `website/_headers` (read by both
Netlify and Cloudflare Pages) and added `vercel.json` for a www→apex redirect.

This collided with PR #9's deletion of `netlify.toml` and revealed that the
file was not dead after all — Netlify had been serving the apex the whole time,
and Cloudflare Pages is the migration target. The deletion was reverted in
merge commit `f6a5d4b`.

---

## Recurring patterns

Four things went wrong more than once. They are the honest lessons of this
project:

1. **Out-of-band schema drift.** Fixes applied directly to production without a
   migration, then silently reverted by a later replay. The CROSS JOIN bug
   three times; RLS fixes found live but untracked (`20260806000000`).
2. **Automated tooling causing damage.** The Vexo bot gutted `App.js` and broke
   the build. `npm audit fix` rewrote the lockfile with no security benefit and
   real breakage risk — run, then reverted, nothing committed.
3. **Documentation drifting from behaviour.** The Privacy Policy claimed a
   consent flow that did not exist and omitted three live processors.
4. **Assets shipped without a cost model.** A 15 MB autoplay video, unnoticed
   for eleven days, until the host pulled the site.
