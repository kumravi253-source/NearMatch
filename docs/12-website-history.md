# 12. nearmatch.in — complete website history

Everything about the **website** specifically, separated out from the mobile
app. Reconstructed from 15 website-touching commits, 40 security reports, and
the site's own source. Current as of 2026-08-21.

Companion documents: [website & hosting](06-website-and-hosting.md) for the
architecture, [hosting migration](11-hosting-migration.md) for moving it.

---

## What the site is

A static marketing and legal site. Plain HTML, CSS and vanilla JavaScript —
**no framework, no build step, no `package.json`**. Seven pages, one stylesheet,
two assets. 15 MB total, of which 14.9 MB is a single video.

Its jobs: explain the product, collect pre-launch waitlist emails, sell
pre-launch Premium plans, and host the legal documents (Privacy, Terms, Refund)
that the app and Razorpay both require.

### The seven pages

| Page | Purpose | Collects data? |
|---|---|---|
| `index.html` | Landing page, hero video, waitlist form, live counter | **Yes** — email |
| `pricing.html` | Independence Day plans, Razorpay checkout | **Yes** — name, email, phone |
| `about.html` | Product story, press/brand contacts | No |
| `privacy.html` | Privacy Policy (DPDP Act 2023) | No |
| `terms.html` | Terms of Service | No |
| `refund.html` | Refund & Cancellation Policy | No |
| `support.html` | Support and Grievance Officer contact | No |

---

## Timeline

### Pre-history — before 2026-07-22

The site existed and was live before the audit record begins. `website/` was
already in the repo when git history starts on 2026-07-31, and the security
reports were checking a live `nearmatch.in` from 2026-07-22, so the site
predates both. The waitlist table was created **2026-06-28**
(`20260628190000_waitlist.sql`), which is the earliest hard date tied to
website functionality.

### 2026-07-22 — first recorded website finding

⚠️ All 6 core pages HTTP 200, SSL valid to 2026-10-16. But `refund.html` was
**untracked locally and returned 404 in production** — a legal page missing
from the repo while live on the site.

### 2026-07-23 to 07-24 — 🚨 the DNS incident

The most serious website outage on record.

`nearmatch.in` **was not resolving to Netlify at all.** The apex A records
pointed at GoDaddy infrastructure (`76.223.105.230`, `13.248.243.5`), with
nameservers on GoDaddy defaults (`ns49.domaincontrol.com`,
`ns50.domaincontrol.com`). The domain served a **GoDaddy Website Builder
placeholder** — response headers showed `Server: DPS/2.0.0` and
`<meta name="generator" content="Go Daddy Website Builder 8.0.0000">`.

**Every page except `/` returned 404 in production** — pricing, about, support,
privacy, terms, refund. That included the Razorpay payment page and every
DPDP-relevant legal document.

It was easy to miss because **the GoDaddy placeholder was also titled
"NearMatch"**, so a glance at the homepage looked fine.

The Netlify deployment itself was healthy throughout — site
`tiny-dasik-a8f240`, custom domain `nearmatch.in`, latest deploy published
2026-07-18 with all 7 files present, and
`https://tiny-dasik-a8f240.netlify.app` serving everything correctly.

*Small forensic detail:* the 07-23 report logged SSL valid to **Oct 20** where
every other report says **Oct 16**. Consistent with the auditor observing
GoDaddy's certificate rather than Netlify's — corroborating the diagnosis.

The audit deliberately did not touch DNS: *"this is exactly the kind of
shared-infrastructure, hard-to-reverse change that needs the founder's explicit
decision."*

### 2026-07-25 to 08-09 — stable

DNS resolved. Every report PASS: HTTP 200 on all 6 key pages, SSL valid
2026-07-18 → 2026-10-16. The 2026-08-05 report explicitly identifies the server
as **Netlify Edge**, which is the clearest confirmation of who was serving the
apex.

### 2026-07-31 — waitlist reverted off Salesforce

