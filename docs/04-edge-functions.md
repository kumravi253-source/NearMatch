# 4. Edge functions

Five Deno functions under `supabase/functions/`. They exist for one reason:
**they are the only place third-party secrets and the service role key live.**
The mobile app and the website never see a Face++ key, a Razorpay secret, or a
service-role token.

Two auth patterns are in use:
- `withSupabase({ auth: "user" })` — requires a real user JWT; the identity
  comes from `ctx.userClaims` and never from the request body.
- Raw `Deno.serve` with the service role — for endpoints the website calls with
  no logged-in user.

---

## `verify-age`

**Auth:** user JWT · **Secrets:** `FACEPP_API_KEY`, `FACEPP_API_SECRET`

Turns a selfie into a pass/fail age decision without ever storing the image.

1. Receives `selfieImageBase64` and `consentText` from the app.
2. **Validates consent is present**, then writes it to `biometric_consents`
   via the service role — *before* any outbound call. If that insert fails, the
   request returns 500 and the image is never sent.
3. Forwards the base64 image to Face++ `/facepp/v3/detect`, requesting only the
   `age` attribute.
4. Rejects anything that isn't exactly one face — zero faces or multiple faces
   both fail rather than guess.
5. Applies a **conservative margin**: Face++ returns a single point estimate
   (unlike AWS Rekognition's range), so the function requires
   `estimate − 5 ≥ 18` rather than trusting the raw number, because the model's
   typical error is a few years either way.
6. Writes the outcome to `age_verifications` and, on pass, sets
   `profiles.age_verified`.

The consent text is stored **as the app displayed it**, not compared against a
server-side copy: the Deno runtime can't import `src/lib/legal.js`, so a
duplicate constant would drift, and any older app version still installed would
start failing the moment the wording changed.

Endpoint default is `https://api-us.faceplusplus.com` — the US region of a
Chinese vendor. See [third-party processors](05-third-party-processors.md).

---

## `create-razorpay-order`

**Auth:** none (anonymous website checkout) · **Secrets:** `RAZORPAY_KEY_ID`,
`RAZORPAY_KEY_SECRET`, service role

Creates a Razorpay order for one of `month1` / `month2` / `month5`. Because
there is no user JWT on this path, abuse control is **per-IP rate limiting**
via `check_razorpay_order_rate_limit()`, and CORS is pinned to
`https://nearmatch.in`.

The rate-limit check **fails open** — if the check itself errors it logs and
proceeds, on the reasoning that a checkout silently breaking because the
limiter hiccuped is worse than the abuse it prevents.

> **History:** this function originally had *no* authentication or rate limiting
> at all. Daily security audits repeatedly demonstrated it by creating real
> Razorpay orders with nothing but the public anon key (orders
> `order_THH4m6xpj122hS`, `order_THZh3sALpQ6KIH`, `order_THyARDkjIW7eqw`,
> `order_TJYJcYluE0pG9D`). Rate limiting and CORS restriction were added in
> commit `ead87b5` on 2026-08-02.

---

## `verify-razorpay-payment`

**Auth:** none · **Secrets:** Razorpay key/secret, service role

Turns a checkout success into an actual Premium grant — and never trusts the
client's claim that it succeeded.

1. Recomputes the **HMAC-SHA256 signature** over the order and payment IDs and
   compares it to what Razorpay sent.
2. Re-fetches the payment from Razorpay's API to confirm amount and status.
3. Resolves the buyer's email to an existing NearMatch account via
   `get_user_id_by_email()`.
4. Writes the `subscriptions` row (service role — the client has no insert path).

If no account exists for that email yet, it returns `no_account_for_email`
rather than guessing or silently dropping the payment. The website then tells
the buyer to sign up in the app with that same address. `razorpay_payment_id`
is unique in the schema, so a replayed callback cannot grant Premium twice.

---

## `delete-account`

**Auth:** user JWT · **Secrets:** service role

Self-service account deletion, and deliberately minimal: the target id comes
from `ctx.userClaims`, **never from the request body**, so there is no way to
pass someone else's id. It calls `auth.admin.deleteUser()`, and the `on delete
cascade` foreign keys throughout the schema do the rest — profiles, swipes,
matches, messages, blocks, reports, attestations, consents, verifications all
go with it.

This is what backs the Privacy Policy's promise that a user can erase
themselves from inside the app without contacting anyone.

---

## `waitlist-notification`

**Auth:** none (database webhook) · **Secrets:** `RESEND_API_KEY`, `NTFY_TOPIC`

Fires when a row lands in `waitlist`. Sends the founder an email via **Resend**
(from the verified `nearmatch.in` domain) and a push via **ntfy.sh**.

Note these two vendors receive only the waitlist signup notification — they are
operational alerting for the founder, not user-facing processing. They are
**not currently named in the Privacy Policy's processor list**; whether they
need to be is a judgement call, since what they carry is a single email address
belonging to a person who submitted a public signup form.

---

## Environment variables

Set in Supabase (Project Settings → Edge Functions → Secrets), never in the
repo. `.env.example` tracks only the two public client values.

| Variable | Used by |
|---|---|
| `FACEPP_API_KEY` / `FACEPP_API_SECRET` / `FACEPP_BASE_URL` | verify-age |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | create-razorpay-order, verify-razorpay-payment |
| `RESEND_API_KEY` / `NTFY_TOPIC` | waitlist-notification |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | all service-role paths |

> ⚠️ The Razorpay mode currently configured server-side is **unverified**. The
> website's pricing page hardcodes a `rzp_test_` key id, which means either the
> server is also on test credentials (nobody is being charged) or it is on live
> credentials (checkout fails for everyone). Tracked as issue #10.
