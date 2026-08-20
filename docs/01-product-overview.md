# 1. Product overview

## What it is

NearMatch is a mobile dating app for the Indian market, built around proximity:
it shows you people near you and sorts matches by distance, without ever
revealing anyone's exact location to anyone else.

The pitch used on the website is safety-first — verified profiles, encrypted
real-time chat, built-in moderation — positioned against "just another swipe
deck."

## Who runs it

Operated by **Avnish Yadav** as an individual founder. NearMatch is **not
incorporated as a separate legal entity**, which is stated explicitly in the
Privacy Policy: references to "we", "us", and "NearMatch" mean Avnish Yadav
personally. This matters for the legal documents — the data fiduciary under
India's DPDP Act is a natural person, not a company.

- **Support / grievance contact:** getsupport@nearmatch.in
- **GitHub:** `kumravi253-source/NearMatch`
- **Bundle ID (iOS & Android):** `com.kumravi253.nearmatch`
- **App Store Connect app ID:** 6794255698
- **EAS project ID:** e20a4ab0-26c2-47ad-8254-9640e1f80fe8

## Status

| | |
|---|---|
| App version | 1.0.1 (bumped for the avatar-privacy release) |
| Launch date | 1 September 2026 |
| iOS | Submitted to App Review ~2026-08-03; last confirmed "Waiting for Review" |
| Android | Package configured; no submission recorded in this repo |
| Website | Live at nearmatch.in, mid host-migration (see doc 6) |
| Users | ~16 auth users as of 2026-08-09 — test and demo accounts, not real users |

**On the App Review status:** treat "Waiting for Review" as stale rather than
current. The automated functional check has been unable to verify it since
2026-08-07 because the App Store Connect browser session expires and the check
is instructed not to log in. As of the last report (2026-08-09) roughly 149
hours had elapsed since submission with no confirmed change.

## Core features

**Discovery and matching**
- Swipe deck of nearby candidates, built server-side by `get_candidate_profiles()`
- Mutual likes create a match; matches are never inserted by clients directly
- Distance shown only as a fuzzy band (e.g. "3-5 km away"), never coordinates

**Chat**
- Real-time messaging over Supabase Realtime (`postgres_changes` on `messages`)
- Rate-limited server-side to stop message flooding

**Safety**
- Block and report, enforced at the database level — a blocked user cannot
  appear as a candidate, match, or message sender, even if the client tries
- Optional selfie-based age verification producing a public "Verified" badge
- 18+ attestation required at signup, recorded verbatim

**Premium** (paid tier)
- Free users: 10 likes per rolling 24 hours. Premium: unlimited
- Premium profiles get priority placement in discovery
- "Who liked you" (`get_pending_likes()`) is Premium-only

**Growth mechanics**
- **Refer & Earn:** every profile gets a referral code; signups via a code
  credit the referrer's wallet through an append-only ledger
- **Launch promo:** the first 300 signups on or after 1 Sept 2026 get 15 days
  of free Premium, implemented as an ordinary subscription row with a distinct
  plan value and zero amount, so every existing Premium check works unchanged
- **Pre-launch waitlist** on the website, with a live counter showing momentum

## Pricing

Independence Day pre-launch pricing, sold on the website before launch. All
one-time payments — **no auto-renewal**:

| Plan | Price | Duration |
|---|---|---|
| `month1` | ₹399 | 1 month |
| `month2` | ₹599 | 2 months |
| `month5` | ₹699 | 5 months |

Payment is taken by Razorpay. A purchase made before the buyer has an account
is matched to them later by email address when they sign up.

> ⚠️ The live pricing page is currently wired to a Razorpay **test** key. See
> [open items](09-open-items.md) — this is tracked as issue #10 and means
> checkout is either not charging anyone or failing outright.

## Design language

Warm and soft rather than clinical. Coral `#E8603A` as the primary brand
colour, Pacifico for the logo, Quicksand for body text, generous rounding,
emoji used as functional iconography. Portrait-only; iPad support was
deliberately disabled because the layouts were never designed for tablet.