`0f1b436` — *"Revert launch waitlist from Salesforce back to Supabase."* A
Salesforce integration for waitlist capture was tried and abandoned; Supabase
has been the store since.

### 2026-08-02 — waitlist notifications, and the checkout hole

- `7618381` — waitlist signups now email the founder via **Resend** and push via
  **ntfy.sh**
- `d92bb96` — notifications moved to sending from the verified `nearmatch.in`
  domain
- `ead87b5` — **`create-razorpay-order` rate-limited and its CORS pinned to
  `https://nearmatch.in`.** Before this the function had *no authentication at
  all*: audits repeatedly created real Razorpay orders using nothing but the
  public anon key (`order_THH4m6xpj122hS`, `order_THZh3sALpQ6KIH`,
  `order_THyARDkjIW7eqw`, `order_TJYJcYluE0pG9D`). No money moved, but anyone
  could spam order creation against the founder's account.

> That CORS pin is still in force and is now the single biggest gotcha in any
> hosting migration — checkout cannot work from any origin except the exact
> apex.

### 2026-08-03 — live waitlist counter

`f13ca1c` — the homepage shows waitlist momentum ("X people already waiting")
before launch, via `get_waitlist_count()` so the `waitlist` table itself is
never exposed.

### 2026-08-06 — Trust & Safety redesign

`3a070ea` — the Trust & Safety section of the landing page rebuilt.

### 2026-08-09 — the two changes that mattered most

- `3846314` — **hero background video and new brand mark added.** This is
  `assets/hero-bg.mp4`, 14,963,346 bytes, added as a plain autoplay `<video>`
  with an inline `source`. Every homepage view pulled the full 15 MB.
- `d5fb895` — **Independence Day pricing**: 1/2/5-month bundles (₹399 / ₹599 /
  ₹699) replacing monthly/quarterly, sold pre-launch, one-time payments with no
  auto-renewal.

### 2026-08-09 — audit record stops

No security or functional reports exist after this date. The next eleven days
of website operation are unaudited — and the bandwidth problem introduced on
08-09 went unnoticed throughout. **None of the existing checks would have
caught it**: asset weight and bandwidth consumption were never among them.

### 2026-08-16 — vendor disclosure audit

`479961c` — the Privacy Policy was found to have drifted badly from what the
site actually did:

- **Google Analytics** (`G-TXCHSJHEZP`) on 5 of 7 pages, setting cookies and
  sending Google IP/device/page data — and the policy contained no occurrence of
  "Google", "analytics" or "cookie" **at all**, while `privacy.html` was itself
  one of the instrumented pages
- **Google Fonts** on all 7 pages, disclosing visitor IP on every page view
- **The host** never named, though it necessarily receives every visitor IP
- **The policy's own scope statement was false** — it claimed website collection
  was the waitlist "and only that", while `pricing.html` collects name, email
  and phone from visitors with no account

All corrected. `81fb071` also deleted `netlify.toml` as dead — which turned out
to be wrong four days later.

### 2026-08-20 — 🚨 Netlify suspension

**Netlify suspended nearmatch.in** after the free tier's 100 GB monthly
bandwidth allowance was exhausted. Cause: the 15 MB hero video from 08-09. At
15.21 MB per uncached view the allowance covers roughly **6,576 views**.

