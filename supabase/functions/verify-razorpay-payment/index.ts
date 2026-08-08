// Turns a Razorpay checkout success into an actual Premium grant.
//
// The website's pricing page has no NearMatch login of its own — it
// just collects an email for Razorpay's prefill. So the flow here is:
// verify the payment really happened and really matches what we
// expect (never trust the client's "it succeeded" claim), then
// resolve that email to an existing NearMatch account and grant
// Premium to it. If no account exists yet for that email, the payment
// is real but unlinked — we say so explicitly rather than silently
// losing it or guessing.
//
// Called with no user JWT (the website has none), so this uses the
// service role key directly rather than the withSupabase({auth:"user"})
// helper the authenticated functions use.

const RAZORPAY_KEY_ID = Deno.env.get("RAZORPAY_KEY_ID");
const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const PLAN_AMOUNTS: Record<string, number> = {
  month1: 39900, // paise — Independence Day price, 1 month
  month2: 59900, // paise — Independence Day price, 2 months
  month5: 69900, // paise — Independence Day price, 5 months
};

const PLAN_DURATION_DAYS: Record<string, number> = {
  month1: 30,
  month2: 60,
  month5: 150,
};

// ₹399 / 30 days, rounded — used to convert leftover wallet balance
// into extra subscription days at redemption time.
const DAILY_RATE_PAISE = 1330;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function supabaseAdminFetch(path: string, init: RequestInit) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_SERVICE_ROLE_KEY!,
      "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Prefer": "return=representation",
      ...(init.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("verify-razorpay-payment misconfigured: missing required env vars");
    return json({ error: "payment_verification_not_configured" }, 503);
  }

  let body: {
    plan?: string;
    email?: string;
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_body" }, 400);
  }

  const { plan, email, razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

  if (!plan || !PLAN_AMOUNTS[plan]) {
    return json({ error: "invalid_plan" }, 400);
  }
  if (!email || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return json({ error: "missing_fields" }, 400);
  }

  // 1. Signature check — proves this callback really came from
  // Razorpay for this exact order+payment pair, not a forged request.
  const expectedSignature = await hmacSha256Hex(
    RAZORPAY_KEY_SECRET,
    `${razorpay_order_id}|${razorpay_payment_id}`,
  );
  if (expectedSignature !== razorpay_signature) {
    console.error("Razorpay signature mismatch", { razorpay_order_id, razorpay_payment_id });
    return json({ error: "signature_invalid" }, 400);
  }

  // 2. Re-fetch the payment from Razorpay directly and check its own
  // records — the amount/status must match what we expect for this
  // plan, independent of anything the client sent.
  const credentials = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);
  const paymentRes = await fetch(`https://api.razorpay.com/v1/payments/${razorpay_payment_id}`, {
    headers: { "Authorization": `Basic ${credentials}` },
  });
  const payment = await paymentRes.json();

  if (!paymentRes.ok) {
    console.error("Failed to fetch payment from Razorpay", payment);
    return json({ error: "razorpay_lookup_failed" }, 502);
  }
  if (payment.status !== "captured") {
    return json({ error: "payment_not_captured", status: payment.status }, 400);
  }
  if (payment.order_id !== razorpay_order_id) {
    return json({ error: "order_mismatch" }, 400);
  }
  if (payment.amount !== PLAN_AMOUNTS[plan]) {
    console.error("Amount mismatch", { expected: PLAN_AMOUNTS[plan], got: payment.amount });
    return json({ error: "amount_mismatch" }, 400);
  }

  // 3. Resolve the email to an actual NearMatch account.
  const userLookup = await supabaseAdminFetch("/rest/v1/rpc/get_user_id_by_email", {
    method: "POST",
    body: JSON.stringify({ p_email: email }),
  });
  const userId = userLookup.data as string | null;
  if (!userLookup.ok || !userId) {
    // The payment is real and captured — it is not lost, just not
    // linked yet. Told to the caller explicitly rather than pretending
    // this succeeded.
    return json({
      error: "no_account_for_email",
      message: "Payment received, but no NearMatch account exists for this email yet. Sign up in the app with the same email, then contact support to link this payment.",
    }, 409);
  }

  // 4. Grant Premium: insert the subscription (idempotent on
  // razorpay_payment_id — a retried request can't double-grant).
  const startsAt = new Date();
  const durationDays = PLAN_DURATION_DAYS[plan];
  const expiresAt = new Date(startsAt.getTime() + durationDays * 24 * 60 * 60 * 1000);

  const insertSub = await supabaseAdminFetch("/rest/v1/subscriptions", {
    method: "POST",
    headers: { "Prefer": "return=representation,resolution=ignore-duplicates" },
    body: JSON.stringify({
      user_id: userId,
      plan,
      status: "active",
      razorpay_order_id,
      razorpay_payment_id,
      amount_paise: payment.amount,
      starts_at: startsAt.toISOString(),
      expires_at: expiresAt.toISOString(),
    }),
  });

  if (!insertSub.ok) {
    console.error("Failed to insert subscription", insertSub.data);
    return json({ error: "internal_error" }, 500);
  }
  const subscription = Array.isArray(insertSub.data) ? insertSub.data[0] : insertSub.data;
  if (!subscription?.id) {
    // Duplicate webhook/retry for a payment already recorded — treat
    // as success, nothing new to grant.
    return json({ granted: true, already_recorded: true });
  }

  // 5. Apply any wallet balance as bonus days on top of the plan.
  const balanceLookup = await supabaseAdminFetch("/rest/v1/rpc/get_wallet_balance_paise", {
    method: "POST",
    body: JSON.stringify({ p_user_id: userId }),
  });
  const walletBalance = typeof balanceLookup.data === "number" ? balanceLookup.data : 0;
  const bonusDays = Math.floor(walletBalance / DAILY_RATE_PAISE);

  if (bonusDays > 0) {
    const paiseUsed = bonusDays * DAILY_RATE_PAISE;
    const extendedExpiresAt = new Date(expiresAt.getTime() + bonusDays * 24 * 60 * 60 * 1000);

    await supabaseAdminFetch(`/rest/v1/subscriptions?id=eq.${subscription.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        expires_at: extendedExpiresAt.toISOString(),
        wallet_paise_applied: paiseUsed,
      }),
    });

    await supabaseAdminFetch("/rest/v1/wallet_transactions", {
      method: "POST",
      body: JSON.stringify({
        user_id: userId,
        amount_paise: -paiseUsed,
        reason: "premium_redemption",
        reference_id: subscription.id,
      }),
    });
  }

  return json({ granted: true, plan, expires_at: expiresAt.toISOString(), bonus_days_applied: bonusDays });
});
