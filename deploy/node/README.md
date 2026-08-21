# Node.js deployment bundle for nearmatch.in

The site in `website/` is static HTML — it has no build step and no
`package.json` of its own. Some hosts (Hostinger's app hosting, Render,
Railway, Fly) will only accept an upload through a **Node.js** flow, which
requires a `package.json` and a start command. This directory is that wrapper.

It does not change the site. `server.js` serves `website/` as-is and
reimplements, in Express, the three rules that previously lived in host
config, so they travel with the site instead of being re-created per host:

| Rule | Previously in |
|---|---|
| `www.nearmatch.in` → `nearmatch.in` (301) | `.htaccess`, `vercel.json`, `_redirects` |
| http → https (301) | `.htaccess` |
| `/assets/*` cached 30 days | `.htaccess`, `_headers` |

The cache rule matters: `website/assets/hero-bg.mp4` is ~15 MB, and serving it
uncached is what exhausted Netlify's bandwidth allowance on 2026-08-20.

## Building the upload

    ./deploy/node/build.sh

Writes `deploy/node/dist/nearmatch-node.zip` — `package.json`, `server.js`,
`README.md` and `public/` (a copy of `website/`) at the **archive root**, with
no `node_modules/`. Files must be at the root: a previous upload was rejected
with *"Unsupported framework or invalid project structure"* because everything
sat one directory down.

## Host settings

| Setting | Value |
|---|---|
| Install / build command | `npm install` |
| Start command | `npm start` |
| Entry point | `server.js` |
| Node version | 18 or newer |

The server binds `process.env.PORT`, falling back to 3000.

## Local check

    cd deploy/node && npm install && npm start   # serves ../website on :3000

Redirects are skipped for hosts other than `nearmatch.in` and
`www.nearmatch.in`, so `localhost` serves directly rather than bouncing to the
live domain — and a platform health check hitting the raw container hostname
does not get 301'd into a failed deploy.

## Is this the right path?

Only if the host insists on a Node flow. Plain **Web Hosting → File Manager →
`public_html`** with `website/` (plus `website/.htaccess`) is simpler, cheaper
and has fewer moving parts. Use `nearmatch-hostinger.zip` for that. This
wrapper exists for the case where that option isn't on offer.