Fixed same day in `42faa69` (#11): the video source is attached at runtime and
only when the browser signals the connection can afford it — skipping
`prefers-reduced-motion`, `prefers-reduced-data`, viewports under 900px, and
`saveData`/sub-4g. The poster is the video's first frame so the hero still
renders. Measured in Chromium: **mobile and reduced-motion views 15.21 MB →
0.25 MB**, desktop unchanged.

The same commit moved the `/assets/*` cache rule into `website/_headers` (read
by Netlify and Cloudflare Pages) and added `website/vercel.json` for a www→apex
301, noting Vercel does not auto-redirect aliases the way Netlify does.

`f6a5d4b` reverted the `netlify.toml` deletion — Netlify had been serving the
apex the whole time.

### 2026-08-21 — host migration, three attempts

| Commit | What | Outcome |
|---|---|---|
| `f22b960` | `_redirects` for Cloudflare Pages | Rule used **Netlify** scheme+hostname syntax that Pages silently ignores |
| `260fef9` | Moved www→apex to a zone-level Redirect Rule | Caught in review; fixed |
| `a613771` | `.htaccess` for **Hostinger** | Current direction |

Cloudflare **Workers** (not Pages) was connected to the repo on **two separate
accounts**, both building a project named `nearmatch`, both failing instantly on
every commit because Workers Builds requires a `wrangler.jsonc` that this repo
does not have. Still connected as of writing.

Hostinger's **app hosting** product rejects the site — *"Unsupported framework
or invalid project structure"* — because it expects a JavaScript framework and a
`package.json`. Correct product is Hostinger **Web Hosting** → `public_html`.

---

## Hosting: who has served this domain

| Period | Host | Evidence |
|---|---|---|
| ≤ 2026-07-18 | Netlify (`tiny-dasik-a8f240`) | Deploy published 07-18 |
| 07-23 → ~07-24 | **GoDaddy placeholder** (accidental) | Server headers, generator meta |
| ~07-25 → 08-20 | Netlify | 08-05 report: "Netlify Edge" |
| 08-20 | **Suspended** — bandwidth exhausted | #11 commit message |
| 08-20 → present | Vercel deploys the repo | PR check on every commit |
| planned | Cloudflare Pages → **Hostinger** | `a613771` |

Registrar: **GoDaddy**. TLS: 2026-07-18 → 2026-10-16 (Netlify-issued; a new
host issues its own).

---

## External services the site talks to

| Service | Where | What it gets |
|---|---|---|
| Supabase `ipwheuikchuoyskrfghi` | `index`, `pricing` | Waitlist inserts, counter RPC, order + payment functions |
| Razorpay checkout | `pricing` | Name, email, phone, payment |
| Google Fonts | all 7 pages | Visitor IP, every page view |
| Google Analytics `G-TXCHSJHEZP` | 5 of 7 pages | IP, device, pages viewed, cookies |
| Resend + ntfy.sh | backend | Waitlist signup alerts to founder |

The Supabase anon key is embedded in page source and is **publishable by
design**, protected by row-level security. Not a leak.

---

## Current state, 2026-08-21

**Content:** stable since 08-09 apart from legal text and hosting config.
**Code:** 5 commits ahead of `main` on PR #9.

**Open items specific to the website:**

1. 🔴 **`pricing.html` uses a Razorpay *test* key id** (`rzp_test_…`). Either
   nobody is being charged, or checkout fails outright — see issue #10. Live,
   mid-promo, with launch on 1 September.
2. 🔴 **The Privacy Policy still names Vercel as host.** A factual claim about
   who receives visitor IPs; wrong once Hostinger serves the apex.
3. 🟠 **Two Cloudflare Workers integrations** failing on every push. Disconnect.
4. 🟡 **No consent banner** — Google Analytics fires on page load. The policy
   now says so plainly; whether to gate it is undecided.
5. 🟡 **Analytics coverage inconsistent** — `about.html` and `pricing.html` have
   no gtag, so the highest-intent page in the funnel is unmeasured.
6. 🟡 **Audits stopped 08-09.** Restarting them should add an asset-weight and
   bandwidth check, which no existing check covered.

---

## The four lessons this site has already taught

1. **Verify every page, not the homepage.** The GoDaddy placeholder passed
   casual inspection for days because it shared the site's name.
2. **Ship assets with a cost model.** One 15 MB file, unnoticed for eleven
   days, took the site offline.
3. **Host configs do not transfer.** `netlify.toml`, `_headers`, `_redirects`,
   `vercel.json`, `.htaccess` — each is read by some hosts and silently ignored
   by others. A rule that looks right can be doing nothing, which is currently
   true of the `/assets/*` cache rule on Vercel.
4. **The Privacy Policy is code-adjacent.** It made false claims for weeks
   because nobody re-read it when the site changed.
