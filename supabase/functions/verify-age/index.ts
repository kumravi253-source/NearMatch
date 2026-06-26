// Age verification via Yoti's Facial Age Estimation API.
//
// Flow: the app captures a selfie (via the in-app WebView running
// Yoti's @getyoti/react-face-capture widget) and posts the resulting
// image + capture payload here. This function — and only this
// function — holds the Yoti private key, signs the request, and
// calls Yoti server-to-server. The mobile app never sees that key.
//
// STATUS: the call to Yoti itself (signRequest / callYoti below) is a
// placeholder. Yoti's docs describe request signing via their SDK's
// RequestBuilder class but don't give the raw signing algorithm in
// the pages I could fetch — filling this in for real needs either
// the official Node "yoti" SDK (likely importable via npm: specifier)
// or the exact snippet Yoti's dashboard generates once a Facial Age
// Estimation service exists. Wire that in before relying on this.
//
// We never persist the selfie image — it's used for this one request
// and discarded; Yoti also deletes it immediately after estimating.

import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

const YOTI_SDK_ID = Deno.env.get("YOTI_SDK_ID");
const YOTI_PEM = Deno.env.get("YOTI_PEM");
const YOTI_API_URL = "https://api.yoti.com/ai/v1/age-antispoofing?secure=true";
const MIN_AGE = 18;

interface YotiAgeResponse {
  age: { age: number; st_dev: number };
  antispoofing: { prediction: "real" | "fake" };
}

async function callYoti(imageBase64: string, securePayload: unknown): Promise<YotiAgeResponse> {
  if (!YOTI_SDK_ID || !YOTI_PEM) {
    throw new Error("Yoti credentials not configured (YOTI_SDK_ID / YOTI_PEM)");
  }

  // TODO: replace with the real signed request once Yoti credentials
  // and exact signing details are available. This is intentionally
  // left unimplemented rather than guessed.
  throw new Error("Yoti signing not yet implemented");

  // Sketch of the eventual call, once signRequest() is real:
  //
  // const body = { img: imageBase64, metadata: { device: "mobile" }, secure: securePayload };
  // const signed = signRequest(body, YOTI_PEM);
  // const res = await fetch(YOTI_API_URL, {
  //   method: "POST",
  //   headers: { "Content-Type": "application/json", "X-Yoti-Auth-Id": YOTI_SDK_ID },
  //   body: JSON.stringify(signed),
  // });
  // if (!res.ok) throw new Error(`Yoti API error: ${res.status}`);
  // return await res.json();
}

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    const userId = ctx.userClaims?.id;
    if (!userId) {
      return Response.json({ error: "not authenticated" }, { status: 401 });
    }

    const { selfieImageBase64, securePayload } = await req.json();
    if (!selfieImageBase64) {
      return Response.json({ error: "missing selfieImageBase64" }, { status: 400 });
    }

    let result: YotiAgeResponse;
    try {
      result = await callYoti(selfieImageBase64, securePayload);
    } catch (err) {
      console.error("Yoti call failed", err);
      return Response.json({ error: "verification_unavailable" }, { status: 502 });
    }

    // Conservative pass threshold: require the lower bound of a ~95%
    // confidence interval (age - 2*st_dev) to clear 18, AND a "real"
    // liveness prediction. A blurry/low-quality capture (high st_dev)
    // that merely averages to 18+ should not pass.
    const lowerBoundAge = result.age.age - 2 * result.age.st_dev;
    const passed = lowerBoundAge >= MIN_AGE && result.antispoofing.prediction === "real";

    const { error: insertError } = await ctx.supabaseAdmin.from("age_verifications").insert({
      user_id: userId,
      provider: "yoti",
      passed,
      estimated_age_min: Math.round(result.age.age - result.age.st_dev),
      estimated_age_max: Math.round(result.age.age + result.age.st_dev),
    });

    if (insertError) {
      console.error("Failed to record age verification", insertError);
      return Response.json({ error: "internal_error" }, { status: 500 });
    }

    return Response.json({ passed });
  }),
};
