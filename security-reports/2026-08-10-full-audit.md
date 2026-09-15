# NearMatch — Full Repository Audit & Launch Readiness Report

**Date:** 2026-08-10
**Scope:** Entire repository from first commit (`init_schema`, 2026-06-26) to HEAD (`bd857b9`)
**Launch date on record:** **September 1, 2026, 00:00 IST** (hardcoded in `website/index.html:454`, `claim_launch_promo()`, and stated on `website/pricing.html`)
**Days remaining:** 22

## What this audit could and could not check

**Checked:** all 48 migrations, all 5 edge functions, all app source, the website, config, git history, dependency tree.

**NOT checked — be aware the picture is incomplete:**
- **The live production database.** The Supabase MCP connector requires OAuth and this session is non-interactive. Everything below about the database is read from migration files, which — see Finding P11 — are *not* a reliable mirror of production.
- **App Store Connect.** No browser session. Review status, TestFlight build 11 health, and crash data are unverified. Last confirmed status was "Waiting for Review" as of 2026-08-07, roughly 7 days ago.

---

# REPORT 1 — What is working, verified, no action needed

These were read in full and are correct. Do not spend time here.

| # | Area | Verified |
|---|------|----------|
| 1 | **RLS architecture** | Every public table has `enable row level security` plus explicit policies. Deny-by-default throughout: `swipes`, `matches`, `subscriptions`, `wallet_transactions`, `age_verifications` have **no** client INSERT/UPDATE/DELETE policies at all. |
| 2 | **Write paths** | Swipes and matches can only be created by `record_swipe()` (SECURITY DEFINER). A client cannot forge a match by inserting a row. `matches` also carries `check (user_a < user_b)` + unique, so a pair can't be duplicated. |
| 3 | **Swipe rate limiting** | **Present and working** — 60 swipes/minute enforced *inside* `record_swipe()` (`20260627000100_rate_limits.sql:33`, carried forward into `20260724000300`). Plus a free-tier cap of 10 likes / rolling 24h. |
| 4 | **Message rate limiting** | `enforce_message_rate_limit()` BEFORE INSERT trigger, 30/min. Sits on the table, so it applies regardless of client. |
| 5 | **Razorpay payment verification** | Genuinely well built. HMAC-SHA256 signature check, then an **independent server-to-server re-fetch** of the payment from Razorpay, then `status == captured`, `order_id` match, and `amount` match against the server-side plan table. Client claims are never trusted. |
| 6 | **Payment idempotency** | `subscriptions.razorpay_payment_id` is `unique` + `resolution=ignore-duplicates`. A replayed webhook cannot double-grant. |
| 7 | **Email enumeration** | `get_user_id_by_email()` is `revoke all from public, anon, authenticated` and granted **only to service_role** (`20260725000001`). Correct. |
| 8 | **Block enforcement** | Bidirectional (blocker→blocked AND blocked→blocker) in `get_candidate_profiles`, `get_pending_likes`, and `record_swipe`, plus client-side filtering in Matches and Chat. Four layers. |
| 9 | **App Store UGC requirements (1.2)** | Report, Block, and Delete Account are all wired in the app — `SwipeScreen.js:131,180,181` and `ChatScreen.js:221,222`. |
| 10 | **Account deletion** | `delete-account` takes the user id from `ctx.userClaims`, **never** from the request body. You cannot delete someone else's account. Cascades correctly through every FK. |
| 11 | **Avatar privacy** | Bucket made private, reads via short-lived (1h) signed URLs, `authenticated`-only storage policy, and a backfill that rewrites old public URLs to bare paths. `src/lib/avatars.js` handles both shapes and degrades to no-photo rather than crashing. (Deployment ordering is a problem — see P1 — but the code itself is right.) |
| 12 | **Secrets hygiene** | No secrets anywhere in the repo. `.env` gitignored, only `.env.example` tracked. `.gitignore` covers `*.jks`, `*.p8`, `*.p12`, `*.key`, `*.pem`, `*.mobileprovision`, and `.claude/settings.local.json`. `seed.sql` deliberately leaves `encrypted_password` NULL. |
| 13 | **Apple 3.1.1 compliance** | Premium purchase links are hidden on iOS in **both** places (`SwipeScreen.js:148`, `LikesScreen.js:68`). This is the right call and would otherwise be a guaranteed rejection. |
| 14 | **Wallet integrity** | Append-only ledger (`wallet_transactions`), balance is `sum()`, not a mutable counter. Cannot be pushed negative or double-credited by a retry. |
| 15 | **Referral integrity** | `record_referral()` only ever credits the *caller's own* referrer. Self-referral blocked, one-shot per account via `unique (referred_id)`. |
| 16 | **CROSS JOIN regression** | Fixed at source in `20260724000300_premium_gating.sql`. Both functions use the `left join viewer_location on true` pattern. No occurrence remains in any migration file. |
| 17 | **Dependency currency** | Expo SDK 57 / React Native 0.86.2 / React 19.2.3 — current, not stale. |
| 18 | **DB hardening** | `search_path` pinned on all SECURITY DEFINER functions (`20260808000000`); `auth.uid()` wrapped as `(select auth.uid())` in 22 RLS policies for per-row re-evaluation performance (`2c6b2dc`). |
| 19 | **Order-attempt rate limiting** | IP-keyed, 5 per 10 min, table `revoke all from public, anon, authenticated`, plus a daily pg_cron sweep for orphan rows. |
| 20 | **Legal pages** | Privacy, Terms, Refund, Support, About all present and returning content; privacy policy explicitly covers DPDP Data Principal rights. |

