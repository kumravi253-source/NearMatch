# 5. Third-party processors

Every external party that receives NearMatch user data, what they get, and
where they process it. This doubles as the DPDP-Act processor register.

Produced by a full audit on 2026-08-16 (PR #9). Before that audit, **three of
these were receiving data with no disclosure in the Privacy Policy at all.**

---

## The register

| Processor | Receives | Surface | Outside India |
|---|---|---|---|
| **Supabase** | Everything — profiles, messages, matches, photos, waitlist | App + website | Depends on project region |
| **Face++ (Megvii)** | The age-verification selfie | App only | **Yes** |
| **Razorpay** | Name, email, phone, payment | Website checkout | No (India) |
| **Vexo** | App usage telemetry | App only | Yes |
| **Google** | Analytics visit data; IP via Fonts | Website only | Yes |
| **Vercel** | Request logs, visitor IPs | Website only | Yes |
| **Resend** | Waitlist signup email (founder alert) | Backend | Yes |
| **ntfy.sh** | Waitlist signup push (founder alert) | Backend | Yes |

---

## The one that matters most: Face++ (Megvii)

**The only AI vendor, and the only processor receiving biometric data.**

A user's selfie leaves India and goes to `api-us.faceplusplus.com` — the US
region endpoint of Megvii Technology, a Chinese company. NearMatch never stores
the image; the schema comment states the boundary plainly:

> *"What Face++ does with an image after it arrives is governed by Megvii's
> terms, not by anything assertable here."*

**Provider history — this has changed twice:**

| Provider | Migration | Why it changed |
|---|---|---|
| Yoti | `20260627002000` | Original choice |
| AWS Rekognition | `20260627003000` | Documented SigV4 API, instant self-serve account, no vendor onboarding queue |
| **Face++ (Megvii)** | `20260627100000` | One key + secret instead of IAM users, access keys and an Organizations-level opt-out policy |

Each switch is its own migration, and `age_verifications.provider` is stored
per row so historical results stay attributable. Migration `20260810110000`
attached the current description to the table itself via `comment on`, because
reconstructing "who actually receives our users' selfies" previously meant
reading three migrations in the right order — a poor answer to give a regulator.

**Consent.** Since 2026-08-16 the app takes a specific, separate consent before
the image is transmitted: `BIOMETRIC_CONSENT_TEXT` names Face++ (Megvii), says
the processing happens outside India, and says the check is optional. It is
recorded in `biometric_consents` *before* the outbound call. Prior to that, the
Privacy Policy claimed this consent existed when it did not — the blanket DPDP
checkbox at signup does not reach biometric data sent to a named third party
abroad.

---

## Supabase

Database, auth, file storage, realtime messaging, edge function runtime, and
the website's waitlist store. Effectively everything.

Project ref `ipwheuikchuoyskrfghi`. The anon key is published in the app bundle
and in the website's JavaScript **by design** — it is a publishable key and is
protected by RLS. It is not a leak and does not need rotating.

---

## Razorpay

Payment gateway, PCI DSS compliant, India-based. Receives name, email and phone
at checkout and handles the card/UPI/bank details directly — NearMatch never
receives or stores them.

Used from two places: the website pricing page (anonymous pre-launch purchase)
and, by design, in-app Premium purchase.

---

## Vexo — the analytics that nobody had disclosed

`vexo-analytics`, initialised at module scope in `App.js` and **guarded to
production** (`if (__DEV__ === false)`), so development sessions don't pollute
the data. Receives screens opened, features used, crashes and errors, and
general device/app-version information. It does **not** receive messages,
photos, or exact location.

Added 2026-08-07 by an automated integration bot (commits `3c33ee3`, `6a40fb3`,
PR #1). That bot also gutted `App.js`, which had to be restored in PR #3, and
broke the EAS build via a lockfile mismatch fixed in PR #2. It was disclosed in
the Privacy Policy on 2026-08-16 — nine days after it started collecting.

---

## Google — two separate roles, website only

**Google Analytics** (`G-TXCHSJHEZP`) loads on five of seven pages: `index`,
`privacy`, `refund`, `support`, `terms`. It sets cookies and sends Google the
visitor's IP, approximate location, device/browser, and pages viewed.

**Google Fonts** loads on **all seven** pages and discloses the visitor's IP to
Google on every page view.

Neither runs in the mobile app. The app's fonts come from
`@expo-google-fonts/*`, which ships the font binaries inside the package and
loads them locally — so there is no runtime call to Google from the app.

Two things worth knowing:
- Analytics fires **on page load, with no consent banner**. The Privacy Policy
  now states this plainly rather than implying consent was collected first.
  Whether to gate it behind a banner is an open product decision.
- Coverage is inconsistent — `about.html` and `pricing.html` have no gtag, so
  the highest-intent page in the funnel isn't measured. Looks unintentional.

---

## Vercel — and the caveat

Named in the Privacy Policy as the website host, receiving requests, IPs and
standard server logs.

> ⚠️ **This disclosure is now doubtful.** As of 2026-08-20 the hosting is
> mid-migration across three providers and the policy names only one. See
> [document 6](06-website-and-hosting.md) — this is an open item.

---

## Resend and ntfy.sh

Used by `waitlist-notification` to alert the founder when someone joins the
waitlist. What they carry is one email address, belonging to someone who
submitted a public signup form.

**Not currently named in the Privacy Policy's processor list.** Arguably they
should be, since a waitlist email is personal data and both process it outside
India. Flagged in [open items](09-open-items.md) rather than silently added.

---

## What the audit changed

Before 2026-08-16 the policy named exactly three processors: Supabase, Face++,
Razorpay. The audit found:

1. **Vexo undisclosed** — collecting since 2026-08-07.
2. **Google Analytics undisclosed** — the policy contained no occurrence of
   "Google", "analytics", or "cookie" at all, while `privacy.html` was itself
   one of the instrumented pages.
3. **Google Fonts undisclosed** — on every page.
4. **The host undisclosed** — necessarily sees every visitor IP.
5. **The policy's own scope statement was wrong** — it asserted website
   collection was the waitlist "and only that", while `pricing.html` collects
   name, email and phone from visitors with no account.

All five were corrected in PR #9.
