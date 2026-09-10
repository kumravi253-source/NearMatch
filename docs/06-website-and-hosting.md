# 6. Website & hosting

Static marketing and legal site at **nearmatch.in**. Plain HTML, CSS and
vanilla JavaScript — no framework, no build step. Source in `website/`.

## Pages

| File | Purpose | Analytics | Third-party JS |
|---|---|---|---|
| `index.html` | Landing page, hero video, waitlist form, live counter | GA | Supabase |
| `pricing.html` | Independence Day plans, Razorpay checkout | — | Razorpay, Supabase |
| `about.html` | About the product | — | — |
| `privacy.html` | Privacy Policy (DPDP) | GA | — |
| `terms.html` | Terms of Service | GA | — |
| `refund.html` | Refund & Cancellation Policy | GA | — |
| `support.html` | Support and grievance contact | GA | — |

Supporting files: `styles.css`, `_headers` (cache rules), `vercel.json`
(www→apex redirect), `assets/hero-bg.mp4`, `assets/hero-poster.jpg`.

All seven pages load **Google Fonts**. Five load **Google Analytics**;
`about.html` and `pricing.html` do not — an inconsistency that means the
highest-intent page isn't measured.

## Two live data paths

**Waitlist** (`index.html`) — POSTs an email straight to Supabase REST with the
anon key. `waitlist` allows anon insert but never select; the public counter
comes from `get_waitlist_count()` so the table itself is never exposed.

**Checkout** (`pricing.html`) — collects **name, email and phone** from a
visitor with **no account**, calls `create-razorpay-order`, opens Razorpay
checkout in-page, then calls `verify-razorpay-payment`. A purchase made before
the buyer has an account is matched to them by email when they sign up.

This second path was invisible in the Privacy Policy until 2026-08-16 — the
policy asserted website collection was the waitlist "and only that."

## The hero video incident — 2026-08-20

The clearest operational failure in the project so far, and worth reading as a
cautionary tale.

`assets/hero-bg.mp4` (14,963,346 bytes ≈ 15 MB) was added on **2026-08-09** as
a plain autoplay `<video>` with an inline `source`. Every homepage view pulled
the full 15 MB before the visitor did anything. At 15.21 MB per uncached view,
Netlify's free-tier 100 GB monthly allowance covers roughly **6,576 views**.

On **2026-08-20 Netlify suspended nearmatch.in** for exhausting that allowance.

The fix (PR #11, commit `42faa69`) attaches the video source at runtime and
only when the browser signals the connection can afford it — skipping on
`prefers-reduced-motion`, `prefers-reduced-data`, viewports under 900px, and
when the Network Information API reports `saveData` or a sub-4g connection. The
poster is the video's first frame, so the hero still renders correctly for
everyone else.

Measured in Chromium: **mobile and reduced-motion views dropped from 15.21 MB
to 0.25 MB**; desktop unchanged.

The same PR also removed a `reduced-motion: display:none` rule that never
prevented the download — the element was fetched and *then* hidden — and which
also removed the poster, leaving the hero's white headline on the pale
background.

## Hosting — currently unsettled

**This is the least stable fact in this dossier.** Three providers are in play
simultaneously as of 2026-08-20:

| Provider | Evidence | State |
|---|---|---|
| **Netlify** | `netlify.toml`; served the apex until today's suspension | Suspended 2026-08-20 |
| **Vercel** | Builds `website/` from this repo; `vercel.json` added for www→apex 301 | Active for deploys |
| **Cloudflare Pages** | Named as destination in `netlify.toml` and `_headers` comments | Planned |

The `_headers` file exists precisely because of this: it is read by **both**
Netlify and Cloudflare Pages from the publish directory, so the `/assets/*`
cache policy survives the migration unchanged and there is one source of truth
while both hosts are live during the cutover. `netlify.toml` carries an
explicit instruction: *"Delete this whole file once Cloudflare is serving the
site."*

### The history, because it's confusing

- **2026-07-23 / 07-24:** security audits found `nearmatch.in` **not resolving
  to Netlify at all** — the apex A records pointed at GoDaddy's Website Builder,
  so the live domain served a GoDaddy placeholder while every page except `/`
  404'd. The Netlify deploy itself was fine; DNS had never been delegated.
- **2026-08-05:** audit confirmed `nearmatch.in` serving correctly via **Netlify
  Edge**, SSL valid.
- **2026-08-16:** the founder stated the site was on Vercel and that
  `netlify.toml` was dead; it was deleted on that basis (commit `81fb071`).
- **2026-08-20:** PR #11 revealed Netlify was still serving the apex right up to
  its suspension, and named Cloudflare as the destination. The deletion was
  **reverted** in merge commit `f6a5d4b` — re-applying it would have undone a
  newer, better-informed decision.

### The open consequence

The Privacy Policy names **Vercel alone** as the host. That is a factual claim
about who receives visitor IPs and request logs, and it no longer looks right.
It has deliberately **not** been rewritten, because guessing between three
providers in a legal document is worse than asking. See
[open items](09-open-items.md).

## Deploying

There is no build step. Vercel publishes `website/` directly (root directory
set to `website` in project settings; the repo carries no build command). Push
to `main` and the deploy runs. Preview deployments are created per pull request.
