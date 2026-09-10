# NearMatch web client

A browser front end for NearMatch, talking to the **same Supabase project** as
the iOS and Android app. One database, one set of RLS policies, one set of Edge
Functions — three clients.

    src/          the Expo mobile app (iOS + Android)
    website/      the static marketing site at nearmatch.in
    web/          this app, served at nearmatch.in/app/

## Why /app/ and not app.nearmatch.in

The `create-razorpay-order` Edge Function pins
`Access-Control-Allow-Origin` to exactly `https://nearmatch.in`. A subdomain
would be a different origin and could never call checkout. Serving the client
from a path on the same host keeps that working, and leaves `website/`
untouched at the document root.

`vite.config.ts` sets `base: '/app/'` and `main.tsx` sets the router
`basename` to match. The two must stay in step.

## Running it

    cp .env.example .env      # same project ref and anon key as the mobile app
    npm install
    npm run dev

The anon key is publishable by design — every table is protected by row-level
security, and it is the same key already shipped inside the mobile binaries.

    npm run build       typecheck, then build to dist/
    npm run typecheck   types only
    npm run preview     serve dist/ locally

## What is here

Step 1 of 3: the shell and the design system.

    src/styles/tokens.css   the citrus-pop palette, same values as
                            src/theme/theme.js and website/styles.css
    src/styles/global.css   reset, focus rings, reduced-motion
    src/styles/layout.css   the shell: bottom tabs under 900px, sidebar over
    src/ui/                 Button, Card, Field, Chip, Avatar, Spinner,
                            EmptyState, Sheet, Toast, Logo, AppShell, Screen
    src/lib/supabase.ts     browser client (localStorage, detectSessionInUrl)
    src/lib/session.tsx     session + profile context, consent logging,
                            referral capture, launch promo, location
    src/lib/avatars.ts      signed URLs for the private avatars bucket
    src/lib/premium.ts      is_premium / get_wallet_balance_paise
    src/lib/location.ts     navigator.geolocation -> profile_locations
    src/lib/legal.ts        the three canonical consent strings
    src/routes/             Splash, NotFound, and placeholders for the
                            feature screens

Feature screens land in step 2. The routes, guards and backend wiring they
plug into are already in place.

## Branding

`src/styles/tokens.css` duplicates the palette by hand rather than importing
it. A build step spanning an Expo app, a static HTML site and a Vite app would
cost more than it saves for about twenty values — but it does mean a palette
change is a three-file change. The token names match `website/styles.css` so
the two are diffable.

Pacifico is the wordmark face and is used nowhere else, exactly as on mobile
and on the marketing site.

## CORS on the Edge Functions

Grepping the function sources for `Access-Control` finds nothing in
`verify-age` and `delete-account`, which looks like they would fail a browser
preflight. They do not. Both are wrapped in `withSupabase` from
`@supabase/server`, whose `cors` option defaults to `'default'`: the wrapper
answers `OPTIONS` with a 204 *before* authenticating, and appends CORS headers
to every response the handler returns. The default set comes from
`@supabase/supabase-js/cors`:

    Access-Control-Allow-Origin:  *
    Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
    Access-Control-Allow-Headers: authorization, x-client-info, apikey,
                                  content-type, x-retry-count, traceparent,
                                  tracestate, baggage

So both functions are already callable from a browser, and no change is needed
to use them here.

Note the asymmetry with `create-razorpay-order` and
`verify-razorpay-payment`, which are hand-rolled `Deno.serve` handlers and so
carry their own explicit `CORS_HEADERS` — pinned to `https://nearmatch.in` on
the order path. That is not an inconsistency to tidy up: the wrapper-supplied
`*` is on endpoints that require a valid user JWT, which is sent as an explicit
header rather than an ambient cookie, and `Allow-Credentials` is not set.

## The app is noindex

Everything past sign-in is somebody's dating profile. Only the marketing site
at the document root should be indexed.
