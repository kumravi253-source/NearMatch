# 8. Security & health history

NearMatch carries an unusually thorough operational record for a pre-launch
solo project: **40 security reports** (`security-reports/`, 2026-07-22 to
2026-08-09) and **8 functional health reports** (`functional-reports/`,
2026-08-03 to 2026-08-09), mostly produced by automated daily audits.

They are dated records of what was true when written. Several are now stale —
notably the hosting ones. **They are deliberately not rewritten**; rewriting a
log defeats its purpose. Read them as history, not current state.

## What the daily audits check

**Security** — RLS coverage on every public table; anon data access probes;
hardcoded-secret scanning; `npm audit`; website SSL and page availability; edge
function reachability; auth user anomalies; storage bucket config; rate-limit
function existence; `.gitignore` hygiene; DB integrity and row-count spikes;
block enforcement in `get_candidate_profiles()`.

**Functional** — full-schema CROSS JOIN regression scan; join-pattern
verification on the two discovery RPCs; App Review demo account deck and seeded
conversation intact; core RPC existence; App Store review status; TestFlight
build health.

## Standing rule the audits follow

**RLS policy changes are never auto-applied.** They are reported for explicit
founder review. This is why the `razorpay_order_attempts` finding below is
still open rather than silently patched — a good constraint that has held.

## Findings the audits caught

| Date | Finding | Outcome |
|---|---|---|
| 2026-07-23 | `nearmatch.in` serving a GoDaddy placeholder, not Netlify — every page but `/` 404'd | Fixed by 08-05 |
| 2026-07-25 | Three `SECURITY DEFINER` RPCs callable unauthenticated | Fixed `20260725000001` |
| 2026-07-30 | `create-razorpay-order` created real orders with only the anon key | Fixed `ead87b5` |
| 2026-07-30 | `profile_locations` RLS exposed exact GPS to any user | Fixed `20260802000001` |
| 2026-08-02 | Zero-candidate bug for viewers with no location | Fixed, then twice regressed |
| 2026-08-06 | RLS fixes live in production but never captured in a migration | Tracked `20260806000000` |
| 2026-08-09 | `razorpay_order_attempts` anon-SELECT policy | **Still open** |
| 2026-08-09 | 11 high-severity transitive npm vulnerabilities | **Still open** |
| 2026-08-09 | No swipe-velocity rate limit | **Still open** |

### The Razorpay order-creation finding, in detail

Between 2026-07-24 and 2026-07-30 the audits repeatedly demonstrated that
`create-razorpay-order` had **no authentication whatsoever** — a smoke test
with nothing but the public anon key created real, uncaptured Razorpay orders
against the founder's account: `order_THH4m6xpj122hS`, `order_THZh3sALpQ6KIH`,
`order_THyARDkjIW7eqw`, `order_TJYJcYluE0pG9D`.

No money moved (order creation ≠ payment capture), but it was a live abuse
vector: anyone with the anon key — trivially extractable from the app bundle —
could spam order creation with no rate limiting. The audit noted the side
effect honestly: *"the smoke test itself created one real order for ₹299."*

Fixed 2026-08-02 with per-IP rate limiting and CORS pinned to `nearmatch.in`.

### The npm situation

11 high-severity vulnerabilities, **all transitive** — `metro`, `metro-config`,
`metro-transform-worker`, `@expo/metro`, `@react-native/community-cli-plugin`,
`@react-native/virtualized-lists`, `image-size`. The top-level stack is current
(Expo ~57.0.11, React Native 0.86.2, confirmed installed rather than merely
declared).

`npm audit fix` was attempted and **reverted**: it did not reduce the count
(still 11 after) but rewrote `package-lock.json` to insert an inconsistent
`@expo/metro-config@57.0.7` entry alongside the existing tree — a lockfile
change with no security benefit and real breakage risk on a live app. Nothing
was committed. `npm audit fix --force` would apply semver-major overrides and
was correctly not attempted unattended.

## Status as of the last reports (2026-08-09)

**Security: WARNINGS.** Passing — RLS on all 20 public tables with at least one
policy each; anon probes correctly blocked; no hardcoded secrets; SSL valid to
2026-10-16; edge functions reachable; storage bucket restricted to 4 image MIME
types with a 5 MB cap; 0 orphaned messages; block enforcement verified in both
directions.

Warning — the three open items above, plus 2 auth users with no matching
`profiles` row (14 profiles vs 16 auth users) and one stale unconfirmed test
account (`qadpdptest20260724@nearmatch.in`, cosmetic).

**Functional: WARNINGS.** All executable checks pass — zero `cross join` in the
entire schema, both discovery RPCs on the LEFT JOIN pattern, demo account deck
stocked with 9 candidates, the seeded Priya match and 3-message conversation
intact, all 5 core RPCs present.

The warning is **solely** the App Store Connect session expiring, which has
blocked verification of App Review status and TestFlight health on every run
since 2026-08-07. The check is instructed not to log in, and correctly doesn't.

## Reporting gap

**No security or functional reports exist after 2026-08-09.** Eleven days of
unaudited operation, during which the hero-video bandwidth problem went
unnoticed until Netlify suspended the site. Whether the automation stopped or
was paused isn't recorded anywhere in the repo.

Notably, **none of the audits would have caught it** — bandwidth consumption
and asset weight were not among the checks. Worth adding.