---

# REPORT 2 — Problems, ranked by how much damage they do

## 🔴 P0 — Pre-launch Premium sales are burning down before launch. Live right now.

**This is the most damaging thing in the repo, and it is taking real money today.**

`website/pricing.html:303` promises:
> "Pay once now at Independence Day pricing — **Premium activates the moment we launch on September 1, 2026**."

`supabase/functions/verify-razorpay-payment/index.ts` does:
```ts
const startsAt = new Date();                                    // ← NOW, not Sept 1
const expiresAt = new Date(startsAt.getTime() + durationDays * 24*60*60*1000);
```

A customer paying ₹399 for "1 month" today (Aug 10) gets a subscription that **expires September 9** — 8 usable days out of the 30 they paid for. The 2-month buyer loses 22 of 60. Every pre-launch sale short-changes the customer, and the gap grows every day until launch.

**Consequences:** direct contradiction between a written commercial promise and system behaviour; refund liability; consumer-protection exposure in India; and it will surface as angry users in week one of launch — exactly the wrong first impression.

**Fix:** floor the start date at launch.
```ts
const LAUNCH_AT = new Date('2026-09-01T00:00:00+05:30');
const now = new Date();
const startsAt = now > LAUNCH_AT ? now : LAUNCH_AT;
```
Then **backfill every subscription row already sold at Independence Day pricing** (`plan in ('month1','month2','month5')`) to `starts_at = 2026-09-01T00:00+05:30` and shift `expires_at` accordingly. Do this before any more sales land.

## 🔴 P1 — Applying the avatar migration will break every build already shipped.

`20260810100000_private_avatars_signed_urls.sql` makes the bucket private. The client code that mints signed URLs (`src/lib/avatars.js`) landed **today**, in commit `4ba63a4`.

The binary currently in App Store review — and TestFlight build 11 — was built around **Aug 3**. It has no signed-URL code; it reads `profiles.photo_url` as a fully-qualified public URL. The migration *also rewrites those column values to bare paths*.

**The moment that migration is applied to production, every profile photo in every already-installed build goes blank.** Including the build Apple reviewers may be looking at.

