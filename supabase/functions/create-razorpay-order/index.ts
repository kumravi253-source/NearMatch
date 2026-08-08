const RAZORPAY_KEY_ID     = Deno.env.get("RAZORPAY_KEY_ID");
const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET");
const SUPABASE_URL              = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const PLAN_AMOUNTS: Record<string, number> = {
  month1: 39900, // ₹399 in paise — Independence Day price, 1 month
  month2: 59900, // ₹599 in paise — Independence Day price, 2 months
  month5: 69900, // ₹699 in paise — Independence Day price, 5 months
};

// Anonymous website checkout — no NearMatch login, so requests only ever
// come from nearmatch.in itself, never the app.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://nearmatch.in",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
};

// No auth.uid() available on this anonymous path, so this caps order
// creation per caller IP instead — stops scripted spam against the
// Razorpay account. Fails open (logs and proceeds) on anything other than
// an actual rate-limit hit, since a checkout that silently breaks because
// this check itself had a hiccup is worse than the abuse it prevents.
async function checkRateLimit(req: Request): Promise<Response | null> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/check_razorpay_order_rate_limit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ p_ip: ip }),
    });
    if (!res.ok) {
      const errBody = await res.text();
      if (errBody.includes("rate_limit_exceeded")) {
        return Response.json({ error: "rate_limit_exceeded" }, { status: 429, headers: CORS_HEADERS });
      }
      console.error("Rate limit check failed unexpectedly, proceeding anyway", errBody);
    }
  } catch (err) {
    console.error("Rate limit check request failed, proceeding anyway", err);
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return Response.json({ error: "method_not_allowed" }, { status: 405, headers: CORS_HEADERS });
  }

  let plan: string;
  try {
    const body = await req.json();
    plan = body.plan;
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400, headers: CORS_HEADERS });
  }

  const amount = PLAN_AMOUNTS[plan];
  if (!amount) {
    return Response.json({ error: "invalid_plan" }, { status: 400, headers: CORS_HEADERS });
  }

  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    console.error("Razorpay credentials not configured");
    return Response.json({ error: "payment_not_configured" }, { status: 503, headers: CORS_HEADERS });
  }

  const rateLimited = await checkRateLimit(req);
  if (rateLimited) return rateLimited;

  const credentials = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);
  const receipt = `nm_${plan}_${Date.now()}`;

  try {
    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${credentials}`,
      },
      body: JSON.stringify({ amount, currency: "INR", receipt }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Razorpay order creation failed", data);
      return Response.json({ error: "razorpay_error", detail: data }, { status: 502, headers: CORS_HEADERS });
    }

    return new Response(
      JSON.stringify({ order_id: data.id, amount: data.amount, currency: data.currency }),
      {
        headers: {
          "Content-Type": "application/json",
          ...CORS_HEADERS,
        },
      }
    );
  } catch (err) {
    console.error("Fetch to Razorpay failed", err);
    return Response.json({ error: "internal_error" }, { status: 500, headers: CORS_HEADERS });
  }
});
