# 11. Hosting migration guide

Everything needed to serve nearmatch.in from a new host. Written 2026-08-21
against the current `website/` directory.

> **Decision (2026-08-21, superseding an earlier Cloudflare Pages choice):
> Hostinger shared Web Hosting.** Upload the site into `public_html`; Apache
> config lives in `website/.htaccess`.
>
> Hostinger's *app hosting* product will not accept this site — it expects a
> JavaScript framework and a `package.json`, and rejects a static site with
> "Unsupported framework or invalid project structure". That is the wrong
> product, not a problem with the site. Use **Web Hosting → File Manager →
> `public_html`**.
>
> `.htaccess` is now the live config. `_headers`, `_redirects` and
> `vercel.json` are Cloudflare/Netlify/Vercel formats that Apache ignores
> entirely; they are kept only while those hosts are still connected, and the
> Cloudflare notes below are retained for reference. Two things remain that cannot be done from the repo:
> disconnect the Cloudflare **Workers** integrations (§3a), and update the
> Privacy Policy once Pages actually serves the apex (§6).

---

## 1. What you are deploying

A **static site. No build step, no Node, no framework.** Point a host at the
`website/` directory and serve it.

| Setting | Value |
|---|---|
| Publish / output directory | `website/` |
| Build command | *(none — leave empty)* |
| Install command | *(none)* |
| Node version | not required |
| Framework preset | None / Static HTML |
| Total size | **15 MB** (14.9 MB of that is one video) |

### Every file

| File | Size | Notes |
|---|---:|---|
| `index.html` | 26 KB | Landing page, waitlist form, live counter |
| `pricing.html` | 30 KB | Razorpay checkout |
| `about.html` | 18 KB | |
| `privacy.html` | 18 KB | Names the host — see §6 |
| `terms.html` | 6 KB | |
| `refund.html` | 4.5 KB | |
| `support.html` | 3 KB | |
| `styles.css` | 16 KB | Only stylesheet |
| `assets/hero-bg.mp4` | **15 MB** | See §5 — this matters |
| `assets/hero-poster.jpg` | 200 KB | Video's first frame |
| `_headers` | 443 B | Cache rules (Netlify / Cloudflare only) |
| `vercel.json` | 258 B | www redirect (Vercel only) |

Internal links are all **relative** (`pricing.html`, `styles.css`,
`assets/hero-bg.mp4`), so nothing breaks on a different origin. No favicon,
no Open Graph tags, no canonical tag — only a `<meta name="description">`.

---

## 2. ⚠️ The one thing that will break checkout

**`create-razorpay-order` pins CORS to exactly `https://nearmatch.in`:**

```ts
// supabase/functions/create-razorpay-order/index.ts:15
"Access-Control-Allow-Origin": "https://nearmatch.in",
```

Consequences you will hit during migration:

- **Preview URLs cannot take payments.** `something.pages.dev`,
  `something.vercel.app`, `deploy-preview-*.netlify.app` — all blocked by the
  browser. The pricing page will look fine and fail at "Pay with Razorpay".
- **A staging domain will not work either** unless you add it.
- Only the exact apex origin passes.

**Before testing checkout anywhere other than the live apex**, either add the
new origin to that constant and redeploy the function, or accept that checkout
can only be verified after DNS cutover.

(`verify-razorpay-payment` uses `"*"` and is unaffected.)

The waitlist form calls Supabase REST directly and is **not** origin-pinned, so
it works from any host.

---

## 3. Config files are host-specific — this is the trap

The two config files in `website/` do **not** both work everywhere:

| File | Netlify | Cloudflare Pages | Vercel |
|---|:---:|:---:|:---:|
| `_headers` (cache rules) | ✅ | ✅ | ❌ ignored |
| `vercel.json` (www redirect) | ❌ | ❌ | ✅ |

### 🔴 Live bug: the cache rule is currently doing nothing

`vercel.json` contains **only** a `redirects` key — no `headers`. Vercel does
not read `_headers`. So while Vercel serves the site, **`/assets/*` gets no
`Cache-Control` header at all**, and the 15 MB video is re-fetched far more
often than intended. That is the exact cost the `_headers` rule exists to
prevent.

Whether this matters depends on which host is actually serving the apex — see
[document 6](06-website-and-hosting.md), which is unresolved.

### What each target host needs

**Cloudflare Pages — chosen. The repo side is done:**
- `_headers` works as-is ✅
- `website/_redirects` present but carries **no active rules** — see §3b
- `vercel.json` is ignored by Pages; left in place while Vercel still deploys
- Delete `netlify.toml` once Cloudflare serves the apex (the file says so itself)

Pages project settings: build command **empty**, output directory `website`,
framework preset **None**. No config file in the repo is required.

### 3b. www→apex is NOT done in `_redirects` on Pages

Cloudflare Pages' `_redirects` matches **paths only**. A scheme+hostname source
— `https://www.nearmatch.in/* https://nearmatch.in/:splat 301` — is **Netlify**
syntax. Pages ignores it silently: no error, no warning, no redirect. The rule
looks correct in the repo and does nothing in production, leaving both
hostnames serving the site and splitting the canonical URL.

Configure it at the zone level instead — **Rules → Redirect Rules**:

| Field | Value |
|---|---|
| If | hostname **equals** `www.nearmatch.in` |
| Then | dynamic redirect |
| Expression | `concat("https://nearmatch.in", http.request.uri.path)` |
| Status | 301 |
| Query string | preserve |

**Verify it after cutover** — `curl -I https://www.nearmatch.in` should return
`301` with a `location:` header pointing at the apex. Do not assume it works
because the file exists.

### 3a. ⚠️ Disconnect the Workers integrations first

