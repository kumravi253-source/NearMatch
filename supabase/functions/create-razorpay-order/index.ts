import { withSupabase } from "jsr:@supabase/functions-js/edge-runtime.d.ts";

const RAZORPAY_KEY_ID     = Deno.env.get("RAZORPAY_KEY_ID");
const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET");

const PLAN_AMOUNTS: Record<string, number> = {
  monthly:   29900, // ₹299 in paise
  quarterly: 49900, // ₹499 in paise
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
      },
    });
  }

  if (req.method !== "POST") {
    return Response.json({ error: "method_not_allowed" }, { status: 405 });
  }

  let plan: string;
  try {
    const body = await req.json();
    plan = body.plan;
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  const amount = PLAN_AMOUNTS[plan];
  if (!amount) {
    return Response.json({ error: "invalid_plan" }, { status: 400 });
  }

  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    console.error("Razorpay credentials not configured");
    return Response.json({ error: "payment_not_configured" }, { status: 503 });
  }

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
      return Response.json({ error: "razorpay_error", detail: data }, { status: 502 });
    }

    return new Response(
      JSON.stringify({ order_id: data.id, amount: data.amount, currency: data.currency }),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (err) {
    console.error("Fetch to Razorpay failed", err);
    return Response.json({ error: "internal_error" }, { status: 500 });
  }
});
