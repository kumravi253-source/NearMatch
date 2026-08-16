// Age verification via Face++ (Megvii FacePP) Detect API.
//
// Flow: the app captures a selfie in-app (expo-image-picker, front
// camera) and posts the resulting base64 image here, together with the
// consent wording it displayed. This function — and only this function
// — holds the Face++ API key/secret and calls the Detect endpoint
// server-to-server. The mobile app never sees those credentials.
//
// The consent is recorded here rather than client-side so that "consent
// was logged before the image left the country" is enforced by control
// flow instead of by convention.
//
// Face++ accepts the image as base64 directly, so no byte decoding is
// needed here. We never persist the selfie ourselves — it's used for
// this one request and discarded.
//
// Face++ returns a single point age estimate (no low/high range like
// AWS Rekognition gave us), so to stay conservative we require the
// estimate to clear MIN_AGE by AGE_MARGIN years rather than trusting
// the raw number — the model's typical error margin is a few years in
// either direction.

import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

const FACEPP_BASE_URL = Deno.env.get("FACEPP_BASE_URL") ?? "https://api-us.faceplusplus.com";
const FACEPP_API_KEY = Deno.env.get("FACEPP_API_KEY");
const FACEPP_API_SECRET = Deno.env.get("FACEPP_API_SECRET");
const MIN_AGE = 18;
const AGE_MARGIN = 5;
const PROVIDER = "facepp";

// Guards the consent record against a client sending something absurd. We
// deliberately don't compare against a copy of the canonical string from
// src/lib/legal.js: this runtime can't import that file, so a copy here would
// drift, and an app version still in the wild would start failing verification
// the moment the wording changed. Storing what the app actually displayed is
// both more truthful as a record and less brittle.
const MIN_CONSENT_LEN = 40;
const MAX_CONSENT_LEN = 2000;

async function detectAge(imageBase64: string) {
  if (!FACEPP_API_KEY || !FACEPP_API_SECRET) {
    throw new Error("Face++ credentials not configured (FACEPP_API_KEY / FACEPP_API_SECRET)");
  }
  const body = new URLSearchParams({
    api_key: FACEPP_API_KEY,
    api_secret: FACEPP_API_SECRET,
    image_base64: imageBase64,
    return_attributes: "age",
  });
  const res = await fetch(`${FACEPP_BASE_URL}/facepp/v3/detect`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Face++ API error ${res.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    const userId = ctx.userClaims?.id;
    if (!userId) {
      return Response.json({ error: "not authenticated" }, { status: 401 });
    }

    const { selfieImageBase64, consentText } = await req.json();
    if (!selfieImageBase64) {
      return Response.json({ error: "missing selfieImageBase64" }, { status: 400 });
    }

    // The selfie is biometric data leaving the country to a named third party,
    // so it does not travel on the blanket signup consent. No consent, no
    // outbound call -- this check sits above the fetch deliberately.
    const consent = typeof consentText === "string" ? consentText.trim() : "";
    if (consent.length < MIN_CONSENT_LEN || consent.length > MAX_CONSENT_LEN) {
      return Response.json({ error: "missing_consent" }, { status: 400 });
    }

    // Recorded before the image is sent, not after: if this insert fails we
    // have no auditable record that consent was given, and sending anyway
    // would be exactly the situation the record exists to rule out.
    const { error: consentError } = await ctx.supabaseAdmin.from("biometric_consents").insert({
      user_id: userId,
      consent_text: consent,
      provider: PROVIDER,
    });

    if (consentError) {
      console.error("Failed to record biometric consent", consentError);
      return Response.json({ error: "internal_error" }, { status: 500 });
    }

    let result;
    try {
      result = await detectAge(selfieImageBase64);
    } catch (err) {
      console.error("Face++ call failed", err);
      return Response.json({ error: "verification_unavailable" }, { status: 502 });
    }

    const faces = result.faces ?? [];
    if (faces.length !== 1) {
      // Zero faces, or more than one in frame — reject rather than guess.
      return Response.json({
        passed: false,
        reason: faces.length === 0 ? "no_face_detected" : "multiple_faces_detected",
      });
    }

    const estimatedAge = faces[0].attributes?.age?.value;
    if (estimatedAge == null) {
      return Response.json({ passed: false, reason: "no_age_estimate" });
    }

    const passed = estimatedAge - AGE_MARGIN >= MIN_AGE;

    const { error: insertError } = await ctx.supabaseAdmin.from("age_verifications").insert({
      user_id: userId,
      provider: PROVIDER,
      passed,
      estimated_age_min: estimatedAge - AGE_MARGIN,
      estimated_age_max: estimatedAge + AGE_MARGIN,
    });

    if (insertError) {
      console.error("Failed to record age verification", insertError);
      return Response.json({ error: "internal_error" }, { status: 500 });
    }

    if (passed) {
      const { error: updateError } = await ctx.supabaseAdmin
        .from("profiles")
        .update({ age_verified: true })
        .eq("id", userId);
      if (updateError) {
        console.error("Failed to set age_verified", updateError);
        return Response.json({ error: "internal_error" }, { status: 500 });
      }
    }

    return Response.json({ passed, estimatedAge });
  }),
};