Cloudflare **Workers** — not Pages — is currently connected to this repo, on
**two separate accounts**, both building a project named `nearmatch`:

| Account | Build |
|---|---|
| `a7d3e08e73841636865c81ee932e6cd3` | `2a383caa` |
| `7ecbdd0705f4dc1b64578bc1e7741acd` | `08875b8e` |

Both fail instantly on every push, because Workers Builds needs a
`wrangler.jsonc` declaring the assets directory and there is none in this repo.
Pages does not need one — which is why Pages is the right fit for a static site.

**Disconnect both Workers integrations** in the Cloudflare dashboard, then
create a Pages project instead. Left connected, they will keep failing on every
commit and posting duplicate comments.

**Netlify:**
- `_headers` works as-is ✅
- `netlify.toml` at repo root already sets `base = "website"`, `publish = "."`, empty command
- Needs a `_redirects` file for www→apex, same as Cloudflare (Netlify auto-redirects domain aliases, so this may be handled at the domain level instead)

**Vercel:**
- `vercel.json` redirect works ✅
- **Must add a `headers` block to `vercel.json`** or the cache policy stays inert:
  ```json
  "headers": [{
    "source": "/assets/(.*)",
    "headers": [{ "key": "Cache-Control", "value": "public, max-age=2592000" }]
  }]
  ```
- Set root directory to `website` in project settings

---

## 4. DNS and TLS

Two hostnames must resolve:

| Host | Purpose |
|---|---|
| `nearmatch.in` (apex) | The canonical site |
| `www.nearmatch.in` | Must 301 to apex |

Registrar is **GoDaddy**. Per the July security reports the nameservers were
GoDaddy defaults (`ns49.domaincontrol.com`, `ns50.domaincontrol.com`) with apex
A records pointing at GoDaddy builder infrastructure.

> **This has bitten before.** On 2026-07-23 the apex served a **GoDaddy Website
> Builder placeholder** instead of the real site — every page except `/` 404'd
> in production, including the payment page and every legal page, and it went
> unnoticed for days because the placeholder was also titled "NearMatch".
> **After cutover, verify all seven pages load, not just the homepage.**

TLS was valid to **2026-10-16**. A new host will issue its own certificate;
allow for propagation before announcing the switch.

---

## 5. Choose the host with the video in mind

`assets/hero-bg.mp4` is **14,963,346 bytes**. On 2026-08-20 it exhausted
Netlify's free-tier 100 GB monthly allowance and **the site was suspended.** At
15.21 MB per uncached view that allowance covers roughly 6,576 views.

The current `index.html` mitigates this — it attaches the video source at
runtime and only when the browser signals the connection can afford it
(skipping `prefers-reduced-motion`, `prefers-reduced-data`, viewports under
900px, and `saveData`/sub-4g). Mobile and reduced-motion views drop from
15.21 MB to 0.25 MB.

**Two things to carry forward:**
1. Keep that runtime gating. Reverting to a plain autoplay `<video>` with an
   inline `source` reproduces the suspension.
2. Make sure `/assets/*` actually gets its `Cache-Control` header on the new
   host (§3). On Cloudflare Pages `_headers` handles it; on Vercel it does not.

Check the new host's bandwidth allowance against a realistic view count before
committing.

---

## 6. Update the Privacy Policy after cutover

`privacy.html` names the host as a data processor — it receives every visitor's
IP address and request logs. Line 106 currently says:

> **Vercel** — hosts the nearmatch.in website.

**This is a factual claim in a legal document and must match reality.** When the
new host is live, update that entry and the cross-border processing paragraph
below it. This is a genuine open item, not housekeeping — see
[document 9](09-open-items.md).

---

## 7. External services the site depends on

None of these need changing, but the new host must allow outbound requests to
them (any normal static host does):

| Service | Used by | Purpose |
|---|---|---|
| `ipwheuikchuoyskrfghi.supabase.co` | `index.html`, `pricing.html` | Waitlist insert, counter RPC, order + payment functions |
| `checkout.razorpay.com` | `pricing.html` | Payment checkout script |
| `fonts.googleapis.com` / `gstatic.com` | all 7 pages | Pacifico + Quicksand |
| `googletagmanager.com` | 5 of 7 pages | Google Analytics `G-TXCHSJHEZP` |

The Supabase anon key is embedded in the page source and is **publishable by
design** — protected by row-level security. It does not need rotating for a
host move.

---

## 8. Cutover checklist

1. [ ] Create the project; publish directory `website/`, **no build command**
2. [ ] Create the www→apex **Redirect Rule** in the Cloudflare dashboard (§3b) —
       *not* a `_redirects` line, which Pages ignores for hostname sources
3. [ ] Confirm `/assets/*` returns `Cache-Control: public, max-age=2592000`
4. [ ] Deploy to the host's preview URL and check all 7 pages render
5. [ ] **Do not expect checkout to work on the preview URL** (§2)
6. [ ] Point apex + www DNS at the new host; wait for TLS
7. [ ] **Verify all seven pages on the real domain**, not just `/` (§4)
7b. [ ] `curl -I https://www.nearmatch.in` → expect `301` to the apex (§3b)
8. [ ] Test the waitlist form end to end
9. [ ] Test a real Razorpay checkout — note issue #10, the pricing page is
       currently on a **test** key id, so settle that first
10. [ ] Update `privacy.html` with the new host name (§6)
11. [ ] Delete `netlify.toml` **only** once Cloudflare/the new host serves the apex
12. [ ] Watch bandwidth for the first week

---

## 9. Getting the files

The site is `website/` in `kumravi253-source/NearMatch`. Either point the host
at the repo (recommended — deploys on push), or copy the directory. It is 15 MB
and self-contained; nothing else in the repo is needed to serve it.
