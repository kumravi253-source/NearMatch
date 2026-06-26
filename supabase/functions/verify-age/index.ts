// Age verification via AWS Rekognition's DetectFaces (AGE_RANGE attribute).
//
// Flow: the app captures a selfie in-app (expo-image-picker, front
// camera) and posts the resulting base64 image here. This function —
// and only this function — holds the AWS credentials and calls
// Rekognition server-to-server. The mobile app never sees those keys.
//
// DetectFaces is a "non-storage" Rekognition operation: AWS does not
// persist the image or any derived facial data for this call. Note:
// by default AWS may still use submitted images to improve its models
// unless the account has opted out via the AI services opt-out policy
// (https://docs.aws.amazon.com/rekognition/latest/dg/data-protection.html) —
// that's a one-time AWS account setting, not something this code can
// enforce, so it must be done on the AWS side before relying on this.
//
// We never persist the selfie ourselves — it's used for this one
// request and discarded.

import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { RekognitionClient, DetectFacesCommand } from "npm:@aws-sdk/client-rekognition@^3";

const AWS_REGION = Deno.env.get("AWS_REGION") ?? "us-east-1";
const AWS_ACCESS_KEY_ID = Deno.env.get("AWS_ACCESS_KEY_ID");
const AWS_SECRET_ACCESS_KEY = Deno.env.get("AWS_SECRET_ACCESS_KEY");
const MIN_AGE = 18;

function getClient(): RekognitionClient {
  if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
    throw new Error("AWS credentials not configured (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY)");
  }
  return new RekognitionClient({
    region: AWS_REGION,
    credentials: { accessKeyId: AWS_ACCESS_KEY_ID, secretAccessKey: AWS_SECRET_ACCESS_KEY },
  });
}

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    const userId = ctx.userClaims?.id;
    if (!userId) {
      return Response.json({ error: "not authenticated" }, { status: 401 });
    }

    const { selfieImageBase64 } = await req.json();
    if (!selfieImageBase64) {
      return Response.json({ error: "missing selfieImageBase64" }, { status: 400 });
    }

    let imageBytes: Uint8Array;
    try {
      imageBytes = Uint8Array.from(atob(selfieImageBase64), (c) => c.charCodeAt(0));
    } catch {
      return Response.json({ error: "invalid image encoding" }, { status: 400 });
    }

    let result;
    try {
      const client = getClient();
      result = await client.send(
        new DetectFacesCommand({
          Image: { Bytes: imageBytes },
          Attributes: ["AGE_RANGE"],
        })
      );
    } catch (err) {
      console.error("Rekognition call failed", err);
      return Response.json({ error: "verification_unavailable" }, { status: 502 });
    }

    const faces = result.FaceDetails ?? [];
    if (faces.length !== 1) {
      // Zero faces, or more than one in frame — reject rather than guess.
      return Response.json({
        passed: false,
        reason: faces.length === 0 ? "no_face_detected" : "multiple_faces_detected",
      });
    }

    const ageRange = faces[0].AgeRange;
    if (!ageRange || ageRange.Low == null) {
      return Response.json({ passed: false, reason: "no_age_estimate" });
    }

    // Conservative: require the LOW end of Rekognition's estimated
    // range to clear 18, not the midpoint — a range like 16-22 should
    // not pass just because its average is over 18.
    const passed = ageRange.Low >= MIN_AGE;

    const { error: insertError } = await ctx.supabaseAdmin.from("age_verifications").insert({
      user_id: userId,
      provider: "aws_rekognition",
      passed,
      estimated_age_min: ageRange.Low,
      estimated_age_max: ageRange.High,
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

    return Response.json({ passed, estimatedAgeMin: ageRange.Low, estimatedAgeMax: ageRange.High });
  }),
};
