# 9. Open items

Everything unresolved as of **2026-08-20**, most consequential first. Each says
what is known, what is not, and what deciding it requires.

---

## 🔴 1. Razorpay is on a test key — checkout is broken either way

**Tracked as [issue #10].** `website/pricing.html` hardcodes a `rzp_test_` key
id. Both edge functions read their credentials from the environment, so the
server-side mode is not visible in the repo — and **both possibilities are bad:**

- **Server on test credentials** → the whole flow succeeds, nobody is charged,
  and the buyer still sees *"🎉 Payment successful! Premium is now active."*
  Premium given away, revenue silently zero.
- **Server on live credentials** → a live order is created but checkout opens
  with a test key id, Razorpay can't find the order in test mode, and
  **checkout fails for every customer.**

Live now, on the path real buyers take, mid-promo, with launch on 1 September.

**To resolve:** check `RAZORPAY_KEY_ID` in the Supabase Edge Function secrets.
Then check the Razorpay dashboard and `subscriptions` for records created in
test mode — if anyone has already "purchased", they hold a Premium grant
against a payment that never happened, which is a customer decision, not just a
code fix.

**Suggested fix:** have `create-razorpay-order` return its `key_id` alongside
the order and have the page use that. The function already holds the credential
and is called immediately before checkout opens, so this adds no round trip and
gives one source of truth. A key id is publishable, so returning it is safe.
The site is static with no build step, so there is no env-substitution route —
which is how it got hardcoded in the first place.

---

## 🔴 2. The Privacy Policy names the wrong host (probably)

The policy names **Vercel** as the website host. Three providers are in play:
Netlify (served the apex until its 2026-08-20 suspension), Vercel (deploys the
repo, has the www→apex redirect), Cloudflare Pages (the stated destination).

This is a factual claim about who receives visitor IPs and request logs, in a
legal document, and it is probably wrong today.

**Deliberately not rewritten** — guessing between three providers is worse than
asking. Options: name whichever is actually serving; name all three and state
the site is mid-migration (accurate now, no rewrite needed at cutover); or hold
until Cloudflare is live and write it once.

---

## 🟠 3. `razorpay_order_attempts` anon-SELECT policy

Carried unresolved in the security reports since 2026-08-09. An
`anon_select_razorpay_order_attempts` policy with `qual=true` — unrestricted
read for the anonymous role.

**Dormant, not exploitable:** no table-level `GRANT SELECT` to `anon` exists,
so live requests get `42501 permission denied`. But the policy is wrong-shaped
and would silently expose every row — order attempts, IPs, timestamps — the
moment any future migration adds that grant.

Anon almost certainly needs only INSERT here, for pre-auth attempt logging.
Left open by design: the audits never auto-apply RLS changes.

---

## 🟠 4. App Review status unverified since 2026-08-07

Last confirmed "Waiting for Review", submitted ~2026-08-03. Unverifiable for
three consecutive runs because the App Store Connect browser session expires
and the check is instructed not to log in.

With launch on 1 September, this is the item most likely to invalidate the
schedule — and nobody currently knows its true state.

---

## 🟡 5. Consent banner decision

Google Analytics fires on page load with no consent banner. The Privacy Policy
now says so plainly rather than implying consent was collected first — accurate
today, and the sentence that changes if a banner is added.

A product and legal decision about pre-consent tracking under DPDP, not a code
decision. Disclosure alone may or may not be sufficient.

---

## 🟡 6. Consent screen never seen on a real device

`VerifyAgeScreen` gained a consent checkbox and became a `ScrollView` on
2026-08-16. Verified only by parsing — `node_modules` isn't installed in the
environment where it was written, and `docs.expo.dev` is blocked by network
policy, so the SDK 57 docs couldn't be re-read as `AGENTS.md` requires.

No new Expo API surface was added and the `expo-image-picker` call is
untouched, but **the layout should be looked at on a real device before merge.**

---

## 🟡 7. No swipe-velocity rate limit

Recurring in the audits since 2026-08-02. `enforce_message_rate_limit` and
`check_razorpay_order_rate_limit` exist; nothing throttles swipe *velocity*.

`swipes` has a unique constraint on `(swiper_id, swiped_id)` preventing
duplicates, and free users are capped at 10 likes per 24h — but a scripted
client could still burn through passes at machine speed.

---

## 🟡 8. 11 transitive npm vulnerabilities

All high-severity, all in nested transitive deps. The top-level stack is
current. `npm audit fix` was tried, achieved nothing, damaged the lockfile, and
was reverted. `--force` needs a deliberate tested upgrade session, not an
unattended run.

---

## 🟢 9. Resend and ntfy.sh not in the processor register

Both receive waitlist signup emails via `waitlist-notification`, and both
process outside India. Not currently named in the Privacy Policy.

Arguably they should be — a waitlist email is personal data. Flagged rather
than silently added, since the founder may reasonably class them as operational
alerting rather than user-facing processing.

---

## 🟢 10. Analytics coverage is inconsistent

`about.html` and `pricing.html` have no gtag, so the highest-intent page in the
funnel isn't measured. Looks unintentional.

---

## 🟢 11. Audits stopped after 2026-08-09

Eleven days unaudited, during which the bandwidth problem went unnoticed until
the host pulled the site. Whether the automation stopped or was paused isn't
recorded.

**None of the existing checks would have caught it** — asset weight and
bandwidth consumption aren't among them. Worth adding alongside restarting the
runs.

---

## 🟢 12. Two auth users without profiles

14 profiles vs 16 auth users as of 2026-08-09, plus one stale unconfirmed test
account. Cosmetic, long-standing.

---

## 🟡 13. Two dead Cloudflare Workers integrations fail CI on every push

Two Workers Git integrations were connected to this repository on 2026-08-21,
one per Cloudflare account:

- `a7d3e08e73841636865c81ee932e6cd3`
- `7ecbdd0705f4dc1b64578bc1e7741acd`

Both post a red `Workers Builds: nearmatch` check on every commit, on every
branch including `main`. Nothing in the repo can make them pass: there is no
`wrangler.toml`/`.json`/`.jsonc` anywhere in the tree, so a Workers build has
no entrypoint. nearmatch.in is a static site — the matching Cloudflare product
is **Pages**, not Workers.

Harmless in itself, but it makes red CI the normal state of the repository,
which is how a real failure gets missed.

**Fix:** Cloudflare dashboard → Workers → `nearmatch` → Settings → Build →
disconnect the Git repository, on both accounts. Dashboard-only; no code
change can do it.

[issue #10]: https://github.com/kumravi253-source/NearMatch/issues/10
