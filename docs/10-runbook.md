# 10. Runbook

How to get NearMatch running, built, and shipped.

## Prerequisites

- Node.js with npm
- A Supabase project (or access to `ipwheuikchuoyskrfghi`)
- Expo CLI / EAS CLI (`>= 20.3.0`) for builds
- Xcode or Android Studio for native builds; Expo Go works for most iteration

## Running the app

```bash
npm install

# .env at repo root — both values are publishable client keys
cat > .env <<'ENV'
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
ENV

npm start          # Expo dev server
npm run ios        # native iOS build
npm run android    # native Android build
npm run web        # web target
```

`src/lib/supabase.js` **throws on startup** if either variable is missing, so a
misconfigured environment fails loudly instead of silently half-working.

Analytics is guarded to production (`if (__DEV__ === false)`), so development
sessions don't pollute Vexo data.

## Running the website

No build step — plain static files.

```bash
cd website && python3 -m http.server 8000
```

There is also a VS Code launch config for previewing it locally (`ccddec1`).

## Database changes

Migrations live in `supabase/migrations/`, named `YYYYMMDDHHMMSS_description.sql`
and applied in filename order.

**Conventions this repo follows — worth keeping:**

1. **Every schema change gets a migration.** Out-of-band production edits have
   silently reverted three times (see [document 7](07-project-timeline.md)).
2. **Migrations carry prose.** Every file opens with a comment explaining *why*,
   not just what. This is the single best thing about the codebase.
3. **Ordering matters.** Two migrations were renumbered (`bd857b9`) to sort
   after `20260810000000`. Check your timestamp sorts after everything applied.
4. **Wrap `auth.uid()` as `(select auth.uid())`** in RLS policies — the linter's
   `auth_rls_initplan` finding, applied across 22 policies in `20260810000000`.
5. **Pin `search_path`** on `SECURITY DEFINER` functions
   (`20260808000000`).
6. **No insert policy for anything a user must not forge** — verification
   results, consents, subscriptions. Service role only.

### Validating a migration without a Supabase project

The `biometric_consents` migration was validated against a local Postgres 16
before merge. The approach:

```bash
# initdb refuses to run as root — use an unprivileged user
initdb -D /tmp/pgdata -U postgres
pg_ctl -D /tmp/pgdata -o "-k /tmp -p 5599 -c listen_addresses=" -l /tmp/pgdata/log start

# stub what Supabase provides
psql -h /tmp -p 5599 -U postgres -c "
  create schema auth;
  create table auth.users (id uuid primary key);
  create role authenticated;
  create or replace function auth.uid() returns uuid
    language sql stable as \$\$ select null::uuid \$\$;"

psql -h /tmp -p 5599 -U postgres -v ON_ERROR_STOP=1 -f supabase/migrations/<file>.sql
```

Then verify what matters: `relrowsecurity = true`, and the policy set is what
you intended — particularly that no insert/update/delete policy exists where
only the service role should write.

## Edge functions

Deployed via the Supabase CLI or dashboard. Config in `supabase/config.toml`;
`verify-age` sets `verify_jwt = false` and handles auth itself.

Secrets go in **Project Settings → Edge Functions → Secrets** — never in the
repo. See [document 4](04-edge-functions.md) for the full list.

## Mobile builds

```bash
eas build --profile preview      # internal: iOS simulator, Android APK
eas build --profile production   # store builds, autoIncrement on
eas submit --profile production  # iOS app id 6794255698
```

`appVersionSource` is `remote`, so EAS owns the build number — don't bump it by
hand. Version lives in `app.json` (`1.0.1`).

**Two build failures worth remembering:** a duplicate `react-native` install
(`1e72c80`) and a lockfile out of sync with `vexo-analytics` (`cd83b13`). If
EAS fails on dependency resolution, suspect `package-lock.json` first.

## Deploying the website

Push to `main`. Vercel publishes `website/` (root directory set in project
settings; no build command). Pull requests get preview deployments.

> Hosting is mid-migration across Netlify, Vercel and Cloudflare Pages — see
> [document 6](06-website-and-hosting.md) before assuming where a change lands.

## Repository layout

```
App.js                  root component, tabs, session, Vexo init
src/                    app source (see document 2)
website/                static marketing site
supabase/
  migrations/           34 SQL migrations
  functions/            5 Deno edge functions
  seed.sql              App Store review demo fixtures
  config.toml
security-reports/       40 daily audit reports (2026-07-22 → 08-09)
functional-reports/     8 health reports (2026-08-03 → 08-09)
docs/                   this dossier
AGENTS.md / CLAUDE.md   agent instructions — read Expo 57 docs before coding
```

## Conventions that keep this codebase good

- **Comments explain why, not what.** The migrations and edge functions do this
  consistently. Match it.
- **Consent strings are canonical constants** in `src/lib/legal.js`, displayed
  and logged as the same value, so a stored record always matches what the user
  actually saw.
- **Reports are dated records**, not living documents. Don't rewrite history in
  `security-reports/` or `functional-reports/` — add a new file.
- **Never auto-apply RLS policy changes.** Report them for review.