**Fix:** this is a deploy-ordering problem, not a code problem. Ship the 1.0.1 build first (PR #6 exists for exactly this), confirm it is live and adopted, *then* apply the migration. Or split it: make the bucket private now but leave `photo_url` rewriting for later, since signed URLs work against public buckets too.

## 🟠 P2 — DPDP consent records are being created without ever asking the user.

`App.js:108` writes a `dpdp_consents` row containing `DPDP_CONSENT_TEXT` for **every** authenticated session.

`AuthScreen.js` shows exactly one checkbox: the 18+ age attestation. **The DPDP consent text is never displayed to the user anywhere in the app.**

The migration comment (`20260722000000_dpdp_consents.sql:4`) asserts *"the signup form requires acceptance before it submits"* — that statement is false as written.

You are generating a durable, timestamped audit trail claiming informed consent that was never obtained. Under the DPDP Act 2023 consent must be free, specific, informed, and given by clear affirmative action. A fabricated consent log is worse than no consent log, because it is evidence.

**Fix:** add a second checkbox to the signup form showing `DPDP_CONSENT_TEXT`, required before submit, exactly as the age attestation works. ~20 lines.

## 🟠 P3 — There is no password reset. At all.

`AuthScreen.js` has sign-in, sign-up, and nothing else. No "Forgot password", no call to `resetPasswordForEmail`.

Any user who forgets their password is **permanently locked out with no self-service recovery**. On a consumer app this generates support email from day one and there is no support tooling either (see Report 3).

**Fix:** `supabase.auth.resetPasswordForEmail()` + a deep-link handler. Half a day.

## 🟠 P4 — `waitlist-notification` is a completely unauthenticated, injectable endpoint.

`supabase/functions/waitlist-notification/index.ts`:
- **No auth check of any kind.** No JWT, no webhook secret, no signature verification. Anyone who learns the URL can POST arbitrary JSON.
- **Unlimited outbound email through your Resend account** — quota exhaustion and, worse, reputational damage to the `nearmatch.in` sending domain, which you will need on launch day.
- **Raw HTML injection**: `${email}` is interpolated unescaped into the email body. An attacker controls markup and links in mail arriving in your own inbox from your own verified domain.
- **Leaks your Supabase project ref** (`ipwheuikchuoyskrfghi`) in the email footer.
- The ntfy topic defaults to a guessable `nearmatch-waitlist`, so push spam is trivial.

**Fix:** verify a shared secret header from the DB webhook, HTML-escape `email`, cap length, drop the dashboard link.

## 🟠 P5 — Age verification rejects the exact demographic you are building for.

`verify-age/index.ts`: `MIN_AGE = 18`, `AGE_MARGIN = 5`, and the pass condition is `estimatedAge - 5 >= 18`, i.e. **Face++ must estimate the user at 23 or older**.

For an Indian dating app, 18–22 is your core user base. Most of them will submit a selfie and be told *"We couldn't verify your age from that photo."* They will conclude the feature is broken — it isn't, it's working as coded, and the coded behaviour is wrong for the audience.

It's a badge, not a gate, so it doesn't block signup. But it is a visibly broken-feeling feature for the majority of your users on day one.

**Fix:** drop `AGE_MARGIN` to 2, or compare against the raw estimate with a distinct "borderline — manual review" outcome instead of a flat rejection.

## 🟠 P6 — iOS users cannot buy Premium. There is no path at all.

The `Platform.OS === 'ios'` guards are *correct* for Apple's rules — but the consequence is that on iOS there is no IAP, no purchase flow, and no pointer to the website. **iOS Premium conversion at launch is structurally zero.**

This is a deliberate trade-off, not a bug, but you should be making it with open eyes: if a meaningful share of your launch users are on iOS, that share cannot give you money.

**Options:** implement StoreKit IAP (Apple takes 15–30%, and it is 1–2 weeks of work you do not have), or accept iOS as a free-tier-only acquisition channel for v1 and monetise Android + web.

## 🟡 P7 — Referral farming has no cap and no verification.

₹100 (10,000 paise) per referred signup, and the in-app copy explicitly says *"with no limit"* (`SwipeScreen.js:145`). At the ₹13.30/day redemption rate, **each fake signup converts to 7 free Premium days**. Email confirmation is the only barrier. Ten disposable inboxes buy roughly two months of Premium.

**Fix:** cap referral bonuses per referrer (e.g. 10), and only credit once the referred account completes a profile.

## 🟡 P8 — Any logged-in user can read anyone else's wallet balance.

`get_wallet_balance_paise(p_user_id uuid default auth.uid())` is SECURITY DEFINER, granted to `authenticated`, and accepts a caller-supplied uuid with no check that it matches `auth.uid()`. `is_premium()` is the same shape but that one is *deliberate* (needed for discovery ordering) and documented. The wallet one appears to be accidental — the edge function that needs the arbitrary-uuid form calls it as service_role anyway.

**Fix:** `if p_user_id <> auth.uid() then raise exception ...`, or split into a caller-only variant for `authenticated`.

## 🟡 P9 — npm: 11 high-severity — and the standing advice on them has been wrong.

All 11 trace to `image-size` (ICNS/JXL/HEIF infinite-loop DoS) pulled in via `metro` → `@expo/metro` → `expo`. **Every one is build-tooling only. None ships in the app binary. None is reachable by a user.**

`npm audit fix --force` resolves them by installing **react-native@0.72.17** — a downgrade across 14 minor versions that would destroy your SDK 57 setup. **Do not run it.**

The daily reports have carried this as "Requires Founder Action" for roughly two weeks. It should be reclassified as accepted risk and closed, so it stops consuming attention that P0–P4 need.

## 🟡 P10 — Two recurring findings in the daily reports are false.

1. **"No swipe-rate-limit function found"** (in every report since 2026-08-02). This is a search artefact — the check looks for a function *named* `%rate%`/`%limit%`, but swipe throttling lives *inside* `record_swipe()` at 60/min. The protection exists. The finding does not.
2. **`razorpay_order_attempts` anon SELECT policy.** No such policy exists in **any** migration — `20260802000000` explicitly does `revoke all on table ... from public, anon, authenticated`. If that policy really is in the live database, the finding isn't "a bad policy", it's **"production has objects that no migration created"** — which is P11, and much more serious than the policy itself.

## 🔴 P11 — Production database drift. This is the structural risk behind everything else.

The 2026-08-07 report documents stale SQL being executed **directly against production** — the CROSS JOIN bug reappeared three separate times after being fixed, traced via `pg_stat_statements` to migration text being re-run outside the migration pipeline. Combined with P10.2, the conclusion is that **`supabase/migrations/` is not the source of truth for your production schema.**

Every finding in this report that is based on migration files carries an asterisk because of this. And every fix you apply can be silently reverted by whatever process is doing this.

**This should be diagnosed before Sept 1**, because on launch day you lose the ability to debug it calmly.

---

# REPORT 3 — Not touched yet (verified absent, not merely unfinished)

Ordered by how much each one hurts at launch.

| # | Missing | Impact |
|---|---------|--------|
| 1 | **Gender preference / age range / distance filters** | **Nothing exists.** No `interested_in`, `looking_for`, `min_age`, `max_age`, `max_distance` column anywhere; `get_candidate_profiles()` applies no gender filter whatsoever. **A straight man sees other men in his deck. A lesbian sees men.** This is not a missing nice-to-have — the core matching loop is not yet correct for a dating app. Every competitor has had this for a decade. **Biggest single gap in the product.** |
| 2 | **Push notifications** | Zero. No `expo-notifications`, no token storage, no send path. A user gets a match or a message and finds out only if they happen to reopen the app. Day-1 retention on a dating app without push is a fraction of what it should be. |
| 3 | **Moderation operations** | `reports` rows are written and then nothing happens to them. No admin surface, no queue, no reviewer, no action mechanism, no SLA. Apple guideline 1.2 requires acting on reports **within 24 hours** — you have collection but no capability to act. This is an approval risk *and* a post-launch safety risk. |
| 4 | **Photo content moderation** | Nothing scans uploaded profile photos. On a dating app, explicit or illegal imagery will appear. Currently it would sit live until a user reports it, and then still sit live because of #3. |
| 5 | **Automated tests + CI** | No test files. No `.github/` directory. No CI of any kind. Every change to a live payment system and a live database is shipped on inspection alone — which is precisely how the CROSS JOIN bug regressed three times. |
| 6 | **Android release** | PR #7 ("Android release prep: Play payments compliance, safe-area insets, release config") is **open and still a draft**. Given #6 above (no iOS monetisation), **Android is your entire launch revenue** — and it isn't merged. |
| 7 | **Message content filtering** | No profanity, spam, phishing, or abuse filtering on messages. |
| 8 | **Signup abuse defenses** | No captcha, no device fingerprinting, no per-IP signup limit. Feeds directly into P7. |
| 9 | **Subscription lifecycle job** | `status` never flips to `'expired'`. `is_premium()` checks `expires_at > now()` so behaviour is correct, but the column lies, and any future query trusting `status = 'active'` will be wrong. |
| 10 | **In-app Terms / Privacy links** | Splash shows *"By continuing, you agree to our Terms & Privacy Policy"* as plain, non-tappable `<Text>`. Dating apps get scrutinised on this. |
| 11 | **Support tooling** | `getsupport@nearmatch.in` is an inbox. No ticketing, no macros, and — per P3 — no way for you to reset a locked-out user's password without the Supabase dashboard. |

---

# FINAL — Are we on time for September 1?

**Honest answer: you are behind. Not fatally, but behind — and the gap is in product completeness, not engineering quality.**

**22 days remain.**

### Where you are genuinely ahead

The security and payments architecture is better than most apps that have already launched. Bidirectional block enforcement, deny-by-default RLS, server-verified payments with independent re-fetch, private avatars with signed URLs, a service-role-only email lookup, correct Apple 3.1.1 handling. Nobody has to go back and rebuild the foundation. That is real, and it is worth something.

### Where you are behind

1. **The matching loop is not correct yet.** No gender preference filtering is not a feature gap, it is a *product-doesn't-work* gap. Users will open the deck and see people they cannot possibly be interested in.
2. **No push notifications.** Matches and messages go unnoticed.
3. **You are selling Premium today under a promise the code does not keep** (P0), and the shortfall grows daily.
4. **No moderation capability**, on a UGC dating app, at launch.
5. **Android — your only revenue channel — is an unmerged draft PR.**
6. **iOS review status has been unverifiable for 4 days.** If it comes back rejected on Aug 25, there is no schedule left to absorb it.
7. **Zero tests, plus a production database that drifts from its migrations.** Every fix from here carries regression risk you cannot measure.

### Realistic assessment

- **Sept 1 as a soft launch — achievable**, if the next 7 days go to P0–P4 plus gender preferences plus push, and you accept iOS revenue at zero for v1.
- **Sept 1 as the launch of a category-leading app — not achievable.** You would be launching without preference filtering and without notifications. Users churn in the first session over the first one, and never come back over the second.

### What I would do with the 22 days

| Window | Work |
|--------|------|
| **Aug 10–13** (4 d) | P0 billing fix + backfill existing sales. DPDP checkbox. Password reset. Lock down `waitlist-notification`. Merge PR #6 (1.0.1) and PR #7 (Android). |
| **Aug 14–19** (6 d) | **Gender preference + age range + distance filters** — schema, RPC, and profile UI. This is the launch-critical item. Then push notifications for match + message. |
| **Aug 20–24** (5 d) | Minimal moderation queue (even a Supabase dashboard view + a documented 24h process). Photo moderation on upload. Diagnose the production DB drift. Sequence the avatar migration behind the 1.0.1 rollout. |
| **Aug 25–29** (5 d) | Real-device testing, TestFlight, App Store resubmission buffer. **Do not plan work here** — this window is your only protection against an Apple rejection. |
| **Aug 30–31** | Freeze. Launch-day runbook. Support inbox staffed. |

**There is no slack in that plan.** Anything that slips — an Apple rejection, one more CROSS JOIN-class regression from the DB drift — moves the date. If you want a Sept 1 date you can actually defend, the honest move is to cut scope now rather than discover on Aug 28 that it won't fit: **ship with preference filtering and push, and defer age-verification tuning (P5), IAP (P6), and referral caps (P7) to 1.1.**

### The single most urgent item

**Fix P0 today.** Every hour it stays live, another customer buys a month of Premium that will have mostly evaporated before they can use it. Everything else on this list can wait a day. That one cannot.
