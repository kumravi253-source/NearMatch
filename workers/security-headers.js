/**
 * Cloudflare Worker that actually applies security headers on nearmatch.in.
 *
 * website/_headers only runs when Workers static assets are the origin.
 * Live traffic is Cloudflare → Manus → Express, so those rules never fired
 * and responses still sent X-Powered-By with no CSP / frame / referrer policy.
 *
 * This script always strips X-Powered-By and sets the security headers.
 * /robots.txt and /sitemap.xml are served from website/ so they are not the
 * SPA shell. Other apex paths pass through to the existing origin so the
 * live Manus site is not replaced.
 */

const SECURITY_HEADERS = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy":
    "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
  "Content-Security-Policy-Report-Only":
    "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com https://checkout.razorpay.com https://manus-analytics.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; media-src 'self'; connect-src 'self' https://ipwheuikchuoyskrfghi.supabase.co https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://*.googletagmanager.com https://checkout.razorpay.com https://api.razorpay.com https://manus-analytics.com; frame-src https://api.razorpay.com https://checkout.razorpay.com; worker-src 'self' blob:",
};

function withSecurityHeaders(response) {
  const headers = new Headers(response.headers);
  headers.delete("X-Powered-By");
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(name, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function isWranglerLocal(request) {
  // Miniflare rewrites Host to the wrangler route zone (nearmatch.in).
  // This header is only present in `wrangler dev`.
  return Boolean(request.headers.get("mf-original-hostname"));
}

function fetchAssets(env, request) {
  const url = new URL(request.url);
  const path = url.pathname === "/" ? "/index.html" : url.pathname;
  return env.ASSETS.fetch(`https://assets.local${path}${url.search}`);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/robots.txt" || path === "/sitemap.xml") {
      return withSecurityHeaders(await fetchAssets(env, request));
    }

    const preview =
      isWranglerLocal(request) || url.hostname.endsWith(".workers.dev");

    if (!preview && (url.hostname === "nearmatch.in" || url.hostname === "www.nearmatch.in")) {
      const originResponse = await fetch(request, { redirect: "manual" });
      return withSecurityHeaders(originResponse);
    }

    return withSecurityHeaders(await fetchAssets(env, request));
  },
};
