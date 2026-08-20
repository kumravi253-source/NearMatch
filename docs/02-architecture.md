# 2. Architecture

## The shape of it

```
┌─────────────────────┐         ┌──────────────────────┐
│  Mobile app         │         │  Marketing website   │
│  React Native /     │         │  Static HTML/CSS/JS  │
│  Expo SDK 57        │         │  nearmatch.in        │
└──────────┬──────────┘         └──────────┬───────────┘
           │                               │
           │  supabase-js (anon key + JWT) │  fetch (anon key)
           ▼                               ▼
┌──────────────────────────────────────────────────────┐
│  Supabase  (project ref: ipwheuikchuoyskrfghi)       │
│                                                      │
│  Auth · Postgres + RLS · Storage · Realtime          │
│  Edge Functions (Deno)                               │
└──────────┬───────────────────────────────────────────┘
           │  server-to-server, secrets never on device
           ▼
   Face++ (age)  ·  Razorpay (payments)  ·  Resend + ntfy.sh (notifications)
```

## Frontend — the app

No navigation library. `App.js` holds the tab state and swaps screens directly;
there are only five tabs and a couple of modal-ish screens, so a router would
be more machinery than the app needs.

```
App.js                          root: fonts, session, tab state, Vexo init
src/
  lib/
    supabase.js                 client, AsyncStorage session persistence
    legal.js                    canonical consent/attestation strings
    location.js                 permission + coordinate save
    premium.js                  premium status helpers
    avatars.js                  signed-URL resolution for private photos
  screens/
    auth/AuthScreen.js          sign in / sign up, 18+ and DPDP consent
    profile/ProfileSetupScreen.js
    swipe/SwipeScreen.js        the discovery deck
    likes/LikesScreen.js        "who liked you" (Premium)
    matches/MatchesScreen.js
    chat/ChatScreen.js          realtime messaging
    verify/VerifyAgeScreen.js   optional selfie age check
  theme/theme.js                colours and fonts
```

**Key dependencies:** `@supabase/supabase-js`, `expo-image-picker`,
`expo-location`, `expo-font`, `expo-splash-screen`, `expo-observe`
(interactivity instrumentation), `vexo-analytics`, `@expo-google-fonts/*`
(fonts are bundled locally, not fetched from Google at runtime).

## Backend — Supabase

**Postgres with RLS on every table.** The security model is not "the app won't
show you that" — it is "the database won't give it to you." Several design
choices follow from that:

- **Writes that need rules go through `SECURITY DEFINER` RPCs, not direct
  inserts.** `record_swipe()` is the only write path for swipes, so like-caps
  and block-checks cannot be bypassed by calling the API directly with a
  different client.
- **Matches are never client-inserted.** They are produced by `record_swipe()`
  when it detects mutual interest.
- **Results a user must not forge are written only by the service role.**
  `age_verifications`, `biometric_consents`, and `subscriptions` have no
  insert policy at all — only edge functions holding the service role write
  them.
- **Exact coordinates live in a separate table** (`profile_locations`) readable
  only by their owner. Other users only ever receive a fuzzy distance label.

**Storage.** Profile photos are in an `avatars` bucket, **private** since
2026-08-10, served through short-lived signed URLs. Before that they sat on
permanently valid public URLs that anyone could fetch unauthenticated — that
was the 1.0.1 "avatar privacy release."

**Realtime.** `messages` is published to Realtime so `ChatScreen` receives
INSERT events over a `postgres_changes` subscription.

**Edge Functions.** Five Deno functions holding all third-party secrets. The
device never sees a Face++ key, a Razorpay secret, or the service role key.
See [document 4](04-edge-functions.md).

## Two trust boundaries worth naming

**1. The device is untrusted.** Everything the app can do, an attacker with the
anon key can do — and the anon key ships in the app bundle and in the website's
JavaScript, by design. This is why RLS and RPC gating carry the weight.

**2. Edge functions are the only holders of privileged credentials.** Anything
requiring a secret — calling Face++, creating a Razorpay order, verifying a
payment signature, deleting an auth user — happens there. The pattern is
consistent and is the main reason the app has survived several security audits
without a credential leak.

## Data flows worth understanding

**Age verification.** Selfie captured on device → posted to `verify-age` with
the consent text shown → function records consent → forwards image to Face++ →
stores only the outcome → sets the public `age_verified` badge. The image is
never persisted by NearMatch. See [document 5](05-third-party-processors.md).

**Payment.** Website collects name/email/phone → `create-razorpay-order`
creates the order server-side → Razorpay checkout runs in the page →
`verify-razorpay-payment` validates the HMAC signature and writes the
subscription. A client cannot grant itself Premium.

**Discovery.** `get_candidate_profiles()` does the exclusion work server-side —
already-swiped, blocked in either direction, self — and joins the viewer's
location with a `LEFT JOIN` so that a viewer with no saved location still gets
candidates. That join has been the single most regression-prone line in the
codebase (see [document 8](08-security-and-health-history.md)).
