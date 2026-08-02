import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
    const NTFY_TOPIC     = Deno.env.get("NTFY_TOPIC") ?? "nearmatch-waitlist";
    const NOTIFY_EMAIL   = "getsupport@nearmatch.in";

    let payload: { record?: { email?: string; created_at?: string } };
    try {
      payload = await req.json();
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    const email    = payload?.record?.email ?? "unknown";
    const signedAt = payload?.record?.created_at
      ? new Date(payload.record.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
      : new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

    // ── 1. Email via Resend (nearmatch.in is verified, send from our own domain) ──
    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "NearMatch Waitlist <waitlist@nearmatch.in>",
        to:   [NOTIFY_EMAIL],
        subject: `New waitlist signup - ${email}`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
            <h2 style="color:#E8603A;margin-bottom:4px">New Waitlist Signup!</h2>
            <p style="color:#666;margin-top:0">Someone just joined the NearMatch waitlist.</p>
            <div style="background:#FFF8EC;border-radius:10px;padding:16px 20px;margin:20px 0">
              <p style="margin:0 0 6px"><strong>Email:</strong> ${email}</p>
              <p style="margin:0"><strong>Time:</strong> ${signedAt} IST</p>
            </div>
            <p style="color:#888;font-size:13px">
              Log in to your
              <a href="https://supabase.com/dashboard/project/ipwheuikchuoyskrfghi/editor" style="color:#E8603A">
                Supabase dashboard
              </a>
              to see all signups.
            </p>
            <p style="color:#aaa;font-size:12px;margin-top:24px">NearMatch dot nearmatch.in</p>
          </div>
        `,
      }),
    });

    // ── 2. Push notification via ntfy.sh ──
    const pushRes = await fetch(`https://ntfy.sh/${NTFY_TOPIC}`, {
      method: "POST",
      headers: {
        "Title":    "New NearMatch Signup!",
        "Priority": "high",
        "Tags":     "tada,nearmatch",
      },
      body: `${email} joined the NearMatch waitlist at ${signedAt} IST`,
    });

    const emailOk   = emailRes.ok;
    const pushOk    = pushRes.ok;
    const emailBody = await emailRes.text();
    const pushBody  = await pushRes.text();

    console.log(`Email ok=${emailOk} body=${emailBody}, Push ok=${pushOk} status=${pushRes.status} topic=${NTFY_TOPIC} body=${pushBody}, for: ${email}`);

    return Response.json({ success: true, email: emailOk, push: pushOk, for: email });
  } catch (err) {
    console.error("Unhandled error:", err);
    return Response.json({ success: false, error: String(err) }, { status: 500 });
  }
});
